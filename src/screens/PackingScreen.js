import React, {
  useState,
  useContext,
  useEffect,
  useMemo,
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  Alert,
  Modal,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../context/AuthContext';
import {
  validateBarcodeApi,
  savePackingApi,
  searchSpkByBarcodeApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

// Mengaktifkan LayoutAnimation untuk Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PackingScreen = ({navigation}) => {
  const {userToken, userInfo} = useContext(AuthContext);

  const barcodeInputRef = useRef(null);

  // State utama
  const [selectedSpk, setSelectedSpk] = useState(null);
  const [items, setItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');

  // State untuk UI feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [highlightedBarcode, setHighlightedBarcode] = useState(null);

  // State untuk Modal Pemilihan SPK
  const [isSpkModalVisible, setSpkModalVisible] = useState(false);
  const [spkOptions, setSpkOptions] = useState([]);
  const [initialBarcode, setInitialBarcode] = useState(null);

  const playSound = useCallback(type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('Tidak bisa memutar suara', e);
    }
  }, []);

  // Menghitung total kuantitas
  const totalQty = useMemo(() => {
    // Pastikan item.qty adalah angka sebelum dijumlahkan
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [items]);

  // Efek untuk menghilangkan highlight item baru
  useEffect(() => {
    if (highlightedBarcode) {
      const timer = setTimeout(() => setHighlightedBarcode(null), 700);
      return () => clearTimeout(timer);
    }
  }, [highlightedBarcode]);

  // --- FUNGSI RESET ---
  const handleReset = useCallback(() => {
    Alert.alert(
      'Kosongkan Form?',
      'Semua item yang sudah di-scan akan dihapus. Anda yakin ingin mengulang dari awal?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Kosongkan',
          onPress: () => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            setItems([]);
            setSelectedSpk(null);
            setScannedBarcode('');
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

  // --- LOGIKA INTI ---

  const validateAndAddItem = useCallback(
    async (barcode, spk) => {
      if (!spk) {
        setTimeout(() => barcodeInputRef.current?.focus(), 0);
        return;
      }

      try {
        const gudang = userInfo.cabang;
        const response = await validateBarcodeApi(
          barcode,
          gudang,
          userToken,
          spk.spkd_nomor,
        );
        const product = response.data.data;

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        // ✅ PERUBAHAN UTAMA: Gunakan functional update
        setItems(prevItems => {
          const existingItemIndex = prevItems.findIndex(
            item => item.barcode === barcode,
          );

          if (existingItemIndex > -1) {
            const newItems = [...prevItems];
            newItems[existingItemIndex].qty =
              (Number(newItems[existingItemIndex].qty) || 0) + 1;
            return newItems;
          } else {
            const newItem = {
              barcode: product.barcode,
              kode: product.kode,
              nama: product.nama,
              ukuran: product.ukuran,
              stok: product.stok,
              qty: 1,
            };
            return [newItem, ...prevItems];
          }
        });

        setHighlightedBarcode(barcode);
        playSound('success');
      } catch (error) {
        const message = error.response?.data?.message || 'Barcode tidak valid.';
        Toast.show({type: 'error', text1: 'Error Barcode', text2: message});
        playSound('error');
      }

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 0);
    },
    [userInfo.cabang, userToken, playSound], // ✅ Dependency disederhanakan
  );

  const handleSelectSpk = useCallback(
    async (spk, barcodeToProcess) => {
      // Jika sudah ada SPK terpilih, abaikan pemilihan baru
      if (selectedSpk) {
        Toast.show({
          type: 'info',
          text1: 'SPK Terkunci',
          text2: `Sudah terkunci di ${selectedSpk.spkd_nomor}. Gunakan tombol Reset untuk ganti.`,
        });
        setSpkModalVisible(false);
        barcodeInputRef.current?.focus();
        return;
      }

      // SPK pertama kali dipilih → kunci di sini
      setSelectedSpk(spk);
      setSpkModalVisible(false);
      Toast.show({type: 'info', text1: 'SPK Dipilih', text2: spk.spkd_nomor});

      // PERBAIKAN: Validasi ulang barcode pertama dengan SPK yang dipilih
      if (barcodeToProcess) {
        try {
          await validateAndAddItem(barcodeToProcess, spk);
        } catch (error) {
          console.log(
            '   ❌ Error saat validasi barcode pertama:',
            error.message,
          );
        }
      } else {
        barcodeInputRef.current?.focus();
      }
    },
    [validateAndAddItem, selectedSpk],
  );

  const handleBarcodeScan = useCallback(async () => {
    if (!scannedBarcode || isScanning) return;

    // 1. TRIM SPASI DAN HAPUS NOL DI DEPAN
    const barcode = scannedBarcode.trim().replace(/^0+/, '');

    setScannedBarcode('');
    setIsScanning(true);

    try {
      if (!selectedSpk) {
        // --- Alur Scan Pertama: Pilih SPK dulu ---
        const response = await searchSpkByBarcodeApi(barcode, userToken);
        const spkData = response.data.data.items;

        if (spkData.length === 0) {
          Toast.show({
            type: 'error',
            text1: 'Tidak Ditemukan',
            text2: 'Tidak ada SPK yang terkait dengan barcode ini.',
          });
          playSound('error');
          return;
        }

        if (spkData.length === 1) {
          // Pilih otomatis jika cuma satu
          handleSelectSpk(spkData[0], barcode);
        } else {
          // Jika lebih dari satu → tampilkan pilihan
          setSpkOptions(spkData);
          setInitialBarcode(barcode);
          setSpkModalVisible(true);
        }
      } else {
        // --- Alur Scan Berikutnya ---
        // Pakai SPK yang sudah terkunci, tanpa buka modal lagi
        await validateAndAddItem(barcode, selectedSpk);
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Terjadi kesalahan saat memproses barcode.';
      Toast.show({type: 'error', text1: 'Error', text2: message});
      playSound('error');
    } finally {
      setIsScanning(false);
      setTimeout(() => {
        barcodeInputRef.current?.blur();
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [
    scannedBarcode,
    isScanning,
    selectedSpk,
    userToken,
    handleSelectSpk,
    validateAndAddItem,
    playSound,
  ]);

  const handleDeleteItem = useCallback(itemToDelete => {
    Alert.alert(
      'Hapus Item',
      `Yakin ingin menghapus "${itemToDelete.nama}" (${itemToDelete.ukuran})?`,
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
  }, []);

  const handleSavePacking = useCallback(async () => {
    if (items.length === 0 || !selectedSpk) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Scan barang dan pilih SPK terlebih dahulu.',
      });
      return;
    }
    Alert.alert(
      'Konfirmasi Simpan',
      `Simpan packing untuk SPK ${selectedSpk.spkd_nomor}?`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Simpan',
          onPress: async () => {
            setIsSaving(true);
            try {
              const dataToSave = {
                spk_nomor: selectedSpk.spkd_nomor,
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
              navigation.goBack();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Gagal Menyimpan',
                text2: error.response?.data?.message || 'Gagal menyimpan data.',
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  }, [items, selectedSpk, userToken, navigation]);

  const renderItem = ({item}) => (
    <View
      style={[
        styles.itemContainer,
        item.barcode === highlightedBarcode && styles.highlightedItem,
      ]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.nama}</Text>
        <Text style={styles.itemDetails}>
          Size: {item.ukuran} | Stok: {item.stok}
        </Text>
      </View>
      <Text style={styles.itemQty}>x {item.qty}</Text>
      <TouchableOpacity
        onPress={() => handleDeleteItem(item)}
        style={styles.deleteButton}>
        <Icon name="trash-2" size={20} color="#D32F2F" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar barStyle="dark-content" />

      <Modal
        transparent={true}
        visible={isSpkModalVisible}
        onRequestClose={() => setSpkModalVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Pilih SPK Terkait</Text>
            <FlatList
              data={spkOptions}
              keyExtractor={item => item.spkd_nomor}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.spkItem}
                  onPress={() => handleSelectSpk(item, initialBarcode)}>
                  <View style={styles.spkRow}>
                    <Text style={styles.spkNomor}>{item.spkd_nomor}</Text>
                    <Text style={styles.spkQty}>Qty: {item.qty_order}</Text>
                  </View>
                  <Text style={styles.spkNama}>{item.spk_nama}</Text>
                  <Text style={styles.spkTanggal}>
                    Tanggal:{' '}
                    {new Date(item.spk_tanggal).toLocaleDateString('id-ID')}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.label}>Nomor SPK</Text>
          <TouchableOpacity style={styles.lookupButton} disabled={true}>
            <Icon
              name="file-text"
              size={20}
              color={selectedSpk ? '#D32F2F' : '#757575'}
            />
            <Text
              style={[
                styles.lookupText,
                selectedSpk && styles.lookupTextSelected,
              ]}>
              {selectedSpk
                ? `${selectedSpk.spkd_nomor} - ${selectedSpk.spk_nama}`
                : 'Scan barang pertama untuk memilih'}
            </Text>
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <Icon
              name="cpu"
              size={20}
              color="#A0AEC0"
              style={styles.inputIcon}
            />
            <TextInput
              ref={barcodeInputRef} // -> Hubungkan ref ke TextInput
              style={styles.input}
              placeholder={
                selectedSpk
                  ? 'Scan barang berikutnya...'
                  : 'Scan barang pertama...'
              }
              value={scannedBarcode}
              onChangeText={setScannedBarcode}
              onSubmitEditing={handleBarcodeScan}
              blurOnSubmit={false}
              autoFocus={true}
              placeholderTextColor="#A0AEC0"
              editable={!isScanning}
            />
          </View>
        </View>

        <View style={styles.divider} />

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
              <Text style={styles.emptyText}>Belum ada item.</Text>
              <Text style={styles.emptySubText}>Silakan scan barcode.</Text>
            </View>
          }
        />
        <View style={styles.footerContainer}>
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>Total Barang:</Text>
            <Text style={styles.summaryValue}>{totalQty} Pcs</Text>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={handleSavePacking}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Simpan Packing ({items.length} jenis)
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
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  label: {fontSize: 14, color: '#757575', marginBottom: 6, marginLeft: 4},
  lookupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BDBDBD',
    marginBottom: 12,
  },
  lookupText: {
    flex: 1,
    fontSize: 16,
    marginHorizontal: 10,
    color: '#757575',
    lineHeight: 22,
  },
  divider: {
    height: 10,
    backgroundColor: '#F4F6F8', // Warna sama dengan background utama
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  lookupTextSelected: {color: '#212121', fontWeight: '600'},
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: {paddingLeft: 12},
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    paddingHorizontal: 12,
    color: '#212121',
  },
  list: {flex: 1, paddingHorizontal: 16},
  listHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
    marginBottom: 10,
  },
  itemContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  highlightedItem: {backgroundColor: '#E8F5E9', borderColor: '#A5D6A7'},
  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontSize: 16, fontWeight: '600', color: '#212121'},
  itemDetails: {fontSize: 12, color: '#757575', marginTop: 4},
  itemQty: {fontSize: 18, fontWeight: 'bold', color: '#212121'},
  deleteButton: {marginLeft: 15, padding: 5},
  emptyContainer: {alignItems: 'center', paddingVertical: 80},
  emptyText: {fontSize: 16, fontWeight: '600', color: '#757575'},
  emptySubText: {fontSize: 14, color: '#BDBDBD', marginTop: 4},
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {fontSize: 16, color: '#616161', fontWeight: '600'},
  summaryValue: {fontSize: 20, color: '#212121', fontWeight: 'bold'},
  button: {
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '60%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  spkItem: {padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee'},
  spkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  spkNomor: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121', // Pastikan warna ada
  },
  spkQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D32F2F', // Beri warna merah agar menonjol
  },
  spkNama: {fontSize: 14, color: '#666'},
  spkTanggal: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default PackingScreen;
