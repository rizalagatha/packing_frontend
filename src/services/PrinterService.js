import {BLEPrinter} from 'react-native-thermal-receipt-printer-image-qr';
import {
  LOGO_BASE64,
  ICON_IG_BASE64,
  ICON_FB_BASE64,
} from '../constants/LogoStruk';

const PRINTER_WIDTH = 32; // Lebar karakter 58mm (standar 32)

// --- PERBAIKAN: Menambahkan 'Rp ' otomatis ---
const formatRupiah = angka => {
  // Format angka standar Indonesia (titik sebagai pemisah ribuan)
  const num = new Intl.NumberFormat('id-ID', {minimumFractionDigits: 0}).format(
    angka,
  );
  return `Rp ${num}`;
};

const formatRow = (left, right, isBold = false) => {
  // Hitung sisa spasi
  const space = Math.max(0, PRINTER_WIDTH - left.length - right.length);
  const text = `${left}${' '.repeat(space)}${right}\n`;
  return isBold ? `<B>${text}</B>` : text;
};

// Helper kecil untuk print ikon dengan aman
const printIcon = async base64 => {
  try {
    // Width 40 dots cukup kecil untuk ikon
    await BLEPrinter.printImageBase64(base64, 40);
    // Jeda mikro untuk memastikan buffer printer aman
    await new Promise(r => setTimeout(r, 100));
  } catch (e) {
    console.log('Skip icon', e);
  }
};

const printStruk = async data => {
  const {header, details} = data;

  try {
    // --- 0. CETAK LOGO ---
    try {
      await BLEPrinter.printImageBase64(LOGO_BASE64, 150);
    } catch (e) {
      console.log('Gagal print logo', e);
    }

    let text = '';

    // --- 1. HEADER TOKO ---
    text += `<C><B>${header.perush_nama}</B></C>\n`;
    text += `<C>${header.perush_alamat}</C>\n`;
    text += `<C>${header.perush_telp}</C>\n`;
    text += `<C>--------------------------------</C>\n`;

    // --- 2. INFO INVOICE ---
    const dateObj = new Date(header.date_create);
    const timeString = dateObj.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    text += `No: ${header.inv_nomor}\n`;
    text += `Tgl: ${new Date(header.inv_tanggal).toLocaleDateString(
      'id-ID',
    )} ${timeString}\n`;
    text += `Kasir: ${header.user_create}\n`;
    // --- [BARU] LOGIKA PROMO REGULER (DIPERBAIKI) ---
    // Cek jika ada diskon faktur
    if (header.diskon_faktur > 0) {
      text += `<C>--------------------------------</C>\n`;
      // HAPUS <B> AGAR UKURAN NORMAL, GANTI EMOJI DENGAN ***
      text += `<C>*** MENDAPAT PROMO REGULER ***</C>\n`;
    }
    // ------------------------------------

    text += `<C>--------------------------------</C>\n`;

    // --- 3. ITEMS ---
    details.forEach(item => {
      text += `${item.nama_barang} (${item.invd_ukuran})\n`;

      if (item.invd_diskon > 0) {
        // Tampilkan kalkulasi diskon
        // formatRupiah sudah ada 'Rp', jadi: "1 x Rp 100.000"
        text += `${item.invd_jumlah} x ${formatRupiah(
          item.invd_harga + item.invd_diskon,
        )}\n`;
        text += formatRow(
          `(Disc ${formatRupiah(item.invd_diskon)})`,
          formatRupiah(item.total),
        );
      } else {
        // Harga Normal
        text += formatRow(
          `${item.invd_jumlah} x ${formatRupiah(item.invd_harga)}`,
          formatRupiah(item.total),
        );
      }
    });

    text += `<C>--------------------------------</C>\n`;

    // --- 4. SUMMARY ---
    text += formatRow('Total', formatRupiah(header.subTotal));

    if (header.diskon_faktur > 0) {
      // formatRupiah ada 'Rp', tambah minus di depannya: "-Rp 5.000"
      text += formatRow('Diskon', `-${formatRupiah(header.diskon_faktur)}`);
    }

    text += formatRow('Grand Total', formatRupiah(header.grandTotal), true); // Bold
    text += formatRow('Bayar', formatRupiah(header.inv_bayar));

    if (header.inv_pundiamal > 0) {
      text += formatRow('Pundi Amal', formatRupiah(header.inv_pundiamal));
    }

    text += formatRow('Kembali', formatRupiah(header.inv_kembali));

    text += `<C>--------------------------------</C>\n`;

    // --- 5. INFO BANK ---
    if (header.gdg_transferbank) {
      text += `<C>Transfer:</C>\n`;
      text += `<C>${header.gdg_transferbank}</C>\n`;
      text += `<C>${header.gdg_akun || ''}</C>\n`;
      text += `<C>--------------------------------</C>\n`;
    }

    // --- 6. DONASI ---
    const totalQty = details.reduce(
      (sum, item) => sum + (Number(item.invd_jumlah) || 0),
      0,
    );
    const donasi = totalQty * 500;

    text += `<C>Dengan membeli produk ini,</C>\n`;
    text += `<C>Kaosan telah menyisihkan/peduli</C>\n`; // Teks dipotong agar muat 58mm
    text += `<C>dengan sesama yg membutuhkan</C>\n`;
    text += `<C>sebesar ${formatRupiah(donasi)}</C>\n\n`; // Format Rupiah yang benar

    // --- 7. FOOTER NOTE ---
    text += `<C>BARANG YANG SUDAH DIBELI</C>\n`;
    text += `<C>TIDAK BISA DIKEMBALIKAN</C>\n`;
    text += `<C>TERIMAKASIH ATAS KUNJUNGAN ANDA</C>\n`;

    // --- 8. SOSMED ---
    if (header.gdg_inv_instagram || header.gdg_inv_fb) {
      text += `\n`;
      if (header.gdg_inv_instagram) {
        text += `<C>IG: ${header.gdg_inv_instagram}</C>\n`;
      }
      if (header.gdg_inv_fb) {
        text += `<C>FB: ${header.gdg_inv_fb}</C>\n`;
      }
    }

    text += `\n\n`; // Feed kertas

    await BLEPrinter.printBill(text);
  } catch (err) {
    throw err;
  }
};

export default {
  Printer: BLEPrinter,
  printStruk,
};
