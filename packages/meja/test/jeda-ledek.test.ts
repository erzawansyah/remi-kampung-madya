// Meja online sesudah putaran selesai (keputusan pemilik, 24 Okt 2026):
// - jeda lanjut: host baru bisa memulai putaran berikutnya sesudah jedaLanjutMs, atau begitu semua
//   manusia lain yang terhubung menekan Siap; dihitung ulang saat ada yang terputus/keluar/kembali;
//   timer menyiarkan ulang info saat jedanya habis; voting akhiri dan kaldu tetap jalan; klasemen
//   akhir dan meja tanpa jedaLanjutMs tidak berubah;
// - ledekan: hanya di hasil putaran, ke kursi manusia lain, isi dari daftar, batas 1,2 detik bersama
//   emote dan paling banyak MAKS_LEDEK_PER_PUTARAN per kursi per putaran, dikirim ke semua manusia.

import { describe, expect, it } from 'vitest';
import { Rng } from '@remi/engine';
import {
  DAFTAR_EMOTE,
  DAFTAR_LEDEKAN,
  EMOTE_LAMA,
  JEDA_LANJUT_MS,
  MAKS_LEDEK_PER_PUTARAN,
  MAKS_PESAN,
  Meja,
  isiLedek,
  validasiPesan,
  type PengaturanMeja,
  type PesanServer,
} from '../src/index.js';
import { aksiManusia, siapkan, siapSemua } from './bantu.js';

type Ctx = ReturnType<typeof siapkan> & { meja: Meja };

/**
 * Meja 3 kursi: Ani (host, kursi 0), Budi (kursi 1), satu warga kedai (kursi 2). Nama warga kedai di
 * luar daftar persona, supaya panjang permainan tidak ikut bergeser kalau gaya disetel ulang.
 */
function mejaAniBudi(pengaturan: Partial<PengaturanMeja> = {}, jedaLanjutMs: number | undefined = JEDA_LANJUT_MS): Ctx {
  const ctx = siapkan({ jedaLanjutMs, namaLawan: ['Warga A'] });
  const meja = Meja.buat(ctx.opsi, 'ani', 'Ani', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: null, ...pengaturan });
  meja.masuk('budi', 'Budi');
  meja.terima('ani', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
  return { ...ctx, meja };
}

/** Mainkan putaran yang sedang berjalan sampai selesai (manusia dimainkan bot normal). */
function selesaikanPutaran(ctx: Ctx, rng = new Rng(9)): void {
  const { meja, jam, surat } = ctx;
  for (let i = 0; i < 5000; i++) {
    const st = meja.data.game?.status;
    if (st !== 'putaranBerjalan' && st !== 'susunAkhir') return;
    if (['ani', 'budi'].some((p) => aksiManusia(meja, surat, p, rng))) continue;
    if (!jam.langkah()) throw new Error('macet: tidak ada timer dan bukan giliran manusia');
  }
  throw new Error('putaran tidak selesai');
}

/** Mulai permainan lalu mainkan putaran pertama sampai hasilnya tampil. */
function sampaiHasilPutaran(pengaturan: Partial<PengaturanMeja> = {}, jedaLanjutMs?: number): Ctx {
  const ctx = mejaAniBudi(pengaturan, jedaLanjutMs);
  ctx.meja.terima('ani', { t: 'mulai', pengocok: 0 });
  siapSemua(ctx.meja);
  selesaikanPutaran(ctx);
  expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
  return ctx;
}

const lanjut = (ctx: Ctx, pemainId = 'ani') => ctx.surat.info(pemainId).lanjut;
const ledekan = (ctx: Ctx, pemainId: string) =>
  ctx.surat.semua(pemainId).filter((p): p is Extract<PesanServer, { t: 'ledek' }> => p.t === 'ledek');

describe('jeda lanjut sesudah putaran selesai', () => {
  it('host dikunci 10 detik: putaranBerikut ditolak dengan pesan ramah, info membawa sisa waktu relatif', () => {
    const ctx = sampaiHasilPutaran();
    expect(lanjut(ctx)).toEqual({ sisaMs: JEDA_LANJUT_MS, siap: [] });
    expect(lanjut(ctx, 'budi')).toEqual({ sisaMs: JEDA_LANJUT_MS, siap: [] });
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.surat.errors('ani').at(-1)).toBe('Tunggu sebentar, yang lain masih lihat kartu.');
    expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
    // Bukan host tetap ditolak seperti biasa.
    ctx.meja.terima('budi', { t: 'putaranBerikut' });
    expect(ctx.surat.errors('budi').at(-1)).toBe('Cuma host yang bisa melakukan ini.');
    // Sisa waktu dihitung saat pesan dikirim (relatif, bukan jam dinding).
    ctx.jam.maju(3000);
    ctx.meja.terima('budi', { t: 'akhiri', setuju: true });
    expect(lanjut(ctx)).toEqual({ sisaMs: JEDA_LANJUT_MS - 3000, siap: [] });
  });

  it('semua manusia lain menekan Siap: host langsung bisa lanjut', () => {
    const ctx = sampaiHasilPutaran();
    ctx.jam.maju(2000);
    ctx.meja.terima('budi', { t: 'siapLanjut' });
    // Satu-satunya yang ditunggu sudah siap: tidak terkunci lagi, field-nya hilang dari info.
    expect(lanjut(ctx)).toBeUndefined();
    expect(lanjut(ctx, 'budi')).toBeUndefined();
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.surat.errors('ani')).toEqual([]);
    expect(ctx.meja.data.game!.status).toBe('putaranBerjalan');
  });

  it('Siap dihitung per kursi; yang belum siap disebut lewat daftar siap', () => {
    const ctx = mejaAniBudi({ jumlahPemain: 4 });
    expect(ctx.meja.masuk('citra', 'Citra')).toBe(3);
    ctx.meja.terima('ani', { t: 'mulai', pengocok: 0 });
    siapSemua(ctx.meja);
    const rng = new Rng(3);
    for (let i = 0; i < 5000 && ctx.meja.data.game!.status !== 'putaranSelesai'; i++) {
      if (['ani', 'budi', 'citra'].some((p) => aksiManusia(ctx.meja, ctx.surat, p, rng))) continue;
      if (!ctx.jam.langkah()) throw new Error('macet');
    }
    expect(lanjut(ctx)!.siap).toEqual([]);
    ctx.meja.terima('citra', { t: 'siapLanjut' });
    expect(lanjut(ctx)!.siap).toEqual([3]);
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.surat.errors('ani').at(-1)).toContain('Tunggu sebentar');
    ctx.meja.terima('budi', { t: 'siapLanjut' });
    expect(lanjut(ctx)).toBeUndefined();
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.meja.data.game!.status).toBe('putaranBerjalan');
  });

  it('Siap ganda, Siap dari host, dan Siap sesudah jeda habis tidak menyiarkan apa-apa', () => {
    const ctx = sampaiHasilPutaran();
    const jumlahPesan = () => ctx.surat.semua('ani').length;
    let n = jumlahPesan();
    ctx.meja.terima('ani', { t: 'siapLanjut' });
    expect(jumlahPesan()).toBe(n);
    expect(lanjut(ctx)).toEqual({ sisaMs: JEDA_LANJUT_MS, siap: [] });
    ctx.jam.maju(JEDA_LANJUT_MS);
    n = jumlahPesan();
    ctx.meja.terima('budi', { t: 'siapLanjut' });
    expect(jumlahPesan()).toBe(n);
    expect(ctx.surat.errors('budi')).toEqual([]);
  });

  it('jeda habis: timer meja menyiarkan ulang info tanpa kunci, lalu host bisa lanjut', () => {
    const ctx = sampaiHasilPutaran();
    ctx.jam.maju(JEDA_LANJUT_MS - 1);
    expect(lanjut(ctx)).toBeDefined();
    const n = ctx.surat.semua('budi').length;
    ctx.jam.maju(1);
    // Disiarkan tepat saat jeda habis, ke semua manusia (tidak menunggu ada pesan lain).
    expect(ctx.surat.semua('budi').length).toBeGreaterThan(n);
    expect(lanjut(ctx)).toBeUndefined();
    expect(lanjut(ctx, 'budi')).toBeUndefined();
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.surat.errors('ani')).toEqual([]);
    expect(ctx.meja.data.game!.status).toBe('putaranBerjalan');
  });

  it('yang ditunggu terputus atau keluar: tidak ditunggu lagi (dihitung ulang)', () => {
    const putus = sampaiHasilPutaran();
    putus.meja.terputus('budi');
    expect(lanjut(putus)).toBeUndefined();
    putus.meja.terima('ani', { t: 'putaranBerikut' });
    expect(putus.meja.data.game!.status).toBe('putaranBerjalan');

    const keluar = sampaiHasilPutaran();
    keluar.meja.terima('budi', { t: 'keluar' });
    expect(lanjut(keluar)).toBeUndefined();
    keluar.meja.terima('ani', { t: 'putaranBerikut' });
    expect(keluar.meja.data.game!.status).toBe('putaranBerjalan');
  });

  it('yang terputus kembali sebelum jeda habis dan belum Siap: ditunggu lagi sisa waktunya', () => {
    const ctx = sampaiHasilPutaran();
    ctx.meja.terputus('budi');
    expect(lanjut(ctx)).toBeUndefined();
    ctx.jam.maju(4000);
    ctx.meja.terhubung('budi');
    expect(lanjut(ctx)).toEqual({ sisaMs: JEDA_LANJUT_MS - 4000, siap: [] });
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.surat.errors('ani').at(-1)).toContain('Tunggu sebentar');
  });

  it('host terputus: host pindah ke Budi, tidak ada manusia lain yang ditunggu', () => {
    const ctx = sampaiHasilPutaran();
    ctx.meja.terputus('ani');
    expect(ctx.surat.info('budi').host).toBe(1);
    expect(lanjut(ctx, 'budi')).toBeUndefined();
    ctx.meja.terima('budi', { t: 'putaranBerikut' });
    expect(ctx.meja.data.game!.status).toBe('putaranBerjalan');
  });

  it('meja tanpa manusia lain (host + warga kedai): tidak ada jeda', () => {
    const ctx = siapkan({ jedaLanjutMs: JEDA_LANJUT_MS, namaLawan: ['Warga A', 'Warga B'] });
    const meja = Meja.buat(ctx.opsi, 'ani', 'Ani', { jumlahPemain: 3, detikGiliran: 0, batasPutaran: null });
    meja.terima('ani', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('ani', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    meja.terima('ani', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const rng = new Rng(5);
    for (let i = 0; i < 5000 && meja.data.game!.status !== 'putaranSelesai'; i++) {
      if (aksiManusia(meja, ctx.surat, 'ani', rng)) continue;
      if (!ctx.jam.langkah()) throw new Error('macet');
    }
    expect(ctx.surat.info('ani').lanjut).toBeUndefined();
    meja.terima('ani', { t: 'putaranBerikut' });
    expect(meja.data.game!.status).toBe('putaranBerjalan');
  });

  it('voting akhiri dan putaran terakhir (kaldu) tetap jalan selama terkunci', () => {
    const akhiri = sampaiHasilPutaran();
    akhiri.meja.terima('ani', { t: 'akhiri', setuju: true });
    akhiri.meja.terima('budi', { t: 'akhiri', setuju: true });
    expect(akhiri.meja.status).toBe('selesai');
    // Klasemen akhir tidak dijeda.
    expect(lanjut(akhiri)).toBeUndefined();

    const kaldu = sampaiHasilPutaran({ modeKaldu: true });
    kaldu.meja.terima('ani', { t: 'putaranTerakhir', setuju: true });
    kaldu.meja.terima('budi', { t: 'putaranTerakhir', setuju: true });
    expect(kaldu.meja.data.game!.kalduDiminta).toBe(true);
    // Voting kaldu tidak membuka kunci: yang lain tetap boleh lihat kartu dulu.
    expect(lanjut(kaldu)).toBeDefined();
    kaldu.meja.terima('budi', { t: 'siapLanjut' });
    kaldu.meja.terima('ani', { t: 'putaranBerikut' });
    expect(kaldu.meja.data.game!.putaran!.kaldu).toBe(true);
  });

  it('permainan yang langsung selesai (batas putaran) tidak dijeda; main lagi tetap bisa', () => {
    const ctx = mejaAniBudi({ batasPutaran: 1 });
    ctx.meja.terima('ani', { t: 'mulai', pengocok: 0 });
    siapSemua(ctx.meja);
    selesaikanPutaran(ctx);
    expect(ctx.meja.status).toBe('selesai');
    expect(lanjut(ctx)).toBeUndefined();
    ctx.meja.terima('ani', { t: 'mainLagi' });
    expect(ctx.meja.status).toBe('lobi');
  });

  it('putaran berikutnya dijeda lagi dari awal', () => {
    const ctx = sampaiHasilPutaran();
    ctx.meja.terima('budi', { t: 'siapLanjut' });
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    siapSemua(ctx.meja);
    expect(lanjut(ctx)).toBeUndefined();
    selesaikanPutaran(ctx, new Rng(11));
    expect(ctx.meja.data.game!.status).toBe('putaranSelesai');
    // Siap putaran lalu tidak terbawa.
    expect(lanjut(ctx)).toEqual({ sisaMs: JEDA_LANJUT_MS, siap: [] });
  });

  it('tanpa jedaLanjutMs (meja offline, test, golden): tidak ada kunci, field, maupun timer tambahan', () => {
    const ctx = sampaiHasilPutaran({}, 0);
    expect(lanjut(ctx)).toBeUndefined();
    expect('lanjut' in ctx.surat.info('ani')).toBe(false);
    // Celetukan warga kedai yang mungkin masih terjadwal dibiarkan lewat dulu.
    ctx.jam.maju(5000);
    expect(ctx.jam.jumlahTimer).toBe(0);
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    expect(ctx.meja.data.game!.status).toBe('putaranBerjalan');

    const bawaan = siapkan();
    expect(bawaan.opsi.jedaLanjutMs).toBeUndefined();
  });

  it('jeda lanjut tidak ikut disimpan di data meja', () => {
    const ctx = sampaiHasilPutaran();
    expect(JSON.stringify(ctx.meja.data)).not.toMatch(/lanjut/i);
  });
});

describe('ledekan di hasil putaran', () => {
  it('Ani ngeledek Budi: sampai ke semua manusia (dari, ke, isi); Budi boleh membalas', () => {
    const ctx = sampaiHasilPutaran();
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Makan tuh!' });
    const pesan = { t: 'ledek', dari: 0, ke: 1, isi: 'Makan tuh!' };
    expect(ledekan(ctx, 'ani')).toEqual([pesan]);
    expect(ledekan(ctx, 'budi')).toEqual([pesan]);
    ctx.jam.maju(1200);
    ctx.meja.terima('budi', { t: 'ledek', ke: 0, isi: '😤' });
    expect(ledekan(ctx, 'ani').at(-1)).toEqual({ t: 'ledek', dari: 1, ke: 0, isi: '😤' });
    expect(ctx.surat.errors('ani')).toEqual([]);
    expect(ctx.surat.errors('budi')).toEqual([]);
  });

  it('hanya saat hasil putaran tampil', () => {
    const ctx = mejaAniBudi();
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Rasain!' });
    expect(ctx.surat.errors('ani').at(-1)).toBe('Ngeledeknya pas hasil putaran aja, Bos.');
    ctx.meja.terima('ani', { t: 'mulai', pengocok: 0 });
    siapSemua(ctx.meja);
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Rasain!' });
    expect(ctx.surat.errors('ani').at(-1)).toBe('Ngeledeknya pas hasil putaran aja, Bos.');
    selesaikanPutaran(ctx);
    ctx.meja.terima('ani', { t: 'akhiri', setuju: true });
    ctx.meja.terima('budi', { t: 'akhiri', setuju: true });
    expect(ctx.meja.status).toBe('selesai');
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Rasain!' });
    expect(ctx.surat.errors('ani').at(-1)).toBe('Ngeledeknya pas hasil putaran aja, Bos.');
    expect(ledekan(ctx, 'budi')).toEqual([]);
  });

  it('sasaran harus kursi manusia lain; isi harus dari daftar', () => {
    const ctx = sampaiHasilPutaran();
    for (const ke of [0, 2, 3, -1, 1.5]) {
      ctx.meja.terima('ani', { t: 'ledek', ke, isi: 'Rasain!' });
      expect(ctx.surat.errors('ani').at(-1), String(ke)).toBe('Yang mau diledek nggak ada di meja.');
    }
    // Meja dipanggil langsung tanpa validasi jaringan (offline): teks bebas tetap ditolak.
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'teks bebas' });
    expect(ctx.surat.errors('ani').at(-1)).toBe('Ledekannya nggak ada di daftar, Bos.');
    expect(ledekan(ctx, 'budi')).toEqual([]);
    // Emote versi lama dipetakan ke padanannya.
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Tutup!' });
    expect(ledekan(ctx, 'budi')).toEqual([{ t: 'ledek', dari: 0, ke: 1, isi: 'Nutup, rek!' }]);
  });

  it('ikut batas 1,2 detik bersama emote (dibuang diam-diam), dan paling banyak 12 per kursi per putaran', () => {
    const ctx = sampaiHasilPutaran();
    ctx.meja.terima('ani', { t: 'emote', isi: '😂' });
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Rasain!' });
    expect(ledekan(ctx, 'budi')).toEqual([]);
    expect(ctx.surat.errors('ani')).toEqual([]);
    for (let i = 0; i < MAKS_LEDEK_PER_PUTARAN; i++) {
      ctx.jam.maju(1200);
      ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: DAFTAR_LEDEKAN[i % DAFTAR_LEDEKAN.length] });
    }
    expect(ledekan(ctx, 'budi')).toHaveLength(MAKS_LEDEK_PER_PUTARAN);
    ctx.jam.maju(1200);
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Rasain!' });
    expect(ctx.surat.errors('ani').at(-1)).toBe('Udah, cukup ngeledeknya, Bos.');
    expect(ledekan(ctx, 'budi')).toHaveLength(MAKS_LEDEK_PER_PUTARAN);
    // Kursi lain punya jatahnya sendiri.
    ctx.meja.terima('budi', { t: 'ledek', ke: 0, isi: 'Rasain!' });
    expect(ledekan(ctx, 'ani').at(-1)).toEqual({ t: 'ledek', dari: 1, ke: 0, isi: 'Rasain!' });
    // Putaran berikutnya: jatah baru.
    ctx.meja.terima('budi', { t: 'siapLanjut' });
    ctx.meja.terima('ani', { t: 'putaranBerikut' });
    siapSemua(ctx.meja);
    selesaikanPutaran(ctx, new Rng(11));
    ctx.jam.maju(1200);
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Kok bisa, Bos?' });
    expect(ledekan(ctx, 'budi').at(-1)).toEqual({ t: 'ledek', dari: 0, ke: 1, isi: 'Kok bisa, Bos?' });
  });

  it('ledekan tidak dikirim ke yang terputus; warga kedai tidak pernah ngeledek', () => {
    const ctx = sampaiHasilPutaran();
    ctx.meja.terputus('budi');
    const sebelum = ctx.surat.semua('budi').length;
    ctx.meja.terima('ani', { t: 'ledek', ke: 1, isi: 'Pulang aja, Bos.' });
    expect(ctx.surat.semua('budi').length).toBe(sebelum);
    expect(ledekan(ctx, 'ani')).toEqual([{ t: 'ledek', dari: 0, ke: 1, isi: 'Pulang aja, Bos.' }]);
    // Sepanjang permainan (termasuk celetukan warga kedai) tidak ada ledekan selain yang dikirim Ani.
    ctx.jam.maju(60_000);
    expect(ledekan(ctx, 'ani').every((p) => p.dari === 0)).toBe(true);
  });
});

describe('validasi pesan jeda lanjut dan ledekan', () => {
  it('siapLanjut: tanpa field; field asing dibuang', () => {
    expect(validasiPesan({ t: 'siapLanjut' })).toEqual({ t: 'siapLanjut' });
    expect(validasiPesan({ t: 'siapLanjut', kursi: 3 })).toEqual({ t: 'siapLanjut' });
  });

  it('ledek: kursi 0..5 dan isi dari DAFTAR_LEDEKAN / DAFTAR_EMOTE; teks bebas ditolak', () => {
    expect(validasiPesan({ t: 'ledek', ke: 1, isi: 'Kepentung, rek!' })).toEqual({ t: 'ledek', ke: 1, isi: 'Kepentung, rek!' });
    expect(validasiPesan({ t: 'ledek', ke: 5, isi: '😂', dari: 3 })).toEqual({ t: 'ledek', ke: 5, isi: '😂' });
    expect(validasiPesan({ t: 'ledek', ke: 0, isi: 'Makasih, Bos!' })).toEqual({ t: 'ledek', ke: 0, isi: 'Suwun, Bos!' });
    for (const ke of [-1, 6, 1.5, '1', null, undefined]) {
      expect(validasiPesan({ t: 'ledek', ke, isi: 'Rasain!' }), String(ke)).toBeNull();
    }
    for (const isi of ['', 'rasain!', 'Rasain! ', 'teks bebas', '__proto__', 'constructor', 5, null, ['Rasain!']]) {
      expect(validasiPesan({ t: 'ledek', ke: 1, isi }), JSON.stringify(isi)).toBeNull();
    }
  });

  it('isiLedek: semua daftar diterima apa adanya, emote lama dipetakan', () => {
    for (const isi of [...DAFTAR_LEDEKAN, ...DAFTAR_EMOTE]) expect(isiLedek(isi)).toBe(isi);
    for (const [lama, baru] of EMOTE_LAMA) expect(isiLedek(lama)).toBe(baru);
  });

  it('DAFTAR_LEDEKAN: unik, tidak kembar dengan emote, muat di gelembung', () => {
    expect(new Set(DAFTAR_LEDEKAN).size).toBe(DAFTAR_LEDEKAN.length);
    for (const isi of DAFTAR_LEDEKAN) {
      expect((DAFTAR_EMOTE as readonly string[]).includes(isi), isi).toBe(false);
      expect([...isi].length).toBeLessThanOrEqual(MAKS_PESAN);
    }
  });
});
