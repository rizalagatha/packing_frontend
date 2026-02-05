import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as DB from '../services/Database'; // Pastikan import DB sudah benar

const PaymentModal = ({visible, total, onClose, onFinish}) => {
  const [payAmount, setPayAmount] = useState('0');
  const [method, setMethod] = useState('CASH'); // CASH, CARD, VOUCHER
  const [change, setChange] = useState(0);
  const [rekeningList, setRekeningList] = useState([]);
  const [selectedRek, setSelectedRek] = useState(null);

  useEffect(() => {
    const paid = parseFloat(payAmount.replace(/,/g, '')) || 0;
    setChange(paid - total);
  }, [payAmount, total]);

  // Load daftar rekening saat modal terbuka
  useEffect(() => {
    if (visible) {
      loadRekening();
      // Reset pilihan saat buka modal
      setPayAmount('0');
      setMethod('CASH');
      setSelectedRek(null);
    }
  }, [visible]);

  const loadRekening = async () => {
    try {
      const list = await DB.getMasterRekening();
      setRekeningList(list);
    } catch (e) {
      console.error('Gagal load rekening', e);
    }
  };

  const handleKeyPress = val => {
    if (val === 'C') {
      setPayAmount('0');
    } else if (val === 'PAS') {
      setPayAmount(total.toString());
    } else {
      setPayAmount(prev => {
        const current = prev === '0' ? '' : prev;
        return current + val;
      });
    }
  };

  const formatNumber = num => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const submitPayment = () => {
    const paid = parseFloat(payAmount.replace(/,/g, '')) || 0;

    // Validasi Tunai
    if (method === 'CASH' && paid < total) {
      return Alert.alert('Perhatian', 'Pembayaran tunai kurang!');
    }

    // Validasi Card (Wajib pilih Bank)
    if (method === 'CARD') {
      if (!selectedRek) {
        return Alert.alert(
          'Perhatian',
          'Pilih Rekening/Mesin EDC terlebih dahulu!',
        );
      }
      // Jika Card, biasanya bayar pas, otomatis set payAmount ke total
      if (paid !== total) {
        return Alert.alert(
          'Info',
          'Untuk pembayaran kartu, nominal harus pas dengan total tagihan.',
          [{text: 'Set Pas', onPress: () => setPayAmount(total.toString())}],
        );
      }
    }

    onFinish({
      total: total,
      bayar: paid,
      kembali: method === 'CASH' ? Math.max(0, change) : 0,
      metode: method,
      bank_card: selectedRek ? selectedRek.rek_nomor : '', // inv_nocard
      bank_name: selectedRek ? selectedRek.rek_nama : '', // inv_namabank
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pembayaran</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView bounces={false}>
            <View style={styles.summaryBox}>
              <Text style={styles.label}>Total Tagihan</Text>
              <Text style={styles.totalValue}>Rp {formatNumber(total)}</Text>
            </View>

            <View style={styles.tabContainer}>
              {['CASH', 'CARD', 'VOUCHER'].map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    setMethod(m);
                    if (m === 'CARD') setPayAmount(total.toString());
                  }}
                  style={[styles.tab, method === m && styles.tabActive]}>
                  <Text
                    style={[
                      styles.tabText,
                      method === m && styles.tabTextActive,
                    ]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SELEKSI BANK JIKA METHOD CARD */}
            {method === 'CARD' && (
              <View style={styles.bankSection}>
                <Text style={styles.sectionLabel}>
                  Pilih Mesin EDC / Rekening Transfer:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.bankList}>
                  {rekeningList.map(rek => (
                    <TouchableOpacity
                      key={rek.rek_nomor}
                      onPress={() => setSelectedRek(rek)}
                      style={[
                        styles.bankCard,
                        selectedRek?.rek_nomor === rek.rek_nomor &&
                          styles.bankCardActive,
                      ]}>
                      <Icon
                        name="credit-card"
                        size={16}
                        color={
                          selectedRek?.rek_nomor === rek.rek_nomor
                            ? '#fff'
                            : '#E91E63'
                        }
                      />
                      <Text
                        style={[
                          styles.bankName,
                          selectedRek?.rek_nomor === rek.rek_nomor && {
                            color: '#fff',
                          },
                        ]}>
                        {rek.rek_nama}
                      </Text>
                      <Text
                        style={[
                          styles.bankNumber,
                          selectedRek?.rek_nomor === rek.rek_nomor && {
                            color: '#eee',
                          },
                        ]}>
                        {rek.rek_nomor}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputDisplay}>
              <Text style={styles.inputLabel}>Diterima ({method})</Text>
              <Text style={styles.inputValue}>
                Rp {formatNumber(payAmount)}
              </Text>
            </View>

            {/* Keypad disembunyikan jika CARD (karena biasanya pas) kecuali mau diedit */}
            <View style={styles.keypad}>
              {[
                ['7', '8', '9'],
                ['4', '5', '6'],
                ['1', '2', '3'],
                ['C', '0', 'PAS'],
              ].map((row, i) => (
                <View key={i} style={styles.keyRow}>
                  {row.map(key => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.key, key === 'PAS' && styles.keyPas]}
                      onPress={() => handleKeyPress(key)}>
                      <Text
                        style={[
                          styles.keyText,
                          key === 'PAS' && {color: '#fff'},
                        ]}>
                        {key}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.changeBox}>
              <Text style={styles.changeLabel}>Kembalian</Text>
              <Text
                style={[
                  styles.changeValue,
                  {color: change < 0 ? '#F44336' : '#2E7D32'},
                ]}>
                Rp {formatNumber(method === 'CASH' ? Math.max(0, change) : 0)}
              </Text>
            </View>

            <TouchableOpacity style={styles.btnDone} onPress={submitPayment}>
              <Text style={styles.btnDoneText}>KONFIRMASI PEMBAYARAN</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  summaryBox: {padding: 15, backgroundColor: '#F8F9FA', alignItems: 'center'},
  label: {fontSize: 11, color: '#666', marginBottom: 5},
  totalValue: {fontSize: 28, fontWeight: 'bold', color: '#E91E63'},
  tabContainer: {flexDirection: 'row', padding: 15, gap: 10},
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
  },
  tabActive: {backgroundColor: '#E91E63'},
  tabText: {fontWeight: 'bold', color: '#666'},
  tabTextActive: {color: '#fff'},

  // Bank Section
  bankSection: {paddingHorizontal: 20, marginBottom: 15},
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  bankList: {flexDirection: 'row'},
  bankCard: {
    width: 130,
    padding: 12,
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#FFC1E3',
  },
  bankCardActive: {backgroundColor: '#E91E63', borderColor: '#C2185B'},
  bankName: {fontSize: 13, fontWeight: 'bold', marginTop: 5, color: '#333'},
  bankNumber: {fontSize: 10, color: '#666'},

  inputDisplay: {paddingHorizontal: 20, marginBottom: 10},
  inputLabel: {fontSize: 10, color: '#999', fontWeight: 'bold'},
  inputValue: {fontSize: 24, fontWeight: 'bold', color: '#333'},
  keypad: {paddingHorizontal: 10},
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 50,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  keyPas: {backgroundColor: '#455A64'},
  keyText: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  changeBox: {padding: 15, alignItems: 'center'},
  changeLabel: {fontSize: 11, color: '#999', fontWeight: 'bold'},
  changeValue: {fontSize: 20, fontWeight: 'bold'},
  btnDone: {
    backgroundColor: '#4CAF50',
    marginHorizontal: 20,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDoneText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
});

export default PaymentModal;
