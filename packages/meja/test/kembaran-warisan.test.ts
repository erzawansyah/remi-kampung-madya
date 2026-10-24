// Keputusan #53: simpanan offline dari sebelum aturan ini bisa berhenti tepat saat kartu terakhir di tangan
// warga kedai yang sedang giliran adalah kembaran kartu pungutannya (dulu sah: turunkan dulu, lalu mentung
// pakai kembarannya). Dengan aturan baru state itu tidak punya aksi sah, dan meja dulu mengulang langkah
// warga kedai itu dengan jeda 2–60 detik tanpa ujung. migrasiState menandai giliran itu supaya ditutup
// dengan aturan lama.

import { describe, expect, it } from 'vitest';
import { periksaInvarian, validasiKartuJadi, type Kartu, type KartuJadi } from '@remi/engine';
import { Meja } from '../src/index.js';
import { siapkan, siapSemua } from './bantu.js';

describe('#53: simpanan lama dengan kartu terakhir kembaran pungutan', () => {
  /**
   * Meja 4 orang 2 deck: Ani (host, kursi 0), Budi (warga kedai, kursi 1, sedang giliran), dua warga lain.
   * Kartu dari putaran yang sudah dibagi disusun ulang (jumlah kartu tetap) menjadi state aturan lama:
   * Budi mungut X Love deck kedua milik Ani untuk (X−1)-X-(X+1) Love, sudah menurunkan seri Wajik, dan
   * tinggal memegang X Love deck pertama.
   */
  function siapkanMeja() {
    const galat: string[] = [];
    const ctx = siapkan({ saatGalat: (konteks) => galat.push(konteks), namaLawan: ['Warga A', 'Warga B', 'Warga C'] });
    const meja = Meja.buat(ctx.opsi, 'host', 'Ani', { jumlahPemain: 4, duaDeckUntukEmpat: true, detikGiliran: 0, batasPutaran: null });
    for (let i = 1; i < 4; i++) meja.terima('host', { t: 'aturKursi', kursi: i, jenis: 'bot' });
    meja.terima('host', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    const data = meja.data;
    meja.hentikan();
    const g = data.game!;
    const p = g.putaran!;
    const r = p.rankJoker;
    // Angka seri yang tidak menyentuh angka joker (supaya semua kartu di bawah kartu biasa).
    const x = [4, 5, 6, 7, 8, 9].find((q) => Math.abs(q - r) > 1)!;
    const y = [3, 4, 5, 6, 7, 8, 9].find((q) => Math.abs(q - r) > 1 && Math.abs(q - x) > 0)!;
    const kolam: Kartu[] = [
      ...p.tangan.flat(),
      ...p.deck,
      ...p.buangan.map((e) => e.kartu),
      ...p.kartuJadi.flat().flatMap((kj) => kj.kartu.map((d) => d.kartu)),
    ];
    const ambil = (cocok: (k: Kartu) => boolean): Kartu => kolam.splice(kolam.findIndex(cocok), 1)[0];
    const love = (q: number, deck: number) => ambil((k) => k.bunga === 'love' && k.rank === q && k.deck === deck);
    const [l1, lx, l2] = [love(x - 1, 0), love(x, 0), love(x + 1, 0)];
    const lxAni = love(x, 1);
    const wajik = [y - 1, y, y + 1].map((q) => ambil((k) => k.bunga === 'wajik' && k.rank === q && k.rank !== r));
    const ctxJoker = { rankJoker: r, jokerMati: [] };
    const jadi = (id: string, kartu: Kartu[]): KartuJadi => {
      const h = validasiKartuJadi(
        kartu.map((k) => ({ kartu: k })),
        ctxJoker,
      );
      return { id, pemilik: 1, jenis: h.jenis, kartu: h.kartu.map((d) => (d.kartu.id === lxAni.id ? { ...d, dari: 0 } : d)) };
    };
    p.tangan = [kolam.splice(0, 9), [lx], kolam.splice(0, 9), kolam.splice(0, 9)];
    p.kartuJadi = [[], [jadi('kj1', [l1, lxAni, l2]), jadi('kj2', wajik)], [], []];
    p.urutanKartuJadi = 2;
    p.buangan = [{ kartu: kolam.shift()!, pemilik: 3 }];
    p.deck = kolam;
    p.giliran = 1;
    p.tahap = 'main';
    p.sumberAmbil = 'buangan';
    p.pungutan = [{ kartu: lxAni, pemilik: 0 }];
    p.asalKartu = { [lxAni.id]: 0 };
    p.jokerMati = [];
    expect(periksaInvarian(g)).toEqual([]);
    return { ...ctx, data, galat, lx };
  }

  it('warga kedai yang sedang giliran menutupnya dengan mentung seperti dulu, tanpa galat; Ani kepentung', () => {
    const { opsi, jam, data, galat, lx, surat } = siapkanMeja();
    const meja = new Meja(opsi, data);
    meja.terhubung('host');
    expect(meja.data.game!.putaran!.kembaranWarisan).toBe(true);
    // View Ani (bukan yang giliran) tidak memuat penanda: isinya akan membocorkan kartu terakhir Budi.
    expect(JSON.stringify(surat.view('host'))).not.toContain('kembaranWarisan');
    for (let i = 0; i < 10 && meja.data.game!.status === 'putaranBerjalan'; i++) jam.langkah();
    expect(galat).toEqual([]);
    const p = meja.data.game!.putaran!;
    expect(p.mentung).toMatchObject({ pemain: 1, pentungan: { id: lx.id }, kepentung: [0] });
    expect(p).not.toHaveProperty('kembaranWarisan');
    meja.hentikan();
  });
});
