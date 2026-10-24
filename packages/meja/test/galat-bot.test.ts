// Keputusan pemilik #38: galat di langkah warga kedai (atau timer meja lain) tidak boleh membuat meja
// macet, baik di server maupun di mode offline. Galat disuntikkan lewat mock @remi/engine
// (pilihAksiBot/viewUntuk) dan penjadwal yang tersendat; semua digerakkan JamPalsu.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rng, type GameState, type GayaBot, type LevelBot, type ViewPemain } from '@remi/engine';
import { JEDA_ULANG_GALAT_MAKS_MS, JEDA_ULANG_GALAT_MS, Meja, TOLERANSI_BATAS_MS, type OpsiMeja } from '../src/index.js';
import { JamPalsu, KotakSurat, siapkan, siapSemua } from './bantu.js';

const kendali = vi.hoisted(() => ({
  /** Level strategi yang melempar galat saat dipanggil. */
  levelRusak: new Set<string>(),
  /** Level strategi yang mengembalikan aksi tidak sah (ditolak mesin). */
  levelNgawur: new Set<string>(),
  /** Kursi yang view-nya tidak bisa dibuat (semua cadangan ikut gagal). */
  viewRusak: new Set<number>(),
  /** Waktu (JamPalsu) setiap viewUntuk untuk kursi rusak dipanggil. */
  waktuViewRusak: [] as number[],
  jam: null as JamPalsu | null,
}));

vi.mock('@remi/engine', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@remi/engine')>();
  return {
    ...asli,
    // Argumen ke-4 (gaya main, #47) ikut diteruskan supaya mock tidak diam-diam membuang gaya.
    pilihAksiBot: (view: ViewPemain, level: LevelBot, rng: Rng, gaya?: GayaBot) => {
      if (kendali.levelRusak.has(level)) throw new Error(`strategi ${level} tersandung (uji)`);
      if (kendali.levelNgawur.has(level)) return { jenis: 'selesaiSusun', pemain: view.saya! };
      return asli.pilihAksiBot(view, level, rng, gaya);
    },
    viewUntuk: (state: GameState, saya: number | null) => {
      if (saya !== null && kendali.viewRusak.has(saya)) {
        kendali.waktuViewRusak.push(kendali.jam?.sekarang() ?? NaN);
        throw new Error('view rusak (uji)');
      }
      return asli.viewUntuk(state, saya);
    },
  };
});

// Strategi asli untuk "manusia pura-pura", supaya tidak ikut dirusak mock di atas.
const asli = await vi.importActual<typeof import('@remi/engine')>('@remi/engine');

afterEach(() => {
  kendali.levelRusak.clear();
  kendali.levelNgawur.clear();
  kendali.viewRusak.clear();
  kendali.waktuViewRusak = [];
  kendali.jam = null;
  vi.restoreAllMocks();
});

/** Penjadwal yang bisa dibuat tersendat: `setel`/`sekarang` melempar sebanyak N kali berikutnya. */
class JamRewel extends JamPalsu {
  gagalSetel = 0;
  gagalSekarang = 0;
  override setel(ms: number, fn: () => void): unknown {
    if (this.gagalSetel > 0) {
      this.gagalSetel--;
      throw new Error('setel tersendat (uji)');
    }
    return super.setel(ms, fn);
  }
  override sekarang(): number {
    if (this.gagalSekarang > 0) {
      this.gagalSekarang--;
      throw new Error('jam tersendat (uji)');
    }
    return super.sekarang();
  }
}

/**
 * Meja 3 kursi: Budi (manusia, kursi 0) + dua warga kedai level normal. Warga kedai kursi 1 yang
 * ngocok, jadi langkah pertama setelah pengumuman joker adalah langkah warga kedai.
 */
function mejaUji(opsiTambahan: Partial<OpsiMeja> = {}, pengaturan: Record<string, unknown> = {}, siap = true) {
  const galat: string[] = [];
  const ctx = siapkan({ saatGalat: (konteks) => galat.push(konteks), ...opsiTambahan });
  const jam = (opsiTambahan.penjadwal as JamPalsu | undefined) ?? ctx.jam;
  kendali.jam = jam;
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: 1, ...pengaturan });
  meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'normal' });
  meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot', level: 'normal' });
  meja.terima('host', { t: 'mulai', pengocok: 1 });
  if (siap) siapSemua(meja);
  return { ...ctx, jam, meja, galat };
}

/** Giliran manusia "pura-pura" dengan strategi asli (tidak terpengaruh mock). */
function aksiBudi(meja: Meja, surat: KotakSurat, rng: Rng): boolean {
  const info = surat.info('host');
  if (info.menungguJoker.includes(0)) {
    meja.terima('host', { t: 'siapJoker' });
    return true;
  }
  const v = surat.view('host');
  const bisa = v.status === 'susunAkhir' ? !v.putaran!.selesaiSusun[0] : v.status === 'putaranBerjalan' && v.putaran!.giliran === 0;
  if (!bisa) return false;
  const { pemain: _, ...aksi } = asli.pilihAksiBot(v, 'normal', rng) as { pemain: number };
  meja.terima('host', { t: 'aksi', aksi: aksi as never });
  return true;
}

/** Mainkan sampai permainan selesai. Melempar kalau meja macet (tidak ada timer, bukan giliran Budi). */
function mainkanSampaiSelesai(meja: Meja, jam: JamPalsu, surat: KotakSurat, rng = new Rng(5)): void {
  for (let i = 0; i < 20_000; i++) {
    const st = meja.data.game?.status;
    if (st === 'selesai') return;
    if (st === 'putaranSelesai') {
      meja.terima('host', { t: 'putaranBerikut' });
      continue;
    }
    if (aksiBudi(meja, surat, rng)) continue;
    if (!jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran Budi');
  }
  throw new Error('permainan tidak selesai');
}

const jumlahPeristiwa = (meja: Meja) => meja.data.game!.peristiwa.length;

describe('galat di langkah warga kedai (#38)', () => {
  it('strategi level kursi melempar galat: dipakai strategi mudah, permainan tetap sampai selesai', () => {
    kendali.levelRusak.add('normal');
    const { meja, jam, surat, galat } = mejaUji();
    const awal = jumlahPeristiwa(meja);
    expect(() => jam.maju(100)).not.toThrow();
    expect(jumlahPeristiwa(meja)).toBeGreaterThan(awal);
    expect(galat).toEqual(['langkah warga kedai kursi 1 (normal)']);
    mainkanSampaiSelesai(meja, jam, surat);
    expect(meja.status).toBe('selesai');
  });

  it('aksi strategi level kursi ditolak mesin: dicatat beserta aksinya, lalu strategi mudah', () => {
    kendali.levelNgawur.add('normal');
    const { meja, jam, surat, galat } = mejaUji();
    const awal = jumlahPeristiwa(meja);
    jam.maju(100);
    expect(jumlahPeristiwa(meja)).toBeGreaterThan(awal);
    expect(galat).toEqual(['langkah warga kedai kursi 1 (normal) ditolak: {"jenis":"selesaiSusun","pemain":1}']);
    mainkanSampaiSelesai(meja, jam, surat);
    expect(meja.status).toBe('selesai');
  });

  it('strategi normal dan mudah sama-sama galat: aksi aman (ambil deck, buang, Selesai) sampai permainan selesai', () => {
    kendali.levelRusak.add('normal');
    kendali.levelRusak.add('mudah');
    const { meja, jam, surat, galat } = mejaUji();
    mainkanSampaiSelesai(meja, jam, surat);
    expect(meja.status).toBe('selesai');
    const g = meja.data.game!;
    // Warga kedai hanya ambil deck lalu buang: tidak pernah mulung/menurunkan, tidak ada aturan baru.
    const jenisWarga = new Set(g.peristiwa.filter((e) => 'pemain' in e && e.pemain !== 0).map((e) => e.jenis));
    expect([...jenisWarga].sort()).toEqual(['ambilDeck', 'buang']);
    expect(galat.length).toBeGreaterThan(0);
    expect(galat.every((k) => / \((normal|mudah)\)$/.test(k))).toBe(true);
  });

  it('semua cadangan galat: dicoba lagi dengan jeda makin panjang (tidak berputar cepat), lalu pulih', () => {
    const { meja, jam, galat } = mejaUji();
    kendali.viewRusak.add(1);
    const awal = jumlahPeristiwa(meja);
    for (let t = 0; t < 300; t++) {
      expect(() => jam.maju(1000)).not.toThrow();
      // Selalu ada tepat satu timer: coba ulang langkah warga kedai.
      expect(jam.jumlahTimer).toBe(1);
    }
    expect(jumlahPeristiwa(meja)).toBe(awal);
    // Tiap percobaan mencoba 3 cara (level kursi, mudah, aman) di waktu yang sama.
    const percobaan = [...new Set(kendali.waktuViewRusak)];
    expect(kendali.waktuViewRusak.length).toBe(percobaan.length * 3);
    expect(galat.length).toBe(percobaan.length * 3);
    const jeda = percobaan.slice(1).map((t, i) => t - percobaan[i]);
    expect(jeda).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
    expect(JEDA_ULANG_GALAT_MS).toBe(2000);
    expect(JEDA_ULANG_GALAT_MAKS_MS).toBe(60000);

    // Penyebabnya hilang: warga kedai jalan lagi di percobaan berikutnya (ambil deck), dan langkah
    // sesudahnya (buang) kembali ke jeda biasa 100 ms.
    kendali.viewRusak.clear();
    const berikut = percobaan.at(-1)! + JEDA_ULANG_GALAT_MAKS_MS;
    jam.maju(berikut - jam.sekarang() - 1);
    expect(jumlahPeristiwa(meja)).toBe(awal);
    jam.maju(1);
    expect(meja.data.game!.peristiwa.slice(awal).map((e) => e.jenis)).toEqual(['ambilDeck']);
    jam.maju(100);
    expect(meja.data.game!.peristiwa.slice(awal).map((e) => e.jenis)).toEqual(['ambilDeck', 'buang']);
  });

  it('selama coba ulang, meja tetap melayani: emote jalan, pemain bisa keluar, hentikan() membersihkan timer', () => {
    const { meja, jam, surat } = mejaUji();
    kendali.viewRusak.add(1);
    jam.maju(5000);
    meja.terima('host', { t: 'emote', isi: '😂' });
    expect(surat.terakhir('host', 'emote')).toMatchObject({ kursi: 0, isi: '😂' });
    meja.terima('host', { t: 'keluar' });
    expect(surat.terakhir('host', 'keluar')).toBeTruthy();
    expect(meja.data.kursi[0].jenis).toBe('bot');
    // Tidak ada manusia lagi: meja dijeda (tanpa timer), bukan berputar mencoba terus.
    expect(jam.jumlahTimer).toBe(0);

    const lain = mejaUji();
    kendali.viewRusak.add(1);
    lain.jam.maju(100);
    expect(lain.jam.jumlahTimer).toBe(1);
    lain.meja.hentikan();
    expect(lain.jam.jumlahTimer).toBe(0);
  });

  it('galat sesudah aksi diterapkan (kirim gagal): aksi tidak diulang/diganti, jadwal tetap tersusun', () => {
    let lempar = false;
    const surat = new KotakSurat();
    const kirim: OpsiMeja['kirim'] = (id, p) => {
      if (lempar && p.t === 'view') {
        lempar = false;
        throw new Error('sambungan putus (uji)');
      }
      surat.kirim(id, p);
    };
    const uji = mejaUji({ kirim });
    const rujukan = mejaUji();
    lempar = true;
    expect(() => uji.jam.maju(100)).not.toThrow();
    rujukan.jam.maju(100);
    expect(lempar).toBe(false);
    expect(uji.galat).toEqual(['sesudah langkah warga kedai kursi 1']);
    // Sama persis dengan meja yang tidak galat: satu aksi, tidak ada aksi cadangan yang menimpa.
    expect(uji.meja.data.game).toEqual(rujukan.meja.data.game);
    expect(uji.meja.data.rngBot).toBe(rujukan.meja.data.rngBot);
    expect(uji.jam.jumlahTimer).toBe(rujukan.jam.jumlahTimer);
    expect(uji.jam.jumlahTimer).toBeGreaterThan(0);

    mainkanSampaiSelesai(uji.meja, uji.jam, surat);
    mainkanSampaiSelesai(rujukan.meja, rujukan.jam, rujukan.surat);
    expect(uji.meja.data.game).toEqual(rujukan.meja.data.game);
  });

  it('tanpa saatGalat: galat dicatat ke console.error dan meja tetap jalan', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    kendali.levelRusak.add('normal');
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'normal' });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    const awal = jumlahPeristiwa(meja);
    expect(() => ctx.jam.maju(100)).not.toThrow();
    expect(jumlahPeristiwa(meja)).toBeGreaterThan(awal);
    expect(err).toHaveBeenCalledWith('[meja ABCDE] langkah warga kedai kursi 1 (normal)', expect.any(Error));
  });
});

describe('galat di timer meja lain (#38)', () => {
  it('penjadwal tersendat di dalam timer pengumuman joker: jadwal disusun ulang, warga kedai tetap jalan', () => {
    const jam = new JamRewel();
    const { meja, galat } = mejaUji({ penjadwal: jam }, { detikGiliran: 30 }, false);
    const awal = jumlahPeristiwa(meja);
    jam.gagalSetel = 1;
    expect(() => jam.maju(30_000)).not.toThrow();
    expect(galat).toEqual(['batas waktu pengumuman joker']);
    expect(meja.data.menungguJoker).toEqual([]);
    expect(jam.jumlahTimer).toBe(1);
    jam.maju(100);
    expect(jumlahPeristiwa(meja)).toBeGreaterThan(awal);
  });

  it('jadwal meja galat berulang: dicoba lagi dengan jeda 2, 4, ... detik sampai berhasil', () => {
    const jam = new JamRewel();
    const { meja, galat } = mejaUji({ penjadwal: jam }, { detikGiliran: 30 }, false);
    const awal = jumlahPeristiwa(meja);
    jam.gagalSekarang = 3;
    jam.maju(30_000);
    expect(galat).toEqual(['batas waktu pengumuman joker', 'menyusun ulang jadwal meja']);
    expect(jam.jumlahTimer).toBe(1);
    jam.maju(2_000);
    expect(galat).toEqual(['batas waktu pengumuman joker', 'menyusun ulang jadwal meja', 'menyusun ulang jadwal meja']);
    expect(jam.jumlahTimer).toBe(1);
    jam.maju(4_000 + 99);
    expect(jumlahPeristiwa(meja)).toBe(awal);
    jam.maju(1);
    expect(jumlahPeristiwa(meja)).toBeGreaterThan(awal);
    expect(galat).toHaveLength(3);
  });

  it('galat di batas waktu giliran manusia: warga kedai tetap mengambil alih', () => {
    const jam = new JamRewel();
    const { meja, galat, surat } = mejaUji({ penjadwal: jam }, { detikGiliran: 20 });
    // Mainkan sampai giliran Budi, lalu biarkan waktunya habis dengan penjadwal yang tersendat sekali.
    for (let i = 0; i < 200 && meja.data.game!.putaran!.giliran !== 0; i++) jam.langkah();
    expect(meja.data.game!.putaran!.giliran).toBe(0);
    expect(surat.info('host').batasWaktu).not.toBeNull();
    const awal = jumlahPeristiwa(meja);
    jam.gagalSetel = 1;
    // Warga kedai mengambil alih sesudah toleransi tersembunyi di belakang batas resmi.
    jam.maju(20_000 + TOLERANSI_BATAS_MS);
    expect(galat).toEqual(['batas waktu giliran']);
    expect(jam.jumlahTimer).toBe(1);
    jam.maju(100);
    expect(jumlahPeristiwa(meja)).toBeGreaterThan(awal);
  });
});
