// Sprint (keputusan pemilik 25 Nov 2026): satu pemain lawan Kipas Dua, Cak Kopag, dan Mbak Teras (Suhu,
// dengan gaya personanya), 5 putaran, pengaturan dikunci. Aturan hitung (minggu WIB, hasil satu
// percobaan, papan, juara mingguan) di sprint.ts; meja sprint di meja.ts.

import { describe, expect, it } from 'vitest';
import { buatPermainan, Rng, type GameState, type HasilPutaran } from '@remi/engine';
import {
  awalMingguWib,
  catatanSprint,
  gayaKursi,
  hasilSprint,
  juaraMingguan,
  JUMLAH_PUTARAN_SPRINT,
  Meja,
  NAMA_LAWAN_SPRINT,
  PENGATURAN_SPRINT,
  pialaSprint,
  rekapSprint,
  TEKS_SPRINT_SEKALI_MAIN,
  TEKS_SPRINT_TANPA_VOTING,
  TEKS_SPRINT_TERKUNCI,
  urutkanSprint,
  validasiPesan,
  type CatatanSprint,
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

/** State permainan 4 pemain dengan riwayat putaran buatan (cukup untuk hasilSprint). */
function stateDengan(putaran: { pementung: number | null; kepentung: number[]; skor: number[] }[], selesai: boolean): GameState {
  const g = buatPermainan({ pemain: ['A', 'B', 'C', 'D'], seed: 1, konfigurasi: { duaDeckUntukEmpat: false, batasPutaran: 5, batasSkorAtas: null, batasSkorBawah: null } });
  g.riwayat = putaran.map(
    (p, i) => ({ nomor: i + 1, pementung: p.pementung, kepentung: p.kepentung, skorAkumulasi: p.skor }) as unknown as HasilPutaran,
  );
  g.skor = putaran.at(-1)?.skor ?? [0, 0, 0, 0];
  g.status = selesai ? 'selesai' : 'putaranSelesai';
  return g;
}

describe('hasilSprint', () => {
  const lima = [
    { pementung: 2, kepentung: [0, 1], skor: [-50, -20, 120, 0] },
    { pementung: null, kepentung: [], skor: [-30, 10, 100, 40] },
    { pementung: 0, kepentung: [2], skor: [150, 10, -50, 40] },
    { pementung: 0, kepentung: [1, 3], skor: [300, -100, -50, -10] },
    { pementung: 3, kepentung: [0], skor: [120, -100, -50, 200] },
  ];

  it('menghitung untuk kursi pemain (kursi bisa di mana saja sesudah diacak)', () => {
    const g = stateDengan(lima, true);
    expect(hasilSprint(g, 0)).toEqual({ menang: false, skor: 120, mentung: 2, kepentung: 2, putaran: 5, selesai: true });
    expect(hasilSprint(g, 3)).toEqual({ menang: true, skor: 200, mentung: 1, kepentung: 1, putaran: 5, selesai: true });
    expect(hasilSprint(g, 1)).toEqual({ menang: false, skor: -100, mentung: 0, kepentung: 2, putaran: 5, selesai: true });
    expect(hasilSprint(g, 2)).toEqual({ menang: false, skor: -50, mentung: 1, kepentung: 1, putaran: 5, selesai: true });
  });

  it('skor sama dengan warga kedai teratas = menang', () => {
    const g = stateDengan([...lima.slice(0, 4), { pementung: null, kepentung: [], skor: [200, -100, 200, 10] }], true);
    expect(hasilSprint(g, 0).menang).toBe(true);
    expect(hasilSprint(g, 2).menang).toBe(true);
    expect(hasilSprint(g, 3).menang).toBe(false);
  });

  it('ditinggal di tengah jalan: putaran yang sudah selesai saja, tidak pernah menang', () => {
    const g = stateDengan(lima.slice(0, 4), false);
    expect(hasilSprint(g, 0)).toEqual({ menang: false, skor: 300, mentung: 2, kepentung: 1, putaran: 4, selesai: false });
    const kosong = stateDengan([], false);
    expect(hasilSprint(kosong, 1)).toEqual({ menang: false, skor: 0, mentung: 0, kepentung: 0, putaran: 0, selesai: false });
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

describe('meja sprint', () => {
  it('pemain + Kipas Dua, Cak Kopag, Mbak Teras (Suhu, gaya persona), langsung main', () => {
    const { meja, surat } = mejaSprint();
    const d = meja.data;
    expect(d.kursi.map((k) => [k.jenis, k.nama, k.level])).toEqual([
      ['manusia', 'Budi', 'suhu'],
      ['bot', 'Kipas Dua', 'suhu'],
      ['bot', 'Cak Kopag', 'suhu'],
      ['bot', 'Mbak Teras', 'suhu'],
    ]);
    expect(d.kursi.slice(1).map((k) => gayaKursi(k))).toEqual(['kilat', 'sabarLondo', expect.any(String)]);
    expect(d.kursi.slice(1).every((k) => gayaKursi(k) !== 'standar')).toBe(true);
    expect(d.pengaturan).toEqual(PENGATURAN_SPRINT);
    expect(d.pengaturan.modeKaldu).toBeUndefined();
    expect(d.sprint).toEqual({ mulaiPada: 1_000_000, kursi: 0 });
    expect(meja.sprint).toBe(true);
    expect(meja.status).toBe('main');
    expect(d.game!.konfigurasi).toMatchObject({ duaDeckUntukEmpat: false, batasPutaran: 5, batasSkorAtas: null, batasSkorBawah: null });
    expect(d.game!.konfigurasi.modeKaldu).toBeUndefined();
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
    // [0,1,2,3] dengan acak 0 → [1,2,3,0].
    expect(d.kursi.map((k) => k.nama)).toEqual(['Kipas Dua', 'Cak Kopag', 'Mbak Teras', 'Budi']);
    expect(d.sprint!.kursi).toBe(3);
    expect(d.host).toBe(3);
    expect(surat.terakhir('p1', 'masuk')).toEqual({ t: 'masuk', kode: 'ABCDE', token: 'p1', kursi: 3 });
    expect(surat.semua('p1')[0].t).toBe('masuk');
    expect(surat.info('p1').kursiSaya).toBe(3);
    expect(d.game!.putaran!.pengocok).toBe(0);
    expect(d.game!.pemain.map((p) => p.nama)).toEqual(d.kursi.map((k) => k.nama));
  });

  it('nama pemain sama dengan lawan sprint: warga kedai itu diganti nama berikutnya', () => {
    const { meja } = mejaSprint({}, 'cak kopag');
    expect(meja.data.kursi.map((k) => k.nama)).toEqual(['cak kopag', 'Kipas Dua', 'Mbak Teras', 'Mas Sampul']);
    expect(NAMA_LAWAN_SPRINT).toEqual(['Kipas Dua', 'Cak Kopag', 'Mbak Teras']);
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

  it('main sampai 5 putaran selesai: tercatat sekali sebagai selesai', () => {
    const galat: unknown[] = [];
    const { meja, surat, jam } = mejaSprint({ acakDuduk: nol, saatGalat: (_k, e) => galat.push(e) });
    siapSemua(meja);
    const rng = new Rng(7);
    for (let putaran = 0; putaran < 10 && meja.status === 'main'; putaran++) {
      for (let i = 0; i < 5000; i++) {
        const st = meja.data.game?.status;
        if (st !== 'putaranBerjalan' && st !== 'susunAkhir') break;
        if (aksiManusia(meja, surat, 'p1', rng)) continue;
        if (!jam.langkah()) throw new Error('macet');
      }
      if (meja.status === 'main') {
        // Antar putaran: tanpa voting akhiri, pemain sendiri yang memulai putaran berikutnya.
        meja.terima('p1', { t: 'putaranBerikut' });
        siapSemua(meja);
      }
    }
    expect(galat).toEqual([]);
    expect(surat.errors('p1')).toEqual([]);
    expect(meja.status).toBe('selesai');
    const g = meja.data.game!;
    expect(g.riwayat.length).toBe(JUMLAH_PUTARAN_SPRINT);
    expect(g.alasanSelesai).toBe('batasPutaran');
    const c = catatanSprint(meja.data, 5_000_000) as CatatanSprint;
    const skorAkhir = g.riwayat.at(-1)!.skorAkumulasi;
    expect(c).toEqual({
      ...hasilSprint(g, 3),
      kode: 'ABCDE',
      mulaiPada: 1_000_000,
      nama: 'Budi',
      waktu: 5_000_000,
    });
    expect(c.selesai).toBe(true);
    expect(c.putaran).toBe(5);
    expect(c.skor).toBe(skorAkhir[3]);
    expect(c.menang).toBe(skorAkhir.every((s) => skorAkhir[3] >= s));
    meja.tandaiSprintTercatat();
    expect(meja.data.sprint!.tercatat).toBe(true);
    expect(catatanSprint(meja.data, 6_000_000)).toBeNull();
  });

  it('Keluar di tengah jalan: catatan ditinggal (tidak menang), putaran yang selesai saja', () => {
    const { meja, surat, jam } = mejaSprint();
    siapSemua(meja);
    const rng = new Rng(3);
    // Mainkan satu putaran penuh.
    for (let i = 0; i < 5000 && meja.data.game!.status !== 'putaranSelesai'; i++) {
      if (aksiManusia(meja, surat, 'p1', rng)) continue;
      if (!jam.langkah()) throw new Error('macet');
    }
    meja.terima('p1', { t: 'putaranBerikut' });
    siapSemua(meja);
    meja.terima('p1', { t: 'keluar' });
    expect(meja.adaKursiManusia).toBe(false);
    const c = catatanSprint(meja.data, 2_000_000)!;
    expect(c).toMatchObject({ menang: false, selesai: false, putaran: 1, nama: 'Budi', kode: 'ABCDE' });
    expect(c.skor).toBe(meja.data.game!.riwayat[0].skorAkumulasi[0]);
  });

  it('Keluar sebelum putaran pertama selesai: tidak ada catatan (bukan skor 0 yang mengalahkan percobaan minus)', () => {
    const { meja, surat, jam } = mejaSprint();
    // Keluar di popup joker.
    expect(meja.data.game).not.toBeNull();
    expect(catatanSprint(meja.data, 1_500_000)).toBeNull();
    siapSemua(meja);
    const rng = new Rng(5);
    // Main beberapa langkah di putaran pertama, lalu keluar.
    for (let i = 0; i < 6 && meja.data.game!.status === 'putaranBerjalan'; i++) {
      if (aksiManusia(meja, surat, 'p1', rng)) continue;
      if (!jam.langkah()) break;
    }
    meja.terima('p1', { t: 'keluar' });
    expect(meja.adaKursiManusia).toBe(false);
    expect(meja.data.game!.riwayat).toHaveLength(0);
    expect(catatanSprint(meja.data, 2_000_000)).toBeNull();
  });

  it('bukan meja sprint atau belum ada permainan: tidak ada catatan; info meja biasa tanpa `sprint`', () => {
    const { opsi, surat } = siapkan();
    const biasa = Meja.buat(opsi, 'h', 'Ani');
    expect(catatanSprint(biasa.data, 1)).toBeNull();
    expect(biasa.sprint).toBe(false);
    expect('sprint' in surat.info('h')).toBe(false);
    expect('sprint' in biasa.data).toBe(false);
  });

  it('validasi pesan sprint', () => {
    expect(validasiPesan({ t: 'sprint', nama: 'Budi' })).toEqual({ t: 'sprint', nama: 'Budi' });
    expect(validasiPesan({ t: 'sprint', nama: 'Budi', lain: 1 })).toEqual({ t: 'sprint', nama: 'Budi' });
    for (const x of [{ t: 'sprint' }, { t: 'sprint', nama: 5 }, { t: 'sprint', nama: 'x'.repeat(101) }]) expect(validasiPesan(x)).toBeNull();
  });
});
