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
