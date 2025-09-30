import React, {useState, useEffect, useCallback, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {getPackingHistoryApi, getPackingDetailApi} from '../api/ApiService'; // -> Tambah getPackingDetailApi
import Icon from 'react-native-vector-icons/Feather';

const PackingHistoryScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State baru untuk mengelola item yang sedang dibuka
  const [expandedNomor, setExpandedNomor] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await getPackingHistoryApi(userToken);
      setHistory(response.data.data);
    } catch (error) {
      console.error('Gagal memuat riwayat', error);
    }
  }, [userToken]);

  useEffect(() => {
    fetchHistory();
    const unsubscribe = navigation.addListener('focus', () => fetchHistory());
    return unsubscribe;
  }, [navigation, fetchHistory]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchHistory().finally(() => setIsRefreshing(false));
  }, [fetchHistory]);

  // Fungsi saat item di-klik
  const handleItemPress = async item => {
    const packNomor = item.pack_nomor;
    // Jika item yang sama di-klik lagi, tutup detailnya
    if (expandedNomor === packNomor) {
      setExpandedNomor(null);
      setDetailItems([]);
      return;
    }

    setExpandedNomor(packNomor); // Buka item yang di-klik
    setIsDetailLoading(true);
    try {
      const response = await getPackingDetailApi(packNomor, userToken);
      setDetailItems(response.data.data.items);
    } catch (error) {
      console.error('Gagal memuat detail', error);
      setExpandedNomor(null); // Tutup lagi jika error
    } finally {
      setIsDetailLoading(false);
    }
  };

  const renderItem = ({item}) => (
    <View style={styles.historyItemWrapper}>
      <TouchableOpacity
        style={styles.historyItem}
        onPress={() => handleItemPress(item)}>
        <View>
          <Text style={styles.historyNomor}>{item.pack_nomor}</Text>
          <Text style={styles.historyTanggal}>
            {new Date(item.pack_tanggal).toLocaleDateString('id-ID')} -{' '}
            {item.pack_keterangan || 'Tanpa Keterangan'}
          </Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text style={styles.historyJumlah}>{item.jumlah_item} item</Text>
          <Icon
            name={
              expandedNomor === item.pack_nomor ? 'chevron-up' : 'chevron-down'
            }
            size={24}
            color="#666"
          />
        </View>
      </TouchableOpacity>

      {/* Tampilkan detail jika item ini sedang dibuka */}
      {expandedNomor === item.pack_nomor && (
        <View style={styles.detailContainer}>
          {isDetailLoading ? (
            <ActivityIndicator />
          ) : (
            detailItems.map((detail, index) => (
              <View key={index} style={styles.detailItem}>
                <Text style={styles.detailName}>
                  {detail.packd_brg_kaosan} ({detail.size})
                </Text>
                <Text style={styles.detailQty}>x {detail.packd_qty}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f2f5" />
      <FlatList
        data={history}
        keyExtractor={item => item.pack_nomor}
        renderItem={renderItem}
        extraData={expandedNomor} // -> Memberitahu FlatList untuk re-render saat state ini berubah
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyHistory}>Belum ada riwayat packing.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{paddingTop: 16}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f2f5'},
  historyItemWrapper: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyItem: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyNomor: {fontWeight: 'bold', fontSize: 16, color: '#2D3748'},
  historyTanggal: {color: '#666', fontSize: 12, marginTop: 4},
  historyJumlah: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginRight: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '50%',
  },
  emptyHistory: {textAlign: 'center', color: '#999'},

  // Style baru untuk bagian detail
  detailContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailName: {
    color: '#333',
    fontSize: 14,
  },
  detailQty: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default PackingHistoryScreen;
