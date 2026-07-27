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
import {getMintaBahanListApi} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-toast-message';

const statusBadgeStyle = status => {
  switch (status) {
    case 'OPEN':
      return {bg: '#E3F2FD', border: '#BBDEFB', text: '#1565C0'};
    case 'PROSES':
      return {bg: '#FFF3E0', border: '#FFE0B2', text: '#E65100'};
    case 'CLOSE':
      return {bg: '#E8F5E9', border: '#C8E6C9', text: '#2E7D32'};
    case 'DICLOSE':
      return {bg: '#FFEBEE', border: '#FFCDD2', text: '#C62828'};
    default:
      return {bg: '#F5F5F5', border: '#E0E0E0', text: '#666'};
  }
};

const jenisBadgeStyle = jenis =>
  jenis === 'OBAT'
    ? {bg: '#F3E5F5', text: '#7B1FA2'}
    : {bg: '#E0F2F1', text: '#00796B'};

const MintaBahanBrowseScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);

  const [list, setList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Default filter: 30 hari terakhir
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [keyword, setKeyword] = useState('');
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) {
        setIsLoading(true);
      }
      try {
        const params = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          keyword: keyword || undefined,
        };
        const response = await getMintaBahanListApi(params, userToken);
        setList(response.data.data || []);
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal',
          text2: 'Gagal memuat data Permintaan.',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [startDate, endDate, keyword, userToken],
  );

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, fetchData]);

  const handleSearch = () => fetchData();

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchData(true);
  };

  const handleOpenDetail = nomor => {
    navigation.navigate('MintaBahanDetail', {nomor});
  };

  const renderItem = ({item}) => {
    const dateStr = new Date(item.Tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const statusStyle = statusBadgeStyle(item.Status);
    const jenisStyle = jenisBadgeStyle(item.Jenis);
    const needsApproval = item.Approve === 'N';
    const fullyApproved = item.Approve === 'Y';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenDetail(item.Nomor)}
        activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.nomorText}>{item.Nomor}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        <Text style={styles.namaSpk} numberOfLines={1}>
          {item.NamaSpk || item.Keterangan || 'Tanpa Keterangan'}
        </Text>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, {backgroundColor: jenisStyle.bg}]}>
            <Text style={[styles.badgeText, {color: jenisStyle.text}]}>
              {item.Jenis}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: statusStyle.bg,
                borderWidth: 0.5,
                borderColor: statusStyle.border,
              },
            ]}>
            <Text style={[styles.badgeText, {color: statusStyle.text}]}>
              {item.Status}
            </Text>
          </View>

          {needsApproval && (
            <View style={[styles.badge, styles.badgeNeedsApproval]}>
              <Icon name="clock" size={10} color="#E65100" />
              <Text
                style={[styles.badgeText, {color: '#E65100', marginLeft: 3}]}>
                Perlu Approve
              </Text>
            </View>
          )}
          {fullyApproved && (
            <View style={[styles.badge, styles.badgeApproved]}>
              <Icon name="check" size={10} color="#2E7D32" />
              <Text
                style={[styles.badgeText, {color: '#2E7D32', marginLeft: 3}]}>
                Approved
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            Peminta: {item.Usr} · {item.Bagian || '-'}
          </Text>
          <Icon name="chevron-right" size={18} color="#BDBDBD" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterContainer}>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setOpenStartPicker(true)}>
            <Icon name="calendar" size={16} color="#555" />
            <Text style={styles.dateButtonText}>
              {startDate.toLocaleDateString('id-ID')}
            </Text>
          </TouchableOpacity>
          <Text>-</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setOpenEndPicker(true)}>
            <Icon name="calendar" size={16} color="#555" />
            <Text style={styles.dateButtonText}>
              {endDate.toLocaleDateString('id-ID')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={20} color="#888" style={{marginLeft: 10}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari No. Permintaan / Keterangan..."
            value={keyword}
            onChangeText={setKeyword}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

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

      {isLoading && !isRefreshing ? (
        <ActivityIndicator
          size="large"
          color="#7B1FA2"
          style={{marginTop: 50}}
        />
      ) : (
        <FlatList
          data={list}
          renderItem={renderItem}
          keyExtractor={item => item.Nomor}
          contentContainerStyle={{padding: 10, paddingBottom: 30}}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada data Permintaan.</Text>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fabAdd}
        onPress={() => navigation.navigate('MintaBahanForm')}
        activeOpacity={0.8}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},

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
  dateButtonText: {marginLeft: 6, color: '#333', fontSize: 12},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    height: 36,
  },
  searchInput: {flex: 1, paddingHorizontal: 10, fontSize: 13, color: '#333'},

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nomorText: {fontSize: 13, fontWeight: 'bold', color: '#7B1FA2'},
  dateText: {fontSize: 11, color: '#999'},
  namaSpk: {fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8},

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText: {fontSize: 10, fontWeight: 'bold'},
  badgeNeedsApproval: {
    backgroundColor: '#FFF3E0',
    borderWidth: 0.5,
    borderColor: '#FFE0B2',
  },
  badgeApproved: {
    backgroundColor: '#E8F5E9',
    borderWidth: 0.5,
    borderColor: '#C8E6C9',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F5F5F5',
    paddingTop: 8,
  },
  footerText: {fontSize: 11, color: '#999'},

  emptyText: {textAlign: 'center', marginTop: 50, color: '#999', fontSize: 12},

  fabAdd: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7B1FA2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#7B1FA2',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});

export default MintaBahanBrowseScreen;
