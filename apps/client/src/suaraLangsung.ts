// Obrolan suara langsung di meja online (0.9.0, keputusan pemilik 25 Nov 2026).
//
// WebRTC mesh antarpemain manusia satu meja (paling banyak 6), audio saja, Opus mono hemat (±24 kbps).
// Meja/server hanya meneruskan sinyal (pesan `suara`/`suaraSinyal` lewat WebSocket yang sama); suaranya
// langsung antar-HP (atau lewat TURN kalau server memasangnya). Tidak ada di meja offline, latihan,
// sprint, maupun untuk penonton; warga kedai tidak punya suara.
//
// Prinsip "game dulu":
// - Pesan suara tidak pernah menahan pesan meja (dikirim lewat koneksi yang sama tanpa antrian/cek cepat,
//   lihat PESAN_SUARA di koneksi.ts) dan galat suara tidak pernah merusak meja (semua ditangkap di sini).
// - Kualitas sinyal diukur (RTT ping/pong + getStats WebRTC). Lemah = bitrate diturunkan; buruk = suara di
//   HP ini dijeda sendiri (tidak kirim, tidak terima) dan nyala lagi sendiri sesudah membaik, dengan
//   histeresis supaya tidak kedip-kedip (PenjagaKualitas, fungsi murni).
//
// Penanda "lagi ngomong" hanya dari tingkat suara (audioLevel RTP dari teman, analyser untuk mic sendiri),
// tidak pernah dari keadaan permainan.
//
// Kerasnya suara teman (0.10.0): suara tiap teman diputar lewat AudioContext bersama (efek/mesinAudio.ts):
// sumber → gain per orang (0 = dibisukan) → busSuara (volume "Volume suara teman", bawaan 200%) →
// kompresor → pembatas. Elemen <audio> tetap dipasang (Chrome tidak mengalirkan suara WebRTC ke Web Audio
// tanpa elemen media) tapi dibisukan. Tanpa Web Audio / context belum jalan: <audio> biasa seperti 0.9.0.
// Selama ada yang ngomong, musik dan seluruh bus efek diredam (pemicunya hanya tingkat suara).

import { kunciNama, type AnggotaSuara, type DataSinyalSuara, type InfoMeja, type PesanServer } from '@remi/meja';
import type { InfoRtt, PesanKeMeja } from './koneksi';
import { TEKS_SUARA } from './konten/suara';
import { pakaiAudioSuara, redamEfek } from './efek/mesinAudio';
import { redamMusik } from './efek/musik';

/** Keadaan ikon mic di kursi seseorang. */
export type KeadaanMic = 'bicara' | 'nyala' | 'mati' | 'lemah';
/** Tingkat suara HP ini menurut kualitas sinyal. */
export type TingkatSuara = 'normal' | 'hemat' | 'jeda';
export type NilaiKualitas = 'baik' | 'lemah' | 'buruk';

export const BITRATE_NORMAL = 24_000;
export const BITRATE_HEMAT = 12_000;
/** Jeda antarpengukuran kualitas. */
export const JEDA_KUALITAS_MS = 2_000;
/** Jeda antarpengukuran tingkat suara (penanda lagi ngomong). */
export const JEDA_LEVEL_MS = 150;
/** Tingkat suara (0..1) yang dianggap ngomong, dan berapa lama penandanya bertahan sesudah diam. */
export const AMBANG_BICARA = 0.03;
export const TAHAN_BICARA_MS = 450;
/** Paling lama menunggu kandidat ICE terkumpul sebelum SDP dikirim. */
export const BATAS_KUMPUL_ICE_MS = 2_500;
/** Percobaan sambung ulang satu teman sebelum menyerah (sampai anggota berubah lagi). */
export const MAKS_GAGAL_PEER = 3;
/**
 * Paling lama penawar menunggu jawaban sesudah tawarannya dikirim. Tawaran bisa hilang di jalan (socket
 * sempat putus, teman sedang dijeda, batas laju meja); tanpa batas ini pasangan itu diam selamanya.
 */
export const BATAS_JAWAB_MS = 10_000;
/** Jawaban server ICE tanpa TURN hanya diingat sebentar (siapa tahu TURN baru boleh sesudah teman masuk). */
export const INGAT_ICE_TANPA_TURN_MS = 60_000;
/** Selama teman ngomong: musik turun ke 0,15, seluruh bus efek ke 0,5, ditahan 0,5 detik lalu pulih. */
export const REDAM_MUSIK_NGOMONG = 0.15;
export const REDAM_EFEK_NGOMONG = 0.5;
export const LAMA_REDAM_NGOMONG = 0.5;

/** Redam musik dan seluruh bus efek (dipanggil berulang selama ada teman yang terdengar ngomong). */
export function redamSaatNgomong(): void {
  redamMusik(REDAM_MUSIK_NGOMONG, LAMA_REDAM_NGOMONG);
  redamEfek(REDAM_EFEK_NGOMONG, LAMA_REDAM_NGOMONG);
}

// ---------------------------------------------------------------------------------------------
// Kualitas sinyal (murni)

export interface SampelKualitas {
  /** RTT terburuk (ms) dari ping/pong WebSocket dan pasangan kandidat ICE yang dipakai. */
  rttMs?: number | null;
  /** Paket hilang (0..1), terburuk di antara teman. */
  hilang?: number | null;
  /** Jitter (ms). */
  jitterMs?: number | null;
  /** Perkiraan bitrate keluar yang tersedia (bit/detik). */
  bitrateKeluar?: number | null;
}

/** Nilai satu sampel: buruk (jeda), lemah (hemat), atau baik. Yang tidak diketahui tidak dihitung. */
export function nilaiSampel(s: SampelKualitas): NilaiKualitas {
  const rtt = s.rttMs ?? 0;
  const hilang = s.hilang ?? 0;
  const jitter = s.jitterMs ?? 0;
  const keluar = s.bitrateKeluar ?? Infinity;
  if (rtt >= 1500 || hilang >= 0.2 || jitter >= 250 || keluar < 16_000) return 'buruk';
  if (rtt >= 600 || hilang >= 0.06 || jitter >= 80 || keluar < 40_000) return 'lemah';
  return 'baik';
}

/**
 * Histeresis tingkat suara. Turun cepat (2 sampel berturut-turut), naik pelan: dari jeda ke hemat butuh
 * 3 sampel tidak buruk, dan tiap kali jeda lagi tak lama kemudian syaratnya dilipatgandakan (3, 6, 12,
 * paling banyak 15 sampel), supaya sinyal yang naik-turun tidak membuat suara nyala-mati terus. Dari hemat
 * ke normal butuh 4 sampel baik. Sesudah 30 sampel normal berturut-turut, hitungan jeda dilupakan.
 */
export class PenjagaKualitas {
  tingkat: TingkatSuara = 'normal';
  private buruk = 0;
  private tidakBaik = 0;
  private tidakBuruk = 0;
  private baik = 0;
  private jedaKe = 0;
  private normalBeruntun = 0;

  /** Syarat sampel tidak buruk berturut-turut untuk keluar dari jeda. */
  get syaratPulih(): number {
    return Math.min(15, 3 * 2 ** Math.max(0, this.jedaKe - 1));
  }

  catat(n: NilaiKualitas): TingkatSuara {
    this.buruk = n === 'buruk' ? this.buruk + 1 : 0;
    this.tidakBaik = n !== 'baik' ? this.tidakBaik + 1 : 0;
    this.tidakBuruk = n !== 'buruk' ? this.tidakBuruk + 1 : 0;
    this.baik = n === 'baik' ? this.baik + 1 : 0;
    const ke = (t: TingkatSuara) => {
      this.tingkat = t;
      this.buruk = this.tidakBaik = this.tidakBuruk = this.baik = 0;
    };
    if (this.tingkat === 'jeda') {
      if (this.tidakBuruk >= this.syaratPulih) ke('hemat');
    } else if (this.buruk >= 2) {
      this.jedaKe++;
      ke('jeda');
    } else if (this.tingkat === 'normal' && this.tidakBaik >= 2) ke('hemat');
    else if (this.tingkat === 'hemat' && this.baik >= 4) ke('normal');
    this.normalBeruntun = this.tingkat === 'normal' ? this.normalBeruntun + 1 : 0;
    if (this.normalBeruntun >= 30) this.jedaKe = 0;
    return this.tingkat;
  }
}

/** Ringkas laporan getStats satu sambungan. `lalu`: hitungan paket sebelumnya (untuk paket hilang). */
export function bacaStatistik(
  laporan: Iterable<Record<string, unknown>>,
  lalu: { hilang: number; terima: number } | null,
): { sampel: SampelKualitas; paket: { hilang: number; terima: number } | null } {
  const sampel: SampelKualitas = {};
  let paket: { hilang: number; terima: number } | null = null;
  const angka = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  for (const r of laporan) {
    if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated === true || r.selected === true)) {
      const rtt = angka(r.currentRoundTripTime);
      if (rtt !== null) sampel.rttMs = Math.max(sampel.rttMs ?? 0, rtt * 1000);
      const keluar = angka(r.availableOutgoingBitrate);
      if (keluar !== null) sampel.bitrateKeluar = keluar;
    } else if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
      const f = angka(r.fractionLost);
      if (f !== null) sampel.hilang = Math.max(sampel.hilang ?? 0, f);
    } else if (r.type === 'inbound-rtp' && r.kind === 'audio') {
      const j = angka(r.jitter);
      if (j !== null) sampel.jitterMs = Math.max(sampel.jitterMs ?? 0, j * 1000);
      const h = angka(r.packetsLost);
      const t = angka(r.packetsReceived);
      if (h !== null && t !== null) {
        paket = { hilang: h, terima: t };
        if (lalu) {
          const dh = h - lalu.hilang;
          const dt = t - lalu.terima;
          if (dh >= 0 && dt >= 0 && dh + dt >= 10) sampel.hilang = Math.max(sampel.hilang ?? 0, dh / (dh + dt));
        }
      }
    }
  }
  return { sampel, paket };
}

/** Gabungkan sampel: yang terburuk dari tiap ukuran. */
export function gabungSampel(daftar: SampelKualitas[]): SampelKualitas {
  const maks = (k: 'rttMs' | 'hilang' | 'jitterMs') => {
    const v = daftar.map((s) => s[k]).filter((x): x is number => typeof x === 'number');
    return v.length ? Math.max(...v) : null;
  };
  const keluar = daftar.map((s) => s.bitrateKeluar).filter((x): x is number => typeof x === 'number');
  return { rttMs: maks('rttMs'), hilang: maks('hilang'), jitterMs: maks('jitterMs'), bitrateKeluar: keluar.length ? Math.min(...keluar) : null };
}

/**
 * SDP Opus mono hemat: maxaveragebitrate, mono, FEC (tahan paket hilang), DTX (diam = hampir tanpa data).
 * Diterapkan ke SDP yang dikirim ke teman (yang menentukan cara ia mengirim ke kita).
 */
export function sdpOpusHemat(sdp: string, bitrate = BITRATE_NORMAL): string {
  const m = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp);
  if (!m) return sdp;
  const pt = m[1];
  const atur: Record<string, string> = { maxaveragebitrate: String(bitrate), stereo: '0', 'sprop-stereo': '0', useinbandfec: '1', usedtx: '1' };
  const baris = sdp.split('\r\n');
  const i = baris.findIndex((b) => b.startsWith(`a=fmtp:${pt} `));
  if (i >= 0) {
    const lama = baris[i]!.slice(`a=fmtp:${pt} `.length).split(';').filter((x) => x && !(x.split('=')[0]! in atur));
    baris[i] = `a=fmtp:${pt} ${[...lama, ...Object.entries(atur).map(([k, v]) => `${k}=${v}`)].join(';')}`;
  } else {
    const r = baris.findIndex((b) => b.startsWith(`a=rtpmap:${pt} `));
    baris.splice(r + 1, 0, `a=fmtp:${pt} ${Object.entries(atur).map(([k, v]) => `${k}=${v}`).join(';')}`);
  }
  return baris.join('\r\n');
}

// ---------------------------------------------------------------------------------------------
// Lingkungan (diganti tiruan di test)

export interface PengukurLevel {
  /** Tingkat suara sekarang, 0..1. */
  level(): number;
  tutup(): void;
}

/** Jalur Web Audio suara satu teman (gain per orang). */
export interface JalurSuara {
  /** Gain orang ini: 1 = biasa, 0 = dibisukan. */
  aturGain(g: number): void;
  /** Putus dan buang semua node (aman dipanggil berkali-kali). */
  tutup(): void;
}

export interface LingkunganSuara {
  getUserMedia(c: MediaStreamConstraints): Promise<MediaStream>;
  buatPeer(c: RTCConfiguration): RTCPeerConnection;
  /** Elemen <audio> untuk suara satu teman (sudah dipasang di dokumen, tersembunyi). */
  buatAudio(): HTMLAudioElement;
  ambilIce(token: string): Promise<{ iceServers: RTCIceServer[]; ttl: number }>;
  /** Pengukur tingkat suara mic sendiri (analyser). Null kalau tidak bisa. */
  ukurLevelLokal(stream: MediaStream): PengukurLevel | null;
  /** Waktu (ms) untuk membandingkan RTCRtpSynchronizationSource.timestamp. */
  sekarang(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
  toast(pesan: string, salah?: boolean): void;
  umumkan(pesan: string): void;
  /** Kecilkan musik dan efek sebentar (ada yang ngomong). */
  redamMusik(): void;
  /**
   * Sambungkan suara teman ke mesin audio (penguat). Null = tidak bisa (tanpa Web Audio, context belum
   * jalan, browser menolak): suara diputar lewat <audio> biasa.
   */
  sambungSuara?(stream: MediaStream): JalurSuara | null;
  /** Mic dibuka (true) atau dilepas (false): sesi audio iOS (navigator.audioSession). */
  aturSesiAudio?(mic: boolean): void;
  /** Pasang pendengar ketukan sekali (memutar suara yang ditahan browser). Mengembalikan pelepas. */
  saatKetuk(fn: () => void): () => void;
}

export interface SambunganSuara {
  kirim(p: PesanKeMeja): void;
  siapKirim(): boolean;
  rtt(): InfoRtt | null;
  ukurRtt(): void;
}

const STUN_CADANGAN: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** Pengukur tingkat suara mic sendiri lewat analyser di context bersama. */
function ukurLevelDiKonteks(stream: MediaStream): PengukurLevel | null {
  const pegang = pakaiAudioSuara();
  if (!pegang) return null;
  try {
    const a = pegang.r.a;
    const sumber = a.createMediaStreamSource(stream);
    const analis = a.createAnalyser();
    analis.fftSize = 512;
    sumber.connect(analis);
    const data = new Float32Array(analis.fftSize);
    let tertutup = false;
    return {
      level: () => {
        analis.getFloatTimeDomainData(data);
        let jumlah = 0;
        for (const x of data) jumlah += x * x;
        // RMS dikalikan supaya setara kira-kira dengan audioLevel RTP (bicara biasa ±0,05–0,3).
        return Math.min(1, Math.sqrt(jumlah / data.length) * 2);
      },
      tutup: () => {
        if (tertutup) return;
        tertutup = true;
        sumber.disconnect();
        analis.disconnect();
        pegang.lepas();
      },
    };
  } catch {
    pegang.lepas();
    return null;
  }
}

/**
 * Suara satu teman lewat context bersama: sumber → gain per orang → busSuara. Hanya kalau context sudah
 * jalan (kalau masih tidur, misalnya iPhone di luar ketukan, suaranya bisa hilang sementara <audio>-nya
 * dibisukan), jadi selain itu null dan pemanggil memakai <audio> biasa.
 */
export function sambungSuaraDiKonteks(stream: MediaStream): JalurSuara | null {
  const pegang = pakaiAudioSuara();
  if (!pegang) return null;
  const a = pegang.r.a;
  if (a.state !== 'running') {
    pegang.lepas();
    return null;
  }
  let sumber: MediaStreamAudioSourceNode;
  let gain: GainNode;
  try {
    sumber = a.createMediaStreamSource(stream);
    gain = a.createGain();
    sumber.connect(gain);
    gain.connect(pegang.r.busSuara);
  } catch {
    pegang.lepas();
    return null;
  }
  let tertutup = false;
  return {
    aturGain: (g) => {
      if (tertutup) return;
      const p = gain.gain;
      const t = a.currentTime;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.setTargetAtTime(g, t, 0.03);
    },
    tutup: () => {
      if (tertutup) return;
      tertutup = true;
      try {
        sumber.disconnect();
        gain.disconnect();
      } catch {
        // sudah terputus
      }
      pegang.lepas();
    },
  };
}

/**
 * iPhone/iPad (Safari 17+): sesi audio 'play-and-record' tepat sebelum mic dibuka, kembali 'auto' sesudah
 * mic dilepas, supaya suara tidak pindah ke speaker kuping. Browser lain tidak punya navigator.audioSession.
 */
export function aturSesiAudioIos(mic: boolean): void {
  try {
    const sesi = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (sesi) sesi.type = mic ? 'play-and-record' : 'auto';
  } catch {
    // Browser menolak: biarkan sesi bawaan.
  }
}

/** Lingkungan browser sungguhan. */
export function lingkunganBrowser(opsi: { toast: LingkunganSuara['toast']; umumkan: LingkunganSuara['umumkan'] }): LingkunganSuara {
  let wadah: HTMLElement | null = null;
  return {
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
    buatPeer: (c) => new RTCPeerConnection(c),
    buatAudio: () => {
      if (!wadah?.isConnected) {
        wadah = document.createElement('div');
        wadah.id = 'suara-teman';
        wadah.hidden = true;
        document.body.appendChild(wadah);
      }
      const a = document.createElement('audio');
      a.autoplay = true;
      a.setAttribute('playsinline', '');
      wadah.appendChild(a);
      return a;
    },
    ambilIce: async (token) => {
      const r = await fetch('/api/suara/ice', { headers: { 'x-token-meja': token }, cache: 'no-store' });
      if (!r.ok) throw new Error(`ice ${r.status}`);
      const isi = (await r.json()) as { iceServers?: RTCIceServer[]; ttl?: number };
      return { iceServers: Array.isArray(isi.iceServers) && isi.iceServers.length ? isi.iceServers : STUN_CADANGAN, ttl: Number(isi.ttl) || 3600 };
    },
    // Pengukur mic memakai context bersama (satu AudioContext untuk seluruh aplikasi; di iOS beberapa
    // context sekaligus rawan bermasalah). Pegangannya menjaga context tetap jalan selama mic nyala.
    ukurLevelLokal: (stream) => ukurLevelDiKonteks(stream),
    sambungSuara: (stream) => sambungSuaraDiKonteks(stream),
    aturSesiAudio: (mic) => aturSesiAudioIos(mic),
    sekarang: () => performance.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    toast: opsi.toast,
    umumkan: opsi.umumkan,
    redamMusik: redamSaatNgomong,
    saatKetuk: (fn) => {
      const f = () => fn();
      document.addEventListener('pointerdown', f, true);
      document.addEventListener('keydown', f, true);
      return () => {
        document.removeEventListener('pointerdown', f, true);
        document.removeEventListener('keydown', f, true);
      };
    },
  };
}

/** Tunggu kandidat ICE terkumpul (SDP lengkap, jadi tidak perlu mengirim kandidat satu-satu). */
function tungguIce(pc: RTCPeerConnection, ms: number, jam: Pick<LingkunganSuara, 'setTimeout' | 'clearTimeout'>): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((ok) => {
    const selesai = () => {
      pc.removeEventListener('icegatheringstatechange', cek);
      jam.clearTimeout(timer);
      ok();
    };
    const cek = () => {
      if (pc.iceGatheringState === 'complete') selesai();
    };
    const timer = jam.setTimeout(selesai, ms);
    pc.addEventListener('icegatheringstatechange', cek);
  });
}

// ---------------------------------------------------------------------------------------------
// Pengelola suara satu aplikasi

interface Peer {
  id: number;
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  penawar: boolean;
  status: 'menyambung' | 'tersambung' | 'gagal';
  /** Kapan terakhir terdengar ngomong (jam lingkungan). */
  keras: number;
  paket: { hilang: number; terima: number } | null;
  /** Penawar: timer batas menunggu jawaban (BATAS_JAWAB_MS). */
  timerJawab: unknown;
  /** Jalur Web Audio (penguat); null = diputar lewat <audio> biasa. */
  jalur: JalurSuara | null;
  /** Dibisukan di HP ini (Dengar suara mati, atau Bisukan orang ini). */
  bisu: boolean;
}

export interface OrangSuara {
  id: number;
  kursi: number;
  nama: string;
  keadaan: KeadaanMic;
  /** Dibisukan di HP ini. */
  bisu: boolean;
  sambungan: 'menyambung' | 'tersambung' | 'gagal' | null;
}

export type KeadaanTombolMic = 'mati' | 'minta' | 'nyala';

export class SuaraLangsung {
  private kode: string | null = null;
  private token: string | null = null;
  /** Meja sekarang boleh pakai suara (online, duduk, bukan sprint/penonton). */
  private boleh = false;
  /** Sesudah 'masuk': kirim gabung begitu info meja datang. */
  private perluGabung = false;
  private idSaya: number | null = null;
  private anggota: AnggotaSuara[] = [];
  private namaKursi: string[] = [];
  private micDiminta = false;
  private memintaIzin = false;
  private dengar = true;
  private bisu = new Set<string>();
  private stream: MediaStream | null = null;
  private pengukur: PengukurLevel | null = null;
  private kerasSaya = -Infinity;
  private peers = new Map<number, Peer>();
  private penjaga = new PenjagaKualitas();
  private bicara = new Set<number>();
  private bicaraSaya = false;
  private pendengar = new Set<() => void>();
  private timerLevel: unknown = null;
  private timerKualitas: unknown = null;
  private ice: { servers: RTCIceServer[]; sampai: number; token: string } | null = null;
  private perluKetuk = false;
  private lepasKetuk: (() => void) | null = null;
  /** Naik tiap meja/anggota dibersihkan: kerja async lama (getUserMedia, ICE) yang selesai belakangan dibuang. */
  private generasi = 0;
  private gagal = new Map<number, number>();
  /** Tawaran yang sedang disiapkan (async): jangan menawarkan dua kali ke teman yang sama. */
  private menawar = new Set<number>();
  private timerUlang = new Map<number, unknown>();
  /** Hitungan pong RTT yang sudah dipakai penilai kualitas (satu pong = satu sampel). */
  private pongDipakai = -1;

  constructor(
    private readonly env: LingkunganSuara,
    private readonly sambungan: () => SambunganSuara | null,
  ) {}

  // ---------- keadaan untuk UI ----------

  /** Suara bisa dipakai di meja ini (tombol ditampilkan). */
  get tersedia(): boolean {
    return this.boleh;
  }

  /** Sudah tercatat anggota suara meja ini. */
  get ikut(): boolean {
    return this.boleh && this.idSaya !== null;
  }

  get tombolMic(): KeadaanTombolMic {
    if (this.memintaIzin) return 'minta';
    return this.micDiminta && this.stream ? 'nyala' : 'mati';
  }

  get dengarNyala(): boolean {
    return this.dengar;
  }

  get tingkat(): TingkatSuara {
    return this.penjaga.tingkat;
  }

  get bicaraSendiri(): boolean {
    return this.bicaraSaya;
  }

  get menungguKetuk(): boolean {
    return this.perluKetuk;
  }

  /** Keadaan ikon mic kursi `i` (null = tidak ikut suara: warga kedai, kosong, aplikasi lama). */
  keadaanKursi(i: number): KeadaanMic | null {
    if (!this.boleh) return null;
    const a = this.anggota.find((x) => x.kursi === i);
    if (!a) return null;
    if (a.id === this.idSaya) {
      if (this.penjaga.tingkat === 'jeda') return 'lemah';
      if (this.tombolMic !== 'nyala') return 'mati';
      return this.bicaraSaya ? 'bicara' : 'nyala';
    }
    if (a.jeda) return 'lemah';
    if (!a.mic) return 'mati';
    return this.bicara.has(a.id) ? 'bicara' : 'nyala';
  }

  /** Teman lain yang ikut suara, urut kursi (untuk lembar Suara). */
  daftarOrang(): OrangSuara[] {
    if (!this.boleh) return [];
    return this.anggota
      .filter((a) => a.id !== this.idSaya)
      .map((a) => {
        const nama = this.namaKursi[a.kursi] ?? '';
        return {
          id: a.id,
          kursi: a.kursi,
          nama,
          keadaan: this.keadaanKursi(a.kursi) ?? 'mati',
          bisu: this.bisu.has(kunciNama(nama)),
          sambungan: this.peers.get(a.id)?.status ?? null,
        };
      });
  }

  /** Dengarkan perubahan keadaan (anggota, mic, ngomong, kualitas). Mengembalikan pelepas. */
  dengarkan(fn: () => void): () => void {
    this.pendengar.add(fn);
    return () => this.pendengar.delete(fn);
  }

  private kabari(): void {
    for (const fn of [...this.pendengar]) {
      try {
        fn();
      } catch (e) {
        console.error('galat pendengar suara', e);
      }
    }
  }

  // ---------- dari aplikasi ----------

  /** Pesan 'masuk' dari meja online: meja lain = semua suara lama dibersihkan, lalu gabung lagi. */
  masukMeja(kode: string, token: string): void {
    if (this.kode !== kode) this.bersihkan();
    else {
      // Sambung ulang ke meja yang sama: sambungan teman yang sudah jalan dibiarkan (suaranya langsung antar-HP),
      // yang belum tersambung dibuang supaya ditawarkan ulang (sinyalnya mungkin hilang selama putus), dan
      // hitungan gagal diulang dari nol.
      for (const [id, p] of [...this.peers]) if (p.status !== 'tersambung') this.tutupPeer(id);
      for (const t of this.timerUlang.values()) this.env.clearTimeout(t);
      this.timerUlang.clear();
      this.gagal.clear();
    }
    this.kode = kode;
    this.token = token;
    this.perluGabung = true;
  }

  /** Info meja baru. `online`/`penonton` dari aplikasi; suara hanya untuk pemain di meja online biasa. */
  aturInfo(info: InfoMeja | null, opsi: { online: boolean; penonton: boolean }): void {
    const boleh = !!info && opsi.online && !opsi.penonton && info.kursiSaya !== null && !info.sprint && this.kode === info.kode;
    if (!boleh) {
      if (this.boleh) this.bersihkan();
      return;
    }
    this.namaKursi = info.kursi.map((k) => (k.jenis === 'manusia' ? k.nama : ''));
    const baru = !this.boleh;
    this.boleh = true;
    if (this.perluGabung) {
      const s = this.sambungan();
      if (s?.siapKirim()) {
        this.perluGabung = false;
        // Keadaan mic dan jeda selalu dikirim lengkap: perubahan selama putus (pesannya dibuang) ikut terbawa.
        s.kirim({ t: 'suara', aksi: 'gabung', nyala: this.tombolMic === 'nyala', ...(this.penjaga.tingkat === 'jeda' ? { jeda: true } : {}) });
      }
    }
    this.mulaiTimer();
    if (baru) this.kabari();
  }

  /** Pesan meja untuk suara. True kalau pesannya milik suara. */
  terimaPesan(p: PesanServer | { t: string }): boolean {
    try {
      if (p.t === 'suara') {
        const x = p as Extract<PesanServer, { t: 'suara' }>;
        this.aturAnggota(x.saya, x.anggota);
        return true;
      }
      if (p.t === 'suaraSinyal') {
        const x = p as Extract<PesanServer, { t: 'suaraSinyal' }>;
        void this.terimaSinyal(x.dari, x.data).catch((e) => console.error('galat sinyal suara', e));
        return true;
      }
    } catch (e) {
      console.error('galat suara', e);
      return true;
    }
    return false;
  }

  /** Tinggalkan suara (keluar meja, pindah meja, ke beranda, halaman ditutup). */
  hentikan(): void {
    const s = this.sambungan();
    if (this.idSaya !== null && s?.siapKirim()) s.kirim({ t: 'suara', aksi: 'keluar' });
    this.bersihkan();
  }

  /** Bersihkan semua: peer, mic, timer. Mic selalu mati lagi di meja berikutnya. */
  private bersihkan(): void {
    this.generasi++;
    for (const id of [...this.peers.keys()]) this.tutupPeer(id);
    for (const t of this.timerUlang.values()) this.env.clearTimeout(t);
    this.timerUlang.clear();
    this.gagal.clear();
    this.menawar.clear();
    this.matikanStream();
    this.micDiminta = false;
    this.memintaIzin = false;
    this.boleh = false;
    this.perluGabung = false;
    this.idSaya = null;
    this.anggota = [];
    this.namaKursi = [];
    this.kode = null;
    this.token = null;
    this.bisu.clear();
    this.bicara.clear();
    this.bicaraSaya = false;
    this.penjaga = new PenjagaKualitas();
    this.perluKetuk = false;
    this.lepasKetuk?.();
    this.lepasKetuk = null;
    if (this.timerLevel !== null) this.env.clearInterval(this.timerLevel);
    if (this.timerKualitas !== null) this.env.clearInterval(this.timerKualitas);
    this.timerLevel = this.timerKualitas = null;
    this.pongDipakai = -1;
    this.kabari();
  }

  // ---------- tombol ----------

  /** Tombol mic (dipanggil langsung dari ketukan: iPhone hanya mengizinkan mic dari gestur). */
  async ketukMic(): Promise<void> {
    if (!this.boleh || this.memintaIzin) return;
    if (this.tombolMic === 'nyala') return this.matikanMic();
    const gen = this.generasi;
    this.memintaIzin = true;
    this.kabari();
    let stream: MediaStream;
    this.env.aturSesiAudio?.(true);
    try {
      stream = await this.env.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
    } catch (e) {
      if (!this.stream) this.env.aturSesiAudio?.(false);
      if (gen !== this.generasi) return;
      this.memintaIzin = false;
      const nama = (e as { name?: string })?.name;
      this.env.toast(nama === 'NotFoundError' || nama === 'OverconstrainedError' ? TEKS_SUARA.tanpaMic : TEKS_SUARA.izinDitolak, true);
      this.kabari();
      return;
    }
    if (gen !== this.generasi || !this.boleh) {
      stream.getTracks().forEach((t) => t.stop());
      if (!this.stream) this.env.aturSesiAudio?.(false);
      return;
    }
    this.memintaIzin = false;
    this.stream = stream;
    this.micDiminta = true;
    const track = stream.getAudioTracks()[0];
    if (track) track.addEventListener('ended', () => this.stream === stream && this.matikanMic());
    this.pengukur = this.env.ukurLevelLokal(stream);
    this.pasangTrackKeSemua();
    this.sambungan()?.kirim({ t: 'suara', aksi: 'mic', nyala: true });
    this.rukunkan();
    this.kabari();
  }

  private matikanMic(): void {
    this.micDiminta = false;
    this.matikanStream();
    this.pasangTrackKeSemua();
    if (this.idSaya !== null) this.sambungan()?.kirim({ t: 'suara', aksi: 'mic', nyala: false });
    this.kabari();
  }

  private matikanStream(): void {
    this.pengukur?.tutup();
    this.pengukur = null;
    const ada = !!this.stream;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.bicaraSaya = false;
    if (ada) this.env.aturSesiAudio?.(false);
  }

  /** "Dengar suara": mati = semua suara teman dibisukan di HP ini saja. */
  aturDengar(nyala: boolean): void {
    this.dengar = nyala;
    this.terapkanBisu();
    this.kabari();
  }

  /** Bisukan/bunyikan satu teman di HP ini saja (diingat per nama selama di meja ini). */
  aturBisu(nama: string, bisu: boolean): void {
    const k = kunciNama(nama);
    if (bisu) this.bisu.add(k);
    else this.bisu.delete(k);
    this.terapkanBisu();
    this.kabari();
  }

  /** Coba putar lagi suara yang ditahan browser (harus dari ketukan). */
  ketukPutar(): void {
    if (!this.perluKetuk) return;
    this.perluKetuk = false;
    this.lepasKetuk?.();
    this.lepasKetuk = null;
    for (const p of this.peers.values()) this.putar(p);
    this.kabari();
  }

  // ---------- anggota dan peer ----------

  private aturAnggota(saya: number | null, anggota: AnggotaSuara[]): void {
    if (!this.boleh) return;
    // Id sendiri berganti (sempat dikeluarkan server, mis. putus lama): semua sambungan lama basi.
    if (this.idSaya !== null && saya !== this.idSaya) for (const id of [...this.peers.keys()]) this.tutupPeer(id);
    this.idSaya = saya;
    // Teman yang baru lepas dari jeda boleh dicoba lagi dari nol.
    for (const a of anggota) if (!a.jeda && this.anggota.find((x) => x.id === a.id)?.jeda) this.gagal.delete(a.id);
    this.anggota = anggota.map((a) => ({ ...a }));
    this.rukunkan();
    this.kabari();
  }

  /** Teman `a` perlu disambung: salah satu mic nyala, tidak ada yang dijeda. */
  private perlu(a: AnggotaSuara): boolean {
    return (this.tombolMic === 'nyala' || a.mic) && !a.jeda && this.penjaga.tingkat !== 'jeda';
  }

  /** Samakan peer dengan anggota: tutup yang tidak perlu, tawarkan ke yang perlu (id lebih kecil = penawar). */
  private rukunkan(): void {
    const saya = this.idSaya;
    const ada = new Map(this.anggota.map((a) => [a.id, a]));
    for (const id of [...this.peers.keys()]) {
      const a = ada.get(id);
      if (saya === null || !a || a.jeda || this.penjaga.tingkat === 'jeda') this.tutupPeer(id);
    }
    for (const id of [...this.gagal.keys()]) if (!ada.has(id)) this.gagal.delete(id);
    if (saya === null) return;
    for (const a of this.anggota) {
      if (a.id === saya || this.peers.has(a.id) || this.menawar.has(a.id) || !this.perlu(a) || saya > a.id) continue;
      if ((this.gagal.get(a.id) ?? 0) >= MAKS_GAGAL_PEER || this.timerUlang.has(a.id)) continue;
      this.menawar.add(a.id);
      void this.tawarkan(a.id)
        .catch((e) => {
          console.error('galat menawarkan suara', e);
          this.tutupPeer(a.id);
        })
        .finally(() => this.menawar.delete(a.id));
    }
    this.terapkanBisu();
  }

  private async serverIce(): Promise<RTCIceServer[]> {
    const token = this.token ?? '';
    const sekarang = Date.now();
    if (this.ice && this.ice.token === token && this.ice.sampai > sekarang) return this.ice.servers;
    try {
      const r = await this.env.ambilIce(token);
      // Diminta lagi sebelum setengah umur kredensialnya habis.
      const adaTurn = r.iceServers.some((x) => (Array.isArray(x.urls) ? x.urls : [x.urls]).some((u) => /^turns?:/i.test(u)));
      this.ice = { servers: r.iceServers, sampai: sekarang + (adaTurn ? Math.max(60, r.ttl / 2) * 1000 : INGAT_ICE_TANPA_TURN_MS), token };
      return r.iceServers;
    } catch {
      return STUN_CADANGAN;
    }
  }

  private async buatPeerUntuk(id: number, penawar: boolean): Promise<Peer | null> {
    const gen = this.generasi;
    const servers = await this.serverIce();
    if (gen !== this.generasi || !this.boleh) return null;
    this.tutupPeer(id);
    const pc = this.env.buatPeer({ iceServers: servers, bundlePolicy: 'max-bundle' });
    const audio = this.env.buatAudio();
    const peer: Peer = { id, pc, audio, penawar, status: 'menyambung', keras: -Infinity, paket: null, timerJawab: null, jalur: null, bisu: false };
    this.peers.set(id, peer);
    pc.addEventListener('track', (e) => {
      const ev = e as RTCTrackEvent;
      if (this.peers.get(id) !== peer) return;
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      // <audio> tetap diberi stream (tanpa itu Chrome tidak mengalirkan suara WebRTC ke Web Audio).
      audio.srcObject = stream;
      peer.jalur?.tutup();
      peer.jalur = null;
      try {
        peer.jalur = this.env.sambungSuara?.(stream) ?? null;
      } catch (err) {
        console.error('galat jalur suara', err);
      }
      this.terapkanBisu();
      this.putar(peer);
    });
    pc.addEventListener('connectionstatechange', () => this.saatStatusPeer(peer));
    return peer;
  }

  private saatStatusPeer(peer: Peer): void {
    if (this.peers.get(peer.id) !== peer) return;
    const s = peer.pc.connectionState;
    if (s === 'connected') {
      peer.status = 'tersambung';
      this.gagal.delete(peer.id);
      void this.aturBitrate(peer);
    } else if (s === 'failed') {
      return this.gagalPeer(peer);
    } else if (s === 'closed') return;
    this.kabari();
  }

  /**
   * Sambungan ke satu teman gagal (ICE gagal, tawaran tidak terkirim, atau tidak dijawab): tutup, lalu
   * penawar mencoba lagi (sambungan baru) dengan jeda makin panjang; penjawab menunggu tawaran baru.
   */
  private gagalPeer(peer: Peer): void {
    if (this.peers.get(peer.id) !== peer) return;
    peer.status = 'gagal';
    const kali = (this.gagal.get(peer.id) ?? 0) + 1;
    this.gagal.set(peer.id, kali);
    this.tutupPeer(peer.id, true);
    if (peer.penawar && kali < MAKS_GAGAL_PEER) {
      const t = this.env.setTimeout(() => {
        this.timerUlang.delete(peer.id);
        this.rukunkan();
      }, 1500 * kali);
      this.timerUlang.set(peer.id, t);
    }
    this.kabari();
  }

  private async tawarkan(id: number): Promise<void> {
    const peer = await this.buatPeerUntuk(id, true);
    if (!peer) return;
    const tr = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
    await tr.sender.replaceTrack(this.trackKirim());
    const offer = await peer.pc.createOffer();
    if (this.peers.get(id) !== peer) return;
    await peer.pc.setLocalDescription(offer);
    await tungguIce(peer.pc, BATAS_KUMPUL_ICE_MS, this.env);
    if (this.peers.get(id) !== peer || !peer.pc.localDescription) return;
    if (!this.kirimSinyal(id, { sdp: { type: 'offer', sdp: sdpOpusHemat(peer.pc.localDescription.sdp) } })) return this.gagalPeer(peer);
    peer.timerJawab = this.env.setTimeout(() => {
      peer.timerJawab = null;
      if (this.peers.get(id) === peer && peer.pc.signalingState === 'have-local-offer') this.gagalPeer(peer);
    }, BATAS_JAWAB_MS);
  }

  private async terimaSinyal(dari: number, data: DataSinyalSuara): Promise<void> {
    if (!this.boleh || this.idSaya === null || this.penjaga.tingkat === 'jeda') return;
    if ('kandidat' in data) {
      const p = this.peers.get(dari);
      await p?.pc.addIceCandidate(data.kandidat).catch(() => undefined);
      return;
    }
    if (data.sdp.type === 'answer') {
      const p = this.peers.get(dari);
      if (!p?.penawar || p.pc.signalingState !== 'have-local-offer') return;
      if (p.timerJawab !== null) this.env.clearTimeout(p.timerJawab);
      p.timerJawab = null;
      await p.pc.setRemoteDescription(data.sdp);
      return;
    }
    // Tawaran: hanya dari id yang lebih kecil (aturan penawar), supaya tidak ada tabrakan tawaran, dan hanya
    // dari anggota yang memang perlu disambung (salah satu mic nyala, tidak ada yang dijeda). Jawaban memuat
    // alamat IP HP ini, jadi tawaran dari teman yang mic-nya mati (dan mic sendiri mati) tidak dijawab.
    if (dari > this.idSaya) return;
    const pengirim = this.anggota.find((a) => a.id === dari);
    if (!pengirim || !this.perlu(pengirim)) return;
    const peer = await this.buatPeerUntuk(dari, false);
    if (!peer) return;
    await peer.pc.setRemoteDescription(data.sdp);
    const tr = peer.pc.getTransceivers()[0];
    if (tr) {
      tr.direction = 'sendrecv';
      await tr.sender.replaceTrack(this.trackKirim());
    }
    const answer = await peer.pc.createAnswer();
    if (this.peers.get(dari) !== peer) return;
    await peer.pc.setLocalDescription(answer);
    await tungguIce(peer.pc, BATAS_KUMPUL_ICE_MS, this.env);
    if (this.peers.get(dari) !== peer || !peer.pc.localDescription) return;
    this.kirimSinyal(dari, { sdp: { type: 'answer', sdp: sdpOpusHemat(peer.pc.localDescription.sdp) } });
  }

  /** Kirim sinyal ke teman; false kalau tidak bisa dikirim sekarang (socket putus). */
  private kirimSinyal(ke: number, data: DataSinyalSuara): boolean {
    const s = this.sambungan();
    if (!s?.siapKirim()) return false;
    s.kirim({ t: 'suaraSinyal', ke, data });
    return true;
  }

  private tutupPeer(id: number, simpanGagal = false): void {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    this.bicara.delete(id);
    if (p.timerJawab !== null) this.env.clearTimeout(p.timerJawab);
    p.timerJawab = null;
    try {
      p.pc.close();
    } catch {
      // sudah tertutup
    }
    p.jalur?.tutup();
    p.jalur = null;
    p.audio.pause?.();
    p.audio.srcObject = null;
    p.audio.remove();
    if (!simpanGagal) {
      const t = this.timerUlang.get(id);
      if (t !== undefined) this.env.clearTimeout(t);
      this.timerUlang.delete(id);
    }
  }

  /** Track yang dikirim sekarang: mic kalau nyala dan suara tidak dijeda. */
  private trackKirim(): MediaStreamTrack | null {
    if (this.tombolMic !== 'nyala' || this.penjaga.tingkat === 'jeda') return null;
    return this.stream?.getAudioTracks()[0] ?? null;
  }

  private pasangTrackKeSemua(): void {
    const track = this.trackKirim();
    for (const p of this.peers.values()) {
      for (const s of p.pc.getSenders()) void s.replaceTrack(track).catch(() => undefined);
    }
  }

  private async aturBitrate(p: Peer): Promise<void> {
    const bitrate = this.penjaga.tingkat === 'hemat' ? BITRATE_HEMAT : BITRATE_NORMAL;
    for (const s of p.pc.getSenders()) {
      try {
        const param = s.getParameters();
        if (!param.encodings?.length) param.encodings = [{}];
        param.encodings[0]!.maxBitrate = bitrate;
        await s.setParameters(param);
      } catch {
        // Belum siap dinegosiasi / browser tanpa dukungan: biarkan bitrate dari SDP.
      }
    }
  }

  private terapkanBisu(): void {
    const nama = new Map(this.anggota.map((a) => [a.id, kunciNama(this.namaKursi[a.kursi] ?? '')]));
    for (const p of this.peers.values()) {
      p.bisu = !this.dengar || this.bisu.has(nama.get(p.id) ?? '');
      if (p.jalur) {
        // Jalur penguat: <audio> selalu bisu (supaya tidak terdengar dobel), bisukan lewat gain.
        p.audio.muted = true;
        p.jalur.aturGain(p.bisu ? 0 : 1);
      } else p.audio.muted = p.bisu;
    }
  }

  private putar(p: Peer): void {
    const hasil = p.audio.play?.();
    if (hasil && typeof hasil.catch === 'function') {
      hasil.catch(() => {
        if (this.perluKetuk || !this.peers.has(p.id)) return;
        // Browser menahan putar suara sampai ada ketukan (iPhone, autoplay): ketukan apa pun memutarnya.
        this.perluKetuk = true;
        this.lepasKetuk = this.env.saatKetuk(() => this.ketukPutar());
        this.env.toast(TEKS_SUARA.ketuk);
        this.kabari();
      });
    }
  }

  // ---------- pengukuran ----------

  private mulaiTimer(): void {
    if (this.timerLevel === null) this.timerLevel = this.env.setInterval(() => this.ukurLevel(), JEDA_LEVEL_MS);
    if (this.timerKualitas === null) this.timerKualitas = this.env.setInterval(() => void this.ukurKualitas(), JEDA_KUALITAS_MS);
  }

  /** Penanda lagi ngomong: hanya dari tingkat suara yang benar-benar terdengar. */
  ukurLevel(): void {
    try {
      const kini = this.env.sekarang();
      let berubah = false;
      let adaYangNgomong = false;
      for (const p of this.peers.values()) {
        const r = p.pc.getReceivers?.()[0];
        const src = r?.getSynchronizationSources?.()[0];
        // Sumber yang lama tidak memutar paket (DTX, diam) tidak dihitung.
        // Jam timestamp beda-beda antarbrowser (performance.now() atau epoch): yang mana pun yang dekat.
        const umur = src ? Math.min(Math.abs(kini - src.timestamp), Math.abs(Date.now() - src.timestamp)) : Infinity;
        const level = src && umur < 1000 ? (src.audioLevel ?? 0) : 0;
        if (level >= AMBANG_BICARA) p.keras = kini;
        const ngomong = kini - p.keras < TAHAN_BICARA_MS;
        if (ngomong !== this.bicara.has(p.id)) {
          berubah = true;
          if (ngomong) this.bicara.add(p.id);
          else this.bicara.delete(p.id);
        }
        if (ngomong && !p.bisu) adaYangNgomong = true;
      }
      const levelSaya = this.trackKirim() && this.pengukur ? this.pengukur.level() : 0;
      if (levelSaya >= AMBANG_BICARA) this.kerasSaya = kini;
      const sayaNgomong = !!this.trackKirim() && kini - this.kerasSaya < TAHAN_BICARA_MS;
      if (sayaNgomong !== this.bicaraSaya) {
        this.bicaraSaya = sayaNgomong;
        berubah = true;
      }
      if (adaYangNgomong) this.env.redamMusik();
      if (berubah) this.kabari();
    } catch (e) {
      console.error('galat ukur suara', e);
    }
  }

  /** Satu sampel kualitas (dipanggil tiap JEDA_KUALITAS_MS). */
  async ukurKualitas(): Promise<void> {
    if (!this.boleh || this.idSaya === null) return;
    const s = this.sambungan();
    const sampel: SampelKualitas[] = [{ rttMs: this.rttBaru(s) }];
    if (this.penjaga.tingkat === 'jeda') {
      // Selama dijeda tidak ada paket suara: ukur lewat ping saja, lebih sering.
      s?.ukurRtt();
    } else {
      for (const p of [...this.peers.values()]) {
        if (p.status !== 'tersambung') continue;
        try {
          const laporan = await p.pc.getStats();
          const isi: Record<string, unknown>[] = [];
          laporan.forEach((r: Record<string, unknown>) => isi.push(r));
          const h = bacaStatistik(isi, p.paket);
          p.paket = h.paket;
          sampel.push(h.sampel);
        } catch {
          // Peer sudah ditutup di tengah jalan.
        }
      }
    }
    if (!this.boleh) return;
    const gabung = gabungSampel(sampel);
    // Tanpa pengukuran baru sama sekali (tidak ada pong baru, tidak ada teman tersambung): bukan sampel.
    if (Object.values(gabung).every((x) => x === null || x === undefined)) return;
    const sebelum = this.penjaga.tingkat;
    const sesudah = this.penjaga.catat(nilaiSampel(gabung));
    if (sesudah !== sebelum) this.terapkanTingkat(sebelum, sesudah);
  }

  /**
   * RTT WebSocket untuk satu sampel: hanya kalau ada pong baru sejak sampel sebelumnya (ping biasa hanya
   * tiap 10 detik; satu pengukuran tidak boleh dihitung jadi beberapa sampel buruk). Selama dijeda (ping
   * dikirim tiap sampel), ping yang belum dijawab sampai sampel berikutnya dihitung sebagai RTT sepanjang
   * umurnya, supaya jaringan yang mati tidak dianggap pulih.
   */
  private rttBaru(s: SambunganSuara | null): number | null {
    const r = s?.rtt() ?? null;
    if (!r) return null;
    let ms: number | null = null;
    if (r.ke !== this.pongDipakai) {
      this.pongDipakai = r.ke;
      ms = r.ms;
    }
    if (this.penjaga.tingkat === 'jeda' && r.tungguMs !== null && r.tungguMs >= JEDA_KUALITAS_MS * 0.75) ms = Math.max(ms ?? 0, r.tungguMs);
    return ms;
  }

  private terapkanTingkat(sebelum: TingkatSuara, sesudah: TingkatSuara): void {
    const s = this.sambungan();
    if (sesudah === 'jeda') {
      for (const id of [...this.peers.keys()]) this.tutupPeer(id);
      this.bicara.clear();
      this.bicaraSaya = false;
      if (s?.siapKirim()) s.kirim({ t: 'suara', aksi: 'jeda', nyala: true });
      this.env.umumkan(TEKS_SUARA.lemah);
    } else if (sebelum === 'jeda') {
      this.gagal.clear();
      if (s?.siapKirim()) s.kirim({ t: 'suara', aksi: 'jeda', nyala: false });
      this.env.umumkan(TEKS_SUARA.pulih);
      this.rukunkan();
    } else {
      for (const p of this.peers.values()) void this.aturBitrate(p);
    }
    this.kabari();
  }
}
