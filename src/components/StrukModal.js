import React, {useMemo, useState, useEffect, useContext, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  ToastAndroid,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import PrinterService from '../services/PrinterService';
import ViewShot from 'react-native-view-shot';
import {sendStrukWaImageApi} from '../api/ApiService';
import {AuthContext} from '../context/AuthContext';

const appLogo = require('../assets/logo.png');

const formatRupiah = angka => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka || 0);
};

const StrukModal = ({visible, onClose, data, onSendWa, isBazar = false}) => {
  const viewShotRef = useRef();
  const {userToken, userInfo} = useContext(AuthContext);

  // --- STATE ---
  const [isPrinting, setIsPrinting] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [showPrinterList, setShowPrinterList] = useState(false);
  const [currentPrinter, setCurrentPrinter] = useState(null);
  const [inputHp, setInputHp] = useState('');
  const [isSendingWa, setIsSendingWa] = useState(false);

  // --- HOOKS: PINDAHKAN KE ATAS (SEBELUM EARLY RETURN) ---

  // 1. Reset saat modal dibuka
  useEffect(() => {
    if (visible) {
      setInputHp('');
      setIsSendingWa(false);
    }
  }, [visible]);

  // 2. Mapping Data (displayData) - Menangani Bazar vs Reguler
  const displayData = useMemo(() => {
    if (!data || !data.header) return null;

    if (isBazar) {
      // Fungsi pembantu untuk menentukan nama customer jika data cus_nama kosong
      const getCustomerName = () => {
        if (data.header.cus_nama) return data.header.cus_nama;
        if (data.header.so_customer_nama) return data.header.so_customer_nama;

        // Fallback manual berdasarkan kode (B0100000 -> BAZAR SOLO)
        const kode = data.header.so_customer || '';
        if (kode === 'B0100000') return 'BAZAR SOLO';
        if (kode.endsWith('00000')) return `BAZAR ${kode.substring(0, 3)}`;

        return 'UMUM';
      };

      // Hitung ulang rincian barang untuk tampilan "Harga Ecer"
      let sumEcerKeseluruhan = 0;

      const displayItems = data.details.map(d => {
        const promoQty = parseInt(d.promo_qty) || 0;
        const currentQty = parseFloat(d.qty || d.sod_qty || 0);

        // 1. Tentukan Harga Ecer Riil (Harga sebelum bundling/diskon)
        let hargaEcerRiil = parseFloat(d.harga_jual) || 0;

        if (promoQty > 1) {
          // Pakai rumus pinalti ecer (+5rb) agar hematnya terlihat besar
          hargaEcerRiil = Math.floor(100000 / promoQty) + 5000;
          if (promoQty === 3) hargaEcerRiil = 38500;
        }

        // Jika harga_jual di DB masih 0, fallback ke harga nota agar tidak 0 di struk
        if (hargaEcerRiil <= 0)
          hargaEcerRiil = parseFloat(d.harga || d.sod_harga || 0);

        const totalBarisEcer = currentQty * hargaEcerRiil;
        sumEcerKeseluruhan += totalBarisEcer;

        return {
          nama: d.nama || 'Barang',
          ukuran: d.ukuran || d.sod_ukuran || '',
          qty: currentQty,
          harga: hargaEcerRiil, // Menampilkan harga ecer asli per unit
          total: totalBarisEcer, // Menampilkan (qty x ecer asli)
        };
      });

      const grandTotalBayar = parseFloat(data.header.so_total) || 0;
      const hematTotal = sumEcerKeseluruhan - grandTotalBayar;

      // Mapping untuk modul BAZAR
      return {
        perush_nama: userInfo?.perush_nama || 'KAOSAN BAZAR STORE',
        perush_alamat: '',
        perush_telp: userInfo?.perush_telp || '',
        nomor: data.header.so_nomor,
        tanggal: data.header.so_tanggal,
        kasir: data.header.so_user_nama || data.header.so_user_kasir || 'Kasir',
        customer: getCustomerName(),
        items: displayItems,
        subTotal: sumEcerKeseluruhan, // Muncul sebagai "Total" di atas hemat
        totalHemat: hematTotal > 0 ? hematTotal : 0,
        grandTotal: grandTotalBayar,
        bayar: data.header.so_bayar,
        kembali: data.header.so_kembali,
        donation:
          data.details.reduce((s, i) => s + (i.qty || i.sod_qty || 0), 0) * 500,
      };
    } else {
      // Mapping Reguler (Tetap seperti semula)
      return {
        perush_nama: data.header.perush_nama,
        perush_alamat: data.header.perush_alamat,
        perush_telp: data.header.perush_telp,
        nomor: data.header.inv_nomor,
        tanggal: data.header.inv_tanggal,
        kasir: data.header.user_create,
        customer: 'Customer',
        items: data.details.map(d => ({
          nama: d.nama_barang,
          ukuran: d.invd_ukuran,
          qty: d.invd_jumlah,
          harga: d.invd_harga,
          diskon: d.invd_diskon,
          total: d.total,
        })),
        subTotal: data.header.subTotal,
        diskon_faktur: data.header.diskon_faktur,
        grandTotal: data.header.grandTotal,
        bayar: data.header.inv_bayar,
        kembali: data.header.inv_kembali,
        donation:
          data.details.reduce((s, i) => s + (Number(i.invd_jumlah) || 0), 0) *
          500,
      };
    }
  }, [data, isBazar, userInfo]);

  // --- EARLY RETURN DI SINI (SETELAH SEMUA HOOK DIPANGGIL) ---
  if (!data || !displayData) return null;

  // --- LOGIC PRINTER ---
  const requestBluetoothPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const result = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]);
          return (
            result['android.permission.BLUETOOTH_CONNECT'] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            result['android.permission.BLUETOOTH_SCAN'] ===
              PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const handlePrint = async () => {
    const hasPermission = await requestBluetoothPermission();
    if (!hasPermission) return;

    if (currentPrinter) {
      setIsPrinting(true);
      try {
        // Paksa connect ulang sebelum perintah print,
        // untuk bangunin Bluetooth Xprinter yang tidur/hang
        await PrinterService.Printer.connectPrinter(
          currentPrinter.inner_mac_address,
        );
        await executePrint();
      } catch (err) {
        // Jika gagal, berarti MAC address berubah atau printer mati
        setCurrentPrinter(null);
        scanPrinters();
      } finally {
        setIsPrinting(false);
      }
      return;
    }
    scanPrinters();
  };

  const scanPrinters = async () => {
    setIsPrinting(true);
    try {
      await PrinterService.Printer.init();
      const results = await PrinterService.Printer.getDeviceList();
      const uniquePrinters = results.filter(
        (v, i, a) =>
          a.findIndex(v2 => v2.inner_mac_address === v.inner_mac_address) === i,
      );
      setPrinters(uniquePrinters);
      setShowPrinterList(true);
    } catch (err) {
      Alert.alert('Gagal Scan', 'Pastikan Bluetooth HP aktif.');
    } finally {
      setIsPrinting(false);
    }
  };

  const connectAndPrint = async printer => {
    setIsPrinting(true);
    try {
      await PrinterService.Printer.connectPrinter(printer.inner_mac_address);
      setCurrentPrinter(printer);
      setShowPrinterList(false);
      await executePrint();
    } catch (err) {
      Alert.alert('Gagal Connect', 'Tidak dapat terhubung.');
    } finally {
      setIsPrinting(false);
    }
  };

  const executePrint = async () => {
    setIsPrinting(true);
    try {
      if (isBazar) {
        await PrinterService.printStrukBazar(data);
      } else {
        await PrinterService.printStruk(data);
      }
    } catch (error) {
      Alert.alert('Gagal Cetak', 'Koneksi printer terputus.');
      setCurrentPrinter(null);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendWaImage = async () => {
    if (!inputHp) {
      Alert.alert('Perhatian', 'Isi nomor HP dulu.');
      return;
    }
    setIsSendingWa(true);
    try {
      const uri = await viewShotRef.current.capture();
      const formData = new FormData();
      formData.append('image', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: 'image/jpeg',
        name: 'struk-belanja.jpg',
      });

      let targetHp = inputHp.replace(/[^0-9]/g, '');
      if (targetHp.startsWith('0')) targetHp = '62' + targetHp.slice(1);

      formData.append('hp', targetHp);
      formData.append('caption', `Struk Belanja No: ${displayData.nomor}`);

      await sendStrukWaImageApi(formData, userToken);
      Alert.alert('Berhasil', 'Struk Gambar terkirim!');
    } catch (error) {
      Alert.alert('Gagal', 'Gagal mengirim gambar.');
    } finally {
      setIsSendingWa(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Struk Penjualan</Text>
            <TouchableOpacity onPress={onClose} disabled={isSendingWa}>
              <Icon name="x" size={24} color={isSendingWa ? '#ccc' : '#333'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.receiptScroll}>
            <ViewShot ref={viewShotRef} options={{format: 'jpg', quality: 0.9}}>
              <View style={styles.paper}>
                <View style={styles.centerContent}>
                  <Image
                    source={appLogo}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                  <Text style={styles.storeName}>
                    {displayData.perush_nama}
                  </Text>
                  {displayData.perush_alamat !== '' && (
                    <Text style={styles.storeAddress}>
                      {displayData.perush_alamat}
                    </Text>
                  )}
                  {displayData.perush_telp ? (
                    <Text style={styles.storeContact}>
                      {displayData.perush_telp}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.dashedLine} />

                <Text style={styles.textSmall}>No: {displayData.nomor}</Text>
                <Text style={styles.textSmall}>
                  Tgl: {new Date(displayData.tanggal).toLocaleString('id-ID')}
                </Text>
                <Text style={styles.textSmall}>Kasir: {displayData.kasir}</Text>
                {isBazar && (
                  <Text style={styles.textSmall}>
                    Pelanggan: {displayData.customer}
                  </Text>
                )}

                <View style={styles.dashedLine} />

                {displayData.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {item.nama} {item.ukuran ? `(${item.ukuran})` : ''}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.textSmall}>
                        {item.qty} x{' '}
                        {formatRupiah(item.harga + (item.diskon || 0))}
                      </Text>
                      <Text style={styles.textSmall}>
                        {formatRupiah(item.total)}
                      </Text>
                    </View>
                    {item.diskon > 0 && (
                      <Text style={[styles.promoText, {textAlign: 'right'}]}>
                        Disc: -{formatRupiah(item.diskon * item.qty)}
                      </Text>
                    )}
                  </View>
                ))}

                <View style={styles.dashedLine} />

                <View style={styles.summaryRow}>
                  <Text style={styles.textSmall}>Total</Text>
                  <Text style={styles.textSmall}>
                    {formatRupiah(displayData.subTotal)}
                  </Text>
                </View>
                {displayData.diskon_faktur > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.textSmall, styles.promoText]}>
                      Diskon Faktur
                    </Text>
                    <Text style={[styles.textSmall, styles.promoText]}>
                      -{formatRupiah(displayData.diskon_faktur)}
                    </Text>
                  </View>
                )}
                {displayData.totalHemat > 0 && (
                  <View style={styles.summaryRow}>
                    <Text
                      style={[
                        styles.textSmall,
                        {color: '#2E7D32', fontWeight: 'bold'},
                      ]}>
                      TOTAL HEMAT
                    </Text>
                    <Text
                      style={[
                        styles.textSmall,
                        {color: '#2E7D32', fontWeight: 'bold'},
                      ]}>
                      -{formatRupiah(displayData.totalHemat)}
                    </Text>
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <Text style={styles.textBold}>Grand Total</Text>
                  <Text style={styles.textBold}>
                    {formatRupiah(displayData.grandTotal)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.textSmall}>Bayar</Text>
                  <Text style={styles.textSmall}>
                    {formatRupiah(displayData.bayar)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.textSmall}>Kembali</Text>
                  <Text style={styles.textSmall}>
                    {formatRupiah(displayData.kembali)}
                  </Text>
                </View>

                <View style={styles.dashedLine} />

                <View style={styles.centerContent}>
                  <View style={styles.donationBox}>
                    <Text style={styles.donationText}>
                      Donasi Peduli Sesama: {formatRupiah(displayData.donation)}
                    </Text>
                  </View>
                  <Text style={styles.footerNote}>
                    TERIMAKASIH ATAS KUNJUNGAN ANDA
                  </Text>
                </View>
              </View>
            </ViewShot>

            <View style={styles.waInputContainer}>
              <Text style={styles.waLabel}>Kirim Struk WhatsApp:</Text>
              <View style={styles.inputBox}>
                <View style={styles.prefixView}>
                  <Text style={styles.prefixText}>+62</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="8123xxxxxxx"
                  keyboardType="phone-pad"
                  value={inputHp}
                  onChangeText={setInputHp}
                  editable={!isSendingWa}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrint]}
              onPress={handlePrint}
              disabled={isPrinting}>
              {isPrinting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="printer" size={20} color="#fff" />
              )}
              <Text style={styles.btnText}>
                {currentPrinter ? 'Cetak' : 'Cari Printer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnWa]}
              onPress={handleSendWaImage}
              disabled={isSendingWa}>
              {isSendingWa ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Icon name="image" size={20} color="#fff" />
              )}
              <Text style={styles.btnText}>Kirim Gambar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* MODAL PILIH PRINTER (Sama seperti sebelumnya) */}
        <Modal
          visible={showPrinterList}
          transparent={true}
          animationType="fade">
          <View style={styles.printerOverlay}>
            <View style={styles.printerContainer}>
              <Text style={styles.printerTitle}>Pilih Printer Bluetooth</Text>
              <ScrollView style={{maxHeight: 300}}>
                {printers.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.printerItem}
                    onPress={() => connectAndPrint(p)}>
                    <Icon name="printer" size={24} color="#333" />
                    <View style={{marginLeft: 10}}>
                      <Text style={{fontWeight: 'bold'}}>{p.device_name}</Text>
                      <Text style={{fontSize: 12, color: '#666'}}>
                        {p.inner_mac_address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.closePrinterBtn}
                onPress={() => setShowPrinterList(false)}>
                <Text style={{color: 'red', fontWeight: 'bold'}}>BATAL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    maxHeight: '95%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalTitle: {fontSize: 18, fontWeight: 'bold', color: '#333'},
  receiptScroll: {padding: 15, backgroundColor: '#f0f0f0'},
  paper: {backgroundColor: '#fff', padding: 15, elevation: 2, marginBottom: 15},
  centerContent: {alignItems: 'center', marginBottom: 10},
  logo: {width: 60, height: 60, marginBottom: 10},
  storeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  storeAddress: {fontSize: 10, color: '#444', textAlign: 'center'},
  storeContact: {fontSize: 10, color: '#444', textAlign: 'center'},
  dashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    marginVertical: 8,
    borderRadius: 1,
  },
  itemRow: {marginBottom: 8},
  itemName: {fontSize: 12, fontWeight: 'bold', color: '#000', marginBottom: 2},
  priceRow: {flexDirection: 'row', justifyContent: 'space-between'},
  textSmall: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  textBold: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  promoText: {color: '#D32F2F', fontSize: 10},
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  donationBox: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    paddingVertical: 5,
    marginVertical: 5,
  },
  donationText: {
    fontSize: 9,
    textAlign: 'center',
    color: '#333',
    fontStyle: 'italic',
  },
  footerNote: {fontSize: 9, textAlign: 'center', color: '#333', marginTop: 2},
  waInputContainer: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  waLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 5,
  },
  inputBox: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#90CAF9',
    overflow: 'hidden',
    height: 40,
  },
  prefixView: {
    backgroundColor: '#BBDEFB',
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: '#90CAF9',
  },
  prefixText: {fontWeight: 'bold', color: '#1565C0', fontSize: 12},
  textInput: {flex: 1, paddingHorizontal: 10, fontSize: 14, color: '#333'},
  actions: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderColor: '#eee',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  btnWa: {backgroundColor: '#25D366'},
  btnPrint: {backgroundColor: '#1976D2'},
  btnText: {color: '#fff', fontWeight: 'bold'},
  printerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 30,
  },
  printerContainer: {backgroundColor: '#fff', borderRadius: 8, padding: 20},
  printerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  printerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  closePrinterBtn: {marginTop: 15, alignItems: 'center', padding: 10},
});

export default StrukModal;
