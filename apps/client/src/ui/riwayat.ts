// Layar riwayat: klasemen akhir permainan online (dari database server) dan peringkat sepanjang masa.

import { simpan } from '../penyimpanan';
import { esc } from './dom';

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

type Tab = 'peringkat' | 'permainan' | 'lokal';

const MEDALI = ['🥇', '🥈', '🥉'];
const ALASAN: Record<string, string> = { sepakat: 'sepakat berhenti', batasPutaran: 'batas putaran', batasSkor: 'batas skor' };
const tanggal = (iso: string | number) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const kelasSkor = (x: number) => (x > 0 ? 'positif' : x < 0 ? 'negatif' : '');

async function ambil<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

function htmlPeringkat(daftar: BarisPeringkat[]): string {
  if (!daftar.length) return '<p class="redup">Belum ada permainan online yang selesai.</p>';
  return `<p class="redup" style="margin:0">Pemain manusia saja, digabung berdasarkan nama. Urut dari jumlah juara, lalu total skor.</p>
    <div class="rincian">${daftar
      .map(
        (p, i) => `<div class="baris-peringkat">
          <span class="medali">${MEDALI[i] ?? i + 1}</span>
          <span class="nama-skor"><b>${esc(p.nama)}</b>
            <small class="redup">main ${p.main}× · juara ${p.juara}× · mentung ${p.mentung}× · kepentung ${p.kepentung}× · terbaik ${p.skorTerbaik}</small></span>
          <span class="kanan-peringkat"><b class="total ${kelasSkor(p.totalSkor)}">${p.totalSkor}</b><small class="redup">rata-rata ${p.rataRata}</small></span>
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
              <span class="nama-skor"><b>${esc(k.nama)}</b>${k.bot ? ' <span class="lencana">bot</span>' : ''}
                <small class="redup">mentung ${k.mentung}× · kepentung ${k.kepentung}×</small></span>
              <b class="total ${kelasSkor(k.skor)}">${k.skor}</b>
            </div>`,
          )
          .join('')}</div>
      </details>`,
    )
    .join('');
}

function htmlLokal(): string {
  const daftar = simpan.riwayat();
  if (!daftar.length) return '<p class="redup">Belum ada permainan yang selesai di HP ini.</p>';
  return `<p class="redup" style="margin:0">Tersimpan di HP ini saja (online dan offline), 30 terakhir.</p>${daftar
    .map(
      (r) => `<div class="baris-peringkat">
        <span class="medali">${r.mode === 'offline' ? '📴' : '🌐'}</span>
        <span class="nama-skor"><b>${esc(tanggal(r.waktu))}</b>
          <small class="redup">${r.putaran} putaran · ${r.klasemen.map((k, i) => `${i + 1}. ${esc(k.nama)} (${k.skor})`).join(' · ')}</small></span>
      </div>`,
    )
    .join('')}`;
}

export function renderRiwayat(akar: HTMLElement, kembali: () => void, tab: Tab = 'peringkat'): void {
  akar.innerHTML = `
  <div class="layar"><div class="kolom">
    <div class="judul"><h1>🏆 Riwayat</h1><p>Klasemen akhir Remi Kampung Madya</p></div>
    <div class="tab" role="tablist">
      <button data-tab="peringkat" class="${tab === 'peringkat' ? 'aktif' : ''}">Peringkat</button>
      <button data-tab="permainan" class="${tab === 'permainan' ? 'aktif' : ''}">Permainan</button>
      <button data-tab="lokal" class="${tab === 'lokal' ? 'aktif' : ''}">Di HP ini</button>
    </div>
    <div class="kartu-panel isi-tab" id="isi-riwayat"><p class="redup">Memuat…</p></div>
    <button id="kembali">Kembali</button>
  </div></div>`;
  akar.querySelector('#kembali')!.addEventListener('click', kembali);
  akar.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => renderRiwayat(akar, kembali, b.dataset.tab as Tab)),
  );
  const isi = akar.querySelector<HTMLElement>('#isi-riwayat')!;
  if (tab === 'lokal') {
    isi.innerHTML = htmlLokal();
    return;
  }
  const gagal = () =>
    (isi.innerHTML = `<p class="redup">Riwayat server belum bisa dibuka${navigator.onLine ? '' : ' (kamu sedang offline)'}. Riwayat di HP ini tetap ada di tab "Di HP ini".</p>`);
  if (tab === 'peringkat') {
    ambil<BarisPeringkat[]>('/api/peringkat').then((d) => (isi.innerHTML = htmlPeringkat(d)), gagal);
  } else {
    ambil<PermainanTersimpan[]>('/api/riwayat?batas=30').then((d) => (isi.innerHTML = htmlPermainan(d)), gagal);
  }
}
