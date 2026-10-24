// Fuzz: aksi acak (sering ilegal) tidak pernah merusak state.

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
  type Bunga,
  type GameState,
  type Rank,
} from '../src/index.js';
import { kartu, semuaSelesaiSusun, skenario, spek } from './bantu.js';

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

describe('fuzz #41/#52/#53: buang beberapa kartu acak', () => {
  const BUNGA: Bunga[] = ['waru', 'love', 'kriting', 'wajik'];
  const namaR = (r: number) => (r === 1 ? 'As' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r));
  const teks = (r: number, b: Bunga, d: number) => `${namaR(r)} ${b}${d ? '#1' : ''}`;

  it('ditolak = state tidak berubah dan kodenya sesuai urutan; diterima hanya kalau sisa tangan dua joker hidup sesudah mulung, bukan kembaran pungutan', () => {
    const rng = new Rng(4141);
    let diterima = 0;
    const kode: Record<string, number> = {};
    for (let uji = 0; uji < 1500; uji++) {
      const duaDeck = rng.next() < 0.5;
      const n = duaDeck ? 4 + rng.int(3) : 2 + rng.int(3);
      const deck = duaDeck ? 2 : 1;
      const rankJoker = (1 + rng.int(13)) as Rank;
      const seri = rankJoker >= 2 && rankJoker <= 4 ? [8, 9, 10] : [2, 3, 4];
      const dipakai = new Set<string>(seri.map((r) => teks(r, 'love', 0)));
      const ambilKartu = (syarat: (r: number) => boolean): string | null => {
        for (let coba = 0; coba < 200; coba++) {
          const t = teks(1 + rng.int(13), rng.pick(BUNGA), rng.int(deck));
          if (!dipakai.has(t) && syarat(kartu(t).rank)) {
            dipakai.add(t);
            return t;
          }
        }
        return null;
      };
      const biasa = () => ambilKartu((r) => r !== rankJoker)!;
      const pementung = n - 1;
      const lewatDeck = rng.next() < 0.2;
      const mati: string[] = [];
      const tambahan: string[] = [];
      // Keputusan #53: kembaran kartu yang nanti dipungut (deck kedua), hanya ada di meja 2 deck.
      const kembar = teks(seri[2], 'love', 1);
      for (let i = 1 + rng.int(4); i > 0; i--) {
        // 0–1: joker hidup, 2: joker mati, 3: kartu biasa, 4 (2 deck): kembaran kartu pungutan.
        const jenis = rng.int(duaDeck ? 5 : 4);
        if (jenis === 4 && !dipakai.has(kembar)) {
          dipakai.add(kembar);
          tambahan.push(kembar);
          continue;
        }
        const j = jenis < 3 ? ambilKartu((r) => r === rankJoker) : null;
        if (j && jenis === 2) mati.push(j);
        tambahan.push(j ?? biasa());
      }
      const lain = Array.from({ length: n - 1 }, () => [biasa()]);
      const atasDeck = lewatDeck ? (rng.next() < 0.5 ? ambilKartu((r) => r === rankJoker) : null) ?? biasa() : null;
      let g = skenario({
        rankJoker,
        giliran: pementung,
        konfigurasi: { duaDeckUntukEmpat: duaDeck && n === 4 },
        tangan: [...lain, lewatDeck ? tambahan : [teks(seri[0], 'love', 0), teks(seri[1], 'love', 0), ...tambahan]],
        buangan: lewatDeck ? [] : [[teks(seri[2], 'love', 0), (pementung + n - 1) % n]],
        jokerMati: mati,
      });
      if (lewatDeck) {
        const d = g.putaran!.deck;
        const i = d.findIndex((k) => k.id === kartu(atasDeck!).id);
        d.push(...d.splice(i, 1));
        g = terapkan(g, { jenis: 'ambilDeck', pemain: pementung });
      } else {
        const hm = terapkanAksi(g, { jenis: 'mulung', pemain: pementung, jumlah: 1, kartuJadi: [spek(...seri.map((r) => teks(r, 'love', 0)))] });
        if (!hm.ok) {
          // #53: mulung yang menyisakan kembaran pungutan sendirian ditolak (tidak bisa jadi pentungan).
          expect(hm.error.kode).toBe('SISAKAN_KARTU');
          expect(tambahan).toEqual([kembar]);
          kode['SISAKAN_KARTU (mulung)'] = (kode['SISAKAN_KARTU (mulung)'] ?? 0) + 1;
          continue;
        }
        g = hm.state;
      }
      expect(periksaInvarian(g)).toEqual([]);

      const p = g.putaran!;
      const tangan = p.tangan[pementung];
      let pilih = rng.next() < 0.6 ? [...tangan] : tangan.filter(() => rng.next() < 0.6);
      pilih = rng.shuffle(pilih);
      const ids = pilih.map((k) => k.id);
      if (rng.next() < 0.1 && ids.length) ids.push(rng.pick(ids));
      if (rng.next() < 0.1) ids.splice(rng.int(ids.length + 1), 0, rng.next() < 0.5 ? p.tangan[0][0].id : 'bukan-kartu');
      if (ids.length < 2) continue;

      const ada = new Set(tangan.map((k) => k.id));
      // Dipakai hanya setelah semua id dipastikan ada di tangan.
      const hidup = (id: string) => tangan.find((k) => k.id === id)!.rank === rankJoker && !p.jokerMati.includes(id);
      const kembaranPungutan = (id: string) => !lewatDeck && id === kartu(kembar).id;
      const harap = ids.some((x) => !ada.has(x))
        ? 'KARTU_TIDAK_ADA'
        : new Set(ids).size !== ids.length
          ? 'KARTU_DOBEL'
          : ids.length !== tangan.length
            ? 'BUANG_SATU_KARTU'
            : p.sumberAmbil !== 'buangan'
              ? 'NUTUP_TANPA_MULUNG'
              : ids.length > 2
                ? 'NUTUP_KEBANYAKAN'
                : ids.some(kembaranPungutan)
                  ? 'PENTUNGAN_KEMBARAN'
                  : !ids.every(hidup)
                    ? 'PENTUNGAN_BUKAN_JOKER'
                    : null;

      const sebelum = JSON.stringify(g);
      const h = terapkanAksi(g, { jenis: 'buang', pemain: pementung, kartuId: ids[0], kartuIdLain: ids.slice(1) });
      expect(JSON.stringify(g)).toBe(sebelum);
      if (!h.ok) {
        expect(h.error.kode).toBe(harap);
        kode[h.error.kode] = (kode[h.error.kode] ?? 0) + 1;
        continue;
      }
      expect(harap).toBeNull();
      diterima++;
      expect(periksaInvarian(h.state)).toEqual([]);
      expect(h.state.status).toBe('susunAkhir');
      expect(h.state.putaran!.tangan[pementung]).toEqual([]);
      expect(h.state.peristiwa.slice(g.peristiwa.length).filter((e) => e.jenis === 'buang')).toHaveLength(1);
      const akhir = semuaSelesaiSusun(h.state);
      expect(periksaInvarian(akhir)).toEqual([]);
      const r = akhir.riwayat.at(-1)!;
      expect(ids).toHaveLength(2);
      expect(r.nilaiPentungan).toBe(500);
      expect(r.rincian[pementung]).toMatchObject({ status: 'mentung', nilaiPentungan: 500, penaltiJoker: 0 });
      for (const k of r.kepentung) expect(r.rincian[k].nilaiPentungan).toBe(-500);
      expect(JSON.parse(JSON.stringify(akhir))).toEqual(akhir);
    }
    console.log({ diterima, kode });
    expect(diterima).toBeGreaterThan(20);
    for (const k of [
      'KARTU_TIDAK_ADA',
      'KARTU_DOBEL',
      'BUANG_SATU_KARTU',
      'NUTUP_TANPA_MULUNG',
      'NUTUP_KEBANYAKAN',
      'PENTUNGAN_KEMBARAN',
      'PENTUNGAN_BUKAN_JOKER',
      'SISAKAN_KARTU (mulung)',
    ]) {
      expect(kode[k] ?? 0).toBeGreaterThan(0);
    }
  }, 60_000);
});
