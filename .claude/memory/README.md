# Memori proyek (ikut repo)

Catatan untuk sesi Claude Code/agent di device mana pun. Isinya konteks yang tidak bisa dibaca dari kode: cara kerja dengan pemilik, latar Kedai Madya, dan pekerjaan yang belum selesai. Semuanya dimuat otomatis lewat `@import` di `CLAUDE.md` root.

- [cara-kerja.md](cara-kerja.md): bahasa penjelasan, alur `produksi` → PR → merge `main`, deploy otomatis ke remi-madya.likrea.biz.id, dan alur usul fitur lewat Notion + routine harian.
- [kedai-madya.md](kedai-madya.md): sumber resmi kedai, keputusan nama/istilah/punggung kartu/logo, soft selling, antislop.
- [pekerjaan-tertunda.md](pekerjaan-tertunda.md): sisa pekerjaan dan yang sudah dicek selesai.

**Aturan memakai folder ini:**
- Simpan di sini, bukan di memori lokal mesin (`~/.claude/projects/...`), supaya ikut ke device lain. Commit bersama perubahan lain.
- Satu topik per file. File baru wajib ditambahkan ke daftar di atas **dan** di-`@import` di `CLAUDE.md`.
- Jangan tulis rahasia (token, password, email, IP server). Repo ini bisa dibaca orang lain.
- Jangan menyalin yang sudah tercatat di AGENTS.md, README, `docs/`, atau git log; cukup rujuk.
- Aturan main tetap hanya dari README/AGENTS.md dan `docs/keputusan-pemilik.md`, bukan dari sini.
