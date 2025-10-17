import React, {useContext} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Toast, {BaseToast} from 'react-native-toast-message';

import {AuthContext} from './src/context/AuthContext';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
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

const Stack = createNativeStackNavigator();

const toastConfig = {
  /**
    Tipe 'success' di-override untuk mengizinkan lebih banyak baris teks.
  */
  success: props => (
    <BaseToast
      {...props}
      style={{borderLeftColor: '#4CAF50', height: 'auto', paddingVertical: 15}} // -> Buat tinggi otomatis
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{
        fontSize: 16,
        fontWeight: 'bold',
      }}
      text2Style={{
        fontSize: 14,
        color: '#616161',
      }}
      text2NumberOfLines={3} // -> Izinkan hingga 3 baris untuk pesan
    />
  ),
  // Anda bisa melakukan hal yang sama untuk 'error' jika pesannya juga sering panjang
};

const App = () => {
  const {isLoading, userToken} = useContext(AuthContext);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{animation: 'slide_from_right'}}>
        {userToken == null ? (
          // Grup Halaman Jika Belum Login
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
          </>
        )}
      </Stack.Navigator>

      {/* Komponen Toast untuk notifikasi di seluruh aplikasi */}
      <Toast config={toastConfig} />
    </NavigationContainer>
  );
};

export default App;
