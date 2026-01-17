import React, {useState, useCallback, useContext, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../context/AuthContext';
import {
  getPackingListHistoryApi,
  getPackingListHistoryDetailApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';

// Aktifkan LayoutAnimation untuk Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- HELPER UI ---
const getStatusColor = status => {
  switch (status) {
    case 'OPEN':
      return {bg: '#E3F2FD', text: '#1976D2', border: '#2196F3'}; // Biru
    case 'SENT':
      return {bg: '#FFF3E0', text: '#E65100', border: '#FF9800'}; // Orange
    case 'RECEIVED':
      return {bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50'}; // Hijau
    default:
      return {bg: '#EEEEEE', text: '#757575', border: '#9E9E9E'}; // Grey
  }
};

const formatDateDisplay = dateString => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const RiwayatPackingListScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);

  // State
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter Date
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState(0); // 0 = Hari ini

  // Expand
  const [expandedNomor, setExpandedNomor] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // --- FETCH DATA ---
  const fetchHistory = useCallback(
    async (start, end) => {
      setIsLoading(true);
      setHistory([]);
      setExpandedNomor(null);
      try {
        const params = {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
        const response = await getPackingListHistoryApi(params, userToken);
        setHistory(response.data.data);
      } catch (error) {
        console.error('Gagal load history', error);
      } finally {
        setIsLoading(false);
      }
    },
    [userToken],
  );

  useEffect(() => {
    fetchHistory(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- HANDLERS ---
  const handleQuickFilter = days => {
    setActiveQuickFilter(days);
    const end = new Date();
    const start = new Date();
    if (days > 0) start.setDate(end.getDate() - days);

    setStartDate(start);
    setEndDate(end);
    fetchHistory(start, end);
  };

  const handleItemPress = async item => {
    // Animasi Smooth Expand
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const nomorPl = item.Nomor;
    if (expandedNomor === nomorPl) {
      setExpandedNomor(null);
      return;
    }

    setExpandedNomor(nomorPl);
    setIsDetailLoading(true);
    setDetailItems([]); // Clear prev details

    try {
      const response = await getPackingListHistoryDetailApi(nomorPl, userToken);
      setDetailItems(response.data.data);
    } catch (error) {
      console.error('Error detail', error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // --- RENDERERS ---
  const renderItem = ({item}) => {
    const statusStyle = getStatusColor(item.Status);
    const isExpanded = expandedNomor === item.Nomor;

    return (
      <View style={[styles.card, {borderLeftColor: statusStyle.border}]}>
        <TouchableOpacity
          onPress={() => handleItemPress(item)}
          activeOpacity={0.8}
          style={styles.cardMain}>
          {/* Header Card: Nomor & Tanggal */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.plNomor}>{item.Nomor}</Text>
              <View style={styles.dateRow}>
                <Icon name="calendar" size={12} color="#999" />
                <Text style={styles.plDate}>
                  {formatDateDisplay(item.Tanggal)}
                </Text>
              </View>
            </View>
            <View
              style={[styles.statusBadge, {backgroundColor: statusStyle.bg}]}>
              <Text style={[styles.statusText, {color: statusStyle.text}]}>
                {item.Status}
              </Text>
            </View>
          </View>

          {/* Divider Halus */}
          <View style={styles.divider} />

          {/* Body Card: Toko & Info */}
          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Icon name="map-pin" size={14} color="#555" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>Tujuan</Text>
                <Text style={styles.valueStore}>{item.Nama_Store}</Text>
                <Text style={styles.subValue}>{item.Store}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Jenis</Text>
                <Text style={styles.statValue}>{item.JmlJenis}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Qty</Text>
                <Text style={[styles.statValue, {color: '#1976D2'}]}>
                  {Math.round(item.TotalQty)} {/* Tambahkan Math.round() */}
                </Text>
              </View>
            </View>
          </View>

          {/* Indikator Expand */}
          <View style={styles.expandIndicator}>
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#CCC"
            />
          </View>
        </TouchableOpacity>

        {/* --- EXPANDABLE SECTION --- */}
        {isExpanded && (
          <View style={styles.detailSection}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Rincian Barang</Text>
              {item.Status === 'OPEN' && (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('PackingList', {nomor: item.Nomor})
                  }
                  style={styles.editButtonSmall}>
                  <Text style={styles.editText}>Edit</Text>
                  <Icon
                    name="edit-2"
                    size={12}
                    color="#FFF"
                    style={{marginLeft: 4}}
                  />
                </TouchableOpacity>
              )}
            </View>

            {isDetailLoading ? (
              <ActivityIndicator
                size="small"
                color="#1976D2"
                style={{margin: 20}}
              />
            ) : (
              detailItems.map((dtl, index) => (
                <View key={index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{dtl.Nama}</Text>
                    <View style={styles.badgesRow}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{dtl.Kode}</Text>
                      </View>
                      <View style={styles.sizeBadge}>
                        <Text style={styles.sizeText}>{dtl.Ukuran}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.itemQty}>x{Math.round(dtl.Jumlah)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* FILTER SECTION (FIXED TOP) */}
      <View style={styles.filterSection}>
        {/* Date Selector */}
        <View style={styles.dateSelectorRow}>
          <TouchableOpacity
            style={styles.dateBox}
            onPress={() => setOpenStartPicker(true)}>
            <Text style={styles.dateLabel}>Dari</Text>
            <View style={styles.dateValueRow}>
              <Icon name="calendar" size={16} color="#1976D2" />
              <Text style={styles.dateValue}>
                {formatDateDisplay(startDate.toISOString())}
              </Text>
            </View>
          </TouchableOpacity>

          <Icon
            name="arrow-right"
            size={16}
            color="#CCC"
            style={{marginHorizontal: 8}}
          />

          <TouchableOpacity
            style={styles.dateBox}
            onPress={() => setOpenEndPicker(true)}>
            <Text style={styles.dateLabel}>Sampai</Text>
            <View style={styles.dateValueRow}>
              <Icon name="calendar" size={16} color="#1976D2" />
              <Text style={styles.dateValue}>
                {formatDateDisplay(endDate.toISOString())}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => fetchHistory(startDate, endDate)}>
            <Icon name="search" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Quick Filter Chips */}
        <View style={styles.chipsRow}>
          {[
            {l: 'Hari Ini', v: 0},
            {l: '7 Hari', v: 7},
            {l: '30 Hari', v: 30},
          ].map(chip => (
            <TouchableOpacity
              key={chip.v}
              onPress={() => handleQuickFilter(chip.v)}
              style={[
                styles.chip,
                activeQuickFilter === chip.v && styles.chipActive,
              ]}>
              <Text
                style={[
                  styles.chipText,
                  activeQuickFilter === chip.v && styles.chipTextActive,
                ]}>
                {chip.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* DATE PICKER MODALS */}
      <DatePicker
        modal
        mode="date"
        open={openStartPicker}
        date={startDate}
        onConfirm={d => {
          setOpenStartPicker(false);
          setStartDate(d);
        }}
        onCancel={() => setOpenStartPicker(false)}
      />
      <DatePicker
        modal
        mode="date"
        open={openEndPicker}
        date={endDate}
        onConfirm={d => {
          setOpenEndPicker(false);
          setEndDate(d);
        }}
        onCancel={() => setOpenEndPicker(false)}
      />

      {/* MAIN LIST */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Memuat Riwayat...</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.Nomor}
          contentContainerStyle={{padding: 16, paddingBottom: 40}}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => fetchHistory(startDate, endDate)}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Icon name="inbox" size={40} color="#CCC" />
              </View>
              <Text style={styles.emptyTitle}>Tidak ada data</Text>
              <Text style={styles.emptySub}>
                Coba ubah filter tanggal pencarian
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F6FA'},

  // --- FILTER HEADER ---
  filterSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateBox: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  dateLabel: {fontSize: 10, color: '#999', marginBottom: 2},
  dateValueRow: {flexDirection: 'row', alignItems: 'center'},
  dateValue: {fontSize: 13, color: '#333', fontWeight: '600', marginLeft: 6},

  searchButton: {
    backgroundColor: '#1976D2',
    width: 44,
    height: 44,
    borderRadius: 12,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1976D2',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  chipsRow: {flexDirection: 'row'},
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#1976D2',
  },
  chipText: {fontSize: 12, color: '#666'},
  chipTextActive: {color: '#1976D2', fontWeight: 'bold'},

  // --- CARD STYLE ---
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 5, // Status Color Stripe
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardMain: {padding: 16},

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  plNomor: {
    fontSize: 16,
    fontWeight: '800',
    color: '#263238',
    letterSpacing: 0.5,
  },
  dateRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  plDate: {fontSize: 12, color: '#90A4AE', marginLeft: 4},

  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6},
  statusText: {fontSize: 11, fontWeight: '700'},

  divider: {height: 1, backgroundColor: '#F5F5F5', marginVertical: 12},

  // Card Body
  cardBody: {flexDirection: 'row', justifyContent: 'space-between'},
  infoRow: {flexDirection: 'row', flex: 1},
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  label: {fontSize: 10, color: '#999'},
  valueStore: {fontSize: 14, fontWeight: '600', color: '#37474F'},
  subValue: {fontSize: 12, color: '#78909C'},

  statsRow: {alignItems: 'flex-end'},
  statItem: {alignItems: 'flex-end', marginBottom: 4},
  statLabel: {fontSize: 10, color: '#B0BEC5'},
  statValue: {fontSize: 14, fontWeight: 'bold', color: '#455A64'},

  expandIndicator: {alignItems: 'center', marginTop: -5},

  // --- DETAIL SECTION ---
  detailSection: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#607D8B',
    textTransform: 'uppercase',
  },
  editButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FB8C00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editText: {fontSize: 11, color: '#FFF', fontWeight: 'bold'},

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  itemInfo: {flex: 1, paddingRight: 10},
  itemName: {fontSize: 13, color: '#37474F', marginBottom: 4},
  badgesRow: {flexDirection: 'row'},
  codeBadge: {
    backgroundColor: '#ECEFF1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  codeText: {
    fontSize: 10,
    color: '#546E7A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sizeBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeText: {fontSize: 10, color: '#EF6C00', fontWeight: 'bold'},
  itemQty: {fontSize: 15, fontWeight: 'bold', color: '#37474F'},

  // Loading & Empty
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  loadingText: {marginTop: 10, color: '#999', fontSize: 13},
  emptyState: {alignItems: 'center', marginTop: 60},
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {fontSize: 16, fontWeight: 'bold', color: '#616161'},
  emptySub: {fontSize: 13, color: '#9E9E9E', marginTop: 4},
});

export default RiwayatPackingListScreen;
