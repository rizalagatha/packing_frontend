import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as DB from '../services/Database';

const PaymentPanel = ({total, onFinish, resetTrigger}) => {
  const [payAmount, setPayAmount] = useState('0');
  const [method, setMethod] = useState('CASH');
  const [change, setChange] = useState(0);
  const [rekeningList, setRekeningList] = useState([]);
  const [selectedRek, setSelectedRek] = useState(null);

  useEffect(() => {
    const paid = parseFloat(payAmount.replace(/,/g, '')) || 0;
    setChange(paid - total);
  }, [payAmount, total]);

  useEffect(() => {
    loadRekening();
  }, []);

  // Reset panel setiap kali transaksi baru dimulai (dipicu dari parent)
  useEffect(() => {
    setPayAmount('0');
    setMethod('CASH');
    setSelectedRek(null);
  }, [resetTrigger]);

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

  const formatNumber = num => new Intl.NumberFormat('id-ID').format(num);

  const submitPayment = () => {
    const paid = parseFloat(payAmount.replace(/,/g, '')) || 0;

    if (method === 'CASH' && paid < total) {
      return Alert.alert('Perhatian', 'Pembayaran tunai kurang!');
    }

    if (method === 'CARD') {
      if (!selectedRek) {
        return Alert.alert(
          'Perhatian',
          'Pilih Rekening/Mesin EDC terlebih dahulu!',
        );
      }
      if (paid !== total) {
        return Alert.alert(
          'Info',
          'Untuk pembayaran kartu, nominal harus pas dengan total tagihan.',
          [{text: 'Set Pas', onPress: () => setPayAmount(total.toString())}],
        );
      }
    }

    onFinish({
      total,
      bayar: paid,
      kembali: method === 'CASH' ? Math.max(0, change) : 0,
      metode: method,
      bank_card: selectedRek ? selectedRek.rek_nomor : '',
      bank_name: selectedRek ? selectedRek.rek_nama : '',
    });
  };

  return (
    <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
      <View style={styles.tabContainer}>
        {['CASH', 'CARD', 'VOUCHER'].map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => {
              setMethod(m);
              if (m === 'CARD') {
                setPayAmount(total.toString());
              }
            }}
            style={[styles.tab, method === m && styles.tabActive]}>
            <Text
              style={[styles.tabText, method === m && styles.tabTextActive]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {method === 'CARD' && (
        <View style={styles.bankSection}>
          <Text style={styles.sectionLabel}>
            Pilih Mesin EDC / Rekening Transfer:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                    selectedRek?.rek_nomor === rek.rek_nomor &&
                      styles.bankNameActive,
                  ]}>
                  {rek.rek_nama}
                </Text>
                <Text
                  style={[
                    styles.bankNumber,
                    selectedRek?.rek_nomor === rek.rek_nomor &&
                      styles.bankNumberActive,
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
        <Text style={styles.inputValue}>Rp {formatNumber(payAmount)}</Text>
      </View>

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
                    key === 'PAS' && styles.keyTextWhite,
                  ]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.summaryDivider} />

      {/* GRAND TOTAL — menyesuaikan, ditaruh di bawah area input pembayaran */}
      <View style={styles.grandTotalRow}>
        <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
        <Text style={styles.grandTotalValue}>Rp {formatNumber(total)}</Text>
      </View>

      <View style={styles.changeBox}>
        <Text style={styles.changeLabel}>Kembalian</Text>
        <Text
          style={[
            styles.changeValue,
            change < 0 ? styles.changeNegative : styles.changePositive,
          ]}>
          Rp {formatNumber(method === 'CASH' ? Math.max(0, change) : 0)}
        </Text>
      </View>

      <TouchableOpacity style={styles.btnDone} onPress={submitPayment}>
        <Text style={styles.btnDoneText}>KONFIRMASI PEMBAYARAN</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  panel: {flex: 1, padding: 16},
  tabContainer: {flexDirection: 'row', gap: 10, marginBottom: 16},
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
  },
  tabActive: {backgroundColor: '#C62828'},
  tabText: {fontWeight: 'bold', color: '#666'},
  tabTextActive: {color: '#fff'},

  bankSection: {marginBottom: 16},
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  bankCard: {
    width: 130,
    padding: 12,
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#FFC1E3',
  },
  bankCardActive: {backgroundColor: '#C62828', borderColor: '#B71C1C'},
  bankName: {fontSize: 13, fontWeight: 'bold', marginTop: 5, color: '#333'},
  bankNumber: {fontSize: 10, color: '#666'},
  bankNameActive: {color: '#fff'},
  bankNumberActive: {color: '#eee'},

  inputDisplay: {marginBottom: 12},
  inputLabel: {fontSize: 10, color: '#999', fontWeight: 'bold'},
  inputValue: {fontSize: 28, fontWeight: 'bold', color: '#333'},

  keypad: {marginBottom: 16},
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  key: {
    flex: 1,
    height: 52,
    backgroundColor: '#F8F9FA',
    marginHorizontal: 5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  keyPas: {backgroundColor: '#455A64'},
  keyText: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  keyTextWhite: {color: '#fff'},

  summaryDivider: {height: 1, backgroundColor: '#eee', marginBottom: 12},

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  grandTotalLabel: {fontSize: 13, color: '#666', fontWeight: 'bold'},
  grandTotalValue: {fontSize: 20, fontWeight: 'bold', color: '#C62828'},

  changeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  changeLabel: {fontSize: 13, fontWeight: 'bold', color: '#555'},
  changeValue: {fontSize: 17, fontWeight: 'bold'},
  changeNegative: {color: '#F44336'},
  changePositive: {color: '#2E7D32'},

  btnDone: {
    backgroundColor: '#4CAF50',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  btnDoneText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
});

export default PaymentPanel;
