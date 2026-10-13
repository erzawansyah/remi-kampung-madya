# AGENTS.md: petunjuk untuk agent/sesi yang mengubah proyek ini

**Remi Kampung Madya**: game kartu remi dengan aturan yang berlaku di Kedai Madya (tempat pemilik dan teman-temannya berkumpul), yaitu **aturan tongkrongan** lokal yang **berbeda dari remi/rummy umum**. Monorepo TypeScript: rules engine murni, modul meja/room, server WebSocket, dan client Phaser 4.2.1 + HTML + PWA.

Baca [README.md](README.md) dulu, terutama bagian **Ringkasan aturan** dan **Aturan Terbuka dan keputusan**. Keduanya sumber kebenaran soal aturan main. Hal yang masih menunggu keputusan pemilik dirinci di [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md): **jangan diubah** sebelum pemilik memutuskan.

## Aturan emas

1. **Jangan mengarang aturan.** Aturan hanya datang dari pemilik proyek.
   - Situasi yang belum tercakup: tanyakan ke pemilik, atau jadikan opsi dengan default yang jelas.
   - Catat di tabel Aturan Terbuka di README.
   - Jangan pakai aturan remi umum dari pengetahuanmu.
   - Menemukan dugaan bug aturan saat mengerjakan hal lain: laporkan, jangan langsung diperbaiki.
2. **Jangan menyederhanakan atau menghapus aturan** demi kemudahan implementasi tanpa izin.
3. **Setiap perubahan aturan wajib disertai unit test,** dan README (ringkasan + tabel Aturan Terbuka) diperbarui.
4. **Bahasa:**
   - UI, pesan error, dan komentar kode memakai Bahasa Indonesia gaya tongkrongan yang ramah, misalnya "Modalnya kurang, Bos."
   - Istilah domain memakai glosarium: bunga (Love/Wajik/Kriting/Waru), Londo, joker, kartu jadi, modal, mulung/mungut, mentung/nutup, pentungan, kepentung, lompat, putaran.
   - Pemain komputer di **teks UI** disebut **warga kedai** (keputusan pemilik), bukan "bot". Di kode, protokol (`jenis: 'bot'`), id elemen (`#mulai-bot`, `#isi-bot`), dan dokumen teknis tetap `bot`.
   - Antislop: hindari pola "Kami X, bukan Y", "bukan sekadar", "lebih dari sekadar", dan klise promosi. Sapaan khas kedai ("warga", "kak", "madhang", "ndak papa") dipakai hemat.
   - Istilah teknis Inggris (state, view, endpoint, dll.) dibiarkan apa adanya.

## Perintah

```bash
npm install
npm test             # semua test (~20 detik): engine, simulasi 2.160 putaran bot-vs-bot, golden, meja, server, client
npm run test:client  # hanya test client (happy-dom), ±4 detik
npm run typecheck    # engine, meja, server, client (termasuk apps/client/test)
npm run dev:server   # server WebSocket :2567 (tsx watch)
npm run dev:client   # Vite :5173 (strictPort), /ws dan /api diteruskan ke :2567
npm run build        # build client (PWA + .br/.gz) + bundel server
npm run e2e          # E2E smoke di Chrome sistem (build + vite preview, HP & desktop)
docker compose up -d --build   # produksi; Dockerfile menjalankan typecheck + test + build
```

- `npm run e2e` tidak mengunduh browser. Kalau Chrome tidak ketemu otomatis, set `CHROME_PATH`. Opsi: `-- --url=http://localhost:5173` (uji dev server), `-- --perangkat=hp`, `-- --tanpa-build`, `-- --tampil`.
- Pekerjaan dianggap selesai kalau `npm test` dan `npm run typecheck` lolos. Perubahan client juga dicek di browser sungguhan (Vite dev atau `npm run e2e`); jangan klaim uji yang tidak dijalankan.

## Struktur dan batas lapisan

| Paket | Isi | Boleh bergantung pada |
|---|---|---|
| `packages/engine` | Rules engine **murni & deterministik** (RNG di-seed, state di `GameState.rng`). Validasi, skor, bot, view. | Tidak ada (tanpa DOM, tanpa Node API) |
| `packages/meja` | Satu meja/room: kursi, host, bot, timer giliran, sambung ulang, voting, pengumuman joker. **Tanpa jaringan.** Waktu lewat `Penjadwal`. Dipakai server **dan** mode offline di browser. | engine |
| `apps/server` | HTTP + WebSocket (`ws`) tipis. Memetakan sambungan → `pemainId` → `Meja`. Riwayat SQLite, `/healthz`, header cache. | engine, meja |
| `apps/client` | Phaser 4 (kanvas meja) + HTML (beranda, lobi, bar, jendela). | engine, meja |

**Di mana mengubah apa:**
- **Aturan main:** `packages/engine/src/kartuJadi.ts` (seri/kembar/joker), `giliran.ts` (validasi mulung/turunkan/buang), `mesin.ts` (alur, mentung, skor putaran), `skor.ts`.
  - Fungsi di `giliran.ts` dipakai bersama oleh mesin, bot, dan UI. Ubah aturan di sana, **jangan** menduplikasi logika aturan di UI.
- **Perilaku room/online:** `packages/meja/src/meja.ts` dan `protokol.ts`.
  - Pesan dari jaringan divalidasi di `validasi.ts`. Tambah case di sana setiap ada pesan baru.
- **Client** (peta lengkap: [docs/arsitektur-client.md](docs/arsitektur-client.md)):
  - **Tata letak meja:** `game/tataMeja.ts`, fungsi **murni** (tanpa Phaser) yang mengubah `ModelMeja` + ukuran layar jadi daftar kartu/teks/hiasan beserta posisinya.
  - **Kanvas meja:** `game/MejaScene.ts` menyamakan objek Phaser dengan hasil tata letak **per kunci** (rekonsiliasi), lewat objek data `ObjKartu`. Input, seret, dan primitif animasi (`terbang`, `naikPanggung`, `pentung`, `bagiKartu`, ...) ada di sini.
  - **Gambar kartu:** `game/kartuGrafisGambar.ts` (Canvas 2D murni, juga untuk kartu di HTML lewat `gambarKartuKeKanvas`) dan `game/kartuGrafis.ts` (tekstur Phaser mini/normal/besar, bayangan, sorot, fokus). Palet kanvas dari token CSS: `game/warnaMeja.ts`.
  - **Alur meja HTML:** `kontrolMeja.ts` (bar atas, bar aksi, keyboard, jendela, antrian animasi). Animasi, sorakan, bunyi, dan getar per peristiwa: `efek/pemutar.ts` dan `efek/sorak.ts`.
  - **Suara/musik/getar:** `efek/suara.ts` (API `bunyi`, `getar`, `POLA_GETAR`), `efek/mesinAudio.ts` (AudioContext, bus, limiter, unlock), `efek/sintesis.ts`, `efek/musik.ts`.
  - **Preferensi dan gerak:** `preferensi.ts` (simpan, normalkan, migrasi `remi.efek`, atribut `data-*` di `<html>`) dan `gerak.ts` (`DURASI`, `EASE`, `durasi()`, `kurangiGerak()`, `efekHemat()`, `easePegas()`). Token CSS padanannya di `gaya/token.css`; ubah keduanya bersamaan.
  - **Jendela:** `ui/dom.ts`, dua tingkat. `bukaModal` = modal utama untuk jendela permainan (popup joker, panel mentung, hasil, menu). `bukaDialog`/`konfirmasi` = lapisan di atasnya. **Pengaturan, Bantuan, Tentang, dan konfirmasi wajib lewat `bukaDialog`/`konfirmasi`** supaya tidak menimpa popup joker atau panel mentung yang sedang menahan antrian.
  - **Layar:** `main.ts` (kerangka, Back, PWA, latihan) dan `ui/` (beranda, lobi, riwayat, pengaturan, bantuan, tentang, tutorial, rincianSkor).
  - **Konten:** `konten/bantuan.ts` dan `konten/tutorial.ts` adalah data. Isinya **harus sesuai engine dan README**; contoh kartu yang ditandai sah/tidak sah harus memberi hasil yang sama dengan validator engine (dijaga `apps/client/test/kontenAturan.test.ts`). Aturan berubah → konten ikut diperbarui.
  - **Kedai Madya:** `konten/kedai.ts` = satu sumber info kedai (bio, alamat, tautan peta/IG/Threads/Rak Buku). Logo di `aset/logoMadya.ts` (`svgLogo()` inline SVG `fill=currentColor` untuk HTML, `pathLogo()` untuk Canvas); jangan tambah file gambar. Lihat bagian "Promosi Kedai Madya" di bawah.
  - **Konfirmasi keluar meja:** teksnya satu sumber, `opsiKonfirmasiKeluar()` di `ui/lobi.ts`, dipakai tombol di lobi, menu ☰ meja, dan tombol Back (`main.ts`). Jangan menulis teks konfirmasi keluar sendiri di tempat lain.
  - **Angka negatif:** minus tipografis "−" (U+2212) lewat `tanda()`/`angkaSkor()`/`minusTipografis()` di `ui/rincianSkor.ts`, bukan tanda hubung ASCII.
  - **Gaya:** `gaya.css` hanya `@import` ke `gaya/` (token, dasar, komponen, layar, meja, gerak, responsif).

## Phaser 4

- Client memakai **Phaser 4.2.1**. Banyak API Phaser 3 sudah berubah atau dihapus (misalnya `setTintFill`, pipeline, FX). Jangan menulis dari ingatan Phaser 3.
- Skill Phaser 4 lokal ada di `.claude/skills/` (tweens, input, particles, filters, scenes, `v3-to-v4-migration`, dll.; sumber di `.claude/skills/SUMBER.txt`). Skill itu **ditulis untuk v4**: pakai sebagai rujukan, dan kalau ragu cek `node_modules/phaser/types/phaser.d.ts`. Jangan mengarang API.

## Invarian yang wajib dijaga

**State dan aksi**
- `GameState` harus selalu bisa diserialisasi ke JSON.
- `terapkanAksi()` tidak boleh mengubah input.
- Pelanggaran aturan dilempar sebagai `AturanError(kode, pesan)` dan dikembalikan sebagai `{ ok: false }`. State tidak boleh berubah.

**Log dan riwayat**
- `riwayat`, `log`, dan `peristiwa` bersifat **append-only**.
- `salinState()` hanya menyalin array-nya, jadi entri yang sudah ditulis tidak boleh diubah.

**Info rahasia ("mode ingatan", keputusan pemilik):**
- `viewUntuk()` hanya mengirim tangan sendiri, **(jumlah pemain − 1) kartu teratas buangan**, dan `jokerMati` yang relevan. Jangan menambahkan info tersembunyi ke view, log, maupun peristiwa.
- Log **tidak boleh** menyebut kartu yang dibuang.
- **Angka joker hanya diumumkan sekali** (popup di awal putaran, harus ditekan OK; pemain online yang tersambung kembali sebelum menekan OK mendapat popup lagi). Jangan tampilkan angka joker di meja, bar atas, log, atau sorakan, selain pengecualian yang diputuskan pemilik di bawah. Client tidak boleh membaca `putaran.rankJoker`/`kartuDibuka` untuk tampilan apa pun selain popup joker (dijaga `apps/client/test/pemutar.test.ts`).
- Joker di tangan tidak diberi penanda. Tidak ada peringatan "kartu berbahaya", karena itu skill pemain.
- Semua aturan di atas **juga berlaku untuk `aria-label`, `umumkan()`/aria-live, tutorial, bunyi, dan getar**: tidak ada bunyi/getar/label yang berbeda untuk joker, dan pengumuman pembaca layar tidak menyebut kartu yang dibuang lawan.
- **Sudah diputuskan pemilik (13 Okt 2026), jangan diubah sepihak** (rincian: [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md) #25–#29):
  - **Dipertahankan, jangan dihapus:** label "→rank" pada joker pengganti di kartu jadi, teks log "(X jadi Y)", dan sub-teks sorakan JOKER DIBUANG?! yang menyebut kartunya. Seperti di meja asli, joker yang sudah dipasang terlihat semua orang dan boleh jadi petunjuk.
  - **Teks aksi singkat untuk buang di panel pemain cukup "buang kartu"**, tanpa menyebut kartunya. Kartunya tetap terlihat di tumpukan buangan.
  - `rankJoker`/`kartuDibuka` di view dan peristiwa buangan yang sudah tertimbun dibiarkan apa adanya. Pagar UI di atas tetap berlaku.

**Bot**
- Bot hanya melihat `ViewPemain` dan memvalidasi aksinya dengan fungsi aturan yang sama. Simulasi gagal kalau ada aksi bot yang ditolak.

**Client**
- **Tween kartu hanya menyentuh `ObjKartu`** (atau `ObjKartu.efek`), tidak pernah Image-nya langsung. `update()` yang menyalin data ke Image.
- **Setiap promise animasi wajib punya timeout cadangan** (helper `tw()`, cadangan total di `pentung`/`bagiKartu`, `denganBatas` di `kontrolMeja`). `requestAnimationFrame` bisa berhenti (aplikasi di latar belakang, atau browser pane alat pengembang), dan tanpa cadangan antrian akan macet.
- **`input.windowEvents: false`** di `game/game.ts` jangan dihapus: tanpanya ketukan pada tombol/jendela HTML di atas deck atau kartu ikut diproses sebagai aksi meja (klik tembus).
- Durasi animasi lewat `durasi()` supaya ikut preferensi kecepatan; gerak besar dimatikan saat `kurangiGerak()`, efek dekoratif saat `efekHemat()`.

**Menambah field di `GameState`, `StatePutaran`, `DataMeja`, atau `PengaturanMeja`:**
- Isi default di `migrasiState()` (`mesin.ts`) dan di konstruktor `Meja`, karena simpanan lama di `localStorage` HP pemain harus tetap bisa dilanjutkan.
- Perbarui helper test `packages/engine/test/bantu.ts` (fungsi `skenario`).
- Field baru di `Preferensi`: tambahkan bawaan dan normalisasinya di `preferensi.ts` (data rusak harus jatuh ke bawaan).

**Menambah status permainan (contoh: `susunAkhir`):**
- Tangani di `packages/engine/test/simulasi.ts`, `fuzz.test.ts`, bot (`pilihAksiBot`), `Meja.jadwalkan()`, dan UI.

**Menambah jenis peristiwa:**
- Definisikan di `state.ts` (`IsiPeristiwa`) dan pancarkan dengan `terjadi()` di `mesin.ts`.
- Putar di `efek/pemutar.ts`. Peristiwa hanya boleh berisi hal yang terlihat semua pemain di meja asli.

## Test

- **Engine:** helper `skenario()` dan `spek()` di `packages/engine/test/bantu.ts` menyusun meja langsung dari teks kartu, misalnya `'7 love'`, `'K kriting'`, `'As waru'`, `'5 love#1'` (deck ke-2).
  - Joker yang ada di buangan otomatis dianggap mati, seperti di permainan nyata.
  - `semuaSelesaiSusun()` dipakai untuk menutup fase susun akhir.
- **Meja:** `JamPalsu` (waktu manual) dan `KotakSurat` (pesan keluar) ada di `packages/meja/test/bantu.ts`.
  - Setelah `mulai`/`putaranBerikut`, panggil `siapSemua(meja)`, karena permainan menunggu semua manusia menekan OK di pengumuman joker.
  - `jedaBotMs` di opsi test menimpa jeda acak bot.
- **Simulasi** dipecah per jumlah pemain (`sim-*.test.ts`) supaya paralel. Test yang memblok lama tanpa `await` membuat worker Vitest timeout.
- **Golden master** (`packages/engine/test/golden.test.ts`, `packages/meja/test/golden-meja.test.ts`, snapshot di `__golden__/`) mengunci aksi, view, peristiwa, log, dan riwayat permainan ber-seed. Perubahan presentasi **tidak boleh** menggeser hash. Kalau hash berubah karena perubahan aturan/bot yang disengaja dan disetujui: tinjau diff ringkasan di snapshot, baru perbarui dengan `npx vitest run <file golden> -u`. Cara lengkapnya di [docs/baseline-gameplay.md](docs/baseline-gameplay.md).
- **Client** (`apps/client/test/`):
  - Baris pertama `// @vitest-environment happy-dom` kalau butuh DOM, `localStorage`, atau `matchMedia`. Tanpa baris itu test jalan di Node (lebih cepat, dipakai engine/meja/server).
  - Helper `apps/client/test/bantu.ts`: `mainkanBot()` (permainan bot-vs-bot deterministik), `pasangMatchMediaPalsu()`, `pasangLocalStorageRusak()`.
  - Modul ber-cache (`preferensi.ts`): `vi.resetModules()` lalu `await import(...)` per test. Untuk `localStorage` pakai `vi.stubGlobal`, bukan `vi.spyOn(Storage.prototype, ...)` (tidak berefek di happy-dom).
  - Test yang membuka jendela `dom.ts` wajib memanggil `tutupSemuaJendela()` di `afterEach` (state modul dipakai bersama).
- Contoh-contoh wajib dari dokumen aturan pemilik (mulung Bagian 5, Contoh A/B arah, skor 8.3, kelima contoh joker selang-seling) sudah ada sebagai test. **Jangan diubah** tanpa persetujuan pemilik.

## Versi, CHANGELOG, dan PWA

- **Versi tunggal** ada di `package.json` root (SemVer). Semua workspace (`packages/*`, `apps/*`) disamakan dengannya. Vite menyuntik `__VERSI_APP__`, `__BUILD_SHA__`, `__BUILD_WAKTU__` (`apps/client/src/versi.ts`); server menyuntik versi/sha lewat `apps/server/scripts/bundel.mjs`. Commit diambil dari env `GIT_SHA` (Docker `--build-arg GIT_SHA=...`) atau git lokal.
- **`CHANGELOG.md` wajib diperbarui** untuk setiap perubahan yang terasa pemain atau penting secara teknis, di bagian `## [Belum dirilis]` (format Keep a Changelog, dibagi "Untuk pemain" dan "Teknis"). Perubahan aturan wajib tertulis jelas.
  - CHANGELOG ditampilkan di layar Tentang lewat renderer markdown mini dan diuji `apps/client/test/tentang.test.ts`: pertahankan heading `## [Belum dirilis]`, pakai hanya tautan `https://` (bukan tautan relatif), dan jangan pakai HTML.
- **PWA `registerType: 'prompt'` + pembaruan otomatis di momen aman** (`apps/client/src/pembaruan.ts`, diuji `apps/client/test/pembaruan.test.ts`): service worker baru menunggu, lalu aplikasi sendiri yang memasangnya (`updateSW(true)`) tanpa pemain harus menekan apa pun.
  - Cek versi baru saat start, saat tab terlihat lagi, saat sinyal kembali, dan tiap 30 menit. Build client juga dicocokkan dengan `/healthz` server (sha); kalau beda, SW dicek saat itu juga.
  - Kapan dipasang diputuskan `momenPembaruan()`/`putuskanPembaruan()` (fungsi murni): beranda = toast singkat lalu muat ulang (atau diam-diam saat tab tersembunyi); lobi online, daftar meja, riwayat, klasemen akhir, dan jeda antarputaran online = hanya saat tab tersembunyi; putaran berjalan, susun akhir, popup joker, panel mentung, meja offline yang belum selesai, dialog terbuka, atau isian yang sedang diketik = **ditunda**. Tombol manual "Muat ulang" tetap ada.
  - Anti-loop: muat ulang otomatis dicatat di `sessionStorage` per build, paling banyak 2 kali.
  - Jangan kembali ke `autoUpdate` (bisa memuat ulang di tengah permainan), dan jangan longgarkan momen "tidak" tanpa izin pemilik.

## Catatan client (Phaser)

**Penggambaran**
- Tata letak dihitung ulang (`hitungTataMeja`) setiap model dipasang, lalu objek Phaser **disamakan per kunci**, bukan dihancurkan semua. Beberapa `pasang()` dalam satu frame digabung, dan `posisiKartu()`/`posisiPemain()`/`kotakLayar()` sudah benar segera setelah `pasang()`.
- Semua ukuran dalam piksel perangkat (`× devicePixelRatio`). Game dibuat seukuran layar × dpr lalu di-zoom `1/dpr`. Ruang bar HTML atas/bawah diukur `ResizeObserver` lalu diberikan ke `scene.aturRuang()`.
- Teks dan warna kanvas: ukuran teks ikut layar dan preferensi teks besar; warna dari token CSS (`warnaMeja.ts`).

**Antrian dan animasi**
- View dari meja **diantrikan**. Peristiwa baru diputar dulu (animasi + sorakan), baru view-nya ditampilkan. Selama animasi, dan sesaat setelah aksi dikirim, tombol aksi dikunci.
- Kartu yang sedang dianimasikan dimasukkan ke `disembunyikan` supaya tidak terlihat dobel. Kartu tersembunyi tetap memesan tempat di tangan dan kartu jadi, sehingga `posisiKartu(id)` bisa dipakai sebagai tujuan terbang.
- Pemutar bisa memanggil `terapkanViewBerikut(sembunyi)` di tengah animasi untuk menampilkan meja sesudah kejadian, lalu menerbangkan kartu ke posisi barunya. Contohnya kartu pungutan dan modal yang mendarat di kartu jadi baru.
- `naikPanggung`/`turunPanggung` (MejaScene) memamerkan kartu besar di tengah, bisa tertutup lalu dibalik. Panel mentung (`kontrolMeja.panelMentung`) menahan antrian sampai pemain menekan Lanjut.
- Kocok & bagi diputar dari peristiwa `mulaiPutaran` (juga di view pertama putaran baru); popup joker baru dibuka setelah antrian habis.

**Lain-lain**
- **Riwayat SQLite** (`apps/server/src/riwayat.ts`, modul bawaan `node:sqlite`): hanya klasemen akhir permainan online, lewat kait `OpsiMeja.saatSelesai`. Permainan offline tetap hanya di `localStorage` HP. Peringkat menggabungkan pemain berdasarkan **nama** (belum ada akun).
- **Emote** hanya boleh dari `DAFTAR_EMOTE` (`packages/meja/src/protokol.ts`), supaya tidak bisa dipakai mengirim pesan bebas. Celetukan bot (`Meja.celetukBot`) hanya boleh menanggapi peristiwa publik, tidak boleh membocorkan kartu.
- **Nama warga kedai** dari `NAMA_LAWAN_BAWAAN` (`packages/meja/src/meja.ts`) lewat `OpsiMeja.namaLawan`. Urutan diacak dengan `Math.random` (bukan `opsi.acak`, supaya golden celetukan tidak bergeser); latihan memakai urutan tetap. Nama tidak boleh bergantung pada level, kartu, giliran, atau peristiwa.

**Promosi Kedai Madya (soft selling, keputusan pemilik)**
- Hanya di tiga tempat: kartu "Main bareng di Kedai Madya" di beranda (sesudah menu, sebelum kaki), bagian Kedai Madya di Tentang, dan **satu** baris ajakan + tautan peta di klasemen akhir (bukan di hasil per putaran, bukan di latihan).
- **Tidak pernah muncul sendiri** selama permainan: tidak ada toast/pop-up, dan meja, susun akhir, popup joker, panel mentung, serta tutorial tidak memuatnya. Dijaga `apps/client/test/kontrolMeja.test.ts` dan `kedai.test.ts`.
- Tentang tetap memuat bagian Kedai Madya walau dibuka dari menu ☰ saat bermain (keputusan koordinator: pemain sendiri yang membukanya). Jangan sembunyikan bagian itu dan jangan tambah jalur lain yang memunculkannya sendiri.
- Hanya fakta terverifikasi. **Jangan** menulis jam buka, menu, harga, rating, jumlah buku, atau telepon (info itu cepat basi; arahkan ke IG/Maps). Tautan polos `https`, `target="_blank" rel="noopener noreferrer"`, tanpa UTM/analitik. Kalau offline, tampilkan catatan "Butuh internet buat buka tautan".
- Logo dipakai dengan izin kedai; kreditnya di Tentang. Logo, nama, dan promosi tidak boleh berbeda karena joker atau kartu tersembunyi.
- Jejak "kartumu di meja lawan" memakai `KartuDiMeja.dari`, yang diisi dari `StatePutaran.asalKartu` saat kartu jadi dipasang.
- Kartu digambar dengan Canvas 2D (`kartuGrafisGambar.ts`), tanpa file gambar, supaya PWA jalan offline. Suara dan musik juga disintesis (tanpa file audio). Ikon PWA dibuat oleh `apps/client/scripts/buat-ikon.mjs` saat build.
- Mode dev menyediakan `window.__remi = { game, adegan }` dan `window.__remiApp` (instance aplikasi) untuk debug. Posisi objek ada di `adegan.children.list`, dengan koordinat ÷ dpr.

## Jebakan lingkungan (Windows)

**Vite dan port**
- Setelah banyak file diubah bertubi-tubi, Vite bisa menyajikan modul basi, misalnya error "does not provide an export named ...", halaman tampil tanpa CSS, atau `__VERSI_APP__ is not defined` (dev server dimulai sebelum `define` di `vite.config.ts` berubah). Solusinya restart `npm run dev:client`, lalu hard refresh (Ctrl+Shift+R).
- Port 5173 dikunci (`strictPort`). Kalau masih dipakai proses lama, matikan proses `node ... vite.js`-nya dulu. `npm run e2e` memakai port bebas sendiri (bukan 5173/8080), jadi tidak bentrok.

**Test**
- Node ≥ 25 punya `localStorage` bawaan yang menutupi milik happy-dom. `vitest.config.ts` (Vitest 4) mematikannya dengan `test.execArgv: ['--no-experimental-webstorage']` dan `pool: 'forks'` yang ditulis eksplisit; `poolOptions` sudah tidak ada di Vitest 4, jangan dikembalikan. Menjalankan dengan `--pool=threads` membuat test client yang memakai `localStorage` gagal dengan error membingungkan.
- **Port e2e di Windows:** Hyper-V/WSL/Docker memesan rentang port (cek `netsh interface ipv4 show excludedportrange protocol=tcp`, di mesin ini 3952–4933). Port di rentang itu ditolak `EACCES` walau tidak dipakai proses apa pun. `smoke.mjs` mencoba 4173–4199, lalu 8090–8199, lalu port acak dari OS, dan mencetak port yang dipakai (`[e2e] vite preview di ...`).

**Mengedit file**
- Jangan membuka file untuk ditulis sebelum isinya dibaca, misalnya `open(p,'w').write(open(p).read())` di Python, karena file akan kosong.
- Utamakan tool Edit/Write. Untuk perubahan besar lewat skrip, tulis skripnya ke file dulu, jangan lewat heredoc panjang di shell.

**Simpanan dan sesi di browser**
- Simpanan offline (`remi.mejaOffline`), sesi online (`remi.sesiOnline`), dan preferensi (`remi.preferensi`) ada di `localStorage` per origin. `localhost:5173` dan `127.0.0.1:5173` adalah origin berbeda, dan berguna untuk menguji dua pemain di satu mesin.
- Service worker tidak bisa didaftarkan di browser pane alat pengembang. Uji PWA di Chrome atau HP sungguhan lewat HTTPS.

## Keputusan pemilik yang sering terlupa

Daftar lengkap ada di README. Yang paling sering terlupa:

**Kartu jadi**
- Seri angka hanya 2–10 (maksimal 9 kartu). Seri Londo hanya J-Q-K. Angka dan Londo tidak bisa disambung, dan As tidak bisa masuk seri.
- Kembar hanya untuk As, dan bunganya harus beda semua (3 atau 4 kartu). 3 As butuh kartu jadi lain, boleh yang diturunkan bersamaan di aksi yang sama.
- Joker pengganti jumlahnya ≤ kartu biasa dan tidak boleh dempet. Joker tidak bisa menggantikan Londo maupun As.
- 2 deck: kartu kembar boleh di seri yang sama asal salah satunya jadi joker pengganti untuk angka lain (joker 5: 4♥ 5♥ 6♥ + 5♥ deck kedua sebagai 7♥). Dua kartu yang mewakili angka sama tetap ditolak (`packages/engine/test/kembar-pengganti.test.ts`).

**Mulung**
- Kartu paling bawah yang dipungut wajib jadi kartu jadi baru.
- Di kombinasi itu, modal ≥ pungutan, dan modal harus memuat minimal satu kartu biasa.

**Membuang dan mentung**
- Membuang joker: −25, dan kartu itu jadi kartu biasa (joker mati).
- Pentungan joker bernilai **250**. Joker yang sudah pernah dibuang, lalu dipungut dan dipakai sebagai pentungan, dinilai sebagai kartu aslinya.
- Habis ambil dari deck tidak bisa nutup.

**Akhir putaran (deck habis atau mentung)**
- **Deck habis:** pemain yang mengambil kartu terakhir menyelesaikan gilirannya dulu.
- **Mentung:** kepentung dan arah ditentukan saat mentung. Peristiwa `mentung` dipancarkan saat itu juga, dan skor dihitung setelah susun akhir. Info mentung disimpan di `StatePutaran.mentung`.
- Keduanya disusul **fase susun akhir**: semua pemain boleh menurunkan kartu jadi tanpa mulung, lalu menekan Selesai.

**Bot**
- Tempo bawaan "santai": bot mikir 3–10 detik acak sebelum aksi pertama di gilirannya, lalu 1,5–3 detik untuk aksi lanjutan.
