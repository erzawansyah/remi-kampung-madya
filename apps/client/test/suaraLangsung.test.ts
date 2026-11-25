// Obrolan suara (0.9.0): pengelola SuaraLangsung dengan RTCPeerConnection/getUserMedia tiruan, disambung ke
// Meja sungguhan (@remi/meja) sebagai jalur sinyal. Mic mati tiap masuk meja, izin ditolak, Dengar suara,
// bisukan per orang, penanda ngomong dari tingkat suara, jeda/pulih karena sinyal (histeresis), dan
// bersih-bersih saat keluar.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Meja, type PesanKlien, type PesanServer } from '@remi/meja';
import {
  bacaStatistik,
  BITRATE_HEMAT,
  BITRATE_NORMAL,
  gabungSampel,
  nilaiSampel,
  PenjagaKualitas,
  sdpOpusHemat,
  SuaraLangsung,
  type LingkunganSuara,
  type NilaiKualitas,
} from '../src/suaraLangsung';
import { TEKS_SUARA } from '../src/konten/suara';

// ---------------------------------------------------------------------------------------------
// Tiruan WebRTC

const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\n';

class TrackPalsu {
  kind = 'audio';
  berhenti = false;
  private akhir: (() => void)[] = [];
  stop() {
    this.berhenti = true;
  }
  addEventListener(n: string, f: () => void) {
    if (n === 'ended') this.akhir.push(f);
  }
  selesai() {
    this.akhir.forEach((f) => f());
  }
}

class StreamPalsu {
  constructor(readonly trek: TrackPalsu[]) {}
  getTracks() {
    return this.trek;
  }
  getAudioTracks() {
    return this.trek;
  }
}

class SenderPalsu {
  track: unknown = null;
  param: { encodings: { maxBitrate?: number }[] } = { encodings: [{}] };
  async replaceTrack(t: unknown) {
    this.track = t;
  }
  getParameters() {
    return { encodings: this.param.encodings.map((e) => ({ ...e })) };
  }
  async setParameters(p: { encodings: { maxBitrate?: number }[] }) {
    this.param = p;
  }
}

class ReceiverPalsu {
  level = 0;
  waktu = -Infinity;
  getSynchronizationSources() {
    return this.waktu === -Infinity ? [] : [{ audioLevel: this.level, timestamp: this.waktu }];
  }
}

class PeerPalsu extends EventTarget {
  static semua: PeerPalsu[] = [];
  tr: { direction: string; sender: SenderPalsu; receiver: ReceiverPalsu }[] = [];
  localDescription: { type: string; sdp: string } | null = null;
  remoteDescription: { type: string; sdp: string } | null = null;
  signalingState = 'stable';
  connectionState = 'new';
  iceGatheringState = 'complete';
  ditutup = false;
  stats: Record<string, unknown>[] = [];
  constructor(readonly config: RTCConfiguration) {
    super();
    PeerPalsu.semua.push(this);
  }
  addTransceiver(_k: string, init: { direction: string }) {
    const t = { direction: init.direction, sender: new SenderPalsu(), receiver: new ReceiverPalsu() };
    this.tr.push(t);
    return t;
  }
  getTransceivers() {
    return this.tr;
  }
  getSenders() {
    return this.tr.map((t) => t.sender);
  }
  getReceivers() {
    return this.tr.map((t) => t.receiver);
  }
  async createOffer() {
    return { type: 'offer', sdp: SDP };
  }
  async createAnswer() {
    return { type: 'answer', sdp: SDP };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
    this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    this.remoteDescription = d;
    if (d.type === 'offer') {
      if (!this.tr.length) this.addTransceiver('audio', { direction: 'recvonly' });
      this.signalingState = 'have-remote-offer';
    } else this.signalingState = 'stable';
    const e = Object.assign(new Event('track'), { track: {}, streams: [new StreamPalsu([])] });
    queueMicrotask(() => this.dispatchEvent(e));
  }
  sambung(state = 'connected') {
    this.connectionState = state;
    this.dispatchEvent(new Event('connectionstatechange'));
  }
  close() {
    this.ditutup = true;
    this.connectionState = 'closed';
  }
  async getStats() {
    return new Map(this.stats.map((r, i) => [String(i), r]));
  }
  async addIceCandidate() {}
}

interface AudioPalsu {
  muted: boolean;
  srcObject: unknown;
  dibuang: boolean;
  diputar: number;
  play: () => Promise<void>;
  pause: () => void;
  remove: () => void;
}

// ---------------------------------------------------------------------------------------------
// Dua (atau tiga) HP di satu Meja sungguhan

let jam = 10_000;
let levelLokal = 0;

function hp(meja: Meja, pemainId: string, antrian: [string, PesanServer][], ubah: Partial<LingkunganSuara> = {}) {
  const audio: AudioPalsu[] = [];
  const toast = vi.fn();
  const umumkan = vi.fn();
  const redamMusik = vi.fn();
  /** Timer yang masih menunggu (clearTimeout membuangnya). */
  const timerMap = new Map<number, () => void>();
  let nomorTimer = 0;
  const terkirim: PesanKlien[] = [];
  /** RTT WebSocket tiruan: `ke` naik tiap pong baru. */
  const rtt = { ms: 50 as number | null, ke: 0, tungguMs: null as number | null };
  // Ping yang dikirim selama jeda langsung dijawab (pong baru dengan RTT yang sedang berlaku).
  const ukurRtt = vi.fn(() => {
    rtt.ke++;
  });
  let ketuk: (() => void) | null = null;
  const peers: PeerPalsu[] = [];
  const env: LingkunganSuara = {
    getUserMedia: vi.fn(async () => new StreamPalsu([new TrackPalsu()]) as unknown as MediaStream),
    buatPeer: (c) => {
      const p = new PeerPalsu(c);
      peers.push(p);
      return p as unknown as RTCPeerConnection;
    },
    buatAudio: () => {
      const a: AudioPalsu = {
        muted: false,
        srcObject: null,
        dibuang: false,
        diputar: 0,
        play() {
          a.diputar++;
          return Promise.resolve();
        },
        pause() {},
        remove() {
          a.dibuang = true;
        },
      };
      audio.push(a);
      return a as unknown as HTMLAudioElement;
    },
    ambilIce: vi.fn(async () => ({ iceServers: [{ urls: 'stun:stun.contoh:3478' }], ttl: 3600 })),
    ukurLevelLokal: () => ({ level: () => levelLokal, tutup: () => undefined }),
    sekarang: () => jam,
    setInterval: () => 1,
    clearInterval: () => undefined,
    setTimeout: (fn) => {
      const id = ++nomorTimer;
      timerMap.set(id, () => {
        timerMap.delete(id);
        fn();
      });
      return id;
    },
    clearTimeout: (h) => {
      timerMap.delete(h as number);
    },
    toast,
    umumkan,
    redamMusik,
    saatKetuk: (fn) => {
      ketuk = fn;
      return () => {
        ketuk = null;
      };
    },
    ...ubah,
  };
  let siap = true;
  const suara = new SuaraLangsung(env, () => ({
    // Socket putus: pesan dibuang (seperti koneksi.ts untuk pesan suara).
    kirim: (p) => {
      if (!siap) return;
      terkirim.push(p as PesanKlien);
      meja.terima(pemainId, p as PesanKlien);
    },
    siapKirim: () => siap,
    rtt: () => ({ ...rtt }),
    ukurRtt,
  }));
  return {
    suara,
    env,
    peers,
    audio,
    toast,
    umumkan,
    redamMusik,
    get timer() {
      return [...timerMap.values()];
    },
    terkirim,
    ukurRtt,
    /** Pong baru dengan RTT `n`. */
    aturRtt: (n: number | null) => {
      rtt.ms = n;
      rtt.ke++;
    },
    /** Pong baru dengan RTT yang sama. */
    pong: () => {
      rtt.ke++;
    },
    /** Ping yang belum dijawab selama `ms`. */
    aturTunggu: (ms: number | null) => {
      rtt.tungguMs = ms;
    },
    ketuk: () => ketuk?.(),
    /** Socket terbuka/putus. */
    aturSiap: (b: boolean) => {
      siap = b;
    },
    masuk: () => {
      suara.masukMeja('ABCDE', pemainId);
      const i = meja.data.kursi.findIndex((k) => k.pemainId === pemainId);
      suara.aturInfo(meja.info(i), { online: true, penonton: false });
    },
    antrian,
  };
}

/** Meja Ani (host), Budi, Cici + satu warga kedai; tiap HP menerima pesan suara lewat antrian. */
function meja3() {
  const antrian: [string, PesanServer][] = [];
  const meja = Meja.buat(
    { kode: 'ABCDE', kirim: (id, p) => (p.t === 'suara' || p.t === 'suaraSinyal') && antrian.push([id, p]), namaLawan: ['Warga A'] },
    'ani',
    'Ani',
    { jumlahPemain: 4 },
  );
  meja.masuk('budi', 'Budi');
  meja.masuk('cici', 'Cici');
  meja.terima('ani', { t: 'aturKursi', kursi: 3, jenis: 'bot' });
  const ani = hp(meja, 'ani', antrian);
  const budi = hp(meja, 'budi', antrian);
  const cici = hp(meja, 'cici', antrian);
  const ke = { ani, budi, cici } as Record<string, ReturnType<typeof hp>>;
  /** Kirim semua pesan yang menunggu (dan yang timbul darinya) sampai sepi. */
  const alirkan = async () => {
    for (let putaran = 0; putaran < 50; putaran++) {
      await new Promise((r) => setTimeout(r, 0));
      if (!antrian.length) {
        await new Promise((r) => setTimeout(r, 0));
        if (!antrian.length) return;
      }
      for (const [id, p] of antrian.splice(0)) ke[id]?.suara.terimaPesan(p);
    }
  };
  return { meja, ani, budi, cici, alirkan };
}

const peerAktif = () => PeerPalsu.semua.filter((p) => !p.ditutup);

beforeEach(() => {
  PeerPalsu.semua = [];
  jam = 10_000;
  levelLokal = 0;
});
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------------------------

describe('SuaraLangsung: gabung dan mic', () => {
  it('masuk meja: gabung otomatis, mic mati, tanpa minta izin, tanpa sambungan', async () => {
    const { ani, budi, alirkan } = meja3();
    ani.masuk();
    budi.masuk();
    await alirkan();
    expect(ani.terkirim).toEqual([{ t: 'suara', aksi: 'gabung', nyala: false }]);
    expect(ani.suara.tersedia).toBe(true);
    expect(ani.suara.ikut).toBe(true);
    expect(ani.suara.tombolMic).toBe('mati');
    expect(ani.env.getUserMedia).not.toHaveBeenCalled();
    expect(ani.suara.keadaanKursi(0)).toBe('mati');
    expect(ani.suara.keadaanKursi(1)).toBe('mati');
    // Cici belum ikut (aplikasi lama / belum masuk), warga kedai tidak pernah: tanpa ikon.
    expect(ani.suara.keadaanKursi(2)).toBeNull();
    expect(ani.suara.keadaanKursi(3)).toBeNull();
    // Dua-duanya mic mati: belum perlu sambungan apa pun.
    expect(PeerPalsu.semua).toHaveLength(0);
  });

  it('mic nyala: minta izin dengan pembersih gema/derau/penguat otomatis, lalu tersambung ke teman (id kecil yang menawarkan)', async () => {
    const { ani, budi, alirkan } = meja3();
    ani.masuk();
    budi.masuk();
    await alirkan();
    await budi.suara.ketukMic();
    await alirkan();
    expect(budi.env.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false,
    });
    expect(budi.suara.tombolMic).toBe('nyala');
    expect(ani.suara.keadaanKursi(1)).toBe('nyala');
    // Ani (id 1) menawarkan ke Budi (id 2), walau yang menyalakan mic Budi.
    const [pAni, pBudi] = PeerPalsu.semua;
    expect(PeerPalsu.semua).toHaveLength(2);
    expect(pAni!.localDescription!.type).toBe('offer');
    expect(pBudi!.remoteDescription!.sdp).toContain('maxaveragebitrate=24000');
    expect(pBudi!.remoteDescription!.sdp).toContain('stereo=0');
    expect(pAni!.remoteDescription!.type).toBe('answer');
    expect(pAni!.config.iceServers).toEqual([{ urls: 'stun:stun.contoh:3478' }]);
    // Budi mengirim mic-nya, Ani tidak mengirim apa-apa (mic-nya mati).
    expect(pBudi!.getSenders()[0]!.track).toBeInstanceOf(TrackPalsu);
    expect(pAni!.getSenders()[0]!.track).toBeNull();
    // Tersambung: bitrate Opus dibatasi.
    pAni!.sambung();
    pBudi!.sambung();
    await alirkan();
    expect(pBudi!.getSenders()[0]!.param.encodings[0]!.maxBitrate).toBe(BITRATE_NORMAL);
    // Suara teman diputar lewat <audio>.
    expect(ani.audio[0]!.srcObject).toBeInstanceOf(StreamPalsu);
    expect(ani.audio[0]!.diputar).toBeGreaterThan(0);
  });

  it('izin mic ditolak: toast ramah, mic tetap mati, tidak ada kabar mic ke meja', async () => {
    const { ani, alirkan } = meja3();
    ani.masuk();
    await alirkan();
    (ani.env.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await ani.suara.ketukMic();
    expect(ani.toast).toHaveBeenCalledWith(TEKS_SUARA.izinDitolak, true);
    expect(ani.suara.tombolMic).toBe('mati');
    expect(ani.terkirim.some((p) => p.t === 'suara' && p.aksi === 'mic')).toBe(false);
    (ani.env.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotFoundError' }));
    await ani.suara.ketukMic();
    expect(ani.toast).toHaveBeenLastCalledWith(TEKS_SUARA.tanpaMic, true);
  });

  it('mic dimatikan: track dihentikan, pengiriman berhenti tanpa negosiasi ulang', async () => {
    const { ani, budi, alirkan } = meja3();
    ani.masuk();
    budi.masuk();
    await alirkan();
    await ani.suara.ketukMic();
    await alirkan();
    const track = PeerPalsu.semua[0]!.getSenders()[0]!.track as TrackPalsu;
    await ani.suara.ketukMic();
    await alirkan();
    expect(track.berhenti).toBe(true);
    expect(PeerPalsu.semua[0]!.getSenders()[0]!.track).toBeNull();
    expect(budi.suara.keadaanKursi(0)).toBe('mati');
    expect(peerAktif()).toHaveLength(2);
  });

  it('bukan meja online, penonton, atau meja sprint: suara tidak tersedia dan tidak gabung', () => {
    const { meja, ani } = meja3();
    ani.suara.masukMeja('ABCDE', 'ani');
    ani.suara.aturInfo(meja.info(0), { online: true, penonton: true });
    expect(ani.suara.tersedia).toBe(false);
    ani.suara.aturInfo(meja.info(0), { online: false, penonton: false });
    expect(ani.suara.tersedia).toBe(false);
    ani.suara.aturInfo({ ...meja.info(0), sprint: true }, { online: true, penonton: false });
    expect(ani.suara.tersedia).toBe(false);
    ani.suara.aturInfo({ ...meja.info(0), kursiSaya: null }, { online: true, penonton: false });
    expect(ani.suara.tersedia).toBe(false);
    expect(ani.terkirim).toEqual([]);
  });
});

describe('SuaraLangsung: dengar, bisukan, ngomong', () => {
  async function siap() {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    m.cici.masuk();
    await m.alirkan();
    await m.budi.suara.ketukMic();
    await m.cici.suara.ketukMic();
    await m.alirkan();
    for (const p of PeerPalsu.semua) p.sambung();
    await m.alirkan();
    return m;
  }

  it('Dengar suara mati = semua suara teman bisu di HP ini saja; bisukan satu orang', async () => {
    const { ani, budi } = await siap();
    expect(ani.audio).toHaveLength(2);
    expect(ani.audio.every((a) => !a.muted)).toBe(true);
    ani.suara.aturDengar(false);
    expect(ani.audio.every((a) => a.muted)).toBe(true);
    expect(budi.audio.every((a) => !a.muted)).toBe(true);
    ani.suara.aturDengar(true);
    ani.suara.aturBisu('budi', true);
    const orang = ani.suara.daftarOrang();
    expect(orang.map((o) => [o.nama, o.bisu])).toEqual([
      ['Budi', true],
      ['Cici', false],
    ]);
    // Hanya satu suara (Budi) yang bisu; huruf besar/kecil nama tidak berpengaruh.
    expect(ani.audio.filter((a) => a.muted)).toHaveLength(1);
    ani.suara.aturBisu('Budi', false);
    expect(ani.audio.some((a) => a.muted)).toBe(false);
  });

  it('penanda ngomong hanya dari tingkat suara, bertahan sebentar lalu padam; musik diredam selama terdengar', async () => {
    const { ani } = await siap();
    const kabar = vi.fn();
    ani.suara.dengarkan(kabar);
    // Satu teman (siapa pun di peer pertama Ani) terdengar ngomong; yang lain tidak.
    const rx = ani.peers[0]!.getReceivers()[0]!;
    rx.level = 0.2;
    rx.waktu = jam;
    ani.suara.ukurLevel();
    const kursiNgomong = ani.suara.keadaanKursi(1) === 'bicara' ? 1 : 2;
    const kursiDiam = 3 - kursiNgomong;
    expect(ani.suara.keadaanKursi(kursiNgomong)).toBe('bicara');
    expect(ani.suara.keadaanKursi(kursiDiam)).toBe('nyala');
    expect(ani.redamMusik).toHaveBeenCalled();
    expect(kabar).toHaveBeenCalledTimes(1);
    // Suara pelan (di bawah ambang) atau paket basi: penanda padam sesudah masa tahan.
    rx.level = 0.005;
    jam += 200;
    rx.waktu = jam;
    ani.suara.ukurLevel();
    expect(ani.suara.keadaanKursi(kursiNgomong)).toBe('bicara');
    jam += 400;
    ani.suara.ukurLevel();
    expect(ani.suara.keadaanKursi(kursiNgomong)).toBe('nyala');
    // Dengar suara mati: penanda tetap ada, tapi musik tidak perlu diredam.
    ani.redamMusik.mockClear();
    ani.suara.aturDengar(false);
    rx.level = 0.3;
    rx.waktu = jam;
    ani.suara.ukurLevel();
    expect(ani.suara.keadaanKursi(kursiNgomong)).toBe('bicara');
    expect(ani.redamMusik).not.toHaveBeenCalled();
  });

  it('penanda ngomong diri sendiri dari mic (analyser), hanya selama mic nyala', async () => {
    const { budi } = await siap();
    levelLokal = 0.1;
    budi.suara.ukurLevel();
    expect(budi.suara.keadaanKursi(1)).toBe('bicara');
    expect(budi.suara.bicaraSendiri).toBe(true);
    await budi.suara.ketukMic();
    budi.suara.ukurLevel();
    expect(budi.suara.keadaanKursi(1)).toBe('mati');
    expect(budi.suara.bicaraSendiri).toBe(false);
  });

  it('putar suara ditahan browser: kabar ketuk sekali, ketukan berikutnya memutar lagi', async () => {
    const m = meja3();
    let tolak = true;
    const ani = m.ani;
    ani.env.buatAudio = () => {
      const a: AudioPalsu = {
        muted: false,
        srcObject: null,
        dibuang: false,
        diputar: 0,
        play() {
          a.diputar++;
          return tolak ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve();
        },
        pause() {},
        remove() {
          a.dibuang = true;
        },
      };
      ani.audio.push(a);
      return a as unknown as HTMLAudioElement;
    };
    ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.budi.suara.ketukMic();
    await m.alirkan();
    await new Promise((r) => setTimeout(r, 0));
    expect(ani.suara.menungguKetuk).toBe(true);
    expect(ani.toast).toHaveBeenCalledWith(TEKS_SUARA.ketuk);
    tolak = false;
    ani.ketuk();
    expect(ani.suara.menungguKetuk).toBe(false);
    expect(ani.audio[0]!.diputar).toBe(2);
  });
});

describe('SuaraLangsung: kualitas sinyal', () => {
  it('nilaiSampel: buruk / lemah / baik', () => {
    expect(nilaiSampel({})).toBe('baik');
    expect(nilaiSampel({ rttMs: 120, hilang: 0.01, jitterMs: 10, bitrateKeluar: 300_000 })).toBe('baik');
    expect(nilaiSampel({ rttMs: 700 })).toBe('lemah');
    expect(nilaiSampel({ hilang: 0.08 })).toBe('lemah');
    expect(nilaiSampel({ bitrateKeluar: 30_000 })).toBe('lemah');
    expect(nilaiSampel({ rttMs: 1600 })).toBe('buruk');
    expect(nilaiSampel({ hilang: 0.25 })).toBe('buruk');
    expect(nilaiSampel({ jitterMs: 300 })).toBe('buruk');
    expect(gabungSampel([{ rttMs: 100, bitrateKeluar: 90_000 }, { rttMs: 400, hilang: 0.1, bitrateKeluar: 50_000 }])).toEqual({
      rttMs: 400,
      hilang: 0.1,
      jitterMs: null,
      bitrateKeluar: 50_000,
    });
  });

  it('PenjagaKualitas: turun cepat, naik pelan, syarat pulih berlipat kalau jeda lagi', () => {
    const p = new PenjagaKualitas();
    const jalan = (...n: NilaiKualitas[]) => n.map((x) => p.catat(x));
    expect(jalan('buruk', 'baik', 'buruk', 'baik')).toEqual(['normal', 'normal', 'normal', 'normal']);
    expect(jalan('lemah', 'lemah')).toEqual(['normal', 'hemat']);
    expect(jalan('baik', 'baik', 'baik', 'baik')).toEqual(['hemat', 'hemat', 'hemat', 'normal']);
    expect(jalan('buruk', 'buruk')).toEqual(['normal', 'jeda']);
    expect(p.syaratPulih).toBe(3);
    // Satu sampel buruk di tengah memulai hitungan dari awal.
    expect(jalan('baik', 'lemah', 'buruk', 'baik', 'baik', 'lemah')).toEqual(['jeda', 'jeda', 'jeda', 'jeda', 'jeda', 'hemat']);
    expect(jalan('buruk', 'buruk')).toEqual(['hemat', 'jeda']);
    expect(p.syaratPulih).toBe(6);
    expect(jalan('baik', 'baik', 'baik', 'baik', 'baik')).toEqual(Array(5).fill('jeda'));
    expect(p.catat('baik')).toBe('hemat');
  });

  it('sinyal buruk: suara dijeda (tutup semua, kabari meja), teman melihat sinyal lemah; membaik: nyala lagi sendiri', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    for (const p of PeerPalsu.semua) p.sambung();
    await m.alirkan();
    expect(peerAktif()).toHaveLength(2);
    m.ani.aturRtt(2500);
    await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('normal');
    m.ani.pong();
    await m.ani.suara.ukurKualitas();
    await m.alirkan();
    expect(m.ani.suara.tingkat).toBe('jeda');
    expect(m.ani.terkirim.at(-1)).toEqual({ t: 'suara', aksi: 'jeda', nyala: true });
    expect(peerAktif()).toHaveLength(0);
    expect(m.ani.suara.keadaanKursi(0)).toBe('lemah');
    expect(m.budi.suara.keadaanKursi(0)).toBe('lemah');
    expect(m.ani.umumkan).toHaveBeenCalledWith(TEKS_SUARA.lemah);
    // Selama dijeda: tidak kirim, tidak terima; sinyal diukur lewat ping.
    expect(m.ani.suara.tombolMic).toBe('nyala');
    await m.ani.suara.ukurKualitas();
    expect(m.ani.ukurRtt).toHaveBeenCalled();
    // Membaik: butuh 3 sampel berturut-turut (histeresis), baru nyala lagi dengan bitrate hemat.
    m.ani.aturRtt(80);
    await m.ani.suara.ukurKualitas();
    await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('jeda');
    await m.ani.suara.ukurKualitas();
    await m.alirkan();
    expect(m.ani.suara.tingkat).toBe('hemat');
    expect(m.ani.terkirim.filter((x) => x.t === 'suara').at(-1)).toEqual({ t: 'suara', aksi: 'jeda', nyala: false });
    expect(m.budi.suara.keadaanKursi(0)).toBe('nyala');
    expect(m.ani.umumkan).toHaveBeenCalledWith(TEKS_SUARA.pulih);
    const baru = peerAktif();
    expect(baru).toHaveLength(2);
    for (const p of baru) p.sambung();
    await m.alirkan();
    const kirimAni = baru.find((p) => p.localDescription?.type === 'offer')!;
    expect(kirimAni.getSenders()[0]!.param.encodings[0]!.maxBitrate).toBe(BITRATE_HEMAT);
  });

  it('statistik WebRTC: RTT pasangan kandidat lemah = bitrate hemat lewat setParameters', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    for (const p of PeerPalsu.semua) p.sambung();
    await m.alirkan();
    const p = PeerPalsu.semua[0]!;
    p.stats = [{ type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.8, availableOutgoingBitrate: 200_000 }];
    await m.ani.suara.ukurKualitas();
    await m.ani.suara.ukurKualitas();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.ani.suara.tingkat).toBe('hemat');
    expect(p.getSenders()[0]!.param.encodings[0]!.maxBitrate).toBe(BITRATE_HEMAT);
  });

  it('bacaStatistik: paket hilang dari selisih hitungan, jitter, RTT, bitrate keluar', () => {
    const a = bacaStatistik(
      [
        { type: 'candidate-pair', state: 'succeeded', selected: true, currentRoundTripTime: 0.12, availableOutgoingBitrate: 64_000 },
        { type: 'inbound-rtp', kind: 'audio', jitter: 0.02, packetsLost: 10, packetsReceived: 100 },
        { type: 'remote-inbound-rtp', kind: 'audio', fractionLost: 0.01 },
        { type: 'candidate-pair', state: 'in-progress', currentRoundTripTime: 9 },
      ],
      null,
    );
    expect(a.sampel).toEqual({ rttMs: 120, bitrateKeluar: 64_000, jitterMs: 20, hilang: 0.01 });
    const b = bacaStatistik([{ type: 'inbound-rtp', kind: 'audio', jitter: 0.01, packetsLost: 30, packetsReceived: 180 }], a.paket);
    expect(b.sampel.hilang).toBeCloseTo(20 / 100);
  });

  it('sdpOpusHemat: mono, bitrate, FEC, DTX; parameter lama yang sama diganti', () => {
    const s = sdpOpusHemat(SDP, 24_000);
    expect(s).toContain('a=fmtp:111 minptime=10;maxaveragebitrate=24000;stereo=0;sprop-stereo=0;useinbandfec=1;usedtx=1');
    expect(s.match(/useinbandfec/g)).toHaveLength(1);
    const tanpaFmtp = SDP.replace('a=fmtp:111 minptime=10;useinbandfec=1\r\n', '');
    expect(sdpOpusHemat(tanpaFmtp)).toContain('a=rtpmap:111 opus/48000/2\r\na=fmtp:111 maxaveragebitrate=24000');
    expect(sdpOpusHemat('v=0\r\n')).toBe('v=0\r\n');
  });
});

describe('SuaraLangsung: bersih-bersih', () => {
  it('keluar meja: kabari meja, hentikan mic, tutup semua sambungan, buang <audio>; meja berikutnya mic mati lagi', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    const track = (PeerPalsu.semua[0]!.getSenders()[0]!.track as TrackPalsu)!;
    m.ani.suara.hentikan();
    await m.alirkan();
    expect(m.ani.terkirim.at(-1)).toEqual({ t: 'suara', aksi: 'keluar' });
    expect(track.berhenti).toBe(true);
    expect(PeerPalsu.semua[0]!.ditutup).toBe(true);
    expect(m.ani.audio.every((a) => a.dibuang)).toBe(true);
    expect(m.ani.suara.tersedia).toBe(false);
    expect(m.ani.suara.tombolMic).toBe('mati');
    // Teman: Ani hilang dari suara, sambungannya ke Ani ditutup.
    expect(m.budi.suara.keadaanKursi(0)).toBeNull();
    expect(peerAktif()).toHaveLength(0);
    // Masuk lagi: gabung dengan mic mati.
    m.ani.masuk();
    expect(m.ani.terkirim.at(-1)).toEqual({ t: 'suara', aksi: 'gabung', nyala: false });
    expect(m.ani.suara.tombolMic).toBe('mati');
  });

  it('pindah ke meja lain: semua dibersihkan tanpa menunggu pesan apa pun', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    m.ani.suara.masukMeja('LAIN1', 'ani');
    expect(m.ani.suara.tombolMic).toBe('mati');
    expect(m.ani.suara.tersedia).toBe(false);
    expect(m.ani.peers.every((p) => p.ditutup)).toBe(true);
    expect(m.ani.audio.every((a) => a.dibuang)).toBe(true);
  });

  it('mic dicabut sistem (track berakhir): mic mati dan dikabarkan', async () => {
    const m = meja3();
    m.ani.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    const stream = await (m.ani.env.getUserMedia as ReturnType<typeof vi.fn>).mock.results[0]!.value;
    (stream as StreamPalsu).trek[0]!.selesai();
    expect(m.ani.suara.tombolMic).toBe('mati');
    expect(m.ani.terkirim.at(-1)).toEqual({ t: 'suara', aksi: 'mic', nyala: false });
  });

  it('gagal tersambung: penawar mencoba lagi dengan jeda, paling banyak beberapa kali', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    PeerPalsu.semua[0]!.sambung('failed');
    expect(PeerPalsu.semua[0]!.ditutup).toBe(true);
    expect(m.ani.suara.daftarOrang()[0]!.sambungan).toBeNull();
    expect(m.ani.timer).toHaveLength(1);
    m.ani.timer[0]!();
    await m.alirkan();
    const baru = PeerPalsu.semua.filter((p) => !p.ditutup && p.localDescription?.type === 'offer');
    expect(baru).toHaveLength(1);
  });
});

describe('SuaraLangsung: sinyal hilang dan sambung ulang', () => {
  it('tawaran tidak terkirim (socket putus): peer ditutup dan dicoba lagi sesudah jeda', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    // Ani (penawar) menyalakan mic tepat saat socket-nya putus.
    await m.budi.suara.ketukMic();
    m.ani.aturSiap(false);
    await m.alirkan();
    const pertama = m.ani.peers[0]!;
    expect(pertama.ditutup).toBe(true);
    expect(m.ani.timer).toHaveLength(1);
    m.ani.aturSiap(true);
    m.ani.timer[0]!();
    await m.alirkan();
    const baru = m.ani.peers.filter((p) => !p.ditutup);
    expect(baru).toHaveLength(1);
    expect(baru[0]!.remoteDescription?.type).toBe('answer');
  });

  it('tawaran tidak dijawab dalam BATAS_JAWAB_MS: peer ditutup dan ditawarkan ulang', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.budi.suara.ketukMic();
    // Tawaran Ani hilang di jalan (mis. dibuang batas laju): daftar anggota sampai, sinyalnya tidak.
    const ke = { ani: m.ani, budi: m.budi, cici: m.cici } as Record<string, typeof m.ani>;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 0));
      for (const [id, p] of m.ani.antrian.splice(0)) if (p.t !== 'suaraSinyal') ke[id]!.suara.terimaPesan(p);
    }
    const tawaran = m.ani.peers[0]!;
    expect(tawaran.signalingState).toBe('have-local-offer');
    expect(m.ani.timer).toHaveLength(1);
    // Batas jawab habis.
    m.ani.timer[0]!();
    expect(tawaran.ditutup).toBe(true);
    // Coba lagi sesudah jeda; kali ini sinyalnya sampai.
    expect(m.ani.timer).toHaveLength(1);
    m.ani.timer[0]!();
    await m.alirkan();
    const baru = m.ani.peers.filter((p) => !p.ditutup);
    expect(baru).toHaveLength(1);
    expect(baru[0]!.remoteDescription?.type).toBe('answer');
    // Jawaban datang: batas jawab dibatalkan, tidak ada timer tersisa.
    expect(m.ani.timer).toHaveLength(0);
  });

  it('sambung ulang ke meja yang sama: sambungan yang belum jadi ditawarkan ulang, yang sudah jalan dibiarkan', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    m.cici.masuk();
    await m.alirkan();
    await m.budi.suara.ketukMic();
    await m.cici.suara.ketukMic();
    await m.alirkan();
    // Ani menawarkan ke Budi lalu Cici. Ani–Budi tersambung, Ani–Cici belum (menggantung).
    expect(m.ani.peers).toHaveLength(2);
    const [keBudi, keCici] = m.ani.peers;
    keBudi!.sambung();
    await m.alirkan();
    m.ani.masuk();
    await m.alirkan();
    expect(keBudi!.ditutup).toBe(false);
    expect(keCici!.ditutup).toBe(true);
    const aktif = m.ani.peers.filter((p) => !p.ditutup);
    expect(aktif).toHaveLength(2);
    expect(aktif[1]!.remoteDescription?.type).toBe('answer');
  });

  it('gabung ulang membawa keadaan mic dan jeda yang sekarang (perubahan selama putus tidak hilang)', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    expect(m.budi.suara.keadaanKursi(0)).toBe('nyala');
    // Putus, lalu mic dimatikan selama putus: pesan mic-nya dibuang.
    m.ani.aturSiap(false);
    await m.ani.suara.ketukMic();
    m.ani.aturSiap(true);
    m.ani.masuk();
    await m.alirkan();
    expect(m.ani.terkirim.at(-1)).toEqual({ t: 'suara', aksi: 'gabung', nyala: false });
    expect(m.budi.suara.keadaanKursi(0)).toBe('mati');
    // Sinyal buruk sampai dijeda, lalu sambung ulang: server tetap tahu HP ini dijeda.
    await m.ani.suara.ketukMic();
    m.ani.aturRtt(2500);
    await m.ani.suara.ukurKualitas();
    m.ani.pong();
    await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('jeda');
    m.ani.masuk();
    await m.alirkan();
    expect(m.ani.terkirim.at(-1)).toEqual({ t: 'suara', aksi: 'gabung', nyala: true, jeda: true });
    expect(m.budi.suara.keadaanKursi(0)).toBe('lemah');
  });

  it('satu pong lambat hanya dihitung satu sampel (tidak menjeda suara sendirian)', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    await m.ani.suara.ketukMic();
    await m.alirkan();
    m.ani.aturRtt(2000);
    for (let i = 0; i < 5; i++) await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('normal');
    // Pong kedua yang juga lambat = dua sampel buruk berturut-turut.
    m.ani.pong();
    await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('jeda');
  });

  it('selama dijeda, ping yang tidak dijawab dihitung buruk (jaringan mati tidak dianggap pulih)', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    m.ani.aturRtt(2000);
    await m.ani.suara.ukurKualitas();
    m.ani.pong();
    await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('jeda');
    m.ani.ukurRtt.mockImplementation(() => undefined);
    m.ani.aturTunggu(2_000);
    for (let i = 0; i < 6; i++) await m.ani.suara.ukurKualitas();
    expect(m.ani.suara.tingkat).toBe('jeda');
  });

  it('tawaran dari teman yang mic-nya mati tidak dijawab kalau mic sendiri juga mati (alamat IP tidak dibagikan)', async () => {
    const m = meja3();
    m.ani.masuk();
    m.budi.masuk();
    await m.alirkan();
    const idAni = m.meja.data.kursi.findIndex((k) => k.pemainId === 'ani');
    const anggota = m.budi.suara.daftarOrang().find((o) => o.kursi === idAni)!;
    m.budi.suara.terimaPesan({ t: 'suaraSinyal', dari: anggota.id, data: { sdp: { type: 'offer', sdp: SDP } } });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(m.budi.peers).toHaveLength(0);
    expect(m.budi.terkirim.some((p) => p.t === 'suaraSinyal')).toBe(false);
    // Begitu Ani menyalakan mic (terlihat semua orang), tawarannya dijawab.
    await m.ani.suara.ketukMic();
    await m.alirkan();
    expect(m.budi.peers.filter((p) => !p.ditutup)).toHaveLength(1);
    expect(m.budi.terkirim.some((p) => p.t === 'suaraSinyal')).toBe(true);
  });
});
