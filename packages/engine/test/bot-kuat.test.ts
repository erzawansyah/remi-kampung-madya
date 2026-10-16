// Warga kedai level jago dan suhu: selalu mengirim aksi sah, murni (tidak menyimpan apa pun di antara
// panggilan), memakai kesempatan mentung dengan pentungan terbaik, susun akhir tidak kalah dari normal,
// dan suhu lebih unggul dari normal di sekumpulan seed tetap. Kekuatan yang sebenarnya diukur dengan
// arena (packages/engine/scripts/arena.ts), bukan di sini.

import { describe, expect, it } from 'vitest';
import {
  buatPermainan,
  periksaInvarian,
  pilihAksiBot,
  Rng,
  terapkan,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
} from '../src/index.js';
import { aksiKuat, BATAS_TANGAN_KUAT, PARAM_JAGO, PARAM_SUHU } from '../src/bot/strategi.js';
import { id, skenario } from './bantu.js';

const cariMentung = (g: GameState) => g.peristiwa.find((e) => e.jenis === 'mentung') as Extract<GameState['peristiwa'][number], { jenis: 'mentung' }> | undefined;

interface HasilMain {
  skor: number[];
  mentungKuat: number;
}

/** Mainkan permainan penuh; gagal kalau ada aksi yang ditolak atau state ilegal. */
function main(level: LevelBot[], duaDeck: boolean, seed: number, putaran: number, periksa = true): HasilMain {
  const n = level.length;
  let g: GameState = buatPermainan({
    pemain: level.map((l, i) => `${l} ${i}`),
    seed,
    konfigurasi: { duaDeckUntukEmpat: duaDeck, batasPutaran: putaran },
  });
  const rng = new Rng(seed * 31 + 7);
  let mentungKuat = 0;
  let langkah = 0;
  while (g.status !== 'selesai') {
    let aksi: Aksi;
    let siapa = -1;
    if (g.status === 'putaranBerjalan') siapa = g.putaran!.giliran;
    else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      siapa = rng.pick(belum);
    }
    if (siapa >= 0) aksi = pilihAksiBot(viewUntuk(g, siapa), level[siapa], rng);
    else aksi = { jenis: 'mulaiPutaran' };
    const h = terapkanAksi(g, aksi);
    if (!h.ok) throw new Error(`aksi ${level[siapa]} ditolak (seed ${seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    const sebelum = g.riwayat.length;
    g = h.state;
    if (periksa) expect(periksaInvarian(g)).toEqual([]);
    if (g.riwayat.length > sebelum) {
      const r = g.riwayat.at(-1)!;
      if (r.pementung !== null && (level[r.pementung] === 'jago' || level[r.pementung] === 'suhu')) mentungKuat++;
    }
    if (++langkah > 20000) throw new Error('permainan tidak selesai');
  }
  return { skor: g.skor, mentungKuat };
}

describe('warga kedai jago dan suhu', () => {
  it('permainan penuh di semua ukuran meja tanpa aksi ditolak maupun state ilegal', () => {
    const meja: { level: LevelBot[]; duaDeck: boolean }[] = [
      { level: ['suhu', 'jago'], duaDeck: false },
      { level: ['jago', 'suhu', 'normal'], duaDeck: false },
      { level: ['suhu', 'normal', 'jago', 'mudah'], duaDeck: false },
      { level: ['jago', 'suhu', 'suhu', 'normal'], duaDeck: true },
      { level: ['suhu', 'jago', 'normal', 'suhu', 'mudah'], duaDeck: false },
      { level: ['jago', 'normal', 'suhu', 'jago', 'normal', 'suhu'], duaDeck: false },
    ];
    let mentung = 0;
    for (const m of meja) for (const seed of [1, 2]) mentung += main(m.level, m.duaDeck, seed, m.level.length >= 5 ? 1 : 2).mentungKuat;
    expect(mentung).toBeGreaterThan(0);
  });

  it('murni: view yang sama memberi aksi yang sama dan view tidak diubah', () => {
    let g: GameState = buatPermainan({ pemain: ['A', 'B', 'C', 'D'], seed: 9, konfigurasi: { batasPutaran: 1 } });
    g = terapkan(g, { jenis: 'mulaiPutaran' });
    const rng = new Rng(3);
    let dicek = 0;
    while (g.status === 'putaranBerjalan' && dicek < 40) {
      const v = viewUntuk(g, g.putaran!.giliran);
      const salinan = JSON.stringify(v);
      for (const level of ['jago', 'suhu'] as const) {
        const a = pilihAksiBot(v, level, new Rng(1));
        expect(pilihAksiBot(v, level, new Rng(2))).toEqual(a);
        expect(JSON.stringify(v)).toBe(salinan);
      }
      g = terapkan(g, pilihAksiBot(v, 'suhu', rng));
      dicek++;
    }
    expect(dicek).toBeGreaterThan(10);
  });

  it('mentung lewat mulung dengan pentungan terbaik: joker disisakan (250), bukan 5 Love (50)', () => {
    for (const level of ['jago', 'suhu'] as const) {
      // Joker 9. Tangan 5-6-7 Love + 9 Kriting (joker); buangan teratas 8 Love milik pemain 1.
      let g = skenario({
        rankJoker: 9,
        giliran: 0,
        tangan: [['5 love', '6 love', '7 love', '9 kriting'], ['2 waru', '3 wajik', 'K waru'], ['4 waru', 'J wajik', 'Q kriting']],
        buangan: [['8 love', 1]],
      });
      for (let i = 0; i < 4 && g.status === 'putaranBerjalan'; i++) g = terapkan(g, pilihAksiBot(viewUntuk(g, 0), level, new Rng(1)));
      expect(g.status).toBe('susunAkhir');
      expect(g.putaran!.mentung).toMatchObject({ pemain: 0, pentunganJoker: true, kepentung: [1] });
      expect(g.putaran!.mentung!.pentungan.id).toBe(id('9 kriting'));
    }
  });

  describe('#41: nutup pakai beberapa joker', () => {
    /** Mainkan giliran pemain 0 sampai putaran tidak berjalan lagi (paling banyak 4 aksi). */
    const gilirkan = (g: GameState, level: LevelBot) => {
      const aksi: Aksi[] = [];
      for (let i = 0; i < 4 && g.status === 'putaranBerjalan' && g.putaran!.giliran === 0; i++) {
        const a = pilihAksiBot(viewUntuk(g, 0), level, new Rng(1));
        aksi.push(a);
        g = terapkan(g, a);
      }
      return { g, aksi };
    };
    const lawan = [
      ['2 waru', '3 wajik', 'K waru'],
      ['4 waru', 'J wajik', 'Q kriting'],
    ];

    it('pilih pentungan dua joker (500), bukan satu joker (250)', () => {
      for (const level of ['jago', 'suhu'] as const) {
        // Joker 9. 5-6 Love + 9 Kriting + 9 Waru; buangan teratas 7 Love milik pemain 1. Bisa juga
        // 5-6-7-(9 jadi 8) Love lalu mentung pakai satu joker, tapi dua joker bernilai 500.
        const g0 = skenario({
          rankJoker: 9,
          giliran: 0,
          tangan: [['5 love', '6 love', '9 kriting', '9 waru'], ...lawan],
          buangan: [['7 love', 1]],
        });
        const { g, aksi } = gilirkan(g0, level);
        expect(g.status).toBe('susunAkhir');
        const m = g.putaran!.mentung!;
        expect([m.pentungan.id, ...m.pentunganLain!.map((k) => k.id)].sort()).toEqual([id('9 kriting'), id('9 waru')].sort());
        expect(m).toMatchObject({ pemain: 0, pentunganJoker: true, kepentung: [1] });
        // Satu aksi buang berisi kedua joker.
        expect(aksi.at(-1)).toMatchObject({ jenis: 'buang', kartuIdLain: [expect.any(String)] });
        expect(cariMentung(g)!.nilai).toBe(500);
      }
    });

    it('turunkan dulu sisa kartu jadi, lalu nutup pakai dua joker', () => {
      for (const level of ['jago', 'suhu'] as const) {
        const g0 = skenario({
          rankJoker: 9,
          giliran: 0,
          tangan: [['5 love', '6 love', 'J kriting', 'Q kriting', 'K kriting', '9 kriting', '9 waru'], ...lawan],
          buangan: [['7 love', 1]],
        });
        const { g, aksi } = gilirkan(g0, level);
        expect(aksi.map((a) => a.jenis)).toEqual(['mulung', 'turunkan', 'buang']);
        expect(g.putaran!.mentung!.pentunganLain).toHaveLength(1);
        expect(cariMentung(g)!.nilai).toBe(500);
      }
    });

    it('joker mati (sudah pernah dibuang) bukan pentungan joker: kembali ke nutup satu kartu', () => {
      for (const level of ['jago', 'suhu'] as const) {
        // 9 Waru di tangan sudah pernah dibuang (dipungut lagi), jadi kartu biasa (9 = 50).
        const g0 = skenario({
          rankJoker: 9,
          giliran: 0,
          tangan: [['5 love', '6 love', '9 kriting', '9 waru'], ...lawan],
          buangan: [['7 love', 1]],
          jokerMati: ['9 waru'],
        });
        const { g, aksi } = gilirkan(g0, level);
        expect(g.status).toBe('susunAkhir');
        const m = g.putaran!.mentung!;
        expect(m).not.toHaveProperty('pentunganLain');
        expect(m.pentungan.id).toBe(id('9 waru'));
        expect(m.pentunganJoker).toBe(false);
        expect(aksi.some((a) => a.jenis === 'buang' && a.kartuIdLain)).toBe(false);
      }
    });

    it('murni dan tidak bergantung rng: aksi sama untuk rng berbeda, view tidak berubah', () => {
      const g0 = skenario({
        rankJoker: 9,
        giliran: 0,
        tangan: [['5 love', '6 love', '9 kriting', '9 waru'], ...lawan],
        buangan: [['7 love', 1]],
      });
      let g = g0;
      for (let i = 0; i < 3 && g.status === 'putaranBerjalan'; i++) {
        const v = viewUntuk(g, 0);
        const salinan = JSON.stringify(v);
        for (const level of ['jago', 'suhu'] as const) {
          const a = pilihAksiBot(v, level, new Rng(1));
          expect(pilihAksiBot(v, level, new Rng(99))).toEqual(a);
          expect(JSON.stringify(v)).toBe(salinan);
        }
        g = terapkan(g, pilihAksiBot(v, 'suhu', new Rng(1)));
      }
      expect(g.status).toBe('susunAkhir');
    });
  });

  it('tahan kartu jadi: suhu menyimpan seri di tangan, jago menurunkannya begitu ada lawan tinggal 2 kartu', () => {
    // Joker 3. Pemain 0 memegang 4-5-6 Love yang sudah jadi; buangan teratas tidak bisa dipungut.
    const meja = (kartuLawan: string[]) =>
      skenario({
        rankJoker: 3,
        giliran: 0,
        tangan: [['4 love', '5 love', '6 love', '9 kriting', 'K waru', '2 wajik'], kartuLawan, ['8 waru', 'J wajik', 'Q kriting', '7 wajik', '10 kriting']],
        buangan: [['Q love', 2]],
        deck: ['As waru', '10 love', '2 kriting', 'J waru', '8 kriting'],
      });
    /** Mainkan satu giliran pemain 0; kembalikan apakah ia menurunkan kartu jadi. */
    const turun = (level: LevelBot, kartuLawan: string[]) => {
      let g = meja(kartuLawan);
      let ada = false;
      while (g.status === 'putaranBerjalan' && g.putaran!.giliran === 0) {
        const aksi = pilihAksiBot(viewUntuk(g, 0), level, new Rng(1));
        if (aksi.jenis === 'turunkan' || aksi.jenis === 'mulung') ada = true;
        g = terapkan(g, aksi);
      }
      return ada;
    };
    const banyak = ['2 waru', '3 wajik', 'K kriting', '9 love', '5 wajik'];
    const tinggalDua = ['2 waru', '9 love'];
    expect(turun('suhu', banyak)).toBe(false);
    expect(turun('suhu', tinggalDua)).toBe(false);
    expect(turun('jago', banyak)).toBe(false);
    expect(turun('jago', tinggalDua)).toBe(true);
  });

  it('susun akhir: menurunkan susunan terbaik (normal yang serakah melewatkannya)', () => {
    // Joker 6. Pemain 0 mengambil kartu terakhir deck lalu membuang → susun akhir.
    const awal = skenario({
      rankJoker: 6,
      giliran: 0,
      tangan: [['K waru', 'J love'], ['8 wajik', '9 wajik', '2 waru', '6 waru', '3 waru', '5 waru', '6 wajik'], ['10 wajik']],
      buangan: [['Q waru', 2]],
      deck: ['Q kriting'],
    });
    const s = terapkan(terapkan(awal, { jenis: 'ambilDeck', pemain: 0 }), { jenis: 'buang', pemain: 0, kartuId: id('J love') });
    expect(s.status).toBe('susunAkhir');
    const skor = (level: LevelBot) => {
      let g = s;
      for (let i = 0; i < 6 && !g.putaran!.selesaiSusun[1]; i++) g = terapkan(g, pilihAksiBot(viewUntuk(g, 1), level, new Rng(1)));
      for (const i of [0, 2]) g = terapkan(g, { jenis: 'selesaiSusun', pemain: i });
      return g.riwayat[0].rincian[1].total;
    };
    // 2-3-(6 Waru jadi 4)-5 Waru dan (6 Wajik jadi 7)-8-9 Wajik: semua kartu jadi.
    expect(skor('jago')).toBe(35);
    expect(skor('suhu')).toBe(35);
    // Normal menurunkan yang paling panjang dulu (2-3-4-5-6 Waru) dan tersisa 8, 9 Wajik.
    expect(skor('normal')).toBe(15);
  });

  it('tangan lebih dari BATAS_TANGAN_KUAT kartu (warisan kursi manusia): pakai strategi normal, aksinya sah', () => {
    // Tangan sebesar ini tidak muncul di permainan wajar; biaya strategi kuat meledak di sana.
    const tangan14 = ['2 waru', '3 waru', '4 waru', '7 love', '8 love', 'J kriting', 'Q kriting'];
    tangan14.push('K wajik', '5 wajik', '6 kriting', '10 love', 'As love', '2 love', '4 kriting');
    expect(tangan14).toHaveLength(BATAS_TANGAN_KUAT);
    const g = skenario({
      rankJoker: 9,
      giliran: 0,
      tangan: [tangan14, ['2 kriting', '3 wajik', 'K waru'], ['5 love', 'J wajik', 'Q waru']],
      buangan: [['6 waru', 1]],
      deck: ['8 kriting', '10 waru', '3 kriting', '7 wajik'],
    });
    // Tepat di batas: masih strategi kuat.
    expect(aksiKuat(viewUntuk(g, 0), PARAM_JAGO)).not.toBeNull();
    const s = terapkan(g, { jenis: 'ambilDeck', pemain: 0 });
    const view = viewUntuk(s, 0);
    expect(view.putaran!.tangan[0]).toHaveLength(BATAS_TANGAN_KUAT + 1);
    for (const par of [PARAM_JAGO, PARAM_SUHU]) expect(aksiKuat(view, par)).toBeNull();
    const normal = pilihAksiBot(view, 'normal', new Rng(1));
    for (const level of ['jago', 'suhu'] as const) {
      const aksi = pilihAksiBot(view, level, new Rng(1));
      expect(aksi).toEqual(normal);
      expect(terapkanAksi(s, aksi).ok).toBe(true);
    }
  });

  it('suhu lebih unggul dari normal di seed tetap (kursi diputar)', () => {
    let selisih = 0;
    let jumlah = 0;
    for (let seed = 1; seed <= 4; seed++) {
      for (let kursi = 0; kursi < 4; kursi++) {
        const level: LevelBot[] = ['normal', 'normal', 'normal', 'normal'];
        level[kursi] = 'suhu';
        const { skor } = main(level, false, 100 + seed, 3, false);
        selisih += skor[kursi] - (skor.reduce((s, x) => s + x, 0) - skor[kursi]) / 3;
        jumlah++;
      }
    }
    // Per putaran; arena memberi kira-kira +30 di meja 4 pemain.
    expect(selisih / jumlah / 3).toBeGreaterThan(5);
  });
});
