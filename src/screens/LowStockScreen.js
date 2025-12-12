import React, {useState, useContext, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {getLowStockApi, searchStoresApi} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const LowStockScreen = ({navigation}) => {
  const {userToken, userInfo} = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [isStoreModalVisible, setStoreModalVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Cek apakah user adalah KDC/Pusat
  const isKDC =
    userInfo.cabang === 'KDC' ||
    userInfo.cabang === 'KBS' ||
    userInfo.cabang === 'P04';

  // --- EFFECT: Set Otomatis Toko untuk User Store ---
  useEffect(() => {
    if (!isKDC) {
      // Gunakan cabang_nama dari userInfo, fallback ke nama user jika belum ada (untuk kompatibilitas)
      const namaToko = userInfo.cabang_nama || userInfo.nama;
      setSelectedStore({kode: userInfo.cabang, nama: namaToko});
    }
  }, [isKDC, userInfo]);

  const fetchLowStock = useCallback(async () => {
    if (!selectedStore) return;
    setIsLoading(true);
    setSelectedItems(new Set());
    try {
      const response = await getLowStockApi(
        {cabang: selectedStore.kode},
        userToken,
      );
      setItems(response.data.data);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Gagal memuat data stok.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedStore, userToken]);

  useEffect(() => {
    if (selectedStore) fetchLowStock();
    else setItems([]);
  }, [selectedStore, fetchLowStock]);

  const toggleSelection = itemKey => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) newSet.delete(itemKey);
      else newSet.add(itemKey);
      return newSet;
    });
  };

  const handleProcessAction = () => {
    if (selectedItems.size === 0) {
      Toast.show({
        type: 'error',
        text1: 'Pilih Barang',
        text2: 'Pilih minimal satu barang.',
      });
      return;
    }

    const itemsToSend = items.filter(item =>
      selectedItems.has(`${item.kode}-${item.ukuran}`),
    );

    if (isKDC) {
      // ALUR 1: User KDC -> Buat Surat Jalan (Mode Manual Scan)
      const itemsForSJ = itemsToSend.map(item => ({
        kode: item.kode,
        barcode: item.barcode,
        nama: item.nama,
        ukuran: item.ukuran,
        stok: item.stok_dc, // Stok DC sebagai referensi
        jumlahKirim: 0,
        jumlahScan: 0,
        qty: 0,
      }));

      navigation.navigate('SuratJalan', {
        initialStore: selectedStore,
        initialItems: itemsForSJ,
        mode: 'manual-scan',
      });
    } else {
      // ALUR 2: User Store -> Buat Permintaan Barang
      const itemsForMinta = itemsToSend.map(item => ({
        kode: item.kode,
        barcode: item.barcode,
        nama: item.nama,
        ukuran: item.ukuran,
        stok: item.stok_real, // Stok toko saat ini
        stokmin: item.buffer_stok, // Mapping buffer_stok ke stokmin
        stokmax: item.buffer_stok, // Asumsi max = min buffer untuk tampilan sederhana
        mino: Math.max(0, item.buffer_stok - item.stok_real), // Hitung mino (saran order)
        jumlah: Math.max(0, item.buffer_stok - item.stok_real),
      }));

      navigation.navigate('MintaBarang', {
        initialItems: itemsForMinta,
        fromLowStock: true,
      });
    }
  };

  const renderItem = ({item}) => {
    const itemKey = `${item.kode}-${item.ukuran}`;
    const isSelected = selectedItems.has(itemKey);

    return (
      <TouchableOpacity
        style={[styles.itemContainer, isSelected && styles.itemSelected]}
        onPress={() => toggleSelection(itemKey)}>
        <View style={styles.checkboxContainer}>
          <Icon
            name={isSelected ? 'check-square' : 'square'}
            size={24}
            color={isSelected ? '#D32F2F' : '#BDBDBD'}
          />
        </View>
        <View style={{flex: 1}}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.nama}
            </Text>
            <Text style={styles.itemSize}>{item.ukuran}</Text>
          </View>

          <View style={styles.itemStatsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Stok</Text>
              <Text style={[styles.statValue, {color: '#D32F2F'}]}>
                {item.stok_real}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>DC</Text>
              <Text style={[styles.statValue, {color: '#388E3C'}]}>
                {item.stok_dc}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Min</Text>
              <Text style={styles.statValue}>{item.buffer_stok}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={[styles.statValue, {color: '#007bff'}]}>
                {Math.ceil(item.avg_sales)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal hanya muncul untuk KDC */}
      <SearchModal
        visible={isStoreModalVisible}
        onClose={() => setStoreModalVisible(false)}
        onSelect={store => {
          setSelectedStore(store);
          setStoreModalVisible(false);
        }}
        title="Pilih Toko"
        apiSearchFunction={params => searchStoresApi(params, userToken)}
        keyField="kode"
        renderListItem={item => (
          <View>
            <Text style={{fontWeight: 'bold'}}>{item.kode}</Text>
            <Text>{item.nama}</Text>
          </View>
        )}
      />

      <View style={styles.headerForm}>
        <Text style={styles.label}>
          {isKDC ? 'Analisis Stok Toko:' : `Stok Menipis: ${userInfo.cabang}`}
        </Text>

        {/* Jika KDC: Tombol Pilih Toko. Jika Store: Text Nama Toko Statis */}
        {isKDC ? (
          <TouchableOpacity
            style={styles.lookupButton}
            onPress={() => setStoreModalVisible(true)}>
            <Icon
              name="home"
              size={20}
              color={selectedStore ? '#D32F2F' : '#757575'}
            />
            <Text style={styles.lookupText}>
              {selectedStore
                ? `${selectedStore.kode} - ${selectedStore.nama}`
                : 'Pilih Toko...'}
            </Text>
            <Icon name="chevron-down" size={20} color="#757575" />
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.lookupButton,
              {backgroundColor: '#e0e0e0', borderColor: 'transparent'},
            ]}>
            <Icon name="home" size={20} color="#616161" />
            <Text style={styles.lookupText}>
              {userInfo.cabang} - {userInfo.nama}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#D32F2F"
          style={{marginTop: 50}}
        />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => `${item.kode}-${item.ukuran}`}
          contentContainerStyle={{paddingBottom: 100}}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {isKDC && !selectedStore
                ? 'Pilih toko untuk memulai.'
                : 'Stok aman. Tidak ada barang di bawah buffer.'}
            </Text>
          }
        />
      )}

      {selectedItems.size > 0 && (
        <View style={styles.footerContainer}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {selectedItems.size} Barang Dipilih
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleProcessAction}>
            <Icon
              name={isKDC ? 'truck' : 'shopping-cart'}
              size={20}
              color="#fff"
              style={{marginRight: 10}}
            />
            <Text style={styles.buttonText}>
              {isKDC ? 'Buat Surat Jalan' : 'Buat Permintaan'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  label: {fontSize: 12, color: '#616161', marginBottom: 8},
  lookupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  lookupText: {
    flex: 1,
    fontSize: 15,
    marginHorizontal: 10,
    color: '#212121',
    fontWeight: '500',
  },

  itemContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSelected: {
    backgroundColor: '#ffebee',
    borderColor: '#D32F2F',
    borderWidth: 1,
  },
  checkboxContainer: {marginRight: 15},

  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
    marginRight: 10,
  },
  itemSize: {
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },

  itemStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  statBox: {alignItems: 'center', flex: 1},
  statLabel: {fontSize: 10, color: '#757575', marginBottom: 2},
  statValue: {fontSize: 14, fontWeight: 'bold', color: '#212121'},

  emptyText: {textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16},
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 10,
  },
  summaryContainer: {marginBottom: 10, alignItems: 'center'},
  summaryText: {color: '#616161', fontSize: 14, fontWeight: 'bold'},
  button: {
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
});

export default LowStockScreen;
