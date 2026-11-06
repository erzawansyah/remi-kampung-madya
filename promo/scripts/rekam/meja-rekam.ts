// Server lokal untuk merekam video: server game asli (apps/server) dengan urutan kartu yang bisa
// diulang. Seed permainan di server diambil dari randomBytes(4); di sini randomBytes(4) diganti
// supaya selalu memberi seed pilihan (env SEED_REKAM), jadi putaran yang sama bisa dimainkan ulang.
// Ukuran lain (kode meja, dll.) tetap acak. Tanpa database: tidak ada riwayat yang tercatat.
//
// Pakai (dari akar repo): SEED_REKAM=123 npx tsx promo/scripts/rekam/meja-rekam.ts [port]
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

const asli = crypto.randomBytes;
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
}

export async function nyalakanServer(port: number, seed: number) {
  aturSeed(seed);
  const { jalankanServer } = await import('../../../apps/server/src/server.ts');
  return jalankanServer({ port, host: '127.0.0.1', jedaLanjutMs: 0, log: () => undefined });
}

const diJalankanLangsung = process.argv[1]?.endsWith('meja-rekam.ts');
if (diJalankanLangsung) {
  const port = Number(process.argv[2] ?? 2567);
  const seed = Number(process.env.SEED_REKAM ?? 1);
  await nyalakanServer(port, seed);
  console.log(`server rekam di :${port}, seed ${seed}`);
}
