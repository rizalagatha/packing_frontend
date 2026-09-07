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
  ActivityIndicator,
} from 'react-native';
import * as DB from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';
import {useResponsive} from '../hooks/useResponsive';

const formatRupiah = val => {
  const number = Number(val);
  if (isNaN(number) || val === null || val === undefined) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(number);
};

const getTipeColor = tipe => {
  const t = (tipe || '').toUpperCase();
  if (t.includes('PROMO')) {
    return '#FF9800';
  }
  if (t.includes('REJECT')) {
    return '#F44336';
  }
  if (t.includes('DISPLAY')) {
    return '#9C27B0';
  }
  return '#1976D2';
};

// Kelompokkan hasil pencarian (per barcode+ukuran) menjadi 1 kartu per kode barang,
// dengan daftar ukuran+harga+barcode di dalamnya
const groupProductsByKode = items => {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.kode)) {
      map.set(item.kode, {
        kode: item.kode,
        nama: item.nama,
        tipe_produk: item.tipe_produk,
        jenis_kain: item.jenis_kain,
        sizes: [],
      });
    }
    map.get(item.kode).sizes.push({
      barcode: item.barcode,
      ukuran: item.ukuran,
      harga_jual: item.harga_jual,
      harga_spesial: item.harga_spesial,
    });
  }
  return Array.from(map.values());
};

const ProductGroupCard = ({group, onAdd}) => {
  const [selectedSize, setSelectedSize] = useState(group.sizes[0] || null);
  const [qty, setQty] = useState(1);

  const currentPrice = selectedSize
    ? selectedSize.harga_spesial > 0
      ? selectedSize.harga_spesial
      : selectedSize.harga_jual
    : 0;

  const handleAdd = () => {
    if (!selectedSize) {
      return;
    }
    onAdd(
      {
        barcode: selectedSize.barcode,
        kode: group.kode,
        nama: group.nama,
        ukuran: selectedSize.ukuran,
        harga_jual: selectedSize.harga_jual,
        harga_spesial: selectedSize.harga_spesial,
        tipe_produk: group.tipe_produk,
      },
      qty,
    );
    setQty(1);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <Icon name="shopping-bag" size={20} color="#999" />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.productCode}>{group.kode}</Text>
          <Text style={styles.productName}>{group.nama}</Text>
        </View>
        <View style={styles.priceHeaderCol}>
          <Text style={styles.priceHeaderLabel}>Harga Pilih Ukuran</Text>
          <Text style={styles.priceHeaderValue}>
            {formatRupiah(currentPrice)}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {group.tipe_produk ? (
          <View
            style={[
              styles.badgeTipe,
              {backgroundColor: getTipeColor(group.tipe_produk)},
            ]}>
            <Text style={styles.tipeText}>{group.tipe_produk}</Text>
          </View>
        ) : null}
        {group.jenis_kain ? (
          <View style={styles.badgeKain}>
            <Text style={styles.kainText}>{group.jenis_kain}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>Pilih Size</Text>
      <View style={styles.sizeRow}>
        {group.sizes.map(s => {
          const isActive = selectedSize?.barcode === s.barcode;
          const price = s.harga_spesial > 0 ? s.harga_spesial : s.harga_jual;
          return (
            <TouchableOpacity
              key={s.barcode}
              style={[styles.sizeBtn, isActive && styles.sizeBtnActive]}
              onPress={() => setSelectedSize(s)}>
              <Text
                style={[
                  styles.sizeBtnText,
                  isActive && styles.sizeBtnTextActive,
                ]}>
                {s.ukuran}
              </Text>
              <Text
                style={[
                  styles.sizeBtnPrice,
                  isActive && styles.sizeBtnTextActive,
                ]}>
                {formatRupiah(price)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.qtyContainer}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQty(q => Math.max(1, q - 1))}>
            <Icon name="minus" size={16} color="#333" />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQty(q => q + 1)}>
            <Icon name="plus" size={16} color="#333" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btnAddCart, !selectedSize && styles.btnDisabled]}
          onPress={handleAdd}
          disabled={!selectedSize}>
          <Icon name="shopping-cart" size={16} color="#fff" />
          <Text style={styles.btnAddCartText}>Tambah</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const BazarProductListScreen = ({navigation}) => {
  const {isTablet} = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);

  const [categories, setCategories] = useState(['SEMUA']);
  const [activeCat, setActiveCat] = useState('SEMUA');

  const [types, setTypes] = useState(['SEMUA']);
  const [activeType, setActiveType] = useState('SEMUA');

  const [jenisKainList, setJenisKainList] = useState(['SEMUA']);
  const [activeJenisKain, setActiveJenisKain] = useState('SEMUA');

  const [isLoading, setIsLoading] = useState(false);

  // --- PENTING: fetchProducts didefinisikan SEBELUM useEffect yang memakainya ---
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await DB.searchBazarProductsOptimized(
        searchQuery,
        activeCat,
        activeType,
        activeJenisKain,
      );
      setProducts(data);
    } catch (error) {
      console.log('Gagal cari produk:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, activeCat, activeType, activeJenisKain]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const loadFilters = async () => {
    const cats = (await DB.getBazarCategories?.()) || [];
    const typs = (await DB.getBazarTypes?.()) || [];
    const kains = (await DB.getBazarJenisKain?.()) || []; // <-- fungsi baru, perlu ditambahkan di Database.js

    setCategories(['SEMUA', ...cats]);
    setTypes(['SEMUA', ...typs]);
    setJenisKainList(['SEMUA', ...kains]);
  };

  useEffect(() => {
    loadFilters();
  }, []);

  const handleAddToCart = (product, qty) => {
    navigation.navigate('BazarCashier', {
      selectedProduct: product,
      selectedQty: qty, // sesuaikan di BazarCashierScreen kalau mau qty > 1 langsung
    });
  };

  const groupedProducts = groupProductsByKode(products);

  const filterPaneContent = (
    <>
      <Text style={styles.filterGroupLabel}>Kategori</Text>
      <View style={styles.filterChipWrap}>
        {categories.map(cat => (
          <TouchableOpacity
            key={`cat-${cat}`}
            onPress={() => setActiveCat(cat)}
            style={[styles.chipItem, activeCat === cat && styles.chipActive]}>
            <Text
              style={[
                styles.chipText,
                activeCat === cat && styles.chipTextActive,
              ]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterGroupLabel}>Tipe</Text>
      <View style={styles.filterChipWrap}>
        {types.map(tip => (
          <TouchableOpacity
            key={`tip-${tip}`}
            onPress={() => setActiveType(tip)}
            style={[
              styles.chipItem,
              activeType === tip && styles.chipActiveType,
            ]}>
            <Text
              style={[
                styles.chipText,
                activeType === tip && styles.chipTextActive,
              ]}>
              {tip}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterGroupLabel}>Jenis Kain</Text>
      <View style={styles.filterChipWrap}>
        {jenisKainList.map(kain => (
          <TouchableOpacity
            key={`kain-${kain}`}
            onPress={() => setActiveJenisKain(kain)}
            style={[
              styles.chipItem,
              activeJenisKain === kain && styles.chipActiveKain,
            ]}>
            <Text
              style={[
                styles.chipText,
                activeJenisKain === kain && styles.chipTextActive,
              ]}>
              {kain}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const searchBarContent = (
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
  );

  const productListContent = isLoading ? (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#E91E63" />
      <Text style={styles.loadingText}>Mencari produk...</Text>
    </View>
  ) : (
    <FlatList
      data={groupedProducts}
      keyExtractor={g => g.kode}
      renderItem={({item}) => (
        <ProductGroupCard group={item} onAdd={handleAddToCart} />
      )}
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
  );

  return (
    <SafeAreaView style={styles.container}>
      {searchBarContent}

      {isTablet ? (
        <View style={styles.tabletRow}>
          <ScrollView
            style={styles.tabletLeftPane}
            contentContainerStyle={styles.tabletLeftScroll}
            showsVerticalScrollIndicator={false}>
            {filterPaneContent}
          </ScrollView>
          <View style={styles.tabletRightPane}>{productListContent}</View>
        </View>
      ) : (
        <>
          <View style={styles.filterWrapper}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Kategori:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={`cat-${cat}`}
                    onPress={() => setActiveCat(cat)}
                    style={[
                      styles.tabItem,
                      activeCat === cat && styles.tabActive,
                    ]}>
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

            <View style={[styles.filterRow, styles.filterRowSpacing]}>
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

            <View style={[styles.filterRow, styles.filterRowSpacing]}>
              <Text style={styles.filterLabel}>Kain:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {jenisKainList.map(kain => (
                  <TouchableOpacity
                    key={`kain-${kain}`}
                    onPress={() => setActiveJenisKain(kain)}
                    style={[
                      styles.tabItem,
                      activeJenisKain === kain && styles.tabActiveKain,
                    ]}>
                    <Text
                      style={[
                        styles.tabText,
                        activeJenisKain === kain && styles.tabTextActive,
                      ]}>
                      {kain}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {productListContent}
        </>
      )}
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

  listPadding: {padding: 15},

  // --- TABLET SPLIT ---
  tabletRow: {flex: 1, flexDirection: 'row'},
  tabletLeftPane: {
    flex: 3,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  tabletLeftScroll: {padding: 16},
  tabletRightPane: {flex: 7, backgroundColor: '#F5F7FA'},

  filterGroupLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  filterChipWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#F0F2F5',
  },
  chipActive: {backgroundColor: '#E91E63'},
  chipActiveType: {backgroundColor: '#455A64'},
  chipActiveKain: {backgroundColor: '#00796B'},
  chipText: {fontSize: 11, color: '#666', fontWeight: 'bold'},
  chipTextActive: {color: '#fff'},

  // --- FILTER HP (baris horizontal, seperti asli) ---
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
  filterRowSpacing: {marginTop: 8},
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
  tabActive: {backgroundColor: '#E91E63'},
  tabActiveType: {backgroundColor: '#455A64'},
  tabActiveKain: {backgroundColor: '#00796B'},
  tabText: {fontSize: 11, color: '#666', fontWeight: 'bold'},
  tabTextActive: {color: '#fff'},

  // --- PRODUCT GROUP CARD ---
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  flex1: {flex: 1},
  productCode: {fontSize: 11, color: '#999', marginBottom: 2},
  productName: {fontSize: 14, fontWeight: 'bold', color: '#333'},
  priceHeaderCol: {alignItems: 'flex-end'},
  priceHeaderLabel: {fontSize: 9, color: '#999'},
  priceHeaderValue: {fontSize: 14, fontWeight: 'bold', color: '#1976D2'},

  badgeRow: {flexDirection: 'row', gap: 6, marginBottom: 10},
  badgeTipe: {paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4},
  tipeText: {fontSize: 9, color: '#fff', fontWeight: 'bold'},
  badgeKain: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kainText: {fontSize: 9, color: '#00796B', fontWeight: 'bold'},

  sectionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 6,
    marginTop: 8,
  },
  sizeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  sizeBtn: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 56,
  },
  sizeBtnActive: {borderColor: '#1976D2', backgroundColor: '#E3F2FD'},
  sizeBtnText: {fontSize: 12, fontWeight: 'bold', color: '#333'},
  sizeBtnPrice: {fontSize: 9, color: '#666', marginTop: 2},
  sizeBtnTextActive: {color: '#1976D2'},

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 20,
  },
  qtyBtn: {padding: 8},
  qtyValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  btnAddCart: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  btnDisabled: {backgroundColor: '#BDBDBD'},
  btnAddCartText: {color: '#fff', fontWeight: 'bold', fontSize: 13},

  emptyState: {alignItems: 'center', marginTop: 100},
  emptyText: {marginTop: 10, color: '#999'},

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#999',
    fontSize: 13,
  },
});

export default BazarProductListScreen;
