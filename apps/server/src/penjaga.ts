// Penjaga proses: galat yang lolos (uncaughtException / unhandledRejection) dicatat, proses tetap
// hidup supaya meja lain (yang hanya ada di memori) tidak ikut hilang. Kalau galat datang
// bertubi-tubi (tanda state sudah rusak), proses diakhiri supaya Docker menyalakan ulang.

import type { EventEmitter } from 'node:events';

export interface OpsiPenjaga {
  log: (...x: unknown[]) => void;
  /** Maksimal galat dalam satu jendela waktu sebelum proses diakhiri. */
  batas?: number;
  jendelaMs?: number;
  sekarang?: () => number;
  keluar?: (kode: number) => void;
}

/** Pasang penangan di `proses` (biasanya `process`). Mengembalikan fungsi pelepas. */
export function pasangPenjagaProses(proses: EventEmitter, opsi: OpsiPenjaga): () => void {
  const batas = opsi.batas ?? 20;
  const jendela = opsi.jendelaMs ?? 60_000;
  const sekarang = opsi.sekarang ?? Date.now;
  const keluar = opsi.keluar ?? ((kode: number) => process.exit(kode));
  let waktu: number[] = [];

  const catat = (jenis: string, e: unknown) => {
    const t = sekarang();
    waktu = waktu.filter((x) => t - x < jendela);
    waktu.push(t);
    opsi.log(`${jenis} (tetap jalan, ${waktu.length}/${batas} dalam ${Math.round(jendela / 1000)} detik)`, e);
    if (waktu.length >= batas) {
      opsi.log(`galat terlalu sering (${waktu.length} dalam ${Math.round(jendela / 1000)} detik), proses diakhiri`);
      keluar(1);
    }
  };
  const galat = (e: unknown) => catat('uncaughtException', e);
  const tolakan = (e: unknown) => catat('unhandledRejection', e);
  proses.on('uncaughtException', galat);
  proses.on('unhandledRejection', tolakan);
  return () => {
    proses.off('uncaughtException', galat);
    proses.off('unhandledRejection', tolakan);
  };
}
