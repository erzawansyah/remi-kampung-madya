# Video promosi Remi Kampung Madya

Proyek [Remotion](https://www.remotion.dev/) untuk teaser Reels (1080 × 1920, 30 fps, ±42 detik). Folder ini **bukan workspace** monorepo: tidak ikut `npm test`, `npm run typecheck`, build, maupun image Docker.

## Isi teaser

Dua tujuan sekaligus: memperkenalkan Kedai Madya sebagai tempat main remi, dan mengintip game-nya tanpa membuka alamat situsnya (versi online belum dibuka untuk umum). Urutannya: Kedai Madya (bio IG dan alamat), "di sini sering main remi", tiga aturan singkat (joker diumumkan sekali, kembar As, seri Londo), cerita satu putaran sungguhan (8 Wajik dibuang, dipungut Mbak Teras jadi 8-9-10 Wajik, lalu dipentung joker 6 Wajik: −290), nama-nama warga kedai, dan penutup "Versi online-nya lagi disiapkan. Sementara itu, main langsung di Kedai Madya."

Semua teks mengikuti README (aturan) dan `apps/client/src/konten/kedai.ts` (fakta kedai). Kalau aturan berubah, cek ulang adegan aturan di `src/Teaser.tsx`.

## Aset diambil dari kode game

`npm run aset` menyalakan Vite dev server client, membuka Chromium headless, lalu memanggil kode game langsung:

- kartu dan punggung kawung: `apps/client/src/game/kartuGrafisGambar.ts`
- logo Kedai Madya: `apps/client/src/aset/logoMadya.ts`
- retakan kaca kepentung: `apps/client/src/efek/retak.ts`
- musik latar dan bunyi kartu: `rekamMusik()` dan `rekamBunyi()` di `apps/client/src/efek/` (direkam offline, `Math.random` diberi benih supaya hasilnya sama tiap kali)
- font Baloo 2: `apps/client/public/font`

Hasilnya di `public/aset/` (diabaikan git), jadi tampilan dan bunyi video selalu sama dengan aplikasi.

## Menjalankan

```bash
npm install            # di akar repo (butuh vite dan playwright-core dari sana)
cd promo
npm install
npm run aset           # ambil aset dari kode game
npm run studio         # pratinjau di browser
npm run render         # out/teaser-reels.mp4 (suara dinormalkan ke -14 LUFS untuk Reels)
```

Chromium: `npm run aset` memakai `CHROME_PATH`, lalu `/opt/pw-browsers/chromium`, lalu bawaan Playwright. Remotion memakai `CHROME_PATH` kalau diisi (sebaiknya Chrome Headless Shell); kalau kosong ia mengunduh sendiri.

## Teaser B "Info room?" (`TeaserB`)

Teaser kedua (1080 × 1920, 30 fps, 47 detik) mengikuti brief final di [BRIEF-teaser-b.md](BRIEF-teaser-b.md): chat grup tokoh karangan (Kamu, Dimas, Ayu, Rendi), tiga putaran rekaman game asli (dipentung teman, dipentung warga kedai, lalu menang di Kedai Madya tapi yang dipentung ternyata warga kedai), penutup ajakan, stempel BUKAN JUDI ONLINE, lalu loop. Komposisinya di `src/b/` (`TeaserB.tsx` alur dan audio, `Chat.tsx`, `Hp.tsx`, `Lokasi.tsx`, `MejaKedai.tsx` termasuk papan QR, `Stempel.tsx`, `efek.tsx` kamera dan lapisan, `waktu.ts` semua konstanta frame, `rekam.ts` titik waktu di rekaman).

### Merekam game asli (`scripts/rekam/`)

Semua visual game adalah rekaman aplikasi sungguhan, bukan tiruan. Alatnya:

- `meja-rekam.ts`: server game asli dengan seed permainan tetap (`SEED_REKAM`, mengganti `randomBytes(4)`) **dan** `Math.random` ber-seed (mulberry32), karena nama warga kedai diacak dengan `Math.random` dan gaya mainnya mengikuti nama. Batas pesan per detik dilonggarkan supaya pencari seed bisa memainkan satu putaran dalam sedetik.
- `otomatis.ts`: pemain otomatis (strategi Normal, Rng tetap) yang hanya bergantung pada view, dipakai pencari seed dan browser.
- `konfig.ts`: tiga klip (R1 empat manusia, R2/R3 kursi 3 warga kedai) beserta siapa yang mentung dan kepentung.
- `cari-seed.ts`: `npx tsx promo/scripts/rekam/cari-seed.ts r1 1 1500` mencari seed yang putaran pertamanya cocok, diurutkan dari yang terpendek (env `PORT_CARI` untuk menjalankan beberapa pencarian sekaligus).
- `rekam-browser.mjs`: `node promo/scripts/rekam/rekam-browser.mjs r1 41` menyalakan server rekam, Vite dev client, dan HP tiruan Chromium 390 × 844 untuk tiap kursi manusia, memainkan putarannya, lalu menulis `public/rekam/r1-kamu.mp4` (1170 × 2532, 30 fps), jepretan PNG momen kunci (lobi, retak, panel, hasil; R3 juga layar Dimas dengan panel warga kedai yang retak), dan `rekam.json` (kode meja, seed, hasil, momen dalam detik video). Hasilnya diperiksa cocok dengan pencarian seed.
  - Halaman "Kamu" direkam di Chrome biasa lewat screencast CDP. Aplikasi dimuat di `<iframe>` 390 × 844 dengan CSS `zoom: 3` di halaman 1170 × 2532, jadi frame-nya resolusi penuh dan kanvasnya digambar tajam.
  - Phaser dipaksa memakai renderer Canvas (WebGL dimatikan di semua HP tiruan). Tanpa GPU, WebGL jatuh ke rasterizer software yang kadang hanya menggambar separuh segitiga tiap kartu, jadi kartu tampil bolong, terpotong, dan berkedip. Canvas adalah jalur cadangan Phaser yang sama dengan di HP tanpa WebGL.
  - Karena tanpa GPU kanvas 3× hanya tergambar ±6–9 fps, halaman Kamu diperlambat 8× (`DILASI_REKAM`): jam halaman, timer, requestAnimationFrame, dan animasi CSS. Jeda warga kedai di server dan jeda pemain lain ikut dikali 8, lalu cap waktu frame dibagi 8 saat disusun jadi video 30 fps. Satu putaran butuh ±10 menit.
  - Jangan kembali ke `--enable-begin-frame-control` + virtual time (dipakai di versi pertama): cara itu juga menjepret kanvas sebelum selesai digambar.
- `momen.mjs`: `node promo/scripts/rekam/momen.mjs r1` mencetak momen kunci dari `rekam.json` (kartu dibuang, dipungut, pentungan, retak) untuk diisi ke `src/b/rekam.ts`.

Seed yang dipakai sekarang: R1 41, R2 16, R3 133 (lihat `src/b/rekam.ts`). Rekaman (`public/rekam/`) dan hasil render (`out/`) diabaikan git.

### Efek suara ElevenLabs

Bunyi game (kartu, pentungan, retak, notifikasi, pop) tetap diambil dari kode game lewat `npm run aset`. Untuk bunyi non-game (whoosh transisi, stempel "DOK", flash pindah ke kedai, dan suasana kedai malam) dipakai sound generation ElevenLabs: `ELEVENLABS_API_KEY=... npm run sfx` menulis `public/aset/el-*.wav` (diabaikan git; `--ulang` untuk membuat ulang). Tanpa voice over, sesuai brief.

### Tambahan di luar brief

- Kartu khusus QR 3 detik di paling akhir (44–47 dtk, sesudah stempel dan chat "Info room?"), QR ±720 px di tengah zona aman, supaya bisa dipindai dari layar lain. Durasi jadi 47 detik (brief: 44).
- Bubble "Info room?" penutup muncul 1 detik sebelum akhir (brief: 0,2 detik) supaya sempat terbaca sebagai loop.

### Render

```bash
npm run still:b -- out/still.png --frame=450 --scale=0.5   # cek satu frame
npm run render:b                                           # out/teaser-b.mp4 (loudnorm -14 LUFS, TP -1,5)
```

