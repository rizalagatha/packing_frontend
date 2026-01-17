import React, {useState, useEffect, useContext, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import {
  getProductByBarcodeAmbilApi,
  saveAmbilBarangApi,
} from '../api/ApiService';
import {requestAuthorization} from '../utils/AuthHelper';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const AmbilBarangScreen = ({navigation}) => {
  const {userToken, userInfo} = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthPending, setIsAuthPending] = useState(false); // State untuk overlay progress
  const [scannedBarcode, setScannedBarcode] = useState('');
  const barcodeInputRef = useRef(null);

  const [header, setHeader] = useState({
    gudangKode: userInfo.cabang || 'KDC',
    storeKode: 'K01',
    peminta: '',
    tanggal: new Date().toISOString().split('T')[0],
  });

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('Sound error:', e);
    }
  };

  // 1. Urutan Scan: Last Scanned First
  const handleBarcodeSubmit = async () => {
    if (!scannedBarcode) return;
    try {
      const res = await getProductByBarcodeAmbilApi(
        scannedBarcode,
        header.gudangKode,
        userToken,
      );
      const product = res.data; // Data dari backend sudah termasuk 'stok'

      setItems(prev => {
        const existingIndex = prev.findIndex(
          i => i.kode === product.kode && i.ukuran === product.ukuran,
        );

        if (existingIndex !== -1) {
          // Jika barang sudah ada, update jumlah dan pindahkan ke posisi paling atas
          const updatedItems = [...prev];
          const item = {
            ...updatedItems[existingIndex],
            jumlah: updatedItems[existingIndex].jumlah + 1,
          };
          updatedItems.splice(existingIndex, 1);
          return [item, ...updatedItems];
        }
        // Jika barang baru, masukkan langsung di posisi paling atas
        return [{...product, id: Date.now(), jumlah: 1}, ...prev];
      });

      setScannedBarcode('');
      playSound('success');
    } catch (e) {
      playSound('error');
      Alert.alert('Error', 'Produk tidak ditemukan.');
    } finally {
      barcodeInputRef.current?.focus();
    }
  };

  const handleDecreaseQty = id => {
    setItems(prev =>
      prev.map(i =>
        i.id === id && i.jumlah > 1 ? {...i, jumlah: i.jumlah - 1} : i,
      ),
    );
  };

  const handleSave = () => {
    if (items.length === 0)
      return Toast.show({type: 'error', text1: 'Daftar item kosong'});
    if (!header.peminta)
      return Toast.show({type: 'error', text1: 'Nama peminta wajib diisi'});

    // Cek apakah ada jumlah yang melebihi stok sebelum minta izin
    const hasOverStock = items.some(i => i.jumlah > i.stok);
    if (hasOverStock)
      return Alert.alert(
        'Peringatan',
        'Ada item yang jumlahnya melebihi stok KDC!',
      );

    const totalQty = items.reduce((sum, i) => sum + i.jumlah, 0);
    const infoText = `Ambil Barang\nPeminta: ${header.peminta}\nTotal: ${totalQty} Pcs`;

    // Aktifkan Overlay Progress
    setIsAuthPending(true);

    requestAuthorization(
      userToken,
      'Otorisasi Ambil Barang',
      'AMBIL_BARANG',
      totalQty,
      {
        transaksi: 'DRAFT',
        keteranganLengkap: infoText,
        cabang: header.storeKode,
      },
      authResult => {
        setIsAuthPending(false); // Matikan Overlay
        playSound('success');
        executeSave(authResult.approver);
      },
      () => {
        setIsAuthPending(false); // Matikan Overlay jika batal
      },
    );
  };

  const executeSave = async approver => {
    setIsLoading(true);
    try {
      await saveAmbilBarangApi({header, items, approver}, userToken);
      Toast.show({type: 'success', text1: 'Berhasil disimpan'});
      navigation.goBack();
    } catch (e) {
      Alert.alert('Gagal', e.response?.data?.message || 'Kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({item}) => {
    // 2. Indikator Stok: Merah jika jumlah > stok
    const isOverStock = item.jumlah > item.stok;

    return (
      <View style={[styles.itemCard, isOverStock && styles.cardError]}>
        <View style={{flex: 1}}>
          <Text style={styles.itemName}>{item.nama}</Text>
          <Text style={styles.itemSub}>
            {item.kode} | Size: {item.ukuran}
          </Text>
          <Text
            style={[
              styles.stockIndicator,
              isOverStock && {color: '#D32F2F', fontWeight: 'bold'},
            ]}>
            Stok KDC: {item.stok} {isOverStock ? '(Tidak Cukup)' : ''}
          </Text>
        </View>

        <View style={styles.qtyActionContainer}>
          {/* Tombol Kurang untuk Koreksi */}
          <TouchableOpacity
            onPress={() => handleDecreaseQty(item.id)}
            style={styles.minusBtn}>
            <Icon name="minus-circle" size={22} color="#D32F2F" />
          </TouchableOpacity>

          <View style={styles.qtyBox}>
            <Text style={styles.qtyText}>{item.jumlah}</Text>
          </View>

          <TouchableOpacity
            onPress={() => setItems(items.filter(i => i.id !== item.id))}
            style={{marginLeft: 15}}>
            <Icon name="trash-2" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 3. Overlay Progres Otorisasi */}
      <Modal visible={isAuthPending} transparent animationType="fade">
        <View style={styles.overlayContainer}>
          <View style={styles.progressBox}>
            <ActivityIndicator size="large" color="#1565C0" />
            <Text style={styles.progressTitle}>Menunggu Persetujuan</Text>
            <Text style={styles.progressSub}>
              Sedang meminta izin ke Store {header.storeKode}...
            </Text>
            <TouchableOpacity
              style={styles.cancelAuthBtn}
              onPress={() => setIsAuthPending(false)}>
              <Text style={styles.cancelAuthText}>BATALKAN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.headerForm}>
        <Text style={styles.label}>Nama Peminta</Text>
        <TextInput
          style={styles.input}
          placeholder="Ketik nama karyawan..."
          value={header.peminta}
          onChangeText={val => setHeader({...header, peminta: val})}
        />
        <View style={styles.scannerBox}>
          <Icon name="maximize" size={20} color="#1565C0" />
          <TextInput
            ref={barcodeInputRef}
            style={styles.barcodeInput}
            placeholder="Scan Barcode di sini..."
            value={scannedBarcode}
            onChangeText={setScannedBarcode}
            onSubmitEditing={handleBarcodeSubmit}
            showSoftInputOnFocus={false}
            autoFocus={true}
          />
        </View>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{padding: 15}}
      />

      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>TOTAL QTY</Text>
          <Text style={styles.totalValue}>
            {items.reduce((sum, i) => sum + i.jumlah, 0)}
          </Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>SIMPAN & MINTA IZIN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  headerForm: {
    backgroundColor: '#fff',
    padding: 20,
    elevation: 3,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  label: {fontSize: 12, color: '#999', marginBottom: 5, fontWeight: 'bold'},
  input: {
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 45,
    marginBottom: 15,
    color: '#333',
  },
  scannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  barcodeInput: {flex: 1, marginLeft: 10, fontSize: 14, color: '#1565C0'},

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    borderLeftWidth: 5,
    borderLeftColor: '#1565C0',
  },
  cardError: {borderLeftColor: '#D32F2F', backgroundColor: '#FFEBEE'},
  itemName: {fontSize: 14, fontWeight: 'bold', color: '#333'},
  itemSub: {fontSize: 11, color: '#777', marginTop: 2},
  stockIndicator: {fontSize: 11, color: '#1565C0', marginTop: 5},

  qtyActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 5,
  },
  minusBtn: {
    padding: 5,
  },
  qtyBox: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#1565C0',
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1565C0',
  },

  footer: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  totalLabel: {fontSize: 10, color: '#999', fontWeight: 'bold'},
  totalValue: {fontSize: 24, fontWeight: 'bold', color: '#333'},
  saveBtn: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {color: '#fff', fontWeight: 'bold', fontSize: 14},

  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#333',
  },
  progressSub: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  cancelAuthBtn: {marginTop: 20, padding: 10},
  cancelAuthText: {color: '#D32F2F', fontWeight: 'bold', fontSize: 12},
});

export default AmbilBarangScreen;
