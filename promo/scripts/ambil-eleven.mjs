// Musik latar dan bunyi fisik dari ElevenLabs (Eleven Music + Sound Effects API) untuk Teaser A, supaya musiknya
// tidak memakai musik game dan suasananya lebih terasa kedai. Hasil di public/aset/eleven/*.mp3 (diabaikan git).
// Butuh env ELEVENLABS_API_KEY. Paket starter membatasi 4 permintaan serentak, jadi dijalankan bertiga-tiga.
// Pakai: `npm run aset:eleven` di folder promo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kunci = process.env.ELEVENLABS_API_KEY;
if (!kunci) throw new Error('ELEVENLABS_API_KEY belum diisi.');
const keluar = join(dirname(fileURLToPath(import.meta.url)), '../public/aset/eleven');
mkdirSync(keluar, { recursive: true });

const MUSIK = {
  'musik-kedai': {
    prompt:
      'Warm, playful lo-fi Indonesian coffee-shop background track for a comedic short video about friends playing cards at night. Acoustic guitar, soft brushed drums, light kalimba or gamelan-like bell accents, cozy and slightly cheeky mood, steady groove, no vocals. Around 95 BPM. Starts relaxed, builds a little tension in the middle, ends warm and happy.',
    music_length_ms: 44000,
    force_instrumental: true,
  },
};
const BUNYI = {
  'tawa-riuh': ['Three friends bursting into loud laughter at a cafe table, one slapping the table, warm room', 3.5],
  'kursi-jatuh': ['Wooden chair tipping over backwards and crashing on a cafe floor, cartoon exaggerated thud', 1.8],
  'gebrak-meja': ['Hand slamming hard on a wooden cafe table, cups rattle', 1.2],
  seruput: ['Person slurping hot coffee loudly then a satisfied sigh', 1.6],
  'gelas-retak': ['Ceramic coffee mug cracking with a sharp crack sound, cartoon style', 1.0],
  'suasana-kedai': ['Quiet cozy coffee shop ambience at night, soft chatter in the distance, cups clinking, ceiling fan', 20],
  'stempel-dok': ['Heavy rubber stamp slamming on paper, deep thud, cartoon', 1.0],
  whoosh: ['Fast cinematic whoosh swish transition', 0.8],
};

async function minta(jalur, body, nama) {
  const r = await fetch(`https://api.elevenlabs.io/v1/${jalur}`, { method: 'POST', headers: { 'xi-api-key': kunci, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${nama}: ${r.status} ${await r.text()}`);
  writeFileSync(join(keluar, `${nama}.mp3`), Buffer.from(await r.arrayBuffer()));
  console.log('ditulis', nama);
}

for (const [nama, body] of Object.entries(MUSIK)) await minta('music', body, nama);
const daftar = Object.entries(BUNYI);
for (let i = 0; i < daftar.length; i += 3) {
  await Promise.all(daftar.slice(i, i + 3).map(([nama, [text, duration_seconds]]) => minta('sound-generation', { text, duration_seconds, prompt_influence: 0.4 }, nama)));
}
