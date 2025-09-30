import React, {createContext, useState, useEffect, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loginApi, apiClient} from '../api/ApiService';
import Toast from 'react-native-toast-message';

export const AuthContext = createContext();

export const AuthProvider = ({children}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  // --- DEFINISIKAN FUNGSI LOGIN DAN LOGOUT DI SINI (SEBELUM useEffect) ---

  const login = useCallback(async (userKode, password) => {
    const response = await loginApi(userKode, password);
    if (response.data.success) {
      const token = response.data.data.token;
      const user = response.data.data.user;
      setUserToken(token);
      setUserInfo(user);
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userInfo', JSON.stringify(user));
    }
    return response;
  }, []);

  const logout = useCallback(async () => {
    // Tidak perlu setIsLoading(true) agar tidak ada flash screen saat auto-logout
    setUserToken(null);
    setUserInfo(null);
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
      value={{login, logout, isLoading, userToken, userInfo}}>
      {children}
    </AuthContext.Provider>
  );
};
