import React, {createContext, useState, useEffect, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import {
  apiClient,
  loginApi,
  selectBranchApi,
  updateFcmTokenApi,
} from '../api/ApiService';
import Toast from 'react-native-toast-message';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  const [isBranchSelectionRequired, setBranchSelectionRequired] =
    useState(false);
  const [preAuthToken, setPreAuthToken] = useState(null);
  const [branches, setBranches] = useState([]);

  // --- 1. HELPER (Dibungkus useCallback agar stabil) ---

  const subscribeToTopic = useCallback(async cabang => {
    if (!cabang) return;
    const topic = `approval_${cabang}`;
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`[FCM] Berhasil subscribe ke topic: ${topic}`);
    } catch (e) {
      console.error('[FCM] Gagal subscribe topic:', e);
    }
  }, []);

  const unsubscribeFromTopic = useCallback(async cabang => {
    if (!cabang) return;
    const topic = `approval_${cabang}`;
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`[FCM] Berhasil unsubscribe dari topic: ${topic}`);
    } catch (e) {
      console.error('[FCM] Gagal unsubscribe topic:', e);
    }
  }, []);

  const syncFcmToken = useCallback(async authToken => {
    try {
      const fcmToken = await AsyncStorage.getItem('fcmToken');
      if (fcmToken && authToken) {
        console.log('Mengirim FCM Token ke Backend...');
        await updateFcmTokenApi(fcmToken, authToken);
        console.log('FCM Token terkirim!');
      } else {
        console.log('FCM Token belum tersedia di storage.');
      }
    } catch (error) {
      console.error('Gagal sync FCM Token:', error);
    }
  }, []);

  // --- 2. SET STATE UTAMA (Dibungkus useCallback & dependensi ke subscribeToTopic) ---

  const setTokenAndInfo = useCallback(
    async (token, user) => {
      setUserToken(token);
      setUserInfo(user);
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userInfo', JSON.stringify(user));
      setBranchSelectionRequired(false);
      setPreAuthToken(null);
      setBranches([]);

      // Subscribe Topic saat data tersimpan
      if (user && user.cabang) {
        subscribeToTopic(user.cabang);
      }
    },
    [subscribeToTopic], // Dependency wajib
  );

  // --- 3. LOGIN FUNCTIONS (Sekarang aman memanggil setTokenAndInfo) ---

  const login = useCallback(
    async (userKode, password) => {
      const response = await loginApi(userKode, password);
      if (response.data.multiBranch) {
        setPreAuthToken(response.data.preAuthToken);
        setBranches(response.data.branches);
        setBranchSelectionRequired(true);
      } else {
        const {token, user} = response.data.data;
        // Panggil fungsi yang sudah di-memoize
        await setTokenAndInfo(token, user);
        await syncFcmToken(token);
      }
    },
    [setTokenAndInfo, syncFcmToken], // Dependency lengkap
  );

  const finalizeLogin = useCallback(
    async branchCode => {
      try {
        const response = await selectBranchApi(branchCode, preAuthToken);
        const {token, user} = response.data.data;
        await setTokenAndInfo(token, user);
        await syncFcmToken(token);
        setBranchSelectionRequired(false);
      } catch (error) {
        console.error('Gagal finalisasi login', error);
        Toast.show({
          type: 'error',
          text1: 'Login Gagal',
          text2: 'Terjadi kesalahan saat memilih cabang',
        });
      }
    },
    [preAuthToken, setTokenAndInfo, syncFcmToken], // Dependency lengkap
  );

  const logout = useCallback(async () => {
    // Unsubscribe sebelum hapus data
    if (userInfo && userInfo.cabang) {
      unsubscribeFromTopic(userInfo.cabang);
    }

    setUserToken(null);
    setUserInfo(null);
    setPreAuthToken(null);
    setBranches([]);
    setBranchSelectionRequired(false);

    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
  }, [userInfo, unsubscribeFromTopic]);

  // --- 4. EFFECTS ---

  useEffect(() => {
    const responseInterceptor = apiClient.interceptors.response.use(
      response => response,
      async error => {
        if (
          error.response &&
          (error.response.status === 401 || error.response.status === 403)
        ) {
          Toast.show({
            type: 'error',
            text1: 'Sesi Kedaluwarsa',
            text2: 'Silakan login kembali.',
          });
          logout();
        }
        return Promise.reject(error);
      },
    );
    return () => apiClient.interceptors.response.eject(responseInterceptor);
  }, [logout]);

  useEffect(() => {
    const checkTokenOnLoad = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userString = await AsyncStorage.getItem('userInfo');
        if (token && userString) {
          const user = JSON.parse(userString);
          setUserToken(token);
          setUserInfo(user);

          if (user.cabang) {
            subscribeToTopic(user.cabang);
          }
        }
      } catch (e) {
        console.error('Gagal mengambil data sesi', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkTokenOnLoad();
  }, [subscribeToTopic]); // Tambahkan subscribeToTopic agar aman

  return (
    <AuthContext.Provider
      value={{
        login,
        logout,
        isBranchSelectionRequired,
        branches,
        finalizeLogin,
        isLoading,
        userToken,
        userInfo,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
