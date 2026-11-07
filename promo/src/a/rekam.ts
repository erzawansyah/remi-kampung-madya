// Titik waktu di rekaman game Teaser A (detik di berkas promo/public/rekam/<klip>-kamu.mp4), dibaca dari
// rekam-a.json dengan `node promo/scripts/rekam/momen-a.mjs` sesudah merekam (rekam-browser-a.mjs).
// Posisi di layar HP (koordinat 390 × 844) dicek dari still rekaman.
export interface TitikRekamA {
  /** Kode meja yang benar-benar terekam. */
  kode: string;
  /** Detik kartu Bang IT (yang nanti dipungut) mendarat di buangan. */
  buang: number;
  /** Detik lawan memungutnya (kartu terbang ke panelnya). */
  pungut: number;
  /** Detik pentungan tertutup diletakkan. */
  tertutup: number;
  /** Detik retak muncul (pentungan dibuka). */
  retak: number;
  /** Detik ledekan besar tampil (A1). */
  ledek?: number;
}

export const REKAM_A: Record<'a1' | 'a2', TitikRekamA> = {
  a1: { kode: 'HF72C', buang: 31.3, pungut: 33.2, tertutup: 35.1, retak: 36.6, ledek: 47.2 },
  a2: { kode: 'KM3UX', buang: 31.8, pungut: 34.6, tertutup: 35.2, retak: 36.0 },
};

/** Posisi di layar HP (390 × 844) di rekaman A1: tumpukan buangan dan panel Cak Owner. */
export const LAYAR_A1 = {
  buangan: { x: 340, y: 375 },
  panelOwner: { x: 200, y: 112 },
} as const;

/** Posisi di layar HP (390 × 844) di rekaman A2: panel nama warga kedai (kursi 2) untuk avatar maskot. */
export const LAYAR_A2 = {
  panelBot: { x: 350, y: 138 },
} as const;
