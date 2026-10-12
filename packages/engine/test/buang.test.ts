import { describe, expect, it } from 'vitest';
import { terapkan, terapkanAksi, validasiBuang, AturanError, type GameState } from '../src/index.js';
import { ctx, id, kartuSemua, semuaSelesaiSusun, skenario, spek } from './bantu.js';

const ambil = (s: GameState, pemain = 0) => terapkan(s, { jenis: 'ambilDeck', pemain });
const buang = (s: GameState, t: string, pemain = 0) => terapkanAksi(s, { jenis: 'buang', pemain, kartuId: id(t) });

describe('larangan membuang As (7.4)', () => {
  it('As tidak boleh dibuang sebelum punya kartu jadi', () => {
    const s = ambil(skenario({ rankJoker: 9, giliran: 0, tangan: [['As love', '2 kriting'], ['3 waru']], deck: ['5 love', '6 love'] }));
    const h = buang(s, 'As love');
    expect(!h.ok && h.error.pesan).toBe('As belum boleh dibuang, kamu belum punya kartu jadi.');
  });

  it('As boleh dibuang setelah punya kartu jadi', () => {
    const s = ambil(
      skenario({
        rankJoker: 9,
        giliran: 0,
        tangan: [['As love', '2 kriting'], ['3 waru']],
        kartuJadi: [[['4 love', '5 love', '6 love']]],
        deck: ['7 waru', '8 waru'],
      }),
    );
    expect(buang(s, 'As love').ok).toBe(true);
  });

  it('angka joker As: As tetap tidak boleh dibuang tanpa kartu jadi (default), kecuali opsinya diaktifkan', () => {
    const buat = (boleh: boolean) =>
      ambil(
        skenario({
          rankJoker: 1,
          giliran: 0,
          tangan: [['As love', '2 kriting'], ['3 waru']],
          deck: ['7 waru', '8 waru'],
          konfigurasi: { asJokerBolehDibuangTanpaJadi: boleh },
        }),
      );
    expect(buang(buat(false), 'As love').ok).toBe(false);
    expect(buang(buat(true), 'As love').ok).toBe(true);
  });
});

describe('membuang joker (D11, D12)', () => {
  const s0 = () =>
    ambil(skenario({ rankJoker: 7, giliran: 0, tangan: [['7 waru', '2 kriting', '3 kriting'], ['4 waru']], deck: ['9 love', 'K love'] }));

  it('joker yang dibuang kena penalti 25 dan jadi kartu biasa', () => {
    const h = buang(s0(), '7 waru');
    expect(h.ok).toBe(true);
    const p = h.ok ? h.state.putaran! : null!;
    expect(p.jokerDibuang).toEqual([1, 0]);
    expect(p.jokerMati).toContain(id('7 waru'));
  });

  it('joker mati yang dibuang lagi tidak kena penalti', () => {
    const s = ambil(
      skenario({
        rankJoker: 7,
        giliran: 0,
        tangan: [['7 waru', '2 kriting', '3 kriting'], ['4 waru']],
        jokerMati: ['7 waru'],
        deck: ['9 love', 'K love'],
      }),
    );
    const h = buang(s, '7 waru');
    expect(h.ok && h.state.putaran!.jokerDibuang).toEqual([0, 0]);
  });

  it('penalti masuk skor putaran itu, per kartu joker', () => {
    // Deck tinggal 1 kartu: setelah dibuang, putaran selesai (deck habis) dan skor dihitung.
    const s = ambil(
      skenario({ rankJoker: 7, giliran: 0, tangan: [['7 waru', '2 kriting', '3 kriting'], ['4 waru']], deck: ['9 love'] }),
    );
    const h = buang(s, '7 waru');
    const hasil = h.ok ? semuaSelesaiSusun(h.state).riwayat[0] : null!;
    const r = hasil.rincian[0];
    expect(r.penaltiJoker).toBe(25);
    // Tangan: 2 Kriting, 3 Kriting, 9 Love = 15. Skor = 0 − 15 − 25.
    expect(r.total).toBe(-40);
  });
});

describe('setelah ambil dari deck tidak bisa nutup (Aturan Terbuka 3)', () => {
  it('turunkan yang menyisakan cuma 1 kartu ditolak', () => {
    // Tangan 3 kartu, ambil deck jadi 4. Tidak boleh jadikan 3 lalu buang 1.
    const s = ambil(
      skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', '5 love', '6 love'], ['2 waru']], deck: ['K waru', 'Q waru'] }),
    );
    const h = terapkanAksi(s, { jenis: 'turunkan', pemain: 0, kartuJadi: [spek('4 love', '5 love', '6 love')] });
    expect(!h.ok && h.error.kode).toBe('SISAKAN_KARTU');
  });

  it('validasi buang menolak membuang kartu terakhir tanpa mulung', () => {
    expect(() =>
      validasiBuang({
        tangan: kartuSemua('K waru'),
        punyaKartuJadi: true,
        sumberAmbil: 'deck',
        kartuId: id('K waru'),
        ctx: ctx(9),
        asJokerBolehDibuangTanpaJadi: false,
      }),
    ).toThrow(AturanError);
  });

  it('tidak bisa menurunkan semua kartu (harus ada yang dibuang)', () => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['4 love', '6 love'], ['2 waru']],
      buangan: [['5 love', 1]],
    });
    const h = terapkanAksi(s, { jenis: 'mulung', pemain: 0, jumlah: 1, kartuJadi: [spek('4 love', '5 love', '6 love')] });
    expect(!h.ok && h.error.kode).toBe('SISAKAN_KARTU');
  });
});

describe('urutan giliran', () => {
  const s = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love', '6 love'], ['2 waru', '3 waru'], ['5 waru']] });

  it('bukan giliran → ditolak', () => {
    const h = terapkanAksi(s, { jenis: 'ambilDeck', pemain: 1 });
    expect(!h.ok && h.error.kode).toBe('BUKAN_GILIRAN');
  });

  it('buang sebelum ambil → ditolak; ambil dua kali → ditolak', () => {
    expect(buang(s, '4 love').ok).toBe(false);
    const s2 = ambil(s);
    expect(terapkanAksi(s2, { jenis: 'ambilDeck', pemain: 0 }).ok).toBe(false);
  });

  it('pengocok jalan pertama, lalu searah arah putaran', () => {
    const s2 = buang(ambil(s), '4 love');
    expect(s2.ok && s2.state.putaran!.giliran).toBe(1);
    const mundur = skenario({ rankJoker: 9, giliran: 0, arah: -1, tangan: [['4 love', '6 love'], ['2 waru'], ['5 waru']] });
    const s3 = buang(ambil(mundur), '4 love');
    expect(s3.ok && s3.state.putaran!.giliran).toBe(2);
  });

  it('kartu buangan mencatat pemiliknya', () => {
    const s2 = buang(ambil(s), '6 love');
    expect(s2.ok && s2.state.putaran!.buangan.at(-1)).toMatchObject({ pemilik: 0, kartu: { id: id('6 love') } });
  });
});
