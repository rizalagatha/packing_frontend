import React from 'react';
import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';
import {AuthProvider} from './src/context/AuthContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';

// 2. Register Background Handler
// Handler ini harus diletakkan SEBELUM AppRegistry.registerComponent
// Fungsi ini akan jalan "di balik layar" saat aplikasi mati.
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Pesan FCM diterima di BACKGROUND:', remoteMessage);

  // NOTE: Anda tidak perlu memanggil Toast/Alert di sini.
  // Jika payload dari backend mengandung key "notification" (title & body),
  // Android otomatis akan memunculkan notifikasi di System Tray (Bar Atas).
});

const Root = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </SafeAreaProvider>
);

AppRegistry.registerComponent(appName, () => Root);
