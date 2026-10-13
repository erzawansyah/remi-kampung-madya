# Catatan perubahan

Semua perubahan penting di Remi Kampung Madya dicatat di sini. Formatnya mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan nomor versinya mengikuti [Semantic Versioning](https://semver.org/lang/id/).

Tiap versi dibagi dua: **Untuk pemain** (yang terasa waktu main) dan **Teknis** (untuk yang ngoprek kodenya). Aturan main tidak pernah diubah diam-diam: kalau aturan berubah, pasti tertulis jelas di sini.

## [Belum dirilis]

Tampilan dan teks disesuaikan dengan Kedai Madya, tempat remi ini biasa dimainkan. Game ini versi online-nya. **Aturan main tidak berubah.**

### Untuk pemain

#### Ditambahkan

- Logo Kedai Madya di beranda dan di layar Tentang. Logonya dipakai dengan izin kedai.
- Kartu **Main bareng di Kedai Madya** di beranda, di bawah menu: alamat singkat, tautan peta, Instagram, Threads, dan Rak Buku Kedai Madya. Jam buka sengaja tidak ditulis karena bisa berubah, jadi cek di IG atau Maps. Kalau HP sedang offline, ada catatan bahwa tautannya butuh internet.
- Bagian **Kedai Madya** di layar Tentang, lengkap dengan alamat dan tautan yang sama.
- Satu baris ajakan main di Kedai Madya beserta tautan peta di klasemen akhir. Baris ini tidak muncul di hasil per putaran maupun di latihan.
- Selama permainan, info kedai tidak pernah muncul sendiri lewat pop-up atau toast, dan meja, susun akhir, popup joker, panel mentung, serta tutorial tidak memuatnya. Kalau mau lihat, buka Tentang kapan saja, juga dari menu ☰ saat bermain.

#### Diubah

- Pemain komputer sekarang disebut **warga kedai** dan punya nama sendiri: Kipas Dua, Cak Kopag, Mbak Teras, Mas Sampul, Si Rak, Pak Seng, Dik Toska, Ning Sore, Om Garpu, dan Bu Sendok. Nama-nama ini diambil dari benda dan suasana di kedai, misalnya kipas, rak buku, kursi toska, serta garpu dan sendok di logonya. Urutannya diacak tiap meja baru, kecuali di latihan. Permainan lama yang masih memakai "Bot 1" tetap tampil apa adanya.
- Warna kuning disamakan dengan papan nama MADYA. Punggung kartu sekarang arang dengan motif kawung kuning dan medali cangkir maskot kedai. Ikon aplikasi ikut berganti (HP yang sudah memasang aplikasi menerima ikon baru setelah pembaruan).
- Celetukan warga kedai pakai gaya kedai, misalnya "Suwun, Bos!", "Nutup, rek!", dan "Kartu itu bundar, kak." Celetukan itu juga tersedia di palet emote.
- Teks beranda, lobi, pengaturan, riwayat, bantuan, dan tutorial diselaraskan: istilah "bot" diganti "warga kedai", dan kalimat yang klise atau terdengar seperti iklan ditulis ulang jadi lebih lugas. Isi aturannya tetap sama.
- Konfirmasi keluar meja sekarang sama persis lewat jalur mana pun (tombol Back, menu ☰, tombol di lobi) dan menjelaskan apa yang terjadi: di lobi kursimu dilepas, saat main kursimu diteruskan warga kedai sampai selesai, dan setelah permainan selesai tidak ada yang hilang.
- Angka negatif di skor, riwayat, statistik, pengaturan batas skor, dan panel pemain di meja konsisten memakai tanda minus "−".
- Di palet emote, "Kartu itu bundar, kak." mengisi sisa baris terakhir supaya tidak terlipat.
- Info lawan di panel yang sempit (misalnya HP 360 dengan 4 sampai 6 pemain, atau HP dimiringkan dengan banyak pemain) memakai ikon kartu kecil di depan jumlah kartu, lalu skor, misalnya "10 · −125", supaya nama lawan tetap utuh. Lawan yang tinggal satu kartu ditulis "1!" merah. Panel yang lega tetap menulis "10 kartu · −125".
- Pembaca layar menyebut warga kedai saat giliran berpindah atau saat mereka nyeletuk, misalnya "Giliran Kipas Dua (warga kedai)."
- Kredit di Tentang: aturan main dari teman-teman tongkrongan di Kedai Madya.
- Deskripsi aplikasi saat dipasang ke layar utama memakai istilah "warga kedai". Deskripsi halaman yang tampil di hasil pencarian dan pratinjau tautan sekarang sama persis dengan deskripsi aplikasi.

#### Diperbaiki

- Main pakai keyboard: sorotan yang tertinggal di deck atau buangan yang sedang tidak bisa dipakai (sudah ambil kartu, deck habis, buangan kosong) langsung pindah ke kartu tangan dengan ↓, Home, atau End. Urutan Esc, ↓, Home, →, Spasi memilih kartu kedua, juga di awal putaran 2 dan seterusnya.
- Saat putaran baru dimulai, sorotan dan pilihan kartu dari putaran lalu dibuang. Kartu yang kamu pilih dengan keyboard selagi kartu masih dibagi tetap terpilih.
- Nama warga kedai di panel lawan tampil utuh di semua ukuran layar yang diuji, termasuk HP 360 dengan teks besar dan HP dimiringkan 740×360 dengan teks besar dan 6 pemain.
- Tulisan "Giliran Mbak Teras" di samping deck tidak terpotong lagi. Kalau kolomnya terlalu sempit, yang tampil nama pemainnya saja.
- Server online tidak lagi mati (dan membuang semua meja yang sedang jalan) gara-gara satu pesan yang terlalu besar atau rusak dari satu HP.
- Angka "+N" (jumlah kartu buangan di bawah tumpukan) tidak lagi menempel pada nama pembuang kartu.
- Punggung kartu yang tampil kecil (kartu lawan, deck di HP) memakai siluet cangkir saja, karena wajah dan garpu-sendok maskot tidak terbaca di ukuran itu.
- Palet emote tidak lagi meluber ke kanan di HP 320 dengan teks besar. Di layar 400 px ke bawah palet memakai 3 kolom, celetukan panjang dilipat di spasi, dan tiap tombol tetap setinggi minimal 44 px.
- Di HP potret dengan 4 sampai 6 pemain, kartu jadi lawan tidak lagi mengecil sampai sulit dibaca. Di layar yang paling sesak (misalnya HP 320 dengan teks besar dan 6 pemain, atau saat menyusun mulung di HP kecil) kartu tanganmu tetap didahulukan, jadi kartu jadi lawan tampil kecil.
- Di HP 360 dengan teks besar, keempat tab Riwayat (Peringkat, Permainan, HP ini, Statistik) muat satu baris; label "Statistik" tidak terpotong lagi. Di layar yang lebih sempit tab masih bisa digeser seperti sebelumnya.
- Di HP dimiringkan yang pendek, label deck, "Giliranmu", dan namamu tidak lagi saling tumpuk setelah kartu jadimu turun. Kalau ruangnya tidak cukup, namamu dan kartu jadimu pindah ke panel kecil di sisi kanan, seperti panel lawan.
- Masuk mode mulung di HP tidak lagi membuat seluruh meja mendadak mengecil: kartu tangan dan kartu jadi lawan tetap seukuran sebelumnya.
- Sambungan online yang tertahan di "Menyambung…" (sinyal hilang tepat saat menyambung) sekarang dicoba ulang otomatis setelah 10 detik.
- Latihan dengan panduan sekarang ditutup dengan penjelasan hitung skor dan ucapan penutup di klasemen akhir. Latihan baru dianggap tuntas setelah penutup itu tampil.
- Nama pemain dibersihkan dari karakter tak terlihat dan pembalik arah teks, jadi nama tidak bisa tampil kosong atau terbalik.
- Pembaca layar: tombol urut kartu namanya sesuai tulisan di tombol, dan isi aplikasi berada di landmark utama.
- Beranda terbuka lebih cepat: mesin grafis meja baru dimuat sesudah beranda tampil, dan Bantuan serta Tentang dimuat saat dibuka (tetap tersedia offline).
- Di HP lanskap, gelembung tutorial pada langkah Mulung, Tumpukan buangan, Giliran lawan, dan Kartu jadi lawan tidak lagi menutupi kartu tangan. Kalau tempatnya sempit, gelembung dibuat lebih ramping atau teksnya dilipat satu baris, dan sisanya bisa dibuka lewat "Baca semua".

### Teknis

- `apps/client/src/konten/kedai.ts`: satu sumber data info kedai (nama, bio, alamat, tautan) yang hanya berisi fakta yang sudah dicek. Peta utama memakai URL cid Google Maps karena di HP langsung membuka aplikasi Maps. Tautan share.google dari pemilik disimpan sebagai cadangan karena membuka Google Search dulu. Tidak ada jam buka, menu, harga, rating, jumlah buku, atau telepon. Semua tautan `https`, `target="_blank" rel="noopener noreferrer"`, tanpa UTM atau analitik. Diuji di `apps/client/test/kedai.test.ts`.
- `apps/client/src/aset/logoMadya.ts`: logo sebagai path SVG yang ditanam di kode (`svgLogo()` untuk HTML, `pathLogo()` untuk Canvas). Tidak ada file gambar tambahan, jadi tetap jalan offline.
- Token warna Kedai Madya di `gaya/token.css`: `--madya-tinta`, `--madya-kertas`, `--madya-kuning`, `--madya-toska`, `--madya-zaitun`, `--emas-rgb`, dan `--teks-emas`. `--emas` sekarang kuning papan nama #f1a615. Literal `rgba(242, 193, 78, …)` lama diganti `rgba(var(--emas-rgb), …)`.
- `OpsiMeja.namaLawan` (packages/meja): urutan calon nama warga kedai, beserta `NAMA_LAWAN_BAWAAN` dan `namaLawanAcak()`. Opsi ini ada di `OpsiMeja`, bukan `PengaturanMeja`, jadi `DataMeja` tidak perlu migrasi. Server dan meja offline mengacak urutannya dengan `Math.random`, bukan `opsi.acak`, supaya urutan celetukan di golden tidak bergeser. Latihan memakai urutan tetap (`KoneksiOffline.baru(…, { urutanNamaTetap: true })`).
- **Golden master meja diperbarui** karena dua perubahan presentasi yang disetujui pemilik: nama lawan berubah dari "Bot N" menjadi nama warga kedai (nama di `ringkasanAkhir` dan hash yang memuat nama kursi), dan teks celetukan baru di skenario 3 pemain (teks di `emote`, panjang tiap daftar celetukan tetap). Jumlah pesan, kursi dan urutan emote, putaran, skor, dan peringkat tetap sama. Golden engine tidak berubah. Rinciannya di `docs/baseline-gameplay.md`.
- `opsiKonfirmasiKeluar()` di `ui/lobi.ts` menjadi satu sumber teks konfirmasi keluar untuk lobi, menu meja, dan tombol Back.
- Konvensi minus tipografis: `MINUS`, `angkaSkor()`, dan `minusTipografis()` di `ui/rincianSkor.ts`. Teks perhitungan dari engine hanya diubah di tampilan, engine tidak disentuh.
- `apps/client/test/kontenAturan.test.ts`: setiap contoh kartu di Bantuan diuji dengan validator engine (`validasiKartuJadi`, `validasiTurunkan`, `validasiMulung`, `validasiBuang`) dan hasilnya harus sama dengan tanda sah/tidak sah di konten. Angka kunci di teks (maksimal mulung, −25 buang joker, pentungan joker 250, syarat mentung) ikut dicocokkan.
- Emote "Kartu itu bundar…" diganti "Kartu itu bundar, kak." di `DAFTAR_EMOTE` dan celetukan kepentung. Golden master meja tidak bergeser (dicek dengan `-u`). Emote yang sudah tidak ada di daftar, misalnya "Makasih, Bos!" dan "Tutup!" dari versi 0.2.0, ditolak validasi server ("Pesan tidak dikenali.") kalau dikirim client lama; rinciannya di `docs/baseline-gameplay.md`.
- `geserFokus()` di `kontrolMeja.ts` menerima daftar sasaran tengah yang `mati` (deck di luar tahap ambil giliranku atau habis, buangan kosong). Sorotan di sasaran mati yang belum tampak dianggap kosong, jadi panah pertama mulai dari tangan.
- `KontrolMeja.pasangView()` dipakai untuk setiap view baru, termasuk di tengah animasi (`terapkanViewBerikut`). Kalau nomor putaran berganti, pilihan, mulung, dan sorotan keyboard dibuang saat itu juga, bukan di `tampilkan()`. `deretBawah()` ikut memuat kartu tangan yang masih dianimasikan.
- Palet emote (`gaya/meja.css`): kolom `minmax(0, 1fr)`, lebar dalam rem supaya ikut teks besar, dan 3 kolom di layar 400 px ke bawah.
- `tataGelembung()` di `ui/tutorial.ts` mencoba varian ringkas yang lebih sempit dan varian satu baris, ditambah posisi di samping sasaran yang rata atas. Kasus HP lanskap dikunci di `apps/client/test/tutorial.test.ts`.
- Ketahanan server (`apps/server`, diuji di `apps/server/test/ketahanan.test.ts`): setiap sambungan WebSocket punya penangan `error`. Sebelumnya satu pesan di atas `maxPayload` (64 KiB) atau satu frame cacat dari siapa pun mematikan proses server beserta semua meja. Sekarang sambungan itu saja yang ditutup (1009/1002).
- Ketahanan server: timer meja (langkah warga kedai, batas waktu giliran, celetukan) dijalankan lewat penjadwal pembungkus: galat di sana dicatat per meja (`galat di timer meja …`) dan dihitung (`galatMeja`), proses tetap hidup. Penanganan `close` sambungan dan pembersihan berkala juga dibungkus `try/catch`.
- Ketahanan server: penjaga proses (`src/penjaga.ts`) mencatat `uncaughtException` dan `unhandledRejection`, lalu server tetap jalan. Kalau galat datang ≥ 20 kali dalam 60 detik, proses keluar dengan kode 1 supaya Docker menyalakan ulang. Dipasang setelah server jalan, jadi galat saat start (misalnya port terpakai) tetap mematikan proses.
- Ketahanan server: lewat 30 pesan per detik, pesan dibuang seperti sebelumnya, lewat 120 pesan per detik sambungannya diputus (1008).
- Ketahanan server: batas meja per alamat IP pembuat, bawaan 20 (env `MAKS_MEJA_PER_IP`), supaya satu orang tidak bisa memenuhi batas 500 meja (env `MAKS_MEJA`). Alamat IP dari `X-Forwarded-For` (entri paling kanan) hanya dipercaya kalau sambungan datang dari alamat loopback/privat, misalnya Caddy di mesin yang sama (env `TRUST_PROXY`: `lokal` bawaan, `1`, atau `0`).
- Ketahanan server: saat SIGTERM/SIGINT penutupan hanya jalan sekali walau sinyal datang berulang, WebSocket ditutup dengan kode 1001, sambungan HTTP keep-alive ikut ditutup, dan ada batas 8 detik sebelum keluar paksa (di bawah `stop_grace_period` 10 detik).
- `/healthz` publik hanya `{ ok, meja, versi, sha }`. `sambungan` dan `galatMeja` hanya ikut dengan env `HEALTHZ_DETAIL=1`; ringkasan status juga dicatat di log berkala.
- Keamanan server (`apps/server/src/keamanan.ts`, diuji di `apps/server/test/keamanan.test.ts`): handshake WebSocket dari Origin asing ditolak 403 (asal tambahan lewat env `ORIGIN_DIIZINKAN`); batas sambungan per jaringan (env `MAKS_SAMBUNGAN_PER_IP`, bawaan 50, ditolak 429). IPv6 dihitung per /64, juga untuk batas meja per IP.
- Semua respons HTTP membawa Content-Security-Policy ketat (`script-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, dan `Permissions-Policy`. Skrip splash dipindah dari inline ke `apps/client/public/splash.js`; `@font-face` Baloo 2 ikut di gaya splash supaya font yang di-preload langsung terpakai. `theme-color` disamakan dengan manifest.
- Nama pemain di `packages/meja/src/validasi.ts` dinormalisasi NFKC, dibersihkan dari karakter kontrol/format Unicode (bidi, zero-width), dan dipotong per code point (emoji tidak terbelah). Diuji di `packages/meja/test/validasi-nama.test.ts`. Golden tidak bergeser.
- `KoneksiOnline`: batas waktu CONNECTING 10 detik dengan backoff, dan cek ulang saat tab terlihat atau sinyal kembali tanpa membuat sambungan ganda.
- Phaser dimuat lewat `import()` dinamis (`game/gamePhaser.ts`) sesudah interaksi pertama atau saat senggang; Bantuan dan Tentang (termasuk CHANGELOG) dimuat malas lewat `ui/jendelaMalas.ts`. Semua chunk tetap di precache PWA. Lighthouse mobile: Performance 85 → 92, FCP 3,0 → 1,5 detik, unduhan awal 448 → 151 KiB; `index.js` 326 → 254 kB.
- `#game` dan `#ui` dibungkus `<main id="utama">` (`pasangLandmarkUtama()` di `ui/dom.ts`).
- Tata letak lanskap pendek punya mode "panel diriku" dan test matriks baru di `apps/client/test/tataMeja.test.ts` (tanpa tabrakan teks, nama utuh, ukuran kartu tetap saat mulung).
- Vitest naik ke 4.1.11 (menutup temuan critical tinypool dan moderate @vitest/mocker; `npm audit` = 0). Konfigurasi memakai `test.execArgv` dengan `pool: 'forks'` eksplisit.
- E2E smoke mencari port bebas di beberapa rentang (4173–4199, 8090–8199, lalu port dari OS), supaya tetap jalan di Windows yang memesan rentang port untuk Hyper-V.
- Deploy: `docker-compose.yml` memasang port hanya di `127.0.0.1` (pakai reverse proxy seperti Caddy), meneruskan build-arg `GIT_SHA`, membatasi ukuran log, dan memberi `stop_grace_period`; `HEALTHCHECK` punya `start-period`. CI ikut membangun dan menjalankan image Docker. Daftar cek deploy ada di `docs/deploy.md`. **Perhatian:** yang dulu membuka port 2567 langsung ke internet tanpa proxy perlu memasang reverse proxy, atau mengubah bagian `ports` di compose.

## [0.2.0] - 2026-10-13

Rilis besar untuk tampilan, rasa main, dan kesiapan produksi. **Aturan main tidak berubah**: semua perubahan di bawah ini soal tampilan, kenyamanan, dan ketahanan aplikasi.

### Untuk pemain

#### Ditambahkan

- Kartu baru yang terasa seperti kartu sungguhan: indeks pojok besar dan tebal, J/Q/K berornamen (peci, tiara, mahkota), As bercincin emas, dan punggung marun motif kawung. Kartu yang tampil kecil memakai desain khusus yang tetap terbaca.
- Awal tiap putaran kartu dikocok lalu dibagikan tertutup ke semua pemain, dan kartu tanganmu dibalik satu per satu. Pengumuman joker muncul sesudahnya.
- Kartu terbang melengkung dan mendarat dengan pegas, punya bayangan sesuai tingginya, sedikit mengecil saat ditekan, dan terangkat saat dipilih. Di komputer kartu terangkat sedikit saat disorot mouse.
- Seret kartu ke tumpukan buangan untuk membuang. Buangan menyala saat kartu di atasnya, dan kartu kembali ke tangan kalau dilepas di tempat lain.
- Pentungan yang dibuka dan pemenang akhir dirayakan dengan percikan cahaya. Di akhir putaran perubahan skor melayang dari panel tiap pemain, dan angka di hasil putaran dihitung naik.
- Sorakan **SUSUN KARTU!** saat masuk susun akhir karena ada yang mentung.
- Suara kartu baru (gesekan kertas, ketukan di meja, dan nada ala bilah gamelan) plus musik latar santai ala keroncong yang bisa dinyalakan (bawaannya mati).
- Layar **Pengaturan** dari beranda dan dari menu ☰ di meja: suara, musik, dan getar dengan volume terpisah; gerak (ikut sistem, penuh, atau dikurangi); kecepatan animasi; efek hemat untuk HP lemah; kartu empat warna; teks besar; tempo bot; "Ulangi tutorial"; dan "Kembalikan bawaan".
- Layar **Bantuan**: aturan lengkap Kedai Madya per bab dengan contoh kartu yang ditandai sah atau tidak sah, tanya jawab, daftar istilah, dan pencarian.
- **Latihan dengan panduan** untuk pemain baru: satu putaran lawan dua bot mudah, dengan penjelasan yang muncul sesuai kejadian di meja. Bisa dilewati kapan saja.
- Layar **Tentang** berisi nomor versi, waktu build, kredit, dan catatan perubahan ini. Nomor versi juga tampil di kaki beranda.
- Beranda baru: kipas kartu, tombol "Lanjutkan permainan" dengan ringkasan pemain, putaran, dan skormu, pengaturan meja yang bisa dilipat, dan tombol "Pasang ke layar utama" kalau browser mendukung.
- Tab **Statistik** di Riwayat: jumlah main, rekor, ringkasan kamu, dan tabel per pemain dari permainan di HP ini.
- Main penuh dengan keyboard: panah, Spasi/Enter, pintasan huruf (D, M, T, B, J, K, S, U, H), angka 1–9 untuk mungut, dan `?` untuk daftar pintasan.
- Pengumuman untuk pembaca layar: giliran, kartu yang kamu pilih, alasan aksi ditolak, dan sisa waktu 10 detik. Kartu yang dibuang lawan dan angka joker tidak pernah dibacakan.
- Lencana status koneksi di meja online, dan pesan ramah "Server-nya belum bisa dihubungi" dengan tombol Coba lagi.
- Konfirmasi sebelum keluar meja online (kursimu diteruskan bot), sebelum memulai permainan baru yang menghapus simpanan, dan sebelum host menekan "Main lagi".
- Tawaran "Ada versi baru, Bos." dengan tombol Muat ulang. Aplikasi tidak pernah memuat ulang sendiri, dan tawarannya ditunda kalau putaran sedang berjalan.

#### Diubah

- Mesin grafis meja diperbarui ke Phaser 4. Cara main dan aturannya tidak berubah.
- Tata letak meja menyesuaikan layar: di layar lebar lawan duduk di kiri, atas, dan kanan; di HP yang dimiringkan lawan pindah ke samping supaya kartu dapat ruang. Kartu dan teks lebih besar di layar besar.
- Momen mentung dirangkum di panel mentung: judul MENTUNG! atau PENTUNG JOKER!, lencana DOUBLE/TRIPLE/QUADRA PENTUNG, balik arah atau lompat, dan status kamu. Sorakan terpisah untuk hal-hal itu dan sorakan "PUTARAN N" tidak dipakai lagi.
- Menu ☰ berisi Pengaturan, Bantuan, Pintasan keyboard, Layar penuh, Tentang, dan Keluar. Saklar suara dan getar pindah ke Pengaturan. Pilihan suara dan getar lamamu tetap terbawa.
- Log dikelompokkan per putaran dengan ikon. Teks log tetap sama.
- Skor yang sama sekarang berbagi peringkat, dan pemenang bersama ditulis "juara bareng".
- Tinggi bar aksi tetap, jadi tidak melompat-lompat saat tombolnya berganti. Alasan aksi ditolak boleh tiga baris, dan petunjuk bisa diketuk untuk membaca lengkap.
- Zoom browser tidak dikunci lagi (kanvas meja tetap tidak ikut ter-zoom saat dicubit).
- Klasemen akhir ikut menampilkan ringkasan putaran terakhir, karena putaran itu langsung berlanjut ke klasemen tanpa modal hasil: skor putaran terakhir tiap pemain, cara putaran berakhir (deck habis atau siapa yang mentung), dan rinciannya yang bisa dibuka.
- Tombol "Lanjutkan" di beranda menyebut kalau yang tersimpan adalah latihan dengan panduan ("Lanjutkan latihan").
- Catatan perubahan di Tentang hanya menampilkan bagian untuk pemain. Catatan teknis dilipat terpisah, dan teks kodenya lebih kontras.
- Bantuan memberi catatan "masih menunggu konfirmasi pemilik aturan" pada dua hal yang belum diputuskan (tangan tinggal 1 kartu tidak bisa mulung, dan nilai joker mati yang masih di tangan). Isi menu ☰ juga ditulis sesuai aslinya.

#### Diperbaiki

- Ketukan pada menu atau jendela tidak lagi tembus ke kartu atau deck di bawahnya.
- Langkah terakhir permainan offline tidak hilang kalau aplikasi langsung ditutup.
- Permainan offline yang sudah selesai tidak ditawarkan lagi untuk dilanjutkan dan tidak tercatat dobel di riwayat.
- Tombol yang ditekan cepat dua kali atau ditahan tidak lagi mengirim aksi dobel.
- Kartu yang dipilih sambil menunggu animasi ambil deck tidak hilang lagi.
- Menyeret dengan dua jari sekaligus tidak lagi membuat kartu macet.
- Nama pemain yang memakai `&`, `<`, atau `>` tampil benar di rincian skor.
- Layar HP tetap menyala setelah kembali dari aplikasi lain.
- Tab Riwayat tidak meluap di HP kecil, dan Escape menutup layar Riwayat.
- Permainan online yang sudah selesai tidak lagi tercatat ulang di riwayat HP setiap kali halaman dimuat ulang atau aplikasi dibuka lagi, jadi statistik tidak menggelembung.
- Statistik "Per pemain" dan rekor skor hanya menghitung pemain manusia. Bot dari meja yang berbeda (misalnya dua "Bot 1") tidak lagi digabung jadi satu. Riwayat lama tetap terbaca.
- Data simpanan di HP yang rusak tidak lagi membuat beranda, Riwayat, atau meja macet: nilainya dikembalikan ke bawaan.
- Di HP, urutan Tab dan pembaca layar di beranda sekarang sama dengan urutan di layar (main dulu, baru menu dan versi).
- Dialog "Keluar dari meja?" di lobi tertutup sendiri kalau host keburu memulai permainan, jadi kamu tidak keluar dari permainan yang sudah berjalan tanpa sengaja.
- Keluar meja saat sinyal putus sekarang bilang apa adanya: server belum tahu kamu keluar, jadi kursimu tercatat terputus (dan dimainkan bot kalau permainan sudah berjalan).
- Tab, pilihan di Pengaturan, dan daftar bab Bantuan punya area sentuh minimal 44 px.
- Di HP kecil dengan teks besar dan 5–6 pemain, panel lawan diringkas supaya deck, buangan, dan kartu tangan tidak saling tumpuk.
- Di HP yang dimiringkan, menyusun mulung memakai baris tengah meja: deck dan buangan diringkas ke kiri sementara, kartu jadimu tetap terlihat (lebih kecil), dan kartu pungutan serta kombinasi mendapat sisa lebarnya supaya tetap terbaca dan mudah diketuk tanpa menimpa panel lawan.
- Sorotan tumpukan buangan tidak tertinggal menyala, dan kartu yang diseret ke buangan selagi aksi sebelumnya masih diproses kembali ke tangan tanpa tanda salah.
- Setelah modal hasil putaran ditutup, fokus keyboard kembali ke tombol "Hasil putaran", tidak hilang.
- Gelembung latihan tidak lagi menutupi bagian yang sedang dijelaskan. Di HP yang dimiringkan gelembungnya bisa pindah ke samping, dan di layar sempit teksnya diringkas dengan tombol "Baca semua".
- Label tombol aksi yang panjang dilipat dua baris (bukan "Konfirmasi mul…"), dan nama pembuang di bawah buangan memakai inisial kalau tempatnya sempit.

### Teknis

#### Ditambahkan

- Golden-master regression test untuk engine (`packages/engine/test/golden.test.ts`, 6 konfigurasi × 8 seed × 3 putaran) dan meja (`packages/meja/test/golden-meja.test.ts`). Sidik jari sha256 mengunci aksi, view, peristiwa, log, riwayat, dan aturan info rahasia, sebagai pagar sebelum presentasi dirombak.
- Test client di `apps/client/test` dengan happy-dom per file (`// @vitest-environment happy-dom`): preferensi, gerak, penyimpanan, versi, jendela dan fokus, koneksi, kontrol meja, pemutar peristiwa (info rahasia), rincian skor, tutorial, Bantuan, Pengaturan, Tentang, Riwayat, dan beranda. Script `npm run test:client`.
- E2E smoke `npm run e2e` (`apps/client/e2e/smoke.mjs`): build produksi, `vite preview`, lalu alur pendek di Chrome sistem lewat `playwright-core` (tanpa unduh browser) untuk HP dan desktop. Gagal kalau ada error konsol atau ketukan tembus ke kanvas.
- CI GitHub Actions (`.github/workflows/ci.yml`): typecheck, test, dan build di Node 22 dan 24, plus job E2E opsional. `.nvmrc` = 22.
- Tata letak meja sebagai fungsi murni (`game/tataMeja.ts`) dan palet kanvas dari token CSS (`game/warnaMeja.ts`).
- Grafis kartu dipisah: `game/kartuGrafisGambar.ts` (Canvas 2D murni, juga dipakai HTML lewat `gambarKartuKeKanvas`) dan `game/kartuGrafis.ts` (tekstur Phaser tingkat mini/normal/besar, bayangan, sorot, fokus, ganti warna di tempat, pemanasan bertahap).
- Audio baru: satu `AudioContext` dengan bus efek dan musik, limiter, unlock untuk iOS, suspend saat tab tersembunyi (`efek/mesinAudio.ts`), primitif sintesis (`efek/sintesis.ts`), musik generatif dengan penjadwalan lookahead (`efek/musik.ts`), dan pola getar bernama dengan batas frekuensi (`POLA_GETAR`).
- Modul client `preferensi.ts` (preferensi per HP dengan normalisasi dan migrasi dari `remi.efek`), `gerak.ts` (durasi, easing, pegas, kurangi gerak), dan `versi.ts` (versi, commit, dan waktu build yang disuntik Vite).
- Design system CSS di `apps/client/src/gaya/` (token warna, tipografi, gerak, z-index; komponen; layar; meja; responsif) dengan font display Baloo 2 (OFL) yang di-host sendiri.
- Jendela dua tingkat di `ui/dom.ts`: modal utama untuk jendela permainan dan lapisan dialog bertumpuk (`bukaDialog`, `konfirmasi`) yang tidak pernah menimpa popup joker atau panel mentung. Fokus dikelola, latar dibuat `inert`, dan `tutupSemuaJendela()` saat meninggalkan layar.
- Konten Bantuan dan tutorial sebagai data (`apps/client/src/konten/`).
- Server: `GET /healthz` berisi `versi` dan `sha`, header `Cache-Control` (aset ber-hash `immutable`, sisanya `no-cache`, 404 `no-store`), `nosniff`, `Referrer-Policy`, dan balasan 400 untuk URL yang tidak valid.
- Build: Phaser dipisah jadi chunk sendiri, file `.br`/`.gz` dibuat setelah build (`apps/client/scripts/kompres.mjs`), dan server dibundel lengkap jadi satu `main.js` (`apps/server/scripts/bundel.mjs`).
- Dokumen `docs/baseline-gameplay.md` (perilaku aktual mesin dan meja), `docs/arsitektur-client.md` (peta modul client), `docs/riset-desain.md` (riset desain beserta status implementasinya), dan `docs/keputusan-pemilik.md` (hal yang menunggu keputusan pemilik).
- Skill Phaser 4 lokal di `.claude/skills` sebagai rujukan API untuk agent.

#### Diubah

- Client dimigrasikan dari Phaser 3 ke Phaser 4.2.1. `MejaScene` ditulis ulang: objek Phaser disamakan per kunci dengan hasil tata letak (rekonsiliasi) lewat objek data `ObjKartu`, bukan digambar ulang total. Tween hanya menyentuh objek data, jadi tidak pernah memanggil Image yang sudah dihancurkan.
- Phaser memakai `input.windowEvents: false` (mencegah klik tembus) dan `audio.noAudio: true` (tidak membuat AudioContext kedua). Loop Phaser ditidurkan saat meja tidak tampil.
- PWA memakai `registerType: 'prompt'` dengan toast versi baru, pengecekan update tiap jam, dan precache tanpa entri dobel. Manifest diberi `id` dan `categories`.
- Koneksi online: watchdog ping, sambung ulang cepat saat sinyal kembali atau tab terlihat lagi, status baru `gagal`, dan antrian saat terputus dibatasi (hanya buat/gabung/daftar, maksimal 8, kedaluwarsa 30 detik). Aksi permainan saat terputus dibuang dengan pemberitahuan. `keluar` tidak diantrikan karena koneksinya langsung ditutup; aplikasi mengecek `Koneksi.siapKirim()` dan memberi tahu pemain kalau pesannya tidak sampai. Protokol dan meja tidak berubah.
- `penyimpanan.ts` memeriksa bentuk setiap nilai (riwayat dan `urutanTangan` harus array, entri riwayat wajib punya klasemen array, sesi `{kode, token}` string). Nilai yang tidak cocok diganti bawaan dan kuncinya dihapus. Entri klasemen punya field opsional `bot`, diisi dari `InfoMeja.kursi`. Permainan online yang sudah dicatat diingat di `remi.riwayatTercatat` (20 terakhir; kunci: kode meja, jumlah putaran, skor, dan jejak tiap putaran tanpa info rahasia).
- Renderer markdown Tentang: tautan relatif dicek polanya dan hasil resolve URL-nya (menolak `//host` dan backslash), dan penanda tebal hanya diproses pada potongan teks, tidak pernah di dalam atribut `href`. CHANGELOG dipecah per versi lewat `bagiChangelog()`.
- Beranda: urutan DOM mengikuti urutan baca HP, dan dua kolom di desktop serta HP lanskap disusun dengan `grid-template-areas`.
- Koneksi offline: simpanan di-flush saat `pagehide` dan saat tab tersembunyi, timer dibersihkan saat ditutup, dan permainan berstatus selesai tidak ditulis ulang.
- `Dockerfile`: typecheck, test, lalu build; `ARG GIT_SHA` untuk commit; image runtime tanpa `npm install`.
- Versi semua workspace disamakan ke 0.2.0, dengan sumber tunggal di `package.json` root.
- `AGENTS.md` dan `README.md` diperbarui mengikuti struktur client baru, perintah test, dan alur rilis.

#### Diperbaiki

- Server tidak lagi mati karena URL request yang tidak valid.
- Dokumentasi client sekarang menyebut Phaser 4, tidak lagi Phaser 3.
- `npm test` tidak lagi kadang berakhir dengan "Errors 1" karena timer pelepas kelas `goyang` sesudah mentung jalan setelah env happy-dom dibongkar. `PemutarPeristiwa.hentikan()` membatalkan timer pemutar dan dipanggil `KontrolMeja.hancurkan()`, dan test `kontrolMeja` juga membatalkan timer yang masih menunggu di `afterEach`.

### Diketahui dan belum

- Belum diuji di HP fisik. Semua uji tampilan memakai Chrome desktop dengan emulasi HP. Belum dicek di Safari iOS (audio, PWA; getar memang tidak didukung iPhone), Chrome Android (getar, Back di PWA fullscreen, wake lock), dan pembaca layar sungguhan (TalkBack/VoiceOver).
- Siklus update service worker dari versi lama ke baru lewat HTTPS belum diuji sungguhan.
- `docker build` penuh dan job E2E CI di Linux belum pernah dijalankan dari mesin pengembang.
- Meja online masih hanya di memori server: restart atau deploy ulang membuang meja yang sedang berjalan.
- Bot normal masih cukup pasif.
- Beberapa hal menunggu keputusan pemilik dan sengaja belum diubah, misalnya label "→angka" pada joker pengganti, sub-teks sorakan JOKER DIBUANG?!, dan beberapa perilaku room (keluar sebelum OK joker, sambung ulang saat pengumuman joker). Daftar lengkapnya ada di `docs/keputusan-pemilik.md` dan tabel Aturan Terbuka README.

## [0.1.0] - 2026-10-12

Versi pertama (MVP) yang bisa dimainkan.

### Untuk pemain

#### Ditambahkan

- Remi dengan aturan tongkrongan Kedai Madya untuk 2 sampai 6 pemain: mulung, kartu jadi, joker dari kartu yang dibuka, mentung dan kepentung, balik arah atau lompat, susun akhir, dan skor akumulatif.
- Main offline lawan bot (level mudah dan normal, tempo santai, normal, atau cepat), jalan tanpa internet dan tersimpan otomatis.
- Main online: buat meja, undang pakai kode atau link, meja publik, kursi diisi orang atau bot, sambung ulang otomatis, dan bot menggantikan pemain yang terputus atau kehabisan waktu.
- Pengumuman joker sekali di awal putaran (mode ingatan), seperti di meja asli.
- Animasi kartu: ambil dari deck, buang, mungut, menurunkan kartu jadi, dan pentungan yang dibuka dramatis.
- Panel mentung yang menunjukkan siapa yang mentung, siapa yang kepentung, dan arah putaran berikutnya.
- Sorakan (MENTUNG!, SAPU BERSIH!, KEMBAR AS!, dan lainnya), emote, celetukan bot, suara, dan getar.
- Riwayat dan peringkat permainan online.
- Bisa dipasang ke layar utama HP (PWA).

### Teknis

#### Ditambahkan

- Monorepo TypeScript: rules engine murni dan deterministik (`packages/engine`), modul meja tanpa jaringan (`packages/meja`), server WebSocket (`apps/server`), dan client Phaser + PWA (`apps/client`).
- Test aturan termasuk contoh wajib dari dokumen aturan pemilik, simulasi 2.160 putaran bot-vs-bot, fuzz, test meja, dan test integrasi server.
- Test regresi joker 2 yang dipakai sebagai kartu aslinya di seri.
- Riwayat klasemen online di SQLite (`node:sqlite`) dan deploy Docker.
