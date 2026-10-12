import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  kandidatPengocok,
  periksaInvarian,
  terapkan,
  terapkanAksi,
  viewUntuk,
  type GameState,
} from '../src/index.js';
import { id, semuaSelesaiSusun, skenario } from './bantu.js';

const nama = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('pembagian kartu (Bagian 3)', () => {
  const kasus: [string, number, boolean, number, number][] = [
    ['2 pemain', 2, false, 52, 6],
    ['3 pemain', 3, false, 52, 6],
    ['4 pemain', 4, false, 52, 6],
    ['4 pemain 2 deck', 4, true, 104, 12],
    ['5 pemain', 5, false, 104, 9],
    ['6 pemain', 6, false, 104, 9],
  ];
  for (const [judul, n, duaDeck, total, perPemain] of kasus) {
    it(judul, () => {
      const g = terapkan(buatPermainan({ pemain: nama(n), seed: 42, konfigurasi: { duaDeckUntukEmpat: duaDeck } }), {
        jenis: 'mulaiPutaran',
      });
      const p = g.putaran!;
      expect(p.tangan.map((t) => t.length)).toEqual(Array(n).fill(perPemain));
      // Kartu yang dibuka dikembalikan ke deck.
      expect(p.deck.length).toBe(total - n * perPemain);
      expect(p.deck.map((k) => k.id)).toContain(p.kartuDibuka.id);
      expect(p.rankJoker).toBe(p.kartuDibuka.rank);
      expect(periksaInvarian(g)).toEqual([]);
      // Kartu bergambar joker tidak ada: semua rank 1..13.
      expect([...p.deck, ...p.tangan.flat()].every((k) => k.rank >= 1 && k.rank <= 13)).toBe(true);
    });
  }

  it('opsi 2 deck hanya berlaku untuk 4 pemain', () => {
    const g = terapkan(buatPermainan({ pemain: nama(3), seed: 1, konfigurasi: { duaDeckUntukEmpat: true } }), {
      jenis: 'mulaiPutaran',
    });
    expect(g.putaran!.tangan[0]).toHaveLength(6);
  });

  it('jumlah pemain di luar 2–6 ditolak', () => {
    expect(() => buatPermainan({ pemain: nama(1), seed: 1 })).toThrow();
    expect(() => buatPermainan({ pemain: nama(7), seed: 1 })).toThrow();
  });

  it('deterministik untuk seed yang sama', () => {
    const a = terapkan(buatPermainan({ pemain: nama(4), seed: 'abc' }), { jenis: 'mulaiPutaran' });
    const b = terapkan(buatPermainan({ pemain: nama(4), seed: 'abc' }), { jenis: 'mulaiPutaran' });
    const c = terapkan(buatPermainan({ pemain: nama(4), seed: 'abd' }), { jenis: 'mulaiPutaran' });
    expect(a).toEqual(b);
    expect(a.putaran!.deck).not.toEqual(c.putaran!.deck);
  });
});

describe('pengocok dan urutan', () => {
  it('putaran pertama: pengocok bebas dipilih, dan dia jalan pertama', () => {
    const g = terapkan(buatPermainan({ pemain: nama(4), seed: 7 }), { jenis: 'mulaiPutaran', pengocok: 2 });
    expect(g.putaran!.pengocok).toBe(2);
    expect(g.putaran!.giliran).toBe(2);
    expect(g.putaran!.tahap).toBe('ambil');
  });

  it('putaran pertama: arah awal default searah urutan duduk', () => {
    expect(buatPermainan({ pemain: nama(3), seed: 1 }).arah).toBe(1);
  });

  it('putaran berikutnya: pengocok = skor akumulasi terendah', () => {
    const g: GameState = { ...buatPermainan({ pemain: nama(4), seed: 7 }), skor: [10, -30, 5, 0], status: 'putaranSelesai' };
    g.riwayat = [{ skorAkumulasi: g.skor } as GameState['riwayat'][number]];
    expect(kandidatPengocok(g)).toEqual([1]);
    expect(terapkanAksi(g, { jenis: 'mulaiPutaran', pengocok: 0 }).ok).toBe(false);
    const h = terapkan(g, { jenis: 'mulaiPutaran' });
    expect(h.putaran!.pengocok).toBe(1);
    expect(h.putaran!.giliran).toBe(1);
  });

  it('skor terendah sama: bebas di antara mereka (dipilih atau diacak)', () => {
    const g: GameState = { ...buatPermainan({ pemain: nama(4), seed: 7 }), skor: [-30, 10, -30, 0], status: 'putaranSelesai' };
    g.riwayat = [{ skorAkumulasi: g.skor } as GameState['riwayat'][number]];
    expect(kandidatPengocok(g)).toEqual([0, 2]);
    expect(terapkan(g, { jenis: 'mulaiPutaran', pengocok: 2 }).putaran!.pengocok).toBe(2);
    expect(terapkanAksi(g, { jenis: 'mulaiPutaran', pengocok: 1 }).ok).toBe(false);
    const acak = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      acak.add(terapkan({ ...g, rng: seed }, { jenis: 'mulaiPutaran' }).putaran!.pengocok);
    }
    expect([...acak].sort()).toEqual([0, 2]);
  });

  it('arah putaran berikutnya mengikuti hasil putaran sebelumnya', () => {
    const g = { ...buatPermainan({ pemain: nama(3), seed: 7 }), arah: -1 as const };
    expect(terapkan(g, { jenis: 'mulaiPutaran' }).putaran!.arah).toBe(-1);
  });
});

describe('deck habis (6.4, Aturan Terbuka 4 = a)', () => {
  const s = skenario({
    rankJoker: 9,
    giliran: 0,
    tangan: [['4 love', 'K waru'], ['2 waru', '3 waru'], ['5 waru']],
    deck: ['8 kriting'],
  });

  it('kartu terakhir diambil → susun akhir, lalu putaran selesai dengan skor dasar', () => {
    const s2 = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
    expect(s2.putaran!.deckHabis).toBe(true);
    const s3 = terapkan(s2, { jenis: 'buang', pemain: 0, kartuId: id('K waru') });
    expect(s3.status).toBe('susunAkhir');
    const akhir = semuaSelesaiSusun(s3);
    const h = akhir.riwayat[0];
    expect(akhir.status).toBe('putaranSelesai');
    expect(h.cara).toBe('deckHabis');
    expect(h.kepentung).toEqual([]);
    expect(h.rincian.map((r) => r.status)).toEqual(['aman', 'aman', 'aman']);
    expect(h.rincian.map((r) => r.total)).toEqual([-10, -10, -5]);
    expect(akhir.arah).toBe(1);
  });
});

describe('akhir permainan (8.4)', () => {
  const selesaiPutaran = (konfigurasi: Parameters<typeof buatPermainan>[0]['konfigurasi'], skor = [0, 0, 0]) => {
    const s = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [['4 love', 'K waru'], ['2 waru', '3 waru'], ['5 waru']],
      deck: ['8 kriting'],
      konfigurasi,
      skor,
    });
    const s2 = terapkan(s, { jenis: 'ambilDeck', pemain: 0 });
    return semuaSelesaiSusun(terapkan(s2, { jenis: 'buang', pemain: 0, kartuId: id('K waru') }));
  };
  const mati = { batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null };

  it('batas putaran', () => {
    const g = selesaiPutaran({ ...mati, batasPutaran: 1 });
    expect(g.status).toBe('selesai');
    expect(g.alasanSelesai).toBe('batasPutaran');
  });

  it('batas skor atas', () => {
    const g = selesaiPutaran({ ...mati, batasSkorAtas: 100 }, [0, 0, 105]);
    expect(g.alasanSelesai).toBe('batasSkor');
  });

  it('batas skor bawah', () => {
    const g = selesaiPutaran({ ...mati, batasSkorBawah: -100 }, [-95, 0, 0]);
    expect(g.alasanSelesai).toBe('batasSkor');
  });

  it('semua syarat dinonaktifkan → permainan lanjut', () => {
    const g = selesaiPutaran(mati, [-95, 0, 105]);
    expect(g.status).toBe('putaranSelesai');
    expect(terapkanAksi(g, { jenis: 'mulaiPutaran' }).ok).toBe(true);
  });

  it('sepakat berhenti: hanya di antara putaran', () => {
    const g = selesaiPutaran(mati);
    const akhir = terapkan(g, { jenis: 'akhiriPermainan' });
    expect(akhir.status).toBe('selesai');
    expect(akhir.alasanSelesai).toBe('sepakat');
    const berjalan = skenario({ rankJoker: 9, giliran: 0, tangan: [['4 love'], ['2 waru']] });
    expect(terapkanAksi(berjalan, { jenis: 'akhiriPermainan' }).ok).toBe(false);
  });

  it('skor akumulatif antarputaran', () => {
    const g = selesaiPutaran(mati, [10, 20, 30]);
    expect(g.skor).toEqual([0, 10, 25]);
  });
});

describe('view pemain', () => {
  it('menyembunyikan tangan lawan dan urutan deck', () => {
    const g = terapkan(buatPermainan({ pemain: nama(3), seed: 3 }), { jenis: 'mulaiPutaran' });
    const v = viewUntuk(g, 1);
    expect(v.putaran!.tangan[0]).toBeNull();
    expect(v.putaran!.tangan[1]).toHaveLength(6);
    expect(v.putaran!.tangan[2]).toBeNull();
    expect(v.putaran!.jumlahKartuTangan).toEqual([6, 6, 6]);
    expect(v.putaran).not.toHaveProperty('deck');
    expect(v.putaran!.jumlahDeck).toBe(g.putaran!.deck.length);
    expect(v).not.toHaveProperty('rng');
  });
});
