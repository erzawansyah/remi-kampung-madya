// @vitest-environment happy-dom
// sedangTerpasang() membaca browser sungguhan (matchMedia, document.fullscreenElement,
// navigator.standalone). Urutan yang dijaga: aplikasi terpasang (manifest display fullscreen) →
// ☰ Layar penuh di meja (requestFullscreen) → kembali ke beranda = tetap terpasang, jadi tombol
// "Pasang aplikasi" tidak muncul di dalam aplikasi yang sudah terpasang.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _setelUlangTerpasang, bacaLingkunganPasang, caraPasang, sedangTerpasang } from '../src/pasangAplikasi';

const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

let cocok = new Set<string>();
let elemenLayarPenuh: Element | null = null;

beforeEach(() => {
  _setelUlangTerpasang();
  cocok = new Set();
  elemenLayarPenuh = null;
  window.matchMedia = ((q: string) => ({ matches: cocok.has(q), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => elemenLayarPenuh });
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => CHROME_ANDROID });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { standalone?: boolean }).standalone;
});

describe('sedangTerpasang', () => {
  it('aplikasi terpasang (display fullscreen) → Layar penuh dari menu meja → beranda: tetap terpasang', () => {
    cocok.add('(display-mode: fullscreen)');
    expect(sedangTerpasang()).toBe(true); // dibaca saat aplikasi mulai (main.ts)
    elemenLayarPenuh = document.documentElement; // requestFullscreen dari menu ☰ meja
    expect(sedangTerpasang()).toBe(true);
    expect(caraPasang(bacaLingkunganPasang(false))).toBeNull();
    elemenLayarPenuh = null;
    expect(sedangTerpasang()).toBe(true);
  });

  it('tab Chrome biasa → Layar penuh dari menu meja: tetap belum terpasang, tawaran Android tetap ada', () => {
    expect(sedangTerpasang()).toBe(false);
    elemenLayarPenuh = document.documentElement;
    cocok.add('(display-mode: fullscreen)'); // Chrome ikut mencocokkan display-mode saat layar penuh API
    expect(sedangTerpasang()).toBe(false);
    expect(caraPasang(bacaLingkunganPasang(false))).toBe('android');
  });

  it('belum pernah dibaca sebelum layar penuh API: dianggap belum terpasang', () => {
    cocok.add('(display-mode: fullscreen)');
    elemenLayarPenuh = document.documentElement;
    expect(sedangTerpasang()).toBe(false);
  });

  it('display-mode fullscreen tapi browser masih menawarkan prompt (F11 di desktop): tawaran prompt tetap ada', () => {
    cocok.add('(display-mode: fullscreen)');
    expect(sedangTerpasang(true)).toBe(false);
    expect(caraPasang(bacaLingkunganPasang(true))).toBe('prompt');
  });

  it('standalone, minimal-ui, dan navigator.standalone iOS = terpasang', () => {
    cocok.add('(display-mode: standalone)');
    expect(sedangTerpasang()).toBe(true);
    cocok = new Set(['(display-mode: minimal-ui)']);
    expect(sedangTerpasang()).toBe(true);
    cocok = new Set();
    (navigator as { standalone?: boolean }).standalone = true;
    expect(sedangTerpasang()).toBe(true);
  });
});
