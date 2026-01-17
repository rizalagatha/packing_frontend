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

    // 2. Tabel Hasil Scan (Transaksi)
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS hasil_opname (
        barcode TEXT,
        qty_fisik INTEGER DEFAULT 0,
        lokasi TEXT, 
        tgl_scan TEXT,
        is_uploaded INTEGER DEFAULT 0,
        PRIMARY KEY (barcode, lokasi) -- [FIX] Agar bisa scan barang sama di rak berbeda
      );
    `);

    // Tambahkan ALTER TABLE agar kolom is_uploaded muncul jika tabel sudah ada
    try {
      await db.executeSql(
        'ALTER TABLE hasil_opname ADD COLUMN is_uploaded INTEGER DEFAULT 0',
      );
    } catch (e) {}

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

    await repairData();

    console.log('Database & Tables Initialized');
  } catch (error) {
    console.error('SQLite Init Error:', error);
  }
};

// --- FUNGSI MASTER BARANG ---
export const insertMasterBarang = async items => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql('DELETE FROM barang');
        items.forEach(item => {
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
      error => reject(error),
      () => resolve(true),
    );
  });
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
export const incrementOpnameQty = async (barcode, lokasi) => {
  if (!db) await initDB();
  const tgl = new Date().toISOString();
  const cleanBarcode = String(barcode).trim();
  const cleanLokasi = String(lokasi).trim().toUpperCase();

  const [check] = await db.executeSql(
    'SELECT qty_fisik, is_uploaded FROM hasil_opname WHERE barcode = ? AND lokasi = ?',
    [cleanBarcode, cleanLokasi],
  );

  if (check.rows.length > 0) {
    const item = check.rows.item(0);
    const newQty = item.is_uploaded === 1 ? 1 : item.qty_fisik + 1;

    await db.executeSql(
      'UPDATE hasil_opname SET qty_fisik = ?, tgl_scan = ?, is_uploaded = 0 WHERE barcode = ? AND lokasi = ?',
      [newQty, tgl, cleanBarcode, cleanLokasi],
    );
  } else {
    await db.executeSql(
      'INSERT INTO hasil_opname (barcode, qty_fisik, lokasi, tgl_scan, is_uploaded) VALUES (?, ?, ?, ?, 0)',
      [cleanBarcode, 1, cleanLokasi, tgl],
    );
  }
};

// [BARU] Fungsi ambil hanya yang belum upload
export const getPendingOpname = async () => {
  if (!db) await initDB();
  // GROUP BY akan menyatukan baris yang barcode & lokasinya sama
  const [results] = await db.executeSql(`
      SELECT 
        h.barcode, 
        h.lokasi, 
        SUM(h.qty_fisik) as qty_fisik, 
        b.kode, 
        b.nama, 
        b.ukuran 
      FROM hasil_opname h
      LEFT JOIN barang b ON h.barcode = b.barcode
      WHERE h.is_uploaded = 0
      GROUP BY h.barcode, h.lokasi
  `);
  let temp = [];
  for (let i = 0; i < results.rows.length; i++) temp.push(results.rows.item(i));
  return temp;
};

// [BARU] Fungsi tandai sudah upload
export const markAsUploaded = async () => {
  if (!db) await initDB();
  await db.executeSql(
    'UPDATE hasil_opname SET is_uploaded = 1 WHERE is_uploaded = 0',
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

export const getHasilOpname = async () => {
  if (!db) await initDB();
  const [results] = await db.executeSql(`
    SELECT h.*, b.kode, b.nama, b.ukuran 
    FROM hasil_opname h
    LEFT JOIN barang b ON h.barcode = b.barcode
    ORDER BY h.tgl_scan DESC -- [PENTING] Agar yang baru muncul di atas
  `);
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
export const decrementOpnameQty = async (barcode, lokasi) => {
  if (!db) await initDB();
  const tgl = new Date().toISOString();
  const cleanBarcode = String(barcode).trim();
  const cleanLokasi = String(lokasi).trim().toUpperCase();

  const [check] = await db.executeSql(
    'SELECT qty_fisik, is_uploaded FROM hasil_opname WHERE barcode = ? AND lokasi = ?',
    [cleanBarcode, cleanLokasi],
  );

  if (check.rows.length > 0) {
    const item = check.rows.item(0);

    // Validasi: Jangan kurangi jika sudah terupload (mencegah desinkronisasi server)
    if (item.is_uploaded === 1) return false;

    if (item.qty_fisik > 1) {
      await db.executeSql(
        'UPDATE hasil_opname SET qty_fisik = ?, tgl_scan = ? WHERE barcode = ? AND lokasi = ?',
        [item.qty_fisik - 1, tgl, cleanBarcode, cleanLokasi],
      );
    } else {
      await db.executeSql(
        'DELETE FROM hasil_opname WHERE barcode = ? AND lokasi = ?',
        [cleanBarcode, cleanLokasi],
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
      SELECT barcode, SUM(qty_fisik) as qty, lokasi, MAX(tgl_scan) as tgl, 0 as uploaded
      FROM hasil_opname WHERE is_uploaded = 0
      GROUP BY barcode, lokasi;
    `);

    // 2. Hapus data lama yang berantakan
    await db.executeSql(`DELETE FROM hasil_opname WHERE is_uploaded = 0;`);

    // 3. Masukkan kembali data yang sudah rapi (sudah di-SUM)
    await db.executeSql(`
      INSERT INTO hasil_opname (barcode, qty_fisik, lokasi, tgl_scan, is_uploaded)
      SELECT barcode, qty, lokasi, tgl, uploaded FROM temp_opname;
    `);

    await db.executeSql(`DROP TABLE temp_opname;`);
    console.log('✅ Database HP: Data nyangkut berhasil dirapikan otomatis.');
  } catch (e) {
    console.log('ℹ️ Database HP: Tidak ada data yang perlu diperbaiki.');
  }
};
