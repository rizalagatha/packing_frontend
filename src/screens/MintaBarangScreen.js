import React, {
  useState,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  getAutoBufferApi,
  scanMintaBarangApi,
  saveMintaBarangApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const MintaBarangScreen = ({navigation, route}) => {
  const {userToken} = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [keterangan, setKeterangan] = useState('');
  const [scannedValue, setScannedValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hideAutoLoadButton, setHideAutoLoadButton] = useState(false);
  const scannerInputRef = useRef(null);

  const playSound = useCallback(type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('Tidak bisa memutar suara', e);
    }
  }, []);

  useEffect(() => {
    if (route.params?.initialItems) {
      // Clone data agar aman dari referensi navigation
      const initialData = route.params.initialItems.map(item => ({
        ...item,
        // Pastikan jumlah awal diambil, jika tidak ada default 1
        jumlah: item.jumlah !== undefined ? item.jumlah : 1,
      }));
      setItems(initialData);

      Toast.show({
        type: 'success',
        text1: 'Data Dimuat',
        text2: `${initialData.length} barang ditambahkan.`,
      });
    }

    if (route.params?.fromLowStock) {
      setHideAutoLoadButton(true);
    }
  }, [route.params]);

  const handleLoadAutoBuffer = async () => {
    setIsLoading(true);
    try {
      const response = await getAutoBufferApi(userToken);
      setItems(response.data.data);
      Toast.show({
        type: 'success',
        text1: 'Berhasil',
        text2: `${response.data.data.length} barang dimuat.`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Gagal memuat data buffer.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = async () => {
    if (!scannedValue) return;
    const barcode = scannedValue;
    setScannedValue('');

    // Cek duplikat di list
    const existingIndex = items.findIndex(i => i.barcode === barcode);
    if (existingIndex > -1) {
      // Tambah qty
      setItems(prev => {
        const newItems = [...prev];
        newItems[existingIndex].jumlah += 1;
        return newItems;
      });
      playSound('success');
    } else {
      // Fetch data baru
      try {
        const response = await scanMintaBarangApi(barcode, userToken);
        const newItem = response.data.data;
        setItems(prev => [newItem, ...prev]);
        playSound('success');
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Barcode tidak ditemukan.',
        });
        playSound('error');
      }
    }
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleQtyChange = (barcode, text) => {
    // Izinkan input kosong (untuk memudahkan edit)
    if (text === '') {
      setItems(prev =>
        prev.map(item =>
          item.barcode === barcode ? {...item, jumlah: ''} : item,
        ),
      );
      return;
    }

    const qty = parseInt(text);
    if (isNaN(qty)) return; // Abaikan karakter non-angka

    setItems(prev =>
      prev.map(item => {
        if (item.barcode === barcode) {
          return {...item, jumlah: qty};
        }
        return item;
      }),
    );
  };

  // Handle saat input kehilangan fokus (blur) -> pastikan tidak kosong
  const handleQtyBlur = barcode => {
    setItems(prev =>
      prev.map(item => {
        if (
          item.barcode === barcode &&
          (item.jumlah === '' || item.jumlah === 0)
        ) {
          return {...item, jumlah: 1}; // Reset ke 1 jika kosong/0
        }
        return item;
      }),
    );
  };

  const handleDeleteItem = barcode => {
    setItems(prev => prev.filter(item => item.barcode !== barcode));
  };

  const handleSave = async () => {
    // Filter barang dengan jumlah valid sebelum simpan
    const validItems = items.filter(item => item.jumlah > 0);

    if (validItems.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Tidak ada barang dengan jumlah valid.',
      });
      return;
    }

    Alert.alert('Konfirmasi', 'Kirim permintaan barang ini ke DC?', [
      {text: 'Batal', style: 'cancel'},
      {
        text: 'Ya, Kirim',
        onPress: async () => {
          setIsSaving(true);
          try {
            const payload = {
              isNew: true,
              header: {
                tanggal: new Date().toISOString().split('T')[0],
                keterangan: keterangan,
              },
              items: validItems,
            };
            const response = await saveMintaBarangApi(payload, userToken);
            Toast.show({
              type: 'success',
              text1: 'Sukses',
              text2: response.data.message,
            });
            navigation.goBack();
          } catch (error) {
            Toast.show({
              type: 'error',
              text1: 'Gagal',
              text2: 'Gagal menyimpan permintaan.',
            });
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const renderItem = ({item}) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.nama}</Text>
        <Text style={styles.itemDetails}>
          Size: {item.ukuran} | Stok: {item.stok} | Min: {item.stokmin}
        </Text>
        {item.mino !== undefined && (
          <Text style={[styles.itemDetails, {color: '#2196F3'}]}>
            Saran Order: {item.mino}
          </Text>
        )}
      </View>
      <View style={styles.qtyContainer}>
        <Text style={styles.labelQty}>Minta:</Text>
        <TextInput
          style={styles.qtyInput}
          value={String(item.jumlah)} // Konversi ke string
          onChangeText={text => handleQtyChange(item.barcode, text)}
          onBlur={() => handleQtyBlur(item.barcode)}
          keyboardType="numeric"
          selectTextOnFocus // Memudahkan edit (langsung blok semua teks)
        />
        <TouchableOpacity
          onPress={() => handleDeleteItem(item.barcode)}
          style={styles.deleteButton}>
          <Icon name="trash-2" size={20} color="#D32F2F" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerForm}>
        {/* --- PERBAIKAN: Sembunyikan Tombol jika fromLowStock --- */}
        {!hideAutoLoadButton && (
          <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
            <TouchableOpacity
              style={styles.autoButton}
              onPress={handleLoadAutoBuffer}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.autoButtonText}>Load Auto Buffer</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        {/* ------------------------------------------------------- */}

        <TextInput
          style={styles.input}
          placeholder="Keterangan Permintaan (Opsional)..."
          value={keterangan}
          onChangeText={setKeterangan}
        />
      </View>

      <View style={styles.scanContainer}>
        <View style={styles.inputWrapper}>
          <Icon name="cpu" size={20} color="#A0AEC0" style={styles.inputIcon} />
          <TextInput
            ref={scannerInputRef}
            style={styles.scanInput}
            placeholder="Scan Barang Tambahan..."
            value={scannedValue}
            onChangeText={setScannedValue}
            onSubmitEditing={handleScan}
            blurOnSubmit={false}
          />
        </View>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.barcode}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada barang diminta.</Text>
        }
        keyboardShouldPersistTaps="handled" // Agar bisa tap di luar keyboard
      />

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={isSaving || items.length === 0}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Simpan Permintaan</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  headerForm: {padding: 16, backgroundColor: '#fff'},
  autoButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  autoButtonText: {color: '#fff', fontWeight: 'bold'},
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  scanContainer: {padding: 16},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 48,
  },
  inputIcon: {paddingLeft: 12},
  scanInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    paddingHorizontal: 10,
    color: '#1A202C',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontWeight: 'bold', fontSize: 14, color: '#212121'},
  itemDetails: {fontSize: 12, color: '#666'},
  qtyContainer: {flexDirection: 'row', alignItems: 'center'},
  labelQty: {fontSize: 12, color: '#888', marginRight: 5},
  qtyInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    backgroundColor: '#fff',
  },
  deleteButton: {marginLeft: 10, padding: 5},
  footerContainer: {padding: 16, backgroundColor: '#fff'},
  button: {
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  emptyText: {textAlign: 'center', marginTop: 50, color: '#999'},
});

export default MintaBarangScreen;
