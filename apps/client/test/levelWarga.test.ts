// @vitest-environment happy-dom
// Level warga kedai di client: pilihan Atur meja + ringkasan di beranda, pilihan kursi + lencana di
// lobi, dan level dari simpanan (pengaturan offline, meja offline) yang rusak/tidak dikenal jatuh
// ke 'normal' tanpa membuang simpanannya.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(globalThis, { __VERSI_APP__: '0.0.0', __BUILD_SHA__: 'dev', __BUILD_WAKTU__: '2026-10-12T00:00:00.000Z' });
});

import { DAFTAR_LEVEL_BOT, type LevelBot } from '@remi/engine';
import { Meja, type InfoMeja, type PesanKlien, type PesanServer } from '@remi/meja';
import { BAB_BANTUAN } from '../src/konten/bantuan';
import { DAFTAR_LEVEL_WARGA, infoLevel, labelLevelKecil, LEVEL_WARGA } from '../src/konten/levelWarga';
import { KoneksiOffline } from '../src/koneksi';
import { simpan } from '../src/penyimpanan';
import { _setelUlangCache } from '../src/preferensi';
import { renderBeranda, type AksiBeranda } from '../src/ui/beranda';
import { tutupDialogTeratas } from '../src/ui/dom';
import { levelDariPilihan, renderLobi } from '../src/ui/lobi';
import { pasangMatchMediaPalsu } from './bantu';

const aksiPalsu = (): AksiBeranda => ({
  buatMeja: vi.fn(),
  gabung: vi.fn(),
  lihatPublik: vi.fn(),
  lihatRiwayat: vi.fn(),
  mainOffline: vi.fn(),
  lanjutOffline: vi.fn(),
  latihan: vi.fn(),
  bantuan: vi.fn(),
  pengaturan: vi.fn(),
  tentang: vi.fn(),
  pasangAplikasi: null,
  muatUlang: null,
});

const tunggu = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const akar = () => document.getElementById('ui')!;
/**
 * Pilihan yang ditandai `selected` di markup. Sengaja tidak memakai select.value/selectedIndex
 * maupun option.defaultSelected: happy-dom (versi sekarang) meleset satu opsi ke atas untuk
 * atribut selected yang bukan di opsi pertama, dan defaultSelected-nya selalu false. Browser
 * sungguhan benar.
 */
const terpilih = (s: HTMLSelectElement) => [...s.options].filter((o) => o.hasAttribute('selected')).map((o) => o.value);
const pilih = (s: HTMLSelectElement, nilai: string) => {
  s.value = nilai;
  s.dispatchEvent(new Event('change', { bubbles: true }));
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('remi.preferensi', JSON.stringify({ tutorialSelesai: true }));
  _setelUlangCache();
  pasangMatchMediaPalsu(false);
  document.body.innerHTML =
    '<div id="ui"></div><div id="ui2"></div><div id="game"></div><div id="modal"></div><div id="lapisan-dialog"></div><div id="toast"></div>';
});
afterEach(() => {
  while (tutupDialogTeratas());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('konten level', () => {
  it('semua level engine punya label, pilihan, dan keterangan; urutan sama dengan engine', () => {
    expect(DAFTAR_LEVEL_WARGA.map((l) => l.level)).toEqual([...DAFTAR_LEVEL_BOT]);
    expect(DAFTAR_LEVEL_WARGA.map((l) => l.label)).toEqual(['Mudah', 'Normal', 'Jago', 'Suhu']);
    for (const l of DAFTAR_LEVEL_WARGA) {
      expect(l.label && l.pilihan && l.ket, l.level).toBeTruthy();
      // Teks UI: istilahnya warga kedai, bukan "bot".
      expect(`${l.label} ${l.pilihan} ${l.ket}`, l.level).not.toMatch(/\bbot\b/i);
    }
    expect(new Set(DAFTAR_LEVEL_WARGA.map((l) => l.label)).size).toBe(DAFTAR_LEVEL_BOT.length);
    expect(LEVEL_WARGA.jago.pilihan).toMatch(/susah/);
    expect(LEVEL_WARGA.suhu.pilihan).toMatch(/susah banget/);
  });

  it('keterangan tidak menjanjikan lebih dari strateginya', () => {
    for (const l of DAFTAR_LEVEL_WARGA) {
      // Antislop (AGENTS.md) dan tanpa janji mutlak.
      expect(l.ket, l.level).not.toMatch(/sekadar|\bselalu\b|pasti menang|nggak terkalahkan/i);
    }
    // Ingatan suhu hanya dari peristiwa yang masih ada di view (BATAS_PERISTIWA_VIEW terakhir),
    // jadi jangan bilang ingat semua kartu.
    expect(LEVEL_WARGA.suhu.ket).toMatch(/baru-baru ini/);
    expect(LEVEL_WARGA.suhu.ket).not.toMatch(/\bsemua\b/i);
    // Jago tidak memakai riwayat sama sekali.
    expect(LEVEL_WARGA.jago.ket).not.toMatch(/\bingat kartu\b/i);
  });

  it('level tidak dikenal: infoLevel null, label kecil kosong (tidak melempar)', () => {
    for (const x of ['dewa', '', 'toString', '__proto__', null, undefined, 3]) {
      expect(infoLevel(x)).toBeNull();
      expect(labelLevelKecil(x)).toBe('');
    }
    expect(labelLevelKecil('suhu')).toBe('suhu');
  });

  it('Bantuan menjelaskan keempat level dari sumber yang sama', () => {
    const bab = BAB_BANTUAN.find((b) => b.id === 'online')!;
    const tabel = bab.isi.find((b) => b.t === 'tabel' && b.kepala[0] === 'Level');
    expect(tabel).toBeDefined();
    expect(tabel!.t === 'tabel' && tabel!.baris).toEqual(DAFTAR_LEVEL_WARGA.map((l) => [l.label, l.ket]));
  });
});

describe('beranda: level warga kedai', () => {
  it('empat pilihan urut dari yang paling mudah, bawaan Normal, ringkasan dan petunjuk ikut', () => {
    renderBeranda(akar(), aksiPalsu());
    const s = akar().querySelector<HTMLSelectElement>('#o-level')!;
    expect([...s.options].map((o) => [o.value, o.textContent])).toEqual([
      ['mudah', 'Mudah'],
      ['normal', 'Normal'],
      ['jago', 'Jago (susah)'],
      ['suhu', 'Suhu (susah banget)'],
    ]);
    expect(terpilih(s)).toEqual(['normal']);
    expect(s.getAttribute('aria-describedby')).toBe('ket-level');
    expect(akar().querySelector('#ket-level')!.textContent).toBe(LEVEL_WARGA.normal.ket);
    expect(akar().querySelector('#ringkas-meja')!.textContent).toContain('lawan normal');
  });

  it('ganti ke Suhu: ringkasan, petunjuk, simpanan, dan permainan baru memakai suhu', async () => {
    const aksi = aksiPalsu();
    renderBeranda(akar(), aksi);
    pilih(akar().querySelector<HTMLSelectElement>('#o-level')!, 'suhu');
    expect(akar().querySelector('#ringkas-meja')!.textContent).toContain('lawan suhu');
    expect(akar().querySelector('#ket-level')!.textContent).toBe(LEVEL_WARGA.suhu.ket);
    expect(simpan.pengaturanOffline().levelBot).toBe('suhu');
    akar().querySelector<HTMLButtonElement>('#mulai-bot')!.click();
    await tunggu();
    expect(aksi.mainOffline).toHaveBeenCalledWith('Pemain', expect.objectContaining({ levelBot: 'suhu' }), false);
  });

  it('pengaturan tersimpan jago dipilih lagi saat beranda dibuka', () => {
    simpan.setPengaturanOffline({ jumlahPemain: 3, levelBot: 'jago' });
    renderBeranda(akar(), aksiPalsu());
    expect(terpilih(akar().querySelector<HTMLSelectElement>('#o-level')!)).toEqual(['jago']);
    expect(akar().querySelector('#ringkas-meja')!.textContent).toBe('3 pemain · lawan jago · santai · tanpa batas putaran');
  });

  it.each(['dewa', 'Jago', 7, null])('level tersimpan tidak dikenal (%j) jadi Normal, beranda tetap tampil', (rusak) => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 3, levelBot: rusak, tempoBot: 'cepat' }));
    renderBeranda(akar(), aksiPalsu());
    expect(terpilih(akar().querySelector<HTMLSelectElement>('#o-level')!)).toEqual(['normal']);
    expect(akar().querySelector('#ringkas-meja')!.textContent).toBe('3 pemain · lawan normal · cepat · tanpa batas putaran');
  });
});

describe('simpanan pengaturan offline', () => {
  it('level tidak dikenal → normal; field lain dan simpanannya tetap', () => {
    localStorage.setItem('remi.pengaturanOffline', JSON.stringify({ jumlahPemain: 5, levelBot: 'dewa', tempoBot: 'cepat' }));
    expect(simpan.pengaturanOffline()).toEqual({ jumlahPemain: 5, levelBot: 'normal', tempoBot: 'cepat' });
    expect(localStorage.getItem('remi.pengaturanOffline')).not.toBeNull();
  });

  it.each(DAFTAR_LEVEL_BOT)('level %s terbaca apa adanya', (level) => {
    simpan.setPengaturanOffline({ levelBot: level });
    expect(simpan.pengaturanOffline()).toEqual({ levelBot: level });
  });

  it('tanpa levelBot: tidak ditambahi (bawaan diisi pemakainya)', () => {
    simpan.setPengaturanOffline({ jumlahPemain: 2 });
    expect(simpan.pengaturanOffline()).toEqual({ jumlahPemain: 2 });
  });
});

describe('meja offline: level warga kedai', () => {
  const infoPertama = async (k: KoneksiOffline): Promise<InfoMeja> => {
    let info: InfoMeja | null = null;
    k.saatPesan((p: PesanServer) => {
      if (p.t === 'meja') info = p.info;
    });
    await vi.advanceTimersByTimeAsync(0);
    return info!;
  };

  it.each(['jago', 'suhu'] as const)('main baru level %s: semua warga kedai memakai level itu', async (level) => {
    vi.useFakeTimers();
    const k = KoneksiOffline.baru('Budi', { jumlahPemain: 4, levelBot: level });
    const info = await infoPertama(k);
    expect(info.kursi.slice(1).map((x) => [x.jenis, x.level])).toEqual([
      ['bot', level],
      ['bot', level],
      ['bot', level],
    ]);
    k.tutup();
  });

  it('simpanan meja offline dengan level tidak dikenal tetap bisa dilanjutkan (jadi normal)', async () => {
    vi.useFakeTimers();
    const k = KoneksiOffline.baru('Budi', { jumlahPemain: 3, levelBot: 'suhu' });
    k.tutup();
    const data = JSON.parse(localStorage.getItem('remi.mejaOffline')!);
    expect(data.kursi.map((x: { level: string }) => x.level)).toEqual(['suhu', 'suhu', 'suhu']);
    data.kursi[2].level = 'dewa';
    data.pengaturan.levelBot = 'dewa';
    localStorage.setItem('remi.mejaOffline', JSON.stringify(data));
    const lanjut = KoneksiOffline.lanjutkan();
    expect(lanjut).not.toBeNull();
    const info = await infoPertama(lanjut!);
    expect(info.kursi.map((x) => x.level)).toEqual(['suhu', 'suhu', 'normal']);
    expect(info.pengaturan.levelBot).toBe('normal');
    lanjut!.tutup();
  });
});

describe('lobi: level per kursi', () => {
  const penjadwalDiam = { setel: () => 0, batal: () => undefined, sekarang: () => 0 };

  /** InfoMeja lobi sungguhan dari Meja: host + warga kedai keempat level + satu kursi kosong. */
  function infoLobi(): InfoMeja {
    let info: InfoMeja | null = null;
    const meja = Meja.buat(
      {
        kode: 'ABCDE',
        penjadwal: penjadwalDiam,
        kirim: (_: string, p: PesanServer) => {
          if (p.t === 'meja') info = p.info;
        },
      },
      'host',
      'Budi',
      { jumlahPemain: 6 },
    );
    DAFTAR_LEVEL_BOT.forEach((level, j) => meja.terima('host', { t: 'aturKursi', kursi: j + 1, jenis: 'bot', level }));
    meja.hentikan();
    return info!;
  }

  it('host: tiap kursi warga kedai punya pilihan keempat level, yang terpilih sesuai, lencana berlabel', () => {
    renderLobi(akar(), infoLobi(), vi.fn(), vi.fn());
    const pilihan = [...akar().querySelectorAll<HTMLSelectElement>('[data-kursi]')];
    expect(pilihan.map(terpilih)).toEqual([['bot-mudah'], ['bot-normal'], ['bot-jago'], ['bot-suhu'], ['kosong']]);
    for (const s of pilihan) {
      expect([...s.options].map((o) => o.value)).toEqual(['kosong', 'bot-mudah', 'bot-normal', 'bot-jago', 'bot-suhu']);
      expect(s.querySelector('optgroup')!.label).toBe('Warga kedai');
    }
    const lencana = [...akar().querySelectorAll('.kursi .lencana')].map((e) => e.textContent).filter((t) => t!.startsWith('warga kedai'));
    expect(lencana).toEqual(['warga kedai · mudah', 'warga kedai · normal', 'warga kedai · jago', 'warga kedai · suhu']);
  });

  it('host mengganti pilihan: level dikirim apa adanya, "Tunggu orang" mengosongkan kursi', () => {
    const kirim = vi.fn<(p: PesanKlien) => void>();
    renderLobi(akar(), infoLobi(), kirim, vi.fn());
    const s = (i: number) => akar().querySelector<HTMLSelectElement>(`[data-kursi="${i}"]`)!;
    pilih(s(5), 'bot-suhu');
    pilih(s(1), 'bot-jago');
    pilih(s(4), 'bot-mudah');
    pilih(s(2), 'kosong');
    expect(kirim.mock.calls.map((c) => c[0])).toEqual([
      { t: 'aturKursi', kursi: 5, jenis: 'bot', level: 'suhu' },
      { t: 'aturKursi', kursi: 1, jenis: 'bot', level: 'jago' },
      { t: 'aturKursi', kursi: 4, jenis: 'bot', level: 'mudah' },
      { t: 'aturKursi', kursi: 2, jenis: 'kosong' },
    ]);
  });

  it('levelDariPilihan: hanya nilai "bot-<level>" yang dikenal', () => {
    for (const level of DAFTAR_LEVEL_BOT) expect(levelDariPilihan(`bot-${level}`)).toBe(level);
    for (const x of ['bot', 'bot-', 'bot-dewa', 'jago', 'kosong', 'manusia', 'bot-toString']) expect(levelDariPilihan(x)).toBeUndefined();
  });

  it('level dari versi lain (tidak dikenal): tetap tampil sebagai warga kedai, bukan "Tunggu orang"', () => {
    const info = infoLobi();
    info.kursi[3] = { ...info.kursi[3]!, level: 'dewa' as LevelBot };
    const kirim = vi.fn<(p: PesanKlien) => void>();
    renderLobi(akar(), info, kirim, vi.fn());
    const s = akar().querySelector<HTMLSelectElement>('[data-kursi="3"]')!;
    expect(terpilih(s)).toEqual(['bot']);
    expect(s.options[0]!.textContent).toBe('Warga kedai');
    expect(s.closest('.kursi')!.textContent).toContain('warga kedai');
    expect(s.closest('.kursi')!.textContent).not.toContain('dewa');
    pilih(s, 'bot-normal');
    expect(kirim).toHaveBeenCalledWith({ t: 'aturKursi', kursi: 3, jenis: 'bot', level: 'normal' });
  });

  it('bukan host: tanpa pilihan kursi, lencana level tetap tampil', () => {
    const info = { ...infoLobi(), kursiSaya: 5 };
    renderLobi(akar(), info, vi.fn(), vi.fn());
    expect(akar().querySelector('[data-kursi]')).toBeNull();
    expect(akar().textContent).toContain('warga kedai · suhu');
  });
});
