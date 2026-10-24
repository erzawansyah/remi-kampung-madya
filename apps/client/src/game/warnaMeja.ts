// Warna kanvas meja diambil dari token CSS (gaya/token.css) supaya kanvas dan HTML satu palet.
// Dibaca saat scene dibuat, dan dibaca ulang saat laken berganti (meja kompetisi, #51 versi 2);
// nilai cadangan dipakai kalau token belum termuat (mis. di lingkungan test).
//
// Laken meja kompetisi: selama pemain berada di lobi/meja kompetisi, <html data-laken="kompetisi">
// dipasang (aturLaken) dan token --laken* menunjuk ke --laken-kompetisi* (token.css), jadi latar
// meja HTML dan palet kanvas sama-sama berganti. Dilepas lagi begitu meninggalkan meja.

import type { WarnaTeks } from './tataMeja';

/** Atribut di <html> yang memilih laken: 'kompetisi' = laken meja kompetisi; tidak ada = laken biasa. */
export const ATRIBUT_LAKEN = 'data-laken';
export type JenisLaken = 'biasa' | 'kompetisi';

const pendengarLaken = new Set<() => void>();

/** Laken yang sedang dipakai (dibaca dari atribut <html>). */
export function lakenSekarang(): JenisLaken {
  try {
    return document.documentElement.getAttribute(ATRIBUT_LAKEN) === 'kompetisi' ? 'kompetisi' : 'biasa';
  } catch {
    return 'biasa';
  }
}

/** Pasang laken meja (kompetisi atau biasa). Pendengar (MejaScene) dikabari kalau berganti. */
export function aturLaken(jenis: JenisLaken): void {
  if (typeof document === 'undefined' || lakenSekarang() === jenis) return;
  if (jenis === 'kompetisi') document.documentElement.setAttribute(ATRIBUT_LAKEN, 'kompetisi');
  else document.documentElement.removeAttribute(ATRIBUT_LAKEN);
  for (const f of [...pendengarLaken]) f();
}

/** Dengarkan pergantian laken (mis. untuk membaca ulang palet kanvas). Mengembalikan pelepas. */
export function saatLakenBerubah(f: () => void): () => void {
  pendengarLaken.add(f);
  return () => pendengarLaken.delete(f);
}

export interface PaletMeja {
  /** Warna teks Phaser (string CSS). */
  teks: Record<WarnaTeks, string>;
  /** --emas sebagai string CSS (latar label/lencana kuning di kanvas, teksnya pakai teks.gelap). */
  emasCss: string;
  /** Warna Graphics/tint (angka 0xRRGGBB). */
  emas: number;
  emasMuda: number;
  bahaya: number;
  info: number;
  positif: number;
  negatif: number;
  panel: number;
  sorakEmas: number;
  sorakMerah: number;
  /** Warna teks untuk angka skor melayang. */
  teksPositif: string;
  teksNegatif: string;
}

const CADANGAN: Record<string, string> = {
  '--teks': '#f6f0e1',
  '--teks-redup': '#c3ccb9',
  '--teks-samar': '#9aa892',
  '--emas': '#f1a615',
  '--emas-muda': '#ffd277',
  '--teks-emas': '#f7b83d',
  '--negatif': '#ff9b94',
  '--bahaya': '#e5534b',
  '--info': '#7fc4ff',
  '--positif': '#8be28b',
  '--teks-di-emas': '#241a00',
  '--laken-pekat': '#072414',
  '--sorak-emas': '#ffd54a',
  '--sorak-merah': '#ff5a4f',
};

function token(gaya: CSSStyleDeclaration | null, nama: string): string {
  const nilai = gaya?.getPropertyValue(nama).trim();
  return nilai && /^#[0-9a-f]{6}$/i.test(nilai) ? nilai : CADANGAN[nama];
}

const angka = (hex: string) => parseInt(hex.slice(1), 16);

export function bacaPalet(): PaletMeja {
  let gaya: CSSStyleDeclaration | null = null;
  try {
    gaya = getComputedStyle(document.documentElement);
  } catch {
    gaya = null;
  }
  const t = (n: string) => token(gaya, n);
  return {
    teks: {
      teks: t('--teks'),
      redup: t('--teks-redup'),
      samar: t('--teks-samar'),
      // Teks kuning di kanvas jatuh langsung di atas laken: --emas di --laken cuma 4.4:1, --teks-emas 5.1:1.
      emas: t('--teks-emas'),
      bahaya: t('--negatif'),
      info: t('--info'),
      gelap: t('--teks-di-emas'),
    },
    emasCss: t('--emas'),
    emas: angka(t('--emas')),
    emasMuda: angka(t('--emas-muda')),
    bahaya: angka(t('--bahaya')),
    info: angka(t('--info')),
    positif: angka(t('--positif')),
    negatif: angka(t('--negatif')),
    panel: angka(t('--laken-pekat')),
    sorakEmas: angka(t('--sorak-emas')),
    sorakMerah: angka(t('--sorak-merah')),
    teksPositif: t('--positif'),
    teksNegatif: t('--negatif'),
  };
}
