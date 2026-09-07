import axios from 'axios';

// PENTING: Sesuaikan dengan alamat IP Anda!
const API_URL = 'http://103.94.238.252:3000/api'; // Port Mobile (3000)
// const API_URL = 'http://192.168.99.112:3004/api';
const API_URL_WEB = 'http://103.94.238.252:8000/api'; // Port Web (8000)

// Instance standar untuk fitur Mobile (Packing, SJ, Bazar, dll)
export const apiClient = axios.create({
  baseURL: API_URL,
});

// Instance khusus untuk fitur yang ingin disamakan dengan Web (Dashboard Performance)
export const apiClientWeb = axios.create({
  baseURL: API_URL_WEB,
});

// --- Auth ---
export const loginApi = (userKode, password, latitude, longitude) => {
  return apiClient.post(
    '/auth/login',
    {
      user_kode: userKode,
      user_password: password,
      source: 'mobile',
      latitude: latitude,
      longitude: longitude,
    },
    {
      timeout: 10000, // Timeout 10 detik agar user tidak nge-hang jika GPS macet
    },
  );
};

export const selectBranchApi = (
  branchCode,
  preAuthToken,
  latitude,
  longitude,
) => {
  return apiClient.post('/auth/select-branch', {
    branchCode,
    preAuthToken,
    latitude, // <--- Dikirim ke Backend
    longitude, // <--- Dikirim ke Backend
  });
};

export const updateFcmTokenApi = (fcmToken, token) => {
  return apiClient.put(
    '/auth/fcm-token',
    {fcmToken},
    {
      headers: {Authorization: `Bearer ${token}`},
    },
  );
};

// --- Auth (Lanjutan: Device Binding / Keystore) ---

// 1. Mendaftarkan perangkat baru
export const enrollDeviceApi = (
  userKode,
  password,
  deviceId,
  publicKey,
  deviceName,
) => {
  return apiClient.post('/auth/enroll-device', {
    user_kode: userKode,
    user_password: password,
    device_id: deviceId,
    public_key: publicKey,
    device_name: deviceName,
  });
};

// 2. Meminta teka-teki (Challenge) dari backend
export const requestChallengeApi = (userKode, deviceId) => {
  return apiClient.post('/auth/request-challenge', {
    user_kode: userKode,
    device_id: deviceId,
  });
};

// 3. Login menggunakan Signature dari Keystore
export const loginWithDeviceApi = (
  userKode,
  password,
  deviceId,
  signature,
  latitude,
  longitude,
) => {
  return apiClient.post('/auth/login-device', {
    user_kode: userKode,
    user_password: password,
    device_id: deviceId,
    signature: signature,
    latitude: latitude,
    longitude: longitude,
  });
};

export const enrollDeviceNoBioApi = (
  userKode,
  password,
  deviceId,
  deviceSecret,
  deviceName,
) => {
  return apiClient.post('/auth/enroll-device-nobio', {
    user_kode: userKode,
    user_password: password,
    device_id: deviceId,
    device_secret: deviceSecret,
    device_name: deviceName,
  });
};

export const loginWithDeviceNoBioApi = (
  userKode,
  password,
  deviceId,
  deviceSecret,
  latitude,
  longitude,
) => {
  return apiClient.post('/auth/login-device-nobio', {
    user_kode: userKode,
    user_password: password,
    device_id: deviceId,
    device_secret: deviceSecret,
    latitude,
    longitude,
  });
};

// --- Packing ---
export const getPackingHistoryApi = (params, token) => {
  return apiClient.get('/packing/history', {
    params: params, // -> Kirim semua parameter (termasuk filter tanggal)
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getPackingDetailApi = (packNomor, token) => {
  const encodedPackNomor = encodeURIComponent(packNomor);
  return apiClient.get(`/packing/${encodedPackNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};
export const savePackingApi = (data, token) => {
  return apiClient.post('/packing', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Produk ---
export const validateBarcodeApi = (barcode, gudang, token, spk_nomor) => {
  const params = {gudang};

  if (spk_nomor) {
    params.spk_nomor = spk_nomor;
  }
  return apiClient.get(`/produk/${barcode}`, {
    params: params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Surat Jalan ---
// -> FUNGSI BARU UNTUK SCAN PACKING
export const getItemsFromPackingApi = (packNomor, token) => {
  const encodedPackNomor = encodeURIComponent(packNomor);
  return apiClient.get(`/surat-jalan/load-from-packing/${encodedPackNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const searchStoresApi = (params, token) => {
  return apiClient.get('/surat-jalan/search/stores', {
    params: {
      term: params.term,
      page: params.page,
      itemsPerPage: params.itemsPerPage,
      excludeBranch: params.excludeBranch,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const saveSuratJalanApi = (data, token) => {
  return apiClient.post('/surat-jalan', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getSuratJalanHistoryApi = (params, token) => {
  return apiClient.get('/surat-jalan/history', {
    params: {
      // { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
      startDate: params.startDate,
      endDate: params.endDate,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// --- Terima SJ ---
export const searchSjToReceiveApi = (params, token) => {
  return apiClient.get('/terima-sj/search-sj', {
    params: {term: params.term},
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadSjToReceiveApi = (nomorSj, token) => {
  const encodedNomorSj = encodeURIComponent(nomorSj);
  return apiClient.get(`/terima-sj/load-sj/${encodedNomorSj}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const saveTerimaSjApi = (data, token) => {
  return apiClient.post('/terima-sj', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const savePendingSjApi = (data, token) => {
  // 'data' di sini adalah 'payload' yang kita buat di TerimaSjScreen
  return apiClient.post('/terima-sj/pending', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const searchPendingSjApi = (params, token) => {
  return apiClient.get('/terima-sj/pending/search', {
    params: {term: params.term},
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadPendingSjApi = (pendingNomor, token) => {
  const encodedNomor = encodeURIComponent(pendingNomor);
  return apiClient.get(`/terima-sj/pending/load/${encodedNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getSuratJalanDetailApi = (nomorSj, token) => {
  const encodedNomorSj = encodeURIComponent(nomorSj);
  return apiClient.get(`/surat-jalan/${encodedNomorSj}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const searchPermintaanApi = (params, token) => {
  return apiClient.get('/surat-jalan/search/permintaan', {
    params: {
      // { term, storeKode, page }
      ...params,
    },
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadItemsApi = (nomor, gudang, token) => {
  return apiClient.get('/surat-jalan/load-items', {
    params: {nomor, gudang},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Retur Admin ---
export const searchPendingReturApi = (params, token) => {
  return apiClient.get('/retur-admin/search-penerimaan', {
    params: {
      term: params.term,
      status: params.status, // -> Tambahkan parameter status
    },
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadSelisihDataApi = (pendingNomor, token) => {
  const encodedNomor = encodeURIComponent(pendingNomor);
  return apiClient.get(`/retur-admin/load-selisih/${encodedNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const saveReturApi = (data, token) => {
  return apiClient.post('/retur-admin', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- SPK ---
export const searchSpkByBarcodeApi = (barcode, token) => {
  return apiClient.get(`/spk/by-barcode/${barcode}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- WhatsApp ---
export const getWhatsappQrApi = token => {
  return apiClient.get('/whatsapp/qr', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const deleteWhatsappSessionApi = token => {
  return apiClient.delete('/whatsapp/session', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getWhatsappStatusApi = token => {
  return apiClient.get('/whatsapp/status', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Checker ---
export const searchStbjApi = (params, token) => {
  return apiClient.get('/checker/search-stbj', {
    params: {term: params.term},
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadStbjDataApi = (stbjNomor, token) => {
  const encodedStbjNomor = encodeURIComponent(stbjNomor); // -> Amankan URL
  return apiClient.get(`/checker/load-stbj/${encodedStbjNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getPackingDetailForCheckerApi = (nomor, token) => {
  return apiClient.get(`/checker/packing-detail/${nomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const onCheckApi = (data, token) => {
  return apiClient.post('/checker/on-check', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Mutasi Antar Store ---
export const searchTujuanStoreApi = (params, token) => {
  return apiClient.get('/mutasi-store/lookup-tujuan', {
    params, // Tidak perlu term, tapi kita tetap kirim untuk konsistensi
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const saveMutasiApi = (data, token) => {
  return apiClient.post('/mutasi-store', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Mutasi Antar Store Terima ---
export const searchMutasiKirimApi = (params, token) => {
  return apiClient.get('/mutasi-terima/search-kirim', {
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadMutasiKirimApi = (nomorKirim, token) => {
  const encodedNomor = encodeURIComponent(nomorKirim);
  return apiClient.get(`/mutasi-terima/load-kirim/${encodedNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const saveMutasiTerimaApi = (data, token) => {
  return apiClient.post('/mutasi-terima', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Analisis Stok ---
export const getLowStockApi = (params, token) => {
  return apiClient.get('/stock/low-stock', {
    params, // { cabang, kategori }
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const createPermintaanOtomatisApi = (payload, token) => {
  return apiClient.post('/stock/create-auto', payload, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Minta Barang ---
export const getAutoBufferApi = token => {
  return apiClient.get('/minta-barang/auto-buffer', {
    headers: {Authorization: `Bearer ${token}`},
  });
};
export const scanMintaBarangApi = (barcode, token) => {
  return apiClient.get(`/minta-barang/scan/${barcode}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};
export const saveMintaBarangApi = (data, token) => {
  return apiClient.post('/minta-barang', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Penjualan Langsung ---
export const getDefaultCustomerApi = token => {
  return apiClient.get('/penjualan/default-customer', {
    headers: {Authorization: `Bearer ${token}`},
  });
};
export const scanProdukPenjualanApi = (barcode, targetCabang, token) => {
  return apiClient.get(`/penjualan/scan/${barcode}`, {
    params: {cabang: targetCabang}, // <-- TAMBAHKAN PARAMETER INI
    headers: {Authorization: `Bearer ${token}`},
  });
};
export const savePenjualanApi = (data, token) => {
  return apiClient.post('/penjualan/save', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const searchRekeningApi = (params, token) => {
  return apiClient.get('/penjualan/rekening', {
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

// Fungsi Kirim Gambar (Multipart)
export const sendStrukWaImageApi = async (formData, token) => {
  return apiClient.post('/penjualan/send-wa-image', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data', // <--- AKTIFKAN INI
    },
    // FUNGSI INI WAJIB ADA:
    // Mencegah Axios mengubah FormData menjadi JSON string yang bikin error
    transformRequest: (data, headers) => {
      return data;
    },
    timeout: 30000, // Timeout diperpanjang jadi 30 detik buat upload
  });
};

// --- Invoice Browse (Mobile) ---
export const getInvoicesApi = (params, token) => {
  return apiClient.get('/invoices', {
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getInvoiceDetailsApi = (nomor, token) => {
  // Encode nomor karena bisa mengandung karakter slash atau titik
  return apiClient.get(`/invoices/details/${encodeURIComponent(nomor)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getActivePromosApi = (params, token) => {
  return apiClient.get('/penjualan/promos', {
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getPromoItemsApi = (nomor, token) => {
  return apiClient.get(`/penjualan/promo-items/${nomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getPrintDataApi = (nomor, token) => {
  return apiClient.get(`/penjualan/print/${encodeURIComponent(nomor)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const sendStrukWaApi = (data, token) => {
  return apiClient.post('/penjualan/send-wa', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Stok Opname ---
export const getCabangListApi = token => {
  return apiClient.get('/stok-opname/cabang', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// -> TAMBAHKAN INI (Untuk Download Master Barang)
export const downloadMasterDataApi = (token, cabangKode) => {
  return apiClient.get('/stok-opname/download', {
    params: {cabang: cabangKode}, // Kirim parameter cabang agar data tidak kosong
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const downloadMasterLokasiApi = (token, cabangKode) => {
  return apiClient.get('/stok-opname/download-lokasi', {
    params: {cabang: cabangKode},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// -> TAMBAHKAN INI (Untuk Upload Hasil Scan)
export const uploadOpnameResultApi = (data, token) => {
  return apiClient.post('/stok-opname/upload', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const checkMismatchLokasiApi = (cabang, lokasi, token) => {
  return apiClient.get('/stok-opname/compare-lokasi', {
    // Sesuaikan base URL route Anda
    params: {cabang, lokasi},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Dashboard Management (UPDATED WITH FILTER) ---

// 1. Statistik Hari Ini (Terima filter cabang)
export const getDashboardTodayStatsApi = (token, cabang = '') => {
  return apiClient.get('/dashboard/today-stats', {
    params: {cabang}, // Kirim param cabang
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 2. Total Piutang (Terima filter cabang)
export const getDashboardPiutangApi = (token, cabang = '') => {
  return apiClient.get('/dashboard/total-sisa-piutang', {
    params: {cabang}, // Kirim param cabang
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 3. Branch Performance (Tidak perlu ubah, karena akan di-hide di frontend jika difilter)
export const getDashboardBranchPerformanceApi = token => {
  return apiClient.get('/dashboard/branch-performance', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 4. Sales Chart (Sudah support via object params, pastikan frontend kirim property 'cabang')
export const getDashboardSalesChartApi = (params, token) => {
  return apiClient.get('/dashboard/sales-chart', {
    params, // { startDate, endDate, groupBy, cabang } <--- Cabang sudah ada di sini
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardPendingActionsApi = token => {
  return apiClient.get('/dashboard/pending-actions', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 5. Target Summary (Terima filter cabang)
export const getDashboardTargetSummaryApi = (token, cabang = '') => {
  return apiClient.get('/dashboard/sales-target-summary', {
    params: {cabang}, // Kirim param cabang
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 6. List Sisa Piutang Per Cabang (Tidak perlu ubah)
export const getDashboardPiutangPerCabangApi = token => {
  return apiClient.get('/dashboard/piutang-per-cabang', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 7. Detail Invoice Piutang (Tidak perlu ubah)
export const getDashboardPiutangDetailApi = (kodeCabang, token) => {
  return apiClient.get(`/dashboard/piutang-detail/${kodeCabang}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 8. Top Selling (Sudah support branchFilter)
export const getDashboardTopSellingApi = (token, branchFilter = '') => {
  return apiClient.get('/dashboard/top-selling', {
    params: {branchFilter},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 9. Cek Sebaran Stok (Interaktif)
export const getDashboardStockSpreadApi = (barcode, ukuran, token) => {
  return apiClient.get(`/dashboard/stock-spread/${barcode}`, {
    params: {ukuran},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 10. Trends (Sudah support branchFilter)
export const getDashboardTrendsApi = (token, branchFilter = '') => {
  return apiClient.get('/dashboard/trends', {
    params: {branchFilter},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 11. Empty Stock (Sudah support targetCabang)
export const getEmptyStockRegulerApi = (
  token,
  search = '',
  targetCabang = '',
) => {
  return apiClient.get('/dashboard/stock-empty-reguler', {
    params: {search, targetCabang},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 12. Sales Spread (Interaktif)
export const getDashboardProductSalesSpreadApi = async (
  kode,
  ukuran,
  token,
) => {
  return apiClient.get('/dashboard/sales-spread', {
    headers: {Authorization: `Bearer ${token}`},
    params: {kode, ukuran},
  });
};

export const getTodayLostOrdersApi = (token, cabang = '') => {
  return apiClient.get('/dashboard/today-lost-orders', {
    params: {cabang},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Authorization (Tidak Berubah) ---
export const getPendingAuthorizationApi = async token => {
  return apiClient.get('/authorization/pending', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const processAuthorizationApi = async (authNomor, action, token) => {
  return apiClient.post(
    '/authorization/process',
    {authNomor, action},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

// 13. Laporan Stok Minus
export const getDashboardNegativeStockApi = (token, cabang = '') => {
  return apiClient.get('/dashboard/laporan-stok-minus', {
    params: {
      cabang: cabang,
    },
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Packing List ---
// 1. Simpan (Create/Update)
export const savePackingListApi = (data, token) => {
  return apiClient.post('/packing-list-form/save', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 2. Load Data Edit
export const getPackingListDetailApi = (nomor, token) => {
  return apiClient.get(`/packing-list-form/form/${encodeURIComponent(nomor)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 3. Load dari Permintaan Store
export const loadItemsFromRequestApi = (nomorPermintaan, token) => {
  return apiClient.get('/packing-list-form/load-request', {
    params: {nomor: nomorPermintaan},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 4. Cari Barang via Barcode
export const findProductByBarcodeApi = (barcode, token) => {
  return apiClient.get(`/packing-list-form/barcode/${barcode}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 5. Lookup Permintaan (Untuk Modal Search)
export const searchPermintaanOpenApi = (params, token) => {
  return apiClient.get('/packing-list-form/search-permintaan', {
    // Pastikan endpoint ini ada di backend route Anda
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

// Tambahkan ini
export const getPackingListHistoryApi = (params, token) => {
  // [FIX] Tambahkan '/list' di akhir
  return apiClient.get('/packing-list-form/history/list', {
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getPackingListHistoryDetailApi = (nomor, token) => {
  return apiClient.get(`/packing-list-form/history/${nomor}/detail`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Stok Real Time ---

export const getRealTimeStockApi = (token, filters) => {
  // Jika di backend "/api/laporan-stok" dan di route file "/real-time"
  return apiClient.get('/laporan-stok/real-time', {
    // <--- Cek apakah butuh awalan /api/ atau tidak
    params: filters,
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getGudangOptionsApi = token => {
  return apiClient.get('/laporan-stok/gudang-options', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Ambil Barang ---
export const getProductByBarcodeAmbilApi = (barcode, gudang, token) => {
  return apiClient.get('/ambil-barang-form/lookup/product-by-barcode', {
    params: {barcode, gudang},
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 2. Simpan data pengambilan barang
export const saveAmbilBarangApi = (payload, token) => {
  return apiClient.post('/ambil-barang-form', payload, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 3. Load data untuk edit (jika diperlukan)
export const getAmbilBarangDetailApi = (id, token) => {
  return apiClient.get(`/ambil-barang-form/${id}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Bazar ---
/**
 * Mengambil data master barang khusus bazar (dengan harga)
 */
export const downloadMasterBazarApi = async (token, cabang) => {
  try {
    return await apiClient.get('/bazar/download-master', {
      params: {cabang}, // Mengirim ?cabang=xxx ke backend
      headers: {Authorization: `Bearer ${token}`},
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Mengirim data invoice pameran secara massal (Bulk Upload)
 */
export const uploadBazarSalesApi = async (payload, token) => {
  try {
    return await apiClient.post('/bazar/upload-sales', payload, {
      headers: {Authorization: `Bearer ${token}`},
    });
  } catch (error) {
    throw error;
  }
};

export const uploadKoreksiBazarApi = (data, token) => {
  return apiClient.post('/bazar/upload-koreksi', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const createBazarCustomerApi = (nama, hp, cabang, token) => {
  return apiClient.post(
    '/bazar/create-customer',
    {nama, hp, cabang},
    {headers: {Authorization: `Bearer ${token}`}},
  );
};

// --- Terima Retur DC ---
export const searchReturToReceiveApi = (params, token) => {
  return apiClient.get('/terima-retur-dc/search', {
    params: {term: params.term},
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const loadReturDetailApi = (nomorRb, token) => {
  const encodedNomor = encodeURIComponent(nomorRb);
  return apiClient.get(`/terima-retur-dc/load/${encodedNomor}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const savePendingReturDcApi = (data, token) => {
  return apiClient.post('/terima-retur-dc/pending', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const saveTerimaReturDcApi = (data, token) => {
  return apiClient.post('/terima-retur-dc/save', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Lost Order ---
export const saveLostOrderApi = (data, token) => {
  return apiClient.post('/lost-order', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getLostOrderHistoryApi = (params, token) => {
  return apiClient.get('/lost-order', {
    params,
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Scan Auto Mutasi SO (Mobile) ---
export const getSoListMobileApi = (params, token) => {
  return apiClient.get('/mobile/so', {
    params, // { term, startDate, endDate }
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getSoDetailMobileApi = (nomorSo, token) => {
  return apiClient.get(`/mobile/so/details/${encodeURIComponent(nomorSo)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const scanAutoMutasiApi = (data, token) => {
  return apiClient.post('/mobile/so/auto-mutasi-scan', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Minta Bahan (Kaosan) ---
export const getMintaBahanListApi = (params, token) => {
  return apiClient.get('/minta-bahan', {
    params, // { startDate, endDate, keyword }
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getMintaBahanDetailsApi = (nomor, token) => {
  return apiClient.get(`/minta-bahan/${encodeURIComponent(nomor)}/details`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const checkMintaBahanUnapprovedApi = token => {
  return apiClient.get('/minta-bahan/check-unapproved', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const approveMintaBahanRealisasiApi = (noRealisasi, token) => {
  return apiClient.put(
    `/minta-bahan/realisasi/${encodeURIComponent(noRealisasi)}/approve`,
    {},
    {headers: {Authorization: `Bearer ${token}`}},
  );
};

export const deleteMintaBahanApi = (nomor, token) => {
  return apiClient.delete(`/minta-bahan/${encodeURIComponent(nomor)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getMintaBahanExportSummaryApi = (params, token) => {
  return apiClient.get('/minta-bahan/export-summary', {
    params, // { startDate, endDate }
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Minta Bahan Form (Kaosan) ---
export const searchBarangKaosanApi = (keyword, jenis, token) => {
  return apiClient.get('/minta-bahan-form/search-barang', {
    params: {keyword, jenis},
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getMintaBahanFormForEditApi = (nomor, token) => {
  return apiClient.get(`/minta-bahan-form/${encodeURIComponent(nomor)}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const saveMintaBahanFormApi = (payload, token) => {
  return apiClient.post('/minta-bahan-form/save', payload, {
    headers: {Authorization: `Bearer ${token}`},
  });
};
