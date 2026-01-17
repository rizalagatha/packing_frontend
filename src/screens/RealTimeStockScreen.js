import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import {getRealTimeStockApi, getGudangOptionsApi} from '../api/ApiService';
import Toast from 'react-native-toast-message';
import SearchModal from '../components/SearchModal';

const STATIC_KEYS = ['kode', 'nama', 'total_stok', 'Buffer', 'totalQty'];
const SIZE_ORDER = [
  'XXXS',
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
  '6XL',
  '7XL',
  'ALLSIZE',
  'JUMBO',
  'A3',
  'A4',
];

const StockCard = React.memo(({item, gudangAktif}) => {
  // 2. Sekarang useMemo cuma butuh [item] saja
  const sortedSizes = useMemo(() => {
    return Object.keys(item)
      .filter(key => !STATIC_KEYS.includes(key) && item[key] !== 0)
      .sort((a, b) => {
        const idxA = SIZE_ORDER.indexOf(a.toUpperCase());
        const idxB = SIZE_ORDER.indexOf(b.toUpperCase());

        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
  }, [item]);

  // 3. Helper Warna Stok
  const getQtyColor = qty => {
    if (qty <= 0) return '#999'; // Abu-abu jika kosong
    if (qty <= 3) return '#D32F2F'; // Merah jika kritis (<= 3)
    if (qty <= 10) return '#F57C00'; // Oranye jika menipis (4 - 10)
    return '#1565C0'; // Biru jika aman (> 10)
  };

  const isLowStock = item.Buffer > 0 && item.total_stok < item.Buffer;

  return (
    <View style={[styles.card, isLowStock && styles.cardWarning]}>
      <View style={styles.cardHeader}>
        <View style={{flex: 1}}>
          <Text style={styles.productName}>{item.nama}</Text>
          <Text style={styles.productKode}>{item.kode}</Text>
        </View>
        {isLowStock && (
          <View style={styles.lowBadge}>
            <Icon name="alert-triangle" size={12} color="#fff" />
            <Text style={styles.lowText}>LOW</Text>
          </View>
        )}
      </View>

      <View style={styles.sizeGrid}>
        {sortedSizes.map(sz => (
          <View key={sz} style={styles.sizeItem}>
            <Text style={styles.sizeLabel}>{sz}</Text>
            <View
              style={[
                styles.sizeValueBox,
                {borderColor: getQtyColor(item[sz])},
              ]}>
              <Text style={[styles.sizeValue, {color: getQtyColor(item[sz])}]}>
                {item[sz]}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.labelMuted}>
          Gudang:{' '}
          <Text style={{color: '#1565C0', fontWeight: 'bold'}}>
            {gudangAktif}
          </Text>
        </Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalText}>{item.total_stok}</Text>
        </View>
      </View>
    </View>
  );
});

const RealTimeStockScreen = () => {
  const {userToken, userInfo} = useContext(AuthContext);
  const [stokList, setStokList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCabangModalVisible, setIsCabangModalVisible] = useState(false);
  const searchInputRef = useRef(null); // Ref untuk auto-focus scanner

  const [filters, setFilters] = useState({
    gudang: userInfo.cabang || '',
    jenisStok: 'semua',
    tampilkanKosong: false, // Default false agar tetap ringan
    tanggal: new Date().toISOString().split('T')[0],
  });
  const [searchQuery, setSearchQuery] = useState('');

  const {gudang, jenisStok, tampilkanKosong, tanggal} = filters;

  // Fungsi ambil data stok
  const fetchStok = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getRealTimeStockApi(userToken, {
        gudang,
        jenisStok,
        tampilkanKosong,
        tanggal,
        search: searchQuery,
      });
      setStokList(res.data.data || []);
    } catch (e) {
      Toast.show({type: 'error', text1: 'Gagal memuat stok'});
    } finally {
      setIsLoading(false);
    }
    // Masukkan variabel satuan ke dependency
  }, [userToken, gudang, jenisStok, tampilkanKosong, tanggal, searchQuery]);

  useEffect(() => {
    fetchStok();
  }, [fetchStok]); // Ambil ulang jika filter gudang/jenis berubah

  const handleSelectCabang = cab => {
    setFilters({...filters, gudang: cab.kode});
    setIsCabangModalVisible(false);
  };

  // Handler untuk Scanner Fisik (Enter/Submit)
  const handleScannerSubmit = () => {
    fetchStok(); // Langsung cari saat scanner menekan Enter
  };

  const renderItem = useCallback(
    ({item}) => <StockCard item={item} gudangAktif={filters.gudang} />,
    [filters.gudang], // Sekarang ini sudah benar karena fungsinya hanya butuh gudang
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        {/* Search Bar (Support Scanner Fisik) */}
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="#999" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Ketik Nama atau Scan Barcode..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleScannerSubmit} // <--- TRICK UNTUK SCANNER FISIK
            autoFocus={true}
            returnKeyType="search"
          />
          {searchQuery !== '' && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                fetchStok();
              }}>
              <Icon name="x-circle" size={18} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          {/* Tombol Pilih Cabang (Store hanya bisa lihat sendiri & KDC) */}
          <TouchableOpacity
            style={styles.branchBtn}
            onPress={() => setIsCabangModalVisible(true)}>
            <Icon name="map-pin" size={14} color="#1565C0" />
            <Text style={styles.branchBtnText}>{filters.gudang}</Text>
            <Icon name="chevron-down" size={14} color="#1565C0" />
          </TouchableOpacity>

          <View style={styles.typeToggle}>
            {['showroom', 'pesanan', 'semua'].map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setFilters({...filters, jenisStok: t})}
                style={[
                  styles.toggleItem,
                  filters.jenisStok === t && styles.toggleActive,
                ]}>
                <Text
                  style={[
                    styles.toggleText,
                    filters.jenisStok === t && styles.toggleTextActive,
                  ]}>
                  {t === 'showroom'
                    ? 'Toko'
                    : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.checkboxRow}>
          <TouchableOpacity
            onPress={() =>
              setFilters({
                ...filters,
                tampilkanKosong: !filters.tampilkanKosong,
              })
            }
            style={styles.filterBtn}>
            <Icon
              name={filters.tampilkanKosong ? 'check-square' : 'square'}
              size={18}
              color="#1565C0"
            />
            <Text style={styles.filterBtnText}>
              Tampilkan Barang Stok 0 (Kosong)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#1565C0"
          style={{marginTop: 50}}
        />
      ) : (
        <FlatList
          data={stokList}
          renderItem={renderItem}
          keyExtractor={item => item.kode}
          contentContainerStyle={{padding: 12, paddingBottom: 100}}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>Barang tidak ditemukan.</Text>
            </View>
          }
        />
      )}

      {/* Modal Pilih Cabang */}
      <SearchModal
        visible={isCabangModalVisible}
        onClose={() => setIsCabangModalVisible(false)}
        onSelect={handleSelectCabang}
        title="Pilih Cabang"
        apiSearchFunction={async () => {
          // Menembak rute yang sudah kita perbaiki di backend tadi
          const res = await getGudangOptionsApi(userToken);
          return {data: {data: {items: res.data.data}}};
        }}
        keyField="kode"
        renderListItem={item => (
          <View
            style={{padding: 15, borderBottomWidth: 1, borderColor: '#eee'}}>
            <Text style={{fontWeight: 'bold', color: '#333'}}>{item.kode}</Text>
            <Text style={{fontSize: 12, color: '#666'}}>{item.nama}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F0F2F5'},
  headerSection: {
    padding: 15,
    backgroundColor: '#fff',
    elevation: 3,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 45,
  },
  searchInput: {flex: 1, marginLeft: 10, fontSize: 14, color: '#333'},
  filterRow: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  branchBtnText: {color: '#1565C0', fontWeight: 'bold', fontSize: 13},
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    padding: 2,
  },
  toggleItem: {paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6},
  toggleActive: {backgroundColor: '#fff', elevation: 1},
  toggleText: {fontSize: 11, color: '#666', fontWeight: 'bold'},
  toggleTextActive: {color: '#1565C0'},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
  },
  cardWarning: {borderLeftWidth: 4, borderLeftColor: '#D32F2F'},
  cardHeader: {marginBottom: 10},
  productName: {fontSize: 14, fontWeight: 'bold', color: '#333'},
  productKode: {fontSize: 11, color: '#1976D2', marginTop: 2},
  sizeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  sizeItem: {alignItems: 'center', width: 45},
  sizeLabel: {fontSize: 9, color: '#999', marginBottom: 2, fontWeight: 'bold'},
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  labelMuted: {fontSize: 11, color: '#999'},
  totalBadge: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 8,
    color: '#BBDEFB',
    fontWeight: 'bold',
    marginRight: 5,
  },
  totalText: {fontSize: 13, color: '#fff', fontWeight: 'bold'},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  checkboxRow: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5', // Garis pembatas tipis agar rapi
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtnText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
  },
  lowBadge: {
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  lowText: {color: '#fff', fontSize: 10, fontWeight: 'bold'},
  sizeValueBox: {
    backgroundColor: '#fff', // Latar putih agar warna angka kontras
    paddingVertical: 4,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5, // Garis kotak mengikuti warna jumlah stok
  },
  sizeValue: {
    fontSize: 13,
    fontWeight: '900', // Buat angka lebih tebal agar mudah dibaca
  },
});

export default RealTimeStockScreen;
