import React, {useState, useContext, useCallback} from 'react';
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
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SearchModal from '../components/SearchModal';

const SuratJalanScreen = ({navigation}) => {
  const {userInfo, userToken} = useContext(AuthContext);

  // State untuk data form
  const [store, setStore] = useState(null); // Akan berisi { kode: 'K01', nama: 'STORE 01' }
  const [keterangan, setKeterangan] = useState('');
  const [scannedPackNomor, setScannedPackNomor] = useState('');
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPacks, setScannedPacks] = useState(new Set()); // Untuk mencegah scan packing ganda
  const [isStoreModalVisible, setStoreModalVisible] = useState(false);

  // Fungsi untuk menangani scan barcode packing
  const handleScanPackNomor = async () => {
    if (!store) {
      Toast.show({
        type: 'error',
        text1: 'Pilih Store Tujuan',
        text2: 'Anda harus memilih store tujuan terlebih dahulu.',
      });
      return;
    }
    if (!scannedPackNomor || isScanning) return;

    if (scannedPacks.has(scannedPackNomor)) {
      Toast.show({
        type: 'info',
        text1: 'Info',
        text2: `Packing ${scannedPackNomor} sudah di-scan.`,
      });
      setScannedPackNomor('');
      return;
    }

    setIsScanning(true);
    try {
      const response = await getItemsFromPackingApi(
        scannedPackNomor,
        userToken,
      );
      const newItems = response.data.data.map(item => ({
        ...item,
        qty: item.qty,
      })); // Sesuaikan nama field jika perlu

      setItems(prevItems => [...prevItems, ...newItems]);
      setScannedPacks(prev => new Set(prev).add(scannedPackNomor));
      Toast.show({
        type: 'success',
        text1: 'Sukses',
        text2: `${newItems.length} item dari ${scannedPackNomor} ditambahkan!`,
      });
    } catch (error) {
      const message =
        error.response?.data?.message || 'Gagal memuat data packing.';
      Toast.show({type: 'error', text1: 'Error Scan', text2: message});
    } finally {
      setIsScanning(false);
      setScannedPackNomor('');
    }
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
        <Text style={styles.itemName} numberOfLines={2}>
          {item.nama}
        </Text>
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
            <View style={styles.scanContainer}>
              <View style={styles.inputWrapper}>
                <Icon
                  name="package"
                  size={20}
                  color="#A0AEC0"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.scanInput}
                  placeholder="Scan Barcode Packing..."
                  value={scannedPackNomor}
                  onChangeText={setScannedPackNomor}
                  onSubmitEditing={handleScanPackNomor}
                  editable={!isScanning}
                  placeholderTextColor="#A0AEC0"
                />
                {isScanning && <ActivityIndicator style={{marginLeft: 10}} />}
              </View>
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
  scanContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputWrapper: {
    // -> Style baru untuk membungkus input scan
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
