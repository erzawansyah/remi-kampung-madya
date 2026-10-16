// Alat bantu test: menulis kartu dengan teks dan menyusun skenario putaran secara langsung.

import {
  buatKartu,
  buatPermainan,
  terapkan,
  validasiKartuJadi,
  type Arah,
  type Bunga,
  type GameState,
  type Kartu,
  type KartuJadi,
  type KonfigurasiPermainan,
  type KonteksJoker,
  type Peran,
  type Rank,
} from '../src/index.js';

const RANK: Record<string, Rank> = { As: 1, J: 11, Q: 12, K: 13 };

/** "3 wajik", "K kriting", "As waru", "7 love#1" (deck ke-1). */
export function kartu(teks: string): Kartu {
  const m = /^(As|J|Q|K|\d+) (waru|love|kriting|wajik)(?:#(\d))?$/.exec(teks);
  if (!m) throw new Error(`format kartu salah: ${teks}`);
  const rank = (RANK[m[1]] ?? Number(m[1])) as Rank;
  return buatKartu(m[2] as Bunga, rank, m[3] ? Number(m[3]) : 0);
}

export const kartuSemua = (...teks: string[]) => teks.map(kartu);

export function ctx(rankJoker: Rank, jokerMati: string[] = []): KonteksJoker {
  return { rankJoker, jokerMati };
}

/** Item kartu jadi: "4 wajik" (asli) atau ["7 waru", "4 wajik"] (joker 7 Waru menggantikan 4 Wajik). */
export type ItemTeks = string | [string, string];

export function item(t: ItemTeks): { kartu: Kartu; sebagai?: Peran } {
  if (typeof t === 'string') return { kartu: kartu(t) };
  const peran = kartu(t[1]);
  return { kartu: kartu(t[0]), sebagai: { rank: peran.rank, bunga: peran.bunga } };
}

/** Spesifikasi untuk aksi (id + peran). */
export function spek(...items: ItemTeks[]) {
  return items.map((t) => {
    const i = item(t);
    return { id: i.kartu.id, sebagai: i.sebagai };
  });
}

let nomorKj = 100;
export function kartuJadi(pemilik: number, c: KonteksJoker, ...items: ItemTeks[]): KartuJadi {
  const h = validasiKartuJadi(items.map(item), c);
  return { id: `uji${++nomorKj}`, pemilik, jenis: h.jenis, kartu: h.kartu };
}

export interface Skenario {
  pemain?: number;
  rankJoker: Rank;
  tangan: string[][];
  /** Dari bawah ke atas: [kartu, pemilik]. */
  buangan?: [string, number][];
  kartuJadi?: ItemTeks[][][];
  giliran: number;
  arah?: Arah;
  pengocok?: number;
  /** Isi deck; default sisa kartu yang belum dipakai. */
  deck?: string[];
  jokerMati?: string[];
  konfigurasi?: Partial<Omit<KonfigurasiPermainan, 'jumlahPemain'>>;
  skor?: number[];
  /** Mode kaldu (#42): pintasan untuk `konfigurasi.modeKaldu`. */
  modeKaldu?: boolean;
  /** Putaran ini putaran kaldu (StatePutaran.kaldu). */
  kaldu?: boolean;
  /** Sudah sepakat putaran berikutnya putaran terakhir (GameState.kalduDiminta). */
  kalduDiminta?: boolean;
}

/** State putaran berjalan dengan isi yang ditentukan test. Kartu yang tidak disebut masuk deck. */
export function skenario(s: Skenario): GameState {
  const n = s.pemain ?? s.tangan.length;
  const g = buatPermainan({
    pemain: Array.from({ length: n }, (_, i) => `Pemain ${i + 1}`),
    seed: 1,
    konfigurasi: { ...s.konfigurasi, ...(s.modeKaldu ? { modeKaldu: true } : {}) },
  });
  // Field opsional hanya ditulis kalau dipakai, sama seperti mesin.
  if (s.kalduDiminta) g.kalduDiminta = true;
  const tangan = s.tangan.map((t) => t.map(kartu));
  const buangan = (s.buangan ?? []).map(([t, pemilik]) => ({ kartu: kartu(t), pemilik }));
  // Seperti di permainan nyata: joker yang ada di buangan pasti sudah pernah dibuang, jadi mati.
  const mati = new Set([
    ...(s.jokerMati ?? []).map((t) => kartu(t).id),
    ...buangan.filter((e) => e.kartu.rank === s.rankJoker).map((e) => e.kartu.id),
  ]);
  const c = ctx(s.rankJoker, [...mati]);
  const kj: KartuJadi[][] = Array.from({ length: n }, (_, i) =>
    (s.kartuJadi?.[i] ?? []).map((items) => kartuJadi(i, c, ...items)),
  );
  const dipakai = new Set([
    ...tangan.flat().map((k) => k.id),
    ...buangan.map((e) => e.kartu.id),
    ...kj.flat().flatMap((x) => x.kartu.map((d) => d.kartu.id)),
  ]);
  const jumlahDeck = n >= 5 || (n === 4 && g.konfigurasi.duaDeckUntukEmpat) ? 2 : 1;
  const sisa: Kartu[] = [];
  for (let d = 0; d < jumlahDeck; d++) {
    for (const b of ['waru', 'love', 'kriting', 'wajik'] as Bunga[]) {
      for (let r = 1; r <= 13; r++) {
        const k = buatKartu(b, r as Rank, d);
        if (!dipakai.has(k.id)) sisa.push(k);
      }
    }
  }
  const deck = s.deck ? s.deck.map(kartu) : sisa;
  const kartuDibuka = deck.find((k) => k.rank === s.rankJoker) ?? buatKartu('waru', s.rankJoker, 0);
  if (s.skor) g.skor = [...s.skor];
  g.status = 'putaranBerjalan';
  g.arah = s.arah ?? 1;
  g.putaran = {
    nomor: 1,
    pengocok: s.pengocok ?? s.giliran,
    arah: s.arah ?? 1,
    kartuDibuka,
    rankJoker: s.rankJoker,
    deck,
    buangan,
    tangan,
    kartuJadi: kj,
    giliran: s.giliran,
    tahap: 'ambil',
    sumberAmbil: null,
    pungutan: [],
    jokerMati: c.jokerMati as string[],
    jokerDibuang: Array(n).fill(0),
    deckHabis: false,
    selesaiSusun: Array(n).fill(false),
    mulungBeruntun: Array(n).fill(0),
    mentung: null,
    asalKartu: {},
    urutanKartuJadi: 0,
    ...(s.kaldu ? { kaldu: true as const } : {}),
  };
  return g;
}

export const id = (t: string) => kartu(t).id;

/** Fase susun akhir: semua pemain langsung menekan "Selesai". */
export function semuaSelesaiSusun(g: GameState): GameState {
  let s = g;
  s.pemain.forEach((_, i) => {
    if (s.status === 'susunAkhir' && !s.putaran!.selesaiSusun[i]) s = terapkan(s, { jenis: 'selesaiSusun', pemain: i });
  });
  return s;
}
