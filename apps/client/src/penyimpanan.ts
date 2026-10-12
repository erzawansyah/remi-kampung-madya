// Penyimpanan di HP (localStorage). Bisa gagal (mode privat, penyimpanan penuh),
// jadi semua akses dibungkus try/catch dan game tetap jalan tanpa penyimpanan.

import type { DataMeja, PengaturanMeja } from '@remi/meja';

const KUNCI = {
  nama: 'remi.nama',
  sesi: 'remi.sesiOnline',
  offline: 'remi.mejaOffline',
  pengaturanOffline: 'remi.pengaturanOffline',
  riwayat: 'remi.riwayat',
  urutanTangan: 'remi.urutanTangan',
  efek: 'remi.efek',
} as const;

export interface PengaturanEfek {
  suara: boolean;
  getar: boolean;
}

function baca<T>(kunci: string, bawaan: T): T {
  try {
    const x = localStorage.getItem(kunci);
    return x === null ? bawaan : (JSON.parse(x) as T);
  } catch {
    return bawaan;
  }
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

export interface CatatanPermainan {
  waktu: number;
  mode: 'online' | 'offline';
  klasemen: { nama: string; skor: number }[];
  putaran: number;
}

export const simpan = {
  nama: () => baca<string>(KUNCI.nama, ''),
  setNama: (n: string) => tulis(KUNCI.nama, n),

  sesi: () => baca<SesiOnline | null>(KUNCI.sesi, null),
  setSesi: (s: SesiOnline | null) => tulis(KUNCI.sesi, s),

  mejaOffline: () => baca<DataMeja | null>(KUNCI.offline, null),
  setMejaOffline: (d: DataMeja | null) => tulis(KUNCI.offline, d),

  pengaturanOffline: () => baca<Partial<PengaturanMeja>>(KUNCI.pengaturanOffline, {}),
  setPengaturanOffline: (p: Partial<PengaturanMeja>) => tulis(KUNCI.pengaturanOffline, p),

  riwayat: () => baca<CatatanPermainan[]>(KUNCI.riwayat, []),
  tambahRiwayat: (c: CatatanPermainan) => tulis(KUNCI.riwayat, [c, ...baca<CatatanPermainan[]>(KUNCI.riwayat, [])].slice(0, 30)),

  pengaturanEfek: () => ({ suara: true, getar: true, ...baca<Partial<PengaturanEfek>>(KUNCI.efek, {}) }),
  setPengaturanEfek: (e: PengaturanEfek) => tulis(KUNCI.efek, e),

  urutanTangan: () => baca<string[]>(KUNCI.urutanTangan, []),
  setUrutanTangan: (u: string[]) => tulis(KUNCI.urutanTangan, u),
};
