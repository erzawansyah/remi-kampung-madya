// @vitest-environment happy-dom
// Simpanan NYATA dari build 0.1.0 (fixture/simpanan-0.1.0.json, direkam dari UI 0.1 di Chrome) harus
// terbaca dan bisa dilanjutkan di versi ini. Pemain lama di HP membawa isi localStorage ini saat
// aplikasinya diperbarui: remi.mejaOffline, remi.efek, remi.riwayat, remi.urutanTangan, remi.nama,
// remi.sesiOnline, remi.pengaturanOffline.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pilihAksiBot, Rng, type ViewPemain } from '@remi/engine';
import type { InfoMeja, PesanKlien } from '@remi/meja';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Fixture {
  tengahPutaran: Record<string, string>;
  sesudahSelesai: Record<string, string>;
  sesiOnline: string;
}
// join + fileURLToPath: di happy-dom, URL global bukan milik Node sehingga ditolak readFileSync.
const FIXTURE: Fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixture/simpanan-0.1.0.json'), 'utf8'));

function isi(kunci: Record<string, string>) {
  localStorage.clear();
  for (const [k, v] of Object.entries(kunci)) localStorage.setItem(k, v);
}

/** Modul ber-cache (preferensi) dimuat ulang per test, seperti halaman yang baru dibuka. */
async function muat() {
  vi.resetModules();
  const penyimpanan = await import('../src/penyimpanan');
  const preferensi = await import('../src/preferensi');
  const koneksi = await import('../src/koneksi');
  const beranda = await import('../src/ui/beranda');
  return { ...penyimpanan, ...preferensi, ...koneksi, ...beranda };
}

beforeEach(() => {
  // Disuntik Vite saat build; beranda.ts (infoSimpanan) ikut memuat versi.ts.
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('simpanan 0.1.0: terbaca apa adanya', () => {
  it('fixture memang rekaman 0.1.0: semua kunci lama ada', () => {
    expect(Object.keys(FIXTURE.tengahPutaran).sort()).toEqual([
      'remi.efek',
      'remi.mejaOffline',
      'remi.nama',
      'remi.pengaturanOffline',
      'remi.urutanTangan',
    ]);
    expect(Object.keys(FIXTURE.sesudahSelesai)).toContain('remi.riwayat');
    // Bentuk 0.1: belum ada field yang ditambahkan sesudahnya (diisi migrasi saat dimuat).
    const data = JSON.parse(FIXTURE.tengahPutaran['remi.mejaOffline']);
    expect(data.versi).toBe(1);
    expect(data).not.toHaveProperty('sudahLihatJoker');
  });

  it('nama, pengaturan offline, urutan tangan, dan sesi online terbaca tanpa dibuang', async () => {
    isi({ ...FIXTURE.tengahPutaran, 'remi.sesiOnline': FIXTURE.sesiOnline });
    const m = await muat();
    expect(m.simpan.nama()).toBe('Budi');
    expect(m.simpan.pengaturanOffline()).toMatchObject({ jumlahPemain: 3, tempoBot: 'cepat', levelBot: 'normal' });
    const urutan = m.simpan.urutanTangan();
    expect(urutan).toEqual(JSON.parse(FIXTURE.tengahPutaran['remi.urutanTangan']));
    expect(urutan.length).toBeGreaterThan(0);
    expect(m.simpan.sesi()).toEqual(JSON.parse(FIXTURE.sesiOnline));
    // Tidak ada kunci 0.1 yang dihapus karena dianggap rusak.
    for (const k of [...Object.keys(FIXTURE.tengahPutaran), 'remi.sesiOnline']) expect(localStorage.getItem(k), k).not.toBeNull();
  });

  it('remi.efek 0.1 ({suara:false, getar:true}) jadi preferensi baru', async () => {
    isi(FIXTURE.tengahPutaran);
    const m = await muat();
    expect(JSON.parse(FIXTURE.tengahPutaran['remi.efek'])).toEqual({ suara: false, getar: true });
    const p = m.preferensi();
    expect(p.suara).toBe(false);
    expect(p.getar).toBe(true);
  });

  it('riwayat 0.1 (tanpa penanda bot) terbaca utuh', async () => {
    isi(FIXTURE.sesudahSelesai);
    const m = await muat();
    const r = m.simpan.riwayat();
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual(JSON.parse(FIXTURE.sesudahSelesai['remi.riwayat'])[0]);
    expect(r[0].klasemen.every((b) => !('bot' in b))).toBe(true);
  });
});

describe('simpanan 0.1.0: permainan offline', () => {
  it('tengah putaran: beranda menawarkan Lanjutkan', async () => {
    isi(FIXTURE.tengahPutaran);
    const m = await muat();
    expect(m.infoSimpanan()).toEqual({ teks: '3 pemain · putaran 1 · skormu 0', latihan: false });
  });

  it('tengah putaran: dilanjutkan dan dimainkan sampai putaran berikutnya tanpa aksi yang ditolak', async () => {
    isi(FIXTURE.tengahPutaran);
    const m = await muat();
    const k = m.KoneksiOffline.lanjutkan();
    expect(k).not.toBeNull();
    let view: ViewPemain | null = null;
    let info: InfoMeja | null = null;
    const galat: string[] = [];
    k!.saatPesan((p) => {
      if (p.t === 'view') view = p.view;
      if (p.t === 'meja') info = p.info;
      if (p.t === 'error') galat.push(p.pesan);
    });
    await vi.advanceTimersByTimeAsync(0);
    const awal = view as ViewPemain | null;
    expect(awal?.status).toBe('putaranBerjalan');
    expect(awal?.saya).toBe(0);
    expect(awal?.pemain.map((p) => p.nama)).toEqual(['Budi', 'Bot 1', 'Bot 2']);
    // Tangan dari simpanan 0.1 tampil utuh (sumber kebenarannya DataMeja, bukan remi.urutanTangan).
    const data = JSON.parse(FIXTURE.tengahPutaran['remi.mejaOffline']);
    expect((awal as ViewPemain).putaran!.tangan[0]!.map((x) => x.id).sort()).toEqual(data.game.putaran.tangan[0].map((x: { id: string }) => x.id).sort());

    // "Saya" dimainkan bot dari view yang diterima UI, sampai putaran 2 berjalan.
    const rng = new Rng(11);
    let diproses: ViewPemain | null = null;
    for (let i = 0; i < 6000; i++) {
      await vi.advanceTimersByTimeAsync(250);
      const v = view as ViewPemain | null;
      const im = info as InfoMeja | null;
      if (!v || !im) continue;
      if (v.status === 'putaranBerjalan' && v.putaran!.nomor >= 2 && !im.menungguJoker.length) break;
      if (v === diproses) continue;
      if (im.menungguJoker.includes(0)) {
        diproses = v;
        k!.kirim({ t: 'siapJoker' });
        continue;
      }
      if (v.status === 'putaranSelesai') {
        diproses = v;
        k!.kirim({ t: 'putaranBerikut' });
        continue;
      }
      const p = v.putaran;
      const giliranku = (v.status === 'putaranBerjalan' && p?.giliran === 0) || (v.status === 'susunAkhir' && !p?.selesaiSusun[0]);
      if (!giliranku) continue;
      diproses = v;
      const { pemain: _, ...aksi } = pilihAksiBot(v, 'normal', rng) as { pemain?: number };
      k!.kirim({ t: 'aksi', aksi } as PesanKlien);
    }
    const akhir = view as ViewPemain | null;
    expect(galat).toEqual([]);
    expect(akhir?.riwayat.length).toBeGreaterThanOrEqual(1);
    expect(akhir?.putaran?.nomor).toBeGreaterThanOrEqual(2);
    // Simpanan ditulis ulang dalam bentuk baru (field yang ditambahkan sesudah 0.1 ikut terisi).
    await vi.advanceTimersByTimeAsync(1000);
    const baru = JSON.parse(localStorage.getItem('remi.mejaOffline')!);
    expect(baru.versi).toBe(1);
    expect(baru).toHaveProperty('sudahLihatJoker');
    expect(baru.game.status).toBe('putaranBerjalan');
    k!.tutup();
  }, 60_000);

  it('sisa simpanan 0.1 yang sudah selesai: tidak ditawarkan, dibuang saat dicoba, riwayat tetap', async () => {
    isi(FIXTURE.sesudahSelesai);
    const m = await muat();
    expect(JSON.parse(FIXTURE.sesudahSelesai['remi.mejaOffline']).game.status).toBe('selesai');
    expect(m.infoSimpanan()).toBeNull();
    expect(m.KoneksiOffline.lanjutkan()).toBeNull();
    expect(localStorage.getItem('remi.mejaOffline')).toBeNull();
    expect(m.simpan.riwayat()).toHaveLength(1);
  });
});
