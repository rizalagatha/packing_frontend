import 'text-encoding';
import React, {useState, useContext, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {AuthContext} from '../context/AuthContext';
import {
  getWhatsappQrApi,
  deleteWhatsappSessionApi,
  getWhatsappStatusApi,
} from '../api/ApiService';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Feather';

const LinkWhatsappScreen = () => {
  const {userToken} = useContext(AuthContext);

  const [qrCode, setQrCode] = useState('');
  const [sessionStatus, setSessionStatus] = useState('DISCONNECTED'); // Default Disconnected biar tombol muncul
  const [sessionInfo, setSessionInfo] = useState(null);

  // State Loading terpisah
  const [isChecking, setIsChecking] = useState(true); // Loading awal saat masuk layar
  const [isActionLoading, setIsActionLoading] = useState(false); // Loading saat klik tombol

  // --- 1. Cek Status Sesi ---
  const checkSession = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await getWhatsappStatusApi(userToken);
      const {status, info} = response.data.data;

      setSessionStatus(status);
      setSessionInfo(info);

      // Jika sudah connect, pastikan QR hilang
      if (status === 'CONNECTED') {
        setQrCode('');
      }
    } catch (error) {
      console.log('Check Session Error:', error);
      // Jika error (misal server mati), anggap disconnected agar tombol muncul
      setSessionStatus('DISCONNECTED');
    } finally {
      setIsChecking(false);
    }
  }, [userToken]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // --- 2. Generate QR Code ---
  const handleGetQr = async () => {
    setIsActionLoading(true);
    setQrCode('');
    try {
      const response = await getWhatsappQrApi(userToken);
      if (response.data?.data?.qr) {
        setQrCode(response.data.data.qr);
        setSessionStatus('DISCONNECTED');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Gagal',
          text2: 'QR Code kosong dari server.',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Gagal mendapatkan QR Code.',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- 3. Hapus Sesi ---
  const handleDeleteSession = async () => {
    Alert.alert(
      'Putuskan Tautan?',
      'WhatsApp bot tidak akan bisa mengirim pesan lagi.',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Putuskan',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              await deleteWhatsappSessionApi(userToken);
              setQrCode('');
              setSessionStatus('DISCONNECTED');
              setSessionInfo(null);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: 'Sesi dihapus.',
              });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Gagal menghapus sesi.',
              });
            } finally {
              setIsActionLoading(false);
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  const renderContent = () => {
    // 1. Tampilan Loading Awal (Spinner Besar di Tengah)
    if (isChecking) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#D32F2F" />
          <Text style={{marginTop: 10, color: '#666'}}>
            Memeriksa status WhatsApp...
          </Text>
        </View>
      );
    }

    // 2. Tampilan JIKA TERHUBUNG (Connected)
    if (sessionStatus === 'CONNECTED') {
      return (
        <View style={styles.connectedCard}>
          <View style={styles.iconCircle}>
            <Icon name="check" size={40} color="#4CAF50" />
          </View>
          <Text style={styles.connectedTitle}>WhatsApp Terhubung!</Text>

          {sessionInfo && (
            <View style={styles.infoContainer}>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Nama:</Text>
                <Text style={styles.value}>{sessionInfo.pushname || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Nomor:</Text>
                <Text style={styles.value}>
                  +{sessionInfo.wid?.user || '-'}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.deleteButton, {marginTop: 30, width: '100%'}]}
            onPress={handleDeleteSession}
            disabled={isActionLoading}>
            {isActionLoading ? (
              <ActivityIndicator color="#D32F2F" />
            ) : (
              <>
                <Icon
                  name="log-out"
                  size={20}
                  color="#D32F2F"
                  style={{marginRight: 8}}
                />
                <Text style={styles.deleteButtonText}>Putuskan Tautan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Tampilan JIKA BELUM TERHUBUNG (Disconnected / QR)
    return (
      <View style={styles.qrSection}>
        <Icon name="smartphone" size={60} color="#4A5568" />
        <Text style={styles.title}>Tautkan WhatsApp</Text>

        {!qrCode ? (
          <>
            <Text style={styles.instructions}>
              Klik tombol di bawah untuk mendapatkan QR Code.
            </Text>

            {/* TOMBOL DAPATKAN QR (Hanya muncul jika QR belum ada) */}
            <TouchableOpacity
              style={styles.button}
              onPress={handleGetQr}
              disabled={isActionLoading}>
              {isActionLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Icon
                    name="aperture"
                    size={20}
                    color="#FFFFFF"
                    style={{marginRight: 10}}
                  />
                  <Text style={styles.buttonText}>Dapatkan QR Code</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.qrContainer}>
            <Text style={styles.instructions}>
              Scan QR code ini menggunakan WhatsApp di HP Anda (Menu Titik 3 -
              Perangkat Tertaut).
            </Text>

            <View style={styles.qrWrapper}>
              <QRCode
                value={qrCode}
                size={220}
                backgroundColor="#FFFFFF"
                color="#000000"
                quietZone={10}
              />
            </View>
            <Text style={styles.qrText}>Menunggu scan...</Text>

            {/* Tombol Batalkan / Generate Ulang */}
            <View style={{flexDirection: 'row', gap: 20, marginTop: 20}}>
              <TouchableOpacity
                onPress={() => setQrCode('')}
                style={{padding: 10}}>
                <Text style={{color: '#D32F2F', fontWeight: 'bold'}}>
                  Batalkan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleGetQr} style={{padding: 10}}>
                <Text style={{color: '#1976D2', fontWeight: 'bold'}}>
                  Refresh QR
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isChecking} onRefresh={checkSession} />
        }>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  content: {flexGrow: 1, padding: 24, alignItems: 'center'},
  centerContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},

  // Connected Styles
  connectedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    elevation: 2,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 20,
  },
  infoContainer: {width: '100%'},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 8,
  },
  label: {fontSize: 14, color: '#757575'},
  value: {fontSize: 14, fontWeight: '600', color: '#212121'},

  // QR Styles
  qrSection: {alignItems: 'center', width: '100%', paddingTop: 20},
  title: {fontSize: 22, fontWeight: 'bold', color: '#212121', marginTop: 16},
  instructions: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#D32F2F',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    width: '100%',
  },
  buttonText: {color: '#FFFFFF', fontWeight: 'bold', fontSize: 16},

  qrContainer: {alignItems: 'center', width: '100%'},
  qrWrapper: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
  },
  qrText: {marginTop: 15, fontSize: 16, color: '#333', fontWeight: 'bold'},

  deleteButton: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {color: '#D32F2F', fontSize: 14, fontWeight: '600'},
});

export default LinkWhatsappScreen;
