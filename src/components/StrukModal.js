import React, {useMemo, useState, useEffect, useContext} from 'react';
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
// 1. IMPORT VIEW SHOT & REF
import ViewShot, {captureRef} from 'react-native-view-shot';
import {useRef} from 'react';
import {sendStrukWaImageApi} from '../api/ApiService'; // Import API baru
import {AuthContext} from '../context/AuthContext'; // Import Context jika butuh token disini, atau pass dari props

const appLogo = require('../assets/logo.png');

const formatRupiah = angka => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka);
};

const StrukModal = ({visible, onClose, data, onSendWa}) => {
  const viewShotRef = useRef();
  const {userToken} = useContext(AuthContext); // Ambil token
  // --- STATE PRINTER ---
  const [isPrinting, setIsPrinting] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [showPrinterList, setShowPrinterList] = useState(false);
  const [currentPrinter, setCurrentPrinter] = useState(null);

  // --- STATE WA ---
  const [inputHp, setInputHp] = useState('');
  const [isSendingWa, setIsSendingWa] = useState(false); // State Loading

  // Reset saat modal dibuka
  useEffect(() => {
    if (visible) {
      setInputHp('');
      setIsSendingWa(false);
    }
  }, [visible]);

  // --- 1. MEMO LOGIC ---
  const donationAmount = useMemo(() => {
    const items = data?.details || [];
    const totalQty = items.reduce(
      (sum, item) => sum + (Number(item.invd_jumlah) || 0),
      0,
    );
    return totalQty * 500;
  }, [data]);

  // --- 2. EARLY RETURN ---
  if (!data) return null;

  const {header, details} = data;

  // --- 3. LOGIC PRINTER (Sama seperti sebelumnya) ---
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
            {
              title: 'Izin Lokasi & Bluetooth',
              message:
                'Aplikasi membutuhkan akses lokasi untuk memindai printer bluetooth.',
              buttonNeutral: 'Nanti',
              buttonNegative: 'Batal',
              buttonPositive: 'OK',
            },
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
    if (!hasPermission) {
      Alert.alert('Izin Ditolak', 'Mohon izinkan akses Bluetooth.');
      return;
    }
    if (currentPrinter) {
      executePrint();
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
      if (Platform.OS === 'android')
        ToastAndroid.show(
          `Terhubung ke ${printer.device_name}`,
          ToastAndroid.SHORT,
        );
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
      await PrinterService.printStruk(data);
    } catch (error) {
      Alert.alert('Gagal Cetak', 'Koneksi printer terputus.');
      setCurrentPrinter(null);
    } finally {
      setIsPrinting(false);
    }
  };

  // --- 4. LOGIC KIRIM WA (YANG DIPERBAIKI) ---
  const handleSendWa = async () => {
    // 1. Cek Input Kosong
    if (!inputHp) {
      Alert.alert('Perhatian', 'Nomor WhatsApp pembeli harus diisi.');
      return;
    }

    // LOGGING 1: Cek apa yang diketik user
    console.log('[FRONTEND - MODAL] Input User:', inputHp);

    setIsSendingWa(true);

    try {
      // 2. Panggil Fungsi Parent
      // Kita await agar loading tidak berhenti sebelum proses selesai
      await onSendWa(inputHp);
    } catch (error) {
      console.log('[FRONTEND - MODAL] Error:', error);
      // Alert ini muncul jika Parent melempar error (throw)
      Alert.alert('Gagal', 'Terjadi kesalahan di Modal.');
    } finally {
      setIsSendingWa(false);
    }
  };

  const handleSendWaImage = async () => {
    if (!inputHp) {
      Alert.alert('Perhatian', 'Isi nomor HP dulu.');
      return;
    }

    setIsSendingWa(true);

    try {
      // 1. CAPTURE LAYAR
      // result akan berupa path file sementara di HP (misal: /tmp/....jpg)
      const uri = await viewShotRef.current.capture();
      console.log('Screenshot berhasil:', uri);

      // 2. SIAPKAN FORM DATA
      const formData = new FormData();

      // Object Gambar WAJIB punya 3 ini: uri, type, name
      const imageFile = {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: 'image/jpeg', // Harus mime type yang valid
        name: 'struk-belanja.jpg', // Harus ada nama file + ekstensi
      };

      formData.append('image', imageFile);

      // Masukkan Data Teks
      // Format nomor HP
      let targetHp = inputHp.replace(/[^0-9]/g, '');
      if (targetHp.startsWith('0')) targetHp = '62' + targetHp.slice(1);

      formData.append('hp', targetHp);
      formData.append('caption', `Struk Belanja No: ${data.header.inv_nomor}`);

      // 3. UPLOAD KE BACKEND
      await sendStrukWaImageApi(formData, userToken);

      Alert.alert('Berhasil', 'Struk Gambar terkirim!');
    } catch (error) {
      console.log('Error Upload:', error);
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
          {/* HEADER */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Struk Penjualan</Text>
            {/* Tombol Close dimatikan saat loading agar user gak close paksa */}
            <TouchableOpacity onPress={onClose} disabled={isSendingWa}>
              <Icon name="x" size={24} color={isSendingWa ? '#ccc' : '#333'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.receiptScroll}>
            {/* TAMPILAN STRUK */}
            <ViewShot ref={viewShotRef} options={{format: 'jpg', quality: 0.9}}>
              <View style={styles.paper}>
                <View style={styles.centerContent}>
                  <Image
                    source={appLogo}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                  <Text style={styles.storeName}>{header.perush_nama}</Text>
                  <Text style={styles.storeAddress}>
                    {header.perush_alamat}
                  </Text>
                  <Text style={styles.storeContact}>{header.perush_telp}</Text>
                </View>

                <View style={styles.dashedLine} />

                <View style={styles.rowInfo}>
                  <Text style={styles.textSmall}>No: {header.inv_nomor}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.textSmall}>
                    Tgl:{' '}
                    {new Date(header.inv_tanggal).toLocaleDateString('id-ID')}{' '}
                    {new Date(header.date_create).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.textSmall}>
                    Kasir: {header.user_create}
                  </Text>
                </View>

                {header.diskon_faktur > 0 && (
                  <View>
                    <View style={styles.dashedLine} />
                    <View style={styles.promoBanner}>
                      <Text style={styles.promoBannerText}>
                        *** MENDAPAT PROMO REGULER ***
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.dashedLine} />

                {/* LIST ITEMS */}
                {details.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {item.nama_barang} ({item.invd_ukuran})
                    </Text>
                    {item.invd_diskon > 0 ? (
                      <View>
                        <View style={styles.priceRow}>
                          <Text
                            style={[styles.textSmall, styles.strikeThrough]}>
                            {item.invd_jumlah} x{' '}
                            {formatRupiah(item.invd_harga + item.invd_diskon)}
                          </Text>
                          <Text
                            style={[styles.textSmall, styles.strikeThrough]}>
                            {formatRupiah(
                              (item.invd_harga + item.invd_diskon) *
                                item.invd_jumlah,
                            )}
                          </Text>
                        </View>
                        <View style={styles.priceRow}>
                          <Text style={styles.textSmall}>
                            {item.invd_jumlah} x {formatRupiah(item.invd_harga)}
                            <Text style={styles.promoText}> (Disc)</Text>
                          </Text>
                          <Text style={styles.textSmall}>
                            {formatRupiah(item.total)}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.priceRow}>
                        <Text style={styles.textSmall}>
                          {item.invd_jumlah} x {formatRupiah(item.invd_harga)}
                        </Text>
                        <Text style={styles.textSmall}>
                          {formatRupiah(item.total)}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}

                <View style={styles.dashedLine} />

                {/* SUMMARY */}
                <View style={styles.summaryRow}>
                  <Text style={styles.textSmall}>Total</Text>
                  <Text style={styles.textSmall}>
                    {formatRupiah(header.subTotal)}
                  </Text>
                </View>
                {header.diskon_faktur > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.textSmall, styles.promoText]}>
                      Total Diskon
                    </Text>
                    <Text style={[styles.textSmall, styles.promoText]}>
                      - {formatRupiah(header.diskon_faktur)}
                    </Text>
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <Text style={styles.textBold}>Grand Total</Text>
                  <Text style={styles.textBold}>
                    {formatRupiah(header.grandTotal)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.textSmall}>Bayar</Text>
                  <Text style={styles.textSmall}>
                    {formatRupiah(header.inv_bayar)}
                  </Text>
                </View>
                {header.inv_pundiamal > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.textSmall}>Pundi Amal</Text>
                    <Text style={styles.textSmall}>
                      {formatRupiah(header.inv_pundiamal)}
                    </Text>
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <Text style={styles.textSmall}>Kembali</Text>
                  <Text style={styles.textSmall}>
                    {formatRupiah(header.inv_kembali)}
                  </Text>
                </View>

                <View style={styles.dashedLine} />

                <View style={styles.centerContent}>
                  {header.gdg_transferbank && (
                    <Text
                      style={[
                        styles.textSmall,
                        styles.textCenter,
                        {marginBottom: 5},
                      ]}>
                      Transfer: {header.gdg_transferbank}
                      {'\n'}
                      {header.gdg_akun}
                    </Text>
                  )}
                  <View style={styles.donationBox}>
                    <Text style={styles.donationText}>
                      Dengan membeli produk kaosan ini, Kaosan telah
                      menyisihkan/peduli dengan sesama yg membutuhkan sebesar{' '}
                      {formatRupiah(donationAmount)}
                    </Text>
                  </View>
                  <Text style={styles.footerNote}>
                    BARANG YANG SUDAH DIBELI TIDAK BISA DIKEMBALIKAN
                  </Text>
                  <Text style={styles.footerNote}>
                    TERIMAKASIH ATAS KUNJUNGAN ANDA
                  </Text>
                  <View style={styles.socialRow}>
                    {header.gdg_inv_instagram && (
                      <Text style={styles.socialText}>
                        IG: {header.gdg_inv_instagram}
                      </Text>
                    )}
                    {header.gdg_inv_fb && (
                      <Text style={styles.socialText}>
                        {' '}
                        | FB: {header.gdg_inv_fb}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </ViewShot>

            {/* --- INPUT WA --- */}
            <View style={styles.waInputContainer}>
              <Text style={styles.waLabel}>Kirim Struk ke WhatsApp:</Text>
              <View
                style={[
                  styles.inputBox,
                  isSendingWa && {backgroundColor: '#f0f0f0'},
                ]}>
                <View style={styles.prefixView}>
                  <Text style={styles.prefixText}>+62</Text>
                </View>
                <TextInput
                  style={[styles.textInput, isSendingWa && {color: '#999'}]}
                  placeholder="8123xxxxxxx"
                  keyboardType="phone-pad"
                  value={inputHp}
                  onChangeText={setInputHp}
                  placeholderTextColor="#999"
                  editable={!isSendingWa} // Matikan input saat loading
                />
              </View>
              {/* Info Text */}
              {isSendingWa && (
                <Text
                  style={{
                    fontSize: 11,
                    color: '#1976D2',
                    marginTop: 5,
                    fontStyle: 'italic',
                  }}>
                  Sedang memproses pengiriman... (estimasi 3-5 detik)
                </Text>
              )}
            </View>
          </ScrollView>

          {/* ACTION BUTTONS */}
          <View style={styles.actions}>
            {/* BUTTON PRINT */}
            <TouchableOpacity
              style={[styles.btn, styles.btnPrint]}
              onPress={handlePrint}
              disabled={isPrinting || isSendingWa}>
              {isPrinting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="printer" size={20} color="#fff" />
              )}
              <Text style={styles.btnText}>
                {currentPrinter ? 'Cetak' : 'Cari Printer'}
              </Text>
            </TouchableOpacity>

            {/* BUTTON WA (DENGAN LOADING JELAS) */}
            <TouchableOpacity
              style={[styles.btn, styles.btnWa]}
              onPress={handleSendWaImage} // <--- PANGGIL FUNGSI BARU
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

        {/* LIST PRINTER MODAL */}
        <Modal
          visible={showPrinterList}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPrinterList(false)}>
          <View style={styles.printerOverlay}>
            <View style={styles.printerContainer}>
              <Text style={styles.printerTitle}>Pilih Printer Bluetooth</Text>
              {printers.length === 0 ? (
                <View style={{padding: 20, alignItems: 'center'}}>
                  <ActivityIndicator size="large" color="#1976D2" />
                  <Text style={{marginTop: 10}}>Mencari perangkat...</Text>
                </View>
              ) : (
                <ScrollView style={{maxHeight: 300}}>
                  {printers.map((p, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.printerItem}
                      onPress={() => connectAndPrint(p)}>
                      <Icon name="printer" size={24} color="#333" />
                      <View style={{marginLeft: 10}}>
                        <Text style={{fontWeight: 'bold'}}>
                          {p.device_name || 'Unknown Device'}
                        </Text>
                        <Text style={{fontSize: 12, color: '#666'}}>
                          {p.inner_mac_address}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
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

  promoBanner: {alignItems: 'center', paddingVertical: 5},
  promoBannerText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },

  rowInfo: {marginBottom: 2},
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
  textCenter: {textAlign: 'center'},
  strikeThrough: {textDecorationLine: 'line-through', color: '#888'},
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
  socialRow: {flexDirection: 'row', marginTop: 5},
  socialText: {fontSize: 9, color: '#555'},

  // --- WA INPUT STYLES ---
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

  // --- ACTIONS ---
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
  btnDisabled: {backgroundColor: '#BDBDBD'}, // Warna tombol saat disabled/loading
  btnPrint: {backgroundColor: '#1976D2'},
  btnText: {color: '#fff', fontWeight: 'bold'},

  // --- MODAL PRINTER ---
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
