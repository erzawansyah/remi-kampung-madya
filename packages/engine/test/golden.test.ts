// Golden master: permainan bot-vs-bot deterministik untuk setiap konfigurasi, dikunci lewat sidik jari
// (sha256 dari JSON dengan kunci terurut) di __golden__/. Tujuannya proteksi regresi aturan: perubahan
// presentasi (client, animasi, teks UI) TIDAK boleh menggeser satu pun hash di sini.
//
// Kalau hash berubah:
// - Perubahan aturan yang disengaja (sudah disetujui pemilik): tinjau diff ringkasan, lalu perbarui
//   snapshot dengan `npx vitest run packages/engine/test/golden.test.ts -u` dan catat di README.
// - Selain itu: anggap regresi. Cari tahu dulu kenapa berubah, jangan langsung `-u`.
//
// Lihat docs/baseline-gameplay.md untuk penjelasan setiap bagian sidik jari.

import { createHash, type Hash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  BATAS_PERISTIWA_VIEW,
  namaKartu,
  pilihAksiBot,
  Rng,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
  type ViewPemain,
} from '../src/index.js';

/** JSON dengan kunci objek terurut, supaya urutan field di kode tidak memengaruhi hash. */
export function jsonTerurut(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    }
    return v;
  });
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export interface Konfigurasi {
  label: string;
  n: number;
  duaDeck: boolean;
}

export const KONFIGURASI: Konfigurasi[] = [
  { label: '2-pemain', n: 2, duaDeck: false },
  { label: '3-pemain', n: 3, duaDeck: false },
  { label: '4-pemain', n: 4, duaDeck: false },
  { label: '4-pemain-2-deck', n: 4, duaDeck: true },
  { label: '5-pemain', n: 5, duaDeck: false },
  { label: '6-pemain', n: 6, duaDeck: false },
];

/** Seed tetap. Jangan diubah: mengubahnya berarti membuang baseline. */
export const SEED = [1, 2, 3, 7, 42, 99, 2024, 31337];

/** Putaran per permainan. Permainan berakhir karena batas putaran. */
export const BATAS_PUTARAN = 3;

/** Campuran level bot, sama polanya dengan simulasi.ts. */
const levelUntuk = (seed: number, n: number): LevelBot[] =>
  Array.from({ length: n }, (_, i) => ((seed + i) % 3 === 0 ? 'mudah' : 'normal'));

/**
 * Periksa aturan info rahasia pada satu view (selain dikunci lewat hash):
 * tangan lawan tertutup selama putaran, buangan hanya (n − 1) teratas, deck tidak terlihat,
 * jokerMati hanya yang relevan, log tidak menyebut kartu yang dibuang.
 */
function periksaViewRahasia(g: GameState, v: ViewPemain): void {
  const p = g.putaran!;
  const vp = v.putaran!;
  const n = g.pemain.length;
  const berjalan = g.status === 'putaranBerjalan' || g.status === 'susunAkhir';
  vp.tangan.forEach((t, i) => {
    if (i === v.saya) expect(t).toEqual(p.tangan[i]);
    else if (berjalan) expect(t).toBeNull();
    else expect(t).toEqual(p.tangan[i]);
  });
  expect(vp.jumlahKartuTangan).toEqual(p.tangan.map((t) => t.length));
  const batas = Math.max(1, n - 1);
  expect(vp.buangan.length).toBeLessThanOrEqual(batas);
  expect(vp.buangan).toEqual(p.buangan.slice(-batas));
  expect(vp.jumlahBuangan).toBe(p.buangan.length);
  expect(vp.jumlahDeck).toBe(p.deck.length);
  expect('deck' in vp).toBe(false);
  const relevan = new Set<string>([
    ...vp.buangan.map((e) => e.kartu.id),
    ...(v.saya !== null ? p.tangan[v.saya].map((k) => k.id) : []),
    ...p.kartuJadi.flat().flatMap((kj) => kj.kartu.map((d) => d.kartu.id)),
  ]);
  for (const id of vp.jokerMati) {
    expect(p.jokerMati).toContain(id);
    expect(relevan.has(id)).toBe(true);
  }
  expect(v.peristiwa.length).toBeLessThanOrEqual(BATAS_PERISTIWA_VIEW);
}

/** Log tidak boleh menyebut kartu yang dibuang (mode ingatan). */
function periksaLogTanpaKartuBuangan(g: GameState): void {
  for (const e of g.log) {
    expect(e.pesan).not.toMatch(/buang (As|J|Q|K|\d+) (Waru|Love|Kriting|Wajik)/);
  }
  // Setiap buang biasa (bukan mentung) dicatat persis "<nama> buang kartu.".
  const jumlahBuangBiasa = g.peristiwa.filter((e) => e.jenis === 'buang').length - g.riwayat.filter((r) => r.cara === 'mentung').length;
  expect(g.log.filter((e) => / buang kartu\.$/.test(e.pesan))).toHaveLength(jumlahBuangBiasa);
  // Kartu yang dibuang (bukan pentungan) tidak pernah disebut namanya di log.
  for (const e of g.peristiwa) {
    if (e.jenis !== 'buang') continue;
    const nama = namaKartu(e.kartu);
    const pentungan = g.riwayat.some((r) => r.nomor === e.putaran && r.pentungan?.id === e.kartu.id);
    if (pentungan) continue;
    expect(g.log.some((l) => l.putaran === e.putaran && l.pesan.includes(`buang ${nama}`))).toBe(false);
  }
}

export interface Rekaman {
  seed: number;
  level: LevelBot[];
  jumlahAksi: number;
  jumlahView: number;
  putaran: {
    nomor: number;
    pengocok: number;
    rankJoker: number;
    cara: string;
    pementung: number | null;
    nilaiPentungan: number;
    kepentung: number[];
    dibalik: boolean;
    total: number[];
    skorAkumulasi: number[];
  }[];
  skorAkhir: number[];
  pemenang: number[];
  alasanSelesai: GameState['alasanSelesai'];
  hash: {
    aksi: string;
    view: string;
    peristiwa: string;
    log: string;
    riwayat: string;
    stateAkhir: string;
  };
}

/** Mainkan satu permainan penuh bot-vs-bot dan rekam sidik jarinya. */
export function rekamPermainan(k: Konfigurasi, seed: number): Rekaman {
  const level = levelUntuk(seed, k.n);
  let g: GameState = buatPermainan({
    pemain: Array.from({ length: k.n }, (_, i) => `Bot ${i + 1}`),
    seed,
    konfigurasi: { duaDeckUntukEmpat: k.duaDeck, batasPutaran: BATAS_PUTARAN, batasSkorAtas: null, batasSkorBawah: null },
  });
  const rng = new Rng(seed * 7919 + 1);
  const hAksi: Hash = createHash('sha256');
  const hView: Hash = createHash('sha256');
  let jumlahAksi = 0;
  let jumlahView = 0;

  const rekamView = (saya: number | null, titik: string) => {
    const v = viewUntuk(g, saya);
    if (g.putaran) periksaViewRahasia(g, v);
    hView.update(`${titik}|${saya}|${jsonTerurut(v)}\n`);
    jumlahView++;
  };
  const rekamSemuaView = (titik: string) => {
    for (let i = 0; i < k.n; i++) rekamView(i, titik);
    rekamView(null, titik);
  };

  while (g.status !== 'selesai') {
    let aksi: Aksi;
    let pelaku: number | null = null;
    if (g.status === 'putaranBerjalan') {
      pelaku = g.putaran!.giliran;
      aksi = pilihAksiBot(viewUntuk(g, pelaku), level[pelaku], rng);
    } else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      pelaku = rng.pick(belum);
      aksi = pilihAksiBot(viewUntuk(g, pelaku), level[pelaku], rng);
    } else {
      aksi = { jenis: 'mulaiPutaran' };
    }
    const statusSebelum = g.status;
    const h = terapkanAksi(g, aksi);
    if (!h.ok) throw new Error(`aksi bot ditolak (${k.label}, seed ${seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    g = h.state;
    jumlahAksi++;
    hAksi.update(`${jsonTerurut(aksi)}\n`);

    // Titik pengambilan view: awal putaran (semua), masuk susun akhir (semua), putaran selesai
    // (semua, tangan terbuka), dan tiap 7 aksi untuk pelaku dan satu lawan.
    if (aksi.jenis === 'mulaiPutaran') rekamSemuaView('mulai');
    else if (statusSebelum === 'putaranBerjalan' && g.status === 'susunAkhir') rekamSemuaView('susunAkhir');
    if (g.status === 'putaranSelesai' || g.status === 'selesai') {
      if (statusSebelum !== g.status) rekamSemuaView('putaranSelesai');
    } else if (jumlahAksi % 7 === 0 && pelaku !== null) {
      rekamView(pelaku, `aksi${jumlahAksi}`);
      rekamView((pelaku + 1) % k.n, `aksi${jumlahAksi}`);
    }
    if (jumlahAksi > 20000) throw new Error('permainan tidak selesai');
  }

  periksaLogTanpaKartuBuangan(g);
  const maks = Math.max(...g.skor);
  return {
    seed,
    level,
    jumlahAksi,
    jumlahView,
    putaran: g.riwayat.map((r) => ({
      nomor: r.nomor,
      pengocok: r.pengocok,
      rankJoker: r.rankJoker,
      cara: r.cara,
      pementung: r.pementung,
      nilaiPentungan: r.nilaiPentungan,
      kepentung: r.kepentung,
      dibalik: r.dibalik,
      total: r.rincian.map((x) => x.total),
      skorAkumulasi: r.skorAkumulasi,
    })),
    skorAkhir: g.skor,
    pemenang: g.skor.map((x, i) => (x === maks ? i : -1)).filter((i) => i >= 0),
    alasanSelesai: g.alasanSelesai,
    hash: {
      aksi: hAksi.digest('hex'),
      view: hView.digest('hex'),
      peristiwa: sha(jsonTerurut(g.peristiwa)),
      log: sha(jsonTerurut(g.log)),
      riwayat: sha(jsonTerurut(g.riwayat)),
      stateAkhir: sha(jsonTerurut(g)),
    },
  };
}

/** Rekaman per konfigurasi, dipakai ulang oleh test cakupan di akhir file. */
const semuaRekaman = new Map<string, Rekaman[]>();

describe('golden master: permainan bot-vs-bot deterministik', () => {
  for (const k of KONFIGURASI) {
    it(`${k.label}: ${SEED.length} seed × ${BATAS_PUTARAN} putaran cocok dengan baseline`, async () => {
      const rekaman: Rekaman[] = [];
      for (const seed of SEED) {
        rekaman.push(rekamPermainan(k, seed));
        // Beri kesempatan worker memproses pesan dari Vitest (lihat catatan AGENTS.md).
        await new Promise((r) => setTimeout(r, 0));
      }
      // Sanity: baseline harus benar-benar memuat permainan, bukan kosong.
      for (const r of rekaman) {
        expect(r.putaran).toHaveLength(BATAS_PUTARAN);
        expect(r.alasanSelesai).toBe('batasPutaran');
      }
      semuaRekaman.set(k.label, rekaman);
      const isi = { konfigurasi: k, batasPutaran: BATAS_PUTARAN, sidikJariGabungan: sha(jsonTerurut(rekaman)), rekaman };
      await expect(`${JSON.stringify(isi, null, 2)}\n`).toMatchFileSnapshot(`./__golden__/engine-${k.label}.json`);
    }, 60_000);
  }

  it('determinisme: seed yang sama dua kali menghasilkan sidik jari identik', () => {
    const a = rekamPermainan(KONFIGURASI[2], SEED[0]);
    const b = rekamPermainan(KONFIGURASI[2], SEED[0]);
    expect(b).toEqual(a);
  });

  it('cakupan baseline: ada mentung, deck habis, balik arah, dan lompat', () => {
    const semua = [...semuaRekaman.values()].flat().flatMap((r) => r.putaran);
    expect(semua).toHaveLength(KONFIGURASI.length * SEED.length * BATAS_PUTARAN);
    expect([...new Set(semua.map((r) => r.cara))].sort()).toEqual(['deckHabis', 'mentung']);
    const kena = semua.filter((r) => r.cara === 'mentung' && r.kepentung.length);
    expect(kena.some((r) => r.dibalik)).toBe(true);
    expect(kena.some((r) => !r.dibalik)).toBe(true);
  });
});
