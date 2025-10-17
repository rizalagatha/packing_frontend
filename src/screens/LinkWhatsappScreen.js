import 'text-encoding';
import React, {useState, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {AuthContext} from '../context/AuthContext';
import {getWhatsappQrApi, deleteWhatsappSessionApi} from '../api/ApiService';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Feather';

const LinkWhatsappScreen = () => {
  const {userToken} = useContext(AuthContext);
  const [qrCode, setQrCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetQr = async () => {
    setIsLoading(true);
    setQrCode('');
    try {
      const response = await getWhatsappQrApi(userToken);
      setQrCode(response.data.data.qr);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Gagal mendapatkan QR Code dari server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    Alert.alert(
      'Hapus Sesi?',
      'Anda yakin ingin memutuskan tautan WhatsApp? Anda perlu scan ulang QR Code untuk menghubungkan kembali.',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Hapus',
          onPress: async () => {
            try {
              await deleteWhatsappSessionApi(userToken);
              setQrCode(''); // Kosongkan QR Code di tampilan
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: 'Sesi WhatsApp berhasil dihapus.',
              });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Gagal menghapus sesi.',
              });
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Icon name="smartphone" size={60} color="#4A5568" />
          <Text style={styles.title}>Tautkan WhatsApp</Text>
          <Text style={styles.instructions}>
            Klik tombol di bawah untuk mendapatkan QR Code. Lalu, scan
            menggunakan aplikasi WhatsApp di HP Anda (Setelan - Perangkat
            Tertaut).
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleGetQr}
            disabled={isLoading}>
            <Icon
              name="aperture"
              size={20}
              color="#FFFFFF"
              style={{marginRight: 10}}
            />
            <Text style={styles.buttonText}>Dapatkan QR Code</Text>
          </TouchableOpacity>

          {isLoading && (
            <ActivityIndicator
              size="large"
              style={{marginTop: 30}}
              color="#D32F2F"
            />
          )}

          {qrCode ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrCode}
                  size={250}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                  quietZone={10}
                  enableLinearGradient={false}
                />
              </View>
              <Text style={styles.qrText}>Scan saya untuk menghubungkan!</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteSession}>
          <Text style={styles.deleteButtonText}>Putuskan Tautan WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginTop: 16,
  },
  instructions: {
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  qrContainer: {
    marginTop: 30,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
  },
  qrWrapper: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  qrText: {
    marginTop: 15,
    fontSize: 14,
    color: '#616161',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#D32F2F',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LinkWhatsappScreen;
