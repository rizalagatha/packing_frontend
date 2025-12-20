import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const database_name = 'StokOpname.db';
// const database_version = "1.0"; // Tidak terlalu dipedulikan library ini
// const database_displayname = "SQLite Stok Opname";
// const database_size = 200000;

let db;

export const initDB = async () => {
  try {
    // Buka database dengan cara paling standar
    db = await SQLite.openDatabase({
      name: database_name,
      location: 'default',
    });

    // Tabel Master (Kamus Barang)
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

    // Tabel Hasil Scan (Transaksi)
    // Mirip 'thitungstok' di Delphi
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS hasil_opname (
        barcode TEXT PRIMARY KEY,
        qty_fisik INTEGER DEFAULT 0,
        lokasi TEXT, 
        tgl_scan TEXT
      );
    `);
  } catch (error) {
    console.error('SQLite Init Error:', error);
  }
};

// --- FUNGSI INSERT MASTER YANG KUAT (BULK INSERT) ---
export const insertMasterBarang = async items => {
  if (!db) await initDB();

  console.log(`Mulai menyimpan ${items.length} data ke SQLite...`);

  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        // 1. Hapus data lama (Reset Master)
        tx.executeSql(
          'DELETE FROM barang',
          [],
          () => {},
          err => console.log('Del err', err),
        );

        // 2. Insert data baru
        items.forEach(item => {
          // Pastikan data string dan di-TRIM
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
      error => {
        // Jika Transaksi Gagal
        console.error('TRANSACTION ERROR:', error);
        reject(error);
      },
      () => {
        // Jika Transaksi Sukses
        console.log('TRANSACTION SUCCESS');
        resolve(true);
      },
    );
  });
};

export const getBarangByBarcode = async barcode => {
  if (!db) await initDB();
  const clean = String(barcode).trim();
  // Cari persis seperti di Delphi
  const [results] = await db.executeSql(
    'SELECT * FROM barang WHERE barcode = ?',
    [clean],
  );
  return results.rows.length > 0 ? results.rows.item(0) : null;
};

// FUNGSI BARU: Tambah Qty +1 Otomatis (Scan Mode)
export const incrementOpnameQty = async (barcode, lokasi) => {
  if (!db) await initDB();
  const tgl = new Date().toISOString();
  const cleanBarcode = String(barcode).trim();

  // Cek apakah data sudah ada?
  const [check] = await db.executeSql(
    'SELECT qty_fisik FROM hasil_opname WHERE barcode = ?',
    [cleanBarcode],
  );

  if (check.rows.length > 0) {
    // Jika ada, UPDATE qty = qty + 1
    // Kita update lokasinya juga (asumsi barang yang sama bisa ketemu di rak berbeda di sesi scan yang sama,
    // atau user ingin update lokasi terakhir)
    const currentQty = check.rows.item(0).qty_fisik;
    await db.executeSql(
      'UPDATE hasil_opname SET qty_fisik = ?, lokasi = ?, tgl_scan = ? WHERE barcode = ?',
      [currentQty + 1, lokasi, tgl, cleanBarcode],
    );
  } else {
    // Jika belum ada, INSERT qty = 1
    await db.executeSql(
      'INSERT INTO hasil_opname (barcode, qty_fisik, lokasi, tgl_scan) VALUES (?, ?, ?, ?)',
      [cleanBarcode, 1, lokasi, tgl],
    );
  }
};

// --- MIRIP LOGIKA flagedit DI DELPHI ---
export const getExistingOpname = async barcode => {
  if (!db) await initDB();
  const clean = String(barcode).trim();
  const [results] = await db.executeSql(
    'SELECT * FROM hasil_opname WHERE barcode = ?',
    [clean],
  );
  return results.rows.length > 0 ? results.rows.item(0) : null;
};

// --- MIRIP LOGIKA Button2Click (Simpan/Update) ---
export const updateHasilOpname = async (barcode, qty, lokasi) => {
  if (!db) await initDB();
  const tgl = new Date().toISOString();
  const clean = String(barcode).trim();

  // Menggunakan INSERT OR REPLACE (Upsert)
  // Ini menggantikan logika 'if flagedit then update else insert'
  await db.executeSql(
    `
        INSERT OR REPLACE INTO hasil_opname (barcode, qty_fisik, lokasi, tgl_scan) 
        VALUES (?, ?, ?, ?)
    `,
    [clean, qty, lokasi, tgl],
  );
};

export const getHasilOpname = async () => {
  if (!db) await initDB();
  // Join agar List menampilkan Nama Barang (seperti uListHitungStok)
  const [results] = await db.executeSql(`
        SELECT h.barcode, h.qty_fisik, h.lokasi, b.kode, b.nama, b.ukuran 
        FROM hasil_opname h
        LEFT JOIN barang b ON h.barcode = b.barcode
        ORDER BY h.tgl_scan DESC
    `);

  let temp = [];
  for (let i = 0; i < results.rows.length; i++) {
    temp.push(results.rows.item(i));
  }
  return temp;
};

// FUNGSI HAPUS YANG LEBIH AMAN (Pakai Transaction & Promise)
export const clearOpname = async () => {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM hasil_opname',
        [],
        () => {
          console.log('Data berhasil dibersihkan');
          resolve(true); // Sukses
        },
        error => {
          console.error('Gagal hapus data:', error);
          reject(error); // Gagal
        },
      );
    });
  });
};
