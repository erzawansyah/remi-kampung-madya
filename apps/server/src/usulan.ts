// Usul fitur dari game (keputusan pemilik 24 Okt 2026): usulan pemain disimpan di database SQLite
// yang sama dengan riwayat (tabelnya dibuat migrasi v3 di riwayat.ts), lalu diteruskan ke database
// Notion "Permintaan Fitur" milik pemilik (notion.ts) kalau NOTION_TOKEN dan NOTION_USULAN_DB diisi.
// Tanpa keduanya usulan tetap tersimpan, dan terkirim begitu Notion diatur dan server dijalankan ulang.
//
// Alamat IP pengirim TIDAK pernah disimpan di database; batas per jaringan cukup di memori server.

import type { DatabaseSync } from 'node:sqlite';
import { penjadwalNyata, type Penjadwal, type Usulan } from '@remi/meja';
import { GalatNotion, type KlienNotion } from './notion.js';

/** Migrasi v3 (24 Okt 2026). Waktu disimpan ms epoch (INTEGER). */
export const SKEMA_USULAN = `
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

export interface UsulanTersimpan {
  id: number;
  /** ms epoch */
  dibuatPada: number;
  nama: string;
  judul: string;
  isi: string;
  jenis: string | null;
  notionHalaman: string | null;
  terkirimPada: number | null;
  percobaan: number;
  galatTerakhir: string | null;
}

export interface PenyimpanUsulan {
  /** Simpan usulan yang sudah diperiksa (periksaUsulan dari @remi/meja). Mengembalikan id barunya. */
  simpan(u: Usulan, sekarang: number): number;
  ambil(id: number): UsulanTersimpan | null;
  /** Yang belum terkirim dan percobaannya masih di bawah `maksPercobaan`, yang paling lama dulu. */
  belumTerkirim(maksPercobaan: number, batas?: number): UsulanTersimpan[];
  tandaiTerkirim(id: number, halaman: string, sekarang: number): void;
  /** Catat satu percobaan gagal; mengembalikan jumlah percobaan sesudahnya. */
  tandaiGagal(id: number, galat: string): number;
  /** Banyaknya usulan yang masuk sejak `sejak` (ms epoch), untuk batas harian. */
  jumlahSejak(sejak: number): number;
}

type Baris = Record<string, number | string | null>;

const keUsulan = (b: Baris): UsulanTersimpan => ({
  id: Number(b.id),
  dibuatPada: Number(b.dibuat_pada),
  nama: String(b.nama),
  judul: String(b.judul),
  isi: String(b.isi),
  jenis: b.jenis === null ? null : String(b.jenis),
  notionHalaman: b.notion_halaman === null ? null : String(b.notion_halaman),
  terkirimPada: b.terkirim_pada === null ? null : Number(b.terkirim_pada),
  percobaan: Number(b.percobaan),
  galatTerakhir: b.galat_terakhir === null ? null : String(b.galat_terakhir),
});

export function buatPenyimpanUsulan(db: DatabaseSync): PenyimpanUsulan {
  const tambah = db.prepare('INSERT INTO usulan (dibuat_pada, nama, judul, isi, jenis) VALUES (?, ?, ?, ?, ?)');
  const ambilSatu = db.prepare('SELECT * FROM usulan WHERE id = ?');
  const ambilBelum = db.prepare('SELECT * FROM usulan WHERE terkirim_pada IS NULL AND percobaan < ? ORDER BY id LIMIT ?');
  const terkirim = db.prepare('UPDATE usulan SET terkirim_pada = ?, notion_halaman = ?, galat_terakhir = NULL WHERE id = ?');
  const gagal = db.prepare('UPDATE usulan SET percobaan = percobaan + 1, galat_terakhir = ? WHERE id = ? RETURNING percobaan');
  const hitungSejak = db.prepare('SELECT COUNT(*) AS n FROM usulan WHERE dibuat_pada >= ?');
  return {
    simpan(u, sekarang) {
      return Number(tambah.run(sekarang, u.nama, u.judul, u.isi, u.jenis).lastInsertRowid);
    },
    ambil(id) {
      const b = ambilSatu.get(id) as Baris | undefined;
      return b ? keUsulan(b) : null;
    },
    belumTerkirim(maksPercobaan, batas = 500) {
      return (ambilBelum.all(maksPercobaan, batas) as Baris[]).map(keUsulan);
    },
    tandaiTerkirim(id, halaman, sekarang) {
      terkirim.run(sekarang, halaman, id);
    },
    tandaiGagal(id, galat) {
      const b = gagal.get(galat.slice(0, 500), id) as { percobaan?: number } | undefined;
      return Number(b?.percobaan ?? 0);
    },
    jumlahSejak(sejak) {
      return Number((hitungSejak.get(sejak) as { n: number }).n);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Pengirim ke Notion

/** Usulan yang gagal sekian kali tidak dicoba lagi (barisnya tetap di database). */
export const MAKS_PERCOBAAN_USULAN = 20;
/** Jeda putaran kirim ulang, sekaligus jeda sesudah gagal pertama. */
export const JEDA_PUTARAN_USULAN_MS = 5 * 60_000;
/** Jeda terpanjang sesudah gagal berkali-kali. */
export const JEDA_MAKS_USULAN_MS = 6 * 60 * 60_000;
/** Putaran pertama sesudah server jalan (usulan yang masuk selagi Notion belum diatur atau server mati). */
const JEDA_AWAL_MS = 10_000;

/**
 * Jeda sebelum usulan yang sudah gagal `percobaan` kali boleh dicoba lagi: 5 menit, lalu dua kali
 * lipat tiap gagal, paling lama 6 jam. 20 percobaan ≈ 3,4 hari sejak gagal pertama (ditambah selisih detak pengirim).
 */
export function jedaCobaLagi(percobaan: number): number {
  if (percobaan <= 0) return 0;
  return Math.min(JEDA_MAKS_USULAN_MS, JEDA_PUTARAN_USULAN_MS * 2 ** Math.min(percobaan - 1, 20));
}

export interface OpsiPengirimUsulan {
  penyimpan: PenyimpanUsulan;
  notion: KlienNotion;
  log: (...x: unknown[]) => void;
  /** Timer dan jam (test memakai jam palsu). Bawaan: setTimeout dan Date.now. */
  penjadwal?: Penjadwal;
}

export interface PengirimUsulan {
  /** Kirim usulan yang baru disimpan sekarang juga (tidak menunggu putaran berikutnya). */
  kirimBaru(id: number): Promise<void>;
  /** Satu putaran: kirim yang belum terkirim dan sudah waktunya dicoba lagi, satu per satu. */
  putaran(): Promise<void>;
  /** Hentikan timer dan batalkan permintaan yang sedang jalan; ditunggu sampai benar-benar diam. */
  hentikan(): Promise<void>;
}

export function jalankanPengirimUsulan(opsi: OpsiPengirimUsulan): PengirimUsulan {
  const { penyimpan, notion, log } = opsi;
  const jadwal = opsi.penjadwal ?? penjadwalNyata;
  /** id → paling cepat boleh dicoba lagi (ms). Di memori: sesudah server jalan ulang, dicoba lagi sekali. */
  const cobaLagiPada = new Map<number, number>();
  /** Permintaan yang sedang jalan (id → selesainya), supaya satu usulan tidak terkirim dua kali. */
  const sedang = new Map<number, Promise<boolean>>();
  /**
   * Yang sudah jadi halaman Notion selama proses ini. Cadangan kalau tandaiTerkirim gagal menulis ke
   * database: usulan itu tidak dikirim lagi sampai server jalan ulang.
   */
  const sudahTerkirim = new Set<number>();
  const batal = new AbortController();
  let berhenti = false;
  let timer: unknown = null;
  let putaranJalan: Promise<void> | null = null;

  /**
   * Kirim satu usulan. Barisnya dibaca ulang dari database tepat sebelum dikirim, karena daftar putaran
   * bisa basi: usulan yang sama baru saja terkirim lewat kirimBaru() selagi putaran menunggu usulan
   * lain, dan Notion tidak menolak halaman kembar. false = galat menyeluruh (putaran sebaiknya berhenti).
   */
  const kirimSatu = (id: number): Promise<boolean> => {
    const ada = sedang.get(id);
    if (ada) return ada;
    if (sudahTerkirim.has(id)) return Promise.resolve(true);
    const u = penyimpan.ambil(id);
    if (!u || u.terkirimPada !== null || u.percobaan >= MAKS_PERCOBAAN_USULAN) return Promise.resolve(true);
    const p = (async () => {
      let halaman: string;
      try {
        ({ id: halaman } = await notion.buatHalaman(
          { idServer: u.id, judul: u.judul, isi: u.isi, pengusul: u.nama, jenis: u.jenis },
          batal.signal,
        ));
      } catch (e) {
        // Dibatalkan karena server berhenti: bukan kegagalan usulannya, tidak dihitung.
        if (berhenti) return true;
        const galat = e instanceof GalatNotion ? e : new GalatNotion(e instanceof Error ? e.message : String(e), null);
        let percobaan = u.percobaan + 1;
        try {
          percobaan = penyimpan.tandaiGagal(u.id, galat.message);
        } catch (e2) {
          log(`usulan #${u.id}: galat mencatat kegagalan`, e2 instanceof Error ? e2.message : e2);
        }
        const jeda = jedaCobaLagi(percobaan);
        cobaLagiPada.set(u.id, jadwal.sekarang() + jeda);
        if (percobaan >= MAKS_PERCOBAAN_USULAN) {
          log(`usulan #${u.id} gagal dikirim ke Notion (${galat.message}); berhenti dicoba sesudah ${percobaan} percobaan, tetap tersimpan di database`);
        } else {
          log(`usulan #${u.id} gagal dikirim ke Notion (percobaan ${percobaan}/${MAKS_PERCOBAAN_USULAN}, dicoba lagi dalam ±${Math.round(jeda / 60_000)} menit): ${galat.message}`);
        }
        return !galat.menyeluruh;
      }
      // Halamannya sudah dibuat: dicatat walau server sedang berhenti (database baru ditutup sesudah
      // hentikan() selesai), supaya tidak dikirim lagi sesudah server jalan ulang.
      sudahTerkirim.add(u.id);
      cobaLagiPada.delete(u.id);
      try {
        penyimpan.tandaiTerkirim(u.id, halaman, jadwal.sekarang());
      } catch (e) {
        log(`usulan #${u.id} terkirim ke Notion, tapi galat mencatatnya di database`, e instanceof Error ? e.message : e);
        return true;
      }
      log(`usulan #${u.id} terkirim ke Notion`);
      return true;
    })();
    // Dihapus sesudah selesai (bukan di dalam fungsinya: bisa selesai sebelum sempat dicatat).
    sedang.set(u.id, p);
    void p.finally(() => {
      if (sedang.get(u.id) === p) sedang.delete(u.id);
    });
    return p;
  };

  const putaran = (): Promise<void> => {
    if (putaranJalan) return putaranJalan;
    const p = (async () => {
      try {
        // Daftar ini bisa basi selagi putaran menunggu Notion; kirimSatu membaca ulang tiap barisnya.
        for (const { id } of penyimpan.belumTerkirim(MAKS_PERCOBAAN_USULAN)) {
          if (berhenti) return;
          if ((cobaLagiPada.get(id) ?? 0) > jadwal.sekarang()) continue;
          // Galat menyeluruh (token salah, Notion gangguan): sisanya menunggu putaran berikutnya.
          if (!(await kirimSatu(id))) return;
        }
      } catch (e) {
        if (!berhenti) log('galat putaran kirim usulan', e instanceof Error ? e.message : e);
      }
    })();
    // Putaran tanpa usulan yang perlu dikirim selesai seketika: dilepas sesudahnya, bukan di dalamnya.
    putaranJalan = p;
    void p.finally(() => {
      if (putaranJalan === p) putaranJalan = null;
    });
    return p;
  };

  const jadwalkan = (ms: number) => {
    if (berhenti) return;
    timer = jadwal.setel(ms, () => {
      timer = null;
      void putaran().finally(() => jadwalkan(JEDA_PUTARAN_USULAN_MS));
    });
  };
  jadwalkan(JEDA_AWAL_MS);

  return {
    async kirimBaru(id) {
      if (berhenti) return;
      try {
        await kirimSatu(id);
      } catch (e) {
        if (!berhenti) log(`galat mengirim usulan #${id}`, e instanceof Error ? e.message : e);
      }
    },
    putaran,
    async hentikan() {
      if (berhenti) return;
      berhenti = true;
      if (timer !== null) jadwal.batal(timer);
      timer = null;
      batal.abort();
      await Promise.allSettled([...sedang.values(), putaranJalan]);
    },
  };
}
