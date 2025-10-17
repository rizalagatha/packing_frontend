// File: src/screens/RiwayatSuratJalanScreen.js

import React, {useState, useCallback, useContext, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../context/AuthContext';
import {
  getSuratJalanHistoryApi,
  getSuratJalanDetailApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';

// Fungsi bantuan untuk format tanggal YYYY-MM-DD
const formatDate = date => {
  return date.toISOString().split('T')[0];
};

const RiwayatSuratJalanScreen = () => {
  const {userToken} = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('today');
  const [expandedNomor, setExpandedNomor] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);

  const fetchHistory = useCallback(
    async (start, end) => {
      setIsLoading(true);
      setHistory([]);
      try {
        const params = {
          startDate: formatDate(start),
          endDate: formatDate(end),
        };
        const response = await getSuratJalanHistoryApi(params, userToken);
        setHistory(response.data.data);
      } catch (error) {
        console.error('Gagal memuat riwayat SJ', error);
      } finally {
        setIsLoading(false);
      }
    },
    [userToken],
  );

  // Mengambil data untuk filter "today" saat halaman pertama kali dibuka
  useEffect(() => {
    fetchHistory(startDate, endDate);
  }, [fetchHistory, startDate, endDate]);

  const handleFilterPress = filter => {
    setActiveFilter(filter);
    fetchHistory(filter);
  };

  const handleQuickFilter = period => {
    const today = new Date();
    const newStartDate = new Date();
    const newEndDate = new Date(today);

    if (period === '7days') {
      newStartDate.setDate(today.getDate() - 6);
    } else if (period === '30days') {
      newStartDate.setDate(today.getDate() - 29);
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
    fetchHistory(newStartDate, newEndDate);
  };

  const handleItemPress = async item => {
    const nomorSj = item.nomor;
    if (expandedNomor === nomorSj) {
      setExpandedNomor(null); // Tutup jika di-klik lagi
      return;
    }

    setExpandedNomor(nomorSj);
    setIsDetailLoading(true);
    try {
      const response = await getSuratJalanDetailApi(nomorSj, userToken);
      setDetailItems(response.data.data.items);
    } catch (error) {
      console.error('Gagal memuat detail SJ', error);
      setExpandedNomor(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const FilterButton = ({label, filter, onPress, activeFilter}) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === filter && styles.filterButtonActive,
      ]}
      onPress={() => onPress(filter)}>
      <Text
        style={[
          styles.filterText,
          activeFilter === filter && styles.filterTextActive,
        ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterContainer}>
        {/* --- BAGIAN FILTER BARU --- */}
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
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => fetchHistory(startDate, endDate)}>
            <Icon name="search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.quickFilterSection}>
          <TouchableOpacity
            style={styles.quickFilterButton}
            onPress={() => handleQuickFilter('today')}>
            <Text style={styles.quickFilterText}>Hari Ini</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickFilterButton}
            onPress={() => handleQuickFilter('7days')}>
            <Text style={styles.quickFilterText}>7 Hari</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickFilterButton}
            onPress={() => handleQuickFilter('30days')}>
            <Text style={styles.quickFilterText}>30 Hari</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- MODAL DATE PICKER --- */}
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

      {isLoading ? (
        <ActivityIndicator
          size="large"
          style={{marginTop: 50}}
          color="#D32F2F"
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.nomor}
          extraData={expandedNomor}
          renderItem={({item}) => (
            <View style={styles.historyItemWrapper}>
              <TouchableOpacity onPress={() => handleItemPress(item)}>
                {/* Konten utama dari item riwayat */}
                <View style={styles.itemContent}>
                  <View style={{flex: 1}}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.historyNomor}>{item.nomor}</Text>
                      <Text style={styles.historyTanggal}>
                        {new Date(item.tanggal).toLocaleDateString('id-ID')}
                      </Text>
                    </View>
                    <View style={styles.itemBody}>
                      <Icon
                        name="home"
                        size={16}
                        color="#757575"
                        style={{marginRight: 8}}
                      />
                      <Text style={styles.storeName}>
                        {item.store_kode} - {item.store_nama}
                      </Text>
                    </View>
                    <View style={styles.itemFooter}>
                      <Text style={styles.footerText}>
                        {item.jumlah_jenis_item} jenis item
                      </Text>
                      <Text style={styles.footerText}>
                        Total: {item.total_qty || 0} pcs
                      </Text>
                    </View>
                  </View>

                  {/* Ikon Panah */}
                  <Icon
                    name={
                      expandedNomor === item.nomor
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                    size={24}
                    color="#666"
                    style={{marginLeft: 10}}
                  />
                </View>
              </TouchableOpacity>

              {/* Tampilkan detail jika item ini sedang dibuka */}
              {expandedNomor === item.nomor && (
                <View style={styles.detailContainer}>
                  {isDetailLoading ? (
                    <ActivityIndicator
                      color="#D32F2F"
                      style={{marginVertical: 10}}
                    />
                  ) : (
                    detailItems.map((detail, index) => (
                      <View key={index} style={styles.detailItem}>
                        <Text style={styles.detailName}>
                          {detail.nama} ({detail.ukuran})
                        </Text>
                        <Text style={styles.detailQty}>x {detail.jumlah}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Tidak ada riwayat pada periode ini.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyNomor: {fontSize: 16, fontWeight: 'bold', color: '#212121'},
  historyTanggal: {fontSize: 12, color: '#757575'},
  itemBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  storeName: {fontSize: 14, color: '#616161'},
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  footerText: {fontSize: 12, color: '#757575', fontWeight: '500'},
  emptyText: {textAlign: 'center', marginTop: 50, color: '#757575'},
  historyItemWrapper: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    elevation: 2,
  },
  itemContent: {
    flexDirection: 'row',
    padding: 16,
  },
  ailContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailName: {
    color: '#212121',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
    lineHeight: 20,
  },
  detailQty: {
    color: '#212121',
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
});
export default RiwayatSuratJalanScreen;
