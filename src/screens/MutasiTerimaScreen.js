import React, {
  useState,
  useContext,
  useRef,
  useCallback,
  useLayoutEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  searchMutasiKirimApi,
  loadMutasiKirimApi,
  saveMutasiTerimaApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const MutasiTerimaScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [kirimHeader, setKirimHeader] = useState(null);
  const [items, setItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const scannerInputRef = useRef(null);

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

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log(`Tidak bisa memutar suara`, e);
    }
  };

  const handleReset = useCallback(() => {
    Alert.alert(
      'Kosongkan Form?',
      'Semua data yang sudah dimuat akan dihapus. Anda yakin ingin mengulang?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Kosongkan',
          onPress: () => {
            setKirimHeader(null);
            setItems([]);
            setScannedBarcode('');
          },
          style: 'destructive',
        },
      ],
    );
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleReset} style={{marginRight: 15}}>
          <Icon name="rotate-ccw" size={24} color="#D32F2F" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleReset]);

  const handleSelectKirim = useCallback(
    async selected => {
      try {
        const response = await loadMutasiKirimApi(selected.nomor, userToken);
        setKirimHeader(response.data.data.header);
        setItems(
          response.data.data.items.map(item => ({...item, jumlahTerima: 0})),
        );
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal',
          text2: 'Gagal memuat detail pengiriman.',
        });
      }
    },
    [userToken],
  );

  const handleBarcodeScan = () => {
    if (!scannedBarcode) return;
    const barcode = scannedBarcode;
    const itemIndex = items.findIndex(item => item.barcode === barcode);
    if (itemIndex > -1) {
      const newItems = [...items];
      const currentItem = newItems[itemIndex];
      if (currentItem.jumlahTerima < currentItem.jumlahKirim) {
        currentItem.jumlahTerima += 1;
        setItems(newItems);
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
        text2: 'Barcode tidak ada di dokumen ini.',
      });
      playSound('error');
    }
    setScannedBarcode('');
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleSave = async () => {
    Alert.alert(
      'Konfirmasi Simpan',
      'Anda yakin ingin menyimpan penerimaan mutasi ini?',
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Simpan',
          onPress: async () => {
            setIsSaving(true);
            try {
              const payload = {
                header: {
                  tanggalTerima: new Date().toISOString().split('T')[0],
                  nomorKirim: kirimHeader.nomorKirim,
                },
                items: items,
              };
              const response = await saveMutasiTerimaApi(payload, userToken);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: response.data.message,
              });
              navigation.goBack();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Gagal',
                text2: error.response?.data?.message || 'Gagal menyimpan.',
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
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
      <SearchModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelect={handleSelectKirim}
        title="Cari Mutasi Kirim"
        apiSearchFunction={params => searchMutasiKirimApi(params, userToken)}
        keyField="nomor"
        renderListItem={item => (
          <View>
            <Text style={styles.itemKode}>{item.nomor}</Text>
            <Text style={styles.itemNama}>
              Dari: {item.dari_cabang_nama} - Tgl:{' '}
              {new Date(item.tanggal).toLocaleDateString('id-ID')}
            </Text>
          </View>
        )}
      />
      <View style={styles.headerForm}>
        <TouchableOpacity
          style={styles.lookupButton}
          onPress={() => setIsModalVisible(true)}>
          <Text>
            {kirimHeader ? kirimHeader.nomorKirim : 'Pilih Dokumen Kirim...'}
          </Text>
        </TouchableOpacity>
        {kirimHeader && (
          <>
            <Text style={styles.headerDetails}>
              Dari: {kirimHeader.gudangAsalNama}
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Keterangan Kirim:</Text>
              <Text style={styles.infoValue}>
                {kirimHeader.keterangan || '-'}
              </Text>
            </View>
          </>
        )}
      </View>
      <View style={styles.scanContainer}>
        <TextInput
          ref={scannerInputRef}
          style={styles.scanInput}
          placeholder="Scan Barcode Barang..."
          value={scannedBarcode}
          onChangeText={setScannedBarcode}
          onSubmitEditing={handleBarcodeScan}
          blurOnSubmit={false}
          editable={!!kirimHeader}
        />
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.barcode}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Pilih dokumen untuk memuat barang.
          </Text>
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
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={isSaving || !kirimHeader}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Simpan Penerimaan</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
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
  lookupText: {
    flex: 1,
    fontSize: 16,
    marginHorizontal: 10,
    color: '#757575',
  },
  lookupTextSelected: {
    color: '#212121',
    fontWeight: '600',
  },
  headerDetails: {
    marginTop: 8,
    color: '#666',
    fontSize: 12,
  },
  scanContainer: {
    padding: 16,
  },
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
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  itemDetails: {
    color: '#666',
    marginTop: 4,
  },
  qtyContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  qtyLabel: {
    color: '#888',
    fontSize: 12,
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
  },
  footerContainer: {
    padding: 16,
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
    fontSize: 14, // Ukuran teks dasar
    color: '#616161', // Warna abu-abu untuk label
  },
  summaryValue: {
    fontWeight: 'bold',
    color: '#212121', // Warna hitam dan tebal untuk angka
    fontSize: 15,
  },
  button: {
    backgroundColor: '#D32F2F',
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemKode: {
    fontWeight: 'bold',
    color: '#212121',
  },
  itemNama: {
    color: '#757575',
  },
  infoBox: {
    marginTop: 12,
    backgroundColor: '#f0f2f5',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 12,
    color: '#757575',
  },
  infoValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
    marginTop: 2,
  },
});
export default MutasiTerimaScreen;
