import React, {useState, useEffect, useRef, useContext} from 'react'; // Tambah useContext
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  ActivityIndicator, // Tambah ini
} from 'react-native';
import * as DB from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';
import {uploadKoreksiBazarApi} from '../api/ApiService';
import {AuthContext} from '../context/AuthContext'; // Tambah ini

const BazarOpnameScreen = () => {
  // 1. Ambil data Token dan User dari Context
  const {userToken, userInfo} = useContext(AuthContext);

  const [mode, setMode] = useState('LIST');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Tambah state loading

  const [form, setForm] = useState({
    barcode: '',
    nama: '',
    stokSistem: 0,
    fisik: '',
  });

  const inputFisikRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await DB.getBazarOpnameHistory();
    setHistory(data);
  };

  const handleSearchBarcode = async code => {
    const item = await DB.getBarangBazarByBarcode(code);
    if (item) {
      setForm({...form, barcode: item.barcode, nama: item.nama, stokSistem: 0});
      inputFisikRef.current?.focus();
    } else {
      Alert.alert('Eror', 'Barang tidak ditemukan di database bazar.');
    }
  };

  const handleSave = async () => {
    if (!form.barcode || !form.fisik)
      return Alert.alert('Pesan', 'Data belum lengkap');

    const qtyFisik = parseFloat(form.fisik);
    const selisih = qtyFisik - form.stokSistem;
    const noKoreksi = `KOR-BZR-${Date.now()}`;

    const header = {
      no_koreksi: noKoreksi,
      tanggal: new Date().toISOString(),
      operator: userInfo?.kode || 'ADMIN', // Gunakan kode user login
    };

    const details = [
      {
        barcode: form.barcode,
        qty_sistem: form.stokSistem,
        qty_fisik: qtyFisik,
        selisih,
      },
    ];

    await DB.saveBazarOpname(header, details);
    setMode('LIST');
    loadHistory();
    setForm({barcode: '', nama: '', stokSistem: 0, fisik: ''});
  };

  const handleUpload = async () => {
    const pendingData = await DB.getPendingBazarOpname();

    if (pendingData.length === 0) {
      return Alert.alert('Info', 'Semua data sudah ter-upload.');
    }

    setIsLoading(true);
    try {
      const grouped = pendingData.reduce((acc, item) => {
        if (!acc[item.no_koreksi]) {
          acc[item.no_koreksi] = {
            header: {
              no_koreksi: item.no_koreksi,
              tanggal: item.tanggal,
              operator: item.operator,
            },
            details: [],
          };
        }
        acc[item.no_koreksi].details.push(item);
        return acc;
      }, {});

      for (const noKoreksi in grouped) {
        const payload = {
          header: grouped[noKoreksi].header,
          details: grouped[noKoreksi].details,
          targetCabang: userInfo.cabang,
        };

        const res = await uploadKoreksiBazarApi(payload, userToken);
        if (res.data.success) {
          await DB.markBazarOpnameUploaded(noKoreksi);
        }
      }

      Alert.alert('Sukses', 'Data koreksi stok berhasil dikirim ke pusat.');
      loadHistory();
    } catch (error) {
      console.error(error);
      Alert.alert('Gagal', 'Koneksi terputus atau server sedang bermasalah.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk pewarnaan teks baris (sesuai instruksi sebelumnya)
  const getRowTextColor = isUploaded => {
    return isUploaded === 1 ? '#999' : '#333';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
          <TouchableOpacity
            onPress={() => (mode === 'FORM' ? setMode('LIST') : null)}>
            <Icon
              name={mode === 'FORM' ? 'arrow-left' : 'clipboard'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'LIST' ? 'Riwayat Koreksi Bazar' : 'Input Koreksi Stok'}
          </Text>
        </View>

        {/* Tombol Upload (Hanya muncul di mode LIST) */}
        {mode === 'LIST' && (
          <TouchableOpacity onPress={handleUpload} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Icon name="upload-cloud" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {mode === 'LIST' ? (
        <View style={{flex: 1}}>
          <FlatList
            data={history}
            keyExtractor={it => it.no_koreksi + it.barcode}
            renderItem={({item}) => (
              <View
                style={[
                  styles.historyCard,
                  item.is_uploaded === 1 && styles.cardUploaded,
                ]}>
                <View style={{flex: 1}}>
                  <Text
                    style={[
                      styles.histName,
                      {color: getRowTextColor(item.is_uploaded)},
                    ]}>
                    {item.nama}
                  </Text>
                  <Text style={styles.histDetail}>
                    Fisik: {item.qty_fisik} | Selisih: {item.selisih}
                  </Text>
                  <Text style={styles.histDate}>
                    {new Date(item.tanggal).toLocaleDateString()}
                  </Text>
                </View>
                {item.is_uploaded === 1 && (
                  <Icon name="check-circle" size={16} color="#4CAF50" />
                )}
              </View>
            )}
          />
          <TouchableOpacity style={styles.fab} onPress={() => setMode('FORM')}>
            <Icon name="plus" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <Text style={styles.label}>Barcode Barang</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Scan/Ketik Barcode..."
              value={form.barcode}
              onChangeText={t => setForm({...form, barcode: t})}
              onSubmitEditing={() => handleSearchBarcode(form.barcode)}
            />
            <TouchableOpacity
              style={styles.btnSearch}
              onPress={() => handleSearchBarcode(form.barcode)}>
              <Icon name="search" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Nama Barang:</Text>
            <Text style={styles.infoValue}>{form.nama || '-'}</Text>
          </View>

          <Text style={styles.label}>Jumlah Fisik di Meja</Text>
          <TextInput
            ref={inputFisikRef}
            style={styles.inputBig}
            keyboardType="numeric"
            placeholder="0"
            value={form.fisik}
            onChangeText={t => setForm({...form, fisik: t})}
          />

          <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
            <Text style={styles.btnText}>SIMPAN KOREKSI</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  header: {
    backgroundColor: '#E91E63',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Agar tombol upload ke kanan
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
  formContainer: {padding: 20},
  label: {fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5},
  searchRow: {flexDirection: 'row', gap: 10, marginBottom: 20},
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    color: '#333',
  },
  btnSearch: {
    backgroundColor: '#E91E63',
    width: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    backgroundColor: '#FFF4F7',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F8BBD0',
  },
  infoLabel: {fontSize: 12, color: '#C2185B'},
  infoValue: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  inputBig: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 70,
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    marginBottom: 30,
    color: '#333',
  },
  btnSave: {
    backgroundColor: '#4CAF50',
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  btnText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  historyCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardUploaded: {
    backgroundColor: '#F0F0F0',
  },
  histName: {fontWeight: 'bold', fontSize: 14},
  histDetail: {fontSize: 12, color: '#666', marginTop: 5},
  histDate: {fontSize: 10, color: '#999', marginTop: 5},
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#E91E63',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
});

export default BazarOpnameScreen;
