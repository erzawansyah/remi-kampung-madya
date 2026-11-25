// Obrolan suara (0.9.0) di tata letak meja (fungsi murni hitungTataMeja): lencana mic di sudut panel lawan
// hanya dari model.suara (yang diisi SuaraLangsung dari tingkat suara), tidak pernah dari keadaan
// permainan; warga kedai / yang tidak ikut suara tanpa lencana.

import { describe, expect, it } from 'vitest';
import { buatPermainan, pilihAksiBot, Rng, terapkanAksi, viewUntuk, type GameState, type ViewPemain } from '@remi/engine';
import type { InfoMeja } from '@remi/meja';
import { hitungTataMeja, type HiasTata, type ModelTata, type UkuranLayar } from '../src/game/tataMeja';

function permainan(n: number, seed = 7): GameState {
  let g = buatPermainan({ pemain: Array.from({ length: n }, (_, i) => `Pemain ${i + 1}`), seed });
  const mulai = terapkanAksi(g, { jenis: 'mulaiPutaran' });
  if (!mulai.ok) throw new Error(mulai.error.pesan);
  g = mulai.state;
  const rng = new Rng(seed);
  for (let i = 0; i < 400 && g.status === 'putaranBerjalan' && g.putaran!.buangan.length < n - 1; i++) {
    const h = terapkanAksi(g, pilihAksiBot(viewUntuk(g, g.putaran!.giliran), 'normal', rng));
    if (!h.ok) throw new Error(h.error.pesan);
    g = h.state;
  }
  return g;
}

function info(v: ViewPemain, manusia: number[]): InfoMeja {
  return {
    kode: 'TEST',
    status: 'main',
    pengaturan: {} as InfoMeja['pengaturan'],
    kursi: v.pemain.map((p, i) => ({ jenis: manusia.includes(i) ? 'manusia' : 'bot', nama: p.nama, terhubung: true, level: 'normal' }) as InfoMeja['kursi'][number]),
    host: 0,
    kursiSaya: 0,
    setujuAkhiri: [],
    batasWaktu: null,
    diambilAlihBot: false,
    menungguJoker: [],
    botMikir: null,
  };
}

function model(v: ViewPemain, suara?: ModelTata['suara']): ModelTata {
  return {
    view: v,
    info: info(v, [0, 1, 2]),
    tangan: v.putaran!.tangan[v.saya ?? 0] ?? [],
    dipilih: new Set(),
    pilihJumlahMulung: false,
    mulung: null,
    aksiTerakhir: {},
    disembunyikan: new Set(),
    bisaPungut: false,
    kartukuDiAtas: false,
    berikutnya: null,
    fokus: null,
    ...(suara ? { suara } : {}),
  };
}

const LAYAR: UkuranLayar[] = [
  { W: 720, H: 1280, d: 2, atasCss: 56, bawahCss: 139, skalaTeks: 1 },
  { W: 1440, H: 900, d: 1, atasCss: 56, bawahCss: 151, skalaTeks: 1.3 },
];

const mic = (h: HiasTata[]) => h.filter((x): x is Extract<HiasTata, { jenis: 'mic' }> => x.jenis === 'mic');

describe('lencana mic di panel (0.9.0)', () => {
  it('tanpa model.suara: tidak ada lencana', () => {
    const v = viewUntuk(permainan(4), 0);
    for (const u of LAYAR) expect(mic(hitungTataMeja(model(v), u).hias)).toEqual([]);
  });

  it('satu lencana per lawan yang ikut suara, keadaannya persis dari model, di sudut panelnya, di dalam layar', () => {
    const v = viewUntuk(permainan(4), 0);
    const suara: ModelTata['suara'] = ['nyala', 'bicara', 'mati', null];
    for (const u of LAYAR) {
      const t = hitungTataMeja(model(v, suara), u);
      const m = mic(t.hias);
      // Kursiku sendiri (0) tidak punya panel; kursi 3 (warga kedai / tidak ikut) tanpa lencana.
      expect(m.sort((x, y) => x.kursi - y.kursi).map((x) => [x.kursi, x.keadaan])).toEqual([
        [1, 'bicara'],
        [2, 'mati'],
      ]);
      for (const x of m) {
        const panel = t.area.panel.get(x.kursi)!;
        const cx = x.kotak.x + x.kotak.w / 2;
        const cy = x.kotak.y + x.kotak.h / 2;
        expect(Math.abs(cx - panel.x)).toBeLessThanOrEqual(x.kotak.w);
        expect(Math.abs(cy - panel.y)).toBeLessThanOrEqual(x.kotak.h);
        expect(x.kotak.x).toBeGreaterThanOrEqual(0);
        expect(x.kotak.y).toBeGreaterThanOrEqual(u.atasCss * u.d);
        expect(x.kotak.x + x.kotak.w).toBeLessThanOrEqual(u.W);
      }
    }
  });

  it('lencana tidak mengubah letak apa pun selain dirinya (teks, kartu, panel)', () => {
    const v = viewUntuk(permainan(5), 0);
    for (const u of LAYAR) {
      const tanpa = hitungTataMeja(model(v), u);
      const dengan = hitungTataMeja(model(v, ['mati', 'bicara', 'lemah', 'nyala', 'mati']), u);
      expect(dengan.teks).toEqual(tanpa.teks);
      expect(dengan.kartu).toEqual(tanpa.kartu);
      expect(dengan.hias.filter((h) => h.jenis !== 'mic')).toEqual(tanpa.hias);
      expect(mic(dengan.hias).sort((x, y) => x.kursi - y.kursi).map((x) => x.keadaan)).toEqual(['bicara', 'lemah', 'nyala', 'mati']);
    }
  });

  it('keadaan permainan tidak memengaruhi lencana: model sama = lencana sama di putaran mana pun', () => {
    const g = permainan(4, 11);
    const suara: ModelTata['suara'] = [null, 'nyala', null, 'bicara'];
    const a = mic(hitungTataMeja(model(viewUntuk(g, 0), suara), LAYAR[0]!).hias).map((x) => [x.kursi, x.keadaan]).sort();
    const g2 = permainan(4, 99);
    const b = mic(hitungTataMeja(model(viewUntuk(g2, 0), suara), LAYAR[0]!).hias).map((x) => [x.kursi, x.keadaan]).sort();
    expect(a).toEqual(b);
    expect(a).toEqual([
      [1, 'nyala'],
      [3, 'bicara'],
    ]);
  });
});
