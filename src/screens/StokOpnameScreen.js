import React, {
  useState,
  useContext,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
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
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  apiClient,
  getCabangListApi,
  downloadMasterDataApi,
  downloadMasterLokasiApi,
  uploadOpnameResultApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import * as DB from '../services/Database';
import SearchModal from '../components/SearchModal';
import SoundPlayer from 'react-native-sound-player';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useWindowDimensions} from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const StokOpnameScreen = ({navigation}) => {
  const {width, height} = useWindowDimensions();
  const isLandscape = width > height;
  const {userToken, userInfo} = useContext(AuthContext);

  // [LOGIKA USER KHUSUS]
  // RIO di KDC bisa ganti cabang. User lain (atau RIO di toko) terkunci di cabang login.
  const canSwitchCabang = userInfo.kode === 'RIO' && userInfo.cabang === 'KDC';

  const [targetCabang, setTargetCabang] = useState({
    kode: userInfo.cabang,
    nama: userInfo.nama_cabang || userInfo.cabang, // Fallback ke kode jika nama kosong
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

  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [uploadLogs, setUploadLogs] = useState([]);

  const [operatorName, setOperatorName] = useState('');

  const [selectedLogItems, setSelectedLogItems] = useState(null);

  const [deviceSuffix, setDeviceSuffix] = useState('');

  const [isLokasiLocked, setIsLokasiLocked] = useState(false);

  const [syncStage, setSyncStage] = useState(''); // 'downloading', 'saving_items', 'saving_loc'
  const [syncProgress, setSyncProgress] = useState(0);

  const lokasiInputRef = useRef(null);
  const scanInputRef = useRef(null);

  // Init DB saat buka layar
  useEffect(() => {
    const init = async () => {
      await DB.initDB();
      refreshList();
    };
    init();
  }, [refreshList]);

  // Update targetCabang jika userInfo berubah (misal relogin tanpa restart app)
  useEffect(() => {
    setTargetCabang({
      kode: userInfo.cabang,
      nama: userInfo.nama_cabang || userInfo.cabang,
    });
  }, [userInfo]);

  // 1. Ambil nama yang tersimpan saat pertama kali aplikasi dibuka
  useEffect(() => {
    const loadOperatorName = async () => {
      try {
        const savedName = await AsyncStorage.getItem('@operator_name');
        if (savedName !== null) {
          setOperatorName(savedName);
        }
      } catch (e) {
        console.error('Gagal mengambil nama operator', e);
      }
    };
    loadOperatorName();
  }, []);

  useEffect(() => {
    const init = async () => {
      await DB.initDB();
      refreshList(); // Memanggil fungsi yang sudah di-memoize

      // Ambil 5 digit ID unik
      const deviceId = await DeviceInfo.getUniqueId();
      setDeviceSuffix(deviceId.substring(0, 5).toLowerCase());
    };

    init();
  }, [refreshList]);

  useEffect(() => {
    if (isLokasiLocked) {
      scanInputRef.current?.focus();
    }
  }, [isLokasiLocked]);

  // 2. Fungsi untuk mengubah state sekaligus menyimpan ke storage
  const handleOperatorNameChange = async text => {
    setOperatorName(text);
    try {
      await AsyncStorage.setItem('@operator_name', text);
    } catch (e) {
      console.error('Gagal menyimpan nama operator', e);
    }
  };

  // Fungsi Helper untuk Trigger Animasi
  const triggerAnimation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
  };

  const refreshList = useCallback(async () => {
    try {
      // Fungsi ini sekarang bergantung pada targetCabang.kode
      const data = await DB.getHasilOpname(targetCabang.kode);
      setListOpname(Array.isArray(data) ? data : []);
    } catch (e) {
      setListOpname([]);
    }
  }, [targetCabang.kode]);

  // --- LOGIC 1: DASHBOARD RINGKASAN ---
  const summary = useMemo(() => {
    const currentList = listOpname || [];
    const activeLokasi = lokasi.trim().toLowerCase();

    let targetList = [];
    if (viewMode === 'ALL') {
      // Total hanya untuk rak yang sedang diinput
      targetList = currentList.filter(
        item => item.lokasi && item.lokasi.toLowerCase() === activeLokasi,
      );
    } else {
      // Total untuk semua yang belum diupload di device ini
      targetList = currentList.filter(item => item.is_uploaded === 0);
    }

    return {
      totalSKU: targetList.length,
      totalQty: targetList.reduce(
        (sum, item) => sum + (item.qty_fisik || 0),
        0,
      ),
    };
  }, [listOpname, lokasi, viewMode]);

  // --- LOGIC 2: FILTER LIST (Safe Array) ---
  const filteredList = useMemo(() => {
    const currentList = listOpname || [];
    const activeLokasi = lokasi.trim().toLowerCase();
    const lowerQ = searchQuery.trim().toLowerCase();

    // --- 1. MODE PENCARIAN (Cari di semua data) ---
    if (lowerQ) {
      return currentList.filter(
        item =>
          (item.nama && item.nama.toLowerCase().includes(lowerQ)) ||
          (item.barcode && item.barcode.includes(lowerQ)) ||
          (item.lokasi && item.lokasi.toLowerCase().includes(lowerQ)),
      );
    }

    // --- 2. MODE TAB: SEMUA BELUM UPLOAD ---
    if (viewMode === 'GLOBAL') {
      return currentList.filter(item => item.is_uploaded === 0);
    }

    // --- 3. MODE TAB: RAK AKTIF ---
    if (!activeLokasi) return [];

    // Ambil SEMUA data di rak tersebut (baik is_uploaded 0 maupun 1)
    return currentList.filter(
      item => item.lokasi && item.lokasi.toLowerCase() === activeLokasi,
    );
  }, [listOpname, lokasi, searchQuery, viewMode]);

  // --- LOGIC 3: GROUPING DATA (SectionList) ---
  const groupedList = useMemo(() => {
    // Hanya grouping jika di mode GLOBAL dan tidak sedang mencari
    if (viewMode !== 'GLOBAL' || searchQuery) return [];

    const groups = {};
    filteredList.forEach(item => {
      const loc = item.lokasi ? item.lokasi.toUpperCase() : 'TANPA LOKASI';
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(item);
    });

    return Object.keys(groups)
      .sort()
      .map(key => ({
        title: key,
        data: groups[key],
        subTotalQty: groups[key].reduce((s, i) => s + (i.qty_fisik || 0), 0),
      }));
  }, [filteredList, viewMode, searchQuery]);

  // FUNGSI UTILITY: Putar Suara
  const playSound = useCallback(
    type => {
      try {
        if (type === 'success') {
          // 1. Jika suffix belum siap, langsung putar default agar tidak macet
          if (!deviceSuffix) {
            SoundPlayer.playSoundFile('beep_success', 'mp3');
            return;
          }

          // 2. Coba putar suara kustom
          const customSound = `beep_success_${deviceSuffix}`;

          // Kita tidak bisa hanya mengandalkan try-catch untuk cek file di native
          // Jadi kita gunakan logika: jika gagal kustom, pastikan catch menjalankan default
          try {
            SoundPlayer.playSoundFile(customSound, 'mp3');
          } catch (innerError) {
            console.log('File kustom tidak ada, memutar default...');
            SoundPlayer.playSoundFile('beep_success', 'mp3');
          }
        } else {
          SoundPlayer.playSoundFile('beep_error', 'mp3');
        }
      } catch (e) {
        console.log(`Tidak bisa memutar suara:`, e.message);
      }
    },
    [deviceSuffix],
  );

  const handleSelectCabang = selected => {
    setTargetCabang(selected);
    setIsCabangModalVisible(false);
    // Optional: Reset data lokal jika ganti cabang agar tidak tercampur?
    // handleReset();
  };

  const handleDownload = async () => {
    Alert.alert('Download Master', 'Download data barang & lokasi terbaru?', [
      {text: 'Batal', style: 'cancel'},
      {
        text: 'Ya, Download',
        onPress: async () => {
          setIsLoading(true);
          setSyncProgress(0);
          try {
            // TAHAP 1: DOWNLOAD BARANG
            setSyncStage('downloading_items');
            const resBarang = await downloadMasterDataApi(
              userToken,
              targetCabang.kode,
            );

            // TAHAP 2: SIMPAN BARANG (Proses Berat)
            if (resBarang.data?.success) {
              setSyncStage('saving_items');
              await DB.insertMasterBarang(
                resBarang.data.data,
                (current, total) => {
                  setSyncProgress(Math.round((current / total) * 100));
                },
              );
            }

            // TAHAP 3: DOWNLOAD & SIMPAN LOKASI
            setSyncStage('downloading_loc');
            const resLokasi = await downloadMasterLokasiApi(
              userToken,
              targetCabang.kode,
            );
            if (resLokasi.data?.success) {
              setSyncStage('saving_loc');
              await DB.insertMasterLokasi(resLokasi.data.data);
            }

            Toast.show({
              type: 'success',
              text1: 'Selesai',
              text2: 'Data Master Opname Berhasil Diperbarui',
            });
            refreshList();
          } catch (error) {
            console.error(error);
            Alert.alert('Gagal', 'Gagal sinkronisasi data dari server.');
          } finally {
            setIsLoading(false);
            setSyncStage('');
            setSyncProgress(0);
          }
        },
      },
    ]);
  };

  // --- LOGIKA SCAN (SCAN & COUNT + SOUND) ---
  const handleScan = async () => {
    if (!scannedBarcode) return;
    const cleanBarcode = scannedBarcode.trim().replace(/^0+/, '');

    const scannedData = cleanBarcode.toUpperCase();

    // --- LOGIKA VALIDASI LOKASI ---
    if (!isLokasiLocked) {
      const isLocationValid = await DB.isValidLocation(
        scannedData,
        targetCabang.kode,
      );

      if (isLocationValid) {
        setLokasi(scannedData);
        setIsLokasiLocked(true);
        playSound('success');
        setScannedBarcode(''); // Clear input untuk barang selanjutnya
        Vibration.vibrate(100);
        Toast.show({
          type: 'success',
          text1: 'Lokasi Terkunci',
          text2: `Rak: ${scannedData}`,
        });
      } else {
        // WARNING: Lokasi Tidak Valid
        playSound('error');
        Vibration.vibrate([0, 500]); // Getar lebih lama untuk error
        setScannedBarcode(''); // Kosongkan lagi agar bisa coba lagi

        Alert.alert(
          'Lokasi Tidak Terdaftar',
          `Kode "${scannedData}" tidak ditemukan di Master Lokasi. Pastikan Anda scan QR Label yang benar.`,
          [{text: 'Coba Lagi', onPress: () => scanInputRef.current?.focus()}],
        );
      }
      return;
    }

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

    // Cek Master Barang
    const masterItem = await DB.getBarangByBarcode(
      cleanBarcode,
      targetCabang.kode,
    );

    if (masterItem) {
      // BARANG DITEMUKAN -> TAMBAH QTY (+1)
      try {
        await DB.incrementOpnameQty(cleanBarcode, lokasi, targetCabang.kode);

        triggerAnimation(); // Animasi saat item muncul/pindah ke atas
        refreshList();

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

  const handleUnlockLokasi = async () => {
    const hasPending = await DB.checkPendingByLokasi(lokasi, targetCabang.kode);

    if (hasPending) {
      Alert.alert(
        'Selesaikan Rak?',
        'Masih ada data yang belum di-upload. Upload sekarang dan ganti rak?',
        [
          {text: 'Batal', style: 'cancel'},
          {
            text: 'Ya, Upload & Ganti',
            onPress: async () => {
              const success = await handleUpload(); // Panggil fungsi upload yang sudah ada
              if (success) {
                setIsLokasiLocked(false);
                setLokasi('');
              }
            },
          },
        ],
      );
    } else {
      // Logika buka kunci biasa jika data sudah bersih
      setIsLokasiLocked(false);
      setLokasi('');
    }
  };

  const handleUpload = async () => {
    const dataToUpload = await DB.getPendingOpname(targetCabang.kode);
    if (dataToUpload.length === 0) {
      return Toast.show({
        type: 'info',
        text1: 'Tidak ada data baru untuk diupload',
      });
    }

    // VALIDASI: Nama Operator wajib diisi
    if (!operatorName.trim()) {
      return Alert.alert(
        'Perhatian',
        'Nama Operator harus diisi agar tahu siapa yang mengerjakan rak ini.',
      );
    }

    // --- LOGIKA AMBIL INFO DEVICE ---
    // Kita ambil Nama HP dan sedikit potongan Unique ID agar tidak tertukar jika tipe HP sama
    const deviceId = await DeviceInfo.getUniqueId();
    const deviceName = await DeviceInfo.getDeviceName();
    const infoDevice = `${deviceName} (${deviceId.substring(0, 5)})`;

    Alert.alert('Upload', `Kirim ${dataToUpload.length} item baru ke server?`, [
      {text: 'Batal'},
      {
        text: 'Ya',
        onPress: async () => {
          setIsLoading(true);
          try {
            const res = await uploadOpnameResultApi(
              {
                items: dataToUpload,
                targetCabang: targetCabang.kode,
                deviceInfo: infoDevice,
                operatorName: operatorName,
              },
              userToken,
            );

            if (res.status === 200 || res.data.success) {
              // A. Simpan Log Riwayat (tetap simpan apa yang barusan diupload)
              const totalQty = dataToUpload.reduce(
                (s, i) => s + i.qty_fisik,
                0,
              );
              await DB.saveUploadLog(
                dataToUpload.length,
                totalQty,
                targetCabang.kode,
                infoDevice,
                operatorName,
                dataToUpload,
              );

              // B. [PENTING] Tandai sudah terupload, JANGAN di-clear
              await DB.markAsUploaded(targetCabang.kode);

              refreshList();
              Toast.show({
                type: 'success',
                text1: 'Berhasil Upload',
                text2: 'Data kini ditandai sebagai terkirim.',
              });
            }
          } catch (e) {
            Alert.alert('Gagal', e.message);
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  // FUNGSI RESET
  const handleReset = () => {
    Alert.alert(
      'Hapus Semua Data?',
      'Semua hasil scan di HP ini akan dihapus permanen.',
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
              Alert.alert('Error', 'Gagal reset data.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteItem = (barcode, lokasi, nama) => {
    Alert.alert('Hapus Item', `Yakin hapus ${nama} di lokasi ${lokasi}?`, [
      {text: 'Batal'},
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await DB.deleteItemOpname(barcode, lokasi);
          refreshList();
          Toast.show({type: 'success', text1: 'Item dihapus'});
        },
      },
    ]);
  };

  const showHistory = async () => {
    const logs = await DB.getUploadHistory();
    setUploadLogs(logs);
    setIsHistoryVisible(true);
  };

  const handleFixEmergency = () => {
    Alert.alert(
      '🛠️ Maintenance Data',
      'Paksa status rak "LBLNEW" menjadi "Belum Upload" agar bisa dikirim ulang ke server?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Reset LBLNEW',
          onPress: async () => {
            try {
              setIsLoading(true);
              await DB.resetUploadStatusByLocation('LBLNEW');
              await refreshList(); // Refresh tampilan agar data muncul lagi

              Toast.show({
                type: 'success',
                text1: 'Perbaikan Berhasil',
                text2: 'Rak LBLNEW kini siap diupload ulang.',
              });
            } catch (e) {
              Alert.alert('Gagal Perbaikan', e.message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}) => {
    const isUploaded = item.is_uploaded === 1;
    const textColor = getRowTextColor(isUploaded);

    // Fungsi Konfirmasi Tambah
    const confirmIncrement = item => {
      Alert.alert('Konfirmasi', `Tambah stok ${item.nama}?`, [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Tambah',
          onPress: async () => {
            await DB.incrementOpnameQty(
              item.barcode,
              item.lokasi,
              targetCabang.kode,
            );
            triggerAnimation();
            refreshList();
          },
        },
      ]);
    };

    // Fungsi Konfirmasi Kurang
    const confirmDecrement = item => {
      const isDelete = item.qty_fisik === 1;
      Alert.alert(
        'Konfirmasi',
        isDelete ? `Hapus ${item.nama}?` : `Kurangi stok ${item.nama}?`,
        [
          {text: 'Batal', style: 'cancel'},
          {
            text: 'Ya, Lanjut',
            style: isDelete ? 'destructive' : 'default',
            onPress: async () => {
              await DB.decrementOpnameQty(
                item.barcode,
                item.lokasi,
                targetCabang.kode,
              );
              triggerAnimation();
              refreshList();
            },
          },
        ],
      );
    };

    return (
      <View
        style={[styles.cardItem, isUploaded && {backgroundColor: '#F5F5F5'}]}>
        <View style={styles.cardInfo}>
          <Text style={[styles.itemName, {color: textColor}]}>{item.nama}</Text>
          <Text style={[styles.itemSub, {color: textColor}]}>
            {item.barcode} | Ukuran: {item.ukuran}
          </Text>
          <View
            style={[
              styles.badgeLokasi,
              isUploaded && {backgroundColor: '#BDC3C7'},
            ]}>
            <Text style={styles.textLokasi}>{item.lokasi}</Text>
          </View>
        </View>

        <View style={styles.qtyControlContainer}>
          {/* Tombol Kurang */}
          {!isUploaded && (
            <TouchableOpacity
              onPress={() => confirmDecrement(item)}
              style={styles.btnQtyAction}>
              <Icon name="minus-circle" size={24} color="#D32F2F" />
            </TouchableOpacity>
          )}

          <View style={styles.qtyDisplay}>
            <Text style={[styles.textQty, isUploaded && {color: '#999'}]}>
              {item.qty_fisik}
            </Text>
            <Text style={styles.labelQty}>Pcs</Text>
          </View>

          {/* Tombol Tambah */}
          {!isUploaded && (
            <TouchableOpacity
              onPress={() => confirmIncrement(item)}
              style={styles.btnQtyAction}>
              <Icon name="plus-circle" size={24} color="#1976D2" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getRowTextColor = isUploaded => {
    return isUploaded ? '#999' : '#333'; // Abu-abu jika sudah terupload, Hitam jika belum
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. MODAL-MODAL (Tetap di luar wrapper utama) */}
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

      {/* 2. WRAPPER UTAMA RESPONSIF */}
      <View style={{flex: 1, flexDirection: isLandscape ? 'row' : 'column'}}>
        {/* --- KOLOM KIRI (INPUT HEADER) --- */}
        <View
          style={[
            isLandscape
              ? {width: '35%', borderRightWidth: 1, borderColor: '#eee'}
              : {},
            styles.desktopFormSectionHeaderSection, // Nama arsitektur konsisten
          ]}>
          {/* Header Gudang Aktif & Tombol Kontrol */}
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.cabangSelector}
              onPress={() => canSwitchCabang && setIsCabangModalVisible(true)}
              disabled={!canSwitchCabang}>
              <Text style={styles.cabangLabel}>Gudang Aktif</Text>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.cabangValue}>{targetCabang.kode}</Text>
                {canSwitchCabang && (
                  <Icon
                    name="chevron-down"
                    size={16}
                    color="#333"
                    style={{marginLeft: 4}}
                  />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={[styles.btnSmall, {backgroundColor: '#607D8B'}]}
                onPress={showHistory}
                onLongPress={handleFixEmergency} // <-- TAMBAHKAN INI
              >
                <Icon name="clock" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSmall, {backgroundColor: '#D32F2F'}]}
                onPress={handleReset}>
                <Icon name="trash-2" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSmall, {backgroundColor: '#1976D2'}]}
                onPress={handleDownload}>
                <Icon name="download" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSmall, {backgroundColor: '#4CAF50'}]}
                onPress={handleUpload}>
                <Icon name="upload" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Area Inputan dengan hide-details */}
          <View style={styles.scanArea}>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
              <View style={{flex: 1.5}}>
                <Text style={styles.label}>Operator</Text>
                <TextInput
                  style={[
                    styles.inputLokasi,
                    styles.inputOperatorActive,
                    styles.hideDetails,
                  ]} //
                  placeholder="Nama..."
                  value={operatorName}
                  onChangeText={handleOperatorNameChange}
                />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Lokasi (Scan QR)</Text>
                <View style={styles.lokasiInputWrapper}>
                  <TextInput
                    ref={lokasiInputRef}
                    style={[
                      styles.inputLokasi,
                      isLokasiLocked && styles.inputLocked,
                      styles.hideDetails,
                    ]}
                    placeholder="Scan Label Lokasi..."
                    value={lokasi}
                    editable={false} // Selalu false karena harus di-scan
                  />
                  {isLokasiLocked && (
                    <TouchableOpacity
                      style={styles.btnUnlock}
                      onPress={handleUnlockLokasi}>
                      <Icon name="edit-3" size={18} color="#D32F2F" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Scan Barcode</Text>
              <TextInput
                ref={scanInputRef}
                style={[styles.inputScan, styles.hideDetails]} //
                placeholder="Scan barang..."
                value={scannedBarcode}
                onChangeText={setScannedBarcode}
                onSubmitEditing={handleScan}
                autoCapitalize="none"
                showSoftInputOnFocus={false} // Keyboard mati agar fokus ke scanner
                autoFocus={true}
              />
            </View>

            {isLandscape && (
              <View
                style={[
                  styles.dashboardContainer,
                  {borderBottomWidth: 1, marginBottom: 10},
                ]}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Total SKU</Text>
                  <Text style={styles.statValue}>{summary.totalSKU}</Text>
                </View>
                <View
                  style={[
                    styles.statCard,
                    {borderLeftWidth: 1, borderColor: '#eee'},
                  ]}>
                  <Text style={styles.statLabel}>Total Pcs</Text>
                  <Text style={[styles.statValue, {color: '#1976D2'}]}>
                    {summary.totalQty}
                  </Text>
                </View>
              </View>
            )}

            {/* Feedback Scan Ringkas */}
            {lastScanned && (
              <View
                style={[
                  styles.feedbackBox,
                  lastScanned.status === 'ERROR'
                    ? styles.feedError
                    : styles.feedSuccess,
                ]}>
                <Text style={styles.feedTitle} numberOfLines={1}>
                  {lastScanned.nama}
                </Text>
                <Text style={styles.feedBarcode}>{lastScanned.barcode}</Text>
              </View>
            )}
          </View>
        </View>

        {/* --- KOLOM KANAN (DATA BARANG) --- */}
        <View style={styles.listContainer}>
          {/* Dashboard Ringkasan */}
          {!isLandscape && (
            <View style={styles.dashboardContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total SKU</Text>
                <Text style={styles.statValue}>
                  {summary.totalSKU.toLocaleString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  {borderLeftWidth: 1, borderColor: '#eee'},
                ]}>
                <Text style={styles.statLabel}>Total Pcs</Text>
                <Text style={[styles.statValue, {color: '#1976D2'}]}>
                  {summary.totalQty.toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {/* Tab & Search */}
          <View style={styles.listHeader}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  viewMode === 'ALL' && styles.tabActive,
                ]}
                onPress={() => setViewMode('ALL')}>
                <Text
                  style={[
                    styles.tabText,
                    viewMode === 'ALL' && styles.tabTextActive,
                  ]}>
                  Rak Aktif
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  viewMode === 'GLOBAL' && styles.tabActive,
                ]}
                onPress={() => setViewMode('GLOBAL')}>
                <Text
                  style={[
                    styles.tabText,
                    viewMode === 'GLOBAL' && styles.tabTextActive,
                  ]}>
                  Semua Belum Upload
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

          {/* List Utama */}
          {viewMode === 'ALL' ? (
            <FlatList
              data={filteredList}
              renderItem={renderItem} // Pastikan renderItem menggunakan getRowTextColor
              keyExtractor={item => item.barcode + item.lokasi}
              contentContainerStyle={{paddingBottom: 80, flexGrow: 1}} // Tambahkan flexGrow: 1 agar pesan ke tengah
              ListEmptyComponent={
                <View style={styles.emptyStateContainer}>
                  <Icon
                    name={lokasi.trim() === '' ? 'map-pin' : 'package'}
                    size={60}
                    color="#DDD"
                  />
                  <Text style={styles.emptyStateTitle}>
                    {lokasi.trim() === ''
                      ? 'Lokasi Belum Diisi'
                      : `Rak ${lokasi} Masih Kosong`}
                  </Text>
                  <Text style={styles.emptyStateSub}>
                    {lokasi.trim() === ''
                      ? 'Silakan ketik nama rak (contoh: A01) pada kolom Lokasi di atas untuk memulai scan.'
                      : 'Belum ada barang yang di-scan di lokasi ini. Pastikan Anda melakukan scan pada rak yang benar.'}
                  </Text>
                </View>
              }
            />
          ) : (
            <SectionList
              sections={groupedList}
              renderItem={renderItem}
              renderSectionHeader={({section: {title, subTotalQty}}) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{title}</Text>
                  <Text style={styles.sectionSubTotal}>{subTotalQty} Pcs</Text>
                </View>
              )}
            />
          )}
        </View>
      </View>

      <Modal
        visible={isHistoryVisible}
        animationType="slide"
        onRequestClose={() => setIsHistoryVisible(false)}>
        <SafeAreaView style={{flex: 1, backgroundColor: '#F5F7FA'}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Riwayat Upload (Local Log)</Text>
            <TouchableOpacity onPress={() => setIsHistoryVisible(false)}>
              <Icon name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={uploadLogs}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{padding: 15}}
            renderItem={({item}) => {
              const detailBarang = item.items_json
                ? JSON.parse(item.items_json)
                : [];
              const daftarLokasi = [
                ...new Set(detailBarang.map(it => it.lokasi)),
              ].join(', ');
              return (
                <View style={styles.logCard}>
                  <View style={{flex: 1}}>
                    <Text style={styles.logDate}>{item.tanggal}</Text>

                    <View style={styles.logInfoRow}>
                      <Icon name="map" size={10} color="#E67E22" />
                      <Text
                        style={[
                          styles.logSubText,
                          {color: '#E67E22', fontWeight: 'bold'},
                        ]}>
                        {' '}
                        Rak: {daftarLokasi || 'N/A'}
                      </Text>
                    </View>

                    <View style={styles.logInfoRow}>
                      <Icon name="map-pin" size={10} color="#666" />
                      <Text style={styles.logSubText}>
                        {' '}
                        Gudang: {item.cabang}
                      </Text>
                    </View>

                    <View style={styles.logInfoRow}>
                      <Icon name="user" size={10} color="#2E7D32" />
                      <Text
                        style={[
                          styles.logSubText,
                          {color: '#2E7D32', fontWeight: 'bold'},
                        ]}>
                        {' '}
                        Operator: {item.operator || 'N/A'}
                      </Text>
                    </View>

                    <View style={styles.logInfoRow}>
                      <Icon name="smartphone" size={10} color="#666" />
                      <Text style={styles.logSubText}>
                        {' '}
                        Device: {item.device || 'N/A'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.btnDetailHistory}
                      onPress={() => setSelectedLogItems(detailBarang)}>
                      <Icon
                        name="eye"
                        size={12}
                        color="#1565C0"
                        style={{marginRight: 5}}
                      />
                      <Text style={styles.btnDetailHistoryText}>
                        Lihat {detailBarang.length} Barang
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.logQtyBadge}>
                    <Text style={styles.logQtyText}>{item.total_qty}</Text>
                    <Text style={{fontSize: 10, color: '#fff'}}>Pcs</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Icon name="package" size={48} color="#DDD" />
                <Text style={{color: '#999', marginTop: 10}}>
                  {lokasi === ''
                    ? 'Isi Lokasi Rak Terlebih Dahulu'
                    : `Belum ada data di Rak ${lokasi}`}
                </Text>
              </View>
            }
          />

          {/* --- MODAL DETAIL (OVERLAY DI ATAS RIWAYAT) --- */}
          {/* Gunakan Modal transparan dengan View putih solid di tengahnya */}
          <Modal
            visible={!!selectedLogItems}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setSelectedLogItems(null)}>
            <View style={styles.modalOverlay}>
              <View style={styles.detailPopupContent}>
                <View style={styles.detailPopupHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Detail Barang</Text>
                    <Text style={{fontSize: 11, color: '#666'}}>
                      Daftar item dalam batch ini
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedLogItems(null)}
                    style={styles.btnCloseCircle}>
                    <Icon name="x" size={20} color="#333" />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={selectedLogItems}
                  keyExtractor={(it, idx) => idx.toString()}
                  renderItem={({item}) => (
                    <View style={styles.detailItemRow}>
                      <View style={{flex: 1}}>
                        <Text style={styles.detailItemName}>{item.nama}</Text>
                        <Text style={styles.detailItemSub}>
                          {item.barcode} | Ukuran:{' '}
                          <Text style={{fontWeight: 'bold', color: '#333'}}>
                            {item.ukuran}
                          </Text>{' '}
                          | Rak: {item.lokasi}
                        </Text>
                      </View>
                      <View style={styles.detailQtyBadge}>
                        <Text style={styles.detailQtyText}>
                          {item.qty_fisik}
                        </Text>
                      </View>
                    </View>
                  )}
                  contentContainerStyle={{paddingBottom: 20}}
                />
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isLoading && syncStage !== ''}
        transparent={true}
        animationType="fade">
        <View style={styles.syncOverlay}>
          <View style={styles.syncCard}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.syncTitle}>Sinkronisasi Data</Text>

            <Text style={styles.syncSub}>
              {syncStage === 'downloading_items' &&
                '☁️ Mengunduh data barang...'}
              {syncStage === 'saving_items' &&
                `📦 Menyimpan Barang (${syncProgress}%)`}
              {syncStage === 'downloading_loc' &&
                '📍 Mengunduh daftar lokasi...'}
              {syncStage === 'saving_loc' && '💾 Menyimpan data lokasi...'}
            </Text>

            {syncStage === 'saving_items' && (
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBarFill, {width: `${syncProgress}%`}]}
                />
              </View>
            )}

            <Text style={styles.syncNote}>
              Jangan tutup aplikasi selama proses berjalan
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ... styles tetap sama seperti yang Anda buat ...
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  mainWrapper: {flex: 1},

  // Naming sesuai instruksi arsitektur
  desktopFormSectionHeaderSection: {
    backgroundColor: '#fff',
    borderRightWidth: Platform.OS === 'android' ? 0 : 1,
    borderRightColor: '#eee',
    elevation: 2,
  },

  leftColumn: {
    width: '35%', // Kolom kiri mengambil 35% lebar layar saat landscape
    height: '100%',
    padding: 10,
  },
  rightColumn: {
    flex: 1,
    height: '100%',
  },

  // Penerapan hide-details (minimal padding/margin)
  hideDetails: {
    marginVertical: 0,
    marginBottom: 0,
    marginTop: 0,
  },

  sideBySideRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },

  landscapeActionRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },

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
    height: 45,
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

  inputOperatorActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    color: '#2E7D32',
  },
  qtyControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnQtyAction: {
    padding: 5,
  },
  qtyDisplay: {
    alignItems: 'center',
    minWidth: 40,
  },

  // List Item Card
  cardItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
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

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {fontSize: 18, fontWeight: 'bold', color: '#333'},

  logCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#4CAF50',
  },
  logDate: {fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5},
  logInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3, // Tambah sedikit jarak
  },
  logSubText: {
    fontSize: 11,
    color: '#666',
    flexShrink: 1, // Agar teks rak yang panjang tidak merusak layout
  },
  logQtyBadge: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
    height: 55,
  },
  logQtyText: {color: '#fff', fontWeight: 'bold', fontSize: 18},
  btnDetailHistory: {
    marginTop: 10,
    backgroundColor: '#E3F2FD',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  btnDetailHistoryText: {color: '#1565C0', fontWeight: 'bold', fontSize: 11},

  // MODAL DETAIL POPUP
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)', // Backdrop gelap
    justifyContent: 'center',
    padding: 20,
  },
  detailPopupContent: {
    backgroundColor: '#fff', // WAJIB PUTIH SOLID
    borderRadius: 20,
    maxHeight: '80%',
    elevation: 10,
    overflow: 'hidden',
  },
  detailPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  btnCloseCircle: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 20,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  detailItemName: {fontSize: 13, fontWeight: 'bold', color: '#333'},
  detailItemSub: {fontSize: 11, color: '#888', marginTop: 2},
  detailQtyBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailQtyText: {color: '#2E7D32', fontWeight: 'bold'},
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 80, // Menjaga posisi tetap proporsional
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 15,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#BBB',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  inputLocked: {
    backgroundColor: '#ECEFF1',
    borderColor: '#B0BEC5',
    color: '#455A64',
    borderStyle: 'dashed',
  },
  lokasiInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnUnlock: {
    position: 'absolute',
    right: 10,
    padding: 5,
  },
  // --- SYNC PROGRESS STYLES ---
  syncOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncCard: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#333',
  },
  syncSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1976D2',
  },
  syncNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 20,
    fontStyle: 'italic',
  },
});

export default StokOpnameScreen;
