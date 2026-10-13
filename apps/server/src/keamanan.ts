// Aturan keamanan HTTP/WebSocket yang murni (tanpa state server): header keamanan, cek Origin
// handshake WebSocket, dan pengelompokan alamat IP untuk batas per jaringan.

import type { IncomingMessage } from 'node:http';

/**
 * Content-Security-Policy untuk halaman PWA. Alasan tiap bagian:
 * - script-src 'self': semua skrip dari berkas sendiri (splash di public/splash.js, app di /assets).
 * - style-src 'unsafe-inline': gaya splash di index.html dan atribut style yang dipasang kode/Phaser.
 * - img-src data: blob:: tekstur bawaan Phaser (data URI) dan gambar kanvas kartu.
 * - connect-src ws: wss:: WebSocket ke /ws ('self' saja belum mencakup ws: di semua browser).
 * - frame-ancestors 'none': tidak boleh dibingkai situs lain (clickjacking).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' ws: wss:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Header keamanan untuk semua respons HTTP (HTML, aset, API). WebSocket tidak lewat sini. */
export const HEADER_KEAMANAN: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': CSP,
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

/** Alamat loopback / privat (RFC 1918, ULA IPv6, link-local). */
export function alamatLokal(ip: string): boolean {
  const a = ip.replace(/^::ffff:/i, '');
  if (a === '::1' || /^127\./.test(a) || /^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a)) return true;
  const m = /^172\.(\d+)\./.exec(a);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(a) || /^fe80:/i.test(a);
}

/** Apakah header dari proxy (X-Forwarded-*) boleh dipercaya untuk sambungan ini. */
export function proxyDipercaya(req: IncomingMessage, percaya: boolean | 'lokal' = 'lokal'): boolean {
  const langsung = (req.socket.remoteAddress ?? '').replace(/^::ffff:/i, '');
  return percaya === true || (percaya === 'lokal' && alamatLokal(langsung));
}

/** Alamat IP pemain, dengan X-Forwarded-For (entri paling kanan = yang ditulis proxy terdekat) bila dipercaya. */
export function alamatKlien(req: IncomingMessage, percaya: boolean | 'lokal' = 'lokal'): string {
  const langsung = (req.socket.remoteAddress ?? '').replace(/^::ffff:/i, '');
  const xff = req.headers['x-forwarded-for'];
  if (proxyDipercaya(req, percaya) && xff) {
    const daftar = (Array.isArray(xff) ? xff.join(',') : xff)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const terakhir = daftar.at(-1);
    if (terakhir && terakhir.length <= 64) return terakhir.replace(/^::ffff:/i, '');
  }
  return langsung || 'tak-dikenal';
}

/** Delapan blok 16-bit dari alamat IPv6 (termasuk bentuk `::` dan ekor IPv4), atau null kalau rusak. */
function blokIpv6(ip: string): number[] | null {
  let a = ip.replace(/%.*$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  // Ekor IPv4 (mis. 64:ff9b::1.2.3.4) jadi dua blok heksa.
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (v4) {
    const b = v4.slice(1).map(Number);
    if (b.some((x) => x > 255)) return null;
    a = a.slice(0, v4.index) + ((b[0] << 8) | b[1]).toString(16) + ':' + ((b[2] << 8) | b[3]).toString(16);
  }
  const bagian = a.split('::');
  if (bagian.length > 2) return null;
  const kiri = bagian[0] ? bagian[0].split(':') : [];
  const kanan = bagian.length === 2 && bagian[1] ? bagian[1].split(':') : [];
  const kurang = 8 - kiri.length - kanan.length;
  if (bagian.length === 1 ? kurang !== 0 : kurang < 1) return null;
  const semua = [...kiri, ...Array<string>(bagian.length === 2 ? kurang : 0).fill('0'), ...kanan];
  if (semua.some((h) => !/^[0-9a-f]{1,4}$/.test(h))) return null;
  return semua.map((h) => parseInt(h, 16));
}

/**
 * Kunci jaringan untuk batas per IP. IPv4 per alamat; IPv6 per prefiks /64, karena satu rumah/HP
 * biasanya mendapat satu /64 utuh dan bisa berganti alamat di dalamnya sesuka hati.
 */
export function kunciIp(ip: string): string {
  const a = ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  if (!a.includes(':')) return a;
  const blok = blokIpv6(a);
  if (!blok) return a.toLowerCase();
  return `${blok
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(':')}::/64`;
}

/** Host (nama:port, huruf kecil, port bawaan dibuang) dari header Host untuk skema tertentu. */
function normalHost(host: string, skema: string): string | null {
  try {
    return new URL(`${skema}//${host.trim()}`).host;
  } catch {
    return null;
  }
}

/**
 * Bolehkah handshake WebSocket dengan header Origin ini? Melindungi dari situs lain yang membuka
 * sambungan atas nama browser pemain (cross-site WebSocket hijacking).
 * - Tanpa Origin (klien non-browser, mis. alat uji): boleh.
 * - Origin sehost dengan header Host, atau X-Forwarded-Host bila proxy dipercaya: boleh.
 * - Ada di `tambahan` (asal lengkap "https://contoh.id" atau host "contoh.id"; "*" = semua): boleh.
 */
export function originDiizinkan(req: IncomingMessage, opsi: { percayaProxy?: boolean | 'lokal'; tambahan?: readonly string[] } = {}): boolean {
  const mentah = req.headers.origin;
  if (mentah === undefined) return true;
  const tambahan = opsi.tambahan ?? [];
  if (tambahan.includes('*')) return true;
  let asal: URL;
  try {
    asal = new URL(mentah);
  } catch {
    return false; // termasuk "null" (iframe sandbox, file://)
  }
  if (asal.protocol !== 'http:' && asal.protocol !== 'https:') return false;
  const kandidat: string[] = [];
  if (req.headers.host) kandidat.push(req.headers.host);
  const xfh = req.headers['x-forwarded-host'];
  if (xfh && proxyDipercaya(req, opsi.percayaProxy ?? 'lokal')) {
    for (const h of (Array.isArray(xfh) ? xfh.join(',') : xfh).split(',')) if (h.trim()) kandidat.push(h);
  }
  if (kandidat.some((h) => normalHost(h, asal.protocol) === asal.host)) return true;
  for (const t of tambahan) {
    if (t.includes('://')) {
      try {
        if (new URL(t).origin === asal.origin) return true;
      } catch {
        // entri rusak dilewati
      }
    } else if (normalHost(t, asal.protocol) === asal.host) {
      return true;
    }
  }
  return false;
}

/** Daftar dipisah koma dari env (spasi dibuang, entri kosong dilewati). */
export function daftarEnv(isi: string | undefined): string[] {
  return (isi ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
