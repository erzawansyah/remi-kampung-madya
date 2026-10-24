# Deploy produksi: daftar cek

Ringkasan cara deploy ada di README (bagian "Deploy ke VPS (Docker)"). Dokumen ini berisi cek yang dijalankan sesudah deploy, beserta hasil uji terakhir di mesin pengembang.

## Deploy

```bash
git pull
GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build   # GIT_SHA opsional, lihat di bawah
docker compose ps            # STATUS "healthy" ±30 detik setelah start
docker compose logs --tail 5 # "Remi Kampung Madya v<versi> (<sha>) jalan di port 2567 ..."
```

`docker compose up` mengganti container dengan rapi: `SIGTERM` → server menulis meja yang belum tersimpan, menutup WebSocket dan database → keluar dengan kode 0 (< 1 detik). Meja online yang sedang jalan **dipulihkan** saat server baru jalan (lihat "Meja selamat dari restart" di bawah): HP pemain menyambung lagi sendiri dan kembali ke kursinya. Permainan offline di HP tidak terpengaruh.

### Meja selamat dari restart (skema riwayat v4, 24 Okt 2026)

Setiap meja online disimpan di database yang sama dengan riwayat (tabel `meja_aktif`, migrasi v4), paling lambat 1 detik sesudah berubah, dan semuanya ditulis saat `SIGTERM`. Saat start, server memulihkan meja itu sebelum menerima sambungan, lalu mencatat `meja KODE dipulihkan (main, 3 manusia)` per meja dan `N dari M meja tersimpan dipulihkan`.

- Semua pemain dianggap terputus, jadi permainan dijeda sampai ada yang kembali. HP pemain menyambung ulang sendiri (kode 1001) dan masuk ke kursinya dengan token lama. Pemain yang belum kembali mendapat masa tenggang penuh (20 detik) sejak orang pertama kembali, baru gilirannya dijalankan warga kedai. Giliran yang sedang jalan mendapat waktu penuh lagi.
- Host tidak pindah ke siapa pun yang kembali duluan: saat deploy semua HP menyambung ulang hampir bersamaan. Host lama ditunggu selama masa tenggang (20 detik) sejak orang pertama kembali; kalau belum kembali juga, baru host pindah ke pemain lain yang terhubung (aturan host yang biasa).
- Tidak dipulihkan, dan simpanannya dibuang dengan alasan di log (`simpanan meja KODE dibuang: …`): permainan yang sudah selesai (klasemen akhirnya sudah tercatat, jadi tidak pernah tercatat dua kali), simpanan rusak, simpanan yang 24 jam tidak berubah, meja tanpa pemain manusia, meja kompetisi yang kompetisinya sudah tidak ada, dan meja kompetisi di lobi yang kompetisinya sudah tidak berjalan. Simpanan permainan meja kompetisi yang dibuang dengan cara ini mencatat yang keluar 0 dulu (keputusan "Yang keluar selalu dicatat 0", skema riwayat v5). Kalau pencatatannya gagal, simpanannya tidak dibuang dan dicoba lagi tiap 30 detik, dan juara kompetisinya menunggu sampai tercatat.
- Kalau proses mati mendadak (`SIGKILL`, listrik VPS), perubahan ±1 detik terakhir bisa hilang: meja dipulihkan ke keadaan sedikit sebelumnya.
- Meja tanpa manusia terhubung dihapus sesudah **45 menit** kalau sedang main dan masih ada pemain yang bisa kembali, supaya pemain sempat kembali sesudah deploy atau Wi-Fi kedai mati. Lobi, permainan yang sudah selesai, dan meja biasa yang semua pemainnya sudah menekan Keluar (tinggal warga kedai) dihapus sesudah 10 menit. Meja kompetisi yang semua pesertanya sudah menekan Keluar langsung ditutup: yang keluar dicatat 0 dulu (log `permainan meja KODE ditinggal: N yang keluar dicatat 0 di kompetisi K`), lalu `meja KODE dihapus (semua peserta menekan Keluar)`. Meja kompetisi yang dihapus karena 45 menit kosong juga mencatat yang keluar 0 dulu. Kalau pencatatan itu gagal, meja dan simpanannya dibiarkan dan dicoba lagi tiap 30 detik. Simpanannya ikut dihapus; meja biasa yang tinggal warga kedai sudah tidak disimpan lagi sejak orang terakhir keluar.
- `HEALTHZ_DETAIL=1` menambah `mejaMain` di `/healthz`: meja yang sedang dimainkan, yaitu sedang main dengan paling sedikit satu pemain terhubung. Meja yang ditinggal semua orang (dijeda, dipulihkan tapi belum didatangi, atau tinggal warga kedai) tidak dihitung. Skrip deploy boleh menunggu sampai angkanya 0, tapi itu tidak wajib lagi. Ringkasan `status:` di log memakai angka yang sama (`meja N (main M)`).
- `SIMPAN_MEJA=0` mematikan fitur ini (meja kembali hanya di memori, simpanan lama tidak dipulihkan).

**Database ini sekarang memuat token pemain** (dipakai untuk sambung ulang) dan alamat jaringan pembuat meja selama mejanya masih ada. Volume `remi-data` dan cadangannya (`VACUUM INTO`, salinan `docker compose cp`) harus tetap privat: jangan diunggah ke tempat umum atau dibagikan. Baris meja dihapus begitu mejanya bubar.

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
| `MAKS_MEJA_PER_IP` | 60 (dulu 20) | Meja yang masih ada per jaringan pembuatnya, termasuk meja yang sudah ditinggal tapi belum terhapus (±10 menit di lobi, ±45 menit kalau sedang main). Lewat batas: "Kebanyakan meja dari jaringanmu, Bos." |
| `MAKS_SAMBUNGAN_PER_IP` | 150 (dulu 50) | Sambungan WebSocket sekaligus per jaringan (IPv4 per alamat, IPv6 per /64). Lewat batas: handshake ditolak `429`. |
| `MAKS_MEJA` | 500 | Batas total meja di server. Satu jaringan tetap tidak bisa menghabiskannya. |

Kalau kedai sangat ramai dan pesan di atas mulai muncul, naikkan angkanya di `docker-compose.yml` (bagian `environment`, misalnya `- MAKS_MEJA_PER_IP=100`), lalu `docker compose up -d`. Di balik proxy, pastikan alamat pemain terbaca benar (`TRUST_PROXY`, lihat README): kalau tidak, semua pemain terlihat sebagai alamat proxy dan berbagi satu jatah.

## Usul fitur ke Notion

Pemain bisa mengirim usulan dari beranda (ubin **💡 Usul fitur**) atau dari layar Tentang yang dibuka di beranda. Server menyimpan setiap usulan di database SQLite (tabel `usulan`, skema riwayat v3; alamat IP pengirim tidak disimpan), lalu meneruskannya ke database Notion **Permintaan Fitur** sebagai baris baru: Judul, Isi usulan, Pengusul (nama pemain), Sumber `Game`, Jenis (kalau dipilih), Status `Baru`, dan ID server. Kolom lain (Keputusan agent, Prioritas, PR, Versi, Ditinjau) dibiarkan kosong untuk peninjauan harian.

Tanpa pengaturan di bawah, usulan tetap diterima dan disimpan. Begitu Notion diatur dan container dibuat ulang, usulan yang tertunda terkirim sendiri ±10 detik sesudah server jalan.

**Langkah pemilik (sekali saja):**

Nama menu di Notion cukup sering berganti. Kalau tulisannya sedikit beda dari di bawah, pilih yang paling mirip; yang penting hasilnya: ada integrasi **internal** yang boleh membaca dan menambah konten, token-nya sudah disalin, dan integrasi itu terhubung ke database Permintaan Fitur. (Langkah ini dicocokkan dengan panduan Notion per 24 Okt 2026.)

1. Buka https://www.notion.so/profile/integrations dengan akun pemilik workspace (hanya pemilik workspace yang boleh membuat integrasi). Notion bisa mengalihkannya ke **Developer portal → Connections** (`app.notion.com/developers/connections`); itu tempat yang sama. Pilih **New integration** (bisa juga bernama **New connection**), isi nama (misalnya `Remi Kampung Madya`), pilih workspace yang berisi database Permintaan Fitur, tipe **Internal**, lalu simpan.
2. Buka tab **Configuration** integrasi itu. Semua yang dibutuhkan ada di tab ini:
   - Di bagian **Capabilities**, pastikan **Read content** dan **Insert content** dicentang (cukup itu; server hanya membuat baris baru). Tekan **Save** kalau ada.
   - Salin token-nya, yang disebut **Internal Integration Secret** atau **API token** (diawali `ntn_` atau `secret_`; mungkin perlu klik **Show** dulu). Simpan baik-baik, jangan ditempel di chat, issue, atau commit.
3. Hubungkan integrasi ke database. Buka database **Permintaan Fitur** di Notion, klik **•••** di kanan atas, buka **More** kalau ada, lalu di bagian **Connections** pilih **Add connections** → cari nama integrasi tadi → pilih (tekan **Confirm** kalau ditanya). Cara lain: di pengaturan integrasi, buka tab **Access**, lalu pilih database Permintaan Fitur. Tanpa langkah ini Notion menjawab `object_not_found` walau token benar.
4. Di VPS, di folder proyek (sebelah `docker-compose.yml`), buat atau tambahkan ke file `.env`:

   ```bash
   NOTION_TOKEN=ntn_isi_token_dari_langkah_2
   NOTION_USULAN_DB=d31d1a9e7a7a44cf963bab9777f02e4a
   ```

   Lalu `chmod 600 .env`. File `.env` diabaikan git dan `.dockerignore`, jadi tidak ikut ke repo maupun ke image; `docker compose` membacanya dan meneruskan keduanya sebagai environment container. `NOTION_USULAN_DB` boleh juga ditulis dengan tanda hubung atau berupa tautan database yang disalin dari browser.
5. Buat ulang container supaya environment baru terbaca: `docker compose up -d` (atau tunggu deploy berikutnya dari webhook, yang menjalankan `docker compose up -d --build`).
6. Cek log:

   ```bash
   docker compose logs remi | grep 'usul fitur'
   # usul fitur: diteruskan ke Notion (database d31d1a9e…)
   ```

   Kalau yang muncul `usul fitur: Notion belum diatur …` atau `… NOTION_TOKEN kosong …`, isi `.env` belum terbaca: pastikan namanya persis `.env` dan letaknya di sebelah `docker-compose.yml`, lalu ulangi langkah 5.
7. Kirim satu usulan uji dari game (beranda → **💡 Usul fitur**). Di log muncul `usulan #N masuk` lalu `usulan #N terkirim ke Notion`, dan barisnya tampil di database dengan Status `Baru` dan Sumber `Game`. Baris uji boleh dihapus di Notion.

**Kalau gagal**, lognya satu baris per percobaan, tanpa token dan tanpa isi usulan:

| Di log | Artinya |
|---|---|
| `HTTP 401 unauthorized` | Token salah atau sudah dicabut. Salin ulang token (langkah 2), perbarui `.env`, ulangi langkah 5. |
| `HTTP 404 object_not_found` | Integrasi belum dihubungkan ke database (langkah 3), atau `NOTION_USULAN_DB` salah. |
| `HTTP 400 validation_error` | Nama atau tipe kolom di Notion berubah (misalnya Judul, Isi usulan, Pengusul, Sumber, Jenis, Status, atau ID server diganti nama, atau opsi Status `Baru` dihapus). Kembalikan namanya, atau minta pengembang menyesuaikan `apps/server/src/notion.ts`. |
| `Notion tidak terjangkau: …` | Jaringan VPS ke `api.notion.com` bermasalah. Dicoba lagi sendiri. |

Usulan yang gagal dicoba lagi di putaran kirim (tiap 5 menit) dengan jeda yang makin panjang (5, 10, 20 menit, … paling lama 6 jam), sampai 20 percobaan (yang terakhir ±3,5 hari sesudah gagal pertama). Sesudah itu berhenti dicoba, tapi barisnya tetap di database. Untuk mengirim ulang semuanya sesudah masalahnya dibereskan:

```bash
docker compose exec remi node --disable-warning=ExperimentalWarning -e "new (require('node:sqlite').DatabaseSync)('/app/data/remi.db').exec('UPDATE usulan SET percobaan = 0 WHERE terkirim_pada IS NULL')"
docker compose restart remi
```

**Batas:** paling banyak 5 usulan per jaringan per jam (semua HP di Wi-Fi kedai dihitung satu jaringan) dan 200 usulan per 24 jam untuk seluruh server. Judul 3–80 huruf, isi 10–1000 huruf.

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
| Skema riwayat | `docker compose logs remi \| grep 'skema riwayat'` | sekali `skema riwayat dimigrasi v0 → v1` sesudah deploy rilis leaderboard (0.2.0); sekali `skema riwayat dimigrasi v1 → v5` sesudah deploy rilis 0.5.0 (v2 kompetisi, v3 `usulan`, v4 `meja_aktif`, v5 `hasil_kompetisi_ditinggal`) |
| Usul fitur | `docker compose logs remi \| grep 'usul fitur'` | `usul fitur: diteruskan ke Notion (database d31d1a9e…)` kalau `NOTION_TOKEN` dan `NOTION_USULAN_DB` diisi (lihat "Usul fitur ke Notion"); tanpa keduanya `usul fitur: Notion belum diatur (NOTION_TOKEN, NOTION_USULAN_DB), usulan disimpan dulu di database` |
| Meja dipulihkan | `docker compose logs remi \| grep 'dipulihkan'` | sesudah deploy di tengah permainan: `meja KODE dipulihkan (…)` per meja, lalu `N dari M meja tersimpan dipulihkan`; pemain yang sedang main kembali ke kursinya sendiri |
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
