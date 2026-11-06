// Tiga permainan yang direkam untuk Teaser B (brief §4): kursi, siapa mentung, siapa kepentung.
import type { LevelBot } from '../../../packages/engine/src/index.ts';

export interface KonfigKlip {
  /** Nama kursi manusia berurutan (kursi 0 = host). */
  nama: string[];
  /** Kursi yang diisi warga kedai sebelum mulai (R2, R3). */
  bot: { kursi: number; level: LevelBot } | null;
  /** Kursi yang mentung dan kursi yang harus kepentung di putaran 1. */
  pementung: number;
  korban: number;
  /** Kursi "Kamu" (yang direkam). */
  kamu: number;
}

export const KLIP: Record<'r1' | 'r2' | 'r3', KonfigKlip> = {
  r1: { nama: ['Dimas', 'Ayu', 'Rendi', 'Kamu'], bot: null, pementung: 1, korban: 3, kamu: 3 },
  r2: { nama: ['Dimas', 'Ayu', 'Kamu'], bot: { kursi: 3, level: 'normal' }, pementung: 3, korban: 2, kamu: 2 },
  r3: { nama: ['Dimas', 'Ayu', 'Kamu'], bot: { kursi: 3, level: 'normal' }, pementung: 2, korban: 3, kamu: 2 },
};

export const PENGATURAN = { jumlahPemain: 4, detikGiliran: 0, publik: false, batasPutaran: 1, duaDeckUntukEmpat: false, modeKaldu: false };
