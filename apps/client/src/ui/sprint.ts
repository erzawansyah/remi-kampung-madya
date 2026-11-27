// Layar Sprint (keputusan pemilik 25 Nov 2026): satu kalimat pembuka, tombol Main sprint, dan papan
// sprint dari server (GET /api/sprint?v=2) dengan dua tab: Minggu ini dan Sepanjang masa (sejak 27 Nov 2026
// minggu terbaik tiap orang, dengan label minggunya). Kolom # (peringkat resmi), Nama, Ptr, M, Mtg, Kpg,
// Skor (singkatan + satu baris keterangan); # dan Nama menempel di kiri, Skor di kanan, kolom tengah
// digeser kalau tidak muat. Hanya 10 teratas, 10 terbawah, dan baris sendiri yang tampil (pemisah "…" di
// antaranya). Judul kolom bisa diketuk untuk mengurutkan baris yang tampil (urutannya dari @remi/meja,
// urutkanSprint), angka # tetap peringkat resmi. Piala juara mingguan di samping nama.
// Sprint hanya online: permainannya dijalankan server supaya rekornya tidak bisa diakali dari HP.
// Sejak 27 Nov 2026 satu sprint bisa dilanjut sepanjang minggu: kalau HP ini punya sprint minggu ini
// (remi.sprintSaya), satu-satunya tombolnya "Lanjut sprint" (putaran dan skor dari POST /api/sprint/saya).
// "Mulai dari 0" dihapus di 0.10.3 (keputusan pemilik: satu sprint tiap minggu, "sekali maju gak bisa mundur").

import {
  awalMingguWib,
  KOLOM_SPRINT,
  kunciNama,
  potongPapanSprint,
  susunPapanSprint,
  urutkanSprint,
  type BarisPeringkatSprint,
  type BarisSprint,
  type KolomSprint,
  type PeriodeSprint,
} from '@remi/meja';
import { ariaMingguSprint, ariaPiala, TEKS_SPRINT as T, teksLanjutSprint, teksMingguSprint, teksPiala } from '../konten/sprint';
import { simpan } from '../penyimpanan';
import { esc, toast } from './dom';
import { pasangIsyaratGulir } from './riwayat';
import { angkaSkor } from './rincianSkor';

export type { PeriodeSprint };

/** Papan yang sudah dirapikan dari GET /api/sprint (bentuk v2, atau bentuk lama yang dipotong di sini). */
export interface PapanSprint {
  periode: PeriodeSprint;
  /** Awal minggu (ms epoch) untuk periode minggu; null untuk sepanjang masa. */
  mulai: number | null;
  /** Banyaknya orang di papan. */
  jumlah: number;
  atas: BarisPeringkatSprint[];
  bawah: BarisPeringkatSprint[];
  saya: BarisPeringkatSprint | null;
}

export interface AksiSprint {
  kembali(): void;
  /** Mulai meja sprint baru (kirim {t:'sprint'} lewat jalur online yang sama dengan Buat meja). */
  main(): void;
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

/** Satu baris dari jaringan (tanpa peringkat); null kalau tidak bernama. */
function rapikanBaris(x: unknown): BarisSprint | null {
  if (!x || typeof x !== 'object' || typeof (x as BarisSprint).nama !== 'string') return null;
  const b = x as BarisSprint;
  return {
    nama: b.nama,
    // Server sebelum 0.10.2 belum mengirim putaran: 0 (ditampilkan apa adanya sampai server ikut naik).
    putaran: angka(b.putaran),
    menang: angka(b.menang),
    mentung: angka(b.mentung),
    kepentung: angka(b.kepentung),
    skor: angka(b.skor),
    piala: Math.max(0, Math.floor(angka(b.piala))),
    ...(typeof b.minggu === 'number' && Number.isFinite(b.minggu) ? { minggu: b.minggu } : {}),
  };
}

function rapikanBerperingkat(x: unknown): BarisPeringkatSprint | null {
  const b = rapikanBaris(x);
  const p = (x as { peringkat?: unknown } | null)?.peringkat;
  return b && typeof p === 'number' && Number.isInteger(p) && p >= 1 ? { ...b, peringkat: p } : null;
}

/**
 * Rapikan jawaban server (data dari jaringan); null kalau bentuknya tidak dikenal. Bentuk v2 (atas, bawah,
 * saya, jumlah) dipakai apa adanya; bentuk lama (server sebelum 0.10.2: baris saja) diurutkan dengan urutan
 * bawaan periodenya lalu dipotong di sini, dengan `namaSaya` untuk baris sendiri.
 */
export function rapikanPapanSprint(x: unknown, namaSaya?: string): PapanSprint | null {
  if (!x || typeof x !== 'object') return null;
  const p = x as Record<string, unknown>;
  const periode: PeriodeSprint = p.periode === 'semua' ? 'semua' : 'minggu';
  const mulai = typeof p.mulai === 'number' ? p.mulai : null;
  if (Array.isArray(p.atas)) {
    const daftar = (xs: unknown) => (Array.isArray(xs) ? xs.map(rapikanBerperingkat).filter((b): b is BarisPeringkatSprint => !!b) : []);
    const atas = daftar(p.atas);
    const bawah = daftar(p.bawah);
    const saya = rapikanBerperingkat(p.saya);
    const jumlah = Math.max(Math.floor(angka(p.jumlah)), atas.length + bawah.length + (saya ? 1 : 0));
    return { periode, mulai, jumlah, atas, bawah, saya };
  }
  if (!Array.isArray(p.baris)) return null;
  const baris = p.baris.map(rapikanBaris).filter((b): b is BarisSprint => !!b);
  return { periode, mulai, ...potongPapanSprint(urutkanSprint(baris, null, periode), namaSaya) };
}

/**
 * Piala juara mingguan di samping nama. Spasinya tidak bisa dipatahkan (U+00A0), supaya piala tetap di
 * baris kata terakhir nama, tidak turun sendirian ke baris baru.
 */
export function htmlPialaSprint(n: number): string {
  const teks = teksPiala(n);
  return teks ? `\u00a0<span class="piala" role="img" aria-label="${esc(ariaPiala(n))}">${teks}</span>` : '';
}

/** Nomor di kolom #: 🥇🥈🥉 untuk peringkat 1–3, selain itu angkanya. */
const nomorPeringkat = (n: number): string => MEDALI[n - 1] ?? String(n);

/**
 * Tabel papan sprint. `kolom` null = urutan peringkat (dengan pemisah "…" di setiap lompatan peringkat);
 * kolom lain = baris yang tampil diurutkan menurut kolom itu (tanpa pemisah), angka # tetap peringkat
 * resminya. Baris milik `namaSaya` (tanpa beda huruf besar/kecil) disorot dan diberi lencana "kamu". Judul
 * kolom berupa tombol `data-kolom` ("peringkat" = kembali ke urutan peringkat). Sel # dan Nama menempel di
 * kiri, Skor di kanan (.kol-no, .kol-nama, .kol-skor).
 */
export function htmlPapanSprint(papan: PapanSprint, kolom: KolomSprint | null, namaSaya: string, sekarang = Date.now()): string {
  const { periode } = papan;
  const tampil = susunPapanSprint(papan);
  if (!tampil.length) return `<p class="redup rapat">${esc(periode === 'minggu' ? T.kosongMinggu : T.kosongSemua)}</p>`;
  const baris = tampil.flatMap((t) => (t.pemisah ? [] : [t.baris]));
  const urut = kolom ? urutkanSprint(baris, kolom, periode).map((b) => ({ pemisah: false as const, baris: b })) : tampil;
  const kunciSaya = kunciNama(namaSaya);
  const sort = (aktif: boolean, naik: boolean) => (aktif ? ` aria-sort="${naik ? 'ascending' : 'descending'}"` : '');
  const kepalaNo = `<th scope="col" class="kol-no"${sort(!kolom, true)}><button type="button" class="judul-kolom${kolom ? '' : ' aktif'}" data-kolom="peringkat" aria-label="${esc(
    T.kolomPeringkatLengkap,
  )}"><abbr title="${esc(T.kolomPeringkatLengkap)}">${esc(T.kolomPeringkat)}</abbr></button></th>`;
  const kepala = KOLOM_SPRINT.map((k) => {
    const kelas = k === 'skor' ? ' class="kol-skor"' : '';
    return `<th scope="col"${kelas}${sort(k === kolom, k === 'kepentung')}><button type="button" class="judul-kolom${k === kolom ? ' aktif' : ''}" data-kolom="${k}" aria-label="${esc(
      T.kolom[k],
    )}"><abbr title="${esc(T.kolom[k])}">${esc(T.kolomSingkat[k])}</abbr></button></th>`;
  }).join('');
  const isi = urut
    .map((t) => {
      if (t.pemisah) return `<tr class="pemisah"><td colspan="7" aria-label="${esc(T.ariaPemisah)}"><span aria-hidden="true">…</span></td></tr>`;
      const b = t.baris;
      const saya = kunciNama(b.nama) === kunciSaya;
      const minggu = periode === 'semua' && typeof b.minggu === 'number' ? teksMingguSprint(b.minggu, sekarang) : '';
      return `<tr${saya ? ' class="saya"' : ''}><td class="kol-no nomor-sprint">${nomorPeringkat(b.peringkat)}</td><td class="kol-nama nama-sprint"><span class="nama-teks">${esc(
        b.nama,
      )}</span>${htmlPialaSprint(b.piala)}${saya ? ` <span class="lencana emas">${esc(T.lencanaKamu)}</span>` : ''}${
        minggu ? `<span class="minggu-sprint" aria-label="${esc(ariaMingguSprint(minggu))}">${esc(minggu)}</span>` : ''
      }</td><td>${b.putaran}</td><td>${b.menang}</td><td>${b.mentung}</td><td>${b.kepentung}</td><td class="kol-skor">${angkaSkor(b.skor)}</td></tr>`;
    })
    .join('');
  return `<div class="tabel-gulir papan-sprint-gulir"><table class="skor papan-sprint">
      <thead><tr>${kepalaNo}<th scope="col" class="kol-nama">${esc(T.kolomNama)}</th>${kepala}</tr></thead>
      <tbody>${isi}</tbody>
    </table></div>
    <p class="redup rapat legenda-sprint">${esc(T.legenda)}</p>`;
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

/** URL papan: v=2 (10 teratas, 10 terbawah, baris sendiri dicari dari nama). */
export const urlPapanSprint = (periode: PeriodeSprint, nama: string): string =>
  `/api/sprint?periode=${periode}&v=2&nama=${encodeURIComponent(nama)}`;

async function ambilPapan(periode: PeriodeSprint, nama: string): Promise<PapanSprint> {
  const r = await fetch(urlPapanSprint(periode, nama), { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const p = rapikanPapanSprint(await r.json(), nama);
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
    papanEl.innerHTML = htmlPapanSprint(data, kolom, namaSaya);
    // Isyarat "masih bisa digeser" (data-luap): bayangan di tepi kolom yang menempel (layar.css).
    const gulir = papanEl.querySelector<HTMLElement>('.papan-sprint-gulir');
    if (gulir) pasangIsyaratGulir(gulir);
  };
  papanEl.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('[data-kolom]');
    if (b) {
      const k = b.dataset.kolom as KolomSprint | 'peringkat';
      // Ketuk kolom yang sedang dipakai, atau #, = kembali ke urutan peringkat.
      kolom = k === 'peringkat' || kolom === k ? null : k;
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
      const p = await ambilPapan(periode, namaSaya);
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
  /** Tombol aksi sesuai sprint HP ini: Lanjut sprint kalau ada sprint-nya, selain itu Main sprint. */
  const gambarAksi = () => {
    // Ada token = tombol Lanjut, apa pun kata jam HP; server yang memutuskan masih bisa atau tidak.
    const saya = simpan.sprintSaya();
    aksiEl.innerHTML = saya
      ? `<button type="button" class="utama besar penuh" id="lanjut-sprint"><span>${esc(T.tombolLanjut)}</span><span class="ket-lanjut" data-ket-lanjut></span></button>`
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
