import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import * as DB from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';

const BazarProductListScreen = ({navigation}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);

  // State Kategori
  const [categories, setCategories] = useState(['SEMUA']);
  const [activeCat, setActiveCat] = useState('SEMUA');

  // State Tipe Produk [BARU]
  const [types, setTypes] = useState(['SEMUA']);
  const [activeType, setActiveType] = useState('SEMUA');

  // Ambil data filter dari DB saat mount
  const loadFilters = async () => {
    const cats = (await DB.getBazarCategories?.()) || [];
    const typs = (await DB.getBazarTypes?.()) || [];

    // Debug: Cek di console log apakah data tipe ada
    console.log('Tipe Produk ditemukan di DB:', typs);

    setCategories(['SEMUA', ...cats]);
    setTypes(['SEMUA', ...typs]);
  };

  useEffect(() => {
    loadFilters();
  }, []);

  // Tambahkan activeType ke dalam dependency array useEffect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const fetchProducts = useCallback(async () => {
    const data = await DB.searchBazarProductsOptimized(
      searchQuery,
      activeCat,
      activeType,
    );
    setProducts(data);
  }, [searchQuery, activeCat, activeType]);

  const handleSelect = item => {
    navigation.navigate('BazarCashier', {selectedProduct: item});
  };

  const formatRupiah = val => {
    const number = Number(val);
    if (isNaN(number) || val === null || val === undefined) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(number);
  };

  const renderProductItem = ({item}) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
      <View style={styles.cardHeader}>
        <Text style={styles.productCode}>{item.barcode}</Text>
        <View style={{flexDirection: 'row'}}>
          {/* Label Tipe Produk (Reguler/Promo/dll) */}
          {item.tipe_produk ? (
            <View
              style={[
                styles.badgeTipe,
                {backgroundColor: getTipeColor(item.tipe_produk)},
              ]}>
              <Text style={styles.tipeText}>{item.tipe_produk}</Text>
            </View>
          ) : null}

          <View style={styles.badgeUkuran}>
            <Text style={styles.ukuranText}>{item.ukuran || '-'}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.productName}>{item.nama}</Text>

      <View style={styles.detailRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>HARGA JUAL</Text>
          <Text style={styles.priceValue}>{formatRupiah(item.harga_jual)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getTipeColor = tipe => {
    const t = tipe.toUpperCase();
    if (t.includes('PROMO')) return '#FF9800'; // Oranye
    if (t.includes('REJECT')) return '#F44336'; // Merah
    if (t.includes('DISPLAY')) return '#9C27B0'; // Ungu
    return '#1976D2'; // Biru untuk Reguler/Lainnya
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari dari 33rb+ produk..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TABS KATEGORI - Membantu navigasi user */}
      <View style={styles.filterWrapper}>
        {/* ROW 1: KATEGORI */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Kategori:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map(cat => (
              <TouchableOpacity
                key={`cat-${cat}`}
                onPress={() => setActiveCat(cat)}
                style={[styles.tabItem, activeCat === cat && styles.tabActive]}>
                <Text
                  style={[
                    styles.tabText,
                    activeCat === cat && styles.tabTextActive,
                  ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ROW 2: TIPE PRODUK [BARU] */}
        <View style={[styles.filterRow, {marginTop: 8}]}>
          <Text style={styles.filterLabel}>Tipe:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {types.map(tip => (
              <TouchableOpacity
                key={`tip-${tip}`}
                onPress={() => setActiveType(tip)}
                style={[
                  styles.tabItem,
                  activeType === tip && styles.tabActiveType,
                ]}>
                <Text
                  style={[
                    styles.tabText,
                    activeType === tip && styles.tabTextActive,
                  ]}>
                  {tip}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={item => `${item.barcode}-${item.ukuran}-${item.kode}`}
        renderItem={renderProductItem}
        contentContainerStyle={styles.listPadding}
        removeClippedSubviews={true}
        initialNumToRender={10}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="package" size={50} color="#DDD" />
            <Text style={styles.emptyText}>Barang tidak ditemukan</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  searchHeader: {backgroundColor: '#fff', padding: 15},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
  },
  searchInput: {flex: 1, marginLeft: 10, fontSize: 14, color: '#333'},
  categoryContainer: {
    backgroundColor: '#fff',
    paddingBottom: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  listPadding: {padding: 15},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  productCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E91E63',
    letterSpacing: 0.5,
  },
  badgeUkuran: {
    backgroundColor: '#FCE4EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ukuranText: {fontSize: 11, color: '#E91E63', fontWeight: 'bold'},
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10},
  priceCol: {alignItems: 'flex-start'},
  priceLabel: {
    fontSize: 9,
    color: '#90A4AE',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  priceValue: {fontSize: 15, fontWeight: 'bold', color: '#2E7D32'},
  emptyState: {alignItems: 'center', marginTop: 100},
  emptyText: {marginTop: 10, color: '#999'},
  badgeTipe: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 5,
  },
  tipeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  filterWrapper: {
    backgroundColor: '#fff',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    width: 55,
    textTransform: 'uppercase',
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    backgroundColor: '#F0F2F5',
    marginRight: 6,
  },
  tabActive: {backgroundColor: '#E91E63'}, // Pink untuk Kategori
  tabActiveType: {backgroundColor: '#455A64'}, // Biru Abu-abu untuk Tipe agar beda warna
  tabText: {fontSize: 11, color: '#666', fontWeight: 'bold'},
  tabTextActive: {color: '#fff'},
});

export default BazarProductListScreen;
