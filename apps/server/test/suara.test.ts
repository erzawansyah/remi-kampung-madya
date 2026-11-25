// Suara (0.9.0) lewat server sungguhan: endpoint ICE (STUN saja / STUN + TURN skema REST coturn) dan
// sinyal WebRTC yang hanya diteruskan di antara pemain manusia satu meja, tidak pernah ke penonton.
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { PesanKlien, PesanServer } from '@remi/meja';
import { jalankanServer, type ServerRemi } from '../src/server.js';
import { bacaTurnEnv, jawabanIce, kredensialTurn, STUN_BAWAAN, TTL_TURN_BAWAAN_DETIK } from '../src/suara.js';

class Klien {
  pesan: PesanServer[] = [];
  private ws: WebSocket;
  private terbuka: Promise<void>;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (d) => this.pesan.push(JSON.parse(d.toString())));
    this.terbuka = new Promise((ok) => this.ws.on('open', () => ok()));
  }
  async kirim(p: PesanKlien | Record<string, unknown>) {
    await this.terbuka;
    this.ws.send(JSON.stringify(p));
  }
  async tunggu<T extends PesanServer['t']>(t: T, syarat: (p: Extract<PesanServer, { t: T }>) => boolean = () => true, ms = 8000) {
    const mulai = Date.now();
    for (;;) {
      const p = [...this.pesan].reverse().find((x) => x.t === t && syarat(x as never));
      if (p) return p as Extract<PesanServer, { t: T }>;
      if (Date.now() - mulai > ms) throw new Error(`tidak menerima ${t}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  tutup() {
    this.ws.close();
  }
}

const TURN = { urls: ['turn:turn.contoh.id:3478?transport=udp', 'turn:turn.contoh.id:3478?transport=tcp'], rahasia: 'rahasia-uji', ttlDetik: 3600 };

let server: ServerRemi;
let serverTurn: ServerRemi;
beforeAll(async () => {
  server = await jalankanServer({ acakDuduk: false, port: 0, host: '127.0.0.1', jedaBotMs: 5, log: () => undefined });
  serverTurn = await jalankanServer({ acakDuduk: false, port: 0, host: '127.0.0.1', jedaBotMs: 5, log: () => undefined, turn: TURN });
});
afterAll(async () => {
  await server.tutup();
  await serverTurn.tutup();
});

const ice = (srv: ServerRemi, token?: string) =>
  fetch(`http://127.0.0.1:${srv.port}/api/suara/ice`, { headers: token ? { 'x-token-meja': token } : {} });

describe('ICE', () => {
  it('bacaTurnEnv: wajib alamat turn: dan rahasia; TTL dijepit', () => {
    expect(bacaTurnEnv({})).toBeNull();
    expect(bacaTurnEnv({ TURN_URLS: 'turn:a.id:3478' })).toBeNull();
    expect(bacaTurnEnv({ TURN_SECRET: 'x' })).toBeNull();
    expect(bacaTurnEnv({ TURN_URLS: 'http://a.id', TURN_SECRET: 'x' })).toBeNull();
    expect(bacaTurnEnv({ TURN_URL: 'turn:a.id:3478', TURN_SECRET: ' x ' })).toEqual({ urls: ['turn:a.id:3478'], rahasia: 'x', ttlDetik: TTL_TURN_BAWAAN_DETIK });
    expect(bacaTurnEnv({ TURN_URLS: 'turn:a.id:3478, turns:a.id:5349,ftp:x', TURN_SECRET: 'x', TURN_TTL: '600' })).toEqual({
      urls: ['turn:a.id:3478', 'turns:a.id:5349'],
      rahasia: 'x',
      ttlDetik: 600,
    });
    expect(bacaTurnEnv({ TURN_URLS: 'turn:a.id', TURN_SECRET: 'x', TURN_TTL: '5' })!.ttlDetik).toBe(TTL_TURN_BAWAAN_DETIK);
  });

  it('kredensial skema REST coturn: username = kedaluwarsa:acak, credential = base64(HMAC-SHA1)', () => {
    const k = kredensialTurn('rahasia', 1_700_000_000_000, 3600, 'abc');
    expect(k.username).toBe('1700003600:abc');
    expect(k.credential).toBe(createHmac('sha1', 'rahasia').update('1700003600:abc').digest('base64'));
    expect(jawabanIce(null, 0, true)).toEqual({ iceServers: [{ urls: STUN_BAWAAN }], ttl: TTL_TURN_BAWAAN_DETIK });
    expect(jawabanIce(TURN, 0, false).iceServers).toEqual([{ urls: STUN_BAWAAN }]);
  });

  it('tanpa TURN: STUN saja, juga untuk pemain yang duduk', async () => {
    const a = new Klien(server.port);
    await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2 } });
    const { token } = await a.tunggu('masuk');
    const r = await ice(server, token);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ iceServers: [{ urls: STUN_BAWAAN }], ttl: TTL_TURN_BAWAAN_DETIK });
    expect((await fetch(`http://127.0.0.1:${server.port}/api/suara/ice`, { method: 'POST' })).status).toBe(405);
    a.tutup();
  });

  it('dengan TURN: kredensial hanya untuk token kursi yang duduk di meja', async () => {
    const tanpaToken = (await (await ice(serverTurn)).json()) as { iceServers: unknown[] };
    expect(tanpaToken.iceServers).toEqual([{ urls: STUN_BAWAAN }]);
    expect(((await (await ice(serverTurn, 'ngawur')).json()) as { iceServers: unknown[] }).iceServers).toHaveLength(1);
    const a = new Klien(serverTurn.port);
    await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2 } });
    const { token } = await a.tunggu('masuk');
    const sebelum = Math.floor(Date.now() / 1000);
    const isi = (await (await ice(serverTurn, token)).json()) as { iceServers: { urls: string | string[]; username?: string; credential?: string }[]; ttl: number };
    expect(isi.ttl).toBe(3600);
    expect(isi.iceServers[0]).toEqual({ urls: STUN_BAWAAN });
    const t = isi.iceServers[1]!;
    expect(t.urls).toEqual(TURN.urls);
    const [kedaluwarsa, acak] = t.username!.split(':');
    expect(Number(kedaluwarsa)).toBeGreaterThanOrEqual(sebelum + 3600);
    expect(Number(kedaluwarsa)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 3600);
    expect(acak).toMatch(/^[0-9a-f]{12}$/);
    expect(t.credential).toBe(createHmac('sha1', TURN.rahasia).update(t.username!).digest('base64'));
    expect(JSON.stringify(isi)).not.toContain(TURN.rahasia);
    a.tutup();
  });
});

describe('sinyal suara lewat server', () => {
  it('diteruskan antarpemain satu meja; penonton tidak menerima apa pun dan tidak bisa mengirim', async () => {
    const a = new Klien(server.port);
    await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3, detikGiliran: 0 } });
    const { kode } = await a.tunggu('masuk');
    const b = new Klien(server.port);
    await b.kirim({ t: 'gabung', kode, nama: 'Siti' });
    await b.tunggu('masuk');
    await a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
    await a.kirim({ t: 'mulai', pengocok: 0 });
    await b.tunggu('meja', (p) => p.info.status === 'main');

    const p = new Klien(server.port);
    await p.kirim({ t: 'tonton', kode, nama: 'Penonton' });
    await p.tunggu('tontonan');

    await a.kirim({ t: 'suara', aksi: 'gabung', nyala: true });
    await b.kirim({ t: 'suara', aksi: 'gabung' });
    const keB = await b.tunggu('suara', (x) => x.saya !== null && x.anggota.length === 2);
    const idA = keB.anggota.find((x) => x.kursi === 0)!.id;
    expect(keB.anggota).toEqual([
      { id: idA, kursi: 0, mic: true },
      { id: keB.saya, kursi: 1, mic: false },
    ]);
    const data = { sdp: { type: 'offer' as const, sdp: 'v=0\r\n' } };
    await a.kirim({ t: 'suaraSinyal', ke: keB.saya!, data });
    expect(await b.tunggu('suaraSinyal')).toEqual({ t: 'suaraSinyal', dari: idA, data });
    // Penonton mencoba ikut: ditolak meja.
    await p.kirim({ t: 'suara', aksi: 'gabung' });
    await p.kirim({ t: 'suaraSinyal', ke: idA, data });
    await p.tunggu('error');
    // Bentuk yang salah ditolak di validasi.
    await a.kirim({ t: 'suaraSinyal', ke: keB.saya!, data: { sdp: { type: 'offer', sdp: 'x'.repeat(20_000) } } });
    await a.tunggu('error', (x) => /dikenali/.test(x.pesan));
    await new Promise((r) => setTimeout(r, 100));
    expect(p.pesan.some((x) => x.t === 'suara' || x.t === 'suaraSinyal')).toBe(false);
    expect(a.pesan.some((x) => x.t === 'suaraSinyal')).toBe(false);
    expect(b.pesan.filter((x) => x.t === 'suaraSinyal')).toHaveLength(1);
    a.tutup();
    b.tutup();
    p.tutup();
  });
});
