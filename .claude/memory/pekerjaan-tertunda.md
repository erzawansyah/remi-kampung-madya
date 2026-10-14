# Pekerjaan tertunda

Diperbarui: 14 Okt 2026. Hapus butir yang sudah selesai, tambahkan yang baru.

## Latar

Rilis 13 Okt 2026 (keputusan pemilik #25–#31, update otomatis PWA di momen aman, jembatan `public/sw-transisi.js` untuk pemain 0.1.x) sudah di-merge ke `main` (PR #2, `3fc382a`) dan tayang. Saat rilis itu terpasang, semua HP yang sedang membuka game dimuat ulang sekali (disengaja, supaya pemain 0.1.0 ikut pindah).

## Belum selesai

1. **`/healthz` live masih `"sha":"dev"`.** Agent deploy belum mengisi `GIT_SHA`, sehingga pencocokan build client↔server di `pembaruan.ts` dilewati. Dua jalan (bisa dua-duanya):
   - Minta pemilik meneruskan ke agent deploy-nya: `GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build` (sudah tertulis di `docs/deploy.md`).
   - Identitas build otomatis tanpa `GIT_SHA` (misalnya hash isi build), yang **sama** di client (`apps/client/vite.config.ts`) dan server (`apps/server/scripts/bundel.mjs`). Saat ini keduanya jatuh ke `'dev'` di Docker karena `.git` tidak ikut.
2. **CHANGELOG `[Belum dirilis]` belum mencatat rilis 13 Okt:** keputusan pemilik (teks buang "buang kartu", kartu kembar sebagai joker pengganti, masa tenggang sambung ulang 20 dtk, popup joker muncul lagi saat sambung ulang, dll.), update otomatis di momen aman, dan jembatan 0.1.x. Lihat `git show a13429f --stat` dan `docs/keputusan-pemilik.md`.
3. **Uji transisi 0.1.0 → versi baru di browser sungguhan.** Baru diuji unit test (`swTransisi.test.ts`, `simpananLama.test.ts`). Cara: build 0.1.0 dari commit `8588853` di worktree, sajikan di origin yang sama, buka, lalu ganti ke build baru dan pastikan halaman dimuat ulang sekali dan simpanan offline tetap bisa dilanjutkan.
4. **Cek versi server setelah meja bubar:** pastikan cek `/healthz` sesudah meja bubar tidak tertahan jeda minimum `JEDA_CEK_MIN_MS` (`apps/client/src/main.ts` `cekServer`, `apps/client/src/pembaruan.ts`). Belum diverifikasi.

## Sudah selesai (dicek 14 Okt 2026, jangan dikerjakan ulang)

- Sub-teks sorakan "TINGGAL 1 KARTU!" sudah netral, tanpa "siap mentung" (keputusan #30).
- FAQ masa tenggang sudah menyebut "dihitung sejak kamu terputus".
- Petunjuk `GIT_SHA` dan cek `/healthz` sudah ada di `docs/deploy.md`.
- Momen "tidak" untuk pembaruan sudah mencakup panel mentung dan klasemen akhir yang sedang tampil.
