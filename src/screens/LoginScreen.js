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
        const currentVersionCode = parseInt(DeviceInfo.getBuildNumber(), 10); // Sesuaikan dengan version code di build.gradle

        if (serverData.versionCode > currentVersionCode) {
          Alert.alert('Update Tersedia!', serverData.releaseNotes, [
            {text: 'Nanti', style: 'cancel'},
            {
              text: 'Update',
              onPress: () => downloadAndInstallApk(serverData.apkUrl),
            },
          ]);
        }
      } catch (e) {
        console.log('Cek update gagal/offline');
      }
    };
    checkUpdate();
  }, []);

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
                  style={{maxHeight: 150}}
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
});

export default LoginScreen;
