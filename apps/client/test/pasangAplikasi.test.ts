// Tawaran pasang aplikasi (keputusan #46): deteksi cara pasang dari user agent asli dan keadaan
// tombol melayang (tunda "Nanti saja" 3 hari, "Sudah kupasang", prompt). Murni, jalan di Node.

import { describe, expect, it } from 'vitest';
import {
  caraPasang,
  dalamAplikasi,
  keadaanPasang,
  lupakanSudahPasang,
  nilaiTerpasang,
  perangkatApel,
  sesudahPrompt,
  tandaiSudahPasang,
  TUNDA_PASANG_MS,
  tundaPasang,
  type LingkunganPasang,
} from '../src/pasangAplikasi';

/** User agent asli (disalin dari perangkat/browser sungguhan, versi bisa lebih lama). */
const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ mengaku Safari Mac; bedanya hanya layar sentuh.
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 335.0.3.21.86 (iPhone15,3; iOS 17_5; id_ID; id; scale=3.00; 1290x2796; 615289207)',
  threadsIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 335.0.0.40.92 (iPhone15,3; iOS 17_5; id_ID; id; scale=3.00; 1290x2796; 615290012)',
  facebookIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.108;FBBV/617061484;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/id_ID;FBOP/5;FBRV/619326017]',
  webviewIosPolos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 335.0.0.39.93 Android (34/14; 450dpi; 1080x2125; samsung; SM-A546E; a54x; s5e8835; in_ID; 615201445)',
  threadsAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240605.024; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Barcelona 335.0.0.37.109 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 8; shiba; shiba; in_ID; 615190100)',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.82;]',
  whatsappAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 WhatsApp/2.24.13.78',
  webviewAndroidPolos:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240605.024; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
};

const ling = (ua: string, lain: Partial<LingkunganPasang> = {}): LingkunganPasang => ({
  ua,
  maxTouchPoints: /iPhone|Android/.test(ua) ? 5 : 0,
  aman: true,
  terpasang: false,
  adaPrompt: false,
  ...lain,
});

describe('perangkatApel', () => {
  it('iPhone/iPad/iPod; iPadOS yang mengaku Mac hanya kalau layarnya sentuh', () => {
    expect(perangkatApel(UA.iphoneSafari, 5)).toBe(true);
    expect(perangkatApel(UA.ipadDesktop, 5)).toBe(true);
    expect(perangkatApel(UA.ipadDesktop, 0)).toBe(false);
    expect(perangkatApel(UA.ipadDesktop, 1)).toBe(false);
    expect(perangkatApel(UA.chromeAndroid, 5)).toBe(false);
    expect(perangkatApel(UA.chromeWindows, 10)).toBe(false);
  });
});

describe('caraPasang', () => {
  it('iPhone Safari, iPadOS (sentuh 5), dan Chrome iOS (CriOS memuat Safari/) → ios', () => {
    expect(caraPasang(ling(UA.iphoneSafari))).toBe('ios');
    expect(caraPasang(ling(UA.ipadDesktop, { maxTouchPoints: 5 }))).toBe('ios');
    expect(caraPasang(ling(UA.chromeIos))).toBe('ios');
  });

  it('Safari Mac sungguhan (sentuh 0) tanpa prompt → tidak ditawarkan', () => {
    expect(caraPasang(ling(UA.ipadDesktop, { maxTouchPoints: 0 }))).toBeNull();
  });

  it('Instagram, Threads, Facebook (iOS dan Android), WhatsApp, dan WebView polos → inapp', () => {
    for (const ua of [
      UA.instagramIos,
      UA.threadsIos,
      UA.facebookIos,
      UA.webviewIosPolos,
      UA.instagramAndroid,
      UA.threadsAndroid,
      UA.facebookAndroid,
      UA.whatsappAndroid,
      UA.webviewAndroidPolos,
    ]) {
      expect(caraPasang(ling(ua)), ua).toBe('inapp');
      expect(dalamAplikasi(ua, 5), ua).toBe(true);
    }
  });

  it('Chrome, Samsung Internet, dan Firefox Android tanpa prompt → android; dengan prompt → prompt', () => {
    for (const ua of [UA.chromeAndroid, UA.samsungAndroid, UA.firefoxAndroid]) {
      expect(caraPasang(ling(ua)), ua).toBe('android');
      expect(caraPasang(ling(ua, { adaPrompt: true })), ua).toBe('prompt');
      expect(dalamAplikasi(ua, 5), ua).toBe(false);
    }
  });

  it('desktop: tanpa prompt tidak ditawarkan, dengan prompt → prompt', () => {
    expect(caraPasang(ling(UA.chromeWindows))).toBeNull();
    expect(caraPasang(ling(UA.firefoxLinux))).toBeNull();
    expect(caraPasang(ling(UA.chromeWindows, { adaPrompt: true }))).toBe('prompt');
  });

  it('sudah terpasang atau bukan HTTPS → tidak ditawarkan, walau ada prompt', () => {
    for (const ua of [UA.iphoneSafari, UA.chromeAndroid, UA.instagramIos, UA.chromeWindows]) {
      expect(caraPasang(ling(ua, { terpasang: true, adaPrompt: true })), ua).toBeNull();
      expect(caraPasang(ling(ua, { aman: false, adaPrompt: true })), ua).toBeNull();
    }
  });
});

describe('keadaanPasang', () => {
  const T0 = Date.UTC(2026, 9, 16, 5, 0, 0);

  it('tanpa cara → null; tanpa simpanan → ubin + tombol melayang', () => {
    expect(keadaanPasang(null, {}, T0)).toBeNull();
    expect(keadaanPasang('ios', {}, T0)).toEqual({ cara: 'ios', melayang: true });
  });

  it('"Nanti saja" menyembunyikan tombol tepat 3 hari (batas ±1 ms); ubin tetap ada', () => {
    const s = tundaPasang({}, T0);
    expect(s.tundaSampai).toBe(T0 + TUNDA_PASANG_MS);
    expect(TUNDA_PASANG_MS).toBe(3 * 24 * 60 * 60 * 1000);
    expect(keadaanPasang('android', s, T0)).toEqual({ cara: 'android', melayang: false });
    expect(keadaanPasang('android', s, T0 + TUNDA_PASANG_MS - 1)).toEqual({ cara: 'android', melayang: false });
    expect(keadaanPasang('android', s, T0 + TUNDA_PASANG_MS)).toEqual({ cara: 'android', melayang: true });
    expect(keadaanPasang('android', s, T0 + TUNDA_PASANG_MS + 1)).toEqual({ cara: 'android', melayang: true });
  });

  it('jam HP dimundurkan (tunda lebih dari 3 hari ke depan) → tunda dianggap lewat', () => {
    const s = { tundaSampai: T0 + TUNDA_PASANG_MS };
    expect(keadaanPasang('ios', s, T0 - 1)!.melayang).toBe(true);
    expect(keadaanPasang('ios', s, T0)!.melayang).toBe(false);
    expect(keadaanPasang('ios', { tundaSampai: T0 + 30 * TUNDA_PASANG_MS }, T0)!.melayang).toBe(true);
  });

  it('"Sudah kupasang" menutup tawaran, kecuali browser menawarkan prompt lagi', () => {
    const s = tandaiSudahPasang({}, T0);
    for (const cara of ['ios', 'android', 'inapp'] as const) expect(keadaanPasang(cara, s, T0 + 1)).toBeNull();
    expect(keadaanPasang('prompt', s, T0 + 1)).toEqual({ cara: 'prompt', melayang: true });
    // Ditolak lewat prompt sesudahnya: tetap ditunda.
    expect(keadaanPasang('prompt', tundaPasang(s, T0), T0 + 1)).toEqual({ cara: 'prompt', melayang: false });
  });

  it('lupakanSudahPasang membuang tanda sudah, tunda tetap; transisi tidak mengubah input', () => {
    const awal = { tundaSampai: 5, sudahPasang: 7 };
    expect(lupakanSudahPasang(awal)).toEqual({ tundaSampai: 5 });
    expect(lupakanSudahPasang({ sudahPasang: 7 })).toEqual({});
    tundaPasang(awal, T0);
    tandaiSudahPasang(awal, T0);
    expect(awal).toEqual({ tundaSampai: 5, sudahPasang: 7 });
  });
});

describe('nilaiTerpasang: dibuka sebagai aplikasi terpasang?', () => {
  const tampilan = (lain: Partial<{ mandiri: boolean; layarPenuhMode: boolean; layarPenuhApi: boolean; standaloneIos: boolean }> = {}) => ({
    mandiri: false,
    layarPenuhMode: false,
    layarPenuhApi: false,
    standaloneIos: false,
    ...lain,
  });

  it('standalone/minimal-ui dan navigator.standalone iOS selalu terpasang', () => {
    for (const sebelumnya of [null, false, true]) {
      expect(nilaiTerpasang(tampilan({ mandiri: true }), sebelumnya)).toBe(true);
      expect(nilaiTerpasang(tampilan({ standaloneIos: true, layarPenuhApi: true }), sebelumnya)).toBe(true);
    }
    expect(nilaiTerpasang(tampilan(), null)).toBe(false);
  });

  it('manifest display fullscreen: display-mode fullscreen tanpa layar penuh API = terpasang', () => {
    expect(nilaiTerpasang(tampilan({ layarPenuhMode: true }), null)).toBe(true);
  });

  it('layar penuh dari menu meja: pakai nilai sebelum layar penuh, jangan langsung "belum terpasang"', () => {
    const lp = tampilan({ layarPenuhMode: true, layarPenuhApi: true });
    // Aplikasi terpasang → ☰ Layar penuh → kembali ke beranda: tetap terpasang (tombol pasang tidak muncul).
    expect(nilaiTerpasang(lp, true)).toBe(true);
    // Tab browser biasa → Layar penuh: tetap belum terpasang (tawaran tetap ada).
    expect(nilaiTerpasang(lp, false)).toBe(false);
    expect(nilaiTerpasang(lp, null)).toBe(false);
  });

  it('browser masih menawarkan prompt (mis. F11 di desktop) = belum terpasang walau display-mode fullscreen', () => {
    expect(nilaiTerpasang(tampilan({ layarPenuhMode: true }), null, true)).toBe(false);
    expect(nilaiTerpasang(tampilan({ layarPenuhMode: true, layarPenuhApi: true }), true, true)).toBe(false);
    // standalone tetap terpasang (prompt tidak muncul di jendela aplikasi terpasang).
    expect(nilaiTerpasang(tampilan({ mandiri: true }), null, true)).toBe(true);
  });
});

describe('sesudahPrompt: hasil userChoice prompt pasang browser', () => {
  const T0 = Date.UTC(2026, 9, 16, 5, 0, 0);

  it('diterima = sudah pasang, ditolak = tunda 3 hari, gagal = simpanan tetap', () => {
    expect(sesudahPrompt({}, 'accepted', T0)).toEqual({ sudahPasang: T0 });
    expect(sesudahPrompt({}, 'dismissed', T0)).toEqual({ tundaSampai: T0 + TUNDA_PASANG_MS });
    const awal = { tundaSampai: 5 };
    expect(sesudahPrompt(awal, null, T0)).toBe(awal);
    expect(sesudahPrompt(awal, 'accepted', T0)).toEqual({ tundaSampai: 5, sudahPasang: T0 });
    expect(awal).toEqual({ tundaSampai: 5 });
    // Ditolak: tombol melayang hilang, ubin tetap. Diterima: tawaran tutup kecuali prompt datang lagi.
    expect(keadaanPasang('android', sesudahPrompt({}, 'dismissed', T0), T0 + 1)).toEqual({ cara: 'android', melayang: false });
    expect(keadaanPasang('android', sesudahPrompt({}, 'accepted', T0), T0 + 1)).toBeNull();
  });
});
