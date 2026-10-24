import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { pilihAksiBot, Rng } from '@remi/engine';
import { NAMA_LAWAN_BAWAAN, type PesanKlien, type PesanServer } from '@remi/meja';
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
    ms = 3000,
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

describe('server WebSocket', () => {
  it('healthz', async () => {
    const r = await fetch(`http://127.0.0.1:${server.port}/healthz`);
    expect(await r.json()).toMatchObject({ ok: true });
  });

  it('buat meja, teman gabung pakai kode, host isi bot, mulai, tiap orang dapat view sendiri', async () => {
    const a = new Klien(server.port);
    await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3, detikGiliran: 0 } });
    const masukA = await a.tunggu('masuk');
    expect(masukA.kode).toMatch(/^[A-Z2-9]{5}$/);

    const b = new Klien(server.port);
    await b.kirim({ t: 'gabung', kode: masukA.kode.toLowerCase(), nama: 'Siti' });
    const masukB = await b.tunggu('masuk');
    expect(masukB.kursi).toBe(1);
    await a.tunggu('meja', (p) => p.info.kursi[1].nama === 'Siti');

    await a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
    await a.kirim({ t: 'mulai', pengocok: 0 });
    await a.kirim({ t: 'siapJoker' });
    await b.kirim({ t: 'siapJoker' });
    await a.tunggu('meja', (p) => p.info.menungguJoker.length === 0);
    const vA = await a.tunggu('view');
    const vB = await b.tunggu('view');
    expect(vA.view.putaran!.tangan[0]).toHaveLength(6);
    expect(vA.view.putaran!.tangan[1]).toBeNull();
    expect(vB.view.putaran!.tangan[0]).toBeNull();

    // Giliran Budi: ambil dari deck.
    await a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    await a.tunggu('view', (p) => p.view.putaran!.tahap === 'main');
    // Siti mencoba jalan di giliran Budi → ditolak.
    await b.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect((await b.tunggu('error')).pesan).toContain('gilirannya');
    a.tutup();
    b.tutup();
  });

  it('warga kedai diberi nama dari daftar bawaan dengan urutan acak per meja', async () => {
    const urutan: string[] = [];
    for (let m = 0; m < 6; m++) {
      const a = new Klien(server.port);
      await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 6 } });
      await a.tunggu('masuk');
      for (let i = 1; i < 6; i++) await a.kirim({ t: 'aturKursi', kursi: i, jenis: 'bot' });
      const info = (await a.tunggu('meja', (p) => p.info.kursi.every((k) => k.jenis !== 'kosong'))).info;
      const nama = info.kursi.slice(1).map((k) => k.nama);
      expect(new Set(nama).size).toBe(5);
      for (const n of nama) expect(NAMA_LAWAN_BAWAAN).toContain(n);
      urutan.push(nama.join('|'));
      a.tutup();
    }
    // Enam meja dengan urutan yang sama persis hampir mustahil kalau diacak (22 nama: 22P5 = 3.160.080 kemungkinan).
    expect(new Set(urutan).size).toBeGreaterThan(1);
  });

  it('sambung ulang dengan token setelah koneksi putus', async () => {
    const a = new Klien(server.port);
    await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2, detikGiliran: 0 } });
    const { kode, token } = await a.tunggu('masuk');
    await a.kirim({ t: 'aturKursi', kursi: 1, jenis: 'bot' });
    await a.kirim({ t: 'mulai', pengocok: 1 });
    await a.tunggu('view');
    a.tutup();
    await new Promise((r) => setTimeout(r, 50));

    const a2 = new Klien(server.port);
    await a2.kirim({ t: 'gabung', kode, nama: 'Budi', token });
    const masuk = await a2.tunggu('masuk');
    expect(masuk.kursi).toBe(0);
    expect(masuk.token).toBe(token);
    const v = await a2.tunggu('view');
    expect(v.view.putaran!.tangan[0]).not.toBeNull();
    a2.tutup();
  });

  it('daftar meja publik hanya berisi lobi yang masih ada kursi', async () => {
    const a = new Klien(server.port);
    await a.kirim({ t: 'buat', nama: 'Publik', pengaturan: { jumlahPemain: 3, publik: true } });
    const { kode } = await a.tunggu('masuk');
    const c = new Klien(server.port);
    await c.kirim({ t: 'daftar' });
    const daftar = await c.tunggu('daftar');
    expect(daftar.meja.map((m) => m.kode)).toContain(kode);
    expect(daftar.meja.find((m) => m.kode === kode)).toMatchObject({ namaHost: 'Publik', terisi: 1, jumlahPemain: 3 });
    a.tutup();
    c.tutup();
  });

  it('pesan rusak / tidak dikenal / sebelum masuk meja ditolak dengan sopan', async () => {
    const c = new Klien(server.port);
    await c.kirim({ t: 'aksi', aksi: { jenis: 'buang', kartuId: 123 } } as Record<string, unknown>);
    expect((await c.tunggu('error')).pesan).toBe('Pesan tidak dikenali.');
    await c.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect((await c.tunggu('error', (p) => p.pesan !== 'Pesan tidak dikenali.')).pesan).toBe('Kamu belum masuk meja.');
    await c.kirim({ t: 'gabung', kode: 'ZZZZZ', nama: 'X' });
    expect((await c.tunggu('error', (p) => p.pesan.includes('ZZZZZ'))).pesan).toContain('nggak ketemu');
    c.tutup();
  });

  it('pesan yang diketik sendiri diteruskan sesudah dirapikan (keputusan #48)', async () => {
    const a = new Klien(server.port);
    await a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2 } });
    const { kode } = await a.tunggu('masuk');
    const b = new Klien(server.port);
    await b.kirim({ t: 'gabung', kode, nama: 'Siti' });
    await b.tunggu('masuk');
    await a.kirim({ t: 'emote', isi: '  gedein   dong <3 ' } as Record<string, unknown>);
    expect((await b.tunggu('emote')).isi).toBe('gedein dong 3');
    a.tutup();
    b.tutup();
  });

  it('HP yang masih memakai aplikasi 0.1.0: emote lama diteruskan sebagai padanan baru, bukan ditolak', async () => {
    // Pesan persis seperti yang dikirim client 0.1.0 (JSON mentah, tanpa field baru).
    const lama = new Klien(server.port);
    await lama.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 4 } });
    const { kode } = await lama.tunggu('masuk');
    const baru = new Klien(server.port);
    await baru.kirim({ t: 'gabung', kode, nama: 'Siti' });
    await baru.tunggu('masuk');
    await lama.kirim({ t: 'emote', isi: 'Makasih, Bos!' } as Record<string, unknown>);
    expect((await baru.tunggu('emote')).isi).toBe('Suwun, Bos!');
    await new Promise((r) => setTimeout(r, 1300));
    await lama.kirim({ t: 'emote', isi: 'Tutup!' } as Record<string, unknown>);
    expect((await baru.tunggu('emote', (p) => p.isi !== 'Suwun, Bos!')).isi).toBe('Nutup, rek!');
    expect(lama.pesan.filter((p) => p.t === 'error')).toEqual([]);
    lama.tutup();
    baru.tutup();
  });
});

describe('hasil putaran online: jeda lanjut dan ledekan (keputusan pemilik, 24 Okt 2026)', () => {
  /**
   * Mainkan putaran pertama lewat WebSocket sampai hasilnya tampil. Giliran manusia dipilih bot
   * normal dari view yang diterima tiap klien; warga kedai di kursi 2 dijalankan server.
   */
  async function sampaiHasil(klien: Klien[]): Promise<void> {
    const rng = new Rng(7);
    const sudah = new Map<Klien, number>();
    for (let i = 0; i < 3000; i++) {
      for (const k of klien) {
        const daftar = k.pesan.filter((p): p is Extract<PesanServer, { t: 'view' }> => p.t === 'view');
        const v = daftar.at(-1)?.view;
        if (!v) continue;
        if (v.status === 'putaranSelesai') return;
        // Satu aksi per view: view berikutnya datang sesudah aksi (atau aksi orang lain) diterapkan.
        if (sudah.get(k) === daftar.length) continue;
        const bisa =
          v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[v.saya!] : v.status === 'putaranBerjalan' && v.putaran!.giliran === v.saya;
        if (!bisa) continue;
        sudah.set(k, daftar.length);
        const { pemain: _, ...aksi } = pilihAksiBot(v, 'normal', rng) as { pemain: number };
        await k.kirim({ t: 'aksi', aksi } as Record<string, unknown>);
      }
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('putaran tidak selesai');
  }

  it('host dikunci sampai Budi Siap; ledekan Ani sampai ke Budi; teks bebas ditolak', async () => {
    const ani = new Klien(server.port);
    await ani.kirim({ t: 'buat', nama: 'Ani', pengaturan: { jumlahPemain: 3, detikGiliran: 0 } });
    const { kode } = await ani.tunggu('masuk');
    const budi = new Klien(server.port);
    await budi.kirim({ t: 'gabung', kode, nama: 'Budi' });
    await budi.tunggu('masuk');
    await ani.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
    await ani.tunggu('meja', (p) => p.info.kursi[2].jenis === 'bot');
    await ani.kirim({ t: 'mulai', pengocok: 0 });
    await ani.tunggu('meja', (p) => p.info.status === 'main');
    await ani.kirim({ t: 'siapJoker' });
    await budi.kirim({ t: 'siapJoker' });
    await ani.tunggu('meja', (p) => p.info.status === 'main' && p.info.menungguJoker.length === 0);
    await sampaiHasil([ani, budi]);

    // Bawaan server: jeda 10 detik, sisa waktu relatif.
    const info = (await ani.tunggu('meja', (p) => p.info.lanjut !== undefined)).info;
    expect(info.lanjut!.sisaMs).toBeGreaterThan(5_000);
    expect(info.lanjut!.sisaMs).toBeLessThanOrEqual(10_000);
    expect(info.lanjut!.siap).toEqual([]);
    await ani.kirim({ t: 'putaranBerikut' });
    await ani.tunggu('error', (p) => p.pesan === 'Tunggu sebentar, yang lain masih lihat kartu.');

    // Ledekan: diteruskan ke semua manusia, apa adanya.
    await ani.kirim({ t: 'ledek', ke: 1, isi: 'Makan tuh!' });
    expect(await budi.tunggu('ledek')).toEqual({ t: 'ledek', dari: 0, ke: 1, isi: 'Makan tuh!' });
    expect(await ani.tunggu('ledek')).toEqual({ t: 'ledek', dari: 0, ke: 1, isi: 'Makan tuh!' });
    await budi.kirim({ t: 'ledek', ke: 0, isi: 'ledekan karangan sendiri' } as Record<string, unknown>);
    await budi.tunggu('error', (p) => p.pesan === 'Pesan tidak dikenali.');
    expect(ani.pesan.filter((p) => p.t === 'ledek')).toHaveLength(1);

    // Budi siap: kunci lepas, host bisa lanjut.
    await budi.kirim({ t: 'siapLanjut' });
    await ani.tunggu('meja', (p) => p.info.status === 'main' && p.info.lanjut === undefined);
    await ani.kirim({ t: 'putaranBerikut' });
    await ani.tunggu('view', (p) => p.view.status === 'putaranBerjalan' && p.view.putaran!.nomor === 2);
    ani.tutup();
    budi.tutup();
  }, 20_000);
});
