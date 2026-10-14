# Pekerjaan tertunda

Diperbarui: 14 Okt 2026. Hapus butir yang sudah selesai, tambahkan yang baru.

## Latar

Rilis 13 Okt 2026 (keputusan pemilik #25–#37 dan #39, update otomatis PWA di momen aman, jembatan `public/sw-transisi.js` untuk pemain 0.1.x) sudah di-merge ke `main` (PR #2, `3fc382a`) dan tayang. Saat rilis itu terpasang, semua HP yang sedang membuka game dimuat ulang sekali (disengaja, supaya pemain 0.1.0 ikut pindah).

Batch 14 Okt 2026 dikerjakan di `produksi`: level warga kedai Jago dan Suhu, 12 nama warga kedai baru, bunyi dramatis (mentung, pentung joker, kepentung, joker dibuang), identitas build otomatis, cek versi paksa sesudah sambungan pulih, dan keputusan #38. Semuanya tercatat di CHANGELOG `[Belum dirilis]`. Cek `git log main` untuk tahu sudah di-merge atau belum.

## Belum selesai

1. **Sesudah batch 14 Okt di-merge dan di-deploy:** cek `/healthz` live. `sha` harus `h-` + 7 hex, atau kode commit kalau skrip webhook mengisi `GIT_SHA`; bukan `"dev"`. Saran ke pemilik (opsional): isi `GIT_SHA` di skrip penerima webhook dan saring `ref == refs/heads/main` (contoh di `docs/deploy.md`, bagian "Identitas build"). HP yang masih memakai build ber-sha `dev` belum bisa mencocokkan dengan server; pencocokan `h-…` baru berguna mulai rilis sesudahnya.
2. **Uji transisi 0.1.0 → versi baru di browser sungguhan.** Baru diuji unit test (`swTransisi.test.ts`, `simpananLama.test.ts`). Cara: build 0.1.0 dari commit `8588853` di worktree, sajikan di origin yang sama, buka, lalu ganti ke build baru dan pastikan halaman dimuat ulang sekali dan simpanan offline tetap bisa dilanjutkan.
3. **Menunggu tanggapan pemilik** (rincian di `docs/keputusan-pemilik.md`, "Catatan lain"):
   - Bunyi khusus pentung joker (`mentungJoker`). Pemilik juga belum mendengar bunyi dramatis yang baru; minta dicoba di HP dan dikomentari (terlalu keras, kurang nendang, terlalu seram).
   - Gaya Jago/Suhu yang menahan kartu jadi di tangan sampai susun akhir.
   - Aturan Terbuka #20–#23 (susun akhir) masih "perlu konfirmasi" di README.
4. **Toast koneksi di lobi:** "Tersambung lagi." (`main.ts`, `saatStatusBerubah`) tidak pernah muncul karena status tepat sebelum `tersambung` selalu `menyambung` (sebab yang sama dengan bug cek versi yang sudah diperbaiki lewat `PemicuCekServer`). Toast "Koneksi putus, mencoba menyambung lagi…" juga dipanggil ulang tiap percobaan gagal. Belum diputuskan apakah diperbaiki.
5. **Lama `npm test`** belum diukur ulang sejak simulasi memainkan jago/suhu (enam berkas `sim-*.test.ts` saja ±26 dtk). Ukur, perbarui angka di AGENTS.md dan README, dan cek waktu build Docker (Dockerfile menjalankan test).
6. **Belum diukur di HP sungguhan:** lama mikir Jago/Suhu (di komputer pengembang p99 < 7 ms, terburuk 26–41 ms; tangan > 14 kartu jatuh ke strategi normal lewat `BATAS_TANGAN_KUAT`; HP diperkirakan 4–5× lebih lambat, dan di mode offline bot jalan di main thread browser), dan biaya menjadwalkan bunyi besar (±20–25 ms di CPU yang diperlambat 4x).
7. **Kecil, opsional:**
   - Sambungan pertama ke server tetap kena jeda cek 1 menit. Kalau deploy selesai < 60 dtk sesudah cek terakhir lalu pemain langsung main, client lama bisa main di server baru sampai meja selesai. Bisa ditutup dengan cek paksa di setiap sambungan baru.
   - `kiraLebarTeks` (`game/tataMeja.ts`) meremehkan lebar huruf M/W, jadi singkatan seperti "MM" (Mbak Mata) bisa disembunyikan scene di label buangan paling sempit (tidak pernah salah orang). Memperbaikinya menggeser banyak test tata letak.
   - Komentar `levelUntuk` di `packages/engine/test/golden.test.ts` masih bilang "sama polanya dengan simulasi.ts", padahal simulasi sekarang memutar empat level (golden tetap mudah/normal).

## Sudah selesai (dicek 14 Okt 2026, jangan dikerjakan ulang)

- Sub-teks sorakan "TINGGAL 1 KARTU!" sudah netral, tanpa "siap mentung" (keputusan #30).
- FAQ masa tenggang sudah menyebut "dihitung sejak kamu terputus".
- Momen "tidak" untuk pembaruan sudah mencakup panel mentung dan klasemen akhir yang sedang tampil.
- Petunjuk `GIT_SHA` dan cek `/healthz` sudah ada di `docs/deploy.md`.
- Identitas build otomatis (`scripts/idBuild.mjs`): client dan server selalu sama, `GIT_SHA` opsional. Tinggal dicek di live (butir 1).
- Keterangan level Jago dan Suhu di `apps/client/src/konten/levelWarga.ts` sudah dipertajam sesuai `PARAM_JAGO`/`PARAM_SUHU`. Ingatan Suhu ditulis "baru-baru ini", bukan "semua", karena view hanya membawa 40 peristiwa terakhir (`ingatan.ts`); dijaga `levelWarga.test.ts`.
- CHANGELOG `[Belum dirilis]` sudah mencatat rilis 13 Okt dan batch 14 Okt.
- Cek versi server sesudah meja bubar: sudah dipaksa sejak awal (`main.ts` memanggil `cekServer(true)` saat "Meja X nggak ketemu."). Cek paksa saat sambungan pulih ternyata mati dan sudah diperbaiki (`PemicuCekServer`, dijaga `cekVersiServer.test.ts`).
- Keputusan #38 (galat di timer warga kedai/meja) sudah diperbaiki di `packages/meja` (`galat-bot.test.ts`).
