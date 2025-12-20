import React, {useState, useContext, useRef, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Keyboard,
  Vibration,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  apiClient,
  getCabangListApi,
  downloadMasterDataApi,
  uploadOpnameResultApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import * as DB from '../services/Database';
import SearchModal from '../components/SearchModal';
import SoundPlayer from 'react-native-sound-player';

const StokOpnameScreen = ({navigation}) => {
  const {userToken, userInfo} = useContext(AuthContext);
  const isSuperUser = userInfo.kode === 'RIO' && userInfo.cabang === 'KDC';

  const [targetCabang, setTargetCabang] = useState({
    kode: userInfo.cabang,
    nama: userInfo.nama_cabang || 'Cabang Sendiri',
  });
  const [isCabangModalVisible, setIsCabangModalVisible] = useState(false);

  // Form State
  const [lokasi, setLokasi] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');

  // Info barang terakhir discan untuk feedback visual
  const [lastScanned, setLastScanned] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [listOpname, setListOpname] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  // State Tampilan (ALL = Semua, GROUP = Per Lokasi)
  const [viewMode, setViewMode] = useState('ALL');

  const lokasiInputRef = useRef(null);
  const scanInputRef = useRef(null);

  // Init DB saat buka layar
  useEffect(() => {
    const init = async () => {
      await DB.initDB();
      refreshList();
    };
    init();
  }, []);

  const refreshList = async () => {
    try {
      const data = await DB.getHasilOpname();
      // Pastikan data selalu array, jangan sampai null/undefined
      setListOpname(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Gagal refresh list:', e);
      setListOpname([]);
    }
  };

  // --- LOGIC 1: DASHBOARD RINGKASAN ---
  const summary = useMemo(() => {
    const safeList = listOpname || [];
    let totalSKU = safeList.length;
    let totalQty = safeList.reduce(
      (sum, item) => sum + (item.qty_fisik || 0),
      0,
    );
    return {totalSKU, totalQty};
  }, [listOpname]);

  // --- LOGIC 2: FILTER LIST (Safe Array) ---
  const filteredList = useMemo(() => {
    const currentList = listOpname || [];
    if (!searchQuery) return currentList;

    const lowerQ = searchQuery.toLowerCase();
    return currentList.filter(
      item =>
        (item.nama && item.nama.toLowerCase().includes(lowerQ)) ||
        (item.barcode && item.barcode.includes(lowerQ)) ||
        (item.lokasi && item.lokasi.toLowerCase().includes(lowerQ)),
    );
  }, [listOpname, searchQuery]);

  // --- LOGIC 3: GROUPING DATA (SectionList) ---
  const groupedList = useMemo(() => {
    // Safety check: Jika bukan mode GROUP atau data kosong/bukan array, return kosong
    if (
      viewMode !== 'GROUP' ||
      !filteredList ||
      !Array.isArray(filteredList) ||
      filteredList.length === 0
    ) {
      return [];
    }

    const groups = {};
    try {
      filteredList.forEach(item => {
        const loc = item.lokasi ? item.lokasi.toUpperCase() : 'TANPA LOKASI';
        if (!groups[loc]) {
          groups[loc] = [];
        }
        groups[loc].push(item);
      });

      return Object.keys(groups)
        .sort()
        .map(key => ({
          title: key,
          data: groups[key],
          subTotalQty: groups[key].reduce((s, i) => s + (i.qty_fisik || 0), 0),
        }));
    } catch (e) {
      console.error('Error grouping:', e);
      return [];
    }
  }, [filteredList, viewMode]);

  // FUNGSI UTILITY: Putar Suara
  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log(`Tidak bisa memutar suara`, e);
    }
  };

  const handleSelectCabang = selected => {
    setTargetCabang(selected);
    setIsCabangModalVisible(false);
  };

  const handleDownload = async () => {
    Alert.alert(
      'Download Master',
      `Download data untuk ${targetCabang.kode}?`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Download',
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await downloadMasterDataApi(
                userToken,
                targetCabang.kode,
              );
              const dataBarang = response.data?.data;
              if (Array.isArray(dataBarang) && dataBarang.length > 0) {
                await DB.insertMasterBarang(dataBarang);
                Toast.show({
                  type: 'success',
                  text1: 'Selesai',
                  text2: `${dataBarang.length} data didownload.`,
                });
                refreshList();
              } else {
                Alert.alert('Kosong', 'Data master tidak ditemukan.');
              }
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Gagal',
                text2: 'Download error.',
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  // --- LOGIKA SCAN (SCAN & COUNT + SOUND) ---
  const handleScan = async () => {
    if (!scannedBarcode) return;
    if (!lokasi) {
      playSound('error');
      Toast.show({
        type: 'error',
        text1: 'Lokasi Kosong!',
        text2: 'Isi lokasi rak dulu.',
      });
      lokasiInputRef.current?.focus();
      return;
    }

    const cleanBarcode = scannedBarcode.trim();

    // Cek Master Barang
    const masterItem = await DB.getBarangByBarcode(cleanBarcode);

    if (masterItem) {
      // BARANG DITEMUKAN -> TAMBAH QTY (+1)
      try {
        await DB.incrementOpnameQty(cleanBarcode, lokasi);

        Vibration.vibrate(100);
        playSound('success');

        Toast.show({
          type: 'success',
          text1: 'OK (+1)',
          text2: `${masterItem.nama}`,
          visibilityTime: 1000,
        });

        setLastScanned({
          nama: masterItem.nama,
          barcode: cleanBarcode,
          status: 'BERHASIL',
        });

        refreshList();
      } catch (err) {
        playSound('error');
        console.log(err);
        Toast.show({
          type: 'error',
          text1: 'Error Simpan',
          text2: 'Gagal update database HP.',
        });
      }
    } else {
      // BARANG TIDAK DITEMUKAN
      Vibration.vibrate([0, 500]);
      playSound('error');

      Toast.show({
        type: 'error',
        text1: 'UNKNOWN',
        text2: `Barcode ${cleanBarcode} tidak dikenali.`,
      });
      setLastScanned({
        nama: 'TIDAK DIKENALI',
        barcode: cleanBarcode,
        status: 'ERROR',
      });
    }

    // Reset & Fokus Ulang
    setScannedBarcode('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleUpload = async () => {
    const dataToUpload = await DB.getHasilOpname();
    if (dataToUpload.length === 0)
      return Toast.show({type: 'info', text1: 'Kosong'});

    Alert.alert('Upload', `Kirim ${dataToUpload.length} item ke server?`, [
      {text: 'Batal'},
      {
        text: 'Ya',
        onPress: async () => {
          setIsLoading(true);
          try {
            await uploadOpnameResultApi(
              {items: dataToUpload, targetCabang: targetCabang.kode},
              userToken,
            );

            // BERSIHKAN DATA SETELAH SUKSES
            await DB.clearOpname();
            refreshList();

            Toast.show({
              type: 'success',
              text1: 'Sukses',
              text2: 'Data terkirim & HP dibersihkan.',
            });
          } catch (e) {
            console.error(e);
            Toast.show({
              type: 'error',
              text1: 'Gagal Upload',
              text2: 'Data masih aman di HP.',
            });
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  // FUNGSI RESET DENGAN ERROR HANDLING
  const handleReset = () => {
    Alert.alert(
      'Hapus Semua Data?',
      'Semua hasil scan di HP ini akan dihapus permanen. Data master barang TETAP ADA.',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await DB.clearOpname();
              refreshList();
              setLastScanned(null);
              setScannedBarcode('');
              Toast.show({type: 'success', text1: 'Data berhasil di-reset'});
            } catch (error) {
              console.error('Gagal Reset:', error);
              Alert.alert(
                'Error',
                'Gagal menghapus data database: ' + JSON.stringify(error),
              );
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}) => (
    <View style={styles.cardItem}>
      <View style={styles.cardInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.nama}
        </Text>
        <Text style={styles.itemSub}>
          {item.barcode} | {item.ukuran}
        </Text>
        <View style={styles.badgeLokasi}>
          <Icon name="map-pin" size={10} color="#fff" />
          <Text style={styles.textLokasi}>{item.lokasi}</Text>
        </View>
      </View>
      <View style={styles.cardQty}>
        <Text style={styles.textQty}>{item.qty_fisik}</Text>
        <Text style={styles.labelQty}>Pcs</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal Cabang */}
      <SearchModal
        visible={isCabangModalVisible}
        onClose={() => setIsCabangModalVisible(false)}
        onSelect={handleSelectCabang}
        title="Pilih Cabang"
        apiSearchFunction={async ({term}) => {
          const res = await getCabangListApi(userToken);
          let rows = res.data.data || [];
          if (term)
            rows = rows.filter(r =>
              r.kode.toLowerCase().includes(term.toLowerCase()),
            );
          return {data: {data: {items: rows}}};
        }}
        keyField="kode"
        renderListItem={item => (
          <Text style={{padding: 10, fontSize: 16}}>
            {item.kode} - {item.nama}
          </Text>
        )}
      />

      {/* 1. Header Setting */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.cabangSelector}
          onPress={() => isSuperUser && setIsCabangModalVisible(true)}
          disabled={!isSuperUser}>
          <Text style={styles.cabangLabel}>Gudang Aktif</Text>
          <Text style={styles.cabangValue}>{targetCabang.kode}</Text>
        </TouchableOpacity>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.btnSmall,
              {backgroundColor: '#D32F2F', marginRight: 5},
            ]}
            onPress={handleReset}>
            <Icon name="trash-2" size={16} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSmall} onPress={handleDownload}>
            <Icon name="download" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSmall, {backgroundColor: '#4CAF50'}]}
            onPress={handleUpload}>
            <Icon name="upload" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. AREA SCAN */}
      <View style={styles.scanArea}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Lokasi Rak</Text>
          <TextInput
            ref={lokasiInputRef}
            style={styles.inputLokasi}
            placeholder="Ex: A-01"
            value={lokasi}
            onChangeText={setLokasi}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Scan Barcode</Text>
          <TextInput
            ref={scanInputRef}
            style={styles.inputScan}
            placeholder="Scan barang di sini..."
            value={scannedBarcode}
            onChangeText={setScannedBarcode}
            onSubmitEditing={handleScan}
            autoCapitalize="none"
          />
        </View>

        {lastScanned && (
          <View
            style={[
              styles.feedbackBox,
              lastScanned.status === 'ERROR'
                ? styles.feedError
                : styles.feedSuccess,
            ]}>
            <Text style={styles.feedTitle}>
              {lastScanned.status === 'BERHASIL' ? 'BERHASIL +1' : 'GAGAL'}
            </Text>
            <Text style={styles.feedName} numberOfLines={1}>
              {lastScanned.nama}
            </Text>
            <Text style={styles.feedBarcode}>{lastScanned.barcode}</Text>
          </View>
        )}
      </View>

      {/* 3. LIST HASIL */}
      <View style={styles.listContainer}>
        {/* A. DASHBOARD RINGKASAN */}
        <View style={styles.dashboardContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Item (SKU)</Text>
            <Text style={styles.statValue}>
              {summary.totalSKU.toLocaleString()}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              {borderLeftWidth: 1, borderColor: '#eee'},
            ]}>
            <Text style={styles.statLabel}>Total Fisik (Pcs)</Text>
            <Text style={[styles.statValue, {color: '#1976D2'}]}>
              {summary.totalQty.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* B. HEADER LIST & TAB SWITCHER */}
        <View style={styles.listHeader}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, viewMode === 'ALL' && styles.tabActive]}
              onPress={() => setViewMode('ALL')}>
              <Text
                style={[
                  styles.tabText,
                  viewMode === 'ALL' && styles.tabTextActive,
                ]}>
                Semua
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                viewMode === 'GROUP' && styles.tabActive,
              ]}
              onPress={() => setViewMode('GROUP')}>
              <Text
                style={[
                  styles.tabText,
                  viewMode === 'GROUP' && styles.tabTextActive,
                ]}>
                Per Rak
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchSmall}>
            <Icon name="search" size={14} color="#999" />
            <TextInput
              placeholder="Cari..."
              style={{flex: 1, fontSize: 12, padding: 0, paddingLeft: 4}}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* C. KONTEN LIST */}
        {viewMode === 'ALL' ? (
          <FlatList
            data={filteredList}
            renderItem={renderItem}
            keyExtractor={item => item.barcode}
            contentContainerStyle={{paddingBottom: 80}}
            ListEmptyComponent={
              <Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>
                Belum ada data
              </Text>
            }
          />
        ) : (
          <SectionList
            sections={groupedList}
            keyExtractor={(item, index) => item.barcode + index}
            renderItem={renderItem}
            renderSectionHeader={({section: {title, subTotalQty}}) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionSubTotal}>{subTotalQty} Pcs</Text>
              </View>
            )}
            contentContainerStyle={{paddingBottom: 80}}
            ListEmptyComponent={
              <Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>
                Belum ada data
              </Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},

  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    elevation: 2,
  },
  cabangSelector: {justifyContent: 'center'},
  cabangLabel: {fontSize: 10, color: '#888', textTransform: 'uppercase'},
  cabangValue: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  headerButtons: {flexDirection: 'row', gap: 10},
  btnSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  // Scan Area
  scanArea: {padding: 15, backgroundColor: '#fff', marginTop: 10, elevation: 1},
  inputGroup: {marginBottom: 10},
  label: {fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 5},
  inputLokasi: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFC107',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 45,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57F17',
  },
  inputScan: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 16,
    color: '#333',
  },

  // Feedback Box
  feedbackBox: {
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
    alignItems: 'center',
  },
  feedSuccess: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  feedError: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  feedTitle: {fontWeight: 'bold', fontSize: 16, marginBottom: 2},
  feedName: {fontSize: 14, color: '#333'},
  feedBarcode: {fontSize: 12, color: '#666'},

  // List
  listContainer: {
    flex: 1,
    marginTop: 10,
    backgroundColor: '#fff',
    elevation: 2,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  listTitle: {fontWeight: 'bold', fontSize: 14, color: '#333'},
  searchSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 10,
    borderRadius: 15,
    width: 140,
    height: 32,
    marginLeft: 10,
  },

  // List Item Card
  cardItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardInfo: {flex: 1},
  itemName: {fontSize: 14, fontWeight: 'bold', color: '#333'},
  itemSub: {fontSize: 12, color: '#666', marginTop: 2},
  badgeLokasi: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#607D8B',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  textLokasi: {color: '#fff', fontSize: 10, marginLeft: 4, fontWeight: 'bold'},

  cardQty: {justifyContent: 'center', alignItems: 'center', minWidth: 50},
  textQty: {fontSize: 20, fontWeight: 'bold', color: '#1976D2'},
  labelQty: {fontSize: 10, color: '#888'},

  // DASHBOARD STYLES
  dashboardContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValue: {fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 2},

  // TAB SWITCHER STYLES
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 2,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#fff',
    elevation: 1,
  },
  tabText: {fontSize: 12, color: '#666', fontWeight: '600'},
  tabTextActive: {color: '#1976D2'},

  // SECTION LIST STYLES
  sectionHeader: {
    backgroundColor: '#E3F2FD', // Warna biru muda pembeda rak
    paddingHorizontal: 15,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  sectionTitle: {fontWeight: 'bold', color: '#1565C0', fontSize: 14},
  sectionSubTotal: {fontSize: 12, fontWeight: 'bold', color: '#1565C0'},
});

export default StokOpnameScreen;
