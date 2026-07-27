import React, {useState, useContext, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {AuthContext} from '../context/AuthContext';
import {
  searchBarangKaosanApi,
  getMintaBahanFormForEditApi,
  saveMintaBahanFormApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import DatePicker from 'react-native-date-picker';

const JENIS_OPTIONS = [
  {value: 'ACCESORIES', label: 'Accesories', icon: 'package'},
  {value: 'OBAT', label: 'Obat/DTF', icon: 'droplet'},
];

const MintaBahanFormScreen = ({navigation, route}) => {
  const {userToken} = useContext(AuthContext);
  const editNomor = route.params?.nomor || null;
  const isEditMode = !!editNomor;

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  const [tanggal, setTanggal] = useState(new Date());
  const [openDatePicker, setOpenDatePicker] = useState(false);
  const [jenis, setJenis] = useState('ACCESORIES');
  const [keterangan, setKeterangan] = useState('');
  const [items, setItems] = useState([]);

  const [isSearchVisible, setSearchVisible] = useState(false);

  // --- Load data untuk mode Edit ---
  const loadEditData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getMintaBahanFormForEditApi(editNomor, userToken);
      const {header, items: itemRows} = response.data.data;

      if (header.min_close !== 0) {
        Alert.alert(
          'Tidak Bisa Diubah',
          'Permintaan ini sudah diproses/diclose.',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
        return;
      }

      setTanggal(new Date(header.tanggal));
      setJenis(header.jenis);
      setKeterangan(header.keterangan || '');
      setItems(
        itemRows.map(it => ({
          kode: it.kode,
          nama: it.nama,
          satuan: it.satuan,
          jumlah: String(it.jumlah),
          keterangan: it.keterangan || '',
        })),
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Gagal memuat data permintaan.',
      });
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  }, [editNomor, userToken, navigation]);

  useEffect(() => {
    if (isEditMode) {
      loadEditData();
    }
  }, [isEditMode, loadEditData]);

  // --- Tambah Barang dari Search Modal ---
  const handleSelectBarang = barang => {
    setSearchVisible(false);
    setItems(prev => {
      const existingIndex = prev.findIndex(i => i.kode === barang.kode);
      if (existingIndex > -1) {
        // Sudah ada di list, tambah 1 qty
        const updated = [...prev];
        const currentQty = parseFloat(updated[existingIndex].jumlah) || 0;
        updated[existingIndex] = {
          ...updated[existingIndex],
          jumlah: String(currentQty + 1),
        };
        return updated;
      }
      return [
        {
          kode: barang.kode,
          nama: barang.nama,
          satuan: barang.satuan,
          note: barang.note,
          stok: barang.stok,
          jumlah: '1',
          keterangan: '',
        },
        ...prev,
      ];
    });
  };

  const handleChangeJumlah = (index, value) => {
    // Hanya izinkan angka dan titik desimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {...updated[index], jumlah: cleaned};
      return updated;
    });
  };

  const handleChangeKeteranganItem = (index, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {...updated[index], keterangan: value};
      return updated;
    });
  };

  const handleRemoveItem = index => {
    Alert.alert('Hapus Barang', 'Yakin hapus barang ini dari daftar?', [
      {text: 'Batal', style: 'cancel'},
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => setItems(prev => prev.filter((_, i) => i !== index)),
      },
    ]);
  };

  const handleChangeJenis = newJenis => {
    if (jenis === newJenis) {
      return;
    }
    if (items.length > 0) {
      Alert.alert(
        'Ganti Jenis Permintaan?',
        'Daftar barang yang sudah dipilih akan dikosongkan karena kategori barang berbeda.',
        [
          {text: 'Batal', style: 'cancel'},
          {
            text: 'Ya, Ganti',
            onPress: () => {
              setItems([]);
              setJenis(newJenis);
            },
          },
        ],
      );
    } else {
      setJenis(newJenis);
    }
  };

  // --- Simpan ---
  const handleSave = async () => {
    if (items.length === 0) {
      return Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Tambahkan minimal 1 barang.',
      });
    }

    const invalidItem = items.find(
      it => !it.jumlah || parseFloat(it.jumlah) <= 0,
    );
    if (invalidItem) {
      return Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: `Jumlah "${invalidItem.nama}" harus lebih dari 0.`,
      });
    }

    setIsSaving(true);
    try {
      const payload = {
        header: {
          nomor: editNomor,
          tanggal: tanggal.toISOString().split('T')[0],
          jenis,
          keterangan,
        },
        items: items.map(it => ({
          kode: it.kode,
          jumlah: parseFloat(it.jumlah),
          keterangan: it.keterangan,
        })),
        isNew: !isEditMode,
      };

      const response = await saveMintaBahanFormApi(payload, userToken);
      Toast.show({
        type: 'success',
        text1: 'Berhasil',
        text2: response.data.message,
      });
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: error.response?.data?.message || 'Gagal menyimpan permintaan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = ({item, index}) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeaderRow}>
        <View style={{flex: 1}}>
          <Text style={styles.itemNama} numberOfLines={2}>
            {item.nama}
          </Text>
          <Text style={styles.itemKode}>
            {item.kode} {item.note ? `(${item.note})` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveItem(index)}
          style={styles.btnRemove}>
          <Icon name="trash-2" size={16} color="#D32F2F" />
        </TouchableOpacity>
      </View>

      <View style={styles.itemInputRow}>
        <View style={styles.jumlahBox}>
          <Text style={styles.inputLabel}>Jumlah ({item.satuan || '-'})</Text>
          <TextInput
            style={styles.jumlahInput}
            keyboardType="decimal-pad"
            value={item.jumlah}
            onChangeText={v => handleChangeJumlah(index, v)}
          />
        </View>
        <View style={styles.keteranganBox}>
          <Text style={styles.inputLabel}>Keterangan (opsional)</Text>
          <TextInput
            style={styles.keteranganInput}
            placeholder="Catatan khusus..."
            value={item.keterangan}
            onChangeText={v => handleChangeKeteranganItem(index, v)}
          />
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#7B1FA2"
          style={{marginTop: 50}}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SearchModal
        visible={isSearchVisible}
        onClose={() => setSearchVisible(false)}
        onSelect={handleSelectBarang}
        title={`Cari Barang ${jenis === 'OBAT' ? 'Obat/DTF' : 'Accesories'}`}
        apiSearchFunction={params =>
          searchBarangKaosanApi(params.term, jenis, userToken)
        }
        keyField="kode"
        renderListItem={item => (
          <View>
            <Text style={{fontWeight: 'bold', color: '#333'}}>{item.nama}</Text>
            <Text style={{fontSize: 12, color: '#666'}}>
              {item.kode} · Stok: {item.stok} {item.satuan}
            </Text>
          </View>
        )}
      />

      <DatePicker
        modal
        open={openDatePicker}
        date={tanggal}
        mode="date"
        onConfirm={date => {
          setOpenDatePicker(false);
          setTanggal(date);
        }}
        onCancel={() => setOpenDatePicker(false)}
      />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* HEADER FORM */}
        <View style={styles.headerForm}>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setOpenDatePicker(true)}>
              <Icon name="calendar" size={16} color="#555" />
              <Text style={styles.dateButtonText}>
                {tanggal.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Jenis Permintaan</Text>
          <View style={styles.jenisRow}>
            {JENIS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.jenisBtn,
                  jenis === opt.value && styles.jenisBtnActive,
                ]}
                onPress={() => handleChangeJenis(opt.value)}
                disabled={isEditMode}>
                <Icon
                  name={opt.icon}
                  size={16}
                  color={jenis === opt.value ? '#fff' : '#666'}
                />
                <Text
                  style={[
                    styles.jenisBtnText,
                    jenis === opt.value && styles.jenisBtnTextActive,
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {isEditMode && (
            <Text style={styles.editNote}>
              Jenis permintaan tidak bisa diubah saat edit.
            </Text>
          )}

          <Text style={styles.inputLabel}>Keterangan</Text>
          <TextInput
            style={styles.keteranganHeaderInput}
            placeholder="Keterangan umum permintaan..."
            value={keterangan}
            onChangeText={setKeterangan}
            multiline
          />
        </View>

        {/* LIST BARANG */}
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, idx) => `${item.kode}-${idx}`}
          contentContainerStyle={{padding: 10, paddingBottom: 100}}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.btnAddBarang}
              onPress={() => setSearchVisible(true)}>
              <Icon name="plus-circle" size={18} color="#7B1FA2" />
              <Text style={styles.btnAddBarangText}>Tambah Barang</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={40} color="#ccc" />
              <Text style={styles.emptyText}>Belum ada barang dipilih</Text>
            </View>
          }
        />

        {/* FOOTER SAVE */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnSave, isSaving && {opacity: 0.7}]}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="save" size={18} color="#fff" />
                <Text style={styles.btnSaveText}>
                  {isEditMode ? 'SIMPAN PERUBAHAN' : 'SIMPAN PERMINTAAN'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},

  headerForm: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  row: {marginBottom: 12},
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 8,
  },
  dateButtonText: {color: '#333', fontSize: 13, fontWeight: '600'},

  inputLabel: {fontSize: 12, color: '#666', marginBottom: 6, marginTop: 4},

  jenisRow: {flexDirection: 'row', gap: 10, marginBottom: 4},
  jenisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    gap: 6,
  },
  jenisBtnActive: {backgroundColor: '#7B1FA2'},
  jenisBtnText: {fontSize: 13, fontWeight: '600', color: '#666'},
  jenisBtnTextActive: {color: '#fff'},
  editNote: {fontSize: 11, color: '#E65100', marginTop: 6, fontStyle: 'italic'},

  keteranganHeaderInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: 'top',
    color: '#333',
  },

  btnAddBarang: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CE93D8',
    borderStyle: 'dashed',
    paddingVertical: 12,
    marginBottom: 10,
    gap: 8,
  },
  btnAddBarangText: {color: '#7B1FA2', fontWeight: 'bold', fontSize: 13},

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemNama: {fontSize: 13, fontWeight: '600', color: '#333'},
  itemKode: {fontSize: 11, color: '#999', marginTop: 2},
  btnRemove: {padding: 4},

  itemInputRow: {flexDirection: 'row', gap: 10},
  jumlahBox: {width: 100},
  jumlahInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#333',
  },
  keteranganBox: {flex: 1},
  keteranganInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#333',
  },

  emptyContainer: {alignItems: 'center', marginTop: 40},
  emptyText: {marginTop: 8, color: '#999', fontSize: 12},

  footer: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  btnSave: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7B1FA2',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  btnSaveText: {color: '#fff', fontWeight: 'bold', fontSize: 14},
});

export default MintaBahanFormScreen;
