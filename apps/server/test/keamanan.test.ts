// Keamanan server: cek Origin handshake WebSocket, batas sambungan per jaringan (IPv6 per /64),
// header keamanan (CSP dkk.), dan /healthz yang tidak membocorkan angka operasional.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { CSP, daftarEnv, kunciIp, originDiizinkan } from '../src/keamanan.js';
import { jalankanServer, type OpsiServer, type ServerRemi } from '../src/server.js';

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

/** Coba buka WebSocket; hasilnya 'buka' (beserta ws) atau kode HTTP penolakan. */
function coba(port: number, headers: Record<string, string> = {}): Promise<{ hasil: 'buka'; ws: WebSocket } | { hasil: number }> {
  return new Promise((ok) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    ws.on('open', () => ok({ hasil: 'buka', ws }));
    ws.on('unexpected-response', (_req, res) => {
      ok({ hasil: res.statusCode ?? 0 });
      res.resume();
    });
    ws.on('error', () => undefined);
  });
}
const tutupSemua = async (daftar: WebSocket[]) => {
  for (const ws of daftar) ws.close();
  await tunggu(50);
};

const req = (headers: Record<string, string>, alamat = '127.0.0.1') => ({ socket: { remoteAddress: alamat }, headers }) as unknown as IncomingMessage;

describe('originDiizinkan', () => {
  it('tanpa header Origin (klien non-browser): boleh', () => {
    expect(originDiizinkan(req({ host: 'remi.id' }))).toBe(true);
  });

  it('Origin sehost dengan Host: boleh, port bawaan dianggap sama', () => {
    expect(originDiizinkan(req({ host: 'remi.id', origin: 'https://remi.id' }))).toBe(true);
    expect(originDiizinkan(req({ host: 'remi.id:443', origin: 'https://remi.id' }))).toBe(true);
    expect(originDiizinkan(req({ host: 'REMI.ID', origin: 'https://remi.id' }))).toBe(true);
    expect(originDiizinkan(req({ host: 'localhost:5173', origin: 'http://localhost:5173' }))).toBe(true);
    expect(originDiizinkan(req({ host: '192.168.1.5:5173', origin: 'http://192.168.1.5:5173' }))).toBe(true);
  });

  it('Origin asing, port beda, "null", atau skema aneh: ditolak', () => {
    expect(originDiizinkan(req({ host: 'remi.id', origin: 'https://jahat.example' }))).toBe(false);
    expect(originDiizinkan(req({ host: 'remi.id', origin: 'https://remi.id.jahat.example' }))).toBe(false);
    expect(originDiizinkan(req({ host: 'localhost:2567', origin: 'http://localhost:5173' }))).toBe(false);
    expect(originDiizinkan(req({ host: 'remi.id', origin: 'null' }))).toBe(false);
    expect(originDiizinkan(req({ host: 'remi.id', origin: 'file://remi.id' }))).toBe(false);
    expect(originDiizinkan(req({ origin: 'https://remi.id' }))).toBe(false);
  });

  it('X-Forwarded-Host hanya dipakai bila proxy dipercaya', () => {
    const lewatProxy = { host: 'remi:2567', origin: 'https://remi.id', 'x-forwarded-host': 'remi.id' };
    expect(originDiizinkan(req(lewatProxy, '127.0.0.1'))).toBe(true);
    expect(originDiizinkan(req(lewatProxy, '::ffff:172.18.0.1'))).toBe(true);
    // Langsung dari internet: X-Forwarded-Host palsu diabaikan.
    expect(originDiizinkan(req(lewatProxy, '36.80.1.2'))).toBe(false);
    expect(originDiizinkan(req(lewatProxy, '127.0.0.1'), { percayaProxy: false })).toBe(false);
    expect(originDiizinkan(req(lewatProxy, '36.80.1.2'), { percayaProxy: true })).toBe(true);
  });

  it('daftar tambahan (ORIGIN_DIIZINKAN): asal lengkap atau host; "*" = semua', () => {
    const r = req({ host: 'remi.id', origin: 'https://main.kedaimadya.id' });
    expect(originDiizinkan(r)).toBe(false);
    expect(originDiizinkan(r, { tambahan: ['https://main.kedaimadya.id'] })).toBe(true);
    expect(originDiizinkan(r, { tambahan: ['main.kedaimadya.id'] })).toBe(true);
    expect(originDiizinkan(r, { tambahan: ['http://main.kedaimadya.id'] })).toBe(false);
    expect(originDiizinkan(r, { tambahan: ['lain.id', 'rusak://['] })).toBe(false);
    expect(originDiizinkan(r, { tambahan: ['*'] })).toBe(true);
  });

  it('daftarEnv memecah koma, membuang spasi & garis miring akhir', () => {
    expect(daftarEnv(undefined)).toEqual([]);
    expect(daftarEnv(' https://a.id/ , b.id,, ')).toEqual(['https://a.id', 'b.id']);
  });
});

describe('kunciIp', () => {
  it('IPv4 per alamat (termasuk bentuk ::ffff:)', () => {
    expect(kunciIp('36.80.1.2')).toBe('36.80.1.2');
    expect(kunciIp('::ffff:36.80.1.2')).toBe('36.80.1.2');
    expect(kunciIp('36.80.1.3')).not.toBe(kunciIp('36.80.1.2'));
  });

  it('IPv6 dikelompokkan per /64', () => {
    const a = kunciIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
    expect(a).toBe('2001:db8:1:2::/64');
    expect(kunciIp('2001:0DB8:0001:0002::1')).toBe(a);
    expect(kunciIp('2001:db8:1:2::ffff')).toBe(a);
    expect(kunciIp('2001:db8:1:3::1')).not.toBe(a);
    expect(kunciIp('::1')).toBe('0:0:0:0::/64');
    expect(kunciIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(kunciIp('64:ff9b::1.2.3.4')).toBe('64:ff9b:0:0::/64');
  });

  it('IPv4 dibungkus IPv6 bentuk heksa (::ffff:0:0/96 dan ::ffff:0:0:0/96) jadi alamat IPv4-nya', () => {
    expect(kunciIp('::ffff:0102:0304')).toBe('1.2.3.4');
    expect(kunciIp('::FFFF:102:304')).toBe('1.2.3.4');
    expect(kunciIp('0:0:0:0:0:ffff:2450:0102')).toBe('36.80.1.2');
    expect(kunciIp('::ffff:0:1.2.3.4')).toBe('1.2.3.4');
    expect(kunciIp('::ffff:0:0102:0304')).toBe('1.2.3.4');
    // Tidak lagi seember dengan ::1, dan alamat berbeda = kunci berbeda.
    expect(kunciIp('::ffff:0102:0304')).not.toBe(kunciIp('::1'));
    expect(kunciIp('::ffff:0102:0305')).not.toBe(kunciIp('::ffff:0102:0304'));
    expect(kunciIp('::1')).toBe('0:0:0:0::/64');
  });

  it('bentuk berport tetap jadi kunci jaringan yang sama', () => {
    expect(kunciIp('1.2.3.4:5678')).toBe('1.2.3.4');
    expect(kunciIp('[2001:db8::1]:443')).toBe(kunciIp('2001:db8::1'));
    expect(kunciIp('[2001:db8::1]')).toBe('2001:db8:0:0::/64');
  });

  it('alamat rusak tetap jadi kunci (tidak melempar)', () => {
    for (const x of ['tak-dikenal', '1:2:3', ':::', '1::2::3', 'zz::1', '']) expect(() => kunciIp(x)).not.toThrow();
  });
});

describe('handshake WebSocket', () => {
  it('Origin asing ditolak 403; sehost, tanpa Origin, dan daftar tambahan diterima', async () => {
    const s = await nyalakan({ originDiizinkan: ['https://teman.id'] });
    const buka: WebSocket[] = [];
    const harapBuka = async (h: Record<string, string>) => {
      const r = await coba(s.port, h);
      expect(r.hasil).toBe('buka');
      if (r.hasil === 'buka') buka.push(r.ws);
    };
    expect((await coba(s.port, { origin: 'https://jahat.example' })).hasil).toBe(403);
    expect((await coba(s.port, { origin: 'null' })).hasil).toBe(403);
    await harapBuka({});
    await harapBuka({ origin: `http://127.0.0.1:${s.port}` });
    await harapBuka({ origin: 'https://teman.id' });
    expect(s.jumlahSambungan()).toBe(3);
    expect(log.some((x) => String(x[0]).includes('Origin asing'))).toBe(true);
    await tutupSemua(buka);
  });

  it('batas sambungan per IP: lewat batas ditolak 429, setelah ada yang tutup boleh lagi', async () => {
    const s = await nyalakan({ maksSambunganPerIp: 2 });
    const a = await coba(s.port);
    const b = await coba(s.port);
    expect([a.hasil, b.hasil]).toEqual(['buka', 'buka']);
    expect((await coba(s.port)).hasil).toBe(429);
    if (a.hasil === 'buka') a.ws.close();
    await tunggu(100);
    const c = await coba(s.port);
    expect(c.hasil).toBe('buka');
    await tutupSemua([b, c].flatMap((x) => (x.hasil === 'buka' ? [x.ws] : [])));
    expect(s.jumlahSambungan()).toBe(0);
  });

  it('X-Forwarded-For berport: port berbeda tetap satu jaringan, batas per IP berlaku', async () => {
    const s = await nyalakan({ percayaProxy: true, maksSambunganPerIp: 2 });
    const buka: WebSocket[] = [];
    for (const xff of ['[2001:db8::1]:443', '[2001:db8::1]:444']) {
      const r = await coba(s.port, { 'x-forwarded-for': xff });
      expect(r.hasil, xff).toBe('buka');
      if (r.hasil === 'buka') buka.push(r.ws);
    }
    expect((await coba(s.port, { 'x-forwarded-for': '[2001:db8::1]:445' })).hasil).toBe(429);
    expect((await coba(s.port, { 'x-forwarded-for': '2001:db8::1' })).hasil).toBe(429);
    const a = await coba(s.port, { 'x-forwarded-for': '1.2.3.4:5678' });
    const b = await coba(s.port, { 'x-forwarded-for': '1.2.3.4:5679' });
    expect([a.hasil, b.hasil]).toEqual(['buka', 'buka']);
    expect((await coba(s.port, { 'x-forwarded-for': '1.2.3.4' })).hasil).toBe(429);
    await tutupSemua([...buka, ...[a, b].flatMap((x) => (x.hasil === 'buka' ? [x.ws] : []))]);
  });

  it('IPv6 satu /64 dihitung satu jaringan (sambungan maupun meja)', async () => {
    // percayaProxy: true supaya X-Forwarded-For dari klien uji dipakai sebagai alamat pemain.
    const s = await nyalakan({ percayaProxy: true, maksSambunganPerIp: 2, maksMejaPerIp: 1 });
    const x = await coba(s.port, { 'x-forwarded-for': '2001:db8:5:6::1' });
    const y = await coba(s.port, { 'x-forwarded-for': '2001:db8:5:6:ffff::9' });
    expect([x.hasil, y.hasil]).toEqual(['buka', 'buka']);
    expect((await coba(s.port, { 'x-forwarded-for': '2001:db8:5:6::abcd' })).hasil).toBe(429);
    // /64 lain dan IPv4 masih boleh.
    const z = await coba(s.port, { 'x-forwarded-for': '2001:db8:5:7::1' });
    expect(z.hasil).toBe('buka');

    // Meja: alamat lain di /64 yang sama ikut terhitung.
    const pesanY: { t: string; pesan?: string }[] = [];
    if (x.hasil !== 'buka' || y.hasil !== 'buka' || z.hasil !== 'buka') throw new Error('gagal buka');
    y.ws.on('message', (d) => pesanY.push(JSON.parse(d.toString())));
    x.ws.send(JSON.stringify({ t: 'buat', nama: 'Satu' }));
    await tunggu(100);
    y.ws.send(JSON.stringify({ t: 'buat', nama: 'Dua' }));
    await tunggu(100);
    expect(pesanY.find((p) => p.t === 'error')?.pesan).toContain('Kebanyakan meja');
    expect(s.jumlahMeja()).toBe(1);
    await tutupSemua([x.ws, y.ws, z.ws]);
  });
});

describe('header keamanan & /healthz', () => {
  const folder = mkdtempSync(join(tmpdir(), 'remi-statis-'));
  writeFileSync(join(folder, 'index.html'), '<!doctype html><title>x</title>');
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it('halaman, aset, dan API membawa CSP, X-Frame-Options, Permissions-Policy', async () => {
    const s = await nyalakan({ folderStatis: folder });
    for (const jalur of ['/', '/index.html', '/meja/ABCDE', '/healthz', '/api/riwayat', '/tidak-ada.js']) {
      const r = await fetch(`http://127.0.0.1:${s.port}${jalur}`);
      await r.arrayBuffer();
      expect(r.headers.get('content-security-policy'), jalur).toBe(CSP);
      expect(r.headers.get('x-frame-options'), jalur).toBe('DENY');
      expect(r.headers.get('permissions-policy'), jalur).toBe('camera=(), microphone=(), geolocation=()');
      expect(r.headers.get('x-content-type-options'), jalur).toBe('nosniff');
    }
  });

  it('CSP tanpa unsafe-inline/eval untuk skrip, dan melarang bingkai & plugin', () => {
    const bagian = Object.fromEntries(CSP.split('; ').map((b) => [b.split(' ')[0], b.split(' ').slice(1)]));
    expect(bagian['script-src']).toEqual(["'self'"]);
    expect(bagian['frame-ancestors']).toEqual(["'none'"]);
    expect(bagian['object-src']).toEqual(["'none'"]);
    expect(bagian['base-uri']).toEqual(["'none'"]);
    expect(CSP).not.toMatch(/unsafe-eval/);
  });

  it('/healthz bawaan hanya { ok, meja, versi, sha }; HEALTHZ_DETAIL menambah angka operasional', async () => {
    let s = await nyalakan();
    const biasa = (await (await fetch(`http://127.0.0.1:${s.port}/healthz`)).json()) as Record<string, unknown>;
    expect(Object.keys(biasa).sort()).toEqual(['meja', 'ok', 'sha', 'versi']);
    await s.tutup();
    s = await nyalakan({ healthzDetail: true });
    const detail = await (await fetch(`http://127.0.0.1:${s.port}/healthz`)).json();
    expect(detail).toMatchObject({ ok: true, meja: 0, sambungan: 0, galatMeja: 0 });
  });
});
