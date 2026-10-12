// Lobi meja online: kode/undangan, kursi (orang/bot/kosong), pengaturan, mulai.

import type { InfoMeja, PengaturanMeja, PesanKlien } from '@remi/meja';
import { esc, toast } from './dom';

export function renderLobi(akar: HTMLElement, info: InfoMeja, kirim: (p: PesanKlien) => void, keluar: () => void): void {
  const host = info.kursiSaya === info.host;
  const p = info.pengaturan;
  const tautan = `${location.origin}/?meja=${info.kode}`;
  const kosong = info.kursi.filter((k) => k.jenis === 'kosong').length;
  const dis = host ? '' : 'disabled';

  const barisKursi = info.kursi
    .map((k, i) => {
      const lencana = [
        i === info.host ? '<span class="lencana emas">host</span>' : '',
        i === info.kursiSaya ? '<span class="lencana">kamu</span>' : '',
        k.jenis === 'bot' ? `<span class="lencana">bot ${k.level}</span>` : '',
        k.jenis === 'manusia' && !k.terhubung ? '<span class="lencana merah">terputus</span>' : '',
      ].join('');
      const nama = k.jenis === 'kosong' ? '<span class="redup">menunggu orang masuk…</span>' : `<b>${esc(k.nama)}</b>`;
      const nilai = k.jenis === 'kosong' ? 'kosong' : k.jenis === 'bot' ? `bot-${k.level}` : 'manusia';
      const pilih =
        host && i !== info.kursiSaya
          ? `<select data-kursi="${i}">
              ${k.jenis === 'manusia' ? `<option value="manusia" selected>${esc(k.nama)}</option>` : ''}
              <option value="kosong" ${nilai === 'kosong' ? 'selected' : ''}>Tunggu orang</option>
              <option value="bot-mudah" ${nilai === 'bot-mudah' ? 'selected' : ''}>Bot mudah</option>
              <option value="bot-normal" ${nilai === 'bot-normal' ? 'selected' : ''}>Bot normal</option>
            </select>`
          : '';
      return `<div class="kursi"><span class="redup">${i + 1}</span><span class="nama">${nama}</span>${lencana}${pilih}</div>`;
    })
    .join('');

  const pilihanBatas = (id: string, nilai: number | null, opsi: number[], label: (n: number) => string) =>
    `<select id="${id}" ${dis}>${opsi.map((n) => `<option value="${n}" ${n === (nilai ?? 0) ? 'selected' : ''}>${label(n)}</option>`).join('')}</select>`;

  akar.innerHTML = `
  <div class="layar"><div class="kolom">
    <div class="judul"><p>Kode meja</p><div class="kode-besar">${esc(info.kode)}</div></div>
    <div class="deret"><button id="salin">Salin link undangan</button>${'share' in navigator ? '<button id="bagi">Bagikan</button>' : ''}</div>

    <div class="kartu-panel">
      <h2>Kursi (${info.kursi.length - kosong}/${info.kursi.length})</h2>
      ${barisKursi}
      ${host ? '<button id="isi-bot" class="kecil">Isi semua kursi kosong dengan bot</button>' : ''}
    </div>

    <div class="kartu-panel">
      <h2>Pengaturan ${host ? '' : '<span class="redup">(diatur host)</span>'}</h2>
      <label class="baris">Jumlah pemain
        <select id="jumlah" ${dis}>${[2, 3, 4, 5, 6].map((n) => `<option ${n === p.jumlahPemain ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${p.jumlahPemain === 4 ? `<label class="baris">Pakai 2 deck (12 kartu)<input type="checkbox" id="dua" ${p.duaDeckUntukEmpat ? 'checked' : ''} ${dis} /></label>` : ''}
      <label class="baris">Batas putaran ${pilihanBatas('putaran', p.batasPutaran, [3, 5, 10, 15, 20, 0], (n) => (n ? String(n) : 'Tanpa batas'))}</label>
      <label class="baris">Batas skor atas ${pilihanBatas('atas', p.batasSkorAtas, [300, 500, 1000, 0], (n) => (n ? String(n) : 'Tidak ada'))}</label>
      <label class="baris">Batas skor bawah ${pilihanBatas('bawah', p.batasSkorBawah, [-300, -500, -1000, 0], (n) => (n ? String(n) : 'Tidak ada'))}</label>
      <label class="baris">Waktu per giliran ${pilihanBatas('detik', p.detikGiliran, [30, 60, 90, 120, 0], (n) => (n ? `${n} detik` : 'Tanpa batas'))}</label>
      <label class="baris">Tempo bot
        <select id="tempo" ${dis}>${(['santai', 'normal', 'cepat'] as const)
          .map((t) => `<option value="${t}" ${t === (p.tempoBot ?? 'santai') ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`)
          .join('')}</select></label>
      <label class="baris">Meja publik (muncul di daftar)<input type="checkbox" id="publik" ${p.publik ? 'checked' : ''} ${dis} /></label>
    </div>

    ${
      host
        ? `<div class="kartu-panel">
            <label class="baris">Pengocok pertama
              <select id="kocok"><option value="acak">Acak</option>${info.kursi
                .map((k, i) => (k.jenis === 'kosong' ? '' : `<option value="${i}">${esc(k.nama)}</option>`))
                .join('')}</select></label>
            <button class="utama" id="mulai" ${kosong ? 'aria-disabled="true" style="opacity:.45"' : ''}>Mulai main</button>
            ${kosong ? '<p class="redup">Masih ada kursi kosong: tunggu teman masuk atau isi dengan bot.</p>' : ''}
          </div>`
        : '<div class="kartu-panel"><p class="redup">Menunggu host memulai permainan…</p></div>'
    }
    <button id="keluar" class="bahaya">Keluar meja</button>
  </div></div>`;

  const q = <T extends HTMLElement>(sel: string) => akar.querySelector(sel) as T | null;
  q('#salin')!.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(tautan);
      toast('Link undangan disalin.');
    } catch {
      toast(tautan);
    }
  });
  q('#bagi')?.addEventListener('click', () => {
    void navigator.share?.({ title: 'Main Remi Kampung Madya', text: `Gabung meja Remi Kampung Madya, kode ${info.kode}`, url: tautan }).catch(() => undefined);
  });
  q('#keluar')!.addEventListener('click', keluar);
  if (!host) return;

  akar.querySelectorAll<HTMLSelectElement>('[data-kursi]').forEach((s) =>
    s.addEventListener('change', () => {
      const i = Number(s.dataset.kursi);
      if (s.value === 'manusia') return;
      if (s.value === 'kosong') kirim({ t: 'aturKursi', kursi: i, jenis: 'kosong' });
      else kirim({ t: 'aturKursi', kursi: i, jenis: 'bot', level: s.value === 'bot-mudah' ? 'mudah' : 'normal' });
    }),
  );
  q('#isi-bot')?.addEventListener('click', () =>
    info.kursi.forEach((k, i) => {
      if (k.jenis === 'kosong') kirim({ t: 'aturKursi', kursi: i, jenis: 'bot' });
    }),
  );
  const ubah = (pengaturan: Partial<PengaturanMeja>) => kirim({ t: 'pengaturan', pengaturan });
  const angka = (id: string) => Number(q<HTMLSelectElement>(id)!.value) || null;
  q('#jumlah')!.addEventListener('change', () => ubah({ jumlahPemain: Number(q<HTMLSelectElement>('#jumlah')!.value) }));
  q('#dua')?.addEventListener('change', () => ubah({ duaDeckUntukEmpat: q<HTMLInputElement>('#dua')!.checked }));
  q('#putaran')!.addEventListener('change', () => ubah({ batasPutaran: angka('#putaran') }));
  q('#atas')!.addEventListener('change', () => ubah({ batasSkorAtas: angka('#atas') }));
  q('#bawah')!.addEventListener('change', () => ubah({ batasSkorBawah: angka('#bawah') }));
  q('#detik')!.addEventListener('change', () => ubah({ detikGiliran: Number(q<HTMLSelectElement>('#detik')!.value) }));
  q('#tempo')!.addEventListener('change', () => ubah({ tempoBot: q<HTMLSelectElement>('#tempo')!.value as PengaturanMeja['tempoBot'] }));
  q('#publik')!.addEventListener('change', () => ubah({ publik: q<HTMLInputElement>('#publik')!.checked }));
  q('#mulai')!.addEventListener('click', () => {
    if (kosong) return toast('Masih ada kursi kosong. Isi dengan bot atau tunggu orang masuk.', true);
    const v = q<HTMLSelectElement>('#kocok')!.value;
    kirim({ t: 'mulai', pengocok: v === 'acak' ? undefined : Number(v) });
  });
}
