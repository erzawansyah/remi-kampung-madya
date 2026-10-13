// Info Kedai Madya: satu sumber data untuk kartu kedai di beranda, layar Tentang, dan baris
// ajakan di klasemen akhir.
//
// Isinya hanya fakta yang sudah dicek langsung di profil IG/Threads, Google Maps, dan katalog buku
// kedai (riset 13 Okt 2026). Sengaja TIDAK ada jam buka, menu, harga, rating, jumlah buku, atau
// nomor telepon: angkanya bisa berubah (jam di IG dan Maps pun beda), jadi pemain diarahkan ke
// IG/Maps. Tautan polos tanpa UTM/analitik, dibuka di tab baru (rel="noopener noreferrer").
//
// Promosi tidak pernah muncul sendiri selama permainan: tidak ada pop-up atau toast, dan meja,
// susun akhir, popup joker, panel mentung, serta tutorial tidak memuatnya. Pemain bisa melihatnya
// kapan saja lewat Tentang, termasuk dari menu ☰ saat bermain. Isinya tidak bergantung pada kartu
// atau peristiwa meja.

export interface TautanKedai {
  /** Kunci stabil (dipakai test & atribut data-tautan). */
  id: 'peta' | 'instagram' | 'threads' | 'rakBuku';
  /** Teks tautan yang terlihat. */
  label: string;
  /** Label pembaca layar: diawali teks yang terlihat, lalu tujuan + "tab baru". */
  aria: string;
  url: string;
}

export const KEDAI = {
  nama: 'Kedai Madya',
  /** Bio di IG/Threads kedai, dipotong sebelum jam buka. */
  bio: 'Tempat Ngopi dan Madhang Santai · Kipasnya Ada Dua',
  /** Alamat persis seperti di Google Maps. */
  alamat: 'Jl. Raya Tegalgondo No.101, Pendem, Kec. Junrejo, Kota Batu, Jawa Timur 65324',
  alamatSingkat: 'Jl. Raya Tegalgondo, Junrejo, Kota Batu',
  /**
   * Peta utama: URL cid Google Maps ("Kedai Madya Batu"). Di HP, URL ini langsung membuka
   * aplikasi Maps di tempat yang benar.
   */
  peta: 'https://maps.google.com/?cid=9894150911920021606',
  /**
   * Tautan bagikan dari pemilik, menuju entitas yang sama. Hanya cadangan: tautan share.google
   * membuka halaman Google Search dulu, bukan aplikasi Maps. Tidak ditampilkan.
   */
  petaCadangan: 'https://share.google/G6JZp1CpJ4O4ZPVy6',
  instagram: 'https://www.instagram.com/kedaimadya/',
  threads: 'https://www.threads.com/@kedaimadya',
  /** Katalog buku di kedai. Label mengikuti judul yang tampil di situsnya. */
  rakBuku: { label: 'Rak Buku Kedai Madya', url: 'https://katalog-buku-bermadya.lovable.app/' },
  /** Kutipan dari katalog buku kedai (bukunya dibaca di tempat, tanpa pinjam). */
  catatanBuku: 'Ngopi, madhang, sambil baca. Bukunya dibaca di kedai, ya.',
  /** Pengganti jam buka (jam di IG dan Maps tidak sama, jadi tidak ditulis di sini). */
  catatanJam: 'Jam buka terbaru cek di IG atau Maps.',
  /** Ditampilkan saat HP sedang offline. */
  catatanOffline: 'Butuh internet buat buka tautan.',
  /** Balasan akun kedai di Threads soal kalah main kartu. */
  kutipan: 'Kartu itu bundar, kak.',
  kredit: 'Logo Kedai Madya dipakai dengan izin.',
} as const;

export const TAUTAN_KEDAI: readonly TautanKedai[] = [
  { id: 'peta', label: 'Buka peta', aria: 'Buka peta Kedai Madya di Google Maps (tab baru)', url: KEDAI.peta },
  { id: 'instagram', label: '@kedaimadya (IG)', aria: '@kedaimadya (IG), Instagram Kedai Madya (tab baru)', url: KEDAI.instagram },
  { id: 'threads', label: 'Threads', aria: 'Threads Kedai Madya (tab baru)', url: KEDAI.threads },
  { id: 'rakBuku', label: KEDAI.rakBuku.label, aria: `${KEDAI.rakBuku.label}, katalog buku (tab baru)`, url: KEDAI.rakBuku.url },
];

/** Atribut tautan keluar: tab baru, tanpa referrer, tanpa pelacakan. */
export const ATRIBUT_LUAR = 'target="_blank" rel="noopener noreferrer"';

/**
 * Daftar tautan kedai sebagai HTML (<ul> berisi <a>). Semua isinya konstanta di file ini, jadi
 * tidak ada teks pengguna yang perlu di-escape.
 */
export function htmlTautanKedai(kelas = 'kedai-tautan'): string {
  return `<ul class="${kelas}">${TAUTAN_KEDAI.map(
    (t) => `<li><a href="${t.url}" ${ATRIBUT_LUAR} data-tautan="${t.id}" aria-label="${t.aria}">${t.label}</a></li>`,
  ).join('')}</ul>`;
}
