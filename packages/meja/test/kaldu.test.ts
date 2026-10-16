// Mode kaldu di meja (keputusan pemilik #42, #43): pengaturan lobi, batas skor tidak dipakai, voting
// "putaran berikutnya terakhir" yang meniru voting akhiri (termasuk hitung ulang saat pemilih
// berkurang, #36), dan klasemen akhir.

import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import { Meja, validasiPengaturan, validasiPesan, type DataMeja, type PengaturanMeja, type RingkasanAkhir } from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

type Ctx = ReturnType<typeof siapkan> & { meja: Meja };

/** Jalankan sampai putaran berjalan selesai; manusia di `manusia` dijalankan otomatis. */
function mainkanSampaiPutaranSelesai(ctx: Ctx, manusia: string[], rng = new Rng(9)): void {
  for (let i = 0; i < 5000; i++) {
    const st = ctx.meja.data.game?.status;
    if (st !== 'putaranBerjalan' && st !== 'susunAkhir') return;
    if (manusia.some((p) => aksiManusia(ctx.meja, ctx.surat, p, rng))) continue;
    if (!ctx.jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran manusia');
  }
  throw new Error('putaran tidak selesai');
}

/** Host Budi + Siti (manusia) + satu warga kedai. */
function mejaDuaManusia(pengaturan: Partial<PengaturanMeja> = {}, extra: Parameters<typeof siapkan>[0] = {}): Ctx {
  const ctx = siapkan(extra);
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, modeKaldu: true, batasPutaran: null, ...pengaturan });
  meja.masuk('p2', 'Siti');
  meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  return { ...ctx, meja };
}

/** Meja offline: satu manusia + warga kedai. */
function mejaSendiri(pengaturan: Partial<PengaturanMeja> = {}, extra: Parameters<typeof siapkan>[0] = {}): Ctx {
  const ctx = siapkan(extra);
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, modeKaldu: true, batasPutaran: null, ...pengaturan });
  meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
  meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  return { ...ctx, meja };
}

function sampaiPutaranSelesai(ctx: Ctx, manusia: string[]): Ctx {
  ctx.meja.terima('host', { t: 'mulai', pengocok: 0 });
  siapSemua(ctx.meja);
  mainkanSampaiPutaranSelesai(ctx, manusia);
  expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
  return ctx;
}

const duaManusiaSelesaiSatu = (pengaturan: Partial<PengaturanMeja> = {}) => sampaiPutaranSelesai(mejaDuaManusia(pengaturan), ['host', 'p2']);

describe('pengaturan mode kaldu', () => {
  it('mulai: modeKaldu hanya dikirim ke engine kalau aktif, dan batas skor jadi null (#43)', () => {
    const kaldu = mejaSendiri({ batasSkorAtas: 500, batasSkorBawah: -500, batasPutaran: 4 });
    kaldu.meja.terima('host', { t: 'mulai' });
    expect(kaldu.meja.data.game!.konfigurasi).toMatchObject({ modeKaldu: true, batasSkorAtas: null, batasSkorBawah: null, batasPutaran: 4 });
    // Isian batas skor tetap tersimpan di pengaturan meja.
    expect(kaldu.meja.data.pengaturan).toMatchObject({ modeKaldu: true, batasSkorAtas: 500, batasSkorBawah: -500 });

    const biasa = mejaSendiri({ modeKaldu: false, batasSkorAtas: 500, batasSkorBawah: -500 });
    biasa.meja.terima('host', { t: 'mulai' });
    expect(biasa.meja.data.game!.konfigurasi).not.toHaveProperty('modeKaldu');
    expect(biasa.meja.data.game!.konfigurasi).toMatchObject({ batasSkorAtas: 500, batasSkorBawah: -500 });
    const bawaan = siapkan();
    const m = Meja.buat(bawaan.opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0 });
    m.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    m.terima('host', { t: 'mulai' });
    expect(m.data.pengaturan).not.toHaveProperty('modeKaldu');
    expect(m.data.game!.konfigurasi).not.toHaveProperty('modeKaldu');
  });

  it('hanya bisa diubah host di lobi', () => {
    const ctx = mejaDuaManusia({ modeKaldu: false });
    ctx.meja.terima('p2', { t: 'pengaturan', pengaturan: { modeKaldu: true } });
    expect(ctx.surat.errors('p2').at(-1)).toContain('host');
    ctx.meja.terima('host', { t: 'pengaturan', pengaturan: { modeKaldu: true } });
    expect(ctx.surat.info('p2').pengaturan.modeKaldu).toBe(true);
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    ctx.meja.terima('host', { t: 'pengaturan', pengaturan: { modeKaldu: false } });
    expect(ctx.surat.errors('host').at(-1)).toBe('Pengaturan cuma bisa diubah sebelum permainan mulai.');
    expect(ctx.meja.data.game!.konfigurasi.modeKaldu).toBe(true);
  });

  it('validasi: modeKaldu harus boolean, pesan putaranTerakhir seperti akhiri', () => {
    expect(validasiPengaturan({ modeKaldu: true })).toEqual({ modeKaldu: true });
    expect(validasiPengaturan({ modeKaldu: false })).toEqual({ modeKaldu: false });
    expect(validasiPengaturan({ modeKaldu: 'ya' })).toBeNull();
    expect(validasiPengaturan({ modeKaldu: 1 })).toBeNull();
    expect(validasiPengaturan({ modeKaldu: null })).toBeNull();
    expect(validasiPesan({ t: 'buat', nama: 'Budi', pengaturan: { modeKaldu: true } })).toEqual({ t: 'buat', nama: 'Budi', pengaturan: { modeKaldu: true } });
    expect(validasiPesan({ t: 'putaranTerakhir', setuju: true })).toEqual({ t: 'putaranTerakhir', setuju: true });
    expect(validasiPesan({ t: 'putaranTerakhir', setuju: false })).toEqual({ t: 'putaranTerakhir', setuju: false });
    expect(validasiPesan({ t: 'putaranTerakhir' })).toBeNull();
    expect(validasiPesan({ t: 'putaranTerakhir', setuju: 'ya' })).toBeNull();
    // Bukan aksi giliran: tidak bisa diselundupkan lewat pesan aksi.
    expect(validasiPesan({ t: 'aksi', aksi: { jenis: 'putaranTerakhir' } })).toBeNull();
  });
});

describe('voting "putaran berikutnya terakhir"', () => {
  it('dua manusia: dua-duanya harus setuju; penghitung ada di InfoMeja; lalu putaran berikutnya kaldu', () => {
    const ctx = duaManusiaSelesaiSatu();
    expect(ctx.surat.info('host').setujuKaldu).toEqual([]);
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(ctx.surat.info('p2').setujuKaldu).toEqual([0]);
    expect(ctx.meja.data.setujuKaldu).toEqual([0]);
    expect(ctx.meja.data.game!.kalduDiminta).toBeUndefined();
    // Batal lalu setuju lagi.
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: false });
    expect(ctx.surat.info('p2').setujuKaldu).toEqual([]);
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    expect(ctx.surat.errors('host')).toEqual([]);
    expect(ctx.surat.errors('p2')).toEqual([]);
    expect(ctx.meja.data.game!.kalduDiminta).toBe(true);
    expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
    expect(ctx.surat.view('p2').kalduDiminta).toBe(true);
    expect(ctx.surat.info('host').setujuKaldu).toEqual([]);
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');
    ctx.meja.terima('host', { t: 'putaranBerikut' });
    expect(ctx.meja.data.game!.putaran).toMatchObject({ nomor: 2, kaldu: true });
    expect(ctx.surat.view('p2').putaran!.kaldu).toBe(true);
  });

  it('meja offline dengan satu manusia: langsung berlaku', () => {
    const ctx = sampaiPutaranSelesai(mejaSendiri(), ['host']);
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(ctx.surat.errors('host')).toEqual([]);
    expect(ctx.meja.data.game!.kalduDiminta).toBe(true);
    expect(ctx.surat.info('host').setujuKaldu).toEqual([]);
    ctx.meja.terima('host', { t: 'putaranBerikut' });
    expect(ctx.meja.data.game!.putaran!.kaldu).toBe(true);
  });

  it('ditolak di tengah putaran, di meja tanpa mode kaldu, dan kalau putaran berikutnya sudah kaldu', () => {
    const ctx = mejaDuaManusia();
    ctx.meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(ctx.meja);
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(ctx.surat.errors('host').at(-1)).toBe('Putaran terakhir cuma bisa diminta di antara putaran.');
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');

    const biasa = duaManusiaSelesaiSatu({ modeKaldu: false });
    biasa.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(biasa.surat.errors('host').at(-1)).toBe('Meja ini nggak pakai mode kaldu.');
    expect(biasa.meja.data).not.toHaveProperty('setujuKaldu');

    // Batas putaran 2: putaran 2 sudah pasti kaldu.
    const batas = duaManusiaSelesaiSatu({ batasPutaran: 2 });
    batas.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    expect(batas.surat.errors('p2').at(-1)).toBe('Putaran berikutnya memang sudah putaran terakhir.');
    // Sesudah voting berlaku juga ditolak.
    const sudah = duaManusiaSelesaiSatu();
    sudah.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    sudah.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    sudah.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(sudah.surat.errors('host').at(-1)).toBe('Putaran berikutnya memang sudah putaran terakhir.');
  });

  it('suara dikosongkan saat putaran berikutnya dimulai dan saat main lagi', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    expect(ctx.surat.info('host').setujuKaldu).toEqual([1]);
    ctx.meja.terima('host', { t: 'putaranBerikut' });
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');
    expect(ctx.surat.info('host').setujuKaldu).toEqual([]);
    expect(ctx.meja.data.game!.putaran!.kaldu).toBeUndefined();
    siapSemua(ctx.meja);
    mainkanSampaiPutaranSelesai(ctx, ['host', 'p2']);
    ctx.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terima('host', { t: 'akhiri', setuju: true });
    ctx.meja.terima('p2', { t: 'akhiri', setuju: true });
    expect(ctx.meja.status).toBe('selesai');
    ctx.meja.terima('host', { t: 'mainLagi' });
    expect(ctx.meja.status).toBe('lobi');
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');
  });

  it('"Akhiri permainan" tetap jalan di meja kaldu, juga sesudah voting kaldu', () => {
    const laporan: RingkasanAkhir[] = [];
    const ctx = sampaiPutaranSelesai(mejaDuaManusia({}, { saatSelesai: (r) => laporan.push(r) }), ['host', 'p2']);
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terima('host', { t: 'akhiri', setuju: true });
    ctx.meja.terima('p2', { t: 'akhiri', setuju: true });
    expect(ctx.meja.status).toBe('selesai');
    expect(ctx.surat.view('host').alasanSelesai).toBe('sepakat');
    expect(laporan).toHaveLength(1);
    expect(laporan[0]).toMatchObject({ alasan: 'sepakat', modeKaldu: true });
  });
});

describe('voting kaldu saat pemilih berkurang (keputusan pemilik #36)', () => {
  it('yang setuju tinggal sendirian karena yang lain terputus → berlaku', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    expect(ctx.meja.data.game!.kalduDiminta).toBeUndefined();
    ctx.meja.terputus('p2');
    expect(ctx.meja.data.game!.kalduDiminta).toBe(true);
    expect(ctx.meja.status).toBe('main');
    expect(ctx.surat.view('host').kalduDiminta).toBe(true);
  });

  it('yang belum setuju keluar meja → berlaku', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terima('p2', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terima('host', { t: 'keluar' });
    expect(ctx.meja.data.game!.kalduDiminta).toBe(true);
    expect(ctx.surat.view('p2').kalduDiminta).toBe(true);
  });

  it('yang setuju sendiri yang terputus → suaranya dicabut, tidak berlaku', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terputus('host');
    expect(ctx.meja.data.game!.kalduDiminta).toBeUndefined();
    expect(ctx.surat.info('p2').setujuKaldu).toEqual([]);
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');
  });

  it('belum ada yang setuju: pemilih berkurang tidak membuat putaran kaldu', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terputus('p2');
    ctx.meja.terputus('host');
    expect(ctx.meja.data.game!.kalduDiminta).toBeUndefined();
  });

  it('voting akhiri didahulukan kalau dua-duanya lengkap sekaligus', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terima('host', { t: 'akhiri', setuju: true });
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    ctx.meja.terputus('p2');
    expect(ctx.meja.status).toBe('selesai');
    expect(ctx.surat.view('host').alasanSelesai).toBe('sepakat');
  });
});

describe('klasemen akhir dan simpanan', () => {
  it('permainan kaldu selesai karena putaran kaldu ditutup mentung: alasan kaldu, modeKaldu true', () => {
    const laporan: RingkasanAkhir[] = [];
    const ctx = mejaSendiri({ batasPutaran: 1 }, { saatSelesai: (r) => laporan.push(r) });
    ctx.meja.terima('host', { t: 'mulai' });
    for (let i = 0; i < 30 && ctx.meja.status !== 'selesai'; i++) {
      siapSemua(ctx.meja);
      mainkanSampaiPutaranSelesai(ctx, ['host']);
      if (ctx.meja.data.game!.status === 'putaranSelesai') ctx.meja.terima('host', { t: 'putaranBerikut' });
    }
    const g = ctx.meja.data.game!;
    expect(g.status).toBe('selesai');
    expect(g.riwayat.every((h) => h.kaldu)).toBe(true);
    expect(g.riwayat.at(-1)!.cara).toBe('mentung');
    expect(laporan).toHaveLength(1);
    expect(laporan[0]).toMatchObject({ alasan: 'kaldu', modeKaldu: true, jumlahPutaran: g.riwayat.length });
    expect(ctx.surat.errors('host')).toEqual([]);
  });

  it('meja tanpa mode kaldu: InfoMeja dan DataMeja tanpa setujuKaldu, klasemen modeKaldu false', () => {
    const laporan: RingkasanAkhir[] = [];
    // Seperti meja yang dibuat aplikasi lama: pengaturannya tidak memuat modeKaldu sama sekali.
    const ctx = sampaiPutaranSelesai(mejaSendiri({ modeKaldu: undefined }, { saatSelesai: (r) => laporan.push(r) }), ['host']);
    expect(ctx.surat.info('host')).not.toHaveProperty('setujuKaldu');
    expect(ctx.meja.data).not.toHaveProperty('setujuKaldu');
    ctx.meja.terima('host', { t: 'akhiri', setuju: true });
    expect(laporan[0]).toMatchObject({ alasan: 'sepakat', modeKaldu: false });
    expect(JSON.stringify(ctx.surat.semua('host'))).not.toContain('aldu');
  });

  it('DataMeja lama (tanpa modeKaldu dan setujuKaldu) tetap bisa dilanjutkan', () => {
    const ctx = sampaiPutaranSelesai(mejaSendiri({ modeKaldu: false }), ['host']);
    const data = JSON.parse(JSON.stringify(ctx.meja.data)) as DataMeja;
    ctx.meja.hentikan();
    delete data.pengaturan.modeKaldu;
    expect(data).not.toHaveProperty('setujuKaldu');
    const lanjut = new Meja(ctx.opsi, data);
    lanjut.terhubung('host');
    expect(ctx.surat.info('host')).not.toHaveProperty('setujuKaldu');
    lanjut.terima('host', { t: 'putaranBerikut' });
    expect(lanjut.data.game!.putaran!.nomor).toBe(2);
    expect(lanjut.data.game!.putaran).not.toHaveProperty('kaldu');
  });

  it('simpanan meja kaldu dengan suara tertunda dilanjutkan; suara rusak dibuang', () => {
    const ctx = duaManusiaSelesaiSatu();
    ctx.meja.terima('host', { t: 'putaranTerakhir', setuju: true });
    const data = JSON.parse(JSON.stringify(ctx.meja.data)) as DataMeja;
    ctx.meja.hentikan();
    expect(data.setujuKaldu).toEqual([0]);
    const lanjut = new Meja(ctx.opsi, data);
    expect(lanjut.data.setujuKaldu).toEqual([0]);
    lanjut.terima('p2', { t: 'putaranTerakhir', setuju: true });
    expect(lanjut.data.game!.kalduDiminta).toBe(true);
    lanjut.hentikan();

    const rusak = new Meja(ctx.opsi, { ...data, setujuKaldu: 'semua' as unknown as number[] });
    expect(rusak.data).not.toHaveProperty('setujuKaldu');
    rusak.hentikan();
  });
});
