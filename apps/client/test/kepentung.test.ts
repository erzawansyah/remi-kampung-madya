// @vitest-environment happy-dom
// Kepentung yang "ketonjok" (efek/pemutar.ts + efek/retak.ts + bunyi 'jotos'/'jotosLain').
//
// Yang dijaga:
// - Pagar info rahasia: sebelum pentungan terbuka tidak ada efek kepentung sama sekali, dan bunyi sebelum
//   dibuka ('tegang') sama untuk penonton mana pun (yang nanti kena, yang aman, yang mentung) dan
//   pentungan apa pun. Pukulan baru mendarat sesudah dibuka, menyusul sesaat (JEDA_JOTOS).
// - Varian: yang kena dapat pukulan besar (bunyi 'jotos', getar 'kepentung' sekali, layar retak dari
//   dekat tangannya, sentakan kamera); panel kursi lain yang kena retak kecil di meja (scene.retakPanel),
//   bergiliran, dengan "buk" pelan ('jotosLain') hanya untuk yang aman.
// - Preferensi: gerak dikurangi = tanpa sentakan/goyang/serpih, retakan diam lalu pudar; efek hemat =
//   tanpa kilat dan serpih. Semua lapisan dibuang sendiri sesudah durasi(), dan hentikan() membuangnya.
// - Lapisan tidak pernah menahan sentuhan dan selalu di bawah modal (popup joker, panel mentung).
// - Pola retakan deterministik dan sah; resep bunyi 'jotos'/'jotosLain' tidak menjadwalkan nilai yang
//   ditolak Web Audio (ramp eksponensial ke 0, waktu tidak hingga).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kartu, Peristiwa } from '@remi/engine';
import { pasangMatchMediaPalsu } from './bantu';

vi.mock('../src/efek/suara', () => ({ bunyi: vi.fn(), getar: vi.fn() }));
vi.mock('../src/efek/sorak', () => ({ sorak: vi.fn(async () => {}), bersihkanSorak: vi.fn() }));

import { JEDA_JOTOS, JEDA_RETAK_PANEL, PemutarPeristiwa, titikHantam, type KonteksPemutar } from '../src/efek/pemutar';
import { bersihkanRetak, gambarRetak, kotakSah, LAMA_RETAK, LAMA_RETAK_KUAT, LAMA_SENTAK, polaRetak } from '../src/efek/retak';
import { bunyi, getar } from '../src/efek/suara';
import { durasi } from '../src/gerak';
import { aturPreferensi } from '../src/preferensi';

type PeristiwaMentung = Extract<Peristiwa, { jenis: 'mentung' }>;

/** Catatan urut: "bunyi:x", "getar:x", dan "|dibuka|" tepat saat scene membuka pentungan. */
let catatan: string[] = [];
/** Banyaknya lapisan efek retak tepat SEBELUM pentungan dibuka. */
let efekSebelumDibuka = -1;
/** Panggilan scene.retakPanel (kursi lain yang kena): [pemain, opsi]. */
let retakPanel: [number, { benih: number; kuat?: boolean }][] = [];
/** Banyaknya panggilan retakPanel tepat SEBELUM pentungan dibuka. */
let panelSebelumDibuka = -1;

const KOTAK_TANGAN = { x: 20, y: 600, w: 350, h: 150 };

const lapisanRetak = () => document.querySelectorAll('#retak > *').length;

/**
 * Scene palsu: animasi langsung selesai; kotak tangan diberi angka (null kalau `tanpaKotak`) supaya titik
 * hantam bisa ditempatkan; retakPanel dicatat.
 */
function scenePalsu(tanpaKotak = false): KonteksPemutar['scene'] {
  const titik = { x: 0, y: 0, w: 10 };
  return new Proxy({} as KonteksPemutar['scene'], {
    get(_, metode) {
      if (metode === 'posisiDeck' || metode === 'posisiBuangan') return titik;
      if (typeof metode !== 'string' || metode === 'then') return undefined;
      return (...args: unknown[]) => {
        if (metode === 'kotakLayar') return !tanpaKotak && args[0] === 'tangan' ? KOTAK_TANGAN : null;
        if (metode === 'retakPanel') retakPanel.push(args as [number, { benih: number; kuat?: boolean }]);
        if (metode.startsWith('posisi')) return titik;
        for (const a of args) {
          if (typeof a !== 'function') continue;
          if (metode === 'pentung') {
            efekSebelumDibuka = lapisanRetak();
            panelSebelumDibuka = retakPanel.length;
            catatan.push('|dibuka|');
          }
          (a as () => void)();
        }
        return Promise.resolve(metode === 'naikPanggung' ? [] : undefined);
      };
    },
  });
}

function pemutar(saya: number, tanpaKotak = false) {
  return new PemutarPeristiwa({
    scene: scenePalsu(tanpaKotak),
    nama: (i) => `Pemain ${i}`,
    saya: () => saya,
    catatAksi: () => {},
    sembunyikan: () => {},
    tampakkan: () => {},
    viewSekarang: () => null,
    viewBerikut: () => null,
    terapkanViewBerikut: () => {},
    panelMentung: async () => {},
  });
}

const kartu: Kartu = { id: 'waru-5-0', bunga: 'waru', rank: 5, deck: 0 };

const mentung = (o: { pemain: number; kepentung: number[]; joker?: boolean }): PeristiwaMentung => ({
  id: 41,
  putaran: 2,
  jenis: 'mentung',
  pemain: o.pemain,
  pentungan: kartu,
  pentunganJoker: !!o.joker,
  nilai: o.joker ? 250 : 5,
  kepentung: o.kepentung,
  dibalik: false,
});

const bunyiKena = (c: string[]) => c.filter((x) => /jotos|getar:kepentung/.test(x));

beforeAll(() => {
  pasangMatchMediaPalsu(false);
});
beforeEach(() => {
  vi.useFakeTimers();
  aturPreferensi({ gerak: 'penuh', efek: 'lengkap', kecepatan: 'normal' });
  catatan = [];
  efekSebelumDibuka = -1;
  panelSebelumDibuka = -1;
  retakPanel = [];
  vi.mocked(bunyi).mockReset().mockImplementation((j) => void catatan.push(`bunyi:${j}`));
  vi.mocked(getar).mockReset().mockImplementation((g) => void catatan.push(`getar:${String(g)}`));
});
afterEach(() => {
  bersihkanRetak();
  vi.useRealTimers();
  document.body.classList.remove('goyang', 'jotos', 'jotos-kuat');
});

describe('pagar: efek kepentung hanya sesudah pentungan terbuka', () => {
  it("sebelum dibuka: tanpa lapisan retak, dan bunyinya sama ('tegang') untuk penonton dan pentungan mana pun", async () => {
    const awalan: string[][] = [];
    for (const joker of [false, true]) {
      for (const saya of [0, 1, 2, 3]) {
        catatan = [];
        const p = pemutar(saya);
        await p.putar(mentung({ pemain: 0, kepentung: [1, 2], joker }), false);
        expect(efekSebelumDibuka, `saya ${saya}, joker ${joker}`).toBe(0);
        expect(panelSebelumDibuka, `saya ${saya}, joker ${joker}`).toBe(0);
        awalan.push(catatan.slice(0, catatan.indexOf('|dibuka|')));
        // Tepat sesudah dibuka pun belum ada pukulan: ia menyusul sesudah JEDA_JOTOS.
        expect(bunyiKena(catatan)).toEqual([]);
        expect(lapisanRetak()).toBe(0);
        expect(retakPanel).toEqual([]);
        p.hentikan();
      }
    }
    for (const a of awalan) expect(a).toEqual(['bunyi:tegang']);
  });

  it('pukulan mendarat sesudah JEDA_JOTOS (ikut preferensi kecepatan), tidak lebih cepat', async () => {
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1] }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS) - 1);
    expect(bunyiKena(catatan)).toEqual([]);
    expect(lapisanRetak()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(bunyiKena(catatan)).toEqual(['bunyi:jotos', 'getar:kepentung']);
    p.hentikan();
  });

  it('mentung tanpa korban: tidak ada pukulan maupun retakan', async () => {
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [] }), false);
    vi.advanceTimersByTime(5000);
    expect(bunyiKena(catatan)).toEqual([]);
    expect(lapisanRetak()).toBe(0);
    expect(retakPanel).toEqual([]);
    p.hentikan();
  });
});

describe('yang kena: pukulan besar', () => {
  it('bunyi jotos, getar kepentung sekali, layar retak dari dekat tangan, sentakan kamera, lalu bersih sendiri', async () => {
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1] }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS));
    expect(catatan.filter((c) => c === 'getar:kepentung')).toHaveLength(1);
    expect(catatan).not.toContain('bunyi:jotosLain');

    const wadah = document.getElementById('retak')!;
    expect(wadah.style.pointerEvents).toBe('none');
    expect(wadah.getAttribute('aria-hidden')).toBe('true');
    const layar = wadah.querySelector<HTMLElement>('.retak-layar')!;
    expect(layar).not.toBeNull();
    expect(layar.classList.contains('diam')).toBe(false);
    expect(layar.querySelector('canvas.retak-kanvas')).not.toBeNull();
    expect(layar.querySelector('.kilat-jotos')).not.toBeNull();
    expect(layar.querySelectorAll('.serpih').length).toBeGreaterThan(0);
    // Titik hantam di area tangan sendiri.
    const x = parseFloat(layar.style.getPropertyValue('--retak-x'));
    const y = parseFloat(layar.style.getPropertyValue('--retak-y'));
    expect(x).toBeGreaterThanOrEqual(KOTAK_TANGAN.x);
    expect(x).toBeLessThanOrEqual(KOTAK_TANGAN.x + KOTAK_TANGAN.w);
    expect(y).toBeCloseTo(KOTAK_TANGAN.y + KOTAK_TANGAN.h * 0.3, 0);
    // Sentakan kamera meja (body.jotos) ke titik hantam, lalu lepas sendiri.
    expect(document.body.classList.contains('jotos')).toBe(true);
    expect(document.body.style.getPropertyValue('--jotos-x')).toBe(`${Math.round(x)}px`);
    vi.advanceTimersByTime(durasi(LAMA_SENTAK) + 40);
    expect(document.body.classList.contains('jotos')).toBe(false);
    // Retakan bertahan lalu dibuang (tidak menyisakan apa pun yang bisa menahan sentuhan).
    expect(lapisanRetak()).toBe(1);
    vi.advanceTimersByTime(durasi(LAMA_RETAK));
    expect(lapisanRetak()).toBe(0);
    p.hentikan();
  });

  it('pentungan joker (sudah terbuka): versi kuat dan sedikit lebih lama', async () => {
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1], joker: true }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS));
    expect(document.querySelector('.retak-layar')!.classList.contains('kuat')).toBe(true);
    expect(document.body.classList.contains('jotos-kuat')).toBe(true);
    vi.advanceTimersByTime(durasi(LAMA_RETAK));
    expect(lapisanRetak()).toBe(1);
    vi.advanceTimersByTime(durasi(LAMA_RETAK_KUAT) - durasi(LAMA_RETAK));
    expect(lapisanRetak()).toBe(0);
    p.hentikan();
  });

  it('double pentung: aku kena (layar retak) dan panel kursi lain yang kena retak kecil, tanpa "buk" tambahan', async () => {
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1, 3] }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS));
    expect(document.querySelectorAll('.retak-layar')).toHaveLength(1);
    expect(retakPanel).toEqual([[3, { benih: 41 * 7 + 3, kuat: false }]]);
    expect(catatan).not.toContain('bunyi:jotosLain');
    p.hentikan();
  });

  it('kotak tangan tidak diketahui (scene belum siap): layar retak dari bawah tengah layar', async () => {
    const p = pemutar(1, true);
    await p.putar(mentung({ pemain: 0, kepentung: [1] }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS));
    const layar = document.querySelector<HTMLElement>('.retak-layar')!;
    expect(parseFloat(layar.style.getPropertyValue('--retak-x'))).toBeCloseTo(window.innerWidth / 2, 0);
    expect(parseFloat(layar.style.getPropertyValue('--retak-y'))).toBeCloseTo(window.innerHeight * 0.74, 0);
    p.hentikan();
  });

  it('hentikan() (keluar meja) membuang retakan, sentakan, dan timernya', async () => {
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1, 2] }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS) + durasi(JEDA_RETAK_PANEL));
    expect(lapisanRetak()).toBeGreaterThan(0);
    p.hentikan();
    expect(lapisanRetak()).toBe(0);
    expect(document.body.classList.contains('jotos')).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(lapisanRetak()).toBe(0);
  });
});

describe('yang lain: retakan kecil di panel kursi yang kena', () => {
  for (const [peran, saya] of [
    ['yang aman', 3],
    ['yang mentung', 0],
  ] as const) {
    it(`${peran}: tiap panel yang kena retak bergiliran dengan "buk" pelan; tanpa layar retak dan tanpa getar`, async () => {
      const p = pemutar(saya);
      await p.putar(mentung({ pemain: 0, kepentung: [1, 2], joker: true }), false);
      vi.advanceTimersByTime(durasi(JEDA_JOTOS));
      expect(retakPanel).toEqual([[1, { benih: 41 * 7 + 1, kuat: true }]]);
      vi.advanceTimersByTime(durasi(JEDA_RETAK_PANEL));
      expect(retakPanel.map(([pemain]) => pemain)).toEqual([1, 2]);
      expect(document.querySelector('.retak-layar')).toBeNull();
      expect(document.body.classList.contains('jotos')).toBe(false);
      expect(bunyiKena(catatan)).toEqual(['bunyi:jotosLain', 'bunyi:jotosLain']);
      expect(vi.mocked(bunyi).mock.calls.filter(([j]) => j === 'jotosLain').map(([, o]) => o)).toEqual([{ urutan: 0 }, { urutan: 1 }]);
      expect(lapisanRetak()).toBe(0);
      p.hentikan();
    });
  }
});

describe('preferensi gerak dan efek', () => {
  it('gerak dikurangi: tanpa sentakan, goyang, kilat, dan serpih; retakan diam lalu pudar (lebih singkat)', async () => {
    aturPreferensi({ gerak: 'kurang' });
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1, 2], joker: true }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS) + durasi(JEDA_RETAK_PANEL));
    const layar = document.querySelector<HTMLElement>('.retak-layar')!;
    expect(layar.classList.contains('diam')).toBe(true);
    expect(layar.querySelector('canvas.retak-kanvas')).not.toBeNull();
    expect(layar.querySelector('.kilat-jotos')).toBeNull();
    expect(layar.querySelector('.serpih')).toBeNull();
    expect(document.body.classList.contains('jotos')).toBe(false);
    // Panel kursi lain tetap diberi retakan (scene sendiri yang meniadakan goyangnya).
    expect(retakPanel.map(([pemain]) => pemain)).toEqual([2]);
    // Bunyi dan getar tetap (getar sendiri dipangkas jadi satu denyut pendek oleh getar()).
    expect(bunyiKena(catatan)).toEqual(['bunyi:jotos', 'getar:kepentung']);
    expect(durasi(LAMA_RETAK_KUAT)).toBeLessThan(LAMA_RETAK_KUAT);
    vi.advanceTimersByTime(durasi(LAMA_RETAK_KUAT));
    expect(lapisanRetak()).toBe(0);
    p.hentikan();
  });

  it('efek hemat (gerak penuh): sentakan tetap, tanpa kilat, serpih, dan rona merah', async () => {
    aturPreferensi({ efek: 'hemat' });
    const p = pemutar(1);
    await p.putar(mentung({ pemain: 0, kepentung: [1, 2] }), false);
    vi.advanceTimersByTime(durasi(JEDA_JOTOS) + durasi(JEDA_RETAK_PANEL));
    const layar = document.querySelector<HTMLElement>('.retak-layar')!;
    expect(layar.classList.contains('hemat')).toBe(true);
    expect(layar.querySelector('.kilat-jotos')).toBeNull();
    expect(layar.querySelector('.serpih')).toBeNull();
    expect(document.body.classList.contains('jotos')).toBe(true);
    p.hentikan();
  });

  it('tab tersembunyi: tidak ada lapisan yang dibuat (bunyi/getar diurus suara.ts, panel diurus scene)', async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      const p = pemutar(1);
      await p.putar(mentung({ pemain: 0, kepentung: [1, 2] }), false);
      vi.advanceTimersByTime(durasi(JEDA_JOTOS) + durasi(JEDA_RETAK_PANEL));
      expect(lapisanRetak()).toBe(0);
      expect(document.body.classList.contains('jotos')).toBe(false);
      p.hentikan();
    } finally {
      delete (document as { hidden?: boolean }).hidden;
    }
  });
});

describe('lapisan tidak menutupi jendela', () => {
  // Bukan new URL(..., import.meta.url): di lingkungan happy-dom, URL milik happy-dom (bukan skema file).
  const css = (nama: string) => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/gaya', nama), 'utf8');
  const z = (nama: string) => Number(css('token.css').match(new RegExp(`${nama}:\\s*(-?\\d+)\\s*;`))?.[1]);

  it('#retak di atas meja dan bar, di bawah modal/sorakan/dialog, dan tanpa sentuhan', () => {
    expect(z('--z-retak')).toBeGreaterThan(z('--z-ui'));
    for (const atas of ['--z-modal', '--z-sorak', '--z-dialog', '--z-toast']) expect(z('--z-retak')).toBeLessThan(z(atas));
    const aturan = css('meja.css').match(/#retak \{[^}]*\}/)?.[0] ?? '';
    expect(aturan).toContain('z-index: var(--z-retak)');
    expect(aturan).toContain('pointer-events: none');
    expect(css('meja.css')).toMatch(/#retak \* \{\s*pointer-events: none;/);
  });

  it('gerak dikurangi (sistem maupun pilihan pemain) mematikan sentakan, retakan menjalar, dan serpih di CSS juga', () => {
    const gerak = css('gerak.css');
    for (const blok of [/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/, /html\[data-gerak='kurang'\] body\.goyang #game,[\s\S]*?\}/]) {
      const isi = gerak.match(blok)?.[0] ?? '';
      for (const sel of ['body.jotos #game', '.serpih', '.retak-kanvas']) expect(isi, sel).toContain(sel);
    }
  });
});

describe('titik hantam dan kotak', () => {
  it('titikHantam: di dalam kotak tangan; null kalau kotaknya tidak diketahui', () => {
    for (const benih of [1, 7, 41, 1000]) {
      const t = titikHantam(KOTAK_TANGAN, benih)!;
      expect(t.x).toBeGreaterThan(KOTAK_TANGAN.x);
      expect(t.x).toBeLessThan(KOTAK_TANGAN.x + KOTAK_TANGAN.w);
      expect(t.y).toBeCloseTo(KOTAK_TANGAN.y + 0.3 * KOTAK_TANGAN.h);
    }
    expect(titikHantam(null, 3)).toBeNull();
  });

  it('kotakSah: hanya kotak berangka dan berukuran', () => {
    expect(kotakSah({ x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    for (const salah of [null, undefined, Promise.resolve(), { x: 1, y: 2, w: 0, h: 4 }, { x: NaN, y: 0, w: 1, h: 1 }, { x: '1', y: 0, w: 1, h: 1 }]) {
      expect(kotakSah(salah)).toBeNull();
    }
  });
});

describe('pola retakan (murni)', () => {
  const opsi = { x: 500, y: 900, jari: 1200, benih: 41, sinar: 12, cincin: 3, tebal: 5 };

  it('deterministik per benih, berbeda untuk benih lain', () => {
    expect(polaRetak(opsi)).toEqual(polaRetak(opsi));
    expect(polaRetak({ ...opsi, benih: 42 })).not.toEqual(polaRetak(opsi));
  });

  it('sinar utama menjalar keluar dari titik hantam; semua titik berupa angka', () => {
    for (const benih of [1, 2, 3, 41, 999]) {
      const pola = polaRetak({ ...opsi, benih });
      const sinar = pola.garis.filter((g) => g.tebal === opsi.tebal);
      expect(sinar).toHaveLength(opsi.sinar);
      for (const g of sinar) {
        const [x0, y0] = g.titik[0];
        const [x1, y1] = g.titik.at(-1)!;
        expect(Math.hypot(x0 - opsi.x, y0 - opsi.y)).toBeLessThan(opsi.jari * 0.03);
        expect(Math.hypot(x1 - opsi.x, y1 - opsi.y)).toBeGreaterThan(opsi.jari * 0.3);
      }
      for (const g of pola.garis) for (const [x, y] of g.titik) expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      // Cabang dan cincin lebih tipis dari sinar utama.
      expect(pola.garis.filter((g) => g.tebal < opsi.tebal).length).toBeGreaterThan(0);
      for (const s of pola.serpih) expect(s[0]).toEqual([opsi.x, opsi.y]);
    }
  });

  it('gambarRetak: rincian kaca (serpih berkilau, garis kilau) hanya kalau rinci; save/restore seimbang', () => {
    const pola = polaRetak(opsi);
    const hitung = (rinci: boolean) => {
      const panggil: string[] = [];
      const ctx = new Proxy({} as Record<string, unknown>, {
        get: (t, nama: string) =>
          nama in t
            ? t[nama]
            : (..._: unknown[]) => {
                panggil.push(nama);
                return nama === 'createRadialGradient' ? { addColorStop: () => {} } : undefined;
              },
        set: (t, nama: string, nilai) => ((t[nama] = nilai), true),
      }) as unknown as CanvasRenderingContext2D;
      gambarRetak(ctx, pola, { skala: 2, rinci });
      return panggil;
    };
    const biasa = hitung(false);
    const rinci = hitung(true);
    expect(biasa.filter((n) => n === 'fill')).toHaveLength(1);
    expect(rinci.filter((n) => n === 'fill')).toHaveLength(pola.serpih.length + 1);
    expect(rinci.filter((n) => n === 'stroke').length).toBeGreaterThan(biasa.filter((n) => n === 'stroke').length);
    for (const p of [biasa, rinci]) expect(p.filter((n) => n === 'save').length).toBe(p.filter((n) => n === 'restore').length);
  });
});

describe("bunyi 'jotos' dan 'jotosLain' (resep asli, AudioContext palsu)", () => {
  /** Kesalahan penjadwalan yang di browser sungguhan melempar galat atau menghasilkan klik. */
  let salah: string[] = [];
  let sumber = 0;
  let akhir = 0;

  /** AudioParam palsu yang memeriksa nilai dan waktu. */
  const param = (nama: string) => {
    const cek = (metode: string, nilai: number, waktu: number) => {
      if (!Number.isFinite(nilai) || !Number.isFinite(waktu) || waktu < 0) salah.push(`${nama}.${metode}(${nilai}, ${waktu})`);
      if (metode === 'exponentialRampToValueAtTime' && !(nilai > 0)) salah.push(`${nama}.${metode} ke ${nilai}`);
    };
    return {
      value: 1,
      setValueAtTime: (v: number, t: number) => cek('setValueAtTime', v, t),
      linearRampToValueAtTime: (v: number, t: number) => cek('linearRampToValueAtTime', v, t),
      exponentialRampToValueAtTime: (v: number, t: number) => cek('exponentialRampToValueAtTime', v, t),
      setTargetAtTime: (v: number, t: number) => cek('setTargetAtTime', v, t),
      cancelScheduledValues: () => {},
    };
  };
  const PARAM = ['gain', 'frequency', 'Q', 'detune', 'delayTime', 'pan', 'threshold', 'knee', 'ratio', 'attack', 'release'];
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = Object.fromEntries(PARAM.map((p) => [p, param(p)]));
    Object.assign(n, {
      connect: (tujuan: unknown) => tujuan,
      disconnect: () => {},
      start: (t = 0) => {
        if (!Number.isFinite(t)) salah.push(`start(${t})`);
        sumber++;
      },
      stop: (t = 0) => {
        if (!Number.isFinite(t)) salah.push(`stop(${t})`);
        akhir = Math.max(akhir, t);
      },
    });
    return n;
  };
  class AudioPalsu {
    currentTime = 0;
    sampleRate: number;
    destination = node();
    constructor(_kanal: number, _panjang: number, laju: number) {
      this.sampleRate = laju;
    }
    createBuffer(_k: number, panjang: number, laju: number) {
      const data = new Float32Array(panjang);
      return { duration: panjang / laju, getChannelData: () => data };
    }
    createGain = node;
    createOscillator = node;
    createBiquadFilter = node;
    createBufferSource = node;
    createDelay = node;
    createStereoPanner = node;
    createDynamicsCompressor = node;
    startRendering() {
      return Promise.resolve({});
    }
  }
  let rekamBunyi: typeof import('../src/efek/suara').rekamBunyi;
  let POLA_GETAR: typeof import('../src/efek/suara').POLA_GETAR;

  beforeAll(async () => {
    vi.stubGlobal('OfflineAudioContext', AudioPalsu);
    ({ rekamBunyi, POLA_GETAR } = await vi.importActual<typeof import('../src/efek/suara')>('../src/efek/suara'));
  });
  afterEach(() => {
    salah = [];
    sumber = 0;
    akhir = 0;
  });

  it.each([
    ['jotos', 2.6, 60],
    ['jotosLain', 1.0, 20],
  ] as const)("'%s': tanpa nilai yang ditolak Web Audio, selesai < %s dtk, sumber ≤ %s", async (jenis, maksDetik, maksSumber) => {
    // Rantai dasar (pembatas, gema) ikut dibuat; hitung hanya yang dijadwalkan resepnya.
    await rekamBunyi([]);
    const dasar = sumber;
    sumber = 0;
    akhir = 0;
    await rekamBunyi(jenis);
    expect(salah).toEqual([]);
    expect(sumber - dasar).toBeGreaterThan(0);
    expect(sumber - dasar).toBeLessThanOrEqual(maksSumber);
    expect(akhir).toBeLessThan(maksDetik);
  });

  it('getar kepentung lebih kuat: hentakan pertama paling panjang dan total getar melebihi pentung joker', () => {
    const total = (p: number | readonly number[]) => (typeof p === 'number' ? p : p.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0));
    expect(POLA_GETAR.kepentung[0]).toBeGreaterThanOrEqual(250);
    expect(total(POLA_GETAR.kepentung)).toBeGreaterThan(total(POLA_GETAR.mentungJoker));
    for (const [nama, pola] of Object.entries(POLA_GETAR)) if (nama !== 'kepentung') expect(total(POLA_GETAR.kepentung), nama).toBeGreaterThanOrEqual(total(pola));
  });
});
