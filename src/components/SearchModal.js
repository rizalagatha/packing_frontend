import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const SearchModal = ({
  visible,
  onClose,
  onSelect,
  title,
  apiSearchFunction,
  renderListItem,
  keyField,
}) => {
  const [searchText, setSearchText] = useState('');
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isFetching = useRef(false);
  const hasMoreRef = useRef(true);

  // fetch data dari API
  const fetchData = useCallback(
    async (term, pageNum, isNewSearch) => {
      if (isFetching.current || (pageNum > 1 && !hasMoreRef.current)) return;

      isFetching.current = true;
      setIsLoading(true);
      try {
        const response = await apiSearchFunction({
          term,
          page: pageNum,
          itemsPerPage: 20,
        });

        const newItems = response?.data?.data?.items ?? [];

        if (isNewSearch) {
          setData(newItems);
        } else {
          setData(prevData => [...prevData, ...newItems]);
        }

        if (newItems.length < 20) {
          setHasMore(false);
          hasMoreRef.current = false; // ✅ update juga ref
        } else {
          setHasMore(true);
          hasMoreRef.current = true;
        }
      } catch (error) {
        console.error(`Gagal mencari ${title}:`, error);
        setData([]);
      } finally {
        setIsLoading(false);
        isFetching.current = false;
      }
    },
    [apiSearchFunction, title], // ✅ sudah aman, no hasMore di sini
  );

  // Reset state saat modal dibuka
  useEffect(() => {
    if (visible) {
      setData([]);
      setPage(1);
      setHasMore(true);
      hasMoreRef.current = true; // ✅ reset ref
      fetchData('', 1, true);
    }
  }, [visible, fetchData]);

  // Cari ulang saat searchText berubah
  useEffect(() => {
    if (!visible) return;

    const handler = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchData(searchText, 1, true);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchText, visible, fetchData]);

  const handleLoadMore = () => {
    if (!hasMore || isLoading) return;
    const newPage = page + 1;
    setPage(newPage);
    fetchData(searchText, newPage, false);
  };

  const handleSelect = item => {
    onSelect(item);
    onClose();
  };

  const renderFooter = () => {
    if (!isLoading || page === 1) return null;
    return <ActivityIndicator style={{marginVertical: 20}} />;
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="x" size={24} color="#616161" />
          </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={20}
            color="#757575"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={`Cari berdasarkan kode atau nama...`}
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#BDBDBD"
          />
        </View>
        <FlatList
          data={data}
          keyExtractor={(item, index) => {
            // 1. Coba ambil dari keyField (jika ada)
            const key = item[keyField];
            // 2. Jika ada, ubah jadi string. Jika tidak ada, pakai index array.
            return key ? String(key) : String(index);
          }}
          keyboardShouldPersistTaps="handled"
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item)}>
              {renderListItem(item)}
            </TouchableOpacity>
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>Data tidak ditemukan.</Text>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

// Stylesheet
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {fontSize: 18, fontWeight: 'bold', color: '#212121'},
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {marginRight: 10},
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F4F6F8',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#212121',
  },
  item: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  itemKode: {fontWeight: 'bold', color: '#212121'},
  itemNama: {color: '#757575'},
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#757575',
    fontSize: 16,
  },
});

export default SearchModal;
