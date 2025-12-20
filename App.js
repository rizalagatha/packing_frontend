import React, {useContext} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Toast, {BaseToast, ErrorToast} from 'react-native-toast-message';

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
  // Anda bisa menambahkan override untuk 'info' jika perlu
};

const App = () => {
  const {isLoading, userToken, isBranchSelectionRequired} =
    useContext(AuthContext);

  if (isLoading) {
    return <SplashScreen />;
  }

  if (isBranchSelectionRequired) {
    return <BranchSelectionScreen />;
  }

  return (
    <NavigationContainer>
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
