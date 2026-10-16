// Bot. Hanya melihat ViewPemain (tanpa tangan lawan dan urutan deck), dan memvalidasi setiap
// aksinya dengan fungsi aturan yang sama dengan mesin, jadi hanya mengirim aksi sah.

import { AS, isAngka, isLondo, type Kartu } from '../kartu.js';
import { AturanError } from '../error.js';
import {
  cariKandidatKartuJadi,
  isJokerHidup,
  nilaiKartuTangan,
  type KonteksJoker,
  type SpesifikasiKartuJadi,
} from '../kartuJadi.js';
import {
  maksimalMulung,
  validasiBuang,
  validasiMulung,
  validasiTurunkan,
  type HasilMulung,
  type ModeTurunkan,
} from '../giliran.js';
import { nilaiPentungan } from '../skor.js';
import type { Rng } from '../rng.js';
import type { Aksi } from '../state.js';
import type { ViewPemain, ViewPutaran } from '../view.js';
import {
  biasBuang,
  buatKonteksGaya,
  isGaya,
  paramDenganGaya,
  pilihDekat,
  type GayaBot,
  type KonteksGaya,
} from './gaya.js';
import { aksiKuat, PARAM_JAGO, PARAM_SUHU, susunAkhirKuat } from './strategi.js';

// Gaya main warga kedai (#47): definisinya di gaya.ts. Diekspor ulang di sini supaya meja dan arena
// cukup mengimpor dari engine.
export { DAFTAR_GAYA_BOT, GAYA_TETAP, isGaya, type GayaBot, type GayaTetap } from './gaya.js';

/** Level warga kedai, dari yang paling gampang dikalahkan. Label UI: Mudah, Normal, Jago (susah), Suhu (sangat susah). */
export type LevelBot = 'mudah' | 'normal' | 'jago' | 'suhu';

/** Semua level, urut dari yang paling mudah. Dipakai validasi pesan dan pilihan di UI. */
export const DAFTAR_LEVEL_BOT: readonly LevelBot[] = ['mudah', 'normal', 'jago', 'suhu'];

function coba<T>(f: () => T): T | null {
  try {
    return f();
  } catch (e) {
    if (e instanceof AturanError) return null;
    throw e;
  }
}

function ctxDari(p: ViewPutaran): KonteksJoker {
  return { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
}

export interface OpsiMulung {
  jumlah: number;
  kartuJadi: SpesifikasiKartuJadi[];
  hasil: HasilMulung;
}

/** Semua cara mulung sah yang ditemukan generator kandidat. */
export function opsiMulung(view: ViewPemain): OpsiMulung[] {
  const p = view.putaran!;
  const saya = view.saya!;
  const tangan = p.tangan[saya]!;
  const ctx = ctxDari(p);
  const punya = p.kartuJadi[saya].length > 0;
  const hasil: OpsiMulung[] = [];
  const maks = maksimalMulung(view.konfigurasi.jumlahPemain, p.buangan.length);
  for (let jumlah = 1; jumlah <= maks; jumlah++) {
    const diambil = p.buangan.slice(p.buangan.length - jumlah);
    const bawah = diambil[0].kartu.id;
    const pool = [...tangan, ...diambil.map((e) => e.kartu)];
    const kandidat = cariKandidatKartuJadi(pool, ctx);
    const memuatBawah = kandidat.filter((k) => k.some((c) => c.id === bawah));
    for (const utama of memuatBawah) {
      const cobaMulung = (kartuJadi: SpesifikasiKartuJadi[]) =>
        coba(() =>
          validasiMulung({
            tangan,
            buangan: p.buangan,
            punyaKartuJadi: punya,
            jumlahPemain: view.konfigurasi.jumlahPemain,
            jumlah,
            spesifikasi: kartuJadi,
            ctx,
          }),
        );
      let h = cobaMulung([utama]);
      let kartuJadi = [utama];
      if (!h) {
        // Misalnya 3 As tanpa kartu jadi lain: coba turunkan kombinasi lain bersamaan.
        const dipakai = new Set(utama.map((c) => c.id));
        for (const lain of kandidat) {
          if (lain.some((c) => dipakai.has(c.id))) continue;
          h = cobaMulung([utama, lain]);
          if (h) {
            kartuJadi = [utama, lain];
            break;
          }
        }
      }
      if (h) hasil.push({ jumlah, kartuJadi, hasil: h });
    }
  }
  return hasil;
}

/** Pilih sekumpulan kartu jadi yang tidak tumpang tindih dan sah diturunkan bersama (serakah). */
export function rencanaTurunkan(
  tangan: readonly Kartu[],
  punyaKartuJadi: boolean,
  sumberAmbil: ModeTurunkan,
  ctx: KonteksJoker,
): SpesifikasiKartuJadi[] {
  const nilai = (spek: SpesifikasiKartuJadi) => spek.length * 100 + spek.length;
  const kandidat = cariKandidatKartuJadi(tangan, ctx).sort((a, b) => nilai(b) - nilai(a));
  const dipilih: SpesifikasiKartuJadi[] = [];
  let berubah = true;
  while (berubah) {
    berubah = false;
    for (const k of kandidat) {
      if (dipilih.includes(k)) continue;
      const pakai = new Set(dipilih.flat().map((c) => c.id));
      if (k.some((c) => pakai.has(c.id))) continue;
      if (coba(() => validasiTurunkan(tangan, [...dipilih, k], punyaKartuJadi, sumberAmbil, ctx))) {
        dipilih.push(k);
        berubah = true;
      }
    }
  }
  // Batch yang memuat 3 As bisa jadi baru sah setelah kombinasi lain ikut; pastikan akhirnya sah.
  return dipilih.length && coba(() => validasiTurunkan(tangan, dipilih, punyaKartuJadi, sumberAmbil, ctx)) ? dipilih : [];
}

function buangSah(view: ViewPemain): Kartu[] {
  const p = view.putaran!;
  const saya = view.saya!;
  const tangan = p.tangan[saya]!;
  return tangan.filter((k) =>
    coba(() =>
      validasiBuang({
        tangan,
        punyaKartuJadi: p.kartuJadi[saya].length > 0,
        sumberAmbil: p.sumberAmbil!,
        kartuId: k.id,
        ctx: ctxDari(p),
        asJokerBolehDibuangTanpaJadi: view.konfigurasi.asJokerBolehDibuangTanpaJadi,
      }),
    ),
  );
}

/**
 * Aksi warga kedai. Fungsi murni dari argumennya: view, level, rng (state-nya ikut berubah), dan gaya
 * main (#47, bawaan 'standar' = perilaku lama, tanpa memakai rng). Mudah mengabaikan gaya, susun akhir
 * tanpa gaya, dan gaya yang tidak dikenal dimainkan sebagai standar.
 */
export function pilihAksiBot(view: ViewPemain, level: LevelBot, rng: Rng, gaya: GayaBot = 'standar'): Aksi {
  const p = view.putaran;
  const saya = view.saya;
  const kuat = level === 'jago' || level === 'suhu';
  if (view.status === 'susunAkhir' && p && saya !== null && !p.selesaiSusun[saya]) {
    return (kuat && susunAkhirKuat(view)) || aksiSusunAkhir(p, saya);
  }
  if (view.status !== 'putaranBerjalan' || !p || saya === null || p.giliran !== saya) {
    throw new Error('Bukan giliran bot ini.');
  }
  if (level === 'mudah') return aksiMudah(view, p, saya, rng);
  const kg = gaya === 'standar' || !isGaya(gaya) ? null : buatKonteksGaya(view, level, gaya, rng);
  if (kuat) {
    const par = paramDenganGaya(level === 'suhu' ? PARAM_SUHU : PARAM_JAGO, level, kg);
    return aksiKuat(view, par, kg) ?? aksiNormal(view, p, saya, kg);
  }
  return aksiNormal(view, p, saya, kg);
}

/** Susun akhir: turunkan semua kartu jadi yang ditemukan, lalu selesai. */
function aksiSusunAkhir(p: ViewPutaran, saya: number): Aksi {
  const rencana = rencanaTurunkan(p.tangan[saya]!, p.kartuJadi[saya].length > 0, 'akhir', ctxDari(p));
  if (rencana.length) return { jenis: 'turunkan', pemain: saya, kartuJadi: rencana };
  return { jenis: 'selesaiSusun', pemain: saya };
}

function aksiMudah(view: ViewPemain, p: ViewPutaran, saya: number, rng: Rng): Aksi {
  if (p.tahap === 'ambil') {
    const opsi = p.buangan.length ? opsiMulung(view) : [];
    if (opsi.length && rng.next() < 0.5) {
      const o = rng.pick(opsi);
      return { jenis: 'mulung', pemain: saya, jumlah: o.jumlah, kartuJadi: o.kartuJadi };
    }
    return { jenis: 'ambilDeck', pemain: saya };
  }
  const tangan = p.tangan[saya]!;
  const ctx = ctxDari(p);
  if (rng.next() < 0.5) {
    const kandidat = cariKandidatKartuJadi(tangan, ctx).filter((k) =>
      coba(() => validasiTurunkan(tangan, [k], p.kartuJadi[saya].length > 0, p.sumberAmbil!, ctx)),
    );
    if (kandidat.length) return { jenis: 'turunkan', pemain: saya, kartuJadi: [rng.pick(kandidat)] };
  }
  return { jenis: 'buang', pemain: saya, kartuId: rng.pick(buangSah(view)).id };
}

/** Strategi normal. `kg` = konteks gaya main; null = standar (persis perilaku lama, tanpa rng). */
function aksiNormal(view: ViewPemain, p: ViewPutaran, saya: number, kg: KonteksGaya | null): Aksi {
  const ctx = ctxDari(p);
  if (p.tahap === 'ambil') {
    let terbaik: { skor: number; o: OpsiMulung } | null = null;
    for (const o of p.buangan.length ? opsiMulung(view) : []) {
      const lanjut = rencanaTurunkan(o.hasil.sisaTangan, true, 'buangan', ctx);
      const sisa = o.hasil.sisaTangan.length - lanjut.flat().length;
      const idPungutan = new Set(o.hasil.diambil.map((e) => e.kartu.id));
      const dipakai = new Set([...o.kartuJadi.flat(), ...lanjut.flat()].map((c) => c.id));
      const untung = o.hasil.diambil.reduce(
        (s, e) => s + (dipakai.has(e.kartu.id) ? 1 : -1) * nilaiKartuTangan(e.kartu, ctx),
        0,
      );
      let skor = untung + o.kartuJadi.flat().length;
      if (sisa === 1) {
        // Bisa langsung mentung.
        const pentungan = o.hasil.sisaTangan.find((k) => !dipakai.has(k.id))!;
        skor += 1000 + nilaiPentungan(pentungan, isJokerHidup(pentungan, ctx));
      }
      if (idPungutan.size && (!terbaik || skor > terbaik.skor)) terbaik = { skor, o };
    }
    // Gaya kilat: ambang mulung lebih rendah (kalau gayanya tidak libur). Standar: 0.
    const ambang = kg && kg.kali > 0 && kg.def.ambangMulungNormal !== undefined ? kg.def.ambangMulungNormal : 0;
    if (terbaik && terbaik.skor > ambang) {
      return { jenis: 'mulung', pemain: saya, jumlah: terbaik.o.jumlah, kartuJadi: terbaik.o.kartuJadi };
    }
    return { jenis: 'ambilDeck', pemain: saya };
  }

  const tangan = p.tangan[saya]!;
  const rencana = rencanaTurunkan(tangan, p.kartuJadi[saya].length > 0, p.sumberAmbil!, ctx);
  if (rencana.length) return { jenis: 'turunkan', pemain: saya, kartuJadi: rencana };

  const sah = buangSah(view);
  const terlihat = new Set<string>([
    ...tangan.map((k) => k.id),
    ...p.buangan.map((e) => e.kartu.id),
    ...p.kartuJadi.flat().flatMap((kj) => kj.kartu.map((d) => d.kartu.id)),
  ]);
  const jumlahDeck = view.konfigurasi.jumlahPemain >= 5 || (view.konfigurasi.jumlahPemain === 4 && view.konfigurasi.duaDeckUntukEmpat) ? 2 : 1;
  const tidakTerlihat = (bunga: Kartu['bunga'], rank: number) => {
    let n = 0;
    for (let d = 0; d < jumlahDeck; d++) if (!terlihat.has(`${bunga}-${rank}-${d}`)) n++;
    return n;
  };

  const skorBuang = (k: Kartu): number => {
    if (isJokerHidup(k, ctx)) return -1000;
    let guna = 0;
    for (const lain of tangan) {
      if (lain.id === k.id) continue;
      if (k.rank === AS && lain.rank === AS && lain.bunga !== k.bunga) guna += 1;
      if (lain.bunga !== k.bunga) continue;
      if (isAngka(k.rank) && isAngka(lain.rank) && Math.abs(lain.rank - k.rank) <= 2) guna += 1;
      if (isLondo(k.rank) && isLondo(lain.rank)) guna += 1;
    }
    // Risiko dipungut lawan: tetangga sebunga yang belum kelihatan di mana pun.
    let risiko = 0;
    if (isAngka(k.rank)) {
      for (const d of [-2, -1, 1, 2]) {
        const r = k.rank + d;
        if (r >= 2 && r <= 10) risiko += tidakTerlihat(k.bunga, r);
      }
    }
    return nilaiKartuTangan(k, ctx) - guna * 6 - risiko * 0.5;
  };

  if (!kg) {
    const pilihan = [...sah].sort((a, b) => skorBuang(b) - skorBuang(a))[0];
    return { jenis: 'buang', pemain: saya, kartuId: pilihan.id };
  }
  // Dengan gaya: bias gaya hanya untuk calon yang sah, lalu yang hampir seri dipilih acak.
  const pilihan = pilihDekat(
    sah.map((k) => ({ isi: k, skor: skorBuang(k) + biasBuang(kg, k, tangan) })),
    kg,
  );
  return { jenis: 'buang', pemain: saya, kartuId: pilihan.id };
}
