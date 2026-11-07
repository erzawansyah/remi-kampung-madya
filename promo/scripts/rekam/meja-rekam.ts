// Server lokal untuk merekam video: server game asli (apps/server) dengan urutan kartu yang bisa
// diulang. Seed permainan di server diambil dari randomBytes(4); di sini randomBytes(4) diganti
// supaya selalu memberi seed pilihan (env SEED_REKAM), jadi putaran yang sama bisa dimainkan ulang.
// Math.random juga diganti PRNG ber-seed (mulberry32), karena server memakainya untuk urutan nama
// warga kedai (namaLawanAcak), dan gaya main warga kedai mengikuti namanya (gayaWarga.ts): tanpa ini
// langkah warga kedai bisa berbeda walau kartunya sama. Kode meja (randomBytes(5)) tetap acak.
// Tanpa database: tidak ada riwayat yang tercatat.
//
// Pakai (dari akar repo): SEED_REKAM=123 npx tsx promo/scripts/rekam/meja-rekam.ts [port] [jedaBotMs]
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

const asli = crypto.randomBytes;

/** PRNG mulberry32: urutan Math.random yang sama untuk seed yang sama. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pasang seed permainan (randomBytes(4)) dan seed Math.random. Boleh dipanggil ulang per permainan. */
export function aturSeed(seed: number): void {
  (crypto as { randomBytes: unknown }).randomBytes = ((n: number, ...sisa: unknown[]) => {
    if (n === 4 && sisa.length === 0) {
      const b = Buffer.alloc(4);
      b.writeInt32LE(seed | 0, 0);
      return b;
    }
    return (asli as (...a: unknown[]) => Buffer)(n, ...sisa);
  }) as typeof crypto.randomBytes;
  syncBuiltinESMExports();
  Math.random = mulberry32(seed ^ 0x5eed5eed);
}

export async function nyalakanServer(port: number, seed: number, jedaBotMs = 1500) {
  aturSeed(seed);
  const { jalankanServer } = await import('../../../apps/server/src/server.ts');
  // batasPesanPerDetik dilonggarkan: pencari seed memainkan satu putaran dalam kurang dari sedetik.
  return jalankanServer({ port, host: '127.0.0.1', jedaLanjutMs: 0, jedaBotMs, batasPesanPerDetik: 10000, log: () => undefined });
}

const diJalankanLangsung = process.argv[1]?.endsWith('meja-rekam.ts');
if (diJalankanLangsung) {
  const port = Number(process.argv[2] ?? 2567);
  const jedaBotMs = Number(process.argv[3] ?? 1500);
  const seed = Number(process.env.SEED_REKAM ?? 1);
  await nyalakanServer(port, seed, jedaBotMs);
  console.log(`server rekam di :${port}, seed ${seed}, jeda warga kedai ${jedaBotMs} ms`);
}
