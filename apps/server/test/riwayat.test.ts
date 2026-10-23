import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RingkasanAkhir } from '@remi/meja';
import { bukaRiwayat, MIGRASI, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type ServerRemi } from '../src/server.js';

const ringkasan = (kode: string, waktu: number, pemain: [string, number, boolean?][]): RingkasanAkhir => {
  const urut = pemain
    .map(([nama, skor, bot], kursi) => ({ kursi, nama, bot: !!bot, skor, peringkat: 0, mentung: skor > 0 ? 1 : 0, kepentung: skor < 0 ? 1 : 0 }))
    .sort((a, b) => b.skor - a.skor);
  urut.forEach((p, i) => (p.peringkat = i + 1));
  return { kode, selesaiPada: waktu, alasan: 'sepakat', jumlahPutaran: 3, jumlahDeck: pemain.length >= 5 ? 2 : 1, modeKaldu: false, pemain: urut };
};

describe('riwayat SQLite', () => {
  it('menyimpan klasemen akhir dan membacanya kembali (terbaru dulu)', () => {
    const r = bukaRiwayat(':memory:');
    r.simpan(ringkasan('AAAAA', Date.UTC(2026, 9, 1), [['Budi', 120], ['Siti', -40], ['Bot 1', -80, true]]));
    r.simpan(ringkasan('BBBBB', Date.UTC(2026, 9, 2), [['Budi', -10], ['Siti', 90]]));
    const daftar = r.daftar(10);
    expect(daftar.map((p) => p.kodeMeja)).toEqual(['BBBBB', 'AAAAA']);
    expect(daftar[1]).toMatchObject({ jumlahPutaran: 3, alasan: 'sepakat', selesaiPada: '2026-10-01T00:00:00.000Z' });
    expect(daftar[1].klasemen.map((k) => [k.peringkat, k.nama, k.skor, k.bot])).toEqual([
      [1, 'Budi', 120, false],
      [2, 'Siti', -40, false],
      [3, 'Bot 1', -80, true],
    ]);
    expect(r.daftar(1)).toHaveLength(1);
    r.tutup();
  });

  it('peringkat sepanjang masa: hanya manusia, digabung per nama', () => {
    const r = bukaRiwayat(':memory:');
    r.simpan(ringkasan('AAAAA', 1, [['Budi', 120], ['Siti', -40], ['Bot 1', 300, true]]));
    r.simpan(ringkasan('BBBBB', 2, [['Budi', -10], ['Siti', 90]]));
    r.simpan(ringkasan('CCCCC', 3, [['Budi', 50], ['Siti', 10]]));
    const p = r.peringkat();
    expect(p.map((x) => x.nama)).toEqual(['Budi', 'Siti']);
    expect(p[0]).toMatchObject({ main: 3, juara: 1, totalSkor: 160, rataRata: 53, skorTerbaik: 120 });
    expect(p[1]).toMatchObject({ main: 3, juara: 1, totalSkor: 60 });
    r.tutup();
  });
});

describe('endpoint riwayat', () => {
  let server: ServerRemi;
  let riwayat: PenyimpanRiwayat;
  beforeAll(async () => {
    riwayat = bukaRiwayat(':memory:');
    riwayat.simpan(ringkasan('AAAAA', 1, [['Budi', 120], ['Siti', -40]]));
    server = await jalankanServer({ port: 0, host: '127.0.0.1', riwayat, log: () => undefined });
  });
  afterAll(async () => {
    await server.tutup();
    riwayat.tutup();
  });

  it('GET /api/riwayat dan /api/peringkat', async () => {
    const r1 = await fetch(`http://127.0.0.1:${server.port}/api/riwayat?batas=5`);
    expect(r1.status).toBe(200);
    const daftar = (await r1.json()) as { kodeMeja: string }[];
    expect(daftar[0].kodeMeja).toBe('AAAAA');
    const r2 = await fetch(`http://127.0.0.1:${server.port}/api/peringkat`);
    expect(((await r2.json()) as unknown[])[0]).toMatchObject({ nama: 'Budi', juara: 1 });
    const r3 = await fetch(`http://127.0.0.1:${server.port}/api/riwayat`, { method: 'POST' });
    expect(r3.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------------------------
// Skema v1 dan leaderboard (keputusan pemilik #45)

/** Skema v0 persis seperti rilis 0.1/0.2 (sebelum migrasi). */
const DDL_V0 = `
  CREATE TABLE permainan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_meja TEXT NOT NULL,
    selesai_pada TEXT NOT NULL,
    alasan TEXT,
    jumlah_putaran INTEGER NOT NULL
  );
  CREATE TABLE klasemen (
    permainan_id INTEGER NOT NULL REFERENCES permainan(id) ON DELETE CASCADE,
    kursi INTEGER NOT NULL,
    peringkat INTEGER NOT NULL,
    nama TEXT NOT NULL,
    bot INTEGER NOT NULL,
    skor INTEGER NOT NULL,
    mentung INTEGER NOT NULL DEFAULT 0,
    kepentung INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (permainan_id, kursi)
  );
  CREATE INDEX klasemen_nama ON klasemen (nama) WHERE bot = 0;
`;

/** Tulis satu permainan ke database v0 seperti server lama (peringkat dari skor). */
function tulisV0(db: DatabaseSync, kode: string, iso: string, pemain: [string, number, boolean?][]): void {
  const id = Number(db.prepare('INSERT INTO permainan (kode_meja, selesai_pada, alasan, jumlah_putaran) VALUES (?, ?, ?, 2)').run(kode, iso, 'sepakat').lastInsertRowid);
  pemain.forEach(([nama, skor, bot], kursi) => {
    const peringkat = 1 + pemain.filter((q) => q[1] > skor).length;
    db.prepare('INSERT INTO klasemen (permainan_id, kursi, peringkat, nama, bot, skor, mentung, kepentung) VALUES (?, ?, ?, ?, ?, ?, 0, 0)').run(id, kursi, peringkat, nama, bot ? 1 : 0, skor);
  });
}

const versiSkema = (db: DatabaseSync) => Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);

/** Ringkasan dengan tanda keluar: [nama, skor, 'b' = warga kedai | 'k' = keluar]. */
const ringkasanKeluar = (kode: string, waktu: number, pemain: [string, number, ('b' | 'k')?][]): RingkasanAkhir => ({
  kode,
  selesaiPada: waktu,
  alasan: 'sepakat',
  jumlahPutaran: 2,
  jumlahDeck: pemain.length >= 5 ? 2 : 1,
  modeKaldu: false,
  pemain: pemain.map(([nama, skor, j], kursi) => ({
    kursi,
    nama,
    bot: j === 'b',
    ...(j === 'k' ? { keluar: true as const } : {}),
    skor,
    peringkat: 1 + pemain.filter((q) => q[1] > skor).length,
    mentung: 0,
    kepentung: 0,
  })),
});

describe('riwayat SQLite: migrasi skema v0 → terbaru', () => {
  it('database v0 buatan tangan dimigrasi, baris lama dilengkapi, dan migrasi tidak diulang saat dibuka lagi', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(DDL_V0);
    tulisV0(db, 'AAAAA', '2026-10-01T10:00:00.000Z', [['budi', 100], ['Siti', 50], ['Kipas Dua', 20, true]]);
    // Main sendirian lawan warga kedai: tidak dihitung.
    tulisV0(db, 'SOLO1', '2026-10-02T10:00:00.000Z', [['Budi', 900], ['Cak Kopag', 0, true]]);
    tulisV0(db, 'EMPAT', '2026-10-03T10:00:00.000Z', [['Budi', -10], ['Siti', 80], ['Si Rak', 0, true], ['Pak Seng', 5, true]]);
    tulisV0(db, 'LIMAA', '2026-10-04T10:00:00.000Z', [['Budi', 40], ['siti', 30], ['A', 0, true], ['B', 0, true], ['C', 0, true]]);
    tulisV0(db, 'DUAAA', '2026-10-05T10:00:00.000Z', [['Budi', 10], ['Siti', 20]]);
    expect(versiSkema(db)).toBe(0);

    const log: string[] = [];
    const r = bukaRiwayat(db, { log: (...x) => log.push(x.join(' ')) });
    expect(versiSkema(db)).toBe(MIGRASI.length);
    expect(log.some((l) => l.includes(`v0 → v${MIGRASI.length}`))).toBe(true);
    expect(log.some((l) => l.startsWith('riwayat dilengkapi'))).toBe(true);

    const permainan = db.prepare('SELECT kode_meja, jumlah_pemain, jumlah_deck, jumlah_manusia, mode_kaldu FROM permainan ORDER BY id').all();
    expect(permainan.map((p) => ({ ...p }))).toEqual([
      { kode_meja: 'AAAAA', jumlah_pemain: 3, jumlah_deck: 1, jumlah_manusia: 2, mode_kaldu: 0 },
      { kode_meja: 'SOLO1', jumlah_pemain: 2, jumlah_deck: 1, jumlah_manusia: 1, mode_kaldu: 0 },
      // Meja 4 orang lama: 1 atau 2 deck tidak tercatat.
      { kode_meja: 'EMPAT', jumlah_pemain: 4, jumlah_deck: null, jumlah_manusia: 2, mode_kaldu: 0 },
      { kode_meja: 'LIMAA', jumlah_pemain: 5, jumlah_deck: 2, jumlah_manusia: 2, mode_kaldu: 0 },
      { kode_meja: 'DUAAA', jumlah_pemain: 2, jumlah_deck: 1, jumlah_manusia: 2, mode_kaldu: 0 },
    ]);
    const kunci = db.prepare("SELECT DISTINCT kunci_nama FROM klasemen WHERE nama IN ('budi', 'Budi', 'siti', 'Siti') ORDER BY 1").all();
    expect(kunci.map((k) => k.kunci_nama)).toEqual(['budi', 'siti']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM klasemen WHERE keluar <> 0 OR kunci_nama IS NULL').get()).toMatchObject({ n: 0 });

    // Peringkat lama (array): main sendirian tidak ikut, "budi"/"Budi" satu orang dengan ejaan terakhir.
    const lama = r.peringkat();
    expect(lama.map((b) => b.nama)).toEqual(['Siti', 'Budi']);
    expect(Object.keys(lama[0]).sort()).toEqual(['juara', 'kepentung', 'main', 'mentung', 'nama', 'rataRata', 'skorTerbaik', 'totalSkor']);
    expect(lama.find((b) => b.nama === 'Budi')).toMatchObject({ main: 4, juara: 2, totalSkor: 140, skorTerbaik: 100 });
    expect(lama.find((b) => b.nama === 'Siti')).toMatchObject({ main: 4, juara: 2, totalSkor: 180 });

    // Daftar permainan: yang main sendirian ditandai tidak dihitung.
    const daftar = r.daftar(10);
    expect(daftar.find((g) => g.kodeMeja === 'SOLO1')).toMatchObject({ dihitung: false, jumlahPemain: 2, jumlahDeck: 1 });
    expect(daftar.find((g) => g.kodeMeja === 'EMPAT')).toMatchObject({ dihitung: true, jumlahPemain: 4, jumlahDeck: null });
    r.tutup();

    // Dibuka lagi: tidak ada ALTER ulang (yang akan galat), tidak ada yang perlu dilengkapi.
    const log2: string[] = [];
    const r2 = bukaRiwayat(db, { log: (...x) => log2.push(x.join(' ')) });
    expect(versiSkema(db)).toBe(MIGRASI.length);
    expect(log2).toEqual([]);
    expect(r2.peringkat()).toEqual(lama);
    r2.tutup();
    db.close();
  });

  it('database baru langsung v1; baris yang ditulis server lama (tanpa kolom baru) dilengkapi saat dibuka lagi', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    expect(versiSkema(db)).toBe(MIGRASI.length);
    // Server versi sebelumnya (deploy dibatalkan) menulis tanpa kolom baru.
    tulisV0(db, 'LAMAA', '2026-10-06T10:00:00.000Z', [['Élia', 10], ['Budi', 0]]);
    r.tutup();
    bukaRiwayat(db).tutup();
    expect({ ...db.prepare("SELECT jumlah_pemain, jumlah_manusia, jumlah_deck FROM permainan WHERE kode_meja = 'LAMAA'").get() }).toEqual({
      jumlah_pemain: 2,
      jumlah_manusia: 2,
      jumlah_deck: 1,
    });
    // lower() SQLite hanya ASCII; kunci dihitung di JS.
    expect(db.prepare("SELECT kunci_nama FROM klasemen WHERE nama = 'Élia'").get()).toMatchObject({ kunci_nama: 'élia' });
    db.close();
  });

  it('simpan menulis kolom baru: jumlah pemain/deck/manusia, mode kaldu, keluar, kunci nama', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    const r1 = ringkasanKeluar('KLRAA', Date.UTC(2026, 9, 10), [['Budi', 300, 'k'], ['SITI', 50], ['Kipas Dua', -20, 'b'], ['Joko', 0], ['Om Garpu', 10, 'b']]);
    r.simpan(r1);
    expect({ ...db.prepare('SELECT jumlah_pemain, jumlah_deck, jumlah_manusia, mode_kaldu FROM permainan').get() }).toEqual({
      jumlah_pemain: 5,
      jumlah_deck: 2,
      jumlah_manusia: 3,
      mode_kaldu: 0,
    });
    const k = db.prepare('SELECT nama, bot, keluar, kunci_nama FROM klasemen ORDER BY kursi').all().map((x) => ({ ...x }));
    expect(k).toEqual([
      { nama: 'Budi', bot: 0, keluar: 1, kunci_nama: 'budi' },
      { nama: 'SITI', bot: 0, keluar: 0, kunci_nama: 'siti' },
      { nama: 'Kipas Dua', bot: 1, keluar: 0, kunci_nama: 'kipas dua' },
      { nama: 'Joko', bot: 0, keluar: 0, kunci_nama: 'joko' },
      { nama: 'Om Garpu', bot: 1, keluar: 0, kunci_nama: 'om garpu' },
    ]);
    const g = r.daftar(1)[0];
    expect(g).toMatchObject({ jumlahPemain: 5, jumlahDeck: 2, dihitung: true });
    expect(g.klasemen.find((x) => x.nama === 'Budi')).toMatchObject({ bot: false, keluar: true });
    expect(g.klasemen.find((x) => x.nama === 'SITI')).not.toHaveProperty('keluar');
    r.tutup();
    db.close();
  });
});

describe('riwayat SQLite: mode kaldu (#42)', () => {
  it('simpan menulis mode_kaldu = 1 dan alasan kaldu, daftar membacanya kembali', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    r.simpan({ ...ringkasan('KALDU', Date.UTC(2026, 9, 16), [['Budi', 420], ['Siti', -380], ['Kipas Dua', 10, true]]), alasan: 'kaldu', modeKaldu: true });
    r.simpan(ringkasan('BIASA', Date.UTC(2026, 9, 16, 1), [['Budi', 20], ['Siti', -20]]));
    const baris = db.prepare('SELECT kode_meja, alasan, mode_kaldu FROM permainan ORDER BY id').all().map((x) => ({ ...x }));
    expect(baris).toEqual([
      { kode_meja: 'KALDU', alasan: 'kaldu', mode_kaldu: 1 },
      { kode_meja: 'BIASA', alasan: 'sepakat', mode_kaldu: 0 },
    ]);
    const daftar = r.daftar(10);
    expect(daftar.find((g) => g.kodeMeja === 'KALDU')).toMatchObject({ alasan: 'kaldu', dihitung: true });
    // Permainan kaldu ikut peringkat seperti permainan lain.
    expect(r.peringkat().find((p) => p.nama === 'Budi')).toMatchObject({ main: 2, juara: 2 });
    r.tutup();
    db.close();
  });
});

describe('riwayat SQLite: papan peringkat v2', () => {
  const OKT = Date.UTC(2026, 9, 16, 5);

  function isi(): PenyimpanRiwayat {
    const r = bukaRiwayat(':memory:', { sekarang: () => OKT });
    // September (WIB): 30 Sep 23.59 WIB.
    r.simpan(ringkasanKeluar('SEPT1', Date.UTC(2026, 8, 30, 16, 59), [['Budi', 200], ['Siti', 0]]));
    // Oktober (WIB) walau masih 30 Sep di UTC: 1 Okt 00.30 WIB.
    r.simpan(ringkasanKeluar('OKT01', Date.UTC(2026, 8, 30, 17, 30), [['budi', 100], ['Siti', 300], ['Kipas Dua', 0, 'b']]));
    r.simpan(ringkasanKeluar('OKT02', Date.UTC(2026, 9, 5), [['Budi', 0], ['Siti', 60], ['Joko', 30], ['Cak Kopag', 90, 'b']]));
    // Siti keluar di tengah permainan walau skornya paling tinggi.
    r.simpan(ringkasanKeluar('OKT03', Date.UTC(2026, 9, 6), [['Budi', 40], ['Siti', 500, 'k'], ['Joko', -80]]));
    // Main sendirian: tidak dihitung.
    r.simpan(ringkasanKeluar('SOLO1', Date.UTC(2026, 9, 7), [['Budi', 999], ['Mbak Teras', 0, 'b']]));
    // November (WIB): 1 Nov 00.00 WIB.
    r.simpan(ringkasanKeluar('NOV01', Date.UTC(2026, 9, 31, 17), [['Budi', 10], ['Siti', 20]]));
    return r;
  }

  it('bawaan: rata-rata per permainan, minimal 3 main, yang keluar juru kunci dengan skor terendah', () => {
    const r = isi();
    const p = r.papan();
    expect(p).toMatchObject({ v: 2, urut: 'rata', saringan: { jumlahPemain: null, jumlahDeck: null, periode: 'semua' }, periode: null, minMain: 3, jumlahPermainan: 5 });
    // Budi: 200 + 100 + 0 + 40 + 10 = 350 / 5 = 70. Siti: 0 + 300 + 60 + (−80, keluar) + 20 = 300 / 5 = 60.
    expect(p.peringkat.map((b) => [b.nama, b.main, b.totalSkor, b.juara, b.keluar])).toEqual([
      ['Budi', 5, 350, 2, 0],
      ['Siti', 5, 300, 2, 1],
    ]);
    // Joko baru main 2 kali.
    expect(p.belumCukup.map((b) => [b.nama, b.main])).toEqual([['Joko', 2]]);
    // OKT03: Siti keluar → juru kunci (poin 0); Budi juara, Joko kedua.
    expect(p.peringkat.find((b) => b.nama === 'Siti')!.skorTerburuk).toBe(-80);
    r.tutup();
  });

  it('saringan jumlah pemain, deck, dan bulan ini (batas WIB)', () => {
    const r = isi();
    expect(r.papan({ saringan: { jumlahPemain: 3 } }).jumlahPermainan).toBe(2);
    expect(r.papan({ saringan: { jumlahPemain: '2' } }).jumlahPermainan).toBe(2);
    expect(r.papan({ saringan: { jumlahDeck: 2 } }).jumlahPermainan).toBe(0);
    expect(r.papan({ saringan: { jumlahDeck: 1 } }).jumlahPermainan).toBe(5);
    const bulan = r.papan({ urut: 'juara', saringan: { periode: 'bulan' } });
    expect(bulan.periode).toEqual({ dari: '2026-09-30T17:00:00.000Z', sampai: '2026-10-31T17:00:00.000Z', bulan: '2026-10' });
    expect(bulan.jumlahPermainan).toBe(3);
    // Juara sama (1): total skor Siti 280 (300 + 60 − 80) di atas Budi 140.
    expect(bulan.peringkat.map((b) => [b.nama, b.main, b.juara])).toEqual([
      ['Siti', 3, 1],
      ['Budi', 3, 1],
      ['Joko', 2, 0],
    ]);
    // Jam bisa diganti per permintaan: November hanya NOV01.
    expect(r.papan({ saringan: { periode: 'bulan' }, sekarang: Date.UTC(2026, 10, 2) }).jumlahPermainan).toBe(1);
    r.tutup();
  });

  it('nama tanpa beda huruf besar/kecil, ejaan terbaru dari semua permainan (juga di luar periode)', () => {
    const r = isi();
    r.simpan(ringkasanKeluar('DES01', Date.UTC(2026, 11, 5), [['BUDI', 0], ['Siti', 0]]));
    const p = r.papan({ urut: 'main', saringan: { periode: 'bulan' } });
    // Main sama (3): rata-rata Siti lebih tinggi. Budi tampil dengan ejaan Desember.
    expect(p.peringkat.map((b) => b.nama)).toEqual(['Siti', 'BUDI', 'Joko']);
    r.tutup();
  });

  it('cache per saringan dikosongkan setiap simpan()', () => {
    const r = isi();
    const a = r.papan({ urut: 'main' });
    expect(r.papan({ urut: 'main' })).toEqual(a);
    r.simpan(ringkasanKeluar('BARU1', Date.UTC(2026, 9, 8), [['Joko', 10], ['Siti', 0]]));
    const b = r.papan({ urut: 'main' });
    expect(b.jumlahPermainan).toBe(a.jumlahPermainan + 1);
    expect(b.peringkat.find((x) => x.nama === 'Joko')!.main).toBe(3);
    r.tutup();
  });

  it('parameter tidak sah jatuh ke bawaan', () => {
    const r = isi();
    const p = r.papan({ urut: 'skor; DROP TABLE', saringan: { jumlahPemain: 'x', jumlahDeck: 9, periode: 'tahun' } });
    expect(p).toMatchObject({ urut: 'rata', saringan: { jumlahPemain: null, jumlahDeck: null, periode: 'semua' }, jumlahPermainan: 5 });
    r.tutup();
  });
});

describe('endpoint peringkat v2', () => {
  let server: ServerRemi;
  let riwayat: PenyimpanRiwayat;
  const url = (q: string) => `http://127.0.0.1:${server.port}/api/peringkat${q}`;
  beforeAll(async () => {
    riwayat = bukaRiwayat(':memory:');
    for (let i = 0; i < 3; i++) riwayat.simpan(ringkasanKeluar(`G${i}AAA`, Date.UTC(2026, 9, 1 + i), [['Budi', 100 * i], ['Siti', 50], ['Kipas Dua', 0, 'b']]));
    server = await jalankanServer({ port: 0, host: '127.0.0.1', riwayat, log: () => undefined });
  });
  afterAll(async () => {
    await server.tutup();
    riwayat.tutup();
  });

  it('tanpa v=2 tetap array bentuk lama (aplikasi lama memanggil .map langsung)', async () => {
    const r = await fetch(url(''));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const isi = (await r.json()) as unknown[];
    expect(Array.isArray(isi)).toBe(true);
    expect(Object.keys(isi[0] as object).sort()).toEqual(['juara', 'kepentung', 'main', 'mentung', 'nama', 'rataRata', 'skorTerbaik', 'totalSkor']);
    expect(Array.isArray(await (await fetch(url('?v=1&urut=rata'))).json())).toBe(true);
  });

  it('v=2 mengembalikan objek; parameter dibaca longgar', async () => {
    const r = await fetch(url('?v=2&urut=posisi&pemain=3&deck=1&periode=semua'));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const isi = (await r.json()) as { v: number; urut: string; saringan: unknown; peringkat: { nama: string }[]; belumCukup: unknown[]; jumlahPermainan: number };
    expect(isi).toMatchObject({ v: 2, urut: 'posisi', saringan: { jumlahPemain: 3, jumlahDeck: 1, periode: 'semua' }, jumlahPermainan: 3, belumCukup: [] });
    // Poin posisi: Budi 50 + 100 + 100, Siti 100 + 50 + 50.
    expect(isi.peringkat.map((b) => b.nama)).toEqual(['Budi', 'Siti']);
    const salah = (await (await fetch(url('?v=2&urut=xx&pemain=99&deck=semua&periode=%00'))).json()) as { urut: string; saringan: unknown };
    expect(salah).toMatchObject({ urut: 'rata', saringan: { jumlahPemain: null, jumlahDeck: null, periode: 'semua' } });
  });

  it('selain GET ditolak 405', async () => {
    const r = await fetch(url('?v=2'), { method: 'POST' });
    expect(r.status).toBe(405);
  });
});
