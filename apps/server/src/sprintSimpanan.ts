// Sprint yang bisa dilanjut (keputusan pemilik 27 Nov 2026: "maunya sprint ini terus2an bisa dilanjut",
// "kalau minggu berganti ya reset"). Satu sprint = satu permainan yang berjalan sepanjang minggu WIB
// tempat ia dibuat; Keluar, menutup aplikasi, sinyal putus, atau server restart hanya menjedanya.
//
// Pemiliknya dikenali dari token rahasia yang dibuat server dan disimpan di HP (bukan dari nama), jadi
// orang lain yang memakai nama yang sama tidak bisa melanjutkannya. Di database hanya hash SHA-256 token.
// Kolom `data` memuat DataMeja utuh (termasuk token kursi pemain untuk sambung ulang): database hanya di
// volume privat server. Kapan ditulis, dimuat, dan dibuang diatur server.ts.

import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

/**
 * Migrasi v9 (27 Nov 2026). Waktu ms epoch (INTEGER). `token_hash` = SHA-256 hex token sprint; `minggu`
 * = awal minggu WIB sprint itu (awalMingguWib); `data` = DataMeja terakhir (JSON). Satu baris per sprint.
 */
export const SKEMA_SPRINT_SIMPANAN = `
  CREATE TABLE IF NOT EXISTS sprint_simpanan (
    token_hash TEXT PRIMARY KEY,
    kode TEXT NOT NULL,
    minggu INTEGER NOT NULL,
    data TEXT,
    pembuat_jaringan TEXT,
    dibuat_pada INTEGER NOT NULL,
    diperbarui_pada INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sprint_simpanan_kode ON sprint_simpanan (kode);
  CREATE INDEX IF NOT EXISTS sprint_simpanan_minggu ON sprint_simpanan (minggu);
`;

/** Hash token sprint (yang disimpan dan dicari di database). */
export const hashTokenSprint = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

export interface BarisSprintSimpanan {
  hash: string;
  kode: string;
  minggu: number;
  /** DataMeja dalam JSON (belum diperiksa); null = belum pernah ditulis. */
  data: string | null;
  pembuatJaringan: string | null;
  diperbaruiPada: number;
}

export interface PenyimpanSprintSimpanan {
  /** Sprint baru. */
  buat(b: Omit<BarisSprintSimpanan, 'diperbaruiPada'> & { waktu: number }): void;
  /** Tulis data terbaru sprint `hash` (tidak apa-apa kalau barisnya sudah tidak ada). */
  simpan(hash: string, dataJson: string, waktu: number): void;
  ambil(hash: string): BarisSprintSimpanan | null;
  /** Sprint dengan kode meja `kode` (yang paling baru diperbarui), atau null. */
  dariKode(kode: string): BarisSprintSimpanan | null;
  hapus(hash: string): void;
  /** Sprint dari minggu sebelum `minggu` (sudah tidak bisa dilanjut), paling lama dulu, paling banyak `batas`. */
  lama(minggu: number, batas: number): BarisSprintSimpanan[];
  jumlah(): number;
}

export function buatPenyimpanSprintSimpanan(db: DatabaseSync): PenyimpanSprintSimpanan {
  const tambah = db.prepare(
    `INSERT INTO sprint_simpanan (token_hash, kode, minggu, data, pembuat_jaringan, dibuat_pada, diperbarui_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tulis = db.prepare('UPDATE sprint_simpanan SET data = ?, diperbarui_pada = ? WHERE token_hash = ?');
  const kolom = 'token_hash, kode, minggu, data, pembuat_jaringan, diperbarui_pada';
  const satu = db.prepare(`SELECT ${kolom} FROM sprint_simpanan WHERE token_hash = ?`);
  const perKode = db.prepare(`SELECT ${kolom} FROM sprint_simpanan WHERE kode = ? ORDER BY diperbarui_pada DESC LIMIT 1`);
  const buang = db.prepare('DELETE FROM sprint_simpanan WHERE token_hash = ?');
  const ambilLama = db.prepare(`SELECT ${kolom} FROM sprint_simpanan WHERE minggu < ? ORDER BY diperbarui_pada LIMIT ?`);
  const hitung = db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan');
  const baris = (b: Record<string, unknown> | undefined): BarisSprintSimpanan | null =>
    b
      ? {
          hash: String(b.token_hash),
          kode: String(b.kode),
          minggu: Number(b.minggu),
          data: typeof b.data === 'string' ? b.data : null,
          pembuatJaringan: typeof b.pembuat_jaringan === 'string' ? b.pembuat_jaringan : null,
          diperbaruiPada: Number(b.diperbarui_pada),
        }
      : null;
  return {
    buat(b) {
      tambah.run(b.hash, b.kode, Math.floor(b.minggu), b.data, b.pembuatJaringan, Math.floor(b.waktu), Math.floor(b.waktu));
    },
    simpan(hash, dataJson, waktu) {
      tulis.run(dataJson, Math.floor(waktu), hash);
    },
    ambil(hash) {
      return baris(satu.get(hash) as Record<string, unknown> | undefined);
    },
    dariKode(kode) {
      return baris(perKode.get(kode) as Record<string, unknown> | undefined);
    },
    hapus(hash) {
      buang.run(hash);
    },
    lama(minggu, batas) {
      return (ambilLama.all(Math.floor(minggu), batas) as Record<string, unknown>[]).map((b) => baris(b)!);
    },
    jumlah() {
      return Number((hitung.get() as { n: number }).n);
    },
  };
}
