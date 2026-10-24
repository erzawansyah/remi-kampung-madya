// Usul fitur dari game (keputusan pemilik 24 Okt 2026): tabel usulan (migrasi v3, tanpa alamat IP),
// klien Notion (properti, potongan teks, galat tanpa token), pengirim (kirim langsung, kirim ulang
// dengan jeda yang makin panjang, berhenti sesudah 20 percobaan, berhenti rapi), dan POST /api/usulan
// (validasi, cek Origin, batas per jaringan dan per hari, timer dibersihkan saat server ditutup).

import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Penjadwal, Usulan } from '@remi/meja';
import { bukaRiwayat, MIGRASI, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type ServerRemi } from '../src/server.js';
import { buatKlienNotion, GalatNotion, normalkanIdNotion, potongTeksNotion, propertiUsulan, type HalamanUsulan, type KlienNotion } from '../src/notion.js';
import {
  JEDA_MAKS_USULAN_MS,
  JEDA_PUTARAN_USULAN_MS,
  MAKS_PERCOBAAN_USULAN,
  jalankanPengirimUsulan,
  jedaCobaLagi,
  type PenyimpanUsulan,
} from '../src/usulan.js';

const TOKEN = 'ntn_RAHASIA_jangan_bocor_123456';
const DB_NOTION = 'd31d1a9e7a7a44cf963bab9777f02e4a';
const T0 = Date.UTC(2026, 9, 24, 3);

const usulanAni: Usulan = { nama: 'Ani', judul: 'Mode turnamen', isi: 'Bisa ada turnamen antar meja?\nBiar seru tiap Jumat.', jenis: 'Fitur' };
const usulanBudi: Usulan = { nama: 'Budi', judul: 'Kartu ketutup toast', isi: 'Di HP kecil toast nutup kartu paling kanan.', jenis: null };

const tunggu = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

/** Penjadwal palsu: waktu maju manual; mencatat timer yang masih aktif. */
function jamPalsu(awal = T0) {
  let t = awal;
  let nomor = 0;
  const timer = new Map<number, { pada: number; fn: () => void }>();
  const p: Penjadwal & { aktif(): number; maju(ms: number): Promise<void> } = {
    setel(ms, fn) {
      const id = ++nomor;
      timer.set(id, { pada: t + ms, fn });
      return id;
    },
    batal: (h) => void timer.delete(h as number),
    sekarang: () => t,
    aktif: () => timer.size,
    async maju(ms) {
      t += ms;
      for (const [id, x] of [...timer].sort((a, b) => a[1].pada - b[1].pada)) {
        if (x.pada > t) continue;
        timer.delete(id);
        x.fn();
        await tunggu();
      }
      await tunggu();
    },
  };
  return p;
}

/** Klien Notion palsu: jawabannya diatur per panggilan. */
function notionPalsu(jawab: (h: HalamanUsulan, ke: number) => { id: string } | GalatNotion) {
  const panggil: HalamanUsulan[] = [];
  const k: KlienNotion = {
    async buatHalaman(h) {
      panggil.push(h);
      const hasil = jawab(h, panggil.length);
      if (hasil instanceof GalatNotion) throw hasil;
      return hasil;
    },
  };
  return { k, panggil };
}

describe('tabel usulan (migrasi v3)', () => {
  it('database baru langsung versi terbaru; jumlah migrasi = 3 (v1 leaderboard, v2 kompetisi, v3 usulan)', () => {
    expect(MIGRASI.length).toBe(3);
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(3);
    // Alamat IP tidak pernah disimpan: tidak ada kolom untuk itu.
    const kolom = (db.prepare('PRAGMA table_info(usulan)').all() as { name: string }[]).map((k) => k.name);
    expect(kolom).toEqual(['id', 'dibuat_pada', 'nama', 'judul', 'isi', 'jenis', 'notion_halaman', 'terkirim_pada', 'percobaan', 'galat_terakhir']);
    expect(kolom.some((k) => /ip|alamat|jaringan/i.test(k))).toBe(false);
    r.tutup();
    db.close();
  });

  it('database v2 (rilis kompetisi) dimigrasi ke v3 tanpa menyentuh data lama', () => {
    const db = new DatabaseSync(':memory:');
    const r = bukaRiwayat(db);
    r.simpan({
      kode: 'AAAAA',
      selesaiPada: T0,
      alasan: 'sepakat',
      jumlahPutaran: 1,
      jumlahDeck: 1,
      modeKaldu: false,
      pemain: [
        { kursi: 0, nama: 'Ani', bot: false, skor: 10, peringkat: 1, mentung: 0, kepentung: 0 },
        { kursi: 1, nama: 'Budi', bot: false, skor: 5, peringkat: 2, mentung: 0, kepentung: 0 },
      ],
    });
    r.tutup();
    // Seolah database dibuat server 0.5 (v2): tabel usulan belum ada.
    db.exec('DROP TABLE usulan; PRAGMA user_version = 2;');
    const log: string[] = [];
    const r2 = bukaRiwayat(db, { log: (...x) => log.push(x.join(' ')) });
    expect(log).toContain('skema riwayat dimigrasi v2 → v3');
    expect(r2.daftar(5).map((p) => p.kodeMeja)).toEqual(['AAAAA']);
    expect(r2.usulan.simpan(usulanAni, T0)).toBe(1);
    r2.tutup();
    db.close();
  });

  it('simpan, belum terkirim, tandai gagal/terkirim, jumlah sejak', () => {
    const r = bukaRiwayat(':memory:');
    const u = r.usulan;
    const a = u.simpan(usulanAni, T0);
    const b = u.simpan(usulanBudi, T0 + 1000);
    expect(u.ambil(a)).toEqual({
      id: a,
      dibuatPada: T0,
      ...usulanAni,
      notionHalaman: null,
      terkirimPada: null,
      percobaan: 0,
      galatTerakhir: null,
    });
    expect(u.ambil(b)!.jenis).toBeNull();
    expect(u.ambil(999)).toBeNull();
    expect(u.belumTerkirim(20).map((x) => x.id)).toEqual([a, b]);
    expect(u.tandaiGagal(a, 'HTTP 503')).toBe(1);
    expect(u.tandaiGagal(a, 'HTTP 503 lagi')).toBe(2);
    expect(u.ambil(a)).toMatchObject({ percobaan: 2, galatTerakhir: 'HTTP 503 lagi' });
    // Yang sudah mencapai batas percobaan tidak diambil lagi.
    expect(u.belumTerkirim(2).map((x) => x.id)).toEqual([b]);
    u.tandaiTerkirim(b, 'halaman-b', T0 + 5000);
    expect(u.ambil(b)).toMatchObject({ terkirimPada: T0 + 5000, notionHalaman: 'halaman-b', galatTerakhir: null });
    expect(u.belumTerkirim(20).map((x) => x.id)).toEqual([a]);
    expect(u.jumlahSejak(T0)).toBe(2);
    expect(u.jumlahSejak(T0 + 1)).toBe(1);
    r.tutup();
  });
});

describe('klien Notion', () => {
  it('properti halaman sesuai kolom database "Permintaan Fitur"', () => {
    const p = propertiUsulan({ idServer: 7, judul: 'Mode turnamen', isi: 'Isi\nbaris dua', pengusul: 'Ani', jenis: 'Fitur' });
    expect(p).toEqual({
      Judul: { title: [{ type: 'text', text: { content: 'Mode turnamen' } }] },
      'Isi usulan': { rich_text: [{ type: 'text', text: { content: 'Isi\nbaris dua' } }] },
      Pengusul: { rich_text: [{ type: 'text', text: { content: 'Ani' } }] },
      Sumber: { select: { name: 'Game' } },
      Jenis: { select: { name: 'Fitur' } },
      Status: { status: { name: 'Baru' } },
      'ID server': { number: 7 },
    });
    // Tanpa jenis: kolom Jenis tidak dikirim (dibiarkan kosong di Notion).
    expect(propertiUsulan({ idServer: 8, judul: 'x', isi: 'y', pengusul: 'Budi', jenis: null })).not.toHaveProperty('Jenis');
    // Judul paling banyak 100 karakter.
    const panjang = propertiUsulan({ idServer: 9, judul: 'a'.repeat(150), isi: 'y', pengusul: 'Budi', jenis: null }) as { Judul: { title: { text: { content: string } }[] } };
    expect(panjang.Judul.title[0]!.text.content).toHaveLength(100);
  });

  it('teks panjang dipecah ≤ 2000 per potongan tanpa membelah emoji', () => {
    expect(potongTeksNotion('')).toEqual(['']);
    expect(potongTeksNotion('a'.repeat(4500)).map((x) => x.length)).toEqual([2000, 2000, 500]);
    const emoji = `${'a'.repeat(1999)}😀b`;
    const potong = potongTeksNotion(emoji);
    expect(potong).toEqual(['a'.repeat(1999), '😀b']);
    expect(potong.join('')).toBe(emoji);
  });

  it('id database: 32 hex, dengan tanda hubung, atau tautan dari browser', () => {
    expect(normalkanIdNotion(DB_NOTION)).toBe(DB_NOTION);
    expect(normalkanIdNotion(' d31d1a9e-7a7a-44cf-963b-ab9777f02e4a ')).toBe(DB_NOTION);
    expect(normalkanIdNotion(`https://www.notion.so/kedai/Permintaan-Fitur-${DB_NOTION}?v=abc123`)).toBe(DB_NOTION);
    expect(normalkanIdNotion('bukan-id')).toBeNull();
    expect(normalkanIdNotion('')).toBeNull();
    expect(normalkanIdNotion(undefined)).toBeNull();
  });

  it('POST ke /v1/pages dengan token, versi API, dan database tujuan', async () => {
    const panggil: { url: string; init: RequestInit }[] = [];
    const fetchPalsu = (async (url: string, init: RequestInit) => {
      panggil.push({ url, init });
      return new Response(JSON.stringify({ object: 'page', id: 'halaman-1' }), { status: 200 });
    }) as unknown as typeof fetch;
    const k = buatKlienNotion({ token: TOKEN, database: 'd31d1a9e-7a7a-44cf-963b-ab9777f02e4a', fetch: fetchPalsu });
    expect(await k.buatHalaman({ idServer: 1, judul: 'Judul', isi: 'Isi usulan', pengusul: 'Ani', jenis: null })).toEqual({ id: 'halaman-1' });
    expect(panggil[0]!.url).toBe('https://api.notion.com/v1/pages');
    expect(panggil[0]!.init.method).toBe('POST');
    expect(panggil[0]!.init.headers).toMatchObject({ authorization: `Bearer ${TOKEN}`, 'notion-version': '2022-06-28', 'content-type': 'application/json' });
    const isi = JSON.parse(String(panggil[0]!.init.body)) as { parent: unknown; properties: Record<string, unknown> };
    expect(isi.parent).toEqual({ database_id: DB_NOTION });
    expect(isi.properties['ID server']).toEqual({ number: 1 });
  });

  it('galat dipetakan tanpa token: HTTP + kode Notion, jaringan, batas waktu', async () => {
    const jawab = (status: number, isi: unknown) =>
      (async () => new Response(JSON.stringify(isi), { status })) as unknown as typeof fetch;
    const h: HalamanUsulan = { idServer: 1, judul: 'J', isi: 'I', pengusul: 'Ani', jenis: null };

    const g401 = await buatKlienNotion({ token: TOKEN, database: DB_NOTION, fetch: jawab(401, { object: 'error', code: 'unauthorized', message: `API token ${TOKEN} is invalid.` }) })
      .buatHalaman(h)
      .catch((e: unknown) => e);
    expect(g401).toBeInstanceOf(GalatNotion);
    expect(g401).toMatchObject({ status: 401, kode: 'unauthorized', menyeluruh: true });
    expect((g401 as Error).message).toBe('HTTP 401 unauthorized: API token [token] is invalid.');

    const g400 = (await buatKlienNotion({ token: TOKEN, database: DB_NOTION, fetch: jawab(400, { code: 'validation_error', message: 'Jenis is not a property.' }) })
      .buatHalaman(h)
      .catch((e: unknown) => e)) as GalatNotion;
    expect(g400).toMatchObject({ status: 400, kode: 'validation_error', menyeluruh: false });

    const putus = (async () => {
      throw new TypeError(`fetch failed (Bearer ${TOKEN})`);
    }) as unknown as typeof fetch;
    const gJaringan = (await buatKlienNotion({ token: TOKEN, database: DB_NOTION, fetch: putus }).buatHalaman(h).catch((e: unknown) => e)) as GalatNotion;
    expect(gJaringan).toMatchObject({ status: null, menyeluruh: true });
    expect(gJaringan.message).not.toContain(TOKEN);

    const diam = ((_u: string, init: RequestInit) =>
      new Promise((_ok, gagal) => init.signal!.addEventListener('abort', () => gagal(init.signal!.reason)))) as unknown as typeof fetch;
    const gWaktu = (await buatKlienNotion({ token: TOKEN, database: DB_NOTION, fetch: diam, batasWaktuMs: 20 }).buatHalaman(h).catch((e: unknown) => e)) as GalatNotion;
    expect(gWaktu.message).toMatch(/tidak dijawab/);

    const tanpaId = (await buatKlienNotion({ token: TOKEN, database: DB_NOTION, fetch: jawab(200, { object: 'page' }) }).buatHalaman(h).catch((e: unknown) => e)) as GalatNotion;
    expect(tanpaId).toBeInstanceOf(GalatNotion);
  });
});

describe('pengirim usulan ke Notion', () => {
  let r: PenyimpanRiwayat | undefined;
  let u: PenyimpanUsulan;
  let log: string[];
  const catat = (...x: unknown[]) => log.push(x.map(String).join(' '));
  const berhenti: (() => Promise<void>)[] = [];
  const mulai = () => {
    const baru = bukaRiwayat(':memory:');
    r = baru;
    u = baru.usulan;
    log = [];
  };
  afterEach(async () => {
    for (const f of berhenti.splice(0)) await f();
    r?.tutup();
  });

  it('jeda kirim ulang: 5 menit, dua kali lipat tiap gagal, paling lama 6 jam', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 20].map(jedaCobaLagi)).toEqual([
      5 * 60_000,
      10 * 60_000,
      20 * 60_000,
      40 * 60_000,
      80 * 60_000,
      160 * 60_000,
      320 * 60_000,
      JEDA_MAKS_USULAN_MS,
      JEDA_MAKS_USULAN_MS,
    ]);
    expect(jedaCobaLagi(0)).toBe(0);
    // Total jeda sampai menyerah: ±3,7 hari.
    let total = 0;
    for (let i = 1; i < MAKS_PERCOBAAN_USULAN; i++) total += jedaCobaLagi(i);
    expect(total / (24 * 60 * 60_000)).toBeGreaterThan(3);
    expect(total / (24 * 60 * 60_000)).toBeLessThan(4);
  });

  it('usulan baru langsung dikirim; satu baris log tanpa isi usulan', async () => {
    mulai();
    const jam = jamPalsu();
    const { k, panggil } = notionPalsu(() => ({ id: 'halaman-ani' }));
    const p = jalankanPengirimUsulan({ penyimpan: u, notion: k, log: catat, penjadwal: jam });
    berhenti.push(() => p.hentikan());
    const id = u.simpan(usulanAni, jam.sekarang());
    await p.kirimBaru(id);
    expect(panggil).toEqual([{ idServer: id, judul: 'Mode turnamen', isi: usulanAni.isi, pengusul: 'Ani', jenis: 'Fitur' }]);
    expect(u.ambil(id)).toMatchObject({ terkirimPada: T0, notionHalaman: 'halaman-ani', percobaan: 0 });
    expect(log).toEqual([`usulan #${id} terkirim ke Notion`]);
    // Dikirim lagi (mis. putaran berikutnya): tidak dobel.
    await p.kirimBaru(id);
    await jam.maju(JEDA_PUTARAN_USULAN_MS * 2);
    expect(panggil).toHaveLength(1);
  });

  it('gagal = dicoba lagi di putaran 5 menitan dengan jeda yang makin panjang, berhenti sesudah 20 percobaan', async () => {
    mulai();
    const jam = jamPalsu();
    const { k, panggil } = notionPalsu(() => new GalatNotion('HTTP 400 validation_error: ada yang salah', 400, 'validation_error'));
    const p = jalankanPengirimUsulan({ penyimpan: u, notion: k, log: catat, penjadwal: jam });
    berhenti.push(() => p.hentikan());
    const id = u.simpan(usulanBudi, jam.sekarang());
    await p.kirimBaru(id);
    expect(u.ambil(id)).toMatchObject({ percobaan: 1, galatTerakhir: 'HTTP 400 validation_error: ada yang salah', terkirimPada: null });
    expect(log.at(-1)).toBe(`usulan #${id} gagal dikirim ke Notion (percobaan 1/20, dicoba lagi dalam ±5 menit): HTTP 400 validation_error: ada yang salah`);

    // Putaran pertama (10 detik sesudah jalan) belum waktunya: jeda 5 menit belum lewat.
    await jam.maju(10_000);
    expect(panggil).toHaveLength(1);
    // Putaran kirim ulang tiap 5 menit. Sesudah gagal ke-k, usulan baru dicoba lagi setelah
    // jedaCobaLagi(k): sedikit sebelum itu belum, satu putaran sesudahnya sudah.
    let gagalPada = T0;
    for (let k = 1; k < MAKS_PERCOBAAN_USULAN; k++) {
      await jam.maju(gagalPada + jedaCobaLagi(k) - 1000 - jam.sekarang());
      expect(panggil, `percobaan ${k + 1} terlalu cepat`).toHaveLength(k);
      await jam.maju(JEDA_PUTARAN_USULAN_MS);
      expect(panggil, `percobaan ${k + 1}`).toHaveLength(k + 1);
      expect(u.ambil(id)!.percobaan).toBe(k + 1);
      gagalPada = jam.sekarang();
    }
    expect(panggil).toHaveLength(MAKS_PERCOBAAN_USULAN);
    expect(log.at(-1)).toMatch(/berhenti dicoba sesudah 20 percobaan, tetap tersimpan di database/);
    // Sesudah menyerah: tidak dicoba lagi, barisnya tetap ada.
    await jam.maju(JEDA_MAKS_USULAN_MS * 3);
    expect(panggil).toHaveLength(MAKS_PERCOBAAN_USULAN);
    expect(u.ambil(id)).not.toBeNull();
  });

  it('galat menyeluruh (token salah) menghentikan putaran; yang masuk selagi Notion belum diatur terkirim di putaran pertama', async () => {
    mulai();
    const jam = jamPalsu();
    // Tiga usulan masuk sebelum Notion diatur (server tanpa pengirim).
    const ids = [u.simpan(usulanAni, T0 - 3000), u.simpan(usulanBudi, T0 - 2000), u.simpan({ ...usulanAni, judul: 'Ketiga' }, T0 - 1000)];
    let tokenSalah = true;
    const { k, panggil } = notionPalsu((h) => (tokenSalah ? new GalatNotion('HTTP 401 unauthorized', 401, 'unauthorized') : { id: `halaman-${h.idServer}` }));
    const p = jalankanPengirimUsulan({ penyimpan: u, notion: k, log: catat, penjadwal: jam });
    berhenti.push(() => p.hentikan());
    await jam.maju(10_000);
    // Hanya yang pertama dicoba: dua lainnya tidak ikut menembak Notion dengan token yang sama.
    expect(panggil.map((h) => h.idServer)).toEqual([ids[0]]);
    expect(ids.map((id) => u.ambil(id)!.percobaan)).toEqual([1, 0, 0]);
    tokenSalah = false;
    await jam.maju(JEDA_PUTARAN_USULAN_MS);
    expect(ids.map((id) => u.ambil(id)!.terkirimPada !== null)).toEqual([true, true, true]);
    expect(log.filter((l) => l.endsWith('terkirim ke Notion'))).toHaveLength(3);
  });

  it('hentikan: timer dibatalkan, permintaan yang sedang jalan dibatalkan tanpa dihitung gagal', async () => {
    mulai();
    const jam = jamPalsu();
    let sinyal: AbortSignal | undefined;
    const k: KlienNotion = {
      buatHalaman: (_h, s) =>
        new Promise((_ok, gagal) => {
          sinyal = s;
          s!.addEventListener('abort', () => gagal(new GalatNotion('dibatalkan', null)));
        }),
    };
    const p = jalankanPengirimUsulan({ penyimpan: u, notion: k, log: catat, penjadwal: jam });
    expect(jam.aktif()).toBe(1);
    const id = u.simpan(usulanAni, T0);
    const jalan = p.kirimBaru(id);
    await tunggu();
    expect(sinyal?.aborted).toBe(false);
    await p.hentikan();
    await jalan;
    expect(sinyal?.aborted).toBe(true);
    expect(jam.aktif()).toBe(0);
    expect(u.ambil(id)).toMatchObject({ percobaan: 0, terkirimPada: null });
    expect(log).toEqual([]);
    // Sesudah berhenti tidak ada yang dijadwalkan atau dikirim lagi.
    await p.kirimBaru(id);
    await jam.maju(JEDA_MAKS_USULAN_MS);
    expect(jam.aktif()).toBe(0);
  });
});

describe('POST /api/usulan', () => {
  let server: ServerRemi;
  let riwayat: PenyimpanRiwayat;
  let alamat: string;
  const log: string[] = [];
  beforeAll(async () => {
    riwayat = bukaRiwayat(':memory:');
    server = await jalankanServer({ port: 0, host: '127.0.0.1', riwayat, log: (...x) => log.push(x.map(String).join(' ')), maksUsulanPerHari: 20 });
    alamat = `http://127.0.0.1:${server.port}`;
  });
  afterAll(async () => {
    await server.tutup();
    riwayat.tutup();
  });

  let nomorJaringan = 0;
  /** Tiap test memakai jaringan sendiri (X-Forwarded-For dipercaya dari 127.0.0.1). */
  const jaringanBaru = () => `203.0.113.${++nomorJaringan}`;
  const post = (isi: unknown, header: Record<string, string> = {}) =>
    fetch(`${alamat}/api/usulan`, { method: 'POST', headers: { 'content-type': 'application/json', ...header }, body: JSON.stringify(isi) });

  it('usulan sah disimpan (dirapikan) lalu dijawab {ok: true}; Notion belum diatur dicatat di log tanpa isinya', async () => {
    const r = await post({ nama: '  Ani ', judul: '  Mode   turnamen ', isi: 'Bisa ada turnamen?\r\n\r\n\r\nBiar seru​ tiap Jumat.', jenis: 'Fitur' }, { 'x-forwarded-for': jaringanBaru() });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const baris = riwayat.usulan.belumTerkirim(20).at(-1)!;
    expect(baris).toMatchObject({ nama: 'Ani', judul: 'Mode turnamen', isi: 'Bisa ada turnamen?\n\nBiar seru tiap Jumat.', jenis: 'Fitur', percobaan: 0 });
    expect(log).toContain(`usulan #${baris.id} masuk (Notion belum diatur, disimpan dulu)`);
    expect(log.join('\n')).not.toContain('turnamen');
    // Tanpa jenis juga boleh.
    expect((await post({ nama: 'Budi', judul: 'Toast', isi: 'Toast nutup kartu di HP kecil.' }, { 'x-forwarded-for': jaringanBaru() })).status).toBe(200);
  });

  it('isian salah ditolak 400 dengan pesan ramah', async () => {
    const jar = jaringanBaru();
    const tolak = async (isi: unknown) => {
      const r = await post(isi, { 'x-forwarded-for': jar });
      expect(r.status).toBe(400);
      return ((await r.json()) as { error: string }).error;
    };
    const sah = { nama: 'Ani', judul: 'Judul', isi: 'Isinya cukup panjang.' };
    expect(await tolak({ ...sah, nama: '' })).toBe('Isi namamu dulu di beranda, Bos.');
    expect(await tolak({ ...sah, judul: 'ab' })).toBe('Judulnya minimal 3 huruf, Bos.');
    expect(await tolak({ ...sah, judul: 'a'.repeat(81) })).toBe('Judulnya kepanjangan, maksimal 80 huruf.');
    expect(await tolak({ ...sah, isi: 'pendek' })).toBe('Ceritakan sedikit lagi, minimal 10 huruf.');
    expect(await tolak({ ...sah, jenis: 'Gosip' })).toBe('Jenis usulannya nggak dikenal.');
    expect(await tolak({ ...sah, isi: 'x'.repeat(1001) })).toBe('Isinya kepanjangan, maksimal 1000 huruf.');
    const rusak = await fetch(`${alamat}/api/usulan`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': jar }, body: '{' });
    expect(rusak.status).toBe(400);
  });

  it('ditolak tanpa JSON, dari asal lain, isi > 4 KB, dan selain POST', async () => {
    const jar = jaringanBaru();
    const sah = { nama: 'Ani', judul: 'Judul', isi: 'Isinya cukup panjang.' };
    expect((await fetch(`${alamat}/api/usulan`, { method: 'POST', body: JSON.stringify(sah), headers: { 'x-forwarded-for': jar } })).status).toBe(403);
    expect((await post(sah, { origin: 'https://jahat.example', 'x-forwarded-for': jar })).status).toBe(403);
    // Asal yang sama dengan server boleh.
    expect((await post(sah, { origin: alamat, 'x-forwarded-for': jar })).status).toBe(200);
    const besar = await post({ ...sah, isi: 'x'.repeat(5000) }, { 'x-forwarded-for': jar });
    expect(besar.status).toBe(413);
    expect((await fetch(`${alamat}/api/usulan`)).status).toBe(405);
  });

  it('paling banyak 5 usulan per jaringan per jam; jaringan lain tetap boleh', async () => {
    const jar = jaringanBaru();
    const sah = (i: number) => ({ nama: 'Budi', judul: `Usulan ${i}`, isi: 'Isinya cukup panjang.' });
    for (let i = 0; i < 5; i++) expect((await post(sah(i), { 'x-forwarded-for': jar })).status).toBe(200);
    const keenam = await post(sah(6), { 'x-forwarded-for': jar });
    expect(keenam.status).toBe(429);
    expect(((await keenam.json()) as { error: string }).error).toBe('Dari jaringanmu sudah masuk 5 usulan dalam sejam. Coba lagi nanti, Bos.');
    expect((await post(sah(7), { 'x-forwarded-for': jaringanBaru() })).status).toBe(200);
  });

  it('permintaan bersamaan dari satu jaringan tetap paling banyak 5 yang masuk', async () => {
    const jar = jaringanBaru();
    const sah = (i: number) => ({ nama: 'Budi', judul: `Bareng ${i}`, isi: 'Isinya cukup panjang.' });
    const status = await Promise.all(Array.from({ length: 8 }, (_, i) => post(sah(i), { 'x-forwarded-for': jar }).then((r) => r.status)));
    expect(status.filter((x) => x === 200)).toHaveLength(5);
    expect(status.filter((x) => x === 429)).toHaveLength(3);
  });

  it('batas total per 24 jam (di test ini 20)', async () => {
    const sah = { nama: 'Ani', judul: 'Judul', isi: 'Isinya cukup panjang.' };
    for (let i = riwayat.usulan.jumlahSejak(0); i < 20; i++) expect((await post(sah, { 'x-forwarded-for': jaringanBaru() })).status).toBe(200);
    const r = await post(sah, { 'x-forwarded-for': jaringanBaru() });
    expect(r.status).toBe(429);
    expect(((await r.json()) as { error: string }).error).toBe('Hari ini usulan yang masuk sudah banyak. Coba lagi besok, Bos.');
  });

  it('server tanpa database: 503', async () => {
    const s = await jalankanServer({ port: 0, host: '127.0.0.1', log: () => undefined });
    const r = await fetch(`http://127.0.0.1:${s.port}/api/usulan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(503);
    await s.tutup();
  });
});

describe('server dengan Notion', () => {
  it('usulan langsung diteruskan ke Notion; log tanpa token dan tanpa isi; tutup membersihkan timer', async () => {
    const riwayat = bukaRiwayat(':memory:');
    const jam = jamPalsu(Date.now());
    const kiriman: { header: Record<string, string>; isi: { parent: unknown; properties: Record<string, unknown> } }[] = [];
    const fetchPalsu = (async (_url: string, init: RequestInit) => {
      kiriman.push({ header: init.headers as Record<string, string>, isi: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ object: 'page', id: `halaman-${kiriman.length}` }), { status: 200 });
    }) as unknown as typeof fetch;
    const log: string[] = [];
    const s = await jalankanServer({
      port: 0,
      host: '127.0.0.1',
      riwayat,
      log: (...x) => log.push(x.map(String).join(' ')),
      notion: { token: TOKEN, database: DB_NOTION, fetch: fetchPalsu, penjadwal: jam },
    });
    // Putaran kirim ulang terjadwal.
    expect(jam.aktif()).toBe(1);
    const r = await fetch(`http://127.0.0.1:${s.port}/api/usulan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nama: 'Ani', judul: 'Mode turnamen', isi: 'Isi rahasia yang panjang sekali.', jenis: 'Aturan main' }),
    });
    expect(r.status).toBe(200);
    for (let i = 0; i < 50 && !kiriman.length; i++) await new Promise((ok) => setTimeout(ok, 10));
    await tunggu();
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0]!.header.authorization).toBe(`Bearer ${TOKEN}`);
    expect(kiriman[0]!.isi.parent).toEqual({ database_id: DB_NOTION });
    expect(kiriman[0]!.isi.properties).toMatchObject({ Jenis: { select: { name: 'Aturan main' } }, Sumber: { select: { name: 'Game' } }, Pengusul: { rich_text: [{ text: { content: 'Ani' } }] } });
    expect(riwayat.usulan.ambil(1)).toMatchObject({ notionHalaman: 'halaman-1' });
    expect(log).toContain('usulan #1 masuk');
    expect(log).toContain('usulan #1 terkirim ke Notion');
    const semuaLog = log.join('\n');
    expect(semuaLog).not.toContain(TOKEN);
    expect(semuaLog).not.toContain('Isi rahasia');

    await s.tutup();
    expect(jam.aktif()).toBe(0);
    riwayat.tutup();
  });
});
