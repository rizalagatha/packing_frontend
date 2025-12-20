import React, {useContext, useLayoutEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import Icon from 'react-native-vector-icons/Feather';

// 1. IMPORT SCREEN MANAGEMENT
// Pastikan path ini sesuai dengan struktur folder kamu
import ManagementDashboardScreen from './ManagementDashboardScreen';

const DashboardScreen = ({navigation}) => {
  const {logout, userInfo} = useContext(AuthContext);

  // --- LOGIKA USER KHUSUS (DARUL, HARIS, ESTU @ KDC) ---
  // --- LOGIKA USER KHUSUS (DARUL, HARIS, ESTU @ KDC) ---
  const isSpecialUser = React.useMemo(() => {
    // 1. Pastikan userInfo ada
    if (!userInfo || !userInfo.nama || !userInfo.cabang) return false;

    // 2. Debugging (Lihat di terminal Metro Bundler apa isi userInfo sebenarnya)
    // console.log('DEBUG USER:', userInfo.nama, userInfo.cabang);

    const userBranch = userInfo.cabang;
    const userName = userInfo.nama.toUpperCase(); // Ubah ke huruf besar semua

    // 3. Cek Cabang
    if (userBranch !== 'KDC') return false;

    // 4. Cek Nama (Gunakan INCLUDES agar 'M. HARIS' atau 'HARIS K' tetap terdeteksi)
    const allowedNames = ['DARUL', 'HARIS', 'ESTU'];

    // Cek apakah salah satu nama yang diperbolehkan ADA di dalam userName
    return allowedNames.some(name => userName.includes(name));
  }, [userInfo]);

  useLayoutEffect(() => {
    navigation.setOptions({
      // Opsional: Jika tampilan Management sudah punya header sendiri yang bagus,
      // kamu bisa menyembunyikan header default navigasi dengan: headerShown: !isSpecialUser,
      // Tapi pastikan tombol Logout dipindahkan ke dalam ManagementDashboardScreen jika header disembunyikan.

      headerRight: () => (
        <TouchableOpacity onPress={logout} style={{marginRight: 15}}>
          <Icon name="log-out" size={24} color="#D32F2F" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout, isSpecialUser]);

  // --- 2. JIKA USER KHUSUS, TAMPILKAN MANAGEMENT DASHBOARD ---
  if (isSpecialUser) {
    return <ManagementDashboardScreen navigation={navigation} />;
  }

  // --- 3. JIKA USER BIASA, TAMPILKAN MENU GRID (KODE LAMA) ---

  // Definisikan menu user biasa
  const allMenus = [
    {
      title: 'Packing',
      iconName: 'box',
      onPress: () => navigation.navigate('Packing'),
      allowed: userInfo?.cabang === 'P04',
    },
    {
      title: 'Riwayat Packing',
      iconName: 'list',
      onPress: () => navigation.navigate('PackingHistory'),
      allowed: userInfo?.cabang === 'P04',
    },
    {
      title: 'Checker',
      iconName: 'check-square',
      onPress: () => navigation.navigate('Checker'),
      allowed:
        userInfo?.cabang === 'P04' ||
        userInfo?.cabang === 'KDC' ||
        userInfo?.cabang === 'KBS',
    },
    // {
    //   title: 'Surat Jalan',
    //   iconName: 'truck',
    //   onPress: () => navigation.navigate('SuratJalan'),
    //   allowed: userInfo?.cabang === 'KDC' || userInfo?.cabang === 'KBS',
    // },
    {
      title: 'Packing List', // Ganti judul
      iconName: 'package', // Ganti icon jika perlu (misal: package / truck)
      onPress: () => navigation.navigate('PackingList'), // Pastikan nama route di App.js disesuaikan
      allowed: userInfo?.cabang === 'KDC' || userInfo?.cabang === 'KBS',
    },
    {
      title: 'Stok Menipis',
      iconName: 'trending-down',
      onPress: () => navigation.navigate('LowStock'),
      allowed:
        userInfo?.cabang === 'KDC' ||
        userInfo?.cabang === 'KBS' ||
        (userInfo?.cabang?.startsWith('K') && userInfo?.cabang !== 'P04'),
    },
    {
      title: 'Riwayat SJ',
      iconName: 'archive',
      onPress: () => navigation.navigate('RiwayatSuratJalan'),
      allowed: userInfo?.cabang === 'KDC' || userInfo?.cabang === 'KBS',
    },
    {
      title: 'Stok Opname',
      iconName: 'clipboard',
      onPress: () => navigation.navigate('StokOpname'),
      allowed: userInfo?.kode === 'RIO' && userInfo?.cabang === 'KDC',
      color: '#FF9800',
    },
    {
      title: 'Penjualan Langsung',
      iconName: 'shopping-bag',
      onPress: () => navigation.navigate('PenjualanList'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Terima SJ',
      iconName: 'inbox',
      onPress: () => navigation.navigate('TerimaSj'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Retur Admin',
      iconName: 'rotate-ccw',
      onPress: () => navigation.navigate('ReturAdmin'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Mutasi Kirim',
      iconName: 'send',
      onPress: () => navigation.navigate('MutasiStore'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Mutasi Terima',
      iconName: 'corner-down-left',
      onPress: () => navigation.navigate('MutasiTerima'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Minta Barang',
      iconName: 'shopping-cart',
      onPress: () => navigation.navigate('MintaBarang'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Laporan Pending',
      iconName: 'alert-triangle',
      onPress: () => navigation.navigate('LaporanPending'),
      allowed:
        userInfo?.cabang?.startsWith('K') &&
        userInfo?.cabang !== 'KDC' &&
        userInfo?.cabang !== 'KBS',
    },
    {
      title: 'Tautkan WhatsApp',
      iconName: 'smartphone',
      onPress: () => navigation.navigate('LinkWhatsapp'),
      allowed: userInfo?.cabang?.startsWith('K'),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f2f5" />
      <View style={styles.profileCard}>
        <View>
          <Text style={styles.welcomeText}>Selamat datang,</Text>
          <Text style={styles.userName}>{userInfo?.nama || 'Pengguna'}</Text>
        </View>
        <View style={styles.branchInfo}>
          <Icon name="map-pin" size={16} color="#616161" />
          <Text style={styles.branchText}>
            {userInfo?.cabang || 'Tidak diketahui'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Menu Utama</Text>
      <View style={styles.gridContainer}>
        {allMenus
          .filter(menu => menu.allowed)
          .map((menu, index) => (
            <TouchableOpacity
              key={index}
              style={styles.gridItem}
              onPress={menu.onPress}>
              <Icon name={menu.iconName} size={40} color="#D32F2F" />
              <Text style={styles.gridText}>{menu.title}</Text>
            </TouchableOpacity>
          ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f0f2f5'},
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  welcomeText: {fontSize: 16, color: '#757575'},
  userName: {fontSize: 22, fontWeight: 'bold', color: '#212121'},
  branchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  branchText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1.2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
  },
  gridText: {marginTop: 12, fontSize: 16, fontWeight: '600', color: '#212121'},
});

export default DashboardScreen;
