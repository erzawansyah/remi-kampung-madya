// Acak urutan duduk (keputusan pemilik #62, 25 Nov 2026): satu sumber teks untuk lobi dan Atur meja.
// Aturannya di packages/meja (PengaturanMeja.urutanTetap, Meja.acakUrutanDuduk).

export const TEKS_ACAK_DUDUK = {
  label: 'Acak urutan duduk',
  ket: 'Urutan duduk diacak waktu permainan dimulai, jadi nggak harus sesuai urutan masuk. Yang dapat kursi pertama ngocok duluan. Matikan kalau mau urutan tetap dan pilih pengocok sendiri.',
  /** Bukan host di lobi: keadaannya sebagai teks. */
  nyala: 'Diacak',
  mati: 'Urutan masuk',
} as const;
