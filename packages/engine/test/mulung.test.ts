import { describe, expect, it } from 'vitest';
import { terapkan, terapkanAksi, type Aksi, type GameState } from '../src/index.js';
import { id, skenario, spek, type ItemTeks } from './bantu.js';

// Buangan dari bawah ke atas: 3 Wajik (P2), K Kriting (P3), 5 Wajik (P4). Giliran P1 (indeks 0).
// Angka joker 9: 9 Waru dan 9 Love dipakai sebagai joker.
function mejaContoh(modal: string[]): GameState {
  return skenario({
    rankJoker: 9,
    giliran: 0,
    tangan: [[...modal, '8 kriting', 'Q waru'], ['2 kriting'], ['3 kriting'], ['4 kriting']],
    buangan: [
      ['3 wajik', 1],
      ['K kriting', 2],
      ['5 wajik', 3],
    ],
  });
}

function mulung(s: GameState, jumlah: number, ...kartuJadi: ItemTeks[][]) {
  return terapkanAksi(s, { jenis: 'mulung', pemain: 0, jumlah, kartuJadi: kartuJadi.map((k) => spek(...k)) });
}

function kodeError(h: ReturnType<typeof terapkanAksi>): string | null {
  return h.ok ? null : h.error.kode;
}

describe('contoh wajib Bagian 5 (pungut 3 kartu, paling bawah 3 Wajik)', () => {
  it('modal hanya 4 Wajik → ditolak (pungutan 2, modal 1)', () => {
    const s = mejaContoh(['4 wajik']);
    const h = mulung(s, 3, ['3 wajik', '4 wajik', '5 wajik']);
    expect(kodeError(h)).toBe('MODAL_KURANG');
    expect(!h.ok && h.error.pesan).toBe('Modalnya kurang, Bos. Kartu pungutan 2, modal cuma 1.');
  });

  it('modal 2 Wajik + 4 Wajik → 2-3-4 Wajik sah; 5 Wajik dan K Kriting masuk tangan', () => {
    const s = mejaContoh(['2 wajik', '4 wajik']);
    const h = mulung(s, 3, ['2 wajik', '3 wajik', '4 wajik']);
    expect(h.ok).toBe(true);
    const p = h.ok ? h.state.putaran! : null!;
    expect(p.tangan[0].map((k) => k.id)).toEqual(
      expect.arrayContaining([id('5 wajik'), id('K kriting'), id('8 kriting'), id('Q waru')]),
    );
    expect(p.tangan[0]).toHaveLength(4);
    expect(p.buangan).toHaveLength(0);
    expect(p.kartuJadi[0]).toHaveLength(1);
  });

  it('modal 2 Wajik + 4 Wajik → 2-3-4-5 Wajik juga sah (pungutan 2, modal 2)', () => {
    expect(mulung(mejaContoh(['2 wajik', '4 wajik']), 3, ['2 wajik', '3 wajik', '4 wajik', '5 wajik']).ok).toBe(true);
  });

  it('modal 4 Wajik + 6 Wajik → 3-4-5-6 Wajik sah', () => {
    expect(mulung(mejaContoh(['4 wajik', '6 wajik']), 3, ['3 wajik', '4 wajik', '5 wajik', '6 wajik']).ok).toBe(true);
  });

  it('modal 2 Wajik + joker (jadi 4 Wajik) → sah', () => {
    const h = mulung(mejaContoh(['2 wajik', '9 waru']), 3, ['2 wajik', '3 wajik', ['9 waru', '4 wajik']]);
    expect(h.ok).toBe(true);
  });

  it('modal 4 Wajik + joker (jadi 2 Wajik atau 6 Wajik) → sah', () => {
    const s = mejaContoh(['4 wajik', '9 waru']);
    expect(mulung(s, 3, [['9 waru', '2 wajik'], '3 wajik', '4 wajik']).ok).toBe(true);
    expect(mulung(s, 3, ['3 wajik', '4 wajik', '5 wajik', ['9 waru', '6 wajik']]).ok).toBe(true);
  });

  it('modal joker (jadi 2 Wajik) + 4 Wajik → sah', () => {
    expect(mulung(mejaContoh(['9 love', '4 wajik']), 3, [['9 love', '2 wajik'], '3 wajik', '4 wajik']).ok).toBe(true);
  });

  it('modal dua joker saja → ditolak (tidak ada kartu non-joker di modal)', () => {
    const s = mejaContoh(['9 waru', '9 love']);
    const h = mulung(s, 3, [['9 waru', '2 wajik'], '3 wajik', ['9 love', '4 wajik'], '5 wajik']);
    expect(kodeError(h)).toBe('MODAL_TANPA_KARTU_BIASA');
  });
});

describe('aturan mulung lainnya', () => {
  it('jumlah kartu 1 s/d n−1', () => {
    const s = mejaContoh(['2 wajik', '4 wajik']);
    expect(kodeError(mulung(s, 0, ['2 wajik', '3 wajik', '4 wajik']))).toBe('MULUNG_JUMLAH');
    const lima = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['2 wajik', '4 wajik', '8 kriting'], ['2 kriting'], ['3 kriting']],
      buangan: [
        ['3 wajik', 1],
        ['K kriting', 2],
        ['5 wajik', 1],
      ],
    });
    // 3 pemain → maksimal 2 kartu.
    expect(kodeError(mulung(lima, 3, ['2 wajik', '3 wajik', '4 wajik']))).toBe('MULUNG_JUMLAH');
  });

  it('kartu paling bawah wajib masuk kartu jadi', () => {
    const s = mejaContoh(['4 wajik', '6 wajik']);
    // Ambil 1 kartu (5 Wajik) tapi tidak dipakai; yang dijadikan kombinasi lain.
    const h = mulung(s, 2, ['4 wajik', '5 wajik', '6 wajik']);
    expect(kodeError(h)).toBe('MULUNG_TANPA_KARTU_BAWAH');
  });

  it('mulung ditolak → state tidak berubah', () => {
    const s = mejaContoh(['4 wajik']);
    const salinan = JSON.stringify(s);
    mulung(s, 3, ['3 wajik', '4 wajik', '5 wajik']);
    expect(JSON.stringify(s)).toBe(salinan);
  });

  it('pemain pertama tidak bisa mulung karena buangan kosong', () => {
    const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['2 wajik', '4 wajik'], ['2 kriting']] });
    expect(kodeError(mulung(s, 1, ['2 wajik', '3 wajik', '4 wajik']))).toBe('MULUNG_JUMLAH');
  });

  it('syarat modal hanya untuk kombinasi kartu paling bawah (Aturan Terbuka 2)', () => {
    // Pungut 2: 3 Wajik (bawah) dan 8 Love (atas). Kombinasi kedua 7-8-9 Love modalnya cuma
    // dua kartu dari tangan, tapi itu boleh karena syaratnya hanya untuk kombinasi 3 Wajik.
    const s = skenario({
      rankJoker: 2,
      giliran: 0,
      tangan: [['4 wajik', '5 wajik', '7 love', '9 love', 'K waru'], ['2 kriting'], ['3 kriting']],
      buangan: [
        ['3 wajik', 1],
        ['8 love', 2],
      ],
    });
    const h = mulung(s, 2, ['3 wajik', '4 wajik', '5 wajik'], ['7 love', '8 love', '9 love']);
    expect(h.ok).toBe(true);
  });

  it('kartu pungutan berupa joker yang sudah dibuang tidak bisa jadi pengganti', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['2 wajik', '3 wajik', 'K waru'], ['2 kriting']],
      buangan: [['9 love', 1]],
      jokerMati: ['9 love'],
    });
    expect(kodeError(mulung(s, 1, ['2 wajik', '3 wajik', ['9 love', '4 wajik']]))).toBe('JOKER_TIDAK_SAH');
  });

  it('tidak bisa menempel ke kartu jadi yang sudah ada (7.4)', () => {
    // Pemain 1 punya 3-4-5 Wajik di meja. Mencoba memakai kartu itu bersama 6 Wajik pungutan ditolak.
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['7 wajik', 'K waru'], ['2 kriting']],
      buangan: [['6 wajik', 1]],
      kartuJadi: [[['3 wajik', '4 wajik', '5 wajik']]],
    });
    const h = mulung(s, 1, ['5 wajik', '6 wajik', '7 wajik']);
    expect(kodeError(h)).toBe('KARTU_TIDAK_ADA');
  });
});

describe('seri Londo lewat mulung', () => {
  // Tangan: Q Kriting. Buangan dua teratas: J Kriting dan K Kriting.
  const s = () =>
    skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['Q kriting', '4 love', '8 waru'], ['2 kriting'], ['3 kriting']],
      buangan: [
        ['J kriting', 1],
        ['K kriting', 2],
      ],
    });

  it('mungut J dan K untuk J-Q-K dengan modal Q saja → ditolak (pungutan 2, modal 1)', () => {
    const h = mulung(s(), 2, ['J kriting', 'Q kriting', 'K kriting']);
    expect(kodeError(h)).toBe('MODAL_KURANG');
  });

  it('mungut K saja juga tidak bisa jadi (J masih di buangan, joker tidak bisa jadi Londo)', () => {
    expect(mulung(s(), 1, ['Q kriting', 'K kriting', '8 waru']).ok).toBe(false);
  });
});

describe('mungut As (D10, Q1 = B)', () => {
  const dasar = (tangan: string[], kartuJadi?: ItemTeks[][]) =>
    skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [tangan, ['2 kriting'], ['3 kriting']],
      buangan: [['As kriting', 2]],
      kartuJadi: kartuJadi ? [kartuJadi] : undefined,
    });

  it('2 As di tangan, belum punya kartu jadi → tidak boleh jadi 3 As', () => {
    const h = mulung(dasar(['As love', 'As waru', '8 kriting']), 1, ['As love', 'As waru', 'As kriting']);
    expect(kodeError(h)).toBe('AS_TIGA_BELUM_PUNYA_JADI');
  });

  it('boleh kalau sekaligus menurunkan kartu jadi lain dari tangan', () => {
    const s = dasar(['As love', 'As waru', '4 love', '5 love', '6 love', '8 kriting']);
    const h = mulung(s, 1, ['As love', 'As waru', 'As kriting'], ['4 love', '5 love', '6 love']);
    expect(h.ok).toBe(true);
    // Urutan dalam aksi tidak berpengaruh.
    expect(mulung(s, 1, ['4 love', '5 love', '6 love'], ['As love', 'As waru', 'As kriting']).ok).toBe(true);
  });

  it('boleh kalau sudah punya kartu jadi di meja', () => {
    const s = dasar(['As love', 'As waru', '8 kriting'], [['4 love', '5 love', '6 love']]);
    expect(mulung(s, 1, ['As love', 'As waru', 'As kriting']).ok).toBe(true);
  });

  it('4 As beda bunga selalu boleh, termasuk dari pungutan', () => {
    const s = dasar(['As love', 'As waru', 'As wajik', '8 kriting']);
    expect(mulung(s, 1, ['As love', 'As waru', 'As wajik', 'As kriting']).ok).toBe(true);
  });
});

describe('turunkan 3 As dari tangan', () => {
  const s0 = skenario({
    rankJoker: 9,
    giliran: 0,
    tangan: [['As love', 'As waru', 'As wajik', '4 love', '5 love', '6 love', '8 kriting'], ['2 kriting']],
  });
  const s = terapkan(s0, { jenis: 'ambilDeck', pemain: 0 });
  const turun = (...kj: ItemTeks[][]): Aksi => ({ jenis: 'turunkan', pemain: 0, kartuJadi: kj.map((k) => spek(...k)) });

  it('3 As sebagai kartu jadi pertama ditolak', () => {
    expect(kodeError(terapkanAksi(s, turun(['As love', 'As waru', 'As wajik'])))).toBe('AS_TIGA_BELUM_PUNYA_JADI');
  });

  it('setelah punya kartu jadi, 3 As boleh', () => {
    const s2 = terapkan(s, turun(['4 love', '5 love', '6 love']));
    expect(terapkanAksi(s2, turun(['As love', 'As waru', 'As wajik'])).ok).toBe(true);
  });
});
