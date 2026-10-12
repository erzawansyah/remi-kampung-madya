// Sorakan besar di tengah layar ("MENTUNG!", "DOUBLE PENTUNG!", ...), diantrikan supaya tidak menumpuk.

export type GayaSorak = 'emas' | 'merah' | 'biru' | 'bahaya';

export interface Sorak {
  judul: string;
  sub?: string;
  gaya?: GayaSorak;
  /** ms */
  durasi?: number;
}

const antrian: { s: Sorak; selesai: () => void }[] = [];
let berjalan = false;

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
  const { s, selesai } = item;
  const durasi = s.durasi ?? 1500;
  const el = document.createElement('div');
  el.className = `sorak ${s.gaya ?? 'emas'}`;
  el.style.setProperty('--durasi', `${durasi}ms`);
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
    berikut();
  }, durasi);
}

/** Tampilkan sorakan; promise selesai saat sorakan ini hilang. */
export function sorak(s: Sorak): Promise<void> {
  return new Promise((ok) => {
    antrian.push({ s, selesai: ok });
    if (!berjalan) berikut();
  });
}

export function bersihkanSorak(): void {
  antrian.splice(0).forEach((x) => x.selesai());
  wadah().innerHTML = '';
  berjalan = false;
}
