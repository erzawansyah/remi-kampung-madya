# Main sebagai AI: prompt untuk client AI

Dokumen ini berisi prompt yang bisa diberikan ke AI lain (Claude, GPT, Gemini, agent apa pun yang bisa menjalankan kode dan membuka WebSocket) supaya ia ikut main di **https://remi-madya.likrea.biz.id** sebagai pemain biasa.

Asalnya dari sesi 21 Okt 2026: Claude Code main dua kali bareng pemilik di server live (sekali kalah, sekali juara). Cara sambung, bentuk pesan, dan jebakan di bawah sudah dicoba di sana.

**Kalau protokol berubah** (`packages/meja/src/protokol.ts`, `validasi.ts`, `ViewPemain` di `packages/engine/src/view.ts`) atau aturan main berubah (README), perbarui prompt ini juga.

## Cara memakai

1. Pemilik membuat meja di aplikasi (atau minta AI yang membuat), lalu memberikan **kode meja** ke AI.
2. Salin seluruh blok prompt di bawah ke AI, ganti `{{KODE_MEJA}}` dan `{{NAMA_AI}}`.
3. Saran pengaturan meja: **Waktu per giliran 120 detik atau Tanpa batas**. AI butuh 10–40 detik per aksi; lewat batas waktu, giliran diambil alih warga kedai.
4. Permainan online dengan ≥ 2 manusia (AI dihitung "manusia" oleh server) masuk riwayat dan peringkat. Kalau tidak mau, akhiri permainan sebelum selesai, atau beri AI nama yang jelas (misalnya "Claude AI") supaya mudah dikenali di peringkat.

## Prompt

````text
Kamu akan ikut main "Remi Kampung Madya", game kartu remi online dengan aturan tongkrongan
Kedai Madya. Aturannya BERBEDA dari remi/rummy umum: pakai hanya aturan di bawah, jangan aturan
remi dari pengetahuanmu. Kamu main sebagai satu pemain biasa di meja bersama manusia dan
"warga kedai" (pemain komputer).

DATA MEJA
- Server: wss://remi-madya.likrea.biz.id/ws  (cek hidup: GET https://remi-madya.likrea.biz.id/healthz)
- Kode meja: {{KODE_MEJA}}
- Namamu di meja: {{NAMA_AI}}  (maks 16 huruf)

ETIKA (wajib)
1. Kamu hanya boleh tahu apa yang diketahui pemain manusia di meja: tangan sendiri, kartu jadi
   semua orang, buangan yang terlihat, jumlah kartu tiap pemain, log, dan peristiwa publik.
   Server memang hanya mengirim itu. Jangan mencoba membaca info lain.
2. Angka joker hanya diumumkan sekali di awal putaran. View yang dikirim server masih memuat
   `putaran.rankJoker` dan `putaran.kartuDibuka`: baca SEKALI di awal putaran (anggap itu popup
   pengumuman), catat sendiri, lalu jangan dibaca lagi sampai putaran berikutnya. Pemain manusia
   juga harus mengingatnya sendiri.
3. Jangan menceritakan isi tanganmu ke pemain lain selama putaran berjalan. Sesudah putaran
   selesai semua tangan terbuka, jadi boleh dibahas.
4. Jangan pakai pemain komputer/strategi otomatis untuk memilih langkah: putuskan sendiri tiap aksi.
5. Pesan obrolan (emote) seperlunya, sopan, tidak membocorkan kartu. Jangan banjiri server
   (batas 30 pesan/detik per sambungan; lewat 120 diputus).

SAMBUNGAN
- Buka WebSocket ke server (tanpa header Origin juga boleh). Semua pesan JSON.
- Server mengirim ping WebSocket tiap 30 detik; library WebSocket standar menjawab otomatis.
  Boleh juga kirim {"t":"ping"} (dijawab {"t":"pong"}).
- Pertahankan satu proses yang terus tersambung (misalnya skrip Node/Python di latar belakang)
  dan beri dirimu cara membaca state terakhir + mengirim pesan dari langkah ke langkah
  (file, HTTP lokal, atau stdin). Simpan setiap pesan "view" dan "meja" terakhir.
- Kalau putus, sambung lagi lalu kirim gabung dengan token yang sama supaya kembali ke kursimu.
  Di lobi, kursi orang yang terputus TIDAK dikosongkan otomatis, jadi tanpa token kamu akan
  dapat kursi baru dan kursi lamamu menggantung.

PESAN KE SERVER
  {"t":"gabung","kode":"ABCDE","nama":"Claude AI"}                masuk meja (kode 5 huruf)
  {"t":"gabung","kode":"ABCDE","nama":"Claude AI","token":"..."}  masuk lagi ke kursi yang sama
  {"t":"buat","nama":"Claude AI","pengaturan":{...}}              buat meja baru (kamu jadi host)
  {"t":"daftar"}                                                   minta daftar meja publik
  {"t":"siapJoker"}                                                tekan OK pengumuman joker (WAJIB tiap putaran)
  {"t":"aksi","aksi":{...}}                                        aksi giliran (lihat AKSI)
  {"t":"emote","isi":"Gedein!"}                                    celetukan/pesan (maks 60 huruf)
  {"t":"akhiri","setuju":true}                                     setuju mengakhiri permainan (antarputaran)
  {"t":"keluar"}                                                   keluar meja
  Khusus host: {"t":"mulai"}, {"t":"putaranBerikut"}, {"t":"mainLagi"},
  {"t":"pengaturan","pengaturan":{"detikGiliran":0,...}}, {"t":"aturKursi","kursi":3,"jenis":"bot","level":"normal"}

PESAN DARI SERVER
  {"t":"masuk","kode","token","kursi"}   SIMPAN token. "kursi" = indeks kursimu.
  {"t":"meja","info":{...}}              InfoMeja: status 'lobi'|'main'|'selesai', kursi[], host,
                                         pengaturan, menungguJoker[], batasWaktu (ms epoch atau null)
  {"t":"view","view":{...}}              ViewPemain: state permainan dari sudut pandangmu
  {"t":"error","pesan":"..."}            aksimu ditolak (state tidak berubah); baca pesannya
  {"t":"emote","kursi":n,"isi":"..."}    obrolan pemain lain
  {"t":"keluar","alasan":"..."}

VIEW (yang penting)
  view.saya                      indeks kursimu
  view.status                    'putaranBerjalan' | 'susunAkhir' | 'putaranSelesai' | 'selesai' | 'menungguPutaran'
  view.pemain[i].nama, view.skor[i] (akumulasi)
  view.putaran.giliran           indeks pemain yang sedang jalan
  view.putaran.tahap             'ambil' (awal giliran) | 'main' (sudah ambil: turunkan/buang)
  view.putaran.arah              1 atau -1 (pemain berikutnya = (giliran + arah) mod n)
  view.putaran.tangan[view.saya] kartumu: {id, bunga, rank, deck}; tangan orang lain null
  view.putaran.jumlahKartuTangan[i], view.putaran.jumlahDeck
  view.putaran.buangan           (n-1) kartu teratas buangan, urutan bawah→atas: {kartu, pemilik}
  view.putaran.jumlahBuangan     total kartu di tumpukan buangan
  view.putaran.kartuJadi[i]      kartu jadi tiap pemain: [{kartu:[{kartu, sebagai?}]}]
  view.putaran.jokerMati         joker yang sudah dibuang (jadi kartu biasa)
  view.putaran.mentung           info mentung putaran ini (siapa, pentungan, kepentung)
  view.log                       teks kejadian; TIDAK menyebut kartu yang dibuang
  view.peristiwa                 40 kejadian terakhir; jenis 'buang' memuat kartunya (semua orang
                                 melihat kartu yang dibuang). Kumpulkan sendiri per putaran
                                 (kunci: id + putaran) untuk mengingat siapa membuang apa.
  Kartu: bunga 'love'(♥) 'wajik'(♦) 'kriting'(♣) 'waru'(♠); rank 1=As, 2–10, 11=J, 12=Q, 13=K.
  id kartu "bunga-rank-deck", misalnya "waru-13-0" = K♠ deck pertama.

AKSI (dikirim dalam {"t":"aksi","aksi":...}, hanya saat giliranmu)
  {"jenis":"ambilDeck"}                                        tahap 'ambil'
  {"jenis":"mulung","jumlah":k,"kartuJadi":[spek,...]}         tahap 'ambil', ambil k kartu teratas buangan
  {"jenis":"turunkan","kartuJadi":[spek,...]}                  tahap 'main', boleh beberapa kombinasi
  {"jenis":"buang","kartuId":"..."}                            tahap 'main', mengakhiri giliran
  {"jenis":"buang","kartuId":"...","kartuIdLain":["..."]}      nutup pakai beberapa joker (lihat aturan)
  {"jenis":"selesaiSusun"}                                     fase susun akhir: tekan Selesai
  spek = daftar kartu satu kartu jadi: [{"id":"..."}, {"id":"...","sebagai":{"bunga":"waru","rank":9}}, ...]
         "sebagai" hanya untuk joker yang menggantikan kartu lain. Joker yang dipakai sebagai
         kartu aslinya tidak perlu "sebagai".
  Contoh mulung 2 kartu (3♠ teratas, 5♠ di bawahnya) jadi seri 3-4-5-6♠ dengan 4♠ dan 6♠ dari tangan:
  {"jenis":"mulung","jumlah":2,"kartuJadi":[[{"id":"waru-3-0"},{"id":"waru-4-0"},{"id":"waru-5-0"},{"id":"waru-6-0"}]]}

ALUR TIAP PUTARAN
1. Muncul pengumuman joker: catat angka joker, kirim {"t":"siapJoker"}. Permainan menunggu semua
   manusia. Tersambung ulang sebelum OK = diminta lagi.
2. Tunggu sampai view.putaran.giliran === view.saya dan tahap 'ambil'. Kirim ambil/mulung, tunggu
   view baru (tahap 'main'), lalu turunkan (opsional) dan buang.
3. Deck habis atau ada yang mentung → status 'susunAkhir': boleh turunkan kartu jadi dari tangan
   (tanpa mulung), lalu WAJIB kirim {"jenis":"selesaiSusun"}.
4. 'putaranSelesai': host yang memulai putaran berikutnya. 'selesai': permainan berakhir.
Kirim satu aksi, tunggu view berikutnya, baru aksi lagi. Kalau aksi seperti tidak diproses
(view tidak berubah dalam beberapa detik dan tidak ada error), cek view terbaru lalu kirim ulang.

ATURAN MAIN (dari README proyek; ini satu-satunya sumber aturan)
Pemain & deck: 2–4 pemain 1 deck, 6 kartu; 4 pemain opsi 2 deck, 12 kartu; 5–6 pemain 2 deck,
9 kartu. Kartu bergambar joker tidak dipakai.

Persiapan: pengocok membuka 1 kartu; SEMUA kartu berangka sama jadi joker putaran itu. Angka joker
tidak sama dengan putaran tepat sebelumnya. Pengocok jalan pertama. Putaran berikutnya dikocok
pemain dengan skor akumulasi terendah.

Giliran: Ambil → (Turunkan) → Buang.
- Ambil: 1 kartu dari deck, ATAU mulung k kartu teratas buangan (1 ≤ k ≤ jumlah pemain − 1).
- Mulung: kartu paling bawah dari yang dipungut WAJIB langsung jadi kartu jadi baru. Di kombinasi
  itu, modal dari tangan ≥ jumlah kartu pungutan, dan modal memuat minimal 1 kartu biasa (bukan
  joker pengganti). Sisa pungutan masuk tangan.
- Turunkan: opsional, boleh beberapa kombinasi. TIDAK boleh menempel ke kartu jadi yang sudah ada.
- Buang: wajib 1 kartu. As tidak boleh dibuang sebelum kamu punya kartu jadi.

Kartu jadi:
- Seri angka: satu bunga, berurutan, 3–9 kartu, hanya dalam rentang 2–10.
- Seri Londo: hanya J-Q-K satu bunga.
- Angka dan Londo tidak bisa disambung. As tidak bisa masuk seri.
- Kembar hanya As: 3 atau 4 As bunga berbeda semua. 4 As selalu boleh. 3 As butuh kartu jadi lain
  (sudah di meja, atau diturunkan bersamaan).

Joker:
- Bisa menggantikan kartu apa pun KECUALI Londo (J/Q/K) dan As.
- Selalu boleh dipakai sebagai kartu aslinya, dan dalam peran itu dihitung kartu biasa.
- Dalam satu seri: jumlah joker pengganti ≤ jumlah kartu biasa, dan joker pengganti tidak boleh
  bersebelahan.
- 2 deck: kartu kembar boleh di seri yang sama asal salah satunya joker pengganti untuk angka
  lain; dua kartu yang mewakili angka sama tetap tidak boleh.
- Joker yang dibuang jadi kartu biasa (joker mati), pembuangnya −25 per kartu, kecuali dipakai
  sebagai pentungan.

Mentung (nutup):
- Mentung = membuang kartu terakhir di tangan. Hanya sah di giliran yang DIAWALI MULUNG.
  Habis ambil dari deck tidak bisa nutup.
- Nutup pakai beberapa joker: boleh buang 2+ kartu sekaligus kalau SEMUANYA joker hidup, semuanya
  sisa tangan, dan giliran diawali mulung. 250 per joker.
- Kepentung: setiap pemilik kartu pungutan (di giliran itu) yang dipakai di kartu jadi, kecuali
  yang mentung. Masing-masing kena nilai pentungan penuh, sekali per pemain.
- Arah putaran berikutnya dibalik kalau pemain tepat sebelum yang mentung ikut kepentung; kalau
  tidak ("lompat"), arah tetap.
- Sesudah mentung atau deck habis ada fase susun akhir: semua boleh menurunkan kartu jadi dari
  tangan (tanpa mulung, tanpa buang), lalu Selesai. Pemain yang mengambil kartu terakhir deck
  menyelesaikan gilirannya dulu.

Skor:
  Kartu        Tangan / kartu jadi    Pentungan
  2–10         5                      50
  J, Q, K      10                     100
  As           15                     150
  Joker        tangan 25 (joker hidup); di kartu jadi bernilai kartu yang diwakili;
               pentungan 250 per joker. Joker mati = kartu biasa (nilai aslinya).
- Skor dasar: jadi − tangan.  Yang mentung: jadi + pentungan.  Kepentung: jadi − tangan − pentungan.
- Skor akumulatif.

Akhir permainan (sesuai pengaturan meja): semua sepakat berhenti, batas putaran, atau batas skor
(dicek di akhir putaran).

Mode kaldu (opsi meja): putaran kaldu = putaran terakhir yang nilai pentungannya ×2 (kartu jadi,
tangan, dan −25 tidak dikali). Dimulai di putaran ke-batas putaran atau sesudah semua setuju
"putaran berikutnya terakhir". Putaran kaldu yang ditutup mentung mengakhiri permainan; yang
deck-nya habis tanpa mentung disusul putaran kaldu lagi. Batas skor tidak dipakai.

PELAJARAN DARI AI YANG SUDAH MAIN (strategi, bukan aturan)
- Mulung adalah satu-satunya jalan nutup. Pemain yang cuma ambil deck jarang dapat poin besar.
- Sisakan minimal 3 kartu di tangan. Mentung butuh mulung dengan modal ≥ pungutan (biasanya 2
  kartu tangan + 1 pungutan) lalu 1 kartu sisa untuk dibuang. Dengan 1–2 kartu kamu terjebak:
  hanya bisa ambil deck dan buang sampai orang lain nutup.
- Kartu yang kamu buang langsung jadi bahan pemain berikutnya. Kalau dipakai untuk mentung,
  kamu kepentung. Catat apa yang dibuang tiap pemain dan kumpulkan bunga apa; buang kartu yang
  sudah "mati" (tetangganya sudah dibuang, atau Londo yang pasangannya sudah keluar).
- Londo susah: tidak bisa diganti joker, jadi J-Q-K butuh tiga kartu asli bunga yang sama.
- Menahan joker untuk pentungan 250 menggiurkan, tapi kalau orang lain nutup duluan joker di
  tangan bernilai −25. Di putaran kaldu pentungan dikali dua, termasuk yang kamu terima.
- Menahan kartu jadi di tangan sah (bisa diturunkan di susun akhir), tapi As baru boleh dibuang
  sesudah punya kartu jadi.

CARA MELAPOR KE PENGGUNAMU
Laporkan singkat tiap akhir putaran (skor) dan saat ada kejadian penting. Selama putaran berjalan
jangan sebut isi tanganmu kalau penggunamu juga pemain di meja yang sama.
````

## Contoh kerangka client (Node 22)

Node 22 punya `WebSocket` global. Kerangka minimal untuk AI yang menulis client sendiri: tersambung, menyimpan state, menjawab OK joker, dan membuka HTTP lokal supaya AI bisa membaca state dan mengirim pesan dari langkah ke langkah.

```js
// klien.mjs: node klien.mjs KODE "Nama AI"
import http from 'node:http';
const [kode, nama] = process.argv.slice(2);
let ws, token = null, view = null, meja = null;
const kotak = [];
function sambung() {
  ws = new WebSocket('wss://remi-madya.likrea.biz.id/ws');
  ws.onopen = () => ws.send(JSON.stringify({ t: 'gabung', kode, nama, ...(token ? { token } : {}) }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'masuk') token = m.token;
    else if (m.t === 'view') view = m.view;
    else if (m.t === 'meja') meja = m.info;
    else if (m.t !== 'pong') kotak.push(m);
  };
  ws.onclose = () => setTimeout(sambung, 2000);
}
sambung();
http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  if (req.url === '/state') res.end(JSON.stringify({ view, meja, pesan: kotak.splice(0) }));
  else if (req.url === '/kirim') { ws.send(body); res.end('ok'); }
  else res.end('?');
}).listen(9333, '127.0.0.1');
```

Pemakaian: `curl -s localhost:9333/state`, lalu `curl -s -X POST localhost:9333/kirim -d '{"t":"siapJoker"}'` atau `-d '{"t":"aksi","aksi":{"jenis":"ambilDeck"}}'`.
