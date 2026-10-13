# Riset desain: dari temuan ke implementasi

Dokumen ini merangkum empat riset untuk mengubah MVP Remi Kampung Madya jadi game kartu digital kelas produksi: **kartu fisik & game feel**, **aksesibilitas**, **benchmark UX game kartu**, dan **teknik implementasi** (Phaser 4.2.1, Web Audio, haptics, PWA). Setiap temuan dipetakan ke:

**Temuan riset → Prinsip desain → Usulan → Implementasi teknis → Cara validasi**

Semua usulan di sini murni presentasi di client (tampilan, gerak, suara, getar, kenyamanan). **Tidak ada yang mengubah aturan main.** Kalau ada usulan yang ternyata menyentuh perilaku meja atau aturan, usulan itu ditandai **perlu keputusan pemilik** dan wajib dicatat di tabel Aturan Terbuka README sebelum dikerjakan.

> Sumber kebenaran aturan tetap [README](../README.md) (Ringkasan aturan dan tabel Aturan Terbuka) dan pemilik proyek. Perilaku aktual mesin aturan direkam di [baseline-gameplay.md](baseline-gameplay.md) dan dijaga golden test.
>
> Status tiap rekomendasi pada rilis 0.2.0 ada di bagian [Status implementasi](#status-implementasi-rilis-020).

## Pagar info rahasia (berlaku untuk semua usulan)

Keputusan pemilik soal "mode ingatan" mengalahkan pedoman mana pun di bawah, termasuk pedoman aksesibilitas yang biasanya menyarankan info lewat banyak kanal dan riwayat yang bisa dibaca ulang.

1. **Angka joker hanya diumumkan sekali** lewat popup di awal putaran. Tidak boleh muncul di meja, bar atas, log, sorakan, label aksesibel, maupun pengumuman screen reader.
2. **Joker di tangan tidak diberi penanda apa pun**: tidak ada warna, kilau, bayangan, bunyi, getar, urutan fokus, atau label yang berbeda untuk joker. Efek yang berlaku untuk kartu (flip, kilau, bayangan) harus identik untuk semua kartu.
3. **Tidak ada peringatan "kartu berbahaya"** atau saran kartu yang aman dibuang. Lencana validasi pilihan (BM6) hanya menilai kombinasi yang dipilih pemain sendiri.
4. **Log dan pengumuman tidak menyebut kartu yang dibuang.** Tidak ada riwayat buang yang bisa diputar ulang (jangan pakai `role="log"` yang menumpuk).
5. **Buangan yang ditampilkan atau dibacakan maksimal (jumlah pemain − 1) kartu teratas**, sama dengan `viewUntuk()`.
6. **Jangan membaca `putaran.rankJoker` atau `kartuDibuka`** untuk tampilan apa pun selain popup joker. Semua efek dipicu dari peristiwa publik saja.
7. Fitur yang ingin melewati pagar ini (misalnya "ulangi pengumuman joker") wajib ditanyakan ke pemilik dan dicatat di tabel Aturan Terbuka.

Kode di setiap usulan ditandai **[Pagar]** kalau pagar di atas relevan.

## Ringkasan prinsip desain

| # | Prinsip | Diturunkan dari |
|---|---|---|
| P1 | Respons sentuh terasa langsung (< 100 ms), aksi baru diputuskan saat jari dilepas | GF1, BM1, TK5 |
| P2 | Gerak punya bobot: durasi sesuai jarak, easing konsisten, pegas untuk mendarat, lintasan busur | GF2–GF5 |
| P3 | Efek sebanding dengan pentingnya kejadian (anggaran juice) | GF9, BM2 |
| P4 | Momen besar punya tiga fase: persiapan, puncak, sesudahnya; tapi pemain bisa mempercepat | GF10, GF11 |
| P5 | Gerak bisa dikurangi atau dimatikan, mengikuti setelan sistem | AK5, TK8 |
| P6 | Informasi penting tidak pernah hanya lewat satu kanal (warna, suara, atau getar saja) | AK3, AK11, AK13 |
| P7 | Target sentuh dan teks cukup besar untuk HP kecil dan pemain tua di kedai | AK1, AK2, AK4 |
| P8 | Audio bersih: bus terpisah, limiter, variasi kecil supaya tidak membosankan | GF13, TK9, TK10 |
| P9 | Bingkai "meja warung Kedai Madya", bukan kasino | BM10 |
| P10 | Mode ingatan dijaga di semua kanal, termasuk aksesibilitas | Pagar info rahasia, AK9, AK10 |

## Fondasi yang sudah ada

- `apps/client/src/preferensi.ts`: preferensi pemain per HP (suara, volume efek, musik, volume musik, getar, gerak, kecepatan, efek lengkap/hemat, warna kartu dua/empat, ukuran teks, tutorial). Sudah menormalkan data rusak dan membaca simpanan lama `remi.efek`. Ini menjawab TK13.
- `apps/client/src/gerak.ts`: `DURASI`, `EASE`, `durasi(ms)`, `kurangiGerak()`, `efekHemat()`, `easePegas()`. Ini fondasi untuk GF2–GF4 dan AK5.
- `apps/client/src/versi.ts`: versi SemVer, commit, dan waktu build.
- Golden test engine dan meja: perubahan presentasi murni tidak boleh menggeser hash apa pun.

## Status implementasi (rilis 0.2.0)

Tabel ini mencatat sejauh mana tiap rekomendasi di bawah sudah masuk kode pada rilis 0.2.0. Teks rekomendasi di bagian A–D tetap seperti hasil riset (ditulis sebelum client dirombak), jadi beberapa detail implementasinya berbeda dari kode sekarang. Peta kode terbaru ada di [arsitektur-client.md](arsitektur-client.md).

Arti status:
- **Selesai & terverifikasi**: ada di kode dan sudah dicek lewat unit test, uji Playwright di Chrome sungguhan, atau pengukuran (misalnya level audio). Validasi dengan pemain atau HP fisik yang diusulkan riset mungkin belum, dan itu ditulis di kolom catatan.
- **Diimplementasikan, belum diverifikasi**: ada di kode, tapi belum dicek dengan cara yang dibutuhkan (HP fisik, iOS, pembaca layar, atau siklus deploy).
- **Direkomendasikan**: belum dikerjakan (atau baru sebagian kecil; lihat catatan).
- **Butuh persetujuan**: menyentuh perilaku meja atau kebiasaan main, jadi menunggu pemilik.

Satu baris bisa punya dua status kalau rekomendasinya terdiri dari beberapa bagian. Rujukan file relatif terhadap `apps/client/src/`, kecuali disebut lain.

| Kode | Rekomendasi | Status | Bukti di kode | Catatan |
|---|---|---|---|---|
| GF1 | Kartu bereaksi saat disentuh | Selesai & terverifikasi | `game/MejaScene.ts` `pasangInput()` (efek tekan di pointerdown, aksi di pointerup) | Latensi < 100 ms belum diukur dengan rekaman 240 fps |
| GF2 | Durasi mengikuti jarak | Direkomendasikan | `efek/pemutar.ts` (durasi terbang dasar tetap 420 ms) | Baru diskalakan preferensi kecepatan lewat `durasi()`, belum menurut jarak |
| GF3 | Satu kosakata easing | Selesai & terverifikasi | `gerak.ts` `EASE`; `gaya/token.css` `--ease-*` | Namanya `keluar`/`halus`/`pegas`/`jatuh`, bukan `MENDARAT`/`PERGI` |
| GF4 | Pegas untuk mendarat dan kembali ke slot | Selesai & terverifikasi | `gerak.ts` `easePegas()` (lewat ±6%); `game/MejaScene.ts` `gambar()`, `mendarat()`, `balik()` | Memakai rekonsiliasi per kunci, bukan container `lapisan`; `test/gerak.test.ts` |
| GF5 | Lintasan busur, ancang-ancang | Busur: Selesai & terverifikasi. Ancang-ancang: Direkomendasikan | `game/MejaScene.ts` `luncur()` (kurva kuadrat, kemiringan deterministik per id) | Lurus tanpa putaran saat gerak dikurangi |
| GF6 | Bayangan dan kesan diangkat | Selesai & terverifikasi | `game/kartuGrafis.ts` `KUNCI_BAYANGAN`; `game/MejaScene.ts` `sinkron()` | Tekstur prerender (bukan filter Shadow), identik untuk semua kartu; profil CPU 4× belum |
| GF7 | Flip kartu dengan kedalaman | Selesai & terverifikasi | `game/MejaScene.ts` `balik()` (menipis, gelap, ganti muka, pegas) | Belum dicek di Safari iOS |
| GF8 | Drag yang punya bobot | Selesai & terverifikasi. Flick: Butuh persetujuan | `game/MejaScene.ts` `mulaiSeret()`/`perbaruiSeret()`/`akhiriSeret()` | Skala 1,06, miring ±8°, buangan menyala, kembali ber-pegas, terbang dari titik lepas; flick tidak dibuat |
| GF9 | Anggaran juice per kelas peristiwa | Direkomendasikan | `gerak.ts` `efekHemat()` memotong partikel dan denyut | Tabel anggaran per jenis peristiwa belum ada |
| GF10 | Shake model trauma | Direkomendasikan | `efek/pemutar.ts` (kelas `goyang` di body 500 ms saat mentung) | Goyang CSS sederhana, sudah mati saat gerak dikurangi |
| GF11 | Hit-stop, tiga fase, antrian bisa dipercepat | Hit-stop: Selesai & terverifikasi. Percepat dengan ketuk: Direkomendasikan | `game/MejaScene.ts` `pentung()` (jeda 70 ms); `kontrolMeja.ts` (mode `cepat` saat antrian > 2) | |
| GF12 | Kocok dan bagi sebagai koreografi | Selesai & terverifikasi | `game/MejaScene.ts` `kocok()`/`bagiKartu()`; `efek/pemutar.ts` `mulaiPutaran`; `kontrolMeja.ts` `peristiwaAwalPerluDiputar()` | Dari peristiwa `mulaiPutaran` yang sudah ada (tanpa peristiwa baru), urutan bagi sama dengan engine. Total ±2,4 dtk (target riset 1,6 dtk) dan belum bisa dilewati dengan ketuk |
| GF13 | Audio kartu bervariasi dan berposisi | Variasi: Selesai & terverifikasi. Stereo per kursi: Direkomendasikan | `efek/suara.ts` (variasi, batas per jenis, `urutan` naik semitone); `efek/sintesis.ts` | Level diukur offline; belum ada `StereoPannerNode` |
| GF14 | Staging aksi lawan | Direkomendasikan | `game/MejaScene.ts` `gambarDinamis()` (cahaya keliling panel yang jalan), `game/tataMeja.ts` ("lagi mikir…") | Ancang-ancang sebelum kartu lawan terbang belum |
| AK1 | Kontras teks dan kontrol | Selesai & terverifikasi (HTML) | `gaya/token.css` (rasio dicatat di komentar), `game/warnaMeja.ts` (palet kanvas dari token) | Label kanvas belum diukur alat; mode kontras tinggi belum |
| AK2 | Ukuran teks dan teks besar | Selesai & terverifikasi | `preferensi.ts` `ukuranTeks` → `data-teks`; `game/MejaScene.ts` `skalaTeks()` (×1,15) | Label kanvas dasar masih 10–11 px CSS sebelum skala |
| AK3 | Kartu empat warna | Selesai & terverifikasi | `game/kartuGrafisGambar.ts` `PALET`; `gaya/token.css` `--tinta-*` (disamakan); kelas `bunga-*` di HTML | Belum diuji dengan pemain buta warna |
| AK4 | Target sentuh dan state tanpa warna | Direkomendasikan (sebagian) | Tombol bar dan ikon 44 px (`gaya/`); `game/tataMeja.ts` (`langkahMin = cw × 0,5`) | Lebar strip kartu minimum 36–44 px dan tanda centang belum |
| AK5 | Kurangi gerak | Selesai & terverifikasi | `preferensi.ts` `gerakDikurangi()`; `gerak.ts`; `gaya/gerak.css`; scene tanpa busur/goyang/partikel | Dicek dengan emulasi `prefers-reduced-motion`; setelan HP sungguhan belum |
| AK6 | Kedip dan denyut berhenti sendiri | Direkomendasikan (sebagian) | `game/MejaScene.ts` `gambarDinamis()` (statis saat efek hemat/gerak dikurangi) | Denyut "KARTUMU DI ATAS!" dan cincin "bisa" belum berhenti setelah 5 dtk |
| AK7 | Kecepatan animasi | Selesai & terverifikasi | `preferensi.ts` `skalaWaktu()`; `gerak.ts` `durasi()` | Sorakan dan panel belum ikut diskalakan; `test/gerak.test.ts` |
| AK8 | Batas waktu giliran yang manusiawi | Direkomendasikan (sebagian). Perpanjangan waktu: Butuh persetujuan | `kontrolMeja.ts` `perbaruiWaktu()` (bar, kelas `mendesak` < 10 dtk, pengumuman pembaca layar) | Bar tampil sejak awal giliran; koreksi selisih jam server belum |
| AK9 | Main dengan keyboard | Selesai & terverifikasi. Daftar pintasan: Butuh persetujuan | `kontrolMeja.ts` (`PINTASAN_HURUF`, `DAFTAR_PINTASAN`, `geserFokus`); `game/kartuGrafis.ts` `KUNCI_FOKUS` | Satu putaran penuh dimainkan dengan keyboard di Chrome; pintasan sudah jadi bawaan |
| AK10 | Pengumuman pembaca layar | Diimplementasikan, belum diverifikasi | `ui/dom.ts` `umumkan()`; `kontrolMeja.ts`; `efek/sorak.ts` (`aria-hidden`) | Isi live region dicek di Playwright; TalkBack/VoiceOver belum. Modul `teksAksesibel.ts` tidak dibuat |
| AK11 | Isyarat penting punya pasangan visual | Diimplementasikan, belum diverifikasi | Detak + label KARTUMU DI ATAS!; kepentung + panel mentung; giliran + sorot area tangan | Konstanta `PASANGAN_ISYARAT` dan test cakupannya belum |
| AK12 | Volume terpisah, bunyi tidak menyiksa | Selesai & terverifikasi | `ui/pengaturan.ts` (slider efek/musik); `efek/mesinAudio.ts` (bus, limiter) | Puncak < 0,4 di volume 100% (diukur offline). Detak belum berhenti sendiri; uji dengar di kedai belum |
| AK13 | Getar yang bisa diatur | Diimplementasikan, belum diverifikasi | `efek/suara.ts` `POLA_GETAR`, `getarDidukung()`, batas 80 ms | Diuji dengan `navigator.vibrate` palsu; Android/iPhone belum |
| AK14 | Pengaturan kenyamanan sejak awal | Selesai & terverifikasi | `ui/pengaturan.ts` (dari beranda dan menu ☰); `preferensi.ts` `pasangPreferensi()` | Kartu "Atur tampilan dulu?" dan `prefers-contrast` belum |
| BM1 | Kartu tangan "hidup" | Selesai & terverifikasi | `game/MejaScene.ts` (efek tekan, hover mouse, angkat ber-pegas saat dipilih) | Rekaman 60 fps belum |
| BM2 | Intensitas sebanding | Direkomendasikan | Sama dengan GF9 | |
| BM3 | Skor dibangun berurutan | Direkomendasikan (sebagian) | `game/MejaScene.ts` `skorMelayang()`; `kontrolMeja.ts` (baris muncul bertahap, angka dihitung naik) | Pembangunan per komponen (jadi, tangan, pentungan) belum |
| BM4 | Seret ke buangan, intip tanpa memungut | Seret: Selesai & terverifikasi. Intip tahan-tekan: Direkomendasikan | `game/tataMeja.ts` `area.lepasBuangan`; `game/MejaScene.ts` (buangan menyala) | |
| BM5 | Latihan pertama yang terarah | Diimplementasikan, belum diverifikasi | `main.ts` (latihan 3 pemain, bot mudah, 1 putaran); `ui/tutorial.ts`; `konten/tutorial.ts` | Permainan acak, bukan skenario ber-seed. Uji langsung baru sampai langkah turunkan; sisanya unit test. Think-aloud belum |
| BM6 | Lencana validasi pilihan sendiri | Direkomendasikan | `kontrolMeja.ts` (alasan dari validator engine di petunjuk dan tombol) | Lencana "Seri ✓" yang selalu tampil belum |
| BM7 | Urutkan kartu dengan transisi | Selesai & terverifikasi | `game/MejaScene.ts` `gambar()` (kartu meluncur ke slot baru) | Label mode urut dan stagger belum |
| BM8 | Emote bisa dibisukan | Direkomendasikan. Batas emote di meja: Butuh persetujuan | Meja sudah membatasi 1 emote per 1,2 dtk (`packages/meja/src/meja.ts`) | |
| BM9 | Getar setara visual dan audio | Diimplementasikan, belum diverifikasi | Giliranmu: bunyi + getar + area tangan menyala | Belum dicek di HP fisik |
| BM10 | Bingkai meja warung | Selesai & terverifikasi | `gaya/token.css` (laken, kayu, kuningan, krem), latar di `gaya/dasar.css`, punggung kawung di `game/kartuGrafisGambar.ts` | Papan kayu berayun dan 5-second test belum |
| TK1 | Ease fungsi untuk pegas | Selesai & terverifikasi | `gerak.ts` `easePegas()` | `test/gerak.test.ts` |
| TK2 | Tween chain | Direkomendasikan (diganti pola lain) | `game/MejaScene.ts` `pentung()` (async/await per tahap, cadangan per tween + cadangan total 6,5 dtk) | `tweens.chain` tidak dipakai |
| TK3 | Stagger untuk bagi kartu | Direkomendasikan (diganti pola lain) | `game/MejaScene.ts` `bagiKartu()` (jeda per kartu manual) | |
| TK4 | Tint di Phaser 4 | Selesai & terverifikasi | `game/MejaScene.ts` (`setTint` + `setTintMode(FILL)` untuk cincin pilih, gelap saat dibalik, `clearTint`) | |
| TK5 | Umpan balik pointer dan `wasTouch` | Selesai & terverifikasi | `game/MejaScene.ts` `pasangInput()` (hover hanya mouse, getar ketuk untuk sentuhan) | |
| TK6 | Pool objek | Selesai & terverifikasi (pendekatan lain) | `game/MejaScene.ts` rekonsiliasi per kunci; teks hanya di-`setText` saat berubah | Menggantikan pool: objek tidak dihancurkan tiap model berubah |
| TK7 | Partikel untuk momen heboh | Direkomendasikan (sebagian) | `game/MejaScene.ts` `percik()` (pentungan dibuka, pemenang), mati saat hemat | Emitter dibuat per ledakan; kembar As/sapu bersih belum |
| TK8 | Gerak dikurangi dan `timeScale` aman | Selesai & terverifikasi | `gerak.ts` `durasi()`; `MejaScene.tw()` (cadangan dari durasi terskala); `preferensi.ts` (dengar `matchMedia`) | `timeScale` tidak dipakai sama sekali |
| TK9 | Bus audio dan limiter | Selesai & terverifikasi | `efek/mesinAudio.ts` | |
| TK10 | Burst derau di-cache dan dibatasi | Selesai & terverifikasi | `efek/sintesis.ts`, `efek/mesinAudio.ts`, `efek/suara.ts` (batas per jenis, polifoni 8) | Uji stres di Chrome |
| TK11 | Membuka audio di iOS | Diimplementasikan, belum diverifikasi | `efek/mesinAudio.ts` (unlock lewat gestur, cek `state !== 'running'`, batas waktu bangun) | iPhone belum |
| TK12 | Musik latar generatif | Selesai & terverifikasi | `efek/musik.ts` (lookahead, berhenti saat tab tersembunyi, bawaan mati) | Uji dengar dan CPU 30 menit di HP belum |
| TK13 | Preferensi yang tervalidasi | Selesai & terverifikasi | `preferensi.ts` | `test/preferensi.test.ts` |
| TK14 | Update PWA tanpa memotong putaran | Diimplementasikan, belum diverifikasi | `apps/client/vite.config.ts` (`registerType: 'prompt'`); `main.ts` (`registerSW`, toast versi baru, ditunda saat putaran, cek tiap jam) | Siklus deploy versi A → B lewat HTTPS belum diuji |

---

## A. Kartu fisik & game feel

### GF1. Kartu bereaksi saat disentuh, bukan saat dilepas

- **Temuan:** Swink mendefinisikan game feel sebagai kontrol real-time; siklus koreksi harus di bawah 100 ms supaya jeda dari komputer tidak terasa. Di kode sekarang kartu, deck, dan buangan baru bereaksi di `pointerup`.
- **Prinsip:** P1. Kartu harus terasa tertangkap jari begitu disentuh.
- **Usulan:** Di `pointerdown` kartu langsung naik sedikit dan membesar (atau mengecil 0,97 sebagai tanda ditekan). Aksi logika tetap di `pointerup`/`dragend` supaya alur `kontrolMeja` tidak berubah. Tombol HTML diberi `:active { transform: scale(.96) }`.
- **Implementasi:** Tween 70–80 ms `Quad.easeOut` di `gambarTangan()`; kembali dengan pegas saat dilepas atau `pointerout`. Lihat juga TK5.
- **Validasi:** Rekam layar 240 fps; dari sentuhan sampai kartu bergerak ≤ 100 ms (maks 6 frame di 60 Hz). Uji persepsi 5 pemain: "mana yang terasa lebih nurut?".
- **Sumber:** https://lizengland.com/blog/review-game-feel-by-steve-swink/ ; https://ar5iv.arxiv.org/html/2011.09201

### GF2. Durasi animasi mengikuti jarak

- **Temuan:** Material Design (M1): transisi tipikal 300 ms, elemen masuk 225 ms, keluar 195 ms, di atas 400 ms mulai terasa lambat; durasi menyesuaikan jarak tempuh. Token M3: Short 50–200, Medium 250–400, Long 450–600 ms. `terbang()` sekarang memakai 420 ms tetap.
- **Prinsip:** P2. Jarak pendek cepat, jarak jauh lebih lama, tapi tidak pernah lamban.
- **Usulan:** Durasi = `clamp(200 + jarakCss × 0,45, 220, 420)`. Kartu yang keluar layar sekitar 195 ms, kartu yang datang ke tangan sendiri 260–300 ms.
- **Implementasi:** Hitung jarak dalam piksel CSS (bagi dpr). Timeout cadangan dihitung dari durasi baru (wajib menurut AGENTS.md). Lewatkan lewat `durasi()` di `gerak.ts` supaya ikut setelan kecepatan.
- **Validasi:** Log durasi per peristiwa di mode dev; tidak ada animasi kartu tunggal di atas 450 ms; total waktu antrian satu putaran bot-vs-bot tidak naik.
- **Sumber:** https://m1.material.io/motion/duration-easing.html ; https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md

### GF3. Satu kosakata easing

- **Temuan:** Kurva Material M3: standard (0.2,0,0,1), emphasized decelerate (0.05,0.7,0.1,1), emphasized accelerate (0.3,0,0.8,0.15). `Back` di Phaser punya parameter overshoot (default 1.70158) lewat `easeParams`.
- **Prinsip:** P2. Animasi kartu dan UI HTML terasa dari satu tangan.
- **Usulan:** Kartu mendarat pakai decelerate kuat, kartu pergi pakai accelerate, overshoot kecil (sekitar 1,2) untuk kartu biasa; overshoot besar hanya untuk momen besar (mentung).
- **Implementasi:** Ekspor `MENDARAT`, `PERGI`, `STANDAR` dari `gerak.ts` (Phaser 4 menerima ease berupa fungsi). Token CSS `--ease-standar`, `--ease-masuk`, `--ease-keluar`, `--dur-masuk: 225ms`, `--dur-keluar: 195ms`.
- **Validasi:** Unit test helper bezier: f(0)=0, f(1)=1, monoton untuk kurva tanpa overshoot. Review visual berdampingan dengan rekaman slow-mo.
- **Sumber:** https://m1.material.io/motion/duration-easing.html ; https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md ; https://docs.phaser.io/api-documentation/3.88.2/namespace/math-easing-back ; https://phaser.io/examples-show/534

### GF4. Pegas untuk mendarat dan kembali ke slot

- **Temuan:** Spring physics (mass, stiffness, damping) tidak harus memantul. Token M3: DefaultSpatial damping 0.9 / stiffness 700, FastSpatial 0.9 / 1400, SlowSpatial 0.9 / 300. Phaser 4 tidak punya ease 'Spring' bawaan, tapi menerima fungsi `(t) => number`.
- **Prinsip:** P2. Kartu yang dilepas atau mendarat "mengendap", tidak berhenti mati.
- **Usulan:** Pegas untuk tiga hal: kartu yang dilepas setelah digeser kembali ke slot, kartu terpilih naik/turun, dan kartu mendarat di kartu jadi atau buangan. `Back.easeOut` tetap untuk pop UI kecil.
- **Implementasi:** Ease pegas tertutup; T ≈ 6,9/(ζω0): stiffness 700/ζ 0,9 ≈ 290 ms. Pegas cukup di `scale`/`y`, `x` tetap `Cubic.easeOut` supaya lintasan tidak bergoyang ke samping. Karena scene menggambar ulang seluruh meja, animasi kembali-ke-slot jalan di container `lapisan` dengan kartu asli dimasukkan ke `disembunyikan` (pola yang sudah dipakai pemutar).
- **Validasi:** Uji interupsi (geser, lepas, sentuh lagi sebelum diam: tidak boleh teleport). Overshoot < 2% untuk ζ 0,9. Unit test `easePegas()`: f(0)=0, |f(1)−1| < 0,002. FPS ≥ 55 di HP kelas bawah.
- **Sumber:** https://joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/ ; https://blog.maximeheckel.com/posts/the-physics-behind-spring-animations/ ; https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md ; `.claude/skills/tweens/SKILL.md`

### GF5. Lintasan busur, ancang-ancang, dan follow-through

- **Temuan:** Dua belas prinsip animasi Disney: gerak alami mengikuti busur, anticipation menyiapkan penonton, follow-through saat berhenti. Kartu sekarang terbang lurus dengan rotasi −10° ke 0°.
- **Prinsip:** P2. Kartu dilempar, bukan digeser.
- **Usulan:** Ancang-ancang 60–80 ms (ditarik sedikit, skala 0,96), lintasan kurva kuadrat dengan titik kontrol 15–20% jarak dari garis lurus, sudut akhir di buangan acak ±3–5° dengan overshoot rotasi kecil.
- **Implementasi:** `tweens.addCounter` atau `Phaser.Curves.QuadraticBezier.getPoint(u)`. Sudut acak kosmetik memakai `Math.random` di client, **bukan** `GameState.rng`. Timeout cadangan mencakup ancang-ancang + durasi.
- **Validasi:** Rekaman slow-mo; total durasi naik maksimal 70 ms per kartu; uji "siapa yang membuang" (GF14).
- **Sumber:** https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation ; https://www.simonwhatley.co.uk/writing/disney-12-basic-principles-of-animation/

### GF6. Bayangan dan kesan diangkat

- **Temuan:** Panduan desain ala Balatro (nilai ilustratif, bukan dari source game): hover naik −12 px dan skala 1,05 dalam 0,15 s, terpilih −24 px dan 1,08 dengan bayangan lebih tebal. Filter Shadow Phaser 4 ada (`enableFilters()` lalu `filters.internal.addShadow`), tapi tiap objek berfilter menambah draw call.
- **Prinsip:** P2. Ketinggian kartu terbaca dari bayangannya.
- **Usulan:** Kartu yang dipegang, digeser, atau terbang diberi bayangan; saat mendarat bayangan menyusut dan kartu sedikit menghentak (1,04 → 1,0). Kartu terpilih di tangan diberi bayangan lebih tinggi, tidak sekadar bingkai.
- **Implementasi:** Satu tekstur bayangan prerender di `kartuGrafis.ts` (Canvas 2D `shadowBlur`, trik `shadowOffsetX` supaya aman di Safari), dipasang sebagai Image di bawah kartu di `lapisan`. Filter `addShadow` hanya untuk kartu panggung (1–4 objek) dan hanya di WebGL.
- **Validasi:** Chrome DevTools Performance (CPU throttling 4×) dengan 13+ kartu di tangan; frame < 16,7 ms. Likert 1–5 "kartu terasa diletakkan".
- **Sumber:** https://blakecrosley.com/ja/guides/design/balatro ; https://docs.phaser.io/api-documentation/class/fx-shadow ; `.claude/skills/filters-and-postfx/SKILL.md`
- **[Pagar]** Bayangan identik untuk semua kartu; tidak boleh ada percabangan berdasarkan joker.

### GF7. Flip kartu dengan kedalaman

- **Temuan:** Flip 2D klasik: `scaleX` ke 0, tukar tekstur, `scaleX` kembali; ilusi diangkat lewat `scaleY` 1,2 di fase pertama. Flip sekarang 150 ms + 170 ms hanya mengubah `scaleX`. Di Phaser 4 tint dan mode tint dipisah (`setTint` + `setTintMode`), `setTintFill()` sudah dihapus.
- **Prinsip:** P2. Kartu dibalik terasa punya tebal.
- **Usulan:** Satu helper `balikKartu(img, kunci, lebar)` untuk panggung, pentung, dan animasi bagi: paruh pertama `scaleX→0`, `scaleY ×1,06–1,08`, naik 4% tinggi kartu, menggelap ke 0x9a9a9a; tukar tekstur di tengah; paruh kedua kembali dengan pegas dan kilau tipis. Total ≤ 340 ms.
- **Implementasi:** `tweens.chain` atau satu tween dengan `onUpdate` yang membaca `tween.progress` untuk tint. `clearTint()` di akhir. Di renderer Canvas tint tidak berefek, dan itu aman.
- **Validasi:** Uji visual di Chrome Android dan Safari iOS: tidak berkedip putih di titik tengah, `isTinted === false` sesudahnya. Rekaman 60 fps.
- **Sumber:** https://emanueleferonato.com/?p=10808 ; https://phaser.io/examples-show/236 ; https://kodeco.com/1062-card-game-mechanics-in-sprite-kit-with-swift/page/3?page=3 ; https://godotshaders.com/shader/balatro-card-tilt/ ; https://blakecrosley.com/ja/guides/design/balatro ; `.claude/skills/game-object-components/SKILL.md`
- **[Pagar]** Kilau berlaku untuk **setiap** kartu yang dibalik, tidak pernah dipakai menandai joker.

### GF8. Drag yang punya bobot

- **Temuan:** Port Godot gerak hover/drag ala Balatro (perkiraan): posisi lerp ke kursor faktor 0,25 per frame, rotasi dari kecepatan (di-clamp), skala hover 1,05. Pointer Phaser 4 punya `velocity` yang dihaluskan `motionFactor` (default 0,2). Drag sekarang menempelkan kartu tepat di jari tanpa skala, rotasi, atau bayangan.
- **Prinsip:** P1, P2. Kartu mengikuti jari dengan sedikit kelembaman.
- **Usulan:** Saat drag: target + lerp tak bergantung frame rate, kemiringan dari kecepatan (maks sekitar ±8–12°), skala 1,08, bayangan naik, buangan disorot ("Lepas untuk buang"). Dilepas di luar zona: kembali ke slot dengan pegas, tanpa aksi. Animasi buang dimulai dari posisi lepas supaya tidak ada teleport.
- **Implementasi:** `a = 1 − (1 − 0,25)^(delta/16,67)`; `img.angle = clamp(ptr.velocity.x / d × 0,6, −8, 8)`. Kartu tangan pakai `setOrigin(0.5)` supaya kemiringan berporos di tengah. Ambang drag tetap 12 × dpr.
- **Validasi:** Uji di HP sungguhan (sentuh): persentase salah jatuh tidak naik; uji di 30 fps (CPU throttling); urutan tangan tetap tersimpan setelah drag.
- **Sumber:** https://godotshaders.com/shader/balatro-card-hover/ ; https://godotshaders.com/shader/balatro-card-tilt/ ; https://80.lv/articles/balatro-s-card-movements-shaders-recreated-in-unity ; https://clovisindo.itch.io/balatro-like ; `.claude/skills/input-keyboard-mouse-touch/SKILL.md`
- **Perlu keputusan pemilik:** flick (lempar cepat) untuk membuang jangan jadi bawaan karena rawan salah buang; kalau mau, jadikan opsi dengan bawaan mati.

### GF9. Anggaran juice per kelas peristiwa

- **Temuan:** Survei Pichlmair & Johansen: studi Kao (2020) menemukan juiciness medium dan high mengungguli ekstrem dan tanpa juice untuk pengalaman pemain, motivasi, waktu main, dan performa. Juice berlebihan mengaburkan elemen yang penting secara mekanik; Apple HIG meminta gerak dihindari pada interaksi yang sangat sering.
- **Prinsip:** P3.
- **Usulan:** Kecil (ambil deck, geser, pilih): gerak + bunyi tipis. Sedang (buang, turunkan kartu jadi): + settle, bayangan, bunyi berlapis. Besar (mulung, mentung, kepentung, joker dibuang): + hit-stop, shake, partikel, sorakan. Setelan efek lengkap/hemat sudah ada di preferensi.
- **Implementasi:** Tabel `ANGGARAN: Record<JenisPeristiwa, 'kecil' | 'sedang' | 'besar'>` di `efek/pemutar.ts`; fungsi `juice(tingkat)` mengembalikan pengali shake, partikel, freeze, durasi. Mode hemat dan kurangi gerak memotong kelas besar.
- **Validasi:** Playtest A/B tingkat efek dengan pemain Kedai Madya (within-subject, 2 putaran per tingkat): seru, capek mata, "paham apa yang terjadi", dan jumlah pertanyaan "tadi siapa buang apa?".
- **Sumber:** https://ar5iv.arxiv.org/html/2011.09201 ; https://psych.substack.com/p/the-juicy-factor-the-science-of-making ; https://www.gamedeveloper.com/business/gdc-europe-2012-details-the-top-sessions-for-next-week-s-show ; https://roblog.co.uk/2024/03/juicy-games/ ; https://gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it- ; https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json
- **[Pagar]** Kelas efek ditentukan dari jenis peristiwa publik, tidak pernah dari isi tangan.

### GF10. Shake hanya untuk momen besar, pakai model trauma

- **Temuan:** Model trauma (Eiserloh, GDC 2016): intensitas = trauma², offset dari noise × intensitas × maks. Contoh Bevy: maks 10° dan 20 px untuk game aksi. Panduan ala Balatro: shake bertingkat sesuai skala kejadian.
- **Prinsip:** P3, P4.
- **Usulan:** Trauma hanya untuk mentung (0,35), kepentung pada diri sendiri (0,5), dan pentungan joker 250 (0,7). Maks offset 6 px CSS dan 0,8°, decay 2,5/s supaya selesai ≤ 0,4 s. Mati kalau kurangi gerak atau efek hemat.
- **Implementasi:** Value-noise 1D di `MejaScene.update()` yang menggeser `cam.setScroll` dan `cam.setRotation`; hindari `camera.shake()` bawaan yang jitter acak per frame. Overlay HTML tidak ikut bergeser.
- **Validasi:** 5 pemain, 3 putaran: ada yang pusing atau tidak; rekaman memastikan shake < 0,5 s.
- **Sumber:** https://bevy.org/examples/camera/2d-screen-shake/ ; https://blakecrosley.com/ja/guides/design/balatro ; https://infovore.org/?p=5275

### GF11. Hit-stop, tiga fase, dan antrian yang bisa dipercepat

- **Temuan:** Nuclear Throne membeku 10–20 ms per hit; 50–100 ms untuk pukulan berat. Analisis Hearthstone: sinyal berlapis dengan pola Preparation → Emphasis → Aftermath; kesalahan nomor satu adalah hanya satu lapis. Apple HIG: biarkan orang membatalkan gerak, jangan memaksa menunggu animasi berulang.
- **Prinsip:** P4.
- **Usulan:** Pentungan tertutup mendarat → tahan 70 ms → getar tegang; saat dibuka, freeze 50 ms sebelum label nilai membesar. Buang biasa cukup 20–30 ms. Seluruh antrian animasi bisa dipercepat dengan ketuk meja (×3) atau dilewati dengan ketuk kedua. Panel mentung tetap wajib ditekan Lanjut.
- **Implementasi:** Delay di chain (`time.delayedCall` atau `hold`), bukan `timeScale` global untuk freeze. Zona ketuk transparan di atas `lapisan` selama pemutar berjalan: ketuk pertama `tweens.timeScale = 3` dan `time.timeScale = 3`, ketuk kedua `complete()` semua tween. Kembalikan ke 1 saat antrian kosong. Timeout cadangan pentung (sekarang 4800 ms) ikut diperbarui.
- **Validasi:** A/B rekaman 0 vs 70 ms ("mana yang terasa lebih dibanting?"); total animasi pentungan < 4 s; satu putaran penuh dengan pemain yang sering mengetuk tanpa antrian macet; `npm test` + typecheck lolos.
- **Sumber:** https://infovore.org/?p=5275 ; https://www.wayline.io/learn/game-feel/1 ; https://critpoints.net/2017/05/17/hitstophitfreezehitlaghitpausehitshit/ ; https://bugnet.io/blog/how-to-fix-hitstop-or-freeze-frame-feeling-off ; https://jboger.substack.com/p/hearthstone ; https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json

### GF12. Kocok dan bagi kartu sebagai koreografi

- **Temuan:** Animasi kocok sebaiknya koreografi di atas hasil yang sudah ditentukan kode: animasikan 12–24 kartu, jitter delay, lintasan melengkung, settle sekitar 0,5 s, satu haptic saat deck mendarat, crossfade saat Reduce Motion. Phaser 4 punya `this.tweens.stagger()`; stagger hanya berefek dengan banyak target. Sekarang `mulaiPutaran` tidak dianimasikan.
- **Prinsip:** P2, P4. Ritual awal putaran seperti di kedai.
- **Usulan:** Riffle singkat (sekitar 600 ms), lalu punggung kartu dibagikan ke tiap kursi (stagger 60–80 ms, jitter ±15 ms), tangan sendiri dibuka berurutan. Total ≤ 1,6 s, bisa dilewati sekali ketuk, dilewati otomatis kalau antrian menumpuk.
- **Implementasi:** `MejaScene.bagikan()` di `lapisan` dengan satu tween banyak target dan `delay: this.tweens.stagger(70)`. Timeout cadangan wajib; saat `document.hidden` langsung resolve. Kalau butuh peristiwa baru, ikuti prosedur AGENTS.md (state.ts → `terjadi()` → pemutar.ts), tapi itu perubahan engine dan **perlu keputusan pemilik**; utamakan memicu dari peristiwa `mulaiPutaran` yang sudah ada.
- **Validasi:** Waktu dari `putaranBerikut` sampai pemain bisa beraksi bertambah ≤ 2 s (0 s kalau dilewati); `npm test` tidak berubah; tidak ada kartu dobel.
- **Sumber:** https://vp0.com/blogs/tarot-card-shuffle-animation-swiftui.md ; https://blog.openreplay.com/staggered-animations-nth-child/ ; https://morphic.com/resources/sounds/card-shuffle-sound-effects ; `.claude/skills/tweens/SKILL.md`
- **[Pagar]** Animasi bagi hanya punggung kartu dan berjalan **sebelum atau di belakang** popup joker tanpa info tambahan. Popup tetap satu-satunya pengumuman angka joker.

### GF13. Audio kartu yang bervariasi dan berposisi

- **Temuan:** Variasi pitch beberapa persen dan volume 0,85–1,0 mencegah kesan berulang; naik satu semitone (×1,06) untuk rangkaian. Resep klik prosedural: derau 8 ms, peluruhan eksponensial, bandpass 4–5 kHz Q 3. `suara.ts` sekarang mensintesis bunyi yang identik setiap kali dan semuanya di tengah.
- **Prinsip:** P8.
- **Usulan:** Jitter bandpass ±8% dan gain 0,85–1,0; bunyi "tek" pendaratan terpisah dari desis luncur; nada naik per kartu saat menurunkan kartu jadi; `StereoPannerNode` −0,6..0,6 sesuai posisi kursi lawan.
- **Implementasi:** Buffer derau di-cache (lihat TK10), pan dihitung di pemutar dari posisi kursi `(x / lebarLayar) × 1,2 − 0,6`.
- **Validasi:** Uji buta dengan earphone: tunjuk kursi asal bunyi buang, target ≥ 70% benar; rekam output, gain total < 1 tanpa clipping.
- **Sumber:** https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting ; https://bugnet.io/blog/how-to-fix-unity-sfx-sounds-identical-every-play-no-variation ; https://mintlify.wiki/raphaelsalaja/userinterface-wiki/technical/web-audio-api ; https://blakecrosley.com/ja/guides/design/balatro
- **[Pagar]** Jangan pernah membedakan bunyi berdasarkan identitas kartu yang tersembunyi.

### GF14. Staging aksi lawan

- **Temuan:** Staging (Disney): sajikan satu ide dengan jelas supaya penonton tahu ke mana melihat. Di meja nyata kita melihat tangan teman bergerak sebelum kartu jatuh.
- **Prinsip:** P2, P6.
- **Usulan:** Sebelum kartu lawan terbang, kursinya memberi ancang-ancang 150–200 ms (panel atau kipas punggung kartu terangkat sedikit, nama membesar). Saat bot "berpikir", kipas punggung bergoyang sangat pelan (±1°, periode 2–3 s). Titik asal terbang diambil dari kursi itu.
- **Implementasi:** `scene.telegraf(kursi)` di pemutar dengan timeout cadangan 400 ms; mati saat kurangi gerak.
- **Validasi:** Uji "siapa yang membuang" dalam 20 kejadian: akurasi naik ≥ 20 poin persen; durasi giliran bot bertambah ≤ 200 ms per aksi.
- **Sumber:** https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation ; https://jboger.substack.com/p/hearthstone ; https://clovisindo.itch.io/balatro-like
- **[Pagar]** Kipas punggung kartu lawan hanya boleh menunjukkan jumlah kartu (info publik).

---

## B. Aksesibilitas

### AK1. Kontras teks dan kontrol

- **Temuan:** XAG 102: kontras minimal 4,5:1 untuk teks standar dan elemen penting, 3:1 untuk teks besar, 7:1 di mode kontras tinggi; diukur terhadap bagian latar yang paling tidak kontras. Label meja `#7f8f80` di atas gradien hijau sekitar 2,6:1 (hitungan manual, perlu dicek alat), jadi gagal.
- **Prinsip:** P7.
- **Usulan:** Ganti `#7f8f80` dengan token ≥ 4,5:1 terhadap bagian meja paling terang. Opsi kontras tinggi (≥ 7:1, latar meja polos) sebagai pengembangan berikutnya, bawaannya dari `prefers-contrast: more`.
- **Implementasi:** Satu modul palet yang dibaca `MejaScene` dan CSS variable di `gaya.css`. Scene menggambar ulang dari model, jadi cukup gambar ulang saat setelan berubah.
- **Validasi:** Colour Contrast Analyser untuk setiap pasangan token; unit test rasio luminance WCAG (gagal kalau < 4,5); screenshot HP di luar ruangan.
- **Sumber:** https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102 ; https://gameaccessibilityguidelines.com/full-list/

### AK2. Ukuran teks dan teks besar

- **Temuan:** XAG 101: teks mobile minimal setara 18 px pada 100 DPI dan bisa diperbesar sampai 200% tanpa kehilangan konten. Meja sekarang menggambar banyak label 10–12 px CSS.
- **Prinsip:** P7.
- **Usulan:** Label informatif di meja minimal sekitar 14 px CSS, label yang menentukan aksi 16 px. Setelan ukuran teks (preferensi `ukuranTeks` normal/besar sudah ada) berlaku untuk canvas dan HTML.
- **Implementasi:** `MejaScene.teks()` mengalikan ukuran dengan faktor skala; label yang dipotong dihitung ulang dengan `text.width` dan pindah baris kalau tidak muat, bukan diperkecil. HTML pakai `rem` dan `html { font-size: calc(16px × skala) }`.
- **Validasi:** Screenshot 360×640 dan 412×915 di skala normal dan besar: tidak ada label terpotong, tumpang tindih, atau scroll horizontal.
- **Sumber:** https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101 ; https://gameaccessibilityguidelines.com/full-list/

### AK3. Kartu empat warna dan info yang tidak hanya lewat warna

- **Temuan:** Dek empat warna populer di poker online (sekop hitam, hati merah, keriting hijau, wajik biru) dan bisa dipilih per pemain. GAG: sekitar 8–10% laki-laki sulit membedakan merah/hijau, jadi warna harus dipasangkan dengan simbol. Pemain buta warna merah-hijau di forum Balatro sering tertukar hati dan wajik. Seri di Kedai Madya wajib satu bunga, jadi bunga harus cepat terbaca.
- **Prinsip:** P6, P7.
- **Usulan:** Opsi kartu empat warna (preferensi `warnaKartu` sudah ada, bawaan dua warna): Love merah, Wajik biru, Kriting hijau, Waru hitam. Pip bunga di indeks pojok tetap ada dan diperbesar.
- **Implementasi:** `warnaBunga(b, empatWarna)` di `kartuGrafis.ts`; kunci cache tekstur memuat mode warna lalu gambar ulang. Calon warna ≥ 5:1 terhadap krem kartu: biru `#1565c0`, hijau `#1b7a34` (hitungan manual). Kartu HTML di modal memakai warna yang sama.
- **Validasi:** Chrome DevTools "Emulate vision deficiencies" (deuteranopia, protanopia, tritanopia) atau Color Oracle; uji tebak bunga dari tangan bertumpuk; uji dengan minimal satu pemain buta warna sungguhan.
- **Sumber:** https://en.wikipedia.org/wiki/Four-color_deck ; https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/ ; https://thedieline.com/the-first-card-game-for-the-colorblind-is-here-meet-uno-coloradd/ ; https://steamcommunity.com/app/2379780/discussions/0/4308327178400364606 ; https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html
- **[Pagar]** Aman: pewarnaan murni per bunga, tidak menyentuh angka, jadi tidak membocorkan joker.

### AK4. Target sentuh dan state yang terbaca tanpa warna

- **Temuan:** WCAG 2.2 SC 2.5.8: target minimal 24×24 CSS px; GAG menyarankan 0,96 cm di HP; ringkasan HIG/Material: 44 pt / 48 dp. SC 1.4.11: indikator state ≥ 3:1. XAG 103: "graying" untuk kontrol nonaktif harus disertai cara lain. Sekarang strip kartu tangan bisa sempit sampai `cw × 0,5`, kartu yang dipungut hanya `setAlpha(0.35)`, tombol nonaktif hanya opacity.
- **Prinsip:** P7, P6.
- **Usulan:** Strip kartu tangan yang terlihat ≥ 36–44 px CSS; kalau tangan penuh, tambah baris. Hit area sebatas strip yang terlihat. Kartu terpilih: naik + outline emas ≥ 2 px + tanda centang. Kartu buangan yang akan ikut dipungut: outline putus-putus + nomor urut pungut. Tombol `.kecil` minimal 44×44 px. Aksi permanen jauh dari 16 px terbawah (zona gesture).
- **Implementasi:** `langkahMin = max(cw × 0,5, 44 × d)` di `tataTangan`; `setInteractive(new Phaser.Geom.Rectangle(...), Phaser.Geom.Rectangle.Contains)`; bar aksi `min-height: 48px` dan `padding-bottom: calc(8px + var(--aman-bawah))`.
- **Validasi:** Skrip dev `window.__remi.adegan.children.list` menghitung lebar strip minimum dengan 13–20 kartu di 360 dan 390 px; uji ketuk 50 kali dan hitung salah pilih; mode grayscale (achromatopsia) semua state tetap terbedakan.
- **Sumber:** https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html ; https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens/ ; https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103 ; https://frontendchecklist.io/rules/accessibility/touch-targets ; https://game-solver.com/rummikub/

### AK5. Kurangi gerak

- **Temuan:** WCAG 2.2 SC 2.3.3 (AAA) dan teknik C39: animasi dari interaksi harus bisa dimatikan kecuali esensial, lewat `prefers-reduced-motion`. MDN: "reduce" berarti mengurangi atau mengganti (misalnya dengan dissolve), dan scaling/panning objek besar memicu gangguan vestibular. XAG 117: hindari camera shake atau sediakan opsi mematikannya. Sekarang ada goyang layar ±8 px saat mentung, sorak dengan overshoot, dan panggung kartu besar.
- **Prinsip:** P5.
- **Usulan:** Preferensi `gerak` (ikut sistem / penuh / kurang) sudah ada. Saat kurang: tidak ada goyang layar, shake, tilt, atau partikel; sorak muncul dengan fade 150–200 ms; kocok dan bagi jadi crossfade; kartu terbang tetap ada (esensial untuk tahu kartu pindah ke mana) tapi lurus, tanpa busur atau overshoot, atau diganti fade di tujuan; panggung diganti kartu biasa yang disorot. Momen mentung tetap terasa lewat suara dan teks.
- **Implementasi:** `kurangiGerak()` dari `gerak.ts` dibaca pemutar dan scene; CSS `@media (prefers-reduced-motion: reduce)` plus atribut `<html data-gerak="kurang">`. Kalau `tweens.timeScale` diubah, semua timeout cadangan dibagi `timeScale` lewat satu helper; jangan pernah `timeScale < 1` tanpa menskalakan cadangan.
- **Validasi:** Android "Hapus animasi", iOS "Kurangi Gerakan", atau DevTools Rendering → Emulate `prefers-reduced-motion`; satu putaran penuh termasuk mentung: tidak ada translasi/skala besar, setiap buangan tetap jelas pemiliknya, antrian tidak macet, berganti tanpa reload.
- **Sumber:** https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html ; https://w3.org/WAI/WCAG22/Techniques/css/C39 ; https://dequeuniversity.com/resources/wcag2.1/2.3.3-animations-from-interactions ; https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion ; https://blog.openreplay.com/prefers-reduced-motion-accessible-animation/ ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117 ; https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json

### AK6. Kedip dan denyut yang berhenti sendiri

- **Temuan:** WCAG SC 2.2.2: konten berkedip/bergerak otomatis lebih dari 5 detik harus bisa dihentikan. SC 2.3.1: maksimal 3 kilatan per detik. Sekarang ada tween alpha `repeat: -1` tanpa batas (bingkai bahaya lawan, bingkai deck, "KARTUMU DI ATAS!"), sekitar 1 Hz.
- **Prinsip:** P5, P7.
- **Usulan:** Denyut berhenti setelah 3 siklus lalu jadi bingkai statis tebal + teks; saat kurangi gerak langsung statis. Tidak ada kilat layar penuh putih/merah.
- **Implementasi:** `repeat: 5` dengan `yoyo` + `onComplete: setAlpha(1)`; waktu mulai denyut disimpan per kunci supaya gambar ulang tidak memulai ulang denyut.
- **Validasi:** Rekam 60 fps, hitung transisi luminance per detik (≤ 3); denyut berhenti ≤ 5 s; gambar ulang beruntun tidak me-reset denyut.
- **Sumber:** https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html ; https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117
- **[Pagar]** "TINGGAL 1 KARTU" dan "KARTUMU DI ATAS" adalah info publik (jumlah kartu dan pemilik buangan terlihat semua orang). Jangan menambah denyut baru yang terkait isi tangan sendiri.

### AK7. Kecepatan animasi bisa diatur

- **Temuan:** GAG "Include an option to adjust the game speed": memperlambat membantu pemain yang butuh waktu lebih lama memproses kejadian. Balatro punya pengaturan kecepatan game, slider screen shake, dan kartu kontras tinggi; reviewer Rummikub meminta opsi mematikan animasi. Tim Hearthstone sangat menjaga agar opsi tidak membengkak. Tempo bot sudah bisa diatur, tapi durasi animasi kejadian tetap.
- **Prinsip:** P5, P7.
- **Usulan:** Preferensi `kecepatan` (santai / normal / cepat) sudah ada. Santai cocok untuk pemain tua di kedai yang ingin melihat siapa mungut apa; cepat untuk yang sudah hafal. Sorakan dan panel ikut diskalakan. Tempo bot tetap urusan meja, tidak ikut dipercepat.
- **Implementasi:** `durasi(ms)` di `gerak.ts` untuk tween, `setTimeout`, dan CSS `--durasi`; timeout cadangan ikut dikalikan faktor supaya tidak memotong animasi di mode santai.
- **Validasi:** Unit test `durasi()`; main offline di ketiga setelan tanpa antrian macet; total waktu animasi per putaran di mode cepat kira-kira separuh normal.
- **Sumber:** https://gameaccessibilityguidelines.com/include-an-option-to-adjust-the-game-speed/ ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117 ; https://steamcommunity.com/app/2379780/discussions/0/4201364375109001844 ; https://gameaccessibilityguidelines.com/full-list/ ; https://game-solver.com/rummikub/ ; https://hearthstone.wiki.gg/wiki/Bad_cards

### AK8. Batas waktu giliran yang manusiawi

- **Temuan:** WCAG SC 2.2.1: batas waktu bisa dimatikan, diatur sampai 10× bawaan, atau diberi peringatan ≥ 20 detik. `detikGiliran` bawaan 60 dengan rentang 0–600, jadi host sudah bisa mematikan atau mengatur sampai 10×. Hearthstone menampilkan "tali sumbu" hanya sekitar 20 detik terakhir, bukan hitung mundur penuh; ada keluhan tali tertinggal dari jam asli karena menunggu animasi.
- **Prinsip:** P6, P7.
- **Usulan:** Bar sisa waktu muncul hanya di sepertiga terakhir (atau 15 detik terakhir) di bingkai pemain aktif, kuning lalu merah, dengan teks angka. Peringatan "Waktumu tinggal 15 detik, Bos" lewat teks, bunyi pelan, pengumuman screen reader, dan getar opsional. Offline tetap tanpa timer.
- **Implementasi:** Hitung dari `batasWaktu` server dengan koreksi offset jam (`waktuServer − Date.now()` saat view diterima); bar DOM `transform: scaleX()` atau Graphics yang di-update tiap 250 ms.
- **Validasi:** Dua klien (localhost dan 127.0.0.1) dengan throttling "Slow 3G": selisih bar dan server < 500 ms; 0 kejadian "timeout padahal animasi belum selesai" dalam 20 giliran.
- **Sumber:** https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html ; https://hearthstone.wiki.gg/wiki/Turn ; https://us.forums.blizzard.com/en/hearthstone/t/explain-the-rope-better/131412 ; https://pokerfuse.com/features/special-feature/mercury-rising-a-look-at-pokerstars-brand-new-table-theme-25-04/
- **Perlu keputusan pemilik:** memperpanjang waktu di tengah giliran atau mengubah durasi giliran mengubah perilaku meja.

### AK9. Main dengan keyboard

- **Temuan:** XAG 112: seluruh UI dan gameplay bisa dimainkan dengan input digital saja, urutan fokus mengikuti tata letak. WAI-ARIA APG: roving tabindex untuk widget komposit. PixiJS memakai overlay DOM tersembunyi di atas objek canvas. Phaser `KeyboardPlugin` mendengarkan di window; `addKey()`/`createCursorKeys()` menambah capture yang bisa mematikan panah dan spasi di input HTML. Sekarang tidak ada handler keyboard di meja.
- **Prinsip:** P6.
- **Usulan:** Tab berpindah antar wilayah (tangan, buangan, deck, bar aksi); panah memilih kartu; Spasi/Enter mengetuk; pintasan opsional (misalnya D ambil deck, angka 1–5 mungut sampai kartu ke-n dari atas, B buang, Esc batal) ditampilkan di menu. Cincin fokus digambar di canvas (2–3 px × dpr, kontras ≥ 3:1), beda dari warna "dipilih" dan "wajib".
- **Implementasi:** `this.input.keyboard.disableGlobalCapture()` lalu `on('keydown')` yang mengabaikan event saat fokus di input/textarea atau ada modal terbuka. Opsional overlay `role="listbox"` untuk screen reader yang diposisikan dari `posisiKartu(id) ÷ dpr`. Semua aksi lewat handler yang sama dengan ketuk, jadi validasi tetap dari `giliran.ts`.
- **Validasi:** Satu putaran penuh offline hanya dengan keyboard; mengetik di input nama/kode tidak terganggu; axe DevTools pada overlay.
- **Sumber:** https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ ; https://pixijs.com/8.x/guides/components/accessibility ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112 ; https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html ; `.claude/skills/input-keyboard-mouse-touch/SKILL.md`
- **[Pagar]** Label aksesibel kartu **hanya angka + bunga** ("7 Love"), tidak pernah "joker"; urutan fokus mengikuti urutan visual apa adanya, tidak mengelompokkan joker. Unit test generator label: tidak ada kata "joker" untuk tangan yang memuat joker.
- **Perlu keputusan pemilik:** daftar pintasan keyboard.

### AK10. Pengumuman untuk screen reader

- **Temuan:** MDN Live Regions: `aria-live="polite"` pilihan normal, `assertive` hanya untuk hal kritis; live region harus sudah ada sebelum isinya berubah; `role="alert"` + `aria-live` bisa dibacakan ganda di VoiceOver iOS. GAG: umumkan perubahan yang terjadi tanpa aksi pemain. XAG 103: emoji dibacakan dengan nama literalnya.
- **Prinsip:** P6, P10.
- **Usulan:** Satu `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">` untuk "Giliranmu, Bos", "Budi mulung 3 kartu", "MENTUNG! Kamu kepentung", dan peringatan waktu. Pengumuman joker memindahkan fokus ke tombol OK di dialog, bukan `assertive`. Tombol emoji diberi `aria-label` dan emojinya `aria-hidden`.
- **Implementasi:** `umumkan(teks)` (kosongkan dulu, isi 50 ms kemudian) dipanggil dari pemutar memakai string yang sama dengan sorakan. Satu modul `teksAksesibel.ts` menjadi satu-satunya sumber teks `aria-label`, pengumuman, dan ringkasan buangan; modul ini hanya menerima `ViewPemain` dan `Peristiwa`.
- **Validasi:** TalkBack (Android Chrome) dan VoiceOver (iOS Safari): giliran dan mentung terdengar tepat sekali; unit test `teksPengumuman` untuk semua jenis peristiwa tidak memuat angka joker atau tangan lawan; jumlah live region tetap 1.
- **Sumber:** https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions ; https://gameaccessibilityguidelines.com/ensure-screenreader-support-for-mobile-devices/ ; https://gitnation.com/contents/a11y-and-interactive-canvases ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103
- **[Pagar]** Jangan pakai `role="log"` yang menumpuk riwayat buang. Pengumuman buang memakai status yang ditimpa; ringkasan buangan atas permintaan hanya (jumlah pemain − 1) kartu teratas. Angka joker tidak pernah diumumkan ulang.

### AK11. Setiap isyarat penting punya pasangan visual

- **Temuan:** XAG 103: isyarat audio penting harus juga lewat minimal satu indra lain; haptik hanya kanal tambahan karena banyak perangkat tidak mendukung. Sekarang ada bunyi giliran, bahaya, detak, tegang, joker, mentung, kepentung.
- **Prinsip:** P6.
- **Usulan:** Banner "Giliranmu" yang jelas (16 px+ dengan ikon) untuk pemain tuli atau suara mati; pastikan detak dipasangkan dengan "KARTUMU DI ATAS!", kepentung dengan panel mentung, bahaya dengan sorakan.
- **Implementasi:** Konstanta `PASANGAN_ISYARAT: Record<JenisBunyi, 'sorak' | 'banner' | 'bingkai'>` di `efek/` dan test cakupan.
- **Validasi:** Satu putaran dengan suara dan getar mati: pemain uji tetap bisa menyebut kapan gilirannya dan kapan kepentung.
- **Sumber:** https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103

### AK12. Volume terpisah dan bunyi yang tidak menyiksa

- **Temuan:** GAG: sediakan volume atau mute terpisah untuk efek, suara, dan musik; banyak bunyi tumpang tindih bisa menyiksa (termasuk bagi gangguan pemrosesan auditori). Reviewer Rummikub menyebut suaranya mengganggu. Sekarang suara hanya nyala/mati, osilator langsung ke `destination`, bunyi bahaya pakai square 880 Hz, dan detak berulang tanpa batas.
- **Prinsip:** P8.
- **Usulan:** Slider efek dan musik (preferensi `volumeEfek` dan `volumeMusik` sudah ada); square dilewatkan lowpass sekitar 3 kHz atau diganti triangle; detak berhenti setelah sekitar 8 denyut. Riset benchmark mengusulkan tiga kanal (Kartu, Sorakan, Pengingat); jumlah kanal adalah keputusan desain, bawaan cukup dua dulu supaya opsi tidak membengkak.
- **Implementasi:** Lihat TK9 (bus + limiter).
- **Validasi:** Ukur loudness tiap efek (EBU R128) supaya konsisten antar efek; slider 0 benar-benar senyap tanpa menghentikan kategori lain; uji 30 menit main di kedai.
- **Sumber:** https://gameaccessibilityguidelines.com/provide-separate-volume-controls-or-mutes-for-effects-speech-and-background-music/ ; https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/ ; https://audiomediainternational.com/mobile-loudness-an-adaptive-approach/ ; https://prod.developers.meta.com/horizon/documentation/unity/audio-loudness-meter-overview ; https://game-solver.com/rummikub/

### AK13. Getar yang bisa diatur dan tidak jadi satu-satunya kanal

- **Temuan:** XAG 110: haptik harus bisa dimatikan dan diatur kekuatannya, dan tidak boleh jadi satu-satunya kanal. Spesifikasi W3C Vibration: butuh sticky user activation, pola maks 10 entri, diblokir saat dokumen tidak terlihat. MDN: "Limited availability"; iOS Safari umumnya tidak mendukung (perlu dicek di perangkat). Pola sekarang berat (220-90-220 ms) dan tidak dibatasi frekuensinya.
- **Prinsip:** P6.
- **Usulan:** Kamus pola tetap dan ringan, misalnya `tik: 10`, `buang: 25`, `giliranmu: [15, 60, 15]`, `bahaya: [40, 50, 40]`, `kepentung: [80, 60, 140]`. Getar hanya untuk giliranmu, kartumu dipungut, kepentung, dan peringatan waktu; tidak untuk aksi lawan biasa. Sembunyikan atau beri label toggle getar kalau `'vibrate' in navigator` false. Opsi "lembut" (sekitar 50% durasi) bisa menyusul.
- **Implementasi:** `POLA_GETAR` + `getarDidukung` di `suara.ts`; rate limit global 80–120 ms kecuali kepentung; lewati kalau `document.visibilityState !== 'visible'`; tetap `try/catch`.
- **Validasi:** Android Chrome dan PWA: pola terasa beda dan tidak beruntun saat bot cepat; iPhone: toggle tersembunyi atau berlabel dan tidak ada error; unit test dengan `navigator.vibrate` di-mock (dua panggilan dalam 50 ms hanya meneruskan satu); grep tidak ada angka pola literal di luar `POLA_GETAR`.
- **Sumber:** https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/110 ; https://w3c.github.io/vibration/ ; https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API ; https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate ; https://developer-mdn.apple.com/design/human-interface-guidelines/patterns/playing-haptics ; https://lists.w3.org/Archives/Public/public-device-apis-log/2024Jun/0061.html ; https://github.com/mdn/browser-compat-data/issues/29166
- **[Pagar]** Tidak pernah ada getar yang berkaitan dengan isi tangan sendiri (misalnya saat memegang joker); itu sama dengan penanda joker.

### AK14. Pengaturan kenyamanan bisa dibuka sejak awal

- **Temuan:** XAG 112: jalur ke menu aksesibilitas harus tersedia sejak peluncuran pertama, atau game memenuhi pedoman secara bawaan dan membaca setelan platform. XAG 102 juga meminta setelan kontras platform dibaca saat game dibuka.
- **Prinsip:** P5, P7.
- **Usulan:** Satu panel Pengaturan yang bisa dibuka dari beranda dan menu ☰ di meja: ukuran teks, kartu empat warna, kurangi gerak, kecepatan animasi, efek hemat, volume, getar. Bawaan dibaca dari `prefers-reduced-motion` (dan nanti `prefers-contrast`). Saat pertama dibuka, kartu kecil "Atur tampilan dulu?" yang bisa dilewati tanpa menghalangi tombol main.
- **Implementasi:** HTML native (button, `input type=range`, fieldset/legend) di `ui/` dengan modal `role=dialog` yang sudah ada, fokus awal ke judul, Esc untuk menutup. Dengarkan `matchMedia(...).addEventListener('change')` selama pemain belum menimpa manual.
- **Validasi:** Instalasi baru dengan "Hapus animasi" menyala langsung masuk mode kurangi gerak; navigasi panel dengan keyboard dan TalkBack; simpanan lama tetap terbaca.
- **Sumber:** https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/112 ; https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102 ; https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

---

## C. Benchmark UX game kartu digital

### BM1. Kartu tangan yang "hidup" saat ditekan dan dipilih

- **Temuan:** Analisis Balatro: hover naik dalam 0,15 s, terpilih naik lebih tinggi dengan bayangan lebih tebal. Engadget menilai memindahkan kartu dengan sentuhan di Balatro mobile lebih memuaskan daripada dengan mouse. Kartu terpilih di sini langsung melompat naik dengan bingkai biru, tanpa tween dan tanpa umpan balik tekan.
- **Prinsip:** P1, P2.
- **Usulan:** Tekan: skala 0,97 selama 60 ms. Dipilih: naik dengan ease-out 140 ms, skala 1,04, plus bayangan. Batal: turun 110 ms. Tween kosmetik, di luar antrian animasi, tidak mengunci tombol.
- **Implementasi:** Simpan `Map<idKartu, yTerakhir>` di `MejaScene`; di `gambarTangan`, kalau status dipilih berubah, mulai dari y lama lalu tween ke y baru.
- **Validasi:** Rekaman 60 fps: jarak frame sentuh ke frame gerak pertama ≤ 2 frame (33 ms); A/B 5 pemain "mana yang lebih enak dipegang" dan hitung salah pilih per putaran.
- **Sumber:** https://blakecrosley.com/guides/design/balatro ; https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html

### BM2. Intensitas sebanding dengan pentingnya kejadian

- **Temuan:** Pelajaran utama analisis Balatro: "feedback should be proportional to significance"; shake bertingkat dan nada naik per kartu. Talk "Juice it or lose it" (Jonasson & Purho, GDC 2012) dan kritik Folmer Kelly bahwa juice berlebihan mengurangi imersi.
- **Prinsip:** P3.
- **Usulan:** Tabel intensitas per peristiwa: ambil deck dan buang biasa cukup suara; mulung dan turunkan kartu jadi pop kecil + nada naik per kartu; buang joker shake sedang; mentung besar; pentungan joker 250 paling besar. Sama dengan GF9, dipakai bersama.
- **Implementasi:** `INTENSITAS: Record<jenisPeristiwa, {...}>` di pemutar; `bunyiTangga(n)` di `suara.ts`.
- **Validasi:** 5–8 pemain mengurutkan 6 kejadian dari yang paling penting setelah 2 putaran; korelasi Spearman dengan tabel ≥ 0,8; tidak ada shake di ≥ 80% aksi rutin.
- **Sumber:** https://blakecrosley.com/guides/design/balatro ; https://rpgplayground.com/research-making-a-juicy-game/ ; https://eastondev.com/blog/pt/posts/dev/20260521-game-feedback-feel/

### BM3. Skor dibangun berurutan supaya bisa dipahami

- **Temuan:** Analisis Balatro: skor dibangun langkah demi langkah dengan total berjalan; sekitar 300 ms animasi berurutan menggantikan tutorial panjang karena mengajarkan apa yang penting. Digit berputar 0,4 s dengan overshoot dan stagger 50 ms.
- **Prinsip:** P4, P6. Pemain baru paham kenapa skornya plus atau minus.
- **Usulan:** Di akhir putaran, skor tiap pemain dibangun bertahap: kartu jadi (+nilai), sisa tangan (−nilai), lalu pentungan dan buang joker sebagai baris terpisah, lalu total berputar. Ketuk untuk langsung ke hasil.
- **Implementasi:** Data dari rincian skor engine (tidak ada logika aturan baru di UI); `tweens.addCounter` untuk angka; total maksimal 3 s per pemain dengan timeout cadangan.
- **Validasi:** Uji pemahaman: "kenapa skor si A minus?", target ≥ 4 dari 5 pemain baru menjawab benar, dibandingkan dengan tabel statis sekarang.
- **Sumber:** https://blakecrosley.com/guides/design/balatro
- **[Pagar]** Saat putaran selesai semua tangan memang terbuka (sesuai `viewUntuk`), jadi rincian skor aman. Peran joker di kartu jadi sudah terlihat di meja; jangan menambah angka joker sebagai teks terpisah.

### BM4. Seret ke buangan dengan zona yang jelas, dan intip tanpa memungut

- **Temuan:** Pemain Slay the Spire Android mengeluh kartu malah dimainkan saat mencoba membatalkan inspeksi ("punished for trying to inspect them"). Hearthstone ponsel memakai tahan-tekan untuk detail kartu. Spesifikasi rummy menyarankan menyorot zona jatuh yang valid saat kartu diseret.
- **Prinsip:** P1, P6.
- **Usulan:** Saat kartu diseret, sorot area buangan dengan label "Lepas untuk buang"; dilepas di luar zona, kartu kembali tanpa aksi. Tahan-tekan ≥ 350 ms pada kartu jadi lawan atau kartu buangan yang terlihat memperbesar kartu di atas jari tanpa memicu mulung.
- **Implementasi:** `sorotBuangan(true)` di event `drag` setelah lolos ambang; long-press dengan `time.delayedCall(350, pratinjau)`, `pointerup` sebelum itu dianggap ketuk biasa; pratinjau ×2,2 di `lapisan`, digeser ke atas jari.
- **Validasi:** Tugas "lihat kartu ketiga dari atas buangan tanpa memungut": 5/5 pemain berhasil tanpa aksi tak sengaja; pantau "kartu terbuang tak sengaja" dalam 3 putaran.
- **Sumber:** https://lemmy.world/comment/9268154 ; https://toucharcade.com/2020/06/15/slay-the-spire-ios-review-iphone-ipad-performance-icloud-megacrit-humble-games/ ; https://hearthstone.wiki.gg/wiki/Bad_cards ; https://www.trustedreviews.com/news/hearthstone-now-available-on-iphone-and-android-smartphones-2928657
- **[Pagar]** Yang boleh diperbesar hanya kartu yang memang terlihat: maksimal (jumlah pemain − 1) kartu teratas buangan dan kartu jadi di meja.

### BM5. Latihan pertama yang terarah

- **Temuan:** GAG: sertakan tutorial interaktif dan cara berlatih tanpa gagal. Tutorial Marvel Snap hanya beberapa menit (satu pertarungan terarah) dan pengalaman awal dikurasi; tim Hearthstone merekam ratusan pemain baru untuk menyempurnakan tutorial.
- **Prinsip:** P6. Belajar aturan Kedai Madya sambil main.
- **Usulan:** Mode latihan offline sekitar 3 menit: satu putaran dengan deck ber-seed yang mengajarkan berurutan ambil, turunkan seri, buang, mulung (memakai contoh resmi Bagian 5), lalu mentung. Teks coach mark dari `apps/client/src/konten/tutorial.ts`; aturan lengkap di layar Bantuan (`konten/bantuan.ts`). Tombol Lewati di setiap langkah dan "Ulangi latihan" di beranda.
- **Implementasi:** Engine deterministik, jadi `KoneksiOffline` bisa diberi seed tetap plus skenario (pindahkan builder teks kartu ke modul bersama yang tidak bergantung vitest). Coach mark overlay HTML dengan lubang sorot `box-shadow: 0 0 0 9999px rgba(0,0,0,.6)` yang posisinya dari `posisiKartu(id) ÷ dpr`. Langkah maju saat aksi yang diharapkan diterima; aksi lain tetap divalidasi engine seperti biasa.
- **Validasi:** Think-aloud dengan 5 orang yang belum pernah main aturan Kedai Madya: waktu sampai mulung sah pertama, jumlah `AturanError` per kode di 3 putaran pertama, dan ≥ 80% menyelesaikan latihan tanpa bantuan. Test engine memastikan skenario latihan selalu sah.
- **Sumber:** https://gameaccessibilityguidelines.com/full-list/ ; https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/ ; https://bossrush.net/2024/04/how-to-play-marvel-snap-a-beginners-guide/ ; https://hearthstone.wiki.gg/wiki/Bad_cards
- **[Pagar]** Teks tutorial tidak menunjuk kartu tertentu sebagai joker dan tidak menilai kartu mana yang aman dibuang. Angka joker hanya di popup.

### BM6. Lencana validasi pilihan sendiri

- **Temuan:** Spesifikasi pengembang rummy menyarankan engine mengenali kombinasi saat pemain menggeser kartu untuk mencegah error yang membuat frustrasi. Hearthstone: kalau teks kartu tidak langsung dipahami, ubah kata-katanya. Tombol mati di sini sudah disertai alasan.
- **Prinsip:** P6.
- **Usulan:** Saat memilih kartu untuk diturunkan atau untuk kombinasi mulung, tampilkan lencana kecil: "Seri ✓", "Kembar As ✓", atau "Belum jadi: <alasan dari AturanError>".
- **Implementasi:** Setiap kali pilihan berubah (debounce 50 ms), panggil `validasiKartuJadi`/`validasiTurunkan` yang sudah diekspor engine dalam `try/catch`. Tidak ada logika aturan baru di UI.
- **Validasi:** Frekuensi aksi turunkan yang ditolak per putaran turun ≥ 50%; lencana tidak pernah muncul untuk kartu lawan.
- **Sumber:** https://game-developement.odoo.com/blog/rummy-game-development-company-45/how-ui-ux-enhances-player-engagement-in-rummy-game-development-641 ; https://hearthstone.wiki.gg/wiki/Bad_cards ; https://game-solver.com/rummikub/
- **[Pagar]** Lencana hanya menilai kombinasi yang dipilih pemain sendiri, tidak pernah menyarankan strategi atau menandai kartu "berbahaya".

### BM7. Urutkan kartu dengan transisi

- **Temuan:** Aplikasi rummy menjual "sort cards at the touch of a button", tombol sortir sebaiknya dekat tangan; reviewer Rummikub mengeluhkan kartu yang menyusun diri tanpa kendali. Tombol ⇅ di sini sudah ada, tapi kartu melompat tanpa transisi.
- **Prinsip:** P2. Pemain bisa melacak kartunya saat diurutkan.
- **Usulan:** Kartu meluncur dari slot lama ke slot baru 220 ms `Cubic.easeInOut` dengan stagger 12 ms; label mode aktif ("Urut: Bunga") 1 s; saat drag manual, kartu lain bergeser memberi celah. Kartu baru tetap ditaruh di kanan tanpa mengacak urutan manual (perilaku sekarang dipertahankan).
- **Implementasi:** Simpan posisi lama sebelum gambar ulang; tween dari posisi lama kalau berbeda. Kosmetik, di luar antrian peristiwa.
- **Validasi:** Pemain mengingat posisi satu kartu, tekan ⇅, lalu menunjuknya: waktu turun ≥ 30%; FPS ≥ 55 di HP kelas menengah.
- **Sumber:** https://forums.imore.com/iphone-apps-games/233390-rummikub-original-lite-iphone-announcement-print.html ; https://game-solver.com/rummikub/ ; https://game-developement.odoo.com/blog/rummy-game-development-company-45/how-ui-ux-enhances-player-engagement-in-rummy-game-development-641

### BM8. Emote yang ramah, bisa dibisukan

- **Temuan:** Hearthstone hanya memberi emote preset untuk meminimalkan pelecehan, dan menyediakan "Squelch" (bisukan lawan tanpa notifikasi). Riset Univ. Jyväskylä: emote terbatas pun tetap dipakai menyindir. `DAFTAR_EMOTE` di sini sudah sesuai pola preset.
- **Prinsip:** Meja tetap ramah seperti tongkrongan.
- **Usulan:** Bisukan per pemain lewat tahan-tekan panel (lokal saja); opsi global "Sembunyikan emote & celetukan bot"; cooldown kirim emote di client.
- **Implementasi:** `Set<pemainId>` dibisukan di client; pemutar melewati emote dari pemain yang dibisukan.
- **Validasi:** Uji dua origin (localhost dan 127.0.0.1): B membisukan A, emote A tidak tampil di B tapi tetap tampil di pemain lain.
- **Sumber:** https://hearthstone.wiki.gg/wiki/Emote ; https://hearthstone.wiki.gg/wiki/Hearthstone_etiquette ; https://jyx.jyu.fi/handle/123456789/59973 ; https://game-solver.com/rummikub/
- **Perlu keputusan pemilik:** batas emote di sisi meja (misalnya 5 per 30 s) mengubah `packages/meja/src/meja.ts`, jadi di luar cakupan perubahan presentasi.

### BM9. Getar setara visual dan audio

- **Temuan:** MDN: Vibration API tidak Baseline. Hearthstone memindahkan fisikalitas lewat art, animasi, dan suara, bukan getar.
- **Prinsip:** P6. Pengguna iPhone tidak dirugikan.
- **Usulan:** Setiap getar penting (giliranmu, kepentung, sisa waktu) punya padanan visual dan audio setara: denyut bingkai pemain aktif (3 kali, total sekitar 900 ms) plus nada giliran. Kosakata getar: 1 ketuk 30–40 ms = info, 2 ketuk = perhatian, panjang 160+ ms = klimaks. Detail teknis di AK13.
- **Validasi:** HP diletakkan di meja: tanda giliran disadari ≤ 2 s oleh 5/5 pemain di iPhone (tanpa getar) dan Android.
- **Sumber:** https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API ; https://hearthstone.wiki.gg/wiki/Bad_cards

### BM10. Bingkai meja warung, bukan kasino

- **Temuan:** Hearthstone sengaja memakai metafora kotak permainan fisik dengan elemen yang memantul dan berayun. Engadget mencatat orang mengira pemain Balatro sedang berjudi. detikINET menulis banyak aplikasi remi/gaple adalah judi online berkedok game yang diblokir; Higgs Domino menghentikan fitur kirim koin karena regulasi.
- **Prinsip:** P9.
- **Usulan:** Permukaan kayu atau taplak, papan pengumuman kayu berayun untuk mentung dan akhir putaran, ornamen sudut (gelas kopi, asbak), skor seperti coretan kapur di papan warung. Hindari palet merah-emas kasino, chip, koin, dan angka besar berkesan taruhan. Semua prosedural (Graphics/Canvas), tanpa aset, demi PWA offline. Jangan meniru aset atau identitas game lain.
- **Implementasi:** Latar `Graphics.generateTexture` sekali (serat kayu ber-seed + vignette radial); banner container dengan origin di atas, tween angle −8° → 0° `Elastic.easeOut` 600 ms (ikut setelan gerak); token warna `--kayu`, `--kapur`, `--taplak` di `gaya.css` dibaca Phaser lewat `getComputedStyle`.
- **Validasi:** 5-second test ke 8 orang awam: "game apa ini, dan apakah ini judi?", target ≥ 7 menjawab game kartu santai; FPS ≥ 55; kontras teks di atas kayu ≥ 4,5:1.
- **Sumber:** https://hearthstone.wiki.gg/wiki/Bad_cards ; https://toucharcade.com/2014/11/07/hearthstone-a-conversation-with-devs-at-blizzcon ; https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html ; https://inet.detik.com/games-features/d-6215400/dijamin-bukan-judi-online-ini-game-kartu-remi-dan-gaple-sungguhan ; https://rmol.id/nusantara/read/2024/05/11/619998/hdi-ubah-nama-dan-buka-kembali-akses-unduhan-game

---

## D. Teknik implementasi (Phaser 4.2.1, Web Audio, PWA)

Semua API di bawah sudah dicek riset terhadap `node_modules/phaser/types/phaser.d.ts` (4.2.1) dan skill lokal di `.claude/skills`. Sebelum memakai API baru, cek lagi di `phaser.d.ts`; jangan mengarang API.

### TK1. Ease berupa fungsi untuk pegas

- **Temuan:** Phaser 4 menerima `ease` berupa fungsi `(t) => number`, plus string bawaan (Quad, Cubic, …, Back, Bounce, Stepped). Tidak ada ease 'Spring' bawaan. Ease per properti didukung lewat `TweenPropConfig { value, ease, duration, delay }`.
- **Prinsip:** P2.
- **Usulan:** Pegas teredam untuk kartu mendarat (scale/y), `x` tetap `Cubic.easeOut`. Durasi pendaratan 380–480 ms.
- **Implementasi:** `easePegas()` di `gerak.ts`; contoh `{ x: { value, ease: 'Cubic.easeOut' }, y: { value, ease: easePegas(0.6, 13) }, duration: 440 }`. Timeout cadangan ≥ durasi + 300 ms.
- **Validasi:** Overshoot ≤ 6% skala dan settle sebelum 450 ms; unit test f(0)=0, |f(1)−1| < 0,002, maks f antara 1,02 dan 1,08.
- **Sumber:** `.claude/skills/tweens/SKILL.md` ; `node_modules/phaser/types/phaser.d.ts` (TweenBuilderConfig `ease?: string | Function`)

### TK2. Tween chain, bukan callback bersarang dan `setTimeout` di tengah

- **Temuan:** `pentung()` dan `naikPanggung()` menyusun tahapan lewat 4–5 level `onComplete` bersarang plus `setTimeout(…, 1100)` di tengah. Phaser 4 punya `this.tweens.chain({ targets, tweens: [...] })`; tiap entry adalah TweenBuilderConfig biasa sehingga callback per entry tetap jalan (disimpulkan dari `TweenChainBuilder.js`, belum diuji runtime). `setTimeout` di tengah tidak ikut `timeScale`, tidak ikut pause, dan berjalan di luar jam game.
- **Prinsip:** P4, P5. Satu urutan yang bisa dipercepat utuh.
- **Usulan:** Tulis ulang pentung sebagai satu chain: lempar tertutup → getar → flip 1 (tukar tekstur + bunyi) → flip 2 → tahan (`delay` di entry turun) → turun ke buangan. Nilai berbentuk fungsi dievaluasi saat tween anak mulai.
- **Implementasi:** Fallback `setTimeout` di luar chain tetap ada (wajib), dihitung dari total durasi dibagi `tweens.timeScale`.
- **Validasi:** Mentung offline: urutan, bunyi, dan label identik dengan versi lama; `adegan.tweens.timeScale = 2` di konsol membuat seluruh sekuens 2× lebih cepat tanpa jeda tertinggal; tab latar belakang tidak membuat antrian macet.
- **Sumber:** `.claude/skills/tweens/SKILL.md` ; `node_modules/phaser/src/tweens/builders/TweenChainBuilder.js` ; `phaser.d.ts` `chain(tweens: TweenChainBuilderConfig)`

### TK3. Stagger untuk bagi kartu

- **Temuan:** `this.tweens.stagger(value, { from, ease, grid })` dipakai sebagai nilai `delay`; hanya berefek kalau tween punya banyak target.
- **Usulan dan implementasi:** Lihat GF12. Satu tween banyak target (punggung kartu di `lapisan`), `x`/`y` berupa fungsi per indeks, `delay: this.tweens.stagger(70)`, cadangan `70 × n + 260 + 400` ms. Batasi jumlah kartu terbang supaya total < 1,5 s.
- **Validasi:** 4 dan 6 pemain offline: dari `mulaiPutaran` sampai popup joker siap ≤ 1,6 s; tidak ada kartu dobel; `document.hidden` → resolve langsung.
- **Sumber:** `.claude/skills/tweens/SKILL.md` ; `phaser.d.ts` `stagger(value: number | number[], config?: StaggerConfig): Function`
- **[Pagar]** Sama dengan GF12.

### TK4. Tint di Phaser 4

- **Temuan:** Di Phaser 4 tint dan mode tint dipisah: `setTint(color)` + `setTintMode(Phaser.TintModes.MULTIPLY | ADD | SCREEN | FILL | OVERLAY | HARD_LIGHT)`. `setTintFill()` sudah dihapus. Tint hanya di WebGL (game memakai `Phaser.AUTO`, hampir selalu WebGL).
- **Usulan dan implementasi:** Helper `balikKartu` di GF7 memakai tint MULTIPLY untuk menggelapkan saat miring, `clearTint()` di akhir. Fallback Canvas aman karena tint diabaikan.
- **Validasi:** `img.isTinted === false` setelah flip; total flip ≤ 340 ms; ukuran sama setelah `setTexture` + `setDisplaySize`.
- **Sumber:** `.claude/skills/game-object-components/SKILL.md` ; `phaser.d.ts` `Components.Tint.setTintMode`

### TK5. Umpan balik pointer dan `wasTouch`

- **Temuan:** Kartu tangan memakai `setInteractive({ useHandCursor: true, draggable: true })` tanpa umpan balik tekan. Pada sentuhan, `pointerover` terjadi bersamaan dengan `pointerdown`; `Pointer.wasTouch` membedakan sentuh dari mouse. Nielsen: di bawah 0,1 detik pengguna merasa memanipulasi objek langsung.
- **Usulan:** Lihat GF1 dan BM1. Hover (naik 4 px) hanya kalau `!pointer.wasTouch`; efek tekan dibatalkan di `dragstart`. Tik getar 8–10 ms opsional di Android.
- **Implementasi:** `gambar()` menghancurkan objek, dan tween dengan target yang sudah dihancurkan selesai sendiri (skill tweens), jadi aman.
- **Validasi:** Slow-mo 240 fps: sentuh sampai kartu mengecil ≤ 100 ms; di HP tidak ada kartu tertinggal di posisi hover.
- **Sumber:** `.claude/skills/input-keyboard-mouse-touch/SKILL.md` ; https://www.nngroup.com/articles/response-times-3-important-limits/

### TK6. Pool objek untuk gambar ulang

- **Temuan:** `gambar()` menghancurkan dan membuat ulang semua Image, Text, dan Graphics setiap model berubah; tiap Text punya canvas sendiri, dan Graphics membangun ulang geometri (skill menyarankan `generateTexture` untuk bentuk statis). `setResolution(dpr)` justru menggandakan resolusi dua kali karena font sudah dikali dpr.
- **Prinsip:** Performa stabil di HP kelas bawah.
- **Usulan:** Pertahankan arsitektur gambar ulang total, tapi ambil objek dari pool per jenis; `Text.setText()` hanya me-render ulang kalau isi atau gaya berubah; panel rounded-rect dibake ke tekstur; tween berdenyut di-kill eksplisit sebelum objek dipakai ulang. Bulatkan posisi teks; jangan pakai `setResolution`.
- **Implementasi:** Kelas `Pool<T>` dengan `mulai()`, `ambil()` (lepas listener, `setVisible(true)`), `sembunyikanSisa()`.
- **Validasi:** HP Android menengah, tempo bot cepat, 6 pemain: durasi `gambar()` < 4 ms, tanpa jank > 50 ms, jumlah tween stabil, interaksi tidak terduplikasi.
- **Sumber:** `.claude/skills/graphics-and-shapes/SKILL.md` ; `.claude/skills/text-and-bitmaptext/SKILL.md` ; `node_modules/phaser/src/gameobjects/text/TextStyle.js`

### TK7. Partikel untuk momen heboh

- **Temuan:** `this.add.particles(x, y, texture, config)` mengembalikan ParticleEmitter langsung. Mode burst: `emitting: false` + `explode(count, x, y)`. `reserve(count)` mencegah lonjakan GC; `maxAliveParticles` membatasi yang terlihat.
- **Usulan:** Satu emitter percik dibuat sekali di `create()` dan dimasukkan ke `lapisan` (tidak ikut dihancurkan `gambar()`), tekstur titik prerender. Dipicu hanya untuk peristiwa publik: kembar As, sapu bersih, mentung, mulung beruntun ≥ 3. Dilewati saat kurangi gerak atau efek hemat.
- **Implementasi:** `reserve(60)`, `maxAliveParticles: 60`, `explode(24, x, y)`.
- **Validasi:** Burst 24 partikel menambah frame time < 2 ms tanpa GC minor; emitter tetap ada setelah banyak gambar ulang.
- **Sumber:** `.claude/skills/particles/SKILL.md` ; `phaser.d.ts` (`reserve`, `explode`)
- **[Pagar]** Tidak pernah dipicu dari info tersembunyi seperti angka joker.

### TK8. Gerak dikurangi dan `timeScale` yang aman

- **Temuan:** `this.tweens.timeScale` / `setGlobalTimeScale` mengalikan semua tween, `this.time.timeScale` untuk timer Clock, tapi fallback `setTimeout` (wajib menurut AGENTS.md) tidak ikut skala. Kalau `timeScale < 1`, fallback memotong animasi.
- **Usulan dan implementasi:** Lihat AK5. Satu helper `cadangan(fn, ms)` yang membagi `ms` dengan `max(0.25, tweens.timeScale)`; dengarkan `matchMedia('(prefers-reduced-motion: reduce)')` untuk beralih tanpa reload.
- **Validasi:** Lihat AK5.
- **Sumber:** https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion ; `.claude/skills/tweens/SKILL.md` ; `.claude/skills/time-and-timers/SKILL.md`

### TK9. Bus audio dan limiter

- **Temuan:** `suara.ts` menghubungkan setiap node langsung ke `destination`: tanpa bus master, tanpa pemisahan efek dan musik, tanpa limiter. Akord sorak/mentung bisa clipping. Pengaturan dibaca dari localStorage di setiap bunyi. MDN: DynamicsCompressorNode membantu mencegah clipping saat banyak bunyi digabung.
- **Prinsip:** P8.
- **Usulan:** Satu AudioContext (lazy) dengan `busEfek` dan `busMusik` → `master` → limiter → `destination`. Pengaturan dibaca dari cache `preferensi()` dan diperbarui lewat `saatPreferensiBerubah`. Mematikan suara = ramp master ke 0 lalu `suspend()`.
- **Implementasi:** Limiter sekitar threshold −1 dB, knee 0, ratio 20, attack 0,001 s, release 0,1 s (pola umum, bukan dari spesifikasi); `setTargetAtTime` untuk perubahan volume tanpa klik.
- **Validasi:** Picu mentung + sorak + buang bersamaan, rekam output, tidak ada sampel menyentuh 0 dBFS; toggle suara 10× tanpa klik; tidak ada `localStorage.getItem` per bunyi.
- **Sumber:** https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode ; https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime

### TK10. Burst derau yang di-cache dan dibatasi

- **Temuan:** `desis()` membuat AudioBuffer baru setiap bunyi, mulai dengan gain penuh (rawan klik), bandpass Q 1, dan bunyinya identik. Tidak ada batas frekuensi pemicu. Resep: klik derau 8 ms, peluruhan eksponensial, bandpass 4–5 kHz Q 3; ramp eksponensial tidak boleh ke 0 (pakai 0,001); jitter pitch 0,95–1,05 dan volume 0,85–1,0.
- **Usulan:** Satu buffer white noise 1 detik saat context dibuat, putar potongan acak dengan `playbackRate` 0,92–1,08; envelope mini (attack 2–4 ms); bandpass Q 2–4 dengan frekuensi ±8%; bunyi baru "kocok" dan "balik"; rate limit per jenis 35–50 ms dan maksimal sekitar 10 suara aktif (yang berlebih dibuang, bukan ditunda).
- **Validasi:** Uji dengar di HP: 20 bunyi kartu beruntun tidak terdengar seperti mesin; tidak ada alokasi Float32Array per bunyi; unit test dengan mock AudioContext (10 panggilan dalam 10 ms → 1 burst).
- **Sumber:** https://mintlify.wiki/raphaelsalaja/userinterface-wiki/technical/web-audio-api ; https://bugnet.io/blog/how-to-implement-footstep-variation-to-avoid-repetition ; https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime

### TK11. Membuka audio di iOS dan saat kembali dari latar belakang

- **Temuan:** Unlock audio sekarang hanya satu listener `pointerdown` yang langsung dilepas. Di iOS Safari, AudioContext bisa masuk state 'interrupted' (bukan 'suspended') atau 'running' tanpa suara setelah halaman kembali terlihat; siklus suspend–resume pada `visibilitychange` dilaporkan jadi solusi. Mengubah `navigator.audioSession.type = 'playback'` melewati tombol senyap tapi juga menginterupsi audio aplikasi lain. (Sumber dari WebKit Bugzilla, bukan dokumentasi resmi Apple.)
- **Usulan:** Listener `pointerdown`, `touchend`, dan `keydown` (capture, passive) yang mencoba membuka setiap kali sampai state 'running', dengan buffer hening 1 sampel; `visibilitychange` → suspend saat tersembunyi, resume saat terlihat. Biarkan audioSession bawaan supaya mengikuti tombol senyap.
- **Implementasi:** Bandingkan `state !== 'running'`, bukan `=== 'suspended'` (tipe TS belum memuat 'interrupted').
- **Validasi:** iPhone (Safari dan PWA): bunyi jalan, pindah aplikasi 30 detik, kembali, ketuk sekali, bunyi jalan lagi; tombol senyap aktif → bisu; Android: kunci layar lalu buka, bunyi kembali tanpa reload.
- **Sumber:** https://bugs.webkit.org/show_bug.cgi?id=263627 ; https://bugs.webkit.org/show_bug.cgi?id=276016 ; https://bugs.webkit.org/show_bug.cgi?id=291892 ; https://developer.mozilla.org/docs/Web/API/AudioSession/type ; https://www.w3.org/TR/audio-session/

### TK12. Musik latar generatif yang pelan

- **Temuan:** Teknik "A Tale of Two Clocks": timer JS menjadwalkan nada dalam jendela lookahead pada jam audio (`currentTime`), sehingga presisi walau main thread sibuk. Timer di tab latar belakang diperlambat browser.
- **Usulan:** Musik pelan (bawaan mati, sesuai preferensi `musik: false`): pad pentatonik D mayor dari dua osilator triangle di-detune ±6 cent, lowpass 1600 Hz, ke `busMusik`. Opsional suasana kedai berupa brown noise sangat pelan. Berhenti saat `document.hidden`.
- **Implementasi:** `setInterval` 200 ms dengan lookahead 1,5 s (musiknya tidak interaktif); osilator di-stop supaya tidak bocor.
- **Validasi:** 30 menit di HP: CPU < 2%, node tidak bocor, tidak ada nada dobel saat Phaser sibuk; 3–5 pemain menilai "mengganggu atau tidak" setelah 2 putaran.
- **Sumber:** https://web.dev/articles/audio-scheduling ; https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
- **[Pagar]** Intensitas musik hanya boleh mengikuti status publik (misalnya susun akhir), tidak pernah isi tangan.

### TK13. Preferensi yang tervalidasi

- **Temuan:** Penyimpanan lama menggabungkan default dengan spread tanpa validasi tipe, membaca localStorage di setiap bunyi, dan tidak punya field volume, musik, atau gerak.
- **Status:** **Sudah dikerjakan** di `apps/client/src/preferensi.ts` (normalisasi per field, cache, pendengar perubahan, migrasi dari `remi.efek`).
- **Validasi lanjutan:** Unit test `normalkan()` untuk input null, string rusak, angka di luar 0..1, nilai enum aneh, dan objek lama `{ suara: false }`; mode privat Safari (localStorage melempar error) tetap jalan dengan bawaan; sinkron antar tab lewat event `storage` kalau diperlukan.
- **Sumber:** https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate ; AGENTS.md (simpanan lama harus tetap bisa dilanjutkan)

### TK14. Update PWA tanpa memotong putaran

- **Temuan:** `registerType: 'autoUpdate'` memaksa `skipWaiting` dan `clientsClaim`, lalu tab yang terbuka di-reload otomatis saat versi baru terdeteksi. Dokumentasi vite-plugin-pwa memperingatkan risiko kehilangan state dan menyarankan mode `prompt`. Untuk game ini, meja bisa reload di tengah putaran.
- **Usulan:** Ganti ke `registerType: 'prompt'`. Saat ada versi baru: kalau pemain di beranda, lobi, atau di antara putaran, tampilkan toast "Ada versi baru, Bos. Muat ulang?"; saat putaran berjalan atau susun akhir, tunda sampai jeda. `onOfflineReady` cukup toast sekali. Cek update berkala 1 jam (fetch `swUrl` no-store, `r.update()` hanya kalau online dan status 200). Tampilkan versi (`labelVersi()`) di menu supaya mudah dicek.
- **Implementasi:** `registerSW({ onNeedRefresh, onOfflineReady, onRegisteredSW })` di `main.ts`; pertahankan `cleanupOutdatedCaches`.
- **Validasi:** Deploy versi A ke staging HTTPS, mulai putaran offline di PWA terpasang, deploy versi B: halaman tidak reload sendiri selama putaran; toast muncul setelah putaran selesai; "Muat ulang" memuat B (cek label versi); DevTools → Application → Service Workers: SW baru 'waiting' sampai pengguna setuju.
- **Sumber:** https://vite-pwa-org.netlify.app/guide/auto-update ; https://vite-pwa-org.netlify.app/guide/prompt-for-update ; https://vite-pwa-org.netlify.app/guide/periodic-sw-updates

---

## Keputusan yang perlu pemilik

Usulan berikut menyentuh perilaku meja, kebiasaan main, atau selera tongkrongan. Jangan dikerjakan sebagai bawaan sebelum ada keputusan pemilik, dan catat di tabel Aturan Terbuka README kalau menyangkut aturan atau perilaku meja.

| Usulan | Kenapa perlu keputusan | Rujukan | Status 0.2.0 |
|---|---|---|---|
| Flick (lempar cepat) untuk membuang | Rawan salah buang; kalau ada, opsi dengan bawaan mati | GF8 | Tidak dibuat |
| Mode kipas tangan dan bawaannya | Mengubah keterbacaan tangan; selera pemain | riset game feel (kipas CSS 3D) | Kipas tipis maksimal ±4° jadi bawaan tanpa opsi; perlu konfirmasi pemilik |
| Tingkat efek bawaan (lengkap/hemat) | Selera dan kenyamanan pemain kedai | GF9 | Bawaan "lengkap", bisa diganti di Pengaturan; perlu konfirmasi pemilik |
| Animasi kocok/bagi lewat peristiwa baru | Peristiwa baru = perubahan engine | GF12 | Tidak perlu: dipicu peristiwa `mulaiPutaran` yang sudah ada, urutan bagi sama dengan engine |
| Perpanjangan waktu atau perubahan durasi giliran | Mengubah perilaku meja | AK8 | Tidak diubah |
| Daftar pintasan keyboard | Kebiasaan main | AK9 | Sudah dipakai sebagai bawaan (D/M/T/B/J/K/S/U/H, 1–9, `?`); perlu konfirmasi pemilik |
| Batas emote di sisi meja | Mengubah `packages/meja` | BM8 | Tidak diubah (tetap 1 per 1,2 dtk) |
| "Ulangi pengumuman joker" atau fitur serupa | Melewati mode ingatan | Pagar info rahasia | Tidak dibuat; terkait #34 di [keputusan-pemilik.md](keputusan-pemilik.md#k34) |

## Catatan dari pembacaan kode (perlu dicek pemilik)

Riset aksesibilitas menemukan dua hal di client yang mungkin bersinggungan dengan keputusan mode ingatan. Keduanya **belum diubah** dan sekarang tercatat sebagai baris Aturan Terbuka README yang menunggu keputusan pemilik:

1. `efek/pemutar.ts` menampilkan sorakan "JOKER DIBUANG?!" beserta nama kartunya. Lihat [#28](keputusan-pemilik.md#k28).
2. Panel pemain mencatat aksi giliran seperti "buang 7♥". Lihat [#29](keputusan-pemilik.md#k29).

Audit rilis 0.2.0 menambah beberapa temuan sejenis (label "→rank" dan log "(X jadi Y)", angka joker di setiap view, peristiwa yang membawa kartu buangan tertimbun). Semuanya dirinci di [keputusan-pemilik.md](keputusan-pemilik.md).

## Keterbatasan riset

- Angka "ala Balatro" (hover, shake, nada) berasal dari panduan pihak ketiga dan port Godot, bukan konfirmasi pengembang. Perlakukan sebagai titik awal tuning.
- Talk GDC ("Juice it or lose it", Eiserloh, Vlambeer) diambil dari ringkasan sekunder; paper Kao (2020) tidak dibaca langsung, jadi ukuran efeknya tidak diketahui.
- Beberapa halaman primer menolak akses (TouchArcade, GameGeeker, Family Gaming Database); untuk itu hanya cuplikan hasil pencarian yang dipakai.
- Rasio kontras dihitung manual dari rumus luminance WCAG dan perlu diverifikasi dengan alat.
- Default volume yang diusulkan bukan dari sumber; perlu uji di kedai.
- Dukungan Vibration API di iOS, perilaku audio iOS, dan biaya filter Shadow belum diukur di perangkat sungguhan.
- Tidak ditemukan ulasan mendalam tentang UI aplikasi remi lokal (Higgs Domino, Remi King, ZingPlay); validasi lokal tetap lewat uji pemain di Kedai Madya.
