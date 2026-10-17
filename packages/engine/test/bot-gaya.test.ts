// Gaya main warga kedai (#47, packages/engine/src/bot/gaya.ts).
//
// - standar = perilaku lama, persis (hash aksi direkam dari kode sebelum gaya ada) dan tanpa rng;
// - mudah dan susun akhir mengabaikan gaya;
// - tiap gaya murni dan hanya mengirim aksi sah;
// - perilaku khas tiap gaya di skenario buatan tangan.
// Kekuatan dan keterbacaannya diukur di arena (packages/engine/scripts/arena.ts), bukan di sini.
//
// Skenario memilih putaran yang mood-nya cocok (gaya tidak libur, atau kekuatannya ≥ 1) dengan
// menggeser skor: skor ikut hash mood (info publik) tapi tidak dipakai strategi mana pun.

import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  DAFTAR_GAYA_BOT,
  GAYA_TETAP,
  isGaya,
  periksaInvarian,
  pilihAksiBot,
  Rng,
  seedKeState,
  terapkan,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type GayaBot,
  type IsiPeristiwa,
  type Kartu,
  type LevelBot,
  type Peristiwa,
  type ViewPemain,
} from '../src/index.js';
import {
  adaLondoLawan,
  biasBuang,
  bolehTundaMentung,
  buatKonteksGaya,
  DEFINISI_GAYA,
  gayaPutaran,
  menyambung,
  moodPutaran,
  paramDenganGaya,
  perkiraanPesimis,
  pilihDekat,
  type KonteksGaya,
} from '../src/bot/gaya.js';
import { aksiKuat, PARAM_JAGO, PARAM_SUHU, Penilai } from '../src/bot/strategi.js';
import { tipeKartu } from '../src/bot/susun.js';
import { ctx, id, kartu, skenario, type Skenario } from './bantu.js';

const LEVEL_GAYA: LevelBot[] = ['normal', 'jago', 'suhu'];
const BERGAYA = DAFTAR_GAYA_BOT.filter((g) => g !== 'standar');

/** Ubah state sesudah ambil deck (tahap main), tanpa mengambil kartu sungguhan. */
const sesudahDeck = (g: GameState) => {
  g.putaran!.tahap = 'main';
  g.putaran!.sumberAmbil = 'deck';
};

/**
 * Skenario dengan skor pemain 0 digeser sampai konteks gaya pemain 0 memenuhi `syarat`. Skor tidak
 * dipakai strategi, hanya ikut hash mood putaran.
 */
function denganMood(
  s: Skenario,
  level: LevelBot,
  gaya: GayaBot,
  syarat: (kg: KonteksGaya) => boolean,
  ubah: (g: GameState) => void = () => {},
): GameState {
  for (let x = 0; x < 500; x++) {
    const g = skenario({ ...s, skor: s.tangan.map((_, i) => (i === 0 ? x * 10 : 0)) });
    ubah(g);
    const kg = buatKonteksGaya(viewUntuk(g, 0), level, gaya, new Rng(1));
    if (kg && syarat(kg)) return g;
  }
  throw new Error(`mood ${gaya} yang dicari tidak ketemu`);
}
const aktif = (kg: KonteksGaya) => kg.kali > 0;
/** Kekuatan dasar gaya ≥ 1 (di Normal kali sudah dikali skalaNormal). */
const penuh = (kg: KonteksGaya) => kg.kali >= (kg.kuat ? 1 : (kg.def.skalaNormal ?? 1));

const aksi0 = (g: GameState, level: LevelBot, gaya?: GayaBot, rng = new Rng(3)) => pilihAksiBot(viewUntuk(g, 0), level, rng, gaya);
const dibuang = (a: Aksi) => (a.jenis === 'buang' ? a.kartuId : `(${a.jenis})`);

/** Peristiwa buatan untuk view (hanya isi yang dibaca kait gaya dan ingatan). */
function tambahPeristiwa(g: GameState, isi: IsiPeristiwa, putaran = 1): void {
  const idBaru = (g.peristiwa.at(-1)?.id ?? 0) + 1;
  g.peristiwa.push({ ...isi, id: idBaru, putaran } as Peristiwa);
}

/** Mainkan permainan dengan level dan gaya per kursi. Gagal kalau ada aksi ditolak atau state ilegal. */
function mainkan(level: LevelBot[], gaya: (GayaBot | undefined)[], duaDeck: boolean, seed: number, putaran: number, jejak?: string[]) {
  let g: GameState = buatPermainan({
    pemain: level.map((_, i) => `W ${i + 1}`),
    seed,
    konfigurasi: { duaDeckUntukEmpat: duaDeck, batasPutaran: putaran, batasSkorAtas: null, batasSkorBawah: null },
  });
  const rng = new Rng(seed * 31 + 7);
  let keputusan = 0;
  while (g.status !== 'selesai') {
    let aksi: Aksi;
    let siapa = -1;
    if (g.status === 'putaranBerjalan') siapa = g.putaran!.giliran;
    else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      siapa = rng.pick(belum);
    }
    if (siapa >= 0) {
      aksi = pilihAksiBot(viewUntuk(g, siapa), level[siapa], rng, gaya[siapa]);
      keputusan++;
    } else aksi = { jenis: 'mulaiPutaran' };
    jejak?.push(JSON.stringify(aksi));
    const h = terapkanAksi(g, aksi);
    if (!h.ok) {
      throw new Error(`aksi ${level[siapa]}:${gaya[siapa]} ditolak (seed ${seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    }
    g = h.state;
    const salah = periksaInvarian(g);
    if (salah.length) throw new Error(`state ilegal (seed ${seed}) sesudah ${aksi.jenis}: ${salah.join('; ')}`);
    if (keputusan > 20000) throw new Error('permainan tidak selesai');
  }
  jejak?.push(JSON.stringify(g.skor), String(rng.state));
  return g;
}

/** Semua view giliran (putaran berjalan) dari satu permainan ber-seed yang dimainkan suhu standar. */
function viewDariPermainan(n: number, duaDeck: boolean, seed: number, batas = 60): ViewPemain[] {
  let g: GameState = buatPermainan({ pemain: Array.from({ length: n }, (_, i) => `W ${i}`), seed, konfigurasi: { duaDeckUntukEmpat: duaDeck, batasPutaran: 2 } });
  const rng = new Rng(seed);
  const hasil: ViewPemain[] = [];
  while (g.status !== 'selesai' && hasil.length < batas) {
    if (g.status === 'putaranBerjalan') {
      const v = viewUntuk(g, g.putaran!.giliran);
      hasil.push(v);
      g = terapkan(g, pilihAksiBot(v, 'suhu', rng));
    } else if (g.status === 'susunAkhir') {
      const s = g.putaran!.selesaiSusun.indexOf(false);
      g = terapkan(g, pilihAksiBot(viewUntuk(g, s), 'suhu', rng));
    } else g = terapkan(g, { jenis: 'mulaiPutaran' });
  }
  return hasil;
}

describe('gaya: daftar dan definisi', () => {
  it('standar di indeks 0, lima gaya tetap punya definisi, standar dan berubah tidak', () => {
    expect(DAFTAR_GAYA_BOT[0]).toBe('standar');
    expect(GAYA_TETAP).toEqual(['sabarLondo', 'ngurutin', 'pemburu', 'penahan', 'kilat']);
    for (const g of GAYA_TETAP) {
      expect(DAFTAR_GAYA_BOT).toContain(g);
      const d = DEFINISI_GAYA[g]!;
      expect(d.mood).toBeGreaterThan(0);
      expect(d.peluangLibur).toBeGreaterThan(0);
      expect(d.toleransi).toBeGreaterThan(0);
    }
    expect(DEFINISI_GAYA.standar).toBeNull();
    expect(DEFINISI_GAYA.berubah).toBeNull();
    // Hasil penyetelan C3: hanya pemburu yang menunda mentung, dan penahan tidak menahan As/Londo di awal.
    for (const g of GAYA_TETAP) expect((DEFINISI_GAYA[g]!.tundaMentung ?? 0) > 0).toBe(g === 'pemburu');
    expect(DEFINISI_GAYA.penahan!.tahanTinggi).toBeUndefined();
  });

  it('isGaya hanya menerima nama di daftar', () => {
    for (const g of DAFTAR_GAYA_BOT) expect(isGaya(g)).toBe(true);
    for (const x of ['acak', 'Kilat', '', null, undefined, 3, {}]) expect(isGaya(x)).toBe(false);
  });
});

describe('gaya standar = perilaku lama', () => {
  // Hash aksi + skor + state rng dari 3 permainan, direkam dari kode SEBELUM lapisan gaya ditambahkan
  // (commit 2416d28). Normal, jago, dan suhu bercampur, susun akhir ikut.
  const REKAMAN = ['511a02d2', '12bb41ab', 'b56c2d87'];
  const MEJA: { level: LevelBot[]; duaDeck: boolean; seed: number }[] = [
    { level: ['normal', 'jago', 'suhu'], duaDeck: false, seed: 11 },
    { level: ['suhu', 'normal', 'jago', 'normal'], duaDeck: true, seed: 12 },
    { level: ['jago', 'suhu', 'normal', 'suhu', 'jago', 'normal'], duaDeck: false, seed: 13 },
  ];
  const hash = (gaya: GayaBot | undefined) =>
    MEJA.map((m) => {
      const jejak: string[] = [];
      mainkan(m.level, m.level.map(() => gaya), m.duaDeck, m.seed, 2, jejak);
      return (seedKeState(jejak.join('\n')) >>> 0).toString(16);
    });

  it('tanpa argumen gaya, dengan "standar", dan dengan gaya tak dikenal: hash sama dengan rekaman lama', () => {
    expect(hash(undefined)).toEqual(REKAMAN);
    expect(hash('standar')).toEqual(REKAMAN);
    expect(hash('ngawur' as GayaBot)).toEqual(REKAMAN);
  });

  it('normal, jago, suhu standar tidak memakai rng', () => {
    for (const v of viewDariPermainan(4, true, 21, 50)) {
      for (const level of LEVEL_GAYA) {
        const rng = new Rng(77);
        pilihAksiBot(v, level, rng, 'standar');
        expect(rng.state).toBe(77);
      }
    }
  });

  it('paramDenganGaya tanpa gaya mengembalikan objek yang sama', () => {
    expect(paramDenganGaya(PARAM_SUHU, 'suhu', null)).toBe(PARAM_SUHU);
    expect(paramDenganGaya(PARAM_JAGO, 'jago', null)).toBe(PARAM_JAGO);
    const v = viewDariPermainan(3, false, 2, 1)[0];
    expect(buatKonteksGaya(v, 'normal', 'standar', new Rng(1))).toBeNull();
    expect(buatKonteksGaya(v, 'mudah', 'kilat', new Rng(1))).toBeNull();
    expect(buatKonteksGaya(v, 'normal', 'ngawur' as GayaBot, new Rng(1))).toBeNull();
  });

  it('bahaya dengan bobot 1 sama persis dengan rumus lama; bobotLainnya 0 hanya menghitung pemain berikutnya', () => {
    // Rumus bahaya sebelum ada bobotBerikut/bobotLainnya.
    const bahayaLama = (nl: Penilai, d: Kartu) => {
      const { par, p, n, saya } = nl;
      const skala = nl.ingat.salinan === 2 ? par.bahayaDuaDeck : 1;
      if (skala === 0 || (par.bahaya === 0 && par.suap === 0)) return 0;
      let total = 0;
      for (let jarak = 1; jarak < n; jarak++) {
        const j = (((saya + jarak * p.arah) % n) + n) % n;
        const h = p.jumlahKartuTangan[j];
        const pasangan = nl.peluangPasangan(d, j);
        if (pasangan === 0) continue;
        const siap = h === 2 && jarak === 1 ? 0 : par.siapLawan[Math.min(h, par.siapLawan.length - 1)];
        total += pasangan * (par.bahaya * siap * nl.pengali + par.suap);
      }
      return total * skala;
    };
    let dicek = 0;
    let adaBahaya = 0;
    for (const [n, dua] of [[3, false], [4, true], [6, false]] as const) {
      for (const v of viewDariPermainan(n, dua, 5, 30)) {
        const nl = new Penilai(v, v.putaran!, v.saya!, PARAM_SUHU);
        const hanyaBerikut = new Penilai(v, v.putaran!, v.saya!, { ...PARAM_SUHU, bobotLainnya: 0 });
        const berikutDobel = new Penilai(v, v.putaran!, v.saya!, { ...PARAM_SUHU, bobotBerikut: 2 });
        for (const k of v.putaran!.tangan[v.saya!]!) {
          const lama = bahayaLama(nl, k);
          expect(nl.bahaya(k)).toBe(lama);
          // bobotBerikut 2 = rumus lama + sekali lagi bagian pemain berikutnya.
          expect(hanyaBerikut.bahaya(k)).toBeLessThanOrEqual(lama + 1e-9);
          expect(berikutDobel.bahaya(k)).toBeCloseTo(lama + hanyaBerikut.bahaya(k), 9);
          if (lama > 0) adaBahaya++;
          dicek++;
        }
      }
    }
    expect(dicek).toBeGreaterThan(200);
    expect(adaBahaya).toBeGreaterThan(50);
  });
});

describe('gaya: mudah, susun akhir, kemurnian', () => {
  it('mudah mengabaikan gaya: aksi dan state rng sama', () => {
    for (const v of viewDariPermainan(4, false, 8, 30)) {
      const a = new Rng(5);
      const harap = pilihAksiBot(v, 'mudah', a);
      for (const gaya of BERGAYA) {
        const b = new Rng(5);
        expect(pilihAksiBot(v, 'mudah', b, gaya)).toEqual(harap);
        expect(b.state).toBe(a.state);
      }
    }
  });

  it('susun akhir tanpa gaya: aksi dan state rng sama untuk semua gaya', () => {
    let dicek = 0;
    for (const seed of [3, 4, 5]) {
      let g: GameState = buatPermainan({ pemain: ['A', 'B', 'C', 'D'], seed, konfigurasi: { batasPutaran: 1 } });
      g = terapkan(g, { jenis: 'mulaiPutaran' });
      const rng = new Rng(seed);
      while (g.status === 'putaranBerjalan') g = terapkan(g, pilihAksiBot(viewUntuk(g, g.putaran!.giliran), 'normal', rng));
      expect(g.status).toBe('susunAkhir');
      for (let i = 0; i < 4; i++) {
        if (g.putaran!.selesaiSusun[i]) continue;
        const v = viewUntuk(g, i);
        for (const level of LEVEL_GAYA) {
          const a = new Rng(9);
          const harap = pilihAksiBot(v, level, a);
          for (const gaya of BERGAYA) {
            const b = new Rng(9);
            expect(pilihAksiBot(v, level, b, gaya)).toEqual(harap);
            expect(b.state).toBe(a.state);
            dicek++;
          }
        }
      }
    }
    expect(dicek).toBeGreaterThan(0);
  });

  it('murni untuk tiap gaya: view sama + seed rng sama = aksi dan state rng sama, view tidak diubah', () => {
    let dicek = 0;
    for (const [n, dua, seed] of [[3, false, 31], [4, true, 32], [6, false, 33]] as const) {
      for (const v of viewDariPermainan(n, dua, seed, 25)) {
        const salinan = JSON.stringify(v);
        for (const level of LEVEL_GAYA) {
          for (const gaya of BERGAYA) {
            const a = new Rng(11);
            const b = new Rng(11);
            const x = pilihAksiBot(v, level, a, gaya);
            expect(pilihAksiBot(v, level, b, gaya)).toEqual(x);
            expect(b.state).toBe(a.state);
            dicek++;
          }
        }
        expect(JSON.stringify(v)).toBe(salinan);
      }
    }
    expect(dicek).toBeGreaterThan(1000);
  });

  it('permainan penuh untuk tiap gaya × normal/jago/suhu di 3 pemain, 4 pemain 2 deck, dan 6 pemain', () => {
    const pasangan: { level: LevelBot; gaya: GayaBot }[] = LEVEL_GAYA.flatMap((level) => BERGAYA.map((gaya) => ({ level, gaya })));
    let seed = 100;
    let dimainkan = 0;
    for (const [n, dua] of [[3, false], [4, true], [6, false]] as const) {
      for (let i = 0; i < pasangan.length; i += n) {
        const isi = pasangan.slice(i, i + n);
        while (isi.length < n) isi.push({ level: 'normal', gaya: 'standar' });
        const g = mainkan(
          isi.map((x) => x.level),
          isi.map((x) => x.gaya),
          dua,
          ++seed,
          2,
        );
        expect(g.riwayat).toHaveLength(2);
        dimainkan += isi.filter((x) => x.gaya !== 'standar').length;
      }
    }
    // Setiap pasangan level × gaya main di ketiga meja.
    expect(dimainkan).toBe(pasangan.length * 3);
  }, 120_000);
});

describe('gaya berubah', () => {
  it('tiap putaran salah satu gaya tetap, sama sepanjang putaran, berbeda antar putaran dan seed', () => {
    const terlihat = new Set<string>();
    const perPutaran = new Map<string, string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const v of viewDariPermainan(4, false, seed, 120)) {
        const g = gayaPutaran(v, 'berubah');
        expect(GAYA_TETAP).toContain(g);
        const kunci = `${seed}|${v.putaran!.nomor}|${v.saya}`;
        const ada = perPutaran.get(kunci);
        if (ada) expect(g).toBe(ada);
        else perPutaran.set(kunci, g);
        terlihat.add(g);
      }
    }
    expect(perPutaran.size).toBeGreaterThan(40);
    expect(terlihat.size).toBe(GAYA_TETAP.length);
    // Kursi yang sama tidak selalu bergaya sama di putaran 1 dan 2.
    let beda = 0;
    for (let seed = 1; seed <= 8; seed++) {
      for (let i = 0; i < 4; i++) {
        const satu = perPutaran.get(`${seed}|1|${i}`);
        const dua = perPutaran.get(`${seed}|2|${i}`);
        if (satu && dua && satu !== dua) beda++;
      }
    }
    expect(beda).toBeGreaterThan(0);
  });

  it('murni dan sama dengan memakai gaya hasil putaran itu langsung', () => {
    for (const v of viewDariPermainan(3, false, 41, 30)) {
      for (const level of LEVEL_GAYA) {
        const a = new Rng(4);
        const x = pilihAksiBot(v, level, a, 'berubah');
        const b = new Rng(4);
        expect(pilihAksiBot(v, level, b, gayaPutaran(v, 'berubah'))).toEqual(x);
        expect(b.state).toBe(a.state);
      }
    }
  });
});

describe('alat gaya', () => {
  it('moodPutaran: tetap untuk putaran yang sama, di [0, 1), berubah antar putaran', () => {
    const vs = viewDariPermainan(3, false, 12, 200);
    const pertama = vs.find((v) => v.putaran!.nomor === 1 && v.saya === 0)!;
    const kedua = vs.find((v) => v.putaran!.nomor === 2 && v.saya === 0)!;
    const m = moodPutaran(pertama, 'kilat');
    expect(moodPutaran(pertama, 'kilat')).toEqual(m);
    for (const u of m) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
    // Giliran lain di putaran yang sama: mood sama.
    const lagi = vs.filter((v) => v.putaran!.nomor === 1 && v.saya === 0).at(-1)!;
    expect(moodPutaran(lagi, 'kilat')).toEqual(m);
    expect(moodPutaran(kedua, 'kilat')).not.toEqual(m);
    // Kekuatan gaya di rentang 1 ± mood, atau 0 (libur); Normal dikali skalaNormal (bawaan 1).
    for (const v of vs) {
      for (const g of GAYA_TETAP) {
        const d = DEFINISI_GAYA[g]!;
        const kj = buatKonteksGaya(v, 'jago', g, new Rng(1))!;
        const kn = buatKonteksGaya(v, 'normal', g, new Rng(1))!;
        expect(kn.kali).toBeCloseTo(kj.kali * (d.skalaNormal ?? 1), 12);
        if (kj.kali === 0) continue;
        expect(Math.abs(kj.kali - 1)).toBeLessThanOrEqual(d.mood + 1e-12);
      }
    }
  });

  it('tahanTinggi: As (bobotAs) dan Londo ditahan selama fase < sampai (bawaan 0,3), hanya di putaran yang aktif', () => {
    const g = skenario({
      rankJoker: 4,
      giliran: 0,
      tangan: [['As love', 'K waru', '2 kriting', '7 wajik'], ['J love', '6 kriting', '2 waru'], ['8 wajik', 'Q wajik', '3 waru']],
      buangan: [['5 love', 2]],
    });
    sesudahDeck(g);
    const v = viewUntuk(g, 0);
    const tangan = v.putaran!.tangan[0]!;
    const kg = buatKonteksGaya(v, 'jago', 'kilat', new Rng(1))!;
    const t = DEFINISI_GAYA.kilat!.tahanTinggi!;
    const dgn = (x: Partial<KonteksGaya>) => ({ ...kg, kali: 1, tahanTinggiAktif: true, ...x });
    expect(t.sampai).toBe(0.45);
    expect(t.bobotAs).toBeGreaterThan(t.bobot);
    expect(biasBuang(dgn({ fase: 0.44 }), kartu('As love'), tangan)).toBe(-t.bobotAs!);
    expect(biasBuang(dgn({ fase: 0.44 }), kartu('K waru'), tangan)).toBe(-t.bobot);
    expect(biasBuang(dgn({ fase: 0.44 }), kartu('7 wajik'), tangan)).toBe(0);
    expect(biasBuang(dgn({ fase: 0.46 }), kartu('As love'), tangan)).toBe(0);
    expect(biasBuang(dgn({ fase: 0.44, tahanTinggiAktif: false }), kartu('As love'), tangan)).toBe(0);
    // Tanpa sampai dan bobotAs: fase < 0,3, dan As memakai bobot yang sama dengan Londo.
    const bawaan = { ...kg.def, tahanTinggi: { ...t, sampai: undefined, bobotAs: undefined } };
    expect(biasBuang(dgn({ fase: 0.29, def: bawaan }), kartu('As love'), tangan)).toBe(-t.bobot);
    expect(biasBuang(dgn({ fase: 0.31, def: bawaan }), kartu('As love'), tangan)).toBe(0);
  });

  it('pilihDekat: tanpa seri tidak memakai rng; seri dalam toleransi dipilih acak', () => {
    const kg = { def: { ...DEFINISI_GAYA.pemburu!, toleransi: 1 }, rng: new Rng(42) };
    expect(pilihDekat([{ isi: 'a', skor: 5 }, { isi: 'b', skor: 3.9 }], kg)).toBe('a');
    expect(pilihDekat([{ isi: 'a', skor: 1 }, { isi: 'b', skor: 3 }, { isi: 'c', skor: 3 - 1.5 }], kg)).toBe('b');
    expect(kg.rng.state).toBe(42);
    const dapat = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const r = { def: kg.def, rng: new Rng(s) };
      const x = pilihDekat([{ isi: 'a', skor: 5 }, { isi: 'b', skor: 4.2 }, { isi: 'c', skor: 2 }], r);
      expect(r.rng.state).not.toBe(s);
      dapat.add(x);
    }
    expect([...dapat].sort()).toEqual(['a', 'b']);
    expect(() => pilihDekat([], kg)).toThrow();
  });

  it('perkiraanPesimis', () => {
    const santai = { minLawan: 6, sisaGiliran: 5 };
    expect(perkiraanPesimis(santai, 4)).toBe(true);
    expect(perkiraanPesimis(santai, 3)).toBe(false);
    expect(perkiraanPesimis({ minLawan: 3, sisaGiliran: 5 }, 2)).toBe(true);
    expect(perkiraanPesimis({ minLawan: 3, sisaGiliran: 5 }, 1)).toBe(false);
    expect(perkiraanPesimis({ minLawan: 6, sisaGiliran: 1.4 }, 3)).toBe(true);
    expect(perkiraanPesimis({ minLawan: 6, sisaGiliran: 1.5 }, 3)).toBe(false);
  });

  it('menyambung: sebunga selisih 1 (2–10), atau Londo sebunga beda angka; joker hidup tidak', () => {
    const c = ctx(4);
    expect(menyambung(kartu('6 love'), kartu('5 love'), c)).toBe(true);
    expect(menyambung(kartu('7 love'), kartu('5 love'), c)).toBe(false);
    expect(menyambung(kartu('6 waru'), kartu('5 love'), c)).toBe(false);
    expect(menyambung(kartu('K love'), kartu('J love'), c)).toBe(true);
    expect(menyambung(kartu('J love'), kartu('J love#1'), c)).toBe(false);
    expect(menyambung(kartu('10 love'), kartu('J love'), c)).toBe(false);
    expect(menyambung(kartu('4 love'), kartu('5 love'), c)).toBe(false);
  });

  describe('adaLondoLawan', () => {
    const dasar: Skenario = {
      rankJoker: 8,
      giliran: 0,
      tangan: [['2 love', '3 love', 'K waru'], ['10 waru', '6 kriting', '4 waru'], ['8 wajik', '4 love', '3 waru']],
      buangan: [['6 waru', 2]],
    };
    const ada = (g: GameState) => adaLondoLawan(viewUntuk(g, 0));

    it('belum ada', () => expect(ada(skenario(dasar))).toBe(false));
    it('buangan pemain lain', () => expect(ada(skenario({ ...dasar, buangan: [['Q love', 1], ['6 waru', 2]] }))).toBe(true));
    it('buangan sendiri tidak', () => expect(ada(skenario({ ...dasar, buangan: [['Q love', 0], ['6 waru', 2]] }))).toBe(false));
    it('peristiwa buang putaran ini oleh pemain lain; sendiri atau putaran lalu tidak', () => {
      const buang = (pemain: number, putaran = 1) => {
        const g = skenario(dasar);
        tambahPeristiwa(g, { jenis: 'buang', pemain, kartu: kartu('J kriting'), jokerDibuang: false, sisaTangan: 4 }, putaran);
        return ada(g);
      };
      expect(buang(1)).toBe(true);
      expect(buang(0)).toBe(false);
      expect(buang(1, 0)).toBe(false);
    });
    it('peristiwa mulung yang memungut Londo buangan pemain lain', () => {
      const g = skenario(dasar);
      tambahPeristiwa(g, {
        jenis: 'mulung',
        pemain: 2,
        kartu: [{ kartu: kartu('J kriting'), pemilik: 1 }],
        idKartuJadi: [],
        sapuBersih: false,
        beruntun: 1,
        kembarAs: false,
      });
      expect(ada(g)).toBe(true);
    });
    it('kartu jadi dengan `dari` pemain lain; dari sendiri tidak', () => {
      const pakaiDari = (dari: number) => {
        const g = skenario({ ...dasar, kartuJadi: [[], [], [['J kriting', 'Q kriting', 'K kriting']]] });
        g.putaran!.kartuJadi[2][0].kartu[2].dari = dari;
        return ada(g);
      };
      expect(pakaiDari(1)).toBe(true);
      expect(pakaiDari(0)).toBe(false);
    });
  });
});

describe('sabar Londo', () => {
  // Pemain 0 sesudah ambil deck. Standar membuang K Waru terpencil (nilai 10).
  const dasar: Skenario = {
    rankJoker: 8,
    giliran: 0,
    tangan: [
      ['K waru', '2 love', '3 love', '9 kriting', '5 wajik', '7 wajik'],
      ['10 waru', 'J love', '6 kriting', '4 waru'],
      ['8 wajik', '4 love', 'Q wajik', '3 waru'],
    ],
    buangan: [['6 waru', 2]],
  };
  // Gerbang Londo diuji di putaran yang tahanTinggi-nya tidak aktif (tahanTinggi juga menahan Londo).
  const buat = (s: Partial<Skenario>, level: LevelBot, ubah: (g: GameState) => void = () => {}) =>
    denganMood({ ...dasar, ...s }, level, 'sabarLondo', (kg) => aktif(kg) && !kg.tahanTinggiAktif, (g) => {
      sesudahDeck(g);
      ubah(g);
    });

  it('menahan Londo terpencil selama belum ada pemain lain yang membuang Londo', () => {
    for (const level of LEVEL_GAYA) {
      const g = buat({}, level);
      expect(dibuang(aksi0(g, level))).toBe(id('K waru'));
      expect(dibuang(aksi0(g, level, 'sabarLondo'))).not.toBe(id('K waru'));
    }
  });

  it('membuang Londo begitu Londo pemain lain terlihat di buangan atau di kartu jadi (dari)', () => {
    const g1 = buat({ buangan: [['Q love', 1], ['6 waru', 2]] }, 'normal');
    expect(dibuang(aksi0(g1, 'normal', 'sabarLondo'))).toBe(id('K waru'));
    const g2 = buat({ kartuJadi: [[], [], [['J kriting', 'Q kriting', 'K kriting']]] }, 'normal', (g) => {
      g.putaran!.kartuJadi[2][0].kartu[2].dari = 1;
    });
    expect(dibuang(aksi0(g2, 'normal', 'sabarLondo'))).toBe(id('K waru'));
  });

  it('Londo buangan sendiri tidak membuka gerbang', () => {
    const g1 = buat({ buangan: [['Q love', 0], ['6 waru', 2]] }, 'normal');
    expect(dibuang(aksi0(g1, 'normal', 'sabarLondo'))).not.toBe(id('K waru'));
    const g2 = buat({ kartuJadi: [[], [], [['J kriting', 'Q kriting', 'K kriting']]] }, 'normal', (g) => {
      g.putaran!.kartuJadi[2][0].kartu[2].dari = 0;
      tambahPeristiwa(g, { jenis: 'buang', pemain: 0, kartu: kartu('Q love'), jokerDibuang: false, sisaTangan: 5 });
    });
    expect(dibuang(aksi0(g2, 'normal', 'sabarLondo'))).not.toBe(id('K waru'));
  });

  it('buangan yang dipaksa aturan tetap terjadi: As belum boleh, jadi K Waru dibuang', () => {
    for (const level of LEVEL_GAYA) {
      const g = buat({ tangan: [['K waru', 'As love'], dasar.tangan[1], dasar.tangan[2]] }, level);
      expect(dibuang(aksi0(g, level, 'sabarLondo'))).toBe(id('K waru'));
    }
  });
});

describe('ngurutin', () => {
  // 3 pemain, arah 1: pemain sebelum 0 = pemain 2. Buangan teratas 5 Love milik pemain 2.
  // Standar membuang 10 Waru (8 dan 9 Waru sudah di meja); 6 Love menyambung 5 Love.
  const dasar: Skenario = {
    rankJoker: 4,
    giliran: 0,
    tangan: [
      ['10 waru', '2 kriting', '3 kriting', '6 love', '9 wajik', '10 wajik'],
      ['J love', '6 kriting', '2 waru', 'As kriting'],
      ['8 wajik', 'Q wajik', '3 waru', 'K love'],
    ],
    kartuJadi: [[], [['7 waru', '8 waru', '9 waru']], []],
    buangan: [['5 love', 2]],
  };
  const buat = (s: Partial<Skenario>, level: LevelBot = 'normal') => denganMood({ ...dasar, ...s }, level, 'ngurutin', aktif, sesudahDeck);

  it('pesimis (banyak kartu lepas): membuang kartu yang menyambung buangan pemain sebelumnya', () => {
    for (const level of LEVEL_GAYA) {
      const g = buat({}, level);
      expect(dibuang(aksi0(g, level))).toBe(id('10 waru'));
      expect(dibuang(aksi0(g, level, 'ngurutin'))).toBe(id('6 love'));
    }
  });

  it('optimis: tidak dipaksa menyambung', () => {
    // 3 kartu, lawan masih banyak kartu, deck masih banyak: tidak pesimis. As boleh dibuang.
    const g = buat({
      tangan: [['As waru', '6 love', '9 wajik'], dasar.tangan[1], dasar.tangan[2]],
      kartuJadi: [[['2 kriting', '3 kriting', '4 kriting']], [['7 waru', '8 waru', '9 waru']], []],
    });
    const kg = buatKonteksGaya(viewUntuk(g, 0), 'normal', 'ngurutin', new Rng(1))!;
    expect(kg.atasPrev?.id).toBe(id('5 love'));
    expect(kg.pesimis).toBe(false);
    expect(biasBuang(kg, kartu('6 love'), viewUntuk(g, 0).putaran!.tangan[0]!)).toBe(0);
    expect(dibuang(aksi0(g, 'normal', 'ngurutin'))).toBe(dibuang(aksi0(g, 'normal')));
    expect(dibuang(aksi0(g, 'normal', 'ngurutin'))).not.toBe(id('6 love'));
  });

  describe('hanya buangan pemain sebelumnya, hanya di meja ≥ 3 orang', () => {
    // K Waru terpencil (10) jauh di atas 6 Love (3,5), jadi tanpa bias tidak ada seri. Deck tinggal 15
    // kartu (fase > 0,45): tahanTinggi tidak berlaku. Kekuatan dasar gaya ≥ 1, jadi di Normal bias
    // menyambung ≥ 14 × skalaNormal 0,7 = 9,8.
    const k: Partial<Skenario> = {
      tangan: [['K waru', '2 kriting', '3 kriting', '6 love', '9 wajik', '10 wajik'], dasar.tangan[1], dasar.tangan[2]],
      deck: ['3 love', '4 love', '7 love', '8 love', '9 love', '10 love', '2 wajik', '3 wajik', '4 wajik', '5 wajik', '6 wajik', '7 wajik', '4 kriting', '5 kriting', '7 kriting'],
    };
    const buatK = (s: Partial<Skenario>) => denganMood({ ...dasar, ...k, ...s }, 'normal', 'ngurutin', penuh, sesudahDeck);

    it('kontrol: buangan teratas milik pemain sebelumnya → 6 Love', () => {
      const g = buatK({});
      expect(dibuang(aksi0(g, 'normal'))).toBe(id('K waru'));
      expect(dibuang(aksi0(g, 'normal', 'ngurutin'))).toBe(id('6 love'));
    });

    it('buangan teratas milik pemain lain (bukan sebelum saya): tidak berpengaruh', () => {
      expect(dibuang(aksi0(buatK({ buangan: [['5 love', 1]] }), 'normal', 'ngurutin'))).toBe(id('K waru'));
    });

    it('meja 2 pemain: tidak berpengaruh', () => {
      const g = buatK({ tangan: [k.tangan![0], dasar.tangan[1]], kartuJadi: [[], [['7 waru', '8 waru', '9 waru']]], buangan: [['5 love', 1]] });
      expect(buatKonteksGaya(viewUntuk(g, 0), 'normal', 'ngurutin', new Rng(1))!.n).toBe(2);
      expect(dibuang(aksi0(g, 'normal', 'ngurutin'))).toBe(id('K waru'));
    });

    it('arah −1: pemain sebelum 0 = pemain 1', () => {
      expect(dibuang(aksi0(buatK({ arah: -1, buangan: [['5 love', 1]] }), 'normal', 'ngurutin'))).toBe(id('6 love'));
      expect(dibuang(aksi0(buatK({ arah: -1, buangan: [['5 love', 2]] }), 'normal', 'ngurutin'))).toBe(id('K waru'));
    });
  });

  it('hanya sesudah ambil deck (bukan sesudah mulung)', () => {
    const g = buat({});
    g.putaran!.sumberAmbil = 'buangan';
    expect(buatKonteksGaya(viewUntuk(g, 0), 'normal', 'ngurutin', new Rng(1))!.atasPrev).toBeNull();
  });
});

describe('pemburu pentungan', () => {
  // Sudah punya kartu jadi, jadi As boleh dibuang. Deck tinggal sedikit: standar membuang As (15).
  const dasar: Skenario = {
    rankJoker: 4,
    giliran: 0,
    tangan: [
      ['As love', '10 waru', '2 kriting', '3 kriting'],
      ['J love', '6 kriting', '2 waru', 'As kriting'],
      ['8 wajik', 'Q wajik', '3 waru', 'K love'],
    ],
    kartuJadi: [[['5 wajik', '6 wajik', '7 wajik']], [['7 waru', '8 waru', '9 waru']], []],
    buangan: [['5 love', 2]],
    deck: ['10 love', 'J kriting', '2 wajik'],
  };

  it('menahan As (calon pentungan) dan membuang kartu kecil', () => {
    for (const level of LEVEL_GAYA) {
      const g = denganMood(dasar, level, 'pemburu', penuh, sesudahDeck);
      expect(dibuang(aksi0(g, level))).toBe(id('As love'));
      expect(dibuang(aksi0(g, level, 'pemburu'))).toBe(id('10 waru'));
    }
  });

  it('tetap mentung dengan pentungan terbaik (joker 250)', () => {
    // Sama dengan test mentung di bot-kuat.test.ts: 5-6-7 Love + 9 Kriting (joker), buangan 8 Love.
    for (const level of LEVEL_GAYA) {
      let g = denganMood(
        {
          rankJoker: 9,
          giliran: 0,
          tangan: [['5 love', '6 love', '7 love', '9 kriting'], ['2 waru', '3 wajik', 'K waru'], ['4 waru', 'J wajik', 'Q kriting']],
          buangan: [['8 love', 1]],
        },
        level,
        'pemburu',
        aktif,
      );
      for (let i = 0; i < 4 && g.status === 'putaranBerjalan'; i++) g = terapkan(g, aksi0(g, level, 'pemburu'));
      expect(g.status).toBe('susunAkhir');
      expect(g.putaran!.mentung).toMatchObject({ pemain: 0, pentunganJoker: true, kepentung: [1] });
    }
  });

  describe('menunda mentung (tundaMentung)', () => {
    // Bisa mentung dengan 9 Kriting (50): mungut 7 Love untuk 5-6-7 Love, J-Q-K Waru ikut diturunkan.
    // Lawan masih ≥ 5 kartu, deck masih banyak, tangan memegang Londo.
    const tunda = (kaldu: boolean): Skenario => ({
      rankJoker: 4,
      giliran: 0,
      modeKaldu: kaldu,
      kaldu,
      konfigurasi: kaldu ? { batasPutaran: 1 } : {},
      tangan: [
        ['5 love', '6 love', '9 kriting', 'J waru', 'Q waru', 'K waru'],
        ['2 waru', '3 wajik', '8 kriting', '10 wajik', '2 love'],
        ['4 waru', 'J wajik', 'Q kriting', '3 love', '9 wajik'],
      ],
      buangan: [['7 love', 2]],
    });
    const jalankan = (g: GameState, level: 'jago' | 'suhu', tundaMentung: number) => {
      const v = viewUntuk(g, 0);
      const kg = buatKonteksGaya(v, level, 'pemburu', new Rng(5))!;
      kg.def = { ...kg.def, tundaMentung };
      kg.kali = 1;
      const base = level === 'suhu' ? PARAM_SUHU : PARAM_JAGO;
      return { aksi: aksiKuat(v, paramDenganGaya(base, level, kg), kg), kg, v };
    };

    it('syaratnya terpenuhi di skenario ini, tapi tundaMentung 0 tidak pernah menunda', () => {
      for (const level of ['jago', 'suhu'] as const) {
        const g = denganMood(tunda(false), level, 'pemburu', aktif);
        const { aksi, kg, v } = jalankan(g, level, 0);
        expect(bolehTundaMentung(kg, v.putaran!, [kartu('9 kriting')], v.putaran!.tangan[0]!)).toBe(true);
        expect(aksi).toMatchObject({ jenis: 'mulung', jumlah: 1 });
        expect(kg.rng.state).toBe(new Rng(5).state);
        // Lewat pilihAksiBot dengan definisi asli (tundaMentung 1) dan kekuatan dasar ≥ 1: selalu ditunda.
        expect(aksi0(denganMood(tunda(false), level, 'pemburu', penuh), level, 'pemburu')).toEqual({ jenis: 'ambilDeck', pemain: 0 });
      }
    });

    it('tundaMentung > 0 menunda di putaran biasa, tidak pernah di putaran kaldu', () => {
      for (const level of ['jago', 'suhu'] as const) {
        const biasa = jalankan(denganMood(tunda(false), level, 'pemburu', aktif), level, 1);
        expect(biasa.aksi).toEqual({ jenis: 'ambilDeck', pemain: 0 });
        const kaldu = jalankan(denganMood(tunda(true), level, 'pemburu', aktif), level, 1);
        expect(kaldu.v.putaran!.kaldu).toBe(true);
        expect(kaldu.aksi).toMatchObject({ jenis: 'mulung', jumlah: 1 });
        expect(bolehTundaMentung(kaldu.kg, kaldu.v.putaran!, [kartu('9 kriting')], kaldu.v.putaran!.tangan[0]!)).toBe(false);
      }
    });

    it('pentungan joker atau Londo, atau lawan tinggal sedikit kartu: tidak boleh ditunda', () => {
      const g = denganMood(tunda(false), 'suhu', 'pemburu', aktif);
      const v = viewUntuk(g, 0);
      const kg = buatKonteksGaya(v, 'suhu', 'pemburu', new Rng(5))!;
      const tangan = v.putaran!.tangan[0]!;
      expect(bolehTundaMentung(kg, v.putaran!, [kartu('4 love')], tangan)).toBe(false);
      expect(bolehTundaMentung(kg, v.putaran!, [kartu('K love')], tangan)).toBe(false);
      expect(bolehTundaMentung(kg, v.putaran!, [kartu('9 kriting'), kartu('4 waru')], tangan)).toBe(false);
      // Pemburu: lawan masih ≥ 3 kartu (tundaLawanMin) dan sisa giliran ≥ 1,5 (tundaSisaMin).
      expect(bolehTundaMentung(kg, { ...v.putaran!, jumlahKartuTangan: [6, 3, 5] }, [kartu('9 kriting')], tangan)).toBe(true);
      expect(bolehTundaMentung(kg, { ...v.putaran!, jumlahKartuTangan: [6, 2, 5] }, [kartu('9 kriting')], tangan)).toBe(false);
      expect(bolehTundaMentung({ ...kg, sisaGiliran: 1.4 }, v.putaran!, [kartu('9 kriting')], tangan)).toBe(false);
      // Tanpa tundaLawanMin/tundaSisaMin: bawaan 5 kartu dan 3 giliran.
      const bawaan = { ...kg, def: { ...kg.def, tundaLawanMin: undefined, tundaSisaMin: undefined } };
      expect(bolehTundaMentung(bawaan, v.putaran!, [kartu('9 kriting')], tangan)).toBe(true);
      expect(bolehTundaMentung(bawaan, { ...v.putaran!, jumlahKartuTangan: [6, 4, 5] }, [kartu('9 kriting')], tangan)).toBe(false);
      expect(bolehTundaMentung({ ...bawaan, sisaGiliran: 2.9 }, v.putaran!, [kartu('9 kriting')], tangan)).toBe(false);
    });
  });
});

describe('penahan', () => {
  // Pemain 1 (berikutnya) pernah mungut 7 dan 8 Kriting yang masih di tangannya: 9 Kriting menyuapinya.
  const dasar: Skenario = {
    rankJoker: 4,
    giliran: 0,
    tangan: [
      ['9 kriting', '2 love', '3 love', '5 wajik', '7 wajik'],
      ['J love', '2 waru', 'As kriting'],
      ['8 wajik', 'Q wajik', '3 waru', 'K love', '6 waru'],
    ],
    kartuJadi: [[], [['5 love', '6 love', '7 love']], []],
    buangan: [['Q waru', 1]],
  };
  const mungut = (g: GameState) => {
    sesudahDeck(g);
    tambahPeristiwa(g, {
      jenis: 'mulung',
      pemain: 1,
      kartu: [
        { kartu: kartu('7 kriting'), pemilik: 0 },
        { kartu: kartu('8 kriting'), pemilik: 2 },
      ],
      idKartuJadi: [],
      sapuBersih: false,
      beruntun: 1,
      kembarAs: false,
    });
  };

  it('normal dan jago tidak menyuapi pemain berikutnya dengan kartu yang menyambung pungutannya', () => {
    for (const level of ['normal', 'jago'] as const) {
      const g = denganMood(dasar, level, 'penahan', aktif, mungut);
      expect(dibuang(aksi0(g, level))).toBe(id('9 kriting'));
      expect(dibuang(aksi0(g, level, 'penahan'))).not.toBe(id('9 kriting'));
    }
  });

  it('normal: tanpa pungutan yang diketahui, tahanBerikut tidak menahan apa pun', () => {
    const g = denganMood(dasar, 'normal', 'penahan', aktif, sesudahDeck);
    const v = viewUntuk(g, 0);
    const kg = buatKonteksGaya(v, 'normal', 'penahan', new Rng(1))!;
    expect(kg.dekatBerikut!.every((x) => x <= 0)).toBe(true);
    // Tanpa risikoNormal (belum = null) bias semua kartu 0: penahan tidak memakai tahanTinggi.
    for (const k of v.putaran!.tangan[0]!) expect(biasBuang({ ...kg, belum: null }, k, v.putaran!.tangan[0]!)).toBe(0);
  });

  it('normal: risikoNormal menahan kartu angka per tetangga sebunga yang belum terlihat; Jago/Suhu tidak', () => {
    const g = denganMood(dasar, 'normal', 'penahan', aktif, sesudahDeck);
    const v = viewUntuk(g, 0);
    const tangan = v.putaran!.tangan[0]!;
    const kg = buatKonteksGaya(v, 'normal', 'penahan', new Rng(1))!;
    const r = DEFINISI_GAYA.penahan!.risikoNormal! * kg.kali;
    // 9 Kriting: 7, 8, 10 Kriting belum terlihat. 3 Love: 2 Love di tangan, 5 Love di kartu jadi, 4 Love belum.
    expect(biasBuang(kg, kartu('9 kriting'), tangan)).toBeCloseTo(-3 * r, 12);
    expect(biasBuang(kg, kartu('3 love'), tangan)).toBeCloseTo(-1 * r, 12);
    for (const level of ['jago', 'suhu'] as const) expect(buatKonteksGaya(v, level, 'penahan', new Rng(1))!.belum).toBeNull();
  });

  it('normal: tetangga kartu yang dibuang sendiri oleh pemain berikutnya dikurangi', () => {
    const g = denganMood(dasar, 'normal', 'penahan', aktif, (x) => {
      mungut(x);
      tambahPeristiwa(x, { jenis: 'buang', pemain: 1, kartu: kartu('10 kriting'), jokerDibuang: false, sisaTangan: 3 });
    });
    const kg = buatKonteksGaya(viewUntuk(g, 0), 'normal', 'penahan', new Rng(1))!;
    // 9 Kriting: +2 (dari 7) +2 (dari 8) −1 (tetangga 10 Kriting) = 3.
    expect(kg.dekatBerikut![tipeKartu(kartu('9 kriting'))]).toBe(3);
    expect(kg.dekatBerikut![tipeKartu(kartu('6 kriting'))]).toBe(4);
  });

  it('jago penahan menimbang bahaya untuk pemain berikutnya saja', () => {
    const g = denganMood(dasar, 'jago', 'penahan', aktif, mungut);
    const v = viewUntuk(g, 0);
    const kg = buatKonteksGaya(v, 'jago', 'penahan', new Rng(1))!;
    const par = paramDenganGaya(PARAM_JAGO, 'jago', kg);
    expect(par).toMatchObject({ bahaya: 20, suap: 10, bobotBerikut: 1, bobotLainnya: 0, ingatRiwayat: true });
    const nl = new Penilai(v, v.putaran!, 0, par);
    expect(nl.bahaya(kartu('9 kriting'))).toBeGreaterThan(10);
    expect(new Penilai(v, v.putaran!, 0, PARAM_JAGO).bahaya(kartu('9 kriting'))).toBe(0);
  });
});

describe('kilat', () => {
  it('normal mau mulung yang skornya −2', () => {
    // Mungut 5 Love (bawah) + K Waru untuk 5-6-7 Love: +5 − 10 + 3 kartu = −2.
    const g = denganMood(
      {
        rankJoker: 4,
        giliran: 0,
        tangan: [['6 love', '7 love', '2 waru', '9 kriting', 'J wajik'], ['J love', '6 kriting', '3 waru', 'As kriting'], ['8 wajik', 'Q wajik', '3 wajik', 'K love', '10 waru']],
        buangan: [['5 love', 1], ['K waru', 2]],
      },
      'normal',
      'kilat',
      aktif,
    );
    expect(aksi0(g, 'normal')).toEqual({ jenis: 'ambilDeck', pemain: 0 });
    expect(aksi0(g, 'normal', 'kilat')).toMatchObject({ jenis: 'mulung', jumlah: 2 });
  });

  it('jago dan suhu kadang mulung di view yang membuat level yang sama tanpa gaya ambil deck', () => {
    for (const level of ['jago', 'suhu'] as const) {
      let ketemu = 0;
      let dicek = 0;
      for (const [n, dua] of [[3, false], [4, true]] as const) {
        for (const seed of [1, 2, 3]) {
          for (const v of viewDariPermainan(n, dua, seed, 200)) {
            if (v.putaran!.tahap !== 'ambil' || !v.putaran!.buangan.length) continue;
            const kg = buatKonteksGaya(v, level, 'kilat', new Rng(1))!;
            if (kg.kali === 0) continue;
            dicek++;
            const standar = pilihAksiBot(v, level, new Rng(1));
            const kilat = pilihAksiBot(v, level, new Rng(1), 'kilat');
            if (standar.jenis === 'ambilDeck' && kilat.jenis === 'mulung') ketemu++;
          }
        }
      }
      expect(dicek).toBeGreaterThan(50);
      expect(ketemu).toBeGreaterThan(0);
    }
  });
});
