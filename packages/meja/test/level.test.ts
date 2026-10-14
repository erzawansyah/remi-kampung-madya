// Level warga kedai di meja: validasi pesan dari jaringan (semua level DAFTAR_LEVEL_BOT diterima, sisanya
// ditolak) dan level dari data yang tidak dipercaya penuh (simpanan offline di HP, isian UI) yang
// dirapikan jadi 'normal' supaya meja tetap jalan.

import { describe, expect, it, vi } from 'vitest';
import { DAFTAR_LEVEL_BOT, Rng, type LevelBot } from '@remi/engine';
import { isLevel, Meja, PENGATURAN_BAWAAN, rapikanLevel, validasiPengaturan, validasiPesan, type DataMeja } from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

/** Nilai yang bukan level: salah eja/huruf, level karangan, nilai UI, kunci prototipe, bukan string. */
const BUKAN_LEVEL: unknown[] = ['', 'Jago', 'SUHU', 'sulit', 'dewa', 'bot-jago', 'toString', '__proto__', 0, 1, null, true, {}, ['jago']];

describe('validasi level warga kedai', () => {
  it('urutan level dari yang paling mudah: mudah, normal, jago, suhu; bawaan normal', () => {
    expect(DAFTAR_LEVEL_BOT).toEqual(['mudah', 'normal', 'jago', 'suhu']);
    expect(PENGATURAN_BAWAAN.levelBot).toBe('normal');
  });

  it.each(DAFTAR_LEVEL_BOT)('level %s diterima di aturKursi, pengaturan, dan buat', (level) => {
    expect(isLevel(level)).toBe(true);
    expect(validasiPesan({ t: 'aturKursi', kursi: 1, jenis: 'bot', level })).toEqual({ t: 'aturKursi', kursi: 1, jenis: 'bot', level });
    expect(validasiPesan({ t: 'aturKursi', kursi: 1, jenis: 'kosong', level })).toEqual({ t: 'aturKursi', kursi: 1, jenis: 'kosong', level });
    expect(validasiPengaturan({ levelBot: level })).toEqual({ levelBot: level });
    expect(validasiPesan({ t: 'pengaturan', pengaturan: { levelBot: level } })).toEqual({ t: 'pengaturan', pengaturan: { levelBot: level } });
    expect(validasiPesan({ t: 'buat', nama: 'Budi', pengaturan: { levelBot: level } })).toEqual({
      t: 'buat',
      nama: 'Budi',
      pengaturan: { levelBot: level },
    });
  });

  it.each(BUKAN_LEVEL)('bukan level ditolak: %j', (level) => {
    expect(isLevel(level)).toBe(false);
    expect(validasiPesan({ t: 'aturKursi', kursi: 1, jenis: 'bot', level })).toBeNull();
    expect(validasiPengaturan({ levelBot: level })).toBeNull();
    expect(validasiPesan({ t: 'pengaturan', pengaturan: { levelBot: level } })).toBeNull();
    expect(validasiPesan({ t: 'buat', nama: 'Budi', pengaturan: { levelBot: level } })).toBeNull();
  });

  it('aturKursi tanpa level tetap diterima (meja memakai level bawaannya)', () => {
    expect(validasiPesan(JSON.parse('{"t":"aturKursi","kursi":2,"jenis":"bot"}'))).toEqual({ t: 'aturKursi', kursi: 2, jenis: 'bot', level: undefined });
  });

  it('rapikanLevel: level sah dibiarkan, selain itu jadi normal', () => {
    for (const level of DAFTAR_LEVEL_BOT) expect(rapikanLevel(level)).toBe(level);
    for (const x of [...BUKAN_LEVEL, undefined]) expect(rapikanLevel(x), JSON.stringify(x)).toBe('normal');
  });
});

describe('meja: level warga kedai', () => {
  it('host bisa memasang keempat level di kursi yang berbeda', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 5 });
    DAFTAR_LEVEL_BOT.forEach((level, j) => meja.terima('host', validasiPesan({ t: 'aturKursi', kursi: j + 1, jenis: 'bot', level })!));
    expect(surat.errors('host')).toEqual([]);
    expect(surat.info('host').kursi.slice(1).map((k) => [k.jenis, k.level])).toEqual(DAFTAR_LEVEL_BOT.map((l) => ['bot', l]));
  });

  it('levelBot meja jadi level kursi yang diisi tanpa level (tombol "ajak warga kedai")', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, levelBot: 'suhu' });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'pengaturan', pengaturan: { levelBot: 'jago' } });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    expect(surat.info('host').kursi.map((k) => k.level).slice(1)).toEqual(['suhu', 'jago']);
  });

  it('isian offline yang tidak lewat validasi jaringan: level rusak jadi normal', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, levelBot: 'dewa' as LevelBot });
    expect(meja.data.pengaturan.levelBot).toBe('normal');
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'dewa' as LevelBot });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot', level: 'jago' });
    expect(surat.info('host').kursi.map((k) => k.level)).toEqual(['normal', 'normal', 'jago']);
    // levelBot undefined yang ikut tersebar ({...pengaturan}) juga tidak menimpa bawaan.
    const lain = Meja.buat(siapkan().opsi, 'host', 'Budi', { jumlahPemain: 2, levelBot: undefined });
    expect(lain.data.pengaturan.levelBot).toBe('normal');
  });

  it('simpanan dengan level tidak dikenal dilanjutkan sebagai normal; level lama dan baru tetap', () => {
    const { opsi } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 4, detikGiliran: 0 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'mudah' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot', level: 'suhu' });
    meja.terima('host', { t: 'aturKursi', kursi: 3, jenis: 'bot', level: 'jago' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    const data: DataMeja = meja.data;
    meja.hentikan();
    const rusak = JSON.parse(JSON.stringify(data)) as { kursi: { level: unknown }[]; pengaturan: { levelBot: unknown } };
    rusak.kursi[3].level = 'dewa';
    rusak.pengaturan.levelBot = 42;
    const lanjut = new Meja(siapkan().opsi, rusak as unknown as DataMeja);
    expect(lanjut.data.kursi.map((k) => k.level)).toEqual(['normal', 'mudah', 'suhu', 'normal']);
    expect(lanjut.data.pengaturan.levelBot).toBe('normal');
    // Data asli tidak diubah.
    expect(rusak.kursi[3].level).toBe('dewa');
    lanjut.hentikan();
  });

  it('jago dan suhu memainkan satu putaran sampai selesai tanpa aksi ditolak', () => {
    // Aksi warga kedai yang ditolak mesin dicatat meja lewat console.error lalu diganti cadangan.
    const galat = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: 1 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'jago' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot', level: 'suhu' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const rng = new Rng(5);
    for (let i = 0; i < 5000; i++) {
      const st = meja.data.game?.status;
      if (st !== 'putaranBerjalan' && st !== 'susunAkhir') break;
      if (aksiManusia(meja, ctx.surat, 'host', rng)) continue;
      if (!ctx.jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran manusia');
    }
    expect(ctx.surat.errors('host')).toEqual([]);
    expect(galat).not.toHaveBeenCalled();
    expect(meja.data.game?.riwayat.length).toBe(1);
    meja.hentikan();
    galat.mockRestore();
  });
});
