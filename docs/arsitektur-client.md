# Arsitektur client (apps/client)

Peta modul client untuk yang mau mengubah tampilan, animasi, suara, atau layar. Ringkasan aturan kerjanya ada di [AGENTS.md](../AGENTS.md); dokumen ini menjelaskan **bagaimana** potongan-potongannya saling terhubung. Ditulis untuk kode rilis 0.2.0, lalu diperbarui untuk perubahan sesudahnya (terakhir 14 Okt 2026: bunyi dramatis, level warga kedai, pembaruan PWA, identitas build).

Client terdiri dari dua lapis:
- **HTML** untuk semua layar dan kontrol (beranda, lobi, bar atas, bar aksi, jendela).
- **Phaser 4.2.1** hanya untuk kanvas meja (kartu, panel lawan, animasi).

Keduanya tidak pernah menyimpan aturan main sendiri. Validasi selalu memanggil fungsi `@remi/engine` (`validasiBuang`, `validasiMulung`, `validasiTurunkan`, `validasiKartuJadi`, `opsiPeranJoker`, `maksimalMulung`).

## Alur data di meja

```
Koneksi (online: WebSocket / offline: Meja di browser)
   │  PesanServer { meja | view | emote | error | ... }
   ▼
main.ts (Aplikasi) ──► KontrolMeja.perbarui(info, view)
                           │ view diantrikan
                           ▼
                     putarAntrian(): untuk tiap peristiwa baru
                           │  PemutarPeristiwa.putar(e)  (efek/pemutar.ts)
                           │     ├─ scene.terbang / naikPanggung / pentung / bagiKartu ...
                           │     ├─ bunyi() / getar() / sorak()
                           │     └─ terapkanViewBerikut(sembunyi)  (posisi tujuan)
                           ▼
                     tampilkan(view) → render() → MejaScene.pasang(ModelMeja)
                                                     │ hitungTataMeja() (tataMeja.ts, murni)
                                                     ▼
                                               update(): rekonsiliasi objek per kunci
```

- **View diantrikan.** Peristiwa baru diputar dulu (animasi, sorakan, panel mentung), baru view-nya ditampilkan. Selama antrian berjalan tombol aksi dikunci.
- **View pertama** (baru masuk atau sambung ulang) tidak memutar ulang kejadian lama, kecuali kocok & bagi putaran yang baru dimulai (`peristiwaAwalPerluDiputar`).
- **Popup joker** dibuka setelah antrian habis (`bukaJokerBilaPerlu`), jadi kocok & bagi terlihat dulu.
- **Kirim aksi:** bar aksi dikunci sampai view berikutnya datang atau `BATAS_AKSI_MS` (3 dtk). Tombol modal hasil memakai `BATAS_KIRIM_MS` (6 dtk).

## Kanvas meja (`src/game/`)

| File | Isi |
|---|---|
| `game.ts` | Membuat `Phaser.Game` sekali: ukuran layar × dpr lalu zoom `1/dpr`, `input.windowEvents: false`, `activePointers: 2`, `audio.noAudio: true`, pointer capture untuk mouse. `tidurkanGame`/`bangunkanGame` menghentikan loop saat meja tidak tampil. Mode dev: `window.__remi = { game, adegan }`. |
| `tataMeja.ts` | **Fungsi murni** `hitungTataMeja()`: `ModelMeja` + ukuran layar → daftar kartu, teks, hiasan, titik, dan area (piksel perangkat). Tanpa Phaser, bisa dites. Lapis kedalaman ada di `LAPIS`. Lebar teks diperkirakan `kiraLebarTeks()` (pembagi ruang, boleh meleset; scene tetap memotong lewat `pasTeks`), kecuali label nama pembuang di bawah buangan: `labelSempit()` memakai `kiraLebarLabel()` (kelas lebar huruf hasil ukur Chromium, tidak pernah lebih sempit dari aslinya, data ukurnya di `apps/client/test/data/lebarHuruf.ts`) dan mengecilkan inisial sampai `UKURAN_MIN_LABEL_BUANGAN` (9 px CSS) sebelum menyembunyikannya. |
| `MejaScene.ts` | Menyamakan objek Phaser dengan hasil tata letak **per kunci** (rekonsiliasi). Input (ketuk, seret, hover), primitif animasi (`terbang`, `naikPanggung`/`turunPanggung`, `pentung`, `bagiKartu`, `skorMelayang`, `rayakan`, `percik`, `tolak`), `kotakLayar()` untuk tutorial, `aturRuang()` dari tinggi bar HTML. |
| `kartuGrafisGambar.ts` | Gambar kartu Canvas 2D murni (tanpa Phaser): muka, punggung, desain mini, mode 2/4 warna, bayangan, sorot. `gambarKartuKeKanvas()` dipakai layar HTML (popup joker, panel mentung, Bantuan, beranda). |
| `kartuGrafis.ts` | Tekstur Phaser dari gambar di atas: satu kunci per kartu dalam tingkat mini/normal/besar (`kunciKartu()`), `KUNCI_BAYANGAN`, `KUNCI_SOROT`, `KUNCI_FOKUS`, ganti warna di tempat (`daftarkanTeksturKartu(..., { ulang: true })`), pemanasan tekstur bertahap (`panaskanTeksturKartu`). |
| `warnaMeja.ts` | Palet kanvas dibaca dari token CSS (`gaya/token.css`), dengan nilai cadangan. |

**Rekonsiliasi dan `ObjKartu`.**
- `pasang()` langsung menghitung tata letak, jadi `posisiKartu()`, `posisiPemain()`, dan `kotakLayar()` sudah benar segera setelahnya. Penggambaran sendiri digabung dan baru terjadi di `update()` frame berikut.
- Tiap kartu adalah `ObjKartu`: objek data (x, y, w, sudut, skala, tinggi, alpha, efek) yang disalin ke Image, bayangan, cincin, dan label setiap frame (`sinkron()`).
- **Tween kartu hanya menyentuh `ObjKartu` atau `ObjKartu.efek`**, tidak pernah Image-nya langsung. Image yang sudah dihancurkan tidak akan pernah dipanggil tween (penyebab crash loop di Phaser 4).
- Kartu yang berpindah slot meluncur dengan pegas (`easePegas`). Kartu yang sedang diseret (`dikunci: 'seret'`) atau menunggu di titik lepas buangan (`'lepas'`) tidak diatur tata letak.
- Kartu yang dilepas di buangan memanggil `KontrolMeja.lepasKeBuangan(id)`: `'abaikan'` = kembali tanpa goyang (aksi sebelumnya masih menunggu jawaban), `false` = ditolak, kembali dengan goyang. Biasanya yang dibuang kartu yang diseret saja. Kalau kartu itu ikut pilihan yang mencakup seluruh tangan (2+ kartu), artinya nutup pakai semuanya (#41, kartu yang diseret jadi `kartuId`); yang tidak sah ditolak, tidak diam-diam jadi buang satu kartu.

**Animasi.**
- Semua primitif animasi mengembalikan Promise yang **selalu resolve**: helper `tw()` memasang timeout cadangan dari durasi tween, `pentung` dan `bagiKartu` punya cadangan total (6,5 dtk + 0,4 dtk per kartu pentungan tambahan, dan 6 dtk), dan `KontrolMeja` membungkus kocok & bagi dengan `denganBatas(…, BATAS_BAGI_MS)`.
- `pentung(daftar: { kartu, dari? }[], nilai, merah, saatDibuka?)` menerima **semua** kartu pentungan (keputusan #41, nutup pakai beberapa joker): kartunya dibuang tertutup ke panggung dan berjajar, bergetar dan dibalik bersamaan, `saatDibuka` dipanggil sekali, satu label nilai total, lalu berangkat ke buangan bergiliran. Satu kartu = gerak lama persis. Pemutar (`efek/pemutar.ts`) mengambil kartunya dari peristiwa `mentung` (`pentungan` + `pentunganLain`), asal tiap kartu dari titik lepas seret atau posisinya di tanganku.
- `retakPanel(pemain, { benih, kuat })`: kursi lawan yang kepentung (dipanggil pemutar sesudah pentungan terbuka) dapat rona merah + retakan kecil di panelnya (tekstur kanvas sendiri dari `polaRetak`/`gambarRetak` di `efek/retak.ts`, kedalaman di bawah kartu yang dianimasikan), kartu jadi di panel itu tersentak lewat `goyang()`, lalu pudar dan teksturnya dibuang (cadangan waktu). Gerak dikurangi: tanpa goyang.
- Saat `document.hidden` atau scene tidak aktif, animasi langsung selesai (`bisaAnimasi()`).
- Kartu yang sedang dianimasikan dimasukkan ke `disembunyikan`. Kartu itu tetap memesan tempat di tata letak, jadi `posisiKartu(id)` bisa jadi tujuan terbang. Kartu tangan yang tersembunyi juga tetap bisa disorot dan dipilih keyboard (`KontrolMeja.deretBawah()`), supaya panah yang ditekan selagi kartu dibagi tidak tersangkut di deck/buangan.
- View baru selalu dipasang lewat `KontrolMeja.pasangView()`, baik di tengah animasi (`terapkanViewBerikut`) maupun sesudahnya. Kalau nomor putaran berganti, pilihan kartu, mulung, dan sorotan keyboard putaran lalu dibuang saat itu juga, bukan menunggu `tampilkan()`.
- Durasi yang diberikan pemutar adalah durasi **dasar**; scene mengalikannya lewat `durasi()` dari `gerak.ts`.

## Jendela HTML (`src/ui/dom.ts`)

Ada dua tingkat jendela:

| Tingkat | Fungsi | Dipakai untuk |
|---|---|---|
| Modal utama (`#modal`) | `bukaModal`, `tutupModal` | Jendela permainan: popup joker, panel mentung, hasil putaran, klasemen, menu ☰. Satu slot, membuka yang baru mengganti yang lama. `bisaDitutup: false` = wajib (tidak tertutup Escape/ketuk latar). |
| Lapisan dialog (`#lapisan-dialog`) | `bukaDialog`, `konfirmasi`, `tutupDialogTeratas` | Pengaturan, Bantuan, Tentang, konfirmasi, Skor, Log, Pintasan, pilihan peran joker. Bisa bertumpuk, **tidak pernah menimpa modal utama**. |

- **Wajib `bukaDialog`/`konfirmasi`** untuk jendela yang bisa dibuka kapan saja (Pengaturan, Bantuan, konfirmasi). Kalau memakai `bukaModal`, popup joker atau panel mentung yang sedang menahan antrian animasi akan tertimpa dan permainan macet.
- Keduanya mengatur fokus: fokus masuk ke jendela, Tab berputar di dalamnya, Escape menutup jendela teratas yang boleh ditutup, dan fokus kembali ke pemicunya. Selama ada jendela, `#ui` dibuat `inert`.
- `tutupSemuaJendela()` dipanggil saat meninggalkan layar (misalnya `KontrolMeja.hancurkan()`), supaya tidak ada dialog basi yang membuat layar berikutnya tidak bisa disentuh.
- `toast()` (dengan tombol aksi opsional) dan `umumkan()` (live region tersembunyi untuk pembaca layar) juga ada di sini.

## Preferensi dan gerak

- `preferensi.ts`: preferensi per HP di `localStorage` `remi.preferensi` (suara, volume efek, musik, volume musik, getar, gerak, kecepatan, efek lengkap/hemat, kartu 2/4 warna, ukuran teks, tutorial selesai). Semua dinormalkan; simpanan lama `remi.efek` ikut terbaca. `pasangPreferensi()` memasang atribut `data-gerak`, `data-efek`, `data-warna-kartu`, `data-teks` di `<html>` dan mengikuti `prefers-reduced-motion`.
- `gerak.ts`: token durasi (`DURASI`) dan easing (`EASE`) yang sama dengan token CSS `--durasi-*`/`--ease-*`, `durasi(ms)` (ikut kecepatan), `kurangiGerak()`, `efekHemat()`, dan `easePegas()`.
- Gerak dikurangi tidak memperlambat: animasi dipendekkan, busur/putaran/goyang/partikel dihilangkan, dan sorakan hanya memudar (CSS).

## Suara, musik, getar (`src/efek/`)

| File | Isi |
|---|---|
| `mesinAudio.ts` | Satu `AudioContext`: bus efek dan bus musik → master → limiter. Volume ikut preferensi (kurva kuadrat), unlock lewat gestur (termasuk iOS), di-suspend saat tab tersembunyi atau suara dan musik mati. |
| `sintesis.ts` | Primitif bunyi murni (gesek, ketuk, bilah, kendang, gong, petik) dari osilator dan derau yang di-cache. Untuk momen dramatis: `desir` (riser), `dentum`, `kecrek`, `rentetDerau`/`rentetNada` (gulungan dengan satu sumber per lapisan, bukan satu node per pukulan), `tiup` (nada rendah ala kuningan), dan `buatAula` (gema dari empat jalur tunda berumpan balik; sengaja bukan ConvolverNode yang mahal disiapkan di HP). Tanpa file audio. |
| `suara.ts` | API publik: `bunyi(jenis)`, `getar(pola)`, `POLA_GETAR`, `getarDidukung()`, `siapkanAudio()`. Ada batas frekuensi per jenis dan polifoni. Bunyi dramatis: `tegang` (gulungan sebelum pentungan dibuka, dipotong `mentung`/`mentungJoker` lewat `MEMOTONG`), `mentungJoker` (hanya sesudah pentungan joker terbuka), `kepentung`/`kepentungLain` (saat panel mentung tampil), `jotos` (pukulan untuk yang kepentung: dentum berat, retak kaca, serpih berdenting; getar `kepentung` ikut di sini) dan `jotosLain` ("buk" pelan per kursi lain yang kena) yang baru diputar sesudah pentungan terbuka, dan `jokerDibuang` (dulu `joker`). Bunyi besar memakai gema aula (`PAKAI_AULA`) dan meredam musik (`REDAM_MUSIK`). `rekamBunyi` bisa merekam satu bunyi atau rangkaian secara offline untuk mengukur level. |
| `musik.ts` | Musik latar generatif (bawaan mati), dijadwalkan dengan lookahead; `suasanaMusik('beranda' \| 'meja' \| 'diam')`. `redamMusik(tingkat, lama)` mengecilkan musik sebentar lewat node peredam antara fader dan bus musik (terpisah dari fader supaya tidak saling timpa). |
| `pemutar.ts` | Peristiwa → animasi, teks aksi di panel, bunyi, getar, sorakan. Kepentung: `JEDA_JOTOS` sesudah pentungan terbuka, yang kena dapat `jotos()` (lapisan HTML), panel kursi lain yang kena `scene.retakPanel()` bergiliran (`JEDA_RETAK_PANEL`). |
| `retak.ts` | "Ketonjok" saat kepentung: `polaRetak()` (pola retakan kaca murni dan deterministik per benih) + `gambarRetak()` (Canvas 2D), `jotos()` (sentakan kamera `body.jotos`, kilat, layar retak dari dekat tangan, serpih; lapisan `#retak` tanpa sentuhan, dibuang sendiri sesudah `durasi()`), `retakkanStatus()` (retakan samar di "Kamu KEPENTUNG" + lama animasi `hantam`), `bersihkanRetak()` (dipanggil `PemutarPeristiwa.hentikan()`). `#retak` anak `#ui` (z `--z-retak` di dalam konteks tumpukan `#ui`): menutupi meja dan bar, tapi di bawah coach mark tutorial, palet emote, dan gelembung emote/celetukan; seluruh `#ui` di bawah modal (popup joker, panel mentung), sorakan, dialog, dan toast. Lama animasi CSS-nya (kilat, retakan menjalar, serpih, `hantam`) diisi dari `durasi()` lewat variabel `--*-lama`. Gerak dikurangi: retakan diam lalu pudar; efek hemat: tanpa kilat/serpih. |
| `sorak.ts` | Sorakan besar di tengah layar, antrian maksimal 3, `aria-hidden`. |

## Layar dan konten

- `main.ts`: kerangka aplikasi (pindah layar, tombol Back lewat penjaga `history`, wake lock, PWA `registerSW`, status koneksi, permainan latihan). Kapan versi baru dicek dan dipasang diputuskan `pembaruan.ts` (fungsi murni `momenPembaruan()`/`putuskanPembaruan()`, `serverBeda()` untuk mencocokkan id build dengan `/healthz`, `PemicuCekServer` untuk cek paksa di setiap sambungan yang berhasil); `main.ts` hanya merangkainya. Jembatan untuk client 0.1.x ada di `public/sw-transisi.js`.
- `ui/beranda.ts` (urutan DOM = urutan baca HP; dua kolom desktop/lanskap lewat `grid-template-areas` di `layar.css`), `ui/lobi.ts`, `ui/riwayat.ts` (termasuk tab Statistik; leaderboard v2: kontrol urutan/saringan dibuat sekali dan hanya `#hasil-peringkat` yang diganti, ganti urutan mengurutkan ulang di HP lewat `urutkanPeringkat` dari `@remi/meja`, ganti saringan mengambil ulang `/api/peringkat?v=2&…`, server lama yang menjawab array tampil cara lama), `ui/pengaturan.ts`, `ui/bantuan.ts`, `ui/tentang.ts` (versi + CHANGELOG lewat renderer markdown aman; per versi hanya bagian "Untuk pemain", bagian teknis dilipat tertutup, versi kosong disembunyikan), `ui/tutorial.ts` (gelembung latihan yang dipicu keadaan meja nyata), `ui/rincianSkor.ts`. `ui/kompetisi.ts` (keputusan #51): daftar, detail + klasemen, Ikut serta, Buat meja kompetisi, voting sudahi, dan formulir pengajuan, semuanya dari `/api/kompetisi`; tiket peserta dari `simpan.tiketKompetisi()` dikirim lewat header `x-tiket-kompetisi` dan ikut pesan `gabung`. `ui/usulan.ts` (Usul fitur, 24 Okt 2026, teks di `konten/usulan.ts`): dialog lewat `bukaDialog`, dibuka dari ubin menu beranda (sesudah `pastikanNama()`) dan dari Tentang yang dibuka di beranda (`bukaTentang({ usulFitur })`; dari menu ☰ meja tanpa tombol itu). Isian diperiksa `periksaUsulan()` dari `@remi/meja` (sama dengan server) lalu dikirim ke `POST /api/usulan`; tulisan yang belum terkirim disimpan di memori modul selama aplikasi terbuka, begitu juga pengiriman yang sedang jalan (`kirimanJalan`): dialog yang ditutup selagi mengirim lalu dibuka lagi menunggu pengiriman yang sama dengan Kirim terkunci, tidak mengirim dua kali.
- `konten/bantuan.ts` (bab, FAQ, glosarium) dan `konten/tutorial.ts` (teks langkah latihan) adalah **data**. Isinya harus sesuai engine dan README; contoh kartu yang ditandai sah/tidak sah harus memberi hasil yang sama dengan validator engine; dijaga `apps/client/test/kontenAturan.test.ts`, yang gagal kalau satu contoh tidak cocok.
- `konten/levelWarga.ts`: label dan keterangan level warga kedai (Mudah, Normal, Jago, Suhu), satu sumber untuk Atur meja di beranda, kursi di lobi, dan Bantuan. Jago dan Suhu sengaja tanpa keterangan (keputusan pemilik). Level yang tidak dikenal versi ini (misalnya dari server yang lebih baru) tetap tampil sebagai warga kedai.
- `konten/kompetisi.ts`: teks layar Kompetisi dan lobi meja kompetisi. Isinya harus sesuai `packages/meja/src/kompetisi.ts` (keputusan #51); dijaga `antislop.test.ts` dan `kompetisi.test.ts`.
- `konten/peringkat.ts`: teks leaderboard (label urutan, penjelasan, "Cara hitungnya", catatan). Isinya harus sesuai aturan hitung di `packages/meja/src/peringkat.ts` (keputusan #45); dijaga `antislop.test.ts` dan `riwayat.test.ts`.
- `konten/kaldu.ts`: teks mode kaldu (keputusan #42, #43), satu sumber untuk kotak centang di Atur meja (`ui/beranda.ts`) dan lobi (`ui/lobi.ts`), Bantuan, dan teks pendek di meja (`kontrolMeja.ts`, `ui/rincianSkor.ts`); dijaga `antislop.test.ts`. Di meja: `teksBarAtas(jenis, nomor, batas, kaldu)` ("Putaran 6 · Kaldu", tanpa "/batas"), judul popup joker, tombol `[data-kaldu]` "Putaran terakhir" di modal hasil (`keadaanKaldu()`, `tandaiKirim('kaldu')`, meniru tombol Akhiri dan diperbarui di tempat lewat `perbaruiModalHasil`/`perbaruiTombolVoting`), baris `[data-info-kaldu]` dari `teksInfoKaldu(view, hasil)`, dan lencana di panel mentung. Semuanya dari info publik (`konfigurasi.modeKaldu`, `putaran.kaldu`, `kalduDiminta`, `HasilPutaran.kaldu`, `InfoMeja.setujuKaldu`) dan syaratnya dari `putaranBerikutKaldu()` engine, tidak dihitung ulang. Isian batas skor (`.isian-batas-skor`) disembunyikan selama Mode kaldu dicentang, tapi angkanya tetap disimpan; `Meja.mulai()` yang mengirim batas skor `null` ke engine. Pengaturan latihan (`PENGATURAN_LATIHAN`, selalu tanpa kaldu) ada di `konten/tutorial.ts`.
- `konten/kedai.ts`: info Kedai Madya (bio, alamat, tautan) untuk kartu kedai di beranda, bagian Kedai Madya di Tentang, dan baris ajakan di klasemen akhir (`KontrolMeja.htmlAjakanKedai`, tidak tampil di latihan). Hanya fakta terverifikasi, tanpa jam/menu/harga/rating/telepon. `aset/logoMadya.ts`: logo sebagai path SVG (`svgLogo()` untuk HTML, `pathLogo()` untuk Canvas).
- `ui/lobi.ts` juga memegang `opsiKonfirmasiKeluar()`, satu sumber teks konfirmasi keluar untuk lobi, menu meja, dan tombol Back (`main.ts`).
- `ui/batasSkor.ts`: isian batas skor (keputusan #44) untuk Atur meja dan lobi. `htmlIsianBatas()` (dua isian angka, atau teks untuk yang bukan host, dibungkus `.isian-batas-skor`), `pasangIsianBatas()` (dirapikan dan dilaporkan sekali saat isian ditinggalkan), `bacaIsianBatas()`, dan `lepasIsianBatas()` (dipanggil sebelum lobi digambar ulang). Pembulatan dan validasinya dari `@remi/meja` (`rapikanBatasSkor`, `batasSkorSah`), jangan ditulis ulang di UI.
- Tawaran pasang aplikasi (keputusan #46), hanya di beranda:
  - `pasangAplikasi.ts` (murni, dites di Node): `caraPasang()` dari user agent + `isSecureContext` + `sedangTerpasang()` + ada/tidaknya `beforeinstallprompt` (`prompt`/`ios`/`android`/`inapp`/null), `keadaanPasang()` (null, atau `{ cara, melayang }` sesudah tunda "Nanti saja" 3 hari dan tanda "Sudah kupasang"), transisi `tundaPasang`/`tandaiSudahPasang`/`lupakanSudahPasang`/`sesudahPrompt` (hasil `userChoice`), `nilaiTerpasang()` (display-mode fullscreen vs layar penuh dari menu meja: dipakai nilai sebelum layar penuh), dan `perangkatApel()` (dipakai juga `efek/mesinAudio.ts`). Hanya `bacaLingkunganPasang()`/`sedangTerpasang()` yang membaca browser; `main.ts` memanggil `sedangTerpasang()` sekali saat mulai.
  - `main.ts` merangkai: event `beforeinstallprompt`/`appinstalled`/`display-mode`, `tawaranPasang()` untuk `renderBeranda`, `segarkanPasang()` (hanya di beranda), dan `jalankanPasang()` (prompt browser lalu `userChoice`, atau dialog).
  - `ui/beranda.ts` `aturPasang()`: ubin menu + `<aside class="pasang-melayang">` sebagai anak terakhir `.layar.beranda` (di luar grid, ikut `inert`, hilang bersama `#ui`), tanpa menggambar ulang. Beranda yang memuat kartu "Warga baru, ya?" tidak memasang tombol melayang (ubin saja). `ui/pasang.ts`: dialog petunjuk lewat `bukaDialog` (iPhone/iPad, Android, browser bawaan aplikasi dengan Salin link); teksnya di `konten/pasang.ts`. Simpanan `remi.tawaranPasang` di `penyimpanan.ts`.
- `ui/rincianSkor.ts` memegang konvensi angka: `tanda()` (+12/−7), `angkaSkor()` (−7), `minusTipografis()` untuk teks dari engine. Minus selalu U+2212.
- `ui/tutorial.ts` `tataGelembung()`: penuh → ringkas → ringkas sempit (480/420/360/300 px) → ringkas satu baris → posisi yang paling sedikit menutupi tangan/tombol → tepi. Kandidat posisi termasuk samping sasaran rata atas (pita di antara bar atas dan tangan di HP lanskap).
- `koneksi.ts`: `KoneksiOnline` (backoff, watchdog ping, antrian terbatas untuk buat/gabung/daftar (`keluar` tidak diantrikan; `main.ts` mengecek `siapKirim()` dan memberi tahu pemain kalau tidak sampai), status `menyambung`/`tersambung`/`terputus`/`gagal`), `KabarKoneksi` (fungsi murni: kapan pemain dikabari putus/gagal/pulih, sekali per putus; dipakai toast di `main.ts` dan pembaca layar di `kontrolMeja.ts`) dan `KoneksiOffline` (kelas `Meja` di browser, simpan debounce + flush saat `pagehide`/tab tersembunyi).
- `penyimpanan.ts`: `localStorage` lewat `simpan`. Setiap kunci punya pemeriksa bentuk: nilai yang JSON-nya sah tapi bentuknya salah diganti bawaan dan kuncinya dihapus. `catatanDariView()` (klasemen + tanda bot) dan `kunciPermainan()` (penanda permainan online yang sudah dicatat) dipakai `main.ts` supaya riwayat tidak dobel saat reload.
- `versi.ts`: `VERSI`, `BUILD_SHA`, `BUILD_WAKTU` dari `define` di `vite.config.ts`; `labelVersi()` tampil di beranda dan Tentang. `BUILD_SHA` = identitas build dari `scripts/idBuild.mjs` (commit, atau `h-` + hash isi, atau `dev` di dev server), sama dengan `sha` di `/healthz`.
- Gaya: `gaya.css` hanya `@import` ke `gaya/` (token, dasar, komponen, layar, meja, gerak, responsif), plus `jendela.css` dan `tutorial.css` yang diimpor modulnya sendiri.

## Info rahasia di client

Berlaku untuk **semua kanal**: kanvas, HTML, log, sorakan, `aria-label`, `umumkan()`, tutorial, bunyi, dan getar.
- Angka joker hanya di popup joker. Jangan membaca `putaran.rankJoker`/`kartuDibuka` untuk tampilan lain (dijaga `apps/client/test/pemutar.test.ts`).
- Joker di tangan tidak diberi penanda apa pun, termasuk bunyi atau getar yang berbeda. Joker yang sudah publik boleh berbunyi sendiri: `jokerDibuang` saat dibuang, `mentungJoker` sesudah pentungan terbuka; `tegang` sebelum dibuka sama untuk pentungan apa pun, juga berapa pun kartunya (dijaga `apps/client/test/suaraDramatis.test.ts`).
- Nutup pakai beberapa joker (#41): `KontrolMeja.statusTombol()` hanya memanggil `validasiBuang` untuk kartu yang **dipilih pemain** (satu kartu, atau beberapa lewat `kartuIdLain`). Penanda "tinggal satu kartu: buang untuk mentung" tetap hanya dari buang satu kartu. Seluruh tangan tidak pernah dicoba sebagai nutup beberapa kartu sebelum pemain memilih, karena hasilnya membocorkan apakah sisa kartunya joker semua (dijaga test kebocoran di `apps/client/test/kontrolMeja.test.ts`). Label tombol untuk 2+ kartu: "Mentung pakai N kartu!" kalau sah, "Buang N kartu" (mati, alasannya dari engine) kalau tidak; tidak pernah menyebut joker.
- Tidak ada peringatan atau saran kartu berbahaya.
- Pengumuman pembaca layar tidak menyebut kartu yang dibuang lawan, dan buangan hanya (jumlah pemain − 1) kartu teratas.
- Penanda warga kedai (☕ di panel kanvas, label "(warga kedai)" di `umumkan()` giliran dan celetukan) hanya bergantung pada jenis kursi. Sumbernya `PENANDA_WARGA_KEDAI` di `game/tataMeja.ts`.
- Keputusan pemilik soal tampilan joker dan buangan (label "→rank" dan sub-teks JOKER DIBUANG?! dipertahankan, teks aksi buang cukup "buang kartu") ada di [keputusan-pemilik.md](keputusan-pemilik.md) #27–#29. Jangan diubah tanpa izin pemilik.

## Test client

- Test ada di `apps/client/test/`. Baris pertama `// @vitest-environment happy-dom` kalau butuh DOM, `localStorage`, atau `matchMedia`; tanpa baris itu test jalan di Node.
- Helper `apps/client/test/bantu.ts`: `mainkanBot()` (permainan bot-vs-bot deterministik), `pasangMatchMediaPalsu()`, `pasangLocalStorageRusak()`.
- Modul ber-cache (`preferensi.ts`): `vi.resetModules()` lalu `await import(...)` di tiap test. Untuk `localStorage` happy-dom pakai `vi.stubGlobal`, bukan `vi.spyOn(Storage.prototype, ...)`.
- `MejaScene` (WebGL) tidak dites dengan Vitest. Perilakunya dicek lewat E2E smoke (`npm run e2e`) dan uji Playwright manual.
