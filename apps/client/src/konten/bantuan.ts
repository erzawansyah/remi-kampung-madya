// Konten layar Bantuan: aturan main Kedai Madya dan cara pakai aplikasi.
//
// Sumber kebenaran aturan: README (Ringkasan aturan + tabel Aturan Terbuka) dan packages/engine/src
// (kartuJadi.ts, giliran.ts, mesin.ts, skor.ts). Jangan menambah aturan karangan atau aturan remi umum.
// Setiap blok 'contoh' sudah dicocokkan dengan validator engine; kalau mengubah contoh, cek ulang dengan engine.
//
// Info rahasia: konten statis boleh menjelaskan konsep joker, tapi tidak boleh menyarankan penanda joker
// atau peringatan "kartu berbahaya". Contoh joker selalu ditulis "misal joker putaran ini N".

import type { Bunga, Rank } from '@remi/engine';
import { TENGGANG_SAMBUNG_MS } from '@remi/meja';
import { DAFTAR_LEVEL_WARGA } from './levelWarga';

/** Masa tenggang sambung ulang dalam detik (sama dengan yang dipakai meja). */
const DETIK_TENGGANG = Math.round(TENGGANG_SAMBUNG_MS / 1000);

export type KartuContoh = {
  bunga: Bunga;
  rank: Rank;
  /** Untuk joker pengganti: angka kartu yang diwakili (bunganya ikut seri). Ditampilkan sebagai catatan teks saja. */
  peran?: Rank;
};

export type BlokBantuan =
  | { t: 'paragraf'; teks: string } // teks boleh berisi **tebal** saja
  | { t: 'daftar'; butir: string[] }
  | { t: 'langkah'; butir: string[] } // daftar bernomor
  | { t: 'contoh'; judul: string; kartu: KartuContoh[]; ket: string; sah: boolean }
  | { t: 'tabel'; kepala: string[]; baris: string[][] }
  | { t: 'catatan'; teks: string };

export interface BabBantuan {
  id: string;
  judul: string;
  ikon: string;
  ringkas: string;
  isi: BlokBantuan[];
}

const AS: Rank = 1;
const J: Rank = 11;
const Q: Rank = 12;
const K: Rank = 13;

/** Penulis kartu contoh yang ringkas: k(7, 'kriting'), atau k(5, 'waru', 9) untuk joker 5 Waru sebagai 9. */
function k(rank: Rank, bunga: Bunga, peran?: Rank): KartuContoh {
  return peran === undefined ? { bunga, rank } : { bunga, rank, peran };
}

export const BAB_BANTUAN: BabBantuan[] = [
  {
    id: 'mulai',
    judul: 'Mulai main',
    ikon: '🃏',
    ringkas: 'Tujuan permainan dan gambaran satu putaran.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Remi Kampung Madya pakai **aturan tongkrongan Kedai Madya**, yang banyak bedanya dengan remi atau rummy umum. Jadi lupakan dulu aturan remi lain, ya.',
      },
      {
        t: 'paragraf',
        teks: '**Tujuannya:** kumpulkan skor setinggi mungkin. Kartu jadi yang kamu turunkan menambah skor, kartu yang masih nyangkut di tangan mengurangi skor. Yang berhasil **mentung** dapat bonus pentungan, yang **kepentung** kena potongan.',
      },
      {
        t: 'paragraf',
        teks: 'Skor dijumlahkan terus dari putaran ke putaran. Pemenangnya pemain dengan skor total tertinggi waktu permainan selesai.',
      },
      {
        t: 'langkah',
        butir: [
          'Pengocok membagikan kartu ke semua pemain.',
          'Pengocok membuka satu kartu dari sisa deck. Angkanya jadi angka joker putaran itu, lalu kartunya diselipkan lagi ke deck.',
          'Angka joker diumumkan sekali lewat popup di awal putaran. Ingat baik-baik, karena angkanya tidak dipajang di meja.',
          'Joker yang sudah dipasang di kartu jadi diberi label angka yang diwakilinya (misalnya →7) dan tercatat di log. Sama seperti di meja asli, semua orang bisa melihatnya, jadi itu bisa jadi petunjuk.',
          'Pengocok jalan pertama. Tiap giliran: ambil 1 kartu dari deck atau mulung dari buangan, turunkan kartu jadi kalau mau, lalu buang 1 kartu.',
          'Putaran berakhir kalau ada yang mentung atau deck habis.',
          'Semua pemain dapat kesempatan terakhir menurunkan kartu jadi (susun akhir), lalu skor putaran dihitung.',
        ],
      },
      {
        t: 'catatan',
        teks: 'Bisa dimainkan 2 sampai 6 orang: online bareng teman, atau offline bareng warga kedai (pemain komputer) tanpa internet.',
      },
    ],
  },
  {
    id: 'kartu',
    judul: 'Kartu & pembagian',
    ikon: '♠',
    ringkas: 'Deck, bunga, nilai kartu, dan jumlah kartu per pemain.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Satu deck berisi **52 kartu**. Kartu bergambar joker tidak dipakai: joker di sini adalah kartu biasa yang angkanya kebetulan sama dengan kartu yang dibuka (lihat bab Joker).',
      },
      {
        t: 'tabel',
        kepala: ['Bunga', 'Simbol', 'Warna'],
        baris: [
          ['Love', '♥', 'Merah'],
          ['Wajik', '♦', 'Merah'],
          ['Kriting', '♣', 'Hitam'],
          ['Waru', '♠', 'Hitam'],
        ],
      },
      {
        t: 'paragraf',
        teks: 'Angka kartu: **As**, kartu **angka** 2 sampai 10, dan **Londo** (J, Q, K).',
      },
      {
        t: 'tabel',
        kepala: ['Kartu', 'Di tangan / di kartu jadi', 'Sebagai pentungan'],
        baris: [
          ['2 sampai 10', '5', '50'],
          ['J, Q, K (Londo)', '10', '100'],
          ['As', '15', '150'],
          ['Joker', 'Di tangan 25. Di kartu jadi bernilai kartu yang diwakili.', '250'],
        ],
      },
      {
        t: 'catatan',
        teks: 'Joker yang sudah pernah dibuang jadi kartu biasa. Kalau nanti dipakai sebagai pentungan, nilainya kartu aslinya (bukan 250). Kalau joker mati itu masih di tangan saat putaran selesai, nilainya juga kartu aslinya (bukan 25).',
      },
      {
        t: 'tabel',
        kepala: ['Jumlah pemain', 'Deck', 'Kartu awal per pemain'],
        baris: [
          ['2 sampai 4', '1 deck (52 kartu)', '6'],
          ['4 (pilihan 2 deck)', '2 deck (104 kartu)', '12'],
          ['5 sampai 6', '2 deck (104 kartu)', '9'],
        ],
      },
      {
        t: 'paragraf',
        teks: '**Pengocok** putaran pertama boleh dipilih atau diacak. Putaran berikutnya yang ngocok adalah pemain dengan skor total paling rendah. Kalau ada yang sama, bebas dipilih di antara mereka.',
      },
      {
        t: 'paragraf',
        teks: 'Pengocok jalan pertama, lalu giliran pindah mengikuti **arah putaran**. Putaran pertama searah urutan duduk. Arahnya bisa berbalik setelah ada yang mentung (lihat bab Mentung).',
      },
      {
        t: 'catatan',
        teks: 'Susah membedakan bunga? Coba pilihan kartu empat warna di Pengaturan. Itu cuma tampilan di HP-mu, aturannya sama.',
      },
    ],
  },
  {
    id: 'joker',
    judul: 'Joker',
    ikon: '🎭',
    ringkas: 'Cara joker ditentukan, joker hidup dan mati, serta batas pemakaiannya.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Di awal putaran, pengocok membuka satu kartu dari sisa deck. **Semua kartu yang angkanya sama** dengan kartu itu jadi joker untuk putaran itu, apa pun bunganya. Kartu yang dibuka lalu diselipkan lagi ke deck.',
      },
      {
        t: 'paragraf',
        teks: '**Mode ingatan:** angka joker cuma diumumkan sekali, lewat popup di awal putaran. Setelah semua menekan OK, angkanya tidak muncul lagi di meja, di bar atas, maupun di log, dan joker di tanganmu tidak diberi tanda apa pun. Persis seperti di meja asli: kamu harus ingat sendiri.',
      },
      {
        t: 'daftar',
        butir: [
          'Joker bisa menggantikan kartu angka (2 sampai 10) di dalam seri, tapi tidak bisa menggantikan Londo (J, Q, K) maupun As.',
          'Joker selalu boleh dipakai sebagai kartu aslinya. Dalam peran itu ia dihitung kartu biasa.',
          'Dalam satu seri, jumlah joker pengganti tidak boleh lebih banyak dari kartu biasa.',
          'Joker pengganti tidak boleh bersebelahan (dempet). Kalau pakai lebih dari satu, harus selang-seling.',
          'Kalau kartu yang dibuka Londo atau As, kartu-kartu itu yang jadi joker. Misalnya yang dibuka As: keempat As tetap bisa jadi kembar As, dan bisa juga menggantikan kartu angka di seri.',
        ],
      },
      {
        t: 'paragraf',
        teks: '**Joker yang dibuang jadi mati.** Kartu itu kehilangan status jokernya dan jadi kartu biasa sampai putaran selesai, termasuk kalau nanti dipungut orang. Yang membuang kena **−25** per joker di putaran itu, kecuali joker itu dibuang sebagai pentungan waktu mentung.',
      },
      {
        t: 'paragraf',
        teks: 'Joker yang masih hidup di tangan bernilai **25** waktu skor dihitung. Di kartu jadi, joker pengganti bernilai kartu yang digantikannya.',
      },
      {
        t: 'contoh',
        judul: 'Satu joker pengganti',
        kartu: [k(7, 'kriting'), k(8, 'kriting'), k(5, 'waru', 9)],
        ket: 'Misal joker putaran ini 5. 7 dan 8 Kriting, ditambah 5 Waru sebagai 9 Kriting. Joker 1, kartu biasa 2: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Joker di tengah seri',
        kartu: [k(6, 'kriting'), k(5, 'love', 7), k(8, 'kriting'), k(9, 'kriting')],
        ket: 'Misal joker putaran ini 5. 5 Love menggantikan 7 Kriting di seri 6 sampai 9 Kriting: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Joker dempet',
        kartu: [k(5, 'waru', 6), k(5, 'love', 7), k(8, 'kriting'), k(9, 'kriting')],
        ket: 'Misal joker putaran ini 5. Dua joker pengganti bersebelahan (sebagai 6 dan 7 Kriting): tidak sah, walaupun jumlahnya tidak lebih banyak dari kartu biasa.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Dua joker selang-seling',
        kartu: [k(6, 'kriting'), k(5, 'waru', 7), k(8, 'kriting'), k(5, 'love', 9)],
        ket: 'Misal joker putaran ini 5. Joker sebagai 7 dan 9 Kriting, diselingi kartu biasa: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Joker kebanyakan',
        kartu: [k(5, 'waru', 6), k(7, 'kriting'), k(5, 'love', 8), k(9, 'kriting'), k(5, 'wajik', 10)],
        ket: 'Misal joker putaran ini 5. Tiga joker pengganti, kartu biasa cuma dua: tidak sah, walaupun selang-seling.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Joker menggantikan Londo',
        kartu: [k(J, 'waru'), k(5, 'love', Q), k(K, 'waru')],
        ket: 'Misal joker putaran ini 5. Joker tidak bisa menggantikan Q Waru, karena Londo tidak bisa digantikan joker: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Joker sebagai kartu aslinya',
        kartu: [k(4, 'love'), k(5, 'love'), k(6, 'love')],
        ket: 'Misal joker putaran ini 5. 5 Love dipakai sebagai dirinya sendiri dan dihitung kartu biasa: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Joker yang sudah mati',
        kartu: [k(7, 'kriting'), k(8, 'kriting'), k(5, 'waru', 9)],
        ket: 'Misal joker putaran ini 5, tapi 5 Waru tadi sudah pernah dibuang lalu dipungut. Kartu itu sudah jadi kartu biasa, jadi tidak bisa lagi menggantikan 9 Kriting: tidak sah.',
        sah: false,
      },
    ],
  },
  {
    id: 'kartu-jadi',
    judul: 'Kartu jadi',
    ikon: '🧩',
    ringkas: 'Seri angka 2–10, seri Londo J-Q-K, dan kembar As.',
    isi: [
      {
        t: 'paragraf',
        teks: '**Kartu jadi** adalah kombinasi minimal 3 kartu yang kamu turunkan ke meja. Nilainya menambah skormu. Jenisnya cuma tiga:',
      },
      {
        t: 'daftar',
        butir: [
          'Seri angka: 3 sampai 9 kartu berurutan dengan bunga yang sama, hanya dalam rentang 2 sampai 10.',
          'Seri Londo: J, Q, K dengan bunga yang sama. Cuma itu, tidak bisa lebih panjang.',
          'Kembar As: 3 atau 4 As yang bunganya beda semua.',
        ],
      },
      {
        t: 'daftar',
        butir: [
          'Angka dan Londo tidak bisa disambung, jadi 10-J-Q tidak sah.',
          'As tidak bisa masuk seri, baik di bawah (As-2-3) maupun di atas (Q-K-As).',
          'Kembar hanya untuk As. Tiga kartu 7 beda bunga tidak sah.',
          'Kartu jadi yang sudah di meja tidak bisa ditambah atau ditempeli, baik punyamu maupun punya lawan. Setiap kali menurunkan, kamu membentuk kartu jadi baru.',
          'Di permainan 2 deck, satu seri tetap tidak boleh punya dua kartu yang mewakili angka yang sama, dan kembar As tetap harus beda bunga semua (maksimal 4 As).',
        ],
      },
      {
        t: 'paragraf',
        teks: '**3 As butuh teman.** Kembar 3 As baru boleh turun kalau kamu sudah punya kartu jadi lain di meja, atau ikut menurunkan kartu jadi lain (yang bukan 3 As juga) di aksi yang sama. Kembar 4 As selalu boleh.',
      },
      {
        t: 'contoh',
        judul: 'Seri angka',
        kartu: [k(4, 'love'), k(5, 'love'), k(6, 'love')],
        ket: 'Tiga kartu berurutan, bunga sama: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Seri terpanjang',
        kartu: [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => k(r as Rank, 'waru')),
        ket: '2 sampai 10 Waru, 9 kartu: sah. Lebih panjang dari ini tidak mungkin.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Seri Londo',
        kartu: [k(J, 'kriting'), k(Q, 'kriting'), k(K, 'kriting')],
        ket: 'J-Q-K satu bunga: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Angka disambung Londo',
        kartu: [k(10, 'love'), k(J, 'love'), k(Q, 'love')],
        ket: '10 tidak bisa disambung dengan J dan Q: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'As di dalam seri',
        kartu: [k(Q, 'love'), k(K, 'love'), k(AS, 'love')],
        ket: 'As tidak bisa masuk seri: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Beda bunga',
        kartu: [k(4, 'love'), k(5, 'wajik'), k(6, 'love')],
        ket: 'Seri harus satu bunga, walaupun warnanya sama-sama merah: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Angka melompat',
        kartu: [k(4, 'love'), k(5, 'love'), k(7, 'love')],
        ket: '6 Love-nya bolong: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Kembar selain As',
        kartu: [k(7, 'love'), k(7, 'wajik'), k(7, 'waru')],
        ket: 'Kembar cuma berlaku untuk As: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Kembar 4 As',
        kartu: [k(AS, 'waru'), k(AS, 'love'), k(AS, 'kriting'), k(AS, 'wajik')],
        ket: 'Empat As beda bunga: sah, kapan saja.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Kembar As bunga dobel',
        kartu: [k(AS, 'love'), k(AS, 'love'), k(AS, 'kriting')],
        ket: 'Di permainan 2 deck: dua As Love di satu kembar tidak sah, bunganya harus beda semua.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: '3 As sendirian',
        kartu: [k(AS, 'waru'), k(AS, 'love'), k(AS, 'kriting')],
        ket: 'Belum punya kartu jadi di meja dan tidak ada kartu jadi lain yang ikut turun: ditolak.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: '3 As ditemani seri',
        kartu: [k(AS, 'waru'), k(AS, 'love'), k(AS, 'kriting'), k(4, 'love'), k(5, 'love'), k(6, 'love')],
        ket: 'Dua kartu jadi diturunkan bersamaan: 3 As dan 4-5-6 Love. Seri itu jadi teman 3 As-nya: sah.',
        sah: true,
      },
    ],
  },
  {
    id: 'giliran',
    judul: 'Giliran',
    ikon: '🔁',
    ringkas: 'Ambil, turunkan, buang, dan larangan-larangannya.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Setiap giliran urutannya tetap: **Ambil → (Turunkan) → Buang**.',
      },
      {
        t: 'langkah',
        butir: [
          'Ambil: pilih salah satu, ambil 1 kartu teratas dari deck, atau mulung dari buangan (lihat bab Mulung).',
          'Turunkan (boleh dilewati): turunkan satu atau beberapa kartu jadi dari tanganmu.',
          'Buang: wajib buang 1 kartu ke tumpukan buangan. Setelah itu giliran pindah ke pemain berikutnya.',
        ],
      },
      {
        t: 'daftar',
        butir: [
          'As tidak boleh dibuang sebelum kamu punya kartu jadi di meja.',
          'Habis ambil dari deck, kamu tidak bisa nutup. Setelah menurunkan kartu jadi, harus tersisa minimal 2 kartu: satu dibuang, satu tetap di tangan.',
          'Habis mulung, setelah menurunkan kartu jadi harus tersisa minimal 1 kartu untuk dibuang.',
          'Kartu tidak bisa ditempel ke kartu jadi yang sudah ada.',
          'Membuang joker yang masih hidup kena −25, dan joker itu jadi mati (lihat bab Joker).',
          'Pemain pertama di putaran belum bisa mulung, karena buangan masih kosong.',
        ],
      },
      {
        t: 'paragraf',
        teks: '**Mode ingatan:** dari tumpukan buangan, yang kelihatan cuma kartu teratas sebanyak jumlah pemain dikurangi satu. Kartu yang tertimbun di bawahnya harus kamu ingat sendiri, dan log juga tidak mencatat kartu apa yang dibuang. Jadi perhatikan baik-baik setiap kali ada yang ambil, buang, atau mungut.',
      },
      {
        t: 'contoh',
        judul: 'Nutup habis ambil deck',
        kartu: [k(4, 'love'), k(5, 'love'), k(6, 'love'), k(9, 'waru')],
        ket: 'Habis ambil dari deck, tanganmu 4 kartu ini. Menurunkan 4-5-6 Love lalu membuang 9 Waru berarti nutup tanpa mulung: ditolak.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Buang As terlalu cepat',
        kartu: [k(AS, 'love')],
        ket: 'Kamu belum punya kartu jadi di meja, lalu mau membuang As Love: ditolak. Tunggu sampai punya kartu jadi.',
        sah: false,
      },
    ],
  },
  {
    id: 'mulung',
    judul: 'Mulung',
    ikon: '🫳',
    ringkas: 'Syarat mungut kartu dari buangan, lengkap dengan contoh.',
    isi: [
      {
        t: 'paragraf',
        teks: '**Mulung** (mungut) artinya mengambil kartu dari tumpukan buangan. Kamu boleh mengambil 1 sampai (jumlah pemain − 1) kartu teratas sekaligus. Di 4 pemain maksimal 3 kartu, di 2 pemain cuma 1.',
      },
      {
        t: 'daftar',
        butir: [
          'Kartu paling bawah dari yang kamu pungut wajib langsung dijadikan kartu jadi baru, di giliran itu juga.',
          'Di kartu jadi yang memuat kartu paling bawah itu, modal (kartu dari tanganmu) harus sama banyak atau lebih banyak dari kartu pungutan.',
          'Modal itu harus memuat minimal 1 kartu biasa, tidak boleh joker pengganti semua.',
          'Syarat modal cuma berlaku untuk kartu jadi yang memuat kartu paling bawah. Kartu jadi lain boleh ikut diturunkan di aksi yang sama.',
          'Sisa pungutan yang tidak dijadikan masuk ke tanganmu.',
        ],
      },
      {
        t: 'paragraf',
        teks: 'Mulung juga kunci untuk **mentung**: mentung cuma sah di giliran yang kamu awali dengan mulung.',
      },
      {
        t: 'paragraf',
        teks: 'Contoh dari aturan Kedai Madya: 4 pemain, misal joker putaran ini 9. Buangan dari bawah ke atas: **3 Wajik, K Kriting, 5 Wajik**. Kamu mungut ketiganya, jadi kartu paling bawahnya 3 Wajik.',
      },
      {
        t: 'contoh',
        judul: 'Modal kurang',
        kartu: [k(3, 'wajik'), k(4, 'wajik'), k(5, 'wajik')],
        ket: 'Pungutan di kartu jadi ini 2 (3 dan 5 Wajik), modalnya cuma 1 (4 Wajik). Modalnya kurang, Bos: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Modal pas',
        kartu: [k(2, 'wajik'), k(3, 'wajik'), k(4, 'wajik')],
        ket: 'Modal 2 dan 4 Wajik, pungutan 3 Wajik: sah. K Kriting dan 5 Wajik masuk ke tangan.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Pungutan ikut di seri',
        kartu: [k(2, 'wajik'), k(3, 'wajik'), k(4, 'wajik'), k(5, 'wajik')],
        ket: 'Pungutan 2 (3 dan 5 Wajik), modal 2 (2 dan 4 Wajik). Sama banyak: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Modal mengapit',
        kartu: [k(3, 'wajik'), k(4, 'wajik'), k(5, 'wajik'), k(6, 'wajik')],
        ket: 'Modal 4 dan 6 Wajik, pungutan 3 dan 5 Wajik: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Modal dengan joker',
        kartu: [k(2, 'wajik'), k(3, 'wajik'), k(9, 'waru', 4)],
        ket: 'Modal 2 Wajik dan 9 Waru (joker) sebagai 4 Wajik. Ada kartu biasa di modal: sah.',
        sah: true,
      },
      {
        t: 'contoh',
        judul: 'Modal joker semua',
        kartu: [k(9, 'waru', 2), k(3, 'wajik'), k(9, 'love', 4), k(5, 'wajik')],
        ket: 'Modalnya cuma dua joker pengganti, tanpa kartu biasa: tidak sah.',
        sah: false,
      },
      {
        t: 'contoh',
        judul: 'Kartu paling bawah ditinggal',
        kartu: [k(4, 'wajik'), k(5, 'wajik'), k(6, 'wajik')],
        ket: 'Kalau cuma mungut 2 kartu teratas, kartu paling bawahnya K Kriting. Menjadikan 4-5-6 Wajik saja tidak sah, karena K Kriting tidak ikut dijadikan.',
        sah: false,
      },
      {
        t: 'catatan',
        teks: 'Di aplikasi: ketuk kartu di buangan untuk mungut kartu itu dan semua yang ada di atasnya, susun kombinasinya, lalu konfirmasi. Kalau syaratnya belum terpenuhi, aplikasi menjelaskan alasannya.',
      },
    ],
  },
  {
    id: 'mentung',
    judul: 'Mentung',
    ikon: '💥',
    ringkas: 'Cara nutup, siapa yang kepentung, nilai pentungan, dan arah putaran.',
    isi: [
      {
        t: 'paragraf',
        teks: '**Mentung** (nutup) artinya membuang kartu terakhir di tanganmu. Kartu yang dibuang itu disebut **pentungan**. Mentung cuma sah di giliran yang kamu awali dengan mulung.',
      },
      {
        t: 'daftar',
        butir: [
          'Begitu kamu mentung, permainan masuk susun akhir, lalu putaran dihitung.',
          'Kamu dapat bonus sebesar nilai pentungan: kartu angka 50, Londo 100, As 150, joker 250.',
          'Pentungan joker tidak kena −25, malah bernilai 250. Tapi joker yang sudah pernah dibuang (lalu dipungut) sudah jadi kartu biasa, jadi dinilai sebagai kartu aslinya.',
        ],
      },
      {
        t: 'paragraf',
        teks: '**Kepentung:** setiap pemain yang kartu buangannya kamu pungut di giliran itu lalu kamu pakai di kartu jadi, kena potongan sebesar nilai pentungan.',
      },
      {
        t: 'daftar',
        butir: [
          'Masing-masing kena sekali saja, walaupun beberapa kartunya terpakai.',
          'Kartu buanganmu sendiri yang kamu pungut tidak bikin kamu kepentung.',
          'Pemilik kartu yang kamu pakai sebagai pentungan tidak kena gara-gara kartu itu.',
          'Kartu pungutan yang sempat masuk tangan lalu kamu turunkan di giliran yang sama tetap dihitung.',
        ],
      },
      {
        t: 'paragraf',
        teks: '**Balik arah atau lompat:** kalau pemain tepat sebelum yang mentung ikut kepentung, arah putaran berikutnya **dibalik**. Kalau tidak (**lompat**), arah tetap. Yang kepentung dan arah berikutnya sudah ditentukan saat mentung, tidak berubah oleh susun akhir.',
      },
      {
        t: 'paragraf',
        teks: '**Contoh A (balik arah).** 4 pemain, giliran P1 → P2 → P3 → P4. Buangan dari bawah: 10 Wajik (punya P2), 4 Love (punya P3). P4 memegang 5 Love, 6 Love, 8 Kriting. P4 mungut 4 Love, menurunkan 4-5-6 Love, lalu membuang 8 Kriting: mentung! P3 kepentung −50. Karena P3 tepat sebelum P4, arah putaran berikutnya dibalik.',
      },
      {
        t: 'paragraf',
        teks: '**Contoh B (lompat).** Buangan dari bawah: 4 Love (punya P2), 6 Waru (punya P3). P4 memegang 5 Love dan 6 Love. P4 mungut dua kartu dan menurunkan 4-5-6 Love, 6 Waru masuk tangan, lalu dibuang sebagai pentungan. Yang kepentung cuma P2, pemilik 4 Love. P3 aman karena kartunya jadi pentungan, bukan dipakai di kartu jadi. P3 tepat sebelum P4 tapi tidak kepentung, jadi lompat: arah tetap.',
      },
      {
        t: 'tabel',
        kepala: ['Contoh A', 'Status', 'Skor putaran'],
        baris: [
          ['P4 (4-5-6 Love, tangan kosong)', 'Mentung pakai 8 Kriting', '15 + 50 = 65'],
          ['P3 (tangan 4 Waru)', 'Kepentung', '−5 − 50 = −55'],
          ['P1 dan P2 (tangan 1 kartu angka)', 'Aman', '−5'],
        ],
      },
      {
        t: 'catatan',
        teks: 'Aplikasi tidak memberi tanda kartu berbahaya. Menimbang kartu mana yang aman dibuang adalah skill pemain, sama seperti di kedai.',
      },
    ],
  },
  {
    id: 'akhir-putaran',
    judul: 'Akhir putaran',
    ikon: '⏳',
    ringkas: 'Deck habis, mentung, dan fase susun akhir.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Putaran berakhir dengan dua cara: ada yang **mentung**, atau **deck habis**.',
      },
      {
        t: 'paragraf',
        teks: '**Deck habis:** pemain yang mengambil kartu terakhir deck menyelesaikan gilirannya dulu (boleh menurunkan kartu jadi, lalu wajib buang). Karena ambilnya dari deck, giliran itu tidak bisa dipakai mentung. Tidak ada yang mentung, jadi semua dihitung skor dasar dan arah putaran berikutnya tetap.',
      },
      {
        t: 'paragraf',
        teks: '**Susun akhir:** setelah mentung atau deck habis, semua pemain dapat kesempatan terakhir menurunkan kartu jadi dari tangan.',
      },
      {
        t: 'daftar',
        butir: [
          'Tanpa mulung, tanpa ambil, dan tanpa buang.',
          'Semua pemain menyusun bersamaan, tidak perlu menunggu giliran.',
          'Aturan kartu jadi tetap berlaku, termasuk syarat 3 As.',
          'Tangan boleh habis, tapi itu tidak dihitung mentung.',
          'Kalau sudah, tekan Selesai. Setelah Selesai, kamu tidak bisa menurunkan lagi.',
          'Pemain yang tangannya sudah kosong (yang mentung) otomatis selesai.',
          'Di meja online, batas waktunya sama dengan batas giliran. Kalau lewat, warga kedai menurunkan kartu jadi yang bisa lalu menekan Selesai untukmu.',
        ],
      },
      {
        t: 'paragraf',
        teks: 'Setelah semua selesai, skor putaran dihitung dan ditambahkan ke skor total.',
      },
      {
        t: 'catatan',
        teks: 'Beberapa detail susun akhir (siapa saja yang ikut, boleh sampai tangan habis, serentak, dan batas waktunya di meja online) masih menunggu konfirmasi pemilik aturan. Yang tertulis di sini adalah cara aplikasi berjalan sekarang.',
      },
    ],
  },
  {
    id: 'skor',
    judul: 'Skor',
    ikon: '🧮',
    ringkas: 'Rumus skor tiap putaran dan contoh hitungannya.',
    isi: [
      {
        t: 'tabel',
        kepala: ['Status', 'Rumus'],
        baris: [
          ['Aman (tidak mentung, tidak kepentung)', 'nilai kartu jadi − nilai tangan'],
          ['Mentung', 'nilai kartu jadi + nilai pentungan'],
          ['Kepentung', 'nilai kartu jadi − nilai tangan − nilai pentungan'],
        ],
      },
      {
        t: 'paragraf',
        teks: 'Nilai kartu: angka 2 sampai 10 = 5, Londo = 10, As = 15. Joker yang masih hidup di tangan = 25. Di kartu jadi, joker pengganti bernilai kartu yang digantikan.',
      },
      {
        t: 'paragraf',
        teks: 'Penalti **buang joker −25** per joker berlaku di status apa pun. Skornya **akumulatif**: hasil tiap putaran ditambahkan ke skor total.',
      },
      {
        t: 'paragraf',
        teks: 'Contoh dari aturan Kedai Madya (masing-masing berdiri sendiri, tanpa joker):',
      },
      {
        t: 'tabel',
        kepala: ['Pemain', 'Kartu jadi', 'Tangan', 'Hitungan', 'Skor'],
        baris: [
          ['A, aman', 'J-Q-K Love', '5 Love, 8 Wajik, 9 Wajik', '(10+10+10) − (5+5+5)', '15'],
          ['B, aman (2 deck)', '2-3-4 Love', '2 Love, 9 Waru, As Wajik, J Waru', '(5+5+5) − (5+5+15+10)', '−20'],
          ['C, mentung pakai 6 Love', '3-4-5 Kriting dan As Waru, As Love, As Kriting', 'kosong', '(5+5+5) + (15+15+15) + 50', '110'],
          ['D, kepentung pentungan Q Love', 'J-Q-K Kriting', '3 Love, 10 Kriting, 5 Waru', '(10+10+10) − (5+5+5) − 100', '−85'],
        ],
      },
      {
        t: 'paragraf',
        teks: 'Contoh joker, misal joker putaran ini 5: seri 7 dan 8 Kriting ditambah 5 Waru sebagai 9 Kriting bernilai 5 + 5 + 5 = 15. Kalau 5 Waru itu masih di tangan waktu dihitung, nilainya −25.',
      },
      {
        t: 'catatan',
        teks: 'Setelah putaran selesai, ketuk nama pemain di tabel skor untuk melihat rincian hitungannya.',
      },
    ],
  },
  {
    id: 'akhir-permainan',
    judul: 'Akhir permainan',
    ikon: '🏁',
    ringkas: 'Kapan permainan selesai dan siapa pemenangnya.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Permainan selesai kalau salah satu syarat ini terpenuhi. Tiap syarat bisa dinyalakan atau dimatikan waktu menyiapkan meja.',
      },
      {
        t: 'daftar',
        butir: [
          'Sepakat berhenti: di antara putaran, semua pemain manusia yang terhubung setuju mengakhiri permainan.',
          'Batas putaran: permainan selesai setelah jumlah putaran tertentu.',
          'Batas skor atas: ada pemain yang skor totalnya mencapai batas itu atau lebih.',
          'Batas skor bawah: ada pemain yang skor totalnya turun sampai batas itu atau lebih rendah.',
        ],
      },
      {
        t: 'paragraf',
        teks: 'Batas skor dan batas putaran dicek di **akhir setiap putaran**. Permainan tidak bisa diakhiri di tengah putaran.',
      },
      {
        t: 'paragraf',
        teks: 'Bawaan aplikasi: tanpa batas putaran dan tanpa batas skor, jadi main terus sampai semua sepakat berhenti.',
      },
      {
        t: 'paragraf',
        teks: '**Pemenang** adalah pemain dengan skor total tertinggi. Skor sama berarti peringkat sama.',
      },
    ],
  },
  {
    id: 'antarmuka',
    judul: 'Cara main di aplikasi',
    ikon: '👆',
    ringkas: 'Ketuk, seret, tombol, urutkan kartu, emote, dan pengaturan.',
    isi: [
      {
        t: 'paragraf',
        teks: 'Semua aksi bisa dilakukan dengan **ketuk**, dan beberapa juga bisa dengan **seret**. Di komputer, mouse dipakai seperti jari.',
      },
      {
        t: 'tabel',
        kepala: ['Mau apa', 'Caranya'],
        baris: [
          ['Ambil dari deck', 'Ketuk deck, atau tekan tombol Ambil deck.'],
          ['Mulung', 'Ketuk kartu di buangan: kamu mungut kartu itu dan semua yang ada di atasnya.'],
          ['Menyusun hasil mulung', 'Pilih kartu dari tangan dan pungutan, jadikan kombinasi, lalu konfirmasi. Kartu paling bawah pungutan diberi tanda karena wajib dijadikan.'],
          ['Pilih kartu', 'Ketuk kartu di tanganmu. Ketuk lagi untuk batal.'],
          ['Turunkan kartu jadi', 'Pilih minimal 3 kartu, lalu tekan Turunkan.'],
          ['Buang', 'Pilih 1 kartu lalu tekan tombol Buang, atau seret kartunya ke tumpukan buangan.'],
          ['Atur urutan tangan', 'Seret kartu ke posisi baru, atau tekan ⇅ untuk mengurutkan per bunga atau per angka.'],
          ['Selesai menyusun', 'Di susun akhir, tekan Selesai kalau sudah tidak ada yang mau diturunkan.'],
        ],
      },
      {
        t: 'daftar',
        butir: [
          'Tombol utama ada di kanan bawah, dan labelnya menjelaskan aksinya, misalnya "Ambil deck" atau "Buang 7♥".',
          'Tombol yang belum bisa dipakai tetap menjelaskan alasannya kalau diketuk.',
          'Kalau kartu pilihanmu bisa disusun lebih dari satu cara, kamu akan diminta memilih susunannya.',
          'Kartu yang baru masuk tangan ditaruh di ujung kanan. Urutan kartu lain tidak berubah.',
          'Emote: tekan tombol emote di bar atas untuk mengirim emoji atau celetukan singkat ke meja.',
          'Skor dan log permainan bisa dibuka dari bar atas. Menu ☰ berisi Pengaturan, Bantuan & aturan, pintasan keyboard (kalau pakai keyboard/mouse), Layar penuh, Tentang, dan tombol keluar (Simpan & ke beranda di permainan offline).',
          'Pengaturan seperti suara, musik, getar, kurangi gerak, kecepatan animasi, kartu empat warna, dan ukuran teks hanya berlaku di HP-mu sendiri.',
          'Kalau ada pintasan keyboard, daftarnya bisa dilihat di menu.',
        ],
      },
      {
        t: 'catatan',
        teks: 'Aplikasi tidak pernah menandai joker dan tidak memperingatkan kartu berbahaya. Ingat dan timbang sendiri, seperti main di kedai.',
      },
    ],
  },
  {
    id: 'online',
    judul: 'Main online & offline',
    ikon: '📶',
    ringkas: 'Buat atau gabung meja, kode meja, sambung ulang, dan main bareng warga kedai.',
    isi: [
      {
        t: 'paragraf',
        teks: '**Offline bareng warga kedai** jalan sepenuhnya di HP tanpa internet, dan tersimpan otomatis tiap aksi. Kamu bisa lanjut kapan saja dari beranda. **Online** butuh internet dan bisa dimainkan bareng teman.',
      },
      {
        t: 'paragraf',
        teks: `**Level warga kedai** (${DAFTAR_LEVEL_WARGA.map((l) => l.label).join(', ')}) dipilih di Atur meja (main offline), atau per kursi di lobi oleh host (meja online). Warga kedai nggak bisa ngintip kartu orang: yang dilihatnya sama dengan yang terlihat dari kursinya.`,
      },
      {
        t: 'langkah',
        butir: [
          'Isi nama, lalu tekan Buat meja baru. Kamu jadi host.',
          'Bagikan kode meja (5 karakter, huruf dan angka), atau salin dan bagikan link undangannya.',
          'Atur kursi: tunggu teman masuk, atau ajak warga kedai (pemain komputer) lalu pilih levelnya. Host juga mengatur jumlah pemain, batas putaran, batas skor, waktu per giliran, tempo warga kedai, dan apakah meja muncul di daftar meja publik.',
          'Kalau semua kursi sudah terisi, host menekan Mulai main.',
        ],
      },
      {
        t: 'paragraf',
        teks: '**Gabung meja:** masukkan kode meja lalu tekan Gabung, buka link undangan dari teman, atau pilih dari Cari meja publik. Kode meja tidak memakai huruf dan angka yang mirip (0/O, 1/I/L), jadi gampang dibacakan.',
      },
      {
        t: 'daftar',
        butir: [
          'Orang baru hanya bisa masuk selama meja masih di lobi.',
          `Sambungan putus atau halaman ke-refresh? Aplikasi menyambung ulang sendiri. Giliranmu ditunggu ${DETIK_TENGGANG} detik sejak kamu terputus (atau sampai waktu giliran habis, mana yang duluan). Lewat dari itu, warga kedai menjalankan giliranmu sampai kamu kembali.`,
          'Keluar meja di tengah permainan: kursimu diteruskan warga kedai sampai permainan selesai, dan nggak bisa diambil lagi.',
          'Waktu giliran habis: warga kedai menyelesaikan giliranmu.',
          'Kalau semua pemain manusia terputus, meja menunggu sampai ada yang kembali. Waktu giliran diberi penuh lagi begitu ia tersambung.',
          'Host pergi: tugas host pindah ke pemain manusia lain yang masih terhubung.',
          'Putaran berikutnya dimulai oleh host. Kalau skor terendah sama, host memilih pengocok atau Acak.',
          'Pengumuman joker menunggu semua pemain menekan OK. Pemain yang terputus tidak ditunggu. Kalau ia kembali sebelum sempat menekan OK, popup joker muncul lagi untuknya.',
          'Meja tanpa pemain yang terhubung dihapus otomatis setelah 10 menit.',
        ],
      },
      {
        t: 'paragraf',
        teks: 'Hasil akhir permainan online masuk **Riwayat & peringkat**. Peringkat menggabungkan pemain berdasarkan nama, jadi pakai nama yang sama setiap main.',
      },
    ],
  },
];

export const FAQ: { tanya: string; jawab: string }[] = [
  {
    tanya: 'Kenapa angka joker nggak muncul lagi setelah popup?',
    jawab: 'Itu disengaja (mode ingatan). Seperti di meja asli, angka joker cuma diumumkan sekali di awal putaran. Setelah itu kamu harus ingat sendiri, dan joker di tangan tidak diberi tanda.',
  },
  {
    tanya: 'Bisa nggak aplikasi menandai joker atau kartu yang bahaya dibuang?',
    jawab: 'Tidak. Mengingat joker dan menimbang kartu yang aman dibuang termasuk skill main di Kedai Madya, jadi aplikasi sengaja tidak membantu di situ.',
  },
  {
    tanya: 'Kenapa As-ku nggak bisa dibuang?',
    jawab: 'As belum boleh dibuang sebelum kamu punya kartu jadi di meja. Turunkan dulu satu kartu jadi.',
  },
  {
    tanya: 'Kenapa aku nggak bisa nutup padahal kartuku tinggal sedikit?',
    jawab: 'Mentung cuma sah di giliran yang diawali mulung. Habis ambil dari deck, kamu harus menyisakan minimal satu kartu di tangan setelah membuang.',
  },
  {
    tanya: 'Mulungku ditolak, katanya modalnya kurang. Maksudnya?',
    jawab: 'Di kartu jadi yang memuat kartu paling bawah pungutan, kartu dari tanganmu (modal) harus sama banyak atau lebih banyak dari kartu pungutan, dan minimal satu modal harus kartu biasa, bukan joker pengganti.',
  },
  {
    tanya: 'Tanganku tinggal 1 kartu, kok nggak bisa mulung?',
    jawab: 'Kartu jadi minimal 3 kartu dan modal harus sama banyak atau lebih dari pungutan. Dengan 1 kartu di tangan, modal paling banyak 1, jadi pungutan paling banyak 1, dan kombinasinya cuma 2 kartu. Karena mentung harus diawali mulung, tangan 1 kartu juga tidak bisa mentung. Yang bisa dilakukan: ambil dari deck lalu buang.',
  },
  {
    tanya: 'Boleh nempel kartu ke kartu jadi yang sudah ada?',
    jawab: 'Tidak boleh, baik ke kartu jadi sendiri maupun punya lawan. Setiap menurunkan, kamu membentuk kartu jadi baru.',
  },
  {
    tanya: 'Berapa ruginya buang joker?',
    jawab: '−25 per joker di putaran itu, dan joker itu jadi kartu biasa. Kecuali dibuang sebagai pentungan waktu mentung: tidak kena −25, malah bernilai 250.',
  },
  {
    tanya: 'Kartu buangan yang lama kok nggak kelihatan?',
    jawab: 'Yang kelihatan cuma kartu teratas sebanyak jumlah pemain dikurangi satu, karena hanya sebanyak itu yang bisa dipungut. Sisanya harus diingat sendiri.',
  },
  {
    tanya: 'Apa bedanya balik arah dan lompat?',
    jawab: 'Setelah mentung, kalau pemain tepat sebelum yang mentung ikut kepentung, arah putaran berikutnya dibalik. Kalau tidak, namanya lompat dan arah tetap.',
  },
  {
    tanya: 'Siapa yang ngocok putaran berikutnya?',
    jawab: 'Pemain dengan skor total paling rendah. Kalau ada yang sama, bebas dipilih di antara mereka.',
  },
  {
    tanya: 'Deck habis, terus gimana?',
    jawab: 'Yang mengambil kartu terakhir menyelesaikan gilirannya, lalu semua pemain dapat susun akhir. Setelah itu semua dihitung skor dasar dan arah tetap.',
  },
  {
    tanya: 'Internetku putus waktu main online. Kartuku hilang?',
    jawab: `Tidak. Kartumu tetap di kursimu. Giliranmu ditunggu ${DETIK_TENGGANG} detik, dihitung sejak kamu terputus. Lewat dari itu, warga kedai yang menjalankan giliranmu sampai kamu kembali. Buka lagi aplikasinya, dan kamu kembali ke kursimu.`,
  },
  {
    tanya: 'Ada taruhan atau koin di game ini?',
    jawab: 'Tidak ada. Skornya cuma poin buat seru-seruan.',
  },
];

export const GLOSARIUM: { istilah: string; arti: string }[] = [
  { istilah: 'Bunga', arti: 'Jenis kartu: Love (♥), Wajik (♦), Kriting (♣), dan Waru (♠).' },
  { istilah: 'Love', arti: 'Bunga hati (♥), warna merah.' },
  { istilah: 'Wajik', arti: 'Bunga wajik (♦), warna merah.' },
  { istilah: 'Kriting', arti: 'Bunga keriting (♣), warna hitam.' },
  { istilah: 'Waru', arti: 'Bunga sekop (♠), warna hitam.' },
  { istilah: 'Londo', arti: 'Kartu bergambar: J, Q, dan K.' },
  { istilah: 'Joker', arti: 'Semua kartu yang angkanya sama dengan kartu yang dibuka di awal putaran. Angkanya diumumkan sekali saja.' },
  { istilah: 'Joker mati', arti: 'Joker yang pernah dibuang di putaran itu. Sudah jadi kartu biasa sampai putaran selesai.' },
  { istilah: 'Joker pengganti', arti: 'Joker yang dipakai menggantikan kartu angka lain di seri.' },
  { istilah: 'Kartu jadi', arti: 'Kombinasi sah yang diturunkan ke meja: seri angka, seri Londo, atau kembar As.' },
  { istilah: 'Seri', arti: 'Kartu berurutan dengan bunga yang sama: angka 2 sampai 10, atau J-Q-K.' },
  { istilah: 'Kembar As', arti: '3 atau 4 As yang bunganya beda semua.' },
  { istilah: 'Deck', arti: 'Tumpukan kartu tertutup tempat mengambil kartu.' },
  { istilah: 'Buangan', arti: 'Tumpukan kartu terbuka hasil buangan pemain.' },
  { istilah: 'Mulung / mungut', arti: 'Mengambil satu atau beberapa kartu teratas dari buangan.' },
  { istilah: 'Pungutan', arti: 'Kartu-kartu yang diambil dari buangan waktu mulung.' },
  { istilah: 'Modal', arti: 'Kartu dari tanganmu yang dipakai bersama pungutan di kartu jadi.' },
  { istilah: 'Mentung / nutup', arti: 'Membuang kartu terakhir di tangan, di giliran yang diawali mulung.' },
  { istilah: 'Pentungan', arti: 'Kartu terakhir yang dibuang waktu mentung. Nilainya jadi bonus dan potongan.' },
  { istilah: 'Kepentung', arti: 'Kena potongan pentungan karena kartu buanganmu dipungut lalu dipakai di kartu jadi oleh yang mentung (bukan sebagai pentungannya).' },
  { istilah: 'Balik arah', arti: 'Arah putaran berikutnya dibalik, karena pemain tepat sebelum yang mentung ikut kepentung.' },
  { istilah: 'Lompat', arti: 'Pemain tepat sebelum yang mentung tidak kepentung, jadi arah putaran tetap.' },
  { istilah: 'Pengocok', arti: 'Pemain yang membagi kartu dan jalan pertama di putaran itu.' },
  { istilah: 'Putaran', arti: 'Satu babak dari pembagian kartu sampai skor dihitung.' },
  { istilah: 'Susun akhir', arti: 'Kesempatan terakhir semua pemain menurunkan kartu jadi setelah mentung atau deck habis.' },
  { istilah: 'Mode ingatan', arti: 'Seperti meja asli: angka joker diumumkan sekali, dan kartu buangan lama harus diingat sendiri.' },
];
