// Layar penonton (keputusan pemilik #60, aturan minta lihat #62): nama pemain dan kartu buangan yang
// terlihat di meja, plus tombol minta lihat kartu per pemain. Satu permintaan sekaligus (semua tombol
// mati dengan hitung mundur 60 detik), dan jeda 30 menit sesudah melihat (juga dengan hitung mundur). Kartu tangan tidak pernah ada di sini; yang diizinkan pemain
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
  /** Gambar ulang tombol dari kabar terakhir (mis. sesudah permintaan ditolak server dengan galat). */
  pulihkanTombol(): void;
  lepas(): void;
}

/** Tombol baru hidup sekian sesudah jeda habis (pesan butuh waktu sampai); tidak ikut ditampilkan. */
const CADANGAN_JEDA_MS = 1000;

/** Lebar kartu buangan di layar penonton (px CSS). */
const LEBAR_KARTU = 56;

type Keadaan = InfoTontonan['pemain'][number]['minta'];

/**
 * Teks dan keadaan tombol satu kursi (#62). `sisaTunggu`: sisa batas jawab permintaan yang menunggu
 * (null = tidak ada permintaan); `sisaJeda`: sisa jeda sesudah melihat (≤ 0 = tidak sedang jeda);
 * `tertahan`: namamu sedang dipakai minta/lihat kartu dari tempat lain (`InfoTontonan.tertahan`).
 */
export function tombolMinta(minta: Keadaan, sisaTunggu: number | null, sisaJeda: number, tertahan = false): { teks: string; bisa: boolean } {
  switch (minta) {
    case 'menunggu':
      return { teks: T.menunggu(sisaTunggu ?? 0), bisa: false };
    case 'ditolak':
      return { teks: T.ditolak, bisa: false };
    case 'tidakDijawab':
      return { teks: T.tidakDijawab, bisa: false };
    case 'dilihat':
      return { teks: T.dilihat, bisa: false };
    case 'bisa':
      // Satu permintaan sekaligus, dan jeda sesudah melihat: semua tombol mati.
      if (sisaTunggu !== null) return { teks: T.tungguJawaban, bisa: false };
      if (sisaJeda > 0) return { teks: T.jedaTombol(sisaJeda), bisa: false };
      if (tertahan) return { teks: T.tertahanTombol, bisa: false };
      return { teks: T.minta, bisa: true };
    default:
      return { teks: T.tidakBisa, bisa: false };
  }
}

export function renderTontonan(akar: HTMLElement, awal: InfoTontonan, aksi: AksiTontonan): TontonanTerpasang {
  akar.innerHTML = `
  <div class="layar layar-tontonan"><div class="kolom">
    <div class="judul"><h1></h1><p class="redup"></p></div>
    <p class="pengantar">${esc(T.pengantar)}</p>
    <div class="kartu-panel"><h2>${esc(T.judulBuangan)}</h2><div class="buangan-tontonan"></div></div>
    <div class="kartu-panel"><h2>${esc(T.judulPemain)}</h2><ul class="daftar pemain-tontonan"></ul>
      <p class="hitung-tontonan rapat" hidden></p><p class="ket-blokir redup rapat" hidden>${esc(T.keteranganBlokir)}</p></div>
    <p class="status-tontonan redup" aria-live="polite"></p>
    <div class="deret"><button type="button" id="berhenti-nonton">${esc(T.berhenti)}</button></div>
  </div></div>`;
  const elJudul = akar.querySelector('h1')!;
  const elJumlah = akar.querySelector('.judul p')!;
  const elBuangan = akar.querySelector<HTMLElement>('.buangan-tontonan')!;
  const elPemain = akar.querySelector<HTMLElement>('.pemain-tontonan')!;
  // Hitung mundur sengaja di luar aria-live: berubah tiap detik dan akan terus dibacakan.
  const elHitung = akar.querySelector<HTMLElement>('.hitung-tontonan')!;
  const elBlokir = akar.querySelector<HTMLElement>('.ket-blokir')!;
  const elStatus = akar.querySelector<HTMLElement>('.status-tontonan')!;
  akar.querySelector('#berhenti-nonton')!.addEventListener('click', () => aksi.berhenti());
  elPemain.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-minta]');
    if (!b || b.disabled) return;
    // Cegah ketuk ganda sebelum jawaban server datang: semua tombol mati sampai kabar berikutnya.
    for (const x of elPemain.querySelectorAll<HTMLButtonElement>('button[data-minta]')) x.disabled = true;
    aksi.minta(Number(b.dataset.minta));
  });

  let info = awal;
  // Batas jawab dan akhir jeda sebagai waktu lokal (jam HP tidak dibandingkan dengan jam server).
  let akhirTunggu: number | null = null;
  let akhirJeda = 0;
  let kunciBuangan = '';

  const gambarPemain = () => {
    const sekarang = Date.now();
    const sisaTunggu = akhirTunggu === null ? null : Math.max(0, akhirTunggu - sekarang);
    // Jeda habis menurut jam HP: tombol hidup lagi tanpa menunggu kabar server (cadangan 1 detik).
    const sisaJeda = Math.max(0, akhirJeda - sekarang);
    const sisaJedaTampil = Math.max(0, sisaJeda - CADANGAN_JEDA_MS);
    elPemain.innerHTML = info.pemain
      .map((p, i) => {
        const { teks, bisa } = tombolMinta(p.minta, sisaTunggu, sisaJeda > 0 ? Math.max(1, sisaJedaTampil) : 0, info.tertahan === true);
        return `<li class="kursi baris-pemain-tontonan"><span class="nama"><b>${esc(p.nama)}</b></span>
          <button type="button" class="kecil${bisa ? ' utama' : ''}" data-minta="${i}" ${bisa ? '' : 'disabled'}>${esc(teks)}</button></li>`;
      })
      .join('');
    let hitung = '';
    if (sisaTunggu !== null && info.tunggu) hitung = T.hitungMenunggu(info.pemain[info.tunggu.kursi]?.nama ?? '', sisaTunggu);
    else if (sisaJeda > 0) hitung = T.hitungJeda(Math.max(1, sisaJedaTampil));
    else if (info.tertahan) hitung = T.tertahan;
    elHitung.textContent = hitung;
    elHitung.hidden = !hitung;
    elBlokir.hidden = !info.pemain.some((p) => p.minta === 'ditolak' || p.minta === 'tidakDijawab');
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
    akhirTunggu = baru.tunggu ? sekarang + baru.tunggu.sisaMs : null;
    akhirJeda = baru.jedaMs ? sekarang + baru.jedaMs + CADANGAN_JEDA_MS : 0;
    elJudul.textContent = T.judul(baru.namaHost);
    elJumlah.textContent = T.jumlahPenonton(baru.jumlahPenonton);
    elStatus.textContent = baru.status === 'selesai' ? T.selesaiPermainan : '';
    gambarBuangan();
    gambarPemain();
  };
  perbarui(awal);

  // Hitung mundur tiap detik selama ada permintaan yang menunggu atau jeda sesudah melihat.
  const timer = setInterval(() => {
    if (!akarMasihAda()) return clearInterval(timer);
    if (akhirTunggu === null && !akhirJeda) return;
    // Jeda habis: gambar sekali lagi (tombol hidup), lalu berhenti menggambar ulang.
    if (akhirJeda && Date.now() >= akhirJeda) akhirJeda = 0;
    const fokus = (document.activeElement as HTMLElement | null)?.dataset?.minta;
    gambarPemain();
    if (fokus !== undefined) elPemain.querySelector<HTMLElement>(`[data-minta="${fokus}"]`)?.focus();
  }, 1000);
  const akarMasihAda = () => elPemain.isConnected;

  return {
    perbarui,
    pulihkanTombol: () => gambarPemain(),
    lepas: () => clearInterval(timer),
  };
}
