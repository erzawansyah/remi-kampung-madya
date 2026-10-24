// Validasi aksi dalam satu giliran. Fungsi murni yang hanya butuh data yang terlihat pemain,
// sehingga dipakai bersama oleh mesin aturan dan bot.

import { AS, namaKartu, type Kartu } from './kartu.js';
import { langgar } from './error.js';
import {
  isJokerHidup,
  isKembarAsTiga,
  validasiKartuJadi,
  type HasilValidasiKartuJadi,
  type KonteksJoker,
  type SpesifikasiKartuJadi,
} from './kartuJadi.js';
import type { EntriBuangan } from './state.js';

/** Sumber ambil giliran ini, atau 'akhir' untuk fase susun akhir. */
export type ModeTurunkan = 'deck' | 'buangan' | 'akhir';

/** Keputusan #52: nutup paling banyak pakai 2 kartu (dua joker hidup). */
export const MAKS_KARTU_NUTUP = 2;

/**
 * Keputusan #53 (2 deck): `kartu` kembaran salah satu kartu yang dipungut giliran ini, yaitu angka dan
 * bunganya sama tapi kartunya lain (deck satunya). Kartu pungutan itu sendiri bukan kembarannya. Dengan
 * 1 deck tidak pernah ada kembaran. Pungutan giliran ini info publik (`StatePutaran.pungutan`, juga di
 * `ViewPutaran.pungutan`), jadi mesin, warga kedai, meja, dan aplikasi memakai sumber yang sama.
 */
export function kembaranPungutan(kartu: Kartu, pungutan: readonly EntriBuangan[]): boolean {
  return pungutan.some((e) => e.kartu.id !== kartu.id && e.kartu.rank === kartu.rank && e.kartu.bunga === kartu.bunga);
}

export interface HasilTurunkan {
  kartuJadi: HasilValidasiKartuJadi[];
  sisaTangan: Kartu[];
}

/**
 * Validasi satu atau beberapa kartu jadi baru yang dibentuk dari `tersedia`.
 * - 3 As butuh kartu jadi lain: yang sudah di meja, atau yang diturunkan bersamaan (bukan 3 As juga).
 * - Harus tersisa minimal 1 kartu untuk dibuang; bila tadi ambil dari deck, minimal 2
 *   (ambil dari deck tidak bisa dipakai nutup).
 * - Giliran mulung: kalau sisa satu kartu dan kartu itu kembaran kartu yang dipungut giliran ini, minimal 2
 *   juga. Kartu itu tidak bisa jadi pentungan (#53), dan membuang kartu terakhir selalu berarti mentung,
 *   jadi tanpa syarat ini giliran macet tanpa aksi sah.
 * - Mode 'akhir' (fase susun akhir setelah deck habis): tidak ada buang, jadi tangan boleh habis.
 *
 * @param pungutan kartu yang dipungut giliran ini (`StatePutaran.pungutan`; saat mulung: kartu yang
 *   diambil). Kosong untuk giliran ambil deck dan susun akhir.
 */
export function validasiTurunkan(
  tersedia: readonly Kartu[],
  spesifikasi: readonly SpesifikasiKartuJadi[],
  punyaKartuJadi: boolean,
  sumberAmbil: ModeTurunkan,
  ctx: KonteksJoker,
  pungutan: readonly EntriBuangan[],
): HasilTurunkan {
  if (spesifikasi.length === 0) langgar('KARTU_JADI_TIDAK_SAH', 'Pilih dulu kartu yang mau dijadikan.');
  const dipakai = new Set<string>();
  const hasil = spesifikasi.map((spek) => {
    const items = spek.map((p) => {
      const kartu = tersedia.find((k) => k.id === p.id);
      if (!kartu) langgar('KARTU_TIDAK_ADA', 'Kartu itu nggak ada di tanganmu.');
      if (dipakai.has(p.id)) langgar('KARTU_DOBEL', `${namaKartu(kartu)} dipakai dua kali.`);
      dipakai.add(p.id);
      return { kartu, sebagai: p.sebagai };
    });
    return validasiKartuJadi(items, ctx);
  });

  const adaPendamping = punyaKartuJadi || hasil.some((h) => !isKembarAsTiga(h));
  if (hasil.some(isKembarAsTiga) && !adaPendamping) {
    langgar('AS_TIGA_BELUM_PUNYA_JADI', '3 As baru boleh turun kalau kamu sudah punya kartu jadi lain.');
  }

  const sisaTangan = tersedia.filter((k) => !dipakai.has(k.id));
  if (sumberAmbil !== 'akhir' && sisaTangan.length < 1) {
    langgar('SISAKAN_KARTU', 'Sisakan minimal satu kartu buat dibuang.');
  }
  if (sumberAmbil === 'deck' && sisaTangan.length < 2) {
    langgar(
      'SISAKAN_KARTU',
      'Habis ambil dari deck nggak bisa nutup. Sisakan minimal dua kartu: satu dibuang, satu tetap di tangan.',
    );
  }
  if (sumberAmbil === 'buangan' && sisaTangan.length === 1 && kembaranPungutan(sisaTangan[0], pungutan)) {
    langgar('SISAKAN_KARTU', PESAN_SISA_KEMBARAN);
  }
  return { kartuJadi: hasil, sisaTangan };
}

export interface InputMulung {
  tangan: readonly Kartu[];
  buangan: readonly EntriBuangan[];
  punyaKartuJadi: boolean;
  jumlahPemain: number;
  jumlah: number;
  spesifikasi: readonly SpesifikasiKartuJadi[];
  ctx: KonteksJoker;
}

export interface HasilMulung extends HasilTurunkan {
  diambil: EntriBuangan[];
  /** Indeks kartu jadi yang memuat kartu paling bawah. */
  indeksKartuJadiBawah: number;
}

export function maksimalMulung(jumlahPemain: number, panjangBuangan: number): number {
  return Math.min(jumlahPemain - 1, panjangBuangan);
}

/**
 * Validasi mulung (Bagian 5): ambil k kartu teratas, kartu paling bawah wajib langsung jadi
 * kartu jadi baru dengan modal dari tangan ≥ jumlah pungutan di kombinasi itu, dan modal
 * memuat minimal satu kartu biasa (bukan joker pengganti).
 */
export function validasiMulung(input: InputMulung): HasilMulung {
  const { tangan, buangan, jumlah, ctx } = input;
  const maks = maksimalMulung(input.jumlahPemain, buangan.length);
  if (buangan.length === 0) langgar('MULUNG_JUMLAH', 'Buangan masih kosong, ambil dari deck dulu.');
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > maks) {
    langgar('MULUNG_JUMLAH', `Mulung cuma boleh 1 sampai ${maks} kartu teratas.`);
  }

  const diambil = buangan.slice(buangan.length - jumlah);
  const bawah = diambil[0].kartu;
  const tersedia = [...tangan, ...diambil.map((e) => e.kartu)];
  const hasil = validasiTurunkan(tersedia, input.spesifikasi, input.punyaKartuJadi, 'buangan', ctx, diambil);

  const indeksKartuJadiBawah = hasil.kartuJadi.findIndex((kj) => kj.kartu.some((d) => d.kartu.id === bawah.id));
  if (indeksKartuJadiBawah < 0) {
    langgar(
      'MULUNG_TANPA_KARTU_BAWAH',
      `Kartu paling bawah yang dipungut (${namaKartu(bawah)}) wajib langsung dijadikan kartu jadi.`,
    );
  }

  const idPungutan = new Set(diambil.map((e) => e.kartu.id));
  const kj = hasil.kartuJadi[indeksKartuJadiBawah];
  const pungutan = kj.kartu.filter((d) => idPungutan.has(d.kartu.id));
  const modal = kj.kartu.filter((d) => !idPungutan.has(d.kartu.id));
  if (modal.length < pungutan.length) {
    langgar('MODAL_KURANG', `Modalnya kurang, Bos. Kartu pungutan ${pungutan.length}, modal cuma ${modal.length}.`);
  }
  if (!modal.some((d) => !d.pengganti)) {
    langgar('MODAL_TANPA_KARTU_BIASA', 'Modal harus ada minimal satu kartu biasa, nggak boleh joker semua.');
  }
  return { ...hasil, diambil, indeksKartuJadiBawah };
}

export interface InputBuang {
  tangan: readonly Kartu[];
  punyaKartuJadi: boolean;
  sumberAmbil: 'deck' | 'buangan';
  kartuId: string;
  /**
   * Keputusan #41: kartu lain yang ikut dibuang (nutup pakai dua joker; paling banyak MAKS_KARTU_NUTUP
   * kartu seluruhnya, #52). Kosong/tidak ada = satu kartu.
   */
  kartuIdLain?: readonly string[];
  /** Kartu yang dipungut giliran ini (`StatePutaran.pungutan`/`ViewPutaran.pungutan`); kosong kalau ambil deck. */
  pungutan: readonly EntriBuangan[];
  ctx: KonteksJoker;
  asJokerBolehDibuangTanpaJadi: boolean;
}

export interface HasilBuang {
  kartu: Kartu;
  /** Kartu lain yang ikut dibuang (selalu array; kosong untuk buang satu kartu). */
  kartuLain: Kartu[];
  mentung: boolean;
  /** Joker hidup yang dibuang bukan sebagai pentungan: kena penalti −25. */
  kenaPenaltiJoker: boolean;
}

const PESAN_KARTU_TIDAK_ADA = 'Kartu itu nggak ada di tanganmu.';
const PESAN_NUTUP_TANPA_MULUNG = 'Nutup cuma sah kalau giliran ini kamu mulung.';
const PESAN_AS_BELUM_BOLEH = 'As belum boleh dibuang, kamu belum punya kartu jadi.';
const PESAN_NUTUP_KEBANYAKAN = `Nutup paling banyak pakai ${MAKS_KARTU_NUTUP} kartu, Bos.`;
const PESAN_PENTUNGAN_KEMBARAN = 'Nggak bisa mentung pakai kembaran kartu yang barusan kamu pungut, Bos.';
const PESAN_SISA_KEMBARAN =
  'Kartu terakhirmu nanti kembaran kartu yang barusan kamu pungut, jadi nggak bisa buat mentung. Sisakan minimal dua kartu: satu dibuang, satu tetap di tangan.';

function cekAsBolehDibuang(kartu: Kartu, input: InputBuang): void {
  const jokerHidup = isJokerHidup(kartu, input.ctx);
  if (kartu.rank === AS && !input.punyaKartuJadi && !(jokerHidup && input.asJokerBolehDibuangTanpaJadi)) {
    langgar('AS_BELUM_BOLEH_DIBUANG', PESAN_AS_BELUM_BOLEH);
  }
}

/**
 * Validasi buang. Satu kartu: seperti biasa (kartu terakhir = mentung, harus sesudah mulung, dan bukan
 * kembaran kartu yang dipungut giliran ini, #53). Buang biasa (bukan mentung) kembaran tetap boleh.
 *
 * Beberapa kartu (keputusan #41, paling banyak 2 sejak #52) hanya sah untuk nutup pakai dua joker. Urutan
 * pemeriksaannya sengaja struktur dulu (kartu ada, tidak dobel, semua sisa tangan ikut, giliran diawali
 * mulung, paling banyak 2, bukan kembaran pungutan), baru status joker, jadi penolakan tidak pernah bilang
 * apa-apa soal joker sebelum syarat lain terpenuhi. Urutan empat cek pertama sama dengan sebelum #52.
 */
export function validasiBuang(input: InputBuang): HasilBuang {
  const lain = input.kartuIdLain ?? [];
  if (lain.length > 0) return validasiBuangBeberapa(input, lain);

  const kartu = input.tangan.find((k) => k.id === input.kartuId);
  if (!kartu) langgar('KARTU_TIDAK_ADA', PESAN_KARTU_TIDAK_ADA);

  const jokerHidup = isJokerHidup(kartu, input.ctx);
  cekAsBolehDibuang(kartu, input);
  const mentung = input.tangan.length === 1;
  if (mentung && input.sumberAmbil !== 'buangan') {
    langgar('NUTUP_TANPA_MULUNG', PESAN_NUTUP_TANPA_MULUNG);
  }
  // Keputusan #53: pentungan tidak boleh kembaran kartu yang dipungut giliran ini.
  if (mentung && kembaranPungutan(kartu, input.pungutan)) langgar('PENTUNGAN_KEMBARAN', PESAN_PENTUNGAN_KEMBARAN);
  return { kartu, kartuLain: [], mentung, kenaPenaltiJoker: jokerHidup && !mentung };
}

function validasiBuangBeberapa(input: InputBuang, lain: readonly string[]): HasilBuang {
  // 1) Semua kartu ada di tangan.
  const dipilih = [input.kartuId, ...lain].map((id) => {
    const k = input.tangan.find((x) => x.id === id);
    if (!k) langgar('KARTU_TIDAK_ADA', PESAN_KARTU_TIDAK_ADA);
    return k;
  });
  // 2) Tidak ada yang dipilih dua kali.
  const sudah = new Set<string>();
  for (const k of dipilih) {
    if (sudah.has(k.id)) langgar('KARTU_DOBEL', `${namaKartu(k)} kepilih dua kali.`);
    sudah.add(k.id);
  }
  // 3) Semua sisa tangan ikut dibuang (tangan jadi kosong).
  if (dipilih.length !== input.tangan.length) {
    langgar(
      'BUANG_SATU_KARTU',
      'Buangnya satu kartu aja, Bos. Lebih dari satu cuma boleh buat nutup, dan semua sisa kartumu harus ikut dibuang.',
    );
  }
  // 4) Nutup hanya sesudah mulung.
  if (input.sumberAmbil !== 'buangan') langgar('NUTUP_TANPA_MULUNG', PESAN_NUTUP_TANPA_MULUNG);
  // 5) Keputusan #52: paling banyak 2 kartu. Baru diperiksa sesudah syarat 1–4, jadi hanya kena kalau pemain
  //    memang mencoba nutup pakai seluruh sisa tangannya sesudah mulung; memilih 3 kartu dari tangan yang
  //    lebih besar tetap dapat pesan "buang satu kartu". Tangan 3+ joker tidak bisa nutup di giliran itu:
  //    buang satu kartu seperti biasa (joker hidup yang dibuang begitu kena −25 dan jadi joker mati).
  if (dipilih.length > MAKS_KARTU_NUTUP) langgar('NUTUP_KEBANYAKAN', PESAN_NUTUP_KEBANYAKAN);
  // 6) Keputusan #53: tidak ada pentungan yang kembaran kartu pungutan giliran ini (info publik).
  if (dipilih.some((k) => kembaranPungutan(k, input.pungutan))) langgar('PENTUNGAN_KEMBARAN', PESAN_PENTUNGAN_KEMBARAN);
  // 7) Semuanya joker hidup. Joker yang sudah pernah dibuang (joker mati) dihitung kartu biasa.
  if (!dipilih.every((k) => isJokerHidup(k, input.ctx))) {
    langgar(
      'PENTUNGAN_BUKAN_JOKER',
      'Nutup pakai beberapa kartu cuma boleh kalau semuanya joker. Joker yang sudah pernah dibuang dihitung kartu biasa.',
    );
  }
  // Larangan As tetap berlaku untuk tiap kartu. Di meja tidak pernah kena (giliran mulung selalu
  // menurunkan kartu jadi), tapi validator ini juga dipakai bot dan UI dengan data apa adanya.
  for (const k of dipilih) cekAsBolehDibuang(k, input);
  return { kartu: dipilih[0], kartuLain: dipilih.slice(1), mentung: true, kenaPenaltiJoker: false };
}
