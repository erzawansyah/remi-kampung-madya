// Riwayat klasemen akhir permainan online, disimpan di SQLite (modul bawaan Node `node:sqlite`,
// tanpa dependensi native). Hanya klasemen akhir yang disimpan, bukan rincian per putaran.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RingkasanAkhir } from '@remi/meja';

export interface PermainanTersimpan {
  id: number;
  kodeMeja: string;
  /** ISO 8601 */
  selesaiPada: string;
  alasan: string | null;
  jumlahPutaran: number;
  klasemen: RingkasanAkhir['pemain'];
}

export interface BarisPeringkat {
  nama: string;
  main: number;
  juara: number;
  totalSkor: number;
  rataRata: number;
  skorTerbaik: number;
  mentung: number;
  kepentung: number;
}

export interface PenyimpanRiwayat {
  simpan(r: RingkasanAkhir): number;
  /** Permainan terbaru dulu. */
  daftar(batas: number): PermainanTersimpan[];
  /** Peringkat sepanjang masa, hanya pemain manusia, digabung berdasarkan nama. */
  peringkat(): BarisPeringkat[];
  tutup(): void;
}

/** Buka (atau buat) database riwayat. `path` boleh ':memory:' untuk test. */
export function bukaRiwayat(path: string): PenyimpanRiwayat {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS permainan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_meja TEXT NOT NULL,
      selesai_pada TEXT NOT NULL,
      alasan TEXT,
      jumlah_putaran INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS klasemen (
      permainan_id INTEGER NOT NULL REFERENCES permainan(id) ON DELETE CASCADE,
      kursi INTEGER NOT NULL,
      peringkat INTEGER NOT NULL,
      nama TEXT NOT NULL,
      bot INTEGER NOT NULL,
      skor INTEGER NOT NULL,
      mentung INTEGER NOT NULL DEFAULT 0,
      kepentung INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (permainan_id, kursi)
    );
    CREATE INDEX IF NOT EXISTS klasemen_nama ON klasemen (nama) WHERE bot = 0;
  `);

  const tambahPermainan = db.prepare(
    'INSERT INTO permainan (kode_meja, selesai_pada, alasan, jumlah_putaran) VALUES (?, ?, ?, ?)',
  );
  const tambahBaris = db.prepare(
    'INSERT INTO klasemen (permainan_id, kursi, peringkat, nama, bot, skor, mentung, kepentung) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const ambilPermainan = db.prepare(
    'SELECT id, kode_meja, selesai_pada, alasan, jumlah_putaran FROM permainan ORDER BY id DESC LIMIT ?',
  );
  const ambilKlasemen = db.prepare(
    'SELECT kursi, peringkat, nama, bot, skor, mentung, kepentung FROM klasemen WHERE permainan_id = ? ORDER BY peringkat, kursi',
  );
  const ambilPeringkat = db.prepare(`
    SELECT nama,
           COUNT(*) AS main,
           SUM(CASE WHEN peringkat = 1 THEN 1 ELSE 0 END) AS juara,
           SUM(skor) AS total_skor,
           MAX(skor) AS skor_terbaik,
           SUM(mentung) AS mentung,
           SUM(kepentung) AS kepentung
    FROM klasemen
    WHERE bot = 0
    GROUP BY nama
    ORDER BY juara DESC, total_skor DESC, nama
  `);

  return {
    simpan(r) {
      db.exec('BEGIN');
      try {
        const hasil = tambahPermainan.run(r.kode, new Date(r.selesaiPada).toISOString(), r.alasan, r.jumlahPutaran);
        const id = Number(hasil.lastInsertRowid);
        for (const p of r.pemain) {
          tambahBaris.run(id, p.kursi, p.peringkat, p.nama, p.bot ? 1 : 0, p.skor, p.mentung, p.kepentung);
        }
        db.exec('COMMIT');
        return id;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    daftar(batas) {
      const baris = ambilPermainan.all(Math.max(1, Math.min(100, Math.floor(batas)))) as {
        id: number;
        kode_meja: string;
        selesai_pada: string;
        alasan: string | null;
        jumlah_putaran: number;
      }[];
      return baris.map((b) => ({
        id: b.id,
        kodeMeja: b.kode_meja,
        selesaiPada: b.selesai_pada,
        alasan: b.alasan,
        jumlahPutaran: b.jumlah_putaran,
        klasemen: (ambilKlasemen.all(b.id) as Record<string, number | string>[]).map((k) => ({
          kursi: Number(k.kursi),
          peringkat: Number(k.peringkat),
          nama: String(k.nama),
          bot: Number(k.bot) === 1,
          skor: Number(k.skor),
          mentung: Number(k.mentung),
          kepentung: Number(k.kepentung),
        })),
      }));
    },
    peringkat() {
      return (ambilPeringkat.all() as Record<string, number | string>[]).map((b) => ({
        nama: String(b.nama),
        main: Number(b.main),
        juara: Number(b.juara),
        totalSkor: Number(b.total_skor),
        rataRata: Math.round(Number(b.total_skor) / Number(b.main)),
        skorTerbaik: Number(b.skor_terbaik),
        mentung: Number(b.mentung),
        kepentung: Number(b.kepentung),
      }));
    },
    tutup() {
      db.close();
    },
  };
}
