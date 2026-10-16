# Baseline perilaku permainan

Dokumen ini merekam **perilaku aktual** mesin aturan dan meja saat baseline dibuat, sebagai pegangan sebelum tim mengubah presentasi (client, animasi, teks UI). Semua poin di bawah diverifikasi dari kode dan README, disertai rujukan `file: fungsi` dan test yang menjaganya.

> **Sumber kebenaran aturan tetap [README](../README.md)** (bagian *Ringkasan aturan* dan *Aturan Terbuka dan keputusan*) **dan pemilik proyek.** Dokumen ini bukan tempat menetapkan aturan baru. Kalau dokumen ini berbeda dengan README, README yang benar, dan perbedaannya harus dilaporkan.

Singkatan path: `engine/` = `packages/engine/src/`, `meja/` = `packages/meja/src/`, `test/` = `packages/engine/test/`.

## Proteksi regresi (golden master)

| Test | Yang dikunci | Snapshot |
|---|---|---|
| `packages/engine/test/golden.test.ts` | Permainan bot-vs-bot penuh untuk 6 konfigurasi (2, 3, 4, 4 dua deck, 5, 6 pemain) × 8 seed (`1, 2, 3, 7, 42, 99, 2024, 31337`) × 3 putaran (`batasPutaran: 3`). Level bot campuran (`(seed + i) % 3 === 0` → mudah, selain itu normal). Total 144 putaran. | `packages/engine/test/__golden__/engine-<konfigurasi>.json` |
| `packages/meja/test/golden-meja.test.ts` | Permainan offline penuh lewat `Meja` (1 manusia "pura-pura" + bot) dengan `JamPalsu`, `jedaBotMs: 100`, `detikGiliran: 0`, `buatSeed` tetap, dan sumber acak celetukan tetap. 2 skenario: 3 pemain dan 4 pemain dua deck, masing-masing 2 putaran. | `packages/meja/test/__golden__/meja-<skenario>.json` |

**Isi sidik jari engine (per seed):**
- `hash.aksi`: urutan semua aksi yang diterapkan.
- `hash.view`: `viewUntuk()` di titik-titik tetap: awal putaran (semua pemain + penonton), masuk susun akhir (semua), putaran selesai (semua, tangan terbuka), dan setiap 7 aksi (pelaku + satu lawan). Ini mengunci aturan info rahasia.
- `hash.peristiwa`, `hash.log`, `hash.riwayat`, `hash.stateAkhir`.
- Ringkasan yang mudah dibaca: per putaran (pengocok, angka joker, cara selesai, pementung, nilai pentungan, kepentung, dibalik, skor per pemain), skor akhir, pemenang, alasan selesai.
- Semua hash memakai sha256 dari JSON dengan **kunci objek terurut**, jadi mengubah urutan field di kode tidak menggeser hash. Menambah, menghapus, atau mengubah isi field tetap menggeser hash.

Selain hash, test golden engine juga menegaskan langsung: tangan lawan `null` selama putaran, buangan di view = (n − 1) kartu teratas, `deck` tidak ada di view, `jokerMati` hanya yang relevan, peristiwa di view ≤ 40, log tidak pernah menyebut kartu yang dibuang (selain pentungan), dan angka joker berurutan di setiap permainan selalu beda (keputusan pemilik #40). Ada juga test determinisme (seed sama dua kali → hasil identik) dan test cakupan (baseline memuat mentung, deck habis, balik arah, dan lompat).

**Isi sidik jari meja:** hash semua pesan keluar ke host (urutan persis), hash pesan `view` dan `meja` terpisah, hash `DataMeja` akhir, jumlah pesan per jenis, daftar emote celetukan bot, waktu `JamPalsu` di akhir, skor, dan klasemen akhir (`RingkasanAkhir`). Test ini juga menegaskan tidak ada pesan error dan tangan lawan tidak pernah terkirim selama putaran.

**Kalau golden test gagal:**
1. Perubahan presentasi murni (client, CSS, animasi, sorakan) **tidak boleh** menggeser hash apa pun. Kalau bergeser, ada yang ikut mengubah engine/meja: cari dan kembalikan.
2. Perubahan aturan yang disengaja dan sudah disetujui pemilik: tinjau diff ringkasan di file snapshot, lalu perbarui dengan `npx vitest run packages/engine/test/golden.test.ts -u` (atau `packages/meja/test/golden-meja.test.ts -u`). Perbarui README dan dokumen ini juga.
3. Perubahan perilaku bot level mudah/normal (`bot/bot.ts`) juga menggeser hash, karena urutan aksi bergantung pada bot. Itu wajar, asalkan aturan tidak berubah: pastikan dulu test aturan lain dan simulasi tetap lolos sebelum `-u`. Kedua golden hanya memainkan level mudah dan normal, jadi strategi jago/suhu (`bot/strategi.ts`, `bot/susun.ts`, `bot/ingatan.ts`) tidak terkunci di sini; yang menjaganya `bot-kuat.test.ts`, `bot-susun.test.ts`, simulasi, dan arena (`packages/engine/scripts/arena.ts`).
4. Golden meja juga peka terhadap perubahan isi pesan (`InfoMeja`, `ViewPemain`), log (termasuk `batasLog`), dan jadwal celetukan bot.

**Riwayat pergeseran hash yang disetujui:**

| Tanggal | Golden | Alasan | Yang berubah | Yang dipastikan identik |
|---|---|---|---|---|
| 13 Okt 2026 | meja (keduanya) | Nama lawan otomatis "Bot N" diganti nama warga kedai "Warga Madya" (`NAMA_LAWAN_BAWAAN`: Kipas Dua, Cak Kopag, Mbak Teras, …), keputusan pemilik gelombang G. Nama tidak memakai `opsi.acak`, jadi urutan celetukan tidak bergeser. | `ringkasanAkhir.pemain[].nama` dan keempat `hash`. Bukti tambahan: dengan nama dibalik ke "Bot 1/2/3", keempat hash sama persis dengan hash lama. | `jumlahPesan`, `jumlahPerJenis`, `emote` (kursi:isi), `waktuAkhir`, `putaran`, `skorAkhir`, peringkat, mentung, kepentung |
| 13 Okt 2026 | meja (3 pemain) | Teks celetukan warga kedai bernada kedai ("Makasih, Bos!" → "Suwun, Bos!", "Tutup!" → "Nutup, rek!" saat mentung, "😤" → "Kartu itu bundar…" saat kepentung). Panjang setiap daftar `pilih([...])` tetap. | Teks di `emote` ("1:Suwun, Bos!", "2:Suwun, Bos!") dan `hash.semuaPesan`. Skenario 4 pemain tidak berubah (celetukannya "😎" saat mungut). | Kursi & urutan emote, `hash.pesanView`, `hash.pesanMeja`, `hash.dataMejaAkhir`, dan semua isi lain |
| 13 Okt 2026 | meja (keduanya), tanpa pergeseran | Emote "Kartu itu bundar…" → "Kartu itu bundar, kak." (sesuai kutipan asli kedai di Threads), di `DAFTAR_EMOTE` dan celetukan kepentung. Panjang daftar `pilih([...])` tetap. | Tidak ada. Kedua skenario golden tidak pernah memilih celetukan kepentung ini, dan isi `DAFTAR_EMOTE` tidak ikut dikirim di pesan. Dicek dengan `-u` lalu dibandingkan: kedua file snapshot identik byte per byte. | Seluruh snapshot meja dan golden engine |
| 13 Okt 2026 | meja (keduanya) | Perilaku room keputusan pemilik #8–#12 (`docs/keputusan-pemilik.md` butir 33–37): field baru `DataMeja.sudahLihatJoker` (kursi yang sudah melihat pengumuman joker putaran ini), dipakai supaya pemain yang tersambung kembali sebelum menekan OK ditanya lagi. | Hanya `hash.dataMejaAkhir` (field baru ikut tersimpan; nilainya `[0]` di akhir kedua skenario). Bukti: dengan field itu dibuang sebelum di-hash, kedua snapshot lama lolos tanpa `-u`. Skenario golden tidak pernah memutus, menyambung ulang, keluar, atau voting akhiri, jadi perbaikan #8–#12 lainnya (masa tenggang, reset batas waktu setelah jeda, voting dicek ulang) tidak dilalui. | `semuaPesan`, `pesanView`, `pesanMeja`, `jumlahPesan`, `jumlahPerJenis`, `emote`, `waktuAkhir`, `putaran`, `skorAkhir`, `ringkasanAkhir` (peringkat, mentung, kepentung), dan seluruh golden engine |
| 13 Okt 2026 | meja (keduanya), tanpa pergeseran | Transisi dari 0.1.0: tunggu joker karena sambung ulang dibatasi `min(detikGiliran, BATAS_JOKER_SAMBUNG_MS)` dan tiap kursi paling banyak sekali ditanya ulang per putaran (kursinya langsung dicatat di `sudahLihatJoker`, tanpa field baru); emote lama dari aplikasi 0.1.0 dipetakan ke padanannya (`EMOTE_LAMA`). | Tidak ada. Skenario golden tidak pernah menyambung ulang dan tidak mengirim emote dari client. Kedua snapshot lolos tanpa `-u`. | Seluruh snapshot meja dan golden engine |
| 14 Okt 2026 | meja (keduanya), tanpa pergeseran | 12 nama warga kedai pilihan pemilik (Cak Owner … Om Napi) ditambahkan di **belakang** `NAMA_LAWAN_BAWAAN`; sepuluh nama lama tetap di depan dengan urutan sama. | Tidak ada. Skenario golden tidak memberi `namaLawan`, jadi kursinya memakai nama terdepan sesuai urutan (Kipas Dua, Cak Kopag, Mbak Teras). Kedua snapshot lolos tanpa `-u`. Nama baru jangan disisipkan di tengah atau depan daftar, karena itu menggeser nama kursi di golden dan lawan latihan. | Seluruh snapshot meja dan golden engine |
| 14 Okt 2026 | engine dan meja, tanpa pergeseran | Level warga kedai baru `jago` dan `suhu` (`DAFTAR_LEVEL_BOT`, strategi di `bot/strategi.ts`); `rapikanLevel()` di konstruktor `Meja`, `Meja.buat`, dan `aturKursi`; keputusan pemilik #38 (cadangan berlapis di `Meja.langkahBot()`, semua timer lewat `pasangTimer()`). | Tidak ada. `pilihAksiBot` untuk mudah/normal identik, level di skenario golden sudah sah sehingga `rapikanLevel` tidak mengubahnya, dan jalur normal `langkahBot` memakai RNG bot dengan urutan yang sama. Kedua golden lolos tanpa `-u`. | Seluruh snapshot meja dan golden engine |
| 16 Okt 2026 | meja (keduanya), hash tetap | Leaderboard baru (keputusan pemilik #45): `RingkasanAkhir` ditambah `jumlahDeck` (dari `aturanPembagian`) dan `modeKaldu` (false sampai Mode Kaldu ada), serta `pemain[].keluar` dan `Kursi.keluar` yang hanya ada kalau pemain menekan Keluar saat permainan berjalan. | Hanya teks `ringkasanAkhir` di snapshot: baris `"jumlahDeck": 1` (3 pemain) / `2` (4 pemain 2 deck) dan `"modeKaldu": false`. Ditinjau lalu `-u`. | Keempat `hash` (skenario golden tidak pernah keluar meja, jadi `Kursi.keluar` tidak pernah ada dan `dataMejaAkhir` sama), `jumlahPesan`, `jumlahPerJenis`, `emote`, `waktuAkhir`, `putaran`, `skorAkhir`, isi `ringkasanAkhir.pemain`, dan seluruh golden engine |
| 16 Okt 2026 | engine (4, 4 dua deck, 5, 6 pemain); meja tanpa pergeseran | Aturan baru keputusan pemilik #40: angka joker tidak boleh sama dengan putaran tepat sebelumnya (`bukaKartuJoker` di `mesin.ts`). Kartu yang angkanya sama dianulir dan kartu berikutnya dibuka; joker diselipkan dengan satu `rng.int` seperti dulu, kartu yang dianulir masing-masing satu `rng.int` sesudahnya. Tanpa anulir, RNG dan deck sama persis dengan cara lama. | Hanya enam permainan yang dulu mengulang angka joker, dan hanya mulai dari putaran yang dianulir (putaran sebelumnya identik di ringkasan): `engine-4-pemain.json` seed 2 putaran 2 (joker 11,11,2 → 11,6,12) dan seed 7 putaran 3 (5,2,2 → 5,2,5; putaran 3 sama dengan putaran 1 itu sah); `engine-4-pemain-2-deck.json` seed 42 putaran 2 (5,5,8 → 5,7,4) dan seed 2024 putaran 3 (3,13,13 → 3,13,10); `engine-5-pemain.json` seed 31337 putaran 2 (12,12,10 → 12,13,10); `engine-6-pemain.json` seed 1 putaran 3 (8,1,1 → 8,1,9). Di permainan itu ringkasan putaran sejak putaran yang dianulir, skor akhir, jumlah aksi, dan keenam hash berubah, begitu juga `sidikJariGabungan` keempat berkas. Level bot per kursi tetap. Dibandingkan per permainan antara snapshot lama dan baru sebelum `-u`. | `engine-2-pemain.json` dan `engine-3-pemain.json` identik byte per byte (tidak ada putaran yang mengulang angka joker, jadi ini bukti jalur tanpa anulir sama persis); 26 permainan lain di empat berkas yang berubah identik; seluruh golden meja lolos tanpa `-u` |
| 16 Okt 2026 | engine dan meja, tanpa pergeseran | Aturan baru keputusan pemilik #41: mentung pakai beberapa joker hidup sekaligus (`Aksi` buang `kartuIdLain?`, `validasiBuang`, `nilaiPentunganTotal`, `pentunganLain?` di `InfoMentung`/peristiwa `mentung`/`HasilPutaran`, `kartuLain?` di peristiwa `buang`); `validasiAksi` meja menerima `kartuIdLain`; Jago/Suhu ikut memakainya (`rencanaMentung`) dan `ingatan.ts` mencatat `kartuLain`. | Tidak ada. Mudah dan Normal tidak pernah membuang lebih dari satu kartu, dan semua field baru hanya ditulis kalau ada (buang satu kartu menghasilkan objek dengan kunci dan urutan yang sama persis). Kedua golden lolos tanpa `-u`. | Seluruh snapshot meja dan golden engine |
| 16 Okt 2026 | meja (keduanya), tanpa pergeseran | Batas skor bebas kelipatan 10 (keputusan pemilik #44): `validasiPengaturan()` hanya menerima batas atas positif dan batas bawah negatif kelipatan 10 (nilai mutlak 10–100000), ditambah `rapikanBatasSkor()`/`batasSkorSah()`. Engine tidak berubah. | Tidak ada. Skenario golden tidak memakai batas skor (null) dan tidak mengirim pesan `pengaturan`. Kedua snapshot lolos tanpa `-u`. | Seluruh snapshot meja dan golden engine |

**Emote yang diganti tetap diterima dari aplikasi lama.** Pesan `emote` divalidasi terhadap `DAFTAR_EMOTE` (`packages/meja/src/validasi.ts`). Emote lama yang sudah diganti ("Makasih, Bos!", "Tutup!" dari 0.1.0, dan "Kartu itu bundar…" dari build pra-rilis) dipetakan lewat `EMOTE_LAMA` (`packages/meja/src/protokol.ts`) ke padanannya ("Suwun, Bos!", "Nutup, rek!", "Kartu itu bundar, kak.") lalu diteruskan ke meja seperti biasa, jadi HP yang masih memakai 0.1.0 tidak mendapat "Pesan tidak dikenali.". Semua bentuk pesan lain dari client 0.1.0 juga dikunci test (`packages/meja/test/meja.test.ts`, "kompatibilitas aplikasi 0.1.0"). Pergeseran golden: tidak ada (skenario golden tidak mengirim emote dari client).

Golden engine tidak berubah (engine memakai nama `Bot ${i+1}` sendiri).

## 1. Pembagian dan persiapan putaran

- **Jumlah deck dan kartu awal** (`engine/mesin.ts: aturanPembagian`): 2–4 pemain → 1 deck, 6 kartu; 4 pemain dengan `duaDeckUntukEmpat` → 2 deck, 12 kartu; 5–6 pemain → 2 deck, 9 kartu. Di luar 2–6 ditolak (`KONFIGURASI_TIDAK_SAH`). Kartu bergambar joker tidak dipakai (`engine/kartu.ts: buatDeck`, 52 kartu per deck). Test: `putaran.test.ts` (pembagian kartu).
- **Kocok dan bagi** (`mesin.ts: mulaiPutaran`): deck dikocok dengan RNG mulberry32 yang state-nya ada di `GameState.rng` (`engine/rng.ts`). Kartu dibagi satu per satu bergiliran, mulai dari pengocok, menurut urutan kursi.
- **Kartu dibuka** (`mesin.ts: bukaKartuJoker`): setelah pembagian, satu kartu diambil dari deck, angkanya menjadi `rankJoker`, lalu kartu itu diselipkan kembali ke posisi acak di deck (termasuk kemungkinan posisi paling atas).
- **Joker beda dari putaran sebelumnya** (keputusan pemilik #40, 16 Okt 2026): kalau kartu yang dibuka angkanya sama dengan `riwayat.at(-1).rankJoker` (putaran tepat sebelumnya), kartu itu disisihkan dan kartu berikutnya dibuka, sampai angkanya beda. Kartu joker diselipkan dengan satu `rng.int(deck.length + 1)`, lalu setiap kartu yang dianulir diselipkan dengan satu `rng.int` lagi (urut dari yang pertama dibuka), jadi jumlah dan isi deck tetap dan tidak ada kartu yang dibuka dua kali. Hanya putaran tepat sebelumnya yang dibandingkan: putaran 3 boleh sama dengan putaran 1. Putaran pertama (riwayat kosong, termasuk permainan baru sesudah "Main lagi") tidak pernah menganulir, dan tanpa anulir pemakaian RNG sama persis dengan sebelum aturan ini. Seluruh sisa deck berangka sama → `KONFIGURASI_TIDAK_SAH` (mustahil: sisa deck ≥ 28, satu angka ≤ 8 kartu). Tidak ada field baru di state/view/peristiwa; popup dan log tidak berubah. Test: `joker-putaran.test.ts`, `meja.test.ts` (Main lagi).
- **Pengocok** (`mesin.ts: kandidatPengocok`): putaran pertama semua pemain jadi kandidat; berikutnya hanya pemain dengan skor akumulasi terendah. Pengocok bisa dipilih (harus kandidat, kalau tidak `PENGOCOK_TIDAK_SAH`) atau diacak oleh RNG. **Pengocok jalan pertama** (`giliran = pengocok`). Test: `putaran.test.ts` (pengocok dan urutan).
- **Arah:** putaran pertama memakai `arahAwal` (bawaan 1 = searah urutan duduk); putaran berikutnya memakai `GameState.arah` hasil putaran sebelumnya.
- Peristiwa `mulaiPutaran` dipancarkan; log hanya mencatat nomor putaran dan pengocok, **tanpa angka joker**.

## 2. Giliran dan tahap

- Status permainan (`engine/state.ts: StatusPermainan`): `menungguPutaran` → `putaranBerjalan` → `susunAkhir` → `putaranSelesai` → (putaran baru, atau `selesai`).
- Satu giliran punya dua tahap (`StatePutaran.tahap`): `ambil` lalu `main` (`mesin.ts: putaranAktif`). Aksi di luar giliran → `BUKAN_GILIRAN`; tahap salah → `TAHAP_SALAH`; tidak ada putaran berjalan → `STATUS_SALAH`.
- **Ambil:** `ambilDeck` (kartu teratas deck) atau `mulung`. Ambil dari deck mereset `mulungBeruntun` pemain itu.
- **Main:** boleh `turunkan` berkali-kali (opsional), lalu wajib `buang` satu kartu. Setelah buang (bukan mentung, deck belum habis), giliran pindah ke `berikutnya(pemain, arah, n)`.
- Kartu tidak bisa ditempel ke kartu jadi yang sudah ada: tidak ada aksi untuk itu; setiap `turunkan`/`mulung` selalu membentuk kartu jadi baru. Test: `mulung.test.ts` ("tidak bisa menempel").
- Aksi ilegal dilempar sebagai `AturanError` dan dikembalikan `{ ok: false }` tanpa mengubah state (`mesin.ts: terapkanAksi`). Test: `fuzz.test.ts`, `mulung.test.ts` ("mulung ditolak → state tidak berubah").

## 3. Validasi kartu jadi

Semua di `engine/kartuJadi.ts: validasiKartuJadi` (dipakai mesin, bot, dan UI). Test: `kartuJadi.test.ts`.
- Minimal 3 kartu.
- **Seri** (`validasiSeri`): satu bunga, berurutan, tanpa angka ganda. Angka hanya 2–10 (maks 9 kartu); Londo hanya J-Q-K; angka dan Londo tidak bisa disambung.
- **As** hanya bisa jadi **kembar As** (`validasiKembarAs`): 3 atau 4 kartu, bunga beda semua (berlaku juga di 2 deck). As tidak bisa masuk seri. Kembar selain As tidak sah.
- **3 As butuh kartu jadi lain** (`engine/giliran.ts: validasiTurunkan`): sah kalau pemain sudah punya kartu jadi di meja, atau di aksi yang sama ikut diturunkan kartu jadi lain yang bukan 3 As. Dua kembar 3 As bersamaan tanpa kartu jadi lain ditolak (`AS_TIGA_BELUM_PUNYA_JADI`). Kembar 4 As selalu boleh dan bisa menjadi pendamping 3 As. Test: `mulung.test.ts` (mungut As, turunkan 3 As), `susunAkhir.test.ts`.
- **Sisa kartu** (`validasiTurunkan`): setelah ambil dari deck, tangan wajib tersisa ≥ 2 kartu (satu dibuang, satu tetap di tangan); setelah mulung, ≥ 1 kartu. Di susun akhir (`mode 'akhir'`) tangan boleh habis. Test: `buang.test.ts` (Aturan Terbuka 3).

## 4. Joker

- **Joker hidup** (`kartuJadi.ts: isJokerHidup`): kartu dengan angka = `rankJoker` yang belum ada di `jokerMati`.
- Joker hidup boleh **menggantikan** kartu lain (`sebagai`), kecuali Londo dan As (`JOKER_TIDAK_SAH`). Kartu bukan joker tidak bisa menggantikan. Joker selalu boleh dipakai sebagai kartu aslinya (`pengganti: false`) dan dalam peran itu dihitung kartu biasa.
- Dalam satu seri: jumlah joker pengganti ≤ jumlah kartu biasa, dan pengganti tidak boleh bersebelahan (`validasiSeri`). Kelima contoh selang-seling ada di `kartuJadi.test.ts`.
- Angka joker As: keempat As tetap bisa jadi kembar As, dan As bisa menggantikan angka (test `kartuJadi.test.ts`).
- Joker mati (pernah dibuang) tidak bisa jadi pengganti (test `kartuJadi.test.ts`, `mulung.test.ts`).
- `opsiPeranJoker` (untuk UI) dan `cariKandidatKartuJadi` (untuk bot) hanya mencari tafsiran; keabsahan tetap diputuskan `validasiKartuJadi`.

## 5. Mulung

`engine/giliran.ts: validasiMulung`, diterapkan oleh `mesin.ts: mulung`. Test: `mulung.test.ts` (contoh wajib Bagian 5 dan aturan lainnya).
- Jumlah `k`: 1 ≤ k ≤ min(n − 1, panjang buangan) (`maksimalMulung`). Buangan kosong → ditolak.
- Kartu yang dipungut = k kartu teratas. **Kartu paling bawah** dari pungutan wajib masuk salah satu kartu jadi baru (`MULUNG_TANPA_KARTU_BAWAH`).
- Di kartu jadi yang memuat kartu paling bawah: **modal** (kartu dari tangan) ≥ **pungutan** (`MODAL_KURANG`), dan modal memuat minimal satu kartu yang bukan joker pengganti (`MODAL_TANPA_KARTU_BIASA`). Syarat modal hanya untuk kombinasi itu (Aturan Terbuka 2).
- Kombinasi lain boleh diturunkan di aksi yang sama; sisa pungutan masuk tangan.
- Setelah mulung: `sumberAmbil = 'buangan'`, `pungutan` disimpan (dipakai menentukan kepentung), `asalKartu` mencatat pemilik buangan setiap kartu yang dipungut (jejak `KartuDiMeja.dari`), `mulungBeruntun` bertambah. Peristiwa `mulung` memuat `sapuBersih` (n ≥ 3 dan k = n − 1) dan `kembarAs` (4 As). Test: `peristiwa.test.ts`.

## 6. Membuang dan buang joker

`engine/giliran.ts: validasiBuang`, `mesin.ts: buang`. Test: `buang.test.ts`.
- Kartu harus ada di tangan.
- **As tidak boleh dibuang sebelum punya kartu jadi** (`AS_BELUM_BOLEH_DIBUANG`). Opsi `asJokerBolehDibuangTanpaJadi` (bawaan `false`) hanya melonggarkan untuk As yang sedang jadi joker hidup.
- **Buang joker hidup** (bukan sebagai pentungan): `jokerDibuang[pemain]++` (penalti −25 per kartu di skor putaran itu), dan kartunya masuk `jokerMati` sehingga jadi kartu biasa untuk sisa putaran. Joker mati yang dibuang lagi tidak kena penalti.
- Log hanya mencatat "`<nama>` buang kartu." tanpa menyebut kartunya. Peristiwa `buang` memuat kartu (terlihat semua orang saat dibuang) dan `jokerDibuang`.
- **Buang beberapa kartu** (`kartuIdLain`, keputusan #41) hanya sah untuk nutup, lihat bagian Mentung. Daftar kosong atau tidak ada = buang satu kartu, jalur dan pesannya sama persis seperti sebelumnya. `HasilBuang.kartuLain` selalu array (kosong untuk satu kartu).

## 7. Mentung

`mesin.ts: buang` (cabang `hasil.mentung`), `hitungKepentung`, `selesaikanPutaran`; `skor.ts: nilaiPentungan`, `nilaiPentunganTotal`. Test: `mentung.test.ts` (Contoh A dan B, penentuan kepentung, pentungan joker, susun akhir setelah mentung, describe #41), `fuzz.test.ts` (fuzz #41).
- Mentung = membuang kartu terakhir di tangan. Hanya sah kalau giliran itu diawali mulung (`NUTUP_TANPA_MULUNG`).
- **Mentung pakai beberapa joker** (keputusan #41): buang 2+ kartu sekaligus (`kartuId` + `kartuIdLain`) hanya sah kalau semuanya joker hidup, semuanya sisa tangan, dan giliran diawali mulung. Urutan cek `validasiBuang`: ada di tangan (`KARTU_TIDAK_ADA`), tidak dobel (`KARTU_DOBEL`), jumlah = seluruh tangan (`BUANG_SATU_KARTU`), sesudah mulung (`NUTUP_TANPA_MULUNG`), baru semuanya joker hidup (`PENTUNGAN_BUKAN_JOKER`); larangan As tetap dicek per kartu sesudahnya. Semua kartu masuk `jokerMati` dan buangan berurutan (kartu pertama dulu), tanpa penalti −25. Tetap satu peristiwa `buang` (`kartuLain`) dan satu peristiwa `mentung` (`pentunganLain`, `nilai` = total); `InfoMentung.pentunganLain` dan `HasilPutaran.pentunganLain` hanya ditulis kalau ada. Log: "`<nama>` mentung pakai 7 Waru dan 7 Kriting!" (pola log mentung yang sudah ada).
- **Kepentung** ditentukan saat mentung: pemilik kartu `pungutan` giliran itu yang ada di kartu jadi milik pementung, kecuali pementung sendiri, tanpa duplikat (sekali per pemain). Kartu pungutan yang masuk tangan lalu diturunkan di giliran yang sama ikut dihitung. Pemilik kartu pentungan tidak kena karena kartu itu.
- **Nilai pentungan:** joker hidup = 250; selain itu 10 × nilai dasar (angka 50, Londo 100, As 150). Joker yang sudah mati (hasil mungut) dinilai sebagai kartu aslinya. Pentungan joker tidak kena penalti −25. Pentungan beberapa joker = 250 per joker (`nilaiPentunganTotal`), satu nilai total: yang mentung dapat sekali, tiap kepentung kena penuh.
- **Arah putaran berikutnya:** dibalik kalau pemain tepat sebelum pementung (menurut arah saat ini) ikut kepentung; kalau tidak ("lompat"), arah tetap. Di 2 pemain, siapa pun yang kepentung selalu "tepat sebelum".
- Info mentung disimpan di `StatePutaran.mentung`, peristiwa `mentung` (pentungan, nilai, kepentung, dibalik) dipancarkan saat itu juga, lalu masuk **susun akhir**. Skor baru dihitung setelah semua selesai menyusun; kepentung dan arah tidak berubah oleh susunan sesudahnya.

## 8. Deck habis

`mesin.ts: ambilDeck`, `buang`. Test: `putaran.test.ts` (deck habis), `susunAkhir.test.ts`.
- Begitu kartu terakhir deck diambil, `deckHabis = true`. Pemain itu menyelesaikan gilirannya (boleh turunkan dengan syarat sisa ≥ 2, lalu wajib buang). Mentung tidak mungkin di giliran itu karena ambilnya dari deck.
- Setelah buang tersebut, permainan masuk susun akhir dengan sebab `deckHabis`. Putaran dihitung tanpa pementung (semua skor dasar) dan arah tetap.

## 9. Susun akhir

`mesin.ts: mulaiSusunAkhir`, `turunkanAkhir`, `selesaiSusun`, `selesaiSemuaSusun`. Test: `susunAkhir.test.ts`, `mentung.test.ts` (susun akhir setelah mentung).
- Status `susunAkhir`. Semua pemain (tidak urut giliran) boleh `turunkan` kartu jadi dari tangan dengan validasi mode `'akhir'`: tanpa mulung, tanpa ambil, tanpa buang, tangan boleh habis (tidak dihitung mentung). Aturan kartu jadi tetap berlaku (termasuk 3 As).
- Pemain dengan tangan kosong (yang mentung) otomatis dianggap selesai. Yang lain menekan `selesaiSusun`; setelah itu tidak bisa menurunkan lagi.
- Setelah semua selesai, `selesaikanPutaran` dijalankan.
- Di meja: susun akhir berjalan serentak; bot (dan manusia yang terputus lewat masa tenggang atau kehabisan waktu) dijalankan satu per satu (`meja/meja.ts: jadwalkan`). Aturan Terbuka 20–23 diputuskan pemilik 16 Okt 2026: sesuai bawaan (perilaku di atas).

**Sambung ulang dan room (keputusan pemilik 13 Okt 2026, `meja/meja.ts`; test `packages/meja/test/meja.test.ts`):**
- **Masa tenggang** (#11): giliran manusia yang terputus baru dijalankan warga kedai setelah `OpsiMeja.tenggangSambungMs` (bawaan `TENGGANG_SAMBUNG_MS` = 20 detik) **sejak ia terputus**, lalu jeda mikir biasa. Kembali dalam tenggang = giliran tetap miliknya. Batas waktu giliran (kalau `detikGiliran` > 0) tetap berlaku, mana yang lebih dulu habis. Tenggang tidak diulang tiap giliran: kalau sudah lewat dan ia belum kembali, giliran berikutnya langsung dijalankan. Waktu terputus hanya di memori (`putusSejak`); meja yang dilanjutkan dari simpanan memulai tenggang saat dibuat.
- **Jeda karena semua manusia terputus** (#12): batas waktu yang sedang berjalan dibuang; yang kembali mendapat batas waktu giliran penuh. Kalau jedanya terjadi saat pengumuman joker, yang kembali ditanya lagi dengan tunggu sambung ulang (paling lama `BATAS_JOKER_SAMBUNG_MS`, lihat butir berikut).
- **Pengumuman joker untuk yang tersambung kembali** (#8): `DataMeja.sudahLihatJoker` mencatat kursi yang sudah menekan OK, yang popupnya tampil sampai batas waktu, atau yang sudah sekali ditanya ulang di putaran ini; dikosongkan tiap putaran baru. Manusia yang tersambung kembali saat `putaranBerjalan` dan belum tercatat dimasukkan lagi ke `menungguJoker` (meja menunggu OK-nya) dan saat itu juga dicatat, jadi **tiap kursi paling banyak sekali ditanya ulang per putaran**: kalau ia putus-sambung lagi sebelum menekan OK, meja tidak ditahan lagi. Tunggu karena sambung ulang selalu dibatasi `min(detikGiliran, BATAS_JOKER_SAMBUNG_MS)` (30 detik; tanpa batas waktu giliran = 30 detik). Batas waktu giliran yang sedang berjalan sebelum tunggu itu diulang penuh sesudahnya (belum disimpan sisanya). Tidak berlaku di susun akhir atau di antara putaran. Simpanan lama tanpa field ini: kursi yang tidak sedang ditunggu dianggap sudah melihat.
- **Keluar sebelum OK joker** (#9): `tinggalkan()` mengeluarkan kursinya dari `menungguJoker`, sama seperti terputus.
- **Voting akhiri** (#10): setiap ada yang terputus atau keluar, voting dicek ulang. Permainan berakhir kalau masih ada minimal satu manusia terhubung, ada minimal satu suara, dan semua manusia terhubung sudah setuju.
- **Galat di langkah warga kedai atau timer meja** (keputusan pemilik #38, 14 Okt 2026; test `packages/meja/test/galat-bot.test.ts`): `langkahBot()` mencoba strategi level kursi (manusia yang diambil alih: `normal`), lalu `mudah`, lalu `aksiAman()` (ambil deck / buang kartu pertama yang lolos `validasiBuang`, joker hidup paling akhir / `selesaiSusun`). Kalau semuanya galat, giliran dicoba ulang dengan jeda 2, 4, 8, 16, 32, lalu 60 detik. Semua timer lewat `pasangTimer()`: galat dilaporkan `OpsiMeja.saatGalat` dan jadwal disusun ulang (`pulihkanJadwal()`). Galat sesudah aksi diterapkan tidak memicu aksi cadangan.

## 10. Skor

`engine/skor.ts: hitungSkorPemain`, nilai di `engine/kartu.ts: nilaiDasar` dan `kartuJadi.ts: nilaiKartuJadi`, `nilaiKartuTangan`. Test: `skor.test.ts` (contoh wajib 8.3), `simulasi.ts` (rumus dicek di setiap putaran).
- Nilai dasar: angka 2–10 = 5, Londo = 10, As = 15. Joker hidup di tangan = 25; joker mati di tangan = nilai dasar. Di kartu jadi, joker pengganti bernilai kartu yang diwakili.
- Rumus `total = nilaiKartuJadi − nilaiTangan + nilaiPentungan − penaltiJoker`:
  - aman: jadi − tangan;
  - mentung: jadi + pentungan (tangan kosong; pentungan beberapa joker = jumlahnya, #41);
  - kepentung: jadi − tangan − pentungan (nilai total yang sama);
  - penalti −25 × joker hidup yang dibuang, untuk semua status.
- Skor akumulatif (`GameState.skor`), dan `HasilPutaran.skorAkumulasi` disimpan di `riwayat` (append-only). `periksaInvarian` memastikan skor = jumlah total per putaran.

## 11. Akhir permainan

`mesin.ts: selesaikanPutaran`, `akhiriPermainan`. Test: `putaran.test.ts` (akhir permainan 8.4), `meja.test.ts` (akhiri permainan).
- Dicek di akhir setiap putaran, berurutan: batas skor atas (ada skor ≥ batas), batas skor bawah (ada skor ≤ batas), batas putaran. Bila salah satu terpenuhi → `selesai` dengan `alasanSelesai` yang sesuai. Setiap syarat bisa dinonaktifkan (`null`); bawaan semuanya `null`.
- `akhiriPermainan` (sepakat) hanya bisa di antara putaran. Di meja, semua manusia yang terhubung harus setuju (`meja.ts: akhiri`).
- Klasemen akhir meja (`meja.ts: buatRingkasanAkhir`): urut skor menurun, skor sama = peringkat sama, plus jumlah mentung dan kepentung per pemain.

## 12. Info rahasia (mode ingatan)

`engine/view.ts: viewUntuk`. Test: `peristiwa.test.ts` (mode ingatan), `putaran.test.ts` (view pemain), `susunAkhir.test.ts`, `meja.test.ts` (kartu rahasia per pemain), golden engine (`periksaViewRahasia`) dan golden meja.
- Selama `putaranBerjalan` dan `susunAkhir`, tangan lawan dikirim `null` (hanya `jumlahKartuTangan`). Setelah putaran selesai semua tangan terbuka.
- Deck tidak dikirim, hanya `jumlahDeck`.
- Buangan hanya **max(1, n − 1)** kartu teratas, plus `jumlahBuangan`.
- `jokerMati` hanya yang relevan: di buangan yang terlihat, di tangan sendiri, atau di kartu jadi.
- Peristiwa dibatasi 40 terakhir (`BATAS_PERISTIWA_VIEW`).
- Log tidak menyebut kartu yang dibuang dan tidak mencatat angka joker di awal putaran. (Catatan: deskripsi kartu jadi di log menyebut peran joker pengganti, misalnya "(10 Wajik jadi 9)", sama seperti yang terlihat di kartu jadi di meja.)
- Bot hanya menerima `ViewPemain` dan memvalidasi aksi dengan fungsi aturan yang sama (`engine/bot/bot.ts: pilihAksiBot`). Simulasi gagal kalau ada aksi bot ditolak (`test/simulasi.ts`).
- Pengumuman joker hanya sekali per putaran: di meja, permainan menunggu semua manusia yang terhubung menekan OK (`meja.ts: terapkan` mengisi `menungguJoker`, `jadwalkan` menahan bot). Yang terputus sebelum menekan OK ditanya lagi saat kembali (keputusan pemilik #8, lihat bagian 9). Catatan: `rankJoker` dan `kartuDibuka` tetap ada di `ViewPutaran` karena client memakainya untuk validasi lokal; menyembunyikannya dari tampilan adalah tanggung jawab UI.
- Tautan: keputusan pemilik soal catatan di atas (#25–#29, semuanya sudah diputuskan 13 Okt 2026) dirinci di [keputusan-pemilik.md](keputusan-pemilik.md).

## 13. Invarian yang dicek otomatis

`engine/invarian.ts: periksaInvarian` (dipakai simulasi dan fuzz): jumlah kartu total = jumlah deck × 52, tidak ada kartu ganda, setiap kartu jadi sah divalidasi ulang dan pemiliknya benar, skor akumulasi cocok dengan riwayat, giliran valid, deck kosong ⇒ `deckHabis`, tidak ada tangan kosong sebelum buang, susun akhir hanya kalau deck habis atau ada yang mentung, `rankJoker` = angka `kartuDibuka`, angka joker beda dengan putaran tepat sebelumnya (putaran berjalan vs `riwayat[nomor − 2]`, dan antarentri riwayat; keputusan #40), dan pentungan beberapa kartu semuanya berangka joker, sudah jadi joker mati, bernilai 250 per kartu, dengan tangan yang mentung kosong (keputusan #41). State selalu bisa diserialisasi (`simulasi.ts` membandingkan `JSON.parse(JSON.stringify(g))`).
