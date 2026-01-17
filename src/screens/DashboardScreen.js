import React, {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect, // Jangan lupa import useEffect
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Modal, // Import Modal
  ActivityIndicator, // Import ActivityIndicator
  FlatList, // Import FlatList
  ToastAndroid, // Import ToastAndroid
  Alert, // Import Alert
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import ManagementDashboardScreen from './ManagementDashboardScreen';
// Import API yang dibutuhkan untuk otorisasi
import {
  getPendingAuthorizationApi,
  processAuthorizationApi,
} from '../api/ApiService';

const {width} = Dimensions.get('window');

// --- Helper Format Rupiah (Copy dari ManagementDashboardScreen jika belum ada global helper) ---
const formatRupiah = angka => {
  const numberValue = Number(angka);
  if (isNaN(numberValue)) return 'Rp 0';
  const roundedValue = Math.round(numberValue);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundedValue);
};

// --- KOMPONEN TERPISAH (Copy dari ManagementDashboardScreen) ---
// 1. Item Request Satuan
const AuthItem = React.memo(
  ({item, onProcess, processingId}) => {
    const isProcessing = processingId === item.o_nomor;

    return (
      <View style={styles.authItemCard}>
        {/* HEADER: Jenis & Tanggal */}
        <View style={styles.authHeaderRow}>
          <View style={styles.authBadgeType}>
            <Text style={styles.authBadgeText}>{item.o_jenis}</Text>
          </View>
          <Text style={styles.authTimeText}>
            {new Date(item.o_created).toLocaleString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>

        {/* CONTENT UTAMA */}
        <View style={styles.authContent}>
          {item.o_transaksi ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 4,
              }}>
              <Icon
                name="file-text"
                size={12}
                color="#555"
                style={{marginRight: 4}}
              />
              <Text style={styles.authTrxText}>{item.o_transaksi}</Text>
            </View>
          ) : null}

          {item.o_barcode && item.o_barcode !== '' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 4,
              }}>
              <Icon
                name="maximize"
                size={12}
                color="#555"
                style={{marginRight: 4}}
              />
              <Text style={{fontSize: 12, color: '#555'}}>
                {item.o_barcode}
              </Text>
            </View>
          ) : null}

          {item.o_nominal > 0 && (
            <Text style={styles.authNominalText}>
              Nominal: {formatRupiah(item.o_nominal)}
            </Text>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.authDescText}>{item.o_ket}</Text>
          </View>

          <Text style={styles.authRequester}>Req by: {item.o_requester}</Text>
        </View>

        <View style={styles.authActionRow}>
          <TouchableOpacity
            style={[styles.btnAuthAction, styles.btnReject]}
            onPress={() => onProcess(item, 'REJECT')}
            disabled={!!processingId}>
            <Text style={styles.btnRejectText}>TOLAK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAuthAction, styles.btnApprove]}
            onPress={() => onProcess(item, 'APPROVE')}
            disabled={!!processingId}>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnApproveText}>SETUJUI</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.processingId === nextProps.processingId &&
      prevProps.item === nextProps.item
    );
  },
);

// 2. Group Cabang (Accordion) - Disederhanakan untuk User Toko karena biasanya hanya 1 cabang
// Tapi tetap pakai struktur yang sama agar konsisten
const BranchGroup = React.memo(
  ({item, expandedBranch, onToggle, onProcess, processingId}) => {
    const isExpanded = expandedBranch === item.branch;
    const count = item.data.length;

    return (
      <View style={styles.branchGroupContainer}>
        <TouchableOpacity
          style={[styles.branchHeader, isExpanded && styles.branchHeaderActive]}
          onPress={() => onToggle(item.branch)}
          activeOpacity={0.7}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={styles.branchIconBg}>
              <Icon name="map-pin" size={16} color="#fff" />
            </View>
            <Text style={styles.branchTitle}>CABANG {item.branch}</Text>
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#666"
              style={{marginLeft: 10}}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.branchContent}>
            {item.data.map(request => (
              <AuthItem
                key={request.o_nomor}
                item={request}
                onProcess={onProcess}
                processingId={processingId}
              />
            ))}
          </View>
        )}
      </View>
    );
  },
);

// --- BOUNCY BUTTON ---
const BouncyButton = ({onPress, children, style}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scaleValue, {toValue: 0.96, useNativeDriver: true}).start();
  const onPressOut = () =>
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}>
      <Animated.View style={[style, {transform: [{scale: scaleValue}]}]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// --- QUICK ACCESS ITEM (NEW) ---
const QuickAccessItem = ({item}) => (
  <BouncyButton style={styles.quickItemContainer} onPress={item.onPress}>
    <View
      style={[
        styles.quickIconBox,
        {backgroundColor: item.bgColor || '#E3F2FD'},
      ]}>
      <Icon
        name={item.iconName}
        size={22}
        color={item.iconColor || '#1565C0'}
      />
    </View>
    <Text style={styles.quickTitle} numberOfLines={2}>
      {item.title}
    </Text>
  </BouncyButton>
);

// --- MENU ITEM CARD (LIST STYLE) ---
const MenuItem = ({item}) => (
  <BouncyButton style={styles.menuItemContainer} onPress={item.onPress}>
    <View
      style={[styles.iconBox, {backgroundColor: item.bgColor || '#FFEBEE'}]}>
      <Icon
        name={item.iconName}
        size={24}
        color={item.iconColor || '#D32F2F'}
      />
    </View>
    <View style={styles.menuTextContainer}>
      <Text style={styles.menuTitle}>{item.title}</Text>
      <Text style={styles.menuDesc}>{item.desc || 'Akses fitur ini'}</Text>
    </View>
    <Icon name="chevron-right" size={20} color="#E0E0E0" />
  </BouncyButton>
);

const DashboardScreen = ({navigation}) => {
  const {logout, userInfo, userToken} = useContext(AuthContext); // Ambil userToken

  // --- STATE OTORISASI ---
  const [otorisasiVisible, setOtorisasiVisible] = useState(false);
  const [authList, setAuthList] = useState([]);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [processingAuth, setProcessingAuth] = useState(null);
  const [expandedBranch, setExpandedBranch] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const isSpecialUser = useMemo(() => {
    if (!userInfo || !userInfo.nama || !userInfo.cabang) return false;
    const userBranch = userInfo.cabang;
    const userName = userInfo.nama.toUpperCase();
    if (userBranch !== 'KDC') return false;
    const allowedNames = ['DARUL', 'HARIS', 'ESTU', 'RIO'];
    return allowedNames.some(name => userName.includes(name));
  }, [userInfo]);

  useLayoutEffect(() => {
    navigation.setOptions({headerShown: false});
  }, [navigation]);

  // --- LOGIC FETCH OTORISASI ---
  const fetchPendingAuth = useCallback(async () => {
    setLoadingAuth(true);
    try {
      const res = await getPendingAuthorizationApi(userToken);
      if (isMounted.current) {
        setAuthList(res.data.data || []);
      }
    } catch (error) {
      console.log('Err Auth:', error);
      // Optional: Alert error jika perlu
    } finally {
      if (isMounted.current) setLoadingAuth(false);
    }
  }, [userToken]);

  // --- LOGIC GROUPING & PROCESS ---
  const groupedAuthList = useMemo(() => {
    if (!authList.length) return [];
    const groups = {};
    authList.forEach(item => {
      const cab = item.o_cab || 'LAINNYA';
      if (!groups[cab]) groups[cab] = [];
      groups[cab].push(item);
    });
    return Object.keys(groups)
      .sort()
      .map(key => ({
        branch: key,
        data: groups[key],
      }));
  }, [authList]);

  const toggleBranch = useCallback(branchCode => {
    setExpandedBranch(prev => (prev === branchCode ? null : branchCode));
  }, []);

  const handleProcessAuth = useCallback(
    async (item, action) => {
      setProcessingAuth(item.o_nomor);
      try {
        await processAuthorizationApi(item.o_nomor, action, userToken);
        ToastAndroid.show(
          `Berhasil di-${action === 'APPROVE' ? 'setujui' : 'tolak'}`,
          ToastAndroid.SHORT,
        );
        setAuthList(prev => prev.filter(req => req.o_nomor !== item.o_nomor));
      } catch (error) {
        Alert.alert(
          'Gagal',
          error.response?.data?.message || 'Gagal memproses',
        );
      } finally {
        if (isMounted.current) setProcessingAuth(null);
      }
    },
    [userToken],
  );

  const renderAuthItem = useCallback(
    ({item}) => (
      <BranchGroup
        item={item}
        expandedBranch={expandedBranch}
        onToggle={toggleBranch}
        onProcess={handleProcessAuth}
        processingId={processingAuth}
      />
    ),
    [expandedBranch, processingAuth, toggleBranch, handleProcessAuth],
  );

  if (isSpecialUser)
    return <ManagementDashboardScreen navigation={navigation} />;

  // --- DATA MENU ---
  const allMenus = [
    // GUDANG
    {
      group: 'Gudang',
      title: 'Packing',
      desc: 'Scan barang keluar',
      iconName: 'box',
      iconColor: '#1976D2',
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('Packing'),
      allowed: userInfo?.cabang === 'P04',
    },
    {
      group: 'Gudang',
      title: 'Packing List',
      desc: 'Buat Packing List untuk Store',
      iconName: 'list',
      iconColor: '#1976D2',
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('PackingList'),
      allowed: userInfo?.cabang === 'KDC' || userInfo?.cabang === 'KBS',
    },
    {
      group: 'Gudang',
      title: 'Riwayat Packing',
      desc: 'Log aktivitas',
      iconName: 'clock',
      iconColor: '#1976D2',
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('PackingHistory'),
      allowed: userInfo?.cabang === 'P04',
    },
    {
      group: 'Gudang',
      title: 'Checker',
      desc: 'Cek STBJ dari Produksi',
      iconName: 'check-square',
      iconColor: '#388E3C',
      bgColor: '#E8F5E9',
      onPress: () => navigation.navigate('Checker'),
      allowed: ['P04', 'KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Gudang',
      title: 'Ambil Barang',
      desc: 'SJ ke K01 Padokan',
      iconName: 'shopping-cart',
      iconColor: '#E65100', // Oranye Tua
      bgColor: '#FFF3E0',
      onPress: () => navigation.navigate('AmbilBarang'),
      // Khusus user KDC yang bisa melakukan pengambilan barang
      allowed: userInfo?.cabang === 'KDC',
    },
    // TOKO
    {
      group: 'Toko',
      title: 'Permintaan Otomatis',
      desc: 'Cek stok habis',
      iconName: 'trending-down',
      iconColor: '#D32F2F',
      bgColor: '#FFEBEE',
      onPress: () => navigation.navigate('LowStock'),
      allowed:
        ['KDC', 'KBS'].includes(userInfo?.cabang) ||
        (userInfo?.cabang?.startsWith('K') && userInfo?.cabang !== 'P04'),
    },
    {
      group: 'Toko',
      title: 'Penjualan',
      desc: 'Kasir & Transaksi',
      iconName: 'shopping-cart',
      iconColor: '#F57C00',
      bgColor: '#FFF3E0',
      onPress: () => navigation.navigate('PenjualanList'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Toko',
      title: 'Minta Barang',
      desc: 'Request ke pusat',
      iconName: 'shopping-bag',
      iconColor: '#7B1FA2',
      bgColor: '#F3E5F5',
      onPress: () => navigation.navigate('MintaBarang'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Toko',
      title: 'Stok Real Time',
      desc: 'Cek stok fisik saat ini',
      iconName: 'bar-chart-2',
      iconColor: '#0D47A1',
      bgColor: '#E3F2FD',
      onPress: () => navigation.navigate('RealTimeStock'),
      allowed: userInfo?.cabang?.startsWith('K'), // Tersedia untuk semua cabang toko
    },
    // [BARU] MENU OTORISASI UNTUK USER TOKO
    {
      group: 'Toko',
      title: 'Otorisasi',
      desc: 'Persetujuan (Approval)',
      iconName: 'check-circle',
      iconColor: '#2E7D32', // Hijau tua
      bgColor: '#E8F5E9',
      onPress: () => {
        setOtorisasiVisible(true);
        fetchPendingAuth();
      },
      // Allowed untuk user cabang Kxx (Toko) selain KDC/KBS
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    // ADMIN
    {
      group: 'Admin',
      title: 'Mutasi Kirim',
      desc: 'Kirim antar cabang',
      iconName: 'send',
      iconColor: '#00796B',
      bgColor: '#E0F2F1',
      onPress: () => navigation.navigate('MutasiStore'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Admin',
      title: 'Mutasi Terima',
      desc: 'Terima barang',
      iconName: 'download',
      iconColor: '#00796B',
      bgColor: '#E0F2F1',
      onPress: () => navigation.navigate('MutasiTerima'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Admin',
      title: 'Retur Admin',
      desc: 'Kembalikan barang ke DC',
      iconName: 'rotate-ccw',
      iconColor: '#C2185B',
      bgColor: '#FCE4EC',
      onPress: () => navigation.navigate('ReturAdmin'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Admin',
      title: 'Riwayat Packing', // Judul Baru
      desc: 'Arsip Packing List', // Deskripsi Baru
      iconName: 'archive',
      iconColor: '#455A64',
      bgColor: '#ECEFF1',
      // Pastikan nama screen di AppNavigator Anda adalah 'RiwayatPackingList'
      onPress: () => navigation.navigate('RiwayatPackingList'),
      allowed: ['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Admin',
      title: 'Terima SJ',
      desc: 'Konfirmasi SJ',
      iconName: 'check-circle',
      iconColor: '#455A64',
      bgColor: '#ECEFF1',
      onPress: () => navigation.navigate('TerimaSj'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    {
      group: 'Admin',
      title: 'Laporan Pending',
      desc: 'Transaksi gantung',
      iconName: 'alert-circle',
      iconColor: '#E64A19',
      bgColor: '#FBE9E7',
      onPress: () => navigation.navigate('LaporanPending'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        !['KDC', 'KBS'].includes(userInfo?.cabang),
    },
    // LAINNYA
    {
      group: 'Lainnya',
      title: 'Stok Opname',
      desc: 'Audit fisik',
      iconName: 'clipboard',
      iconColor: '#303F9F',
      bgColor: '#E8EAF6',
      onPress: () => navigation.navigate('StokOpname'),
      // [UPDATE] Logika baru: User RIO bisa akses di KDC maupun semua Toko (K01-K11)
      allowed:
        // 1. Pastikan user adalah RIO
        (userInfo?.kode === 'RIO' ||
          userInfo?.nama?.toUpperCase().includes('RIO')) &&
        // 2. Cabang bisa KDC atau Toko (Kxx)
        (userInfo?.cabang === 'KDC' || userInfo?.cabang?.startsWith('K')),
    },
    {
      group: 'Lainnya',
      title: 'Tautkan WA',
      desc: 'Notifikasi WA',
      iconName: 'message-circle',
      iconColor: '#25D366',
      bgColor: '#E8F5E9',
      onPress: () => navigation.navigate('LinkWhatsapp'),
      allowed: userInfo?.cabang?.startsWith('K'),
    },
  ];

  // Logic Quick Access (Ambil 4 menu pertama yang allowed)
  const quickAccessMenus = allMenus.filter(m => m.allowed).slice(0, 4);

  // Logic Grouping untuk List di Bawah
  const groupedMenus = allMenus.reduce((acc, menu) => {
    if (menu.allowed) {
      if (!acc[menu.group]) acc[menu.group] = [];
      acc[menu.group].push(menu);
    }
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* 1. HEADER (Tinggi 280 agar muat Quick Access) */}
      <View style={{height: 280, overflow: 'hidden'}}>
        <LinearGradient
          colors={['#1565C0', '#42A5F5']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradientHeader}>
          {/* User Info */}
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greetingLight}>Halo,</Text>
              <Text style={styles.usernameBig} numberOfLines={1}>
                {userInfo?.nama || 'User'}
              </Text>
              <View style={styles.branchBadge}>
                <Icon name="map-pin" size={12} color="#fff" />
                <Text style={styles.branchText}>
                  {userInfo?.cabang || 'Unknown'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Icon name="log-out" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={{paddingBottom: 50}}
        showsVerticalScrollIndicator={false}>
        {/* 2. FLOATING QUICK ACCESS (Kartu Putih di Atas) */}
        {quickAccessMenus.length > 0 && (
          <View style={styles.quickAccessCard}>
            <Text style={styles.quickAccessLabel}>Akses Cepat</Text>
            <View style={styles.quickAccessRow}>
              {quickAccessMenus.map((item, index) => (
                <QuickAccessItem key={index} item={item} />
              ))}
            </View>
          </View>
        )}

        {/* 3. MENU LIST BIASA */}
        {Object.keys(groupedMenus).map((group, index) => (
          <View key={index} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{group}</Text>
            {groupedMenus[group].map((menu, idx) => (
              <MenuItem key={idx} item={menu} />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* --- MODAL OTORISASI (USER TOKO) --- */}
      <Modal
        visible={otorisasiVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOtorisasiVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: '80%'}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Daftar Persetujuan</Text>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity
                  onPress={fetchPendingAuth}
                  style={{marginRight: 15}}>
                  <Icon name="refresh-cw" size={20} color="#1976D2" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOtorisasiVisible(false)}>
                  <Icon name="x" size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
            {loadingAuth ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1976D2" />
                <Text style={{marginTop: 10, color: '#666'}}>
                  Memuat data...
                </Text>
              </View>
            ) : (
              <FlatList
                data={groupedAuthList}
                keyExtractor={item => item.branch}
                renderItem={renderAuthItem}
                contentContainerStyle={{padding: 16}}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Icon name="check-square" size={48} color="#ddd" />
                    <Text style={styles.emptyText}>
                      Tidak ada permintaan pending.
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},

  // HEADER
  gradientHeader: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    // Radius bawah dihilangkan agar menyatu dengan floating card
    // atau biarkan radius jika ingin floating card terlihat 'terpisah'
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    justifyContent: 'flex-start',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingLight: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  usernameBig: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
    maxWidth: width * 0.7,
  },
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  branchText: {color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 6},
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 12,
    marginTop: 5,
  },

  // CONTENT
  contentContainer: {
    flex: 1,
    marginTop: -100, // TARIK LEBIH TINGGI AGAR QUICK ACCESS NAIK
    paddingHorizontal: 20,
  },

  // --- STYLE BARU: FLOATING QUICK ACCESS ---
  quickAccessCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    // Efek Floating Mewah
    shadowColor: '#1565C0', // Shadow warna biru
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  quickAccessLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#90A4AE',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  quickAccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Sebar 4 item
  },
  quickItemContainer: {
    alignItems: 'center',
    width: '22%', // Agar muat 4 item
  },
  quickIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16, // Sedikit rounded box
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 11,
    color: '#37474F',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 14,
  },

  // LIST MENU STYLE
  sectionContainer: {marginBottom: 20},
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#546E7A', // Kembali ke abu-abu gelap karena background pasti putih
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {flex: 1},
  menuTitle: {fontSize: 16, fontWeight: 'bold', color: '#37474F'},
  menuDesc: {fontSize: 12, color: '#90A4AE', marginTop: 2},
  emptyState: {alignItems: 'center', marginTop: 100},

  // --- STYLE MODAL OTORISASI (COPY DARI MANAGEMENT DASHBOARD) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  authItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 1,
  },
  authHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authBadgeType: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  authBadgeText: {
    color: '#1565C0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  authTimeText: {
    fontSize: 11,
    color: '#999',
  },
  authContent: {
    marginBottom: 12,
  },
  authTrxText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginBottom: 2,
  },
  authNominalText: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  authDescText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  authRequester: {
    fontSize: 12,
    color: '#757575',
  },
  authActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  btnAuthAction: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  btnReject: {
    backgroundColor: '#FFEBEE',
  },
  btnApprove: {
    backgroundColor: '#1976D2',
  },
  btnRejectText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: 'bold',
  },
  btnApproveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
  },
  branchGroupContainer: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
  },
  branchHeaderActive: {
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  branchIconBg: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  branchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  countBadge: {
    backgroundColor: '#FF5252',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  branchContent: {
    padding: 10,
    backgroundColor: '#FAFAFA',
  },
});

export default DashboardScreen;
