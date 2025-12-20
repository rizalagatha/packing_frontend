import React, {
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  RefreshControl,
  Alert, // <--- TAMBAHAN PENTING
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  getInvoicesApi,
  getInvoiceDetailsApi,
  getPrintDataApi,
  sendStrukWaApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-toast-message';
import StrukModal from '../components/StrukModal';

// Constants
const ITEMS_PER_PAGE = 20;

// Helper Format Rupiah
const formatRupiah = angka => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka);
};

const PenjualanListScreen = ({navigation}) => {
  const {userToken, userInfo} = useContext(AuthContext);

  // Data State
  const [invoices, setInvoices] = useState([]);
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

  // Detail & Struk State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [strukData, setStrukData] = useState(null);
  const [isStrukVisible, setStrukVisible] = useState(false);

  // Total Omzet
  const totalOmzet = useMemo(() => {
    return invoices.reduce((sum, item) => sum + (item.Nominal || 0), 0);
  }, [invoices]);

  // --- FUNGSI FETCH DATA ---
  const fetchInvoices = useCallback(
    async (targetPage = 1, isRefresh = false) => {
      if (!isRefresh && (isLoadingMore || !hasMore)) return;

      if (targetPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          cabang: userInfo.cabang === 'KDC' ? '' : userInfo.cabang,
          search: searchTerm,
          page: targetPage,
          limit: ITEMS_PER_PAGE,
        };

        const response = await getInvoicesApi(params, userToken);
        let newData = response.data.data || [];

        // Client side filter fallback
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          newData = newData.filter(
            inv =>
              inv.Nomor.toLowerCase().includes(term) ||
              (inv.Nama || '').toLowerCase().includes(term),
          );
        }

        if (targetPage === 1) {
          setInvoices(newData);
        } else {
          setInvoices(prev => {
            const existingIds = new Set(prev.map(i => i.Nomor));
            const uniqueNew = newData.filter(i => !existingIds.has(i.Nomor));
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
          text2: 'Gagal memuat data invoice.',
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [
      startDate,
      endDate,
      searchTerm,
      userToken,
      userInfo.cabang,
      hasMore,
      isLoadingMore,
    ],
  );

  useEffect(() => {
    fetchInvoices(1, true);
  }, [startDate, endDate, fetchInvoices]);

  const handleSearch = () => {
    fetchInvoices(1, true);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    setHasMore(true);
    fetchInvoices(1, true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchInvoices(page + 1);
    }
  };

  // --- Handle Detail ---
  const handleOpenDetail = async invoice => {
    setSelectedInvoice(invoice);
    setModalVisible(true);
    setIsLoadingDetail(true);
    setDetailItems([]);
    try {
      const response = await getInvoiceDetailsApi(invoice.Nomor, userToken);
      setDetailItems(response.data.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Gagal memuat detail.',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // --- Handle Struk ---
  const handleShowStruk = async (invoiceOverride = null) => {
    const targetInvoice = invoiceOverride || selectedInvoice;
    if (!targetInvoice) return;
    if (invoiceOverride) setSelectedInvoice(invoiceOverride);

    // Jika modal detail sedang terbuka, tutup dulu (opsional, tergantung UX)
    // setModalVisible(false);

    if (!modalVisible)
      Toast.show({type: 'info', text1: 'Memuat data struk...'});
    else setIsLoadingDetail(true);

    try {
      const response = await getPrintDataApi(targetInvoice.Nomor, userToken);
      setStrukData(response.data.data);
      setStrukVisible(true);
    } catch (error) {
      Toast.show({type: 'error', text1: 'Gagal', text2: 'Gagal memuat struk.'});
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // --- LOGIC KIRIM WA (INTEGRASI BARU) ---
  // Parameter manualHp dikirim dari StrukModal
  const handleSendWa = async manualHp => {
    // 1. Ambil Nomor Invoice
    const invNomor = strukData?.header?.inv_nomor || selectedInvoice?.Nomor;

    if (!invNomor) {
      Alert.alert('Error', 'Nomor Invoice tidak ditemukan.');
      return;
    }

    console.log('--- [LIST SCREEN] START KIRIM WA ---');
    console.log('1. Input dari Modal:', manualHp);

    // 2. Tentukan Nomor HP (Prioritas: Input Manual > Data Struk > Data List)
    // Gunakan input manual jika user mengetik sesuatu, jika kosong fallback ke data DB
    let rawHp =
      manualHp ||
      strukData?.header?.inv_mem_hp ||
      selectedInvoice?.Hp ||
      selectedInvoice?.Telp ||
      '';

    // 3. Format & Bersihkan Nomor
    let targetHp = String(rawHp).trim();
    targetHp = targetHp.replace(/[^0-9]/g, ''); // Hapus selain angka

    // Logic 62
    if (targetHp.startsWith('0')) {
      targetHp = '62' + targetHp.slice(1);
    } else if (!targetHp.startsWith('62') && targetHp.length > 5) {
      // Jika user ngetik "812..." tambahkan 62 di depan
      targetHp = '62' + targetHp;
    }

    console.log('2. Nomor Final:', targetHp);

    if (targetHp.length < 10) {
      Alert.alert('Perhatian', 'Format nomor HP tidak valid (terlalu pendek).');
      return;
    }

    try {
      // 4. Panggil API
      const response = await sendStrukWaApi(
        {nomor: invNomor, hp: targetHp},
        userToken,
      );

      console.log('3. API Response:', response.data);

      // Gunakan Alert (bukan Toast) agar muncul di atas Modal
      Alert.alert('Berhasil', 'Struk sedang dikirim ke WhatsApp.');
    } catch (error) {
      console.log('4. API Error:', error);

      const errMsg = error.response?.data?.message || 'Gagal mengirim WA.';
      // Gunakan Alert agar error terbaca user
      Alert.alert('Gagal Kirim', errMsg);
    }
  };

  const handleCreateNew = () => {
    navigation.navigate('PenjualanLangsung');
  };

  // --- RENDER ITEM ---
  const renderItem = ({item}) => {
    const isLunas = item.SisaPiutang <= 0;
    const dateStr = new Date(item.Tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => handleOpenDetail(item)}>
          <View style={styles.rowHeader}>
            <Text style={styles.invoiceNumber}>{item.Nomor}</Text>
            <Text style={styles.dateTextItem}>{dateStr}</Text>
          </View>

          <Text style={styles.customerName} numberOfLines={1}>
            {item.Nama || 'Customer Umum'}
          </Text>

          <View style={styles.rowFooter}>
            <View
              style={[
                styles.badge,
                isLunas ? styles.badgeSuccess : styles.badgeWarning,
              ]}>
              <Text
                style={[
                  styles.badgeText,
                  isLunas ? {color: '#2E7D32'} : {color: '#C62828'},
                ]}>
                {isLunas ? 'LUNAS' : 'BELUM'}
              </Text>
            </View>

            <View style={{alignItems: 'flex-end'}}>
              <Text style={styles.valueTotal}>
                {formatRupiah(item.Nominal)}
              </Text>
              {item.SisaPiutang > 0 && (
                <Text style={styles.piutangText}>
                  Sisa: {formatRupiah(item.SisaPiutang)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActions}
          onPress={() => handleShowStruk(item)}>
          <Icon name="printer" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  // --- FOOTER ---
  const renderFooter = () => {
    if (invoices.length === 0 && isLoading) return null;
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#1976D2" />
          <Text style={styles.footerText}>Memuat data...</Text>
        </View>
      );
    }
    if (hasMore && invoices.length > 0) {
      return (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Muat Lebih Banyak</Text>
          <Icon name="chevron-down" size={16} color="#1976D2" />
        </TouchableOpacity>
      );
    }
    if (!hasMore && invoices.length > 0) {
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
            placeholder="Cari No Invoice / Customer..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      {/* SUMMARY */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryLabel}>Total Penjualan</Text>
        <Text style={styles.summaryValue}>{formatRupiah(totalOmzet)}</Text>
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

      {/* LIST INVOICE */}
      {isLoading && !isRefreshing ? (
        <ActivityIndicator
          size="large"
          color="#1976D2"
          style={{marginTop: 50}}
        />
      ) : (
        <FlatList
          data={invoices}
          renderItem={renderItem}
          keyExtractor={item => item.Nomor}
          contentContainerStyle={{padding: 10, paddingBottom: 80}}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada data penjualan.</Text>
          }
          ListFooterComponent={renderFooter}
        />
      )}

      {/* FAB ADD NEW */}
      <TouchableOpacity style={styles.fab} onPress={handleCreateNew}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* MODAL DETAIL (READ ONLY) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Invoice</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSubHeader}>
              <Text style={styles.detailInvoiceNo}>
                {selectedInvoice?.Nomor}
              </Text>
              <Text style={styles.detailCustomer}>{selectedInvoice?.Nama}</Text>
            </View>
            {isLoadingDetail ? (
              <ActivityIndicator
                size="large"
                color="#1976D2"
                style={{margin: 20}}
              />
            ) : (
              <FlatList
                data={detailItems}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({item}) => (
                  <View style={styles.detailItem}>
                    <View style={{flex: 1}}>
                      <Text style={styles.itemName}>{item.Nama}</Text>
                      <Text style={styles.itemMeta}>
                        {item.Ukuran} | {item.Jumlah} x{' '}
                        {formatRupiah(item.Harga)}
                      </Text>
                      {item.DiskonAktif > 0 && (
                        <Text style={styles.itemDiscount}>
                          Disc: {formatRupiah(item.DiskonAktif)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.itemTotal}>
                      {formatRupiah(item.Total)}
                    </Text>
                  </View>
                )}
                style={{maxHeight: 300}}
              />
            )}
            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleShowStruk(null)}>
                <Icon
                  name="printer"
                  size={18}
                  color="#fff"
                  style={{marginRight: 8}}
                />
                <Text style={styles.actionButtonText}>Preview / Cetak</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButtonOutline}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButtonTextOutline}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* STRUK MODAL */}
      <StrukModal
        visible={isStrukVisible}
        onClose={() => setStrukVisible(false)}
        data={strukData}
        onSendWa={handleSendWa} // <--- SUDAH TERINTEGRASI
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},

  // Filter & Summary
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

  summaryContainer: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#BBDEFB',
    elevation: 0,
  },
  summaryLabel: {color: '#1565C0', fontWeight: '600', fontSize: 12},
  summaryValue: {color: '#1565C0', fontWeight: 'bold', fontSize: 14},

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
  invoiceNumber: {fontSize: 12, fontWeight: 'bold', color: '#1976D2'},
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

  valueTotal: {fontSize: 13, fontWeight: 'bold', color: '#333'},
  piutangText: {fontSize: 9, color: '#D32F2F'},

  quickActions: {
    width: 44,
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 1,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1976D2',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  emptyText: {textAlign: 'center', marginTop: 50, color: '#999', fontSize: 12},

  // --- STYLES BARU FOOTER LOAD MORE ---
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

  // Modal Styles (Standard)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  modalSubHeader: {
    marginBottom: 10,
    backgroundColor: '#F9F9F9',
    padding: 8,
    borderRadius: 6,
  },
  detailInvoiceNo: {fontSize: 11, color: '#1976D2', fontWeight: 'bold'},
  detailCustomer: {fontSize: 14, fontWeight: '600', color: '#333'},
  detailItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 8,
  },
  itemName: {fontSize: 13, fontWeight: '500', color: '#333'},
  itemMeta: {fontSize: 11, color: '#666', marginTop: 1},
  itemDiscount: {fontSize: 10, color: '#D32F2F'},
  itemTotal: {fontSize: 13, fontWeight: 'bold', color: '#333'},
  modalFooterActions: {flexDirection: 'row', marginTop: 15, gap: 10},
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 6,
  },
  actionButtonText: {color: '#fff', fontWeight: 'bold', fontSize: 13},
  closeButtonOutline: {
    flex: 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  closeButtonTextOutline: {color: '#666', fontWeight: 'bold', fontSize: 13},
});

export default PenjualanListScreen;
