import React, {useState, useEffect, useContext, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker'; // <--- Menggunakan DatePicker baru
import {AuthContext} from '../context/AuthContext';
import {getLostOrderHistoryApi} from '../api/ApiService';
import Toast from 'react-native-toast-message';

// Helper Format Tanggal untuk API (YYYY-MM-DD)
const formatDateForApi = date => {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) {
    month = '0' + month;
  }
  if (day.length < 2) {
    day = '0' + day;
  }

  return [year, month, day].join('-');
};

// Helper Format Tanggal Tampil di List (DD MMM YYYY, HH:mm)
const formatDisplayDate = dateString => {
  if (!dateString) {
    return '-';
  }
  const d = new Date(dateString);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const LostOrderScreen = () => {
  const {userToken} = useContext(AuthContext);

  // State Data
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // State Filter Tanggal (Sesuai dengan PenjualanListScreen)
  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7)),
  ); // Default H-7
  const [endDate, setEndDate] = useState(new Date());
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);

  const fetchHistory = useCallback(
    async (pageNumber = 1, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNumber === 1) {
        setLoading(true);
      }

      try {
        const params = {
          startDate: formatDateForApi(startDate),
          endDate: formatDateForApi(endDate),
          page: pageNumber,
          limit: 15,
        };

        const res = await getLostOrderHistoryApi(params, userToken);
        const fetchedData = res.data.data || [];
        const pagination = res.data.pagination;

        if (pageNumber === 1) {
          setData(fetchedData);
        } else {
          setData(prev => [...prev, ...fetchedData]);
        }

        setHasMore(pageNumber < pagination.totalPages);
        setPage(pageNumber);
      } catch (error) {
        const msg = error.response?.data?.message || 'Gagal memuat riwayat.';
        Toast.show({type: 'error', text1: 'Error', text2: msg});
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startDate, endDate, userToken],
  );

  // Load awal & ketika filter tanggal berubah
  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleRefresh = () => {
    fetchHistory(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && !refreshing && hasMore) {
      fetchHistory(page + 1);
    }
  };

  const renderItem = ({item}) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateTextItem}>
            {formatDisplayDate(item.lo_tanggal)}
          </Text>
          <View style={styles.reasonBadge}>
            <Text style={styles.reasonText}>{item.lo_alasan || 'Lainnya'}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productName}>{item.lo_produk_nama}</Text>

          <View style={styles.badgesRow}>
            <View style={styles.badgeInfo}>
              <Icon
                name="tag"
                size={12}
                color="#1976D2"
                style={styles.iconMarginRight}
              />
              <Text style={styles.badgeInfoText}>Ukuran: {item.lo_ukuran}</Text>
            </View>
            <View style={[styles.badgeInfo, styles.warningBadge]}>
              <Icon
                name="box"
                size={12}
                color="#F57C00"
                style={styles.iconMarginRight}
              />
              <Text style={[styles.badgeInfoText, styles.warningBadgeText]}>
                Qty: {item.lo_qty}
              </Text>
            </View>
          </View>

          {(item.lo_customer_nama || item.lo_customer_telp) && (
            <View style={styles.customerBox}>
              <Icon name="user" size={14} color="#555" />
              <Text style={styles.customerText}>
                {item.lo_customer_nama || 'Tanpa Nama'}{' '}
                {item.lo_customer_telp ? `(${item.lo_customer_telp})` : ''}
              </Text>
            </View>
          )}

          {item.lo_catatan && (
            <Text style={styles.noteText} numberOfLines={3}>
              Catatan: {item.lo_catatan}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* FILTER TANGGAL */}
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
          <Text style={styles.separatorText}>-</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setOpenEndPicker(true)}>
            <Icon name="calendar" size={16} color="#555" />
            <Text style={styles.dateText}>
              {endDate.toLocaleDateString('id-ID')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* DATE PICKERS (MODAL) */}
      <DatePicker
        modal
        open={openStartPicker}
        date={startDate}
        mode="date"
        maximumDate={new Date()} // Cegah pilih tanggal di masa depan
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
        maximumDate={new Date()}
        onConfirm={date => {
          setOpenEndPicker(false);
          setEndDate(date);
        }}
        onCancel={() => setOpenEndPicker(false)}
      />

      {/* LIST DATA */}
      {loading && page === 1 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E91E63" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.lo_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#E91E63']}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore && !loading && data.length > 0 ? (
              <ActivityIndicator
                size="small"
                color="#E91E63"
                style={styles.loadingFooter}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={48} color="#DDD" />
              <Text style={styles.emptyText}>
                Tidak ada riwayat lost order.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    flex: 0.45,
    justifyContent: 'center',
  },
  dateText: {
    marginLeft: 6,
    color: '#333',
    fontSize: 13,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 15,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    elevation: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dateTextItem: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  reasonBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reasonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  cardBody: {
    padding: 15,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#BBDEFB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeInfoText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
  },
  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  customerText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 8,
    fontWeight: '500',
  },
  noteText: {
    fontSize: 13,
    color: '#757575',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 14,
    color: '#999',
  },
  iconMarginRight: {
    marginRight: 4,
  },

  warningBadge: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFE0B2',
  },

  warningBadgeText: {
    color: '#E65100',
  },

  separatorText: {
    color: '#555',
    marginHorizontal: 5,
  },

  loadingFooter: {
    marginVertical: 15,
  },
});

export default LostOrderScreen;
