import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  Animated, // Import Animated
  PanResponder, // Import PanResponder untuk Swipe
  Easing,
  ToastAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {LineChart} from 'react-native-chart-kit';
import {AuthContext} from '../context/AuthContext';
import DeviceInfo from 'react-native-device-info';
import EmptyStockModal from '../components/EmptyStockModal';
import {useRoute} from '@react-navigation/native';

import {
  getDashboardTodayStatsApi,
  getDashboardPiutangApi,
  getDashboardBranchPerformanceApi,
  getDashboardSalesChartApi,
  getDashboardTargetSummaryApi,
  getDashboardPiutangPerCabangApi,
  getDashboardPiutangDetailApi,
  getDashboardTopSellingApi,
  getDashboardStockSpreadApi,
  getDashboardProductSalesSpreadApi,
  getDashboardTrendsApi,
  getEmptyStockRegulerApi,
  getCabangListApi,
  getPendingAuthorizationApi,
  processAuthorizationApi,
  getDashboardNegativeStockApi,
} from '../api/ApiService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75; // Lebar Menu 75% layar

// Helper Format Rupiah (Updated: Tanpa Desimal)
const formatRupiah = angka => {
  // 1. Pastikan input dikonversi jadi Angka (Number)
  const numberValue = Number(angka);

  // 2. Cek validasi, jika bukan angka kembalikan Rp 0
  if (isNaN(numberValue)) return 'Rp 0';

  // 3. Lakukan Pembulatan (Math.round)
  // Ini akan membulatkan 990,33 -> 990 | 990,80 -> 991
  const roundedValue = Math.round(numberValue);

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0, // Minimal 0 digit desimal
    maximumFractionDigits: 0, // Maksimal 0 digit desimal (Wajib)
  }).format(roundedValue);
};

// 2. HELPER COMPONENTS (CountUp & AnimatedBar)
// Taruh di sini (Antara Import dan Main Component)

const CountUp = ({value, formatter, style}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value,
      duration: 1500,
      useNativeDriver: false,
      easing: Easing.out(Easing.exp),
    }).start();

    const listenerId = animatedValue.addListener(({value: v}) => {
      setDisplayValue(v);
    });

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [value, animatedValue]); // <--- FIX: Tambahkan animatedValue di sini

  return (
    <Text style={style}>
      {formatter ? formatter(displayValue) : Math.round(displayValue)}
    </Text>
  );
};

const AnimatedBar = ({percentage, color, height = 10, style}) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage > 100 ? 100 : percentage,
      duration: 1200,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [percentage, widthAnim]); // <--- FIX: Tambahkan widthAnim di sini

  return (
    <View
      style={[
        style,
        {
          height,
          backgroundColor: '#E0E0E0',
          borderRadius: height / 2,
          overflow: 'hidden',
        },
      ]}>
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
          width: widthAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
};

// --- KOMPONEN TERPISAH (MEMOIZED) ---

// 1. Item Request Satuan
const AuthItem = React.memo(
  ({item, onProcess, processingId}) => {
    const isProcessing = processingId === item.o_nomor;
    const isBorrowing = item.o_jenis === 'PEMINJAMAN_BARANG';

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
          {/* 1. NOMOR INVOICE (o_transaksi) */}
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

          {/* 2. BARCODE (o_barcode) - Jika Ada */}
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

          {/* 3. NOMINAL */}
          {item.o_nominal > 0 && (
            <Text style={styles.authNominalText}>
              Nominal: {formatRupiah(item.o_nominal)}
            </Text>
          )}

          {isBorrowing ? (
            <Text style={[styles.authNominalText, {color: '#2E7D32'}]}>
              Total Pinjam: {item.o_nominal} Pcs
            </Text>
          ) : (
            item.o_nominal > 0 && (
              <Text style={styles.authNominalText}>
                Nominal: {formatRupiah(item.o_nominal)}
              </Text>
            )
          )}

          {/* 4. KETERANGAN (Cust Name + Item Name) */}
          {/* Karena kita menyimpan "Cust: Budi \n Item: Kaos" di o_ket, text ini akan muncul multi-line */}
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
    // Hanya render ulang jika processingId berubah (sedang loading item ini)
    return (
      prevProps.processingId === nextProps.processingId &&
      prevProps.item === nextProps.item
    );
  },
);

// 2. Group Cabang (Accordion)
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
            <Text style={styles.branchTitle}>{item.branchName}</Text>
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
                key={request.o_nomor} // Key unik
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

// --- KOMPONEN BARU: BRANCH SELECTOR MODAL (Bottom Sheet Style) ---
const BranchSelectorModal = ({
  visible,
  onClose,
  branches,
  selected,
  onSelect,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}>
        <View style={styles.bottomSheetContent}>
          <View style={styles.bottomSheetHeader}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Pilih Cabang</Text>
          </View>

          <ScrollView contentContainerStyle={{padding: 20}}>
            {/* Opsi SEMUA */}
            <TouchableOpacity
              style={[
                styles.branchOption,
                selected === 'ALL' && styles.branchOptionActive,
              ]}
              onPress={() => onSelect('ALL')}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View
                  style={[
                    styles.branchIcon,
                    selected === 'ALL'
                      ? {backgroundColor: '#fff'}
                      : {backgroundColor: '#E3F2FD'},
                  ]}>
                  <Icon
                    name="grid"
                    size={18}
                    color={selected === 'ALL' ? '#1565C0' : '#1565C0'}
                  />
                </View>
                <Text
                  style={[
                    styles.branchOptionText,
                    selected === 'ALL' && styles.branchOptionTextActive,
                  ]}>
                  Semua Cabang
                </Text>
              </View>
              {selected === 'ALL' && (
                <Icon name="check-circle" size={20} color="#fff" />
              )}
            </TouchableOpacity>

            {/* List Cabang */}
            {branches.map((cab, index) => {
              // 1. Logika Fallback Properti yang Kuat
              // Cek berbagai kemungkinan nama kolom dari database
              const kode =
                cab.gdg_kode ||
                cab.kode ||
                cab.kode_cabang ||
                cab.cabang_kode ||
                '?';
              const nama =
                cab.gdg_nama ||
                cab.nama ||
                cab.nama_cabang ||
                cab.cabang_nama ||
                'Cabang';

              const isSelected = selected === kode;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.branchOption,
                    isSelected && styles.branchOptionActive,
                  ]}
                  onPress={() => onSelect(kode)}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View
                      style={[
                        styles.branchIcon,
                        isSelected
                          ? {backgroundColor: '#fff'}
                          : {backgroundColor: '#F5F5F5'},
                      ]}>
                      <Text
                        style={{
                          fontWeight: 'bold',
                          color: '#1565C0',
                          fontSize: 12,
                        }}>
                        {kode}
                      </Text>
                    </View>
                    <View style={{marginLeft: 12}}>
                      <Text
                        style={[
                          styles.branchOptionText,
                          isSelected && styles.branchOptionTextActive,
                        ]}>
                        {nama}
                      </Text>
                      <Text
                        style={[
                          styles.branchOptionSub,
                          isSelected && {color: 'rgba(255,255,255,0.8)'},
                        ]}>
                        Kode: {kode}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Icon name="check-circle" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const ManagementDashboardScreen = ({navigation}) => {
  const route = useRoute();
  const {userInfo, userToken, logout} = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);

  // --- 1. AMBIL VERSI DINAMIS ---
  const appVersion = DeviceInfo.getVersion();

  // --- 2. LOGIC AKSES (Otorisasi Dinamis Berdasarkan Tanggal) ---
  const {showSidebar, canAuthorize} = useMemo(() => {
    if (!userInfo || !userInfo.nama) {
      return {showSidebar: false, canAuthorize: false};
    }

    const name = userInfo.nama.toUpperCase();

    // Ambil Waktu Sekarang
    const today = new Date();
    // Tentukan Batas Tanggal (Tahun, Bulan-1, Tanggal) -> Bulan Januari adalah 0
    const startTransfer = new Date(2026, 0, 12); // 12 Jan 2026
    const endTransfer = new Date(2026, 0, 17); // 17 Jan 2026 (Jam 00:00)
    const isEstuManagerPeriod = today >= startTransfer && today < endTransfer;

    // 1. Sidebar Access: Haris, Darul, Estu, Rio tetap bisa buka menu sidebar
    const sidebarAccess = ['HARIS', 'DARUL', 'ESTU', 'RIO'].some(allowed =>
      name.includes(allowed),
    );

    // 2. Authorization Logic:
    let authAccess = false;

    if (name.includes('ESTU')) {
      // ESTU selalu punya akses menu (karena handle Peminjaman Barang)
      authAccess = true;
    } else if (name.includes('DARUL')) {
      // DARUL selalu punya akses menu
      authAccess = true;
    } else if (name.includes('RIO')) {
      // --- TAMBAHKAN INI ---
      authAccess = true;
    } else if (name.includes('HARIS')) {
      // HARIS punya akses menu, KECUALI saat masa pengalihan ke Estu
      authAccess = !isEstuManagerPeriod;
    }

    return {showSidebar: sidebarAccess, canAuthorize: authAccess};
  }, [userInfo]);

  // --- STATE DASHBOARD ---
  const [todayStats, setTodayStats] = useState({sales: 0, qty: 0, trx: 0});
  const [piutang, setPiutang] = useState(0);
  const [branchPerformance, setBranchPerformance] = useState([]);
  const [salesChart, setSalesChart] = useState({labels: [], data: [0]});
  const [targetSummary, setTargetSummary] = useState({nominal: 0, target: 0});

  // --- STATE MONITORING PIUTANG ---
  const [piutangList, setPiutangList] = useState([]);
  const [loadingPiutangList, setLoadingPiutangList] = useState(true);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [detailInvoices, setDetailInvoices] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- STATE KHUSUS OTORISASI (UPDATED) ---
  const [otorisasiVisible, setOtorisasiVisible] = useState(false);
  const [authList, setAuthList] = useState([]); // List of pending requests
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [processingAuth, setProcessingAuth] = useState(null); // ID of item being processed
  const [expandedBranch, setExpandedBranch] = useState(null);

  // --- ANIMATED DRAWER STATE ---
  // Posisi awal di luar layar sebelah kiri (-DRAWER_WIDTH)
  const drawerTranslateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // --- LOADING FLAGS ---
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPiutang, setLoadingPiutang] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingTarget, setLoadingTarget] = useState(true);
  const [loadingBranch, setLoadingBranch] = useState(true);

  // --- STATE TOP PRODUCTS (BARU) ---
  const [topProducts, setTopProducts] = useState([]);
  const [loadingTopProducts, setLoadingTopProducts] = useState(true);

  // --- STATE MODAL STOK (INTERAKTIF) ---
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedProductItem, setSelectedProductItem] = useState(null); // Menyimpan info barang yg diklik
  const [stockSpreadList, setStockSpreadList] = useState([]); // Menyimpan list stok per cabang
  const [loadingStockSpread, setLoadingStockSpread] = useState(false);

  const [trends, setTrends] = useState({kain: [], lengan: []});
  const [loadingTrends, setLoadingTrends] = useState(true);

  // --- STATE STOK KOSONG ---
  const [emptyStockModalVisible, setEmptyStockModalVisible] = useState(false);
  const [emptyStockList, setEmptyStockList] = useState([]);
  const [loadingEmptyStock, setLoadingEmptyStock] = useState(false);
  const [emptyStockSearch, setEmptyStockSearch] = useState('');
  const [emptyStockBranchFilter, setEmptyStockBranchFilter] = useState(''); // Untuk filter KDC

  const [modalType, setModalType] = useState('SALES');

  // State untuk menyimpan daftar cabang dari database
  const [branchList, setBranchList] = useState([]);

  const [dashboardBranchFilter, setDashboardBranchFilter] = useState('ALL'); // Default ALL
  const [branchSelectorVisible, setBranchSelectorVisible] = useState(false); // Modal visibility

  // STATE BARU UNTUK STOK MINUS
  const [negativeStockList, setNegativeStockList] = useState([]);
  const [loadingNegativeStock, setLoadingNegativeStock] = useState(false);

  const isMounted = useRef(true);
  const isHaris = userInfo?.kode?.toUpperCase() === 'HARIS';

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- LOGIC ANIMASI DRAWER (SWIPE) ---

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
    Animated.spring(drawerTranslateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4, // Sedikit memantul agar organik
    }).start();
  }, [drawerTranslateX]);

  const closeDrawer = useCallback(() => {
    Animated.timing(drawerTranslateX, {
      toValue: -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.poly(4)),
    }).start(() => setIsDrawerOpen(false));
  }, [drawerTranslateX]);

  // PanResponder untuk menangani geseran jari
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Gunakan showSidebar agar Estu bisa swipe
        if (!showSidebar) return false;

        const {dx, moveX} = gestureState;
        if (!isDrawerOpen && moveX < 40 && dx > 10) return true;
        if (isDrawerOpen && dx < -10) return true;
        return false;
      },
      onPanResponderGrant: () => {
        // Saat sentuhan dimulai, kita set state open agar view ter-render
        if (!isDrawerOpen) setIsDrawerOpen(true);
      },
      onPanResponderMove: (_, gestureState) => {
        const {dx} = gestureState;
        // Hitung posisi baru berdasarkan geseran
        // Jika tertutup: posisi = -DRAWER_WIDTH + geseran kanan
        // Jika terbuka: posisi = 0 + geseran kiri (negatif)
        let newPos = isDrawerOpen ? dx : -DRAWER_WIDTH + dx;

        // Batasi posisi agar tidak lewat batas
        if (newPos > 0) newPos = 0;
        if (newPos < -DRAWER_WIDTH) newPos = -DRAWER_WIDTH;

        drawerTranslateX.setValue(newPos);
      },
      onPanResponderRelease: (_, gestureState) => {
        const {dx, vx} = gestureState;

        // Logika "Snap" (melepas jari)
        // Jika swipe cepat (velocity tinggi) atau geseran lebih dari 30% lebar drawer
        if (dx > DRAWER_WIDTH * 0.3 || vx > 0.5) {
          openDrawer(); // Snap buka
        } else if (dx < -DRAWER_WIDTH * 0.3 || vx < -0.5) {
          closeDrawer(); // Snap tutup
        } else {
          // Jika nanggung, kembalikan ke kondisi semula
          if (isDrawerOpen) openDrawer();
          else closeDrawer();
        }
      },
    }),
  ).current;

  // Background Opacity Animasi (0 -> 0.5)
  const backdropOpacity = drawerTranslateX.interpolate({
    inputRange: [-DRAWER_WIDTH, 0],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });

  // --- HEADER SETUP ---
  React.useLayoutEffect(() => {
    navigation.setOptions({
      // [FIX] Gunakan showSidebar, bukan isHaris
      headerLeft: showSidebar
        ? () => (
            <TouchableOpacity onPress={openDrawer} style={{marginLeft: 15}}>
              <Icon name="menu" size={24} color="#333" />
            </TouchableOpacity>
          )
        : undefined,
      headerTitle: 'Dashboard',
      headerTitleAlign: 'center',
    });
  }, [navigation, showSidebar, openDrawer]); // [FIX] Update dependency

  // --- FETCH FUNCTIONS ---
  const fetchTodayStats = useCallback(
    async (filter = 'ALL') => {
      try {
        const branchParam = filter === 'ALL' ? '' : filter; // Backend minta string kosong atau kode
        const res = await getDashboardTodayStatsApi(userToken, branchParam);
        if (isMounted.current) {
          setTodayStats({
            sales: res.data.todaySales || 0,
            qty: Number(res.data.todayQty || 0),
            trx: Number(res.data.todayTransactions || 0),
          });
          setLoadingStats(false);
        }
      } catch (error) {
        console.log('Err Stats:', error.message);
        if (isMounted.current) setLoadingStats(false);
      }
    },
    [userToken],
  );

  const fetchPiutang = useCallback(
    async (filter = 'ALL') => {
      try {
        const branchParam = filter === 'ALL' ? '' : filter;
        const res = await getDashboardPiutangApi(userToken, branchParam);
        if (isMounted.current) {
          setPiutang(res.data.totalSisaPiutang || 0);
          setLoadingPiutang(false);
        }
      } catch (error) {
        console.log('Err Piutang:', error.message);
        if (isMounted.current) setLoadingPiutang(false);
      }
    },
    [userToken],
  );

  const fetchPiutangList = useCallback(async () => {
    if (userInfo.cabang !== 'KDC') {
      if (isMounted.current) setLoadingPiutangList(false);
      return;
    }
    try {
      const res = await getDashboardPiutangPerCabangApi(userToken);
      if (isMounted.current) {
        setPiutangList(res.data || []);
        setLoadingPiutangList(false);
      }
    } catch (error) {
      console.log('Err Piutang List:', error.message);
      if (isMounted.current) setLoadingPiutangList(false);
    }
  }, [userToken, userInfo.cabang]);

  const handleOpenDetail = async branch => {
    setSelectedBranch({kode: branch.cabang_kode, nama: branch.cabang_nama});
    setDetailModalVisible(true);
    setLoadingDetail(true);
    setDetailInvoices([]);

    try {
      const res = await getDashboardPiutangDetailApi(
        branch.cabang_kode,
        userToken,
      );
      if (isMounted.current) {
        setDetailInvoices(res.data || []);
      }
    } catch (error) {
      console.log('Err Detail Piutang:', error.message);
    } finally {
      if (isMounted.current) setLoadingDetail(false);
    }
  };

  const fetchChart = useCallback(
    async (filter = 'ALL') => {
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        // LOG DEBUG: Pastikan filter yang dikirim benar
        console.log('Fetching Chart with Filter:', filter);

        const res = await getDashboardSalesChartApi(
          {
            startDate,
            endDate,
            groupBy: 'day',
            cabang: filter, // <--- PENTING: Backend harus terima ini
          },
          userToken,
        );

        if (isMounted.current && res.data?.length > 0) {
          setSalesChart({
            labels: res.data.map(d => {
              const dt = new Date(d.tanggal);
              return `${dt.getDate()}/${dt.getMonth() + 1}`;
            }),
            data: res.data.map(d => d.total),
          });
          setLoadingChart(false);
        }
      } catch (e) {
        if (isMounted.current) setLoadingChart(false);
      }
    },
    [userToken], // Dependency aman
  );

  const fetchTargetSummary = useCallback(
    async (filter = 'ALL') => {
      try {
        const branchParam = filter === 'ALL' ? '' : filter;
        const res = await getDashboardTargetSummaryApi(userToken, branchParam);
        if (isMounted.current) {
          setTargetSummary({
            nominal: Number(res.data.nominal || 0),
            target: Number(res.data.target || 0),
          });
          setLoadingTarget(false);
        }
      } catch (error) {
        console.log('Err Target:', error.message);
        if (isMounted.current) setLoadingTarget(false);
      }
    },
    [userToken],
  );

  const fetchBranchPerformance = useCallback(async () => {
    if (userInfo.cabang !== 'KDC') {
      if (isMounted.current) setLoadingBranch(false);
      return;
    }
    try {
      const res = await getDashboardBranchPerformanceApi(userToken);
      if (isMounted.current) {
        setBranchPerformance(res.data || []);
        setLoadingBranch(false);
      }
    } catch (error) {
      console.log('Err Branch:', error.message);
      if (isMounted.current) setLoadingBranch(false);
    }
  }, [userToken, userInfo.cabang]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await getCabangListApi(userToken);

      console.log('--- DEBUG BRANCH RESPONSE ---');
      // console.log(JSON.stringify(res.data, null, 2)); // Uncomment jika ingin lihat semua

      // Cek struktur response (apakah di res.data atau res.data.data)
      let listData = [];
      if (Array.isArray(res.data)) {
        listData = res.data; // Backend return langsung array: [{}, {}]
      } else if (res.data && Array.isArray(res.data.data)) {
        listData = res.data.data; // Backend return object: { success: true, data: [] }
      } else if (res.data && Array.isArray(res.data.rows)) {
        listData = res.data.rows; // Kadang backend pakai 'rows'
      }

      console.log('Jumlah Cabang Ditemukan:', listData.length);

      if (isMounted.current) {
        setBranchList(listData);
      }
    } catch (e) {
      console.log('Gagal load cabang:', e);
    }
  }, [userToken]);

  const fetchNegativeStock = useCallback(
    async (filter = 'ALL') => {
      // Logic mapping filter frontend ke backend
      // Backend mengharapkan kode cabang, atau 'ALL'/'KDC'
      let branchParam = filter;

      // Jika user KDC dan filter 'ALL', kita kirim 'ALL' biar backend handle logic "Semua Cabang DC"
      if (userInfo.cabang === 'KDC' && filter === 'ALL') {
        branchParam = 'ALL';
      }

      try {
        // Panggil API (Pastikan getDashboardNegativeStockApi sudah ada di ApiService)
        const res = await getDashboardNegativeStockApi(userToken, branchParam);

        if (isMounted.current) {
          // Validasi data array
          const data = Array.isArray(res.data.data) ? res.data.data : [];
          setNegativeStockList(data);
          setLoadingNegativeStock(false);
        }
      } catch (error) {
        console.log('Err Negative Stock:', error);
        if (isMounted.current) setLoadingNegativeStock(false);
      }
    },
    [userToken, userInfo.cabang],
  );

  const loadAllData = useCallback(
    filterOverride => {
      // LOGIC: Jika ada override (dari pull refresh), pakai itu.
      // Jika tidak, pakai state dashboardBranchFilter yang sedang aktif.
      const currentFilter =
        filterOverride !== undefined ? filterOverride : dashboardBranchFilter;

      console.log('LOADING ALL DATA for:', currentFilter);

      // Reset Loading
      setLoadingStats(true);
      setLoadingPiutang(true);
      setLoadingChart(true);
      setLoadingTarget(true);
      setLoadingTopProducts(true);
      setLoadingTrends(true);
      setLoadingNegativeStock(true);

      // Call APIs with Filter
      const filterParam = currentFilter === 'ALL' ? '' : currentFilter; // Backend handle 'ALL' or empty string

      // 1. Stats
      getDashboardTodayStatsApi(userToken, filterParam)
        .then(res => {
          if (isMounted.current) {
            setTodayStats({
              sales: res.data.todaySales || 0,
              qty: Number(res.data.todayQty || 0),
              trx: Number(res.data.todayTransactions || 0),
            });
            setLoadingStats(false);
          }
        })
        .catch(() => setLoadingStats(false));

      // 2. Piutang (Total Sisa) - Tetap dipanggil biar angkanya update sesuai cabang
      getDashboardPiutangApi(userToken, filterParam)
        .then(res => {
          if (isMounted.current) {
            setPiutang(res.data.totalSisaPiutang || 0);
            setLoadingPiutang(false);
          }
        })
        .catch(() => setLoadingPiutang(false));

      // 3. Chart
      fetchChart(currentFilter);

      // 4. Target
      getDashboardTargetSummaryApi(userToken, filterParam)
        .then(res => {
          if (isMounted.current) {
            setTargetSummary({
              nominal: Number(res.data.nominal || 0),
              target: Number(res.data.target || 0),
            });
            setLoadingTarget(false);
          }
        })
        .catch(() => setLoadingTarget(false));

      // 5. Top Products
      getDashboardTopSellingApi(userToken, currentFilter)
        .then(res => {
          if (isMounted.current) {
            setTopProducts(res.data.data || []);
            setLoadingTopProducts(false);
          }
        })
        .catch(() => setLoadingTopProducts(false));

      // 6. Trends
      getDashboardTrendsApi(userToken, currentFilter)
        .then(res => {
          if (isMounted.current) {
            setTrends(res.data.data || {kain: [], lengan: []});
            setLoadingTrends(false);
          }
        })
        .catch(() => setLoadingTrends(false));

      fetchNegativeStock(currentFilter);

      // 7. Data KDC Only (Ranking & List Piutang)
      // HANYA JIKA FILTER = ALL
      if (userInfo.cabang === 'KDC') {
        // Panggil fetchBranches agar list cabang terisi
        fetchBranches();

        if (currentFilter === 'ALL') {
          setLoadingBranch(true);
          getDashboardBranchPerformanceApi(userToken).then(res => {
            if (isMounted.current) {
              setBranchPerformance(res.data || []);
              setLoadingBranch(false);
            }
          });

          setLoadingPiutangList(true);
          getDashboardPiutangPerCabangApi(userToken).then(res => {
            if (isMounted.current) {
              setPiutangList(res.data || []);
              setLoadingPiutangList(false);
            }
          });
        }
      }
    },
    [
      userToken,
      userInfo.cabang,
      fetchChart,
      fetchNegativeStock,
      // TAMBAHKAN DUA INI UNTUK HILANGKAN WARNING:
      dashboardBranchFilter,
      fetchBranches,
    ],
  );

  useEffect(() => {
    if (userToken) {
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userToken, dashboardBranchFilter]);

  const handleFilterChange = branchCode => {
    // Cukup update state.
    // useEffect akan mendeteksi perubahan ini dan memanggil loadAllData() otomatis.
    setDashboardBranchFilter(branchCode);
    setBranchSelectorVisible(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTodayStats(),
      fetchPiutang(),
      fetchChart(),
      fetchTargetSummary(),
      fetchTopProducts(),
      userInfo.cabang === 'KDC' ? fetchBranchPerformance() : Promise.resolve(),
      userInfo.cabang === 'KDC' ? fetchPiutangList() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [
    fetchTodayStats,
    fetchPiutang,
    fetchChart,
    fetchTargetSummary,
    fetchBranchPerformance,
    fetchPiutangList,
    userInfo.cabang,
    fetchTopProducts,
  ]);

  // 1. Fetch Pending Requests
  const fetchPendingAuth = useCallback(async () => {
    setLoadingAuth(true);
    try {
      const res = await getPendingAuthorizationApi(userToken);
      if (isMounted.current) {
        setAuthList(res.data.data || []); // Pastikan akses .data.data sesuai struktur JSON backend
      }
    } catch (error) {
      console.log('Err Auth List FULL:', error);
      if (error.response) {
        // Cek status code
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);

        // Jika 401/403, berarti token masalah atau middleware menolak
        // Jika 404, berarti URL API salah/belum terdaftar di index.js
        // Jika 500, berarti query SQL salah

        if (error.response.status !== 401) {
          // Jangan logout jika errornya bukan 401 (Unauthorized)
          Alert.alert('Error', `Gagal memuat: ${error.response.status}`);
        }
      }
    } finally {
      if (isMounted.current) setLoadingAuth(false);
    }
  }, [userToken]);

  // [BARU] Listener untuk menangkap klik Notifikasi
  useEffect(() => {
    // Gunakan Optional Chaining ganda agar aman
    if (route?.params?.openApproval) {
      console.log('Membuka Approval dari Notifikasi');

      setOtorisasiVisible(true);
      fetchPendingAuth();

      // Reset params
      navigation.setParams({openApproval: null});
    }
  }, [route, fetchPendingAuth, navigation]);

  // Tambahkan ini di deretan useMemo Anda
  const branchNameMap = useMemo(() => {
    const map = {};
    branchList.forEach(cab => {
      const kode = cab.gdg_kode || cab.kode;
      const nama = cab.gdg_nama || cab.nama;
      if (kode) map[kode] = nama;
    });
    return map;
  }, [branchList]);

  // [BARU] Logic Pengelompokan Data per Cabang
  const groupedAuthList = useMemo(() => {
    if (!authList.length) return [];

    const groups = {};
    authList.forEach(item => {
      const cab = item.o_cab || 'LAINNYA'; // Fallback jika null
      if (!groups[cab]) {
        groups[cab] = [];
      }
      groups[cab].push(item);
    });

    // Ubah ke array agar bisa dirender FlatList: [{ branch: 'K01', data: [...] }, ...]
    return Object.keys(groups)
      .sort()
      .map(key => ({
        branch: key,
        // AMBIL NAMA DARI MAP, JIKA TIDAK ADA PAKAI KODE
        branchName: branchNameMap[key] || `CABANG ${key}`,
        data: groups[key],
      }));
  }, [authList, branchNameMap]);

  // [BARU] Toggle Expand/Collapse Cabang
  const toggleBranch = useCallback(branchCode => {
    setExpandedBranch(prev => (prev === branchCode ? null : branchCode));
  }, []);

  // 2. Process Request (Approve/Reject)
  const handleProcessAuth = useCallback(
    async (item, action) => {
      setProcessingAuth(item.o_nomor);
      try {
        await processAuthorizationApi(item.o_nomor, action, userToken);

        ToastAndroid.show(
          `Otorisasi berhasil di-${action === 'APPROVE' ? 'setujui' : 'tolak'}`,
          ToastAndroid.SHORT,
        );

        // Update list lokal
        setAuthList(prev => prev.filter(req => req.o_nomor !== item.o_nomor));
      } catch (error) {
        console.log('Err Process Auth:', error);
        const msg =
          error.response?.data?.message || 'Gagal memproses otorisasi';
        Alert.alert('Gagal', msg);
      } finally {
        if (isMounted.current) setProcessingAuth(null);
      }
    },
    [userToken],
  );

  // Fetch Top Products
  const fetchTopProducts = useCallback(
    async (filter = 'ALL') => {
      try {
        // Jika user KDC dan mau filter cabang tertentu, bisa dioper di parameter ke-2
        const res = await getDashboardTopSellingApi(userToken, filter);
        if (isMounted.current) {
          setTopProducts(res.data.data || []);
          setLoadingTopProducts(false);
        }
      } catch (error) {
        console.log('Err Top Products:', error.message);
        if (isMounted.current) setLoadingTopProducts(false);
      }
    },
    [userToken],
  );

  // Handler Saat Produk Diklik
  const handleCheckStock = async item => {
    setSelectedProductItem(item);
    setStockModalVisible(true);
    setLoadingStockSpread(true);
    setStockSpreadList([]);

    try {
      // Panggil API Cek Stok (Kirim Kode & Ukuran)
      const res = await getDashboardStockSpreadApi(
        item.KODE,
        item.UKURAN,
        userToken,
      );
      if (isMounted.current) {
        setStockSpreadList(res.data.data || []);
      }
    } catch (error) {
      Alert.alert('Gagal', 'Gagal memuat data stok.');
    } finally {
      if (isMounted.current) setLoadingStockSpread(false);
    }
  };

  // Handler 1: Untuk Top Product (Melihat Penjualan - HIJAU)
  const handleCheckSalesDetail = async item => {
    setModalType('SALES'); // Set tipe ke SALES
    setSelectedProductItem(item);
    setStockModalVisible(true);
    setLoadingStockSpread(true);
    setStockSpreadList([]);

    try {
      const res = await getDashboardProductSalesSpreadApi(
        item.KODE,
        item.UKURAN,
        userToken,
      );
      if (isMounted.current) setStockSpreadList(res.data.data || []);
    } catch (error) {
      console.log('Err Sales Spread:', error);
    } finally {
      if (isMounted.current) setLoadingStockSpread(false);
    }
  };

  // Handler 2: Untuk Stok Kosong (Melihat Stok Real - BIRU) -> TAMBAHKAN INI
  const handleCheckRealStock = async item => {
    setModalType('STOCK'); // Set tipe ke STOCK
    setSelectedProductItem(item);
    setStockModalVisible(true);
    setLoadingStockSpread(true);
    setStockSpreadList([]);

    try {
      // Panggil API Stok (tmasterstok)
      const res = await getDashboardStockSpreadApi(
        item.kode || item.KODE, // Sesuaikan casing properti dari list empty stock
        item.ukuran || item.UKURAN,
        userToken,
      );
      if (isMounted.current) setStockSpreadList(res.data.data || []);
    } catch (error) {
      console.log('Err Stock Spread:', error);
    } finally {
      if (isMounted.current) setLoadingStockSpread(false);
    }
  };

  // Function Fetch
  const fetchTrends = useCallback(
    async (filter = 'ALL') => {
      try {
        const res = await getDashboardTrendsApi(userToken, filter);
        if (isMounted.current) {
          setTrends(res.data.data || {kain: [], lengan: []});
          setLoadingTrends(false);
        }
      } catch (error) {
        console.log('Err Trends:', error.message);
        if (isMounted.current) setLoadingTrends(false);
      }
    },
    [userToken],
  );

  // Function Load Data
  // 1. Fetch Stok Kosong (Dipanggil oleh Modal)
  // Bungkus dengan useCallback
  const fetchEmptyStock = useCallback(
    async (search = '', branch = '') => {
      setLoadingEmptyStock(true);
      try {
        const target =
          branch || (userInfo.cabang === 'KDC' ? 'K01' : userInfo.cabang);

        // Debug log untuk memastikan tidak looping
        // console.log(`Fetching Empty Stock...`);

        const res = await getEmptyStockRegulerApi(userToken, search, target);
        if (isMounted.current) setEmptyStockList(res.data.data || []);
      } catch (error) {
        console.log('Err Empty Stock:', error);
      } finally {
        if (isMounted.current) setLoadingEmptyStock(false);
      }
    },
    [userToken, userInfo.cabang],
  );

  // Handler Buka Menu
  const handleOpenEmptyStock = () => {
    closeDrawer();
    setEmptyStockModalVisible(true);
    // Reset Filter & Load awal (Default ke K01 jika KDC)
    setEmptyStockBranchFilter(
      userInfo.cabang === 'KDC' ? 'K01' : userInfo.cabang,
    );
    fetchEmptyStock('', userInfo.cabang === 'KDC' ? 'K01' : userInfo.cabang);
  };

  // --- RENDER COMPONENTS ---

  const renderHeader = () => (
    <LinearGradient colors={['#1565C0', '#42A5F5']} style={styles.headerCard}>
      <View style={styles.headerTop}>
        <View style={{flex: 1}}>
          <Text style={styles.greetingText}>Halo, {userInfo.nama}</Text>
          <Text style={styles.subGreeting}>
            {userInfo.cabang === 'KDC' ? 'Head Office' : userInfo.cabang}
          </Text>
        </View>

        {showSidebar && (
          <TouchableOpacity
            onPress={openDrawer}
            style={[styles.headerIconBg, {marginLeft: 10}]}>
            <Icon name="menu" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.omsetContainer}>
        <Text style={styles.omsetLabel}>Omset Hari Ini</Text>
        {loadingStats ? (
          <ActivityIndicator color="#fff" style={{alignSelf: 'flex-start'}} />
        ) : (
          <CountUp
            value={todayStats.sales}
            formatter={formatRupiah}
            style={styles.omsetValue}
          />
        )}
      </View>

      <View style={styles.headerStatsRow}>
        <View style={styles.headerStatItem}>
          <Icon name="package" size={14} color="#BBDEFB" />
          <View style={{flexDirection: 'row'}}>
            <CountUp value={todayStats.qty} style={styles.headerStatValue} />
            <Text style={styles.headerStatValue}> Pcs</Text>
          </View>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.headerStatItem}>
          <Icon name="shopping-cart" size={14} color="#BBDEFB" />
          <View style={{flexDirection: 'row'}}>
            <CountUp value={todayStats.trx} style={styles.headerStatValue} />
            <Text style={styles.headerStatValue}> Transaksi</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );

  const renderPiutangSection = () => {
    if (userInfo.cabang !== 'KDC') return null;
    const isFiltered = dashboardBranchFilter !== 'ALL';
    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (isFiltered) {
              // KONDISI 1: Jika sudah difilter cabang tertentu -> Buka Detail Invoice
              handleOpenDetail({
                cabang_kode: dashboardBranchFilter,
                cabang_nama: `Cabang ${dashboardBranchFilter}`,
              });
            } else {
              // KONDISI 2: Jika 'ALL' -> Buka List Cabang dulu
              setBranchModalVisible(true);
            }
          }}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, {backgroundColor: '#FFF3E0'}]}>
                <Icon name="clock" size={20} color="#F57C00" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.cardTitle}>Total Piutang Berjalan</Text>
                <Text style={styles.cardSubtitle}>
                  {isFiltered
                    ? 'Klik untuk melihat detail invoice'
                    : 'Klik untuk melihat rincian per cabang'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="#CCC" />
            </View>
            <Text style={[styles.bigValue, {color: '#E65100', marginTop: 5}]}>
              {loadingPiutang ? (
                <ActivityIndicator size="small" color="#E65100" />
              ) : (
                <CountUp
                  value={piutang}
                  formatter={formatRupiah}
                  style={[styles.bigValue, {color: '#E65100', marginTop: 5}]}
                />
              )}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderChartAndTarget = () => {
    const percentage =
      targetSummary.target > 0
        ? (targetSummary.nominal / targetSummary.target) * 100
        : 0;
    const isOverTarget = percentage >= 100;
    const progressColor =
      percentage >= 100 ? '#4CAF50' : percentage >= 75 ? '#2196F3' : '#F44336';
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>
          Tren & Target (
          {dashboardBranchFilter === 'ALL' ? 'Semua' : dashboardBranchFilter})
        </Text>
        <View
          style={[
            styles.card,
            {padding: 0, paddingVertical: 10, minHeight: 220},
          ]}>
          {loadingChart ? (
            <ActivityIndicator
              size="large"
              color="#1976D2"
              style={{marginTop: 80}}
            />
          ) : (
            <LineChart
              key={dashboardBranchFilter}
              data={{
                labels: salesChart.labels,
                datasets: [{data: salesChart.data}],
              }}
              width={SCREEN_WIDTH - 48}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              yAxisInterval={1}
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(25, 118, 210, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                propsForDots: {r: '4', strokeWidth: '2', stroke: '#1976D2'},
              }}
              bezier
              style={{marginVertical: 8, borderRadius: 16}}
              formatYLabel={val =>
                parseInt(val) >= 1000000
                  ? (parseInt(val) / 1000000).toFixed(1) + 'jt'
                  : parseInt(val)
              }
            />
          )}
        </View>
        <View style={[styles.card, {marginTop: 16}]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, {backgroundColor: '#E3F2FD'}]}>
              <Icon name="target" size={20} color="#1976D2" />
            </View>
            <Text style={styles.cardTitle}>Pencapaian Bulan Ini</Text>
          </View>
          {loadingTarget ? (
            <ActivityIndicator size="small" color="#1976D2" />
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginBottom: 8,
                }}>
                <View>
                  <Text style={{fontSize: 12, color: '#666'}}>Realisasi</Text>
                  {/* ANIMASI REALISASI */}
                  <CountUp
                    value={targetSummary.nominal}
                    formatter={formatRupiah}
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: progressColor,
                    }}
                  />
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text style={{fontSize: 12, color: '#666'}}>Target</Text>
                  <Text
                    style={{fontSize: 14, fontWeight: '600', color: '#333'}}>
                    {formatRupiah(targetSummary.target)}
                  </Text>
                </View>
              </View>
              <AnimatedBar
                percentage={percentage}
                color={progressColor}
                height={10}
              />

              <Text
                style={{
                  textAlign: 'right',
                  fontSize: 12,
                  color: progressColor,
                  marginTop: 4,
                  fontWeight: 'bold',
                }}>
                {/* ANIMASI PERSENTASE (Opsional, atau text biasa gapapa) */}
                {percentage.toFixed(1)}% {isOverTarget && '🎉'}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderBranchRanking = () => {
    if (userInfo.cabang !== 'KDC') return null;
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Performa Cabang</Text>
        <View style={[styles.card, {minHeight: 100, justifyContent: 'center'}]}>
          {loadingBranch ? (
            <ActivityIndicator size="small" color="#1976D2" />
          ) : branchPerformance.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#999'}}>
              Belum ada data
            </Text>
          ) : (
            branchPerformance.map((branch, index) => (
              <View key={branch.kode_cabang} style={styles.rankingItem}>
                <View style={styles.rankingLeft}>
                  <View
                    style={[
                      styles.rankBadge,
                      index < 3
                        ? {
                            backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32'][
                              index
                            ],
                          }
                        : {backgroundColor: '#F5F5F5'},
                    ]}>
                    <Text
                      style={[styles.rankText, index > 2 && {color: '#666'}]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.branchName}>{branch.nama_cabang}</Text>
                    <Text style={styles.branchAch}>
                      Ach: {(branch.ach || 0).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* CONTAINER KANAN */}
                <View style={styles.rankingRight}>
                  {/* Animasi Angka */}
                  <CountUp
                    value={branch.nominal}
                    formatter={formatRupiah}
                    style={styles.branchNominal}
                  />

                  {/* FIX: Tambahkan width: '100%' agar bar muncul */}
                  <AnimatedBar
                    percentage={branch.ach || 0}
                    color={(branch.ach || 0) >= 100 ? '#4CAF50' : '#1976D2'}
                    height={4}
                    style={{marginTop: 2, width: '100%'}}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderTopProducts = () => {
    const maxQty = topProducts.length > 0 ? topProducts[0].TOTAL : 1;
    const isFiltered = dashboardBranchFilter !== 'ALL';
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>🔥 Produk Terlaris (Bulan Ini)</Text>
        <View style={styles.card}>
          {loadingTopProducts ? (
            <ActivityIndicator size="small" color="#1976D2" />
          ) : topProducts.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#999', padding: 10}}>
              Belum ada penjualan bulan ini.
            </Text>
          ) : (
            topProducts.map((item, index) => {
              const barWidth = (item.TOTAL / maxQty) * 100;
              return (
                <TouchableOpacity
                  key={`${item.KODE}-${index}`}
                  style={styles.topProductItem}
                  activeOpacity={0.7}
                  disabled={isFiltered}
                  onPress={() => handleCheckSalesDetail(item)}>
                  <View
                    style={[
                      styles.rankBadgeMini,
                      index === 0
                        ? {backgroundColor: '#FFD700'}
                        : index === 1
                        ? {backgroundColor: '#C0C0C0'}
                        : index === 2
                        ? {backgroundColor: '#CD7F32'}
                        : {backgroundColor: '#F5F5F5'},
                    ]}>
                    <Text
                      style={[
                        styles.rankTextMini,
                        index > 2 && {color: '#888'},
                      ]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={{flex: 1, marginHorizontal: 12}}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.NAMA}
                    </Text>
                    <Text style={styles.productSize}>
                      Ukuran: {item.UKURAN} • Kode: {item.KODE}
                    </Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, {width: `${barWidth}%`}]} />
                    </View>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.totalQty}>{item.TOTAL} Pcs</Text>

                    {/* 3. Tampilkan Badge 'Info' HANYA jika filter = ALL */}
                    {!isFiltered && (
                      <View
                        style={[
                          styles.checkStockBadge,
                          {backgroundColor: '#2E7D32'},
                        ]}>
                        <Icon name="bar-chart-2" size={10} color="#fff" />
                        <Text style={styles.checkStockText}>Info</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>
    );
  };

  // Helper render baris progress (FIXED KEY WARNING)
  const renderTrendBar = (items, colorBase) => {
    if (!items || items.length === 0)
      return <Text style={{fontSize: 12, color: '#999'}}>Tidak ada data.</Text>;

    const topTotal = items.reduce(
      (sum, item) => sum + Number(item.total_qty),
      0,
    );

    // FIX: Filter dulu baru Map, agar index key urut dan tidak ada null
    return items
      .filter(item => {
        const qty = Number(item.total_qty);
        const percent = topTotal > 0 ? (qty / topTotal) * 100 : 0;
        return percent >= 1; // Hanya tampilkan yg >= 1%
      })
      .map((item, index) => {
        const qty = Number(item.total_qty);
        const percent = topTotal > 0 ? (qty / topTotal) * 100 : 0;

        const isTop1 = index === 0;
        const barColor = isTop1 ? colorBase : '#BDBDBD';
        const textColor = isTop1 ? '#333' : '#666';

        // Gunakan kombinasi nama + index untuk key yang unik
        return (
          <View key={`${item.kategori}-${index}`} style={{marginBottom: 12}}>
            {/* ... (Isi View sama seperti sebelumnya) ... */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}>
              <View
                style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: isTop1 ? colorBase : '#eee',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 6,
                  }}>
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: 'bold',
                      color: isTop1 ? '#fff' : '#666',
                    }}>
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isTop1 ? 'bold' : '600',
                    color: textColor,
                  }}
                  numberOfLines={1}>
                  {item.kategori || 'LAINNYA'}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isTop1 ? 'bold' : '500',
                  color: textColor,
                }}>
                {Math.round(percent)}%{' '}
                <Text style={{fontSize: 10, fontWeight: 'normal'}}>
                  ({qty})
                </Text>
              </Text>
            </View>
            <AnimatedBar
              percentage={percent}
              color={barColor}
              height={6}
              style={{width: '100%'}}
            />
          </View>
        );
      });
  };

  const renderProductTrends = () => {
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>📊 Analisa Atribut</Text>

        <View style={{flexDirection: 'row', gap: 10}}>
          {/* KARTU KIRI: JENIS KAIN */}
          <View style={[styles.card, {flex: 1, padding: 15}]}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: '#E0F2F1',
                  width: 32,
                  height: 32,
                  marginBottom: 10,
                },
              ]}>
              <Icon name="layers" size={16} color="#00695C" />
            </View>
            <Text style={styles.trendCardTitle}>Jenis Kain</Text>
            {loadingTrends ? (
              <ActivityIndicator color="#00695C" />
            ) : (
              renderTrendBar(trends.kain, '#26A69A')
            )}
          </View>

          {/* KARTU KANAN: JENIS LENGAN */}
          <View style={[styles.card, {flex: 1, padding: 15}]}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: '#FFF3E0',
                  width: 32,
                  height: 32,
                  marginBottom: 10,
                },
              ]}>
              <Icon name="scissors" size={16} color="#EF6C00" />
            </View>
            <Text style={styles.trendCardTitle}>Tipe Lengan</Text>
            {loadingTrends ? (
              <ActivityIndicator color="#EF6C00" />
            ) : (
              renderTrendBar(trends.lengan, '#FF9800')
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderItem = useCallback(
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

  const renderNegativeStock = () => {
    // Safety check: Jika loading masih false tapi data null, anggap kosong
    const data = negativeStockList || [];

    return (
      <View style={styles.sectionContainer}>
        {/* Header Section */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
            marginLeft: 4,
          }}>
          <Icon
            name="alert-triangle"
            size={18}
            color="#D32F2F"
            style={{marginRight: 8}}
          />
          <Text style={styles.sectionTitleWithoutMargin}>
            Stok Minus (Perhatian)
          </Text>
        </View>

        <View style={[styles.card, {padding: 0}]}>
          {loadingNegativeStock ? (
            <ActivityIndicator
              size="small"
              color="#D32F2F"
              style={{margin: 20}}
            />
          ) : data.length === 0 ? (
            <View style={{padding: 20, alignItems: 'center'}}>
              <Icon name="check-circle" size={40} color="#4CAF50" />
              <Text style={{textAlign: 'center', color: '#666', marginTop: 8}}>
                Aman! Tidak ada stok minus.
              </Text>
            </View>
          ) : (
            /* Gunakan Fragment atau map langsung */
            data.map((item, index) => {
              // Tampilkan badge cabang jika filter = ALL
              const showBranchBadge = dashboardBranchFilter === 'ALL';

              return (
                <View
                  key={`${item.kode}-${item.ukuran}-${index}`}
                  style={styles.negativeItem}>
                  {/* Kiri: Info Barang */}
                  <View style={{flex: 1, marginRight: 10}}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.nama}
                    </Text>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 4,
                      }}>
                      <Text style={styles.productSize}>
                        {item.ukuran} • {item.kode}
                      </Text>

                      {/* Render Conditional yang Aman */}
                      {showBranchBadge ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginLeft: 8,
                            backgroundColor: '#EEEEEE',
                            paddingHorizontal: 6,
                            borderRadius: 4,
                          }}>
                          <Text
                            style={{
                              fontSize: 10,
                              color: '#616161',
                              fontWeight: 'bold',
                            }}>
                            {item.cabang_nama || item.cabang_kode}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Kanan: Stok Minus (Merah) */}
                  <View style={styles.negativeBadge}>
                    <Text style={styles.negativeText}>{item.stok}</Text>
                  </View>
                </View>
              );
            })
          )}

          {/* Footer Card - Gunakan pengecekan length > 0 */}
          {data.length > 0 && (
            <View style={styles.cardFooter}>
              <Text style={{fontSize: 10, color: '#999'}}>
                Segera lakukan penyesuaian stok (SO)
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      style={{flex: 1, backgroundColor: '#F5F7FA'}}
      {...(showSidebar ? panResponder.panHandlers : {})}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <ScrollView
        contentContainerStyle={{paddingBottom: 80}}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {renderHeader()}
        <View style={{marginTop: -30, paddingHorizontal: 16, zIndex: 10}}>
          {/* DROPDOWN FILTER (Hanya KDC) */}
          {userInfo.cabang === 'KDC' && (
            <View style={{alignItems: 'flex-end', marginBottom: 10}}>
              <TouchableOpacity
                style={styles.branchDropdown}
                onPress={() => {
                  // Tambahkan log untuk debug
                  console.log('Tombol Filter Diklik');
                  setBranchSelectorVisible(true);
                }}
                activeOpacity={0.8} // Tambahkan feedback visual
              >
                <Icon
                  name="map-pin"
                  size={14}
                  color="#1565C0"
                  style={{marginRight: 6}}
                />
                <Text style={styles.branchDropdownText}>
                  {dashboardBranchFilter === 'ALL'
                    ? 'Semua Cabang'
                    : dashboardBranchFilter}
                </Text>
                <Icon
                  name="chevron-down"
                  size={16}
                  color="#1565C0"
                  style={{marginLeft: 4}}
                />
              </TouchableOpacity>
            </View>
          )}

          {renderPiutangSection()}
        </View>
        {renderChartAndTarget()}
        {dashboardBranchFilter === 'ALL' && renderBranchRanking()}
        {renderProductTrends()}
        {renderTopProducts()}
        {renderNegativeStock()}
        <View style={{height: 20}} />
      </ScrollView>

      {/* --- SIDEBAR DRAWER --- */}
      {showSidebar && (
        <>
          {/* Backdrop */}
          {isDrawerOpen && (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeDrawer}>
              <Animated.View
                style={[styles.backdrop, {opacity: backdropOpacity}]}
              />
            </TouchableOpacity>
          )}

          {/* Drawer Content */}
          <Animated.View
            style={[
              styles.drawerContainer,
              {transform: [{translateX: drawerTranslateX}]},
            ]}>
            <View style={{flex: 1}}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerAvatar}>
                  <Text style={styles.avatarText}>
                    {userInfo.nama.charAt(0)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.drawerName}>{userInfo.nama}</Text>
                  <Text style={styles.drawerRole}>Manager</Text>
                </View>
              </View>

              <View style={{marginTop: 20}}>
                <Text style={styles.drawerSectionTitle}>Aplikasi</Text>

                {/* MENU OTORISASI: Hanya muncul jika canAuthorize = true (Haris/Darul) */}
                {canAuthorize && (
                  <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => {
                      closeDrawer();
                      setOtorisasiVisible(true);
                      fetchPendingAuth(); // [NEW] Fetch data when opening
                    }}>
                    <Icon
                      name="check-circle" // Changed icon to match 'Approval'
                      size={20}
                      color="#546E7A"
                      style={{marginRight: 15}}
                    />
                    <Text style={styles.drawerItemText}>
                      Otorisasi (Approval)
                    </Text>
                  </TouchableOpacity>
                )}

                {/* MENU LAIN: Muncul untuk semua yang punya akses sidebar (termasuk Estu) */}
                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => {
                    closeDrawer();
                    setEmptyStockModalVisible(true);
                  }}>
                  <Icon
                    name="alert-octagon"
                    size={20}
                    color="#546E7A"
                    style={{marginRight: 15}}
                  />
                  <Text style={styles.drawerItemText}>Laporan Stok Kosong</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.drawerFooter}>
              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Icon
                  name="log-out"
                  size={20}
                  color="#D32F2F"
                  style={{marginRight: 10}}
                />
                <Text style={[styles.drawerItemText, {color: '#D32F2F'}]}>
                  Keluar
                </Text>
              </TouchableOpacity>
              <Text style={styles.versionText}>Versi {appVersion}</Text>
            </View>
          </Animated.View>
        </>
      )}

      <BranchSelectorModal
        visible={branchSelectorVisible}
        onClose={() => setBranchSelectorVisible(false)}
        branches={branchList}
        selected={dashboardBranchFilter}
        onSelect={handleFilterChange}
      />

      {/* --- MODAL OTORISASI (Hanya dirender jika punya akses, untuk keamanan extra) --- */}
      {canAuthorize && (
        <Modal
          visible={otorisasiVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setOtorisasiVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {height: '80%'}]}>
              {/* Taller modal */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Daftar Persetujuan</Text>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  {/* Refresh Button */}
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
                  renderItem={renderItem}
                  // [OPTIMASI FLATLIST WAJIB]
                  initialNumToRender={5} // Render 5 item pertama saja agar cepat muncul
                  windowSize={5} // Kurangi memori window render (default 21)
                  maxToRenderPerBatch={5} // Batasi render per batch
                  removeClippedSubviews={true} // Hapus view yang tidak terlihat dari memori (Android)
                  updateCellsBatchingPeriod={50}
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
      )}

      {/* --- MODAL PIUTANG LIST & DETAIL (TETAP SAMA) --- */}
      <Modal
        visible={branchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBranchModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Piutang Per Cabang</Text>
              <TouchableOpacity onPress={() => setBranchModalVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {loadingPiutangList ? (
              <ActivityIndicator
                size="large"
                color="#1976D2"
                style={{marginTop: 20}}
              />
            ) : (
              <FlatList
                data={piutangList}
                keyExtractor={item => item.cabang_kode}
                contentContainerStyle={{padding: 16}}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.piutangItem}
                    onPress={() => handleOpenDetail(item)}>
                    <View>
                      <Text style={styles.piutangCabangName}>
                        {item.cabang_nama}
                      </Text>
                      <Text style={styles.piutangCabangCode}>
                        {item.cabang_kode}
                      </Text>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={styles.piutangAmount}>
                        {formatRupiah(item.sisa_piutang)}
                      </Text>
                      <Text style={styles.detailLink}>Lihat Detail</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Invoice: {selectedBranch?.nama}
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {loadingDetail ? (
              <ActivityIndicator
                size="large"
                color="#1976D2"
                style={{marginTop: 20}}
              />
            ) : (
              <FlatList
                data={detailInvoices}
                keyExtractor={(item, index) => `${item.invoice}-${index}`}
                contentContainerStyle={{padding: 16}}
                renderItem={({item}) => (
                  <View style={styles.invoiceItem}>
                    {/* Bagian Kiri: Info Customer & Invoice */}
                    <View style={{flex: 1, marginRight: 10}}>
                      {/* TAMPILKAN NAMA CUSTOMER */}
                      <Text style={styles.customerName} numberOfLines={1}>
                        {item.nama_customer}
                      </Text>

                      <View
                        style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={styles.invoiceNo}>{item.invoice}</Text>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.invoiceDate}>{item.tanggal}</Text>
                      </View>
                    </View>

                    {/* Bagian Kanan: Nominal */}
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={styles.invoiceLabel}>Sisa:</Text>
                      <Text style={styles.invoiceAmount}>
                        {formatRupiah(item.sisa_piutang)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* --- MODAL RINCIAN PENJUALAN (DULU CEK STOK) --- */}
      <Modal
        visible={stockModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStockModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, {height: 'auto', maxHeight: '60%'}]}>
            <View style={styles.modalHeader}>
              <View style={{flex: 1}}>
                {/* JUDUL DINAMIS */}
                <Text style={styles.modalTitle}>
                  {modalType === 'SALES'
                    ? 'Rincian Penjualan Cabang'
                    : 'Sebaran Stok Real'}
                </Text>
                <Text style={{fontSize: 12, color: '#666', marginTop: 2}}>
                  {selectedProductItem?.NAMA ||
                    selectedProductItem?.nama_barang}{' '}
                  ({selectedProductItem?.UKURAN || selectedProductItem?.ukuran})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setStockModalVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingStockSpread ? (
              <ActivityIndicator
                size="large"
                color={modalType === 'SALES' ? '#2E7D32' : '#1976D2'} // Warna Spinner Dinamis
                style={{margin: 30}}
              />
            ) : (
              <ScrollView contentContainerStyle={{padding: 20}}>
                {stockSpreadList.length === 0 ? (
                  <View style={{alignItems: 'center', padding: 20}}>
                    <Icon name="info" size={40} color="#ccc" />
                    <Text style={{color: '#888', marginTop: 10}}>
                      {modalType === 'SALES'
                        ? 'Belum ada data penjualan.'
                        : 'Stok kosong di semua cabang.'}
                    </Text>
                  </View>
                ) : (
                  stockSpreadList.map((stok, i) => (
                    <View key={i} style={styles.stockRow}>
                      <View
                        style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Icon
                          name="map-pin"
                          size={14}
                          color={modalType === 'SALES' ? '#2E7D32' : '#1976D2'}
                          style={{marginRight: 8}}
                        />
                        <Text style={styles.stockBranchName}>
                          {stok.nama_cabang || stok.cabang}
                        </Text>
                      </View>

                      {/* BADGE DINAMIS (HIJAU UNTUK SALES, BIRU UNTUK STOK) */}
                      <View
                        style={{
                          backgroundColor:
                            modalType === 'SALES' ? '#E8F5E9' : '#E3F2FD',
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 6,
                          minWidth: 60,
                          alignItems: 'center',
                        }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: 'bold',
                            color:
                              modalType === 'SALES' ? '#2E7D32' : '#1565C0',
                          }}>
                          {stok.qty} {modalType === 'SALES' ? '' : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <View
              style={{
                padding: 15,
                borderTopWidth: 1,
                borderColor: '#eee',
                alignItems: 'center',
              }}>
              <Text style={{fontSize: 10, color: '#999'}}>
                {modalType === 'SALES'
                  ? 'Total qty terjual bulan ini per cabang'
                  : 'Sisa stok fisik di masing-masing cabang'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gunakan Component EmptyStockModal yang sudah dipisah */}
      <EmptyStockModal
        visible={emptyStockModalVisible}
        onClose={() => setEmptyStockModalVisible(false)}
        branchList={branchList}
        userBranch={userInfo.cabang}
        onFetchData={fetchEmptyStock}
        dataList={emptyStockList}
        loading={loadingEmptyStock}
        // GANTI DARI handleCheckSalesDetail KE handleCheckRealStock
        onItemPress={handleCheckRealStock}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // --- STYLES DRAWER BARU ---
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 999,
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#fff',
    zIndex: 1000,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 2, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 10,
    paddingTop: 50, // Status bar
    paddingHorizontal: 20,
  },
  drawerHeader: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  drawerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1565C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  drawerName: {fontSize: 18, fontWeight: 'bold', color: '#37474F'},
  drawerRole: {fontSize: 12, color: '#90A4AE'},

  drawerSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B0BEC5',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  drawerItem: {flexDirection: 'row', alignItems: 'center', paddingVertical: 15},
  drawerItemText: {fontSize: 16, color: '#455A64', fontWeight: '500'},

  drawerFooter: {
    marginBottom: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  versionText: {
    fontSize: 11,
    color: '#CFD8DC',
    textAlign: 'center',
    marginTop: 10,
  },
  drawerTitle: {fontSize: 22, fontWeight: 'bold', color: '#1565C0'},
  edgeSwipeArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 30, // Area sentuh di pinggir kiri
    zIndex: 900,
  },

  // --- STYLES EXISTING ---
  headerCard: {
    paddingTop: 60,
    padding: 20,
    paddingBottom: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  greetingText: {color: '#fff', fontSize: 20, fontWeight: '700'},
  subGreeting: {color: '#BBDEFB', fontSize: 13, marginTop: 2},
  headerIconBg: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 12,
  },
  omsetContainer: {marginBottom: 20},
  omsetLabel: {
    color: '#E3F2FD',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  omsetValue: {color: '#fff', fontSize: 32, fontWeight: '700'},
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  headerStatItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  headerStatValue: {color: '#fff', fontWeight: '600', fontSize: 12},
  verticalDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
  },
  sectionContainer: {marginTop: 16, paddingHorizontal: 4},
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 4},
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  iconBox: {padding: 8, borderRadius: 8, marginRight: 12},
  cardTitle: {fontSize: 14, color: '#666', fontWeight: '600'},
  bigValue: {fontSize: 24, fontWeight: 'bold', marginBottom: 4},
  cardSubtitle: {fontSize: 12, color: '#999'},
  piutangItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  piutangCabangName: {fontSize: 14, fontWeight: '600', color: '#333'},
  piutangCabangCode: {fontSize: 11, color: '#999'},
  piutangAmount: {fontSize: 14, fontWeight: 'bold', color: '#E65100'},
  detailLink: {fontSize: 11, color: '#1976D2', fontWeight: '600'},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
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
  invoiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  // STYLE BARU: Nama Customer
  customerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textTransform: 'capitalize',
  },

  invoiceNo: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2', // Biru agar terlihat seperti kode
  },

  dotSeparator: {
    marginHorizontal: 5,
    color: '#CCC',
    fontSize: 10,
  },

  invoiceDate: {
    fontSize: 12,
    color: '#888',
  },

  invoiceLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },

  invoiceAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100', // Warna Oranye/Merah Bata untuk Piutang
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rankingLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {fontSize: 12, fontWeight: 'bold', color: '#fff'},
  branchName: {fontSize: 14, fontWeight: '600', color: '#333'},
  branchAch: {fontSize: 11, color: '#666'},
  rankingRight: {alignItems: 'flex-end', width: 100},
  branchNominal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
  },
  progressBarFill: {height: '100%', borderRadius: 2},
  label: {fontSize: 14, color: '#555', marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  btnPrimary: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F2F5',
    padding: 15,
    borderRadius: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  resultText: {fontSize: 20, fontWeight: 'bold', color: '#333'},
  // --- STYLES TOP PRODUCTS ---
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  rankBadgeMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankTextMini: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  productSize: {
    fontSize: 11,
    color: '#888',
    marginBottom: 6,
  },
  barTrack: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FF7043', // Warna oranye cerah
    borderRadius: 3,
  },
  totalQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  checkStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  checkStockText: {
    fontSize: 9,
    color: '#fff',
    marginLeft: 3,
    fontWeight: 'bold',
  },

  // --- STYLES MODAL STOK ---
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stockBranchName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  stockValueBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockValueText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1565C0',
  },

  trendCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },

  // --- STYLES STOK KOSONG ---
  emptyItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFEBEE', // Merah muda tipis
  },
  stokHabisBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 2,
  },
  stokHabisText: {
    color: '#D32F2F',
    fontWeight: 'bold',
    fontSize: 10,
  },

  // --- STYLES BARU UNTUK OTORISASI ---
  authItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10, // Jarak antar item di dalam accordion
    borderWidth: 1,
    borderColor: '#EEEEEE',
    elevation: 1, // Shadow lebih tipis
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
    // fontStyle: 'italic', // Hapus italic biar lebih jelas
    lineHeight: 18, // Biar enter (\n) terbaca enak
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
  btnAuthText: {
    fontSize: 13,
    fontWeight: 'bold',
    // Remove the color function
  },
  btnRejectText: {
    color: '#D32F2F',
    // You can inherit font styles or repeat them if needed
    fontSize: 13,
    fontWeight: 'bold',
  },
  btnApproveText: {
    color: '#fff',
    // You can inherit font styles or repeat them if needed
    fontSize: 13,
    fontWeight: 'bold',
  },

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

  // Styles untuk Accordion Cabang
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
    backgroundColor: '#E3F2FD', // Warna biru muda saat aktif
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
  infoBox: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#1976D2',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', // Transparan putih
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  filterChipActive: {
    backgroundColor: '#fff', // Putih solid saat aktif
    borderColor: '#fff',
  },
  filterChipText: {
    color: '#E3F2FD',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#1565C0', // Biru saat aktif
    fontWeight: 'bold',
  },
  branchDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16, // Lebih lebar dikit
    paddingVertical: 10,
    borderRadius: 25, // Lebih bulat
    // Shadow agar menonjol dari background
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  branchDropdownText: {
    color: '#1565C0',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // STYLE BARU: BOTTOM SHEET MODAL
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 20,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 10,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  branchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  branchOptionActive: {
    backgroundColor: '#1565C0',
  },
  branchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  branchOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  branchOptionTextActive: {
    color: '#fff',
  },
  branchOptionSub: {
    fontSize: 11,
    color: '#888',
  },
  sectionTitleWithoutMargin: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F', // Merah Warning
  },
  negativeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  negativeBadge: {
    backgroundColor: '#FFEBEE', // Merah muda background
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  negativeText: {
    color: '#D32F2F', // Teks Merah
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardFooter: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    alignItems: 'center',
  },
});

export default ManagementDashboardScreen;
