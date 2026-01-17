// src/utils/AuthHelper.js
import {apiClient} from '../api/ApiService';
import Toast from 'react-native-toast-message';

/**
 * Helper untuk meminta otorisasi (PIN) secara digital (FCM/Mobile)
 */
export const requestAuthorization = async (
  token,
  title,
  jenis,
  nominal,
  extraData,
  onSuccess,
) => {
  try {
    // 1. Kirim permintaan ke tabel kencanaprint.tspk_pin5 via backend
    const payload = {
      o_jenis: jenis,
      o_nominal: nominal,
      o_transaksi: extraData.transaksi || 'DRAFT',
      o_ket: extraData.keteranganLengkap || '',
      o_barcode: extraData.barcode || '',
      o_cab_tujuan: extraData.cabang, // Misal: K01
    };

    const res = await apiClient.post('/authorization/request', payload, {
      headers: {Authorization: `Bearer ${token}`},
    });

    if (res.data.success) {
      Toast.show({
        type: 'info',
        text1: 'Permintaan Terkirim',
        text2: `Menunggu persetujuan dari Cabang ${extraData.cabang}...`,
        autoHide: false, // Biar tidak hilang sampai di-approve
      });

      // 2. Logika Real-time: Di sini kita bisa pakai Polling atau Socket.
      // Untuk sederhananya, kita gunakan polling tiap 3 detik untuk cek status
      const authNomor = res.data.authNomor;
      const interval = setInterval(async () => {
        const check = await apiClient.get(
          `/authorization/status/${authNomor}`,
          {
            headers: {Authorization: `Bearer ${token}`},
          },
        );

        if (check.data.status === 'ACC') {
          clearInterval(interval);
          Toast.hide();
          onSuccess({approver: check.data.approver});
        } else if (check.data.status === 'TOLAK') {
          clearInterval(interval);
          Toast.hide();
          Toast.show({
            type: 'error',
            text1: 'Ditolak',
            text2: 'Permintaan ditolak oleh Store.',
          });
        }
      }, 3000);
    }
  } catch (error) {
    console.log('Auth Error:', error);
    Toast.show({type: 'error', text1: 'Gagal meminta otorisasi'});
  }
};
