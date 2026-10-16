// Ingatan warga kedai jago/suhu: hanya dari ViewPemain, persis yang bisa diingat pemain yang
// teliti di meja asli. Tangan sendiri, buangan teratas, semua kartu jadi, dan peristiwa putaran ini
// yang masih ada di view (kartu yang pernah dibuang, kartu yang dipungut lawan). Tidak ada info
// tersembunyi lain.
//
// Riwayatnya terbatas: view hanya membawa BATAS_PERISTIWA_VIEW (40) peristiwa terakhir (view.ts,
// keputusan #25), termasuk ambil deck dan peristiwa putaran lalu. Itu kira-kira 20 giliran terakhir,
// jadi di meja besar (5–6 pemain, 2 deck) buangan yang lebih lama terlupa dan dihitung belum terlihat.
// Yang terlupa hanya membuat perkiraan kurang tajam; yang tergeser lebih dulu selalu peristiwa
// tertua, jadi yang masih diingat tidak keliru. Jangan memperpanjang view demi bot (AGENTS.md, #25).

import type { Kartu } from '../kartu.js';
import type { ViewPemain } from '../view.js';
import { tipeKartu } from './susun.js';

export interface Ingatan {
  /** Salinan per tipe kartu yang belum terlihat (di deck, atau di tangan lawan tanpa diketahui). */
  belum: Int8Array;
  totalBelum: number;
  /** Kartu yang pasti ada di tangan tiap pemain: hasil mungut yang belum dijadikan atau dibuang. */
  diketahui: Kartu[][];
  /** Jumlah deck (salinan per tipe). */
  salinan: number;
}

/**
 * @param riwayat true = ingat peristiwa putaran ini yang masih ada di view (paling banyak
 *   BATAS_PERISTIWA_VIEW terakhir, kira-kira 20 giliran): kartu yang sudah tertimbun di buangan dan
 *   kartu hasil mungut lawan; false = hanya yang terlihat sekarang di meja.
 */
export function bacaIngatan(view: ViewPemain, riwayat = true): Ingatan {
  const p = view.putaran!;
  const saya = view.saya!;
  const n = view.konfigurasi.jumlahPemain;
  const salinan = n >= 5 || (n === 4 && view.konfigurasi.duaDeckUntukEmpat) ? 2 : 1;

  const diBuangan = new Map<string, Kartu>();
  const dipegang: Map<string, Kartu>[] = Array.from({ length: n }, () => new Map());
  for (const e of riwayat ? view.peristiwa : []) {
    if (e.putaran !== p.nomor) continue;
    if (e.jenis === 'buang') {
      // Nutup pakai beberapa joker (#41): semua kartunya ikut dibuang di satu peristiwa.
      for (const k of [e.kartu, ...(e.kartuLain ?? [])]) {
        diBuangan.set(k.id, k);
        dipegang[e.pemain].delete(k.id);
      }
    } else if (e.jenis === 'mulung') {
      for (const x of e.kartu) {
        diBuangan.delete(x.kartu.id);
        dipegang[e.pemain].set(x.kartu.id, x.kartu);
      }
    }
  }
  for (const e of p.buangan) diBuangan.set(e.kartu.id, e.kartu);

  const terlihat = new Set<string>();
  const hitung = new Int8Array(52);
  const lihat = (k: Kartu) => {
    if (terlihat.has(k.id)) return;
    terlihat.add(k.id);
    hitung[tipeKartu(k)]++;
  };
  for (const k of p.tangan[saya] ?? []) lihat(k);
  for (const kj of p.kartuJadi.flat()) for (const d of kj.kartu) lihat(d.kartu);
  for (const k of diBuangan.values()) lihat(k);
  const diketahui = dipegang.map((m, i) => (i === saya ? [] : [...m.values()].filter((k) => !terlihat.has(k.id))));
  for (const d of diketahui) for (const k of d) lihat(k);

  const belum = new Int8Array(52);
  let totalBelum = 0;
  for (let t = 0; t < 52; t++) {
    belum[t] = Math.max(0, salinan - hitung[t]);
    totalBelum += belum[t];
  }
  return { belum, totalBelum, diketahui, salinan };
}
