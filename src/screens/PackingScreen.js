import React, {useState, useContext, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../context/AuthContext';
import {validateBarcodeApi, savePackingApi} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PackingScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);

  const [items, setItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [highlightedBarcode, setHighlightedBarcode] = useState(null);
  const {userInfo} = useContext(AuthContext);

  useEffect(() => {
    if (highlightedBarcode) {
      const timer = setTimeout(() => {
        setHighlightedBarcode(null);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [highlightedBarcode]);

  const handleBarcodeScan = async () => {
    if (!scannedBarcode) {
      return;
    }
    const barcode = scannedBarcode;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const existingItemIndex = items.findIndex(item => item.barcode === barcode);
    if (existingItemIndex > -1) {
      const newItems = [...items];
      newItems[existingItemIndex].qty += 1;
      setItems(newItems);
      setScannedBarcode('');
      setHighlightedBarcode(barcode);
      return;
    }

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
    } catch (error) {
      const message = error.response?.data?.message || 'Barcode tidak valid.';
      Toast.show({type: 'error', text1: 'Error Barcode', text2: message});
    } finally {
      setScannedBarcode('');
    }
  };

  const handleDeleteItem = itemToDelete => {
    Alert.alert(
      'Hapus Item',
      `Anda yakin ingin menghapus "${itemToDelete.nama}" (${itemToDelete.ukuran}) dari daftar?`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Hapus',
          onPress: () => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            setItems(prevItems =>
              prevItems.filter(item => item.barcode !== itemToDelete.barcode),
            );
          },
          style: 'destructive',
        },
      ],
    );
  };

  const handleSavePacking = async () => {
    if (items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Tidak ada item untuk disimpan.',
      });
      return;
    }

    // Menghitung total kuantitas untuk pesan konfirmasi
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    Alert.alert(
      'Konfirmasi Simpan', // Judul
      `Anda akan menyimpan packing dengan ${items.length} jenis barang (total ${totalQty} pcs). Lanjutkan?`, // Pesan
      [
        // Tombol Batal
        {
          text: 'Batal',
          style: 'cancel',
        },
        // Tombol Konfirmasi untuk menyimpan
        {
          text: 'Ya, Simpan',
          onPress: async () => {
            setIsSaving(true);
            try {
              const dataToSave = {
                keterangan: keterangan,
                items: items.map(item => ({
                  barcode: item.barcode,
                  qty: item.qty,
                  brg_kaosan: item.nama,
                  size: item.ukuran,
                })),
              };
              const response = await savePackingApi(dataToSave, userToken);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: `Packing berhasil disimpan: ${response.data.data.pack_nomor}`,
              });
              setItems([]);
              setKeterangan('');
              navigation.goBack();
            } catch (error) {
              const message =
                error.response?.data?.message || 'Gagal menyimpan data.';
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

  const renderItem = ({item}) => (
    <View
      style={[
        styles.itemContainer,
        item.barcode === highlightedBarcode && styles.highlightedItem,
      ]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.nama}
        </Text>
        <Text style={styles.itemDetails}>
          Size: {item.ukuran} | Stok: {item.stok}
        </Text>
      </View>
      <Text style={styles.itemQty}>x {item.qty}</Text>
      <TouchableOpacity
        onPress={() => handleDeleteItem(item)}
        style={styles.deleteButton}>
        <Icon name="trash-2" size={20} color="#c62828" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.inputWrapper}>
            <Icon
              name="hash"
              size={20}
              color="#A0AEC0"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Scan Barcode Di Sini..."
              value={scannedBarcode}
              onChangeText={setScannedBarcode}
              onSubmitEditing={handleBarcodeScan}
              blurOnSubmit={false}
              autoFocus={true}
              placeholderTextColor="#A0AEC0"
            />
          </View>
          <View style={styles.inputWrapper}>
            <Icon
              name="edit-3"
              size={20}
              color="#A0AEC0"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Keterangan (opsional)..."
              value={keterangan}
              onChangeText={setKeterangan}
              placeholderTextColor="#A0AEC0"
            />
          </View>
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.barcode}-${index}`}
          style={styles.list}
          ListHeaderComponent={
            <Text style={styles.listHeaderText}>Item yang di-Scan</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Daftar masih kosong.</Text>
              <Text style={styles.emptySubText}>
                Silakan mulai scan barcode.
              </Text>
            </View>
          }
        />

        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSavePacking}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Simpan Packing ({items.length} item)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  container: {flex: 1},
  headerContainer: {paddingHorizontal: 16, paddingTop: 16},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  inputIcon: {paddingLeft: 12},
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    paddingHorizontal: 12,
    color: '#1A202C',
  },
  list: {flex: 1, paddingHorizontal: 16, marginTop: 10},
  listHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 10,
  },
  itemContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontSize: 16, fontWeight: '600', color: '#1A202C'},
  itemDetails: {fontSize: 12, color: '#718096', marginTop: 4},
  itemQty: {fontSize: 18, fontWeight: 'bold', color: '#2D3748'},
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {fontSize: 16, fontWeight: '600', color: '#718096'},
  emptySubText: {fontSize: 14, color: '#A0AEC0', marginTop: 4},
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#c62828',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  highlightedItem: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  deleteButton: {
    marginLeft: 15,
    padding: 5,
  },
});

export default PackingScreen;
