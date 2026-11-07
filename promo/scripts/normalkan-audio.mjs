// Normalisasi audio video (Reels): -14 LUFS terintegrasi, true peak ≤ -1,5 dBTP, video disalin apa adanya.
// loudnorm satu lewatan sering berhenti di bawah target kalau puncaknya tinggi, jadi di sini: kompresor ringan +
// loudnorm, lalu diukur ulang; kalau masih di bawah target, ditambah gain + limiter sampai masuk toleransi.
// Pakai: node scripts/normalkan-audio.mjs <masuk.mp4> <keluar.mp4> [targetLufs=-14] [tp=-1.5]
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [masuk, keluar, targetArg, tpArg] = process.argv.slice(2);
if (!masuk || !keluar) {
  console.error('pakai: normalkan-audio.mjs <masuk.mp4> <keluar.mp4> [targetLufs] [tp]');
  process.exit(1);
}
const TARGET = Number(targetArg ?? -14);
const TP = Number(tpArg ?? -1.5);
const sementara = mkdtempSync(join(tmpdir(), 'loudnorm-'));
const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 && !args.includes('null')) throw new Error(r.stderr.slice(-800));
  return r.stderr;
};
const ukur = (berkas) => {
  const s = ffmpeg(['-i', berkas, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const ringkas = s.slice(s.lastIndexOf('Summary:'));
  return { i: Number(/I:\s+(-?[\d.]+) LUFS/.exec(ringkas)?.[1]), tp: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(ringkas)?.[1]), lra: Number(/LRA:\s+(-?[\d.]+) LU/.exec(ringkas)?.[1]) };
};

const wav0 = join(sementara, 'asli.wav');
ffmpeg(['-i', masuk, '-vn', '-ar', '48000', '-c:a', 'pcm_f32le', wav0]);
const awal = ukur(wav0);
console.log(`asli: ${awal.i} LUFS, TP ${awal.tp} dBTP, LRA ${awal.lra} LU`);

// Lewatan 1: kompresor ringan untuk meredam puncak SFX, lalu loudnorm dua lewatan (ukur → terapkan linear).
const wav1 = join(sementara, 'l1.wav');
const u1 = ffmpeg(['-i', wav0, '-af', `acompressor=threshold=-14dB:ratio=2.5:attack=5:release=120:makeup=1,loudnorm=I=${TARGET}:TP=${TP - 0.8}:LRA=11:print_format=json`, '-f', 'null', '-']);
const json = JSON.parse(u1.slice(u1.lastIndexOf('{')));
ffmpeg([
  '-i', wav0, '-af',
  `acompressor=threshold=-14dB:ratio=2.5:attack=5:release=120:makeup=1,loudnorm=I=${TARGET}:TP=${TP - 0.8}:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`,
  '-ar', '48000', '-c:a', 'pcm_f32le', wav1,
]);
let kini = wav1;
let hasil = ukur(kini);
console.log(`lewatan 1: ${hasil.i} LUFS, TP ${hasil.tp} dBTP`);
// Lewatan 2+: gain + limiter kalau masih di bawah target.
// AAC bisa menambah puncak ±0,3 dB, jadi puncak WAV dijaga di bawah TP − 0,6.
for (let n = 2; n <= 4 && (hasil.i < TARGET - 0.6 || hasil.tp > TP - 0.6); n++) {
  const gain = Math.max(0, TARGET - hasil.i);
  const berikut = join(sementara, `l${n}.wav`);
  ffmpeg(['-i', kini, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${(TP - 1.0).toFixed(1)}dB:attack=2:release=50:level=false`, '-ar', '48000', '-c:a', 'pcm_f32le', berikut]);
  kini = berikut;
  hasil = ukur(kini);
  console.log(`lewatan ${n}: gain +${gain.toFixed(2)} dB + limiter → ${hasil.i} LUFS, TP ${hasil.tp} dBTP`);
}
ffmpeg(['-i', masuk, '-i', kini, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', keluar]);
const akhir = ukur(keluar);
console.log(`hasil ${keluar}: ${akhir.i} LUFS, TP ${akhir.tp} dBTP, LRA ${akhir.lra} LU`);
rmSync(sementara, { recursive: true, force: true });
const ok = Math.abs(akhir.i - TARGET) <= 1 && akhir.tp <= TP;
console.log(ok ? 'OK: -14 LUFS ±1 dan true peak ≤ -1,5 dBTP' : 'GAGAL: di luar toleransi');
process.exit(ok ? 0 : 2);
