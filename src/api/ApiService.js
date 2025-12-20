import axios from 'axios';

// PENTING: Sesuaikan dengan alamat IP Anda!
const API_URL = 'http://103.94.238.252:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
});

// --- Auth ---
export const loginApi = (userKode, password) => {
  return apiClient.post('/auth/login', {
    user_kode: userKode,
    user_password: password,
  });
};

export const selectBranchApi = (branchCode, preAuthToken) => {
  return apiClient.post('/auth/select-branch', {
    branchCode: branchCode,
    preAuthToken: preAuthToken,
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
export const scanProdukPenjualanApi = (barcode, token) => {
  return apiClient.get(`/penjualan/scan/${barcode}`, {
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

// -> TAMBAHKAN INI (Untuk Upload Hasil Scan)
export const uploadOpnameResultApi = (data, token) => {
  return apiClient.post('/stok-opname/upload', data, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// --- Dashboard Management (BARU) ---
export const getDashboardTodayStatsApi = token => {
  return apiClient.get('/dashboard/today-stats', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardPiutangApi = token => {
  return apiClient.get('/dashboard/total-sisa-piutang', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardBranchPerformanceApi = token => {
  return apiClient.get('/dashboard/branch-performance', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardSalesChartApi = (params, token) => {
  return apiClient.get('/dashboard/sales-chart', {
    params, // { startDate, endDate, groupBy, cabang }
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardPendingActionsApi = token => {
  return apiClient.get('/dashboard/pending-actions', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardTargetSummaryApi = token => {
  return apiClient.get('/dashboard/sales-target-summary', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 1. Ambil List Sisa Piutang Per Cabang
export const getDashboardPiutangPerCabangApi = token => {
  // Pastikan route backend sesuai dengan yang kita buat sebelumnya
  return apiClient.get('/dashboard/piutang-per-cabang', {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 2. Ambil Detail Invoice Piutang per Cabang
export const getDashboardPiutangDetailApi = (kodeCabang, token) => {
  return apiClient.get(`/dashboard/piutang-detail/${kodeCabang}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 1. Ambil Top 10 Produk Terlaris
export const getDashboardTopSellingApi = (token, branchFilter = '') => {
  return apiClient.get('/dashboard/top-selling', {
    params: {branchFilter}, // Kirim filter jika ada (opsional)
    headers: {Authorization: `Bearer ${token}`},
  });
};

// 2. Cek Sebaran Stok (Interaktif)
// Kita kirim ukuran juga agar data stok spesifik
export const getDashboardStockSpreadApi = (barcode, ukuran, token) => {
  return apiClient.get(`/dashboard/stock-spread/${barcode}`, {
    params: {ukuran},
    headers: {Authorization: `Bearer ${token}`},
  });
};

export const getDashboardTrendsApi = (token, branchFilter = '') => {
  return apiClient.get('/dashboard/trends', {
    params: {branchFilter},
    headers: {Authorization: `Bearer ${token}`},
  });
};

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
