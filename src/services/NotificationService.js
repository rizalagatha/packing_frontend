import messaging from '@react-native-firebase/messaging';
import {Alert, PermissionsAndroid, Platform} from 'react-native';

// 1. Request Izin Notifikasi (Wajib untuk Android 13+ Tiramisu)
export const requestUserPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('Izin notifikasi Android 13+ diberikan');
      return true;
    } else {
      console.log('Izin notifikasi ditolak');
      return false;
    }
  } else {
    // Untuk Android di bawah 13, izin otomatis granted saat install
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  }
};

// 2. Ambil FCM Token
export const getFcmToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log('🔥 FCM TOKEN HP INI:', token);
    return token;
  } catch (error) {
    console.error('Gagal ambil token:', error);
    return null;
  }
};

// 3. Listener Notifikasi saat Aplikasi DIBUKA (Foreground)
export const notificationListener = () => {
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('Pesan baru di Foreground!', remoteMessage);

    // Tampilkan Alert sederhana biar Manager 'ngeh'
    Alert.alert(
      remoteMessage.notification?.title || 'Info',
      remoteMessage.notification?.body || 'Ada pesan masuk',
    );
  });

  return unsubscribe;
};
