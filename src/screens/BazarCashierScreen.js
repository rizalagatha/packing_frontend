import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  Vibration,
  Platform,
} from 'react-native';
import * as DB from '../services/Database';
import {getHargaEcerAsli} from '../services/Database';
import Icon from 'react-native-vector-icons/Feather';
import {AuthContext} from '../context/AuthContext';
import PaymentModal from '../components/PaymentModal';
import StrukModal from '../components/StrukModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SoundPlayer from 'react-native-sound-player';
import DeviceInfo from 'react-native-device-info';

const BazarCashierScreen = ({navigation, route}) => {
  const {userInfo} = useContext(AuthContext);
  const [cart, setCart] = useState([]);
  const [scanInput, setScanInput] = useState('');

  const [deviceSuffix, setDeviceSuffix] = useState('');

  // State customer awalnya kosong, akan diisi oleh useEffect
  const [customer, setCustomer] = useState({kode: '-', nama: 'Memuat...'});
  const [isPaymentVisible, setIsPaymentVisible] = useState(false);
  const [isStrukVisible, setIsStrukVisible] = useState(false);
  const [lastTransactionData, setLastTransactionData] = useState(null);
  const [operator, setOperator] = useState('');

  const scanInputRef = useRef(null);

  useEffect(() => {
    const initDevice = async () => {
      const deviceId = await DeviceInfo.getUniqueId();
      setDeviceSuffix(deviceId.substring(0, 5).toLowerCase());
    };
    initDevice();
  }, []);

  // --- LOGIKA 1: SET DEFAULT CUSTOMER SESUAI CABANG ---
  useEffect(() => {
    const setDefaultCustomer = async () => {
      if (userInfo?.cabang) {
        // Cari di DB lokal customer yang cus_cab-nya sama dengan user login
        const defaultCus = await DB.getDefaultCustomerByCabang(userInfo.cabang);

        if (defaultCus) {
          setCustomer(defaultCus);
        } else {
          // Fallback jika tidak ditemukan (misal data belum download)
          setCustomer({
            kode: `${userInfo.cabang}00000`,
            nama: `BAZAR ${userInfo.nama_cabang || userInfo.cabang}`,
          });
        }
      }
    };

    setDefaultCustomer();
  }, [userInfo]);

  // --- LOGIKA 2: TANGKAP CUSTOMER YANG DIPILIH DARI LIST ---
  useEffect(() => {
    if (route.params?.selectedCustomer) {
      setCustomer(route.params.selectedCustomer);
    }
  }, [route.params?.selectedCustomer]);

  useEffect(() => {
    if (route.params?.selectedProduct) {
      const product = route.params.selectedProduct;

      processAddToCart(product, 1);
      playSound('success');
      Vibration.vibrate(100);

      // Sekarang navigation aman dimasukkan ke dependency
      navigation.setParams({selectedProduct: null});
    }
  }, [route.params?.selectedProduct, navigation, playSound, processAddToCart]);

  const totalBelanja = cart.reduce(
    (sum, item) => sum + item.harga * item.qty,
    0,
  );

  // 1. Load nama operator saat layar dibuka
  useEffect(() => {
    const loadOperator = async () => {
      const saved = await AsyncStorage.getItem('@bazar_operator');
      if (saved) {
        setOperator(saved);
      } else if (userInfo?.nama_lengkap) {
        // Jika belum pernah simpan, default ambil dari nama profil login
        setOperator(userInfo.nama_lengkap);
      }
    };
    loadOperator();
  }, [userInfo]);

  const handleOperatorChange = async text => {
    setOperator(text);
    await AsyncStorage.setItem('@bazar_operator', text);
  };

  const playSound = useCallback(
    type => {
      try {
        if (type === 'success') {
          const customSound = `beep_success_${deviceSuffix}`;
          try {
            SoundPlayer.playSoundFile(customSound, 'mp3');
          } catch (innerError) {
            SoundPlayer.playSoundFile('beep_success', 'mp3');
          }
        } else {
          SoundPlayer.playSoundFile('beep_error', 'mp3');
        }
      } catch (e) {
        console.log(`Tidak bisa memutar suara`, e);
      }
    },
    [deviceSuffix],
  );

  const handleScan = async () => {
    if (!scanInput) return;
    let qty = 1;
    let barcode = scanInput.trim().toUpperCase();

    if (barcode.includes('*')) {
      const parts = barcode.split('*');
      qty = parseFloat(parts[0]) || 1;
      barcode = parts[1];
    }

    console.log('--- 🔍 START SCAN ---');
    console.log('Input Barcode:', barcode);

    const product = await DB.getBarangBazarByBarcode(barcode);
    if (product) {
      console.log('📦 Product Found in DB:', JSON.stringify(product, null, 2));
      // Cek apakah produk butuh input harga manual (bukan bundling)
      // Produk bundling (promo_qty > 1) biasanya sudah punya harga dasar di Excel
      if (product.harga_jual <= 1 && product.promo_qty <= 1) {
        console.log('⚠️ Warning: Product has no price, showing prompt');
        Alert.prompt(
          'Harga Manual',
          `Masukkan harga untuk ${product.nama}:`,
          val => {
            const finalPrice = parseFloat(val) || 1;
            processAddToCart(product, qty, finalPrice); // Kirim harga manual
            playSound('success');
            Vibration.vibrate(100);
          },
          'plain-text',
          '',
          'number-pad',
        );
      } else {
        console.log('❌ Error: Barcode NOT FOUND in local DB');
        // Untuk bundling, biarkan sistem yang menghitung harganya nanti
        processAddToCart(product, qty);
        playSound('success');
        Vibration.vibrate(100);
      }
    } else {
      playSound('error');
      Vibration.vibrate([0, 500]);
      Alert.alert('Gagal', 'Barang tidak ditemukan');
    }
    setScanInput('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const refreshCartPrices = useCallback(currentCart => {
    return currentCart.map(item => {
      const newPrice = DB.getDynamicPrice(item, currentCart);
      return {...item, harga: newPrice};
    });
  }, []);

  const processAddToCart = useCallback(
    (product, qty, manualPrice = null) => {
      setCart(prev => {
        let newCart;
        const existing = prev.find(it => it.barcode === product.barcode);

        // Tentukan harga awal: Prioritas Spesial -> Jual -> Manual
        const initialPrice =
          manualPrice ||
          (product.harga_spesial > 0
            ? product.harga_spesial
            : product.harga_jual);

        if (existing) {
          newCart = prev.map(it =>
            it.barcode === product.barcode
              ? {...it, qty: it.qty + qty, harga: initialPrice}
              : it,
          );
        } else {
          newCart = [
            ...prev,
            {
              ...product,
              qty,
              harga: initialPrice,
              unit: 'PCS',
            },
          ];
        }
        return refreshCartPrices(newCart);
      });
    },
    [refreshCartPrices],
  );

  const updateItemQty = useCallback(
    (barcode, delta) => {
      setCart(prev => {
        const newCart = prev.map(item => {
          if (item.barcode === barcode) {
            // Jangan biarkan qty kurang dari 1 (atau hapus jika mau 0)
            const nextQty = item.qty + delta;
            return nextQty > 0 ? {...item, qty: nextQty} : item;
          }
          return item;
        });

        // Selalu hitung ulang harga bundling setiap kali qty berubah
        return refreshCartPrices(newCart);
      });
    },
    [refreshCartPrices],
  );

  // const handleEditItem = item => {
  //   Alert.alert('Opsi Barang', `${item.nama}`, [
  //     {text: 'Ubah Harga', onPress: () => promptChangePrice(item)},
  //     {text: 'Set LSN', onPress: () => updateItemUnit(item, 'LSN')},
  //     {text: 'Set CRT', onPress: () => updateItemUnit(item, 'CRT')},
  //     {
  //       text: 'Hapus',
  //       style: 'destructive',
  //       onPress: () => removeItem(item.barcode),
  //     },
  //     {text: 'Batal', style: 'cancel'},
  //   ]);
  // };

  // const promptChangePrice = item => {
  //   Alert.prompt(
  //     'Ubah Harga',
  //     `Harga baru untuk ${item.unit}:`,
  //     val => {
  //       const newPrice = parseFloat(val) || item.harga;
  //       setCart(prev =>
  //         prev.map(it =>
  //           it.barcode === item.barcode ? {...it, harga: newPrice} : it,
  //         ),
  //       );
  //     },
  //     'plain-text',
  //     item.harga.toString(),
  //     'number-pad',
  //   );
  // };

  // const updateItemUnit = (item, newUnit) => {
  //   setCart(prev =>
  //     prev.map(it =>
  //       it.barcode === item.barcode ? {...it, unit: newUnit} : it,
  //     ),
  //   );
  // };

  const removeItem = barcode =>
    setCart(cart.filter(it => it.barcode !== barcode));

  const resetCashier = () => {
    setCart([]);
    // Balikkan ke default cabang, jangan ke UMUM
    const defaultKode = `${userInfo?.cabang || ''}00000`;
    let defaultNama = `BAZAR ${
      userInfo?.nama_cabang || userInfo?.cabang || ''
    }`;
    if (userInfo?.cabang === 'B01') defaultNama = 'BAZAR SOLO';

    setCustomer({kode: defaultKode, nama: defaultNama});
    setIsPaymentVisible(false);
    setIsStrukVisible(false);
    setLastTransactionData(null);
  };

  const handleFinishPayment = async paymentData => {
    // Validasi Operator wajib isi
    if (!operator.trim()) {
      return Alert.alert('Perhatian', 'Nama/ID Operator harus diisi!');
    }

    // Validasi: Pastikan kode kasir (ID) tersedia dari login
    const kodeKasir = userInfo?.user_kodekasir || '000';

    try {
      // 3. Gunakan format baru: CABANG, OPERATOR
      const receiptNo = await DB.getNextBazarReceiptNumber(
        userInfo.cabang,
        kodeKasir,
      );

      const header = {
        so_nomor: receiptNo,
        so_tanggal: new Date().toISOString(),
        so_customer: customer.kode,
        cus_nama: customer.nama,
        so_total: totalBelanja,
        so_hemat: totalHemat,
        so_bayar: paymentData.bayar,
        so_cash: paymentData.metode === 'CASH' ? paymentData.bayar : 0,
        so_card: paymentData.metode === 'CARD' ? paymentData.bayar : 0,
        so_voucher: paymentData.metode === 'VOUCHER' ? paymentData.bayar : 0,
        so_kembali: paymentData.kembali,

        // Data Bank/EDC dari PaymentModal
        so_bank_card: paymentData.bank_card, // ID Rekening (rek_rekening)
        so_bank_name: paymentData.bank_name, // Nama Bank (untuk struk)

        // IDENTITAS USER
        so_user_kasir: kodeKasir, // ID Angka (906) -> untuk Database Server
        so_user_nama: operator.trim(), // Nama (RIZAL) -> untuk Struk
      };

      await DB.saveBazarTransaction(header, cart);
      setLastTransactionData({header, details: cart});
      setIsPaymentVisible(false);
      setIsStrukVisible(true);
      Vibration.vibrate(200);
    } catch (error) {
      console.error(error);
      Alert.alert('Eror', 'Gagal menyimpan transaksi.');
    }
  };

  const subTotalEcer = cart.reduce(
    (sum, item) => sum + getHargaEcerAsli(item) * item.qty,
    0,
  );

  const grandTotal = cart.reduce((sum, item) => sum + item.harga * item.qty, 0);

  const totalHemat = subTotalEcer - grandTotal;

  const renderItem = ({item}) => {
    const hargaEcer = getHargaEcerAsli(item);
    const isPromoActive =
      (item.promo_qty > 1 &&
        cart
          .filter(it => it.keterangan === item.keterangan)
          .reduce((s, i) => s + i.qty, 0) >= item.promo_qty) ||
      item.keterangan?.includes('25%');

    return (
      <View style={[styles.cartItem, isPromoActive && styles.cartItemPromo]}>
        {/* KOLOM KIRI: INFO BARANG */}
        <View style={styles.leftInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.nama}
          </Text>
          <View style={styles.detailRow}>
            <View style={styles.sizeBadge}>
              <Text style={styles.sizeText}>{item.ukuran || '-'}</Text>
            </View>
            <View
              style={[
                styles.boxLabel,
                isPromoActive ? styles.boxLabelActive : {},
              ]}>
              <Text
                style={[styles.boxText, isPromoActive ? {color: '#fff'} : {}]}>
                {item.keterangan || 'UMUM'}
              </Text>
            </View>
          </View>
          <Text style={styles.itemSub}>
            Ecer: Rp {hargaEcer.toLocaleString()}
          </Text>
        </View>

        {/* KOLOM KANAN: HARGA, QTY, & HAPUS */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            onPress={() => removeItem(item.barcode)}
            style={styles.btnTrashTop}>
            <Icon name="trash-2" size={14} color="#FF5252" />
          </TouchableOpacity>

          <Text style={[styles.itemTotal, isPromoActive && styles.textPromo]}>
            Rp {(item.qty * hargaEcer).toLocaleString()}
          </Text>

          <View style={styles.qtyContainer}>
            <TouchableOpacity
              onPress={() => updateItemQty(item.barcode, -1)}
              style={styles.qtyControl}>
              <Icon name="minus-circle" size={20} color="#E91E63" />
            </TouchableOpacity>

            <Text style={styles.qtyText}>{item.qty}</Text>

            <TouchableOpacity
              onPress={() => updateItemQty(item.barcode, 1)}
              style={styles.qtyControl}>
              <Icon name="plus-circle" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* CUSTOMER BAR - LEBIH CLEAN */}
      <TouchableOpacity
        style={styles.customerBar}
        onPress={() => navigation.navigate('BazarCustomerList')}>
        <View style={styles.iconCircle}>
          <Icon name="user" size={16} color="#E91E63" />
        </View>
        <View style={{flex: 1, marginLeft: 10}}>
          <Text style={styles.customerLabel}>PELANGGAN</Text>
          <Text style={styles.customerText}>{customer.nama}</Text>
          <Text style={styles.customerSubText}>{customer.kode}</Text>
        </View>
        <Icon name="chevron-right" size={20} color="#C2185B" />
      </TouchableOpacity>

      <View style={styles.inputArea}>
        <View style={styles.rowInputs}>
          <View style={{flex: 1}}>
            <Text style={styles.miniLabel}>OPERATOR</Text>
            <TextInput
              style={styles.inputOperator}
              placeholder="Nama..."
              value={operator}
              onChangeText={handleOperatorChange}
            />
          </View>
          <View style={{flex: 2}}>
            <Text style={styles.miniLabel}>SCAN BARCODE</Text>
            <View style={styles.scanWrapper}>
              <TextInput
                ref={scanInputRef}
                style={styles.inputScan}
                placeholder="Barcode / Qty*Barcode"
                value={scanInput}
                onChangeText={setScanInput}
                onSubmitEditing={handleScan}
                autoFocus={true}
                showSoftInputOnFocus={false}
              />
              <TouchableOpacity
                style={styles.btnScan}
                onPress={() => navigation.navigate('BazarProductList')}>
                <Icon name="search" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(item, index) => `${item.barcode}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={{paddingBottom: 20}}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="shopping-cart" size={64} color="#DDD" />
            <Text style={styles.emptyText}>Keranjang masih kosong</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={{flex: 1}}>
          {totalHemat > 0 && (
            <View style={styles.hematBadge}>
              <Text style={styles.hematText}>
                TOTAL HEMAT: -Rp {totalHemat.toLocaleString()}
              </Text>
            </View>
          )}
          <Text style={styles.totalLabel}>GRAND TOTAL</Text>
          <Text style={styles.totalValue}>
            Rp {grandTotal.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.btnPay, cart.length === 0 && styles.btnDisabled]}
          onPress={() => cart.length > 0 && setIsPaymentVisible(true)}
          disabled={cart.length === 0}>
          <Text style={styles.btnPayText}>BAYAR</Text>
          <Icon name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <PaymentModal
        visible={isPaymentVisible}
        total={totalBelanja}
        onClose={() => setIsPaymentVisible(false)}
        onFinish={handleFinishPayment}
      />
      <StrukModal
        visible={isStrukVisible}
        data={lastTransactionData}
        isBazar={true}
        onClose={resetCashier}
        onSendWa={hp => console.log(hp)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F7F9'},
  customerBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    alignItems: 'center',
    margin: 10,
    borderRadius: 12,
    elevation: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCE4EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerLabel: {
    fontSize: 9,
    color: '#999',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  customerText: {fontSize: 15, fontWeight: 'bold', color: '#333'},
  customerSubText: {fontSize: 11, color: '#E91E63'},

  inputArea: {paddingHorizontal: 10, marginBottom: 10},
  rowInputs: {flexDirection: 'row', gap: 10},
  miniLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 4,
    marginLeft: 4,
  },
  inputOperator: {
    backgroundColor: '#fff',
    height: 45,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  scanWrapper: {flexDirection: 'row', alignItems: 'center', gap: 5},
  inputScan: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: '#2196F3',
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  btnScan: {
    backgroundColor: '#2196F3',
    width: 50,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 5,
    marginHorizontal: 10,
  },
  qtyBtn: {
    padding: 5,
  },
  qtyValueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  btnDeleteInline: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#FFF1F1',
    borderRadius: 5,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
    minHeight: 90, // Menjaga tinggi kartu tetap konsisten
  },
  leftInfo: {
    flex: 1, // Mengambil sisa ruang yang luas di kiri
    justifyContent: 'center',
    paddingRight: 10,
  },
  rightSection: {
    width: 120, // Lebar tetap untuk kolom kontrol di kanan
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  btnTrashTop: {
    padding: 4,
    backgroundColor: '#FFF1F1',
    borderRadius: 4,
    marginBottom: 2,
  },
  itemTotal: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 15,
    marginBottom: 5,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyControl: {
    padding: 4,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 25,
    textAlign: 'center',
  },
  cartItemPromo: {
    backgroundColor: '#F1F8E9',
    borderColor: '#C5E1A5',
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontWeight: '800', // Lebih tebal
    fontSize: 14,
    color: '#333',
    lineHeight: 20, // Memberi spasi antar baris jika wrap
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sizeBadge: {
    backgroundColor: '#F0F0F0', // Warna lebih soft dari hitam
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  sizeText: {
    color: '#444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  barcodeText: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  itemInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  boxLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  boxLabelActive: {
    backgroundColor: '#2E7D32', // Hijau gelap saat aktif
  },
  boxText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  itemSub: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  rightInfo: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 10,
    minWidth: 100,
  },
  textPromo: {
    color: '#2E7D32',
  },
  promoBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  btnDelete: {marginTop: 8, padding: 4},

  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
  },
  hematBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  hematText: {fontSize: 10, color: '#2E7D32', fontWeight: 'bold'},
  totalLabel: {fontSize: 10, color: '#999', fontWeight: 'bold'},
  totalValue: {fontSize: 24, fontWeight: 'bold', color: '#333'},
  btnPay: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    height: 55,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnDisabled: {backgroundColor: '#CCC'},
  btnPayText: {color: '#fff', fontWeight: 'bold', fontSize: 18},

  emptyContainer: {alignItems: 'center', marginTop: 50},
  emptyText: {marginTop: 10, color: '#AAA', fontSize: 14},
});

export default BazarCashierScreen;
