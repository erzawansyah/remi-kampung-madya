// Sprint bisa dilanjut (keputusan pemilik 27 Nov 2026: "maunya sprint ini terus2an bisa dilanjut", "kalau
// minggu berganti ya reset"): satu sprint = satu permainan sepanjang minggu WIB. Keluar, putus, dan restart
// hanya menjedanya; "Lanjut sprint" (token rahasia HP, di database hanya hash-nya) melanjutkan permainan yang
// sama; Senin 00.00 WIB sprint yang dijeda tidak bisa dilanjut lagi. Sejak 0.10.3 tidak ada "Mulai dari 0":
// `ganti` dari aplikasi lama ditolak dan sprint-nya tetap utuh.

import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { ViewPemain } from '@remi/engine';
import { awalMingguWib, TEKS_SPRINT_DIJEDA, TEKS_SPRINT_TANPA_MULAI_NOL, TEKS_SPRINT_COBA_LAGI, TEKS_SPRINT_TAK_BISA_LANJUT, TEKS_SPRINT_TIDAK_ADA, type DataMeja } from '@remi/meja';
import { bukaRiwayat, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type OpsiServer, type ServerRemi } from '../src/server.js';
import {
  barisSprint,
  dataSprintTersimpan,
  infoTerakhir,
  JamGeser,
  klien,
  pemainOtomatis,
  putaranSelesai,
  sampai,
  tunggu,
  tungguPesan,
  viewTerakhir,
  type Klien,
} from './bantuSprint.js';

const folder = mkdtempSync(join(tmpdir(), 'remi-sprint-lanjut-'));
let nomorDb = 0;
const dbBaru = () => join(folder, `remi-${++nomorDb}.db`);
const HARI = 86_400_000;

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
  const alamat = `http://127.0.0.1:${server.port}`;
  const saya = async (token: unknown) =>
    (await (
      await fetch(`${alamat}/api/sprint/saya`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
    ).json()) as { ada: boolean; minggu?: number; putaran?: number; skor?: number };
  return { server, riwayat, db, log, matikan, alamat, saya };
}
afterEach(async () => {
  vi.useRealTimers();
  for (const c of dibuka.splice(0)) {
    await c.server?.tutup();
    c.riwayat?.tutup();
    c.db?.close();
  }
});
afterAll(() => rmSync(folder, { recursive: true, force: true }));

const jumlahSimpanan = (db: DatabaseSync) => (db.prepare('SELECT COUNT(*) AS n FROM sprint_simpanan').get() as { n: number }).n;
const tokenDari = async (k: Klien) => {
  const p = await tungguPesan(k, (x) => x.t === 'sprintSaya' && typeof x.token === 'string');
  return { token: String(p.token), minggu: Number(p.minggu) };
};
const skorSaya = (v: ViewPemain) => v.skor[v.saya!];
/** Semua isi tabel database (untuk memastikan token tidak pernah tersimpan apa adanya). */
const isiDatabase = (db: DatabaseSync) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
    .map((t) => JSON.stringify(db.prepare(`SELECT * FROM "${t.name}"`).all()))
    .join('\n');

/** Main sprint baru sampai putaran `n` selesai; kembalikan klien, masuk, dan tokennya. */
async function sprintSampai(port: number, nama: string, n: number) {
  const lanjut = { sampai: n };
  const a = await klien(port, pemainOtomatis(lanjut));
  a.kirim({ t: 'sprint', nama });
  const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
  const { token, minggu } = await tokenDari(a);
  if (n > 0) {
    await tungguPesan(a, (p) => p.t === 'sprintHasil' && p.putaran === n, 60_000);
    await tungguPesan(a, putaranSelesai(n));
  }
  return { a, masuk, token, minggu, lanjut };
}

describe('sprint bisa dilanjut', () => {
  it('token hanya untuk HP pembuatnya (database: hash saja); Keluar menjeda; Lanjut sprint meneruskan permainan yang sama', async () => {
    const { server, db, saya, log } = await nyalakan();
    const { a, masuk, token, minggu } = await sprintSampai(server.port, 'Budi', 1);
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(minggu).toBe(awalMingguWib(Date.now()));
    const kode = infoTerakhir(a)!.kode;

    // Penonton meja sprint ini tidak pernah menerima tokennya.
    const c = await klien(server.port);
    c.kirim({ t: 'daftar', tonton: true });
    const entri = ((await tungguPesan(c, (p) => p.t === 'daftar')).meja as { kode: string; namaHost: string; tonton?: true }[]).find(
      (m) => m.tonton && m.namaHost === 'Budi',
    )!;
    c.kirim({ t: 'tonton', kode: entri.kode, nama: 'Tono', token: 'hp-tono' });
    await tungguPesan(c, (p) => p.t === 'tontonan');

    // Di database hanya hash-nya; token tidak ada di tabel mana pun, dan hanya dikirim sekali lewat sprintSaya.
    const baris = db.prepare('SELECT token_hash, kode, minggu FROM sprint_simpanan').all() as Record<string, unknown>[];
    expect(baris).toEqual([{ token_hash: createHash('sha256').update(token).digest('hex'), kode, minggu }]);
    expect(isiDatabase(db)).not.toContain(token);
    expect(a.pesan.filter((p) => JSON.stringify(p).includes(token)).map((p) => p.t)).toEqual(['sprintSaya']);
    expect(JSON.stringify(c.pesan)).not.toContain(token);

    const v1 = viewTerakhir(a);
    expect(await saya(token)).toEqual({ ada: true, minggu, putaran: 1, skor: skorSaya(v1) });

    // Keluar: kursinya tidak diteruskan warga kedai, permainannya disimpan dan mejanya dilepas dari memori.
    a.kirim({ t: 'keluar' });
    expect((await tungguPesan(a, (p) => p.t === 'keluar')).alasan).toBe(TEKS_SPRINT_DIJEDA);
    await sampai(() => server.jumlahMeja() === 0);
    expect(log).toContain(`meja ${kode} dilepas (sprint dijeda)`);
    // Token kursi (untuk sambung ulang) juga hanya sebagai hash: database tidak memuat kunci apa pun.
    expect(isiDatabase(db)).not.toContain(String(masuk.token));
    expect(db.prepare('SELECT kursi_hash, putaran FROM sprint_simpanan').get()).toEqual({
      kursi_hash: createHash('sha256').update(String(masuk.token)).digest('hex'),
      putaran: 1,
    });
    const data = dataSprintTersimpan<DataMeja>(db, kode)!;
    expect(data.kursi[data.sprint!.kursi]).toMatchObject({ jenis: 'manusia', nama: 'Budi', terhubung: false });
    expect(data.kursi.some((k) => k.keluar)).toBe(false);
    expect(data.game!.riwayat).toHaveLength(1);
    expect(await saya(token)).toEqual({ ada: true, minggu, putaran: 1, skor: skorSaya(v1) });
    a.ws.close();

    // Lanjut dari sambungan baru (nama baru ikut): permainan yang sama, putaran dan skor berlanjut.
    const lanjut = { sampai: 2 };
    const b = await klien(server.port, pemainOtomatis(lanjut));
    b.kirim({ t: 'sprint', nama: 'Budi Baru', lanjut: token });
    const lagi = await tungguPesan(b, (p) => p.t === 'masuk');
    expect(lagi).toMatchObject({ kode, kursi: masuk.kursi });
    expect(await tokenDari(b)).toEqual({ token, minggu });
    const v = await tungguPesan(b, (p) => p.t === 'view');
    expect((v.view as ViewPemain).riwayat).toHaveLength(1);
    expect(skorSaya(v.view as ViewPemain)).toBe(skorSaya(v1));
    expect(infoTerakhir(b)!.kursi[masuk.kursi as number].nama).toBe('Budi Baru');
    // Kabar putaran terakhir yang tercatat ikut dikirim lagi.
    expect(await tungguPesan(b, (p) => p.t === 'sprintHasil')).toMatchObject({ putaran: 1 });
    await tungguPesan(b, (p) => p.t === 'sprintHasil' && p.putaran === 2, 60_000);
    // Nomor putaran berlanjut di meja yang sama, tanpa ganda; putaran 2 atas nama barunya.
    expect(barisSprint(db).map((x) => [x.kode_meja, x.putaran, x.nama])).toEqual([
      [kode, 1, 'Budi'],
      [kode, 2, 'Budi Baru'],
    ]);
    expect(jumlahSimpanan(db)).toBe(1);
    b.ws.close();
    c.ws.close();
  }, 120_000);

  it('token salah ditolak; kode meja sprint yang dijeda tanpa token kursinya tidak ketemu', async () => {
    const { server, db, saya } = await nyalakan();
    const { a, masuk, token } = await sprintSampai(server.port, 'Ani', 0);
    a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    a.ws.close();
    const c = await klien(server.port);
    c.kirim({ t: 'sprint', nama: 'Ani', lanjut: 'x'.repeat(32) });
    expect(await tungguPesan(c, (p) => p.t === 'sprintSaya')).toEqual({ t: 'sprintSaya', token: null });
    expect((await tungguPesan(c, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_TIDAK_ADA);
    // Bentuk token yang tidak sah: pesannya ditolak sebelum sampai ke meja.
    c.pesan.length = 0;
    c.kirim({ t: 'sprint', nama: 'Ani', lanjut: 'pendek' });
    expect((await tungguPesan(c, (p) => p.t === 'error')).pesan).toBe('Pesan tidak dikenali.');
    for (const tokenKursi of ['salah', undefined]) {
      c.pesan.length = 0;
      c.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Ani', token: tokenKursi });
      expect((await tungguPesan(c, (p) => p.t === 'error')).pesan).toBe(`Meja ${masuk.kode} nggak ketemu.`);
    }
    expect(server.jumlahMeja()).toBe(0);
    expect(await saya('x'.repeat(32))).toEqual({ ada: false });
    expect(await saya('pendek')).toEqual({ ada: false });
    // Token yang benar tetap bisa dipakai.
    expect((await saya(token)).ada).toBe(true);
    expect(jumlahSimpanan(db)).toBe(1);
    c.ws.close();
  }, 30_000);

  it('putus tanpa Keluar: permainan dijeda, dilepas dari memori, lalu sambung ulang melanjutkannya di tengah putaran', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const jam = new JamGeser();
    const { server, db, log } = await nyalakan({ penjadwal: jam, jedaPutusMs: 10, lepasSprintKosongMs: 60_000, jedaSimpanMejaMs: 0 });
    const a = await klien(server.port);
    a.kirim({ t: 'sprint', nama: 'Cici' });
    const masuk = await tungguPesan(a, (p) => p.t === 'masuk');
    await tungguPesan(a, (p) => p.t === 'view');
    a.ws.close();
    await sampai(() => server.jumlahSambungan() === 0);
    await tunggu(100);
    // Tanpa pemain terhubung permainannya diam (#35); belum dilepas sebelum batasnya.
    vi.advanceTimersByTime(30_000);
    jam.geser += 59_000;
    vi.advanceTimersByTime(30_000);
    expect(server.jumlahMeja()).toBe(1);
    jam.geser += 1_000;
    vi.advanceTimersByTime(30_000);
    expect(server.jumlahMeja()).toBe(0);
    expect(log).toContain(`meja ${masuk.kode} dilepas (sprint dijeda)`);
    const data = dataSprintTersimpan<DataMeja>(db, masuk.kode)!;
    expect(data.game!.status).not.toBe('putaranSelesai');
    expect(data.game!.riwayat).toHaveLength(0);
    const peristiwaTerakhir = data.game!.peristiwa.at(-1)!.id;

    // Aplikasi menyambung ulang sesinya (kode + token kursi): sprint dimuat lagi dan putarannya diteruskan.
    const b = await klien(server.port, pemainOtomatis(1));
    b.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Cici', token: masuk.token });
    expect(await tungguPesan(b, (p) => p.t === 'masuk')).toMatchObject({ kode: masuk.kode, kursi: masuk.kursi });
    expect(log).toContain(`meja ${masuk.kode} dimuat (sprint dilanjut)`);
    const v = (await tungguPesan(b, (p) => p.t === 'view')).view as ViewPemain;
    expect(v.putaran!.nomor).toBe(1);
    expect(v.peristiwa.at(-1)!.id).toBeGreaterThanOrEqual(peristiwaTerakhir);
    await tungguPesan(b, (p) => p.t === 'sprintHasil' && p.putaran === 1, 60_000);
    expect(barisSprint(db).map((x) => x.putaran)).toEqual([1]);
    b.ws.close();
  }, 90_000);

  it('restart saat dijeda dan saat main: Lanjut sprint memuatnya lagi, tidak ada putaran yang hilang atau ganda', async () => {
    const path = dbBaru();
    const jam = new JamGeser();
    const s1 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    const { a, masuk, token } = await sprintSampai(s1.server.port, 'Dodi', 1);
    a.kirim({ t: 'keluar' });
    await sampai(() => s1.server.jumlahMeja() === 0);
    a.ws.close();
    await s1.matikan();

    // Restart selagi dijeda.
    const s2 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    expect(s2.server.jumlahMeja()).toBe(0);
    const lanjut = { sampai: 2 };
    const b = await klien(s2.server.port, pemainOtomatis(lanjut));
    b.kirim({ t: 'sprint', nama: 'Dodi', lanjut: token });
    await tungguPesan(b, (p) => p.t === 'masuk');
    await tungguPesan(b, (p) => p.t === 'sprintHasil' && p.putaran === 2, 60_000);
    await tungguPesan(b, putaranSelesai(2));
    // Mulai putaran 3, lalu server dimatikan di tengahnya (restart selagi main).
    lanjut.sampai = 3;
    b.kirim({ t: 'putaranBerikut' });
    await tungguPesan(b, (p) => p.t === 'view' && (p.view as ViewPemain).putaran?.nomor === 3);
    const sebelum = viewTerakhir(b);
    await s2.matikan();
    b.ws.close();

    const s3 = await nyalakan({ penjadwal: jam, jedaSimpanMejaMs: 0 }, path);
    expect(s3.server.jumlahMeja()).toBe(0);
    expect((await s3.saya(token)).putaran).toBe(3);
    const c = await klien(s3.server.port, pemainOtomatis(3));
    c.kirim({ t: 'sprint', nama: 'Dodi', lanjut: token });
    expect(await tungguPesan(c, (p) => p.t === 'masuk')).toMatchObject({ kode: masuk.kode, kursi: masuk.kursi });
    const v = (await tungguPesan(c, (p) => p.t === 'view')).view as ViewPemain;
    expect(v.putaran!.nomor).toBe(3);
    expect(v.riwayat).toHaveLength(2);
    expect(v.skor).toEqual(sebelum.skor);
    await tungguPesan(c, (p) => p.t === 'sprintHasil' && p.putaran === 3, 60_000);
    expect(barisSprint(s3.db).map((x) => [x.kode_meja, x.putaran])).toEqual([
      [masuk.kode, 1],
      [masuk.kode, 2],
      [masuk.kode, 3],
    ]);
    c.ws.close();
  }, 180_000);

  it('tanpa Mulai dari 0 (0.10.3): `ganti` dari aplikasi lama ditolak, sprint-nya tetap jalan dan bisa dilanjut; token yang sudah tidak berlaku tidak menahan', async () => {
    const { server, db, saya } = await nyalakan();
    const lama = await sprintSampai(server.port, 'Eko', 1);
    const kodeLama = infoTerakhir(lama.a)!.kode;
    // Aplikasi 0.10.1–0.10.2 menekan Mulai dari 0 dari sambungan lain.
    const b = await klien(server.port);
    b.kirim({ t: 'sprint', nama: 'Eko', ganti: lama.token });
    expect((await tungguPesan(b, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_TANPA_MULAI_NOL);
    await tunggu(100);
    // Tidak ada meja baru, tidak ada token baru, sprint lama tidak ditutup.
    expect(b.pesan.some((p) => p.t === 'masuk' || p.t === 'sprintSaya')).toBe(false);
    expect(lama.a.pesan.some((p) => p.t === 'keluar')).toBe(false);
    expect(server.jumlahMeja()).toBe(1);
    expect(jumlahSimpanan(db)).toBe(1);
    expect(await saya(lama.token)).toMatchObject({ ada: true });
    expect(barisSprint(db).map((x) => [x.kode_meja, x.putaran])).toEqual([[kodeLama, 1]]);
    // Keluar lalu Lanjut sprint: permainan yang sama.
    lama.a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    b.pesan.length = 0;
    b.kirim({ t: 'sprint', nama: 'Eko', lanjut: lama.token });
    expect((await tungguPesan(b, (p) => p.t === 'masuk')).kode).toBe(kodeLama);
    b.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    b.ws.close();
    lama.a.ws.close();
    // Token yang sprint-nya sudah tidak ada (atau dari minggu lalu): sprint baru dibuat seperti biasa.
    db.prepare('UPDATE sprint_simpanan SET minggu = minggu - 7 * 86400000').run();
    const c = await klien(server.port);
    c.kirim({ t: 'sprint', nama: 'Eko', ganti: lama.token });
    const baru = await tokenDari(c);
    expect(baru.token).not.toBe(lama.token);
    c.ws.close();
  }, 90_000);

  it('Senin 00.00 WIB: sprint minggu lalu yang dijeda tidak bisa dilanjut; yang masih dimainkan jalan terus sampai Keluar', async () => {
    const jam = new JamGeser();
    const senin = awalMingguWib(Date.now()) + 7 * HARI;
    jam.geser = senin - 30 * 60_000 - Date.now();
    const { server, db, saya, log } = await nyalakan({ penjadwal: jam });
    // Sprint pertama: dijeda sebelum Senin.
    const dijeda = await sprintSampai(server.port, 'Fani', 1);
    dijeda.a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    dijeda.a.ws.close();
    // Sprint kedua: masih dimainkan saat Senin lewat.
    const main = await sprintSampai(server.port, 'Gita', 1);
    const kodeMain = infoTerakhir(main.a)!.kode;

    jam.geser += 60 * 60_000;
    expect(await saya(dijeda.token)).toEqual({ ada: false });
    const c = await klien(server.port);
    c.kirim({ t: 'sprint', nama: 'Fani', lanjut: dijeda.token });
    expect(await tungguPesan(c, (p) => p.t === 'sprintSaya')).toEqual({ t: 'sprintSaya', token: null });
    expect((await tungguPesan(c, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_TAK_BISA_LANJUT);
    // Main sprint lagi = sprint baru dari 0 di minggu yang baru.
    c.kirim({ t: 'sprint', nama: 'Fani' });
    const baru = await tokenDari(c);
    expect(baru.minggu).toBe(senin);

    // Yang masih dimainkan jalan terus: putaran 2 selesai sesudah Senin, masuk papan minggu baru.
    main.lanjut.sampai = 2;
    main.a.kirim({ t: 'putaranBerikut' });
    await tungguPesan(main.a, (p) => p.t === 'sprintHasil' && p.putaran === 2, 60_000);
    const putaranGita = barisSprint(db).filter((x) => x.kode_meja === kodeMain);
    expect(putaranGita.map((x) => x.putaran)).toEqual([1, 2]);
    expect(Number(putaranGita[1].waktu)).toBeGreaterThanOrEqual(senin);
    // Begitu pemainnya Keluar, sprint minggu lalu itu selesai: tidak disimpan, tidak bisa dilanjut.
    main.a.kirim({ t: 'keluar' });
    expect((await tungguPesan(main.a, (p) => p.t === 'keluar')).alasan).toBe(TEKS_SPRINT_TAK_BISA_LANJUT);
    await sampai(() => log.includes(`meja ${kodeMain} ditutup (sprint minggu lalu)`));
    expect(await saya(main.token)).toEqual({ ada: false });
    // Tinggal sprint baru Fani.
    expect(jumlahSimpanan(db)).toBe(1);
    main.a.ws.close();
    c.ws.close();
  }, 120_000);

  it('batas sprint baru per jaringan per jam dan jumlah sprint tersimpan; Lanjut tidak ikut dihitung', async () => {
    const s1 = await nyalakan({ maksSprintBaruPerJamPerIp: 2 });
    const a = await klien(s1.server.port);
    const tokens: string[] = [];
    for (const nama of ['Hadi', 'Hadi']) {
      a.kirim({ t: 'sprint', nama });
      tokens.push((await tokenDari(a)).token);
      a.pesan.length = 0;
    }
    a.kirim({ t: 'sprint', nama: 'Hadi' });
    expect((await tungguPesan(a, (p) => p.t === 'error')).pesan).toBe('Kebanyakan sprint baru dari jaringanmu, Bos. Coba lagi nanti.');
    a.pesan.length = 0;
    a.kirim({ t: 'sprint', nama: 'Hadi', lanjut: tokens[0] });
    expect((await tokenDari(a)).token).toBe(tokens[0]);
    a.ws.close();

    const s2 = await nyalakan({ maksSimpananSprint: 1 });
    const b = await klien(s2.server.port);
    b.kirim({ t: 'sprint', nama: 'Ida' });
    const satu = await tokenDari(b);
    b.pesan.length = 0;
    b.kirim({ t: 'sprint', nama: 'Ida' });
    expect((await tungguPesan(b, (p) => p.t === 'error')).pesan).toBe('Server lagi penuh, coba lagi nanti.');
    // Mulai dari 0 dari aplikasi lama ditolak (0.10.3); sprint-nya tetap.
    b.pesan.length = 0;
    b.kirim({ t: 'sprint', nama: 'Ida', ganti: satu.token });
    expect((await tungguPesan(b, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_TANPA_MULAI_NOL);
    expect(jumlahSimpanan(s2.db)).toBe(1);
    b.ws.close();
  }, 30_000);

  it('POST /api/sprint/saya: hanya POST, dibatasi per jaringan', async () => {
    const { alamat } = await nyalakan();
    expect((await fetch(`${alamat}/api/sprint/saya`)).status).toBe(405);
    let terakhir = 0;
    for (let i = 0; i < 61; i++) {
      terakhir = (await fetch(`${alamat}/api/sprint/saya`, { method: 'POST', body: JSON.stringify({ token: 'a'.repeat(32) }) })).status;
    }
    expect(terakhir).toBe(429);
  });

  it('memuat sprint ikut batas meja server dan batas muat per jaringan; ditolak sementara = token tetap berlaku', async () => {
    const s1 = await nyalakan({ maksMeja: 1 });
    const satu = await sprintSampai(s1.server.port, 'Joko', 0);
    satu.a.kirim({ t: 'keluar' });
    await sampai(() => s1.server.jumlahMeja() === 0);
    satu.a.ws.close();
    // Meja lain memenuhi server: Lanjut sprint ditolak sementara, tanpa sprintSaya null.
    const lain = await klien(s1.server.port);
    lain.kirim({ t: 'buat', nama: 'Lain' });
    await tungguPesan(lain, (p) => p.t === 'masuk');
    const b = await klien(s1.server.port);
    b.kirim({ t: 'sprint', nama: 'Joko', lanjut: satu.token });
    expect((await tungguPesan(b, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_COBA_LAGI);
    expect(b.pesan.some((p) => p.t === 'sprintSaya')).toBe(false);
    expect(s1.server.jumlahMeja()).toBe(1);
    expect(s1.log.some((l) => l.includes('server penuh'))).toBe(true);
    expect((await s1.saya(satu.token)).ada).toBe(true);
    b.ws.close();
    lain.ws.close();

    // Batas muat per jaringan per menit: muat ke-3 dalam semenit ditolak sementara.
    const s2 = await nyalakan({ maksMuatSprintPerMenitPerIp: 2 });
    const dua = await sprintSampai(s2.server.port, 'Joko', 0);
    dua.a.kirim({ t: 'keluar' });
    await sampai(() => s2.server.jumlahMeja() === 0);
    const c = dua.a;
    for (let i = 0; i < 2; i++) {
      c.pesan.length = 0;
      c.kirim({ t: 'sprint', nama: 'Joko', lanjut: dua.token });
      expect((await tokenDari(c)).token).toBe(dua.token);
      c.kirim({ t: 'keluar' });
      await sampai(() => s2.server.jumlahMeja() === 0);
    }
    c.pesan.length = 0;
    c.kirim({ t: 'sprint', nama: 'Joko', lanjut: dua.token });
    expect((await tungguPesan(c, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_COBA_LAGI);
    expect(c.pesan.some((p) => p.t === 'sprintSaya')).toBe(false);
    expect(s2.server.jumlahMeja()).toBe(0);
    expect(s2.log.some((l) => l.includes('kebanyakan dimuat'))).toBe(true);
    c.ws.close();
  }, 30_000);

  it('sambungan yang pindah dari sprint ke sprint lain: yang ditinggal langsung disimpan dan dilepas dari memori', async () => {
    const { server, log } = await nyalakan();
    const satu = await sprintSampai(server.port, 'Kiki', 0);
    const kodeSatu = infoTerakhir(satu.a)!.kode;
    satu.a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    satu.a.ws.close();
    const dua = await sprintSampai(server.port, 'Lala', 0);
    const kodeDua = infoTerakhir(dua.a)!.kode;
    dua.a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    dua.a.ws.close();
    // Satu sambungan memutar dua token: memori server tetap satu meja.
    const c = await klien(server.port);
    for (let i = 0; i < 3; i++) {
      for (const t of [satu.token, dua.token]) {
        c.pesan.length = 0;
        c.kirim({ t: 'sprint', nama: 'Kiki', lanjut: t });
        expect((await tokenDari(c)).token).toBe(t);
        expect(server.jumlahMeja()).toBe(1);
      }
    }
    expect(log.filter((l) => l === `meja ${kodeSatu} dilepas (sprint dijeda)`).length).toBeGreaterThanOrEqual(3);
    expect(log.filter((l) => l === `meja ${kodeDua} dilepas (sprint dijeda)`).length).toBeGreaterThanOrEqual(3);
    c.ws.close();
  }, 30_000);

  it('batas sprint tersimpan per jaringan minggu ini: yang belum pernah dimainkan dibuang duluan, kalau tidak ada ditolak', async () => {
    const { server, db, saya } = await nyalakan({ maksSimpananSprintPerIp: 2 });
    const a = await klien(server.port);
    const tokens: string[] = [];
    for (let i = 0; i < 2; i++) {
      a.kirim({ t: 'sprint', nama: 'Mira' });
      tokens.push((await tokenDari(a)).token);
      a.pesan.length = 0;
    }
    a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    // Sprint ke-3: sprint pertama (belum pernah selesai satu putaran) dibuang untuk memberi tempat.
    a.kirim({ t: 'sprint', nama: 'Mira' });
    tokens.push((await tokenDari(a)).token);
    a.pesan.length = 0;
    expect(jumlahSimpanan(db)).toBe(2);
    expect(await saya(tokens[0])).toEqual({ ada: false });
    expect((await saya(tokens[1])).ada).toBe(true);
    // Semuanya sudah pernah dimainkan: sprint baru dari jaringan ini ditolak (Mulai dari 0 juga, 0.10.3).
    a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    db.prepare('UPDATE sprint_simpanan SET putaran = 3').run();
    a.kirim({ t: 'sprint', nama: 'Mira' });
    expect((await tungguPesan(a, (p) => p.t === 'error')).pesan).toBe('Kebanyakan sprint dari jaringanmu minggu ini, Bos. Lanjutkan yang sudah ada.');
    a.pesan.length = 0;
    a.kirim({ t: 'sprint', nama: 'Mira', ganti: tokens[2] });
    expect((await tungguPesan(a, (p) => p.t === 'error')).pesan).toBe(TEKS_SPRINT_TANPA_MULAI_NOL);
    expect(jumlahSimpanan(db)).toBe(2);
    expect((await saya(tokens[2])).ada).toBe(true);
    a.ws.close();
  }, 30_000);

  it('sambung ulang ke sprint yang dijeda: token kursi dicocokkan dengan hash-nya sebelum simpanannya dibaca', async () => {
    const { server, db, log } = await nyalakan();
    const { a, masuk } = await sprintSampai(server.port, 'Nana', 0);
    const kode = infoTerakhir(a)!.kode;
    a.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    a.ws.close();
    // Token kursinya sendiri: dimuat lagi lewat sambung ulang biasa (kode + token kursi).
    const b = await klien(server.port);
    b.kirim({ t: 'gabung', kode, nama: 'Nana', token: String(masuk.token) });
    expect(await tungguPesan(b, (p) => p.t === 'masuk')).toMatchObject({ kode, token: masuk.token });
    b.kirim({ t: 'keluar' });
    await sampai(() => server.jumlahMeja() === 0);
    b.ws.close();
    // Simpanannya dirusak: kalau server sempat membacanya untuk token sembarang, "rusak" tercatat di log.
    db.prepare("UPDATE sprint_simpanan SET data = '{rusak'").run();
    const d = await klien(server.port);
    d.kirim({ t: 'gabung', kode, nama: 'Maling', token: 'bukan-token-kursi' });
    expect((await tungguPesan(d, (p) => p.t === 'error')).pesan).toBe(`Meja ${kode} nggak ketemu.`);
    expect(log.some((l) => l.includes('rusak'))).toBe(false);
    expect(server.jumlahMeja()).toBe(0);
    d.ws.close();
  }, 30_000);
});
