// Jendela "Yang baru di versi X" (permintaan pemilik, 0.8.0): sekali sesudah pembaruan, di beranda.
// Isinya diambil dari CHANGELOG lewat pemecah yang sama dengan Catatan perubahan di Tentang
// (bagiChangelog, pilihRingkasan), jadi tidak ada teks perubahan yang ditulis dua kali. Modul ini
// dimuat malas (ikut chunk Tentang); kapan dibuka diputuskan yangBaru.ts + main.ts.

import changelog from '../../../../CHANGELOG.md?raw';
import { bandingVersi, rapikanVersi } from '../yangBaru';
import { bukaDialog, esc, type PenanganDialog } from './dom';
import { bagiChangelog, pilihRingkasan, renderMarkdown } from './tentang';

/** Versi yang ditampilkan terbuka; sisanya cukup disebut ("dan versi sebelumnya"). */
export const MAKS_VERSI_YANG_BARU = 3;

export interface VersiYangBaru {
  versi: string;
  /** Kalimat ringkasan di bawah judul versi (markdown mentah, bisa kosong). */
  ringkasan: string;
  /** Judul perubahan untuk pemain yang tampil terbuka. */
  perubahan: string[];
  /** Perubahan lain yang tidak ikut tampil. */
  sisa: number;
}

/**
 * Versi sesudah `dari` (eksklusif) sampai `kini` (inklusif), terbaru di depan. `dari` null = cukup versi
 * `kini`. Versi tanpa ringkasan maupun perubahan untuk pemain dilewati.
 */
export function daftarYangBaru(dari: string | null, kini: string, sumber: string = changelog): VersiYangBaru[] {
  const hasil: VersiYangBaru[] = [];
  for (const v of bagiChangelog(sumber)) {
    const versi = rapikanVersi(/^\[([^\]]+)\]/.exec(v.judul)?.[1]);
    if (!versi || bandingVersi(versi, kini) > 0) continue;
    if (dari ? bandingVersi(versi, dari) <= 0 : bandingVersi(versi, kini) !== 0) continue;
    const { tampil, sisa } = pilihRingkasan(v.pemain);
    const ringkasan = v.pembuka.trim();
    if (!ringkasan && !tampil.length) continue;
    hasil.push({ versi, ringkasan, perubahan: tampil, sisa });
  }
  return hasil.sort((a, b) => bandingVersi(b.versi, a.versi));
}

function htmlVersi(v: VersiYangBaru, judul: boolean): string {
  const lain = v.sisa ? `<li class="redup">dan ${v.sisa} perubahan lain</li>` : '';
  return `<section class="yang-baru-versi">
    ${judul ? `<h3>Versi <span class="angka">${esc(v.versi)}</span></h3>` : ''}
    ${v.ringkasan ? `<div class="md">${renderMarkdown(v.ringkasan)}</div>` : ''}
    ${v.perubahan.length ? `<ul class="changelog-ringkas">${v.perubahan.map((j) => `<li>${esc(j)}</li>`).join('')}${lain}</ul>` : ''}
  </section>`;
}

/** Isi jendela untuk `daftar` (sudah urut terbaru di depan, tidak kosong). */
export function htmlYangBaru(kini: string, daftar: VersiYangBaru[]): string {
  const tampil = daftar.slice(0, MAKS_VERSI_YANG_BARU);
  const lama = daftar.slice(MAKS_VERSI_YANG_BARU).map((v) => v.versi);
  const banyak = tampil.length > 1;
  return `<div class="kepala-dialog">
      <h2 id="judul-yang-baru">Yang baru di versi <span class="angka">${esc(kini)}</span></h2>
      <button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup">✕</button>
    </div>
    ${tampil.map((v) => htmlVersi(v, banyak)).join('')}
    ${lama.length ? `<p class="redup yang-baru-lain">…dan versi sebelumnya (${lama.map(esc).join(', ')}) ada di Catatan lengkap.</p>` : ''}
    <div class="kaki-dialog">
      <button type="button" class="hantu" data-catatan>Catatan lengkap</button>
      <button type="button" class="utama" data-tutup>Oke</button>
    </div>`;
}

export interface OpsiYangBaru {
  /** "Catatan lengkap": jendela ini ditutup dulu, lalu Catatan perubahan di Tentang dibuka. */
  catatanLengkap: () => void;
}

/** Buka jendela "Yang baru" (lewat bukaDialog, jadi momen aman pembaruan ikut menunda). */
export function bukaYangBaru(kini: string, daftar: VersiYangBaru[], opsi: OpsiYangBaru): PenanganDialog {
  return bukaDialog(
    htmlYangBaru(kini, daftar),
    (d, tutup) => {
      d.querySelector('[data-catatan]')!.addEventListener('click', () => {
        tutup();
        opsi.catatanLengkap();
      });
    },
    { kelas: 'yang-baru' },
  );
}
