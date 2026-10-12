// Teks untuk log dan UI.

import { NAMA_BUNGA, namaKartu, namaRank } from './kartu.js';
import type { HasilValidasiKartuJadi } from './kartuJadi.js';

/** Contoh: "3-4-5 Wajik", "2-3-4-5 Love (joker jadi 4)", "kembar As Waru-Love-Kriting". */
export function deskripsiKartuJadi(kj: HasilValidasiKartuJadi): string {
  if (kj.jenis === 'kembarAs') {
    return `kembar As ${kj.kartu.map((d) => NAMA_BUNGA[d.sebagai.bunga]).join('-')}`;
  }
  const dasar = `${kj.kartu.map((d) => namaRank(d.sebagai.rank)).join('-')} ${NAMA_BUNGA[kj.kartu[0].sebagai.bunga]}`;
  const joker = kj.kartu.filter((d) => d.pengganti);
  if (!joker.length) return dasar;
  return `${dasar} (${joker.map((d) => `${namaKartu(d.kartu)} jadi ${namaRank(d.sebagai.rank)}`).join(', ')})`;
}

export function daftarNama(nama: string[]): string {
  if (nama.length <= 1) return nama.join('');
  return `${nama.slice(0, -1).join(', ')} dan ${nama[nama.length - 1]}`;
}
