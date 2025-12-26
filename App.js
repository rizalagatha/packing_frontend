import React, {useContext, useEffect, useCallback} from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Toast, {BaseToast, ErrorToast} from 'react-native-toast-message';
import {PermissionsAndroid, Platform, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {AndroidImportance} from '@notifee/react-native';

// --- IMPORT FIREBASE MESSAGING ---
import messaging from '@react-native-firebase/messaging';

import {AuthContext} from './src/context/AuthContext';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import BranchSelectionScreen from './src/screens/BranchSelectionScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PackingScreen from './src/screens/PackingScreen';
import PackingHistoryScreen from './src/screens/PackingHistoryScreen';
import SuratJalanScreen from './src/screens/SuratJalanScreen';
import TerimaSjScreen from './src/screens/TerimaSjScreen';
import ReturAdminScreen from './src/screens/ReturAdminScreen';
import LinkWhatsappScreen from './src/screens/LinkWhatsappScreen';
import RiwayatSuratJalanScreen from './src/screens/RiwayatSuratJalanScreen';
import LaporanPendingScreen from './src/screens/LaporanPendingScreen';
import CheckerScreen from './src/screens/CheckerScreen';
import MutasiStoreScreen from './src/screens/MutasiStoreScreen';
import MutasiTerimaScreen from './src/screens/MutasiTerimaScreen';
import LowStockScreen from './src/screens/LowStockScreen';
import MintaBarangScreen from './src/screens/MintaBarangScreen';
import PenjualanLangsungScreen from './src/screens/PenjualanLangsungScreen';
import PenjualanListScreen from './src/screens/PenjualanListScreen';
import StokOpnameScreen from './src/screens/StokOpnameScreen';
import ManagementDashboardScreen from './src/screens/ManagementDashboardScreen';
import PackingListScreen from './src/screens/PackingListScreen';

const Stack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef();

const toastConfig = {
  // Override tipe 'success'
  success: props => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#4CAF50',
        height: 'auto',
        minHeight: 60,
        paddingVertical: 10,
      }}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{fontSize: 16, fontWeight: 'bold'}}
      text2Style={{fontSize: 14, color: '#616161'}}
      text2NumberOfLines={4} // Izinkan hingga 4 baris untuk pesan
    />
  ),
  // Override tipe 'error'
  error: props => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#D32F2F',
        height: 'auto',
        minHeight: 60,
        paddingVertical: 10,
      }}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{fontSize: 16, fontWeight: 'bold'}}
      text2Style={{fontSize: 14, color: '#616161'}}
      text2NumberOfLines={4} // Izinkan hingga 4 baris untuk pesan
    />
  ),
  // Override tipe 'info' (Untuk Notifikasi FCM)
  info: props => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#2196F3', // Biru untuk info
        height: 'auto',
        minHeight: 60,
        paddingVertical: 10,
      }}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{fontSize: 16, fontWeight: 'bold'}}
      text2Style={{fontSize: 14, color: '#616161'}}
      text2NumberOfLines={4}
    />
  ),
};

const App = () => {
  const {isLoading, userToken, isBranchSelectionRequired} =
    useContext(AuthContext);

  const handleNotificationClick = useCallback(
    data => {
      // Pastikan navigasi siap dan user sudah login
      if (navigationRef.isReady() && userToken) {
        // Navigasi ke Dashboard Management dan buka modal approval
        navigationRef.navigate('ManagementDashboard', {
          openApproval: true,
          targetId: data?.transaksi,
        });
      } else {
        console.log('Navigasi belum siap atau user belum login');
      }
    },
    [userToken],
  );

  // --- LOGIKA NOTIFIKASI DI SINI ---
  useEffect(() => {
    const createChannel = async () => {
      // 1. Buat Channel dengan Prioritas TINGGI (High)
      await notifee.createChannel({
        id: 'otorisasi_urgent', // ID ini harus sama dengan Backend nanti
        name: 'Permintaan Otorisasi',
        importance: AndroidImportance.HIGH, // <--- INI KUNCINYA (Agar Pop-up & Getar)
        sound: 'default',
        vibration: true,
      });
    };

    createChannel();

    const requestPermission = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Android 13+ butuh izin eksplisit
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getFcmToken();
        }
      } else {
        // Android < 13 atau iOS
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          getFcmToken();
        }
      }
    };

    const getFcmToken = async () => {
      try {
        const token = await messaging().getToken();
        console.log('🔥 FCM TOKEN HP INI:', token);

        // [BARU] Simpan token ke storage agar bisa diakses AuthContext
        await AsyncStorage.setItem('fcmToken', token);
      } catch (error) {
        console.error('Gagal ambil token:', error);
      }
    };

    // 1. Jalankan request izin & ambil token
    requestPermission();

    // 1. Listener FOREGROUND (Aplikasi Sedang Dibuka)
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      // Tampilkan Notifikasi Sistem (Bukan Toast)
      await notifee.displayNotification({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        android: {
          channelId: 'otorisasi_urgent', // Pakai channel High tadi
          // Pastikan nama file icon tetap yang transparan (tanpa .png)
          smallIcon: 'ic_notification',

          // [GANTI JADI MERAH]
          color: '#D32F2F', // Contoh pakai merah material
          pressAction: {
            id: 'default',
          },
        },
        data: remoteMessage.data, // Simpan data agar bisa diklik
      });
    });

    // 2. Listener BACKGROUND (Aplikasi Minimize -> Diklik)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notifikasi diklik dari Background:', remoteMessage.data);
      handleNotificationClick(remoteMessage.data);
    });

    // 3. Listener QUIT/KILLED (Aplikasi Mati Total -> Diklik)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'Notifikasi diklik dari status Mati:',
            remoteMessage.data,
          );
          // Beri delay sedikit agar state userToken di AuthContext sempat termuat
          setTimeout(() => {
            handleNotificationClick(remoteMessage.data);
          }, 1500);
        }
      });

    return unsubscribe;
  }, [handleNotificationClick]);
  // --- END LOGIKA NOTIFIKASI ---

  if (isLoading) {
    return <SplashScreen />;
  }

  if (isBranchSelectionRequired) {
    return <BranchSelectionScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{animation: 'slide_from_right'}}>
        {userToken == null ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
        ) : (
          // Grup Halaman Jika Sudah Login
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{title: 'Dashboard'}}
            />
            <Stack.Screen
              name="ManagementDashboard"
              component={ManagementDashboardScreen}
              options={{title: 'Management Dashboard', headerShown: false}} // Header disembunyikan karena punya header sendiri
            />
            <Stack.Screen
              name="Packing"
              component={PackingScreen}
              options={{title: 'Proses Packing'}}
            />
            <Stack.Screen
              name="PackingHistory"
              component={PackingHistoryScreen}
              options={{title: 'Riwayat Packing'}}
            />
            <Stack.Screen
              name="SuratJalan"
              component={SuratJalanScreen}
              options={{title: 'Buat Surat Jalan'}}
            />
            <Stack.Screen
              name="PackingList"
              component={PackingListScreen}
              options={{title: 'Buat Packing List'}}
            />
            <Stack.Screen
              name="LowStock"
              component={LowStockScreen}
              options={{title: 'Analisis Stok Menipis'}}
            />
            <Stack.Screen
              name="RiwayatSuratJalan"
              component={RiwayatSuratJalanScreen}
              options={{title: 'Riwayat Surat Jalan'}}
            />
            <Stack.Screen
              name="TerimaSj"
              component={TerimaSjScreen}
              options={{title: 'Terima Surat Jalan'}}
            />
            <Stack.Screen
              name="ReturAdmin"
              component={ReturAdminScreen}
              options={{title: 'Retur Admin'}}
            />
            <Stack.Screen
              name="LaporanPending"
              component={LaporanPendingScreen}
              options={{title: 'Laporan Pending'}}
            />
            <Stack.Screen
              name="LinkWhatsapp"
              component={LinkWhatsappScreen}
              options={{title: 'Tautkan WhatsApp'}}
            />
            <Stack.Screen
              name="Checker"
              component={CheckerScreen}
              options={{title: 'Checker STBJ'}}
            />
            <Stack.Screen
              name="MutasiStore"
              component={MutasiStoreScreen}
              options={{title: 'Mutasi Store Kirim'}}
            />
            <Stack.Screen
              name="MutasiTerima"
              component={MutasiTerimaScreen}
              options={{title: 'Mutasi Store Terima'}}
            />
            <Stack.Screen
              name="MintaBarang"
              component={MintaBarangScreen}
              options={{title: 'Minta Barang ke DC'}}
            />
            <Stack.Screen
              name="PenjualanLangsung"
              component={PenjualanLangsungScreen}
              options={{title: 'Penjualan Langsung'}}
            />
            <Stack.Screen
              name="PenjualanList"
              component={PenjualanListScreen}
              options={{title: 'Daftar Penjualan'}}
            />
            <Stack.Screen
              name="StokOpname"
              component={StokOpnameScreen}
              options={{title: 'Stok Opname (Offline)'}}
            />
          </>
        )}
      </Stack.Navigator>

      {/* Komponen Toast untuk notifikasi di seluruh aplikasi */}
      <Toast config={toastConfig} />
    </NavigationContainer>
  );
};

export default App;
