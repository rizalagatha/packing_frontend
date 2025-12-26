import React, {useContext, useLayoutEffect, useMemo, useRef} from 'react';
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
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Feather';
import LinearGradient from 'react-native-linear-gradient';
import ManagementDashboardScreen from './ManagementDashboardScreen';

const {width} = Dimensions.get('window');

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
  const {logout, userInfo} = useContext(AuthContext);

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
      desc: 'Daftar packing',
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
      desc: 'Cek barang',
      iconName: 'check-square',
      iconColor: '#388E3C',
      bgColor: '#E8F5E9',
      onPress: () => navigation.navigate('Checker'),
      allowed: ['P04', 'KDC', 'KBS'].includes(userInfo?.cabang),
    },
    // TOKO
    {
      group: 'Toko',
      title: 'Stok Menipis',
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
      desc: 'Kembalikan barang',
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
      title: 'Riwayat SJ',
      desc: 'Arsip Surat Jalan',
      iconName: 'archive',
      iconColor: '#455A64',
      bgColor: '#ECEFF1',
      onPress: () => navigation.navigate('RiwayatSuratJalan'),
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
      allowed: userInfo?.kode === 'RIO' && userInfo?.cabang === 'KDC',
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
});

export default DashboardScreen;
