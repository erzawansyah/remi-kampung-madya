// Meja selamat dari restart/deploy server (rencana koneksi langkah 9 "Lengkap", keputusan pemilik
// 24 Okt 2026): DataMeja disimpan di SQLite (tabel meja_aktif, migrasi v4), ditulis tertunda sebentar
// sesudah berubah dan langsung saat tutup(), lalu dipulihkan saat server mulai. Pemain kembali ke
// kursinya lewat `gabung` dengan token lama.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import { TENGGANG_SAMBUNG_MS, type InfoMeja, type Penjadwal } from '@remi/meja';
import { bukaRiwayat, type PenyimpanRiwayat } from '../src/riwayat.js';
import { bacaDataMeja } from '../src/mejaAktif.js';
import {
  BAWAAN_HAPUS_MEJA_KOSONG_MS,
  BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS,
  batasMejaKosongMs,
  JEDA_SIMPAN_MEJA_MS,
  jalankanServer,
  UMUR_MAKS_SIMPANAN_MEJA_MS,
  type OpsiServer,
  type ServerRemi,
} from '../src/server.js';

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Penjadwal palsu: waktu hanya maju saat diminta (meja, jeda putus, dan jeda simpan memakainya). */
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

const folder = mkdtempSync(join(tmpdir(), 'remi-simpan-meja-'));
let nomorDb = 0;
/** Path database baru (file sungguhan, supaya "server baru dengan file database yang sama"). */
const dbBaru = () => join(folder, `remi-${++nomorDb}.db`);

const dibuka: { server: ServerRemi | null; riwayat: PenyimpanRiwayat | null; db: DatabaseSync | null }[] = [];
async function nyalakan(path: string, opsi: Partial<OpsiServer> = {}) {
  const db = new DatabaseSync(path);
  const riwayat = bukaRiwayat(db);
  const log: string[] = [];
  const server = await jalankanServer({
    port: 0,
    host: '127.0.0.1',
    jedaBotMs: 5,
    riwayat,
    log: (...x) => log.push(x.map((v) => (v instanceof Error ? v.message : String(v))).join(' ')),
    ...opsi,
  });
  const catatan = { server: server as ServerRemi | null, riwayat: riwayat as PenyimpanRiwayat | null, db: db as DatabaseSync | null };
  dibuka.push(catatan);
  /** Matikan server (SIGTERM) dan tutup database, seperti main.ts. */
  const matikan = async () => {
    await catatan.server?.tutup();
    catatan.riwayat?.tutup();
    catatan.db?.close();
    catatan.server = null;
    catatan.riwayat = null;
    catatan.db = null;
  };
  return { server, riwayat, db, log, matikan };
}
afterEach(async () => {
  for (const c of dibuka.splice(0)) {
    await c.server?.tutup();
    c.riwayat?.tutup();
    c.db?.close();
  }
  vi.restoreAllMocks();
});
afterAll(() => rmSync(folder, { recursive: true, force: true }));

type Pesan = { t: string; [k: string]: unknown };
interface Klien {
  ws: WebSocket;
  pesan: Pesan[];
  tutup: Promise<number>;
  kirim(x: unknown): void;
}
async function klien(port: number): Promise<Klien> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
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
const view = (p: Pesan) => p.view as ViewPemain;
const mejaTerakhir = (k: Klien) => info([...k.pesan].reverse().find((p) => p.t === 'meja')!);
const viewTerakhir = (k: Klien) => view([...k.pesan].reverse().find((p) => p.t === 'view')!);
const jumlahPeristiwa = (k: Klien) => viewTerakhir(k).peristiwa.at(-1)?.id ?? 0;

/** Kirim satu aksi pilihan bot normal dari view terakhir, lalu tunggu view sesudahnya. */
async function langkahSendiri(k: Klien, rng: Rng) {
  const v = viewTerakhir(k);
  const sebelum = jumlahPeristiwa(k);
  const { pemain: _, ...aksi } = pilihAksiBot(v, 'normal', rng) as { pemain: number };
  k.kirim({ t: 'aksi', aksi });
  await tungguPesan(k, (p) => p.t === 'view' && (view(p).peristiwa.at(-1)?.id ?? 0) > sebelum);
}

/**
 * Budi (host, kursi 0) + Siti (kursi 1) + warga kedai (kursi 2), permainan dimulai, joker di-OK semua.
 * Giliran pertama = kursi pengocok: 0 = Budi, 1 = Siti, 2 = warga kedai.
 */
async function mejaMain(port: number, pengaturan: Record<string, unknown>, pengocok: number) {
  const a = await klien(port);
  a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3, ...pengaturan } });
  const masukA = await tungguPesan(a, (p) => p.t === 'masuk');
  const b = await klien(port);
  b.kirim({ t: 'gabung', kode: masukA.kode, nama: 'Siti' });
  const masukB = await tungguPesan(b, (p) => p.t === 'masuk');
  a.kirim({ t: 'aturKursi', kursi: 2, jenis: 'bot' });
  await tungguPesan(a, (p) => p.t === 'meja' && info(p).kursi[2].jenis === 'bot');
  a.kirim({ t: 'mulai', pengocok });
  for (const k of [a, b]) {
    await tungguPesan(k, (p) => p.t === 'meja' && info(p).status === 'main');
    k.kirim({ t: 'siapJoker', putaran: 1 });
  }
  await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main' && info(p).menungguJoker.length === 0);
  await tungguPesan(a, (p) => p.t === 'view');
  return { a, b, kode: String(masukA.kode), tokenA: String(masukA.token), tokenB: String(masukB.token) };
}

/** Sambung lagi ke server (baru) dengan token lama. */
async function kembali(port: number, kode: string, nama: string, token: string) {
  const k = await klien(port);
  k.kirim({ t: 'gabung', kode, nama, token });
  const masuk = await tungguPesan(k, (p) => p.t === 'masuk' || p.t === 'error');
  return { k, masuk };
}

const barisMeja = (r: PenyimpanRiwayat, kode: string) => r.mejaAktif.semua().find((b) => b.kode === kode);

describe('meja selamat dari restart server', () => {
  it('tutup() lalu server baru dengan file database yang sama: token lama kembali ke kursinya, permainan utuh dan lanjut', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam });
    const { a, b, kode, tokenA, tokenB } = await mejaMain(s1.server.port, { detikGiliran: 60 }, 0);
    // Jeda simpan habis: meja sudah tertulis.
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(barisMeja(s1.riwayat, kode)).toBeDefined();
    // Perubahan sesudahnya baru ditulis saat server dimatikan (belum lewat jeda simpan).
    a.kirim({ t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    await tungguPesan(a, (p) => p.t === 'view' && view(p).putaran!.tahap === 'main');
    const sebelum = viewTerakhir(a);
    await s1.matikan();
    expect(await a.tutup).toBe(1001);
    expect(await b.tutup).toBe(1001);

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(1);
    expect(s2.log.some((l) => l.includes(`meja ${kode} dipulihkan (main, 2 manusia)`))).toBe(true);
    const { k: a2, masuk } = await kembali(s2.server.port, kode, 'Budi', tokenA);
    expect(masuk).toEqual({ t: 'masuk', kode, token: tokenA, kursi: 0 });
    const m = info(await tungguPesan(a2, (p) => p.t === 'meja'));
    expect(m).toMatchObject({ status: 'main', host: 0, kursiSaya: 0, menungguJoker: [] });
    expect(m.kursi.map((x) => [x.jenis, x.terhubung])).toEqual([
      ['manusia', true],
      ['manusia', false],
      ['bot', false],
    ]);
    // Batas waktu giliran disusun ulang: waktu penuh lagi sejak meja lanjut.
    expect(m.batasWaktu).toBe(jam.sekarang() + 60_000);
    const sesudah = view(await tungguPesan(a2, (p) => p.t === 'view'));
    expect(sesudah.putaran!.tangan[0]).toEqual(sebelum.putaran!.tangan[0]);
    expect(sesudah.putaran!.tahap).toBe('main');
    expect(sesudah.putaran!.giliran).toBe(0);
    expect(sesudah.peristiwa.at(-1)!.id).toBe(sebelum.peristiwa.at(-1)!.id);
    expect(sesudah.skor).toEqual(sebelum.skor);

    // Siti juga kembali ke kursinya; orang lain tanpa token tidak bisa masuk.
    const { k: b2, masuk: masukB } = await kembali(s2.server.port, kode, 'Siti', tokenB);
    expect(masukB).toMatchObject({ t: 'masuk', kursi: 1, token: tokenB });
    const { k: tamu, masuk: ditolak } = await kembali(s2.server.port, kode, 'Tamu', 'token-ngawur');
    expect(ditolak).toEqual({ t: 'error', pesan: 'Permainan di meja ini sudah mulai.' });

    // Permainan lanjut: Budi menyelesaikan gilirannya, giliran pindah.
    const rng = new Rng(7);
    while (viewTerakhir(a2).putaran!.giliran === 0) await langkahSendiri(a2, rng);
    expect(a2.pesan.filter((p) => p.t === 'error')).toEqual([]);
    for (const k of [a2, b2, tamu]) k.ws.close();
  });

  it('meja di lobi ikut dipulihkan; host kembali dan bisa memulai', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const a = await klien(s1.server.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await s1.matikan();
    const s2 = await nyalakan(path);
    const { k, masuk: m2 } = await kembali(s2.server.port, String(masuk.kode), 'Budi', String(masuk.token));
    expect(m2).toMatchObject({ t: 'masuk', kursi: 0 });
    k.kirim({ t: 'aturKursi', kursi: 1, jenis: 'bot' });
    k.kirim({ t: 'mulai' });
    expect(info(await tungguPesan(k, (p) => p.t === 'meja' && info(p).status === 'main')).kursi[1].jenis).toBe('bot');
    k.ws.close();
  });

  it('sesudah dipulihkan: meja dijeda sampai ada yang kembali, lalu warga kedai jalan dan yang masih terputus dapat tenggang penuh', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam });
    // Giliran pertama warga kedai (kursi 2); waktu belum dimajukan, jadi ia belum jalan.
    const { a, kode, tokenA } = await mejaMain(s1.server.port, { detikGiliran: 60 }, 2);
    await s1.matikan();
    void a;

    const s2 = await nyalakan(path, { penjadwal: jam, jedaBotMs: 5 });
    // Tidak ada yang kembali: warga kedai tidak jalan, berapa lama pun.
    jam.maju(10 * 60_000);
    const { k: a2 } = await kembali(s2.server.port, kode, 'Budi', tokenA);
    const kembaliPada = jam.sekarang();
    const awal = view(await tungguPesan(a2, (p) => p.t === 'view'));
    expect(awal.putaran!.giliran).toBe(2);
    // Timer warga kedai dipasang lagi saat Budi kembali.
    for (let i = 0; i < 100 && viewTerakhir(a2).putaran!.giliran !== 0; i++) {
      jam.maju(5);
      await tunggu(5);
    }
    expect(viewTerakhir(a2).putaran!.giliran).toBe(0);
    // Giliran Budi: batas waktu penuh, dihitung sejak gilirannya mulai.
    const batas = info(await tungguPesan(a2, (p) => p.t === 'meja' && info(p).batasWaktu !== null)).batasWaktu!;
    expect(batas).toBeGreaterThan(jam.sekarang() + 60_000 - 1_000);
    expect(batas).toBeLessThanOrEqual(jam.sekarang() + 60_000);
    const rng = new Rng(3);
    while (viewTerakhir(a2).putaran!.giliran === 0) await langkahSendiri(a2, rng);
    expect(viewTerakhir(a2).putaran!.giliran).toBe(1);
    // Siti (masih terputus sejak restart) baru dijalankan warga kedai sesudah tenggang penuh sejak Budi kembali.
    const peristiwaSiti = () => viewTerakhir(a2).peristiwa.filter((e) => 'pemain' in e && e.pemain === 1).length;
    jam.maju(kembaliPada + TENGGANG_SAMBUNG_MS - 1 - jam.sekarang());
    await tunggu(30);
    expect(peristiwaSiti()).toBe(0);
    jam.maju(1 + 10);
    await tungguPesan(a2, () => peristiwaSiti() > 0);
    a2.ws.close();
  });

  it('klasemen akhir tidak tercatat dua kali: simpanan dibuang sebelum klasemen dicatat, dan meja selesai tidak dipulihkan', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam });
    const a = await klien(s1.server.port);
    // Satu putaran saja; giliran Budi yang habis waktunya dijalankan warga kedai.
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 2, detikGiliran: 5, batasPutaran: 1 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const kode = String(masuk.kode);
    a.kirim({ t: 'aturKursi', kursi: 1, jenis: 'bot' });
    a.kirim({ t: 'mulai' });
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main');
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(barisMeja(s1.riwayat, kode)).toBeDefined();
    // Saat klasemen dicatat, simpanan mejanya harus sudah tidak ada.
    const simpanAsli = s1.riwayat.simpan.bind(s1.riwayat);
    const adaSaatDicatat: boolean[] = [];
    vi.spyOn(s1.riwayat, 'simpan').mockImplementation((r) => {
      adaSaatDicatat.push(!!barisMeja(s1.riwayat, r.kode));
      return simpanAsli(r);
    });
    for (let i = 0; i < 2000 && mejaTerakhir(a).status !== 'selesai'; i++) {
      jam.maju(8_000);
      await tunggu(1);
    }
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'selesai');
    expect(adaSaatDicatat).toEqual([false]);
    expect(s1.riwayat.daftar(10).map((g) => g.kodeMeja)).toEqual([kode]);
    // Perubahan sesudah selesai (Budi putus) tidak menulis simpanan lagi.
    a.ws.close();
    await a.tutup;
    jam.maju(60_000);
    expect(barisMeja(s1.riwayat, kode)).toBeUndefined();
    await s1.matikan();

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(0);
    const { masuk: m2 } = await kembali(s2.server.port, kode, 'Budi', String(masuk.token));
    expect(m2).toEqual({ t: 'error', pesan: `Meja ${kode} nggak ketemu.` });
    expect(s2.riwayat.daftar(10)).toHaveLength(1);
  }, 30_000);

  it('simpanan permainan yang sudah selesai (mis. tertinggal karena galat) dibuang saat start, klasemen tidak dicatat lagi', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const { kode } = await mejaMain(s1.server.port, { detikGiliran: 0 }, 2);
    await s1.matikan();
    const db = new DatabaseSync(path);
    const baris = db.prepare('SELECT data FROM meja_aktif WHERE kode = ?').get(kode) as { data: string };
    const data = JSON.parse(baris.data);
    data.game.status = 'selesai';
    db.prepare('UPDATE meja_aktif SET data = ? WHERE kode = ?').run(JSON.stringify(data), kode);
    db.close();

    const s2 = await nyalakan(path);
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.log).toContain(`simpanan meja ${kode} dibuang: permainannya sudah selesai`);
    expect(s2.riwayat.mejaAktif.semua()).toEqual([]);
    expect(s2.riwayat.daftar(10)).toEqual([]);
  });

  it('simpanan rusak, kebanyakan umur, atau tanpa manusia dilewati dan dibuang (dicatat di log); yang sehat tetap dipulihkan', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam });
    const a = await klien(s1.server.port);
    a.kirim({ t: 'buat', nama: 'Budi' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const kode = String(masuk.kode);
    await s1.matikan();

    const db = new DatabaseSync(path);
    const sehat = (db.prepare('SELECT data FROM meja_aktif WHERE kode = ?').get(kode) as { data: string }).data;
    const tulis = db.prepare('INSERT INTO meja_aktif (kode, data, pembuat_jaringan, diperbarui_pada) VALUES (?, ?, NULL, ?)');
    const sekarang = jam.sekarang();
    tulis.run('RUSAK', '{"versi":1,"kode":"RUS', sekarang);
    tulis.run('BENTK', JSON.stringify({ versi: 1, kode: 'BENTK', kursi: 'bukan daftar' }), sekarang);
    tulis.run('BEDAK', sehat, sekarang);
    tulis.run('VERSI', sehat.replace('"versi":1', '"versi":2').replace(kode, 'VERSI'), sekarang);
    tulis.run('LAMAA', sehat.replace(kode, 'LAMAA'), sekarang - UMUR_MAKS_SIMPANAN_MEJA_MS - 1);
    const tanpaManusia = JSON.parse(sehat.replace(kode, 'BOTAJ'));
    tanpaManusia.kursi = tanpaManusia.kursi.map(() => ({ jenis: 'bot', nama: 'Warga A', pemainId: null, terhubung: false, level: 'normal' }));
    tulis.run('BOTAJ', JSON.stringify(tanpaManusia), sekarang);
    db.close();

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(1);
    expect(s2.riwayat.mejaAktif.semua().map((b) => b.kode)).toEqual([kode]);
    const dibuang = (k: string) => s2.log.find((l) => l.startsWith(`simpanan meja ${k} dibuang`));
    expect(dibuang('RUSAK')).toContain('rusak (JSON rusak)');
    expect(dibuang('BENTK')).toContain('rusak (pengaturan rusak)');
    expect(dibuang('BEDAK')).toContain('rusak (kode di data tidak cocok)');
    expect(dibuang('VERSI')).toContain('versi data 2 tidak dikenal');
    expect(dibuang('LAMAA')).toContain('terlalu lama');
    expect(dibuang('BOTAJ')).toContain('tidak ada pemain manusia');
    expect(s2.log).toContain('1 dari 7 meja tersimpan dipulihkan');
    const { masuk: m2 } = await kembali(s2.server.port, kode, 'Budi', String(masuk.token));
    expect(m2).toMatchObject({ t: 'masuk', kursi: 0 });
  });

  it('kode meja yang dipulihkan tetap dipesan: meja baru tidak mendapat kode yang sama', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const a = await klien(s1.server.port);
    a.kirim({ t: 'buat', nama: 'Budi' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await s1.matikan();
    const s2 = await nyalakan(path, { maksMejaPerIp: 1 });
    // Pembuat meja yang dipulihkan tetap tercatat: batas meja per jaringan tetap berlaku.
    const b = await klien(s2.server.port);
    b.kirim({ t: 'buat', nama: 'Siti' });
    expect((await tungguPesan(b, (p) => p.t === 'error')).pesan).toMatch(/Kebanyakan meja dari jaringanmu/);
    expect(s2.server.jumlahMeja()).toBe(1);
    const daftar = s2.riwayat.mejaAktif.semua();
    expect(daftar.map((x) => x.kode)).toEqual([masuk.kode]);
    expect(daftar[0].pembuatJaringan).toBe('127.0.0.1');
    b.ws.close();
  });

  it('meja kompetisi dipulihkan selama kompetisinya masih ada; kompetisi yang hilang = simpanan dibuang', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const sekarang = Date.now();
    const komp = s1.riwayat.kompetisi.ajukan({ nama: 'Malam Minggu', masa: 'malam', pengaturan: {}, namaPengaju: 'Ani' }, sekarang);
    const tiket: Record<string, string> = { Ani: komp.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = s1.riwayat.kompetisi.ikut(komp.kode, nama, sekarang).token;
    expect(s1.riwayat.kompetisi.status(komp.kode, Date.now())).toBe('berjalan');

    const ani = await klien(s1.server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', pengaturan: { jumlahPemain: 2 }, kompetisi: { kode: komp.kode, token: tiket.Ani } });
    const masukAni = await tungguPesan(ani, (p) => p.t === 'masuk');
    const budi = await klien(s1.server.port);
    budi.kirim({ t: 'gabung', kode: masukAni.kode, nama: 'Budi', tiket: [{ kode: komp.kode, token: tiket.Budi }] });
    await tungguPesan(budi, (p) => p.t === 'masuk');
    ani.kirim({ t: 'mulai' });
    await tungguPesan(ani, (p) => p.t === 'meja' && info(p).status === 'main');
    // Meja kompetisi kedua masih di lobi.
    const cici = await klien(s1.server.port);
    cici.kirim({ t: 'buat', nama: 'Cici', kompetisi: { kode: komp.kode, token: tiket.Cici } });
    const masukCici = await tungguPesan(cici, (p) => p.t === 'masuk');
    await s1.matikan();

    const s2 = await nyalakan(path);
    expect(s2.server.jumlahMeja()).toBe(2);
    expect(s2.log.some((l) => l.includes(`meja ${masukAni.kode} dipulihkan (main, 2 manusia, kompetisi ${komp.kode})`))).toBe(true);
    const { k: ani2, masuk } = await kembali(s2.server.port, String(masukAni.kode), 'Ani', String(masukAni.token));
    expect(masuk).toMatchObject({ t: 'masuk', kursi: 0 });
    expect(info(await tungguPesan(ani2, (p) => p.t === 'meja')).kompetisi).toEqual({ kode: komp.kode, nama: 'Malam Minggu' });
    ani2.ws.close();
    await s2.matikan();

    // Kompetisinya hilang dari database: kedua meja tidak dipulihkan.
    const db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('DELETE FROM kompetisi WHERE kode = ?').run(komp.kode);
    db.close();
    const s3 = await nyalakan(path);
    expect(s3.server.jumlahMeja()).toBe(0);
    expect(s3.log).toContain(`simpanan meja ${masukCici.kode} dibuang: kompetisi ${komp.kode} sudah tidak ada`);
  });

  it('meja kompetisi di lobi tidak dipulihkan kalau kompetisinya sudah tidak berjalan; yang sedang main tetap', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const sekarang = Date.now();
    const komp = s1.riwayat.kompetisi.ajukan({ nama: 'Sebentar', masa: 'malam', pengaturan: {}, namaPengaju: 'Ani' }, sekarang);
    const tiket: Record<string, string> = { Ani: komp.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = s1.riwayat.kompetisi.ikut(komp.kode, nama, sekarang).token;
    const ani = await klien(s1.server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', pengaturan: { jumlahPemain: 2 }, kompetisi: { kode: komp.kode, token: tiket.Ani } });
    const masukAni = await tungguPesan(ani, (p) => p.t === 'masuk');
    const budi = await klien(s1.server.port);
    budi.kirim({ t: 'gabung', kode: masukAni.kode, nama: 'Budi', tiket: [{ kode: komp.kode, token: tiket.Budi }] });
    await tungguPesan(budi, (p) => p.t === 'masuk');
    ani.kirim({ t: 'mulai' });
    await tungguPesan(ani, (p) => p.t === 'meja' && info(p).status === 'main');
    const cici = await klien(s1.server.port);
    cici.kirim({ t: 'buat', nama: 'Cici', kompetisi: { kode: komp.kode, token: tiket.Cici } });
    const masukCici = await tungguPesan(cici, (p) => p.t === 'masuk');
    // Peserta setuju menyudahi kompetisi (sampai cukup suara).
    for (const nama of ['Ani', 'Budi', 'Cici', 'Dodi']) {
      if (s1.riwayat.kompetisi.status(komp.kode, Date.now()) === 'berjalan') s1.riwayat.kompetisi.setujuTutup(komp.kode, tiket[nama], true, Date.now());
    }
    expect(s1.riwayat.kompetisi.status(komp.kode, Date.now())).toBe('selesai');
    await s1.matikan();

    const s2 = await nyalakan(path);
    expect(s2.server.jumlahMeja()).toBe(1);
    expect(s2.log).toContain(`simpanan meja ${masukCici.kode} dibuang: kompetisi ${komp.kode} sudah tidak berjalan`);
    const { masuk } = await kembali(s2.server.port, String(masukAni.kode), 'Ani', String(masukAni.token));
    expect(masuk).toMatchObject({ t: 'masuk', kursi: 0 });
  });

  it('perubahan beruntun digabung jadi satu tulis per jeda simpan', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam });
    const tulis = vi.spyOn(s1.riwayat.mejaAktif, 'simpan');
    const a = await klien(s1.server.port);
    a.kirim({ t: 'buat', nama: 'Budi', pengaturan: { jumlahPemain: 3 } });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    for (const n of [4, 5, 6]) a.kirim({ t: 'pengaturan', pengaturan: { jumlahPemain: n } });
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).pengaturan.jumlahPemain === 6);
    expect(tulis).not.toHaveBeenCalled();
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(tulis).toHaveBeenCalledTimes(1);
    expect(JSON.parse(barisMeja(s1.riwayat, String(masuk.kode))!.data).pengaturan.jumlahPemain).toBe(6);
    a.ws.close();
  });

  it('simpanMeja: false = meja tidak disimpan dan simpanan lama tidak dipulihkan', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const a = await klien(s1.server.port);
    a.kirim({ t: 'buat', nama: 'Budi' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await s1.matikan();
    const s2 = await nyalakan(path, { simpanMeja: false });
    expect(s2.server.jumlahMeja()).toBe(0);
    const b = await klien(s2.server.port);
    b.kirim({ t: 'buat', nama: 'Siti' });
    await tungguPesan(b, (p) => p.t === 'masuk');
    b.ws.close();
    await s2.matikan();
    const db = new DatabaseSync(path);
    expect((db.prepare('SELECT kode FROM meja_aktif').all() as { kode: string }[]).map((x) => x.kode)).toEqual([masuk.kode]);
    db.close();
  });
});

describe('/healthz dan meja kosong', () => {
  it('HEALTHZ_DETAIL melaporkan mejaMain', async () => {
    const s = await nyalakan(dbBaru(), { healthzDetail: true });
    const { a, b } = await mejaMain(s.server.port, { detikGiliran: 0 }, 2);
    const k = await klien(s.server.port);
    k.kirim({ t: 'buat', nama: 'Lobi' });
    await tungguPesan(k, (p) => p.t === 'masuk');
    const isi = await (await fetch(`http://127.0.0.1:${s.server.port}/healthz`)).json();
    expect(isi).toMatchObject({ ok: true, meja: 2, mejaMain: 1 });
    for (const x of [a, b, k]) x.ws.close();
  });

  it('meja yang sedang main ditunggu 45 menit, lobi dan yang sudah selesai 10 menit; bisa ditimpa', () => {
    expect(BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS).toBe(45 * 60_000);
    expect(BAWAAN_HAPUS_MEJA_KOSONG_MS).toBe(10 * 60_000);
    expect(batasMejaKosongMs('main')).toBe(45 * 60_000);
    expect(batasMejaKosongMs('lobi')).toBe(10 * 60_000);
    expect(batasMejaKosongMs('selesai')).toBe(10 * 60_000);
    expect(batasMejaKosongMs('main', { hapusMejaKosongMs: 1 })).toBe(45 * 60_000);
    expect(batasMejaKosongMs('lobi', { hapusMejaKosongMs: 1, hapusMejaMainKosongMs: 2 })).toBe(1);
    expect(batasMejaKosongMs('main', { hapusMejaKosongMs: 1, hapusMejaMainKosongMs: 2 })).toBe(2);
  });
});

describe('bacaDataMeja', () => {
  it('menolak JSON rusak dan bentuk yang tidak masuk akal dengan alasan', () => {
    expect(bacaDataMeja('{', 'ABCDE')).toBe('JSON rusak');
    expect(bacaDataMeja('[]', 'ABCDE')).toBe('bukan objek');
    const sah = {
      versi: 1,
      kode: 'ABCDE',
      pengaturan: {},
      kursi: [
        { jenis: 'manusia', nama: 'Budi', pemainId: 't1', terhubung: true, level: 'normal' },
        { jenis: 'bot', nama: 'Warga A', pemainId: null, terhubung: false, level: 'normal' },
      ],
      host: 0,
      game: null,
      rngBot: 1,
      setujuAkhiri: [],
      giliranKe: 0,
      menungguJoker: [],
      sudahLihatJoker: [],
    };
    expect(typeof bacaDataMeja(JSON.stringify(sah), 'ABCDE')).toBe('object');
    expect(bacaDataMeja(JSON.stringify(sah), 'XXXXX')).toBe('kode di data tidak cocok');
    expect(bacaDataMeja(JSON.stringify({ ...sah, host: 5 }), 'ABCDE')).toBe('host rusak');
    expect(bacaDataMeja(JSON.stringify({ ...sah, kursi: [sah.kursi[0]] }), 'ABCDE')).toBe('daftar kursi rusak');
    expect(bacaDataMeja(JSON.stringify({ ...sah, kursi: [{ ...sah.kursi[0], pemainId: null }, sah.kursi[1]] }), 'ABCDE')).toBe(
      'kursi manusia tanpa token',
    );
    expect(bacaDataMeja(JSON.stringify({ ...sah, game: { status: 'main', pemain: [{}], skor: [] } }), 'ABCDE')).toBe('state permainan rusak');
  });
});
