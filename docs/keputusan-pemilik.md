# Keputusan pemilik: rincian butir #25–#39

Dokumen ini merinci baris **#25–#39** di tabel [Aturan Terbuka dan keputusan](../README.md#aturan-terbuka-dan-keputusan) README. Butir #25–#38 ditemukan saat audit rilis 0.2.0 dan sengaja tidak diubah sampai pemilik memutuskan: sebagian menyangkut aturan main atau info rahasia (wewenang pemilik), sebagian lagi perilaku room di `packages/meja`. Butir #39 adalah pengaturan deploy.

**Semua butir bernomor sudah diputuskan pemilik:** #25–#37 dan #39 pada 13 Okt 2026, #38 pada 14 Okt 2026. Jangan ubah perilaku yang sudah diputuskan tanpa izin pemilik. Dua hal kecil dari 14 Okt 2026 yang masih menunggu tanggapan pemilik ada di [Catatan lain](#catatan-lain-belum-masuk-tabel).

Untuk tiap butir ada: keputusan pemilik (kalau sudah), apa yang terjadi sebelum keputusan, bukti di kode (`file:baris`, per kode saat rilis 0.2.0, jadi nomor baris bisa sudah bergeser), pilihan yang waktu itu ditawarkan, dan dampaknya. Pilihan **bukan aturan baru**, hanya daftar kemungkinan yang ditawarkan ke pemilik.

Pemilik menjawab lewat daftar pertanyaan bernomor 4–13. Padanannya: 4 = #25 dan #26, 5 = #27 dan #28, 6 = #29, 7 = #30–#32 (#32 dijawab langsung; #30 dan #31 diserahkan ke saran pengembang), 8 = #34, 9 = #33, 10 = #36, 11 = #37, 12 = #35, 13 = #39. #38 disetujui 14 Okt 2026, saat pemilik meminta rencana perbaikannya dikerjakan.

**Kalau pemilik mengubah keputusan atau ada butir baru:**
1. Tulis keputusannya di kolom "Keputusan" README dan ubah statusnya.
2. Kalau menyentuh aturan atau `packages/engine`/`packages/meja`: tambahkan unit test, lalu perbarui golden test dengan peninjauan (lihat [baseline-gameplay.md](baseline-gameplay.md)).
3. Sesuaikan konten Bantuan/tutorial (`apps/client/src/konten/`) kalau teksnya ikut berubah.

## Ringkasan

| # | Butir | Wilayah | Status |
|---|---|---|---|
| [25](#k25) | Peristiwa di view membawa kartu buangan yang sudah tertimbun | `packages/engine` (view) | Diputuskan: dibiarkan |
| [26](#k26) | `rankJoker`/`kartuDibuka` ada di setiap view | `packages/engine` (view) | Diputuskan: dibiarkan |
| [27](#k27) | Label "→rank" di kartu jadi dan log "(X jadi Y)" | client + engine (log) | Diputuskan: dipertahankan |
| [28](#k28) | Sub-teks sorakan JOKER DIBUANG?! menyebut kartunya | client | Diputuskan: dipertahankan |
| [29](#k29) | Teks aksi singkat "buang 7♥" di panel pemain | client | Diputuskan: jadi "buang kartu" |
| [30](#k30) | Tangan 1 kartu praktis tidak bisa mulung/mentung lagi | aturan (akibat) | Diputuskan: memang begitu |
| [31](#k31) | Joker mati di tangan dinilai kartu biasa | aturan skor | Diputuskan: kartu biasa |
| [32](#k32) | 2 deck: kartu kembar boleh jadi joker pengganti di seri yang sama | aturan kartu jadi | Diputuskan: boleh |
| [33](#k33) | Keluar sebelum OK joker membuat meja macet | `packages/meja` | Diputuskan: diperbaiki |
| [34](#k34) | Pemain yang menyambung ulang tidak melihat popup joker | `packages/meja` | Diputuskan: diperbaiki |
| [35](#k35) | Batas waktu basi setelah semua terputus | `packages/meja` | Diputuskan: diperbaiki |
| [36](#k36) | Voting akhiri tidak dihitung ulang saat pemilih berkurang | `packages/meja` | Diputuskan: diperbaiki |
| [37](#k37) | Refresh di giliran sendiri langsung dimainkan bot | `packages/meja` | Diputuskan: masa tenggang |
| [38](#k38) | Error di timer bot bisa mematikan server | `packages/meja` + `apps/server` | Diputuskan: diperbaiki |
| [39](#k39) | Batas meja dan sambungan per jaringan terlalu kecil untuk Wi-Fi kedai | `apps/server` (deploy) | Diputuskan: bawaan dinaikkan |

---

<a id="k25"></a>

## 25. Peristiwa di view membawa kartu buangan yang sudah tertimbun

**Keputusan pemilik (13 Okt 2026): dibiarkan (pilihan 1).** Peristiwa di view tetap membawa kartu buangan yang sudah tertimbun. Yang dijaga tampilan resmi: UI tetap hanya menampilkan (jumlah pemain − 1) kartu teratas buangan.

**Sekarang:** `viewUntuk()` mengirim 40 peristiwa terakhir ke tiap pemain. Peristiwa `buang` memuat kartunya. Akibatnya, kartu buangan yang sudah tertimbun di bawah (jumlah pemain − 1) kartu teratas masih ada di data yang diterima HP. UI resmi tidak menampilkannya (buangan tetap n − 1), tapi client yang dimodifikasi atau devtools bisa membacanya. Paling terasa di 2 pemain, karena buangan yang terlihat cuma 1 kartu.

**Bukti:**
- `packages/engine/src/view.ts:62-63` (`BATAS_PERISTIWA_VIEW = 40`) dan `:107` (`peristiwa: state.peristiwa.slice(-BATAS_PERISTIWA_VIEW)`).
- `packages/engine/src/state.ts:151` (peristiwa `buang` berisi `kartu`).
- Client memakai peristiwa untuk animasi dan panel mentung: `apps/client/src/efek/pemutar.ts:153-177`, `apps/client/src/kontrolMeja.ts:543-552`.

**Pilihan:**
1. **Biarkan.** Yang dijaga hanya tampilan resmi. Catatan: di mode offline seluruh `GameState` (termasuk deck dan tangan bot) memang tersimpan di `localStorage` HP, jadi mode offline tidak pernah benar-benar rahasia.
2. **Saring di view:** peristiwa `buang` yang kartunya sudah tertimbun dikirim tanpa kartu. Mengubah `view.ts`, golden test bergeser, dan pemutar/panel mentung perlu dicek ulang.
3. **Kirim hanya peristiwa baru** sejak view terakhir per sambungan. Perubahan protokol `packages/meja` dan logika sambung ulang.

**Dampak:** hanya relevan untuk lawan yang sengaja curang di mode online. Pilihan 2/3 mengubah engine/meja (perlu test dan peninjauan golden).

<a id="k26"></a>

## 26. `rankJoker` dan `kartuDibuka` dikirim di setiap view

**Keputusan pemilik (13 Okt 2026): dibiarkan (pilihan 1).** `rankJoker` dan `kartuDibuka` tetap dikirim di view untuk validasi lokal dan popup joker. Pagarnya tetap: UI tidak boleh menampilkan angka joker di luar popup (dijaga `apps/client/test/pemutar.test.ts`).

**Sekarang:** angka joker dan kartu yang dibuka ada di setiap `ViewPemain` selama putaran, ditambah peristiwa `mulaiPutaran` yang memuat `rankJoker`. Client membutuhkannya untuk validasi lokal (tombol yang tidak sah langsung memberi alasan) dan untuk popup joker. Aturan "joker diumumkan sekali" hanya ditegakkan oleh UI.

**Bukti:**
- `packages/engine/src/view.ts:24-25` dan `:84-85`; `packages/engine/src/state.ts:137` (`mulaiPutaran` membawa `rankJoker`).
- Pemakai di client: `apps/client/src/kontrolMeja.ts:728` (konteks validasi) dan `:1825` (popup joker). Test `apps/client/test/pemutar.test.ts` menjaga agar pemutar tidak membacanya.
- Efek samping: validator di client bisa dipakai sebagai "oracle" joker (pilih 2 kartu sebunga + 1 kartu uji, lihat apakah tombol Turunkan aktif). Ini konsekuensi desain validasi lokal.

**Pilihan:**
1. **Biarkan** (status sekarang), dengan pagar: UI tidak boleh menampilkan angka joker di luar popup.
2. **Hapus dari view** setelah semua menekan OK; validasi peran joker dipindah ke server. Tombol tidak bisa lagi memberi alasan seketika untuk kombinasi yang memakai joker, dan pilihan peran joker butuh bolak-balik ke server.

**Dampak:** pilihan 2 perubahan besar di engine, meja, client, dan bot (bot juga membaca view). Golden test berubah.

<a id="k27"></a>

## 27. Label "→rank" pada joker pengganti dan log "(X jadi Y)"

**Keputusan pemilik (13 Okt 2026): dipertahankan (pilihan 1).** Label "→rank" dan teks log "(X jadi Y)" tetap ada. Kata pemilik: di permainan aslinya memang begitu, joker yang sudah dipasang di kartu jadi terlihat semua orang dan boleh jadi petunjuk bagi pemain lain. Teks ringkasan aturan di README sudah disesuaikan. Jangan dihapus.

**Sekarang:** kartu jadi di meja menandai joker pengganti dengan label kecil, misalnya "→4" di atas 7♠. Log mulung/turunkan menulis misalnya "2-3-4 Wajik (7 Waru jadi 4)". Keduanya membuat angka joker terbaca sepanjang putaran, padahal README menulis angka joker "tidak ditampilkan lagi (tidak di meja, bar atas, maupun log)".

**Bukti:**
- Label: `apps/client/src/game/tataMeja.ts:497` (`` isi: `→${namaRank(dk.sebagai.rank)}` ``).
- Log: `packages/engine/src/deskripsi.ts:14`, dipakai di `packages/engine/src/mesin.ts:302`, `:326`, `:412`.
- Terkait: log mentung menyebut pentungannya, `packages/engine/src/mesin.ts:351` (`… mentung pakai ${namaKartu(kartu)}!`). Pentungan memang dibuka ke semua orang di panel mentung, tapi teks invarian AGENTS.md bilang log tidak menyebut kartu yang dibuang.

**Pilihan:**
1. **Biarkan** dan ubah teks keputusan: peran joker di kartu jadi dianggap info publik, seperti di meja asli (semua orang bisa melihat 7 Waru dipasang di tempat 4).
2. **Hapus label "→rank"** dari meja (client saja). Kartu jadi lawan jadi lebih sulit dibaca, terutama di HP.
3. **Ubah teks log** supaya tidak menyebut peran joker (perubahan engine, golden test bergeser).

**Dampak:** pilihan 1 hanya mengubah dokumentasi. Pilihan 2 dan 3 bisa dipilih terpisah.

<a id="k28"></a>

## 28. Sub-teks sorakan JOKER DIBUANG?! menyebut kartunya

**Keputusan pemilik (13 Okt 2026): dipertahankan (pilihan 1).** Sub-teks tetap menyebut kartunya, misalnya "Budi buang 7 Waru · −25". Alasannya sama dengan #27. Jangan dihapus.

**Sekarang:** saat ada yang membuang joker, sorakan "JOKER DIBUANG?!" muncul dengan sub-teks misalnya "Budi buang 7 Waru · −25". Kartu itu memang terlihat di buangan dan sudah mati, tapi AGENTS.md melarang angka joker di sorakan. Sorakan ini juga memberi tahu semua orang bahwa 7 adalah angka joker putaran ini.

**Bukti:** `apps/client/src/efek/pemutar.ts:166-169`. Sorakan diberi `aria-hidden` (`apps/client/src/efek/sorak.ts:48-50`), jadi tidak dibacakan pembaca layar.

**Pilihan:**
1. **Biarkan**: membuang joker adalah kejadian publik (−25 terlihat di skor), dan meja asli juga akan heboh.
2. **Sub-teks tanpa kartu**, misalnya "Budi buang joker · −25". Masih membocorkan bahwa kartu teratas buangan adalah joker.
3. **Hilangkan sorakannya**, cukup bunyi dan penalti di rincian skor.

**Dampak:** hanya `pemutar.ts`. Pilihan 2/3 perlu test di `apps/client/test/pemutar.test.ts`.

<a id="k29"></a>

## 29. Teks aksi singkat "buang 7♥" di panel pemain

**Keputusan pemilik (13 Okt 2026): tanpa nama kartu (pilihan 2).** Teks aksi singkat untuk buang jadi "buang kartu". Kartunya tetap terlihat di tumpukan buangan selama belum tertimbun. Aksi lain (misalnya "mungut 9♦") tidak berubah.

**Sebelum keputusan:** panel tiap pemain menampilkan aksi gilirannya selama sekitar 3,5 detik, misalnya "mungut 9♦ · buang A♠". Log tidak menyebut kartu yang dibuang, tapi teks ini sempat terlihat beberapa detik. README bagian "Mode ingatan" menyebutnya sebagai perilaku yang disengaja ("terlihat jelas saat terjadi").

**Bukti:** `apps/client/src/efek/pemutar.ts:157` (`` `buang ${labelKartu(e.kartu)}` ``), batas tampil di `apps/client/src/kontrolMeja.ts:604-620` (3500 ms), dirender di `apps/client/src/game/tataMeja.ts:416`.

**Pilihan:**
1. **Biarkan** (seperti melihat tangan teman membuang).
2. **Tanpa nama kartu**, cukup "buang". Kartunya tetap terlihat di buangan selama belum tertimbun.
3. **Persingkat** waktu tampil.

**Dampak:** hanya client.

<a id="k30"></a>

## 30. Tangan 1 kartu praktis tidak bisa mulung atau mentung lagi

**Keputusan pemilik (13 Okt 2026): memang begitu (pilihan 1).** Pemilik menyerahkan pilihan ke saran pengembang: ini akibat langsung aturan modal ≥ pungutan dan kartu jadi minimal 3, jadi tidak dibuat pengecualian. Engine tidak berubah. Sub-teks sorakan "TINGGAL 1 KARTU!" tidak lagi menyebut "siap mentung".

**Sekarang:** pemain yang memulai giliran dengan 1 kartu tidak akan pernah bisa mulung. Kartu paling bawah pungutan wajib masuk kartu jadi baru, kartu jadi minimal 3 kartu, dan modal dari tangan harus ≥ jumlah pungutan di kombinasi itu. Dengan modal paling banyak 1 kartu, kombinasinya paling banyak 2 kartu. Karena mentung hanya sah di giliran yang diawali mulung, pemain itu juga tidak bisa mentung sampai putaran berakhir. Ia hanya bisa ambil deck lalu buang. Yang benar-benar mengancam adalah tangan 2 kartu (mulung ≥ 2, butuh ≥ 3 pemain).

**Bukti:**
- `packages/engine/src/giliran.ts:119-120` (`MODAL_KURANG`), syarat minimal 3 kartu di `packages/engine/src/kartuJadi.ts` (`validasiSeri`/kembar As).
- Sudah ditulis apa adanya di FAQ Bantuan: `apps/client/src/konten/bantuan.ts:770`.
- Tidak cocok dengan sub-teks sorakan "TINGGAL 1 KARTU! · Awas, X siap mentung" (`apps/client/src/efek/pemutar.ts:174`) dan lencana "TINGGAL 1!" di panel (`apps/client/src/game/tataMeja.ts:411`).

**Pilihan:**
1. **Konfirmasi memang begitu.** Lalu sub-teks sorakan sebaiknya diganti (copy UI, bukan aturan), misalnya tanpa "siap mentung".
2. **Pemilik menjelaskan aturan lain** untuk kasus ini (misalnya pengecualian modal). Itu aturan baru: wajib unit test, README, Bantuan, dan golden test.

**Dampak:** pilihan 1 hanya teks client. Pilihan 2 mengubah engine.

<a id="k31"></a>

## 31. Joker mati di tangan dinilai sebagai kartu biasa

**Keputusan pemilik (13 Okt 2026): kartu biasa (pilihan 1).** Pemilik menyerahkan pilihan ke saran pengembang: joker yang sudah dibuang jadi kartu biasa, sama seperti aturan pentungan untuk joker yang pernah dibuang. Sudah ditulis di tabel skor README dan dijaga test engine.

**Sekarang:** tabel skor README menulis "Joker: Tangan 25". Kode menilai **joker hidup** di tangan 25, sedangkan joker yang sudah mati (pernah dibuang lalu dipungut) dinilai sebagai kartu aslinya (2–10 = 5, Londo 10, As 15). Ini konsisten dengan "joker yang dibuang jadi kartu biasa", tapi belum tertulis eksplisit.

**Bukti:** `packages/engine/src/kartuJadi.ts:160-161` (`nilaiKartuTangan`: `isJokerHidup ? 25 : nilaiDasar`), dipakai `packages/engine/src/skor.ts:40`. Bantuan sudah mengikuti kode ("joker yang masih hidup di tangan bernilai 25").

**Pilihan:**
1. **Konfirmasi** dan tulis di tabel skor README (cukup dokumentasi; tambahkan test eksplisit kalau belum ada).
2. **Joker mati tetap 25 di tangan**: perubahan aturan skor (engine, test, golden, Bantuan).

<a id="k32"></a>

## 32. 2 deck: kartu kembar boleh jadi joker pengganti di seri yang sama

**Keputusan pemilik (13 Okt 2026): boleh (pilihan 1).** Perilaku kode sudah benar. Contoh dengan joker 5: 4♥, 5♥, 6♥, dan 5♥ dari deck kedua sebagai 7♥ sah. Yang tetap dilarang: dua kartu yang mewakili angka sama di satu seri. Dijaga `packages/engine/test/kembar-pengganti.test.ts` (tingkat validator dan lewat mesin), dan sudah ditulis di ringkasan aturan README bagian Joker.

**Sekarang:** di permainan 2 deck, satu seri tidak boleh punya dua kartu yang **mewakili** angka yang sama. Tapi kartu kembar fisik boleh ada di seri yang sama asal salah satunya dipakai sebagai joker pengganti. Contoh dengan joker 5: 4♥, 5♥, 6♥, dan 5♥ (deck kedua) sebagai 7♥ adalah sah.

**Bukti:** `packages/engine/src/kartuJadi.ts:132` (duplikat dicek dari `sebagai.rank`, bukan identitas kartu). Test yang ada hanya menolak kembaran **tanpa** joker: `packages/engine/test/kartuJadi.test.ts:68`. Bantuan menulis versi yang sesuai kode: `apps/client/src/konten/bantuan.ts:257`.

**Pilihan:**
1. **Konfirmasi boleh** (status quo), lalu tambahkan test eksplisit dan satu kalimat di README.
2. **Larang**: aturan baru di `kartuJadi.ts`, wajib test, README, Bantuan, dan peninjauan golden.

---

## Perilaku room (`packages/meja`)

Butir 33–38 bukan aturan main, tapi perilaku room yang tampak seperti bug. Semuanya ada di `packages/meja` (dan satu di `apps/server`), yang dikunci di rilis 0.2.0. Bukti diverifikasi dengan skrip di audit (lihat catatan tiap butir). Perbaikan #33–#37 (keputusan 13 Okt 2026) dan #38 (14 Okt 2026) diuji di `packages/meja/test/` (#38: `galat-bot.test.ts`); pergeseran golden meja yang ditimbulkannya dicatat di [baseline-gameplay.md](baseline-gameplay.md).

<a id="k33"></a>

## 33. Keluar sebelum menekan OK joker membuat meja macet

**Keputusan pemilik (13 Okt 2026): diperbaiki.** Pemain yang keluar meja sebelum menekan OK dianggap sudah OK, jadi dikeluarkan dari daftar tunggu pengumuman joker dan meja tidak menunggunya.

**Sebelum keputusan:** `tinggalkan()` (pemain menekan Keluar meja saat main) mengubah kursinya jadi bot, tapi tidak menghapus kursi itu dari `menungguJoker`. Bot tidak pernah mengirim `siapJoker`. Dengan batas waktu giliran 0 (tanpa batas, sah di online), meja menunggu selamanya. Dengan batas waktu, meja macet sampai timer cadangan habis.

**Bukti:** `packages/meja/src/meja.ts:227-236` (`tinggalkan` hanya menyaring `setujuAkhiri`), bandingkan `:216-224` (`terputus` menyaring keduanya). Audit memverifikasi dengan `JamPalsu` (3 kursi, `detikGiliran` 0): setelah B keluar dan waktu maju 10 menit, `menungguJoker=[1]` dan tidak ada timer.

**Pilihan:** saring `menungguJoker` di `tinggalkan()` seperti di `terputus()` (perbaikan kecil). Tidak menyentuh aturan main.

<a id="k34"></a>

## 34. Pemain yang menyambung ulang tidak melihat popup joker

**Keputusan pemilik (13 Okt 2026): diperbaiki (pilihan 2).** Pemain yang belum menekan OK di putaran itu mendapat popup joker lagi saat tersambung kembali (per kursi). Yang sudah menekan OK tidak ditanya lagi, jadi joker tetap diumumkan sekali untuk tiap pemain. Meja menunggu OK-nya paling lama 30 detik (`BATAS_JOKER_SAMBUNG_MS` di `packages/meja/src/meja.ts`), atau batas waktu giliran kalau itu lebih pendek. Popup yang sudah tampil sampai batas waktunya habis dianggap sudah dilihat.

**Batas tambahan (Okt 2026, temuan verifikasi rilis 0.2.0):** tiap kursi paling banyak **sekali** ditanya ulang per putaran. Kalau ia putus lagi sebelum menekan OK lalu kembali, meja tidak ditahan lagi (popup tidak muncul lagi). Sebelumnya tunggu itu ikut batas waktu giliran (bisa sampai 10 menit) dan bisa berulang tiap putus-sambung, sehingga meja bisa beku lama. **Sisa yang diketahui:** batas waktu giliran pemain yang sedang jalan diulang penuh sesudah tunggu joker selesai (sisa waktunya tidak disimpan); pemain yang tersambung kembali saat susun akhir tidak mendapat popup joker.

**Sebelum keputusan:** pemain yang terputus saat pengumuman joker (termasuk karena refresh) dikeluarkan dari `menungguJoker`, dan saat kembali tidak dimasukkan lagi. Ia tidak pernah melihat angka joker putaran itu (tidak ada tempat lain yang menampilkannya). Di mode offline popup muncul lagi karena `menungguJoker` ikut tersimpan.

**Bukti:** `packages/meja/src/meja.ts:216-224` (filter saat terputus), `:207-214` (`terhubung` tidak menyentuh `menungguJoker`), `:406-411` (daftar hanya diisi saat putaran baru). Client membuka popup hanya kalau `info.menungguJoker` memuat kursinya (`apps/client/src/kontrolMeja.ts:717`).

**Pilihan:**
1. **Biarkan**: yang terputus kehilangan pengumuman (seperti orang yang sedang ke belakang saat kartu dibuka).
2. **Tampilkan lagi** untuk kursi yang belum menekan OK di putaran ini (per kursi, bukan untuk semua). Menyentuh keputusan "joker diumumkan sekali", jadi perlu persetujuan pemilik.

<a id="k35"></a>

## 35. Batas waktu basi setelah semua manusia terputus

**Keputusan pemilik (13 Okt 2026): diperbaiki.** Saat ada pemain yang kembali dan permainan lanjut dari jeda, batas waktu giliran yang sedang berjalan diulang dari awal.

**Sebelum keputusan:** saat semua manusia terputus, meja berhenti menjadwalkan (permainan terjeda), tapi `batasWaktu` giliran yang sedang berjalan tidak direset. Saat pemain kembali, sisa waktunya sudah 0, dan bot langsung mengambil alih giliran orang yang baru kembali.

**Bukti:** `packages/meja/src/meja.ts:480` (`return` tanpa mereset `kunciTimer`/`batasWaktu`), `:527-531` (sisa dihitung dari `batasWaktu` lama). Audit: `detikGiliran` 60, A terputus 5 menit di gilirannya, lalu kembali: `batasWaktu - sekarang = -240000`, 1 ms kemudian `diambilAlihBot=true`.

**Pilihan:** reset (atau beri sisa waktu penuh) saat permainan lanjut dari jeda. Mengubah perilaku room, tidak menyentuh aturan main.

<a id="k36"></a>

## 36. Voting "Akhiri permainan" tidak dihitung ulang saat pemilih berkurang

**Keputusan pemilik (13 Okt 2026): diperbaiki.** Voting dihitung ulang setiap ada pemilih yang terputus atau keluar. Kalau semua manusia yang tersisa sudah setuju, permainan langsung selesai.

**Sebelum keputusan:** syarat "semua manusia yang terhubung setuju" hanya dicek saat ada yang menekan tombol. Kalau semua yang tersisa sudah setuju lalu satu-satunya yang belum setuju terputus atau keluar, permainan tidak berakhir sampai ada yang menekan tombol lagi.

**Bukti:** `packages/meja/src/meja.ts:364-380` (cek `pemilih.every(...)` hanya di `akhiri()`); `terputus()` `:216-224` dan `tinggalkan()` `:227-236` tidak mengecek ulang. Sudah diverifikasi lewat uji online dengan klien WebSocket (Okt 2026): A dan B setuju, C terputus, status tetap `putaranSelesai` sampai A menekan tombol lagi.

**Pilihan:** cek ulang voting setiap pemilih berkurang, atau biarkan (pemain cukup menekan tombol lagi).

<a id="k37"></a>

## 37. Refresh di giliran sendiri langsung dimainkan bot

**Keputusan pemilik (13 Okt 2026): beri masa tenggang (pilihan 2).** Warga kedai baru mengambil alih giliran pemain yang terputus setelah masa tenggang 20 detik sejak ia terputus (`TENGGANG_SAMBUNG_MS` di `packages/meja/src/meja.ts`). Kalau meja memakai batas waktu giliran, batas itu tetap berlaku: mana yang habis lebih dulu. Angka 20 detik dipilih dari usulan 15–20 detik.

**Sebelum keputusan:** kursi manusia yang sedang terputus langsung dijalankan bot setelah jeda mikir (tempo santai 3–10 detik, cepat 0,8–2 detik), tidak menunggu batas waktu giliran. Refresh halaman biasa atau sinyal putus sebentar di giliran sendiri bisa membuat giliran itu dimainkan bot. README "Keputusan perilaku aplikasi" menyebut "Pemain yang terputus: gilirannya dijalankan bot sampai ia kembali", jadi ini sesuai teks, tapi terasa kasar untuk putus singkat.

**Bukti:** `packages/meja/src/meja.ts:506-519` (`!k.terhubung` langsung masuk `olehBot`).

**Pilihan:**
1. **Biarkan** (sesuai teks keputusan sekarang).
2. **Masa tenggang** sambung ulang, misalnya min(sisa batas waktu, N detik) sebelum bot mengambil alih. Perlu angka N dari pemilik.

<a id="k38"></a>

## 38. Error di timer bot bisa mematikan server

**Keputusan pemilik (14 Okt 2026): diperbaiki (saran pengembang).** Galat di langkah warga kedai atau di timer meja lain tidak boleh membuat meja macet, baik di server maupun di mode offline. Perbaikannya di `packages/meja`, jadi berlaku untuk keduanya:

- **Cadangan berlapis di `langkahBot()`.** Kalau strategi sesuai level kursi galat atau aksinya ditolak mesin, warga kedai memakai strategi mudah. Kalau itu juga galat, dipakai aksi sah paling sederhana (`aksiAman()`): tahap ambil = ambil dari deck, tahap main = buang kartu pertama yang lolos `validasiBuang` (joker hidup dipilih paling akhir, supaya tidak kena −25 kalau masih ada kartu lain), susun akhir = Selesai. Semuanya tetap divalidasi mesin, jadi tidak ada aturan baru.
- **Semua cadangan galat:** giliran itu dicoba lagi dengan jeda 2, 4, 8, 16, 32, lalu 60 detik (`JEDA_ULANG_GALAT_MS`, `JEDA_ULANG_GALAT_MAKS_MS`), tidak pernah berputar cepat. Selama menunggu, meja tetap melayani pemain: emote dan keluar meja jalan, dan pemain yang terputus bisa kembali memainkan gilirannya sendiri. Begitu langkahnya berhasil, jeda kembali normal.
- **Galat sesudah aksi diterapkan** (misalnya saat menyiarkan ke pemain) tidak lagi memicu aksi cadangan. Sebelumnya cadangan diterapkan ke state lama, sehingga aksi yang sudah terjadi bisa tertimpa.
- **Semua timer meja** (langkah warga kedai, batas waktu giliran, batas waktu pengumuman joker, masa tenggang sambung ulang, celetukan) dipasang lewat `pasangTimer()`. Galat di dalamnya ditangkap, lalu jadwal meja disusun ulang supaya meja tidak tertinggal tanpa timer. Kalau menyusun jadwal itu sendiri galat, dicoba lagi dengan jeda yang sama.
- **Pencatatan:** galat dilaporkan lewat `OpsiMeja.saatGalat` (bawaan `console.error`). Server menghitungnya sebagai `galatMeja` dan mencatat "galat di timer meja …". Pembungkus penjadwal dan penjaga `uncaughtException` di server tetap ada sebagai jaring terakhir.

Diuji di `packages/meja/test/galat-bot.test.ts`: galat disuntikkan lewat mock engine dan penjadwal yang tersendat, semuanya digerakkan `JamPalsu`. Jalur normal tidak berubah, jadi golden master meja tidak bergeser.

**Sisa yang diketahui** (seharusnya hanya terjadi kalau engine sendiri rusak; contoh kasus tanpa buangan sah, tangan berisi As semua sebelum punya kartu jadi, tidak mungkin terjadi menurut #5 di README):
- Kalau aksi sah paling sederhana pun gagal, giliran warga kedai itu tertahan dan dicoba ulang tiap 60 detik. Pemain tetap bisa keluar meja.
- Kalau giliran pemain yang masih tersambung sudah diambil alih warga kedai karena waktunya habis, lalu semua cadangan gagal, pemain itu tetap tidak bisa memainkan gilirannya sendiri sampai percobaan ulang berhasil (ia tetap bisa keluar meja). Sengaja tidak diubah: melepas pengambilalihan berarti mengulang batas waktu giliran, dan itu perubahan perilaku room.

**Sebelum keputusan:** `langkahBot()` menangkap error aksi bot pertama lalu mencoba bot mudah, tapi percobaan cadangan itu (dan error lain di `terapkan`/`siarkan` di dalam timer) tidak ditangkap lagi. Di Node, error di dalam `setTimeout` menjadi `uncaughtException`. Awalnya server tidak punya penangan untuk itu, jadi proses mati dan semua meja (yang hanya ada di memori) hilang. Belum pernah terjadi di simulasi (bot selalu memakai validasi yang sama), jadi ini soal ketahanan.

Sisi server sudah ditangani lebih dulu (Okt 2026, `apps/server`): callback timer meja dijalankan lewat penjadwal pembungkus yang menangkap galat per meja (dicatat dan dihitung sebagai `galatMeja`, terlihat di log berkala atau `/healthz` dengan `HEALTHZ_DETAIL=1`), ditambah penjaga `uncaughtException`/`unhandledRejection`. Proses tidak mati lagi, tapi meja yang galat di `langkahBot` tetap bisa macet (timer bot tidak dijadwalkan ulang sampai ada perubahan lain), dan mode offline di browser tidak punya pembungkus itu.

**Bukti (kode 0.2.0):** `packages/meja/src/meja.ts:550-558` (cadangan `this.terapkan(g, cadangan)` tanpa `try`), `apps/server/src/main.ts` (waktu itu belum ada `process.on('uncaughtException')`).

**Pilihan:** bungkus callback timer di `Meja` dengan `try/catch` yang mencatat error lalu menjeda meja itu saja, dan/atau pasang penangan proses di server yang mencatat lalu tetap hidup. Tidak menyentuh aturan main.

<a id="k39"></a>

## 39. Batas meja dan sambungan per jaringan (deploy)

**Keputusan pemilik (13 Okt 2026): bawaan dinaikkan** ("pilihkan yang terbaik"). `MAKS_MEJA_PER_IP` bawaan 60 (dulu 20) dan `MAKS_SAMBUNGAN_PER_IP` bawaan 150 (dulu 50). Keduanya tetap bisa diubah lewat env saat deploy.

**Sebelum keputusan:** server membatasi 20 meja per alamat IP pembuatnya dan 50 sambungan WebSocket sekaligus per jaringan, supaya satu orang iseng tidak bisa memenuhi server.

**Masalahnya:** semua HP yang memakai Wi-Fi kedai keluar lewat **satu IP publik** yang sama. Meja yang ditinggal baru dihapus sekitar 10 menit kemudian dan tetap dihitung selama itu. Kalau banyak yang membuat meja dari Wi-Fi kedai, batas 20 bisa tersentuh dan pemain mendapat "Kebanyakan meja dari jaringanmu, Bos."

**Alasan angka:** 60 meja cukup untuk satu kedai yang ramai (puluhan meja aktif plus meja lama yang belum terhapus), dan masih jauh di bawah batas total `MAKS_MEJA` (500), jadi satu jaringan tetap tidak bisa memenuhi server. 150 sambungan cukup untuk 60 meja yang rata-rata berisi 2–3 HP, sekaligus menampung CGNAT operator seluler. Batas pesan per sambungan (banjir pesan) tidak berubah.

**Bukti:** konstanta `BAWAAN_MAKS_MEJA_PER_IP` dan `BAWAAN_MAKS_SAMBUNGAN_PER_IP` di `apps/server/src/server.ts`; env dibaca di `apps/server/src/main.ts`. Dikunci test `apps/server/test/ketahanan.test.ts` (meja ke-61 ditolak) dan `apps/server/test/keamanan.test.ts` (sambungan ke-151 ditolak 429).

---

## Catatan lain (belum masuk tabel)

Temuan audit yang lebih kecil, dicatat supaya tidak hilang:

- **Pemenang dan seri belum didefinisikan di README.** Engine tidak punya konsep pemenang. Klasemen dibuat `buatRingkasanAkhir()` (`packages/meja/src/meja.ts:615`): urut skor tertinggi, skor sama berbagi peringkat. UI mengikuti ini ("X juara (bareng)").
- **Prioritas batas skor vs batas putaran:** kalau keduanya tercapai di putaran yang sama, alasan selesai = batas skor (urutan `if` di `packages/engine/src/mesin.ts:489-491`). Batasnya inklusif (`>=`/`<=`). Belum tertulis di README.
- **Urutan bagi kartu:** animasi bagi sudah disamakan dengan engine (mulai dari pengocok, nomor kursi naik, tanpa melihat arah; `apps/client/src/game/MejaScene.ts`, `bagiKartu`). Kalau di Kedai Madya urutannya lain, itu keputusan pemilik dan harus diubah di engine dulu.
- **Simpanan offline berisi state lengkap** (deck, tangan bot) di `localStorage` (`remi.mejaOffline`). Hanya mode lawan bot, tapi bisa diintip lewat devtools.

**Menunggu konfirmasi pemilik (14 Okt 2026).** Sudah dikerjakan sesuai saran pengembang dan tidak mengubah aturan main, tapi pemilik belum menanggapi secara khusus. Kalau pemilik tidak setuju, ubah di tempat yang disebut:
- **Bunyi khusus pentung joker.** Pentungan joker (250) memutar bunyi `mentungJoker` yang lebih besar, baru sesudah kartunya terbuka di meja. Bunyi `tegang` sebelum dibuka sama untuk pentungan apa pun, jadi tidak membocorkan isinya (dijaga `apps/client/test/suaraDramatis.test.ts`), dan judul panel PENTUNG JOKER! sudah begitu sejak 0.2.0. Kalau semua pentungan harus berbunyi sama: satu baris di `apps/client/src/efek/pemutar.ts` (peristiwa `mentung`).
- **Gaya warga kedai Jago dan Suhu yang menahan kartu jadi di tangan.** Sah menurut aturan sekarang, karena semua pemain boleh menurunkan kartu jadi di susun akhir (#19, #24), dan di arena jauh lebih kuat daripada langsung menurunkan (selalu menurunkan rugi sekitar 17–67 poin per putaran). Kalau gaya "antem-anteman" ini dianggap tidak sesuai kebiasaan meja Kedai Madya, itu keputusan aturan (atau parameter strategi di `packages/engine/src/bot/strategi.ts`), bukan perubahan sepihak.

## Identitas Kedai Madya (sudah diputuskan, Okt 2026)

Bukan aturan main. Dicatat supaya tidak diubah tanpa pemilik:

- **Istilah pemain komputer di UI:** "warga kedai". Kode, protokol, dan dokumen teknis tetap `bot`.
- **Nama lawan:** konsep "Warga Madya" (Kipas Dua, Cak Kopag, Mbak Teras, Mas Sampul, Si Rak, Pak Seng, Dik Toska, Ning Sore, Om Garpu, Bu Sendok), diacak per meja, urutan tetap untuk latihan. Golden master meja boleh bergeser **hanya** karena nama ini (lihat [baseline-gameplay.md](baseline-gameplay.md)).
  - **Tambahan pemilik (14 Okt 2026), ejaan persis:** Cak Owner, Penampil, Koki-Kun, Bang IT, Bos Bocil, Jurik, Bajigur, Pak Tani, Juragan, Ning Kukis, Mbak Mata, Om Napi ("Mas Sampul" di permintaan yang sama sudah ada). Ditambahkan di belakang daftar, jadi latihan dan golden meja tetap memakai nama-nama terdepan dan tidak bergeser.
- **Level warga kedai (14 Okt 2026):** pemilik meminta level susah dan sangat susah dengan nama yang disesuaikan. Jadinya **Mudah, Normal, Jago, Suhu** (Jago = susah, Suhu = sangat susah); nama dipilih pengembang. Pemilik kemudian memutuskan (14 Okt 2026): di UI, Jago dan Suhu tampil **namanya saja**, tanpa petunjuk "susah"/"susah banget" dan tanpa keterangan cara main, di Atur meja, lobi, Bantuan, maupun CHANGELOG bagian pemain. Mudah dan Normal tetap punya keterangan singkat di Atur meja. Label dan keterangannya satu sumber di `apps/client/src/konten/levelWarga.ts`, dijaga `levelWarga.test.ts`.
- **Logo:** dianggap sudah diizinkan kedai; kredit "Logo Kedai Madya dipakai dengan izin." di Tentang.
- **Punggung kartu:** dasar arang + kawung kuning MADYA (#f1a615) + medali krem berisi maskot cangkir (versi mini: siluet cangkir).
- **Promosi:** soft selling di beranda, Tentang, dan satu baris di klasemen akhir saja. Selama permainan tidak pernah muncul sendiri (tanpa pop-up/toast); pemain bisa melihatnya kapan saja lewat Tentang, termasuk dari menu ☰ saat bermain (rincian di AGENTS.md, "Promosi Kedai Madya").
- **Tautan peta:** URL cid Google Maps sebagai utama (di HP langsung membuka aplikasi Maps). Tautan share.google dari pemilik disimpan sebagai cadangan di `konten/kedai.ts` karena membuka Google Search dulu.

Masih terbuka (bawaan sekarang di kurung):
- Nomor telepon kedai (tidak ditampilkan sampai pemilik kedai mengizinkan).
- Jam buka (tidak ditulis karena IG dan Maps berbeda; pemain diarahkan ke IG/Maps).
- Tautan peta di bio IG dan di katalog buku belum dicek tujuannya (tidak dipakai).
- Opsional dari brief yang belum dikerjakan: splash logo, watermark maskot di meja, font judul Fredoka.
