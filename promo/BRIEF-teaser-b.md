# Brief produksi: Teaser Reels B "Info room?"

Brief ini final dan sudah disetujui pemilik proyek lewat beberapa ronde diskusi dan uji persona. **Jangan mendesain ulang cerita, teks, atau urutan adegan.** Tugasmu mengeksekusi: rekam, susun, render, periksa, kirim. Kalau ada hal teknis yang buntu, pilih jalan paling sederhana yang tetap memenuhi brief, catat di laporan akhir, lalu lanjut. Jangan berhenti untuk bertanya kecuali benar-benar terblokir.

---

## 1. Ringkas

| | |
|---|---|
| Format | Instagram Reels, 1080 × 1920, 30 fps, **±44 detik (1320 frame)**, MP4 H.264 + AAC |
| Akun | IG Kedai Madya (@kedaimadya), kedai kopi kecil di Jl. Raya Tegalgondo, Junrejo, Kota Batu |
| Penonton | Follower kedai (lingkaran pertemanan pemilik dan pelanggan), dengan harapan direpost orang luar |
| Tujuan | Penonton mencoba game, ketagihan, DM untuk gabung grup, penasaran main di kedai |
| Nada | Kocak dan hangat. Akrab lewat ledekan, tanpa kata-kata afirmasi atau klise promosi |
| Suara | **Tanpa voice over.** Cerita dibawa chat grup, rekaman layar game asli, teks pendek, musik, dan bunyi game |
| Bahasa | Chat: campur **Jawa Malangan/Arekan** (ae, gak, seng, sesuk, nang, -no, rek, Sam). Teks di luar chat: Indonesia santai |
| Hasil | `promo/out/teaser-b.mp4` + laporan QA singkat |

**Game-nya:** "Remi Kampung Madya", game remi web/PWA (https://remi-madya.likrea.biz.id) buatan seorang pelanggan tetap kedai. Aturannya aturan tongkrongan Kedai Madya. Lawan komputer di aplikasi disebut "warga kedai", tapi di chat grup cukup disebut "bot". Punggung kartunya bergambar maskot cangkir kedai. **Gratis, tanpa login (cukup isi nama), tanpa uang, tanpa top up.**

**Inti cerita (game of the scene):** "Kamu" terus sesumbar, lalu kalah. Rule of three:
1. dipentung teman,
2. dipentung bot (lebih sombong, lebih malu),
3. di Madya akhirnya **menang**, tapi yang dia pentung ternyata bot: "Mentung bot iku gak mbanggakno."

Penutupnya ajakan, lalu stempel kejutan **BUKAN JUDI ONLINE**, lalu loop ke "Info room?".

---

## 2. Larangan (wajib)

- **Tidak ada orang asli**: wajah, tubuh, tangan nyata, nama asli anggota grup, nomor HP, foto profil. Anggota chat adalah tokoh karangan: **Kamu, Dimas, Ayu, Rendi.**
- **Tidak ada branding WhatsApp**: tanpa logo, tanpa hijau khas WA, tanpa centang biru persis WA. Tampilan chat dibuat generik (lihat §6.1). Nama grup **"Remi Kampung Madya"** boleh, karena memang nama grup aslinya.
- **Tidak ada isyarat judi**: koin, chip, uang, angka taruhan, slot, efek kasino, "jackpot", "menang besar". Tidak ada skor besar yang melompat-lompat.
- **Jangan menjelaskan aturan remi.** Satu-satunya kalimat sebab-akibat yang boleh hanya yang ada di storyboard ("Kartu buanganku… dipakai dia buat nutup.").
- **Jangan menampilkan angka joker** atau label yang menyebut kartu joker di luar yang otomatis tampil di rekaman game.
- **Tanpa umpatan**, candaan politik, "umroh", hadiah, dan istilah "ceki".
- Kedai: hanya fakta yang ada di `apps/client/src/konten/kedai.ts`. **Jangan menulis jam buka, menu, harga, atau rating.**
- Antislop: tidak ada "bukan sekadar", "lebih dari sekadar", "Kami X, bukan Y", atau klise iklan.
- **Jangan mengubah kode aplikasi** (`apps/*`, `packages/*`). Semua kerjamu di `promo/`.

---

## 3. Storyboard final (frame = detik × 30)

Lapisan tetap:
- **Logo Kedai Madya kecil di pojok kiri atas sejak frame 0.** Gunakan `aset/logo-lengkap.svg`, lebar ±170 px, kuning `#f1a615`, opacity 0,9, di x 56, y 70.
- **Pil di atas tengah sejak detik 2 sampai detik 37:** "gratis · tanpa login · tanpa top up". Baloo 2 600, 34 px, teks krem di latar arang 75% bergaris emas tipis, y ±150. **Jangan tulis "judi" di pil ini.**

### Pembuka (0,0–2,0 dtk)
- Frame 0 sudah di tengah aksi: rekaman game, layar "Kamu" saat kepentung (ronde 1). Langsung retak, kilat merah, KEPENTUNG!. Gunakan klip yang sama dengan klimaks ronde 1, diambil sebagai *cold open*.
- **Tanpa chat dan tanpa teks** (keputusan: jangan bocorkan "maneh").
- Bunyi: hantaman + jotos dari rekaman game, atau `bunyi-jotos.wav`.
- Transisi ke 2,0: whip/rewind cepat 8 frame (blur gerak + garis pindai) ke layar chat.

### Ronde 1: dipentung teman (2–16 dtk)
| Waktu | Gambar | Chat / teks |
|---|---|---|
| 2,0–5,0 | Layar chat grup "Remi Kampung Madya", status bar **23.41**, baterai 61%. Bubble masuk beruntun dengan bunyi pop. Kamera mendorong pelan | **Kamu:** Info room? · **Dimas:** Gabung meja Remi Kampung Madya, kode `KW4PC` *(pakai kode meja yang benar-benar terekam)* · **Ayu:** Gass · **Rendi:** Melu |
| 5,0–7,0 | Kode "terbang" dari bubble (object-follow), memecah ke **empat HP** yang menyala bergantian ±0,45 dtk masing-masing: jok motor (lampu jalan oranye, helm), kamar (lampu meja kuning), macet (bokeh lampu rem merah), teras rumah (lampu bohlam, sandal). Tanpa orang | — |
| 7,0–9,0 | Rekaman game: lobi terisi 4 nama (Dimas, Ayu, Rendi, Kamu) | **Kamu:** Aman, aku seng menang. |
| 9,0–12,0 | Rekaman meja: kartu "Kamu" yang akan dipungut disorot (cincin cahaya kuning), dibuang, lalu kamera mengikutinya diambil Ayu. **Panah kuning** dari buangan ke panel Ayu | **Kamu:** Buang iki ae. |
| 12,0–16,0 | Layar meredup kebiruan (vinyet berat), kartu terakhir Ayu **bergetar** (supaya tegangnya terasa tanpa suara). Hening 0,4 dtk, lalu dibuka: retak, KEPENTUNG! (dari rekaman). Teks caption muncul 0,3 dtk sesudah retak | Caption: **Kartu buanganku… dipakai dia buat nutup.** · lalu chat **Rendi:** Noob |

### Ronde 2: dipentung bot (16–26 dtk), dinaikkan dan dipercepat
| Waktu | Gambar | Chat / teks |
|---|---|---|
| 16,0–18,0 | Chat, status bar **00.47**, baterai **23%** | **Kamu:** Mau iku pemanasan. · **Dimas:** Kurang siji |
| 18,0–20,0 | Rekaman lobi: kursi kosong diisi bot (warga kedai, label nama warga kedai terlihat) | **Kamu:** Isi bot ae. Bot iku gampang. |
| 20,0–23,0 | Rekaman meja, **pola kamera sama persis dengan 9–16 tapi dua kali lebih cepat**. Kartu terakhir milik bot | — |
| 23,0–26,0 | Retak lebih besar, guncangan lebih kuat, KEPENTUNG! | **Dimas:** Dipentung bot. · **Ayu:** Isin. · **Rendi:** Belajar maneh. |

### Ronde 3: di Madya (26–37 dtk), pola dibelokkan
| Waktu | Gambar | Chat / teks |
|---|---|---|
| 26,0–29,0 | Chat, status bar **02.04**, baterai **5%** (ikon merah). "Kamu sedang mengetik…" berkedip ±1 dtk | **Kamu:** Online gak diitung. Sesuk nang Madya. · **Dimas:** Gass. |
| 29,0–32,0 | **Meja Kedai Madya malam hari** (§6.3): kayu hangat di bawah lampu gantung kuning, empat HP di meja, dua gelas kopi berasap, kartu berpunggung cangkir, **papan QR berdiri**. Kamera turun pelan dari lampu ke meja. Pindah adegan lewat flash putih 4 frame | — |
| 32,0–35,0 | Push-in ke HP "Kamu": rekaman game, **Kamu yang mentung**, layar lawan yang retak (perspektif Kamu: sorakan mentung). Kilat emas | **Kamu:** MENANG!! |
| 35,0–37,0 | Kamera bergeser ke HP lawan di meja, nama di layar menunjukkan dia **bot** (label warga kedai). Hening 0,3 dtk, lalu chat | **Dimas:** Mentung bot iku gak mbanggakno, Sam. · **Ayu:** Tetep noob. |

### Penutup (37–44 dtk)
| Waktu | Gambar | Teks |
|---|---|---|
| 37,0–40,0 | Tetap di meja kedai, pull-out (golden, lebih terang). Logo Kedai Madya besar muncul di atas. Papan QR terlihat jelas | Besar: **Coba gratis. Link di bio.** · kecil di bawahnya: **Main dari mana ae. Mau melu grup? DM @kedaimadya** |
| 40,0–42,0 | **KEJUTAN:** cap stempel merah miring −8° menghantam tengah layar (skala 1,7 → 1,0 dalam 5 frame, guncangan meluruh 7 frame, sedikit debu tinta) | **BUKAN JUDI ONLINE** |
| 42,0–44,0 | Kembali sekilas ke layar chat gelap, satu notifikasi masuk. Potong 0,2 dtk sesudah bubble muncul, supaya loop ke frame 0 terasa mulus | **Kamu:** Info room? |

---

## 4. Rekaman game asli (bahan utama)

Semua visual game **harus** rekaman aplikasi asli, bukan tiruan. Ada tiga permainan yang direkam, masing-masing satu putaran dengan hasil tertentu:

| Klip | Kursi | Hasil yang dibutuhkan (putaran 1) |
|---|---|---|
| R1 | 0 Dimas (host), 1 Ayu, 2 Rendi, 3 Kamu (semua manusia) | **Ayu mentung, Kamu kepentung** (karena kartu buangan Kamu dipungut) |
| R2 | 0 Dimas, 1 Ayu, 2 Kamu, 3 **bot** (warga kedai level normal) | **bot mentung, Kamu kepentung** |
| R3 | 0 Dimas, 1 Ayu, 2 Kamu, 3 **bot** | **Kamu mentung, bot kepentung** |

Semuanya 1 deck, 4 pemain, `detikGiliran: 0`, `batasPutaran: 1`, `duaDeckUntukEmpat: false`, mode kaldu mati.

### 4.1 Perkakas yang sudah ada (`promo/scripts/rekam/`)
- `meja-rekam.ts`: menyalakan server game asli (`apps/server/src/server.ts`, `jalankanServer`) dengan `crypto.randomBytes(4)` diganti seed tetap (env `SEED_REKAM`), jadi urutan kartu bisa diulang. Tanpa database, jadi tidak ada riwayat yang tercatat.
- `otomatis.ts`: `aksiOtomatis(view)` memilih aksi dengan `pilihAksiBot(view, 'normal', new Rng(20261106))`. Pilihannya hanya bergantung pada view.
- `cari-seed.ts`: memainkan 4 kursi lewat WebSocket sampai putaran pertama cocok (`[dari] [sampai] [pementung] [korban]`). **Baru mendukung 4 kursi manusia (R1). Perluas untuk R2/R3** (host mengirim `{t:'aturKursi', kursi:3, jenis:'bot', level:'normal'}` sebelum `mulai`, dan klien kursi bot tidak dibuat).

### 4.2 Wajib diperbaiki sebelum mencari seed
- **`Math.random` juga harus deterministik** di proses server rekam. Server memakai `namaLawanAcak()` (Math.random) untuk nama warga kedai, dan **gaya main warga kedai mengikuti namanya** (`packages/meja/src/gayaWarga.ts`), jadi nama acak membuat langkah bot berbeda. Ganti `Math.random` dengan PRNG ber-seed (mulberry32, seed dari `SEED_REKAM`) di `meja-rekam.ts`, sebelum server diimpor. Jeda bot memakai acak juga, tapi tidak mengubah langkah.
- Pakai `jedaBotMs` kecil saat mencari seed (misalnya 5). Saat merekam, pakai tempo yang enak ditonton (lihat §4.4).
- Urutan bergabung dan `mulai` dengan `pengocok: 0` harus sama persis antara pencarian dan perekaman.
- Ambil kode meja dari pesan `masuk`. Kode memakai `randomBytes(5)` dan **tidak** ikut di-seed, jadi kode di chat ronde 1 harus diisi kode yang benar-benar terekam (simpan ke JSON hasil rekaman).

Kriteria pemilihan seed (urutkan, ambil yang terbaik):
1. Cocok dengan tabel di atas.
2. Putarannya pendek (≤ 24 aksi), supaya rekaman tidak bertele-tele.
3. **Kepentung hanya korban yang dimaksud** (lebih bersih ceritanya).
4. Bonus kalau pentungannya joker (efek retak versi besar).

Cari di rentang seed lebar (misalnya 1–2000); tiap permainan hanya butuh beberapa ratus milidetik.

### 4.3 Merekam di browser (4 HP tiruan)
- Jalankan server rekam di port **2567**, lalu Vite dev client (`npm run dev:client`, port 5173, `/ws` diteruskan ke 2567). Mode dev menyediakan `window.__remiApp` (instance `Aplikasi`, field privat bisa diakses di runtime: `koneksi`, `view`, `info`) dan modul bisa diimpor lewat `import('/src/...')`.
- Playwright (`require('playwright')` atau `playwright-core` dari akar repo). Chromium ada di `/opt/pw-browsers/chromium`; jangan menjalankan `playwright install`.
- Empat konteks browser terpisah (localStorage terpisah), viewport HP **390 × 844**, `deviceScaleFactor: 3`, `isMobile: true`, `hasTouch: true`.
- Sebelum memuat halaman, isi localStorage: `remi.nama` = nama kursi, dan `remi.namaDiganti` supaya nama tidak minta diganti (lihat `apps/client/src/namaPemain.ts` dan `penyimpanan.ts` untuk format persisnya). Lewati kartu "Warga baru, ya?" dan tawaran latihan seperti yang dilakukan `apps/client/e2e/smoke.mjs` (pakai selektor dari sana). Preferensi (`remi.preferensi`): kecepatan animasi normal, efek lengkap, musik mati, suara mati.
- Host (Dimas) membuat meja lewat UI beranda (atau langsung mengirim `{t:'buat',...}` lewat `__remiApp.koneksi` kalau UI terlalu lama). Pemain lain masuk lewat `http://localhost:5173/?meja=KODE`.
- **Pemain otomatis di tiap halaman:** suntik skrip yang tiap ±250 ms membaca `__remiApp.view`. Kalau `aksiOtomatis(view)` (impor dari modul engine di halaman, logikanya sama dengan `otomatis.ts`) memberi aksi, kirim `{t:'aksi', aksi, id}` lewat `__remiApp.koneksi.kirim`. Tunggu **±1,4 dtk** sesudah view berubah sebelum bertindak, supaya animasi selesai dan rekaman enak ditonton. Klik OK popup joker (`#modal [data-ok]`) begitu muncul.
- **Yang direkam hanya halaman "Kamu"**, plus halaman lobi dan halaman bot. Untuk R3, juga satu jepretan layar halaman Ayu atau Dimas yang memperlihatkan panel bot yang kena retak.
- **Cara merekam:** CDP `Page.startScreencast` (format jpeg, kualitas 92, `everyNthFrame: 1`). Simpan tiap frame beserta `metadata.timestamp`, lalu susun jadi video 30 fps dengan ffmpeg (concat demuxer, durasi per frame dari selisih timestamp). Kalau screencast terlalu patah (< 20 fps), pakai `recordVideo` Playwright di ukuran 1170 × 2532. Simpan juga **jepretan PNG resolusi penuh** di momen kunci (lobi penuh, kartu dibuang, pentungan tertutup, retak, layar hasil) sebagai cadangan still dengan gerak kamera Remotion.
- Bandingkan hasil putaran di browser dengan hasil pencarian seed (pementung, kepentung). Kalau beda, pastikan urutan bergabung, `pengocok`, `Math.random`, dan Rng sama, lalu ulangi.
- Simpan hasil ke `promo/public/rekam/` (diabaikan git; tambahkan ke `promo/.gitignore`): `r1-kamu.mp4`, `r1-lobi.png`, dst., plus `rekam.json` (kode meja, seed, waktu-waktu penting dalam detik: buang, pungut, pentungan dibuka).

### 4.4 Tempo rekaman
- Jeda bot server ±1,5 dtk (`jedaBotMs` sekitar 1500), dan jeda pemain otomatis ±1,4 dtk.
- Di video, potong bebas: yang tampil hanya momen di storyboard. Gerakan lambat di antaranya boleh dipercepat 1,5–2× (Remotion `<OffthreadVideo playbackRate>`) kecuali momen kunci.

---

## 5. Sinematografi (dari playbook skill story-shorts, teknik saja)

- **Kamera tidak pernah diam.** Selalu ada push-in pelan 0,15–0,35% per frame. Di kata atau momen punch, 0,6% per frame.
- **Pindah komposisi dengan glide** ease in/out (smootherstep) selama 18–40 frame. Hard cut hanya di cold open, flash putih, dan stempel.
- **Burst cepat:** kecepatan puncak di frame pertama, meluruh dalam 8–10 frame. **Impact shake:** arah bolak-balik tiap frame, meluruh dalam 7 frame. Dutch roll 4–5° di momen tegang.
- **Ritme:** sekitar 1 perubahan visual per detik, 2 per detik di 3 detik pertama. Tidak ada hold diam lebih dari 4 detik.
- **Object-follow:** kode meja terbang dari chat ke HP, dan kamera mengikuti kartu yang dibuang.
- **Cahaya:** split tone (highlight hangat, bayangan dingin). Bagian tegang (12–16, 20–23) **low-key kebiruan dengan vinyet berat.** Ronde 3 di kedai hangat (lampu kuning). Penutup paling terang dan keemasan. Arc: Q1 normal, Q2 makin gelap, Q3 (ronde 2) paling gelap dan dingin, Q4 hangat.
- **Glow** pada benda kunci: kartu yang dibuang, kartu terakhir lawan, papan QR.
- **Flash putih** 3–4 frame untuk pindah dunia (chat → kedai).
- **Rekaman game di dalam bingkai HP** (§6.2) saat adegan menyebut HP. Untuk gameplay layar penuh, crop rekaman 9:16 langsung ke frame (aplikasinya memang layar penuh 9:16) dengan zoom dan geser kamera virtual. Jangan biarkan teks UI game terpotong di momen penting.
- **Grain** halus 2–3% dan vinyet halus selalu ada.

### Penempatan teks (zona aman Reels)
- Area aman: x 70–940, y 250–1500. Kanan 140 px dan bawah 420 px tertutup UI Instagram.
- Chat bubble di separuh atas (y 260–1000) saat adegan chat.
- **Caption** (teks di luar chat): Baloo 2 800, 62–72 px, putih, garis hitam 6 px (`paint-order: stroke`), rata tengah, y ±1250–1350. Teks bertahan sampai teks berikutnya.
- **Setiap bubble atau teks bertahan minimal 1,2 dtk** dan kecepatan bacanya ≤ 15 karakter/detik. Kalau tidak muat, perlambat adegan, jangan potong teks.

---

## 6. Elemen visual yang dibuat di Remotion

### 6.1 Layar chat (generik, bukan WA)
- Latar arang gelap `#14120f` dengan motif kawung samar (opacity 4%, boleh dari pola punggung kartu).
- Header: avatar bundar berisi maskot cangkir kuning, judul **Remi Kampung Madya**, subjudul "Dimas, Ayu, Rendi, Kamu".
- Status bar atas: jam (23.41 / 00.47 / 02.04), sinyal, ikon baterai dengan persen (61 / 23 / 5, merah saat 5).
- Bubble orang lain: kiri, latar `#2a2620`, nama pengirim berwarna (Dimas toska `#1f8a9e`, Ayu kuning `#f1a615`, Rendi zaitun `#6b865e`), teks krem `#fbf6ea`. Bubble Kamu: kanan, latar kuning tua `#c99a2e`, teks tinta `#111`. Sudut 22 px, jam kecil di pojok bubble, **tanpa centang biru.**
- Bubble kode meja: kartu pratinjau tautan bergaya game (punggung kartu kecil + "Gabung meja Remi Kampung Madya, kode XXXXX").
- Masuk bubble: geser naik 24 px + skala 0,92 → 1 (pegas, 8 frame), bunyi pop.
- Indikator "Kamu sedang mengetik…" dengan tiga titik berdenyut.
- Font chat: system sans (Roboto/Noto Sans), 40–44 px.

### 6.2 HP (bingkai)
- Persegi bulat hitam (radius 70 px), bezel 14 px, sedikit kilau di tepi, bayangan lembut. Layar menampilkan rekaman/still game atau chat. Rasio layar 390:844.
- Empat lokasi (5–7 dtk): tiap lokasi satu warna cahaya dominan + satu siluet benda di latar (helm dan lampu jalan, lampu meja dan bantal, bokeh lampu rem, bohlam teras dan sandal), buram (DOF). Semuanya dibuat dari bentuk CSS/SVG, gradien, dan bokeh. Tanpa orang.

### 6.3 Meja Kedai Madya (stilasi, tanpa footage)
- Bidang meja kayu hangat dalam perspektif (CSS 3D `rotateX` ±55°, atau gradien kayu + garis serat SVG). Kolam cahaya kuning dari lampu gantung (radial gradient), latar gelap dengan bokeh lampu kuning.
- Empat HP tergeletak menghadap atas (bingkai §6.2 dalam perspektif). HP Kamu menampilkan rekaman R3.
- Dua gelas kopi (SVG: gelas bening, kopi gelap, uap dari partikel atau sinusoida yang di-blur).
- Beberapa kartu berpunggung cangkir (`aset/kartu-punggung.png`) berserakan, plus satu kartu muka.
- **Papan QR berdiri** (tenda segitiga kecil, kertas krem): QR menuju `https://remi-madya.likrea.biz.id` (buat SVG dengan paket `qrcode`, koreksi galat M, modul hitam di atas krem, zona tenang 4 modul), di atasnya tulisan kecil "Remi Kampung Madya" dan logo maskot. QR harus bisa dipindai dari video di layar lain: lebar tampil ≥ 300 px di frame 37–40, tajam, tanpa blur. **Uji pindai dengan `zbarimg` atau `jsQR` dari still frame.**
- Logo besar di penutup: `aset/logo-lengkap.svg`, kuning, lebar ±620 px.

### 6.4 Efek
- Retak layar: utamakan efek asli di rekaman game. Untuk penguatan, `aset/retak.png` (dari `efek/retak.ts`) boleh ditumpuk dengan kilat merah. Ronde 2: retak lebih besar + shake lebih kuat.
- Panah kuning (R1 9–12): garis lengkung SVG yang "tergambar" (stroke-dashoffset), ujung panah, sedikit glow.
- Stempel **BUKAN JUDI ONLINE**: huruf kapital tebal (Baloo 2 800 atau slab bold), merah `#d62f2f`, bingkai ganda persegi bulat, tekstur tinta kasar (mask noise), rotasi −8°, sedikit transparan (multiply). Bunyi "DOK" (`dentum` atau `jotos` yang diturunkan nadanya) + getar layar.

---

## 7. Aset dan audio

- Ambil aset dari kode game dengan `npm run aset` di `promo/` (`scripts/ambil-aset.mjs`): kartu, punggung, logo SVG, `retak.png`, font Baloo 2, musik, dan bunyi. Tambahkan ke daftar `BUNYI` di skrip itu bila perlu: `notifikasi`, `pop`, `tegang`, `mentung`, `jotosLain`, `menang`, `dentum` (cek nama yang tersedia di `JenisBunyi`, `apps/client/src/efek/suara.ts`; `dentum` adalah fungsi sintesis, jadi kalau tidak ada sebagai jenis bunyi, pakai `jotos` yang di-pitch turun). Musik: `rekamMusik('beranda', 48)`; untuk ronde tegang boleh `rekamMusik('meja', …)`.
- **Mix:**
  - Musik jalan dari frame 0 sampai akhir, sekitar 10 dB di bawah SFX puncak, dan diredam ke 15% selama 12–16, 20–26, dan 32–37.
  - **Hening 0,4 dtk** tepat sebelum pentungan dibuka (R1, R2) dan sebelum chat "Mentung bot…".
  - SFX on-beat: pop di tiap bubble, whoosh di tiap whip/kode terbang, bunyi game di aksi kartu, jotos dan krak di retak, menang/sorak di 32–35, DOK di stempel, notifikasi di 42.
  - Master **−14 LUFS, true peak ≤ −1,5 dBTP** (render dulu, lalu `remotion ffmpeg … -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v copy`, seperti skrip `render` yang sudah ada).
  - Video berhenti **0,2 dtk sesudah** bubble terakhir muncul. Tanpa fade panjang.

---

## 8. Struktur kode

- Proyek Remotion yang ada: `promo/` (Remotion 4.0.535, React 18.3.1). **Bukan workspace monorepo**, jadi `npm install` di `promo/` sendiri. Komposisi lama `Teaser` biarkan saja; buat komposisi baru **`TeaserB`** (1080 × 1920, 30 fps, 1320 frame) di `promo/src/b/`, dengan satu file per bagian: `Chat.tsx`, `Hp.tsx`, `Lokasi.tsx`, `MejaKedai.tsx`, `Stempel.tsx`, `TeaserB.tsx`, dan `waktu.ts` untuk semua konstanta frame. Daftarkan di `src/Root.tsx`.
- Rekaman masuk lewat `<OffthreadVideo src={staticFile('rekam/...')}>`. Still pakai `<Img>`.
- Tambahkan skrip `render:b` di `promo/package.json` (render + loudnorm ke `out/teaser-b.mp4`).
- Chrome untuk Remotion: `CHROME_PATH=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` (sudah dibaca `remotion.config.ts`).
- Perbarui `promo/README.md` (cara merekam dan me-render TeaserB).
- `promo/public/rekam/` dan `promo/out/` diabaikan git. **Jangan commit video atau rekaman.**

---

## 9. Urutan kerja (langsung jalankan)

1. `npm install` di akar repo, lalu di `promo/`. `npm run aset` (tambah bunyi yang dibutuhkan).
2. Perbaiki determinisme `meja-rekam.ts` (§4.2), perluas `cari-seed.ts` untuk kursi bot, lalu cari seed R1, R2, dan R3.
3. Tulis perekam browser (`promo/scripts/rekam/rekam-browser.mjs`). Rekam R1, R2, dan R3, dan verifikasi hasilnya sama dengan pencarian seed.
4. Bangun komposisi `TeaserB` sesuai §3 dan §5–§7.
5. Render 4 still (frame 0, 450, 1000, 1230) di skala 0,5. Cek terhadap QA di bawah, perbaiki, lalu render penuh dengan `npm run render:b`.
6. QA (§10). Perbaiki yang gagal, lalu render ulang.
7. Commit (pesan bahasa Inggris, tanpa video atau rekaman) dan push ke branch sesi ini.
8. Kirim `promo/out/teaser-b.mp4` ke pengguna (SendUserFile), plus laporan singkat: seed yang dipakai, durasi, LUFS, hasil uji pindai QR, dan penyimpangan dari brief beserta alasannya.

---

## 10. QA sebelum dikirim

- [ ] Durasi 43,5–44,5 dtk, 1080 × 1920, 30 fps, H.264 yuv420p, AAC 48 kHz.
- [ ] −14 LUFS ±1, true peak ≤ −1,5 dBTP (`ffmpeg -af ebur128`).
- [ ] Frame 0 sudah aksi (retak). Tidak ada hold diam lebih dari 4 dtk (bandingkan selisih frame).
- [ ] Ketiga putaran di rekaman cocok dengan cerita: R1 Ayu → Kamu, R2 bot → Kamu, R3 Kamu → bot.
- [ ] Semua teks di §3 muncul **persis** seperti ditulis (ejaan Jawa Malangan apa adanya), terbaca minimal 1,2 dtk, di dalam zona aman.
- [ ] Tidak ada branding WA, orang asli, koin/uang, angka joker yang disorot, atau kata "judi" selain di stempel.
- [ ] QR terbaca dari still frame 37–40 dan menuju `https://remi-madya.likrea.biz.id`.
- [ ] Stempel BUKAN JUDI ONLINE muncul di 40–42 dengan hantaman dan bunyi.
- [ ] Akhir video loop ke awal tanpa jeda canggung.
- [ ] Contact sheet 12 frame (setiap ±3,7 dtk) diperiksa: palet tiap mood benar (Q3 paling gelap, penutup paling terang), teks tidak terpotong, dan rekaman game tajam.
