// Pusat Bantuan: aturan lengkap Kedai Madya, tanya jawab, dan daftar istilah (isi dari konten/bantuan.ts).
// Navigasi bab: daftar di HP (lalu masuk ke bab), sidebar di layar lebar. Bisa dibuka langsung ke satu bab.
// Semua teks konten di-escape; satu-satunya markup yang dikenali adalah **tebal** di paragraf.
// Contoh kartu digambar dengan fungsi kanvas yang sama dengan meja (kartuGrafisGambar.ts).

import '../gaya/jendela.css';
import { namaRank } from '@remi/engine';
import { BAB_BANTUAN, FAQ, GLOSARIUM, type BabBantuan, type BlokBantuan, type KartuContoh } from '../konten/bantuan';
import { gambarKartuKeKanvas } from '../game/kartuGrafisGambar';
import { bukaDialog, esc } from './dom';

/** Bab tambahan di luar BAB_BANTUAN. */
const BAB_FAQ = { id: 'faq', judul: 'Tanya jawab', ikon: '💬', ringkas: 'Pertanyaan yang sering muncul di meja.' } as const;
const BAB_ISTILAH = { id: 'istilah', judul: 'Daftar istilah', ikon: '📒', ringkas: 'Bahasa tongkrongan Kedai Madya.' } as const;
type InfoBab = Pick<BabBantuan, 'id' | 'judul' | 'ikon' | 'ringkas'>;
const SEMUA_BAB: InfoBab[] = [...BAB_BANTUAN, BAB_FAQ, BAB_ISTILAH];

/** Lebar kartu contoh (px CSS). Di atas batas desain mini supaya pip-nya tetap terbaca. */
const LEBAR_KARTU_CONTOH = 46;

/** **tebal** → <strong>, setelah semua teks di-escape. */
function tebal(teks: string): string {
  return esc(teks).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Teks polos sebuah blok (untuk pencarian). */
function teksBlok(b: BlokBantuan): string[] {
  switch (b.t) {
    case 'paragraf':
    case 'catatan':
      return [b.teks.replace(/\*\*/g, '')];
    case 'daftar':
    case 'langkah':
      return b.butir;
    case 'contoh':
      return [b.judul, b.ket];
    case 'tabel':
      return [b.kepala.join(' · '), ...b.baris.map((r) => r.join(' · '))];
  }
}

function htmlBlok(b: BlokBantuan, i: number): string {
  switch (b.t) {
    case 'paragraf':
      return `<p>${tebal(b.teks)}</p>`;
    case 'daftar':
      return `<ul class="bantuan-butir">${b.butir.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    case 'langkah':
      return `<ol class="bantuan-langkah">${b.butir.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
    case 'catatan':
      return `<aside class="bantuan-catatan"><span aria-hidden="true">💡</span><p>${esc(b.teks)}</p></aside>`;
    case 'tabel':
      return `<div class="tabel-gulir"><table class="skor bantuan-tabel">
        <thead><tr>${b.kepala.map((k) => `<th scope="col">${esc(k)}</th>`).join('')}</tr></thead>
        <tbody>${b.baris.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    case 'contoh':
      return `<figure class="contoh ${b.sah ? 'sah' : 'tidak-sah'}">
        <figcaption><b>${esc(b.judul)}</b><span class="lencana ${b.sah ? 'hijau' : 'merah'}">${b.sah ? '✓ Sah' : '✗ Tidak sah'}</span></figcaption>
        <div class="contoh-kartu" data-contoh="${i}"></div>
        <p>${esc(b.ket)}</p>
      </figure>`;
  }
}

/** Isi kanvas kartu untuk semua blok contoh di dalam `akar`. */
function gambarContoh(akar: HTMLElement, isi: BlokBantuan[]): void {
  akar.querySelectorAll<HTMLElement>('[data-contoh]').forEach((wadah) => {
    const blok = isi[Number(wadah.dataset.contoh)];
    if (blok?.t !== 'contoh') return;
    const label: string[] = [];
    blok.kartu.forEach((k: KartuContoh) => {
      const sel = document.createElement('span');
      sel.className = 'sel-kartu';
      const kanvas = gambarKartuKeKanvas(k, LEBAR_KARTU_CONTOH);
      kanvas.setAttribute('aria-hidden', 'true');
      sel.appendChild(kanvas);
      const nama = kanvas.getAttribute('aria-label') ?? '';
      if (k.peran !== undefined) {
        const peran = document.createElement('small');
        peran.className = 'peran';
        peran.textContent = `jadi ${namaRank(k.peran)}`;
        sel.appendChild(peran);
        label.push(`${nama} sebagai ${namaRank(k.peran)}`);
      } else label.push(nama);
      wadah.appendChild(sel);
    });
    wadah.setAttribute('role', 'img');
    wadah.setAttribute('aria-label', `Kartu: ${label.join(', ')}`);
  });
}

function htmlNavBab(): string {
  return SEMUA_BAB.map(
    (b) => `<li><button type="button" class="daftar-item bab-item" data-bab="${esc(b.id)}">
      <span class="bab-ikon" aria-hidden="true">${esc(b.ikon)}</span>
      <span class="bab-teks"><b>${esc(b.judul)}</b><small>${esc(b.ringkas)}</small></span>
    </button></li>`,
  ).join('');
}

function htmlFaq(daftar = FAQ): string {
  return daftar
    .map((f) => `<details class="akordion faq"><summary>${esc(f.tanya)}</summary><p>${esc(f.jawab)}</p></details>`)
    .join('');
}

function htmlIstilah(daftar = GLOSARIUM): string {
  return `<dl class="glosarium">${daftar.map((g) => `<div><dt>${esc(g.istilah)}</dt><dd>${esc(g.arti)}</dd></div>`).join('')}</dl>`;
}

// ---------- Pencarian ----------

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Potongan teks di sekitar kata yang dicari, dengan <mark>. Semua di-escape. */
export function cuplikan(teks: string, cari: string, radius = 60): string {
  const n = normal(teks);
  const q = normal(cari.trim());
  const i = q ? n.indexOf(q) : -1;
  // normalize() bisa mengubah panjang teks; kalau begitu, tampilkan apa adanya tanpa sorotan.
  if (i < 0 || n.length !== teks.length) return esc(teks.length > radius * 2 ? `${teks.slice(0, radius * 2)}…` : teks);
  const awal = Math.max(0, i - radius);
  const akhir = Math.min(teks.length, i + q.length + radius);
  return `${awal > 0 ? '…' : ''}${esc(teks.slice(awal, i))}<mark>${esc(teks.slice(i, i + q.length))}</mark>${esc(teks.slice(i + q.length, akhir))}${akhir < teks.length ? '…' : ''}`;
}

export interface HasilCari {
  bab: { id: string; judul: string; ikon: string; cuplikan: string[] }[];
  faq: typeof FAQ;
  istilah: typeof GLOSARIUM;
}

/** Cari di semua bab, tanya jawab, dan istilah (tanpa beda huruf besar/kecil dan aksen). */
export function cariBantuan(cari: string): HasilCari {
  const q = normal(cari.trim());
  const cocok = (s: string) => normal(s).includes(q);
  const bab: HasilCari['bab'] = [];
  for (const b of BAB_BANTUAN) {
    const teks = [b.judul, b.ringkas, ...b.isi.flatMap(teksBlok)].filter(cocok);
    if (teks.length) bab.push({ id: b.id, judul: b.judul, ikon: b.ikon, cuplikan: teks.slice(0, 2).map((t) => cuplikan(t, cari)) });
  }
  return {
    bab,
    faq: FAQ.filter((f) => cocok(f.tanya) || cocok(f.jawab)),
    istilah: GLOSARIUM.filter((g) => cocok(g.istilah) || cocok(g.arti)),
  };
}

function htmlHasilCari(cari: string): string {
  const h = cariBantuan(cari);
  const jumlah = h.bab.length + h.faq.length + h.istilah.length;
  if (!jumlah)
    return `<h3>Nggak ketemu, Bos</h3><p class="redup">Belum ada yang cocok dengan "${esc(cari)}". Coba kata lain, misalnya "mulung", "joker", atau "skor".</p>`;
  return `<h3>Hasil untuk "${esc(cari)}"</h3>
    ${
      h.bab.length
        ? `<ul class="daftar hasil-cari">${h.bab
            .map(
              (b) => `<li><button type="button" class="daftar-item" data-bab="${esc(b.id)}">
                <span class="bab-ikon" aria-hidden="true">${esc(b.ikon)}</span>
                <span class="bab-teks"><b>${esc(b.judul)}</b>${b.cuplikan.map((c) => `<small>${c}</small>`).join('')}</span>
              </button></li>`,
            )
            .join('')}</ul>`
        : ''
    }
    ${h.faq.length ? `<p class="kelompok-judul">Tanya jawab</p>${htmlFaq(h.faq)}` : ''}
    ${h.istilah.length ? `<p class="kelompok-judul">Istilah</p>${htmlIstilah(h.istilah)}` : ''}`;
}

// ---------- Jendela ----------

/** Buka Bantuan, opsional langsung ke bab tertentu (id dari BAB_BANTUAN, atau 'faq' / 'istilah'). */
export function bukaBantuan(bab?: string): void {
  const ada = document.querySelector<HTMLElement>('.dialog.bantuan');
  if (ada) {
    // Sudah terbuka (mis. dari tautan di jendela lain): cukup pindah bab.
    if (bab) ada.dispatchEvent(new CustomEvent('bantuan:bab', { detail: bab }));
    return;
  }
  bukaDialog(
    `<div class="kepala-dialog">
       <h2>Bantuan</h2>
       <button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup">✕</button>
     </div>
     <div class="bantuan-cari">
       <input type="search" id="cari-bantuan" placeholder="Cari: mulung, joker, skor…" aria-label="Cari di Bantuan" autocomplete="off" enterkeyhint="search" />
     </div>
     <div class="bantuan-tata" data-mode="daftar">
       <nav class="bantuan-nav" aria-label="Daftar bab"><ul class="daftar">${htmlNavBab()}</ul></nav>
       <section class="bantuan-isi" tabindex="-1" aria-live="off"></section>
     </div>`,
    (d) => {
      const tata = d.querySelector<HTMLElement>('.bantuan-tata')!;
      const isi = d.querySelector<HTMLElement>('.bantuan-isi')!;
      const kolomCari = d.querySelector<HTMLInputElement>('#cari-bantuan')!;
      let babAktif = BAB_BANTUAN[0]!.id;

      const tandaiNav = () =>
        d.querySelectorAll<HTMLElement>('.bantuan-nav [data-bab]').forEach((b) => {
          if (b.dataset.bab === babAktif && tata.dataset.mode !== 'cari') b.setAttribute('aria-current', 'page');
          else b.removeAttribute('aria-current');
        });

      const tampilBab = (id: string, fokus = true) => {
        const info = SEMUA_BAB.find((b) => b.id === id) ?? SEMUA_BAB[0]!;
        babAktif = info.id;
        tata.dataset.mode = 'isi';
        const urut = SEMUA_BAB.findIndex((b) => b.id === info.id);
        const sebelum = SEMUA_BAB[urut - 1];
        const sesudah = SEMUA_BAB[urut + 1];
        const isiBab = BAB_BANTUAN.find((b) => b.id === info.id);
        const badan =
          info.id === 'faq' ? htmlFaq() : info.id === 'istilah' ? htmlIstilah() : (isiBab?.isi.map(htmlBlok).join('') ?? '');
        isi.innerHTML = `
          <button type="button" class="hantu kecil balik-daftar" data-daftar>← Semua bab</button>
          <h3 class="judul-bab"><span aria-hidden="true">${esc(info.ikon)}</span> ${esc(info.judul)}</h3>
          <p class="redup rapat">${esc(info.ringkas)}</p>
          <div class="badan-bab">${badan}</div>
          <div class="bab-geser">
            ${sebelum ? `<button type="button" class="hantu" data-bab="${esc(sebelum.id)}">← ${esc(sebelum.judul)}</button>` : '<span></span>'}
            ${sesudah ? `<button type="button" class="hantu" data-bab="${esc(sesudah.id)}">${esc(sesudah.judul)} →</button>` : ''}
          </div>`;
        if (isiBab) gambarContoh(isi, isiBab.isi);
        tandaiNav();
        d.scrollTop = 0;
        isi.scrollTop = 0;
        if (fokus) isi.focus({ preventScroll: true });
      };

      const tampilDaftar = () => {
        tata.dataset.mode = 'daftar';
        tandaiNav();
        d.scrollTop = 0;
        d.querySelector<HTMLElement>(`.bantuan-nav [data-bab="${babAktif}"]`)?.focus({ preventScroll: true });
      };

      let timerCari: ReturnType<typeof setTimeout> | undefined;
      const jalankanCari = () => {
        const q = kolomCari.value.trim();
        if (q.length < 2) {
          if (tata.dataset.mode === 'cari') tampilBab(babAktif, false);
          return;
        }
        tata.dataset.mode = 'cari';
        isi.innerHTML = htmlHasilCari(q);
        tandaiNav();
      };
      kolomCari.addEventListener('input', () => {
        clearTimeout(timerCari);
        timerCari = setTimeout(jalankanCari, 150);
      });
      kolomCari.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(timerCari);
          jalankanCari();
        }
      });

      // Satu pendengar untuk semua tombol bab (navigasi, hasil cari, sebelum/sesudah).
      d.addEventListener('click', (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>('[data-bab], [data-daftar]');
        if (!el || !d.contains(el)) return;
        if (el.dataset.daftar !== undefined) return tampilDaftar();
        if (tata.dataset.mode === 'cari') kolomCari.value = '';
        tampilBab(el.dataset.bab!);
      });
      d.addEventListener('bantuan:bab', (e) => tampilBab((e as CustomEvent<string>).detail));

      if (bab && SEMUA_BAB.some((b) => b.id === bab)) tampilBab(bab, false);
      else {
        // Tanpa bab: HP menampilkan daftar bab dulu; layar lebar langsung bab pertama di samping daftar.
        tampilBab(babAktif, false);
        tata.dataset.mode = 'daftar';
        tandaiNav();
      }
    },
    { kelas: 'lebar bantuan' },
  );
}
