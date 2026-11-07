// QA Teaser A (brief A §8): durasi/format, LUFS + true peak, QR dari still 34–38 dtk, hold diam, dan contact sheet 12 frame.
// Pakai: node scripts/qa-teaser-a.mjs [out/teaser-a.mp4]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const video = process.argv[2] ?? 'out/teaser-a.mp4';
const tmp = 'out/qa-a';
mkdirSync(tmp, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// 1. Format.
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video], { encoding: 'utf8' }));
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const durasi = Number(probe.format.duration);
console.log(`format: ${v.width}x${v.height} ${v.codec_name} ${v.pix_fmt} ${v.r_frame_rate} fps, audio ${a.codec_name} ${a.sample_rate} Hz, durasi ${durasi.toFixed(3)} dtk`);
console.log(`  durasi 42,5–43,5: ${durasi >= 42.5 && durasi <= 43.5 ? 'OK' : 'GAGAL'}; 1080x1920: ${v.width === 1080 && v.height === 1920 ? 'OK' : 'GAGAL'}; h264 yuv420p: ${v.codec_name === 'h264' && v.pix_fmt === 'yuv420p' ? 'OK' : 'GAGAL'}; aac 48k: ${a.codec_name === 'aac' && a.sample_rate === '48000' ? 'OK' : 'GAGAL'}`);

// 2. Loudness (ebur128).
const keluar = String(spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr);
const ringkas = keluar.slice(keluar.lastIndexOf('Summary:'));
const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(ringkas)?.[1]);
const tp = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(ringkas)?.[1]);
console.log(`loudness: ${lufs} LUFS (target -14 ±1: ${Math.abs(lufs + 14) <= 1 ? 'OK' : 'GAGAL'}), true peak ${tp} dBTP (≤ -1,5: ${tp <= -1.5 ? 'OK' : 'GAGAL'})`);

// 3. QR dari still 35–37 dtk (penutup) dan 40,5–42,5 dtk (bagian khusus QR).
for (const detik of [35.6, 36.6, 40.6, 41.6, 42.6]) {
  const berkas = join(tmp, `qr-${detik}.png`);
  ff(['-y', '-loglevel', 'error', '-ss', String(detik), '-i', video, '-frames:v', '1', berkas]);
  const png = PNG.sync.read(readFileSync(berkas));
  const hasil = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  console.log(`qr @${detik}s: ${hasil ? `${hasil.data} (lebar ±${Math.round(Math.hypot(hasil.location.topRightCorner.x - hasil.location.topLeftCorner.x, hasil.location.topRightCorner.y - hasil.location.topLeftCorner.y))} px)` : 'TIDAK TERBACA'}`);
}

// 4. Hold diam: selisih antar frame tiap 0,5 dtk (scene-change score lewat ffmpeg select/showinfo tidak perlu; pakai signalstats).
// Diperkecil dulu supaya grain tidak dihitung sebagai gerak.
const stat = String(spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-i', video, '-vf', 'fps=4,scale=48:86,tblend=all_mode=difference,signalstats,metadata=print', '-f', 'null', '-'], { encoding: 'utf8' }).stderr).split('\n').filter((l) => l.includes('YAVG'));
let diam = 0;
let diamMaks = 0;
let diamMulai = 0;
stat.forEach((l, i) => {
  const yavg = Number(/YAVG=([\d.]+)/.exec(l)?.[1] ?? 99);
  if (yavg < 0.6) {
    if (!diam) diamMulai = i;
    diam++;
    diamMaks = Math.max(diamMaks, diam);
  } else diam = 0;
});
console.log(`hold diam terpanjang: ${(diamMaks / 4).toFixed(2)} dtk (mulai ±${(diamMulai / 4).toFixed(1)} dtk) → ${diamMaks / 4 <= 4 ? 'OK' : 'GAGAL'} (batas 4 dtk)`);

// 5. Contact sheet 12 frame tiap ±3,7 dtk.
ff(['-y', '-loglevel', 'error', '-i', video, '-vf', "select='not(mod(n\\,100))',scale=270:480,tile=6x2", '-frames:v', '1', join(tmp, 'contact-sheet.png')]);
console.log(`contact sheet: ${join(tmp, 'contact-sheet.png')}`);
