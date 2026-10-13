// Bahan dasar bunyi: semua disintesis Web Audio (tanpa file), jadi PWA tetap bersuara saat offline.
// Fungsi di sini murni "menggambar" bunyi ke sebuah Keluaran, tidak tahu soal preferensi atau aturan,
// sehingga bisa dipakai AudioContext sungguhan maupun OfflineAudioContext (untuk mengukur level).
// Prinsip: setiap sumber punya amplop (serang 1-5 ms, luruh eksponensial ke ~0) supaya tanpa klik,
// dan semua node dilepas begitu sumbernya selesai.

/** Nilai "nol" untuk ramp eksponensial (tidak boleh tepat 0). */
const NOL = 0.0001;

/** Ke mana bunyi dikirim. */
export interface Keluaran {
  readonly a: BaseAudioContext;
  /** Tujuan suara kering (bus). */
  readonly ke: AudioNode;
  /** Kiriman ke gema ruangan kedai (opsional, untuk bunyi bernada). */
  readonly gema?: AudioNode;
  /** Buffer derau putih bersama (lihat bufferDerau). */
  readonly derau: AudioBuffer;
  /** Dipanggil +1 saat sumber dijadwalkan dan −1 saat selesai: untuk menghitung sumber aktif. */
  readonly lacak?: (delta: number) => void;
}

/** Angka acak di [min, maks). */
export const acak = (min: number, maks: number): number => min + Math.random() * (maks - min);

/** Frekuensi dari nomor nada MIDI (69 = A4 = 440 Hz). */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const cacheDerau = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Derau putih 2 detik, dibuat sekali per context lalu dipakai ulang (potongan acak tiap bunyi). */
export function bufferDerau(a: BaseAudioContext): AudioBuffer {
  let buf = cacheDerau.get(a);
  if (!buf) {
    buf = a.createBuffer(1, Math.floor(a.sampleRate * 2), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    cacheDerau.set(a, buf);
  }
  return buf;
}

/** Lepas semua node begitu sumber selesai, dan catat ke pelacak. */
function rapikan(k: Keluaran, sumber: AudioScheduledSourceNode, ...node: AudioNode[]): void {
  k.lacak?.(1);
  sumber.onended = () => {
    sumber.disconnect();
    for (const n of node) n.disconnect();
    k.lacak?.(-1);
  };
}

/** Amplop serang-luruh: naik linear ke puncak, lalu luruh eksponensial. */
function amplop(g: AudioParam, t: number, serang: number, puncak: number, luruh: number): void {
  g.setValueAtTime(NOL, t);
  g.linearRampToValueAtTime(Math.max(NOL, puncak), t + serang);
  g.exponentialRampToValueAtTime(NOL, t + serang + luruh);
}

/** Sambungkan node akhir ke bus, plus kiriman gema kalau diminta. */
function keBus(k: Keluaran, n: AudioNode, gema: number): AudioNode[] {
  n.connect(k.ke);
  if (gema > 0 && k.gema) {
    const kirim = k.a.createGain();
    kirim.gain.value = gema;
    n.connect(kirim).connect(k.gema);
    return [kirim];
  }
  return [];
}

export interface OpsiNada {
  tipe?: OscillatorType;
  puncak?: number;
  serang?: number;
  /** Geser frekuensi (eksponensial) ke nilai ini sepanjang bunyi. */
  geserKe?: number;
  /** Saring lowpass supaya tidak tajam (Hz). */
  lowpass?: number;
  /** Besar kiriman ke gema, 0..1. */
  gema?: number;
  /** Detune dalam cent. */
  detune?: number;
}

/** Satu nada osilator dengan amplop halus. */
export function nada(k: Keluaran, t: number, frek: number, dur: number, o: OpsiNada = {}): void {
  const { a } = k;
  const osc = a.createOscillator();
  osc.type = o.tipe ?? 'sine';
  osc.frequency.setValueAtTime(frek, t);
  if (o.geserKe) osc.frequency.exponentialRampToValueAtTime(o.geserKe, t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = a.createGain();
  const serang = o.serang ?? 0.004;
  amplop(g.gain, t, serang, o.puncak ?? 0.2, Math.max(0.01, dur - serang));
  const node: AudioNode[] = [g];
  if (o.lowpass) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    f.Q.value = 0.5;
    osc.connect(f).connect(g);
    node.push(f);
  } else {
    osc.connect(g);
  }
  node.push(...keBus(k, g, o.gema ?? 0));
  osc.start(t);
  osc.stop(t + dur + 0.03);
  rapikan(k, osc, ...node);
}

export interface OpsiGesek {
  /** Frekuensi tengah saringan (Hz). */
  frek: number;
  /** Frekuensi tengah di akhir (sapuan), kalau ada. */
  frekAkhir?: number;
  q?: number;
  puncak: number;
  serang?: number;
  tipe?: BiquadFilterType;
}

/** Gesekan kertas: potongan derau yang disaring, bisa disapu frekuensinya ("sret"). */
export function gesek(k: Keluaran, t: number, dur: number, o: OpsiGesek): void {
  const { a } = k;
  const src = a.createBufferSource();
  src.buffer = k.derau;
  const f = a.createBiquadFilter();
  f.type = o.tipe ?? 'bandpass';
  f.Q.value = o.q ?? 1.2;
  f.frequency.setValueAtTime(o.frek, t);
  if (o.frekAkhir) f.frequency.exponentialRampToValueAtTime(o.frekAkhir, t + dur);
  const g = a.createGain();
  const serang = Math.min(o.serang ?? 0.004, dur * 0.5);
  amplop(g.gain, t, serang, o.puncak, dur - serang);
  src.connect(f).connect(g).connect(k.ke);
  // Potongan acak dari buffer bersama: tiap gesekan beda tekstur tanpa alokasi baru.
  src.start(t, acak(0, Math.max(0, k.derau.duration - dur - 0.05)), dur + 0.02);
  rapikan(k, src, f, g);
}

/**
 * Rentetan klik kertas berdekatan (riffle saat mengocok, kartu berhamburan) dengan SATU sumber derau:
 * tiap klik hanya titik otomatisasi gain/saringan, jadi ringan walau puluhan klik.
 */
export function gemeretak(k: Keluaran, waktu: readonly number[], o: { frekMin: number; frekMaks: number; puncak: (i: number) => number }): void {
  if (waktu.length === 0) return;
  const { a } = k;
  const t0 = waktu[0];
  const t1 = waktu[waktu.length - 1] + 0.03;
  const src = a.createBufferSource();
  src.buffer = k.derau;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.6;
  const g = a.createGain();
  g.gain.setValueAtTime(NOL, t0);
  waktu.forEach((t, i) => {
    f.frequency.setValueAtTime(acak(o.frekMin, o.frekMaks), t);
    g.gain.setValueAtTime(NOL, t);
    g.gain.linearRampToValueAtTime(Math.max(NOL, o.puncak(i)), t + 0.0012);
    g.gain.exponentialRampToValueAtTime(NOL, t + acak(0.006, 0.011));
  });
  src.connect(f).connect(g).connect(k.ke);
  src.start(t0, acak(0, Math.max(0, k.derau.duration - (t1 - t0) - 0.05)), t1 - t0 + 0.02);
  rapikan(k, src, f, g);
}

/**
 * Ketukan kartu di meja kayu: klik kertas sangat pendek + "dug" badan meja yang turun nadanya.
 * `badan` = frekuensi dasar dentum meja (Hz), `terang` = frekuensi klik kertas.
 */
export function ketuk(k: Keluaran, t: number, o: { puncak: number; badan?: number; terang?: number }): void {
  gesek(k, t, 0.016, { frek: o.terang ?? 2400, q: 0.9, puncak: o.puncak, serang: 0.001 });
  const badan = o.badan ?? 170;
  nada(k, t, badan, 0.075, { tipe: 'sine', puncak: o.puncak * 0.9, serang: 0.002, geserKe: badan * 0.62 });
}

/**
 * Bilah logam ala saron/bonang yang dilunakkan: nada dasar + parsial tak-harmonis yang lebih cepat padam,
 * ditambah ketukan pemukul. Dipakai untuk isyarat bernada supaya tetap hangat, bukan "bip" elektronik.
 */
export function bilah(k: Keluaran, t: number, frek: number, dur: number, puncak: number, gema = 0.35): void {
  nada(k, t, frek, dur, { puncak, serang: 0.003, gema });
  nada(k, t, frek * 2.76, dur * 0.35, { puncak: puncak * 0.22, serang: 0.002, gema: gema * 0.5 });
  nada(k, t, frek * 5.4, dur * 0.12, { puncak: puncak * 0.07, serang: 0.001 });
  gesek(k, t, 0.012, { frek: Math.min(6000, frek * 4), q: 1, puncak: puncak * 0.25, serang: 0.001 });
}

/** Kendang "dung": pukulan rendah dengan nada yang turun. */
export function dung(k: Keluaran, t: number, puncak: number, frek = 120): void {
  nada(k, t, frek, 0.32, { puncak, serang: 0.003, geserKe: frek * 0.62 });
  // Harmonik kedua supaya tetap terdengar di speaker HP yang tidak sanggup bass.
  nada(k, t, frek * 2, 0.12, { tipe: 'triangle', puncak: puncak * 0.3, serang: 0.002, geserKe: frek * 1.3, lowpass: 900 });
  gesek(k, t, 0.02, { frek: 900, q: 0.8, puncak: puncak * 0.25, serang: 0.001 });
}

/** Kendang "tak": tepukan pinggir yang kering. */
export function tak(k: Keluaran, t: number, puncak: number): void {
  gesek(k, t, 0.05, { frek: acak(1500, 1900), q: 2.2, puncak, serang: 0.001 });
  nada(k, t, 340, 0.05, { tipe: 'triangle', puncak: puncak * 0.45, serang: 0.001, geserKe: 260 });
}

/** Gong kecil: dua sinus berdekatan (berdenyut) + parsial atas, luruh panjang. */
export function gong(k: Keluaran, t: number, frek: number, dur: number, puncak: number): void {
  nada(k, t, frek, dur, { puncak, serang: 0.02, gema: 0.4 });
  nada(k, t, frek * 1.007, dur * 0.9, { puncak: puncak * 0.6, serang: 0.02 });
  nada(k, t, frek * 2.01, dur * 0.45, { puncak: puncak * 0.25, serang: 0.01, gema: 0.3 });
  nada(k, t, frek * 2.98, dur * 0.2, { puncak: puncak * 0.08, serang: 0.005 });
}

/** Petikan senar lembut (ukulele/cak keroncong): segitiga dengan saringan yang menutup cepat. */
export function petik(k: Keluaran, t: number, frek: number, dur: number, puncak: number, gema = 0.25): void {
  const { a } = k;
  const osc = a.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frek;
  osc.detune.value = acak(-5, 5);
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(Math.min(5000, frek * 6), t);
  f.frequency.exponentialRampToValueAtTime(Math.max(200, frek * 1.2), t + Math.min(0.25, dur));
  const g = a.createGain();
  amplop(g.gain, t, 0.004, puncak, dur);
  osc.connect(f).connect(g);
  const kirim = keBus(k, g, gema);
  osc.start(t);
  osc.stop(t + dur + 0.03);
  rapikan(k, osc, f, g, ...kirim);
}

/** Bangun gema ringan (tunda + umpan balik tersaring) yang keluar ke `tujuan`. Kembalikan node masukannya. */
export function buatGema(a: BaseAudioContext, tujuan: AudioNode, o: { tunda: number; umpan: number; basah: number; lowpass: number }): AudioNode {
  const masuk = a.createGain();
  const tunda = a.createDelay(1);
  tunda.delayTime.value = o.tunda;
  const saring = a.createBiquadFilter();
  saring.type = 'lowpass';
  saring.frequency.value = o.lowpass;
  const umpan = a.createGain();
  umpan.gain.value = o.umpan;
  const basah = a.createGain();
  basah.gain.value = o.basah;
  masuk.connect(tunda).connect(saring);
  saring.connect(umpan).connect(tunda);
  saring.connect(basah).connect(tujuan);
  return masuk;
}
