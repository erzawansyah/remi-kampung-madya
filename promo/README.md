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

## Teaser A "Aman, aku seng menang" (animasi 2D)

Brief: [BRIEF-teaser-a.md](BRIEF-teaser-a.md) (bagian teknis merujuk [BRIEF-teaser-b.md](BRIEF-teaser-b.md)). Komposisi `TeaserA` (1080 × 1920, 30 fps, 43 dtk: 40 dtk cerita + 3 dtk khusus QR atas permintaan pemilik) di `src/a/`, disusun mengikuti skill Remotion di `.claude/skills/remotion-*`:

- `adegan/*.tsx`: satu komponen per adegan dengan frame lokal (`useCurrentFrame()` mulai 0 di tiap adegan), dirangkai `TransitionSeries` di `TeaserA.tsx` (transisi rewind sesudah cold open, fade ke penutup dan ke bagian QR). Panjang tiap adegan di `waktu.ts`.
- `kamera.tsx`: kamera 2.5D (CSS `perspective`, lapisan latar/meja/depan di `translateZ` berbeda), jadi dolly dan glide menghasilkan paralaks. `Panggung.tsx` merangkai lapisan itu, balon kata diproyeksikan dari mulut tokoh.
- `tokoh/rig.tsx` rig SVG (hadap kepala/badan, tunduk, IK lengan, ekspresi), `tokoh/pose.ts` kumpulan pose, `MejaKedai.tsx` meja oval, latar, benda, papan QR.
- Rekaman game lewat `<Video>` dan bunyi lewat `<Audio>` dari `@remotion/media` (`trimBefore`, `from`, `volume` inline). Efek WebGL `@remotion/effects` tidak dipakai karena menghasilkan frame kosong di Chrome headless lingkungan ini; vinyet dan warna memakai CSS.
- Musik latar dan bunyi fisik dari ElevenLabs (`npm run aset:eleven`, butuh `ELEVENLABS_API_KEY`): Eleven Music untuk musik kedai (bukan musik game) dan Sound Effects untuk tawa, kursi jatuh, gebrak, seruput, gelas retak, stempel, whoosh, dan suasana kedai. Bunyi game (buang, mulung, mentung, jotos, retak) tetap dari aplikasi.

Still lineup tokoh: komposisi `LineupA`.

Rekaman game (3 pemain, 1 deck, batas 2 putaran) direkam dari halaman Bang IT dengan virtual time (teknik sama dengan Teaser B):

```bash
# dari akar repo; seed dicari dulu (A1: Cak Owner mentung dan memungut kartu buangan Bang IT; A2: warga kedai mentung)
npx tsx promo/scripts/rekam/cari-seed-a.ts a1 1 200
npx tsx promo/scripts/rekam/cari-seed-a.ts a2 1 200
node promo/scripts/rekam/rekam-browser-a.mjs a1 174   # → promo/public/rekam/a1-*.{mp4,png}, rekam-a.json
node promo/scripts/rekam/rekam-browser-a.mjs a2 135
node promo/scripts/rekam/momen-a.mjs                  # momen kunci (detik video) → salin ke src/a/rekam.ts

cd promo
npm run aset      # aset dasar (kartu, logo, retak, font, musik, bunyi)
npm run aset:a    # bunyi sintesis cadangan (dipakai kalau aset ElevenLabs tidak ada)
npm run aset:eleven  # musik + bunyi dari ElevenLabs (ELEVENLABS_API_KEY)
npm run render:a  # out/teaser-a.mp4 (render + loudnorm −14 LUFS, true peak ≤ −1,5 dBTP)
npm run qa:a      # format, loudness, pindai QR dari still 34–38 dtk, hold diam, contact sheet
```

`meja-rekam-a.ts` sama dengan `meja-rekam.ts` tapi jeda lanjut 10 detik, supaya hasil putaran 1 bertahan saat Mas Sampul mengirim ledekan (`{t:'ledek'}`) yang direkam di layar Bang IT. Sesudah seed berubah, perbarui `src/a/rekam.ts` (detik buang, pungut, retak, ledek, dan posisi panel di layar HP dari still rekaman).
