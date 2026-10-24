// Kompetisi (keputusan pemilik #51; versi 2 24 Okt 2026): pengajuan, peserta, hasil per permainan,
// klasemen, juara, dan piala, di database SQLite yang sama dengan riwayat (tabelnya dibuat migrasi v2
// di riwayat.ts). Aturan hitungnya (status, masa berlaku, nilai, klasemen, juara) hanya di @remi/meja
// (kompetisi.ts).
//
// Belum ada akun: peserta dikenali dari token acak yang disimpan di HP-nya saat ikut serta. Database
// hanya menyimpan hash token, jadi isi database tidak bisa dipakai untuk menyamar.
//
// Penyimpan ini tidak tahu meja mana yang sedang jalan (itu di memori server). Server memberikannya
// lewat `KeadaanMejaKompetisi` saat membaca detail/daftar dan saat menetapkan juara: juara (dan
// piala) baru ditetapkan sesudah kompetisi berakhir DAN tidak ada lagi meja kompetisinya yang sedang
// main, karena permainan yang dimulai sebelum kompetisi berakhir tetap dihitung.

import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  DAFTAR_MASA,
  MAKS_PESERTA,
  MIN_MAIN_KOMPETISI,
  MIN_PESERTA,
  akhirKompetisi,
  berjalanPada,
  hitungKlasemenKompetisi,
  isMasa,
  juaraKompetisi,
  kunciNama,
  nilaiEfektif,
  nilaiKompetisi,
  permainanKompetisiDihitung,
  rapikanNama,
  rapikanNamaKompetisi,
  rapikanPengaturanKompetisi,
  selesaiPada,
  statusKompetisi,
  tutupDisetujui,
  type BarisKompetisi,
  type KlasemenKompetisi,
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

/** Meja kompetisi yang masih di lobi menunggu peserta (dari memori server). */
export interface MejaMenunggu {
  /** Kode meja: dipakai aplikasi untuk `gabung` (dengan tiket), tidak ditampilkan ke pemain. */
  kode: string;
  /** Nama host meja itu. */
  nama: string;
  /** Kursi yang sudah terisi. */
  terisi: number;
  jumlahPemain: number;
  /** Nama yang sudah duduk, urut kursi. */
  pemain: string[];
}

/** Keadaan meja kompetisi di memori server, untuk detail/daftar dan penetapan juara. */
export interface KeadaanMejaKompetisi {
  /** Banyaknya meja kompetisi ini yang permainannya sedang berjalan (termasuk yang dipulihkan). */
  mejaMain(kode: string): number;
  /** Meja kompetisi ini yang masih di lobi. */
  mejaMenunggu(kode: string): MejaMenunggu[];
  /**
   * True = juara jangan ditetapkan sekarang, walau `mejaMain` 0: misalnya server sedang dimatikan
   * (meja sudah dihentikan dari memori tapi simpanannya akan dipulihkan dan selesai sesudah restart).
   */
  tahanJuara?(): boolean;
}

const TANPA_MEJA: KeadaanMejaKompetisi = { mejaMain: () => 0, mejaMenunggu: () => [] };

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
  /** Ditutup lebih awal lewat voting peserta (berakhirPada = saat disudahi). */
  disudahi: boolean;
  /**
   * Meja kompetisi ini yang permainannya sedang berjalan. Status 'selesai' dengan mejaMain > 0 =
   * waktunya sudah habis (atau disudahi), menunggu meja terakhir selesai; juara belum diumumkan.
   */
  mejaMain: number;
  /**
   * Hanya sesudah juara ditetapkan (status 'selesai' dan tidak ada meja yang masih main): peringkat 1
   * klasemen, bisa lebih dari satu kalau seri persis, kosong kalau belum ada yang cukup main.
   */
  juara?: string[];
  /** Sejajar dengan `juara`: banyaknya piala tiap juara (semua kompetisi, termasuk yang ini). */
  pialaJuara?: number[];
}

/** Baris klasemen di detail: baris aturan + banyaknya piala orang itu (semua kompetisi). */
export interface BarisKlasemenKompetisi extends BarisKompetisi {
  piala: number;
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
  peringkat: BarisKlasemenKompetisi[];
  belumCukup: BarisKlasemenKompetisi[];
  /** Meja kompetisi ini yang masih menunggu peserta (hanya selama kompetisi berjalan), paling penuh dulu. */
  meja: MejaMenunggu[];
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
  detail(kode: string, sekarang: number, token?: string | null, meja?: KeadaanMejaKompetisi): DetailKompetisi | null;
  daftar(sekarang: number, meja?: KeadaanMejaKompetisi): RingkasanKompetisi[];
  /** Jumlah pengajuan yang masih menunggu peserta. */
  jumlahPengajuan(sekarang: number): number;
  /** Klasemen kompetisi sekarang (untuk pesan kompetisiHasil); null = kompetisinya tidak ada. */
  klasemen(kode: string): KlasemenKompetisi | null;
  /**
   * Catat hasil satu permainan meja kompetisi (dipanggil riwayat.simpan di dalam transaksinya).
   * Hanya kalau permainannya DIMULAI selagi kompetisinya berjalan (`RingkasanAkhir.mulaiPada`),
   * juaranya belum ditetapkan, dan paling sedikit dua kursi bertahan sampai akhir
   * (`permainanKompetisiDihitung`). Mengembalikan banyaknya baris hasil.
   */
  catatHasil(permainanId: number, r: RingkasanAkhir): number;
  /** Banyaknya baris hasil kompetisi untuk satu permainan (0 = tidak dihitung). */
  jumlahHasil(permainanId: number): number;
  /**
   * Tetapkan juara kompetisi yang sudah berakhir dan tidak punya meja yang masih main. Sekali
   * ditetapkan tidak berubah lagi (dicatat di database, juga untuk piala). Mengembalikan kode
   * kompetisi yang juaranya baru ditetapkan. Jangan dipanggil di dalam transaksi lain.
   */
  tetapkanJuara(sekarang: number, meja?: KeadaanMejaKompetisi): string[];
  /** Banyaknya piala (juara kompetisi yang sudah ditetapkan) per kunciNama. */
  piala(): Map<string, number>;
}

/**
 * Migrasi v2 (23 Okt 2026, keputusan #51; ditulis ulang di tempat 24 Okt 2026 untuk versi 2, karena
 * kompetisi belum pernah dirilis ke `main` sehingga belum ada database produksi yang menjalankannya).
 * Waktu disimpan ms epoch (INTEGER). Nilai satu permainan disimpan sebagai dua bilangan bulat
 * (dikalahkan, lawan) supaya rata-ratanya dihitung tanpa galat pembulatan.
 */
export const SKEMA_KOMPETISI = `
  CREATE TABLE IF NOT EXISTS kompetisi (
    kode TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    masa TEXT NOT NULL,
    pengaturan TEXT NOT NULL,
    diajukan_pada INTEGER NOT NULL,
    mulai_pada INTEGER,
    berakhir_pada INTEGER,
    ditutup_pada INTEGER,
    juara_pada INTEGER
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
    dikalahkan INTEGER NOT NULL,
    lawan INTEGER NOT NULL,
    skor INTEGER NOT NULL,
    juara INTEGER NOT NULL,
    keluar INTEGER NOT NULL,
    PRIMARY KEY (permainan_id, peserta_id)
  );
  CREATE INDEX IF NOT EXISTS hasil_kompetisi_peserta ON hasil_kompetisi (peserta_id);
  CREATE TABLE IF NOT EXISTS juara_kompetisi (
    kompetisi TEXT NOT NULL REFERENCES kompetisi(kode) ON DELETE CASCADE,
    kunci_nama TEXT NOT NULL,
    nama TEXT NOT NULL,
    PRIMARY KEY (kompetisi, kunci_nama)
  );
  CREATE INDEX IF NOT EXISTS juara_kompetisi_kunci ON juara_kompetisi (kunci_nama);
`;

/**
 * Database yang sempat menjalankan skema kompetisi versi 1 (build pra-rilis, misalnya server dev):
 * tabel kompetisinya dibuang lalu dibuat ulang dengan skema versi 2. Tabel lain tidak disentuh.
 * Kompetisi belum pernah dirilis, jadi tidak ada data pemain yang hilang. Idempoten.
 */
export function perbaikiSkemaKompetisiPraRilis(db: DatabaseSync, log: (...x: unknown[]) => void = () => undefined): boolean {
  const kolom = (tabel: string) => new Set((db.prepare(`PRAGMA table_info(${tabel})`).all() as { name: string }[]).map((k) => String(k.name)));
  const hasil = kolom('hasil_kompetisi');
  const kompetisi = kolom('kompetisi');
  if (!hasil.size || !kompetisi.size || (hasil.has('dikalahkan') && kompetisi.has('juara_pada'))) return false;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`DROP TABLE IF EXISTS hasil_kompetisi;
             DROP TABLE IF EXISTS juara_kompetisi;
             DROP TABLE IF EXISTS peserta_kompetisi;
             DROP TABLE IF EXISTS kompetisi;`);
    db.exec(SKEMA_KOMPETISI);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  log('skema kompetisi pra-rilis (versi 1) dibuang dan dibuat ulang dengan versi 2');
  return true;
}

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
  juara_pada: number | null;
}

const waktu = (b: BarisKompetisiDb): WaktuKompetisi => ({
  diajukanPada: Number(b.diajukan_pada),
  mulaiPada: b.mulai_pada === null ? null : Number(b.mulai_pada),
  berakhirPada: b.berakhir_pada === null ? null : Number(b.berakhir_pada),
  ditutupPada: b.ditutup_pada === null ? null : Number(b.ditutup_pada),
});

const masaDari = (x: string): MasaKompetisi => (isMasa(x) ? x : DAFTAR_MASA[0]);

const pengaturanDari = (json: string): PengaturanKompetisi => {
  let mentah: unknown = null;
  try {
    mentah = JSON.parse(json);
  } catch {
    // Rusak: jatuh ke bawaan.
  }
  // Yang tersimpan sudah dirapikan saat ditulis; dibaca longgar supaya data uji 1–2 putaran tetap apa adanya.
  return rapikanPengaturanKompetisi(mentah, 'tersimpan');
};

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
    'INSERT OR IGNORE INTO hasil_kompetisi (permainan_id, peserta_id, dikalahkan, lawan, skor, juara, keluar) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const hasilKompetisi = db.prepare(`
    SELECT h.permainan_id, h.peserta_id, h.dikalahkan, h.lawan, h.skor, h.juara, h.keluar
    FROM hasil_kompetisi h JOIN peserta_kompetisi p ON p.id = h.peserta_id
    WHERE p.kompetisi = ?
  `);
  const hitungHasil = db.prepare('SELECT COUNT(*) AS n FROM hasil_kompetisi WHERE permainan_id = ?');
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
  const belumAdaJuara = db.prepare(`
    SELECT * FROM kompetisi
    WHERE mulai_pada IS NOT NULL AND juara_pada IS NULL AND (ditutup_pada IS NOT NULL OR berakhir_pada <= ?)
  `);
  const tandaiJuara = db.prepare('UPDATE kompetisi SET juara_pada = ? WHERE kode = ? AND juara_pada IS NULL');
  const tambahJuara = db.prepare('INSERT OR IGNORE INTO juara_kompetisi (kompetisi, kunci_nama, nama) VALUES (?, ?, ?)');
  const juaraTersimpan = db.prepare('SELECT nama, kunci_nama FROM juara_kompetisi WHERE kompetisi = ? ORDER BY rowid');
  const hitungPiala = db.prepare('SELECT kunci_nama, COUNT(*) AS n FROM juara_kompetisi GROUP BY kunci_nama');

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
      dikalahkan: Number(h.dikalahkan),
      lawan: Number(h.lawan),
      skor: Number(h.skor),
      juara: Number(h.juara) === 1,
      keluar: Number(h.keluar) === 1,
    }));
    return { peserta, hasil, ...hitungKlasemenKompetisi(peserta, hasil), jumlahPermainan: new Set(hasil.map((h) => h.permainan)).size };
  };

  const pialaPerKunci = (): Map<string, number> => {
    const m = new Map<string, number>();
    for (const b of hitungPiala.all() as { kunci_nama: string; n: number }[]) m.set(String(b.kunci_nama), Number(b.n));
    return m;
  };

  /**
   * Tetapkan juara satu kompetisi yang sudah berakhir (pemanggil sudah memastikan tidak ada meja yang
   * masih main). Sekali saja: kalau sudah ditetapkan (juara_pada terisi), tidak berubah.
   */
  const tetapkanSatu = (b: BarisKompetisiDb, sekarang: number): boolean => {
    const juara = juaraKompetisi(klasemen(b.kode));
    const baru = transaksi(() => {
      if (Number(tandaiJuara.run(sekarang, b.kode).changes) !== 1) return false;
      for (const j of juara) tambahJuara.run(b.kode, kunciNama(j.nama), j.nama);
      return true;
    });
    if (baru) b.juara_pada = sekarang;
    return baru;
  };

  /**
   * Ringkasan satu kompetisi. Yang sudah berakhir dan tidak punya meja yang masih main ditetapkan
   * juaranya di sini (kalau belum). `pialaJuara` diisi pemanggil lewat lengkapiPiala() sesudah semua
   * penetapan, supaya juara yang baru ditetapkan ikut terhitung.
   */
  const ringkas = (b: BarisKompetisiDb, jumlah: number, sekarang: number, meja: KeadaanMejaKompetisi): RingkasanKompetisi => {
    const w = waktu(b);
    const status = statusKompetisi(w, sekarang);
    const mejaMain = status === 'pengajuan' || status === 'batal' ? 0 : meja.mejaMain(b.kode);
    if (status === 'selesai' && b.juara_pada === null && mejaMain === 0 && !meja.tahanJuara?.()) tetapkanSatu(b, sekarang);
    const juara =
      status === 'selesai' && b.juara_pada !== null ? (juaraTersimpan.all(b.kode) as { nama: string }[]).map((j) => String(j.nama)) : null;
    return {
      kode: b.kode,
      nama: b.nama,
      masa: masaDari(b.masa),
      status,
      jumlahPeserta: jumlah,
      diajukanPada: w.diajukanPada,
      mulaiPada: w.mulaiPada,
      berakhirPada: status === 'selesai' ? selesaiPada(w) : w.berakhirPada,
      disudahi: w.ditutupPada !== null,
      mejaMain,
      ...(juara ? { juara } : {}),
    };
  };

  /** Isi `pialaJuara` (sejajar dengan `juara`) dari hitungan piala terbaru. */
  const lengkapiPiala = <R extends RingkasanKompetisi>(r: R, piala: Map<string, number>): R => {
    if (r.juara) r.pialaJuara = r.juara.map((nama) => piala.get(kunciNama(nama)) ?? 1);
    return r;
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
      // Longgar ('tersimpan'): API publik sudah merapikan isiannya dengan aturan pengajuan (hanya pilihan
      // formulir) sebelum memanggil ini. Test dan data uji boleh memakai 1–2 putaran.
      const pengaturan = rapikanPengaturanKompetisi(data.pengaturan, 'tersimpan');
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
      return { nama: b.nama, pengaturan: pengaturanDari(b.pengaturan), status: statusKompetisi(waktu(b), sekarang) };
    },

    detail(kodeMentah, sekarang, token, meja = TANPA_MEJA) {
      const b = baca(kodeMentah);
      if (!b) return null;
      const r = ringkas(b, Number((hitungPeserta.get(b.kode) as { n: number }).n), sekarang, meja);
      // Dihitung sesudah ringkas(): juara yang baru ditetapkan di sana ikut terhitung pialanya.
      const piala = pialaPerKunci();
      lengkapiPiala(r, piala);
      const k = klasemen(b.kode);
      const saya = token ? (pesertaToken.get(b.kode, hash(token)) as { id: number; nama: string; setuju_tutup: number } | undefined) : undefined;
      const denganPiala = (x: BarisKompetisi): BarisKlasemenKompetisi => ({ ...x, piala: piala.get(kunciNama(x.nama)) ?? 0 });
      return {
        v: 1,
        ...r,
        pengaturan: pengaturanDari(b.pengaturan),
        minPeserta: MIN_PESERTA,
        minMain: MIN_MAIN_KOMPETISI,
        peserta: k.peserta.map((p) => p.nama),
        jumlahPermainan: k.jumlahPermainan,
        setujuTutup: k.peserta.filter((p) => p.setuju).length,
        peringkat: k.peringkat.map(denganPiala),
        belumCukup: k.belumCukup.map(denganPiala),
        meja: r.status === 'berjalan' ? [...meja.mejaMenunggu(b.kode)].sort((a, c) => c.terisi - a.terisi) : [],
        ...(saya ? { saya: { id: Number(saya.id), nama: String(saya.nama), setujuTutup: Number(saya.setuju_tutup) === 1 } } : {}),
      };
    },

    daftar(sekarang, meja = TANPA_MEJA) {
      const baris = [
        ...(pengajuanDanBerjalan.all({ batasAju: batasAju(sekarang), sekarang }) as unknown as (BarisKompetisiDb & { jumlah: number })[]),
        ...(arsip.all({ sekarang }) as unknown as (BarisKompetisiDb & { jumlah: number })[]),
      ];
      const hasil = baris.map((b) => ringkas(b, Number(b.jumlah), sekarang, meja));
      const piala = pialaPerKunci();
      return hasil.map((r) => lengkapiPiala(r, piala));
    },

    jumlahPengajuan(sekarang) {
      return Number((hitungPengajuan.get(batasAju(sekarang)) as { n: number }).n);
    },

    klasemen(kode) {
      const b = baca(kode);
      if (!b) return null;
      const { peringkat, belumCukup } = klasemen(b.kode);
      return { peringkat, belumCukup };
    },

    catatHasil(permainanId, r) {
      if (!r.kompetisi) return 0;
      const b = baca(r.kompetisi);
      // Juara sudah ditetapkan: hasil tidak berubah lagi.
      if (!b || b.juara_pada !== null) return 0;
      // Dihitung kalau permainannya dimulai selagi kompetisi berjalan (versi 2), walau selesai sesudahnya.
      if (!berjalanPada(waktu(b), r.mulaiPada ?? r.selesaiPada)) return 0;
      // Kurang dari dua kursi bertahan sampai akhir: tidak dihitung untuk siapa pun (keputusan 24 Okt 2026).
      if (!permainanKompetisiDihitung(r.pemain)) return 0;
      // Yang keluar nilainya 0 dan tidak dihitung dikalahkan untuk yang lain; skor efektifnya sama
      // dengan leaderboard (#45, skor terendah di meja) untuk rata-rata skor.
      const nilai = nilaiKompetisi(r.pemain);
      const efektif = nilaiEfektif(r.pemain);
      // Satu permainan dicatat utuh atau tidak sama sekali (savepoint di dalam transaksi riwayat).
      db.exec('SAVEPOINT hasil_kompetisi');
      try {
        let n = 0;
        r.pemain.forEach((p, i) => {
          if (p.peserta === undefined) return;
          tambahHasil.run(permainanId, p.peserta, nilai[i].dikalahkan, nilai[i].lawan, efektif[i].skor, efektif[i].juara ? 1 : 0, p.keluar ? 1 : 0);
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

    jumlahHasil(permainanId) {
      return Number((hitungHasil.get(permainanId) as { n: number }).n);
    },

    tetapkanJuara(sekarang, meja = TANPA_MEJA) {
      const baru: string[] = [];
      if (meja.tahanJuara?.()) return baru;
      for (const b of belumAdaJuara.all(sekarang) as unknown as BarisKompetisiDb[]) {
        if (meja.mejaMain(b.kode) > 0) continue;
        if (tetapkanSatu(b, sekarang)) baru.push(b.kode);
      }
      return baru;
    },

    piala: pialaPerKunci,
  };
}
