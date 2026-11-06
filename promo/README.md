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
