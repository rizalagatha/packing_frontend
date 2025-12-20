import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
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
  TextInput,
  Share,
  Alert,
  Animated, // Import Animated
  PanResponder, // Import PanResponder untuk Swipe
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import {LineChart} from 'react-native-chart-kit';
import {AuthContext} from '../context/AuthContext';

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
  getDashboardTrendsApi,
  getEmptyStockRegulerApi,
  getCabangListApi,
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

const ManagementDashboardScreen = ({navigation}) => {
  const {userInfo, userToken} = useContext(AuthContext);
  const [refreshing, setRefreshing] = useState(false);

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

  // --- STATE KHUSUS HARIS (OTORISASI) ---
  const [otorisasiVisible, setOtorisasiVisible] = useState(false);
  const [otoKode, setOtoKode] = useState('');
  const [otoResult, setOtoResult] = useState('');

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

  // State untuk menyimpan daftar cabang dari database
  const [branchList, setBranchList] = useState([]);

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
      // Tentukan kapan gesture handler aktif
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const {dx, moveX} = gestureState;
        // Aktif jika:
        // 1. Menu tertutup TAPI swipe dari pinggir kiri (edge swipe < 40px) ke kanan
        // 2. Menu terbuka DAN swipe ke kiri
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
      headerLeft: isHaris
        ? () => (
            <TouchableOpacity onPress={openDrawer} style={{marginLeft: 15}}>
              <Icon name="menu" size={24} color="#333" />
            </TouchableOpacity>
          )
        : undefined,
      headerTitle: 'Dashboard',
      headerTitleAlign: 'center',
    });
  }, [navigation, isHaris, openDrawer]);

  // --- FETCH FUNCTIONS ---
  const fetchTodayStats = useCallback(async () => {
    try {
      const res = await getDashboardTodayStatsApi(userToken);
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
  }, [userToken]);

  const fetchPiutang = useCallback(async () => {
    try {
      const res = await getDashboardPiutangApi(userToken);
      if (isMounted.current) {
        setPiutang(res.data.totalSisaPiutang || 0);
        setLoadingPiutang(false);
      }
    } catch (error) {
      console.log('Err Piutang:', error.message);
      if (isMounted.current) setLoadingPiutang(false);
    }
  }, [userToken]);

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

  const fetchChart = useCallback(async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const res = await getDashboardSalesChartApi(
        {startDate, endDate, groupBy: 'day', cabang: 'ALL'},
        userToken,
      );
      if (isMounted.current && res.data?.length > 0) {
        setSalesChart({
          labels: res.data.map(d => {
            const date = new Date(d.tanggal);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          }),
          data: res.data.map(d => d.total),
        });
        setLoadingChart(false);
      }
    } catch (error) {
      console.log('Err Chart:', error.message);
      if (isMounted.current) setLoadingChart(false);
    }
  }, [userToken]);

  const fetchTargetSummary = useCallback(async () => {
    try {
      const res = await getDashboardTargetSummaryApi(userToken);
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
  }, [userToken]);

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
      console.log('DATA CABANG DARI BACKEND:', res.data.data); // <--- CEK LOG INI

      if (isMounted.current) {
        setBranchList(res.data.data || []);
      }
    } catch (e) {
      console.log('Gagal load cabang', e);
    }
  }, [userToken]);

  const loadAllData = useCallback(() => {
    setLoadingStats(true);
    setLoadingPiutang(true);
    setLoadingChart(true);
    setLoadingTarget(true);
    setLoadingBranch(true);
    setLoadingPiutangList(true);
    setLoadingTopProducts(true);
    setLoadingTrends(true);

    fetchTodayStats();
    fetchPiutang();
    fetchChart();
    fetchTopProducts();
    fetchTargetSummary();
    fetchTrends();
    if (userInfo.cabang === 'KDC') {
      fetchBranchPerformance();
      fetchPiutangList();
      fetchBranches();
    }
  }, [
    fetchTodayStats,
    fetchPiutang,
    fetchChart,
    fetchTargetSummary,
    fetchBranchPerformance,
    fetchPiutangList,
    fetchTopProducts,
    fetchTrends,
    userInfo.cabang,
    fetchBranches,
  ]);

  useEffect(() => {
    if (userToken) {
      loadAllData();
    }
  }, [userToken, loadAllData]);

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

  // --- LOGIC OTORISASI ---
  const handleGenerateOtorisasi = () => {
    if (!otoKode) return;
    const nKode = parseFloat(otoKode);
    if (isNaN(nKode)) {
      Alert.alert('Error', 'Kode harus berupa angka');
      return;
    }
    const result = nKode * 21 + 53 * 4;
    setOtoResult(`${result}H`);
  };

  const handleShareOtorisasi = async () => {
    if (!otoResult) return;
    try {
      await Share.share({message: otoResult});
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Fetch Top Products
  const fetchTopProducts = useCallback(async () => {
    try {
      // Jika user KDC dan mau filter cabang tertentu, bisa dioper di parameter ke-2
      const res = await getDashboardTopSellingApi(userToken, 'ALL');
      if (isMounted.current) {
        setTopProducts(res.data.data || []);
        setLoadingTopProducts(false);
      }
    } catch (error) {
      console.log('Err Top Products:', error.message);
      if (isMounted.current) setLoadingTopProducts(false);
    }
  }, [userToken]);

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

  // Function Fetch
  const fetchTrends = useCallback(async () => {
    try {
      const res = await getDashboardTrendsApi(userToken, 'ALL');
      if (isMounted.current) {
        setTrends(res.data.data || {kain: [], lengan: []});
        setLoadingTrends(false);
      }
    } catch (error) {
      console.log('Err Trends:', error.message);
      if (isMounted.current) setLoadingTrends(false);
    }
  }, [userToken]);

  // Function Load Data
  const fetchEmptyStock = async (search = '', branch = '') => {
    setLoadingEmptyStock(true);
    try {
      // Gunakan branch filter jika ada, atau default user branch
      const target =
        branch || (userInfo.cabang === 'KDC' ? 'K01' : userInfo.cabang);

      const res = await getEmptyStockRegulerApi(userToken, search, target);
      if (isMounted.current) {
        setEmptyStockList(res.data.data || []);
      }
    } catch (error) {
      console.log('Err Empty Stock:', error.message);
    } finally {
      if (isMounted.current) setLoadingEmptyStock(false);
    }
  };

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
    <LinearGradient colors={['#1976D2', '#1565C0']} style={styles.headerCard}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.greetingText}>Halo, {userInfo.nama}</Text>
          <Text style={styles.subGreeting}>
            {userInfo.cabang === 'KDC' ? 'Head Office' : userInfo.cabang}
          </Text>
        </View>
        <View style={styles.headerIconBg}>
          <Icon name="bar-chart-2" size={24} color="#fff" />
        </View>
      </View>
      <View style={styles.omsetContainer}>
        <Text style={styles.omsetLabel}>Omset Hari Ini</Text>
        {loadingStats ? (
          <ActivityIndicator color="#fff" style={{alignSelf: 'flex-start'}} />
        ) : (
          /* GANTI TEXT BIASA DENGAN COUNTUP */
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
          {loadingStats ? (
            <Text style={styles.headerStatValue}>...</Text>
          ) : (
            /* ANIMASI QTY (tanpa format rupiah, cuma angka) */
            <View style={{flexDirection: 'row'}}>
              <CountUp value={todayStats.qty} style={styles.headerStatValue} />
              <Text style={styles.headerStatValue}> Pcs</Text>
            </View>
          )}
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.headerStatItem}>
          <Icon name="shopping-cart" size={14} color="#BBDEFB" />
          {loadingStats ? (
            <Text style={styles.headerStatValue}>...</Text>
          ) : (
            /* ANIMASI TRANSAKSI */
            <View style={{flexDirection: 'row'}}>
              <CountUp value={todayStats.trx} style={styles.headerStatValue} />
              <Text style={styles.headerStatValue}> Transaksi</Text>
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );

  const renderPiutangSection = () => {
    if (userInfo.cabang !== 'KDC') return null;
    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setBranchModalVisible(true)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, {backgroundColor: '#FFF3E0'}]}>
                <Icon name="clock" size={20} color="#F57C00" />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.cardTitle}>Total Piutang Berjalan</Text>
                <Text style={styles.cardSubtitle}>
                  Klik untuk melihat rincian per cabang
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
        <Text style={styles.sectionTitle}>Tren & Target</Text>
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
    // Cari nilai tertinggi untuk referensi lebar bar (100%)
    const maxQty = topProducts.length > 0 ? topProducts[0].TOTAL : 1;

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
              // Hitung persentase lebar bar
              const barWidth = (item.TOTAL / maxQty) * 100;

              return (
                <TouchableOpacity
                  key={`${item.KODE}-${index}`}
                  style={styles.topProductItem}
                  activeOpacity={0.7}
                  onPress={() => handleCheckStock(item)} // KLIK DISINI
                >
                  {/* 1. Ranking Badge */}
                  <View
                    style={[
                      styles.rankBadgeMini,
                      index === 0
                        ? {backgroundColor: '#FFD700'} // Emas
                        : index === 1
                        ? {backgroundColor: '#C0C0C0'} // Perak
                        : index === 2
                        ? {backgroundColor: '#CD7F32'} // Perunggu
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

                  {/* 2. Info Barang */}
                  <View style={{flex: 1, marginHorizontal: 12}}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.NAMA}
                    </Text>
                    <Text style={styles.productSize}>
                      Ukuran: {item.UKURAN} • Kode: {item.KODE}
                    </Text>

                    {/* Visual Bar */}
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, {width: `${barWidth}%`}]} />
                    </View>
                  </View>

                  {/* 3. Total & Action */}
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={styles.totalQty}>{item.TOTAL} Pcs</Text>
                    <View style={styles.checkStockBadge}>
                      <Icon name="search" size={10} color="#fff" />
                      <Text style={styles.checkStockText}>Stok</Text>
                    </View>
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

  return (
    <View
      style={{flex: 1, backgroundColor: '#F5F7FA'}}
      {...(isHaris ? panResponder.panHandlers : {})}>
      <StatusBar barStyle="light-content" backgroundColor="#1565C0" />
      <ScrollView
        contentContainerStyle={{paddingBottom: 80}}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {renderHeader()}
        <View style={{marginTop: -30, paddingHorizontal: 16}}>
          {renderPiutangSection()}
        </View>
        {renderChartAndTarget()}
        {renderBranchRanking()}

        {/* Insight Atribut dulu */}
        {renderProductTrends()}

        {/* Baru Detail Top Produk */}
        {renderTopProducts()}
      </ScrollView>

      {/* --- SIDE MENU DRAWER (CUSTOM ANIMATED VIEW) --- */}
      {isHaris && (
        <>
          {/* Backdrop (Dark Overlay) */}
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
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menu Manajemen</Text>
            </View>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                closeDrawer();
                setTimeout(() => setOtorisasiVisible(true), 300);
              }}>
              <Icon
                name="key"
                size={20}
                color="#1976D2"
                style={{marginRight: 15}}
              />
              <Text style={styles.drawerItemText}>Otorisasi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={handleOpenEmptyStock} // <--- Action Baru
            >
              <Icon
                name="alert-octagon"
                size={20}
                color="#D32F2F"
                style={{marginRight: 15}}
              />
              <Text style={styles.drawerItemText}>Laporan Stok Kosong</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Edge Swipe Detector (Invisible View at Left Edge) */}
          {!isDrawerOpen && (
            <View
              style={styles.edgeSwipeArea}
              // Kita bisa attach panResponder di sini jika ingin spesifik,
              // tapi kita sudah attach di parent View utama.
            />
          )}
        </>
      )}

      {/* --- MODAL OTORISASI --- */}
      <Modal
        visible={otorisasiVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOtorisasiVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: 'auto', minHeight: 320}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Otorisasi</Text>
              <TouchableOpacity onPress={() => setOtorisasiVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{padding: 20}}>
              <Text style={styles.label}>Kode Input:</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan Kode Angka"
                keyboardType="numeric"
                value={otoKode}
                onChangeText={setOtoKode}
              />

              <TouchableOpacity
                style={[styles.btnPrimary, {marginTop: 15}]}
                onPress={handleGenerateOtorisasi}>
                <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>
                  GENERATE
                </Text>
              </TouchableOpacity>

              <View style={{marginTop: 25}}>
                <Text style={styles.label}>Hasil Otorisasi:</Text>
                <View style={styles.resultBox}>
                  <Text style={styles.resultText}>{otoResult || '...'}</Text>
                  {otoResult !== '' && (
                    <TouchableOpacity onPress={handleShareOtorisasi}>
                      <Icon name="share-2" size={24} color="#1976D2" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
                keyExtractor={(item, i) => item.invoice + i}
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

      {/* --- MODAL CEK STOK (INTERAKTIF) --- */}
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
                <Text style={styles.modalTitle}>Sebaran Stok</Text>
                <Text style={{fontSize: 12, color: '#666', marginTop: 2}}>
                  {selectedProductItem?.NAMA} ({selectedProductItem?.UKURAN})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setStockModalVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingStockSpread ? (
              <ActivityIndicator
                size="large"
                color="#1976D2"
                style={{margin: 30}}
              />
            ) : (
              <ScrollView contentContainerStyle={{padding: 20}}>
                {stockSpreadList.length === 0 ? (
                  <View style={{alignItems: 'center', padding: 20}}>
                    <Icon name="alert-circle" size={40} color="#ccc" />
                    <Text style={{color: '#888', marginTop: 10}}>
                      Stok habis di semua cabang (Master Stok).
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
                          color="#1976D2"
                          style={{marginRight: 8}}
                        />
                        <Text style={styles.stockBranchName}>
                          {stok.nama_cabang || stok.cabang}
                        </Text>
                      </View>
                      <View style={styles.stockValueBadge}>
                        <Text style={styles.stockValueText}>{stok.qty}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {/* Footer Modal */}
            <View
              style={{
                padding: 15,
                borderTopWidth: 1,
                borderColor: '#eee',
                alignItems: 'center',
              }}>
              <Text style={{fontSize: 10, color: '#999'}}>
                Data berdasarkan TMasterStok
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODAL LAPORAN STOK KOSONG --- */}
      <Modal
        visible={emptyStockModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEmptyStockModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stok Kosong (Reguler)</Text>
              <TouchableOpacity
                onPress={() => setEmptyStockModalVisible(false)}>
                <Icon name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Filter & Search Section */}
            <View style={{paddingHorizontal: 16, paddingBottom: 10}}>
              {/* 1. Branch Selector (Khusus KDC) */}
              {/* FIX: Hapus pengecekan ganda yang berlebihan */}
              {userInfo.cabang === 'KDC' && (
                <View style={{marginBottom: 12, height: 45}}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      alignItems: 'center',
                      paddingRight: 16,
                    }}>
                    {branchList.map((cab, index) => {
                      // Safety Check: Pastikan kode tidak null/undefined
                      // Cek response backend Anda, mungkin namanya 'kode' bukan 'gdg_kode'?
                      const kodeCabang =
                        cab.gdg_kode || cab.kode || cab.cabang_kode || '?';
                      const isSelected = emptyStockBranchFilter === kodeCabang;

                      return (
                        <TouchableOpacity
                          key={index}
                          onPress={() => {
                            setEmptyStockBranchFilter(kodeCabang);
                            fetchEmptyStock(emptyStockSearch, kodeCabang);
                          }}
                          style={{
                            // Logic Warna: Biru jika aktif, Putih jika tidak
                            backgroundColor: isSelected ? '#1976D2' : '#FFFFFF',
                            // Border: Biar yang putih tidak 'tenggelam'
                            borderWidth: 1,
                            borderColor: isSelected ? '#1976D2' : '#E0E0E0',
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 20, // Capsule shape
                            marginRight: 8,
                            minWidth: 60, // Agar tidak jadi bulatan kecil
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: isSelected ? 2 : 0, // Sedikit bayangan
                          }}>
                          <Text
                            style={{
                              color: isSelected ? '#FFFFFF' : '#555555',
                              fontWeight: '600',
                              fontSize: 13,
                            }}>
                            {kodeCabang}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 2. Search Bar */}
              <View style={styles.searchRow}>
                <Icon
                  name="search"
                  size={18}
                  color="#888"
                  style={{marginLeft: 10}}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari Barang..."
                  value={emptyStockSearch}
                  onChangeText={text => {
                    setEmptyStockSearch(text);
                    // Debounce manual: panggil fetch setelah user berhenti mengetik (opsional)
                  }}
                  onSubmitEditing={() =>
                    fetchEmptyStock(emptyStockSearch, emptyStockBranchFilter)
                  }
                />
                <TouchableOpacity
                  onPress={() =>
                    fetchEmptyStock(emptyStockSearch, emptyStockBranchFilter)
                  }>
                  <Icon
                    name="arrow-right"
                    size={20}
                    color="#1976D2"
                    style={{marginRight: 10}}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* List Data */}
            {loadingEmptyStock ? (
              <ActivityIndicator
                size="large"
                color="#D32F2F"
                style={{marginTop: 20}}
              />
            ) : (
              <FlatList
                data={emptyStockList}
                keyExtractor={item => item.kode + item.ukuran}
                contentContainerStyle={{padding: 16}}
                ListEmptyComponent={
                  <Text
                    style={{textAlign: 'center', marginTop: 20, color: '#999'}}>
                    Aman! Tidak ada stok kosong di cabang ini.
                  </Text>
                }
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.emptyItemRow}
                    // RE-USE FITUR SEBARAN STOK:
                    // Kalau diklik, cek stok di cabang lain
                    onPress={() => {
                      // Kita manipulasi objek agar sesuai dengan format handleCheckStock
                      handleCheckStock({
                        KODE: item.kode,
                        UKURAN: item.ukuran,
                        NAMA: item.nama_barang,
                      });
                    }}>
                    <View style={{flex: 1}}>
                      <Text style={styles.productName}>{item.nama_barang}</Text>
                      <Text style={styles.productSize}>
                        {item.ukuran} • {item.kode}
                      </Text>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                      <View style={styles.stokHabisBadge}>
                        <Text style={styles.stokHabisText}>
                          KOSONG ({item.stok_akhir})
                        </Text>
                      </View>
                      <Text style={styles.tapHint}>Cek Cabang Lain</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
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
  drawerTitle: {fontSize: 22, fontWeight: 'bold', color: '#1565C0'},
  drawerItem: {flexDirection: 'row', alignItems: 'center', paddingVertical: 15},
  drawerItemText: {fontSize: 16, color: '#333', fontWeight: '500'},
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
  greetingText: {color: '#fff', fontSize: 18, fontWeight: '600'},
  subGreeting: {color: '#BBDEFB', fontSize: 12},
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
    backgroundColor: 'rgba(0,0,0,0.1)',
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
});

export default ManagementDashboardScreen;
