#!/usr/bin/env node
// Perintah untuk agent: membaca meja dan mengirim aksi lewat klien.mjs yang sedang jalan.
//
//   node remi.mjs lihat                       ringkasan meja (tanganmu, buangan, giliran, skor)
//   node remi.mjs tunggu [detik]              tunggu sampai perlu aksimu / ada kejadian penting (bawaan 240)
//   node remi.mjs json                        state mentah (angka joker disembunyikan sesudah OK)
//   node remi.mjs siap                        OK pengumuman joker
//   node remi.mjs ambil                       ambil 1 kartu dari deck
//   node remi.mjs mulung <k> <kombinasi>...   pungut k kartu teratas buangan + kartu jadi baru
//   node remi.mjs turunkan <kombinasi>...     turunkan kartu jadi dari tangan
//   node remi.mjs buang <id> [id...]          buang 1 kartu (atau nutup pakai beberapa joker)
//   node remi.mjs selesai                     selesai di fase susun akhir
//   node remi.mjs emote <teks>                kirim celetukan/pesan (maks 60 huruf)
//   node remi.mjs akhiri ya|tidak             voting akhiri permainan (antarputaran)
//   node remi.mjs kaldu ya|tidak              voting "putaran berikutnya terakhir" (mode kaldu)
//   node remi.mjs host mulai|berikut|mainlagi|bot <kursi> [level]|kosong <kursi>|atur '<json>'
//   node remi.mjs kirim '<json>'              kirim pesan protokol mentah
//   node remi.mjs keluar                      keluar meja lalu hentikan klien
//
// Kombinasi = id kartu dipisah koma. Joker pengganti ditulis id=angka (bunga ikut kartu lain di
// kombinasi itu) atau id=angka:bunga. Contoh: waru-4-0,love-9-0=5,waru-6-0
// Port klien: env REMI_PORT (bawaan 9333).

const PORT = Number(process.env.REMI_PORT ?? 9333);
const BASE = `http://127.0.0.1:${PORT}`;
const [perintah, ...arg] = process.argv.slice(2);

const RANK = { A: 1, AS: 1, J: 11, Q: 12, K: 13 };
const BUNGA_ALIAS = { love: 'love', hati: 'love', wajik: 'wajik', kriting: 'kriting', waru: 'waru', sekop: 'waru', keriting: 'kriting' };

async function get(p) {
  const r = await fetch(BASE + p);
  return r.text();
}
async function kirim(obj) {
  const r = await fetch(BASE + '/kirim', { method: 'POST', body: JSON.stringify(obj) });
  return r.text();
}
const aksi = (a) => kirim({ t: 'aksi', aksi: a });

function rank(x) {
  const t = String(x).toUpperCase();
  const n = RANK[t] ?? Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 13) throw new Error(`Angka "${x}" tidak dikenal (pakai 2–10, J, Q, K, A).`);
  return n;
}
const bungaDariId = (id) => id.split('-')[0];

function kombinasi(teks) {
  const bagian = teks.split(',').map((x) => x.trim()).filter(Boolean);
  if (bagian.length < 3) throw new Error(`Kombinasi "${teks}" kurang dari 3 kartu.`);
  const biasa = bagian.filter((b) => !b.includes('=')).map(bungaDariId);
  return bagian.map((b) => {
    if (!b.includes('=')) return { id: b };
    const [id, peran] = b.split('=');
    const [r, bg] = peran.split(':');
    const bunga = bg ? BUNGA_ALIAS[bg.toLowerCase()] : biasa[0];
    if (!bunga) throw new Error(`Bunga untuk joker ${id} tidak bisa ditebak. Tulis ${id}=${r}:waru (love/wajik/kriting/waru).`);
    return { id, sebagai: { rank: rank(r), bunga } };
  });
}

async function main() {
  switch (perintah) {
    case 'lihat':
      return get('/lihat');
    case 'json':
      return get('/json');
    case 'tunggu':
      return get(`/tunggu?detik=${Number(arg[0] ?? 240)}`);
    case 'siap':
      return kirim({ t: 'siapJoker' });
    case 'ambil':
      return aksi({ jenis: 'ambilDeck' });
    case 'mulung': {
      const jumlah = Number(arg[0]);
      if (!Number.isInteger(jumlah) || jumlah < 1) throw new Error('Pakai: mulung <jumlah> <kombinasi> [kombinasi...]');
      if (arg.length < 2) throw new Error('Mulung wajib menyertakan kartu jadi baru yang memuat kartu paling bawah pungutan.');
      return aksi({ jenis: 'mulung', jumlah, kartuJadi: arg.slice(1).map(kombinasi) });
    }
    case 'turunkan':
      if (!arg.length) throw new Error('Pakai: turunkan <kombinasi> [kombinasi...]');
      return aksi({ jenis: 'turunkan', kartuJadi: arg.map(kombinasi) });
    case 'buang': {
      if (!arg.length) throw new Error('Pakai: buang <id kartu> [id lain untuk nutup pakai beberapa joker]');
      const [kartuId, ...lain] = arg;
      return aksi({ jenis: 'buang', kartuId, ...(lain.length ? { kartuIdLain: lain } : {}) });
    }
    case 'selesai':
      return aksi({ jenis: 'selesaiSusun' });
    case 'emote':
      return kirim({ t: 'emote', isi: arg.join(' ') });
    case 'akhiri':
      return kirim({ t: 'akhiri', setuju: arg[0] !== 'tidak' });
    case 'kaldu':
      return kirim({ t: 'putaranTerakhir', setuju: arg[0] !== 'tidak' });
    case 'host': {
      const [sub, a1, a2] = arg;
      if (sub === 'mulai') return kirim({ t: 'mulai' });
      if (sub === 'berikut') return kirim({ t: 'putaranBerikut' });
      if (sub === 'mainlagi') return kirim({ t: 'mainLagi' });
      if (sub === 'bot') return kirim({ t: 'aturKursi', kursi: Number(a1), jenis: 'bot', level: a2 ?? 'normal' });
      if (sub === 'kosong') return kirim({ t: 'aturKursi', kursi: Number(a1), jenis: 'kosong' });
      if (sub === 'atur') return kirim({ t: 'pengaturan', pengaturan: JSON.parse(a1) });
      throw new Error('Pakai: host mulai|berikut|mainlagi|bot <kursi> [mudah|normal|jago|suhu]|kosong <kursi>|atur \'{"detikGiliran":0}\'');
    }
    case 'kirim':
      return kirim(JSON.parse(arg.join(' ')));
    case 'keluar':
      return kirim({ t: 'keluar' });
    case 'berhenti':
      return get('/berhenti');
    default:
      return 'Perintah: lihat | tunggu [detik] | json | siap | ambil | mulung <k> <kombinasi>... | turunkan <kombinasi>... | buang <id> [id...] | selesai | emote <teks> | akhiri ya|tidak | kaldu ya|tidak | host ... | kirim <json> | keluar | berhenti';
  }
}

main()
  .then((x) => console.log(x))
  .catch((e) => {
    if (e.cause?.code === 'ECONNREFUSED') console.error(`klien.mjs tidak jalan di port ${PORT}. Jalankan dulu: node scripts/klien.mjs --kode KODE --nama "Nama" (di latar belakang).`);
    else console.error('GAGAL: ' + e.message);
    process.exit(1);
  });
