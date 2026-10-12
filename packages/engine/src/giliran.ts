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

export interface HasilTurunkan {
  kartuJadi: HasilValidasiKartuJadi[];
  sisaTangan: Kartu[];
}

/**
 * Validasi satu atau beberapa kartu jadi baru yang dibentuk dari `tersedia`.
 * - 3 As butuh kartu jadi lain: yang sudah di meja, atau yang diturunkan bersamaan (bukan 3 As juga).
 * - Harus tersisa minimal 1 kartu untuk dibuang; bila tadi ambil dari deck, minimal 2
 *   (ambil dari deck tidak bisa dipakai nutup).
 * - Mode 'akhir' (fase susun akhir setelah deck habis): tidak ada buang, jadi tangan boleh habis.
 */
export function validasiTurunkan(
  tersedia: readonly Kartu[],
  spesifikasi: readonly SpesifikasiKartuJadi[],
  punyaKartuJadi: boolean,
  sumberAmbil: ModeTurunkan,
  ctx: KonteksJoker,
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
  const hasil = validasiTurunkan(tersedia, input.spesifikasi, input.punyaKartuJadi, 'buangan', ctx);

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
  ctx: KonteksJoker;
  asJokerBolehDibuangTanpaJadi: boolean;
}

export interface HasilBuang {
  kartu: Kartu;
  mentung: boolean;
  /** Joker hidup yang dibuang bukan sebagai pentungan: kena penalti −25. */
  kenaPenaltiJoker: boolean;
}

export function validasiBuang(input: InputBuang): HasilBuang {
  const kartu = input.tangan.find((k) => k.id === input.kartuId);
  if (!kartu) langgar('KARTU_TIDAK_ADA', 'Kartu itu nggak ada di tanganmu.');

  const jokerHidup = isJokerHidup(kartu, input.ctx);
  if (kartu.rank === AS && !input.punyaKartuJadi && !(jokerHidup && input.asJokerBolehDibuangTanpaJadi)) {
    langgar('AS_BELUM_BOLEH_DIBUANG', 'As belum boleh dibuang, kamu belum punya kartu jadi.');
  }
  const mentung = input.tangan.length === 1;
  if (mentung && input.sumberAmbil !== 'buangan') {
    langgar('NUTUP_TANPA_MULUNG', 'Nutup cuma sah kalau giliran ini kamu mulung.');
  }
  return { kartu, mentung, kenaPenaltiJoker: jokerHidup && !mentung };
}
