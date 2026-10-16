// Tawaran pasang aplikasi (PWA) di beranda, keputusan pemilik #46.
//
// Bagian murni (bisa dites di Node, tanpa DOM): mengenali cara pasang dari user agent dan keadaan
// browser (`caraPasang`), lalu memutuskan apakah tombol melayang tampil atau cukup ubin menu
// (`keadaanPasang`) dari simpanan "Nanti saja" / "Sudah kupasang". Hanya `bacaLingkunganPasang()`
// dan `sedangTerpasang()` yang membaca window/navigator, dan keduanya baru dipanggil dari main.ts.
//
// Tombol melayang hanya di beranda (lihat ui/beranda.ts). Lobi, meja, dan permainan tidak pernah
// memuatnya.

/**
 * Cara memasang di browser ini:
 * - `prompt`: browser sudah menawarkan pemasangan (event `beforeinstallprompt` tersimpan).
 * - `ios`: Safari (atau browser lain) di iPhone/iPad, lewat Bagikan → Tambah ke Layar Utama.
 * - `android`: browser Android yang belum menawarkan prompt, lewat menu browser.
 * - `inapp`: browser bawaan aplikasi (Instagram, Threads, WhatsApp, Facebook, …) yang tidak bisa memasang.
 */
export type CaraPasang = 'prompt' | 'ios' | 'android' | 'inapp';

export interface LingkunganPasang {
  ua: string;
  /** navigator.maxTouchPoints: membedakan iPadOS (mengaku Mac) dari Mac sungguhan. */
  maxTouchPoints: number;
  /** isSecureContext: pemasangan dan service worker hanya jalan di HTTPS (atau localhost). */
  aman: boolean;
  /** Sudah dibuka sebagai aplikasi terpasang (lihat sedangTerpasang). */
  terpasang: boolean;
  /** Ada event beforeinstallprompt yang belum dipakai. */
  adaPrompt: boolean;
}

/** Simpanan tawaran (`remi.tawaranPasang`, lihat penyimpanan.ts). Waktu dalam ms epoch. */
export interface TawaranPasang {
  /** "Nanti saja": tombol melayang disembunyikan sampai waktu ini. */
  tundaSampai?: number;
  /** "Sudah kupasang", prompt diterima, atau event appinstalled. */
  sudahPasang?: number;
}

/** Keadaan tawaran di beranda: ubin menu selalu ada, tombol melayang hanya kalau `melayang`. */
export interface KeadaanPasang {
  cara: CaraPasang;
  melayang: boolean;
}

/** Lama "Nanti saja" menyembunyikan tombol melayang (keputusan #46: 3 hari). */
export const TUNDA_PASANG_MS = 3 * 24 * 60 * 60 * 1000;

/** iPhone/iPad/iPod, juga iPadOS yang mengaku Mac (Macintosh + layar sentuh). */
export function perangkatApel(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Penanda browser bawaan aplikasi di user agent. */
const POLA_DALAM_APLIKASI: readonly RegExp[] = [
  /\bFB(?:AN|AV|_IAB|IOS|4A)\b/, // Facebook, Messenger
  /\bInstagram\b/,
  /\bBarcelona\b/, // Threads
  /\bWhatsApp\b/,
  /\bLine\//,
  /musical_ly|BytedanceWebview|\bTikTok\b/,
  /\bTwitter\b/,
  /\bSnapchat\b/,
  /\bPinterest\b/,
  /\bLinkedInApp\b/,
  /\bGSA\//, // aplikasi Google
];

/**
 * Browser bawaan aplikasi: penanda aplikasi di atas, WebView Android ("; wv)"), atau WebView
 * iPhone/iPad tanpa "Safari/" (Safari, Chrome iOS, Firefox iOS, dan Edge iOS selalu memuatnya).
 */
export function dalamAplikasi(ua: string, maxTouchPoints: number): boolean {
  if (POLA_DALAM_APLIKASI.some((p) => p.test(ua))) return true;
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return true;
  return perangkatApel(ua, maxTouchPoints) && !/Safari\//.test(ua);
}

/** Cara pasang di lingkungan ini, atau null kalau tidak ada yang bisa ditawarkan. */
export function caraPasang(l: LingkunganPasang): CaraPasang | null {
  if (!l.aman || l.terpasang) return null;
  if (l.adaPrompt) return 'prompt';
  if (dalamAplikasi(l.ua, l.maxTouchPoints)) return 'inapp';
  if (perangkatApel(l.ua, l.maxTouchPoints)) return 'ios';
  if (/Android/.test(l.ua)) return 'android';
  // Desktop tanpa prompt (Firefox, Safari Mac, atau sudah terpasang): tidak ditawarkan.
  return null;
}

/**
 * Keadaan tawaran dari cara pasang + simpanan. Null = tidak ada ubin maupun tombol.
 * - "Sudah kupasang" menutup tawaran, kecuali browser menawarkan prompt lagi (artinya belum
 *   terpasang di browser ini; main.ts juga menghapus tanda itu saat beforeinstallprompt datang).
 * - "Nanti saja" hanya menyembunyikan tombol melayang, ubin menu tetap ada. Tunda yang lebih jauh
 *   dari 3 hari ke depan berarti jam HP pernah dimundurkan: dianggap sudah lewat.
 */
export function keadaanPasang(cara: CaraPasang | null, simpanan: TawaranPasang, sekarang: number): KeadaanPasang | null {
  if (!cara) return null;
  if (simpanan.sudahPasang !== undefined && cara !== 'prompt') return null;
  const t = simpanan.tundaSampai;
  const ditunda = t !== undefined && sekarang < t && t - sekarang <= TUNDA_PASANG_MS;
  return { cara, melayang: !ditunda };
}

/** "Nanti saja" (atau prompt ditolak): sembunyikan tombol melayang 3 hari. */
export function tundaPasang(s: TawaranPasang, sekarang: number): TawaranPasang {
  return { ...s, tundaSampai: sekarang + TUNDA_PASANG_MS };
}

/** "Sudah kupasang", prompt diterima, atau appinstalled. */
export function tandaiSudahPasang(s: TawaranPasang, sekarang: number): TawaranPasang {
  return { ...s, sudahPasang: sekarang };
}

/** beforeinstallprompt datang lagi: browser ini belum memasangnya, tanda "sudah" dilupakan. */
export function lupakanSudahPasang(s: TawaranPasang): TawaranPasang {
  return s.tundaSampai !== undefined ? { tundaSampai: s.tundaSampai } : {};
}

// ---------------------------------------------------------------------------------------------
// Membaca browser (hanya dipanggil dari main.ts)

/** Media query display-mode yang berarti sudah dibuka sebagai aplikasi terpasang. */
export const QUERY_TERPASANG = ['(display-mode: standalone)', '(display-mode: minimal-ui)', '(display-mode: fullscreen)'] as const;

function cocok(query: string): boolean {
  try {
    return !!window.matchMedia?.(query).matches;
  } catch {
    return false;
  }
}

/**
 * Sudah dibuka sebagai aplikasi terpasang: display-mode standalone/minimal-ui/fullscreen, atau
 * navigator.standalone di iOS. Layar penuh dari menu meja (requestFullscreen di kontrolMeja.ts,
 * document.fullscreenElement terisi) tidak dihitung terpasang.
 */
export function sedangTerpasang(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    cocok(QUERY_TERPASANG[0]) ||
    cocok(QUERY_TERPASANG[1]) ||
    (cocok(QUERY_TERPASANG[2]) && !document.fullscreenElement) ||
    nav.standalone === true
  );
}

export function bacaLingkunganPasang(adaPrompt: boolean): LingkunganPasang {
  return {
    ua: navigator.userAgent ?? '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    aman: typeof isSecureContext === 'boolean' ? isSecureContext : location.protocol === 'https:',
    terpasang: sedangTerpasang(),
    adaPrompt,
  };
}
