import React, {
  useState,
  useContext,
  useCallback,
  useLayoutEffect,
  useRef,
  useMemo,
  useEffect,
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
  searchPermintaanApi,
  loadItemsApi,
  validateBarcodeApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SearchModal from '../components/SearchModal';
import SoundPlayer from 'react-native-sound-player';
import DatePicker from 'react-native-date-picker';

const SuratJalanScreen = ({navigation, route}) => {
  const {userInfo, userToken} = useContext(AuthContext);

  const scannerInputRef = useRef(null);

  // State untuk data form
  const [store, setStore] = useState(null); // Akan berisi { kode: 'K01', nama: 'STORE 01' }
  const [keterangan, setKeterangan] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState('packing');
  const [scannedPacks, setScannedPacks] = useState(new Set()); // Untuk mencegah scan packing ganda
  const [isStoreModalVisible, setStoreModalVisible] = useState(false);
  const [permintaan, setPermintaan] = useState(null);
  const [isPermintaanModalVisible, setPermintaanModalVisible] = useState(false);
  const [date, setDate] = useState(new Date());
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState(null);
  const [isLowStockMode, setIsLowStockMode] = useState(false);

  // --- LOGIKA AUTO-FILL DARI LOW STOCK SCREEN (DIPERBAIKI) ---
  useEffect(() => {
    if (route.params?.initialStore && route.params?.initialItems) {
      setStore(route.params.initialStore);

      const prefilledItems = route.params.initialItems.map(item => ({
        ...item,
        // Ambil stok real, jika tidak ada ambil stok biasa, jika tidak ada 0
        stok: item.stok || 0,
        jumlahKirim: 0,
        jumlahScan: 0,
        qty: 0,
      }));

      setItems(prefilledItems);
      setKeterangan('BARANG LOW STOCK');

      // Set mode ke permintaan (tanpa no permintaan) agar scan manual
      setScanMode('permintaan');
      setPermintaan(null);

      setIsLowStockMode(true);

      Toast.show({
        type: 'success',
        text1: 'Data Dimuat',
        text2: 'Silakan scan barang untuk mengisi jumlah.',
      });
    }
  }, [route.params]);

  const totalJenisItem = useMemo(() => items.length, [items]);

  const totalScanQty = useMemo(() => {
    // Menghitung total qty berdasarkan mode scan
    if (scanMode === 'packing') {
      return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    } else {
      // mode 'permintaan'
      return items.reduce(
        (sum, item) => sum + (Number(item.jumlahScan) || 0),
        0,
      );
    }
  }, [items, scanMode]);

  const summary = useMemo(() => {
    if (items.length === 0) {
      return {itemSelesai: 0, totalJenis: 0, totalScan: 0, totalKirim: 0};
    }

    // Kalkulasi untuk mode "Scan Packing"
    if (scanMode === 'packing') {
      const totalJenis = items.length;
      const totalScan = items.reduce(
        (sum, item) => sum + (Number(item.qty) || 0),
        0,
      );
      // Untuk mode packing, anggap item selesai = total jenis, dan kirim = scan
      return {
        itemSelesai: totalJenis,
        totalJenis: totalJenis,
        totalScan: totalScan,
        totalKirim: totalScan,
      };
    }

    // Kalkulasi untuk mode "Load Permintaan"
    else {
      const totalJenis = items.length;
      const totalKirim = items.reduce(
        (sum, item) => sum + (Number(item.jumlahKirim) || 0),
        0,
      );
      const totalScan = items.reduce(
        (sum, item) => sum + (Number(item.jumlahScan) || 0),
        0,
      );
      const itemSelesai = items.filter(
        item => item.jumlahScan === item.jumlahKirim,
      ).length;
      return {itemSelesai, totalJenis, totalScan, totalKirim};
    }
  }, [items, scanMode]);

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('Tidak bisa memutar suara', e);
    }
  };

  const handleReset = useCallback(() => {
    Alert.alert(
      'Kosongkan Halaman?', // Judul diubah
      'Semua data yang sudah diinput (Store, Keterangan, No. Permintaan, dan Item Scan) akan dihapus. Anda yakin?', // Pesan diubah
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Kosongkan',
          onPress: () => {
            // --- INI ADALAH RESET TOTAL ---
            setStore(null);
            setPermintaan(null);
            setKeterangan('');
            setItems([]);
            setScannedValue('');
            setDate(new Date());
            setIsLowStockMode(false);
            setScanMode('packing');
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

  const handleDecreaseQty = useCallback(barcode => {
    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.barcode === barcode && item.jumlahScan > 0) {
          return {...item, jumlahScan: item.jumlahScan - 1};
        }
        return item;
      });
    });
  }, []);

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
      handlePermintaanModeScan();
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

  const handlePermintaanModeScan = async () => {
    if (!scannedValue) {
      return;
    }
    const barcode = scannedValue;
    setScannedValue('');
    setIsScanning(true);

    const itemIndex = items.findIndex(item => item.barcode === barcode);

    const updateAndReorder = (currentItem, isNew = false) => {
      currentItem.jumlahScan = (currentItem.jumlahScan || 0) + 1;
      currentItem.qty = (currentItem.qty || 0) + 1; // Jaga konsistensi

      // --- INI LOGIKA REORDERNYA ---
      if (isNew) {
        // Jika item baru, tambahkan ke paling atas
        setItems(prevItems => [currentItem, ...prevItems]);
      } else {
        // Jika item lama, cabut dari posisi lama, pindah ke atas
        setItems(prevItems => {
          const otherItems = prevItems.filter(i => i.barcode !== barcode);
          return [currentItem, ...otherItems];
        });
      }
      setLastScannedBarcode(barcode);
      playSound('success');
    };

    // Cek apakah kita sedang dalam mode "Validated Scan" (sudah pilih No. Permintaan)
    // atau mode "Free Scan" (belum pilih No. Permintaan)
    if (itemIndex > -1) {
      // --- ITEM DITEMUKAN (SUKSES) ---
      const currentItem = {...items[itemIndex]};
      updateAndReorder(currentItem);
    } else {
      // --- ITEM TIDAK DITEMUKAN (ITEM BARU) ---

      // -> 4. TAMBAHKAN VALIDASI DI SINI
      // Jika ada No. Permintaan ATAU sedang dalam Low Stock Mode, tolak barang asing.
      if (permintaan || isLowStockMode) {
        Toast.show({
          type: 'error',
          text1: 'Item Ditolak',
          text2: 'Barang ini tidak ada dalam daftar yang harus dikirim.',
        });
        playSound('error');
      } else {
        // Jika mode Free Scan biasa, baru boleh tambah
        try {
          const gudang = userInfo.cabang;
          const response = await validateBarcodeApi(barcode, gudang, userToken);
          const product = response.data.data;

          const newItem = {
            ...product,
            jumlahKirim: 0,
            jumlahScan: 0,
            qty: 0,
            stok: product.stok || 0,
          };

          updateAndReorder(newItem, true);
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Error Barcode',
            text2: error.response?.data?.message || 'Barcode tidak valid.',
          });
          playSound('error');
        }
      }
    }

    setIsScanning(false);
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleSelectStore = selectedStore => {
    setStore(selectedStore);
    setPermintaan(null);
    setItems([]);
  };

  const handleSelectPermintaan = async selected => {
    setPermintaan(selected);
    setIsLoading(true);
    try {
      const response = await loadItemsApi(
        selected.nomor,
        userInfo.cabang,
        userToken,
      );
      setItems(
        response.data.data
          .map(item => ({
            ...item,
            jumlahKirim: item.minta - item.sudah,
            jumlahScan: 0,
            qty: 0,
            stok: item.stok || 0,
          }))
          .filter(item => item.jumlahKirim > 0),
      );
      setTimeout(() => scannerInputRef.current?.focus(), 200);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal Memuat',
        text2: 'Gagal memuat item permintaan.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!store || items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Data Tidak Lengkap',
        text2: 'Pilih store tujuan dan scan barang.',
      });
      return;
    }
    // Cek apakah ada barang yang sudah di-scan
    const totalScan = items.reduce(
      (sum, item) => sum + (item.jumlahScan || item.qty || 0),
      0,
    );
    if (totalScan === 0) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Tidak ada barang yang di-scan.',
      });
      return;
    }

    Alert.alert(
      'Konfirmasi Simpan',
      'Anda yakin ingin menyimpan Surat Jalan ini?',
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
                  tanggal: date.toISOString().split('T')[0],
                  gudang: {kode: userInfo.cabang},
                  store: {kode: store.kode},
                  keterangan: keterangan,
                  permintaan: permintaan ? permintaan.nomor : null,
                },
                items: items
                  .map(item => ({
                    kode: item.kode,
                    ukuran: item.ukuran,
                    jumlah: scanMode === 'packing' ? item.qty : item.jumlahScan,
                  }))
                  .filter(item => item.jumlah > 0), // Hanya kirim yang ada jumlahnya
              };
              const response = await saveSuratJalanApi(payload, userToken);
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
                text2: error.response?.data?.message,
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = useCallback(
    ({item}) => {
      // 1. Tentukan Quantity yang akan ditampilkan
      const currentQty = item.jumlahScan || item.qty || 0;

      // 2. LOGIKA HIGHLIGHT (Warna Background)
      let itemStyle = styles.itemContainer;

      // Prioritas 1: Baru saja di-scan (Hijau Terang)
      if (item.barcode === lastScannedBarcode) {
        itemStyle = [styles.itemContainer, styles.itemLastScanned];
      }
      // Prioritas 2: Sudah selesai/match (Khusus mode permintaan)
      else if (
        permintaan &&
        currentQty === item.jumlahKirim &&
        currentQty > 0
      ) {
        itemStyle = [styles.itemContainer, styles.itemMatched];
      }
      // Prioritas 3: Sudah ada isinya (Kuning/Hijau Tipis)
      else if (currentQty > 0) {
        itemStyle = [styles.itemContainer, styles.itemHasQty];
      }

      // 3. RENDER TAMPILAN BERDASARKAN MODE
      if (scanMode === 'packing') {
        // --- BLOK YANG KEMARIN HILANG (DIKEMBALIKAN) ---
        return (
          <View style={itemStyle}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.nama}
              </Text>
              <Text style={styles.itemDetails}>
                Size: {item.ukuran} | Barcode: {item.barcode}
              </Text>
            </View>
            <Text style={styles.qtyValue}>x {item.qty}</Text>
          </View>
        );
      }

      // --- Render untuk mode 'permintaan' atau 'free scan' ---
      return (
        <View style={itemStyle}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.nama}
            </Text>
            <Text style={styles.itemDetails}>
              Size: {item.ukuran} | Stok: {item.stok || 0} | Barcode:{' '}
              {item.barcode}
            </Text>
          </View>

          <View style={styles.qtyContainer}>
            {/* Tampilkan 'Minta' hanya jika ada Permintaan */}
            {permintaan && (
              <Text style={styles.qtyLabel}>Minta: {item.jumlahKirim}</Text>
            )}

            {/* Kontrol Qty dengan Tombol Minus */}
            <View style={styles.qtyControl}>
              <TouchableOpacity
                onPress={() => handleDecreaseQty(item.barcode)}
                style={styles.qtyButton}>
                <Icon name="minus-circle" size={24} color="#D32F2F" />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{currentQty}</Text>
            </View>

            {/* Tampilkan 'Selisih' hanya jika ada Permintaan */}
            {permintaan && (
              <Text
                style={[
                  styles.qtyLabel,
                  {
                    color:
                      item.jumlahKirim - currentQty !== 0
                        ? '#D32F2F'
                        : '#4CAF50',
                  },
                ]}>
                Selisih: {item.jumlahKirim - currentQty}
              </Text>
            )}
          </View>
        </View>
      );
    },
    [scanMode, permintaan, handleDecreaseQty, lastScannedBarcode],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <SearchModal
        visible={isStoreModalVisible}
        onClose={() => setStoreModalVisible(false)}
        onSelect={handleSelectStore}
        title="Pilih Store Tujuan"
        apiSearchFunction={params => searchStoresApi(params, userToken)}
        keyField="kode"
        renderListItem={item => (
          <View>
            <Text style={styles.itemKode}>{item.kode}</Text>
            <Text style={styles.itemNama}>{item.nama}</Text>
          </View>
        )}
      />
      <SearchModal
        visible={isPermintaanModalVisible}
        onClose={() => setPermintaanModalVisible(false)}
        onSelect={handleSelectPermintaan}
        title="Cari No. Permintaan"
        apiSearchFunction={params =>
          searchPermintaanApi({...params, storeKode: store?.kode}, userToken)
        }
        keyField="nomor"
        renderListItem={item => (
          <View>
            <Text style={styles.itemKode}>{item.nomor}</Text>
            <Text style={styles.itemNama}>
              Tgl: {new Date(item.tanggal).toLocaleDateString('id-ID')}
            </Text>
            <Text style={styles.itemNama}>
              {item.keterangan || 'Tanpa Keterangan'}
            </Text>
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.headerFormContainer}>
          <View style={{marginBottom: 10}}>
            <Text style={styles.label}>Tanggal Surat Jalan</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setOpenDatePicker(true)}>
              <Icon
                name="calendar"
                size={20}
                color="#757575"
                style={{marginRight: 10}}
              />
              <Text style={styles.dateText}>
                {date.toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Kita bungkus dalam satu baris */}
          <View style={styles.rowContainer}>
            {/* Blok 1: Pilih Store */}
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Tujuan Pengiriman</Text>
              <TouchableOpacity
                style={[
                  styles.lookupButton,
                  isLowStockMode && styles.lookupButtonDisabled,
                ]}
                onPress={() => setStoreModalVisible(true)}
                disabled={isLowStockMode} // -> Dikunci saat Low Stock Mode
              >
                <Icon
                  name="home"
                  size={20}
                  color={store ? '#D32F2F' : '#757575'}
                />
                <Text
                  style={[
                    styles.lookupText,
                    store && styles.lookupTextSelected,
                  ]}
                  numberOfLines={1}>
                  {store ? store.nama : 'Pilih Store...'}
                </Text>
              </TouchableOpacity>
            </View>
            <DatePicker
              modal
              open={openDatePicker}
              date={date}
              mode="date"
              minimumDate={new Date()}
              onConfirm={date => {
                setOpenDatePicker(false);
                setDate(date);
              }}
              onCancel={() => {
                setOpenDatePicker(false);
              }}
            />
            {/* Blok 2: Keterangan */}
            <View style={styles.inputBlock}>
              <Text style={styles.label}>Keterangan</Text>
              <TextInput
                style={styles.input}
                placeholder="(Opsional)"
                value={keterangan}
                onChangeText={setKeterangan}
              />
            </View>
          </View>
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.barcode}-${index}`}
          extraData={{scanMode, permintaan}}
          style={styles.list}
          ListHeaderComponent={
            <View style={styles.scanSection}>
              {!isLowStockMode && (
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
                      scanMode === 'permintaan' && styles.modeButtonActive,
                    ]}
                    onPress={() => handleChangeMode('permintaan')}>
                    <Text
                      style={[
                        styles.modeButtonText,
                        scanMode === 'permintaan' &&
                          styles.modeButtonTextActive,
                      ]}>
                      Scan Barang
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.rowContainer}>
                {/* --- SEMBUNYIKAN TOMBOL PERMINTAAN JIKA LOW STOCK MODE --- */}
                {scanMode === 'permintaan' && !isLowStockMode && (
                  <View style={styles.inputBlock}>
                    <Text style={styles.label}>Nomor Permintaan</Text>
                    <TouchableOpacity
                      style={[
                        styles.lookupButton,
                        !store && styles.lookupButtonDisabled,
                      ]}
                      onPress={() => setPermintaanModalVisible(true)}
                      disabled={!store}>
                      <Icon
                        name="file-text"
                        size={20}
                        color={permintaan ? '#D32F2F' : '#757575'}
                      />
                      <Text style={styles.lookupText} numberOfLines={1}>
                        {permintaan ? permintaan.nomor : 'Pilih...'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Blok 2: Input Scan */}
                <View
                  style={[
                    styles.inputBlock,
                    scanMode === 'packing' && styles.inputBlockFullWidth, // Buat input scan packing jadi lebar penuh
                  ]}>
                  <Text style={styles.label}>
                    {scanMode === 'packing' ? 'Scan Packing' : 'Scan Barang'}
                  </Text>
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
                      editable={
                        scanMode === 'packing'
                          ? !!store
                          : !!permintaan || !!store
                      }
                      placeholderTextColor="#A0AEC0"
                      blurOnSubmit={false}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.listTitle}>Item yang Akan Dikirim</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Silakan pilih mode dan muat data.
            </Text>
          }
        />
        <View style={styles.footerContainer}>
          {items.length > 0 && (
            <View style={styles.summaryContainer}>
              {/* Tampilan Summary untuk Mode Load Permintaan */}
              {scanMode === 'permintaan' ? (
                <>
                  <Text style={styles.summaryText}>
                    Item Selesai:{' '}
                    <Text style={styles.summaryValue}>
                      {summary.itemSelesai} / {summary.totalJenis}
                    </Text>
                  </Text>
                  <Text style={styles.summaryText}>
                    Total Qty:{' '}
                    <Text style={styles.summaryValue}>
                      {summary.totalScan} / {summary.totalKirim}
                    </Text>
                  </Text>
                </>
              ) : (
                /* Tampilan Summary untuk Mode Scan Packing (satu baris) */
                <Text
                  style={[
                    styles.summaryText,
                    {textAlign: 'center', width: '100%'},
                  ]}>
                  Total Jenis Item:{' '}
                  <Text style={styles.summaryValue}>{summary.totalJenis}</Text>{' '}
                  | Total Qty Scan:{' '}
                  <Text style={styles.summaryValue}>{summary.totalScan}</Text>
                </Text>
              )}
            </View>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
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
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  inputBlock: {flex: 1},
  inputBlockFullWidth: {flex: 2},
  label: {fontSize: 12, color: '#616161', marginBottom: 4, paddingLeft: 4},

  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
    gap: 10,
  },
  dateText: {fontSize: 14, color: '#212121', fontWeight: '500'},

  lookupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  lookupButtonDisabled: {backgroundColor: '#E0E0E0'},
  lookupText: {flex: 1, fontSize: 14, marginHorizontal: 8, color: '#757575'},
  lookupTextSelected: {color: '#212121', fontWeight: '600'},

  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#212121',
  },

  list: {flex: 1},
  scanSection: {paddingHorizontal: 16, paddingTop: 16, marginBottom: 10},
  modeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
  },
  modeButton: {flex: 1, padding: 10, alignItems: 'center', borderRadius: 6},
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modeButtonText: {fontWeight: '600', color: '#616161'},
  modeButtonTextActive: {color: '#D32F2F'},

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 44,
  },
  inputIcon: {paddingLeft: 12},
  scanInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    paddingHorizontal: 10,
    color: '#1A202C',
  },

  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 10,
  },

  // STYLE UNTUK ITEM YANG LEBIH RAPI & HIGHLIGHT
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemMatched: {backgroundColor: '#E8F5E9'},
  itemHasQty: {backgroundColor: '#F1F8E9'},
  itemLastScanned: {
    backgroundColor: '#DCEDC8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },

  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontSize: 16, fontWeight: '600', color: '#212121'},
  itemDetails: {color: '#666', marginTop: 4},

  qtyContainer: {alignItems: 'flex-end', minWidth: 100},
  qtyLabel: {color: '#888', fontSize: 12, marginBottom: 4},
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
    gap: 8,
  },
  qtyButton: {padding: 4},
  qtyValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
    minWidth: 30,
    textAlign: 'center',
  },

  emptyText: {textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16},

  footerContainer: {
    padding: 16,
    paddingTop: 10, // -> Padding atas diperkecil
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryText: {
    fontSize: 14,
    color: '#616161',
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#212121',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#D32F2F',
    padding: 14, // -> Diperkecil dari 16
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
});
export default SuratJalanScreen;
