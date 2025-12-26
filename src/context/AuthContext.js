import React, {createContext, useState, useEffect, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // --- DEFINISIKAN FUNGSI LOGIN DAN LOGOUT DI SINI (SEBELUM useEffect) ---

  // Helper untuk update token (dipanggil setelah setTokenAndInfo)
  const syncFcmToken = async authToken => {
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
  };

  const login = useCallback(async (userKode, password) => {
    // Fungsi ini sekarang bisa melempar error agar ditangani di LoginScreen
    const response = await loginApi(userKode, password);
    if (response.data.multiBranch) {
      // Kasus Multi Cabang
      setPreAuthToken(response.data.preAuthToken);
      setBranches(response.data.branches);
      setBranchSelectionRequired(true);
    } else {
      // Kasus Cabang Tunggal
      const {token, user} = response.data.data;
      setTokenAndInfo(token, user);
      syncFcmToken(token);
    }
  }, []);

  const finalizeLogin = useCallback(
    async branchCode => {
      try {
        const response = await selectBranchApi(branchCode, preAuthToken); // Panggil API baru
        const {token, user} = response.data.data;
        setTokenAndInfo(token, user);
        syncFcmToken(token);
        setBranchSelectionRequired(false); // Selesaikan proses pemilihan
      } catch (error) {
        // Handle error, misal tampilkan Toast
        console.error('Gagal finalisasi login', error);
      }
    },
    [preAuthToken],
  );

  const setTokenAndInfo = async (token, user) => {
    setUserToken(token);
    setUserInfo(user);
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('userInfo', JSON.stringify(user));
    setBranchSelectionRequired(false);
    setPreAuthToken(null);
    setBranches([]);
  };

  const logout = useCallback(async () => {
    // 1. Bersihkan State Utama
    setUserToken(null);
    setUserInfo(null);

    // 2. Bersihkan State Pre-Auth (PENTING AGAR KELUAR DARI BRANCH SELECTION)
    setPreAuthToken(null);
    setBranches([]);
    setBranchSelectionRequired(false);

    // 3. Bersihkan Storage
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
  }, []);

  // --- useEffect UNTUK INTERCEPTOR DI BAWAHNYA ---

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

  // --- useEffect UNTUK MEMERIKSA TOKEN SAAT APLIKASI DIMUAT ---

  useEffect(() => {
    const checkTokenOnLoad = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userString = await AsyncStorage.getItem('userInfo');
        if (token && userString) {
          setUserToken(token);
          setUserInfo(JSON.parse(userString));
        }
      } catch (e) {
        console.error('Gagal mengambil data sesi', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkTokenOnLoad();
  }, []);

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
