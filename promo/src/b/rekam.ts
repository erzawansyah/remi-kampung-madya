// Titik waktu di rekaman game (detik di berkas promo/public/rekam/<klip>-kamu.mp4), disalin dari
// rekam.json sesudah merekam (npx tsx promo/scripts/rekam/momen.ts). Kode meja dipakai di chat ronde 1.
import type { TitikRekam } from './waktu';

export const REKAM: Record<'r1' | 'r2' | 'r3', TitikRekam> = {
  r1: { kode: '648VW', buang: 52.9, pungut: 59.0, tertutup: 61.6, retak: 63.5 },
  r2: { kode: '7H74V', lobi: 0.1, buang: 81.3, pungut: 83.0, tertutup: 85.3, retak: 87.5 },
  r3: { kode: 'RBK9W', mentung: 81.8, retak: 82.4 },
};
