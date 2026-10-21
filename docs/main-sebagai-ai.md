# Main sebagai AI

AI lain (Claude, atau agent apa pun yang bisa menjalankan perintah shell dan Node 22+) bisa ikut main di **https://remi-madya.likrea.biz.id** sebagai pemain biasa lewat skill agent di [`skill/remi-kampung-madya/`](../skill/remi-kampung-madya/SKILL.md).

Asalnya dari sesi 21 Okt 2026: Claude Code main dua kali bareng pemilik di server live (sekali kalah, sekali juara). Cara sambung, bentuk pesan, dan jebakan yang ditemukan di sana dikemas di skill ini.

## Isi skill

| File | Isi |
|---|---|
| `SKILL.md` | Alur main, perintah, cara memutuskan mulung, etika, cara melapor |
| `scripts/klien.mjs` | Client yang tetap tersambung (sambung ulang dengan token), mengumpulkan ingatan buangan, membuka kontrol HTTP lokal. Angka joker hanya ditampilkan sampai AI menekan OK. |
| `scripts/remi.mjs` | Perintah untuk agent: `lihat`, `tunggu`, `siap`, `ambil`, `mulung`, `turunkan`, `buang`, `selesai`, `emote`, `host ...` |
| `references/aturan.md` | Ringkasan aturan dari README + keputusan pemilik yang menyangkut cara main |
| `references/protokol.md` | Pesan WebSocket dan bentuk view |
| `references/strategi.md` | Pelajaran dari permainan AI sebelumnya (strategi, bukan aturan) |
| `references/gaya/` | Gaya main: seimbang (bawaan), pemungut, tembok, pemburu-joker, pemancing, santai |

## Cara memakai

1. Paket skill: zip folder `skill/remi-kampung-madya/` (atau berkas `.skill`/`.zip` yang dibagikan), pasang di agent.
2. Buat meja, atur **Waktu per giliran 120 detik atau Tanpa batas** (AI butuh 10–40 detik per aksi).
3. Bilang ke agent: "Ayo main remi, mejanya ABCDE, namamu Claude AI" (opsional: "pakai gaya tembok").

Permainan online dengan ≥ 2 manusia (AI dihitung manusia oleh server) masuk riwayat dan peringkat. Beri AI nama yang jelas supaya mudah dikenali.

## Menjaga skill tetap benar

Skill menyalin protokol (`packages/meja/src/protokol.ts`, `validasi.ts`), bentuk view (`packages/engine/src/view.ts`), dan ringkasan aturan (README). Kalau salah satunya berubah, perbarui `references/` dan, kalau perlu, `scripts/`. Uji cepat di server lokal:

```bash
npm run dev:server
node skill/remi-kampung-madya/scripts/klien.mjs --buat --nama "Uji AI" --server ws://localhost:2567/ws \
  --pengaturan '{"jumlahPemain":2,"batasPutaran":1,"detikGiliran":0,"tempoBot":"cepat"}'   # di terminal lain
node skill/remi-kampung-madya/scripts/remi.mjs host bot 1 normal
node skill/remi-kampung-madya/scripts/remi.mjs host mulai
node skill/remi-kampung-madya/scripts/remi.mjs tunggu 30
```
