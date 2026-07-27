import {decode, encode} from 'base-64';
import React from 'react';
import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';
import {AuthProvider} from './src/context/AuthContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';

if (!global.atob) {
  global.atob = decode;
}
if (!global.btoa) {
  global.btoa = encode;
}

// 2. Register Background Handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Pesan FCM diterima di BACKGROUND:', remoteMessage);
});

const Root = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </SafeAreaProvider>
);

AppRegistry.registerComponent(appName, () => Root);
