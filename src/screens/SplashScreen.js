import React, {useEffect, useRef} from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Image,
  Text,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient'; // Pastikan library ini ada
import DeviceInfo from 'react-native-device-info'; // Opsional: untuk versi otomatis

const {width} = Dimensions.get('window');

const SplashScreen = () => {
  // 1. Animasi Values
  const fadeAnim = useRef(new Animated.Value(0)).current; // Opacity awal 0
  const scaleAnim = useRef(new Animated.Value(0.8)).current; // Scale awal 0.8
  const textAnim = useRef(new Animated.Value(0)).current; // Text muncul belakangan

  // 2. Jalankan Animasi saat Mount
  useEffect(() => {
    Animated.parallel([
      // Animasi Logo (Muncul + Membesar)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      // Animasi Teks (Muncul perlahan)
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 800,
        delay: 500, // Delay sedikit biar elegan
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, textAnim]);

  // Ambil versi aplikasi (hardcode atau pakai DeviceInfo)
  // const appVersion = 'v1.0.0';
  const appVersion = `v${DeviceInfo.getVersion()}`; // Jika pakai library

  return (
    <LinearGradient
      // Gunakan gradasi Merah (sesuai warna dasar Anda #c62828)
      // Dari Merah Terang ke Merah Gelap agar terlihat dalam
      colors={['#E53935', '#C62828', '#8E0000']}
      style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Container Tengah */}
      <View style={styles.centerContent}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{scale: scaleAnim}],
            alignItems: 'center',
          }}>
          {/* Logo dengan Shadow halus */}
          <View style={styles.logoContainer}>
            <Image source={require('../assets/logo.png')} style={styles.logo} />
          </View>

          {/* Nama Aplikasi (Branding) */}
          <Text style={styles.brandName}>KAOSAN MOBILE</Text>
        </Animated.View>

        {/* Loading Indicator & Text dengan Animasi */}
        <Animated.View
          style={{opacity: textAnim, marginTop: 40, alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#FFEBEE" />
          <Text style={styles.loadingText}>Menyiapkan sesi...</Text>
        </Animated.View>
      </View>

      {/* Footer (Versi Aplikasi) */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>{appVersion}</Text>
        <Text style={styles.copyrightText}>© 2025 Kaosan System</Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between', // Agar footer terdorong ke bawah
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    // Memberikan efek shadow pada logo agar "pop out"
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    marginBottom: 20,
  },
  logo: {
    width: 140, // Sedikit lebih besar
    height: 140,
    resizeMode: 'contain',
  },
  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2, // Memberikan kesan elegan
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 14,
    color: '#FFCDD2', // Merah muda pudar, bukan putih polos agar tidak menyilaukan
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  versionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  copyrightText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
  },
});

export default SplashScreen;
