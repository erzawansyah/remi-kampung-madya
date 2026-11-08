// Nonton (keputusan pemilik #60, aturan minta lihat diubah #62): penonton melihat nama + buangan,
// minta lihat kartu ke satu pemain sekaligus (60 detik), yang menolak atau tidak menjawab tidak bisa
// diminta lagi sampai permainan selesai, sesudah melihat kartu jeda 30 menit untuk semua pemain di
// meja itu, dan yang diizinkan melihat persis info dan view pemain itu.
import { describe, expect, it } from 'vitest';
import { dataMejaDipulihkan, MAKS_KUNCI_BLOKIR_LIHAT, Meja, TEKS_MINTA_TERTAHAN, teksSisaJeda } from '../src/meja.js';
import { Rng } from '@remi/engine';
import { BATAS_JAWAB_LIHAT_MS, JEDA_SESUDAH_LIHAT_MS, MAKS_PENONTON, type PengaturanMeja, type PesanServer } from '../src/protokol.js';
import { validasiPengaturan, validasiPesan } from '../src/validasi.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';


/** Meja 3 kursi: A (host), B, dan satu warga kedai, sudah main. */
function mejaMain(extra: Parameters<typeof siapkan>[0] = {}, pengaturan: Partial<PengaturanMeja> = {}) {
  const s = siapkan({ namaLawan: ['Warga A'], ...extra });
  const meja = Meja.buat(s.opsi, 'A', 'Ani', { jumlahPemain: 3, publik: true, ...pengaturan });
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
    const lobi = Meja.buat(s.opsi, 'A', 'Ani', { jumlahPemain: 2, publik: true });
    expect(lobi.bisaDitonton).toBe(false);
    expect(() => lobi.tonton('P1', 'X')).toThrow(/belum mulai/);

    const tutup = mejaMain({ kode: 'TUTUP' });
    expect(tutup.meja.bisaDitonton).toBe(true);
    const s2 = siapkan({ namaLawan: ['Warga A'] });
    const m2 = Meja.buat(s2.opsi, 'A', 'Ani', { jumlahPemain: 2, publik: true, tanpaPenonton: true });
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

  it('meja privat juga bisa ditonton, dan penonton hanya menerima kode tonton, bukan kode meja', () => {
    const { meja, surat } = mejaMain({ kode: 'RAHAS' }, { publik: false });
    expect(meja.status).toBe('main');
    expect(meja.bisaDitonton).toBe(true);
    meja.tonton('P1', 'Tono', 'tok', 'TNTN2');
    const info = tontonan(surat, 'P1');
    expect(info.kode).toBe('TNTN2');
    expect(info.namaHost).toBe('Ani');
    // Diizinkan melihat kartu Budi: info meja yang diteruskan juga memakai kode tonton.
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 1 });
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(surat.terakhir('P1', 'tontonMeja')!.info.kode).toBe('TNTN2');
    expect(surat.terakhir('P1', 'tontonView')).toBeDefined();
    // Pemainnya sendiri tetap menerima kode meja asli.
    expect(surat.info('B').kode).toBe('RAHAS');
    // Sampai tontonan selesai (Main lagi), tidak ada pesan ke penonton yang memuat kode meja asli.
    meja.terimaPenonton('P1', { t: 'keluar' });
    expect(JSON.stringify(surat.semua('P1'))).not.toContain('RAHAS');
  });

  it('HP yang sama dari sambungan lain mengambil alih tontonan: nomor, izin, dan permintaan ikut', () => {
    const { meja, surat } = mejaMain();
    meja.tonton('P1', 'Tono', 'tok');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(tontonan(surat, 'P1').melihat).toBe(0);
    // Sambung ulang: sambungan baru (alamat baru) dengan token sama, sambungan lama belum tertutup.
    meja.tonton('P2', 'Tono', 'tok');
    expect(surat.terakhir('P1', 'tontonSelesai')?.alasan).toMatch(/tempat lain/);
    expect(meja.jumlahPenonton).toBe(1);
    expect(tontonan(surat, 'P2').melihat).toBe(0);
    expect(surat.terakhir('P2', 'tontonView')?.view.saya).toBe(0);
    expect(surat.info('A').penonton?.melihat).toEqual([{ id: 1, nama: 'Tono' }]);
    // Sambungan lama yang baru ketahuan tertutup tidak mengganggu tontonan baru.
    meja.lepasPenonton('P1');
    expect(meja.jumlahPenonton).toBe(1);
    // Jawaban dan Hentikan memakai nomor yang sama.
    meja.terima('A', { t: 'hentikanLihat', penonton: 1 });
    expect(tontonan(surat, 'P2').melihat).toBeNull();
    expect(tontonan(surat, 'P2').pemain[0].minta).toBe('ditolak');
    expect(tontonan(surat, 'P2').jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
  });

  it('mengambil alih tidak dihitung penonton baru walau meja penuh', () => {
    const { meja } = mejaMain();
    for (let i = 0; i < MAKS_PENONTON; i++) meja.tonton(`P${i}`, `Penonton ${i}`, `tok${i}`);
    expect(() => meja.tonton('Baru', 'Penonton 0', 'tok0')).not.toThrow();
    expect(meja.jumlahPenonton).toBe(MAKS_PENONTON);
  });

  it('meja tanpa penonton tidak menulis field penonton (golden tetap)', () => {
    const { surat } = mejaMain();
    const semua: PesanServer[] = [...surat.semua('A'), ...surat.semua('B')];
    expect(JSON.stringify(semua)).not.toContain('penonton');
  });

  it('teks sisa jeda', () => {
    expect(teksSisaJeda(JEDA_SESUDAH_LIHAT_MS)).toBe('30 menit');
    expect(teksSisaJeda(180_000)).toBe('3 menit');
    expect(teksSisaJeda(150_000)).toBe('2 menit 30 detik');
    expect(teksSisaJeda(800)).toBe('1 detik');
    expect(teksSisaJeda(45_000)).toBe('45 detik');
  });
});

/** Meja 4 kursi manusia: Ani (host), Budi, Cici, Dodi, sudah main. */
function mejaEmpat(extra: Parameters<typeof siapkan>[0] = {}, pengaturan: Partial<PengaturanMeja> = {}) {
  const s = siapkan(extra);
  const meja = Meja.buat(s.opsi, 'A', 'Ani', { jumlahPemain: 4, publik: true, ...pengaturan });
  meja.masuk('B', 'Budi');
  meja.masuk('C', 'Cici');
  meja.masuk('D', 'Dodi');
  meja.terima('A', { t: 'mulai', pengocok: 0 });
  siapSemua(meja);
  s.surat.bersihkan();
  return { ...s, meja };
}

const keadaan = (surat: ReturnType<typeof siapkan>['surat'], alamat: string) => tontonan(surat, alamat).pemain.map((p) => p.minta);

describe('minta lihat kartu (#62)', () => {
  it('konstanta: 60 detik untuk menjawab, jeda 30 menit sesudah melihat', () => {
    expect(BATAS_JAWAB_LIHAT_MS).toBe(60_000);
    expect(JEDA_SESUDAH_LIHAT_MS).toBe(30 * 60_000);
  });

  it('skenario pemilik: Z nonton A, B, C, D; A diam, B menolak, C menerima, lalu jeda 30 menit', () => {
    const { meja, surat, jam } = mejaEmpat();
    meja.tonton('Z', 'Zaki', 'tokZ');
    expect(keadaan(surat, 'Z')).toEqual(['bisa', 'bisa', 'bisa', 'bisa']);
    expect(tontonan(surat, 'Z').tunggu).toBeUndefined();
    expect(tontonan(surat, 'Z').jedaMs).toBeUndefined();

    // 1. Minta lihat A: semua tombol mati sambil hitung mundur 60 detik.
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    let t = tontonan(surat, 'Z');
    expect(t.tunggu).toEqual({ kursi: 0, sisaMs: 60_000 });
    expect(t.pemain[0].minta).toBe('menunggu');
    expect(surat.info('A').penonton?.minta).toEqual([{ id: 1, nama: 'Zaki' }]);
    for (const k of [1, 2, 3]) {
      meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: k });
      expect(surat.errors('Z').at(-1)).toBe('Masih nunggu jawaban Ani, Bos.');
    }
    expect(surat.info('B').penonton?.minta).toBeUndefined();
    jam.maju(20_000);
    surat.bersihkan();
    meja.tonton('Z2', 'Zaki', 'tokZ'); // sambung ulang: hitung mundurnya tetap jalan dari batas semula
    expect(tontonan(surat, 'Z2').tunggu).toEqual({ kursi: 0, sisaMs: 40_000 });

    // 2. A tidak menjawab 60 detik: tombol lain langsung hidup lagi, A tidak bisa diminta lagi.
    jam.maju(40_000 - 1);
    expect(tontonan(surat, 'Z2').tunggu?.kursi).toBe(0);
    jam.maju(1);
    t = tontonan(surat, 'Z2');
    expect(t.tunggu).toBeUndefined();
    expect(t.jedaMs).toBeUndefined();
    expect(keadaan(surat, 'Z2')).toEqual(['tidakDijawab', 'bisa', 'bisa', 'bisa']);
    expect(surat.info('A').penonton?.minta).toBeUndefined();
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true }); // terlambat: diabaikan
    expect(tontonan(surat, 'Z2').melihat).toBeNull();
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 0 });
    expect(surat.errors('Z2').at(-1)).toMatch(/^Ani tadi nggak jawab/);

    // 3. Minta ke B, B menolak: tombol langsung hidup lagi (tanpa jeda), B tidak bisa diminta lagi.
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 1 });
    expect(tontonan(surat, 'Z2').tunggu?.kursi).toBe(1);
    jam.maju(5_000);
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: false });
    t = tontonan(surat, 'Z2');
    expect(t.tunggu).toBeUndefined();
    expect(t.jedaMs).toBeUndefined();
    expect(keadaan(surat, 'Z2')).toEqual(['tidakDijawab', 'ditolak', 'bisa', 'bisa']);
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('Z2').at(-1)).toMatch(/^Budi nggak mau kartunya dilihat/);

    // 4. Minta ke C, diterima: Z melihat kartu C persis seperti C.
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 2 });
    meja.terima('C', { t: 'jawabLihat', penonton: 1, terima: true });
    t = tontonan(surat, 'Z2');
    expect(t.melihat).toBe(2);
    expect(t.pemain[2].minta).toBe('dilihat');
    expect(surat.terakhir('Z2', 'tontonView')!.view).toEqual(surat.view('C'));
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 3 });
    expect(surat.errors('Z2').at(-1)).toMatch(/Berhenti lihat dulu/);

    // 5. Berhenti melihat: tidak bisa minta ke D (atau siapa pun) selama 30 menit, dengan hitung mundur.
    meja.terimaPenonton('Z2', { t: 'berhentiLihat' });
    t = tontonan(surat, 'Z2');
    expect(t.melihat).toBeNull();
    expect(t.jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    expect(keadaan(surat, 'Z2')).toEqual(['tidakDijawab', 'ditolak', 'bisa', 'bisa']);
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 3 });
    expect(surat.errors('Z2').at(-1)).toBe('Sabar, Bos. Bisa minta lihat lagi 30 menit lagi.');
    jam.maju(10 * 60_000);
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 2 });
    expect(surat.errors('Z2').at(-1)).toBe('Sabar, Bos. Bisa minta lihat lagi 20 menit lagi.');
    expect(surat.info('D').penonton?.minta).toBeUndefined();

    // 6. Jeda habis: penonton diberi kabar, D dan C bisa diminta lagi; A dan B tetap tidak.
    surat.bersihkan();
    jam.maju(20 * 60_000);
    t = tontonan(surat, 'Z2');
    expect(t.jedaMs).toBeUndefined();
    expect(keadaan(surat, 'Z2')).toEqual(['tidakDijawab', 'ditolak', 'bisa', 'bisa']);
    meja.terimaPenonton('Z2', { t: 'mintaLihat', kursi: 3 });
    expect(tontonan(surat, 'Z2').tunggu?.kursi).toBe(3);
    expect(surat.info('D').penonton?.minta).toEqual([{ id: 1, nama: 'Zaki' }]);
  });

  it('satu permintaan sekaligus juga lintas sambungan dan token dengan nama yang sama', () => {
    const { meja, surat } = mejaEmpat();
    meja.tonton('P1', 'Tono', 'tokA');
    meja.tonton('P2', 'Tono', 'tokB');
    meja.tonton('P3', 'Orang Lain', 'tokC');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    expect(tontonan(surat, 'P1').tunggu?.kursi).toBe(0);
    // Sambungan lain dengan nama yang sama (bisa orang lain) ikut terkunci, tapi tanpa rincian: tidak
    // tahu kursi mana yang diminta, tanpa hitung mundur, dan pesan galatnya tidak menyebut pemain.
    const t2 = tontonan(surat, 'P2');
    expect(t2.tunggu).toBeUndefined();
    expect(t2.tertahan).toBe(true);
    expect(t2.pemain.map((p) => p.minta)).toEqual(['bisa', 'bisa', 'bisa', 'bisa']);
    meja.terimaPenonton('P2', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('P2').at(-1)).toBe(TEKS_MINTA_TERTAHAN);
    expect(surat.info('B').penonton?.minta).toBeUndefined();
    // Penonton lain tidak terpengaruh.
    expect(tontonan(surat, 'P3').tunggu).toBeUndefined();
    meja.terimaPenonton('P3', { t: 'mintaLihat', kursi: 1 });
    expect(surat.info('B').penonton?.minta).toEqual([{ id: 3, nama: 'Orang Lain' }]);
  });

  it('keluar atau sambungan tertutup selagi menunggu = tidak dijawab, tetap terkunci sesudah sambung ulang', () => {
    const { meja, surat } = mejaEmpat();
    meja.tonton('P1', 'Spam', 'tok');
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    meja.terimaPenonton('P1', { t: 'keluar' });
    expect(surat.info('A').penonton).toBeUndefined();
    // Token sama, nama beda.
    meja.tonton('P2', 'Nama Baru', 'tok');
    expect(keadaan(surat, 'P2')).toEqual(['tidakDijawab', 'bisa', 'bisa', 'bisa']);
    meja.terimaPenonton('P2', { t: 'mintaLihat', kursi: 1 });
    meja.lepasPenonton('P2');
    // Nama sama, token beda.
    // Nama sama, token beda (bisa orang lain): tetap terkunci, tapi alasannya tidak dikirim.
    meja.tonton('P3', 'Nama Baru', 'tokLain');
    expect(keadaan(surat, 'P3')).toEqual(['bisa', 'tidak', 'bisa', 'bisa']);
    meja.terimaPenonton('P3', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('P3').at(-1)).toBe(TEKS_MINTA_TERTAHAN);
    meja.tonton('P4', 'Spam', 'tokLain2');
    expect(keadaan(surat, 'P4')).toEqual(['tidak', 'bisa', 'bisa', 'bisa']);
  });

  it('kursi yang menolak atau tidak menjawab bisa diminta lagi di permainan baru (Main lagi)', () => {
    const { meja, surat, jam } = mejaEmpat({ namaLawan: ['Warga A', 'Warga B', 'Warga C'] }, { batasPutaran: 1, detikGiliran: 0 });
    meja.tonton('Z', 'Zaki', 'tokZ');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    jam.maju(BATAS_JAWAB_LIHAT_MS);
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 1 });
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: false });
    expect(keadaan(surat, 'Z')).toEqual(['tidakDijawab', 'ditolak', 'bisa', 'bisa']);
    // Sambungan baru tetap terkunci selama permainan ini.
    meja.lepasPenonton('Z');
    meja.tonton('Z', 'Zaki', 'tokZ');
    expect(keadaan(surat, 'Z')).toEqual(['tidakDijawab', 'ditolak', 'bisa', 'bisa']);

    // Permainan selesai, Main lagi, permainan baru: semua bisa diminta lagi.
    for (const id of ['B', 'C', 'D']) meja.terima(id, { t: 'keluar' });
    const rng = new Rng(3);
    for (let n = 0; n < 20_000 && meja.status === 'main'; n++) {
      if (!aksiManusia(meja, surat, 'A', rng)) jam.langkah();
    }
    expect(meja.status).toBe('selesai');
    meja.terima('A', { t: 'mainLagi' });
    // Kursi yang ditinggal sekarang diisi warga kedai; Ani (yang tadi tidak menjawab) bisa diminta lagi.
    meja.terima('A', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    meja.tonton('Z', 'Zaki', 'tokZ');
    expect(keadaan(surat, 'Z')).toEqual(['bisa', 'tidak', 'tidak', 'tidak']);
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    expect(tontonan(surat, 'Z').tunggu?.kursi).toBe(0);
  });

  it('jeda 30 menit juga sesudah pemainnya menekan Hentikan (dan pemain itu dihitung menolak)', () => {
    const { meja, surat, jam } = mejaEmpat();
    meja.tonton('Z', 'Zaki', 'tokZ');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 2 });
    meja.terima('C', { t: 'jawabLihat', penonton: 1, terima: true });
    jam.maju(5 * 60_000);
    meja.terima('C', { t: 'hentikanLihat', penonton: 1 });
    const t = tontonan(surat, 'Z');
    expect(t.melihat).toBeNull();
    expect(t.jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    expect(t.pemain[2].minta).toBe('ditolak');
    expect(surat.terakhir('Z', 'tontonView')).toBeDefined();
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 3 });
    expect(surat.errors('Z').at(-1)).toMatch(/^Sabar, Bos/);
    // Token lain dengan nama sama tetap kena jeda, tapi tanpa hitung mundur dan tanpa alasan per kursi.
    meja.lepasPenonton('Z');
    meja.tonton('Z9', 'Zaki', 'tokLain');
    const t9 = tontonan(surat, 'Z9');
    expect(t9.jedaMs).toBeUndefined();
    expect(t9.tertahan).toBe(true);
    expect(t9.pemain[2].minta).toBe('tidak');
    meja.terimaPenonton('Z9', { t: 'mintaLihat', kursi: 3 });
    expect(surat.errors('Z9').at(-1)).toBe(TEKS_MINTA_TERTAHAN);
    // Token yang sama: rinciannya kembali.
    meja.lepasPenonton('Z9');
    meja.tonton('Z', 'Zaki', 'tokZ');
    expect(tontonan(surat, 'Z').jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    expect(tontonan(surat, 'Z').pemain[2].minta).toBe('ditolak');
  });

  it('jeda 30 menit juga sesudah pemain yang dilihat keluar dari meja', () => {
    const { meja, surat } = mejaEmpat();
    meja.tonton('Z', 'Zaki', 'tokZ');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 1 });
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: true });
    surat.bersihkan();
    meja.terima('B', { t: 'keluar' });
    const t = tontonan(surat, 'Z');
    expect(t.melihat).toBeNull();
    expect(t.pemain[1].minta).toBe('tidak');
    expect(t.jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    expect(surat.terakhir('Z', 'tontonView')).toBeUndefined();
  });

  it('sambungan penonton tertutup selagi melihat juga memulai jeda (sambung ulang tidak melewatinya)', () => {
    const { meja, surat } = mejaEmpat();
    meja.tonton('Z', 'Zaki', 'tokZ');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 1 });
    meja.terima('B', { t: 'jawabLihat', penonton: 1, terima: true });
    meja.lepasPenonton('Z');
    meja.tonton('Z2', 'Zaki', 'tokZ');
    const t = tontonan(surat, 'Z2');
    expect(t.melihat).toBeNull();
    expect(t.jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    // Tidak dihitung menolak: sesudah jeda, B boleh diminta lagi.
    expect(t.pemain[1].minta).toBe('bisa');
  });

  it('jeda sesudah melihat hanya berlaku di meja itu', () => {
    const satu = mejaEmpat({ kode: 'SATU1' });
    const dua = mejaEmpat({ kode: 'DUA22' });
    satu.meja.tonton('Z', 'Zaki', 'tokZ');
    satu.meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    satu.meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true });
    satu.meja.terimaPenonton('Z', { t: 'berhentiLihat' });
    expect(tontonan(satu.surat, 'Z').jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    dua.meja.tonton('Z', 'Zaki', 'tokZ');
    expect(tontonan(dua.surat, 'Z').jedaMs).toBeUndefined();
    dua.meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    expect(tontonan(dua.surat, 'Z').tunggu?.kursi).toBe(0);
  });

  it('penonton lain dengan nama sama tidak tahu siapa yang sedang dilihat (#60)', () => {
    const { meja, surat } = mejaEmpat();
    meja.tonton('S1', 'Budi', 'T1');
    meja.tonton('S2', 'budi', 'T2');
    meja.terimaPenonton('S1', { t: 'mintaLihat', kursi: 0 });
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: true });
    expect(tontonan(surat, 'S1').melihat).toBe(0);
    const t2 = tontonan(surat, 'S2');
    expect(t2.melihat).toBeNull();
    expect(t2.tunggu).toBeUndefined();
    expect(t2.jedaMs).toBeUndefined();
    expect(t2.tertahan).toBe(true);
    expect(t2.pemain.map((p) => p.minta)).toEqual(['bisa', 'bisa', 'bisa', 'bisa']);
    meja.terimaPenonton('S2', { t: 'mintaLihat', kursi: 1 });
    expect(surat.errors('S2').at(-1)).toBe(TEKS_MINTA_TERTAHAN);
    expect(JSON.stringify(surat.semua('S2'))).not.toContain('Berhenti lihat dulu');
    // Budi berhenti: S2 tetap tertahan (jeda atas nama itu), tanpa hitung mundur.
    meja.terimaPenonton('S1', { t: 'berhentiLihat' });
    expect(tontonan(surat, 'S1').jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    expect(tontonan(surat, 'S2').jedaMs).toBeUndefined();
    expect(tontonan(surat, 'S2').tertahan).toBe(true);
  });

  it('blokir dan jeda hanya di memori: tidak masuk DataMeja, meja yang dipulihkan sesudah restart mulai bersih (tafsiran #62)', () => {
    const { meja, surat, opsi } = mejaEmpat();
    const sebelum = JSON.stringify(meja.data);
    meja.tonton('Z', 'Zaki', 'tokZ');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: false });
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 2 });
    meja.terima('C', { t: 'jawabLihat', penonton: 1, terima: true });
    meja.terimaPenonton('Z', { t: 'berhentiLihat' });
    expect(tontonan(surat, 'Z').jedaMs).toBe(JEDA_SESUDAH_LIHAT_MS);
    expect(JSON.stringify(meja.data)).toBe(sebelum);
    // Restart/deploy: meja dibangun ulang dari DataMeja, jadi blokir dan jeda kosong lagi.
    const pulih = new Meja(opsi, dataMejaDipulihkan(meja.data));
    for (const id of ['A', 'B', 'C', 'D']) pulih.masuk(id, '');
    pulih.tonton('Z2', 'Zaki', 'tokZ');
    const t = tontonan(surat, 'Z2');
    expect(t.jedaMs).toBeUndefined();
    expect(t.tertahan).toBeUndefined();
    expect(t.pemain[0].minta).toBe('bisa');
  });

  it('catatan blokir dibatasi, kunci penonton yang hadir tidak dibuang', () => {
    const { meja, surat } = mejaEmpat();
    meja.tonton('Z', 'Zaki', 'tokZ');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    meja.terima('A', { t: 'jawabLihat', penonton: 1, terima: false });
    // Skrip yang terus ganti nama dan token, minta, lalu pergi.
    for (let n = 0; n < MAKS_KUNCI_BLOKIR_LIHAT; n++) {
      meja.tonton('X', `Spam ${n}`, `spam${n}`);
      meja.terimaPenonton('X', { t: 'mintaLihat', kursi: 1 });
      meja.lepasPenonton('X');
    }
    expect(meja.jumlahKunciBlokirLihat).toBeLessThanOrEqual(MAKS_KUNCI_BLOKIR_LIHAT);
    // Penonton yang masih hadir tetap terblokir untuk kursi yang menolaknya.
    expect(keadaan(surat, 'Z')[0]).toBe('ditolak');
    meja.terimaPenonton('Z', { t: 'mintaLihat', kursi: 0 });
    expect(surat.errors('Z').at(-1)).toMatch(/nggak mau kartunya dilihat/);
  });

  it('catatan jeda yang sudah lewat dibuang', () => {
    const { meja, jam } = mejaEmpat();
    for (let n = 0; n < 3; n++) {
      meja.tonton(`P${n}`, `Penonton ${n}`, `tok${n}`);
      meja.terimaPenonton(`P${n}`, { t: 'mintaLihat', kursi: n });
      meja.terima(['A', 'B', 'C'][n], { t: 'jawabLihat', penonton: n + 1, terima: true });
      meja.lepasPenonton(`P${n}`);
    }
    const catatan = () => (meja as unknown as { jedaLihat: Map<string, unknown> }).jedaLihat;
    // Tiap penonton: kunci nama, token, dan nomor tontonan.
    expect(catatan().size).toBe(9);
    jam.maju(JEDA_SESUDAH_LIHAT_MS);
    expect(catatan().size).toBe(0);
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
