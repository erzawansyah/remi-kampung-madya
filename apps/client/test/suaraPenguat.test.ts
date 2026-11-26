// @vitest-environment happy-dom
// Penguat suara teman (0.10.0) di mesin audio, dengan AudioContext palsu yang mencatat sambungan node:
// busSuara → kompresor suara → pembatas (tidak lewat master), redam efek seragam, preferensi volumeSuara
// (bawaan 200%, data rusak jatuh ke bawaan), penggeser di lembar Suara, jalur per orang + pembersihan,
// satu AudioContext untuk pengukur mic, redaman saat teman ngomong, dan sesi audio iOS.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------------------------
// AudioContext palsu

interface ParamPalsu {
  value: number;
  /** Nilai tujuan terakhir yang dijadwalkan (setTargetAtTime/setValueAtTime), urut. */
  jadwal: [string, number, number][];
  setValueAtTime(v: number, t: number): void;
  setTargetAtTime(v: number, t: number, c: number): void;
  linearRampToValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
  cancelScheduledValues(t: number): void;
}

function param(awal = 1): ParamPalsu {
  const p: ParamPalsu = {
    value: awal,
    jadwal: [],
    setValueAtTime(v, t) {
      p.jadwal.push(['set', v, t]);
      p.value = v;
    },
    setTargetAtTime(v, t) {
      p.jadwal.push(['target', v, t]);
    },
    linearRampToValueAtTime(v, t) {
      p.jadwal.push(['linear', v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      p.jadwal.push(['exp', v, t]);
    },
    cancelScheduledValues() {},
  };
  return p;
}

/** Nilai yang dituju param: jadwal target pertama sesudah pembatalan terakhir, atau nilainya sekarang. */
const tujuan = (p: ParamPalsu): number => {
  const t = p.jadwal.filter((j) => j[0] === 'target');
  return t.length ? t.at(-1)![1] : p.value;
};

class NodePalsu {
  static semua: NodePalsu[] = [];
  keluar = new Set<NodePalsu>();
  putus = 0;
  gain = param();
  threshold = param(-24);
  knee = param(30);
  ratio = param(12);
  attack = param(0.003);
  release = param(0.25);
  frequency = param(350);
  Q = param(1);
  delayTime = param(0);
  fftSize = 2048;
  buffer: unknown = null;
  onended: (() => void) | null = null;
  constructor(
    readonly jenis: string,
    readonly a: KonteksPalsu,
  ) {
    NodePalsu.semua.push(this);
  }
  connect<T>(n: T): T {
    this.keluar.add(n as unknown as NodePalsu);
    return n;
  }
  disconnect() {
    this.putus++;
    this.keluar.clear();
  }
  start() {}
  stop() {}
  getFloatTimeDomainData(d: Float32Array) {
    d.fill(0.1);
  }
}

class KonteksPalsu {
  static semua: KonteksPalsu[] = [];
  state = 'running';
  currentTime = 1;
  sampleRate = 48000;
  destination = new NodePalsu('destination', this);
  pendengar = new Set<() => void>();
  constructor() {
    KonteksPalsu.semua.push(this);
  }
  addEventListener(_j: string, fn: () => void) {
    this.pendengar.add(fn);
  }
  removeEventListener(_j: string, fn: () => void) {
    this.pendengar.delete(fn);
  }
  /** Ganti keadaan dan picu statechange (seperti browser). */
  ganti(state: string) {
    this.state = state;
    for (const fn of [...this.pendengar]) fn();
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    return new NodePalsu('gain', this);
  }
  createDynamicsCompressor() {
    return new NodePalsu('kompresor', this);
  }
  createBiquadFilter() {
    return new NodePalsu('filter', this);
  }
  createDelay() {
    return new NodePalsu('delay', this);
  }
  createAnalyser() {
    return new NodePalsu('analyser', this);
  }
  createBufferSource() {
    return new NodePalsu('buffer', this);
  }
  createMediaStreamSource(stream: unknown) {
    const n = new NodePalsu('stream', this);
    (n as unknown as { stream: unknown }).stream = stream;
    return n;
  }
  createBuffer(_k: number, panjang: number) {
    const data = new Float32Array(panjang);
    return { getChannelData: () => data, duration: panjang / this.sampleRate };
  }
}

/** Semua node yang bisa dicapai dari `n` (mengikuti sambungan). */
function jangkau(n: NodePalsu): Set<NodePalsu> {
  const lihat = new Set<NodePalsu>();
  const tumpuk = [n];
  while (tumpuk.length) {
    const x = tumpuk.pop()!;
    for (const y of x.keluar) if (!lihat.has(y)) (lihat.add(y), tumpuk.push(y));
  }
  return lihat;
}

type ModAudio = typeof import('../src/efek/mesinAudio');
type ModSuara = typeof import('../src/suaraLangsung');
type ModPref = typeof import('../src/preferensi');

let musikDiredam: [number, number][] = [];

async function muat(musikAsli = false): Promise<{ audio: ModAudio; suara: ModSuara; pref: ModPref }> {
  vi.resetModules();
  if (!musikAsli) {
    vi.doMock('../src/efek/musik', () => ({
      redamMusik: () => undefined,
      redamMusikNgomong: (t: number, l: number) => musikDiredam.push([t, l]),
    }));
  }
  const pref = await import('../src/preferensi');
  const audio = await import('../src/efek/mesinAudio');
  const suara = await import('../src/suaraLangsung');
  return { audio, suara, pref };
}

/** Pasang mesin audio dan sentuh layar sekali (syarat browser), lalu kembalikan context yang dibuat. */
function sentuh(audio: ModAudio): KonteksPalsu {
  audio.pasangMesinAudio();
  window.dispatchEvent(new Event('pointerdown'));
  return KonteksPalsu.semua.at(-1)!;
}

beforeEach(() => {
  NodePalsu.semua = [];
  KonteksPalsu.semua = [];
  musikDiredam = [];
  localStorage.clear();
  vi.stubGlobal('AudioContext', KonteksPalsu);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('../src/efek/musik');
});

// ---------------------------------------------------------------------------------------------

describe('rantai audio: bus suara dan redam efek', () => {
  it('busSuara → kompresor suara (−24 dB, 4:1, knee 6, 5 ms/150 ms) → kompensasi makeup gain → pembatas, tidak lewat master/bus efek', async () => {
    const { audio } = await muat();
    const a = new KonteksPalsu();
    const r = audio.bangunRantai(a as unknown as BaseAudioContext) as unknown as Record<string, NodePalsu>;
    const busSuara = r.busSuara!;
    const komp = [...busSuara.keluar][0]!;
    expect(komp.jenis).toBe('kompresor');
    expect([komp.threshold.value, komp.ratio.value, komp.knee.value, komp.attack.value, komp.release.value]).toEqual([-24, 4, 6, 0.005, 0.15]);
    // Makeup gain otomatis kompresor (×3,038) dan pembatas (×1,217), diukur di Chromium, dibatalkan
    // supaya 100% = asli.
    const kompensasi = [...komp.keluar][0]!;
    expect(kompensasi.jenis).toBe('gain');
    expect(kompensasi.gain.value).toBeCloseTo(1 / (3.038 * 1.217), 6);
    expect(audio.KOMPENSASI_KOMP_SUARA).toBeCloseTo(0.2705, 4);
    const pembatas = [...kompensasi.keluar][0]!;
    expect(pembatas.jenis).toBe('kompresor');
    expect(pembatas.threshold.value).toBe(-3);
    expect([...pembatas.keluar]).toEqual([a.destination]);
    // Tidak menyentuh bus efek/redam efek/musik (master tidak dilewati).
    const dariSuara = jangkau(busSuara);
    for (const k of ['busEfek', 'redamEfek', 'busMusik']) expect(dariSuara.has(r[k]!)).toBe(false);
    // Bus efek lewat redam efek lalu ke pembatas yang sama.
    expect([...r.busEfek!.keluar]).toContain(r.redamEfek);
    expect(jangkau(r.busEfek!).has(pembatas)).toBe(true);
    expect(busSuara.gain.value).toBe(2);
  });

  it('redamEfek: turun ke tingkat, lalu pulih ke 1; seragam untuk seluruh bus efek', async () => {
    const { audio } = await muat();
    const a = sentuh(audio);
    const r = audio.rantaiAktif() as unknown as Record<string, NodePalsu>;
    expect(r).toBeTruthy();
    audio.redamEfek(0.5, 0.5);
    const j = r.redamEfek!.gain.jadwal.filter((x) => x[0] === 'target');
    expect(j).toEqual([
      ['target', 0.5, a.currentTime],
      ['target', 1, a.currentTime + 0.5],
    ]);
  });

  it('redamSaatNgomong: musik ke 0,15 dan efek ke 0,5 selama 0,5 detik', async () => {
    const { audio, suara } = await muat();
    sentuh(audio);
    const r = audio.rantaiAktif() as unknown as Record<string, NodePalsu>;
    suara.redamSaatNgomong();
    expect(musikDiredam).toEqual([[0.15, 0.5]]);
    expect(r.redamEfek!.gain.jadwal.filter((x) => x[0] === 'target').map((x) => x[1])).toEqual([0.5, 1]);
    expect([suara.REDAM_MUSIK_NGOMONG, suara.REDAM_EFEK_NGOMONG]).toEqual([0.15, 0.5]);
  });
});

describe('preferensi volumeSuara', () => {
  it('bawaan 2 (200%); data rusak jatuh ke bawaan; dijepit 0..3 dan dibulatkan 0,1', async () => {
    const { pref } = await muat();
    expect(pref.PREFERENSI_BAWAAN.volumeSuara).toBe(2);
    expect(pref.normalkan({}).volumeSuara).toBe(2);
    for (const x of ['2', null, Number.NaN, Number.POSITIVE_INFINITY, {}, true]) expect(pref.normalkan({ volumeSuara: x }).volumeSuara).toBe(2);
    expect(pref.normalkan({ volumeSuara: 9 }).volumeSuara).toBe(3);
    expect(pref.normalkan({ volumeSuara: -1 }).volumeSuara).toBe(0);
    expect(pref.normalkan({ volumeSuara: 1.234 }).volumeSuara).toBe(1.2);
    expect(pref.normalkan({ volumeSuara: 0 }).volumeSuara).toBe(0);
  });

  it('mengubah preferensi mengatur gain busSuara (halus), tidak ikut sakelar efek/musik', async () => {
    const { audio, pref } = await muat();
    sentuh(audio);
    const r = audio.rantaiAktif() as unknown as Record<string, NodePalsu>;
    expect(r.busSuara!.gain.value).toBe(2);
    pref.aturPreferensi({ volumeSuara: 0.5 });
    expect(tujuan(r.busSuara!.gain)).toBe(0.5);
    pref.aturPreferensi({ suara: false, musik: false });
    expect(tujuan(r.busSuara!.gain)).toBe(0.5);
  });

  it('penggeser "Volume suara teman" di lembar Suara: tampil persen, menggeser mengubah gain busSuara', async () => {
    const { audio, pref } = await muat();
    sentuh(audio);
    const r = audio.rantaiAktif() as unknown as Record<string, NodePalsu>;
    const { bukaLembarSuara } = await import('../src/ui/suaraLangsung');
    const { tutupSemuaJendela } = await import('../src/ui/dom');
    const { TEKS_SUARA } = await import('../src/konten/suara');
    const tiruan = {
      tombolMic: 'mati',
      dengarNyala: true,
      tingkat: 'normal',
      menungguKetuk: false,
      daftarOrang: () => [],
      dengarkan: () => () => undefined,
    };
    bukaLembarSuara(tiruan as never);
    const dlg = document.querySelector('.dialog.lembar-suara')!;
    expect(dlg.textContent).toContain(TEKS_SUARA.volume);
    const geser = dlg.querySelector<HTMLInputElement>('input[type="range"]#volume-suara')!;
    const keluar = dlg.querySelector('[data-keluaran-suara]')!;
    expect(geser.max).toBe('300');
    expect(geser.value).toBe('200');
    expect(keluar.textContent).toBe('200%');
    // Penjelasan volume HP di balik "?", tidak tertulis terus.
    expect(dlg.querySelector('.tombol-info')).toBeTruthy();
    expect(dlg.querySelector<HTMLElement>('#info-volume-suara')!.hidden).toBe(true);
    expect(dlg.querySelector('#info-volume-suara')!.textContent).toBe(TEKS_SUARA.infoVolume);
    geser.value = '120';
    geser.dispatchEvent(new Event('input'));
    expect(pref.preferensi().volumeSuara).toBe(1.2);
    expect(tujuan(r.busSuara!.gain)).toBe(1.2);
    expect(keluar.textContent).toBe('120%');
    tutupSemuaJendela();
  });
});

describe('jalur suara teman di context bersama', () => {
  it('sumber → gain per orang → busSuara; gain bisa 0; tutup memutus semua node', async () => {
    const { audio, suara } = await muat();
    sentuh(audio);
    const r = audio.rantaiAktif() as unknown as Record<string, NodePalsu>;
    const stream = { id: 's1' } as unknown as MediaStream;
    const j = suara.sambungSuaraDiKonteks(stream)!;
    expect(j).toBeTruthy();
    const sumber = NodePalsu.semua.find((n) => n.jenis === 'stream')!;
    expect((sumber as unknown as { stream: unknown }).stream).toBe(stream);
    const g = [...sumber.keluar][0]!;
    expect(g.jenis).toBe('gain');
    expect([...g.keluar]).toEqual([r.busSuara]);
    expect(audio.diagnostikAudio().pemakaiSuara).toBe(1);
    j.aturGain(0);
    expect(tujuan(g.gain)).toBe(0);
    j.tutup();
    j.tutup();
    expect(sumber.putus).toBeGreaterThan(0);
    expect(g.putus).toBeGreaterThan(0);
    expect(audio.diagnostikAudio().pemakaiSuara).toBe(0);
  });

  it('context masih tidur: jalur tetap dipasang (gain 0, tidak aktif), memegang context, dan aktif begitu context jalan', async () => {
    const { audio, suara } = await muat();
    const a = sentuh(audio);
    a.state = 'suspended';
    let dibangunkan = 0;
    a.resume = () => {
      dibangunkan++;
      return Promise.resolve();
    };
    const berubah = vi.fn();
    const j = suara.sambungSuaraDiKonteks({} as MediaStream, berubah)!;
    expect(j).toBeTruthy();
    expect(j.aktif()).toBe(false);
    expect(dibangunkan).toBeGreaterThan(0);
    expect(audio.diagnostikAudio().pemakaiSuara).toBe(1);
    const g = [...NodePalsu.semua.find((n) => n.jenis === 'stream')!.keluar][0]!;
    expect(g.gain.value).toBe(0);
    a.ganti('running');
    expect(berubah).toHaveBeenCalledTimes(1);
    expect(j.aktif()).toBe(true);
    j.tutup();
    expect(j.aktif()).toBe(false);
    expect(a.pendengar.size).toBe(0);
    a.ganti('suspended');
    expect(berubah).toHaveBeenCalledTimes(1);
  });

  it('context sudah ditutup atau createMediaStreamSource gagal: null (pakai <audio> biasa), pegangan dilepas', async () => {
    const { audio, suara } = await muat();
    const a = sentuh(audio);
    a.state = 'closed';
    a.resume = () => Promise.resolve();
    expect(suara.sambungSuaraDiKonteks({} as MediaStream)).toBeNull();
    a.state = 'running';
    a.createMediaStreamSource = () => {
      throw new Error('tidak bisa');
    };
    expect(suara.sambungSuaraDiKonteks({} as MediaStream)).toBeNull();
    expect(audio.diagnostikAudio().pemakaiSuara).toBe(0);
  });

  it('tanpa AudioContext atau sebelum layar disentuh: null', async () => {
    const { audio, suara } = await muat();
    expect(suara.sambungSuaraDiKonteks({} as MediaStream)).toBeNull();
    vi.stubGlobal('AudioContext', undefined);
    sentuh(audio);
    expect(suara.sambungSuaraDiKonteks({} as MediaStream)).toBeNull();
  });

  it('pengukur mic memakai context yang sama (tidak membuat AudioContext kedua) dan melepasnya saat ditutup', async () => {
    const { audio, suara } = await muat();
    sentuh(audio);
    const env = suara.lingkunganBrowser({ toast: () => undefined, umumkan: () => undefined });
    // (Pendengar sentuh dari modul test sebelumnya juga membuat context; hitung yang dibuat sesudahnya saja.)
    const sebelum = KonteksPalsu.semua.length;
    const ukur = env.ukurLevelLokal({} as MediaStream)!;
    expect(KonteksPalsu.semua).toHaveLength(sebelum);
    expect(NodePalsu.semua.find((n) => n.jenis === 'analyser')!.a).toBe(audio.rantaiAktif()!.a);
    expect(ukur.level()).toBeGreaterThan(0);
    expect(audio.diagnostikAudio().pemakaiSuara).toBe(1);
    ukur.tutup();
    expect(audio.diagnostikAudio().pemakaiSuara).toBe(0);
  });

  it('selama obrolan suara dipakai, context tetap jalan walau efek dan musik dimatikan', async () => {
    const { audio, suara, pref } = await muat();
    vi.useFakeTimers();
    try {
      const a = sentuh(audio);
      const j = suara.sambungSuaraDiKonteks({} as MediaStream)!;
      pref.aturPreferensi({ suara: false, musik: false });
      vi.advanceTimersByTime(1000);
      expect(a.state).toBe('running');
      j.tutup();
      vi.advanceTimersByTime(1000);
      expect(a.state).toBe('suspended');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('redaman musik', () => {
  it('redaman suara teman di node sendiri: tidak membatalkan redaman efek besar (dan sebaliknya)', async () => {
    const { audio, pref } = await muat(true);
    const musik = await import('../src/efek/musik');
    pref.aturPreferensi({ musik: true });
    sentuh(audio);
    const r = audio.rantaiAktif() as unknown as Record<string, NodePalsu>;
    // Bangun jalur musik tanpa memutar nada (jalurnya dibuat sebelum Pemusik menjadwalkan apa pun).
    try {
      musik.suasanaMusik('meja');
    } catch {
      // Pemusik butuh node yang tidak ada di context palsu; jalurnya sudah terpasang.
    }
    const redamNgomong = [...NodePalsu.semua].find((n) => n.jenis === 'gain' && n.keluar.has(r.busMusik!))!;
    const redam = [...NodePalsu.semua].find((n) => n.jenis === 'gain' && n.keluar.has(redamNgomong))!;
    expect(redamNgomong).toBeTruthy();
    expect(redam).toBeTruthy();
    musik.redamMusik(0.25, 2.4);
    musik.redamMusikNgomong(0.15, 0.5);
    expect(redam.gain.jadwal.filter((x) => x[0] === 'target').map((x) => x[1])).toEqual([0.25, 1]);
    expect(redamNgomong.gain.jadwal.filter((x) => x[0] === 'target').map((x) => x[1])).toEqual([0.15, 1]);
    musik.suasanaMusik('diam');
  });
});

describe('sesi audio iOS', () => {
  it('play-and-record saat mic dibuka, auto saat dilepas; tanpa navigator.audioSession tidak apa-apa', async () => {
    const { suara } = await muat();
    const sesi = { type: 'auto' };
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { audioSession: sesi }));
    suara.aturSesiAudioIos(true);
    expect(sesi.type).toBe('play-and-record');
    suara.aturSesiAudioIos(false);
    expect(sesi.type).toBe('auto');
    vi.stubGlobal('navigator', Object.create(navigator));
    expect(() => suara.aturSesiAudioIos(true)).not.toThrow();
    const galak = {};
    Object.defineProperty(galak, 'type', {
      set: () => {
        throw new Error('tidak boleh');
      },
    });
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { audioSession: galak }));
    expect(() => suara.aturSesiAudioIos(true)).not.toThrow();
  });
});
