// Sprint, di database SQLite yang sama dengan riwayat. Sejak 26 Nov 2026 (keputusan pemilik: tanpa batas
// putaran) satu baris per putaran di tabel sprint_putaran (migrasi v8); tabel sprint (migrasi v7) hanya
// berisi percobaan 5 putaran dari 0.8.0, tetap dibaca apa adanya dan tidak ditulis lagi. Aturan hitung
// papan dan juara mingguan hanya di @remi/meja (sprint.ts); di sini hanya menyimpan dan membaca.

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
 * kode meja + waktu mulainya (UNIQUE), jadi percobaan yang sama tidak pernah tercatat dua kali. Sejak
 * 26 Nov 2026 hanya dibaca (baris 0.8.0); catatan baru masuk SKEMA_SPRINT_PUTARAN.
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

/**
 * Migrasi v8 (26 Nov 2026, sprint tanpa batas putaran): satu baris per putaran, dicatat saat putarannya
 * selesai. Dikenali dari kode meja + waktu mulai meja + nomor putaran (UNIQUE), jadi putaran yang sama
 * tidak pernah tercatat dua kali (sambung ulang, restart, pencatatan ulang sesudah galat). `waktu` = kapan
 * putarannya selesai (menentukan minggu papannya).
 */
export const SKEMA_SPRINT_PUTARAN = `
  CREATE TABLE IF NOT EXISTS sprint_putaran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_meja TEXT NOT NULL,
    mulai_pada INTEGER NOT NULL,
    putaran INTEGER NOT NULL,
    nama TEXT NOT NULL,
    kunci_nama TEXT NOT NULL,
    waktu INTEGER NOT NULL,
    skor INTEGER NOT NULL,
    menang INTEGER NOT NULL,
    mentung INTEGER NOT NULL,
    kepentung INTEGER NOT NULL,
    UNIQUE (kode_meja, mulai_pada, putaran)
  );
  CREATE INDEX IF NOT EXISTS sprint_putaran_waktu ON sprint_putaran (waktu);
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
  /** Catat satu putaran. False = putaran ini sudah tercatat sebelumnya (tidak ditulis lagi). */
  catat(c: CatatanSprint): boolean;
  /** Papan sprint urutan bawaan (paling banyak MAKS_BARIS_SPRINT baris). */
  papan(periode: PeriodeSprint, sekarang: number): PapanSprint;
  /** Posisi `nama` di papan minggu ini (1 = teratas); null = belum ada catatannya minggu ini. */
  peringkatMinggu(nama: string, sekarang: number): number | null;
}

/** Periode dari parameter URL: selain 'semua' jadi 'minggu'. */
export function rapikanPeriodeSprint(x: unknown): PeriodeSprint {
  return x === 'semua' ? 'semua' : 'minggu';
}

export function buatPenyimpanSprint(db: DatabaseSync): PenyimpanSprint {
  const tambah = db.prepare(
    `INSERT OR IGNORE INTO sprint_putaran (kode_meja, mulai_pada, putaran, nama, kunci_nama, waktu, skor, menang, mentung, kepentung)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // Percobaan 0.8.0 (tabel sprint) dan putaran sejak 26 Nov 2026 (sprint_putaran), dijumlah bersama.
  const ambilSemua = db.prepare(
    `SELECT nama, kunci_nama, waktu, menang, skor, mentung, kepentung, 0 AS sumber, id FROM sprint
     UNION ALL
     SELECT nama, kunci_nama, waktu, menang, skor, mentung, kepentung, 1 AS sumber, id FROM sprint_putaran
     ORDER BY waktu, sumber, id`,
  );

  /** Semua catatan (dibaca sekali, dikosongkan setiap ada catatan baru). */
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
    // Ejaan nama terbaru per orang dari semua catatan (juga di luar periode), seperti leaderboard umum.
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
        c.putaran,
        c.nama,
        kunciNama(c.nama),
        c.waktu,
        c.skor,
        c.menang ? 1 : 0,
        c.mentung,
        c.kepentung,
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
