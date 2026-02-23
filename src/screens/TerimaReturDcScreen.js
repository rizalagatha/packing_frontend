import React, {useState, useContext, useRef, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Vibration,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  searchReturToReceiveApi,
  loadReturDetailApi,
  savePendingReturDcApi,
  saveTerimaReturDcApi,
} from '../api/ApiService'; // Cleanup: savePendingReturDcApi dihapus
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

// Aktifkan animasi untuk Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TerimaReturDcScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [header, setHeader] = useState(null);
  const [items, setItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lastScannedKey, setLastScannedKey] = useState(null);

  const scannerInputRef = useRef(null);

  // --- LOGIKA RINGKASAN ---
  const summary = useMemo(() => {
    const totalJenis = items.length;
    const totalKirim = items.reduce(
      (sum, i) => sum + (Number(i.jumlahKirim) || 0),
      0,
    );
    const totalTerima = items.reduce(
      (sum, i) => sum + (Number(i.jumlahTerima) || 0),
      0,
    );
    const itemSelesai = items.filter(
      i => i.jumlahTerima === i.jumlahKirim && i.jumlahKirim > 0,
    ).length;
    return {totalJenis, totalKirim, totalTerima, itemSelesai};
  }, [items]);

  // --- HANDLER LOAD DATA ---
  const handleSelectRetur = async selected => {
    setIsLoading(true);
    setIsModalVisible(false);
    try {
      const res = await loadReturDetailApi(selected.nomor, userToken);
      setHeader(res.data.data.header);

      // PERBAIKAN DI SINI:
      // Jangan dipaksa jadi 0. Pakai nilai jumlahTerima dari server (jika ada data pending)
      const mappedItems = res.data.data.items.map(item => ({
        ...item,
        jumlahTerima: item.jumlahTerima || 0,
      }));

      setItems(mappedItems);

      // Info jika ada data pending yang dimuat
      const totalSudahScan = mappedItems.reduce(
        (s, i) => s + i.jumlahTerima,
        0,
      );
      if (totalSudahScan > 0) {
        Toast.show({
          type: 'info',
          text1: 'Data Pending Dimuat',
          text2: `Melanjutkan ${totalSudahScan} barang yang sudah discan.`,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Data retur tidak ditemukan.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const keyExtractor = useCallback(item => `${item.kode}-${item.ukuran}`, []);

  // --- LOGIKA SCAN BARCODE ---
  const handleBarcodeScan = () => {
    if (!scannedBarcode || isSaving) return;

    const cleanBarcode = scannedBarcode.trim();
    const itemIndex = items.findIndex(i => i.barcode === cleanBarcode);

    if (itemIndex > -1) {
      const newItems = JSON.parse(JSON.stringify(items)); // Deep copy sederhana agar aman
      const target = newItems[itemIndex];

      if (target.jumlahTerima < target.jumlahKirim) {
        // 1. Update Qty
        target.jumlahTerima += 1;

        // 2. LOGIKA PINDAH KE ATAS
        // Hapus item dari posisi lamanya
        newItems.splice(itemIndex, 1);
        // Masukkan item ke posisi paling depan (index 0)
        newItems.unshift(target);

        const uniqueKey = `${target.barcode}-${target.ukuran}`;
        setLastScannedKey(uniqueKey);

        if (Platform.OS === 'android') {
          LayoutAnimation.configureNext(
            LayoutAnimation.create(300, 'easeInEaseOut', 'opacity'),
          );
        } else {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
        }

        setItems(newItems);
        playSound('success');
        Vibration.vibrate(70);

        setTimeout(() => setLastScannedKey(null), 1500);
      } else {
        Toast.show({
          type: 'info',
          text1: 'Sudah Cukup',
          text2: 'Qty terima sudah maksimal.',
        });
        playSound('error');
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Salah Barang',
        text2: `Barcode ${cleanBarcode} tidak ada dalam list.`,
      });
      playSound('error');
    }

    setScannedBarcode('');
    setTimeout(() => scannerInputRef.current?.focus(), 200);
  };

  const playSound = type => {
    try {
      const sound = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(sound, 'mp3');
    } catch (e) {
      console.log(e);
    }
  };

  // --- HANDLER SAVE FINAL ---
  const handleSave = async isFinal => {
    if (!header) return;

    const actionText = isFinal
      ? 'Simpan Final (Stok Bertambah)'
      : 'Simpan Pending (Draft)';

    Alert.alert('Konfirmasi', `${actionText} penerimaan retur ini?`, [
      {text: 'Batal', style: 'cancel'},
      {
        text: 'Ya, Lanjut',
        onPress: async () => {
          setIsSaving(true);
          try {
            const payload = {
              header: {
                ...header,
                tanggal: new Date().toISOString().split('T')[0],
              },
              items: items,
            };

            // Panggil API sesuai tombol yang diklik
            const apiCall = isFinal
              ? saveTerimaReturDcApi
              : savePendingReturDcApi;
            const res = await apiCall(payload, userToken);

            Toast.show({
              type: 'success',
              text1: 'Berhasil',
              text2: res.data.message,
            });

            // Jika final, kembali ke dashboard. Jika pending, tetap di sini atau kembali (sesuai selera).
            if (isFinal) navigation.goBack();
          } catch (error) {
            Alert.alert(
              'Gagal',
              error.response?.data?.message || 'Terjadi kesalahan.',
            );
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  // --- HANDLER SAVE FINAL DENGAN LOGGING DETAIL ---
  const handleSaveFinal = async () => {
    if (!header) return;

    Alert.alert('Konfirmasi', 'Simpan Final penerimaan retur ini?', [
      {text: 'Batal', style: 'cancel'},
      {
        text: 'Ya, Simpan',
        onPress: async () => {
          setIsSaving(true);

          const payload = {
            header: {
              ...header,
              tanggal: new Date().toISOString().split('T')[0],
            },
            items: items,
          };

          // 1. LOG DATA YANG DIKIRIM (Cek di Terminal VSCode/Metro)
          console.log('📤 [DEBUG] SENDING PAYLOAD TO SERVER:');
          console.log(JSON.stringify(payload, null, 2));

          try {
            const res = await saveTerimaReturDcApi(payload, userToken);

            // 2. LOG RESPON SUKSES
            console.log('📥 [DEBUG] SERVER RESPONSE SUCCESS:', res.data);

            Toast.show({
              type: 'success',
              text1: 'Berhasil',
              text2: res.data.message,
            });
            navigation.goBack();
          } catch (error) {
            // 3. LOG ERROR DETAIL (Sangat Penting!)
            console.error('❌ [DEBUG] SAVE ERROR DETECTED:');

            if (error.response) {
              // Server merespon dengan status code selain 2xx
              console.error('Data Error dari Server:', error.response.data);
              console.error('Status Code Server:', error.response.status);
              console.error('Headers Server:', error.response.headers);

              const serverMsg =
                error.response.data?.message ||
                'Terjadi kesalahan pada logika server.';
              Alert.alert(
                'Gagal Simpan (Server)',
                `Status: ${error.response.status}\nMessage: ${serverMsg}`,
              );
            } else if (error.request) {
              // Request dikirim tapi tidak ada respon (Timeout / Salah IP / Payload Kebesaran)
              console.error(
                'Tidak ada respon dari server. Cek koneksi atau limit payload.',
              );
              Alert.alert(
                'Gagal Simpan (Network)',
                'Server tidak merespon. Payload mungkin terlalu besar atau koneksi terputus.',
              );
            } else {
              // Ada kesalahan saat menyusun request
              console.error('Error Setup Request:', error.message);
              Alert.alert('Gagal Simpan (Request)', error.message);
            }
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const renderItem = ({item}) => {
    // Cek apakah item ini yang baru saja discan
    const isHighlighted = `${item.barcode}-${item.ukuran}` === lastScannedKey;

    return (
      <View
        style={[
          styles.itemCard,
          isHighlighted && styles.itemCardHighlight, // <--- Pakai style highlight jika true
        ]}>
        <View style={{flex: 1}}>
          <Text style={[styles.itemName, isHighlighted && {color: '#2E7D32'}]}>
            {item.nama}
          </Text>
          <Text style={styles.itemSub}>
            {item.ukuran} | {item.barcode}
          </Text>
        </View>
        <View style={styles.qtyBox}>
          <Text style={styles.qtyLabel}>Kirim: {item.jumlahKirim}</Text>
          <Text style={[styles.qtyValue, isHighlighted && {color: '#2E7D32'}]}>
            {item.jumlahTerima}
          </Text>
          <Text
            style={[
              styles.qtyDiff,
              {
                color:
                  item.jumlahKirim - item.jumlahTerima === 0
                    ? '#4CAF50'
                    : '#D32F2F',
              },
            ]}>
            Sls: {item.jumlahTerima - item.jumlahKirim}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* SEARCH SECTION */}
      <View style={styles.searchHeader}>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setIsModalVisible(true)}>
          <Icon name="search" size={18} color="#1565C0" />
          <Text style={styles.selectorText}>
            {header ? header.nomorRb : 'Pilih Nomor Retur Store...'}
          </Text>
        </TouchableOpacity>
        {header && (
          <Text style={styles.sourceInfo}>
            Gudang Asal: {header.gudangAsalNama} ({header.gudangAsalKode})
          </Text>
        )}
      </View>

      {/* SCAN INPUT */}
      <View style={styles.scanWrapper}>
        <TextInput
          ref={scannerInputRef}
          style={styles.scanInput}
          placeholder="Scan Barcode Barang..."
          value={scannedBarcode}
          onChangeText={setScannedBarcode}
          onSubmitEditing={handleBarcodeScan}
          autoFocus={true}
          showSoftInputOnFocus={false}
        />
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        removeClippedSubviews={true} // Hapus item yang tidak terlihat di layar dari memori
        maxToRenderPerBatch={10} // Jangan render semua sekaligus
        initialNumToRender={12}
        windowSize={5}
        contentContainerStyle={{paddingBottom: 100}}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Silakan pilih dokumen retur di atas.
          </Text>
        }
      />

      {/* FOOTER SUMMARY & ACTIONS */}
      {header && (
        <View style={styles.footer}>
          <View style={styles.summaryRow}>
            <Text style={styles.sumText}>
              Item:{' '}
              <Text style={styles.bold}>
                {summary.itemSelesai}/{summary.totalJenis}
              </Text>
            </Text>
            <Text style={styles.sumText}>
              Total Qty:{' '}
              <Text style={styles.bold}>
                {summary.totalTerima}/{summary.totalKirim}
              </Text>
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPending]}
              onPress={() => handleSave(false)} // Simpan Pending
              disabled={isSaving}>
              <Text style={styles.btnText}>PENDING</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnFinal]}
              onPress={() => handleSave(true)} // Simpan Final
              disabled={isSaving}>
              <Text style={styles.btnText}>SIMPAN FINAL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <SearchModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelect={handleSelectRetur}
        title="Cari Retur Store"
        // UBAH BAGIAN INI
        apiSearchFunction={async params => {
          const res = await searchReturToReceiveApi(params, userToken);

          // Kita bungkus datanya agar SearchModal bisa membaca field 'items'
          return {
            data: {
              data: {
                items: res.data.data, // res.data.data adalah array dari log Abang tadi
              },
            },
          };
        }}
        keyField="nomor"
        renderListItem={item => (
          <View style={{paddingVertical: 5}}>
            <Text style={{fontWeight: 'bold', color: '#333', fontSize: 15}}>
              {item.nomor}
            </Text>
            <View style={{flexDirection: 'row', marginTop: 4}}>
              <Text style={{fontSize: 12, color: '#666'}}>
                {new Date(item.tanggal).toLocaleDateString('id-ID')}
              </Text>
              <Text style={{fontSize: 12, color: '#666', marginHorizontal: 5}}>
                |
              </Text>
              <Text style={{fontSize: 12, color: '#1565C0', fontWeight: '600'}}>
                {item.gudang_asal}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  searchHeader: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  selectorText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#1565C0',
    fontWeight: 'bold',
  },
  sourceInfo: {marginTop: 8, fontSize: 12, color: '#666', fontStyle: 'italic'},
  scanWrapper: {padding: 16},
  scanInput: {
    backgroundColor: '#fff',
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  itemCard: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
  },
  itemName: {fontSize: 14, fontWeight: 'bold', color: '#333'},
  itemSub: {fontSize: 12, color: '#666', marginTop: 2},
  qtyBox: {alignItems: 'flex-end', minWidth: 80},
  qtyLabel: {fontSize: 10, color: '#999'},
  qtyValue: {fontSize: 20, fontWeight: 'bold', color: '#1565C0'},
  qtyDiff: {fontSize: 11, fontWeight: 'bold'},
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#eee',
    elevation: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sumText: {fontSize: 13, color: '#666'},
  bold: {fontWeight: 'bold', color: '#333'},
  buttonRow: {flexDirection: 'row'},
  btn: {flex: 1, padding: 15, borderRadius: 8, alignItems: 'center'},
  btnPending: {
    backgroundColor: '#FFA000', // Warna Oranye
    marginRight: 10, // Kasih jarak dengan tombol sebelah
  },
  btnFinal: {
    backgroundColor: '#1976D2',
  },
  btnText: {color: '#fff', fontWeight: 'bold'},
  emptyText: {textAlign: 'center', marginTop: 50, color: '#999'},
  itemCardHighlight: {
    backgroundColor: '#E8F5E9', // Hijau muda segar
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50', // Garis hijau tebal di samping
    borderColor: '#4CAF50',
    elevation: 5, // Biar agak "angkat" sedikit saat discan
  },
});

export default TerimaReturDcScreen;
