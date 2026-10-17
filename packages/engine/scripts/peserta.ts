// Peserta arena: "level" atau "level:gaya". Dipakai arena.ts, diuji test/arena-alat.test.ts.
//
// Daftar gaya yang sah tidak ditulis di sini, tapi dikirim pemanggil (arena.ts memegang satu daftar
// dengan 'standar' di indeks 0). Jadi saat gaya baru ada, cukup daftarnya yang bertambah.

import { DAFTAR_LEVEL_BOT, type LevelBot } from '../src/index.js';

/** Gaya bawaan: perilaku warga kedai yang sudah ada. Selalu di indeks 0 daftar gaya. */
export const GAYA_STANDAR = 'standar';

/** Bukan gaya sungguhan: tiap kursi dapat gaya non-standar yang ditentukan seed dan kursinya. */
export const GAYA_ACAK = 'acak';

export interface Peserta {
  /** Kunci hasil dan label di keluaran. Gaya standar = level saja, supaya keluaran lama tidak berubah. */
  label: string;
  level: LevelBot;
  /** Nama gaya dari daftar, atau GAYA_ACAK. */
  gaya: string;
}

export function labelPeserta(level: LevelBot, gaya: string): string {
  return gaya === GAYA_STANDAR ? level : `${level}:${gaya}`;
}

function cekGaya(gaya: string, daftarGaya: readonly string[]): void {
  if (gaya !== GAYA_ACAK && !daftarGaya.includes(gaya)) {
    throw new Error(`gaya tidak dikenal: ${gaya} (pilihan: ${[...daftarGaya, GAYA_ACAK].join(', ')})`);
  }
}

/** "jago", "jago:standar" (sama dengan "jago"), "normal:acak". Melempar Error kalau tidak dikenal. */
export function uraiPeserta(teks: string, daftarGaya: readonly string[]): Peserta {
  const bagian = teks.trim().split(':');
  if (bagian.length > 2) throw new Error(`peserta tidak dikenal: ${teks} (formatnya level atau level:gaya)`);
  const [level, gaya = GAYA_STANDAR] = bagian;
  if (!(DAFTAR_LEVEL_BOT as readonly string[]).includes(level)) throw new Error(`level tidak dikenal: ${level}`);
  cekGaya(gaya, daftarGaya);
  return { label: labelPeserta(level as LevelBot, gaya), level: level as LevelBot, gaya };
}

/** Isi --gaya: "semua" = seluruh daftar (termasuk standar), atau "a,b". */
export function uraiDaftarGaya(teks: string, daftarGaya: readonly string[]): string[] {
  if (teks.trim() === 'semua') return [...daftarGaya];
  const hasil = teks.split(',').map((x) => x.trim());
  for (const g of hasil) cekGaya(g, daftarGaya);
  return [...new Set(hasil)];
}

/**
 * --uji × --gaya. Tanpa --gaya, --uji dipakai apa adanya. Dengan --gaya, setiap isian --uji harus
 * level polos (tanpa ":gaya"), supaya tidak ada dua sumber gaya yang saling menimpa.
 */
export function silangGaya(uji: readonly Peserta[], gaya: readonly string[] | null): Peserta[] {
  if (!gaya) return [...uji];
  const hasil: Peserta[] = [];
  for (const p of uji) {
    if (p.gaya !== GAYA_STANDAR) throw new Error(`--gaya tidak bisa digabung dengan --uji yang sudah bergaya (${p.label})`);
    for (const g of gaya) {
      const label = labelPeserta(p.level, g);
      if (!hasil.some((x) => x.label === label)) hasil.push({ label, level: p.level, gaya: g });
    }
  }
  return hasil;
}

/**
 * Gaya yang dipakai kursi `kursi` (urutan peserta di susunan, ikut berputar bersama pesertanya) untuk
 * seed `seed`. Selain GAYA_ACAK hasilnya gaya itu sendiri. GAYA_ACAK memilih gaya non-standar:
 * daftar[1 + ((seed·7 + kursi·3) mod (panjang − 1))]. Kalau belum ada gaya selain standar, hasilnya standar.
 */
export function gayaUntukKursi(gaya: string, seed: number, kursi: number, daftarGaya: readonly string[]): string {
  if (gaya !== GAYA_ACAK) return gaya;
  const m = daftarGaya.length - 1;
  if (m < 1) return daftarGaya[0];
  const x = (seed * 7 + kursi * 3) % m;
  return daftarGaya[1 + ((x + m) % m)];
}
