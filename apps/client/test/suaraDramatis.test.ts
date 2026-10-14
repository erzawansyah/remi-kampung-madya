// @vitest-environment happy-dom
// Bunyi dan getar momen dramatis (efek/suara.ts, efek/pemutar.ts).
//
// Yang dijaga (pagar info rahasia, lihat AGENTS.md dan kepala efek/suara.ts):
// - 'tegang' sebelum pentungan dibuka SAMA untuk pentungan apa pun; 'mentungJoker' (dan getarnya) baru
//   diputar saat kartunya sudah terbuka di meja.
// - 'jokerDibuang' hanya dari peristiwa buang yang publik (jokerDibuang), tidak pernah dari isi tangan
//   atau peristiwa lain. Dicek juga di permainan bot-vs-bot sungguhan.
// - Pola getar dramatis tetap dipangkas jadi satu denyut pendek saat gerak dikurangi, dan pola penting
//   tetap lolos walau baru saja ada getar lain.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { viewUntuk, type Kartu, type Peristiwa, type Rank, type ViewPemain } from '@remi/engine';
import { mainkanBot, pasangMatchMediaPalsu } from './bantu';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/efek/sorak', () => ({ sorak: vi.fn(async () => {}), bersihkanSorak: vi.fn() }));

import { PemutarPeristiwa, type KonteksPemutar } from '../src/efek/pemutar';
import { bunyi, getar } from '../src/efek/suara';

/** Catatan urut: "bunyi:x", "getar:x", dan "|dibuka|" tepat saat scene membuka pentungan. */
let catatan: string[] = [];

/** Scene palsu: animasi langsung selesai, posisi (0,0), callback (mis. saat pentungan dibuka) dijalankan. */
function scenePalsu(): KonteksPemutar['scene'] {
  const titik = { x: 0, y: 0 };
  return new Proxy({} as KonteksPemutar['scene'], {
    get(_, metode) {
      if (metode === 'posisiDeck' || metode === 'posisiBuangan') return titik;
      if (typeof metode !== 'string' || metode === 'then') return undefined;
      return (...args: unknown[]) => {
        if (metode.startsWith('posisi')) return titik;
        for (const a of args) {
          if (typeof a !== 'function') continue;
          if (metode === 'pentung') catatan.push('|dibuka|');
          (a as () => void)();
        }
        return Promise.resolve(metode === 'naikPanggung' ? [] : undefined);
      };
    },
  });
}

function pemutar(saya: number, view: { sebelum: ViewPemain | null; sesudah: ViewPemain | null } = { sebelum: null, sesudah: null }) {
  const scene = scenePalsu();
  return new PemutarPeristiwa({
    scene,
    nama: (i) => `Pemain ${i}`,
    saya: () => saya,
    catatAksi: () => {},
    sembunyikan: () => {},
    tampakkan: () => {},
    viewSekarang: () => view.sebelum,
    viewBerikut: () => view.sesudah,
    terapkanViewBerikut: () => {},
    panelMentung: async () => {},
  });
}

const kartu = (rank: Rank): Kartu => ({ id: `waru-${rank}-0`, bunga: 'waru', rank, deck: 0 });

const mentung = (pemain: number, joker: boolean): Peristiwa => ({
  id: 10,
  putaran: 1,
  jenis: 'mentung',
  pemain,
  pentungan: kartu(5),
  pentunganJoker: joker,
  nilai: joker ? 250 : 5,
  kepentung: [1],
  dibalik: false,
});

const buang = (jokerDibuang: boolean): Peristiwa => ({
  id: 9,
  putaran: 1,
  jenis: 'buang',
  pemain: 1,
  kartu: kartu(5),
  jokerDibuang,
  sisaTangan: 4,
});

async function putar(p: PemutarPeristiwa, e: Peristiwa): Promise<string[]> {
  catatan = [];
  await p.putar(e, false);
  p.hentikan();
  return catatan;
}

beforeEach(() => {
  catatan = [];
  vi.mocked(bunyi).mockReset().mockImplementation((j) => void catatan.push(`bunyi:${j}`));
  vi.mocked(getar).mockReset().mockImplementation((g) => void catatan.push(`getar:${String(g)}`));
});
afterEach(() => {
  document.body.classList.remove('goyang');
});

describe('pentungan dibuka', () => {
  it("'tegang' sama untuk pentungan joker dan biasa; bunyi joker baru sesudah kartunya terbuka", async () => {
    const biasa = await putar(pemutar(0), mentung(2, false));
    const joker = await putar(pemutar(0), mentung(2, true));
    const sebelumDibuka = (c: string[]) => c.slice(0, c.indexOf('|dibuka|'));
    expect(sebelumDibuka(biasa)).toEqual(['bunyi:tegang']);
    expect(sebelumDibuka(joker)).toEqual(sebelumDibuka(biasa));
    expect(biasa.slice(biasa.indexOf('|dibuka|'))).toEqual(['|dibuka|', 'bunyi:mentung']);
    expect(joker.slice(joker.indexOf('|dibuka|'))).toEqual(['|dibuka|', 'bunyi:mentungJoker']);
  });

  it('yang mentung ikut bergetar saat dibuka (versi joker lebih kuat), yang lain tidak', async () => {
    expect(await putar(pemutar(2), mentung(2, false))).toContain('getar:mentung');
    expect(await putar(pemutar(2), mentung(2, true))).toContain('getar:mentungJoker');
    const lain = await putar(pemutar(0), mentung(2, true));
    expect(lain.filter((c) => c.startsWith('getar:'))).toEqual([]);
  });
});

describe('joker dibuang', () => {
  it("'jokerDibuang' hanya dari peristiwa buang yang publik", async () => {
    expect(await putar(pemutar(0), buang(true))).toEqual(['bunyi:buang', 'bunyi:jokerDibuang']);
    expect(await putar(pemutar(0), buang(false))).toEqual(['bunyi:buang']);
  });
});

describe('permainan bot-vs-bot: bunyi joker hanya dari kejadian publik', () => {
  // 2 pemain, seed 18, 3 putaran: ada joker dibuang (2×) dan pentung joker (1×).
  const hitung = { jokerDibuang: 0, mentungJoker: 0, peristiwaJokerDibuang: 0, peristiwaPentungJoker: 0 };

  beforeAll(async () => {
    const langkah = mainkanBot(2, 18, 3);
    for (const saya of [0, 1]) {
      let idTerakhir = -1;
      for (const l of langkah) {
        const view = { sebelum: viewUntuk(l.sebelum, saya), sesudah: viewUntuk(l.sesudah, saya) };
        const baru = l.sesudah.peristiwa.filter((e) => e.id > idTerakhir);
        idTerakhir = l.sesudah.peristiwa.at(-1)?.id ?? idTerakhir;
        for (let i = 0; i < baru.length; i++) {
          catatan = [];
          const p = pemutar(saya, view);
          await p.putar(baru[i], false, baru[i + 1]);
          p.hentikan();
          const e = baru[i];
          const jb = catatan.filter((c) => c === 'bunyi:jokerDibuang').length;
          const mj = catatan.filter((c) => c === 'bunyi:mentungJoker').length;
          // Bunyi joker hanya boleh muncul tepat di peristiwa publiknya.
          expect(jb, `jokerDibuang di peristiwa ${e.jenis}`).toBe(e.jenis === 'buang' && e.jokerDibuang && baru[i + 1]?.jenis !== 'mentung' ? 1 : 0);
          expect(mj, `mentungJoker di peristiwa ${e.jenis}`).toBe(e.jenis === 'mentung' && e.pentunganJoker ? 1 : 0);
          hitung.jokerDibuang += jb;
          hitung.mentungJoker += mj;
          if (e.jenis === 'buang' && e.jokerDibuang) hitung.peristiwaJokerDibuang++;
          if (e.jenis === 'mentung' && e.pentunganJoker) hitung.peristiwaPentungJoker++;
        }
      }
    }
  });

  it('skenario memuat joker dibuang dan pentung joker, dan semuanya berbunyi di kedua sisi meja', () => {
    expect(hitung.peristiwaJokerDibuang, 'skenario harus memuat joker dibuang').toBeGreaterThan(0);
    expect(hitung.peristiwaPentungJoker, 'skenario harus memuat pentung joker').toBeGreaterThan(0);
    expect(hitung.jokerDibuang).toBe(hitung.peristiwaJokerDibuang);
    expect(hitung.mentungJoker).toBe(hitung.peristiwaPentungJoker);
  });
});

describe('getar momen dramatis', () => {
  // Modul suara asli (bukan tiruan di atas), supaya POLA_GETAR dan pemangkasan gerak dikurangi ikut teruji.
  let asli: typeof import('../src/efek/suara');
  let aturPreferensi: typeof import('../src/preferensi').aturPreferensi;
  const vibrate = vi.fn(() => true);

  beforeAll(async () => {
    pasangMatchMediaPalsu(false);
    asli = await vi.importActual<typeof import('../src/efek/suara')>('../src/efek/suara');
    ({ aturPreferensi } = await import('../src/preferensi'));
  });
  beforeEach(() => {
    vibrate.mockClear();
    vi.stubGlobal('navigator', { vibrate, userActivation: { hasBeenActive: true } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pola penuh saat gerak normal; satu denyut pendek (≤30 ms) saat gerak dikurangi', () => {
    aturPreferensi({ getar: true, gerak: 'penuh' });
    asli.getar('kepentung');
    expect(vibrate).toHaveBeenLastCalledWith([...asli.POLA_GETAR.kepentung]);
    aturPreferensi({ gerak: 'kurang' });
    for (const pola of ['mentung', 'mentungJoker', 'kepentung'] as const) {
      asli.getar(pola);
      expect(vibrate).toHaveBeenLastCalledWith(30);
    }
  });

  it('pola dramatis tetap lolos walau baru saja ada getar lain', () => {
    aturPreferensi({ getar: true, gerak: 'penuh' });
    // Waktu dibekukan jauh sesudah getar test sebelumnya: semua panggilan di bawah dianggap rapat.
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 10_000);
    asli.getar('ketuk');
    asli.getar('mentungJoker');
    asli.getar('kepentung');
    expect(vibrate).toHaveBeenCalledTimes(3);
    // Pola biasa yang terlalu rapat tetap dibuang.
    asli.getar('notifikasi');
    expect(vibrate).toHaveBeenCalledTimes(3);
  });

  it('versi joker lebih kuat dari mentung biasa', () => {
    const total = (p: readonly number[]) => p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    expect(total(asli.POLA_GETAR.mentungJoker)).toBeGreaterThan(total(asli.POLA_GETAR.mentung));
  });

  it('getar mati di preferensi: tidak bergetar sama sekali', () => {
    aturPreferensi({ getar: false, gerak: 'penuh' });
    asli.getar('kepentung');
    expect(vibrate).not.toHaveBeenCalled();
  });
});
