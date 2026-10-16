# Deploy produksi: daftar cek

Ringkasan cara deploy ada di README (bagian "Deploy ke VPS (Docker)"). Dokumen ini berisi cek yang dijalankan sesudah deploy, beserta hasil uji terakhir di mesin pengembang.

## Deploy

```bash
git pull
GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build   # GIT_SHA opsional, lihat di bawah
docker compose ps            # STATUS "healthy" ±30 detik setelah start
docker compose logs --tail 5 # "Remi Kampung Madya v<versi> (<sha>) jalan di port 2567 ..."
```

`docker compose up` mengganti container dengan rapi: `SIGTERM` → server menutup WebSocket, meja, dan database → keluar dengan kode 0 (< 1 detik). Meja online yang sedang jalan hilang (meja hanya di memori), jadi pilih waktu sepi. Permainan offline di HP tidak terpengaruh.

### Rilis leaderboard (skema riwayat v1, keputusan #45)

Rilis ini menambah kolom di database riwayat (`PRAGMA user_version` 0 → 1). Migrasinya otomatis saat server start, dalam satu transaksi, dan kolom barunya boleh NULL atau punya bawaan, jadi image lama tetap bisa jalan di database v1 kalau deploy harus dibatalkan. Tetap ambil cadangan dulu **sebelum** `docker compose up`:

```bash
docker compose exec remi node --disable-warning=ExperimentalWarning -e "new (require('node:sqlite').DatabaseSync)('/app/data/remi.db').exec(\"VACUUM INTO '/app/data/cadangan-sebelum-v1.db'\")"
docker compose cp remi:/app/data/cadangan-sebelum-v1.db .
```

Sesudah start, log server memuat `skema riwayat dimigrasi v0 → v1`, biasanya disusul `riwayat dilengkapi: …` (baris lama diisi jumlah pemain, jumlah manusia, jumlah deck untuk meja 2–3 dan 5–6 orang, dan kunci nama). Start berikutnya tidak mencetak keduanya lagi. Meja 4 orang lama tetap `jumlah_deck` NULL (1 atau 2 deck tidak tercatat) dan tidak ikut saat leaderboard disaring per deck.

### Identitas build (`sha` di `/healthz`)

Setiap build punya satu id pendek yang sama di client dan server. Aplikasi di HP mencocokkannya dengan `sha` di `/healthz` untuk tahu server sudah memakai build lain (lihat "Perilaku update PWA"). Id dihitung `scripts/idBuild.mjs`, dipanggil build client (`apps/client/vite.config.ts`) dan bundel server (`apps/server/scripts/bundel.mjs`), dengan urutan:

1. **`GIT_SHA`** kalau diisi: commit hex 7–40 karakter, dipakai 7 karakter pertama. Nilai yang bukan commit (misalnya `refs/heads/main`) diabaikan dengan peringatan di log build.
2. **`git rev-parse --short=7 HEAD`** kalau folder proyek adalah puncak repo git (build di luar Docker). Sengaja tanpa akhiran `-dirty`: build sendiri menulis ulang `favicon.svg`, dan status kotor bisa berubah di antara build client dan server sehingga id keduanya beda.
3. **Hash isi sumber**, `h-` + 7 hex (misalnya `h-1a2b3c4`). Ini yang terpakai di Docker tanpa `GIT_SHA`, karena `.git` tidak ikut ke context. Dihitung dari isi semua file proyek dengan pengecualian yang sama seperti `.dockerignore` (`node_modules`, `dist`, `.git`, dan seterusnya), dan CRLF dianggap LF. Checkout yang sama di Windows dan Linux, atau build ulang dari isi yang sama, memberi id yang sama.

Jadi `GIT_SHA` sekarang opsional: tanpa itu pun pencocokan versi tetap jalan. Mengisinya tetap dianjurkan, karena `/healthz`, log server, dan layar Tentang lalu menampilkan commit yang bisa dicari di GitHub. `"sha":"dev"` hanya muncul dari dev server (`npm run dev:server`) atau image yang dibangun sebelum perubahan ini. `node scripts/idBuild.mjs` mencetak id untuk folder saat itu.

**Mengisi `GIT_SHA` dari penerima webhook GitHub** (event `push`). Contoh skrip yang dijalankan penerima webhook, dengan field `ref` dan `after` dari payload diteruskan sebagai `$REF` dan `$AFTER` (cara meneruskannya tergantung alat penerima webhook yang dipakai):

```bash
#!/bin/sh
set -e
# Webhook juga terkirim untuk push ke produksi dan branch lain: hanya main yang di-deploy.
[ "$REF" = "refs/heads/main" ] || exit 0
cd /jalan/ke/remi-kampung-madya
git pull --ff-only
GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build
```

`git rev-parse` sesudah `git pull` mencatat commit yang benar-benar dibangun, jadi itu pilihan utama. Field `after` (sha 40 karakter, otomatis dipotong jadi 7) juga bisa dipakai, `GIT_SHA="$AFTER" docker compose up -d --build`, asal tidak ada push lain yang masuk di antara webhook terkirim dan `git pull`. Kalau itu terjadi, yang tercatat commit lama padahal yang dibangun commit baru.

## Batas per jaringan (Wi-Fi kedai)

Semua HP yang memakai Wi-Fi kedai keluar lewat **satu IP publik**, jadi di mata server mereka satu jaringan. Bawaannya sudah dibuat longgar untuk itu (keputusan pemilik 13 Okt 2026, [keputusan-pemilik.md #39](keputusan-pemilik.md#k39)):

| Env | Bawaan | Artinya |
|---|---|---|
| `MAKS_MEJA_PER_IP` | 60 (dulu 20) | Meja yang masih ada per jaringan pembuatnya, termasuk meja yang sudah ditinggal tapi belum terhapus (±10 menit). Lewat batas: "Kebanyakan meja dari jaringanmu, Bos." |
| `MAKS_SAMBUNGAN_PER_IP` | 150 (dulu 50) | Sambungan WebSocket sekaligus per jaringan (IPv4 per alamat, IPv6 per /64). Lewat batas: handshake ditolak `429`. |
| `MAKS_MEJA` | 500 | Batas total meja di server. Satu jaringan tetap tidak bisa menghabiskannya. |

Kalau kedai sangat ramai dan pesan di atas mulai muncul, naikkan angkanya di `docker-compose.yml` (bagian `environment`, misalnya `- MAKS_MEJA_PER_IP=100`), lalu `docker compose up -d`. Di balik proxy, pastikan alamat pemain terbaca benar (`TRUST_PROXY`, lihat README): kalau tidak, semua pemain terlihat sebagai alamat proxy dan berbagi satu jatah.

## Cek sesudah deploy

Ganti `B` dengan `http://127.0.0.1:2567` (di VPS) atau `https://remi.domainkamu.com` (lewat proxy).

| Cek | Perintah | Hasil yang benar |
|---|---|---|
| Versi & commit | `curl -s $B/healthz` | `"ok":true`, `"versi"` = versi `package.json`, `"sha"` = commit pendek yang di-deploy (dengan `GIT_SHA`) atau `h-` + 7 hex (tanpa `GIT_SHA`), tidak pernah `"dev"` |
| Aset ber-hash | `curl -sI -H 'Accept-Encoding: br' $B/assets/<file>.js` | `cache-control: public, max-age=31536000, immutable`, `content-encoding: br` |
| Shell & SW | `curl -sI $B/` dan `curl -sI $B/sw.js` | `cache-control: no-cache` |
| Gzip | `curl -sI -H 'Accept-Encoding: gzip' $B/` | `content-encoding: gzip` |
| 404 | `curl -sI $B/assets/tidak-ada.js` | `404`, `cache-control: no-store` |
| Riwayat (bentuk lama) | `curl -s $B/api/peringkat` | JSON **array** (boleh kosong), dibaca aplikasi lama yang masih ter-cache di HP |
| Leaderboard v2 | `curl -s "$B/api/peringkat?v=2&urut=rata"` | JSON **objek** `{"v":2,"urut":"rata",…,"peringkat":[…],"belumCukup":[…]}` |
| Skema riwayat | `docker compose logs remi \| grep 'skema riwayat'` | sekali `skema riwayat dimigrasi v0 → v1` sesudah deploy rilis leaderboard |
| WebSocket | buka aplikasi → Buat meja baru | lobi muncul dengan kode meja |
| PWA | Chrome DevTools → Application | service worker `activated`, precache 12 entri, manifest tanpa error |
| Tombol pasang (Android) | buka situs di Chrome Android (bukan dari aplikasi yang sudah terpasang) | tombol **Pasang aplikasi** melayang di kanan bawah beranda; diketuk = jendela pasang Chrome (atau dialog petunjuk menu ⋮ kalau Chrome belum menawarkannya); **Nanti saja** menyembunyikannya dan tetap tersembunyi sesudah muat ulang; tidak ada di lobi maupun meja |
| Tombol pasang (iPhone) | buka situs di Safari iPhone | tombol **Pasang aplikasi** melayang; diketuk = dialog Bagikan → Tambah ke Layar Utama; sesudah dipasang, aplikasi dari layar utama tidak menampilkan tombol maupun ubin pasang. Dari browser bawaan Instagram/WhatsApp muncul dialog **Buka di browser dulu** dengan **Salin link** |

Lewat proxy, cek juga bahwa `sw.js` tetap `no-cache` (proxy tidak boleh menimpa header cache) dan `/ws` tersambung (Caddy meneruskan WebSocket otomatis).

## Perilaku update PWA

Versi baru dipasang **otomatis di momen aman**, jadi pemain yang cuma membuka lewat browser HP (tidak memasang ke layar utama) juga ikut terbarui tanpa menekan apa pun. Logikanya di `apps/client/src/pembaruan.ts` (fungsi keputusan murni, diuji `apps/client/test/pembaruan.test.ts`), dirangkai di `apps/client/src/main.ts`.

- `registerType: 'prompt'` tetap: service worker baru diunduh di latar belakang lalu **menunggu** sampai aplikasi menyuruhnya aktif. Jangan diganti `autoUpdate` (bisa memuat ulang di tengah permainan).
- **Cek versi baru:** saat aplikasi dibuka, saat kembali dari latar belakang atau sinyal kembali (jeda minimal 1 menit), dan berkala tiap 30 menit selama terbuka. Aplikasi juga membandingkan id build-nya dengan `sha` di `/healthz`; kalau server sudah memakai build lain, cek dipaksa. Pencocokan ini jalan dengan atau tanpa `GIT_SHA` (lihat "Identitas build"); hanya `dev` yang dilewati. Setiap sambungan online yang berhasil dicek tanpa jeda minimum (`PemicuCekServer`), termasuk sambungan pertama: jadi HP yang membuka aplikasi beberapa detik sebelum deploy selesai lalu langsung masuk meja tetap tahu server sudah baru. Sesudah server di-deploy ulang, HP yang sedang tersambung mengecek begitu sambungannya pulih, dan juga saat meja terakhirnya sudah tidak ada di server ("Meja X nggak ketemu.").
- **Momen aman, dipasang sendiri:** di beranda saat pemain diam ±5 detik (toast "Pakai versi terbaru, sebentar ya…" ±2 detik, lalu muat ulang; disentuh = batal), atau kapan pun aplikasi sedang di latar belakang.
- **Momen senyap, hanya ditawarkan selama terlihat:** lobi online, daftar meja, riwayat, klasemen akhir yang sudah tercatat, jeda antarputaran online. Toast "Ada versi baru, Bos." dengan tombol **Muat ulang**, dan tombol menetap di kaki beranda. Begitu aplikasi ke latar belakang, versi baru dipasang.
- **Tidak pernah:** putaran berjalan, susun akhir, popup joker, panel mentung, meja offline yang belum selesai, dialog terbuka, sedang mengetik, atau menunggu jawaban server.
- **Anti-loop:** paling banyak 2 kali muat ulang otomatis per build di satu tab (dicatat di `sessionStorage`); sesudahnya hanya tawaran manual.
- Sesudah muat ulang, toast "Sudah pakai versi terbaru, v…" muncul, versi baru aktif, dan simpanan permainan offline (`remi.mejaOffline`) tetap ada. Sesi online tersambung lagi sendiri pakai token.
- **Syarat:** HTTPS sungguhan (service worker hanya jalan di HTTPS atau `localhost`), dan proxy tidak menimpa `Cache-Control` (`sw.js` dan `index.html` harus `no-cache`). Browser tanpa service worker dimuat ulang biasa di momen aman kalau `/healthz` menunjukkan build lain.

Hasil uji di bawah masih untuk perilaku lama (toast + tombol Muat ulang). Perilaku otomatis di atas perlu diuji ulang di mesin pengembang dan di HP sungguhan lewat HTTPS.

## Hasil uji di mesin pengembang (Docker Desktop 29.8, Chrome 155, 13 Okt 2026)

Image `node:24-alpine`, 246 MB (aplikasi ±3,2 MB), user `node`.

| Pemeriksaan | Hasil |
|---|---|
| `docker build` penuh (typecheck + 1191 test + build) | lulus, ±80 detik; typecheck yang gagal menggagalkan build |
| `/healthz` versi & sha | `{"ok":true,"meja":0,"versi":"0.2.0","sha":"9463cc5"}` |
| Header cache & kompresi (`/assets` immutable, shell/SW/manifest/ikon/font `no-cache`, br/gz/identity, 404 `no-store`) | lulus |
| WebSocket `/ws`: ping/pong, buat meja, 1 putaran lawan warga kedai sampai selesai | lulus, klasemen tersimpan di SQLite |
| Data SQLite tetap ada setelah restart dan setelah container dibuat ulang (volume) | lulus |
| Cadangan `VACUUM INTO` selagi server jalan | lulus |
| `docker stop` dengan WebSocket aktif | 0,7–1,7 detik, kode keluar 0 (diulang dengan kode server terbaru: log "SIGTERM diterima, server berhenti…") |
| Healthcheck | `healthy` |
| SW terdaftar, precache 12 entri, toast "tersimpan di HP" | lulus |
| Manifest (name, id, start_url, scope, display, warna, ikon 192/512/maskable sesuai ukuran asli); Chrome: tanpa installability error | lulus |
| Container dimatikan + browser offline → reload → beranda tampil, font termuat, main offline lawan warga kedai | lulus |
| Update di tengah putaran: SW baru `waiting`, tanpa toast, tanpa reload (diamati 13 detik) | lulus |
| Keluar ke beranda → toast + tombol Muat ulang → versi baru aktif, simpanan offline tetap ada | lulus |

Belum diuji: HTTPS sungguhan di balik Caddy, pemasangan ke layar utama di HP sungguhan, dan job CI Docker/E2E di runner GitHub.

## Uji identitas build (Docker Desktop 29.7.2, 14 Okt 2026)

Snapshot commit `fa67225` tanpa folder `.git`, ditambah perubahan identitas build.

| Pemeriksaan | Hasil |
|---|---|
| `npm run build` di Windows tanpa `GIT_SHA` | client dan server sama-sama `h-34e62ae`, sama juga sebelum dan sesudah build |
| Isi yang sama dengan akhir baris CRLF (seperti checkout Windows) | `h-34e62ae` |
| `docker build` tanpa `GIT_SHA` (Linux) | client dan server `h-34e62ae`; `/healthz` → `"sha":"h-34e62ae"`, id yang sama ada di bundel client |
| `GIT_SHA` = sha 40 karakter, lokal dan `docker build --build-arg` | client dan server `fa67225`; cek CI (`sha` = 7 karakter pertama `GITHUB_SHA`) lulus |
| `GIT_SHA=refs/heads/main` | peringatan di log build, lalu memakai hash isi |
| Build di repo git tanpa `GIT_SHA` | client dan server = `git rev-parse --short HEAD` |
