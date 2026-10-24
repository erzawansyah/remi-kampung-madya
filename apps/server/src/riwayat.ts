// Riwayat klasemen akhir permainan online, disimpan di SQLite (modul bawaan Node `node:sqlite`,
// tanpa dependensi native). Hanya klasemen akhir yang disimpan, bukan rincian per putaran.
// Aturan hitung leaderboard ada di @remi/meja (peringkat.ts), dipakai bersama Statistik di HP.

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  MIN_MAIN,
  SARINGAN_BAWAAN,
  bulanWib,
  hitungPeringkat,
  kunciNama,
  rapikanSaringan,
  rapikanUrutan,
  urutkanPeringkat,
  type BarisPeringkat as BarisPapan,
  type BulanWib,
  type KursiPeringkat,
  type PermainanPeringkat,
  type RingkasanAkhir,
  type SaringanPeringkat,
  type UrutanPeringkat,
} from '@remi/meja';
import { buatPenyimpanKompetisi, SKEMA_KOMPETISI, type PenyimpanKompetisi } from './kompetisi.js';
import { buatPenyimpanMejaAktif, SKEMA_MEJA_AKTIF, type PenyimpanMejaAktif } from './mejaAktif.js';

export interface PermainanTersimpan {
  id: number;
  kodeMeja: string;
  /** ISO 8601 */
  selesaiPada: string;
  alasan: string | null;
  jumlahPutaran: number;
  /** Jumlah kursi (manusia + warga kedai). */
  jumlahPemain: number;
  /** null = tidak tercatat (meja 4 orang yang selesai sebelum skema v1). */
  jumlahDeck: number | null;
  /** Masuk peringkat online (minimal 2 orang, keputusan pemilik #45). */
  dihitung: boolean;
  klasemen: RingkasanAkhir['pemain'];
}

/** Baris peringkat bentuk lama (`GET /api/peringkat` tanpa `v=2`), yang dibaca aplikasi versi lama. */
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

/** Jawaban `GET /api/peringkat?v=2`. */
export interface PapanPeringkat {
  v: 2;
  urut: UrutanPeringkat;
  saringan: SaringanPeringkat;
  /** Bulan WIB yang dipakai saringan "Bulan ini"; null = sepanjang masa. */
  periode: BulanWib | null;
  minMain: number;
  /** Permainan yang dihitung sesudah saringan dan syarat minimal 2 orang. */
  jumlahPermainan: number;
  peringkat: BarisPapan[];
  /** Untuk urutan rata-rata/persen/posisi: yang main kurang dari minMain kali. */
  belumCukup: BarisPapan[];
}

export interface PermintaanPapan {
  /** Data mentah boleh (parameter URL): dirapikan, yang tidak sah jadi bawaan. */
  urut?: unknown;
  saringan?: unknown;
  /** ms epoch untuk saringan "Bulan ini"; kosong = jam penyimpan. */
  sekarang?: number;
}

export interface PenyimpanRiwayat {
  simpan(r: RingkasanAkhir): number;
  /** Permainan terbaru dulu. */
  daftar(batas: number): PermainanTersimpan[];
  /**
   * Peringkat bentuk lama, sepanjang masa, urut jumlah juara lalu total skor. Dihitung dengan aturan
   * yang sama dengan papan() (minimal 2 orang, yang keluar juru kunci, nama tanpa beda huruf besar/kecil).
   */
  peringkat(): BarisPeringkat[];
  /** Leaderboard dengan pilihan urutan dan saringan (keputusan pemilik #45). */
  papan(permintaan?: PermintaanPapan): PapanPeringkat;
  /** Kompetisi (#51), di database yang sama. Hasil meja kompetisi dicatat simpan() sekalian. */
  kompetisi: PenyimpanKompetisi;
  /** Meja online yang masih ada (selamat dari restart/deploy), di database yang sama. Diatur server.ts. */
  mejaAktif: PenyimpanMejaAktif;
  tutup(): void;
}

export interface OpsiRiwayat {
  log?: (...x: unknown[]) => void;
  /** Jam untuk saringan "Bulan ini" (diganti di test). */
  sekarang?: () => number;
}

/** Skema awal (v0, rilis 0.1/0.2). Jangan diubah: database lama di server dibuat dengan ini. */
const SKEMA_V0 = `
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
`;

/**
 * SEMENTARA, hanya di branch ini: v3 adalah migrasi usul fitur dari branch `fitur/usul-fitur`
 * (`SKEMA_USULAN` di apps/server/src/usulan.ts), yang digabung lebih dulu. Isinya disalin persis di
 * sini supaya nomor versi v4 (meja_aktif) sudah benar dan database yang sempat dibuat branch ini sama
 * dengan sesudah digabung. Saat fitur/usul-fitur digabung: hapus konstanta ini dan pakai impor
 * `SKEMA_USULAN` dari './usulan.js'. Isi MIGRASI[2] tidak boleh berubah (dijaga riwayat.test.ts).
 */
const SKEMA_USULAN = `
  CREATE TABLE IF NOT EXISTS usulan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dibuat_pada INTEGER NOT NULL,
    nama TEXT NOT NULL,
    judul TEXT NOT NULL,
    isi TEXT NOT NULL,
    jenis TEXT,
    notion_halaman TEXT,
    terkirim_pada INTEGER,
    percobaan INTEGER NOT NULL DEFAULT 0,
    galat_terakhir TEXT
  );
  CREATE INDEX IF NOT EXISTS usulan_belum_terkirim ON usulan (id) WHERE terkirim_pada IS NULL;
  CREATE INDEX IF NOT EXISTS usulan_dibuat ON usulan (dibuat_pada);
`;

/**
 * Migrasi skema berurutan; indeks + 1 = nilai `PRAGMA user_version` sesudahnya. **Hanya boleh
 * ditambah di belakang.** Entri yang sudah ada jangan diubah, karena database di server sudah
 * menjalankannya. Kolom baru wajib boleh NULL atau punya DEFAULT, supaya server versi sebelumnya
 * tetap bisa menulis kalau deploy dibatalkan (barisnya dilengkapi lengkapiBaris saat dibuka lagi).
 */
export const MIGRASI: readonly string[] = [
  // v1 (16 Okt 2026, keputusan pemilik #45): saringan leaderboard, tanda keluar, kunci nama.
  `ALTER TABLE permainan ADD COLUMN jumlah_pemain INTEGER;
   ALTER TABLE permainan ADD COLUMN jumlah_deck INTEGER;
   ALTER TABLE permainan ADD COLUMN jumlah_manusia INTEGER;
   ALTER TABLE permainan ADD COLUMN mode_kaldu INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE klasemen ADD COLUMN keluar INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE klasemen ADD COLUMN kunci_nama TEXT;
   CREATE INDEX IF NOT EXISTS permainan_selesai ON permainan (selesai_pada);
   CREATE INDEX IF NOT EXISTS klasemen_kunci ON klasemen (kunci_nama) WHERE bot = 0;`,
  // v2 (23 Okt 2026, keputusan pemilik #51): kompetisi, pesertanya, dan hasil per permainan.
  SKEMA_KOMPETISI,
  // v3 (24 Okt 2026, keputusan pemilik): usul fitur dari game, diteruskan ke Notion. Tanpa alamat IP.
  SKEMA_USULAN,
  // v4 (24 Okt 2026, keputusan pemilik): meja online yang masih ada, supaya selamat dari restart/deploy.
  // Memuat token pemain: database hanya di volume privat.
  SKEMA_MEJA_AKTIF,
];

/** Jalankan fn dalam satu transaksi tulis; gagal = semuanya dibatalkan. */
function transaksi<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const hasil = fn();
    db.exec('COMMIT');
    return hasil;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Buat skema v0 (kalau belum ada) lalu jalankan migrasi yang belum, semuanya dalam satu transaksi. */
function migrasiSkema(db: DatabaseSync, log: (...x: unknown[]) => void): void {
  const [lama, baru] = transaksi(db, () => {
    db.exec(SKEMA_V0);
    const versi = Number((db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined)?.user_version ?? 0);
    for (let v = versi; v < MIGRASI.length; v++) db.exec(MIGRASI[v]);
    if (versi < MIGRASI.length) db.exec(`PRAGMA user_version = ${MIGRASI.length}`);
    return [versi, Math.max(versi, MIGRASI.length)];
  });
  if (lama < baru) log(`skema riwayat dimigrasi v${lama} → v${baru}`);
  else if (lama > MIGRASI.length) log(`skema riwayat v${lama} lebih baru dari server ini (v${MIGRASI.length}), dipakai apa adanya`);
}

/**
 * Lengkapi kolom yang masih kosong: baris lama (sebelum v1) dan baris yang ditulis server versi
 * sebelumnya. Idempoten, dijalankan setiap database dibuka. `kunci_nama` dihitung di JS karena
 * lower() SQLite hanya mengecilkan huruf ASCII ("ÉLIA" dan "élia" harus satu orang).
 */
function lengkapiBaris(db: DatabaseSync, log: (...x: unknown[]) => void): void {
  const jumlah = transaksi(db, () => {
    const ubah = (sql: string) => Number(db.prepare(sql).run().changes);
    const pemain = ubah(
      'UPDATE permainan SET jumlah_pemain = (SELECT COUNT(*) FROM klasemen k WHERE k.permainan_id = permainan.id) WHERE jumlah_pemain IS NULL',
    );
    // Sebelum v1 tidak ada tanda keluar: kursi bot = 0 adalah manusia yang bertahan sampai selesai.
    const manusia = ubah(
      'UPDATE permainan SET jumlah_manusia = (SELECT COUNT(*) FROM klasemen k WHERE k.permainan_id = permainan.id AND (k.bot = 0 OR k.keluar = 1)) WHERE jumlah_manusia IS NULL',
    );
    // 2–3 orang selalu 1 deck, 5–6 orang selalu 2 deck. Meja 4 orang bisa keduanya: dibiarkan NULL.
    const deck = ubah(
      'UPDATE permainan SET jumlah_deck = CASE WHEN jumlah_pemain <= 3 THEN 1 ELSE 2 END WHERE jumlah_deck IS NULL AND jumlah_pemain IN (2, 3, 5, 6)',
    );
    const tanpaKunci = db.prepare('SELECT permainan_id, kursi, nama FROM klasemen WHERE kunci_nama IS NULL').all() as {
      permainan_id: number;
      kursi: number;
      nama: string;
    }[];
    const isiKunci = db.prepare('UPDATE klasemen SET kunci_nama = ? WHERE permainan_id = ? AND kursi = ?');
    for (const b of tanpaKunci) isiKunci.run(kunciNama(String(b.nama)), b.permainan_id, b.kursi);
    return { pemain, manusia, deck, kunci: tanpaKunci.length };
  });
  if (jumlah.pemain || jumlah.manusia || jumlah.deck || jumlah.kunci) {
    log(
      `riwayat dilengkapi: ${jumlah.pemain} jumlah_pemain, ${jumlah.manusia} jumlah_manusia, ${jumlah.deck} jumlah_deck, ${jumlah.kunci} kunci_nama`,
    );
  }
}

/** Hasil agregat satu saringan (belum diurutkan), disimpan sementara di cache. */
interface Agregat {
  baris: BarisPapan[];
  jumlah: number;
}

const BATAS_CACHE = 50;

/**
 * Buka (atau buat) database riwayat. `sumber` = path file (':memory:' untuk test) atau DatabaseSync
 * yang sudah terbuka (test migrasi); yang terakhir tidak ditutup oleh tutup().
 */
export function bukaRiwayat(sumber: string | DatabaseSync, opsi: OpsiRiwayat = {}): PenyimpanRiwayat {
  const log = opsi.log ?? (() => undefined);
  const jam = opsi.sekarang ?? Date.now;
  const milikSendiri = typeof sumber === 'string';
  if (typeof sumber === 'string' && sumber !== ':memory:') mkdirSync(dirname(sumber), { recursive: true });
  const db = typeof sumber === 'string' ? new DatabaseSync(sumber) : sumber;
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrasiSkema(db, log);
  lengkapiBaris(db, log);
  const kompetisi = buatPenyimpanKompetisi(db);
  const mejaAktif = buatPenyimpanMejaAktif(db);

  const tambahPermainan = db.prepare(
    `INSERT INTO permainan (kode_meja, selesai_pada, alasan, jumlah_putaran, jumlah_pemain, jumlah_deck, jumlah_manusia, mode_kaldu)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tambahBaris = db.prepare(
    `INSERT INTO klasemen (permainan_id, kursi, peringkat, nama, bot, skor, mentung, kepentung, keluar, kunci_nama)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ambilPermainan = db.prepare(
    `SELECT id, kode_meja, selesai_pada, alasan, jumlah_putaran, jumlah_pemain, jumlah_deck, jumlah_manusia
     FROM permainan ORDER BY id DESC LIMIT ?`,
  );
  const ambilKlasemen = db.prepare(
    'SELECT kursi, peringkat, nama, bot, skor, mentung, kepentung, keluar FROM klasemen WHERE permainan_id = ? ORDER BY peringkat, kursi',
  );
  // Semua kursi permainan yang lolos saringan, urut dari permainan paling lama (id = urutan selesai).
  const ambilKursiSaringan = db.prepare(`
    SELECT k.permainan_id AS id, k.nama, k.kunci_nama, k.bot, k.keluar, k.skor, k.mentung, k.kepentung
    FROM klasemen k JOIN permainan p ON p.id = k.permainan_id
    WHERE p.jumlah_manusia >= 2
      AND (:pemain IS NULL OR p.jumlah_pemain = :pemain)
      AND (:deck IS NULL OR p.jumlah_deck = :deck)
      AND (:dari IS NULL OR p.selesai_pada >= :dari)
      AND (:sampai IS NULL OR p.selesai_pada < :sampai)
    ORDER BY p.id, k.kursi
  `);
  // Ejaan nama terbaru per orang, dari semua permainan (juga di luar saringan periode).
  const ambilEjaan = db.prepare('SELECT kunci_nama, nama FROM klasemen WHERE (bot = 0 OR keluar = 1) AND kunci_nama IS NOT NULL ORDER BY permainan_id, kursi');

  /** Hasil agregat per saringan; dikosongkan setiap ada permainan baru tersimpan. */
  const cache = new Map<string, Agregat>();

  function agregat(s: SaringanPeringkat, periode: BulanWib | null): Agregat {
    const kunci = JSON.stringify([s.jumlahPemain, s.jumlahDeck, periode?.bulan ?? null]);
    const ada = cache.get(kunci);
    if (ada) return ada;
    const kursi = ambilKursiSaringan.all({
      pemain: s.jumlahPemain,
      deck: s.jumlahDeck,
      dari: periode?.dari ?? null,
      sampai: periode?.sampai ?? null,
    }) as Record<string, number | string | null>[];
    const permainan: PermainanPeringkat[] = [];
    let idTerakhir: number | null = null;
    let pemain: KursiPeringkat[] = [];
    for (const k of kursi) {
      const id = Number(k.id);
      if (id !== idTerakhir) {
        pemain = [];
        permainan.push({ pemain });
        idTerakhir = id;
      }
      pemain.push({
        nama: String(k.nama),
        kunci: typeof k.kunci_nama === 'string' && k.kunci_nama ? k.kunci_nama : undefined,
        // Yang keluar ditulis bot = 0; baris dari server lama bisa bot = 1 tanpa tanda keluar.
        bot: Number(k.bot) === 1 && Number(k.keluar) !== 1,
        keluar: Number(k.keluar) === 1,
        skor: Number(k.skor),
        mentung: Number(k.mentung),
        kepentung: Number(k.kepentung),
      });
    }
    const ejaan = new Map<string, string>();
    for (const b of ambilEjaan.all() as { kunci_nama: string; nama: string }[]) ejaan.set(String(b.kunci_nama), String(b.nama).trim());
    const hasil: Agregat = { baris: hitungPeringkat(permainan, ejaan), jumlah: permainan.length };
    if (cache.size >= BATAS_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(kunci, hasil);
    return hasil;
  }

  return {
    simpan(r) {
      const id = transaksi(db, () => {
        // Yang keluar di tengah permainan ditulis bot: false, jadi tetap terhitung manusia.
        const manusia = r.pemain.filter((p) => !p.bot || p.keluar).length;
        const deck = Number.isInteger(r.jumlahDeck) ? r.jumlahDeck : null;
        const hasil = tambahPermainan.run(
          r.kode,
          new Date(r.selesaiPada).toISOString(),
          r.alasan,
          r.jumlahPutaran,
          r.pemain.length,
          deck,
          manusia,
          r.modeKaldu ? 1 : 0,
        );
        const id = Number(hasil.lastInsertRowid);
        for (const p of r.pemain) {
          tambahBaris.run(id, p.kursi, p.peringkat, p.nama, p.bot ? 1 : 0, p.skor, p.mentung, p.kepentung, p.keluar ? 1 : 0, kunciNama(p.nama));
        }
        if (r.kompetisi) {
          // Galat kompetisi tidak boleh membatalkan klasemen akhir biasa (SQLite membatalkan per pernyataan).
          try {
            kompetisi.catatHasil(id, r);
          } catch (e) {
            log(`galat mencatat hasil kompetisi ${r.kompetisi}`, e);
          }
        }
        return id;
      });
      cache.clear();
      return id;
    },
    daftar(batas) {
      const baris = ambilPermainan.all(Math.max(1, Math.min(100, Math.floor(batas)))) as {
        id: number;
        kode_meja: string;
        selesai_pada: string;
        alasan: string | null;
        jumlah_putaran: number;
        jumlah_pemain: number | null;
        jumlah_deck: number | null;
        jumlah_manusia: number | null;
      }[];
      return baris.map((b) => {
        const klasemen = (ambilKlasemen.all(b.id) as Record<string, number | string>[]).map((k) => ({
          kursi: Number(k.kursi),
          peringkat: Number(k.peringkat),
          nama: String(k.nama),
          bot: Number(k.bot) === 1,
          ...(Number(k.keluar) === 1 ? { keluar: true as const } : {}),
          skor: Number(k.skor),
          mentung: Number(k.mentung),
          kepentung: Number(k.kepentung),
        }));
        return {
          id: b.id,
          kodeMeja: b.kode_meja,
          selesaiPada: b.selesai_pada,
          alasan: b.alasan,
          jumlahPutaran: b.jumlah_putaran,
          jumlahPemain: b.jumlah_pemain ?? klasemen.length,
          jumlahDeck: b.jumlah_deck ?? null,
          dihitung: (b.jumlah_manusia ?? klasemen.filter((k) => !k.bot).length) >= 2,
          klasemen,
        };
      });
    },
    peringkat() {
      const { baris } = agregat(SARINGAN_BAWAAN, null);
      return urutkanPeringkat(baris, 'juara').peringkat.map((b) => ({
        nama: b.nama,
        main: b.main,
        juara: b.juara,
        totalSkor: b.totalSkor,
        rataRata: b.rataRata,
        skorTerbaik: b.skorTerbaik,
        mentung: b.mentung,
        kepentung: b.kepentung,
      }));
    },
    papan(permintaan = {}) {
      const urut = rapikanUrutan(permintaan.urut);
      const saringan = rapikanSaringan(permintaan.saringan);
      const periode = saringan.periode === 'bulan' ? bulanWib(permintaan.sekarang ?? jam()) : null;
      const { baris, jumlah } = agregat(saringan, periode);
      const { peringkat, belumCukup } = urutkanPeringkat(baris, urut);
      return { v: 2, urut, saringan, periode, minMain: MIN_MAIN, jumlahPermainan: jumlah, peringkat, belumCukup };
    },
    kompetisi,
    mejaAktif,
    tutup() {
      if (milikSendiri) db.close();
    },
  };
}
