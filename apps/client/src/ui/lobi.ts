// Lobi meja online: kode/undangan, kursi (orang/warga kedai/kosong), pengaturan, mulai.
// Mode kaldu (#42, #43) hanya bisa diatur host; selama mode kaldu nyala, isian batas skor tidak
// ditampilkan (meja juga tidak memakainya).
// Juga teks konfirmasi keluar meja yang dipakai bersama semua jalur (tombol di lobi, menu meja,
// tombol Back di main.ts), supaya isinya sama dan jujur soal apa yang terjadi pada kursimu.
// "Warga kedai" = istilah UI untuk pemain komputer (kode/protokol tetap memakai 'bot').
// Meja kompetisi (#51, versi 2): tanpa warga kedai, tanpa kode/undangan dan tanpa tombol Mulai (meja
// mulai sendiri begitu semua kursi terisi peserta yang tersambung), aturannya ditampilkan sebagai teks.

import type { LevelBot } from '@remi/engine';
import type { InfoKursi, InfoMeja, PengaturanMeja, PesanKlien } from '@remi/meja';
import { TEKS_KALDU } from '../konten/kaldu';
import { TEKS_KOMPETISI, teksMenungguPeserta } from '../konten/kompetisi';
import { DAFTAR_LEVEL_WARGA, infoLevel, labelLevelKecil } from '../konten/levelWarga';
import { htmlIsianBatas, lepasIsianBatas, pasangIsianBatas } from './batasSkor';
import { esc, konfirmasi, toast, type OpsiKonfirmasi } from './dom';

/** Nilai <select> kursi untuk warga kedai level tertentu, mis. "bot-jago". */
const nilaiBot = (level: string) => `bot-${level}`;

/**
 * Level dari nilai pilihan kursi ("bot-suhu" → 'suhu'). Undefined kalau nilainya bukan level yang
 * dikenal (mis. pilihan "Warga kedai" untuk level dari versi lain): meja memakai level bawaannya.
 */
export function levelDariPilihan(nilai: string): LevelBot | undefined {
  return DAFTAR_LEVEL_WARGA.find((l) => nilai === nilaiBot(l.level))?.level;
}

/** Pilihan isi kursi untuk host: tunggu orang, atau warga kedai per level (meja kompetisi: tanpa warga kedai). */
function pilihanKursi(k: InfoKursi, i: number, kompetisi: boolean): string {
  const nilai = k.jenis === 'kosong' ? 'kosong' : k.jenis === 'bot' ? nilaiBot(k.level) : 'manusia';
  const dipilih = (v: string) => (v === nilai ? 'selected' : '');
  // Level yang tidak dikenal versi ini (server lebih baru): tetap tampil sebagai warga kedai, bukan "Tunggu orang".
  const levelAsing = k.jenis === 'bot' && !infoLevel(k.level);
  return `<select data-kursi="${i}" aria-label="Isi kursi ${i + 1}">
      ${k.jenis === 'manusia' ? `<option value="manusia" selected>${esc(k.nama)}</option>` : ''}
      ${levelAsing ? '<option value="bot" selected>Warga kedai</option>' : ''}
      <option value="kosong" ${dipilih('kosong')}>Tunggu orang</option>
      ${
        kompetisi
          ? ''
          : `<optgroup label="Warga kedai">${DAFTAR_LEVEL_WARGA.map(
              (l) => `<option value="${nilaiBot(l.level)}" ${dipilih(nilaiBot(l.level))}>${esc(l.pilihan)}</option>`,
            ).join('')}</optgroup>`
      }
    </select>`;
}

export interface KeadaanKeluar {
  /** Layar asal: lobi (sebelum mulai) atau meja (permainan sudah mulai). */
  asal: 'lobi' | 'meja';
  offline: boolean;
  /** Permainan sudah selesai (klasemen akhir). */
  selesai?: boolean;
  /**
   * Meja online ini masuk peringkat (minimal 2 orang di kursi, keputusan pemilik #45): keluar di
   * tengah permainan dihitung juru kunci, jadi pemain diberi tahu.
   */
  masukPeringkat?: boolean;
  /** Meja kompetisi (#51): keluar di tengah permainan = nilai 0; di lobi, duduk lagi lewat layar Kompetisi. */
  kompetisi?: boolean;
}

/** Ada minimal 2 kursi manusia (yang keluar sudah jadi warga kedai): permainannya masuk peringkat online. */
export const mejaMasukPeringkat = (info: Pick<InfoMeja, 'kursi'> | null | undefined): boolean =>
  (info?.kursi.filter((k) => k.jenis === 'manusia').length ?? 0) >= 2;

/**
 * Teks konfirmasi keluar meja. Satu sumber untuk semua jalur supaya pemain selalu membaca hal
 * yang sama. Isinya mengikuti perilaku Meja (packages/meja): keluar di lobi = kursi dikosongkan
 * (bisa gabung lagi selama masih ada kursi kosong); keluar saat main = kursi diteruskan warga kedai
 * sampai permainan selesai dan tidak bisa diambil lagi. Offline: permainan tersimpan otomatis.
 */
export function opsiKonfirmasiKeluar(k: KeadaanKeluar): OpsiKonfirmasi {
  if (k.offline) {
    return k.selesai
      ? { judul: 'Ke beranda?', pesan: 'Permainannya sudah selesai. Main baru bisa dimulai dari beranda.', ya: 'Ke beranda', tidak: 'Tetap di sini' }
      : {
          judul: 'Ke beranda dulu?',
          pesan: 'Permainan offline tersimpan otomatis. Kamu bisa lanjut kapan saja dari beranda.',
          ya: 'Simpan & ke beranda',
          tidak: 'Lanjut main',
        };
  }
  if (k.asal === 'lobi') {
    return {
      judul: 'Keluar dari meja?',
      pesan: k.kompetisi
        ? TEKS_KOMPETISI.keluarLobi
        : 'Kursimu di lobi dilepas. Mau balik? Gabung lagi pakai kode meja selama permainan belum mulai dan masih ada kursi kosong.',
      ya: 'Keluar',
      tidak: 'Tetap di sini',
      bahaya: true,
    };
  }
  if (k.selesai) {
    return {
      judul: 'Keluar dari meja?',
      pesan: k.kompetisi ? TEKS_KOMPETISI.keluarSelesai : 'Permainannya sudah selesai. Kalau host ngajak main lagi, kamu nggak ikut.',
      ya: 'Keluar',
      tidak: 'Tetap di sini',
    };
  }
  return {
    judul: 'Keluar dari meja?',
    pesan: `Kursimu diteruskan warga kedai sampai permainan selesai, dan kamu nggak bisa balik ke kursi ini lagi.${
      k.masukPeringkat ? ' Di peringkat online kamu dihitung juru kunci.' : ''
    }${k.kompetisi ? ` ${TEKS_KOMPETISI.keluarMeja}` : ''}`,
    ya: 'Keluar',
    tidak: 'Tetap di sini',
    bahaya: true,
  };
}

export function renderLobi(akar: HTMLElement, info: InfoMeja, kirim: (p: PesanKlien) => void, keluar: () => void): void {
  const host = info.kursiSaya === info.host;
  // Lobi digambar ulang setiap info meja berubah (ada yang masuk, kursi diatur). Angka batas skor
  // yang sedang diketik host jangan sampai hilang: dicatat di sini, dipulihkan sesudah digambar.
  const aktif = document.activeElement;
  const sedangDiisi =
    aktif instanceof HTMLInputElement && aktif.dataset.batasSkor && akar.contains(aktif) ? { id: aktif.id, nilai: aktif.value } : null;
  // Posisi gulir dan isian yang sedang difokus juga dipulihkan: tanpa ini setiap pengaturan yang
  // diubah membuat layar melompat ke atas (layar lobi baru mulai dari gulir 0).
  const gulirLama = akar.querySelector<HTMLElement>('.layar-lobi')?.scrollTop ?? null;
  const fokusLama =
    aktif instanceof HTMLElement && akar.contains(aktif)
      ? aktif.id && /^[\w-]+$/.test(aktif.id)
        ? `#${aktif.id}`
        : aktif.dataset.kursi !== undefined
          ? `[data-kursi="${Number(aktif.dataset.kursi)}"]`
          : null
      : null;
  lepasIsianBatas(akar);
  const p = info.pengaturan;
  const tautan = `${location.origin}/?meja=${info.kode}`;
  const kosong = info.kursi.filter((k) => k.jenis === 'kosong').length;
  const dis = host ? '' : 'disabled';
  const kompetisi = info.kompetisi ?? null;
  // Meja kompetisi: semua aturan ikut kompetisinya, ditampilkan sebagai teks saja.
  const ubahAturan = host && !kompetisi;
  const disAturan = ubahAturan ? '' : 'disabled';

  const barisKursi = info.kursi
    .map((k, i) => {
      const lencana = [
        i === info.host ? '<span class="lencana emas">host</span>' : '',
        i === info.kursiSaya ? '<span class="lencana">kamu</span>' : '',
        k.jenis === 'bot' ? `<span class="lencana">${esc(['warga kedai', labelLevelKecil(k.level)].filter(Boolean).join(' · '))}</span>` : '',
        k.jenis === 'manusia' && !k.terhubung ? '<span class="lencana merah">terputus</span>' : '',
      ].join('');
      const nama =
        k.jenis === 'kosong' ? `<span class="redup">${kompetisi ? 'menunggu peserta…' : 'menunggu orang masuk…'}</span>` : `<b>${esc(k.nama)}</b>`;
      const pilih = host && i !== info.kursiSaya ? pilihanKursi(k, i, !!kompetisi) : '';
      return `<div class="kursi"><span class="redup" aria-label="Kursi ${i + 1}">${i + 1}</span><span class="nama">${nama}</span>${lencana}${pilih}</div>`;
    })
    .join('');

  const q = <T extends HTMLElement>(sel: string) => akar.querySelector(sel) as T | null;
  /** Sesudah digambar ulang: gulir dan fokus dikembalikan, tombol keluar dan pilihan kursi dipasang. */
  const pasangUmum = () => {
    const layarBaru = q('.layar-lobi');
    if (layarBaru && gulirLama !== null) layarBaru.scrollTop = gulirLama;
    if (fokusLama && !sedangDiisi) q(fokusLama)?.focus({ preventScroll: true });
    q('#keluar')!.addEventListener('click', async () => {
      const ya = await konfirmasi(opsiKonfirmasiKeluar({ asal: 'lobi', offline: false, masukPeringkat: false, kompetisi: !!kompetisi }));
      // Selagi dialog terbuka permainan bisa saja mulai (layar sudah jadi meja): teks
      // "selama permainan belum mulai" tidak berlaku lagi, jadi jangan keluar diam-diam.
      if (ya && akar.querySelector('.layar-lobi')) keluar();
    });
    if (!host) return;
    akar.querySelectorAll<HTMLSelectElement>('[data-kursi]').forEach((s) =>
      s.addEventListener('change', () => {
        const i = Number(s.dataset.kursi);
        if (s.value === 'manusia') return;
        if (s.value === 'kosong') return kirim({ t: 'aturKursi', kursi: i, jenis: 'kosong' });
        const level = levelDariPilihan(s.value);
        kirim(level ? { t: 'aturKursi', kursi: i, jenis: 'bot', level } : { t: 'aturKursi', kursi: i, jenis: 'bot' });
      }),
    );
  };

  if (kompetisi) {
    akar.innerHTML = htmlLobiKompetisi(info, barisKursi, kosong);
    pasangUmum();
    jalankanHitungMundur(akar, info);
    return;
  }

  const pilihanBatas = (id: string, nilai: number | null, opsi: number[], label: (n: number) => string) =>
    `<select id="${id}" ${disAturan}>${opsi.map((n) => `<option value="${n}" ${n === (nilai ?? 0) ? 'selected' : ''}>${label(n)}</option>`).join('')}</select>`;
  const kaldu = p.modeKaldu === true;
  // Host: kotak centang + satu baris keterangan. Bukan host: keadaannya sebagai teks (keterangan
  // hanya kalau nyala).
  const htmlKaldu = ubahAturan
    ? `<label class="baris">${esc(TEKS_KALDU.label)}<input type="checkbox" id="kaldu" aria-describedby="ket-kaldu" ${kaldu ? 'checked' : ''} /></label>
       <p class="bantuan rapat" id="ket-kaldu">${esc(TEKS_KALDU.ket)}</p>`
    : `<div class="baris baris-teks"><span>${esc(TEKS_KALDU.label)}</span><b id="kaldu">${esc(kaldu ? TEKS_KALDU.nyala : TEKS_KALDU.mati)}</b></div>
       ${kaldu ? `<p class="bantuan rapat" id="ket-kaldu">${esc(TEKS_KALDU.ket)}</p>` : ''}`;

  akar.innerHTML = `
  <div class="layar layar-lobi"><div class="kolom">
    <div class="judul"><p>Kode meja</p><div class="kode-besar bisa-dipilih" aria-label="Kode meja ${esc(info.kode.split('').join(' '))}">${esc(info.kode)}</div></div>
    <div class="deret"><button type="button" id="salin">Salin link undangan</button>${'share' in navigator ? '<button type="button" id="bagi">Bagikan</button>' : ''}</div>

    <div class="kartu-panel">
      <h2>Kursi (${info.kursi.length - kosong}/${info.kursi.length})</h2>
      ${barisKursi}
      ${host && kosong ? '<button type="button" id="isi-bot" class="kecil">Ajak warga kedai isi kursi kosong</button>' : ''}
    </div>

    <div class="kartu-panel">
      <h2>Pengaturan ${host ? '' : '<span class="redup">(diatur host)</span>'}</h2>
      <label class="baris">Jumlah pemain
        <select id="jumlah" ${dis}>${[2, 3, 4, 5, 6].map((n) => `<option ${n === p.jumlahPemain ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${p.jumlahPemain === 4 ? `<label class="baris">Pakai 2 deck (12 kartu)<input type="checkbox" id="dua" ${p.duaDeckUntukEmpat ? 'checked' : ''} ${disAturan} /></label>` : ''}
      <label class="baris">Batas putaran ${pilihanBatas('putaran', p.batasPutaran, [3, 5, 10, 15, 20, 0], (n) => (n ? String(n) : 'Tanpa batas'))}</label>
      ${htmlKaldu}
      ${kaldu ? '' : htmlIsianBatas({ id: 'skor', nilai: p, bisaUbah: ubahAturan })}
      <label class="baris">Waktu per giliran ${pilihanBatas('detik', p.detikGiliran, [30, 60, 90, 120, 0], (n) => (n ? `${n} detik` : 'Tanpa batas'))}</label>
      <label class="baris">Tempo warga kedai
        <select id="tempo" ${dis}>${(['santai', 'normal', 'cepat'] as const)
          .map((t) => `<option value="${t}" ${t === (p.tempoBot ?? 'santai') ? 'selected' : ''}>${t[0]!.toUpperCase() + t.slice(1)}</option>`)
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
            <button type="button" class="utama besar${kosong ? ' mati' : ''}" id="mulai" ${kosong ? 'aria-disabled="true" aria-describedby="ket-mulai"' : ''}>Mulai main</button>
            ${kosong ? '<p class="redup rapat" id="ket-mulai">Masih ada kursi kosong: tunggu teman masuk atau ajak warga kedai.</p>' : ''}
          </div>`
        : '<div class="kartu-panel"><p class="redup rapat" role="status">Menunggu host memulai permainan…</p></div>'
    }
    <button type="button" id="keluar" class="bahaya">Keluar meja</button>
  </div></div>`;

  pasangUmum();
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
  if (!host) return;
  q('#isi-bot')?.addEventListener('click', () =>
    info.kursi.forEach((k, i) => {
      if (k.jenis === 'kosong') kirim({ t: 'aturKursi', kursi: i, jenis: 'bot' });
    }),
  );
  const ubah = (pengaturan: Partial<PengaturanMeja>) => kirim({ t: 'pengaturan', pengaturan });
  const angka = (id: string) => Number(q<HTMLSelectElement>(id)!.value) || null;
  q('#jumlah')!.addEventListener('change', () => ubah({ jumlahPemain: Number(q<HTMLSelectElement>('#jumlah')!.value) }));
  q('#tempo')!.addEventListener('change', () => ubah({ tempoBot: q<HTMLSelectElement>('#tempo')!.value as PengaturanMeja['tempoBot'] }));
  q('#publik')!.addEventListener('change', () => ubah({ publik: q<HTMLInputElement>('#publik')!.checked }));
  q('#mulai')!.addEventListener('click', () => {
    if (kosong) return toast('Masih ada kursi kosong. Ajak warga kedai atau tunggu orang masuk.', true);
    const v = q<HTMLSelectElement>('#kocok')!.value;
    kirim({ t: 'mulai', pengocok: v === 'acak' ? undefined : Number(v) });
  });
  if (!ubahAturan) return;
  q('#dua')?.addEventListener('change', () => ubah({ duaDeckUntukEmpat: q<HTMLInputElement>('#dua')!.checked }));
  q('#putaran')!.addEventListener('change', () => ubah({ batasPutaran: angka('#putaran') }));
  q('#kaldu')!.addEventListener('change', () => ubah({ modeKaldu: q<HTMLInputElement>('#kaldu')!.checked }));
  // Batas skor dikirim sesudah isian ditinggalkan (change/blur/Enter), bukan di setiap ketikan.
  pasangIsianBatas(akar, 'skor', p, ubah);
  if (sedangDiisi) {
    const el = q<HTMLInputElement>(`#${sedangDiisi.id}`);
    if (el) {
      el.value = sedangDiisi.nilai;
      el.focus({ preventScroll: true });
    }
  }
  q('#detik')!.addEventListener('change', () => ubah({ detikGiliran: Number(q<HTMLSelectElement>('#detik')!.value) }));
}

/** Teks baris status lobi kompetisi (tanpa hitung mundur, atau dengan sisa waktu mulai sendiri). */
export function teksStatusLobiKompetisi(info: Pick<InfoMeja, 'kursi'>, sisaMs: number | null): string {
  if (sisaMs !== null) {
    const detik = Math.ceil(Math.max(0, sisaMs) / 1000);
    return detik > 0 ? `${TEKS_KOMPETISI.lobiPenuh} dalam ${detik} detik…` : `${TEKS_KOMPETISI.lobiPenuh} sekarang…`;
  }
  const kosong = info.kursi.filter((k) => k.jenis === 'kosong').length;
  if (kosong) return teksMenungguPeserta(kosong);
  return TEKS_KOMPETISI.menungguTersambung;
}

/** Lobi meja kompetisi: nama kompetisi (tanpa kode/undangan), kursi, status mulai sendiri, aturan sebagai teks. */
function htmlLobiKompetisi(info: InfoMeja, barisKursi: string, kosong: number): string {
  const p = info.pengaturan;
  const k = info.kompetisi!;
  const baris = (label: string, nilai: string, id: string) =>
    `<div class="baris baris-teks"><span>${esc(label)}</span><b id="${id}">${esc(nilai)}</b></div>`;
  const kaldu = p.modeKaldu === true;
  const sisa = info.mulaiOtomatis ? info.mulaiOtomatis.sisaMs : null;
  return `
  <div class="layar layar-lobi lobi-kompetisi"><div class="kolom">
    <div class="judul"><p>🏅 ${esc(TEKS_KOMPETISI.lencanaMeja)}</p><h1 class="nama-kompetisi">${esc(k.nama)}</h1></div>

    <div class="kartu-panel">
      <h2>Kursi (${info.kursi.length - kosong}/${info.kursi.length})</h2>
      ${barisKursi}
    </div>

    <div class="kartu-panel">
      <p class="rapat status-lobi-kompetisi${sisa !== null ? ' penuh' : ''}" id="status-lobi" role="status">${esc(teksStatusLobiKompetisi(info, sisa))}</p>
      <p class="bantuan rapat">${esc(TEKS_KOMPETISI.ketLobi)}</p>
    </div>

    <div class="kartu-panel">
      <h2>${esc(TEKS_KOMPETISI.judulAturan)}</h2>
      <p class="bantuan rapat">${esc(TEKS_KOMPETISI.aturanDikunci)}</p>
      ${baris('Jumlah pemain', `${p.jumlahPemain} orang`, 'jumlah')}
      ${p.jumlahPemain === 4 ? baris('Pakai 2 deck (12 kartu)', p.duaDeckUntukEmpat ? 'Ya' : 'Tidak', 'dua') : ''}
      ${baris('Batas putaran', p.batasPutaran ? String(p.batasPutaran) : 'Tanpa batas', 'putaran')}
      ${baris(TEKS_KALDU.label, kaldu ? TEKS_KALDU.nyala : TEKS_KALDU.mati, 'kaldu')}
      ${kaldu ? `<p class="bantuan rapat" id="ket-kaldu">${esc(TEKS_KALDU.ket)}</p>` : htmlIsianBatas({ id: 'skor', nilai: p, bisaUbah: false })}
      ${baris('Waktu per giliran', p.detikGiliran ? `${p.detikGiliran} detik` : 'Tanpa batas', 'detik')}
    </div>
    <button type="button" id="keluar" class="bahaya">Keluar meja</button>
  </div></div>`;
}

let timerHitungMundur: ReturnType<typeof setInterval> | null = null;

/**
 * Hitung mundur mulai sendiri di lobi kompetisi (InfoMeja.mulaiOtomatis, relatif terhadap saat
 * diterima). Teksnya diperbarui tiap seperempat detik sampai layar lobi diganti.
 */
function jalankanHitungMundur(akar: HTMLElement, info: InfoMeja): void {
  if (timerHitungMundur !== null) clearInterval(timerHitungMundur);
  timerHitungMundur = null;
  if (!info.mulaiOtomatis) return;
  const akhir = Date.now() + Math.max(0, info.mulaiOtomatis.sisaMs);
  const el = akar.querySelector<HTMLElement>('#status-lobi');
  if (!el) return;
  const t = setInterval(() => {
    if (!el.isConnected) {
      clearInterval(t);
      if (timerHitungMundur === t) timerHitungMundur = null;
      return;
    }
    const teks = teksStatusLobiKompetisi(info, akhir - Date.now());
    if (el.textContent !== teks) el.textContent = teks;
  }, 250);
  timerHitungMundur = t;
}
