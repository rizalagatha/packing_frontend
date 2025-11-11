import React, {
  useState,
  useContext,
  useRef,
  useCallback,
  useLayoutEffect,
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
  validateBarcodeApi,
  saveMutasiApi,
  searchTujuanStoreApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const MutasiStoreScreen = ({navigation}) => {
  const {userInfo, userToken} = useContext(AuthContext);
  const [storeTujuan, setStoreTujuan] = useState(null);
  const [keterangan, setKeterangan] = useState('');
  const [items, setItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const scannerInputRef = useRef(null);

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
      'Semua data yang sudah diinput akan dihapus. Anda yakin ingin mengulang?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Kosongkan',
          onPress: () => {
            setStoreTujuan(null);
            setKeterangan('');
            setItems([]);
            setScannedBarcode('');
          },
          style: 'destructive',
        },
      ],
    );
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleReset} style={{marginRight: 15}}>
          <Icon name="rotate-ccw" size={24} color="#D32F2F" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleReset]);

  const handleBarcodeScan = async () => {
    if (!storeTujuan) {
      Toast.show({
        type: 'error',
        text1: 'Pilih Tujuan',
        text2: 'Pilih store tujuan terlebih dahulu.',
      });
      playSound('error');
      return;
    }
    if (!scannedBarcode) return;

    const barcode = scannedBarcode;
    const existingItemIndex = items.findIndex(item => item.barcode === barcode);

    if (existingItemIndex > -1) {
      handleQuantityChange(barcode, items[existingItemIndex].jumlah + 1);
      playSound('success');
    } else {
      try {
        const gudang = userInfo.cabang;
        const response = await validateBarcodeApi(barcode, gudang, userToken);
        const product = response.data.data;
        if (product.stok <= 0) {
          Toast.show({
            type: 'error',
            text1: 'Stok Habis',
            text2: `Stok untuk ${product.nama} (${product.ukuran}) kosong.`,
          });
          playSound('error');
        } else {
          const newItem = {...product, jumlah: 1};
          setItems(prevItems => [newItem, ...prevItems]);
          playSound('success');
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.response?.data?.message || 'Barcode tidak valid.',
        });
        playSound('error');
      }
    }
    setScannedBarcode('');
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleQuantityChange = (barcode, newQty) => {
    const newItems = items.map(item => {
      if (item.barcode === barcode) {
        const qty = parseInt(newQty, 10) || 0;
        if (qty > item.stok) {
          Toast.show({
            type: 'error',
            text1: 'Stok Tidak Cukup',
            text2: `Stok hanya tersisa ${item.stok}`,
          });
          return {...item, jumlah: item.stok};
        }
        return {...item, jumlah: qty};
      }
      return item;
    });
    setItems(newItems);
  };

  const handleSave = async () => {
    if (
      !storeTujuan ||
      items.length === 0 ||
      items.every(item => item.jumlah === 0)
    ) {
      Toast.show({
        type: 'error',
        text1: 'Data Tidak Lengkap',
        text2: 'Pilih tujuan dan tambahkan minimal 1 barang.',
      });
      return;
    }

    Alert.alert(
      'Konfirmasi Simpan',
      `Anda akan membuat mutasi ke ${storeTujuan.nama}. Lanjutkan?`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Simpan',
          onPress: async () => {
            setIsSaving(true);
            try {
              const payload = {
                isNew: true,
                header: {
                  tanggal: new Date().toISOString().split('T')[0],
                  storeTujuanKode: storeTujuan.kode,
                  keterangan: keterangan,
                },
                items: items.filter(item => item.jumlah > 0),
              };
              const response = await saveMutasiApi(payload, userToken);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: response.data.message,
              });
              navigation.goBack();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Gagal Menyimpan',
                text2:
                  error.response?.data?.message || 'Gagal menyimpan mutasi.',
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.nama}
        </Text>
        <Text style={styles.itemDetails}>
          Size: {item.ukuran} | Stok: {item.stok}
        </Text>
      </View>
      <View style={styles.qtyInputContainer}>
        <TextInput
          style={styles.qtyInput}
          value={String(item.jumlah)}
          onChangeText={text => handleQuantityChange(item.barcode, text)}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <SearchModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelect={store => setStoreTujuan(store)}
        title="Pilih Store Tujuan"
        apiSearchFunction={params => searchTujuanStoreApi(params, userToken)}
        keyField="kode"
        renderListItem={item => (
          <>
            <Text style={styles.itemKode}>{item.kode}</Text>
            <Text style={styles.itemNama}>{item.nama}</Text>
          </>
        )}
      />

      <View style={styles.headerForm}>
        <TouchableOpacity
          style={styles.lookupButton}
          onPress={() => setIsModalVisible(true)}>
          <Icon
            name="home"
            size={20}
            color={storeTujuan ? '#D32F2F' : '#757575'}
          />
          <Text
            style={[
              styles.lookupText,
              storeTujuan && styles.lookupTextSelected,
            ]}>
            {storeTujuan
              ? `${storeTujuan.kode} - ${storeTujuan.nama}`
              : 'Pilih Store Tujuan...'}
          </Text>
          <Icon name="chevron-down" size={20} color="#757575" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Keterangan (opsional)..."
          value={keterangan}
          onChangeText={setKeterangan}
        />
      </View>

      <View style={styles.scanContainer}>
        <TextInput
          ref={scannerInputRef}
          style={styles.scanInput}
          placeholder="Scan Barcode Barang..."
          value={scannedBarcode}
          onChangeText={setScannedBarcode}
          onSubmitEditing={handleBarcodeScan}
          blurOnSubmit={false}
          editable={!!storeTujuan}
        />
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.barcode}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Pilih tujuan dan scan barang.</Text>
        }
      />

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Simpan Mutasi</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  headerForm: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
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
    height: 48,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#212121',
  },
  scanContainer: {padding: 16},
  scanInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#212121',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontSize: 16, fontWeight: '600'},
  itemDetails: {color: '#666', marginTop: 4},
  qtyInputContainer: {width: 60, marginLeft: 10},
  qtyInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 16,
    color: '#212121',
  },
  emptyText: {textAlign: 'center', marginTop: 40, color: '#999'},
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#D32F2F',
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
});

export default MutasiStoreScreen;
