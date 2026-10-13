// Token warna (gaya/token.css): kontras pasangan teks utama ≥ AA 4.5:1, dan padanan kanvas
// (warnaMeja.ts CADANGAN, kartuGrafisGambar.ts) sama dengan token-nya.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import gambarSrc from '../src/game/kartuGrafisGambar.ts?raw';
import { bacaPalet } from '../src/game/warnaMeja';

// CSS `?raw` dikosongkan Vitest (pemrosesan CSS mati), jadi dibaca langsung dari disk.
const tokenCss = readFileSync(new URL('../src/gaya/token.css', import.meta.url), 'utf8');

/** Nilai custom property di :root token.css (hanya yang hex). */
const TOKEN: Record<string, string> = Object.fromEntries(
  [...tokenCss.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2].toLowerCase()]),
);
const tok = (n: string) => {
  const v = TOKEN[n];
  if (!v) throw new Error(`token ${n} tidak ada/bukan hex`);
  return v;
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const kontras = (a: string, b: string) => {
  const [t, g] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (t + 0.05) / (g + 0.05);
};
/** Warna rgba di atas latar hex → hex (untuk --panel yang tembus). */
const campur = (r: number, g: number, b: number, a: number, latar: string) =>
  '#' +
  [r, g, b]
    .map((c, i) => Math.round(c * a + rgb(latar)[i] * (1 - a)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('');

describe('token.css: palet Kedai Madya', () => {
  it('kuning MADYA & token identitas baru ada', () => {
    expect(tok('--emas')).toBe('#f1a615');
    expect(tok('--madya-kuning')).toBe('#f1a615');
    expect(tok('--madya-tinta')).toBe('#111111');
    expect(tok('--madya-kertas')).toBe('#fbfbfb');
    expect(tok('--madya-toska')).toBe('#1f8a9e');
    expect(tok('--madya-zaitun')).toBe('#6b865e');
    expect(tokenCss).toMatch(/--emas-rgb:\s*241, 166, 21;/);
  });

  it('tidak ada lagi literal emas lama (rgba 242,193,78 / #f2c14e)', () => {
    const tanpaKomentar = tokenCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(tanpaKomentar).not.toMatch(/242,\s*193,\s*78/);
    expect(tanpaKomentar.toLowerCase()).not.toContain('#f2c14e');
    expect(gambarSrc.toLowerCase()).not.toContain('#f2c14e');
  });

  it('kontras pasangan teks utama ≥ 4.5:1', () => {
    const panel = campur(9, 27, 17, 0.92, tok('--laken'));
    const pasangan: [string, string, string, string][] = [
      ['--teks', tok('--teks'), '--panel', panel],
      ['--teks-redup', tok('--teks-redup'), '--panel', panel],
      ['--teks-redup', tok('--teks-redup'), '--laken', tok('--laken')],
      ['--teks-di-emas', tok('--teks-di-emas'), '--emas', tok('--emas')],
      ['--teks-di-emas', tok('--teks-di-emas'), '--emas-tua', tok('--emas-tua')],
      ['--teks-di-emas', tok('--teks-di-emas'), '--emas-muda', tok('--emas-muda')],
      ['--emas', tok('--emas'), '--panel', panel],
      ['--emas', tok('--emas'), '--laken-gelap', tok('--laken-gelap')],
      ['--emas', tok('--emas'), '--dialog', tok('--dialog')],
      ['--teks-emas', tok('--teks-emas'), '--laken', tok('--laken')],
      ['--fokus/--emas-muda', tok('--emas-muda'), '--laken', tok('--laken')],
      ['--tinta', tok('--tinta'), '--krem', tok('--krem')],
      ['--emas-pekat', tok('--emas-pekat'), '--krem', tok('--krem')],
      ['--madya-tinta', tok('--madya-tinta'), '--madya-kuning', tok('--madya-kuning')],
      ['--madya-tinta', tok('--madya-tinta'), '--madya-kertas', tok('--madya-kertas')],
      ['--madya-tinta', tok('--madya-tinta'), '--madya-toska', tok('--madya-toska')],
      ['--madya-tinta', tok('--madya-tinta'), '--madya-zaitun', tok('--madya-zaitun')],
      ['--positif', tok('--positif'), '--panel', panel],
      ['--negatif', tok('--negatif'), '--panel', panel],
      ['--teks-di-bahaya', tok('--teks-di-bahaya'), '--bahaya-latar', tok('--bahaya-latar')],
      ['--tinta-merah', tok('--tinta-merah'), '--krem', tok('--krem')],
      ['--tinta-biru', tok('--tinta-biru'), '--krem', tok('--krem')],
      ['--tinta-hijau', tok('--tinta-hijau'), '--krem', tok('--krem')],
    ];
    const gagal = pasangan
      .map(([a, ha, b, hb]) => ({ pasangan: `${a} di ${b}`, rasio: Math.round(kontras(ha, hb) * 100) / 100 }))
      .filter((p) => p.rasio < 4.5);
    expect(gagal).toEqual([]);
  });

  it('--emas langsung di --laken memang di bawah AA (alasan --teks-emas ada)', () => {
    expect(kontras(tok('--emas'), tok('--laken'))).toBeLessThan(4.5);
    expect(kontras(tok('--teks-emas'), tok('--laken'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('padanan kanvas', () => {
  it('bacaPalet() tanpa CSS (cadangan) = nilai token.css', () => {
    const p = bacaPalet();
    expect(p.emasCss).toBe(tok('--emas'));
    expect(p.emas).toBe(parseInt(tok('--emas').slice(1), 16));
    expect(p.emasMuda).toBe(parseInt(tok('--emas-muda').slice(1), 16));
    expect(p.teks.emas).toBe(tok('--teks-emas'));
    expect(p.teks.teks).toBe(tok('--teks'));
    expect(p.teks.redup).toBe(tok('--teks-redup'));
    expect(p.teks.gelap).toBe(tok('--teks-di-emas'));
    expect(p.panel).toBe(parseInt(tok('--laken-pekat').slice(1), 16));
  });

  it('warna punggung kartu di kartuGrafisGambar.ts = token --madya-*', () => {
    const konst = (n: string) => gambarSrc.match(new RegExp(`const ${n} = '(#[0-9a-f]{6})'`, 'i'))?.[1].toLowerCase();
    expect(konst('KUNING')).toBe(tok('--madya-kuning'));
    expect(konst('ARANG')).toBe(tok('--madya-arang'));
    expect(konst('TINTA_LOGO')).toBe(tok('--madya-tinta'));
  });
});
