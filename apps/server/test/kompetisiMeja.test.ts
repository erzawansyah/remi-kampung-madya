// Meja kompetisi di server, perbaikan sesudah tinjauan versi 2 (24 Okt 2026):
// - isian pengajuan lewat API: batas putaran dan waktu per giliran hanya pilihan formulir;
// - lobi kompetisi: yang menutup aplikasi langsung dianggap terputus (hitung mundur mulai sendiri batal);
// - kursi lobi kompetisi yang sudah dilepas: sambung ulang dengan tiket duduk lagi, kalau tidak bisa
//   dapat pesan `keluar` yang ramah (dengan kode kompetisinya), bukan galat "Ikut serta dulu";
// - selama server dimatikan, juara kompetisi tidak dikunci (API menjawab 503).

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { TEKS_KURSI_KOMPETISI_LEPAS, TENGGANG_SAMBUNG_MS, type InfoMeja, type Penjadwal } from '@remi/meja';
import type { DetailKompetisi } from '../src/kompetisi.js';
import { bukaRiwayat, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type OpsiServer, type ServerRemi } from '../src/server.js';

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Penjadwal palsu: waktu hanya maju saat diminta (meja, jeda putus, dan jam kompetisi memakainya). */
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

const dibuka: { server: ServerRemi; riwayat: PenyimpanRiwayat }[] = [];
async function nyalakan(opsi: Partial<OpsiServer> = {}) {
  const riwayat = bukaRiwayat(':memory:');
  const server = await jalankanServer({ port: 0, host: '127.0.0.1', jedaBotMs: 5, riwayat, log: () => undefined, ...opsi });
  dibuka.push({ server, riwayat });
  return { server, riwayat, alamat: `http://127.0.0.1:${server.port}` };
}
afterEach(async () => {
  for (const d of dibuka.splice(0)) {
    await d.server.tutup();
    d.riwayat.tutup();
  }
});

type Pesan = { t: string; [k: string]: unknown };
interface Klien {
  ws: WebSocket;
  pesan: Pesan[];
  kirim(x: unknown): void;
}
async function klien(port: number): Promise<Klien> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const pesan: Pesan[] = [];
  ws.on('message', (d) => pesan.push(JSON.parse(d.toString())));
  ws.on('error', () => undefined);
  await new Promise((ok) => ws.on('open', ok));
  return { ws, pesan, kirim: (x) => ws.send(JSON.stringify(x)) };
}
/** Tunggu pesan yang memenuhi syarat di antara pesan sesudah indeks `sejak` (yang terbaru dulu). */
async function tungguPesan(k: Klien, syarat: (p: Pesan) => boolean, ms = 3000, sejak = 0): Promise<Pesan> {
  const mulai = Date.now();
  for (;;) {
    const p = k.pesan.slice(sejak).reverse().find(syarat);
    if (p) return p;
    if (Date.now() - mulai > ms) throw new Error('pesan tidak datang');
    await tunggu(5);
  }
}
const info = (p: Pesan) => p.info as InfoMeja;
const mejaTerakhir = (k: Klien) => info([...k.pesan].reverse().find((p) => p.t === 'meja')!);
/** Tunggu info meja yang memenuhi syarat, hanya dari pesan yang datang sesudah tanda(k) terakhir. */
const tanda = new Map<Klien, number>();
const tandai = (k: Klien) => tanda.set(k, k.pesan.length);
const tungguMeja = (k: Klien, syarat: (i: InfoMeja) => boolean) =>
  tungguPesan(k, (p) => p.t === 'meja' && syarat(info(p)), 3000, tanda.get(k) ?? 0);

/** Kompetisi yang sedang berjalan pada jam `t`: Ani (pengaju), Budi, Cici, Dodi. */
function kompetisiJalan(r: PenyimpanRiwayat, t: number, pengaturan: Record<string, unknown>) {
  const a = r.kompetisi.ajukan({ nama: 'Malam Kedai', masa: 'malam', pengaturan, namaPengaju: 'Ani' }, t);
  const tiket: Record<string, string> = { Ani: a.token };
  for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = r.kompetisi.ikut(a.kode, nama, t).token;
  expect(r.kompetisi.status(a.kode, t)).toBe('berjalan');
  return { kode: a.kode, tiket };
}

/** Peserta duduk di meja kompetisi `meja` lewat tiketnya (seperti tombol Duduk). */
async function duduk(port: number, meja: string, kompetisi: string, nama: string, token: string) {
  const k = await klien(port);
  k.kirim({ t: 'gabung', kode: meja, nama, tiket: [{ kode: kompetisi, token }] });
  const masuk = await tungguPesan(k, (p) => p.t === 'masuk');
  return { k, token: String(masuk.token), kursi: Number(masuk.kursi) };
}

describe('pengajuan lewat API', () => {
  it('batas putaran dan waktu per giliran hanya pilihan formulir; "tanpa batas" lewat angka besar atau 0 jatuh ke bawaan', async () => {
    const { alamat } = await nyalakan({ maksPengajuanPerIp: 10 });
    const ajukan = async (pengaturan: Record<string, unknown>) => {
      const r = await fetch(`${alamat}/api/kompetisi`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nama: 'Uji', masa: 'malam', pengaturan, namaPengaju: 'Ani' }),
      });
      expect(r.status).toBe(200);
      return ((await r.json()) as { detail: DetailKompetisi }).detail.pengaturan;
    };
    expect(await ajukan({ batasPutaran: 100000, detikGiliran: 0 })).toMatchObject({ batasPutaran: 5, detikGiliran: 60 });
    expect(await ajukan({ batasPutaran: 1, detikGiliran: 600 })).toMatchObject({ batasPutaran: 5, detikGiliran: 60 });
    expect(await ajukan({ batasPutaran: 20, detikGiliran: 30, jumlahPemain: 6 })).toMatchObject({ batasPutaran: 20, detikGiliran: 30, jumlahPemain: 6 });
  });
});

describe('lobi meja kompetisi', () => {
  it('yang menutup aplikasi langsung dianggap terputus: hitung mundur mulai sendiri batal tanpa menunggu jeda putus', async () => {
    const jam = new JamUji();
    const { server, riwayat } = await nyalakan({ penjadwal: jam, jedaMulaiKompetisiMs: 2000 });
    const { kode, tiket } = kompetisiJalan(riwayat, jam.waktu, { jumlahPemain: 3 });
    const ani = await klien(server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode, token: tiket.Ani } });
    const meja = String((await tungguPesan(ani, (p) => p.t === 'masuk')).kode);
    await duduk(server.port, meja, kode, 'Budi', tiket.Budi);
    const cici = await duduk(server.port, meja, kode, 'Cici', tiket.Cici);
    await tungguMeja(ani, (i) => !!i.mulaiOtomatis);
    // Aplikasi Cici tertutup selama hitung mundur: meja langsung tahu (jam tidak dimajukan sama sekali).
    tandai(ani);
    cici.k.ws.close();
    await tungguMeja(ani, (i) => i.kursi[2].jenis === 'manusia' && i.kursi[2].terhubung === false && !i.mulaiOtomatis);
    jam.maju(5000);
    expect(mejaTerakhir(ani).status).toBe('lobi');
    // Cici kembali (muat ulang): duduk di kursinya lagi, hitung mundur dari awal, lalu mulai.
    const cici2 = await klien(server.port);
    tandai(ani);
    cici2.kirim({ t: 'gabung', kode: meja, nama: 'Cici', token: cici.token });
    await tungguPesan(cici2, (p) => p.t === 'masuk');
    await tungguMeja(ani, (i) => !!i.mulaiOtomatis);
    jam.maju(2000);
    await tungguMeja(ani, (i) => i.status === 'main');
  });

  it('kursi yang dilepas karena lama terputus: sambung ulang dengan tiket duduk lagi; kalau tidak bisa, pesan keluar yang ramah', async () => {
    const jam = new JamUji();
    const { server, riwayat } = await nyalakan({ penjadwal: jam, jedaMulaiKompetisiMs: 2000 });
    const { kode, tiket } = kompetisiJalan(riwayat, jam.waktu, { jumlahPemain: 3 });
    const ani = await klien(server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode, token: tiket.Ani } });
    const meja = String((await tungguPesan(ani, (p) => p.t === 'masuk')).kode);
    const budi = await duduk(server.port, meja, kode, 'Budi', tiket.Budi);

    // Budi terputus lebih lama dari masa tenggang selagi Ani menunggu: kursinya dilepas.
    tandai(ani);
    budi.k.ws.close();
    await tungguMeja(ani, (i) => i.kursi[1].jenis === 'manusia' && i.kursi[1].terhubung === false);
    tandai(ani);
    jam.maju(TENGGANG_SAMBUNG_MS);
    await tungguMeja(ani, (i) => i.kursi[1].jenis === 'kosong');

    // (a) Sambung ulang seperti aplikasi (token lama + tiket): duduk lagi, dengan token baru.
    const budi2 = await klien(server.port);
    tandai(ani);
    budi2.kirim({ t: 'gabung', kode: meja, nama: 'Budi', token: budi.token, tiket: [{ kode, token: tiket.Budi }] });
    const masuk2 = await tungguPesan(budi2, (p) => p.t === 'masuk' || p.t === 'error' || p.t === 'keluar');
    expect(masuk2).toMatchObject({ t: 'masuk', kursi: 1 });
    expect(masuk2.token).not.toBe(budi.token);
    await tungguMeja(ani, (i) => i.kursi[1].jenis === 'manusia' && i.kursi[1].nama === 'Budi' && i.kursi[1].terhubung);

    // (b) Dilepas lagi, lalu kursinya diisi Cici dan Dodi: sambung ulang tidak bisa duduk.
    tandai(ani);
    budi2.ws.close();
    await tungguMeja(ani, (i) => i.kursi[1].jenis === 'manusia' && i.kursi[1].terhubung === false);
    tandai(ani);
    jam.maju(TENGGANG_SAMBUNG_MS);
    await tungguMeja(ani, (i) => i.kursi[1].jenis === 'kosong');
    tandai(ani);
    await duduk(server.port, meja, kode, 'Cici', tiket.Cici);
    await duduk(server.port, meja, kode, 'Dodi', tiket.Dodi);
    await tungguMeja(ani, (i) => i.kursi.every((k) => k.jenis === 'manusia'));
    const budi3 = await klien(server.port);
    budi3.kirim({ t: 'gabung', kode: meja, nama: 'Budi', token: String(masuk2.token), tiket: [{ kode, token: tiket.Budi }] });
    expect(await tungguPesan(budi3, (p) => p.t === 'masuk' || p.t === 'error' || p.t === 'keluar')).toEqual({
      t: 'keluar',
      alasan: TEKS_KURSI_KOMPETISI_LEPAS,
      kompetisi: kode,
    });
    // Aplikasi lama (sambung ulang tanpa tiket): juga keluar yang ramah, bukan "Ikut serta dulu".
    const budi4 = await klien(server.port);
    budi4.kirim({ t: 'gabung', kode: meja, nama: 'Budi', token: String(masuk2.token) });
    expect(await tungguPesan(budi4, (p) => p.t === 'masuk' || p.t === 'error' || p.t === 'keluar')).toMatchObject({
      t: 'keluar',
      alasan: TEKS_KURSI_KOMPETISI_LEPAS,
    });
    // Tamu tanpa token dan tanpa tiket tetap mendapat galat biasa.
    const tamu = await klien(server.port);
    tamu.kirim({ t: 'gabung', kode: meja, nama: 'Tamu' });
    expect((await tungguPesan(tamu, (p) => p.t === 'error')).pesan).toMatch(/khusus peserta kompetisi/);
  });

  it('meja biasa tidak berubah: kabar putus tetap ditunda, token yang tidak dikenal duduk sebagai pemain baru', async () => {
    const jam = new JamUji();
    const { server } = await nyalakan({ penjadwal: jam });
    const ani = await klien(server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', pengaturan: { jumlahPemain: 3 } });
    const meja = String((await tungguPesan(ani, (p) => p.t === 'masuk')).kode);
    const budi = await klien(server.port);
    budi.kirim({ t: 'gabung', kode: meja, nama: 'Budi' });
    await tungguPesan(budi, (p) => p.t === 'masuk');
    budi.ws.close();
    await tunggu(100);
    expect(mejaTerakhir(ani).kursi[1].terhubung).toBe(true);
    const cici = await klien(server.port);
    cici.kirim({ t: 'gabung', kode: meja, nama: 'Cici', token: 'token-asing' });
    expect(await tungguPesan(cici, (p) => p.t === 'masuk')).toMatchObject({ kursi: 2 });
  });
});

describe('server dimatikan', () => {
  it('selama tutup(): API menjawab 503 dan juara kompetisi yang mejanya masih main tidak dikunci', async () => {
    const { server, riwayat, alamat } = await nyalakan({ jedaMulaiKompetisiMs: 20, jedaLanjutMs: 0 });
    const { kode, tiket } = kompetisiJalan(riwayat, Date.now(), { jumlahPemain: 2 });
    const ani = await klien(server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode, token: tiket.Ani } });
    const meja = String((await tungguPesan(ani, (p) => p.t === 'masuk')).kode);
    await duduk(server.port, meja, kode, 'Budi', tiket.Budi);
    await tungguMeja(ani, (i) => i.status === 'main');
    for (const nama of ['Ani', 'Budi', 'Cici']) riwayat.kompetisi.setujuTutup(kode, tiket[nama], true, Date.now());
    const sebelum = (await (await fetch(`${alamat}/api/kompetisi/${kode}`)).json()) as DetailKompetisi;
    expect(sebelum).toMatchObject({ status: 'selesai', mejaMain: 1 });
    expect(sebelum.juara).toBeUndefined();

    // HP Ani tidak menjawab salam penutup (sinyal jelek): penutupan menunggu sampai 1 detik.
    ani.ws.pause();
    const selesai = server.tutup();
    await tunggu(50);
    const r = await fetch(`${alamat}/api/kompetisi/${kode}`);
    expect(r.status).toBe(503);
    expect((await fetch(`${alamat}/api/peringkat?v=2`)).status).toBe(503);
    await selesai;
    // Juara belum dikunci: begitu mejanya (dipulihkan sesudah restart) selesai, hasilnya masih dihitung.
    const tanpaMeja = { mejaMain: () => 0, mejaMenunggu: () => [] };
    expect(riwayat.kompetisi.detail(kode, Date.now(), null, { ...tanpaMeja, mejaMain: () => 1 })!.juara).toBeUndefined();
    expect(riwayat.kompetisi.tetapkanJuara(Date.now(), { ...tanpaMeja, tahanJuara: () => true })).toEqual([]);
    expect(riwayat.kompetisi.detail(kode, Date.now(), null, { ...tanpaMeja, tahanJuara: () => true })!.juara).toBeUndefined();
    // Sesudah server jalan lagi dan tidak ada meja yang main, juara baru ditetapkan.
    expect(riwayat.kompetisi.tetapkanJuara(Date.now(), tanpaMeja)).toEqual([kode]);
    ani.ws.terminate();
  });
});
