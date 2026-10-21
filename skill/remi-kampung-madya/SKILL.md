---
name: remi-kampung-madya
description: Ikut main Remi Kampung Madya (game kartu remi aturan tongkrongan Kedai Madya, remi-madya.likrea.biz.id) sebagai pemain di meja online lewat WebSocket, dengan client siap pakai, aturan lengkap, dan pilihan gaya main. Pakai skill ini setiap kali pengguna mengajak main remi, memberi kode meja 5 huruf (misalnya "gabung meja ZMRJG", "ayo main, mejanya WPUAF, namamu Claude"), menyebut Remi Kampung Madya, Kedai Madya, mentung, mulung, atau kaldu, atau meminta AI jadi pemain/lawan di game remi tersebut, walau tidak menyebut kata "skill".
compatibility: Butuh Node.js 22+ (WebSocket global), akses jaringan ke wss://remi-madya.likrea.biz.id, dan tool untuk menjalankan perintah shell serta proses latar belakang.
---

# Main Remi Kampung Madya

Kamu ikut main sebagai satu pemain biasa di meja online, bersama manusia dan "warga kedai" (pemain komputer). Aturannya aturan tongkrongan Kedai Madya yang **berbeda dari remi/rummy umum**. Jangan pakai aturan remi dari ingatanmu; pakai `references/aturan.md`. Server memvalidasi setiap aksi, jadi kalau ditolak, baca pesannya dan perbaiki.

## Yang dibutuhkan dari pengguna

- **Kode meja** (5 huruf, misalnya `ZMRJG`), atau permintaan membuat meja baru.
- **Nama** untukmu di meja (maks 16 huruf). Kalau tidak diberi, pakai nama modelmu ditambah "AI", misalnya "Claude AI", supaya manusia tahu lawannya AI.
- Opsional: **gaya main** (lihat `references/gaya/README.md`; bawaan `seimbang`), dan alamat server lain (bawaan server live).

Kalau kode meja belum ada, tanyakan. Jangan menebak kode.

## Persiapan (sekali per meja)

1. Baca `references/aturan.md` sampai habis sebelum giliran pertama, lalu `references/strategi.md` dan file gaya yang dipakai. Aturan ini pendek tapi banyak yang berlawanan dengan remi umum (contoh: joker tidak bisa menggantikan Londo maupun As, kartu tidak boleh ditempel ke kartu jadi yang sudah ada, habis ambil dari deck tidak bisa nutup).
2. Pastikan `node --version` ≥ 22.
3. Jalankan client sebagai **proses latar belakang** yang terus hidup (jangan di foreground, karena ia tidak pernah selesai). `<skill>` = folder skill ini:
   ```bash
   node <skill>/scripts/klien.mjs --kode ZMRJG --nama "Claude AI" --data ./.remi-ZMRJG
   ```
   Buat meja baru (kamu jadi host): `--buat --nama "Claude AI" --pengaturan '{"jumlahPemain":4,"detikGiliran":0,"publik":true}'`.
   Opsi lain: `--server ws://localhost:2567/ws` (server lokal), `--port 9334` (kalau 9333 dipakai; set juga `REMI_PORT=9334` untuk `remi.mjs`).
   Folder `--data` menyimpan token kursi. Kalau client mati atau putus, jalankan lagi dengan `--kode` dan `--data` yang sama supaya kembali ke kursi lama (di lobi, kursi yang terputus tidak dikosongkan dan host tidak bisa melepasnya).
4. Cek: `node <skill>/scripts/remi.mjs lihat`. Harus tertulis "tersambung" dan kursimu.
5. **Kalau kamu host** (membuat meja sendiri, atau host lama keluar):
   - Atur sesuai permintaan pengguna: `remi host atur '{"batasPutaran":3,"detikGiliran":0,"tempoBot":"cepat"}'`. Field: `jumlahPemain` (2–6), `duaDeckUntukEmpat`, `batasPutaran` (angka/null), `batasSkorAtas`, `batasSkorBawah` (kelipatan 10/null), `publik`, `detikGiliran` (0 = tanpa batas), `levelBot` (`mudah`/`normal`/`jago`/`suhu`), `tempoBot` (`santai`/`normal`/`cepat`), `modeKaldu`. Semuanya juga bisa langsung lewat `--pengaturan` saat `--buat`. `levelBot` hanya level bawaan untuk warga kedai yang mengisi kursi nanti; ia tidak mengisi kursi sendiri.
   - Kursi kosong diisi orang yang masuk dengan kode meja, atau warga kedai: `remi host bot <kursi> <level>` (kursi mulai dari 0; kursi 0 biasanya kamu). Permainan baru bisa dimulai kalau tidak ada kursi kosong.
   - `remi host mulai`. Kalau pengguna akan ikut main, tunggu dia masuk dulu (`remi tunggu` bangun saat ada yang duduk).
6. Kabari pengguna singkat: sudah duduk di kursi berapa, siapa saja di meja, dan pengaturannya. Kalau waktu per giliran 30–60 detik, sarankan host menaikkannya ke 120 detik atau tanpa batas. Kamu butuh waktu berpikir, dan lewat batas giliranmu dijalankan warga kedai.

## Loop permainan

Semua lewat `node <skill>/scripts/remi.mjs <perintah>` (selanjutnya ditulis `remi`). Setiap perintah aksi menunggu jawaban server lalu mencetak ringkasan meja terbaru, termasuk baris `DITOLAK: ...` kalau aksi tidak sah.

```
remi tunggu 100      # tunggu sampai perlu aksimu atau ada kejadian penting (≤ batas timeout tool shell-mu)
```

Baca baris terakhir ringkasan:

| Baris terakhir | Yang dilakukan |
|---|---|
| `PERLU AKSIMU: catat angka joker` | Catat angka joker di catatanmu sendiri, lalu `remi siap`. Permainan menunggu semua manusia menekan OK, jadi jangan lama. |
| `giliranmu, tahap 'ambil'` | Putuskan mulung atau ambil (lihat Cara memutuskan), lalu `remi mulung ...` atau `remi ambil`. |
| `giliranmu, tahap 'main'` | Opsional `remi turunkan ...`, lalu wajib `remi buang <id>`. |
| `susun akhir` | Turunkan kartu jadi yang bisa dari tangan (`remi turunkan ...`, tanpa mulung, boleh sampai habis), lalu `remi selesai`. Kirim `selesai` hanya kalau baris ini muncul: kalau tanganmu sudah kosong (misalnya kamu yang mentung) atau semua sudah selesai, fase ini lewat sendiri. |
| `Belum giliranmu` | `remi tunggu 100` lagi. |
| `PUTARAN SELESAI` | Kabari skor ke pengguna. Kalau kamu host, `remi host berikut` sesudah jeda singkat; kalau bukan, `remi tunggu`. |
| `PERMAINAN SELESAI` | Laporkan klasemen, lalu `remi keluar`, kecuali pengguna minta main lagi. Berhenti memanggil `tunggu`. |
| `LOBI` | Tamu: `remi tunggu`. Host: lihat langkah 5 Persiapan. |

- Perhatikan `sisa waktu giliran` kalau meja memakai batas waktu: putuskan dalam waktu itu.

### Perintah

```
remi lihat | tunggu [detik] | json
remi siap
remi ambil
remi mulung <k> <kombinasi> [kombinasi...]     # k kartu teratas buangan
remi turunkan <kombinasi> [kombinasi...]
remi buang <id>                                # atau: remi buang <joker1> <joker2> untuk nutup pakai beberapa joker
remi selesai
remi emote <teks>                              # celetukan/pesan, maks 60 huruf
remi akhiri ya|tidak    remi kaldu ya|tidak     # voting antarputaran
remi host mulai|berikut|mainlagi|bot <kursi> [mudah|normal|jago|suhu]|kosong <kursi>|atur '<json>'
remi kirim '<json>'     remi keluar
```

**Kombinasi** = id kartu dipisah koma, persis seperti di ringkasan (`waru-13-0` = K♠). Joker yang **menggantikan** kartu lain ditulis `id=angka`; bunganya mengikuti kartu biasa di kombinasi itu, atau tulis `id=angka:bunga`. Joker yang dipakai sebagai kartu aslinya ditulis biasa tanpa `=`.

```
remi mulung 1 waru-6-0,waru-7-0,waru-8-0
remi mulung 2 waru-3-0,waru-4-0,waru-5-0,waru-6-0          # 3♠ teratas + 5♠ di bawahnya, 4♠ 6♠ dari tangan
remi turunkan wajik-4-0,wajik-5-0,love-9-0=6               # joker 9♥ sebagai 6♦
remi mulung 1 kriting-6-0,kriting-7-0,kriting-8-0 waru-6-0,waru-7-0,waru-8-0   # dua kombinasi sekaligus
```

## Cara memutuskan

**Di tahap ambil**, periksa mulung dulu, baru deck. Untuk setiap k dari 1 sampai jumlah pemain − 1 (buangan terlihat, urutan bawah → ATAS, k kartu teratas):
1. Kartu **paling bawah** dari k kartu itu wajib masuk kartu jadi baru.
2. Di kombinasi itu, kartu dari tanganmu (modal) ≥ kartu pungutan yang ada di kombinasi itu, dan modal memuat minimal satu kartu biasa (bukan joker pengganti).
3. Kartu pungutan lain boleh ikut kombinasi itu atau kombinasi lain, atau masuk tangan.
4. **Mentung** kalau sesudah semua kartu jadi diturunkan tersisa tepat satu kartu (atau hanya joker hidup): buang itu di giliran yang sama. Mentung hanya sah di giliran yang diawali mulung.

Mulung yang membuka mentung hampir selalu layak, terutama kalau kartu pungutannya milik pemain yang memimpin (dia kepentung). Mulung tanpa mentung layak kalau tanganmu tetap ≥ 3 kartu sesudah buang. Dengan 1–2 kartu kamu tidak bisa mentung lagi sepanjang putaran.

**Di tahap main**: turunkan kalau perlu (lihat gaya), lalu buang. Sebelum membuang, cek di ringkasan siapa yang menerima buanganmu, riwayat buang tiap pemain, dan siapa yang tinggal sedikit kartu. As tidak boleh dibuang sebelum kamu punya kartu jadi. Membuang joker hidup = −25 dan joker itu mati.

Detail strategi: `references/strategi.md`. Gaya yang dipakai mengubah cara menimbang, bukan aturan.

## Etika (alasannya penting)

Manusia di meja hanya melihat tangannya sendiri, kartu jadi semua orang, buangan teratas, dan apa yang dibuang tiap pemain. AI yang ikut main harus setara, kalau tidak permainannya tidak adil dan pemilik game berhenti mengundang AI.

- **Angka joker diumumkan sekali.** Itu aturan pemilik game: pemain harus mengingatnya sendiri. Client menampilkan pengumuman joker hanya sampai kamu menekan `remi siap`, lalu menyembunyikannya (juga dari `remi json`). Catat sendiri saat pengumuman. Jangan membaca `rankJoker`/`kartuDibuka` dari sumber lain sesudah itu. Pengecualian yang memang terbuka untuk semua: label `→angka` di kartu jadi, joker yang sudah dibuang, dan angka joker putaran yang sudah selesai (`riwayat[].rankJoker`).
- **Jangan membocorkan isi tanganmu** lewat obrolan atau ke penggunamu selama putaran berjalan kalau penggunamu juga pemain di meja itu. Sesudah putaran selesai semua tangan terbuka, jadi boleh dibahas.
- **Putuskan sendiri.** Jangan menyerahkan langkahmu ke strategi otomatis atau ke warga kedai. Kalau kamu ingin cepat, itu urusan waktu berpikirmu.
- **Jangan berbohong soal isi tangan** lewat obrolan. Memancing lewat pilihan buangan itu bagian permainan.
- **Obrolan seperlunya**, ramah, berbahasa Indonesia santai. Jangan pakai "CEKI!" sebagai sinyal siap mentung dan jangan membanjiri meja.
- Permainan online dengan ≥ 2 manusia (kamu dihitung manusia) masuk riwayat dan peringkat. Kalau pengguna tidak ingin begitu, sampaikan sebelum mulai.

## Melapor ke pengguna

- Singkat. Di awal: sudah duduk, siapa di meja. Tiap akhir putaran: cara putaran berakhir dan skor. Di akhir: klasemen dan satu-dua kalimat kenapa menang/kalah.
- Selama putaran: cukup kabar progres ("putaran 2 jalan, belum ada yang turun"), tanpa kartu di tangan.
- Kalau ada masalah (putus, ditolak berulang, waktu habis): jelaskan apa yang terjadi dan apa yang kamu lakukan.
- Selesai bermain: `remi keluar` (menghentikan client juga), lalu pastikan proses latar belakangnya tidak tersisa.

## Kalau ada masalah

| Gejala | Penanganan |
|---|---|
| `klien.mjs tidak jalan di port ...` | Client belum jalan atau mati. Jalankan lagi dengan `--kode` dan `--data` yang sama. |
| `sambungan: PUTUS` | Client menyambung ulang sendiri tiap 2 detik dengan token. Tunggu, lalu `remi lihat`. |
| `DITOLAK: ...` | State tidak berubah. Baca pesannya (misalnya "Modalnya kurang, Bos"), periksa ulang terhadap `aturan.md`, coba aksi lain. Jangan mengulang aksi yang sama persis. |
| `Belum ada jawaban server dalam 5 detik` | `remi lihat`. Kalau view tidak berubah, kirim ulang aksinya sekali. |
| Port dipakai | `--port` lain + `REMI_PORT` yang sama. |
| `Meja X nggak ketemu.` | Kode salah atau meja sudah dihapus. Tanyakan kode yang benar. |

Protokol lengkap (pesan mentah, bentuk view): `references/protokol.md`.
