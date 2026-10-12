// Layar beranda: nama, main online (buat/gabung/daftar meja publik), main offline lawan bot.

import type { PengaturanMeja, RingkasanMeja } from '@remi/meja';
import { simpan } from '../penyimpanan';
import { esc } from './dom';

export interface AksiBeranda {
  buatMeja(nama: string): void;
  gabung(nama: string, kode: string): void;
  lihatPublik(): void;
  lihatRiwayat(): void;
  mainOffline(nama: string, pengaturan: Partial<PengaturanMeja>, pengocokSaya: boolean): void;
  lanjutOffline(): void;
  pasangAplikasi: (() => void) | null;
}

export function renderBeranda(akar: HTMLElement, aksi: AksiBeranda, kodeAwal = ''): void {
  const p = {
    jumlahPemain: 4,
    levelBot: 'normal',
    batasPutaran: null,
    batasSkorAtas: null,
    batasSkorBawah: null,
    ...simpan.pengaturanOffline(),
  } as PengaturanMeja;
  const adaSimpanan = !!simpan.mejaOffline();
  const riwayat = simpan.riwayat().slice(0, 5);
  const online = navigator.onLine;
  akar.innerHTML = `
  <div class="layar"><div class="kolom">
    <div class="judul"><h1>♠ Remi Kampung Madya ♥</h1><p>Aturan main kami di Kedai Madya, bukan remi biasa.</p></div>

    <div class="kartu-panel">
      <label>Nama kamu<input type="text" id="nama" maxlength="16" placeholder="misal: Budi" value="${esc(simpan.nama())}" autocomplete="nickname" /></label>
    </div>

    <div class="kartu-panel">
      <h2>Main online</h2>
      ${online ? '' : '<p class="redup">Kamu sedang offline. Main online butuh internet.</p>'}
      <button class="utama" id="buat" ${online ? '' : 'disabled'}>Buat meja baru</button>
      <div class="deret">
        <input type="text" id="kode" class="input-kode" maxlength="5" placeholder="KODE" value="${esc(kodeAwal)}" style="flex:2" />
        <button id="gabung" ${online ? '' : 'disabled'} style="flex:1">Gabung</button>
      </div>
      <button id="publik" ${online ? '' : 'disabled'}>Cari meja publik</button>
      <button id="riwayat">🏆 Riwayat &amp; peringkat</button>
    </div>

    <div class="kartu-panel">
      <h2>Main offline lawan bot</h2>
      ${adaSimpanan ? '<button class="utama" id="lanjut">Lanjutkan permainan offline</button>' : ''}
      <label class="baris">Jumlah pemain
        <select id="o-jumlah">${[2, 3, 4, 5, 6].map((n) => `<option ${n === p.jumlahPemain ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="baris" id="o-dua-baris">Pakai 2 deck (12 kartu)<input type="checkbox" id="o-dua" ${p.duaDeckUntukEmpat ? 'checked' : ''} /></label>
      <label class="baris">Level bot
        <select id="o-level"><option value="mudah" ${p.levelBot === 'mudah' ? 'selected' : ''}>Mudah</option><option value="normal" ${p.levelBot === 'normal' ? 'selected' : ''}>Normal</option></select></label>
      <label class="baris">Tempo bot
        <select id="o-tempo">${(['santai', 'normal', 'cepat'] as const)
          .map((t) => `<option value="${t}" ${t === (p.tempoBot ?? 'santai') ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`)
          .join('')}</select></label>
      <label class="baris">Batas putaran
        <select id="o-putaran">${[3, 5, 10, 15, 20, 0].map((n) => `<option value="${n}" ${n === (p.batasPutaran ?? 0) ? 'selected' : ''}>${n || 'Tanpa batas'}</option>`).join('')}</select></label>
      <label class="baris">Batas skor ±500<input type="checkbox" id="o-skor" ${p.batasSkorAtas === null ? '' : 'checked'} /></label>
      <label class="baris">Pengocok pertama
        <select id="o-kocok"><option value="acak">Acak</option><option value="saya">Saya</option></select></label>
      <button ${adaSimpanan ? '' : 'class="utama"'} id="offline">${adaSimpanan ? 'Mulai baru (yang tersimpan dihapus)' : 'Mulai'}</button>
    </div>

    ${aksi.pasangAplikasi ? '<button id="pasang">📲 Pasang ke layar utama</button>' : ''}

    ${
      riwayat.length
        ? `<div class="kartu-panel"><h2>Riwayat</h2>${riwayat
            .map(
              (r) =>
                `<div class="redup">${new Date(r.waktu).toLocaleDateString('id-ID')} · ${r.mode} · ${r.putaran} putaran · juara <b>${esc(r.klasemen[0]?.nama)}</b> (${r.klasemen[0]?.skor})</div>`,
            )
            .join('')}</div>`
        : ''
    }
  </div></div>`;

  const nama = () => {
    const n = (akar.querySelector('#nama') as HTMLInputElement).value.trim();
    simpan.setNama(n);
    return n || 'Pemain';
  };
  const el = <T extends HTMLElement>(id: string) => akar.querySelector(`#${id}`) as T | null;
  const jumlah = el<HTMLSelectElement>('o-jumlah')!;
  const perbaruiDua = () => el('o-dua-baris')!.classList.toggle('tersembunyi', jumlah.value !== '4');
  jumlah.addEventListener('change', perbaruiDua);
  perbaruiDua();

  el('buat')?.addEventListener('click', () => aksi.buatMeja(nama()));
  el('gabung')?.addEventListener('click', () => aksi.gabung(nama(), el<HTMLInputElement>('kode')!.value));
  el('kode')?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') aksi.gabung(nama(), el<HTMLInputElement>('kode')!.value);
  });
  el('riwayat')?.addEventListener('click', () => aksi.lihatRiwayat());
  el('publik')?.addEventListener('click', () => {
    nama();
    aksi.lihatPublik();
  });
  el('lanjut')?.addEventListener('click', () => aksi.lanjutOffline());
  el('pasang')?.addEventListener('click', () => aksi.pasangAplikasi?.());
  el('offline')!.addEventListener('click', () => {
    const n = Number(jumlah.value);
    const putaran = Number(el<HTMLSelectElement>('o-putaran')!.value);
    const skor = el<HTMLInputElement>('o-skor')!.checked;
    const pengaturan: Partial<PengaturanMeja> = {
      jumlahPemain: n,
      duaDeckUntukEmpat: n === 4 && el<HTMLInputElement>('o-dua')!.checked,
      levelBot: el<HTMLSelectElement>('o-level')!.value as PengaturanMeja['levelBot'],
      tempoBot: el<HTMLSelectElement>('o-tempo')!.value as PengaturanMeja['tempoBot'],
      batasPutaran: putaran || null,
      batasSkorAtas: skor ? 500 : null,
      batasSkorBawah: skor ? -500 : null,
    };
    simpan.setPengaturanOffline(pengaturan);
    aksi.mainOffline(nama(), pengaturan, el<HTMLSelectElement>('o-kocok')!.value === 'saya');
  });
}

export function renderDaftarPublik(
  akar: HTMLElement,
  daftar: RingkasanMeja[],
  gabung: (kode: string) => void,
  segarkan: () => void,
  kembali: () => void,
) {
  akar.innerHTML = `
  <div class="layar"><div class="kolom">
    <div class="judul"><h1>Meja publik</h1><p>Meja yang masih menunggu pemain.</p></div>
    <div class="kartu-panel daftar-meja">
      ${
        daftar.length
          ? daftar
              .map(
                (m) => `<div class="kursi" data-kode="${esc(m.kode)}"><span class="nama"><b>${esc(m.namaHost)}</b> · ${esc(m.kode)}</span>
                <span class="lencana">${m.terisi}/${m.jumlahPemain}</span><button class="kecil">Gabung</button></div>`,
              )
              .join('')
          : '<p class="redup">Belum ada meja publik. Buat meja sendiri dan centang "Publik".</p>'
      }
    </div>
    <div class="deret"><button id="segarkan">Segarkan</button><button id="kembali">Kembali</button></div>
  </div></div>`;
  akar.querySelectorAll<HTMLElement>('[data-kode]').forEach((b) => b.addEventListener('click', () => gabung(b.dataset.kode!)));
  akar.querySelector('#kembali')!.addEventListener('click', kembali);
  akar.querySelector('#segarkan')!.addEventListener('click', segarkan);
}
