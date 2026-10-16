# Pekerjaan tertunda

Diperbarui: 16 Okt 2026. Hapus butir yang sudah selesai, tambahkan yang baru.

## Latar

Rilis 13 Okt 2026 (keputusan pemilik #25–#37 dan #39, update otomatis PWA di momen aman, jembatan `public/sw-transisi.js` untuk pemain 0.1.x) sudah di-merge ke `main` (PR #2, `3fc382a`) dan tayang. Saat rilis itu terpasang, semua HP yang sedang membuka game dimuat ulang sekali (disengaja, supaya pemain 0.1.0 ikut pindah).

Batch 14 Okt 2026 (level warga kedai Jago dan Suhu, 12 nama warga kedai baru, bunyi dramatis, identitas build otomatis, cek versi paksa sesudah sambungan pulih, keputusan #38) sudah di-merge pemilik ke `main` (PR #4, `65789db`). Sesudahnya PR #5 (`615cef1`, Jago/Suhu tampil namanya saja) juga tayang: `/healthz` live = `"versi":"0.2.0","sha":"h-644fdbe"` (dicek 16 Okt 2026). Versi tetap 0.2.0; semuanya masih di CHANGELOG `[Belum dirilis]`.

16 Okt 2026 pemilik memberi tujuh permintaan sesudah main bareng di kedai, dan memutuskan #40–#47 plus #20–#23 (rincian: `docs/keputusan-pemilik.md`). Rencananya dibagi tiga rilis (masing-masing PR sendiri dari `produksi` ke `main`):
- **Rilis A** (tanpa perubahan aturan main): leaderboard baru (#45), batas skor bebas kelipatan 10 (#44), tombol pasang melayang (#46), perbaikan kecil (toast koneksi, cek `/healthz` di setiap sambungan, inisial pembuang di buangan, komentar golden), dan pencatatan keputusan. Dikerjakan di `produksi` 16 Okt 2026; PR ke `main` belum dibuat saat catatan ini ditulis.

## Belum selesai

1. **Rilis B, aturan baru** (sudah diputuskan, belum dikerjakan; rinci di `docs/keputusan-pemilik.md` #40–#43):
   - #40 joker beda dari putaran tepat sebelumnya (anulir, selipkan acak, buka kartu berikutnya; popup tanpa penjelasan anulir).
   - #41 mentung multi-kartu kalau semuanya joker hidup, 250 per joker.
   - #42/#43 Mode kaldu (pentungan ×2 di putaran terakhir, kaldu lagi kalau habis tanpa mentung, voting "putaran berikutnya terakhir", tanpa batas skor).
   - Golden engine bergeser karena #40 (berkas 2 dan 3 pemain wajib tetap); tinjau dan catat di `docs/baseline-gameplay.md`.
2. **Rilis C, gaya warga kedai per persona** (#47): `bot/gaya.ts`, `packages/meja/src/gayaWarga.ts`, diukur di arena dengan syarat di `docs/keputusan-pemilik.md` #47. Menyentuh `aksiKuat`/`rencanaMentung` yang sama dengan Rilis B, jadi dikerjakan sesudahnya. Gaya tidak boleh tampil ke pemain.
3. **Minta konfirmasi pemilik** (tafsiran pengembang, belum dijawab):
   - #43: mode kaldu tidak memakai batas skor (tafsiran komentar "Tidak ada batas skor").
   - #47: kelompok "berubah-ubah" memakai salah satu dari lima gaya, berganti tiap putaran.
4. **Saran ke pemilik (opsional):** isi `GIT_SHA` di skrip penerima webhook (contoh di `docs/deploy.md`, bagian "Identitas build") supaya Tentang dan `/healthz` menampilkan kode commit, bukan `h-…`.
5. **Uji di HP sungguhan:**
   - Alur pasang aplikasi (#46): Android Chrome (prompt dan dialog menu ⋮) dan iPhone Safari (Bagikan → Tambah ke Layar Utama), termasuk dari browser bawaan Instagram/WhatsApp. Baru diuji unit test dan emulasi Chrome.
   - Transisi 0.1.0 → versi baru. Baru diuji unit test (`swTransisi.test.ts`, `simpananLama.test.ts`). Cara: build 0.1.0 dari commit `8588853` di worktree, sajikan di origin yang sama, buka, lalu ganti ke build baru dan pastikan halaman dimuat ulang sekali dan simpanan offline tetap bisa dilanjutkan.
   - Lama mikir Jago/Suhu (di komputer pengembang p99 < 7 ms, terburuk 26–41 ms; tangan > 14 kartu jatuh ke strategi normal lewat `BATAS_TANGAN_KUAT`; HP diperkirakan 4–5× lebih lambat, dan di mode offline bot jalan di main thread browser), dan biaya menjadwalkan bunyi besar (±20–25 ms di CPU yang diperlambat 4x).
6. **Kecil, opsional:** di HP 360 px dengan teks besar dan 6 pemain, label pembuang di bawah kartu buangan yang tertimpa (bukan yang teratas) tetap tersembunyi: celahnya ±11 px CSS, inisial 9 px pun tidak muat. Kalau mau diperbaiki, tata letak buangan yang harus diubah; mengecilkan huruf saja tidak cukup.

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
- Inisial pembuang di bawah buangan ('MM', 'MS', 'CO') tidak lagi disembunyikan karena salah kira lebar: `kiraLebarLabel()` + inisial dikecilkan sampai 9 px.
- Keputusan #38 (galat di timer warga kedai/meja) sudah diperbaiki di `packages/meja` (`galat-bot.test.ts`).
- Pemilik sudah menanggapi (16 Okt 2026): bunyi dramatis dan bunyi pentung joker "kayaknya sudah oke"; gaya Jago/Suhu yang menahan kartu jadi disetujui; Aturan Terbuka #20–#23 sesuai bawaan.
