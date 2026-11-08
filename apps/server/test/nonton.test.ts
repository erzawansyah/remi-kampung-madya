// Nonton (keputusan pemilik #60) lewat WebSocket sungguhan: daftar meja yang bisa ditonton, tontonan
// buangan, minta lihat, izin dari pemain, view yang sama dengan pemainnya, dan penonton pergi.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { JEDA_SESUDAH_LIHAT_MS, type PesanKlien, type PesanServer } from '@remi/meja';
import { bukaRiwayat } from '../src/riwayat.js';
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
async function mejaMain(pengaturan: Record<string, unknown> = {}, srv: ServerRemi = server, namaHost = 'Budi') {
  const a = new Klien(srv.port);
  await a.kirim({ t: 'buat', nama: namaHost, pengaturan: { jumlahPemain: 3, detikGiliran: 0, publik: true, ...pengaturan } });
  const { kode } = await a.tunggu('masuk');
  const b = new Klien(srv.port);
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
  it('daftar memuat meja yang bisa ditonton (publik maupun privat) hanya kalau diminta, dengan kode tonton', async () => {
    const { a, b, kode } = await mejaMain();
    const tertutup = await mejaMain({ tanpaPenonton: true });
    const privat = await mejaMain({ publik: false });
    const c = new Klien(server.port);
    await c.kirim({ t: 'daftar' });
    const lama = await c.tunggu('daftar');
    expect(lama.meja.some((m) => m.tonton)).toBe(false);
    c.pesan = [];
    await c.kirim({ t: 'daftar', tonton: true });
    const baru = await c.tunggu('daftar');
    const tonton = baru.meja.filter((m) => m.tonton);
    // Kode meja asli tidak pernah ada di entri tonton (meja privat juga ikut, dengan kode tonton).
    for (const k of [kode, tertutup.kode, privat.kode]) expect(baru.meja.some((m) => m.kode === k)).toBe(false);
    const hostBudi = tonton.filter((m) => m.namaHost === 'Budi');
    expect(hostBudi.length).toBeGreaterThanOrEqual(2);
    for (const m of hostBudi) expect(m).toMatchObject({ status: 'main', tonton: true });
    c.pesan = [];
    await c.kirim({ t: 'tonton', kode: tertutup.kode, nama: 'Nonton' });
    expect((await c.tunggu('error')).pesan).toMatch(/nggak bisa ditonton/);
    for (const k of [a, b, c, tertutup.a, tertutup.b, privat.a, privat.b]) k.tutup();
  });

  it('meja privat ditonton lewat kode tonton; kode meja asli tidak pernah sampai ke penonton', async () => {
    const privat = await mejaMain({ publik: false }, server, 'Rahasia');
    const c = new Klien(server.port);
    await c.kirim({ t: 'daftar', tonton: true });
    const entri = (await c.tunggu('daftar')).meja.find((m) => m.tonton && m.namaHost === 'Rahasia')!;
    expect(entri).toBeDefined();
    const kodeTonton = entri.kode;
    expect(kodeTonton).not.toBe(privat.kode);
    expect(kodeTonton).toMatch(/^[A-Z2-9]{5}$/);
    await c.kirim({ t: 'tonton', kode: kodeTonton, nama: 'Tono', token: 'hp-privat' });
    const awal = await c.tunggu('tontonan');
    expect(awal.info.kode).toBe(kodeTonton);
    expect(awal.info.namaHost).toBe('Rahasia');
    await privat.a.tunggu('meja', (p) => p.info.penonton?.jumlah === 1);

    // Daftar berikutnya memberi kode tonton yang sama (tetap selama meja hidup).
    c.pesan = [];
    await c.kirim({ t: 'daftar', tonton: true });
    expect((await c.tunggu('daftar')).meja.find((m) => m.namaHost === 'Rahasia')?.kode).toBe(kodeTonton);

    // Diizinkan melihat kartu Siti: info meja dan view yang diteruskan juga tanpa kode asli.
    await c.kirim({ t: 'mintaLihat', kursi: 1 });
    const minta = await privat.b.tunggu('meja', (p) => !!p.info.penonton?.minta?.length);
    await privat.b.kirim({ t: 'jawabLihat', penonton: minta.info.penonton!.minta![0].id, terima: true });
    expect((await c.tunggu('tontonMeja')).info.kode).toBe(kodeTonton);
    await c.tunggu('tontonView');

    // Menonton lagi dengan kode tonton yang sama (seperti sambung ulang) tetap jalan.
    await c.kirim({ t: 'tonton', kode: kodeTonton.toLowerCase(), nama: 'Tono', token: 'hp-privat' });
    await c.tunggu('tontonan', (p) => p.info.melihat === null);
    // Main lagi tidak mungkin di tengah putaran; tontonan diakhiri penontonnya sendiri.
    await c.kirim({ t: 'keluar' });
    await c.tunggu('tontonSelesai');
    expect(c.pesan.length).toBeGreaterThan(0);
    expect(JSON.stringify(c.pesan)).not.toContain(privat.kode);
    for (const k of [c, privat.a, privat.b]) k.tutup();
  });

  it('tonton → minta lihat → diizinkan → view sama dengan pemainnya → pergi', async () => {
    const { a, b, kode } = await mejaMain();
    const c = new Klien(server.port);
    await c.kirim({ t: 'tonton', kode: kode.toLowerCase(), nama: 'Tono', token: 'hp-tono' });
    const awal = await c.tunggu('tontonan');
    expect(awal.info.pemain.map((p) => p.minta)).toEqual(['bisa', 'bisa', 'tidak']);
    // Kode meja asli tetap diterima, tapi yang dikirim balik kode tonton.
    expect(awal.info.kode).not.toBe(kode);
    expect(awal.info.namaHost).toBe('Budi');
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

    // Pemain menghentikan: penonton kembali ke buangan, kursi itu dihitung menolak, dan semua
    // permintaan dijeda 30 menit (#62).
    await b.kirim({ t: 'hentikanLihat', penonton: id });
    const sesudah = await c.tunggu('tontonan', (p) => p.info.pemain[1].minta === 'ditolak');
    expect(sesudah.info.melihat).toBeNull();
    expect(sesudah.info.jedaMs).toBeGreaterThan(JEDA_SESUDAH_LIHAT_MS - 5_000);
    c.pesan = [];
    await c.kirim({ t: 'mintaLihat', kursi: 0 });
    expect((await c.tunggu('error')).pesan).toMatch(/^Sabar, Bos\. Bisa minta lihat lagi (30|29) menit/);

    c.tutup();
    await a.tunggu('meja', (p) => !p.info.penonton);
    a.tutup();
    b.tutup();
  });

  it('sambung ulang dengan token sama mengambil alih tontonan; sambungan sama menonton lagi tidak ditendang', async () => {
    const { a, b, kode } = await mejaMain();
    const c = new Klien(server.port);
    await c.kirim({ t: 'tonton', kode, nama: 'Tono', token: 'hp-tono2' });
    await c.tunggu('tontonan');
    await c.kirim({ t: 'mintaLihat', kursi: 1 });
    const minta = await b.tunggu('meja', (p) => !!p.info.penonton?.minta?.length);
    const { id } = minta.info.penonton!.minta![0];
    await b.kirim({ t: 'jawabLihat', penonton: id, terima: true });
    await c.tunggu('tontonan', (p) => p.info.melihat === 1);

    // Sambungan baru dari HP yang sama (sambungan lama belum tertutup): izinnya ikut.
    const d = new Klien(server.port);
    await d.kirim({ t: 'tonton', kode, nama: 'Tono', token: 'hp-tono2' });
    expect((await d.tunggu('tontonan')).info.melihat).toBe(1);
    expect((await c.tunggu('tontonSelesai')).alasan).toMatch(/tempat lain/);
    c.tutup();

    // Sambungan yang sama menonton meja yang sama lagi: tidak diberi tontonSelesai.
    d.pesan = [];
    await d.kirim({ t: 'tonton', kode, nama: 'Tono', token: 'hp-tono2' });
    expect((await d.tunggu('tontonan')).info.melihat).toBeNull();
    expect(d.pesan.some((p) => p.t === 'tontonSelesai')).toBe(false);
    await a.tunggu('meja', (p) => p.info.penonton?.jumlah === 1);
    for (const k of [a, b, d]) k.tutup();
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

describe('nonton (#60): kode tonton dibuang bersama mejanya', () => {
  it('meja yang dihapus pembersih ikut membuang kode tontonnya', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const srv = await jalankanServer({
      port: 0,
      host: '127.0.0.1',
      jedaBotMs: 5,
      log: () => undefined,
      hapusMejaKosongMs: 0,
      hapusMejaMainKosongMs: 0,
    });
    try {
      const { a, b } = await mejaMain({}, srv);
      const c = new Klien(srv.port);
      await c.kirim({ t: 'daftar', tonton: true });
      const [m] = (await c.tunggu('daftar')).meja.filter((x) => x.tonton);
      expect(srv.jumlahKodeTonton()).toBe(1);
      await c.kirim({ t: 'tonton', kode: m.kode, nama: 'Tono' });
      await c.tunggu('tontonan');
      // Semua pemain keluar: meja tinggal warga kedai, lalu dihapus pembersih.
      await a.kirim({ t: 'keluar' });
      await b.kirim({ t: 'keluar' });
      for (let i = 0; i < 40 && srv.jumlahMeja() > 0; i++) {
        await new Promise((r) => setTimeout(r, 50));
        vi.advanceTimersByTime(30_000);
      }
      expect(srv.jumlahMeja()).toBe(0);
      expect((await c.tunggu('tontonSelesai')).alasan).toMatch(/bubar/);
      expect(srv.jumlahKodeTonton()).toBe(0);
      c.pesan = [];
      await c.kirim({ t: 'tonton', kode: m.kode, nama: 'Tono' });
      expect((await c.tunggu('error')).pesan).toBe(`Meja ${m.kode} nggak ketemu.`);
      for (const k of [a, b, c]) k.tutup();
    } finally {
      await srv.tutup();
      vi.useRealTimers();
    }
  });
});

describe('nonton (#60): kode tonton selamat dari restart', () => {
  const folder = mkdtempSync(join(tmpdir(), 'remi-nonton-'));
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  async function nyalakan(path: string) {
    const db = new DatabaseSync(path);
    const riwayat = bukaRiwayat(db);
    const srv = await jalankanServer({ port: 0, host: '127.0.0.1', jedaBotMs: 5, riwayat, log: () => undefined });
    return {
      srv,
      riwayat,
      matikan: async () => {
        await srv.tutup();
        riwayat.tutup();
        db.close();
      },
    };
  }

  it('penonton meja privat menyambung ulang dengan kode tonton yang sama ke meja yang dipulihkan', async () => {
    const path = join(folder, 'restart.db');
    const s1 = await nyalakan(path);
    const m = await mejaMain({ publik: false }, s1.srv, 'Rahasia');
    const c = new Klien(s1.srv.port);
    await c.kirim({ t: 'daftar', tonton: true });
    const kodeTonton = (await c.tunggu('daftar')).meja.find((x) => x.tonton && x.namaHost === 'Rahasia')!.kode;
    expect(kodeTonton).not.toBe(m.kode);
    await c.kirim({ t: 'tonton', kode: kodeTonton, nama: 'Tono', token: 'hp-tono' });
    await c.tunggu('tontonan');
    // Kode tonton ikut simpanan meja (langsung kalau barisnya sudah ada, atau bersama tulisan berikutnya).
    const baris = () => s1.riwayat.mejaAktif.semua().find((x) => x.kode === m.kode);
    for (let i = 0; i < 100 && !baris(); i++) await new Promise((r) => setTimeout(r, 30));
    expect(baris()?.kodeTonton).toBe(kodeTonton);
    // Server dimatikan (deploy): penonton tidak diberi tahu mejanya bubar.
    await s1.matikan();
    expect(c.pesan.some((p) => p.t === 'tontonSelesai')).toBe(false);
    for (const k of [m.a, m.b, c]) k.tutup();

    const s2 = await nyalakan(path);
    try {
      expect(s2.srv.jumlahMeja()).toBe(1);
      expect(s2.srv.jumlahKodeTonton()).toBe(1);
      const c2 = new Klien(s2.srv.port);
      await c2.kirim({ t: 'tonton', kode: kodeTonton, nama: 'Tono', token: 'hp-tono' });
      const lagi = await c2.tunggu('tontonan');
      expect(lagi.info.kode).toBe(kodeTonton);
      expect(lagi.info.namaHost).toBe('Rahasia');
      // Daftar di server baru memberi kode tonton yang sama, dan kode meja asli tetap tidak bocor.
      c2.pesan = [];
      await c2.kirim({ t: 'daftar', tonton: true });
      const daftar = (await c2.tunggu('daftar')).meja;
      expect(daftar.find((x) => x.namaHost === 'Rahasia')?.kode).toBe(kodeTonton);
      expect(daftar.some((x) => x.kode === m.kode)).toBe(false);
      c2.tutup();
    } finally {
      await s2.matikan();
    }
  });
});
