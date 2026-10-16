// Keputusan #41: nutup pakai beberapa joker hidup sekaligus, lewat pesan jaringan (validasi bentuk) dan meja.

import { describe, expect, it } from 'vitest';
import { periksaInvarian, type Kartu } from '@remi/engine';
import { Meja, MAKS_KARTU_BUANG_LAIN, validasiPesan } from '../src/index.js';
import { siapkan, siapSemua } from './bantu.js';

describe('validasi pesan buang beberapa kartu', () => {
  const pesan = (aksi: unknown) => validasiPesan({ t: 'aksi', aksi });

  it('tanpa kartuIdLain: sama persis dengan buang lama', () => {
    expect(pesan({ jenis: 'buang', kartuId: 'love-7-0' })).toEqual({ t: 'aksi', aksi: { jenis: 'buang', kartuId: 'love-7-0' } });
  });

  it('daftar kosong dibuang (jadi buang satu kartu)', () => {
    const p = pesan({ jenis: 'buang', kartuId: 'love-7-0', kartuIdLain: [] });
    expect(p).toEqual({ t: 'aksi', aksi: { jenis: 'buang', kartuId: 'love-7-0' } });
    expect(p && 'kartuIdLain' in (p as { aksi: object }).aksi).toBe(false);
  });

  it('daftar id diteruskan apa adanya (sah tidaknya diputuskan engine)', () => {
    expect(pesan({ jenis: 'buang', kartuId: 'love-7-0', kartuIdLain: ['waru-7-0', 'waru-7-1'] })).toEqual({
      t: 'aksi',
      aksi: { jenis: 'buang', kartuId: 'love-7-0', kartuIdLain: ['waru-7-0', 'waru-7-1'] },
    });
    // Id dobel atau tidak dikenal tetap lolos validasi bentuk; engine yang menolak.
    expect(pesan({ jenis: 'buang', kartuId: 'love-7-0', kartuIdLain: ['love-7-0'] })).not.toBeNull();
  });

  it(`paling banyak ${MAKS_KARTU_BUANG_LAIN} kartu lain (2 deck = 8 kartu seangka joker)`, () => {
    const id = (i: number) => `x-${i}`;
    expect(pesan({ jenis: 'buang', kartuId: 'a', kartuIdLain: Array.from({ length: 7 }, (_, i) => id(i)) })).not.toBeNull();
    expect(pesan({ jenis: 'buang', kartuId: 'a', kartuIdLain: Array.from({ length: 8 }, (_, i) => id(i)) })).toBeNull();
  });

  it('bentuk salah ditolak', () => {
    for (const kartuIdLain of [null, 'love-7-0', [1], [null], [{}], ['x'.repeat(41)], { 0: 'a' }]) {
      expect(pesan({ jenis: 'buang', kartuId: 'love-7-0', kartuIdLain }), JSON.stringify(kartuIdLain)).toBeNull();
    }
    expect(pesan({ jenis: 'buang', kartuIdLain: ['love-7-0'] })).toBeNull();
  });
});

describe('meja: nutup pakai dua joker lewat pesan klien', () => {
  /**
   * Meja 2 orang (host + warga kedai). Kartu dari putaran yang sudah dibagi disusun ulang (jumlah
   * kartu tetap): host memegang dua kartu modal + dua joker hidup, buangan teratas milik warga kedai.
   */
  function siapkanMeja() {
    const ctx = siapkan();
    const meja = Meja.buat(ctx.opsi, 'host', 'Budi', { jumlahPemain: 2, detikGiliran: 0, batasPutaran: null });
    meja.terima('host', { t: 'aturKursi', kursi: 1, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const data = meja.data;
    meja.hentikan();
    const g = data.game!;
    const p = g.putaran!;
    const r = p.rankJoker;
    const seri = r >= 2 && r <= 4 ? [8, 9, 10] : [2, 3, 4];
    const kolam: Kartu[] = [...p.tangan.flat(), ...p.deck, ...p.buangan.map((e) => e.kartu)];
    const ambil = (cocok: (k: Kartu) => boolean): Kartu => kolam.splice(kolam.findIndex(cocok), 1)[0];
    const modal = seri.map((q) => ambil((k) => k.bunga === 'love' && k.rank === q));
    const joker = [ambil((k) => k.rank === r), ambil((k) => k.rank === r)];
    p.tangan = [[modal[0], modal[1], ...joker], kolam.splice(0, 6)];
    p.buangan = [{ kartu: modal[2], pemilik: 1 }];
    p.deck = kolam;
    p.giliran = 0;
    p.tahap = 'ambil';
    p.sumberAmbil = null;
    p.jokerMati = [];
    expect(periksaInvarian(g)).toEqual([]);
    const lanjut = new Meja(ctx.opsi, data);
    lanjut.terhubung('host');
    return { ...ctx, meja: lanjut, modal, joker };
  }

  it('mulung lalu buang dua joker: mentung 500, kepentung −500, tanpa galat', () => {
    const { meja, surat, jam, modal, joker } = siapkanMeja();
    const kirim = (json: string) => meja.terima('host', validasiPesan(JSON.parse(json))!);
    kirim(JSON.stringify({ t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [modal.map((k) => ({ id: k.id }))] } }));
    kirim(JSON.stringify({ t: 'aksi', aksi: { jenis: 'buang', kartuId: joker[0].id, kartuIdLain: [joker[1].id] } }));
    expect(surat.errors('host')).toEqual([]);
    const g = meja.data.game!;
    expect(g.status).toBe('susunAkhir');
    expect(g.putaran!.mentung).toMatchObject({ pemain: 0, pentunganJoker: true, kepentung: [1] });
    expect(g.putaran!.mentung!.pentunganLain!.map((k) => k.id)).toEqual([joker[1].id]);
    // View host dan peristiwanya: satu buang dengan kartuLain, lalu mentung bernilai 500.
    const v = surat.view('host');
    const buang = v.peristiwa.filter((e) => e.jenis === 'buang');
    expect(buang.at(-1)).toMatchObject({ kartu: { id: joker[0].id }, kartuLain: [{ id: joker[1].id }], sisaTangan: 0 });
    expect(v.peristiwa.find((e) => e.jenis === 'mentung')).toMatchObject({ nilai: 500 });

    // Warga kedai menyelesaikan susun akhir; host sudah otomatis selesai (tangannya kosong).
    for (let i = 0; i < 20 && meja.data.game!.status === 'susunAkhir'; i++) jam.langkah();
    const h = meja.data.game!.riwayat.at(-1)!;
    expect(h.nilaiPentungan).toBe(500);
    expect(h.rincian[0]).toMatchObject({ status: 'mentung', nilaiPentungan: 500, penaltiJoker: 0 });
    expect(h.rincian[1]).toMatchObject({ status: 'kepentung', nilaiPentungan: -500 });
    expect(surat.errors('host')).toEqual([]);
  });

  it('pesan buang beberapa kartu yang melanggar aturan dijawab galat, meja tetap jalan', () => {
    const { meja, surat, modal, joker } = siapkanMeja();
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'mulung', jumlah: 1, kartuJadi: [modal.map((k) => ({ id: k.id }))] } });
    const sebelum = JSON.stringify(meja.data.game);
    meja.terima('host', { t: 'aksi', aksi: { jenis: 'buang', kartuId: joker[0].id, kartuIdLain: [joker[0].id] } });
    expect(surat.errors('host').at(-1)).toMatch(/kepilih dua kali/);
    expect(JSON.stringify(meja.data.game)).toBe(sebelum);
  });
});
