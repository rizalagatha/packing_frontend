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
  Modal,
  RefreshControl,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  getInvoicesApi,
  getInvoiceDetailsApi,
  getPrintDataApi, // -> Import Baru
  sendStrukWaApi, // -> Import Baru
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-toast-message';
import StrukModal from '../components/StrukModal'; // -> Import StrukModal

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

  // Filter State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [openStartPicker, setOpenStartPicker] = useState(false);
  const [openEndPicker, setOpenEndPicker] = useState(false);

  // Detail Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // --- STRUK STATE (BARU) ---
  const [strukData, setStrukData] = useState(null);
  const [isStrukVisible, setStrukVisible] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        cabang: userInfo.cabang === 'KDC' ? '' : userInfo.cabang,
      };

      const response = await getInvoicesApi(params, userToken);
      let data = response.data.data || [];

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(
          inv =>
            inv.Nomor.toLowerCase().includes(term) ||
            (inv.Nama || '').toLowerCase().includes(term),
        );
      }

      setInvoices(data);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Gagal memuat data invoice.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, searchTerm, userToken, userInfo.cabang]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchInvoices();
  };

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
        text2: 'Gagal memuat detail barang.',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // --- FUNGSI LOAD STRUK (BARU) ---
  const handleShowStruk = async () => {
    if (!selectedInvoice) return;
    setIsLoadingDetail(true); // Gunakan loading indicator modal
    try {
      const response = await getPrintDataApi(selectedInvoice.Nomor, userToken);
      setStrukData(response.data.data);
      setStrukVisible(true);
      // Opsional: Tutup modal detail agar fokus ke struk
      // setModalVisible(false);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Gagal memuat data struk.',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // --- FUNGSI KIRIM WA (BARU) ---
  const handleSendWa = async () => {
    if (!strukData) return;

    // Cari No HP (Prioritas: Member -> Customer -> Kosong)
    // Data customer ada di strukData.header (karena join di backend)
    // tapi backend getPrintData saat ini tidak join tabel customer untuk ambil telp customer,
    // hanya ambil inv_mem_hp.
    // Namun, kita punya data 'selectedInvoice' yang punya field 'Telp' & 'Hp' dari list.

    const targetHp =
      strukData.header.inv_mem_hp || selectedInvoice.Hp || selectedInvoice.Telp;

    if (!targetHp) {
      return Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'No HP tidak tersedia.',
      });
    }

    try {
      await sendStrukWaApi(
        {
          nomor: strukData.header.inv_nomor,
          hp: targetHp,
        },
        userToken,
      );
      Toast.show({
        type: 'success',
        text1: 'Terkirim',
        text2: 'Struk dikirim ke WA.',
      });
    } catch (error) {
      Toast.show({type: 'error', text1: 'Gagal', text2: 'Gagal mengirim WA.'});
    }
  };

  const handleCreateNew = () => {
    navigation.navigate('PenjualanLangsung');
  };

  const renderItem = ({item}) => {
    const isLunas = item.SisaPiutang <= 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOpenDetail(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.invoiceNumber}>{item.Nomor}</Text>
          <View
            style={[
              styles.badge,
              isLunas ? styles.badgeSuccess : styles.badgeWarning,
            ]}>
            <Text style={styles.badgeText}>
              {isLunas ? 'LUNAS' : 'BELUM LUNAS'}
            </Text>
          </View>
        </View>

        <Text style={styles.customerName}>{item.Nama || 'Umum'}</Text>

        <View style={styles.cardRow}>
          <Icon name="calendar" size={14} color="#666" />
          <Text style={styles.cardDate}>
            {new Date(item.Tanggal).toLocaleDateString('id-ID')}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.labelTotal}>Total Belanja</Text>
            <Text style={styles.valueTotal}>{formatRupiah(item.Nominal)}</Text>
          </View>
          {item.SisaPiutang > 0 && (
            <View style={{alignItems: 'flex-end'}}>
              <Text style={[styles.labelTotal, {color: '#D32F2F'}]}>
                Sisa Piutang
              </Text>
              <Text style={[styles.valueTotal, {color: '#D32F2F'}]}>
                {formatRupiah(item.SisaPiutang)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ... (Filter & DatePicker tetap sama) ... */}
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
            onSubmitEditing={fetchInvoices}
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
        onCancel={() => {
          setOpenStartPicker(false);
        }}
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
        onCancel={() => {
          setOpenEndPicker(false);
        }}
      />

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
          contentContainerStyle={{padding: 16, paddingBottom: 100}}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada data penjualan.</Text>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleCreateNew}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* --- Modal Detail Invoice --- */}
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
                style={{maxHeight: 300}} // Kurangi height agar muat tombol
              />
            )}

            {/* --- FOOTER TOMBOL (MODIFIKASI) --- */}
            <View style={styles.modalFooterActions}>
              {/* Tombol Cetak / Struk */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShowStruk}>
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
            {/* ---------------------------------- */}
          </View>
        </View>
      </Modal>

      {/* --- STRUK MODAL (BARU) --- */}
      <StrukModal
        visible={isStrukVisible}
        onClose={() => setStrukVisible(false)}
        data={strukData}
        onPrint={() => {
          Toast.show({
            type: 'info',
            text1: 'Info',
            text2: 'Fitur Print Bluetooth belum dikonfigurasi',
          });
        }}
        onSendWa={handleSendWa}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},

  // ... Styles sebelumnya tetap sama ...
  filterContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    padding: 8,
    borderRadius: 8,
    flex: 0.45,
    justifyContent: 'center',
  },
  dateText: {marginLeft: 8, color: '#333', fontSize: 13},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    height: 40,
  },
  searchInput: {flex: 1, paddingHorizontal: 10, fontSize: 14, color: '#333'},

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    marginHorizontal: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  invoiceNumber: {fontWeight: 'bold', fontSize: 14, color: '#1976D2'},
  badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  badgeSuccess: {backgroundColor: '#E8F5E9'},
  badgeWarning: {backgroundColor: '#FFEBEE'},
  badgeText: {fontSize: 10, fontWeight: 'bold', color: '#333'},
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  cardRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  cardDate: {marginLeft: 6, fontSize: 12, color: '#666'},
  divider: {height: 1, backgroundColor: '#eee', marginVertical: 8},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between'},
  labelTotal: {fontSize: 11, color: '#888'},
  valueTotal: {fontSize: 16, fontWeight: 'bold', color: '#333'},

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#1976D2',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  emptyText: {textAlign: 'center', marginTop: 50, color: '#999'},

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  modalSubHeader: {
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
    padding: 10,
    borderRadius: 8,
  },
  detailInvoiceNo: {fontSize: 12, color: '#1976D2', fontWeight: 'bold'},
  detailCustomer: {fontSize: 16, fontWeight: '600', color: '#333'},

  detailItem: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
  },
  itemName: {fontSize: 14, fontWeight: '500', color: '#333'},
  itemMeta: {fontSize: 12, color: '#666', marginTop: 2},
  itemDiscount: {fontSize: 11, color: '#D32F2F'},
  itemTotal: {fontSize: 14, fontWeight: 'bold', color: '#333'},

  // --- Footer Modal Style Baru ---
  modalFooterActions: {flexDirection: 'row', marginTop: 20, gap: 10},
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
  },
  actionButtonText: {color: '#fff', fontWeight: 'bold', fontSize: 14},

  closeButtonOutline: {
    flex: 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  closeButtonTextOutline: {color: '#666', fontWeight: 'bold'},
});

export default PenjualanListScreen;
