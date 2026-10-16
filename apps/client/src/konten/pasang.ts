// Teks tawaran pasang aplikasi (keputusan pemilik #46): tombol melayang di beranda, ubin menu,
// toast, dan dialog petunjuk (ui/pasang.ts). Data saja; dijaga apps/client/test/antislop.test.ts.
// Tanda *...* di langkah = nama tombol/menu di browser (ditebalkan saat ditampilkan).

/** Satu baris manfaat di awal setiap dialog petunjuk. */
export const MANFAAT_PASANG =
  'Sekali pasang, Remi Kampung Madya kebuka layar penuh kayak aplikasi biasa, dan main bareng warga kedai tetap jalan tanpa sinyal.';

export const TEKS_TAWARAN = {
  tombol: 'Pasang aplikasi',
  ubin: 'Pasang ke layar utama',
  labelTawaran: 'Pasang aplikasi',
  nanti: 'Nanti saja',
  labelNanti: 'Nanti saja, sembunyikan 3 hari',
  sudah: 'Sudah kupasang',
  tutup: 'Tutup',
  salin: 'Salin link',
  labelLink: 'Link halaman ini',
  toastNanti: 'Oke, tombolnya disimpan dulu 3 hari. Masih bisa lewat Pasang ke layar utama di menu.',
  toastSudah: 'Sip. Lain kali buka Remi Madya langsung dari layar utama.',
  toastTersalin: 'Link-nya sudah disalin.',
  toastGagalSalin: 'Link-nya belum bisa disalin otomatis. Tahan link-nya, lalu pilih Salin.',
} as const;

export interface LangkahPasang {
  teks: string;
  /** Ikon kecil di depan langkah (SVG di ui/pasang.ts). */
  ikon?: 'bagikan' | 'tambah' | 'menu';
}

export interface PetunjukPasang {
  judul: string;
  /** Penjelasan sesudah baris manfaat (in-app saja). */
  penjelasan?: string;
  langkah: LangkahPasang[];
  catatan?: string;
}

export const PETUNJUK_PASANG: Record<'ios' | 'android' | 'inapp', PetunjukPasang> = {
  ios: {
    judul: 'Pasang ke layar utama',
    langkah: [
      {
        ikon: 'bagikan',
        // Netral browser: Chrome/Firefox iOS juga dikenali 'ios' (UA-nya memuat "Safari/").
        teks: 'Ketuk tombol *Bagikan* (kotak dengan panah ke atas) di bilah browser. Di Chrome, tombolnya ada di bilah alamat. Di iOS terbaru, ketuk *⋯* dulu kalau tombolnya belum kelihatan.',
      },
      { ikon: 'tambah', teks: 'Pilih *Tambah ke Layar Utama*. Kalau belum kelihatan, gulir daftar pilihannya ke bawah.' },
      { teks: 'Ketuk *Tambah* di pojok kanan atas. Ikon Remi Madya muncul di layar utama.' },
    ],
    catatan: 'Pilihan itu nggak ada? Buka halaman ini di Safari dulu.',
  },
  android: {
    judul: 'Pasang ke layar utama',
    langkah: [
      { ikon: 'menu', teks: 'Ketuk menu *⋮* di pojok kanan atas Chrome. Di Samsung Internet, menunya *≡* di bawah.' },
      { ikon: 'tambah', teks: 'Pilih *Instal aplikasi* atau *Tambahkan ke layar utama*.' },
      { teks: 'Ikuti konfirmasinya. Ikon Remi Madya muncul di layar utama.' },
    ],
    catatan: 'Pilihan itu nggak ada? Buka halaman ini di Chrome dulu.',
  },
  inapp: {
    judul: 'Buka di browser dulu',
    penjelasan:
      'Halaman ini lagi kebuka di browser bawaan aplikasi (misalnya Instagram, Threads, atau WhatsApp). Dari situ aplikasinya belum bisa dipasang.',
    langkah: [
      { ikon: 'menu', teks: 'Ketuk menu *⋯* atau *⋮* di pojok layar.' },
      { teks: 'Pilih *Buka di browser*, *Buka di Chrome*, atau *Buka di Safari*.' },
      { teks: 'Di browser, ketuk *Pasang aplikasi* di beranda.' },
    ],
    catatan: 'Menunya nggak ada? Salin link di bawah, lalu tempel di Chrome atau Safari.',
  },
};
