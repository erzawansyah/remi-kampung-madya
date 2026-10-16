// Mesin audio: SATU AudioContext untuk seluruh aplikasi, dengan rangkaian bus
//   bus efek ─┐
//             ├─► master ─► pembatas (limiter) ─► speaker
//   bus musik ┘
// Volume bus mengikuti preferensi (suara/volumeEfek, musik/volumeMusik) dan berubah halus tanpa klik.
// Context baru DIPAKAI setelah pemain pernah menyentuh layar (aturan autoplay browser),
// ditidurkan saat tab tersembunyi atau saat suara & musik sama-sama mati (hemat baterai),
// dan dibangunkan lagi oleh sentuhan berikutnya (penting untuk iOS yang suka "interrupted").
//
// Pemanasan: konstruktor AudioContext PERTAMA di satu halaman itu mahal (Chrome menyiapkan perangkat/
// layanan audio secara sinkron: 50–230 ms di Windows). Kalau dibuat saat ketukan "Main", jeda itu jatuh
// tepat di frame pertama meja. Jadi context dibuat lebih awal saat beranda senggang (masih tidur/suspended,
// belum bisa berbunyi), lalu sentuhan pertama cukup me-resume-nya. Tanpa pemanasan (iPhone/iPad, tab
// tersembunyi, suara & musik mati, atau pemain sudah keburu menyentuh) perilakunya tetap seperti dulu.

import { perangkatApel } from '../pasangAplikasi';
import { preferensi, saatPreferensiBerubah, type Preferensi } from '../preferensi';
import { bufferDerau, buatGema, type Keluaran } from './sintesis';

export interface Rantai<A extends BaseAudioContext = BaseAudioContext> {
  readonly a: A;
  readonly busEfek: GainNode;
  readonly busMusik: GainNode;
  /** Gema ruangan kedai untuk efek bernada; keluarnya ke bus efek. */
  readonly gemaEfek: AudioNode;
  readonly derau: AudioBuffer;
}

/** Bangun bus + pembatas di context mana pun (juga OfflineAudioContext untuk uji level). */
export function bangunRantai<A extends BaseAudioContext>(a: A): Rantai<A> {
  // Pembatas hanya jaring pengaman saat banyak bunyi bertumpuk; level tiap bunyi sudah diatur di bawahnya.
  const pembatas = a.createDynamicsCompressor();
  pembatas.threshold.value = -3;
  pembatas.knee.value = 0;
  pembatas.ratio.value = 20;
  pembatas.attack.value = 0.002;
  pembatas.release.value = 0.12;
  const master = a.createGain();
  master.gain.value = 0.85;
  master.connect(pembatas).connect(a.destination);
  const busEfek = a.createGain();
  const busMusik = a.createGain();
  busEfek.connect(master);
  busMusik.connect(master);
  const gemaEfek = buatGema(a, busEfek, { tunda: 0.12, umpan: 0.25, basah: 0.2, lowpass: 2400 });
  return { a, busEfek, busMusik, gemaEfek, derau: bufferDerau(a) };
}

/** Slider volume (linear 0..1) ke gain. Dikuadratkan supaya perubahan slider terasa rata di telinga. */
export const kurvaVolume = (v: number): number => v * v;

let rantai: Rantai<AudioContext> | null = null;
/** Rantai hasil pemanasan: sudah dibuat tapi belum dipakai (menunggu sentuhan pertama). */
let rantaiPanas: Rantai<AudioContext> | null = null;
let sudahDisentuh = false;
let sudahDibuka = false;
let sedangBangun = false;
/** Kapan resume() terakhir dimulai (ms performance.now). Resume yang menggantung (iOS di luar gestur) dianggap basi. */
let mulaiBangun = 0;
const BATAS_BANGUN_MS = 300;
let timerTidur: ReturnType<typeof setTimeout> | undefined;
let terpasang = false;
let sumberAktif = 0;
const pendengarSiap = new Set<() => void>();

const terlihat = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';
const perluJalan = (p: Preferensi = preferensi()): boolean => terlihat() && (p.suara || p.musik);

/** Browser hanya mengizinkan audio setelah ada interaksi pemain. */
function bolehDibuat(): boolean {
  const p = preferensi();
  if (!p.suara && !p.musik) return false;
  return sudahDisentuh || (navigator.userActivation?.hasBeenActive ?? false);
}

function aturGain(param: AudioParam, nilai: number, sekarang: number, langsung: boolean): void {
  param.cancelScheduledValues(sekarang);
  if (langsung) {
    param.setValueAtTime(nilai, sekarang);
  } else {
    param.setValueAtTime(param.value, sekarang);
    param.setTargetAtTime(nilai, sekarang, 0.06);
  }
}

function terapkanPreferensi(p: Preferensi, langsung = false): void {
  if (!rantai) return;
  const t = rantai.a.currentTime;
  aturGain(rantai.busEfek.gain, p.suara ? kurvaVolume(p.volumeEfek) : 0, t, langsung);
  aturGain(rantai.busMusik.gain, p.musik ? kurvaVolume(p.volumeMusik) : 0, t, langsung);
  if (perluJalan(p)) bangunkan();
  else tidurkan(400);
}

/**
 * Bangunkan context. `dariGestur` = dipanggil di dalam sentuhan/klik/tombol: resume() selalu dicoba
 * walau ada resume lain yang masih menggantung, karena di iOS hanya resume di dalam gestur yang diizinkan.
 */
function bangunkan(dariGestur = false): void {
  clearTimeout(timerTidur);
  if (!rantai || rantai.a.state === 'running' || !perluJalan()) return;
  if (sedangBangun && !dariGestur && performance.now() - mulaiBangun < BATAS_BANGUN_MS) return;
  sedangBangun = true;
  mulaiBangun = performance.now();
  const r = rantai;
  // Tipe TS belum mengenal 'interrupted' (iOS), jadi cukup cek "bukan running".
  r.a
    .resume()
    .catch(() => undefined)
    .finally(() => {
      sedangBangun = false;
      // Tab bisa saja tersembunyi lagi (atau suara dimatikan) selama resume berjalan.
      if (!perluJalan()) tidurkan(0);
    });
}

function tidurkan(tundaMs: number): void {
  clearTimeout(timerTidur);
  if (!rantai) return;
  const r = rantai;
  // Ditunda sedikit supaya ramp volume ke nol sempat selesai (tanpa "klik" terpotong).
  timerTidur = setTimeout(() => {
    if (!perluJalan() && r.a.state !== 'closed' && r.a.state !== 'suspended') void r.a.suspend().catch(() => undefined);
  }, tundaMs);
}

/** Trik lama iOS: memutar satu sampel hening di dalam sentuhan "membuka" jalur audio. */
function bukaJalurIos(a: AudioContext): void {
  const buf = a.createBuffer(1, 1, a.sampleRate);
  const src = a.createBufferSource();
  src.buffer = buf;
  src.connect(a.destination);
  src.onended = () => src.disconnect();
  src.start(0);
}

/** iPhone/iPad (juga iPadOS yang mengaku Mac): jalur buka audio di sana rewel, jadi tetap dibuat di dalam gestur. */
function perangkatApelIni(): boolean {
  return perangkatApel(navigator.userAgent, navigator.maxTouchPoints);
}

/**
 * Pemanasan: buat context (+ rantai bus) saat beranda senggang, SEBELUM sentuhan pertama. Context tetap
 * tidur; baru dipakai & di-resume oleh mesinAudio() setelah pemain menyentuh layar.
 */
export function panaskanAudio(): void {
  if (rantai || rantaiPanas || sudahDisentuh || !terlihat() || typeof AudioContext === 'undefined' || perangkatApelIni()) return;
  const p = preferensi();
  if (!p.suara && !p.musik) return;
  try {
    const a = new AudioContext({ latencyHint: 'interactive' });
    rantaiPanas = bangunRantai(a);
    // Browser yang sudah mengizinkan autoplay langsung menjalankannya: tidurkan sampai disentuh.
    if (a.state === 'running') void a.suspend().catch(() => undefined);
  } catch {
    rantaiPanas = null;
  }
}

/** Jeda setelah halaman selesai dimuat sebelum pemanasan (biar gambar pertama beranda tidak tersendat). */
const JEDA_PANAS_MS = 600;

/**
 * Rantai audio siap pakai, atau null kalau belum boleh/tidak perlu (belum disentuh, suara & musik mati,
 * browser tanpa Web Audio). Sekalian membangunkan context yang sedang tidur.
 */
export function mesinAudio(): Rantai<AudioContext> | null {
  if (!rantai) {
    if (!bolehDibuat()) return null;
    // Pakai hasil pemanasan kalau ada (murah); kalau tidak, buat sekarang (mahal, tapi tetap di dalam gestur).
    const panas = rantaiPanas && rantaiPanas.a.state !== 'closed' ? rantaiPanas : null;
    rantaiPanas = null;
    try {
      rantai = panas ?? bangunRantai(new AudioContext({ latencyHint: 'interactive' }));
    } catch {
      return null;
    }
    terapkanPreferensi(preferensi(), true);
    for (const cb of pendengarSiap) cb();
  }
  bangunkan();
  return rantai;
}

/** True kalau bunyi yang dijadwalkan sekarang akan benar-benar terdengar (bukan menumpuk di context tidur). */
export function bisaBersuara(r: Rantai<AudioContext>): boolean {
  return terlihat() && (r.a.state === 'running' || (sedangBangun && performance.now() - mulaiBangun < BATAS_BANGUN_MS));
}

/** Keluaran untuk efek suara (bus efek + gema), dengan pelacak sumber aktif. */
export function keluaranEfek(r: Rantai): Keluaran {
  return { a: r.a, ke: r.busEfek, gema: r.gemaEfek, derau: r.derau, lacak: catatSumber };
}

/** Pelacak jumlah sumber yang sedang berbunyi (untuk diagnostik). */
export function catatSumber(delta: number): void {
  sumberAktif = Math.max(0, sumberAktif + delta);
}

/** Dipanggil sekali saat context pertama kali dibuat (mis. musik yang menunggu sentuhan pertama). */
export function saatMesinSiap(cb: () => void): () => void {
  pendengarSiap.add(cb);
  return () => pendengarSiap.delete(cb);
}

/** Keadaan mesin untuk uji/diagnostik. */
export function diagnostikAudio(): { state: string; sumberAktif: number; waktu: number } {
  return { state: rantai?.a.state ?? 'belum', sumberAktif, waktu: rantai?.a.currentTime ?? 0 };
}

/** Pasang pembuka audio (sentuh/klik/tombol), penidur saat tab tersembunyi, dan pendengar preferensi. Aman dipanggil berkali-kali. */
export function pasangMesinAudio(): void {
  if (terpasang || typeof window === 'undefined') return;
  terpasang = true;
  const buka = () => {
    sudahDisentuh = true;
    const r = mesinAudio();
    if (r) bangunkan(true);
    if (r && !sudahDibuka) {
      sudahDibuka = true;
      bukaJalurIos(r.a);
    }
  };
  // Listener tetap terpasang (murah): iOS kadang perlu "dibuka" lagi setelah aplikasi kembali dari latar.
  for (const jenis of ['pointerdown', 'touchend', 'keydown'] as const) {
    window.addEventListener(jenis, buka, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!rantai) return;
    if (terlihat()) bangunkan();
    else tidurkan(0);
  });
  saatPreferensiBerubah((p) => terapkanPreferensi(p));
  // Pemanasan di waktu senggang setelah halaman dimuat (lihat panaskanAudio).
  const jadwalPanas = () =>
    setTimeout(() => {
      const ric = window.requestIdleCallback?.bind(window);
      if (ric) ric(() => panaskanAudio(), { timeout: 2000 });
      else panaskanAudio();
    }, JEDA_PANAS_MS);
  if (document.readyState === 'complete') jadwalPanas();
  else window.addEventListener('load', jadwalPanas, { once: true });
}
