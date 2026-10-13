# Remi Kampung Madya

Game kartu Remi versi digital dengan **aturan yang kami berlakukan saat main di Kedai Madya** (Jl. Raya Tegalgondo, Junrejo, Kota Batu), tempat biasa kami berkumpul. Remi salah satu kegiatan di kedai itu, dan game ini versi online-nya. Aturannya beda dari remi/rummy umum.

- **Online:** buat meja, undang teman pakai kode/link, isi kursi dengan orang, warga kedai (pemain komputer), atau biarkan kosong untuk menunggu orang masuk.
- **Offline bareng warga kedai:** jalan sepenuhnya di HP tanpa internet, tersimpan otomatis.
- **PWA:** bisa dipasang ke layar utama HP, jalan fullscreen.

Istilah: di UI, pemain komputer disebut **warga kedai** (Kipas Dua, Cak Kopag, Si Rak, dan kawan-kawan). Di kode dan dokumen teknis tetap disebut `bot`.

> Status: **versi 0.2.0** (lihat [CHANGELOG.md](CHANGELOG.md)). Aturan main sama dengan 0.1.0; yang berubah tampilan, rasa main, pengaturan, bantuan, dan kesiapan produksi. Hal yang masih menunggu keputusan pemilik dirangkum di [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md).

## Fitur

**Di meja**
- Kartu digambar seperti kartu fisik (indeks pojok besar, J/Q/K berornamen, punggung arang motif kawung kuning dengan medali maskot Kedai Madya), tanpa file gambar sehingga tetap jalan offline.
- Awal tiap putaran kartu dikocok lalu dibagikan tertutup, dan kartu tanganmu dibalik satu per satu.
- Kartu terbang melengkung, mendarat dengan pegas, dan punya bayangan sesuai tingginya. Kartu tangan tersusun seperti kipas tipis.
- Seret kartu ke tumpukan buangan untuk membuang (buangan menyala saat kartu di atasnya); seret di tangan untuk menyusun ulang.
- Panel mentung, sorakan, skor yang melayang di akhir putaran, percikan cahaya untuk pentungan dan pemenang, emote, dan celetukan warga kedai.
- Suara kartu dan musik latar dibuat langsung di browser (Web Audio, tanpa file). Musik bawaannya mati. Getar di HP yang mendukung.

**Pengaturan** (dari beranda dan menu ☰ di meja)
- Suara, musik, dan getar, masing-masing dengan volume terpisah. Getar disembunyikan di perangkat yang tidak mendukung.
- Gerak: ikut setelan sistem, penuh, atau dikurangi. Kecepatan animasi: santai, normal, atau cepat.
- Efek lengkap atau hemat (untuk HP lemah), kartu dua atau empat warna, ukuran teks normal atau besar.
- Tempo warga kedai bisa diganti di tengah permainan (host atau offline). Ada juga "Ulangi tutorial" dan "Kembalikan bawaan".

**Bantuan dan latihan**
- Layar Bantuan: bab-bab aturan Kedai Madya dengan contoh kartu yang ditandai sah/tidak sah, tanya jawab, daftar istilah, dan pencarian.
- Latihan dengan panduan: satu putaran bareng dua warga kedai level mudah, dengan gelembung penjelasan yang muncul sesuai kejadian di meja. Bisa dilewati kapan saja.

**Aksesibilitas**
- Bisa dimainkan penuh dengan keyboard: panah, Spasi/Enter, pintasan huruf (D ambil deck, M mulung, T turunkan, B buang, dan lainnya), angka 1–9 untuk mungut, `?` untuk daftar pintasan.
- Pengumuman untuk pembaca layar (giliran, kartu yang kamu pilih, alasan aksi ditolak, sisa waktu) tanpa membocorkan info rahasia.
- Cincin fokus yang jelas, kurangi gerak, kartu empat warna, teks besar, target sentuh minimal 44 px, dan zoom browser tidak dikunci.

**Offline, PWA, dan online**
- Permainan offline tersimpan otomatis, juga saat aplikasi ditutup atau dipindah ke latar belakang.
- Versi baru ditawarkan lewat toast "Ada versi baru, Bos." dan tidak pernah memuat ulang sendiri di tengah putaran.
- Nomor versi tampil di beranda dan di layar Tentang (beserta catatan perubahan).
- Online: lencana status koneksi, sambung ulang otomatis, konfirmasi sebelum keluar meja (teksnya sama di semua jalur), dan pesan ramah kalau server tidak bisa dihubungi.
- Riwayat dan statistik: permainan online dari server, permainan di HP ini, dan statistik pribadi.

**Kedai Madya**
- Logo Kedai Madya (dipakai dengan izin) di beranda dan Tentang.
- Info kedai cuma di tiga tempat: kartu "Main bareng di Kedai Madya" di beranda, bagian Kedai Madya di Tentang, dan satu baris ajakan + tautan peta di klasemen akhir (kecuali latihan).
- Selama permainan, info kedai tidak pernah muncul sendiri: tidak ada pop-up atau toast, dan meja, susun akhir, popup joker, panel mentung, serta tutorial tidak memuatnya. Pemain bisa melihatnya kapan saja lewat Tentang, termasuk dari menu ☰ saat bermain.
- Isinya hanya fakta yang sudah dicek (`apps/client/src/konten/kedai.ts`): alamat, peta, Instagram, Threads, Rak Buku Kedai Madya. Jam buka, menu, harga, rating, dan telepon sengaja tidak ditulis. Tautan polos tanpa pelacakan.

## Menjalankan

Butuh Node.js LTS (≥ 22; CI memakai 22 dan 24, versi lokal di `.nvmrc`).

```bash
npm install
npm test             # semua test: engine, simulasi, golden, meja, server, client
npm run test:client  # hanya test client (happy-dom), ±4 detik
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

**E2E smoke** (opsional): build client produksi, sajikan dengan `vite preview`, lalu mainkan alur pendek di Chrome sistem untuk HP dan desktop.

```bash
npm run e2e                                   # build + jalankan (hp, desktop)
npm run e2e -- --url=http://localhost:5173    # uji server dev yang sudah jalan
CHROME_PATH="/jalan/ke/chrome" npm run e2e    # kalau Chrome tidak ketemu otomatis
```

Tidak ada browser yang diunduh (memakai `playwright-core` + Chrome terpasang). Screenshot dan hasilnya ada di `apps/client/e2e/hasil/` (diabaikan git).

## Deploy ke VPS (Docker)

```bash
GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build   # server + file PWA di 127.0.0.1:2567
docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t remi .  # build manual dengan commit tercatat
curl -s http://127.0.0.1:2567/healthz                                 # {"ok":true,"meja":0,"versi":"...","sha":"..."}
```

- `Dockerfile` menjalankan `npm run typecheck`, `npm test`, lalu `npm run build`. Kalau ada yang gagal, image tidak jadi. Build pertama ±1,5 menit (sebagian besar test).
- **Port hanya di 127.0.0.1.** `docker-compose.yml` memasang port ke `127.0.0.1:2567` (ubah lewat env `REMI_PORT`), jadi container tidak bisa dihubungi langsung dari internet; akses publik lewat reverse proxy HTTPS di mesin yang sama. Kalau proxy-nya juga container, sambungkan lewat network Docker dan hapus bagian `ports`.
- **Compose:** `restart: unless-stopped`, log dibatasi 3 × 10 MB, `stop_grace_period: 10s`. Saat `SIGTERM` server menutup WebSocket, meja, dan database dengan rapi (`docker stop` selesai < 1 detik, kode keluar 0).
- **Versi dan commit:** versi diambil dari `package.json` root. Commit diambil dari build-arg `GIT_SHA` (folder `.git` tidak ikut ke image); tanpa build-arg, commit tercatat `dev`. Keduanya tampil di `GET /healthz` (`{ ok, meja, versi, sha }`; tambah `sambungan` dan `galatMeja` kalau `HEALTHZ_DETAIL=1`), di log saat server mulai, dan di layar Tentang.
- **Image runtime ramping:** `node:24-alpine` + satu `main.js` (server dibundel, termasuk `ws` dan `sirv`) + file PWA (±3 MB di atas image Node), jadi tahap runtime tidak menjalankan `npm install`. Proses jalan sebagai user `node` (bukan root). `HEALTHCHECK` memanggil `/healthz` (status `healthy` ±30 detik setelah start).
- **Kompresi dan cache:** build client menulis versi `.br` dan `.gz` untuk file teks ≥ 1 KB, dan server menyajikannya otomatis. File ber-hash di `/assets/` diberi `Cache-Control: public, max-age=31536000, immutable`; `index.html`, `sw.js`, manifest, ikon, dan font diberi `no-cache`; 404 diberi `no-store`. Semua respons membawa `x-content-type-options: nosniff` dan `referrer-policy: strict-origin-when-cross-origin`.
- **Phaser dipisah** jadi chunk sendiri (`assets/phaser-[hash].js`) supaya update aplikasi tidak mengunduh ulang Phaser.
- Konfigurasi lewat environment: `PORT` (default 2567), `STATIC_DIR` (folder file PWA), `DB_PATH` (database klasemen), `MAKS_MEJA` (default 500), `MAKS_MEJA_PER_IP` (default 20; pemain satu WiFi kedai berbagi satu IP), `TRUST_PROXY` (`lokal` default: `X-Forwarded-For`/`X-Forwarded-Host` hanya dipercaya dari proxy di alamat loopback/privat; `1` selalu; `0` tidak pernah), `MAKS_SAMBUNGAN_PER_IP` (default 50 sambungan WebSocket sekaligus per jaringan; IPv4 per alamat, IPv6 per /64; sengaja longgar untuk WiFi kedai dan CGNAT seluler), `ORIGIN_DIIZINKAN` (asal tambahan yang boleh membuka WebSocket, dipisah koma, misalnya `https://remi.contoh.id,contoh.id`; bawaan hanya halaman yang sehost dengan server), `HEALTHZ_DETAIL` (`1` = `/healthz` ikut menampilkan `sambungan` dan `galatMeja`).
- **Ketahanan:** pesan WebSocket > 64 KiB atau frame cacat hanya menutup sambungan itu; galat di timer meja dicatat per meja di log (ringkasan `status: meja, sambungan, galatMeja` tiap ±10 menit; di `/healthz` hanya dengan `HEALTHZ_DETAIL=1`); galat yang lolos (`uncaughtException`) dicatat dan server tetap jalan, kecuali datang ≥ 20 kali per menit (proses keluar, Docker menyalakan ulang). Sambungan yang membanjiri > 120 pesan/detik diputus. Handshake WebSocket dari Origin asing ditolak `403`, dan lewat `MAKS_SAMBUNGAN_PER_IP` ditolak `429`. Semua respons HTTP (termasuk `/healthz`) membawa `Content-Security-Policy` (`script-src 'self'`, tanpa skrip inline; skrip splash ada di `public/splash.js`), `X-Frame-Options: DENY`, dan `Permissions-Policy` (kamera, mikrofon, lokasi mati); daftar lengkapnya di `apps/server/src/keamanan.ts`. Nama pemain dinormalisasi NFKC dan dibersihkan dari karakter kontrol/format (pembalik arah teks, zero-width lepas), tapi ZWJ/ZWNJ di emoji gabungan dan aksara yang membutuhkannya tetap; nama tanpa karakter terlihat jadi "Pemain". Log galat per sambungan dibatasi 10 baris/menit per jenis.
- **Wajib HTTPS untuk PWA.** Service worker dan "pasang ke layar utama" hanya jalan di HTTPS (pengecualian: `http://localhost` untuk uji lokal). Pasang reverse proxy di depan container. Contoh dengan Caddy di mesin yang sama (sertifikat otomatis, WebSocket `/ws` otomatis diteruskan):

  ```
  remi.domainkamu.com {
      reverse_proxy 127.0.0.1:2567
  }
  ```

  - Tidak perlu `encode` di Caddy: server sudah mengirim versi `.br`/`.gz` sendiri dan header cache-nya diteruskan apa adanya.
  - Proxy jangan menimpa `Cache-Control`. `sw.js` dan `index.html` harus tetap `no-cache`, kalau tidak pemain bisa lama tertahan di versi lama.
- **Update aplikasi (PWA `registerType: 'prompt'`):** setelah deploy, HP yang membuka aplikasi mengunduh service worker baru di latar belakang (saat dibuka/dimuat ulang, dan dicek ulang tiap jam). Selama putaran berjalan atau susun akhir tidak ada tawaran dan tidak ada reload. Di beranda, lobi, atau di antara putaran muncul toast "Ada versi baru, Bos." dengan tombol **Muat ulang**, plus tombol menetap di kaki beranda. Simpanan permainan offline tetap ada sesudah muat ulang.

- **Meja yang sedang jalan ada di memori server,** jadi restart server menghapus meja yang sedang jalan. Meja tanpa pemain terhubung dihapus otomatis setelah 10 menit.
- **Klasemen akhir permainan online** disimpan di SQLite (`node:sqlite`, bawaan Node, tanpa dependensi native) pada volume `remi-data`.
  - Endpoint baca: `GET /api/riwayat?batas=30` (permainan terbaru) dan `GET /api/peringkat` (peringkat sepanjang masa, pemain manusia digabung per nama).
  - Database memakai mode WAL, jadi jangan menyalin `remi.db` saja selagi server jalan. Cadangan yang aman tanpa menghentikan server:
    `docker compose exec remi node --disable-warning=ExperimentalWarning -e "new (require('node:sqlite').DatabaseSync)('/app/data/remi.db').exec(\"VACUUM INTO '/app/data/cadangan.db'\")"`, lalu `docker compose cp remi:/app/data/cadangan.db .`
- **CI** (`.github/workflows/ci.yml`): typecheck, test, dan build di Node 22 dan 24 untuk setiap push ke `main`/`produksi` dan pull request, lalu job **Docker image** (`docker build` penuh + cek `/healthz`, header cache, dan stop rapi). Job E2E smoke di Chrome runner bersifat opsional (tidak memblok).
- Daftar cek sesudah deploy (header, WebSocket, PWA, update): [docs/deploy.md](docs/deploy.md).

## Struktur proyek

```
packages/engine/          Mesin aturan murni (TypeScript, tanpa UI, tanpa dependensi)
  src/kartu.ts            Kartu, bunga, angka, nilai dasar
  src/kartuJadi.ts        Validasi seri & kembar As, aturan joker, opsi peran joker
  src/giliran.ts          Validasi mulung, turunkan, buang (dipakai mesin, bot, dan UI)
  src/mesin.ts            State + aksi → state baru; pembagian, pengocok, mentung, akhir putaran
  src/skor.ts             Rumus skor & teks perhitungan
  src/view.ts             State dari sudut pandang satu pemain (tangan lawan & deck disembunyikan)
  src/invarian.ts         Pemeriksa state legal
  src/bot/bot.ts          Bot "mudah" dan "normal"
  test/                   Test aturan, simulasi bot-vs-bot, fuzz, golden master (__golden__/)
packages/meja/            Satu meja/room: kursi, host, bot, timer giliran, sambung ulang, voting akhiri
  src/protokol.ts         Bentuk pesan client ↔ meja
  src/validasi.ts         Validasi pesan dari jaringan (data tidak dipercaya)
  src/meja.ts             Kelas Meja (tanpa jaringan; dipakai server dan mode offline)
apps/server/              HTTP + WebSocket (ws). Melayani file PWA, /healthz, /api, dan /ws
  scripts/bundel.mjs      Bundel server (esbuild) + suntik versi/commit
apps/client/              Phaser 4 + HTML + Vite + vite-plugin-pwa
  src/main.ts             Kerangka aplikasi: pindah layar, Back, PWA, status koneksi, latihan
  src/kontrolMeja.ts      Layar meja HTML: bar atas, bar aksi, jendela, keyboard, antrian animasi
  src/koneksi.ts          Koneksi online (WebSocket + sambung ulang) dan offline (meja di browser)
  src/preferensi.ts       Preferensi pemain per HP (suara, gerak, tampilan, ...)
  src/gerak.ts            Token durasi/easing, kurangi gerak, pegas
  src/versi.ts            Versi, commit, waktu build (disuntik Vite)
  src/game/               Kanvas meja: game.ts, MejaScene.ts, tataMeja.ts (tata letak murni),
                          kartuGrafis*.ts (kartu digambar Canvas), warnaMeja.ts
  src/efek/               Pemutar peristiwa, sorakan, suara/musik/getar (Web Audio)
  src/ui/                 Beranda, lobi, riwayat, pengaturan, bantuan, tentang, tutorial, dom.ts
  src/konten/             Isi Bantuan, teks tutorial, dan info Kedai Madya (kedai.ts) sebagai data
  src/aset/logoMadya.ts   Logo Kedai Madya sebagai path SVG (svgLogo untuk HTML, pathLogo untuk Canvas)
  src/gaya/               Design system CSS (token, komponen, layar, meja, gerak, responsif)
  test/                   Test client (happy-dom)
  e2e/smoke.mjs           E2E smoke dengan Chrome sistem
  scripts/                buat-ikon.mjs (ikon PWA), kompres.mjs (.br/.gz)
docs/                     Baseline perilaku, arsitektur client, riset desain, keputusan pemilik
```

Pemisahan yang dipegang:
1. **Mesin aturan**: fungsi murni dan deterministik. RNG mulberry32 di-seed, state-nya disimpan di `GameState.rng`.
2. **State**: satu objek `GameState` yang bisa diserialisasi ke JSON.
3. **UI/server**: hanya membaca state lewat `viewUntuk()` dan mengirim `Aksi` ke `terapkanAksi()`.

Aksi yang tersedia: `mulaiPutaran`, `ambilDeck`, `mulung`, `turunkan`, `buang`, `selesaiSusun`, `akhiriPermainan`. Aksi ilegal ditolak dengan `{ ok: false, error: { kode, pesan } }` dan state tidak berubah. `pesan` memakai bahasa tongkrongan dan siap ditampilkan ke pemain.

Dokumen pendukung:
- [docs/baseline-gameplay.md](docs/baseline-gameplay.md): perilaku aktual mesin aturan dan meja, plus cara meninjau golden test.
- [docs/arsitektur-client.md](docs/arsitektur-client.md): peta modul client (scene, animasi, jendela, audio, preferensi).
- [docs/riset-desain.md](docs/riset-desain.md): riset game feel, aksesibilitas, dan benchmark UX, beserta status implementasinya.
- [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md): rincian hal yang menunggu keputusan pemilik.

### Arsitektur online

- **Server memegang state asli.** Tiap pemain hanya menerima `ViewPemain` miliknya: tangan lawan dan urutan deck tidak pernah dikirim, jadi tidak bisa diintip dari devtools.
- **Bot jalan di server** dan hanya melihat view kursinya sendiri.
- **Client memvalidasi** dengan fungsi aturan yang sama sebelum mengirim. Tombol yang tidak sah langsung menampilkan alasannya, dan server tetap memvalidasi ulang.
- **Mode offline** memakai kelas `Meja` yang sama, dijalankan di browser.
- **Kenapa `ws`, bukan Colyseus:** keunggulan Colyseus adalah sinkronisasi state yang sama ke semua pemain. Di sini tiap pemain harus menerima state berbeda (kartu rahasia), jadi fitur itu tidak terpakai.
- **Koneksi di client:** sambung ulang dengan backoff 0,5–8 detik, ping tiap 25 detik dan sambungan diputus paksa kalau tidak ada jawaban, sambung ulang cepat saat sinyal kembali atau tab terlihat lagi. Selama terputus hanya buat/gabung/daftar yang diantrikan (maksimal 8, kedaluwarsa 30 detik); aksi permainan dibuang dan pemain diberi tahu supaya tidak ada aksi basi. Keluar meja saat sinyal putus tidak diantrikan (sambungannya langsung ditutup): pemain diberi tahu bahwa server belum tahu, jadi kursinya tercatat terputus (dan dimainkan warga kedai kalau permainan sudah jalan).

### Penyimpanan

| Di mana | Isi |
|---|---|
| HP (`localStorage`) | `remi.nama`, `remi.sesiOnline` (token sambung ulang), `remi.mejaOffline` (permainan offline, disimpan tiap aksi dan saat aplikasi ditutup), `remi.latihanTersimpan`, `remi.pengaturanOffline`, `remi.urutanTangan`, `remi.riwayat` (30 permainan terakhir; kursi warga kedai/bot ditandai dan tidak ikut statistik per pemain/rekor), `remi.riwayatTercatat` (penanda permainan online yang sudah dicatat, supaya reload tidak mencatat ulang), `remi.preferensi` (pengaturan; simpanan lama `remi.efek` ikut terbaca) |
| Server (memori) | Meja yang sedang aktif |
| Server (SQLite) | **Klasemen akhir permainan online.** Disimpan otomatis saat permainan selesai: tanggal, kode meja, alasan selesai, jumlah putaran, serta peringkat, nama, skor, mentung, dan kepentung tiap pemain. Lokasi diatur lewat `DB_PATH` (bawaan `apps/server/data/remi.db`; di Docker `/app/data/remi.db` di volume `remi-data`). |

### Keputusan perilaku aplikasi

Ini perilaku aplikasi, bukan aturan main. Semuanya bisa diubah kalau perlu.

- Pengaturan bawaan: warga kedai **Normal**, **tanpa batas putaran**, **tanpa batas skor**. Permainan selesai kalau semua sepakat menekan "Akhiri permainan". Pengaturan offline terakhir disimpan per HP dan dipakai lagi.
- Orang baru hanya bisa masuk saat meja masih di lobi. Setelah main, yang bisa masuk hanya pemain lama yang menyambung ulang pakai token.
- Pemain yang terputus: gilirannya dijalankan warga kedai (bot) sampai ia kembali. Pemain yang menekan "Keluar meja" saat main: kursinya diteruskan warga kedai permanen, jadi aplikasi meminta konfirmasi dulu. Teks konfirmasinya satu sumber (`opsiKonfirmasiKeluar` di `ui/lobi.ts`) untuk tombol Back, menu ☰, dan tombol di lobi.
- Nama warga kedai: "Warga Madya" (Kipas Dua, Cak Kopag, Mbak Teras, Mas Sampul, Si Rak, Pak Seng, Dik Toska, Ning Sore, Om Garpu, Bu Sendok). Urutannya diacak per meja (latihan: urutan tetap), nama yang sudah dipakai kursi lain dilewati, dan cadangannya "Warga N". Nama tidak bergantung pada level, kartu, giliran, atau peristiwa.
- Memulai permainan offline baru atau latihan saat masih ada simpanan selalu minta konfirmasi, karena simpanan lama terhapus. Permainan latihan tidak dicatat di riwayat.
- Waktu giliran habis (default 60 detik, bisa diatur 30–120 atau tanpa batas): warga kedai (bot) menyelesaikan giliran itu.
- Semua manusia terputus: permainan dijeda (bot berhenti) sampai ada yang kembali.
- Angka negatif ditampilkan dengan minus tipografis "−" (U+2212) di semua tampilan skor.
- Putaran berikutnya dimulai oleh host. Kalau skor terendah sama, host memilih pengocok atau "Acak".
- "Akhiri permainan" (di antara putaran): semua manusia yang terhubung harus setuju.
- Host pergi: host pindah ke pemain manusia lain yang masih terhubung.
- Joker di tangan tidak diberi penanda, dan tidak ada peringatan saat membuang joker (sesuai keputusan D11).
- Pengumuman joker online: pemain yang terputus tidak ditunggu. Kalau ada batas waktu giliran, popup joker juga dibatasi waktu yang sama.
- Simpanan permainan dari versi lama otomatis dilengkapi (migrasi). Kalau tetap tidak terbaca, simpanan itu dihapus supaya tidak macet. Simpanan permainan yang sudah selesai tidak ditawarkan untuk dilanjutkan. Nilai lain di `localStorage` yang bentuknya tidak cocok (misalnya riwayat bukan array) dikembalikan ke bawaan dan kuncinya dihapus.
- Tombol Back di HP menutup jendela teratas dulu, lalu meminta konfirmasi keluar dari meja/lobi. Di beranda perlu ditekan dua kali untuk keluar.
- Layar dijaga tetap menyala selama di meja (wake lock), dan kanvas meja berhenti menggambar saat tidak tampil supaya hemat baterai.
- **Mode ingatan (seperti meja asli):**
  - Server hanya mengirim (jumlah pemain − 1) kartu teratas buangan, dan log tidak menyebut kartu yang dibuang.
  - Setiap ambil, buang, dan mungut terlihat jelas saat terjadi (animasi + teks di panel pemain), jadi pemain harus ingat sendiri.
  - Bot juga hanya melihat yang sama.
  - Pengumuman pembaca layar, tutorial, bunyi, dan getar ikut menjaga info rahasia.
- **Tidak ada bantuan "kartu berbahaya":** menilai kartu mana yang aman dibuang adalah skill pemain.

### Meja yang hidup

- **Tempo warga kedai (bot):** jeda diacak, dan warga kedai "lagi mikir…" sebelum aksi pertamanya.

  | Tempo | Mikir sebelum aksi pertama | Aksi lanjutan di giliran yang sama |
  |---|---|---|
  | Santai (bawaan) | 3–10 detik | 1,5–3 detik |
  | Normal | 2–5 detik | 1–2 detik |
  | Cepat | 0,8–2 detik | 0,5–0,9 detik |

  Diatur di lobi atau di pengaturan offline, dan bisa diganti di tengah permainan lewat Pengaturan di menu ☰ (host / offline).
- **Kocok & bagi:** di awal tiap putaran deck dikocok, kartu dibagikan tertutup bergiliran (mulai dari pengocok, urut nomor kursi, sama dengan mesin aturan), lalu kartu tanganmu dibalik dari kiri ke kanan. Popup joker muncul sesudahnya.
- **Animasi:**
  - Kartu terbang melengkung: deck → pemain, pemain → buangan. Kartu yang dibuang membesar sebentar supaya semua sempat melihat.
  - Kartu yang sedang bergerak disembunyikan dari tangan dan buangan, jadi tidak terlihat dobel.
  - Tombol aksi dikunci selama animasi berjalan dan sesaat setelah aksi dikirim (mencegah kirim dobel).
- **Mungut:** kartu yang dipungut dipamerkan besar di tengah layar dulu. Setelah itu kartu pungutan dan kartu modal dari tangan terbang bersama ke kartu jadi barunya, dan sisa pungutan masuk ke tangan.
- **Turunkan:** kartu dari tangan terbang ke tempatnya di kartu jadi.
- **Ambil deck:** kartu yang kamu ambil dibalik dan diperlihatkan besar (hanya di layarmu), lalu ditaruh di **ujung kanan** tangan. Urutan kartu lain tidak berubah. Lawan hanya melihat kartu tertutup terbang ke panelnya.
- **Mentung:** pentungan dibuang tertutup ke tengah meja, bergetar sebentar (dengan bunyi tegang), lalu dibuka dengan percikan cahaya dan nilainya muncul (+50 / +100 / +150 / +250). Setelah itu muncul **panel mentung** yang menunggu sampai ditekan Lanjut:
  - Judul **MENTUNG!** atau **PENTUNG JOKER!**, dan status tiap pemain: "Kamu MENTUNG! +N", "Kamu KEPENTUNG −N" (beserta kartumu yang dipakai, dengan bunyi dan getar), atau "Kamu aman".
  - Lencana **DOUBLE / TRIPLE / QUADRA PENTUNG!** atau **PENTUNG MASSAL!** (2, 3, 4, atau 5 pemain kepentung), **↺ BALIK ARAH** atau **LOMPAT · arah tetap**, dan daftar siapa saja yang kepentung.
  - Rincian kartu yang dipungut dan dipasangkan (asal tiap kartu: dari siapa atau modal, dan peran joker) baru terbuka kalau diklik.
- **Akhir putaran:** perubahan skor melayang dari panel tiap pemain, lalu modal hasil menampilkan baris yang muncul bertahap dan angka yang dihitung naik. Di akhir permainan pemenang dirayakan dengan percikan cahaya.
- **Panel pemain:**
  - Menampilkan aksi giliran ini sekitar 3,5 detik, misalnya "mungut 9♦ · buang A♠".
  - Menampilkan jumlah kartu dan skor, misalnya "10 kartu · −125". Di panel yang sempit (misalnya HP 360 dengan 4–6 pemain, atau HP dimiringkan dengan banyak pemain) ditulis ringkas dengan ikon kartu kecil: "10 · −125".
  - Berkedip merah dengan tulisan **TINGGAL 1!** kalau pemain itu tinggal satu kartu (di panel sempit: **1!**).
  - Panel pemain yang sedang jalan diberi cahaya kecil berkeliling; saat giliranmu area tanganmu menyala.
- **Sorakan** (teks besar di tengah layar, antrian maksimal 3, tidak dibacakan pembaca layar):

  | Sorakan | Kapan muncul |
  |---|---|
  | KARTUMU DIPUNGUT! | Lawan mungut kartu dari buanganmu (dengan bunyi dan getar) |
  | KEMBAR AS! | 4 As turun |
  | SAPU BERSIH! | Mungut jumlah maksimal (n − 1, minimal 2) |
  | MULUNG BERUNTUN ×N! | Pemain yang sama mulung 3 gilirannya berturut-turut atau lebih dalam satu putaran |
  | JOKER DIBUANG?! | Ada yang membuang joker (−25) |
  | TINGGAL 1 KARTU! | Lawan tinggal satu kartu (sekali per pemain per putaran) |
  | DECK HABIS! / SUSUN KARTU! | Masuk susun akhir karena deck habis / karena ada yang mentung |

- **Kontrol:**
  - Penunjuk langkah ① Ambil → ② Turunkan → ③ Buang.
  - Tombol utama besar selalu di kanan bawah dengan label jelas, misalnya "Ambil deck", "Buang 7♥", atau "Mentung pakai 7♥!". Tombol kedua (Mulung/Turunkan) di sebelahnya. Aksi yang tidak sah memberi alasan di petunjuk, kartu/deck yang bersangkutan bergoyang, dan ada bunyi pelan.
  - Langsung di meja: ketuk deck untuk ambil, ketuk kartu di buangan untuk mungut sampai kartu itu, dan **seret kartu ke tumpukan buangan untuk membuang**.
  - Keyboard: lihat daftar pintasan lewat `?` atau menu ☰ → Pintasan keyboard.
- **Waspada:**
  - Label **KARTUMU DI ATAS!** dan bunyi detak jantung saat kartu teratas buangan milikmu dan lawan sedang menimbang.
  - Kartu di kartu jadi lawan yang berasal dari buanganmu diberi tanda **kamu**.
  - Saat giliranmu membuang, tumpukan menampilkan "berikutnya: X".
  - Bar waktu giliran berubah warna di 10 detik terakhir (dan diumumkan ke pembaca layar).
- **Emote:**
  - Tombol 😀 di bar atas membuka 17 emote (emoji dan celetukan seperti "Awas!", "Sabar…", "GG", "Kartu itu bundar, kak.").
  - Emote muncul sebagai gelembung di dekat pemainnya, dibatasi 1 per 1,2 detik.
  - Warga kedai sesekali nyeletuk menanggapi kejadian yang terlihat semua orang, misalnya "Suwun, Bos!" saat mungut kartu orang, "Nutup, rek!" saat mentung, atau "Kartu itu bundar, kak." saat kepentung.

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
| 25 | Peristiwa di view membawa kartu buangan yang sudah tertimbun di bawah (n − 1) teratas? | Kode sekarang: 40 peristiwa terakhir ikut di view (`view.ts`, `BATAS_PERISTIWA_VIEW`). UI tidak menampilkannya, tapi client termodifikasi bisa membacanya ([rinci](docs/keputusan-pemilik.md#k25)) | **Menunggu keputusan pemilik** |
| 26 | `rankJoker`/`kartuDibuka` dikirim di setiap view? | Kode sekarang: ya, dipakai validasi lokal dan popup joker; hanya UI yang menyembunyikannya ([rinci](docs/keputusan-pemilik.md#k26)) | **Menunggu keputusan pemilik** |
| 27 | Label "→rank" pada joker pengganti di kartu jadi dan teks log "(X jadi Y)", padahal angka joker "tidak ditampilkan lagi"? | Kode sekarang: keduanya tampil sepanjang putaran ([rinci](docs/keputusan-pemilik.md#k27)) | **Menunggu keputusan pemilik** |
| 28 | Sub-teks sorakan JOKER DIBUANG?! menyebut kartunya? | Kode sekarang: ya, misalnya "Budi buang 7 Waru · −25" ([rinci](docs/keputusan-pemilik.md#k28)) | **Menunggu keputusan pemilik** |
| 29 | Teks aksi singkat "buang 7♥" di panel lawan? | Kode sekarang: tampil sekitar 3,5 detik ([rinci](docs/keputusan-pemilik.md#k29)) | **Menunggu keputusan pemilik** |
| 30 | Pemain bertangan 1 kartu praktis tidak bisa mulung/mentung lagi (akibat modal ≥ pungutan dan kartu jadi minimal 3)? | Kode sekarang: memang begitu; perlu konfirmasi bahwa itu maksud aturannya ([rinci](docs/keputusan-pemilik.md#k30)) | **Menunggu keputusan pemilik** |
| 31 | Joker mati (pernah dibuang lalu dipungut) di tangan dinilai berapa? | Kode sekarang: nilai kartu aslinya, bukan 25. Belum tertulis di tabel skor ([rinci](docs/keputusan-pemilik.md#k31)) | **Menunggu keputusan pemilik** |
| 32 | 2 deck: kartu kembar boleh jadi joker pengganti di seri yang sama? | Kode sekarang: boleh (yang dilarang dua kartu yang mewakili angka sama) ([rinci](docs/keputusan-pemilik.md#k32)) | **Menunggu keputusan pemilik** |
| 33 | Room: pemain keluar sebelum menekan OK joker | Kode sekarang: meja menunggu selamanya kalau tanpa batas waktu (`tinggalkan` tidak menghapus dari `menungguJoker`) ([rinci](docs/keputusan-pemilik.md#k33)) | **Menunggu keputusan pemilik** |
| 34 | Room: pemain yang menyambung ulang saat pengumuman joker | Kode sekarang: tidak melihat popup joker putaran itu ([rinci](docs/keputusan-pemilik.md#k34)) | **Menunggu keputusan pemilik** |
| 35 | Room: batas waktu giliran setelah semua manusia terputus | Kode sekarang: batas lama tidak direset, bot langsung mengambil alih saat pemain kembali ([rinci](docs/keputusan-pemilik.md#k35)) | **Menunggu keputusan pemilik** |
| 36 | Room: voting "Akhiri permainan" saat pemilih berkurang | Kode sekarang: tidak dihitung ulang sampai ada yang menekan tombol lagi ([rinci](docs/keputusan-pemilik.md#k36)) | **Menunggu keputusan pemilik** |
| 37 | Room: refresh/putus singkat di giliran sendiri | Kode sekarang: bot langsung memainkan giliran itu setelah jeda mikir. Perlu masa tenggang? ([rinci](docs/keputusan-pemilik.md#k37)) | **Menunggu keputusan pemilik** |
| 38 | Room: error di timer bot | Kode sekarang: bisa mematikan proses server (semua meja di memori hilang) ([rinci](docs/keputusan-pemilik.md#k38)) | **Menunggu keputusan pemilik** |

## Test

`npm test` menjalankan semuanya (Vitest, sekitar 20 detik). Pekerjaan dianggap selesai kalau `npm test` dan `npm run typecheck` lolos.

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
- **Golden master:** permainan bot-vs-bot dan meja offline dengan seed tetap dikunci lewat sidik jari sha256 (proteksi regresi aturan sebelum mengubah presentasi). Cara meninjau dan memperbarui (`-u`) ada di [docs/baseline-gameplay.md](docs/baseline-gameplay.md).
- **Fuzz:** aksi acak yang sering ilegal. Aksi yang ditolak harus tidak mengubah state, aksi yang diterima harus menghasilkan state legal.
- **Meja:** lobi, host, atur kursi, mulai, kartu rahasia per pemain, permainan penuh 1 manusia + 3 bot, timer giliran diambil alih bot, putus/sambung ulang, jeda saat semua pergi, voting akhiri, simpan/lanjut.
- **Server:** integrasi WebSocket nyata (buat/gabung pakai kode, kartu rahasia, sambung ulang dengan token, daftar meja publik, pesan rusak), riwayat SQLite.
- **Client** (`apps/client/test`, happy-dom): preferensi dan migrasinya, gerak, penyimpanan, versi, jendela dan fokus (`dom.ts`), koneksi (watchdog, antrian, simpan offline), kontrol meja (keyboard, tolak, kunci kirim, popup joker), pemutar peristiwa (info rahasia: tidak membaca angka joker, kartu lawan tetap tertutup), rincian skor, tutorial, Bantuan, Pengaturan, Tentang (CHANGELOG), Riwayat, beranda.
- **E2E smoke** (`npm run e2e`, tidak ikut `npm test`): alur beranda → main → joker → ambil → buang → Pengaturan → Bantuan → Tentang → simpan → lanjutkan di Chrome sungguhan, untuk HP dan desktop. Gagal kalau ada error di konsol atau ketukan tembus ke kanvas.

## Catatan & rencana berikutnya

- **Keputusan pemilik yang tertunda:** baris #20–#23 dan #25–#38 di tabel Aturan Terbuka. Rinciannya di [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md).
- **Belum diuji di HP fisik.** Semua uji tampilan memakai Chrome desktop dengan emulasi HP (dpr 2–3, sentuh). Yang perlu dicek di perangkat sungguhan lewat HTTPS: Safari iOS (audio, getar tidak didukung, PWA), Chrome Android (getar, tombol Back di PWA fullscreen, wake lock), siklus update service worker dari versi A ke B, dan pembaca layar (TalkBack/VoiceOver).
- **Bot normal masih cukup pasif.** Di 6 pemain, mayoritas putaran berakhir karena deck habis. Perlu diperkuat (lebih berani mulung, menahan kartu untuk mentung).
- **Meja online hanya di memori.** Restart atau deploy ulang server membuang meja yang sedang berjalan.
- **Docker dan PWA** sudah diuji di mesin pengembang (Docker Desktop + Chrome, `http://localhost`); lihat [docs/deploy.md](docs/deploy.md). Yang belum: HTTPS sungguhan di balik Caddy, pemasangan PWA di HP sungguhan, dan job CI Docker/E2E di runner GitHub.
- Status tiap rekomendasi riset desain (yang sudah, sebagian, dan belum) ada di [docs/riset-desain.md](docs/riset-desain.md#status-implementasi-rilis-020).
