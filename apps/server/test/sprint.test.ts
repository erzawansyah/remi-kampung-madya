// Sprint di server (keputusan pemilik 25 Nov 2026): pesan `sprint` membuat meja satu pemain lawan tiga
// warga kedai Suhu yang langsung main, percobaannya dicatat di tabel sprint (migrasi v7) saat selesai
// atau ditinggal (Keluar, simpanan yang tidak dipulihkan, server dimatikan tanpa simpanan meja), papan
// GET /api/sprint, dan pesan `sprintHasil`.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import { awalMingguWib, TEKS_SPRINT_TERKUNCI, type InfoMeja, type Penjadwal } from '@remi/meja';
import { bukaRiwayat, MIGRASI, type PenyimpanRiwayat } from '../src/riwayat.js';
import { MAKS_BARIS_SPRINT, SKEMA_SPRINT, type PapanSprint } from '../src/sprint.js';
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
 * Pemain "pura-pura" yang memainkan sprint sampai selesai: tekan OK joker, jalan di gilirannya (strategi
 * normal), dan mulai putaran berikutnya. `berhentiSesudah`: berhenti bereaksi sesudah putaran ke-n selesai.
 */
function pemainOtomatis(berhentiSesudah = Infinity) {
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
      if (v.riwayat.length >= berhentiSesudah) return;
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
  db.prepare('SELECT kode_meja, nama, kunci_nama, putaran, skor, menang, mentung, kepentung, selesai FROM sprint ORDER BY id').all() as Record<
    string,
    number | string
  >[];

describe('penyimpan sprint (migrasi v7)', () => {
  it('v7 = tabel sprint; percobaan yang sama tercatat sekali; papan minggu ini dan sepanjang masa', () => {
    expect(MIGRASI.length).toBe(7);
    expect(MIGRASI[6]).toBe(SKEMA_SPRINT);
    const r = bukaRiwayat(':memory:');
    const senin = awalMingguWib(Date.UTC(2026, 10, 25, 5));
    const c = (kode: string, nama: string, waktu: number, menang: boolean, skor: number, mentung = 0, kepentung = 0) => ({
      kode,
      mulaiPada: waktu - 1000,
      nama,
      waktu,
      menang,
      skor,
      mentung,
      kepentung,
      putaran: 5,
      selesai: true,
    });
    expect(r.sprint.catat(c('AAAAA', 'Budi', senin - 3 * 86_400_000, true, 100, 1, 0))).toBe(true);
    // Percobaan yang sama (kode + waktu mulai) tidak tercatat dua kali.
    expect(r.sprint.catat(c('AAAAA', 'Budi', senin - 3 * 86_400_000, true, 100, 1, 0))).toBe(false);
    r.sprint.catat(c('BBBBB', 'Ani', senin - 2 * 86_400_000, false, 400, 2, 1));
    r.sprint.catat(c('CCCCC', 'budi', senin + 3_600_000, false, -50, 0, 2));
    r.sprint.catat(c('DDDDD', 'Ani', senin + 7_200_000, true, 10, 1, 1));
    const sekarang = senin + 86_400_000;
    const minggu = r.sprint.papan('minggu', sekarang);
    expect(minggu.periode).toBe('minggu');
    expect(minggu.mulai).toBe(senin);
    // Budi juara minggu lalu (menang 1 lawan 0): pialanya ikut di semua periode.
    expect(minggu.baris).toEqual([
      { nama: 'Ani', menang: 1, mentung: 1, kepentung: 1, skor: 10, piala: 0 },
      { nama: 'budi', menang: 0, mentung: 0, kepentung: 2, skor: -50, piala: 1 },
    ]);
    const semua = r.sprint.papan('semua', sekarang);
    expect(semua.mulai).toBeNull();
    expect(semua.baris).toEqual([
      { nama: 'Ani', menang: 1, mentung: 3, kepentung: 2, skor: 410, piala: 0 },
      { nama: 'budi', menang: 1, mentung: 1, kepentung: 2, skor: 50, piala: 1 },
    ]);
    expect(r.sprint.peringkatMinggu('BUDI', sekarang)).toBe(2);
    expect(r.sprint.peringkatMinggu('Cici', sekarang)).toBeNull();
    for (let i = 0; i < MAKS_BARIS_SPRINT + 5; i++) r.sprint.catat(c(`X${String(i).padStart(4, '0')}`, `Orang ${i}`, sekarang, false, i));
    expect(r.sprint.papan('semua', sekarang).baris).toHaveLength(MAKS_BARIS_SPRINT);
    r.tutup();
  });
});

describe('sprint di server', () => {
  it('pesan sprint: meja langsung main lawan tiga warga kedai Suhu, pengaturan dikunci kecuali tempo', async () => {
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
    ]);
    expect(info.pengaturan).toMatchObject({ jumlahPemain: 4, duaDeckUntukEmpat: false, batasPutaran: 5, detikGiliran: 0, tempoBot: 'cepat', publik: false });
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
    expect(masuk.kursi).toBe(3);
    await tungguPesan(a, (p) => p.t === 'view');
    expect(infoTerakhir(a)!.kursiSaya).toBe(3);
    expect(infoTerakhir(a)!.kursi[3].nama).toBe('Budi');
    a.ws.close();
  });

  it('main sampai selesai: tercatat sekali, sprintHasil dikirim, papan menampilkannya', async () => {
    const { server, db, alamat } = await nyalakan();
    const a = await klien(server.port, pemainOtomatis());
    a.kirim({ t: 'sprint', nama: 'Budi' });
    const hasil = await tungguPesan(a, (p) => p.t === 'sprintHasil', 60_000);
    expect(infoTerakhir(a)!.status).toBe('selesai');
    const v = ([...a.pesan].reverse().find((p) => p.t === 'view') as unknown as { view: ViewPemain }).view;
    expect(v.riwayat).toHaveLength(5);
    const skorAkhir = v.riwayat.at(-1)!.skorAkumulasi;
    const menang = skorAkhir.every((s) => skorAkhir[0] >= s);
    expect(hasil).toEqual({
      t: 'sprintHasil',
      menang,
      skor: skorAkhir[0],
      mentung: v.riwayat.filter((h) => h.pementung === 0).length,
      kepentung: v.riwayat.filter((h) => h.kepentung.includes(0)).length,
      peringkatMinggu: 1,
    });
    // Pemain otomatis kadang bereaksi pada view yang sudah basi (aksi ganda di jaringan): penolakan aturan
    // biasa boleh, penolakan khusus sprint tidak.
    expect(errors(a).filter((e) => String(e).includes('print'))).toEqual([]);
    expect(barisSprint(db)).toEqual([
      {
        kode_meja: infoTerakhir(a)!.kode,
        nama: 'Budi',
        kunci_nama: 'budi',
        putaran: 5,
        skor: skorAkhir[0],
        menang: menang ? 1 : 0,
        mentung: hasil.mentung as number,
        kepentung: hasil.kepentung as number,
        selesai: 1,
      },
    ]);
    // Tidak masuk klasemen umum/Riwayat.
    expect((db.prepare('SELECT COUNT(*) AS n FROM permainan').get() as { n: number }).n).toBe(0);
    const papan = (await (await fetch(`${alamat}/api/sprint`)).json()) as PapanSprint;
    expect(papan.periode).toBe('minggu');
    expect(papan.mulai).toBe(awalMingguWib(Date.now()));
    expect(papan.baris).toEqual([{ nama: 'Budi', menang: menang ? 1 : 0, mentung: hasil.mentung, kepentung: hasil.kepentung, skor: skorAkhir[0], piala: 0 }]);
    const semua = (await (await fetch(`${alamat}/api/sprint?periode=semua`)).json()) as PapanSprint;
    expect(semua).toMatchObject({ periode: 'semua', mulai: null });
    // Periode yang tidak dikenal = minggu ini.
    expect(((await (await fetch(`${alamat}/api/sprint?periode=ngawur`)).json()) as PapanSprint).periode).toBe('minggu');
    expect((await fetch(`${alamat}/api/sprint`, { method: 'POST' })).status).toBe(405);
    // Keluar sesudah selesai: tidak tercatat lagi, mejanya dibuang.
    a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    expect(barisSprint(db)).toHaveLength(1);
    a.ws.close();
  }, 70_000);

  it('Keluar di tengah jalan: tercatat ditinggal (tidak menang), mejanya langsung dihapus', async () => {
    const { server, db, log } = await nyalakan();
    const a = await klien(server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Ani' });
    await tungguPesan(a, (p) => p.t === 'view' && (p.view as ViewPemain).status === 'putaranSelesai', 30_000);
    expect(barisSprint(db)).toEqual([]);
    a.kirim({ t: 'keluar' });
    await tungguPesan(a, (p) => p.t === 'keluar');
    await sampai(() => server.jumlahMeja() === 0);
    const [b] = barisSprint(db);
    expect(b).toMatchObject({ nama: 'Ani', putaran: 1, menang: 0, selesai: 0 });
    expect(log.some((l) => l.includes('ditinggal sesudah 1 putaran'))).toBe(true);
    a.ws.close();
  }, 40_000);

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

  it('simpanan sprint yang tidak dipulihkan (terlalu lama) tercatat ditinggal; yang dipulihkan bisa dilanjutkan', async () => {
    const path = dbBaru();
    const jam = new JamGeser();
    const s1 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    const a = await klien(s1.server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Cici' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    // Satu putaran selesai dulu: percobaan tanpa putaran yang selesai tidak pernah dicatat.
    const v1 = await tungguPesan(a, (p) => p.t === 'view' && (p.view as ViewPemain).status === 'putaranSelesai', 30_000);
    const r1 = (v1.view as ViewPemain).riwayat[0];
    a.ws.close();
    await s1.matikan();

    // Server mulai lagi segera: mejanya dipulihkan, pemainnya kembali dengan tokennya.
    const s2 = await nyalakan({ penjadwal: jam }, path);
    expect(s2.server.jumlahMeja()).toBe(1);
    const b = await klien(s2.server.port);
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Cici', token: masuk.token });
    const lagi = await tungguPesan(b, (p) => p.t === 'masuk');
    expect(lagi.kursi).toBe(masuk.kursi);
    await sampai(() => infoTerakhir(b)?.sprint === true);
    b.ws.close();
    await s2.matikan();

    // Server mati lebih lama dari umur simpanan: simpanannya dibuang dan percobaannya tercatat ditinggal.
    jam.geser += UMUR_MAKS_SIMPANAN_MEJA_MS + 60_000;
    const s3 = await nyalakan({ penjadwal: jam }, path);
    expect(s3.server.jumlahMeja()).toBe(0);
    const k = masuk.kursi as number;
    expect(barisSprint(s3.db)).toEqual([
      {
        kode_meja: masuk.kode,
        nama: 'Cici',
        kunci_nama: 'cici',
        putaran: 1,
        skor: r1.skorAkumulasi[k],
        menang: 0,
        mentung: r1.pementung === k ? 1 : 0,
        kepentung: r1.kepentung.includes(k) ? 1 : 0,
        selesai: 0,
      },
    ]);
  }, 60_000);

  it('tanpa simpanan meja: sprint yang belum selesai tercatat ditinggal saat server dimatikan', async () => {
    const { server, db, matikan } = await nyalakan({ simpanMeja: false });
    const a = await klien(server.port, pemainOtomatis(1));
    a.kirim({ t: 'sprint', nama: 'Dodi' });
    await tungguPesan(a, (p) => p.t === 'view' && (p.view as ViewPemain).status === 'putaranSelesai', 30_000);
    // Percobaan kedua yang belum menyelesaikan satu putaran pun: tidak ikut tercatat.
    const b = await klien(server.port);
    b.kirim({ t: 'sprint', nama: 'Eli' });
    await tungguPesan(b, (p) => p.t === 'view');
    a.ws.close();
    b.ws.close();
    await server.tutup();
    expect(barisSprint(db)).toMatchObject([{ nama: 'Dodi', putaran: 1, selesai: 0, menang: 0 }]);
    await matikan();
  }, 40_000);

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
