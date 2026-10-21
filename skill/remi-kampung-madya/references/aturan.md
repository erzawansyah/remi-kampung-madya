# Aturan main Remi Kampung Madya

Disalin dari README proyek (bagian "Ringkasan aturan" dan keputusan pemilik yang menyangkut cara main). Ini aturan tongkrongan Kedai Madya: **berbeda dari remi/rummy umum**. Kalau ingatanmu soal remi bertentangan dengan dokumen ini, dokumen ini yang benar. Server yang memvalidasi setiap aksi; kalau ditolak, baca pesan penolakannya.

Istilah: bunga = Love ♥ / Wajik ♦ / Kriting ♣ / Waru ♠. Londo = J, Q, K. Kartu jadi = kombinasi yang diturunkan. Modal = kartu dari tangan. Mulung/mungut = mengambil dari buangan. Mentung/nutup = membuang kartu terakhir. Pentungan = kartu yang dibuang saat mentung. Kepentung = yang kena pentungan.


**Pemain & deck**
| Pemain | Deck | Kartu awal |
|---|---|---|
| 2–4 | 1 deck (52) | 6 |
| 4 (opsi 2 deck) | 2 deck (104) | 12 |
| 5–6 | 2 deck (104) | 9 |

Kartu bergambar joker tidak dipakai.

**Persiapan putaran**
- Pengocok putaran pertama bebas dipilih atau diacak.
- Putaran berikutnya, pengocoknya pemain dengan skor akumulasi terendah. Kalau ada yang sama, bebas di antara mereka.
- Pengocok membuka 1 kartu dari sisa deck. Angkanya menjadi angka joker, lalu kartunya diselipkan ke posisi acak di deck.
- Angka joker tidak boleh sama dengan joker **putaran tepat sebelumnya** (keputusan pemilik #40). Kalau kartu yang dibuka angkanya sama, kartu itu dianulir: disisihkan, lalu kartu berikutnya dibuka, sampai angkanya beda. Kartu yang dianulir ikut diselipkan acak ke deck sesudah kartu joker, jadi jumlah kartu deck tetap. Hanya dibandingkan dengan putaran tepat sebelumnya: putaran 3 boleh sama dengan putaran 1. Putaran pertama (juga permainan baru sesudah "Main lagi") bebas. Popup joker hanya menampilkan kartu joker yang berlaku, tanpa penjelasan anulir.
- Pengocok jalan pertama.

**Giliran: Ambil → (Turunkan) → Buang**
- **Ambil:** 1 kartu dari deck, atau mulung k kartu teratas buangan (1 ≤ k ≤ jumlah pemain − 1).
- **Mulung:**
  - Kartu paling bawah dari yang dipungut wajib langsung jadi kartu jadi baru.
  - Di kombinasi itu, modal dari tangan ≥ jumlah kartu pungutan, dan modal memuat minimal 1 kartu biasa (bukan joker pengganti).
  - Sisa pungutan masuk tangan.
- **Turunkan:** opsional, boleh beberapa kombinasi. Kartu tidak boleh ditempel ke kartu jadi yang sudah ada.
- **Buang:** wajib 1 kartu (kecuali nutup pakai beberapa joker, lihat Mentung). As tidak boleh dibuang sebelum punya kartu jadi.

**Kartu jadi**
- **Seri angka:** satu bunga, berurutan, 3–9 kartu, hanya dalam rentang 2–10.
- **Seri Londo:** hanya J-Q-K satu bunga.
- Angka dan Londo tidak bisa disambung. As tidak bisa masuk seri.
- **Kembar As:** 3 atau 4 As dengan bunga berbeda semua. 4 As selalu boleh. 3 As butuh kartu jadi lain **milikmu sendiri** (sudah kamu turunkan sebelumnya, atau diturunkan bersamaan di aksi yang sama). Kartu jadi pemain lain tidak dihitung; server menolak dengan "3 As baru boleh turun kalau kamu sudah punya kartu jadi lain."

**Joker**
- Joker = semua kartu yang angkanya sama dengan kartu yang dibuka.
- Joker bisa menggantikan kartu apa pun kecuali Londo dan As.
- Joker selalu boleh dipakai sebagai kartu aslinya, dan dalam peran itu dihitung kartu biasa.
- Jumlah joker pengganti dalam satu seri ≤ jumlah kartu biasa, dan joker pengganti tidak boleh bersebelahan (selang-seling).
- **2 deck:** kartu kembar boleh ada di seri yang sama asal salah satunya dipakai sebagai joker pengganti untuk angka lain. Contoh dengan joker 5: 4♥ 5♥ 6♥ + 5♥ dari deck kedua sebagai 7♥ sah. Dua kartu yang mewakili angka sama di satu seri tetap tidak boleh.
- Joker yang dibuang kehilangan status jokernya dan jadi kartu biasa. Pembuangnya kena −25 per kartu di putaran itu, kecuali joker itu dipakai sebagai pentungan.
- **Pengumuman joker hanya sekali:** di awal tiap putaran muncul popup kartu yang dibuka. Permainan baru mulai setelah semua pemain manusia menekan OK. Pemain online yang terputus sebelum menekan OK mendapat popup itu lagi saat tersambung kembali.
- Sesudah itu angka joker **tidak ditampilkan lagi** (tidak di bar atas, tidak ada pengingat), dan kartu joker di tangan tidak diberi penanda. Pemain harus ingat sendiri.
- Yang tetap terlihat, seperti di meja asli (keputusan pemilik): joker yang sudah dipasang sebagai pengganti di kartu jadi ditandai perannya (label "→4" di meja, log "(7 Waru jadi 4)"), dan sorakan JOKER DIBUANG?! menyebut kartu yang dibuang. Keduanya boleh jadi petunjuk bagi pemain lain.

**Mentung**
- Mentung = membuang kartu terakhir di tangan. Hanya sah di giliran yang diawali mulung.
- **Mentung pakai beberapa joker** (keputusan #41): boleh membuang 2 kartu atau lebih sekaligus untuk nutup, asal **semuanya joker hidup**, semuanya sisa tangan (tangan jadi kosong), dan giliran itu diawali mulung. Joker yang sudah pernah dibuang (joker mati) dihitung kartu biasa, jadi tidak bisa ikut. Membuang lebih dari satu kartu di luar itu ditolak; pemeriksaannya berurutan (kartu ada di tangan, tidak dobel, semua sisa tangan ikut, giliran diawali mulung, baru semuanya joker hidup), jadi pesan penolakan tidak menyebut joker sebelum syarat lainnya terpenuhi.
- Setelah mentung, semua pemain masih boleh menyusun di **fase susun akhir** (lihat bagian Deck habis), baru putaran dihitung. Yang kepentung dan arah putaran berikutnya sudah ditentukan saat mentung.
- **Kepentung:** setiap pemilik kartu pungutan (di giliran itu) yang dipakai di kartu jadi, kecuali diri sendiri. Masing-masing kena nilai pentungan penuh (kalau pentungannya beberapa joker: jumlahnya), sekali per pemain. Pemilik kartu pentungan tidak kena karena kartu itu.
- **Arah putaran berikutnya:** dibalik kalau pemain tepat sebelum yang mentung ikut kepentung. Kalau tidak ("lompat"), arah tetap.
- **Deck habis:** pemain yang mengambil kartu terakhir deck menyelesaikan gilirannya (turunkan, buang). Lalu ada **fase susun akhir**: semua pemain boleh menurunkan kartu jadi dari tangan (tanpa mulung, tanpa buang, tangan boleh habis), lalu menekan Selesai. Setelah semua selesai, semua pemain dihitung skor dasar dan arah tetap.

**Skor**
| Kartu | Tangan / kartu jadi | Pentungan |
|---|---|---|
| 2–10 | 5 | 50 |
| J, Q, K | 10 | 100 |
| As | 15 | 150 |
| Joker | Tangan 25 (joker hidup). Joker yang sudah pernah dibuang lalu dipungut lagi sudah jadi kartu biasa: di tangan bernilai kartu aslinya. Di kartu jadi bernilai kartu yang diwakili | 250 per joker (nutup pakai beberapa joker: 2 joker 500, 3 joker 750). Joker yang sudah pernah dibuang (hasil mungut) sudah jadi kartu biasa: nilai kartu aslinya |

- **Skor dasar:** jadi − tangan.
- **Yang mentung:** jadi + pentungan.
- **Yang kepentung:** jadi − tangan − pentungan.
- Pentungan beberapa joker dihitung sebagai satu nilai total: yang mentung dapat sekali, tiap kepentung kena totalnya.
- **Putaran kaldu** (keputusan #42, lihat Akhir permainan): nilai pentungan **dikali 2**, untuk yang mentung maupun tiap kepentung. Contoh: pentungan 50 jadi ±100, As 150 jadi ±300, satu joker 250 jadi ±500, dua joker 500 jadi ±1000. Kartu jadi, tangan, dan penalti −25 tidak dikali.
- Penalti buang joker −25 per kartu (tidak berlaku untuk joker yang dipakai sebagai pentungan). Skor bersifat akumulatif.

**Akhir permainan** (tiap syarat bisa dinonaktifkan): sepakat berhenti, batas putaran, atau batas skor atas/bawah. Batas skor dicek di akhir putaran. Angka batas skor bebas, asal kelipatan 10 (keputusan pemilik #44): batas atas 10 sampai 100000, batas bawah −10 sampai −100000, kosong = tanpa batas.

**Mode kaldu** (opsi meja, bawaan mati; keputusan pemilik #42, #43):
- **Putaran kaldu** = putaran terakhir yang pentungannya dikali 2 (lihat Skor). Dimulai di putaran ke-N kalau ada batas putaran N, atau di putaran sesudah semua pemain sepakat "putaran berikutnya terakhir". Voting itu hanya di antara putaran, dan tidak bisa diulang kalau putaran berikutnya memang sudah kaldu.
- Putaran kaldu yang **ditutup mentung** mengakhiri permainan.
- Putaran kaldu yang **deck-nya habis** tanpa ada yang mentung tidak mengakhiri permainan: disusul putaran kaldu lagi, begitu seterusnya sampai ada yang mentung. Pengocoknya tetap pemain dengan skor akumulasi terendah.
- Batas putaran di mode kaldu hanya memicu kaldu, tidak mengakhiri permainan. **Batas skor tidak dipakai** (#43). Tanpa batas putaran dan tanpa voting, permainan jalan biasa.
- **"Akhiri permainan" tetap bisa** di antara putaran, termasuk di tengah kaldu lanjutan.


## Keputusan pemilik yang menyangkut cara main

- 2 deck: 4 As harus beda bunga semua (tidak boleh As bunga sama dalam satu kembar).
- Syarat modal ≥ pungutan saat mulung hanya berlaku untuk kombinasi yang memuat kartu paling bawah pungutan.
- Habis ambil dari deck, sesudah buang wajib tersisa ≥ 1 kartu (tidak bisa nutup dari deck).
- Deck habis: begitu kartu terakhir diambil, giliran itu diselesaikan, lalu fase susun akhir. Arah sesudah deck habis tetap.
- Kartu buanganmu sendiri yang terpakai saat kamu mentung tidak membuatmu kepentung.
- Satu pemain yang beberapa kartunya terpakai tetap kena pentungan sekali.
- 3 As saat belum punya kartu jadi boleh, kalau di aksi yang sama ikut diturunkan kartu jadi lain. Dua kembar 3 As (2 deck) diturunkan bersamaan tanpa kartu jadi lain ditolak.
- As yang angkanya kebetulan joker tetap As secara fisik: tidak boleh dibuang sebelum punya kartu jadi.
- Nilai pentungan joker selalu 250 apa pun angkanya. Pentungan dari joker yang sudah pernah dibuang (hasil mungut) = nilai kartu aslinya (angka 50, Londo 100, As 150). Joker mati di tangan = nilai kartu aslinya.
- "Akhiri permainan" hanya bisa di antara putaran. Batas skor dicek di akhir putaran.
- Susun akhir: semua pemain ikut, serentak, boleh menurunkan sampai tangan habis (tidak dihitung mentung). Batas waktunya sama dengan batas giliran; lewat batas, warga kedai menurunkan yang bisa lalu selesai.
- Dengan 1 kartu di tangan kamu praktis tidak bisa mulung atau mentung lagi (modal tidak cukup untuk kartu jadi minimal 3): hanya bisa ambil deck lalu buang.
- Label "→angka" pada joker pengganti di kartu jadi, teks log "(X jadi Y)", dan sorakan JOKER DIBUANG?! memang terlihat semua orang dan boleh dipakai sebagai petunjuk, seperti di meja asli.
- Di meja online, pemain terputus diberi masa tenggang 20 detik sebelum warga kedai mengambil alih gilirannya. Batas waktu giliran meja tetap berlaku, mana yang habis lebih dulu.
