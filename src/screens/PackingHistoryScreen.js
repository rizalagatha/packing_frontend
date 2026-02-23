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
  SafeAreaView,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {getPackingHistoryApi, getPackingDetailApi} from '../api/ApiService'; // -> Tambah getPackingDetailApi
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-toast-message';

const formatDate = date => {
  return date.toISOString().split('T')[0];
};

// Komponen terpisah untuk merender item header
const HistoryHeaderItem = React.memo(({item, onPress, isExpanded}) => (
  <TouchableOpacity
    style={styles.historyItemWrapper}
    onPress={() => onPress(item)}>
    <View style={styles.historyItem}>
      <View style={styles.historyInfo}>
        <Text style={styles.historyNomor}>{item.pack_nomor}</Text>
        <Text style={styles.historySpk}>SPK: {item.pack_spk_nomor}</Text>
      </View>
      <View style={styles.historyQtyContainer}>
        <Text style={styles.historyJumlah}>{item.total_qty || 0} Pcs</Text>
        <Text style={styles.historyTanggal}>
          {new Date(item.pack_tanggal).toLocaleDateString('id-ID')}
        </Text>
      </View>
      <Icon
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color="#616161"
      />
    </View>
  </TouchableOpacity>
));

// Komponen terpisah untuk merender item detail
const HistoryDetailItem = React.memo(({detail}) => (
  <View style={styles.detailItem}>
    <View style={styles.detailInfo}>
      {/* --- PERBAIKAN DI SINI --- */}
      <Text style={styles.detailName}>{detail.brg_kaosan}</Text>
      <Text style={styles.detailSize}>Size: {detail.packd_size}</Text>
      {/* ------------------------- */}
    </View>
    <Text style={styles.detailQty}>x {detail.packd_qty}</Text>
  </View>
));

const FilterComponent = ({
  onFilterPress,
  onApplyFilter,
  setStartDate,
  setEndDate,
  startDate,
  endDate,
  openStartPicker,
  setOpenStartPicker,
  openEndPicker,
  setOpenEndPicker,
}) => (
  <View style={styles.filterContainer}>
    <View style={styles.dateFilterSection}>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={() => setOpenStartPicker(true)}>
        <Icon name="calendar" size={16} color="#616161" />
        <Text style={styles.dateText}>
          {startDate.toLocaleDateString('id-ID')}
        </Text>
      </TouchableOpacity>
      <Text style={{marginHorizontal: 5}}>s/d</Text>
      <TouchableOpacity
        style={styles.dateInput}
        onPress={() => setOpenEndPicker(true)}>
        <Icon name="calendar" size={16} color="#616161" />
        <Text style={styles.dateText}>
          {endDate.toLocaleDateString('id-ID')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.applyButton} onPress={onApplyFilter}>
        <Icon name="search" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
    <View style={styles.quickFilterSection}>
      <TouchableOpacity
        style={styles.quickFilterButton}
        onPress={() => onFilterPress('today')}>
        <Text style={styles.quickFilterText}>Hari Ini</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickFilterButton}
        onPress={() => onFilterPress('7days')}>
        <Text style={styles.quickFilterText}>7 Hari</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.quickFilterButton}
        onPress={() => onFilterPress('30days')}>
        <Text style={styles.quickFilterText}>30 Hari</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const PackingHistoryScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // State baru untuk mengelola item yang sedang dibuka
  const [expandedNomor, setExpandedNomor] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);

  const [pagination, setPagination] = useState({currentPage: 1, totalPages: 1});

  const fetchHistory = useCallback(
    async (start, end, page = 1) => {
      if (page === 1) {
        setIsRefreshing(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = {
          filterByUser: 'true',
          startDate: formatDate(start),
          endDate: formatDate(end),
          page: page,
          limit: 15,
        };

        const response = await getPackingHistoryApi(params, userToken);
        const newData = response.data.data || [];

        setHistory(prev => {
          // Jika halaman 1, langsung pakai data baru
          if (page === 1) return newData;

          // Gabungkan data lama dan baru
          const combined = [...prev, ...newData];

          // DEDUPLIKASI: Pakai Map agar super cepat
          // Kita pakai pack_nomor sebagai ID unik.
          const uniqueMap = new Map();
          combined.forEach(item => {
            uniqueMap.set(item.pack_nomor, item);
          });

          // Kembalikan ke Array dan urutkan (Descending)
          return Array.from(uniqueMap.values()).sort((a, b) => {
            return b.pack_nomor.localeCompare(a.pack_nomor, undefined, {
              numeric: true,
            });
          });
        });

        setPagination(response.data.pagination);
      } catch (error) {
        console.error('Gagal memuat:', error);
      } finally {
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [userToken],
  );

  useEffect(() => {
    const today = new Date();
    fetchHistory(today, today, 1);
  }, [fetchHistory]); // Hanya dijalankan sekali

  const onRefresh = useCallback(() => {
    fetchHistory(startDate, endDate, 1); // Refresh selalu panggil halaman 1
  }, [startDate, endDate, fetchHistory]);

  const handleQuickFilter = period => {
    const today = new Date();
    let newStartDate = new Date();
    const newEndDate = new Date(today); // End date selalu hari ini

    if (period === '7days') {
      newStartDate.setDate(today.getDate() - 6);
    } else if (period === '30days') {
      newStartDate.setDate(today.getDate() - 29);
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    fetchHistory(newStartDate, newEndDate, 1);
  };

  const handleApplyCustomFilter = () => {
    fetchHistory(startDate, endDate, 1); // Filter custom selalu panggil halaman 1
  };

  const handleLoadMore = () => {
    // Kunci: Hanya jalan jika tidak sedang loading, tidak sedang refresh,
    // dan halaman sekarang belum mencapai halaman terakhir.
    if (
      !isLoadingMore &&
      !isRefreshing &&
      pagination.currentPage < pagination.totalPages
    ) {
      console.log('--- LOADING PAGE:', pagination.currentPage + 1); // Log untuk debug
      fetchHistory(startDate, endDate, pagination.currentPage + 1);
    }
  };

  // Fungsi saat item di-klik
  const handleItemPress = async item => {
    const nomor = item.pack_nomor;
    if (expandedNomor === nomor) {
      setExpandedNomor(null);
      return;
    }

    setExpandedNomor(nomor);
    setIsDetailLoading(true);
    try {
      const response = await getPackingDetailApi(nomor, userToken);
      setDetailItems(response.data.data.items);
    } catch (error) {
      console.error('Gagal memuat detail packing', error);
      setExpandedNomor(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const renderItem = ({item}) => (
    <View>
      <HistoryHeaderItem
        item={item}
        onPress={handleItemPress}
        isExpanded={expandedNomor === item.pack_nomor}
      />
      {expandedNomor === item.pack_nomor && (
        <View style={styles.detailContainer}>
          {isDetailLoading ? (
            <ActivityIndicator color="#D32F2F" />
          ) : (
            detailItems.map((detail, index) => (
              <HistoryDetailItem
                key={`${detail.packd_barcode}-${index}`}
                detail={detail}
              />
            ))
          )}
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <ActivityIndicator
          size="large"
          color="#D32F2F"
          style={{marginVertical: 20}}
        />
      );
    }
    if (pagination.currentPage < pagination.totalPages) {
      return (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Muat Data Berikutnya</Text>
        </TouchableOpacity>
      );
    }
    return null; // Tidak menampilkan apa-apa jika sudah halaman terakhir
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* --- Panggil Komponen Filter --- */}
      <FilterComponent
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        openStartPicker={openStartPicker}
        setOpenStartPicker={setOpenStartPicker}
        openEndPicker={openEndPicker}
        setOpenEndPicker={setOpenEndPicker}
        onFilterPress={handleQuickFilter}
        onApplyFilter={handleApplyCustomFilter}
      />

      <DatePicker
        modal
        mode="date"
        open={openStartPicker}
        date={startDate}
        onConfirm={date => {
          setOpenStartPicker(false);
          setStartDate(date);
        }}
        onCancel={() => {
          setOpenStartPicker(false);
        }}
      />
      <DatePicker
        modal
        mode="date"
        open={openEndPicker}
        date={endDate}
        onConfirm={date => {
          setOpenEndPicker(false);
          setEndDate(date);
        }}
        onCancel={() => {
          setOpenEndPicker(false);
        }}
      />

      <FlatList
        data={history}
        // Pakai index sebagai tambahan jika pack_nomor ada yang kembar (darurat)
        keyExtractor={(item, index) => `${item.pack_nomor}-${index}`}
        renderItem={renderItem}
        extraData={expandedNomor} // Penting agar accordion tetap responsif
        // Optimasi Performa Scroll
        removeClippedSubviews={true} // Item yang tidak terlihat akan dihapus dari memori
        initialNumToRender={10} // Render 10 item awal dulu
        maxToRenderPerBatch={10} // Render 10 item per batch scroll
        windowSize={5} // Batasi jumlah item yang standby di memori
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2} // Trigger load more saat sisa 20% scroll
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f2f5'},
  filterContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dateFilterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F4F6F8',
  },
  dateText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#212121',
  },
  applyButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#616161',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickFilterSection: {
    flexDirection: 'row',
    marginTop: 12,
  },
  quickFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 8,
  },
  quickFilterText: {
    color: '#616161',
    fontSize: 12,
  },
  historyItemWrapper: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    elevation: 2,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  historyInfo: {
    flex: 1,
  },
  historyNomor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  historySpk: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  historyQtyContainer: {
    alignItems: 'flex-end',
    marginHorizontal: 10,
  },
  historyJumlah: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  historyTanggal: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  detailContainer: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginHorizontal: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailInfo: {
    flex: 1,
    marginRight: 10,
  },
  detailName: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '600',
  },
  detailSize: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  detailQty: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#757575',
    fontSize: 16,
  },
  loadMoreButton: {
    backgroundColor: '#616161',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    margin: 16,
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PackingHistoryScreen;
