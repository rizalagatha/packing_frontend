import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
  useMemo,
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
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import SearchModal from '../components/SearchModal';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';
import {
  savePackingListApi,
  getPackingListDetailApi,
  loadItemsFromRequestApi,
  findProductByBarcodeApi,
  searchStoresApi,
  searchPermintaanOpenApi,
  getItemsFromPackingApi,
} from '../api/ApiService';

const PackingListScreen = ({navigation, route}) => {
  const {userToken} = useContext(AuthContext);
  const {nomor} = route.params || {};
  const isEditMode = !!nomor;
  const scannerInputRef = useRef(null);

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isScanningPack, setIsScanningPack] = useState(false);

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

  // [MODE SCAN]
  const [scanMode, setScanMode] = useState('packing');
  const [scannedPacks, setScannedPacks] = useState(new Set());

  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchMode, setSearchMode] = useState('STORE');

  // --- COMPUTED ---
  const totalScan = useMemo(
    () => items.reduce((acc, curr) => acc + curr.jumlah, 0),
    [items],
  );
  const totalMinta = useMemo(
    () => items.reduce((acc, curr) => acc + (curr.minta || 0), 0),
    [items],
  );

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('Error playing sound:', e);
    }
  };

  // --- INITIAL LOAD ---
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
          minta: 0,
          jumlah: Number(item.jumlah),
          barcode: item.barcode,
          keterangan: item.keterangan || '',
        }));
        setItems(mappedItems);
        setScanMode('barang');
      } catch (error) {
        Alert.alert('Error', 'Gagal memuat data packing list.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    },
    [userToken, navigation],
  );

  const handleLoadRequest = useCallback(
    async nomorPermintaan => {
      setLoading(true);
      try {
        const res = await loadItemsFromRequestApi(nomorPermintaan, userToken);
        let rawItems = [];

        if (Array.isArray(res.data)) rawItems = res.data;
        else if (res.data && Array.isArray(res.data.data))
          rawItems = res.data.data;

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
            jumlah: 0,
            barcode: item.barcode || '',
            keterangan: '',
          }));

          setItems(newItems);
          setHeader(prev => ({...prev, permintaan: nomorPermintaan}));
          Toast.show({
            type: 'success',
            text1: 'Sukses',
            text2: `Memuat ${newItems.length} item. Silakan Scan Barang.`,
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

  useEffect(() => {
    if (isEditMode) {
      loadDataForEdit(nomor);
    } else if (route.params?.autoLoadRequest) {
      const {nomor: requestNomor, store} = route.params.autoLoadRequest;
      setHeader(prev => ({
        ...prev,
        store: store,
        permintaan: requestNomor,
      }));
      setScanMode('barang');
      handleLoadRequest(requestNomor);
    }
  }, [nomor, isEditMode, loadDataForEdit, route.params, handleLoadRequest]);

  // --- LOGIC GANTI MODE ---
  const handleChangeMode = newMode => {
    if (scanMode === newMode) return;

    const confirmChange = () => {
      setItems([]);
      setHeader(prev => ({...prev, permintaan: ''}));
      setScannedPacks(new Set());
      setScanMode(newMode);
    };

    if (items.length > 0) {
      Alert.alert('Ganti Mode?', 'Daftar item saat ini akan dikosongkan.', [
        {text: 'Batal'},
        {text: 'Ya, Ganti', onPress: confirmChange},
      ]);
    } else {
      confirmChange();
    }
  };

  // --- LOGIC SCAN PACKING (FIXED STOK) ---
  const handleScanPackNomor = async packNomor => {
    if (scannedPacks.has(packNomor)) {
      Toast.show({
        type: 'info',
        text1: 'Info',
        text2: `Packing ${packNomor} sudah di-scan.`,
      });
      return;
    }

    if (!packNomor.toUpperCase().startsWith('PACK')) {
      Toast.show({
        type: 'error',
        text1: 'Format Salah',
        text2: 'Scan barcode Packing (PACK...)',
      });
      playSound('error');
      return;
    }

    setIsScanningPack(true);
    try {
      const response = await getItemsFromPackingApi(packNomor, userToken);
      const newItemsFromPack = response.data.data;

      if (!newItemsFromPack || newItemsFromPack.length === 0) {
        throw new Error('Data packing kosong.');
      }

      setItems(prevItems => {
        const itemsMap = new Map(prevItems.map(i => [i.barcode, i]));

        newItemsFromPack.forEach(newItem => {
          if (itemsMap.has(newItem.barcode)) {
            // Item sudah ada, tambah qty saja
            const existing = itemsMap.get(newItem.barcode);
            existing.jumlah += newItem.qty;
            // Opsional: update stok jika data baru lebih update
            // existing.stok = Number(newItem.stok) || existing.stok;
          } else {
            // Item baru
            itemsMap.set(newItem.barcode, {
              id: newItem.kode + newItem.ukuran + Math.random().toString(),
              kode: newItem.kode,
              nama: newItem.nama,
              ukuran: newItem.ukuran,

              // [FIX] Mengambil Stok dari API (bukan 999 lagi)
              stok: Number(newItem.stok) || 0,

              minta: 0,
              jumlah: newItem.qty,
              barcode: newItem.barcode,
              keterangan: `From ${packNomor}`,
            });
          }
        });

        return Array.from(itemsMap.values());
      });

      setScannedPacks(prev => new Set(prev).add(packNomor));
      Toast.show({
        type: 'success',
        text1: 'Sukses',
        text2: `Packing ${packNomor} ditambahkan.`,
      });
      playSound('success');
    } catch (error) {
      const msg = error.response?.data?.message || 'Gagal memuat data packing.';
      Toast.show({type: 'error', text1: 'Error Scan', text2: msg});
      playSound('error');
    } finally {
      setIsScanningPack(false);
    }
  };

  const handleScanBarang = async scannedCode => {
    const itemIndex = items.findIndex(i => i.barcode === scannedCode);

    if (itemIndex >= 0) {
      const newItems = [...items];
      const item = newItems[itemIndex];

      if (header.permintaan && item.jumlah + 1 > item.minta) {
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'Jumlah scan melebihi permintaan.',
        });
      }

      item.jumlah += 1;
      newItems.splice(itemIndex, 1);
      newItems.unshift(item);
      setItems(newItems);
      setLastScannedBarcode(scannedCode);
      playSound('success');
    } else {
      if (header.permintaan) {
        Toast.show({
          type: 'error',
          text1: 'Ditolak',
          text2: 'Barang tidak ada di daftar permintaan.',
        });
        playSound('error');
      } else {
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
  };

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
    if (scanMode === 'packing') {
      await handleScanPackNomor(scannedCode);
    } else {
      await handleScanBarang(scannedCode);
    }
    setBarcodeInput('');
    setTimeout(() => scannerInputRef.current?.focus(), 200);
  };

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
    Alert.alert('Hapus Item', 'Hapus item ini?', [
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

    Alert.alert('Simpan Packing List?', 'Pastikan data benar.', [
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

        {/* Warning jika melebihi stok (jika stok valid > 0) */}
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
                <Text style={{fontSize: 12, fontStyle: 'italic'}}>
                  {item.keterangan}
                </Text>
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
            setItems([]);
          } else {
            handleLoadRequest(item.nomor || item.mt_nomor);
          }
        }}
      />

      {/* HEADER FORM */}
      <View style={styles.headerSection}>
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              scanMode === 'packing' && styles.modeBtnActive,
            ]}
            onPress={() => handleChangeMode('packing')}>
            <Icon
              name="package"
              size={16}
              color={scanMode === 'packing' ? '#fff' : '#666'}
            />
            <Text
              style={[
                styles.modeText,
                scanMode === 'packing' && styles.modeTextActive,
              ]}>
              {' '}
              Scan Packing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              scanMode === 'barang' && styles.modeBtnActive,
            ]}
            onPress={() => handleChangeMode('barang')}>
            <Icon
              name="list"
              size={16}
              color={scanMode === 'barang' ? '#fff' : '#666'}
            />
            <Text
              style={[
                styles.modeText,
                scanMode === 'barang' && styles.modeTextActive,
              ]}>
              {' '}
              Scan Barang
            </Text>
          </TouchableOpacity>
        </View>

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

          {/* INPUT NO PERMINTAAN: Hanya muncul jika Mode = Barang */}
          {scanMode === 'barang' && (
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
                style={[
                  styles.valueInput,
                  !header.permintaan && {color: '#999'},
                ]}
                numberOfLines={1}>
                {header.permintaan || 'Load...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.scanContainer}>
          <Icon
            name={scanMode === 'packing' ? 'package' : 'maximize'}
            size={20}
            color="#666"
            style={{marginRight: 10}}
          />
          <TextInput
            ref={scannerInputRef}
            style={styles.scanInput}
            placeholder={
              scanMode === 'packing'
                ? 'Scan No. Packing (PACK...)'
                : 'Scan Barcode Barang...'
            }
            value={barcodeInput}
            onChangeText={setBarcodeInput}
            onSubmitEditing={handleScan}
            autoCapitalize="none"
            blurOnSubmit={false}
            autoFocus={true}
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

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{padding: 16, paddingBottom: 100}}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="layers" size={48} color="#DDD" />
            <Text style={{color: '#999', marginTop: 10}}>
              {scanMode === 'packing'
                ? 'Scan Kardus Packing dari Produksi'
                : 'Load Permintaan lalu Scan Barang'}
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={{flex: 1}}>
          <Text style={{fontSize: 11, color: '#666'}}>Total Scan / Minta</Text>
          <View style={{flexDirection: 'row', alignItems: 'flex-end'}}>
            <Text style={{fontSize: 20, fontWeight: 'bold', color: '#1976D2'}}>
              {totalScan}
            </Text>
            {totalMinta > 0 ? (
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#757575',
                  marginBottom: 2,
                  marginLeft: 4,
                }}>
                / {totalMinta} Pcs
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: 14,
                  color: '#666',
                  marginBottom: 2,
                  marginLeft: 4,
                }}>
                Pcs
              </Text>
            )}
          </View>
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

      {/* Loading Overlay */}
      {isScanningPack && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{color: '#fff', marginTop: 10, fontWeight: 'bold'}}>
            Memuat Data Packing...
          </Text>
        </View>
      )}
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

  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: '#1976D2',
    elevation: 2,
  },
  modeText: {fontSize: 13, fontWeight: '600', color: '#666', marginLeft: 6},
  modeTextActive: {color: '#fff'},

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
  },
  itemCardLastScanned: {
    borderLeftWidth: 5,
    borderLeftColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  },

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
  itemKode: {fontWeight: 'bold', color: '#212121', fontSize: 15},
  itemNama: {color: '#555', fontSize: 13},
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});

export default PackingListScreen;
