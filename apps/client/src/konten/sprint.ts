// Teks layar Sprint dan meja sprint (keputusan pemilik 25 Nov 2026, diubah 26 Nov 2026: tanpa batas
// putaran, lima lawan, 2 deck; diubah 27 Nov 2026: satu sprint bisa dilanjut sepanjang minggu, tanpa Mulai
// dari 0 sejak 0.10.3). Data saja;
// aturan sprint (pengaturan, hasil per putaran, urutan papan, juara mingguan) hanya di @remi/meja
// (sprint.ts). Dijaga apps/client/test/antislop.test.ts.

import { WIB_MS, type KolomSprint } from '@remi/meja';

export const TEKS_SPRINT = {
  judul: 'Sprint',
  /** Tombol di panel Main online beranda. */
  tombolBeranda: 'Sprint',
  /**
   * Pembuka di layar Sprint. Sejak 0.10.3 tanpa "Mulai dari 0" (keputusan pemilik 27 Nov 2026: "sekali maju
   * gak bisa mundur"): satu sprint per minggu, Keluar hanya menjeda, minggu baru mulai Senin 00.00 WIB.
   */
  intro:
    'Lawan 5 warga kedai level Suhu pakai 2 deck, tiap putaran langsung masuk papan. Satu sprint tiap minggu. Keluar boleh, nanti tinggal lanjut. Mulai lagi Senin pukul 00.00 WIB.',
  tombolMain: 'Main sprint',
  /** Ada sprint minggu ini di HP ini (27 Nov 2026): lanjutkan permainan yang sama. Satu-satunya tombol. */
  tombolLanjut: 'Lanjut sprint',
  /** Toast kalau tombol Sprint atau Main sprint diketuk tanpa internet. */
  butuhInternet: 'Sprint cuma bisa dimainkan online, Bos. Sambungkan internet dulu.',
  tabMinggu: 'Minggu ini',
  tabSemua: 'Sepanjang masa',
  kolomNama: 'Nama',
  /** Kolom paling kiri: peringkat resmi (27 Nov 2026, "judul kolomnya ganti jadi #"). */
  kolomPeringkat: '#',
  /** Nama lengkap kolom # untuk pembaca layar dan tooltip. */
  kolomPeringkatLengkap: 'Peringkat',
  /** Nama lengkap kolom angka (aria-label, title). */
  kolom: { putaran: 'Putaran', menang: 'Menang', mentung: 'Mentung', kepentung: 'Kepentung', skor: 'Skor' } satisfies Record<KolomSprint, string>,
  /** Judul kolom yang tampil (27 Nov 2026, "Menang = M. Mentung = Mtg, Kepentung = Kpg"). */
  kolomSingkat: { putaran: 'Ptr', menang: 'M', mentung: 'Mtg', kepentung: 'Kpg', skor: 'Skor' } satisfies Record<KolomSprint, string>,
  /**
   * Satu baris di bawah tabel: arti singkatan judul kolom. Spasi di sekitar "=" tidak bisa dipatahkan
   * (U+00A0), begitu juga sebelum "·", jadi baris hanya pindah sesudah "·", tidak di antara singkatan dan artinya.
   */
  legenda: 'Ptr\u00a0=\u00a0putaran\u00a0· M\u00a0=\u00a0menang\u00a0· Mtg\u00a0=\u00a0mentung\u00a0· Kpg\u00a0=\u00a0kepentung',
  /** Baris pemisah di antara 10 teratas, baris sendiri, dan 10 terbawah (untuk pembaca layar). */
  ariaPemisah: 'Sebagian peringkat dilewati',
  memuat: 'Memuat papan…',
  kosongMinggu: 'Belum ada yang sprint minggu ini. Jadi yang pertama, Bos.',
  kosongSemua: 'Belum ada yang sprint.',
  gagal: 'Papan sprint belum bisa dibuka. Cek sinyal lalu coba lagi.',
  offline: 'Kamu lagi offline. Papan sprint butuh internet.',
  cobaLagi: 'Coba lagi',
  /** Keterangan di bawah papan. */
  ketPapan:
    'Minggu ini dihitung mulai Senin pukul 00.00 WIB. Sepanjang masa memakai minggu terbaik tiap orang (skor seminggu paling tinggi). Juara tiap minggu dapat 🏆. Ketuk judul kolom buat mengurutkan, ketuk # buat balik ke peringkat.',
  kembali: '← Kembali ke beranda',
  lencanaKamu: 'kamu',
  /** Bar atas meja sprint (diikuti "Putaran N"). */
  labelAtas: 'Sprint',
  /** Menu ☰ di meja sprint. */
  menuMeja:
    'Sprint: lawan 5 warga kedai level Suhu, 2 deck, tanpa batas putaran. Tiap putaran yang selesai langsung masuk papan. Keluar kapan saja, sprint-nya disimpan dan bisa dilanjut lewat tombol Sprint di beranda sampai Senin. Aturannya dikunci, yang bisa diganti cuma tempo warga kedai (Pengaturan).',
  /** Satu baris di hasil putaran meja sprint, sebelum pesan sprintHasil putaran itu datang dari server. */
  mencatat: 'Lagi dicatat di papan…',
  /** Hasil putaran meja sprint sesudah tercatat. */
  menangPutaran: 'Menang putaran ini, udah masuk papan.',
  kalahPutaran: 'Putaran ini udah masuk papan.',
  /** Klasemen akhir meja sprint (hanya meja sprint lama yang masih punya batas putaran). */
  papanSprint: 'Papan sprint',
  /** Konfirmasi keluar meja sprint (lewat opsiKonfirmasiKeluar). Sejak 27 Nov 2026 keluar hanya menjeda. */
  keluarJudul: 'Udahan dulu?',
  keluarMain: 'Sprint-mu disimpan, termasuk putaran yang lagi jalan. Lanjut kapan saja lewat tombol Sprint di beranda sampai Senin pukul 00.00 WIB.',
  /** Meja sprint yang tidak bisa dilanjut (minggunya sudah lewat, atau meja sprint versi lama). */
  keluarTutup: 'Sprint ini nggak bisa dilanjut sesudah keluar. Putaran yang sudah selesai udah masuk papan.',
  keluarSelesai: 'Hasil sprint ini sudah dicatat di papan.',
} as const;

/** Keterangan tombol Lanjut sprint: putaran yang sedang jalan dan skor sejauh ini. */
export const teksLanjutSprint = (putaran: number, skor: string): string => `Putaran ${putaran} · skor ${skor}`;

/** Papan skor di meja sprint yang riwayat awalnya sudah dibuang (state sprint tidak tumbuh tiap putaran). */
export const teksRiwayatSprintTerakhir = (n: number): string =>
  `Mentung, kepentung, dan riwayat di sini cuma ${n} putaran terakhir. Skor total tetap dari awal, hitungan lengkapnya di papan sprint.`;

/** Posisi di papan minggu ini, dari pesan sprintHasil. */
export const teksPeringkatMinggu = (n: number): string => `Peringkat ${n} minggu ini`;

/**
 * Baris hasil putaran `nomor` di meja sprint: dari pesan sprintHasil kalau sudah untuk putaran itu
 * (menang atau tidak, plus peringkat minggu ini), selain itu "Lagi dicatat di papan…".
 */
export function teksSprintPutaran(nomor: number, h: { putaran?: number; menang: boolean; peringkatMinggu: number | null } | null): string {
  if (!h || h.putaran !== nomor) return TEKS_SPRINT.mencatat;
  const dasar = h.menang ? TEKS_SPRINT.menangPutaran : TEKS_SPRINT.kalahPutaran;
  return typeof h.peringkatMinggu === 'number' ? `${dasar} ${teksPeringkatMinggu(h.peringkatMinggu)}.` : dasar;
}

/** Piala juara mingguan di samping nama: 🏆, 🏆2, … ('' kalau belum pernah). */
export const teksPiala = (n: number): string => (n > 0 ? (n === 1 ? '🏆' : `🏆${n}`) : '');
/** Untuk pembaca layar. */
export const ariaPiala = (n: number): string => (n === 1 ? 'juara sprint mingguan sekali' : `juara sprint mingguan ${n} kali`);

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI_MS = 24 * 60 * 60 * 1000;

/**
 * Label minggu terbaik di papan Sepanjang masa: "24–30 Nov", "29 Des–4 Jan", tahun hanya kalau bukan
 * tahun ini ("24–30 Nov 2025"). `mulai` = awal minggu WIB (Senin), sampai Minggu; tanggal menurut WIB.
 */
export function teksMingguSprint(mulai: number, sekarang: number): string {
  const tgl = (ms: number) => {
    const d = new Date(ms + WIB_MS);
    return { h: d.getUTCDate(), b: BULAN[d.getUTCMonth()]!, t: d.getUTCFullYear() };
  };
  const a = tgl(mulai);
  const z = tgl(mulai + 6 * HARI_MS);
  const ini = tgl(sekarang).t;
  const th = (t: number) => (t === ini ? '' : ` ${t}`);
  if (a.b === z.b && a.t === z.t) return `${a.h}–${z.h} ${z.b}${th(z.t)}`;
  return `${a.h} ${a.b}${a.t === z.t ? '' : th(a.t)}–${z.h} ${z.b}${th(z.t)}`;
}

/** Label minggu terbaik untuk pembaca layar. */
export const ariaMingguSprint = (teks: string): string => `minggu terbaik ${teks}`;
