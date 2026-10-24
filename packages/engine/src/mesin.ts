// Mesin aturan: state masuk + aksi → state baru. Murni dan deterministik (RNG ada di state).

import { klon } from './klon.js';
import { buatDeck, namaKartu, namaRank } from './kartu.js';
import { AturanError, langgar } from './error.js';
import { isJokerHidup, type KartuJadi, type KonteksJoker, type SpesifikasiKartuJadi } from './kartuJadi.js';
import {
  kembaranPungutan,
  pungutanBerlaku,
  validasiBuang,
  validasiMulung,
  validasiTurunkan,
  type HasilTurunkan,
} from './giliran.js';
import { hitungSkorPemain, nilaiPentunganTotal, PENGALI_KALDU } from './skor.js';
import { Rng, seedKeState } from './rng.js';
import { daftarNama, deskripsiKartuJadi } from './deskripsi.js';
import {
  KONFIGURASI_BAWAAN,
  type Aksi,
  type Arah,
  type GameState,
  type HasilPutaran,
  type IsiPeristiwa,
  type KonfigurasiPermainan,
  type Peristiwa,
  type StatePutaran,
} from './state.js';
import type { Kartu, Rank } from './kartu.js';

export type HasilAksi =
  | { ok: true; state: GameState }
  | { ok: false; error: { kode: AturanError['kode']; pesan: string } };

/** Tabel Bagian 3. */
export function aturanPembagian(
  jumlahPemain: number,
  duaDeckUntukEmpat: boolean,
): { jumlahDeck: number; kartuPerPemain: number } {
  if (jumlahPemain === 4 && duaDeckUntukEmpat) return { jumlahDeck: 2, kartuPerPemain: 12 };
  if (jumlahPemain >= 2 && jumlahPemain <= 4) return { jumlahDeck: 1, kartuPerPemain: 6 };
  if (jumlahPemain >= 5 && jumlahPemain <= 6) return { jumlahDeck: 2, kartuPerPemain: 9 };
  return langgar('KONFIGURASI_TIDAK_SAH', 'Jumlah pemain harus 2 sampai 6.');
}

export function totalKartu(konfigurasi: KonfigurasiPermainan): number {
  return aturanPembagian(konfigurasi.jumlahPemain, konfigurasi.duaDeckUntukEmpat).jumlahDeck * 52;
}

export function berikutnya(pemain: number, arah: Arah, jumlahPemain: number): number {
  return (((pemain + arah) % jumlahPemain) + jumlahPemain) % jumlahPemain;
}

export function ctxPutaran(p: Pick<StatePutaran, 'rankJoker' | 'jokerMati'>): KonteksJoker {
  return { rankJoker: p.rankJoker, jokerMati: p.jokerMati };
}

export function buatPermainan(opsi: {
  pemain: string[];
  seed: number | string;
  konfigurasi?: Partial<Omit<KonfigurasiPermainan, 'jumlahPemain'>>;
}): GameState {
  const konfigurasi: KonfigurasiPermainan = {
    ...KONFIGURASI_BAWAAN,
    ...opsi.konfigurasi,
    jumlahPemain: opsi.pemain.length,
  };
  aturanPembagian(konfigurasi.jumlahPemain, konfigurasi.duaDeckUntukEmpat);
  return {
    versi: 1,
    konfigurasi,
    pemain: opsi.pemain.map((nama) => ({ nama })),
    skor: opsi.pemain.map(() => 0),
    status: 'menungguPutaran',
    putaran: null,
    riwayat: [],
    arah: konfigurasi.arahAwal,
    rng: seedKeState(opsi.seed),
    log: [],
    peristiwa: [],
    alasanSelesai: null,
  };
}

/**
 * Calon pengocok: putaran pertama semua pemain; berikutnya pemain dengan skor akumulasi terendah.
 * Bila lebih dari satu, bebas (dipilih atau diacak).
 */
export function kandidatPengocok(state: GameState): number[] {
  const semua = state.pemain.map((_, i) => i);
  if (state.riwayat.length === 0) return semua;
  const min = Math.min(...state.skor);
  return semua.filter((i) => state.skor[i] === min);
}

/**
 * Mode kaldu (#42): apakah putaran berikutnya (nomor riwayat + 1) putaran kaldu. Ya kalau meja memakai
 * mode kaldu dan semua sudah sepakat "putaran berikutnya terakhir", atau nomornya sudah mencapai batas
 * putaran. Keduanya tidak pernah balik, jadi sesudah putaran kaldu yang deck-nya habis, putaran
 * berikutnya kaldu lagi. Bisa dipakai pada GameState maupun ViewPemain (info publik).
 */
export function putaranBerikutKaldu(g: {
  konfigurasi: Pick<KonfigurasiPermainan, 'batasPutaran' | 'modeKaldu'>;
  riwayat: readonly unknown[];
  kalduDiminta?: boolean;
}): boolean {
  const k = g.konfigurasi;
  if (k.modeKaldu !== true) return false;
  return g.kalduDiminta === true || (k.batasPutaran !== null && g.riwayat.length + 1 >= k.batasPutaran);
}

/**
 * Salinan untuk diubah. Entri `riwayat` dan `log` tidak pernah diubah setelah ditulis,
 * jadi cukup array-nya yang disalin; sisanya disalin dalam.
 */
function salinState(state: GameState): GameState {
  return {
    ...state,
    konfigurasi: { ...state.konfigurasi },
    pemain: state.pemain.map((p) => ({ ...p })),
    skor: [...state.skor],
    putaran: state.putaran && klon(state.putaran),
    riwayat: [...state.riwayat],
    log: [...state.log],
    peristiwa: [...state.peristiwa],
  };
}

export function terapkanAksi(state: GameState, aksi: Aksi): HasilAksi {
  const s = salinState(state);
  try {
    jalankan(s, aksi);
    return { ok: true, state: s };
  } catch (e) {
    if (e instanceof AturanError) return { ok: false, error: { kode: e.kode, pesan: e.pesan } };
    throw e;
  }
}

/**
 * Lengkapi state yang disimpan oleh versi lama (field yang ditambahkan belakangan diberi nilai awal).
 * Dipakai saat melanjutkan permainan dari simpanan.
 */
export function migrasiState(state: GameState): GameState {
  const s = state as GameState & Partial<Pick<GameState, 'peristiwa'>>;
  const n = s.pemain.length;
  const p = s.putaran as (StatePutaran & Partial<Pick<StatePutaran, 'selesaiSusun' | 'mulungBeruntun' | 'mentung' | 'asalKartu'>>) | null;
  // Field opsional tanpa nilai awal (tidak ada = bawaan lama): InfoMentung.pentunganLain dan
  // HasilPutaran.pentunganLain (#41, tidak ada = mentung satu kartu); pembacanya memakai `?? []`.
  // Mode kaldu (#42): KonfigurasiPermainan.modeKaldu, GameState.kalduDiminta, StatePutaran.kaldu,
  // HasilPutaran.kaldu, RincianSkor.pengaliPentungan; tidak ada = mati/bukan kaldu/pengali 1.
  // Keputusan #53: StatePutaran.kembaranWarisan hanya ditulis untuk satu state warisan (kembaranWarisan()).
  return {
    ...s,
    peristiwa: s.peristiwa ?? [],
    putaran: p && {
      ...p,
      selesaiSusun: p.selesaiSusun ?? Array(n).fill(false),
      mulungBeruntun: p.mulungBeruntun ?? Array(n).fill(0),
      mentung: p.mentung ?? null,
      asalKartu: p.asalKartu ?? {},
      ...(kembaranWarisan(s.status, p) ? { kembaranWarisan: true as const } : {}),
    },
  };
}

/**
 * Keputusan #53: dengan aturan baru, kartu terakhir di tangan pemain giliran (sesudah mulung) tidak pernah
 * kembaran kartu pungutannya (validasiTurunkan/validasiMulung menolaknya). Simpanan dari sebelum #53 bisa
 * berhenti tepat di situ (dulu sah: turunkan dulu, mentung pakai kembarannya). Tanpa penanda, giliran itu
 * tidak punya aksi sah dan warga kedai di kursi itu galat terus. Dengan penanda, giliran itu ditutup dengan
 * aturan lama (`pungutanBerlaku`); state lain tidak pernah ditandai, jadi golden tidak bergeser.
 */
function kembaranWarisan(status: GameState['status'], p: StatePutaran): boolean {
  if (status !== 'putaranBerjalan' || p.tahap !== 'main' || p.sumberAmbil !== 'buangan') return false;
  const tangan = p.tangan[p.giliran];
  return tangan?.length === 1 && kembaranPungutan(tangan[0], p.pungutan ?? []);
}

/** Versi yang melempar AturanError, praktis untuk test dan simulasi. */
export function terapkan(state: GameState, aksi: Aksi): GameState {
  const h = terapkanAksi(state, aksi);
  if (!h.ok) throw new AturanError(h.error.kode, h.error.pesan);
  return h.state;
}

function jalankan(s: GameState, aksi: Aksi): void {
  switch (aksi.jenis) {
    case 'mulaiPutaran':
      return mulaiPutaran(s, aksi.pengocok);
    case 'akhiriPermainan':
      return akhiriPermainan(s);
    case 'putaranTerakhir':
      return putaranTerakhir(s);
    case 'ambilDeck':
      return ambilDeck(s, aksi.pemain);
    case 'mulung':
      return mulung(s, aksi.pemain, aksi.jumlah, aksi.kartuJadi);
    case 'turunkan':
      if (s.status === 'susunAkhir') return turunkanAkhir(s, aksi.pemain, aksi.kartuJadi);
      return turunkan(s, aksi.pemain, aksi.kartuJadi);
    case 'selesaiSusun':
      return selesaiSusun(s, aksi.pemain);
    case 'buang':
      return buang(s, aksi.pemain, aksi.kartuId, aksi.kartuIdLain);
  }
}

function catat(s: GameState, pesan: string): void {
  s.log.push({ putaran: s.putaran?.nomor ?? s.riwayat.length + 1, pesan });
}

function terjadi(s: GameState, isi: IsiPeristiwa): void {
  const id = (s.peristiwa.at(-1)?.id ?? 0) + 1;
  s.peristiwa.push({ ...isi, id, putaran: s.putaran?.nomor ?? s.riwayat.length + 1 } as Peristiwa);
}

const isKembarAsEmpat = (kj: { jenis: string; kartu: unknown[] }) => kj.jenis === 'kembarAs' && kj.kartu.length === 4;

function nama(s: GameState, i: number): string {
  return s.pemain[i].nama;
}

/**
 * Buka kartu joker dari atas deck (sesudah semua kartu dibagi), lalu selipkan kembali ke posisi acak.
 * Keputusan #40: kalau angkanya sama dengan joker putaran tepat sebelumnya (`rankSebelumnya`), kartu itu
 * dianulir dan disisihkan dulu, lalu kartu berikutnya dibuka, sampai angkanya beda. Kartu joker
 * diselipkan dengan satu `rng.int` (persis cara lama), baru kartu yang dianulir diselipkan acak satu per
 * satu, jadi jumlah kartu deck tetap dan tidak ada kartu yang dibuka dua kali. Tanpa anulir, pemakaian
 * RNG dan urutan deck sama persis dengan sebelum aturan ini. Mengubah `deck` di tempat.
 */
export function bukaKartuJoker(deck: Kartu[], rankSebelumnya: Rank | null | undefined, rng: Rng): Kartu {
  const dianulir: Kartu[] = [];
  let kartu = deck.pop();
  while (kartu && kartu.rank === rankSebelumnya) {
    dianulir.push(kartu);
    kartu = deck.pop();
  }
  // Mustahil di meja sungguhan: sisa deck minimal 28 kartu, satu angka paling banyak 8 kartu.
  if (!kartu) {
    deck.push(...dianulir.reverse());
    return langgar('KONFIGURASI_TIDAK_SAH', 'Isi deck-nya angka joker putaran lalu semua, nggak bisa buka joker baru.');
  }
  deck.splice(rng.int(deck.length + 1), 0, kartu);
  for (const k of dianulir) deck.splice(rng.int(deck.length + 1), 0, k);
  return kartu;
}

function mulaiPutaran(s: GameState, pengocokDipilih: number | undefined): void {
  if (s.status !== 'menungguPutaran' && s.status !== 'putaranSelesai') {
    langgar('STATUS_SALAH', 'Putaran masih berjalan.');
  }
  const rng = new Rng(s.rng);
  const kandidat = kandidatPengocok(s);
  let pengocok: number;
  if (pengocokDipilih === undefined) pengocok = rng.pick(kandidat);
  else if (kandidat.includes(pengocokDipilih)) pengocok = pengocokDipilih;
  else langgar('PENGOCOK_TIDAK_SAH', 'Pengocok harus pemain dengan skor akumulasi terendah.');

  const n = s.konfigurasi.jumlahPemain;
  const { jumlahDeck, kartuPerPemain } = aturanPembagian(n, s.konfigurasi.duaDeckUntukEmpat);
  const deck = rng.shuffle(buatDeck(jumlahDeck));
  const tangan: Kartu[][] = s.pemain.map(() => []);
  for (let i = 0; i < kartuPerPemain; i++) {
    for (let p = 0; p < n; p++) tangan[(pengocok + p) % n].push(deck.pop()!);
  }
  // Riwayat hanya berisi putaran yang sudah selesai, jadi entri terakhirnya putaran tepat sebelumnya.
  const kartuDibuka = bukaKartuJoker(deck, s.riwayat.at(-1)?.rankJoker, rng);
  const kaldu = putaranBerikutKaldu(s);

  s.rng = rng.state;
  s.putaran = {
    nomor: s.riwayat.length + 1,
    pengocok,
    arah: s.arah,
    kartuDibuka,
    rankJoker: kartuDibuka.rank,
    deck,
    buangan: [],
    tangan,
    kartuJadi: s.pemain.map(() => []),
    giliran: pengocok,
    tahap: 'ambil',
    sumberAmbil: null,
    pungutan: [],
    jokerMati: [],
    jokerDibuang: s.pemain.map(() => 0),
    deckHabis: false,
    selesaiSusun: s.pemain.map(() => false),
    mulungBeruntun: s.pemain.map(() => 0),
    mentung: null,
    asalKartu: {},
    urutanKartuJadi: 0,
    // Hanya ditulis kalau kaldu, supaya golden dan simpanan lama tidak berubah.
    ...(kaldu ? { kaldu: true as const } : {}),
  };
  s.status = 'putaranBerjalan';
  catat(
    s,
    // Angka joker hanya diumumkan sekali di awal putaran, jadi tidak dicatat di log.
    `Putaran ${s.putaran.nomor} dimulai. ${nama(s, pengocok)} ngocok.${kaldu ? ' Putaran kaldu: pentungan dikali dua.' : ''}`,
  );
  terjadi(s, { jenis: 'mulaiPutaran', pengocok, rankJoker: kartuDibuka.rank, ...(kaldu ? { kaldu: true as const } : {}) });
}

function akhiriPermainan(s: GameState): void {
  if (s.status !== 'menungguPutaran' && s.status !== 'putaranSelesai') {
    langgar('STATUS_SALAH', 'Permainan cuma bisa diakhiri di antara putaran.');
  }
  s.status = 'selesai';
  s.alasanSelesai = 'sepakat';
  catat(s, 'Semua sepakat berhenti. Permainan selesai.');
}

/**
 * Mode kaldu (#42): putaran berikutnya jadi putaran kaldu (meja memanggilnya sesudah semua manusia
 * setuju). Hanya di antara putaran, hanya di meja mode kaldu, dan tidak bisa diulang.
 */
function putaranTerakhir(s: GameState): void {
  if (s.status !== 'menungguPutaran' && s.status !== 'putaranSelesai') {
    langgar('STATUS_SALAH', 'Putaran terakhir cuma bisa diminta di antara putaran.');
  }
  if (s.konfigurasi.modeKaldu !== true) langgar('KONFIGURASI_TIDAK_SAH', 'Meja ini nggak pakai mode kaldu.');
  if (putaranBerikutKaldu(s)) langgar('STATUS_SALAH', 'Putaran berikutnya memang sudah putaran terakhir.');
  s.kalduDiminta = true;
  catat(s, 'Sepakat: putaran berikutnya putaran kaldu.');
}

function putaranAktif(s: GameState, pemain: number, tahap: StatePutaran['tahap']): StatePutaran {
  if (s.status !== 'putaranBerjalan' || !s.putaran) langgar('STATUS_SALAH', 'Belum ada putaran yang berjalan.');
  const p = s.putaran;
  if (p.giliran !== pemain) langgar('BUKAN_GILIRAN', `Sabar, sekarang gilirannya ${nama(s, p.giliran)}.`);
  if (p.tahap !== tahap) {
    langgar('TAHAP_SALAH', tahap === 'ambil' ? 'Kamu sudah ambil kartu giliran ini.' : 'Ambil kartu dulu (dari deck atau mulung).');
  }
  return p;
}

function ambilDeck(s: GameState, pemain: number): void {
  const p = putaranAktif(s, pemain, 'ambil');
  const kartu = p.deck.pop();
  if (!kartu) langgar('DECK_KOSONG', 'Deck sudah habis.');
  p.tangan[pemain].push(kartu);
  p.sumberAmbil = 'deck';
  p.tahap = 'main';
  if (p.deck.length === 0) p.deckHabis = true;
  p.mulungBeruntun[pemain] = 0;
  terjadi(s, { jenis: 'ambilDeck', pemain, deckHabis: p.deckHabis });
  catat(s, `${nama(s, pemain)} ambil kartu dari deck.${p.deckHabis ? ' Deck habis. Setelah giliran ini semua pemain dapat kesempatan terakhir menurunkan kartu jadi.' : ''}`);
}

function pasangKartuJadi(p: StatePutaran, pemain: number, hasil: HasilTurunkan): KartuJadi[] {
  p.tangan[pemain] = hasil.sisaTangan;
  const baru = hasil.kartuJadi.map((kj) => ({
    id: `kj${++p.urutanKartuJadi}`,
    pemilik: pemain,
    jenis: kj.jenis,
    kartu: kj.kartu.map((d) => {
      const dari = p.asalKartu[d.kartu.id];
      return dari === undefined || dari === pemain ? d : { ...d, dari };
    }),
  }));
  p.kartuJadi[pemain].push(...baru);
  return baru;
}

function mulung(s: GameState, pemain: number, jumlah: number, spesifikasi: SpesifikasiKartuJadi[]): void {
  const p = putaranAktif(s, pemain, 'ambil');
  const hasil = validasiMulung({
    tangan: p.tangan[pemain],
    buangan: p.buangan,
    punyaKartuJadi: p.kartuJadi[pemain].length > 0,
    jumlahPemain: s.konfigurasi.jumlahPemain,
    jumlah,
    spesifikasi,
    ctx: ctxPutaran(p),
  });
  p.buangan.splice(p.buangan.length - jumlah, jumlah);
  for (const e of hasil.diambil) p.asalKartu[e.kartu.id] = e.pemilik;
  p.pungutan = hasil.diambil;
  p.sumberAmbil = 'buangan';
  p.tahap = 'main';
  const baru = pasangKartuJadi(p, pemain, hasil);
  p.mulungBeruntun[pemain]++;
  catat(
    s,
    `${nama(s, pemain)} mulung ${jumlah} kartu dari buangan, menjadikan ${baru.map(deskripsiKartuJadi).join(' dan ')}.`,
  );
  const n = s.konfigurasi.jumlahPemain;
  terjadi(s, {
    jenis: 'mulung',
    pemain,
    kartu: hasil.diambil,
    idKartuJadi: baru.map((kj) => kj.id),
    sapuBersih: n >= 3 && jumlah === n - 1,
    beruntun: p.mulungBeruntun[pemain],
    kembarAs: baru.some(isKembarAsEmpat),
  });
}

function turunkan(s: GameState, pemain: number, spesifikasi: SpesifikasiKartuJadi[]): void {
  const p = putaranAktif(s, pemain, 'main');
  const hasil = validasiTurunkan(
    p.tangan[pemain],
    spesifikasi,
    p.kartuJadi[pemain].length > 0,
    p.sumberAmbil!,
    ctxPutaran(p),
    pungutanBerlaku(p),
  );
  const baru = pasangKartuJadi(p, pemain, hasil);
  catat(s, `${nama(s, pemain)} menurunkan ${baru.map(deskripsiKartuJadi).join(' dan ')}.`);
  terjadi(s, { jenis: 'turunkan', pemain, idKartuJadi: baru.map((kj) => kj.id), kembarAs: baru.some(isKembarAsEmpat) });
}

function buang(s: GameState, pemain: number, kartuId: string, kartuIdLain: string[] | undefined): void {
  const p = putaranAktif(s, pemain, 'main');
  const ctx = ctxPutaran(p);
  const hasil = validasiBuang({
    tangan: p.tangan[pemain],
    punyaKartuJadi: p.kartuJadi[pemain].length > 0,
    sumberAmbil: p.sumberAmbil!,
    kartuId,
    kartuIdLain,
    pungutan: pungutanBerlaku(p),
    ctx,
    asJokerBolehDibuangTanpaJadi: s.konfigurasi.asJokerBolehDibuangTanpaJadi,
  });
  const { kartu, kartuLain } = hasil;
  // Status joker dibaca sebelum ada yang ditandai mati. Kartu lain (keputusan #41) pasti joker hidup.
  const jokerHidup = isJokerHidup(kartu, ctx);
  const semua = [kartu, ...kartuLain];
  const dibuang = new Set(semua.map((k) => k.id));
  p.tangan[pemain] = p.tangan[pemain].filter((k) => !dibuang.has(k.id));
  // Joker yang dibuang kehilangan status jokernya.
  if (jokerHidup) p.jokerMati.push(kartu.id);
  for (const k of kartuLain) p.jokerMati.push(k.id);
  if (hasil.kenaPenaltiJoker) p.jokerDibuang[pemain]++;
  for (const k of semua) p.buangan.push({ kartu: k, pemilik: pemain });
  // Tetap satu peristiwa buang; `kartuLain` hanya ditulis kalau ada (golden dan simpanan lama tidak berubah).
  terjadi(s, {
    jenis: 'buang',
    pemain,
    kartu,
    ...(kartuLain.length ? { kartuLain } : {}),
    jokerDibuang: hasil.kenaPenaltiJoker,
    sisaTangan: p.tangan[pemain].length,
  });

  if (hasil.mentung) {
    catat(s, `${nama(s, pemain)} mentung pakai ${daftarNama(semua.map(namaKartu))}!`);
    // Kepentung dan arah ditentukan sekarang; skor dihitung setelah susun akhir.
    const kepentung = hitungKepentung(p, pemain);
    const lain = kartuLain.length ? { pentunganLain: kartuLain } : {};
    p.mentung = { pemain, pentungan: kartu, pentunganJoker: jokerHidup, kepentung, ...lain };
    const tepatSebelum = berikutnya(pemain, (-p.arah) as Arah, s.konfigurasi.jumlahPemain);
    terjadi(s, {
      jenis: 'mentung',
      pemain,
      pentungan: kartu,
      pentunganJoker: jokerHidup,
      ...lain,
      // Putaran kaldu (#42): nilainya sudah dikali, sama dengan yang nanti masuk skor.
      nilai: nilaiPentunganTotal(kartu, jokerHidup, kartuLain) * (p.kaldu ? PENGALI_KALDU : 1),
      kepentung,
      dibalik: kepentung.includes(tepatSebelum),
      ...(p.kaldu ? { kaldu: true as const } : {}),
    });
    return mulaiSusunAkhir(s, 'mentung');
  }
  // Seperti di meja asli: kartu yang dibuang tidak dicatat di log, harus diingat sendiri.
  catat(s, `${nama(s, pemain)} buang kartu.`);
  if (p.deckHabis) return mulaiSusunAkhir(s, 'deckHabis');

  p.giliran = berikutnya(pemain, p.arah, s.konfigurasi.jumlahPemain);
  p.tahap = 'ambil';
  p.sumberAmbil = null;
  p.pungutan = [];
  delete p.kembaranWarisan;
}

/**
 * Susun akhir (deck habis atau ada yang mentung): semua pemain boleh menurunkan kartu jadi dari
 * tangan tanpa mulung, lalu Selesai. Pemain yang tangannya sudah kosong (yang mentung) langsung selesai.
 */
function mulaiSusunAkhir(s: GameState, sebab: 'deckHabis' | 'mentung'): void {
  const p = s.putaran!;
  s.status = 'susunAkhir';
  p.selesaiSusun = p.tangan.map((t) => t.length === 0);
  p.sumberAmbil = null;
  p.pungutan = [];
  delete p.kembaranWarisan;
  catat(
    s,
    `${sebab === 'mentung' ? 'Sebelum dihitung' : 'Deck habis'}. Semua pemain boleh menurunkan kartu jadi dari tangan (tanpa mulung), lalu tekan Selesai.`,
  );
  terjadi(s, { jenis: 'susunAkhir', sebab });
  if (p.selesaiSusun.every(Boolean)) selesaiSemuaSusun(s);
}

function selesaiSemuaSusun(s: GameState): void {
  const m = s.putaran!.mentung;
  if (m) selesaikanPutaran(s, m.pemain, m.pentungan, m.pentunganJoker, m.pentunganLain ?? []);
  else selesaikanPutaran(s, null, null, false, []);
}

function pemainSusunAkhir(s: GameState, pemain: number): StatePutaran {
  if (s.status !== 'susunAkhir' || !s.putaran) langgar('STATUS_SALAH', 'Belum waktunya susun akhir.');
  if (!Number.isInteger(pemain) || pemain < 0 || pemain >= s.pemain.length) langgar('BUKAN_GILIRAN', 'Pemain tidak dikenal.');
  if (s.putaran.selesaiSusun[pemain]) langgar('TAHAP_SALAH', 'Kamu sudah selesai menyusun.');
  return s.putaran;
}

function turunkanAkhir(s: GameState, pemain: number, spesifikasi: SpesifikasiKartuJadi[]): void {
  const p = pemainSusunAkhir(s, pemain);
  // Susun akhir tidak punya pungutan (dikosongkan di mulaiSusunAkhir) dan tidak ada buang.
  const hasil = validasiTurunkan(p.tangan[pemain], spesifikasi, p.kartuJadi[pemain].length > 0, 'akhir', ctxPutaran(p), []);
  const baru = pasangKartuJadi(p, pemain, hasil);
  catat(s, `${nama(s, pemain)} menurunkan ${baru.map(deskripsiKartuJadi).join(' dan ')}.`);
  terjadi(s, { jenis: 'turunkan', pemain, idKartuJadi: baru.map((kj) => kj.id), kembarAs: baru.some(isKembarAsEmpat) });
}

function selesaiSusun(s: GameState, pemain: number): void {
  const p = pemainSusunAkhir(s, pemain);
  p.selesaiSusun[pemain] = true;
  if (p.selesaiSusun.every(Boolean)) selesaiSemuaSusun(s);
}

/** Siapa yang kepentung: pemilik kartu pungutan (giliran mentung) yang dipakai di kartu jadi. */
export function hitungKepentung(p: StatePutaran, pementung: number): number[] {
  const diKartuJadi = new Set(p.kartuJadi[pementung].flatMap((kj) => kj.kartu.map((d) => d.kartu.id)));
  const pemilik = new Set(
    p.pungutan.filter((e) => diKartuJadi.has(e.kartu.id) && e.pemilik !== pementung).map((e) => e.pemilik),
  );
  return [...pemilik].sort((a, b) => a - b);
}

function selesaikanPutaran(
  s: GameState,
  pementung: number | null,
  pentungan: Kartu | null,
  pentunganJoker: boolean,
  /** Keputusan #41: joker hidup lain yang ikut jadi pentungan (kosong = satu kartu). */
  pentunganLain: Kartu[],
): void {
  const p = s.putaran!;
  const n = s.konfigurasi.jumlahPemain;
  const ctx = ctxPutaran(p);
  const kepentung = pementung === null ? [] : (p.mentung?.kepentung ?? hitungKepentung(p, pementung));
  // Satu nilai total: yang mentung dapat sekali, tiap kepentung kena penuh. Putaran kaldu (#42): dikali
  // PENGALI_KALDU untuk keduanya, bagian skor lain tetap.
  const dasarPentungan = pentungan ? nilaiPentunganTotal(pentungan, pentunganJoker, pentunganLain) : 0;
  const pengali = p.kaldu ? PENGALI_KALDU : 1;
  const nilai = dasarPentungan * pengali;
  const tepatSebelum = pementung === null ? null : berikutnya(pementung, (-p.arah) as Arah, n);
  const dibalik = tepatSebelum !== null && kepentung.includes(tepatSebelum);
  const arahBerikutnya = (dibalik ? -p.arah : p.arah) as Arah;

  const rincian = s.pemain.map((_, i) =>
    hitungSkorPemain({
      pemain: i,
      status: i === pementung ? 'mentung' : kepentung.includes(i) ? 'kepentung' : 'aman',
      kartuJadi: p.kartuJadi[i],
      tangan: p.tangan[i],
      nilaiPentungan: dasarPentungan,
      ...(pengali !== 1 ? { pengaliPentungan: pengali } : {}),
      jumlahJokerDibuang: p.jokerDibuang[i],
      ctx,
    }),
  );
  rincian.forEach((r) => (s.skor[r.pemain] += r.total));

  const hasil: HasilPutaran = {
    nomor: p.nomor,
    pengocok: p.pengocok,
    rankJoker: p.rankJoker,
    cara: pementung === null ? 'deckHabis' : 'mentung',
    pementung,
    pentungan,
    pentunganJoker,
    // Hanya ditulis kalau ada, supaya riwayat lama dan golden tidak berubah.
    ...(pentunganLain.length ? { pentunganLain } : {}),
    nilaiPentungan: nilai,
    ...(p.kaldu ? { kaldu: true as const } : {}),
    kepentung,
    rincian,
    arahSebelumnya: p.arah,
    arahBerikutnya,
    dibalik,
    skorAkumulasi: [...s.skor],
  };
  s.riwayat.push(hasil);
  s.arah = arahBerikutnya;
  terjadi(s, { jenis: 'putaranSelesai', cara: hasil.cara });

  if (pementung === null) catat(s, `Deck habis. Putaran ${p.nomor} selesai, semua dihitung skor dasar.`);
  else if (kepentung.length === 0) catat(s, `Nggak ada yang kepentung. Arah tetap.`);
  else {
    catat(
      s,
      `${daftarNama(kepentung.map((i) => nama(s, i)))} kepentung. ${dibalik ? 'Arah putaran berikutnya dibalik.' : 'Lompat, arah tetap.'}`,
    );
  }

  const k = s.konfigurasi;
  if (k.modeKaldu === true) {
    // Mode kaldu (#42, #43): hanya putaran kaldu yang ditutup mentung yang mengakhiri permainan. Batas
    // skor diabaikan, dan batas putaran cuma memicu kaldu. Selain itu tetap bisa "Akhiri permainan".
    if (p.kaldu && pementung !== null) s.alasanSelesai = 'kaldu';
  } else if (k.batasSkorAtas !== null && s.skor.some((x) => x >= k.batasSkorAtas!)) s.alasanSelesai = 'batasSkor';
  else if (k.batasSkorBawah !== null && s.skor.some((x) => x <= k.batasSkorBawah!)) s.alasanSelesai = 'batasSkor';
  else if (k.batasPutaran !== null && s.riwayat.length >= k.batasPutaran) s.alasanSelesai = 'batasPutaran';
  s.status = s.alasanSelesai ? 'selesai' : 'putaranSelesai';
  if (s.status === 'selesai') catat(s, 'Permainan selesai.');
  else if (p.kaldu) catat(s, 'Belum ada yang mentung, kaldu lagi.');
}
