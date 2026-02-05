import React, {useState, useEffect, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {downloadMasterBazarApi, uploadBazarSalesApi} from '../api/ApiService';
import * as DB from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BazarSyncScreen = () => {
  const {userToken, userInfo} = useContext(AuthContext);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState(''); // 'uploading' | 'downloading'
  const [progress, setProgress] = useState(0);
  const [itemCount, setItemCount] = useState({
    prod: 0,
    cust: 0,
    pending: 0,
    rek: 0,
  });
  const [lastSync, setLastSync] = useState('-');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const time = await AsyncStorage.getItem('@last_sync_bazar');
    const counts = await DB.getBazarCounts(); // Mengambil {products, customers, accounts}
    const pendingSales = await DB.getPendingBazarSales();

    if (time) setLastSync(time);

    setItemCount({
      prod: counts.products,
      cust: counts.customers,
      pending: pendingSales.length,
      rek: counts.accounts, // <--- TAMBAHKAN BARIS INI
    });
  };

  // --- FUNGSI 1: UPLOAD DATA PENJUALAN SAJA ---
  const handleUploadOnly = async () => {
    const pendingData = await DB.getPendingBazarSales();

    if (pendingData.length === 0) {
      return Alert.alert('Info', 'Semua nota sudah terkirim ke server.');
    }

    setIsSyncing(true);
    setSyncStage('uploading');
    setProgress(0);

    try {
      const resUpload = await uploadBazarSalesApi(
        {sales: pendingData, targetCabang: userInfo.cabang},
        userToken,
      );

      if (resUpload.data.success) {
        for (const nota of pendingData) {
          await DB.markBazarSalesUploaded(nota.header.so_nomor);
        }
        await loadStatus();
        Toast.show({
          type: 'success',
          text1: 'Upload Berhasil',
          text2: `${pendingData.length} nota telah sinkron ke pusat.`,
        });
      }
    } catch (error) {
      Alert.alert(
        'Gagal Upload',
        error.message || 'Cek koneksi internet anda.',
      );
    } finally {
      setIsSyncing(false);
      setSyncStage('');
    }
  };

  // --- FUNGSI 2: DOWNLOAD MASTER DATA SAJA ---
  const handleDownloadOnly = () => {
    Alert.alert(
      'Konfirmasi Download',
      'Data master lokal akan dihapus dan diperbarui dengan data server. Lanjutkan?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Download',
          onPress: async () => {
            setIsSyncing(true);
            setSyncStage('downloading');
            setProgress(0);

            try {
              const resDownload = await downloadMasterBazarApi(
                userToken,
                userInfo.cabang,
              );
              if (!resDownload.data.success)
                throw new Error('Gagal ambil data master');

              const {products, customers, rekening} = resDownload.data.data;

              setSyncStage('saving_prod');
              await DB.insertMasterBarangBazar(products, (current, total) => {
                setProgress(Math.round((current / total) * 100));
              });

              setSyncStage('saving_cust');
              await DB.insertMasterCustomerBazar(customers);

              setSyncStage('saving_rek');
              if (rekening && rekening.length > 0) {
                await DB.insertMasterRekening(rekening);
              }

              const now = new Date().toLocaleString('id-ID');
              await AsyncStorage.setItem('@last_sync_bazar', now);
              await loadStatus();

              Toast.show({
                type: 'success',
                text1: 'Download Berhasil',
                text2: 'Master produk & customer telah diperbarui.',
              });
            } catch (error) {
              Alert.alert('Gagal Download', error.message);
            } finally {
              setIsSyncing(false);
              setSyncStage('');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{padding: 20}}>
        <View style={styles.headerCard}>
          <Icon name="refresh-cw" size={40} color="#E91E63" />
          <Text style={styles.headerTitle}>Manajemen Data Bazar</Text>
          <Text style={styles.headerSub}>
            Cabang: {userInfo?.nama_cabang || userInfo?.cabang}
          </Text>
        </View>

        {/* STATS AREA */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Update Terakhir</Text>
            <Text style={styles.value}>{lastSync}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Nota Pending (Lokal)</Text>
            <Text
              style={[
                styles.value,
                itemCount.pending > 0 && {color: '#E91E63'},
              ]}>
              {itemCount.pending} Nota
            </Text>
          </View>

          {/* TAMBAHAN STATS REKENING */}
          <View style={[styles.row, {marginTop: 15}]}>
            <Text style={styles.label}>Master Rekening/EDC</Text>
            <Text style={styles.value}>{itemCount.rek || 0} Akun</Text>
          </View>
        </View>

        {/* PROGRESS BAR */}
        {isSyncing &&
          (syncStage === 'downloading' || syncStage.includes('saving')) && (
            <View style={styles.progressContainer}>
              <Text style={styles.stageText}>
                {syncStage === 'downloading' && '☁️ Mengunduh data master...'}
                {syncStage === 'saving_prod' &&
                  `📦 Menyimpan Produk (${progress}%)`}
                {syncStage === 'saving_cust' && '👥 Menyimpan data Customer...'}
                {syncStage === 'saving_rek' &&
                  '💳 Menyimpan data Rekening/EDC...'}
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFill, {width: `${progress}%`}]}
                />
              </View>
            </View>
          )}

        <View style={styles.actionContainer}>
          {/* TOMBOL UPLOAD */}
          <TouchableOpacity
            style={[
              styles.btnAction,
              styles.btnUpload,
              isSyncing && styles.btnDisabled,
            ]}
            onPress={handleUploadOnly}
            disabled={isSyncing}>
            {isSyncing && syncStage === 'uploading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon
                  name="upload-cloud"
                  size={20}
                  color="#fff"
                  style={{marginRight: 10}}
                />
                <View>
                  <Text style={styles.btnText}>UPLOAD PENJUALAN</Text>
                  <Text style={styles.btnSubText}>
                    Kirim {itemCount.pending} nota ke pusat
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* TOMBOL DOWNLOAD */}
          <TouchableOpacity
            style={[
              styles.btnAction,
              styles.btnDownload,
              isSyncing && styles.btnDisabled,
            ]}
            onPress={handleDownloadOnly}
            disabled={isSyncing}>
            {isSyncing &&
            (syncStage === 'downloading' || syncStage.includes('saving')) ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon
                  name="download-cloud"
                  size={20}
                  color="#fff"
                  style={{marginRight: 10}}
                />
                <View>
                  <Text style={styles.btnText}>DOWNLOAD MASTER</Text>
                  <Text style={styles.btnSubText}>
                    Update Produk, Customer, & EDC
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.infoFooter}>
          *Gunakan Download Master jika ada perubahan harga, barang baru, atau
          perubahan mesin EDC dari kantor pusat.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA'},
  headerCard: {alignItems: 'center', marginBottom: 25, marginTop: 10},
  headerTitle: {fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 10},
  headerSub: {fontSize: 13, color: '#888', marginTop: 5},
  card: {backgroundColor: '#fff', borderRadius: 12, padding: 18, elevation: 2},
  divider: {height: 1, backgroundColor: '#F0F0F0', marginVertical: 12},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {fontSize: 13, color: '#666'},
  value: {fontSize: 13, fontWeight: 'bold', color: '#333'},

  actionContainer: {marginTop: 30, gap: 15},
  btnAction: {
    height: 65,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  btnUpload: {backgroundColor: '#4CAF50'}, // Hijau untuk Upload
  btnDownload: {backgroundColor: '#2196F3'}, // Biru untuk Download
  btnDisabled: {backgroundColor: '#BDBDBD'},
  btnText: {color: '#fff', fontWeight: 'bold', fontSize: 14},
  btnSubText: {color: 'rgba(255,255,255,0.8)', fontSize: 11},

  progressContainer: {marginTop: 20, alignItems: 'center'},
  stageText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#E91E63',
    marginBottom: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {height: '100%', backgroundColor: '#E91E63'},

  infoFooter: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 25,
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
});

export default BazarSyncScreen;
