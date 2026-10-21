# Protokol server (untuk yang perlu lebih dari scripts/remi.mjs)

Biasanya cukup pakai `scripts/remi.mjs`. Baca ini kalau perlu mengirim pesan mentah (`remi.mjs kirim '<json>'`), membaca `remi.mjs json`, atau menulis client sendiri.

## Sambungan

- WebSocket `wss://remi-madya.likrea.biz.id/ws` (server lokal pengembang: `ws://localhost:2567/ws`). Tanpa header Origin juga boleh.
- Semua pesan JSON. Server mengirim ping WebSocket tiap 30 detik (library standar menjawab otomatis); `{"t":"ping"}` dijawab `{"t":"pong"}`.
- Batas: 30 pesan/detik per sambungan diproses, lewat 120 diputus. 150 sambungan dan 60 meja per IP.
- Masuk lagi ke kursi yang sama: kirim `gabung` dengan `token` dari pesan `masuk`. Di lobi, kursi yang terputus tidak dikosongkan otomatis dan host tidak bisa melepasnya, jadi token penting. Saat main, warga kedai mengambil alih giliran pemain terputus sesudah 20 detik.

## Pesan ke server

| Pesan | Arti |
|---|---|
| `{"t":"gabung","kode":"ABCDE","nama":"Claude AI","token":"..."}` | masuk meja; token opsional |
| `{"t":"buat","nama":"...","pengaturan":{...}}` | buat meja, jadi host |
| `{"t":"daftar"}` | daftar meja publik → `{"t":"daftar","meja":[{kode,namaHost,jumlahPemain,terisi,status}]}` |
| `{"t":"siapJoker"}` | OK pengumuman joker (permainan menunggu semua manusia) |
| `{"t":"aksi","aksi":{...}}` | aksi giliran, lihat di bawah |
| `{"t":"emote","isi":"..."}` | celetukan dari palet atau teks bebas maks 60 huruf |
| `{"t":"akhiri","setuju":true}` | voting akhiri permainan (antarputaran) |
| `{"t":"putaranTerakhir","setuju":true}` | mode kaldu: voting putaran berikutnya terakhir |
| `{"t":"keluar"}` | keluar meja |
| host: `{"t":"mulai"}`, `{"t":"putaranBerikut"}`, `{"t":"mainLagi"}` | mulai permainan / putaran berikutnya / main lagi |
| host: `{"t":"pengaturan","pengaturan":{...}}` | ubah pengaturan di lobi |
| host: `{"t":"aturKursi","kursi":3,"jenis":"bot","level":"normal"}` | isi kursi dengan warga kedai (`mudah`/`normal`/`jago`/`suhu`) atau `"jenis":"kosong"` |

`pengaturan`: `jumlahPemain` (2–6), `duaDeckUntukEmpat`, `batasPutaran` (angka atau null), `batasSkorAtas`, `batasSkorBawah` (kelipatan 10 atau null), `publik`, `detikGiliran` (0 = tanpa batas), `levelBot`, `tempoBot` (`santai`/`normal`/`cepat`), `modeKaldu`.

Celetukan palet: 😂 😱 🔥 👏 😤 🙏 😎 🤔 😭 🤣 😡 🥶 🤡 😴 😏 🙄, dan teks seperti "Gedein!", "Buruan!", "Lumayan!", "CEKI!", "Njir lah!", "Give me!", "Kartu itu bundar, kak.". Teks lain diketik bebas.

## Aksi

| Aksi | Kapan |
|---|---|
| `{"jenis":"ambilDeck"}` | tahap `ambil` |
| `{"jenis":"mulung","jumlah":k,"kartuJadi":[spek,...]}` | tahap `ambil`; k kartu teratas buangan, 1 ≤ k ≤ jumlah pemain − 1 |
| `{"jenis":"turunkan","kartuJadi":[spek,...]}` | tahap `main` |
| `{"jenis":"buang","kartuId":"..."}` | tahap `main`, mengakhiri giliran |
| `{"jenis":"buang","kartuId":"...","kartuIdLain":["..."]}` | nutup pakai beberapa joker hidup |
| `{"jenis":"selesaiSusun"}` | fase susun akhir |

`spek` = satu kartu jadi: `[{"id":"waru-4-0"},{"id":"love-9-0","sebagai":{"rank":5,"bunga":"waru"}},{"id":"waru-6-0"}]`. `sebagai` hanya untuk joker pengganti; joker yang dipakai sebagai kartu aslinya tanpa `sebagai`. Saat mulung, kartu jadi pertama atau salah satunya wajib memuat kartu paling bawah pungutan; kartu pungutan yang tidak dipakai masuk tangan.

## Pesan dari server

| Pesan | Isi |
|---|---|
| `masuk` | `kode`, `token`, `kursi` |
| `meja` | `info`: `kode`, `status` (`lobi`/`main`/`selesai`), `pengaturan`, `kursi[]` (`jenis` manusia/bot/kosong, `nama`, `terhubung`, `level`), `host`, `kursiSaya`, `setujuAkhiri`, `setujuKaldu?`, `batasWaktu` (ms epoch/null), `diambilAlihBot`, `menungguJoker[]` |
| `view` | `view`: lihat di bawah |
| `error` | `pesan`: aksi ditolak, state tidak berubah |
| `emote` | `kursi`, `isi` |
| `keluar` | `alasan` |

## View

- `saya`, `pemain[i].nama`, `skor[i]` (akumulasi), `status` (`menungguPutaran`/`putaranBerjalan`/`susunAkhir`/`putaranSelesai`/`selesai`), `arah`, `alasanSelesai`, `kalduDiminta?`.
- `putaran`: `nomor`, `pengocok`, `giliran`, `tahap` (`ambil`/`main`), `arah`, `jumlahDeck`, `deckHabis`, `tangan[saya]` (kartu `{id,bunga,rank,deck}`; tangan lain `null` selama putaran berjalan), `jumlahKartuTangan[]`, `buangan` ((n − 1) teratas, bawah → atas, `{kartu,pemilik}`), `jumlahBuangan`, `kartuJadi[i]` (`[{kartu:[{kartu,sebagai?,dari?}]}]`), `pungutan`, `jokerMati`, `selesaiSusun[]`, `mentung` (`pemain`, `pentungan`, `pentunganLain?`, `pentunganJoker`, `kepentung[]`), `kaldu?`.
- `putaran.rankJoker` dan `putaran.kartuDibuka` juga ada. **Etika: baca hanya saat pengumuman joker**; `remi.mjs json` dan `lihat` menyembunyikannya sesudah kamu OK.
- `riwayat[]`: hasil tiap putaran selesai (`cara`, `pementung`, `nilaiPentungan`, `kepentung`, `skorAkumulasi`, `rincian`).
- `log[]`: teks kejadian, tidak menyebut kartu yang dibuang.
- `peristiwa[]`: 40 kejadian terakhir (`jenis`: `mulaiPutaran`, `ambilDeck`, `mulung`, `turunkan`, `buang` (dengan `kartu`, `jokerDibuang`), `mentung`, `susunAkhir`, `putaranSelesai`, ...). `klien.mjs` mengumpulkannya per putaran untuk ingatan buangan.

Kartu: `bunga` `love` ♥, `wajik` ♦, `kriting` ♣, `waru` ♠; `rank` 1 = As, 2–10, 11 = J, 12 = Q, 13 = K; `id` = `bunga-rank-deck`, misalnya `waru-13-0` (K♠ deck pertama), `love-5-1` (5♥ deck kedua).
