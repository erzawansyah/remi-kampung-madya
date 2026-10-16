// Simulasi bot-vs-bot dengan seed: tidak boleh ada state ilegal maupun aksi bot yang ditolak.
// Tiap jumlah pemain punya file test sendiri supaya Vitest menjalankannya paralel.

import { afterAll, describe, expect, it } from 'vitest';
import {
  buatPermainan,
  DAFTAR_LEVEL_BOT,
  periksaInvarian,
  pilihAksiBot,
  Rng,
  terapkanAksi,
  viewUntuk,
  type Aksi,
  type GameState,
  type LevelBot,
} from '../src/index.js';

interface Statistik {
  putaran: number;
  aksi: number;
  mentung: number;
  deckHabis: number;
  mulung: number;
  dibalik: number;
  penaltiJoker: number;
  susunAkhir: number;
  /** Nutup pakai beberapa joker sekaligus (#41). */
  mentungBeberapaJoker: number;
}

export function mainkan(jumlahPemain: number, duaDeck: boolean, seed: number, level: LevelBot[], stat: Statistik) {
  let g: GameState = buatPermainan({
    pemain: Array.from({ length: jumlahPemain }, (_, i) => `Bot ${i + 1}`),
    seed,
    konfigurasi: { duaDeckUntukEmpat: duaDeck, batasPutaran: 6, batasSkorAtas: null, batasSkorBawah: null },
  });
  const rng = new Rng(seed * 7919 + 1);
  let langkah = 0;
  while (g.status !== 'selesai') {
    let aksi: Aksi;
    if (g.status === 'putaranBerjalan') {
      const giliran = g.putaran!.giliran;
      const view = viewUntuk(g, giliran);
      aksi = pilihAksiBot(view, level[giliran], rng);
    } else if (g.status === 'susunAkhir') {
      // Urutan acak: fase ini tidak bergantung urutan.
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      const siapa = rng.pick(belum);
      aksi = pilihAksiBot(viewUntuk(g, siapa), level[siapa], rng);
      if (aksi.jenis === 'turunkan') stat.susunAkhir++;
    } else {
      aksi = { jenis: 'mulaiPutaran' };
    }
    const h = terapkanAksi(g, aksi);
    if (!h.ok) throw new Error(`aksi bot ditolak (seed ${seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    if (aksi.jenis === 'mulung') stat.mulung++;
    const sebelum = g.riwayat.length;
    g = h.state;
    stat.aksi++;
    const salah = periksaInvarian(g);
    if (salah.length) throw new Error(`state ilegal (seed ${seed}) setelah ${aksi.jenis}: ${salah.join('; ')}`);
    if (g.riwayat.length > sebelum) {
      const r = g.riwayat[g.riwayat.length - 1];
      stat.putaran++;
      if (r.cara === 'mentung') stat.mentung++;
      else stat.deckHabis++;
      if (r.pentunganLain) stat.mentungBeberapaJoker++;
      if (r.dibalik) stat.dibalik++;
      stat.penaltiJoker += r.rincian.reduce((s, x) => s + x.jumlahJokerDibuang, 0);
      // Skor per pemain sesuai rumus.
      for (const x of r.rincian) {
        expect(x.total).toBe(x.nilaiKartuJadi - x.nilaiTangan + x.nilaiPentungan - x.penaltiJoker);
        if (x.status === 'mentung') expect(x.tangan).toHaveLength(0);
      }
    }
    if (++langkah > 20000) throw new Error('permainan tidak selesai');
  }
  // State akhir bisa diserialisasi dan dibaca ulang tanpa berubah.
  expect(JSON.parse(JSON.stringify(g))).toEqual(g);
}

/** 60 permainan × 6 putaran = 360 putaran per konfigurasi. */
export function ujiSimulasi(judul: string, n: number, duaDeck: boolean): void {
  describe(`simulasi bot-vs-bot: ${judul}`, () => {
    const stat: Statistik = {
      putaran: 0,
      aksi: 0,
      mentung: 0,
      deckHabis: 0,
      mulung: 0,
      dibalik: 0,
      penaltiJoker: 0,
      susunAkhir: 0,
      mentungBeberapaJoker: 0,
    };
    for (let awal = 1; awal <= 60; awal += 10) {
      it(`seed ${awal}–${awal + 9}: tanpa state ilegal maupun aksi ditolak`, async () => {
        for (let seed = awal; seed < awal + 10; seed++) {
          // Semua level ikut: mudah, normal, jago, dan suhu bergantian kursi.
          const level: LevelBot[] = Array.from({ length: n }, (_, i) => DAFTAR_LEVEL_BOT[(seed + i) % DAFTAR_LEVEL_BOT.length]);
          mainkan(n, duaDeck, seed, level, stat);
          // Beri kesempatan worker memproses pesan dari Vitest.
          await new Promise((r) => setTimeout(r, 0));
        }
        expect(stat.putaran).toBe(((awal + 9) / 10) * 60);
      }, 120_000);
    }
    afterAll(() => {
      console.log(judul, JSON.stringify(stat));
      expect(stat.mentung).toBeGreaterThan(0);
      expect(stat.mulung).toBeGreaterThan(0);
    });
  });
}
