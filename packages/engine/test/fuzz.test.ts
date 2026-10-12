// Fuzz: aksi acak (sering ilegal) tidak pernah merusak state.

import { describe, expect, it } from 'vitest';
import { buatPermainan, periksaInvarian, pilihAksiBot, Rng, terapkanAksi, viewUntuk, type Aksi, type GameState } from '../src/index.js';

describe('fuzz: aksi acak (sering ilegal) tidak pernah merusak state', () => {
  it('aksi ditolak tidak mengubah state; aksi diterima tetap legal', () => {
    const rng = new Rng(2024);
    let diterima = 0;
    let ditolak = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let g = buatPermainan({ pemain: ['A', 'B', 'C', 'D'], seed, konfigurasi: { batasPutaran: 2 } });
      let langkah = 0;
      while (g.status !== 'selesai' && langkah++ < 3000) {
        if (g.status === 'susunAkhir') {
          const siapa = g.putaran!.selesaiSusun.findIndex((x) => !x);
          g = (terapkanAksi(g, pilihAksiBot(viewUntuk(g, siapa), 'normal', rng)) as { state: GameState }).state;
          expect(periksaInvarian(g)).toEqual([]);
          continue;
        }
        if (g.status !== 'putaranBerjalan') {
          g = (terapkanAksi(g, { jenis: 'mulaiPutaran' }) as { state: GameState }).state;
          continue;
        }
        const p = g.putaran!;
        const pemain = rng.next() < 0.9 ? p.giliran : rng.int(4);
        const tangan = p.tangan[pemain];
        const pool = [...tangan, ...p.buangan.slice(-3).map((e) => e.kartu)];
        const acakKartu = (n: number) =>
          Array.from({ length: n }, () => {
            const k = rng.pick(pool);
            return rng.next() < 0.2
              ? { id: k.id, sebagai: { rank: (2 + rng.int(9)) as 2, bunga: k.bunga } }
              : { id: k.id };
          });
        const pilihan: Aksi[] = [
          { jenis: 'ambilDeck', pemain },
          { jenis: 'mulung', pemain, jumlah: 1 + rng.int(4), kartuJadi: [acakKartu(3 + rng.int(2))] },
          { jenis: 'turunkan', pemain, kartuJadi: [acakKartu(3)] },
          { jenis: 'buang', pemain, kartuId: rng.pick(pool).id },
        ];
        const aksi = rng.pick(pilihan);
        const sebelum = JSON.stringify(g);
        const h = terapkanAksi(g, aksi);
        if (!h.ok) {
          ditolak++;
          expect(JSON.stringify(g)).toBe(sebelum);
          // Supaya permainan tetap maju, sesekali pakai aksi bot.
          if (rng.next() < 0.3) {
            const v = viewUntuk(g, p.giliran);
            g = (terapkanAksi(g, pilihAksiBot(v, 'normal', rng)) as { state: GameState }).state;
          }
          continue;
        }
        diterima++;
        g = h.state;
        expect(periksaInvarian(g)).toEqual([]);
      }
    }
    console.log({ diterima, ditolak });
    expect(diterima).toBeGreaterThan(100);
    expect(ditolak).toBeGreaterThan(100);
  }, 120_000);
});
