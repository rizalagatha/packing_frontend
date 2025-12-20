import React, {useState, useContext, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  getLowStockApi,
  searchStoresApi,
  createPermintaanOtomatisApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const LowStockScreen = ({navigation}) => {
  const {userToken, userInfo} = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedStore, setSelectedStore] = useState(null);
  const [isStoreModalVisible, setStoreModalVisible] = useState(false);

  // Menggunakan Map untuk menyimpan item yang dipilih beserta jumlah alokasinya
  // Key: "kode-ukuran", Value: { ...itemData, inputAlokasi: number }
  const [selectedItemsMap, setSelectedItemsMap] = useState(new Map());

  // --- STATE MODAL QTY ---
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [tempItem, setTempItem] = useState(null);
  const [tempQty, setTempQty] = useState('');

  // Cek apakah user adalah KDC/Pusat
  const isKDC =
    userInfo.cabang === 'KDC' ||
    userInfo.cabang === 'KBS' ||
    userInfo.cabang === 'P04';

  // --- EFFECT: Set Otomatis Toko untuk User Store ---
  useEffect(() => {
    if (!isKDC) {
      const namaToko = userInfo.cabang_nama || userInfo.nama;
      setSelectedStore({kode: userInfo.cabang, nama: namaToko});
    }
  }, [isKDC, userInfo]);

  const fetchLowStock = useCallback(async () => {
    if (!selectedStore) return;
    setIsLoading(true);
    setSelectedItemsMap(new Map()); // Reset pilihan saat load ulang
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

  // --- HANDLER ITEM CLICK (OPEN QTY MODAL) ---
  const handleItemPress = item => {
    const itemKey = `${item.kode}-${item.ukuran}`;

    // Hitung saran alokasi (Buffer - Stok Real)
    // Jika user KDC, saran order adalah kebutuhan toko
    const suggestion = Math.max(0, item.buffer_stok - item.stok_real);

    // Cek apakah sudah ada nilai sebelumnya
    const existing = selectedItemsMap.get(itemKey);
    const initialQty = existing ? existing.inputAlokasi : suggestion;

    setTempItem(item);
    setTempQty(String(initialQty));
    setQtyModalVisible(true);
  };

  // --- HANDLER SAVE QTY FROM MODAL ---
  const handleSaveQty = () => {
    const qty = parseInt(tempQty, 10);

    if (isNaN(qty) || qty <= 0) {
      // Jika 0 atau invalid, hapus dari seleksi (uncheck)
      const newMap = new Map(selectedItemsMap);
      newMap.delete(`${tempItem.kode}-${tempItem.ukuran}`);
      setSelectedItemsMap(newMap);
    } else {
      // Simpan ke Map
      const newMap = new Map(selectedItemsMap);
      newMap.set(`${tempItem.kode}-${tempItem.ukuran}`, {
        ...tempItem,
        inputAlokasi: qty,
      });
      setSelectedItemsMap(newMap);
    }

    setQtyModalVisible(false);
    setTempItem(null);
  };

  // --- HANDLER PROSES (CREATE REQUEST & NAVIGATE) ---
  const handleProcessAction = async () => {
    if (selectedItemsMap.size === 0) {
      return Toast.show({
        type: 'error',
        text1: 'Pilih Barang',
        text2: 'Belum ada barang dengan alokasi > 0.',
      });
    }

    // Hanya KDC yang bisa membuat Permintaan Otomatis untuk cabang
    if (!isKDC) {
      return Alert.alert('Info', 'Fitur ini khusus untuk user KDC/Pusat.');
    }

    Alert.alert(
      'Konfirmasi',
      `Buat Permintaan Otomatis untuk ${selectedItemsMap.size} item?`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Proses',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // 1. Siapkan Payload
              const itemsPayload = Array.from(selectedItemsMap.values()).map(
                item => ({
                  kode: item.kode,
                  ukuran: item.ukuran,
                  jumlah: item.inputAlokasi,
                }),
              );

              const payload = {
                header: {
                  store: selectedStore,
                  keterangan: 'Analisis Stok Menipis (Auto)',
                },
                items: itemsPayload,
              };

              // 2. Panggil API Backend
              const response = await createPermintaanOtomatisApi(
                payload,
                userToken,
              );
              const {nomor, store} = response.data.data;

              Toast.show({
                type: 'success',
                text1: 'Berhasil',
                text2: `Permintaan ${nomor} dibuat.`,
              });

              // 3. NAVIGASI LANGSUNG KE PACKING LIST SCREEN
              // Kita kirim parameter agar PackingListScreen langsung load data tersebut
              navigation.replace('PackingList', {
                nomor: null, // Mode scan baru (tapi kita inject data lewat header)
                // Atau jika PackingListScreen Anda support "Load by Nomor":
                autoLoadRequest: {
                  nomor: nomor,
                  store: store,
                },
              });

              // ALTERNATIF: Jika PackingListScreen Anda butuh 'nomor' untuk mode edit/view:
              // navigation.replace('PackingListScreen', { nomor: nomor });
            } catch (error) {
              const msg =
                error.response?.data?.message || 'Gagal memproses permintaan.';
              Alert.alert('Error', msg);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}) => {
    const itemKey = `${item.kode}-${item.ukuran}`;
    const selectedData = selectedItemsMap.get(itemKey);
    const isSelected = !!selectedData;

    return (
      <TouchableOpacity
        style={[styles.itemContainer, isSelected && styles.itemSelected]}
        onPress={() => handleItemPress(item)}>
        <View style={styles.leftSection}>
          <View style={styles.checkboxContainer}>
            <Icon
              name={isSelected ? 'check-square' : 'square'}
              size={24}
              color={isSelected ? '#D32F2F' : '#BDBDBD'}
            />
          </View>
          {/* Tampilkan QTY Alokasi jika terpilih */}
          {isSelected && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>
                {selectedData.inputAlokasi}
              </Text>
            </View>
          )}
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
              <Text style={styles.statLabel}>Toko</Text>
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
      {/* Modal Search Store */}
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

      {/* Modal Input Alokasi */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={qtyModalVisible}
        onRequestClose={() => setQtyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Input Alokasi</Text>
            <Text style={styles.modalSubtitle}>
              {tempItem?.nama} ({tempItem?.ukuran})
            </Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoText}>
                Stok Toko: {tempItem?.stok_real}
              </Text>
              <Text style={styles.infoText}>
                Buffer: {tempItem?.buffer_stok}
              </Text>
            </View>

            <TextInput
              style={styles.qtyInput}
              keyboardType="number-pad"
              value={tempQty}
              onChangeText={setTempQty}
              autoFocus={true}
              selectTextOnFocus={true}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setQtyModalVisible(false)}>
                <Text style={styles.btnTextCancel}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={handleSaveQty}>
                <Text style={styles.btnTextSave}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.headerForm}>
        <Text style={styles.label}>
          {isKDC ? 'Analisis Stok Toko:' : `Stok Menipis: ${userInfo.cabang}`}
        </Text>

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

      {selectedItemsMap.size > 0 && (
        <View style={styles.footerContainer}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              {selectedItemsMap.size} Barang Dipilih
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              isProcessing && {backgroundColor: '#B71C1C'},
            ]}
            onPress={handleProcessAction}
            disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon
                  name="check-circle"
                  size={20}
                  color="#fff"
                  style={{marginRight: 10}}
                />
                <Text style={styles.buttonText}>Proses Permintaan</Text>
              </>
            )}
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

  leftSection: {alignItems: 'center', marginRight: 15},
  checkboxContainer: {marginBottom: 5},
  qtyBadge: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qtyBadgeText: {color: '#fff', fontWeight: 'bold', fontSize: 12},

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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '80%',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  infoText: {fontSize: 12, color: '#555'},
  qtyInput: {
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {flexDirection: 'row', justifyContent: 'space-between'},
  btnCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  btnSave: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: '#D32F2F',
    borderRadius: 8,
  },
  btnTextCancel: {color: '#333', fontWeight: 'bold'},
  btnTextSave: {color: '#fff', fontWeight: 'bold'},
});

export default LowStockScreen;
