import React, {useState, useCallback, useContext, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../context/AuthContext';
import {searchPendingReturApi, loadSelisihDataApi} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';

const LaporanPendingScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [pendingList, setPendingList] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [expandedNomor, setExpandedNomor] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchPendingList = useCallback(async () => {
    try {
      // Kirim parameter status: 'OPEN'
      const response = await searchPendingReturApi({status: 'OPEN'}, userToken);
      setPendingList(response.data.data.items);
    } catch (error) {
      console.error('Gagal memuat laporan pending', error);
    }
  }, [userToken]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPendingList();
    });
    return unsubscribe;
  }, [navigation, fetchPendingList]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchPendingList().finally(() => setIsRefreshing(false));
  }, [fetchPendingList]);

  const handleItemPress = async item => {
    const pendingNomor = item.nomor;
    if (expandedNomor === pendingNomor) {
      setExpandedNomor(null);
      return;
    }

    setExpandedNomor(pendingNomor);
    setIsDetailLoading(true);
    try {
      const response = await loadSelisihDataApi(pendingNomor, userToken);
      setDetailItems(response.data.data.items);
    } catch (error) {
      console.error('Gagal memuat detail pending', error);
      setExpandedNomor(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F8" />
      <FlatList
        data={pendingList}
        keyExtractor={item => item.nomor}
        extraData={expandedNomor}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <Text style={styles.pageTitle}>Penerimaan Pending (Open)</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Tidak ada data penerimaan pending.
            </Text>
          </View>
        }
        renderItem={({item}) => (
          <View style={styles.itemWrapper}>
            <TouchableOpacity
              style={styles.itemHeader}
              onPress={() => handleItemPress(item)}>
              <View>
                <Text style={styles.itemNomor}>{item.nomor}</Text>
                <Text style={styles.itemTanggal}>
                  Tgl: {new Date(item.tanggal).toLocaleDateString('id-ID')} |
                  No. SJ: {item.sj_nomor}
                </Text>
              </View>
              <Icon
                name={
                  expandedNomor === item.nomor ? 'chevron-up' : 'chevron-down'
                }
                size={24}
                color="#616161"
              />
            </TouchableOpacity>

            {expandedNomor === item.nomor && (
              <View style={styles.detailContainer}>
                {isDetailLoading ? (
                  <ActivityIndicator color="#D32F2F" />
                ) : (
                  detailItems.map((detail, index) => (
                    <View key={index} style={styles.detailItem}>
                      <View style={{flex: 1}}>
                        <Text style={styles.detailName}>{detail.nama}</Text>
                        <Text style={styles.detailSize}>
                          Size: {detail.ukuran}
                        </Text>
                      </View>
                      <View style={{alignItems: 'flex-end'}}>
                        <Text style={styles.detailSelisih}>
                          Selisih: {detail.selisih}
                        </Text>
                        <Text style={styles.detailInfo}>
                          Kirim: {detail.jumlahKirim} | Terima:{' '}
                          {detail.jumlahTerima}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  pageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  itemWrapper: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  itemHeader: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemNomor: {fontWeight: 'bold', fontSize: 16, color: '#2D3748'},
  itemTanggal: {color: '#757575', fontSize: 12, marginTop: 4},
  detailContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailName: {fontSize: 14, color: '#212121', fontWeight: '600'},
  detailSize: {fontSize: 12, color: '#757575'},
  detailSelisih: {fontSize: 14, fontWeight: 'bold', color: '#D32F2F'},
  detailInfo: {fontSize: 12, color: '#757575'},
  emptyContainer: {alignItems: 'center', marginTop: 50},
  emptyText: {color: '#757575', fontSize: 16},
});

export default LaporanPendingScreen;
