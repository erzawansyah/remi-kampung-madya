// Penilaian per putaran (Bagian 8).

import { nilaiDasar, type Kartu } from './kartu.js';
import { nilaiKartuJadi, nilaiKartuTangan, type KartuJadi, type KonteksJoker } from './kartuJadi.js';
import type { RincianSkor, StatusSkor } from './state.js';

export const PENALTI_JOKER_DIBUANG = 25;

export const NILAI_PENTUNGAN_JOKER = 250;

/**
 * Mode kaldu (#42): di putaran kaldu nilai pentungan dikali dua, untuk yang mentung (+) maupun tiap
 * kepentung (−). Bagian skor lain (kartu jadi, tangan, −25 buang joker) tetap.
 */
export const PENGALI_KALDU = 2;

/**
 * Nilai pentungan: joker = 250; selain itu 10 × nilai kartu (2–10 = 50, Londo = 100, As = 150).
 * Joker yang sudah pernah dibuang (lalu dipungut) sudah jadi kartu biasa, jadi dinilai sebagai kartu aslinya.
 *
 * @param jokerHidup kartu masih berstatus joker saat dibuang sebagai pentungan
 */
export function nilaiPentungan(kartu: Kartu, jokerHidup: boolean): number {
  return jokerHidup ? NILAI_PENTUNGAN_JOKER : nilaiDasar(kartu.rank) * 10;
}

/**
 * Nilai semua pentungan. Keputusan #41: nutup pakai beberapa joker hidup sekaligus bernilai 250 per
 * joker; sejak #52 paling banyak 2 joker (500). `lain` hanya berisi joker hidup (dijaga validasiBuang), dan
 * tidak ada penalti −25 untuk joker yang dipakai mentung. Yang mentung dapat totalnya sekali, tiap
 * kepentung kena totalnya penuh.
 */
export function nilaiPentunganTotal(pentungan: Kartu, pentunganJoker: boolean, lain: readonly Kartu[] = []): number {
  return nilaiPentungan(pentungan, pentunganJoker) + lain.length * NILAI_PENTUNGAN_JOKER;
}

export interface InputSkorPemain {
  pemain: number;
  status: StatusSkor;
  kartuJadi: KartuJadi[];
  tangan: Kartu[];
  /** Nilai pentungan penuh (jumlah semua pentungan, sebelum pengali), dipakai untuk status mentung/kepentung. */
  nilaiPentungan: number;
  /** Pengali pentungan: PENGALI_KALDU di putaran kaldu (#42). Kosong = 1. */
  pengaliPentungan?: number;
  jumlahJokerDibuang: number;
  ctx: KonteksJoker;
}

/**
 * - Dasar: kartu jadi − tangan
 * - Mentung: kartu jadi + pentungan
 * - Kepentung: kartu jadi − tangan − pentungan
 * Penalti −25 per joker yang dibuang (bukan sebagai pentungan) berlaku untuk semua status.
 * Di putaran kaldu pentungan dikali `pengaliPentungan` (bagian lain tetap).
 */
export function hitungSkorPemain(input: InputSkorPemain): RincianSkor {
  const nilaiJadi = input.kartuJadi.reduce((s, kj) => s + nilaiKartuJadi(kj), 0);
  const perKartu = input.tangan.map((k) => nilaiKartuTangan(k, input.ctx));
  const nilaiTangan = perKartu.reduce((s, x) => s + x, 0);
  const pengali = input.pengaliPentungan ?? 1;
  const penuh = input.nilaiPentungan * pengali;
  const pentungan = input.status === 'mentung' ? penuh : input.status === 'kepentung' ? -penuh : 0;
  const penaltiJoker = input.jumlahJokerDibuang * PENALTI_JOKER_DIBUANG;
  return {
    pemain: input.pemain,
    status: input.status,
    nilaiKartuJadi: nilaiJadi,
    nilaiTangan,
    nilaiKartuTangan: perKartu,
    nilaiPentungan: pentungan,
    // Hanya ditulis kalau ada pengalinya, supaya rincian lama dan golden tidak berubah.
    ...(pengali !== 1 && pentungan !== 0 ? { pengaliPentungan: pengali } : {}),
    jumlahJokerDibuang: input.jumlahJokerDibuang,
    penaltiJoker,
    total: nilaiJadi - nilaiTangan + pentungan - penaltiJoker,
    kartuJadi: input.kartuJadi,
    tangan: input.tangan,
  };
}

/** Teks perhitungan, contoh "(10+10+10) − (5+5+5) = 15", atau "(5+5+5) + 250 × 2 = 515" di putaran kaldu. */
export function teksPerhitungan(r: RincianSkor, ctx: KonteksJoker): string {
  const jadi = r.kartuJadi.map((kj) => `(${kj.kartu.map((d) => nilaiDasar(d.sebagai.rank)).join('+')})`);
  const bagian: string[] = [jadi.length ? jadi.join(' + ') : '0'];
  const perKartu = r.nilaiKartuTangan ?? r.tangan.map((k) => nilaiKartuTangan(k, ctx));
  if (r.tangan.length) bagian.push(`− (${perKartu.join('+')})`);
  const pengali = r.pengaliPentungan ?? 1;
  const pentungan = (x: number) => (pengali !== 1 ? `${x / pengali} × ${pengali}` : `${x}`);
  if (r.nilaiPentungan > 0) bagian.push(`+ ${pentungan(r.nilaiPentungan)}`);
  if (r.nilaiPentungan < 0) bagian.push(`− ${pentungan(-r.nilaiPentungan)}`);
  if (r.penaltiJoker) bagian.push(`− ${r.penaltiJoker} (buang joker ${r.jumlahJokerDibuang}×)`);
  return `${bagian.join(' ')} = ${r.total}`;
}
