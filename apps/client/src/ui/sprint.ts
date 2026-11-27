// Layar Sprint (keputusan pemilik 25 Nov 2026): satu kalimat pembuka, tombol Main sprint, dan papan
// sprint dari server (GET /api/sprint) dengan dua tab: Minggu ini dan Sepanjang masa. Kolom Menang,
// Mentung, Kepentung, Skor; judul kolom bisa diketuk untuk mengurutkan (urutannya dari @remi/meja,
// urutkanSprint, jadi aturan urutan tetap satu sumber). Piala juara mingguan di samping nama.
// Sprint hanya online: permainannya dijalankan server supaya rekornya tidak bisa diakali dari HP.
// Sejak 27 Nov 2026 satu sprint bisa dilanjut sepanjang minggu: kalau HP ini punya sprint minggu ini
// (remi.sprintSaya), tombolnya "Lanjut sprint" (putaran dan skor dari POST /api/sprint/saya) dan "Mulai dari 0".

import { awalMingguWib, KOLOM_SPRINT, kunciNama, urutkanSprint, type BarisSprint, type KolomSprint } from '@remi/meja';
import { ariaPiala, TEKS_SPRINT as T, teksLanjutSprint, teksPiala } from '../konten/sprint';
import { simpan } from '../penyimpanan';
import { esc, konfirmasi, toast } from './dom';
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
  /**
   * Mulai meja sprint baru (kirim {t:'sprint'} lewat jalur online yang sama dengan Buat meja). `ganti` = token
   * sprint HP ini yang ditutup dulu ("Mulai dari 0").
   */
  main(ganti?: string): void;
  /** Lanjutkan sprint HP ini ({t:'sprint', lanjut}). */
  lanjut(token: string): void;
}

export interface SprintTerpasang {
  /** Tombol Main/Lanjut sprint sedang menunggu jawaban server (atau tidak lagi). */
  aturSibuk(sibuk: boolean): void;
  /** Sprint HP ini berubah (misalnya server bilang sudah tidak bisa dilanjut): gambar ulang tombolnya. */
  segarkanAksi(): void;
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

/**
 * Sprint HP ini yang tampaknya masih bisa dilanjut (minggunya sama dengan minggu ini menurut jam HP). Hanya
 * untuk teks; tokennya tidak pernah dibuang berdasarkan jam HP (bisa meleset): yang memutuskan server
 * (POST /api/sprint/saya menjawab `ada: false`, atau pesan sprintSaya dengan token null).
 */
export function sprintBisaDilanjut(sekarang = Date.now()): boolean {
  const s = simpan.sprintSaya();
  return !!s && s.minggu === awalMingguWib(sekarang);
}

/** Jawaban POST /api/sprint/saya (data dari jaringan, dirapikan). */
export function rapikanSprintSaya(x: unknown): { ada: false } | { ada: true; putaran: number; skor: number } | null {
  if (!x || typeof x !== 'object') return null;
  const s = x as { ada?: unknown; putaran?: unknown; skor?: unknown };
  if (s.ada === false) return { ada: false };
  if (s.ada !== true || typeof s.putaran !== 'number' || !Number.isInteger(s.putaran) || s.putaran < 1) return null;
  return { ada: true, putaran: s.putaran, skor: angka(s.skor) };
}

async function tanyaSprintSaya(token: string) {
  const r = await fetch('/api/sprint/saya', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return rapikanSprintSaya(await r.json());
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
    <div class="aksi-sprint"></div>
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
  const aksiEl = q<HTMLElement>('.aksi-sprint');
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

  let sibuk = false;
  /** Tombol aksi (Main sprint, atau Lanjut sprint + Mulai dari 0) sesuai sprint HP ini. */
  const gambarAksi = () => {
    // Ada token = tombol Lanjut, apa pun kata jam HP; server yang memutuskan masih bisa atau tidak.
    const saya = simpan.sprintSaya();
    aksiEl.innerHTML = saya
      ? `<button type="button" class="utama besar penuh" id="lanjut-sprint"><span>${esc(T.tombolLanjut)}</span><span class="ket-lanjut" data-ket-lanjut></span></button>
         <button type="button" class="penuh" id="nol-sprint">${esc(T.tombolMulaiNol)}</button>
         <p class="redup rapat ket-sprint">${esc(T.ketMulaiNol)}</p>`
      : `<button type="button" class="utama besar penuh" id="main-sprint">${esc(T.tombolMain)}</button>`;
    aturSibuk(sibuk);
    if (!saya || offline()) return;
    // Putaran dan skor sprint yang dijeda; yang sudah tidak bisa dilanjut dilupakan (tombolnya jadi Main sprint).
    tanyaSprintSaya(saya.token)
      .then((r) => {
        if (!r || !akar.contains(aksiEl) || simpan.sprintSaya()?.token !== saya.token) return;
        if (!r.ada) {
          simpan.setSprintSaya(null);
          gambarAksi();
          return;
        }
        const ket = aksiEl.querySelector<HTMLElement>('[data-ket-lanjut]');
        if (ket) ket.textContent = teksLanjutSprint(r.putaran, angkaSkor(r.skor));
      })
      .catch(() => undefined);
  };
  const aturSibuk = (x: boolean) => {
    sibuk = x;
    for (const b of aksiEl.querySelectorAll<HTMLButtonElement>('button')) {
      if (x) b.setAttribute('aria-busy', 'true');
      else b.removeAttribute('aria-busy');
    }
  };
  const bisaDitekan = (): boolean => {
    if (sibuk) return false;
    if (offline()) {
      toast(T.butuhInternet, true);
      return false;
    }
    return true;
  };
  aksiEl.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLButtonElement>('button');
    if (!b || !bisaDitekan()) return;
    const saya = simpan.sprintSaya();
    if (b.id === 'main-sprint') {
      aturSibuk(true);
      aksi.main();
    } else if (b.id === 'lanjut-sprint' && saya) {
      aturSibuk(true);
      aksi.lanjut(saya.token);
    } else if (b.id === 'nol-sprint' && saya) {
      void konfirmasi({ ...T.konfirmasiMulaiNol, bahaya: true }).then((ya) => {
        if (!ya || !akar.contains(aksiEl) || !bisaDitekan()) return;
        aturSibuk(true);
        aksi.main(saya.token);
      });
    }
  });
  q('#kembali').addEventListener('click', aksi.kembali);

  gambarAksi();
  pilih('minggu');
  return {
    aturSibuk,
    segarkanAksi: gambarAksi,
  };
}
