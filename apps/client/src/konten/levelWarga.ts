// Label dan keterangan level warga kedai (pemain komputer). Satu sumber untuk pilihan di Atur meja
// (beranda), kursi di lobi, ringkasan meja, dan Bantuan, supaya namanya sama di mana-mana.
//
// Keterangan harus sesuai kode bot, dan jangan menjanjikan hal yang tidak dilakukan warga kedai:
// - Mudah sering memilih acak; Normal menimbang untung mungut dan memilih buangan (bot.ts).
// - Jago dan Suhu (PARAM_JAGO/PARAM_SUHU di packages/engine/src/bot/strategi.ts): keduanya menahan
//   kartu jadi di tangan buat mentung. Jago rakus mungut (ambangMulung 0), menurunkan kartu jadinya
//   begitu ada lawan tinggal 2 kartu (turunTanganLawan 2), dan tidak memakai riwayat (ingatRiwayat
//   false). Suhu sabar mungut, menimbang bahaya buangan bagi lawan, dan ingat peristiwa yang masih ada
//   di view: hanya 40 peristiwa terakhir (ingatan.ts), jadi tulis "baru-baru ini", bukan "semua".
// Apa pun levelnya, warga kedai hanya melihat yang terlihat dari kursinya (ViewPemain, mode ingatan).

import { DAFTAR_LEVEL_BOT, type LevelBot } from '@remi/engine';
import { isLevel } from '@remi/meja';

export interface InfoLevel {
  /** Nama level, mis. "Jago". Huruf kecilnya dipakai di teks ringkas ("lawan jago"). */
  label: string;
  /** Teks di daftar pilihan (bisa memuat petunjuk singkat). */
  pilihan: string;
  /** Satu kalimat cara main, untuk petunjuk di Atur meja dan tabel di Bantuan. */
  ket: string;
}

export const LEVEL_WARGA: Readonly<Record<LevelBot, InfoLevel>> = {
  mudah: { label: 'Mudah', pilihan: 'Mudah', ket: 'Masih sering asal ambil, asal buang. Pas buat belajar.' },
  normal: { label: 'Normal', pilihan: 'Normal', ket: 'Mungut kalau untung, buangnya dipikir dulu.' },
  jago: {
    label: 'Jago',
    pilihan: 'Jago (susah)',
    ket: 'Kartu jadinya ditahan di tangan buat mentung, dan rakus mungut. Begitu ada lawan tinggal 2 kartu, kartu jadinya buru-buru diturunkan. Yang diingat cuma yang kelihatan di meja.',
  },
  suhu: {
    label: 'Suhu',
    pilihan: 'Suhu (susah banget)',
    ket: 'Kartu jadinya juga ditahan buat mentung atau susun akhir. Sabar: mungut cuma kalau jelas lebih untung dari ambil deck. Ingat kartu yang baru-baru ini dibuang dan dipungut, dan hati-hati membuang kartu yang bisa dipakai lawan buat mentung.',
  },
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
