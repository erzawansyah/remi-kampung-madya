# AGENTS.md: petunjuk untuk agent/sesi yang mengubah proyek ini

**Remi Kampung Madya**: game kartu remi dengan aturan yang berlaku di Kedai Madya (tempat pemilik dan teman-temannya berkumpul), yaitu **aturan tongkrongan** lokal yang **berbeda dari remi/rummy umum**. Monorepo TypeScript: rules engine murni, modul meja/room, server WebSocket, dan client Phaser 4.2.1 + HTML + PWA.

Baca [README.md](README.md) dulu, terutama bagian **Ringkasan aturan** dan **Aturan Terbuka dan keputusan**. Keduanya sumber kebenaran soal aturan main. Keputusan pemilik #25–#47 dan hal yang masih menunggu tanggapannya dirinci di [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md): **jangan diubah** tanpa izin pemilik. #40 (joker beda dari putaran sebelumnya) sudah diterapkan. #41–#43 dan #47 (16 Okt 2026) sudah diputuskan tapi baru diterapkan di rilis berikutnya; sampai saat itu aturan dan bot untuk butir itu tetap seperti sekarang.

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
npm test             # semua test (±30–36 dtk): engine, simulasi 2.160 putaran bot-vs-bot (paling lama, ±26 dtk), golden, meja, server, client
npm run test:client  # hanya test client (happy-dom), ±4 detik
npm run typecheck    # engine, meja, server, client (termasuk apps/client/test)
npm run dev:server   # server WebSocket :2567 (tsx watch)
npm run dev:client   # Vite :5173 (strictPort), /ws dan /api diteruskan ke :2567
npm run build        # build client (PWA + .br/.gz) + bundel server
npm run e2e          # E2E smoke di Chrome sistem (build + vite preview, HP & desktop, tombol pasang di Chrome Android)
docker compose up -d --build   # produksi; Dockerfile menjalankan typecheck + test + build
npx tsx packages/engine/scripts/arena.ts   # ukur kekuatan level bot (--uji, --lawan, --susunan, --meja, --seed, --putaran, --waktu)
```

- `npm run e2e` tidak mengunduh browser. Kalau Chrome tidak ketemu otomatis, set `CHROME_PATH`. Opsi: `-- --url=http://localhost:5173` (uji dev server), `-- --perangkat=hp` (`hp`, `desktop`, `pasang`, dipisah koma), `-- --tanpa-build`, `-- --tampil`.
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
- **Bot (warga kedai):** `packages/engine/src/bot/`. `bot.ts` = `LevelBot`/`DAFTAR_LEVEL_BOT` (mudah, normal, jago, suhu) dan strategi mudah/normal; `strategi.ts` = jago/suhu (`PARAM_JAGO`, `PARAM_SUHU`); `susun.ts` = pencari susunan kartu jadi; `ingatan.ts` = ingatan dari `ViewPemain`.
  - Perubahan strategi **diukur di arena** (`packages/engine/scripts/arena.ts`), jangan diasumsikan lebih kuat.
  - Level baru: tambah di `DAFTAR_LEVEL_BOT` dan `LEVEL_WARGA` (`apps/client/src/konten/levelWarga.ts`, satu sumber label untuk beranda, lobi, Bantuan); validasi meja ikut otomatis. Level dari data tak dipercaya (simpanan, isian UI) dirapikan dengan `rapikanLevel()` dari `@remi/meja`.
- **Perilaku room/online:** `packages/meja/src/meja.ts` dan `protokol.ts`.
  - Pesan dari jaringan divalidasi di `validasi.ts`. Tambah case di sana setiap ada pesan baru.
  - Semua timer `Meja` dipasang lewat `pasangTimer()` (galat ditangkap, dilaporkan `OpsiMeja.saatGalat`, jadwal disusun ulang; keputusan #38). Timer baru wajib lewat `pasangTimer()`; hanya `pulihkanJadwal()` yang memanggil `penjadwal.setel` langsung.
- **Client** (peta lengkap: [docs/arsitektur-client.md](docs/arsitektur-client.md)):
  - **Tata letak meja:** `game/tataMeja.ts`, fungsi **murni** (tanpa Phaser) yang mengubah `ModelMeja` + ukuran layar jadi daftar kartu/teks/hiasan beserta posisinya.
  - **Kanvas meja:** `game/MejaScene.ts` menyamakan objek Phaser dengan hasil tata letak **per kunci** (rekonsiliasi), lewat objek data `ObjKartu`. Input, seret, dan primitif animasi (`terbang`, `naikPanggung`, `pentung`, `bagiKartu`, ...) ada di sini.
  - **Gambar kartu:** `game/kartuGrafisGambar.ts` (Canvas 2D murni, juga untuk kartu di HTML lewat `gambarKartuKeKanvas`) dan `game/kartuGrafis.ts` (tekstur Phaser mini/normal/besar, bayangan, sorot, fokus). Palet kanvas dari token CSS: `game/warnaMeja.ts`.
  - **Alur meja HTML:** `kontrolMeja.ts` (bar atas, bar aksi, keyboard, jendela, antrian animasi). Animasi, sorakan, bunyi, dan getar per peristiwa: `efek/pemutar.ts` dan `efek/sorak.ts`.
  - **Suara/musik/getar:** `efek/suara.ts` (API `bunyi`, `getar`, `POLA_GETAR`), `efek/mesinAudio.ts` (AudioContext, bus, limiter, unlock), `efek/sintesis.ts`, `efek/musik.ts` (termasuk `redamMusik()` untuk mengecilkan musik selama bunyi besar).
  - **Preferensi dan gerak:** `preferensi.ts` (simpan, normalkan, migrasi `remi.efek`, atribut `data-*` di `<html>`) dan `gerak.ts` (`DURASI`, `EASE`, `durasi()`, `kurangiGerak()`, `efekHemat()`, `easePegas()`). Token CSS padanannya di `gaya/token.css`; ubah keduanya bersamaan.
  - **Jendela:** `ui/dom.ts`, dua tingkat. `bukaModal` = modal utama untuk jendela permainan (popup joker, panel mentung, hasil, menu). `bukaDialog`/`konfirmasi` = lapisan di atasnya. **Pengaturan, Bantuan, Tentang, dan konfirmasi wajib lewat `bukaDialog`/`konfirmasi`** supaya tidak menimpa popup joker atau panel mentung yang sedang menahan antrian.
  - **Layar:** `main.ts` (kerangka, Back, PWA, latihan) dan `ui/` (beranda, lobi, riwayat, pengaturan, bantuan, tentang, tutorial, rincianSkor).
  - **Konten:** `konten/bantuan.ts` dan `konten/tutorial.ts` adalah data. Isinya **harus sesuai engine dan README**; contoh kartu yang ditandai sah/tidak sah harus memberi hasil yang sama dengan validator engine (dijaga `apps/client/test/kontenAturan.test.ts`). Aturan berubah → konten ikut diperbarui.
  - **Kedai Madya:** `konten/kedai.ts` = satu sumber info kedai (bio, alamat, tautan peta/IG/Threads/Rak Buku). Logo di `aset/logoMadya.ts` (`svgLogo()` inline SVG `fill=currentColor` untuk HTML, `pathLogo()` untuk Canvas); jangan tambah file gambar. Lihat bagian "Promosi Kedai Madya" di bawah.
  - **Batas skor** (keputusan #44): isiannya hanya lewat `ui/batasSkor.ts` (Atur meja dan lobi), pembulatan kelipatan 10 dan validasinya hanya `rapikanBatasSkor()`/`batasSkorSah()` dari `@remi/meja`. Batas bawah diketik positif dan disimpan negatif. Kalau ada pilihan yang tidak memakai batas skor, sembunyikan bungkus `.isian-batas-skor` utuh.
  - **Konfirmasi keluar meja:** teksnya satu sumber, `opsiKonfirmasiKeluar()` di `ui/lobi.ts`, dipakai tombol di lobi, menu ☰ meja, dan tombol Back (`main.ts`). Jangan menulis teks konfirmasi keluar sendiri di tempat lain. Jalur keluar meja online mengisi `masukPeringkat: mejaMasukPeringkat(info)` supaya kalimat juru kunci (#45) muncul di meja yang punya ≥ 2 kursi manusia.
  - **Tombol pasang aplikasi (keputusan #46):** deteksi murni di `pasangAplikasi.ts` (`caraPasang`, `keadaanPasang`, `perangkatApel` yang juga dipakai `mesinAudio.ts`), simpanan `remi.tawaranPasang` di `penyimpanan.ts`, rangkaian di `main.ts` (`tawaranPasang()`, `jalankanPasang()`, `segarkanPasang()`), tampilan `aturPasang()` di `ui/beranda.ts`, dialog petunjuk `ui/pasang.ts` (teks `konten/pasang.ts`, lewat `bukaDialog`). Manifest memakai `display: fullscreen`, jadi "terpasang" dinilai lewat `nilaiTerpasang()` dengan nilai yang dibaca saat aplikasi mulai (layar penuh dari menu meja juga mencocokkan `display-mode: fullscreen`); jangan membaca `display-mode` sendiri di tempat lain.
    - Tombol melayang **hanya di beranda** dan wajib tetap anak terakhir `.layar.beranda` (ikut `inert` saat ada jendela, ikut hilang saat `#ui` diganti). Jangan pernah memunculkannya di lobi, meja, susun akhir, atau selama permainan, dan jangan menambah toast/pop-up yang menawarkan pemasangan sendiri.
    - "Nanti saja" hanya menyembunyikan tombol melayang (3 hari, `TUNDA_PASANG_MS`); ubin menu "Pasang ke layar utama" tetap ada selama `keadaanPasang()` tidak null.
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
- Semua aturan di atas **juga berlaku untuk `aria-label`, `umumkan()`/aria-live, tutorial, bunyi, dan getar**: tidak ada bunyi/getar/label yang berbeda untuk joker yang masih di tangan atau belum terbuka, dan pengumuman pembaca layar tidak menyebut kartu yang dibuang lawan.
  - Joker yang sudah publik boleh punya bunyi sendiri: `jokerDibuang` dari peristiwa buang, `mentungJoker` (bunyi dan getar) baru **sesudah** pentungan terbuka. Bunyi `tegang` sebelum dibuka wajib sama untuk pentungan apa pun. Dijaga `apps/client/test/suaraDramatis.test.ts`.
- **Sudah diputuskan pemilik (13 Okt 2026), jangan diubah sepihak** (rincian: [docs/keputusan-pemilik.md](docs/keputusan-pemilik.md) #25–#29):
  - **Dipertahankan, jangan dihapus:** label "→rank" pada joker pengganti di kartu jadi, teks log "(X jadi Y)", dan sub-teks sorakan JOKER DIBUANG?! yang menyebut kartunya. Seperti di meja asli, joker yang sudah dipasang terlihat semua orang dan boleh jadi petunjuk.
  - **Teks aksi singkat untuk buang di panel pemain cukup "buang kartu"**, tanpa menyebut kartunya. Kartunya tetap terlihat di tumpukan buangan.
  - `rankJoker`/`kartuDibuka` di view dan peristiwa buangan yang sudah tertimbun dibiarkan apa adanya. Pagar UI di atas tetap berlaku.

**Bot**
- Bot hanya melihat `ViewPemain` dan memvalidasi aksinya dengan fungsi aturan yang sama. Simulasi gagal kalau ada aksi bot yang ditolak. `pilihAksiBot` tetap fungsi murni.
- Ingatan jago/suhu hanya dari `ViewPemain` dan peristiwa di view (yang juga terlihat pemain di meja asli). Jangan menambah info tersembunyi ke view demi bot.
- Golden master hanya memainkan level mudah dan normal: strategi keduanya tidak boleh berubah tanpa peninjauan golden. Jago/suhu dijaga `bot-kuat.test.ts`, `bot-susun.test.ts`, simulasi, dan arena.
- Jago/suhu sengaja **menahan kartu jadi di tangan** (sah: semua pemain boleh menurunkannya di susun akhir, #19 dan #24). Gaya ini disetujui pemilik (16 Okt 2026) dan tetap dipakai (lihat `docs/keputusan-pemilik.md`, Catatan lain).

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
  - Meja menangkap galatnya sendiri: pasang `saatGalat` di opsi supaya galat tidak hilang diam-diam di test. Pola menyuntik galat ke langkah warga kedai (`vi.mock('@remi/engine')`, penjadwal yang tersendat) ada di `packages/meja/test/galat-bot.test.ts`.
- **Simulasi** dipecah per jumlah pemain (`sim-*.test.ts`) supaya paralel. Test yang memblok lama tanpa `await` membuat worker Vitest timeout.
- **Golden master** (`packages/engine/test/golden.test.ts`, `packages/meja/test/golden-meja.test.ts`, snapshot di `__golden__/`) mengunci aksi, view, peristiwa, log, dan riwayat permainan ber-seed. Perubahan presentasi **tidak boleh** menggeser hash. Kalau hash berubah karena perubahan aturan/bot yang disengaja dan disetujui: tinjau diff ringkasan di snapshot, baru perbarui dengan `npx vitest run <file golden> -u`. Cara lengkapnya di [docs/baseline-gameplay.md](docs/baseline-gameplay.md).
- **Client** (`apps/client/test/`):
  - Baris pertama `// @vitest-environment happy-dom` kalau butuh DOM, `localStorage`, atau `matchMedia`. Tanpa baris itu test jalan di Node (lebih cepat, dipakai engine/meja/server).
  - Helper `apps/client/test/bantu.ts`: `mainkanBot()` (permainan bot-vs-bot deterministik), `pasangMatchMediaPalsu()`, `pasangLocalStorageRusak()`.
  - Modul ber-cache (`preferensi.ts`): `vi.resetModules()` lalu `await import(...)` per test. Untuk `localStorage` pakai `vi.stubGlobal`, bukan `vi.spyOn(Storage.prototype, ...)` (tidak berefek di happy-dom).
  - Test yang membuka jendela `dom.ts` wajib memanggil `tutupSemuaJendela()` di `afterEach` (state modul dipakai bersama).
  - Jebakan happy-dom: `<option selected>` yang bukan opsi pertama dibaca meleset satu ke atas (`select.value`/`selectedIndex` salah), dan `option.defaultSelected` selalu false. Di test, cek `option.hasAttribute('selected')`.
- Contoh-contoh wajib dari dokumen aturan pemilik (mulung Bagian 5, Contoh A/B arah, skor 8.3, kelima contoh joker selang-seling) sudah ada sebagai test. **Jangan diubah** tanpa persetujuan pemilik.

## Versi, CHANGELOG, dan PWA

- **Versi tunggal** ada di `package.json` root (SemVer). Semua workspace (`packages/*`, `apps/*`) disamakan dengannya. Vite menyuntik `__VERSI_APP__`, `__BUILD_SHA__`, `__BUILD_WAKTU__` (`apps/client/src/versi.ts`); server menyuntik versi/sha lewat `apps/server/scripts/bundel.mjs`.
  - **Identitas build** (sha) dihitung satu helper, `scripts/idBuild.mjs`, yang dipakai `vite.config.ts` dan `bundel.mjs`, jadi client dan server selalu sama. Urutan: env `GIT_SHA` (commit hex, dipotong 7) > `git rev-parse --short=7 HEAD` (hanya kalau akar proyek = puncak repo, tanpa `-dirty`) > hash isi sumber `h-` + 7 hex. Hanya Vite dev server (`npm run dev:client`) yang memakai `dev`; `vite preview` (termasuk `npm run e2e`) menyajikan bundel apa adanya, dengan id dari `vite build` sebelumnya.
  - Daftar pengecualian hash isi di `idBuild.mjs` selaras dengan `.dockerignore`: ubah keduanya bersamaan.
- **`CHANGELOG.md` wajib diperbarui** untuk setiap perubahan yang terasa pemain atau penting secara teknis, di bagian `## [Belum dirilis]` (format Keep a Changelog, dibagi "Untuk pemain" dan "Teknis"). Perubahan aturan wajib tertulis jelas.
  - CHANGELOG ditampilkan di layar Tentang lewat renderer markdown mini dan diuji `apps/client/test/tentang.test.ts`: pertahankan heading `## [Belum dirilis]`, pakai hanya tautan `https://` (bukan tautan relatif), dan jangan pakai HTML.
- **PWA `registerType: 'prompt'` + pembaruan otomatis di momen aman** (`apps/client/src/pembaruan.ts`, diuji `apps/client/test/pembaruan.test.ts`): service worker baru menunggu, lalu aplikasi sendiri yang memasangnya (`updateSW(true)`) tanpa pemain harus menekan apa pun.
  - Cek versi baru saat start, saat tab terlihat lagi, saat sinyal kembali, dan tiap 30 menit. Build client juga dicocokkan dengan `/healthz` server (sha); kalau beda, SW dicek saat itu juga.
  - Cek `/healthz` tanpa jeda minimum di setiap sambungan online yang berhasil, termasuk yang pertama (`PemicuCekServer` di `pembaruan.ts`), dan saat meja terakhir sudah tidak ada di server. Diuji `cekVersiServer.test.ts`. Jangan menebak "sempat putus" dari status tepat sebelum `tersambung`, karena itu selalu `menyambung`; kabar koneksi ke pemain (toast, pembaca layar) memakai `KabarKoneksi` (`koneksi.ts`) karena sebab yang sama.
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
- **Riwayat SQLite** (`apps/server/src/riwayat.ts`, modul bawaan `node:sqlite`): hanya klasemen akhir permainan online, lewat kait `OpsiMeja.saatSelesai`. Permainan offline tetap hanya di `localStorage` HP. Peringkat menggabungkan pemain berdasarkan **nama** tanpa beda huruf besar/kecil (`kunciNama` di `validasi.ts`; belum ada akun).
  - **Aturan hitung leaderboard** (keputusan #45: urutan, minimal 3 main, minimal 2 orang, yang keluar juru kunci, saringan, bulan WIB) hanya di `packages/meja/src/peringkat.ts`, dipakai server dan tab Statistik di HP. Jangan menghitung peringkat sendiri di server/UI.
  - **Skema SQLite hanya berubah dengan menambah entri di belakang `MIGRASI`** (`PRAGMA user_version`). Entri lama jangan diubah. Kolom baru wajib boleh NULL atau punya DEFAULT (server versi sebelumnya harus tetap bisa menulis), dan baris lama dilengkapi di `lengkapiBaris()` secara idempoten.
  - `GET /api/peringkat` tanpa `v=2` harus tetap array bentuk lama: HP dengan aplikasi lama memanggil `.map()` langsung.
  - `Kursi.keluar` hanya ada kalau true (golden `dataMejaAkhir` tidak bergeser) dan tidak pernah dikirim ke client. Pasangannya `Kursi.keluarSesudahPutaran` (diisi bersamaan, dihapus bersamaan): mentung/kepentung kursi yang keluar di klasemen akhir hanya dihitung dari putaran sebelum ia keluar, bukan hasil warga kedai penerusnya.
- **Emote** hanya boleh dari `DAFTAR_EMOTE` (`packages/meja/src/protokol.ts`), supaya tidak bisa dipakai mengirim pesan bebas. Celetukan bot (`Meja.celetukBot`) hanya boleh menanggapi peristiwa publik, tidak boleh membocorkan kartu.
- **Nama warga kedai** dari `NAMA_LAWAN_BAWAAN` (`packages/meja/src/meja.ts`, 22 nama: 10 "Warga Madya" lalu 12 tambahan pemilik, ejaan persis) lewat `OpsiMeja.namaLawan`. Urutan diacak dengan `Math.random` (bukan `opsi.acak`, supaya golden celetukan tidak bergeser); latihan memakai urutan tetap. Nama tidak boleh bergantung pada level, kartu, giliran, atau peristiwa.
  - Nama baru **hanya ditambahkan di belakang** daftar: menyisipkan di depan/tengah menggeser golden meja dan lawan latihan.
  - Label nama pembuang di bawah buangan: `labelSempit()` (`game/tataMeja.ts`) wajib menerima `namaLain` (nama pemain lain di meja) supaya singkatan tidak pernah kembar (misalnya Jurik dan Juragan sama-sama "JU"). Lebarnya diperkirakan `kiraLebarLabel()` (bukan `kiraLebarTeks()`), yang tidak boleh lebih sempit dari hasil ukur di `apps/client/test/data/lebarHuruf.ts`; inisial yang tidak muat dikecilkan sampai 9 px CSS (`ukuranPx` di hasilnya wajib dipakai pemanggil). Kalau font kanvas (`FONT` di `MejaScene.ts`) diganti, ukur ulang lalu perbarui kelas lebar hurufnya.

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

**Build**
- `npm run build` menulis ulang `apps/client/public/favicon.svg` dengan akhir baris LF. Dengan `core.autocrlf=true`, `git diff --quiet` tidak mendeteksinya padahal `git status` menandai M. Kembalikan dengan `git checkout -- apps/client/public/favicon.svg`.

**Mengedit file**
- Jangan membuka file untuk ditulis sebelum isinya dibaca, misalnya `open(p,'w').write(open(p).read())` di Python, karena file akan kosong.
- Utamakan tool Edit/Write. Untuk perubahan besar lewat skrip, tulis skripnya ke file dulu, jangan lewat heredoc panjang di shell.

**Simpanan dan sesi di browser**
- Simpanan offline (`remi.mejaOffline`), sesi online (`remi.sesiOnline`), preferensi (`remi.preferensi`), dan tawaran pasang aplikasi (`remi.tawaranPasang`; hapus kuncinya untuk memunculkan lagi tombol pasang yang ditunda) ada di `localStorage` per origin. `localhost:5173` dan `127.0.0.1:5173` adalah origin berbeda, dan berguna untuk menguji dua pemain di satu mesin.
- Service worker tidak bisa didaftarkan di browser pane alat pengembang. Uji PWA di Chrome atau HP sungguhan lewat HTTPS.

## Keputusan pemilik yang sering terlupa

Daftar lengkap ada di README. Yang paling sering terlupa:

**Joker di awal putaran**
- Kartu yang dibuka berangka sama dengan joker **putaran tepat sebelumnya** dianulir, lalu kartu berikutnya dibuka sampai beda (#40, `bukaKartuJoker` di `mesin.ts`). Bandingkan hanya dengan `riwayat.at(-1)`: putaran 3 boleh sama dengan putaran 1, dan putaran pertama (juga sesudah "Main lagi") bebas. Kartu yang dianulir diselipkan lagi ke deck sesudah kartu joker, masing-masing satu `rng.int`; jalur tanpa anulir tidak boleh memakai RNG tambahan (golden 2 dan 3 pemain menjaganya). Popup joker tidak menjelaskan anulir.

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
