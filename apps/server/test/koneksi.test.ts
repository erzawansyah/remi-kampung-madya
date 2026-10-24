// Perbaikan koneksi putus-putus di lapisan server (keputusan pemilik 24 Okt 2026):
// - kompresi permessage-deflate;
// - jeda singkat sebelum pemain yang sambungannya tertutup dianggap terputus (host, voting tetap);
// - tanda "sambungan baru" ke meja (sisa waktu minimal di giliran sendiri);
// - id aksi + konfirmasi `aksiDiterima`, kiriman ulang tidak diterapkan dua kali, aksi yang masih
//   datang lewat sambungan lama tetap diteruskan;
// - pong membawa jam server (`w`).

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { SISA_MIN_SAMBUNG_MS, TENGGANG_SAMBUNG_MS, type InfoMeja, type Penjadwal } from '@remi/meja';
import { JEDA_PUTUS_MS, jalankanServer, MAKS_ID_AKSI, type OpsiServer, type ServerRemi } from '../src/server.js';

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Penjadwal palsu: waktu hanya maju saat diminta (meja dan jeda putus di server memakainya). */
class JamUji implements Penjadwal {
  waktu = 1_800_000_000_000;
  private antrian: { id: number; t: number; fn: () => void }[] = [];
  private seq = 0;
  setel(ms: number, fn: () => void): unknown {
    const id = ++this.seq;
    this.antrian.push({ id, t: this.waktu + ms, fn });
    return id;
  }
  batal(h: unknown): void {
    this.antrian = this.antrian.filter((x) => x.id !== h);
  }
  sekarang(): number {
    return this.waktu;
  }
  maju(ms: number): void {
    const target = this.waktu + ms;
    for (;;) {
      this.antrian.sort((a, b) => a.t - b.t || a.id - b.id);
      const x = this.antrian[0];
      if (!x || x.t > target) break;
      this.antrian.shift();
      this.waktu = x.t;
      x.fn();
    }
    this.waktu = target;
  }
}

let server: ServerRemi | null = null;
async function nyalakan(opsi: Partial<OpsiServer> = {}) {
  server = await jalankanServer({ port: 0, host: '127.0.0.1', jedaBotMs: 5, log: () => undefined, ...opsi });
  return server;
}
afterEach(async () => {
  await server?.tutup();
  server = null;
});

type Pesan = { t: string; [k: string]: unknown };
interface Klien {
  ws: WebSocket;
  pesan: Pesan[];
  tutup: Promise<number>;
  kirim(x: unknown): void;
}
async function klien(port: number, opsi: WebSocket.ClientOptions = {}): Promise<Klien> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, opsi);
  const pesan: Pesan[] = [];
  ws.on('message', (d) => pesan.push(JSON.parse(d.toString())));
  ws.on('error', () => undefined);
  const tutup = new Promise<number>((ok) => ws.on('close', (kode) => ok(kode)));
  await new Promise((ok) => ws.on('open', ok));
  return { ws, pesan, tutup, kirim: (x) => ws.send(JSON.stringify(x)) };
}
async function tungguPesan(k: Klien, syarat: (p: Pesan) => boolean, ms = 3000): Promise<Pesan> {
  const mulai = Date.now();
  for (;;) {
    const p = [...k.pesan].reverse().find(syarat);
    if (p) return p;
    if (Date.now() - mulai > ms) throw new Error('pesan tidak datang');
    await tunggu(5);
  }
}
const info = (p: Pesan) => p.info as InfoMeja;
const mejaTerakhir = (k: Klien) => info([...k.pesan].reverse().find((p) => p.t === 'meja')!);

/** Frame teks WebSocket ber-mask (dari client), ditulis langsung ke soket tanpa lewat ws. */
function frameTeks(teks: string): Buffer {
  const isi = Buffer.from(teks);
  const mask = Buffer.from([7, 1, 9, 3]);
  const kepala =
    isi.length < 126 ? Buffer.from([0x81, 0x80 | isi.length]) : Buffer.from([0x81, 0x80 | 126, isi.length >> 8, isi.length & 0xff]);
  return Buffer.concat([kepala, mask, Buffer.from(isi.map((b, i) => b ^ mask[i % 4]))]);
}
const soket = (k: Klien) => (k.ws as unknown as { _socket: import('node:net').Socket })._socket;

/** Host Budi + Siti (manusia), opsional warga kedai; permainan dimulai dan joker di-OK semua. */
async function mejaMain(port: number, pengaturan: Record<string, unknown>, pengocok: number, wargaKedai = false) {
  const a = await klien(port);
  a.kirim({ t: 'buat', nama: 'Budi', pengaturan });
  const masukA = await tungguPesan(a, (p) => p.t === 'masuk');
  const b = await klien(port);
  b.kirim({ t: 'gabung', kode: masukA.kode, nama: 'Siti' });
  const masukB = await tungguPesan(b, (p) => p.t === 'masuk');
  if (wargaKedai) a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
  a.kirim({ t: 'mulai', pengocok });
  for (const k of [a, b]) {
    await tungguPesan(k, (p) => p.t === 'meja' && info(p).status === 'main');
    k.kirim({ t: 'siapJoker', putaran: 1 });
  }
  await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main' && info(p).menungguJoker.length === 0);
  return { a, b, kode: String(masukA.kode), tokenA: String(masukA.token), tokenB: String(masukB.token) };
}

describe('kompresi permessage-deflate', () => {
  it('dinegosiasikan dengan client ws; pesan besar sampai utuh dan di kabel jauh lebih kecil', async () => {
    const s = await nyalakan({ maksMejaPerIp: 1000, batasPesanPerDetik: 1000, putusPesanPerDetik: 5000 });
    const k = await klien(s.port);
    expect(k.ws.extensions).toContain('permessage-deflate');
    // 250 meja publik di lobi → jawaban 'daftar' ±22 KB.
    for (let i = 0; i < 250; i++) k.kirim({ t: 'buat', nama: `Meja ${i}`, pengaturan: { publik: true } });
    await tungguPesan(k, () => k.pesan.filter((p) => p.t === 'masuk').length === 250, 10_000);
    const sebelum = soket(k).bytesRead;
    k.kirim({ t: 'daftar' });
    const daftar = await tungguPesan(k, (p) => p.t === 'daftar', 5_000);
    const ukuran = JSON.stringify(daftar).length;
    expect(ukuran).toBeGreaterThan(20_000);
    expect((daftar.meja as unknown[]).length).toBe(250);
    expect(soket(k).bytesRead - sebelum).toBeLessThan(ukuran / 3);
    k.ws.close();
  }, 20_000);

  it('client tanpa dukungan kompresi tetap dilayani', async () => {
    const s = await nyalakan();
    const k = await klien(s.port, { perMessageDeflate: false });
    expect(k.ws.extensions).toBe('');
    k.kirim({ t: 'buat', nama: 'Budi' });
    await tungguPesan(k, (p) => p.t === 'meja');
    k.ws.close();
  });
});

describe('pong membawa jam server', () => {
  it('w = jam penjadwal server', async () => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const k = await klien(s.port);
    k.kirim({ t: 'ping' });
    const pong = await tungguPesan(k, (p) => p.t === 'pong');
    expect(pong).toEqual({ t: 'pong', w: jam.sekarang() });
    k.ws.close();
  });
});

describe('id aksi dan aksiDiterima', () => {
  it('aksi ber-id diterapkan sekali; kiriman ulang dengan id yang sama dijawab lagi tanpa diterapkan', async () => {
    const s = await nyalakan();
    const { a, b } = await mejaMain(s.port, { jumlahPemain: 2, detikGiliran: 0 }, 0);
    a.pesan.length = 0;
    a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'aksi-1' });
    await tungguPesan(a, (p) => p.t === 'aksiDiterima');
    // Jawaban datang sesudah meja memproses: view sesudah ambil deck sudah lebih dulu sampai.
    const iTerima = a.pesan.findIndex((p) => p.t === 'aksiDiterima');
    expect(a.pesan.slice(0, iTerima).some((p) => p.t === 'view' && (p.view as { putaran: { tahap: string } }).putaran.tahap === 'main')).toBe(true);
    a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'aksi-1' });
    await tungguPesan(a, () => a.pesan.filter((p) => p.t === 'aksiDiterima').length === 2);
    await tunggu(50);
    expect(a.pesan.filter((p) => p.t === 'aksiDiterima')).toEqual([
      { t: 'aksiDiterima', id: 'aksi-1' },
      { t: 'aksiDiterima', id: 'aksi-1' },
    ]);
    // Kalau diterapkan dua kali, mesin menolak "sudah ambil kartu".
    expect(a.pesan.filter((p) => p.t === 'error')).toEqual([]);
    a.ws.close();
    b.ws.close();
  });

  it('aksi yang ditolak: error lebih dulu, lalu aksiDiterima; aksi tanpa id tidak dijawab aksiDiterima', async () => {
    const s = await nyalakan();
    const { a, b } = await mejaMain(s.port, { jumlahPemain: 2, detikGiliran: 0 }, 0);
    b.pesan.length = 0;
    b.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'bukan-giliran' });
    await tungguPesan(b, (p) => p.t === 'aksiDiterima');
    expect(b.pesan.filter((p) => p.t === 'error' || p.t === 'aksiDiterima').map((p) => p.t)).toEqual(['error', 'aksiDiterima']);
    b.pesan.length = 0;
    b.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    await tungguPesan(b, (p) => p.t === 'error');
    await tunggu(50);
    expect(b.pesan.some((p) => p.t === 'aksiDiterima')).toBe(false);
    a.ws.close();
    b.ws.close();
  });

  it('id tidak sah: seluruh pesan ditolak; aksi ber-id sebelum masuk meja tetap dijawab', async () => {
    const s = await nyalakan();
    const k = await klien(s.port);
    k.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'ada spasi' });
    expect((await tungguPesan(k, (p) => p.t === 'error')).pesan).toBe('Pesan tidak dikenali.');
    k.pesan.length = 0;
    k.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'x1' });
    await tungguPesan(k, (p) => p.t === 'aksiDiterima');
    expect(k.pesan.map((p) => p.t)).toEqual(['error', 'aksiDiterima']);
    expect(k.pesan[0].pesan).toBe('Kamu belum masuk meja.');
    k.ws.close();
  });

  it(`id yang diingat dibatasi ${MAKS_ID_AKSI} terakhir per pemain`, async () => {
    const s = await nyalakan({ batasPesanPerDetik: 1000, putusPesanPerDetik: 5000 });
    const { a, b } = await mejaMain(s.port, { jumlahPemain: 2, detikGiliran: 0 }, 1);
    // Bukan giliran Budi: semua ditolak mesin, tapi id-nya tetap tercatat.
    for (let i = 0; i <= MAKS_ID_AKSI; i++) a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: `n${i}` });
    await tungguPesan(a, () => a.pesan.filter((p) => p.t === 'aksiDiterima').length === MAKS_ID_AKSI + 1);
    const error = a.pesan.filter((p) => p.t === 'error').length;
    // n0 sudah terlupa (diproses lagi, ditolak lagi); n1 masih diingat (tidak diproses).
    a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'n1' });
    a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'n0' });
    await tungguPesan(a, () => a.pesan.filter((p) => p.t === 'aksiDiterima').length === MAKS_ID_AKSI + 3);
    expect(a.pesan.filter((p) => p.t === 'error').length).toBe(error + 1);
    a.ws.close();
    b.ws.close();
  });
});

describe('aksi yang masih datang lewat sambungan lama', () => {
  it('diteruskan ke meja yang sama sekali saja; jawabannya lewat sambungan baru', async () => {
    const s = await nyalakan();
    const { a, b, kode, tokenA } = await mejaMain(s.port, { jumlahPemain: 2, detikGiliran: 0 }, 0);
    // Soket lama berhenti membaca (seperti sinyal setengah mati): salam penutup 4000 dari server tidak
    // pernah dijawab, jadi server masih menerima data dari soket itu.
    soket(a).pause();
    const a2 = await klien(s.port);
    a2.kirim({ t: 'gabung', kode, nama: 'Budi', token: tokenA });
    await tungguPesan(a2, (p) => p.t === 'masuk');
    a2.pesan.length = 0;
    soket(a).write(frameTeks(JSON.stringify({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'telat-1' })));
    expect(await tungguPesan(a2, (p) => p.t === 'aksiDiterima')).toEqual({ t: 'aksiDiterima', id: 'telat-1' });
    const view = await tungguPesan(a2, (p) => p.t === 'view');
    expect((view.view as { putaran: { tahap: string } }).putaran.tahap).toBe('main');
    // Client mengirim ulang aksi yang sama lewat sambungan baru: tidak diterapkan lagi.
    a2.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' }, id: 'telat-1' });
    await tungguPesan(a2, () => a2.pesan.filter((p) => p.t === 'aksiDiterima').length === 2);
    await tunggu(50);
    expect(a2.pesan.filter((p) => p.t === 'error')).toEqual([]);
    a.ws.terminate();
    a2.ws.close();
    b.ws.close();
  });

  it('pesan lain (bukan aksi) lewat sambungan lama tidak diteruskan', async () => {
    const s = await nyalakan();
    const { a, b, kode, tokenA } = await mejaMain(s.port, { jumlahPemain: 2, detikGiliran: 0 }, 1);
    soket(a).pause();
    const a2 = await klien(s.port);
    a2.kirim({ t: 'gabung', kode, nama: 'Budi', token: tokenA });
    await tungguPesan(a2, (p) => p.t === 'masuk');
    b.pesan.length = 0;
    soket(a).write(frameTeks(JSON.stringify({ t: 'emote', isi: 'GG' })));
    await tunggu(100);
    expect(b.pesan.some((p) => p.t === 'emote')).toBe(false);
    a.ws.terminate();
    a2.ws.close();
    b.ws.close();
  });
});

describe(`jeda ${JEDA_PUTUS_MS / 1000} detik sebelum dianggap terputus`, () => {
  async function sambunganTertutup(s: ServerRemi, k: Klien, jumlahSesudah: number) {
    k.ws.close();
    await k.tutup;
    for (let i = 0; i < 100 && s.jumlahSambungan() > jumlahSesudah; i++) await tunggu(5);
    expect(s.jumlahSambungan()).toBe(jumlahSesudah);
  }

  it('muat ulang cepat: pemain lain tidak pernah melihatnya terputus, host tetap', async () => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(s.port);
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Siti' });
    await tungguPesan(b, (p) => p.t === 'masuk');
    await tunggu(30);
    b.pesan.length = 0;
    await sambunganTertutup(s, a, 1);
    jam.maju(JEDA_PUTUS_MS - 1);
    const a2 = await klien(s.port);
    a2.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', token: masuk.token });
    expect((await tungguPesan(a2, (p) => p.t === 'masuk')).kursi).toBe(0);
    await tungguPesan(b, (p) => p.t === 'meja');
    // Jeda yang tersisa sudah dibatalkan: waktu maju pun tidak memutus Budi.
    jam.maju(60_000);
    await tunggu(50);
    expect(b.pesan.filter((p) => p.t === 'meja').every((p) => info(p).kursi[0].terhubung && info(p).host === 0)).toBe(true);
    expect(mejaTerakhir(b)).toMatchObject({ host: 0 });
    a2.ws.close();
    b.ws.close();
  });

  it('tidak kembali dalam jeda: baru dianggap terputus, host pindah', async () => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(s.port);
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Siti' });
    await tungguPesan(b, (p) => p.t === 'masuk');
    await tunggu(30);
    b.pesan.length = 0;
    await sambunganTertutup(s, a, 1);
    jam.maju(JEDA_PUTUS_MS - 1);
    await tunggu(30);
    expect(b.pesan.filter((p) => p.t === 'meja')).toEqual([]);
    jam.maju(1);
    const m = info(await tungguPesan(b, (p) => p.t === 'meja'));
    expect(m.kursi[0].terhubung).toBe(false);
    expect(m.host).toBe(1);
    b.ws.close();
  });

  it('kembali di gilirannya lewat sambungan baru: sisa waktu minimal; tenggang dihitung sejak tertutup', async () => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const { a, b, kode, tokenA } = await mejaMain(s.port, { jumlahPemain: 2, detikGiliran: 60 }, 0);
    const batas = mejaTerakhir(a).batasWaktu!;
    expect(batas).toBe(jam.sekarang() + 60_000);
    jam.maju(50_000);
    await sambunganTertutup(s, a, 1);
    jam.maju(2_000);
    const a2 = await klien(s.port);
    a2.kirim({ t: 'gabung', kode, nama: 'Budi', token: tokenA });
    await tungguPesan(a2, (p) => p.t === 'masuk');
    const m = info(await tungguPesan(a2, (p) => p.t === 'meja'));
    expect(m.batasWaktu).toBe(jam.sekarang() + SISA_MIN_SAMBUNG_MS);
    a2.ws.close();
    b.ws.close();
  });

  it('putus lebih lama dari tenggang: warga kedai menjalankan gilirannya, lalu masuk membawa dijalankanWarga', async () => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const { a, b, kode, tokenB } = await mejaMain(s.port, { jumlahPemain: 3, detikGiliran: 0 }, 1, true);
    await sambunganTertutup(s, b, 1);
    jam.maju(JEDA_PUTUS_MS);
    // Tenggang dihitung sejak sambungan tertutup, bukan sejak meja diberi tahu.
    jam.maju(TENGGANG_SAMBUNG_MS - JEDA_PUTUS_MS + 5);
    await tunggu(30);
    const b2 = await klien(s.port);
    b2.kirim({ t: 'gabung', kode, nama: 'Siti', token: tokenB });
    const masuk = await tungguPesan(b2, (p) => p.t === 'masuk');
    expect(masuk.dijalankanWarga).toBeGreaterThanOrEqual(1);
    a.ws.close();
    b2.ws.close();
  });

  // Selama jeda, meja masih mengira Siti tersambung. Kalau batas tunggu pengumuman joker habis di
  // jendela itu, Siti tidak boleh dicatat "sudah melihat": popupnya tidak tampil sampai habis.
  it.each([
    ['dalam jeda', 1_000],
    ['sesudah jeda', JEDA_PUTUS_MS + 1_000],
  ])('batas tunggu joker habis selagi kabar putus ditunda, kembali %s: popup joker muncul lagi untuknya saja', async (_, lewat) => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3, detikGiliran: 20 } });
    const masukA = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(s.port);
    b.kirim({ t: 'gabung', kode: masukA.kode, nama: 'Siti' });
    const masukB = await tungguPesan(b, (p) => p.t === 'masuk');
    a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
    a.kirim({ t: 'mulai', pengocok: 0 });
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main');
    a.kirim({ t: 'siapJoker', putaran: 1 });
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main' && info(p).menungguJoker.length === 1);
    // Sambungan Siti tertutup 3 dtk sebelum batas tunggu joker (20 dtk).
    jam.maju(17_000);
    await sambunganTertutup(s, b, 1);
    jam.maju(3_000);
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main' && info(p).menungguJoker.length === 0);
    jam.maju(lewat);
    await tunggu(30);
    a.pesan.length = 0;
    const b2 = await klien(s.port);
    b2.kirim({ t: 'gabung', kode: masukA.kode, nama: 'Siti', token: masukB.token });
    expect((await tungguPesan(b2, (p) => p.t === 'masuk')).kursi).toBe(1);
    expect(info(await tungguPesan(b2, (p) => p.t === 'meja')).menungguJoker).toEqual([1]);
    expect(info(await tungguPesan(a, (p) => p.t === 'meja')).menungguJoker).toEqual([]);
    a.ws.close();
    b2.ws.close();
  });

  it('sambungan tertutup sesudah batas tunggu joker habis, kembali dalam jeda: popup tidak muncul lagi', async () => {
    const jam = new JamUji();
    const s = await nyalakan({ penjadwal: jam });
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3, detikGiliran: 20 } });
    const masukA = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(s.port);
    b.kirim({ t: 'gabung', kode: masukA.kode, nama: 'Siti' });
    const masukB = await tungguPesan(b, (p) => p.t === 'masuk');
    a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
    a.kirim({ t: 'mulai', pengocok: 0 });
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main');
    a.kirim({ t: 'siapJoker', putaran: 1 });
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main' && info(p).menungguJoker.length === 1);
    // Popup Siti tampil sampai batas tunggu habis (ia masih tersambung), baru sesudahnya sambungannya tertutup.
    jam.maju(20_000);
    await tungguPesan(b, (p) => p.t === 'meja' && info(p).status === 'main' && info(p).menungguJoker.length === 0);
    jam.maju(3_000);
    await sambunganTertutup(s, b, 1);
    jam.maju(1_000);
    const b2 = await klien(s.port);
    b2.kirim({ t: 'gabung', kode: masukA.kode, nama: 'Siti', token: masukB.token });
    await tungguPesan(b2, (p) => p.t === 'masuk');
    expect(info(await tungguPesan(b2, (p) => p.t === 'meja')).menungguJoker).toEqual([]);
    a.ws.close();
    b2.ws.close();
  });
});

describe('sambungan baru selagi yang lama masih terbuka (client menutup yang lama belakangan)', () => {
  it('pemain lain tidak pernah melihatnya terputus, host tetap, sambungan lama ditutup 4000', async () => {
    const s = await nyalakan();
    const a = await klien(s.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(s.port);
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Siti' });
    await tungguPesan(b, (p) => p.t === 'masuk');
    await tunggu(30);
    b.pesan.length = 0;
    const a2 = await klien(s.port);
    a2.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', token: masuk.token });
    await tungguPesan(a2, (p) => p.t === 'masuk');
    expect(await a.tutup).toBe(4000);
    await tunggu(50);
    expect(b.pesan.filter((p) => p.t === 'meja').length).toBeGreaterThan(0);
    expect(b.pesan.filter((p) => p.t === 'meja').every((p) => info(p).kursi[0].terhubung && info(p).host === 0)).toBe(true);
    a2.ws.close();
    b.ws.close();
  });
});
