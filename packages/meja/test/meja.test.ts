import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import { Meja, validasiPesan, type DataMeja, type RingkasanAkhir } from '../src/index.js';
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
    expect(surat.info('host').kursi[1]).toMatchObject({ jenis: 'bot', nama: 'Bot 1', level: 'mudah' });
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

  it('emote di luar daftar ditolak validasi', () => {
    expect(validasiPesan({ t: 'emote', isi: 'kartuku joker 7' })).toBeNull();
    expect(validasiPesan({ t: 'emote', isi: 'Waduh!' })).toEqual({ t: 'emote', isi: 'Waduh!' });
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
