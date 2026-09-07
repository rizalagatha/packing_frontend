import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react'; // Tambah useRef
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import {
  apiClient,
  loginApi,
  selectBranchApi,
  updateFcmTokenApi,
  loginWithDeviceApi,
  loginWithDeviceNoBioApi,
} from '../api/ApiService';
import Toast from 'react-native-toast-message';
import {AppState} from 'react-native';
import {jwtDecode} from 'jwt-decode';

export const AuthContext = createContext();

// --- FIX: Decoder Base64 yang aman untuk React Native (Tanpa atob) ---
const decodeToken = token => {
  try {
    if (!token) {
      return null;
    }

    return jwtDecode(token);
  } catch (e) {
    console.error('Gagal decode token:', e);
    return null;
  }
};

export const AuthProvider = ({children}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const logoutTimer = useRef(null);

  const [isBranchSelectionRequired, setBranchSelectionRequired] =
    useState(false);
  const [preAuthToken, setPreAuthToken] = useState(null);
  const [branches, setBranches] = useState([]);

  // --- FUNGSI BARU: START AUTO LOGOUT TIMER ---
  const startLogoutTimer = useCallback(
    token => {
      // Bersihkan timer lama jika ada
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
      }

      const decoded = decodeToken(token);
      if (!decoded || !decoded.exp) {
        return;
      }

      // Hitung sisa waktu (exp dalam detik, Date.now dalam ms)
      const expirationTime = decoded.exp * 1000;
      const timeLeft = expirationTime - Date.now();

      if (timeLeft <= 0) {
        console.log('[AUTH] Token sudah hangus, memaksa logout...');
        logout();
      } else {
        // Pasang "Bom Waktu" otomatis
        logoutTimer.current = setTimeout(() => {
          Toast.show({
            type: 'error',
            text1: 'Sesi Berakhir',
            text2: 'Waktu login Anda telah habis, silakan login kembali.',
          });
          logout();
        }, timeLeft);

        console.log(
          `[AUTH] Auto-logout aktif dalam: ${Math.round(
            timeLeft / 1000 / 60,
          )} Menit`,
        );
      }
    },
    [logout],
  );

  // --- 1. HELPER (Dibungkus useCallback agar stabil) ---

  const subscribeToTopic = useCallback(async cabang => {
    if (!cabang) {
      return;
    }
    const topic = `approval_${cabang}`;
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`[FCM] Berhasil subscribe ke topic: ${topic}`);
    } catch (e) {
      console.error('[FCM] Gagal subscribe topic:', e);
    }
  }, []);

  const unsubscribeFromTopic = useCallback(async cabang => {
    if (!cabang) {
      return;
    }
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

      // Jalankan Timer saat data diset
      startLogoutTimer(token);

      setBranchSelectionRequired(false);
      setPreAuthToken(null);
      setBranches([]);

      if (user && user.cabang) {
        subscribeToTopic(user.cabang);
      }
    },
    [subscribeToTopic, startLogoutTimer],
  );

  // --- 3. LOGIN FUNCTIONS (Sekarang aman memanggil setTokenAndInfo) ---

  const login = useCallback(
    async (userKode, password, latitude, longitude) => {
      // Pastikan API service Anda juga di-update untuk menerima 4 parameter ini
      const response = await loginApi(userKode, password, latitude, longitude);
      if (response.data.multiBranch) {
        setPreAuthToken(response.data.preAuthToken);
        setBranches(response.data.branches);
        setBranchSelectionRequired(true);
      } else {
        const {token, user} = response.data.data;
        await setTokenAndInfo(token, user);
        await syncFcmToken(token);
      }
    },
    [setTokenAndInfo, syncFcmToken],
  );

  const loginDevice = useCallback(
    async (userKode, password, deviceId, signature, latitude, longitude) => {
      // Teruskan ke API
      const response = await loginWithDeviceApi(
        userKode,
        password,
        deviceId,
        signature,
        latitude,
        longitude,
      );
      if (response.data.multiBranch) {
        setPreAuthToken(response.data.preAuthToken);
        setBranches(response.data.branches);
        setBranchSelectionRequired(true);
      } else {
        const {token, user} = response.data.data;
        await setTokenAndInfo(token, user);
        await syncFcmToken(token);
      }
    },
    [setTokenAndInfo, syncFcmToken],
  );

  const loginDeviceNoBio = useCallback(
    async (userKode, password, deviceId, deviceSecret, latitude, longitude) => {
      const response = await loginWithDeviceNoBioApi(
        userKode,
        password,
        deviceId,
        deviceSecret,
        latitude,
        longitude,
      );
      if (response.data.multiBranch) {
        setPreAuthToken(response.data.preAuthToken);
        setBranches(response.data.branches);
        setBranchSelectionRequired(true);
      } else {
        const {token, user} = response.data.data;
        await setTokenAndInfo(token, user);
        await syncFcmToken(token);
      }
    },
    [setTokenAndInfo, syncFcmToken],
  );

  const finalizeLogin = useCallback(
    async (branchCode, latitude, longitude) => {
      try {
        const response = await selectBranchApi(
          branchCode,
          preAuthToken,
          latitude,
          longitude,
        );
        const {token, user} = response.data.data;
        await setTokenAndInfo(token, user);
        await syncFcmToken(token);
        setBranchSelectionRequired(false);
      } catch (error) {
        console.error('Gagal finalisasi login', error);
        Toast.show({
          type: 'error',
          text1: 'Login Gagal',
          text2:
            error.response?.data?.message ||
            'Terjadi kesalahan saat memilih cabang',
        });
      }
    },
    [preAuthToken, setTokenAndInfo, syncFcmToken],
  );

  const logout = useCallback(async () => {
    // FIX: Cegah tembakan API jika token memang belum ada (mencegah loop 401 Interceptor)
    if (userToken) {
      try {
        await updateFcmTokenApi(null, userToken);
      } catch (e) {
        console.log('Gagal hapus token di server, lanjut logout...');
      }
    }

    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
    }

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
  }, [userInfo, unsubscribeFromTopic, userToken]);

  // --- 4. EFFECTS ---

  useEffect(() => {
    const responseInterceptor = apiClient.interceptors.response.use(
      response => response,
      async error => {
        if (
          error.response &&
          (error.response.status === 401 || error.response.status === 403)
        ) {
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

          // Mulai timer auto-logout saat aplikasi dibuka
          startLogoutTimer(token);

          if (user.cabang) {
            subscribeToTopic(user.cabang);
          }
        }
      } catch (e) {
        console.error('Gagal memuat sesi:', e);
      } finally {
        setIsLoading(false);
      }
    };
    checkTokenOnLoad();
  }, [subscribeToTopic, startLogoutTimer]);

  // Pantau saat aplikasi kembali dari background (Lock screen / pindah app)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && userToken) {
        console.log(
          '[AUTH] App kembali aktif, cek ulang masa berlaku token...',
        );
        startLogoutTimer(userToken);
      }
    });
    return () => subscription.remove();
  }, [userToken, startLogoutTimer]);

  return (
    <AuthContext.Provider
      value={{
        login,
        loginDevice,
        loginDeviceNoBio,
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
