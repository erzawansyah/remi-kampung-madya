# Kedai Madya: konteks di balik gaya dan promosi

Remi Kampung Madya dimainkan di **Kedai Madya**, kedai milik teman pemilik proyek. Remi hanya salah satu kegiatan di sana; game ini versi online-nya.

**Sumber resmi (satu-satunya sumber fakta kedai):**
- Instagram: https://www.instagram.com/kedaimadya/
- Threads: https://www.threads.com/@kedaimadya
- Peta: https://share.google/G6JZp1CpJ4O4ZPVy6
- Katalog buku: https://katalog-buku-bermadya.lovable.app/

Di kode semuanya ada di `apps/client/src/konten/kedai.ts`; logo di `apps/client/src/aset/logoMadya.ts`.

**Keputusan pemilik (13 Okt 2026):**
- Lawan komputer jangan disebut "Bot" (terlalu game). Di teks UI: **warga kedai**. Nama-namanya konsep "Warga Madya": Kipas Dua, Cak Kopag, Mbak Teras, Mas Sampul, Si Rak, Pak Seng, Dik Toska, Ning Sore, Om Garpu, Bu Sendok (`NAMA_LAWAN_BAWAAN` di `packages/meja/src/meja.ts`). 14 Okt 2026 pemilik menambah: Cak Owner, Penampil, Koki-Kun, Bang IT, Bos Bocil, Jurik, Bajigur, Pak Tani, Juragan, Ning Kukis, Mbak Mata, Om Napi. Ejaannya jangan diubah; nama baru selalu ditambahkan di belakang (latihan dan golden meja memakai nama terdepan).
- 16 Okt 2026 (#47): tiap warga kedai punya gaya main sendiri yang mengikuti **namanya** (pemetaan disetujui pemilik, di `GAYA_WARGA`, `packages/meja/src/gayaWarga.ts`), terpisah dari level. Gaya tidak pernah disebut ke pemain; di teks pemain cukup "tiap warga punya kebiasaan sendiri", tanpa nama gaya. Nama baru wajib diberi gaya juga.
- Punggung kartu: arang + motif kawung kuning MADYA `#f1a615` + medali maskot cangkir.
- Logo (cangkir tersenyum mata "><", garpu & sendok bersilang, "KEDAI MADYA EST. 2026") diberikan pemilik, dipakai dengan izin kedai; kreditnya di layar Tentang.
- Promosi **soft selling**, hanya di tiga tempat (lihat AGENTS.md "Promosi Kedai Madya").
- Teks **antislop**: buang kata cringe, pola "Kami X, bukan Y", "bukan sekadar …", klise promosi. Berlaku untuk UI, bantuan, tutorial, Tentang, CHANGELOG bagian pemain, dan promosi.

**Kenapa:** game ini identitas tongkrongan di kedai itu, bukan game generik, dan pemilik tidak suka gaya tulisan AI/iklan.
**Cara menerapkan:** pakai hanya fakta yang bisa dicek dari sumber di atas (jangan mengarang jam buka, menu, harga, alamat, rating). Promosi tidak boleh mengganggu giliran, dan nama lawan tidak boleh jadi penanda info rahasia.
