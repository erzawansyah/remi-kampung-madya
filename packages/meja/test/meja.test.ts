import { describe, expect, it } from 'vitest';
import { buatPermainan, Rng, terapkan, type GameState, type HasilPutaran } from '@remi/engine';
import {
  BATAS_JOKER_SAMBUNG_MS,
  buatRingkasanAkhir,
  hitungPeringkat,
  urutkanPeringkat,
  DAFTAR_EMOTE,
  EMOTE_LAMA,
  MAKS_PESAN,
  rapikanPesan,
  Meja,
  NAMA_LAWAN_BAWAAN,
  namaLawanAcak,
  rapikanNama,
  TENGGANG_SAMBUNG_MS,
  TOLERANSI_BATAS_MS,
  validasiPesan,
  type DataMeja,
  type Kursi,
  type RingkasanAkhir,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

function mejaDenganBot(jumlahPemain = 4, pengaturan = {}) {
  const ctx = siapkan();
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain, detikGiliran: 0, ...pengaturan });
  for (let i = 1; i < jumlahPemain; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
  return { ...ctx, meja };
}

/** Jalankan sampai putaran berjalan selesai; manusia di `manusia` dijalankan otomatis. */
function mainkanSampaiPutaranSelesai(
  meja: Meja,
  ctx: ReturnType<typeof siapkan>,
  manusia: string[],
  rng = new Rng(9),
): void {
  for (let i = 0; i < 5000; i++) {
    const st = meja.data.game?.status;
    if (st !== 'putaranBerjalan' && st !== 'susunAkhir') return;
    if (manusia.some((p) => aksiManusia(meja, ctx.surat, p, rng))) continue;
    if (!ctx.jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran manusia');
  }
  throw new Error('putaran tidak selesai');
}

describe('lobi', () => {
  it('membuat meja: host di kursi 0, sisanya kosong', () => {
    const { opsi, surat } = siapkan();
    Meja.buat(opsi, 'host', '  Budi  ', { jumlahPemain: 3 });
    expect(surat.terakhir('host', 'masuk')).toEqual({ t: 'masuk', kode: 'ABCDE', token: 'host', kursi: 0 });
    const info = surat.info('host');
    expect(info.status).toBe('lobi');
    expect(info.kursi.map((k) => k.jenis)).toEqual(['manusia', 'kosong', 'kosong']);
    expect(info.kursi[0].nama).toBe('Budi');
    expect(info.host).toBe(0);
    expect(info.kursiSaya).toBe(0);
  });

  it('orang masuk ke kursi kosong; meja penuh ditolak', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2 });
    expect(meja.masuk('p2', 'Siti')).toBe(1);
    expect(surat.info('host').kursi[1]).toMatchObject({ jenis: 'manusia', nama: 'Siti', terhubung: true });
    expect(() => meja.masuk('p3', 'Joko')).toThrow('penuh');
  });

  it('pemain yang sama masuk lagi = sambung ulang ke kursinya', () => {
    const { opsi } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.masuk('p2', 'Siti');
    meja.terputus('p2');
    expect(meja.masuk('p2', 'Siti')).toBe(1);
    expect(meja.info(1).kursi[1].terhubung).toBe(true);
  });

  it('hanya host yang bisa atur kursi, pengaturan, dan mulai', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.masuk('p2', 'Siti');
    meja.terima('p2', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('p2', { t: 'mulai' });
    expect(surat.errors('p2')).toEqual(['Cuma host yang bisa melakukan ini.', 'Cuma host yang bisa melakukan ini.']);
  });

  it('tidak bisa mulai kalau masih ada kursi kosong', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    expect(surat.errors('host')[0]).toContain('kursi kosong');
  });

  it('host mengganti kursi manusia dengan bot → orangnya dikeluarkan', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'mudah' });
    expect(surat.terakhir('p2', 'keluar')).toBeDefined();
    expect(surat.info('host').kursi[1]).toMatchObject({ jenis: 'bot', nama: NAMA_LAWAN_BAWAAN[0], level: 'mudah' });
    expect(meja.punyaPemain('p2')).toBe(false);
  });

  it('ubah jumlah pemain menambah/mengurangi kursi; kursi berisi orang tidak bisa dihapus', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 5 } });
    expect(surat.info('host').kursi).toHaveLength(5);
    meja.masuk('p2', 'Siti');
    meja.masuk('p3', 'Joko');
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 2 } });
    expect(surat.errors('host').at(-1)).toContain('Masih ada pemain');
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 3 } });
    expect(surat.info('host').kursi).toHaveLength(3);
  });

  it('host pergi → host pindah ke manusia lain yang terhubung', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.masuk('p2', 'Siti');
    meja.terputus('host');
    expect(surat.info('p2').host).toBe(1);
    meja.tinggalkan('host');
    expect(surat.info('p2').kursi[0].jenis).toBe('kosong');
  });
});

describe('permainan', () => {
  it('mulai: tiap manusia hanya melihat tangannya sendiri', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0 });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const v0 = surat.view('host');
    const v1 = surat.view('p2');
    expect(v0.putaran!.tangan[0]).toHaveLength(6);
    expect(v0.putaran!.tangan[1]).toBeNull();
    expect(v1.putaran!.tangan[0]).toBeNull();
    expect(v1.putaran!.tangan[1]).toHaveLength(6);
    expect(surat.info('host').status).toBe('main');
    expect(JSON.stringify(surat.semua('host'))).not.toContain('"deck":[');
  });

  it('bukan giliran → error dari mesin aturan', () => {
    const { meja, surat } = mejaDenganBot(3);
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host').at(-1)).toContain('gilirannya');
  });

  it('1 manusia + 3 bot dimainkan sampai permainan selesai tanpa error', () => {
    const ctx = mejaDenganBot(4, { batasPutaran: 3, batasSkorAtas: null, batasSkorBawah: null });
    const { meja, surat } = ctx;
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    for (let putaran = 0; putaran < 3; putaran++) {
      mainkanSampaiPutaranSelesai(meja, ctx, ['host']);
      if (meja.status === 'main') meja.terima('host', { t: 'putaranBerikut' });
    }
    expect(meja.status).toBe('selesai');
    expect(surat.view('host').riwayat).toHaveLength(3);
    expect(surat.errors('host')).toEqual([]);
  });

  it('pengocok putaran berikutnya harus skor terendah', () => {
    const ctx = mejaDenganBot(3, { batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    mainkanSampaiPutaranSelesai(ctx.meja, ctx, ['host']);
    const skor = ctx.surat.view('host').skor;
    const min = Math.min(...skor);
    const bukan = skor.findIndex((s) => s !== min);
    ctx.meja.terima('host', { t: 'putaranBerikut', pengocok: bukan });
    siapSemua(ctx.meja);
    expect(ctx.surat.errors('host').at(-1)).toContain('terendah');
  });

  it('batas waktu giliran habis → bot mengambil alih giliran itu', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 30 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const info = surat.info('host');
    expect(info.batasWaktu).toBe(jam.sekarang() + 30_000);
    jam.maju(29_000);
    expect(meja.data.game!.putaran!.giliran).toBe(0);
    jam.maju(1_000);
    // Batas resmi lewat, tapi warga kedai baru mengambil alih sesudah toleransi tersembunyi
    // (keputusan pemilik 24 Okt 2026). Batas yang dikirim ke client tetap batas resmi.
    expect(surat.info('host').diambilAlihBot).toBe(false);
    expect(surat.info('host').batasWaktu).toBe(info.batasWaktu);
    jam.maju(TOLERANSI_BATAS_MS - 1);
    expect(surat.info('host').diambilAlihBot).toBe(false);
    jam.maju(1);
    expect(surat.info('host').diambilAlihBot).toBe(true);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host').at(-1)).toContain('Waktu habis');
    // Bot menyelesaikan giliran pemain 0, lalu giliran berpindah.
    for (let i = 0; i < 20 && meja.data.game!.putaran!.giliran === 0; i++) jam.langkah();
    expect(meja.data.game!.putaran!.giliran).toBe(1);
    expect(surat.info('host').diambilAlihBot).toBe(false);
  });

  it('susun akhir: manusia diberi waktu, lewat batas bot menyusun untuknya', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 30, batasPutaran: null });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    // Paksa deck tinggal satu kartu lewat data meja, lalu lanjutkan.
    const data = meja.data;
    meja.hentikan();
    const p = data.game!.putaran!;
    p.tangan[1].push(...p.deck.splice(0, p.deck.length - 1));
    const lanjut = new Meja(opsi, data);
    lanjut.terhubung('host');
    const v = surat.view('host');
    const tangan = v.putaran!.tangan[0]!;
    lanjut.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    lanjut.terima('host', { t: 'aksi', aksi: { jenis: 'buang', kartuId: tangan[0].id } });
    expect(lanjut.data.game!.status).toBe('susunAkhir');
    // Bot menyelesaikan bagiannya; manusia masih ditunggu.
    for (let i = 0; i < 10 && !lanjut.data.game!.putaran!.selesaiSusun[1]; i++) jam.langkah();
    expect(lanjut.data.game!.status).toBe('susunAkhir');
    expect(surat.info('host').batasWaktu).not.toBeNull();
    jam.maju(30_000);
    for (let i = 0; i < 20 && lanjut.data.game!.status === 'susunAkhir'; i++) jam.langkah();
    expect(lanjut.data.game!.status).toBe('putaranSelesai');
    expect(surat.errors('host')).toEqual([]);
  });

  it('susun akhir: manusia menekan Selesai sendiri', () => {
    const ctx = mejaDenganBot(3, { batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    let lewatSusun = false;
    for (let i = 0; i < 5000 && ctx.meja.status === 'main' && ctx.meja.data.game!.status !== 'putaranSelesai'; i++) {
      const v = ctx.surat.view('host');
      if (v.status === 'susunAkhir' && !v.putaran!.selesaiSusun[0]) {
        lewatSusun = true;
        ctx.meja.terima('host', { t: 'aksi', aksi: { jenis: 'selesaiSusun' } });
        continue;
      }
      if (!aksiManusia(ctx.meja, ctx.surat, 'host', new Rng(i)) && !ctx.jam.langkah()) break;
    }
    expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
    // Susun akhir terjadi setelah deck habis maupun setelah mentung.
    expect(lewatSusun).toBe(true);
    expect(ctx.surat.errors('host')).toEqual([]);
  });

  it('tempo bot bisa diubah host saat main; pengaturan lain tidak', () => {
    const { meja, surat } = mejaDenganBot(3);
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    meja.terima('host', { t: 'pengaturan', pengaturan: { tempoBot: 'santai' } });
    expect(surat.info('host').pengaturan.tempoBot).toBe('santai');
    meja.terima('host', { t: 'pengaturan', pengaturan: { jumlahPemain: 4 } });
    expect(surat.errors('host').at(-1)).toContain('sebelum permainan mulai');
  });

  it('bot "mikir" 3–10 detik sebelum aksi pertamanya (tempo santai)', () => {
    const { opsi, jam, surat } = siapkan({ jedaBotMs: undefined });
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0, tempoBot: 'santai' });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    expect(surat.info('host').botMikir).toBe(1);
    const sudahAmbil = () => meja.data.game!.peristiwa.some((e) => e.jenis === 'ambilDeck' && e.pemain === 1);
    jam.maju(2999);
    expect(sudahAmbil()).toBe(false);
    jam.maju(7001);
    expect(sudahAmbil()).toBe(true);
  });

  it('pengumuman joker: permainan menunggu semua manusia menekan OK', () => {
    const { opsi, jam, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0 });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 2 });
    expect(surat.info('host').menungguJoker).toEqual([0, 1]);
    // Bot pengocok belum boleh jalan, manusia juga belum boleh beraksi.
    expect(jam.jumlahTimer).toBe(0);
    meja.terima('host', { t: 'siapJoker' });
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(jam.jumlahTimer).toBe(0);
    meja.terima('p2', { t: 'siapJoker' });
    expect(surat.info('p2').menungguJoker).toEqual([]);
    expect(jam.jumlahTimer).toBe(1);
  });

  it('pengumuman joker: pemain yang terputus tidak ditunggu; batas waktu ikut berlaku', () => {
    const { opsi, jam, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 30 });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    expect(surat.info('host').menungguJoker).toEqual([0]);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host').at(-1)).toContain('joker');
    jam.maju(30_000);
    expect(surat.info('host').menungguJoker).toEqual([]);
  });

  it('pemain terputus di gilirannya → bot jalan; kembali → dapat view lagi', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0 });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    meja.terputus('p2');
    for (let i = 0; i < 20 && meja.data.game!.putaran!.giliran === 1; i++) jam.langkah();
    expect(meja.data.game!.putaran!.giliran).not.toBe(1);
    surat.bersihkan();
    meja.masuk('p2', 'Siti');
    expect(surat.terakhir('p2', 'masuk')!.kursi).toBe(1);
    expect(surat.view('p2').putaran!.tangan[1]).not.toBeNull();
  });

  it('semua manusia terputus → permainan dijeda (tidak ada timer)', () => {
    const { meja, jam } = mejaDenganBot(3);
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(meja);
    meja.terputus('host');
    expect(jam.jumlahTimer).toBe(0);
    meja.terhubung('host');
    expect(jam.jumlahTimer).toBe(1);
  });

  it('keluar saat main → kursinya diteruskan bot', () => {
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0 });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    meja.terima('p2', { t: 'keluar' });
    expect(surat.terakhir('p2', 'keluar')).toBeDefined();
    expect(surat.info('host').kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Siti' });
  });

  it('akhiri permainan: semua manusia harus setuju, hanya di antara putaran', () => {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: null });
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    meja.terima('host', { t: 'akhiri', setuju: true });
    expect(ctx.surat.errors('host').at(-1)).toContain('di antara putaran');
    mainkanSampaiPutaranSelesai(meja, { ...ctx }, ['host', 'p2']);
    meja.terima('host', { t: 'akhiri', setuju: true });
    expect(meja.status).toBe('main');
    expect(ctx.surat.info('p2').setujuAkhiri).toEqual([0]);
    meja.terima('p2', { t: 'akhiri', setuju: true });
    expect(meja.status).toBe('selesai');
    expect(ctx.surat.view('host').alasanSelesai).toBe('sepakat');
    meja.terima('host', { t: 'mainLagi' });
    expect(meja.status).toBe('lobi');
  });

  it('main lagi: putaran pertama permainan baru bebas, joker boleh sama dengan putaran terakhir permainan lama (#40)', () => {
    let seedBerikut = 1;
    const ctx = siapkan({ buatSeed: () => seedBerikut });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0, batasPutaran: null });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    mainkanSampaiPutaranSelesai(meja, ctx, ['host']);
    const rankLama = meja.data.game!.riwayat.at(-1)!.rankJoker;
    if (meja.status !== 'selesai') meja.terima('host', { t: 'akhiri', setuju: true });
    expect(meja.status).toBe('selesai');
    meja.terima('host', { t: 'mainLagi' });
    // Seed yang putaran pertamanya membuka angka yang sama dengan joker terakhir permainan lama.
    const bukaPertama = (seed: number) =>
      terapkan(buatPermainan({ pemain: ['A', 'B'], seed }), { jenis: 'mulaiPutaran', pengocok: 0 }).putaran!.rankJoker;
    seedBerikut = Array.from({ length: 500 }, (_, i) => i + 2).find((s) => bukaPertama(s) === rankLama)!;
    expect(seedBerikut).toBeDefined();
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    const g = meja.data.game!;
    expect(g.riwayat).toEqual([]);
    expect(g.putaran!.nomor).toBe(1);
    expect(g.putaran!.rankJoker).toBe(rankLama);
  });

  it('simpanan dari versi lama (tanpa field baru) tetap bisa dilanjutkan', () => {
    const ctx = mejaDenganBot(3);
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    const data = JSON.parse(JSON.stringify(ctx.meja.data));
    ctx.meja.hentikan();
    delete data.game.peristiwa;
    delete data.game.putaran.selesaiSusun;
    delete data.game.putaran.mulungBeruntun;
    delete data.pengaturan.tempoBot;
    const lanjut = new Meja(ctx.opsi, data);
    lanjut.terhubung('host');
    expect(ctx.surat.view('host').peristiwa).toEqual([]);
    mainkanSampaiPutaranSelesai(lanjut, ctx, ['host']);
    expect(lanjut.data.game!.riwayat).toHaveLength(1);
  });

  it('saat permainan selesai, klasemen akhir dilaporkan sekali', () => {
    const laporan: RingkasanAkhir[] = [];
    const ctx = siapkan({ saatSelesai: (r) => laporan.push(r) });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    mainkanSampaiPutaranSelesai(meja, ctx, ['host']);
    expect(laporan).toHaveLength(0);
    meja.terima('host', { t: 'akhiri', setuju: true });
    expect(laporan).toHaveLength(1);
    const r = laporan[0];
    expect(r).toMatchObject({ kode: 'ABCDE', alasan: 'sepakat', jumlahPutaran: 1 });
    expect(r.pemain.map((p) => p.skor)).toEqual([...r.pemain.map((p) => p.skor)].sort((a, b) => b - a));
    expect(r.pemain.find((p) => p.kursi === 0)).toMatchObject({ nama: 'Budi', bot: false });
    expect(r.pemain.find((p) => p.kursi === 1)!.bot).toBe(true);
    expect(r.pemain[0].peringkat).toBe(1);
    meja.terima('host', { t: 'mainLagi' });
    expect(laporan).toHaveLength(1);
  });

  it('data meja bisa disimpan dan dilanjutkan', () => {
    const ctx = mejaDenganBot(3);
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    ctx.jam.langkah();
    const data: DataMeja = JSON.parse(JSON.stringify(ctx.meja.data));
    ctx.meja.hentikan();
    const lanjut = new Meja(ctx.opsi, data);
    lanjut.terhubung('host');
    expect(ctx.surat.view('host').putaran!.nomor).toBe(1);
    mainkanSampaiPutaranSelesai(lanjut, ctx, ['host']);
    expect(lanjut.data.game!.riwayat).toHaveLength(1);
  });
});

/** Meja 3 kursi: host (0), Siti/p2 (1), warga kedai (2). Belum dimulai. */
function mejaDuaManusia(pengaturan = {}, extra: Parameters<typeof siapkan>[0] = {}) {
  const ctx = siapkan(extra);
  const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, ...pengaturan });
  meja.masuk('p2', 'Siti');
  meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  return { ...ctx, meja };
}

describe('tanda keluar untuk peringkat (keputusan pemilik #45)', () => {
  it('keluar saat main: kursi ditandai keluar (tidak dikirim ke client), klasemen akhir menulis bot: false, keluar: true', () => {
    const laporan: RingkasanAkhir[] = [];
    const ctx = mejaDuaManusia({ batasPutaran: null }, { saatSelesai: (r) => laporan.push(r) });
    const { meja, surat } = ctx;
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    meja.terima('p2', { t: 'keluar' });
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Siti', keluar: true });
    expect(meja.data.kursi[0].keluar).toBeUndefined();
    expect(meja.data.kursi[2].keluar).toBeUndefined();
    expect(surat.info('host').kursi[1]).not.toHaveProperty('keluar');
    expect(JSON.stringify(surat.semua('host'))).not.toContain('keluar":true');

    mainkanSampaiPutaranSelesai(meja, ctx, ['host']);
    meja.terima('host', { t: 'akhiri', setuju: true });
    expect(laporan).toHaveLength(1);
    const r = laporan[0];
    expect(r).toMatchObject({ jumlahDeck: 1, modeKaldu: false, alasan: 'sepakat' });
    expect(r.pemain.find((p) => p.kursi === 1)).toMatchObject({ nama: 'Siti', bot: false, keluar: true });
    expect(r.pemain.find((p) => p.kursi === 0)).toMatchObject({ nama: 'Budi', bot: false });
    expect(r.pemain.find((p) => p.kursi === 0)).not.toHaveProperty('keluar');
    expect(r.pemain.find((p) => p.kursi === 2)).toMatchObject({ bot: true });
    expect(r.pemain.find((p) => p.kursi === 2)).not.toHaveProperty('keluar');

    // Main lagi: tandanya hilang, kursinya warga kedai biasa.
    meja.terima('host', { t: 'mainLagi' });
    expect(meja.status).toBe('lobi');
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Siti' });
    expect(meja.data.kursi[1]).not.toHaveProperty('keluar');
  });

  it('keluar mencatat berapa putaran yang hasilnya sudah jatuh: tengah putaran 1 → 0, sesudah putaran 1 → 1', () => {
    const ctx = mejaDuaManusia({ batasPutaran: null });
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    expect(ctx.meja.data.game!.status).toBe('putaranBerjalan');
    ctx.meja.terima('p2', { t: 'keluar' });
    expect(ctx.meja.data.kursi[1]).toMatchObject({ keluar: true, keluarSesudahPutaran: 0 });
    expect(ctx.surat.info('host').kursi[1]).not.toHaveProperty('keluarSesudahPutaran');

    const ctx2 = mejaDuaManusia({ batasPutaran: null });
    ctx2.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx2.meja);
    mainkanSampaiPutaranSelesai(ctx2.meja, ctx2, ['host', 'p2']);
    expect(ctx2.meja.data.game!.status).toBe('putaranSelesai');
    ctx2.meja.terima('p2', { t: 'keluar' });
    expect(ctx2.meja.data.kursi[1]).toMatchObject({ keluar: true, keluarSesudahPutaran: 1 });
    // Keluar di susun akhir: yang mentung/kepentung putaran itu sudah ketahuan, putarannya ikut.
    const ctx3 = mejaDuaManusia({ batasPutaran: null });
    ctx3.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx3.meja);
    const rng = new Rng(9);
    for (let i = 0; i < 5000 && ctx3.meja.data.game!.status === 'putaranBerjalan'; i++) {
      if (['host', 'p2'].some((p) => aksiManusia(ctx3.meja, ctx3.surat, p, rng))) continue;
      if (!ctx3.jam.langkah()) throw new Error('macet');
    }
    expect(ctx3.meja.data.game!.status).toBe('susunAkhir');
    ctx3.meja.terima('p2', { t: 'keluar' });
    expect(ctx3.meja.data.kursi[1]).toMatchObject({ keluar: true, keluarSesudahPutaran: 1 });

    // Main lagi: kedua tanda hilang.
    ctx2.meja.terima('host', { t: 'akhiri', setuju: true });
    ctx2.meja.terima('host', { t: 'mainLagi' });
    expect(ctx2.meja.data.kursi[1]).not.toHaveProperty('keluar');
    expect(ctx2.meja.data.kursi[1]).not.toHaveProperty('keluarSesudahPutaran');
  });

  it('klasemen akhir: mentung/kepentung yang keluar hanya dari putaran sebelum ia keluar, bukan hasil warga kedai penerusnya', () => {
    // Siti (kursi 1) keluar sesudah putaran 1; warga kedai di kursinya mentung di putaran 2–4 dan
    // kepentung di putaran 3. Yang tercatat untuk Siti hanya putaran 1 (ia kepentung sekali).
    const h = (pementung: number | null, kepentung: number[]) => ({ pementung, kepentung }) as unknown as HasilPutaran;
    const game = {
      pemain: [{ nama: 'Budi' }, { nama: 'Siti' }, { nama: 'Kipas Dua' }],
      skor: [40, 300, -90],
      riwayat: [h(0, [1, 2]), h(1, [0, 2]), h(1, [0, 2]), h(1, [0, 2])],
      alasanSelesai: 'sepakat',
      konfigurasi: { duaDeckUntukEmpat: false },
    } as unknown as GameState;
    const kursi: Kursi[] = [
      { jenis: 'manusia', nama: 'Budi', pemainId: 'host', terhubung: true, level: 'normal' },
      { jenis: 'bot', nama: 'Siti', pemainId: null, terhubung: false, level: 'normal', keluar: true, keluarSesudahPutaran: 1 },
      { jenis: 'bot', nama: 'Kipas Dua', pemainId: null, terhubung: false, level: 'normal' },
    ];
    const r = buatRingkasanAkhir('ABCDE', kursi, game, 0);
    const per = (i: number) => r.pemain.find((p) => p.kursi === i)!;
    expect(per(1)).toMatchObject({ nama: 'Siti', keluar: true, bot: false, skor: 300, mentung: 0, kepentung: 1 });
    // Kursi lain tetap dihitung dari semua putaran.
    expect(per(0)).toMatchObject({ mentung: 1, kepentung: 3 });
    expect(per(2)).toMatchObject({ bot: true, mentung: 0, kepentung: 4 });
    // Di peringkat online Siti tidak naik di urutan "Paling sering mentung".
    const baris = hitungPeringkat([{ pemain: r.pemain }]);
    expect(urutkanPeringkat(baris, 'mentung').peringkat.map((b) => [b.nama, b.mentung])).toEqual([
      ['Budi', 1],
      ['Siti', 0],
    ]);

    // Simpanan tanpa jumlah putaran (seharusnya tidak ada): jatuh ke semua putaran, tanpa galat.
    delete kursi[1].keluarSesudahPutaran;
    expect(buatRingkasanAkhir('ABCDE', kursi, game, 0).pemain.find((p) => p.kursi === 1)).toMatchObject({ mentung: 3, kepentung: 1 });
  });

  it('keluar di lobi atau sesudah permainan selesai tidak ditandai', () => {
    const ctx = mejaDuaManusia({ batasPutaran: 1 });
    const { meja } = ctx;
    meja.terima('p2', { t: 'keluar' });
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'kosong' });
    expect(meja.data.kursi[1]).not.toHaveProperty('keluar');
    meja.masuk('p2', 'Siti');
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    mainkanSampaiPutaranSelesai(meja, ctx, ['host', 'p2']);
    expect(meja.status).toBe('selesai');
    meja.terima('p2', { t: 'keluar' });
    expect(meja.data.kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Siti' });
    expect(meja.data.kursi[1]).not.toHaveProperty('keluar');
  });

  it('terputus (menutup aplikasi tanpa Keluar) tidak ditandai keluar', () => {
    const ctx = mejaDuaManusia();
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    ctx.meja.terputus('p2');
    expect(ctx.meja.data.kursi[1]).toMatchObject({ jenis: 'manusia', terhubung: false });
    expect(ctx.meja.data.kursi[1]).not.toHaveProperty('keluar');
  });

  it('simpanan yang masih membawa tanda keluar dibersihkan saat permainan baru dimulai', () => {
    const ctx = mejaDuaManusia();
    ctx.meja.terima('host', { t: 'mulai' });
    siapSemua(ctx.meja);
    ctx.meja.terima('p2', { t: 'keluar' });
    const data: DataMeja = JSON.parse(JSON.stringify(ctx.meja.data));
    ctx.meja.hentikan();
    data.game = null;
    const lanjut = new Meja(ctx.opsi, data);
    expect(lanjut.data.kursi[1].keluar).toBe(true);
    lanjut.terima('host', { t: 'mulai' });
    expect(lanjut.status).toBe('main');
    expect(lanjut.data.kursi[1]).not.toHaveProperty('keluar');
  });

  it('jumlahDeck klasemen akhir ikut aturan pembagian (4 orang 2 deck, 5 orang)', () => {
    for (const [n, duaDeck, harap] of [
      [4, true, 2],
      [4, false, 1],
      [5, false, 2],
    ] as const) {
      const laporan: RingkasanAkhir[] = [];
      const ctx = siapkan({ saatSelesai: (r) => laporan.push(r) });
      const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: n, duaDeckUntukEmpat: duaDeck, detikGiliran: 0, batasPutaran: 1 });
      for (let i = 1; i < n; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
      meja.terima('host', { t: 'mulai' });
      siapSemua(meja);
      mainkanSampaiPutaranSelesai(meja, ctx, ['host']);
      expect(laporan[0]?.jumlahDeck, `${n} orang, duaDeck ${duaDeck}`).toBe(harap);
      meja.hentikan();
    }
  });
});

const jumlahAksi = (meja: Meja, pemain: number) =>
  meja.data.game!.peristiwa.filter((e) => 'pemain' in e && e.pemain === pemain).length;

describe('sambung ulang dan pengumuman joker (keputusan pemilik #8, #9; #34 diubah 24 Okt 2026)', () => {
  it('#8 terputus sebelum OK joker → saat kembali, popup joker muncul lagi untuknya saja; meja jalan terus', () => {
    const { meja, surat, jam } = mejaDuaManusia();
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    expect(surat.info('host').menungguJoker).toEqual([]);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
    surat.bersihkan();
    meja.masuk('p2', 'Siti');
    // Siti belum pernah melihat joker putaran ini: popup muncul lagi untuknya saja. Meja tidak ikut
    // menunggu: info host tidak memuat kursi Siti, dan giliran host jalan terus.
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    // Meja tanpa batas waktu giliran: yang berjalan hanya batas tunggu popup Siti.
    expect(jam.jumlahTimer).toBe(1);
    const rng = new Rng(5);
    for (let i = 0; i < 10 && meja.data.game!.putaran!.giliran === 0; i++) aksiManusia(meja, surat, 'host', rng);
    expect(surat.errors('host')).toEqual([]);
    // Giliran pindah ke Siti yang belum menekan OK: gilirannya menunggu OK-nya dulu.
    expect(meja.data.game!.putaran!.giliran).toBe(1);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2').at(-1)).toContain('pengumuman joker');
    meja.terima('p2', { t: 'siapJoker' });
    expect(surat.info('p2').menungguJoker).toEqual([]);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2')).toHaveLength(1);
    // Refresh lagi sesudah OK: tidak ditanya lagi.
    meja.terputus('p2');
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([]);
    expect(meja.data.sudahLihatJoker).toEqual([0, 1]);
  });

  it('#8 sudah menekan OK lalu refresh → popup tidak muncul lagi', () => {
    const { meja, surat } = mejaDuaManusia();
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    meja.terputus('host');
    meja.terhubung('host');
    expect(surat.info('host').menungguJoker).toEqual([]);
  });

  it('#8 pemain yang terputus sejak putaran dimulai ditanya saat kembali; putaran berikutnya semua ditanya lagi', () => {
    const ctx = mejaDuaManusia({ batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    const { meja, surat } = ctx;
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    meja.terhubung('p2');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    meja.terima('p2', { t: 'siapJoker' });
    mainkanSampaiPutaranSelesai(meja, ctx, ['host', 'p2']);
    // Di antara putaran tidak ada popup joker untuk yang tersambung kembali.
    meja.terputus('p2');
    meja.terhubung('p2');
    expect(surat.info('p2').menungguJoker).toEqual([]);
    meja.terima('host', { t: 'putaranBerikut' });
    expect(surat.info('host').menungguJoker).toEqual([0, 1]);
    expect(meja.data.sudahLihatJoker).toEqual([]);
  });

  it('#8 tanpa batas waktu giliran: tunggu joker karena sambung ulang tetap dibatasi, lalu dianggap sudah melihat', () => {
    const { meja, surat, jam } = mejaDuaManusia();
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    jam.maju(BATAS_JOKER_SAMBUNG_MS - 1);
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    jam.maju(1);
    expect(surat.info('p2').menungguJoker).toEqual([]);
    expect(meja.data.sudahLihatJoker).toEqual([0, 1]);
    meja.terputus('p2');
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([]);
  });

  it('#8 dengan batas waktu giliran: giliran orang lain tidak tertahan dan batas waktunya tidak diulang', () => {
    const { meja, surat, jam } = mejaDuaManusia({ detikGiliran: 20 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    const batasHost = surat.info('host').batasWaktu;
    expect(batasHost).toBe(jam.sekarang() + 20_000);
    jam.maju(15_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    expect(surat.info('host').batasWaktu).toBe(batasHost);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
  });

  it('#8 giliran dipegang kursi yang menunggu popup joker: giliran itu menunggu OK-nya, lalu dapat waktu penuh', () => {
    const { meja, surat, jam } = mejaDuaManusia({ detikGiliran: 20 });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    expect(meja.data.game!.putaran!.giliran).toBe(1);
    jam.maju(5_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    // Batas tunggunya = batas waktu giliran (20 dtk, lebih pendek dari BATAS_JOKER_SAMBUNG_MS).
    expect(surat.info('host').batasWaktu).toBe(jam.sekarang() + 20_000);
    expect(surat.info('host').botMikir).toBeNull();
    jam.maju(19_999);
    expect(jumlahAksi(meja, 1)).toBe(0);
    expect(surat.info('host').diambilAlihBot).toBe(false);
    meja.terima('p2', { t: 'siapJoker' });
    // Sesudah OK: giliran Siti mulai dengan waktu penuh.
    expect(surat.info('p2').menungguJoker).toEqual([]);
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + 20_000);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2')).toEqual([]);
  });

  it('#8 giliran dipegang kursi yang menunggu popup joker tapi ia tidak menekan OK: sesudah batas tunggu, giliran mulai biasa', () => {
    const { meja, surat, jam } = mejaDuaManusia({ detikGiliran: 60 });
    meja.terima('host', { t: 'mulai', pengocok: 1 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    meja.masuk('p2', 'Siti');
    expect(surat.info('host').batasWaktu).toBe(jam.sekarang() + BATAS_JOKER_SAMBUNG_MS);
    jam.maju(BATAS_JOKER_SAMBUNG_MS);
    expect(surat.info('p2').menungguJoker).toEqual([]);
    expect(surat.info('p2').batasWaktu).toBe(jam.sekarang() + 60_000);
    expect(meja.data.sudahLihatJoker).toEqual([0, 1]);
  });

  it('#8 batas waktu giliran lebih panjang: tunggu joker karena sambung ulang tetap maks BATAS_JOKER_SAMBUNG_MS', () => {
    const { meja, surat, jam } = mejaDuaManusia({ detikGiliran: 600 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    const batasHost = surat.info('host').batasWaktu;
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    jam.maju(BATAS_JOKER_SAMBUNG_MS - 1);
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    jam.maju(1);
    expect(surat.info('p2').menungguJoker).toEqual([]);
    // Giliran host tidak pernah tertahan: batas waktunya tetap yang semula.
    expect(surat.info('host').batasWaktu).toBe(batasHost);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
  });

  it('#8 tanya ulang cuma sekali per kursi per putaran: putus-sambung lagi tidak menahan meja', () => {
    const { meja, surat, jam } = mejaDuaManusia({ detikGiliran: 600 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    // Kembali pertama: ditanya ulang (popup untuk Siti saja).
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([1]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    expect(meja.data.sudahLihatJoker).toEqual([0, 1]);
    // Putus lagi sebelum OK (misalnya sinyal jelek), lalu kembali: tidak ditanya lagi.
    jam.maju(10_000);
    meja.terputus('p2');
    jam.maju(5_000);
    meja.masuk('p2', 'Siti');
    expect(surat.info('p2').menungguJoker).toEqual([]);
    expect(surat.info('host').menungguJoker).toEqual([]);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
  });

  it('#8 putus-sambung berulang tidak membekukan meja (popup paling banyak sekali per kursi per putaran)', () => {
    // Skenario temuan verifikasi: detikGiliran 600, Siti kembali lalu putus lagi tiap 25 dtk.
    const { meja, surat, jam } = mejaDuaManusia({ detikGiliran: 600 });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terputus('p2');
    meja.terima('host', { t: 'siapJoker' });
    const mulai = jam.sekarang();
    for (let siklus = 0; siklus < 3; siklus++) {
      meja.masuk('p2', 'Siti');
      expect(surat.info('p2').menungguJoker, `siklus ${siklus}`).toEqual(siklus === 0 ? [1] : []);
      expect(surat.info('host').menungguJoker, `siklus ${siklus}`).toEqual([]);
      jam.maju(25_000);
      meja.terputus('p2');
    }
    expect(jam.sekarang() - mulai).toBe(75_000);
    // Giliran host tidak tertahan: aksinya diterima.
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
  });

  it('#8 simpanan lama tanpa sudahLihatJoker: yang tidak sedang ditunggu dianggap sudah melihat', () => {
    const { meja, opsi, surat } = mejaDuaManusia();
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    meja.terima('host', { t: 'siapJoker' });
    const data = JSON.parse(JSON.stringify(meja.data)) as Partial<DataMeja>;
    meja.hentikan();
    delete data.sudahLihatJoker;
    const lanjut = new Meja(opsi, data as DataMeja);
    expect(lanjut.data.sudahLihatJoker).toEqual([0, 2]);
    lanjut.terhubung('host');
    expect(surat.info('host').menungguJoker).toEqual([1]);
  });

  it('#9 keluar sebelum OK joker → tidak ditunggu lagi, permainan lanjut (tanpa batas waktu)', () => {
    const { meja, surat, jam } = mejaDuaManusia();
    meja.terima('host', { t: 'mulai', pengocok: 2 });
    meja.terima('host', { t: 'siapJoker' });
    expect(surat.info('host').menungguJoker).toEqual([1]);
    expect(jam.jumlahTimer).toBe(0);
    meja.terima('p2', { t: 'keluar' });
    expect(surat.info('host').menungguJoker).toEqual([]);
    expect(surat.info('host').kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Siti' });
    // Warga kedai pengocok (kursi 2) mulai jalan.
    for (let i = 0; i < 10 && jumlahAksi(meja, 2) === 0; i++) jam.langkah();
    expect(jumlahAksi(meja, 2)).toBeGreaterThan(0);
  });
});

describe('voting akhiri saat pemilih berkurang (keputusan pemilik #10)', () => {
  function sampaiPutaranSelesai() {
    const ctx = mejaDuaManusia({ batasPutaran: null, batasSkorAtas: null, batasSkorBawah: null });
    ctx.meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(ctx.meja);
    mainkanSampaiPutaranSelesai(ctx.meja, ctx, ['host', 'p2']);
    expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
    return ctx;
  }

  it('yang setuju tinggal sendirian karena yang lain terputus → permainan berakhir', () => {
    const ctx = sampaiPutaranSelesai();
    ctx.meja.terima('host', { t: 'akhiri', setuju: true });
    expect(ctx.meja.status).toBe('main');
    ctx.meja.terputus('p2');
    expect(ctx.meja.status).toBe('selesai');
    expect(ctx.surat.view('host').alasanSelesai).toBe('sepakat');
  });

  it('yang belum setuju keluar meja → permainan berakhir', () => {
    const ctx = sampaiPutaranSelesai();
    ctx.meja.terima('p2', { t: 'akhiri', setuju: true });
    ctx.meja.terima('host', { t: 'keluar' });
    expect(ctx.meja.status).toBe('selesai');
    expect(ctx.surat.view('p2').alasanSelesai).toBe('sepakat');
  });

  it('yang setuju sendiri yang terputus → suaranya dicabut, permainan tidak berakhir', () => {
    const ctx = sampaiPutaranSelesai();
    ctx.meja.terima('host', { t: 'akhiri', setuju: true });
    ctx.meja.terputus('host');
    expect(ctx.meja.status).toBe('main');
    expect(ctx.surat.info('p2').setujuAkhiri).toEqual([]);
  });

  it('belum ada yang setuju: pemilih berkurang tidak mengakhiri permainan', () => {
    const ctx = sampaiPutaranSelesai();
    ctx.meja.terputus('p2');
    ctx.meja.terputus('host');
    expect(ctx.meja.status).toBe('main');
  });
});

describe('masa tenggang sambung ulang (keputusan pemilik #11)', () => {
  /** Giliran Siti (kursi 1) sudah berjalan, joker sudah di-OK semua. */
  function giliranSiti(pengaturan = {}, extra: Parameters<typeof siapkan>[0] = {}) {
    const ctx = mejaDuaManusia(pengaturan, extra);
    ctx.meja.terima('host', { t: 'mulai', pengocok: 1 });
    siapSemua(ctx.meja);
    expect(ctx.meja.data.game!.putaran!.giliran).toBe(1);
    return ctx;
  }

  it(`bawaan ${TENGGANG_SAMBUNG_MS / 1000} detik: kembali sebelum tenggang habis → giliran tetap miliknya`, () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2');
    jam.maju(TENGGANG_SAMBUNG_MS - 1);
    expect(jumlahAksi(meja, 1)).toBe(0);
    expect(surat.info('host').botMikir).toBeNull();
    meja.masuk('p2', 'Siti');
    jam.maju(60_000);
    expect(jumlahAksi(meja, 1)).toBe(0);
    meja.terima('p2', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('p2')).toEqual([]);
    expect(jumlahAksi(meja, 1)).toBe(1);
  });

  it('tenggang habis → warga kedai mengambil alih (lalu jeda mikir seperti biasa)', () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2');
    jam.maju(TENGGANG_SAMBUNG_MS);
    expect(surat.info('host').botMikir).toBe(1);
    expect(jumlahAksi(meja, 1)).toBe(0);
    jam.maju(100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
  });

  it('tenggang dihitung sejak terputus: giliran berikutnya selama masih terputus langsung dijalankan', () => {
    const { meja, surat, jam } = giliranSiti();
    meja.terputus('p2');
    jam.maju(TENGGANG_SAMBUNG_MS);
    const rng = new Rng(3);
    // Giliran Siti dijalankan warga kedai, lalu warga kedai (kursi 2) dan host, sampai kembali ke Siti.
    let lewat = false;
    for (let i = 0; i < 500; i++) {
      const p = meja.data.game!.putaran!;
      if (meja.data.game!.status !== 'putaranBerjalan') break;
      if (p.giliran !== 1) lewat = true;
      else if (lewat) break;
      if (!aksiManusia(meja, surat, 'host', rng)) jam.langkah();
    }
    expect(meja.data.game!.status).toBe('putaranBerjalan');
    expect(lewat).toBe(true);
    expect(meja.data.game!.putaran!.giliran).toBe(1);
    // Tidak ada tenggang baru: warga kedai langsung mikir untuk Siti.
    expect(surat.info('host').botMikir).toBe(1);
    const sebelum = jumlahAksi(meja, 1);
    jam.maju(100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(sebelum);
  });

  it('batas waktu giliran lebih dulu habis daripada tenggang → batas waktu yang berlaku', () => {
    const { meja, surat, jam } = giliranSiti({ detikGiliran: 30 });
    jam.maju(25_000);
    meja.terputus('p2');
    jam.maju(5_000 + TOLERANSI_BATAS_MS);
    expect(surat.info('host').diambilAlihBot).toBe(true);
    jam.maju(100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
  });

  it('tenggangSambungMs 0 → langsung diambil alih seperti sebelumnya', () => {
    const { meja, jam } = giliranSiti({}, { tenggangSambungMs: 0 });
    meja.terputus('p2');
    jam.maju(100);
    expect(jumlahAksi(meja, 1)).toBeGreaterThan(0);
  });
});

describe('jeda karena semua terputus (keputusan pemilik #12)', () => {
  it('kembali sesudah jeda panjang → batas waktu giliran diulang penuh, tidak langsung diambil alih', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 60 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    jam.maju(10_000);
    meja.terputus('host');
    expect(jam.jumlahTimer).toBe(0);
    jam.maju(5 * 60_000);
    meja.terhubung('host');
    expect(surat.info('host').batasWaktu).toBe(jam.sekarang() + 60_000);
    jam.maju(59_000);
    expect(surat.info('host').diambilAlihBot).toBe(false);
    expect(meja.data.game!.putaran!.giliran).toBe(0);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'ambilDeck' } });
    expect(surat.errors('host')).toEqual([]);
  });

  it('jeda saat pengumuman joker: yang kembali ditanya lagi dengan batas waktu baru', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 60 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    jam.maju(50_000);
    meja.terputus('host');
    jam.maju(5 * 60_000);
    meja.terhubung('host');
    expect(surat.info('host').menungguJoker).toEqual([0]);
    // Tunggu karena sambung ulang: paling lama BATAS_JOKER_SAMBUNG_MS walau batas giliran 60 dtk.
    expect(surat.info('host').batasWaktu).toBe(jam.sekarang() + BATAS_JOKER_SAMBUNG_MS);
  });
});

describe('emote', () => {
  it('emote dikirim ke semua manusia; dibatasi 1,2 detik per kursi', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2 });
    meja.masuk('p2', 'Siti');
    meja.terima('p2', { t: 'emote', isi: '😂' });
    expect(surat.terakhir('host', 'emote')).toEqual({ t: 'emote', kursi: 1, isi: '😂' });
    expect(surat.terakhir('p2', 'emote')).toEqual({ t: 'emote', kursi: 1, isi: '😂' });
    meja.terima('p2', { t: 'emote', isi: '🔥' });
    expect(surat.terakhir('host', 'emote')!.isi).toBe('😂');
    jam.maju(1200);
    meja.terima('p2', { t: 'emote', isi: '🔥' });
    expect(surat.terakhir('host', 'emote')!.isi).toBe('🔥');
  });

  it('pesan yang diketik sendiri diterima dan dirapikan (keputusan #48)', () => {
    expect(validasiPesan({ t: 'emote', isi: 'Waduh!' })).toEqual({ t: 'emote', isi: 'Waduh!' });
    expect(validasiPesan({ t: 'emote', isi: '  ayo   gas\nlagi  ' })).toEqual({ t: 'emote', isi: 'ayo gas lagi' });
    expect(validasiPesan({ t: 'emote', isi: '<b>halo</b>\u202e' })).toEqual({ t: 'emote', isi: 'bhalo/b' });
    // Kepanjangan dipotong ke MAKS_PESAN huruf, emoji tidak terbelah.
    const panjang = validasiPesan({ t: 'emote', isi: '👍'.repeat(100) }) as { isi: string };
    expect([...panjang.isi].length).toBe(MAKS_PESAN);
    expect(rapikanPesan('a'.repeat(200))).toHaveLength(MAKS_PESAN);
    // Kosong, cuma spasi, atau cuma karakter tak terlihat: tidak dikirim.
    for (const isi of ['', '   ', '\n\t', '\u200b\u200b', '<>']) {
      expect(validasiPesan({ t: 'emote', isi }), JSON.stringify(isi)).toBeNull();
    }
    // Isi raksasa ditolak tanpa dirapikan.
    expect(validasiPesan({ t: 'emote', isi: 'x'.repeat(5000) })).toBeNull();
    for (const isi of [5, null, ['GG'], { a: 1 }]) {
      expect(validasiPesan({ t: 'emote', isi }), String(isi)).toBeNull();
    }
    // Kunci bawaan objek tidak dipetakan lewat peta emote lama; diteruskan apa adanya sebagai teks.
    expect(validasiPesan({ t: 'emote', isi: '__proto__' })).toEqual({ t: 'emote', isi: '__proto__' });
  });

  it('pesan sendiri sampai ke semua manusia dan ikut batas 1,2 detik', () => {
    const { opsi, surat, jam } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2 });
    meja.masuk('p2', 'Siti');
    meja.terima('p2', validasiPesan({ t: 'emote', isi: 'gedein dong' })!);
    expect(surat.terakhir('host', 'emote')).toEqual({ t: 'emote', kursi: 1, isi: 'gedein dong' });
    meja.terima('p2', validasiPesan({ t: 'emote', isi: 'lagi' })!);
    expect(surat.terakhir('host', 'emote')!.isi).toBe('gedein dong');
    jam.maju(1200);
    meja.terima('p2', validasiPesan({ t: 'emote', isi: 'lagi' })!);
    expect(surat.terakhir('host', 'emote')!.isi).toBe('lagi');
  });

  it('celetukan baru dari pemilik ada di daftar, Cepetan! jadi Buruan!', () => {
    for (const isi of ['Gedein!', 'Buruan!', 'Lumayan!', 'CEKI!', 'Njir lah!', 'Give me!']) {
      expect((DAFTAR_EMOTE as readonly string[]).includes(isi), isi).toBe(true);
    }
    expect(validasiPesan({ t: 'emote', isi: 'Cepetan!' })).toEqual({ t: 'emote', isi: 'Buruan!' });
  });

  it('emote aplikasi lama (0.1.0) diterima dan diteruskan sebagai padanan barunya', () => {
    expect(validasiPesan({ t: 'emote', isi: 'Makasih, Bos!' })).toEqual({ t: 'emote', isi: 'Suwun, Bos!' });
    expect(validasiPesan({ t: 'emote', isi: 'Tutup!' })).toEqual({ t: 'emote', isi: 'Nutup, rek!' });
    // Semua padanan ada di daftar sekarang, dan tidak ada emote lama yang masih ada di daftar.
    for (const [lama, baru] of EMOTE_LAMA) {
      expect((DAFTAR_EMOTE as readonly string[]).includes(baru), baru).toBe(true);
      expect((DAFTAR_EMOTE as readonly string[]).includes(lama), lama).toBe(false);
    }
    const { opsi, surat } = siapkan();
    const meja = Meja.buat(opsi, 'host', 'Budi', { jumlahPemain: 2 });
    meja.masuk('p2', 'Siti');
    meja.terima('p2', validasiPesan(JSON.parse('{"t":"emote","isi":"Tutup!"}'))!);
    expect(surat.terakhir('host', 'emote')).toEqual({ t: 'emote', kursi: 1, isi: 'Nutup, rek!' });
  });

  it('bot nyeletuk setelah kejadian yang terlihat (misalnya kepentung)', () => {
    const ctx = siapkan({ acak: () => 0 });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: null });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('host', { t: 'mulai' });
    siapSemua(meja);
    // Mainkan sampai ada kejadian yang memancing celetukan (mulung kartu orang lain, mentung, kepentung).
    for (let i = 0; i < 3000 && !ctx.surat.terakhir('host', 'emote'); i++) {
      const st = meja.data.game?.status;
      if (st === 'putaranSelesai') meja.terima('host', { t: 'putaranBerikut' });
      if (st === 'putaranSelesai' || meja.data.menungguJoker.length) siapSemua(meja);
      if (!aksiManusia(meja, ctx.surat, 'host', new Rng(i)) && !ctx.jam.langkah()) break;
    }
    const e = ctx.surat.terakhir('host', 'emote')!;
    expect(e).toBeDefined();
    expect([1, 2]).toContain(e.kursi);
  });
});

describe('kompatibilitas aplikasi 0.1.0 (masih terpasang di HP pemain)', () => {
  // Semua bentuk pesan yang dikirim client 0.1.0 (commit 8588853, apps/client/src), persis seperti
  // sampai di server sesudah JSON.stringify (field undefined hilang). Server baru wajib menerimanya.
  const PESAN_0_1_0 = [
    '{"t":"ping"}',
    '{"t":"daftar"}',
    '{"t":"buat","nama":"Budi","pengaturan":{"jumlahPemain":4}}',
    '{"t":"gabung","kode":"ABCDE","nama":"Siti"}',
    '{"t":"gabung","kode":"ABCDE","nama":"Siti","token":"0d5c2f7e-1b8a-4c1e-9a55-3f1d2b7c9e10"}',
    '{"t":"keluar"}',
    '{"t":"aturKursi","kursi":2,"jenis":"kosong"}',
    '{"t":"aturKursi","kursi":2,"jenis":"bot"}',
    '{"t":"aturKursi","kursi":2,"jenis":"bot","level":"mudah"}',
    '{"t":"pengaturan","pengaturan":{"jumlahPemain":3}}',
    '{"t":"pengaturan","pengaturan":{"duaDeckUntukEmpat":true}}',
    '{"t":"pengaturan","pengaturan":{"batasPutaran":null}}',
    '{"t":"pengaturan","pengaturan":{"batasPutaran":10}}',
    '{"t":"pengaturan","pengaturan":{"batasSkorAtas":1000}}',
    '{"t":"pengaturan","pengaturan":{"batasSkorBawah":-500}}',
    '{"t":"pengaturan","pengaturan":{"detikGiliran":0}}',
    '{"t":"pengaturan","pengaturan":{"tempoBot":"cepat"}}',
    '{"t":"pengaturan","pengaturan":{"publik":true}}',
    '{"t":"mulai"}',
    '{"t":"mulai","pengocok":1}',
    '{"t":"putaranBerikut"}',
    '{"t":"putaranBerikut","pengocok":0}',
    '{"t":"siapJoker"}',
    '{"t":"akhiri","setuju":true}',
    '{"t":"mainLagi"}',
    '{"t":"aksi","aksi":{"jenis":"ambilDeck"}}',
    '{"t":"aksi","aksi":{"jenis":"buang","kartuId":"love-7-0"}}',
    '{"t":"aksi","aksi":{"jenis":"selesaiSusun"}}',
    '{"t":"aksi","aksi":{"jenis":"turunkan","kartuJadi":[[{"id":"love-2-0"},{"id":"love-3-0"},{"id":"waru-5-0","sebagai":{"rank":4,"bunga":"love"}}]]}}',
    '{"t":"aksi","aksi":{"jenis":"mulung","jumlah":2,"kartuJadi":[[{"id":"love-5-0"},{"id":"love-6-0"},{"id":"love-7-0"}]]}}',
  ];

  it.each(PESAN_0_1_0)('diterima: %s', (json) => {
    expect(validasiPesan(JSON.parse(json))).not.toBeNull();
  });

  it('semua emote 0.1.0 diterima (yang sudah diganti dipetakan ke padanannya)', () => {
    const DAFTAR_EMOTE_0_1_0 = ['😂', '😱', '🔥', '👏', '😤', '🙏', '😎', '🤔', 'Awas!', 'Sabar…', 'Mantap!', 'Waduh!', 'Makasih, Bos!', 'Cepetan!', 'Tutup!', 'GG'];
    for (const isi of DAFTAR_EMOTE_0_1_0) {
      const p = validasiPesan({ t: 'emote', isi });
      expect(p, isi).not.toBeNull();
      expect((DAFTAR_EMOTE as readonly string[]).includes((p as { isi: string }).isi), isi).toBe(true);
    }
  });
});

describe('validasi pesan dari jaringan', () => {
  it('menolak bentuk yang salah', () => {
    expect(validasiPesan(null)).toBeNull();
    expect(validasiPesan({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: 'x' } })).toBeNull();
    expect(validasiPesan({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1.5, kartuJadi: [[{ id: 'a' }]] } })).toBeNull();
    expect(validasiPesan({ t: 'aksi', aksi: { jenis: 'buang', kartuId: 5 } })).toBeNull();
    expect(validasiPesan({ t: 'pengaturan', pengaturan: { jumlahPemain: 9 } })).toBeNull();
    expect(validasiPesan({ t: 'hapusSemua' })).toBeNull();
  });

  it('menerima bentuk yang benar dan membuang field asing', () => {
    expect(validasiPesan({ t: 'aksi', aksi: { jenis: 'buang', kartuId: 'love-7-0', pemain: 3 } })).toEqual({
      t: 'aksi',
      aksi: { jenis: 'buang', kartuId: 'love-7-0' },
    });
    expect(
      validasiPesan({
        t: 'aksi',
        aksi: { jenis: 'turunkan', kartuJadi: [[{ id: 'a' }, { id: 'b', sebagai: { rank: 4, bunga: 'love' } }]] },
      }),
    ).toEqual({ t: 'aksi', aksi: { jenis: 'turunkan', kartuJadi: [[{ id: 'a' }, { id: 'b', sebagai: { rank: 4, bunga: 'love' } }]] } });
  });
});

describe('nama lawan (warga kedai)', () => {
  const namaKursi = (meja: Meja) => meja.data.kursi.map((k) => k.nama);

  it('daftar bawaan: unik tanpa beda huruf besar/kecil, ≤ 10 karakter termasuk spasi, utuh saat dirapikan, tanpa "bot"', () => {
    expect(new Set(NAMA_LAWAN_BAWAAN.map((n) => n.toLocaleLowerCase('id-ID'))).size).toBe(NAMA_LAWAN_BAWAAN.length);
    for (const n of NAMA_LAWAN_BAWAAN) {
      expect([...n].length, n).toBeLessThanOrEqual(10);
      // Tampil persis seperti ejaan pemilik (tanda hubung "Koki-Kun", huruf besar "Bang IT").
      expect(rapikanNama(n), n).toBe(n);
    }
    expect(NAMA_LAWAN_BAWAAN.some((n) => /bot/i.test(n))).toBe(false);
    // Label sempit di buangan (inisial/potongan) dijaga tidak kembar di apps/client/test/tataMeja.test.ts.
  });

  it('sepuluh nama lama tetap di depan dengan urutan yang sama (golden meja & latihan); nama pilihan pemilik masing-masing sekali', () => {
    expect(NAMA_LAWAN_BAWAAN.slice(0, 10)).toEqual([
      'Kipas Dua', 'Cak Kopag', 'Mbak Teras', 'Mas Sampul', 'Si Rak', 'Pak Seng', 'Dik Toska', 'Ning Sore', 'Om Garpu', 'Bu Sendok',
    ]);
    // Permintaan pemilik 14 Okt 2026, ejaan persis. "Mas Sampul" sudah ada sebelumnya.
    const pilihanPemilik = [
      'Mas Sampul', 'Cak Owner', 'Penampil', 'Koki-Kun', 'Bang IT', 'Bos Bocil', 'Jurik',
      'Bajigur', 'Pak Tani', 'Juragan', 'Ning Kukis', 'Mbak Mata', 'Om Napi',
    ];
    for (const n of pilihanPemilik) expect(NAMA_LAWAN_BAWAAN.filter((x) => x === n), n).toHaveLength(1);
  });

  it('tanpa opsi: urutan tetap NAMA_LAWAN_BAWAAN, semuanya unik', () => {
    const { meja } = mejaDenganBot(6);
    expect(namaKursi(meja)).toEqual(['Budi', ...NAMA_LAWAN_BAWAAN.slice(0, 5)]);
  });

  it('opsi namaLawan menentukan urutan (meja offline/server mengirim daftar acak)', () => {
    const ctx = siapkan({ namaLawan: ['Si Rak', 'Ning Sore', 'Om Garpu'] });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 4 });
    for (let i = 1; i < 4; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
    expect(namaKursi(meja)).toEqual(['Budi', 'Si Rak', 'Ning Sore', 'Om Garpu']);
  });

  it('latihan (urutan tetap = NAMA_LAWAN_BAWAAN): lawannya selalu sama, berapa kali pun dibuat', () => {
    const buat = () => {
      const ctx = siapkan({ namaLawan: NAMA_LAWAN_BAWAAN });
      const meja = Meja.buat(ctx.opsi, 'host', 'Pemain', { jumlahPemain: 3, levelBot: 'mudah', batasPutaran: 1 });
      for (let i = 1; i < 3; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot', level: 'mudah' });
      return namaKursi(meja);
    };
    expect(buat()).toEqual(['Pemain', 'Kipas Dua', 'Cak Kopag']);
    expect(buat()).toEqual(buat());
  });

  it('menghindari nama manusia di meja (tanpa beda huruf besar/kecil)', () => {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'kipas dua', { jumlahPemain: 3 });
    meja.masuk('p2', 'CAK KOPAG');
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    expect(namaKursi(meja)[2]).toBe('Mbak Teras');
  });

  it('nama habis: cadangan "Warga 1", "Warga 2", …', () => {
    const ctx = siapkan({ namaLawan: ['Si Rak'] });
    const meja = Meja.buat(ctx.opsi, 'host', 'Warga 1', { jumlahPemain: 4 });
    for (let i = 1; i < 4; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
    expect(namaKursi(meja)).toEqual(['Warga 1', 'Si Rak', 'Warga 2', 'Warga 3']);
  });

  it('isi daftar dirapikan seperti nama pemain; entri kosong dilewati', () => {
    const ctx = siapkan({ namaLawan: ['  ', '  Pak   Seng ', '<b>x</b>'] });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    expect(namaKursi(meja)).toEqual(['Budi', 'Pak Seng', 'bx/b']);
  });

  it('kursi warga kedai dikosongkan lalu diisi lagi: nama yang sudah lepas boleh dipakai lagi, tidak pernah dobel', () => {
    const { meja } = mejaDenganBot(4);
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'kosong' });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    const nama = namaKursi(meja);
    expect(new Set(nama).size).toBe(4);
    expect(nama[1]).toBe(NAMA_LAWAN_BAWAAN[0]);
  });

  it('manusia masuk lobi dengan nama yang sama dengan warga kedai: warga kedainya ganti nama', () => {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 4 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.masuk('p2', 'Kipas Dua');
    meja.terima('host', { t: 'aturKursi', kursi: 3, jenis: 'bot' });
    const nama = namaKursi(meja);
    expect(nama[2]).toBe('Kipas Dua');
    expect(nama[1]).not.toBe('Kipas Dua');
    expect(new Set(nama.map((n) => n.toLowerCase())).size).toBe(4);
    expect(ctx.surat.info('p2').kursi.map((k) => k.nama)).toEqual(nama);
  });

  it('nama tidak memakai opsi.acak (sumber acak celetukan): urutan acak celetukan tidak bergeser', () => {
    let dipanggil = 0;
    const ctx = siapkan({ acak: () => (dipanggil++, 0.5) });
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 6 });
    for (let i = 1; i < 6; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
    expect(dipanggil).toBe(0);
  });

  it('level warga kedai tidak tercermin di nama', () => {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 3 });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'mudah' });
    meja.terima('host', { t: 'aturKursi', kursi: 2, jenis: 'bot', level: 'normal' });
    expect(namaKursi(meja)).toEqual(['Budi', NAMA_LAWAN_BAWAAN[0], NAMA_LAWAN_BAWAAN[1]]);
  });

  it('simpanan lama dengan "Bot 1" tetap dilanjutkan apa adanya', () => {
    const { meja, opsi } = mejaDenganBot(3);
    const data = meja.data;
    data.kursi[1].nama = 'Bot 1';
    data.kursi[2].nama = 'Bot 2';
    meja.hentikan();
    const lanjut = new Meja(opsi, data);
    expect(lanjut.data.kursi.map((k) => k.nama)).toEqual(['Budi', 'Bot 1', 'Bot 2']);
    lanjut.hentikan();
  });

  it('namaLawanAcak: permutasi daftar bawaan, deterministik untuk sumber acak yang sama', () => {
    const a = namaLawanAcak(() => 0.3);
    expect([...a].sort()).toEqual([...NAMA_LAWAN_BAWAAN].sort());
    expect(namaLawanAcak(() => 0.3)).toEqual(a);
    const rng = new Rng(5);
    const b = namaLawanAcak(() => rng.next());
    expect([...b].sort()).toEqual([...NAMA_LAWAN_BAWAAN].sort());
    expect(namaLawanAcak(() => 0.999999)).toHaveLength(NAMA_LAWAN_BAWAAN.length);
  });

  it('celetukan warga kedai semuanya ada di DAFTAR_EMOTE dan lolos validasi', () => {
    for (const isi of ['Suwun, Bos!', 'Nutup, rek!', 'Kartu itu bundar, kak.', '😎', '👏', '🔥', 'GG', 'Waduh!', '😱']) {
      expect((DAFTAR_EMOTE as readonly string[]).includes(isi), isi).toBe(true);
      expect(validasiPesan({ t: 'emote', isi })).toEqual({ t: 'emote', isi });
    }
    // Emote lama (aplikasi 0.1.0) tidak lagi ada di daftar, tapi diterima sebagai padanan baru.
    expect((DAFTAR_EMOTE as readonly string[]).includes('Makasih, Bos!')).toBe(false);
    expect(validasiPesan({ t: 'emote', isi: 'Makasih, Bos!' })).toEqual({ t: 'emote', isi: 'Suwun, Bos!' });
  });
});
