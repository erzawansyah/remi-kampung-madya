# Dasar strategi (bukan aturan)

Catatan dari AI yang sudah main di meja live (Okt 2026: sekali kalah −135, sekali juara +490). Aturan tetap hanya dari `aturan.md`; ini cara berpikir yang terbukti membantu.

## Cara poin datang

- **Mulung adalah satu-satunya jalan nutup.** Habis ambil dari deck kamu tidak bisa mentung. Pemain yang hampir selalu ambil deck jarang dapat poin besar, dan malah jadi sumber kartu bagi yang mulung.
- **Mentung** memberi pentungan (50/100/150, joker 250) ke kamu dan memotong nilai yang sama dari setiap pemilik kartu pungutan yang kamu pakai. Satu mentung bisa mengayunkan skor 300–600 poin, jauh lebih besar dari nilai kartu jadi (5–15 per kartu).
- **Deck habis** tanpa mentung: semua dihitung jadi − tangan. Kartu besar di tangan (Londo 10, As 15, joker hidup 25) jadi beban.

## Bentuk tangan yang bisa mentung

Mentung butuh, dalam satu giliran: mulung → kartu paling bawah pungutan masuk kartu jadi baru dengan modal dari tangan ≥ jumlah kartu pungutan di kombinasi itu → semua kartu lain habis diturunkan → sisa **tepat satu** kartu untuk dibuang (atau beberapa joker hidup sekaligus).

- **Sisakan minimal 3 kartu.** Dua kartu yang "nyaris jadi" (misalnya 6♠ 8♠, atau 4♦ 5♦) ditambah satu kartu buangan calon pentungan. Dengan 1–2 kartu kamu terjebak: hanya bisa ambil deck dan buang sampai orang lain nutup.
- **Hitung "out"-mu**: kartu apa saja yang kalau muncul di buangan bisa langsung kamu pungut lalu nutup. Contoh tangan 4♠ 6♠ K♣ + joker: out = 5♠ (dan 3♠/7♠ kalau joker ikut). Makin banyak out, makin sabar boleh menunggu.
- Mulung beberapa kartu sekaligus (k = 2 atau 3) sering membuka mentung: kartu yang lebih atas boleh ikut kartu jadi yang sama. Contoh: buangan …5♠ (bawah) 3♠ (atas), tangan 4♠ 6♠ K♣ → mulung 2, seri 3-4-5-6♠, buang K♣. Pemilik 5♠ dan 3♠ dua-duanya kepentung.
- Menahan kartu jadi di tangan sah (bisa diturunkan saat mulung atau di susun akhir), dan menyembunyikan rencanamu. Tapi As baru boleh dibuang sesudah punya kartu jadi, jadi As di tangan tanpa kartu jadi adalah beban.

## Membaca meja

- **Catat buangan per pemain** (`lihat` sudah menampilkan "riwayat buang putaran ini"). Pemain yang membuang 9♥ tidak sedang mengumpulkan seri hati di sekitar 9.
- **Kartu yang kamu buang diterima pemain sesudahmu** (tertulis di `lihat`: "buanganmu diterima ..."), tapi tetap terlihat dan bisa dipungut pemain berikutnya selama masih di (n − 1) teratas.
- Kartu **mati** aman dibuang: tetangganya sudah keluar semua, Londo yang pasangannya sudah dibuang (joker tidak bisa menggantikan Londo), atau kartu yang hanya bisa dipakai dengan dua joker berdempetan.
- Pemain dengan 3 kartu di tangan sedang mengancam. Jangan suapi kartu yang menyambung dengan kartu jadi atau buangan terakhirnya.
- Label "→angka" di kartu jadi lawan memberitahu angka joker (boleh jadi petunjuk). Kamu tetap tidak boleh membaca angka joker dari data sesudah pengumuman.

## Joker

- Joker hidup di tangan = −25 kalau orang lain nutup, dan −25 kalau kamu membuangnya. Sebagai pentungan = 250 (×2 di putaran kaldu).
- Pakai joker sebagai pengganti kalau itu yang membuka mentung; simpan untuk pentungan kalau tangan lain sudah siap dengan out yang banyak.
- Dua joker hidup + giliran diawali mulung + semua sisa tangan joker = nutup 500 (1000 di kaldu).

## Mode kaldu

- Pentungan ×2, termasuk yang kamu terima. Kalau sedang memimpin, main bertahan: buang kartu mati, jangan ambil risiko kepentung.
- Kalau tertinggal jauh, kaldu adalah kesempatan terakhir: kejar mentung, idealnya pakai joker atau memungut kartu pemimpin.
- Deck habis di kaldu = kaldu lagi. Tangan besar terus menggerus skor tiap putaran.

## Kesalahan yang pernah terjadi

- Menahan J♠ K♠ menunggu Q♠: Londo butuh kartu asli, peluangnya kecil. Sementara itu As dan joker tertahan, lalu kepentung −170.
- Menurunkan semua kartu sampai sisa satu: tidak bisa mentung lagi sepanjang putaran.
- Membuang K♠ satu giliran sebelum Q♠ muncul di buangan: kalau masih menyimpan J♠, pertimbangkan berapa Londo bunga itu yang sudah terlihat sebelum membuang.
