// Suara (0.9.0): server ICE untuk obrolan suara WebRTC di meja online (GET /api/suara/ice).
//
// STUN publik selalu diberikan. TURN (relay, perlu untuk banyak jaringan data seluler/CGNAT) hanya kalau
// env TURN_URLS (atau TURN_URL) dan TURN_SECRET diisi, memakai skema "REST API" coturn dengan rahasia
// bersama (static-auth-secret): username = "<kedaluwarsa unix>:<acak>", credential =
// base64(HMAC-SHA1(rahasia, username)). Kredensialnya berumur pendek, jadi tidak ada sandi TURN tetap yang
// bisa bocor dari aplikasi. Rahasianya tidak pernah ditulis ke log maupun ke jawaban.

import { createHmac, randomBytes } from 'node:crypto';

export const STUN_BAWAAN = 'stun:stun.l.google.com:19302';
/** Umur kredensial TURN bawaan (detik): cukup untuk satu malam main, pendek kalau bocor. */
export const TTL_TURN_BAWAAN_DETIK = 4 * 3600;

export interface KonfigurasiTurn {
  /** Alamat TURN, mis. "turn:turn.contoh.id:3478?transport=udp". */
  urls: string[];
  rahasia: string;
  ttlDetik: number;
}

export interface JawabanIce {
  iceServers: { urls: string | string[]; username?: string; credential?: string }[];
  /** Umur kredensial (detik); aplikasi meminta lagi sebelum habis. Tanpa TURN: umur saran cache. */
  ttl: number;
}

/**
 * Baca konfigurasi TURN dari env: TURN_URLS (dipisah koma) atau TURN_URL, TURN_SECRET, dan TURN_TTL
 * (opsional, detik). Null kalau salah satu yang wajib kosong. Alamat yang bukan turn:/turns: dibuang.
 */
export function bacaTurnEnv(env: Record<string, string | undefined>): KonfigurasiTurn | null {
  const urls = (env.TURN_URLS ?? env.TURN_URL ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^turns?:[^\s]+$/i.test(u));
  const rahasia = env.TURN_SECRET?.trim() ?? '';
  if (!urls.length || !rahasia) return null;
  const ttl = Number(env.TURN_TTL);
  return { urls, rahasia, ttlDetik: Number.isFinite(ttl) && ttl >= 300 && ttl <= 86_400 ? Math.floor(ttl) : TTL_TURN_BAWAAN_DETIK };
}

/** Kredensial TURN skema REST coturn untuk saat `sekarangMs`. */
export function kredensialTurn(rahasia: string, sekarangMs: number, ttlDetik: number, acak = randomBytes(6).toString('hex')): { username: string; credential: string } {
  const username = `${Math.floor(sekarangMs / 1000) + ttlDetik}:${acak}`;
  const credential = createHmac('sha1', rahasia).update(username).digest('base64');
  return { username, credential };
}

/**
 * Isi jawaban /api/suara/ice. `bolehTurn`: peminta anggota suara di meja online yang punya teman suara terhubung (Meja.bolehRelaySuara),
 * supaya relay TURN tidak bisa dipakai sembarang orang dari luar. Tanpa itu, atau tanpa konfigurasi
 * TURN, hanya STUN.
 */
export function jawabanIce(turn: KonfigurasiTurn | null, sekarangMs: number, bolehTurn: boolean): JawabanIce {
  const iceServers: JawabanIce['iceServers'] = [{ urls: STUN_BAWAAN }];
  if (turn && bolehTurn) {
    iceServers.push({ urls: [...turn.urls], ...kredensialTurn(turn.rahasia, sekarangMs, turn.ttlDetik) });
    return { iceServers, ttl: turn.ttlDetik };
  }
  return { iceServers, ttl: TTL_TURN_BAWAAN_DETIK };
}
