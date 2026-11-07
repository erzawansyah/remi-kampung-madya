// Server rekam untuk Teaser A: sama dengan meja-rekam.ts (seed permainan + Math.random ber-seed), tapi
// jeda lanjut 10 detik (brief A §5) supaya hasil putaran 1 bertahan saat ledekan dikirim dan direkam.
//
// Pakai (dari akar repo): SEED_REKAM=123 npx tsx promo/scripts/rekam/meja-rekam-a.ts [port] [jedaBotMs]
import { aturSeed } from './meja-rekam.ts';

const port = Number(process.argv[2] ?? 2567);
const jedaBotMs = Number(process.argv[3] ?? 1500);
const seed = Number(process.env.SEED_REKAM ?? 1);
aturSeed(seed);
const { jalankanServer } = await import('../../../apps/server/src/server.ts');
await jalankanServer({ port, host: '127.0.0.1', jedaLanjutMs: 10000, jedaBotMs, batasPesanPerDetik: 10000, log: () => undefined });
console.log(`server rekam di :${port}, seed ${seed}, jeda warga kedai ${jedaBotMs} ms`);
