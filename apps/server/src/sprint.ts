// Sprint, di database SQLite yang sama dengan riwayat. Sejak 26 Nov 2026 (keputusan pemilik: tanpa batas
// putaran) satu baris per putaran di tabel sprint_putaran (migrasi v8); tabel sprint (migrasi v7) hanya
// berisi percobaan 5 putaran dari 0.8.0, tetap dibaca apa adanya dan tidak ditulis lagi. Sejak 27 Nov 2026
// putaran minggu yang sudah selesai digulung jadi satu baris per orang per minggu (sprint_mingguan,
// migrasi v10). Aturan hitung papan, minggu terbaik, juara mingguan, dan ringkasan mingguan hanya di
// @remi/meja (sprint.ts); di sini hanya menyimpan, menjumlah, dan membaca.

import type { DatabaseSync } from 'node:sqlite';
import {
  awalMingguWib,
  juaraMingguan,
  kunciNama,
  pialaSprint,
  potongPapanSprint,
  rekapSprint,
  ringkasMingguan,
  terbaikMingguan,
  urutkanSprint,
  type BarisPeringkatSprint,
  type BarisSprint,
  type CatatanSprint,
  type PercobaanSprint,
  type PeriodeSprint,
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

/**
 * Migrasi v10 (27 Nov 2026, papan Sepanjang masa = minggu terbaik). `sprint_mingguan`: satu baris per orang
 * per minggu WIB yang sudah selesai (awalMingguWib), jumlah putaran, menang, mentung, kepentung, dan skor
 * dari sprint_putaran minggu itu; `nama` dan `waktu` = catatan terakhir orang itu di minggu itu.
 * `sprint_tergulung`: per meja sprint (kode meja + waktu mulai, kunci yang sama dengan sprint_putaran),
 * nomor putaran terbesar yang sudah masuk sprint_mingguan, supaya putaran yang sama tidak terhitung dua kali
 * kalau dicatat lagi sesudah barisnya digulung dan dibuang (satu baris per meja, bukan per putaran).
 */
export const SKEMA_SPRINT_MINGGUAN = `
  CREATE TABLE IF NOT EXISTS sprint_mingguan (
    minggu INTEGER NOT NULL,
    kunci_nama TEXT NOT NULL,
    nama TEXT NOT NULL,
    waktu INTEGER NOT NULL,
    putaran INTEGER NOT NULL DEFAULT 0,
    menang INTEGER NOT NULL DEFAULT 0,
    mentung INTEGER NOT NULL DEFAULT 0,
    kepentung INTEGER NOT NULL DEFAULT 0,
    skor INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (minggu, kunci_nama)
  );
  CREATE TABLE IF NOT EXISTS sprint_tergulung (
    kode_meja TEXT NOT NULL,
    mulai_pada INTEGER NOT NULL,
    putaran_sampai INTEGER NOT NULL,
    PRIMARY KEY (kode_meja, mulai_pada)
  );
`;

export type { PeriodeSprint };


/** Syarat SQL: baris sprint_putaran ini nomor putarannya sudah masuk sprint_mingguan (sprint_tergulung). */
const SUDAH_TERGULUNG = `SELECT 1 FROM sprint_tergulung t WHERE t.kode_meja = sprint_putaran.kode_meja
  AND t.mulai_pada = sprint_putaran.mulai_pada AND t.putaran_sampai >= sprint_putaran.putaran`;

const MINGGU_MS = 7 * 24 * 60 * 60 * 1000;
/** Penanda sprint_tergulung disimpan paling sedikit sekian minggu sesudah mejanya mulai. */
export const PENANDA_GULUNG_MINGGU = 4;

/** Baris papan paling banyak di jawaban API. */
export const MAKS_BARIS_SPRINT = 100;

/**
 * Jawaban `GET /api/sprint` tanpa `v=2` (aplikasi 0.8.0–0.10.1, yang membaca periode, mulai, dan baris
 * lalu mengurutkan sendiri): bentuknya tetap. Sejak 27 Nov 2026 baris Sepanjang masa = minggu terbaik tiap
 * orang (ada field `minggu` tambahan yang diabaikan aplikasi lama).
 */
export interface PapanSprint {
  periode: PeriodeSprint;
  /** Awal minggu WIB (ms epoch) untuk 'minggu'; null untuk 'semua'. */
  mulai: number | null;
  baris: BarisSprint[];
}

/**
 * Jawaban `GET /api/sprint?v=2` (aplikasi sejak 0.10.2): 10 teratas, 10 terbawah, banyaknya orang, dan baris
 * pemain sendiri (`nama=`) kalau ada di antaranya, semua dengan peringkat resmi.
 */
export interface PapanSprintV2 {
  v: 2;
  periode: PeriodeSprint;
  mulai: number | null;
  jumlah: number;
  atas: BarisPeringkatSprint[];
  bawah: BarisPeringkatSprint[];
  saya: BarisPeringkatSprint | null;
}

export interface PenyimpanSprint {
  /** Catat satu putaran. False = putaran ini sudah tercatat sebelumnya (tidak ditulis lagi). */
  catat(c: CatatanSprint): boolean;
  /** Papan sprint bentuk lama, urutan bawaan (paling banyak MAKS_BARIS_SPRINT baris). */
  papan(periode: PeriodeSprint, sekarang: number): PapanSprint;
  /** Papan sprint untuk aplikasi baru: atas, bawah, jumlah, dan baris `namaSaya`. */
  papanV2(periode: PeriodeSprint, sekarang: number, namaSaya?: string | null): PapanSprintV2;
  /**
   * Gulung putaran (sprint_putaran) dari minggu yang sudah selesai (sebelum minggu `sekarang`) ke
   * sprint_mingguan, dalam satu transaksi dengan membuang barisnya. Idempoten. Mengembalikan banyaknya
   * baris putaran yang digulung.
   */
  gulung(sekarang: number): number;
  /** Posisi `nama` di papan minggu ini (1 = teratas); null = belum ada catatannya minggu ini. */
  peringkatMinggu(nama: string, sekarang: number): number | null;
}

/**
 * Potong papan bentuk lama ke MAKS_BARIS_SPRINT baris. Aplikasi 0.8.0–0.10.1 mengurutkan sendiri dengan
 * menang lebih dulu (urutkanSprint bawaan), jadi yang dipilih = 100 baris teratas menurut urutan itu; urutan
 * kirimnya tetap urutan bawaan periodenya. Papan dengan ≤ 100 orang tidak berubah.
 */
export function potongBentukLama(baris: readonly BarisSprint[]): BarisSprint[] {
  if (baris.length <= MAKS_BARIS_SPRINT) return [...baris];
  const pilih = new Set(urutkanSprint(baris, null, 'minggu').slice(0, MAKS_BARIS_SPRINT));
  return baris.filter((b) => pilih.has(b));
}

/** Nama pemain dari parameter URL papan (`nama=`): dipotong 60 huruf; kosong = null. Hanya untuk mencari barisnya. */
export function rapikanNamaPapan(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const n = x.trim().slice(0, 60);
  return n ? n : null;
}

/** Periode dari parameter URL: selain 'semua' jadi 'minggu'. */
export function rapikanPeriodeSprint(x: unknown): PeriodeSprint {
  return x === 'semua' ? 'semua' : 'minggu';
}

export function buatPenyimpanSprint(db: DatabaseSync): PenyimpanSprint {
  // Putaran yang nomornya sudah masuk sprint_mingguan (sprint_tergulung) tidak ditulis lagi.
  const tambah = db.prepare(
    `INSERT OR IGNORE INTO sprint_putaran (kode_meja, mulai_pada, putaran, nama, kunci_nama, waktu, skor, menang, mentung, kepentung)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
     WHERE NOT EXISTS (SELECT 1 FROM sprint_tergulung WHERE kode_meja = ?1 AND mulai_pada = ?2 AND putaran_sampai >= ?3)`,
  );
  // Percobaan 0.8.0 (tabel sprint), ringkasan minggu yang sudah digulung (sprint_mingguan), dan putaran
  // yang belum digulung (sprint_putaran), dijumlah bersama. Kolom putaran: baris 0.8.0 menyimpan putaran yang
  // selesai di percobaan itu; sprint_mingguan jumlahnya; baris sprint_putaran = 1 putaran. Kolom menang
  // sprint_mingguan berupa jumlah (PercobaanSprint.menang boleh angka).
  const ambilSemua = db.prepare(
    `SELECT nama, kunci_nama, waktu, menang, skor, mentung, kepentung, putaran, 0 AS sumber, id FROM sprint
     UNION ALL
     SELECT nama, kunci_nama, waktu, menang, skor, mentung, kepentung, putaran, 1 AS sumber, rowid AS id FROM sprint_mingguan
     UNION ALL
     SELECT nama, kunci_nama, waktu, menang, skor, mentung, kepentung, 1 AS putaran, 2 AS sumber, id FROM sprint_putaran
     WHERE NOT EXISTS (${SUDAH_TERGULUNG})
     ORDER BY waktu, sumber, id`,
  );
  // Putaran yang nomornya sudah masuk sprint_mingguan tapi barisnya ada lagi di sprint_putaran: hanya bisa
  // terjadi kalau server versi sebelum 0.10.2 (yang tidak memeriksa sprint_tergulung) sempat mencatatnya
  // ulang sesudah rollback. Tidak dibaca papan dan dibuang saat menggulung, jadi tidak terhitung dua kali.
  const buangTergulung = db.prepare(`DELETE FROM sprint_putaran WHERE EXISTS (${SUDAH_TERGULUNG})`);
  // Penanda meja yang sudah lama (mulai lebih dari PENANDA_GULUNG_MINGGU minggu sebelum minggu ini) dan
  // tidak bisa mencatat lagi (tidak ada di sprint_simpanan maupun meja_aktif) dibuang, supaya tabelnya
  // tidak tumbuh terus.
  const buangPenanda = db.prepare(
    `DELETE FROM sprint_tergulung WHERE mulai_pada < ?
       AND NOT EXISTS (SELECT 1 FROM sprint_simpanan s WHERE s.kode = sprint_tergulung.kode_meja)
       AND NOT EXISTS (SELECT 1 FROM meja_aktif a WHERE a.kode = sprint_tergulung.kode_meja)`,
  );
  const ambilLewat = db.prepare(
    'SELECT kode_meja, mulai_pada, putaran, nama, kunci_nama, waktu, menang, skor, mentung, kepentung FROM sprint_putaran WHERE waktu < ? ORDER BY waktu, id',
  );
  const tambahMingguan = db.prepare(
    `INSERT INTO sprint_mingguan (minggu, kunci_nama, nama, waktu, putaran, menang, mentung, kepentung, skor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (minggu, kunci_nama) DO UPDATE SET
       nama = CASE WHEN excluded.waktu >= sprint_mingguan.waktu THEN excluded.nama ELSE sprint_mingguan.nama END,
       waktu = max(sprint_mingguan.waktu, excluded.waktu),
       putaran = sprint_mingguan.putaran + excluded.putaran,
       menang = sprint_mingguan.menang + excluded.menang,
       mentung = sprint_mingguan.mentung + excluded.mentung,
       kepentung = sprint_mingguan.kepentung + excluded.kepentung,
       skor = sprint_mingguan.skor + excluded.skor`,
  );
  const tandaiTergulung = db.prepare(
    `INSERT INTO sprint_tergulung (kode_meja, mulai_pada, putaran_sampai) VALUES (?, ?, ?)
     ON CONFLICT (kode_meja, mulai_pada) DO UPDATE SET putaran_sampai = max(sprint_tergulung.putaran_sampai, excluded.putaran_sampai)`,
  );
  const buangLewat = db.prepare('DELETE FROM sprint_putaran WHERE waktu < ?');

  /** Semua catatan (dibaca sekali, dikosongkan setiap ada catatan baru). */
  let cache: PercobaanSprint[] | null = null;
  const semua = (): PercobaanSprint[] =>
    (cache ??= (ambilSemua.all() as Record<string, number | string>[]).map((b) => ({
      nama: String(b.nama),
      kunci: String(b.kunci_nama),
      waktu: Number(b.waktu),
      // 0/1 (putaran, percobaan 0.8.0) atau jumlah menang (sprint_mingguan).
      menang: Number(b.menang),
      skor: Number(b.skor),
      mentung: Number(b.mentung),
      kepentung: Number(b.kepentung),
      putaran: Number(b.putaran),
    })));

  /**
   * Papan satu periode dalam urutan bawaan periodenya. Minggu ini: jumlah catatan minggu berjalan
   * (rekapSprint). Sepanjang masa (27 Nov 2026): minggu terbaik tiap orang (terbaikMingguan), minggu
   * berjalan ikut.
   */
  function hitung(periode: PeriodeSprint, sekarang: number): { mulai: number | null; baris: BarisSprint[] } {
    const xs = semua();
    // Ejaan nama terbaru per orang dari semua catatan (juga di luar periode), seperti leaderboard umum.
    const ejaan = new Map<string, string>();
    for (const p of xs) ejaan.set(p.kunci ?? kunciNama(p.nama), p.nama);
    const piala = pialaSprint(juaraMingguan(xs, sekarang));
    if (periode === 'semua') return { mulai: null, baris: terbaikMingguan(xs, ejaan, piala) };
    const mulai = awalMingguWib(sekarang);
    return { mulai, baris: rekapSprint(xs.filter((p) => p.waktu >= mulai), ejaan, piala) };
  }

  const transaksi = <T>(fn: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const hasil = fn();
      db.exec('COMMIT');
      return hasil;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };

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
      return { periode, mulai, baris: potongBentukLama(baris) };
    },
    papanV2(periode, sekarang, namaSaya) {
      const { mulai, baris } = hitung(periode, sekarang);
      return { v: 2, periode, mulai, ...potongPapanSprint(baris, namaSaya) };
    },
    gulung(sekarang) {
      const batas = awalMingguWib(sekarang);
      const n = transaksi(() => {
        buangTergulung.run();
        buangPenanda.run(batas - PENANDA_GULUNG_MINGGU * MINGGU_MS);
        const xs = ambilLewat.all(batas) as Record<string, number | string>[];
        if (!xs.length) return 0;
        const catatan: PercobaanSprint[] = xs.map((b) => ({
          nama: String(b.nama),
          kunci: String(b.kunci_nama),
          waktu: Number(b.waktu),
          menang: Number(b.menang) === 1,
          skor: Number(b.skor),
          mentung: Number(b.mentung),
          kepentung: Number(b.kepentung),
        }));
        for (const r of ringkasMingguan(catatan)) {
          tambahMingguan.run(r.minggu, r.kunci, r.nama, r.waktu, r.putaran, r.menang, r.mentung, r.kepentung, r.skor);
        }
        const sampai = new Map<string, [string, number, number]>();
        for (const b of xs) {
          const k = `${String(b.kode_meja)}\u0000${Number(b.mulai_pada)}`;
          const lama = sampai.get(k);
          if (!lama || Number(b.putaran) > lama[2]) sampai.set(k, [String(b.kode_meja), Number(b.mulai_pada), Number(b.putaran)]);
        }
        for (const [kode, mulai, putaran] of sampai.values()) tandaiTergulung.run(kode, mulai, putaran);
        buangLewat.run(batas);
        return xs.length;
      });
      if (n) cache = null;
      return n;
    },
    peringkatMinggu(nama, sekarang) {
      const kunci = kunciNama(nama);
      const i = hitung('minggu', sekarang).baris.findIndex((b) => kunciNama(b.nama) === kunci);
      return i < 0 ? null : i + 1;
    },
  };
}
