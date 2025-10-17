import React, {
  useState,
  useContext,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  loadStbjDataApi,
  onCheckApi,
  getPackingDetailForCheckerApi,
} from '../api/ApiService';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const CheckerScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);
  const [stbjNomor, setStbjNomor] = useState('');
  const [items, setItems] = useState([]); // Daftar item dari STBJ dengan qty scan
  const [scannedPacking, setScannedPacking] = useState(''); // Untuk input scan packing

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const packingInputRef = useRef(null);

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log(`Tidak bisa memutar suara`, e);
    }
  };

  // Hitung total selisih
  const totalSelisih = useMemo(() => {
    if (items.length === 0) return -1; // Status awal, anggap ada selisih
    return items.reduce(
      (sum, item) => sum + (item.jumlahKirim - item.jumlahScan),
      0,
    );
  }, [items]);

  // Fungsi untuk memuat data STBJ
  const handleLoadStbj = async () => {
    if (!stbjNomor) return;
    setIsLoading(true);
    setItems([]);
    try {
      const response = await loadStbjDataApi(stbjNomor, userToken);
      // Inisialisasi jumlahScan menjadi 0
      setItems(response.data.data.map(item => ({...item, jumlahScan: 0})));
      setTimeout(() => packingInputRef.current?.focus(), 200);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal Memuat',
        text2: 'Gagal memuat detail STBJ.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi baru untuk scan NOMOR PACKING
  const handlePackingScan = async () => {
    if (!scannedPacking) return;

    try {
      const cleanPackingNumber = scannedPacking.trim().toUpperCase();

      console.log('=== SCAN START ===');
      console.log('Raw input:', scannedPacking);
      console.log('Clean input:', cleanPackingNumber);
      console.log('Length:', cleanPackingNumber.length);
      console.log('Current items count:', items.length);

      const response = await getPackingDetailForCheckerApi(
        cleanPackingNumber,
        userToken,
      );
      const packingItems = response.data.data.items;

      console.log('Packing items received:', packingItems.length);
      if (packingItems.length > 0) {
        console.log('Sample packing item:', packingItems[0]);
      }

      if (items.length > 0) {
        console.log('Sample STBJ item:', items[0]);
      }

      setItems(prevItems => {
        const newItems = [...prevItems];
        let foundMatch = false;
        let details = [];

        packingItems.forEach(packItem => {
          const matches = newItems.filter(
            item =>
              item.barcode === packItem.packd_barcode &&
              item.ukuran === packItem.size &&
              item.stbjd_packing === packItem.packd_pack_nomor,
          );

          console.log(
            `Searching: barcode=${packItem.packd_barcode}, size=${packItem.size}, packing=${packItem.packd_pack_nomor}`,
          );
          console.log(`Found ${matches.length} matches`);

          matches.forEach((match, idx) => {
            const itemIndex = newItems.findIndex(
              i => i.uniqueKey === match.uniqueKey,
            );
            if (itemIndex > -1) {
              newItems[itemIndex].jumlahScan += packItem.packd_qty;
              foundMatch = true;
              details.push(`${match.ukuran} +${packItem.packd_qty}`);
            }
          });
        });

        if (foundMatch) {
          Toast.show({
            type: 'success',
            text1: 'Scan Berhasil',
            text2: details.join(', '),
          });
          playSound('success');
        } else {
          Toast.show({
            type: 'error',
            text1: 'Tidak Cocok',
            text2: 'Item tidak ditemukan di STBJ ini.',
          });
          playSound('error');
        }
        return newItems;
      });
    } catch (error) {
      console.error('=== SCAN ERROR ===');
      console.error('Error:', error);
      console.error('Response:', error.response?.data);

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Gagal scan packing.',
      });
      playSound('error');
    }

    setScannedPacking('');
    setTimeout(() => packingInputRef.current?.focus(), 100);
  };

  const handleOnCheck = async () => {
    Alert.alert(
      'Konfirmasi Validasi',
      `Anda yakin semua barang untuk STBJ ${stbjNomor} sudah sesuai?`,
      [
        {text: 'Batal', style: 'cancel'},
        {
          text: 'Ya, Validasi',
          onPress: async () => {
            setIsSaving(true);
            try {
              await onCheckApi({stbj_nomor: stbjNomor}, userToken);
              Toast.show({
                type: 'success',
                text1: 'Sukses',
                text2: `STBJ ${stbjNomor} berhasil divalidasi.`,
              });
              navigation.goBack();
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Gagal',
                text2: 'Gagal menyimpan validasi.',
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({item}) => {
    const selisih = item.jumlahKirim - item.jumlahScan;
    const isMatched = selisih === 0;

    return (
      <View style={[styles.itemContainer, isMatched && styles.itemMatched]}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>
            {item.nama || 'Nama tidak tersedia'}
          </Text>
          <Text style={styles.itemDetails}>Size: {item.ukuran}</Text>
          <Text style={styles.packingNumber}>
            {item.stbjd_packing || 'PACKING-N/A'}
          </Text>
        </View>
        <View style={styles.qtyContainer}>
          <Text style={styles.qtyLabel}>STBJ: {item.jumlahKirim}</Text>
          <Text style={styles.qtyValue}>{item.jumlahScan}</Text>
          <Text
            style={[
              styles.qtyLabel,
              {color: !isMatched ? '#D32F2F' : '#4CAF50'},
            ]}>
            Selisih: {selisih}
          </Text>
        </View>
      </View>
    );
  };

  const isButtonDisabled = totalSelisih !== 0 || isSaving || items.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerForm}>
        <View style={styles.stbjInputWrapper}>
          <TextInput
            style={styles.stbjInput}
            placeholder="Scan atau Input No. STBJ"
            value={stbjNomor}
            onChangeText={setStbjNomor}
            onSubmitEditing={handleLoadStbj}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.loadButton}
            onPress={handleLoadStbj}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#616161" />
            ) : (
              <Icon name="download" size={20} color="#616161" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scanContainer}>
        <TextInput
          ref={packingInputRef}
          style={styles.scanInput}
          placeholder="Scan Barcode Packing Di Sini..."
          value={scannedPacking}
          onChangeText={setScannedPacking}
          onSubmitEditing={handlePackingScan}
          editable={items.length > 0 && !isLoading}
          placeholderTextColor="#BDBDBD"
          blurOnSubmit={false}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#D32F2F" style={{flex: 1}} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.uniqueKey}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Input No. STBJ untuk memuat data.
            </Text>
          }
          extraData={items}
        />
      )}

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={[styles.button, isButtonDisabled && styles.buttonDisabled]}
          onPress={handleOnCheck}
          disabled={isButtonDisabled}>
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>ON CHECK</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F6F8'},
  headerForm: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  stbjInputWrapper: {flexDirection: 'row'},
  stbjInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#212121',
  },
  loadButton: {
    height: 48,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  scanContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
  },
  scanInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#212121',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemMatched: {backgroundColor: '#E8F5E9'},
  itemInfo: {flex: 1, marginRight: 10},
  itemName: {fontSize: 16, fontWeight: '600', color: '#212121'},
  packingNumber: {
    // -> Style baru
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  itemDetails: {color: '#666', marginTop: 4},
  qtyContainer: {alignItems: 'flex-end', minWidth: 60},
  qtyLabel: {color: '#888', fontSize: 12},
  qtyValue: {fontSize: 20, fontWeight: 'bold', color: '#212121'},
  emptyText: {textAlign: 'center', marginTop: 40, color: '#999', fontSize: 16},
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    elevation: 2,
  },
  buttonDisabled: {backgroundColor: '#BDBDBD'},
  buttonText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
});

export default CheckerScreen;
