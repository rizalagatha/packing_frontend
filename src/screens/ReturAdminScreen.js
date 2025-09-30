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
  searchPenerimaanSjApi,
  loadSelisihDataApi,
  saveReturApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const ReturAdminScreen = ({navigation}) => {
  const {userInfo, userToken} = useContext(AuthContext);
  const [penerimaan, setPenerimaan] = useState(null);
  const [items, setItems] = useState([]);
  const [keterangan, setKeterangan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleSelectPenerimaan = async selected => {
    try {
      setPenerimaan(selected);
      const response = await loadSelisihDataApi(selected.nomor, userToken);
      setItems(response.data.data);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal Memuat',
        text2: 'Gagal memuat data selisih barang.',
      });
    }
  };

  const handleSave = async () => {
    if (!penerimaan || items.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Data Tidak Lengkap',
        text2: 'Pilih nomor penerimaan terlebih dahulu.',
      });
      return;
    }

    // Menghitung total kuantitas selisih untuk pesan konfirmasi
    const totalSelisih = items.reduce((sum, item) => sum + item.selisih, 0);

    Alert.alert(
      'Konfirmasi Simpan Retur', // Judul
      `Anda akan membuat retur dari No. Penerimaan ${penerimaan.nomor} dengan total selisih ${totalSelisih} pcs. Lanjutkan?`, // Pesan
      [
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
                  tanggalRetur: new Date().toISOString().split('T')[0],
                  gudangTujuan: penerimaan.no_sj.substring(0, 3), // Ambil kode DC dari No. SJ
                  nomorPenerimaan: penerimaan.nomor,
                  keterangan: keterangan,
                },
                items: items,
              };
              const response = await saveReturApi(payload, userToken);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: response.data.message,
              });
              navigation.popToTop();
            } catch (error) {
              const message =
                error.response?.data?.message || 'Gagal menyimpan retur.';
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
        <Text style={styles.qtyLabel}>
          Kirim: {item.jumlahKirim} | Terima: {item.jumlahTerima}
        </Text>
        <Text style={styles.selisihValue}>{item.selisih}</Text>
        <Text style={styles.qtyLabel}>Selisih</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SearchModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSelect={handleSelectPenerimaan}
        title="Cari Penerimaan SJ"
        apiSearchFunction={params => searchPenerimaanSjApi(params, userToken)}
        keyField="nomor"
        renderListItem={item => (
          <View style={styles.listItemContainer}>
            <View>
              <Text style={styles.itemKode}>{item.nomor}</Text>
              <Text style={styles.itemNama}>
                No. SJ: {item.no_sj} - Tgl:{' '}
                {new Date(item.tanggal).toLocaleDateString('id-ID')}
              </Text>
            </View>
            {/* -> TAMPILKAN BADGE STATUS */}
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.headerForm}>
        <TouchableOpacity
          style={styles.lookupButton}
          onPress={() => setIsModalVisible(true)}>
          <Icon
            name="search"
            size={20}
            color={penerimaan ? '#D32F2F' : '#757575'}
          />
          <Text
            style={[
              styles.lookupText,
              penerimaan && styles.lookupTextSelected,
            ]}>
            {penerimaan ? penerimaan.nomor : 'Pilih No. Penerimaan SJ...'}
          </Text>
          <Icon name="chevron-down" size={20} color="#757575" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Keterangan (opsional)..."
          value={keterangan}
          onChangeText={setKeterangan}
          placeholderTextColor="#BDBDBD"
        />
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => `${item.kode}-${item.ukuran}`}
        ListHeaderComponent={
          <Text selectable={true} style={styles.listTitle}>
            Barang yang Diretur (Selisih)
          </Text>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Pilih No. Penerimaan untuk memuat data selisih.
          </Text>
        }
      />

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleSave}
          disabled={isSaving || !penerimaan}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Simpan Retur</Text>
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
    marginBottom: 12,
  },
  lookupText: {flex: 1, fontSize: 16, marginHorizontal: 10, color: '#757575'},
  lookupTextSelected: {color: '#212121', fontWeight: '600'},
  input: {
    backgroundColor: '#F4F6F8',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#212121',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    paddingBottom: 8,
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
  qtyContainer: {alignItems: 'center', minWidth: 80},
  qtyLabel: {color: '#888', fontSize: 12},
  selisihValue: {fontSize: 22, fontWeight: 'bold', color: '#D32F2F'},
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
  listItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#E8F5E9', // Warna hijau muda
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#4CAF50', // Warna hijau tua
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Style untuk item di SearchModal (opsional, jika belum ada)
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
});

export default ReturAdminScreen;
