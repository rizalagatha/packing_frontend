import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const EmptyStockModal = ({
  visible,
  onClose,
  branchList = [],
  userBranch,
  onFetchData, // Fungsi ini harus dipanggil saat user berinteraksi
  dataList = [],
  loading,
  onItemPress,
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // 1. Inisialisasi awal saat modal dibuka
  useEffect(() => {
    if (visible) {
      const initialBranch = userBranch === 'KDC' ? 'K01' : userBranch;
      setSelectedBranch(initialBranch);
      setSearchText('');

      if (onFetchData) {
        onFetchData('', initialBranch);
      }
    }
  }, [visible, userBranch, onFetchData]);

  // 2. Handler Ganti Cabang
  const handleBranchChange = code => {
    setSelectedBranch(code);
    // PENTING: Panggil fetch data baru
    if (onFetchData) {
      onFetchData(searchText, code);
    }
  };

  // 3. Handler Submit Pencarian
  const handleSearchSubmit = () => {
    // PENTING: Panggil fetch data baru
    if (onFetchData) {
      onFetchData(searchText, selectedBranch);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Stok Kosong (Reguler)</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={{flex: 1, paddingHorizontal: 16, paddingTop: 10}}>
            {/* Filter Cabang (Hanya KDC) */}
            {userBranch === 'KDC' && (
              <View style={{marginBottom: 12, height: 45}}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {branchList.map((cab, index) => {
                    // Pastikan properti kode sesuai dengan data API cabang kamu
                    const kode =
                      cab.gdg_kode || cab.kode || cab.cabang_kode || '?';
                    const isSelected = selectedBranch === kode;
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleBranchChange(kode)} // <--- Panggil handler ini
                        style={[styles.chip, isSelected && styles.chipActive]}>
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}>
                          {kode}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Search Bar */}
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
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSearchSubmit} // <--- Panggil handler ini
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={handleSearchSubmit} // <--- Panggil handler ini
                style={{padding: 5}}>
                <Icon name="arrow-right" size={20} color="#1976D2" />
              </TouchableOpacity>
            </View>

            {/* List Data */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#1976D2"
                style={{marginTop: 40}}
              />
            ) : (
              <FlatList
                data={dataList}
                keyExtractor={(item, i) =>
                  (item.kode || i.toString()) + item.ukuran
                }
                contentContainerStyle={{paddingBottom: 20, paddingTop: 10}}
                ListEmptyComponent={
                  <Text
                    style={{textAlign: 'center', marginTop: 30, color: '#999'}}>
                    Tidak ada data stok kosong.
                  </Text>
                }
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.itemRow}
                    onPress={() => onItemPress && onItemPress(item)}>
                    <View style={{flex: 1}}>
                      <Text style={styles.itemName}>{item.nama_barang}</Text>
                      <Text style={styles.itemSub}>
                        {item.ukuran} • {item.kode}
                      </Text>
                    </View>
                    <View style={styles.badgeKosong}>
                      <Text style={styles.badgeText}>KOSONG</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    height: 45,
    marginBottom: 10,
  },
  searchInput: {flex: 1, paddingHorizontal: 10, color: '#333'},
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipActive: {backgroundColor: '#1976D2', borderColor: '#1976D2'},
  chipText: {color: '#666', fontWeight: '600'},
  chipTextActive: {color: '#fff'},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemName: {fontSize: 13, fontWeight: 'bold', color: '#333'},
  itemSub: {fontSize: 11, color: '#888'},
  badgeKosong: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {color: '#D32F2F', fontSize: 10, fontWeight: 'bold'},
});

export default EmptyStockModal;
