// Server HTTP + WebSocket. HTTP melayani file client (PWA) dan /healthz;
// WebSocket di /ws membawa pesan protokol meja dalam JSON.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import sirv from 'sirv';
import { WebSocketServer, type WebSocket } from 'ws';
import { GalatMeja, Meja, validasiPesan, type Penjadwal, type PesanServer, type RingkasanAkhir } from '@remi/meja';
import type { PenyimpanRiwayat } from './riwayat.js';

export interface OpsiServer {
  port: number;
  host?: string;
  /** Folder hasil build client; kosong = tidak melayani file statis. */
  folderStatis?: string;
  penjadwal?: Penjadwal;
  jedaBotMs?: number;
  /** Meja tanpa manusia terhubung dihapus setelah sekian ms. */
  hapusMejaKosongMs?: number;
  maksMeja?: number;
  /** Penyimpan klasemen akhir (SQLite). Kosong = tidak disimpan. */
  riwayat?: PenyimpanRiwayat;
  log?: (...x: unknown[]) => void;
}

interface Sambungan {
  ws: WebSocket;
  pemainId: string | null;
  kode: string | null;
  hidup: boolean;
  jumlahPesan: number;
}

// Tanpa huruf/angka yang mirip (0/O, 1/I/L).
const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface ServerRemi {
  http: Server;
  port: number;
  jumlahMeja(): number;
  tutup(): Promise<void>;
}

export async function jalankanServer(opsi: OpsiServer): Promise<ServerRemi> {
  const log = opsi.log ?? ((...x: unknown[]) => console.log(new Date().toISOString(), ...x));
  const daftarMeja = new Map<string, Meja>();
  const kosongSejak = new Map<string, number>();
  const sambunganPemain = new Map<string, Sambungan>();

  const statis =
    opsi.folderStatis && existsSync(opsi.folderStatis)
      ? sirv(opsi.folderStatis, { single: true, gzip: true, brotli: true, etag: true })
      : null;

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, meja: daftarMeja.size }));
      return;
    }
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/riwayat' || url.pathname === '/api/peringkat') {
      const json = (kode: number, isi: unknown) => {
        res.writeHead(kode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(isi));
      };
      if (req.method !== 'GET') return json(405, { error: 'Hanya GET.' });
      if (!opsi.riwayat) return json(503, { error: 'Riwayat tidak aktif di server ini.' });
      try {
        if (url.pathname === '/api/riwayat') return json(200, opsi.riwayat.daftar(Number(url.searchParams.get('batas') ?? 30) || 30));
        return json(200, opsi.riwayat.peringkat());
      } catch (e) {
        log('galat membaca riwayat', e);
        return json(500, { error: 'Gagal membaca riwayat.' });
      }
    }
    if (statis) return statis(req, res, () => {
      res.writeHead(404);
      res.end('Tidak ditemukan');
    });
    res.writeHead(404);
    res.end('Tidak ditemukan');
  });

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 64 * 1024 });

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
    penjadwal: opsi.penjadwal,
    jedaBotMs: opsi.jedaBotMs,
    buatSeed: () => randomBytes(4).readInt32LE(0),
    saatSelesai: (r: RingkasanAkhir) => {
      if (!opsi.riwayat) return;
      try {
        const id = opsi.riwayat.simpan(r);
        log(`klasemen akhir meja ${r.kode} disimpan (#${id})`);
      } catch (e) {
        log('galat menyimpan klasemen akhir', e);
      }
    },
  });

  const tautkan = (s: Sambungan, pemainId: string, kode: string) => {
    const lama = sambunganPemain.get(pemainId);
    if (lama && lama !== s) {
      // Pemain yang sama membuka sambungan baru: tutup yang lama.
      lama.pemainId = null;
      lama.kode = null;
      lama.ws.close(4000, 'Dibuka di tempat lain');
    }
    if (s.pemainId && s.pemainId !== pemainId && s.kode) {
      daftarMeja.get(s.kode)?.terputus(s.pemainId);
      sambunganPemain.delete(s.pemainId);
    }
    s.pemainId = pemainId;
    s.kode = kode;
    sambunganPemain.set(pemainId, s);
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
        const kode = buatKode();
        const pemainId = randomUUID();
        tautkan(s, pemainId, kode);
        const meja = Meja.buat(opsiMeja(kode), pemainId, pesan.nama, pesan.pengaturan);
        daftarMeja.set(kode, meja);
        log(`meja ${kode} dibuat`);
        return;
      }
      case 'gabung': {
        const kode = pesan.kode.trim().toUpperCase();
        const meja = daftarMeja.get(kode);
        if (!meja) return kirimKe(s, { t: 'error', pesan: `Meja ${kode} nggak ketemu.` });
        const pemainId = pesan.token && meja.punyaPemain(pesan.token) ? pesan.token : randomUUID();
        const sebelumnya = { pemainId: s.pemainId, kode: s.kode };
        tautkan(s, pemainId, kode);
        try {
          meja.masuk(pemainId, pesan.nama);
          kosongSejak.delete(kode);
        } catch (e) {
          sambunganPemain.delete(pemainId);
          s.pemainId = sebelumnya.pemainId;
          s.kode = sebelumnya.kode;
          if (e instanceof GalatMeja) return kirimKe(s, { t: 'error', pesan: e.message });
          throw e;
        }
        return;
      }
      default: {
        const meja = s.kode ? daftarMeja.get(s.kode) : undefined;
        if (!meja || !s.pemainId) return kirimKe(s, { t: 'error', pesan: 'Kamu belum masuk meja.' });
        meja.terima(s.pemainId, pesan);
      }
    }
  };

  const semuaSambungan = new Set<Sambungan>();

  wss.on('connection', (ws) => {
    const s: Sambungan = { ws, pemainId: null, kode: null, hidup: true, jumlahPesan: 0 };
    semuaSambungan.add(s);
    ws.on('pong', () => (s.hidup = true));
    ws.on('message', (raw) => {
      // Batas sederhana: maksimal 30 pesan per detik per sambungan.
      if (++s.jumlahPesan > 30) return;
      try {
        prosesPesan(s, raw.toString());
      } catch (e) {
        log('galat memproses pesan', e);
        kirimKe(s, { t: 'error', pesan: 'Ada yang salah di server.' });
      }
    });
    ws.on('close', () => {
      semuaSambungan.delete(s);
      if (s.pemainId && sambunganPemain.get(s.pemainId) === s) {
        sambunganPemain.delete(s.pemainId);
        if (s.kode) daftarMeja.get(s.kode)?.terputus(s.pemainId);
      }
    });
  });

  const timerPesan = setInterval(() => {
    for (const s of semuaSambungan) s.jumlahPesan = 0;
  }, 1000);

  // Tiap 30 detik: putuskan sambungan yang tidak menjawab ping, hapus meja yang lama kosong.
  const timerBersih = setInterval(() => {
    for (const s of semuaSambungan) {
      if (!s.hidup) {
        s.ws.terminate();
        continue;
      }
      s.hidup = false;
      s.ws.ping();
    }
    const sekarang = Date.now();
    const batas = opsi.hapusMejaKosongMs ?? 10 * 60_000;
    for (const [kode, meja] of daftarMeja) {
      if (meja.jumlahManusiaTerhubung > 0) {
        kosongSejak.delete(kode);
        continue;
      }
      const sejak = kosongSejak.get(kode) ?? sekarang;
      kosongSejak.set(kode, sejak);
      if (sekarang - sejak >= batas) {
        meja.hentikan();
        daftarMeja.delete(kode);
        kosongSejak.delete(kode);
        log(`meja ${kode} dihapus (kosong)`);
      }
    }
  }, 30_000);

  await new Promise<void>((ok) => http.listen(opsi.port, opsi.host ?? '0.0.0.0', ok));
  const alamat = http.address();
  const port = typeof alamat === 'object' && alamat ? alamat.port : opsi.port;

  return {
    http,
    port,
    jumlahMeja: () => daftarMeja.size,
    tutup: async () => {
      clearInterval(timerPesan);
      clearInterval(timerBersih);
      for (const m of daftarMeja.values()) m.hentikan();
      wss.clients.forEach((ws) => ws.terminate());
      await new Promise<void>((ok) => wss.close(() => ok()));
      await new Promise<void>((ok) => http.close(() => ok()));
    },
  };
}
