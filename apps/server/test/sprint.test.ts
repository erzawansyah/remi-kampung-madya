// Sprint di server (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026): pesan `sprint` membuat meja satu
// pemain lawan lima warga kedai Suhu tanpa batas putaran yang langsung main; setiap putaran yang selesai
// langsung dicatat di tabel sprint_putaran (migrasi v8), sekali saja (sambung ulang, restart, Keluar),
// papan GET /api/sprint (baris 0.8.0 di tabel sprint ikut dijumlah), dan pesan `sprintHasil` per putaran.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ViewPemain } from '@remi/engine';
import { awalMingguWib, hasilPutaranSprint, TEKS_SPRINT_TERKUNCI } from '@remi/meja';
import { bukaRiwayat, MIGRASI, type PenyimpanRiwayat } from '../src/riwayat.js';
import { MAKS_BARIS_SPRINT, SKEMA_SPRINT, SKEMA_SPRINT_MINGGUAN, SKEMA_SPRINT_PUTARAN, type PapanSprint, type PapanSprintV2 } from '../src/sprint.js';
import { SKEMA_SPRINT_SIMPANAN } from '../src/sprintSimpanan.js';
import { jalankanServer, UMUR_MAKS_SIMPANAN_MEJA_MS, type OpsiServer, type ServerRemi } from '../src/server.js';
import {
  barisSprint,
  dataSprintTersimpan,
  errors,
  infoTerakhir,
  JamGeser,
  klien,
  pemainOtomatis,
  putaranSelesai,
  sampai,
  tulisDataSprint,
  tungguPesan,
  viewTerakhir,
} from './bantuSprint.js';

const folder = mkdtempSync(join(tmpdir(), 'remi-sprint-'));
let nomorDb = 0;
const dbBaru = () => join(folder, `remi-${++nomorDb}.db`);

const dibuka: { server: ServerRemi | null; riwayat: PenyimpanRiwayat | null; db: DatabaseSync | null }[] = [];
async function nyalakan(opsi: Partial<OpsiServer> = {}, path = ':memory:') {
  const db = new DatabaseSync(path);
  const riwayat = bukaRiwayat(db);
  const log: string[] = [];
  const server = await jalankanServer({
    acakDuduk: false,
    port: 0,
    host: '127.0.0.1',
    jedaBotMs: 2,
    batasPesanPerDetik: 1000,
    putusPesanPerDetik: 5000,
    riwayat,
    log: (...x) => log.push(x.map((v) => (v instanceof Error ? v.message : String(v))).join(' ')),
    ...opsi,
  });
  const c = { server: server as ServerRemi | null, riwayat: riwayat as PenyimpanRiwayat | null, db: db as DatabaseSync | null };
  dibuka.push(c);
  const matikan = async () => {
    await c.server?.tutup();
    c.riwayat?.tutup();
    c.db?.close();
    c.server = c.riwayat = null;
    c.db = null;
  };
  return { server, riwayat, db, log, matikan, alamat: `http://127.0.0.1:${server.port}` };
}
afterEach(async () => {
  for (const c of dibuka.splice(0)) {
    await c.server?.tutup();
    c.riwayat?.tutup();
    c.db?.close();
  }
});
afterAll(() => rmSync(folder, { recursive: true, force: true }));

/**
 * Jadikan sprint `kode` seperti meja sprint 0.10.0 (tanpa token): datanya dipindah ke meja_aktif, barisnya di
 * sprint_simpanan dibuang. Server yang mulai sesudahnya memulihkannya lewat jalur lama.
 */
function jadikanSprintLama(path: string, kode: unknown, token: unknown, ubah?: (d: { sprint: { putaranTercatat?: number } }) => void, umur = 0) {
  const db = new DatabaseSync(path);
  const data = dataSprintTersimpan<{ sprint: { putaranTercatat?: number; kursi: number }; kursi: { pemainId: unknown }[] }>(db, kode)!;
  // Di sprint_simpanan token kursi hanya sebagai hash; meja 0.10.0 di meja_aktif memuat token aslinya.
  data.kursi[data.sprint.kursi].pemainId = token;
  ubah?.(data);
  db.prepare('INSERT INTO meja_aktif (kode, data, pembuat_jaringan, diperbarui_pada) VALUES (?, ?, NULL, ?)').run(String(kode), JSON.stringify(data), Date.now() - umur);
  db.prepare('DELETE FROM sprint_simpanan WHERE kode = ?').run(String(kode));
  db.close();
}
const jumlahBarisLama = (db: DatabaseSync) => (db.prepare('SELECT COUNT(*) AS n FROM sprint').get() as { n: number }).n;

/** Hasil putaran pemain (kursi k) dari riwayat view, persis aturan hasilPutaranSprint. */
function hasilDariView(v: ViewPemain, i: number, k: number) {
  const h = hasilPutaranSprint(v.riwayat, i, k);
  return { putaran: h.putaran, skor: h.skor, menang: h.menang ? 1 : 0, mentung: h.mentung, kepentung: h.kepentung };
}
const HARI = 86_400_000;

describe('penyimpan sprint (migrasi v7 dan v8)', () => {
  it('v8 = tabel sprint_putaran; putaran yang sama tercatat sekali; baris v7 (0.8.0) ikut dijumlah; minggu per waktu putaran', () => {
    expect(MIGRASI.length).toBe(10);
    expect(MIGRASI[9]).toBe(SKEMA_SPRINT_MINGGUAN);
    expect(MIGRASI[6]).toBe(SKEMA_SPRINT);
    expect(MIGRASI[7]).toBe(SKEMA_SPRINT_PUTARAN);
    expect(MIGRASI[8]).toBe(SKEMA_SPRINT_SIMPANAN);
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    const senin = awalMingguWib(Date.UTC(2026, 10, 25, 5));
    // Satu percobaan 0.8.0 minggu lalu (baris v7 apa adanya).
    db.prepare(
      `INSERT INTO sprint (kode_meja, mulai_pada, nama, kunci_nama, waktu, putaran, skor, menang, mentung, kepentung, selesai)
       VALUES ('LAMA1', 1, 'Budi', 'budi', ?, 5, 300, 1, 2, 1, 1)`,
    ).run(senin - 3 * HARI);
    const c = (kode: string, putaran: number, nama: string, waktu: number, menang: boolean, skor: number, mentung = 0, kepentung = 0) => ({
      kode,
      mulaiPada: 1000,
      putaran,
      nama,
      waktu,
      menang,
      skor,
      mentung,
      kepentung,
    });
    expect(r.sprint.catat(c('AAAAA', 1, 'Ani', senin - 2 * HARI, true, 80, 1))).toBe(true);
    // Putaran yang sama (kode + waktu mulai + nomor putaran) tidak tercatat dua kali.
    expect(r.sprint.catat(c('AAAAA', 1, 'Ani', senin - 2 * HARI, true, 80, 1))).toBe(false);
    // Minggu 23.59 WIB: masih minggu lalu; putaran berikutnya di meja yang sama selesai Senin 00.00 WIB.
    expect(r.sprint.catat(c('AAAAA', 2, 'Ani', senin - 60_000, false, -40, 0, 1))).toBe(true);
    expect(r.sprint.catat(c('AAAAA', 3, 'ani', senin, true, 25))).toBe(true);
    r.sprint.catat(c('BBBBB', 1, 'budi', senin + 3_600_000, true, 10, 0, 0));
    r.sprint.catat(c('BBBBB', 2, 'Budi', senin + 7_200_000, false, -100, 0, 1));
    const sekarang = senin + HARI;
    const minggu = r.sprint.papan('minggu', sekarang);
    expect(minggu).toMatchObject({ periode: 'minggu', mulai: senin });
    // Minggu lalu: Budi menang 1 (percobaan lama) dan Ani menang 1; skor Budi lebih tinggi, jadi Budi juara.
    expect(minggu.baris).toEqual([
      { nama: 'ani', putaran: 1, menang: 1, mentung: 0, kepentung: 0, skor: 25, piala: 0 },
      { nama: 'Budi', putaran: 2, menang: 1, mentung: 0, kepentung: 1, skor: -90, piala: 1 },
    ]);
    // Sepanjang masa (27 Nov 2026): minggu terbaik tiap orang. Budi: minggu lalu (percobaan 0.8.0, 5 putaran,
    // 300) lebih baik dari minggu ini (−90); Ani: minggu lalu 80 − 40 = 40 lebih baik dari minggu ini 25.
    expect(r.sprint.papan('semua', sekarang)).toEqual({
      periode: 'semua',
      mulai: null,
      baris: [
        { nama: 'Budi', putaran: 5, menang: 1, mentung: 2, kepentung: 1, skor: 300, piala: 1, minggu: senin - 7 * HARI },
        { nama: 'ani', putaran: 2, menang: 1, mentung: 1, kepentung: 1, skor: 40, piala: 0, minggu: senin - 7 * HARI },
      ],
    });
    expect(r.sprint.peringkatMinggu('BUDI', sekarang)).toBe(2);
    expect(r.sprint.peringkatMinggu('Cici', sekarang)).toBeNull();
    expect(jumlahBarisLama(db)).toBe(1);
    for (let i = 0; i < MAKS_BARIS_SPRINT + 5; i++) r.sprint.catat(c(`X${String(i).padStart(4, '0')}`, 1, `Orang ${i}`, sekarang, false, i));
    expect(r.sprint.papan('semua', sekarang).baris).toHaveLength(MAKS_BARIS_SPRINT);
    r.tutup();
    db.close();
  });
});

describe('papan Sepanjang masa dan penggulungan mingguan (migrasi v10, 27 Nov 2026)', () => {
  const MG = 7 * HARI;
  const SENIN = awalMingguWib(Date.UTC(2026, 10, 25, 5));
  const c = (kode: string, putaran: number, nama: string, waktu: number, skor: number, menang = false, mentung = 0, kepentung = 0) => ({
    kode,
    mulaiPada: 1000,
    putaran,
    nama,
    waktu,
    menang,
    skor,
    mentung,
    kepentung,
  });
  const ringkasan = (db: DatabaseSync) =>
    db.prepare('SELECT minggu, kunci_nama, nama, putaran, menang, mentung, kepentung, skor FROM sprint_mingguan ORDER BY minggu, kunci_nama').all().map((x) => ({ ...x }));

  it('contoh pemilik: minggu 1 Jos 2000; minggu 2 Jis 2100, Jos 700 → Jis lalu Jos; minggu berjalan ikut; baris v7 ikut minggunya', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    r.sprint.catat(c('JOS01', 1, 'Jos', SENIN - MG + HARI, 1500, true));
    r.sprint.catat(c('JOS01', 2, 'Jos', SENIN - MG + 2 * HARI, 500, true));
    r.sprint.catat(c('JIS01', 1, 'Jis', SENIN + HARI, 2100, true));
    r.sprint.catat(c('JOS02', 1, 'jos', SENIN + HARI, 700));
    // Percobaan 0.8.0 tiga minggu lalu: 1900, tidak mengalahkan 2000.
    db.prepare(
      `INSERT INTO sprint (kode_meja, mulai_pada, nama, kunci_nama, waktu, putaran, skor, menang, mentung, kepentung, selesai)
       VALUES ('LAMA1', 1, 'Jos', 'jos', ?, 5, 1900, 1, 2, 1, 1)`,
    ).run(SENIN - 3 * MG);
    const sekarang = SENIN + 2 * HARI;
    const semua = r.sprint.papanV2('semua', sekarang, 'JOS');
    expect(semua.atas.map((b) => [b.peringkat, b.nama, b.skor, b.minggu])).toEqual([
      [1, 'Jis', 2100, SENIN],
      [2, 'jos', 2000, SENIN - MG],
    ]);
    expect(semua.jumlah).toBe(2);
    // Minggu ini tetap menang dulu (Jis menang 1, jos 0).
    expect(r.sprint.papanV2('minggu', sekarang).atas.map((b) => [b.nama, b.skor])).toEqual([
      ['Jis', 2100],
      ['jos', 700],
    ]);
    // Percobaan 0.8.0 jadi minggu terbaik kalau skornya lebih tinggi.
    db.prepare("UPDATE sprint SET skor = 2500").run();
    r.sprint.catat(c('JIS01', 2, 'Jis', SENIN + HARI + 1, 0)); // catatan baru = cache dikosongkan
    expect(r.sprint.papan('semua', sekarang).baris.find((b) => b.nama === 'jos')).toMatchObject({ skor: 2500, putaran: 5, minggu: SENIN - 3 * MG });
    r.tutup();
    db.close();
  });

  it('gulung: minggu yang sudah selesai jadi satu baris per orang per minggu; papan tidak berubah; idempoten', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    // Dua minggu lalu dan minggu lalu, beberapa meja; minggu ini juga.
    r.sprint.catat(c('AAAAA', 1, 'ani', SENIN - 2 * MG + HARI, 50, true, 1));
    r.sprint.catat(c('AAAAA', 2, 'Ani', SENIN - 2 * MG + 2 * HARI, -20, false, 0, 1));
    r.sprint.catat(c('BBBBB', 1, 'Ani', SENIN - MG + HARI, 300, true));
    r.sprint.catat(c('CCCCC', 1, 'Budi', SENIN - MG + HARI, 90, true));
    r.sprint.catat(c('CCCCC', 2, 'Budi', SENIN - 60_000, 10, false, 1));
    // Meja CCCCC lanjut lewat Senin 00.00 WIB: putaran 3 masuk minggu ini dan tidak digulung.
    r.sprint.catat(c('CCCCC', 3, 'Budi', SENIN + 60_000, 5));
    const sekarang = SENIN + HARI;
    const sebelum = { m: r.sprint.papan('minggu', sekarang), s: r.sprint.papan('semua', sekarang), p: r.sprint.peringkatMinggu('budi', sekarang) };
    expect(r.sprint.gulung(sekarang)).toBe(5);
    expect(ringkasan(db)).toEqual([
      { minggu: SENIN - 2 * MG, kunci_nama: 'ani', nama: 'Ani', putaran: 2, menang: 1, mentung: 1, kepentung: 1, skor: 30 },
      { minggu: SENIN - MG, kunci_nama: 'ani', nama: 'Ani', putaran: 1, menang: 1, mentung: 0, kepentung: 0, skor: 300 },
      { minggu: SENIN - MG, kunci_nama: 'budi', nama: 'Budi', putaran: 2, menang: 1, mentung: 1, kepentung: 0, skor: 100 },
    ]);
    expect(barisSprint(db).map((x) => [x.kode_meja, x.putaran])).toEqual([['CCCCC', 3]]);
    expect(db.prepare('SELECT kode_meja, putaran_sampai FROM sprint_tergulung ORDER BY kode_meja').all().map((x) => ({ ...x }))).toEqual([
      { kode_meja: 'AAAAA', putaran_sampai: 2 },
      { kode_meja: 'BBBBB', putaran_sampai: 1 },
      { kode_meja: 'CCCCC', putaran_sampai: 2 },
    ]);
    // Papan (kedua periode, juga piala dan peringkat) persis sama sebelum dan sesudah digulung.
    expect({ m: r.sprint.papan('minggu', sekarang), s: r.sprint.papan('semua', sekarang), p: r.sprint.peringkatMinggu('budi', sekarang) }).toEqual(sebelum);
    expect(sebelum.s.baris.map((b) => [b.nama, b.skor, b.piala])).toEqual([
      // Ani juara dua minggu itu (sendirian, lalu skor di atas Budi dengan menang sama).
      ['Ani', 300, 2],
      ['Budi', 100, 0],
    ]);
    // Idempoten: tidak ada yang digulung lagi.
    expect(r.sprint.gulung(sekarang)).toBe(0);
    expect(r.sprint.gulung(sekarang + 3 * HARI)).toBe(0);
    expect(ringkasan(db)).toHaveLength(3);
    // Putaran yang sudah digulung dicatat lagi (restart, pencatatan ulang): ditolak, tidak terhitung dua kali.
    expect(r.sprint.catat(c('AAAAA', 2, 'Ani', SENIN - 2 * MG + 2 * HARI, -20))).toBe(false);
    expect(r.sprint.catat(c('CCCCC', 1, 'Budi', SENIN - MG + HARI, 90, true))).toBe(false);
    // Putaran telat dari minggu yang sudah digulung (meja yang dipulihkan mencatat belakangan): masuk sekali.
    expect(r.sprint.catat(c('CCCCC', 3, 'Budi', SENIN + 60_000, 5))).toBe(false); // sudah ada (belum digulung)
    expect(r.sprint.catat(c('BBBBB', 2, 'Ani', SENIN - MG + 3 * HARI, 40, true))).toBe(true);
    expect(r.sprint.catat(c('BBBBB', 2, 'Ani', SENIN - MG + 3 * HARI, 40, true))).toBe(false);
    expect(r.sprint.papan('semua', sekarang).baris[0]).toMatchObject({ nama: 'Ani', skor: 340, putaran: 2, menang: 2 });
    expect(r.sprint.gulung(sekarang)).toBe(1);
    expect(r.sprint.catat(c('BBBBB', 2, 'Ani', SENIN - MG + 3 * HARI, 40, true))).toBe(false);
    expect(ringkasan(db)[1]).toEqual({ minggu: SENIN - MG, kunci_nama: 'ani', nama: 'Ani', putaran: 2, menang: 2, mentung: 0, kepentung: 0, skor: 340 });
    expect(r.sprint.papan('semua', sekarang).baris[0]).toMatchObject({ nama: 'Ani', skor: 340, putaran: 2, menang: 2 });
    // Minggu berganti: minggu ini ikut digulung; papan Sepanjang masa tetap sama.
    const s = r.sprint.papan('semua', SENIN + MG + HARI);
    expect(r.sprint.gulung(SENIN + MG + HARI)).toBe(1);
    expect(r.sprint.papan('semua', SENIN + MG + HARI)).toEqual(s);
    expect(barisSprint(db)).toEqual([]);
    r.tutup();
    db.close();
  });

  it('gulung saat database dibuka (server mulai), dengan log', () => {
    const path = dbBaru();
    const r1 = bukaRiwayat(path, { sekarang: () => SENIN + HARI });
    r1.sprint.catat(c('AAAAA', 1, 'Ani', SENIN - HARI, 10));
    r1.sprint.catat(c('AAAAA', 2, 'Ani', SENIN + 60_000, 20));
    r1.tutup();
    const log: string[] = [];
    const r2 = bukaRiwayat(path, { sekarang: () => SENIN + HARI, log: (...x) => log.push(x.join(' ')) });
    expect(log).toContain('sprint: 1 putaran minggu lalu digulung');
    expect(r2.sprint.papan('semua', SENIN + HARI).baris).toEqual([
      // Minggu lalu (10) sudah digulung; minggu ini (20) lebih baik. Juara minggu lalu = piala.
      { nama: 'Ani', putaran: 1, menang: 0, mentung: 0, kepentung: 0, skor: 20, piala: 1, minggu: SENIN },
    ]);
    r2.tutup();
  });

  it('papanV2: 10 teratas, 10 terbawah, baris sendiri di antaranya (nama tanpa beda huruf besar/kecil)', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    const sekarang = SENIN + HARI;
    for (let i = 1; i <= 30; i++) r.sprint.catat(c(`K${String(i).padStart(4, '0')}`, 1, `Orang ${i}`, SENIN + 1000 + i, 1000 - i * 10, false));
    const p = r.sprint.papanV2('minggu', sekarang, 'orang 15');
    expect([p.v, p.jumlah, p.atas.length, p.bawah.length]).toEqual([2, 30, 10, 10]);
    expect(p.atas[0]).toMatchObject({ nama: 'Orang 1', peringkat: 1 });
    expect(p.bawah.map((b) => b.peringkat)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
    expect(p.saya).toMatchObject({ nama: 'Orang 15', peringkat: 15 });
    expect(r.sprint.papanV2('minggu', sekarang, 'Orang 3').saya).toBeNull();
    expect(r.sprint.papanV2('semua', sekarang, null).saya).toBeNull();
    // Bentuk lama tetap: semua baris (sampai MAKS_BARIS_SPRINT), tanpa peringkat.
    const lama = r.sprint.papan('minggu', sekarang);
    expect(Object.keys(lama)).toEqual(['periode', 'mulai', 'baris']);
    expect(lama.baris).toHaveLength(30);
    expect(lama.baris[0]).not.toHaveProperty('peringkat');
    r.tutup();
    db.close();
  });
});

describe('sprint di server', () => {
  it('pesan sprint: meja langsung main lawan lima warga kedai Suhu (6 pemain, tanpa batas putaran), pengaturan dikunci kecuali tempo', async () => {
    const { server } = await nyalakan();
    const a = await klien(server.port);
    a.kirim({ t: 'sprint', nama: '  Budi  ' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    expect(masuk.kursi).toBe(0);
    expect(a.pesan[0].t).toBe('masuk');
    await tungguPesan(a, (p) => p.t === 'view');
    const info = infoTerakhir(a)!;
    expect(info.sprint).toBe(true);
    expect(info.status).toBe('main');
    expect(info.kursi.map((k) => [k.jenis, k.nama, k.level])).toEqual([
      ['manusia', 'Budi', 'suhu'],
      ['bot', 'Kipas Dua', 'suhu'],
      ['bot', 'Cak Kopag', 'suhu'],
      ['bot', 'Mbak Teras', 'suhu'],
      ['bot', 'Mas Sampul', 'suhu'],
      ['bot', 'Si Rak', 'suhu'],
    ]);
    expect(info.pengaturan).toMatchObject({
      jumlahPemain: 6,
      duaDeckUntukEmpat: false,
      batasPutaran: null,
      batasSkorAtas: null,
      batasSkorBawah: null,
      detikGiliran: 0,
      tempoBot: 'cepat',
      publik: false,
    });
    expect(info.pengaturan.modeKaldu).toBeUndefined();
    expect(viewTerakhir(a).putaran!.jumlahKartuTangan).toEqual([9, 9, 9, 9, 9, 9]);
    expect(viewTerakhir(a).konfigurasi.batasPutaran).toBeNull();
    a.kirim({ t: 'pengaturan', pengaturan: { tempoBot: 'santai' } });
    await sampai(() => infoTerakhir(a)?.pengaturan.tempoBot === 'santai');
    a.kirim({ t: 'pengaturan', pengaturan: { batasPutaran: 9 } });
    a.kirim({ t: 'aturKursi', kursi: 1, jenis: 'kosong' });
    a.kirim({ t: 'mainLagi' });
    await sampai(() => errors(a).length >= 3);
    expect(errors(a).slice(0, 2)).toEqual([TEKS_SPRINT_TERKUNCI, TEKS_SPRINT_TERKUNCI]);
    // Meja sprint privat: tidak muncul di daftar lobi publik.
    a.kirim({ t: 'daftar' });
    const daftar = await tungguPesan(a, (p) => p.t === 'daftar');
    expect(daftar.meja).toEqual([]);
    a.ws.close();
  });

  it('kursi diacak di server (#62): `masuk` membawa kursi baru pemain', async () => {
    const { server } = await nyalakan({ acakDuduk: () => 0 });
    const a = await klien(server.port);
    a.kirim({ t: 'sprint', nama: 'Budi' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    expect(masuk.kursi).toBe(5);
    await tungguPesan(a, (p) => p.t === 'view');
    expect(infoTerakhir(a)!.kursiSaya).toBe(5);
    expect(infoTerakhir(a)!.kursi[5].nama).toBe('Budi');
    a.ws.close();
  });

  it('tiap putaran langsung tercatat (sekali), sprintHasil per putaran, papan menampilkannya; Keluar tidak mencatat ulang', async () => {
    const { server, db, alamat, log } = await nyalakan();
    const a = await klien(server.port, pemainOtomatis(2));
    a.kirim({ t: 'sprint', nama: 'Budi' });
    const h1 = await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 60_000);
    // Putaran 1 sudah di database sebelum putaran 2 dimainkan.
    expect(barisSprint(db).map((b) => b.putaran)).toEqual([1]);
    const h2 = await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 2, 60_000);
    await tungguPesan(a, putaranSelesai(2));
    // Tanpa batas putaran: permainannya tidak selesai sendiri.
    expect(infoTerakhir(a)!.status).toBe('main');
    const v = viewTerakhir(a);
    expect(v.riwayat).toHaveLength(2);
    expect(v.riwayat.some((h) => h.kaldu)).toBe(false);
    const kode = infoTerakhir(a)!.kode;
    const b = barisSprint(db);
    expect(b.map(({ waktu: _, ...x }) => x)).toEqual([0, 1].map((i) => ({ kode_meja: kode, nama: 'Budi', kunci_nama: 'budi', ...hasilDariView(v, i, 0) })));
    for (const [h, i] of [
      [h1, 0],
      [h2, 1],
    ] as const) {
      const r = hasilDariView(v, i, 0);
      expect(h).toEqual({
        t: 'sprintHasil',
        putaran: i + 1,
        menang: r.menang === 1,
        skor: r.skor,
        mentung: r.mentung,
        kepentung: r.kepentung,
        peringkatMinggu: 1,
      });
    }
    expect(log.filter((l) => l.includes('dicatat'))).toEqual([`sprint meja ${kode} putaran 1 dicatat`, `sprint meja ${kode} putaran 2 dicatat`]);
    // Pemain otomatis kadang bereaksi pada view yang sudah basi (aksi ganda di jaringan): penolakan aturan
    // biasa boleh, penolakan khusus sprint tidak.
    expect(errors(a).filter((e) => String(e).includes('print'))).toEqual([]);
    // Tidak masuk klasemen umum/Riwayat.
    expect((db.prepare('SELECT COUNT(*) AS n FROM permainan').get() as { n: number }).n).toBe(0);
    const papan = (await (await fetch(`${alamat}/api/sprint`)).json()) as PapanSprint;
    expect(papan.periode).toBe('minggu');
    expect(papan.mulai).toBe(awalMingguWib(Date.now()));
    const jumlah = (k: 'skor' | 'menang' | 'mentung' | 'kepentung') => b.reduce((n, x) => n + Number(x[k]), 0);
    // Bentuk jawaban API tetap (aplikasi lama); 0.10.2 hanya menambah putaran.
    expect(papan.baris).toEqual([
      { nama: 'Budi', putaran: b.length, menang: jumlah('menang'), mentung: jumlah('mentung'), kepentung: jumlah('kepentung'), skor: jumlah('skor'), piala: 0 },
    ]);
    // Sepanjang masa: satu minggu saja, jadi angkanya sama, plus awal minggu terbaiknya.
    const semua = (await (await fetch(`${alamat}/api/sprint?periode=semua`)).json()) as PapanSprint;
    expect(semua).toEqual({ periode: 'semua', mulai: null, baris: [{ ...papan.baris[0], minggu: awalMingguWib(Date.now()) }] });
    // v=2 (aplikasi 0.10.2): atas/bawah/saya/jumlah dengan peringkat; baris sendiri dicari dari nama.
    const v2 = (await (await fetch(`${alamat}/api/sprint?periode=minggu&v=2&nama=BUDI`)).json()) as PapanSprintV2;
    expect(v2).toEqual({ v: 2, periode: 'minggu', mulai: papan.mulai, jumlah: 1, atas: [{ ...papan.baris[0], peringkat: 1 }], bawah: [], saya: null });
    // Periode yang tidak dikenal = minggu ini.
    expect(((await (await fetch(`${alamat}/api/sprint?periode=ngawur`)).json()) as PapanSprint).periode).toBe('minggu');
    expect((await fetch(`${alamat}/api/sprint`, { method: 'POST' })).status).toBe(405);
    // Keluar di antara putaran: tidak ada yang dicatat lagi, mejanya dibuang.
    a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    expect(barisSprint(db)).toHaveLength(2);
    expect(jumlahBarisLama(db)).toBe(0);
    a.ws.close();
  }, 90_000);

  it('Keluar di tengah putaran: putaran yang sudah selesai tetap ada, yang setengah jalan tidak dihitung', async () => {
    const { server, db } = await nyalakan();
    const lanjut = { sampai: 1 };
    const a = await klien(server.port, pemainOtomatis(lanjut));
    a.kirim({ t: 'sprint', nama: 'Ani' });
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    await tungguPesan(a, putaranSelesai(1));
    // Mulai putaran 2, main sebentar, lalu Keluar.
    lanjut.sampai = 2;
    a.kirim({ t: 'putaranBerikut' });
    await tungguPesan(a, (p) => p.t === 'view' && (p.view as ViewPemain).putaran?.nomor === 2);
    a.kirim({ t: 'keluar' });
    await tungguPesan(a, (p) => p.t === 'keluar');
    await sampai(() => server.jumlahMeja() === 0);
    expect(barisSprint(db)).toMatchObject([{ nama: 'Ani', putaran: 1 }]);
    a.ws.close();
  }, 50_000);

  it('Keluar sebelum putaran pertama selesai: tidak tercatat sama sekali, mejanya tetap langsung dihapus', async () => {
    const { server, db, log } = await nyalakan();
    const a = await klien(server.port);
    a.kirim({ t: 'sprint', nama: 'Dodi' });
    await tungguPesan(a, (p) => p.t === 'view');
    a.kirim({ t: 'keluar' });
    await tungguPesan(a, (p) => p.t === 'keluar');
    await sampai(() => server.jumlahMeja() === 0);
    expect(barisSprint(db)).toEqual([]);
    expect(log.some((l) => l.includes('dicatat'))).toBe(false);
    const papan = (await (await fetch(`http://127.0.0.1:${server.port}/api/sprint`)).json()) as PapanSprint;
    expect(papan.baris).toEqual([]);
    a.ws.close();
  }, 20_000);

  it('pergantian minggu di tengah sesi: tiap putaran masuk minggu saat putaran itu selesai', async () => {
    const jam = new JamGeser();
    // 30 menit sebelum Senin 00.00 WIB berikutnya.
    const senin = awalMingguWib(Date.now()) + 7 * HARI;
    jam.geser = senin - 30 * 60_000 - Date.now();
    const { server, db, alamat } = await nyalakan({ penjadwal: jam });
    const lanjut = { sampai: 1 };
    const a = await klien(server.port, pemainOtomatis(lanjut));
    a.kirim({ t: 'sprint', nama: 'Eli' });
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    await tungguPesan(a, putaranSelesai(1));
    // Jam lewat Senin 00.00 WIB, lalu putaran 2 dimainkan.
    jam.geser += 60 * 60_000;
    lanjut.sampai = 2;
    a.kirim({ t: 'putaranBerikut' });
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 2, 40_000);
    const [b1, b2] = barisSprint(db);
    expect(Number(b1.waktu)).toBeLessThan(senin);
    expect(Number(b2.waktu)).toBeGreaterThanOrEqual(senin);
    const papan = (await (await fetch(`${alamat}/api/sprint`)).json()) as PapanSprint;
    expect(papan.mulai).toBe(senin);
    // Minggu ini hanya putaran 2; minggu lalu (putaran 1) sudah punya juara: Eli.
    expect(papan.baris).toEqual([
      { nama: 'Eli', putaran: 1, menang: Number(b2.menang), mentung: Number(b2.mentung), kepentung: Number(b2.kepentung), skor: Number(b2.skor), piala: 1 },
    ]);
    a.ws.close();
  }, 90_000);

  it('restart dan sambung ulang: putaran tidak tercatat dua kali, sprint yang dimuat lagi tetap mencatat', async () => {
    const path = dbBaru();
    const jam = new JamGeser();
    const s1 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    const a = await klien(s1.server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Cici' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    await tungguPesan(a, putaranSelesai(1));
    // Sambung ulang di server yang sama: kabar putaran terakhir dikirim lagi, tanpa catatan baru.
    const ulang = await klien(s1.server.port);
    ulang.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Cici', token: masuk.token });
    expect(await tungguPesan(ulang, (p) => p.t === 'sprintHasil')).toMatchObject({ putaran: 1 });
    expect(barisSprint(s1.db)).toHaveLength(1);
    a.ws.close();
    ulang.ws.close();
    await s1.matikan();
    // Seolah server mati sesudah putaran 1 masuk database tapi sebelum tandanya ikut tersimpan.
    const dbLuar = new DatabaseSync(path);
    const data = dataSprintTersimpan<{ sprint: { putaranTercatat?: number } }>(dbLuar, masuk.kode)!;
    expect(data.sprint.putaranTercatat).toBe(1);
    data.sprint.putaranTercatat = 0;
    tulisDataSprint(dbLuar, masuk.kode, data);
    // Sprint yang bisa dilanjut tidak pernah ditulis ke meja_aktif.
    expect((dbLuar.prepare('SELECT COUNT(*) AS n FROM meja_aktif').get() as { n: number }).n).toBe(0);
    dbLuar.close();

    // Server mulai lagi: sprint yang dijeda tidak dimuat ke memori sampai pemainnya kembali.
    const lanjut = { sampai: 1 };
    const s2 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    expect(s2.server.jumlahMeja()).toBe(0);
    const b = await klien(s2.server.port, pemainOtomatis(lanjut));
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Cici', token: masuk.token });
    const lagi = await tungguPesan(b, (p) => p.t === 'masuk');
    expect(lagi.kursi).toBe(masuk.kursi);
    expect(s2.server.jumlahMeja()).toBe(1);
    // Putaran 1 dicoba dicatat lagi saat dimuat, tapi ditolak database.
    expect(s2.log.some((l) => l.includes(`sprint meja ${masuk.kode} putaran 1 dicatat (1 sudah tercatat sebelumnya)`))).toBe(true);
    expect(barisSprint(s2.db)).toHaveLength(1);
    await tungguPesan(b, putaranSelesai(1));
    // Main lagi di sprint yang dimuat: putaran 2 tercatat seperti biasa.
    lanjut.sampai = 2;
    b.kirim({ t: 'putaranBerikut' });
    await tungguPesan(b, (p) => p.t === 'sprintHasil' && p.putaran === 2, 40_000);
    expect(barisSprint(s2.db).map((x) => x.putaran)).toEqual([1, 2]);
    b.ws.close();
    await s2.matikan();

    // Server mati sampai minggu berganti: sprint-nya selesai (dibuang saat server mulai), tanpa catatan baru.
    jam.geser += 8 * HARI;
    const s3 = await nyalakan({ penjadwal: jam }, path);
    expect(s3.server.jumlahMeja()).toBe(0);
    expect((s3.db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan').get() as { n: number }).n).toBe(0);
    // Minggu itu sudah selesai: kedua putarannya digulung jadi satu baris sprint_mingguan (27 Nov 2026).
    expect(barisSprint(s3.db)).toEqual([]);
    expect(s3.db.prepare('SELECT kunci_nama, putaran FROM sprint_mingguan').all().map((x) => ({ ...x }))).toEqual([{ kunci_nama: 'cici', putaran: 2 }]);
    expect(s3.db.prepare('SELECT kode_meja, putaran_sampai FROM sprint_tergulung').all().map((x) => ({ ...x }))).toEqual([
      { kode_meja: masuk.kode, putaran_sampai: 2 },
    ]);
  }, 120_000);

  it('putaran selesai: simpanan sprint ditulis sebelum putarannya masuk papan (tanpa menunggu jeda simpan)', async () => {
    const { server, db } = await nyalakan({ jedaSimpanMejaMs: 60 * 60_000 });
    const a = await klien(server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Gita' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    expect(barisSprint(db)).toHaveLength(1);
    const data = dataSprintTersimpan<{ game: { riwayat: unknown[] }; sprint: { putaranTercatat?: number } }>(db, masuk.kode);
    expect(data).toBeDefined();
    // Simpanan sudah memuat putaran 1 (yang tercatat di papan), walau tanda tercatatnya belum ikut ditulis.
    expect(data!.game.riwayat).toHaveLength(1);
    expect(data!.sprint.putaranTercatat).toBe(0);
    a.ws.close();
  }, 60_000);

  it('restart sesudah semua putaran tercatat: kabar putaran terakhir tetap dikirim ke yang tersambung kembali', async () => {
    const path = dbBaru();
    const jam = new JamGeser();
    const s1 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    const a = await klien(s1.server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Hana' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    const h1 = await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    await tungguPesan(a, putaranSelesai(1));
    a.ws.close();
    await s1.matikan();
    const s2 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    expect(s2.server.jumlahMeja()).toBe(0);
    const b = await klien(s2.server.port);
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Hana', token: masuk.token });
    expect(await tungguPesan(b, (p) => p.t === 'sprintHasil')).toEqual(h1);
    expect(s2.log.some((l) => l.includes('dicatat'))).toBe(false);
    expect(barisSprint(s2.db)).toHaveLength(1);
    b.ws.close();
  }, 60_000);

  it('meja sprint 0.10.0 (tanpa token, di meja_aktif) tetap dipulihkan dan mencatat seperti dulu', async () => {
    const path = dbBaru();
    const jam = new JamGeser();
    const s1 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    const a = await klien(s1.server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Fajar' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    await tungguPesan(a, putaranSelesai(1));
    a.ws.close();
    await s1.matikan();
    jadikanSprintLama(path, masuk.kode, masuk.token);
    const lanjut = { sampai: 1 };
    const s2 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    expect(s2.server.jumlahMeja()).toBe(1);
    const b = await klien(s2.server.port, pemainOtomatis(lanjut));
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Fajar', token: masuk.token });
    await tungguPesan(b, putaranSelesai(1));
    lanjut.sampai = 2;
    b.kirim({ t: 'putaranBerikut' });
    await tungguPesan(b, (p) => p.t === 'sprintHasil' && p.putaran === 2, 40_000);
    // Tanpa token tidak ada sprintSaya, dan Keluar mengakhirinya seperti 0.10.0 (meja dibuang, tidak disimpan).
    expect(b.pesan.some((p) => p.t === 'sprintSaya')).toBe(false);
    b.kirim({ t: 'keluar' });
    await sampai(() => s2.server.jumlahMeja() === 0);
    expect(barisSprint(s2.db).map((x) => x.putaran)).toEqual([1, 2]);
    expect((s2.db.prepare('SELECT COUNT(*) AS n FROM meja_aktif').get() as { n: number }).n).toBe(0);
    expect((s2.db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan').get() as { n: number }).n).toBe(0);
    b.ws.close();
  }, 90_000);

  it('simpanan 0.10.0 yang tidak dipulihkan: putaran yang belum tercatat dicatat dengan waktu selesainya', async () => {
    const path = dbBaru();
    const jam = new JamGeser();
    const s1 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    const a = await klien(s1.server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Fajar' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    await tungguPesan(a, putaranSelesai(1));
    a.ws.close();
    await s1.matikan();
    // Hapus catatannya dari database (seolah galat saat mencatat) dan tandanya dari simpanan.
    const dbLuar = new DatabaseSync(path);
    const waktuAsli = Number(barisSprint(dbLuar)[0].waktu);
    dbLuar.exec('DELETE FROM sprint_putaran');
    dbLuar.close();
    jadikanSprintLama(path, masuk.kode, masuk.token, (d) => (d.sprint.putaranTercatat = 0));
    jam.geser += UMUR_MAKS_SIMPANAN_MEJA_MS + 60_000;
    const s2 = await nyalakan({ penjadwal: jam }, path);
    expect(s2.server.jumlahMeja()).toBe(0);
    // Waktunya tetap saat putaran itu selesai (tersimpan di data meja), bukan saat server mulai lagi.
    expect(barisSprint(s2.db)).toMatchObject([{ kode_meja: masuk.kode, putaran: 1, nama: 'Fajar', waktu: waktuAsli }]);
  }, 60_000);

  it('tanpa simpanan meja: putaran yang selesai sudah tercatat, server dimatikan tidak menambah apa pun', async () => {
    const { server, db, matikan } = await nyalakan({ simpanMeja: false });
    const a = await klien(server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Dodi' });
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === 1, 40_000);
    // Meja kedua yang belum menyelesaikan satu putaran pun: tidak ikut tercatat.
    const b = await klien(server.port);
    b.kirim({ t: 'sprint', nama: 'Eli' });
    await tungguPesan(b, (p) => p.t === 'view');
    a.ws.close();
    b.ws.close();
    await server.tutup();
    expect(barisSprint(db)).toMatchObject([{ nama: 'Dodi', putaran: 1 }]);
    // Sprint tetap bisa dilanjut walau SIMPAN_MEJA=0: keduanya tersimpan di sprint_simpanan.
    expect((db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan WHERE data IS NOT NULL').get() as { n: number }).n).toBe(2);
    await matikan();
  }, 50_000);

  it('server tanpa riwayat menolak sprint', async () => {
    const server = await jalankanServer({ port: 0, host: '127.0.0.1', log: () => undefined });
    try {
      const a = await klien(server.port);
      a.kirim({ t: 'sprint', nama: 'Eko' });
      const e = await tungguPesan(a, (p) => p.t === 'error');
      expect(e.pesan).toBe('Sprint belum bisa dimainkan di server ini.');
      expect(server.jumlahMeja()).toBe(0);
      expect((await fetch(`http://127.0.0.1:${server.port}/api/sprint`)).status).toBe(503);
      a.ws.close();
    } finally {
      await server.tutup();
    }
  });
});
