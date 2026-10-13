# Deploy produksi: daftar cek

Ringkasan cara deploy ada di README (bagian "Deploy ke VPS (Docker)"). Dokumen ini berisi cek yang dijalankan sesudah deploy, beserta hasil uji terakhir di mesin pengembang.

## Deploy

```bash
git pull
GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build
docker compose ps            # STATUS "healthy" ±30 detik setelah start
docker compose logs --tail 5 # "Remi Kampung Madya v<versi> (<sha>) jalan di port 2567 ..."
```

`docker compose up` mengganti container dengan rapi: `SIGTERM` → server menutup WebSocket, meja, dan database → keluar dengan kode 0 (< 1 detik). Meja online yang sedang jalan hilang (meja hanya di memori), jadi pilih waktu sepi. Permainan offline di HP tidak terpengaruh.

## Cek sesudah deploy

Ganti `B` dengan `http://127.0.0.1:2567` (di VPS) atau `https://remi.domainkamu.com` (lewat proxy).

| Cek | Perintah | Hasil yang benar |
|---|---|---|
| Versi & commit | `curl -s $B/healthz` | `"ok":true`, `"versi"` = versi `package.json`, `"sha"` = commit pendek yang di-deploy |
| Aset ber-hash | `curl -sI -H 'Accept-Encoding: br' $B/assets/<file>.js` | `cache-control: public, max-age=31536000, immutable`, `content-encoding: br` |
| Shell & SW | `curl -sI $B/` dan `curl -sI $B/sw.js` | `cache-control: no-cache` |
| Gzip | `curl -sI -H 'Accept-Encoding: gzip' $B/` | `content-encoding: gzip` |
| 404 | `curl -sI $B/assets/tidak-ada.js` | `404`, `cache-control: no-store` |
| Riwayat | `curl -s $B/api/peringkat` | JSON (array, boleh kosong) |
| WebSocket | buka aplikasi → Buat meja baru | lobi muncul dengan kode meja |
| PWA | Chrome DevTools → Application | service worker `activated`, precache 12 entri, manifest tanpa error |

Lewat proxy, cek juga bahwa `sw.js` tetap `no-cache` (proxy tidak boleh menimpa header cache) dan `/ws` tersambung (Caddy meneruskan WebSocket otomatis).

## Perilaku update PWA

- `registerType: 'prompt'`: service worker baru diunduh di latar belakang (saat aplikasi dibuka, dan dicek ulang tiap jam), lalu **menunggu**.
- Selama putaran berjalan atau susun akhir: tidak ada toast, tidak ada reload.
- Di beranda, lobi, atau di antara putaran: toast "Ada versi baru, Bos." dengan tombol **Muat ulang**, dan tombol menetap di kaki beranda.
- Sesudah Muat ulang, versi baru aktif dan simpanan permainan offline (`remi.mejaOffline`) tetap ada.

## Hasil uji di mesin pengembang (Docker Desktop 29.8, Chrome 155, 13 Okt 2026)

Image `node:24-alpine`, 246 MB (aplikasi ±3,2 MB), user `node`.

| Pemeriksaan | Hasil |
|---|---|
| `docker build` penuh (typecheck + 1191 test + build) | lulus, ±80 detik; typecheck yang gagal menggagalkan build |
| `/healthz` versi & sha | `{"ok":true,"meja":0,"versi":"0.2.0","sha":"9463cc5"}` |
| Header cache & kompresi (`/assets` immutable, shell/SW/manifest/ikon/font `no-cache`, br/gz/identity, 404 `no-store`) | lulus |
| WebSocket `/ws`: ping/pong, buat meja, 1 putaran lawan warga kedai sampai selesai | lulus, klasemen tersimpan di SQLite |
| Data SQLite tetap ada setelah restart dan setelah container dibuat ulang (volume) | lulus |
| Cadangan `VACUUM INTO` selagi server jalan | lulus |
| `docker stop` dengan WebSocket aktif | 0,7–1,7 detik, kode keluar 0 (diulang dengan kode server terbaru: log "SIGTERM diterima, server berhenti…") |
| Healthcheck | `healthy` |
| SW terdaftar, precache 12 entri, toast "tersimpan di HP" | lulus |
| Manifest (name, id, start_url, scope, display, warna, ikon 192/512/maskable sesuai ukuran asli); Chrome: tanpa installability error | lulus |
| Container dimatikan + browser offline → reload → beranda tampil, font termuat, main offline lawan warga kedai | lulus |
| Update di tengah putaran: SW baru `waiting`, tanpa toast, tanpa reload (diamati 13 detik) | lulus |
| Keluar ke beranda → toast + tombol Muat ulang → versi baru aktif, simpanan offline tetap ada | lulus |

Belum diuji: HTTPS sungguhan di balik Caddy, pemasangan ke layar utama di HP sungguhan, dan job CI Docker/E2E di runner GitHub.
