import React, {
  useState,
  useContext,
  useRef,
  useMemo,
  useLayoutEffect,
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
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  searchSjToReceiveApi,
  loadSjToReceiveApi,
  saveTerimaSjApi,
  savePendingSjApi,
  searchPendingSjApi,
  loadPendingSjApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const TerimaSjScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [sjHeader, setSjHeader] = useState(null);
  const [items, setItems] = useState([]);
  const [pendingData, setPendingData] = useState(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('SJ');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const scannerInputRef = useRef(null);

  const totalJenisItem = useMemo(() => items.length, [items]);

  const totalJumlahTerima = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (Number(item.jumlahTerima) || 0),
      0,
    );
  }, [items]);

  const totalSelisih = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (item.jumlahKirim - item.jumlahTerima),
      0,
    );
  }, [items]);

  const summary = useMemo(() => {
    const totalJenis = items.length;
    const totalKirim = items.reduce(
      (sum, item) => sum + (Number(item.jumlahKirim) || 0),
      0,
    );
    const totalTerima = items.reduce(
      (sum, item) => sum + (Number(item.jumlahTerima) || 0),
      0,
    );
    const itemSelesai = items.filter(
      item => item.jumlahTerima === item.jumlahKirim,
    ).length;

    return {totalJenis, totalKirim, totalTerima, itemSelesai};
  }, [items]);

  // Fungsi saat user memilih SJ dari modal pencarian
  const handleSelectSj = useCallback(
    async selectedSj => {
      setIsLoadingData(true);
      try {
        const response = await loadSjToReceiveApi(selectedSj.nomor, userToken);
        setSjHeader(response.data.data.header);
        const itemsWithReceiveQty = response.data.data.items.map(item => ({
          ...item,
          jumlahTerima: 0,
        }));
        setItems(itemsWithReceiveQty);
        setPendingData(null); // Reset pending data jika memuat SJ baru
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal Memuat',
          text2: 'Gagal memuat detail Surat Jalan.',
        });
      } finally {
        setIsLoadingData(false);
      }
    },
    [userToken],
  );

  const handleSelectPending = useCallback(
    async selectedPending => {
      setIsLoadingData(true);
      try {
        const response = await loadPendingSjApi(
          selectedPending.nomor,
          userToken,
        );
        setSjHeader(response.data.data.header);
        setItems(response.data.data.items);
        setPendingData({nomor: response.data.data.pendingNomor});
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal Memuat',
          text2: 'Gagal memuat data pending.',
        });
      } finally {
        setIsLoadingData(false);
      }
    },
    [userToken],
  );

  const handleRefresh = useCallback(async () => {
    if (!pendingData && !sjHeader) {
      Toast.show({
        type: 'info',
        text1: 'Info',
        text2: 'Tidak ada data untuk di-refresh.',
      });
      return;
    }

    Alert.alert('Pilih Aksi', 'Apa yang ingin Anda lakukan?', [
      {
        text: 'Batal',
        style: 'cancel',
      },
      {
        text: 'Kosongkan Data',
        onPress: () => {
          setSjHeader(null);
          setItems([]);
          setPendingData(null);
          setScannedBarcode('');
          Toast.show({
            type: 'success',
            text1: 'Berhasil',
            text2: 'Data berhasil dikosongkan.',
          });
        },
        style: 'destructive',
      },
      {
        text: 'Muat Ulang',
        onPress: async () => {
          Toast.show({type: 'info', text1: 'Memuat ulang data...'});
          if (pendingData) {
            await handleSelectPending({nomor: pendingData.nomor});
          } else if (sjHeader) {
            await handleSelectSj({nomor: sjHeader.sj_nomor});
          }
        },
      },
    ]);
  }, [pendingData, sjHeader, handleSelectPending, handleSelectSj]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleRefresh} style={{marginRight: 15}}>
          <Icon name="refresh-cw" size={24} color="#616161" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleRefresh]);

  // Fungsi saat user scan barcode barang
  const handleBarcodeScan = () => {
    if (!scannedBarcode) return;
    const barcodeToFind = scannedBarcode;

    const itemIndex = items.findIndex(item => item.barcode === barcodeToFind);

    if (itemIndex > -1) {
      const newItems = [...items];
      const currentItem = newItems[itemIndex];
      if (currentItem.jumlahTerima < currentItem.jumlahKirim) {
        currentItem.jumlahTerima += 1;
        setItems(newItems);
        Toast.show({
          type: 'success',
          text1: `Scan Berhasil`,
          text2: `${currentItem.nama}`,
        });
        playSound('success');
      } else {
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'Jumlah terima sudah sesuai.',
        });
        playSound('error');
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Barcode tidak ada di Surat Jalan ini.',
      });
      playSound('error');
    }

    setScannedBarcode('');

    // Gunakan trik blur/focus untuk hasil paling andal
    setTimeout(() => {
      scannerInputRef.current?.blur();
      scannerInputRef.current?.focus();
    }, 100);
  };

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log(`Tidak bisa memutar suara`, e);
    }
  };

  // Fungsi untuk membuka modal pencarian SJ baru
  const openSjSearch = () => {
    setModalMode('SJ');
    setIsModalVisible(true);
  };

  // Fungsi untuk membuka modal pencarian data pending
  const openPendingSearch = () => {
    setModalMode('PENDING');
    setIsModalVisible(true);
  };

  // Fungsi untuk menyimpan data penerimaan
  const handleSaveFinal = async () => {
    Alert.alert(
      'Konfirmasi Simpan Final',
      'Anda yakin ingin menyimpan penerimaan ini secara final?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Simpan Final',
          onPress: async () => {
            setIsSaving(true);
            try {
              const payload = {
                header: {
                  tanggalTerima: new Date().toISOString().split('T')[0],
                  nomorMinta: sjHeader.sj_mt_nomor,
                  nomorSj: sjHeader.sj_nomor,
                  nomorPending: pendingData ? pendingData.nomor : null,
                },
                items: items,
              };
              const response = await saveTerimaSjApi(payload, userToken);
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

  const handleSavePending = async () => {
    // Validasi awal
    if (!sjHeader || items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Data Tidak Lengkap',
        text2: 'Pilih Surat Jalan terlebih dahulu.',
      });
      return;
    }

    // Hitung total untuk pesan konfirmasi
    const totalKirim = items.reduce((sum, item) => sum + item.jumlahKirim, 0);
    const totalTerima = items.reduce((sum, item) => sum + item.jumlahTerima, 0);
    const selisih = totalKirim - totalTerima;

    // Pesan konfirmasi
    const pesanKonfirmasi = `Anda akan menyimpan sebagai pending untuk SJ ${sjHeader.sj_nomor}\n\nTotal Kirim: ${totalKirim} pcs\nTotal Terima: ${totalTerima} pcs\nSelisih: ${selisih} pcs\n\nLanjutkan?`;

    Alert.alert('Konfirmasi Simpan Pending', pesanKonfirmasi, [
      {
        text: 'Batal',
        style: 'cancel',
      },
      {
        text: 'Ya, Simpan',
        onPress: async () => {
          setIsSaving(true);
          try {
            const payload = {
              header: {
                tanggalTerima: new Date().toISOString().split('T')[0],
                nomorSj: sjHeader.sj_nomor,
              },
              items: items,
              pending_nomor: pendingData ? pendingData.nomor : null,
            };

            const response = await savePendingSjApi(payload, userToken);

            Toast.show({
              type: 'success',
              text1: 'Sukses',
              text2: response.data.message,
            });
            navigation.goBack();
          } catch (error) {
            const message =
              error.response?.data?.message || 'Gagal menyimpan data pending.';
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
    ]);
  };

  const renderItem = ({item}) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text selectable={true} style={styles.itemName}>
          {item.nama}
        </Text>
        <Text style={styles.itemDetails}>
          Size: {item.ukuran} | Barcode: {item.barcode}
        </Text>
      </View>
      <View style={styles.qtyContainer}>
        <Text style={styles.qtyLabel}>Kirim: {item.jumlahKirim}</Text>
        <Text style={styles.qtyValue}>{item.jumlahTerima}</Text>
        <Text
          style={[
            styles.qtyLabel,
            {
              color:
                item.jumlahKirim - item.jumlahTerima !== 0
                  ? '#D32F2F'
                  : '#4CAF50',
            },
          ]}>
          Selisih: {item.jumlahKirim - item.jumlahTerima}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SearchModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelect={modalMode === 'SJ' ? handleSelectSj : handleSelectPending}
        title={
          modalMode === 'SJ' ? 'Cari Surat Jalan' : 'Cari Penerimaan Pending'
        }
        apiSearchFunction={
          modalMode === 'SJ'
            ? params => searchSjToReceiveApi(params, userToken)
            : params => searchPendingSjApi(params, userToken)
        }
        keyField="nomor"
        renderListItem={item => (
          <View>
            <Text style={styles.itemKode}>{item.nomor}</Text>
            <Text style={styles.itemNama}>
              No. SJ: {item.sj_nomor} - Tgl:{' '}
              {new Date(item.tanggal).toLocaleDateString('id-ID')}
            </Text>
          </View>
        )}
      />

      <View style={styles.headerForm}>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity
            style={[styles.lookupButton, {flex: 1}]}
            onPress={() => {
              setModalMode('SJ');
              setIsModalVisible(true);
            }}
            disabled={!!pendingData}>
            <Icon
              name="search"
              size={20}
              color={sjHeader ? '#D32F2F' : '#fff'}
            />
            <Text
              style={[
                styles.lookupText,
                sjHeader && styles.lookupTextSelected,
              ]}>
              {sjHeader ? sjHeader.sj_nomor : 'Pilih SJ...'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.loadPendingButton, {marginLeft: 10}]}
            onPress={() => {
              setModalMode('PENDING');
              setIsModalVisible(true);
            }}
            disabled={!!sjHeader}>
            <Text style={styles.loadPendingButtonText}>Muat Pending</Text>
          </TouchableOpacity>
        </View>
        {sjHeader && (
          <Text style={styles.headerDetails}>
            Dari: {sjHeader.gudang_asal_nama} ({sjHeader.gudang_asal_kode})
          </Text>
        )}
      </View>

      <View style={styles.scanContainer}>
        <TextInput
          ref={scannerInputRef}
          style={styles.scanInput}
          placeholder="Scan Barcode Barang Di Sini..."
          value={scannedBarcode}
          onChangeText={setScannedBarcode}
          onSubmitEditing={handleBarcodeScan}
          editable={!!sjHeader}
          placeholderTextColor="#BDBDBD"
          blurOnSubmit={false}
        />
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => `${item.kode}-${item.ukuran}`}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Pilih SJ untuk memuat barang.</Text>
        }
      />

      <View style={styles.footerContainer}>
        {items.length > 0 && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>
              Item Selesai:{' '}
              <Text style={styles.summaryValue}>
                {summary.itemSelesai} / {summary.totalJenis}
              </Text>
            </Text>
            <Text style={styles.summaryText}>
              Total Qty:{' '}
              <Text style={styles.summaryValue}>
                {summary.totalTerima} / {summary.totalKirim}
              </Text>
            </Text>
          </View>
        )}

        {/* Selalu tampilkan 2 tombol jika data sudah dimuat */}
        {sjHeader && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPending]}
              onPress={handleSavePending}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {pendingData ? 'Update Pending' : 'Simpan Pending'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonFinal]}
              onPress={handleSaveFinal}
              disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Simpan Final</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  },
  lookupText: {flex: 1, fontSize: 16, marginHorizontal: 10, color: '#757575'},
  lookupTextSelected: {color: '#212121', fontWeight: '600'},
  loadPendingButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    backgroundColor: '#616161',
    borderRadius: 8,
  },
  loadPendingButtonText: {color: '#FFFFFF', fontWeight: 'bold'},
  headerDetails: {marginTop: 8, color: '#666', fontSize: 12},
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
  itemName: {fontSize: 16, fontWeight: '600', color: '#212121'},
  itemDetails: {color: '#666', marginTop: 4},
  qtyContainer: {alignItems: 'flex-end', minWidth: 60},
  qtyLabel: {color: '#888', fontSize: 12},
  qtyValue: {fontSize: 20, fontWeight: 'bold', color: '#212121'},
  emptyText: {textAlign: 'center', marginTop: 40, color: '#999'},
  footerContainer: {
    padding: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  summaryContainer: {
    flexDirection: 'row', // Buat berdampingan
    justifyContent: 'space-between', // Beri jarak
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
  buttonRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 10},
  button: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    elevation: 2,
    flex: 1,
  },
  buttonFinal: {backgroundColor: '#4CAF50'},
  buttonPending: {backgroundColor: '#FF9800'},
  buttonText: {color: '#FFFFFF', fontWeight: 'bold', fontSize: 16},
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
});

export default TerimaSjScreen;
