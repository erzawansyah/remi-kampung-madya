// Kompetisi di server (keputusan pemilik #51): penyimpan SQLite (pengajuan, ikut serta, mulai
// otomatis, batal, voting tutup, hasil per permainan, klasemen), API HTTP, dan meja kompetisi lewat
// WebSocket (pembuat dan yang gabung wajib membawa tiket peserta).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { BATAS_PENGAJUAN_MS, type PesanKlien, type PesanServer, type RingkasanAkhir } from '@remi/meja';
import { bukaRiwayat, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type ServerRemi } from '../src/server.js';

const JAM = 60 * 60 * 1000;
// Jauh di masa lalu: kompetisi di jam ini sudah lama selesai menurut jam sungguhan (tes meja WebSocket).
const T0 = Date.UTC(2025, 0, 10, 12);

const ajukan = (r: PenyimpanRiwayat, extra: Record<string, unknown> = {}, t = T0) =>
  r.kompetisi.ajukan({ nama: 'Remi Jumat', masa: 'minggu', pengaturan: { batasPutaran: 5 }, namaPengaju: 'Ani', ...extra }, t);

/** Kompetisi yang sudah jalan: Ani (pengaju), Budi, Cici, Dodi. */
function kompetisiJalan(r: PenyimpanRiwayat) {
  const { kode, token } = ajukan(r);
  const tiket: Record<string, string> = { Ani: token };
  for (const [i, nama] of ['Budi', 'Cici', 'Dodi'].entries()) tiket[nama] = r.kompetisi.ikut(kode, nama, T0 + (i + 1) * 1000).token;
  return { kode, tiket };
}

const ringkasan = (kompetisi: string, selesaiPada: number, pemain: [string, number, number, boolean?][]): RingkasanAkhir => {
  const urut = pemain.map(([nama, peserta, skor, keluar], kursi) => ({
    kursi,
    nama,
    bot: false,
    ...(keluar ? { keluar: true as const } : {}),
    skor,
    peringkat: 0,
    mentung: 0,
    kepentung: 0,
    peserta,
  }));
  return { kode: 'MEJAA', selesaiPada, alasan: 'batasPutaran', jumlahPutaran: 5, jumlahDeck: 1, modeKaldu: false, kompetisi, pemain: urut };
};

describe('penyimpan kompetisi', () => {
  it('pengajuan jalan sendiri begitu peserta ke-4 ikut; masa berlaku dihitung dari situ', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, token } = ajukan(r);
    expect(kode).toMatch(/^[A-Z2-9]{5}$/);
    expect(r.kompetisi.detail(kode, T0, token)).toMatchObject({
      status: 'pengajuan',
      peserta: ['Ani'],
      jumlahPeserta: 1,
      minPeserta: 4,
      pengaturan: { batasPutaran: 5 },
      saya: { nama: 'Ani', setujuTutup: false },
    });
    r.kompetisi.ikut(kode, 'Budi', T0 + 1);
    r.kompetisi.ikut(kode, 'Cici', T0 + 2);
    expect(r.kompetisi.status(kode, T0 + 3)).toBe('pengajuan');
    r.kompetisi.ikut(kode, 'Dodi', T0 + JAM);
    const d = r.kompetisi.detail(kode, T0 + JAM)!;
    expect(d).toMatchObject({ status: 'berjalan', mulaiPada: T0 + JAM, berakhirPada: T0 + JAM + 7 * 24 * JAM, jumlahPeserta: 4 });
    expect(d.saya).toBeUndefined();
    // Ikut serta sesudah jalan tetap boleh.
    r.kompetisi.ikut(kode, 'Eko', T0 + 2 * JAM);
    expect(r.kompetisi.detail(kode, T0 + 2 * JAM)!.peserta).toEqual(['Ani', 'Budi', 'Cici', 'Dodi', 'Eko']);
    expect(r.kompetisi.status(kode, T0 + JAM + 7 * 24 * JAM)).toBe('selesai');
    expect(() => r.kompetisi.ikut(kode, 'Fafa', T0 + JAM + 7 * 24 * JAM)).toThrow(/sudah selesai/);
    r.tutup();
  });

  it('nama kembar (tanpa beda huruf besar/kecil) ditolak; isian rusak ditolak', () => {
    const r = bukaRiwayat(':memory:');
    const { kode } = ajukan(r);
    expect(() => r.kompetisi.ikut(kode, ' ani ', T0)).toThrow(/sudah ikut kompetisi ini/);
    expect(() => r.kompetisi.ikut(kode, '', T0)).toThrow(/Isi namamu/);
    expect(() => r.kompetisi.ikut('ZZZZZ', 'Budi', T0)).toThrow(/nggak ketemu/);
    expect(() => ajukan(r, { nama: '   ' })).toThrow(/nama kompetisinya/);
    expect(() => ajukan(r, { masa: 'tahun' })).toThrow(/lama kompetisinya/);
    r.tutup();
  });

  it('pengajuan yang 24 jam belum cukup peserta batal, tidak bisa diikuti, dan hilang dari daftar', () => {
    const r = bukaRiwayat(':memory:');
    const { kode } = ajukan(r);
    expect(r.kompetisi.daftar(T0).map((k) => k.kode)).toEqual([kode]);
    expect(r.kompetisi.jumlahPengajuan(T0)).toBe(1);
    const lewat = T0 + BATAS_PENGAJUAN_MS;
    expect(r.kompetisi.status(kode, lewat)).toBe('batal');
    expect(() => r.kompetisi.ikut(kode, 'Budi', lewat)).toThrow(/batal/);
    expect(r.kompetisi.daftar(lewat)).toEqual([]);
    expect(r.kompetisi.jumlahPengajuan(lewat)).toBe(0);
    r.tutup();
  });

  it('tiket: hanya token peserta kompetisi itu yang cocok', () => {
    const r = bukaRiwayat(':memory:');
    const a = kompetisiJalan(r);
    const b = ajukan(r, { namaPengaju: 'Budi' });
    expect(r.kompetisi.cekTiket(a.kode, a.tiket.Budi)).toMatchObject({ nama: 'Budi' });
    expect(r.kompetisi.cekTiket(a.kode.toLowerCase(), a.tiket.Budi)).toMatchObject({ nama: 'Budi' });
    expect(r.kompetisi.cekTiket(a.kode, b.token)).toBeNull();
    expect(r.kompetisi.cekTiket(a.kode, 'palsu')).toBeNull();
    expect(r.kompetisi.cekTiket(a.kode, '')).toBeNull();
    r.tutup();
  });

  it('hasil meja kompetisi dicatat lewat riwayat.simpan; klasemen dan juara', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, tiket } = kompetisiJalan(r);
    const id = (nama: string) => r.kompetisi.cekTiket(kode, tiket[nama])!.id;
    const t = T0 + JAM;
    for (let i = 0; i < 3; i++) {
      r.simpan(ringkasan(kode, t + i, [['Ani', id('Ani'), 100], ['Budi', id('Budi'), 50], ['Cici', id('Cici'), -20], ['Dodi', id('Dodi'), -130]]));
    }
    // Budi juara, Dodi keluar (juru kunci walau skornya tinggi).
    r.simpan(ringkasan(kode, t + 3, [['Budi', id('Budi'), 80], ['Dodi', id('Dodi'), 300, true], ['Cici', id('Cici'), 0]]));
    const d = r.kompetisi.detail(kode, t + 4)!;
    expect(d.jumlahPermainan).toBe(4);
    expect(d.peringkat.map((b) => [b.nama, b.main, b.poin, b.juara])).toEqual([
      ['Ani', 3, 9, 3],
      ['Budi', 4, 8, 1],
      ['Cici', 4, 4, 0],
      ['Dodi', 4, 0, 0],
    ]);
    expect(d.peringkat[3]).toMatchObject({ keluar: 1 });
    // Skor yang keluar = skor terendah di meja itu (seperti leaderboard #45).
    expect(d.peringkat[3].rataSkor).toBe((-130 * 3 + 0) / 4);
    // Permainan tetap masuk riwayat biasa.
    expect(r.daftar(10)).toHaveLength(4);

    // Selesai sesudah kompetisinya berakhir: tidak dihitung.
    r.simpan(ringkasan(kode, T0 + 1000 * JAM, [['Cici', id('Cici'), 999], ['Dodi', id('Dodi'), 0]]));
    expect(r.kompetisi.detail(kode, T0 + 1000 * JAM)!.jumlahPermainan).toBe(4);
    expect(r.kompetisi.daftar(T0 + 1000 * JAM)).toEqual([expect.objectContaining({ kode, status: 'selesai', juara: ['Ani'] })]);
    r.tutup();
  });

  it('voting tutup: lebih dari separuh peserta setuju, kompetisi selesai saat itu juga', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, tiket } = kompetisiJalan(r);
    const t = T0 + JAM;
    r.kompetisi.setujuTutup(kode, tiket.Ani, true, t);
    r.kompetisi.setujuTutup(kode, tiket.Budi, true, t);
    expect(r.kompetisi.detail(kode, t, tiket.Ani)).toMatchObject({ status: 'berjalan', setujuTutup: 2, saya: { setujuTutup: true } });
    // Batal setuju lalu setuju lagi tidak dihitung dobel.
    r.kompetisi.setujuTutup(kode, tiket.Budi, false, t);
    r.kompetisi.setujuTutup(kode, tiket.Budi, true, t);
    expect(r.kompetisi.status(kode, t)).toBe('berjalan');
    r.kompetisi.setujuTutup(kode, tiket.Cici, true, t + 5);
    expect(r.kompetisi.detail(kode, t + 10)).toMatchObject({ status: 'selesai', berakhirPada: t + 5 });
    expect(() => r.kompetisi.setujuTutup(kode, tiket.Dodi, true, t + 10)).toThrow(/sedang jalan/);
    expect(() => r.kompetisi.setujuTutup(kode, 'palsu', true, t)).toThrow(/belum ikut/);
    r.tutup();
  });

  it('pengajuan belum bisa disudahi lewat voting', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, token } = ajukan(r);
    expect(() => r.kompetisi.setujuTutup(kode, token, true, T0)).toThrow(/sedang jalan/);
    r.tutup();
  });
});

class Klien {
  pesan: PesanServer[] = [];
  private ws: WebSocket;
  private terbuka: Promise<void>;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (d) => this.pesan.push(JSON.parse(d.toString())));
    this.terbuka = new Promise((ok) => this.ws.on('open', () => ok()));
  }
  async kirim(p: PesanKlien) {
    await this.terbuka;
    this.ws.send(JSON.stringify(p));
  }
  async tunggu<T extends PesanServer['t']>(t: T, syarat: (p: Extract<PesanServer, { t: T }>) => boolean = () => true): Promise<Extract<PesanServer, { t: T }>> {
    const mulai = Date.now();
    for (;;) {
      const p = [...this.pesan].reverse().find((x) => x.t === t && syarat(x as never));
      if (p) return p as Extract<PesanServer, { t: T }>;
      if (Date.now() - mulai > 3000) throw new Error(`tidak menerima ${t}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  tutup() {
    this.ws.close();
  }
}

describe('API dan meja kompetisi', () => {
  let server: ServerRemi;
  let riwayat: PenyimpanRiwayat;
  let alamat: string;
  beforeAll(async () => {
    riwayat = bukaRiwayat(':memory:');
    server = await jalankanServer({ port: 0, host: '127.0.0.1', riwayat, log: () => undefined, maksPengajuanPerIp: 2 });
    alamat = `http://127.0.0.1:${server.port}`;
  });
  afterAll(async () => {
    await server.tutup();
    riwayat.tutup();
  });

  const post = (jalur: string, isi: unknown, header: Record<string, string> = {}) =>
    fetch(`${alamat}${jalur}`, { method: 'POST', headers: { 'content-type': 'application/json', ...header }, body: JSON.stringify(isi) });

  it('ajukan, ikut serta sampai jalan, detail dengan tiket, daftar', async () => {
    const r1 = await post('/api/kompetisi', { nama: 'Malam Minggu', masa: 'malam', pengaturan: { modeKaldu: true }, namaPengaju: 'Ani' });
    expect(r1.status).toBe(200);
    const a = (await r1.json()) as { kode: string; token: string; detail: { status: string; saya: { nama: string } } };
    expect(a.detail).toMatchObject({ status: 'pengajuan', saya: { nama: 'Ani' } });
    for (const nama of ['Budi', 'Cici']) expect((await post(`/api/kompetisi/${a.kode}/ikut`, { nama })).status).toBe(200);
    const kembar = await post(`/api/kompetisi/${a.kode}/ikut`, { nama: 'budi' });
    expect(kembar.status).toBe(409);
    expect(((await kembar.json()) as { error: string }).error).toMatch(/sudah ikut/);
    const r4 = await post(`/api/kompetisi/${a.kode.toLowerCase()}/ikut`, { nama: 'Dodi' });
    expect(((await r4.json()) as { detail: { status: string } }).detail.status).toBe('berjalan');

    const detail = await fetch(`${alamat}/api/kompetisi/${a.kode}`, { headers: { 'x-tiket-kompetisi': a.token } });
    expect(await detail.json()).toMatchObject({ v: 1, status: 'berjalan', pengaturan: { modeKaldu: true }, saya: { nama: 'Ani' } });
    const tanpa = (await (await fetch(`${alamat}/api/kompetisi/${a.kode}`)).json()) as Record<string, unknown>;
    expect(tanpa.saya).toBeUndefined();
    const daftar = (await (await fetch(`${alamat}/api/kompetisi`)).json()) as { v: number; kompetisi: { kode: string }[] };
    expect(daftar.kompetisi.map((k) => k.kode)).toContain(a.kode);
    expect((await fetch(`${alamat}/api/kompetisi/ZZZZZ`)).status).toBe(404);
    expect((await fetch(`${alamat}/api/kompetisi/x/y/z`)).status).toBe(404);
  });

  it('POST ditolak tanpa JSON, dari asal lain, isi rusak, atau kebanyakan pengajuan', async () => {
    const bukanJson = await fetch(`${alamat}/api/kompetisi`, { method: 'POST', body: 'nama=x' });
    expect(bukanJson.status).toBe(403);
    expect((await post('/api/kompetisi', {}, { origin: 'https://jahat.example' })).status).toBe(403);
    const rusak = await fetch(`${alamat}/api/kompetisi`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(rusak.status).toBe(400);
    expect((await post('/api/kompetisi', { nama: 'x', masa: 'abad', namaPengaju: 'Ani' })).status).toBe(400);
    // Satu pengajuan dari tes sebelumnya sudah jalan, jadi tidak dihitung; batas di tes ini 2.
    expect((await post('/api/kompetisi', { nama: 'A', masa: 'malam', namaPengaju: 'Ani' })).status).toBe(200);
    expect((await post('/api/kompetisi', { nama: 'B', masa: 'malam', namaPengaju: 'Ani' })).status).toBe(200);
    const ketiga = await post('/api/kompetisi', { nama: 'C', masa: 'malam', namaPengaju: 'Ani' });
    expect(ketiga.status).toBe(429);
  });

  it('meja kompetisi: pembuat dan yang gabung wajib peserta, nama kursi = nama terdaftar', async () => {
    const { kode, tiket } = kompetisiJalan(riwayat);
    // kompetisiJalan memakai jam T0; jalankan ulang di jam sekarang supaya kompetisinya berjalan.
    const sekarang = Date.now();
    const baru = riwayat.kompetisi.ajukan({ nama: 'Meja Uji', masa: 'malam', pengaturan: { batasPutaran: 2 }, namaPengaju: 'Ani' }, sekarang);
    const t: Record<string, string> = { Ani: baru.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) t[nama] = riwayat.kompetisi.ikut(baru.kode, nama, sekarang).token;
    expect(riwayat.kompetisi.status(baru.kode, Date.now())).toBe('berjalan');

    const tamu = new Klien(server.port);
    await tamu.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode: baru.kode, token: 'palsu' } });
    expect((await tamu.tunggu('error')).pesan).toMatch(/belum ikut kompetisi/);
    // Kompetisi yang sudah selesai (kompetisiJalan di jam T0, masa 1 minggu) tidak bisa dipakai.
    await tamu.kirim({ t: 'buat', nama: 'Budi', kompetisi: { kode, token: tiket.Budi } });
    expect((await tamu.tunggu('error', (p) => /sudah selesai/.test(p.pesan))).pesan).toMatch(/sudah selesai/);

    const ani = new Klien(server.port);
    await ani.kirim({ t: 'buat', nama: 'Nama Lain', pengaturan: { jumlahPemain: 2, batasPutaran: 9 }, kompetisi: { kode: baru.kode, token: t.Ani } });
    const masuk = await ani.tunggu('masuk');
    const info = (await ani.tunggu('meja')).info;
    expect(info.kompetisi).toEqual({ kode: baru.kode, nama: 'Meja Uji' });
    expect(info.kursi[0].nama).toBe('Ani');
    expect(info.pengaturan.batasPutaran).toBe(2);

    await tamu.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Tamu' });
    expect((await tamu.tunggu('error', (p) => /khusus peserta/.test(p.pesan))).pesan).toMatch(/Ikut serta dulu/);
    const budi = new Klien(server.port);
    await budi.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Siapa', tiket: [{ kode: 'QQQQQ', token: 'x' }, { kode: baru.kode, token: t.Budi }] });
    expect((await budi.tunggu('masuk')).kursi).toBe(1);
    await ani.tunggu('meja', (p) => p.info.kursi[1].nama === 'Budi');
    for (const k of [tamu, ani, budi]) k.tutup();
  });
});

describe('ketahanan pencatatan hasil', () => {
  it('peserta yang tidak ada di database: klasemen akhir biasa tetap tersimpan', () => {
    const log: string[] = [];
    const r = bukaRiwayat(':memory:', { log: (...x) => log.push(x.map(String).join(' ')) });
    const { kode, tiket } = kompetisiJalan(r);
    const ani = r.kompetisi.cekTiket(kode, tiket.Ani)!;
    // Peserta sah dulu, lalu yang tidak ada: hasilnya tidak tercatat setengah.
    const id = r.simpan(ringkasan(kode, T0 + JAM, [['Ani', ani.id, 10], ['Hantu', 9999, 50]]));
    expect(id).toBeGreaterThan(0);
    expect(r.daftar(5)).toHaveLength(1);
    expect(r.kompetisi.detail(kode, T0 + JAM)!.jumlahPermainan).toBe(0);
    expect(log.some((l) => l.includes('galat mencatat hasil kompetisi'))).toBe(true);
    r.tutup();
  });
});
