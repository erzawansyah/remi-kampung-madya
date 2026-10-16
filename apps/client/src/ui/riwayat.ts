// Layar riwayat: klasemen akhir permainan online (dari database server), leaderboard dengan
// pilihan urutan dan saringan, riwayat di HP ini, dan statistik yang dihitung dari riwayat lokal
// (hanya klasemen akhir yang memang sudah tersimpan: nama dan skor akhir, tidak ada isi kartu).
// Aturan hitung peringkat satu sumber dengan server: packages/meja/src/peringkat.ts (#45).

import {
  BUTUH_MIN_MAIN,
  DAFTAR_URUTAN,
  SARINGAN_BAWAAN,
  URUTAN_BAWAAN,
  bulanWib,
  hitungPeringkat,
  kunciNama,
  nilaiUrutan,
  rapikanSaringan,
  rapikanUrutan,
  urutkanPeringkat,
  type BarisPeringkat,
  type BulanWib,
  type KursiPeringkat,
  type SaringanPeringkat,
  type UrutanPeringkat,
} from '@remi/meja';
import {
  CARA_HITUNG,
  CATATAN_DECK,
  CATATAN_SERVER_LAMA,
  CATATAN_STATISTIK,
  JELAS_URUTAN,
  JUDUL_BELUM_CUKUP,
  JUDUL_CARA_HITUNG,
  KETERANGAN_ANGKA,
  KOSONG_PERINGKAT,
  KOSONG_SARINGAN,
  LABEL_PERIODE,
  LABEL_URUTAN,
  LENCANA_KELUAR,
  LENCANA_TIDAK_DIHITUNG,
  SYARAT_MIN_MAIN,
  labelBulan,
} from '../konten/peringkat';
import { simpan, type CatatanPermainan } from '../penyimpanan';
import { esc } from './dom';
import { angkaSkor } from './rincianSkor';

interface BarisKlasemen {
  kursi: number;
  peringkat: number;
  nama: string;
  bot: boolean;
  /** Menekan Keluar di tengah permainan (server sesudah #45). */
  keluar?: boolean;
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
  /** Server lama tidak mengirim field ini (anggap dihitung). */
  dihitung?: boolean;
  klasemen: BarisKlasemen[];
}

/** Baris `GET /api/peringkat` bentuk lama (server sebelum #45). */
type BarisPeringkatLama = Pick<BarisPeringkat, 'nama' | 'main' | 'juara' | 'totalSkor' | 'rataRata' | 'skorTerbaik' | 'mentung' | 'kepentung'>;

/** Jawaban `GET /api/peringkat?v=2`. */
interface PapanPeringkat {
  v: 2;
  urut: UrutanPeringkat;
  saringan: SaringanPeringkat;
  periode: BulanWib | null;
  minMain: number;
  jumlahPermainan: number;
  peringkat: BarisPeringkat[];
  belumCukup: BarisPeringkat[];
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
/** Alasan permainan selesai di daftar permainan online. 'kaldu': putaran kaldu ditutup mentung (#42). */
export const ALASAN_SELESAI: Record<string, string> = {
  sepakat: 'sepakat berhenti',
  batasPutaran: 'batas putaran',
  batasSkor: 'batas skor',
  kaldu: 'putaran kaldu',
};
const tanggal = (iso: string | number) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const kelasSkor = (x: number) => (x > 0 ? 'positif' : x < 0 ? 'negatif' : '');
const persen = (x: number) => `${Math.round(x)}%`;

/** Urutan yang bisa dipilih di Statistik HP ini: mentung tidak tersimpan di riwayat lokal. */
const URUTAN_LOKAL: readonly UrutanPeringkat[] = DAFTAR_URUTAN.filter((u) => u !== 'mentung');

const jelasUrutan = (u: UrutanPeringkat) => `${JELAS_URUTAN[u]}${BUTUH_MIN_MAIN.includes(u) ? ` ${SYARAT_MIN_MAIN}` : ''}`;

/** Angka besar di kanan baris peringkat: nilai urutan yang sedang dipilih. */
function angkaUrutan(b: BarisPeringkat, urut: UrutanPeringkat): { teks: string; kelas: string } {
  const v = nilaiUrutan(b, urut);
  switch (urut) {
    case 'rata':
    case 'terbaik':
      return { teks: angkaSkor(Math.round(v)), kelas: kelasSkor(Math.round(v)) };
    case 'persen':
      return { teks: persen(v), kelas: '' };
    case 'posisi':
      return { teks: String(Math.round(v)), kelas: '' };
    default:
      return { teks: `${v}×`, kelas: '' };
  }
}

/** Baris kecil di bawah nama: semua angka penting, apa pun urutannya. */
function rincianBaris(b: BarisPeringkat): string {
  const bagian = [
    `main ${b.main}×`,
    `juara ${b.juara}× (${persen(b.persenJuara)})`,
    `rata-rata ${angkaSkor(b.rataRata)}`,
    `terbaik ${angkaSkor(b.skorTerbaik)}`,
    `mentung ${b.mentung}×`,
    `kepentung ${b.kepentung}×`,
  ];
  if (b.keluar > 0) bagian.push(`keluar di tengah ${b.keluar}×`);
  return bagian.join(' · ');
}

// ---------------------------------------------------------------------------------------------
// Statistik lokal

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
   * Per nama pemain manusia, dengan aturan hitung yang sama dengan peringkat online
   * (`hitungPeringkat`): digabung tanpa beda huruf besar/kecil, juara = skor tertinggi di meja
   * (kalau seri, semua yang tertinggi juara), warga kedai tetap dihitung sebagai lawan. Tanpa
   * syarat minimal 2 orang. Warga kedai (bot) tidak ikut: "Kipas Dua" di dua meja berbeda bukan
   * pemain yang sama. Riwayat lama yang belum punya tanda bot tetap dihitung apa adanya.
   * Urutan belum diatur: pakai `urutkanPeringkat`.
   */
  pemain: BarisPeringkat[];
}

/** Hitung statistik dari riwayat lokal. Murni: tidak membaca penyimpanan. */
export function hitungStatistik(riwayat: readonly CatatanPermainan[]): Statistik {
  const sah = riwayat.filter((r) => r && Array.isArray(r.klasemen) && r.klasemen.length);
  let rekor: Statistik['rekor'] = null;
  let terpanjang: Statistik['terpanjang'] = null;
  let offline = 0;
  let putaran = 0;
  for (const r of sah) {
    if (r.mode === 'offline') offline++;
    putaran += r.putaran || 0;
    if (!terpanjang || r.putaran > terpanjang.putaran) terpanjang = { putaran: r.putaran, waktu: r.waktu };
    for (const k of r.klasemen) {
      if (!k || k.bot || !kunciNama(k.nama ?? '')) continue;
      if (!rekor || k.skor > rekor.skor) rekor = { nama: k.nama.trim(), skor: k.skor, waktu: r.waktu };
    }
  }
  // Riwayat tersimpan terbaru dulu; dihitung dari yang paling lama supaya ejaan terakhir yang tampil.
  const kronologis = [...sah].reverse().sort((a, b) => (a.waktu || 0) - (b.waktu || 0));
  const pemain = hitungPeringkat(
    kronologis.map((r) => ({
      jumlahPutaran: r.putaran,
      pemain: r.klasemen.map((k): KursiPeringkat => (k ? { nama: k.nama, bot: !!k.bot, skor: k.skor } : (k as unknown as KursiPeringkat))),
    })),
  );
  return { jumlah: sah.length, offline, online: sah.length - offline, putaran, rekor, terpanjang, pemain };
}

/** Kolom tabel Per pemain dan urutan yang diwakilinya (untuk aria-sort). */
const KOLOM_STATISTIK: [string, UrutanPeringkat[]][] = [
  ['Nama', []],
  ['Main', ['main']],
  ['Juara', ['juara', 'persen']],
  ['Rata-rata', ['rata']],
  ['Terbaik', ['terbaik']],
  ['Posisi', ['posisi']],
];

const opsiUrutan = (daftar: readonly UrutanPeringkat[]) => daftar.map((u) => `<option value="${u}">${esc(LABEL_URUTAN[u])}</option>`).join('');

function htmlStatistik(s: Statistik, namaSaya: string): string {
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
               ${kotak(saya.juara, `kali juara (${persen(saya.persenJuara)})`)}
               ${kotak(angkaSkor(saya.rataRata), 'rata-rata skor')}
               ${kotak(angkaSkor(saya.skorTerbaik), 'skor terbaik')}
             </div>
           </div>`
        : ''
    }
    <p class="kelompok-judul">Per pemain</p>
    <p class="redup rapat">${esc(CATATAN_STATISTIK)}</p>
    <div class="kontrol-peringkat">
      <label class="medan">Urutkan dari<select id="urut-lokal" aria-describedby="jelas-lokal">${opsiUrutan(URUTAN_LOKAL)}</select></label>
    </div>
    <p class="redup rapat" id="jelas-lokal"></p>
    <div class="tabel-gulir" id="tabel-statistik"></div>
    ${s.terpanjang ? `<p class="redup rapat">Permainan terpanjang: ${s.terpanjang.putaran} putaran (${esc(tanggal(s.terpanjang.waktu))}).</p>` : ''}`;
}

function htmlTabelStatistik(pemain: readonly BarisPeringkat[], urut: UrutanPeringkat, namaSaya: string): string {
  const { peringkat, belumCukup } = urutkanPeringkat(pemain, urut);
  const kunciSaya = kunciNama(namaSaya);
  const baris = (p: BarisPeringkat, kurang: boolean) => {
    const saya = kunciNama(p.nama) === kunciSaya;
    const kelas = [saya ? 'saya' : '', kurang ? 'redup' : ''].filter(Boolean).join(' ');
    return `<tr${kelas ? ` class="${kelas}"` : ''}><td>${esc(p.nama)}${saya ? ' <span class="lencana emas">kamu</span>' : ''}</td>
      <td>${p.main}</td><td>${p.juara} (${persen(p.persenJuara)})</td><td class="${kelasSkor(p.rataRata)}">${angkaSkor(p.rataRata)}</td><td>${angkaSkor(p.skorTerbaik)}</td><td>${Math.round(p.poinPosisi)}</td></tr>`;
  };
  return `<table class="skor">
      <thead><tr>${KOLOM_STATISTIK.map(([label, u]) => `<th scope="col"${u.includes(urut) ? ' aria-sort="descending"' : ''}>${label}</th>`).join('')}</tr></thead>
      <tbody>${peringkat.map((p) => baris(p, false)).join('')}${
        belumCukup.length
          ? `<tr class="sub-judul"><th scope="rowgroup" colspan="${KOLOM_STATISTIK.length}">${esc(JUDUL_BELUM_CUKUP)}</th></tr>${belumCukup.map((p) => baris(p, true)).join('')}`
          : ''
      }</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------------------------
// Data server

async function ambil<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

const isPapan = (x: unknown): x is PapanPeringkat =>
  typeof x === 'object' && x !== null && (x as PapanPeringkat).v === 2 && Array.isArray((x as PapanPeringkat).peringkat) && Array.isArray((x as PapanPeringkat).belumCukup);

/** Alamat leaderboard v2 untuk saringan ini (urutan dikirim juga, walau diurutkan ulang di HP). */
export function alamatPapan(urut: UrutanPeringkat, s: SaringanPeringkat): string {
  const q = new URLSearchParams({ v: '2', urut });
  if (s.jumlahPemain !== null) q.set('pemain', String(s.jumlahPemain));
  if (s.jumlahDeck !== null) q.set('deck', String(s.jumlahDeck));
  if (s.periode !== 'semua') q.set('periode', s.periode);
  return `/api/peringkat?${q}`;
}

/** Peringkat dari server lama (array, sebelum #45): tampil seperti dulu. */
function htmlPeringkatLama(daftar: BarisPeringkatLama[], namaSaya: string): string {
  if (!daftar.length) return `<p class="redup">${esc(KOSONG_PERINGKAT)}</p>`;
  return `<div class="rincian">${daftar
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

function htmlBarisPapan(b: BarisPeringkat, label: string, urut: UrutanPeringkat, kunciSaya: string): string {
  const angka = angkaUrutan(b, urut);
  return `<div class="baris-peringkat${kunciNama(b.nama) === kunciSaya ? ' saya' : ''}">
      <span class="medali">${label}</span>
      <span class="nama-skor"><b>${esc(b.nama)}</b><small class="redup">${esc(rincianBaris(b))}</small></span>
      <span class="kanan-peringkat"><b class="total ${angka.kelas}">${esc(angka.teks)}</b><small class="redup">${esc(KETERANGAN_ANGKA[urut])}</small></span>
    </div>`;
}

function htmlPapan(papan: PapanPeringkat, urut: UrutanPeringkat, s: SaringanPeringkat, namaSaya: string): string {
  const { peringkat, belumCukup } = urutkanPeringkat([...papan.peringkat, ...papan.belumCukup], urut);
  const kunciSaya = kunciNama(namaSaya);
  const adaSaringan = s.jumlahPemain !== null || s.jumlahDeck !== null || s.periode !== 'semua';
  if (!peringkat.length && !belumCukup.length) return `<p class="redup">${esc(adaSaringan ? KOSONG_SARINGAN : KOSONG_PERINGKAT)}</p>`;
  const utama = peringkat.length
    ? `<div class="rincian">${peringkat.map((b, i) => htmlBarisPapan(b, MEDALI[i] ?? String(i + 1), urut, kunciSaya)).join('')}</div>`
    : '';
  const kurang = belumCukup.length
    ? `<p class="kelompok-judul">${esc(JUDUL_BELUM_CUKUP)}</p>
       <div class="rincian belum-cukup">${belumCukup.map((b) => htmlBarisPapan(b, '·', 'main', kunciSaya)).join('')}</div>`
    : '';
  return utama + kurang;
}

function htmlPermainan(daftar: PermainanTersimpan[]): string {
  if (!daftar.length) return '<p class="redup">Belum ada permainan online yang selesai.</p>';
  return daftar
    .map(
      (g) => `<details class="akordion putaran-akordion">
        <summary>
          <span class="peringkat">#${g.id}</span>
          <span class="nama-skor"><b>${esc(tanggal(g.selesaiPada))}</b>
            <small class="redup">meja ${esc(g.kodeMeja)} · ${g.jumlahPutaran} putaran · ${esc(ALASAN_SELESAI[g.alasan ?? ''] ?? '')} · juara ${esc(g.klasemen[0]?.nama ?? '-')}${
              g.dihitung === false ? ` · <span class="lencana">${esc(LENCANA_TIDAK_DIHITUNG)}</span>` : ''
            }</small></span>
        </summary>
        <div class="rincian">${g.klasemen
          .map(
            (k) => `<div class="baris-peringkat">
              <span class="medali">${MEDALI[k.peringkat - 1] ?? k.peringkat}</span>
              <span class="nama-skor"><b>${esc(k.nama)}</b>${k.keluar ? ` <span class="lencana merah">${esc(LENCANA_KELUAR)}</span>` : k.bot ? ' <span class="lencana">warga kedai</span>' : ''}
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

/** Kerangka tab Peringkat: kontrol dibuat sekali, hanya #hasil-peringkat yang diganti. */
function htmlKerangkaPeringkat(sekarang: number): string {
  const bulan = labelBulan(bulanWib(sekarang).bulan);
  const opsi = (xs: [string, string][]) => xs.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  return `<div class="kontrol-peringkat">
      <label class="medan k-lebar">Urutkan dari<select id="urut-peringkat" aria-describedby="jelas-urut">${opsiUrutan(DAFTAR_URUTAN)}</select></label>
      <label class="medan">Pemain<select id="saring-pemain">${opsi([['', 'Semua'], ...[2, 3, 4, 5, 6].map((n): [string, string] => [String(n), `${n} orang`])])}</select></label>
      <label class="medan">Deck<select id="saring-deck" aria-describedby="catatan-deck">${opsi([
        ['', 'Semua'],
        ['1', '1 deck'],
        ['2', '2 deck'],
      ])}</select></label>
      <label class="medan k-lebar">Periode<select id="saring-periode">${opsi([
        ['semua', LABEL_PERIODE.semua],
        ['bulan', `${LABEL_PERIODE.bulan} (${bulan})`],
      ])}</select></label>
    </div>
    <p class="redup rapat" id="jelas-urut"></p>
    <p class="redup rapat" id="catatan-deck" hidden>${esc(CATATAN_DECK)}</p>
    <p class="redup rapat" id="catatan-server" hidden>${esc(CATATAN_SERVER_LAMA)}</p>
    <p class="redup rapat ringkasan-peringkat" id="ringkasan-peringkat" role="status"></p>
    <div id="hasil-peringkat"></div>
    <details class="akordion cara-hitung">
      <summary>${esc(JUDUL_CARA_HITUNG)}</summary>
      <ul class="redup">${CARA_HITUNG.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </details>`;
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
  /** Penanda permintaan: jawaban server yang telat untuk tab/saringan lama diabaikan. */
  let permintaan = 0;
  // Pilihan di tab Peringkat dan Statistik bertahan selama layar Riwayat terbuka.
  let urutPeringkat: UrutanPeringkat = URUTAN_BAWAAN;
  let saringan: SaringanPeringkat = { ...SARINGAN_BAWAAN };
  let urutLokal: UrutanPeringkat = URUTAN_BAWAAN;
  /** Data papan terakhir; ganti urutan cukup mengurutkan ulang ini tanpa ambil ke server. */
  let papan: PapanPeringkat | null = null;

  /** Panel galat dengan Coba lagi dan pindah ke HP ini, di `wadah` (isi tab, atau hasil peringkat). */
  const tampilGagal = (wadah: HTMLElement, cobaLagi: () => void) => {
    wadah.innerHTML = `<p class="redup rapat">Riwayat server belum bisa dibuka${navigator.onLine ? '' : ' karena kamu sedang offline'}. Riwayat yang tersimpan di HP ini tetap aman.</p>
      <div class="deret">
        <button type="button" data-coba>Coba lagi</button>
        <button type="button" class="utama" data-lokal>Lihat yang di HP ini</button>
      </div>`;
    wadah.querySelector('[data-coba]')!.addEventListener('click', () => {
      // Tombolnya hilang saat isi wadah diganti: fokus dipindah ke wadahnya dulu supaya tidak jatuh
      // ke <body> (pembaca layar tetap di tempat, tidak perlu Tab dari atas lagi).
      wadah.tabIndex = -1;
      wadah.focus();
      cobaLagi();
    });
    wadah.querySelector('[data-lokal]')!.addEventListener('click', () => {
      pilih('lokal');
      akar.querySelector<HTMLElement>('#tab-lokal')?.focus();
    });
  };

  const bukaStatistik = () => {
    const { pemain, ...ringkasan } = hitungStatistik(simpan.riwayat());
    isi.innerHTML = htmlStatistik({ ...ringkasan, pemain }, namaSaya);
    const sel = isi.querySelector<HTMLSelectElement>('#urut-lokal');
    if (!sel) return;
    const tabel = isi.querySelector<HTMLElement>('#tabel-statistik')!;
    const jelas = isi.querySelector<HTMLElement>('#jelas-lokal')!;
    const tampil = () => {
      jelas.textContent = jelasUrutan(urutLokal);
      tabel.innerHTML = htmlTabelStatistik(pemain, urutLokal, namaSaya);
    };
    // Nilai dipasang dari JS (bukan atribut selected) supaya pilihan terakhir selalu terbaca benar.
    sel.value = URUTAN_LOKAL.includes(urutLokal) ? urutLokal : URUTAN_BAWAAN;
    urutLokal = rapikanUrutan(sel.value);
    sel.addEventListener('change', () => {
      urutLokal = rapikanUrutan(sel.value);
      tampil();
    });
    tampil();
  };

  const bukaPeringkat = () => {
    isi.innerHTML = htmlKerangkaPeringkat(Date.now());
    const q = <T extends HTMLElement>(s: string) => isi.querySelector<T>(s)!;
    const selUrut = q<HTMLSelectElement>('#urut-peringkat');
    const selPemain = q<HTMLSelectElement>('#saring-pemain');
    const selDeck = q<HTMLSelectElement>('#saring-deck');
    const selPeriode = q<HTMLSelectElement>('#saring-periode');
    const hasil = q<HTMLElement>('#hasil-peringkat');
    const ringkas = q<HTMLElement>('#ringkasan-peringkat');
    const jelas = q<HTMLElement>('#jelas-urut');
    const catatanDeck = q<HTMLElement>('#catatan-deck');
    const catatanServer = q<HTMLElement>('#catatan-server');
    selUrut.value = urutPeringkat;
    selPemain.value = saringan.jumlahPemain === null ? '' : String(saringan.jumlahPemain);
    selDeck.value = saringan.jumlahDeck === null ? '' : String(saringan.jumlahDeck);
    selPeriode.value = saringan.periode;

    const perbaruiJelas = () => {
      jelas.textContent = jelasUrutan(urutPeringkat);
      catatanDeck.hidden = saringan.jumlahDeck === null;
    };
    const tampilPapan = (p: PapanPeringkat) => {
      hasil.innerHTML = htmlPapan(p, urutPeringkat, saringan, namaSaya);
      const periode = p.periode ? `${LABEL_PERIODE.bulan} (${labelBulan(p.periode.bulan)})` : LABEL_PERIODE.semua;
      const orang = p.peringkat.length + p.belumCukup.length;
      ringkas.textContent = `${LABEL_URUTAN[urutPeringkat]} · ${periode} · ${orang} orang dari ${p.jumlahPermainan} permainan`;
    };
    const muat = () => {
      const ke = ++permintaan;
      papan = null;
      hasil.innerHTML = '<p class="redup" aria-busy="true">Memuat dari server…</p>';
      const gagal = () => {
        if (ke !== permintaan) return;
        ringkas.textContent = '';
        tampilGagal(hasil, muat);
      };
      ambil<unknown>(alamatPapan(urutPeringkat, saringan)).then(
        (d) => {
          if (ke !== permintaan) return;
          if (Array.isArray(d)) {
            // Server lama (sebelum #45): tampil seperti dulu, pilihan dimatikan.
            for (const s of [selUrut, selPemain, selDeck, selPeriode]) s.disabled = true;
            catatanServer.hidden = false;
            jelas.hidden = true;
            catatanDeck.hidden = true;
            hasil.innerHTML = htmlPeringkatLama(d as BarisPeringkatLama[], namaSaya);
            ringkas.textContent = `${LABEL_URUTAN.juara} · ${LABEL_PERIODE.semua} · ${d.length} orang`;
            return;
          }
          if (!isPapan(d)) return gagal();
          papan = d;
          tampilPapan(d);
        },
        gagal,
      );
    };

    selUrut.addEventListener('change', () => {
      urutPeringkat = rapikanUrutan(selUrut.value);
      perbaruiJelas();
      // Data sudah ada: cukup diurutkan ulang di sini. Masih memuat: jawabannya diurutkan saat tiba.
      if (papan) tampilPapan(papan);
    });
    const gantiSaringan = () => {
      saringan = rapikanSaringan({ jumlahPemain: selPemain.value, jumlahDeck: selDeck.value, periode: selPeriode.value });
      perbaruiJelas();
      muat();
    };
    for (const s of [selPemain, selDeck, selPeriode]) s.addEventListener('change', gantiSaringan);
    perbaruiJelas();
    muat();
  };

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
    if (tab === 'statistik') return bukaStatistik();
    if (tab === 'peringkat') return bukaPeringkat();
    isi.innerHTML = '<p class="redup" aria-busy="true">Memuat dari server…</p>';
    ambil<PermainanTersimpan[]>('/api/riwayat?batas=30').then(
      (d) => {
        if (ke === permintaan) isi.innerHTML = htmlPermainan(d);
      },
      () => {
        if (ke === permintaan) tampilGagal(isi, () => pilih(tab));
      },
    );
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
