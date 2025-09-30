import React, {useState, useContext} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  searchSjToReceiveApi,
  loadSjToReceiveApi,
  saveTerimaSjApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const TerimaSjScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [sjHeader, setSjHeader] = useState(null);
  const [items, setItems] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Fungsi saat user memilih SJ dari modal pencarian
  const handleSelectSj = async selectedSj => {
    try {
      const response = await loadSjToReceiveApi(selectedSj.nomor, userToken);
      console.log(
        'DATA DITERIMA DARI SERVER:',
        JSON.stringify(response.data.data, null, 2),
      );
      setSjHeader(response.data.data.header);
      // Tambahkan field `jumlahTerima` untuk setiap item
      const itemsWithReceiveQty = response.data.data.items.map(item => ({
        ...item,
        jumlahTerima: 0,
      }));
      setItems(itemsWithReceiveQty);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal Memuat',
        text2: 'Gagal memuat detail Surat Jalan.',
      });
    }
  };

  // Fungsi saat user scan barcode barang
  const handleBarcodeScan = () => {
    if (!scannedBarcode) {
      return;
    }
    const barcodeToFind = scannedBarcode;
    setScannedBarcode('');

    const itemIndex = items.findIndex(item => item.barcode === barcodeToFind);

    if (itemIndex > -1) {
      const newItems = [...items];
      const currentItem = newItems[itemIndex];

      if (currentItem.jumlahTerima < currentItem.jumlahKirim) {
        currentItem.jumlahTerima += 1;
        setItems(newItems);
        Toast.show({
          type: 'success',
          text1: 'Scan Berhasil',
          text2: `${currentItem.nama}`,
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Info',
          text2: 'Jumlah terima sudah sesuai dengan jumlah kirim.',
        });
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Barcode tidak ditemukan di Surat Jalan ini.',
      });
    }
  };

  // Fungsi untuk menyimpan data penerimaan
  const handleSave = async () => {
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

    // Buat pesan dinamis berdasarkan adanya selisih
    let pesanKonfirmasi = `Anda akan menyimpan penerimaan untuk SJ ${sjHeader.sj_nomor} dengan total terima ${totalTerima} pcs.`;
    if (selisih > 0) {
      pesanKonfirmasi += ` Terdapat selisih ${selisih} pcs yang akan diretur. Lanjutkan?`;
    } else {
      pesanKonfirmasi += ' Tidak ada selisih. Lanjutkan?';
    }

    Alert.alert('Konfirmasi Simpan', pesanKonfirmasi, [
      // Tombol Batal
      {
        text: 'Batal',
        style: 'cancel',
      },
      // Tombol Konfirmasi untuk menyimpan
      {
        text: 'Ya, Simpan',
        onPress: async () => {
          setIsSaving(true);
          try {
            const payload = {
              header: {
                tanggalTerima: new Date().toISOString().split('T')[0],
                nomorMinta: sjHeader.sj_mt_nomor,
                nomorSj: sjHeader.sj_nomor,
              },
              items: items,
            };
            const response = await saveTerimaSjApi(payload, userToken);
            const nomorPenerimaanBaru = response.data.data.nomor;

            if (selisih > 0) {
              // Jika ada selisih, tampilkan dialog baru
              Alert.alert(
                'Terdapat Selisih',
                `Penerimaan ${nomorPenerimaanBaru} berhasil disimpan dengan selisih ${selisih} pcs. Lanjutkan untuk membuat Retur Admin?`,
                [
                  {
                    text: 'Nanti Saja',
                    onPress: () => navigation.goBack(),
                    style: 'cancel',
                  },
                  {
                    text: 'Ya, Lanjutkan',
                    // Arahkan ke halaman Retur Admin sambil membawa nomor penerimaan
                    onPress: () =>
                      navigation.navigate('ReturAdmin', {
                        tj_nomor: nomorPenerimaanBaru,
                      }),
                  },
                ],
              );
            } else {
              // Jika tidak ada selisih, langsung kembali
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: response.data.message,
              });
              navigation.goBack();
            }
          } catch (error) {
            const message =
              error.response?.data?.message || 'Gagal menyimpan penerimaan.';
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
        <Text selectable={true} style={styles.itemName} numberOfLines={2}>
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
        onSelect={handleSelectSj}
        title="Cari Surat Jalan"
        apiSearchFunction={params => searchSjToReceiveApi(params, userToken)}
        keyField="nomor"
        renderListItem={(
          item, // -> Berikan "resep" cara menampilkannya
        ) => (
          <>
            <Text style={styles.itemKode}>{item.nomor}</Text>
            <Text style={styles.itemNama}>
              Tanggal: {new Date(item.tanggal).toLocaleDateString('id-ID')}
            </Text>
          </>
        )}
      />

      <View style={styles.headerForm}>
        <TouchableOpacity
          style={styles.lookupButton}
          onPress={() => setIsModalVisible(true)}>
          <Icon
            name="search"
            size={20}
            color={sjHeader ? '#D32F2F' : '#757575'}
          />
          <Text
            style={[styles.lookupText, sjHeader && styles.lookupTextSelected]}>
            {sjHeader ? sjHeader.sj_nomor : 'Pilih Surat Jalan...'}
          </Text>
          <Icon name="chevron-down" size={20} color="#757575" />
        </TouchableOpacity>
        {sjHeader && (
          <Text style={styles.headerDetails}>
            Dari: {sjHeader.gudang_asal_nama} ({sjHeader.gudang_asal_kode})
          </Text>
        )}
      </View>

      <View style={styles.scanContainer}>
        <TextInput
          style={styles.scanInput}
          placeholder="Scan Barcode Barang Di Sini..."
          value={scannedBarcode}
          onChangeText={setScannedBarcode}
          onSubmitEditing={handleBarcodeScan}
          editable={!!sjHeader}
          placeholderTextColor="#BDBDBD"
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
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={isSaving || !sjHeader}>
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
  headerDetails: {marginTop: 8, color: '#666', fontSize: 12},
  scanContainer: {padding: 16},
  scanInput: {
    color: '#212121',
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
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
  itemName: {color: '#212121', fontSize: 16, fontWeight: '600'},
  itemDetails: {color: '#666', marginTop: 4},
  qtyContainer: {alignItems: 'flex-end', minWidth: 60},
  qtyLabel: {color: '#888', fontSize: 12},
  qtyValue: {fontSize: 20, fontWeight: 'bold', color: '#212121'},
  emptyText: {textAlign: 'center', marginTop: 40, color: '#999'},
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#D32F2F',
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
});

export default TerimaSjScreen;
