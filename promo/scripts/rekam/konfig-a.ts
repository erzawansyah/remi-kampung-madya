// Dua permainan yang direkam untuk Teaser A (promo/BRIEF-teaser-a.md §5): 3 pemain, 1 deck, batas 2 putaran
// (supaya sesudah putaran 1 statusnya putaranSelesai dan ledekan bisa dikirim), mode kaldu mati.
import type { LevelBot } from '../../../packages/engine/src/index.ts';

export interface KonfigKlipA {
  /** Nama kursi manusia berurutan (kursi 0 = host = Bang IT, halaman yang direkam). */
  nama: string[];
  /** Kursi yang diisi warga kedai sebelum mulai (A2). */
  bot: { kursi: number; level: LevelBot } | null;
  /** Kursi yang mentung dan kursi yang harus kepentung di putaran 1. */
  pementung: number;
  korban: number;
  /** Kursi yang direkam (Bang IT). */
  kamu: number;
  /** Kursi Mas Sampul (pengirim ledekan di A1). */
  peledek: number | null;
}

export const KLIP_A: Record<'a1' | 'a2', KonfigKlipA> = {
  a1: { nama: ['Bang IT', 'Cak Owner', 'Mas Sampul'], bot: null, pementung: 1, korban: 0, kamu: 0, peledek: 2 },
  a2: { nama: ['Bang IT', 'Mas Sampul'], bot: { kursi: 2, level: 'normal' }, pementung: 2, korban: 0, kamu: 0, peledek: null },
};

export const PENGATURAN_A = { jumlahPemain: 3, detikGiliran: 0, publik: false, batasPutaran: 2, duaDeckUntukEmpat: false, modeKaldu: false };
