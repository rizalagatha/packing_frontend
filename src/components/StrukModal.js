import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

const appLogo = require('../assets/logo.png');

const formatRupiah = angka => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka);
};

const StrukModal = ({visible, onClose, data, onPrint, onSendWa}) => {
  // --- 1. PINDAHKAN HOOK KE ATAS (SEBELUM RETURN) ---
  // Hitung Pundi Amal (Rp 500 x Total Qty)
  // Gunakan optional chaining (?.) atau default value agar aman saat data null
  const donationAmount = useMemo(() => {
    const items = data?.details || []; // Fallback ke array kosong jika data null
    const totalQty = items.reduce(
      (sum, item) => sum + (Number(item.invd_jumlah) || 0),
      0,
    );
    return totalQty * 500;
  }, [data]); // Dependency ke object data
  // --------------------------------------------------

  // --- 2. BARU LAKUKAN EARLY RETURN ---
  if (!data) return null;

  // --- 3. DESTRUCTURING DATA SETELAH CEK NULL ---
  const {header, details} = data;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Preview Struk</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.receiptScroll}>
            <View style={styles.paper}>
              {/* HEADER TOKO & LOGO */}
              <View style={styles.centerContent}>
                <Image
                  source={appLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.storeName}>{header.perush_nama}</Text>
                <Text style={styles.storeAddress}>{header.perush_alamat}</Text>
                <Text style={styles.storeContact}>{header.perush_telp}</Text>
              </View>

              <View style={styles.dashedLine} />

              {/* INFO INVOICE */}
              <View style={styles.rowInfo}>
                <Text style={styles.textSmall}>No: {header.inv_nomor}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.textSmall}>
                  Tgl:{' '}
                  {new Date(header.inv_tanggal).toLocaleDateString('id-ID')}{' '}
                  {new Date(header.date_create).toLocaleTimeString()}
                </Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.textSmall}>
                  Kasir: {header.user_create}
                </Text>
              </View>

              <View style={styles.dashedLine} />

              {/* ITEMS */}
              {details.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    {item.nama_barang} ({item.invd_ukuran})
                  </Text>

                  {item.invd_diskon > 0 ? (
                    <View>
                      <View style={styles.priceRow}>
                        <Text style={[styles.textSmall, styles.strikeThrough]}>
                          {item.invd_jumlah} x{' '}
                          {formatRupiah(item.invd_harga + item.invd_diskon)}
                        </Text>
                        <Text style={[styles.textSmall, styles.strikeThrough]}>
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
                  <Text style={styles.textSmall}>Pundi Amal (Kembalian)</Text>
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

              {/* FOOTER */}
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

                {/* Info Donasi (Updated) */}
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
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnWa]}
              onPress={onSendWa}>
              <Icon name="message-circle" size={20} color="#fff" />
              <Text style={styles.btnText}>Kirim WA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrint]}
              onPress={onPrint}>
              <Icon name="printer" size={20} color="#fff" />
              <Text style={styles.btnText}>Cetak</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    maxHeight: '90%',
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
  paper: {backgroundColor: '#fff', padding: 15, elevation: 2, marginBottom: 10},

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
});

export default StrukModal;
