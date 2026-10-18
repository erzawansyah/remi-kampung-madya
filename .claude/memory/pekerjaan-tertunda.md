# Pekerjaan tertunda

Diperbarui: 18 Okt 2026. Hapus butir yang sudah selesai, tambahkan yang baru.

## Latar

Rilis 13 Okt 2026 (keputusan pemilik #25–#37 dan #39, update otomatis PWA di momen aman, jembatan `public/sw-transisi.js` untuk pemain 0.1.x) sudah di-merge ke `main` (PR #2, `3fc382a`) dan tayang. Saat rilis itu terpasang, semua HP yang sedang membuka game dimuat ulang sekali (disengaja, supaya pemain 0.1.0 ikut pindah).

Batch 14 Okt 2026 (level warga kedai Jago dan Suhu, 12 nama warga kedai baru, bunyi dramatis, identitas build otomatis, cek versi paksa sesudah sambungan pulih, keputusan #38) sudah di-merge pemilik ke `main` (PR #4, `65789db`). Sesudahnya PR #5 (`615cef1`, Jago/Suhu tampil namanya saja) juga tayang: `/healthz` live = `"versi":"0.2.0","sha":"h-644fdbe"` (dicek 16 Okt 2026). Versi tetap 0.2.0; semuanya masih di CHANGELOG `[Belum dirilis]`.

16 Okt 2026 pemilik memberi tujuh permintaan sesudah main bareng di kedai, dan memutuskan #40–#47 plus #20–#23 (rincian: `docs/keputusan-pemilik.md`). Rencananya dibagi tiga rilis (masing-masing PR sendiri dari `produksi` ke `main`):
- **Rilis A** (tanpa perubahan aturan main): leaderboard baru (#45), batas skor bebas kelipatan 10 (#44), tombol pasang melayang (#46), perbaikan kecil (toast koneksi, cek `/healthz` di setiap sambungan, inisial pembuang di buangan, komentar golden), dan pencatatan keputusan. **Sudah tayang 16 Okt 2026:** PR #6 di-merge ke `main` (`e2eae81`, termasuk `344ae2e` tombol pasang satu baris di layar < 360 px). Dicek dari luar: `/healthz` = `"versi":"0.2.0","sha":"h-e29404c"` (sama dengan hash isi pohon `344ae2e`), `/api/peringkat` masih array, `/api/peringkat?v=2&urut=rata` objek.
- **Rilis B** (aturan baru #40 joker beda dari putaran sebelumnya, #41 mentung pakai beberapa joker, #42/#43 mode kaldu; rinci di `docs/keputusan-pemilik.md`). **Sudah tayang 17 Okt 2026:** PR #7 di-merge pemilik ke `main` (`86591d8`, isi pohonnya sama dengan `3bebe0f` di `produksi`). Dicek dari luar 17 Okt 2026: `/healthz` = `"versi":"0.2.0","sha":"h-282dcd2"` (sama dengan hash isi pohon `86591d8`). #41 dan mode kaldu baru dicek di Chromium emulasi HP dan desktop (lihat butir 5).
- **Rilis C** (gaya main warga kedai per persona, #47; `bot/gaya.ts`, `packages/meja/src/gayaWarga.ts`, hasil arena dan kompromi di `docs/keputusan-pemilik.md` #47). **Sudah tayang 17 Okt 2026:** PR #8 di-merge pemilik ke `main` (`b44ef39`, isi pohonnya sama dengan `e9ff5fc`). Dicek dari luar: `/healthz` = `"versi":"0.2.0","sha":"h-2ccca73"` (sama dengan hash isi pohon `b44ef39`), `/api/peringkat` masih array, `?v=2` objek. `produksi` sudah di-fast-forward ke `b44ef39`. Semua ini sekarang dicatat sebagai versi **0.3.0** (keputusan #50).
- **Rilis D = 0.4.0** (18 Okt 2026, permintaan pemilik sesudah Rilis C): Riwayat ringkas, Bantuan diperbarui, celetukan warga Madya + pesan bebas (#48), nama wajib dan ganti seminggu sekali di HP (#49), penomoran versi (#50). **Sudah tayang 18 Okt 2026:** PR #9 di-merge pemilik ke `main` (`1e62637`, isi pohonnya sama dengan `0578f2c`). Dicek dari luar: `/healthz` = `"versi":"0.4.0","sha":"h-15ef312"` (sama dengan hash isi pohon `1e62637`). GitHub menghapus branch `produksi` sesudah merge; dibuat ulang dari `main`. Tag `v0.3.0` (`b44ef39`) dan `v0.4.0` (`1e62637`) dipasang pemilik lewat GitHub Releases (push tag dari sesi Claude ditolak 403, sesi hanya boleh push ke `produksi`; untuk rilis berikutnya siapkan judul dan deskripsi rilis, pemilik yang memasang).

## Belum selesai

0. **Sisa cek sesudah Rilis A tayang** (yang dari luar sudah dicek, lihat Latar): minta pemilik melihat log server memuat `skema riwayat dimigrasi v0 → v1` (butuh akses server), lalu coba tombol pasang di HP sungguhan (lihat butir 5). Cadangan `VACUUM INTO` sebelum migrasi sudah terlambat; kalau pemilik sempat mengambilnya, simpan saja.
1. **Sisa cek sesudah Rilis B tayang:** coba nutup pakai dua joker dan satu permainan mode kaldu di HP sungguhan (lihat butir 5).
2. **Sesudah Rilis C tayang** (#47): tabel nama → gaya, catatan arena, dan ajakan mencoba sudah dikabarkan ke pemilik 17 Okt 2026. Tunggu tanggapan sesudah pemilik dan teman-teman main lawan warga kedai (masih gampang dibaca? ada yang terasa aneh?).
   - Koreksi pemetaan nama → gaya cukup di `GAYA_WARGA`. Golden meja bergeser kalau gaya Kipas Dua atau Cak Kopag diubah.
   - Kalau masih terasa terbaca: penahanan As/Londo sekarang hanya selama 45% awal deck (di meja 4–6 pemain efeknya terutama menunda 1–3 giliran). Pilihannya batas itu diacak per putaran (misalnya 30–70%) atau biasnya diturunkan bertahap, lalu diukur ulang di arena (golden meja ikut bergeser). Kompromi lain yang sudah dikabarkan: Kilat tidak mengurangi deck habis, Penahan Normal lebih sering membuang As daripada standar, disuap Penahan Suhu turunnya tidak signifikan.
   - Warga Normal bergaya sedikit lebih lemah dari Normal lama (±4 poin per putaran di meja 4 pemain): **diputuskan pemilik 17 Okt 2026, biarkan**.
3. **Minta konfirmasi pemilik** (tafsiran pengembang, belum dijawab):
   - **Kabarkan bersama PR Rilis B** (keputusan kecil pengembang di teks meja mode kaldu, di luar daftar teks rencana): baris "Putaran berikutnya kaldu." di modal hasil sesudah voting/batas putaran tercapai, bar atas "Putaran 6 · Kaldu" tanpa "/batas", dan "· kaldu" di riwayat putaran. Hapus kalau pemilik mau teks meja hanya yang ada di rencana.
   - #43: mode kaldu tidak memakai batas skor (tafsiran komentar "Tidak ada batas skor").
   - #47: kelompok "berubah-ubah" memakai salah satu dari lima gaya, berganti tiap putaran.
   - **Kabarkan bersama PR Rilis A** (perbaikan sesudah tinjauan, bukan aturan baru): mentung/kepentung yang keluar di tengah permainan hanya dihitung dari putaran sebelum ia keluar (#45); tombol pasang melayang belum muncul di kunjungan pertama selama kartu "Warga baru, ya?" tampil (#46).
4. **Saran ke pemilik (opsional):** isi `GIT_SHA` di skrip penerima webhook (contoh di `docs/deploy.md`, bagian "Identitas build") supaya Tentang dan `/healthz` menampilkan kode commit, bukan `h-…`.
5. **Uji di HP sungguhan:**
   - Rilis D (0.4.0): kirim pesan sendiri dan celetukan baru di meja online (gelembung panjang, papan ketik HP tidak menutupi isian), dan kunci nama (isi pertama, ganti, terkunci 7 hari).
   - Rilis B (sudah tayang): nutup pakai dua joker (pilih semua sisa kartu, tombol "Mentung pakai 2 kartu!", juga seret) dan satu permainan mode kaldu sampai putaran kaldu ditutup mentung. Baru dicek di Chromium emulasi HP dan desktop.
   - Alur pasang aplikasi (#46): Android Chrome (prompt dan dialog menu ⋮) dan iPhone Safari (Bagikan → Tambah ke Layar Utama), termasuk dari browser bawaan Instagram/WhatsApp. Baru diuji unit test dan emulasi Chrome.
   - Transisi 0.1.0 → versi baru. Baru diuji unit test (`swTransisi.test.ts`, `simpananLama.test.ts`). Cara: build 0.1.0 dari commit `8588853` di worktree, sajikan di origin yang sama, buka, lalu ganti ke build baru dan pastikan halaman dimuat ulang sekali dan simpanan offline tetap bisa dilanjutkan.
   - Lama mikir Jago/Suhu (di komputer pengembang p99 < 7 ms, terburuk 26–41 ms; tangan > 14 kartu jatuh ke strategi normal lewat `BATAS_TANGAN_KUAT`; HP diperkirakan 4–5× lebih lambat, dan di mode offline bot jalan di main thread browser), dan biaya menjadwalkan bunyi besar (±20–25 ms di CPU yang diperlambat 4x).
6. **Kecil, opsional:** di HP 360 × 780 dengan 6 pemain, label pembuang di bawah kartu buangan yang tertimpa (bukan yang teratas) tetap tersembunyi, **dengan teks biasa maupun teks besar**: celahnya ±11–15 px CSS, jadi inisial berhuruf lebar (MM, MS, CO) 9 px pun tidak muat. Teks biasa: hanya "AK" dan "OG" yang tampil; teks besar: hanya nama di bawah kartu teratas. Kalau mau diperbaiki, tata letak buangan yang harus diubah; mengecilkan huruf saja tidak cukup.

## Sudah selesai (dicek 16 Okt 2026, jangan dikerjakan ulang)

- Sub-teks sorakan "TINGGAL 1 KARTU!" sudah netral, tanpa "siap mentung" (keputusan #30).
- FAQ masa tenggang sudah menyebut "dihitung sejak kamu terputus".
- Momen "tidak" untuk pembaruan sudah mencakup panel mentung dan klasemen akhir yang sedang tampil.
- Petunjuk `GIT_SHA` dan cek `/healthz` sudah ada di `docs/deploy.md`.
- Identitas build otomatis (`scripts/idBuild.mjs`): client dan server selalu sama, `GIT_SHA` opsional. Pencocokan `h-…` antara client dan `/healthz` sudah jalan sejak PR #4/#5.
- Penyaring webhook di server pemilik terbukti (riwayat pengiriman webhook GitHub, 14 Okt 2026): push ke `produksi` dijawab `{"status": "ignored"}`, push/merge ke `main` dijawab `{"status": "deploying"}` dan tayang ±1–2 menit kemudian.
- Lama `npm test` sesudah jago/suhu ikut simulasi: ±30–36 dtk di mesin pengembang (61 berkas, 1561 test); job CI "Docker image" ±1 m 50 dtk.
- Keterangan level Jago dan Suhu **dihapus** dari UI atas permintaan pemilik (14 Okt 2026): namanya saja, tanpa "(susah)"/"(susah banget)" dan tanpa penjelasan cara main (`levelWarga.ts`, Bantuan, CHANGELOG pemain). Jangan ditambahkan lagi tanpa izin pemilik.
- CHANGELOG `[Belum dirilis]` sudah mencatat rilis 13 Okt, batch 14 Okt, dan Rilis A.
- Cek versi server: dipaksa di setiap sambungan online yang berhasil, termasuk yang pertama (`PemicuCekServer`), dan saat meja terakhir sudah tidak ada ("Meja X nggak ketemu."). Dijaga `cekVersiServer.test.ts`.
- Toast koneksi di lobi: "Koneksi putus…" sekali per putus dan "Tersambung lagi." akhirnya muncul (`KabarKoneksi` di `koneksi.ts`); pengumuman pembaca layar di meja juga tidak diulang tiap percobaan sambung ulang.
- Inisial pembuang di bawah buangan ('MM', 'MS', 'CO') tidak lagi dipilih lalu disembunyikan karena salah kira lebar: `kiraLebarLabel()` + inisial dikecilkan sampai 9 px. Hasilnya tampil di HP 390 teks besar dan 360 × 640; di 360 × 780 masih tersembunyi (butir 6).
- Keputusan #38 (galat di timer warga kedai/meja) sudah diperbaiki di `packages/meja` (`galat-bot.test.ts`).
- Pemilik sudah menanggapi (16 Okt 2026): bunyi dramatis dan bunyi pentung joker "kayaknya sudah oke"; gaya Jago/Suhu yang menahan kartu jadi disetujui; Aturan Terbuka #20–#23 sesuai bawaan.
