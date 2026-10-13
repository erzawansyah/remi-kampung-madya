// @vitest-environment happy-dom
// Pusat Bantuan: pencarian, sorotan aman, navigasi bab, dan contoh kartu.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BAB_BANTUAN, FAQ } from '../src/konten/bantuan';
import { TENGGANG_SAMBUNG_MS } from '@remi/meja';
import { bukaBantuan, cariBantuan, cuplikan } from '../src/ui/bantuan';
import { tutupDialogTeratas } from '../src/ui/dom';

describe('cuplikan', () => {
  it('menyorot kata dengan <mark> dan meng-escape sisanya', () => {
    const el = document.createElement('div');
    el.innerHTML = cuplikan('Kartu <b>As</b> & mulung itu seru', 'mulung');
    expect(el.querySelector('mark')!.textContent).toBe('mulung');
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toBe('Kartu <b>As</b> & mulung itu seru');
  });

  it('tanpa beda huruf besar/kecil, dan memotong teks panjang', () => {
    const panjang = `${'a'.repeat(100)} MENTUNG ${'b'.repeat(100)}`;
    const el = document.createElement('div');
    el.innerHTML = cuplikan(panjang, 'mentung', 10);
    expect(el.querySelector('mark')!.textContent).toBe('MENTUNG');
    expect(el.textContent!.startsWith('…')).toBe(true);
    expect(el.textContent!.endsWith('…')).toBe(true);
  });
});

describe('cariBantuan', () => {
  it('menemukan bab, tanya jawab, dan istilah', () => {
    const h = cariBantuan('kepentung');
    expect(h.bab.some((b) => b.id === 'mentung')).toBe(true);
    expect(h.istilah.some((g) => g.istilah === 'Kepentung')).toBe(true);
  });

  it('kata yang tidak ada: kosong', () => {
    const h = cariBantuan('zzzqqq');
    expect(h.bab.length + h.faq.length + h.istilah.length).toBe(0);
  });
});

describe('bukaBantuan', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ui"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div>';
  });
  afterEach(() => {
    while (tutupDialogTeratas());
  });

  it('dibuka di lapisan dialog (tidak menimpa modal utama) dengan daftar semua bab', () => {
    document.getElementById('modal')!.innerHTML = '<div class="latar"><div class="dialog" data-joker></div></div>';
    bukaBantuan();
    expect(document.querySelector('#modal [data-joker]')).not.toBeNull();
    const d = document.querySelector('#lapisan-dialog .dialog.bantuan')!;
    expect(d).not.toBeNull();
    expect(d.querySelectorAll('.bantuan-nav [data-bab]')).toHaveLength(BAB_BANTUAN.length + 2);
    expect(d.querySelector('.bantuan-tata')!.getAttribute('data-mode')).toBe('daftar');
  });

  it('deep link ke bab: isi bab tampil, item nav ditandai, contoh punya label kartu', () => {
    bukaBantuan('joker');
    const d = document.querySelector('.dialog.bantuan')!;
    expect(d.querySelector('.bantuan-tata')!.getAttribute('data-mode')).toBe('isi');
    expect(d.querySelector('.judul-bab')!.textContent).toContain('Joker');
    expect(d.querySelector('[data-bab=joker][aria-current=page]')).not.toBeNull();
    const contoh = d.querySelector('.contoh-kartu[role=img]')!;
    expect(contoh.getAttribute('aria-label')).toMatch(/^Kartu: /);
    expect(d.querySelectorAll('.contoh .lencana').length).toBeGreaterThan(0);
  });

  it('dibuka lagi saat sudah terbuka: pindah bab, tidak menumpuk dua jendela', () => {
    bukaBantuan('mulai');
    bukaBantuan('skor');
    expect(document.querySelectorAll('.dialog.bantuan')).toHaveLength(1);
    expect(document.querySelector('.judul-bab')!.textContent).toContain('Skor');
  });

  it('paragraf hanya mengenal **tebal**; tidak ada HTML dari konten', () => {
    bukaBantuan('mulai');
    const badan = document.querySelector('.badan-bab')!;
    expect(badan.querySelector('strong')).not.toBeNull();
    expect(badan.innerHTML).not.toContain('**');
  });
});

describe('konten: status keputusan pemilik dan isi menu', () => {
  const CATATAN_MENUNGGU = 'masih menunggu konfirmasi pemilik aturan';
  const semuaTeks = () => JSON.stringify(BAB_BANTUAN);

  // Keputusan pemilik 13 Okt 2026 (#7): keduanya sudah diputuskan, jadi ditulis tegas tanpa catatan menunggu.
  it('FAQ tangan 1 kartu: tegas tidak bisa mulung maupun mentung, tanpa catatan menunggu', () => {
    const f = FAQ.find((x) => x.tanya.includes('tinggal 1 kartu'))!;
    expect(f.jawab).not.toContain(CATATAN_MENUNGGU);
    expect(f.jawab).toContain('tidak bisa mentung');
  });

  it('nilai joker mati di tangan dan sebagai pentungan: kartu aslinya, tanpa catatan menunggu', () => {
    const catatan = BAB_BANTUAN.flatMap((b) => b.isi).find(
      (x) => x.t === 'catatan' && x.teks.includes('pernah dibuang'),
    ) as { teks: string };
    expect(catatan.teks).toContain('pentungan, nilainya kartu aslinya');
    expect(catatan.teks).toContain('masih di tangan saat putaran selesai, nilainya juga kartu aslinya');
    expect(catatan.teks).not.toContain(CATATAN_MENUNGGU);
  });

  it('sambung ulang: masa tenggang sama dengan meja, popup joker muncul lagi, meja menunggu kalau semua terputus', () => {
    const teks = JSON.stringify([BAB_BANTUAN, FAQ]);
    expect(teks).toContain(`ditunggu ${TENGGANG_SAMBUNG_MS / 1000} detik`);
    // Tenggang dihitung sejak terputus, bukan sejak giliran tiba (meja.ts: putusSejak + tenggang).
    const faq = FAQ.find((f) => f.tanya.startsWith('Internetku putus'))!;
    expect(faq.jawab).toContain(`ditunggu ${TENGGANG_SAMBUNG_MS / 1000} detik, dihitung sejak kamu terputus`);
    expect(faq.jawab).not.toContain('giliranmu tiba saat kamu terputus');
    expect(teks).toContain('popup joker muncul lagi');
    expect(teks).toContain('Waktu giliran diberi penuh lagi');
    // Keputusan #5: joker di kartu jadi diberi label dan tercatat di log; teks lama "tidak ditampilkan lagi" dibuang.
    expect(teks).not.toContain('sesudah itu tidak ditampilkan lagi');
    expect(teks).toContain('label angka yang diwakilinya');
  });

  it("isi menu ☰ sesuai menu meja (bukan 'aturan singkat')", () => {
    expect(semuaTeks()).not.toContain('aturan singkat');
    const butir = BAB_BANTUAN.flatMap((b) => b.isi).flatMap((x) => (x.t === 'daftar' ? x.butir : []));
    const menu = butir.find((t) => t.includes('Menu ☰'))!;
    for (const isi of ['Pengaturan', 'Bantuan & aturan', 'pintasan keyboard', 'Layar penuh', 'Tentang', 'keluar']) expect(menu).toContain(isi);
  });
});
