// Nonton (keputusan pemilik #60) lewat WebSocket sungguhan: daftar meja yang bisa ditonton, tontonan
// buangan, minta lihat, izin dari pemain, view yang sama dengan pemainnya, dan penonton pergi.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { PesanKlien, PesanServer } from '@remi/meja';
import { jalankanServer, type ServerRemi } from '../src/server.js';

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
  async tunggu<T extends PesanServer['t']>(
    t: T,
    syarat: (p: Extract<PesanServer, { t: T }>) => boolean = () => true,
    ms = 8000,
  ): Promise<Extract<PesanServer, { t: T }>> {
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

let server: ServerRemi;
beforeAll(async () => {
  server = await jalankanServer({ port: 0, host: '127.0.0.1', jedaBotMs: 5, log: () => undefined });
});
afterAll(async () => {
  await server.tutup();
});

/** Meja 3 kursi (Budi host, Siti, warga kedai), sudah main dan semua OK joker. */
async function mejaMain(pengaturan: Record<string, unknown> = {}) {
  const a = new Klien(server.port);
  await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3, detikGiliran: 0, ...pengaturan } });
  const { kode } = await a.tunggu('masuk');
  const b = new Klien(server.port);
  await b.kirim({ t: 'gabung', kode, nama: 'Siti' });
  await b.tunggu('masuk');
  await a.tunggu('meja', (p) => p.info.kursi[1].nama === 'Siti');
  await a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
  await a.kirim({ t: 'mulai', pengocok: 0 });
  await a.kirim({ t: 'siapJoker' });
  await b.tunggu('meja', (p) => p.info.status === 'main');
  await b.kirim({ t: 'siapJoker' });
  await a.tunggu('meja', (p) => p.info.menungguJoker.length === 0);
  return { a, b, kode };
}

describe('nonton (#60)', () => {
  it('daftar memuat meja yang bisa ditonton hanya kalau diminta', async () => {
    const { a, b, kode } = await mejaMain();
    const tertutup = await mejaMain({ tanpaPenonton: true });
    const c = new Klien(server.port);
    await c.kirim({ t: 'daftar' });
    const lama = await c.tunggu('daftar');
    expect(lama.meja.some((m) => m.kode === kode)).toBe(false);
    c.pesan = [];
    await c.kirim({ t: 'daftar', tonton: true });
    const baru = await c.tunggu('daftar');
    expect(baru.meja.find((m) => m.kode === kode)).toMatchObject({ kode, status: 'main', tonton: true, namaHost: 'Budi' });
    expect(baru.meja.some((m) => m.kode === tertutup.kode)).toBe(false);
    c.pesan = [];
    await c.kirim({ t: 'tonton', kode: tertutup.kode, nama: 'Nonton' });
    expect((await c.tunggu('error')).pesan).toMatch(/nggak bisa ditonton/);
    for (const k of [a, b, c, tertutup.a, tertutup.b]) k.tutup();
  });

  it('tonton → minta lihat → diizinkan → view sama dengan pemainnya → pergi', async () => {
    const { a, b, kode } = await mejaMain();
    const c = new Klien(server.port);
    await c.kirim({ t: 'tonton', kode: kode.toLowerCase(), nama: 'Tono', token: 'hp-tono' });
    const awal = await c.tunggu('tontonan');
    expect(awal.info.pemain.map((p) => p.minta)).toEqual(['bisa', 'bisa', 'tidak']);
    await a.tunggu('meja', (p) => p.info.penonton?.jumlah === 1);

    // Penonton tidak bisa menjalankan aksi.
    await c.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect((await c.tunggu('error')).pesan).toMatch(/cuma bisa nonton/);

    await c.kirim({ t: 'mintaLihat', kursi: 1 });
    const minta = await b.tunggu('meja', (p) => !!p.info.penonton?.minta?.length);
    const { id } = minta.info.penonton!.minta![0];
    expect(minta.info.penonton!.minta![0].nama).toBe('Tono');
    await b.kirim({ t: 'jawabLihat', penonton: id, terima: true });
    await c.tunggu('tontonan', (p) => p.info.melihat === 1);
    const vc = await c.tunggu('tontonView');
    const vb = await b.tunggu('view');
    expect(vc.view.saya).toBe(1);
    expect(vc.view.putaran!.tangan[1]).toEqual(vb.view.putaran!.tangan[1]);
    expect(vc.view.putaran!.tangan[0]).toBeNull();
    expect((await c.tunggu('tontonMeja')).info.kursiSaya).toBe(1);

    // Pemain menghentikan: penonton kembali ke buangan, kursi itu dijeda.
    await b.kirim({ t: 'hentikanLihat', penonton: id });
    const sesudah = await c.tunggu('tontonan', (p) => p.info.pemain[1].minta === 'jeda');
    expect(sesudah.info.melihat).toBeNull();

    c.tutup();
    await a.tunggu('meja', (p) => !p.info.penonton);
    a.tutup();
    b.tutup();
  });

  it('pemain yang menonton meja lain melepas kursinya di meja lama (terputus)', async () => {
    const { a, b, kode } = await mejaMain();
    const lain = await mejaMain();
    await lain.b.kirim({ t: 'tonton', kode, nama: 'Siti Dua' });
    await lain.b.tunggu('tontonan');
    await lain.a.tunggu('meja', (p) => p.info.kursi[1].terhubung === false, 10_000);
    // Penonton yang duduk di meja yang ditonton ditolak.
    await a.kirim({ t: 'tonton', kode, nama: 'Budi' });
    expect((await a.tunggu('error')).pesan).toMatch(/duduk di meja ini/);
    for (const k of [a, b, lain.a, lain.b]) k.tutup();
  });
});
