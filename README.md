# Remi Kampung Madya

Game kartu Remi versi digital dengan **aturan yang kami berlakukan saat main di Kedai Madya**, tempat biasa kami berkumpul. Aturannya beda dari remi/rummy umum.

- **Online:** buat meja, undang teman pakai kode/link, isi kursi dengan orang, bot, atau biarkan kosong untuk menunggu orang masuk.
- **Offline lawan bot:** jalan sepenuhnya di HP tanpa internet, tersimpan otomatis.
- **PWA:** bisa dipasang ke layar utama HP, jalan fullscreen.

> Status: **Tahap 2 selesai**: mesin aturan, modul meja, server WebSocket, dan client Phaser + PWA.

## Menjalankan

Butuh Node.js LTS (≥ 22).

```bash
npm install
npm test            # semua test (mesin aturan, simulasi, meja, server)
npm run typecheck
```

**Mode pengembangan** (dua terminal):

```bash
npm run dev:server   # server WebSocket di port 2567
npm run dev:client   # Vite di http://localhost:5173 (WebSocket diteruskan ke 2567)
```

Buka `http://localhost:5173`. Dari HP di jaringan yang sama, pakai alamat "Network" yang ditampilkan Vite.

**Produksi lokal** (satu proses melayani PWA dan WebSocket):

```bash
npm run build
npm start            # http://localhost:2567
```

## Deploy ke VPS (Docker)

```bash
docker compose up -d --build     # image berisi server + file PWA, port 2567
```

- `Dockerfile` menjalankan `npm test` saat build. Kalau ada test gagal, image tidak jadi.
- Konfigurasi lewat environment: `PORT` (default 2567), `STATIC_DIR` (folder file PWA).
- **Wajib HTTPS untuk PWA.** Service worker dan "pasang ke layar utama" hanya jalan di HTTPS. Pasang reverse proxy di depan container. Contoh dengan Caddy (sertifikat otomatis, WebSocket otomatis diteruskan):

  ```
  remi.domainkamu.com {
      reverse_proxy localhost:2567
  }
  ```

- **Meja yang sedang jalan ada di memori server,** jadi restart server menghapus meja yang sedang jalan. Meja tanpa pemain terhubung dihapus otomatis setelah 10 menit.
- **Klasemen akhir permainan online** disimpan di SQLite (`node:sqlite`, bawaan Node, tanpa dependensi native) pada volume `remi-data`.
  - Endpoint baca: `GET /api/riwayat?batas=30` (permainan terbaru) dan `GET /api/peringkat` (peringkat sepanjang masa, pemain manusia digabung per nama).
  - Cadangkan file `remi.db` di volume itu kalau perlu.

## Struktur proyek

```
packages/engine/        Mesin aturan murni (TypeScript, tanpa UI, tanpa dependensi)
  src/kartu.ts          Kartu, bunga, angka, nilai dasar
  src/kartuJadi.ts      Validasi seri & kembar As, aturan joker, opsi peran joker
  src/giliran.ts        Validasi mulung, turunkan, buang (dipakai mesin, bot, dan UI)
  src/mesin.ts          State + aksi → state baru; pembagian, pengocok, mentung, akhir putaran
  src/skor.ts           Rumus skor & teks perhitungan
  src/view.ts           State dari sudut pandang satu pemain (tangan lawan & deck disembunyikan)
  src/invarian.ts       Pemeriksa state legal
  src/bot/bot.ts        Bot "mudah" dan "normal"
packages/meja/          Satu meja/room: kursi, host, bot, timer giliran, sambung ulang, voting akhiri
  src/protokol.ts       Bentuk pesan client ↔ meja
  src/validasi.ts       Validasi pesan dari jaringan (data tidak dipercaya)
  src/meja.ts           Kelas Meja (tanpa jaringan; dipakai server dan mode offline)
apps/server/            HTTP + WebSocket (ws). Melayani file PWA, /healthz, dan /ws
apps/client/            Phaser 3 + Vite + vite-plugin-pwa
  src/game/             Scene meja Phaser dan gambar kartu (dibuat dengan Canvas, tanpa file gambar)
  src/kontrolMeja.ts    Alur Ambil → (Turunkan) → Buang, mulung, modal hasil/skor/log
  src/ui/               Layar beranda, lobi, daftar meja publik (HTML)
  src/koneksi.ts        Koneksi online (WebSocket + sambung ulang) dan offline (meja di browser)
  scripts/buat-ikon.mjs Membuat ikon PWA (PNG) saat build
```

Pemisahan yang dipegang:
1. **Mesin aturan**: fungsi murni dan deterministik. RNG mulberry32 di-seed, state-nya disimpan di `GameState.rng`.
2. **State**: satu objek `GameState` yang bisa diserialisasi ke JSON.
3. **UI/server**: hanya membaca state lewat `viewUntuk()` dan mengirim `Aksi` ke `terapkanAksi()`.

Aksi yang tersedia: `mulaiPutaran`, `ambilDeck`, `mulung`, `turunkan`, `buang`, `akhiriPermainan`. Aksi ilegal ditolak dengan `{ ok: false, error: { kode, pesan } }` dan state tidak berubah. `pesan` memakai bahasa tongkrongan dan siap ditampilkan ke pemain.

### Arsitektur online

- **Server memegang state asli.** Tiap pemain hanya menerima `ViewPemain` miliknya: tangan lawan dan urutan deck tidak pernah dikirim, jadi tidak bisa diintip dari devtools.
- **Bot jalan di server** dan hanya melihat view kursinya sendiri.
- **Client memvalidasi** dengan fungsi aturan yang sama sebelum mengirim. Tombol yang tidak sah langsung menampilkan alasannya, dan server tetap memvalidasi ulang.
- **Mode offline** memakai kelas `Meja` yang sama, dijalankan di browser.
- **Kenapa `ws`, bukan Colyseus:** keunggulan Colyseus adalah sinkronisasi state yang sama ke semua pemain. Di sini tiap pemain harus menerima state berbeda (kartu rahasia), jadi fitur itu tidak terpakai.

### Penyimpanan

| Di mana | Isi |
|---|---|
| HP (`localStorage`) | Nama, token sambung ulang meja online, permainan offline yang sedang berjalan (disimpan tiap aksi), urutan kartu tangan, riwayat 30 permainan terakhir |
| Server (memori) | Meja yang sedang aktif |
| Server (SQLite) | **Klasemen akhir permainan online.** Disimpan otomatis saat permainan selesai: tanggal, kode meja, alasan selesai, jumlah putaran, serta peringkat, nama, skor, mentung, dan kepentung tiap pemain. Lokasi diatur lewat `DB_PATH` (bawaan `apps/server/data/remi.db`; di Docker `/app/data/remi.db` di volume `remi-data`). |

### Keputusan perilaku aplikasi

Ini perilaku aplikasi, bukan aturan main. Semuanya bisa diubah kalau perlu.

- Pengaturan bawaan: bot **Normal**, **tanpa batas putaran**, **tanpa batas skor**. Permainan selesai kalau semua sepakat menekan "Akhiri permainan". Pengaturan offline terakhir disimpan per HP dan dipakai lagi.
- Orang baru hanya bisa masuk saat meja masih di lobi. Setelah main, yang bisa masuk hanya pemain lama yang menyambung ulang pakai token.
- Pemain yang terputus: gilirannya dijalankan bot sampai ia kembali. Pemain yang menekan "Keluar meja" saat main: kursinya diteruskan bot permanen.
- Waktu giliran habis (default 60 detik, bisa diatur 30–120 atau tanpa batas): bot menyelesaikan giliran itu.
- Semua manusia terputus: permainan dijeda (bot berhenti) sampai ada yang kembali.
- Putaran berikutnya dimulai oleh host. Kalau skor terendah sama, host memilih pengocok atau "Acak".
- "Akhiri permainan" (di antara putaran): semua manusia yang terhubung harus setuju.
- Host pergi: host pindah ke pemain manusia lain yang masih terhubung.
- Joker di tangan tidak diberi penanda, dan tidak ada peringatan saat membuang joker (sesuai keputusan D11).
- Pengumuman joker online: pemain yang terputus tidak ditunggu. Kalau ada batas waktu giliran, popup joker juga dibatasi waktu yang sama.
- Simpanan permainan dari versi lama otomatis dilengkapi (migrasi). Kalau tetap tidak terbaca, simpanan itu dihapus supaya tidak macet.
- **Mode ingatan (seperti meja asli):**
  - Server hanya mengirim (jumlah pemain − 1) kartu teratas buangan, dan log tidak menyebut kartu yang dibuang.
  - Setiap ambil, buang, dan mungut terlihat jelas saat terjadi (animasi + teks di panel pemain), jadi pemain harus ingat sendiri.
  - Bot juga hanya melihat yang sama.
- **Tidak ada bantuan "kartu berbahaya":** menilai kartu mana yang aman dibuang adalah skill pemain.

### Meja yang hidup

- **Tempo bot:** jeda diacak, dan bot "lagi mikir…" sebelum aksi pertamanya.

  | Tempo | Mikir sebelum aksi pertama | Aksi lanjutan di giliran yang sama |
  |---|---|---|
  | Santai (bawaan) | 3–10 detik | 1,5–3 detik |
  | Normal | 2–5 detik | 1–2 detik |
  | Cepat | 0,8–2 detik | 0,5–0,9 detik |

  Diatur di lobi atau di pengaturan offline, dan bisa diganti di tengah permainan lewat menu ☰ (host / offline).
- **Animasi:**
  - Kartu terbang: deck → pemain, dan pemain → buangan. Kartu yang dibuang membesar sebentar.
  - Kartu yang sedang bergerak disembunyikan dari tangan dan buangan, jadi tidak terlihat dobel.
  - Tombol aksi dikunci selama animasi berjalan.
- **Mungut:** kartu yang dipungut dipamerkan besar di tengah layar dulu. Setelah itu kartu pungutan dan kartu modal dari tangan terbang bersama ke kartu jadi barunya, dan sisa pungutan masuk ke tangan.
- **Turunkan:** kartu dari tangan terbang ke tempatnya di kartu jadi.
- **Ambil deck:** kartu yang kamu ambil dibalik dan diperlihatkan besar (hanya di layarmu), lalu ditaruh di **ujung kanan** tangan. Urutan kartu lain tidak berubah. Lawan hanya melihat kartu tertutup terbang ke panelnya.
- **Mentung:** pentungan dibuang tertutup ke tengah meja, bergetar sebentar (dengan bunyi tegang), lalu dibuka dan nilainya muncul (+50 / +100 / +150 / +250). Setelah itu muncul **panel mentung** yang menunggu sampai ditekan Lanjut:
  - Status tiap pemain langsung terlihat: "Kamu MENTUNG!", "Kamu KEPENTUNG −50" (beserta kartumu yang dipakai), atau "Kamu aman".
  - Lencana DOUBLE PENTUNG / BALIK ARAH / LOMPAT, dan daftar siapa saja yang kepentung.
  - Rincian kartu yang dipungut dan dipasangkan (asal tiap kartu: dari siapa atau modal, dan peran joker) baru terbuka kalau diklik.
- **Panel pemain:**
  - Menampilkan aksi giliran ini, misalnya "mungut 9♦ · buang A♠".
  - Berkedip merah dengan tulisan **TINGGAL 1!** kalau pemain itu tinggal satu kartu.
- **Notifikasi** "X mungut 9♦ punyamu!" saat kartu buanganmu dipungut.
- **Sorakan:**

  | Sorakan | Kapan muncul |
  |---|---|
  | MENTUNG! | Ada yang mentung |
  | PENTUNG JOKER! | Pentungannya joker (250) |
  | DOUBLE / TRIPLE / QUADRA PENTUNG!, PENTUNG MASSAL! | 2, 3, 4, atau 5 pemain kepentung sekaligus |
  | KAMU KEPENTUNG! | Kamu sendiri kepentung (dengan getar) |
  | BALIK ARAH! / LOMPAT! | Arah putaran berikutnya dibalik / tetap |
  | SAPU BERSIH! | Mungut jumlah maksimal (n − 1, minimal 2) |
  | MULUNG BERUNTUN ×N! | Pemain yang sama mulung 3 gilirannya berturut-turut atau lebih dalam satu putaran |
  | KEMBAR AS! | 4 As turun |
  | JOKER DIBUANG?! | Ada yang membuang joker (−25) |
  | TINGGAL 1 KARTU! | Lawan tinggal satu kartu (sekali per pemain per putaran) |
  | DECK HABIS! / PUTARAN N | Masuk susun akhir / putaran baru dimulai |

- **Kontrol:**
  - Penunjuk langkah ① Ambil → ② Turunkan → ③ Buang.
  - Tombol utama besar selalu di kanan bawah dengan label jelas, misalnya "Ambil deck", "Buang 7♥", atau "Mentung pakai 7♥!". Tombol kedua (Mulung/Turunkan) di sebelahnya.
  - Langsung di meja: ketuk deck untuk ambil, ketuk kartu di buangan untuk mungut sampai kartu itu, dan **seret kartu ke tumpukan buangan untuk membuang**.
- **Waspada:**
  - Label **KARTUMU DI ATAS!** dan bunyi detak jantung saat kartu teratas buangan milikmu dan lawan sedang menimbang.
  - Sorakan **KARTUMU DIPUNGUT!** kalau kartu itu diambil.
  - Kartu di kartu jadi lawan yang berasal dari buanganmu diberi tanda **kamu**.
  - Saat giliranmu membuang, tumpukan menampilkan "berikutnya: X".
- **Emote:**
  - Tombol 😀 di bar atas membuka 16 emote (emoji dan celetukan seperti "Awas!", "Sabar…", "GG").
  - Emote muncul sebagai gelembung di dekat pemainnya, dibatasi 1 per 1,2 detik.
  - Bot sesekali nyeletuk menanggapi kejadian yang terlihat semua orang, misalnya "Makasih, Bos!" saat mungut kartu orang atau "Waduh!" saat kepentung.
- **Suara dan getar:** dibuat langsung di browser (Web Audio, tanpa file, jalan offline). Ada bunyi khusus saat giliranmu, dan semuanya bisa dimatikan di menu ☰.

## Ringkasan aturan

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
- Pengocok jalan pertama.

**Giliran: Ambil → (Turunkan) → Buang**
- **Ambil:** 1 kartu dari deck, atau mulung k kartu teratas buangan (1 ≤ k ≤ jumlah pemain − 1).
- **Mulung:**
  - Kartu paling bawah dari yang dipungut wajib langsung jadi kartu jadi baru.
  - Di kombinasi itu, modal dari tangan ≥ jumlah kartu pungutan, dan modal memuat minimal 1 kartu biasa (bukan joker pengganti).
  - Sisa pungutan masuk tangan.
- **Turunkan:** opsional, boleh beberapa kombinasi. Kartu tidak boleh ditempel ke kartu jadi yang sudah ada.
- **Buang:** wajib 1 kartu. As tidak boleh dibuang sebelum punya kartu jadi.

**Kartu jadi**
- **Seri angka:** satu bunga, berurutan, 3–9 kartu, hanya dalam rentang 2–10.
- **Seri Londo:** hanya J-Q-K satu bunga.
- Angka dan Londo tidak bisa disambung. As tidak bisa masuk seri.
- **Kembar As:** 3 atau 4 As dengan bunga berbeda semua. 4 As selalu boleh. 3 As butuh kartu jadi lain (sudah di meja, atau diturunkan bersamaan).

**Joker**
- Joker = semua kartu yang angkanya sama dengan kartu yang dibuka.
- Joker bisa menggantikan kartu apa pun kecuali Londo dan As.
- Joker selalu boleh dipakai sebagai kartu aslinya, dan dalam peran itu dihitung kartu biasa.
- Jumlah joker pengganti dalam satu seri ≤ jumlah kartu biasa, dan joker pengganti tidak boleh bersebelahan (selang-seling).
- Joker yang dibuang kehilangan status jokernya dan jadi kartu biasa. Pembuangnya kena −25 per kartu di putaran itu, kecuali joker itu dipakai sebagai pentungan.
- **Pengumuman joker hanya sekali:** di awal tiap putaran muncul popup kartu yang dibuka. Permainan baru mulai setelah semua pemain manusia menekan OK.
- Sesudah itu angka joker **tidak ditampilkan lagi** (tidak di meja, bar atas, maupun log), dan kartu joker di tangan tidak diberi penanda. Pemain harus ingat sendiri.

**Mentung**
- Mentung = membuang kartu terakhir di tangan. Hanya sah di giliran yang diawali mulung.
- Setelah mentung, semua pemain masih boleh menyusun di **fase susun akhir** (lihat bagian Deck habis), baru putaran dihitung. Yang kepentung dan arah putaran berikutnya sudah ditentukan saat mentung.
- **Kepentung:** setiap pemilik kartu pungutan (di giliran itu) yang dipakai di kartu jadi, kecuali diri sendiri. Masing-masing kena nilai pentungan penuh, sekali per pemain. Pemilik kartu pentungan tidak kena karena kartu itu.
- **Arah putaran berikutnya:** dibalik kalau pemain tepat sebelum yang mentung ikut kepentung. Kalau tidak ("lompat"), arah tetap.
- **Deck habis:** pemain yang mengambil kartu terakhir deck menyelesaikan gilirannya (turunkan, buang). Lalu ada **fase susun akhir**: semua pemain boleh menurunkan kartu jadi dari tangan (tanpa mulung, tanpa buang, tangan boleh habis), lalu menekan Selesai. Setelah semua selesai, semua pemain dihitung skor dasar dan arah tetap.

**Skor**
| Kartu | Tangan / kartu jadi | Pentungan |
|---|---|---|
| 2–10 | 5 | 50 |
| J, Q, K | 10 | 100 |
| As | 15 | 150 |
| Joker | Tangan 25. Di kartu jadi bernilai kartu yang diwakili | 250. Joker yang sudah pernah dibuang (hasil mungut) sudah jadi kartu biasa: nilai kartu aslinya |

- **Skor dasar:** jadi − tangan.
- **Yang mentung:** jadi + pentungan.
- **Yang kepentung:** jadi − tangan − pentungan.
- Penalti buang joker −25 per kartu. Skor bersifat akumulatif.

**Akhir permainan** (tiap syarat bisa dinonaktifkan): sepakat berhenti, batas putaran, atau batas skor atas/bawah. Batas skor dicek di akhir putaran.

## Aturan Terbuka dan keputusan

| # | Pertanyaan | Keputusan | Status |
|---|---|---|---|
| 1 | 2 deck: 4 As boleh bunga sama? | Tidak. Kembar As harus beda bunga semua, maksimal 4 | Diputuskan pemilik aturan |
| 2 | Syarat modal untuk kombinasi lain saat mulung? | Hanya untuk kombinasi yang memuat kartu paling bawah | Diputuskan |
| 3 | Ambil dari deck lalu tangan habis? | Dilarang. Setelah ambil deck, wajib tersisa ≥ 1 kartu setelah buang | Diputuskan |
| 4 | Kapan deck habis? | Begitu kartu terakhir diambil: giliran itu diselesaikan, lalu fase susun akhir (#19) | Diputuskan |
| 5 | Belum punya kartu jadi dan tangan isinya As semua? | Tidak mungkin terjadi: tanpa kartu jadi, tangan selalu ≥ 7 kartu (1 deck) atau ≥ 10 (2 deck), sedangkan jumlah As hanya 4 atau 8 | Gugur |
| 6 | Batas panjang seri? | Seri angka 2–10 (maks 9 kartu); Londo hanya J-Q-K; tidak bisa disambung | Diputuskan (mengubah 7.1) |
| 7 | Seri dengan banyak joker? | Joker pengganti ≤ kartu biasa, tidak boleh dempet | Diputuskan |
| 8 | Kartu buangan sendiri terpakai saat mentung? | Tidak bikin diri sendiri kepentung | Diputuskan |
| 9 | Satu pemain beberapa kartunya terpakai? | Kena pentungan sekali | Diputuskan |
| 10 | 3 As saat belum punya kartu jadi? | Boleh kalau di aksi yang sama ikut diturunkan kartu jadi lain | Diputuskan |
| 11 | As ber-angka joker boleh dibuang sebelum punya kartu jadi? | Tidak, fisiknya tetap As. Opsi `asJokerBolehDibuangTanpaJadi` tetap ada, default `false` | Diputuskan |
| 12 | Joker dibuang | −25 per kartu di putaran itu; kartunya jadi kartu biasa; sebagai pentungan tidak kena −25 dan bernilai 250 | Diputuskan |
| 13 | Arah setelah deck habis | Tetap | Diputuskan |
| 14 | Kapan batas skor dicek | Akhir putaran | Diputuskan |
| 15 | Nilai pentungan joker | Selalu 250, apa pun angkanya | Diputuskan |
| 16 | Pentungan dari joker yang sudah pernah dibuang (hasil mungut) | Sudah jadi kartu biasa: nilai kartu aslinya (angka 50, Londo 100, As 150) | Diputuskan |
| 17 | "Akhiri permainan" di tengah putaran | Hanya bisa di antara putaran | Diputuskan |
| 18 | Dua kembar 3 As (2 deck) diturunkan bersamaan tanpa kartu jadi lain | Ditolak: keduanya sama-sama butuh kartu jadi lain | Diputuskan |
| 19 | Setelah deck habis, masih boleh menyusun kartu jadi? | Ya, tanpa mulung (fase susun akhir) | Diputuskan pemilik aturan |
| 24 | Setelah ada yang mentung, masih boleh menyusun? | Ya, semua pemain (yang mentung, kepentung, maupun aman) dapat susun akhir yang sama. Kepentung dan arah ditentukan saat mentung | Diputuskan pemilik aturan |
| 20 | Siapa yang ikut fase susun akhir? | Semua pemain, termasuk yang mengambil kartu terakhir | **Perlu konfirmasi** |
| 21 | Di susun akhir, boleh menurunkan sampai tangan habis? | Boleh (tidak ada buang); tidak dihitung mentung | **Perlu konfirmasi** |
| 22 | Urutan susun akhir | Serentak, karena kartu jadi tidak bisa ditempel sehingga urutan tidak berpengaruh | **Perlu konfirmasi** |
| 23 | Batas waktu di susun akhir (online) | Sama dengan batas giliran; lewat batas, bot menurunkan yang bisa dijadikan lalu selesai | **Perlu konfirmasi** |

## Test

Cakupan test:
- **Validasi seri:** semua contoh 7.1, batas 2–10, Londo, As.
- **Kembar As:** 3 vs 4 As, beda bunga, syarat kartu jadi lain (termasuk di aksi yang sama).
- **Joker:** kelima contoh selang-seling, Londo dan As sebagai joker, joker sebagai kartu asli, joker mati.
- **Larangan:** membuang As, menempel ke kartu jadi.
- **Mulung:** semua contoh Bagian 5.
- **Mentung:** kepentung satu dan dua pemain, kartu sendiri, kepentung sekali, Contoh A & B, arah mundur, pentungan joker 250.
- **Skor:** semua contoh 8.3.
- **Susun akhir:** contoh bug 2-3 Kriting + 4 Waru (joker 4) → +15, tangan boleh habis, tidak ada mulung/ambil/buang, tidak bisa menurunkan setelah Selesai, syarat 3 As, kartu lawan tetap tersembunyi, bot.
- **Lain-lain:** pembagian untuk tiap jumlah pemain, pengocok, deck habis, setiap syarat akhir permainan, view pemain.
- **Simulasi:** 6 konfigurasi × 60 permainan × 6 putaran = 2.160 putaran bot-vs-bot dengan seed. Setiap aksi dicek invariannya: jumlah kartu konsisten, tidak ada kartu ganda, kartu jadi sah, skor sesuai rumus, dan tidak ada aksi bot yang ditolak.
- **Fuzz:** aksi acak yang sering ilegal. Aksi yang ditolak harus tidak mengubah state, aksi yang diterima harus menghasilkan state legal.
- **Meja:** lobi, host, atur kursi, mulai, kartu rahasia per pemain, permainan penuh 1 manusia + 3 bot, timer giliran diambil alih bot, putus/sambung ulang, jeda saat semua pergi, voting akhiri, simpan/lanjut.
- **Server:** integrasi WebSocket nyata (buat/gabung pakai kode, kartu rahasia, sambung ulang dengan token, daftar meja publik, pesan rusak).

## Catatan & rencana berikutnya

- **Bot normal masih cukup pasif.** Di 6 pemain, mayoritas putaran berakhir karena deck habis. Perlu diperkuat (lebih berani mulung, menahan kartu untuk mentung).
- **Service worker belum dicek di HP sungguhan.** Browser bawaan aplikasi pengembangan tidak mengizinkan pendaftarannya. Konfigurasinya standar `vite-plugin-pwa` (generateSW, 16 file di-precache), tapi instalasi dan mode offline perlu dicek di Chrome atau HP sungguhan lewat HTTPS.
- **Belum ada animasi kartu.** Meja digambar ulang setiap ada perubahan.
- **Image Docker belum di-build di mesin ini** karena Docker Desktop sedang tidak jalan. Tahap runtime-nya sudah disimulasikan di folder terpisah (hanya `main.js` + `public` + `ws`/`sirv`) dan jalan normal.
