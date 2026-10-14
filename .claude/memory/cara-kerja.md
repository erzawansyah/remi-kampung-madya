# Cara kerja dengan pemilik

- **Bahasa ke pemilik:** jelaskan dalam Bahasa Indonesia. Istilah teknis Inggris yang lazim (deploy, endpoint, state, prompt, commit, merge) dibiarkan apa adanya. Kode dan pesan commit tetap bahasa Inggris (kecuali teks UI/komentar, ikuti AGENTS.md).
- **Branch kerja:** `produksi`. Branch `main` = yang tayang.
- **Alur rilis yang disepakati:** commit di `produksi` → push → buat PR ke `main` → **agent (Claude) sendiri yang merge**. Pemilik: "km aja yg merge nanti, saya terima jadi". Tetap jalankan `npm test` + `npm run typecheck` sebelum merge.
- **Deploy:** situs **https://remi-madya.likrea.biz.id**, di VPS pemilik. Agent deploy milik pemilik me-redeploy otomatis setiap ada perubahan di `main` (±5 menit). Jadi merge ke `main` = rilis ke pemain. Perubahan yang hanya dokumen pun ikut memicu redeploy.
- **Pemain:** teman-teman dekat pemilik, banyak yang main dari browser HP (PWA). Mereka tidak akan update manual, makanya update otomatis di momen aman (`apps/client/src/pembaruan.ts`) penting dan tidak boleh memuat ulang di tengah permainan.
- **Cek setelah deploy:** `curl -s https://remi-madya.likrea.biz.id/healthz` → `versi` harus sama dengan `package.json`. Field `sha` masih `"dev"` karena agent deploy belum mengisi `GIT_SHA` (lihat [pekerjaan-tertunda.md](pekerjaan-tertunda.md)).
- Pemilik suka diberi kabar progres singkat dan rekomendasi jelas, bukan daftar opsi panjang. Untuk aturan main tetap tanya dulu (AGENTS.md "Aturan emas").
