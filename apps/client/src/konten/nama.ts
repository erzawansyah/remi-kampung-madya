// Teks seputar nama pemain di beranda (keputusan pemilik #49).

export const TEKS_NAMA = {
  label: 'Nama kamu',
  isiDulu: 'Isi namamu dulu, Bos.',
  ketBaru: 'Nama cuma bisa diganti seminggu sekali.',
  /** Diikuti tanggal, misalnya "Bisa ganti lagi Sabtu, 25 Okt." */
  bisaGantiLagi: 'Bisa ganti lagi',
  judulGanti: 'Ganti nama?',
  /** Diikuti nama baru dalam tanda petik. */
  pesanGanti: 'Sesudah diganti, nama baru bisa diganti lagi seminggu kemudian. Pakai nama',
  yaGanti: 'Ganti',
  tidakGanti: 'Nggak jadi',
} as const;
