// Sprint (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026): satu pemain lawan lima warga kedai Suhu
// (gaya personanya), 6 pemain 2 deck, tanpa batas putaran, pengaturan dikunci; setiap putaran yang selesai
// dicatat. Aturan hitung (minggu WIB, hasil per putaran, papan, juara mingguan) di sprint.ts; meja sprint
// di meja.ts.

import { describe, expect, it } from 'vitest';
import { BATAS_PERISTIWA_VIEW, jumlahPutaranSelesai, periksaInvarian, Rng, type HasilPutaran } from '@remi/engine';
import {
  awalMingguWib,
  catatanSprint,
  catatanSprintTerakhir,
  PUTARAN_RINCI_SPRINT,
  rampingkanGameSprint,
  dataMejaDipulihkan,
  gayaKursi,
  hasilPutaranSprint,
  hasilSprint,
  juaraMingguan,
  Meja,
  mingguSprint,
  ringkasanLanjutSprint,
  NAMA_LAWAN_SPRINT,
  PENGATURAN_SPRINT,
  pialaSprint,
  rekapSprint,
  TEKS_SPRINT_SEKALI_MAIN,
  TEKS_SPRINT_TANPA_VOTING,
  TEKS_SPRINT_TERKUNCI,
  urutkanSprint,
  validasiPesan,
  type DataMeja,
  type OpsiMeja,
  type PercobaanSprint,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

const JAM = 60 * 60_000;
const HARI = 24 * JAM;
/** Senin 23 Nov 2026 pukul 00.00 WIB = Minggu 22 Nov 2026 pukul 17.00 UTC. */
const SENIN = Date.UTC(2026, 10, 22, 17, 0, 0);

describe('awalMingguWib', () => {
  it('minggu mulai Senin 00.00 WIB (UTC+7)', () => {
    expect(new Date(SENIN).toISOString()).toBe('2026-11-22T17:00:00.000Z');
    expect(awalMingguWib(SENIN)).toBe(SENIN);
    // Minggu 23.59 WIB masih minggu lalu; Senin 00.00 WIB sudah minggu baru.
    expect(awalMingguWib(SENIN - 60_000)).toBe(SENIN - 7 * HARI);
    expect(awalMingguWib(SENIN - 1)).toBe(SENIN - 7 * HARI);
    // Sepanjang minggu (sampai Minggu 23.59.59 WIB berikutnya) awalnya sama.
    for (const t of [SENIN + 1, SENIN + 3 * HARI + 5 * JAM, SENIN + 7 * HARI - 1]) expect(awalMingguWib(t)).toBe(SENIN);
    expect(awalMingguWib(SENIN + 7 * HARI)).toBe(SENIN + 7 * HARI);
    // Senin 06.59 WIB = Minggu 23.59 UTC: sudah minggu baru menurut WIB.
    expect(awalMingguWib(Date.UTC(2026, 10, 22, 23, 59))).toBe(SENIN);
  });

  it('jauh sebelum dan sesudah 1970 tetap Senin', () => {
    for (const t of [0, -5 * HARI, Date.UTC(1999, 0, 1), Date.UTC(2040, 5, 15, 12)]) {
      const a = awalMingguWib(t);
      expect(a).toBeLessThanOrEqual(t);
      expect(t - a).toBeLessThan(7 * HARI);
      const wib = new Date(a + 7 * JAM);
      expect([wib.getUTCDay(), wib.getUTCHours(), wib.getUTCMinutes()]).toEqual([1, 0, 0]);
    }
  });
});

/** Riwayat putaran buatan (cukup untuk hasilPutaranSprint): skor = skor akumulasi sesudah putaran itu. */
function riwayatDengan(putaran: { pementung: number | null; kepentung: number[]; skor: number[] }[]): HasilPutaran[] {
  return putaran.map((p, i) => ({ nomor: i + 1, pementung: p.pementung, kepentung: p.kepentung, skorAkumulasi: p.skor }) as unknown as HasilPutaran);
}

describe('hasil per putaran sprint', () => {
  const tiga = riwayatDengan([
    { pementung: 2, kepentung: [0, 1], skor: [-50, -20, 120, 0] },
    { pementung: null, kepentung: [], skor: [-30, 10, 100, 40] },
    { pementung: 0, kepentung: [2], skor: [150, 10, -50, 40] },
  ]);

  it('skor putaran = selisih skor akumulasi; menang kalau skor putarannya ≥ semua warga kedai', () => {
    // Putaran 1: skor putaran [-50, -20, 120, 0].
    expect(hasilPutaranSprint(tiga, 0, 0)).toEqual({ putaran: 1, menang: false, skor: -50, mentung: 0, kepentung: 1 });
    expect(hasilPutaranSprint(tiga, 0, 2)).toEqual({ putaran: 1, menang: true, skor: 120, mentung: 1, kepentung: 0 });
    // Putaran 2: skor putaran [20, 30, -20, 40]: kursi 3 menang walau skor totalnya bukan yang teratas.
    expect(hasilPutaranSprint(tiga, 1, 3)).toEqual({ putaran: 2, menang: true, skor: 40, mentung: 0, kepentung: 0 });
    expect(hasilPutaranSprint(tiga, 1, 2)).toEqual({ putaran: 2, menang: false, skor: -20, mentung: 0, kepentung: 0 });
    // Putaran 3: skor putaran [180, 0, -150, 0].
    expect(hasilPutaranSprint(tiga, 2, 0)).toEqual({ putaran: 3, menang: true, skor: 180, mentung: 1, kepentung: 0 });
    expect(hasilPutaranSprint(tiga, 2, 2)).toMatchObject({ menang: false, skor: -150, kepentung: 1 });
  });

  it('skor putaran sama dengan warga kedai teratas = menang (seri dihitung menang)', () => {
    const r = riwayatDengan([{ pementung: null, kepentung: [], skor: [30, 30, -10, 30, 0, 5] }]);
    expect(hasilPutaranSprint(r, 0, 0).menang).toBe(true);
    expect(hasilPutaranSprint(r, 0, 1).menang).toBe(true);
    expect(hasilPutaranSprint(r, 0, 3).menang).toBe(true);
    expect(hasilPutaranSprint(r, 0, 5).menang).toBe(false);
  });

  it('hasilSprint: semua putaran yang sudah selesai', () => {
    expect(hasilSprint({ riwayat: tiga }, 0).map((h) => [h.putaran, h.skor])).toEqual([
      [1, -50],
      [2, 20],
      [3, 180],
    ]);
    expect(hasilSprint({ riwayat: [] }, 0)).toEqual([]);
  });
});

describe('papan sprint', () => {
  const p = (nama: string, waktu: number, menang: boolean, skor: number, mentung = 0, kepentung = 0): PercobaanSprint => ({
    nama,
    waktu,
    menang,
    skor,
    mentung,
    kepentung,
  });

  it('dijumlah per nama tanpa beda huruf besar/kecil, ejaan terakhir yang tampil', () => {
    const r = rekapSprint([p('budi', 1, true, 100, 1, 0), p('Ani', 2, false, 300, 2, 1), p('BUDI', 3, false, -50, 0, 2), p('Budi', 4, true, 20)]);
    expect(r).toEqual([
      { nama: 'Budi', menang: 2, mentung: 1, kepentung: 2, skor: 70, piala: 0 },
      { nama: 'Ani', menang: 0, mentung: 2, kepentung: 1, skor: 300, piala: 0 },
    ]);
  });

  it('urutan bawaan: menang, skor, mentung, kepentung tersedikit, nama', () => {
    const b = (nama: string, menang: number, skor: number, mentung: number, kepentung: number) => ({ nama, menang, skor, mentung, kepentung, piala: 0 });
    const baris = [b('Eko', 1, 50, 1, 1), b('Ani', 1, 50, 1, 1), b('Cici', 1, 50, 1, 0), b('Dodi', 1, 50, 2, 3), b('Budi', 1, 80, 0, 9), b('Fajar', 2, -500, 0, 0)];
    expect(urutkanSprint(baris).map((x) => x.nama)).toEqual(['Fajar', 'Budi', 'Dodi', 'Cici', 'Ani', 'Eko']);
    // Ketuk judul kolom: kolom itu didahulukan, kepentung dari yang tersedikit.
    expect(urutkanSprint(baris, 'skor').map((x) => x.nama)).toEqual(['Budi', 'Dodi', 'Cici', 'Ani', 'Eko', 'Fajar']);
    expect(urutkanSprint(baris, 'mentung')[0].nama).toBe('Dodi');
    expect(urutkanSprint(baris, 'kepentung').map((x) => x.nama)).toEqual(['Fajar', 'Cici', 'Ani', 'Eko', 'Dodi', 'Budi']);
    // Kolom yang tidak dikenal = urutan bawaan; masukan tidak diubah.
    expect(urutkanSprint(baris, 'ngawur' as never).map((x) => x.nama)).toEqual(['Fajar', 'Budi', 'Dodi', 'Cici', 'Ani', 'Eko']);
    expect(baris[0].nama).toBe('Eko');
  });

  it('juara mingguan: baris teratas tiap minggu yang sudah lewat; minggu berjalan belum', () => {
    const lalu2 = SENIN - 14 * HARI;
    const lalu = SENIN - 7 * HARI;
    const xs = [
      p('Ani', lalu2 + HARI, true, 10),
      p('Budi', lalu2 + 2 * HARI, true, 50),
      // Minggu 23.59 WIB: masih minggu lalu (kalau terhitung minggu berjalan, Cici juara minggu lalu).
      p('budi', SENIN - 60_000, true, 600),
      p('Cici', lalu + HARI, true, 500),
      p('Ani', lalu + 2 * HARI, false, 900),
      // Senin 00.00 WIB: minggu berjalan, belum ada juaranya.
      p('Ani', SENIN, true, 1000),
      p('Ani', SENIN + HARI, true, 1000),
    ];
    const juara = juaraMingguan(xs, SENIN + 2 * HARI);
    expect(juara).toEqual([
      { mulai: lalu2, kunci: 'budi', nama: 'Budi' },
      { mulai: lalu, kunci: 'budi', nama: 'budi' },
    ]);
    expect([...pialaSprint(juara)]).toEqual([['budi', 2]]);
    // Seminggu kemudian Ani juara minggu itu juga.
    expect(juaraMingguan(xs, SENIN + 7 * HARI).at(-1)).toEqual({ mulai: SENIN, kunci: 'ani', nama: 'Ani' });
    // Minggu tanpa percobaan tidak punya juara.
    expect(juaraMingguan([], SENIN)).toEqual([]);
    // Piala ikut di baris papan.
    expect(rekapSprint(xs, undefined, pialaSprint(juara)).find((b) => b.nama.toLowerCase() === 'budi')!.piala).toBe(2);
  });
});

/** Sumber acak 0: Fisher–Yates memutar kursi, pemain (kursi 0 di awal) pindah ke kursi terakhir. */
const nol = () => 0;

function mejaSprint(extra: Partial<OpsiMeja> = {}, nama = 'Budi') {
  const ctx = siapkan(extra);
  const meja = Meja.buatSprint(ctx.opsi, 'p1', nama);
  return { ...ctx, meja };
}

type Ctx = ReturnType<typeof mejaSprint>;

/** Mainkan satu putaran sampai hasil putaran (pemain pakai strategi normal, warga kedai lewat jam). */
function mainkanPutaran({ meja, surat, jam }: Pick<Ctx, 'meja' | 'surat' | 'jam'>, rng: Rng, pemainId = 'p1'): void {
  for (let i = 0; i < 20_000; i++) {
    const st = meja.data.game?.status;
    if (st !== 'putaranBerjalan' && st !== 'susunAkhir') return;
    if (aksiManusia(meja, surat, pemainId, rng)) continue;
    if (!jam.langkah()) throw new Error('macet');
  }
  throw new Error('putaran tidak selesai');
}

describe('meja sprint', () => {
  it('pemain + lima warga kedai (Suhu, gaya persona), 6 pemain 2 deck 9 kartu, tanpa batas putaran, langsung main', () => {
    const { meja, surat } = mejaSprint();
    const d = meja.data;
    expect(d.kursi.map((k) => [k.jenis, k.nama, k.level])).toEqual([
      ['manusia', 'Budi', 'suhu'],
      ['bot', 'Kipas Dua', 'suhu'],
      ['bot', 'Cak Kopag', 'suhu'],
      ['bot', 'Mbak Teras', 'suhu'],
      ['bot', 'Mas Sampul', 'suhu'],
      ['bot', 'Si Rak', 'suhu'],
    ]);
    expect(NAMA_LAWAN_SPRINT).toEqual(['Kipas Dua', 'Cak Kopag', 'Mbak Teras', 'Mas Sampul', 'Si Rak']);
    expect(d.kursi.slice(1).map((k) => gayaKursi(k))).toEqual(['kilat', 'sabarLondo', expect.any(String), expect.any(String), expect.any(String)]);
    expect(d.kursi.slice(1).every((k) => gayaKursi(k) !== 'standar')).toBe(true);
    expect(d.pengaturan).toEqual(PENGATURAN_SPRINT);
    expect(d.pengaturan).toMatchObject({ jumlahPemain: 6, batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    expect(d.pengaturan.modeKaldu).toBeUndefined();
    expect(d.sprint).toEqual({ mulaiPada: 1_000_000, kursi: 0, tercatat: true, putaranTercatat: 0 });
    expect(meja.sprint).toBe(true);
    expect(meja.status).toBe('main');
    const g = d.game!;
    expect(g.konfigurasi).toMatchObject({ jumlahPemain: 6, batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    expect(g.konfigurasi.modeKaldu).toBeUndefined();
    // 6 pemain = 2 deck, 9 kartu per orang.
    expect(g.putaran!.tangan.map((t) => t.length)).toEqual([9, 9, 9, 9, 9, 9]);
    expect(g.putaran!.deck.length + g.putaran!.tangan.flat().length + g.putaran!.buangan.length + 1).toBeGreaterThan(52);
    // 'masuk' dulu, baru info meja dan view.
    const jenis = surat.semua('p1').map((x) => x.t);
    expect(jenis[0]).toBe('masuk');
    expect(jenis).toContain('view');
    const info = surat.info('p1');
    expect(info.sprint).toBe(true);
    expect(info.menungguJoker).toEqual([0]);
    expect(info.batasWaktu).toBeNull();
    expect(info.pengaturan.publik).toBe(false);
    expect(surat.errors('p1')).toEqual([]);
  });

  it('urutan duduk diacak (#62): pemain di kursi barunya, kursi pertama ngocok', () => {
    const { meja, surat } = mejaSprint({ acakDuduk: nol });
    const d = meja.data;
    // [0..5] dengan acak 0 → [1,2,3,4,5,0].
    expect(d.kursi.map((k) => k.nama)).toEqual(['Kipas Dua', 'Cak Kopag', 'Mbak Teras', 'Mas Sampul', 'Si Rak', 'Budi']);
    expect(d.sprint!.kursi).toBe(5);
    expect(d.host).toBe(5);
    expect(surat.terakhir('p1', 'masuk')).toEqual({ t: 'masuk', kode: 'ABCDE', token: 'p1', kursi: 5 });
    expect(surat.semua('p1')[0].t).toBe('masuk');
    expect(surat.info('p1').kursiSaya).toBe(5);
    expect(d.game!.putaran!.pengocok).toBe(0);
    expect(d.game!.pemain.map((p) => p.nama)).toEqual(d.kursi.map((k) => k.nama));
  });

  it('nama pemain sama dengan lawan sprint: warga kedai itu diganti nama berikutnya', () => {
    const { meja } = mejaSprint({}, 'cak kopag');
    expect(meja.data.kursi.map((k) => k.nama)).toEqual(['cak kopag', 'Kipas Dua', 'Mbak Teras', 'Mas Sampul', 'Si Rak', 'Pak Seng']);
  });

  it('pengaturan dikunci kecuali tempo; tanpa aturKursi, voting, Mulai, maupun Main lagi', () => {
    const { meja, surat } = mejaSprint();
    meja.terima('p1', { t: 'pengaturan', pengaturan: { tempoBot: 'santai' } });
    expect(meja.data.pengaturan.tempoBot).toBe('santai');
    expect(surat.errors('p1')).toEqual([]);
    for (const pengaturan of [{ batasPutaran: 10 }, { detikGiliran: 30 }, { tempoBot: 'normal' as const, levelBot: 'mudah' as const }, { publik: true }]) {
      meja.terima('p1', { t: 'pengaturan', pengaturan });
    }
    meja.terima('p1', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'mudah' });
    meja.terima('p1', { t: 'akhiri', setuju: true });
    meja.terima('p1', { t: 'putaranTerakhir', setuju: true });
    meja.terima('p1', { t: 'mainLagi' });
    meja.terima('p1', { t: 'mulai' });
    expect(surat.errors('p1')).toEqual([
      TEKS_SPRINT_TERKUNCI,
      TEKS_SPRINT_TERKUNCI,
      TEKS_SPRINT_TERKUNCI,
      TEKS_SPRINT_TERKUNCI,
      TEKS_SPRINT_TERKUNCI,
      TEKS_SPRINT_TANPA_VOTING,
      TEKS_SPRINT_TANPA_VOTING,
      TEKS_SPRINT_SEKALI_MAIN,
      'Permainan sudah berjalan.',
    ]);
    expect(meja.data.pengaturan).toEqual({ ...PENGATURAN_SPRINT, tempoBot: 'santai' });
    expect(meja.data.kursi[1].level).toBe('suhu');
    expect(meja.data.setujuAkhiri).toEqual([]);
  });

  it('orang lain tidak bisa duduk; boleh ditonton', () => {
    const { meja, surat } = mejaSprint();
    expect(() => meja.masuk('p2', 'Ani')).toThrow('sudah mulai');
    expect(meja.bisaDitonton).toBe(true);
    meja.tonton('penonton', 'Cici');
    expect(surat.terakhir('penonton', 'tontonan')).toBeDefined();
  });

  it('tanpa batas putaran: lewat 5 putaran tetap jalan, tanpa kaldu; tiap putaran dikabarkan dan dicatat sekali', () => {
    const galat: unknown[] = [];
    let kabar = 0;
    const ctx = mejaSprint({ acakDuduk: nol, saatGalat: (_k, e) => galat.push(e), saatPutaranSprint: () => kabar++ });
    const { meja, surat, jam } = ctx;
    siapSemua(meja);
    const rng = new Rng(7);
    const waktuSelesai: number[] = [];
    for (let putaran = 1; putaran <= 7; putaran++) {
      mainkanPutaran(ctx, rng);
      expect(meja.data.game!.status).toBe('putaranSelesai');
      expect(meja.data.game!.riwayat).toHaveLength(putaran);
      expect(kabar).toBe(putaran);
      waktuSelesai.push(jam.sekarang());
      // Kabar putaran: satu catatan baru, waktunya saat putaran itu selesai.
      const c = catatanSprint(meja.data, 9_999_999_999);
      expect(c).toHaveLength(1);
      expect(c[0]).toEqual({
        ...hasilPutaranSprint(meja.data.game!.riwayat, putaran - 1, 5),
        kode: 'ABCDE',
        mulaiPada: 1_000_000,
        nama: 'Budi',
        waktu: waktuSelesai.at(-1),
      });
      meja.tandaiSprintTercatat(putaran);
      expect(catatanSprint(meja.data, 0)).toEqual([]);
      jam.maju(10_000);
      // Antar putaran: tanpa voting akhiri, pemain sendiri yang memulai putaran berikutnya.
      meja.terima('p1', { t: 'putaranBerikut' });
      siapSemua(meja);
      expect(meja.status).toBe('main');
    }
    expect(galat).toEqual([]);
    expect(surat.errors('p1')).toEqual([]);
    const g = meja.data.game!;
    expect(g.riwayat.some((h) => h.kaldu)).toBe(false);
    expect(g.putaran!.kaldu).toBeUndefined();
    expect(g.alasanSelesai).toBeNull();
    expect(meja.data.sprint!.waktuPutaran).toEqual(waktuSelesai);
    expect(meja.data.sprint!.putaranTercatat).toBe(7);
    // Tanda tercatat tidak pernah mundur.
    meja.tandaiSprintTercatat(3);
    expect(meja.data.sprint!.putaranTercatat).toBe(7);
    // Semua putaran dari awal (tanpa tanda tercatat) = hasilSprint.
    const { putaranTercatat: _, tercatat: __, ...tanpaTanda } = meja.data.sprint!;
    const semua = catatanSprint({ ...meja.data, sprint: tanpaTanda }, 0);
    expect(semua.map(({ putaran, menang, skor, mentung, kepentung }) => ({ putaran, menang, skor, mentung, kepentung }))).toEqual(hasilSprint(g, 5));
  }, 60_000);

  it('meja yang dipulihkan (restart) melanjutkan dari putaran yang belum tercatat, tanpa catatan kembar', () => {
    const ctx = mejaSprint();
    siapSemua(ctx.meja);
    const rng = new Rng(11);
    mainkanPutaran(ctx, rng);
    ctx.meja.tandaiSprintTercatat(1);
    ctx.meja.terima('p1', { t: 'putaranBerikut' });
    siapSemua(ctx.meja);
    mainkanPutaran(ctx, rng);
    // Server mati sebelum putaran 2 sempat dicatat: dipulihkan dari simpanan.
    const simpanan = JSON.parse(JSON.stringify(ctx.meja.data)) as DataMeja;
    ctx.meja.hentikan();
    let kabar = 0;
    const baru = siapkan({ saatPutaranSprint: () => kabar++ });
    baru.jam.waktu = ctx.jam.waktu;
    const meja = new Meja(baru.opsi, dataMejaDipulihkan(simpanan));
    expect(catatanSprint(meja.data, 0).map((c) => c.putaran)).toEqual([2]);
    meja.tandaiSprintTercatat(2);
    expect(catatanSprint(meja.data, 0)).toEqual([]);
    // Pemain kembali dan main lagi: putaran 3 dicatat seperti biasa.
    meja.terhubung('p1');
    meja.terima('p1', { t: 'putaranBerikut' });
    siapSemua(meja);
    mainkanPutaran({ meja, surat: baru.surat, jam: baru.jam }, rng);
    expect(kabar).toBe(1);
    expect(catatanSprint(meja.data, 0).map((c) => c.putaran)).toEqual([3]);
    expect(meja.data.sprint!.waktuPutaran).toHaveLength(3);
    meja.hentikan();
  });

  it('Keluar di tengah putaran: hanya putaran yang sudah selesai; putaran yang diteruskan warga kedai tidak', () => {
    const ctx = mejaSprint();
    const { meja } = ctx;
    siapSemua(meja);
    const rng = new Rng(3);
    mainkanPutaran(ctx, rng);
    meja.terima('p1', { t: 'putaranBerikut' });
    siapSemua(meja);
    meja.terima('p1', { t: 'keluar' });
    expect(meja.adaKursiManusia).toBe(false);
    expect(meja.data.sprint!.putaranSampai).toBe(1);
    const c = catatanSprint(meja.data, 2_000_000);
    expect(c.map((x) => x.putaran)).toEqual([1]);
    expect(c[0]).toMatchObject({ nama: 'Budi', kode: 'ABCDE' });
    // Kalau warga kedai sempat menyelesaikan putaran 2 untuknya: tetap tidak dihitung.
    const d = meja.data;
    d.game!.riwayat.push(d.game!.riwayat[0]);
    expect(catatanSprint(d, 3_000_000).map((x) => x.putaran)).toEqual([1]);
  });

  it('Keluar di susun akhir: putaran itu belum selesai, jadi tidak dihitung', () => {
    const { meja, surat, jam } = mejaSprint();
    siapSemua(meja);
    const rng = new Rng(9);
    for (let i = 0; i < 20_000 && meja.data.game!.status === 'putaranBerjalan'; i++) {
      if (aksiManusia(meja, surat, 'p1', rng)) continue;
      if (!jam.langkah()) break;
    }
    expect(meja.data.game!.status).toBe('susunAkhir');
    meja.terima('p1', { t: 'keluar' });
    expect(meja.data.kursi[0].keluarSesudahPutaran).toBe(1);
    expect(meja.data.sprint!.putaranSampai).toBe(0);
    const d = meja.data;
    d.game!.riwayat.push({ nomor: 1, pementung: null, kepentung: [], skorAkumulasi: [9, 0, 0, 0, 0, 0] } as unknown as HasilPutaran);
    expect(catatanSprint(d, 0)).toEqual([]);
  });

  it('Keluar sebelum putaran pertama selesai: tidak ada catatan', () => {
    const { meja, surat, jam } = mejaSprint();
    expect(catatanSprint(meja.data, 1_500_000)).toEqual([]);
    siapSemua(meja);
    const rng = new Rng(5);
    for (let i = 0; i < 6 && meja.data.game!.status === 'putaranBerjalan'; i++) {
      if (aksiManusia(meja, surat, 'p1', rng)) continue;
      if (!jam.langkah()) break;
    }
    meja.terima('p1', { t: 'keluar' });
    expect(meja.adaKursiManusia).toBe(false);
    expect(meja.data.game!.riwayat).toHaveLength(0);
    expect(catatanSprint(meja.data, 2_000_000)).toEqual([]);
  });

  it('simpanan meja sprint 0.8.0 yang sudah tercatat sebagai percobaan: putarannya tidak dicatat lagi', () => {
    const ctx = mejaSprint();
    siapSemua(ctx.meja);
    mainkanPutaran(ctx, new Rng(2));
    const d = ctx.meja.data;
    expect(catatanSprint(d, 0)).toHaveLength(1);
    expect(catatanSprint({ ...d, sprint: { mulaiPada: d.sprint!.mulaiPada, kursi: d.sprint!.kursi, tercatat: true } }, 0)).toEqual([]);
    // Tanpa waktu putaran (simpanan 0.8.0 yang belum tercatat): pakai waktu cadangan.
    expect(catatanSprint({ ...d, sprint: { mulaiPada: d.sprint!.mulaiPada, kursi: d.sprint!.kursi } }, 42)[0].waktu).toBe(42);
  });

  it('meja sprint baru menulis `tercatat` bersama putaranTercatat (server lama yang di-rollback tidak mencatat ulang)', () => {
    const ctx = mejaSprint();
    expect(ctx.meja.data.sprint).toMatchObject({ tercatat: true, putaranTercatat: 0 });
    expect(catatanSprintTerakhir(ctx.meja.data)).toBeNull();
    siapSemua(ctx.meja);
    mainkanPutaran(ctx, new Rng(2));
    const d = ctx.meja.data;
    // Yang dibaca hanya putaranTercatat: `tercatat` tidak menahan putaran yang belum tercatat.
    expect(catatanSprint(d, 0).map((c) => c.putaran)).toEqual([1]);
    expect(catatanSprintTerakhir(d)).toBeNull();
    ctx.meja.tandaiSprintTercatat(1);
    expect(ctx.meja.data.sprint).toMatchObject({ tercatat: true, putaranTercatat: 1 });
    expect(catatanSprintTerakhir(ctx.meja.data)).toEqual(catatanSprint(d, 0)[0]);
    // Simpanan 0.8.0 yang belum tercatat lalu dicatat versi ini: ikut ditandai `tercatat`.
    const lama = { ...d, sprint: { mulaiPada: d.sprint!.mulaiPada, kursi: d.sprint!.kursi } };
    const { opsi } = siapkan();
    const pulih = new Meja(opsi, dataMejaDipulihkan(lama));
    pulih.tandaiSprintTercatat(1);
    expect(pulih.data.sprint).toMatchObject({ tercatat: true, putaranTercatat: 1 });
    pulih.hentikan();
  });

  it('state meja sprint dirampingkan tiap putaran baru: log, peristiwa, dan riwayat lama tidak menumpuk', () => {
    const ctx = mejaSprint({ acakDuduk: nol });
    const { meja, surat } = ctx;
    siapSemua(meja);
    const rng = new Rng(21);
    const total = PUTARAN_RINCI_SPRINT + 4;
    for (let putaran = 1; putaran <= total; putaran++) {
      mainkanPutaran(ctx, rng);
      meja.tandaiSprintTercatat(putaran);
      meja.terima('p1', { t: 'putaranBerikut' });
      siapSemua(meja);
      const g = meja.data.game!;
      expect(g.putaran!.nomor).toBe(putaran + 1);
      expect(jumlahPutaranSelesai(g)).toBe(putaran);
      // Riwayat hanya PUTARAN_RINCI_SPRINT putaran terakhir; yang lebih lama dihitung di riwayatDibuang.
      expect(g.riwayat).toHaveLength(Math.min(putaran, PUTARAN_RINCI_SPRINT));
      expect(g.riwayat.map((h) => h.nomor)).toEqual(Array.from({ length: g.riwayat.length }, (_, k) => putaran - g.riwayat.length + k + 1));
      expect(g.riwayatDibuang ?? 0).toBe(Math.max(0, putaran - PUTARAN_RINCI_SPRINT));
      expect(meja.data.sprint!.waktuPutaran).toHaveLength(g.riwayat.length);
      expect(surat.view('p1').riwayatDibuang ?? 0).toBe(g.riwayatDibuang ?? 0);
      // Log hanya putaran yang sedang jalan dan sebelumnya; peristiwa paling banyak yang dikirim di view.
      expect(new Set(g.log.map((e) => e.putaran)).size).toBeLessThanOrEqual(2);
      expect(g.log.every((e) => e.putaran >= putaran)).toBe(true);
      expect(g.peristiwa.length).toBeLessThanOrEqual(BATAS_PERISTIWA_VIEW);
      expect(periksaInvarian(g)).toEqual([]);
      // Skor total tetap dari awal: sama dengan skor akumulasi putaran terakhir.
      expect(g.riwayat.at(-1)!.skorAkumulasi).toEqual(g.skor);
    }
    // Putaran berikutnya yang selesai dicatat dengan nomor yang benar (lanjut dari riwayat yang dibuang).
    mainkanPutaran(ctx, rng);
    const c = catatanSprint(meja.data, 0);
    expect(c.map((x) => x.putaran)).toEqual([total + 1]);
    expect(catatanSprintTerakhir(meja.data)!.putaran).toBe(total);
    const g = meja.data.game!;
    const k = meja.data.sprint!.kursi;
    expect(c[0].skor).toBe(g.riwayat.at(-1)!.skorAkumulasi[k] - g.riwayat.at(-2)!.skorAkumulasi[k]);
    meja.hentikan();
  });

  it('putaran yang belum tercatat server tidak pernah dibuang dari riwayat (pencatatan tertinggal)', () => {
    const ctx = mejaSprint({ acakDuduk: nol });
    const { meja } = ctx;
    siapSemua(meja);
    const rng = new Rng(22);
    const total = PUTARAN_RINCI_SPRINT + 3;
    for (let putaran = 1; putaran <= total; putaran++) {
      mainkanPutaran(ctx, rng);
      // Server hanya sempat mencatat 2 putaran pertama (misalnya database galat sesudahnya).
      if (putaran <= 2) meja.tandaiSprintTercatat(putaran);
      meja.terima('p1', { t: 'putaranBerikut' });
      siapSemua(meja);
    }
    const g = meja.data.game!;
    // Putaran 1 boleh dibuang (putaran 2 sudah tercatat; putaran 2 ditahan sebagai "sebelumnya" putaran 3).
    expect(g.riwayatDibuang).toBe(1);
    expect(g.riwayat).toHaveLength(total - 1);
    // Di luar PUTARAN_RINCI_SPRINT terakhir yang ditahan, kartunya saja yang dibuang.
    expect(g.riwayat[0].rincian.every((r) => !r.kartuJadi.length && !r.tangan.length)).toBe(true);
    const c = catatanSprint(meja.data, 0);
    expect(c.map((x) => x.putaran)).toEqual(Array.from({ length: total - 2 }, (_, k) => k + 3));
    meja.hentikan();
  });

  it('rampingkanGameSprint tidak mengubah state masukan', () => {
    const ctx = mejaSprint();
    siapSemua(ctx.meja);
    const rng = new Rng(4);
    for (let i = 0; i < 2; i++) {
      mainkanPutaran(ctx, rng);
      ctx.meja.terima('p1', { t: 'putaranBerikut' });
      siapSemua(ctx.meja);
    }
    const g = ctx.meja.data.game!;
    const salinan = JSON.parse(JSON.stringify(g));
    // Belum ada yang tercatat (0): tidak ada yang dibuang, hanya kartu di riwayat lama.
    const r = rampingkanGameSprint({ ...g, riwayat: [...g.riwayat, ...Array.from({ length: PUTARAN_RINCI_SPRINT }, () => g.riwayat[0])] }, 0);
    expect(g).toEqual(salinan);
    expect(r.riwayat).toHaveLength(2 + PUTARAN_RINCI_SPRINT);
    expect('riwayatDibuang' in r).toBe(false);
    expect(r.riwayat[0].rincian.every((x) => !x.tangan.length && !x.kartuJadi.length)).toBe(true);
    expect(r.riwayat[0].skorAkumulasi).toEqual(g.riwayat[0].skorAkumulasi);
    expect(r.riwayat[0].rincian.map((x) => x.total)).toEqual(g.riwayat[0].rincian.map((x) => x.total));
    // Yang sudah ramping tidak disalin ulang.
    const lagi = rampingkanGameSprint(r, 0);
    expect(lagi.riwayat[0]).toBe(r.riwayat[0]);
    // Semua tercatat: tinggal PUTARAN_RINCI_SPRINT terakhir, masukannya tetap utuh.
    const salinanR = JSON.parse(JSON.stringify(r));
    const buang = rampingkanGameSprint(r, 2 + PUTARAN_RINCI_SPRINT);
    expect(r).toEqual(salinanR);
    expect(buang.riwayat).toHaveLength(PUTARAN_RINCI_SPRINT);
    expect(buang.riwayatDibuang).toBe(2);
    expect(jumlahPutaranSelesai(buang)).toBe(2 + PUTARAN_RINCI_SPRINT);
    // Tidak pernah mundur.
    expect(rampingkanGameSprint(buang, 0).riwayatDibuang).toBe(2);
    ctx.meja.hentikan();
  });

  it('bukan meja sprint atau belum ada permainan: tidak ada catatan; info meja biasa tanpa `sprint`', () => {
    const { opsi, surat } = siapkan();
    const biasa = Meja.buat(opsi, 'h', 'Ani');
    expect(catatanSprint(biasa.data, 1)).toEqual([]);
    expect(biasa.sprint).toBe(false);
    expect('sprint' in surat.info('h')).toBe(false);
    expect('sprint' in biasa.data).toBe(false);
  });

  it('validasi pesan sprint', () => {
    expect(validasiPesan({ t: 'sprint', nama: 'Budi' })).toEqual({ t: 'sprint', nama: 'Budi' });
    expect(validasiPesan({ t: 'sprint', nama: 'Budi', lain: 1 })).toEqual({ t: 'sprint', nama: 'Budi' });
    for (const x of [{ t: 'sprint' }, { t: 'sprint', nama: 5 }, { t: 'sprint', nama: 'x'.repeat(101) }]) expect(validasiPesan(x)).toBeNull();
    // Token sprint (27 Nov 2026): base64url 16–64 huruf.
    const token = 'Ab-_' + 'x'.repeat(28);
    expect(validasiPesan({ t: 'sprint', nama: 'Budi', lanjut: token })).toEqual({ t: 'sprint', nama: 'Budi', lanjut: token });
    expect(validasiPesan({ t: 'sprint', nama: 'Budi', ganti: token })).toEqual({ t: 'sprint', nama: 'Budi', ganti: token });
    for (const t of ['pendek', 'x'.repeat(65), 'a b'.repeat(8), 5, null, '+'.repeat(20)]) {
      expect(validasiPesan({ t: 'sprint', nama: 'Budi', lanjut: t })).toBeNull();
      expect(validasiPesan({ t: 'sprint', nama: 'Budi', ganti: t })).toBeNull();
    }
  });
});

// Sprint bisa dilanjut (keputusan pemilik 27 Nov 2026): satu permainan sepanjang minggu WIB. Meja hanya
// menyediakan bahannya (ringkasan, nama kursi, minggu); simpan-muat diatur server.
describe('sprint yang dilanjut', () => {
  it('ringkasan Lanjut sprint, minggu sprint, token kursi pemain', () => {
    const ctx = mejaSprint({ acakDuduk: nol });
    const { meja } = ctx;
    siapSemua(meja);
    expect(meja.pemainSprint).toBe('p1');
    expect(mingguSprint(meja.data)).toBe(awalMingguWib(1_000_000));
    expect(ringkasanLanjutSprint(meja.data)).toEqual({ putaran: 1, skor: 0 });
    mainkanPutaran(ctx, new Rng(3));
    const g = meja.data.game!;
    // Hasil putaran masih tampil: nomornya putaran yang baru selesai (sama dengan bar atas meja).
    expect(ringkasanLanjutSprint(meja.data)).toEqual({ putaran: 1, skor: g.skor[5] });
    meja.terima('p1', { t: 'putaranBerikut' });
    expect(ringkasanLanjutSprint(meja.data)).toEqual({ putaran: 2, skor: g.skor[5] });
    // Meja biasa dan meja sprint 0.10.0 yang pemainnya sudah Keluar: tidak ada yang bisa dilanjut.
    const { opsi } = siapkan();
    const biasa = Meja.buat(opsi, 'h', 'Ani');
    expect(ringkasanLanjutSprint(biasa.data)).toBeNull();
    expect(mingguSprint(biasa.data)).toBeNull();
    expect(biasa.pemainSprint).toBeNull();
    meja.tinggalkan('p1');
    expect(meja.pemainSprint).toBeNull();
    expect(ringkasanLanjutSprint(meja.data)).toBeNull();
    meja.hentikan();
  });

  it('nama kursi ikut nama sekarang, kecuali sama dengan warga kedai di meja (gayanya mengikuti nama)', () => {
    const { meja } = mejaSprint();
    meja.gantiNamaSprint('p1', '  Budi Baru  ');
    expect(meja.data.kursi[0].nama).toBe('Budi Baru');
    meja.gantiNamaSprint('p1', 'kipas dua');
    expect(meja.data.kursi[0].nama).toBe('Budi Baru');
    expect(meja.data.kursi[1].nama).toBe('Kipas Dua');
    // Token lain tidak bisa mengganti apa pun.
    meja.gantiNamaSprint('orang-lain', 'Maling');
    expect(meja.data.kursi.map((k) => k.nama)).not.toContain('Maling');
    meja.hentikan();
  });

  it('200 putaran: state, view, dan simpanan tetap kecil; dijeda lalu dimuat lagi di tengah putaran meneruskan permainan yang sama', () => {
    // Warga kedai level Mudah hanya supaya test cepat; yang diuji ukuran state, bukan strategi.
    const awal = mejaSprint({ acakDuduk: nol });
    const data = awal.meja.data;
    awal.meja.hentikan();
    data.kursi = data.kursi.map((k) => (k.jenis === 'bot' ? { ...k, level: 'mudah' } : k));
    let ctx = { ...awal, meja: new Meja(awal.opsi, data) };
    siapSemua(ctx.meja);
    const rng = new Rng(5);
    const total = 200;
    const galat: string[] = [];
    const ukuranData: number[] = [];
    const ukuranView: number[] = [];
    for (let putaran = 1; putaran <= total; putaran++) {
      if (putaran === 120) {
        // Dijeda di tengah putaran (Keluar/putus lalu dilepas dari memori), dimuat lagi dari simpanannya.
        for (let i = 0; i < 6; i++) if (!aksiManusia(ctx.meja, ctx.surat, 'p1', rng)) ctx.jam.langkah();
        const sebelum = ctx.meja.data;
        expect(sebelum.game!.status).toBe('putaranBerjalan');
        const simpanan = JSON.parse(JSON.stringify(dataMejaDipulihkan(sebelum))) as DataMeja;
        galat.push(...ctx.surat.errors('p1'));
        ctx.meja.hentikan();
        const baru = siapkan({ acakDuduk: nol });
        baru.jam.waktu = ctx.jam.waktu;
        const meja = new Meja(baru.opsi, simpanan);
        // Tanpa pemain terhubung permainannya diam.
        expect(baru.jam.langkah()).toBe(false);
        meja.gantiNamaSprint('p1', 'Budi');
        meja.masuk('p1', 'Budi');
        ctx = { ...baru, meja };
        const g = meja.data.game!;
        expect(jumlahPutaranSelesai(g)).toBe(putaran - 1);
        expect(g.riwayat.length).toBeLessThanOrEqual(PUTARAN_RINCI_SPRINT);
        expect(g.putaran!.nomor).toBe(putaran);
        expect(g.skor).toEqual(sebelum.game!.skor);
        expect(g.putaran!.tangan).toEqual(sebelum.game!.putaran!.tangan);
        expect(meja.data.sprint).toEqual(sebelum.sprint);
      }
      // Seperti mainkanPutaran, tapi membaca view terakhir (bukan salinan data meja tiap langkah) supaya cepat.
      for (let i = 0; ; i++) {
        const st = ctx.surat.view('p1').status;
        if (st !== 'putaranBerjalan' && st !== 'susunAkhir') break;
        if (i > 20_000) throw new Error('putaran tidak selesai');
        if (!aksiManusia(ctx.meja, ctx.surat, 'p1', rng) && !ctx.jam.langkah()) throw new Error('macet');
      }
      const c = catatanSprint(ctx.meja.data, 0);
      expect(c.map((x) => x.putaran)).toEqual([putaran]);
      ctx.meja.tandaiSprintTercatat(putaran);
      ctx.meja.terima('p1', { t: 'putaranBerikut' });
      siapSemua(ctx.meja);
      ukuranData.push(JSON.stringify(ctx.meja.data).length);
      ukuranView.push(JSON.stringify(ctx.surat.view('p1')).length);
      // Kotak surat dikosongkan tiap putaran (hanya info dan view terakhir), supaya pencariannya tidak melambat.
      galat.push(...ctx.surat.errors('p1'));
      ctx.surat.pesan.set('p1', [ctx.surat.terakhir('p1', 'meja')!, ctx.surat.terakhir('p1', 'view')!]);
    }
    const g = ctx.meja.data.game!;
    expect(jumlahPutaranSelesai(g)).toBe(total);
    expect(g.riwayat).toHaveLength(PUTARAN_RINCI_SPRINT);
    expect(periksaInvarian(g)).toEqual([]);
    expect(galat).toEqual([]);
    // Tidak tumbuh tiap putaran: sesudah riwayat penuh (PUTARAN_RINCI_SPRINT), ukurannya hanya naik-turun
    // menurut putaran yang sedang jalan (kartu di tangan, kartu jadi). Putaran 200 tidak lebih besar dari
    // yang terbesar di putaran 15–50, ditambah sedikit (angka skor yang makin panjang).
    const datar = (xs: number[]) => Math.max(...xs.slice(50)) - Math.max(...xs.slice(15, 50));
    expect(datar(ukuranData)).toBeLessThan(5_000);
    expect(datar(ukuranView)).toBeLessThan(5_000);
    expect(ukuranData[total - 1]).toBeLessThan(150_000);
    expect(ukuranView[total - 1]).toBeLessThan(150_000);
    console.log(
      `sprint 200 putaran: data ${ukuranData[total - 1]} B (maks 15-50: ${Math.max(...ukuranData.slice(15, 50))}, maks 50-200: ${Math.max(...ukuranData.slice(50))}), view ${ukuranView[total - 1]} B`,
    );
    ctx.meja.hentikan();
  }, 120_000);
});
