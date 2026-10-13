// Ketahanan server produksi: pesan jahat/rusak, banjir pesan, galat di timer meja, batas meja per IP,
// penutupan (SIGTERM), dan penjaga proses. Semua kasus di sini dulu bisa mematikan proses atau
// memenuhi server.

import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { Penjadwal } from '@remi/meja';
import { alamatKlien, alamatLokal, jalankanServer, type OpsiServer, type ServerRemi } from '../src/server.js';
import { normalkanEntriXff } from '../src/keamanan.js';
import { buatPembatasLog } from '../src/pembatasLog.js';
import { pasangPenjagaProses } from '../src/penjaga.js';

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

let server: ServerRemi | null = null;
const log: unknown[][] = [];
async function nyalakan(opsi: Partial<OpsiServer> = {}) {
  server = await jalankanServer({ port: 0, host: '127.0.0.1', jedaBotMs: 5, log: (...x) => log.push(x), ...opsi });
  return server;
}
afterEach(async () => {
  await server?.tutup();
  server = null;
  log.length = 0;
});

interface Klien {
  ws: WebSocket;
  pesan: { t: string; [k: string]: unknown }[];
  tutup: Promise<{ kode: number; alasan: string }>;
  kirim(x: unknown): void;
}
async function klien(port: number): Promise<Klien> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const pesan: Klien['pesan'] = [];
  ws.on('message', (d) => pesan.push(JSON.parse(d.toString())));
  ws.on('error', () => undefined);
  const tutup = new Promise<{ kode: number; alasan: string }>((ok) => ws.on('close', (kode, alasan) => ok({ kode, alasan: alasan.toString() })));
  await new Promise((ok) => ws.on('open', ok));
  return { ws, pesan, tutup, kirim: (x) => ws.send(typeof x === 'string' ? x : JSON.stringify(x)) };
}
async function tungguPesan(k: Klien, syarat: (p: Klien['pesan'][number]) => boolean, ms = 3000) {
  const mulai = Date.now();
  for (;;) {
    const p = k.pesan.find(syarat);
    if (p) return p;
    if (Date.now() - mulai > ms) throw new Error('pesan tidak datang');
    await tunggu(10);
  }
}
const sehat = async (port: number) => (await fetch(`http://127.0.0.1:${port}/healthz`)).json() as Promise<Record<string, unknown>>;

describe('server tetap hidup', () => {
  it('pesan lebih besar dari maxPayload: sambungan ditutup 1009, server tetap jalan', async () => {
    const s = await nyalakan();
    const k = await klien(s.port);
    k.kirim('x'.repeat(70 * 1024));
    expect((await k.tutup).kode).toBe(1009);
    await tunggu(50);
    expect(await sehat(s.port)).toMatchObject({ ok: true });
    // Sambungan baru masih dilayani.
    const k2 = await klien(s.port);
    k2.kirim({ t: 'ping' });
    await tungguPesan(k2, (p) => p.t === 'pong');
    k2.ws.close();
  });

  it('frame WebSocket cacat (opcode tidak dikenal): server tetap jalan', async () => {
    const s = await nyalakan();
    const k = await klien(s.port);
    // Frame ber-mask dengan opcode 0x3 (dicadangkan), panjang 0.
    (k.ws as unknown as { _socket: { write(b: Buffer): void } })._socket.write(Buffer.from([0x83, 0x80, 1, 2, 3, 4]));
    expect((await k.tutup).kode).toBe(1002);
    await tunggu(50);
    expect(await sehat(s.port)).toMatchObject({ ok: true });
  });

  it('JSON rusak dan bentuk aneh dijawab error, bukan crash', async () => {
    const s = await nyalakan();
    const k = await klien(s.port);
    for (const x of ['{', 'null', '[]', '"teks"', '123', JSON.stringify({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1e9, kartuJadi: [[{ id: 'x' }]] } }), JSON.stringify({ t: '__proto__' })]) {
      k.kirim(x);
    }
    await tunggu(200);
    expect(k.pesan.filter((p) => p.t === 'error').length).toBe(7);
    expect(await sehat(s.port)).toMatchObject({ ok: true });
    k.ws.close();
  });

  it('banjir pesan: lewat batas diabaikan, banjir besar diputus 1008', async () => {
    const s = await nyalakan({ batasPesanPerDetik: 30, putusPesanPerDetik: 120 });
    const k = await klien(s.port);
    for (let i = 0; i < 100; i++) k.kirim({ t: 'ping' });
    await tunggu(300);
    expect(k.pesan.filter((p) => p.t === 'pong').length).toBe(30);
    for (let i = 0; i < 100; i++) k.kirim({ t: 'ping' });
    expect((await k.tutup).kode).toBe(1008);
    expect(await sehat(s.port)).toMatchObject({ ok: true });
  });

  it('galat di timer meja ditangkap per meja; meja lain tetap jalan', async () => {
    // Penjadwal palsu: timer dijalankan manual; `sekarang()` bisa dibuat meledak untuk meniru galat
    // di dalam callback timer meja (mis. langkahBot → terapkan → jadwalkan).
    let meledak = false;
    const antre: (() => void)[] = [];
    const penjadwal: Penjadwal = {
      setel: (_ms, fn) => {
        antre.push(fn);
        return fn;
      },
      batal: (h) => {
        const i = antre.indexOf(h as () => void);
        if (i >= 0) antre.splice(i, 1);
      },
      sekarang: () => {
        if (meledak) throw new Error('bom uji');
        return Date.now();
      },
    };
    const s = await nyalakan({ penjadwal });
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2, detikGiliran: 30 } });
    await tungguPesan(a, (p) => p.t === 'masuk');
    a.kirim({ t: 'aturKursi', kursi: 1, jenis: 'bot' });
    a.kirim({ t: 'mulai', pengocok: 0 });
    await tungguPesan(a, (p) => p.t === 'view');
    expect(antre.length).toBeGreaterThan(0); // timer pengumuman joker

    meledak = true;
    for (const fn of antre.splice(0)) expect(() => fn()).not.toThrow();
    meledak = false;
    expect(s.jumlahGalatMeja()).toBeGreaterThan(0);
    expect(log.some((x) => String(x[0]).startsWith('galat di timer meja'))).toBe(true);
    expect(await sehat(s.port)).toMatchObject({ ok: true });

    // Meja baru tetap bisa dibuat dan dimainkan.
    const b = await klien(s.port);
    b.kirim({ t: 'buat', nama: 'Siti', pengaturan: { jumlahPemain: 2 } });
    await tungguPesan(b, (p) => p.t === 'masuk');
    a.ws.close();
    b.ws.close();
  });

  it('batas meja per IP: meja ke-(N+1) dari alamat yang sama ditolak', async () => {
    const s = await nyalakan({ maksMejaPerIp: 2 });
    const k = await klien(s.port);
    for (let i = 0; i < 3; i++) k.kirim({ t: 'buat', nama: `M${i}` });
    const galat = await tungguPesan(k, (p) => p.t === 'error');
    expect(String(galat.pesan)).toContain('Kebanyakan meja');
    expect(s.jumlahMeja()).toBe(2);
    // Gabung ke meja yang sudah ada tetap boleh.
    const kode = String(k.pesan.find((p) => p.t === 'masuk')?.kode);
    const t = await klien(s.port);
    t.kirim({ t: 'gabung', kode, nama: 'Tamu' });
    await tungguPesan(t, (p) => p.t === 'masuk');
    k.ws.close();
    t.ws.close();
  });

  it('gabung yang gagal (meja penuh / sudah mulai) tidak membuat pemain kehilangan meja lamanya', async () => {
    const s = await nyalakan();
    // Meja B 2 kursi, penuh.
    const hostB = await klien(s.port);
    hostB.kirim({ t: 'buat', nama: 'HostB', pengaturan: { jumlahPemain: 2 } });
    const kodeB = String((await tungguPesan(hostB, (p) => p.t === 'masuk')).kode);
    const lainB = await klien(s.port);
    lainB.kirim({ t: 'gabung', kode: kodeB, nama: 'LainB' });
    await tungguPesan(lainB, (p) => p.t === 'masuk');
    // Meja A: host + teman.
    const hostA = await klien(s.port);
    hostA.kirim({ t: 'buat', nama: 'HostA', pengaturan: { jumlahPemain: 3 } });
    const kodeA = String((await tungguPesan(hostA, (p) => p.t === 'masuk')).kode);
    const teman = await klien(s.port);
    teman.kirim({ t: 'gabung', kode: kodeA, nama: 'Teman' });
    await tungguPesan(teman, (p) => p.t === 'masuk');
    await tunggu(50);

    // Teman mencoba pindah ke meja B yang penuh lewat sambungan yang sama.
    teman.pesan.length = 0;
    hostA.pesan.length = 0;
    teman.kirim({ t: 'gabung', kode: kodeB, nama: 'Teman' });
    expect(String((await tungguPesan(teman, (p) => p.t === 'error')).pesan)).toContain('penuh');
    await tunggu(50);
    // Meja A tidak menganggap teman terputus, dan kabar meja A tetap sampai ke teman.
    expect(hostA.pesan.filter((p) => p.t === 'meja')).toHaveLength(0);
    hostA.kirim({ t: 'pengaturan', pengaturan: { detikGiliran: 45 } });
    const mejaA = (await tungguPesan(teman, (p) => p.t === 'meja')) as { info?: { kode?: string; kursi?: { nama: string; terhubung: boolean }[] } };
    expect(mejaA.info?.kursi?.find((k) => k.nama === 'Teman')?.terhubung).toBe(true);
    // Pesan lanjutan dari teman masih diproses di meja A (bukan "belum masuk meja").
    teman.pesan.length = 0;
    teman.kirim({ t: 'siapJoker' });
    teman.kirim({ t: 'ping' });
    await tungguPesan(teman, (p) => p.t === 'pong');
    expect(teman.pesan.filter((p) => p.t === 'error' && String(p.pesan).includes('belum masuk meja'))).toEqual([]);

    // Pindah ke meja yang bisa dimasuki tetap jalan: meja lama baru diberi tahu setelah berhasil.
    const hostC = await klien(s.port);
    hostC.kirim({ t: 'buat', nama: 'HostC', pengaturan: { jumlahPemain: 2 } });
    const kodeC = String((await tungguPesan(hostC, (p) => p.t === 'masuk')).kode);
    hostA.pesan.length = 0;
    teman.pesan.length = 0;
    teman.kirim({ t: 'gabung', kode: kodeC, nama: 'Teman' });
    expect((await tungguPesan(teman, (p) => p.t === 'masuk')).kode).toBe(kodeC);
    const kabarA = (await tungguPesan(hostA, (p) => p.t === 'meja')) as { info?: { kursi?: { nama: string; terhubung: boolean }[] } };
    expect(kabarA.info?.kursi?.find((k) => k.nama === 'Teman')?.terhubung).toBe(false);
    await tunggu(50);
    // Setelah pindah, kabar meja A tidak lagi dikirim ke sambungan teman.
    teman.pesan.length = 0;
    hostA.kirim({ t: 'pengaturan', pengaturan: { detikGiliran: 60 } });
    await tunggu(100);
    expect(teman.pesan.filter((p) => p.t === 'meja')).toHaveLength(0);
    for (const k of [hostA, hostB, hostC, lainB, teman]) k.ws.close();
  });

  it('gabung pakai token di sambungan baru: sambungan lama ditutup 4000 hanya kalau berhasil', async () => {
    const s = await nyalakan();
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(s.port);
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', token: masuk.token });
    expect((await tungguPesan(b, (p) => p.t === 'masuk')).kursi).toBe(0);
    expect((await a.tutup).kode).toBe(4000);
    b.ws.close();
  });

  it('tutup(): pesan "buat" yang tiba selama penutupan tidak membuat meja; sambungan baru ditolak', async () => {
    const s = await nyalakan();
    const k = await klien(s.port);
    k.kirim({ t: 'ping' });
    await tungguPesan(k, (p) => p.t === 'pong');
    const p = s.tutup();
    // Sambungan masih CLOSING: pesan ini tetap sampai ke server.
    k.kirim({ t: 'buat', nama: 'Telat' });
    const baru = await new Promise<string>((ok) => {
      const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`);
      ws.on('open', () => {
        ok('buka');
        ws.close();
      });
      ws.on('unexpected-response', (_r, res) => {
        ok(`http ${res.statusCode}`);
        res.resume();
      });
      ws.on('error', () => ok('galat'));
    });
    expect(baru).not.toBe('buka');
    await p;
    await tunggu(100);
    expect(s.jumlahMeja()).toBe(0);
    expect(log.some((x) => String(x[0]).includes('dibuat'))).toBe(false);
    expect(k.pesan.some((x) => x.t === 'masuk')).toBe(false);
    expect((await k.tutup).kode).toBe(1001);
    server = null;
  });

  it('galat sambungan beruntun dicatat dengan jatah, totalnya tetap dihitung', async () => {
    const s = await nyalakan();
    for (let i = 0; i < 25; i++) {
      const k = await klien(s.port);
      (k.ws as unknown as { _socket: { write(b: Buffer): void } })._socket.write(Buffer.from([0x83, 0x80, 1, 2, 3, 4]));
      await k.tutup;
    }
    await tunggu(50);
    const baris = log.filter((x) => String(x[0]).startsWith('galat sambungan'));
    expect(baris.length).toBe(10);
    expect(await sehat(s.port)).toMatchObject({ ok: true });
  });

  it('tutup(): sambungan menerima 1001, aman dipanggil dua kali', async () => {
    const s = await nyalakan();
    const k = await klien(s.port);
    k.kirim({ t: 'buat', nama: 'Budi' });
    await tungguPesan(k, (p) => p.t === 'masuk');
    await Promise.all([s.tutup(), s.tutup()]);
    expect((await k.tutup).kode).toBe(1001);
    expect(s.jumlahMeja()).toBe(0);
    server = null;
  });
});

describe('alamat IP pemain', () => {
  const req = (alamat: string, xff?: string) =>
    ({ socket: { remoteAddress: alamat }, headers: xff ? { 'x-forwarded-for': xff } : {} }) as unknown as IncomingMessage;

  it('alamat lokal/privat dikenali', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.1.2.3', '172.17.0.1', '192.168.1.9', 'fd12:3456::1']) expect(alamatLokal(a)).toBe(true);
    for (const a of ['8.8.8.8', '172.32.0.1', '36.80.1.2', '2001:db8::1']) expect(alamatLokal(a)).toBe(false);
  });

  it('entri X-Forwarded-For berport dinormalkan; entri yang bukan IP jatuh ke alamat langsung', () => {
    expect(alamatKlien(req('127.0.0.1', '1.2.3.4:5678'))).toBe('1.2.3.4');
    expect(alamatKlien(req('127.0.0.1', '[2001:db8::1]:443'))).toBe('2001:db8::1');
    expect(alamatKlien(req('127.0.0.1', '[2001:db8::1]'))).toBe('2001:db8::1');
    expect(alamatKlien(req('127.0.0.1', '9.9.9.9, [::ffff:36.80.1.2]:80'))).toBe('36.80.1.2');
    expect(alamatKlien(req('127.0.0.1', ' 36.80.1.2 '))).toBe('36.80.1.2');
    expect(normalkanEntriXff('fe80::1%eth0')).toBe('fe80::1%eth0');
    for (const rusak of ['tak-dikenal', 'unknown', '1.2.3.4:abc', '1.2.3.999', '[1.2.3.4]:80x', 'a'.repeat(80), '_hidden', '1.2.3.4:5678:9']) {
      expect(alamatKlien(req('127.0.0.1', rusak)), rusak).toBe('127.0.0.1');
    }
  });

  it('X-Forwarded-For hanya dipercaya dari proxy lokal (bawaan), entri paling kanan', () => {
    expect(alamatKlien(req('127.0.0.1', '1.1.1.1, 36.80.1.2'))).toBe('36.80.1.2');
    expect(alamatKlien(req('::ffff:172.18.0.1', '36.80.1.2'))).toBe('36.80.1.2');
    // Langsung dari internet: header palsu diabaikan.
    expect(alamatKlien(req('36.80.1.2', '9.9.9.9'))).toBe('36.80.1.2');
    expect(alamatKlien(req('127.0.0.1', '9.9.9.9'), false)).toBe('127.0.0.1');
    expect(alamatKlien(req('36.80.1.2', '9.9.9.9'), true)).toBe('9.9.9.9');
    expect(alamatKlien(req('127.0.0.1'))).toBe('127.0.0.1');
  });
});

describe('pembatas log', () => {
  it('paling banyak N baris per jenis per jendela; yang disembunyikan disebut di baris berikutnya', () => {
    const catatan: unknown[][] = [];
    let t = 0;
    const p = buatPembatasLog((...x) => catatan.push(x), { maks: 3, jendelaMs: 1000, sekarang: () => t });
    for (let i = 0; i < 10; i++) p.catat('a', `a${i}`);
    p.catat('b', 'b0');
    expect(catatan.map((x) => x[0])).toEqual(['a0', 'a1', 'a2', 'b0']);
    expect(p.total('a')).toBe(10);
    expect(p.total('b')).toBe(1);
    expect(p.total('c')).toBe(0);
    t = 1000;
    p.catat('a', 'a10');
    expect(catatan.at(-1)).toEqual(['a10', '(+7 kejadian serupa tidak dicatat, total 11)']);
    p.catat('a', 'a11');
    expect(catatan.at(-1)).toEqual(['a11']);
  });
});

describe('penjaga proses', () => {
  it('galat lolos dicatat dan proses tetap hidup; terlalu sering = keluar(1)', () => {
    const proses = new EventEmitter();
    const catatan: unknown[][] = [];
    const keluar: number[] = [];
    let t = 0;
    const lepas = pasangPenjagaProses(proses, { log: (...x) => catatan.push(x), batas: 3, jendelaMs: 1000, sekarang: () => t, keluar: (k) => keluar.push(k) });
    proses.emit('uncaughtException', new Error('satu'));
    proses.emit('unhandledRejection', new Error('dua'));
    expect(keluar).toEqual([]);
    expect(catatan.map((x) => String(x[0]))).toEqual([expect.stringContaining('uncaughtException'), expect.stringContaining('unhandledRejection')]);
    // Lewat jendela waktu: hitungan mulai lagi.
    t = 5000;
    proses.emit('uncaughtException', new Error('tiga'));
    proses.emit('uncaughtException', new Error('empat'));
    expect(keluar).toEqual([]);
    proses.emit('uncaughtException', new Error('lima'));
    expect(keluar).toEqual([1]);
    lepas();
    expect(proses.listenerCount('uncaughtException')).toBe(0);
    expect(proses.listenerCount('unhandledRejection')).toBe(0);
  });
});
