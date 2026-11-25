// Layar Sprint (keputusan pemilik 25 Nov 2026): satu kalimat pembuka, tombol Main sprint, dan papan
// sprint dari server (GET /api/sprint) dengan dua tab: Minggu ini dan Sepanjang masa. Kolom Menang,
// Mentung, Kepentung, Skor; judul kolom bisa diketuk untuk mengurutkan (urutannya dari @remi/meja,
// urutkanSprint, jadi aturan urutan tetap satu sumber). Piala juara mingguan di samping nama.
// Sprint hanya online: permainannya dijalankan server supaya rekornya tidak bisa diakali dari HP.

import { KOLOM_SPRINT, kunciNama, urutkanSprint, type BarisSprint, type KolomSprint } from '@remi/meja';
import { ariaPiala, TEKS_SPRINT as T, teksPiala } from '../konten/sprint';
import { simpan } from '../penyimpanan';
import { esc, toast } from './dom';
import { angkaSkor } from './rincianSkor';

export type PeriodeSprint = 'minggu' | 'semua';

/** Jawaban GET /api/sprint. */
export interface PapanSprint {
  periode: PeriodeSprint;
  /** Awal minggu (ms epoch) untuk periode minggu; null untuk sepanjang masa. */
  mulai: number | null;
  baris: BarisSprint[];
}

export interface AksiSprint {
  kembali(): void;
  /** Mulai satu percobaan sprint (kirim {t:'sprint'} lewat jalur online yang sama dengan Buat meja). */
  main(): void;
}

export interface SprintTerpasang {
  /** Tombol Main sprint sedang menunggu jawaban server (atau tidak lagi). */
  aturSibuk(sibuk: boolean): void;
}

const MEDALI = ['🥇', '🥈', '🥉'];

/** Dibaca lewat fungsi supaya nilainya selalu yang terbaru (bisa berubah selagi menunggu server). */
const offline = (): boolean => navigator.onLine === false;

const angka = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** Rapikan jawaban server (data dari jaringan); null kalau bentuknya tidak dikenal. */
export function rapikanPapanSprint(x: unknown): PapanSprint | null {
  if (!x || typeof x !== 'object') return null;
  const p = x as Partial<PapanSprint>;
  if (!Array.isArray(p.baris)) return null;
  const baris = p.baris
    .filter((b): b is BarisSprint => !!b && typeof b === 'object' && typeof (b as BarisSprint).nama === 'string')
    .map((b) => ({
      nama: b.nama,
      menang: angka(b.menang),
      mentung: angka(b.mentung),
      kepentung: angka(b.kepentung),
      skor: angka(b.skor),
      piala: Math.max(0, Math.floor(angka(b.piala))),
    }));
  return { periode: p.periode === 'semua' ? 'semua' : 'minggu', mulai: typeof p.mulai === 'number' ? p.mulai : null, baris };
}

/** Piala juara mingguan di samping nama. */
export function htmlPialaSprint(n: number): string {
  const teks = teksPiala(n);
  return teks ? ` <span class="piala" role="img" aria-label="${esc(ariaPiala(n))}">${teks}</span>` : '';
}

/**
 * Tabel papan sprint, diurutkan `kolom` (null = urutan bawaan). Baris milik `namaSaya` (tanpa beda huruf
 * besar/kecil) disorot. Judul kolom angka berupa tombol `data-kolom`.
 */
export function htmlPapanSprint(baris: readonly BarisSprint[], kolom: KolomSprint | null, namaSaya: string, periode: PeriodeSprint): string {
  if (!baris.length) return `<p class="redup rapat">${esc(periode === 'minggu' ? T.kosongMinggu : T.kosongSemua)}</p>`;
  const urut = urutkanSprint(baris, kolom);
  const kunciSaya = kunciNama(namaSaya);
  const aktif = kolom ?? 'menang';
  const kepala = KOLOM_SPRINT.map((k) => {
    const sort = k === aktif ? ` aria-sort="${k === 'kepentung' ? 'ascending' : 'descending'}"` : '';
    return `<th scope="col"${sort}><button type="button" class="judul-kolom${k === kolom ? ' aktif' : ''}" data-kolom="${k}">${esc(T.kolom[k])}</button></th>`;
  }).join('');
  const isi = urut
    .map((b, i) => {
      const saya = kunciNama(b.nama) === kunciSaya;
      // Nomor (🥇🥈🥉, lalu angka) satu sel dengan nama supaya lima kolom muat di HP 360 px.
      return `<tr${saya ? ' class="saya"' : ''}><td class="nama-sprint"><span class="nomor-sprint">${MEDALI[i] ?? i + 1}</span><span class="nama-teks">${esc(
        b.nama,
      )}</span>${htmlPialaSprint(b.piala)}${saya ? ` <span class="lencana emas">${esc(T.lencanaKamu)}</span>` : ''}</td><td>${b.menang}</td><td>${b.mentung}</td><td>${b.kepentung}</td><td>${angkaSkor(b.skor)}</td></tr>`;
    })
    .join('');
  return `<div class="tabel-gulir"><table class="skor papan-sprint">
      <thead><tr><th scope="col">${esc(T.kolomNama)}</th>${kepala}</tr></thead>
      <tbody>${isi}</tbody>
    </table></div>`;
}

async function ambilPapan(periode: PeriodeSprint): Promise<PapanSprint> {
  const r = await fetch(`/api/sprint?periode=${periode}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const p = rapikanPapanSprint(await r.json());
  if (!p) throw new Error('bentuk papan');
  return p;
}

export function renderSprint(akar: HTMLElement, aksi: AksiSprint): SprintTerpasang {
  const TAB: [PeriodeSprint, string][] = [
    ['minggu', T.tabMinggu],
    ['semua', T.tabSemua],
  ];
  akar.innerHTML = `
  <div class="layar layar-sprint"><div class="kolom">
    <div class="judul"><h1><span aria-hidden="true">⏱️</span> ${esc(T.judul)}</h1><p>${esc(T.intro)}</p></div>
    <button type="button" class="utama besar penuh" id="main-sprint">${esc(T.tombolMain)}</button>
    <div class="tab" role="tablist" aria-label="Periode papan sprint">
      ${TAB.map(
        ([id, label]) =>
          `<button type="button" role="tab" id="tab-sprint-${id}" data-periode="${id}" aria-controls="papan-sprint" aria-selected="false" tabindex="-1">${esc(label)}</button>`,
      ).join('')}
    </div>
    <div class="kartu-panel isi-tab" id="papan-sprint" role="tabpanel" tabindex="0" aria-live="polite"></div>
    <p class="redup rapat ket-sprint">${esc(T.ketPapan)}</p>
    <button type="button" id="kembali">${esc(T.kembali)}</button>
  </div></div>`;
  const q = <E extends HTMLElement>(s: string) => akar.querySelector<E>(s)!;
  const tombolMain = q<HTMLButtonElement>('#main-sprint');
  const papanEl = q<HTMLElement>('#papan-sprint');
  const tab = [...akar.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const namaSaya = simpan.nama().trim() || 'Pemain';
  let periode: PeriodeSprint = 'minggu';
  let kolom: KolomSprint | null = null;
  let data: PapanSprint | null = null;
  /** Jawaban yang telat untuk tab lama diabaikan. */
  let permintaan = 0;

  const tampil = () => {
    if (!data) return;
    papanEl.innerHTML = htmlPapanSprint(data.baris, kolom, namaSaya, periode);
  };
  papanEl.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('[data-kolom]');
    if (b) {
      const k = b.dataset.kolom as KolomSprint;
      // Ketuk kolom yang sedang dipakai = kembali ke urutan bawaan.
      kolom = kolom === k ? null : k;
      tampil();
      papanEl.querySelector<HTMLElement>(`[data-kolom="${k}"]`)?.focus();
      return;
    }
    if ((e.target as Element | null)?.closest('[data-coba]')) {
      papanEl.focus();
      void muat();
    }
  });

  const muat = async () => {
    const no = ++permintaan;
    data = null;
    if (offline()) {
      papanEl.innerHTML = `<p class="redup rapat">${esc(T.offline)}</p><button type="button" data-coba>${esc(T.cobaLagi)}</button>`;
      return;
    }
    papanEl.innerHTML = `<p class="redup rapat">${esc(T.memuat)}</p>`;
    try {
      const p = await ambilPapan(periode);
      if (no !== permintaan || !akar.contains(papanEl)) return;
      data = p;
      tampil();
    } catch {
      if (no !== permintaan || !akar.contains(papanEl)) return;
      papanEl.innerHTML = `<p class="redup rapat">${esc(offline() ? T.offline : T.gagal)}</p><button type="button" data-coba>${esc(T.cobaLagi)}</button>`;
    }
  };

  const pilih = (p: PeriodeSprint) => {
    periode = p;
    for (const b of tab) {
      const aktif = b.dataset.periode === p;
      b.setAttribute('aria-selected', String(aktif));
      b.classList.toggle('aktif', aktif);
      b.tabIndex = aktif ? 0 : -1;
    }
    void muat();
  };
  for (const b of tab) b.addEventListener('click', () => pilih(b.dataset.periode as PeriodeSprint));
  q('[role=tablist]').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = tab.findIndex((b) => b.dataset.periode === periode);
    const b = tab[(i + (e.key === 'ArrowRight' ? 1 : tab.length - 1)) % tab.length]!;
    pilih(b.dataset.periode as PeriodeSprint);
    b.focus();
  });

  tombolMain.addEventListener('click', () => {
    if (tombolMain.getAttribute('aria-busy') === 'true') return;
    if (offline()) return toast(T.butuhInternet, true);
    tombolMain.setAttribute('aria-busy', 'true');
    aksi.main();
  });
  q('#kembali').addEventListener('click', aksi.kembali);

  pilih('minggu');
  return {
    aturSibuk: (sibuk) => {
      if (sibuk) tombolMain.setAttribute('aria-busy', 'true');
      else tombolMain.removeAttribute('aria-busy');
    },
  };
}
