// Kompetisi di server (keputusan pemilik #51, versi 2 24 Okt 2026): penyimpan SQLite (pengajuan, ikut
// serta, mulai otomatis, batal, voting tutup, nilai per permainan, klasemen rata-rata, juara yang
// ditunda sampai meja terakhir selesai, piala), perbaikan skema pra-rilis, API HTTP (termasuk daftar
// meja yang menunggu dan piala di leaderboard v2), dan meja kompetisi lewat WebSocket (wajib tiket,
// mulai sendiri saat penuh, tidak masuk daftar publik, pesan kompetisiHasil, lobi dibubarkan saat
// kompetisi disudahi).

import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import {
  BATAS_PENGAJUAN_MS,
  TEKS_LOBI_KOMPETISI_BUBAR,
  type InfoMeja,
  type PesanKlien,
  type PesanServer,
  type RingkasanAkhir,
} from '@remi/meja';
import type { DetailKompetisi, RingkasanKompetisi } from '../src/kompetisi.js';
import { bukaRiwayat, type PapanPeringkat, type PenyimpanRiwayat } from '../src/riwayat.js';
import { jalankanServer, type ServerRemi } from '../src/server.js';

const JAM = 60 * 60 * 1000;
// Jauh di masa lalu: kompetisi di jam ini sudah lama selesai menurut jam sungguhan (tes meja WebSocket).
const T0 = Date.UTC(2025, 0, 10, 12);

const ajukan = (r: PenyimpanRiwayat, extra: Record<string, unknown> = {}, t = T0) =>
  r.kompetisi.ajukan({ nama: 'Remi Jumat', masa: 'minggu', pengaturan: { batasPutaran: 5 }, namaPengaju: 'Ani', ...extra }, t);

/** Kompetisi yang sudah jalan: Ani (pengaju), Budi, Cici, Dodi. */
function kompetisiJalan(r: PenyimpanRiwayat, t = T0, extra: Record<string, unknown> = {}) {
  const { kode, token } = ajukan(r, extra, t);
  const tiket: Record<string, string> = { Ani: token };
  for (const [i, nama] of ['Budi', 'Cici', 'Dodi'].entries()) tiket[nama] = r.kompetisi.ikut(kode, nama, t + (i + 1) * 1000).token;
  const id = (nama: string) => r.kompetisi.cekTiket(kode, tiket[nama])!.id;
  return { kode, tiket, id };
}

/**
 * Klasemen akhir satu permainan meja kompetisi: [nama, id peserta, skor, keluar?]. `mulaiPada` kosong =
 * sama dengan selesaiPada.
 */
const ringkasan = (kompetisi: string, selesaiPada: number, pemain: [string, number, number, boolean?][], mulaiPada = selesaiPada): RingkasanAkhir => {
  const urut = pemain.map(([nama, peserta, skor, keluar], kursi) => ({
    kursi,
    nama,
    bot: false,
    ...(keluar ? { keluar: true as const } : {}),
    skor,
    peringkat: 0,
    mentung: 0,
    kepentung: 0,
    peserta,
  }));
  return { kode: 'MEJAA', selesaiPada, alasan: 'batasPutaran', jumlahPutaran: 5, jumlahDeck: 1, modeKaldu: false, kompetisi, mulaiPada, pemain: urut };
};

/** Keadaan meja palsu untuk penyimpan: sekian meja kompetisi sedang main. */
const meja = (main: number) => ({ mejaMain: () => main, mejaMenunggu: () => [] });

describe('penyimpan kompetisi', () => {
  it('pengajuan jalan sendiri begitu peserta ke-4 ikut; masa berlaku dihitung dari situ', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, token } = ajukan(r);
    expect(kode).toMatch(/^[A-Z2-9]{5}$/);
    expect(r.kompetisi.detail(kode, T0, token)).toMatchObject({
      status: 'pengajuan',
      peserta: ['Ani'],
      jumlahPeserta: 1,
      minPeserta: 4,
      minMain: 3,
      pengaturan: { batasPutaran: 5, jumlahPemain: 4 },
      saya: { nama: 'Ani', setujuTutup: false },
      mejaMain: 0,
      meja: [],
      disudahi: false,
    });
    r.kompetisi.ikut(kode, 'Budi', T0 + 1);
    r.kompetisi.ikut(kode, 'Cici', T0 + 2);
    expect(r.kompetisi.status(kode, T0 + 3)).toBe('pengajuan');
    r.kompetisi.ikut(kode, 'Dodi', T0 + JAM);
    const d = r.kompetisi.detail(kode, T0 + JAM)!;
    expect(d).toMatchObject({ status: 'berjalan', mulaiPada: T0 + JAM, berakhirPada: T0 + JAM + 7 * 24 * JAM, jumlahPeserta: 4 });
    expect(d.saya).toBeUndefined();
    // Ikut serta sesudah jalan tetap boleh.
    r.kompetisi.ikut(kode, 'Eko', T0 + 2 * JAM);
    expect(r.kompetisi.detail(kode, T0 + 2 * JAM)!.peserta).toEqual(['Ani', 'Budi', 'Cici', 'Dodi', 'Eko']);
    expect(r.kompetisi.status(kode, T0 + JAM + 7 * 24 * JAM)).toBe('selesai');
    expect(() => r.kompetisi.ikut(kode, 'Fafa', T0 + JAM + 7 * 24 * JAM)).toThrow(/sudah selesai/);
    r.tutup();
  });

  it('pengaturan: jumlah pemain dan batas putaran ditetapkan saat pengajuan, yang rusak jatuh ke bawaan', () => {
    const r = bukaRiwayat(':memory:');
    const a = ajukan(r, { pengaturan: { jumlahPemain: 6, batasPutaran: 10, duaDeckUntukEmpat: true } });
    expect(r.kompetisi.untukMeja(a.kode, T0)!.pengaturan).toMatchObject({ jumlahPemain: 6, batasPutaran: 10, duaDeckUntukEmpat: false });
    const b = ajukan(r, { pengaturan: { jumlahPemain: 9, batasPutaran: null } });
    expect(r.kompetisi.untukMeja(b.kode, T0)!.pengaturan).toMatchObject({ jumlahPemain: 4, batasPutaran: 5 });
    r.tutup();
  });

  it('nama kembar (tanpa beda huruf besar/kecil) ditolak; isian rusak ditolak', () => {
    const r = bukaRiwayat(':memory:');
    const { kode } = ajukan(r);
    expect(() => r.kompetisi.ikut(kode, ' ani ', T0)).toThrow(/sudah ikut kompetisi ini/);
    expect(() => r.kompetisi.ikut(kode, '', T0)).toThrow(/Isi namamu/);
    expect(() => r.kompetisi.ikut('ZZZZZ', 'Budi', T0)).toThrow(/nggak ketemu/);
    expect(() => ajukan(r, { nama: '   ' })).toThrow(/nama kompetisinya/);
    expect(() => ajukan(r, { masa: 'tahun' })).toThrow(/lama kompetisinya/);
    r.tutup();
  });

  it('pengajuan yang 24 jam belum cukup peserta batal, tidak bisa diikuti, dan hilang dari daftar', () => {
    const r = bukaRiwayat(':memory:');
    const { kode } = ajukan(r);
    expect(r.kompetisi.daftar(T0).map((k) => k.kode)).toEqual([kode]);
    expect(r.kompetisi.jumlahPengajuan(T0)).toBe(1);
    const lewat = T0 + BATAS_PENGAJUAN_MS;
    expect(r.kompetisi.status(kode, lewat)).toBe('batal');
    expect(() => r.kompetisi.ikut(kode, 'Budi', lewat)).toThrow(/batal/);
    expect(r.kompetisi.daftar(lewat)).toEqual([]);
    expect(r.kompetisi.jumlahPengajuan(lewat)).toBe(0);
    r.tutup();
  });

  it('tiket: hanya token peserta kompetisi itu yang cocok', () => {
    const r = bukaRiwayat(':memory:');
    const a = kompetisiJalan(r);
    const b = ajukan(r, { namaPengaju: 'Budi' });
    expect(r.kompetisi.cekTiket(a.kode, a.tiket.Budi)).toMatchObject({ nama: 'Budi' });
    expect(r.kompetisi.cekTiket(a.kode.toLowerCase(), a.tiket.Budi)).toMatchObject({ nama: 'Budi' });
    expect(r.kompetisi.cekTiket(a.kode, b.token)).toBeNull();
    expect(r.kompetisi.cekTiket(a.kode, 'palsu')).toBeNull();
    expect(r.kompetisi.cekTiket(a.kode, '')).toBeNull();
    r.tutup();
  });

  it('hasil meja kompetisi dicatat lewat riwayat.simpan: nilai 0–10, klasemen rata-rata', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, id } = kompetisiJalan(r);
    const t = T0 + JAM;
    for (let i = 0; i < 3; i++) {
      r.simpan(ringkasan(kode, t + i, [['Ani', id('Ani'), 100], ['Budi', id('Budi'), 50], ['Cici', id('Cici'), -20], ['Dodi', id('Dodi'), -130]]));
    }
    // Meja 3 orang, Dodi keluar (0 walau skornya tinggi). Yang keluar tidak dihitung dikalahkan
    // (keputusan 24 Okt 2026): Budi dan Cici hanya saling dibandingkan, Budi 10, Cici 0.
    const idMain = r.simpan(ringkasan(kode, t + 3, [['Budi', id('Budi'), 80], ['Dodi', id('Dodi'), 300, true], ['Cici', id('Cici'), 0]]));
    expect(r.kompetisi.jumlahHasil(idMain)).toBe(3);
    const d = r.kompetisi.detail(kode, t + 4)!;
    expect(d.jumlahPermainan).toBe(4);
    expect(d.peringkat.map((b) => [b.nama, b.main, b.rataNilai, b.peringkat, b.juara])).toEqual([
      ['Ani', 3, 10, 1, 3],
      ['Budi', 4, 7.5, 2, 1],
      ['Cici', 4, 2.5, 3, 0],
      ['Dodi', 4, 0, 4, 0],
    ]);
    expect(d.peringkat[3]).toMatchObject({ keluar: 1, piala: 0 });
    // Skor yang keluar = skor terendah di meja itu (seperti leaderboard #45).
    expect(d.peringkat[3].rataSkor).toBe((-130 * 3 + 0) / 4);
    expect(r.kompetisi.klasemen(kode)!.peringkat.map((b) => b.nama)).toEqual(['Ani', 'Budi', 'Cici', 'Dodi']);
    // Permainan tetap masuk riwayat biasa.
    expect(r.daftar(10)).toHaveLength(4);
    r.tutup();
  });

  it('yang keluar tak dihitung: tinggal satu (atau nol) yang bertahan = tidak dicatat untuk yang bertahan, yang keluar tetap 0', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, id } = kompetisiJalan(r);
    const t = T0 + JAM;
    const empat = (keluar: string[]): [string, number, number, boolean?][] =>
      ([['Ani', 100], ['Budi', 50], ['Cici', -20], ['Dodi', -130]] as const).map(([nama, skor]) => [nama, id(nama), skor, keluar.includes(nama)]);
    const satu = r.simpan(ringkasan(kode, t + 1, empat(['Ani'])));
    const dua = r.simpan(ringkasan(kode, t + 2, empat(['Ani', 'Budi'])));
    const tiga = r.simpan(ringkasan(kode, t + 3, empat(['Ani', 'Budi', 'Cici'])));
    const semua = r.simpan(ringkasan(kode, t + 4, empat(['Ani', 'Budi', 'Cici', 'Dodi'])));
    // Meja 2 orang yang satunya keluar.
    const berdua = r.simpan(ringkasan(kode, t + 5, [['Ani', id('Ani'), -500], ['Budi', id('Budi'), 0, true]]));
    // Yang keluar selalu dicatat (keputusan pemilik 24 Okt 2026); yang bertahan sendirian tidak.
    expect([satu, dua, tiga, semua, berdua].map((x) => r.kompetisi.jumlahHasil(x))).toEqual([4, 4, 3, 4, 1]);
    // Permainan yang tidak dihitung tetap masuk riwayat biasa.
    expect(r.daftar(10)).toHaveLength(5);
    const d = r.kompetisi.detail(kode, t + 6)!;
    expect(d.jumlahPermainan).toBe(5);
    // 1 keluar: Budi 10 (2 dari 2), Cici 5, Dodi 0. 2 keluar: Cici 10, Dodi 0. Yang keluar 0, juga di
    // permainan "tiga", "semua", dan "berdua"; Dodi (tiga) dan Ani (berdua) yang bertahan sendirian
    // tidak dicatat.
    const nilai = Object.fromEntries([...d.peringkat, ...d.belumCukup].map((b) => [b.nama, [b.main, b.totalNilai, b.keluar]]));
    expect(nilai).toEqual({ Ani: [4, 0, 4], Budi: [5, 10, 4], Cici: [4, 15, 2], Dodi: [3, 0, 1] });
    r.tutup();
  });

  it('dihitung kalau dimulai sebelum kompetisi berakhir, walau selesai sesudahnya', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, id } = kompetisiJalan(r);
    const akhir = r.kompetisi.detail(kode, T0)!.berakhirPada!;
    const duaOrang = (skorAni: number): [string, number, number][] => [['Ani', id('Ani'), skorAni], ['Budi', id('Budi'), -skorAni]];
    // Mulai 1 menit sebelum berakhir, selesai 20 menit sesudahnya: dihitung.
    const a = r.simpan(ringkasan(kode, akhir + 20 * 60_000, duaOrang(10), akhir - 60_000));
    // Mulai tepat saat berakhir: tidak dihitung.
    const b = r.simpan(ringkasan(kode, akhir + 30 * 60_000, duaOrang(20), akhir));
    // Mulai sebelum kompetisi jalan: tidak dihitung.
    const c = r.simpan(ringkasan(kode, T0 + 4000, duaOrang(30), T0 - 1));
    expect([a, b, c].map((x) => r.kompetisi.jumlahHasil(x))).toEqual([2, 0, 0]);
    expect(r.kompetisi.detail(kode, akhir + JAM)!.jumlahPermainan).toBe(1);
    r.tutup();
  });

  it('juara ditunda selama masih ada meja kompetisi yang main; sesudah ditetapkan tidak berubah lagi', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, id, tiket } = kompetisiJalan(r);
    const t = T0 + JAM;
    for (let i = 0; i < 3; i++) r.simpan(ringkasan(kode, t + i, [['Ani', id('Ani'), 50], ['Budi', id('Budi'), -50]]));
    // Disudahi lewat voting.
    for (const nama of ['Ani', 'Budi', 'Cici']) r.kompetisi.setujuTutup(kode, tiket[nama], true, t + 10);
    const tunggu = r.kompetisi.detail(kode, t + 20, null, meja(2))!;
    expect(tunggu).toMatchObject({ status: 'selesai', disudahi: true, mejaMain: 2, berakhirPada: t + 10 });
    expect(tunggu.juara).toBeUndefined();
    expect(r.kompetisi.daftar(t + 20, meja(1))[0]).toMatchObject({ kode, status: 'selesai', mejaMain: 1 });
    expect(r.kompetisi.daftar(t + 20, meja(1))[0].juara).toBeUndefined();
    expect(r.kompetisi.tetapkanJuara(t + 20, meja(1))).toEqual([]);
    expect(r.kompetisi.piala().size).toBe(0);

    // Meja terakhir selesai (dimulai sebelum disudahi): masih dihitung, Budi menyusul.
    for (let i = 0; i < 3; i++) r.simpan(ringkasan(kode, t + 30 + i, [['Budi', id('Budi'), 50], ['Ani', id('Ani'), -50]], t + 5));
    expect(r.kompetisi.tetapkanJuara(t + 40, meja(0))).toEqual([kode]);
    expect(r.kompetisi.tetapkanJuara(t + 41, meja(0))).toEqual([]);
    const d = r.kompetisi.detail(kode, t + 50, null, meja(0))!;
    // Ani dan Budi sama-sama 10, 10, 10, 0, 0, 0 dari 6 main; rata-rata skor juga sama (0): juara berdua.
    expect(d.peringkat.map((b) => [b.nama, b.peringkat, b.piala])).toEqual([
      ['Ani', 1, 1],
      ['Budi', 1, 1],
    ]);
    expect(d).toMatchObject({ juara: ['Ani', 'Budi'], pialaJuara: [1, 1], mejaMain: 0 });
    // Juara sudah ditetapkan: hasil yang datang belakangan tidak dicatat lagi.
    const telat = r.simpan(ringkasan(kode, t + 60, [['Ani', id('Ani'), 99], ['Budi', id('Budi'), -99]], t + 1));
    expect(r.kompetisi.jumlahHasil(telat)).toBe(0);
    expect(r.kompetisi.detail(kode, t + 70)!.juara).toEqual(['Ani', 'Budi']);
    r.tutup();
  });

  it('juara ditetapkan sendiri saat detail/daftar dibaca sesudah masa habis tanpa meja yang main', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, id } = kompetisiJalan(r);
    for (let i = 0; i < 3; i++) r.simpan(ringkasan(kode, T0 + JAM + i, [['Cici', id('Cici'), 10], ['Dodi', id('Dodi'), -10]]));
    const habis = T0 + 30 * 24 * JAM;
    const daftar = r.kompetisi.daftar(habis);
    expect(daftar[0]).toMatchObject({ kode, status: 'selesai', juara: ['Cici'], pialaJuara: [1], disudahi: false, mejaMain: 0 });
    expect([...r.kompetisi.piala()]).toEqual([['cici', 1]]);
    r.tutup();
  });

  it('piala dihitung lintas kompetisi lewat nama tanpa beda huruf besar/kecil, dan muncul di leaderboard v2', () => {
    const r = bukaRiwayat(':memory:');
    const satu = kompetisiJalan(r);
    for (let i = 0; i < 3; i++) r.simpan(ringkasan(satu.kode, T0 + JAM + i, [['Ani', satu.id('Ani'), 10], ['Budi', satu.id('Budi'), -10]]));
    const dua = kompetisiJalan(r, T0 + 1000, { namaPengaju: 'ANI' });
    for (let i = 0; i < 3; i++) r.simpan(ringkasan(dua.kode, T0 + JAM + 10 + i, [['ANI', dua.id('Ani'), 10], ['Budi', dua.id('Budi'), -10]]));
    const habis = T0 + 30 * 24 * JAM;
    expect(r.kompetisi.tetapkanJuara(habis).sort()).toEqual([satu.kode, dua.kode].sort());
    const d = r.kompetisi.detail(dua.kode, habis)!;
    expect(d).toMatchObject({ juara: ['ANI'], pialaJuara: [2] });
    expect(d.peringkat.find((b) => b.nama === 'ANI')?.piala).toBe(2);
    expect(d.peringkat.find((b) => b.nama === 'Budi')?.piala).toBe(0);
    const papan = r.papan();
    expect(papan.peringkat.map((b) => [b.nama, b.piala])).toEqual([
      ['ANI', 2],
      ['Budi', undefined],
    ]);
    expect('piala' in papan.peringkat[1]).toBe(false);
    // Bentuk lama tanpa v=2 tidak berubah.
    expect(r.peringkat().every((b) => !('piala' in b))).toBe(true);
    r.tutup();
  });

  it('voting tutup: lebih dari separuh peserta setuju, kompetisi selesai saat itu juga', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, tiket } = kompetisiJalan(r);
    const t = T0 + JAM;
    r.kompetisi.setujuTutup(kode, tiket.Ani, true, t);
    r.kompetisi.setujuTutup(kode, tiket.Budi, true, t);
    expect(r.kompetisi.detail(kode, t, tiket.Ani)).toMatchObject({ status: 'berjalan', setujuTutup: 2, saya: { setujuTutup: true } });
    // Batal setuju lalu setuju lagi tidak dihitung dobel.
    r.kompetisi.setujuTutup(kode, tiket.Budi, false, t);
    r.kompetisi.setujuTutup(kode, tiket.Budi, true, t);
    expect(r.kompetisi.status(kode, t)).toBe('berjalan');
    r.kompetisi.setujuTutup(kode, tiket.Cici, true, t + 5);
    expect(r.kompetisi.detail(kode, t + 10)).toMatchObject({ status: 'selesai', berakhirPada: t + 5, disudahi: true });
    expect(() => r.kompetisi.setujuTutup(kode, tiket.Dodi, true, t + 10)).toThrow(/sedang jalan/);
    expect(() => r.kompetisi.setujuTutup(kode, 'palsu', true, t)).toThrow(/belum ikut/);
    r.tutup();
  });

  it('pengajuan belum bisa disudahi lewat voting', () => {
    const r = bukaRiwayat(':memory:');
    const { kode, token } = ajukan(r);
    expect(() => r.kompetisi.setujuTutup(kode, token, true, T0)).toThrow(/sedang jalan/);
    r.tutup();
  });
});

describe('skema kompetisi pra-rilis (versi 1)', () => {
  it('tabel kompetisi lama dibuang dan dibuat ulang; tabel lain tidak disentuh', () => {
    const db = new DatabaseSync(':memory:');
    // Database server dev yang sempat menjalankan kompetisi versi 1 (hasil_kompetisi.poin, tanpa juara_pada).
    const r0 = bukaRiwayat(db);
    r0.usulan.simpan({ nama: 'Budi', judul: 'Tes', isi: 'Isi usulan', jenis: null }, 1);
    r0.mejaAktif.simpan('MEJAA', '{}', null, 1);
    db.exec(`DROP TABLE hasil_kompetisi; DROP TABLE juara_kompetisi; DROP TABLE peserta_kompetisi; DROP TABLE kompetisi;
      CREATE TABLE kompetisi (kode TEXT PRIMARY KEY, nama TEXT NOT NULL, masa TEXT NOT NULL, pengaturan TEXT NOT NULL,
        diajukan_pada INTEGER NOT NULL, mulai_pada INTEGER, berakhir_pada INTEGER, ditutup_pada INTEGER);
      CREATE TABLE peserta_kompetisi (id INTEGER PRIMARY KEY AUTOINCREMENT, kompetisi TEXT NOT NULL REFERENCES kompetisi(kode) ON DELETE CASCADE,
        nama TEXT NOT NULL, kunci_nama TEXT NOT NULL, hash_token TEXT NOT NULL, ikut_pada INTEGER NOT NULL,
        setuju_tutup INTEGER NOT NULL DEFAULT 0, UNIQUE (kompetisi, kunci_nama));
      CREATE TABLE hasil_kompetisi (permainan_id INTEGER NOT NULL REFERENCES permainan(id) ON DELETE CASCADE,
        peserta_id INTEGER NOT NULL REFERENCES peserta_kompetisi(id) ON DELETE CASCADE, poin INTEGER NOT NULL,
        skor INTEGER NOT NULL, juara INTEGER NOT NULL, keluar INTEGER NOT NULL, PRIMARY KEY (permainan_id, peserta_id));
      INSERT INTO kompetisi (kode, nama, masa, pengaturan, diajukan_pada) VALUES ('LAMAA', 'Lama', 'malam', '{}', 1);`);
    const log: string[] = [];
    const r = bukaRiwayat(db, { log: (...x) => log.push(x.join(' ')) });
    expect(log.some((l) => l.includes('skema kompetisi pra-rilis'))).toBe(true);
    const kolom = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((k) => k.name);
    expect(kolom('hasil_kompetisi')).toEqual(['permainan_id', 'peserta_id', 'dikalahkan', 'lawan', 'skor', 'juara', 'keluar']);
    expect(kolom('kompetisi')).toContain('juara_pada');
    expect(r.kompetisi.status('LAMAA', 2)).toBeNull();
    expect(r.mejaAktif.semua().map((b) => b.kode)).toEqual(['MEJAA']);
    expect(Number((db.prepare('SELECT COUNT(*) AS n FROM usulan').get() as { n: number }).n)).toBe(1);
    // Sekali saja: dibuka lagi tidak memperbaiki apa-apa.
    const log2: string[] = [];
    bukaRiwayat(db, { log: (...x) => log2.push(x.join(' ')) });
    expect(log2.some((l) => l.includes('skema kompetisi pra-rilis'))).toBe(false);
    db.close();
  });
});

class Klien {
  pesan: PesanServer[] = [];
  private ws: WebSocket;
  private terbuka: Promise<void>;
  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (d) => this.pesan.push(JSON.parse(d.toString())));
    this.ws.on('error', () => undefined);
    this.terbuka = new Promise((ok) => this.ws.on('open', () => ok()));
  }
  async kirim(p: PesanKlien) {
    await this.terbuka;
    this.ws.send(JSON.stringify(p));
  }
  async tunggu<T extends PesanServer['t']>(
    t: T,
    syarat: (p: Extract<PesanServer, { t: T }>) => boolean = () => true,
    sejak = 0,
    ms = 4000,
  ): Promise<Extract<PesanServer, { t: T }>> {
    const mulai = Date.now();
    for (;;) {
      const p = this.pesan
        .slice(sejak)
        .reverse()
        .find((x) => x.t === t && syarat(x as never));
      if (p) return p as Extract<PesanServer, { t: T }>;
      if (Date.now() - mulai > ms) throw new Error(`tidak menerima ${t}`);
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  /** Tunggu pesan apa saja yang memenuhi syarat, sesudah indeks `sejak`. */
  async tungguApa(syarat: (p: PesanServer) => boolean, sejak: number, ms = 4000): Promise<PesanServer> {
    const mulai = Date.now();
    for (;;) {
      const p = this.pesan.slice(sejak).find(syarat);
      if (p) return p;
      if (Date.now() - mulai > ms) throw new Error('pesan tidak datang');
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  terakhir<T extends PesanServer['t']>(t: T): Extract<PesanServer, { t: T }> | undefined {
    return [...this.pesan].reverse().find((x) => x.t === t) as Extract<PesanServer, { t: T }> | undefined;
  }
  get info(): InfoMeja | undefined {
    return this.terakhir('meja')?.info;
  }
  get view(): ViewPemain | undefined {
    return this.terakhir('view')?.view;
  }
  tutup() {
    this.ws.close();
  }
}

/** Mainkan meja sampai permainan selesai: tiap klien memilih aksinya sendiri (strategi Normal). */
async function mainkanSampaiSelesai(klien: Klien[], rng: Rng) {
  for (let i = 0; i < 5000; i++) {
    if (klien.every((k) => k.view?.status === 'selesai')) return;
    let jalan = false;
    for (const k of klien) {
      const info = k.info;
      const v = k.view;
      if (!info || !v || info.kursiSaya === null) continue;
      const saya = info.kursiSaya;
      const n = k.pesan.length;
      if (v.status === 'putaranBerjalan' && info.menungguJoker.includes(saya)) {
        await k.kirim({ t: 'siapJoker', putaran: v.putaran?.nomor });
        await k.tunggu('meja', () => true, n);
        jalan = true;
        break;
      }
      const bisa =
        v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[saya] : v.status === 'putaranBerjalan' && v.putaran!.giliran === saya;
      if (!bisa || info.menungguJoker.length) continue;
      const { pemain: _, ...aksi } = pilihAksiBot(v, 'normal', rng) as { pemain: number };
      await k.kirim({ t: 'aksi', aksi: aksi as never });
      await k.tungguApa((p) => p.t === 'view' || p.t === 'error', n);
      jalan = true;
      break;
    }
    if (!jalan) await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('permainan tidak selesai');
}

describe('API dan meja kompetisi', () => {
  let server: ServerRemi;
  let riwayat: PenyimpanRiwayat;
  let alamat: string;
  beforeAll(async () => {
    riwayat = bukaRiwayat(':memory:');
    server = await jalankanServer({
      port: 0,
      host: '127.0.0.1',
      riwayat,
      log: () => undefined,
      maksPengajuanPerIp: 2,
      jedaMulaiKompetisiMs: 30,
      jedaLanjutMs: 0,
      jedaBotMs: 5,
      // Klien uji mengirim aksi secepat mungkin: jangan sampai dibuang batas pesan per detik.
      batasPesanPerDetik: 10_000,
      putusPesanPerDetik: 20_000,
    });
    alamat = `http://127.0.0.1:${server.port}`;
  });
  afterAll(async () => {
    await server.tutup();
    riwayat.tutup();
  });

  const post = (jalur: string, isi: unknown, header: Record<string, string> = {}) =>
    fetch(`${alamat}${jalur}`, { method: 'POST', headers: { 'content-type': 'application/json', ...header }, body: JSON.stringify(isi) });
  const detail = async (kode: string, tiket?: string) =>
    (await (await fetch(`${alamat}/api/kompetisi/${kode}`, tiket ? { headers: { 'x-tiket-kompetisi': tiket } } : {})).json()) as DetailKompetisi;

  /** Kompetisi yang berjalan sekarang (jam sungguhan), dengan pengaturan meja tertentu. */
  const kompetisiSekarang = (pengaturan: Record<string, unknown>) => {
    const sekarang = Date.now();
    const a = riwayat.kompetisi.ajukan({ nama: 'Meja Uji', masa: 'malam', pengaturan, namaPengaju: 'Ani' }, sekarang);
    const tiket: Record<string, string> = { Ani: a.token };
    for (const nama of ['Budi', 'Cici', 'Dodi']) tiket[nama] = riwayat.kompetisi.ikut(a.kode, nama, sekarang).token;
    expect(riwayat.kompetisi.status(a.kode, Date.now())).toBe('berjalan');
    return { kode: a.kode, tiket, id: (nama: string) => riwayat.kompetisi.cekTiket(a.kode, tiket[nama])!.id };
  };

  it('ajukan, ikut serta sampai jalan, detail dengan tiket, daftar', async () => {
    const r1 = await post('/api/kompetisi', { nama: 'Malam Minggu', masa: 'malam', pengaturan: { modeKaldu: true, jumlahPemain: 3 }, namaPengaju: 'Ani' });
    expect(r1.status).toBe(200);
    const a = (await r1.json()) as { kode: string; token: string; detail: { status: string; saya: { nama: string } } };
    expect(a.detail).toMatchObject({ status: 'pengajuan', saya: { nama: 'Ani' } });
    for (const nama of ['Budi', 'Cici']) expect((await post(`/api/kompetisi/${a.kode}/ikut`, { nama })).status).toBe(200);
    const kembar = await post(`/api/kompetisi/${a.kode}/ikut`, { nama: 'budi' });
    expect(kembar.status).toBe(409);
    expect(((await kembar.json()) as { error: string }).error).toMatch(/sudah ikut/);
    const r4 = await post(`/api/kompetisi/${a.kode.toLowerCase()}/ikut`, { nama: 'Dodi' });
    expect(((await r4.json()) as { detail: { status: string } }).detail.status).toBe('berjalan');

    expect(await detail(a.kode, a.token)).toMatchObject({
      v: 1,
      status: 'berjalan',
      pengaturan: { modeKaldu: true, jumlahPemain: 3, batasPutaran: 5 },
      saya: { nama: 'Ani' },
      meja: [],
      mejaMain: 0,
    });
    expect((await detail(a.kode)).saya).toBeUndefined();
    const daftar = (await (await fetch(`${alamat}/api/kompetisi`)).json()) as { v: number; kompetisi: RingkasanKompetisi[] };
    expect(daftar.kompetisi.find((k) => k.kode === a.kode)).toMatchObject({ status: 'berjalan', mejaMain: 0, disudahi: false });
    expect((await fetch(`${alamat}/api/kompetisi/ZZZZZ`)).status).toBe(404);
    expect((await fetch(`${alamat}/api/kompetisi/x/y/z`)).status).toBe(404);
  });

  it('POST ditolak tanpa JSON, dari asal lain, isi rusak, atau kebanyakan pengajuan', async () => {
    const bukanJson = await fetch(`${alamat}/api/kompetisi`, { method: 'POST', body: 'nama=x' });
    expect(bukanJson.status).toBe(403);
    expect((await post('/api/kompetisi', {}, { origin: 'https://jahat.example' })).status).toBe(403);
    const rusak = await fetch(`${alamat}/api/kompetisi`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(rusak.status).toBe(400);
    expect((await post('/api/kompetisi', { nama: 'x', masa: 'abad', namaPengaju: 'Ani' })).status).toBe(400);
    // Satu pengajuan dari tes sebelumnya sudah jalan, jadi tidak dihitung; batas di tes ini 2.
    expect((await post('/api/kompetisi', { nama: 'A', masa: 'malam', namaPengaju: 'Ani' })).status).toBe(200);
    expect((await post('/api/kompetisi', { nama: 'B', masa: 'malam', namaPengaju: 'Ani' })).status).toBe(200);
    const ketiga = await post('/api/kompetisi', { nama: 'C', masa: 'malam', namaPengaju: 'Ani' });
    expect(ketiga.status).toBe(429);
  });

  it('meja kompetisi: pembuat dan yang gabung wajib peserta, nama kursi = nama terdaftar, jumlah pemain dari kompetisi', async () => {
    const lama = kompetisiJalan(riwayat);
    const { kode, tiket } = kompetisiSekarang({ batasPutaran: 2 });

    const tamu = new Klien(server.port);
    await tamu.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode, token: 'palsu' } });
    expect((await tamu.tunggu('error')).pesan).toMatch(/belum ikut kompetisi/);
    // Kompetisi yang sudah selesai (kompetisiJalan di jam T0, masa 1 minggu) tidak bisa dipakai.
    await tamu.kirim({ t: 'buat', nama: 'Budi', kompetisi: { kode: lama.kode, token: lama.tiket.Budi } });
    expect((await tamu.tunggu('error', (p) => /sudah selesai/.test(p.pesan))).pesan).toMatch(/sudah selesai/);

    const ani = new Klien(server.port);
    await ani.kirim({ t: 'buat', nama: 'Nama Lain', pengaturan: { jumlahPemain: 2, batasPutaran: 9 }, kompetisi: { kode, token: tiket.Ani } });
    const masuk = await ani.tunggu('masuk');
    const info = (await ani.tunggu('meja')).info;
    expect(info.kompetisi).toEqual({ kode, nama: 'Meja Uji' });
    expect(info.kursi[0].nama).toBe('Ani');
    expect(info.kursi).toHaveLength(4);
    expect(info.pengaturan).toMatchObject({ batasPutaran: 2, jumlahPemain: 4 });

    await tamu.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Tamu' });
    expect((await tamu.tunggu('error', (p) => /khusus peserta/.test(p.pesan))).pesan).toMatch(/Ikut serta dulu/);
    const budi = new Klien(server.port);
    await budi.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Siapa', tiket: [{ kode: 'QQQQQ', token: 'x' }, { kode, token: tiket.Budi }] });
    expect((await budi.tunggu('masuk')).kursi).toBe(1);
    await ani.tunggu('meja', (p) => p.info.kursi[1].nama === 'Budi');
    for (const k of [tamu, ani, budi]) k.tutup();
  });

  it('daftar meja yang menunggu, tidak masuk daftar publik, mulai sendiri saat penuh, kompetisiHasil, tanpa Main lagi', async () => {
    const { kode, tiket } = kompetisiSekarang({ jumlahPemain: 2, batasPutaran: 1, detikGiliran: 0 });
    const ani = new Klien(server.port);
    await ani.kirim({ t: 'buat', nama: 'Ani', pengaturan: { publik: true }, kompetisi: { kode, token: tiket.Ani } });
    const masuk = await ani.tunggu('masuk');
    const d1 = await detail(kode, tiket.Budi);
    expect(d1.meja).toEqual([{ kode: masuk.kode, nama: 'Ani', terisi: 1, jumlahPemain: 2, pemain: ['Ani'] }]);
    expect(d1.mejaMain).toBe(0);
    // Meja kompetisi tidak pernah masuk daftar meja publik.
    const pengintip = new Klien(server.port);
    await pengintip.kirim({ t: 'daftar' });
    expect((await pengintip.tunggu('daftar')).meja.map((m) => m.kode)).not.toContain(masuk.kode);

    const budi = new Klien(server.port);
    await budi.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', tiket: [{ kode, token: tiket.Budi }] });
    const masukBudi = await budi.tunggu('masuk');
    // Penuh: hitung mundur, lalu mulai sendiri.
    expect((await ani.tunggu('meja', (p) => !!p.info.mulaiOtomatis)).info.mulaiOtomatis!.sisaMs).toBeLessThanOrEqual(30);
    await ani.tunggu('meja', (p) => p.info.status === 'main');
    const d2 = await detail(kode);
    expect(d2.meja).toEqual([]);
    expect(d2.mejaMain).toBe(1);
    // Tombol Mulai tidak ada di meja kompetisi.
    await ani.kirim({ t: 'mulai' });
    expect((await ani.tunggu('error', (p) => /sudah berjalan/.test(p.pesan))).pesan).toBeTruthy();

    await mainkanSampaiSelesai([ani, budi], new Rng(11));
    const hasilAni = await ani.tunggu('kompetisiHasil');
    const hasilBudi = await budi.tunggu('kompetisiHasil');
    expect(hasilBudi).toEqual(hasilAni);
    expect(hasilAni).toMatchObject({ kompetisi: { kode, nama: 'Meja Uji' }, minMain: 3, jumlahPeringkat: 0 });
    expect(hasilAni.pemain.map((p) => [p.kursi, p.nama, p.main, p.peringkatSebelum, p.peringkatSesudah])).toEqual([
      [0, 'Ani', 1, null, null],
      [1, 'Budi', 1, null, null],
    ]);
    // Meja 2 orang: 10 dan 0, atau 0 dan 0 kalau skornya sama.
    const nilai = hasilAni.pemain.map((p) => p.nilai).sort();
    expect([[0, 10], [0, 0]]).toContainEqual(nilai);
    expect(hasilAni.pemain.every((p) => p.rataNilai === p.nilai)).toBe(true);
    expect((await detail(kode)).jumlahPermainan).toBe(1);

    // Main lagi ditolak; kembali ke kompetisi = keluar dari meja.
    await ani.kirim({ t: 'mainLagi' });
    expect((await ani.tunggu('error', (p) => /cuma sekali main/.test(p.pesan))).pesan).toMatch(/Kembali ke kompetisi/);
    // Tersambung kembali selagi klasemen akhir tampil: kompetisiHasil dikirim lagi.
    budi.tutup();
    const budi2 = new Klien(server.port);
    await budi2.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', token: masukBudi.token });
    expect(await budi2.tunggu('kompetisiHasil')).toEqual(hasilAni);
    for (const k of [ani, budi2, pengintip]) k.tutup();
  });

  it('yang bertahan tinggal satu: tidak dihitung untuk yang bertahan, yang keluar dicatat 0, kompetisiHasil dengan tidakDihitung', async () => {
    const { kode, tiket } = kompetisiSekarang({ jumlahPemain: 2, batasPutaran: 1 });
    const ani = new Klien(server.port);
    await ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode, token: tiket.Ani } });
    const masuk = await ani.tunggu('masuk');
    const budi = new Klien(server.port);
    await budi.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', tiket: [{ kode, token: tiket.Budi }] });
    await ani.tunggu('meja', (p) => p.info.status === 'main');
    // Budi langsung keluar: kursinya diteruskan warga kedai, Ani main sendirian melawannya.
    await budi.kirim({ t: 'keluar' });
    await budi.tunggu('keluar');
    await ani.tunggu('meja', (p) => p.info.kursi[1].jenis === 'bot');
    await mainkanSampaiSelesai([ani], new Rng(3));
    const hasil = await ani.tunggu('kompetisiHasil');
    expect(hasil).toEqual({
      t: 'kompetisiHasil',
      kompetisi: { kode, nama: 'Meja Uji' },
      minMain: 3,
      jumlahPeringkat: 0,
      pemain: [],
      tidakDihitung: 'keluar',
    });
    // Yang keluar selalu dicatat 0 dan 1× main (keputusan pemilik 24 Okt 2026); Ani tidak dicatat.
    const d = await detail(kode);
    expect(d.jumlahPermainan).toBe(1);
    const baris = [...d.peringkat, ...d.belumCukup];
    expect(baris.find((b) => b.nama === 'Budi')).toMatchObject({ main: 1, keluar: 1, rataNilai: 0 });
    expect(baris.find((b) => b.nama === 'Ani')).toMatchObject({ main: 0 });
    // Tersambung kembali selagi klasemen akhir tampil: kabar yang sama dikirim lagi.
    ani.tutup();
    const ani2 = new Klien(server.port);
    await ani2.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Ani', token: masuk.token });
    expect(await ani2.tunggu('kompetisiHasil')).toEqual(hasil);
    for (const k of [ani2, budi]) k.tutup();
  });

  it('disudahi selagi ada meja yang main: lobi dibubarkan, juara menunggu meja terakhir, lalu piala di leaderboard', async () => {
    const { kode, tiket, id } = kompetisiSekarang({ jumlahPemain: 2, batasPutaran: 1, detikGiliran: 0 });
    // Dua permainan sebelumnya: Ani menang dua kali (Ani pasti juara sesudah permainan ketiga).
    for (let i = 0; i < 2; i++) riwayat.simpan(ringkasan(kode, Date.now(), [['Ani', id('Ani'), 30], ['Budi', id('Budi'), -30]]));

    const ani = new Klien(server.port);
    await ani.kirim({ t: 'buat', nama: 'Ani', kompetisi: { kode, token: tiket.Ani } });
    const masuk = await ani.tunggu('masuk');
    const budi = new Klien(server.port);
    await budi.kirim({ t: 'gabung', kode: masuk.kode, nama: 'Budi', tiket: [{ kode, token: tiket.Budi }] });
    await ani.tunggu('meja', (p) => p.info.status === 'main');
    // Cici menunggu di lobi meja lain.
    const cici = new Klien(server.port);
    await cici.kirim({ t: 'buat', nama: 'Cici', kompetisi: { kode, token: tiket.Cici } });
    await cici.tunggu('masuk');
    const jumlahMeja = server.jumlahMeja();

    for (const nama of ['Ani', 'Budi', 'Cici']) expect((await post(`/api/kompetisi/${kode}/tutup`, { token: tiket[nama], setuju: true })).status).toBe(200);
    expect((await cici.tunggu('keluar')).alasan).toBe(TEKS_LOBI_KOMPETISI_BUBAR);
    expect(server.jumlahMeja()).toBe(jumlahMeja - 1);
    const tunggu = await detail(kode);
    expect(tunggu).toMatchObject({ status: 'selesai', disudahi: true, mejaMain: 1, meja: [] });
    expect(tunggu.juara).toBeUndefined();
    const daftar = (await (await fetch(`${alamat}/api/kompetisi`)).json()) as { kompetisi: RingkasanKompetisi[] };
    expect(daftar.kompetisi.find((k) => k.kode === kode)).toMatchObject({ status: 'selesai', mejaMain: 1 });
    // Lobi baru tidak bisa dibuka lagi.
    await cici.kirim({ t: 'buat', nama: 'Cici', kompetisi: { kode, token: tiket.Cici } });
    expect((await cici.tunggu('error')).pesan).toMatch(/sudah selesai/);

    // Permainan yang dimulai sebelum disudahi tetap dihitung.
    await mainkanSampaiSelesai([ani, budi], new Rng(5));
    const hasil = await ani.tunggu('kompetisiHasil');
    expect(hasil.pemain.map((p) => [p.nama, p.main])).toEqual([
      ['Ani', 3],
      ['Budi', 3],
    ]);
    expect(hasil.jumlahPeringkat).toBe(2);
    expect(hasil.pemain.find((p) => p.nama === 'Ani')).toMatchObject({ peringkatSebelum: null, peringkatSesudah: 1 });
    const akhir = await detail(kode);
    expect(akhir).toMatchObject({ status: 'selesai', mejaMain: 0, juara: ['Ani'], pialaJuara: [1] });
    expect(akhir.peringkat[0]).toMatchObject({ nama: 'Ani', piala: 1 });

    const papan = (await (await fetch(`${alamat}/api/peringkat?v=2`)).json()) as PapanPeringkat;
    const barisAni = [...papan.peringkat, ...papan.belumCukup].find((b) => b.nama === 'Ani');
    expect(barisAni?.piala).toBe(1);
    expect([...papan.peringkat, ...papan.belumCukup].find((b) => b.nama === 'Budi')?.piala).toBeUndefined();
    const lama = (await (await fetch(`${alamat}/api/peringkat`)).json()) as Record<string, unknown>[];
    expect(Array.isArray(lama)).toBe(true);
    expect(lama.every((b) => !('piala' in b))).toBe(true);
    for (const k of [ani, budi, cici]) k.tutup();
  });
});

describe('ketahanan pencatatan hasil', () => {
  it('peserta yang tidak ada di database: klasemen akhir biasa tetap tersimpan', () => {
    const log: string[] = [];
    const r = bukaRiwayat(':memory:', { log: (...x) => log.push(x.map(String).join(' ')) });
    const { kode, tiket } = kompetisiJalan(r);
    const ani = r.kompetisi.cekTiket(kode, tiket.Ani)!;
    // Peserta sah dulu, lalu yang tidak ada: hasilnya tidak tercatat setengah.
    const id = r.simpan(ringkasan(kode, T0 + JAM, [['Ani', ani.id, 10], ['Hantu', 9999, 50]]));
    expect(id).toBeGreaterThan(0);
    expect(r.daftar(5)).toHaveLength(1);
    expect(r.kompetisi.detail(kode, T0 + JAM)!.jumlahPermainan).toBe(0);
    expect(r.kompetisi.jumlahHasil(id)).toBe(0);
    expect(log.some((l) => l.includes('galat mencatat hasil kompetisi'))).toBe(true);
    r.tutup();
  });
});
