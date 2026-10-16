// @vitest-environment happy-dom
// Penyimpanan di HP: pembungkus pengaturanEfek tetap kompatibel lewat preferensi,
// dan akses localStorage tahan data rusak.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pasangLocalStorageRusak, pasangMatchMediaPalsu } from './bantu';

async function muat() {
  vi.resetModules();
  const pref = await import('../src/preferensi');
  const { simpan, catatanDariView, kunciPermainan } = await import('../src/penyimpanan');
  return { ...pref, simpan, catatanDariView, kunciPermainan };
}

beforeEach(() => {
  localStorage.clear();
  pasangMatchMediaPalsu(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pengaturanEfek / setPengaturanEfek (kompatibel lewat preferensi)', () => {
  it('bawaan: suara dan getar nyala', async () => {
    const { simpan } = await muat();
    expect(simpan.pengaturanEfek()).toEqual({ suara: true, getar: true });
  });

  it('simpanan lama remi.efek tetap terbaca', async () => {
    localStorage.setItem('remi.efek', JSON.stringify({ suara: false, getar: true }));
    const { simpan } = await muat();
    expect(simpan.pengaturanEfek()).toEqual({ suara: false, getar: true });
  });

  it('hanya mengembalikan {suara, getar}, bukan seluruh preferensi', async () => {
    const { simpan } = await muat();
    expect(Object.keys(simpan.pengaturanEfek()).sort()).toEqual(['getar', 'suara']);
  });

  it('setPengaturanEfek menulis ke preferensi tanpa mengusik field lain', async () => {
    const { simpan, aturPreferensi, preferensi } = await muat();
    aturPreferensi({ kecepatan: 'cepat', musik: true });
    simpan.setPengaturanEfek({ suara: false, getar: false });
    expect(preferensi()).toMatchObject({ suara: false, getar: false, kecepatan: 'cepat', musik: true });
    expect(JSON.parse(localStorage.getItem('remi.preferensi')!)).toMatchObject({ suara: false, getar: false });
    expect(simpan.pengaturanEfek()).toEqual({ suara: false, getar: false });
  });

  it('setPengaturanEfek mengabari pendengar preferensi (mis. tombol suara di menu)', async () => {
    const { simpan, saatPreferensiBerubah } = await muat();
    const cb = vi.fn();
    saatPreferensiBerubah(cb);
    simpan.setPengaturanEfek({ suara: false, getar: true });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toMatchObject({ suara: false, getar: true });
  });

  it('perubahan lewat aturPreferensi langsung terlihat di pengaturanEfek', async () => {
    const { simpan, aturPreferensi } = await muat();
    aturPreferensi({ getar: false });
    expect(simpan.pengaturanEfek()).toEqual({ suara: true, getar: false });
  });
});

describe('simpan: akses localStorage', () => {
  it('nama: bawaan kosong, lalu tersimpan', async () => {
    const { simpan } = await muat();
    expect(simpan.nama()).toBe('');
    simpan.setNama('Pak Kumis');
    expect(simpan.nama()).toBe('Pak Kumis');
  });

  it('JSON rusak dikembalikan ke bawaan, tidak melempar', async () => {
    localStorage.setItem('remi.riwayat', '[rusak');
    localStorage.setItem('remi.sesiOnline', '{');
    const { simpan } = await muat();
    expect(simpan.riwayat()).toEqual([]);
    expect(simpan.sesi()).toBeNull();
  });

  it('null menghapus kunci (mis. sesi online selesai)', async () => {
    const { simpan } = await muat();
    simpan.setSesi({ kode: 'ABCD', token: 't' });
    expect(simpan.sesi()).toEqual({ kode: 'ABCD', token: 't' });
    simpan.setSesi(null);
    expect(localStorage.getItem('remi.sesiOnline')).toBeNull();
    expect(simpan.sesi()).toBeNull();
  });

  it('riwayat: terbaru di depan, maksimal 30 catatan', async () => {
    const { simpan } = await muat();
    for (let i = 0; i < 35; i++) {
      simpan.tambahRiwayat({ waktu: i, mode: 'offline', klasemen: [{ nama: 'A', skor: i }], putaran: 1 });
    }
    const r = simpan.riwayat();
    expect(r).toHaveLength(30);
    expect(r[0].waktu).toBe(34);
    expect(r[29].waktu).toBe(5);
  });

  it('localStorage melempar error: baca jatuh ke bawaan, tulis diabaikan', async () => {
    const { simpan } = await muat();
    pasangLocalStorageRusak();
    expect(() => simpan.setNama('X')).not.toThrow();
    expect(simpan.nama()).toBe('');
    expect(simpan.urutanTangan()).toEqual([]);
  });
});

describe('simpan: nilai JSON sah tapi bentuknya salah → bawaan + kunci dihapus', () => {
  const RUSAK = ['null', '{}', '"x"', '42', 'true'];

  it.each(RUSAK)('riwayat = %s', async (mentah) => {
    localStorage.setItem('remi.riwayat', mentah);
    const { simpan } = await muat();
    expect(simpan.riwayat()).toEqual([]);
    expect(localStorage.getItem('remi.riwayat')).toBeNull();
  });

  it.each(RUSAK)('urutanTangan = %s', async (mentah) => {
    localStorage.setItem('remi.urutanTangan', mentah);
    const { simpan } = await muat();
    expect(simpan.urutanTangan()).toEqual([]);
    expect(localStorage.getItem('remi.urutanTangan')).toBeNull();
  });

  it.each(['{}', '"x"', '[]', '{"kode":"ABCDE"}', '{"kode":1,"token":"t"}', '{"kode":"","token":"t"}'])('sesi = %s', async (mentah) => {
    localStorage.setItem('remi.sesiOnline', mentah);
    const { simpan } = await muat();
    expect(simpan.sesi()).toBeNull();
    expect(localStorage.getItem('remi.sesiOnline')).toBeNull();
  });

  it('sesi tersimpan sah tetap terbaca, field lebih dibuang', async () => {
    localStorage.setItem('remi.sesiOnline', JSON.stringify({ kode: 'MADYA', token: 't', lain: 1 }));
    const { simpan } = await muat();
    expect(simpan.sesi()).toEqual({ kode: 'MADYA', token: 't' });
  });

  it.each(['null', '"x"', '[1]', '7'])('nama, pengaturanOffline, mejaOffline = %s', async (mentah) => {
    for (const k of ['remi.nama', 'remi.pengaturanOffline']) localStorage.setItem(k, mentah);
    if (mentah !== 'null') localStorage.setItem('remi.mejaOffline', mentah);
    const { simpan } = await muat();
    expect(simpan.nama()).toBe(mentah === '"x"' ? 'x' : '');
    expect(simpan.pengaturanOffline()).toEqual({});
    expect(simpan.mejaOffline()).toBeNull();
  });

  it('urutanTangan: elemen bukan string dibuang', async () => {
    localStorage.setItem('remi.urutanTangan', JSON.stringify(['7-love-0', 3, null, 'K-waru-1']));
    const { simpan } = await muat();
    expect(simpan.urutanTangan()).toEqual(['7-love-0', 'K-waru-1']);
  });

  it('riwayat: entri tanpa klasemen array / baris rusak dibuang, sisanya tetap', async () => {
    const baik = { waktu: 5, mode: 'online', putaran: 3, klasemen: [{ nama: 'A', skor: 10 }, { nama: 'Bot 1', skor: -5, bot: true }] };
    localStorage.setItem(
      'remi.riwayat',
      JSON.stringify([null, 'x', { waktu: 1 }, { klasemen: {} }, { klasemen: [] }, { klasemen: [{ nama: 'A' }] }, baik]),
    );
    const { simpan } = await muat();
    expect(simpan.riwayat()).toEqual([baik]);
    // Menambah catatan baru tetap jalan dan membuang sampahnya.
    simpan.tambahRiwayat({ waktu: 9, mode: 'offline', putaran: 1, klasemen: [{ nama: 'B', skor: 1 }] });
    expect(JSON.parse(localStorage.getItem('remi.riwayat')!)).toHaveLength(2);
  });

  it('riwayat lama tanpa field bot tetap terbaca (bot tidak ditambahkan)', async () => {
    localStorage.setItem('remi.riwayat', JSON.stringify([{ waktu: 1, mode: 'offline', putaran: 2, klasemen: [{ nama: 'Bot 1', skor: 3 }] }]));
    const { simpan } = await muat();
    expect(simpan.riwayat()[0]!.klasemen[0]).toEqual({ nama: 'Bot 1', skor: 3 });
  });
});

describe('riwayat online: permainan yang sama hanya dicatat sekali', () => {
  const view = (skor: number[], cara: ('mentung' | 'deckHabis')[] = ['mentung', 'deckHabis']) => ({
    pemain: skor.map((_, i) => ({ nama: i === 0 ? 'Saya' : `Bot ${i}` })),
    skor,
    riwayat: cara.map((c, i) => ({ cara: c, pementung: c === 'mentung' ? 1 : null, pengocok: i })) as never,
  });

  it('catatanDariView: urut skor, kursi bukan manusia ditandai bot', async () => {
    const { catatanDariView } = await import('../src/penyimpanan');
    const c = catatanDariView(view([10, 40, -5]), 'online', [{ jenis: 'manusia' }, { jenis: 'bot' }, { jenis: 'manusia' }], 123);
    expect(c).toEqual({
      waktu: 123,
      mode: 'online',
      putaran: 2,
      klasemen: [
        { nama: 'Bot 1', skor: 40, bot: true },
        { nama: 'Saya', skor: 10 },
        { nama: 'Bot 2', skor: -5 },
      ],
    });
    // Tanpa info kursi: tidak ada yang ditandai bot.
    expect(catatanDariView(view([1, 2]), 'offline', null, 1).klasemen.some((k) => 'bot' in k)).toBe(false);
  });

  it('kunci sama (reload / PWA dibuka lagi) → tidak dicatat ulang; permainan lain → dicatat', async () => {
    const { simpan, catatanDariView, kunciPermainan } = await muat();
    const v = view([10, 40]);
    const kunci = kunciPermainan('MADYA', v);
    expect(simpan.tambahRiwayat(catatanDariView(v, 'online', null, 1), kunci)).toBe(true);
    // "Reload": modul dimuat ulang, penandanya tetap di localStorage.
    const lagi = await muat();
    expect(lagi.simpan.tambahRiwayat(lagi.catatanDariView(v, 'online', null, 2), kunci)).toBe(false);
    expect(lagi.simpan.tambahRiwayat(lagi.catatanDariView(v, 'online', null, 3), kunci)).toBe(false);
    expect(lagi.simpan.riwayat()).toHaveLength(1);
    // Meja sama main lagi dengan hasil berbeda: kunci berbeda.
    const v2 = view([10, 40], ['deckHabis', 'mentung']);
    expect(kunciPermainan('MADYA', v2)).not.toBe(kunci);
    expect(kunciPermainan('LAINN', v)).not.toBe(kunci);
    expect(lagi.simpan.tambahRiwayat(lagi.catatanDariView(v2, 'online', null, 4), kunciPermainan('MADYA', v2))).toBe(true);
    expect(lagi.simpan.riwayat()).toHaveLength(2);
  });

  it('penanda dibatasi 20 terakhir; tanpa kunci selalu dicatat', async () => {
    const { simpan } = await muat();
    const c = { waktu: 1, mode: 'online' as const, putaran: 1, klasemen: [{ nama: 'A', skor: 1 }] };
    for (let i = 0; i < 25; i++) simpan.tambahRiwayat(c, `K${i}`);
    expect(JSON.parse(localStorage.getItem('remi.riwayatTercatat')!)).toHaveLength(20);
    expect(simpan.tambahRiwayat(c, 'K24')).toBe(false);
    expect(simpan.tambahRiwayat(c)).toBe(true);
    expect(simpan.tambahRiwayat(c)).toBe(true);
  });

  it('kunci tidak memuat angka joker (info rahasia)', async () => {
    const { kunciPermainan } = await import('../src/penyimpanan');
    const v = { skor: [1], riwayat: [{ cara: 'mentung', pementung: 0, pengocok: 0, rankJoker: 7 }] as never };
    expect(kunciPermainan('MADYA', v)).not.toMatch(/7/);
  });
});

describe('tawaranPasang (remi.tawaranPasang, keputusan #46)', () => {
  it('bawaan {}; tersimpan sah tetap terbaca; objek kosong menghapus kunci', async () => {
    const { simpan } = await muat();
    expect(simpan.tawaranPasang()).toEqual({});
    simpan.setTawaranPasang({ tundaSampai: 1000, sudahPasang: 2000 });
    expect(JSON.parse(localStorage.getItem('remi.tawaranPasang')!)).toEqual({ tundaSampai: 1000, sudahPasang: 2000 });
    expect(simpan.tawaranPasang()).toEqual({ tundaSampai: 1000, sudahPasang: 2000 });
    simpan.setTawaranPasang({});
    expect(localStorage.getItem('remi.tawaranPasang')).toBeNull();
  });

  it('hanya angka terhingga positif yang dipakai; field lain dibuang', async () => {
    localStorage.setItem('remi.tawaranPasang', JSON.stringify({ tundaSampai: -5, sudahPasang: 'kemarin', lain: 1 }));
    const { simpan } = await muat();
    expect(simpan.tawaranPasang()).toEqual({});
    localStorage.setItem('remi.tawaranPasang', JSON.stringify({ tundaSampai: 0, sudahPasang: 1e12 }));
    expect(simpan.tawaranPasang()).toEqual({ sudahPasang: 1e12 });
    // Tulis juga dirapikan (NaN/Infinity tidak pernah tersimpan).
    simpan.setTawaranPasang({ tundaSampai: Number.POSITIVE_INFINITY, sudahPasang: Number.NaN });
    expect(localStorage.getItem('remi.tawaranPasang')).toBeNull();
  });

  it('bukan objek atau JSON rusak → {} dan kuncinya dihapus', async () => {
    const { simpan } = await muat();
    for (const mentah of ['[1,2]', '"x"', '42', 'null', '{rusak']) {
      localStorage.setItem('remi.tawaranPasang', mentah);
      expect(simpan.tawaranPasang(), mentah).toEqual({});
      expect(localStorage.getItem('remi.tawaranPasang'), mentah).toBeNull();
    }
  });

  it('localStorage melempar error: baca {} dan tulis diabaikan', async () => {
    pasangLocalStorageRusak();
    const { simpan } = await muat();
    expect(simpan.tawaranPasang()).toEqual({});
    expect(() => simpan.setTawaranPasang({ tundaSampai: 1 })).not.toThrow();
  });
});
