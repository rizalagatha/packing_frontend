import React, {useState, useContext, useCallback, useEffect} from 'react';
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
  searchPendingReturApi,
  loadSelisihDataApi,
  saveReturApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const ReturAdminScreen = ({navigation, route}) => {
  const {userToken} = useContext(AuthContext);
  const [penerimaan, setPenerimaan] = useState(null);
  const [headerSj, setHeaderSj] = useState(null);
  const [items, setItems] = useState([]);
  const [keterangan, setKeterangan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPenerimaan = useCallback(
    async selected => {
      setIsLoading(true);
      try {
        setPenerimaan(selected);
        const response = await loadSelisihDataApi(selected.nomor, userToken);

        setHeaderSj(response.data.data.headerSj);
        setItems(response.data.data.items);

        // -> TAMBAHKAN BARIS INI
        setKeterangan('RETUR ADMIN');
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal Memuat',
          text2: 'Gagal memuat data selisih.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [userToken],
  );

  const pending_nomor_param = route.params?.pending_nomor;

  useEffect(() => {
    if (pending_nomor_param) {
      // Gunakan variabel yang sudah diekstrak
      handleSelectPenerimaan({nomor: pending_nomor_param});
    }
    // Gunakan variabel sederhana di dependency array
  }, [pending_nomor_param, handleSelectPenerimaan]);

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
                  gudangTujuan: headerSj.gudang_asal_kode,
                  nomorPending: penerimaan.nomor, // -> Ini nomor PENDING (PD...)
                  nomorPenerimaan: penerimaan.tj_nomor, // -> Ini nomor PENERIMAAN (TJ...)
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
        <Text style={styles.itemName}>{item.nama}</Text>
        <Text style={styles.itemDetails}>Size: {item.ukuran}</Text>
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
        title="Cari Penerimaan Pending"
        apiSearchFunction={params =>
          searchPendingReturApi({...params, status: 'CLOSE'}, userToken)
        }
        keyField="nomor"
        renderListItem={item => (
          <View>
            <Text style={styles.itemKode}>{item.nomor}</Text>
            <Text style={styles.itemNama}>No. SJ: {item.sj_nomor}</Text>
            <Text style={styles.itemNama}>No. Terima: {item.tj_nomor}</Text>
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
            {penerimaan ? penerimaan.nomor : 'Pilih No. Penerimaan Pending...'}
          </Text>
          <Icon name="chevron-down" size={20} color="#757575" />
        </TouchableOpacity>
        {penerimaan && (
          <View style={styles.headerDetailsContainer}>
            <Text style={styles.headerDetails}>
              No. Terima: {penerimaan.tj_nomor}
            </Text>
            <Text style={styles.headerDetails}>
              No. SJ: {penerimaan.sj_nomor}
            </Text>
            {headerSj && (
              <Text style={styles.headerDetails}>
                Dari: {headerSj.gudang_asal_nama}
              </Text>
            )}
          </View>
        )}
        <TextInput
          style={styles.input}
          placeholder="Keterangan (opsional)..."
          value={keterangan}
          onChangeText={setKeterangan}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{marginTop: 20}} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => `${item.kode}-${item.ukuran}`}
          ListHeaderComponent={
            <Text style={styles.listTitle}>Barang yang Diretur (Selisih)</Text>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Pilih No. Penerimaan untuk memuat data selisih.
            </Text>
          }
        />
      )}

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
  headerDetailsContainer: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f0f2f5',
    borderRadius: 6,
  },
  headerDetails: {
    color: '#666',
    fontSize: 12,
  },
});

export default ReturAdminScreen;
