# Brief produksi: Teaser Reels A "Aman, aku seng menang" (2D)

Brief ini final. **Jangan mendesain ulang cerita, teks, peran, atau urutan adegan.** Eksekusi saja: rekam game, bangun tokoh 2D, susun, render, periksa, kirim. Kalau ada hal teknis yang buntu, pilih jalan paling sederhana yang tetap memenuhi brief, catat di laporan akhir, lalu lanjut.

Banyak bagian teknis sama dengan teaser B, jadi baca juga **`promo/BRIEF-teaser-b.md`**. Bagian yang dirujuk di bawah (§2 larangan, §4 rekaman, §5 sinematografi, §7 audio, §8 kode) berlaku juga di sini, kecuali yang disebut lain.

---

## 1. Ringkas

| | |
|---|---|
| Format | Instagram Reels, 1080 × 1920, 30 fps, **±40 detik (1200 frame)**, MP4 H.264 + AAC, −14 LUFS |
| Akun / tujuan | Sama dengan B: IG @kedaimadya. Penonton coba main, ketagihan, DM untuk gabung grup, penasaran main di kedai |
| Medium | **Animasi 2D** tokoh di meja Kedai Madya, dengan **layar HP berisi rekaman game asli** |
| Suara | **Tanpa voice over.** Dialog pendek dalam balon kata (teks, bukan suara), musik, dan bunyi game |
| Bahasa | Balon kata Jawa Malangan, caption Indonesia santai, persis seperti di §4 |
| Hasil | `promo/out/teaser-a.mp4` + laporan QA singkat |

**Inti cerita:** Bang IT sesumbar, membuang kartu dengan gaya, lalu kartunya dipakai Cak Owner untuk mentung. Bang IT kepentung, terpental dari kursi, dan diledek Mas Sampul. "Siji maneh," lalu kalah lagi dan lagi (rule of three), sampai gelas kopinya ikut retak. Penutup: ajakan, stempel **BUKAN JUDI ONLINE**, dan Bang IT melirik kamera.

---

## 2. Larangan tambahan (selain §2 brief B)

- **Ketiga tokoh adalah nama warga kedai di game.** Di aplikasi tiap warga kedai punya gaya main tersembunyi, dan aturan pemilik (#47) melarang gaya itu ditampilkan ke pemain. Karena itu **jangan menggambarkan cara bermain kartu tokoh mana pun** (menahan kartu, suka seri, nekat, sabar, dll.). Yang boleh hanya sifat di luar meja: sombong, kalem sambil ngopi, tukang ledek. Cak Owner mentung hanya karena momen itu terjadi di rekaman, bukan karena "dia selalu begitu".
- **Tokoh 2D tidak boleh meniru wajah orang asli** (termasuk pemilik kedai dan pembuat game). Desain umum, tanpa karikatur.
- **Gaya visual tidak boleh meniru channel referensi skill story-shorts** (kepala bulat dengan badan batang, wajah 2D di dunia 3D). Pakai gaya di §3.
- **Maskot cangkir** (logo Kedai Madya) hanya muncul sebagai **avatar bot di layar HP** (adegan 9). Tidak dijadikan tokoh berbadan di meja.
- Tidak ada uang, koin, atau taruhan di meja. Yang ada hanya kopi, HP, kartu fisik, dan papan QR.

---

## 3. Tokoh dan gaya visual

**Gaya: flat 2D hangat ala ilustrasi editorial.**
- Bentuk sederhana, garis luar tebal 6–8 px warna tinta `#1d1a16`.
- Isian warna datar dengan satu tingkat bayangan (multiply 18%) dan satu highlight hangat dari lampu kedai.
- Proporsi ±4,5 kepala, wajah dengan mata, alis, dan mulut yang ekspresif. Tanpa hidung realistis, tanpa detail kulit.
- Semua tokoh **duduk di satu meja** dalam sudut 3/4, kamera sedikit di atas meja.

Palet dari `apps/client/src/gaya/token.css`: arang `#1d1a16`, kuning Madya `#f1a615`, krem `#fbf6ea`, toska `#1f8a9e`, zaitun `#6b865e`, laken `#15542f`, kulit dua nada (`#c98e64` / `#a8714d` dan `#e0b48e` / `#c3926d`).

| Tokoh | Peran | Siluet dan ciri | Warna utama |
|---|---|---|---|
| **Bang IT** | Si Sombong (tokoh utama) | Tinggi, bahu lebar, rambut jabrik ke atas, hoodie dengan tudung turun, alis tebal yang gampang naik, duduk melebar sambil bersandar | hoodie toska, celana arang |
| **Cak Owner** | Si Kalem (yang mentung) | Sedang, rambut pendek rapi, kumis tipis, celemek arang dengan saku, selalu memegang cangkir kopi, mata setengah tertutup (santai) | kaus krem, celemek arang, cangkir kuning |
| **Mas Sampul** | Si Penggembira (tukang ledek) | Pendek dan bulat, rambut keriting mengembang, kemeja flanel, tawa lebar, tangan suka menggebrak meja | flanel zaitun-krem |

**Rig SVG per tokoh** (komponen React, satu file per tokoh di `promo/src/a/tokoh/`):
- Bagian terpisah: kepala, rambut, alis kiri dan kanan, mata (kelopak bisa menutup), mulut (bentuk ganti), badan, lengan atas dan bawah kiri dan kanan, tangan (pose memegang HP, menunjuk, menggebrak, memegang cangkir).
- Properti: `ekspresi`, `pose`, `kedip`, `napas`.
- **Ekspresi:** `datar`, `sombong` (alis naik, senyum miring), `kaget` (mata bulat, mulut O), `tertawa` (mata sipit, mulut lebar), `malu` (pipi merah, alis turun), `kesal`, `girang`, `pasrah` (mata setengah, bahu turun).
- **Hidup terus:** napas (badan naik-turun 1,5% tiap ±3 dtk), kedip acak tapi deterministik (dari frame), sedikit goyang kepala. Tidak ada tokoh yang benar-benar diam.
- **Prinsip animasi:** antisipasi sebelum aksi besar, squash and stretch saat terpental atau menggebrak, follow-through pada rambut dan tudung, ease in/out (pegas Remotion), dan **reaksi telat** 6–10 frame untuk lelucon.

**Meja dan latar Kedai Madya:**
- Meja kayu hangat dengan serat sederhana. Di atasnya kartu remi fisik berpunggung cangkir (`aset/kartu-punggung.png` diperkecil), tiga cangkir, tiga HP, dan papan QR berdiri (§6.3 brief B, QR ke `https://remi-madya.likrea.biz.id`, harus bisa dipindai).
- Lampu gantung kuning di atas meja: kolam cahaya hangat, tepi lebih gelap.
- Latar: dinding dengan rak buku samar (bentuk kotak warna-warni yang di-blur) dan bokeh lampu senar. Ini cukup untuk terbaca sebagai kedai, tanpa orang lain.
- Logo Kedai Madya kecil di pojok kiri atas sejak frame 0 (sama dengan B).

---

## 4. Storyboard final

Balon kata: putih, garis tinta 5 px, ekor ke mulut tokoh, Baloo 2 700, 54–60 px. Masuk dengan pop (skala 0,8 → 1, 6 frame). Tahan minimal 1,2 dtk.
Caption (di luar balon): seperti brief B §5, putih bergaris hitam, y ±1300.
Pil atas sejak detik 2 sampai 34: "gratis · tanpa login · tanpa top up".

| # | Waktu | Gambar | Teks |
|---|---|---|---|
| 1 | 0,0–2,0 | **Cold open.** Close-up HP Bang IT: rekaman game, layar retak, KEPENTUNG!. Kamera menarik cepat (burst) ke wajah Bang IT yang **membeku kaget**. Cak Owner dan Mas Sampul di belakang meledak tertawa | — |
| 2 | 2,0–5,0 | Efek rewind (8 frame, garis pindai + blur) ke meja sepi. Bang IT datang dari kanan, menaruh kopi, duduk melebar dan bersandar (`sombong`). Cak Owner sudah duduk menyeruput kopi, Mas Sampul memainkan HP | Caption: **15 menit sebelumnya** · Bang IT: *"Aman, aku seng menang."* |
| 3 | 5,0–9,0 | Mas Sampul mengarahkan HP ke **papan QR** (sisipan layar: QR terpindai → game terbuka tanpa login → ketik nama). Lalu sisipan **lobi game asli** terisi Bang IT, Cak Owner, Mas Sampul | — |
| 4 | 9,0–13,0 | Medium shot Bang IT: mengangkat jari tinggi, mengetuk HP dengan gaya berlebihan (antisipasi → ketuk), lalu **menoleh ke kamera** dengan alis naik. Sisipan layar: kartunya disorot cincin kuning lalu masuk buangan | Bang IT: *"Buang iki ae."* |
| 5 | 13,0–17,0 | Kamera bergeser ke Cak Owner: menyeruput kopi pelan, mata setengah tertutup, jari mengetuk sekali tanpa melihat. Sisipan layar: kartu buangan Bang IT dipungut (panah kuning dari buangan ke Cak Owner). Bang IT di latar masih bergaya, tidak sadar | Caption: **Kartu buanganmu dipakai dia buat nutup…** |
| 6 | 17,0–23,0 | Push-in pelan ke tengah meja, dutch 4°. Ketiganya mencondongkan badan, cahaya meredup kebiruan, vinyet berat. **Hening 0,4 dtk.** Cak Owner meletakkan cangkir… lalu mengetuk sekali | — |
| 7 | 23,0–26,0 | Sisipan layar Bang IT: retak, KEPENTUNG! (rekaman). Cut ke Bang IT **terpental ke belakang bersama kursinya** (antisipasi 3 frame, terpental 6 frame, squash saat mendarat, rambut follow-through), kilat merah, guncangan meluruh 7 frame. Mas Sampul menggebrak meja sambil tertawa, kartu fisik melompat | Sorakan game **KEPENTUNG!** |
| 8 | 26,0–30,0 | Mas Sampul menyodorkan HP ke muka Bang IT (sisipan: ledekan besar dari game). Bang IT perlahan menoleh ke kamera, wajah `datar` (reaksi telat 8 frame) | Mas Sampul: *"Noob."* |
| 9 | 30,0–34,0 | **Montase kilat (rule of three), ±1,2 dtk per potongan:** (a) Bang IT bangkit, `kesal`: *"Siji maneh."* → layar HP: avatar **maskot cangkir** (bot) mentung, retak, Bang IT terlonjak kecil. (b) Kena lagi, Bang IT cuma memejamkan mata. (c) Ketiga kalinya Bang IT `pasrah`, menyeruput kopi… dan **gelas kopinya retak** (`aset/retak.png` dimask ke gelas, bunyi krak kecil) | Bang IT: *"Siji maneh."* |
| 10 | 34,0–38,0 | Tarik mundur keemasan: ketiganya tertawa, termasuk Bang IT. Cak Owner mengangkat cangkir ke arah kamera. Papan QR terlihat jelas (≥ 300 px), logo Kedai Madya muncul di atas | Besar: **Coba gratis. Link di bio.** · kecil: **Mau melu grup? DM @kedaimadya** |
| 11 | 38,0–40,0 | Stempel merah miring −8° menghantam tengah layar dengan bunyi DOK dan guncangan (§6.4 brief B). Bang IT melirik stempel, lalu melirik kamera. Potong 0,2 dtk sesudahnya | Stempel: **BUKAN JUDI ONLINE** |

---

## 5. Rekaman game (pakai perkakas §4 brief B)

| Klip | Kursi (3 pemain, 1 deck) | Hasil putaran 1 |
|---|---|---|
| A1 | 0 Bang IT (host), 1 Cak Owner, 2 Mas Sampul, semua manusia | **Cak Owner mentung, Bang IT kepentung** (kartu buangan Bang IT dipungut) |
| A2 | 0 Bang IT, 1 Mas Sampul, 2 **bot** (warga kedai normal) | **bot mentung, Bang IT kepentung** |

- Pengaturan: `jumlahPemain: 3`, `detikGiliran: 0`, `batasPutaran: 2` (supaya status sesudah putaran 1 adalah `putaranSelesai`, karena **ledekan hanya bisa dikirim di hasil putaran**), mode kaldu mati.
- Ledekan (adegan 8): sesudah putaran A1 selesai, dari halaman Mas Sampul kirim `{t:'ledek', ke: <kursi Bang IT>, isi: <salah satu dari DAFTAR_LEDEKAN di packages/meja/src/protokol.ts>}` lewat `__remiApp.koneksi`, lalu rekam layar Bang IT saat ledekan besar tampil. Atur `jedaLanjutMs` server rekam ke 10000 supaya hasil putaran bertahan.
- **Determinisme wajib:** seed `randomBytes(4)` dan `Math.random` (nama dan gaya bot), sesuai §4.2 brief B.
- **Avatar bot di adegan 9:** rekaman A2 menampilkan nama warga kedai acak dari server. Tempel avatar maskot cangkir (`aset/logo-maskot.svg`, kuning, lingkaran krem) di atas panel nama bot di layar HP. Jangan mengubah teks nama di rekaman.
- Yang direkam: halaman **Bang IT** (A1, A2), halaman **Mas Sampul** (pindai QR dan lobi boleh dibuat dari still), dan still lobi.
- **Pindai QR di adegan 3** cukup dibuat di Remotion: bingkai kamera dengan QR, lalu still beranda game asli (`?meja=KODE`), lalu still isian nama, lalu lobi.
- Kalau sesi teaser B sudah membuat `rekam-browser.mjs` di branch `claude/promo-teaser-b`, boleh disalin. Kalau belum, tulis sendiri sesuai §4.3 brief B.

---

## 6. Sinematografi, audio, kode

- **Sinematografi:** §5 brief B. Kamera virtual tetap bergerak di adegan 2D: push-in pelan, glide antar tokoh, burst di cold open, shake di adegan 7. Kuartal ke-3 (adegan 6–7) paling gelap dan dingin, penutup paling hangat. DOF: latar kedai sedikit buram, tokoh tajam.
- **Audio:** §7 brief B. Tambahan: bunyi kursi terjengkang (sintesis `dentum` dan `ketuk`, atau `jotos` + `letak`), gebrakan meja (`dentum` pendek), seruput kopi (desir pendek), dan krak gelas (`jotosLain`). Musik `rekamMusik('beranda', 44)`, diredam selama adegan 6–7. **Hening 0,4 dtk** sebelum ketukan Cak Owner di adegan 6.
- **Kode:** komposisi baru **`TeaserA`** (1080 × 1920, 30 fps, 1200 frame) di `promo/src/a/` (tokoh, meja, adegan, `waktu.ts`), didaftarkan di `src/Root.tsx`. Skrip `render:a` di `promo/package.json` (render + loudnorm ke `out/teaser-a.mp4`).
  - **Perubahan ke file bersama (`Root.tsx`, `package.json`, `.gitignore`, `README.md`) harus aditif**, karena sesi teaser B mengubah file yang sama di branch lain.
  - Jangan commit video atau rekaman.

---

## 7. Urutan kerja (langsung jalankan)

1. `npm install` di akar repo, lalu di `promo/`. Jalankan `npm run aset` (tambah bunyi yang dibutuhkan).
2. Perbaiki determinisme server rekam, cari seed A1 dan A2, lalu rekam di browser (§5).
3. Bangun rig ketiga tokoh dan meja kedai. Render **satu still "lineup"** (ketiga tokoh di meja, ekspresi `sombong`, `datar`, `tertawa`) dan langsung kirim ke pengguna (SendUserFile) sebagai contoh tampilan tokoh, tanpa menunggu persetujuan.
4. Susun komposisi `TeaserA` sesuai §4.
5. Render still frame 0, 300, 700, 1150 di skala 0,5, jadikan satu contact sheet, kirim ke pengguna sebagai storyboard visual (1–2 kalimat keterangan, tanpa menunggu persetujuan), lalu lanjut render penuh `npm run render:a`.
6. QA (§8). Perbaiki dan render ulang bila perlu.
7. Commit (pesan bahasa Inggris, tanpa video atau rekaman) dan push ke branch sesi ini.
8. Kirim `promo/out/teaser-a.mp4` ke pengguna, plus laporan singkat dalam bahasa Indonesia: seed, durasi, LUFS dan true peak, hasil uji pindai QR, dan penyimpangan dari brief beserta alasannya.

---

## 8. QA

- [ ] 39,5–40,5 dtk, 1080 × 1920, 30 fps, H.264 yuv420p, AAC 48 kHz, −14 LUFS ±1, true peak ≤ −1,5 dBTP.
- [ ] Frame 0 sudah aksi (retak + wajah membeku). Tidak ada tokoh atau kamera yang diam lebih dari 1 dtk.
- [ ] Rekaman cocok dengan cerita: A1 Cak Owner → Bang IT, A2 bot → Bang IT, dan ledekan tampil di layar Bang IT.
- [ ] Semua teks di §4 muncul persis, terbaca minimal 1,2 dtk, di dalam zona aman Reels.
- [ ] Tokoh konsisten di semua adegan (warna, siluet, ukuran relatif), ekspresi sesuai tabel, tidak meniru wajah orang asli, dan tidak memakai gaya channel referensi.
- [ ] Tidak ada gambaran gaya main tokoh, uang, koin, branding WA, atau kata "judi" selain di stempel.
- [ ] QR terbaca (`zbarimg`/`jsQR` dari still frame 34–38) dan menuju `https://remi-madya.likrea.biz.id`.
- [ ] Contact sheet 12 frame diperiksa: Q3 paling gelap, penutup paling hangat, teks tidak terpotong, rekaman game tajam.
