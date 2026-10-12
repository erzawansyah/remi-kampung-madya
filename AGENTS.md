# AGENTS.md: petunjuk untuk agent/sesi yang mengubah proyek ini

**Remi Kampung Madya**: game kartu remi dengan aturan yang berlaku di Kedai Madya (tempat pemilik dan teman-temannya berkumpul), yaitu **aturan tongkrongan** lokal yang **berbeda dari remi/rummy umum**. Monorepo TypeScript: rules engine murni, modul meja/room, server WebSocket, dan client Phaser 3 + PWA.

Baca [README.md](README.md) dulu, terutama bagian **Ringkasan aturan** dan **Aturan Terbuka dan keputusan**. Keduanya sumber kebenaran soal aturan main.

## Aturan emas

1. **Jangan mengarang aturan.** Aturan hanya datang dari pemilik proyek.
   - Situasi yang belum tercakup: tanyakan ke pemilik, atau jadikan opsi dengan default yang jelas.
   - Catat di tabel Aturan Terbuka di README.
   - Jangan pakai aturan remi umum dari pengetahuanmu.
2. **Jangan menyederhanakan atau menghapus aturan** demi kemudahan implementasi tanpa izin.
3. **Setiap perubahan aturan wajib disertai unit test,** dan README (ringkasan + tabel Aturan Terbuka) diperbarui.
4. **Bahasa:**
   - UI, pesan error, dan komentar kode memakai Bahasa Indonesia gaya tongkrongan yang ramah, misalnya "Modalnya kurang, Bos."
   - Istilah domain memakai glosarium: bunga (Love/Wajik/Kriting/Waru), Londo, joker, kartu jadi, modal, mulung/mungut, mentung/nutup, pentungan, kepentung, lompat, putaran.
   - Istilah teknis Inggris (state, view, endpoint, dll.) dibiarkan apa adanya.

## Perintah

```bash
npm install
npm test            # semua test (~15 detik), termasuk simulasi 2.160 putaran bot-vs-bot
npm run typecheck   # engine, meja, server, client
npm run dev:server  # server WebSocket :2567 (tsx watch)
npm run dev:client  # Vite :5173 (strictPort), /ws diteruskan ke :2567
npm run build       # build client (PWA) + bundle server
docker compose up -d --build   # produksi; Dockerfile menjalankan npm test saat build
```

Pekerjaan dianggap selesai kalau `npm test` dan `npm run typecheck` lolos.

## Struktur dan batas lapisan

| Paket | Isi | Boleh bergantung pada |
|---|---|---|
| `packages/engine` | Rules engine **murni & deterministik** (RNG di-seed, state di `GameState.rng`). Validasi, skor, bot, view. | Tidak ada (tanpa DOM, tanpa Node API) |
| `packages/meja` | Satu meja/room: kursi, host, bot, timer giliran, sambung ulang, voting, pengumuman joker. **Tanpa jaringan.** Waktu lewat `Penjadwal`. Dipakai server **dan** mode offline di browser. | engine |
| `apps/server` | HTTP + WebSocket (`ws`) tipis. Memetakan sambungan → `pemainId` → `Meja`. | engine, meja |
| `apps/client` | Phaser 3 (scene meja) + HTML (beranda, lobi, modal, bar aksi). | engine, meja |

**Di mana mengubah apa:**
- **Aturan main:** `packages/engine/src/kartuJadi.ts` (seri/kembar/joker), `giliran.ts` (validasi mulung/turunkan/buang), `mesin.ts` (alur, mentung, skor putaran), `skor.ts`.
  - Fungsi di `giliran.ts` dipakai bersama oleh mesin, bot, dan UI. Ubah aturan di sana, **jangan** menduplikasi logika aturan di UI.
- **Perilaku room/online:** `packages/meja/src/meja.ts` dan `protokol.ts`.
  - Pesan dari jaringan divalidasi di `validasi.ts`. Tambah case di sana setiap ada pesan baru.
- **Tampilan meja:** `apps/client/src/game/MejaScene.ts`. Alur tombol, modal, dan antrian animasi: `kontrolMeja.ts`. Animasi, sorakan, dan suara per kejadian: `efek/pemutar.ts`, `efek/sorak.ts`, `efek/suara.ts`.

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
- **Angka joker hanya diumumkan sekali** (popup di awal putaran, harus ditekan OK). Jangan tampilkan angka joker di meja, bar atas, log, atau sorakan.
- Joker di tangan tidak diberi penanda. Tidak ada peringatan "kartu berbahaya", karena itu skill pemain.

**Bot**
- Bot hanya melihat `ViewPemain` dan memvalidasi aksinya dengan fungsi aturan yang sama. Simulasi gagal kalau ada aksi bot yang ditolak.

**Menambah field di `GameState`, `StatePutaran`, `DataMeja`, atau `PengaturanMeja`:**
- Isi default di `migrasiState()` (`mesin.ts`) dan di konstruktor `Meja`, karena simpanan lama di `localStorage` HP pemain harus tetap bisa dilanjutkan.
- Perbarui helper test `packages/engine/test/bantu.ts` (fungsi `skenario`).

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
- Contoh-contoh wajib dari dokumen aturan pemilik (mulung Bagian 5, Contoh A/B arah, skor 8.3, kelima contoh joker selang-seling) sudah ada sebagai test. **Jangan diubah** tanpa persetujuan pemilik.

## Catatan client (Phaser)

**Penggambaran**
- Scene menggambar ulang **seluruh** meja dari `ModelMeja` setiap ada perubahan.
- Animasi berjalan di container `lapisan`, yang tidak ikut dihapus saat menggambar ulang.
- Semua ukuran dalam piksel perangkat (`× devicePixelRatio`). Game dibuat seukuran layar × dpr lalu di-zoom `1/dpr`.

**Antrian dan animasi**
- View dari meja **diantrikan**. Peristiwa baru diputar dulu (animasi + sorakan), baru view-nya ditampilkan.
- Kartu yang sedang dianimasikan dimasukkan ke `disembunyikan` supaya tidak terlihat dobel. Selama animasi, tombol aksi dikunci.
- **Setiap promise animasi wajib punya timeout cadangan.** `requestAnimationFrame` bisa berhenti (aplikasi di latar belakang, atau browser pane alat pengembang), dan tanpa cadangan antrian akan macet.

**Lain-lain**
- **Riwayat SQLite** (`apps/server/src/riwayat.ts`, modul bawaan `node:sqlite`): hanya klasemen akhir permainan online, lewat kait `OpsiMeja.saatSelesai`. Permainan offline tetap hanya di `localStorage` HP. Peringkat menggabungkan pemain berdasarkan **nama** (belum ada akun).
- **Emote** hanya boleh dari `DAFTAR_EMOTE` (`packages/meja/src/protokol.ts`), supaya tidak bisa dipakai mengirim pesan bebas. Celetukan bot (`Meja.celetukBot`) hanya boleh menanggapi peristiwa publik, tidak boleh membocorkan kartu.
- Jejak "kartumu di meja lawan" memakai `KartuDiMeja.dari`, yang diisi dari `StatePutaran.asalKartu` saat kartu jadi dipasang.
- Kartu digambar dengan Canvas 2D (`kartuGrafis.ts`), tanpa file gambar, supaya PWA jalan offline. Ikon PWA dibuat oleh `apps/client/scripts/buat-ikon.mjs` saat build.
- Mode dev menyediakan `window.__remi = { game, adegan }` untuk debug. Posisi objek ada di `adegan.children.list`, dengan koordinat ÷ dpr.

## Jebakan lingkungan (Windows)

**Vite dan port**
- Setelah banyak file diubah bertubi-tubi, Vite bisa menyajikan modul basi, misalnya error "does not provide an export named ...", atau halaman tampil tanpa CSS. Solusinya restart `npm run dev:client`, lalu hard refresh (Ctrl+Shift+R).
- Port 5173 dikunci (`strictPort`). Kalau masih dipakai proses lama, matikan proses `node ... vite.js`-nya dulu.

**Mengedit file**
- Jangan membuka file untuk ditulis sebelum isinya dibaca, misalnya `open(p,'w').write(open(p).read())` di Python, karena file akan kosong.
- Utamakan tool Edit/Write. Untuk perubahan besar lewat skrip, tulis skripnya ke file dulu, jangan lewat heredoc panjang di shell.

**Simpanan dan sesi di browser**
- Simpanan offline (`remi.mejaOffline`) dan sesi online (`remi.sesiOnline`) ada di `localStorage` per origin. `localhost:5173` dan `127.0.0.1:5173` adalah origin berbeda, dan berguna untuk menguji dua pemain di satu mesin.
- Service worker tidak bisa didaftarkan di browser pane alat pengembang. Uji PWA di Chrome atau HP sungguhan lewat HTTPS.

## Keputusan pemilik yang sering terlupa

Daftar lengkap ada di README. Yang paling sering terlupa:

**Kartu jadi**
- Seri angka hanya 2–10 (maksimal 9 kartu). Seri Londo hanya J-Q-K. Angka dan Londo tidak bisa disambung, dan As tidak bisa masuk seri.
- Kembar hanya untuk As, dan bunganya harus beda semua (3 atau 4 kartu). 3 As butuh kartu jadi lain, boleh yang diturunkan bersamaan di aksi yang sama.
- Joker pengganti jumlahnya ≤ kartu biasa dan tidak boleh dempet. Joker tidak bisa menggantikan Londo maupun As.

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
