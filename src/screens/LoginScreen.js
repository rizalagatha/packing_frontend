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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import {AuthContext} from '../context/AuthContext';
import axios from 'axios';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import Geolocation from 'react-native-geolocation-service';
import {PermissionsAndroid} from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';
import {enrollDeviceApi, requestChallengeApi} from '../api/ApiService'; // Pastikan path sesuai

const {height} = Dimensions.get('window');

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
          styles.bouncyButton,
          disabled && styles.buttonDisabled,
          {
            transform: [{scale: scaleValue}],
          },
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
  const {login, loginDevice} = useContext(AuthContext);
  const [userKode, setUserKode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState('Menyiapkan unduhan...');
  const [updateData, setUpdateData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

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

  // 1. FUNGSI DOWNLOAD & INSTALL (ANTI PARSE ERROR & PAKE PROGRESS BAR)
  const downloadAndInstallApk = async apkUrl => {
    // Tampilkan Modal Progress
    setIsUpdateModalVisible(true);
    setIsDownloading(true);
    setUpdateProgress(0);
    setUpdateMessage('Mengunduh pembaruan...');

    // FIX PARSE ERROR 1: Gunakan DocumentDirectory (Lebih aman dari Cache)
    // FIX PARSE ERROR 2: Gunakan Date.now() agar nama file selalu baru dan tidak numpuk
    const localFile = `${
      RNFS.DocumentDirectoryPath
    }/kaosan-update-${Date.now()}.apk`;

    const options = {
      fromUrl: apkUrl,
      toFile: localFile,
      background: true,
      progressDivider: 2, // Biar HP gak ngelag, update UI setiap kelipatan 2%
      begin: res => {
        console.log('Mulai download:', res.contentLength);
      },
      progress: res => {
        const progress = (res.bytesWritten / res.contentLength) * 100;
        setUpdateProgress(progress);
      },
    };

    try {
      // Mulai proses download
      const ret = RNFS.downloadFile(options);

      // FIX PARSE ERROR 3: WAJIB ditunggu sampai benar-benar 100%
      await ret.promise;

      setUpdateMessage('Menyiapkan instalasi...');
      setUpdateProgress(100);

      // FIX PARSE ERROR 4: Beri jeda 1 detik agar Android selesai merakit file di harddisk
      setTimeout(() => {
        if (Platform.OS === 'android') {
          FileViewer.open(localFile, {
            showOpenWithDialog: false,
            mimeType: 'application/vnd.android.package-archive',
          })
            .then(() => {
              console.log('Layar instalasi berhasil terbuka');
              setUpdateMessage('Silakan selesaikan instalasi.');
            })
            .catch(err => {
              console.log('Gagal buka file instalasi:', err);
              setIsUpdateModalVisible(false);
              setIsDownloading(false);
              Alert.alert(
                'Error',
                'Gagal memicu proses instalasi Android. Pastikan izin penyimpanan aktif.',
              );
            });
        }
      }, 1000);
    } catch (err) {
      console.log('Download error:', err);
      setIsUpdateModalVisible(false);
      setIsDownloading(false);
      Alert.alert(
        'Gagal',
        'Terjadi kesalahan saat mengunduh update dari server.',
      );
    }
  };

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const response = await axios.get(
          'http://103.94.238.252:3000/api/app/version',
        );
        const serverData = response.data.data;
        const currentVersionCode = parseInt(DeviceInfo.getBuildNumber(), 10);

        if (serverData.versionCode > currentVersionCode) {
          // --- PERBAIKAN DI SINI ---
          // Simpan data dari server ke state, lalu buka modal kustom kita
          setUpdateData(serverData);
          setIsUpdateModalVisible(true);
          // -------------------------
        }
      } catch (e) {
        console.log('Cek update gagal/offline');
      }
    };
    checkUpdate();
  }, []);

  // Fungsi Helper Meminta Izin GPS
  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setErrorField('');

    if (!userKode) {
      setErrorField('user');
      return Toast.show({
        type: 'error',
        text1: 'Ops!',
        text2: 'Kode user wajib diisi.',
      });
    }
    if (!password) {
      setErrorField('pass');
      return Toast.show({
        type: 'error',
        text1: 'Ops!',
        text2: 'Password wajib diisi.',
      });
    }

    setIsLoading(true);

    // 1. BACA LOKASI GPS
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setIsLoading(false);
      return Toast.show({
        type: 'error',
        text1: 'Akses Ditolak',
        text2: 'Izinkan akses GPS untuk login.',
      });
    }

    Geolocation.getCurrentPosition(
      async position => {
        if (position.mocked) {
          setIsLoading(false);
          return Alert.alert(
            'Keamanan',
            'Matikan aplikasi Fake GPS untuk login.',
          );
        }

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const bypassUsers = ['HARIS', 'SETYO'];
          if (bypassUsers.includes(userKode.toUpperCase())) {
            // Tembak fungsi login standar (API /auth/login)
            await login(userKode, password, lat, lon);
            return; // Hentikan eksekusi di sini agar tidak memanggil biometrik
          }

          const rnBiometrics = new ReactNativeBiometrics();
          const {keysExist} = await rnBiometrics.biometricKeysExist();

          // Deteksi Info HP (Menggunakan Promise di versi terbaru DeviceInfo)
          const deviceId = await DeviceInfo.getUniqueId();
          const deviceName = await DeviceInfo.getDeviceName();

          // ==========================================
          // SKENARIO A: PERANGKAT BELUM PUNYA KUNCI (ENROLLMENT)
          // ==========================================
          if (!keysExist) {
            // Generate Key di dalam Hardware Keystore
            const {publicKey} = await rnBiometrics.createKeys();

            // Tembak API Pendaftaran
            await enrollDeviceApi(
              userKode,
              password,
              deviceId,
              publicKey,
              deviceName,
            );

            Toast.show({
              type: 'success',
              text1: 'Pendaftaran Berhasil',
              text2: 'Perangkat sedang menunggu persetujuan Manager Pusat.',
            });
          }
          // ==========================================
          // SKENARIO B: PERANGKAT SUDAH PUNYA KUNCI (LOGIN)
          // ==========================================
          else {
            // 1. Minta string acak (Challenge) dari Backend
            const challengeRes = await requestChallengeApi(userKode, deviceId);
            const challenge = challengeRes.data.challenge;

            // 2. Minta Kasir tempel Sidik Jari untuk menandatangani Challenge
            const {success, signature} = await rnBiometrics.createSignature({
              promptMessage: 'Verifikasi Keamanan Perangkat',
              payload: challenge,
            });

            if (success) {
              // 3. Tembak API Login dengan Signature & GPS (Sertakan password!)
              await loginDevice(
                userKode,
                password,
                deviceId,
                signature,
                lat,
                lon,
              );
            } else {
              Toast.show({
                type: 'error',
                text1: 'Batal',
                text2: 'Verifikasi dibatalkan.',
              });
            }
          }
        } catch (error) {
          setErrorField('all');
          const msg =
            error.response?.data?.message ||
            error.message ||
            'Koneksi ke server gagal.';

          // ==========================================
          // PENANGANAN JIKA KUNCI HANGUS ATAU DIHAPUS DARI DATABASE
          // ==========================================
          if (
            msg.includes('permanently invalidated') ||
            msg.includes('belum terdaftar')
          ) {
            const rnBiometrics = new ReactNativeBiometrics();
            // Hapus sisa kunci lama di HP agar bisa daftar ulang
            await rnBiometrics.deleteKeys();

            Toast.show({
              type: 'info',
              text1: 'Sinkronisasi Perangkat',
              text2:
                'Sistem di-reset. Silakan tekan MASUK sekali lagi untuk mendaftar.',
            });
          } else {
            // Error umum (password salah, gps jauh, dll)
            Toast.show({type: 'error', text1: 'Akses Ditolak', text2: msg});
          }
        } finally {
          setIsLoading(false);
        }
      },
      error => {
        setIsLoading(false);
        Alert.alert(
          'Error GPS',
          'Gagal mendapatkan lokasi. Pastikan sinyal GPS kuat.',
        );
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Immersive Status Bar (Transparan) */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* --- MODAL PROGRESS UPDATE BARU --- */}
      <Modal
        visible={isUpdateModalVisible}
        transparent={true}
        animationType="fade">
        <View style={styles.modalOverlayUpdate}>
          <View style={styles.modalContentUpdate}>
            <View style={styles.iconUpdateBg}>
              <Icon name="download-cloud" size={36} color="#fff" />
            </View>
            <Text style={styles.updateTitle}>Pembaruan Tersedia!</Text>

            {/* Tampilan Release Notes sbg List */}
            {!isDownloading && updateData && (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesHeader}>
                  Yang Baru di Versi Ini:
                </Text>
                <ScrollView
                  style={styles.releaseNotesScroll}
                  showsVerticalScrollIndicator={false}>
                  {Array.isArray(updateData.releaseNotes) ? (
                    updateData.releaseNotes.map((note, index) => (
                      <View key={index} style={styles.noteItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.noteText}>{note}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noteText}>
                      {updateData.releaseNotes}
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            {isDownloading ? (
              <>
                <Text style={styles.updateDesc}>{updateMessage}</Text>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {width: `${updateProgress}%`},
                    ]}
                  />
                </View>
                <View style={styles.progressTextRow}>
                  <Text style={styles.progressTextL}>
                    {Math.round(updateProgress)}%
                  </Text>
                  <Text style={styles.progressTextR}>
                    Jangan tutup aplikasi
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.updateActions}>
                <TouchableOpacity
                  style={styles.btnUpdateCancel}
                  onPress={() => setIsUpdateModalVisible(false)}>
                  <Text style={styles.btnUpdateCancelText}>Nanti Saja</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnUpdateConfirm}
                  onPress={() => downloadAndInstallApk(updateData?.apkUrl)}>
                  <Text style={styles.btnUpdateConfirmText}>
                    Update Sekarang
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 2. Keyboard Avoiding View (Agar form tidak tertutup keyboard) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}>
        <ScrollView
          contentContainerStyle={styles.flexGrow1}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* HEADER GRADIENT */}
          <View
            style={[
              styles.headerContainer,
              {
                height: height * 0.35,
              },
            ]}>
            <LinearGradient
              colors={['#1565C0', '#42A5F5']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.gradientHeader}>
              <Animated.View
                style={[
                  styles.animatedHeader,
                  {
                    opacity: fadeAnim,
                    transform: [{translateY: slideAnim}],
                  },
                ]}>
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
                style={styles.iconMargin}
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
                style={styles.iconMargin}
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
                style={styles.iconButton}>
                <Icon
                  name={isPasswordVisible ? 'eye-off' : 'eye'}
                  size={20}
                  color="#78909C"
                />
              </TouchableOpacity>
            </View>

            {/* 3. Tombol Lupa Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() =>
                Toast.show({
                  type: 'info',
                  text1: 'Info',
                  text2: 'Silakan hubungi IT/Admin untuk reset.',
                })
              }>
              <Text style={styles.forgotPasswordText}>Lupa Password?</Text>
            </TouchableOpacity>

            <View style={styles.loginButtonWrapper}>
              <BouncyButton
                style={styles.button}
                onPress={handleLogin}
                isLoading={isLoading}
                disabled={isLoading}>
                <Text style={styles.buttonText}>MASUK</Text>
              </BouncyButton>
            </View>

            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>
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

  // --- STYLE MODAL UPDATE ---
  modalOverlayUpdate: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContentUpdate: {
    backgroundColor: '#fff',
    width: '100%',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 10,
  },
  iconUpdateBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  updateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  updateDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  progressTextL: {fontSize: 12, fontWeight: 'bold', color: '#1976D2'},
  progressTextR: {fontSize: 11, color: '#999', fontStyle: 'italic'},

  // Style Release Notes
  releaseNotesContainer: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  releaseNotesHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noteItem: {flexDirection: 'row', marginBottom: 6},
  bullet: {fontSize: 16, color: '#1976D2', marginRight: 6, lineHeight: 20},
  noteText: {flex: 1, fontSize: 13, color: '#555', lineHeight: 18},

  // Tombol Update
  updateActions: {flexDirection: 'row', width: '100%', gap: 10, marginTop: 10},
  btnUpdateCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
  },
  btnUpdateCancelText: {color: '#666', fontWeight: 'bold'},
  btnUpdateConfirm: {
    flex: 1.5,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#1976D2',
  },
  btnUpdateConfirmText: {color: '#FFF', fontWeight: 'bold'},
  bouncyButton: {
    opacity: 1,
  },

  buttonDisabled: {
    opacity: 0.8,
  },

  releaseNotesScroll: {
    maxHeight: 150,
  },

  flex1: {
    flex: 1,
  },

  flexGrow1: {
    flexGrow: 1,
  },

  headerContainer: {
    width: '100%',
    overflow: 'hidden',
  },

  animatedHeader: {
    alignItems: 'center',
  },

  iconMargin: {
    marginLeft: 15,
  },

  iconButton: {
    padding: 10,
  },

  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },

  forgotPasswordText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 13,
  },

  loginButtonWrapper: {
    marginTop: 10,
  },

  versionContainer: {
    marginTop: 40,
    alignItems: 'center',
    marginBottom: 20,
  },

  versionText: {
    color: '#CFD8DC',
    fontSize: 12,
  },
});

export default LoginScreen;
