// Gaya main warga kedai per persona (keputusan pemilik #47): pemetaan nama → gaya, gaya yang
// diteruskan langkahBot ke pilihAksiBot (lewat mock @remi/engine, pola galat-bot.test.ts), dan
// gaya tidak pernah bocor ke pesan yang dikirim ke pemain.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAFTAR_GAYA_BOT, isGaya, Rng, type GayaBot, type LevelBot, type ViewPemain } from '@remi/engine';
import {
  GAYA_WARGA,
  gayaKursi,
  gayaUntukNama,
  kunciNama,
  Meja,
  NAMA_LAWAN_BAWAAN,
  type Kursi,
  type PesanServer,
} from '../src/index.js';
import { JamPalsu, KotakSurat, siapkan, siapSemua } from './bantu.js';

const catatan = vi.hoisted(() => ({
  /** Setiap panggilan pilihAksiBot dari meja: kursi, level, dan gaya yang diteruskan. */
  panggil: [] as { saya: number; level: string; gaya: string | undefined }[],
  /** Level strategi yang melempar galat sesudah panggilannya dicatat (cadangan #38). */
  levelRusak: new Set<string>(),
}));

vi.mock('@remi/engine', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@remi/engine')>();
  return {
    ...asli,
    pilihAksiBot: (view: ViewPemain, level: LevelBot, rng: Rng, gaya?: GayaBot) => {
      catatan.panggil.push({ saya: view.saya!, level, gaya });
      if (catatan.levelRusak.has(level)) throw new Error(`strategi ${level} tersandung (uji)`);
      return asli.pilihAksiBot(view, level, rng, gaya);
    },
  };
});

// Strategi asli untuk "manusia pura-pura", supaya tidak ikut tercatat.
const asli = await vi.importActual<typeof import('@remi/engine')>('@remi/engine');

afterEach(() => {
  catatan.panggil = [];
  catatan.levelRusak.clear();
});

/** Pasangan (level, gaya) yang dipakai meja untuk kursi i, tanpa duplikat. */
function pasanganKursi(i: number): string[] {
  return [...new Set(catatan.panggil.filter((p) => p.saya === i).map((p) => `${p.level}:${p.gaya}`))];
}

/** Giliran manusia pura-pura (strategi asli, tidak tercatat). False kalau bukan gilirannya. */
function aksiOrang(meja: Meja, surat: KotakSurat, pemainId: string, rng: Rng): boolean {
  const info = surat.info(pemainId);
  if (info.kursiSaya === null) return false;
  if (info.menungguJoker.includes(info.kursiSaya)) {
    meja.terima(pemainId, { t: 'siapJoker' });
    return true;
  }
  const v = surat.view(pemainId);
  const saya = v.saya!;
  const bisa = v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[saya] : v.status === 'putaranBerjalan' && v.putaran!.giliran === saya;
  if (!bisa) return false;
  const { pemain: _, ...aksi } = asli.pilihAksiBot(v, 'normal', rng) as { pemain: number };
  meja.terima(pemainId, { t: 'aksi', aksi: aksi as never });
  return true;
}

/** Mainkan sampai `selesai()` true; orang di `orang` main sendiri, sisanya lewat timer meja. */
function mainkanSampai(meja: Meja, jam: JamPalsu, surat: KotakSurat, orang: string[], selesai: () => boolean): void {
  const rng = new Rng(11);
  for (let i = 0; i < 20_000; i++) {
    if (selesai()) return;
    const st = meja.data.game?.status;
    if (st === 'selesai') throw new Error('permainan selesai sebelum syaratnya terpenuhi');
    if (st === 'putaranSelesai') {
      meja.terima('host', { t: 'putaranBerikut' });
      continue;
    }
    if (orang.some((id) => aksiOrang(meja, surat, id, rng))) continue;
    if (!jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran orang');
  }
  throw new Error('syarat tidak tercapai');
}

const kursiBot = (nama: string, ubah: Partial<Kursi> = {}): Kursi => ({
  jenis: 'bot',
  nama,
  pemainId: null,
  terhubung: false,
  level: 'normal',
  ...ubah,
});

describe('GAYA_WARGA: pemetaan nama warga kedai → gaya (#47)', () => {
  it('setiap nama di NAMA_LAWAN_BAWAAN punya gaya, ejaan persis, tidak ada nama lain', () => {
    expect(Object.keys(GAYA_WARGA).sort()).toEqual([...NAMA_LAWAN_BAWAAN].sort());
    expect(new Set(Object.keys(GAYA_WARGA).map(kunciNama))).toEqual(new Set(NAMA_LAWAN_BAWAAN.map(kunciNama)));
    for (const nama of NAMA_LAWAN_BAWAAN) {
      const gaya = GAYA_WARGA[nama];
      expect(isGaya(gaya), nama).toBe(true);
      expect(gaya, nama).not.toBe('standar');
      expect(gayaUntukNama(nama)).toBe(gaya);
    }
  });

  it('kelompok gaya sesuai rencana keputusan #47', () => {
    const kelompok: Record<string, string[]> = {};
    for (const [nama, gaya] of Object.entries(GAYA_WARGA)) (kelompok[gaya] ??= []).push(nama);
    for (const xs of Object.values(kelompok)) xs.sort();
    expect(kelompok).toEqual({
      kilat: ['Bu Sendok', 'Dik Toska', 'Kipas Dua'],
      sabarLondo: ['Cak Kopag', 'Koki-Kun', 'Ning Sore', 'Pak Tani'],
      ngurutin: ['Mas Sampul', 'Ning Kukis', 'Si Rak'],
      pemburu: ['Juragan', 'Om Garpu', 'Pak Seng', 'Penampil'],
      penahan: ['Bang IT', 'Cak Owner', 'Mbak Mata', 'Mbak Teras'],
      berubah: ['Bajigur', 'Bos Bocil', 'Jurik', 'Om Napi'],
    });
    // Setiap gaya selain standar dipakai paling sedikit satu warga kedai.
    for (const g of DAFTAR_GAYA_BOT) if (g !== 'standar') expect(kelompok[g]?.length ?? 0, g).toBeGreaterThan(0);
  });

  it('gayaUntukNama: tanpa beda huruf besar/kecil dan spasi tepi; nama lain dan data rusak = standar', () => {
    expect(gayaUntukNama(' kipas dua ')).toBe('kilat');
    expect(gayaUntukNama('KOKI-KUN')).toBe('sabarLondo');
    expect(gayaUntukNama('Warga 1')).toBe('standar');
    expect(gayaUntukNama('Budi')).toBe('standar');
    expect(gayaUntukNama('')).toBe('standar');
    expect(gayaUntukNama(42)).toBe('standar');
    expect(gayaUntukNama(null)).toBe('standar');
    expect(gayaUntukNama(undefined)).toBe('standar');
  });

  it('gayaKursi: hanya kursi warga kedai yang memakai gaya personanya', () => {
    expect(gayaKursi(kursiBot('Kipas Dua'))).toBe('kilat');
    expect(gayaKursi(kursiBot('Mbak Teras', { level: 'suhu' }))).toBe('penahan');
    expect(gayaKursi(kursiBot('Warga 3'))).toBe('standar');
    // Orang yang memakai nama persona tetap standar kalau gilirannya diambil alih.
    expect(gayaKursi({ jenis: 'manusia', nama: 'Kipas Dua', pemainId: 'x', terhubung: false, level: 'normal' })).toBe('standar');
    // Kursi yang ditinggal pemainnya di tengah permainan (namanya nama orang itu).
    expect(gayaKursi(kursiBot('Kipas Dua', { keluar: true, keluarSesudahPutaran: 0 }))).toBe('standar');
    expect(gayaKursi({ jenis: 'kosong', nama: '', pemainId: null, terhubung: false, level: 'normal' })).toBe('standar');
  });
});

describe('langkahBot meneruskan gaya persona ke pilihAksiBot (#47)', () => {
  it('warga kedai bernama persona memakai gayanya; level tetap dari kursi', () => {
    const { opsi, jam, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: 1 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'normal' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot', level: 'suhu' });
    expect(meja.data.kursi.map((k) => k.nama)).toEqual(['Budi', 'Kipas Dua', 'Cak Kopag']);
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    mainkanSampai(meja, jam, surat, ['host'], () => meja.status === 'selesai');
    expect(pasanganKursi(1)).toEqual(['normal:kilat']);
    expect(pasanganKursi(2)).toEqual(['suhu:sabarLondo']);
    expect(pasanganKursi(0)).toEqual([]);
  });

  it('warga kedai level mudah tetap dikirimi gayanya (engine yang mengabaikannya)', () => {
    const { opsi, jam, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'mudah' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    mainkanSampai(meja, jam, surat, ['host'], () => catatan.panggil.length >= 4);
    expect(pasanganKursi(1)).toEqual(['mudah:kilat']);
  });

  it('orang yang terputus dimainkan level normal tanpa gaya, walau namanya nama persona', () => {
    const { opsi, jam, surat } = siapkan({ tenggangSambungMs: 0 });
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, levelBot: 'suhu' });
    meja.masuk('p2', 'Kipas Dua');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    meja.terputus('p2');
    mainkanSampai(meja, jam, surat, ['host'], () => catatan.panggil.filter((p) => p.saya === 1).length >= 4);
    expect(pasanganKursi(1)).toEqual(['normal:standar']);
    expect(pasanganKursi(2)).toEqual(['suhu:sabarLondo']);
  });

  it('kursi yang ditinggal di tengah permainan: standar; sesudah main lagi dan ganti nama, gaya nama barunya', () => {
    const { opsi, jam, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: 1 });
    meja.masuk('p2', 'Kipas Dua');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    meja.terima('p2', { t: 'keluar' });
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Kipas Dua', keluar: true });
    mainkanSampai(meja, jam, surat, ['host'], () => meja.status === 'selesai');
    expect(pasanganKursi(1)).toEqual(['normal:standar']);
    expect(pasanganKursi(2)).toEqual(['normal:sabarLondo']);

    // Main lagi: tanda keluar hilang. Orang baru bernama "kipas dua" masuk, warga kedai di kursi 1
    // ganti nama (nama pertama yang belum dipakai) dan ikut gaya nama barunya.
    meja.terima('host', { t: 'mainLagi' });
    expect(meja.data.kursi[1]).not.toHaveProperty('keluar');
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 4 } });
    meja.masuk('p3', 'kipas dua');
    expect(meja.data.kursi.map((k) => k.nama)).toEqual(['Budi', 'Mbak Teras', 'Cak Kopag', 'kipas dua']);
    expect(meja.data.kursi[1]).not.toHaveProperty('keluar');
    catatan.panggil = [];
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    mainkanSampai(meja, jam, surat, ['host', 'p3'], () => meja.status === 'selesai');
    expect(pasanganKursi(1)).toEqual(['normal:penahan']);
    expect(pasanganKursi(2)).toEqual(['normal:sabarLondo']);
    expect(pasanganKursi(3)).toEqual([]);
  });

  it('cadangan galat (#38) tanpa gaya: strategi level kursi dikirimi gaya, cadangan mudah standar', () => {
    const galat: string[] = [];
    const { opsi, jam, surat } = siapkan({ saatGalat: (konteks) => galat.push(konteks) });
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'jago' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    catatan.levelRusak.add('jago');
    mainkanSampai(meja, jam, surat, ['host'], () => catatan.panggil.length >= 4);
    expect(pasanganKursi(1)).toEqual(['jago:kilat', 'mudah:standar']);
    expect(galat.every((k) => k === 'langkah warga kedai kursi 1 (jago)')).toBe(true);
    expect(galat.length).toBeGreaterThan(0);
  });
});

describe('gaya tidak pernah bocor ke pemain (#47)', () => {
  /** Semua kunci dan nilai string di dalam objek JSON. */
  function kunciDanString(x: unknown, kunci: Set<string>, teks: Set<string>): void {
    if (typeof x === 'string') teks.add(x);
    else if (Array.isArray(x)) for (const y of x) kunciDanString(y, kunci, teks);
    else if (x && typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) {
        kunci.add(k);
        kunciDanString(v, kunci, teks);
      }
    }
  }

  it('info meja hanya menyalin jenis, nama, terhubung, level; pesan keluar dan data meja tanpa gaya', () => {
    const terkirim: PesanServer[] = [];
    const surat = new KotakSurat();
    const { opsi, jam } = siapkan({
      kirim: (id, p) => {
        terkirim.push(p);
        surat.kirim(id, p);
      },
    });
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 6, detikGiliran: 0, batasPutaran: 1 });
    for (let i = 1; i < 6; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot', level: i % 2 ? 'suhu' : 'normal' });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    mainkanSampai(meja, jam, surat, ['host'], () => meja.status === 'selesai');
    // Kelima warga kedai bernama persona (gaya kilat, sabarLondo, penahan, ngurutin, ngurutin).
    expect(new Set(meja.data.kursi.slice(1).map((k) => gayaKursi(k))).size).toBeGreaterThan(2);

    for (const k of meja.info(0).kursi) expect(Object.keys(k).sort()).toEqual(['jenis', 'level', 'nama', 'terhubung']);
    expect(terkirim.length).toBeGreaterThan(50);
    const kunci = new Set<string>();
    const teks = new Set<string>();
    kunciDanString(terkirim, kunci, teks);
    kunciDanString(meja.data, kunci, teks);
    expect([...kunci].filter((k) => /gaya/i.test(k))).toEqual([]);
    expect([...teks].filter((t) => isGaya(t))).toEqual([]);
    const semua = JSON.stringify([terkirim, meja.data]);
    for (const g of ['sabarLondo', 'ngurutin', 'pemburu', 'penahan']) expect(semua).not.toContain(g);
  });
});
