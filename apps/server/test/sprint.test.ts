// Sprint di server (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026): pesan `sprint` membuat meja satu
// pemain lawan lima warga kedai Suhu tanpa batas putaran yang langsung main; setiap putaran yang selesai
// langsung dicatat di tabel sprint_putaran (migrasi v8), sekali saja (sambung ulang, restart, Keluar),
// papan GET /api/sprint (baris 0.8.0 di tabel sprint ikut dijumlah), dan pesan `sprintHasil` per putaran.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import { awalMingguWib, hasilPutaranSprint, TEKS_SPRINT_TERKUNCI, type InfoMeja, type Penjadwal } from '@remi/meja';
import { bukaRiwayat, MIGRASI, type PenyimpanRiwayat } from '../src/riwayat.js';
import { MAKS_BARIS_SPRINT, SKEMA_SPRINT, SKEMA_SPRINT_PUTARAN, type PapanSprint } from '../src/sprint.js';
import { jalankanServer, UMUR_MAKS_SIMPANAN_MEJA_MS, type OpsiServer, type ServerRemi } from '../src/server.js';

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Penjadwal palsu yang ikut jam sungguhan, tapi bisa dimajukan (umur simpanan meja). */
class JamGeser implements Penjadwal {
  geser = 0;
  setel(ms: number, fn: () => void): unknown {
    return setTimeout(fn, ms);
  }
  batal(h: unknown): void {
    clearTimeout(h as ReturnType<typeof setTimeout>);
  }
  sekarang(): number {
    return Date.now() + this.geser;
  }
}

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

type Pesan = { t: string; [k: string]: unknown };
interface Klien {
  ws: WebSocket;
  pesan: Pesan[];
  kirim(x: unknown): void;
}
async function klien(port: number, saatPesan?: (p: Pesan, k: Klien) => void): Promise<Klien> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const k: Klien = { ws, pesan: [], kirim: (x) => ws.send(JSON.stringify(x)) };
  ws.on('message', (d) => {
    const p = JSON.parse(d.toString()) as Pesan;
    k.pesan.push(p);
    saatPesan?.(p, k);
  });
  ws.on('error', () => undefined);
  await new Promise((ok) => ws.on('open', ok));
  return k;
}
async function tungguPesan(k: Klien, syarat: (p: Pesan) => boolean, ms = 5000): Promise<Pesan> {
  const mulai = Date.now();
  for (;;) {
    const p = [...k.pesan].reverse().find(syarat);
    if (p) return p;
    if (Date.now() - mulai > ms) throw new Error(`pesan tidak datang; terakhir: ${JSON.stringify(k.pesan.slice(-3)).slice(0, 400)}`);
    await tunggu(5);
  }
}
async function sampai(syarat: () => boolean, ms = 5000): Promise<void> {
  const mulai = Date.now();
  while (!syarat()) {
    if (Date.now() - mulai > ms) throw new Error('syarat tidak terpenuhi');
    await tunggu(5);
  }
}
const infoTerakhir = (k: Klien) => ([...k.pesan].reverse().find((p) => p.t === 'meja') as { info: InfoMeja } | undefined)?.info;
const errors = (k: Klien) => k.pesan.filter((p) => p.t === 'error').map((p) => p.pesan);

/**
 * Pemain "pura-pura" yang memainkan sprint: tekan OK joker, jalan di gilirannya (strategi normal), dan
 * mulai putaran berikutnya sampai putaran ke-n selesai (`sampai` boleh dinaikkan di tengah jalan).
 */
function pemainOtomatis(berhenti: number | { sampai: number }) {
  const batas = typeof berhenti === 'number' ? { sampai: berhenti } : berhenti;
  const rng = new Rng(11);
  const sudah = new Set<string>();
  let info: InfoMeja | null = null;
  return (p: Pesan, k: Klien) => {
    if (p.t === 'meja') info = p.info as InfoMeja;
    if (p.t !== 'view' || !info) return;
    const v = p.view as ViewPemain;
    const saya = v.saya!;
    const sekali = (kunci: string, pesan: unknown) => {
      if (sudah.has(kunci)) return;
      sudah.add(kunci);
      k.kirim(pesan);
    };
    if (info.menungguJoker.includes(saya)) return sekali(`joker:${v.putaran?.nomor}`, { t: 'siapJoker' });
    if (v.status === 'putaranSelesai') {
      if (v.riwayat.length >= batas.sampai) return;
      return sekali(`lanjut:${v.riwayat.length}`, { t: 'putaranBerikut' });
    }
    const giliran = v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[saya] : v.status === 'putaranBerjalan' && v.putaran!.giliran === saya;
    if (!giliran) return;
    const kunci = JSON.stringify([v.status, v.putaran!.nomor, v.putaran!.tahap, v.peristiwa.at(-1)?.id ?? 0]);
    const aksi = pilihAksiBot(v, 'normal', rng);
    const { pemain: _, ...tanpaPemain } = aksi as typeof aksi & { pemain: number };
    sekali(kunci, { t: 'aksi', aksi: tanpaPemain });
  };
}

const barisSprint = (db: DatabaseSync) =>
  db.prepare('SELECT kode_meja, putaran, nama, kunci_nama, waktu, skor, menang, mentung, kepentung FROM sprint_putaran ORDER BY id').all() as Record<
    string,
    number | string
  >[];
const jumlahBarisLama = (db: DatabaseSync) => (db.prepare('SELECT COUNT(*) AS n FROM sprint').get() as { n: number }).n;

/** Hasil putaran pemain (kursi k) dari riwayat view, persis aturan hasilPutaranSprint. */
function hasilDariView(v: ViewPemain, i: number, k: number) {
  const h = hasilPutaranSprint(v.riwayat, i, k);
  return { putaran: h.putaran, skor: h.skor, menang: h.menang ? 1 : 0, mentung: h.mentung, kepentung: h.kepentung };
}
const viewTerakhir = (k: Klien) => ([...k.pesan].reverse().find((p) => p.t === 'view') as unknown as { view: ViewPemain }).view;
const putaranSelesai = (n: number) => (p: Pesan) =>
  p.t === 'view' && (p.view as ViewPemain).status === 'putaranSelesai' && (p.view as ViewPemain).riwayat.length === n;

const HARI = 86_400_000;

describe('penyimpan sprint (migrasi v7 dan v8)', () => {
  it('v8 = tabel sprint_putaran; putaran yang sama tercatat sekali; baris v7 (0.8.0) ikut dijumlah; minggu per waktu putaran', () => {
    expect(MIGRASI.length).toBe(8);
    expect(MIGRASI[6]).toBe(SKEMA_SPRINT);
    expect(MIGRASI[7]).toBe(SKEMA_SPRINT_PUTARAN);
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
      { nama: 'ani', menang: 1, mentung: 0, kepentung: 0, skor: 25, piala: 0 },
      { nama: 'Budi', menang: 1, mentung: 0, kepentung: 1, skor: -90, piala: 1 },
    ]);
    expect(r.sprint.papan('semua', sekarang)).toEqual({
      periode: 'semua',
      mulai: null,
      baris: [
        { nama: 'Budi', menang: 2, mentung: 2, kepentung: 2, skor: 210, piala: 1 },
        { nama: 'ani', menang: 2, mentung: 1, kepentung: 1, skor: 65, piala: 0 },
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
    // Bentuk jawaban API tetap (aplikasi lama).
    expect(papan.baris).toEqual([
      { nama: 'Budi', menang: jumlah('menang'), mentung: jumlah('mentung'), kepentung: jumlah('kepentung'), skor: jumlah('skor'), piala: 0 },
    ]);
    const semua = (await (await fetch(`${alamat}/api/sprint?periode=semua`)).json()) as PapanSprint;
    expect(semua).toEqual({ periode: 'semua', mulai: null, baris: papan.baris });
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
      { nama: 'Eli', menang: Number(b2.menang), mentung: Number(b2.mentung), kepentung: Number(b2.kepentung), skor: Number(b2.skor), piala: 1 },
    ]);
    a.ws.close();
  }, 90_000);

  it('restart dan sambung ulang: putaran tidak tercatat dua kali, meja yang dipulihkan tetap mencatat', async () => {
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
    const baris = dbLuar.prepare('SELECT data FROM meja_aktif WHERE kode = ?').get(String(masuk.kode)) as { data: string };
    const data = JSON.parse(baris.data) as { sprint: { putaranTercatat?: number } };
    expect(data.sprint.putaranTercatat).toBe(1);
    delete data.sprint.putaranTercatat;
    dbLuar.prepare('UPDATE meja_aktif SET data = ? WHERE kode = ?').run(JSON.stringify(data), String(masuk.kode));
    dbLuar.close();

    // Server mulai lagi: mejanya dipulihkan, putaran 1 dicoba dicatat lagi tapi ditolak database.
    const lanjut = { sampai: 1 };
    const s2 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    expect(s2.server.jumlahMeja()).toBe(1);
    expect(s2.log.some((l) => l.includes(`sprint meja ${masuk.kode} putaran 1 dicatat (1 sudah tercatat sebelumnya)`))).toBe(true);
    expect(barisSprint(s2.db)).toHaveLength(1);
    const b = await klien(s2.server.port, pemainOtomatis(lanjut));
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Cici', token: masuk.token });
    const lagi = await tungguPesan(b, (p) => p.t === 'masuk');
    expect(lagi.kursi).toBe(masuk.kursi);
    await tungguPesan(b, putaranSelesai(1));
    // Main lagi di meja yang dipulihkan: putaran 2 tercatat seperti biasa.
    lanjut.sampai = 2;
    b.kirim({ t: 'putaranBerikut' });
    await tungguPesan(b, (p) => p.t === 'sprintHasil' && p.putaran === 2, 40_000);
    expect(barisSprint(s2.db).map((x) => x.putaran)).toEqual([1, 2]);
    b.ws.close();
    await s2.matikan();

    // Server mati lebih lama dari umur simpanan: simpanannya dibuang, tidak ada catatan baru.
    jam.geser += UMUR_MAKS_SIMPANAN_MEJA_MS + 60_000;
    const s3 = await nyalakan({ penjadwal: jam }, path);
    expect(s3.server.jumlahMeja()).toBe(0);
    expect(barisSprint(s3.db).map((x) => [x.kode_meja, x.putaran, x.nama])).toEqual([
      [masuk.kode, 1, 'Cici'],
      [masuk.kode, 2, 'Cici'],
    ]);
  }, 120_000);

  it('simpanan yang tidak dipulihkan: putaran yang belum tercatat dicatat dengan waktu selesainya', async () => {
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
    const baris = dbLuar.prepare('SELECT data FROM meja_aktif WHERE kode = ?').get(String(masuk.kode)) as { data: string };
    const data = JSON.parse(baris.data) as { sprint: { putaranTercatat?: number } };
    delete data.sprint.putaranTercatat;
    dbLuar.prepare('UPDATE meja_aktif SET data = ? WHERE kode = ?').run(JSON.stringify(data), String(masuk.kode));
    dbLuar.close();
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
