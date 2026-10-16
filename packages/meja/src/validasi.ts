// Validasi bentuk pesan dari client. Data dari jaringan tidak dipercaya: bentuk yang salah
// ditolak di sini supaya tidak pernah sampai ke mesin aturan.

import { DAFTAR_LEVEL_BOT, type LevelBot, type SpesifikasiKartuJadi } from '@remi/engine';
import {
  DAFTAR_EMOTE,
  EMOTE_LAMA,
  PENGATURAN_BAWAAN,
  type AksiKlien,
  type Emote,
  type PengaturanMeja,
  type PesanKlien,
} from './protokol.js';

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isStr = (x: unknown, maks = 200): x is string => typeof x === 'string' && x.length <= maks;

/** Level warga kedai yang dikenal versi ini (DAFTAR_LEVEL_BOT di engine). */
export const isLevel = (x: unknown): x is LevelBot => (DAFTAR_LEVEL_BOT as readonly unknown[]).includes(x);

/**
 * Level dari data yang tidak bisa dipercaya penuh (simpanan di HP, isian UI): yang tidak dikenal
 * (rusak, kosong, atau dari versi lain) jatuh ke level bawaan, supaya meja tetap jalan.
 */
export function rapikanLevel(x: unknown): LevelBot {
  return isLevel(x) ? x : PENGATURAN_BAWAAN.levelBot;
}

// ---------------------------------------------------------------------------------------------
// Batas skor (keputusan pemilik #44): angka bebas kelipatan 10, untuk batas atas dan batas bawah.

/** Batas skor harus kelipatan ini. */
export const KELIPATAN_BATAS_SKOR = 10;
/** Nilai mutlak batas skor terkecil yang bisa dipilih. */
export const BATAS_SKOR_MIN = 10;
/** Nilai mutlak batas skor terbesar (sama dengan batas lama validasi). */
export const BATAS_SKOR_MAKS = 100000;

/** Batas atas disimpan positif, batas bawah disimpan negatif. */
export type ArahBatasSkor = 'atas' | 'bawah';

/**
 * Batas skor yang sah untuk meja: null (tanpa batas), atau bilangan bulat kelipatan 10 bertanda
 * sesuai arah (atas positif, bawah negatif) dengan nilai mutlak 10..100000. Nilai dari pilihan
 * lama di lobi (300/500/1000 dan negatifnya) tetap sah.
 */
export function batasSkorSah(v: unknown, arah: ArahBatasSkor): v is number | null {
  if (v === null) return true;
  if (!isInt(v)) return false;
  const mutlak = arah === 'atas' ? v : -v;
  return mutlak >= BATAS_SKOR_MIN && mutlak <= BATAS_SKOR_MAKS && mutlak % KELIPATAN_BATAS_SKOR === 0;
}

/**
 * Rapikan isian batas skor dari UI (isi `<input>`) atau simpanan di HP jadi nilai yang sah untuk
 * meja. Yang diketik cukup angkanya: batas bawah juga diketik positif (keyboard angka iPhone nggak
 * punya tanda minus), tandanya dipasang di sini. Kosong, 0, atau bukan angka = tanpa batas (null).
 * Titik/koma di antara kelompok 3 angka dianggap pemisah ribuan, cara orang sini menulis seribu
 * ("1.000", "1,500", "10.000"), bukan pecahan. Selain itu nilai mutlaknya dibulatkan ke kelipatan
 * 10 terdekat lalu dijepit ke 10..100000.
 */
export function rapikanBatasSkor(x: unknown, arah: ArahBatasSkor): number | null {
  let n: number;
  if (typeof x === 'number') n = x;
  else if (typeof x === 'string' && x.trim() !== '') {
    const teks = x.trim().replace(/^−/, '-');
    n = Number(/^-?\d{1,3}([.,]\d{3})+$/.test(teks) ? teks.replace(/[.,]/g, '') : teks);
  } else return null;
  if (!Number.isFinite(n) || n === 0) return null;
  const bulat = Math.round(Math.abs(n) / KELIPATAN_BATAS_SKOR) * KELIPATAN_BATAS_SKOR;
  const mutlak = Math.min(BATAS_SKOR_MAKS, Math.max(BATAS_SKOR_MIN, bulat));
  return arah === 'atas' ? mutlak : -mutlak;
}

function spesifikasi(x: unknown): SpesifikasiKartuJadi[] | null {
  if (!Array.isArray(x) || x.length < 1 || x.length > 8) return null;
  const hasil: SpesifikasiKartuJadi[] = [];
  for (const kj of x) {
    if (!Array.isArray(kj) || kj.length < 1 || kj.length > 13) return null;
    const spek: SpesifikasiKartuJadi = [];
    for (const p of kj) {
      if (!isObj(p) || !isStr(p.id, 40)) return null;
      if (p.sebagai === undefined) {
        spek.push({ id: p.id });
        continue;
      }
      const s = p.sebagai;
      if (!isObj(s) || !isInt(s.rank) || s.rank < 1 || s.rank > 13) return null;
      if (!['waru', 'love', 'kriting', 'wajik'].includes(s.bunga as string)) return null;
      spek.push({ id: p.id, sebagai: { rank: s.rank as never, bunga: s.bunga as never } });
    }
    hasil.push(spek);
  }
  return hasil;
}

export function validasiAksi(x: unknown): AksiKlien | null {
  if (!isObj(x)) return null;
  switch (x.jenis) {
    case 'ambilDeck':
      return { jenis: 'ambilDeck' };
    case 'selesaiSusun':
      return { jenis: 'selesaiSusun' };
    case 'buang':
      return isStr(x.kartuId, 40) ? { jenis: 'buang', kartuId: x.kartuId } : null;
    case 'turunkan': {
      const kj = spesifikasi(x.kartuJadi);
      return kj ? { jenis: 'turunkan', kartuJadi: kj } : null;
    }
    case 'mulung': {
      const kj = spesifikasi(x.kartuJadi);
      return kj && isInt(x.jumlah) ? { jenis: 'mulung', jumlah: x.jumlah, kartuJadi: kj } : null;
    }
    default:
      return null;
  }
}

export function validasiPengaturan(x: unknown): Partial<PengaturanMeja> | null {
  if (!isObj(x)) return null;
  const hasil: Partial<PengaturanMeja> = {};
  if (x.jumlahPemain !== undefined) {
    if (!isInt(x.jumlahPemain) || x.jumlahPemain < 2 || x.jumlahPemain > 6) return null;
    hasil.jumlahPemain = x.jumlahPemain;
  }
  if (x.duaDeckUntukEmpat !== undefined) {
    if (typeof x.duaDeckUntukEmpat !== 'boolean') return null;
    hasil.duaDeckUntukEmpat = x.duaDeckUntukEmpat;
  }
  if (x.batasPutaran !== undefined) {
    const v = x.batasPutaran;
    if (v !== null && (!isInt(v) || v < 1 || v > 100000)) return null;
    hasil.batasPutaran = v as number | null;
  }
  // Batas skor (#44): atas positif, bawah negatif, kelipatan 10. Tanda terbalik atau 0 ditolak.
  if (x.batasSkorAtas !== undefined) {
    if (!batasSkorSah(x.batasSkorAtas, 'atas')) return null;
    hasil.batasSkorAtas = x.batasSkorAtas;
  }
  if (x.batasSkorBawah !== undefined) {
    if (!batasSkorSah(x.batasSkorBawah, 'bawah')) return null;
    hasil.batasSkorBawah = x.batasSkorBawah;
  }
  if (x.publik !== undefined) {
    if (typeof x.publik !== 'boolean') return null;
    hasil.publik = x.publik;
  }
  if (x.detikGiliran !== undefined) {
    if (!isInt(x.detikGiliran) || x.detikGiliran < 0 || x.detikGiliran > 600) return null;
    hasil.detikGiliran = x.detikGiliran;
  }
  if (x.levelBot !== undefined) {
    if (!isLevel(x.levelBot)) return null;
    hasil.levelBot = x.levelBot;
  }
  if (x.tempoBot !== undefined) {
    if (x.tempoBot !== 'santai' && x.tempoBot !== 'normal' && x.tempoBot !== 'cepat') return null;
    hasil.tempoBot = x.tempoBot;
  }
  return hasil;
}

/** Ubah data mentah (hasil JSON.parse) menjadi PesanKlien yang sah, atau null. */
export function validasiPesan(x: unknown): PesanKlien | null {
  if (!isObj(x) || typeof x.t !== 'string') return null;
  const pengocok = (v: unknown) => v === undefined || isInt(v);
  switch (x.t) {
    case 'buat': {
      if (!isStr(x.nama, 100)) return null;
      const pengaturan = x.pengaturan === undefined ? {} : validasiPengaturan(x.pengaturan);
      return pengaturan ? { t: 'buat', nama: x.nama, pengaturan } : null;
    }
    case 'gabung':
      if (!isStr(x.kode, 20) || !isStr(x.nama, 100)) return null;
      if (x.token !== undefined && !isStr(x.token, 100)) return null;
      return { t: 'gabung', kode: x.kode, nama: x.nama, token: x.token as string | undefined };
    case 'daftar':
    case 'keluar':
    case 'mainLagi':
    case 'siapJoker':
    case 'ping':
      return { t: x.t };
    case 'aturKursi':
      if (!isInt(x.kursi) || (x.jenis !== 'bot' && x.jenis !== 'kosong')) return null;
      if (x.level !== undefined && !isLevel(x.level)) return null;
      return { t: 'aturKursi', kursi: x.kursi, jenis: x.jenis, level: x.level };
    case 'pengaturan': {
      const p = validasiPengaturan(x.pengaturan);
      return p ? { t: 'pengaturan', pengaturan: p } : null;
    }
    case 'mulai':
    case 'putaranBerikut':
      return pengocok(x.pengocok) ? { t: x.t, pengocok: x.pengocok as number | undefined } : null;
    case 'aksi': {
      const aksi = validasiAksi(x.aksi);
      return aksi ? { t: 'aksi', aksi } : null;
    }
    case 'akhiri':
      return typeof x.setuju === 'boolean' ? { t: 'akhiri', setuju: x.setuju } : null;
    case 'emote': {
      if (typeof x.isi !== 'string') return null;
      if ((DAFTAR_EMOTE as readonly string[]).includes(x.isi)) return { t: 'emote', isi: x.isi as Emote };
      // Emote dari aplikasi versi lama: diteruskan sebagai padanan barunya.
      const padanan = EMOTE_LAMA.get(x.isi);
      return padanan ? { t: 'emote', isi: padanan } : null;
    }
    default:
      return null;
  }
}

/**
 * Karakter yang selalu dibuang dari nama: kontrol (Cc), surrogate yatim (Cs), area pribadi (Co),
 * huruf "kosong" yang tampil sebagai spasi (Hangul filler U+115F/U+1160/U+3164/U+FFA0, braille
 * kosong U+2800), dan < > (sisa lama, jaga-jaga HTML). Karakter format (Cf) diurus `buangFormat`.
 */
const KARAKTER_BUANG = /[\p{Cc}\p{Cs}\p{Co}ᅟᅠㅤﾠ⠀<>]/gu;

const ZWNJ = 0x200c;
const ZWJ = 0x200d;
const BENDERA_HITAM = 0x1f3f4;
const TAG_AWAL = 0xe0020;
const TAG_AKHIR = 0xe007e;
const TAG_BATAL = 0xe007f;

/** Ujung kiri rangkaian emoji ZWJ: gambar, VS16 (U+FE0F), atau warna kulit (U+1F3FB–1F3FF). */
const EMOJI_KIRI = /[\p{Extended_Pictographic}\u{FE0F}\u{1F3FB}-\u{1F3FF}]/u;
const EMOJI_KANAN = /\p{Extended_Pictographic}/u;
/**
 * Aksara yang ejaannya memang memakai ZWJ/ZWNJ (Arab/Persia, aksara India, Sinhala, Khmer, Myanmar,
 * aksara Jawa/Bali/Sunda, ...). Di Latin/Yunani/Kiril penggabung tidak berguna dan hanya membuat
 * "Budi" kembar yang beda isi, jadi di sana tetap dibuang.
 */
const AKSARA_PENGGABUNG =
  /[\p{scx=Arab}\p{scx=Syrc}\p{scx=Nkoo}\p{scx=Mong}\p{scx=Deva}\p{scx=Beng}\p{scx=Guru}\p{scx=Gujr}\p{scx=Orya}\p{scx=Taml}\p{scx=Telu}\p{scx=Knda}\p{scx=Mlym}\p{scx=Sinh}\p{scx=Khmr}\p{scx=Mymr}\p{scx=Tibt}\p{scx=Java}\p{scx=Bali}\p{scx=Sund}]/u;
const HURUF_ATAU_TANDA = /[\p{L}\p{M}]/u;
const TANDA = /\p{M}/u;
const FORMAT = /\p{Cf}/u;
/** Nama harus memuat minimal satu karakter yang terlihat. */
const TERLIHAT = /[\p{L}\p{N}\p{S}\p{P}]/u;

/** Maksimal huruf (grapheme) di nama, dan batas code point total supaya rangkaian panjang tidak lolos. */
const MAKS_HURUF = 16;
const MAKS_CODE_POINT = 48;
/** Tanda gabung (aksen, harakat) per huruf; sisanya dibuang supaya teks "zalgo" tidak meluber. */
const MAKS_TANDA_PER_HURUF = 8;

const kode = (c: string | undefined) => (c === undefined ? -1 : c.codePointAt(0)!);

/**
 * Buang karakter format (Cf: pembalik arah U+202A–202E/U+2066–2069, zero-width space, BOM,
 * word joiner, karakter tag, ...), kecuali:
 * - ZWJ di dalam rangkaian emoji (👨‍👩‍👧, 🏳️‍🌈),
 * - ZWJ/ZWNJ di tengah aksara yang membutuhkannya (Persia "می‌خواهم", Devanagari "क्‍ष"),
 * - karakter tag di bendera bertag (🏴 + tag + U+E007F, mis. bendera Skotlandia).
 */
function buangFormat(s: string): string {
  const cp = Array.from(s);
  // Tahap 1: buang Cf selain penggabung; bendera bertag disimpan utuh sebagai satu unit.
  const unit: string[] = [];
  for (let i = 0; i < cp.length; i++) {
    const k = kode(cp[i]);
    if (k === BENDERA_HITAM) {
      let j = i + 1;
      while (j < cp.length && kode(cp[j]) >= TAG_AWAL && kode(cp[j]) <= TAG_AKHIR) j++;
      if (j > i + 1 && kode(cp[j]) === TAG_BATAL) {
        unit.push(cp.slice(i, j + 1).join(''));
        i = j;
        continue;
      }
      unit.push(cp[i]);
      continue;
    }
    if (k !== ZWJ && k !== ZWNJ && FORMAT.test(cp[i])) continue;
    unit.push(cp[i]);
  }
  // Tahap 2: penggabung hanya disimpan kalau diapit karakter yang memang memakainya.
  const hasil: string[] = [];
  for (let i = 0; i < unit.length; i++) {
    const k = kode(unit[i]);
    if (k !== ZWJ && k !== ZWNJ) {
      hasil.push(unit[i]);
      continue;
    }
    const kiriUnit = hasil.at(-1);
    const kiri = kiriUnit === undefined ? undefined : Array.from(kiriUnit).at(-1);
    const kanan = unit[i + 1] === undefined ? undefined : Array.from(unit[i + 1])[0];
    if (kiri === undefined) continue;
    const emoji = k === ZWJ && EMOJI_KIRI.test(kiri) && kanan !== undefined && EMOJI_KANAN.test(kanan);
    const aksaraKiri = HURUF_ATAU_TANDA.test(kiri) && AKSARA_PENGGABUNG.test(kiri);
    const aksara =
      aksaraKiri &&
      (kanan !== undefined && HURUF_ATAU_TANDA.test(kanan)
        ? AKSARA_PENGGABUNG.test(kanan)
        : // ZWJ sesudah virama di ujung kata (mis. chillu Malayalam lama).
          k === ZWJ && TANDA.test(kiri) && (kanan === undefined || /\s/u.test(kanan)));
    if (emoji || aksara) hasil.push(unit[i]);
  }
  return hasil.join('');
}

/** Potong per grapheme (huruf yang tampil) supaya emoji/aksara tidak terbelah. */
function potong(s: string): string {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Segmenter) return Array.from(s).slice(0, MAKS_HURUF).join('');
  let hasil = '';
  let jumlahHuruf = 0;
  let jumlahCp = 0;
  for (const { segment } of new Segmenter(undefined, { granularity: 'grapheme' }).segment(s)) {
    let tanda = 0;
    const huruf = Array.from(segment)
      .filter((c) => !TANDA.test(c) || ++tanda <= MAKS_TANDA_PER_HURUF)
      .join('');
    const n = Array.from(huruf).length;
    if (jumlahHuruf >= MAKS_HURUF || jumlahCp + n > MAKS_CODE_POINT) break;
    hasil += huruf;
    jumlahHuruf++;
    jumlahCp += n;
  }
  return hasil;
}

/**
 * Kunci pembanding nama tanpa beda huruf besar/kecil dan spasi tepi ("Budi", "budi " → "budi").
 * Dipakai meja (nama warga kedai tidak boleh kembar dengan nama orang), peringkat online, dan
 * statistik di HP. Huruf non-ASCII ikut dikecilkan (lower() SQLite hanya ASCII, jadi server
 * menghitung kunci ini di JS, bukan di SQL).
 */
export const kunciNama = (n: string): string => n.trim().toLocaleLowerCase('id-ID');

/**
 * Nama tampilan: dinormalisasi (NFKC), dibersihkan, maksimal 16 huruf. Kosong atau isinya tidak
 * ada yang terlihat → "Pemain".
 */
export function rapikanNama(nama: string): string {
  // NFKC menyeragamkan huruf lebar penuh/ligatur, tapi jamo kompatibilitas Korea (ㅋㅋㅋ) dibiarkan:
  // NFKC mengubahnya jadi jamo conjoining yang tampil lain.
  const normal = nama.replace(/[^ㄱ-ㆎ]+/gu, (x) => x.normalize('NFKC'));
  const bersih = buangFormat(normal.replace(KARAKTER_BUANG, '')).replace(/\s+/gu, ' ').trim();
  const pendek = potong(bersih);
  // Penggabung yatim di ujung potongan dibuang.
  const hasil = (pendek.length < bersih.length ? pendek.replace(/[‌‍]+$/u, '') : pendek).trim();
  return TERLIHAT.test(hasil) ? hasil : 'Pemain';
}
