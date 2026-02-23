import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const database_name = 'StokOpname.db';
let db;

export const initDB = async () => {
  try {
    db = await SQLite.openDatabase({
      name: database_name,
      location: 'default',
    });

    // 1. Tabel Master (Kamus Barang)
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS barang (
        barcode TEXT PRIMARY KEY,
        kode TEXT,
        nama TEXT,
        ukuran TEXT,
        lokasi TEXT,
        stok_sistem INTEGER
      );
    `);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS master_lokasi (
        lo_idrec TEXT PRIMARY KEY,
        lo_cab TEXT,
        lo_lokasi TEXT,
        lo_jenis_nama TEXT
      );
    `);

    // 3. Tabel Hasil Scan (Transaksi)
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS hasil_opname (
        barcode TEXT,
        qty_fisik INTEGER DEFAULT 0,
        lokasi TEXT, 
        cabang TEXT,
        tgl_scan TEXT,
        is_uploaded INTEGER DEFAULT 0,
        PRIMARY KEY (barcode, lokasi, cabang) -- [FIX] Agar bisa scan barang sama di rak berbeda
      );
    `);

    // Tambahkan ALTER TABLE agar kolom is_uploaded muncul jika tabel sudah ada
    try {
      await db.executeSql(
        'ALTER TABLE hasil_opname ADD COLUMN is_uploaded INTEGER DEFAULT 0',
      );
    } catch (e) {}

    // Tambahkan migrasi otomatis untuk kolom cabang
    try {
      await db.executeSql('ALTER TABLE hasil_opname ADD COLUMN cabang TEXT');
      console.log('✅ Kolom cabang berhasil ditambahkan ke hasil_opname');
    } catch (e) {
      // Abaikan jika kolom sudah ada
    }

    // 3. Tabel Riwayat Upload (Log Lengkap)
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS upload_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tanggal TEXT,
        total_sku INTEGER,
        total_qty INTEGER,
        cabang TEXT,
        device TEXT,
        operator TEXT,
        items_json TEXT
      );
    `);

    // Master Barang Bazar (Wajib ada di initDB agar search tidak error)
    await db.executeSql(`
  CREATE TABLE IF NOT EXISTS bazar_barang (
    barcode TEXT,
    kode TEXT,
    nama TEXT,
    ukuran TEXT,
    harga_jual REAL DEFAULT 0,
    brg_minqty INTEGER DEFAULT 0, 
    brg_hargakhusus REAL DEFAULT 0, 
    kategori_kode TEXT,
    tipe_produk TEXT,
    promo_qty INTEGER DEFAULT 0, -- [BARU] Ambil dari kolom QTY Excel
    keterangan TEXT,             -- [BARU] Ambil dari kolom KETERANGAN Excel (BOX 1, dll)
    PRIMARY KEY (barcode, kode, ukuran)
  );
`);

    // Master Customer Bazar
    await db.executeSql(`
    CREATE TABLE IF NOT EXISTS bazar_customer (
      cus_kode TEXT PRIMARY KEY,
      cus_nama TEXT,
      cus_alamat TEXT,
      cus_cab TEXT -- Tambahkan di sini untuk user baru
    )
  `);

    // 2. MIGRASI: Tambahkan kolom cus_cab untuk user lama (HP yang sudah terinstal)
    try {
      await db.executeSql('ALTER TABLE bazar_customer ADD COLUMN cus_cab TEXT');
      console.log('✅ Kolom cus_cab berhasil ditambahkan ke bazar_customer');
    } catch (e) {
      // Error diabaikan karena kolom mungkin sudah ada
    }

    // Tabel Header Koreksi (tkor_hdr versi lokal)
    await db.executeSql(`
  CREATE TABLE IF NOT EXISTS bazar_opname_hdr (
    no_koreksi TEXT PRIMARY KEY,
    tanggal TEXT,
    operator TEXT,
    is_uploaded INTEGER DEFAULT 0
  );
`);

    // Tabel Detail Koreksi (tkor_dtl versi lokal)
    await db.executeSql(`
  CREATE TABLE IF NOT EXISTS bazar_opname_dtl (
    no_koreksi TEXT,
    barcode TEXT,
    qty_sistem REAL,
    qty_fisik REAL,
    selisih REAL,
    PRIMARY KEY (no_koreksi, barcode)
  );
`);

    await db.executeSql(`
  CREATE TABLE IF NOT EXISTS bazar_sales_hdr (
    so_nomor TEXT PRIMARY KEY,
    so_tanggal TEXT,
    so_customer TEXT,
    so_total REAL,
    so_bayar REAL,
    so_cash REAL,
    so_card REAL,
    so_voucher REAL,
    so_kembali REAL,
    so_bank_card TEXT,
    so_user_kasir TEXT,
    is_uploaded INTEGER DEFAULT 0
  );
`);

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS bazar_sales_dtl (
        sod_so_nomor TEXT,
        sod_brg_kode TEXT,
        sod_ukuran TEXT,
        sod_qty REAL,
        sod_harga REAL,
        sod_satuan_kasir TEXT, -- [FIX] Sesuai kolom Delphi
        sod_nourut INTEGER,    -- [BARU] Urutan item di nota
        PRIMARY KEY (sod_so_nomor, sod_brg_kode)
      );
    `);

    // Migrasi untuk HP yang sudah terlanjur instal
    try {
      await db.executeSql(
        'ALTER TABLE bazar_sales_dtl ADD COLUMN sod_ukuran TEXT',
      );
      console.log('✅ Kolom sod_ukuran berhasil ditambahkan.');
    } catch (e) {
      // Abaikan jika sudah ada
    }

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS bazar_rekening (
        rek_nomor TEXT PRIMARY KEY,
        rek_nama TEXT
      );
    `);

    // --- LOGIKA MIGRASI (Cek & Tambah kolom jika sudah ada tabel lama) ---
    // Karena SQLite tidak update kolom otomatis lewat CREATE TABLE, kita paksa di sini
    const addColumn = async (colName, type) => {
      try {
        await db.executeSql(
          `ALTER TABLE upload_log ADD COLUMN ${colName} ${type}`,
        );
        console.log(`Kolom ${colName} berhasil ditambahkan.`);
      } catch (e) {
        // Error di sini biasanya berarti kolom sudah ada, jadi aman diabaikan
      }
    };

    await addColumn('device', 'TEXT');
    await addColumn('operator', 'TEXT');
    await addColumn('items_json', 'TEXT');

    // --- LOGIKA MIGRASI TABEL BAZAR_BARANG [BARU] ---
    const addBazarColumn = async (colName, type) => {
      try {
        await db.executeSql(
          `ALTER TABLE bazar_barang ADD COLUMN ${colName} ${type}`,
        );
        console.log(`Kolom ${colName} berhasil ditambahkan ke bazar_barang.`);
      } catch (e) {
        // Error berarti kolom sudah ada, abaikan saja
      }
    };

    // Tambahkan kolom yang baru kita buat
    await addBazarColumn('brg_minqty', 'INTEGER DEFAULT 0');
    await addBazarColumn('promo_qty', 'INTEGER DEFAULT 0');
    await addBazarColumn('keterangan', 'TEXT');
    await addBazarColumn('harga_spesial', 'REAL DEFAULT 0');

    await repairData();

    await cleanOldBarcodes();

    console.log('Database & Tables Initialized');
  } catch (error) {
    console.error('SQLite Init Error:', error);
  }
};

// ==========================================
// FUNGSI KHUSUS BAZAR (KASIR)
// ==========================================

/**
 * Simpan master barang bazar dengan teknik Chunking agar tidak error di data besar
 */
export const insertMasterBarangBazar = async (items, onProgress) => {
  if (!db) await initDB();
  await db.executeSql('DELETE FROM bazar_barang');

  const batchSize = 1000;
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await new Promise((resolve, reject) => {
      db.transaction(
        tx => {
          chunk.forEach(item => {
            tx.executeSql(
              `INSERT OR REPLACE INTO bazar_barang 
            (barcode, kode, nama, ukuran, harga_jual, harga_spesial, brg_minqty, brg_hargakhusus, kategori_kode, tipe_produk, promo_qty, keterangan) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.barcode,
                item.kode,
                item.nama,
                item.ukuran,
                item.harga_jual || 0,
                item.harga_spesial || 0,
                item.brg_minqty || 0,
                item.brg_hargakhusus || 0,
                item.kategori,
                item.tipe_produk,
                item.promo_qty || 0, // [DATA BARU]
                item.keterangan || '', // [DATA BARU]
              ],
            );
          });
        },
        reject,
        resolve,
      );
    });
    if (onProgress) onProgress(Math.min(i + batchSize, total), total);
  }
  return true;
};

/**
 * Ambil data barang bazar berdasarkan scan barcode
 */
export const getBarangBazarByBarcode = async barcode => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT * FROM bazar_barang WHERE barcode = ?',
    [barcode],
  );
  // Sekarang hasil return sudah mengandung .promo_qty dan .keterangan
  return results.rows.length > 0 ? results.rows.item(0) : null;
};

/**
 * Simpan Transaksi Penjualan Bazar ke SQLite
 */
export const saveBazarTransaction = async (header, cart) => {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        // 1. Insert Header
        tx.executeSql(
          `INSERT INTO bazar_sales_hdr (
          so_nomor, so_tanggal, so_customer, so_total, so_bayar, 
          so_cash, so_card, so_voucher, so_kembali, so_bank_card, so_user_kasir
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            header.so_nomor,
            header.so_tanggal,
            header.so_customer,
            header.so_total,
            header.so_bayar,
            header.so_cash,
            header.so_card,
            header.so_voucher,
            header.so_kembali,
            header.so_bank_card,
            header.so_user_kasir,
          ],
        );

        // 2. Insert Details
        cart.forEach((item, index) => {
          tx.executeSql(
            `INSERT INTO bazar_sales_dtl (
              sod_so_nomor, sod_brg_kode, sod_ukuran, sod_qty, sod_harga, sod_satuan_kasir, sod_nourut
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`, // <--- Pastikan ada 7 tanda tanya
            [
              header.so_nomor,
              item.barcode,
              item.ukuran || '', // <--- SIMPAN UKURAN DISINI
              item.qty,
              item.harga,
              item.unit || 'PCS',
              index + 1,
            ],
          );
        });
      },
      reject,
      resolve,
    );
  });
};

/**
 * Mencari pelanggan bazar berdasarkan Nama atau Kode
 */
export const searchBazarCustomers = async (query = '') => {
  if (!db) await initDB();
  const lowerQuery = `%${query.toLowerCase()}%`;

  const [results] = await db.executeSql(
    `SELECT * FROM bazar_customer 
     WHERE cus_nama LIKE ? OR cus_kode LIKE ?
     LIMIT 100`,
    [lowerQuery, lowerQuery],
  );

  let temp = [];
  for (let i = 0; i < results.rows.length; i++) {
    temp.push(results.rows.item(i));
  }
  return temp;
};

/**
 * Simpan master customer hasil download
 */
export const insertMasterCustomerBazar = async customers => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql('DELETE FROM bazar_customer');
        customers.forEach(c => {
          tx.executeSql(
            'INSERT OR REPLACE INTO bazar_customer (cus_kode, cus_nama, cus_alamat, cus_cab) VALUES (?, ?, ?, ?)',
            [c.cus_kode, c.cus_nama, c.cus_alamat, c.cus_cab], // Simpan cus_cab
          );
        });
      },
      reject,
      resolve,
    );
  });
};

export const getDefaultCustomerByCabang = async cabang => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT cus_kode as kode, cus_nama as nama FROM bazar_customer WHERE cus_cab = ? LIMIT 1',
    [cabang],
  );
  if (results.rows.length > 0) {
    return results.rows.item(0);
  }
  return null;
};

/**
 * Mengambil jumlah data barang dan customer di database lokal
 */
export const getBazarCounts = async () => {
  if (!db) await initDB();

  // Gunakan SELECT COUNT(barcode) agar lebih spesifik dan cepat
  const [resProd] = await db.executeSql(
    'SELECT COUNT(barcode) as total FROM bazar_barang',
  );
  const [resCust] = await db.executeSql(
    'SELECT COUNT(cus_kode) as total FROM bazar_customer',
  );
  const [resRek] = await db.executeSql(
    'SELECT COUNT(rek_nomor) as total FROM bazar_rekening',
  );

  return {
    products: resProd.rows.item(0).total,
    customers: resCust.rows.item(0).total,
    accounts: resRek.rows.item(0).total,
  };
};

/**
 * Mengambil daftar tipe produk unik (Reguler, Promo, dll)
 */
export const getBazarTypes = async () => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT DISTINCT tipe_produk FROM bazar_barang WHERE tipe_produk IS NOT NULL AND tipe_produk != ""',
  );
  let temp = [];
  for (let i = 0; i < results.rows.length; i++)
    temp.push(results.rows.item(i).tipe_produk);
  return temp;
};
/**
 * Ambil data invoice yang belum terupload untuk disinkronkan ke server
 */
export const getPendingBazarSales = async () => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT * FROM bazar_sales_hdr WHERE is_uploaded = 0',
  );
  let invoices = [];
  for (let i = 0; i < results.rows.length; i++) {
    const hdr = results.rows.item(i);
    // [FIX] Gunakan sod_so_nomor dan so_nomor
    const [dtlResults] = await db.executeSql(
      'SELECT * FROM bazar_sales_dtl WHERE sod_so_nomor = ?',
      [hdr.so_nomor],
    );
    let details = [];
    for (let j = 0; j < dtlResults.rows.length; j++)
      details.push(dtlResults.rows.item(j));

    invoices.push({header: hdr, details: details});
  }
  return invoices;
};

/**
 * Mengambil riwayat nota dari database lokal
 */
export const getBazarSalesHistory = async () => {
  if (!db) await initDB();
  const [res] = await db.executeSql(
    'SELECT * FROM bazar_sales_hdr ORDER BY so_tanggal DESC',
  );
  let temp = [];
  for (let i = 0; i < res.rows.length; i++) {
    temp.push(res.rows.item(i));
  }
  return temp;
};

/**
 * Mengambil detail lengkap satu transaksi bazar (Header + Items)
 */
/**
 * Mengambil detail lengkap satu transaksi bazar (Header + Items)
 */
export const getBazarSaleDetail = async soNomor => {
  if (!db) await initDB();

  const [headers] = await db.executeSql(
    'SELECT * FROM bazar_sales_hdr WHERE so_nomor = ?',
    [soNomor],
  );
  if (headers.rows.length === 0) return null;
  const header = headers.rows.item(0);

  const [details] = await db.executeSql(
    `
    SELECT 
      d.sod_brg_kode AS barcode, 
      d.sod_qty AS qty, 
      d.sod_harga AS harga, 
      d.sod_ukuran AS ukuran,
      b.nama, 
      b.harga_jual,   -- [TAMBAHKAN INI]
      b.promo_qty,    -- [TAMBAHKAN INI]
      b.keterangan    -- [TAMBAHKAN INI]
    FROM bazar_sales_dtl d
    LEFT JOIN bazar_barang b ON d.sod_brg_kode = b.barcode
    WHERE d.sod_so_nomor = ?
    ORDER BY d.sod_nourut ASC
  `,
    [soNomor],
  );

  let dtlArr = [];
  for (let i = 0; i < details.rows.length; i++) {
    const item = details.rows.item(i);
    dtlArr.push({
      ...item,
      harga: parseFloat(item.harga) || 0,
      qty: parseFloat(item.qty) || 0,
      harga_jual: parseFloat(item.harga_jual) || 0,
    });
  }

  return {header, details: dtlArr};
};

/**
 * Mencari barang bazar berdasarkan Nama atau Barcode
 */
export const searchBazarProducts = async (query = '') => {
  if (!db) await initDB();
  const lowerQuery = `%${query.toLowerCase()}%`;

  const [results] = await db.executeSql(
    `SELECT * FROM bazar_barang 
     WHERE nama LIKE ? OR barcode LIKE ? OR kode LIKE ?
     LIMIT 100`,
    [lowerQuery, lowerQuery, lowerQuery],
  );

  let temp = [];
  for (let i = 0; i < results.rows.length; i++) {
    temp.push(results.rows.item(i));
  }
  return temp;
};

/**
 * Pencarian yang mendukung filter Kategori DAN Tipe
 */
export const searchBazarProductsOptimized = async (
  query = '',
  kategori = 'SEMUA',
  tipe = 'SEMUA',
) => {
  if (!db) await initDB();
  const lowerQuery = `%${query.toLowerCase()}%`;

  // Base Query
  let sql = `SELECT * FROM bazar_barang WHERE (nama LIKE ? OR barcode LIKE ? OR kode LIKE ?)`;
  let params = [lowerQuery, lowerQuery, lowerQuery];

  // Logika Filter Kategori
  if (kategori !== 'SEMUA' && kategori !== '') {
    sql += ` AND kategori_kode = ?`;
    params.push(kategori);
  }

  // Logika Filter Tipe Produk
  if (tipe !== 'SEMUA' && tipe !== '') {
    sql += ` AND tipe_produk = ?`;
    params.push(tipe);
  }

  sql += ` LIMIT 100`;

  try {
    const [results] = await db.executeSql(sql, params);
    let temp = [];
    for (let i = 0; i < results.rows.length; i++) {
      temp.push(results.rows.item(i));
    }
    return temp; // WAJIB return array
  } catch (error) {
    console.error('Gagal search produk:', error);
    return [];
  }
};

/**
 * Mengambil daftar kategori unik untuk Tab Filter
 */
export const getBazarCategories = async () => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT DISTINCT kategori_kode FROM bazar_barang WHERE kategori_kode IS NOT NULL AND kategori_kode != ""',
  );
  let temp = [];
  for (let i = 0; i < results.rows.length; i++)
    temp.push(results.rows.item(i).kategori_kode);
  return temp;
};

export const saveBazarOpname = async (header, details) => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          'INSERT INTO bazar_opname_hdr (no_koreksi, tanggal, operator) VALUES (?, ?, ?)',
          [header.no_koreksi, header.tanggal, header.operator],
        );
        details.forEach(it => {
          tx.executeSql(
            'INSERT INTO bazar_opname_dtl (no_koreksi, barcode, qty_sistem, qty_fisik, selisih) VALUES (?, ?, ?, ?, ?)',
            [
              header.no_koreksi,
              it.barcode,
              it.qty_sistem,
              it.qty_fisik,
              it.selisih,
            ],
          );
        });
      },
      reject,
      resolve,
    );
  });
};

export const getBazarOpnameHistory = async () => {
  if (!db) await initDB();
  const [res] = await db.executeSql(`
    SELECT h.*, d.barcode, b.nama, d.qty_fisik, d.selisih 
    FROM bazar_opname_hdr h
    JOIN bazar_opname_dtl d ON h.no_koreksi = d.no_koreksi
    JOIN bazar_barang b ON d.barcode = b.barcode
    ORDER BY h.tanggal DESC LIMIT 50
  `);
  let temp = [];
  for (let i = 0; i < res.rows.length; i++) temp.push(res.rows.item(i));
  return temp;
};

/**
 * Ambil semua data koreksi yang belum di-upload
 */
export const getPendingBazarOpname = async () => {
  if (!db) await initDB();
  const [res] = await db.executeSql(`
    SELECT h.*, d.barcode, d.qty_sistem, d.qty_fisik, d.selisih 
    FROM bazar_opname_hdr h
    JOIN bazar_opname_dtl d ON h.no_koreksi = d.no_koreksi
    WHERE h.is_uploaded = 0
  `);

  let results = [];
  for (let i = 0; i < res.rows.length; i++) {
    results.push(res.rows.item(i));
  }
  return results;
};

/**
 * Tandai data koreksi sebagai sudah ter-upload
 */
export const markBazarOpnameUploaded = async noKoreksi => {
  if (!db) await initDB();
  await db.executeSql(
    'UPDATE bazar_opname_hdr SET is_uploaded = 1 WHERE no_koreksi = ?',
    [noKoreksi],
  );
};

export const markBazarSalesUploaded = async soNomor => {
  if (!db) await initDB();
  await db.executeSql(
    'UPDATE bazar_sales_hdr SET is_uploaded = 1 WHERE so_nomor = ?',
    [soNomor],
  );
};

/**
 * Menentukan harga item berdasarkan jumlah barang sejenis (grup promo) di keranjang
 * @param {Object} item - Produk yang sedang dicek
 * @param {Array} cart - Seluruh isi keranjang belanja saat ini
 */
export const getDynamicPrice = (item, cart) => {
  const hargaSpesial = parseFloat(item.harga_spesial) || 0;
  const keterangan = (item.keterangan || '').trim().toUpperCase();
  const hargaJual = parseFloat(item.harga_jual) || 0;

  // 1. PRIORITAS 1: Harga Spesial (Harga khusus per barcode)
  if (hargaSpesial > 0) {
    return hargaSpesial;
  }

  // 2. PRIORITAS 2: Item Diskon 25%
  if (keterangan.includes('25%')) {
    return hargaJual * 0.75; // Potong langsung 25%
  }

  // 3. PRIORITAS 3: Logika Bundling (Paket 2, 3, 4, 5)
  const promoQty = parseInt(item.promo_qty) || 0;
  const boxGroup = item.keterangan;

  const totalInBox = cart
    .filter(it => it.keterangan === boxGroup)
    .reduce((sum, it) => sum + it.qty, 0);

  if (promoQty > 1) {
    if (totalInBox >= promoQty) {
      const jumlahPaket = Math.floor(totalInBox / promoQty);
      const sisaEcer = totalInBox % promoQty;
      const hargaEcerAsli = getHargaEcerAsli(item);

      const totalBiayaGrup = jumlahPaket * 100000 + sisaEcer * hargaEcerAsli;
      return totalBiayaGrup / totalInBox;
    } else {
      return getHargaEcerAsli(item);
    }
  }

  return hargaJual;
};

/**
 * Mendapatkan Nomor Nota Berikutnya (SAL-USER-YYYYMMDD-XXX)
 */
export const getNextBazarReceiptNumber = async (cabang, kodeKasir) => {
  if (!db) await initDB();

  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  // Format: B02-906-20260121-
  const prefix = `${cabang}-${kodeKasir}-${dateStr}`;

  const [res] = await db.executeSql(
    `SELECT so_nomor FROM bazar_sales_hdr WHERE so_nomor LIKE ? ORDER BY so_nomor DESC LIMIT 1`,
    [`${prefix}%`],
  );

  if (res.rows.length === 0) return `${prefix}001`;

  const lastNumber = res.rows.item(0).so_nomor;
  const lastCounter = parseInt(lastNumber.slice(-3));
  const nextCounter = (lastCounter + 1).toString().padStart(3, '0');

  return `${prefix}${nextCounter}`;
};

// Tambahkan Fungsi Baru:
export const insertMasterRekening = async rekenings => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        // Bersihkan dulu data lama
        tx.executeSql('DELETE FROM bazar_rekening');

        rekenings.forEach(r => {
          tx.executeSql(
            'INSERT OR REPLACE INTO bazar_rekening (rek_nomor, rek_nama) VALUES (?, ?)',
            [
              r.rek_nomor || r.nomor_rekening, // Cek mana yang dikirim API
              r.rek_nama || r.nama_bank, // Cek mana yang dikirim API
            ],
          );
        });
      },
      error => {
        console.error('Gagal transaksi simpan rekening:', error);
        reject(error);
      },
      () => {
        resolve();
      },
    );
  });
};

export const getMasterRekening = async () => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT * FROM bazar_rekening ORDER BY rek_nama ASC',
  );
  let temp = [];
  for (let i = 0; i < results.rows.length; i++) temp.push(results.rows.item(i));
  return temp;
};

export const getHargaEcerAsli = item => {
  const hargaSpesial = parseFloat(item.harga_spesial) || 0;
  const promoQty = parseInt(item.promo_qty) || 0;
  const hargaJual = parseFloat(item.harga_jual) || 0;

  // Jika harga spesial, maka ecer = spesial (karena tidak ada diskon lagi)
  if (hargaSpesial > 0) return hargaSpesial;

  // Jika bundling, hitung pinalti ecer (hargaJual + 5000)
  if (promoQty > 1) {
    let hargaEcer = Math.floor(100000 / promoQty) + 5000;
    if (promoQty === 3) hargaEcer = 38500;
    return hargaEcer;
  }

  return hargaJual;
};

// --- FUNGSI MASTER LOKASI [BARU] ---

/**
 * Menyimpan daftar lokasi hasil download dari server
 */
export const insertMasterLokasi = async locations => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql('DELETE FROM master_lokasi');
        locations.forEach(loc => {
          tx.executeSql(
            'INSERT OR REPLACE INTO master_lokasi (lo_idrec, lo_cab, lo_lokasi, lo_jenis_nama) VALUES (?, ?, ?, ?)',
            [loc.lo_idrec, loc.lo_cab, loc.lo_lokasi, loc.lo_jenis_nama],
          );
        });
      },
      error => reject(error),
      () => resolve(true),
    );
  });
};

/**
 * Validasi apakah kode yang di-scan adalah lokasi yang terdaftar
 */
export const isValidLocation = async lokasiKode => {
  if (!db) await initDB();
  const clean = String(lokasiKode).trim().toUpperCase();
  const [results] = await db.executeSql(
    'SELECT lo_lokasi FROM master_lokasi WHERE lo_lokasi = ?',
    [clean],
  );
  return results.rows.length > 0;
};

/**
 * Cek apakah sebuah lokasi masih punya data yang belum di-upload
 * Digunakan untuk syarat Unlock/Ganti Lokasi
 */
export const checkPendingByLokasi = async (lokasi, cabang) => {
  if (!db) await initDB();
  const clean = String(lokasi).trim().toUpperCase();
  const [results] = await db.executeSql(
    'SELECT COUNT(*) as count FROM hasil_opname WHERE lokasi = ? AND cabang = ? AND is_uploaded = 0',
    [clean, cabang],
  );
  return results.rows.item(0).count > 0;
};

// --- FUNGSI MASTER BARANG ---
/**
 * Simpan master barang Stok Opname dengan Progress (Chunking)
 */
export const insertMasterBarang = async (items, onProgress) => {
  if (!db) await initDB();

  // 1. Hapus data lama agar tidak duplikat
  await db.executeSql('DELETE FROM barang');

  const batchSize = 1000;
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await new Promise((resolve, reject) => {
      db.transaction(
        tx => {
          chunk.forEach(item => {
            const b_barcode = item.barcode ? String(item.barcode).trim() : '';
            if (b_barcode) {
              tx.executeSql(
                'INSERT OR REPLACE INTO barang (barcode, kode, nama, ukuran, lokasi, stok_sistem) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  b_barcode,
                  item.kode,
                  item.nama,
                  item.ukuran,
                  item.lokasi || '',
                  item.stok_sistem || 0,
                ],
              );
            }
          });
        },
        reject,
        resolve,
      );
    });

    // Kirim progress ke UI
    if (onProgress) {
      const currentProgress = Math.min(i + batchSize, total);
      onProgress(currentProgress, total);
    }
  }
  return true;
};

export const getBarangByBarcode = async barcode => {
  if (!db) await initDB();
  const clean = String(barcode).trim();
  const [results] = await db.executeSql(
    'SELECT * FROM barang WHERE barcode = ?',
    [clean],
  );
  return results.rows.length > 0 ? results.rows.item(0) : null;
};

// --- FUNGSI TRANSAKSI (OPNAME) ---
export const incrementOpnameQty = async (barcode, lokasi, cabang) => {
  if (!db) await initDB();
  const tgl = new Date().toISOString();

  // CLEANUP: Hapus nol di depan dan spasi
  const cleanBarcode = String(barcode).trim().replace(/^0+/, '');
  const cleanLokasi = String(lokasi).trim().toUpperCase();
  const cleanCabang = String(cabang).trim().toUpperCase();

  // Filter SELECT menyertakan cabang agar tidak mengambil data cabang lain
  const [check] = await db.executeSql(
    'SELECT qty_fisik, is_uploaded FROM hasil_opname WHERE barcode = ? AND lokasi = ? AND cabang = ?',
    [cleanBarcode, cleanLokasi, cleanCabang],
  );

  if (check.rows.length > 0) {
    const item = check.rows.item(0);
    const newQty = item.is_uploaded === 1 ? 1 : item.qty_fisik + 1;

    await db.executeSql(
      'UPDATE hasil_opname SET qty_fisik = ?, tgl_scan = ?, is_uploaded = 0 WHERE barcode = ? AND lokasi = ? AND cabang = ?',
      [newQty, tgl, cleanBarcode, cleanLokasi, cleanCabang],
    );
  } else {
    await db.executeSql(
      'INSERT INTO hasil_opname (barcode, qty_fisik, lokasi, cabang, tgl_scan, is_uploaded) VALUES (?, ?, ?, ?, ?, 0)',
      [cleanBarcode, 1, cleanLokasi, cleanCabang, tgl],
    );
  }
};

// [BARU] Fungsi ambil hanya yang belum upload
export const getPendingOpname = async cabang => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    `
      SELECT 
        h.barcode, h.lokasi, h.cabang,
        SUM(h.qty_fisik) as qty_fisik, 
        b.kode, b.nama, b.ukuran 
      FROM hasil_opname h
      LEFT JOIN barang b ON h.barcode = b.barcode
      WHERE h.is_uploaded = 0 AND h.cabang = ? -- [TAMBAHKAN INI]
      GROUP BY h.barcode, h.lokasi, h.cabang
  `,
    [cabang],
  );
  let temp = [];
  for (let i = 0; i < results.rows.length; i++) temp.push(results.rows.item(i));
  return temp;
};

// [BARU] Fungsi tandai sudah upload
export const markAsUploaded = async cabang => {
  if (!db) await initDB();
  // Pastikan hanya update cabang yang sedang dikerjakan
  await db.executeSql(
    'UPDATE hasil_opname SET is_uploaded = 1 WHERE is_uploaded = 0 AND cabang = ?',
    [cabang],
  );
};

// [BARU] Fungsi Hapus Satuan (Untuk koreksi kesalahan input)
export const deleteItemOpname = async (barcode, lokasi) => {
  if (!db) await initDB();
  const cleanBarcode = String(barcode).trim();
  const cleanLokasi = String(lokasi).trim().toUpperCase();
  await db.executeSql(
    'DELETE FROM hasil_opname WHERE barcode = ? AND lokasi = ?',
    [cleanBarcode, cleanLokasi],
  );
};

export const getHasilOpname = async cabang => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    `
    SELECT h.*, b.kode, b.nama, b.ukuran 
    FROM hasil_opname h
    LEFT JOIN barang b ON h.barcode = b.barcode
    WHERE h.cabang = ? -- [TAMBAHKAN INI]
    ORDER BY h.tgl_scan DESC
  `,
    [cabang],
  );

  let temp = [];
  for (let i = 0; i < results.rows.length; i++) temp.push(results.rows.item(i));
  return temp;
};

export const clearOpname = async () => {
  if (!db) await initDB();
  await db.executeSql('DELETE FROM hasil_opname');
};

// --- [BARU] FUNGSI RIWAYAT UPLOAD (LOG) ---

// Mencatat log setelah sukses upload parsial
export const saveUploadLog = async (
  totalSku,
  totalQty,
  cabang,
  device,
  operator,
  items,
) => {
  if (!db) await initDB();
  const now = new Date().toLocaleString('id-ID');

  // Ubah array items menjadi string agar bisa masuk ke kolom TEXT
  const itemsString = JSON.stringify(items);

  await db.executeSql(
    'INSERT INTO upload_log (tanggal, total_sku, total_qty, cabang, device, operator, items_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [now, totalSku, totalQty, cabang, device, operator, itemsString],
  );
};

// Mengambil daftar riwayat untuk ditampilkan di modal
export const getUploadHistory = async () => {
  if (!db) await initDB();
  const [results] = await db.executeSql(
    'SELECT * FROM upload_log ORDER BY id DESC',
  );
  let temp = [];
  for (let i = 0; i < results.rows.length; i++) {
    temp.push(results.rows.item(i));
  }
  return temp;
};

// Tambahkan di database.js
export const decrementOpnameQty = async (barcode, lokasi, cabang) => {
  if (!db) await initDB();
  const tgl = new Date().toISOString();

  // [FIX] Samakan cara bersih-bersih barcode dengan fungsi increment
  const cleanBarcode = String(barcode).trim().replace(/^0+/, '');
  const cleanLokasi = String(lokasi).trim().toUpperCase();
  const cleanCabang = String(cabang).trim().toUpperCase();

  const [check] = await db.executeSql(
    'SELECT qty_fisik, is_uploaded FROM hasil_opname WHERE barcode = ? AND lokasi = ? AND cabang = ?',
    [cleanBarcode, cleanLokasi, cleanCabang],
  );

  if (check.rows.length > 0) {
    const item = check.rows.item(0);
    if (item.is_uploaded === 1) return false;

    if (item.qty_fisik > 1) {
      await db.executeSql(
        'UPDATE hasil_opname SET qty_fisik = ?, tgl_scan = ? WHERE barcode = ? AND lokasi = ? AND cabang = ?',
        [item.qty_fisik - 1, tgl, cleanBarcode, cleanLokasi, cleanCabang],
      );
    } else {
      await db.executeSql(
        'DELETE FROM hasil_opname WHERE barcode = ? AND lokasi = ? AND cabang = ?',
        [cleanBarcode, cleanLokasi, cleanCabang],
      );
    }
    return true;
  }
  return false;
};

const repairData = async () => {
  try {
    // 1. Ambil data yang 'nyangkut' (is_uploaded = 0) dan jumlahkan
    await db.executeSql(`
      CREATE TEMPORARY TABLE temp_opname AS 
      SELECT barcode, SUM(qty_fisik) as qty, lokasi, cabang, MAX(tgl_scan) as tgl, 0 as uploaded
      FROM hasil_opname WHERE is_uploaded = 0
      GROUP BY barcode, lokasi, cabang; -- Grouping juga harus pakai cabang
    `);

    // 2. Hapus data lama yang berantakan
    await db.executeSql(`DELETE FROM hasil_opname WHERE is_uploaded = 0;`);

    // 3. Masukkan kembali dengan kolom cabang yang lengkap
    await db.executeSql(`
      INSERT INTO hasil_opname (barcode, qty_fisik, lokasi, cabang, tgl_scan, is_uploaded)
      SELECT barcode, qty, lokasi, cabang, tgl, uploaded FROM temp_opname;
    `);

    await db.executeSql(`DROP TABLE temp_opname;`);
    console.log(
      '✅ Database HP: Data nyangkut berhasil dirapikan (Cabang Aman).',
    );
  } catch (e) {
    console.log('ℹ️ Database HP: Tidak ada data yang perlu diperbaiki.');
  }
};

/**
 * Memaksa data yang sudah terupload menjadi "Pending" kembali
 * agar bisa di-upload ulang ke server.
 */
export const resetUploadStatusByLocation = async lokasi => {
  if (!db) await initDB();

  // Kita ubah is_uploaded dari 1 kembali ke 0
  const result = await db.executeSql(
    'UPDATE hasil_opname SET is_uploaded = 0 WHERE lokasi = ?',
    [lokasi],
  );

  return result;
};

// Tambahkan fungsi ini di Database.js
export const cleanOldBarcodes = async () => {
  if (!db) return;
  try {
    // Gunakan query yang lebih aman untuk SQLite
    await db.executeSql(`
      UPDATE hasil_opname 
      SET barcode = LTRIM(barcode, '0') 
      WHERE barcode LIKE '0%';
    `);
    console.log('✅ Database HP: Barcode 00 berhasil dibersihkan.');
  } catch (e) {
    console.log('❌ Gagal membersihkan barcode:', e.message);
  }
};
