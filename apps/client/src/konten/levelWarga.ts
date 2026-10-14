// Label dan keterangan level warga kedai (pemain komputer). Satu sumber untuk pilihan di Atur meja
// (beranda), kursi di lobi, ringkasan meja, dan Bantuan, supaya namanya sama di mana-mana.
//
// Keputusan pemilik (14 Okt 2026): Jago dan Suhu tampil namanya saja, tanpa petunjuk tingkat
// kesulitan dan tanpa keterangan cara main. Pemain mencari tahu sendiri waktu main.
// Keterangan Mudah dan Normal harus sesuai kode bot (bot.ts): Mudah sering memilih acak; Normal
// menimbang untung mungut dan memilih buangan.

import { DAFTAR_LEVEL_BOT, type LevelBot } from '@remi/engine';
import { isLevel } from '@remi/meja';

export interface InfoLevel {
  /** Nama level, mis. "Jago". Huruf kecilnya dipakai di teks ringkas ("lawan jago"). */
  label: string;
  /** Teks di daftar pilihan (bisa memuat petunjuk singkat). */
  pilihan: string;
  /** Satu kalimat cara main untuk petunjuk di Atur meja. Kosong = tidak ada petunjuk. */
  ket?: string;
}

export const LEVEL_WARGA: Readonly<Record<LevelBot, InfoLevel>> = {
  mudah: { label: 'Mudah', pilihan: 'Mudah', ket: 'Masih sering asal ambil, asal buang. Pas buat belajar.' },
  normal: { label: 'Normal', pilihan: 'Normal', ket: 'Mungut kalau untung, buangnya dipikir dulu.' },
  jago: { label: 'Jago', pilihan: 'Jago' },
  suhu: { label: 'Suhu', pilihan: 'Suhu' },
};

/** Level urut dari yang paling mudah, beserta infonya (untuk daftar pilihan dan Bantuan). */
export const DAFTAR_LEVEL_WARGA: readonly (InfoLevel & { level: LevelBot })[] = DAFTAR_LEVEL_BOT.map((level) => ({
  level,
  ...LEVEL_WARGA[level],
}));

/** Info level, atau null kalau levelnya tidak dikenal versi ini (mis. dari server yang lebih baru). */
export function infoLevel(x: unknown): InfoLevel | null {
  return isLevel(x) ? LEVEL_WARGA[x] : null;
}

/** Nama level huruf kecil untuk teks ringkas ("lawan jago"); kosong kalau levelnya tidak dikenal. */
export function labelLevelKecil(x: unknown): string {
  return infoLevel(x)?.label.toLocaleLowerCase('id-ID') ?? '';
}
