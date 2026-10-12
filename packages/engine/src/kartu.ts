// Kartu, bunga, angka, dan nilai dasar.

export type Bunga = 'waru' | 'love' | 'kriting' | 'wajik';

export const SEMUA_BUNGA: readonly Bunga[] = ['waru', 'love', 'kriting', 'wajik'];

export const NAMA_BUNGA: Record<Bunga, string> = {
  waru: 'Waru',
  love: 'Love',
  kriting: 'Kriting',
  wajik: 'Wajik',
};

/** 1 = As, 2..10 = angka, 11 = J, 12 = Q, 13 = K. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export const AS: Rank = 1;
export const J: Rank = 11;
export const Q: Rank = 12;
export const K: Rank = 13;

export const SEMUA_RANK: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export interface Kartu {
  /** Unik di seluruh deck, contoh "love-7-0" (deck ke-0). */
  id: string;
  bunga: Bunga;
  rank: Rank;
  deck: number;
}

/** Londo = J, Q, K. */
export function isLondo(rank: Rank): boolean {
  return rank >= 11;
}

export function isAs(rank: Rank): boolean {
  return rank === AS;
}

/** Kartu angka 2 s/d 10. */
export function isAngka(rank: Rank): boolean {
  return rank >= 2 && rank <= 10;
}

/** Nilai kartu di tangan / di kartu jadi (tanpa memperhitungkan joker). */
export function nilaiDasar(rank: Rank): number {
  if (isAs(rank)) return 15;
  if (isLondo(rank)) return 10;
  return 5;
}

export function namaRank(rank: Rank): string {
  switch (rank) {
    case 1:
      return 'As';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(rank);
  }
}

export function namaKartu(k: { rank: Rank; bunga: Bunga }): string {
  return `${namaRank(k.rank)} ${NAMA_BUNGA[k.bunga]}`;
}

export function idKartu(bunga: Bunga, rank: Rank, deck: number): string {
  return `${bunga}-${rank}-${deck}`;
}

export function buatKartu(bunga: Bunga, rank: Rank, deck = 0): Kartu {
  return { id: idKartu(bunga, rank, deck), bunga, rank, deck };
}

/** Deck tanpa kartu bergambar joker: 52 kartu per deck. */
export function buatDeck(jumlahDeck: number): Kartu[] {
  const hasil: Kartu[] = [];
  for (let d = 0; d < jumlahDeck; d++) {
    for (const bunga of SEMUA_BUNGA) {
      for (const rank of SEMUA_RANK) hasil.push(buatKartu(bunga, rank, d));
    }
  }
  return hasil;
}
