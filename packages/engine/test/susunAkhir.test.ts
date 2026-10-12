// Fase susun akhir: setelah deck habis, semua pemain masih boleh menurunkan kartu jadi
// dari tangan (tanpa mulung), baru skor dihitung.

import { describe, expect, it } from 'vitest';
import { pilihAksiBot, Rng, terapkan, terapkanAksi, viewUntuk, type GameState } from '../src/index.js';
import { id, semuaSelesaiSusun, skenario, spek } from './bantu.js';

/** Pemain 1 mengambil kartu terakhir deck lalu membuang; pemain 2 memegang 2 Kriting, 3 Kriting, 4 Waru (joker 4). */
function deckHabis(): GameState {
  const s = skenario({
    rankJoker: 4,
    giliran: 0,
    tangan: [['K waru', 'J love'], ['2 kriting', '3 kriting', '4 waru'], ['9 wajik']],
    buangan: [['7 love', 2]],
    deck: ['Q kriting'],
  });
  const s2 = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
  return terapkan(s2, { jenis: 'buang', pemain: 0, kartuId: id('J love') });
}

const kode = (h: ReturnType<typeof terapkanAksi>) => (h.ok ? null : h.error.kode);

describe('susun akhir setelah deck habis', () => {
  it('setelah giliran yang mengambil kartu terakhir, masuk fase susun akhir', () => {
    const s = deckHabis();
    expect(s.status).toBe('susunAkhir');
    expect(s.riwayat).toHaveLength(0);
  });

  it('contoh bug: 2 Kriting, 3 Kriting, 4 Waru (joker 4) bisa dijadikan → skor +15, bukan minus', () => {
    const s = terapkan(deckHabis(), {
      jenis: 'turunkan',
      pemain: 1,
      kartuJadi: [spek('2 kriting', '3 kriting', ['4 waru', '4 kriting'])],
    });
    // Tangan boleh habis karena tidak ada buang di fase ini.
    expect(s.putaran!.tangan[1]).toHaveLength(0);
    const akhir = semuaSelesaiSusun(s);
    expect(akhir.status).toBe('putaranSelesai');
    const r = akhir.riwayat[0].rincian[1];
    expect(r.status).toBe('aman');
    expect(r.nilaiKartuJadi).toBe(15);
    expect(r.nilaiTangan).toBe(0);
    expect(r.total).toBe(15);
    expect(akhir.riwayat[0].cara).toBe('deckHabis');
  });

  it('kalau tidak diturunkan, tetap dihitung di tangan (joker 25)', () => {
    const r = semuaSelesaiSusun(deckHabis()).riwayat[0].rincian[1];
    expect(r.total).toBe(-(5 + 5 + 25));
  });

  it('semua pemain boleh menyusun, tidak harus urut giliran', () => {
    const s = deckHabis();
    const h = terapkanAksi(s, { jenis: 'selesaiSusun', pemain: 2 });
    expect(h.ok).toBe(true);
    const h2 = terapkanAksi(s, {
      jenis: 'turunkan',
      pemain: 1,
      kartuJadi: [spek('2 kriting', '3 kriting', ['4 waru', '4 kriting'])],
    });
    expect(h2.ok).toBe(true);
  });

  it('tidak ada mulung, ambil deck, maupun buang di fase ini', () => {
    const s = deckHabis();
    expect(kode(terapkanAksi(s, { jenis: 'ambilDeck', pemain: 1 }))).toBe('STATUS_SALAH');
    expect(
      kode(terapkanAksi(s, { jenis: 'mulung', pemain: 1, jumlah: 1, kartuJadi: [spek('9 wajik')] })),
    ).toBe('STATUS_SALAH');
    expect(kode(terapkanAksi(s, { jenis: 'buang', pemain: 1, kartuId: id('2 kriting') }))).toBe('STATUS_SALAH');
  });

  it('setelah menekan Selesai, tidak bisa menurunkan lagi', () => {
    const s = terapkan(deckHabis(), { jenis: 'selesaiSusun', pemain: 1 });
    const h = terapkanAksi(s, {
      jenis: 'turunkan',
      pemain: 1,
      kartuJadi: [spek('2 kriting', '3 kriting', ['4 waru', '4 kriting'])],
    });
    expect(kode(h)).toBe('TAHAP_SALAH');
  });

  it('aturan kartu jadi tetap berlaku (3 As butuh kartu jadi lain)', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['K waru', 'J love'], ['As love', 'As waru', 'As wajik', '4 love', '5 love', '6 love'], ['9 wajik']],
      deck: ['Q kriting'],
    });
    const g = terapkan(terapkan(s, { jenis: 'ambilDeck', pemain: 0 }), { jenis: 'buang', pemain: 0, kartuId: id('J love') });
    const tanpa = terapkanAksi(g, { jenis: 'turunkan', pemain: 1, kartuJadi: [spek('As love', 'As waru', 'As wajik')] });
    expect(kode(tanpa)).toBe('AS_TIGA_BELUM_PUNYA_JADI');
    const bersama = terapkanAksi(g, {
      jenis: 'turunkan',
      pemain: 1,
      kartuJadi: [spek('As love', 'As waru', 'As wajik'), spek('4 love', '5 love', '6 love')],
    });
    expect(bersama.ok && bersama.state.putaran!.tangan[1]).toHaveLength(0);
  });

  it('kartu tangan lawan tetap tersembunyi selama susun akhir', () => {
    const v = viewUntuk(deckHabis(), 1);
    expect(v.status).toBe('susunAkhir');
    expect(v.putaran!.tangan[0]).toBeNull();
    expect(v.putaran!.tangan[1]).toHaveLength(3);
    expect(v.putaran!.selesaiSusun).toEqual([false, false, false]);
  });

  it('bot menurunkan yang bisa dijadikan lalu selesai', () => {
    let s = deckHabis();
    const rng = new Rng(1);
    for (let i = 0; i < 10 && s.status === 'susunAkhir'; i++) {
      const giliran = s.putaran!.selesaiSusun.findIndex((x) => !x);
      s = terapkan(s, pilihAksiBot(viewUntuk(s, giliran), 'normal', rng));
    }
    expect(s.status).toBe('putaranSelesai');
    expect(s.riwayat[0].rincian[1].total).toBe(15);
  });
});
