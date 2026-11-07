// Efek suara non-game untuk Teaser B dari ElevenLabs (sound generation), disimpan ke public/aset/el-*.wav
// (diabaikan git). Bunyi game (kartu, pentungan, retak, notifikasi, pop) tetap dari kode game lewat
// `npm run aset`; ElevenLabs hanya untuk transisi dan stempel. Tanpa voice over (brief §1).
//
// Pakai: ELEVENLABS_API_KEY=... node scripts/ambil-sfx.mjs   (kunci dari environment, jangan ditulis ke repo)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const promo = join(dirname(fileURLToPath(import.meta.url)), '..');
const keluar = join(promo, 'public/aset');
mkdirSync(keluar, { recursive: true });
const kunci = process.env.ELEVENLABS_API_KEY;
if (!kunci) {
  console.error('ELEVENLABS_API_KEY kosong.');
  process.exit(1);
}

/** nama → [prompt, durasi detik]. */
const SFX = {
  whoosh: ['fast short cinematic whoosh swish transition, clean, no music', 0.7],
  'whoosh-kecil': ['quick light air swipe swish, very short, clean', 0.5],
  dok: ['single heavy rubber stamp slammed hard onto a wooden desk, deep thud, no music', 0.9],
  flash: ['bright camera flash pop with short soft shimmer, transition, no music', 0.8],
  kedai: ['cozy small coffee shop at night room tone, soft porcelain cup clinks, quiet fan hum, no speech, no music', 12],
};

for (const [nama, [teks, durasi]] of Object.entries(SFX)) {
  const wav = join(keluar, `el-${nama}.wav`);
  if (existsSync(wav) && !process.argv.includes('--ulang')) {
    console.log(`lewati ${nama} (sudah ada)`);
    continue;
  }
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': kunci, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: teks, duration_seconds: durasi, prompt_influence: 0.6 }),
  });
  if (!r.ok) throw new Error(`${nama}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const mp3 = join(keluar, `el-${nama}.mp3`);
  writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '48000', '-ac', '2', wav]);
  rmSync(mp3);
  console.log(`${nama}: ${wav}`);
}
