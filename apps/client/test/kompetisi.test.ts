// @vitest-environment happy-dom
// Layar Kompetisi dan lobi meja kompetisi (keputusan pemilik #51): daftar, detail dengan tiket,
// Ikut serta (tiket tersimpan di HP), Buat meja kompetisi, pengajuan, tiket di penyimpanan, lobi
// tanpa warga kedai dengan aturan terkunci, dan teks konfirmasi keluar.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Meja,
  PENGATURAN_KOMPETISI_BAWAAN,
  type BarisKompetisi,
  type InfoMeja,
  type PesanServer,
} from '@remi/meja';
import { simpan } from '../src/penyimpanan';
import { tutupSemuaJendela } from '../src/ui/dom';
import { htmlKlasemen, renderKompetisi } from '../src/ui/kompetisi';
import { opsiKonfirmasiKeluar, renderLobi } from '../src/ui/lobi';
import { TEKS_KOMPETISI } from '../src/konten/kompetisi';

const akar = () => document.getElementById('ui')!;
const tunggu = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

interface Panggilan {
  url: string;
  init?: RequestInit;
}

/** fetch palsu: jawaban per "METODE url". */
function pasangFetch(jawab: (url: string, init?: RequestInit) => unknown): Panggilan[] {
  const panggil: Panggilan[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      panggil.push({ url, init });
      const isi = jawab(url, init);
      if (isi instanceof Error) throw isi;
      const [status, data] = Array.isArray(isi) ? isi : [200, isi];
      return { ok: status < 400, status, json: async () => data } as Response;
    }),
  );
  return panggil;
}

const ringkas = (kode: string, status: string, extra: Record<string, unknown> = {}) => ({
  kode,
  nama: `Kompetisi ${kode}`,
  masa: 'minggu',
  status,
  jumlahPeserta: 4,
  diajukanPada: Date.UTC(2026, 9, 20),
  mulaiPada: status === 'pengajuan' ? null : Date.UTC(2026, 9, 20, 1),
  berakhirPada: status === 'pengajuan' ? null : Date.UTC(2026, 9, 27, 1),
  ...extra,
});

const baris = (nama: string, main: number, poin: number): BarisKompetisi => ({
  id: nama.length,
  nama,
  main,
  poin,
  juara: 0,
  keluar: 0,
  rataPoin: main ? poin / main : 0,
  rataSkor: 0,
});

const detail = (status: string, extra: Record<string, unknown> = {}) => ({
  v: 1,
  ...ringkas('KOMPA', status),
  pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 5 },
  minPeserta: 4,
  minMain: 3,
  peserta: ['Ani', 'Budi', 'Cici', 'Dodi'],
  jumlahPermainan: 2,
  setujuTutup: 1,
  peringkat: [baris('Ani', 3, 7)],
  belumCukup: [baris('Budi', 1, 2)],
  ...extra,
});

beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
  localStorage.clear();
  simpan.setNama('Budi');
});
afterEach(() => {
  tutupSemuaJendela();
  vi.unstubAllGlobals();
});

describe('tiket kompetisi di HP', () => {
  it('tiket terbaru di depan, kode sama diganti, data rusak dibuang', () => {
    simpan.tambahTiketKompetisi({ kode: 'AAAAA', token: 't1', nama: 'Budi' });
    simpan.tambahTiketKompetisi({ kode: 'BBBBB', token: 't2', nama: 'Budi' });
    simpan.tambahTiketKompetisi({ kode: 'AAAAA', token: 't3', nama: 'Budi' });
    expect(simpan.tiketKompetisi().map((t) => [t.kode, t.token])).toEqual([
      ['AAAAA', 't3'],
      ['BBBBB', 't2'],
    ]);
    localStorage.setItem('remi.tiketKompetisi', JSON.stringify([{ kode: 'CCCCC', token: 'x' }, { kode: 5 }, 'rusak']));
    expect(simpan.tiketKompetisi()).toEqual([{ kode: 'CCCCC', token: 'x', nama: '' }]);
    localStorage.setItem('remi.tiketKompetisi', '{"bukan":"daftar"}');
    expect(simpan.tiketKompetisi()).toEqual([]);
  });

  it('paling banyak 20 tiket', () => {
    for (let i = 0; i < 25; i++) simpan.tambahTiketKompetisi({ kode: `K${String(i).padStart(4, '0')}`, token: `t${i}`, nama: 'Budi' });
    expect(simpan.tiketKompetisi()).toHaveLength(20);
    expect(simpan.tiketKompetisi()[0]!.token).toBe('t24');
  });
});

describe('layar Kompetisi', () => {
  it('daftar dibagi per status, kompetisi yang kuikuti ditandai, juara tampil', async () => {
    simpan.tambahTiketKompetisi({ kode: 'JALAN', token: 'tok', nama: 'Budi' });
    pasangFetch(() => ({
      v: 1,
      kompetisi: [ringkas('AJUKN', 'pengajuan'), ringkas('JALAN', 'berjalan'), ringkas('LAMAA', 'selesai', { juara: ['Ani'] })],
    }));
    renderKompetisi(akar(), { kembali: vi.fn(), buatMeja: vi.fn() });
    await tunggu();
    const judul = [...akar().querySelectorAll('#isi-daftar h2')].map((h) => h.textContent);
    expect(judul).toEqual([TEKS_KOMPETISI.bagianBerjalan, TEKS_KOMPETISI.bagianPengajuan, TEKS_KOMPETISI.bagianSelesai]);
    const jalan = akar().querySelector('[data-kode="JALAN"]')!;
    expect(jalan.textContent).toContain(TEKS_KOMPETISI.lencanaIkut);
    expect(akar().querySelector('[data-kode="AJUKN"]')!.textContent).not.toContain(TEKS_KOMPETISI.lencanaIkut);
    expect(akar().querySelector('[data-kode="LAMAA"]')!.textContent).toContain('Juara: Ani');
  });

  it('detail: tanpa tiket ada Ikut serta; sesudah ikut, tiket tersimpan dan Buat meja memakai tokennya', async () => {
    let sudahIkut = false;
    const panggil = pasangFetch((url, init) => {
      if (init?.method === 'POST') {
        sudahIkut = true;
        return { token: 'tiket-baru', detail: detail('berjalan', { saya: { id: 2, nama: 'Budi', setujuTutup: false } }) };
      }
      return detail('berjalan', sudahIkut ? { saya: { id: 2, nama: 'Budi', setujuTutup: false } } : {});
    });
    const buatMeja = vi.fn();
    renderKompetisi(akar(), { kembali: vi.fn(), buatMeja }, 'KOMPA');
    await tunggu();
    expect(panggil[0]!.url).toBe('/api/kompetisi/KOMPA');
    expect(akar().querySelector('#buat-meja')).toBeNull();
    // Klasemen: total poin di kanan, yang belum cukup main di bagian terpisah.
    expect(akar().querySelector('.baris-peringkat .total')!.textContent).toBe('7');
    expect(akar().textContent).toContain(TEKS_KOMPETISI.judulBelumCukup);

    akar().querySelector<HTMLButtonElement>('#ikut')!.click();
    await tunggu();
    const post = panggil.find((p) => p.init?.method === 'POST')!;
    expect(post.url).toBe('/api/kompetisi/KOMPA/ikut');
    expect(JSON.parse(String(post.init!.body))).toEqual({ nama: 'Budi' });
    expect(simpan.tiketKompetisi()).toEqual([{ kode: 'KOMPA', token: 'tiket-baru', nama: 'Budi' }]);
    expect(akar().querySelector('#ikut')).toBeNull();
    akar().querySelector<HTMLButtonElement>('#buat-meja')!.click();
    await tunggu();
    expect(buatMeja).toHaveBeenCalledWith('KOMPA', 'tiket-baru');
  });

  it('detail dengan tiket: tiket dikirim lewat header, tombol sudahi mengirim voting', async () => {
    simpan.tambahTiketKompetisi({ kode: 'KOMPA', token: 'tok', nama: 'Budi' });
    const panggil = pasangFetch((url, init) =>
      init?.method === 'POST'
        ? { detail: detail('berjalan', { setujuTutup: 2, saya: { id: 2, nama: 'Budi', setujuTutup: true } }) }
        : detail('berjalan', { saya: { id: 2, nama: 'Budi', setujuTutup: false } }),
    );
    renderKompetisi(akar(), { kembali: vi.fn(), buatMeja: vi.fn() }, 'KOMPA');
    await tunggu();
    expect((panggil[0]!.init!.headers as Record<string, string>)['x-tiket-kompetisi']).toBe('tok');
    expect(akar().textContent).toContain('1 dari 4 setuju (butuh 3)');
    akar().querySelector<HTMLButtonElement>('#sudahi')!.click();
    await tunggu();
    const post = panggil.find((p) => p.init?.method === 'POST')!;
    expect(post.url).toBe('/api/kompetisi/KOMPA/tutup');
    expect(JSON.parse(String(post.init!.body))).toEqual({ token: 'tok', setuju: true });
    expect(akar().querySelector('#sudahi')!.getAttribute('aria-pressed')).toBe('true');
    expect(akar().textContent).toContain('2 dari 4 setuju');
  });

  it('pengajuan selesai tidak menawarkan Ikut serta; galat server ditampilkan apa adanya', async () => {
    pasangFetch(() => detail('selesai', { juara: ['Ani'] }));
    renderKompetisi(akar(), { kembali: vi.fn(), buatMeja: vi.fn() }, 'KOMPA');
    await tunggu();
    expect(akar().querySelector('#ikut')).toBeNull();
    expect(akar().textContent).toContain('Juara: Ani');

    pasangFetch(() => [404, { error: 'Kompetisinya nggak ketemu.' }]);
    renderKompetisi(akar(), { kembali: vi.fn(), buatMeja: vi.fn() }, 'ZZZZZ');
    await tunggu();
    expect(akar().textContent).toContain('Kompetisinya nggak ketemu.');
    expect(akar().querySelector('[data-coba]')).not.toBeNull();
  });

  it('ajukan: aturan dikirim, mode kaldu menyembunyikan dan mengosongkan batas skor, tiket pengaju tersimpan', async () => {
    const panggil = pasangFetch((url, init) => {
      if (init?.method === 'POST') return { kode: 'BARUU', token: 'tok-aju', detail: detail('pengajuan', { saya: { id: 1, nama: 'Budi', setujuTutup: false } }) };
      if (url === '/api/kompetisi') return { v: 1, kompetisi: [] };
      return detail('pengajuan', { saya: { id: 1, nama: 'Budi', setujuTutup: false } });
    });
    renderKompetisi(akar(), { kembali: vi.fn(), buatMeja: vi.fn() });
    await tunggu();
    expect(akar().textContent).toContain(TEKS_KOMPETISI.kosong);
    akar().querySelector<HTMLButtonElement>('#ajukan')!.click();
    const q = <E extends HTMLElement>(s: string) => akar().querySelector<E>(s)!;
    q<HTMLInputElement>('#k-nama').value = 'Remi Jumat';
    q<HTMLSelectElement>('#k-masa').value = 'bulan';
    q<HTMLInputElement>('#k-skor-atas').value = '300';
    const kaldu = q<HTMLInputElement>('#k-kaldu');
    kaldu.checked = true;
    kaldu.dispatchEvent(new Event('change'));
    expect(q('.isian-batas-skor').classList.contains('tersembunyi')).toBe(true);
    q<HTMLFormElement>('#form-ajukan').dispatchEvent(new Event('submit', { cancelable: true }));
    await tunggu();
    const post = panggil.find((p) => p.init?.method === 'POST')!;
    expect(post.url).toBe('/api/kompetisi');
    expect(JSON.parse(String(post.init!.body))).toEqual({
      nama: 'Remi Jumat',
      masa: 'bulan',
      namaPengaju: 'Budi',
      pengaturan: { batasPutaran: 5, duaDeckUntukEmpat: false, modeKaldu: true, detikGiliran: 60, batasSkorAtas: null, batasSkorBawah: null },
    });
    expect(simpan.tiketKompetisi()[0]).toEqual({ kode: 'BARUU', token: 'tok-aju', nama: 'Budi' });
  });

  it('klasemen kosong: pesan belum ada permainan', () => {
    expect(htmlKlasemen({ peringkat: [], belumCukup: [baris('Ani', 0, 0)] })).toContain(TEKS_KOMPETISI.klasemenKosong);
  });
});

describe('lobi meja kompetisi', () => {
  function infoLobi(): InfoMeja {
    let info: InfoMeja | null = null;
    const meja = Meja.buat(
      {
        kode: 'MEJAA',
        penjadwal: { setel: () => 0, batal: () => undefined, sekarang: () => 0 },
        kirim: (_: string, p: PesanServer) => {
          if (p.t === 'meja') info = p.info;
        },
      },
      'host',
      'Ani',
      { jumlahPemain: 3 },
      { kode: 'KOMPA', nama: 'Remi Jumat', pengaturan: { ...PENGATURAN_KOMPETISI_BAWAAN, batasPutaran: 5 }, peserta: 1 },
    );
    meja.hentikan();
    return info!;
  }

  it('host: nama kompetisi tampil, tanpa pilihan warga kedai, aturan terkunci, jumlah pemain tetap bisa', () => {
    renderLobi(akar(), infoLobi(), vi.fn(), vi.fn());
    expect(akar().querySelector('.lencana-kompetisi')!.textContent).toContain('Remi Jumat');
    expect(akar().querySelector('#isi-bot')).toBeNull();
    for (const s of akar().querySelectorAll<HTMLSelectElement>('[data-kursi]')) {
      expect([...s.options].map((o) => o.value)).toEqual(['kosong']);
    }
    expect(akar().querySelector<HTMLSelectElement>('#putaran')!.disabled).toBe(true);
    expect(akar().querySelector<HTMLSelectElement>('#detik')!.disabled).toBe(true);
    expect(akar().querySelector<HTMLInputElement>('input#kaldu')).toBeNull();
    expect(akar().querySelector('input[data-batas-skor]')).toBeNull();
    expect(akar().querySelector<HTMLSelectElement>('#jumlah')!.disabled).toBe(false);
    expect(akar().querySelector('#ket-mulai')!.textContent).toBe(TEKS_KOMPETISI.kursiKosong);
  });

  it('konfirmasi keluar di tengah permainan menyebut 0 poin', () => {
    const o = opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: true, kompetisi: true });
    expect(o.pesan).toContain(TEKS_KOMPETISI.keluarMeja);
    expect(opsiKonfirmasiKeluar({ asal: 'meja', offline: false, masukPeringkat: true }).pesan).not.toContain(TEKS_KOMPETISI.keluarMeja);
  });
});
