import React, {useState, useContext, useRef, useEffect} from 'react';
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
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  KeyboardAvoidingView, // <--- 1. Import ini
  Platform,
  ScrollView, // <--- 2. Import ini
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import {AuthContext} from '../context/AuthContext';

const {width, height} = Dimensions.get('window');

const BouncyButton = ({onPress, disabled, isLoading, children, style}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (!disabled) {
      Animated.spring(scaleValue, {
        toValue: 0.96,
        useNativeDriver: true,
      }).start();
    }
  };

  const onPressOut = () => {
    if (!disabled) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}>
      <Animated.View
        style={[
          style,
          {transform: [{scale: scaleValue}], opacity: disabled ? 0.8 : 1},
        ]}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          children
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const LoginScreen = () => {
  const {login} = useContext(AuthContext);
  const [userKode, setUserKode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // State untuk Error Highlight (Border Merah)
  const [errorField, setErrorField] = useState(''); // 'user', 'pass', atau ''

  const appVersion = DeviceInfo.getVersion();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    setErrorField(''); // Reset error

    // Validasi Visual
    if (!userKode) {
      setErrorField('user');
      Toast.show({
        type: 'error',
        text1: 'Ops!',
        text2: 'Kode user wajib diisi.',
      });
      return;
    }
    if (!password) {
      setErrorField('pass');
      Toast.show({
        type: 'error',
        text1: 'Ops!',
        text2: 'Password wajib diisi.',
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(userKode, password);
    } catch (error) {
      // Jika error 401 (Salah password), kasih border merah di kedua field atau pass
      setErrorField('all');
      console.log(
        'Login Gagal:',
        error.response?.data?.message || error.message,
      );
      const message =
        error.response?.data?.message || 'Kode User atau Password salah.';
      Toast.show({type: 'error', text1: 'Gagal Masuk', text2: message});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Immersive Status Bar (Transparan) */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* 2. Keyboard Avoiding View (Agar form tidak tertutup keyboard) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1}}>
        <ScrollView
          contentContainerStyle={{flexGrow: 1}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* HEADER GRADIENT */}
          <View
            style={{height: height * 0.35, width: '100%', overflow: 'hidden'}}>
            <LinearGradient
              colors={['#1565C0', '#42A5F5']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.gradientHeader}>
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{translateY: slideAnim}],
                  alignItems: 'center',
                }}>
                <Image
                  source={require('../assets/logo.png')}
                  style={styles.logo}
                />
                <Text style={styles.headerTitle}>Kaosan Mobile</Text>
                <Text style={styles.headerSubtitle}>
                  Sistem Manajemen Stok & Penjualan
                </Text>
              </Animated.View>
            </LinearGradient>
          </View>

          {/* FORM CONTAINER */}
          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>Silakan Masuk</Text>

            {/* Input User */}
            <View
              style={[
                styles.inputWrapper,
                (errorField === 'user' || errorField === 'all') &&
                  styles.inputError, // Cek Error
              ]}>
              <Icon
                name="user"
                size={20}
                color={
                  errorField === 'user' || errorField === 'all'
                    ? '#D32F2F'
                    : '#78909C'
                }
                style={{marginLeft: 15}}
              />
              <TextInput
                style={styles.input}
                placeholder="Kode User"
                value={userKode}
                onChangeText={text => {
                  setUserKode(text);
                  setErrorField('');
                }}
                autoCapitalize="none"
                placeholderTextColor="#B0BEC5"
              />
            </View>

            {/* Input Password */}
            <View
              style={[
                styles.inputWrapper,
                (errorField === 'pass' || errorField === 'all') &&
                  styles.inputError, // Cek Error
              ]}>
              <Icon
                name="lock"
                size={20}
                color={
                  errorField === 'pass' || errorField === 'all'
                    ? '#D32F2F'
                    : '#78909C'
                }
                style={{marginLeft: 15}}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={text => {
                  setPassword(text);
                  setErrorField('');
                }}
                secureTextEntry={!isPasswordVisible}
                placeholderTextColor="#B0BEC5"
              />
              <TouchableOpacity
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                style={{padding: 10}}>
                <Icon
                  name={isPasswordVisible ? 'eye-off' : 'eye'}
                  size={20}
                  color="#78909C"
                />
              </TouchableOpacity>
            </View>

            {/* 3. Tombol Lupa Password */}
            <TouchableOpacity
              style={{alignSelf: 'flex-end', marginBottom: 20}}
              onPress={() =>
                Toast.show({
                  type: 'info',
                  text1: 'Info',
                  text2: 'Silakan hubungi IT/Admin untuk reset.',
                })
              }>
              <Text style={{color: '#1976D2', fontWeight: '600', fontSize: 13}}>
                Lupa Password?
              </Text>
            </TouchableOpacity>

            <View style={{marginTop: 10}}>
              <BouncyButton
                style={styles.button}
                onPress={handleLogin}
                isLoading={isLoading}
                disabled={isLoading}>
                <Text style={styles.buttonText}>MASUK</Text>
              </BouncyButton>
            </View>

            <View
              style={{marginTop: 40, alignItems: 'center', marginBottom: 20}}>
              <Text style={{color: '#CFD8DC', fontSize: 12}}>
                Versi Aplikasi {appVersion}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  gradientHeader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 30, // Tambahan padding karena translucent status bar
    paddingBottom: 40,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 0,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 5,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#37474F',
    marginBottom: 25,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    height: 55,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ECEFF1', // Border Default
  },
  // Style khusus jika Error
  inputError: {
    borderColor: '#D32F2F', // Merah
    borderWidth: 1,
    backgroundColor: '#FFEBEE', // Merah muda sangat tipis
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#37474F',
  },
  button: {
    height: 55,
    backgroundColor: '#FF7043',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: '#FF7043',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default LoginScreen;
