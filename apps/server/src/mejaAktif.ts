// Meja online yang masih ada, disimpan di database SQLite yang sama dengan riwayat (tabelnya dibuat
// migrasi v4 di riwayat.ts), supaya meja selamat dari restart atau deploy server (rencana koneksi
// langkah 9, keputusan pemilik 24 Okt 2026). Kapan disimpan, dihapus, dan dipulihkan diatur server.ts.
//
// Isinya `DataMeja` utuh, termasuk token pemain (`pemainId`) yang dipakai untuk sambung ulang. Token
// itu rahasia: database (dan cadangannya) hanya boleh di volume privat server, jangan dibagikan.

import type { DatabaseSync } from 'node:sqlite';
import type { DataMeja } from '@remi/meja';

/** Migrasi v4 (24 Okt 2026). Waktu disimpan ms epoch (INTEGER). */
export const SKEMA_MEJA_AKTIF = `
  CREATE TABLE IF NOT EXISTS meja_aktif (
    kode TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    pembuat_jaringan TEXT,
    diperbarui_pada INTEGER NOT NULL
  );
`;

export interface BarisMejaAktif {
  kode: string;
  /** DataMeja dalam JSON (belum diperiksa; bisa rusak). */
  data: string;
  /** Kunci jaringan pembuat meja (batas meja per IP); null = tidak tercatat. */
  pembuatJaringan: string | null;
  /** ms epoch */
  diperbaruiPada: number;
}

export interface PenyimpanMejaAktif {
  /** Tulis (atau timpa) simpanan satu meja. */
  simpan(kode: string, dataJson: string, pembuatJaringan: string | null, waktu: number): void;
  hapus(kode: string): void;
  /** Semua simpanan, yang paling lama diperbarui dulu. */
  semua(): BarisMejaAktif[];
}

const JENIS_KURSI = new Set(['manusia', 'bot', 'kosong']);
const objek = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Baca simpanan satu meja. Hasilnya DataMeja, atau alasan (teks untuk log) kalau JSON-nya rusak atau
 * bentuknya tidak masuk akal. Pemeriksaan ini sengaja ringan: datanya ditulis server sendiri, jadi yang
 * dijaga hanya simpanan yang terpotong/rusak dan versi data yang tidak dikenal. Sisanya dijaga
 * konstruktor Meja (dibungkus try/catch oleh pemanggil).
 */
export function bacaDataMeja(json: string, kode: string): DataMeja | string {
  let x: unknown;
  try {
    x = JSON.parse(json);
  } catch {
    return 'JSON rusak';
  }
  if (!objek(x)) return 'bukan objek';
  if (x.versi !== 1) return `versi data ${JSON.stringify(x.versi)} tidak dikenal`;
  if (x.kode !== kode) return 'kode di data tidak cocok';
  if (!objek(x.pengaturan)) return 'pengaturan rusak';
  const kursi = x.kursi;
  if (!Array.isArray(kursi) || kursi.length < 2 || kursi.length > 6) return 'daftar kursi rusak';
  for (const k of kursi) {
    if (!objek(k) || typeof k.jenis !== 'string' || !JENIS_KURSI.has(k.jenis) || typeof k.nama !== 'string') return 'kursi rusak';
    if (k.jenis === 'manusia' && (typeof k.pemainId !== 'string' || !k.pemainId)) return 'kursi manusia tanpa token';
  }
  if (!Number.isInteger(x.host) || (x.host as number) < 0 || (x.host as number) >= kursi.length) return 'host rusak';
  if (!Number.isFinite(x.rngBot) || !Number.isInteger(x.giliranKe) || !Array.isArray(x.setujuAkhiri)) return 'data meja rusak';
  if (x.game !== null) {
    const g = x.game;
    if (!objek(g) || typeof g.status !== 'string' || !Array.isArray(g.pemain) || g.pemain.length !== kursi.length || !Array.isArray(g.skor)) {
      return 'state permainan rusak';
    }
  }
  return x as unknown as DataMeja;
}

export function buatPenyimpanMejaAktif(db: DatabaseSync): PenyimpanMejaAktif {
  const tulis = db.prepare(
    `INSERT INTO meja_aktif (kode, data, pembuat_jaringan, diperbarui_pada) VALUES (?, ?, ?, ?)
     ON CONFLICT (kode) DO UPDATE SET data = excluded.data, pembuat_jaringan = excluded.pembuat_jaringan, diperbarui_pada = excluded.diperbarui_pada`,
  );
  const buang = db.prepare('DELETE FROM meja_aktif WHERE kode = ?');
  const ambilSemua = db.prepare('SELECT kode, data, pembuat_jaringan, diperbarui_pada FROM meja_aktif ORDER BY diperbarui_pada, kode');
  return {
    simpan(kode, dataJson, pembuatJaringan, waktu) {
      tulis.run(kode, dataJson, pembuatJaringan, Math.floor(waktu));
    },
    hapus(kode) {
      buang.run(kode);
    },
    semua() {
      return (ambilSemua.all() as Record<string, unknown>[]).map((b) => ({
        kode: String(b.kode),
        data: String(b.data),
        pembuatJaringan: typeof b.pembuat_jaringan === 'string' ? b.pembuat_jaringan : null,
        diperbaruiPada: Number(b.diperbarui_pada),
      }));
    },
  };
}
