// Konten Bantuan harus sama dengan mesin aturan. Setiap blok 'contoh' di konten/bantuan.ts diuji
// dengan validator engine yang sesuai (validasiKartuJadi / validasiTurunkan / validasiMulung /
// validasiBuang), dan hasilnya wajib sama dengan field `sah`. Klaim angka kunci di teks (maksimal
// mulung, batas seri, mentung, penalti dan nilai pentungan joker) juga dicocokkan dengan engine.
// Kalau test ini gagal: yang salah kontennya atau engine-nya, jangan "dibetulkan" dengan mengubah test.

import { describe, expect, it } from 'vitest';
import {
  AturanError,
  bukaKartuJoker,
  hitungSkorPemain,
  maksimalMulung,
  Rng,
  NILAI_PENTUNGAN_JOKER,
  nilaiPentungan,
  nilaiPentunganTotal,
  PENALTI_JOKER_DIBUANG,
  PENGALI_KALDU,
  validasiBuang,
  validasiKartuJadi,
  validasiMulung,
  validasiTurunkan,
  type Bunga,
  type Kartu,
  type KonteksJoker,
  type PilihanKartu,
  type Rank,
} from '@remi/engine';
import { BAB_BANTUAN, FAQ, GLOSARIUM, type KartuContoh } from '../src/konten/bantuan';

type Contoh = { bab: string; judul: string; kartu: KartuContoh[]; ket: string; sah: boolean };

const SEMUA_CONTOH: Contoh[] = BAB_BANTUAN.flatMap((b) =>
  b.isi.flatMap((x) => (x.t === 'contoh' ? [{ bab: b.id, judul: x.judul, kartu: x.kartu, ket: x.ket, sah: x.sah }] : [])),
);

/** Pembuat kartu ber-id unik: kartu kembar (2 deck) dapat nomor deck berbeda. */
function pembuatKartu() {
  const hitung = new Map<string, number>();
  return (c: { bunga: Bunga; rank: Rank }): Kartu => {
    const kunci = `${c.bunga}-${c.rank}`;
    const d = hitung.get(kunci) ?? 0;
    hitung.set(kunci, d + 1);
    return { id: `${kunci}-${d}`, bunga: c.bunga, rank: c.rank, deck: d };
  };
}

/** Pengisi tangan supaya syarat sisa kartu tidak ikut menentukan hasil contoh. */
const PENGISI: Kartu = { id: 'pengisi', bunga: 'kriting', rank: 13, deck: 0 };

/** Hasil validator: lolos, atau kode AturanError. Error lain (bug) dilempar terus. */
function cek(f: () => unknown): { ok: boolean; kode?: string } {
  try {
    f();
    return { ok: true };
  } catch (e) {
    if (e instanceof AturanError) return { ok: false, kode: e.kode };
    throw e;
  }
}

/** Angka joker dari teks "joker putaran ini N"; kalau tidak disebut, angka yang tidak ada di contoh. */
function rankJokerDari(c: Contoh): Rank {
  const m = /joker putaran ini (\d+)/.exec(c.ket);
  if (m) return Number(m[1]) as Rank;
  for (const r of [2, 3, 4, 5, 6, 7, 8, 9, 10] as Rank[]) if (!c.kartu.some((k) => k.rank === r)) return r;
  return 12 as Rank;
}

/** Bunga seri: bunga kartu bukan pengganti pertama (joker pengganti ikut bunga seri). */
const bungaSeri = (c: Contoh): Bunga => (c.kartu.find((k) => k.peran === undefined) ?? c.kartu[0]).bunga;

/** Jenis validator untuk tiap contoh. Contoh baru di bab giliran/mulung wajib dikenali di sini. */
type Jenis = 'kartuJadi' | 'turunkan3As' | 'nutupHabisDeck' | 'buangAs' | 'mulung';
function jenisContoh(c: Contoh): Jenis {
  if (c.bab === 'mulung') return 'mulung';
  if (/3 As/.test(c.judul)) return 'turunkan3As';
  if (/habis ambil deck/i.test(c.judul)) return 'nutupHabisDeck';
  if (/Buang As/.test(c.judul)) return 'buangAs';
  if (c.bab === 'giliran') throw new Error(`Contoh "${c.judul}" di bab giliran belum punya validator di test ini.`);
  return 'kartuJadi';
}

// Bab Mulung memakai satu skenario bersama (dicek juga bahwa teks bab menyebutnya persis begitu).
const KALIMAT_SKENARIO_MULUNG = 'Buangan dari bawah ke atas: **3 Wajik, K Kriting, 5 Wajik**';

function ujiContoh(c: Contoh): { ok: boolean; kode?: string } {
  const kartu = pembuatKartu();
  const ks = c.kartu.map(kartu);
  const ctx: KonteksJoker = { rankJoker: rankJokerDari(c), jokerMati: [] };
  if (/sudah mati/.test(c.judul)) ctx.jokerMati = ks.filter((_, i) => c.kartu[i].peran !== undefined).map((k) => k.id);
  const bunga = bungaSeri(c);
  const pilihan = (k: Kartu, i: number): PilihanKartu =>
    c.kartu[i].peran !== undefined ? { id: k.id, sebagai: { rank: c.kartu[i].peran!, bunga } } : { id: k.id };

  switch (jenisContoh(c)) {
    case 'kartuJadi':
      return cek(() => validasiKartuJadi(ks.map((k, i) => ({ kartu: k, sebagai: pilihan(k, i).sebagai })), ctx));
    case 'turunkan3As': {
      const as = ks.filter((k) => k.rank === 1);
      const lain = ks.filter((k) => k.rank !== 1);
      const spesifikasi = [as.map((k) => ({ id: k.id })), ...(lain.length ? [lain.map((k) => ({ id: k.id }))] : [])];
      return cek(() => validasiTurunkan([...ks, PENGISI], spesifikasi, false, 'buangan', ctx));
    }
    case 'nutupHabisDeck':
      // Tiga kartu pertama dijadikan setelah ambil dari deck, sisa satu kartu di tangan.
      return cek(() => validasiTurunkan(ks, [ks.slice(0, 3).map((k) => ({ id: k.id }))], false, 'deck', ctx));
    case 'buangAs':
      return cek(() =>
        validasiBuang({ tangan: [...ks, PENGISI], punyaKartuJadi: false, sumberAmbil: 'deck', kartuId: ks[0].id, ctx, asJokerBolehDibuangTanpaJadi: false }),
      );
    case 'mulung': {
      // 4 pemain, joker 9. Buangan dari bawah ke atas: 3 Wajik, K Kriting, 5 Wajik.
      const buang = [kartu({ bunga: 'wajik', rank: 3 }), kartu({ bunga: 'kriting', rank: 13 }), kartu({ bunga: 'wajik', rank: 5 })];
      const ctxM: KonteksJoker = { rankJoker: 9 as Rank, jokerMati: [] };
      const jumlah = /2 kartu teratas/.test(c.ket) ? 2 : 3;
      const diambil = buang.slice(buang.length - jumlah);
      const tangan: Kartu[] = [kartu({ bunga: 'love', rank: 10 }), kartu({ bunga: 'love', rank: 13 })];
      const pilih: PilihanKartu[] = [];
      for (const kc of c.kartu) {
        const dariBuangan = diambil.find(
          (b) => kc.peran === undefined && b.rank === kc.rank && b.bunga === kc.bunga && !pilih.some((p) => p.id === b.id),
        );
        if (dariBuangan) {
          pilih.push({ id: dariBuangan.id });
          continue;
        }
        const baru = kartu(kc);
        tangan.push(baru);
        pilih.push(kc.peran !== undefined ? { id: baru.id, sebagai: { rank: kc.peran, bunga: 'wajik' } } : { id: baru.id });
      }
      return cek(() =>
        validasiMulung({
          tangan,
          buangan: buang.map((k) => ({ kartu: k, pemilik: 1 })),
          punyaKartuJadi: false,
          jumlahPemain: 4,
          jumlah,
          spesifikasi: [pilih],
          ctx: ctxM,
        }),
      );
    }
  }
}

describe('contoh di Bantuan sama dengan validator engine', () => {
  it('ada contoh di bab-bab aturan utama', () => {
    const bab = new Set(SEMUA_CONTOH.map((c) => c.bab));
    for (const id of ['joker', 'kartu-jadi', 'giliran', 'mulung']) expect(bab, id).toContain(id);
    expect(SEMUA_CONTOH.length).toBeGreaterThanOrEqual(25);
  });

  it('teks bab Mulung menyebut skenario buangan yang dipakai test ini', () => {
    const mulung = BAB_BANTUAN.find((b) => b.id === 'mulung')!;
    const teks = mulung.isi.flatMap((x) => (x.t === 'paragraf' ? [x.teks] : []));
    expect(teks.some((t) => t.includes(KALIMAT_SKENARIO_MULUNG) && t.includes('4 pemain') && t.includes('joker putaran ini 9'))).toBe(true);
  });

  for (const c of SEMUA_CONTOH) {
    it(`[${c.bab}] ${c.judul}: ${c.sah ? 'sah' : 'tidak sah'}`, () => {
      const hasil = ujiContoh(c);
      expect(hasil.ok, `engine: ${hasil.ok ? 'sah' : `tolak (${hasil.kode})`}`).toBe(c.sah);
    });
  }
});

describe('klaim kunci di Bantuan sama dengan engine', () => {
  const teksBab = (id: string) =>
    JSON.stringify(BAB_BANTUAN.find((b) => b.id === id)?.isi ?? []);
  const semuaTeks = JSON.stringify(BAB_BANTUAN);
  const ctx5: KonteksJoker = { rankJoker: 5 as Rank, jokerMati: [] };

  it('maksimal mulung = jumlah pemain − 1 (4 pemain 3 kartu, 2 pemain 1 kartu)', () => {
    expect(teksBab('mulung')).toContain('Di 4 pemain maksimal 3 kartu, di 2 pemain cuma 1.');
    expect(maksimalMulung(4, 10)).toBe(3);
    expect(maksimalMulung(2, 10)).toBe(1);
    expect(maksimalMulung(6, 10)).toBe(5);
  });

  it('seri angka tidak bisa disambung Londo, As tidak bisa masuk seri', () => {
    const kartu = pembuatKartu();
    const seri = (xs: [Rank, Bunga][]) => cek(() => validasiKartuJadi(xs.map(([rank, bunga]) => ({ kartu: kartu({ bunga, rank }) })), ctx5));
    expect(seri([[9, 'waru'], [10, 'waru'], [11, 'waru']]).ok).toBe(false);
    expect(seri([[1, 'waru'], [2, 'waru'], [3, 'waru']]).ok).toBe(false);
    expect(seri([[2, 'waru'], [3, 'waru'], [4, 'waru'], [6, 'waru'], [7, 'waru'], [8, 'waru'], [9, 'waru'], [10, 'waru'], [5, 'waru']]).ok).toBe(true);
  });

  it('mentung: buang kartu terakhir di giliran yang diawali mulung', () => {
    expect(teksBab('mulung')).toContain('mentung cuma sah di giliran yang kamu awali dengan mulung');
    const kartu = pembuatKartu();
    const t = [kartu({ bunga: 'love', rank: 7 })];
    const dariBuangan = validasiBuang({ tangan: t, punyaKartuJadi: true, sumberAmbil: 'buangan', kartuId: t[0].id, ctx: ctx5, asJokerBolehDibuangTanpaJadi: false });
    expect(dariBuangan.mentung).toBe(true);
  });

  it('joker tidak boleh sama dengan putaran tepat sebelumnya: kartunya dianulir, buka kartu berikutnya (#40)', () => {
    expect(teksBab('joker')).toContain('tidak boleh sama dengan putaran tepat sebelumnya');
    expect(teksBab('joker')).toContain('joker putaran 3 boleh sama dengan putaran 1');
    expect(teksBab('mulai')).toContain('Kalau angkanya sama dengan joker putaran sebelumnya, kartu itu dianulir');
    expect(FAQ.some((f) => f.jawab.includes('dianulir') && f.jawab.includes('putaran 3 sama dengan putaran 1'))).toBe(true);
    const kartu = pembuatKartu();
    // Dari bawah ke atas; joker putaran lalu 7, dua kartu teratas 7.
    const deck = [kartu({ bunga: 'waru', rank: 3 }), kartu({ bunga: 'love', rank: 9 }), kartu({ bunga: 'kriting', rank: 7 }), kartu({ bunga: 'love', rank: 7 })];
    const joker = bukaKartuJoker(deck, 7 as Rank, new Rng(1));
    expect(joker.rank).toBe(9);
    expect(deck).toHaveLength(4);
    expect(deck.filter((k) => k.rank === 7)).toHaveLength(2);
    // Tanpa joker sebelumnya (putaran pertama), kartu teratas langsung jadi joker.
    const deck2 = [kartu({ bunga: 'waru', rank: 3 }), kartu({ bunga: 'wajik', rank: 7 })];
    expect(bukaKartuJoker(deck2, undefined, new Rng(1)).rank).toBe(7);
  });

  it('nutup pakai beberapa joker hidup sekaligus: 250 per joker, harus semua sisa tangan, sesudah mulung (#41)', () => {
    expect(teksBab('mentung')).toContain('Pentung beberapa joker sekaligus');
    expect(teksBab('mentung')).toContain('**250 per joker**: dua joker 500, tiga joker 750');
    expect(FAQ.some((f) => f.tanya === 'Bisa nutup pakai dua joker?' && f.jawab.includes('dua joker 500'))).toBe(true);
    expect(GLOSARIUM.find((g) => g.istilah === 'Pentungan')!.arti).toContain('250 per joker');
    const kartu = pembuatKartu();
    const j = [kartu({ bunga: 'waru', rank: 5 }), kartu({ bunga: 'love', rank: 5 }), kartu({ bunga: 'kriting', rank: 5 })];
    const buang = (tangan: Kartu[], ids: string[], sumberAmbil: 'deck' | 'buangan' = 'buangan', mati: string[] = []) =>
      cek(() =>
        validasiBuang({
          tangan,
          punyaKartuJadi: true,
          sumberAmbil,
          kartuId: ids[0],
          kartuIdLain: ids.slice(1),
          ctx: { rankJoker: 5 as Rank, jokerMati: mati },
          asJokerBolehDibuangTanpaJadi: false,
        }),
      );
    expect(buang(j.slice(0, 2), [j[0].id, j[1].id]).ok).toBe(true);
    expect(buang(j, j.map((x) => x.id)).ok).toBe(true);
    expect(nilaiPentunganTotal(j[0], true, [j[1]])).toBe(500);
    expect(nilaiPentunganTotal(j[0], true, [j[1], j[2]])).toBe(750);
    // Semua sisa kartu harus ikut, sesudah mulung, dan joker mati tidak bisa ikut.
    expect(buang(j, [j[0].id, j[1].id]).kode).toBe('BUANG_SATU_KARTU');
    expect(buang(j.slice(0, 2), [j[0].id, j[1].id], 'deck').kode).toBe('NUTUP_TANPA_MULUNG');
    expect(buang(j.slice(0, 2), [j[0].id, j[1].id], 'buangan', [j[1].id]).kode).toBe('PENTUNGAN_BUKAN_JOKER');
  });

  it('mode kaldu: pentungan dikali PENGALI_KALDU, kaldu lagi kalau deck habis, tanpa batas skor (#42, #43)', () => {
    const teks = teksBab('akhir-permainan');
    expect(PENGALI_KALDU).toBe(2);
    expect(teks).toContain(`**dikali ${PENGALI_KALDU}**`);
    expect(teksBab('skor')).toContain(`**dikali ${PENGALI_KALDU}**`);
    expect(teks).toContain('Kaldu lagi: putaran berikutnya juga putaran kaldu');
    expect(teks).toContain('batas skor tidak dipakai');
    expect(teks).toContain('tetap bisa di antara putaran');
    expect(GLOSARIUM.find((g) => g.istilah === 'Kaldu')!.arti).toContain(`dikali ${PENGALI_KALDU}`);
    // Tabel contoh dihitung ulang dengan rumus skor engine.
    const tabel = BAB_BANTUAN.find((b) => b.id === 'akhir-permainan')!.isi.find((x) => x.t === 'tabel');
    if (tabel?.t !== 'tabel') throw new Error('tabel contoh kaldu tidak ada');
    const kartu = pembuatKartu();
    const joker = [kartu({ bunga: 'waru', rank: 5 }), kartu({ bunga: 'love', rank: 5 })];
    const dasar = [
      nilaiPentungan(kartu({ bunga: 'love', rank: 6 }), false),
      nilaiPentungan(kartu({ bunga: 'waru', rank: 1 }), false),
      nilaiPentunganTotal(joker[0], true),
      nilaiPentunganTotal(joker[0], true, [joker[1]]),
    ];
    expect(tabel.baris).toHaveLength(dasar.length);
    const minus = (x: number) => `−${x}`;
    tabel.baris.forEach(([label, mentung, kepentung], i) => {
      const skor = (status: 'mentung' | 'kepentung') =>
        hitungSkorPemain({ pemain: 0, status, kartuJadi: [], tangan: [], nilaiPentungan: dasar[i], pengaliPentungan: PENGALI_KALDU, jumlahJokerDibuang: 0, ctx: ctx5 }).nilaiPentungan;
      expect(label).toContain(`(${dasar[i]})`);
      expect(mentung).toBe(`+${skor('mentung')}`);
      expect(kepentung).toBe(minus(-skor('kepentung')));
    });
  });

  it('buang joker hidup kena −25; pentungan joker bernilai 250 tanpa penalti', () => {
    expect(semuaTeks).toContain(`**−${PENALTI_JOKER_DIBUANG}**`);
    expect(semuaTeks).toContain(`bernilai ${NILAI_PENTUNGAN_JOKER}`);
    const kartu = pembuatKartu();
    const t = [kartu({ bunga: 'love', rank: 5 }), kartu({ bunga: 'love', rank: 8 })];
    const biasa = validasiBuang({ tangan: t, punyaKartuJadi: true, sumberAmbil: 'deck', kartuId: t[0].id, ctx: ctx5, asJokerBolehDibuangTanpaJadi: false });
    expect(biasa.kenaPenaltiJoker).toBe(true);
    const pentungan = [kartu({ bunga: 'waru', rank: 5 })];
    const hasil = validasiBuang({ tangan: pentungan, punyaKartuJadi: true, sumberAmbil: 'buangan', kartuId: pentungan[0].id, ctx: ctx5, asJokerBolehDibuangTanpaJadi: false });
    expect(hasil.mentung).toBe(true);
    expect(hasil.kenaPenaltiJoker).toBe(false);
  });
});
