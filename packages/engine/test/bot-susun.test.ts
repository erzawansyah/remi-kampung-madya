// Pencari susunan warga kedai jago/suhu dicocokkan dengan pencarian kasar (semua pembagian kartu,
// semua peran joker) memakai validator aturan. Tangan acak ber-seed: joker hidup/mati, deck kedua, 3 As.

import { describe, expect, it } from 'vitest';
import {
  buatDeck,
  isJokerHidup,
  nilaiKartuJadi,
  nilaiKartuTangan,
  nilaiPentungan,
  Rng,
  SEMUA_BUNGA,
  validasiKartuJadi,
  validasiTurunkan,
  AturanError,
  type Kartu,
  type KonteksJoker,
  type Peran,
  type Rank,
} from '../src/index.js';
import { isiDari, keSpesifikasi, Penyusun, tipeKartu } from '../src/bot/susun.js';

interface Bacaan {
  nilai: number;
  as3: boolean;
}

/** Nilai terbaik satu himpunan kartu sebagai satu kartu jadi (semua peran joker dicoba), atau null. */
function bacaKasar(kartu: Kartu[], ctx: KonteksJoker): Bacaan | null {
  const joker = kartu.filter((k) => isJokerHidup(k, ctx));
  const biasa = kartu.filter((k) => !isJokerHidup(k, ctx));
  const bunga = [...new Set(biasa.map((k) => k.bunga))];
  const peranLiar: Peran[] = [];
  if (bunga.length <= 1) {
    for (const b of bunga.length ? bunga : SEMUA_BUNGA) for (let r = 2; r <= 10; r++) peranLiar.push({ rank: r as Rank, bunga: b });
  }
  let terbaik: Bacaan | null = null;
  const pilih: (Peran | undefined)[] = joker.map(() => undefined);
  const jalan = (i: number) => {
    if (i === joker.length) {
      try {
        const h = validasiKartuJadi(
          [...biasa.map((k) => ({ kartu: k })), ...joker.map((k, j) => ({ kartu: k, sebagai: pilih[j] }))],
          ctx,
        );
        const nilai = nilaiKartuJadi(h);
        const as3 = h.jenis === 'kembarAs' && h.kartu.length === 3;
        if (!terbaik || nilai > terbaik.nilai || (nilai === terbaik.nilai && !as3)) terbaik = { nilai, as3 };
      } catch (e) {
        if (!(e instanceof AturanError)) throw e;
      }
      return;
    }
    pilih[i] = undefined;
    jalan(i + 1);
    for (const p of peranLiar) {
      pilih[i] = p;
      jalan(i + 1);
    }
  };
  jalan(0);
  return terbaik;
}

interface Daun {
  jadi: number;
  sisa: Kartu[];
}

/** Semua pembagian sah tangan menjadi kartu jadi + sisa (syarat 3 As diperiksa). */
function semuaPembagian(kartu: Kartu[], ctx: KonteksJoker, punyaJadi: boolean): Daun[] {
  const n = kartu.length;
  const cache = new Map<number, Bacaan | null>();
  const baca = (mask: number) => {
    if (!cache.has(mask)) cache.set(mask, bacaKasar(kartu.filter((_, i) => mask & (1 << i)), ctx));
    return cache.get(mask)!;
  };
  const hasil: Daun[] = [];
  const jalan = (sisaMask: number, jadi: number, sisa: Kartu[], as3: number, lain: number) => {
    if (sisaMask === 0) {
      if (as3 > 0 && lain === 0 && !punyaJadi) return;
      hasil.push({ jadi, sisa });
      return;
    }
    const i = Math.log2(sisaMask & -sisaMask);
    const tanpa = sisaMask & ~(1 << i);
    jalan(tanpa, jadi, [...sisa, kartu[i]], as3, lain);
    // Semua himpunan bagian dari sisa yang memuat kartu i.
    for (let sub = tanpa; ; sub = (sub - 1) & tanpa) {
      const m = sub | (1 << i);
      if (popcount(m) >= 3) {
        const b = baca(m);
        if (b) jalan(tanpa & ~sub, jadi + b.nilai, sisa, as3 + (b.as3 ? 1 : 0), lain + (b.as3 ? 0 : 1));
      }
      if (sub === 0) break;
    }
  };
  jalan((1 << n) - 1, 0, [], 0, 0);
  return hasil;
}

function popcount(x: number): number {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

function tanganAcak(rng: Rng, duaDeck: boolean, padat = false): { kartu: Kartu[]; ctx: KonteksJoker } {
  const deck = buatDeck(duaDeck ? 2 : 1);
  // Kartu dipusatkan di sedikit bunga dan rentang angka supaya banyak kartu jadi.
  const bunga = rng.shuffle([...SEMUA_BUNGA]).slice(0, 1 + rng.int(padat ? 2 : 3));
  const pusat = 1 + rng.int(13);
  const lebar = padat ? 3 : 4;
  const calon = deck.filter((k) => (bunga.includes(k.bunga) && Math.abs(k.rank - pusat) <= lebar) || k.rank === 1 || rng.next() < 0.05);
  const n = (padat ? 4 : 5) + rng.int(4);
  const kartu = rng.shuffle(calon).slice(0, n);
  const rankJoker = (rng.next() < 0.5 ? kartu[rng.int(kartu.length)].rank : 1 + rng.int(13)) as Rank;
  const jokerMati = kartu.filter((k) => k.rank === rankJoker && rng.next() < 0.25).map((k) => k.id);
  return { kartu, ctx: { rankJoker, jokerMati } };
}

/** Tangan yang sering bisa mentung: 1–2 seri (kadang satu kartunya diganti joker) + kartu lain. */
function tanganSeri(rng: Rng, duaDeck: boolean): { kartu: Kartu[]; ctx: KonteksJoker } {
  const deck = rng.shuffle(buatDeck(duaDeck ? 2 : 1));
  const kartu: Kartu[] = [];
  const ambil = (f: (k: Kartu) => boolean) => {
    const i = deck.findIndex((k) => f(k) && !kartu.some((x) => x.id === k.id));
    if (i >= 0) kartu.push(...deck.splice(i, 1));
  };
  const jumlahSeri = 1 + rng.int(2);
  for (let s = 0; s < jumlahSeri; s++) {
    const bunga = SEMUA_BUNGA[rng.int(4)];
    const panjang = 3 + rng.int(2);
    const awal = 2 + rng.int(10 - panjang);
    for (let r = awal; r < awal + panjang; r++) ambil((k) => k.bunga === bunga && k.rank === r);
  }
  let rankJoker = (1 + rng.int(13)) as Rank;
  if (rng.next() < 0.5) {
    // Satu kartu seri diganti joker.
    kartu.splice(rng.int(kartu.length), 1);
    const j = deck.pop()!;
    kartu.push(j);
    rankJoker = j.rank;
  }
  for (let i = rng.int(3); i > 0; i--) kartu.push(deck.pop()!);
  return { kartu, ctx: { rankJoker, jokerMati: [] } };
}

describe('pencari susunan warga kedai (jago/suhu)', () => {
  const susun = new Penyusun();

  it('mode bebas sama dengan pencarian kasar, dan susunannya sah menurut validator aturan', () => {
    const rng = new Rng(12345);
    let diuji = 0;
    for (let i = 0; i < 70; i++) {
      const { kartu, ctx } = tanganAcak(rng, i % 2 === 1);
      if (kartu.filter((k) => isJokerHidup(k, ctx)).length > 2) continue;
      const punyaJadi = rng.next() < 0.3;
      const daun = semuaPembagian(kartu, ctx, punyaJadi);
      const harap = Math.max(...daun.map((d) => d.jadi - d.sisa.reduce((s, k) => s + nilaiKartuTangan(k, ctx), 0)));
      const h = susun.cari(isiDari(kartu, ctx), punyaJadi, { catat: true })!;
      expect(h.nilai, JSON.stringify({ kartu: kartu.map((k) => k.id), ctx })).toBe(harap);
      if (h.susunan.length) {
        const spek = keSpesifikasi(h.susunan, kartu, ctx)!;
        const v = validasiTurunkan(kartu, spek, punyaJadi, 'akhir', ctx);
        expect(v.kartuJadi.reduce((s, kj) => s + nilaiKartuJadi(kj), 0)).toBe(h.nilaiJadi);
      }
      diuji++;
    }
    expect(diuji).toBeGreaterThan(50);
  });

  it('mode tepat(1) menemukan pentungan terbaik dengan satu kartu wajib dijadikan', () => {
    const rng = new Rng(777);
    let ada = 0;
    for (let i = 0; i < 90; i++) {
      const { kartu, ctx } = i % 2 ? tanganSeri(rng, i % 3 === 0) : tanganAcak(rng, i % 3 === 0, true);
      if (kartu.filter((k) => isJokerHidup(k, ctx)).length > 2) continue;
      const wajib = kartu[rng.int(kartu.length)];
      const wajibTipe = isJokerHidup(wajib, ctx) ? -1 : tipeKartu(wajib);
      const daun = semuaPembagian(kartu, ctx, true).filter(
        (d) => d.sisa.length === 1 && (wajibTipe < 0 || kartu.some((k) => tipeKartu(k) === wajibTipe && !isJokerHidup(k, ctx) && !d.sisa.includes(k))),
      );
      const harap = daun.length
        ? Math.max(...daun.map((d) => nilaiPentungan(d.sisa[0], isJokerHidup(d.sisa[0], ctx)) * 1000 + d.jadi))
        : null;
      const h = susun.cari(isiDari(kartu, ctx), true, { tepat: 1, wajib: wajibTipe, catat: true });
      expect(h ? h.nilai : null, JSON.stringify({ kartu: kartu.map((k) => k.id), ctx, wajib: wajib.id })).toBe(harap);
      if (h) {
        ada++;
        const spek = keSpesifikasi(h.susunan, kartu, ctx)!;
        const v = validasiTurunkan(kartu, spek, true, 'buangan', ctx);
        expect(v.sisaTangan).toHaveLength(1);
      }
    }
    expect(ada).toBeGreaterThan(20);
  });

  it('mode tepat(0): semua kartu jadi', () => {
    const rng = new Rng(4242);
    for (let i = 0; i < 70; i++) {
      const { kartu, ctx } = tanganAcak(rng, i % 2 === 0, true);
      if (kartu.filter((k) => isJokerHidup(k, ctx)).length > 2) continue;
      const bisa = semuaPembagian(kartu, ctx, false).some((d) => d.sisa.length === 0);
      expect(susun.cari(isiDari(kartu, ctx), false, { tepat: 0 }) !== null).toBe(bisa);
    }
  });
});
