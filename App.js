import React, {useContext} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import {AuthContext} from './src/context/AuthContext';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PackingScreen from './src/screens/PackingScreen';
import PackingHistoryScreen from './src/screens/PackingHistoryScreen';
import SuratJalanScreen from './src/screens/SuratJalanScreen';
import TerimaSjScreen from './src/screens/TerimaSjScreen';
import ReturAdminScreen from './src/screens/ReturAdminScreen';

const Stack = createNativeStackNavigator();

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
              name="TerimaSj"
              component={TerimaSjScreen}
              options={{title: 'Terima Surat Jalan'}}
            />
            <Stack.Screen
              name="ReturAdmin"
              component={ReturAdminScreen}
              options={{title: 'Retur Admin'}}
            />
          </>
        )}
      </Stack.Navigator>

      {/* Komponen Toast untuk notifikasi di seluruh aplikasi */}
      <Toast />
    </NavigationContainer>
  );
};

export default App;
