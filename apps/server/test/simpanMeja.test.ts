// Meja selamat dari restart/deploy server (rencana koneksi langkah 9 "Lengkap", keputusan pemilik
// 24 Okt 2026): DataMeja disimpan di SQLite (tabel meja_aktif, migrasi v4), ditulis tertunda sebentar
// sesudah berubah dan langsung saat tutup(), lalu dipulihkan saat server mulai. Pemain kembali ke
// kursinya lewat `gabung` dengan token lama. Permainan meja kompetisi yang ditinggal mencatat yang
// keluar tepat sekali (pembersih, restart, simpanan yang dibuang saat server mulai, tutup()).

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
  JEDA_PUTUS_MS,
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

  it('sesudah restart, pemain lain yang kembali duluan tidak merebut host; host pindah kalau host belum kembali sampai tenggang habis', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam });
    const { kode, tokenB } = await mejaMain(s1.server.port, { detikGiliran: 0 }, 2);
    await s1.matikan();
    const s2 = await nyalakan(path, { penjadwal: jam });
    const { k: b2 } = await kembali(s2.server.port, kode, 'Siti', tokenB);
    expect(info(await tungguPesan(b2, (p) => p.t === 'meja')).host).toBe(0);
    b2.kirim({ t: 'pengaturan', pengaturan: { tempoBot: 'cepat' } });
    expect((await tungguPesan(b2, (p) => p.t === 'error')).pesan).toBe('Cuma host yang bisa melakukan ini.');
    jam.maju(TENGGANG_SAMBUNG_MS);
    await tungguPesan(b2, (p) => p.t === 'meja' && info(p).host === 1);
    b2.ws.close();
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
    const s1 = await nyalakan(path, { jedaMulaiKompetisiMs: 20 });
    const sekarang = Date.now();
    const komp = s1.riwayat.kompetisi.ajukan({ nama: 'Malam Minggu', masa: 'malam', pengaturan: { jumlahPemain: 2 }, namaPengaju: 'Ani' }, sekarang);
    const tiket: Record<string, string> = { Ani: komp.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = s1.riwayat.kompetisi.ikut(komp.kode, nama, sekarang).token;
    expect(s1.riwayat.kompetisi.status(komp.kode, Date.now())).toBe('berjalan');

    const ani = await klien(s1.server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode: komp.kode, token: tiket.Ani } });
    const masukAni = await tungguPesan(ani, (p) => p.t === 'masuk');
    const budi = await klien(s1.server.port);
    budi.kirim({ t: 'gabung', kode: masukAni.kode, nama: 'Budi', tiket: [{ kode: komp.kode, token: tiket.Budi }] });
    await tungguPesan(budi, (p) => p.t === 'masuk');
    // Meja kompetisi mulai sendiri begitu penuh.
    await tungguPesan(ani, (p) => p.t === 'meja' && info(p).status === 'main');
    // Meja kompetisi kedua masih di lobi.
    const cici = await klien(s1.server.port);
    cici.kirim({ t: 'buat', nama: 'Cici', kompetisi: { kode: komp.kode, token: tiket.Cici } });
    const masukCici = await tungguPesan(cici, (p) => p.t === 'masuk');
    await s1.matikan();

    const s2 = await nyalakan(path);
    expect(s2.server.jumlahMeja()).toBe(2);
    expect(s2.log.some((l) => l.includes(`meja ${masukAni.kode} dipulihkan (main, 2 manusia, kompetisi ${komp.kode})`))).toBe(true);
    // Detail kompetisi: meja yang dipulihkan ikut dihitung (sedang main dan menunggu peserta).
    const d = (await (await fetch(`http://127.0.0.1:${s2.server.port}/api/kompetisi/${komp.kode}`)).json()) as {
      mejaMain: number;
      meja: { kode: string; terisi: number }[];
    };
    expect(d.mejaMain).toBe(1);
    expect(d.meja).toEqual([expect.objectContaining({ kode: masukCici.kode, terisi: 1 })]);
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
    const s1 = await nyalakan(path, { jedaMulaiKompetisiMs: 20 });
    const sekarang = Date.now();
    const komp = s1.riwayat.kompetisi.ajukan({ nama: 'Sebentar', masa: 'malam', pengaturan: { jumlahPemain: 2 }, namaPengaju: 'Ani' }, sekarang);
    const tiket: Record<string, string> = { Ani: komp.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = s1.riwayat.kompetisi.ikut(komp.kode, nama, sekarang).token;
    const ani = await klien(s1.server.port);
    ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode: komp.kode, token: tiket.Ani } });
    const masukAni = await tungguPesan(ani, (p) => p.t === 'masuk');
    const budi = await klien(s1.server.port);
    budi.kirim({ t: 'gabung', kode: masukAni.kode, nama: 'Budi', tiket: [{ kode: komp.kode, token: tiket.Budi }] });
    await tungguPesan(budi, (p) => p.t === 'masuk');
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
    // Disudahi, tapi meja yang sedang main (dipulihkan) masih jalan: juara belum diumumkan.
    const d = (await (await fetch(`http://127.0.0.1:${s2.server.port}/api/kompetisi/${komp.kode}`)).json()) as Record<string, unknown>;
    expect(d).toMatchObject({ status: 'selesai', disudahi: true, mejaMain: 1 });
    expect(d.juara).toBeUndefined();
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

/** Tunggu (waktu sungguhan) sampai syaratnya terpenuhi. */
async function sampai(syarat: () => boolean, ms = 3000) {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > ms) throw new Error('syarat tidak terpenuhi');
    await tunggu(5);
  }
}

const healthz = async (port: number) => (await (await fetch(`http://127.0.0.1:${port}/healthz`)).json()) as Record<string, unknown>;

/** Semua pemain manusia di meja menekan Keluar: kursinya diteruskan warga kedai, tidak ada yang bisa kembali. */
async function semuaKeluar(...k: Klien[]) {
  for (const x of k) x.kirim({ t: 'keluar' });
  for (const x of k) await tungguPesan(x, (p) => p.t === 'keluar');
}

describe('/healthz dan meja kosong', () => {
  it('HEALTHZ_DETAIL: mejaMain hanya menghitung meja main yang sedang dimainkan (ada manusia terhubung)', async () => {
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { healthzDetail: true, penjadwal: jam });
    const port = s.server.port;
    const dimainkan = await mejaMain(port, { detikGiliran: 0 }, 2);
    const k = await klien(port);
    k.kirim({ t: 'buat', nama: 'Lobi' });
    await tungguPesan(k, (p) => p.t === 'masuk');
    expect(await healthz(port)).toMatchObject({ ok: true, meja: 2, mejaMain: 1 });
    // Semua pemainnya menekan Keluar (tinggal warga kedai): tidak dihitung.
    const ditinggal = await mejaMain(port, { detikGiliran: 0 }, 2);
    await semuaKeluar(ditinggal.a, ditinggal.b);
    // Semua pemainnya terputus (sinyal): tidak dihitung lagi sesudah jeda putus.
    const putus = await mejaMain(port, { detikGiliran: 0 }, 2);
    const sebelum = s.server.jumlahSambungan();
    for (const x of [putus.a, putus.b]) x.ws.close();
    await sampai(() => s.server.jumlahSambungan() === sebelum - 2);
    expect(await healthz(port)).toMatchObject({ meja: 4, mejaMain: 2 });
    jam.maju(JEDA_PUTUS_MS);
    expect(await healthz(port)).toMatchObject({ meja: 4, mejaMain: 1 });
    for (const x of [dimainkan.a, dimainkan.b, k, ditinggal.a, ditinggal.b]) x.ws.close();
  });

  it('meja yang dipulihkan sesudah restart baru dihitung mejaMain begitu ada yang kembali', async () => {
    const path = dbBaru();
    const s1 = await nyalakan(path);
    const { kode, tokenA } = await mejaMain(s1.server.port, { detikGiliran: 0 }, 2);
    await s1.matikan();
    const s2 = await nyalakan(path, { healthzDetail: true });
    expect(await healthz(s2.server.port)).toMatchObject({ meja: 1, mejaMain: 0 });
    const { k } = await kembali(s2.server.port, kode, 'Budi', tokenA);
    expect(await healthz(s2.server.port)).toMatchObject({ meja: 1, mejaMain: 1 });
    k.ws.close();
  });

  it('meja yang semua pemainnya menekan Keluar tidak disimpan lagi (tidak ada yang bisa kembali)', async () => {
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { penjadwal: jam });
    const { a, b, kode } = await mejaMain(s.server.port, { detikGiliran: 0 }, 2);
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(barisMeja(s.riwayat, kode)).toBeDefined();
    await semuaKeluar(a, b);
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(barisMeja(s.riwayat, kode)).toBeUndefined();
    // Mejanya sendiri masih ada sampai dibersihkan (10 menit, lihat test pembersih).
    expect(s.server.jumlahMeja()).toBe(1);
    for (const x of [a, b]) x.ws.close();
  });

  it('meja yang sedang main ditunggu 45 menit selama masih ada kursi manusia; lobi, selesai, dan yang tinggal warga kedai 10 menit; bisa ditimpa', () => {
    const main = { status: 'main' as const, adaKursiManusia: true };
    expect(BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS).toBe(45 * 60_000);
    expect(BAWAAN_HAPUS_MEJA_KOSONG_MS).toBe(10 * 60_000);
    expect(batasMejaKosongMs(main)).toBe(45 * 60_000);
    expect(batasMejaKosongMs({ status: 'main', adaKursiManusia: false })).toBe(10 * 60_000);
    expect(batasMejaKosongMs({ status: 'lobi', adaKursiManusia: true })).toBe(10 * 60_000);
    expect(batasMejaKosongMs({ status: 'selesai', adaKursiManusia: true })).toBe(10 * 60_000);
    expect(batasMejaKosongMs(main, { hapusMejaKosongMs: 1 })).toBe(45 * 60_000);
    expect(batasMejaKosongMs({ status: 'lobi', adaKursiManusia: true }, { hapusMejaKosongMs: 1, hapusMejaMainKosongMs: 2 })).toBe(1);
    expect(batasMejaKosongMs(main, { hapusMejaKosongMs: 1, hapusMejaMainKosongMs: 2 })).toBe(2);
  });
});

describe('pembersih meja kosong (timer server sungguhan)', () => {
  // Hanya setInterval yang dipalsukan (pembersih jalan tiap 30 detik); jam meja, jeda putus, jeda
  // simpan, dan jam pembersih memakai JamUji. setTimeout tetap asli supaya WebSocket jalan biasa.
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lobi dihapus sesudah 10 menit, meja main yang ditinggal sesudah 45 menit, meja yang tinggal warga kedai sesudah 10 menit; simpanannya ikut hilang', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { penjadwal: jam });
    const port = s.server.port;
    const detak = () => vi.advanceTimersByTime(30_000);

    const lobi = await klien(port);
    lobi.kirim({ t: 'buat', nama: 'Lobi' });
    const kodeLobi = String((await tungguPesan(lobi, (p) => p.t === 'masuk')).kode);
    const main = await mejaMain(port, { detikGiliran: 0 }, 2);
    const keluar = await mejaMain(port, { detikGiliran: 0 }, 2);
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    await semuaKeluar(keluar.a, keluar.b);
    for (const x of [lobi, main.a, main.b, keluar.a, keluar.b]) x.ws.close();
    await sampai(() => s.server.jumlahSambungan() === 0);
    // Jeda putus lewat (semua dianggap terputus) dan simpanan terakhir sudah ditulis.
    jam.maju(JEDA_PUTUS_MS + JEDA_SIMPAN_MEJA_MS);
    const kodeTersimpan = () => s.riwayat.mejaAktif.semua().map((b) => b.kode).sort();
    expect(kodeTersimpan()).toEqual([kodeLobi, main.kode].sort());
    expect(s.server.jumlahMeja()).toBe(3);

    // Detak pertama mencatat sejak kapan kosong; 10 menit kemudian lobi dan meja tanpa manusia dihapus.
    detak();
    jam.maju(BAWAAN_HAPUS_MEJA_KOSONG_MS - 1);
    detak();
    expect(s.server.jumlahMeja()).toBe(3);
    jam.maju(1);
    detak();
    expect(s.server.jumlahMeja()).toBe(1);
    expect(s.log).toContain(`meja ${kodeLobi} dihapus (kosong)`);
    expect(s.log).toContain(`meja ${keluar.kode} dihapus (kosong)`);
    expect(kodeTersimpan()).toEqual([main.kode]);

    // Meja main yang masih bisa didatangi pemainnya baru dihapus sesudah 45 menit, beserta simpanannya.
    jam.maju(BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS - BAWAAN_HAPUS_MEJA_KOSONG_MS - 1);
    detak();
    expect(s.server.jumlahMeja()).toBe(1);
    jam.maju(1);
    detak();
    expect(s.server.jumlahMeja()).toBe(0);
    expect(s.log).toContain(`meja ${main.kode} dihapus (kosong)`);
    expect(kodeTersimpan()).toEqual([]);
    // Tidak ada yang tersisa untuk dipulihkan: token lama tidak bisa kembali.
    const { masuk } = await kembali(port, main.kode, 'Budi', main.tokenA);
    expect(masuk).toEqual({ t: 'error', pesan: `Meja ${main.kode} nggak ketemu.` });
  });
});

// Permainan meja kompetisi yang ditinggal (keputusan pemilik 24 Okt 2026 "Yang keluar selalu dicatat 0"):
// yang keluar dicatat 0 saat mejanya dihapus pembersih, saat simpanannya dibuang waktu server mulai, dan
// tepat sekali walau server dinyalakan ulang di antaranya. Yang bertahan (terputus) tidak dicatat.
describe('meja kompetisi yang ditinggal: pembersih, restart, dan simpanan yang dibuang', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const detak = () => vi.advanceTimersByTime(30_000);

  /** Kompetisi yang berjalan di jam uji: Ani (pengaju), Budi, Cici, Dodi; meja 2 orang, 3 putaran. */
  function kompetisiUji(r: PenyimpanRiwayat, jam: JamUji, pengaturan: Record<string, unknown> = {}) {
    const t = jam.sekarang();
    const k = r.kompetisi.ajukan({ nama: 'Malam Uji', masa: 'minggu', pengaturan: { jumlahPemain: 2, batasPutaran: 3, ...pengaturan }, namaPengaju: 'Ani' }, t);
    const tiket: Record<string, string> = { Ani: k.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = r.kompetisi.ikut(k.kode, nama, t).token;
    expect(r.kompetisi.status(k.kode, t)).toBe('berjalan');
    return { kode: k.kode, tiket };
  }

  /**
   * Dua peserta duduk di meja kompetisi (bawaan Ani di kursi 0 = `a`, Budi di kursi 1 = `b`); permainannya
   * mulai sendiri (jeda mulai 20 ms jam uji).
   */
  async function mejaKompetisi(port: number, jam: JamUji, kode: string, tiket: Record<string, string>, [namaA, namaB] = ['Ani', 'Budi']) {
    const a = await klien(port);
    a.kirim({ t: 'buat', nama: namaA, kompetisi: { kode, token: tiket[namaA] } });
    const masukA = await tungguPesan(a, (p) => p.t === 'masuk');
    const b = await klien(port);
    b.kirim({ t: 'gabung', kode: masukA.kode, nama: namaB, tiket: [{ kode, token: tiket[namaB] }] });
    await tungguPesan(b, (p) => p.t === 'masuk');
    await tungguPesan(a, (p) => p.t === 'meja' && !!info(p).mulaiOtomatis);
    jam.maju(20);
    await tungguPesan(a, (p) => p.t === 'meja' && info(p).status === 'main');
    return { a, b, kodeMeja: String(masukA.kode), tokenA: String(masukA.token) };
  }

  /** `b` menekan Keluar; `a` menutup aplikasi (terputus, bukan keluar) sampai jeda putus lewat. */
  async function bKeluarAHilang(s: Awaited<ReturnType<typeof nyalakan>>, jam: JamUji, m: Awaited<ReturnType<typeof mejaKompetisi>>) {
    m.b.kirim({ t: 'keluar' });
    await tungguPesan(m.b, (p) => p.t === 'keluar');
    const sebelum = s.server.jumlahSambungan();
    m.a.ws.close();
    await sampai(() => s.server.jumlahSambungan() === sebelum - 1);
    jam.maju(JEDA_PUTUS_MS);
  }

  /** Baris klasemen kompetisi per nama, dari penyimpan (tanpa menetapkan juara: meja palsu "masih main"). */
  const klasemen = (r: PenyimpanRiwayat, kode: string) => {
    const k = r.kompetisi.klasemen(kode)!;
    return Object.fromEntries([...k.peringkat, ...k.belumCukup].map((b) => [b.nama, b]));
  };
  const jumlahDitinggal = (db: DatabaseSync) => Number((db.prepare('SELECT COUNT(*) AS n FROM hasil_kompetisi_ditinggal').get() as { n: number }).n);
  const juaraPada = (db: DatabaseSync, kode: string) => (db.prepare('SELECT juara_pada FROM kompetisi WHERE kode = ?').get(kode) as { juara_pada: number | null }).juara_pada;
  const healthz = async (port: number) => (await (await fetch(`http://127.0.0.1:${port}/healthz`)).json()) as Record<string, unknown>;
  /** Detail kompetisi lewat API (memakai keadaan meja server, jadi juga bisa menetapkan juara). */
  const detailApi = async (port: number, kode: string) =>
    (await (await fetch(`http://127.0.0.1:${port}/api/kompetisi/${kode}`)).json()) as Record<string, unknown>;

  it('yang bertahan menghilang: 45 menit kemudian mejanya dihapus, yang keluar dicatat 0, yang bertahan tidak; juara menyusul', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { penjadwal: jam, jedaMulaiKompetisiMs: 20, healthzDetail: true });
    const { kode, tiket } = kompetisiUji(s.riwayat, jam);
    const m = await mejaKompetisi(s.server.port, jam, kode, tiket);
    await bKeluarAHilang(s, jam, m);
    // Kompetisinya disudahi selagi meja ini masih bisa didatangi Ani: juara menunggu.
    for (const nama of ['Ani', 'Budi', 'Cici']) s.riwayat.kompetisi.setujuTutup(kode, tiket[nama], true, jam.sekarang());

    detak();
    jam.maju(BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS - 1);
    detak();
    expect(s.server.jumlahMeja()).toBe(1);
    expect(jumlahDitinggal(s.db)).toBe(0);
    expect(juaraPada(s.db, kode)).toBeNull();
    jam.maju(1);
    detak();
    expect(s.server.jumlahMeja()).toBe(0);
    expect(s.log).toContain(`meja ${m.kodeMeja} dihapus (kosong)`);
    expect(s.log).toContain(`permainan meja ${m.kodeMeja} ditinggal: 1 yang keluar dicatat 0 di kompetisi ${kode}`);
    const per = klasemen(s.riwayat, kode);
    expect(per.Budi).toMatchObject({ main: 1, keluar: 1, rataNilai: 0 });
    expect(per.Ani).toMatchObject({ main: 0 });
    expect(s.riwayat.mejaAktif.semua()).toEqual([]);
    // Juara ditetapkan di detak yang sama, sesudah nilai 0 Budi tercatat.
    expect(juaraPada(s.db, kode)).toBe(jam.sekarang());
    expect(s.log).toContain(`juara kompetisi ${kode} ditetapkan`);
    // Tidak masuk Riwayat online.
    expect(s.riwayat.daftar(10)).toEqual([]);
  });

  it('yang bertahan kembali sebelum 45 menit: tidak ada catatan ditinggal; permainan selesai lewat jalur biasa', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s.riwayat, jam, { batasPutaran: 1, detikGiliran: 5 });
    const m = await mejaKompetisi(s.server.port, jam, kode, tiket);
    await bKeluarAHilang(s, jam, m);
    detak();
    jam.maju(30 * 60_000);
    detak();
    expect(s.server.jumlahMeja()).toBe(1);
    const { k: ani2, masuk } = await kembali(s.server.port, m.kodeMeja, 'Ani', m.tokenA);
    expect(masuk).toMatchObject({ t: 'masuk', kursi: 0 });
    expect(jumlahDitinggal(s.db)).toBe(0);
    // Ani main sampai selesai (gilirannya yang habis waktu dijalankan warga kedai).
    for (let i = 0; i < 2000 && mejaTerakhir(ani2).status !== 'selesai'; i++) {
      jam.maju(8_000);
      await tunggu(1);
    }
    await tungguPesan(ani2, (p) => p.t === 'meja' && info(p).status === 'selesai');
    expect(jumlahDitinggal(s.db)).toBe(0);
    const per = klasemen(s.riwayat, kode);
    // Jalur biasa: Budi (keluar) 0, Ani bertahan sendirian tidak dicatat.
    expect(per.Budi).toMatchObject({ main: 1, keluar: 1 });
    expect(per.Ani).toMatchObject({ main: 0 });
    expect(s.riwayat.daftar(10).map((g) => g.kodeMeja)).toEqual([m.kodeMeja]);
    ani2.ws.close();
  }, 30_000);

  it('restart sebelum ditinggal: tidak dicatat saat server mati; dipulihkan dengan tanda keluar; dicatat sekali saat dihapus pembersih', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const m = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    await bKeluarAHilang(s1, jam, m);
    await s1.matikan();
    const db1 = new DatabaseSync(path);
    expect(jumlahDitinggal(db1)).toBe(0);
    const data = JSON.parse((db1.prepare('SELECT data FROM meja_aktif WHERE kode = ?').get(m.kodeMeja) as { data: string }).data);
    expect(data.kursi[1]).toMatchObject({ jenis: 'bot', keluar: true, nama: 'Budi' });
    db1.close();

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(1);
    expect(s2.log.some((l) => l.includes(`meja ${m.kodeMeja} dipulihkan (main, 1 manusia, kompetisi ${kode})`))).toBe(true);
    detak();
    jam.maju(BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS - 1);
    detak();
    expect(jumlahDitinggal(s2.db)).toBe(0);
    jam.maju(1);
    detak();
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(jumlahDitinggal(s2.db)).toBe(1);
    expect(klasemen(s2.riwayat, kode).Budi).toMatchObject({ main: 1, keluar: 1 });
    await s2.matikan();

    const s3 = await nyalakan(path, { penjadwal: jam });
    expect(s3.server.jumlahMeja()).toBe(0);
    expect(jumlahDitinggal(s3.db)).toBe(1);
    expect(klasemen(s3.riwayat, kode).Budi).toMatchObject({ main: 1 });
  });

  it('restart sesudah semua keluar: tidak ada yang dipulihkan, catatannya tetap satu kali', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const m = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    for (const k of [m.b, m.a]) {
      k.kirim({ t: 'keluar' });
      await tungguPesan(k, (p) => p.t === 'keluar');
    }
    expect(s1.server.jumlahMeja()).toBe(0);
    expect(jumlahDitinggal(s1.db)).toBe(2);
    await s1.matikan();
    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.riwayat.mejaAktif.semua()).toEqual([]);
    expect(jumlahDitinggal(s2.db)).toBe(2);
    const per = klasemen(s2.riwayat, kode);
    expect([per.Ani.main, per.Budi.main]).toEqual([1, 1]);
  });

  it('galat database saat Keluar terakhir lalu server dimatikan: tutup() mencoba sekali lagi, sesudah restart tidak ada yang tersisa', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const m = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    const simpan = vi.spyOn(s1.riwayat, 'simpanDitinggal').mockImplementationOnce(() => {
      throw new Error('database terkunci');
    });
    for (const k of [m.b, m.a]) {
      k.kirim({ t: 'keluar' });
      await tungguPesan(k, (p) => p.t === 'keluar');
    }
    expect(s1.server.jumlahMeja()).toBe(1);
    expect(jumlahDitinggal(s1.db)).toBe(0);
    // Belum tercatat: simpanannya tetap ada walau tanpa kursi manusia (juga sesudah jeda simpan lewat).
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(s1.riwayat.mejaAktif.semua().map((b) => b.kode)).toEqual([m.kodeMeja]);
    expect(s1.server.jumlahMeja()).toBe(1);
    await s1.matikan();
    expect(simpan).toHaveBeenCalledTimes(2);
    expect(s1.log).toContain(`meja ${m.kodeMeja} dihapus (semua peserta menekan Keluar)`);
    // Tercatat di tutup(): simpanannya ikut dibuang, tidak ada yang dipulihkan atau dibuang lagi.
    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.riwayat.mejaAktif.semua()).toEqual([]);
    expect(s2.log.some((l) => l.includes(m.kodeMeja))).toBe(false);
    expect(jumlahDitinggal(s2.db)).toBe(2);
    expect(klasemen(s2.riwayat, kode).Ani).toMatchObject({ main: 1, keluar: 1 });
  });

  it('galat database terus-menerus saat Keluar terakhir: simpanannya langsung ditulis dengan tanda keluar dan dipertahankan; server berikutnya mencatat keduanya', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const m = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    const simpan = vi.spyOn(s1.riwayat, 'simpanDitinggal').mockImplementation(() => {
      throw new Error('database terkunci');
    });
    for (const k of [m.b, m.a]) {
      k.kirim({ t: 'keluar' });
      await tungguPesan(k, (p) => p.t === 'keluar');
    }
    expect(s1.server.jumlahMeja()).toBe(1);
    // Langsung tertulis (jeda simpan belum lewat): server yang mati mendadak sekarang tidak memulihkan
    // Ani sebagai pemain yang bertahan.
    const tersimpan = () => JSON.parse(s1.riwayat.mejaAktif.semua().find((b) => b.kode === m.kodeMeja)!.data);
    expect(tersimpan().kursi.map((k: { jenis: string; keluar?: boolean }) => [k.jenis, !!k.keluar])).toEqual([
      ['bot', true],
      ['bot', true],
    ]);
    jam.maju(JEDA_SIMPAN_MEJA_MS);
    expect(tersimpan().kursi.every((k: { keluar?: boolean }) => k.keluar)).toBe(true);
    await s1.matikan();
    // Keluar terakhir dan tutup() sama-sama gagal; simpanannya tetap ada.
    expect(simpan).toHaveBeenCalledTimes(2);

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.log).toContain(`simpanan meja ${m.kodeMeja} dibuang: tidak ada pemain manusia lagi`);
    expect(s2.log).toContain(`permainan meja ${m.kodeMeja} ditinggal: 2 yang keluar dicatat 0 di kompetisi ${kode}`);
    expect(s2.riwayat.mejaAktif.semua()).toEqual([]);
    expect(jumlahDitinggal(s2.db)).toBe(2);
    const per = klasemen(s2.riwayat, kode);
    expect([per.Ani, per.Budi].map((b) => [b.main, b.keluar, b.rataNilai])).toEqual([
      [1, 1, 0],
      [1, 1, 0],
    ]);
    await s2.matikan();
    const s3 = await nyalakan(path, { penjadwal: jam });
    expect(jumlahDitinggal(s3.db)).toBe(2);
    expect(s3.log.some((l) => l.includes(m.kodeMeja))).toBe(false);
  });

  it('galat database saat pembersih menghapus meja yang ditinggal: mejanya dibiarkan (tetap menahan juara), dicatat di detak berikutnya', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s.riwayat, jam);
    const m = await mejaKompetisi(s.server.port, jam, kode, tiket);
    await bKeluarAHilang(s, jam, m);
    for (const nama of ['Ani', 'Budi', 'Cici']) s.riwayat.kompetisi.setujuTutup(kode, tiket[nama], true, jam.sekarang());
    const simpan = vi.spyOn(s.riwayat, 'simpanDitinggal').mockImplementationOnce(() => {
      throw new Error('database terkunci');
    });
    detak();
    jam.maju(BAWAAN_HAPUS_MEJA_MAIN_KOSONG_MS);
    detak();
    expect(simpan).toHaveBeenCalledTimes(1);
    expect(s.log).toContain(`galat mencatat permainan meja ${m.kodeMeja} yang ditinggal (dicoba lagi nanti) database terkunci`);
    expect(s.log).not.toContain(`meja ${m.kodeMeja} dihapus (kosong)`);
    expect(s.server.jumlahMeja()).toBe(1);
    expect(s.riwayat.mejaAktif.semua().map((b) => b.kode)).toEqual([m.kodeMeja]);
    expect(await detailApi(s.server.port, kode)).toMatchObject({ status: 'selesai', mejaMain: 1 });
    expect(juaraPada(s.db, kode)).toBeNull();

    detak();
    expect(simpan).toHaveBeenCalledTimes(2);
    expect(s.server.jumlahMeja()).toBe(0);
    expect(s.log).toContain(`meja ${m.kodeMeja} dihapus (kosong)`);
    expect(jumlahDitinggal(s.db)).toBe(1);
    expect(s.riwayat.mejaAktif.semua()).toEqual([]);
    expect(klasemen(s.riwayat, kode).Budi).toMatchObject({ main: 1, keluar: 1 });
    expect(juaraPada(s.db, kode)).toBe(jam.sekarang());
    detak();
    expect(simpan).toHaveBeenCalledTimes(2);
  });

  it('simpanan yang dibuang saat server mulai (kelamaan, tanpa manusia): yang keluar dicatat sekali, juara tidak ditetapkan saat itu', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const lama = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    const tanpaManusia = await mejaKompetisi(s1.server.port, jam, kode, tiket, ['Cici', 'Dodi']);
    for (const m of [lama, tanpaManusia]) await bKeluarAHilang(s1, jam, m);
    // Kompetisinya disudahi: juara hanya menunggu meja-meja ini.
    for (const nama of ['Ani', 'Budi', 'Cici']) s1.riwayat.kompetisi.setujuTutup(kode, tiket[nama], true, jam.sekarang());
    await s1.matikan();

    const db = new DatabaseSync(path);
    const diperbarui = jam.sekarang() - UMUR_MAKS_SIMPANAN_MEJA_MS - 1;
    db.prepare('UPDATE meja_aktif SET diperbarui_pada = ? WHERE kode = ?').run(diperbarui, lama.kodeMeja);
    // Simpanan yang tertinggal tanpa kursi manusia (mis. server mati mendadak di tengah pencatatan).
    const d = JSON.parse((db.prepare('SELECT data FROM meja_aktif WHERE kode = ?').get(tanpaManusia.kodeMeja) as { data: string }).data);
    d.kursi[0] = { ...d.kursi[0], jenis: 'bot', pemainId: null, terhubung: false, keluar: true, keluarSesudahPutaran: 0 };
    db.prepare('UPDATE meja_aktif SET data = ? WHERE kode = ?').run(JSON.stringify(d), tanpaManusia.kodeMeja);
    db.close();

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.log).toContain(`simpanan meja ${lama.kodeMeja} dibuang: sudah terlalu lama tidak berubah`);
    expect(s2.log).toContain(`simpanan meja ${tanpaManusia.kodeMeja} dibuang: tidak ada pemain manusia lagi`);
    expect(s2.log).toContain(`permainan meja ${lama.kodeMeja} ditinggal: 1 yang keluar dicatat 0 di kompetisi ${kode}`);
    expect(s2.log).toContain(`permainan meja ${tanpaManusia.kodeMeja} ditinggal: 2 yang keluar dicatat 0 di kompetisi ${kode}`);
    expect(s2.riwayat.mejaAktif.semua()).toEqual([]);
    // Dicatat dengan waktu simpanan terakhir.
    expect(s2.db.prepare('SELECT dicatat_pada FROM hasil_kompetisi_ditinggal WHERE kode_meja = ?').get(lama.kodeMeja)).toMatchObject({ dicatat_pada: diperbarui });
    const per = klasemen(s2.riwayat, kode);
    // Meja lama: Budi keluar, Ani hanya terputus (tidak dicatat). Meja tanpa manusia: Cici dan Dodi keluar.
    expect([per.Ani, per.Budi, per.Cici, per.Dodi].map((b) => [b.nama, b.main, b.keluar])).toEqual([
      ['Ani', 0, 0],
      ['Budi', 1, 1],
      ['Cici', 1, 1],
      ['Dodi', 1, 1],
    ]);
    // Saat server mulai juara tidak ditetapkan (meja lain kompetisi yang sama bisa jadi belum dipulihkan).
    expect(juaraPada(s2.db, kode)).toBeNull();
    expect(s2.log.some((l) => l.includes('juara kompetisi'))).toBe(false);
    await s2.matikan();

    const s3 = await nyalakan(path, { penjadwal: jam });
    expect(jumlahDitinggal(s3.db)).toBe(3);
    expect(s3.log.some((l) => l.includes('ditinggal'))).toBe(false);
  });

  it('galat database saat mencatat simpanan yang dibuang: simpanannya dibiarkan, dicatat saat server mulai berikutnya', async () => {
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const m = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    await bKeluarAHilang(s1, jam, m);
    await s1.matikan();
    const db = new DatabaseSync(path);
    db.prepare('UPDATE meja_aktif SET diperbarui_pada = ?').run(jam.sekarang() - UMUR_MAKS_SIMPANAN_MEJA_MS - 1);
    db.exec("CREATE TRIGGER gagal_ditinggal BEFORE INSERT ON hasil_kompetisi_ditinggal BEGIN SELECT RAISE(ABORT, 'disk penuh'); END;");
    db.close();

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.log.some((l) => l.startsWith(`galat mencatat permainan meja ${m.kodeMeja} yang ditinggal (dicoba lagi nanti)`))).toBe(true);
    expect(s2.riwayat.mejaAktif.semua().map((b) => b.kode)).toEqual([m.kodeMeja]);
    expect(jumlahDitinggal(s2.db)).toBe(0);
    expect(s2.server.jumlahMeja()).toBe(0);
    await s2.matikan();

    const db2 = new DatabaseSync(path);
    db2.exec('DROP TRIGGER gagal_ditinggal');
    db2.close();
    const s3 = await nyalakan(path, { penjadwal: jam });
    expect(jumlahDitinggal(s3.db)).toBe(1);
    expect(s3.riwayat.mejaAktif.semua()).toEqual([]);
    expect(klasemen(s3.riwayat, kode).Budi).toMatchObject({ main: 1, keluar: 1 });
  });

  it('galat database saat mencatat simpanan yang dibuang: juaranya ditahan, dicoba lagi tiap detak pembersih sampai tercatat', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const path = dbBaru();
    const jam = new JamUji();
    const s1 = await nyalakan(path, { penjadwal: jam, jedaMulaiKompetisiMs: 20 });
    const { kode, tiket } = kompetisiUji(s1.riwayat, jam);
    const m = await mejaKompetisi(s1.server.port, jam, kode, tiket);
    await bKeluarAHilang(s1, jam, m);
    // Kompetisinya disudahi: juara hanya menunggu meja ini.
    for (const nama of ['Ani', 'Budi', 'Cici']) s1.riwayat.kompetisi.setujuTutup(kode, tiket[nama], true, jam.sekarang());
    await s1.matikan();
    const db = new DatabaseSync(path);
    db.prepare('UPDATE meja_aktif SET diperbarui_pada = ?').run(jam.sekarang() - UMUR_MAKS_SIMPANAN_MEJA_MS - 1);
    db.exec("CREATE TRIGGER gagal_ditinggal BEFORE INSERT ON hasil_kompetisi_ditinggal BEGIN SELECT RAISE(ABORT, 'disk penuh'); END;");
    db.close();

    const s2 = await nyalakan(path, { penjadwal: jam });
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.riwayat.mejaAktif.semua().map((b) => b.kode)).toEqual([m.kodeMeja]);
    // Detak pembersih (dan pembacaan API) tidak menetapkan juara tanpa nilai 0 Budi.
    detak();
    expect(juaraPada(s2.db, kode)).toBeNull();
    expect(await detailApi(s2.server.port, kode)).toMatchObject({ status: 'selesai', mejaMain: 1 });
    expect(juaraPada(s2.db, kode)).toBeNull();
    expect(s2.log.filter((l) => l.startsWith(`galat mencatat permainan meja ${m.kodeMeja} yang ditinggal`))).toHaveLength(2);

    // Databasenya pulih: detak berikutnya mencatat Budi sekali, membuang simpanannya, lalu menetapkan juara.
    s2.db.exec('DROP TRIGGER gagal_ditinggal');
    detak();
    expect(jumlahDitinggal(s2.db)).toBe(1);
    expect(s2.riwayat.mejaAktif.semua()).toEqual([]);
    expect(s2.log).toContain(`permainan meja ${m.kodeMeja} ditinggal: 1 yang keluar dicatat 0 di kompetisi ${kode}`);
    expect(klasemen(s2.riwayat, kode).Budi).toMatchObject({ main: 1, keluar: 1 });
    expect(juaraPada(s2.db, kode)).toBe(jam.sekarang());
    expect(s2.log).toContain(`juara kompetisi ${kode} ditetapkan`);
    detak();
    expect(jumlahDitinggal(s2.db)).toBe(1);
    expect(s2.log.filter((l) => l.includes(`permainan meja ${m.kodeMeja} ditinggal:`))).toHaveLength(1);
    await s2.matikan();
    const s3 = await nyalakan(path, { penjadwal: jam });
    expect(jumlahDitinggal(s3.db)).toBe(1);
    expect(s3.log.some((l) => l.includes(m.kodeMeja))).toBe(false);
  });

  it('meja kompetisi yang semua pesertanya keluar tidak lagi ikut /healthz mejaMain maupun jumlah meja', async () => {
    const jam = new JamUji();
    const s = await nyalakan(dbBaru(), { penjadwal: jam, jedaMulaiKompetisiMs: 20, healthzDetail: true });
    const { kode, tiket } = kompetisiUji(s.riwayat, jam);
    const m = await mejaKompetisi(s.server.port, jam, kode, tiket);
    expect(await healthz(s.server.port)).toMatchObject({ meja: 1, mejaMain: 1 });
    for (const k of [m.b, m.a]) {
      k.kirim({ t: 'keluar' });
      await tungguPesan(k, (p) => p.t === 'keluar');
    }
    expect(await healthz(s.server.port)).toMatchObject({ meja: 0, mejaMain: 0 });
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
