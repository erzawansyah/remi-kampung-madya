// Usul fitur (keputusan pemilik 24 Okt 2026): perapian teks bebas beberapa baris dan pemeriksaan
// isian usulan, dipakai bersama server (POST /api/usulan) dan dialog Usul fitur di HP.

import { describe, expect, it } from 'vitest';
import {
  DAFTAR_JENIS_USULAN,
  MAKS_ISI_USULAN,
  MAKS_JUDUL_USULAN,
  PESAN_USULAN,
  jumlahHuruf,
  periksaUsulan,
  rapikanTeks,
} from '../src/index.js';

describe('rapikanTeks', () => {
  it('satu baris: dirapikan seperti pesan meja, tidak dipotong', () => {
    expect(rapikanTeks('  Mode   turnamen  ')).toBe('Mode turnamen');
    expect(rapikanTeks('a\nb\tc')).toBe('a b c');
    expect(rapikanTeks('Bu​di‮<b>')).toBe('Budib');
    expect(rapikanTeks('x'.repeat(500))).toHaveLength(500);
    expect(rapikanTeks('   ​ ')).toBeNull();
  });

  it('beberapa baris: "\\n" dipertahankan, baris kosong berturut-turut dirapatkan, kontrol dibuang', () => {
    expect(rapikanTeks('\n\nBaris satu\r\n\r\n\r\nBaris  dua\rBaris tiga\n\n', { barisBaru: true })).toBe('Baris satu\n\nBaris dua\nBaris tiga');
    expect(rapikanTeks('a\u0000b\u0007\nc‮d', { barisBaru: true })).toBe('ab\ncd');
    expect(rapikanTeks('\n \n\t\n', { barisBaru: true })).toBeNull();
  });

  it('teks "zalgo" dibatasi tanda gabungnya; emoji gabungan utuh', () => {
    const zalgo = `a${'́'.repeat(40)}`;
    expect(Array.from(rapikanTeks(zalgo)!)).toHaveLength(1 + 8);
    expect(rapikanTeks('Keluarga 👨‍👩‍👧 main')).toBe('Keluarga 👨‍👩‍👧 main');
  });
});

describe('jumlahHuruf', () => {
  it('menghitung huruf yang tampil, bukan unit kode', () => {
    expect(jumlahHuruf('Budi')).toBe(4);
    expect(jumlahHuruf('😀😀')).toBe(2);
    expect(jumlahHuruf('👨‍👩‍👧')).toBe(1);
    expect(jumlahHuruf('a\nb')).toBe(3);
  });
});

describe('periksaUsulan', () => {
  const sah = { nama: 'Ani', judul: 'Mode turnamen', isi: 'Bisa ada turnamen antar meja?' };

  it('usulan sah dirapikan; jenis boleh kosong', () => {
    expect(periksaUsulan({ ...sah, nama: '  Ani  ', judul: ' Mode  turnamen ', isi: 'Bisa?\n\n\nBiar seru tiap Jumat.', jenis: 'Fitur' })).toEqual({
      ok: true,
      usulan: { nama: 'Ani', judul: 'Mode turnamen', isi: 'Bisa?\n\nBiar seru tiap Jumat.', jenis: 'Fitur' },
    });
    for (const jenis of [undefined, null, '']) expect(periksaUsulan({ ...sah, jenis })).toMatchObject({ ok: true, usulan: { jenis: null } });
    for (const jenis of DAFTAR_JENIS_USULAN) expect(periksaUsulan({ ...sah, jenis })).toMatchObject({ ok: true, usulan: { jenis } });
  });

  it('nama wajib ada (dari beranda)', () => {
    for (const nama of [undefined, '', '   ', 5]) expect(periksaUsulan({ ...sah, nama })).toEqual({ ok: false, isian: 'nama', pesan: PESAN_USULAN.namaKosong });
    // Nama dirapikan seperti di meja (maksimal 16 huruf).
    expect(periksaUsulan({ ...sah, nama: 'Nama yang panjang sekali banget' })).toMatchObject({ ok: true, usulan: { nama: 'Nama yang panjan' } });
  });

  it('panjang judul 3–80 dan isi 10–1000 huruf, dihitung sesudah dirapikan', () => {
    expect(periksaUsulan({ ...sah, judul: ' a  b ' })).toMatchObject({ ok: true, usulan: { judul: 'a b' } });
    expect(periksaUsulan({ ...sah, judul: 'ab' })).toMatchObject({ ok: false, isian: 'judul', pesan: PESAN_USULAN.judulPendek });
    expect(periksaUsulan({ ...sah, judul: '​​​ab' })).toMatchObject({ ok: false, isian: 'judul' });
    expect(periksaUsulan({ ...sah, judul: 'x'.repeat(MAKS_JUDUL_USULAN) })).toMatchObject({ ok: true });
    expect(periksaUsulan({ ...sah, judul: 'x'.repeat(MAKS_JUDUL_USULAN + 1) })).toMatchObject({ ok: false, isian: 'judul', pesan: PESAN_USULAN.judulPanjang });
    expect(periksaUsulan({ ...sah, judul: 'x'.repeat(10_000) })).toMatchObject({ ok: false, pesan: PESAN_USULAN.judulPanjang });
    expect(periksaUsulan({ ...sah, isi: 'terlalu' })).toMatchObject({ ok: false, isian: 'isi', pesan: PESAN_USULAN.isiPendek });
    expect(periksaUsulan({ ...sah, isi: 'x'.repeat(MAKS_ISI_USULAN) })).toMatchObject({ ok: true });
    expect(periksaUsulan({ ...sah, isi: 'x'.repeat(MAKS_ISI_USULAN + 1) })).toMatchObject({ ok: false, isian: 'isi', pesan: PESAN_USULAN.isiPanjang });
    // Emoji dihitung satu huruf: 1000 emoji masih boleh.
    expect(periksaUsulan({ ...sah, isi: '😀'.repeat(MAKS_ISI_USULAN) })).toMatchObject({ ok: true });
    expect(periksaUsulan({ ...sah, judul: 123 })).toMatchObject({ ok: false, isian: 'judul' });
    expect(periksaUsulan(null)).toMatchObject({ ok: false, isian: 'nama' });
  });

  it('jenis di luar daftar ditolak', () => {
    expect(periksaUsulan({ ...sah, jenis: 'Gosip' })).toEqual({ ok: false, isian: 'jenis', pesan: PESAN_USULAN.jenisAsing });
    expect(periksaUsulan({ ...sah, jenis: 'fitur' })).toMatchObject({ ok: false, isian: 'jenis' });
  });
});
