// Kompetisi (keputusan pemilik #51): pengajuan, peserta, hasil per permainan, dan klasemen, di
// database SQLite yang sama dengan riwayat (tabelnya dibuat migrasi v2 di riwayat.ts). Aturan
// hitungnya (status, masa berlaku, poin, klasemen) hanya di @remi/meja (kompetisi.ts).
//
// Belum ada akun: peserta dikenali dari token acak yang disimpan di HP-nya saat ikut serta. Database
// hanya menyimpan hash token, jadi isi database tidak bisa dipakai untuk menyamar.

import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DAFTAR_MASA,
  MAKS_PESERTA,
  MIN_MAIN_KOMPETISI,
  MIN_PESERTA,
  akhirKompetisi,
  hitungKlasemenKompetisi,
  isMasa,
  kunciNama,
  nilaiEfektif,
  poinKompetisi,
  rapikanNama,
  rapikanNamaKompetisi,
  rapikanPengaturanKompetisi,
  selesaiPada,
  statusKompetisi,
  tutupDisetujui,
  type BarisKompetisi,
  type MasaKompetisi,
  type PengaturanKompetisi,
  type RingkasanAkhir,
  type StatusKompetisi,
  type WaktuKompetisi,
} from '@remi/meja';

/** Penolakan yang pesannya boleh ditampilkan ke pemain apa adanya. */
export class GalatKompetisi extends Error {
  constructor(
    pesan: string,
    readonly kodeHttp = 400,
  ) {
    super(pesan);
  }
}

export interface RingkasanKompetisi {
  kode: string;
  nama: string;
  masa: MasaKompetisi;
  status: StatusKompetisi;
  jumlahPeserta: number;
  /** ms epoch. */
  diajukanPada: number;
  mulaiPada: number | null;
  /** Rencana berakhir (masa berlaku), atau saat ditutup lebih awal. */
  berakhirPada: number | null;
  /** Hanya untuk yang sudah selesai: peringkat 1 klasemen (bisa lebih dari satu kalau seri persis). */
  juara?: string[];
}

export interface DetailKompetisi extends RingkasanKompetisi {
  v: 1;
  pengaturan: PengaturanKompetisi;
  minPeserta: number;
  minMain: number;
  /** Nama peserta, urut ikut serta (pertama = pengaju). */
  peserta: string[];
  jumlahPermainan: number;
  setujuTutup: number;
  peringkat: BarisKompetisi[];
  belumCukup: BarisKompetisi[];
  /** Ada kalau tiket yang dikirim cocok. */
  saya?: { id: number; nama: string; setujuTutup: boolean };
}

export interface DataAjukan {
  nama: unknown;
  masa: unknown;
  pengaturan: unknown;
  namaPengaju: unknown;
}

export interface PenyimpanKompetisi {
  ajukan(data: DataAjukan, sekarang: number): { kode: string; token: string };
  ikut(kode: string, nama: unknown, sekarang: number): { token: string };
  setujuTutup(kode: string, token: string, setuju: boolean, sekarang: number): void;
  /** Peserta pemilik tiket, atau null kalau kompetisi/tiketnya tidak cocok. */
  cekTiket(kode: string, token: string): { id: number; nama: string } | null;
  status(kode: string, sekarang: number): StatusKompetisi | null;
  /** Nama, pengaturan yang dikunci, dan status untuk membuat meja kompetisi. */
  untukMeja(kode: string, sekarang: number): { nama: string; pengaturan: PengaturanKompetisi; status: StatusKompetisi } | null;
  detail(kode: string, sekarang: number, token?: string | null): DetailKompetisi | null;
  daftar(sekarang: number): RingkasanKompetisi[];
  /** Jumlah pengajuan yang masih menunggu peserta. */
  jumlahPengajuan(sekarang: number): number;
  /**
   * Catat hasil satu permainan meja kompetisi (dipanggil riwayat.simpan di dalam transaksinya).
   * Hanya kalau kompetisinya berjalan saat permainan selesai. Mengembalikan banyaknya baris hasil.
   */
  catatHasil(permainanId: number, r: RingkasanAkhir): number;
}

/** Migrasi v2 (23 Okt 2026, keputusan #51). Waktu disimpan ms epoch (INTEGER). */
export const SKEMA_KOMPETISI = `
  CREATE TABLE IF NOT EXISTS kompetisi (
    kode TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    masa TEXT NOT NULL,
    pengaturan TEXT NOT NULL,
    diajukan_pada INTEGER NOT NULL,
    mulai_pada INTEGER,
    berakhir_pada INTEGER,
    ditutup_pada INTEGER
  );
  CREATE TABLE IF NOT EXISTS peserta_kompetisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kompetisi TEXT NOT NULL REFERENCES kompetisi(kode) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    kunci_nama TEXT NOT NULL,
    hash_token TEXT NOT NULL,
    ikut_pada INTEGER NOT NULL,
    setuju_tutup INTEGER NOT NULL DEFAULT 0,
    UNIQUE (kompetisi, kunci_nama)
  );
  CREATE INDEX IF NOT EXISTS peserta_kompetisi_token ON peserta_kompetisi (kompetisi, hash_token);
  CREATE TABLE IF NOT EXISTS hasil_kompetisi (
    permainan_id INTEGER NOT NULL REFERENCES permainan(id) ON DELETE CASCADE,
    peserta_id INTEGER NOT NULL REFERENCES peserta_kompetisi(id) ON DELETE CASCADE,
    poin INTEGER NOT NULL,
    skor INTEGER NOT NULL,
    juara INTEGER NOT NULL,
    keluar INTEGER NOT NULL,
    PRIMARY KEY (permainan_id, peserta_id)
  );
  CREATE INDEX IF NOT EXISTS hasil_kompetisi_peserta ON hasil_kompetisi (peserta_id);
`;

// Sama dengan kode meja: tanpa huruf/angka yang mirip (0/O, 1/I/L).
const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Kompetisi yang sudah selesai yang tampil di daftar. */
const BATAS_ARSIP = 20;
/** Pengajuan batal dihapus sesudah sekian ms (tidak pernah ada hasilnya). */
const SIMPAN_BATAL_MS = 7 * 24 * 60 * 60 * 1000;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

interface BarisKompetisiDb {
  kode: string;
  nama: string;
  masa: string;
  pengaturan: string;
  diajukan_pada: number;
  mulai_pada: number | null;
  berakhir_pada: number | null;
  ditutup_pada: number | null;
}

const waktu = (b: BarisKompetisiDb): WaktuKompetisi => ({
  diajukanPada: Number(b.diajukan_pada),
  mulaiPada: b.mulai_pada === null ? null : Number(b.mulai_pada),
  berakhirPada: b.berakhir_pada === null ? null : Number(b.berakhir_pada),
  ditutupPada: b.ditutup_pada === null ? null : Number(b.ditutup_pada),
});

const masaDari = (x: string): MasaKompetisi => (isMasa(x) ? x : DAFTAR_MASA[0]);

export function buatPenyimpanKompetisi(db: DatabaseSync): PenyimpanKompetisi {
  const ambil = db.prepare('SELECT * FROM kompetisi WHERE kode = ?');
  const tambah = db.prepare(
    'INSERT INTO kompetisi (kode, nama, masa, pengaturan, diajukan_pada) VALUES (?, ?, ?, ?, ?)',
  );
  const tambahPeserta = db.prepare(
    'INSERT INTO peserta_kompetisi (kompetisi, nama, kunci_nama, hash_token, ikut_pada) VALUES (?, ?, ?, ?, ?)',
  );
  const pesertaNama = db.prepare('SELECT id FROM peserta_kompetisi WHERE kompetisi = ? AND kunci_nama = ?');
  const pesertaToken = db.prepare('SELECT id, nama, setuju_tutup FROM peserta_kompetisi WHERE kompetisi = ? AND hash_token = ?');
  const semuaPeserta = db.prepare('SELECT id, nama, setuju_tutup FROM peserta_kompetisi WHERE kompetisi = ? ORDER BY id');
  const hitungPeserta = db.prepare('SELECT COUNT(*) AS n FROM peserta_kompetisi WHERE kompetisi = ?');
  const mulaikan = db.prepare('UPDATE kompetisi SET mulai_pada = ?, berakhir_pada = ? WHERE kode = ? AND mulai_pada IS NULL');
  const aturSetuju = db.prepare('UPDATE peserta_kompetisi SET setuju_tutup = ? WHERE id = ?');
  const tutup = db.prepare('UPDATE kompetisi SET ditutup_pada = ? WHERE kode = ? AND ditutup_pada IS NULL');
  const tambahHasil = db.prepare(
    'INSERT OR IGNORE INTO hasil_kompetisi (permainan_id, peserta_id, poin, skor, juara, keluar) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const hasilKompetisi = db.prepare(`
    SELECT h.permainan_id, h.peserta_id, h.poin, h.skor, h.juara, h.keluar
    FROM hasil_kompetisi h JOIN peserta_kompetisi p ON p.id = h.peserta_id
    WHERE p.kompetisi = ?
  `);
  const pengajuanDanBerjalan = db.prepare(`
    SELECT k.*, (SELECT COUNT(*) FROM peserta_kompetisi p WHERE p.kompetisi = k.kode) AS jumlah
    FROM kompetisi k
    WHERE (k.mulai_pada IS NULL AND k.diajukan_pada > :batasAju)
       OR (k.mulai_pada IS NOT NULL AND k.ditutup_pada IS NULL AND k.berakhir_pada > :sekarang)
    ORDER BY k.diajukan_pada DESC
  `);
  const arsip = db.prepare(`
    SELECT k.*, (SELECT COUNT(*) FROM peserta_kompetisi p WHERE p.kompetisi = k.kode) AS jumlah
    FROM kompetisi k
    WHERE k.mulai_pada IS NOT NULL AND (k.ditutup_pada IS NOT NULL OR k.berakhir_pada <= :sekarang)
    ORDER BY COALESCE(k.ditutup_pada, k.berakhir_pada) DESC
    LIMIT ${BATAS_ARSIP}
  `);
  const hapusBatal = db.prepare('DELETE FROM kompetisi WHERE mulai_pada IS NULL AND diajukan_pada <= ?');
  const hitungPengajuan = db.prepare('SELECT COUNT(*) AS n FROM kompetisi WHERE mulai_pada IS NULL AND diajukan_pada > ?');

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

  const baca = (kode: string) => ambil.get(kode.trim().toUpperCase()) as BarisKompetisiDb | undefined;
  const batasAju = (sekarang: number) => sekarang - 24 * 60 * 60 * 1000;

  const buatKode = () => {
    for (;;) {
      const kode = [...randomBytes(5)].map((x) => HURUF_KODE[x % HURUF_KODE.length]).join('');
      if (!ambil.get(kode)) return kode;
    }
  };
  const buatToken = () => randomBytes(24).toString('base64url');

  const klasemen = (kode: string) => {
    const peserta = (semuaPeserta.all(kode) as { id: number; nama: string; setuju_tutup: number }[]).map((p) => ({
      id: Number(p.id),
      nama: String(p.nama),
      setuju: Number(p.setuju_tutup) === 1,
    }));
    const hasil = (hasilKompetisi.all(kode) as Record<string, number>[]).map((h) => ({
      permainan: Number(h.permainan_id),
      peserta: Number(h.peserta_id),
      poin: Number(h.poin),
      skor: Number(h.skor),
      juara: Number(h.juara) === 1,
      keluar: Number(h.keluar) === 1,
    }));
    return { peserta, hasil, ...hitungKlasemenKompetisi(peserta, hasil), jumlahPermainan: new Set(hasil.map((h) => h.permainan)).size };
  };

  /** Juara kompetisi yang sudah selesai: semua yang menyamai peringkat 1 persis (poin, rata poin, rata skor). */
  const juaraDari = (peringkat: BarisKompetisi[]): string[] => {
    const [a] = peringkat;
    if (!a) return [];
    return peringkat.filter((b) => b.poin === a.poin && b.rataPoin === a.rataPoin && b.rataSkor === a.rataSkor).map((b) => b.nama);
  };

  const ringkas = (b: BarisKompetisiDb, jumlah: number, sekarang: number): RingkasanKompetisi => {
    const w = waktu(b);
    const status = statusKompetisi(w, sekarang);
    return {
      kode: b.kode,
      nama: b.nama,
      masa: masaDari(b.masa),
      status,
      jumlahPeserta: jumlah,
      diajukanPada: w.diajukanPada,
      mulaiPada: w.mulaiPada,
      berakhirPada: status === 'selesai' ? selesaiPada(w) : w.berakhirPada,
      ...(status === 'selesai' ? { juara: juaraDari(klasemen(b.kode).peringkat) } : {}),
    };
  };

  /** Nama peserta dari isian: dirapikan, dan tidak boleh kembar di kompetisi itu. */
  const namaPeserta = (kode: string, nama: unknown): string => {
    if (typeof nama !== 'string' || !nama.trim() || nama.length > 100) throw new GalatKompetisi('Isi namamu dulu, Bos.');
    const rapi = rapikanNama(nama);
    if (pesertaNama.get(kode, kunciNama(rapi))) {
      throw new GalatKompetisi(`Nama ${rapi} sudah ikut kompetisi ini. Kalau itu kamu, buka dari HP yang dipakai waktu ikut serta.`, 409);
    }
    return rapi;
  };

  return {
    ajukan(data, sekarang) {
      const nama = rapikanNamaKompetisi(data.nama);
      if (!nama) throw new GalatKompetisi('Kasih nama kompetisinya dulu, Bos.');
      if (!isMasa(data.masa)) throw new GalatKompetisi('Pilih lama kompetisinya dulu.');
      const pengaturan = rapikanPengaturanKompetisi(data.pengaturan);
      return transaksi(() => {
        hapusBatal.run(sekarang - 24 * 60 * 60 * 1000 - SIMPAN_BATAL_MS);
        const kode = buatKode();
        tambah.run(kode, nama, data.masa as string, JSON.stringify(pengaturan), sekarang);
        const pengaju = namaPeserta(kode, data.namaPengaju);
        const token = buatToken();
        tambahPeserta.run(kode, pengaju, kunciNama(pengaju), hash(token), sekarang);
        return { kode, token };
      });
    },

    ikut(kodeMentah, nama, sekarang) {
      const b = baca(kodeMentah);
      if (!b) throw new GalatKompetisi('Kompetisinya nggak ketemu.', 404);
      const status = statusKompetisi(waktu(b), sekarang);
      if (status === 'batal') throw new GalatKompetisi('Pengajuan ini sudah lewat 24 jam dan batal.', 409);
      if (status === 'selesai') throw new GalatKompetisi('Kompetisinya sudah selesai.', 409);
      return transaksi(() => {
        const jumlah = Number((hitungPeserta.get(b.kode) as { n: number }).n);
        if (jumlah >= MAKS_PESERTA) throw new GalatKompetisi('Pesertanya sudah penuh.', 409);
        const rapi = namaPeserta(b.kode, nama);
        const token = buatToken();
        tambahPeserta.run(b.kode, rapi, kunciNama(rapi), hash(token), sekarang);
        // Peserta ke-MIN_PESERTA: kompetisi jalan sekarang, masa berlakunya dihitung dari sini.
        if (status === 'pengajuan' && jumlah + 1 >= MIN_PESERTA) {
          mulaikan.run(sekarang, akhirKompetisi(masaDari(b.masa), sekarang), b.kode);
        }
        return { token };
      });
    },

    setujuTutup(kodeMentah, token, setuju, sekarang) {
      const b = baca(kodeMentah);
      if (!b) throw new GalatKompetisi('Kompetisinya nggak ketemu.', 404);
      const p = pesertaToken.get(b.kode, hash(token)) as { id: number } | undefined;
      if (!p) throw new GalatKompetisi('Kamu belum ikut kompetisi ini.', 403);
      if (statusKompetisi(waktu(b), sekarang) !== 'berjalan') throw new GalatKompetisi('Cuma kompetisi yang sedang jalan yang bisa disudahi.', 409);
      transaksi(() => {
        aturSetuju.run(setuju ? 1 : 0, p.id);
        const semua = semuaPeserta.all(b.kode) as { setuju_tutup: number }[];
        if (tutupDisetujui(semua.filter((x) => Number(x.setuju_tutup) === 1).length, semua.length)) tutup.run(sekarang, b.kode);
      });
    },

    cekTiket(kodeMentah, token) {
      const b = baca(kodeMentah);
      if (!b || !token) return null;
      const p = pesertaToken.get(b.kode, hash(token)) as { id: number; nama: string } | undefined;
      return p ? { id: Number(p.id), nama: String(p.nama) } : null;
    },

    status(kode, sekarang) {
      const b = baca(kode);
      return b ? statusKompetisi(waktu(b), sekarang) : null;
    },

    untukMeja(kode, sekarang) {
      const b = baca(kode);
      if (!b) return null;
      let mentah: unknown = null;
      try {
        mentah = JSON.parse(b.pengaturan);
      } catch {
        // Rusak: jatuh ke bawaan.
      }
      return { nama: b.nama, pengaturan: rapikanPengaturanKompetisi(mentah), status: statusKompetisi(waktu(b), sekarang) };
    },

    detail(kodeMentah, sekarang, token) {
      const b = baca(kodeMentah);
      if (!b) return null;
      const k = klasemen(b.kode);
      const r = ringkas(b, k.peserta.length, sekarang);
      const saya = token ? (pesertaToken.get(b.kode, hash(token)) as { id: number; nama: string; setuju_tutup: number } | undefined) : undefined;
      let mentah: unknown = null;
      try {
        mentah = JSON.parse(b.pengaturan);
      } catch {
        // Rusak: jatuh ke bawaan.
      }
      return {
        v: 1,
        ...r,
        pengaturan: rapikanPengaturanKompetisi(mentah),
        minPeserta: MIN_PESERTA,
        minMain: MIN_MAIN_KOMPETISI,
        peserta: k.peserta.map((p) => p.nama),
        jumlahPermainan: k.jumlahPermainan,
        setujuTutup: k.peserta.filter((p) => p.setuju).length,
        peringkat: k.peringkat,
        belumCukup: k.belumCukup,
        ...(saya ? { saya: { id: Number(saya.id), nama: String(saya.nama), setujuTutup: Number(saya.setuju_tutup) === 1 } } : {}),
      };
    },

    daftar(sekarang) {
      const baris = [
        ...(pengajuanDanBerjalan.all({ batasAju: batasAju(sekarang), sekarang }) as unknown as (BarisKompetisiDb & { jumlah: number })[]),
        ...(arsip.all({ sekarang }) as unknown as (BarisKompetisiDb & { jumlah: number })[]),
      ];
      return baris.map((b) => ringkas(b, Number(b.jumlah), sekarang));
    },

    jumlahPengajuan(sekarang) {
      return Number((hitungPengajuan.get(batasAju(sekarang)) as { n: number }).n);
    },

    catatHasil(permainanId, r) {
      if (!r.kompetisi) return 0;
      const b = baca(r.kompetisi);
      // Selesai sesudah kompetisinya berakhir (atau belum jalan): tidak dihitung.
      if (!b || statusKompetisi(waktu(b), r.selesaiPada) !== 'berjalan') return 0;
      // Juara dan skor efektif sama dengan leaderboard (#45): yang keluar juru kunci.
      const poin = poinKompetisi(r.pemain);
      const nilai = nilaiEfektif(r.pemain);
      // Satu permainan dicatat utuh atau tidak sama sekali (savepoint di dalam transaksi riwayat).
      db.exec('SAVEPOINT hasil_kompetisi');
      try {
        let n = 0;
        r.pemain.forEach((p, i) => {
          if (p.peserta === undefined) return;
          tambahHasil.run(permainanId, p.peserta, poin[i], nilai[i].skor, nilai[i].juara ? 1 : 0, p.keluar ? 1 : 0);
          n++;
        });
        db.exec('RELEASE hasil_kompetisi');
        return n;
      } catch (e) {
        db.exec('ROLLBACK TO hasil_kompetisi');
        db.exec('RELEASE hasil_kompetisi');
        throw e;
      }
    },
  };
}
