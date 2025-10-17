import React, {useState, useContext} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Image,
  StatusBar,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const LoginScreen = () => {
  const {login} = useContext(AuthContext);
  const [userKode, setUserKode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!userKode || !password) {
      Toast.show({
        type: 'error',
        text1: 'Input Tidak Lengkap',
        text2: 'Kode user dan password harus diisi.',
      });
      return;
    }
    setIsLoading(true);
    try {
      await login(userKode, password);
      // Navigasi akan di-handle otomatis oleh App.js
    } catch (error) {
      const message = error.response?.data?.message || 'Terjadi kesalahan.';
      Toast.show({type: 'error', text1: 'Gagal Login', text2: message});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Selamat Datang</Text>
      <Text style={styles.subtitle}>Masuk untuk mulai bekerja</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Kode User"
          value={userKode}
          onChangeText={setUserKode}
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
          <Icon
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={22}
            color="#666"
            style={styles.eyeIcon}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>LOGIN</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputWrapper: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 15,
  },
  input: {height: 50, paddingHorizontal: 20, fontSize: 16, color: '#333'},
  passwordContainer: {
    height: 50,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  passwordInput: {flex: 1, fontSize: 16, color: '#333'},
  eyeIcon: {marginLeft: 10},
  button: {
    height: 50,
    backgroundColor: '#c62828',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    elevation: 3,
    marginTop: 10,
  },
  buttonText: {color: '#ffffff', fontSize: 16, fontWeight: 'bold'},
});

export default LoginScreen;
