import React, {useState, useEffect, useContext, useRef, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Vibration,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import {getSoDetailMobileApi, scanAutoMutasiApi} from '../api/ApiService';

const SoScanScreen = ({route, navigation}) => {
  const {nomor_so} = route.params;
  const {userToken} = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false); // Mencegah double trigger
  const [barcodeInput, setBarcodeInput] = useState('');

  const scannerRef = useRef(null);

  // --- FETCH DETAIL SO ---
  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      const response = await getSoDetailMobileApi(nomor_so, userToken);
      if (response.data.success) {
        setItems(response.data.data.items || []);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Tidak dapat memuat detail pesanan.',
      });
    } finally {
      setIsLoading(false);
      // Otomatis fokus ke input setelah loading selesai
      setTimeout(() => {
        scannerRef.current?.focus();
      }, 500);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, []);

  // --- HITUNG PROGRESS ---
  const progress = useMemo(() => {
    let totalQty = 0;
    let totalScanned = 0;
    items.forEach(item => {
      totalQty += Number(item.sod_jumlah || 0);
      totalScanned += Number(item.sod_scanned || 0);
    });
    const isComplete = totalQty > 0 && totalScanned >= totalQty;
    return {totalQty, totalScanned, isComplete};
  }, [items]);

  // --- LOGIKA SCAN & AUTO MUTASI ---
  const handleBarcodeSubmit = async () => {
    const scannedCode = barcodeInput.trim();
    if (!scannedCode) return;

    // Bersihkan input secepatnya agar siap untuk scan berikutnya
    setBarcodeInput('');

    if (isScanning) return; // Cegah scan bertumpuk

    // 1. Cari barang berdasarkan barcode
    const matchingItems = items.filter(
      i => i.barcode === scannedCode && i.sod_kode,
    );

    if (matchingItems.length === 0) {
      Vibration.vibrate([0, 500, 200, 500]); // Getar error
      Toast.show({
        type: 'error',
        text1: 'Tidak Ditemukan',
        text2: 'Barang tidak ada di Surat Pesanan ini!',
      });
      refocusScanner();
      return;
    }

    // 2. Prioritaskan item yang qty scanned-nya MASIH KURANG dari qty pesanan
    let itemToProcess = matchingItems.find(
      i => Number(i.sod_scanned) < Number(i.sod_jumlah),
    );

    if (!itemToProcess) {
      Vibration.vibrate(300); // Getar pendek
      Toast.show({
        type: 'info',
        text1: 'Sudah Lengkap',
        text2: 'Barang ini sudah terpenuhi jumlahnya.',
      });
      refocusScanner();
      return;
    }

    // 3. Tembak API Auto Mutasi
    setIsScanning(true);
    try {
      const payload = {
        nomor_so: nomor_so,
        kode_barang: itemToProcess.sod_kode,
        ukuran: itemToProcess.sod_ukuran,
        qty: 1,
      };

      const response = await scanAutoMutasiApi(payload, userToken);

      if (response.data.success) {
        // Update state lokal agar layar langsung berubah tanpa fetch ulang
        setItems(prevItems =>
          prevItems.map(item => {
            if (
              item.sod_kode === itemToProcess.sod_kode &&
              item.sod_ukuran === itemToProcess.sod_ukuran
            ) {
              return {...item, sod_scanned: Number(item.sod_scanned) + 1};
            }
            return item;
          }),
        );

        Vibration.vibrate(100); // Getar sukses
        Toast.show({
          type: 'success',
          text1: 'Mutasi Berhasil',
          text2: `${itemToProcess.nama_barang} | Uk: ${itemToProcess.sod_ukuran}`,
        });
      }
    } catch (error) {
      Vibration.vibrate([0, 300, 100, 300]); // Getar error
      const msg =
        error.response?.data?.message || 'Gagal menyimpan mutasi ke server.';
      Alert.alert('Gagal Mutasi', msg);
    } finally {
      setIsScanning(false);
      refocusScanner();
    }
  };

  const refocusScanner = () => {
    // Memaksa fokus kembali ke input box setelah submit
    setTimeout(() => {
      scannerRef.current?.focus();
    }, 100);
  };

  // --- RENDER ITEM LIST ---
  const renderItem = ({item}) => {
    const qtyTarget = Number(item.sod_jumlah);
    const qtyScanned = Number(item.sod_scanned);
    const isComplete = qtyScanned >= qtyTarget;

    return (
      <View style={[styles.card, isComplete && styles.cardComplete]}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemName}>{item.nama_barang}</Text>
          <View
            style={[
              styles.badge,
              isComplete ? styles.badgeComplete : styles.badgePending,
            ]}>
            <Text
              style={[
                styles.badgeText,
                isComplete ? {color: '#2E7D32'} : {color: '#E65100'},
              ]}>
              {item.sod_ukuran}
            </Text>
          </View>
        </View>

        <Text style={styles.barcodeText}>
          {item.barcode || 'Tidak ada barcode'}
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.targetText}>Order: {qtyTarget}</Text>
          <View style={styles.scannedContainer}>
            <Text
              style={[styles.scannedText, isComplete && {color: '#2E7D32'}]}>
              Ready: {qtyScanned}
            </Text>
            {isComplete && (
              <Icon
                name="check-circle"
                size={16}
                color="#2E7D32"
                style={{marginLeft: 5}}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER INFO */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.headerLabel}>Nomor SO</Text>
          <Text style={styles.headerValue}>{nomor_so}</Text>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={styles.headerLabel}>Progress</Text>
          <Text
            style={[
              styles.headerValue,
              progress.isComplete && {color: '#4CAF50'},
            ]}>
            {progress.totalScanned} / {progress.totalQty}
          </Text>
        </View>
      </View>

      {/* INPUT SCANNER */}
      <View style={styles.scanWrapper}>
        <View style={styles.scanInputContainer}>
          <Icon
            name="maximize"
            size={20}
            color="#1976D2"
            style={{marginRight: 10}}
          />
          <TextInput
            ref={scannerRef}
            style={styles.scanInput}
            placeholder="Scan barcode di sini..."
            value={barcodeInput}
            onChangeText={setBarcodeInput}
            onSubmitEditing={handleBarcodeSubmit}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            showSoftInputOnFocus={true} // Set false jika tidak ingin keyboard HP muncul saat tap
            editable={!isScanning}
          />
          {isScanning && <ActivityIndicator size="small" color="#1976D2" />}
        </View>
      </View>

      {/* LIST BARANG */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => `${item.sod_kode}-${item.sod_ukuran}`}
          contentContainerStyle={{padding: 10, paddingBottom: 20}}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Tidak ada detail barang pada SO ini.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},

  // Header
  headerContainer: {
    backgroundColor: '#1976D2',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  headerLabel: {color: '#BBDEFB', fontSize: 12, marginBottom: 2},
  headerValue: {color: '#FFF', fontSize: 16, fontWeight: 'bold'},

  // Scanner Input
  scanWrapper: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  scanInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#1976D2',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
  },
  scanInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },

  // Card List
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E0E0E0',
    elevation: 1,
  },
  cardComplete: {
    backgroundColor: '#F1F8E9', // Hijau sangat pudar
    borderLeftColor: '#4CAF50', // Hijau terang
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgePending: {backgroundColor: '#FFF3E0', borderColor: '#FFE0B2'},
  badgeComplete: {backgroundColor: '#E8F5E9', borderColor: '#C8E6C9'},
  badgeText: {fontSize: 11, fontWeight: 'bold'},

  barcodeText: {fontSize: 11, color: '#757575', marginBottom: 8},

  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
  },
  targetText: {fontSize: 13, color: '#616161', fontWeight: '500'},
  scannedContainer: {flexDirection: 'row', alignItems: 'center'},
  scannedText: {fontSize: 14, color: '#E65100', fontWeight: 'bold'},

  centerContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyText: {textAlign: 'center', marginTop: 40, color: '#999', fontSize: 14},
});

export default SoScanScreen;
