import React, {useState, useContext, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {getSoListMobileApi} from '../api/ApiService'; // Sesuaikan path jika berbeda
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-toast-message';

const ITEMS_PER_PAGE = 20;

const SoBrowseScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);

  // Data State
  const [soList, setSoList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filter State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);

  // --- FUNGSI FETCH DATA ---
  const fetchSoData = useCallback(
    async (targetPage = 1, isRefresh = false) => {
      if (!isRefresh && (isLoadingMore || !hasMore)) {
        return;
      }

      if (targetPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          term: searchTerm,
          page: targetPage,
          limit: ITEMS_PER_PAGE,
        };

        const response = await getSoListMobileApi(params, userToken);
        let newData = response.data.data || [];

        // Client side filter fallback (jika backend belum support search query)
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          newData = newData.filter(
            so =>
              so.nomor_so.toLowerCase().includes(term) ||
              (so.customer_nama || '').toLowerCase().includes(term),
          );
        }

        if (targetPage === 1) {
          setSoList(newData);
        } else {
          setSoList(prev => {
            const existingIds = new Set(prev.map(i => i.nomor_so));
            const uniqueNew = newData.filter(i => !existingIds.has(i.nomor_so));
            return [...prev, ...uniqueNew];
          });
        }

        if (newData.length < ITEMS_PER_PAGE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        setPage(targetPage);
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal',
          text2: 'Gagal memuat data Surat Pesanan.',
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [startDate, endDate, searchTerm, userToken, hasMore, isLoadingMore],
  );

  useEffect(() => {
    fetchSoData(1, true);
  }, [startDate, endDate, fetchSoData]);

  const handleSearch = () => {
    fetchSoData(1, true);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    setHasMore(true);
    fetchSoData(1, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchSoData(page + 1);
    }
  };

  const handleOpenScan = nomorSo => {
    // Navigasi ke halaman scanner
    navigation.navigate('SoScan', {nomor_so: nomorSo});
  };

  // --- RENDER ITEM ---
  const renderItem = ({item}) => {
    const dateStr = new Date(item.tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const isProses = item.status === 'PROSES' || item.status === 'OPEN';

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => handleOpenScan(item.nomor_so)}>
          <View style={styles.rowHeader}>
            <Text style={styles.soNumber}>{item.nomor_so}</Text>
            <Text style={styles.dateTextItem}>{dateStr}</Text>
          </View>

          <Text style={styles.customerName} numberOfLines={1}>
            {item.customer_nama || 'Customer Umum'}
          </Text>

          <View style={styles.rowFooter}>
            <View
              style={[
                styles.badge,
                isProses ? styles.badgeSuccess : styles.badgeWarning,
              ]}>
              <Text
                style={[
                  styles.badgeText,
                  isProses ? {color: '#2E7D32'} : {color: '#C62828'},
                ]}>
                {item.status || 'OPEN'}
              </Text>
            </View>

            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.actionPromptText}>Klik untuk Scan</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActions}
          onPress={() => handleOpenScan(item.nomor_so)}>
          <Icon name="maximize" size={20} color="#1976D2" />
        </TouchableOpacity>
      </View>
    );
  };

  // --- FOOTER ---
  const renderFooter = () => {
    if (soList.length === 0 && isLoading) {
      return null;
    }
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#1976D2" />
          <Text style={styles.footerText}>Memuat data...</Text>
        </View>
      );
    }
    if (hasMore && soList.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Muat Lebih Banyak</Text>
          <Icon name="chevron-down" size={16} color="#1976D2" />
        </TouchableOpacity>
      );
    }
    if (!hasMore && soList.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <Text style={styles.footerText}>Semua data sudah ditampilkan</Text>
        </View>
      );
    }
    return <View style={{height: 20}} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* FILTER SECTION */}
      <View style={styles.filterContainer}>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setOpenStartPicker(true)}>
            <Icon name="calendar" size={16} color="#555" />
            <Text style={styles.dateText}>
              {startDate.toLocaleDateString('id-ID')}
            </Text>
          </TouchableOpacity>
          <Text>-</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setOpenEndPicker(true)}>
            <Icon name="calendar" size={16} color="#555" />
            <Text style={styles.dateText}>
              {endDate.toLocaleDateString('id-ID')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={20} color="#888" style={{marginLeft: 10}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari No SO / Customer..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      {/* DATE PICKERS */}
      <DatePicker
        modal
        open={openStartPicker}
        date={startDate}
        mode="date"
        onConfirm={date => {
          setOpenStartPicker(false);
          setStartDate(date);
        }}
        onCancel={() => setOpenStartPicker(false)}
      />
      <DatePicker
        modal
        open={openEndPicker}
        date={endDate}
        mode="date"
        onConfirm={date => {
          setOpenEndPicker(false);
          setEndDate(date);
        }}
        onCancel={() => setOpenEndPicker(false)}
      />

      {/* LIST SO */}
      {isLoading && !isRefreshing ? (
        <ActivityIndicator
          size="large"
          color="#1976D2"
          style={{marginTop: 50}}
        />
      ) : (
        <FlatList
          data={soList}
          renderItem={renderItem}
          keyExtractor={item => item.nomor_so}
          contentContainerStyle={{padding: 10, paddingBottom: 80}}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada data Surat Pesanan.</Text>
          }
          ListFooterComponent={renderFooter}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},

  // Filter & Search
  filterContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    flex: 0.48,
    justifyContent: 'center',
  },
  dateText: {marginLeft: 6, color: '#333', fontSize: 12},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    height: 36,
  },
  searchInput: {flex: 1, paddingHorizontal: 10, fontSize: 13, color: '#333'},

  // COMPACT CARD
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 6,
    marginHorizontal: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 78,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soNumber: {fontSize: 13, fontWeight: 'bold', color: '#1976D2'},
  dateTextItem: {fontSize: 10, color: '#999'},
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginVertical: 2,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3},
  badgeSuccess: {
    backgroundColor: '#E8F5E9',
    borderWidth: 0.5,
    borderColor: '#C8E6C9',
  },
  badgeWarning: {
    backgroundColor: '#FFEBEE',
    borderWidth: 0.5,
    borderColor: '#FFCDD2',
  },
  badgeText: {fontSize: 9, fontWeight: 'bold'},
  actionPromptText: {fontSize: 10, color: '#1976D2', fontStyle: 'italic'},

  quickActions: {
    width: 44,
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 1,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  emptyText: {textAlign: 'center', marginTop: 50, color: '#999', fontSize: 12},

  // FOOTER LOAD MORE
  loadMoreBtn: {
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    marginHorizontal: 50,
  },
  loadMoreText: {
    color: '#1976D2',
    fontWeight: 'bold',
    marginRight: 5,
    fontSize: 12,
  },
  footerLoader: {paddingVertical: 20, alignItems: 'center'},
  footerText: {color: '#999', fontSize: 11, marginTop: 5},
});

export default SoBrowseScreen;
