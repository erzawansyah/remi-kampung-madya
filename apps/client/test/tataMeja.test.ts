// Unit test tata letak meja (fungsi murni hitungTataMeja, tanpa Phaser): kartu tangan tidak keluar dari
// area tangan (memperhitungkan miring kipas & bayangan), deck tidak berubah ukuran saat kartu jadi pertama
// turun, panel lawan tidak saling tumpang tindih, fokus keyboard terlihat di tempat yang benar, dan saat
// menyusun mulung kartu pungutan tetap terbaca & bisa diketuk serta kartu jadiku tetap tampil.
// Matriks tabrakan: 2..6 pemain × HP 360/390, tablet, HP lanskap, desktop × teks normal/besar (bar HTML
// sungguhan diukur Playwright), plus panel lawan ringkas & teks yang terpotong (label buangan, info panel).

import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  pilihAksiBot,
  Rng,
  SEMUA_BUNGA,
  SEMUA_RANK,
  terapkanAksi,
  viewUntuk,
  type GameState,
  type Kartu,
  type KartuJadi,
  type ViewPemain,
} from '@remi/engine';
import { NAMA_LAWAN_BAWAAN, type InfoMeja } from '@remi/meja';
import { PAD_PENDUKUNG, RASIO_KARTU } from '../src/game/kartuGrafisGambar';
import {
  angkaSkorKanvas,
  CW_NYAMAN_CSS,
  geserBayangan,
  hitungTataMeja,
  inisialNama,
  kiraLebarTeks,
  judulMulung,
  labelSempit,
  LANTAI_STABIL_CSS,
  LAPIS,
  LEBAR_PUNGUTAN_CSS,
  lebarIkonKartu,
  INFO_PATOKAN,
  kotakLabelKartu,
  MINI_PANEL_MIN_CSS,
  MINI_RINGKAS_CSS,
  PENANDA_WARGA_KEDAI,
  ruangSorotTangan,
  type KartuTata,
  type Kotak,
  type ModelTata,
  type TataMeja,
  type TeksTata,
  type UkuranLayar,
} from '../src/game/tataMeja';

// ---------------------------------------------------------------------------------------------
// Alat bantu
// ---------------------------------------------------------------------------------------------

interface Layar {
  nama: string;
  w: number;
  h: number;
  d: number;
  /** Tinggi bar HTML atas/bawah (piksel CSS), kira-kira seperti di aplikasi. */
  atas?: number;
  bawah?: number;
  teksBesar?: boolean;
}

// Tinggi bar HTML diukur dari aplikasi (Vite dev, Chrome): atas 56 px, bawah 128–151 px.
const POTRET: Layar[] = [
  { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
  { nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 },
  { nama: 'HP 412×915 teks besar', w: 412, h: 915, d: 2.625, bawah: 150, teksBesar: true },
  { nama: 'tablet 820×1180', w: 820, h: 1180, d: 2, bawah: 148 },
];
const LANSKAP: Layar[] = [
  { nama: 'HP lanskap 844×390', w: 844, h: 390, d: 3, bawah: 128 },
  { nama: 'tablet lanskap 1180×820', w: 1180, h: 820, d: 2, bawah: 148 },
  { nama: 'desktop 1440×900', w: 1440, h: 900, d: 1, bawah: 151 },
  { nama: 'desktop 1280×720', w: 1280, h: 720, d: 1.5, bawah: 151 },
];
const SEMUA_LAYAR = [...POTRET, ...LANSKAP];

/** Sama dengan MejaScene.skalaTeks. */
function ukuran(l: Layar): UkuranLayar {
  const W = Math.round(l.w * l.d);
  const H = Math.round(l.h * l.d);
  const skala = Math.min(1.3, Math.max(1, Math.min(l.w, l.h) / 430)) * (l.teksBesar ? 1.15 : 1);
  return { W, H, d: l.d, atasCss: l.atas ?? 56, bawahCss: l.bawah ?? 139, skalaTeks: skala };
}

/** Permainan n pemain dengan putaran berjalan; bot bermain sampai buangan berisi ≥ n − 1 kartu. */
function permainan(n: number, seed = 7): GameState {
  let g = buatPermainan({ pemain: Array.from({ length: n }, (_, i) => `Pemain ${i + 1}`), seed });
  const mulai = terapkanAksi(g, { jenis: 'mulaiPutaran' });
  if (!mulai.ok) throw new Error(mulai.error.pesan);
  g = mulai.state;
  const rng = new Rng(seed);
  for (let i = 0; i < 400 && g.status === 'putaranBerjalan' && g.putaran!.buangan.length < n - 1; i++) {
    const h = terapkanAksi(g, pilihAksiBot(viewUntuk(g, g.putaran!.giliran), 'normal', rng));
    if (!h.ok) throw new Error(h.error.pesan);
    g = h.state;
  }
  if (g.status !== 'putaranBerjalan') throw new Error('putaran selesai sebelum buangan terisi');
  return g;
}

function info(v: ViewPemain): InfoMeja {
  return {
    kode: 'TEST',
    status: 'main',
    pengaturan: {} as InfoMeja['pengaturan'],
    kursi: v.pemain.map((p, i) => ({ jenis: i === 0 ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' }) as InfoMeja['kursi'][number]),
    host: 0,
    kursiSaya: 0,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
  };
}

function model(v: ViewPemain, ubah: Partial<ModelTata> = {}): ModelTata {
  return {
    view: v,
    info: info(v),
    tangan: v.putaran!.tangan[v.saya ?? 0] ?? [],
    dipilih: new Set(),
    pilihJumlahMulung: false,
    mulung: null,
    aksiTerakhir: {},
    disembunyikan: new Set(),
    bisaPungut: false,
    kartukuDiAtas: false,
    berikutnya: null,
    fokus: null,
    ...ubah,
  };
}

/** `jumlah` kartu berbeda (dua deck kalau perlu), untuk tangan buatan. */
function kartuTangan(jumlah: number): Kartu[] {
  const semua: Kartu[] = [];
  for (let deck = 0; deck < 2; deck++)
    for (const bunga of SEMUA_BUNGA) for (const rank of SEMUA_RANK) semua.push({ id: `${bunga}-${rank}-${deck}`, bunga, rank, deck });
  // Diacak tetap (bukan urut bunga) supaya mirip tangan sungguhan.
  return Array.from({ length: jumlah }, (_, i) => semua[(i * 17 + 5) % semua.length]);
}

/** Empat sudut persegi panjang (pusat cx, cy; lebar w, tinggi h) yang diputar `sudut` derajat. */
function sudutKotak(cx: number, cy: number, w: number, h: number, sudut: number): [number, number][] {
  const r = (sudut * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function diLuar(titik: [number, number][], k: Kotak, toleransi = 0.5): string[] {
  return titik
    .filter(([x, y]) => x < k.x - toleransi || x > k.x + k.w + toleransi || y < k.y - toleransi || y > k.y + k.h + toleransi)
    .map(([x, y]) => `(${x.toFixed(1)}, ${y.toFixed(1)})`);
}

const kartuTangan_ = (t: TataMeja): KartuTata[] => t.kartu.filter((k) => k.peran === 'tangan');

/** Perkiraan lebar teks info panel lawan (piksel perangkat), termasuk ikon kartu di panel ringkas. */
function lebarInfo(info: TeksTata, isi: string, u: UkuranLayar): number {
  const px = info.ukuran * u.skalaTeks * u.d;
  return kiraLebarTeks(isi, px, info.tebal) + (info.ikon === 'kartu' ? lebarIkonKartu(px) : 0);
}

/** Luas irisan dua kotak (0 = tidak tumpang tindih; bersentuhan tepi juga 0). */
function irisan(a: Kotak, b: Kotak): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// ---------------------------------------------------------------------------------------------
// Kartu tangan di dalam area tangan
// ---------------------------------------------------------------------------------------------

describe('kartu tangan tetap di dalam area tangan', () => {
  const v = viewUntuk(permainan(4), 0);
  for (const layar of SEMUA_LAYAR) {
    for (const jumlah of [6, 9, 12, 13]) {
      it(`${layar.nama}, ${jumlah} kartu: keempat sudut tiap kartu (dan bayangannya) di dalam area.tangan`, () => {
        const tangan = kartuTangan(jumlah);
        // Kartu paling kiri & paling kanan terpilih (terangkat), satu kartu di tengah difokus keyboard.
        const dipilih = new Set([tangan[0].id, tangan[jumlah - 1].id]);
        for (const varian of [model(v, { tangan }), model(v, { tangan, dipilih, fokus: tangan[Math.floor(jumlah / 2)].id })]) {
          const t = hitungTataMeja(varian, ukuran(layar));
          const area = t.area.tangan!;
          const kartu = kartuTangan_(t);
          expect(kartu).toHaveLength(jumlah);
          const salah: string[] = [];
          for (const k of kartu) {
            const h = k.w * RASIO_KARTU;
            const luar = diLuar(sudutKotak(k.x, k.y, k.w, h, k.sudut), area);
            if (luar.length) salah.push(`${k.kunci} sudut ${k.sudut.toFixed(2)}°: ${luar.join(' ')}`);
            // Inti bayangan (tanpa pinggiran buram) mengikuti rumus yang sama dengan scene.
            const b = geserBayangan(k.w, h, k.tinggi);
            const luarB = diLuar(sudutKotak(k.x + b.dx, k.y + b.dy, k.w * b.skala, h * b.skala, k.sudut), area);
            if (luarB.length) salah.push(`bayangan ${k.kunci}: ${luarB.join(' ')}`);
          }
          expect(salah, `area tangan ${JSON.stringify(area)}`).toEqual([]);
        }
      });
    }
  }

  it('kipas satu baris memang miring (test di atas benar-benar menguji kemiringan)', () => {
    const t = hitungTataMeja(model(v, { tangan: kartuTangan(6) }), ukuran(POTRET[1]));
    const sudut = kartuTangan_(t).map((k) => k.sudut);
    expect(Math.min(...sudut)).toBeLessThan(-3);
    expect(Math.max(...sudut)).toBeGreaterThan(3);
    // Kartu paling tepi miring ke luar: sudut terluarnya hampir menyentuh tepi area (ruang tidak dibuang percuma).
    const area = t.area.tangan!;
    const xs = kartuTangan_(t).flatMap((k) => sudutKotak(k.x, k.y, k.w, k.w * RASIO_KARTU, k.sudut).map(([x]) => x));
    expect(Math.min(...xs) - area.x).toBeLessThan(12 * 3);
  });
});

// ---------------------------------------------------------------------------------------------
// Deck tidak berubah ukuran saat kartu jadi pertama turun
// ---------------------------------------------------------------------------------------------

describe('deck & buangan tidak berubah ukuran saat kartu jadi pertama turun', () => {
  for (const n of [2, 4, 6]) {
    const g = permainan(n);
    const asli = viewUntuk(g, 0);
    // Sebelum: aku belum punya kartu jadi (lawan boleh sudah punya).
    const v: ViewPemain = { ...asli, putaran: { ...asli.putaran!, kartuJadi: asli.putaran!.kartuJadi.map((d, i) => (i === 0 ? [] : d)) } };
    const tangan = v.putaran!.tangan[0]!;
    // View sesudah turun: tiga kartu pertama tangan jadi kartu jadi (tata letak tidak memvalidasi aturan).
    const turun = tangan.slice(0, 3);
    const kj: KartuJadi = { id: 'kj-uji', pemilik: 0, jenis: 'seri', kartu: turun.map((k) => ({ kartu: k, sebagai: k, pengganti: false })) };
    const vSesudah: ViewPemain = {
      ...v,
      putaran: { ...v.putaran!, kartuJadi: v.putaran!.kartuJadi.map((d, i) => (i === 0 ? [kj] : d)), tangan: v.putaran!.tangan.map((d, i) => (i === 0 ? tangan.slice(3) : d)) },
    };
    for (const layar of SEMUA_LAYAR) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const sebelum = hitungTataMeja(model(v), u);
        const sesudah = hitungTataMeja(model(vSesudah), u);
        expect(sesudah.area.kartuJadiSaya).toBeDefined();
        expect(sebelum.area.kartuJadiSaya).toBeUndefined();
        const lantai = LANTAI_STABIL_CSS * u.d;
        if (sesudah.cw >= lantai - 0.01) {
          // Normal: kartu tangan, deck, dan buangan sama sekali tidak berubah ukuran.
          expect(sesudah.cw).toBeCloseTo(sebelum.cw, 3);
          expect(sesudah.area.deck!.w).toBeCloseTo(sebelum.area.deck!.w, 3);
          expect(sesudah.area.deck!.h).toBeCloseTo(sebelum.area.deck!.h, 3);
          expect(sesudah.titik.buangan!.w).toBeCloseTo(sebelum.titik.buangan!.w, 3);
        } else {
          // Layar sangat sempit: kartu hanya boleh mengecil di bawah lantai stabil, tidak dari atasnya.
          expect(sebelum.cw).toBeLessThanOrEqual(lantai + 0.01);
          expect(sesudah.cw).toBeLessThanOrEqual(sebelum.cw);
        }
        // Kartu jadiku tidak menimpa tangan, deck, maupun buangan, juga di layar yang paling sesak
        // (HP lanskap: kartu jadiku di samping deck/buangan; 6 pemain di HP 360×640: panel lawan ringkas).
        expect(irisan(sesudah.area.kartuJadiSaya!, sesudah.area.tangan!)).toBe(0);
        expect(irisan(sesudah.area.kartuJadiSaya!, sesudah.area.deck!)).toBe(0);
        expect(irisan(sesudah.area.kartuJadiSaya!, sesudah.area.buangan!)).toBe(0);
      });
    }
  }

  it('HP potret biasa & tablet selalu memakai ukuran stabil (di atas lantai) untuk 2–4 pemain', () => {
    for (const n of [2, 3, 4]) {
      const v = viewUntuk(permainan(n), 0);
      for (const layar of POTRET.slice(1)) {
        const u = ukuran(layar);
        expect(hitungTataMeja(model(v), u).cw, `${n} pemain, ${layar.nama}`).toBeGreaterThanOrEqual(LANTAI_STABIL_CSS * u.d);
      }
    }
  });

  it('HP lanskap: cadangan kartu jadi tidak memaksa kartu tangan ke desain mini (< 36 px) sejak awal', () => {
    const v = viewUntuk(permainan(3), 0);
    const u = ukuran(LANSKAP[0]);
    const t = hitungTataMeja(model(v, { view: { ...v, putaran: { ...v.putaran!, kartuJadi: v.putaran!.kartuJadi.map(() => []) } } }), u);
    expect(t.cw / u.d).toBeGreaterThan(36);
  });
});

// ---------------------------------------------------------------------------------------------
// Panel lawan
// ---------------------------------------------------------------------------------------------

describe('panel lawan tidak saling tumpang tindih', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const v = viewUntuk(permainan(n), 0);
    for (const layar of SEMUA_LAYAR) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const t = hitungTataMeja(model(v), u);
        const panel = [...t.area.panel.entries()];
        expect(panel.map(([pi]) => pi).sort()).toEqual(Array.from({ length: n - 1 }, (_, i) => i + 1));
        for (let i = 0; i < panel.length; i++) {
          const [pi, k] = panel[i];
          // Di dalam layar, dengan ukuran wajar.
          expect(k.w).toBeGreaterThan(0);
          expect(k.h).toBeGreaterThan(0);
          expect(k.x).toBeGreaterThanOrEqual(0);
          expect(k.y).toBeGreaterThanOrEqual(0);
          expect(k.x + k.w).toBeLessThanOrEqual(u.W + 0.5);
          expect(k.y + k.h).toBeLessThanOrEqual(u.H + 0.5);
          for (let j = i + 1; j < panel.length; j++) {
            expect(irisan(k, panel[j][1]), `panel ${pi} & ${panel[j][0]}`).toBe(0);
          }
          // Juga tidak menimpa deck, buangan, dan tangan.
          expect(irisan(k, t.area.deck!), `panel ${pi} & deck`).toBe(0);
          expect(irisan(k, t.area.buangan!), `panel ${pi} & buangan`).toBe(0);
          expect(irisan(k, t.area.tangan!), `panel ${pi} & tangan`).toBe(0);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Fokus keyboard
// ---------------------------------------------------------------------------------------------

describe('fokus keyboard', () => {
  const g = permainan(4);
  const v = viewUntuk(g, 0);
  const layar = ukuran(POTRET[1]);

  it("fokus 'buangan' menyorot kartu buangan teratas dengan sorot 'fokus'", () => {
    const t = hitungTataMeja(model(v, { fokus: 'buangan' }), layar);
    const buangan = t.kartu.filter((k) => k.peran === 'buangan');
    expect(buangan.length).toBeGreaterThan(0);
    const atas = v.putaran!.buangan[v.putaran!.buangan.length - 1].kartu.id;
    expect(buangan.find((k) => k.kartu?.id === atas)?.sorot).toBe('fokus');
    expect(buangan.filter((k) => k.sorot === 'fokus')).toHaveLength(1);
    // Tanpa fokus: tidak ada sorot fokus di mana pun.
    const tanpa = hitungTataMeja(model(v), layar);
    expect(tanpa.kartu.some((k) => k.sorot === 'fokus')).toBe(false);
    expect(tanpa.hias.some((h) => h.jenis === 'fokus')).toBe(false);
  });

  it("fokus 'buangan' menang atas tanda 'bisa' saat boleh mungut", () => {
    const t = hitungTataMeja(model(v, { fokus: 'buangan', bisaPungut: true }), layar);
    const buangan = t.kartu.filter((k) => k.peran === 'buangan');
    expect(buangan[buangan.length - 1].sorot).toBe('fokus');
    expect(buangan.slice(0, -1).every((k) => k.sorot === 'bisa')).toBe(true);
  });

  it("fokus 'buangan' saat buangan kosong: bingkai fokus di slot buangan", () => {
    const kosong: ViewPemain = { ...v, putaran: { ...v.putaran!, buangan: [], jumlahBuangan: 0 } };
    const t = hitungTataMeja(model(kosong, { fokus: 'buangan' }), layar);
    const fokus = t.hias.filter((h) => h.jenis === 'fokus');
    expect(fokus).toHaveLength(1);
    expect(irisan(fokus[0].kotak, t.area.buangan!)).toBeGreaterThan(0);
  });

  it("fokus 'deck' menyorot kartu deck teratas", () => {
    const t = hitungTataMeja(model(v, { fokus: 'deck' }), layar);
    const deck = t.kartu.filter((k) => k.peran === 'deck');
    expect(deck[deck.length - 1].sorot).toBe('fokus');
  });

  it('kartu tangan yang difokus naik sedikit, tapi tetap di bawah tetangga kanannya (cincin tidak menimpa indeksnya)', () => {
    const tangan = kartuTangan(9);
    const id = tangan[4].id;
    const biasa = hitungTataMeja(model(v, { tangan }), layar);
    const t = hitungTataMeja(model(v, { tangan, fokus: id }), layar);
    const k = kartuTangan_(t).find((x) => x.id === id)!;
    const asal = kartuTangan_(biasa).find((x) => x.id === id)!;
    expect(k.sorot).toBe('fokus');
    // Naik cukup terlihat (≥ 5 % tinggi kartu) tanpa pindah ke samping.
    expect(asal.y - k.y).toBeGreaterThanOrEqual(k.w * RASIO_KARTU * 0.05);
    expect(k.x).toBeCloseTo(asal.x, 3);
    // Lapis tetap: kartu kanan (yang menumpuk dan memuat indeks pojok kirinya) tetap di atas kartu fokus.
    expect(k.lapis).toBe(asal.lapis);
    const kanan = kartuTangan_(t).find((x) => x.id === tangan[5].id)!;
    expect(kanan.x).toBeGreaterThan(k.x);
    expect(kanan.lapis).toBeGreaterThan(k.lapis);
    // Kartu lain tidak bergeser.
    for (const lain of kartuTangan_(t)) {
      if (lain.id === id) continue;
      const b = kartuTangan_(biasa).find((x) => x.id === lain.id)!;
      expect([lain.x, lain.y, lain.lapis]).toEqual([b.x, b.y, b.lapis]);
    }
    // Kartu terpilih tetap lebih tinggi daripada sekadar difokus.
    const pilih = hitungTataMeja(model(v, { tangan, dipilih: new Set([id]) }), layar);
    expect(kartuTangan_(pilih).find((x) => x.id === id)!.y).toBeLessThan(k.y);
  });
});

// ---------------------------------------------------------------------------------------------
// Tidak ada area yang bertabrakan: 2..6 pemain × layar umum × teks normal/besar
// ---------------------------------------------------------------------------------------------

// Tinggi bar HTML diukur dengan Playwright (Vite dev, Chrome) di giliran ambil: bar atas 56 px; bar bawah
// tergantung layar & ukuran teks. Diuji juga dengan bar bawah 8 px lebih tinggi (petunjuk yang lebih panjang).
const MATRIKS: (Layar & { bawahBesar: number })[] = [
  { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139, bawahBesar: 143 },
  { nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139, bawahBesar: 143 },
  { nama: 'tablet 820×1180', w: 820, h: 1180, d: 2, bawah: 148, bawahBesar: 153 },
  { nama: 'HP lanskap 844×390', w: 844, h: 390, d: 3, bawah: 128, bawahBesar: 137 },
  { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128, bawahBesar: 137 },
  { nama: 'desktop 1440×900', w: 1440, h: 900, d: 1, bawah: 151, bawahBesar: 156 },
];

/** Kartu jadi buatan (tata letak tidak memvalidasi aturan): `kelompok` × 3 kartu, id unik per pemilik. */
function kartuJadiBuatan(pemilik: number, kelompok: number): KartuJadi[] {
  const semua = kartuTangan(104).slice(40);
  return Array.from({ length: kelompok }, (_, g) => ({
    id: `kj-${pemilik}-${g}`,
    pemilik,
    jenis: 'seri' as const,
    kartu: [0, 1, 2].map((j) => {
      const k = semua[(pemilik * 13 + g * 3 + j) % semua.length];
      const kartu = { ...k, id: `${k.id}-p${pemilik}` };
      return { kartu, sebagai: kartu, pengganti: false };
    }),
  }));
}

describe('area meja tidak saling bertabrakan (panel, deck, buangan, tangan, kartu jadiku)', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    const p0 = asli.putaran!;
    // Varian: awal putaran (aku belum punya kartu jadi), kartu jadiku 4 kelompok + lawan masing-masing
    // 4 kelompok, dan tangan penuh 13 kartu dengan kartu jadi.
    const tanpaJadiku: ViewPemain = { ...asli, putaran: { ...p0, kartuJadi: p0.kartuJadi.map((kj, i) => (i === 0 ? [] : kj)) } };
    const ramai: ViewPemain = { ...asli, putaran: { ...p0, kartuJadi: p0.kartuJadi.map((_, i) => kartuJadiBuatan(i, 4)) } };
    // Menyusun mulung: baris pungutan + kombinasi muncul sesaat di atas label diriku.
    const bu = p0.buangan.slice(-2).map((e) => e.kartu);
    const mulung: ModelTata['mulung'] = {
      jumlah: bu.length,
      sisaPungutan: bu,
      idPaling: bu[0].id,
      kombinasi: [{ kartu: kartuTangan(3).map((kartu) => ({ kartu })) }],
    };
    const varian: [string, ModelTata][] = [
      ['awal', model(tanpaJadiku)],
      ['kartu jadi ramai', model(ramai)],
      ['tangan 13 + kartu jadi', model(ramai, { tangan: kartuTangan(13) })],
      ['menyusun mulung', model(ramai, { mulung })],
    ];
    for (const layar of MATRIKS) {
      for (const besar of [false, true]) {
        const l: Layar = { ...layar, teksBesar: besar, bawah: besar ? layar.bawahBesar : layar.bawah };
        for (const tambahBawah of [0, 8]) {
          it(`${n} pemain, ${layar.nama}, teks ${besar ? 'besar' : 'normal'}, bar bawah ${l.bawah! + tambahBawah}`, () => {
            const u = ukuran({ ...l, bawah: l.bawah! + tambahBawah });
            const garisAtas = u.atasCss * u.d;
            const garisBawah = u.H - u.bawahCss * u.d;
            for (const [nama, mdl] of varian) {
              const t = hitungTataMeja(mdl, u);
              const area: [string, Kotak][] = [
                ['deck', t.area.deck!],
                ['buangan', t.area.buangan!],
                ['tangan', t.area.tangan!],
                ...[...t.area.panel.entries()].map(([pi, k]) => [`panel ${pi}`, k] as [string, Kotak]),
              ];
              if (t.area.kartuJadiSaya) area.push(['kartu jadiku', t.area.kartuJadiSaya]);
              // Baris mulung: kotak pembungkus kartu pungutan & kombinasi.
              const km = t.kartu.filter((k) => k.peran === 'pungutan' || k.peran === 'kombinasi');
              if (km.length) {
                const x0 = Math.min(...km.map((k) => k.x - k.w / 2));
                const y0 = Math.min(...km.map((k) => k.y - (k.w * RASIO_KARTU) / 2));
                const x1 = Math.max(...km.map((k) => k.x + k.w / 2));
                const y1 = Math.max(...km.map((k) => k.y + (k.w * RASIO_KARTU) / 2));
                area.push(['mulung', { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }]);
              }
              expect(area.every(([, k]) => k), nama).toBe(true);
              const salah: string[] = [];
              for (let i = 0; i < area.length; i++) {
                const [na, a] = area[i];
                // Di dalam layar & di antara bar HTML atas dan bawah.
                if (a.x < -0.5 || a.x + a.w > u.W + 0.5 || a.y < garisAtas - 0.5 || a.y + a.h > garisBawah + 0.5)
                  salah.push(`${na} keluar batas ${JSON.stringify(a)}`);
                for (let j = i + 1; j < area.length; j++) {
                  const [nb, b] = area[j];
                  if (irisan(a, b) > 0) salah.push(`${na} × ${nb}`);
                }
              }
              // Label di bawah deck tidak terpotong tepi layar walau deck-nya kecil.
              const labelDeck = t.teks.find((x) => x.kunci === 'deck-label')!;
              const lebarLabel = kiraLebarTeks(labelDeck.isi, labelDeck.ukuran * u.skalaTeks * u.d, labelDeck.tebal);
              if (labelDeck.x - lebarLabel / 2 < 0) salah.push(`label deck terpotong (x ${labelDeck.x.toFixed(0)})`);
              // ... dan tidak menjorok ke kolom info (arah/giliran/putaran) di kanannya. Saat menyusun mulung di
              // HP lanskap kolom info disembunyikan (deck & buangan ringkas): label deck tidak menimpa buangan.
              const lebarAmbil = kiraLebarTeks('ketuk = ambil', labelDeck.ukuran * u.skalaTeks * u.d, true);
              const arah = t.teks.find((x) => x.kunci === 'arah');
              if (arah && labelDeck.x + lebarAmbil / 2 > arah.x + 0.5) salah.push('label deck menimpa kolom info');
              if (!arah && labelDeck.x + lebarLabel / 2 > t.area.buangan!.x + 0.5) salah.push('label deck menimpa buangan');
              // Kartu jadi lawan tetap di dalam panelnya.
              for (const [pi, k] of t.area.panel) {
                for (const kj of mdl.view.putaran!.kartuJadi[pi] ?? []) {
                  for (const dk of kj.kartu) {
                    const kt = t.kartu.find((x) => x.kunci === `j:${dk.kartu.id}`);
                    if (!kt) {
                      salah.push(`kartu jadi ${dk.kartu.id} panel ${pi} tidak tergambar`);
                      continue;
                    }
                    const luar = diLuar(sudutKotak(kt.x, kt.y, kt.w, kt.w * RASIO_KARTU, 0), k, 1);
                    if (luar.length) salah.push(`kartu jadi ${dk.kartu.id} keluar panel ${pi}`);
                  }
                }
              }
              expect(salah, `${nama}: cw ${(t.cw / u.d).toFixed(1)} px, panel ${JSON.stringify(t.susunanPanel)}: ${salah.join('; ')}`).toEqual([]);
            }
          });
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Panel lawan ringkas & teks yang terpotong
// ---------------------------------------------------------------------------------------------

describe('panel lawan ringkas saat tumpukan panel tidak muat', () => {
  const hpKecilBesar = ukuran({ nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true });

  it('HP 360×640 teks besar, 6 pemain: panel ringkas dua kolom, kartu tidak dipaksa ke ukuran minimum', () => {
    const v0 = viewUntuk(permainan(6), 0);
    const v: ViewPemain = { ...v0, pemain: v0.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[i + 1] })) };
    const t = hitungTataMeja(model(v), hpKecilBesar);
    // Dua baris kepala (nama, lalu info): panel selebar 169 px tidak muat nama warga kedai + info patokan sebaris.
    expect(t.susunanPanel).toEqual({ kolom: 2, barisKepala: 2, ringkas: true });
    // Nama pendek ('Pemain 2'): nama & info ringkas muat sebaris (kepala lebih pendek, kartu jadi lawan lebih besar).
    expect(hitungTataMeja(model(v0), hpKecilBesar).susunanPanel).toEqual({ kolom: 2, barisKepala: 1, ringkas: true });
    expect(t.cw / hpKecilBesar.d).toBeGreaterThan(36);
    // Tiga baris panel (2 + 2 + 1).
    const ys = [...new Set([...t.area.panel.values()].map((k) => Math.round(k.y)))];
    expect(ys).toHaveLength(3);
  });

  it('HP 360×640 teks besar, 5 pemain: deck & buangan tidak lagi menimpa tangan', () => {
    const t = hitungTataMeja(model(viewUntuk(permainan(5), 0)), hpKecilBesar);
    expect(t.susunanPanel?.ringkas).toBe(true);
    expect(irisan(t.area.deck!, t.area.tangan!)).toBe(0);
    expect(irisan(t.area.buangan!, t.area.tangan!)).toBe(0);
  });

  it('layar lega tetap memakai panel biasa (tidak diringkas tanpa perlu)', () => {
    for (const [n, layar] of [
      [3, POTRET[1]],
      [6, POTRET[3]],
      [4, LANSKAP[2]],
    ] as const) {
      const u = ukuran(layar);
      const t = hitungTataMeja(model(viewUntuk(permainan(n), 0)), u);
      expect(t.susunanPanel?.ringkas, `${n} pemain, ${layar.nama}`).toBe(false);
      expect(t.cw / u.d).toBeGreaterThanOrEqual(CW_NYAMAN_CSS);
    }
  });

  it('susunan panel tidak berganti saat menyusun mulung (baris mulung hanya sesaat)', () => {
    const v = viewUntuk(permainan(5), 0);
    const atas = v.putaran!.buangan[v.putaran!.buangan.length - 1].kartu;
    const biasa = hitungTataMeja(model(v), hpKecilBesar);
    const mulung = hitungTataMeja(model(v, { mulung: { jumlah: 1, sisaPungutan: [atas], idPaling: atas.id, kombinasi: [] } }), hpKecilBesar);
    expect(mulung.susunanPanel).toEqual(biasa.susunanPanel);
  });

  it('aksi terakhir di panel ringkas ada di sisa baris kartu jadi, tidak menimpa kartu jadinya', () => {
    const asli = viewUntuk(permainan(6), 0);
    const v: ViewPemain = { ...asli, putaran: { ...asli.putaran!, kartuJadi: asli.putaran!.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 1 ? 2 : 0)) } };
    const aksiTerakhir = { 1: 'ambil deck · turun kartu jadi', 2: 'buang 7♥' };
    const t = hitungTataMeja(model(v, { aksiTerakhir }), hpKecilBesar);
    expect(t.susunanPanel?.ringkas).toBe(true);
    for (const pi of [1, 2]) {
      const panel = t.area.panel.get(pi)!;
      const tag = t.teks.find((x) => x.kunci === `p${pi}-aksi`)!;
      expect(tag, `aksi panel ${pi}`).toBeDefined();
      const kiri = tag.ox === 1 ? tag.x - tag.maks! : tag.x;
      const kanan = tag.ox === 1 ? tag.x : tag.x + tag.maks!;
      expect(kiri).toBeGreaterThanOrEqual(panel.x);
      expect(kanan).toBeLessThanOrEqual(panel.x + panel.w + 0.5);
      // Di bawah baris kepala (bukan di baris nama/info).
      const info = t.teks.find((x) => x.kunci === `p${pi}-info`)!;
      expect(tag.y).toBeGreaterThan(info.y);
      const jadi = t.kartu.filter((x) => x.peran === 'jadi' && x.x >= panel.x && x.x <= panel.x + panel.w && x.y >= panel.y && x.y <= panel.y + panel.h);
      for (const k of jadi) expect(kiri, `aksi panel ${pi} vs kartu jadi`).toBeGreaterThanOrEqual(k.x + k.w / 2);
    }
    // Panel tanpa kartu jadi & tanpa aksi: tetap ada tulisan 'belum ada kartu jadi'.
    expect(t.teks.some((x) => x.kunci === 'p3-kosong')).toBe(true);
  });
});

describe('jumlah kartu & skor lawan selalu kebagian tempat', () => {
  for (const n of [2, 4, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    // Skor panjang, lawan pertama tinggal 1 kartu, nama panjang.
    const v: ViewPemain = {
      ...asli,
      pemain: asli.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: `Pemain Bernama Panjang ${i}` })),
      skor: asli.skor.map((_, i) => (i % 2 ? -1250 : 1375)),
      putaran: { ...asli.putaran!, jumlahKartuTangan: asli.putaran!.jumlahKartuTangan.map((j, i) => (i === 1 ? 1 : j)) },
    };
    const layarUji: Layar[] = [...SEMUA_LAYAR, { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true }];
    for (const layar of layarUji) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const t = hitungTataMeja(model(v, { aksiTerakhir: { 1: 'ambil deck · turun kartu jadi · buang 7♥' } }), u);
        for (const pi of t.area.panel.keys()) {
          const info = t.teks.find((x) => x.kunci === `p${pi}-info`)!;
          // Bagian penting = dua potong pertama: jumlah kartu (atau peringatan tinggal 1) · skor.
          const penting = info.isi.split(' · ').slice(0, 2).join(' · ');
          // Panel ringkas: ikon kartu + angka ("▮10", tinggal 1: "▮1!"); panel lain: "10 kartu" / "TINGGAL 1!".
          const jumlah = v.putaran!.jumlahKartuTangan[pi];
          const depan = info.ikon === 'kartu' ? (pi === 1 ? /^1!$/ : new RegExp(`^${jumlah}$`)) : pi === 1 ? /^TINGGAL 1!$/ : new RegExp(`^${jumlah} kartu$`);
          expect(penting.split(' · ')[0]).toMatch(depan);
          // Skor negatif memakai minus tipografis U+2212, sama dengan angka skor di HTML (angkaSkor).
          expect(penting.split(' · ')[1]).toBe(angkaSkorKanvas(v.skor[pi]));
          expect(info.maks!, `panel ${pi}: ${penting}`).toBeGreaterThanOrEqual(lebarInfo(info, penting, u));
        }
      });
    }
  }
});

describe('label nama pembuang di bawah buangan', () => {
  it('inisialNama: nama beberapa kata jadi inisial (maks 3 huruf), satu kata tidak', () => {
    expect(inisialNama('Bot 1')).toBe('B1');
    expect(inisialNama('budi santoso')).toBe('BS');
    expect(inisialNama('Pak Haji Udin Ganteng')).toBe('PHU');
    expect(inisialNama('Penguji')).toBeNull();
    expect(inisialNama('  ')).toBeNull();
  });

  it('labelSempit: lengkap, lalu inisial, lalu dipotong (minimal 3 huruf), selain itu disembunyikan', () => {
    const px = 10;
    expect(labelSempit('Bot 1', 100, px)).toEqual({ isi: 'Bot 1', minHuruf: 3 });
    expect(labelSempit('Bot 1', 16, px)).toEqual({ isi: 'B1', minHuruf: 2 });
    expect(labelSempit('Penguji', 25, px)).toEqual({ isi: 'Penguji', minHuruf: 3 });
    expect(labelSempit('Penguji', 12, px)).toBeNull();
    expect(labelSempit('Bot 1', 8, px)).toBeNull();
    expect(labelSempit('', 100, px)).toBeNull();
  });

  it('label buangan tidak pernah tinggal satu huruf + elipsis', () => {
    for (const n of [3, 4, 6]) {
      for (const layar of SEMUA_LAYAR) {
        const u = ukuran(layar);
        const t = hitungTataMeja(model(viewUntuk(permainan(n), 0)), u);
        for (const tk of t.teks.filter((x) => x.kunci.startsWith('b-nama:'))) {
          const muat = kiraLebarTeks(tk.isi, tk.ukuran * u.skalaTeks * u.d) <= tk.maks!;
          // Muat utuh, atau kalau dipotong scene minimal menyisakan 3 huruf (selain itu disembunyikan).
          expect(muat || (tk.minHuruf ?? 1) >= 3, `${n} pemain, ${layar.nama}: ${tk.isi} maks ${tk.maks}`).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Menyusun mulung: pungutan terbaca, tidak menimpa apa pun, kartu jadiku tetap tampil
// ---------------------------------------------------------------------------------------------

/**
 * Batas bawah lebar kartu pungutan (px CSS) di layar yang paling sesak (HP lanskap 740×360 teks besar,
 * tinggi meja ±150 px): di bawah BATAS_MINI_CSS kartu memakai desain mini berindeks raksasa yang tetap
 * terbaca. Layar lain wajib mencapai min(LEBAR_PUNGUTAN_CSS, lebar kartu tangan).
 */
const PUNGUTAN_MIN_SESAK_CSS = 28;
/** Kartu kombinasi (diketuk sebagai satu kelompok) paling kecil, px CSS. */
const KOMBINASI_MIN_CSS = 21;

describe('menyusun mulung: kartu pungutan tetap terbaca & kartu jadiku tetap tampil', () => {
  const layarMulung: (Layar & { sesak?: boolean })[] = [
    { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
    { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
    { nama: 'HP 390×844 teks besar', w: 390, h: 844, d: 3, bawah: 143, teksBesar: true },
    { nama: 'HP lanskap 844×390', w: 844, h: 390, d: 3, bawah: 128 },
    { nama: 'HP lanskap 844×390 teks besar', w: 844, h: 390, d: 3, bawah: 137, teksBesar: true },
    { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128 },
    { nama: 'HP lanskap 740×360 teks besar', w: 740, h: 360, d: 2, bawah: 137, teksBesar: true, sesak: true },
    { nama: 'desktop 1440×900', w: 1440, h: 900, d: 1, bawah: 151 },
  ];
  /** Kartu buatan yang tidak bentrok id-nya dengan kartu di view. */
  const buatan = (awalan: string, jumlah: number, mulai = 0): Kartu[] =>
    kartuTangan(jumlah + mulai)
      .slice(mulai)
      .map((k) => ({ ...k, id: `${awalan}-${k.id}` }));
  const kotakKartu = (k: KartuTata): Kotak => ({ x: k.x - k.w / 2, y: k.y - (k.w * RASIO_KARTU) / 2, w: k.w, h: k.w * RASIO_KARTU });

  for (const n of [2, 3, 4, 5, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    // Aku sudah punya 3 kartu jadi (9 kartu); lawan juga punya kartu jadi.
    const jadiku: KartuJadi[] = [0, 1, 2].map((g) => ({
      id: `kj-saya-${g}`,
      pemilik: 0,
      jenis: 'seri',
      kartu: buatan(`saya${g}`, 3, g * 3).map((kartu) => ({ kartu, sebagai: kartu, pengganti: false })),
    }));
    const v: ViewPemain = {
      ...asli,
      putaran: { ...asli.putaran!, kartuJadi: asli.putaran!.kartuJadi.map((_, i) => (i === 0 ? jadiku : kartuJadiBuatan(i, 2))) },
    };
    // Pungutan 1..maks (n − 1): semua masih di baris pungutan, kartu wajib sudah dijadikan, dan ramai
    // (sampai tiga kombinasi 4 + 3 + 3, sisanya masih di baris pungutan).
    const kombinasi = (ukuranKomb: number[]) => {
      let awal = 30;
      return ukuranKomb.map((c, i) => ({ kartu: buatan(`komb${i}`, c, (awal += c) - c).map((kartu) => ({ kartu })) }));
    };
    const kasus: [string, NonNullable<ModelTata['mulung']>][] = [];
    for (let j = 1; j <= n - 1; j++) {
      const pungutan = buatan('pung', j, 20);
      const c = Math.min(3, j);
      kasus.push([`pungutan ${j}`, { jumlah: j, sisaPungutan: pungutan, idPaling: pungutan[0].id, kombinasi: [] }]);
      kasus.push([`pungutan ${j}, wajib dijadikan`, { jumlah: j, sisaPungutan: pungutan.slice(1), idPaling: pungutan[0].id, kombinasi: kombinasi([3]) }]);
      kasus.push([`pungutan ${j}, ramai`, { jumlah: j, sisaPungutan: pungutan.slice(c), idPaling: pungutan[0].id, kombinasi: kombinasi([4, 3, 3].slice(0, c)) }]);
    }
    for (const layar of layarMulung) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const garisAtas = u.atasCss * u.d;
        const garisBawah = u.H - u.bawahCss * u.d;
        const salah: string[] = [];
        for (const [nama, mulung] of kasus) {
          const t = hitungTataMeja(model(v, { tangan: kartuTangan(8), mulung }), u);
          const cwCss = t.cw / u.d;
          const minP = layar.sesak ? PUNGUTAN_MIN_SESAK_CSS : Math.min(LEBAR_PUNGUTAN_CSS, cwCss) - 0.5;
          const pung = t.kartu.filter((k) => k.peran === 'pungutan');
          const komb = t.kartu.filter((k) => k.peran === 'kombinasi');
          expect(pung).toHaveLength(mulung.sisaPungutan.length);
          expect(komb).toHaveLength(mulung.kombinasi.reduce((a, kb) => a + kb.kartu.length, 0));
          for (const k of pung) if (k.w / u.d < minP) salah.push(`${nama}: pungutan ${(k.w / u.d).toFixed(1)} px < ${minP.toFixed(1)}`);
          for (const k of komb) if (k.w / u.d < KOMBINASI_MIN_CSS) salah.push(`${nama}: kombinasi ${(k.w / u.d).toFixed(1)} px`);
          // Kartu jadiku tetap tergambar, di dalam area.kartuJadiSaya.
          const kotakJadi = t.area.kartuJadiSaya;
          if (!kotakJadi) salah.push(`${nama}: area.kartuJadiSaya kosong`);
          for (const kj of jadiku)
            for (const dk of kj.kartu) {
              const kt = t.kartu.find((x) => x.kunci === `j:${dk.kartu.id}`);
              if (!kt) salah.push(`${nama}: kartu jadiku ${dk.kartu.id} tidak tergambar`);
              else if (kotakJadi && diLuar(sudutKotak(kt.x, kt.y, kt.w, kt.w * RASIO_KARTU, 0), kotakJadi, 1).length) salah.push(`${nama}: kartu jadiku keluar areanya`);
            }
          // Kartu mulung tidak menimpa area lain, satu sama lain (kecuali di dalam satu kombinasi), dan tetap
          // di antara bar HTML atas & bawah.
          const area: [string, Kotak][] = [
            ['deck', t.area.deck!],
            ['buangan', t.area.buangan!],
            ['tangan', t.area.tangan!],
            ...[...t.area.panel.entries()].map(([pi, k]) => [`panel ${pi}`, k] as [string, Kotak]),
          ];
          if (kotakJadi) area.push(['kartu jadiku', kotakJadi]);
          const km = [...pung, ...komb];
          for (const k of km) {
            const b = kotakKartu(k);
            if (b.x < -0.5 || b.x + b.w > u.W + 0.5 || b.y < garisAtas - 0.5 || b.y + b.h > garisBawah + 0.5) salah.push(`${nama}: ${k.kunci} keluar batas`);
            for (const [na, a] of area) if (irisan(b, a) > 0) salah.push(`${nama}: ${k.kunci} × ${na}`);
          }
          for (let i = 0; i < km.length; i++)
            for (let j = i + 1; j < km.length; j++) {
              const satuKombinasi =
                km[i].peran === 'kombinasi' && km[j].peran === 'kombinasi' && km[i].kunci.split(':')[1] === km[j].kunci.split(':')[1];
              if (!satuKombinasi && irisan(kotakKartu(km[i]), kotakKartu(km[j])) > 0) salah.push(`${nama}: ${km[i].kunci} × ${km[j].kunci}`);
            }
          // Judul baris mulung muat (tidak dipotong '…'), dan tidak menimpa kartu di bawahnya.
          const judul = t.teks.find((x) => x.kunci === 'mulung-judul')!;
          if (kiraLebarTeks(judul.isi, judul.ukuran * u.skalaTeks * u.d, true) > judul.maks!) salah.push(`${nama}: judul terpotong '${judul.isi}'`);
          const atasKartu = Math.min(...km.map((k) => kotakKartu(k).y));
          if (judul.y + judul.ukuran * u.skalaTeks * u.d * 1.25 > atasKartu + 0.5) salah.push(`${nama}: judul menimpa kartu`);
        }
        expect(salah).toEqual([]);
      });
    }
  }

  it('judulMulung: lengkap di layar lebar, dipendekkan di layar sempit, tidak pernah kosong', () => {
    const u = ukuran(POTRET[1]);
    expect(judulMulung(3, 2000 * u.d, u)).toBe('Pungutan (3) · kartu bertanda emas wajib dijadikan');
    const sempit = judulMulung(3, 200 * u.d, u);
    expect(sempit.startsWith('Pungutan (3)')).toBe(true);
    expect(kiraLebarTeks(sempit, 12 * u.skalaTeks * u.d, true)).toBeLessThanOrEqual(200 * u.d);
    expect(judulMulung(5, 10, u)).toBe('Pungutan (5)');
  });

  it('HP lanskap: selama menyusun mulung kartu tangan tidak bergeser dan panel lawan tetap', () => {
    const v = viewUntuk(permainan(4), 0);
    const u = ukuran(LANSKAP[0]);
    const atas = v.putaran!.buangan[v.putaran!.buangan.length - 1].kartu;
    const tangan = kartuTangan(8);
    const biasa = hitungTataMeja(model(v, { tangan }), u);
    const mulung = hitungTataMeja(model(v, { tangan, mulung: { jumlah: 1, sisaPungutan: [atas], idPaling: atas.id, kombinasi: [] } }), u);
    expect(mulung.cw).toBeCloseTo(biasa.cw, 5);
    expect(mulung.area.tangan).toEqual(biasa.area.tangan);
    expect(kartuTangan_(mulung).map((k) => [k.x, k.y])).toEqual(kartuTangan_(biasa).map((k) => [k.x, k.y]));
    expect([...mulung.area.panel.values()]).toEqual([...biasa.area.panel.values()]);
  });
});

// ---------------------------------------------------------------------------------------------
// Aksi terakhir lawan di panel sempit: ditampilkan apa adanya, dipotong di ujung (netral, keputusan #29)
// ---------------------------------------------------------------------------------------------

describe('aksi terakhir di panel lawan', () => {
  const panjang = 'ambil deck · turun kartu jadi · buang 7♥';

  for (const layar of [LANSKAP[2], LANSKAP[3], LANSKAP[0], POTRET[0]]) {
    it(`6 pemain, ${layar.nama}: teks aksi tidak diatur ulang (tidak mendahulukan 'buang X'), jumlah kartu & skor tetap utuh`, () => {
      const v = viewUntuk(permainan(6), 0);
      const u = ukuran(layar);
      const aksiTerakhir = Object.fromEntries([1, 2, 3, 4, 5].map((pi) => [pi, panjang]));
      const t = hitungTataMeja(model(v, { aksiTerakhir }), u);
      const tag = t.teks.filter((x) => /^p\d-aksi$/.test(x.kunci));
      expect(tag.length).toBeGreaterThan(0);
      for (const x of tag) {
        // Isi utuh; kalau tidak muat, scene memotong di UJUNG (pasTeks) dengan minimal 3 huruf.
        expect(x.isi).toBe(panjang);
        expect(x.minHuruf).toBe(3);
        expect(x.maks).toBeGreaterThan(0);
      }
      for (const pi of t.area.panel.keys()) {
        const info = t.teks.find((x) => x.kunci === `p${pi}-info`)!;
        const penting = info.isi.split(' · ').slice(0, 2).join(' · ');
        expect(info.maks!, `panel ${pi}`).toBeGreaterThanOrEqual(lebarInfo(info, penting, u));
      }
    });
  }
});

// ---------------------------------------------------------------------------------------------
// Label diriku tidak tertutup kartu tangan yang terpilih (kartu paling kiri, desktop & lainnya)
// ---------------------------------------------------------------------------------------------

/**
 * Tepi atas kartu tangan terpilih yang terlihat: kartu miring + cincin sorot (pinggiran tegas ±0,06 lebar
 * kartu di luar tepinya, tekstur pendukung PAD_PENDUKUNG) + pembesaran hover 3 % (desktop).
 */
function atasTerlihat(k: KartuTata): number {
  const skala = 1.03;
  const cincin = k.w * 0.06;
  expect(cincin).toBeLessThan(k.w * PAD_PENDUKUNG);
  const w = k.w * skala + 2 * cincin;
  const h = k.w * RASIO_KARTU * skala + 2 * cincin;
  return Math.min(...sudutKotak(k.x, k.y, w, h, k.sudut).map(([, y]) => y));
}

describe('label diriku & kartu jadiku tidak tertutup kartu tangan yang terpilih', () => {
  for (const n of [2, 4, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    const p0 = asli.putaran!;
    const tanpaJadi: ViewPemain = { ...asli, putaran: { ...p0, kartuJadi: p0.kartuJadi.map((kj, i) => (i === 0 ? [] : kj)) } };
    const denganJadi: ViewPemain = { ...asli, putaran: { ...p0, kartuJadi: p0.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 0 ? 2 : 1)) } };
    for (const layar of [...SEMUA_LAYAR, { nama: 'desktop 1440×900 teks besar', w: 1440, h: 900, d: 1, bawah: 156, teksBesar: true }]) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const salah: string[] = [];
        for (const [namaV, v] of [['tanpa kartu jadi', tanpaJadi], ['dengan kartu jadi', denganJadi]] as const) {
          for (const jumlah of [6, 9, 13]) {
            const tangan = kartuTangan(jumlah);
            // Kartu paling kiri, paling kanan, dan tengah terpilih (terangkat).
            const dipilih = new Set([tangan[0].id, tangan[Math.floor(jumlah / 2)].id, tangan[jumlah - 1].id]);
            const t = hitungTataMeja(model(v, { tangan, dipilih }), u);
            const label = t.teks.find((x) => x.kunci === 'saya-nama')!;
            const bawahLabel = label.y + label.ukuran * u.skalaTeks * u.d * 1.25;
            const terpilih = kartuTangan_(t).filter((k) => dipilih.has(k.id!));
            expect(terpilih).toHaveLength(3);
            // Hanya baris pertama tangan yang berbatasan dengan label (tangan bertingkat: baris bawah menumpuk).
            const yBarisAtas = Math.min(...kartuTangan_(t).map((k) => k.y)) + k0(t) * 0.7;
            for (const k of terpilih) {
              if (k.y > yBarisAtas) continue;
              const atas = atasTerlihat(k);
              if (atas < bawahLabel - 0.5) salah.push(`${namaV}, ${jumlah} kartu: ${k.kunci} (x ${(k.x / u.d).toFixed(0)}) menutup label ${(bawahLabel - atas).toFixed(1)} px`);
              const jadi = t.area.kartuJadiSaya;
              if (jadi && irisan(jadi, { x: k.x - k.w / 2, y: atas, w: k.w, h: k.y - atas }) > 0)
                salah.push(`${namaV}, ${jumlah} kartu: ${k.kunci} menutup kartu jadiku`);
            }
            // Ruangnya memang dicadangkan di dalam area tangan (kartu tidak keluar dari area.tangan).
            expect(t.area.tangan!.y).toBeLessThanOrEqual(Math.min(...terpilih.map((k) => k.y - (k.w * RASIO_KARTU) / 2)) - ruangSorotTangan(t.cw, u.d) + 0.5);
          }
        }
        expect(salah).toEqual([]);
      });
    }
  }
});

/** Tinggi kartu tangan (untuk memisahkan baris kipas bertingkat). */
function k0(t: TataMeja): number {
  return t.cw * RASIO_KARTU;
}

// ---------------------------------------------------------------------------------------------
// Buangan: '+N' (kartu di bawah tumpukan) terlihat, termasuk saat menyusun mulung di HP lanskap
// ---------------------------------------------------------------------------------------------

describe("label '+N' buangan terlihat", () => {
  const layarUji: Layar[] = [
    ...SEMUA_LAYAR,
    { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128 },
    { nama: 'HP lanskap 740×360 teks besar', w: 740, h: 360, d: 2, bawah: 137, teksBesar: true },
    { nama: 'HP lanskap 844×390 teks besar', w: 844, h: 390, d: 3, bawah: 137, teksBesar: true },
    { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
  ];
  const kotakKartu = (k: KartuTata): Kotak => ({ x: k.x - k.w / 2, y: k.y - (k.w * RASIO_KARTU) / 2, w: k.w, h: k.w * RASIO_KARTU });
  for (const n of [3, 4, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    // Buangan berisi lebih banyak kartu daripada yang ditampilkan (n − 1): ada kartu 'lebih' di bawahnya.
    // Nama warga kedai bawaan (label pembuang jadi inisial, mis. 'OG').
    const v: ViewPemain = {
      ...asli,
      pemain: asli.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[(i + 7) % NAMA_LAWAN_BAWAAN.length] })),
      putaran: { ...asli.putaran!, jumlahBuangan: asli.putaran!.buangan.length + 11 },
    };
    const atas = v.putaran!.buangan.slice(-2).map((e) => e.kartu);
    const varian: [string, Partial<ModelTata>][] = [
      ['biasa', {}],
      ['menyusun mulung', { mulung: { jumlah: atas.length, sisaPungutan: atas, idPaling: atas[0].id, kombinasi: [] } }],
    ];
    for (const layar of layarUji) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const salah: string[] = [];
        for (const [nama, ubah] of varian) {
          const t = hitungTataMeja(model(v, { tangan: kartuTangan(8), ...ubah }), u);
          const lebih = t.kartu.find((k) => k.peran === 'lebih')!;
          const label = t.teks.find((x) => x.kunci === 'lebih-label')!;
          expect(label.isi).toBe(`+${v.putaran!.jumlahBuangan - (n - 1)}`);
          const px = label.ukuran * u.skalaTeks * u.d;
          const lebar = kiraLebarTeks(label.isi, px, label.tebal);
          const kotak: Kotak = { x: label.x - lebar * (label.ox ?? 0), y: label.y - px * 0.625 * (label.oy ? 1 : 0), w: lebar, h: px * 1.25 };
          const buangan = t.kartu.filter((k) => k.peran === 'buangan');
          if (label.lapis !== undefined) {
            // Di atas kartu 'lebih', di bawah kartu buangan; jadi tidak boleh tertutup kartu buangan mana pun.
            if (!(label.lapis > lebih.lapis && buangan.every((k) => k.lapis > label.lapis!))) salah.push(`${nama}: lapis ${label.lapis}`);
            if (irisan(kotak, kotakKartu(lebih)) <= 0) salah.push(`${nama}: label tidak di kartu 'lebih'`);
          } else if (label.y < kotakKartu(lebih).y + kotakKartu(lebih).h - 0.5) salah.push(`${nama}: label bawah menimpa tumpukan`);
          // Tidak tertutup kartu buangan (lapis teks biasa ada di bawah semua kartu) dan tidak menimpa label deck.
          for (const k of buangan) {
            const b = kotakKartu(k);
            const r = (Math.abs(k.sudut) * Math.PI) / 180;
            const tumpang = irisan(kotak, { x: b.x - b.h * Math.sin(r) / 2, y: b.y, w: b.w + b.h * Math.sin(r), h: b.h });
            if (tumpang > 0) salah.push(`${nama}: label tertutup ${k.kunci} (${(tumpang / (u.d * u.d)).toFixed(1)} px²)`);
          }
          const deck = t.teks.find((x) => x.kunci === 'deck-label')!;
          const lebarDeck = kiraLebarTeks(deck.isi, deck.ukuran * u.skalaTeks * u.d, deck.tebal);
          if (label.lapis === undefined && Math.abs(deck.y - label.y) < px && deck.x + lebarDeck / 2 > kotak.x - 0.5) salah.push(`${nama}: menimpa label deck`);
          if (kotak.x < -0.5 || kotak.x + kotak.w > u.W + 0.5) salah.push(`${nama}: keluar layar`);
          // Tidak menempel ke nama pembuang kartu pertama ('+9OG'): kotak teksnya tidak beririsan dan berjarak.
          const namaPertama = t.teks.find((x) => x.kunci === 'b-nama:0');
          if (namaPertama && label.lapis === undefined) {
            const pxN = namaPertama.ukuran * u.skalaTeks * u.d;
            const kotakNama: Kotak = { x: namaPertama.x, y: namaPertama.y, w: Math.min(namaPertama.maks!, kiraLebarTeks(namaPertama.isi, pxN)), h: pxN * 1.25 };
            const kotakPlus: Kotak = { ...kotak, x: kotak.x - 2 * u.d, w: kotak.w + 4 * u.d };
            if (irisan(kotakPlus, kotakNama) > 0) salah.push(`${nama}: '+N' menempel ke nama '${namaPertama.isi}'`);
          }
        }
        expect(salah).toEqual([]);
      });
    }
  }

  it('HP lanskap, menyusun mulung: pojok indeks tiap kartu buangan ringkas masih kelihatan (≥ 30 % lebar)', () => {
    const v = viewUntuk(permainan(6), 0);
    for (const layar of [LANSKAP[0], { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128 }]) {
      const u = ukuran(layar);
      const atas = v.putaran!.buangan.slice(-1).map((e) => e.kartu);
      const t = hitungTataMeja(model(v, { tangan: kartuTangan(8), mulung: { jumlah: 1, sisaPungutan: atas, idPaling: atas[0].id, kombinasi: [] } }), u);
      const b = t.kartu.filter((k) => k.peran === 'buangan').sort((p, q) => p.x - q.x);
      expect(b.length).toBe(5);
      for (let i = 1; i < b.length; i++) expect(b[i].x - b[i - 1].x, layar.nama).toBeGreaterThanOrEqual(b[i].w * 0.3);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Nama lawan (warga kedai) & penanda kursi otomatis
// ---------------------------------------------------------------------------------------------

describe('nama lawan warga kedai & penanda kursi', () => {
  it('nama bawaan: inisial dan label sempit unik (tidak bisa tertukar di bawah buangan)', () => {
    const inisial = NAMA_LAWAN_BAWAAN.map((n) => inisialNama(n));
    expect(inisial.every((x) => x && x.length === 2)).toBe(true);
    expect(new Set(inisial).size).toBe(NAMA_LAWAN_BAWAAN.length);
    for (const lebar of [16, 30, 60, 200]) {
      const label = NAMA_LAWAN_BAWAAN.map((n) => labelSempit(n, lebar, 10));
      const isi = label.filter(Boolean).map((l) => l!.isi);
      expect(new Set(isi).size, `lebar ${lebar}`).toBe(isi.length);
    }
  });

  it("kursi warga kedai ditandai ikon kecil (bukan teks 'bot'); level tidak tercermin; manusia tanpa ikon", () => {
    const v0 = viewUntuk(permainan(4), 0);
    const v: ViewPemain = { ...v0, pemain: v0.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[i - 1] })) };
    const u = ukuran(LANSKAP[2]);
    const i = info(v);
    i.kursi[1] = { ...i.kursi[1], level: 'mudah' };
    i.kursi[3] = { ...i.kursi[3], jenis: 'manusia' };
    const t = hitungTataMeja({ ...model(v), info: i }, u);
    const infoTeks = (pi: number) => t.teks.find((x) => x.kunci === `p${pi}-info`)!.isi;
    expect(infoTeks(1).endsWith(` · ${PENANDA_WARGA_KEDAI.ikon}`)).toBe(true);
    expect(infoTeks(2).endsWith(` · ${PENANDA_WARGA_KEDAI.ikon}`)).toBe(true);
    expect(infoTeks(1).replace(/^\d+ kartu/, '')).toBe(infoTeks(2).replace(/^\d+ kartu/, ''));
    expect(infoTeks(3)).not.toContain(PENANDA_WARGA_KEDAI.ikon);
    for (const x of t.teks) expect(x.isi).not.toMatch(/\bbot\b/i);
    expect(PENANDA_WARGA_KEDAI.label).toBe('warga kedai');
  });

  it('panel sempit: kalau semua lawan warga kedai, ☕ mengalah supaya nama tidak terpotong; meja campuran tetap bertanda', () => {
    const v0 = viewUntuk(permainan(6), 0);
    const v: ViewPemain = {
      ...v0,
      pemain: v0.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[i + 1] })),
      skor: v0.skor.map(() => -125),
      putaran: { ...v0.putaran!, jumlahKartuTangan: v0.putaran!.jumlahKartuTangan.map(() => 10) },
    };
    const teks = (t: TataMeja, pi: number, bagian: 'info' | 'nama') => t.teks.find((x) => x.kunci === `p${pi}-${bagian}`)!;
    const sebaris = (t: TataMeja, pi: number) => teks(t, pi, 'info').y === teks(t, pi, 'nama').y;
    const namaUtuh = (t: TataMeja, pi: number, u: UkuranLayar) => {
      const nama = teks(t, pi, 'nama');
      return kiraLebarTeks(nama.isi, nama.ukuran * u.skalaTeks * u.d, true) <= nama.maks! + 0.01;
    };
    // HP 360×640, panel ringkas dua kolom: nama + info ringkas sebaris. ☕ (tidak membedakan apa-apa) mengalah di
    // panel yang namanya panjang ('Mbak Teras'); nama pendek ('Si Rak') masih muat bersama ☕.
    const u = ukuran(POTRET[0]);
    const semua = hitungTataMeja(model(v), u);
    expect(semua.susunanPanel).toEqual({ kolom: 2, barisKepala: 1, ringkas: true });
    expect(teks(semua, 1, 'nama').isi).toBe('Mbak Teras');
    expect(teks(semua, 1, 'info').isi).not.toContain(PENANDA_WARGA_KEDAI.ikon);
    expect(teks(semua, 3, 'nama').isi).toBe('Si Rak');
    expect(teks(semua, 3, 'info').isi).toContain(PENANDA_WARGA_KEDAI.ikon);
    for (let pi = 1; pi < 6; pi++) {
      expect(sebaris(semua, pi), `panel ${pi}`).toBe(true);
      expect(namaUtuh(semua, pi, u), `nama panel ${pi}`).toBe(true);
    }
    // Meja campuran (online): ☕ membedakan kursi, jadi tetap ada; info turun ke baris kedua supaya nama tetap utuh.
    const i = info(v);
    i.kursi[3] = { ...i.kursi[3], jenis: 'manusia' };
    const campur = hitungTataMeja({ ...model(v), info: i }, u);
    expect(campur.susunanPanel).toEqual({ kolom: 2, barisKepala: 2, ringkas: true });
    for (let pi = 1; pi < 6; pi++) {
      expect(sebaris(campur, pi), `panel ${pi}`).toBe(false);
      expect(teks(campur, pi, 'info').isi.includes(PENANDA_WARGA_KEDAI.ikon), `panel ${pi}`).toBe(pi !== 3);
      expect(namaUtuh(campur, pi, u), `nama panel ${pi}`).toBe(true);
    }
    // HP lanskap 740×360: semua panel samping memakai dua baris (nama, lalu info), ☕ muat di baris kedua.
    const uL = ukuran({ nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128 });
    const lanskap = hitungTataMeja(model(v), uL);
    for (let pi = 1; pi < 6; pi++) {
      expect(sebaris(lanskap, pi), `panel ${pi}`).toBe(false);
      expect(teks(lanskap, pi, 'info').isi).toContain(PENANDA_WARGA_KEDAI.ikon);
      expect(namaUtuh(lanskap, pi, uL), `nama panel ${pi}`).toBe(true);
    }
    // Layar lega: penanda tetap tampil walau semua lawan warga kedai.
    const lega = hitungTataMeja(model(v), ukuran(LANSKAP[2]));
    for (let pi = 1; pi < 6; pi++) expect(teks(lega, pi, 'info').isi).toContain(PENANDA_WARGA_KEDAI.ikon);
  });

  it('kiraLebarTeks menghitung ikon ☕ lebih lebar dari huruf biasa', () => {
    expect(kiraLebarTeks('☕', 10)).toBeGreaterThan(kiraLebarTeks('a', 10) * 1.8);
  });

  describe('nama warga kedai bawaan muat utuh di panel lawan (skor 4 karakter, jumlah kartu 2 digit)', () => {
    // Bar HTML seperti di aplikasi (lihat MATRIKS). Teks besar hanya di HP 360 (kasus tersempit).
    const layarNama: Layar[] = [
      { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
      { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
      { nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 },
      { nama: 'HP lanskap 844×390', w: 844, h: 390, d: 3, bawah: 128 },
      { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128 },
      { nama: 'tablet 820×1180', w: 820, h: 1180, d: 2, bawah: 148 },
      { nama: 'desktop 1440×900', w: 1440, h: 900, d: 1, bawah: 151 },
    ];
    for (const n of [2, 3, 4, 5, 6]) {
      const v0 = viewUntuk(permainan(n), 0);
      for (const layar of layarNama) {
        it(`${n} pemain, ${layar.nama}`, () => {
          const u = ukuran(layar);
          const salah: string[] = [];
          // Tiap nama bawaan dicoba di tiap kursi lawan (digeser 0..9), dengan skor −125 dan 10 kartu; lawan
          // pertama juga dicoba tinggal 1 kartu (peringatan).
          for (let geser = 0; geser < NAMA_LAWAN_BAWAAN.length; geser++) {
            for (const bahaya of [false, true]) {
              const v: ViewPemain = {
                ...v0,
                pemain: v0.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[(i - 1 + geser) % NAMA_LAWAN_BAWAAN.length] })),
                skor: v0.skor.map((_, i) => (i === 0 ? 0 : -125)),
                putaran: { ...v0.putaran!, jumlahKartuTangan: v0.putaran!.jumlahKartuTangan.map((_, i) => (bahaya && i === 1 ? 1 : 10)) },
              };
              const t = hitungTataMeja(model(v, { aksiTerakhir: { 2: 'ambil deck' } }), u);
              expect(t.area.panel.size).toBe(n - 1);
              for (const pi of t.area.panel.keys()) {
                const nama = t.teks.find((x) => x.kunci === `p${pi}-nama`)!;
                const info = t.teks.find((x) => x.kunci === `p${pi}-info`)!;
                const pxNama = nama.ukuran * u.skalaTeks * u.d;
                const pxInfo = info.ukuran * u.skalaTeks * u.d;
                const lebarNama = kiraLebarTeks(nama.isi, pxNama, true);
                if (lebarNama > nama.maks! + 0.01) salah.push(`${nama.isi} (panel ${pi}) terpotong: ${(lebarNama / u.d).toFixed(1)} > ${(nama.maks! / u.d).toFixed(1)} px`);
                const penting = info.isi.split(' · ').slice(0, 2).join(' · ');
                expect(penting).toContain(angkaSkorKanvas(-125));
                if (lebarInfo(info, penting, u) > info.maks! + 0.01) salah.push(`info '${penting}' (panel ${pi}) terpotong`);
                // Sebaris: kotak nama dan kotak info (rata kanan) tidak bertumpuk.
                if (Math.abs(info.y - nama.y) < 1 && info.ox === 1 && nama.x + nama.maks! > info.x - info.maks! + 0.5)
                  salah.push(`nama & info panel ${pi} bertumpuk`);
              }
            }
          }
          expect([...new Set(salah)]).toEqual([]);
        });
      }
    }
  });

  it("'Giliran <nama>' di kolom info tengah: utuh di tablet & desktop, nama saja kalau kolomnya sempit", () => {
    const layarLega = [
      { nama: 'tablet 820×1180', w: 820, h: 1180, d: 2, bawah: 148 },
      { nama: 'desktop 1440×900', w: 1440, h: 900, d: 1, bawah: 151 },
    ];
    const layarSempit = [
      { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
      { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
      { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 128 },
      { nama: 'HP lanskap 844×390', w: 844, h: 390, d: 3, bawah: 128 },
    ];
    for (const n of [2, 4, 6]) {
      const v0 = viewUntuk(permainan(n), 0);
      for (const nama of NAMA_LAWAN_BAWAAN) {
        const v: ViewPemain = {
          ...v0,
          pemain: v0.pemain.map((p, i) => (i === 0 ? p : { ...p, nama })),
          putaran: { ...v0.putaran!, giliran: 1 },
        };
        for (const layar of [...layarLega, ...layarSempit]) {
          const u = ukuran(layar);
          const t = hitungTataMeja(model(v), u);
          const giliran = t.teks.find((x) => x.kunci === 'giliran')!;
          const px = giliran.ukuran * u.skalaTeks * u.d;
          expect(giliran.isi).toBe(`Giliran ${nama}`);
          // Kalau 'Giliran <nama>' ternyata tidak muat (diukur scene), scene memakai nama saja.
          expect(giliran.cadangan).toBe(nama);
          const pesan = `${n} pemain, ${layar.nama}: '${giliran.isi}'`;
          if (layarLega.includes(layar)) expect(kiraLebarTeks(giliran.isi, px, true), pesan).toBeLessThanOrEqual(giliran.maks!);
          else expect(kiraLebarTeks(nama, px, true), pesan).toBeLessThanOrEqual(giliran.maks!);
        }
      }
    }
  });

  it('skor negatif di kanvas memakai minus tipografis (U+2212), sama dengan HTML', () => {
    expect(angkaSkorKanvas(-125)).toBe('−125');
    expect(angkaSkorKanvas(0)).toBe('0');
    expect(angkaSkorKanvas(40)).toBe('40');
    const v0 = viewUntuk(permainan(3), 0);
    const v: ViewPemain = { ...v0, skor: [-30, -125, 15] };
    const t = hitungTataMeja(model(v), ukuran(POTRET[1]));
    expect(t.teks.find((x) => x.kunci === 'saya-nama')!.isi).toContain(' · −30');
    expect(t.teks.find((x) => x.kunci === 'p1-info')!.isi).toContain('−125');
    for (const x of t.teks) expect(x.isi, x.kunci).not.toMatch(/(^|\s)-\d/);
  });
});

// ---------------------------------------------------------------------------------------------
// Kartu jadi lawan tetap terbaca di HP potret (panel ringkas), info ringkas berikon kartu
// ---------------------------------------------------------------------------------------------

describe('kartu jadi lawan di panel ringkas tetap terbaca, kartu tangan tidak dikorbankan', () => {
  /**
   * Batas bawah (px CSS) lebar kartu jadi lawan dan kartu tangan per layar & jumlah pemain, untuk nama warga
   * kedai bawaan, skor −125, 10 kartu, tiap lawan dua kelompok kartu jadi. Kartu tangan: tidak lebih kecil dari
   * sebelum kartu jadi lawan dibesarkan. HP 320×568 teks besar 6 pemain: semuanya sudah minimum.
   */
  const KASUS: [Layar, number, number, number][] = [
    [{ nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 }, 4, 20, 53],
    [{ nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 }, 5, 20, 53],
    [{ nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 }, 6, 17, 44],
    [{ nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true }, 4, MINI_RINGKAS_CSS, 50],
    [{ nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true }, 5, MINI_RINGKAS_CSS, 50],
    [{ nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true }, 6, MINI_RINGKAS_CSS, 44],
    [{ nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 }, 4, 30, 64],
    [{ nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 }, 5, 26, 60],
    [{ nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 }, 6, 22, 49],
    [{ nama: 'HP 390×844 teks besar', w: 390, h: 844, d: 3, bawah: 143, teksBesar: true }, 6, 22, 46],
    [{ nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true }, 4, MINI_RINGKAS_CSS, 44],
    [{ nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true }, 5, MINI_RINGKAS_CSS, 44],
    [{ nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true }, 6, MINI_PANEL_MIN_CSS, 34],
  ];
  for (const [layar, n, minJadi, minTangan] of KASUS) {
    it(`${n} pemain, ${layar.nama}: kartu jadi lawan ≥ ${minJadi} px, kartu tangan ≥ ${minTangan} px, nama utuh`, () => {
      const u = ukuran(layar);
      const v0 = viewUntuk(permainan(n), 0);
      const salah: string[] = [];
      for (let geser = 0; geser < NAMA_LAWAN_BAWAAN.length; geser++) {
        const v: ViewPemain = {
          ...v0,
          pemain: v0.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[(i - 1 + geser) % NAMA_LAWAN_BAWAAN.length] })),
          skor: v0.skor.map((_, i) => (i === 0 ? 0 : -125)),
          putaran: {
            ...v0.putaran!,
            jumlahKartuTangan: v0.putaran!.jumlahKartuTangan.map(() => 10),
            kartuJadi: v0.putaran!.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 0 ? 0 : 2)),
          },
        };
        const t = hitungTataMeja(model(v, { tangan: kartuTangan(10) }), u);
        const jadi = t.kartu.filter((k) => k.peran === 'jadi');
        expect(jadi).toHaveLength((n - 1) * 6);
        const wJadi = Math.min(...jadi.map((k) => k.w)) / u.d;
        if (wJadi < minJadi - 0.05) salah.push(`kartu jadi lawan ${wJadi.toFixed(1)} px`);
        if (t.cw / u.d < minTangan - 0.05) salah.push(`kartu tangan ${(t.cw / u.d).toFixed(1)} px`);
        for (const pi of t.area.panel.keys()) {
          const nama = t.teks.find((x) => x.kunci === `p${pi}-nama`)!;
          if (kiraLebarTeks(nama.isi, nama.ukuran * u.skalaTeks * u.d, true) > nama.maks! + 0.01) salah.push(`nama '${nama.isi}' terpotong`);
        }
      }
      expect([...new Set(salah)]).toEqual([]);
    });
  }

  it('info panel ringkas: ikon kartu + angka · skor (tinggal 1: "1!"), patokan lebarnya juga berikon', () => {
    expect(INFO_PATOKAN).toEqual({ biasa: `10 · ${angkaSkorKanvas(-125)}`, bahaya: `1! · ${angkaSkorKanvas(-125)}` });
    const v0 = viewUntuk(permainan(6), 0);
    const v: ViewPemain = { ...v0, putaran: { ...v0.putaran!, jumlahKartuTangan: v0.putaran!.jumlahKartuTangan.map((_, i) => (i === 1 ? 1 : 7)) } };
    const t = hitungTataMeja(model(v), ukuran(POTRET[0]));
    expect(t.susunanPanel?.ringkas).toBe(true);
    const info = (pi: number) => t.teks.find((x) => x.kunci === `p${pi}-info`)!;
    expect(info(1).isi.startsWith('1! · ')).toBe(true);
    expect(info(1).warna).toBe('bahaya');
    expect(info(2).isi.startsWith('7 · ')).toBe(true);
    for (let pi = 1; pi < 6; pi++) expect(info(pi).ikon).toBe('kartu');
    // Panel lega tetap menulis "N kartu" tanpa ikon.
    const lega = hitungTataMeja(model(v), ukuran(LANSKAP[2]));
    const infoLega = lega.teks.find((x) => x.kunci === 'p2-info')!;
    expect(infoLega.isi.startsWith('7 kartu · ')).toBe(true);
    expect(infoLega.ikon).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// Buangan tidak keluar layar walau tumpukannya dirapatkan sampai batas dan ada kartu 'lebih'
// ---------------------------------------------------------------------------------------------

describe('kartu buangan selalu di dalam layar', () => {
  const layarUji: Layar[] = [
    { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
    { nama: 'HP 360×780 teks besar', w: 360, h: 780, d: 3, bawah: 143, teksBesar: true },
    { nama: 'HP 360×740 teks besar', w: 360, h: 740, d: 3, bawah: 143, teksBesar: true },
    { nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true },
    ...SEMUA_LAYAR,
  ];
  for (const n of [3, 4, 5, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    for (const layar of layarUji) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const salah: string[] = [];
        for (const lebih of [0, 3, 17]) {
          const v: ViewPemain = {
            ...asli,
            pemain: asli.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[i + 1] })),
            putaran: { ...asli.putaran!, jumlahBuangan: asli.putaran!.buangan.length + lebih },
          };
          for (const ubah of [{}, { pilihJumlahMulung: true }] as Partial<ModelTata>[]) {
            const t = hitungTataMeja(model(v, ubah), u);
            for (const k of t.kartu.filter((x) => x.peran === 'buangan' || x.peran === 'lebih')) {
              const luar = diLuar(sudutKotak(k.x, k.y, k.w, k.w * RASIO_KARTU, k.sudut), { x: 0, y: 0, w: u.W, h: u.H });
              if (luar.length) salah.push(`lebih ${lebih}: ${k.kunci} keluar layar ${luar.join(' ')}`);
            }
          }
        }
        expect(salah).toEqual([]);
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Teks kanvas tidak saling menimpa (HP potret, termasuk saat menyusun mulung)
// ---------------------------------------------------------------------------------------------

describe('teks di kanvas tidak saling menimpa (HP potret)', () => {
  /** Kotak teks perkiraan: lebar kiraLebarTeks (paling lebar `maks`, termasuk ikon), tinggi 1,25 × ukuran. */
  const kotakTeks = (x: TeksTata, u: UkuranLayar): Kotak => {
    const px = x.ukuran * u.skalaTeks * u.d;
    const w = Math.min(x.maks ?? Infinity, kiraLebarTeks(x.isi, px, x.tebal) + (x.ikon === 'kartu' ? lebarIkonKartu(px) : 0));
    const h = px * 1.25;
    return { x: x.x - (x.ox ?? 0) * w, y: x.y - (x.oy ?? 0) * h, w, h };
  };
  const layarUji: Layar[] = [
    { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
    { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
    { nama: 'HP 360×780 teks besar', w: 360, h: 780, d: 3, bawah: 143, teksBesar: true },
    { nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 },
    { nama: 'HP 390×844 teks besar', w: 390, h: 844, d: 3, bawah: 143, teksBesar: true },
    { nama: 'HP 412×915 teks besar', w: 412, h: 915, d: 2.625, bawah: 150, teksBesar: true },
    { nama: 'HP 320×568', w: 320, h: 568, d: 2, bawah: 139 },
    { nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true },
  ];
  for (const n of [2, 3, 4, 5, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    const v: ViewPemain = {
      ...asli,
      pemain: asli.pemain.map((p, i) => (i === 0 ? { ...p, nama: 'Penguji' } : { ...p, nama: NAMA_LAWAN_BAWAAN[i + 1] })),
      skor: asli.skor.map(() => -125),
      putaran: { ...asli.putaran!, giliran: 0, tahap: 'ambil', jumlahBuangan: asli.putaran!.buangan.length + 3 },
    };
    const denganJadiku: ViewPemain = { ...v, putaran: { ...v.putaran!, kartuJadi: v.putaran!.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 0 ? 2 : 1)) } };
    const tanpaJadiku: ViewPemain = { ...v, putaran: { ...v.putaran!, kartuJadi: v.putaran!.kartuJadi.map((kj, i) => (i === 0 ? [] : kj)) } };
    const bu = v.putaran!.buangan.slice(-2).map((e) => e.kartu);
    const komb = kartuTangan(8).slice(4);
    const varian: [string, ModelTata][] = [
      ['awal', model(tanpaJadiku, { tangan: kartuTangan(9), aksiTerakhir: { 1: 'ambil deck' } })],
      ['kartu jadiku', model(denganJadiku, { tangan: kartuTangan(9) })],
      ['menyusun mulung', model(denganJadiku, { tangan: kartuTangan(9), mulung: { jumlah: bu.length, sisaPungutan: bu, idPaling: bu[0].id, kombinasi: [] } })],
      [
        'menyusun mulung + kombinasi',
        model(denganJadiku, {
          tangan: kartuTangan(9),
          mulung: { jumlah: 2, sisaPungutan: bu.slice(1), idPaling: bu[0].id, kombinasi: [{ kartu: komb.map((kartu) => ({ kartu })) }] },
        }),
      ],
    ];
    for (const layar of layarUji) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const salah: string[] = [];
        for (const [nama, mdl] of varian) {
          // HP 320×568 teks besar, 6 pemain, kartu jadiku sudah turun: tinggi layar memang tidak cukup walau semua
          // sudah minimum (di luar cakupan test ini).
          if (layar.w === 320 && layar.teksBesar && n === 6 && nama === 'kartu jadiku') continue;
          const t = hitungTataMeja(mdl, u);
          const teks = t.teks.filter((x) => x.isi && !x.isi.includes('\n'));
          for (let i = 0; i < teks.length; i++)
            for (let j = i + 1; j < teks.length; j++) {
              const a = teks[i];
              const b = teks[j];
              // Baris di dalam satu panel lawan diatur & diuji tersendiri (kepala rapat).
              const panelA = /^p\d-/.exec(a.kunci)?.[0];
              if (panelA && b.kunci.startsWith(panelA)) continue;
              const ka = kotakTeks(a, u);
              const kb = kotakTeks(b, u);
              const lebar = Math.min(ka.x + ka.w, kb.x + kb.w) - Math.max(ka.x, kb.x);
              const tinggi = Math.min(ka.y + ka.h, kb.y + kb.h) - Math.max(ka.y, kb.y);
              if (lebar > 0.5 * u.d && tinggi > 0.5 * u.d) salah.push(`${nama}: '${a.isi}' × '${b.isi}' (${(tinggi / u.d).toFixed(1)} px)`);
            }
        }
        expect(salah).toEqual([]);
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------
// HP lanskap pendek (740×360, 844×390, teks normal & besar): teks tidak bertumpuk & nama lawan utuh, termasuk
// setelah kartu jadiku turun, di giliranku (label 'giliranmu' lebih panjang), dengan petunjuk, dan saat mulung.
// ---------------------------------------------------------------------------------------------

/** Kotak teks perkiraan: lebar kiraLebarTeks (paling lebar `maks`, termasuk ikon), tinggi 1,25 × ukuran. */
function kotakTeksKira(x: TeksTata, u: UkuranLayar): Kotak {
  const px = x.ukuran * u.skalaTeks * u.d;
  const w = Math.min(x.maks ?? Infinity, kiraLebarTeks(x.isi, px, x.tebal) + (x.ikon === 'kartu' ? lebarIkonKartu(px) : 0));
  const h = px * 1.25;
  return { x: x.x - (x.ox ?? 0) * w, y: x.y - (x.oy ?? 0) * h, w, h };
}

/** Teks yang saling menimpa (baris di dalam satu panel diatur & diuji tersendiri), dan teks di atas kartu. */
function tabrakanTeks(t: TataMeja, u: UkuranLayar): string[] {
  const salah: string[] = [];
  const teks = t.teks.filter((x) => x.isi && !x.isi.includes('\n'));
  for (let i = 0; i < teks.length; i++)
    for (let j = i + 1; j < teks.length; j++) {
      const a = teks[i];
      const b = teks[j];
      const panelA = /^p\d-/.exec(a.kunci)?.[0];
      if (panelA && b.kunci.startsWith(panelA)) continue;
      const ka = kotakTeksKira(a, u);
      const kb = kotakTeksKira(b, u);
      const lebar = Math.min(ka.x + ka.w, kb.x + kb.w) - Math.max(ka.x, kb.x);
      const tinggi = Math.min(ka.y + ka.h, kb.y + kb.h) - Math.max(ka.y, kb.y);
      if (lebar > 0.5 * u.d && tinggi > 0.5 * u.d) salah.push(`'${a.isi}' × '${b.isi}' (${(tinggi / u.d).toFixed(1)} px)`);
    }
  // Teks di luar panel lawan tidak menimpa kartu di luar panel lawan (kecuali '+N' yang memang di atas kartu 'lebih').
  const diPanelLawan = (k: KartuTata) => [...t.area.panel.values()].some((p) => k.x >= p.x && k.x <= p.x + p.w && k.y >= p.y && k.y <= p.y + p.h);
  for (const x of teks) {
    if (/^p\d-/.test(x.kunci) || x.kunci === 'lebih-label') continue;
    const kt = kotakTeksKira(x, u);
    for (const k of t.kartu) {
      if (k.peran === 'lebih' || (k.peran === 'jadi' && diPanelLawan(k))) continue;
      const kk = { x: k.x - k.w / 2, y: k.y - (k.w * RASIO_KARTU) / 2, w: k.w, h: k.w * RASIO_KARTU };
      const lebar = Math.min(kt.x + kt.w, kk.x + kk.w) - Math.max(kt.x, kk.x);
      const tinggi = Math.min(kt.y + kt.h, kk.y + kk.h) - Math.max(kt.y, kk.y);
      if (lebar > 1 * u.d && tinggi > 1 * u.d) {
        salah.push(`'${x.isi}' di atas kartu ${k.peran}`);
        break;
      }
    }
  }
  return salah;
}

describe('HP lanskap pendek: teks tidak bertumpuk & nama lawan utuh, juga setelah kartu jadiku turun', () => {
  // Bar bawah diukur Playwright (Vite dev, Chrome): giliran lawan 123/131 (normal/besar) di 740×360, 128/137 di
  // 844×390; giliranku sedikit lebih tinggi (lihat MATRIKS).
  const layarUji: Layar[] = [
    { nama: 'HP lanskap 740×360 teks besar', w: 740, h: 360, d: 2, bawah: 131, teksBesar: true },
    { nama: 'HP lanskap 740×360 teks besar (bar bawah 137)', w: 740, h: 360, d: 2, bawah: 137, teksBesar: true },
    { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 123 },
    { nama: 'HP lanskap 740×360 (bar bawah 128)', w: 740, h: 360, d: 2, bawah: 128 },
    { nama: 'HP lanskap 844×390 teks besar', w: 844, h: 390, d: 3, bawah: 137, teksBesar: true },
    { nama: 'HP lanskap 844×390', w: 844, h: 390, d: 3, bawah: 128 },
  ];
  for (const n of [2, 3, 4, 5, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    for (const layar of layarUji) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const salah: string[] = [];
        // Nama warga kedai bawaan digeser di tiap kursi (terpanjang: 'Mbak Teras', 'Mas Sampul').
        for (let geser = 0; geser < NAMA_LAWAN_BAWAAN.length; geser += 2) {
          const dasar: ViewPemain = {
            ...asli,
            pemain: asli.pemain.map((p, i) => (i === 0 ? { ...p, nama: 'Penguji' } : { ...p, nama: NAMA_LAWAN_BAWAAN[(i - 1 + geser) % NAMA_LAWAN_BAWAAN.length] })),
            skor: asli.skor.map((_, i) => (i === 0 ? -30 : -125)),
            putaran: { ...asli.putaran!, jumlahKartuTangan: asli.putaran!.jumlahKartuTangan.map(() => 10), jumlahBuangan: asli.putaran!.buangan.length + 6 },
          };
          const bu = dasar.putaran!.buangan.slice(-2).map((e) => e.kartu);
          for (const jadiku of [0, 1, 4]) {
            const kartuJadi = dasar.putaran!.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 0 ? jadiku : 2));
            const lawanJalan: ViewPemain = { ...dasar, putaran: { ...dasar.putaran!, kartuJadi, giliran: 1 % n, tahap: 'main' } };
            const giliranku: ViewPemain = { ...dasar, putaran: { ...dasar.putaran!, kartuJadi, giliran: 0, tahap: 'ambil' } };
            const varian: [string, ModelTata][] = [
              ['giliran lawan', model(lawanJalan, { tangan: kartuTangan(10), aksiTerakhir: { [1 % n]: 'ambil deck' }, berikutnya: 'Penguji' })],
              ['kartuku di atas', model(lawanJalan, { tangan: kartuTangan(10), kartukuDiAtas: true })],
              ['giliranku', model(giliranku, { tangan: kartuTangan(10), bisaPungut: true })],
              [
                'menyusun mulung',
                model(giliranku, {
                  tangan: kartuTangan(9),
                  mulung: { jumlah: 2, sisaPungutan: bu.slice(1), idPaling: bu[0].id, kombinasi: [{ kartu: kartuTangan(13).slice(10).map((kartu) => ({ kartu })) }] },
                }),
              ],
            ];
            for (const [nama, mdl] of varian) {
              const t = hitungTataMeja(mdl, u);
              for (const x of tabrakanTeks(t, u)) salah.push(`kartu jadiku ${jadiku}, ${nama}: ${x}`);
              for (let pi = 0; pi < n; pi++) {
                const tn = t.teks.find((x) => x.kunci === `p${pi}-nama`);
                if (tn && kiraLebarTeks(tn.isi, tn.ukuran * u.skalaTeks * u.d, true) > tn.maks! + 0.01) salah.push(`nama '${tn.isi}' terpotong`);
              }
              // Kartu jadiku di dalam areanya (panel diriku, samping deck, barisnya sendiri, atau ringkas saat mulung).
              for (const kj of mdl.view.putaran!.kartuJadi[0])
                for (const dk of kj.kartu) {
                  const kt = t.kartu.find((x) => x.kunci === `j:${dk.kartu.id}`);
                  if (!kt || !t.area.kartuJadiSaya || diLuar(sudutKotak(kt.x, kt.y, kt.w, kt.w * RASIO_KARTU, 0), t.area.kartuJadiSaya, 1).length)
                    salah.push(`kartu jadiku ${jadiku}, ${nama}: ${dk.kartu.id} di luar areanya`);
                }
            }
          }
        }
        expect([...new Set(salah)]).toEqual([]);
      });
    }
  }

  it('740×360 teks besar, 6 pemain: kartu jadiku & namaku di panel diriku (kanan bawah), meja tidak berubah saat kartu jadi pertama turun', () => {
    const u = ukuran({ nama: 'HP lanskap 740×360 teks besar', w: 740, h: 360, d: 2, bawah: 131, teksBesar: true });
    const v0 = viewUntuk(permainan(6), 0);
    const v: ViewPemain = { ...v0, pemain: v0.pemain.map((p, i) => (i === 0 ? { ...p, nama: 'Penguji' } : { ...p, nama: NAMA_LAWAN_BAWAAN[i + 1] })) };
    const tanpa: ViewPemain = { ...v, putaran: { ...v.putaran!, kartuJadi: v.putaran!.kartuJadi.map(() => []) } };
    const dengan: ViewPemain = { ...v, putaran: { ...v.putaran!, kartuJadi: v.putaran!.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 0 ? 2 : 0)) } };
    const sebelum = hitungTataMeja(model(tanpa, { tangan: kartuTangan(10) }), u);
    const sesudah = hitungTataMeja(model(dengan, { tangan: kartuTangan(7) }), u);
    for (const t of [sebelum, sesudah]) {
      // Tanpa label diriku di atas tangan; namaku di kepala panel diriku, panel lawan tetap n − 1.
      expect(t.teks.find((x) => x.kunci === 'saya-nama')).toBeUndefined();
      expect(t.teks.find((x) => x.kunci === 'p0-nama')?.isi).toBe('Penguji');
      expect(t.area.panel.size).toBe(5);
      expect(t.hias.filter((h) => h.jenis === 'panel')).toHaveLength(6);
    }
    expect(sesudah.cw).toBeCloseTo(sebelum.cw, 5);
    expect(sesudah.area.deck).toEqual(sebelum.area.deck);
    expect(sesudah.area.tangan).toEqual(sebelum.area.tangan);
    // Panel diriku paling bawah di sisi kanan, selebar panel lawan; kartu jadiku di dalamnya.
    const kanan = [...sesudah.area.panel.values()].filter((k) => k.x > u.W / 2);
    const kj = sesudah.area.kartuJadiSaya!;
    expect(kj.x).toBeCloseTo(kanan[0].x, 5);
    expect(kj.w).toBeCloseTo(kanan[0].w, 5);
    expect(kj.y).toBeGreaterThan(Math.max(...kanan.map((k) => k.y)));
    expect(sebelum.area.kartuJadiSaya).toBeUndefined();
    // Kartu yang terbang ke/dari aku tetap memakai tangan (bukan panel diriku).
    expect(sesudah.titik.panel.has(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// Menyusun mulung di HP potret: meja tidak melompat mengecil (kartu tangan & kartu jadi lawan tetap)
// ---------------------------------------------------------------------------------------------

describe('menyusun mulung di HP potret: kartu tangan & kartu jadi lawan tidak ikut mengecil', () => {
  const layarUji: Layar[] = [
    { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
    { nama: 'HP 360×640 teks besar', w: 360, h: 640, d: 2, bawah: 143, teksBesar: true },
    { nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 },
    { nama: 'HP 390×844 teks besar', w: 390, h: 844, d: 3, bawah: 143, teksBesar: true },
    { nama: 'HP 412×915 teks besar', w: 412, h: 915, d: 2.625, bawah: 150, teksBesar: true },
    { nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true },
  ];
  for (const n of [3, 4, 5, 6]) {
    const asli = viewUntuk(permainan(n), 0);
    for (const layar of layarUji) {
      it(`${n} pemain, ${layar.nama}`, () => {
        const u = ukuran(layar);
        const salah: string[] = [];
        for (const jadiku of [0, 1, 3]) {
          const v: ViewPemain = {
            ...asli,
            pemain: asli.pemain.map((p, i) => (i === 0 ? p : { ...p, nama: NAMA_LAWAN_BAWAAN[i + 1] })),
            putaran: { ...asli.putaran!, giliran: 0, tahap: 'ambil', kartuJadi: asli.putaran!.kartuJadi.map((_, i) => kartuJadiBuatan(i, i === 0 ? jadiku : 2)) },
          };
          const bu = v.putaran!.buangan.slice(-Math.min(2, v.putaran!.buangan.length)).map((e) => e.kartu);
          const tangan = kartuTangan(9);
          const biasa = hitungTataMeja(model(v, { tangan }), u);
          const lawan = (t: TataMeja) => Math.min(...t.kartu.filter((k) => k.peran === 'jadi' && !k.kunci.endsWith('-p0')).map((k) => k.w));
          const mulungs: [string, NonNullable<ModelTata['mulung']>][] = [
            ['1 pungutan', { jumlah: 1, sisaPungutan: bu.slice(-1), idPaling: bu[bu.length - 1].id, kombinasi: [] }],
            [`${bu.length} pungutan`, { jumlah: bu.length, sisaPungutan: bu, idPaling: bu[0].id, kombinasi: [] }],
            [
              'pungutan + kombinasi',
              { jumlah: bu.length, sisaPungutan: bu.slice(1), idPaling: bu[0].id, kombinasi: [{ kartu: kartuTangan(12).slice(9).map((kartu) => ({ kartu })) }] },
            ],
          ];
          for (const [nama, mulung] of mulungs) {
            const t = hitungTataMeja(model(v, { tangan, mulung }), u);
            const ket = `kartu jadiku ${jadiku}, ${nama}`;
            if (Math.abs(t.cw - biasa.cw) > 0.01) salah.push(`${ket}: kartu tangan ${(biasa.cw / u.d).toFixed(1)} → ${(t.cw / u.d).toFixed(1)} px`);
            if (Math.abs(lawan(t) - lawan(biasa)) > 0.01) salah.push(`${ket}: kartu jadi lawan ${(lawan(biasa) / u.d).toFixed(1)} → ${(lawan(t) / u.d).toFixed(1)} px`);
            expect([...t.area.panel.values()], ket).toEqual([...biasa.area.panel.values()]);
            for (const x of tabrakanTeks(t, u)) salah.push(`${ket}: ${x}`);
          }
        }
        expect(salah).toEqual([]);
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Label joker pengganti ('→rank') di kartu jadi lawan yang kecil
// ---------------------------------------------------------------------------------------------

describe("label joker pengganti ('→rank') di kartu jadi kecil tidak saling menimpa", () => {
  // Seri 6-7-8-9-10 dengan joker (tidak dempet) sebagai 6, 8, dan 10 (label terakhir paling lebar: '→10'), lalu
  // kelompok kedua tepat di kanannya. Bagian label yang tertutup kartu di kanannya (lapis lebih tinggi) tidak terlihat.
  const k = (rank: Kartu['rank'], bunga: Kartu['bunga'], id: string): Kartu => ({ id, rank, bunga, deck: 0 });
  const seriJoker = (pi: number): KartuJadi[] => [
    {
      id: `kjl-${pi}`,
      pemilik: pi,
      jenis: 'seri',
      kartu: [
        { kartu: k(2, 'waru', `jk6-${pi}`), sebagai: k(6, 'love', `s6-${pi}`), pengganti: true },
        { kartu: k(7, 'love', `n7-${pi}`), sebagai: k(7, 'love', `n7-${pi}`), pengganti: false },
        { kartu: k(2, 'kriting', `jk8-${pi}`), sebagai: k(8, 'love', `s8-${pi}`), pengganti: true },
        { kartu: k(9, 'love', `n9-${pi}`), sebagai: k(9, 'love', `n9-${pi}`), pengganti: false },
        { kartu: k(2, 'love', `jkT-${pi}`), sebagai: k(10, 'love', `s10-${pi}`), pengganti: true },
      ],
    },
    {
      id: `kjb-${pi}`,
      pemilik: pi,
      jenis: 'seri',
      kartu: ([3, 4, 5] as const).map((r) => ({ kartu: k(r, 'wajik', `w${r}-${pi}`), sebagai: k(r, 'wajik', `w${r}-${pi}`), pengganti: false })),
    },
  ];
  const layarUji: Layar[] = [
    { nama: 'HP 360×640', w: 360, h: 640, d: 2, bawah: 139 },
    { nama: 'HP 320×568 teks besar', w: 320, h: 568, d: 2, bawah: 143, teksBesar: true },
    { nama: 'HP lanskap 740×360', w: 740, h: 360, d: 2, bawah: 123 },
    { nama: 'HP lanskap 740×360 teks besar', w: 740, h: 360, d: 2, bawah: 131, teksBesar: true },
    { nama: 'HP 390×844', w: 390, h: 844, d: 3, bawah: 139 },
  ];
  for (const layar of layarUji) {
    it(`6 pemain, ${layar.nama}`, () => {
      const u = ukuran(layar);
      const v0 = viewUntuk(permainan(6), 0);
      const v: ViewPemain = { ...v0, putaran: { ...v0.putaran!, kartuJadi: v0.putaran!.kartuJadi.map((_, i) => (i === 0 ? [] : seriJoker(i))) } };
      const t = hitungTataMeja(model(v), u);
      const salah: string[] = [];
      for (let pi = 1; pi < 6; pi++) {
        const kartuPanel = t.kartu.filter((x) => x.peran === 'jadi' && x.kunci.endsWith(`-${pi}`));
        const berlabel = kartuPanel.filter((x) => x.label);
        expect(berlabel.map((x) => x.label!.isi)).toEqual(['→6', '→8', '→10']);
        const terlihat = berlabel.map((x) => {
          const kl = kotakLabelKartu(x.x, x.y, x.w, x.label!, u.d);
          const penutup = kartuPanel.find((y) => y.lapis > x.lapis && Math.abs(y.y - x.y) < 0.5 && y.x > x.x && y.x - x.x < x.w);
          return { ...kl, w: penutup ? Math.min(kl.w, penutup.x - penutup.w / 2 - kl.x) : kl.w, isi: x.label!.isi };
        });
        for (let i = 0; i < terlihat.length; i++)
          for (let j = i + 1; j < terlihat.length; j++) if (irisan(terlihat[i], terlihat[j]) > 0) salah.push(`panel ${pi}: ${terlihat[i].isi} × ${terlihat[j].isi}`);
        // Label kartu terakhir kelompok pertama ('→10') tidak menimpa kelompok kedua.
        for (const l of terlihat)
          for (const y of kartuPanel.filter((y) => y.kunci.startsWith('j:w')))
            if (irisan(l, { x: y.x - y.w / 2, y: y.y - (y.w * RASIO_KARTU) / 2, w: y.w, h: y.w * RASIO_KARTU }) > 0) salah.push(`panel ${pi}: ${l.isi} menimpa ${y.kunci}`);
      }
      expect(salah).toEqual([]);
    });
  }
});
