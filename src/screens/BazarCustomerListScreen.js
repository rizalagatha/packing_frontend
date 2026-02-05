import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import * as DB from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';

const BazarCustomerListScreen = ({navigation}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);

  // 1. Bungkus dengan useCallback agar identitas fungsi stabil
  const fetchCustomers = useCallback(async () => {
    const data = await DB.searchBazarCustomers(searchQuery);
    setCustomers(data);
  }, [searchQuery]); // Hanya berubah kalau searchQuery berubah

  // 2. Gunakan useEffect dengan dependency yang lengkap
  useEffect(() => {
    // Tambahkan delay 300ms (debounce) agar tidak boros query saat ngetik
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchCustomers]); // Sekarang fetchCustomers aman jadi dependency

  const handleSelect = item => {
    navigation.navigate('BazarCashier', {
      selectedCustomer: {
        kode: item.cus_kode,
        nama: item.cus_nama,
      },
    });
  };

  const renderItem = ({item}) => (
    <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{item.cus_kode}</Text>
        </View>
        <Icon name="chevron-right" size={18} color="#CCC" />
      </View>

      <Text style={styles.nameText}>{item.cus_nama}</Text>

      <View style={styles.addressRow}>
        <Icon name="map-pin" size={12} color="#888" />
        <Text style={styles.addressText} numberOfLines={2}>
          {item.cus_alamat || 'Alamat tidak tersedia'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama pelanggan..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={customers}
        keyExtractor={item => item.cus_kode}
        renderItem={renderItem}
        contentContainerStyle={{padding: 15}}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="users" size={50} color="#DDD" />
            <Text style={styles.emptyLabel}>Pelanggan tidak ditemukan</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  searchHeader: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
  },
  searchInput: {flex: 1, marginLeft: 10, fontSize: 14},
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: '#FCE4EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  codeText: {fontSize: 10, color: '#E91E63', fontWeight: 'bold'},
  nameText: {fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5},
  addressRow: {flexDirection: 'row', alignItems: 'center'},
  addressText: {fontSize: 12, color: '#666', marginLeft: 5, flex: 1},
  emptyState: {alignItems: 'center', marginTop: 100},
  emptyLabel: {marginTop: 10, color: '#999'},
});

export default BazarCustomerListScreen;
