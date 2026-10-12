// Efek suara disintesis dengan Web Audio (tanpa file audio, aman offline) dan getar HP.

import { simpan } from '../penyimpanan';

export type JenisBunyi =
  | 'kartu'
  | 'buang'
  | 'mulung'
  | 'giliran'
  | 'sorak'
  | 'mentung'
  | 'kepentung'
  | 'bahaya'
  | 'joker'
  | 'tegang'
  | 'detak'
  | 'pop';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!simpan.pengaturanEfek().suara) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Browser baru mengizinkan audio setelah ada sentuhan pertama. */
export function siapkanAudio(): void {
  const buka = () => {
    audio();
    window.removeEventListener('pointerdown', buka);
  };
  window.addEventListener('pointerdown', buka);
}

function nada(a: AudioContext, frek: number, mulai: number, durasi: number, jenis: OscillatorType = 'sine', volume = 0.18, geserKe?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = jenis;
  o.frequency.setValueAtTime(frek, a.currentTime + mulai);
  if (geserKe) o.frequency.exponentialRampToValueAtTime(geserKe, a.currentTime + mulai + durasi);
  g.gain.setValueAtTime(0.0001, a.currentTime + mulai);
  g.gain.exponentialRampToValueAtTime(volume, a.currentTime + mulai + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + mulai + durasi);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + mulai);
  o.stop(a.currentTime + mulai + durasi + 0.05);
}

/** Bunyi "sret" kartu: derau pendek yang disaring. */
function desis(a: AudioContext, mulai: number, durasi: number, frek: number, volume = 0.25) {
  const panjang = Math.floor(a.sampleRate * durasi);
  const buf = a.createBuffer(1, panjang, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < panjang; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / panjang);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = frek;
  const g = a.createGain();
  g.gain.value = volume;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + mulai);
}

export function bunyi(jenis: JenisBunyi): void {
  const a = audio();
  if (!a) return;
  switch (jenis) {
    case 'kartu':
      desis(a, 0, 0.08, 2500, 0.2);
      break;
    case 'buang':
      desis(a, 0, 0.1, 1600, 0.3);
      nada(a, 180, 0, 0.12, 'triangle', 0.12);
      break;
    case 'mulung':
      desis(a, 0, 0.18, 3000, 0.22);
      nada(a, 300, 0.02, 0.18, 'sine', 0.08, 600);
      break;
    case 'giliran':
      nada(a, 660, 0, 0.12, 'sine', 0.14);
      nada(a, 880, 0.12, 0.18, 'sine', 0.14);
      break;
    case 'sorak':
      [523, 659, 784, 1047].forEach((f, i) => nada(a, f, i * 0.07, 0.22, 'square', 0.07));
      break;
    case 'mentung':
      nada(a, 130, 0, 0.5, 'sawtooth', 0.12, 65);
      [392, 523, 659, 784].forEach((f, i) => nada(a, f, 0.05 + i * 0.06, 0.45, 'square', 0.07));
      break;
    case 'kepentung':
      nada(a, 220, 0, 0.35, 'sawtooth', 0.14, 90);
      nada(a, 160, 0.25, 0.4, 'sawtooth', 0.12, 70);
      break;
    case 'bahaya':
      nada(a, 880, 0, 0.1, 'square', 0.08);
      nada(a, 880, 0.16, 0.1, 'square', 0.08);
      break;
    case 'tegang':
      // Gebukan pelan yang makin rapat, seperti drum sebelum kartu dibuka.
      for (let i = 0; i < 9; i++) nada(a, 110 + i * 6, 0.05 + i * 0.11 - i * i * 0.004, 0.09, 'triangle', 0.1);
      break;
    case 'detak':
      // Detak jantung: dua denyut rendah.
      nada(a, 70, 0, 0.12, 'sine', 0.22);
      nada(a, 60, 0.18, 0.14, 'sine', 0.16);
      break;
    case 'pop':
      nada(a, 520, 0, 0.08, 'sine', 0.1, 900);
      break;
    case 'joker':
      nada(a, 700, 0, 0.3, 'triangle', 0.12, 250);
      break;
  }
}

export function getar(pola: number | number[]): void {
  if (!simpan.pengaturanEfek().getar) return;
  try {
    navigator.vibrate?.(pola);
  } catch {
    // tidak didukung
  }
}
