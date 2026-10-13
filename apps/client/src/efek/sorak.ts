// Sorakan besar di tengah layar ("KEMBAR AS!", "KARTUMU DIPUNGUT!", ...), diantrikan supaya tidak menumpuk.
// - Antrian dibatasi: sorakan lama yang belum sempat tampil dibuang kalau antrian terlalu panjang
//   (promise-nya tetap selesai), supaya meja tidak tertinggal jauh di belakang kejadian.
// - bersihkanSorak() menaikkan "generasi": timer sorakan yang sedang tampil dari generasi lama tidak
//   lagi menyentuh antrian baru (tidak ada dua sorakan tampil bersamaan).
// - Gerak dikurangi ditangani CSS (gaya/gerak.css: sorak-pudar).

export type GayaSorak = 'emas' | 'merah' | 'biru' | 'bahaya';

export interface Sorak {
  judul: string;
  sub?: string;
  gaya?: GayaSorak;
  /** ms */
  durasi?: number;
}

/** Jumlah sorakan maksimal yang menunggu giliran tampil. */
const MAKS_ANTRIAN = 3;

const antrian: { s: Sorak; selesai: () => void }[] = [];
let berjalan = false;
let generasi = 0;

function wadah(): HTMLElement {
  let el = document.getElementById('sorak');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sorak';
    document.body.appendChild(el);
  }
  return el;
}

function berikut() {
  const item = antrian.shift();
  if (!item) {
    berjalan = false;
    return;
  }
  berjalan = true;
  const gen = generasi;
  const { s, selesai } = item;
  const durasi = s.durasi ?? 1500;
  const el = document.createElement('div');
  el.className = `sorak ${s.gaya ?? 'emas'}`;
  el.style.setProperty('--durasi', `${durasi}ms`);
  // Sengaja tanpa aria-live: sub-teks bisa menyebut kartu yang dibuang; pengumuman pembaca layar
  // diatur terpisah (ui/dom.ts umumkan) supaya tidak membocorkan kartu buangan.
  el.setAttribute('aria-hidden', 'true');
  const judul = document.createElement('div');
  judul.className = 'judul-sorak';
  judul.textContent = s.judul;
  el.appendChild(judul);
  if (s.sub) {
    const sub = document.createElement('div');
    sub.className = 'sub-sorak';
    sub.textContent = s.sub;
    el.appendChild(sub);
  }
  wadah().appendChild(el);
  setTimeout(() => {
    el.remove();
    selesai();
    // Sudah dibersihkan sejak sorakan ini tampil: antrian sekarang milik generasi baru.
    if (gen === generasi) berikut();
  }, durasi);
}

/** Tampilkan sorakan; promise selesai saat sorakan ini hilang (atau dibuang dari antrian). */
export function sorak(s: Sorak): Promise<void> {
  return new Promise((ok) => {
    antrian.push({ s, selesai: ok });
    // Yang paling lama menunggu dibuang dulu: kejadian terbaru lebih penting.
    while (antrian.length > MAKS_ANTRIAN) antrian.shift()!.selesai();
    if (!berjalan) berikut();
  });
}

export function bersihkanSorak(): void {
  generasi++;
  antrian.splice(0).forEach((x) => x.selesai());
  wadah().innerHTML = '';
  berjalan = false;
}
