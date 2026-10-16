# Keputusan pemilik: rincian butir #25–#47

Dokumen ini merinci baris **#25–#47** di tabel [Aturan Terbuka dan keputusan](../README.md#aturan-terbuka-dan-keputusan) README. Butir #25–#38 ditemukan saat audit rilis 0.2.0 dan sengaja tidak diubah sampai pemilik memutuskan: sebagian menyangkut aturan main atau info rahasia (wewenang pemilik), sebagian lagi perilaku room di `packages/meja`. Butir #39 adalah pengaturan deploy. Butir #40–#47 datang dari permintaan pemilik 16 Okt 2026 sesudah main bareng di Kedai Madya: #40–#46 sudah diterapkan (#42–#43 di engine, meja, server, dan warga kedai; isian, tombol, dan tampilannya di aplikasi menyusul), sedangkan #47 sudah diputuskan tapi baru diterapkan di rilis berikutnya (ditandai **Diputuskan, diterapkan di rilis berikutnya**; aturan dan kode untuk butir itu belum berubah).

**Semua butir bernomor sudah diputuskan pemilik:** #25–#37 dan #39 pada 13 Okt 2026, #38 pada 14 Okt 2026, #40–#47 pada 16 Okt 2026. Baris #20–#23 README (susun akhir) juga sudah diputuskan 16 Okt 2026: sesuai bawaan yang sudah berjalan. Jangan ubah perilaku yang sudah diputuskan tanpa izin pemilik. Yang masih perlu dikonfirmasi pemilik hanya dua tafsiran: #43 (mode kaldu tanpa batas skor) dan kelompok "berubah-ubah" di #47. Catatan kecil dari 14 Okt 2026 (bunyi dramatis, gaya Jago/Suhu) sudah ditanggapi, lihat [Catatan lain](#catatan-lain-belum-masuk-tabel).

Untuk tiap butir ada: keputusan pemilik (kalau sudah), apa yang terjadi sebelum keputusan, bukti di kode (`file:baris`, per kode saat rilis 0.2.0, jadi nomor baris bisa sudah bergeser), pilihan yang waktu itu ditawarkan, dan dampaknya. Pilihan **bukan aturan baru**, hanya daftar kemungkinan yang ditawarkan ke pemilik.

Pemilik menjawab lewat daftar pertanyaan bernomor 4–13. Padanannya: 4 = #25 dan #26, 5 = #27 dan #28, 6 = #29, 7 = #30–#32 (#32 dijawab langsung; #30 dan #31 diserahkan ke saran pengembang), 8 = #34, 9 = #33, 10 = #36, 11 = #37, 12 = #35, 13 = #39. #38 disetujui 14 Okt 2026, saat pemilik meminta rencana perbaikannya dikerjakan. #40–#47 dijawab 16 Okt 2026 lewat komentar atas rencana peningkatan (tujuh permintaan sesudah main bareng di kedai).

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
| [40](#k40) | Angka joker boleh sama dengan putaran sebelumnya | aturan (persiapan putaran) | Diputuskan: dianulir, buka kartu lagi (diterapkan) |
| [41](#k41) | Mentung hanya dengan satu kartu | aturan mentung + skor | Diputuskan: boleh beberapa joker hidup sekaligus, 250 per joker (diterapkan) |
| [42](#k42) | Mode kaldu: pentungan ×2 di putaran terakhir | aturan (opsi meja) | Diputuskan: opsi meja, kaldu lagi kalau deck habis (diterapkan) |
| [43](#k43) | Mode kaldu dan batas skor | aturan (opsi meja) | Diputuskan (tafsiran, perlu konfirmasi): batas skor tidak dipakai (diterapkan) |
| [44](#k44) | Batas skor kaku ±500 | `packages/meja` (validasi) + client | Diputuskan: angka bebas kelipatan 10 |
| [45](#k45) | Leaderboard terasa tidak adil | `packages/meja` + `apps/server` + client | Diputuskan: banyak urutan, bawaan rata-rata per permainan |
| [46](#k46) | Banyak teman tidak tahu game ini bisa dipasang | client (beranda) | Diputuskan: tombol pasang melayang hanya di beranda, "Nanti saja" 3 hari |
| [47](#k47) | Warga kedai gampang dibaca, bahkan Suhu | `packages/engine` (bot) + `packages/meja` | Diputuskan (kelompok berubah-ubah perlu konfirmasi), diterapkan di rilis berikutnya |

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

<a id="k40"></a>

## 40. Angka joker tidak boleh sama dengan putaran sebelumnya

**Diputuskan pemilik (16 Okt 2026), diterapkan.** Aturan baru; tercatat di CHANGELOG `[Belum dirilis]`.

**Keputusan pemilik (16 Okt 2026):** angka joker tidak boleh sama dengan angka joker **putaran tepat sebelumnya**. Kalau kartu yang dibuka angkanya sama, kartu itu dianulir (disisihkan, lalu diselipkan kembali ke deck secara acak) dan kartu berikutnya dibuka, sampai angkanya beda. Hanya dibandingkan dengan putaran tepat sebelumnya: putaran 3 boleh sama dengan putaran 1. Berlaku di semua meja (bukan opsi). **Tidak ada penjelasan anulir di popup joker**: popup tetap hanya menampilkan kartu joker yang berlaku.

**Sebelum keputusan:** kartu dibuka sesudah semua kartu dibagi lalu diselipkan acak ke deck (`packages/engine/src/mesin.ts`, dulu baris 198-200), tanpa membandingkan dengan putaran sebelumnya. Bagian "joker dibuka sesudah semua kartu dibagi, lalu diselipkan acak" sudah persis seperti permintaan pemilik dan tidak diubah.

**Penerapan:** `bukaKartuJoker(deck, rankSebelumnya, rng)` di `packages/engine/src/mesin.ts`, dipanggil `mulaiPutaran` dengan `s.riwayat.at(-1)?.rankJoker` (riwayat hanya berisi putaran yang sudah selesai, jadi entri terakhir selalu putaran tepat sebelumnya; permainan baru, termasuk sesudah "Main lagi", mulai dengan riwayat kosong dan bebas). Urutannya:
1. Kartu teratas deck dibuka. Selama angkanya sama dengan `rankSebelumnya`, kartu itu disisihkan ke daftar sementara dan kartu berikutnya dibuka. Tidak ada kartu yang dibuka dua kali.
2. Kartu joker diselipkan dengan **satu** `rng.int(deck.length + 1)`, persis cara lama.
3. Kartu yang dianulir diselipkan acak satu per satu (satu `rng.int` per kartu, urut dari yang pertama dibuka), jadi jumlah dan isi deck tetap.

Tanpa anulir, pemakaian RNG dan urutan deck sama persis dengan sebelum aturan ini (dibuktikan golden 2 dan 3 pemain yang tidak berubah). Kalau seluruh sisa deck berangka sama, `KONFIGURASI_TIDAK_SAH` dilempar; ini mustahil di meja sungguhan (sisa deck minimal 28 kartu, satu angka paling banyak 8 kartu). Tidak ada field baru di state, view, maupun peristiwa; popup joker, log, dan bunyi tidak berubah. Invarian baru di `packages/engine/src/invarian.ts`: angka joker putaran berjalan beda dengan `riwayat[nomor − 2]`, dan angka joker berurutan di riwayat selalu beda. Bantuan (`apps/client/src/konten/bantuan.ts`): satu kalimat di bab Mulai main, satu paragraf di bab Joker, dan satu tanya-jawab (FAQ). Tutorial tidak diubah (hanya memainkan putaran pertama, yang tidak pernah menganulir).

**Test:** `packages/engine/test/joker-putaran.test.ts` (tanpa joker sebelumnya dan tanpa anulir sama persis dengan cara lama, termasuk state RNG; anulir sekali dan beruntun di 2 deck; setiap kartu dibuka paling banyak sekali; jumlah dan isi deck tetap; urutan deck persis untuk seed tetap; RNG dipakai 1 + jumlah anulir; `mulaiPutaran` di semua konfigurasi selalu beda dari putaran sebelumnya dengan invarian lolos; putaran pertama tidak pernah menganulir; putaran 3 boleh sama dengan putaran 1; deck yang isinya angka lama semua ditolak tanpa diubah), `packages/meja/test/meja.test.ts` (putaran pertama sesudah "Main lagi" boleh sama dengan putaran terakhir permainan lama), `apps/client/test/kontenAturan.test.ts` (klaim Bantuan cocok dengan engine), dan assertion angka joker berurutan selalu beda di `packages/engine/test/golden.test.ts`. Golden engine bergeser hanya di enam permainan yang dulu mengulang angka joker, mulai dari putaran yang dianulir (rincian di [baseline-gameplay.md](baseline-gameplay.md)); golden meja tidak berubah. `packages/meja/test/batas-skor.test.ts` kasus 600/−400 memakai seed meja 5, karena seed bawaannya menganulir di putaran 4 dan permainannya jadi 34 putaran (melewati batas waktu test).

<a id="k41"></a>

## 41. Mentung pakai beberapa joker

**Diputuskan pemilik (16 Okt 2026), diterapkan** di engine, validasi pesan meja, warga kedai Jago/Suhu, dan meja (client: tombol, seret, animasi, panel mentung, rincian skor). Aturan baru; tercatat di CHANGELOG `[Belum dirilis]`.

**Keputusan pemilik (16 Okt 2026):** mentung dengan 2 kartu atau lebih hanya boleh kalau **semuanya joker hidup**. Joker mati dihitung kartu biasa (tidak boleh ikut). Nilainya **250 per joker** (2 joker = 500, 3 joker = 750, dan seterusnya).

**Sebelum keputusan:** mentung selalu dengan tepat satu kartu terakhir (`validasiBuang`, `packages/engine/src/giliran.ts`, dulu baris 144).

**Penerapan:**
- Aksi `buang` mendapat `kartuIdLain?: string[]` (kosong atau tidak ada = buang satu kartu, jalur dan pesannya sama persis dengan sebelumnya). `validasiBuang` (`giliran.ts`) mengembalikan `kartuLain` (selalu array) dan untuk 2+ kartu memeriksa berurutan, supaya penolakan tidak menyebut joker sebelum syarat struktur terpenuhi:
  1. semua kartu ada di tangan (`KARTU_TIDAK_ADA`, "Kartu itu nggak ada di tanganmu.");
  2. tidak ada yang dipilih dua kali (`KARTU_DOBEL`, "{kartu} kepilih dua kali.");
  3. jumlahnya sama dengan seluruh tangan (`BUANG_SATU_KARTU`, "Buangnya satu kartu aja, Bos. Lebih dari satu cuma boleh buat nutup, dan semua sisa kartumu harus ikut dibuang.");
  4. giliran diawali mulung (`NUTUP_TANPA_MULUNG`, pesan lama);
  5. semuanya joker hidup (`PENTUNGAN_BUKAN_JOKER`, "Nutup pakai beberapa kartu cuma boleh kalau semuanya joker. Joker yang sudah pernah dibuang dihitung kartu biasa.").
  Larangan As tanpa kartu jadi tetap dicek untuk tiap kartu sesudahnya (di meja tidak pernah kena, karena giliran mulung selalu menurunkan kartu jadi).
- `nilaiPentunganTotal(pentungan, pentunganJoker, lain = [])` di `skor.ts` = `nilaiPentungan(...)` + 250 × jumlah kartu lain. Tidak ada −25 untuk joker yang dipakai mentung. `hitungSkorPemain` tidak berubah: yang mentung dapat totalnya sekali, tiap kepentung kena totalnya penuh. Kepentung dan arah ditentukan seperti biasa.
- `mesin.ts` (`buang`): status joker dibaca sebelum kartu ditandai mati; semua kartu keluar dari tangan, masuk `jokerMati`, dan masuk buangan berurutan (kartu pertama dulu). Tetap **satu** peristiwa `buang` dengan `kartuLain?`, karena golden, pemutar, dan ingatan warga kedai bergantung pada itu. Log mengikuti pola log mentung yang sudah ada: "Budi mentung pakai 7 Waru dan 7 Kriting!". `InfoMentung`, peristiwa `mentung`, dan `HasilPutaran` mendapat `pentunganLain?`; nilai di peristiwa dan `HasilPutaran.nilaiPentungan` berisi total. Semua field baru hanya ditulis kalau ada, jadi hash golden dan simpanan lama tidak berubah (`migrasiState` tidak perlu mengisi bawaan; pembacanya memakai `?? []`). Invarian baru (`invarian.ts`): pentungan beberapa kartu semuanya berangka joker, sudah jadi joker mati, nilainya 250 per kartu, dan tangan yang mentung kosong.
- Meja (`packages/meja/src/validasi.ts`): `validasiAksi` menerima `kartuIdLain` berupa array paling banyak `MAKS_KARTU_BUANG_LAIN` (7) id string (≤ 40 huruf); daftar kosong dibuang supaya aksinya sama persis dengan buang lama. Sah tidaknya tetap diputuskan engine. Client dan server dirilis bersama, jadi tidak ada risiko server lama yang membuang field ini.
- Warga kedai: Jago/Suhu (`rencanaMentung`, `packages/engine/src/bot/strategi.ts`) mencoba menyisakan kelompok joker hidup terbesar (j turun sampai 2) sebagai pentungan, dengan sisa tangan habis jadi kartu jadi (`Penyusun.cari` mode `tepat: 0`), divalidasi `validasiTurunkan` dan `validasiBuang`. Tangan yang isinya joker semua langsung dibuang tanpa turunkan. Pentungan beberapa joker (≥ 500) selalu didahulukan karena di atas pentungan satu kartu mana pun. Korban kepentung tidak menghitung kartu pentungan. Penilaian tangan (kesiapan mentung) tidak diubah. `ingatan.ts` mencatat `kartuLain` sebagai kartu yang sudah dibuang. Mudah/Normal tidak diubah (dikunci golden). Arena 16 Okt 2026 (`--uji=jago,suhu --lawan=normal --waktu`, 200 seed per meja, sebelum dan sesudah diukur bersamaan): selisih atas Normal tidak turun di meja mana pun (Jago 2 pemain +71,6 → +73,9, 4 pemain 2 deck +59,1 → +61,4; Suhu 4 pemain 2 deck +92,2 → +95,9; meja lain naik 0–1,6, semuanya di dalam selang kepercayaan), p99 lama mikir Jago 7,25 → 7,40 ms dan Suhu 14,6 → 15,3 ms. Di simulasi `npm test` (2.160 putaran) ada 13 kali nutup pakai beberapa joker, tanpa aksi ditolak.
- Info rahasia: banyaknya kartu yang dibuang tertutup sebagai pentungan terlihat semua orang, seperti di meja asli, dan semuanya baru dibuka saat pentungan dibuka. Tidak ada pemeriksaan seluruh tangan yang bisa membocorkan joker.
- Client (`apps/client`), teks di meja sesingkat mungkin:
  - `KontrolMeja.statusTombol()` memanggil `validasiBuang` hanya untuk kartu yang dipilih pemain (`kartuIdLain` kalau 2+). Pesan buatan client "Pilih tepat satu kartu untuk dibuang." dihapus: belum memilih = "Pilih kartu yang mau dibuang.", satu kartu seperti dulu, 2+ kartu = pesan dari engine. Penanda "Tinggal satu kartu: buang untuk mentung!" tetap hanya dari buang satu kartu; seluruh tangan tidak pernah dicoba sebagai nutup beberapa kartu sebelum pemain memilih (itu akan membocorkan apakah sisa kartunya joker semua).
  - Tombol buang dengan 2+ kartu dipilih: "Mentung pakai N kartu!" kalau sah, "Buang N kartu" (mati, alasan dari engine di petunjuk) kalau tidak. Tidak pernah menyebut joker. Ditekan (atau pintasan B) = satu aksi `buang` dengan `kartuIdLain`, urut seperti di layar; buang satu kartu tetap dikirim tanpa `kartuIdLain`.
  - Seret ke buangan: kalau kartu yang diseret ikut pilihan yang mencakup seluruh tangan (2+), artinya nutup pakai semuanya dan kartu yang diseret jadi `kartuId`. Yang tidak sah ditolak (kartu kembali, pilihan dibiarkan), tidak diam-diam jadi buang satu kartu. Selain itu tetap buang satu kartu yang diseret.
  - `MejaScene.pentung(daftar, nilai, merah, saatDibuka)` menerima semua kartu pentungan: dibuang tertutup berjajar, bergetar dan dibalik bersamaan, `saatDibuka` sekali, satu label nilai total, lalu ke buangan bergiliran; cadangan waktunya 6,5 dtk + 0,4 dtk per kartu tambahan, durasi lewat `durasi()`, kartu tidak bergoyang saat gerak dikurangi dan tanpa percikan saat efek hemat. Satu kartu = gerak lama. Pemutar: teks aksi singkat tetap "MENTUNG!", `bunyi('tegang')` sebelum dibuka sama persis untuk berapa pun kartunya, `mentungJoker` sesudah dibuka.
  - Panel mentung: "PENTUNG 2 JOKER!" (n > 1), "nutup pakai 7 Waru dan 7 Love · nilai 500", satu gambar kartu per pentungan, status ±total. Rincian skor dan kalimat cara selesai menyebut semua pentungan ("7 Waru dan 7 Love (joker semua)").
  - Bantuan: baris "Nutup pakai beberapa joker" di tabel Cara main di aplikasi, dan tanya-jawabnya menyebut caranya (pilih semuanya, lalu tekan Mentung).

**Test:** describe "#41" di `packages/engine/test/mentung.test.ts` (2 joker +500/−500 tanpa −25 dan keduanya di `jokerMati` dan buangan, 3 joker 2 deck dengan dua kepentung ±750 dan lompat, tangan isinya joker semua, turunkan dulu lalu nutup, arah mundur dibalik, teks log, penolakan joker + kartu biasa, joker hidup + joker mati, 2 dari 3 kartu, sesudah ambil deck, kartu dobel dan id asing, urutan struktur sebelum joker, daftar kosong = satu kartu sama persis), `buang.test.ts` (`kartuLain` kosong untuk satu kartu), `skor.test.ts` (`nilaiPentunganTotal`), `peristiwa.test.ts` (satu peristiwa buang dengan `kartuLain`, peristiwa mentung dengan `pentunganLain` dan nilai total, jalur satu kartu tanpa field baru, info mentung di view semua pemain), `fuzz.test.ts` (buang beberapa kartu acak dicocokkan dengan urutan syarat), `bot-kuat.test.ts` (Jago/Suhu memilih 500 di atas 250, turunkan dulu lalu nutup, joker mati kembali ke satu kartu, tetap murni dan tidak bergantung rng), penghitung nutup beberapa joker di statistik simulasi, `packages/meja/test/mentung-joker.test.ts` (validasi bentuk `kartuIdLain` dan nutup dua joker lewat `terima`), dan `apps/client/test/kontenAturan.test.ts` (klaim Bantuan cocok dengan engine). Client: describe "#41" di `apps/client/test/kontrolMeja.test.ts` (tombol dan aksi yang dikirim, pintasan B, tiga alasan penolakan, belum memilih, test kebocoran: sebelum memilih bar, petunjuk, dan pengumuman pembaca layar sama persis untuk dua joker hidup vs dua kartu biasa sesudah mulung, aturan seret, panel dari sisi yang mentung dan yang kepentung), `pemutar.test.ts` (kartu yang terbuka termasuk `kartuLain`/`pentunganLain`, permainan buatan nutup dua joker diputar ulang dari dua sisi tanpa galat), `suaraDramatis.test.ts` (dua kartu: sebelum dibuka cuma 'tegang', sesudahnya 'mentungJoker'), dan `rincianSkor.test.ts` (semua pentungan disebut, ±500). Kedua golden lolos tanpa `-u`. Dicek di Chromium (Vite dev, 390×844 dpr 3 dan 1440×900): nutup dua joker lewat tombol dan lewat seret, mentung satu kartu, dan buang biasa.

<a id="k42"></a>

## 42. Mode kaldu

**Diputuskan pemilik (16 Okt 2026), diterapkan** di engine, meja, server, dan warga kedai Jago/Suhu. Isian Atur meja/lobi, tombol voting, dan tampilan di meja menyusul di tahap client. Aturan baru; tercatat di CHANGELOG `[Belum dirilis]`.

**Keputusan pemilik (16 Okt 2026):** opsi meja **Mode kaldu**. Di putaran terakhir, nilai pentungan dikali dua untuk yang mentung **dan** yang kepentung. Putaran terakhir = putaran ke-N kalau batas putaran diisi, atau sesudah voting **"putaran berikutnya terakhir"**. Putaran kaldu yang habis tanpa mentung (deck habis) diikuti putaran kaldu lagi, sampai ada yang mentung. Voting "Akhiri permainan" tetap ada sebagai jalan keluar.

**Sebelum keputusan:** tidak ada pengali pentungan. Batas putaran selalu mengakhiri permainan (`selesaikanPutaran`, `packages/engine/src/mesin.ts`).

**Penerapan (engine, `packages/engine`):**
- Field opsional, hanya ditulis kalau aktif, jadi simpanan lama dan kedua golden tidak berubah (`migrasiState` tidak mengisi bawaan; tidak ada = mati/bukan kaldu/pengali 1): `KonfigurasiPermainan.modeKaldu?` (tidak ada di `KONFIGURASI_BAWAAN`), `GameState.kalduDiminta?`, `StatePutaran.kaldu?`, `HasilPutaran.kaldu?`, `RincianSkor.pengaliPentungan?` (untuk tampilan, hanya di yang mentung/kepentung), dan `kaldu?: true` di peristiwa `mulaiPutaran` dan `mentung`. `alasanSelesai` dapat nilai `'kaldu'`. View membawa `putaran.kaldu` dan `kalduDiminta` (info publik).
- `putaranBerikutKaldu(g)` (`mesin.ts`, bisa dipakai pada `GameState` maupun `ViewPemain`) = `modeKaldu && (kalduDiminta || (batasPutaran !== null && riwayat.length + 1 ≥ batasPutaran))`. Keduanya tidak pernah balik, jadi sekali kaldu, seterusnya kaldu. `mulaiPutaran` memakai ini untuk `StatePutaran.kaldu`; lognya ditambah " Putaran kaldu: pentungan dikali dua."
- Aksi baru `{ jenis: 'putaranTerakhir' }` (tanpa `pemain`, bukan aksi klien; meja yang memanggilnya sesudah voting): hanya di antara putaran (`menungguPutaran`/`putaranSelesai`, selain itu `STATUS_SALAH` "Putaran terakhir cuma bisa diminta di antara putaran."), hanya di meja mode kaldu (`KONFIGURASI_TIDAK_SAH` "Meja ini nggak pakai mode kaldu."), dan ditolak kalau putaran berikutnya sudah kaldu (`STATUS_SALAH` "Putaran berikutnya memang sudah putaran terakhir."). Mengisi `kalduDiminta = true`, log "Sepakat: putaran berikutnya putaran kaldu."
- Skor: `PENGALI_KALDU = 2` (`skor.ts`). `hitungSkorPemain` menerima `pengaliPentungan?`; nilai pentungan yang mentung dan tiap kepentung dikali, kartu jadi, tangan, dan −25 tidak. `HasilPutaran.nilaiPentungan` dan `nilai` di peristiwa `mentung` sudah dikali (contoh dua joker: 500 × 2 = ±1000). `teksPerhitungan` menulis "+ 250 × 2" / "− 150 × 2".
- Akhir putaran (`selesaikanPutaran`): kalau `modeKaldu`, permainan hanya selesai (alasan `'kaldu'`) saat putaran kaldu ditutup mentung. Batas skor diabaikan (#43) dan batas putaran hanya memicu kaldu. Putaran kaldu yang deck-nya habis memberi log "Belum ada yang mentung, kaldu lagi." dan putaran berikutnya kaldu lagi; pengocoknya tetap pemain dengan skor terendah (`kandidatPengocok` tidak berubah). Tanpa batas putaran dan tanpa voting, permainan jalan biasa sampai "Akhiri permainan". Tanpa `modeKaldu`, urutan pengecekan lama tidak berubah.
- Invarian (`invarian.ts`): tidak ada putaran kaldu di meja tanpa mode kaldu; mulai batas putaran semua putaran kaldu; sesudah putaran kaldu, putaran berikutnya kaldu; putaran kaldu yang ditutup mentung selalu yang terakhir dan alasannya `'kaldu'`; mode kaldu tidak pernah selesai karena batas skor/putaran; nilai pentungan = total × pengali dan rincian ±nilai itu.

**Penerapan (meja, `packages/meja`):**
- `PengaturanMeja.modeKaldu?` (tidak ada di `PENGATURAN_BAWAAN`; `validasiPengaturan` hanya menerima boolean), hanya bisa diubah di lobi seperti pengaturan lain. `mulai()` mengirim `modeKaldu: true` hanya kalau aktif, dan batas skor `null` (#43; isiannya tetap tersimpan di pengaturan).
- Pesan baru `{ t: 'putaranTerakhir', setuju }` (divalidasi seperti `akhiri`). `Meja.putaranTerakhir()` meniru `akhiri()`, dengan penjaga yang sama dengan engine sebagai galat. `cekVotingKaldu()` meniru `cekVotingAkhiri()`: kalau semua manusia yang masih terhubung setuju, aksi `putaranTerakhir` diterapkan. `lepasKursi` mencabut suara kursi itu di kedua voting lalu `cekVotingAkhiri() || cekVotingKaldu()` (#36; Akhiri didahulukan). Suara dikosongkan di `mulai`, `putaranBerikut`, dan `mainLagi`. Meja offline dengan satu manusia: langsung berlaku.
- `DataMeja.setujuKaldu?` hanya ditulis kalau ada isinya (isi rusak dari simpanan dibuang). `InfoMeja.setujuKaldu` hanya ada di meja mode kaldu. `RingkasanAkhir.modeKaldu = konfigurasi.modeKaldu === true` dan `alasan` bisa `'kaldu'`; server menyimpannya di kolom `mode_kaldu` dan `alasan` (TEXT) yang sudah ada sejak skema v1. Momen pembaruan PWA (`pembaruan.ts`) tidak berubah: jeda antarputaran online tetap "senyap", karena tidak ada status permainan baru.

**Penerapan (warga kedai):** Jago/Suhu (`Penilai.pengali`, `packages/engine/src/bot/strategi.ts`) membaca `putaran.kaldu` dari view dan menimbang dua kali lipat: kesiapan mentung di `nilai()`, bagian kepentung di `bahaya()` (bagian suap tetap), dan nilai pentungan saat memilih cara mentung di `aksiKuat`. Di luar putaran kaldu hasilnya sama persis dengan sebelumnya. Mudah/Normal tidak diubah (dikunci golden). Diukur 16 Okt 2026 dengan arena mini mode kaldu tanpa worker (`arena.ts` sendiri gagal di worker di container Node 22 tempat pengukuran; opsi `--kaldu` sudah ditambahkan untuk mesin pengembang), 150 seed × rotasi kursi per meja, putaran 3 dan seterusnya kaldu, Jago/Suhu satu kursi melawan Normal. Selisih "dengan pengali" − "tanpa pengali" (view yang sama tanpa tanda kaldu = perilaku sebelum #42), per permainan: 2 pemain Jago +4,2 ± 20,1, Suhu +13,6 ± 53,7; 3 pemain Jago +10,9 ± 12,4, Suhu −11,6 ± 21,5; 4 pemain Jago −5,8 ± 8,0, Suhu −3,8 ± 11,9; 4 pemain 2 deck Jago +1,2 ± 12,7, Suhu +1,5 ± 26,3. Semuanya di dalam selang kepercayaan: **tidak terukur lebih kuat maupun lebih lemah**, jadi penimbangan ini dipertahankan karena sesuai rencana, bukan karena terbukti lebih kuat. Keduanya tetap jauh di atas Normal di mode kaldu (Jago +77 sampai +325, Suhu +142 sampai +422 per permainan), dan p99 lama mikir praktis sama (paling besar 4 pemain 2 deck: Jago 13,8 vs 12,6 ms, Suhu 17,8 vs 21,0 ms). Meja 5 dan 6 pemain belum diukur.

**Test:** `packages/engine/test/kaldu.test.ts` (mati secara bawaan: aturan akhir lama tetap dan aksi baru ditolak; batas putaran 3 → putaran 3 kaldu di state, view, peristiwa, log; putaran kaldu ditutup mentung → selesai `'kaldu'`, Contoh A ±100, As dua kepentung ±300, dua joker ±1000, bagian lain dan −25 tidak dikali; deck habis di putaran kaldu → kaldu lagi dengan pengocok skor terendah, seed 3 pemain dengan putaran 3 dan 4 deck habis lalu putaran 5 ditutup mentung; voting tanpa batas putaran, juga sebelum putaran pertama; aksi ditolak di tengah putaran, di susun akhir, dan kalau sudah kaldu; batas skor diabaikan; Akhiri tetap jalan di kaldu lanjutan; `putaranBerikutKaldu` pada view; "× 2" di `teksPerhitungan`; simpanan lama = mati; rumus skor; invarian), `sim-kaldu.test.ts` (3, 4, dan 6 pemain × 10 seed, semua level, batas putaran 2 dan batas skor ±10 yang harus diabaikan; setiap permainan berakhir `'kaldu'`, semua putaran mulai batas itu kaldu, jalur kaldu lagi teruji di setiap ukuran meja), describe kaldu di `bot-kuat.test.ts` (pengali dari view, hanya bagian mentung/kepentung yang dikali, Mudah/Normal sama persis), `packages/meja/test/kaldu.test.ts` (dua manusia harus setuju, penghitung di `InfoMeja`, putaran berikutnya kaldu, keempat kasus hitung ulang #36 dan Akhiri didahulukan, penolakan, suara dikosongkan di putaran berikutnya dan main lagi, Akhiri tetap jalan, offline satu manusia langsung berlaku, pengaturan hanya di lobi, `mulai` dan batas skor null, `DataMeja` lama dan suara rusak, meja tanpa mode kaldu tanpa `setujuKaldu`, klasemen `'kaldu'` dan `modeKaldu` true, validasi), `apps/server/test/riwayat.test.ts` (`mode_kaldu` = 1 dan alasan `kaldu`), dan `apps/client/test/kontenAturan.test.ts` (contoh angka di Bantuan memakai `PENGALI_KALDU`). Kedua golden lolos tanpa `-u`.

<a id="k43"></a>

## 43. Mode kaldu tanpa batas skor

**Diputuskan pemilik (16 Okt 2026), diterapkan** di engine dan meja (isian di aplikasi menyusul). **Tafsiran atas komentar "Tidak ada batas skor", masih perlu dikonfirmasi pemilik.**

**Keputusan pemilik (16 Okt 2026), ditafsirkan pengembang dari komentar "Tidak ada batas skor":** mode kaldu **tidak memakai batas skor**. Saat kaldu dicentang, isian batas skor (#44) disembunyikan dan engine mengabaikannya. Permainan kaldu berakhir lewat putaran kaldu yang ditutup mentung (#42) atau voting "Akhiri permainan". Kalau pemilik ternyata bermaksud lain, cukup ubah pengecekan di `selesaikanPutaran` dan `mulai()` (bersama test-nya).

**Penerapan:** `mulai()` (`packages/meja/src/meja.ts`) mengirim `batasSkorAtas`/`batasSkorBawah` `null` ke engine kalau mode kaldu aktif; isian di pengaturan meja tetap tersimpan. Engine juga mengabaikannya sendiri saat `modeKaldu` (jaga-jaga untuk simpanan atau pemanggil lain). Batas putaran di mode kaldu hanya memicu putaran kaldu. Menyembunyikan isian batas skor saat kaldu dicentang dikerjakan di tahap client.

**Test:** `kaldu.test.ts` describe "mode kaldu tidak memakai batas skor" (batas skor yang tercapai di putaran biasa tidak mengakhiri permainan; batas putaran tidak mengakhiri permainan), `sim-kaldu.test.ts` (batas skor ±10 tidak pernah mengakhiri permainan), dan `packages/meja/test/kaldu.test.ts` (`mulai` mengirim batas skor null, pengaturan tetap tersimpan). Test isian Atur meja/lobi menyusul di tahap client.

<a id="k44"></a>

## 44. Batas skor kaku ±500

**Keputusan pemilik (16 Okt 2026):** "opsi batas skor juga jangan saklek 500. Buat angka dinamis aja (kelipatan 10)." Batas atas dan batas bawah diisi angka bebas, kelipatan 10.

**Sebelum keputusan:** Atur meja offline hanya punya kotak centang "Batas skor ±500". Lobi online punya pilihan 300/500/1000 (dan negatifnya) atau tanpa batas. Validasi meja menerima bilangan bulat apa saja dengan nilai mutlak ≤ 100000, termasuk 0 dan tanda yang terbalik.

**Default yang tidak dikomentari pemilik (dipakai):** rentang 10–100000 (nilai mutlak, sama dengan batas validasi lama); kosong atau 0 = tanpa batas; angka yang bukan kelipatan 10 dibulatkan ke kelipatan 10 terdekat (255 → 260, 3 → 10); batas bawah diketik positif lalu disimpan negatif, karena keyboard angka iPhone tidak punya tanda minus; pengaturan offline lama ±500 tetap ±500; bawaan tetap tanpa batas skor. Engine tidak berubah: batas dicek di akhir putaran, inklusif (`>=`/`<=`).

**Yang dikerjakan:**
- **Satu sumber aturan isian** di `packages/meja/src/validasi.ts` (diekspor `@remi/meja`): `batasSkorSah(v, arah)` (null, atau kelipatan `KELIPATAN_BATAS_SKOR` bertanda sesuai arah dengan nilai mutlak `BATAS_SKOR_MIN`..`BATAS_SKOR_MAKS`) dan `rapikanBatasSkor(x, arah)` (isian UI atau simpanan → nilai sah atau null).
- **Validasi pesan** (`validasiPengaturan`): `batasSkorAtas` harus null atau kelipatan 10 positif ≤ 100000, `batasSkorBawah` null atau kelipatan 10 negatif ≥ −100000. Pesan yang melanggar ditolak utuh. Nilai dari pilihan lama lobi (300/500/1000 dan negatifnya) tetap sah, jadi client lama tidak terganggu. `batasPutaran` tetap null atau 1..100000.
- **Client**, modul `apps/client/src/ui/batasSkor.ts`:
  - `htmlIsianBatas()` membuat dua `<input type="number" inputmode="numeric" step="10" min="10" max="100000">`, label "Batas skor atas" dan "Batas skor bawah (minus)" dengan tanda − di depan isian, dan petunjuk "Kelipatan 10. Kosongkan kalau tanpa batas." Semuanya dibungkus `.isian-batas-skor` supaya bisa disembunyikan utuh. Yang bukan host melihat teks ("250", "−120", "Tanpa batas").
  - `pasangIsianBatas()` merapikan angka saat isian ditinggalkan (`change`/`blur`/Enter) dan memanggil `saatBerubah` sekali per nilai baru. `lepasIsianBatas()` menandai isian lama sebelum layar digambar ulang, supaya blur dari elemen yang dibuang tidak ikut terkirim.
  - Atur meja (`ui/beranda.ts`): kotak centang `#o-skor` diganti isian `#o-skor-atas`/`#o-skor-bawah`; `bacaPengaturan()` memakai `bacaIsianBatas()`, jadi angka yang belum ditinggalkan pun ikut saat Main ditekan.
  - Lobi (`ui/lobi.ts`): isian `#skor-atas`/`#skor-bawah` hanya untuk host; pesan `pengaturan` dikirim sesudah isian ditinggalkan, bukan di setiap ketikan. Angka yang sedang diketik host dicatat sebelum lobi digambar ulang (ada yang masuk, kursi diatur) lalu dipulihkan bersama fokusnya.
  - Simpanan (`penyimpanan.ts`, `rapikanPengaturanOffline`): angka dirapikan dengan `rapikanBatasSkor` (±500 lama tetap ±500), null tetap null, bentuk lain dibuang sehingga jatuh ke bawaan.
  - `adaIsianAktif()` pindah dari `main.ts` ke `pembaruan.ts` dan diuji: isian angka yang difokus dihitung "sedang mengetik", jadi pembaruan otomatis tetap ditunda.
- **Perbaikan sesudah tinjauan (16 Okt 2026):** "1.000" (cara orang sini menulis seribu) dulu jadi 1 → 10, sehingga permainan tamat di putaran pertama: isian type=number di Chrome menyerahkan "1.000" apa adanya dan `Number("1.000")` = 1. `rapikanBatasSkor` sekarang membaca titik/koma di antara kelompok 3 angka sebagai pemisah ribuan ("1.000", "1,500", "10.000", "−2.000"); pecahan lain ("2.5") tetap dibulatkan seperti biasa. Ini cara membaca isian, bukan aturan baru.

**Test:** `packages/meja/test/batas-skor.test.ts` (termasuk titik/koma ribuan), (diterima/ditolak termasuk 505, 0, −500 untuk batas atas dan 500 untuk batas bawah, pesan dari pilihan lama, perapian isian, dan dua permainan penuh yang selesai karena batas skor pilihan host: 250/−120 dan 600/−400, tanpa ada putaran sebelumnya yang sudah menyentuh batas), `apps/client/test/batasSkor.test.ts` (markup dan atribut isian, pembulatan dan simpanan di Atur meja, "1.000"/"1.500" di Atur meja, Enter, angka yang belum ditinggalkan saat Main, simpanan lama dan rusak, host vs bukan host di lobi, pesan dikirim saat ditinggalkan dan tidak dobel, angka yang sedang diketik selamat saat lobi digambar ulang), `apps/client/test/pembaruan.test.ts` (`adaIsianAktif`).

<a id="k45"></a>

## 45. Leaderboard terasa tidak adil

**Keputusan pemilik (16 Okt 2026):** leaderboard punya banyak pilihan urutan. Bawaannya **rata-rata skor akhir per permainan** (game 1 skor 200 + game 2 skor 100 → 150), bukan per putaran. Meja 1 orang + warga kedai **tidak dihitung**. Yang keluar di tengah permainan dihitung **juru kunci**.

**Default yang tidak dikomentari pemilik (dipakai):** minimal 3 kali main untuk urutan berbasis rata-rata atau persentase; periode bawaan "Sepanjang masa" dengan pilihan "Bulan ini" (WIB); yang keluar diberi skor terendah di meja itu; menutup aplikasi tanpa menekan Keluar tidak dihitung kabur.

**Sebelum keputusan:** `/api/peringkat` mengurutkan jumlah juara lalu total skor, jadi yang paling sering main selalu di atas. Meja 2–6 orang, 1–2 deck, dan main sendirian lawan warga kedai dicampur. Pemain yang keluar di tengah permainan kursinya jadi warga kedai, jadi ia hilang dari statistik (celah kabur). Nama dibedakan huruf besar/kecil ("Budi" dan "budi" dua orang).

**Yang dikerjakan:**
- **Aturan hitung satu sumber** di `packages/meja/src/peringkat.ts` (diekspor `@remi/meja`), dipakai server dan tab Statistik di HP:
  - Urutan (`DAFTAR_URUTAN`): `rata` (bawaan, Σ skor ÷ main), `terbaik` (skor tertinggi satu permainan), `persen` (persentase juara), `juara` (jumlah juara, urutan lama), `main`, `mentung`, `posisi` (poin posisi 0–100: tiap permainan (n − peringkat) ÷ (n − 1) × 100, lalu dirata-rata). Pemutus seri ada di `PEMBANDING`; pembanding memakai nilai yang belum dibulatkan.
  - `MIN_MAIN = 3` untuk `rata`, `persen`, `posisi` (`BUTUH_MIN_MAIN`); yang kurang masuk `belumCukup` (paling sering main dulu).
  - `nilaiEfektif()`: yang keluar mendapat skor min(skornya, skor terendah di meja) dan peringkat n; kursi lain (manusia maupun warga kedai) diurutkan di antara mereka sendiri, 1 + banyaknya kursi lain yang tidak keluar dengan skor lebih tinggi. Skor tertinggi sama = juara semua. Warga kedai tidak masuk daftar, tapi tetap dihitung sebagai lawan.
  - Nama digabung lewat `kunciNama()` (dipindah dari `meja.ts` ke `validasi.ts`, juga dipakai client), ejaan terakhir yang tampil.
  - Saringan `rapikanSaringan()` (jumlah pemain 2–6, deck 1/2, periode `semua`/`bulan`) dan `bulanWib()` (UTC+7 tetap). Data dari URL dirapikan longgar: yang tidak sah jatuh ke bawaan.
- **Meja** (`packages/meja/src/meja.ts`): `Kursi.keluar` diisi `tinggalkan()` hanya saat permainan berjalan (bukan di lobi, bukan sesudah selesai) dan dihapus di `mulai()`/`mainLagi()`. Field ini hanya ada kalau true, jadi simpanan dan golden lama tidak berubah, dan tidak ikut dikirim ke client (`info()` menyalin field satu per satu). `RingkasanAkhir` (`protokol.ts`) ditambah `jumlahDeck` (`aturanPembagian`), `modeKaldu` (false sampai Mode Kaldu ada), dan `pemain[].keluar` (yang keluar ditulis `bot: false, keluar: true`). Klasemen akhir di meja tetap apa adanya; aturan juru kunci hanya berlaku di peringkat.
  - **Perbaikan sesudah tinjauan (16 Okt 2026):** dulu mentung/kepentung kursi yang keluar dihitung dari semua putaran, jadi hasil main warga kedai penerus kursinya ikut tercatat untuk orang yang keluar (bisa menaikkannya di urutan "Paling sering mentung"). Sekarang `tinggalkan()` juga mengisi `Kursi.keluarSesudahPutaran` (jumlah putaran di `riwayat`, ditambah 1 kalau sedang susun akhir karena yang mentung dan kepentung putaran itu sudah ketahuan), dan `buatRingkasanAkhir` menghitung mentung/kepentung kursi itu hanya dari putaran tersebut. Skor dan aturan juru kunci tidak berubah. Ini soal mencatat siapa yang benar-benar main, bukan aturan hitung baru; tetap dikabarkan ke pemilik bersama Rilis A.
- **Server** (`apps/server/src/riwayat.ts`, `server.ts`):
  - Skema diberi versi `PRAGMA user_version`; `MIGRASI` hanya boleh ditambah di belakang. v1 menambah `permainan.jumlah_pemain`, `jumlah_deck` (NULL untuk meja 4 orang lama), `jumlah_manusia`, `mode_kaldu`, `klasemen.keluar`, `klasemen.kunci_nama`, dan dua indeks. `lengkapiBaris()` mengisi baris lama setiap database dibuka (idempoten; `kunci_nama` dihitung di JS karena `lower()` SQLite hanya ASCII).
  - `papan()` menghitung leaderboard dengan saringan dan syarat minimal 2 orang (`jumlah_manusia >= 2`, yang keluar dihitung manusia), hasil agregat di-cache per saringan (paling banyak 50) dan dikosongkan setiap `simpan()`.
  - `GET /api/peringkat` tanpa `v=2` tetap array bentuk lama (HP dengan aplikasi lama memanggil `.map()` langsung), dihitung dengan aturan yang sama dan urutan `juara`. `?v=2&urut=&pemain=&deck=&periode=` mengembalikan objek. `GET /api/riwayat` membawa `jumlahPemain`, `jumlahDeck`, `dihitung`, dan `klasemen[].keluar`.
- **Client** (`apps/client/src/ui/riwayat.ts`, teks di `konten/peringkat.ts`, gaya di `gaya/layar.css`):
  - Tab Peringkat: pilihan "Urutkan dari", Pemain, Deck, Periode (dibuat sekali; hanya `#hasil-peringkat` yang diganti, jadi fokus tidak hilang). Ganti urutan mengurutkan ulang data yang sudah ada; ganti saringan mengambil ulang (jawaban yang telat diabaikan). Angka besar di kanan = metrik terpilih. Ada penjelasan singkat per urutan, ringkasan `role="status"`, daftar "Belum cukup main", lipatan "Cara hitungnya", dan catatan deck untuk meja 4 orang lama. Server lama (jawaban array): tampil cara lama, pilihan dimatikan, ada catatan.
  - Tab Permainan: lencana "keluar" dan "nggak masuk peringkat".
  - Tab Statistik (HP ini): `hitungPeringkat` pada `remi.riwayat`, tanpa syarat minimal 2 orang dan tanpa urutan mentung (tidak tersimpan di HP), tabel Nama · Main · Juara (x%) · Rata-rata · Terbaik · Posisi dengan `aria-sort`.
  - Konfirmasi keluar (`opsiKonfirmasiKeluar()`, `ui/lobi.ts`): di tengah permainan online yang punya ≥ 2 kursi manusia (`mejaMasukPeringkat()`) ditambah "Di peringkat online kamu dihitung juru kunci." Bantuan ikut diperbarui.

**Test:** `packages/meja/test/peringkat.test.ts` (nilai efektif termasuk yang keluar dengan skor tertinggi, warga kedai di atas manusia, seri; semua urutan dan pemutus serinya; belum cukup main; perapian; batas bulan WIB), `packages/meja/test/meja.test.ts` ("tanda keluar untuk peringkat", termasuk `keluarSesudahPutaran` di tengah putaran, sesudah putaran, dan di susun akhir, serta mentung/kepentung warga kedai penerus yang tidak ikut tercatat), `apps/server/test/riwayat.test.ts` (migrasi dari database v0 buatan tangan termasuk main sendirian dan "budi"/"Budi", buka ulang idempoten, baris dari server lama, kolom baru di `simpan`, saringan/keluar/nama/batas WIB/cache/belum cukup, endpoint lama tetap array vs `v=2` objek, parameter salah, 405), `apps/client/test/riwayat.test.ts` (permintaan bawaan, ganti saringan mengambil ulang vs ganti urutan tidak, jawaban telat, server lama, galat, lencana, tanpa kata "bot"), `apps/client/test/kontrolMeja.test.ts` (teks konfirmasi keluar), `antislop.test.ts` (teks `konten/peringkat.ts`). Golden meja: hanya teks `ringkasanAkhir` yang bertambah `jumlahDeck`/`modeKaldu`, hash tetap ([baseline-gameplay.md](baseline-gameplay.md)).

<a id="k46"></a>

## 46. Tombol pasang aplikasi

**Keputusan pemilik (16 Okt 2026):** tombol pasang aplikasi (PWA) yang mengambang, karena banyak teman yang tidak tahu game ini bisa dipasang. Tombolnya **hanya di beranda**, hanya selama belum terpasang. **"Nanti saja" menyembunyikannya 3 hari.** Tidak pernah muncul di lobi, meja, atau selama permainan.

**Sebelum keputusan:** ubin "Pasang ke layar utama" hanya muncul di menu beranda kalau browser mengirim `beforeinstallprompt` (Chrome/Edge di Android dan desktop). Safari iPhone/iPad dan browser bawaan aplikasi (Instagram, WhatsApp, dll.) tidak pernah mendapat tawaran atau petunjuk apa pun.

**Default yang tidak dikomentari pemilik (dipakai):** "Nanti saja" hanya menyembunyikan tombol melayang, ubin menu tetap ada sebagai jalan yang tidak mengganggu. Prompt browser yang ditolak dihitung sama dengan "Nanti saja" (3 hari). Tunda yang lebih jauh dari 3 hari ke depan (jam HP pernah dimundurkan) dianggap sudah lewat. "Sudah kupasang" menutup tawaran (tombol dan ubin), kecuali browser menawarkan prompt lagi. Desktop tanpa prompt (Firefox, Safari Mac) tidak ditawari.

**Yang dikerjakan:**
- **Deteksi** di `apps/client/src/pasangAplikasi.ts` (fungsi murni, diuji di Node):
  - `caraPasang()` → `prompt` (ada `beforeinstallprompt`), `inapp` (penanda Facebook/Messenger, Instagram, Threads (`Barcelona`), WhatsApp, Line, TikTok, Twitter, Snapchat, Pinterest, LinkedIn, aplikasi Google (`GSA/`), WebView Android `; wv)`, atau iPhone/iPad tanpa `Safari/`), `ios` (iPhone/iPad, termasuk iPadOS yang mengaku Mac dengan layar sentuh, dan Chrome iOS), `android`, atau null (bukan HTTPS, sudah terpasang, desktop tanpa prompt).
  - `sedangTerpasang()`: `display-mode` standalone/minimal-ui, fullscreen, atau `navigator.standalone`, lewat fungsi murni `nilaiTerpasang()`. Manifest memakai `display: fullscreen`, jadi aplikasi terpasang di Android cocok dengan `display-mode: fullscreen`, sama seperti layar penuh dari menu ☰ meja (`requestFullscreen` di `kontrolMeja.ts`) dan F11 di desktop. Karena itu `main.ts` membaca nilai terpasang sekali saat aplikasi mulai; selama `document.fullscreenElement` terisi dipakai nilai terakhir sebelum layar penuh, dan browser yang masih menawarkan prompt dianggap belum terpasang. *(Perbaikan sesudah tinjauan, 16 Okt 2026: dulu aplikasi terpasang yang memakai "Layar penuh" dari menu meja dianggap belum terpasang, jadi tombol "Pasang aplikasi" bisa muncul di dalam aplikasinya sendiri.)*
  - `perangkatApel()` dipakai bersama `efek/mesinAudio.ts`.
  - `keadaanPasang(cara, simpanan, sekarang)` → null atau `{ cara, melayang }`; `tundaPasang()`, `tandaiSudahPasang()`, `lupakanSudahPasang()`; `TUNDA_PASANG_MS` = 3 hari.
- **Simpanan** `remi.tawaranPasang` di `apps/client/src/penyimpanan.ts` (`simpan.tawaranPasang()`/`setTawaranPasang()`), bentuk `{ tundaSampai?, sudahPasang? }` (ms). Hanya angka terhingga positif yang dipakai; bentuk lain jatuh ke `{}` dan kuncinya dihapus. Objek kosong menghapus kunci.
- **Rangkaian** di `apps/client/src/main.ts`: `beforeinstallprompt` (tetap `preventDefault`) menyimpan event dan menghapus `sudahPasang`; `appinstalled` mengisi `sudahPasang`; perubahan `display-mode` menilai ulang. Semua penilaian ulang lewat `segarkanPasang()`, yang hanya bekerja di beranda. `tawaranPasang()` memberi beranda `{ melayang, pasang(), nanti() }` atau null. `jalankanPasang(cara)`: dengan prompt, `prompt()` lalu `userChoice` lewat `sesudahPrompt()` (`dismissed` = tunda 3 hari, `accepted` = sudah pasang, event sekali pakai dibuang); tanpa prompt, dialog petunjuk.
- **Beranda** (`apps/client/src/ui/beranda.ts`): `aturPasang(tawaran)` mengatur ubin dan tombol melayang tanpa menggambar ulang (isian dan lipatan yang terbuka aman). Tombol melayang `<aside class="pasang-melayang">` (tombol "Nanti saja" dan "Pasang aplikasi") selalu anak terakhir `.layar.beranda`, sesudah `.beranda-kaki` dan di luar area grid, jadi ikut `inert` saat ada jendela dan ikut hilang saat `#ui` diganti layar lain. `.ada-pasang` menambah ruang bawah supaya isi bisa digulir melewatinya. Sesudah "Nanti saja" fokus pindah ke ubin menu, ditambah toast "Oke, tombolnya disimpan dulu 3 hari. …". Di kunjungan pertama (kartu "Warga baru, ya?" tampil), tombol melayang tidak dipasang selama beranda itu (ubin menu tetap ada), supaya layar pertama tidak memuat dua "Nanti saja" dan tombol Main tidak tertutup; tombolnya muncul di beranda berikutnya. *(Perbaikan sesudah tinjauan, 16 Okt 2026; perilaku tampilan, bukan aturan.)*
- **Dialog** `apps/client/src/ui/pasang.ts` lewat `bukaDialog` (teks di `apps/client/src/konten/pasang.ts`, ikut test antislop). Setiap varian dibuka dengan satu baris manfaat. iPhone/iPad: Bagikan (ikon SVG kecil) di bilah browser (Chrome iOS: di bilah alamat; Chrome/Firefox iOS juga dikenali `ios`) → Tambah ke Layar Utama → Tambah, catatan "buka di Safari dulu", tombol Nanti saja / Sudah kupasang. Android: menu ⋮ Chrome atau ≡ Samsung Internet → Instal aplikasi, tombol yang sama. In-app: "Buka di browser dulu", langkah Buka di browser/Chrome/Safari, kotak link readonly dengan **Salin link** (`navigator.clipboard.writeText`, cadangan `select()` + `execCommand('copy')`), tombol Nanti saja / Tutup.
- **Gaya** (`gaya/layar.css`, `gaya/gerak.css`): pil gelap `rgba(22, 17, 11, .95)` bergaris `--emas`, `position: fixed` kanan bawah dengan `--aman-*`, `z-index` 2 di dalam `#ui` (di bawah modal, dialog, dan toast), muncul ±1,2 detik sesudah beranda tampil (gerak dikurangi: pudar saja). Puncaknya ±70 px dari bawah, di bawah tumpukan toast, selama tombolnya satu baris: di layar < 360 px bantalan tombol dirapatkan (320 px dengan teks besar dulu terlipat dua baris, setinggi 102 px, lalu menabrak toast).
- `apps/client/index.html`: `<meta name="apple-mobile-web-app-title" content="Remi Madya">`. Deskripsi manifest tidak berubah.

**Test:** `apps/client/test/pasangAplikasi.test.ts` (user agent asli: Safari iPhone, iPadOS desktop dengan sentuh 5 vs 0, Chrome iOS, Instagram/Threads/Facebook iOS dan Android, WhatsApp, WebView polos, Chrome/Samsung/Firefox Android dengan dan tanpa prompt, desktop; terpasang/bukan HTTPS; batas 3 hari ±1 ms, jam dimundurkan, sudah pasang vs prompt), `apps/client/test/penyimpanan.test.ts` (perapian `remi.tawaranPasang`), `apps/client/test/beranda.test.ts` (ubin + tombol saat melayang, ubin saja saat ditunda, tidak ada apa-apa saat null, tidak dobel, isian dan lipatan selamat, Nanti saja dan fokus, anak terakhir sesudah kaki, `inert` saat dialog, lobi tanpa tombol), `apps/client/test/kedai.test.ts` (tombol di luar kartu kedai, tanpa teks kedai), `apps/client/test/dialogPasang.test.ts` (tiga varian, tombol, clipboard dan cadangannya, tidak menimpa modal utama), `antislop.test.ts` (`konten/pasang.ts`). `apps/client/test/terpasang.test.ts` (happy-dom: terpasang → layar penuh dari menu meja → beranda tetap terpasang; tab biasa tetap belum; F11 dengan prompt; standalone/minimal-ui/iOS), `pasangAplikasi.test.ts` juga menguji `nilaiTerpasang` dan `sesudahPrompt`, `beranda.test.ts` kunjungan pertama. E2E `apps/client/e2e/smoke.mjs` alur `pasang` (Chrome Android 360×780 dan 780×360, 320×640 teks besar satu baris, kunjungan pertama tanpa tombol melayang).

<a id="k47"></a>

## 47. Gaya main warga kedai per persona

**Diputuskan, diterapkan di rilis berikutnya.** Strategi bot belum berubah.

**Keputusan pemilik (16 Okt 2026):** warga kedai gampang dibaca, bahkan level Suhu (Londo dan As selalu dibuang di awal). Setiap persona (nama warga kedai) mendapat **gaya main** sendiri, terpisah dari level. Gaya **tidak ditampilkan** ke pemain: tidak ada di UI, Bantuan, protokol, maupun CHANGELOG bagian pemain (cukup ditulis umum, tanpa nama). Pemetaan nama ke gaya di bawah disetujui, ditambah **satu kelompok yang gayanya berubah-ubah** tiap putaran. "Ngurutin" = membuang kartu yang menyambung buangan pemain sebelumnya.

**Pemetaan yang disetujui** (nanti di `packages/meja/src/gayaWarga.ts`; jangan ditampilkan ke pemain):

| Gaya | Inti perilaku (hanya dari info yang terlihat di view) | Persona |
|---|---|---|
| Kilat | Mulung lebih agresif, menurunkan kartu jadi lebih cepat, nutup secepatnya | Kipas Dua, Dik Toska, Bu Sendok |
| Sabar Londo | Tidak membuang Londo sebelum ada pemain lain yang membuang Londo di putaran itu; dilonggarkan menjelang deck habis | Cak Kopag, Ning Sore, Koki-Kun, Pak Tani |
| Ngurutin | Kalau merasa tidak bakal menang, membuang kartu yang menyambung buangan teratas pemain sebelumnya (meja ≥ 3 orang) | Mas Sampul, Si Rak, Ning Kukis |
| Pemburu pentungan | Menyimpan satu calon pentungan besar (As > Londo), bobot mentung dan korban lebih tinggi | Pak Seng, Om Garpu, Penampil, Juragan |
| Penahan | Menahan kartu yang kemungkinan dibutuhkan pemain berikutnya (dilihat dari kartu yang dipungutnya) | Mbak Teras, Cak Owner, Bang IT, Mbak Mata |
| Berubah-ubah | Tiap putaran memakai salah satu dari lima gaya di atas, dipilih dari info publik putaran itu (tetap fungsi murni, tidak bisa ditebak dari putaran sebelumnya) | Jurik, Bos Bocil, Om Napi, Bajigur |

**Perlu konfirmasi pemilik:** cara kerja kelompok "berubah-ubah" (berganti tiap putaran di antara lima gaya) adalah tafsiran pengembang.

**Rencana penerapan:** `GayaBot` dan `DEFINISI_GAYA` di `packages/engine/src/bot/gaya.ts` (gaya `standar` = perilaku sekarang, tanpa rng); `pilihAksiBot(view, level, rng, gaya = 'standar')`; "mood" per putaran dan pilihan acak di antara nilai yang hampir seri supaya satu persona pun tidak terbaca; Mudah mengabaikan gaya (latihan tidak berubah), susun akhir tanpa gaya. Di meja, `gayaKursi(k)`: persona memakai gayanya, nama lain ("Warga N"), kursi yang ditinggal manusia (`Kursi.keluar`), dan giliran manusia yang diambil alih memakai `standar`. Diukur di arena (`packages/engine/scripts/arena.ts`) dengan syarat: Suhu bergaya apa pun tetap signifikan di atas Normal, tiap gaya terukur beda di metrik khasnya, peluang Londo/As dibuang di awal turun ≥ 30 %, dan p99 lama mikir ≤ 1,15× level yang sama.

**Test yang direncanakan:** setiap nama di `NAMA_LAWAN_BAWAAN` wajib punya gaya; golden engine lolos tanpa `-u`; golden meja bergeser hanya karena gaya (dibuktikan dengan `gayaKursi` dipaksa `standar`), lalu ditinjau dan dicatat; simulasi ikut memutar gaya tanpa aksi yang ditolak.

---

## Catatan lain (belum masuk tabel)

Temuan audit yang lebih kecil, dicatat supaya tidak hilang:

- **Pemenang dan seri belum didefinisikan di README.** Engine tidak punya konsep pemenang. Klasemen dibuat `buatRingkasanAkhir()` (`packages/meja/src/meja.ts:886`, per 16 Okt 2026): urut skor tertinggi, skor sama berbagi peringkat. UI mengikuti ini ("X juara (bareng)").
- **Prioritas batas skor vs batas putaran:** kalau keduanya tercapai di putaran yang sama, alasan selesai = batas skor (urutan `if` di `selesaikanPutaran`, `packages/engine/src/mesin.ts`; di mode kaldu keduanya tidak dipakai, #42/#43). Batasnya inklusif (`>=`/`<=`). Belum tertulis di README.
- **Urutan bagi kartu:** animasi bagi sudah disamakan dengan engine (mulai dari pengocok, nomor kursi naik, tanpa melihat arah; `apps/client/src/game/MejaScene.ts`, `bagiKartu`). Kalau di Kedai Madya urutannya lain, itu keputusan pemilik dan harus diubah di engine dulu.
- **Simpanan offline berisi state lengkap** (deck, tangan bot) di `localStorage` (`remi.mejaOffline`). Hanya mode lawan bot, tapi bisa diintip lewat devtools.

**Ditanggapi pemilik (16 Okt 2026).** Dua hal dari 14 Okt 2026 yang dulu dikerjakan sesuai saran pengembang sekarang sudah disetujui. Jangan diubah tanpa izin pemilik:
- **Bunyi dramatis dan bunyi khusus pentung joker: sudah oke** ("kayaknya sudah oke"). Pentungan joker (250) memutar bunyi `mentungJoker` yang lebih besar, baru sesudah kartunya terbuka di meja. Bunyi `tegang` sebelum dibuka sama untuk pentungan apa pun, jadi tidak membocorkan isinya (dijaga `apps/client/test/suaraDramatis.test.ts`), dan judul panel PENTUNG JOKER! sudah begitu sejak 0.2.0. Tempatnya: `apps/client/src/efek/pemutar.ts` (peristiwa `mentung`).
- **Gaya warga kedai Jago dan Suhu yang menahan kartu jadi di tangan: disetujui, tetap.** Sah menurut aturan, karena semua pemain boleh menurunkan kartu jadi di susun akhir (#19, #24), dan di arena jauh lebih kuat daripada langsung menurunkan (selalu menurunkan rugi sekitar 17–67 poin per putaran). Parameternya di `packages/engine/src/bot/strategi.ts`. Gaya main per persona (#47) nanti ditambahkan di atas gaya ini.
- **Aturan Terbuka #20–#23 (susun akhir): disetujui sesuai bawaan yang sudah berjalan** ("sesuaikan aja"): semua pemain ikut susun akhir termasuk yang mengambil kartu terakhir (#20), boleh menurunkan sampai tangan habis tanpa dihitung mentung (#21), serentak (#22), batas waktu sama dengan batas giliran lalu warga kedai menurunkan yang bisa dijadikan dan selesai (#23). Tidak ada kode yang berubah.

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
