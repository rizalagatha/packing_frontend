import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Keyboard,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import SearchModal from '../components/SearchModal';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player'; // Pastikan library ini terinstall
import {
  savePackingListApi,
  getPackingListDetailApi,
  loadItemsFromRequestApi,
  findProductByBarcodeApi,
  searchStoresApi,
  searchPermintaanOpenApi,
} from '../api/ApiService';

const PackingListScreen = ({navigation, route}) => {
  const {userToken} = useContext(AuthContext);
  const {nomor} = route.params || {};
  const isEditMode = !!nomor;
  const scannerInputRef = useRef(null);

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Header Data
  const [header, setHeader] = useState({
    nomor: '',
    tanggal: new Date().toISOString().split('T')[0],
    store: {kode: '', nama: ''},
    permintaan: '',
    keterangan: '',
  });

  const [items, setItems] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScannedBarcode, setLastScannedBarcode] = useState(null);

  // --- SEARCH MODAL STATE ---
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchMode, setSearchMode] = useState('STORE');

  // --- SOUND HELPER ---
  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('Error playing sound:', e);
    }
  };

  // --- INITIAL LOAD (EDIT MODE) ---
  const loadDataForEdit = useCallback(
    async nomorPl => {
      setLoading(true);
      try {
        const res = await getPackingListDetailApi(nomorPl, userToken);
        const data = res.data;

        setHeader({
          nomor: data.header.nomor,
          tanggal: data.header.tanggal.split('T')[0],
          store: {kode: data.header.store_kode, nama: data.header.store_nama},
          permintaan: data.header.permintaan || '',
          keterangan: data.header.keterangan || '',
        });

        const mappedItems = data.items.map(item => ({
          id: item.kode + item.ukuran,
          kode: item.kode,
          nama: item.nama,
          ukuran: item.ukuran,
          stok: Number(item.stok),
          minta: 0, // Edit mode biasanya tidak membawa data minta lama
          jumlah: Number(item.jumlah), // Load jumlah yang sudah tersimpan
          barcode: item.barcode,
          keterangan: item.keterangan || '',
        }));
        setItems(mappedItems);
      } catch (error) {
        Alert.alert('Error', 'Gagal memuat data packing list.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    },
    [userToken, navigation],
  );

  // --- EFFECT: HANDLE INITIAL LOAD (EDIT OR AUTO LOAD) ---
  useEffect(() => {
    // Skenario 1: Mode Edit (Membuka Packing List yang sudah tersimpan)
    if (isEditMode) {
      loadDataForEdit(nomor);
    }
    // Skenario 2: Auto Load dari Low Stock Screen
    else if (route.params?.autoLoadRequest) {
      const {nomor: requestNomor, store} = route.params.autoLoadRequest;

      console.log('[PackingList] Auto Loading Request:', requestNomor);

      // 1. Isi Header secara otomatis (Store & No Permintaan)
      setHeader(prev => ({
        ...prev,
        store: store,
        permintaan: requestNomor,
      }));

      // 2. Panggil API untuk memuat item permintaan tersebut
      handleLoadRequest(requestNomor);
    }
  }, [nomor, isEditMode, loadDataForEdit, route.params, handleLoadRequest]);

  // --- LOGIC: LOAD FROM REQUEST ---
  const handleLoadRequest = useCallback(
    async nomorPermintaan => {
      setLoading(true);
      try {
        const res = await loadItemsFromRequestApi(nomorPermintaan, userToken);
        let rawItems = [];

        // Handling format response
        if (Array.isArray(res.data)) rawItems = res.data;
        else if (res.data && Array.isArray(res.data.data))
          rawItems = res.data.data;
        else if (Array.isArray(res)) rawItems = res; // Handle jika backend langsung return array

        if (rawItems.length === 0) {
          Alert.alert('Info', 'Permintaan ini tidak memiliki item detail.');
          setItems([]);
        } else {
          const newItems = rawItems.map(item => ({
            id: (item.kode || 'NO_KODE') + (item.ukuran || 'NO_SIZE'),
            kode: item.kode,
            nama: item.nama,
            ukuran: item.ukuran,
            stok: Number(item.stok) || 0,
            minta: Number(item.minta) || 0,

            // --- PERUBAHAN PENTING 1: START DARI 0 ---
            // User harus scan satu per satu, tidak langsung terisi penuh
            jumlah: 0,

            barcode: item.barcode || '',
            keterangan: '',
          }));

          setItems(newItems);
          setHeader(prev => ({...prev, permintaan: nomorPermintaan}));
          Toast.show({
            type: 'success',
            text1: 'Sukses',
            text2: `Memuat ${newItems.length} item. Silakan Scan.`,
          });
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Gagal memuat detail permintaan.');
      } finally {
        setLoading(false);
      }
    },
    [userToken],
  );

  // --- LOGIC: SCAN BARCODE (CORE) ---
  const handleScan = async () => {
    if (!header.store.kode) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Pilih Store Tujuan dulu!',
      });
      playSound('error');
      setBarcodeInput('');
      return;
    }
    if (!barcodeInput) return;

    const scannedCode = barcodeInput.trim();
    setBarcodeInput(''); // Langsung kosongkan input

    // 1. Cari di Daftar Item (Local Search)
    const itemIndex = items.findIndex(i => i.barcode === scannedCode);

    if (itemIndex >= 0) {
      // --- BARANG DITEMUKAN DI LIST ---
      const newItems = [...items];
      const item = newItems[itemIndex];

      // Validasi: Apakah melebihi permintaan? (Opsional: Disini kita beri warning tapi tetap allow, atau blokir)
      if (header.permintaan && item.jumlah >= item.minta) {
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'Jumlah scan sudah memenuhi permintaan.',
        });
        // playSound('error'); // Uncomment jika ingin bunyi error saat lebih
        // return; // Uncomment jika ingin memblokir kelebihan
      }

      // Increment Jumlah
      item.jumlah += 1;

      // Reorder: Pindahkan item yang baru discan ke paling atas
      newItems.splice(itemIndex, 1);
      newItems.unshift(item);

      setItems(newItems);
      setLastScannedBarcode(scannedCode);
      playSound('success');
    } else {
      // --- BARANG TIDAK DITEMUKAN (BARANG ASING) ---
      // Jika load dari permintaan, biasanya barang asing ditolak atau dicek ke server
      if (header.permintaan) {
        Toast.show({
          type: 'error',
          text1: 'Item Ditolak',
          text2: 'Barang tidak ada di daftar permintaan.',
        });
        playSound('error');
      } else {
        // Mode tanpa permintaan (Free Scan), cari ke backend
        try {
          const res = await findProductByBarcodeApi(scannedCode, userToken);
          const product = res.data;

          const newItem = {
            id: product.kode + product.ukuran,
            kode: product.kode,
            nama: product.nama,
            ukuran: product.ukuran,
            stok: Number(product.stok) || 0,
            minta: 0,
            jumlah: 1,
            barcode: product.barcode,
            keterangan: '',
          };

          setItems([newItem, ...items]);
          setLastScannedBarcode(scannedCode);
          playSound('success');
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Tidak Ditemukan',
            text2: 'Barcode tidak valid.',
          });
          playSound('error');
        }
      }
    }

    // Kembalikan fokus ke input (untuk alat scan external)
    setTimeout(() => scannerInputRef.current?.focus(), 200);
  };

  // --- LOGIC: DECREASE QTY (MINUS BUTTON) ---
  const handleDecreaseQty = id => {
    setItems(currentItems =>
      currentItems.map(item => {
        if (item.id === id && item.jumlah > 0) {
          return {...item, jumlah: item.jumlah - 1};
        }
        return item;
      }),
    );
  };

  const deleteItem = id => {
    Alert.alert('Hapus Item', 'Yakin hapus item ini dari daftar?', [
      {text: 'Batal'},
      {
        text: 'Hapus',
        onPress: () => setItems(prev => prev.filter(i => i.id !== id)),
      },
    ]);
  };

  const handleSave = async () => {
    if (!header.store.kode)
      return Alert.alert('Validasi', 'Store tujuan harus diisi.');

    const validItems = items.filter(i => i.jumlah > 0);
    if (validItems.length === 0)
      return Alert.alert('Validasi', 'Belum ada barang yang discan.');

    Alert.alert('Konfirmasi Simpan', 'Simpan Packing List ini?', [
      {text: 'Batal', style: 'cancel'},
      {
        text: 'Simpan',
        onPress: async () => {
          setSaving(true);
          try {
            const payload = {header, items: validItems, isNew: !isEditMode};
            await savePackingListApi(payload, userToken);
            Toast.show({
              type: 'success',
              text1: 'Berhasil',
              text2: 'Data tersimpan.',
            });
            navigation.goBack();
          } catch (error) {
            const msg = error.response?.data?.message || error.message;
            Alert.alert('Gagal', msg);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // --- RENDER ITEM ---
  const renderItem = ({item}) => {
    const isCompleted =
      header.permintaan && item.jumlah >= item.minta && item.minta > 0;
    const isLastScanned = item.barcode === lastScannedBarcode;

    return (
      <View
        style={[
          styles.itemCard,
          isCompleted && styles.itemCardCompleted,
          isLastScanned && styles.itemCardLastScanned,
        ]}>
        <View style={styles.itemHeader}>
          <View style={{flex: 1}}>
            <Text style={styles.itemName}>{item.nama}</Text>
            <View style={styles.rowInfo}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.kode}</Text>
              </View>
              <View style={[styles.badge, {backgroundColor: '#FFF3E0'}]}>
                <Text style={[styles.badgeText, {color: '#E65100'}]}>
                  {item.ukuran}
                </Text>
              </View>
            </View>
            {/* TAMPILKAN BARCODE DISINI */}
            <Text style={styles.barcodeText}>
              <Icon name="maximize" size={10} /> {item.barcode}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => deleteItem(item.id)}
            style={{padding: 5}}>
            <Icon name="x" size={18} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.itemFooter}>
          <View>
            <Text style={styles.label}>
              Stok DC:{' '}
              <Text style={{fontWeight: 'bold', color: '#333'}}>
                {item.stok}
              </Text>
            </Text>
            {header.permintaan ? (
              <Text style={styles.label}>
                Minta:{' '}
                <Text style={{fontWeight: 'bold', color: '#333'}}>
                  {item.minta}
                </Text>
              </Text>
            ) : null}
          </View>

          <View style={styles.qtyContainer}>
            {/* TOMBOL MINUS (HANYA INI CARA KURANGI QTY MANUAL) */}
            <TouchableOpacity
              style={styles.btnMinus}
              onPress={() => handleDecreaseQty(item.id)}
              disabled={item.jumlah <= 0}>
              <Icon
                name="minus"
                size={20}
                color={item.jumlah > 0 ? '#D32F2F' : '#CCC'}
              />
            </TouchableOpacity>

            <View style={styles.qtyDisplay}>
              <Text style={styles.qtyNumber}>{item.jumlah}</Text>
              {header.permintaan && (
                <Text style={styles.qtyTarget}> / {item.minta}</Text>
              )}
            </View>
          </View>
        </View>

        {item.jumlah > item.stok && (
          <Text style={styles.warningText}>
            ⚠️ Jumlah melebihi stok gudang!
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* MODAL SEARCH */}
      <SearchModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        title={
          searchMode === 'STORE'
            ? 'Cari Store Tujuan'
            : `Permintaan ${header.store.nama}`
        }
        keyField={searchMode === 'STORE' ? 'kode' : 'nomor'}
        apiSearchFunction={
          searchMode === 'STORE'
            ? params => searchStoresApi({...params}, userToken)
            : async params => {
                // Logic wrapper agar sesuai format SearchModal
                const res = await searchPermintaanOpenApi(
                  {...params, storeKode: header.store.kode},
                  userToken,
                );
                if (Array.isArray(res.data))
                  return {...res, data: {data: {items: res.data}}};
                return res;
              }
        }
        renderListItem={item => (
          <View>
            {searchMode === 'STORE' ? (
              <>
                <Text style={styles.itemKode}>
                  {item.kode || item.gdg_kode}
                </Text>
                <Text style={styles.itemNama}>
                  {item.nama || item.gdg_nama}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.itemKode}>{item.nomor}</Text>
                <Text style={styles.itemNama}>
                  Tgl: {item.tanggal ? item.tanggal.split('T')[0] : '-'}
                </Text>
                {item.keterangan && (
                  <Text style={{fontSize: 12, fontStyle: 'italic'}}>
                    {item.keterangan}
                  </Text>
                )}
              </>
            )}
          </View>
        )}
        onSelect={item => {
          if (searchMode === 'STORE') {
            setHeader(prev => ({
              ...prev,
              store: {
                kode: item.kode || item.gdg_kode,
                nama: item.nama || item.gdg_nama,
              },
              permintaan: '',
            }));
            setItems([]); // Reset items jika ganti store
          } else {
            handleLoadRequest(item.nomor || item.mt_nomor);
          }
        }}
      />

      {/* HEADER FORM */}
      <View style={styles.headerSection}>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.inputBox, {flex: 1, marginRight: 8}]}
            onPress={() => {
              setSearchMode('STORE');
              setIsSearchVisible(true);
            }}
            disabled={isEditMode}>
            <Text style={styles.labelInput}>Store Tujuan</Text>
            <Text
              style={[
                styles.valueInput,
                !header.store.kode && {color: '#999'},
              ]}>
              {header.store.nama || 'Pilih Store...'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inputBox, {flex: 0.8}]}
            onPress={() => {
              if (!header.store.kode)
                return Toast.show({type: 'error', text1: 'Pilih Store Dulu'});
              setSearchMode('PERMINTAAN');
              setIsSearchVisible(true);
            }}
            disabled={isEditMode || !header.store.kode}>
            <Text style={styles.labelInput}>No. Permintaan</Text>
            <Text
              style={[styles.valueInput, !header.permintaan && {color: '#999'}]}
              numberOfLines={1}>
              {header.permintaan || 'Load...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SCANNER INPUT */}
        <View style={styles.scanContainer}>
          <Icon
            name="maximize"
            size={20}
            color="#666"
            style={{marginRight: 10}}
          />
          <TextInput
            ref={scannerInputRef}
            style={styles.scanInput}
            placeholder="Scan Barcode Barang..."
            value={barcodeInput}
            onChangeText={setBarcodeInput}
            onSubmitEditing={handleScan}
            autoCapitalize="none"
            blurOnSubmit={false}
            autoFocus={true} // Auto focus saat buka
          />
          {barcodeInput.length > 0 && (
            <TouchableOpacity
              onPress={() => setBarcodeInput('')}
              style={{padding: 5}}>
              <Icon name="x" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LIST ITEMS */}
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{padding: 16, paddingBottom: 100}}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="layers" size={48} color="#DDD" />
            <Text style={{color: '#999', marginTop: 10}}>
              Load Permintaan atau Scan Barang
            </Text>
          </View>
        }
      />

      {/* FOOTER */}
      <View style={styles.footer}>
        <View>
          <Text style={{fontSize: 12, color: '#666'}}>Total Scan</Text>
          <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1976D2'}}>
            {items.reduce((acc, curr) => acc + curr.jumlah, 0)} Pcs
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.btnSave,
            (items.length === 0 || saving) && {backgroundColor: '#CCC'},
          ]}
          onPress={handleSave}
          disabled={items.length === 0 || saving}>
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Icon
                name="save"
                size={18}
                color="#FFF"
                style={{marginRight: 8}}
              />
              <Text style={{color: '#FFF', fontWeight: 'bold'}}>SIMPAN</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  headerSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  row: {flexDirection: 'row', marginBottom: 12},

  inputBox: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FAFAFA',
  },
  labelInput: {fontSize: 10, color: '#888', marginBottom: 2},
  valueInput: {fontSize: 14, color: '#333', fontWeight: '600'},

  scanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  scanInput: {flex: 1, fontSize: 16, color: '#333', height: 50},

  // ITEM STYLES
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  itemCardCompleted: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
  }, // Hijau Muda jika selesai
  itemCardLastScanned: {
    borderLeftWidth: 5,
    borderLeftColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  }, // Biru muda untuk yang baru discan

  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 4},
  rowInfo: {flexDirection: 'row', marginBottom: 4},
  badge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {fontSize: 11, color: '#555', fontWeight: 'bold'},
  barcodeText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F5F5F5',
  },
  label: {fontSize: 11, color: '#888'},

  qtyContainer: {flexDirection: 'row', alignItems: 'center'},
  btnMinus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  qtyDisplay: {alignItems: 'flex-end'},
  qtyNumber: {fontSize: 20, fontWeight: 'bold', color: '#1976D2'},
  qtyTarget: {fontSize: 12, color: '#888', marginTop: -2},

  warningText: {
    color: '#D32F2F',
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyState: {alignItems: 'center', marginTop: 80},

  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#EEE',
  },
  btnSave: {
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  // Styles untuk Search Modal
  itemKode: {fontWeight: 'bold', color: '#212121', fontSize: 15},
  itemNama: {color: '#555', fontSize: 13},
});

export default PackingListScreen;
