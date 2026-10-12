// Validasi kartu jadi (seri dan kembar As) serta aturan joker.

import {
  AS,
  isAngka,
  isAs,
  isLondo,
  J,
  K,
  namaKartu,
  namaRank,
  nilaiDasar,
  Q,
  SEMUA_BUNGA,
  type Bunga,
  type Kartu,
  type Rank,
} from './kartu.js';
import { AturanError, langgar } from './error.js';

export interface KonteksJoker {
  /** Angka kartu yang dibuka di awal putaran. */
  rankJoker: Rank;
  /** Id kartu joker yang sudah pernah dibuang: kehilangan status joker, jadi kartu biasa. */
  jokerMati: readonly string[];
}

/** Joker hidup = angkanya sama dengan angka joker dan belum pernah dibuang di putaran ini. */
export function isJokerHidup(k: Kartu, ctx: KonteksJoker): boolean {
  return k.rank === ctx.rankJoker && !ctx.jokerMati.includes(k.id);
}

/** Kartu yang diwakili sebuah kartu di kartu jadi. */
export interface Peran {
  rank: Rank;
  bunga: Bunga;
}

export interface KartuDiMeja {
  kartu: Kartu;
  /** Kartu yang diwakili. Sama dengan kartu aslinya bila tidak menggantikan apa pun. */
  sebagai: Peran;
  /** true bila joker menggantikan kartu lain; false bila dipakai sebagai kartu aslinya. */
  pengganti: boolean;
  /** Kartu ini dipungut dari buangan milik pemain ini (terlihat semua orang saat dipungut). */
  dari?: number;
}

export type JenisKartuJadi = 'seri' | 'kembarAs';

export interface KartuJadi {
  id: string;
  pemilik: number;
  jenis: JenisKartuJadi;
  /** Terurut menurut kartu yang diwakili. */
  kartu: KartuDiMeja[];
}

/** Satu kartu yang diajukan untuk kartu jadi. `sebagai` hanya diisi bila joker menggantikan kartu lain. */
export interface PilihanKartu {
  id: string;
  sebagai?: Peran;
}

export type SpesifikasiKartuJadi = PilihanKartu[];

export interface HasilValidasiKartuJadi {
  jenis: JenisKartuJadi;
  kartu: KartuDiMeja[];
}

function tidakSah(pesan: string): never {
  return langgar('KARTU_JADI_TIDAK_SAH', pesan);
}

/**
 * Validasi satu kombinasi. Melempar AturanError bila tidak sah.
 * Tidak memeriksa syarat yang bergantung pada konteks giliran (3 As, modal mulung).
 */
export function validasiKartuJadi(
  items: readonly { kartu: Kartu; sebagai?: Peran }[],
  ctx: KonteksJoker,
): HasilValidasiKartuJadi {
  if (items.length < 3) tidakSah('Kartu jadi minimal 3 kartu.');

  const diMeja: KartuDiMeja[] = items.map(({ kartu, sebagai }) => {
    if (!sebagai || (sebagai.rank === kartu.rank && sebagai.bunga === kartu.bunga)) {
      return { kartu, sebagai: { rank: kartu.rank, bunga: kartu.bunga }, pengganti: false };
    }
    if (!isJokerHidup(kartu, ctx)) {
      langgar('JOKER_TIDAK_SAH', `${namaKartu(kartu)} bukan joker, nggak bisa menggantikan kartu lain.`);
    }
    if (isLondo(sebagai.rank) || isAs(sebagai.rank)) {
      langgar('JOKER_TIDAK_SAH', 'Joker nggak bisa menggantikan Londo (J, Q, K) atau As.');
    }
    return { kartu, sebagai: { rank: sebagai.rank, bunga: sebagai.bunga }, pengganti: true };
  });

  const jumlahAs = diMeja.filter((d) => isAs(d.sebagai.rank)).length;
  if (jumlahAs > 0) {
    if (jumlahAs !== diMeja.length) tidakSah('As cuma bisa dijadikan kembar As, nggak bisa masuk seri.');
    return { jenis: 'kembarAs', kartu: validasiKembarAs(diMeja) };
  }
  return { jenis: 'seri', kartu: validasiSeri(diMeja) };
}

function validasiKembarAs(diMeja: KartuDiMeja[]): KartuDiMeja[] {
  if (diMeja.length > 4) tidakSah('Kembar As maksimal 4 kartu.');
  const bunga = new Set(diMeja.map((d) => d.sebagai.bunga));
  if (bunga.size !== diMeja.length) tidakSah('Kembar As harus beda bunga semua.');
  return [...diMeja].sort(
    (a, b) => SEMUA_BUNGA.indexOf(a.sebagai.bunga) - SEMUA_BUNGA.indexOf(b.sebagai.bunga),
  );
}

function validasiSeri(diMeja: KartuDiMeja[]): KartuDiMeja[] {
  const bunga = new Set(diMeja.map((d) => d.sebagai.bunga));
  if (bunga.size !== 1) {
    const semuaSamaAngka = new Set(diMeja.map((d) => d.sebagai.rank)).size === 1;
    tidakSah(
      semuaSamaAngka
        ? 'Kembar cuma berlaku untuk As. Kartu angka/Londo harus seri satu bunga.'
        : 'Seri harus satu bunga.',
    );
  }
  const urut = [...diMeja].sort((a, b) => a.sebagai.rank - b.sebagai.rank);
  const adaAngka = urut.some((d) => isAngka(d.sebagai.rank));
  const adaLondo = urut.some((d) => isLondo(d.sebagai.rank));
  if (adaAngka && adaLondo) tidakSah('Angka dan Londo nggak bisa disambung dalam satu seri.');

  for (let i = 1; i < urut.length; i++) {
    if (urut[i].sebagai.rank === urut[i - 1].sebagai.rank) {
      tidakSah(`Ada dua kartu ${namaRank(urut[i].sebagai.rank)} di seri yang sama.`);
    }
    if (urut[i].sebagai.rank !== urut[i - 1].sebagai.rank + 1) tidakSah('Angkanya harus berurutan.');
  }

  const pengganti = urut.filter((d) => d.pengganti).length;
  if (pengganti > urut.length - pengganti) {
    langgar('JOKER_TIDAK_SAH', 'Jokernya kebanyakan, Bos. Joker pengganti maksimal sama dengan kartu biasa.');
  }
  for (let i = 1; i < urut.length; i++) {
    if (urut[i].pengganti && urut[i - 1].pengganti) {
      langgar('JOKER_TIDAK_SAH', 'Joker nggak boleh dempet. Kalau pakai lebih dari satu, harus selang-seling.');
    }
  }
  return urut;
}

/** Nilai kartu di kartu jadi: joker pengganti bernilai kartu yang digantikan. */
export function nilaiKartuDiMeja(d: KartuDiMeja): number {
  return nilaiDasar(d.sebagai.rank);
}

export function nilaiKartuJadi(kj: { kartu: readonly KartuDiMeja[] }): number {
  return kj.kartu.reduce((s, d) => s + nilaiKartuDiMeja(d), 0);
}

/** Nilai kartu di tangan: joker hidup = 25. */
export function nilaiKartuTangan(k: Kartu, ctx: KonteksJoker): number {
  return isJokerHidup(k, ctx) ? 25 : nilaiDasar(k.rank);
}

export function isKembarAsTiga(kj: HasilValidasiKartuJadi): boolean {
  return kj.jenis === 'kembarAs' && kj.kartu.length === 3;
}

function cobaValidasi(
  items: readonly { kartu: Kartu; sebagai?: Peran }[],
  ctx: KonteksJoker,
): HasilValidasiKartuJadi | null {
  try {
    return validasiKartuJadi(items, ctx);
  } catch (e) {
    if (e instanceof AturanError) return null;
    throw e;
  }
}

/**
 * Semua cara sah membaca sekumpulan kartu sebagai satu kartu jadi.
 * Dipakai UI: bila hasilnya lebih dari satu, pemain diminta memilih peran joker.
 * Hasil yang hanya berbeda pada joker mana yang mengisi slot mana dianggap sama.
 */
export function opsiPeranJoker(kartu: readonly Kartu[], ctx: KonteksJoker): HasilValidasiKartuJadi[] {
  const hasil: HasilValidasiKartuJadi[] = [];
  const tanda = new Set<string>();
  const tambah = (h: HasilValidasiKartuJadi | null) => {
    if (!h) return;
    const sig = h.kartu
      .map((d) => `${d.sebagai.rank}${d.sebagai.bunga}${d.pengganti ? '*' : ''}`)
      .join(',');
    if (tanda.has(sig)) return;
    tanda.add(sig);
    hasil.push(h);
  };

  tambah(cobaValidasi(kartu.map((k) => ({ kartu: k })), ctx));

  const joker = kartu.filter((k) => isJokerHidup(k, ctx));
  const biasa = kartu.filter((k) => !isJokerHidup(k, ctx));
  if (joker.length === 0 || biasa.length === 0) return hasil;
  const bungaBiasa = new Set(biasa.map((k) => k.bunga));
  if (bungaBiasa.size !== 1) return hasil;
  const bunga = biasa[0].bunga;
  const m = kartu.length;

  for (let awal = 2; awal + m - 1 <= 10; awal++) {
    const slot = new Set<number>();
    for (let r = awal; r < awal + m; r++) slot.add(r);
    if (!biasa.every((k) => slot.has(k.rank))) continue;
    for (const k of biasa) slot.delete(k.rank);
    const kosong = [...slot] as Rank[];
    if (kosong.length !== joker.length) continue;
    for (const urutan of permutasi(joker)) {
      const items = [
        ...biasa.map((k) => ({ kartu: k })),
        ...urutan.map((k, i) => ({ kartu: k, sebagai: { rank: kosong[i], bunga } })),
      ];
      tambah(cobaValidasi(items, ctx));
    }
  }
  return hasil;
}

function* permutasi<T>(arr: readonly T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield [...arr];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const sisa = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutasi(sisa)) yield [arr[i], ...p];
  }
}

/**
 * Daftar kandidat kartu jadi sah dari sekumpulan kartu (boleh saling tumpang tindih).
 * Tidak lengkap secara kombinatorik, tapi cukup untuk bot: satu cara per jendela seri.
 */
export function cariKandidatKartuJadi(kartu: readonly Kartu[], ctx: KonteksJoker): SpesifikasiKartuJadi[] {
  const hasil: SpesifikasiKartuJadi[] = [];
  const cek = (spek: SpesifikasiKartuJadi) => {
    const items = spek.map((p) => ({ kartu: kartu.find((k) => k.id === p.id)!, sebagai: p.sebagai }));
    if (cobaValidasi(items, ctx)) hasil.push(spek);
  };

  // Kembar As: satu kartu per bunga.
  const asPerBunga = new Map<Bunga, Kartu>();
  for (const k of kartu) if (k.rank === AS && !asPerBunga.has(k.bunga)) asPerBunga.set(k.bunga, k);
  const asUnik = [...asPerBunga.values()];
  if (asUnik.length === 4) cek(asUnik.map((k) => ({ id: k.id })));
  if (asUnik.length >= 3) {
    for (let buang = 0; buang < asUnik.length; buang++) {
      const tiga = asUnik.filter((_, i) => i !== buang);
      if (tiga.length === 3) cek(tiga.map((k) => ({ id: k.id })));
    }
  }

  for (const bunga of SEMUA_BUNGA) {
    const cari = (rank: Rank, hanyaBiasa: boolean) =>
      kartu.find(
        (k) => k.bunga === bunga && k.rank === rank && (!hanyaBiasa || !isJokerHidup(k, ctx)),
      );

    // Seri Londo: J-Q-K, joker tidak bisa menggantikan Londo.
    const londo = [J, Q, K].map((r) => cari(r, false));
    if (londo.every(Boolean)) cek(londo.map((k) => ({ id: k!.id })));

    // Seri angka 2 s/d 10.
    for (let awal = 2; awal <= 8; awal++) {
      for (let akhir = awal + 2; akhir <= 10; akhir++) {
        const dipakai = new Set<string>();
        const slot: (PilihanKartu | null)[] = [];
        for (let r = awal; r <= akhir; r++) {
          const k = cari(r as Rank, true) ?? cari(r as Rank, false);
          if (k && !dipakai.has(k.id)) {
            dipakai.add(k.id);
            slot.push({ id: k.id });
          } else slot.push(null);
        }
        const kosong = slot.filter((s) => s === null).length;
        if (kosong > slot.length - kosong) continue;
        if (slot.some((s, i) => s === null && i > 0 && slot[i - 1] === null)) continue;
        const jokerBebas = kartu.filter((k) => isJokerHidup(k, ctx) && !dipakai.has(k.id));
        if (jokerBebas.length < kosong) continue;
        let j = 0;
        const spek = slot.map((s, i) =>
          s ?? { id: jokerBebas[j++].id, sebagai: { rank: (awal + i) as Rank, bunga } },
        );
        cek(spek);
      }
    }
  }
  return hasil;
}
