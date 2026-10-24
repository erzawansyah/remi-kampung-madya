// Server HTTP + WebSocket. HTTP melayani file client (PWA) dan /healthz;
// WebSocket di /ws membawa pesan protokol meja dalam JSON.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import sirv from 'sirv';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  GalatMeja,
  JEDA_LANJUT_MS,
  Meja,
  namaLawanAcak,
  penjadwalNyata,
  validasiPesan,
  type Penjadwal,
  type PesanServer,
  type RingkasanAkhir,
} from '@remi/meja';
import type { PenyimpanRiwayat } from './riwayat.js';
import { GalatKompetisi } from './kompetisi.js';
import { alamatKlien, HEADER_KEAMANAN, kunciIp, originDiizinkan } from './keamanan.js';
import { buatPembatasLog } from './pembatasLog.js';

/**
 * Batas bawaan per jaringan (keputusan pemilik, 13 Okt 2026). Semua HP yang memakai Wi-Fi kedai
 * keluar lewat satu IP publik, jadi batasnya dibuat longgar. Bisa ditimpa lewat env
 * MAKS_MEJA_PER_IP dan MAKS_SAMBUNGAN_PER_IP (lihat main.ts).
 */
export const BAWAAN_MAKS_MEJA_PER_IP = 60;
export const BAWAAN_MAKS_SAMBUNGAN_PER_IP = 150;

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
  /** Meja tanpa manusia terhubung dihapus setelah sekian ms. */
  hapusMejaKosongMs?: number;
  maksMeja?: number;
  /**
   * Maksimal meja yang masih ada (termasuk yang sudah ditinggal tapi belum dihapus) per alamat IP
   * pembuatnya. Bawaan {@link BAWAAN_MAKS_MEJA_PER_IP}: pemain di kedai biasanya satu Wi-Fi (satu IP
   * publik), dan meja yang ditinggal baru dihapus ±10 menit kemudian, jadi jangan terlalu kecil.
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
  /** Pengajuan kompetisi yang masih menunggu peserta: maksimal per jaringan (bawaan 3) dan total (bawaan 50). */
  maksPengajuanPerIp?: number;
  maksPengajuan?: number;
  /** Permintaan tulis ke /api/kompetisi per menit per jaringan (bawaan 30). */
  batasTulisKompetisiPerMenit?: number;
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
/** Isi permintaan POST /api/kompetisi paling besar (byte). */
const MAKS_ISI_POST = 4096;

/** Baca isi JSON permintaan POST (maksimal MAKS_ISI_POST byte). Rusak/kebesaran = GalatKompetisi. */
function bacaJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok, gagal) => {
    const potongan: Buffer[] = [];
    let ukuran = 0;
    req.on('data', (b: Buffer) => {
      ukuran += b.length;
      if (ukuran > MAKS_ISI_POST) {
        gagal(new GalatKompetisi('Isinya kebesaran.', 413));
        req.destroy();
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
        gagal(new GalatKompetisi('Isinya rusak.'));
      }
    });
  });
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
  /** Kode meja → kunci jaringan pembuatnya (untuk batas meja per IP; IPv6 per /64). */
  const pembuatMeja = new Map<string, string>();
  /** Kode pengajuan kompetisi → kunci jaringan pengajunya (batas pengajuan per IP; hilang saat restart). */
  const pengajuKompetisi = new Map<string, string>();
  /** Permintaan tulis kompetisi per jaringan di menit ini. */
  const tulisKompetisi = new Map<string, number>();
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

  const hapusMeja = (kode: string) => {
    try {
      daftarMeja.get(kode)?.hentikan();
    } catch (e) {
      log(`galat menghentikan meja ${kode}`, e);
    }
    daftarMeja.delete(kode);
    kosongSejak.delete(kode);
    pembuatMeja.delete(kode);
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
      if (opsi.healthzDetail) Object.assign(isi, { sambungan: semuaSambungan.size, galatMeja });
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
    const json = (kode: number, isi: unknown) => {
      if (res.headersSent) return;
      res.writeHead(kode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(isi));
    };
    const penyimpan = opsi.riwayat?.kompetisi;
    if (!penyimpan) return json(503, { error: 'Kompetisi belum aktif di server ini.' });
    const bagian = url.pathname.split('/').filter(Boolean).slice(2);
    const kode = bagian[0]?.toUpperCase();
    if ((kode && !/^[A-Z0-9]{5}$/.test(kode)) || bagian.length > 2) return json(404, { error: 'Nggak ketemu.' });
    const sekarang = Date.now();
    try {
      if (req.method === 'GET') {
        if (bagian.length > 1) return json(404, { error: 'Nggak ketemu.' });
        if (!kode) return json(200, { v: 1, kompetisi: penyimpan.daftar(sekarang) });
        const tiket = req.headers['x-tiket-kompetisi'];
        const d = penyimpan.detail(kode, sekarang, typeof tiket === 'string' ? tiket.slice(0, 100) : null);
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
        return json(200, { ...h, detail: penyimpan.detail(h.kode, sekarang, h.token) });
      }
      if (bagian[1] === 'ikut') {
        const sebelum = penyimpan.status(kode, sekarang);
        const h = penyimpan.ikut(kode, isi.nama, sekarang);
        if (sebelum === 'pengajuan' && penyimpan.status(kode, sekarang) === 'berjalan') log(`kompetisi ${kode} mulai`);
        return json(200, { ...h, detail: penyimpan.detail(kode, sekarang, h.token) });
      }
      if (bagian[1] === 'tutup') {
        if (typeof isi.token !== 'string' || typeof isi.setuju !== 'boolean') return json(400, { error: 'Isinya rusak.' });
        penyimpan.setujuTutup(kode, isi.token, isi.setuju, sekarang);
        if (penyimpan.status(kode, sekarang) === 'selesai') log(`kompetisi ${kode} disudahi lewat voting`);
        return json(200, { detail: penyimpan.detail(kode, sekarang, isi.token) });
      }
      return json(404, { error: 'Nggak ketemu.' });
    } catch (e) {
      if (e instanceof GalatKompetisi) return json(e.kodeHttp, { error: e.message });
      log('galat kompetisi', e);
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
    buatSeed: () => randomBytes(4).readInt32LE(0),
    // Nama warga kedai: urutan acak per meja, supaya lawan pertama tidak selalu "Kipas Dua".
    namaLawan: namaLawanAcak(),
    saatSelesai: (r: RingkasanAkhir) => {
      if (!opsi.riwayat) return;
      try {
        const id = opsi.riwayat.simpan(r);
        log(`klasemen akhir meja ${r.kode} disimpan (#${id})`);
      } catch (e) {
        log('galat menyimpan klasemen akhir', e);
      }
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
    if (lama && lama !== s) {
      // Pemain yang sama membuka sambungan baru: tutup yang lama.
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
        return kirimKe(s, { t: 'pong' });
      case 'daftar':
        return kirimKe(s, {
          t: 'daftar',
          meja: [...daftarMeja.values()]
            .filter((m) => m.publik && m.status === 'lobi')
            .map((m) => m.ringkasan())
            .filter((r) => r.terisi < r.jumlahPemain),
        });
      case 'buat': {
        if (daftarMeja.size >= (opsi.maksMeja ?? 500)) {
          return kirimKe(s, { t: 'error', pesan: 'Server lagi penuh, coba lagi nanti.' });
        }
        // Satu alamat tidak boleh memenuhi server dengan meja (meja ditinggal baru dihapus ~10 menit kemudian).
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
          const k = penyimpan?.untukMeja(pesan.kompetisi.kode, Date.now());
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
        log(kompetisi ? `meja ${kode} dibuat (kompetisi ${kompetisi.kode})` : `meja ${kode} dibuat`);
        return;
      }
      case 'gabung': {
        const kode = pesan.kode.trim().toUpperCase();
        const meja = daftarMeja.get(kode);
        if (!meja) return kirimKe(s, { t: 'error', pesan: `Meja ${kode} nggak ketemu.` });
        const lama = !!pesan.token && meja.punyaPemain(pesan.token);
        const pemainId = lama ? pesan.token! : randomUUID();
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
          tautkan(s, pemainId, kode, () => meja.masuk(pemainId, nama, peserta));
          kosongSejak.delete(kode);
        } catch (e) {
          if (e instanceof GalatMeja) return kirimKe(s, { t: 'error', pesan: e.message });
          throw e;
        }
        return;
      }
      default: {
        const meja = s.kode ? daftarMeja.get(s.kode) : undefined;
        if (!meja || !s.pemainId) return kirimKe(s, { t: 'error', pesan: 'Kamu belum masuk meja.' });
        // Meja kompetisi: permainan baru hanya selama kompetisinya berjalan (yang sedang jalan dibiarkan selesai).
        if ((pesan.t === 'mulai' || pesan.t === 'mainLagi') && meja.kompetisi) {
          const status = opsi.riwayat?.kompetisi.status(meja.kompetisi, Date.now());
          if (status !== 'berjalan') return kirimKe(s, { t: 'error', pesan: TEKS_KOMPETISI_TAK_JALAN });
        }
        meja.terima(s.pemainId, pesan);
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
        sambunganPemain.delete(s.pemainId);
        try {
          if (s.kode) daftarMeja.get(s.kode)?.terputus(s.pemainId);
        } catch (e) {
          log(`galat saat pemain terputus dari meja ${s.kode}`, e);
        }
      }
    });
  });

  const timerPesan = setInterval(() => {
    for (const s of semuaSambungan) s.jumlahPesan = 0;
  }, 1000);
  const timerTulisKompetisi = setInterval(() => tulisKompetisi.clear(), 60_000);

  // Tiap 30 detik: putuskan sambungan yang tidak menjawab ping, hapus meja yang lama kosong.
  // Ringkasan operasional ke log tiap ±10 menit (pengganti angka detail di /healthz), hanya kalau ada isinya.
  let detakBersih = 0;
  let ringkasanTerakhir = '';
  const timerBersih = setInterval(() => {
    if (++detakBersih % 20 === 0) {
      const r =
        `status: meja ${daftarMeja.size}, sambungan ${semuaSambungan.size}, galatMeja ${galatMeja}, ` +
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
    const sekarang = Date.now();
    const batas = opsi.hapusMejaKosongMs ?? 10 * 60_000;
    for (const [kode, meja] of daftarMeja) {
      try {
        if (meja.jumlahManusiaTerhubung > 0) {
          kosongSejak.delete(kode);
          continue;
        }
        const sejak = kosongSejak.get(kode) ?? sekarang;
        kosongSejak.set(kode, sejak);
        if (sekarang - sejak >= batas) {
          hapusMeja(kode);
          log(`meja ${kode} dihapus (kosong)`);
        }
      } catch (e) {
        log(`galat membersihkan meja ${kode}`, e);
      }
    }
  }, 30_000);

  await new Promise<void>((ok, gagal) => {
    http.once('error', gagal);
    http.listen(opsi.port, opsi.host ?? '0.0.0.0', () => {
      http.off('error', gagal);
      ok();
    });
  });
  // Setelah jalan, galat server HTTP (jarang) cukup dicatat, jangan sampai jadi 'error' tanpa pendengar.
  http.on('error', (e) => log('galat server HTTP', e));
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
        for (const kode of [...daftarMeja.keys()]) hapusMeja(kode);
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
        for (const kode of [...daftarMeja.keys()]) hapusMeja(kode);
        await new Promise<void>((ok) => {
          http.close(() => ok());
          // Sambungan HTTP keep-alive (aset PWA) jangan sampai menahan penutupan.
          http.closeAllConnections();
        });
      })()),
  };
}
