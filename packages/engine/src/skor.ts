// Penilaian per putaran (Bagian 8).

import { nilaiDasar, type Kartu } from './kartu.js';
import { nilaiKartuJadi, nilaiKartuTangan, type KartuJadi, type KonteksJoker } from './kartuJadi.js';
import type { RincianSkor, StatusSkor } from './state.js';

export const PENALTI_JOKER_DIBUANG = 25;

export const NILAI_PENTUNGAN_JOKER = 250;

/**
 * Nilai pentungan: joker = 250; selain itu 10 × nilai kartu (2–10 = 50, Londo = 100, As = 150).
 * Joker yang sudah pernah dibuang (lalu dipungut) sudah jadi kartu biasa, jadi dinilai sebagai kartu aslinya.
 *
 * @param jokerHidup kartu masih berstatus joker saat dibuang sebagai pentungan
 */
export function nilaiPentungan(kartu: Kartu, jokerHidup: boolean): number {
  return jokerHidup ? NILAI_PENTUNGAN_JOKER : nilaiDasar(kartu.rank) * 10;
}

export interface InputSkorPemain {
  pemain: number;
  status: StatusSkor;
  kartuJadi: KartuJadi[];
  tangan: Kartu[];
  /** Nilai pentungan penuh, dipakai untuk status mentung/kepentung. */
  nilaiPentungan: number;
  jumlahJokerDibuang: number;
  ctx: KonteksJoker;
}

/**
 * - Dasar: kartu jadi − tangan
 * - Mentung: kartu jadi + pentungan
 * - Kepentung: kartu jadi − tangan − pentungan
 * Penalti −25 per joker yang dibuang (bukan sebagai pentungan) berlaku untuk semua status.
 */
export function hitungSkorPemain(input: InputSkorPemain): RincianSkor {
  const nilaiJadi = input.kartuJadi.reduce((s, kj) => s + nilaiKartuJadi(kj), 0);
  const perKartu = input.tangan.map((k) => nilaiKartuTangan(k, input.ctx));
  const nilaiTangan = perKartu.reduce((s, x) => s + x, 0);
  const pentungan =
    input.status === 'mentung' ? input.nilaiPentungan : input.status === 'kepentung' ? -input.nilaiPentungan : 0;
  const penaltiJoker = input.jumlahJokerDibuang * PENALTI_JOKER_DIBUANG;
  return {
    pemain: input.pemain,
    status: input.status,
    nilaiKartuJadi: nilaiJadi,
    nilaiTangan,
    nilaiKartuTangan: perKartu,
    nilaiPentungan: pentungan,
    jumlahJokerDibuang: input.jumlahJokerDibuang,
    penaltiJoker,
    total: nilaiJadi - nilaiTangan + pentungan - penaltiJoker,
    kartuJadi: input.kartuJadi,
    tangan: input.tangan,
  };
}

/** Teks perhitungan, contoh "(10+10+10) − (5+5+5) = 15". */
export function teksPerhitungan(r: RincianSkor, ctx: KonteksJoker): string {
  const jadi = r.kartuJadi.map((kj) => `(${kj.kartu.map((d) => nilaiDasar(d.sebagai.rank)).join('+')})`);
  const bagian: string[] = [jadi.length ? jadi.join(' + ') : '0'];
  const perKartu = r.nilaiKartuTangan ?? r.tangan.map((k) => nilaiKartuTangan(k, ctx));
  if (r.tangan.length) bagian.push(`− (${perKartu.join('+')})`);
  if (r.nilaiPentungan > 0) bagian.push(`+ ${r.nilaiPentungan}`);
  if (r.nilaiPentungan < 0) bagian.push(`− ${-r.nilaiPentungan}`);
  if (r.penaltiJoker) bagian.push(`− ${r.penaltiJoker} (buang joker ${r.jumlahJokerDibuang}×)`);
  return `${bagian.join(' ')} = ${r.total}`;
}
