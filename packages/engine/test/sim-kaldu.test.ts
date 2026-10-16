// Simulasi mode kaldu (#42, #43): warga kedai semua level (termasuk jago/suhu) bermain dengan batas
// putaran 2. Setiap permainan harus berakhir karena putaran kaldu ditutup mentung, setiap putaran mulai
// batas itu putaran kaldu, batas skor tidak pernah dipakai, dan tidak ada aksi ditolak atau state ilegal.

import { describe, expect, it } from 'vitest';
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

const BATAS_PUTARAN = 2;
/** Pengaman: peluang putaran kaldu habis tanpa mentung sebanyak ini berturut-turut praktis nol. */
const BATAS_AMAN_PUTARAN = 40;

function mainkanKaldu(n: number, seed: number, level: LevelBot[]) {
  let g: GameState = buatPermainan({
    pemain: Array.from({ length: n }, (_, i) => `Warga ${i + 1}`),
    seed,
    // Batas skor sengaja kecil: mode kaldu harus mengabaikannya.
    konfigurasi: { modeKaldu: true, batasPutaran: BATAS_PUTARAN, batasSkorAtas: 10, batasSkorBawah: -10 },
  });
  const rng = new Rng(seed * 104729 + 7);
  let kalduLanjut = 0;
  for (let langkah = 0; g.status !== 'selesai'; langkah++) {
    if (langkah > 100_000 || g.riwayat.length > BATAS_AMAN_PUTARAN) throw new Error(`permainan kaldu tidak selesai (seed ${seed})`);
    let aksi: Aksi;
    if (g.status === 'putaranBerjalan') {
      const giliran = g.putaran!.giliran;
      aksi = pilihAksiBot(viewUntuk(g, giliran), level[giliran], rng);
    } else if (g.status === 'susunAkhir') {
      const belum = g.putaran!.selesaiSusun.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      const siapa = rng.pick(belum);
      aksi = pilihAksiBot(viewUntuk(g, siapa), level[siapa], rng);
    } else aksi = { jenis: 'mulaiPutaran' };
    const h = terapkanAksi(g, aksi);
    if (!h.ok) throw new Error(`aksi ditolak (seed ${seed}): ${JSON.stringify(aksi)} → ${h.error.pesan}`);
    const sebelum = g.riwayat.length;
    g = h.state;
    const salah = periksaInvarian(g);
    if (salah.length) throw new Error(`state ilegal (seed ${seed}) setelah ${aksi.jenis}: ${salah.join('; ')}`);
    if (aksi.jenis === 'mulaiPutaran') expect(!!g.putaran!.kaldu).toBe(g.putaran!.nomor >= BATAS_PUTARAN);
    if (g.riwayat.length > sebelum) {
      const r = g.riwayat.at(-1)!;
      expect(!!r.kaldu).toBe(r.nomor >= BATAS_PUTARAN);
      if (r.kaldu && r.cara === 'deckHabis') {
        kalduLanjut++;
        expect(g.status).toBe('putaranSelesai');
      }
      if (r.kaldu && r.cara === 'mentung') {
        expect(g.status).toBe('selesai');
        const m = r.rincian.find((x) => x.status === 'mentung')!;
        expect(m.nilaiPentungan).toBe(r.nilaiPentungan);
        expect(m.pengaliPentungan).toBe(2);
      }
      for (const x of r.rincian) expect(x.total).toBe(x.nilaiKartuJadi - x.nilaiTangan + x.nilaiPentungan - x.penaltiJoker);
    }
  }
  expect(g.alasanSelesai).toBe('kaldu');
  expect(g.riwayat.at(-1)).toMatchObject({ kaldu: true, cara: 'mentung' });
  expect(JSON.parse(JSON.stringify(g))).toEqual(g);
  return { putaran: g.riwayat.length, kalduLanjut };
}

describe('simulasi mode kaldu: setiap permainan berakhir di putaran kaldu yang ditutup mentung', () => {
  for (const n of [3, 4, 6]) {
    it(`${n} pemain, 10 seed, semua level`, async () => {
      let lanjut = 0;
      let putaran = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const level: LevelBot[] = Array.from({ length: n }, (_, i) => DAFTAR_LEVEL_BOT[(seed + i) % DAFTAR_LEVEL_BOT.length]);
        const h = mainkanKaldu(n, seed, level);
        lanjut += h.kalduLanjut;
        putaran += h.putaran;
        // Beri kesempatan worker memproses pesan dari Vitest.
        await new Promise((r) => setTimeout(r, 0));
      }
      console.log(`kaldu ${n} pemain: ${putaran} putaran, ${lanjut} putaran kaldu habis tanpa mentung`);
      expect(putaran).toBeGreaterThanOrEqual(10 * BATAS_PUTARAN);
      // Jalur "kaldu lagi" ikut teruji di setiap ukuran meja.
      expect(lanjut).toBeGreaterThan(0);
    }, 120_000);
  }
});
