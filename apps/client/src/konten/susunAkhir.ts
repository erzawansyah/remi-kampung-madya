// Pengingat sebelum Selesai di susun akhir (keputusan pemilik #64). Muncul tiap kali pemain yang masih
// memegang kartu menekan Selesai, tanpa melihat isi tangannya (tidak pernah memberi tahu ada tidaknya
// kombinasi). Data saja; dijaga apps/client/test/antislop.test.ts.

export const TEKS_PENGINGAT_SUSUN = {
  judul: 'Sudah selesai menyusun?',
  pesan: 'Kartu yang masih di tanganmu dihitung minus. Turunkan dulu kartu jadi kalau masih ada.',
  centang: 'Jangan tanya lagi sampai permainan ini selesai',
  kembali: 'Kembali menyusun',
  selesai: 'Selesai',
} as const;
