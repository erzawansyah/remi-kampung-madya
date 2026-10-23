// Kompetisi (keputusan pemilik #51): masa berlaku, status, poin per permainan, klasemen, voting
// tutup, pengaturan yang dikunci, validasi tiket, dan meja kompetisi (tanpa warga kedai, kursi
// peserta, ringkasan akhir dengan id peserta).

import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import {
  BATAS_PENGAJUAN_MS,
  MIN_MAIN_KOMPETISI,
  Meja,
  PENGATURAN_KOMPETISI_BAWAAN,
  akhirKompetisi,
  hitungKlasemenKompetisi,
  poinKompetisi,
  rapikanNamaKompetisi,
  rapikanPengaturanKompetisi,
  statusKompetisi,
  tutupDisetujui,
  ubahanTerkunci,
  validasiPesan,
  type HasilKompetisi,
  type KompetisiDataMeja,
  type RingkasanAkhir,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

const JAM = 60 * 60 * 1000;
/** ms epoch untuk jam WIB (UTC+7) tanggal tertentu Okt 2026. */
const wib = (tgl: number, jam: number, menit = 0) => Date.UTC(2026, 9, tgl, jam - 7, menit);

describe('masa berlaku kompetisi', () => {
  it('1 malam berakhir 06.00 WIB berikutnya, paling cepat 3 jam lagi', () => {
    expect(akhirKompetisi('malam', wib(23, 20))).toBe(wib(24, 6));
    expect(akhirKompetisi('malam', wib(23, 2))).toBe(wib(23, 6));
    expect(akhirKompetisi('malam', wib(23, 3))).toBe(wib(23, 6));
    expect(akhirKompetisi('malam', wib(23, 3, 1))).toBe(wib(24, 6));
    expect(akhirKompetisi('malam', wib(23, 5))).toBe(wib(24, 6));
    expect(akhirKompetisi('malam', wib(23, 6))).toBe(wib(24, 6));
    // Pergantian hari WIB yang masih tanggal sebelumnya di UTC.
    expect(akhirKompetisi('malam', wib(24, 1))).toBe(wib(24, 6));
  });

  it('1 minggu dan 1 bulan dihitung dari saat jalan', () => {
    expect(akhirKompetisi('minggu', wib(23, 20))).toBe(wib(30, 20));
    expect(akhirKompetisi('bulan', wib(1, 9))).toBe(wib(31, 9));
  });

  it('status: pengajuan → batal sesudah 24 jam; berjalan → selesai saat masa habis atau ditutup', () => {
    const aju = { diajukanPada: 1000, mulaiPada: null, berakhirPada: null, ditutupPada: null };
    expect(statusKompetisi(aju, 1000 + BATAS_PENGAJUAN_MS - 1)).toBe('pengajuan');
    expect(statusKompetisi(aju, 1000 + BATAS_PENGAJUAN_MS)).toBe('batal');
    const jalan = { ...aju, mulaiPada: 5000, berakhirPada: 5000 + JAM };
    // Yang sudah jalan tidak pernah batal karena batas pengajuan.
    expect(statusKompetisi(jalan, 1000 + BATAS_PENGAJUAN_MS)).toBe('selesai');
    expect(statusKompetisi(jalan, 5000 + JAM - 1)).toBe('berjalan');
    expect(statusKompetisi(jalan, 5000 + JAM)).toBe('selesai');
    expect(statusKompetisi({ ...jalan, ditutupPada: 6000 }, 6000)).toBe('selesai');
  });

  it('voting tutup lolos kalau lebih dari separuh peserta setuju', () => {
    expect(tutupDisetujui(2, 4)).toBe(false);
    expect(tutupDisetujui(3, 4)).toBe(true);
    expect(tutupDisetujui(3, 5)).toBe(true);
    expect(tutupDisetujui(2, 5)).toBe(false);
    expect(tutupDisetujui(0, 0)).toBe(false);
  });
});

describe('poin per permainan', () => {
  it('poin = banyaknya peserta lain yang dikalahkan; skor sama tidak saling mengalahkan', () => {
    expect(poinKompetisi([{ nama: 'A', bot: false, skor: 120 }, { nama: 'B', bot: false, skor: 30 }, { nama: 'C', bot: false, skor: -10 }, { nama: 'D', bot: false, skor: -200 }])).toEqual([3, 2, 1, 0]);
    expect(poinKompetisi([{ nama: 'A', bot: false, skor: 50 }, { nama: 'B', bot: false, skor: 50 }, { nama: 'C', bot: false, skor: 0 }])).toEqual([1, 1, 0]);
    // Meja 6 orang: 5-4-3-2-1-0.
    expect(poinKompetisi([60, 50, 40, 30, 20, 10].map((skor, i) => ({ nama: String(i), bot: false, skor })))).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('yang keluar di tengah permainan juru kunci: 0 poin, dikalahkan semua yang bertahan', () => {
    expect(
      poinKompetisi([
        { nama: 'Kabur', bot: false, keluar: true, skor: 300 },
        { nama: 'B', bot: false, skor: 10 },
        { nama: 'C', bot: false, skor: -50 },
      ]),
    ).toEqual([0, 2, 1]);
    expect(
      poinKompetisi([
        { nama: 'Kabur1', bot: false, keluar: true, skor: 300 },
        { nama: 'Kabur2', bot: false, keluar: true, skor: -300 },
        { nama: 'C', bot: false, skor: -50 },
      ]),
    ).toEqual([0, 0, 2]);
  });
});

describe('klasemen kompetisi', () => {
  const peserta = ['Ani', 'Budi', 'Cici', 'Dodi', 'Eko'].map((nama, i) => ({ id: i + 1, nama }));
  const h = (p: number, poin: number, skor: number, extra: Partial<HasilKompetisi> = {}): HasilKompetisi => ({
    peserta: p,
    poin,
    skor,
    juara: false,
    keluar: false,
    ...extra,
  });

  it(`total poin; minimal ${MIN_MAIN_KOMPETISI}× main; seri = rata-rata poin, lalu rata-rata skor`, () => {
    const { peringkat, belumCukup } = hitungKlasemenKompetisi(peserta, [
      // Ani 6 poin dari 3 main (rata 2), Budi 6 poin dari 4 main (rata 1,5).
      h(1, 2, 10), h(1, 2, 10), h(1, 2, 10, { juara: true }),
      h(2, 3, 0), h(2, 1, 0), h(2, 1, 0), h(2, 1, 0),
      // Cici dan Dodi sama poin dan rata poin; Dodi rata skornya lebih tinggi.
      h(3, 1, -50), h(3, 1, -50), h(3, 1, -50),
      h(4, 1, 20), h(4, 1, 20), h(4, 1, 20, { keluar: true }),
      // Eko cuma 2 kali main.
      h(5, 3, 500), h(5, 3, 500),
      // Peserta tak dikenal dilewati.
      h(99, 5, 5),
    ]);
    expect(peringkat.map((b) => b.nama)).toEqual(['Ani', 'Budi', 'Dodi', 'Cici']);
    expect(peringkat[0]).toMatchObject({ main: 3, poin: 6, juara: 1, rataPoin: 2, rataSkor: 10 });
    expect(peringkat[2]).toMatchObject({ keluar: 1 });
    expect(belumCukup.map((b) => [b.nama, b.main])).toEqual([['Eko', 2]]);
  });

  it('peserta yang belum main tetap tampil di belum cukup', () => {
    const { peringkat, belumCukup } = hitungKlasemenKompetisi(peserta.slice(0, 2), []);
    expect(peringkat).toEqual([]);
    expect(belumCukup.map((b) => [b.nama, b.main, b.rataPoin])).toEqual([
      ['Ani', 0, 0],
      ['Budi', 0, 0],
    ]);
  });
});

describe('pengaturan dan pesan kompetisi', () => {
  it('pengaturan dari data tak dipercaya: kunci rusak jatuh ke bawaan, kunci lain dibuang', () => {
    expect(rapikanPengaturanKompetisi(null)).toEqual(PENGATURAN_KOMPETISI_BAWAAN);
    expect(
      rapikanPengaturanKompetisi({ batasPutaran: 10, modeKaldu: true, batasSkorAtas: 255, detikGiliran: 9999, levelBot: 'dewa', publik: true, jumlahPemain: 6 }),
    ).toEqual({ ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 10, modeKaldu: true });
    expect(rapikanPengaturanKompetisi({ batasSkorAtas: 500, batasSkorBawah: -500, duaDeckUntukEmpat: true, levelBot: 'suhu' })).toMatchObject({
      batasSkorAtas: 500,
      batasSkorBawah: -500,
      duaDeckUntukEmpat: true,
      levelBot: 'suhu',
    });
  });

  it('ubahan terkunci: hanya kunci kompetisi yang nilainya berubah', () => {
    const kunci = { ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 5 };
    expect(ubahanTerkunci(kunci, { jumlahPemain: 3, publik: true, tempoBot: 'cepat' })).toEqual([]);
    expect(ubahanTerkunci(kunci, { batasPutaran: 5 })).toEqual([]);
    expect(ubahanTerkunci(kunci, { batasPutaran: 6, modeKaldu: true })).toEqual(['batasPutaran', 'modeKaldu']);
  });

  it('nama kompetisi dirapikan, maksimal 32 huruf', () => {
    expect(rapikanNamaKompetisi('  Remi\nJumat   Kedai ')).toBe('Remi Jumat Kedai');
    expect(rapikanNamaKompetisi('x'.repeat(50))).toBe('x'.repeat(32));
    expect(rapikanNamaKompetisi('   ')).toBeNull();
    expect(rapikanNamaKompetisi(5)).toBeNull();
  });

  it('tiket di pesan buat dan gabung', () => {
    expect(validasiPesan({ t: 'buat', nama: 'Budi', kompetisi: { kode: 'abcde', token: 'rahasia' } })).toEqual({
      t: 'buat',
      nama: 'Budi',
      pengaturan: {},
      kompetisi: { kode: 'ABCDE', token: 'rahasia' },
    });
    expect(validasiPesan({ t: 'buat', nama: 'Budi', kompetisi: { kode: 'ABCDE' } })).toBeNull();
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi', tiket: [{ kode: 'ABCDE', token: 'x' }] })).toMatchObject({
      tiket: [{ kode: 'ABCDE', token: 'x' }],
    });
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi', tiket: [{ kode: 'ABCDE', token: '' }] })).toBeNull();
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi', tiket: Array(21).fill({ kode: 'ABCDE', token: 'x' }) })).toBeNull();
    // Pesan lama tanpa tiket tidak berubah bentuknya.
    expect(validasiPesan({ t: 'gabung', kode: 'QWERT', nama: 'Budi' })).toEqual({ t: 'gabung', kode: 'QWERT', nama: 'Budi', token: undefined });
  });
});

describe('meja kompetisi', () => {
  const KOMPETISI: KompetisiDataMeja = {
    kode: 'KOMPA',
    nama: 'Remi Jumat',
    pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 1, detikGiliran: 0 },
  };

  const buatMeja = (extra: Parameters<typeof siapkan>[0] = {}) => {
    const ctx = siapkan(extra);
    // Pengaturan kiriman host yang dikunci kompetisi ditimpa; jumlah pemain bebas.
    const meja = Meja.buat(ctx.opsi, 'host', 'Ani', { jumlahPemain: 3, batasPutaran: 20, modeKaldu: true }, { ...KOMPETISI, peserta: 1 });
    return { ...ctx, meja };
  };

  it('pengaturan terkunci dari kompetisi, info meja menyebut kompetisinya', () => {
    const { meja, surat } = buatMeja();
    const info = surat.info('host');
    expect(info.kompetisi).toEqual({ kode: 'KOMPA', nama: 'Remi Jumat' });
    expect(info.pengaturan).toMatchObject({ jumlahPemain: 3, batasPutaran: 1, modeKaldu: false, detikGiliran: 0 });
    expect(meja.kompetisi).toBe('KOMPA');
    // Id peserta tidak pernah dikirim ke client.
    expect(JSON.stringify(info)).not.toContain('peserta');
  });

  it('hanya peserta yang bisa duduk, satu peserta satu kursi, tanpa warga kedai', () => {
    const { meja, surat } = buatMeja();
    expect(() => meja.masuk('tamu', 'Tamu')).toThrow(/khusus peserta kompetisi "Remi Jumat"/);
    expect(() => meja.masuk('hp2', 'Ani', 1)).toThrow(/dari HP lain/);
    meja.masuk('budi', 'Budi', 2);
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    expect(surat.errors('host').at(-1)).toMatch(/nggak bisa diisi warga kedai/);
    meja.terima('host', { t: 'mulai' });
    expect(surat.errors('host').at(-1)).toMatch(/Tunggu peserta lain masuk/);
    meja.terima('host', { t: 'pengaturan', pengaturan: { batasPutaran: 3 } });
    expect(surat.errors('host').at(-1)).toMatch(/ikut kompetisinya/);
    // Mengurangi jumlah pemain boleh.
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 2, publik: true } });
    expect(surat.info('host').pengaturan).toMatchObject({ jumlahPemain: 2, publik: true, batasPutaran: 1 });
    meja.terima('host', { t: 'mulai' });
    expect(meja.status).toBe('main');
  });

  it('ringkasan akhir membawa kode kompetisi dan id peserta, termasuk yang keluar', () => {
    let ringkasan: RingkasanAkhir | null = null;
    const galat: unknown[] = [];
    const { meja, surat, jam } = buatMeja({ saatSelesai: (r) => (ringkasan = r), saatGalat: (_k, e) => galat.push(e) });
    meja.masuk('budi', 'Budi', 2);
    meja.masuk('cici', 'Cici', 3);
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    // Cici keluar di tengah putaran: kursinya diteruskan warga kedai, tetap atas nama pesertanya.
    meja.terima('cici', { t: 'keluar' });
    expect(meja.data.kursi[2]).toMatchObject({ jenis: 'bot', keluar: true, peserta: 3 });
    const rng = new Rng(7);
    for (let i = 0; i < 20000 && meja.status === 'main'; i++) {
      if (aksiManusia(meja, surat, 'host', rng) || aksiManusia(meja, surat, 'budi', rng)) continue;
      jam.langkah();
    }
    expect(galat).toEqual([]);
    expect(meja.status).toBe('selesai');
    const r = ringkasan as RingkasanAkhir | null;
    expect(r?.kompetisi).toBe('KOMPA');
    expect(r?.pemain.map((p) => [p.nama, p.peserta, !!p.keluar]).sort()).toEqual([
      ['Ani', 1, false],
      ['Budi', 2, false],
      ['Cici', 3, true],
    ]);

    // Main lagi: kursi warga kedai dikosongkan untuk peserta lain.
    meja.terima('host', { t: 'mainLagi' });
    expect(meja.data.kursi[2].jenis).toBe('kosong');
    meja.masuk('dodi', 'Dodi', 4);
    expect(meja.data.kursi[2]).toMatchObject({ jenis: 'manusia', nama: 'Dodi', peserta: 4 });
  });

  it('meja biasa tidak berubah: tanpa kompetisi di data, info, dan ringkasan', () => {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Ani');
    expect('kompetisi' in meja.data).toBe(false);
    expect('kompetisi' in ctx.surat.info('host')).toBe(false);
    expect(meja.kompetisi).toBeNull();
    meja.masuk('tamu', 'Tamu', 5);
    expect('peserta' in meja.data.kursi[1]).toBe(false);
  });
});
