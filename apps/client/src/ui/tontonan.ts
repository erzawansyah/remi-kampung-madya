// Layar penonton (keputusan pemilik #60): nama pemain dan kartu buangan yang terlihat di meja, plus
// tombol minta lihat kartu per pemain. Kartu tangan tidak pernah ada di sini; yang diizinkan pemain
// ditampilkan lewat meja biasa (KontrolMeja mode penonton, lihat main.ts).

import type { InfoTontonan } from '@remi/meja';
import { gambarKartuKeKanvas } from '../game/kartuGrafisGambar';
import { TEKS_TONTONAN as T } from '../konten/tontonan';
import { esc } from './dom';

export interface AksiTontonan {
  minta(kursi: number): void;
  berhenti(): void;
}

export interface TontonanTerpasang {
  perbarui(info: InfoTontonan): void;
  lepas(): void;
}

/** Tombol baru hidup sekian sesudah jeda habis (pesan butuh waktu sampai); tidak ikut ditampilkan. */
const CADANGAN_JEDA_MS = 1000;

/** Lebar kartu buangan di layar penonton (px CSS). */
const LEBAR_KARTU = 56;

/** Teks tombol satu kursi; `sisaMs` hanya untuk 'jeda'. */
export function teksTombolMinta(minta: InfoTontonan['pemain'][number]['minta'], sisaMs: number): string {
  switch (minta) {
    case 'bisa':
      return T.minta;
    case 'menunggu':
      return T.menunggu;
    case 'jeda':
      return T.jeda(sisaMs);
    case 'dilihat':
      return T.dilihat;
    default:
      return T.tidakBisa;
  }
}

export function renderTontonan(akar: HTMLElement, awal: InfoTontonan, aksi: AksiTontonan): TontonanTerpasang {
  akar.innerHTML = `
  <div class="layar layar-tontonan"><div class="kolom">
    <div class="judul"><h1></h1><p class="redup"></p></div>
    <p class="pengantar">${esc(T.pengantar)}</p>
    <div class="kartu-panel"><h2>${esc(T.judulBuangan)}</h2><div class="buangan-tontonan"></div></div>
    <div class="kartu-panel"><h2>${esc(T.judulPemain)}</h2><ul class="daftar pemain-tontonan"></ul></div>
    <p class="status-tontonan redup" aria-live="polite"></p>
    <div class="deret"><button type="button" id="berhenti-nonton">${esc(T.berhenti)}</button></div>
  </div></div>`;
  const elJudul = akar.querySelector('h1')!;
  const elJumlah = akar.querySelector('.judul p')!;
  const elBuangan = akar.querySelector<HTMLElement>('.buangan-tontonan')!;
  const elPemain = akar.querySelector<HTMLElement>('.pemain-tontonan')!;
  const elStatus = akar.querySelector<HTMLElement>('.status-tontonan')!;
  akar.querySelector('#berhenti-nonton')!.addEventListener('click', () => aksi.berhenti());
  elPemain.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-minta]');
    if (!b || b.disabled) return;
    // Cegah ketuk ganda sebelum jawaban server datang.
    b.disabled = true;
    aksi.minta(Number(b.dataset.minta));
  });

  let info = awal;
  /** Jeda per kursi sebagai waktu lokal (jam HP tidak dibandingkan dengan jam server). */
  let akhirJeda = new Map<number, number>();
  let kunciBuangan = '';

  const gambarPemain = () => {
    const sekarang = Date.now();
    elPemain.innerHTML = info.pemain
      .map((p, i) => {
        const sisa = Math.max(0, (akhirJeda.get(i) ?? sekarang) - sekarang);
        // Jeda habis menurut jam HP: tombol hidup lagi tanpa menunggu kabar server (server tidak
        // mengirim apa-apa saat jeda habis).
        const minta = p.minta === 'jeda' && sisa <= 0 ? 'bisa' : p.minta;
        const bisa = minta === 'bisa';
        return `<li class="kursi baris-pemain-tontonan"><span class="nama"><b>${esc(p.nama)}</b></span>
          <button type="button" class="kecil${bisa ? ' utama' : ''}" data-minta="${i}" ${bisa ? '' : 'disabled'}>${esc(teksTombolMinta(minta, Math.max(1, sisa - CADANGAN_JEDA_MS)))}</button></li>`;
      })
      .join('');
  };

  const gambarBuangan = () => {
    const kunci = info.buangan.map((k) => k.id).join(',');
    if (kunci === kunciBuangan) return;
    kunciBuangan = kunci;
    elBuangan.innerHTML = '';
    if (!info.buangan.length) {
      elBuangan.innerHTML = `<p class="redup rapat">${esc(T.buanganKosong)}</p>`;
      return;
    }
    const deret = document.createElement('div');
    deret.className = 'deret-kartu';
    for (const k of info.buangan) deret.appendChild(gambarKartuKeKanvas(k, LEBAR_KARTU));
    elBuangan.appendChild(deret);
  };

  const perbarui = (baru: InfoTontonan) => {
    info = baru;
    const sekarang = Date.now();
    akhirJeda = new Map(baru.pemain.flatMap((p, i) => (p.minta === 'jeda' && p.jedaMs ? [[i, sekarang + p.jedaMs + CADANGAN_JEDA_MS] as const] : [])));
    elJudul.textContent = T.judul(baru.namaHost);
    elJumlah.textContent = T.jumlahPenonton(baru.jumlahPenonton);
    elStatus.textContent = baru.status === 'selesai' ? T.selesaiPermainan : '';
    gambarBuangan();
    gambarPemain();
  };
  perbarui(awal);

  // Hitung mundur jeda tiap detik (hanya teks tombolnya).
  const timer = setInterval(() => {
    if (!akarMasihAda()) return clearInterval(timer);
    // Jangan menggambar ulang saat tombol sedang difokus keyboard tanpa perubahan: cukup kalau ada jeda.
    if (akhirJeda.size) {
      const fokus = (document.activeElement as HTMLElement | null)?.dataset?.minta;
      gambarPemain();
      if (fokus !== undefined) elPemain.querySelector<HTMLElement>(`[data-minta="${fokus}"]`)?.focus();
    }
  }, 1000);
  const akarMasihAda = () => elPemain.isConnected;

  return {
    perbarui,
    lepas: () => clearInterval(timer),
  };
}
