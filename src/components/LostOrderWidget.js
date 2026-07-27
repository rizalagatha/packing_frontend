import React, {useState, useContext} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import {saveLostOrderApi} from '../api/ApiService';
import Toast from 'react-native-toast-message';

const ALASAN_LIST = [
  {id: 'Stok Kosong', icon: 'box', color: '#F57C00'},
  {id: 'Harga Mahal', icon: 'dollar-sign', color: '#4CAF50'},
  {id: 'Masih Cari-cari', icon: 'search', color: '#29B6F6'},
  {id: 'Masih Pikir-pikir', icon: 'message-circle', color: '#757575'},
  {id: 'Tidak Cocok', icon: 'slash', color: '#EF5350'},
  {id: 'Tidak Ada Budget', icon: 'credit-card', color: '#26C6DA'},
  {id: 'Beli di Tempat Lain', icon: 'shopping-bag', color: '#42A5F5'},
  {id: 'Salah Toko', icon: 'map-pin', color: '#EC407A'},
  {id: 'Tunggu Terlalu Lama', icon: 'clock', color: '#FFA726'},
  {id: 'Lainnya', icon: 'help-circle', color: '#F57C00'},
];

const LostOrderWidget = ({visible, onClose}) => {
  const {userToken} = useContext(AuthContext);

  const [form, setForm] = useState({
    customerNama: '',
    customerTelp: '',
    produkNama: '',
    ukuran: '',
    qty: '1',
    alasan: '',
    catatan: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSelectAlasan = alasanId => {
    setForm({...form, alasan: alasanId});
  };

  const handleResetAndClose = () => {
    setForm({
      customerNama: '',
      customerTelp: '',
      produkNama: '',
      ukuran: '',
      qty: '1',
      alasan: '',
      catatan: '',
    });
    onClose();
  };

  const handleSave = async () => {
    if (!form.produkNama.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Validasi',
        text2: 'Nama Produk / Model wajib diisi.',
      });
    }
    if (!form.ukuran.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Validasi',
        text2: 'Ukuran wajib diisi.',
      });
    }
    if (!form.qty || isNaN(form.qty) || Number(form.qty) <= 0) {
      return Toast.show({
        type: 'error',
        text1: 'Validasi',
        text2: 'QTY harus lebih dari 0.',
      });
    }
    if (!form.alasan) {
      return Toast.show({
        type: 'error',
        text1: 'Validasi',
        text2: 'Pilih salah satu Alasan Lost.',
      });
    }

    setIsLoading(true);
    try {
      await saveLostOrderApi(form, userToken);
      Toast.show({
        type: 'success',
        text1: 'Tersimpan',
        text2: 'Data Lost Order berhasil dicatat.',
      });
      handleResetAndClose();
    } catch (error) {
      const msg = error.response?.data?.message || 'Gagal menyimpan data.';
      Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleResetAndClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* HEADER WIDGET */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBg}>
                <Icon name="user-x" size={20} color="#E91E63" />
              </View>
              <Text style={styles.title}>Catat Lost Order</Text>
            </View>
            <TouchableOpacity
              onPress={handleResetAndClose}
              style={styles.closeBtn}>
              <Icon name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* SECTION 1: PELANGGAN */}
            <Text style={styles.sectionLabel}>DATA CUSTOMER (OPSIONAL)</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroupHalf}>
                <TextInput
                  style={styles.inputLight}
                  placeholder="Nama Customer..."
                  placeholderTextColor="#999"
                  value={form.customerNama}
                  onChangeText={t => setForm({...form, customerNama: t})}
                />
              </View>
              <View style={styles.inputGroupHalf}>
                <TextInput
                  style={styles.inputLight}
                  placeholder="No. WA / Telp..."
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={form.customerTelp}
                  onChangeText={t => setForm({...form, customerTelp: t})}
                />
              </View>
            </View>

            {/* SECTION 2: ALASAN LOST */}
            <Text style={styles.sectionLabel}>ALASAN LOST</Text>
            <View style={styles.chipsContainer}>
              {ALASAN_LIST.map(item => {
                const isSelected = form.alasan === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                      isSelected &&
                        item.id === 'Stok Kosong' &&
                        styles.chipStockKosong,
                    ]}
                    onPress={() => handleSelectAlasan(item.id)}>
                    <Icon
                      name={item.icon}
                      size={14}
                      color={item.color}
                      style={styles.chipIcon}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                      ]}>
                      {item.id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SECTION 3: PRODUK YANG DICARI */}
            <View style={styles.highlightBox}>
              <Text style={styles.sectionLabelYellow}>
                <Icon name="box" size={12} color="#F57C00" /> DETAIL PRODUK YANG
                DICARI
              </Text>

              <TextInput
                style={[styles.inputLight, styles.inputWhite]}
                placeholder="Contoh: Kaos Oversize, Jaket..."
                placeholderTextColor="#999"
                value={form.produkNama}
                onChangeText={t => setForm({...form, produkNama: t})}
              />

              <View style={[styles.inputRow, styles.inputRowTop]}>
                <View style={[styles.inputGroupHalf, styles.flex2]}>
                  <Text style={styles.miniLabel}>Ukuran</Text>
                  <TextInput
                    style={[styles.inputLight, styles.inputWhite]}
                    placeholder="M, L, 42, All Size..."
                    placeholderTextColor="#999"
                    value={form.ukuran}
                    onChangeText={t => setForm({...form, ukuran: t})}
                  />
                </View>
                <View style={styles.inputGroupHalf}>
                  <Text style={styles.miniLabel}>Total Qty</Text>
                  <TextInput
                    style={[styles.inputLight, styles.inputWhiteCenter]}
                    keyboardType="numeric"
                    value={form.qty}
                    onChangeText={t => setForm({...form, qty: t})}
                  />
                </View>
              </View>
            </View>

            {/* SECTION 4: CATATAN */}
            <Text style={styles.sectionLabel}>CATATAN DETAIL</Text>
            <TextInput
              style={[styles.inputLight, styles.inputArea]}
              placeholder="Keterangan tambahan..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
              value={form.catatan}
              onChangeText={t => setForm({...form, catatan: t})}
            />
          </ScrollView>

          {/* FOOTER ACTIONS */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={handleResetAndClose}>
              <Text style={styles.btnCancelText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSubmit}
              onPress={handleSave}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnSubmitText}>Konfirmasi Lost</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%', // Agar tidak menutupi seluruh layar
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconBg: {
    backgroundColor: '#FCE4EC',
    padding: 8,
    borderRadius: 12,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: '#757575',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 15,
  },
  miniLabel: {
    color: '#9E9E9E',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  sectionLabelYellow: {
    color: '#F57C00',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLight: {
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#333',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
  },
  inputArea: {
    height: 80,
    paddingTop: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipActive: {
    borderColor: '#1976D2',
    backgroundColor: '#E3F2FD',
  },
  chipText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#1976D2',
  },
  highlightBox: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFCA28',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    height: 50,
  },
  btnCancelText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 15,
  },
  btnSubmit: {
    flex: 1.5,
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
  },
  btnSubmitText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  chipStockKosong: {
    borderColor: '#FFA000',
    backgroundColor: '#FFF8E1',
  },

  chipIcon: {
    marginRight: 6,
  },

  inputWhite: {
    backgroundColor: '#FFF',
  },

  inputRowTop: {
    marginTop: 12,
  },

  flex2: {
    flex: 2,
  },

  flex1: {
    flex: 1,
  },

  inputWhiteCenter: {
    backgroundColor: '#FFF',
    textAlign: 'center',
  },
});

export default LostOrderWidget;
