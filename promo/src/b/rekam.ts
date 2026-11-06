// Titik waktu di rekaman game (detik di berkas promo/public/rekam/<klip>-kamu.mp4), disalin dari
// rekam.json sesudah merekam (npx tsx promo/scripts/rekam/momen.ts). Kode meja dipakai di chat ronde 1.
import type { TitikRekam } from './waktu';

export const REKAM: Record<'r1' | 'r2' | 'r3', TitikRekam> = {
  r1: { kode: 'GZHU4', buang: 27.5, pungut: 29.7, tertutup: 31.0, retak: 32.4 },
  r2: { kode: 'FVTES', lobi: 1.9, buang: 38.7, pungut: 39.2, tertutup: 40.5, retak: 42.24 },
  r3: { kode: 'KZADE', mentung: 39.5, retak: 40.0 },
};
