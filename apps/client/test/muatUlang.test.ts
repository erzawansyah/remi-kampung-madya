// @vitest-environment happy-dom
// Chunk yang gagal dimuat (sinyal putus sebelum aplikasi tersimpan di HP, atau 404 sesudah deploy):
// - jaringan.ts: baca URL chunk dari pesan galat import(), cek sinyal sebelum muat ulang;
// - jendelaMalas.ts: Bantuan/Tentang yang gagal bisa dicoba lagi TANPA muat ulang (URL + query unik,
//   karena Chrome mengingat import() yang gagal per URL), dan toast-nya selalu memberi jalan keluar;
// - pemuatMeja.ts: pemuat "Nyiapin meja…" dan galat meja dengan Coba lagi + Kembali ke beranda.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adaJaringan, urlChunkGagal, urlUlang } from '../src/jaringan';
import { bukaMalas, PESAN_GAGAL, PESAN_MASIH_GAGAL, pemuatMalas } from '../src/ui/jendelaMalas';
import { PESAN_MEJA_GAGAL, renderGalatMeja, renderPemuatMeja, TEKS_PEMUAT_MEJA } from '../src/ui/pemuatMeja';

const asal = () => location.origin;
const galatImpor = (path: string) => new TypeError(`Failed to fetch dynamically imported module: ${asal()}${path}`);
const toasts = () => [...document.querySelectorAll<HTMLElement>('#toast .toast')];
/** Habiskan microtask/then berantai. */
const tunggu = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  document.body.innerHTML = '<div id="toast"></div><div id="ui"></div>';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('jaringan.ts', () => {
  it('urlChunkGagal membaca URL chunk seasal dari pesan galat Chrome/Firefox, tanpa query', () => {
    expect(urlChunkGagal(galatImpor('/assets/bantuan-CmIR4jTR.js'))).toBe(`${asal()}/assets/bantuan-CmIR4jTR.js`);
    expect(urlChunkGagal(new TypeError(`error loading dynamically imported module: ${asal()}/assets/tentang-x1.js?ulang=3`))).toBe(
      `${asal()}/assets/tentang-x1.js`,
    );
    expect(urlChunkGagal(new Error(`Failed to fetch dynamically imported module: ${asal()}/src/ui/bantuan.ts?t=123`))).toBe(
      `${asal()}/src/ui/bantuan.ts`,
    );
    // Asal lain, tanpa URL, atau bukan JS: tidak dipakai.
    expect(urlChunkGagal(new Error('Failed to fetch dynamically imported module: https://jahat.example/x.js'))).toBeNull();
    expect(urlChunkGagal(new Error('Failed to fetch'))).toBeNull();
    expect(urlChunkGagal(new Error(`Unable to preload CSS for ${asal()}/assets/jendela.css`))).toBeNull();
    expect(urlChunkGagal(undefined)).toBeNull();
  });

  it('urlUlang selalu memberi query baru', () => {
    const a = urlUlang('https://x/a.js');
    const b = urlUlang('https://x/a.js');
    expect(a).toMatch(/^https:\/\/x\/a\.js\?ulang=/);
    expect(a).not.toBe(b);
  });

  it('adaJaringan: offline langsung false tanpa request; jawaban apa pun = true; galat jaringan = false', async () => {
    const fetchPalsu = vi.fn();
    vi.stubGlobal('fetch', fetchPalsu);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await adaJaringan()).toBe(false);
    expect(fetchPalsu).not.toHaveBeenCalled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    fetchPalsu.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await adaJaringan()).toBe(true);
    expect(fetchPalsu.mock.calls[0]![1]).toMatchObject({ method: 'HEAD', cache: 'no-store' });

    fetchPalsu.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await adaJaringan()).toBe(false);
  });
});

describe('jendelaMalas: gagal lalu berhasil tanpa muat ulang', () => {
  it('promise yang gagal tidak disimpan; percobaan ulang memakai URL chunk yang gagal + query unik', async () => {
    const modul = { buka: vi.fn() };
    const ambil = vi.fn<() => Promise<typeof modul>>().mockRejectedValue(galatImpor('/assets/bantuan-Ab12.js'));
    const imporUrl = vi.fn<(url: string) => Promise<unknown>>().mockResolvedValue(modul);
    const m = pemuatMalas(ambil, imporUrl);

    await expect(m.muat()).rejects.toThrow();
    expect(m.gagal).toBe(1);
    await expect(m.muat()).resolves.toBe(modul);
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(imporUrl).toHaveBeenCalledTimes(1);
    expect(imporUrl.mock.calls[0]![0]).toMatch(new RegExp(`^${asal()}/assets/bantuan-Ab12\\.js\\?ulang=`));
    expect(m.gagal).toBe(0);
    // Sesudah berhasil, modul yang sama dipakai terus (tidak diambil ulang).
    await m.muat();
    expect(imporUrl).toHaveBeenCalledTimes(1);
  });

  it('galat tanpa URL (mis. browser lain): percobaan ulang memanggil import() aslinya lagi', async () => {
    const modul = {};
    const ambil = vi.fn<() => Promise<object>>().mockRejectedValueOnce(new Error('jaringan putus')).mockResolvedValueOnce(modul);
    const imporUrl = vi.fn();
    const m = pemuatMalas(ambil, imporUrl);
    await expect(m.muat()).rejects.toThrow();
    await expect(m.muat()).resolves.toBe(modul);
    expect(ambil).toHaveBeenCalledTimes(2);
    expect(imporUrl).not.toHaveBeenCalled();
  });

  it('bukaMalas: gagal → toast "Coba lagi" yang membuka lagi; berhasil → jendela terbuka', async () => {
    const modul = { buka: vi.fn() };
    const m = pemuatMalas(
      vi.fn<() => Promise<typeof modul>>().mockRejectedValue(galatImpor('/assets/bantuan-Ab12.js')),
      vi.fn<(url: string) => Promise<unknown>>().mockResolvedValue(modul),
    );
    const buka = () => bukaMalas(m, (x) => x.buka(), () => void buka());
    await buka();
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]!.textContent).toContain(PESAN_GAGAL);
    const tombol = toasts()[0]!.querySelector('button')!;
    expect(tombol.textContent).toBe('Coba lagi');
    tombol.click();
    await tunggu();
    expect(modul.buka).toHaveBeenCalledTimes(1);
    expect(toasts()).toHaveLength(0);
  });

  it('bukaMalas: gagal lagi padahal sinyal ada → tawarkan "Muat ulang"; sinyal putus → tetap "Coba lagi"', async () => {
    const m = pemuatMalas(
      vi.fn<() => Promise<object>>().mockRejectedValue(galatImpor('/assets/bantuan-Ab12.js')),
      vi.fn<(url: string) => Promise<unknown>>().mockRejectedValue(galatImpor('/assets/bantuan-Ab12.js?ulang=1')),
    );
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await bukaMalas(m, () => undefined, () => undefined);
    await bukaMalas(m, () => undefined, () => undefined);
    expect(toasts().at(-1)!.textContent).toContain(PESAN_GAGAL);
    expect(toasts().at(-1)!.querySelector('button')!.textContent).toBe('Coba lagi');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null)));
    await bukaMalas(m, () => undefined, () => undefined);
    await tunggu();
    expect(toasts().at(-1)!.textContent).toContain(PESAN_MASIH_GAGAL);
    expect(toasts().at(-1)!.querySelector('button')!.textContent).toBe('Muat ulang');
  });
});

describe('jendelaMalas: pramuat diam-diam', () => {
  it('pramuat yang gagal di latar tidak dihitung: kegagalan pertama yang dilihat pemain tetap "Coba lagi"', async () => {
    const m = pemuatMalas(
      vi.fn<() => Promise<object>>().mockRejectedValue(galatImpor('/assets/tentang-Zz.js')),
      vi.fn<(url: string) => Promise<unknown>>().mockRejectedValue(galatImpor('/assets/tentang-Zz.js')),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null)));
    await m.muat().catch(() => undefined); // pramuat idle
    await bukaMalas(m, () => undefined, () => undefined);
    expect(toasts().at(-1)!.querySelector('button')!.textContent).toBe('Coba lagi');
  });
});

describe('pemuatMeja', () => {
  it('pemuat: role=status, teks "Nyiapin meja…", kartu hiasan disembunyikan dari pembaca layar, isi lama diganti', () => {
    const akar = document.getElementById('ui')!;
    akar.innerHTML = '<p>lama</p>';
    const el = renderPemuatMeja(akar);
    expect(akar.children).toHaveLength(1);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toContain(TEKS_PEMUAT_MEJA);
    expect(el.querySelector('.pemuat-kartu')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('galat: pesan + Coba lagi (fokus, bisa berkali-kali, dikunci saat sibuk) + Kembali ke beranda', () => {
    const akar = document.getElementById('ui')!;
    const cobaLagi = vi.fn();
    const keBeranda = vi.fn();
    const g = renderGalatMeja(akar, { cobaLagi, keBeranda });
    expect(akar.querySelector('[role="alert"]')).not.toBeNull();
    expect(g.el.textContent).toContain(PESAN_MEJA_GAGAL);
    const coba = akar.querySelector<HTMLButtonElement>('[data-a="coba-lagi"]')!;
    expect(document.activeElement).toBe(coba);
    coba.click();
    coba.click();
    expect(cobaLagi).toHaveBeenCalledTimes(2);
    g.aturSibuk(true);
    coba.click();
    expect(cobaLagi).toHaveBeenCalledTimes(2);
    g.aturSibuk(false);
    g.aturPesan('Sinyalnya masih putus, Bos.');
    expect(g.el.textContent).toContain('Sinyalnya masih putus, Bos.');
    akar.querySelector<HTMLButtonElement>('[data-a="beranda"]')!.click();
    expect(keBeranda).toHaveBeenCalledTimes(1);
  });
});
