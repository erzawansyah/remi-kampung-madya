// Teks hasil putaran di meja online (keputusan pemilik, 24 Okt 2026): jeda sebelum host bisa
// memulai putaran berikutnya, tombol Siap untuk pemain lain, dan ledekan. Isi ledekannya sendiri
// (DAFTAR_LEDEKAN) ada di @remi/meja, karena server juga memeriksanya.

export const TEKS_LANJUT = {
  /** Tombol host selama terkunci; hitung mundurnya menyusul dalam kurung: "Putaran berikutnya (9)". */
  tombolTerkunci: 'Putaran berikutnya',
  /** Diikuti nama-nama: "Belum siap: Budi dan Citra." */
  belumSiap: 'Belum siap:',
  /** Tombol host yang masih terkunci ditekan (sama dengan pesan penolakan meja). */
  tunggu: 'Tunggu sebentar, yang lain masih lihat kartu.',
  /** Pembaca layar, saat tombol host terbuka. */
  bisaLanjut: 'Sudah bisa lanjut ke putaran berikutnya.',
  ajakSiap: 'Sudah lihat kartunya? Tekan Siap.',
  siap: 'Siap',
  menungguHost: 'Menunggu host…',
} as const;

export const TEKS_LEDEK = {
  /** Label baris kecil di kaki modal hasil, dan awal judul lembar: "Ledek Budi". */
  judul: 'Ledek',
  /** Ikon di depan nama pada baris Ledek. */
  ikon: '😏',
  /** Tombol "+N" kalau tidak semua nama muat dua baris; aria-label-nya "+3 yang lain". */
  lainnya: 'yang lain',
  /** aria-label deret pilihan sasaran di lembar. */
  pilihSasaran: 'Ledek siapa',
  /** aria-label deret isi ledekan. */
  pilihIsi: 'Pilih ledekan',
  /** aria-label kisi emoji. */
  emoji: 'Emoji',
  tutup: 'Tutup',
  /** Sesudah mengirim, di lembar: "Terkirim ke Budi." */
  terkirim: 'Terkirim ke',
  /** Jatah ledekan putaran ini sudah habis (MAKS_LEDEK_PER_PUTARAN). */
  habis: 'Udah, cukup ngeledeknya. Lanjut main aja.',
  /** Judul kecil di atas ledekan besar: "<nama> ngeledek kamu". */
  ngeledekKamu: 'ngeledek kamu',
  /** Tombol di ledekan besar: "Bales Budi". */
  bales: 'Bales',
  /** Pembaca layar untuk ledekan ke orang lain: "<dari> ngeledek <ke>: <isi>". */
  ngeledek: 'ngeledek',
} as const;
