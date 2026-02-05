import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import * as DB from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';
import StrukModal from '../components/StrukModal';

const BazarSalesHistoryScreen = ({navigation}) => {
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      // 2. Panggil fungsi yang sudah kita buat di Database.js
      // JANGAN panggil DB.executeSql karena itu tidak diexport
      const data = await DB.getBazarSalesHistory();
      setHistory(data);
    } catch (e) {
      console.error('Gagal memuat riwayat:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenDetail = async soNomor => {
    const fullData = await DB.getBazarSaleDetail(soNomor);
    if (fullData) {
      setSelectedData(fullData);
      setIsModalVisible(true);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const renderItem = ({item}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleOpenDetail(item.so_nomor)} // <-- TAMBAHKAN INI
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.noNota}>{item.so_nomor}</Text>
          <View
            style={[
              styles.badge,
              {backgroundColor: item.is_uploaded ? '#E8F5E9' : '#FFF3E0'},
            ]}>
            <Text
              style={[
                styles.badgeText,
                {color: item.is_uploaded ? '#2E7D32' : '#E65100'},
              ]}>
              {item.is_uploaded ? 'TERKIRIM' : 'LOCAL'}
            </Text>
          </View>
        </View>
        <Text style={styles.date}>
          {new Date(item.so_tanggal).toLocaleString('id-ID')}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.cusName}>Customer: {item.so_customer}</Text>
          <Text style={styles.total}>
            Rp {(parseFloat(item.so_total) || 0).toLocaleString('id-ID')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#F5F7FA'}}>
      <FlatList
        data={history}
        keyExtractor={it => it.so_nomor}
        renderItem={renderItem}
        contentContainerStyle={history.length === 0 ? {flex: 1} : {padding: 15}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E91E63']}
          />
        }
        // --- INI BAGIAN EMPTY STATE ---
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.iconCircle}>
              <Icon name="shopping-bag" size={50} color="#E91E63" />
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Nota</Text>
            <Text style={styles.emptySub}>
              Transaksi yang Anda simpan di HP ini akan muncul di sini sebelum
              di-upload.
            </Text>
            <TouchableOpacity
              style={styles.btnGoToCashier}
              onPress={() => navigation.navigate('BazarCashier')}>
              <Text style={styles.btnText}>BUKA KASIR</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <StrukModal
        visible={isModalVisible}
        data={selectedData}
        isBazar={true}
        onClose={() => {
          setIsModalVisible(false);
          setSelectedData(null);
        }}
        onSendWa={hp => console.log('Kirim ulang WA ke:', hp)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noNota: {fontWeight: 'bold', color: '#333', fontSize: 14},
  date: {fontSize: 11, color: '#999', marginTop: 2},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  cusName: {fontSize: 12, color: '#666'},
  total: {fontWeight: 'bold', color: '#E91E63'},
  badge: {paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4},
  badgeText: {fontSize: 10, fontWeight: 'bold'},

  // Styles untuk Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FCE4EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySub: {fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20},
  btnGoToCashier: {
    marginTop: 25,
    backgroundColor: '#E91E63',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
  },
  btnText: {color: '#fff', fontWeight: 'bold', fontSize: 14},
});

export default BazarSalesHistoryScreen;
