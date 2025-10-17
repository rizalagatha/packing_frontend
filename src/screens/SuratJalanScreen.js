import React, {
  useState,
  useContext,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../context/AuthContext';
// Kita akan butuh API baru nanti, untuk sementara kita siapkan
import {
  getItemsFromPackingApi,
  saveSuratJalanApi,
  searchStoresApi,
  validateBarcodeApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SearchModal from '../components/SearchModal';
import SoundPlayer from 'react-native-sound-player';

const SuratJalanScreen = ({navigation}) => {
  const {userInfo, userToken} = useContext(AuthContext);

  const scannerInputRef = useRef(null);

  // State untuk data form
  const [store, setStore] = useState(null); // Akan berisi { kode: 'K01', nama: 'STORE 01' }
  const [keterangan, setKeterangan] = useState('');
  const [scannedPackNomor, setScannedPackNomor] = useState('');
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState('packing');
  const [scannedPacks, setScannedPacks] = useState(new Set()); // Untuk mencegah scan packing ganda
  const [isStoreModalVisible, setStoreModalVisible] = useState(false);

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log(`Tidak bisa memutar suara`, e);
    }
  };

  const handleReset = useCallback(() => {
    Alert.alert(
      'Kosongkan Form?',
      'Anda yakin ingin menghapus semua data di halaman ini?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Kosongkan',
          onPress: () => {
            setItems([]);
            setStore(null);
            setKeterangan('');
            setScannedPacks(new Set());
            setScannedValue('');
          },
          style: 'destructive',
        },
      ],
    );
  }, []);

  // --- Menambahkan Tombol Reset di Header ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleReset} style={{marginRight: 15}}>
          <Icon name="rotate-ccw" size={24} color="#D32F2F" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleReset]);

  const handleChangeMode = newMode => {
    if (scanMode === newMode) return; // Tidak melakukan apa-apa jika modenya sama

    if (items.length > 0) {
      Alert.alert(
        'Ganti Mode Scan?',
        'Mengganti mode akan mengosongkan daftar item yang sudah ada. Lanjutkan?',
        [
          {text: 'Batal', style: 'cancel'},
          {
            text: 'Ya, Lanjutkan',
            onPress: () => {
              setItems([]);
              setScannedPacks(new Set());
              setScanMode(newMode);
            },
          },
        ],
      );
    } else {
      // Jika daftar kosong, langsung ganti mode
      setScanMode(newMode);
    }
  };

  const handleScanSubmit = () => {
    if (scanMode === 'packing') {
      handleScanPackNomor();
    } else {
      handleScanIndividualItem();
    }
  };

  // Fungsi untuk menangani scan barcode packing
  const handleScanPackNomor = async () => {
    if (!store || !scannedValue || isScanning) return;

    if (scannedPacks.has(scannedValue)) {
      Toast.show({
        type: 'info',
        text1: 'Info',
        text2: `Packing ${scannedValue} sudah di-scan.`,
      });
      setScannedValue('');
      return;
    }

    setIsScanning(true);
    try {
      const response = await getItemsFromPackingApi(scannedValue, userToken);
      const newItemsFromPack = response.data.data;

      // Logika penggabungan item yang disempurnakan
      setItems(prevItems => {
        const itemsMap = new Map(prevItems.map(item => [item.barcode, item]));
        newItemsFromPack.forEach(newItem => {
          if (itemsMap.has(newItem.barcode)) {
            // Jika item sudah ada, tambahkan kuantitasnya
            const existingItem = itemsMap.get(newItem.barcode);
            existingItem.qty += newItem.qty;
          } else {
            // Jika item baru, tambahkan ke map
            itemsMap.set(newItem.barcode, newItem);
          }
        });
        return Array.from(itemsMap.values());
      });

      setScannedPacks(prev => new Set(prev).add(scannedValue));
      Toast.show({
        type: 'success',
        text1: 'Sukses',
        text2: `${newItemsFromPack.length} jenis item dari ${scannedValue} ditambahkan!`,
      });
      playSound('success');
    } catch (error) {
      const message =
        error.response?.data?.message || 'Gagal memuat data packing.';
      Toast.show({type: 'error', text1: 'Error Scan', text2: message});
      playSound('error');
    } finally {
      setIsScanning(false);
      setScannedValue('');
      setTimeout(() => scannerInputRef.current?.focus(), 100);
    }
  };

  const handleScanIndividualItem = async () => {
    if (!store || !scannedValue || isScanning) return;

    setIsScanning(true);
    const barcode = scannedValue;

    // Langkah 1: Cek apakah item sudah ada di daftar
    const existingItemIndex = items.findIndex(item => item.barcode === barcode);

    if (existingItemIndex > -1) {
      // --- JIKA ITEM SUDAH ADA ---
      const newItems = [...items];
      newItems[existingItemIndex].qty += 1;
      setItems(newItems);
      playSound('success'); // -> SUARA SUKSES
    } else {
      // --- JIKA ITEM BARU ---
      try {
        const gudang = userInfo.cabang;
        const response = await validateBarcodeApi(barcode, gudang, userToken);
        const product = response.data.data;
        const newItem = {
          barcode: product.barcode,
          kode: product.kode,
          nama: product.nama,
          ukuran: product.ukuran,
          stok: product.stok,
          qty: 1,
        };
        setItems(prevItems => [newItem, ...prevItems]);
        playSound('success'); // -> SUARA SUKSES
      } catch (error) {
        const message = error.response?.data?.message || 'Barcode tidak valid.';
        Toast.show({type: 'error', text1: 'Error Barcode', text2: message});
        playSound('error'); // -> SUARA GAGAL
      }
    }

    // Langkah terakhir: Selalu bersihkan dan kembalikan fokus
    setIsScanning(false);
    setScannedValue('');
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleSave = async () => {
    if (!store || items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Data Tidak Lengkap',
        text2: 'Pastikan store tujuan dan item sudah terisi.',
      });
      return;
    }

    Alert.alert(
      'Konfirmasi Simpan', // Judul Alert
      `Anda yakin ingin menyimpan Surat Jalan ke ${store.nama} dengan total ${items.length} jenis barang?`, // Pesan Alert
      [
        // Tombol pertama: Batal
        {
          text: 'Batal',
          onPress: () => console.log('Simpan dibatalkan'),
          style: 'cancel',
        },
        // Tombol kedua: Ya, Simpan
        {
          text: 'Ya, Simpan',
          onPress: async () => {
            setIsSaving(true);
            try {
              const payload = {
                isNew: true, // Selalu buat baru dari mobile
                header: {
                  tanggal: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                  gudang: {kode: userInfo.cabang},
                  store: {kode: store.kode},
                  permintaan: null,
                  keterangan: keterangan,
                },
                items: items.map(item => ({
                  kode: item.kode,
                  ukuran: item.ukuran,
                  jumlah: item.qty,
                })),
              };

              const response = await saveSuratJalanApi(payload, userToken);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: response.data.message,
              });
              navigation.goBack();
            } catch (error) {
              const message =
                error.response?.data?.message || 'Gagal menyimpan Surat Jalan.';
              Toast.show({
                type: 'error',
                text1: 'Gagal Menyimpan',
                text2: message,
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleSelectStore = selectedStore => {
    setStore(selectedStore);
    setStoreModalVisible(false);
  };

  const renderItem = ({item}) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.nama}</Text>
        <Text style={styles.itemDetails}>
          Kode: {item.kode} | Size: {item.ukuran}
        </Text>
      </View>
      <Text style={styles.itemQty}>x {item.qty}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* --- MODAL PENCARIAN STORE --- */}
      <SearchModal
        visible={isStoreModalVisible}
        onClose={() => setStoreModalVisible(false)}
        onSelect={handleSelectStore}
        title="Pilih Store Tujuan"
        apiSearchFunction={params => searchStoresApi(params, userToken)}
        keyField="kode"
        renderListItem={(
          item, // -> "Resep" untuk menampilkan Store
        ) => (
          <>
            <Text style={styles.itemKode}>{item.kode}</Text>
            <Text style={styles.itemNama}>{item.nama}</Text>
          </>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        {/* --- Bagian Header Form --- */}
        <View style={styles.headerFormContainer}>
          <Text style={styles.label}>Tujuan Pengiriman</Text>
          <TouchableOpacity
            style={styles.lookupButton}
            onPress={() => setStoreModalVisible(true)}>
            <Icon name="home" size={20} color={store ? '#D32F2F' : '#757575'} />
            <Text
              style={[styles.lookupText, store && styles.lookupTextSelected]}>
              {store ? `${store.kode} - ${store.nama}` : 'Pilih Store...'}
            </Text>
            <Icon name="chevron-down" size={20} color="#757575" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Keterangan (opsional)..."
            value={keterangan}
            onChangeText={setKeterangan}
            placeholderTextColor="#BDBDBD"
          />
        </View>

        {/* --- Bagian Konten & Daftar Item --- */}
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.kode}-${index}`}
          style={styles.list}
          ListHeaderComponent={
            <View style={styles.scanSection}>
              <View style={styles.modeSelectorContainer}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    scanMode === 'packing' && styles.modeButtonActive,
                  ]}
                  onPress={() => handleChangeMode('packing')}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      scanMode === 'packing' && styles.modeButtonTextActive,
                    ]}>
                    Scan Packing
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    scanMode === 'item' && styles.modeButtonActive,
                  ]}
                  onPress={() => handleChangeMode('item')}>
                  <Text
                    style={[
                      styles.modeButtonText,
                      scanMode === 'item' && styles.modeButtonTextActive,
                    ]}>
                    Scan Barang
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrapper}>
                <Icon
                  name={scanMode === 'packing' ? 'package' : 'cpu'}
                  size={20}
                  color="#A0AEC0"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={scannerInputRef}
                  style={styles.scanInput}
                  placeholder={
                    scanMode === 'packing'
                      ? 'Scan Barcode Packing...'
                      : 'Scan Barcode Barang...'
                  }
                  value={scannedValue}
                  onChangeText={setScannedValue}
                  onSubmitEditing={handleScanSubmit}
                  editable={!isScanning}
                  placeholderTextColor="#A0AEC0"
                />
                {isScanning && <ActivityIndicator style={{marginLeft: 10}} />}
              </View>
              <Text style={styles.listTitle}>Item yang Akan Dikirim</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Belum ada item.</Text>
              <Text style={styles.emptySubText}>
                Silakan pilih store dan scan barcode packing.
              </Text>
            </View>
          }
        />

        {/* --- Bagian Footer Tombol Aksi --- */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Simpan Surat Jalan</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  headerFormContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  label: {fontSize: 14, color: '#757575', marginBottom: 6},
  lookupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  lookupText: {flex: 1, fontSize: 16, marginHorizontal: 10, color: '#757575'},
  lookupTextSelected: {color: '#212121', fontWeight: '600'},
  input: {
    backgroundColor: '#F4F6F8',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#212121',
  },
  scanSection: {
    // -> Style baru untuk membungkus semua bagian scan
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 10,
  },
  modeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modeButtonText: {
    fontWeight: '600',
    color: '#616161',
  },
  modeButtonTextActive: {
    color: '#D32F2F',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  scanInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    paddingHorizontal: 12,
    color: '#1A202C',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: {marginRight: 10},
  list: {flex: 1},
  itemContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontSize: 16, fontWeight: '600', color: '#212121'},
  itemDetails: {fontSize: 12, color: '#757575', marginTop: 4},
  itemQty: {fontSize: 18, fontWeight: 'bold', color: '#212121'},
  emptyContainer: {alignItems: 'center', paddingVertical: 80},
  emptyText: {fontSize: 16, fontWeight: '600', color: '#757575'},
  emptySubText: {fontSize: 14, color: '#BDBDBD', marginTop: 4},
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  listTitle: {
    // -> Style baru untuk judul daftar
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20, // -> Memberi jarak dari input scan
    marginBottom: 10,
  },
  buttonText: {color: '#FFFFFF', fontWeight: 'bold', fontSize: 16},
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
});

export default SuratJalanScreen;
