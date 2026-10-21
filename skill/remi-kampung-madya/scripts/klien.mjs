#!/usr/bin/env node
// Client Remi Kampung Madya untuk agent AI.
// Tetap tersambung ke server (WebSocket), menyimpan state terakhir, dan membuka HTTP lokal
// supaya agent bisa membaca meja dan mengirim aksi lewat scripts/remi.mjs.
//
//   node klien.mjs --kode ABCDE --nama "Claude AI"            gabung meja
//   node klien.mjs --buat --nama "Claude AI" [--pengaturan '{"jumlahPemain":2}']   buat meja (jadi host)
// Opsi: --server wss://... (bawaan server live), --port 9333, --data <folder sesi>
//
// Butuh Node 22+ (WebSocket global). Tanpa dependensi.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const arg = parseArg(process.argv.slice(2));
const SERVER = arg.server ?? 'wss://remi-madya.likrea.biz.id/ws';
const PORT = Number(arg.port ?? 9333);
const DATA = path.resolve(arg.data ?? '.remi-sesi');
const FILE_SESI = path.join(DATA, 'sesi.json');

if (typeof WebSocket !== 'function') {
  console.error('WebSocket global tidak ada. Pakai Node 22 atau lebih baru.');
  process.exit(1);
}
if (!arg.nama || (!arg.kode && !arg.buat)) {
  console.error('Pakai: node klien.mjs --kode KODE --nama "Nama"   atau   node klien.mjs --buat --nama "Nama"');
  process.exit(1);
}

fs.mkdirSync(DATA, { recursive: true });
let sesi = bacaJson(FILE_SESI) ?? {};
if (arg.kode && sesi.kode !== arg.kode.toUpperCase()) sesi = {};
sesi.nama = arg.nama;
if (arg.kode) sesi.kode = arg.kode.toUpperCase();

const s = {
  ws: null,
  tersambung: false,
  view: null,
  meja: null,
  kursi: sesi.kursi ?? null,
  kotak: [], // pesan lain (error, emote, keluar) yang belum dibaca agent
  galatTerakhir: null,
  versi: 0, // naik setiap ada pesan view/meja/error
  peristiwa: new Map(), // id-putaran → peristiwa, dikumpulkan dari semua view
  joker: null, // pengumuman joker putaran berjalan: {nomor, rank, kartu, pengocok}
  jokerSudahOk: null, // nomor putaran yang pengumumannya sudah di-OK
  hasilTerlapor: null, // kunci status yang sudah dilaporkan tunggu()
};
const penunggu = new Set();

function sambung() {
  const ws = new WebSocket(SERVER);
  s.ws = ws;
  ws.onopen = () => {
    s.tersambung = true;
    if (sesi.kode) kirim({ t: 'gabung', kode: sesi.kode, nama: sesi.nama, ...(sesi.token ? { token: sesi.token } : {}) });
    else kirim({ t: 'buat', nama: sesi.nama, pengaturan: arg.pengaturan ? JSON.parse(arg.pengaturan) : undefined });
    log(`tersambung ke ${SERVER}`);
  };
  ws.onmessage = (e) => terima(JSON.parse(e.data));
  ws.onclose = () => {
    s.tersambung = false;
    if (s.berhenti) return;
    log('sambungan putus, coba lagi 2 detik lagi');
    setTimeout(sambung, 2000);
  };
  ws.onerror = () => {};
}

function terima(m) {
  switch (m.t) {
    case 'masuk':
      sesi.kode = m.kode;
      sesi.token = m.token;
      sesi.kursi = m.kursi;
      s.kursi = m.kursi;
      tulisJson(FILE_SESI, sesi);
      log(`duduk di meja ${m.kode}, kursi ${m.kursi}`);
      break;
    case 'view':
      s.view = m.view;
      for (const p of m.view.peristiwa ?? []) s.peristiwa.set(`${p.putaran}-${p.id}`, p);
      catatJoker(m.view);
      break;
    case 'meja':
      s.meja = m.info;
      if (m.info.kursiSaya !== null && m.info.kursiSaya !== undefined) s.kursi = m.info.kursiSaya;
      break;
    case 'pong':
      return;
    case 'error':
      s.galatTerakhir = m.pesan;
      s.kotak.push(m);
      break;
    case 'emote':
      // Server memantulkan emote kita sendiri; tidak perlu dicatat.
      if (m.kursi === s.kursi) return;
      s.kotak.push(m);
      break;
    case 'keluar':
      s.kotak.push(m);
      log(`dikeluarkan dari meja: ${m.alasan}`);
      break;
    default:
      s.kotak.push(m);
  }
  if (s.kotak.length > 200) s.kotak.splice(0, s.kotak.length - 200);
  s.versi++;
  for (const f of penunggu) f();
}

// Pengumuman joker: disimpan saat putaran baru terlihat, ditampilkan sampai agent menekan OK.
function catatJoker(v) {
  const p = v.putaran;
  if (!p) return;
  if (!s.joker || s.joker.nomor !== p.nomor) {
    s.joker = { nomor: p.nomor, rank: p.rankJoker, kartu: p.kartuDibuka, pengocok: p.pengocok };
  }
}
function jokerPerluOk() {
  if (!s.joker || !s.view?.putaran) return false;
  const nunggu = s.meja?.menungguJoker ?? [];
  if (s.kursi !== null && nunggu.includes(s.kursi)) return true;
  return false;
}

function kirim(obj) {
  if (!s.ws || s.ws.readyState !== WebSocket.OPEN) throw new Error('Belum tersambung ke server.');
  if (obj.t === 'siapJoker' && s.joker) s.jokerSudahOk = s.joker.nomor;
  s.ws.send(JSON.stringify(obj));
}

// ---------- Ringkasan teks untuk agent ----------

const RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const BUNGA = { love: '♥', wajik: '♦', kriting: '♣', waru: '♠' };
const k = (c) => `${RANK[c.rank] ?? c.rank}${BUNGA[c.bunga]}${c.deck ? "'" : ''}`;
const kid = (c) => `${k(c)} [${c.id}]`;
// Panah hanya untuk joker pengganti (kartu yang mewakili angka/bunga lain).
const peran = (c, x) => (x && (x.rank !== c.rank || x.bunga !== c.bunga) ? `→${RANK[x.rank] ?? x.rank}${BUNGA[x.bunga] ?? ''}` : '');

function perluAksi() {
  const v = s.view;
  if (jokerPerluOk()) return 'joker';
  if (!v || v.saya === null || v.saya === undefined) return null;
  const p = v.putaran;
  if (v.status === 'putaranBerjalan' && p && p.giliran === v.saya && !(s.meja?.menungguJoker ?? []).length) return 'giliran';
  if (v.status === 'susunAkhir' && p && !p.selesaiSusun?.[v.saya]) return 'susun';
  return null;
}

function lihat() {
  const out = [];
  const m = s.meja;
  const v = s.view;
  out.push(`sambungan: ${s.tersambung ? 'tersambung' : 'PUTUS (menyambung ulang)'} · meja ${sesi.kode ?? '?'} · kursimu ${s.kursi ?? '?'}`);
  if (m) {
    const kursi = m.kursi.map((x, i) => `${i}:${x.nama}${x.jenis === 'bot' ? `(warga kedai ${x.level})` : x.jenis === 'kosong' ? '(kosong)' : x.terhubung ? '' : '(terputus)'}${i === m.host ? '*host' : ''}`);
    const pg = m.pengaturan;
    out.push(`meja: status=${m.status} · ${kursi.join(' | ')}`);
    out.push(
      `pengaturan: ${pg.jumlahPemain} pemain${pg.duaDeckUntukEmpat ? ' (2 deck)' : ''} · warga kedai ${pg.levelBot}, tempo ${pg.tempoBot}${pg.publik ? ' · publik' : ''} · batas putaran ${pg.batasPutaran ?? 'tanpa'} · waktu/giliran ${pg.detikGiliran ? pg.detikGiliran + ' dtk' : 'tanpa batas'}${pg.modeKaldu ? ' · MODE KALDU' : ''} · batas skor ${pg.batasSkorAtas ?? '-'}/${pg.batasSkorBawah ?? '-'}`,
    );
    if (m.batasWaktu) out.push(`sisa waktu giliran: ${Math.max(0, Math.round((m.batasWaktu - Date.now()) / 1000))} dtk${m.diambilAlihBot ? ' (sedang diambil alih warga kedai)' : ''}`);
    if (m.setujuAkhiri?.length) out.push(`setuju akhiri: kursi ${m.setujuAkhiri.join(',')}`);
  }
  if (jokerPerluOk()) {
    const j = s.joker;
    out.push('');
    out.push(`*** PENGUMUMAN JOKER putaran ${j.nomor}: ${v.pemain[j.pengocok]?.nama ?? '?'} membuka ${j.kartu ? k(j.kartu) : '?'}. SEMUA kartu ${RANK[j.rank] ?? j.rank} jadi joker putaran ini. ***`);
    out.push('*** Ingat baik-baik: sesudah kamu menekan OK (remi.mjs siap), angka ini tidak ditampilkan lagi. ***');
  }
  if (!v) {
    const host = m && s.kursi === m.host;
    const kosong = m ? m.kursi.filter((x) => x.jenis === 'kosong').length : 0;
    out.push('');
    out.push(
      !m
        ? 'Belum masuk meja. Tunggu sebentar lalu `remi.mjs lihat`.'
        : host
          ? `LOBI, kamu host: ${kosong ? `${kosong} kursi kosong (tunggu orang masuk, atau \`remi.mjs host bot <kursi> [level]\`), ` : ''}atur dengan \`remi.mjs host atur '<json>'\`, lalu \`remi.mjs host mulai\` kalau sudah sesuai permintaan pengguna.`
          : 'LOBI: tunggu host memulai (`remi.mjs tunggu`).',
    );
    const obrolan = bagianPesan(out, m ? m.kursi.map((x) => x.nama) : []);
    if (obrolan.some(dariManusia)) out.push('(Boleh dibalas: `remi.mjs emote <teks>`, maks 60 huruf, lihat bagian Ngobrol di SKILL.md.)');
    return out.join('\n');
  }
  const p = v.putaran;
  const n = v.pemain.length;
  const nama = v.pemain.map((x) => x.nama);
  out.push('');
  out.push(`permainan: status=${v.status}${p ? ` · putaran ${p.nomor}${p.kaldu ? ' (KALDU, pentungan ×2)' : ''}` : ''} · skor: ${nama.map((x, i) => `${x} ${v.skor[i]}`).join(', ')}`);
  if (v.kalduDiminta) out.push('putaran berikutnya: KALDU');
  if (p) {
    const urut = [];
    for (let i = 0, g = p.giliran; i < n; i++, g = (g + p.arah + n) % n) urut.push(nama[g]);
    const sesudahku = nama[(v.saya + p.arah + n) % n];
    out.push(`giliran: ${nama[p.giliran]} · tahap ${p.tahap} · urutan: ${urut.join(' → ')} · buanganmu diterima ${sesudahku}`);
    out.push(`deck: ${p.jumlahDeck} kartu${p.deckHabis ? ' (HABIS)' : ''} · kartu di tangan: ${nama.map((x, i) => `${x} ${p.jumlahKartuTangan[i]}`).join(', ')}`);
    out.push(`TANGANMU (${p.tangan[v.saya]?.length ?? 0}): ${(p.tangan[v.saya] ?? []).map(kid).join('  ')}`);
    out.push(`buangan terlihat (bawah → ATAS): ${p.buangan.map((b) => `${kid(b.kartu)} dari ${nama[b.pemilik]}`).join(' · ') || '(kosong)'} · total ${p.jumlahBuangan}`);
    p.kartuJadi.forEach((daftar, i) => {
      if (daftar.length) out.push(`kartu jadi ${nama[i]}: ${daftar.map((kj) => kj.kartu.map((d) => k(d.kartu) + peran(d.kartu, d.sebagai)).join(' ')).join(' | ')}`);
    });
    if (p.jokerMati?.length) out.push(`joker mati (sudah dibuang, jadi kartu biasa): ${p.jokerMati.map(k).join(' ')}`);
    if (p.pungutan?.length) out.push(`pungutan giliran ini: ${p.pungutan.map((x) => k(x.kartu ?? x)).join(' ')}`);
    if (p.mentung) {
      const mt = p.mentung;
      out.push(`MENTUNG: ${nama[mt.pemain]} pakai ${[mt.pentungan, ...(mt.pentunganLain ?? [])].map(k).join('+')} · kepentung: ${mt.kepentung.map((i) => nama[i]).join(', ') || 'tidak ada'}`);
    }
    // Ingatan buangan putaran ini (semua orang melihat kartu yang dibuang).
    const per = nama.map(() => []);
    [...s.peristiwa.values()]
      .filter((e) => e.putaran === p.nomor)
      .sort((a, b) => a.id - b.id)
      .forEach((e) => {
        if (e.jenis === 'buang') per[e.pemain].push(k(e.kartu) + (e.kartuLain?.length ? '+' + e.kartuLain.map(k).join('+') : ''));
        else if (e.jenis === 'mulung') per[e.pemain].push(`[mulung ${e.jumlah ?? ''}]`.replace(' ]', ']'));
        else if (e.jenis === 'turunkan') per[e.pemain].push('[turun]');
      });
    out.push(`riwayat buang putaran ini: ${nama.map((x, i) => `${x}: ${per[i].join(' ') || '-'}`).join(' || ')}`);
  }
  if (v.status === 'putaranSelesai' || v.status === 'selesai') {
    const h = v.riwayat.at(-1);
    if (h) {
      const sebelum = v.riwayat.at(-2)?.skorAkumulasi ?? nama.map(() => 0);
      const cara = h.cara === 'mentung' ? `${nama[h.pementung]} mentung (nilai ${h.nilaiPentungan}), kepentung: ${h.kepentung.map((i) => nama[i]).join(', ') || '-'}` : 'deck habis';
      out.push(`hasil putaran ${h.nomor}${h.kaldu ? ' (kaldu)' : ''}: ${cara} · ${nama.map((x, i) => `${x} ${tanda(h.skorAkumulasi[i] - sebelum[i])}`).join(', ')}`);
    }
    if (v.status === 'selesai') out.push(`PERMAINAN SELESAI (${v.alasanSelesai ?? '-'}). Skor akhir: ${nama.map((x, i) => `${x} ${v.skor[i]}`).join(', ')}`);
    else out.push('menunggu host memulai putaran berikutnya.');
  }
  out.push(`log: ${v.log.slice(-6).map((l) => l.pesan).join(' / ')}`);
  const obrolan = bagianPesan(out, nama);
  const a = perluAksi();
  if (obrolan.some(dariManusia)) out.push('(Boleh dibalas: `remi.mjs emote <teks>`, maks 60 huruf, lihat bagian Ngobrol di SKILL.md.)');
  out.push('');
  out.push(
    a === 'joker'
      ? 'PERLU AKSIMU: catat angka joker, lalu `remi.mjs siap`.'
      : a === 'giliran'
        ? `PERLU AKSIMU: giliranmu, tahap ${p.tahap === 'ambil' ? "'ambil' → ambil atau mulung" : "'main' → turunkan (opsional) lalu buang"}.`
        : a === 'susun'
          ? 'PERLU AKSIMU: susun akhir → turunkan kartu jadi dari tangan kalau ada, lalu `remi.mjs selesai`.'
          : v.status === 'selesai'
            ? 'PERMAINAN SELESAI: laporkan klasemen ke pengguna, lalu `remi.mjs keluar` (kecuali pengguna minta main lagi).'
            : v.status === 'putaranSelesai'
              ? s.kursi === m?.host
                ? 'PUTARAN SELESAI: kamu host. Sesudah manusia sempat melihat hasil, `remi.mjs host berikut`.'
                : 'PUTARAN SELESAI: tunggu host memulai putaran berikutnya (`remi.mjs tunggu`).'
              : 'Belum giliranmu. Pakai `remi.mjs tunggu`.',
  );
  return out.join('\n');
}
function bagianPesan(out, nama) {
  const lain = s.kotak.splice(0);
  const obrolan = lain.filter((x) => x.t === 'emote');
  const lainnya = lain.filter((x) => x.t !== 'emote');
  if (lainnya.length) out.push(`pesan masuk: ${lainnya.map((x) => (x.t === 'error' ? `DITOLAK: ${x.pesan}` : JSON.stringify(x))).join(' · ')}`);
  if (obrolan.length) {
    out.push('obrolan meja:');
    for (const x of obrolan) {
      const siapa = nama[x.kursi] ?? s.meja?.kursi[x.kursi]?.nama ?? `kursi ${x.kursi}`;
      const tag = dariManusia(x) ? (menyebutku(x.isi) ? 'manusia, MENYEBUT KAMU' : 'manusia') : 'warga kedai';
      out.push(`  ${siapa} (${tag}): "${x.isi}"`);
    }
  }
  return obrolan;
}

const dariManusia = (x) => x.t === 'emote' && x.kursi !== s.kursi && s.meja?.kursi[x.kursi]?.jenis === 'manusia';
function menyebutku(isi) {
  const t = isi.toLocaleLowerCase('id-ID');
  const kata = (sesi.nama ?? '').toLocaleLowerCase('id-ID').split(/\s+/).filter((w) => w.length >= 3 && w !== 'ai');
  return kata.some((w) => t.includes(w)) || /\b(ai|bot)\b/.test(t);
}
const tanda = (x) => (typeof x === 'number' ? (x > 0 ? '+' + x : String(x)) : '?');

// JSON untuk agent yang mau membaca mentah. Angka joker dibuang kecuali pengumumannya belum di-OK.
function jsonAman() {
  const v = s.view ? structuredClone(s.view) : null;
  if (v?.putaran && !jokerPerluOk()) {
    delete v.putaran.rankJoker;
    delete v.putaran.kartuDibuka;
  }
  if (v) v.peristiwa = (v.peristiwa ?? []).map((p) => {
    const { rankJoker, ...sisa } = p;
    return jokerPerluOk() ? p : sisa;
  });
  return { tersambung: s.tersambung, kursi: s.kursi, meja: s.meja, view: v, perluAksi: perluAksi(), pesan: s.kotak.splice(0) };
}

// Tunggu sampai ada yang perlu dikerjakan agent, atau sesuatu yang penting berubah.
function tunggu(maksDetik) {
  return new Promise((selesai) => {
    const awal = s.versi;
    const kunciStatus = () => `${s.meja?.status}|${s.view?.status}|${s.view?.putaran?.nomor}|${s.meja?.status === 'lobi' ? s.meja.kursi.map((x) => x.jenis + x.nama).join(',') : ''}`;
    const statusAwal = kunciStatus();
    const cek = () => {
      const a = perluAksi();
      const kunci = kunciStatus();
      const adaPesan = s.kotak.some((x) => x.t === 'error' || x.t === 'keluar' || (x.t === 'emote' && dariManusia(x)));
      if (a || (kunci !== statusAwal && s.versi !== awal) || adaPesan) return beres();
      if (s.view && (s.view.status === 'putaranSelesai' || s.view.status === 'selesai') && s.hasilTerlapor !== kunci) {
        s.hasilTerlapor = kunci;
        return beres();
      }
    };
    const beres = () => {
      clearTimeout(t);
      penunggu.delete(cek);
      selesai(lihat());
    };
    const t = setTimeout(beres, maksDetik * 1000);
    penunggu.add(cek);
    cek();
  });
}

// Kirim lalu tunggu jawaban server (view/meja/error baru) maksimal beberapa detik.
function kirimDanTunggu(obj) {
  return new Promise((selesai) => {
    const awal = s.versi;
    try {
      kirim(obj);
    } catch (e) {
      return selesai('GAGAL: ' + e.message);
    }
    if (obj.t === 'emote' || obj.t === 'keluar') return setTimeout(() => selesai('terkirim'), 300);
    const cek = () => {
      if (s.versi !== awal) {
        // Beri waktu sebentar supaya view dan meja yang datang beruntun ikut masuk.
        setTimeout(() => {
          penunggu.delete(cek);
          clearTimeout(t);
          selesai(lihat());
        }, 400);
        penunggu.delete(cek);
      }
    };
    const t = setTimeout(() => {
      penunggu.delete(cek);
      selesai('Belum ada jawaban server dalam 5 detik. Cek lagi dengan `remi.mjs lihat`; kalau view tidak berubah, kirim ulang.\n\n' + lihat());
    }, 5000);
    penunggu.add(cek);
  });
}

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, 'http://lokal');
    let body = '';
    for await (const c of req) body += c;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    try {
      if (u.pathname === '/lihat') return res.end(lihat());
      if (u.pathname === '/json') return res.end(JSON.stringify(jsonAman()));
      if (u.pathname === '/tunggu') return res.end(await tunggu(Math.min(600, Number(u.searchParams.get('detik') ?? 240))));
      if (u.pathname === '/kirim') {
        const obj = JSON.parse(body);
        const hasil = await kirimDanTunggu(obj);
        if (obj.t === 'keluar') setTimeout(berhenti, 500);
        return res.end(hasil);
      }
      if (u.pathname === '/berhenti') {
        res.end('client berhenti');
        return setTimeout(berhenti, 200);
      }
      res.statusCode = 404;
      res.end('endpoint: /lihat /json /tunggu?detik=N /kirim (POST JSON) /berhenti');
    } catch (e) {
      res.statusCode = 500;
      res.end('GALAT: ' + e.message);
    }
  })
  .listen(PORT, '127.0.0.1', () => log(`kontrol lokal di http://127.0.0.1:${PORT} (pakai scripts/remi.mjs)`))
  .on('error', (e) => {
    console.error(`Port ${PORT} dipakai proses lain (${e.code}). Jalankan dengan --port lain, dan set REMI_PORT yang sama untuk remi.mjs.`);
    process.exit(1);
  });

function berhenti() {
  s.berhenti = true;
  try {
    s.ws?.close();
  } catch {}
  log('client berhenti');
  process.exit(0);
}

setInterval(() => {
  try {
    if (s.ws?.readyState === WebSocket.OPEN) s.ws.send('{"t":"ping"}');
  } catch {}
}, 25000);

sambung();

function parseArg(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const kunci = a[i].slice(2);
    const nilai = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
    o[kunci] = nilai;
  }
  return o;
}
function bacaJson(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}
function tulisJson(f, x) {
  fs.writeFileSync(f, JSON.stringify(x, null, 2));
}
function log(x) {
  console.log(`[${new Date().toLocaleTimeString('id-ID')}] ${x}`);
}
