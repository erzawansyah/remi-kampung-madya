// Sprint (keputusan pemilik 25 Nov 2026): satu baris per percobaan, di database SQLite yang sama dengan
// riwayat (tabelnya dibuat migrasi v7 di riwayat.ts). Aturan hitung papan dan juara mingguan hanya di
// @remi/meja (sprint.ts); di sini hanya menyimpan dan membaca.

import type { DatabaseSync } from 'node:sqlite';
import {
  awalMingguWib,
  juaraMingguan,
  kunciNama,
  pialaSprint,
  rekapSprint,
  type BarisSprint,
  type CatatanSprint,
  type PercobaanSprint,
} from '@remi/meja';

/**
 * Migrasi v7 (25 Nov 2026). Waktu ms epoch (INTEGER). Satu percobaan = satu meja sprint, dikenali dari
 * kode meja + waktu mulainya (UNIQUE), jadi percobaan yang sama tidak pernah tercatat dua kali.
 */
export const SKEMA_SPRINT = `
  CREATE TABLE IF NOT EXISTS sprint (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_meja TEXT NOT NULL,
    mulai_pada INTEGER NOT NULL,
    nama TEXT NOT NULL,
    kunci_nama TEXT NOT NULL,
    waktu INTEGER NOT NULL,
    putaran INTEGER NOT NULL,
    skor INTEGER NOT NULL,
    menang INTEGER NOT NULL,
    mentung INTEGER NOT NULL,
    kepentung INTEGER NOT NULL,
    selesai INTEGER NOT NULL,
    UNIQUE (kode_meja, mulai_pada)
  );
  CREATE INDEX IF NOT EXISTS sprint_waktu ON sprint (waktu);
`;

export type PeriodeSprint = 'minggu' | 'semua';

/** Baris papan paling banyak di jawaban API. */
export const MAKS_BARIS_SPRINT = 100;

/** Jawaban `GET /api/sprint`. */
export interface PapanSprint {
  periode: PeriodeSprint;
  /** Awal minggu WIB (ms epoch) untuk 'minggu'; null untuk 'semua'. */
  mulai: number | null;
  baris: BarisSprint[];
}

export interface PenyimpanSprint {
  /** Catat satu percobaan. False = percobaan ini sudah tercatat sebelumnya (tidak ditulis lagi). */
  catat(c: CatatanSprint): boolean;
  /** Papan sprint urutan bawaan (paling banyak MAKS_BARIS_SPRINT baris). */
  papan(periode: PeriodeSprint, sekarang: number): PapanSprint;
  /** Posisi `nama` di papan minggu ini (1 = teratas); null = belum ada percobaannya minggu ini. */
  peringkatMinggu(nama: string, sekarang: number): number | null;
}

/** Periode dari parameter URL: selain 'semua' jadi 'minggu'. */
export function rapikanPeriodeSprint(x: unknown): PeriodeSprint {
  return x === 'semua' ? 'semua' : 'minggu';
}

export function buatPenyimpanSprint(db: DatabaseSync): PenyimpanSprint {
  const tambah = db.prepare(
    `INSERT OR IGNORE INTO sprint (kode_meja, mulai_pada, nama, kunci_nama, waktu, putaran, skor, menang, mentung, kepentung, selesai)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ambilSemua = db.prepare('SELECT nama, kunci_nama, waktu, menang, skor, mentung, kepentung FROM sprint ORDER BY waktu, id');

  /** Semua percobaan (dibaca sekali, dikosongkan setiap ada percobaan baru). */
  let cache: PercobaanSprint[] | null = null;
  const semua = (): PercobaanSprint[] =>
    (cache ??= (ambilSemua.all() as Record<string, number | string>[]).map((b) => ({
      nama: String(b.nama),
      kunci: String(b.kunci_nama),
      waktu: Number(b.waktu),
      menang: Number(b.menang) === 1,
      skor: Number(b.skor),
      mentung: Number(b.mentung),
      kepentung: Number(b.kepentung),
    })));

  function hitung(periode: PeriodeSprint, sekarang: number): { mulai: number | null; baris: BarisSprint[] } {
    const xs = semua();
    // Ejaan nama terbaru per orang dari semua percobaan (juga di luar periode), seperti leaderboard umum.
    const ejaan = new Map<string, string>();
    for (const p of xs) ejaan.set(p.kunci ?? kunciNama(p.nama), p.nama);
    const piala = pialaSprint(juaraMingguan(xs, sekarang));
    const mulai = periode === 'minggu' ? awalMingguWib(sekarang) : null;
    const dipakai = mulai === null ? xs : xs.filter((p) => p.waktu >= mulai);
    return { mulai, baris: rekapSprint(dipakai, ejaan, piala) };
  }

  return {
    catat(c) {
      const hasil = tambah.run(
        c.kode,
        c.mulaiPada,
        c.nama,
        kunciNama(c.nama),
        c.waktu,
        c.putaran,
        c.skor,
        c.menang ? 1 : 0,
        c.mentung,
        c.kepentung,
        c.selesai ? 1 : 0,
      );
      const baru = Number(hasil.changes) > 0;
      if (baru) cache = null;
      return baru;
    },
    papan(periode, sekarang) {
      const { mulai, baris } = hitung(periode, sekarang);
      return { periode, mulai, baris: baris.slice(0, MAKS_BARIS_SPRINT) };
    },
    peringkatMinggu(nama, sekarang) {
      const kunci = kunciNama(nama);
      const i = hitung('minggu', sekarang).baris.findIndex((b) => kunciNama(b.nama) === kunci);
      return i < 0 ? null : i + 1;
    },
  };
}
