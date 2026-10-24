// @vitest-environment happy-dom
// Layar Kompetisi dan lobi meja kompetisi (keputusan pemilik #51, versi 2 24 Okt 2026): daftar, detail
// dengan tiket, Ikut serta (tiket tersimpan di HP), daftar meja yang menunggu (Duduk / Buka meja baru,
// tanpa kode), polling detail (hanya selama layar terbuka dan tab terlihat), "waktu habis · menunggu N
// meja terakhir", nilai satu desimal, piala 🏆, formulir pengajuan (jumlah pemain, batas putaran tanpa
// "Tanpa batas", 2 deck hanya untuk 4 pemain), lobi kompetisi (tanpa kode/undangan/Mulai, menunggu N
// peserta, hitung mundur, aturan sebagai teks), dan teks konfirmasi keluar.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Meja,
  nilaiKompetisi,
  permainanKompetisiDihitung,
  teksNilai,
  PENGATURAN_KOMPETISI_BAWAAN,
  PILIHAN_BATAS_PUTARAN_KOMPETISI,
  PILIHAN_DETIK_GILIRAN_KOMPETISI,
  type BarisKompetisi,
  type HasilKompetisiKursi,
  type InfoMeja,
  type PesanServer,
} from '@remi/meja';
import { BAB_BANTUAN } from '../src/konten/bantuan';
import { TEKS_KALDU } from '../src/konten/kaldu';
import { simpan } from '../src/penyimpanan';
import { tutupSemuaJendela } from '../src/ui/dom';
import { htmlKlasemen, htmlPiala, keteranganWaktu, POLLING_DETAIL_MS, renderKompetisi, ringkasAturan, type AksiKompetisi } from '../src/ui/kompetisi';
import { opsiKonfirmasiKeluar, renderLobi, teksStatusLobiKompetisi } from '../src/ui/lobi';
import { TEKS_KOMPETISI, teksHasilKompetisi, teksMenungguMeja, teksMenungguPeserta, teksPeringkatKompetisi, teksPiala } from '../src/konten/kompetisi';

const akar = () => document.getElementById('ui')!;
const tunggu = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};
const aksiPalsu = () => ({
  kembali: vi.fn<AksiKompetisi['kembali']>(),
  buatMeja: vi.fn<AksiKompetisi['buatMeja']>(),
  duduk: vi.fn<AksiKompetisi['duduk']>(),
});

interface Panggilan {
  url: string;
  init?: RequestInit;
}

/** fetch palsu: jawaban per "METODE url". */
function pasangFetch(jawab: (url: string, init?: RequestInit) => unknown): Panggilan[] {
  const panggil: Panggilan[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      panggil.push({ url, init });
      const isi = jawab(url, init);
      if (isi instanceof Error) throw isi;
      const [status, data] = Array.isArray(isi) ? isi : [200, isi];
      return { ok: status < 400, status, json: async () => data } as Response;
    }),
  );
  return panggil;
}

const ringkas = (kode: string, status: string, extra: Record<string, unknown> = {}) => ({
  kode,
  nama: `Kompetisi ${kode}`,
  masa: 'minggu',
  status,
  jumlahPeserta: 4,
  diajukanPada: Date.UTC(2026, 9, 20),
  mulaiPada: status === 'pengajuan' ? null : Date.UTC(2026, 9, 20, 1),
  berakhirPada: status === 'pengajuan' ? null : Date.UTC(2026, 9, 27, 1),
  disudahi: false,
  mejaMain: 0,
  ...extra,
});

const baris = (nama: string, main: number, totalNilai: number, extra: Partial<BarisKompetisi> & { piala?: number } = {}): BarisKompetisi => ({
  id: nama.length,
  nama,
  main,
  juara: 0,
  keluar: 0,
  totalNilai,
  rataNilai: main ? totalNilai / main : 0,
  rataSkor: 0,
  peringkat: main >= 3 ? 1 : null,
  ...extra,
});

const detail = (status: string, extra: Record<string, unknown> = {}) => ({
  v: 1,
  ...ringkas('KOMPA', status),
  pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 5 },
  minPeserta: 4,
  minMain: 3,
  peserta: ['Ani', 'Budi', 'Cici', 'Dodi'],
  jumlahPermainan: 2,
  setujuTutup: 1,
  peringkat: [baris('Ani', 3, 7)],
  belumCukup: [baris('Budi', 1, 2)],
  meja: [],
  ...extra,
});

const SAYA = { saya: { id: 2, nama: 'Budi', setujuTutup: false } };

beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
  localStorage.clear();
  simpan.setNama('Budi');
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  tutupSemuaJendela();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Layar lama dibuang: polling yang masih terjadwal berhenti sendiri.
  document.body.innerHTML = '';
});

describe('tiket kompetisi di HP', () => {
  it('tiket terbaru di depan, kode sama diganti, data rusak dibuang', () => {
    simpan.tambahTiketKompetisi({ kode: 'AAAAA', token: 't1', nama: 'Budi' });
    simpan.tambahTiketKompetisi({ kode: 'BBBBB', token: 't2', nama: 'Budi' });
    simpan.tambahTiketKompetisi({ kode: 'AAAAA', token: 't3', nama: 'Budi' });
    expect(simpan.tiketKompetisi().map((t) => [t.kode, t.token])).toEqual([
      ['AAAAA', 't3'],
      ['BBBBB', 't2'],
    ]);
    localStorage.setItem('remi.tiketKompetisi', JSON.stringify([{ kode: 'CCCCC', token: 'x' }, { kode: 5 }, 'rusak']));
    expect(simpan.tiketKompetisi()).toEqual([{ kode: 'CCCCC', token: 'x', nama: '' }]);
    localStorage.setItem('remi.tiketKompetisi', '{"bukan":"daftar"}');
    expect(simpan.tiketKompetisi()).toEqual([]);
  });

  it('paling banyak 20 tiket', () => {
    for (let i = 0; i < 25; i++) simpan.tambahTiketKompetisi({ kode: `K${String(i).padStart(4, '0')}`, token: `t${i}`, nama: 'Budi' });
    expect(simpan.tiketKompetisi()).toHaveLength(20);
    expect(simpan.tiketKompetisi()[0]!.token).toBe('t24');
  });
});

describe('teks kompetisi', () => {
  const h = (x: Partial<HasilKompetisiKursi>): HasilKompetisiKursi => ({
    kursi: 0,
    nama: 'Ani',
    nilai: 20 / 3,
    keluar: false,
    rataNilai: 35 / 6,
    main: 4,
    peringkatSebelum: 4,
    peringkatSesudah: 2,
    ...x,
  });

  it('baris hasil: nilai bertanda satu desimal, rata-rata, naik/turun/tetap/masuk/belum masuk klasemen', () => {
    expect(teksHasilKompetisi(h({}), 3, 4)).toBe('+6,7 · rata-rata 5,8 · naik ke peringkat 2 (dari 4)');
    expect(teksHasilKompetisi(h({ peringkatSebelum: 1, peringkatSesudah: 3 }), 3, 5)).toBe('+6,7 · rata-rata 5,8 · turun ke peringkat 3 (dari 5)');
    expect(teksHasilKompetisi(h({ peringkatSebelum: 2, peringkatSesudah: 2 }), 3, 4)).toBe('+6,7 · rata-rata 5,8 · tetap di peringkat 2 (dari 4)');
    expect(teksHasilKompetisi(h({ main: 3, peringkatSebelum: null, peringkatSesudah: 1 }), 3, 2)).toBe(
      '+6,7 · rata-rata 5,8 · masuk klasemen di peringkat 1 (dari 2)',
    );
    expect(teksHasilKompetisi(h({ main: 2, nilai: 10, rataNilai: 10, peringkatSebelum: null, peringkatSesudah: null }), 3, 0)).toBe(
      '+10,0 · rata-rata 10,0 · belum masuk klasemen (2 dari 3 main)',
    );
    // Yang keluar di tengah permainan: nilai 0, ditandai.
    expect(teksHasilKompetisi(h({ keluar: true, nilai: 0, rataNilai: 0, main: 1, peringkatSebelum: null, peringkatSesudah: null }), 3, 0)).toBe(
      '0,0 (keluar) · rata-rata 0,0 · belum masuk klasemen (1 dari 3 main)',
    );
    expect(teksPeringkatKompetisi({ main: 5, peringkatSebelum: 3, peringkatSesudah: 1 }, 3, 6)).toBe('naik ke peringkat 1 (dari 6)');
  });

  it('piala: kosong kalau 0, "🏆" sekali, "🏆3" tiga kali; HTML berlabel untuk pembaca layar', () => {
    expect(teksPiala(0)).toBe('');
    expect(teksPiala(undefined)).toBe('');
    expect(teksPiala(1)).toBe('🏆');
    expect(teksPiala(3)).toBe('🏆3');
    expect(htmlPiala(0)).toBe('');
    const el = document.createElement('div');
    el.innerHTML = htmlPiala(2);
    expect(el.querySelector('.piala')!.textContent).toBe('🏆2');
    expect(el.querySelector('.piala')!.getAttribute('aria-label')).toBe('juara kompetisi 2 kali');
  });

  it('menunggu peserta / meja terakhir, cara hitung rata-rata 0–10 tanpa "poin"', () => {
    expect(teksMenungguPeserta(1)).toBe('Menunggu 1 peserta lagi…');
    expect(teksMenungguPeserta(3)).toBe('Menunggu 3 peserta lagi…');
    expect(teksMenungguMeja(2, false)).toBe('Waktu habis · menunggu 2 meja terakhir selesai');
    expect(teksMenungguMeja(1, true)).toBe('Disudahi · menunggu 1 meja terakhir selesai');
    expect(TEKS_KOMPETISI.caraHitung).toContain('rata-rata nilai');
    expect(TEKS_KOMPETISI.caraHitung).toContain('0 sampai 10');
    expect(TEKS_KOMPETISI.caraHitung).toContain('6,7');
    expect(TEKS_KOMPETISI.caraHitung).not.toMatch(/\bpoin\b/i);
    // Tidak ada teks kompetisi yang masih bicara soal kode meja atau poin.
    for (const t of Object.values(TEKS_KOMPETISI)) {
      expect(t).not.toMatch(/\bpoin\b/i);
      expect(t).not.toMatch(/kode meja/i);
    }
  });

  // Keputusan pemilik 24 Okt 2026: yang keluar tak dihitung, dan meja kompetisi tanpa voting.
  it('cara hitung dan Bantuan: contoh "1 yang keluar" sama dengan aturan; tinggal satu = tidak dihitung; tanpa voting', () => {
    const contoh = nilaiKompetisi([
      { nama: 'A', bot: false, skor: 90 },
      { nama: 'B', bot: false, skor: 40 },
      { nama: 'Kabur', bot: false, skor: 300, keluar: true },
      { nama: 'C', bot: false, skor: -10 },
    ]).map((v) => teksNilai(v.nilai).replace(',0', ''));
    expect(contoh).toEqual(['10', '5', '0', '0']);
    expect(TEKS_KOMPETISI.caraHitung).toContain(`(meja 4 orang dengan 1 yang keluar: ${contoh[0]}; ${contoh[1]}; ${contoh[3]})`);
    expect(TEKS_KOMPETISI.caraHitung).toContain('cuma satu yang bertahan, permainan itu tidak masuk klasemen');
    expect(permainanKompetisiDihitung([{ keluar: true }, {}, { keluar: true }, { keluar: true }])).toBe(false);
    const online = JSON.stringify(BAB_BANTUAN.find((b) => b.id === 'online'));
    expect(online).toContain(`Meja 4 orang dengan 1 yang keluar: juara ${contoh[0]}; kedua ${contoh[1]}; ketiga ${contoh[3]}.`);
    expect(online).toContain('Kalau cuma satu yang bertahan, permainan itu tidak masuk klasemen.');
    expect(online).toContain(`Di meja kompetisi tidak ada Akhiri permainan maupun ${TEKS_KALDU.tombol}`);
    // Kalimat lama (voting akhiri butuh semua peserta) tidak ada lagi.
    expect(online).not.toContain('termasuk yang sedang terputus');
    expect(JSON.stringify(BAB_BANTUAN.find((b) => b.id === 'akhir-permainan'))).toContain('Di meja kompetisi tidak ada sepakat berhenti.');
  });

  it('ringkasan aturan memuat pemain per meja dan batas putaran; keterangan waktu sesuai status', () => {
    expect(ringkasAturan({ ...PENGATURAN_KOMPETISI_BAWAAN, jumlahPemain: 4, duaDeckUntukEmpat: true, batasPutaran: 10, detikGiliran: 30 })).toBe(
      '4 pemain per meja · 2 deck · 10 putaran · 30 detik per giliran',
    );
    expect(ringkasAturan({ ...PENGATURAN_KOMPETISI_BAWAAN, jumlahPemain: 3, batasPutaran: 5, modeKaldu: true, batasSkorAtas: 300 })).toBe(
      '3 pemain per meja · 5 putaran · mode kaldu · 60 detik per giliran',
    );
    const k = ringkas('KOMPA', 'selesai') as Parameters<typeof keteranganWaktu>[0];
    expect(keteranganWaktu({ ...k, mejaMain: 2 })).toBe('Waktu habis · menunggu 2 meja terakhir selesai');
    expect(keteranganWaktu({ ...k, mejaMain: 1, disudahi: true })).toBe('Disudahi · menunggu 1 meja terakhir selesai');
    expect(keteranganWaktu({ ...k, disudahi: true })).toMatch(/^Disudahi /);
    expect(keteranganWaktu(k)).toMatch(/^Selesai /);
  });
});

describe('layar Kompetisi: daftar', () => {
  it('daftar dibagi per status, kompetisi yang kuikuti ditandai, juara tampil dengan pialanya', async () => {
    simpan.tambahTiketKompetisi({ kode: 'JALAN', token: 'tok', nama: 'Budi' });
    pasangFetch(() => ({
      v: 1,
      kompetisi: [
        ringkas('AJUKN', 'pengajuan'),
        ringkas('JALAN', 'berjalan'),
        ringkas('LAMAA', 'selesai', { juara: ['Ani', 'Cici'], pialaJuara: [2, 1] }),
        ringkas('HABIS', 'selesai', { mejaMain: 1 }),
      ],
    }));
    renderKompetisi(akar(), aksiPalsu());
    await tunggu();
    const judul = [...akar().querySelectorAll('#isi-daftar h2')].map((h) => h.textContent);
    expect(judul).toEqual([TEKS_KOMPETISI.bagianBerjalan, TEKS_KOMPETISI.bagianPengajuan, TEKS_KOMPETISI.bagianSelesai]);
    const jalan = akar().querySelector('[data-kode="JALAN"]')!;
    expect(jalan.textContent).toContain(TEKS_KOMPETISI.lencanaIkut);
    expect(akar().querySelector('[data-kode="AJUKN"]')!.textContent).not.toContain(TEKS_KOMPETISI.lencanaIkut);
    expect(akar().querySelector('[data-kode="LAMAA"]')!.textContent).toContain('Juara: Ani 🏆2, Cici 🏆');
    // Waktu habis tapi masih ada meja yang main: juara belum diumumkan.
    const habis = akar().querySelector('[data-kode="HABIS"]')!.textContent!;
    expect(habis).toContain('Waktu habis · menunggu 1 meja terakhir selesai');
    expect(habis).not.toContain('Juara');
  });
});

describe('layar Kompetisi: detail', () => {
  it('tanpa tiket ada Ikut serta; sesudah ikut, tiket tersimpan dan daftar meja + Buka meja baru muncul', async () => {
    let sudahIkut = false;
    const panggil = pasangFetch((url, init) => {
      if (init?.method === 'POST') {
        sudahIkut = true;
        return { token: 'tiket-baru', detail: detail('berjalan', SAYA) };
      }
      return detail('berjalan', sudahIkut ? SAYA : {});
    });
    const aksi = aksiPalsu();
    renderKompetisi(akar(), aksi, 'KOMPA');
    await tunggu();
    expect(panggil[0]!.url).toBe('/api/kompetisi/KOMPA');
    expect(akar().querySelector('#buka-meja')).toBeNull();
    expect(akar().querySelector('.panel-meja-kompetisi')).toBeNull();
    // Klasemen: rata-rata nilai di kanan (satu desimal), yang belum cukup main di bagian terpisah.
    expect(akar().querySelector('.baris-peringkat .total')!.textContent).toBe('2,3');
    expect(akar().querySelector('.baris-peringkat .kanan-peringkat small')!.textContent).toBe('rata-rata');
    expect(akar().textContent).toContain(TEKS_KOMPETISI.judulBelumCukup);

    akar().querySelector<HTMLButtonElement>('#ikut')!.click();
    await tunggu();
    const post = panggil.find((p) => p.init?.method === 'POST')!;
    expect(post.url).toBe('/api/kompetisi/KOMPA/ikut');
    expect(JSON.parse(String(post.init!.body))).toEqual({ nama: 'Budi' });
    expect(simpan.tiketKompetisi()).toEqual([{ kode: 'KOMPA', token: 'tiket-baru', nama: 'Budi' }]);
    expect(akar().querySelector('#ikut')).toBeNull();
    expect(akar().querySelector('.panel-meja-kompetisi')!.textContent).toContain(TEKS_KOMPETISI.mejaKosong);
    akar().querySelector<HTMLButtonElement>('#buka-meja')!.click();
    expect(aksi.buatMeja).toHaveBeenCalledWith('KOMPA', 'tiket-baru');
  });

  it('daftar meja yang menunggu: nama host, isi, siapa saja; Duduk memakai kode meja tanpa menampilkannya', async () => {
    simpan.tambahTiketKompetisi({ kode: 'KOMPA', token: 'tok', nama: 'Budi' });
    pasangFetch(() =>
      detail('berjalan', {
        ...SAYA,
        nama: 'Remi Jumat',
        meja: [
          { kode: 'PENUH', nama: 'Dodi', terisi: 4, jumlahPemain: 4, pemain: ['Dodi', 'Eka', 'Fajar', 'Gita'] },
          { kode: 'MJANI', nama: 'Ani', terisi: 2, jumlahPemain: 4, pemain: ['Ani', 'Cici'] },
        ],
      }),
    );
    const aksi = aksiPalsu();
    renderKompetisi(akar(), aksi, 'KOMPA');
    await tunggu();
    const item = [...akar().querySelectorAll('.item-meja-kompetisi')];
    expect(item.map((el) => el.querySelector('b')!.textContent)).toEqual(['Meja Dodi · 4/4', 'Meja Ani · 2/4']);
    expect(item[1]!.textContent).toContain('Ani, Cici');
    // Meja yang sudah penuh (sedang hitung mundur) tanpa tombol Duduk.
    expect(item[0]!.querySelector('[data-duduk]')).toBeNull();
    expect(item[0]!.textContent).toContain(TEKS_KOMPETISI.mejaPenuh);
    // Tanpa kode di layar (kode meja maupun kode kompetisi), tanpa isian kode.
    const teks = akar().textContent!;
    for (const kode of ['PENUH', 'MJANI', 'KOMPA']) expect(teks).not.toContain(kode);
    expect(teks).not.toMatch(/\bkode\b/i);
    expect(akar().querySelector('input')).toBeNull();
    // Ada kursi kosong: Duduk jadi tombol utama, Buka meja baru pilihan kedua.
    const duduk = akar().querySelector<HTMLButtonElement>('[data-duduk]')!;
    expect(duduk.classList.contains('utama')).toBe(true);
    expect(akar().querySelector('#buka-meja')!.classList.contains('utama')).toBe(false);
    duduk.click();
    expect(aksi.duduk).toHaveBeenCalledWith('MJANI');
    // Menunggu jawaban server: tombol meja dikunci supaya tidak terkirim dua kali.
    expect(duduk.disabled).toBe(true);
    expect(akar().querySelector<HTMLButtonElement>('#buka-meja')!.disabled).toBe(true);
    duduk.click();
    expect(aksi.duduk).toHaveBeenCalledTimes(1);
  });

  it('dengan tiket: tiket dikirim lewat header, tombol sudahi mengirim voting', async () => {
    simpan.tambahTiketKompetisi({ kode: 'KOMPA', token: 'tok', nama: 'Budi' });
    const panggil = pasangFetch((url, init) =>
      init?.method === 'POST'
        ? { detail: detail('berjalan', { setujuTutup: 2, saya: { id: 2, nama: 'Budi', setujuTutup: true } }) }
        : detail('berjalan', SAYA),
    );
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await tunggu();
    expect((panggil[0]!.init!.headers as Record<string, string>)['x-tiket-kompetisi']).toBe('tok');
    expect(akar().textContent).toContain('1 dari 4 setuju (butuh 3)');
    akar().querySelector<HTMLButtonElement>('#sudahi')!.click();
    await tunggu();
    const post = panggil.find((p) => p.init?.method === 'POST')!;
    expect(post.url).toBe('/api/kompetisi/KOMPA/tutup');
    expect(JSON.parse(String(post.init!.body))).toEqual({ token: 'tok', setuju: true });
    expect(akar().querySelector('#sudahi')!.getAttribute('aria-pressed')).toBe('true');
    expect(akar().textContent).toContain('2 dari 4 setuju');
  });

  it('selesai: juara dan piala di juara, klasemen, dan daftar peserta; tanpa Ikut serta', async () => {
    pasangFetch(() =>
      detail('selesai', {
        juara: ['Ani'],
        pialaJuara: [2],
        peringkat: [baris('Ani', 3, 30, { piala: 2, peringkat: 1 }), baris('Cici', 3, 10, { piala: 0, peringkat: 2 })],
        belumCukup: [baris('Budi', 1, 0, { piala: 1 }), baris('Dodi', 0, 0, { piala: 0 })],
      }),
    );
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await tunggu();
    expect(akar().querySelector('#ikut')).toBeNull();
    expect(akar().querySelector('.juara-kompetisi')!.textContent).toBe('Juara: Ani 🏆2');
    expect(akar().querySelector('.peserta-kompetisi')!.textContent).toBe('4 peserta: Ani 🏆2, Budi 🏆, Cici, Dodi');
    const nama = [...akar().querySelectorAll('.baris-peringkat .nama-skor > b')].map((b) => b.textContent);
    expect(nama).toEqual(['Ani 🏆2', 'Cici', 'Budi 🏆', 'Dodi']);
    // Medali ikut nomor peringkat dari server; nilai satu desimal.
    expect([...akar().querySelectorAll('.baris-peringkat .medali')].map((m) => m.textContent)).toEqual(['🥇', '🥈', '·', '·']);
    expect(akar().querySelector('.baris-peringkat .total')!.textContent).toBe('10,0');
  });

  it('waktu habis tapi masih ada meja yang main: "menunggu N meja terakhir", juara belum diumumkan', async () => {
    pasangFetch(() => detail('selesai', { mejaMain: 2 }));
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await tunggu();
    const panel = akar().querySelector('#isi-detail .kartu-panel')!;
    expect(panel.querySelector('.kepala-panel .lencana')!.textContent).toBe(TEKS_KOMPETISI.lencanaMenunggu);
    expect(panel.textContent).toContain('Waktu habis · menunggu 2 meja terakhir selesai');
    expect(panel.textContent).toContain(TEKS_KOMPETISI.ketJuaraNanti);
    expect(akar().querySelector('.juara-kompetisi')).toBeNull();
  });

  it('disudahi lewat voting dan masih menunggu meja terakhir: lencana "disudahi", bukan "waktu habis"', async () => {
    pasangFetch(() => detail('selesai', { mejaMain: 1, disudahi: true }));
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await tunggu();
    const panel = akar().querySelector('#isi-detail .kartu-panel')!;
    expect(panel.querySelector('.kepala-panel .lencana')!.textContent).toBe(TEKS_KOMPETISI.lencanaMenungguDisudahi);
    expect(panel.textContent).toContain('Disudahi · menunggu 1 meja terakhir selesai');
    expect(panel.textContent).not.toContain(TEKS_KOMPETISI.lencanaMenunggu);
  });

  it('galat server ditampilkan apa adanya, dengan Coba lagi', async () => {
    pasangFetch(() => [404, { error: 'Kompetisinya nggak ketemu.' }]);
    renderKompetisi(akar(), aksiPalsu(), 'ZZZZZ');
    await tunggu();
    expect(akar().textContent).toContain('Kompetisinya nggak ketemu.');
    expect(akar().querySelector('[data-coba]')).not.toBeNull();
  });

  it('klasemen kosong: pesan belum ada permainan', () => {
    expect(htmlKlasemen({ peringkat: [], belumCukup: [baris('Ani', 0, 0)] })).toContain(TEKS_KOMPETISI.klasemenKosong);
  });
});

describe('layar Kompetisi: polling detail', () => {
  it('dimuat ulang tiap ±5 detik selama layar terbuka; tanpa perubahan tidak digambar ulang', async () => {
    vi.useFakeTimers();
    simpan.tambahTiketKompetisi({ kode: 'KOMPA', token: 'tok', nama: 'Budi' });
    let meja: unknown[] = [];
    const panggil = pasangFetch(() => detail('berjalan', { ...SAYA, meja }));
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await vi.advanceTimersByTimeAsync(0);
    expect(panggil).toHaveLength(1);
    const panelLama = akar().querySelector('.panel-meja-kompetisi');
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS);
    expect(panggil).toHaveLength(2);
    // Jawaban sama: elemen lama tetap (tidak digambar ulang).
    expect(akar().querySelector('.panel-meja-kompetisi')).toBe(panelLama);
    // Ada meja baru yang menunggu: muncul di tarikan berikutnya.
    meja = [{ kode: 'MJANI', nama: 'Ani', terisi: 1, jumlahPemain: 4, pemain: ['Ani'] }];
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS);
    expect(panggil).toHaveLength(3);
    expect(akar().querySelector('[data-duduk="MJANI"]')).not.toBeNull();
    // Header tiket ikut di setiap tarikan.
    expect(panggil.every((p) => (p.init?.headers as Record<string, string>)?.['x-tiket-kompetisi'] === 'tok')).toBe(true);
  });

  it('akordion Cara hitung yang terbuka dan fokus tombol bertahan saat digambar ulang', async () => {
    vi.useFakeTimers();
    simpan.tambahTiketKompetisi({ kode: 'KOMPA', token: 'tok', nama: 'Budi' });
    let n = 0;
    pasangFetch(() => detail('berjalan', { ...SAYA, jumlahPermainan: ++n }));
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await vi.advanceTimersByTimeAsync(0);
    akar().querySelector<HTMLDetailsElement>('details.cara-hitung')!.open = true;
    akar().querySelector<HTMLButtonElement>('#sudahi')!.focus();
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS);
    expect(akar().textContent).toContain('2 permainan');
    expect(akar().querySelector<HTMLDetailsElement>('details.cara-hitung')!.open).toBe(true);
    expect(document.activeElement?.id).toBe('sudahi');
  });

  it('berhenti saat tab tersembunyi, lanjut begitu terlihat lagi', async () => {
    vi.useFakeTimers();
    const panggil = pasangFetch(() => detail('berjalan'));
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await vi.advanceTimersByTimeAsync(0);
    expect(panggil).toHaveLength(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS * 4);
    expect(panggil).toHaveLength(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(panggil).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS);
    expect(panggil).toHaveLength(3);
  });

  it('berhenti saat layar ditinggalkan: kembali ke daftar, atau layar lain menggantikan #ui', async () => {
    vi.useFakeTimers();
    const panggil = pasangFetch((url) => (url === '/api/kompetisi' ? { v: 1, kompetisi: [] } : detail('berjalan')));
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await vi.advanceTimersByTimeAsync(0);
    akar().querySelector<HTMLButtonElement>('#kembali')!.click();
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS * 3);
    expect(panggil.map((p) => p.url)).toEqual(['/api/kompetisi/KOMPA', '/api/kompetisi']);

    panggil.length = 0;
    renderKompetisi(akar(), aksiPalsu(), 'KOMPA');
    await vi.advanceTimersByTimeAsync(0);
    // Aplikasi pindah ke lobi meja: isi #ui diganti.
    akar().innerHTML = '<div class="layar layar-lobi"></div>';
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS * 3);
    expect(panggil.map((p) => p.url)).toEqual(['/api/kompetisi/KOMPA']);
    // Tab terlihat lagi sesudahnya juga tidak memulai polling layar yang sudah hilang.
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(POLLING_DETAIL_MS);
    expect(panggil).toHaveLength(1);
  });
});

describe('layar Kompetisi: ajukan', () => {
  const bukaFormulir = async () => {
    const panggil = pasangFetch((url, init) => {
      if (init?.method === 'POST') return { kode: 'BARUU', token: 'tok-aju', detail: detail('pengajuan', { saya: { id: 1, nama: 'Budi', setujuTutup: false } }) };
      if (url === '/api/kompetisi') return { v: 1, kompetisi: [] };
      return detail('pengajuan', { saya: { id: 1, nama: 'Budi', setujuTutup: false } });
    });
    renderKompetisi(akar(), aksiPalsu());
    await tunggu();
    expect(akar().textContent).toContain(TEKS_KOMPETISI.kosong);
    akar().querySelector<HTMLButtonElement>('#ajukan')!.click();
    return panggil;
  };
  const q = <E extends HTMLElement>(s: string) => akar().querySelector<E>(s)!;
  const ganti = (s: string, nilai: string) => {
    const el = q<HTMLSelectElement>(s);
    el.value = nilai;
    el.dispatchEvent(new Event('change'));
  };
  const kirim = async (panggil: Panggilan[]) => {
    q<HTMLFormElement>('#form-ajukan').dispatchEvent(new Event('submit', { cancelable: true }));
    await tunggu();
    return JSON.parse(String(panggil.find((p) => p.init?.method === 'POST')!.init!.body));
  };

  it('pilihan: pemain per meja 2–6 (bawaan 4), batas putaran 3/5/10/15/20 (bawaan 5) tanpa "Tanpa batas"', async () => {
    await bukaFormulir();
    expect([...q<HTMLSelectElement>('#k-jumlah').options].map((o) => o.value)).toEqual(['2', '3', '4', '5', '6']);
    expect(q<HTMLSelectElement>('#k-jumlah').value).toBe('4');
    expect([...q<HTMLSelectElement>('#k-putaran').options].map((o) => Number(o.value))).toEqual([...PILIHAN_BATAS_PUTARAN_KOMPETISI]);
    expect(q<HTMLSelectElement>('#k-putaran').value).toBe('5');
    expect(q('#k-putaran').textContent).not.toContain('Tanpa batas');
  });

  it('waktu per giliran wajib ada: 30/60/90/120 detik (bawaan 60), tanpa "Tanpa batas", dengan keterangannya', async () => {
    await bukaFormulir();
    expect([...q<HTMLSelectElement>('#k-detik').options].map((o) => Number(o.value))).toEqual([...PILIHAN_DETIK_GILIRAN_KOMPETISI]);
    expect(q<HTMLSelectElement>('#k-detik').value).toBe('60');
    expect(q('#k-detik').textContent).not.toContain('Tanpa batas');
    expect(q('#form-ajukan').textContent).toContain(TEKS_KOMPETISI.ketDetik);
  });

  it('2 deck hanya tampil untuk 4 pemain; selain 4 tidak pernah dikirim nyala', async () => {
    const panggil = await bukaFormulir();
    expect(q('#k-baris-dua').classList.contains('tersembunyi')).toBe(false);
    q<HTMLInputElement>('#k-dua').checked = true;
    ganti('#k-jumlah', '5');
    expect(q('#k-baris-dua').classList.contains('tersembunyi')).toBe(true);
    q<HTMLInputElement>('#k-nama').value = 'Remi Jumat';
    const isi = await kirim(panggil);
    expect(isi.pengaturan).toMatchObject({ jumlahPemain: 5, duaDeckUntukEmpat: false });
  });

  it('aturan dikirim (jumlah pemain, batas putaran), mode kaldu menyembunyikan dan mengosongkan batas skor, tiket pengaju tersimpan', async () => {
    const panggil = await bukaFormulir();
    q<HTMLInputElement>('#k-nama').value = 'Remi Jumat';
    ganti('#k-masa', 'bulan');
    ganti('#k-putaran', '10');
    ganti('#k-detik', '30');
    q<HTMLInputElement>('#k-dua').checked = true;
    q<HTMLInputElement>('#k-skor-atas').value = '300';
    const kaldu = q<HTMLInputElement>('#k-kaldu');
    kaldu.checked = true;
    kaldu.dispatchEvent(new Event('change'));
    expect(q('.isian-batas-skor').classList.contains('tersembunyi')).toBe(true);
    const isi = await kirim(panggil);
    expect(panggil.find((p) => p.init?.method === 'POST')!.url).toBe('/api/kompetisi');
    expect(isi).toEqual({
      nama: 'Remi Jumat',
      masa: 'bulan',
      namaPengaju: 'Budi',
      pengaturan: {
        jumlahPemain: 4,
        batasPutaran: 10,
        duaDeckUntukEmpat: true,
        modeKaldu: true,
        detikGiliran: 30,
        batasSkorAtas: null,
        batasSkorBawah: null,
      },
    });
    expect(simpan.tiketKompetisi()[0]).toEqual({ kode: 'BARUU', token: 'tok-aju', nama: 'Budi' });
  });
});

describe('lobi meja kompetisi', () => {
  function infoLobi(jumlahPemain = 3, ubah: Partial<InfoMeja> = {}): InfoMeja {
    let info: InfoMeja | null = null;
    const meja = Meja.buat(
      {
        kode: 'MEJAA',
        penjadwal: { setel: () => 0, batal: () => undefined, sekarang: () => 0 },
        kirim: (_: string, p: PesanServer) => {
          if (p.t === 'meja') info = p.info;
        },
      },
      'host',
      'Ani',
      {},
      { kode: 'KOMPA', nama: 'Remi Jumat', pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, jumlahPemain, batasPutaran: 5 }, peserta: 1 },
    );
    meja.hentikan();
    return { ...info!, ...ubah };
  }

  it('nama kompetisi jadi judul; tanpa kode meja, link undangan, Bagikan, warga kedai, maupun tombol Mulai', () => {
    const info = infoLobi();
    renderLobi(akar(), info, vi.fn(), vi.fn());
    expect(akar().querySelector('.lobi-kompetisi .nama-kompetisi')!.textContent).toBe('Remi Jumat');
    expect(akar().querySelector('.kode-besar')).toBeNull();
    expect(akar().querySelector('#salin')).toBeNull();
    expect(akar().querySelector('#bagi')).toBeNull();
    expect(akar().querySelector('#mulai')).toBeNull();
    expect(akar().querySelector('#kocok')).toBeNull();
    expect(akar().querySelector('#isi-bot')).toBeNull();
    expect(akar().textContent).not.toContain(info.kode);
    // Host tidak mengatur kursi: tidak bisa mengisi warga kedai maupun mengosongkan kursi peserta lain.
    expect(akar().querySelectorAll('[data-kursi]')).toHaveLength(0);
    const ramai: InfoMeja = {
      ...info,
      kursi: info.kursi.map((k, i) => ({ jenis: 'manusia', nama: ['Ani', 'Budi', 'Cici'][i]!, terhubung: true, level: k.level })),
    };
    renderLobi(akar(), ramai, vi.fn(), vi.fn());
    expect(akar().querySelectorAll('[data-kursi]')).toHaveLength(0);
    expect(akar().textContent).toContain('Budi');
  });

  it('aturan sebagai teks (dikunci kompetisi): tanpa pilihan, isian, atau kotak centang', () => {
    renderLobi(akar(), infoLobi(4), vi.fn(), vi.fn());
    for (const id of ['jumlah', 'putaran', 'detik', 'kaldu', 'dua']) {
      expect(akar().querySelector(`#${id}`)!.tagName, id).toBe('B');
    }
    expect(akar().querySelector('#jumlah')!.textContent).toBe('4 orang');
    expect(akar().querySelector('#putaran')!.textContent).toBe('5');
    expect(akar().querySelector('#detik')!.textContent).toBe('60 detik');
    expect(akar().querySelector('#tempo')).toBeNull();
    expect(akar().querySelector('#publik')).toBeNull();
    expect(akar().querySelector('.layar-lobi select:not([data-kursi]), .layar-lobi input')).toBeNull();
    expect(akar().textContent).toContain(TEKS_KOMPETISI.aturanDikunci);
    // Meja 3 pemain: baris 2 deck tidak ada.
    renderLobi(akar(), infoLobi(3), vi.fn(), vi.fn());
    expect(akar().querySelector('#dua')).toBeNull();
  });

  it('status: menunggu N peserta lagi; penuh = hitung mundur mulai sendiri yang berjalan', () => {
    vi.useFakeTimers();
    const info = infoLobi(3);
    renderLobi(akar(), info, vi.fn(), vi.fn());
    const status = () => akar().querySelector('#status-lobi')!;
    expect(status().textContent).toBe('Menunggu 2 peserta lagi…');
    expect(status().getAttribute('role')).toBe('status');
    // Kursi penuh dan semua tersambung: meja mengirim sisa hitung mundur.
    const penuh: InfoMeja = {
      ...info,
      kursi: info.kursi.map((k, i) => ({ jenis: 'manusia', nama: ['Ani', 'Budi', 'Cici'][i]!, terhubung: true, level: k.level })),
      mulaiOtomatis: { sisaMs: 2000 },
    };
    renderLobi(akar(), penuh, vi.fn(), vi.fn());
    expect(status().textContent).toBe(`${TEKS_KOMPETISI.lobiPenuh} dalam 2 detik…`);
    expect(status().classList.contains('penuh')).toBe(true);
    vi.advanceTimersByTime(1100);
    expect(status().textContent).toBe(`${TEKS_KOMPETISI.lobiPenuh} dalam 1 detik…`);
    vi.advanceTimersByTime(1000);
    expect(status().textContent).toBe(`${TEKS_KOMPETISI.lobiPenuh} sekarang…`);
    // Ada yang terputus (hitung mundur batal): menunggu semua tersambung.
    const putus: InfoMeja = { ...penuh, mulaiOtomatis: undefined, kursi: penuh.kursi.map((k, i) => (i === 2 ? { ...k, terhubung: false } : k)) };
    renderLobi(akar(), putus, vi.fn(), vi.fn());
    expect(status().textContent).toBe(TEKS_KOMPETISI.menungguTersambung);
    expect(teksStatusLobiKompetisi(putus, null)).toBe(TEKS_KOMPETISI.menungguTersambung);
  });

  it('keluar dari lobi kompetisi: teks konfirmasinya menunjuk daftar meja di layar Kompetisi, bukan kode meja', () => {
    const o = opsiKonfirmasiKeluar({ asal: 'lobi', offline: false, kompetisi: true });
    expect(o.pesan).toBe(TEKS_KOMPETISI.keluarLobi);
    expect(o.pesan).not.toMatch(/kode/i);
    expect(opsiKonfirmasiKeluar({ asal: 'lobi', offline: false }).pesan).toContain('kode meja');
  });

  it('konfirmasi keluar di tengah permainan menyebut nilai 0; sesudah selesai tanpa ajakan main lagi', () => {
    const o = opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: true, kompetisi: true });
    expect(o.pesan).toContain(TEKS_KOMPETISI.keluarMeja);
    expect(opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: true }).pesan).not.toContain(TEKS_KOMPETISI.keluarMeja);
    const selesai = opsiKonfirmasiKeluar({ asal: 'meja', offline: false, selesai: true, kompetisi: true });
    expect(selesai.pesan).toBe(TEKS_KOMPETISI.keluarSelesai);
    expect(selesai.pesan).not.toMatch(/main lagi/i);
  });
});

describe('lobi digambar ulang', () => {
  function infoBiasa(jumlahPemain: number): InfoMeja {
    let info: InfoMeja | null = null;
    const meja = Meja.buat(
      {
        kode: 'MEJAB',
        penjadwal: { setel: () => 0, batal: () => undefined, sekarang: () => 0 },
        kirim: (_: string, p: PesanServer) => {
          if (p.t === 'meja') info = p.info;
        },
      },
      'host',
      'Ani',
      { jumlahPemain },
    );
    meja.hentikan();
    return info!;
  }

  it('posisi gulir dan pilihan yang difokus tidak lompat ke atas saat pengaturan berubah', () => {
    renderLobi(akar(), infoBiasa(4), vi.fn(), vi.fn());
    akar().querySelector<HTMLElement>('.layar-lobi')!.scrollTop = 420;
    akar().querySelector<HTMLSelectElement>('#putaran')!.focus();
    renderLobi(akar(), infoBiasa(5), vi.fn(), vi.fn());
    expect(akar().querySelector<HTMLElement>('.layar-lobi')!.scrollTop).toBe(420);
    expect(document.activeElement?.id).toBe('putaran');
  });

  it('pertama kali dibuka tetap dari atas', () => {
    akar().innerHTML = '<div class="layar beranda"></div>';
    renderLobi(akar(), infoBiasa(4), vi.fn(), vi.fn());
    expect(akar().querySelector<HTMLElement>('.layar-lobi')!.scrollTop).toBe(0);
  });

  it('meja biasa tetap seperti sebelumnya: kode, undangan, Mulai, pilihan pengaturan', () => {
    renderLobi(akar(), infoBiasa(4), vi.fn(), vi.fn());
    expect(akar().querySelector('.kode-besar')!.textContent).toBe('MEJAB');
    expect(akar().querySelector('#salin')).not.toBeNull();
    expect(akar().querySelector('#mulai')).not.toBeNull();
    expect(akar().querySelector('#jumlah')!.tagName).toBe('SELECT');
    expect(akar().querySelector('.lobi-kompetisi')).toBeNull();
  });
});
