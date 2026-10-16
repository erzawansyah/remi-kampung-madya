// Isian batas skor (keputusan pemilik #44), dipakai Atur meja offline (beranda) dan lobi online.
// Dua isian angka, batas atas dan batas bawah; kosong = tanpa batas. Batas bawah diketik tanpa
// minus (keyboard angka iPhone nggak punya tanda minus) lalu disimpan negatif. Angkanya dirapikan
// saat isian ditinggalkan (change/blur/Enter), bukan di setiap ketikan, lewat rapikanBatasSkor dari
// @remi/meja yang sejalan dengan validasi server. Semua dibungkus `.isian-batas-skor` supaya
// gampang disembunyikan utuh kalau nanti ada pilihan yang tidak memakai batas skor.

import { BATAS_SKOR_MAKS, BATAS_SKOR_MIN, KELIPATAN_BATAS_SKOR, rapikanBatasSkor, type ArahBatasSkor } from '@remi/meja';
import { angkaSkor } from './rincianSkor';

const ARAH: readonly ArahBatasSkor[] = ['atas', 'bawah'];

/** Label isian. Batas bawah diberi "(minus)" karena angkanya diketik positif. */
export const LABEL_ISIAN_BATAS: Record<ArahBatasSkor, string> = {
  atas: 'Batas skor atas',
  bawah: 'Batas skor bawah (minus)',
};
/** Label teks untuk yang tidak bisa mengubah (bukan host): angkanya sudah bertanda. */
export const LABEL_TEKS_BATAS: Record<ArahBatasSkor, string> = { atas: 'Batas skor atas', bawah: 'Batas skor bawah' };
export const KET_BATAS_SKOR = 'Kelipatan 10. Kosongkan kalau tanpa batas.';
export const TANPA_BATAS = 'Tanpa batas';

export interface NilaiBatasSkor {
  batasSkorAtas: number | null;
  batasSkorBawah: number | null;
}

const kunci = (arah: ArahBatasSkor): keyof NilaiBatasSkor => (arah === 'atas' ? 'batasSkorAtas' : 'batasSkorBawah');

/** Angka di dalam isian: nilai mutlak, kosong = tanpa batas. */
export const tampilIsianBatas = (v: number | null | undefined): string => (typeof v === 'number' && Number.isFinite(v) && v !== 0 ? String(Math.abs(v)) : '');

/** Teks batas untuk dibaca saja: "250", "−120", atau "Tanpa batas". */
export const teksBatas = (v: number | null | undefined): string => (typeof v === 'number' && Number.isFinite(v) && v !== 0 ? angkaSkor(v) : TANPA_BATAS);

export interface OpsiIsianBatas {
  /** Awalan id: 'o-skor' → #o-skor-atas, #o-skor-bawah, #o-skor-ket. */
  id: string;
  nilai: NilaiBatasSkor;
  /** false = tampil sebagai teks saja (lobi, bukan host). */
  bisaUbah: boolean;
}

/** Markup dua isian (atau dua baris teks), dibungkus `.isian-batas-skor`. */
export function htmlIsianBatas(o: OpsiIsianBatas): string {
  if (!o.bisaUbah) {
    const baris = ARAH.map(
      (arah) =>
        `<div class="baris baris-teks"><span>${LABEL_TEKS_BATAS[arah]}</span><b class="angka" id="${o.id}-${arah}">${teksBatas(o.nilai[kunci(arah)])}</b></div>`,
    ).join('');
    return `<div class="isian-batas-skor">${baris}</div>`;
  }
  const ket = `${o.id}-ket`;
  const isian = (arah: ArahBatasSkor) => {
    const minus = arah === 'bawah' ? '<span class="tanda" aria-hidden="true">−</span>' : '';
    return `<label class="baris">${LABEL_ISIAN_BATAS[arah]}<span class="isian-angka">${minus}<input type="number" id="${o.id}-${arah}" data-batas-skor="${arah}" inputmode="numeric" min="${BATAS_SKOR_MIN}" max="${BATAS_SKOR_MAKS}" step="${KELIPATAN_BATAS_SKOR}" placeholder="${TANPA_BATAS}" value="${tampilIsianBatas(o.nilai[kunci(arah)])}" autocomplete="off" enterkeyhint="done" aria-describedby="${ket}" /></span></label>`;
  };
  return `<div class="isian-batas-skor">${isian('atas')}${isian('bawah')}<p class="bantuan rapat" id="${ket}">${KET_BATAS_SKOR}</p></div>`;
}

/** Nilai kedua isian sekarang, sudah dirapikan (tanpa menulis balik ke isian). */
export function bacaIsianBatas(akar: ParentNode, id: string): NilaiBatasSkor {
  const baca = (arah: ArahBatasSkor) => rapikanBatasSkor(akar.querySelector<HTMLInputElement>(`#${id}-${arah}`)?.value ?? '', arah);
  return { batasSkorAtas: baca('atas'), batasSkorBawah: baca('bawah') };
}

/**
 * Panggil sebelum layar yang memuat isian digambar ulang (innerHTML diganti). Browser bisa
 * memicu blur pada isian yang sedang difokus saat elemennya dibuang; tanpa tanda ini angka yang
 * belum selesai diketik ikut terkirim, padahal pemiliknya masih mengetik di isian yang baru.
 */
export function lepasIsianBatas(akar: ParentNode): void {
  akar.querySelectorAll<HTMLInputElement>('input[data-batas-skor]').forEach((el) => (el.dataset.dibuang = '1'));
}

/**
 * Pasang perilaku isian: saat ditinggalkan (change atau blur) dan saat Enter, angkanya dirapikan
 * dan ditulis balik (255 → 260, 3 → 10, 0 → kosong). `saatBerubah` dipanggil sekali per nilai baru
 * dibanding `awal`, jadi meja online tidak dikirimi pesan di setiap ketikan atau dua kali untuk satu
 * perubahan.
 */
export function pasangIsianBatas(
  akar: ParentNode,
  id: string,
  awal: NilaiBatasSkor,
  saatBerubah?: (ubah: Partial<NilaiBatasSkor>) => void,
): void {
  for (const arah of ARAH) {
    const el = akar.querySelector<HTMLInputElement>(`#${id}-${arah}`);
    if (!(el instanceof HTMLInputElement)) continue;
    let terakhir = awal[kunci(arah)];
    const rapikan = () => {
      // Isian lama yang sedang dibuang karena layar digambar ulang: blur-nya bukan "ditinggalkan".
      if (el.dataset.dibuang) return;
      const v = rapikanBatasSkor(el.value, arah);
      const tampil = tampilIsianBatas(v);
      if (el.value !== tampil) el.value = tampil;
      if (v === terakhir) return;
      terakhir = v;
      saatBerubah?.({ [kunci(arah)]: v });
    };
    el.addEventListener('change', rapikan);
    el.addEventListener('blur', rapikan);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      rapikan();
      el.blur();
    });
  }
}
