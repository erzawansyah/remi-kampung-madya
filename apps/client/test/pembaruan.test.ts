// @vitest-environment happy-dom
// Pembaruan otomatis PWA (pembaruan.ts): kapan versi baru boleh dipasang sendiri, anti-loop muat ulang,
// dan perbandingan build client dengan server (/healthz).
//
// Yang dijaga (permintaan pemilik: "biar keupdate sendiri, soalnya gak semua orang bisa langsung update"):
// - Putaran berjalan, susun akhir, popup joker/panel mentung, dan meja offline yang belum selesai
//   TIDAK PERNAH dimuat ulang otomatis, juga saat tab disembunyikan.
// - Beranda: dipasang sendiri tanpa klik (toast singkat kalau terlihat, diam-diam kalau tersembunyi).
// - Muat ulang otomatis paling banyak MAKS_MUAT_ULANG_OTOMATIS kali per build; sesudahnya hanya tawaran.
// - Meja dinilai dari yang TAMPIL: animasi/antrian, panel mentung, popup joker, dan klasemen akhir yang
//   sedang dibaca menahan pembaruan walau view terbaru dari server sudah 'selesai'.
// - Jembatan 0.1 → 0.2: halaman ini menjawab sapaan SW baru (pasangPenjawabSapa).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bacaPercobaan,
  bolehCek,
  CADANGAN_MUAT_ULANG_MS,
  catatPercobaan,
  DIAM_MS,
  JEDA_CEK_MIN_MS,
  JEDA_TOAST_MS,
  MAKS_MUAT_ULANG_OTOMATIS,
  momenPembaruan,
  JAWAB_SW,
  NILAI_ULANG_MS,
  pasangPenjawabSapa,
  PengelolaPembaruan,
  pesanSesudahPembaruan,
  putuskanPembaruan,
  SAPA_SW,
  serverBeda,
  TEKS_PASANG,
  TEKS_TAWARAN,
  type InfoBuild,
  type KeadaanPembaruan,
  type PenyimpananSesi,
} from '../src/pembaruan';

const BUILD: InfoBuild = { versi: '0.2.0', sha: 'a1b2c3d', waktu: '2026-10-13T00:00:00.000Z', label: 'v0.2.0 (a1b2c3d)' };
const BUILD_BARU: InfoBuild = { versi: '0.2.1', sha: 'e4f5a6b', waktu: '2026-10-14T00:00:00.000Z', label: 'v0.2.1 (e4f5a6b)' };

const beranda = (ubah: Partial<KeadaanPembaruan> = {}): KeadaanPembaruan => ({
  layar: 'beranda',
  jenis: null,
  statusMeja: null,
  mejaSiap: false,
  mejaSibuk: false,
  klasemenTampil: false,
  selesaiTercatat: false,
  dialogTerbuka: false,
  modalTerbuka: false,
  sedangMengetik: false,
  menungguServer: false,
  ...ubah,
});
const meja = (jenis: 'online' | 'offline', statusMeja: string, ubah: Partial<KeadaanPembaruan> = {}) =>
  beranda({ layar: 'meja', jenis, statusMeja, mejaSiap: true, modalTerbuka: true, ...ubah });

describe('momenPembaruan', () => {
  it('beranda tanpa gangguan = bebas; dialog, isian, atau tunggu server = tidak', () => {
    expect(momenPembaruan(beranda())).toBe('bebas');
    expect(momenPembaruan(beranda({ dialogTerbuka: true }))).toBe('tidak');
    expect(momenPembaruan(beranda({ modalTerbuka: true }))).toBe('tidak');
    expect(momenPembaruan(beranda({ sedangMengetik: true }))).toBe('tidak');
    expect(momenPembaruan(beranda({ menungguServer: true, jenis: 'online' }))).toBe('tidak');
  });

  it('daftar meja, riwayat, dan lobi online = senyap (hanya saat tab tersembunyi); lobi offline = tidak', () => {
    expect(momenPembaruan(beranda({ layar: 'publik' }))).toBe('senyap');
    expect(momenPembaruan(beranda({ layar: 'riwayat' }))).toBe('senyap');
    expect(momenPembaruan(beranda({ layar: 'lobi', jenis: 'online' }))).toBe('senyap');
    expect(momenPembaruan(beranda({ layar: 'lobi', jenis: 'offline' }))).toBe('tidak');
    expect(momenPembaruan(beranda({ layar: 'lobi', jenis: 'online', dialogTerbuka: true }))).toBe('tidak');
  });

  it('putaran berjalan, susun akhir, dan menunggu putaran tidak pernah aman (online maupun offline)', () => {
    for (const jenis of ['online', 'offline'] as const) {
      for (const s of ['putaranBerjalan', 'susunAkhir', 'menungguPutaran']) {
        expect(momenPembaruan(meja(jenis, s)), `${jenis} ${s}`).toBe('tidak');
        expect(momenPembaruan(meja(jenis, s, { modalTerbuka: false })), `${jenis} ${s} tanpa modal`).toBe('tidak');
      }
    }
  });

  it('meja offline yang belum selesai (jeda antarputaran) tidak pernah dimuat ulang; online boleh senyap', () => {
    expect(momenPembaruan(meja('offline', 'putaranSelesai'))).toBe('tidak');
    expect(momenPembaruan(meja('online', 'putaranSelesai'))).toBe('senyap');
  });

  it('klasemen akhir yang sedang tampil = tidak (jangan hilang sebelum pemain menutupnya), juga saat tersembunyi', () => {
    for (const jenis of ['online', 'offline'] as const) {
      const k = meja(jenis, 'selesai', { selesaiTercatat: true, klasemenTampil: true });
      expect(momenPembaruan(k), jenis).toBe('tidak');
      expect(putuskanPembaruan(momenPembaruan(k), { tersembunyi: true, diamMs: 60_000, percobaan: 0 })).toBe('tunda');
    }
  });

  it('meja sibuk (animasi, antrian, panel mentung, popup joker) = tidak, walau view terbaru sudah selesai', () => {
    // Kasus nyata: pemain mentung di putaran terakhir, warga kedai cepat menyelesaikan susun akhir.
    // Status 'selesai' sudah tercatat, tapi panel mentung masih di layar.
    for (const s of ['selesai', 'putaranSelesai']) {
      expect(momenPembaruan(meja('online', s, { selesaiTercatat: true, mejaSibuk: true })), s).toBe('tidak');
      expect(momenPembaruan(meja('offline', s, { selesaiTercatat: true, mejaSibuk: true })), s).toBe('tidak');
    }
    // Sesudah antrian habis: jeda antarputaran online kembali senyap.
    expect(momenPembaruan(meja('online', 'putaranSelesai'))).toBe('senyap');
  });

  it('meja selesai, klasemen sudah ditutup = senyap kalau sudah tercatat di riwayat; belum tercatat = tidak', () => {
    expect(momenPembaruan(meja('offline', 'selesai', { selesaiTercatat: true }))).toBe('senyap');
    expect(momenPembaruan(meja('online', 'selesai', { selesaiTercatat: true }))).toBe('senyap');
    expect(momenPembaruan(meja('offline', 'selesai', { selesaiTercatat: false }))).toBe('tidak');
    // Dialog yang dibuka pemain (mis. Pengaturan dari menu) tetap menahan.
    expect(momenPembaruan(meja('offline', 'selesai', { selesaiTercatat: true, dialogTerbuka: true }))).toBe('tidak');
  });

  it('meja yang masih dimuat (pemuat/galat) atau tanpa view = tidak', () => {
    expect(momenPembaruan(meja('offline', 'selesai', { selesaiTercatat: true, mejaSiap: false }))).toBe('tidak');
    expect(momenPembaruan(beranda({ layar: 'meja', jenis: 'online', mejaSiap: true }))).toBe('tidak');
  });
});

describe('putuskanPembaruan', () => {
  const k = { tersembunyi: false, diamMs: DIAM_MS, percobaan: 0 };
  it('momen tidak aman: selalu tunda, juga saat tersembunyi', () => {
    expect(putuskanPembaruan('tidak', k)).toBe('tunda');
    expect(putuskanPembaruan('tidak', { ...k, tersembunyi: true })).toBe('tunda');
  });
  it('tersembunyi + aman: pasang diam-diam', () => {
    expect(putuskanPembaruan('bebas', { ...k, tersembunyi: true })).toBe('pasang-diam');
    expect(putuskanPembaruan('senyap', { ...k, tersembunyi: true })).toBe('pasang-diam');
  });
  it('terlihat: bebas + pemain diam = toast lalu pasang; masih menyentuh layar = tunda; senyap = tawarkan', () => {
    expect(putuskanPembaruan('bebas', k)).toBe('pasang-toast');
    expect(putuskanPembaruan('bebas', { ...k, diamMs: DIAM_MS - 1 })).toBe('tunda');
    expect(putuskanPembaruan('senyap', k)).toBe('tawarkan');
  });
  it('jatah muat ulang otomatis habis: hanya tawaran', () => {
    const habis = { ...k, percobaan: MAKS_MUAT_ULANG_OTOMATIS };
    expect(putuskanPembaruan('bebas', habis)).toBe('tawarkan');
    expect(putuskanPembaruan('bebas', { ...habis, tersembunyi: true })).toBe('tawarkan');
    expect(putuskanPembaruan('tidak', habis)).toBe('tunda');
  });
});

describe('serverBeda (/healthz)', () => {
  it('sha beda = beda; sha sama (juga beda panjang) = sama', () => {
    expect(serverBeda(BUILD, { ok: true, versi: '0.2.1', sha: 'e4f5a6b' })).toBe(true);
    expect(serverBeda(BUILD, { ok: true, versi: '0.2.0', sha: 'a1b2c3d' })).toBe(false);
    expect(serverBeda(BUILD, { sha: 'A1B2C3D' })).toBe(false);
    expect(serverBeda({ sha: 'a1b2c3d4' }, { sha: 'a1b2c3d' })).toBe(false);
  });
  it('build dev, server tanpa sha, atau jawaban aneh: diabaikan', () => {
    expect(serverBeda({ sha: 'dev' }, { sha: 'e4f5a6b' })).toBe(false);
    expect(serverBeda({ sha: '' }, { sha: 'e4f5a6b' })).toBe(false);
    expect(serverBeda(BUILD, { sha: 'dev' })).toBe(false);
    expect(serverBeda(BUILD, { ok: true })).toBe(false);
    expect(serverBeda(BUILD, null)).toBe(false);
    expect(serverBeda(BUILD, '<!doctype html>')).toBe(false);
    expect(serverBeda(BUILD, { sha: 12345678 })).toBe(false);
  });
});

describe('percobaan muat ulang (sessionStorage)', () => {
  beforeEach(() => sessionStorage.clear());

  it('dihitung per build yang sedang jalan; build lain mulai dari 0', () => {
    expect(bacaPercobaan(sessionStorage, BUILD)).toBe(0);
    catatPercobaan(sessionStorage, BUILD);
    catatPercobaan(sessionStorage, BUILD);
    expect(bacaPercobaan(sessionStorage, BUILD)).toBe(2);
    expect(bacaPercobaan(sessionStorage, BUILD_BARU)).toBe(0);
    // Dua build dari commit yang sama tetap dibedakan (waktu build).
    expect(bacaPercobaan(sessionStorage, { ...BUILD, waktu: '2026-10-13T01:00:00.000Z' })).toBe(0);
  });

  it('data rusak atau storage yang melempar galat = 0, tidak meledak', () => {
    sessionStorage.setItem('remi.pembaruanOtomatis', '{rusak');
    expect(bacaPercobaan(sessionStorage, BUILD)).toBe(0);
    sessionStorage.setItem('remi.pembaruanOtomatis', JSON.stringify({ build: 'x', n: 'banyak' }));
    expect(bacaPercobaan(sessionStorage, BUILD)).toBe(0);
    const rusak: PenyimpananSesi = {
      getItem: () => {
        throw new Error('diblokir');
      },
      setItem: () => {
        throw new Error('diblokir');
      },
      removeItem: () => {
        throw new Error('diblokir');
      },
    };
    expect(bacaPercobaan(rusak, BUILD)).toBe(0);
    expect(() => catatPercobaan(rusak, BUILD)).not.toThrow();
    expect(pesanSesudahPembaruan(rusak, BUILD)).toBeNull();
    expect(bacaPercobaan(null, BUILD)).toBe(0);
  });

  it('sesudah muat ulang: pesan hanya kalau build memang berganti, dan cuma sekali', () => {
    catatPercobaan(sessionStorage, BUILD);
    expect(pesanSesudahPembaruan(sessionStorage, BUILD_BARU)).toBe('Sudah pakai versi terbaru, v0.2.1 (e4f5a6b).');
    expect(pesanSesudahPembaruan(sessionStorage, BUILD_BARU)).toBeNull();
    catatPercobaan(sessionStorage, BUILD);
    // Pembaruan gagal (masih build lama): diam saja.
    expect(pesanSesudahPembaruan(sessionStorage, BUILD)).toBeNull();
  });
});

describe('bolehCek', () => {
  it('dibatasi JEDA_CEK_MIN_MS kecuali dipaksa', () => {
    expect(bolehCek(null, 0)).toBe(true);
    expect(bolehCek(1000, 1000 + JEDA_CEK_MIN_MS - 1)).toBe(false);
    expect(bolehCek(1000, 1000 + JEDA_CEK_MIN_MS)).toBe(true);
    expect(bolehCek(1000, 1001, true)).toBe(true);
  });
});

describe('PengelolaPembaruan', () => {
  let keadaan: KeadaanPembaruan;
  let tersembunyi: boolean;
  let toast: { pesan: string; aksi?: { label: string; jalankan: () => void } }[];
  let aktifkanSW: ReturnType<typeof vi.fn>;
  let muatUlang: ReturnType<typeof vi.fn>;
  let tombol: ((() => void) | null)[];

  const buat = (penyimpanan: PenyimpananSesi | null = sessionStorage) =>
    new PengelolaPembaruan({
      build: BUILD,
      keadaan: () => keadaan,
      tersembunyi: () => tersembunyi,
      aktifkanSW: aktifkanSW as unknown as () => void,
      muatUlang: muatUlang as unknown as () => void,
      toast: (pesan, aksi) => toast.push({ pesan, aksi }),
      saatTombolBerubah: (f) => tombol.push(f),
      penyimpanan,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    keadaan = beranda();
    tersembunyi = false;
    toast = [];
    aktifkanSW = vi.fn();
    muatUlang = vi.fn();
    tombol = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tanpa versi baru: tidak melakukan apa-apa', () => {
    const p = buat();
    vi.advanceTimersByTime(DIAM_MS * 3);
    p.nilai();
    vi.advanceTimersByTime(60_000);
    expect(p.adaVersiBaru).toBe(false);
    expect(p.tombol()).toBeNull();
    expect(toast).toEqual([]);
    expect(aktifkanSW).not.toHaveBeenCalled();
    expect(muatUlang).not.toHaveBeenCalled();
  });

  it('di beranda, pemain diam: toast "Pakai versi terbaru…" lalu SW diaktifkan tanpa klik', () => {
    const p = buat();
    vi.advanceTimersByTime(DIAM_MS);
    p.versiBaruSiap();
    expect(tombol.at(-1)).toBeTypeOf('function');
    expect(toast.map((t) => t.pesan)).toEqual([TEKS_PASANG]);
    expect(aktifkanSW).not.toHaveBeenCalled();
    vi.advanceTimersByTime(JEDA_TOAST_MS);
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
    expect(bacaPercobaan(sessionStorage, BUILD)).toBe(1);
    // SW baru mengambil alih (permintaan kita sendiri): muat ulang sekarang.
    p.swMengambilAlih();
    expect(muatUlang).toHaveBeenCalledTimes(1);
  });

  it('cadangan: kalau SW baru tidak mengambil alih, halaman tetap dimuat ulang', () => {
    tersembunyi = true;
    const p = buat();
    p.versiBaruSiap();
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
    expect(muatUlang).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CADANGAN_MUAT_ULANG_MS);
    expect(muatUlang).toHaveBeenCalledTimes(1);
    expect(toast).toEqual([]);
  });

  it('pemain menyentuh layar saat toast menghitung mundur: dibatalkan, dicoba lagi setelah diam', () => {
    const p = buat();
    vi.advanceTimersByTime(DIAM_MS);
    p.versiBaruSiap();
    vi.advanceTimersByTime(JEDA_TOAST_MS / 2);
    expect(p.catatInteraksi()).toBe(true);
    vi.advanceTimersByTime(JEDA_TOAST_MS);
    expect(aktifkanSW).not.toHaveBeenCalled();
    // Dinilai ulang berkala: setelah diam DIAM_MS, toast baru lalu pasang.
    vi.advanceTimersByTime(DIAM_MS + NILAI_ULANG_MS + JEDA_TOAST_MS);
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
    expect(toast.filter((t) => t.pesan === TEKS_PASANG).length).toBe(2);
  });

  it('pemain membuka dialog selama toast: dibatalkan di detik terakhir', () => {
    const p = buat();
    vi.advanceTimersByTime(DIAM_MS);
    p.versiBaruSiap();
    keadaan = beranda({ dialogTerbuka: true });
    vi.advanceTimersByTime(JEDA_TOAST_MS);
    expect(aktifkanSW).not.toHaveBeenCalled();
    expect(p.adaVersiBaru).toBe(true);
  });

  it('di tengah putaran offline: tidak pernah dimuat ulang (juga saat tab disembunyikan); begitu ke beranda, terpasang sendiri', () => {
    keadaan = meja('offline', 'putaranBerjalan');
    const p = buat();
    p.versiBaruSiap();
    for (const s of ['putaranBerjalan', 'susunAkhir', 'putaranSelesai', 'putaranBerjalan']) {
      keadaan = meja('offline', s);
      tersembunyi = !tersembunyi;
      p.nilai();
      vi.advanceTimersByTime(60_000);
    }
    expect(toast).toEqual([]);
    expect(aktifkanSW).not.toHaveBeenCalled();
    expect(muatUlang).not.toHaveBeenCalled();
    // Panel mentung di putaran terakhir masih tampil walau view terbaru sudah 'selesai' dan tercatat.
    keadaan = meja('offline', 'selesai', { selesaiTercatat: true, mejaSibuk: true });
    for (const t of [false, true]) {
      tersembunyi = t;
      p.nilai();
      vi.advanceTimersByTime(30_000);
    }
    // Klasemen akhir sedang dibaca: tidak ditawarkan, tidak dimuat ulang (juga saat tersembunyi).
    keadaan = meja('offline', 'selesai', { selesaiTercatat: true, klasemenTampil: true });
    for (const t of [false, true]) {
      tersembunyi = t;
      p.nilai();
      vi.advanceTimersByTime(30_000);
    }
    expect(toast).toEqual([]);
    expect(aktifkanSW).not.toHaveBeenCalled();
    expect(muatUlang).not.toHaveBeenCalled();
    tersembunyi = false;
    // Kembali ke beranda: dipasang otomatis setelah pemain diam.
    keadaan = beranda();
    p.nilai();
    vi.advanceTimersByTime(DIAM_MS + NILAI_ULANG_MS + JEDA_TOAST_MS);
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
  });

  it('klasemen akhir lalu tab disembunyikan: ditahan; pemain ke beranda (tab tersembunyi) = dipasang diam-diam', () => {
    keadaan = meja('online', 'selesai', { selesaiTercatat: true, klasemenTampil: true });
    const p = buat();
    p.versiBaruSiap();
    tersembunyi = true;
    p.nilai();
    vi.advanceTimersByTime(60_000);
    expect(aktifkanSW).not.toHaveBeenCalled();
    keadaan = beranda();
    p.nilai();
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
  });

  it('jeda antarputaran online: panel mentung/animasi menahan; sesudah antrian habis dan tab tersembunyi = dipasang', () => {
    keadaan = meja('online', 'putaranSelesai', { mejaSibuk: true });
    const p = buat();
    p.versiBaruSiap();
    tersembunyi = true;
    p.nilai();
    vi.advanceTimersByTime(60_000);
    expect(aktifkanSW).not.toHaveBeenCalled();
    keadaan = meja('online', 'putaranSelesai');
    vi.advanceTimersByTime(NILAI_ULANG_MS);
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
  });

  it('tombol manual "Muat ulang" (toast/kaki beranda) tetap jalan, juga saat jatah otomatis habis', () => {
    catatPercobaan(sessionStorage, BUILD);
    catatPercobaan(sessionStorage, BUILD);
    const p = buat();
    vi.advanceTimersByTime(DIAM_MS);
    p.versiBaruSiap();
    vi.advanceTimersByTime(60_000);
    tersembunyi = true;
    p.nilai();
    expect(aktifkanSW).not.toHaveBeenCalled();
    expect(toast.map((t) => t.pesan)).toEqual([TEKS_TAWARAN]);
    toast[0].aksi!.jalankan();
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
  });

  it('anti-loop: build yang sama tidak dimuat ulang otomatis lebih dari MAKS kali (simulasi beberapa kali muat)', () => {
    tersembunyi = true;
    let pasang = 0;
    for (let muat = 0; muat < 5; muat++) {
      aktifkanSW.mockClear();
      const p = buat();
      p.versiBaruSiap(); // SW yang menunggu tetap menunggu (pesan skipWaiting hilang)
      pasang += aktifkanSW.mock.calls.length;
    }
    expect(pasang).toBe(MAKS_MUAT_ULANG_OTOMATIS);
  });

  it('anti-loop tetap jalan walau sessionStorage tidak bisa dipakai (dalam satu halaman)', () => {
    tersembunyi = true;
    const p = buat(null);
    p.versiBaruSiap();
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
    p.nilai();
    vi.advanceTimersByTime(60_000);
    expect(aktifkanSW).toHaveBeenCalledTimes(1);
  });

  it('SW baru diaktifkan tab lain di tengah putaran: tab ini tidak dimuat ulang sampai momen aman', () => {
    keadaan = meja('online', 'putaranBerjalan');
    const p = buat();
    p.versiBaruSiap();
    p.swMengambilAlih();
    vi.advanceTimersByTime(60_000);
    expect(muatUlang).not.toHaveBeenCalled();
    keadaan = beranda();
    tersembunyi = true;
    p.nilai();
    // Sudah aktif: cukup muat ulang biasa, tanpa skipWaiting lagi.
    expect(muatUlang).toHaveBeenCalledTimes(1);
    expect(aktifkanSW).not.toHaveBeenCalled();
  });

  it('server sudah build lain tanpa service worker: muat ulang biasa di momen aman', () => {
    keadaan = beranda({ layar: 'lobi', jenis: 'online' });
    const p = buat();
    p.perluMuatUlangBiasa();
    expect(p.adaVersiBaru).toBe(true);
    expect(muatUlang).not.toHaveBeenCalled();
    tersembunyi = true;
    p.nilai();
    expect(muatUlang).toHaveBeenCalledTimes(1);
    expect(aktifkanSW).not.toHaveBeenCalled();
  });
});

describe('pasangPenjawabSapa (jembatan transisi 0.1 → 0.2)', () => {
  /** Tiruan navigator.serviceWorker: hanya addEventListener('message') + startMessages. */
  function wadahPalsu() {
    const t = new EventTarget();
    return Object.assign(t, { startMessages: vi.fn() }) as EventTarget & { startMessages: ReturnType<typeof vi.fn> };
  }
  const kirim = (w: EventTarget, data: unknown, init: { ports?: MessagePort[]; source?: unknown } = {}) =>
    w.dispatchEvent(Object.assign(new MessageEvent('message', { data }), { ports: init.ports ?? [], source: init.source ?? null }) as MessageEvent);

  it('menjawab REMI_SAPA lewat port MessageChannel, dengan versi build', async () => {
    const w = wadahPalsu();
    expect(pasangPenjawabSapa(w as never, '0.2.0+abc1234')).toBe(true);
    expect(w.startMessages).toHaveBeenCalledTimes(1);
    const saluran = new MessageChannel();
    const jawaban = new Promise<unknown>((ok) => (saluran.port1.onmessage = (e) => ok(e.data)));
    kirim(w, { t: SAPA_SW }, { ports: [saluran.port2] });
    await expect(jawaban).resolves.toEqual({ t: JAWAB_SW, versi: '0.2.0+abc1234' });
    saluran.port1.close();
  });

  it('tanpa port: jawab ke SW pengirim (event.source)', () => {
    const w = wadahPalsu();
    pasangPenjawabSapa(w as never, 'v');
    const sumber = { postMessage: vi.fn() };
    kirim(w, { t: SAPA_SW }, { source: sumber });
    expect(sumber.postMessage).toHaveBeenCalledWith({ t: JAWAB_SW, versi: 'v' });
  });

  it('pesan lain (mis. dari workbox) diabaikan; SW yang sudah hilang tidak membuat galat', () => {
    const w = wadahPalsu();
    pasangPenjawabSapa(w as never, 'v');
    const sumber = { postMessage: vi.fn() };
    for (const data of [null, 'REMI_SAPA', { type: 'SKIP_WAITING' }, { t: 'lain' }]) kirim(w, data, { source: sumber });
    expect(sumber.postMessage).not.toHaveBeenCalled();
    const rusak = {
      postMessage: () => {
        throw new Error('InvalidStateError');
      },
    };
    expect(() => kirim(w, { t: SAPA_SW }, { source: rusak })).not.toThrow();
  });

  it('browser tanpa service worker: tidak dipasang', () => {
    expect(pasangPenjawabSapa(null, 'v')).toBe(false);
    expect(pasangPenjawabSapa(undefined, 'v')).toBe(false);
  });
});
