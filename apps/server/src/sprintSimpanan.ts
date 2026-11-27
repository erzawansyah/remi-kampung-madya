// Sprint yang bisa dilanjut (keputusan pemilik 27 Nov 2026: "maunya sprint ini terus2an bisa dilanjut",
// "kalau minggu berganti ya reset"). Satu sprint = satu permainan yang berjalan sepanjang minggu WIB
// tempat ia dibuat; Keluar, menutup aplikasi, sinyal putus, atau server restart hanya menjedanya.
//
// Pemiliknya dikenali dari token rahasia yang dibuat server dan disimpan di HP (bukan dari nama), jadi
// orang lain yang memakai nama yang sama tidak bisa melanjutkannya. Database tidak memuat satu pun kunci
// yang bisa dipakai untuk masuk: token sprint hanya sebagai hash SHA-256 (`token_hash`), dan token kursi
// pemain (pemainId, dipakai untuk sambung ulang) juga hanya sebagai hash (`kursi_hash`), sedangkan di
// `data` kursinya diisi penanda (sandikanDataSprint). Saat sprint dimuat lagi server memasang token kursi
// yang dibawa pemainnya (sambung ulang) atau token kursi baru ("Lanjut sprint").
// Kapan ditulis, dimuat, dan dibuang diatur server.ts.

import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { jumlahPutaranSelesai } from '@remi/engine';
import type { DataMeja } from '@remi/meja';

/**
 * Migrasi v9 (27 Nov 2026). Waktu ms epoch (INTEGER). `token_hash` = SHA-256 hex token sprint; `minggu`
 * = awal minggu WIB sprint itu (awalMingguWib); `data` = DataMeja terakhir (JSON, token kursi pemain diganti
 * penanda); `kursi_hash` = SHA-256 hex token kursi pemain; `putaran` = banyaknya putaran yang sudah selesai
 * (untuk membuang sprint yang tidak pernah dimainkan lebih dulu). Satu baris per sprint.
 */
export const SKEMA_SPRINT_SIMPANAN = `
  CREATE TABLE IF NOT EXISTS sprint_simpanan (
    token_hash TEXT PRIMARY KEY,
    kode TEXT NOT NULL,
    minggu INTEGER NOT NULL,
    data TEXT,
    kursi_hash TEXT,
    putaran INTEGER NOT NULL DEFAULT 0,
    pembuat_jaringan TEXT,
    dibuat_pada INTEGER NOT NULL,
    diperbarui_pada INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sprint_simpanan_kode ON sprint_simpanan (kode);
  CREATE INDEX IF NOT EXISTS sprint_simpanan_minggu ON sprint_simpanan (minggu);
  CREATE INDEX IF NOT EXISTS sprint_simpanan_jaringan ON sprint_simpanan (pembuat_jaringan, minggu);
`;

const sha256 = (x: string): string => createHash('sha256').update(x, 'utf8').digest('hex');

/** Hash token sprint (yang disimpan dan dicari di database). */
export const hashTokenSprint = sha256;
/** Hash token kursi pemain sprint (pemainId). */
export const hashTokenKursi = sha256;

/** Awalan penanda token kursi di `data` (bukan token yang sah: token kursi selalu UUID). */
const PENANDA_KURSI = 'disimpan:';

/**
 * DataMeja sprint untuk ditulis ke database: token kursi pemain diganti penanda, hash-nya dikembalikan
 * terpisah (kolom `kursi_hash`). `data` tidak diubah.
 */
export function sandikanDataSprint(data: DataMeja): { json: string; kursiHash: string | null; putaran: number } {
  const s = data.sprint;
  const k = s ? data.kursi[s.kursi] : undefined;
  const putaran = data.game ? jumlahPutaranSelesai(data.game) : 0;
  if (!s || !k || k.jenis !== 'manusia' || !k.pemainId) return { json: JSON.stringify(data), kursiHash: null, putaran };
  const kursiHash = hashTokenKursi(k.pemainId);
  const kursi = data.kursi.map((x, i) => (i === s.kursi ? { ...x, pemainId: PENANDA_KURSI + kursiHash.slice(0, 16) } : x));
  return { json: JSON.stringify({ ...data, kursi }), kursiHash, putaran };
}

/** Pasang token kursi `pemainId` ke kursi pemain sprint di data yang dibaca dari database (diubah langsung). */
export function pasangTokenKursi(data: DataMeja, pemainId: string): void {
  const s = data.sprint;
  const k = s ? data.kursi[s.kursi] : undefined;
  if (k?.jenis === 'manusia') k.pemainId = pemainId;
}

export interface BarisSprintSimpanan {
  hash: string;
  kode: string;
  minggu: number;
  /** DataMeja dalam JSON (belum diperiksa); null = belum pernah ditulis. */
  data: string | null;
  /** Hash token kursi pemain; null = belum pernah ditulis. */
  kursiHash: string | null;
  /** Putaran yang sudah selesai saat terakhir ditulis. */
  putaran: number;
  pembuatJaringan: string | null;
  diperbaruiPada: number;
}

export interface PenyimpanSprintSimpanan {
  /** Sprint baru. */
  buat(b: Omit<BarisSprintSimpanan, 'diperbaruiPada'> & { waktu: number }): void;
  /** Tulis data terbaru sprint `hash` (tidak apa-apa kalau barisnya sudah tidak ada). */
  simpan(hash: string, d: { json: string; kursiHash: string | null; putaran: number }, waktu: number): void;
  ambil(hash: string): BarisSprintSimpanan | null;
  /** Sprint dengan kode meja `kode` (yang paling baru diperbarui), tanpa `data` (belum perlu dibaca), atau null. */
  dariKode(kode: string): BarisSprintSimpanan | null;
  hapus(hash: string): void;
  /** Sprint dari minggu sebelum `minggu` (sudah tidak bisa dilanjut), paling lama dulu, paling banyak `batas`. */
  lama(minggu: number, batas: number): BarisSprintSimpanan[];
  jumlah(): number;
  /** Banyaknya sprint minggu `minggu` yang dibuat dari jaringan `jaringan`. */
  jumlahDariJaringan(jaringan: string, minggu: number): number;
  /** Sprint minggu `minggu` dari jaringan `jaringan` yang belum pernah menyelesaikan satu putaran pun, paling lama dulu. */
  belumDimainkan(jaringan: string, minggu: number, batas: number): BarisSprintSimpanan[];
}

export function buatPenyimpanSprintSimpanan(db: DatabaseSync): PenyimpanSprintSimpanan {
  const tambah = db.prepare(
    `INSERT INTO sprint_simpanan (token_hash, kode, minggu, data, kursi_hash, putaran, pembuat_jaringan, dibuat_pada, diperbarui_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tulis = db.prepare('UPDATE sprint_simpanan SET data = ?, kursi_hash = ?, putaran = ?, diperbarui_pada = ? WHERE token_hash = ?');
  const tanpaData = 'token_hash, kode, minggu, kursi_hash, putaran, pembuat_jaringan, diperbarui_pada';
  const kolom = `${tanpaData}, data`;
  const satu = db.prepare(`SELECT ${kolom} FROM sprint_simpanan WHERE token_hash = ?`);
  const perKode = db.prepare(`SELECT ${tanpaData} FROM sprint_simpanan WHERE kode = ? ORDER BY diperbarui_pada DESC LIMIT 1`);
  const buang = db.prepare('DELETE FROM sprint_simpanan WHERE token_hash = ?');
  const ambilLama = db.prepare(`SELECT ${kolom} FROM sprint_simpanan WHERE minggu < ? ORDER BY diperbarui_pada LIMIT ?`);
  const hitung = db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan');
  const hitungJaringan = db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan WHERE pembuat_jaringan = ? AND minggu = ?');
  const kosong = db.prepare(
    `SELECT ${kolom} FROM sprint_simpanan WHERE pembuat_jaringan = ? AND minggu = ? AND putaran = 0 ORDER BY diperbarui_pada LIMIT ?`,
  );
  const baris = (b: Record<string, unknown> | undefined): BarisSprintSimpanan | null =>
    b
      ? {
          hash: String(b.token_hash),
          kode: String(b.kode),
          minggu: Number(b.minggu),
          data: typeof b.data === 'string' ? b.data : null,
          kursiHash: typeof b.kursi_hash === 'string' ? b.kursi_hash : null,
          putaran: Number(b.putaran) || 0,
          pembuatJaringan: typeof b.pembuat_jaringan === 'string' ? b.pembuat_jaringan : null,
          diperbaruiPada: Number(b.diperbarui_pada),
        }
      : null;
  return {
    buat(b) {
      tambah.run(b.hash, b.kode, Math.floor(b.minggu), b.data, b.kursiHash, Math.floor(b.putaran), b.pembuatJaringan, Math.floor(b.waktu), Math.floor(b.waktu));
    },
    simpan(hash, d, waktu) {
      tulis.run(d.json, d.kursiHash, Math.floor(d.putaran), Math.floor(waktu), hash);
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
    jumlahDariJaringan(jaringan, minggu) {
      return Number((hitungJaringan.get(jaringan, Math.floor(minggu)) as { n: number }).n);
    },
    belumDimainkan(jaringan, minggu, batas) {
      return (kosong.all(jaringan, Math.floor(minggu), batas) as Record<string, unknown>[]).map((b) => baris(b)!);
    },
  };
}
