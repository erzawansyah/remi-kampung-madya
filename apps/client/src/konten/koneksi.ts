// Teks kabar koneksi di meja online (perbaikan koneksi putus-putus). Satu sumber untuk bar aksi,
// toast, dan pembaca layar. Tidak pernah menyebut kartu, angka joker, atau isi tangan siapa pun.

export const TEKS_KONEKSI = {
  /** Aksi ditekan saat sambungan belum siap (putus, menyambung, atau keadaan meja terbaru belum datang). */
  nyambung: 'Lagi nyambung lagi, Bos. Pilihanmu aman, coba sebentar lagi.',
  /** Aksi sudah dikirim 3 dtk tanpa jawaban: sambungannya sedang dicek, tombol tetap dikunci. */
  masihMengirim: 'Masih mengirim…',
  /** Aksi yang dikirim sebelum sinyal putus tidak sampai ke server: pilihannya dikembalikan. */
  belumSampai: 'Langkahmu belum sampai, ulangi ya, Bos.',
  /** Petunjuk sesudah Konfirmasi mulung ditekan. */
  mulungDikirim: 'Mulung dikirim, tunggu kartunya mendarat…',
  /** Beranda: aplikasi dibuka ulang, sesi meja online dilanjutkan. */
  lanjutSesi: 'Menyambung lagi ke meja terakhir…',
} as const;

/**
 * Kabar sesudah tersambung lagi: warga kedai sempat menjalankan `n` langkah kursi ini selama terputus
 * (dari server, pesan 'masuk'). `masihGiliranku`: giliran (atau susun akhir) masih milik pemain ini.
 */
export function teksDijalankanWarga(n: number, masihGiliranku: boolean): string {
  return masihGiliranku
    ? `Sinyalmu sempat putus, warga kedai sudah mulai giliranmu (${n} langkah). Lanjutkan dari sini.`
    : `Sinyalmu sempat putus, warga kedai menjalankan ${n} langkahmu. Cek Log.`;
}

/**
 * Mentung yang terjadi selama sinyal putus, ditampilkan ringkas (sorakan + pembaca layar), tanpa panel
 * yang menahan meja. Rinciannya tetap di hasil putaran dan Log. `siapa`: nama yang mentung ("Kamu" kalau
 * kursi sendiri).
 */
export function teksMentungTerlewat(siapa: string, kenaSaya: boolean): { judul: string; sub: string; umum: string } {
  return {
    judul: kenaSaya ? 'KAMU KEPENTUNG!' : 'MENTUNG!',
    sub: `${siapa} mentung waktu sinyalmu putus`,
    umum: `${siapa} mentung waktu sinyalmu putus${kenaSaya ? ', kamu kepentung' : ''}. Rinciannya ada di hasil putaran dan Log.`,
  };
}
