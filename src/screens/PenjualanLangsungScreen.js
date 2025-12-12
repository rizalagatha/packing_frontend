import React, {useState, useContext, useRef, useMemo, useEffect} from 'react';
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
import StrukModal from '../components/StrukModal';
import {
  getDefaultCustomerApi,
  scanProdukPenjualanApi,
  savePenjualanApi,
  searchRekeningApi,
  getActivePromosApi, // -> Import Baru
  getPrintDataApi,
  sendStrukWaApi,
} from '../api/ApiService';
import SearchModal from '../components/SearchModal';
import Icon from 'react-native-vector-icons/Feather';
import Toast from 'react-native-toast-message';
import SoundPlayer from 'react-native-sound-player';

const PenjualanLangsungScreen = ({navigation}) => {
  const {userToken} = useContext(AuthContext);

  // State Data
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [scannedValue, setScannedValue] = useState('');
  const [activePromos, setActivePromos] = useState([]); // -> Daftar Promo Aktif

  // Payment State
  const [tunai, setTunai] = useState('');
  const [transfer, setTransfer] = useState('');
  const [bankAccount, setBankAccount] = useState(null);
  const [diskonFaktur, setDiskonFaktur] = useState(0); // -> State Diskon Global
  const [promoApplied, setPromoApplied] = useState(''); // -> Nama promo yang dipakai

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isRekeningModalVisible, setRekeningModalVisible] = useState(false);

  const [strukData, setStrukData] = useState(null);
  const [isStrukVisible, setStrukVisible] = useState(false);

  const scannerInputRef = useRef(null);

  // Hitung Total
  const totals = useMemo(() => {
    const subTotal = items.reduce(
      (sum, item) => sum + item.jumlah * item.harga,
      0,
    );
    const totalDiskonItem = items.reduce(
      (sum, item) => sum + item.jumlah * (item.diskonRp || 0),
      0,
    );
    const totalDiskonFaktur = diskonFaktur; // Ambil dari state

    return {
      subTotal,
      totalDiskon: totalDiskonItem,
      totalDiskonFaktur,
      grandTotal: subTotal - totalDiskonItem - totalDiskonFaktur,
    };
  }, [items, diskonFaktur]);

  const kembalian = useMemo(() => {
    const bayar = (parseInt(tunai) || 0) + (parseInt(transfer) || 0);
    return Math.max(bayar - totals.grandTotal, 0);
  }, [tunai, transfer, totals.grandTotal]);

  const playSound = type => {
    try {
      const soundName = type === 'success' ? 'beep_success' : 'beep_error';
      SoundPlayer.playSoundFile(soundName, 'mp3');
    } catch (e) {
      console.log('audio err');
    }
  };

  // 1. Load Default Customer & Active Promos
  useEffect(() => {
    const initData = async () => {
      try {
        // Load Customer
        const custRes = await getDefaultCustomerApi(userToken);
        if (custRes.data.data) setCustomer(custRes.data.data);

        // Load Promos
        const today = new Date().toISOString().split('T')[0];
        const promoRes = await getActivePromosApi({tanggal: today}, userToken);
        setActivePromos(promoRes.data.data || []);
      } catch (error) {
        console.log('Init data failed', error);
      }
    };
    initData();
  }, [userToken]);

  // 2. Logic Scan
  const handleScan = async () => {
    if (!scannedValue) return;
    const barcode = scannedValue;
    setScannedValue('');

    const existingIndex = items.findIndex(i => i.barcode === barcode);
    if (existingIndex > -1) {
      setItems(prev => {
        const newItems = [...prev];
        newItems[existingIndex].jumlah += 1;
        return newItems;
      });
      playSound('success');
    } else {
      setIsLoading(true);
      try {
        const response = await scanProdukPenjualanApi(barcode, userToken);
        const product = response.data.data;
        const finalPrice = Number(product.harga || 0);

        const newItem = {
          kode: product.kode,
          nama: product.nama,
          ukuran: product.ukuran,
          barcode: product.barcode,
          harga: finalPrice,
          jumlah: 1,
          diskonRp: 0,
          stok: product.stok,
          kategori: product.kategori || '', // Penting untuk cek promo
        };

        setItems(prev => [newItem, ...prev]);
        playSound('success');
      } catch (error) {
        playSound('error');
        Toast.show({
          type: 'error',
          text1: 'Gagal',
          text2: 'Barcode tidak ditemukan',
        });
      } finally {
        setIsLoading(false);
      }
    }
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleQtyChange = (index, delta) => {
    setItems(prev =>
      prev
        .map((item, i) => {
          if (i === index) {
            const newQty = Math.max(0, item.jumlah + delta);
            return {...item, jumlah: newQty};
          }
          return item;
        })
        .filter(item => item.jumlah > 0),
    );
  };

  const onRekeningSelected = rekening => {
    setBankAccount(rekening);
    setRekeningModalVisible(false);
  };

  // --- LOGIKA CEK PROMO ---
  const checkPromoAndPay = () => {
    if (items.length === 0)
      return Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Belum ada barang.',
      });

    let potentialDiscount = 0;
    let appliedPromoName = '';

    // Cari promo 010 (Kelipatan 250rb)
    const promo010 = activePromos.find(p => p.pro_nomor === 'PRO-2025-010');

    // Cari promo 008 (Fallback)
    const promo008 = activePromos.find(p => p.pro_nomor === 'PRO-2025-008');

    // Hitung Total Barang REGULER (Exclude Jersey)
    const totalReguler = items.reduce((sum, item) => {
      if (
        item.kategori === 'REGULER' &&
        !item.nama.toUpperCase().includes('JERSEY')
      ) {
        return sum + item.jumlah * item.harga;
      }
      return sum;
    }, 0);

    // Hitung Total Belanja Semua Barang
    const totalBelanja = items.reduce(
      (sum, item) => sum + item.jumlah * item.harga,
      0,
    );

    // --- CEK SYARAT ---
    if (promo010 && totalReguler >= 250000) {
      const kelipatan = Math.floor(totalReguler / 250000);
      potentialDiscount = 25000 * kelipatan;
      appliedPromoName = 'PROMO KELIPATAN 25K';
    } else if (promo008 && totalBelanja >= promo008.pro_totalrp) {
      // Fallback ke promo 008 jika ada
      const kelipatan = Math.floor(totalBelanja / promo008.pro_totalrp);
      potentialDiscount = promo008.pro_disrp * kelipatan;
      appliedPromoName = promo008.pro_judul;
    }

    // --- KONFIRMASI KE USER ---
    if (potentialDiscount > 0) {
      Alert.alert(
        '🎉 Promo Tersedia!',
        `Anda berhak mendapatkan potongan Rp ${potentialDiscount.toLocaleString(
          'id-ID',
        )} (${appliedPromoName}).\n\nGunakan promo ini?`,
        [
          {
            text: 'Tidak',
            onPress: () => {
              setDiskonFaktur(0);
              setPromoApplied('');
              setShowPaymentModal(true);
            },
            style: 'cancel',
          },
          {
            text: 'Ya, Gunakan',
            onPress: () => {
              setDiskonFaktur(potentialDiscount);
              setPromoApplied(appliedPromoName);
              setShowPaymentModal(true);
            },
          },
        ],
      );
    } else {
      // Tidak ada promo, langsung bayar
      setDiskonFaktur(0);
      setPromoApplied('');
      setShowPaymentModal(true);
    }
  };

  // 4. Simpan Transaksi
  const handleSave = async () => {
    if (!customer)
      return Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Customer belum dipilih.',
      });

    const nilaiTransfer = parseInt(transfer) || 0;
    const bayar = (parseInt(tunai) || 0) + nilaiTransfer;

    if (bayar < totals.grandTotal) {
      return Toast.show({
        type: 'error',
        text1: 'Kurang Bayar',
        text2: 'Pembayaran kurang dari total tagihan.',
      });
    }

    if (nilaiTransfer > 0 && !bankAccount) {
      return Toast.show({
        type: 'error',
        text1: 'Bank Kosong',
        text2: 'Pilih Akun Bank untuk transfer.',
      });
    }

    setIsSaving(true);
    try {
      const payload = {
        header: {
          tanggal: new Date().toISOString().split('T')[0],
          customer: customer,
          keterangan: 'Penjualan Mobile',
        },
        items: items,
        payment: {
          tunai: parseInt(tunai) || 0,
          transfer: {
            nominal: nilaiTransfer,
            akun: bankAccount
              ? {
                  kode: bankAccount.kode,
                  nama: bankAccount.nama,
                  rekening: bankAccount.rekening,
                }
              : null,
          },
        },
        totals: totals,
      };

      const response = await savePenjualanApi(payload, userToken);
      Toast.show({
        type: 'success',
        text1: 'Berhasil',
        text2: response.data.message,
      });

      // --- HAPUS/KOMENTARI BARIS INI ---
      // navigation.goBack();
      // --------------------------------

      // Tutup modal pembayaran
      setShowPaymentModal(false);

      // Langsung tampilkan struk
      // Pastikan respon backend benar struktur datanya
      await handleShowStruk(response.data.data.nomor);

      // Reset form (opsional, agar bersih di belakang layar)
      setItems([]);
      setTunai('');
      setTransfer('');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'Gagal menyimpan transaksi.',
      });
    } finally {
      setIsSaving(false);
      // setShowPaymentModal(false); // Jangan taruh di sini, biar transisi lebih mulus di try block
    }
  };

  const handleShowStruk = async nomorInv => {
    setIsLoading(true);
    try {
      const response = await getPrintDataApi(nomorInv, userToken);
      setStrukData(response.data.data);
      setStrukVisible(true);
    } catch (error) {
      Toast.show({type: 'error', text1: 'Gagal', text2: 'Gagal memuat struk.'});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendWa = async () => {
    if (!strukData?.header?.inv_mem_hp && !customer?.telp) {
      return Toast.show({
        type: 'error',
        text1: 'Gagal',
        text2: 'No HP tidak tersedia.',
      });
    }

    // Prioritas: HP Member -> HP Customer
    const targetHp = strukData.header.inv_mem_hp || customer.telp;

    try {
      await sendStrukWaApi(
        {
          nomor: strukData.header.inv_nomor,
          hp: targetHp,
        },
        userToken,
      );
      Toast.show({
        type: 'success',
        text1: 'Terkirim',
        text2: 'Struk dikirim ke WA.',
      });
    } catch (error) {
      Toast.show({type: 'error', text1: 'Gagal', text2: 'Gagal mengirim WA.'});
    }
  };

  const renderItem = ({item, index}) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.nama}
        </Text>
        <Text style={styles.itemDetails}>
          {item.ukuran} | @{item.harga.toLocaleString('id-ID')} | Stok:{' '}
          {item.stok}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.totalItem}>
          Rp {(item.harga * item.jumlah).toLocaleString('id-ID')}
        </Text>
        <View style={styles.qtyControl}>
          <TouchableOpacity
            onPress={() => handleQtyChange(index, -1)}
            style={styles.qtyBtn}>
            <Icon name="minus" size={16} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.jumlah}</Text>
          <TouchableOpacity
            onPress={() => handleQtyChange(index, 1)}
            style={styles.qtyBtn}>
            <Icon name="plus" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal Pencarian Rekening */}
      <SearchModal
        visible={isRekeningModalVisible}
        onClose={() => setRekeningModalVisible(false)}
        onSelect={onRekeningSelected}
        title="Pilih Bank"
        apiSearchFunction={params => searchRekeningApi(params, userToken)}
        keyField="kode"
        renderListItem={item => (
          <View>
            <Text style={{fontWeight: 'bold', color: '#333'}}>{item.nama}</Text>
            <Text style={{fontSize: 12, color: '#666'}}>
              {item.rekening} ({item.kode})
            </Text>
          </View>
        )}
      />

      {/* Header: Customer & Scan */}
      <View style={styles.header}>
        <View style={styles.customerBox}>
          <Icon name="user" size={18} color="#555" />
          <Text style={styles.customerName}>
            {customer ? customer.nama : 'Memuat Customer...'}
          </Text>
        </View>
        <View style={styles.scanBox}>
          <Icon
            name="maximize"
            size={20}
            color="#888"
            style={{marginLeft: 10}}
          />
          <TextInput
            ref={scannerInputRef}
            style={styles.scanInput}
            placeholder="Scan Barcode Barang..."
            value={scannedValue}
            onChangeText={setScannedValue}
            onSubmitEditing={handleScan}
            blurOnSubmit={false}
            autoFocus
          />
          {isLoading && (
            <ActivityIndicator
              size="small"
              color="blue"
              style={{marginRight: 10}}
            />
          )}
        </View>
      </View>

      {/* List Barang */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, idx) => `${item.kode}-${idx}`}
        contentContainerStyle={{paddingBottom: 100}}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada barang discan.</Text>
        }
      />

      {/* Footer Total & Button */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Sub Total:</Text>
          <Text style={styles.totalValue}>
            Rp {totals.subTotal.toLocaleString('id-ID')}
          </Text>
        </View>
        {/* Tampilkan Info Diskon jika ada */}
        {diskonFaktur > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, {color: '#D32F2F'}]}>
              Diskon Promo:
            </Text>
            <Text style={[styles.totalValue, {color: '#D32F2F'}]}>
              - Rp {diskonFaktur.toLocaleString('id-ID')}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.payButton, items.length === 0 && styles.disabledBtn]}
          // UBAH: Panggil checkPromoAndPay alih-alih langsung setShowPaymentModal
          onPress={() => items.length > 0 && checkPromoAndPay()}
          disabled={items.length === 0}>
          <Text style={styles.payBtnText}>BAYAR SEKARANG</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Pembayaran */}
      {showPaymentModal && (
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pembayaran</Text>

            {/* Tampilkan Tagihan Bersih (Grand Total) */}
            <Text style={styles.modalTotal}>
              Rp {totals.grandTotal.toLocaleString('id-ID')}
            </Text>
            {promoApplied ? (
              <Text style={styles.promoBadge}>{promoApplied}</Text>
            ) : null}

            <Text style={styles.inputLabel}>Tunai (Cash)</Text>
            <TextInput
              style={styles.moneyInput}
              keyboardType="number-pad"
              placeholder="0"
              value={tunai}
              onChangeText={setTunai}
            />

            <Text style={styles.inputLabel}>Transfer (Opsional)</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
              <TextInput
                style={[styles.moneyInput, {flex: 1}]}
                keyboardType="number-pad"
                placeholder="0"
                value={transfer}
                onChangeText={setTransfer}
              />
              <TouchableOpacity
                style={styles.bankButton}
                onPress={() => setRekeningModalVisible(true)}>
                <Icon name="credit-card" size={20} color="#555" />
                <Text style={styles.bankButtonText} numberOfLines={1}>
                  {bankAccount ? bankAccount.nama : 'Pilih Bank'}
                </Text>
              </TouchableOpacity>
            </View>
            {bankAccount && (
              <Text style={styles.bankDetail}>{bankAccount.rekening}</Text>
            )}

            <View style={styles.kembalianBox}>
              <Text style={styles.kembalianLabel}>Kembali:</Text>
              <Text
                style={[
                  styles.kembalianValue,
                  kembalian < 0 && {color: 'red'},
                ]}>
                Rp {kembalian.toLocaleString('id-ID')}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, isSaving && {opacity: 0.7}]}
                onPress={handleSave}
                disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmText}>SELESAI</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
      <StrukModal
        visible={isStrukVisible}
        onClose={() => {
          setStrukVisible(false);
          navigation.goBack(); // Kembali setelah lihat struk
        }}
        data={strukData}
        onPrint={() => {
          // Logika print (bisa pakai react-native-print atau library termal)
          // Untuk sekarang bisa Toast dulu
          Toast.show({
            type: 'info',
            text1: 'Info',
            text2: 'Fitur Print Bluetooth belum dikonfigurasi',
          });
        }}
        onSendWa={handleSendWa}
      />
    </SafeAreaView>
  );
};

// ... Styles (Copy paste bagian bawah ini saja untuk update style promo)
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F2F2F2'},
  header: {backgroundColor: '#fff', padding: 15, elevation: 2},
  customerBox: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  customerName: {
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  scanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    height: 45,
  },
  scanInput: {flex: 1, paddingHorizontal: 10, fontSize: 16, color: '#333'},

  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  itemInfo: {flex: 1},
  itemName: {fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4},
  itemDetails: {fontSize: 12, color: '#777'},
  itemRight: {alignItems: 'flex-end', justifyContent: 'space-between'},
  totalItem: {fontWeight: 'bold', fontSize: 14, color: '#2E7D32'},
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    backgroundColor: '#eee',
    borderRadius: 20,
  },
  qtyBtn: {backgroundColor: '#1976D2', padding: 5, borderRadius: 20},
  qtyText: {
    marginHorizontal: 10,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'center',
  },

  footer: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  }, // Margin diperkecil utk muat diskon
  totalLabel: {fontSize: 16, color: '#555'},
  totalValue: {fontSize: 20, fontWeight: 'bold', color: '#333'},
  payButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledBtn: {backgroundColor: '#aaa'},
  payBtnText: {color: '#fff', fontWeight: 'bold', fontSize: 16},
  emptyText: {textAlign: 'center', marginTop: 50, color: '#999'},

  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  modalTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2E7D32',
    marginBottom: 5,
  },

  // Style Badge Promo
  promoBadge: {
    alignSelf: 'center',
    backgroundColor: '#FFEBEE',
    color: '#D32F2F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  inputLabel: {fontSize: 14, color: '#555', marginBottom: 5},
  moneyInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'right',
    color: '#333',
    height: 50,
  },
  bankButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: '#f9f9f9',
  },
  bankButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  bankDetail: {
    fontSize: 13,
    color: '#1976D2',
    textAlign: 'right',
    marginTop: -10,
    marginBottom: 15,
    marginRight: 5,
    fontWeight: '500',
  },
  kembalianBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingTop: 15,
  },
  kembalianLabel: {fontSize: 16, fontWeight: 'bold', color: '#555'},
  kembalianValue: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  modalActions: {flexDirection: 'row', marginTop: 25, gap: 10},
  cancelBtn: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#eee',
    borderRadius: 8,
  },
  confirmBtn: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  cancelText: {color: '#333', fontWeight: 'bold'},
  confirmText: {color: '#fff', fontWeight: 'bold'},
});

export default PenjualanLangsungScreen;
