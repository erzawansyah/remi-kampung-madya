// Penyimpanan di HP (localStorage). Bisa gagal (mode privat, penyimpanan penuh),
// jadi semua akses dibungkus try/catch dan game tetap jalan tanpa penyimpanan.
// Isi yang JSON-nya sah tapi bentuknya aneh (disunting tangan, sisa versi lama, rusak) juga
// diperiksa: nilai yang tidak cocok diganti bawaan dan kuncinya dihapus supaya tidak mengganggu terus.

import type { ViewPemain } from '@remi/engine';
import { rapikanBatasSkor, rapikanLevel, type DataMeja, type InfoKursi, type PengaturanMeja } from '@remi/meja';
import type { TawaranPasang } from './pasangAplikasi';
import { aturPreferensi, preferensi } from './preferensi';

const KUNCI = {
  nama: 'remi.nama',
  sesi: 'remi.sesiOnline',
  offline: 'remi.mejaOffline',
  pengaturanOffline: 'remi.pengaturanOffline',
  riwayat: 'remi.riwayat',
  /** Penanda permainan online yang sudah masuk riwayat (supaya reload tidak mencatat ulang). */
  tercatat: 'remi.riwayatTercatat',
  urutanTangan: 'remi.urutanTangan',
  efek: 'remi.efek',
  /** Permainan latihan (tutorial) yang sedang tersimpan di slot offline. */
  latihan: 'remi.latihanTersimpan',
  /** Tawaran pasang aplikasi di beranda (keputusan #46): "Nanti saja" / "Sudah kupasang". */
  tawaranPasang: 'remi.tawaranPasang',
} as const;

/** Riwayat lokal yang disimpan (permainan terbaru di depan). */
const BATAS_RIWAYAT = 30;
/** Penanda "sudah dicatat" yang diingat. Cukup beberapa permainan online terakhir. */
const BATAS_TERCATAT = 20;

export interface PengaturanEfek {
  suara: boolean;
  getar: boolean;
}

/**
 * Pemeriksa bentuk: kembalikan nilai yang sudah dirapikan, atau undefined kalau bentuknya
 * tidak bisa dipakai sama sekali (lalu kuncinya dihapus).
 */
type Rapikan<T> = (x: unknown) => T | undefined;

function hapus(kunci: string): void {
  try {
    localStorage.removeItem(kunci);
  } catch {
    // Abaikan: penyimpanan tidak tersedia.
  }
}

function baca<T>(kunci: string, bawaan: T, rapikan: Rapikan<T>): T {
  let mentah: string | null;
  try {
    mentah = localStorage.getItem(kunci);
  } catch {
    return bawaan;
  }
  if (mentah === null) return bawaan;
  try {
    const rapi = rapikan(JSON.parse(mentah));
    if (rapi !== undefined) return rapi;
  } catch {
    // JSON rusak: diperlakukan sama dengan bentuk yang salah.
  }
  hapus(kunci);
  return bawaan;
}

function tulis(kunci: string, nilai: unknown): void {
  try {
    if (nilai === null || nilai === undefined) localStorage.removeItem(kunci);
    else localStorage.setItem(kunci, JSON.stringify(nilai));
  } catch {
    // Abaikan: penyimpanan tidak tersedia.
  }
}

export interface SesiOnline {
  kode: string;
  token: string;
}

export interface BarisCatatan {
  nama: string;
  skor: number;
  /** Kursi ini dimainkan bot di akhir permainan. Tidak ada di riwayat lama (anggap manusia). */
  bot?: boolean;
}

export interface CatatanPermainan {
  waktu: number;
  mode: 'online' | 'offline';
  klasemen: BarisCatatan[];
  putaran: number;
}

// ---------------------------------------------------------------------------------------------
// Pemeriksa bentuk

const objek = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const angka = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

const rapikanString: Rapikan<string> = (x) => (typeof x === 'string' ? x : undefined);
const rapikanObjek = <T>(x: unknown): T | undefined => (objek(x) ? (x as T) : undefined);
/** Null tersimpan = tidak ada (bukan rusak). */
const rapikanObjekAtauNull = <T>(x: unknown): T | null | undefined => (x === null ? null : rapikanObjek<T>(x));

const rapikanSesi: Rapikan<SesiOnline | null> = (x) =>
  x === null ? null : objek(x) && typeof x.kode === 'string' && typeof x.token === 'string' && x.kode && x.token ? { kode: x.kode, token: x.token } : undefined;

/**
 * Tawaran pasang aplikasi: hanya waktu (ms) yang angka terhingga dan positif yang dipakai, field
 * lain dibuang. Bukan objek sama sekali = rusak (jatuh ke {} dan kuncinya dihapus).
 */
export const rapikanTawaranPasang: Rapikan<TawaranPasang> = (x) => {
  if (!objek(x)) return undefined;
  const t: TawaranPasang = {};
  if (angka(x.tundaSampai) && x.tundaSampai > 0) t.tundaSampai = x.tundaSampai;
  if (angka(x.sudahPasang) && x.sudahPasang > 0) t.sudahPasang = x.sudahPasang;
  return t;
};

const rapikanDaftarString: Rapikan<string[]> = (x) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : undefined);

/**
 * Pengaturan meja offline terakhir. Level warga kedai yang tidak dikenal (rusak, atau dari versi
 * lain) jadi bawaan ('normal'). Batas skor (keputusan #44): angka dirapikan ke kelipatan 10 dengan
 * tanda yang benar (simpanan lama ±500 tetap ±500), null tetap tanpa batas, bentuk lain dibuang
 * supaya jatuh ke bawaan (tanpa batas). Mode kaldu (#42) hanya boolean, selain itu dibuang (mati).
 * Field lain dibiarkan, isiannya tetap disaring Meja.
 */
const rapikanPengaturanOffline: Rapikan<Partial<PengaturanMeja>> = (x) => {
  if (!objek(x)) return undefined;
  const p = { ...x } as Partial<PengaturanMeja>;
  if ('levelBot' in p) p.levelBot = rapikanLevel(p.levelBot);
  // Mode kaldu (#42): hanya boolean yang dipakai; bentuk lain dibuang (jatuh ke bawaan: mati).
  if ('modeKaldu' in p && typeof p.modeKaldu !== 'boolean') delete p.modeKaldu;
  for (const [k, arah] of [
    ['batasSkorAtas', 'atas'],
    ['batasSkorBawah', 'bawah'],
  ] as const) {
    if (!(k in p) || p[k] === null) continue;
    if (angka(p[k])) p[k] = rapikanBatasSkor(p[k], arah);
    else delete p[k];
  }
  return p;
};

function rapikanBaris(x: unknown): BarisCatatan | null {
  if (!objek(x) || typeof x.nama !== 'string' || !angka(x.skor)) return null;
  return x.bot === true ? { nama: x.nama, skor: x.skor, bot: true } : { nama: x.nama, skor: x.skor };
}

/** Satu entri riwayat; null kalau tidak bisa dipakai (entri itu saja yang dibuang). */
export function rapikanCatatan(x: unknown): CatatanPermainan | null {
  if (!objek(x) || !Array.isArray(x.klasemen)) return null;
  const klasemen = x.klasemen.map(rapikanBaris);
  if (!klasemen.length || klasemen.some((k) => k === null)) return null;
  return {
    waktu: angka(x.waktu) ? x.waktu : 0,
    mode: x.mode === 'online' ? 'online' : 'offline',
    putaran: angka(x.putaran) ? x.putaran : 0,
    klasemen: klasemen as BarisCatatan[],
  };
}

const rapikanRiwayat: Rapikan<CatatanPermainan[]> = (x) =>
  Array.isArray(x) ? x.map(rapikanCatatan).filter((c): c is CatatanPermainan => c !== null) : undefined;

const bacaRiwayat = () => baca<CatatanPermainan[]>(KUNCI.riwayat, [], rapikanRiwayat);
const bacaTercatat = () => baca<string[]>(KUNCI.tercatat, [], rapikanDaftarString);

// ---------------------------------------------------------------------------------------------
// Catatan permainan selesai (murni: tidak membaca penyimpanan)

/**
 * Klasemen akhir dari view permainan yang sudah selesai, urut skor tertinggi. `kursi` dari
 * InfoMeja (indeksnya sama dengan indeks pemain) dipakai untuk menandai bot, sama seperti
 * riwayat server: kursi yang bukan manusia di akhir permainan dihitung bot.
 */
export function catatanDariView(
  v: Pick<ViewPemain, 'pemain' | 'skor' | 'riwayat'>,
  mode: CatatanPermainan['mode'],
  kursi: readonly Pick<InfoKursi, 'jenis'>[] | null | undefined,
  waktu: number,
): CatatanPermainan {
  return {
    waktu,
    mode,
    putaran: v.riwayat.length,
    klasemen: v.pemain
      .map((pm, i): BarisCatatan => {
        const jenis = kursi?.[i]?.jenis;
        return jenis && jenis !== 'manusia' ? { nama: pm.nama, skor: v.skor[i]!, bot: true } : { nama: pm.nama, skor: v.skor[i]! };
      })
      .sort((a, b) => b.skor - a.skor),
  };
}

/**
 * Identitas satu permainan online yang sudah selesai: kode meja + jumlah putaran + skor akhir +
 * jejak tiap putaran (cara selesai, pementung, pengocok). Meja yang sama bisa main lagi, tapi
 * permainan berbeda praktis tidak pernah punya jejak yang persis sama. Tidak memuat info rahasia.
 */
export function kunciPermainan(kode: string, v: Pick<ViewPemain, 'skor' | 'riwayat'>): string {
  const jejak = v.riwayat.map((h) => `${h.cara === 'mentung' ? 'm' : 'd'}${h.pementung ?? ''}k${h.pengocok}`).join('.');
  return `${kode}|${v.riwayat.length}|${v.skor.join(',')}|${jejak}`;
}

// ---------------------------------------------------------------------------------------------

export const simpan = {
  nama: () => baca<string>(KUNCI.nama, '', rapikanString),
  setNama: (n: string) => tulis(KUNCI.nama, n),

  sesi: () => baca<SesiOnline | null>(KUNCI.sesi, null, rapikanSesi),
  setSesi: (s: SesiOnline | null) => tulis(KUNCI.sesi, s),

  mejaOffline: () => baca<DataMeja | null>(KUNCI.offline, null, rapikanObjekAtauNull<DataMeja>),
  setMejaOffline: (d: DataMeja | null) => tulis(KUNCI.offline, d),

  pengaturanOffline: () => baca<Partial<PengaturanMeja>>(KUNCI.pengaturanOffline, {}, rapikanPengaturanOffline),
  setPengaturanOffline: (p: Partial<PengaturanMeja>) => tulis(KUNCI.pengaturanOffline, p),

  riwayat: bacaRiwayat,
  /**
   * Tambah satu permainan selesai ke riwayat (terbaru di depan, maksimal 30). Dengan `kunci`
   * (lihat kunciPermainan), permainan yang sama hanya dicatat sekali walau halaman dimuat ulang
   * dan view 'selesai'-nya datang lagi. True kalau benar-benar ditambahkan.
   */
  tambahRiwayat: (c: CatatanPermainan, kunci?: string | null): boolean => {
    const tercatat = kunci ? bacaTercatat() : [];
    if (kunci && tercatat.includes(kunci)) return false;
    tulis(KUNCI.riwayat, [c, ...bacaRiwayat()].slice(0, BATAS_RIWAYAT));
    if (kunci) tulis(KUNCI.tercatat, [kunci, ...tercatat].slice(0, BATAS_TERCATAT));
    return true;
  },

  // Sumber kebenarannya sekarang preferensi.ts (remi.preferensi); dua fungsi ini tinggal pembungkus.
  pengaturanEfek: (): PengaturanEfek => {
    const p = preferensi();
    return { suara: p.suara, getar: p.getar };
  },
  setPengaturanEfek: (e: PengaturanEfek) => {
    aturPreferensi({ suara: e.suara, getar: e.getar });
  },

  tawaranPasang: () => baca<TawaranPasang>(KUNCI.tawaranPasang, {}, rapikanTawaranPasang),
  /** Objek kosong menghapus kuncinya. */
  setTawaranPasang: (t: TawaranPasang) => {
    const rapi = rapikanTawaranPasang(t) ?? {};
    tulis(KUNCI.tawaranPasang, Object.keys(rapi).length ? rapi : null);
  },

  urutanTangan: () => baca<string[]>(KUNCI.urutanTangan, [], rapikanDaftarString),
  setUrutanTangan: (u: string[]) => tulis(KUNCI.urutanTangan, u),

  /** Simpanan offline yang sekarang adalah latihan dengan panduan (tutorial). Disimpan sebagai '1'. */
  latihanTersimpan: (): boolean => {
    try {
      return localStorage.getItem(KUNCI.latihan) === '1';
    } catch {
      return false;
    }
  },
  setLatihanTersimpan: (ya: boolean): void => {
    try {
      if (ya) localStorage.setItem(KUNCI.latihan, '1');
      else localStorage.removeItem(KUNCI.latihan);
    } catch {
      // Penyimpanan tidak tersedia: tanda latihan cukup hidup selama halaman terbuka.
    }
  },
};
