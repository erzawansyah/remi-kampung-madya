// Server HTTP + WebSocket. HTTP melayani file client (PWA) dan /healthz;
// WebSocket di /ws membawa pesan protokol meja dalam JSON.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import sirv from 'sirv';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  dataMejaDipulihkan,
  GalatMeja,
  hasilKompetisiMeja,
  JEDA_LANJUT_MS,
  Meja,
  MIN_MAIN_KOMPETISI,
  namaLawanAcak,
  penjadwalNyata,
  periksaUsulan,
  TEKS_LOBI_KOMPETISI_BUBAR,
  validasiPesan,
  type DataMeja,
  type KlasemenKompetisi,
  type Penjadwal,
  type PesanServer,
  type RingkasanAkhir,
  type StatusKompetisi,
  type StatusMeja,
} from '@remi/meja';
import type { PenyimpanRiwayat } from './riwayat.js';
import { bacaDataMeja, type BarisMejaAktif } from './mejaAktif.js';
import { GalatKompetisi, type KeadaanMejaKompetisi } from './kompetisi.js';
import { buatKlienNotion } from './notion.js';
import { jalankanPengirimUsulan, type PengirimUsulan } from './usulan.js';
import { alamatKlien, HEADER_KEAMANAN, kunciIp, originDiizinkan } from './keamanan.js';
import { buatPembatasLog } from './pembatasLog.js';

/**
 * Batas bawaan per jaringan (keputusan pemilik, 13 Okt 2026). Semua HP yang memakai Wi-Fi kedai
 * keluar lewat satu IP publik, jadi batasnya dibuat longgar. Bisa ditimpa lewat env
 * MAKS_MEJA_PER_IP dan MAKS_SAMBUNGAN_PER_IP (lihat main.ts).
 */
export const BAWAAN_MAKS_MEJA_PER_IP = 60;
export const BAWAAN_MAKS_SAMBUNGAN_PER_IP = 150;

/**
 * Jeda sesudah sambungan pemain tertutup sebelum meja diberi tahu ia terputus (keputusan pemilik
 * 24 Okt 2026). Muat ulang halaman, pembaruan otomatis, atau ganti sambungan yang selesai dalam jeda
 * ini tidak dianggap putus: host, suara voting, dan status terhubung tidak berubah. Kalau ia tidak
 * kembali, tenggang di meja tetap dihitung sejak sambungannya tertutup.
 */
export const JEDA_PUTUS_MS = 5_000;

/** Id aksi terakhir yang diingat per pemain (kiriman ulang dengan id yang sama tidak diterapkan lagi). */
export const MAKS_ID_AKSI = 32;

/**
 * Meja di lobi (atau yang permainannya sudah selesai) tanpa manusia terhubung dihapus sesudah sekian ms.
 * Bisa ditimpa lewat `OpsiServer.hapusMejaKosongMs`.
 */
export const BAWAAN_HAPUS_MEJA_KOSONG_MS = 10 * 60_000;
/**
 * Meja yang permainannya sedang berjalan lebih lama: 45 menit (keputusan pemilik 24 Okt 2026), supaya
 * pemain sempat kembali sesudah deploy, Wi-Fi kedai mati, atau HP mati sebentar. Hanya selama masih ada
 * kursi manusia (lihat {@link batasMejaKosongMs}). Bisa ditimpa lewat `OpsiServer.hapusMejaMainKosongMs`.
 */
export const BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS = 45 * 60_000;

/**
 * Perubahan meja ditulis ke database paling lambat sekian ms sesudah perubahan pertama yang belum
 * tersimpan (perubahan di antaranya ikut tulisan yang sama). Saat server dimatikan rapi (SIGTERM), yang
 * belum tersimpan langsung ditulis. Kalau proses mati mendadak, paling banyak perubahan sejauh ini yang hilang.
 */
export const JEDA_SIMPAN_MEJA_MS = 1_000;

/** Simpanan meja yang tidak diperbarui selama ini tidak dipulihkan lagi (server mati lama). */
export const UMUR_MAKS_SIMPANAN_MEJA_MS = 24 * 60 * 60_000;

/**
 * Lama meja tanpa manusia terhubung boleh dibiarkan sebelum dihapus. 45 menit hanya untuk meja yang
 * sedang main dan masih punya kursi manusia (ada yang memegang token dan bisa kembali). Meja yang semua
 * manusianya sudah menekan Keluar tidak bisa didatangi siapa pun lagi, jadi ikut batas lobi.
 */
export function batasMejaKosongMs(
  meja: { status: StatusMeja; adaKursiManusia: boolean },
  opsi: Pick<OpsiServer, 'hapusMejaKosongMs' | 'hapusMejaMainKosongMs'> = {},
): number {
  return meja.status === 'main' && meja.adaKursiManusia
    ? (opsi.hapusMejaMainKosongMs ?? BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS)
    : (opsi.hapusMejaKosongMs ?? BAWAAN_HAPUS_MEJA_KOSONG_MS);
}

export interface OpsiServer {
  port: number;
  host?: string;
  /** Folder hasil build client; kosong = tidak melayani file statis. */
  folderStatis?: string;
  penjadwal?: Penjadwal;
  jedaBotMs?: number;
  /**
   * Jeda lanjut di hasil putaran (ms): host baru bisa memulai putaran berikutnya sesudah sekian ms,
   * atau begitu semua pemain manusia lain yang terhubung menekan Siap. Bawaan JEDA_LANJUT_MS (10 detik);
   * 0 = tanpa jeda.
   */
  jedaLanjutMs?: number;
  /**
   * Meja di lobi (atau yang permainannya sudah selesai) tanpa manusia terhubung dihapus setelah sekian
   * ms. Bawaan {@link BAWAAN_HAPUS_MEJA_KOSONG_MS}.
   */
  hapusMejaKosongMs?: number;
  /**
   * Sama, untuk meja yang permainannya sedang berjalan dan masih punya kursi manusia. Bawaan
   * {@link BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS}.
   */
  hapusMejaMainKosongMs?: number;
  /**
   * Simpan meja yang masih ada ke database `riwayat` (tabel meja_aktif) dan pulihkan saat server mulai,
   * supaya meja selamat dari restart/deploy. Bawaan: ya, kalau `riwayat` ada.
   */
  simpanMeja?: boolean;
  /** Jeda tulis meja ke database (ms). Bawaan {@link JEDA_SIMPAN_MEJA_MS}. */
  jedaSimpanMejaMs?: number;
  maksMeja?: number;
  /**
   * Maksimal meja yang masih ada (termasuk yang sudah ditinggal tapi belum dihapus) per alamat IP
   * pembuatnya. Bawaan {@link BAWAAN_MAKS_MEJA_PER_IP}: pemain di kedai biasanya satu Wi-Fi (satu IP
   * publik), dan meja yang ditinggal baru dihapus ±10 menit (lobi) atau ±45 menit (sedang main)
   * kemudian, jadi jangan terlalu kecil.
   */
  maksMejaPerIp?: number;
  /**
   * Kapan header X-Forwarded-For dipercaya untuk alamat IP pemain:
   * 'lokal' (bawaan) = hanya kalau sambungan datang dari alamat loopback/privat (reverse proxy
   * seperti Caddy di mesin/jaringan yang sama); true = selalu; false = tidak pernah.
   */
  percayaProxy?: boolean | 'lokal';
  /** Pesan per detik per sambungan yang diproses; sisanya dibuang. */
  batasPesanPerDetik?: number;
  /** Lewat sekian pesan dalam satu detik, sambungan diputus (banjir pesan). */
  putusPesanPerDetik?: number;
  /**
   * Asal (Origin) tambahan yang boleh membuka WebSocket, selain yang sehost dengan server:
   * "https://contoh.id" atau "contoh.id"; "*" = semua (cek Origin mati).
   */
  originDiizinkan?: readonly string[];
  /**
   * Maksimal sambungan WebSocket sekaligus per jaringan (IPv4 per alamat, IPv6 per /64). Bawaan
   * {@link BAWAAN_MAKS_SAMBUNGAN_PER_IP}: longgar, karena satu Wi-Fi kedai atau CGNAT operator seluler
   * bisa berbagi satu IP publik.
   */
  maksSambunganPerIp?: number;
  /** /healthz ikut menampilkan jumlah sambungan & galat meja (bawaan: tidak; detailnya ada di log). */
  healthzDetail?: boolean;
  /** Penyimpan klasemen akhir (SQLite). Kosong = tidak disimpan (kompetisi juga tidak aktif). */
  riwayat?: PenyimpanRiwayat;
  /**
   * Jeda sebelum meja kompetisi yang kursinya penuh mulai sendiri (ms). Bawaan JEDA_MULAI_KOMPETISI_MS
   * (2 detik); untuk test.
   */
  jedaMulaiKompetisiMs?: number;
  /** Pengajuan kompetisi yang masih menunggu peserta: maksimal per jaringan (bawaan 3) dan total (bawaan 50). */
  maksPengajuanPerIp?: number;
  maksPengajuan?: number;
  /** Permintaan tulis ke /api/kompetisi per menit per jaringan (bawaan 30). */
  batasTulisKompetisiPerMenit?: number;
  /**
   * Usul fitur diteruskan ke database Notion pemilik (env NOTION_TOKEN dan NOTION_USULAN_DB, lihat
   * main.ts). Kosong = usulan hanya disimpan di database, lalu terkirim begitu Notion diatur dan server
   * dijalankan ulang. Butuh `riwayat`. `fetch` dan `penjadwal` hanya untuk test.
   */
  notion?: { token: string; database: string; fetch?: typeof fetch; penjadwal?: Penjadwal };
  /** Usulan yang diterima per jaringan per jam (bawaan 5) dan total per 24 jam (bawaan 200). */
  maksUsulanPerJamPerIp?: number;
  maksUsulanPerHari?: number;
  /** Jeda sebelum pemain yang sambungannya tertutup dianggap terputus (ms). Bawaan {@link JEDA_PUTUS_MS}. */
  jedaPutusMs?: number;
  log?: (...x: unknown[]) => void;
}

interface Sambungan {
  ws: WebSocket;
  pemainId: string | null;
  kode: string | null;
  hidup: boolean;
  jumlahPesan: number;
  ip: string;
  /** Kunci jaringan untuk batas per IP (lihat kunciIp). */
  jaringan: string;
  /**
   * Sambungan ini sudah digantikan sambungan baru milik pemain yang sama (tautkan). Aksi yang masih
   * datang lewat sini (terkirim sebelum client pindah sambungan) tetap diteruskan ke mejanya, dan
   * jawabannya lewat sambungan baru.
   */
  digantikan?: { pemainId: string; kode: string };
}

export { alamatKlien, alamatLokal, kunciIp, originDiizinkan } from './keamanan.js';

const TEKS_KOMPETISI_TAK_JALAN = 'Kompetisinya sudah selesai atau belum jalan, Bos.';

// Tanpa huruf/angka yang mirip (0/O, 1/I/L).
const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Disuntik esbuild saat build (scripts/bundel.mjs). Saat dev lewat tsx tidak ada, jadi pakai
// versi dari npm (npm run dev:server mengisi npm_package_version) atau 'dev'.
declare const __VERSI_SERVER__: string | undefined;
declare const __SHA_SERVER__: string | undefined;
export const VERSI = typeof __VERSI_SERVER__ === 'string' ? __VERSI_SERVER__ : (process.env.npm_package_version ?? 'dev');
export const SHA = typeof __SHA_SERVER__ === 'string' ? __SHA_SERVER__ : 'dev';

/** Aset Vite di /assets ber-hash di namanya: aman disimpan browser selamanya. */
const CACHE_ASET = 'public, max-age=31536000, immutable';
/** Selain itu (index.html, sw.js, manifest, ikon) harus dicek ulang supaya update cepat sampai. */
const CACHE_LAINNYA = 'no-cache';
/** Isi permintaan POST /api/kompetisi dan /api/usulan paling besar (byte). */
const MAKS_ISI_POST = 4096;
const JAM_MS = 60 * 60_000;
/** Bawaan batas usul fitur: per jaringan per jam, dan total per 24 jam. */
const BAWAAN_MAKS_USULAN_PER_JAM_PER_IP = 5;
const BAWAAN_MAKS_USULAN_PER_HARI = 200;
/** Permintaan POST /api/usulan per menit per jaringan (termasuk yang ditolak), jaga-jaga banjir. */
const BATAS_TULIS_USULAN_PER_MENIT = 20;

/** Penolakan permintaan HTTP yang pesannya boleh ditampilkan ke pemain apa adanya. */
class GalatPermintaan extends Error {
  constructor(
    pesan: string,
    readonly kodeHttp = 400,
  ) {
    super(pesan);
  }
}

/**
 * Baca isi JSON permintaan POST (maksimal MAKS_ISI_POST byte). Rusak/kebesaran = GalatPermintaan.
 * Kebesaran: sisa isinya tidak dibaca lagi, dan jawaban 413 menutup sambungannya (lihat jawabJson).
 */
function bacaJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok, gagal) => {
    const potongan: Buffer[] = [];
    let ukuran = 0;
    req.on('data', (b: Buffer) => {
      ukuran += b.length;
      if (ukuran > MAKS_ISI_POST) {
        req.removeAllListeners('data');
        req.pause();
        gagal(new GalatPermintaan('Isinya kebesaran.', 413));
        return;
      }
      potongan.push(b);
    });
    req.on('error', gagal);
    req.on('end', () => {
      try {
        const x: unknown = JSON.parse(Buffer.concat(potongan).toString('utf8') || '{}');
        if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new Error('bukan objek');
        ok(x as Record<string, unknown>);
      } catch {
        gagal(new GalatPermintaan('Isinya rusak.'));
      }
    });
  });
}

/** Jawaban JSON API tulis. 413 (isi kebesaran, sisanya tidak dibaca) sekalian menutup sambungan. */
function jawabJson(res: ServerResponse, kode: number, isi: unknown): void {
  if (res.headersSent) return;
  res.writeHead(kode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(kode === 413 ? { connection: 'close' } : {}),
  });
  res.end(JSON.stringify(isi));
}

export interface ServerRemi {
  http: Server;
  port: number;
  jumlahMeja(): number;
  /** Jumlah galat yang tertangkap di timer meja (bot, batas waktu) sejak server jalan. */
  jumlahGalatMeja(): number;
  /** Jumlah sambungan WebSocket aktif. */
  jumlahSambungan(): number;
  /** Tutup server: semua sambungan diputus (kode 1001), timer meja dihentikan. Aman dipanggil berulang. */
  tutup(): Promise<void>;
}

export async function jalankanServer(opsi: OpsiServer): Promise<ServerRemi> {
  const log = opsi.log ?? ((...x: unknown[]) => console.log(new Date().toISOString(), ...x));
  const daftarMeja = new Map<string, Meja>();
  const kosongSejak = new Map<string, number>();
  const sambunganPemain = new Map<string, Sambungan>();
  const semuaSambungan = new Set<Sambungan>();
  /** Pemain yang sambungannya tertutup tapi belum dikabarkan terputus ke meja (jeda JEDA_PUTUS_MS). */
  const putusTertunda = new Map<string, { kode: string; timer: unknown; sejak: number }>();
  /** Id aksi terakhir per pemain (kiriman ulang tidak diterapkan dua kali); dibuang bersama mejanya. */
  const idAksi = new Map<string, { kode: string; id: string[] }>();
  /** Kode meja → kunci jaringan pembuatnya (untuk batas meja per IP; IPv6 per /64). */
  const pembuatMeja = new Map<string, string>();
  /** Kode pengajuan kompetisi → kunci jaringan pengajunya (batas pengajuan per IP; hilang saat restart). */
  const pengajuKompetisi = new Map<string, string>();
  /** Permintaan tulis kompetisi per jaringan di menit ini. */
  const tulisKompetisi = new Map<string, number>();
  /** Permintaan POST /api/usulan per jaringan di menit ini. */
  const tulisUsulan = new Map<string, number>();
  /** Jaringan → waktu usulan yang diterima dalam sejam terakhir (hanya di memori, IP tidak disimpan). */
  const usulanPerJaringan = new Map<string, number[]>();
  /** Penerus usul fitur ke Notion; dinyalakan sesudah server jalan (lihat di bawah). */
  let pengirimUsulan: PengirimUsulan | null = null;
  let galatMeja = 0;
  /** true sejak tutup() dipanggil: sambungan & pesan baru tidak dilayani lagi. */
  let menutup = false;
  // Kejadian per sambungan yang bisa dipicu dari luar dicatat dengan jatah (10 baris/menit per jenis).
  const logTerbatas = buatPembatasLog(log);

  // Timer meja (langkah bot, batas waktu giliran, celetukan) berjalan di luar penanganan pesan.
  // Galat di sana tanpa pembungkus jadi uncaughtException dan mematikan proses beserta SEMUA meja.
  // Meja sendiri sudah menangkap galat timernya lalu jalan terus (lapor lewat `saatGalat`, lihat
  // opsiMeja); pembungkus ini jaring terakhir. Keduanya dihitung sebagai galatMeja.
  const penjadwalDasar = opsi.penjadwal ?? penjadwalNyata;
  const penjadwalAman = (kode: string): Penjadwal => ({
    setel: (ms, fn) =>
      penjadwalDasar.setel(ms, () => {
        try {
          fn();
        } catch (e) {
          galatMeja++;
          log(`galat di timer meja ${kode}`, e);
        }
      }),
    batal: (h) => penjadwalDasar.batal(h),
    sekarang: () => penjadwalDasar.sekarang(),
  });

  /** Batalkan kabar "terputus" yang masih ditunda untuk pemain ini. True = ada yang dibatalkan. */
  const batalPutusTertunda = (pemainId: string): boolean => {
    const t = putusTertunda.get(pemainId);
    if (!t) return false;
    putusTertunda.delete(pemainId);
    try {
      penjadwalDasar.batal(t.timer);
    } catch (e) {
      log('galat membatalkan jeda putus', e);
    }
    return true;
  };

  /** Jam kompetisi = jam meja (penjadwal), supaya waktu mulai permainan dan masa kompetisi sebanding. */
  const jam = () => penjadwalDasar.sekarang();

  /**
   * Keadaan meja kompetisi di memori, untuk penyimpan kompetisi (#51 versi 2): meja yang sedang main
   * (juara ditunda sampai semuanya selesai; meja yang dipulihkan sesudah restart ikut dihitung) dan
   * lobi yang menunggu peserta (daftar meja di detail kompetisi).
   */
  const keadaanMeja: KeadaanMejaKompetisi = {
    mejaMain: (kode) => {
      let n = 0;
      for (const m of daftarMeja.values()) if (m.kompetisi === kode && m.status === 'main') n++;
      return n;
    },
    mejaMenunggu: (kode) =>
      [...daftarMeja.values()]
        .filter((m) => m.kompetisi === kode && m.status === 'lobi')
        .map((m) => {
          const r = m.ringkasan();
          return { kode: r.kode, nama: r.namaHost, terisi: r.terisi, jumlahPemain: r.jumlahPemain, pemain: m.namaDuduk() };
        }),
  };

  /** Pesan kompetisiHasil terakhir per meja kompetisi (dikirim lagi ke yang tersambung kembali). */
  const hasilKompetisiTerakhir = new Map<string, PesanServer>();

  // Simpanan meja di database (rencana koneksi langkah 9): meja selamat dari restart/deploy.
  const simpananMeja = opsi.simpanMeja === false ? null : (opsi.riwayat?.mejaAktif ?? null);
  /** Meja yang perubahannya belum ditulis: timer tulis dan data terbaru (referensi hidup dari Meja). */
  const simpanTertunda = new Map<string, { timer: unknown; data: DataMeja }>();

  /**
   * Tulis keadaan meja ke database sekarang. Yang tidak akan dipulihkan juga tidak disimpan (dibuang):
   * permainan yang sudah selesai, dan meja tanpa kursi manusia (tidak ada yang bisa kembali).
   */
  const tulisMeja = (kode: string, data: DataMeja) => {
    if (!simpananMeja) return;
    try {
      if (data.game?.status === 'selesai' || !data.kursi.some((k) => k.jenis === 'manusia')) simpananMeja.hapus(kode);
      else simpananMeja.simpan(kode, JSON.stringify(data), pembuatMeja.get(kode) ?? null, penjadwalDasar.sekarang());
    } catch (e) {
      log(`galat menyimpan meja ${kode}`, e);
    }
  };

  /** Batalkan tulis yang masih ditunda; mengembalikan datanya (kalau ada). */
  const batalSimpan = (kode: string): DataMeja | null => {
    const t = simpanTertunda.get(kode);
    if (!t) return null;
    simpanTertunda.delete(kode);
    try {
      penjadwalDasar.batal(t.timer);
    } catch (e) {
      log('galat membatalkan jeda simpan meja', e);
    }
    return t.data;
  };

  /** Dari `saatBerubah` meja: tulis paling lambat JEDA_SIMPAN_MEJA_MS lagi (perubahan berikutnya ikut). */
  const simpanNanti = (kode: string, data: DataMeja) => {
    if (!simpananMeja || menutup) return;
    // Permainan selesai: simpanannya langsung dibuang. Meja memanggil saatBerubah sebelum saatSelesai,
    // jadi simpanan sudah hilang sebelum klasemen akhir dicatat: meja yang klasemennya sudah tercatat
    // tidak pernah dipulihkan lalu tercatat dua kali.
    if (data.game?.status === 'selesai') {
      batalSimpan(kode);
      tulisMeja(kode, data);
      return;
    }
    const ada = simpanTertunda.get(kode);
    if (ada) {
      ada.data = data;
      return;
    }
    const entri: { timer: unknown; data: DataMeja } = { timer: null, data };
    simpanTertunda.set(kode, entri);
    try {
      entri.timer = penjadwalDasar.setel(opsi.jedaSimpanMejaMs ?? JEDA_SIMPAN_MEJA_MS, () => {
        if (simpanTertunda.get(kode) !== entri) return;
        simpanTertunda.delete(kode);
        if (daftarMeja.has(kode)) tulisMeja(kode, entri.data);
      });
    } catch (e) {
      simpanTertunda.delete(kode);
      log(`galat menjadwalkan simpan meja ${kode}`, e);
      tulisMeja(kode, data);
    }
  };

  /** Tulis semua perubahan yang masih ditunda sekarang juga (server dimatikan). */
  const simpanSemuaSekarang = () => {
    for (const kode of [...simpanTertunda.keys()]) {
      const data = batalSimpan(kode);
      if (data && daftarMeja.has(kode)) tulisMeja(kode, data);
    }
  };

  /**
   * Hapus meja dari server. `buangSimpanan` false hanya saat server dimatikan: simpanannya di database
   * dibiarkan supaya meja dipulihkan saat server jalan lagi.
   */
  const hapusMeja = (kode: string, buangSimpanan = true) => {
    try {
      daftarMeja.get(kode)?.hentikan();
    } catch (e) {
      log(`galat menghentikan meja ${kode}`, e);
    }
    batalSimpan(kode);
    if (buangSimpanan && simpananMeja) {
      try {
        simpananMeja.hapus(kode);
      } catch (e) {
        log(`galat membuang simpanan meja ${kode}`, e);
      }
    }
    daftarMeja.delete(kode);
    kosongSejak.delete(kode);
    pembuatMeja.delete(kode);
    hasilKompetisiTerakhir.delete(kode);
    for (const [pemainId, c] of idAksi) if (c.kode === kode) idAksi.delete(pemainId);
    for (const [pemainId, t] of putusTertunda) if (t.kode === kode) batalPutusTertunda(pemainId);
  };

  /**
   * Bubarkan lobi meja kompetisi yang kompetisinya sudah tidak berjalan (#51 versi 2): pesertanya
   * diberi pesan `keluar` yang ramah, mejanya dihapus. Meja yang sedang main dibiarkan selesai, dan meja
   * yang klasemen akhirnya sedang tampil dibiarkan sampai ditinggal. `hanya` = satu kompetisi saja.
   */
  const bubarkanLobiKompetisi = (hanya?: string) => {
    const penyimpan = opsi.riwayat?.kompetisi;
    if (!penyimpan) return;
    const status = new Map<string, StatusKompetisi | null>();
    for (const [kode, meja] of [...daftarMeja]) {
      const k = meja.kompetisi;
      if (!k || (hanya !== undefined && k !== hanya) || meja.status !== 'lobi') continue;
      try {
        if (!status.has(k)) status.set(k, penyimpan.status(k, jam()));
        if (status.get(k) === 'berjalan') continue;
        meja.bubarkan(TEKS_LOBI_KOMPETISI_BUBAR);
      } catch (e) {
        log(`galat membubarkan lobi kompetisi ${kode}`, e);
      }
      hapusMeja(kode);
      log(`lobi kompetisi meja ${kode} dibubarkan (kompetisi ${k} sudah selesai)`);
    }
  };

  /** Tetapkan juara kompetisi yang sudah berakhir dan tidak punya meja yang masih main. */
  const tetapkanJuara = () => {
    try {
      for (const k of opsi.riwayat?.kompetisi.tetapkanJuara(jam(), keadaanMeja) ?? []) log(`juara kompetisi ${k} ditetapkan`);
    } catch (e) {
      log('galat menetapkan juara kompetisi', e);
    }
  };

  /**
   * Sesudah klasemen akhir meja kompetisi disimpan: kabari kursi manusia di meja itu nilai dan
   * naik-turun peringkatnya (pesan kompetisiHasil), lalu tetapkan juara kalau ini meja terakhir yang
   * main sesudah kompetisinya berakhir.
   */
  const kabarHasilKompetisi = (kodeMeja: string, r: RingkasanAkhir, id: number, sebelum: KlasemenKompetisi | null) => {
    const penyimpan = opsi.riwayat?.kompetisi;
    if (!penyimpan || !r.kompetisi) return;
    try {
      const sesudah = penyimpan.klasemen(r.kompetisi);
      if (!sebelum || !sesudah || penyimpan.jumlahHasil(id) === 0) {
        log(`permainan meja ${kodeMeja} tidak dihitung di kompetisi ${r.kompetisi}`);
      } else {
        const pesan: PesanServer = {
          t: 'kompetisiHasil',
          kompetisi: { kode: r.kompetisi, nama: penyimpan.untukMeja(r.kompetisi, jam())?.nama ?? '' },
          minMain: MIN_MAIN_KOMPETISI,
          jumlahPeringkat: sesudah.peringkat.length,
          pemain: hasilKompetisiMeja(r.pemain, sebelum, sesudah),
        };
        hasilKompetisiTerakhir.set(kodeMeja, pesan);
        daftarMeja.get(kodeMeja)?.kabariManusia(pesan);
      }
    } catch (e) {
      log(`galat mengabarkan hasil kompetisi meja ${kodeMeja}`, e);
    }
    tetapkanJuara();
  };

  /** Catatan id aksi pemain di meja `kode` (dibuat kalau belum ada). */
  const catatanAksi = (pemainId: string, kode: string): string[] => {
    let c = idAksi.get(pemainId);
    if (!c || c.kode !== kode) {
      c = { kode, id: [] };
      idAksi.set(pemainId, c);
    }
    return c.id;
  };

  /**
   * Meja yang permainannya sedang dimainkan: status main dengan paling sedikit satu manusia terhubung.
   * Meja yang ditinggal semua orang (dijeda, dipulihkan tapi belum didatangi, atau tinggal warga kedai)
   * tidak dihitung, supaya skrip deploy yang menunggu angka ini 0 tidak tertahan sampai 45 menit.
   */
  const jumlahMejaMain = () => {
    let n = 0;
    for (const m of daftarMeja.values()) if (m.status === 'main' && m.jumlahManusiaTerhubung > 0) n++;
    return n;
  };

  const statis =
    opsi.folderStatis && existsSync(opsi.folderStatis)
      ? sirv(opsi.folderStatis, { single: true, gzip: true, brotli: true, etag: true })
      : null;

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Header keamanan (CSP, anti-bingkai, dst.) untuk semua respons HTTP; upgrade WebSocket tidak lewat sini.
    for (const [k, v] of Object.entries(HEADER_KEAMANAN)) res.setHeader(k, v);
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://x');
    } catch {
      // Mis. "//[": tanpa ini galatnya tidak tertangkap dan proses server ikut mati.
      res.writeHead(400);
      res.end('Alamat tidak valid');
      return;
    }
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      // Publik: cukup untuk healthcheck & cek versi deploy. Angka operasional (sambungan, galat) hanya
      // dengan HEALTHZ_DETAIL=1; selain itu tercatat di log (ringkasan berkala & tiap galat).
      const isi: Record<string, unknown> = { ok: true, meja: daftarMeja.size, versi: VERSI, sha: SHA };
      // mejaMain: meja yang sedang dimainkan, yaitu status main dengan manusia terhubung (skrip deploy
      // bisa menunggu sampai 0; meja yang ditinggal semua orang tidak ikut dihitung).
      if (opsi.healthzDetail) Object.assign(isi, { sambungan: semuaSambungan.size, galatMeja, mejaMain: jumlahMejaMain() });
      res.end(JSON.stringify(isi));
      return;
    }
    if (url.pathname === '/api/riwayat' || url.pathname === '/api/peringkat') {
      const json = (kode: number, isi: unknown) => {
        res.writeHead(kode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(isi));
      };
      if (req.method !== 'GET') return json(405, { error: 'Hanya GET.' });
      if (!opsi.riwayat) return json(503, { error: 'Riwayat tidak aktif di server ini.' });
      try {
        const q = url.searchParams;
        if (url.pathname === '/api/riwayat') return json(200, opsi.riwayat.daftar(Number(q.get('batas') ?? 30) || 30));
        // Tanpa v=2: array bentuk lama. Aplikasi lama yang masih ter-cache di HP memanggil .map() langsung.
        if (q.get('v') !== '2') return json(200, opsi.riwayat.peringkat());
        // Piala juara kompetisi ikut di baris v2: juara yang sudah bisa ditetapkan ditetapkan dulu.
        tetapkanJuara();
        // Parameter yang tidak sah jatuh ke bawaan (rapikanUrutan/rapikanSaringan), tidak pernah 400.
        return json(
          200,
          opsi.riwayat.papan({
            urut: q.get('urut'),
            saringan: { jumlahPemain: q.get('pemain'), jumlahDeck: q.get('deck'), periode: q.get('periode') },
          }),
        );
      } catch (e) {
        log('galat membaca riwayat', e);
        return json(500, { error: 'Gagal membaca riwayat.' });
      }
    }
    if (url.pathname === '/api/kompetisi' || url.pathname.startsWith('/api/kompetisi/')) {
      void layaniKompetisi(req, res, url);
      return;
    }
    if (url.pathname === '/api/usulan') {
      void layaniUsulan(req, res);
      return;
    }
    if (statis) {
      res.setHeader('cache-control', /^\/assets\/[^/]+\.[a-z0-9]+$/i.test(url.pathname) ? CACHE_ASET : CACHE_LAINNYA);
      return statis(req, res, () => {
        res.writeHead(404, { 'cache-control': 'no-store' });
        res.end('Tidak ditemukan');
      });
    }
    res.writeHead(404);
    res.end('Tidak ditemukan');
  });

  /**
   * API kompetisi (#51):
   * - GET  /api/kompetisi              daftar (pengajuan, berjalan, arsip yang sudah selesai)
   * - GET  /api/kompetisi/KODE         detail + klasemen; header x-tiket-kompetisi = token (opsional)
   * - POST /api/kompetisi              ajukan {nama, masa, pengaturan, namaPengaju} → {kode, token, detail}
   * - POST /api/kompetisi/KODE/ikut    {nama} → {token, detail}
   * - POST /api/kompetisi/KODE/tutup   {token, setuju} → {detail}
   * POST wajib JSON dari asal yang sama (cek Origin), dan dibatasi per jaringan.
   */
  async function layaniKompetisi(req: IncomingMessage, res: ServerResponse, url: URL) {
    const json = (kode: number, isi: unknown) => jawabJson(res, kode, isi);
    const penyimpan = opsi.riwayat?.kompetisi;
    if (!penyimpan) return json(503, { error: 'Kompetisi belum aktif di server ini.' });
    const bagian = url.pathname.split('/').filter(Boolean).slice(2);
    const kode = bagian[0]?.toUpperCase();
    if ((kode && !/^[A-Z0-9]{5}$/.test(kode)) || bagian.length > 2) return json(404, { error: 'Nggak ketemu.' });
    const sekarang = jam();
    try {
      if (req.method === 'GET') {
        if (bagian.length > 1) return json(404, { error: 'Nggak ketemu.' });
        if (!kode) return json(200, { v: 1, kompetisi: penyimpan.daftar(sekarang, keadaanMeja) });
        const tiket = req.headers['x-tiket-kompetisi'];
        const d = penyimpan.detail(kode, sekarang, typeof tiket === 'string' ? tiket.slice(0, 100) : null, keadaanMeja);
        return d ? json(200, d) : json(404, { error: 'Kompetisinya nggak ketemu.' });
      }
      if (req.method !== 'POST') return json(405, { error: 'Hanya GET dan POST.' });
      const percaya = opsi.percayaProxy ?? 'lokal';
      if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '') || !originDiizinkan(req, { percayaProxy: percaya, tambahan: opsi.originDiizinkan })) {
        return json(403, { error: 'Permintaan ditolak.' });
      }
      const jaringan = kunciIp(alamatKlien(req, percaya));
      const kali = (tulisKompetisi.get(jaringan) ?? 0) + 1;
      tulisKompetisi.set(jaringan, kali);
      if (kali > (opsi.batasTulisKompetisiPerMenit ?? 30)) return json(429, { error: 'Pelan-pelan, Bos. Coba lagi semenit lagi.' });
      const isi = await bacaJson(req);
      if (!kode) {
        // Pengajuan yang tercatat di sini tapi sudah jalan/batal tidak dihitung lagi.
        for (const [k] of pengajuKompetisi) if (penyimpan.status(k, sekarang) !== 'pengajuan') pengajuKompetisi.delete(k);
        const dariSini = [...pengajuKompetisi.values()].filter((j) => j === jaringan).length;
        if (dariSini >= (opsi.maksPengajuanPerIp ?? 3)) {
          return json(429, { error: 'Pengajuan dari jaringanmu masih ada yang menunggu peserta. Ajak teman ikut dulu, Bos.' });
        }
        if (penyimpan.jumlahPengajuan(sekarang) >= (opsi.maksPengajuan ?? 50)) return json(429, { error: 'Lagi banyak pengajuan, coba lagi nanti.' });
        const h = penyimpan.ajukan({ nama: isi.nama, masa: isi.masa, pengaturan: isi.pengaturan, namaPengaju: isi.namaPengaju }, sekarang);
        pengajuKompetisi.set(h.kode, jaringan);
        log(`kompetisi ${h.kode} diajukan`);
        return json(200, { ...h, detail: penyimpan.detail(h.kode, sekarang, h.token, keadaanMeja) });
      }
      if (bagian[1] === 'ikut') {
        const sebelum = penyimpan.status(kode, sekarang);
        const h = penyimpan.ikut(kode, isi.nama, sekarang);
        if (sebelum === 'pengajuan' && penyimpan.status(kode, sekarang) === 'berjalan') log(`kompetisi ${kode} mulai`);
        return json(200, { ...h, detail: penyimpan.detail(kode, sekarang, h.token, keadaanMeja) });
      }
      if (bagian[1] === 'tutup') {
        if (typeof isi.token !== 'string' || typeof isi.setuju !== 'boolean') return json(400, { error: 'Isinya rusak.' });
        const sebelum = penyimpan.status(kode, sekarang);
        penyimpan.setujuTutup(kode, isi.token, isi.setuju, sekarang);
        if (sebelum === 'berjalan' && penyimpan.status(kode, sekarang) === 'selesai') {
          log(`kompetisi ${kode} disudahi lewat voting`);
          // Lobi yang menunggu peserta dibubarkan sekarang; meja yang sedang main dibiarkan selesai.
          bubarkanLobiKompetisi(kode);
        }
        return json(200, { detail: penyimpan.detail(kode, sekarang, isi.token, keadaanMeja) });
      }
      return json(404, { error: 'Nggak ketemu.' });
    } catch (e) {
      if (e instanceof GalatKompetisi || e instanceof GalatPermintaan) return json(e.kodeHttp, { error: e.message });
      log('galat kompetisi', e);
      return json(500, { error: 'Ada yang salah di server.' });
    }
  }

  /**
   * POST /api/usulan {nama, judul, isi, jenis?} → {ok: true}. Usul fitur dari game (24 Okt 2026):
   * disimpan di database, lalu langsung diteruskan ke Notion kalau sudah diatur. Penjagaannya sama
   * dengan POST /api/kompetisi (JSON, cek Origin, isi ≤ 4 KB), ditambah batas per jaringan per jam dan
   * batas total per 24 jam. Isinya tidak pernah ditulis ke log.
   */
  async function layaniUsulan(req: IncomingMessage, res: ServerResponse) {
    const json = (kode: number, isi: unknown) => jawabJson(res, kode, isi);
    if (req.method !== 'POST') return json(405, { error: 'Hanya POST.' });
    const penyimpan = opsi.riwayat?.usulan;
    if (!penyimpan) return json(503, { error: 'Usulan belum bisa diterima server ini.' });
    const percaya = opsi.percayaProxy ?? 'lokal';
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '') || !originDiizinkan(req, { percayaProxy: percaya, tambahan: opsi.originDiizinkan })) {
      return json(403, { error: 'Permintaan ditolak.' });
    }
    try {
      const jaringan = kunciIp(alamatKlien(req, percaya));
      const kali = (tulisUsulan.get(jaringan) ?? 0) + 1;
      tulisUsulan.set(jaringan, kali);
      if (kali > BATAS_TULIS_USULAN_PER_MENIT) return json(429, { error: 'Pelan-pelan, Bos. Coba lagi semenit lagi.' });
      const isi = await bacaJson(req);
      // Batas per jam dan per hari dicek sesudah isinya terbaca: dari sini sampai disimpan tidak ada
      // await lagi, jadi dua permintaan yang datang bersamaan tidak bisa sama-sama lolos.
      const sekarang = Date.now();
      const maksPerJam = opsi.maksUsulanPerJamPerIp ?? BAWAAN_MAKS_USULAN_PER_JAM_PER_IP;
      const dariSini = (usulanPerJaringan.get(jaringan) ?? []).filter((t) => sekarang - t < JAM_MS);
      if (dariSini.length >= maksPerJam) {
        return json(429, { error: `Dari jaringanmu sudah masuk ${maksPerJam} usulan dalam sejam. Coba lagi nanti, Bos.` });
      }
      if (penyimpan.jumlahSejak(sekarang - 24 * JAM_MS) >= (opsi.maksUsulanPerHari ?? BAWAAN_MAKS_USULAN_PER_HARI)) {
        return json(429, { error: 'Hari ini usulan yang masuk sudah banyak. Coba lagi besok, Bos.' });
      }
      const hasil = periksaUsulan(isi);
      if (!hasil.ok) return json(400, { error: hasil.pesan });
      const id = penyimpan.simpan(hasil.usulan, sekarang);
      dariSini.push(sekarang);
      usulanPerJaringan.set(jaringan, dariSini);
      log(`usulan #${id} masuk${pengirimUsulan ? '' : ' (Notion belum diatur, disimpan dulu)'}`);
      json(200, { ok: true });
      void pengirimUsulan?.kirimBaru(id);
    } catch (e) {
      if (e instanceof GalatPermintaan) return json(e.kodeHttp, { error: e.message });
      log('galat usulan', e);
      return json(500, { error: 'Ada yang salah di server.' });
    }
  }

  /** Jumlah sambungan WebSocket aktif per kunci jaringan. */
  const sambunganPerJaringan = new Map<string, number>();
  const maksSambunganPerIp = opsi.maksSambunganPerIp ?? BAWAAN_MAKS_SAMBUNGAN_PER_IP;
  let ditolakOrigin = 0;
  let ditolakPenuh = 0;

  const wss = new WebSocketServer({
    server: http,
    path: '/ws',
    maxPayload: 64 * 1024,
    // Kompresi permessage-deflate (dinegosiasikan otomatis; browser dan client lama tanpa dukungan
    // tetap jalan tanpa kompresi). View lengkap dikirim setiap ada perubahan dan isinya hampir sama
    // dengan view sebelumnya, jadi dengan context takeover (bawaan, jangan dimatikan) ukurannya turun
    // ±50×. Di sinyal lemah, antrian view yang menumpuk sempat membuat jawaban ping telat dan
    // sambungan yang masih hidup diputus. Catatan ws: `threshold` hanya berlaku kalau context takeover
    // mati, jadi selama takeover aktif semua pesan dikompres (murah, karena kamusnya terbawa).
    // maxPayload tetap dicek pada ukuran sesudah dibuka.
    perMessageDeflate: { threshold: 1024 },
    // Dipanggil sinkron sebelum handshake selesai: tolak dengan kode HTTP tanpa membuka sambungan.
    verifyClient: (info, jawab) => {
      if (menutup) return jawab(false, 503, 'Server sedang dimatikan');
      if (!originDiizinkan(info.req, { percayaProxy: opsi.percayaProxy ?? 'lokal', tambahan: opsi.originDiizinkan })) {
        // Dicatat sesekali saja supaya log tidak bisa dibanjiri.
        if (ditolakOrigin++ % 100 === 0) log(`handshake ditolak: Origin asing ${JSON.stringify(String(info.origin).slice(0, 100))} (total ${ditolakOrigin})`);
        return jawab(false, 403, 'Origin tidak diizinkan');
      }
      const jaringan = kunciIp(alamatKlien(info.req, opsi.percayaProxy ?? 'lokal'));
      if ((sambunganPerJaringan.get(jaringan) ?? 0) >= maksSambunganPerIp) {
        if (ditolakPenuh++ % 100 === 0) log(`handshake ditolak: ${jaringan} sudah ${maksSambunganPerIp} sambungan (total ${ditolakPenuh})`);
        return jawab(false, 429, 'Kebanyakan sambungan');
      }
      jawab(true);
    },
  });

  const kirim = (pemainId: string, pesan: PesanServer) => {
    const s = sambunganPemain.get(pemainId);
    if (!s) return;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(JSON.stringify(pesan));
    if (pesan.t === 'keluar') {
      sambunganPemain.delete(pemainId);
      s.pemainId = null;
      s.kode = null;
    }
  };

  const kirimKe = (s: Sambungan, pesan: PesanServer) => {
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(JSON.stringify(pesan));
  };

  const buatKode = () => {
    for (;;) {
      const b = randomBytes(5);
      const kode = [...b].map((x) => HURUF_KODE[x % HURUF_KODE.length]).join('');
      if (!daftarMeja.has(kode)) return kode;
    }
  };

  const opsiMeja = (kode: string) => ({
    kode,
    kirim,
    penjadwal: penjadwalAman(kode),
    jedaBotMs: opsi.jedaBotMs,
    jedaLanjutMs: opsi.jedaLanjutMs ?? JEDA_LANJUT_MS,
    jedaMulaiKompetisiMs: opsi.jedaMulaiKompetisiMs,
    // Meja kompetisi: mulai sendiri dan menerima peserta baru hanya selama kompetisinya berjalan.
    kompetisiBerjalan: (k: string) => opsi.riwayat?.kompetisi.status(k, jam()) === 'berjalan',
    buatSeed: () => randomBytes(4).readInt32LE(0),
    // Nama warga kedai: urutan acak per meja, supaya lawan pertama tidak selalu "Kipas Dua".
    namaLawan: namaLawanAcak(),
    // Disimpan ke database (tertunda sebentar) supaya meja selamat dari restart/deploy.
    saatBerubah: (data: DataMeja) => simpanNanti(kode, data),
    saatSelesai: (r: RingkasanAkhir) => {
      if (!opsi.riwayat) return;
      // Meja kompetisi: klasemen kompetisi sebelum permainan ini, untuk naik-turun peringkat.
      let sebelum: KlasemenKompetisi | null = null;
      if (r.kompetisi) {
        try {
          sebelum = opsi.riwayat.kompetisi.klasemen(r.kompetisi);
        } catch (e) {
          log(`galat membaca klasemen kompetisi ${r.kompetisi}`, e);
        }
      }
      let id: number;
      try {
        id = opsi.riwayat.simpan(r);
        log(`klasemen akhir meja ${r.kode} disimpan (#${id})`);
      } catch (e) {
        log('galat menyimpan klasemen akhir', e);
        return;
      }
      if (r.kompetisi) kabarHasilKompetisi(kode, r, id, sebelum);
    },
    // Galat timer yang sudah ditangkap meja (meja tetap jalan): tetap dihitung dan dicatat.
    saatGalat: (konteks: string, e: unknown) => {
      galatMeja++;
      log(`galat di timer meja ${kode} (${konteks})`, e);
    },
  });

  /**
   * Tautkan sambungan `s` ke `pemainId` di meja `kode`, lalu jalankan `masukkan` (buat meja / duduk).
   * Selama `masukkan` berjalan, pesan untuk `pemainId` (mis. 'masuk') sudah diantar ke `s`, tapi
   * keadaan lama belum disentuh. Kalau `masukkan` melempar (meja penuh, sudah mulai), tautan
   * dikembalikan seperti semula: pemain tetap di meja lamanya, tidak dianggap terputus. Baru kalau
   * berhasil, sambungan lama milik `pemainId` ditutup dan meja lama milik `s` diberi tahu terputus.
   */
  const tautkan = (s: Sambungan, pemainId: string, kode: string, masukkan: () => void) => {
    const lama = sambunganPemain.get(pemainId);
    sambunganPemain.set(pemainId, s);
    try {
      masukkan();
    } catch (e) {
      if (lama) sambunganPemain.set(pemainId, lama);
      else sambunganPemain.delete(pemainId);
      throw e;
    }
    // Sudah masuk lagi: kabar "terputus" yang masih ditunda untuknya dibatalkan.
    batalPutusTertunda(pemainId);
    if (lama && lama !== s) {
      // Pemain yang sama membuka sambungan baru: tutup yang lama. Aksi yang masih datang lewat
      // sambungan lama (terkirim sebelum client pindah) tetap diteruskan ke meja yang sama.
      lama.digantikan = { pemainId, kode: lama.kode ?? kode };
      lama.pemainId = null;
      lama.kode = null;
      lama.ws.close(4000, 'Dibuka di tempat lain');
    }
    const idLama = s.pemainId;
    const kodeLama = s.kode;
    s.pemainId = pemainId;
    s.kode = kode;
    if (idLama && idLama !== pemainId) {
      // Lepas dulu tautannya supaya kabar dari meja lama tidak lagi sampai ke sambungan ini.
      if (sambunganPemain.get(idLama) === s) sambunganPemain.delete(idLama);
      try {
        if (kodeLama) daftarMeja.get(kodeLama)?.terputus(idLama);
      } catch (e) {
        log(`galat saat pemain pindah dari meja ${kodeLama}`, e);
      }
    }
  };

  const prosesPesan = (s: Sambungan, mentah: string) => {
    let data: unknown;
    try {
      data = JSON.parse(mentah);
    } catch {
      return kirimKe(s, { t: 'error', pesan: 'Pesan rusak.' });
    }
    const pesan = validasiPesan(data);
    if (!pesan) return kirimKe(s, { t: 'error', pesan: 'Pesan tidak dikenali.' });

    switch (pesan.t) {
      case 'ping':
        // `w` = jam server, supaya client bisa mengoreksi jam HP yang meleset untuk bar waktu giliran.
        return kirimKe(s, { t: 'pong', w: penjadwalDasar.sekarang() });
      case 'daftar':
        return kirimKe(s, {
          t: 'daftar',
          meja: [...daftarMeja.values()]
            // Meja kompetisi tidak pernah masuk daftar publik: duduknya lewat daftar meja di kompetisinya.
            .filter((m) => m.publik && !m.kompetisi && m.status === 'lobi')
            .map((m) => m.ringkasan())
            .filter((r) => r.terisi < r.jumlahPemain),
        });
      case 'buat': {
        if (daftarMeja.size >= (opsi.maksMeja ?? 500)) {
          return kirimKe(s, { t: 'error', pesan: 'Server lagi penuh, coba lagi nanti.' });
        }
        // Satu alamat tidak boleh memenuhi server dengan meja (meja ditinggal baru dihapus 10–45 menit kemudian).
        let dariIpIni = 0;
        for (const ip of pembuatMeja.values()) if (ip === s.jaringan) dariIpIni++;
        if (dariIpIni >= (opsi.maksMejaPerIp ?? BAWAAN_MAKS_MEJA_PER_IP)) {
          return kirimKe(s, { t: 'error', pesan: 'Kebanyakan meja dari jaringanmu, Bos. Pakai meja yang sudah ada atau tunggu sebentar.' });
        }
        // Meja kompetisi (#51): pembuatnya wajib peserta, kompetisinya sedang berjalan.
        let kompetisi: Parameters<typeof Meja.buat>[4];
        let nama = pesan.nama;
        if (pesan.kompetisi) {
          const penyimpan = opsi.riwayat?.kompetisi;
          const k = penyimpan?.untukMeja(pesan.kompetisi.kode, jam());
          const peserta = k && penyimpan!.cekTiket(pesan.kompetisi.kode, pesan.kompetisi.token);
          if (!k || !peserta) return kirimKe(s, { t: 'error', pesan: 'Kamu belum ikut kompetisi ini, Bos.' });
          if (k.status !== 'berjalan') return kirimKe(s, { t: 'error', pesan: TEKS_KOMPETISI_TAK_JALAN });
          kompetisi = { kode: pesan.kompetisi.kode, nama: k.nama, pengaturan: k.pengaturan, peserta: peserta.id };
          // Di meja kompetisi nama kursi = nama peserta yang terdaftar.
          nama = peserta.nama;
        }
        const kode = buatKode();
        const pemainId = randomUUID();
        tautkan(s, pemainId, kode, () => {
          daftarMeja.set(kode, Meja.buat(opsiMeja(kode), pemainId, nama, pesan.pengaturan, kompetisi));
          pembuatMeja.set(kode, s.jaringan);
        });
        // Meja baru belum memanggil saatBerubah: simpan juga, supaya lobinya ikut selamat dari restart.
        const baru = simpananMeja ? daftarMeja.get(kode) : undefined;
        if (baru) simpanNanti(kode, baru.data);
        log(kompetisi ? `meja ${kode} dibuat (kompetisi ${kompetisi.kode})` : `meja ${kode} dibuat`);
        return;
      }
      case 'gabung': {
        const kode = pesan.kode.trim().toUpperCase();
        const meja = daftarMeja.get(kode);
        if (!meja) return kirimKe(s, { t: 'error', pesan: `Meja ${kode} nggak ketemu.` });
        const lama = !!pesan.token && meja.punyaPemain(pesan.token);
        const pemainId = lama ? pesan.token! : randomUUID();
        // Bukti ia sempat putus (untuk sisa waktu minimal di gilirannya): sambungan lamanya masih
        // tercatat di sambungan lain (misalnya setengah mati) atau baru saja tertutup (jeda putus).
        const sambunganLama = lama ? sambunganPemain.get(pemainId) : undefined;
        const gantiSambungan = lama && ((!!sambunganLama && sambunganLama !== s) || putusTertunda.has(pemainId));
        // Kapan sambungan lamanya tertutup (kalau kabar putusnya masih ditunda): meja memakainya untuk
        // tahu apakah pengumuman joker sempat tampil sampai batas waktunya.
        const putusPada = lama ? putusTertunda.get(pemainId)?.sejak : undefined;
        // Meja kompetisi (#51): duduk pakai tiket peserta, dengan nama yang terdaftar.
        let nama = pesan.nama;
        let peserta: number | undefined;
        const kodeKompetisi = meja.kompetisi;
        if (kodeKompetisi && !lama) {
          const tiket = pesan.tiket?.find((t) => t.kode === kodeKompetisi);
          const p = tiket ? opsi.riwayat?.kompetisi.cekTiket(kodeKompetisi, tiket.token) : null;
          if (p) {
            nama = p.nama;
            peserta = p.id;
          }
        }
        try {
          // Gagal (meja penuh / sudah mulai) = tautan dikembalikan; pemain tetap di meja lamanya.
          tautkan(s, pemainId, kode, () => meja.masuk(pemainId, nama, peserta, gantiSambungan, putusPada));
          kosongSejak.delete(kode);
        } catch (e) {
          if (e instanceof GalatMeja) return kirimKe(s, { t: 'error', pesan: e.message });
          throw e;
        }
        // Tersambung kembali saat klasemen akhir meja kompetisi masih tampil: hasil kompetisinya dikirim lagi.
        const hasil = lama && meja.status === 'selesai' ? hasilKompetisiTerakhir.get(kode) : undefined;
        if (hasil) kirim(pemainId, hasil);
        return;
      }
      default: {
        let pemainId = s.pemainId;
        let kode = s.kode;
        // Aksi yang terkirim lewat sambungan lama sebelum client pindah ke sambungan baru: tetap
        // diteruskan ke meja yang sama (diterapkan sekali kalau ber-id), jawabannya lewat sambungan baru.
        if (!pemainId && s.digantikan && pesan.t === 'aksi') ({ pemainId, kode } = s.digantikan);
        const meja = kode ? daftarMeja.get(kode) : undefined;
        const id = pesan.t === 'aksi' ? pesan.id : undefined;
        if (!meja || !pemainId) {
          kirimKe(s, { t: 'error', pesan: 'Kamu belum masuk meja.' });
          if (id !== undefined) kirimKe(s, { t: 'aksiDiterima', id });
          return;
        }
        // Meja kompetisi tidak punya Mulai dan Main lagi (mulai sendiri selama kompetisinya berjalan;
        // meja menolak keduanya sendiri).
        if (id === undefined) return meja.terima(pemainId, pesan);
        // Aksi ber-id: yang sudah pernah diproses tidak diterapkan lagi (kiriman ulang sesudah sambung
        // ulang), tapi tetap dijawab. Jawaban dikirim sesudah meja memproses (error-nya lebih dulu).
        const catatan = catatanAksi(pemainId, meja.kode);
        if (!catatan.includes(id)) {
          catatan.push(id);
          if (catatan.length > MAKS_ID_AKSI) catatan.shift();
          meja.terima(pemainId, pesan);
        }
        return kirim(pemainId, { t: 'aksiDiterima', id });
      }
    }
  };

  // Galat di level server HTTP/WebSocket (bukan per sambungan): catat saja.
  wss.on('error', (e) => log('galat WebSocketServer', e));
  // Permintaan HTTP cacat: tutup soketnya dengan sopan (bawaan Node juga begini, tapi tanpa log).
  http.on('clientError', (_e, soket) => {
    if (soket.writable) soket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    else soket.destroy();
  });

  const batasPesan = opsi.batasPesanPerDetik ?? 30;
  const batasPutus = opsi.putusPesanPerDetik ?? 120;

  wss.on('connection', (ws, req) => {
    if (menutup) {
      // Lolos verifyClient tepat sebelum tutup() dimulai: tolak dengan sopan, jangan didaftarkan.
      ws.on('error', () => undefined);
      ws.close(1001, 'Server dimatikan');
      return;
    }
    const ip = alamatKlien(req, opsi.percayaProxy ?? 'lokal');
    const s: Sambungan = { ws, pemainId: null, kode: null, hidup: true, jumlahPesan: 0, ip, jaringan: kunciIp(ip) };
    semuaSambungan.add(s);
    sambunganPerJaringan.set(s.jaringan, (sambunganPerJaringan.get(s.jaringan) ?? 0) + 1);
    // WAJIB ada: tanpa penangan 'error', frame cacat atau pesan > maxPayload membuat ws memancarkan
    // 'error' tanpa pendengar → uncaughtException → seluruh server mati. Sambungannya sendiri
    // sudah ditutup oleh ws (mis. kode 1009 / 1002).
    ws.on('error', (e) => logTerbatas.catat('galatSambungan', `galat sambungan ${s.ip}: ${(e as Error).message}`));
    ws.on('pong', () => (s.hidup = true));
    ws.on('message', (raw) => {
      // Sambungan yang sedang ditutup (CLOSING) masih bisa memancarkan 'message': jangan sampai
      // pesan 'buat' di jeda itu membuat meja baru yang timernya tidak pernah dihentikan.
      if (menutup) return;
      // Maksimal `batasPesan` pesan per detik per sambungan; banjir pesan = diputus.
      s.jumlahPesan++;
      if (s.jumlahPesan > batasPutus) {
        if (s.jumlahPesan === batasPutus + 1) {
          logTerbatas.catat('banjir', `sambungan ${s.ip} diputus: banjir pesan`);
          ws.close(1008, 'Kebanyakan pesan');
        }
        return;
      }
      if (s.jumlahPesan > batasPesan) return;
      try {
        prosesPesan(s, raw.toString());
      } catch (e) {
        logTerbatas.catat('galatPesan', 'galat memproses pesan', e);
        kirimKe(s, { t: 'error', pesan: 'Ada yang salah di server.' });
      }
    });
    ws.on('close', () => {
      if (semuaSambungan.delete(s)) {
        const sisa = (sambunganPerJaringan.get(s.jaringan) ?? 1) - 1;
        if (sisa > 0) sambunganPerJaringan.set(s.jaringan, sisa);
        else sambunganPerJaringan.delete(s.jaringan);
      }
      if (s.pemainId && sambunganPemain.get(s.pemainId) === s) {
        const pemainId = s.pemainId;
        const kode = s.kode;
        sambunganPemain.delete(pemainId);
        if (!kode) return;
        const kabari = (sejak?: number) => {
          try {
            daftarMeja.get(kode)?.terputus(pemainId, sejak);
          } catch (e) {
            log(`galat saat pemain terputus dari meja ${kode}`, e);
          }
        };
        const jeda = opsi.jedaPutusMs ?? JEDA_PUTUS_MS;
        if (menutup || jeda <= 0) return kabari();
        // Jangan langsung dianggap terputus: muat ulang atau ganti sambungan yang selesai dalam jeda
        // ini tidak memindahkan host dan tidak mencabut suara voting. Kalau ia tidak kembali, tenggang
        // di meja dihitung sejak sambungan ini tertutup.
        try {
          const sejak = penjadwalDasar.sekarang();
          batalPutusTertunda(pemainId);
          const timer = penjadwalDasar.setel(jeda, () => {
            if (putusTertunda.get(pemainId)?.timer !== timer) return;
            putusTertunda.delete(pemainId);
            kabari(sejak);
          });
          putusTertunda.set(pemainId, { kode, timer, sejak });
        } catch (e) {
          log(`galat menjadwalkan jeda putus meja ${kode}`, e);
          kabari();
        }
      }
    });
  });

  const timerPesan = setInterval(() => {
    for (const s of semuaSambungan) s.jumlahPesan = 0;
  }, 1000);
  const timerTulisKompetisi = setInterval(() => tulisKompetisi.clear(), 60_000);
  // Tiap menit: jatah POST /api/usulan per menit diulang, catatan per jam yang sudah lewat dibuang.
  const timerUsulan = setInterval(() => {
    tulisUsulan.clear();
    const sekarang = Date.now();
    for (const [jaringan, waktu] of usulanPerJaringan) {
      const sisa = waktu.filter((t) => sekarang - t < JAM_MS);
      if (sisa.length) usulanPerJaringan.set(jaringan, sisa);
      else usulanPerJaringan.delete(jaringan);
    }
  }, 60_000);

  // Tiap 30 detik: putuskan sambungan yang tidak menjawab ping, hapus meja yang lama kosong.
  // Ringkasan operasional ke log tiap ±10 menit (pengganti angka detail di /healthz), hanya kalau ada isinya.
  let detakBersih = 0;
  let ringkasanTerakhir = '';
  const timerBersih = setInterval(() => {
    if (++detakBersih % 20 === 0) {
      const r =
        `status: meja ${daftarMeja.size} (main ${jumlahMejaMain()}), sambungan ${semuaSambungan.size}, galatMeja ${galatMeja}, ` +
        `ditolak origin ${ditolakOrigin}, ditolak penuh ${ditolakPenuh}, galat sambungan ${logTerbatas.total('galatSambungan')}, ` +
        `diputus banjir ${logTerbatas.total('banjir')}, galat pesan ${logTerbatas.total('galatPesan')}`;
      if (r !== ringkasanTerakhir) log(r);
      ringkasanTerakhir = r;
    }
    for (const s of semuaSambungan) {
      try {
        if (!s.hidup) {
          s.ws.terminate();
          continue;
        }
        s.hidup = false;
        s.ws.ping();
      } catch (e) {
        log('galat ping sambungan', e);
      }
    }
    // Kompetisi yang masanya baru habis: lobinya dibubarkan, juaranya ditetapkan kalau mejanya sudah selesai semua.
    bubarkanLobiKompetisi();
    tetapkanJuara();
    // Jam yang sama dengan meja dan jeda simpan (penjadwal), supaya bisa diuji dengan jam palsu.
    const sekarang = penjadwalDasar.sekarang();
    for (const [kode, meja] of daftarMeja) {
      try {
        if (meja.jumlahManusiaTerhubung > 0) {
          kosongSejak.delete(kode);
          continue;
        }
        const sejak = kosongSejak.get(kode) ?? sekarang;
        kosongSejak.set(kode, sejak);
        // Meja yang sedang main dan masih bisa didatangi pemainnya ditunggu lebih lama (45 menit)
        // daripada lobi, meja selesai, atau meja yang tinggal warga kedai (10 menit).
        if (sekarang - sejak >= batasMejaKosongMs(meja, opsi)) {
          hapusMeja(kode);
          log(`meja ${kode} dihapus (kosong)`);
        }
      } catch (e) {
        log(`galat membersihkan meja ${kode}`, e);
      }
    }
  }, 30_000);

  /**
   * Pulihkan satu meja dari simpanannya. Null = berhasil; selain itu alasan (untuk log) kenapa
   * simpanannya dibuang. Semua kursi manusia dianggap terputus (dataMejaDipulihkan), jadi meja dijeda
   * sampai ada yang kembali lewat `gabung` dengan tokennya; timer meja disusun ulang saat itu.
   */
  const pulihkanSatu = (b: BarisMejaAktif): string | null => {
    const kode = b.kode;
    if (!/^[A-Z0-9]{5}$/.test(kode)) return 'kode tidak sah';
    if (daftarMeja.has(kode)) return 'kode sudah dipakai';
    if (penjadwalDasar.sekarang() - b.diperbaruiPada > UMUR_MAKS_SIMPANAN_MEJA_MS) return 'sudah terlalu lama tidak berubah';
    const terbaca = bacaDataMeja(b.data, kode);
    if (typeof terbaca === 'string') return `rusak (${terbaca})`;
    // Klasemen akhirnya sudah tercatat sebelum server mati: jangan dipulihkan (tidak tercatat dua kali).
    if (terbaca.game?.status === 'selesai') return 'permainannya sudah selesai';
    if (!terbaca.kursi.some((k) => k.jenis === 'manusia')) return 'tidak ada pemain manusia lagi';
    if (terbaca.kompetisi) {
      // Meja kompetisi (#51): kompetisinya harus masih ada. Permainan yang sedang jalan dibiarkan
      // selesai (dihitung kalau dimulai selagi kompetisinya berjalan, lihat catatHasil; selama ia main,
      // juara kompetisinya ditunda); meja yang masih di lobi tidak bisa mulai lagi kalau kompetisinya
      // sudah tidak berjalan, jadi dibuang.
      const k = opsi.riwayat?.kompetisi.untukMeja(terbaca.kompetisi.kode, jam());
      if (!k) return `kompetisi ${terbaca.kompetisi.kode} sudah tidak ada`;
      if (!terbaca.game && k.status !== 'berjalan') return `kompetisi ${terbaca.kompetisi.kode} sudah tidak berjalan`;
    }
    let meja: Meja;
    try {
      meja = new Meja(opsiMeja(kode), dataMejaDipulihkan(terbaca));
    } catch (e) {
      log(`galat memulihkan meja ${kode}`, e);
      return 'rusak (meja tidak bisa dibuat)';
    }
    try {
      meja.ringkasan();
      meja.info(0);
    } catch (e) {
      meja.hentikan();
      log(`galat memulihkan meja ${kode}`, e);
      return 'rusak (meja tidak bisa dibaca)';
    }
    daftarMeja.set(kode, meja);
    if (b.pembuatJaringan) pembuatMeja.set(kode, b.pembuatJaringan);
    // Batas hapus meja kosong dihitung sejak server jalan lagi.
    kosongSejak.set(kode, penjadwalDasar.sekarang());
    const manusia = terbaca.kursi.filter((k) => k.jenis === 'manusia').length;
    log(`meja ${kode} dipulihkan (${meja.status}, ${manusia} manusia${terbaca.kompetisi ? `, kompetisi ${terbaca.kompetisi.kode}` : ''})`);
    return null;
  };

  // Meja yang tersimpan sebelum restart/deploy dipulihkan sebelum server menerima sambungan, jadi
  // pemain yang menyambung ulang dengan tokennya langsung kembali ke kursinya.
  if (simpananMeja) {
    let baris: BarisMejaAktif[] = [];
    try {
      baris = simpananMeja.semua();
    } catch (e) {
      log('galat membaca simpanan meja', e);
    }
    let pulih = 0;
    for (const b of baris) {
      let alasan: string | null;
      try {
        alasan = pulihkanSatu(b);
      } catch (e) {
        log(`galat memulihkan meja ${b.kode}`, e);
        alasan = 'galat';
      }
      if (alasan === null) {
        pulih++;
        continue;
      }
      log(`simpanan meja ${b.kode} dibuang: ${alasan}`);
      try {
        simpananMeja.hapus(b.kode);
      } catch (e) {
        log(`galat membuang simpanan meja ${b.kode}`, e);
      }
    }
    if (baris.length) log(`${pulih} dari ${baris.length} meja tersimpan dipulihkan`);
  }

  await new Promise<void>((ok, gagal) => {
    http.once('error', gagal);
    http.listen(opsi.port, opsi.host ?? '0.0.0.0', () => {
      http.off('error', gagal);
      ok();
    });
  });
  // Setelah jalan, galat server HTTP (jarang) cukup dicatat, jangan sampai jadi 'error' tanpa pendengar.
  http.on('error', (e) => log('galat server HTTP', e));
  // Penerus usul fitur ke Notion: hanya kalau token dan id database diisi, dan database riwayat ada.
  // Dinyalakan di sini (bukan sebelum listen) supaya timernya tidak tertinggal kalau port gagal dibuka.
  if (opsi.notion && opsi.riwayat) {
    pengirimUsulan = jalankanPengirimUsulan({
      penyimpan: opsi.riwayat.usulan,
      notion: buatKlienNotion({ token: opsi.notion.token, database: opsi.notion.database, fetch: opsi.notion.fetch }),
      log,
      penjadwal: opsi.notion.penjadwal,
    });
  }
  const alamat = http.address();
  const port = typeof alamat === 'object' && alamat ? alamat.port : opsi.port;

  let penutupan: Promise<void> | null = null;
  return {
    http,
    port,
    jumlahMeja: () => daftarMeja.size,
    jumlahGalatMeja: () => galatMeja,
    jumlahSambungan: () => semuaSambungan.size,
    tutup: () =>
      (penutupan ??= (async () => {
        menutup = true;
        clearInterval(timerPesan);
        clearInterval(timerBersih);
        clearInterval(timerTulisKompetisi);
        for (const pemainId of [...putusTertunda.keys()]) batalPutusTertunda(pemainId);
        // Perubahan yang belum tersimpan ditulis sekarang; simpanan meja di database tidak dibuang,
        // supaya meja dipulihkan saat server jalan lagi (restart/deploy). Jangan taruh `await` apa pun
        // di depannya: sejak `menutup`, perubahan meja tidak dijadwalkan simpan lagi, jadi perubahan
        // selama menunggu (misalnya langkah warga kedai) bisa hilang.
        simpanSemuaSekarang();
        for (const kode of [...daftarMeja.keys()]) hapusMeja(kode, false);
        clearInterval(timerUsulan);
        // Pengirim usulan berhenti (timer + permintaan yang sedang jalan) sebelum database ditutup.
        await pengirimUsulan?.hentikan();
        // 1001 "going away": client tahu server pergi (bukan ditolak) dan bisa mencoba lagi nanti.
        for (const s of semuaSambungan) {
          try {
            s.ws.close(1001, 'Server dimatikan');
          } catch {
            s.ws.terminate();
          }
        }
        // Yang tidak menjawab salam penutup dalam 1 detik diputus paksa.
        const paksa = setTimeout(() => wss.clients.forEach((ws) => ws.terminate()), 1000);
        await new Promise<void>((ok) => wss.close(() => ok()));
        clearTimeout(paksa);
        // Jaring pengaman: meja apa pun yang sempat muncul selama penutupan ikut dihentikan.
        for (const kode of [...daftarMeja.keys()]) hapusMeja(kode, false);
        await new Promise<void>((ok) => {
          http.close(() => ok());
          // Sambungan HTTP keep-alive (aset PWA) jangan sampai menahan penutupan.
          http.closeAllConnections();
        });
      })()),
  };
}
