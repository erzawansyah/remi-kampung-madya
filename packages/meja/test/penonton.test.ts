// Nonton (keputusan pemilik #60): penonton melihat nama + buangan, minta lihat kartu ke pemain,
// pemain boleh menolak, satu permintaan aktif per pemain, jeda 3 menit sesudah ditolak, dan yang
// diizinkan melihat persis info dan view pemain itu.
import { describe, expect, it } from 'vitest';
import { Meja, teksSisaJeda } from '../src/meja.js';
import { Rng } from '@remi/engine';
import { BATAS_JAWAB_LIHAT_MS, JEDA_TOLAK_LIHAT_MS, MAKS_PENONTON, type PengaturanMeja, type PesanServer } from '../src/protokol.js';
import { validasiPengaturan, validasiPesan } from '../src/validasi.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

/** Meja 3 kursi: A (host), B, dan satu warga kedai, sudah main. */
function mejaMain(extra: Parameters<typeof siapkan>[0] = {}, pengaturan: Partial<PengaturanMeja> = {}) {
  const s = siapkan({ namaLawan: ['Warga A'], ...extra });
  const meja = Meja.buat(s.opsi, 'A', 'Ani', { jumlahPemain: 3, ...pengaturan });
  meja.masuk('B', 'Budi');
  meja.terima('A', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  meja.terima('A', { t: 'mulai', pengocok: 0 });
  siapSemua(meja);
  s.surat.bersihkan();
  return { ...s, meja };
}

const tontonan = (surat: ReturnType<typeof siapkan>['surat'], alamat: string) => surat.terakhir(alamat, 'tontonan')!.info;

describe('nonton (#60)', () => {
  it('penonton tanpa izin hanya dapat nama dan buangan, tanpa tangan atau view', () => {
    const { meja, surat } = mejaMain();
    meja.tonton('P1', 'Penonton Satu', 'tok1');
    const info = tontonan(surat, 'P1');
    expect(info.pemain.map((p) => p.nama)).toEqual(['Ani', 'Budi', 'Warga A']);
    expect(info.pemain.map((p) => p.minta)).toEqual(['bisa', 'bisa', 'tidak']);
    expect(info.melihat).toBeNull();
    expect(info.jumlahPenonton).toBe(1);
    // Buangan sama dengan yang terlihat pemain di meja.
    const v = surat.view('A');
    expect(info.buangan).toEqual(v.putaran!.buangan.map((e) => e.kartu));
    // Tidak ada pesan lain yang membawa tangan, view, atau info meja.
    const jenis = new Set(surat.semua('P1').map((p) => p.t));
    expect([...jenis]).toEqual(['tontonan']);
    const teks = JSON.stringify(surat.semua('P1'));
    for (const k of v.putaran!.tangan[0]!) expect(teks).not.toContain(k.id);
    expect(teks).not.toContain('rankJoker');
    // Pemain tahu ada penonton, tapi bukan siapa melihat siapa.
    expect(surat.info('A').penonton).toEqual({ jumlah: 1 });
  });

  it('meja kompetisi, meja yang ditutup host, dan lobi tidak bisa ditonton', () => {
    const s = siapkan();
    const lobi = Meja.buat(s.opsi, 'A', 'Ani', { jumlahPemain: 2 });
    expect(lobi.bisaDitonton).toBe(false);
    expect(() => lobi.tonton('P1', 'X')).toThrow(/belum mulai/);

    const tutup = mejaMain({ kode: 'TUTUP' });
    expect(tutup.meja.bisaDitonton).toBe(true);
    const s2 = siapkan({ namaLawan: ['Warga A'] });
    const m2 = Meja.buat(s2.opsi, 'A', 'Ani', { jumlahPemain: 2, tanpaPenonton: true });
    m2.terima('A', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    m2.terima('A', { t: 'mulai', pengocok: 0 });
    expect(m2.bisaDitonton).toBe(false);
    expect(() => m2.tonton('P1', 'X')).toThrow(/nggak bisa ditonton/);

    const s3 = siapkan();
    const komp = Meja.buat(s3.opsi, 'A', 'Ani', {}, {
      kode: 'KOMP1',
      nama: 'Piala',
      pengaturan: { jumlahPemain: 2, duaDeckUntukEmpat: false, batasPutaran: 3, detikGiliran: 60, modeKaldu: false },
      peserta: 1,
    } as never);
    expect(komp.bisaDitonton).toBe(false);
    expect(() => komp.tonton('P1', 'X')).toThrow(/kompetisi/);
  });

  it('minta lihat → pemain diberi tahu → diterima → penonton melihat persis view pemain itu', () => {
    const { meja, surat } = mejaMain();
    meja.tonton('P1', 'Penonton Satu', 'tok1');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    expect(tontonan(surat, 'P1').pemain[1].minta).toBe('menunggu');
    const infoB = surat.info('B');
    expect(infoB.penonton).toEqual({ jumlah: 1, minta: [{ id: 1, nama: 'Penonton Satu' }] });
    // Pemain lain tidak tahu siapa yang diminta.
    expect(surat.info('A').penonton).toEqual({ jumlah: 1 });
    // Belum diizinkan: belum ada view.
    expect(surat.terakhir('P1', 'tontonView')).toBeUndefined();

    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(tontonan(surat, 'P1').melihat).toBe(1);
    expect(tontonan(surat, 'P1').pemain[1].minta).toBe('dilihat');
    expect(surat.info('B').penonton).toEqual({ jumlah: 1, melihat: [{ id: 1, nama: 'Penonton Satu' }] });
    const viewPenonton = surat.terakhir('P1', 'tontonView')!.view;
    expect(viewPenonton).toEqual(surat.view('B'));
    const infoPenonton = surat.terakhir('P1', 'tontonMeja')!.info;
    const { penonton: _a, ...tanpaA } = infoPenonton;
    const { penonton: _b, ...tanpaB } = surat.info('B');
    expect(tanpaA).toEqual(tanpaB);
    // Penonton tidak ikut tahu siapa saja penonton lain.
    expect(infoPenonton.penonton).toEqual({ jumlah: 1 });
  });

  it('penonton hanya bisa melihat satu kursi; permintaan lain dibatalkan saat diterima', () => {
    const { meja, surat } = mejaMain();
    meja.tonton('P1', 'Penonton Satu');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(surat.info('B').penonton?.minta).toBeUndefined();
    // Jawaban B yang terlambat diabaikan.
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(tontonan(surat, 'P1').melihat).toBe(0);
    // Selama melihat, tidak bisa minta ke pemain lain.
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('P1').at(-1)).toMatch(/Berhenti lihat dulu/);
    // Berhenti melihat sendiri: tanpa jeda.
    meja.terimaPenonton('P1', { t: 'berhentiLihat' });
    expect(tontonan(surat, 'P1').pemain.map((p) => p.minta)).toEqual(['bisa', 'bisa', 'tidak']);
  });

  it('satu permintaan aktif per pemain; ditolak = jeda 3 menit untuk pemain itu saja', () => {
    const { meja, surat, jam } = mejaMain();
    meja.tonton('P1', 'Penonton Satu', 'tok1');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('P1').at(-1)).toMatch(/Masih nunggu/);
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: false });
    const info = tontonan(surat, 'P1');
    expect(info.pemain[1]).toEqual({ nama: 'Budi', minta: 'jeda', jedaMs: JEDA_TOLAK_LIHAT_MS });
    expect(info.pemain[0].minta).toBe('bisa');
    expect(surat.info('B').penonton?.minta).toBeUndefined();

    jam.maju(60_000);
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('P1').at(-1)).toBe('Sabar, Bos. Bisa minta lagi 2 menit lagi.');

    // Menyambung ulang sebagai penonton baru dengan token atau nama yang sama tidak melewati jeda.
    meja.lepasPenonton('P1');
    meja.tonton('P2', 'Penonton Satu', 'tokLain');
    expect(tontonan(surat, 'P2').pemain[1].minta).toBe('jeda');
    meja.tonton('P3', 'Nama Lain', 'tok1');
    expect(tontonan(surat, 'P3').pemain[1].minta).toBe('jeda');

    jam.maju(JEDA_TOLAK_LIHAT_MS - 60_000);
    meja.terimaPenonton('P3', { t: 'mintaLihat', kursi: 1 });
    expect(tontonan(surat, 'P3').pemain[1].minta).toBe('menunggu');
  });

  it('permintaan yang tidak dijawab kedaluwarsa dan dianggap ditolak', () => {
    const { meja, surat, jam } = mejaMain();
    meja.tonton('P1', 'Penonton Satu');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    jam.maju(BATAS_JAWAB_LIHAT_MS - 1);
    expect(tontonan(surat, 'P1').pemain[0].minta).toBe('menunggu');
    jam.maju(1);
    expect(tontonan(surat, 'P1').pemain[0].minta).toBe('jeda');
    expect(surat.info('A').penonton?.minta).toBeUndefined();
    // Jawaban sesudah kedaluwarsa tidak memberi izin.
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(tontonan(surat, 'P1').melihat).toBeNull();
  });

  it('pemain bisa menghentikan penonton kapan saja (lalu jeda), dan izin berakhir saat pemainnya keluar', () => {
    const { meja, surat } = mejaMain();
    meja.tonton('P1', 'Penonton Satu');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: true });
    meja.terima('B', { t: 'hentikanLihat', penonton: 1 });
    expect(tontonan(surat, 'P1').melihat).toBeNull();
    expect(tontonan(surat, 'P1').pemain[1].minta).toBe('jeda');

    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(tontonan(surat, 'P1').melihat).toBe(0);
    surat.bersihkan();
    meja.terima('A', { t: 'keluar' });
    expect(tontonan(surat, 'P1').melihat).toBeNull();
    expect(tontonan(surat, 'P1').pemain[0].minta).toBe('tidak');
    expect(surat.terakhir('P1', 'tontonView')).toBeUndefined();
  });

  it('warga kedai, kursi kosong, dan pemain terputus tidak bisa dimintai', () => {
    const { meja, surat } = mejaMain();
    meja.tonton('P1', 'Penonton Satu');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 2 });
    expect(surat.errors('P1').at(-1)).toMatch(/Warga kedai/);
    meja.terputus('B');
    expect(tontonan(surat, 'P1').pemain[1].minta).toBe('tidak');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('P1').at(-1)).toMatch(/nggak nyambung/);
  });

  it('penonton dibatasi, tidak bisa mengirim aksi, dan diberi tahu saat permainan kembali ke lobi', () => {
    const { meja, surat, jam } = mejaMain({ kode: 'BATAS' }, { batasPutaran: 1, detikGiliran: 0 });
    for (let i = 0; i < MAKS_PENONTON; i++) meja.tonton(`P${i}`, `Penonton ${i}`);
    expect(() => meja.tonton('Lebih', 'Lebih')).toThrow(/penuh/);
    meja.terimaPenonton('P0', { t: 'aksi', aksi: { jenis: 'ambilDeck' } } as never);
    expect(surat.errors('P0').at(-1)).toMatch(/cuma bisa nonton/);
    meja.terimaPenonton('P1', { t: 'keluar' });
    expect(surat.terakhir('P1', 'tontonSelesai')).toBeDefined();
    expect(meja.jumlahPenonton).toBe(MAKS_PENONTON - 1);

    // Mainkan sampai selesai: B keluar (diteruskan warga kedai), A dimainkan bot normal.
    meja.terima('B', { t: 'keluar' });
    const rng = new Rng(7);
    for (let n = 0; n < 20_000 && meja.status === 'main'; n++) {
      if (!aksiManusia(meja, surat, 'A', rng)) jam.langkah();
    }
    expect(meja.status).toBe('selesai');
    meja.terima('A', { t: 'mainLagi' });
    expect(meja.status).toBe('lobi');
    expect(surat.terakhir('P0', 'tontonSelesai')?.alasan).toMatch(/sudah selesai/);
    expect(meja.jumlahPenonton).toBe(0);
    expect(surat.info('A').penonton).toBeUndefined();
  });

  it('meja tanpa penonton tidak menulis field penonton (golden tetap)', () => {
    const { surat } = mejaMain();
    const semua: PesanServer[] = [...surat.semua('A'), ...surat.semua('B')];
    expect(JSON.stringify(semua)).not.toContain('penonton');
  });

  it('teks sisa jeda', () => {
    expect(teksSisaJeda(180_000)).toBe('3 menit');
    expect(teksSisaJeda(150_000)).toBe('2 menit 30 detik');
    expect(teksSisaJeda(800)).toBe('1 detik');
    expect(teksSisaJeda(45_000)).toBe('45 detik');
  });
});

describe('validasi pesan nonton (#60)', () => {
  it('menerima bentuk yang benar', () => {
    expect(validasiPesan({ t: 'daftar' })).toEqual({ t: 'daftar' });
    expect(validasiPesan({ t: 'daftar', tonton: true })).toEqual({ t: 'daftar', tonton: true });
    expect(validasiPesan({ t: 'daftar', tonton: 'ya' })).toEqual({ t: 'daftar' });
    expect(validasiPesan({ t: 'tonton', kode: 'ABCDE', nama: 'Ani' })).toEqual({ t: 'tonton', kode: 'ABCDE', nama: 'Ani' });
    expect(validasiPesan({ t: 'tonton', kode: 'ABCDE', nama: 'Ani', token: 'a1_b-2' })).toEqual({ t: 'tonton', kode: 'ABCDE', nama: 'Ani', token: 'a1_b-2' });
    expect(validasiPesan({ t: 'mintaLihat', kursi: 3 })).toEqual({ t: 'mintaLihat', kursi: 3 });
    expect(validasiPesan({ t: 'berhentiLihat', lain: 1 })).toEqual({ t: 'berhentiLihat' });
    expect(validasiPesan({ t: 'jawabLihat', penonton: 2, terima: false })).toEqual({ t: 'jawabLihat', penonton: 2, terima: false });
    expect(validasiPesan({ t: 'hentikanLihat', penonton: 2 })).toEqual({ t: 'hentikanLihat', penonton: 2 });
    expect(validasiPengaturan({ tanpaPenonton: true })).toEqual({ tanpaPenonton: true });
  });

  it('menolak bentuk yang salah', () => {
    expect(validasiPesan({ t: 'tonton', kode: 'ABCDE' })).toBeNull();
    expect(validasiPesan({ t: 'tonton', kode: 'ABCDE', nama: 'Ani', token: 'ada spasi' })).toBeNull();
    expect(validasiPesan({ t: 'tonton', kode: 'ABCDE', nama: 'Ani', token: 'x'.repeat(65) })).toBeNull();
    expect(validasiPesan({ t: 'mintaLihat', kursi: 6 })).toBeNull();
    expect(validasiPesan({ t: 'mintaLihat', kursi: '1' })).toBeNull();
    expect(validasiPesan({ t: 'jawabLihat', penonton: 0, terima: true })).toBeNull();
    expect(validasiPesan({ t: 'jawabLihat', penonton: 1, terima: 'ya' })).toBeNull();
    expect(validasiPesan({ t: 'hentikanLihat', penonton: 1.5 })).toBeNull();
    expect(validasiPengaturan({ tanpaPenonton: 1 })).toBeNull();
  });
});
