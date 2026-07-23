import {useState, useCallback, useRef} from 'react';
import {getActivePromosApi, getPromoItemsApi} from '../api/ApiService';

const upper = s => (s || '').toString().toUpperCase();

// Aturan eksklusi tetap: Bordir & Custom Pengajuan Harga selalu dikecualikan dari promo apapun
const isBordirItem = item =>
  upper(item.kategori) === 'SO-DTF' && upper(item.nama).includes('BR');

const isCustomItem = item => upper(item.kategori).includes('PENGAJUAN');

const matchIncludeKata = (namaUp, includeKataStr) => {
  if (!includeKataStr) return true; // tidak ada filter kata = semua kategori lolos
  const katas = includeKataStr
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return katas.some(k => namaUp.includes(k));
};

const isItemEligibleForPromo = (item, promo) => {
  if (!item.kode) return false;
  if (isBordirItem(item)) return false;
  if (isCustomItem(item)) return false;

  const kodeUp = upper(item.kode);
  const namaUp = upper(item.nama);

  if (promo.pro_exclude_kode) {
    const excludeKodes = promo.pro_exclude_kode
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    if (excludeKodes.includes(kodeUp)) return false;
  }

  if (kodeUp.startsWith('JASA') || kodeUp.startsWith('JS')) return false;

  switch (promo.pro_basis) {
    case 'KATEGORI':
    case 'TIPE':
    case 'ALL':
      return matchIncludeKata(namaUp, promo.pro_include_kata);
    case 'ITEM':
      return true; // item promo DISCOUNT difilter lewat tpromo_barang, bukan di sini
    default:
      return true;
  }
};

const isLevelExcluded = (promo, levelKode) => {
  if (!promo.level_exclude?.length) return false;
  return promo.level_exclude.includes(String(levelKode || '1'));
};

export function usePromoEngine() {
  const [activePromos, setActivePromos] = useState([]);
  const promoItemsCache = useRef(new Map()); // pro_nomor -> [{kode, ukuran, discPersen, discRp}]

  const loadActivePromos = useCallback(async (tanggal, token) => {
    try {
      const res = await getActivePromosApi({tanggal}, token);
      const promos = res.data.data || [];
      setActivePromos(promos);
      return promos;
    } catch (err) {
      console.log('[usePromoEngine] loadActivePromos error', err);
      setActivePromos([]);
      return [];
    }
  }, []);

  const fetchPromoItems = useCallback(async (proNomor, token) => {
    if (promoItemsCache.current.has(proNomor)) {
      return promoItemsCache.current.get(proNomor);
    }
    try {
      const res = await getPromoItemsApi(proNomor, token);
      const list = res.data.data || [];
      promoItemsCache.current.set(proNomor, list);
      return list;
    } catch (err) {
      console.log('[usePromoEngine] fetchPromoItems error', err);
      promoItemsCache.current.set(proNomor, []);
      return [];
    }
  }, []);

  // Bangun peta diskon per-item (kode||ukuran -> {persen, rp}) dari promo DISCOUNT (mis. PRO-2026-006)
  const buildItemDiscountMap = useCallback(
    async (promosList, itemsList, token, levelKode) => {
      const map = new Map();
      const itemPromos = promosList.filter(
        p => p.pro_mode_barang === 'DISCOUNT' || p.pro_jenis === 4,
      );
      if (!itemPromos.length) return map;

      const totalKeranjang = itemsList.reduce(
        (sum, it) => sum + (it.harga || 0) * (it.jumlah || 0),
        0,
      );

      for (const promo of itemPromos) {
        if (isLevelExcluded(promo, levelKode)) continue;
        if (promo.pro_totalrp > 0 && totalKeranjang < promo.pro_totalrp)
          continue;

        const promoItems = await fetchPromoItems(promo.pro_nomor, token);
        for (const pi of promoItems) {
          const key = `${pi.kode}||${pi.ukuran}`;
          const existing = map.get(key);
          if (!existing || pi.discPersen > existing.persen) {
            map.set(key, {persen: pi.discPersen || 0, rp: pi.discRp || 0});
          }
        }
      }
      return map;
    },
    [fetchPromoItems],
  );

  // Terapkan itemDiscountMap ke array items -> kembalikan items baru dengan diskonRp terisi otomatis
  const applyItemDiscounts = useCallback((itemsList, itemDiscountMap) => {
    return itemsList.map(item => {
      const key = `${item.kode}||${item.ukuran}`;
      const disc = itemDiscountMap.get(key);
      if (disc) {
        const diskonRp =
          disc.rp > 0
            ? disc.rp
            : Math.round(((item.harga || 0) * disc.persen) / 100);
        return {...item, diskonRp, diskonPersenPromo: disc.persen};
      }
      // Sebelumnya dapat diskon promo, sekarang tidak eligible lagi -> reset
      if (item.diskonPersenPromo) {
        return {...item, diskonRp: 0, diskonPersenPromo: 0};
      }
      return item;
    });
  }, []);

  // Total belanja item yang eligible untuk promo faktur (basis KATEGORI/ALL/TIPE), dihitung dari harga NETTO
  // (setelah dikurangi diskon item, kalau item itu sekaligus dapat diskon dari promo DISCOUNT)
  const calcEligibleTotal = useCallback((promo, itemsList) => {
    return itemsList.reduce((sum, item) => {
      if (!isItemEligibleForPromo(item, promo)) return sum;
      const hargaNetto = (item.harga || 0) - (item.diskonRp || 0);
      return sum + hargaNetto * (item.jumlah || 0);
    }, 0);
  }, []);

  // Evaluasi semua promo faktur (kelipatan Rp / persen) yang syaratnya terpenuhi
  const evaluateFakturPromos = useCallback(
    (promosList, itemsList, levelKode) => {
      const nomors = [];
      const namas = [];
      let totalDiskon = 0;

      const fakturPromos = promosList.filter(
        p =>
          (p.pro_jenis === 1 || p.pro_jenis === 3) &&
          p.pro_mode_barang !== 'DISCOUNT' &&
          p.pro_nomor !== 'PRO-2026-003', // Maps ditangani terpisah
      );

      for (const promo of fakturPromos) {
        if (isLevelExcluded(promo, levelKode)) continue;
        const eligible = calcEligibleTotal(promo, itemsList);
        if (promo.pro_totalrp > 0 && eligible < promo.pro_totalrp) continue;

        let diskon = 0;
        if (promo.pro_disrp > 0) {
          diskon =
            promo.pro_lipat === 'Y'
              ? Math.floor(eligible / promo.pro_totalrp) * promo.pro_disrp
              : promo.pro_disrp;
        } else if (promo.pro_dispersen > 0) {
          diskon = (promo.pro_dispersen / 100) * eligible;
        }
        if (diskon <= 0) continue;

        totalDiskon += diskon;
        nomors.push(promo.pro_nomor);
        namas.push(promo.pro_judul);
      }

      return {nomors, namas, totalDiskon: Math.round(totalDiskon)};
    },
    [calcEligibleTotal],
  );

  return {
    activePromos,
    loadActivePromos,
    buildItemDiscountMap,
    applyItemDiscounts,
    evaluateFakturPromos,
  };
}
