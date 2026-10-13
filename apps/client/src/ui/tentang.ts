// Jendela Tentang: versi, info Kedai Madya (konten/kedai.ts), kredit, dan catatan perubahan
// (CHANGELOG.md di root repo).
// CHANGELOG ditampilkan lewat renderer markdown mini yang aman: semua teks di-escape dulu,
// baru penanda sederhana (heading, daftar, tebal, kode, tautan) diubah jadi HTML.
// Yang tampil untuk pemain hanya bagian "Untuk pemain" tiap versi; catatan teknis dilipat terpisah.

import '../gaya/jendela.css';
import changelog from '../../../../CHANGELOG.md?raw';
import { svgLogo } from '../aset/logoMadya';
import { htmlTautanKedai, KEDAI } from '../konten/kedai';
import { BUILD_SHA, BUILD_WAKTU, labelVersi } from '../versi';
import { bukaBantuan } from './jendelaMalas';
import { bukaDialog, esc } from './dom';

// ---------------------------------------------------------------------------------------------
// Markdown mini

/** Asal pura-pura untuk menguji tautan relatif: hasil resolve-nya harus tetap di asal ini. */
const ASAL_UJI = 'https://remi.invalid';

/**
 * Tautan hanya boleh ke http(s), atau alamat relatif di situs sendiri. Selain itu tampil sebagai teks.
 * Relatif dicek dua kali: polanya (tolak `//host` dan `/` + backslash + `host`, yang oleh browser
 * dibaca sebagai host lain) dan hasil resolve URL-nya harus tetap di situs sendiri. Backslash di
 * mana pun ditolak.
 */
export function tautanAman(url: string): 'luar' | 'dalam' | null {
  if (/^https?:\/\/[^\\]/i.test(url) && !url.includes('\\')) {
    try {
      return /^https?:$/.test(new URL(url).protocol) ? 'luar' : null;
    } catch {
      return null;
    }
  }
  if (!/^(\/(?![\/\\])|#|\.\/)/.test(url) || url.includes('\\')) return null;
  try {
    return new URL(url, `${ASAL_UJI}/a/`).origin === ASAL_UJI ? 'dalam' : null;
  } catch {
    return null;
  }
}

/** Teks biasa (mentah) → HTML: di-escape, lalu **tebal**. */
const teksTebal = (mentah: string) => esc(mentah).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/**
 * Teks satu baris (sudah mentah) → HTML: `kode`, **tebal**, [teks](url). Semua teks di-escape.
 * Urutannya: kode inline dipisah dulu, lalu tautan, dan tebal hanya diproses pada potongan teks
 * (di luar tautan, dan teks tautan secara terpisah), jadi tidak pernah menyusup ke atribut href.
 */
export function mdSebaris(mentah: string): string {
  return mentah
    .split(/(`[^`]+`)/)
    .map((bagian) => {
      if (/^`[^`]+`$/.test(bagian)) return `<code>${esc(bagian.slice(1, -1))}</code>`;
      const keluar: string[] = [];
      const pola = /\[([^\]]+)\]\(([^)\s]+)\)/g;
      let dari = 0;
      for (let m = pola.exec(bagian); m; m = pola.exec(bagian)) {
        keluar.push(teksTebal(bagian.slice(dari, m.index)));
        const [, teks, url] = m as unknown as [string, string, string];
        const jenis = tautanAman(url);
        keluar.push(
          jenis
            ? `<a href="${esc(url)}"${jenis === 'luar' ? ' target="_blank" rel="noopener noreferrer"' : ''}>${teksTebal(teks)}</a>`
            : teksTebal(teks),
        );
        dari = m.index + m[0].length;
      }
      keluar.push(teksTebal(bagian.slice(dari)));
      return keluar.join('');
    })
    .join('');
}

export interface OpsiMarkdown {
  /** Tingkat heading HTML untuk `#` (bawaan 3, karena judul dialog sudah h2). Maksimal h6. */
  tingkatAwal?: number;
}

/**
 * Markdown sederhana → HTML aman. Mendukung: heading #..######, paragraf, daftar (-, *, +, 1.),
 * baris lanjutan butir daftar, kutipan (>), garis (---), blok kode ```, dan sebaris (lihat mdSebaris).
 * Tidak mendukung HTML mentah: semuanya tampil sebagai teks.
 */
export function renderMarkdown(sumber: string, opsi: OpsiMarkdown = {}): string {
  const tingkatAwal = opsi.tingkatAwal ?? 3;
  const baris = sumber.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const keluar: string[] = [];
  let paragraf: string[] = [];
  let daftar: { jenis: 'ul' | 'ol'; butir: string[] } | null = null;
  let kutipan: string[] = [];

  const tutupParagraf = () => {
    if (paragraf.length) keluar.push(`<p>${mdSebaris(paragraf.join(' '))}</p>`);
    paragraf = [];
  };
  const tutupDaftar = () => {
    if (daftar) keluar.push(`<${daftar.jenis}>${daftar.butir.map((b) => `<li>${mdSebaris(b)}</li>`).join('')}</${daftar.jenis}>`);
    daftar = null;
  };
  const tutupKutipan = () => {
    if (kutipan.length) keluar.push(`<blockquote><p>${mdSebaris(kutipan.join(' '))}</p></blockquote>`);
    kutipan = [];
  };
  const tutupSemua = () => {
    tutupParagraf();
    tutupDaftar();
    tutupKutipan();
  };

  for (let i = 0; i < baris.length; i++) {
    const b = baris[i]!;
    const rapi = b.trim();

    if (rapi.startsWith('```')) {
      tutupSemua();
      const isi: string[] = [];
      for (i++; i < baris.length && !baris[i]!.trim().startsWith('```'); i++) isi.push(baris[i]!);
      keluar.push(`<pre><code>${esc(isi.join('\n'))}</code></pre>`);
      continue;
    }
    if (!rapi) {
      tutupSemua();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(rapi);
    if (heading) {
      tutupSemua();
      const h = Math.min(6, tingkatAwal + heading[1]!.length - 1);
      keluar.push(`<h${h}>${mdSebaris(heading[2]!)}</h${h}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(rapi)) {
      tutupSemua();
      keluar.push('<hr>');
      continue;
    }
    const butir = /^(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(rapi);
    if (butir) {
      tutupParagraf();
      tutupKutipan();
      const jenis = butir[1] ? 'ul' : 'ol';
      if (daftar && daftar.jenis !== jenis) tutupDaftar();
      daftar ??= { jenis, butir: [] };
      daftar.butir.push(butir[3]!);
      continue;
    }
    if (rapi.startsWith('>')) {
      tutupParagraf();
      tutupDaftar();
      kutipan.push(rapi.replace(/^>\s?/, ''));
      continue;
    }
    // Baris menjorok setelah butir daftar = lanjutan butir itu.
    if (daftar && /^\s+/.test(b)) {
      const d: { butir: string[] } = daftar;
      d.butir[d.butir.length - 1] += ` ${rapi}`;
      continue;
    }
    tutupDaftar();
    tutupKutipan();
    paragraf.push(rapi);
  }
  tutupSemua();
  return keluar.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Jendela Tentang

function waktuBuild(): string {
  const t = new Date(BUILD_WAKTU);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export interface VersiChangelog {
  /** Judul versi apa adanya, mis. "[0.2.0] - 2026-10-13". */
  judul: string;
  /** Teks di bawah judul versi sebelum subbagian pertama. */
  pembuka: string;
  /** Isi "### Untuk pemain" (tanpa judulnya). */
  pemain: string;
  /** Subbagian lain ("### Teknis", "### Diketahui dan belum", …) lengkap dengan judulnya. */
  teknis: string;
}

/** Pecah CHANGELOG per versi ("## …") lalu per subbagian ("### …"). Teks sebelum versi pertama dibuang. */
export function bagiChangelog(sumber: string): VersiChangelog[] {
  const baris = sumber.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const versi: VersiChangelog[] = [];
  let kini: VersiChangelog | null = null;
  let tujuan: 'pembuka' | 'pemain' | 'teknis' = 'pembuka';
  let dalamKode = false;
  for (const b of baris) {
    if (b.trim().startsWith('```')) dalamKode = !dalamKode;
    const h2 = !dalamKode && /^##\s+(.*?)\s*$/.exec(b);
    if (h2) {
      kini = { judul: h2[1]!, pembuka: '', pemain: '', teknis: '' };
      versi.push(kini);
      tujuan = 'pembuka';
      continue;
    }
    if (!kini) continue;
    const h3 = !dalamKode && /^###\s+(.*?)\s*$/.exec(b);
    if (h3) {
      tujuan = /^untuk pemain$/i.test(h3[1]!) ? 'pemain' : 'teknis';
      if (tujuan === 'pemain') continue;
    }
    kini[tujuan] += `${b}\n`;
  }
  return versi;
}

/** Ada isi nyata (butir daftar), bukan sekadar "Belum ada perubahan". */
const adaButir = (md: string) => /^\s*(?:[-*+]|\d+[.)])\s+\S/m.test(md);

/**
 * Catatan perubahan untuk pemain: per versi hanya pembuka + "Untuk pemain"; bagian teknis dalam
 * <details> tertutup. Versi tanpa isi (mis. "[Belum dirilis]" yang masih kosong) tidak ditampilkan.
 */
export function htmlChangelog(sumber: string = changelog): string {
  return bagiChangelog(sumber)
    .filter((v) => adaButir(v.pemain) || adaButir(v.teknis))
    .map((v) => {
      // "#### Ditambahkan" di bawah "Untuk pemain" → h4; di catatan teknis "### Teknis" → h4, "####" → h5.
      const pemain = adaButir(v.pemain) ? renderMarkdown(v.pemain, { tingkatAwal: 1 }) : '<p>Tidak ada perubahan yang terasa waktu main.</p>';
      const teknis = adaButir(v.teknis)
        ? `<details class="akordion changelog-teknis"><summary>Catatan teknis</summary><div class="md">${renderMarkdown(v.teknis, { tingkatAwal: 2 })}</div></details>`
        : '';
      return `<section class="changelog-versi"><h3>${mdSebaris(v.judul)}</h3>${renderMarkdown(v.pembuka)}${pemain}${teknis}</section>`;
    })
    .join('\n');
}

export function bukaTentang(): void {
  const ada = document.querySelector<HTMLElement>('.dialog.tentang');
  if (ada) return ada.focus();
  const waktu = waktuBuild();
  bukaDialog(
    `<div class="kepala-dialog">
       <h2>Tentang</h2>
       <button type="button" class="tombol-ikon hantu tutup-dialog" data-tutup aria-label="Tutup">✕</button>
     </div>
     <div class="tentang-kepala">
       <div class="tentang-logo">${svgLogo('lengkap', { label: 'Logo Kedai Madya' })}</div>
       <div>
         <p class="tentang-nama display">Remi Kampung Madya</p>
         <p class="redup rapat">Versi <b class="angka">${esc(labelVersi())}</b>${waktu ? ` · dibangun ${esc(waktu)}` : ''}${
           BUILD_SHA === 'dev' ? ' · mode pengembangan' : ''
         }</p>
       </div>
     </div>
     <p>Remi dengan <b>aturan tongkrongan Kedai Madya</b>, tempat kami biasa kumpul dan main kartu. Aturannya beda dari remi atau rummy umum: ada mulung, joker dari kartu yang dibuka, mentung, dan kepentung.</p>
     <p class="redup">Main online bareng teman pakai kode meja, atau offline bareng warga kedai tanpa internet. Permainan offline tersimpan otomatis di HP ini.</p>
     <div class="deret">
       <button type="button" data-bantuan>📖 Buka Bantuan &amp; aturan</button>
     </div>

     <section class="tentang-kedai" aria-labelledby="judul-tentang-kedai">
       <p class="kelompok-judul" id="judul-tentang-kedai">Kedai Madya</p>
       <p>${esc(KEDAI.bio)}. Remi salah satu yang biasa dimainkan di sana, dan game ini versi online-nya.</p>
       <blockquote class="tentang-kutipan"><p>“${esc(KEDAI.kutipan)}”</p><small>Kedai Madya, di Threads</small></blockquote>
       <p class="kedai-alamat"><span aria-hidden="true">📍</span> ${esc(KEDAI.alamat)}</p>
       ${htmlTautanKedai('kedai-tautan')}
       <p class="redup rapat">${esc(KEDAI.catatanBuku)} ${esc(KEDAI.catatanJam)}</p>
       ${navigator.onLine === false ? `<p class="redup rapat">${esc(KEDAI.catatanOffline)}</p>` : ''}
     </section>

     <p class="kelompok-judul">Kredit</p>
     <ul class="tentang-kredit">
       <li>Aturan main: teman-teman tongkrongan di Kedai Madya.</li>
       <li>${esc(KEDAI.kredit)}</li>
       <li>Nama warga kedai (Kipas Dua, Si Rak, dan kawan-kawan) diambil dari benda dan suasana di kedai, misalnya kipas, rak buku, kursi toska, serta garpu dan sendok di logonya.</li>
       <li>Huruf judul <b>Baloo 2</b> oleh Ek Type, lisensi SIL Open Font License 1.1 (<a href="/font/OFL-baloo2.txt" target="_blank" rel="noopener">teks lisensi</a>).</li>
       <li>Mesin grafis <a href="https://phaser.io" target="_blank" rel="noopener noreferrer">Phaser</a> (lisensi MIT).</li>
       <li>Kartu, suara, dan musik dibuat langsung oleh aplikasi (tanpa file gambar atau rekaman), jadi tetap jalan offline.</li>
     </ul>

     <details class="akordion tentang-changelog">
       <summary><b>Catatan perubahan</b></summary>
       <div class="md">${htmlChangelog()}</div>
     </details>

     <div class="kaki-dialog"><button type="button" class="utama" data-tutup>Tutup</button></div>`,
    (d, tutup) => {
      d.querySelector('[data-bantuan]')!.addEventListener('click', () => {
        tutup();
        bukaBantuan();
      });
    },
    { kelas: 'lebar tentang' },
  );
}
