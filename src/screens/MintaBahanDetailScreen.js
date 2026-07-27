import React, {
  useRef,
  useState,
  useContext,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  getMintaBahanDetailsApi,
  approveMintaBahanRealisasiApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const MintaBahanDetailScreen = ({route}) => {
  const {nomor} = route.params;
  const {userToken} = useContext(AuthContext);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [approvingNomor, setApprovingNomor] = useState(null);
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'realisasi'

  const scrollRef = useRef(null);

  const fetchDetail = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) {
        setIsLoading(true);
      }
      try {
        const response = await getMintaBahanDetailsApi(nomor, userToken);
        setData(response.data.data);
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Gagal',
          text2: 'Gagal memuat detail permintaan.',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [nomor, userToken],
  );

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDetail(true);
  };

  const goToTab = index => {
    scrollRef.current?.scrollTo({x: index * SCREEN_WIDTH, animated: true});
    setActiveTab(index === 0 ? 'items' : 'realisasi');
  };

  const handleScrollEnd = e => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveTab(index === 0 ? 'items' : 'realisasi');
  };

  const handleApprove = realisasi => {
    Alert.alert(
      'Konfirmasi Approve',
      `Setujui realisasi ${realisasi.NoRealisasi}?\nStok akan otomatis bertambah setelah approve.`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Approve',
          onPress: () => doApprove(realisasi.NoRealisasi),
        },
      ],
    );
  };

  const doApprove = async noRealisasi => {
    setApprovingNomor(noRealisasi);
    try {
      await approveMintaBahanRealisasiApi(noRealisasi, userToken);
      Toast.show({
        type: 'success',
        text1: 'Berhasil',
        text2: `${noRealisasi} disetujui, stok telah ditambahkan.`,
      });
      fetchDetail(true);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: error.response?.data?.message || 'Gagal approve realisasi.',
      });
    } finally {
      setApprovingNomor(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#7B1FA2"
          style={{marginTop: 50}}
        />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Data tidak ditemukan.</Text>
      </SafeAreaView>
    );
  }

  const renderItemBarang = ({item}) => {
    const sisa = (item.Jumlah || 0) - (item.Realisasi || 0);
    const isDone = sisa <= 0;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemNama} numberOfLines={2}>
            {item.Nama}
          </Text>
          {isDone ? (
            <View style={styles.badgeDone}>
              <Icon name="check" size={10} color="#2E7D32" />
              <Text style={styles.badgeDoneText}>Selesai</Text>
            </View>
          ) : (
            <View style={styles.badgeSisa}>
              <Text style={styles.badgeSisaText}>Sisa {sisa}</Text>
            </View>
          )}
        </View>
        <Text style={styles.itemKode}>
          {item.Kode} {item.Note ? `(${item.Note})` : ''}
        </Text>
        <View style={styles.itemProgressRow}>
          <Text style={styles.itemProgressText}>
            Diminta: {item.Jumlah} {item.Satuan}
          </Text>
          <Text style={styles.itemProgressText}>
            Direalisasi: {item.Realisasi} {item.Satuan}
          </Text>
        </View>
        {item.Keterangan ? (
          <Text style={styles.itemKeterangan}>Ket: {item.Keterangan}</Text>
        ) : null}
      </View>
    );
  };

  const renderRealisasi = ({item}) => {
    const isApproved = !!item.Approve;
    const isApproving = approvingNomor === item.NoRealisasi;

    // Cari rincian item untuk realisasi ini
    const details = data.realisasiDetails.filter(
      d => d.NomorRealisasi === item.NoRealisasi,
    );

    return (
      <View style={styles.realisasiCard}>
        <View style={styles.realisasiHeader}>
          <View>
            <Text style={styles.realisasiNomor}>{item.NoRealisasi}</Text>
            <Text style={styles.realisasiTanggal}>{item.TglRealisasi}</Text>
          </View>
          {isApproved ? (
            <View style={styles.badgeApproved}>
              <Icon name="check-circle" size={12} color="#2E7D32" />
              <Text style={styles.badgeApprovedText}>Approved</Text>
            </View>
          ) : (
            <View style={styles.badgeWaiting}>
              <Icon name="clock" size={12} color="#E65100" />
              <Text style={styles.badgeWaitingText}>Menunggu</Text>
            </View>
          )}
        </View>

        <View style={styles.realisasiDetailsList}>
          {details.map((d, idx) => (
            <View key={idx} style={styles.realisasiDetailRow}>
              <Text style={styles.realisasiDetailNama} numberOfLines={1}>
                {d.Nama}
              </Text>
              <Text style={styles.realisasiDetailQty}>
                {d.Jumlah} {d.Satuan}
              </Text>
            </View>
          ))}
        </View>

        {item.Keterangan ? (
          <Text style={styles.itemKeterangan}>Ket: {item.Keterangan}</Text>
        ) : null}

        {!isApproved && (
          <TouchableOpacity
            style={styles.btnApprove}
            onPress={() => handleApprove(item)}
            disabled={isApproving}>
            {isApproving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="check" size={16} color="#fff" />
                <Text style={styles.btnApproveText}>APPROVE & TAMBAH STOK</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const pendingCount = data.realisasi.filter(r => !r.Approve).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerInfo}>
        <Text style={styles.headerNomor}>{nomor}</Text>
      </View>

      {/* TAB SWITCH */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'items' && styles.tabBtnActive]}
          onPress={() => goToTab(0)}>
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'items' && styles.tabBtnTextActive,
            ]}>
            Barang Diminta ({data.items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'realisasi' && styles.tabBtnActive,
          ]}
          onPress={() => goToTab(1)}>
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'realisasi' && styles.tabBtnTextActive,
            ]}>
            Realisasi ({data.realisasi.length})
          </Text>
          {pendingCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{flex: 1}}>
        {/* HALAMAN 1: BARANG DIMINTA */}
        <View style={{width: SCREEN_WIDTH}}>
          <FlatList
            data={data.items}
            renderItem={renderItemBarang}
            keyExtractor={(item, idx) => `${item.Kode}-${idx}`}
            contentContainerStyle={{padding: 10, paddingBottom: 30}}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>Tidak ada barang diminta.</Text>
            }
          />
        </View>

        {/* HALAMAN 2: REALISASI */}
        <View style={{width: SCREEN_WIDTH}}>
          <FlatList
            data={data.realisasi}
            renderItem={renderRealisasi}
            keyExtractor={item => item.NoRealisasi}
            contentContainerStyle={{padding: 10, paddingBottom: 30}}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>Belum ada realisasi.</Text>
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},

  headerInfo: {
    backgroundColor: '#fff',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerNomor: {fontSize: 15, fontWeight: 'bold', color: '#7B1FA2'},

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabBtnActive: {borderBottomColor: '#7B1FA2'},
  tabBtnText: {fontSize: 12, fontWeight: '600', color: '#999'},
  tabBtnTextActive: {color: '#7B1FA2'},
  tabBadge: {
    backgroundColor: '#E65100',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {color: '#fff', fontSize: 10, fontWeight: 'bold'},

  // Item Barang Diminta
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemNama: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  itemKode: {fontSize: 11, color: '#999', marginBottom: 6},
  itemProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    padding: 8,
    borderRadius: 6,
  },
  itemProgressText: {fontSize: 11, color: '#555'},
  itemKeterangan: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
    fontStyle: 'italic',
  },

  badgeDone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 3,
  },
  badgeDoneText: {fontSize: 10, fontWeight: 'bold', color: '#2E7D32'},
  badgeSisa: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeSisaText: {fontSize: 10, fontWeight: 'bold', color: '#E65100'},

  // Realisasi
  realisasiCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  realisasiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  realisasiNomor: {fontSize: 13, fontWeight: 'bold', color: '#333'},
  realisasiTanggal: {fontSize: 11, color: '#999', marginTop: 2},

  badgeApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeApprovedText: {fontSize: 10, fontWeight: 'bold', color: '#2E7D32'},
  badgeWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeWaitingText: {fontSize: 10, fontWeight: 'bold', color: '#E65100'},

  realisasiDetailsList: {
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
  },
  realisasiDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  realisasiDetailNama: {fontSize: 12, color: '#555', flex: 1, marginRight: 8},
  realisasiDetailQty: {fontSize: 12, color: '#333', fontWeight: '600'},

  btnApprove: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 10,
    gap: 8,
  },
  btnApproveText: {color: '#fff', fontWeight: 'bold', fontSize: 13},

  emptyText: {textAlign: 'center', marginTop: 50, color: '#999', fontSize: 12},
});

export default MintaBahanDetailScreen;
