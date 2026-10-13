// @vitest-environment happy-dom
// Logo Kedai Madya (path vektor hasil trace): SVG valid, aksesibel, varian benar, dan semua salinan
// path (splash index.html, favicon.svg hasil buat-ikon.mjs) sama dengan sumbernya.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { pathLogo, svgLogo, type VarianLogo } from '../src/aset/logoMadya';
import indexHtml from '../index.html?raw';
import favicon from '../public/favicon.svg?raw';
import sumberLogo from '../src/aset/logoMadya.ts?raw';
import skripIkon from '../scripts/buat-ikon.mjs?raw';
import skripSplash from '../public/splash.js?raw';

// CSS dibaca langsung dari disk (impor ?raw untuk .css dikosongkan Vitest). Path berupa string, bukan
// new URL(): di lingkungan happy-dom, URL global bukan milik Node sehingga ditolak readFileSync.
const gayaDasar = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/gaya/dasar.css'), 'utf8');

const VARIAN: VarianLogo[] = ['lengkap', 'maskot', 'siluet'];

const parse = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.querySelector('svg')!;
};

describe('pathLogo', () => {
  it('tiap varian punya viewBox 4 angka positif dan path yang tidak kosong', () => {
    for (const v of VARIAN) {
      const p = pathLogo(v);
      const angka = p.viewBox.split(' ').map(Number);
      expect(angka).toHaveLength(4);
      expect(angka.every(Number.isFinite)).toBe(true);
      expect(angka[2]).toBeGreaterThan(0);
      expect(angka[3]).toBeGreaterThan(0);
      expect(p.isi.length).toBeGreaterThan(0);
      for (const d of p.isi) {
        expect(d.startsWith('M')).toBe(true);
        // Hanya perintah dasar (dirasterisasi sendiri oleh buat-ikon.mjs), presisi maksimal 1 desimal.
        expect(d).toMatch(/^[MLHVCZmlhvcz0-9.\s-]+$/);
        expect(d).not.toMatch(/\.\d{2}/);
        // Sub-path tertutup (fill evenodd membentuk lubang mata/mulut/tetesan).
        expect(d.endsWith('z')).toBe(true);
      }
    }
  });

  it('lengkap = maskot + tulisan; maskot & siluet lebih sempit dari lengkap', () => {
    const lengkap = pathLogo('lengkap');
    const maskot = pathLogo('maskot');
    const siluet = pathLogo('siluet');
    expect(lengkap.isi).toHaveLength(2);
    expect(lengkap.isi[0]).toBe(maskot.isi[0]);
    expect(siluet.isi[0]).not.toBe(maskot.isi[0]);
    const lebar = (vb: string) => Number(vb.split(' ')[2]);
    expect(lebar(maskot.viewBox)).toBeLessThan(lebar(lengkap.viewBox));
    expect(lebar(siluet.viewBox)).toBeLessThan(lebar(maskot.viewBox));
    // Maskot punya banyak lubang (mata, mulut, tetesan, bibir, gagang); siluet hanya bibir & gagang.
    const subPath = (d: string) => d.split('M').length - 1;
    expect(subPath(maskot.isi[0])).toBeGreaterThan(8);
    expect(subPath(siluet.isi[0])).toBe(3);
  });

  it('ukuran path wajar (< 25 KB total) dan salinan baru tiap panggilan', () => {
    const total = new Set(VARIAN.flatMap((v) => pathLogo(v).isi)).size;
    const byte = [...new Set(VARIAN.flatMap((v) => pathLogo(v).isi))].join('').length;
    expect(total).toBe(3);
    expect(byte).toBeLessThan(25_000);
    const a = pathLogo('maskot');
    a.isi.push('M0 0z');
    expect(pathLogo('maskot').isi).toHaveLength(1);
  });
});

describe('svgLogo', () => {
  it('SVG valid: currentColor, evenodd, viewBox, path sesuai varian', () => {
    for (const v of VARIAN) {
      const svg = parse(svgLogo(v));
      expect(svg.getAttribute('viewBox')).toBe(pathLogo(v).viewBox);
      expect(svg.getAttribute('fill')).toBe('currentColor');
      expect(svg.getAttribute('fill-rule')).toBe('evenodd');
      expect(svg.classList.contains('logo-madya')).toBe(true);
      expect(svg.classList.contains(`logo-${v}`)).toBe(true);
      expect([...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'))).toEqual(pathLogo(v).isi);
    }
  });

  it('tanpa label = dekoratif (aria-hidden), dengan label = role img + aria-label', () => {
    const hias = parse(svgLogo('maskot'));
    expect(hias.getAttribute('aria-hidden')).toBe('true');
    expect(hias.hasAttribute('role')).toBe(false);
    const berlabel = parse(svgLogo('lengkap', { label: 'Kedai Madya', kelas: 'hero-logo' }));
    expect(berlabel.getAttribute('role')).toBe('img');
    expect(berlabel.getAttribute('aria-label')).toBe('Kedai Madya');
    expect(berlabel.hasAttribute('aria-hidden')).toBe(false);
    expect(berlabel.classList.contains('hero-logo')).toBe(true);
  });

  it('label & kelas di-escape (tidak bisa menyuntik atribut/elemen)', () => {
    const html = svgLogo('siluet', { label: 'Kedai "Madya" <b>&</b>', kelas: 'a" onload="x' });
    const svg = parse(html);
    expect(svg.getAttribute('aria-label')).toBe('Kedai "Madya" <b>&</b>');
    expect(svg.hasAttribute('onload')).toBe(false);
    expect(svg.querySelector('b')).toBeNull();
  });
});

describe('salinan path tetap sinkron', () => {
  it('splash index.html memakai path maskot yang sama', () => {
    const m = indexHtml.match(/<div id="splash"[\s\S]*?<svg[^>]*viewBox="([^"]+)"[\s\S]*?<path d="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(pathLogo('maskot').viewBox);
    expect(m![2]).toBe(pathLogo('maskot').isi[0]);
    // Splash dekoratif & tidak menangkap sentuhan.
    expect(indexHtml).toMatch(/<div id="splash" aria-hidden="true">/);
    expect(indexHtml).toMatch(/#splash \{[^}]*pointer-events: none/);
  });

  it('favicon.svg (hasil buat-ikon.mjs) = siluet cangkir di bidang kuning MADYA', () => {
    expect(favicon).toContain(`d="${pathLogo('siluet').isi[0]}"`);
    expect(favicon).toContain('fill="#f1a615"');
    expect(favicon).toContain('fill-rule="evenodd"');
  });

  it('pola baca buat-ikon.mjs masih cocok dengan sumber logoMadya.ts', () => {
    // buat-ikon.mjs membaca konstanta & viewBox lewat regex (tanpa menjalankan TypeScript).
    expect(skripIkon).toContain("konstanta('MASKOT')");
    expect(skripIkon).toContain("konstanta('SILUET')");
    for (const nama of ['MASKOT', 'SILUET']) {
      const m = sumberLogo.match(new RegExp(`const ${nama} =\\s*'([^']+)'`));
      expect(m?.[1]).toBeTruthy();
    }
    expect(sumberLogo.match(/const MASKOT =\s*'([^']+)'/)![1]).toBe(pathLogo('maskot').isi[0]);
    expect(sumberLogo.match(/const SILUET =\s*'([^']+)'/)![1]).toBe(pathLogo('siluet').isi[0]);
    for (const v of ['maskot', 'siluet'] as const) {
      expect(sumberLogo.match(new RegExp(`${v}: \\{ viewBox: '([^']+)'`))![1]).toBe(pathLogo(v).viewBox);
    }
  });
});

describe('splash & Content-Security-Policy', () => {
  it("index.html tanpa skrip inline (CSP script-src 'self'); skrip splash dari /splash.js, sinkron", () => {
    const skrip = [...indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(skrip.length).toBeGreaterThan(0);
    for (const [, atribut, isi] of skrip) {
      expect(atribut).toMatch(/\bsrc="/);
      expect(isi.trim()).toBe('');
    }
    // Penangan event inline (onload=, onclick=, ...) juga diblokir CSP.
    expect(indexHtml).not.toMatch(/<[^>]+\son[a-z]+\s*=/i);
    const splash = skrip.find(([, a]) => a.includes('src="/splash.js"'));
    expect(splash).toBeTruthy();
    // Tanpa defer/async/module: harus jalan sebelum app, tepat setelah #splash.
    expect(splash![1]).not.toMatch(/defer|async|module/);
    expect(indexHtml.indexOf('src="/splash.js"')).toBeGreaterThan(indexHtml.indexOf('<div id="splash"'));
    expect(indexHtml.indexOf('src="/splash.js"')).toBeLessThan(indexHtml.indexOf('src="/src/main.ts"'));
  });

  it('splash.js menunggu #ui terisi lalu membuang #splash', async () => {
    document.body.innerHTML = '<div id="ui"></div><div id="splash"></div>';
    new Function(skripSplash)();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('splash')).not.toBeNull();
    document.getElementById('ui')!.appendChild(document.createElement('main'));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('splash')!.classList.contains('selesai')).toBe(true);
    await new Promise((r) => setTimeout(r, 450));
    expect(document.getElementById('splash')).toBeNull();
    document.body.innerHTML = '';
  });

  it('@font-face Baloo 2 di splash sama dengan gaya/dasar.css, dan preload menunjuk berkas yang sama', () => {
    const blok = (css: string) => {
      const m = css.match(/@font-face\s*\{([^}]*)\}/);
      expect(m).not.toBeNull();
      return m![1].replace(/\s+/g, ' ').trim();
    };
    expect(blok(indexHtml)).toBe(blok(gayaDasar));
    const src = /url\('([^']+)'\)/.exec(blok(gayaDasar))![1];
    expect(indexHtml).toContain(`<link rel="preload" href="${src}" as="font" type="font/woff2" crossorigin />`);
  });
});
