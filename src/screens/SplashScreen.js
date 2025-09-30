import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Image,
  Text,
  StatusBar,
} from 'react-native';

const SplashScreen = () => (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#c62828" />
    <Image source={require('../assets/logo.png')} style={styles.logo} />
    <ActivityIndicator size="large" color="#ffffff" />
    <Text style={styles.loadingText}>Memuat sesi...</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#c62828',
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#ffffff',
  },
});

export default SplashScreen;
