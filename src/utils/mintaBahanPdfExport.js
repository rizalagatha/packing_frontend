import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNFS from 'react-native-fs';
import {Platform} from 'react-native';
import {LOGO_BASE64} from '../constants/LogoStruk';

const formatTanggalIndo = dateStr => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const buildHtml = (data, startDate, endDate) => {
  const {summary, grandTotal} = data;

  const tokoRows = summary
    .map((toko, idx) => {
      const itemRows = toko.items
        .map(
          item => `
        <tr>
          <td class="td-kode">${item.kode}</td>
          <td>${item.nama}</td>
          <td class="td-center">${item.satuan || '-'}</td>
          <td class="td-right">${item.jumlah.toLocaleString('id-ID')}</td>
        </tr>
      `,
        )
        .join('');

      return `
        <div class="toko-block">
          <div class="toko-header">
            <span class="toko-rank">#${idx + 1}</span>
            <span class="toko-name">${toko.toko}</span>
            <span class="toko-stat">${toko.totalPermintaan} permintaan</span>
          </div>
          <table class="item-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Barang</th>
                <th class="td-center">Satuan</th>
                <th class="td-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
      `;
    })
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; }
          body { padding: 24px; color: #222; font-size: 12px; }
          .header { display: flex; align-items: center; margin-bottom: 6px; border-bottom: 2px solid #7B1FA2; padding-bottom: 12px; }
          .header img { width: 50px; height: 50px; margin-right: 14px; object-fit: contain; }
          .header-title { font-size: 18px; font-weight: bold; color: #333; }
          .header-sub { font-size: 11px; color: #777; margin-top: 2px; }
          .periode-box { background: #F3E5F5; padding: 8px 12px; border-radius: 6px; margin: 14px 0; font-size: 11px; color: #4A148C; }
          .grand-total-box { background: #7B1FA2; color: #fff; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; font-size: 13px; font-weight: bold; }
          .toko-block { margin-bottom: 16px; page-break-inside: avoid; }
          .toko-header { display: flex; align-items: center; background: #EDE7F6; padding: 8px 10px; border-radius: 4px 4px 0 0; }
          .toko-rank { background: #7B1FA2; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 3px; margin-right: 8px; }
          .toko-name { font-weight: bold; font-size: 13px; flex: 1; }
          .toko-stat { font-size: 10px; color: #666; }
          table.item-table { width: 100%; border-collapse: collapse; }
          table.item-table th { background: #FAFAFA; border: 1px solid #E0E0E0; padding: 5px 8px; font-size: 10px; text-align: left; }
          table.item-table td { border: 1px solid #E0E0E0; padding: 5px 8px; font-size: 10px; }
          .td-kode { color: #7B1FA2; font-weight: bold; }
          .td-center { text-align: center; }
          .td-right { text-align: right; font-weight: bold; }
          .footer { margin-top: 20px; font-size: 9px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="data:image/png;base64,${LOGO_BASE64}" />
          <div>
            <div class="header-title">Laporan Permintaan Bahan/Aksesoris</div>
            <div class="header-sub">Kaosan Mobile — Laporan Permintaan Bahan/Aksesoris</div>
          </div>
        </div>

        <div class="periode-box">
          Periode: ${formatTanggalIndo(startDate)} s/d ${formatTanggalIndo(
    endDate,
  )}
        </div>

        <div class="grand-total-box">
          Total Keseluruhan Barang Diminta: ${grandTotal.toLocaleString(
            'id-ID',
          )}
        </div>

        ${tokoRows || '<p>Tidak ada data permintaan pada periode ini.</p>'}

        <div class="footer">
          Dicetak otomatis dari Kaosan Mobile pada ${new Date().toLocaleString(
            'id-ID',
          )}
        </div>
      </body>
    </html>
  `;
};

export const generateAndOpenMintaBahanPdf = async (
  data,
  startDate,
  endDate,
) => {
  const html = buildHtml(data, startDate, endDate);
  const fileName = `Laporan-Permintaan-Bahan-${Date.now()}`;

  const options = {
    html,
    fileName,
    directory: 'Documents', // area sandbox app, hasil convert selalu di sini dulu
  };

  const file = await RNHTMLtoPDF.convert(options);

  if (!file.filePath) {
    throw new Error('Gagal membuat file PDF.');
  }

  // Salin ke folder Downloads publik supaya user bisa buka dari app File Manager / app PDF apapun nanti
  let finalPath = file.filePath;

  if (Platform.OS === 'android') {
    try {
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;
      await RNFS.copyFile(file.filePath, downloadPath);
      finalPath = downloadPath;
    } catch (copyError) {
      console.log(
        'Gagal salin ke Downloads, tetap pakai path sandbox:',
        copyError,
      );
      // Kalau gagal (misal permission), tetap lanjut pakai path sandbox asli
    }
  }

  return finalPath;
};
