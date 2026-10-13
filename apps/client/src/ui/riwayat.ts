// Layar riwayat: klasemen akhir permainan online (dari database server), peringkat sepanjang masa,
// riwayat di HP ini, dan statistik yang dihitung dari riwayat lokal (hanya klasemen akhir yang
// memang sudah tersimpan: nama dan skor akhir, tidak ada isi kartu).

import { simpan, type CatatanPermainan } from '../penyimpanan';
import { esc } from './dom';
import { angkaSkor } from './rincianSkor';

interface BarisKlasemen {
  kursi: number;
  peringkat: number;
  nama: string;
  bot: boolean;
  skor: number;
  mentung: number;
  kepentung: number;
}

interface PermainanTersimpan {
  id: number;
  kodeMeja: string;
  selesaiPada: string;
  alasan: string | null;
  jumlahPutaran: number;
  klasemen: BarisKlasemen[];
}

interface BarisPeringkat {
  nama: string;
  main: number;
  juara: number;
  totalSkor: number;
  rataRata: number;
  skorTerbaik: number;
  mentung: number;
  kepentung: number;
}

export type TabRiwayat = 'peringkat' | 'permainan' | 'lokal' | 'statistik';

const TAB: [TabRiwayat, string][] = [
  ['peringkat', 'Peringkat'],
  ['permainan', 'Permainan'],
  // Label ringkas supaya keempat tab muat satu baris di HP 360 px.
  ['lokal', 'HP ini'],
  ['statistik', 'Statistik'],
];

const MEDALI = ['🥇', '🥈', '🥉'];
const ALASAN: Record<string, string> = { sepakat: 'sepakat berhenti', batasPutaran: 'batas putaran', batasSkor: 'batas skor' };
const tanggal = (iso: string | number) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const kelasSkor = (x: number) => (x > 0 ? 'positif' : x < 0 ? 'negatif' : '');

// ---------------------------------------------------------------------------------------------
// Statistik lokal

export interface StatistikPemain {
  nama: string;
  main: number;
  /** Berapa kali di peringkat 1 (skor tertinggi; kalau seri, semua yang tertinggi dihitung juara). */
  menang: number;
  rataRata: number;
  terbaik: number;
  terburuk: number;
}

export interface Statistik {
  jumlah: number;
  offline: number;
  online: number;
  putaran: number;
  /** Skor akhir tertinggi satu permainan (pemain manusia saja). */
  rekor: { nama: string; skor: number; waktu: number } | null;
  /** Permainan terpanjang (jumlah putaran). */
  terpanjang: { putaran: number; waktu: number } | null;
  /**
   * Per nama pemain manusia (digabung tanpa beda huruf besar/kecil), urut dari menang lalu main.
   * Warga kedai (bot) tidak ikut: "Kipas Dua" di dua meja berbeda bukan pemain yang sama. Riwayat
   * lama yang belum punya tanda bot tetap dihitung apa adanya.
   */
  pemain: StatistikPemain[];
}

const kunciNama = (n: string) => n.trim().toLocaleLowerCase('id-ID');

/** Hitung statistik dari riwayat lokal. Murni: tidak membaca penyimpanan. */
export function hitungStatistik(riwayat: readonly CatatanPermainan[]): Statistik {
  const per = new Map<string, StatistikPemain & { total: number }>();
  let rekor: Statistik['rekor'] = null;
  let terpanjang: Statistik['terpanjang'] = null;
  let offline = 0;
  let putaran = 0;
  for (const r of riwayat) {
    if (!r || !Array.isArray(r.klasemen) || !r.klasemen.length) continue;
    if (r.mode === 'offline') offline++;
    putaran += r.putaran || 0;
    if (!terpanjang || r.putaran > terpanjang.putaran) terpanjang = { putaran: r.putaran, waktu: r.waktu };
    const tertinggi = Math.max(...r.klasemen.map((k) => k.skor));
    for (const k of r.klasemen) {
      if (k.bot) continue;
      const kunci = kunciNama(k.nama);
      if (!kunci) continue;
      const s = per.get(kunci) ?? { nama: k.nama.trim(), main: 0, menang: 0, rataRata: 0, terbaik: -Infinity, terburuk: Infinity, total: 0 };
      s.main++;
      s.total += k.skor;
      if (k.skor === tertinggi) s.menang++;
      s.terbaik = Math.max(s.terbaik, k.skor);
      s.terburuk = Math.min(s.terburuk, k.skor);
      per.set(kunci, s);
      if (!rekor || k.skor > rekor.skor) rekor = { nama: k.nama.trim(), skor: k.skor, waktu: r.waktu };
    }
  }
  const jumlah = riwayat.filter((r) => r && Array.isArray(r.klasemen) && r.klasemen.length).length;
  const pemain = [...per.values()]
    .map(({ total, ...s }) => ({ ...s, rataRata: Math.round(total / s.main) }))
    .sort((a, b) => b.menang - a.menang || b.main - a.main || b.rataRata - a.rataRata || a.nama.localeCompare(b.nama, 'id'));
  return { jumlah, offline, online: jumlah - offline, putaran, rekor, terpanjang, pemain };
}

function htmlStatistik(namaSaya: string): string {
  const s = hitungStatistik(simpan.riwayat());
  if (!s.jumlah) return '<p class="redup rapat">Belum ada permainan yang selesai di HP ini. Main sampai tuntas dulu, nanti angkanya muncul di sini.</p>';
  const saya = s.pemain.find((p) => kunciNama(p.nama) === kunciNama(namaSaya));
  const kotak = (angka: string | number, label: string) => `<div class="stat-kotak"><b class="angka">${esc(angka)}</b><small>${esc(label)}</small></div>`;
  return `<p class="redup rapat">Dihitung dari ${s.jumlah} permainan terakhir yang tersimpan di HP ini (online dan offline).</p>
    <div class="stat-grid">
      ${kotak(s.jumlah, 'permainan selesai')}
      ${kotak(s.putaran, 'putaran dimainkan')}
      ${kotak(`${s.offline} / ${s.online}`, 'offline / online')}
      ${s.rekor ? kotak(angkaSkor(s.rekor.skor), `rekor skor (${s.rekor.nama})`) : ''}
    </div>
    ${
      saya
        ? `<div class="stat-saya">
             <p class="kelompok-judul">Kamu (${esc(saya.nama)})</p>
             <div class="stat-grid">
               ${kotak(saya.main, 'kali main')}
               ${kotak(saya.menang, `kali juara (${Math.round((saya.menang / saya.main) * 100)}%)`)}
               ${kotak(angkaSkor(saya.rataRata), 'rata-rata skor')}
               ${kotak(angkaSkor(saya.terbaik), 'skor terbaik')}
             </div>
           </div>`
        : ''
    }
    <p class="kelompok-judul">Per pemain</p>
    <p class="redup rapat">Cuma pemain beneran, digabung berdasarkan nama. Warga kedai nggak ikut dihitung.</p>
    <div class="tabel-gulir"><table class="skor">
      <thead><tr><th scope="col">Nama</th><th scope="col">Main</th><th scope="col">Juara</th><th scope="col">Rata-rata</th><th scope="col">Terbaik</th></tr></thead>
      <tbody>${s.pemain
        .map(
          (p) => `<tr class="${p === saya ? 'saya' : ''}"><td>${esc(p.nama)}${p === saya ? ' <span class="lencana emas">kamu</span>' : ''}</td>
            <td>${p.main}</td><td>${p.menang}</td><td class="${kelasSkor(p.rataRata)}">${angkaSkor(p.rataRata)}</td><td>${angkaSkor(p.terbaik)}</td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
    ${s.terpanjang ? `<p class="redup rapat">Permainan terpanjang: ${s.terpanjang.putaran} putaran (${esc(tanggal(s.terpanjang.waktu))}).</p>` : ''}`;
}

// ---------------------------------------------------------------------------------------------
// Data server

async function ambil<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

function htmlPeringkat(daftar: BarisPeringkat[], namaSaya: string): string {
  if (!daftar.length) return '<p class="redup">Belum ada permainan online yang selesai.</p>';
  return `<p class="redup rapat">Cuma pemain beneran, digabung berdasarkan nama. Urut dari jumlah juara, lalu total skor.</p>
    <div class="rincian">${daftar
      .map(
        (p, i) => `<div class="baris-peringkat${kunciNama(p.nama) === kunciNama(namaSaya) ? ' saya' : ''}">
          <span class="medali">${MEDALI[i] ?? i + 1}</span>
          <span class="nama-skor"><b>${esc(p.nama)}</b>
            <small class="redup">main ${p.main}× · juara ${p.juara}× · mentung ${p.mentung}× · kepentung ${p.kepentung}× · terbaik ${angkaSkor(p.skorTerbaik)}</small></span>
          <span class="kanan-peringkat"><b class="total ${kelasSkor(p.totalSkor)}">${angkaSkor(p.totalSkor)}</b><small class="redup">rata-rata ${angkaSkor(p.rataRata)}</small></span>
        </div>`,
      )
      .join('')}</div>`;
}

function htmlPermainan(daftar: PermainanTersimpan[]): string {
  if (!daftar.length) return '<p class="redup">Belum ada permainan online yang selesai.</p>';
  return daftar
    .map(
      (g) => `<details class="akordion putaran-akordion">
        <summary>
          <span class="peringkat">#${g.id}</span>
          <span class="nama-skor"><b>${esc(tanggal(g.selesaiPada))}</b>
            <small class="redup">meja ${esc(g.kodeMeja)} · ${g.jumlahPutaran} putaran · ${esc(ALASAN[g.alasan ?? ''] ?? '')} · juara ${esc(g.klasemen[0]?.nama ?? '-')}</small></span>
        </summary>
        <div class="rincian">${g.klasemen
          .map(
            (k) => `<div class="baris-peringkat">
              <span class="medali">${MEDALI[k.peringkat - 1] ?? k.peringkat}</span>
              <span class="nama-skor"><b>${esc(k.nama)}</b>${k.bot ? ' <span class="lencana">warga kedai</span>' : ''}
                <small class="redup">mentung ${k.mentung}× · kepentung ${k.kepentung}×</small></span>
              <b class="total ${kelasSkor(k.skor)}">${angkaSkor(k.skor)}</b>
            </div>`,
          )
          .join('')}</div>
      </details>`,
    )
    .join('');
}

function htmlLokal(): string {
  const daftar = simpan.riwayat();
  if (!daftar.length)
    return '<p class="redup">Belum ada permainan yang selesai di HP ini. Main sampai tuntas dulu, nanti klasemennya tercatat di sini. Kalau mau main langsung, ajak teman ke Kedai Madya.</p>';
  return `<p class="redup rapat">Tersimpan di HP ini saja (online dan offline), 30 terakhir.</p>${daftar
    .map(
      (r) => `<div class="baris-peringkat">
        <span class="medali" role="img" aria-label="${r.mode === 'offline' ? 'offline' : 'online'}">${r.mode === 'offline' ? '📴' : '🌐'}</span>
        <span class="nama-skor"><b>${esc(tanggal(r.waktu))}</b>
          <small class="redup">${r.putaran} putaran · ${r.klasemen.map((k, i) => `${i + 1}. ${esc(k.nama)}${k.bot ? ' [warga kedai]' : ''} (${angkaSkor(k.skor)})`).join(' · ')}</small></span>
      </div>`,
    )
    .join('')}`;
}

// ---------------------------------------------------------------------------------------------
// Layar

/**
 * Deret tab yang meluap (layar sempit / teks besar) digulir di tempat supaya tab aktif terlihat.
 * Sengaja tidak memakai scrollIntoView: itu ikut menggulir .layar dan membuat isi bergeser.
 */
function gulirKeTab(tab: HTMLElement): void {
  const deret = tab.parentElement;
  if (!deret || deret.scrollWidth <= deret.clientWidth) return;
  const d = deret.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  // Sedikit lebih lebar dari pudaran tepi (komponen.css, [data-luap]) supaya tab aktif tidak ikut pudar.
  const jarak = 28;
  if (t.left < d.left) deret.scrollLeft -= d.left - t.left + jarak;
  else if (t.right > d.right) deret.scrollLeft += t.right - d.right + jarak;
}

/**
 * Isyarat "masih bisa digulir" untuk deret tab yang meluap: atribut data-luap berisi sisi yang
 * masih menyimpan tab ('kiri', 'kanan', atau keduanya); komponen.css memudarkan tepi itu dengan mask.
 * Disegarkan saat digulir dan saat ukuran deret/tab berubah (layar diputar, ukuran teks diganti).
 */
export function pasangIsyaratGulir(deret: HTMLElement): () => void {
  const segarkan = () => {
    const maks = deret.scrollWidth - deret.clientWidth;
    const sisi = maks > 1 ? [deret.scrollLeft > 1 && 'kiri', deret.scrollLeft < maks - 1 && 'kanan'].filter(Boolean).join(' ') : '';
    if (sisi) {
      if (deret.getAttribute('data-luap') !== sisi) deret.setAttribute('data-luap', sisi);
    } else deret.removeAttribute('data-luap');
  };
  deret.addEventListener('scroll', segarkan, { passive: true });
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      // Layar sudah diganti (innerHTML akar ditimpa): berhenti mengamati.
      if (!deret.isConnected) return ro?.disconnect();
      segarkan();
    });
    ro.observe(deret);
    for (const anak of deret.children) ro.observe(anak);
  }
  segarkan();
  return segarkan;
}

export function renderRiwayat(akar: HTMLElement, kembali: () => void, tabAwal: TabRiwayat = 'peringkat'): void {
  akar.innerHTML = `
  <div class="layar layar-riwayat"><div class="kolom">
    <div class="judul"><h1>🏆 Riwayat</h1><p>Klasemen akhir dan statistik Remi Kampung Madya</p></div>
    <div class="tab" role="tablist" aria-label="Jenis riwayat">
      ${TAB.map(
        ([id, label]) =>
          `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="isi-riwayat" aria-selected="false" tabindex="-1">${label}</button>`,
      ).join('')}
    </div>
    <div class="kartu-panel isi-tab" id="isi-riwayat" role="tabpanel" tabindex="0"></div>
    <button type="button" id="kembali">← Kembali ke beranda</button>
  </div></div>`;
  akar.querySelector('#kembali')!.addEventListener('click', kembali);
  const isi = akar.querySelector<HTMLElement>('#isi-riwayat')!;
  const tombol = [...akar.querySelectorAll<HTMLElement>('[role=tab]')];
  const segarkanLuap = pasangIsyaratGulir(akar.querySelector<HTMLElement>('[role=tablist]')!);
  // Sama dengan cadangan saat permainan dibuat (nama kosong tercatat sebagai 'Pemain').
  const namaSaya = simpan.nama().trim() || 'Pemain';
  /** Penanda permintaan: jawaban server yang telat untuk tab lama diabaikan. */
  let permintaan = 0;

  const pilih = (tab: TabRiwayat) => {
    tombol.forEach((b) => {
      const aktif = b.dataset.tab === tab;
      b.setAttribute('aria-selected', String(aktif));
      b.classList.toggle('aktif', aktif);
      b.tabIndex = aktif ? 0 : -1;
      if (aktif) gulirKeTab(b);
    });
    segarkanLuap();
    isi.setAttribute('aria-labelledby', `tab-${tab}`);
    const ke = ++permintaan;
    if (tab === 'lokal') return void (isi.innerHTML = htmlLokal());
    if (tab === 'statistik') return void (isi.innerHTML = htmlStatistik(namaSaya));
    isi.innerHTML = '<p class="redup" aria-busy="true">Memuat dari server…</p>';
    const gagal = () => {
      if (ke !== permintaan) return;
      isi.innerHTML = `<p class="redup rapat">Riwayat server belum bisa dibuka${navigator.onLine ? '' : ' karena kamu sedang offline'}. Riwayat yang tersimpan di HP ini tetap aman.</p>
        <div class="deret">
          <button type="button" data-coba>Coba lagi</button>
          <button type="button" class="utama" data-lokal>Lihat yang di HP ini</button>
        </div>`;
      isi.querySelector('[data-coba]')!.addEventListener('click', () => pilih(tab));
      isi.querySelector('[data-lokal]')!.addEventListener('click', () => {
        pilih('lokal');
        akar.querySelector<HTMLElement>('#tab-lokal')?.focus();
      });
    };
    const tampil = (html: string) => {
      if (ke === permintaan) isi.innerHTML = html;
    };
    if (tab === 'peringkat') ambil<BarisPeringkat[]>('/api/peringkat').then((d) => tampil(htmlPeringkat(d, namaSaya)), gagal);
    else ambil<PermainanTersimpan[]>('/api/riwayat?batas=30').then((d) => tampil(htmlPermainan(d)), gagal);
  };

  tombol.forEach((b, i) => {
    b.addEventListener('click', () => pilih(b.dataset.tab as TabRiwayat));
    b.addEventListener('keydown', (e) => {
      const arah = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!arah && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? tombol.length - 1 : (i + arah + tombol.length) % tombol.length;
      tombol[j]!.focus();
      pilih(tombol[j]!.dataset.tab as TabRiwayat);
    });
  });
  // Tanpa internet, riwayat server pasti gagal: langsung buka yang di HP ini.
  pilih(!navigator.onLine && (tabAwal === 'peringkat' || tabAwal === 'permainan') ? 'lokal' : tabAwal);
}
