// Kepentung yang terasa "ketonjok": layar retak seperti kaca HP yang kena bogem, kilat merah-putih,
// kamera meja tersentak, dan serpih kaca beterbangan. Untuk kursi lain yang kena cukup retakan kecil di
// panelnya (MejaScene.retakPanel, memakai polaRetak/gambarRetak dari sini), supaya semua orang tahu siapa
// yang kepentung.
//
// Semua digambar saat itu juga (Canvas 2D + elemen HTML), tanpa file gambar, jadi tetap jalan offline.
//
// Pagar:
// - Hanya dipanggil SESUDAH pentungan terbuka di meja (efek/pemutar.ts). Siapa yang kepentung sudah
//   publik di saat itu; sebelum dibuka tidak ada efek apa pun di sini.
// - Lapisan #retak selalu `pointer-events: none` dan elemennya dibuang sesudah pudar. Ia anak #ui (yang
//   punya konteks tumpukan sendiri, z --z-ui), dengan z --z-retak DI DALAM #ui: menutupi meja dan bar,
//   tapi tetap di bawah coach mark tutorial, palet emote, dan gelembung emote/celetukan (juga di #ui), dan
//   seluruh #ui di bawah modal (popup joker, panel mentung), sorakan, dialog, dan toast. Jadi retakan
//   tidak pernah menutupi tombol atau tulisan mana pun selain bar meja.
// - Gerak dikurangi: tanpa sentakan kamera, retakan yang menjalar, dan serpih; retakan diam lalu pudar.
//   Efek hemat: tanpa kilat, serpih, rona merah, dan rincian kilau kaca.
// - Semua lama tampil lewat durasi() (ikut preferensi kecepatan), termasuk animasi CSS-nya (kilat,
//   retakan menjalar, serpih, "Kamu KEPENTUNG" menghantam): JS mengisi variabel CSS --*-lama dari
//   durasi(). Pembersihan memakai setTimeout (bukan animationend/requestAnimationFrame), jadi tidak
//   pernah tertahan walau tab di latar belakang.

import { durasi, efekHemat, kurangiGerak } from '../gerak';

export type Titik2 = readonly [number, number];

/** Satu garis retak (polyline) dengan tebal dasar (piksel kanvas) di pangkalnya. */
export interface GarisRetak {
  readonly titik: readonly Titik2[];
  readonly tebal: number;
}

/** Pola retakan: sinar dari titik hantam, cabang, cincin "jaring laba-laba", dan serpih di tengah. */
export interface PolaRetak {
  readonly pusat: Titik2;
  readonly garis: readonly GarisRetak[];
  /** Segitiga pecahan kaca di sekitar titik hantam (diisi tembus pandang). */
  readonly serpih: readonly (readonly Titik2[])[];
}

export interface OpsiPola {
  /** Titik hantam (piksel kanvas). */
  x: number;
  y: number;
  /** Jangkauan terjauh retakan (piksel kanvas). */
  jari: number;
  /** Benih bentuk: pola sama untuk benih yang sama. */
  benih: number;
  /** Banyaknya sinar utama. */
  sinar: number;
  /** Banyaknya cincin jaring di sekitar titik hantam. */
  cincin: number;
  /** Tebal sinar di pangkal (piksel kanvas). */
  tebal: number;
}

/** Kotak dalam piksel CSS, relatif viewport (sama dengan MejaScene.kotakLayar). */
export interface KotakCss {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Angka acak deterministik 0..1 (mulberry32). */
export function acakBenih(benih: number): () => number {
  let a = Math.floor(benih) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Titik pertama di polyline yang jaraknya dari (cx, cy) mencapai `jarak`, atau undefined. */
function titikPadaJarak(titik: readonly Titik2[], cx: number, cy: number, jarak: number): Titik2 | undefined {
  for (let i = 1; i < titik.length; i++) {
    const [x0, y0] = titik[i - 1];
    const [x1, y1] = titik[i];
    const d0 = Math.hypot(x0 - cx, y0 - cy);
    const d1 = Math.hypot(x1 - cx, y1 - cy);
    if (d0 <= jarak && d1 >= jarak) {
      const u = d1 === d0 ? 0 : (jarak - d0) / (d1 - d0);
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
    }
  }
  return undefined;
}

/** Cabang pendek yang patah-patah dari (x, y) ke arah `arah`. */
function cabang(acak: () => number, x: number, y: number, arah: number, panjang: number): Titik2[] {
  const titik: Titik2[] = [[x, y]];
  const langkah = 2 + Math.floor(acak() * 3);
  let a = arah;
  for (let i = 0; i < langkah; i++) {
    a += (acak() - 0.5) * 0.7;
    x += Math.cos(a) * (panjang / langkah);
    y += Math.sin(a) * (panjang / langkah);
    titik.push([x, y]);
  }
  return titik;
}

/**
 * Pola retakan kaca dari satu titik hantam. Fungsi murni: benih yang sama memberi pola yang sama.
 * Sinar utama menjalar keluar dengan belokan kecil (makin jauh makin panjang langkahnya), sesekali
 * bercabang; cincin menghubungkan sinar bertetangga di dekat titik hantam seperti jaring laba-laba.
 */
export function polaRetak(o: OpsiPola): PolaRetak {
  const acak = acakBenih(o.benih);
  const n = Math.max(3, Math.round(o.sinar));
  const celah = (Math.PI * 2) / n;
  const awal = acak() * Math.PI * 2;
  const garis: GarisRetak[] = [];
  const sinar: Titik2[][] = [];
  for (let i = 0; i < n; i++) {
    const arah = awal + i * celah + (acak() - 0.5) * celah * 0.55;
    const panjang = o.jari * (0.45 + 0.55 * acak());
    let a = arah;
    let x = o.x + Math.cos(a) * o.jari * 0.015;
    let y = o.y + Math.sin(a) * o.jari * 0.015;
    let jarak = o.jari * 0.015;
    const titik: Titik2[] = [[x, y]];
    // Batas langkah hanya pengaman; normalnya sinar berhenti karena panjangnya tercapai.
    while (jarak < panjang && titik.length < 48) {
      const langkah = o.jari * (0.03 + 0.07 * acak()) * (1 + (1.5 * jarak) / o.jari);
      // Belok sedikit, tapi selalu ditarik kembali ke arah asal supaya tetap menjalar keluar.
      a = arah + (a - arah) * 0.4 + (acak() - 0.5) * 0.55;
      x += Math.cos(a) * langkah;
      y += Math.sin(a) * langkah;
      jarak = Math.hypot(x - o.x, y - o.y);
      titik.push([x, y]);
      if (jarak > o.jari * 0.1 && acak() < 0.26) {
        const sisi = acak() < 0.5 ? -1 : 1;
        garis.push({ titik: cabang(acak, x, y, a + sisi * (0.35 + 0.55 * acak()), o.jari * (0.05 + 0.16 * acak())), tebal: o.tebal * 0.45 });
      }
    }
    sinar.push(titik);
    garis.push({ titik, tebal: o.tebal });
  }
  for (let c = 0; c < o.cincin; c++) {
    const r = o.jari * (0.06 + 0.12 * c) * (0.85 + 0.3 * acak());
    for (let i = 0; i < n; i++) {
      if (acak() < 0.2) continue;
      const p = titikPadaJarak(sinar[i], o.x, o.y, r);
      const q = titikPadaJarak(sinar[(i + 1) % n], o.x, o.y, r * (0.88 + 0.24 * acak()));
      if (!p || !q) continue;
      // Titik tengah sedikit tertarik ke titik hantam: cincin jaring melengkung ke dalam.
      const tarik = 0.06 + 0.14 * acak();
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      garis.push({ titik: [p, [mx + (o.x - mx) * tarik, my + (o.y - my) * tarik], q], tebal: o.tebal * 0.5 });
    }
  }
  const serpih: Titik2[][] = [];
  for (let i = 0; i < n; i++) {
    const p = titikPadaJarak(sinar[i], o.x, o.y, o.jari * 0.05 * (0.7 + 0.6 * acak()));
    const q = titikPadaJarak(sinar[(i + 1) % n], o.x, o.y, o.jari * 0.05 * (0.7 + 0.6 * acak()));
    if (p && q) serpih.push([[o.x, o.y], p, q]);
  }
  return { pusat: [o.x, o.y], garis, serpih };
}

export interface OpsiGambarRetak {
  /** Skala piksel (devicePixelRatio kanvas): tebal bayangan dan kilau ikut skala ini. */
  skala: number;
  /** Rincian kaca: serpih berkilau dan garis kilau kebiruan. Mati saat efek hemat. */
  rinci: boolean;
  /** Pengali kepekatan 0..1 (retakan samar di kotak status panel mentung). */
  pekat?: number;
}

/**
 * Gambar pola retakan ke Canvas 2D: serpih tembus pandang, bayangan gelap (terbaca di atas laken hijau
 * maupun kartu putih), garis putih yang menipis ke ujung, kilau kebiruan, dan pendar di titik hantam.
 */
export function gambarRetak(ctx: CanvasRenderingContext2D, pola: PolaRetak, o: OpsiGambarRetak): void {
  const s = o.skala;
  const pekat = o.pekat ?? 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (o.rinci) {
    pola.serpih.forEach((poli, i) => {
      ctx.beginPath();
      poli.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${((0.1 + 0.05 * (i % 4)) * pekat).toFixed(3)})`;
      ctx.fill();
    });
  }
  // Bayangan: satu path per garis, sedikit bergeser ke kanan bawah.
  ctx.strokeStyle = `rgba(0, 0, 0, ${(0.5 * pekat).toFixed(3)})`;
  for (const g of pola.garis) {
    ctx.lineWidth = g.tebal * 0.75 + 1.4 * s;
    ctx.beginPath();
    g.titik.forEach(([x, y], j) => (j ? ctx.lineTo(x + 0.9 * s, y + 0.9 * s) : ctx.moveTo(x + 0.9 * s, y + 0.9 * s)));
    ctx.stroke();
  }
  // Garis retak: per ruas supaya menipis ke ujung.
  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.92 * pekat).toFixed(3)})`;
  for (const g of pola.garis) {
    const n = g.titik.length;
    for (let j = 1; j < n; j++) {
      ctx.lineWidth = Math.max(0.5 * s, g.tebal * (1 - (0.7 * (j - 1)) / Math.max(1, n - 1)));
      ctx.beginPath();
      ctx.moveTo(g.titik[j - 1][0], g.titik[j - 1][1]);
      ctx.lineTo(g.titik[j][0], g.titik[j][1]);
      ctx.stroke();
    }
  }
  if (o.rinci) {
    ctx.strokeStyle = `rgba(200, 232, 255, ${(0.55 * pekat).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.5, 0.6 * s);
    for (const g of pola.garis) {
      ctx.beginPath();
      g.titik.forEach(([x, y], j) => (j ? ctx.lineTo(x - 0.8 * s, y - 0.8 * s) : ctx.moveTo(x - 0.8 * s, y - 0.8 * s)));
      ctx.stroke();
    }
  }
  // Titik hantam: kaca remuk yang berpendar putih.
  const [cx, cy] = pola.pusat;
  const r = Math.max(6 * s, (pola.garis[0]?.tebal ?? 2) * 7);
  const gradien = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradien.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * pekat).toFixed(3)})`);
  gradien.addColorStop(0.45, `rgba(255, 255, 255, ${(0.4 * pekat).toFixed(3)})`);
  gradien.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradien;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Lapisan di layar
// ---------------------------------------------------------------------------------------------

/** Lama dasar (ms) retakan layar besar tampil, termasuk pudarnya (CSS: tahan ±72%, lalu pudar). */
export const LAMA_RETAK = 2100;
/** Versi pentungan joker (sudah terbuka): sedikit lebih lama. */
export const LAMA_RETAK_KUAT = 2400;
/** Lama dasar (ms) retakan kecil di panel kursi lain yang kena (MejaScene.retakPanel). */
export const LAMA_RETAK_PANEL = 1900;
/** Lama dasar (ms) sentakan kamera meja. */
export const LAMA_SENTAK = 560;
/** Lama dasar (ms) kilat merah-putih saat pukulan mendarat (CSS --kilat-lama). */
export const LAMA_KILAT = 380;
/** Versi pentungan joker (sudah terbuka): kilat berkedip dua kali, sedikit lebih lama. */
export const LAMA_KILAT_KUAT = 500;
/** Lama dasar (ms) retakan menjalar dari titik hantam ke seluruh layar (CSS --menjalar-lama). */
export const LAMA_MENJALAR = 160;
/** Lama dasar (ms) serpih kaca beterbangan (CSS --serpih-lama), dan jeda acak terlama sebelum lepas. */
export const LAMA_SERPIH = 800;
export const JEDA_SERPIH_MAKS = 60;
/** Lama dasar (ms) "Kamu KEPENTUNG" menghantam masuk lalu bergetar di panel mentung (CSS --hantam-lama). */
export const LAMA_HANTAM = 600;

/** Timer milik efek retak (dibatalkan bersihkanRetak), dan penutup janji efek yang masih tampil. */
const timer = new Set<ReturnType<typeof setTimeout>>();
const penutup = new Set<() => void>();

const adaDom = () => typeof document !== 'undefined' && !!document.body;

/** setTimeout yang ikut dibatalkan bersihkanRetak(). `fn` sendiri yang memeriksa DOM masih ada. */
function nanti(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    timer.delete(t);
    fn();
  }, Math.max(0, ms));
  timer.add(t);
}

/**
 * Wadah semua efek retak. Tidak pernah menerima sentuhan. Dipasang di dalam #ui (bukan langsung di body)
 * supaya z-index-nya dibandingkan dengan isi #ui: di atas bar meja, di bawah coach mark tutorial, palet
 * emote, dan gelembung emote/celetukan. Tanpa #ui (mis. test) jatuh ke body. #ui yang dikosongkan
 * (KontrolMeja dihancurkan) ikut membuangnya; panggilan berikutnya membuat wadah baru.
 */
function wadah(): HTMLElement {
  const induk = document.getElementById('ui') ?? document.body;
  let el = document.getElementById('retak');
  if (!el) {
    el = document.createElement('div');
    el.id = 'retak';
    el.setAttribute('aria-hidden', 'true');
    // Inline juga (bukan hanya di CSS): lapisan ini tidak boleh menahan ketukan walau CSS belum termuat,
    // dan mengalahkan `#ui > * { pointer-events: auto }`.
    el.style.pointerEvents = 'none';
  }
  if (el.parentElement !== induk) induk.appendChild(el);
  return el;
}

/** Tampilkan `el` selama `lama` ms lalu buang. Janji selesai saat elemen dibuang (atau dibersihkan). */
function tampilkanSementara(el: HTMLElement, lama: number): Promise<void> {
  wadah().appendChild(el);
  return new Promise((ok) => {
    const tutup = () => {
      penutup.delete(tutup);
      el.remove();
      ok();
    };
    penutup.add(tutup);
    nanti(tutup, lama);
  });
}

/** Kanvas seukuran kotak (piksel CSS), resolusi perangkat (dibatasi 2× supaya hemat memori). */
function kanvasUntuk(w: number, h: number): { kanvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; dpr: number } {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.max(1, Math.round(w * dpr));
  kanvas.height = Math.max(1, Math.round(h * dpr));
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = kanvas.getContext('2d');
  } catch {
    // Kanvas tidak didukung (mis. lingkungan test): lapisan tetap tampil tanpa gambar retakan.
  }
  return { kanvas, ctx, dpr };
}

/** Kotak dari luar (mis. scene palsu di test) yang benar-benar berisi angka, atau null. */
export function kotakSah(k: unknown): KotakCss | null {
  if (!k || typeof k !== 'object') return null;
  const { x, y, w, h } = k as Record<string, unknown>;
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return (w as number) > 0 && (h as number) > 0 ? { x: x as number, y: y as number, w: w as number, h: h as number } : null;
}

export interface OpsiJotos {
  /** Titik hantam (piksel CSS, relatif viewport). null = di area tangan bawah tengah layar. */
  titik: { x: number; y: number } | null;
  /** Pentungan joker (sudah terbuka): retakan, kilat, dan sentakan lebih besar. */
  kuat?: boolean;
  /** Benih bentuk retakan (mis. id peristiwa): sama di setiap pemutaran ulang. */
  benih: number;
}

/**
 * Pukulan untuk pemain yang kepentung: kamera meja tersentak (zoom + goyang), kilat merah-putih, layar
 * retak dari titik hantam di dekat tangannya, dan serpih kaca. Retakan bertahan ±2 detik lalu pudar.
 * Janji selesai saat semua lapisannya sudah dibuang.
 */
export function jotos(o: OpsiJotos): Promise<void> {
  if (!adaDom() || document.hidden) return Promise.resolve();
  const kurang = kurangiGerak();
  const hemat = efekHemat();
  const W = window.innerWidth || document.documentElement.clientWidth || 1;
  const H = window.innerHeight || document.documentElement.clientHeight || 1;
  const t = o.titik ?? { x: W / 2, y: H * 0.74 };
  const lama = durasi(o.kuat ? LAMA_RETAK_KUAT : LAMA_RETAK);

  const el = document.createElement('div');
  el.className = ['retak-layar', o.kuat ? 'kuat' : '', kurang ? 'diam' : '', hemat ? 'hemat' : ''].filter(Boolean).join(' ');
  el.style.setProperty('--retak-lama', `${lama}ms`);
  // Animasi CSS di dalamnya juga ikut preferensi kecepatan (meja.css memakai variabel ini).
  el.style.setProperty('--kilat-lama', `${durasi(o.kuat ? LAMA_KILAT_KUAT : LAMA_KILAT)}ms`);
  el.style.setProperty('--menjalar-lama', `${durasi(LAMA_MENJALAR)}ms`);
  el.style.setProperty('--serpih-lama', `${durasi(LAMA_SERPIH)}ms`);
  el.style.setProperty('--retak-x', `${Math.round(t.x)}px`);
  el.style.setProperty('--retak-y', `${Math.round(t.y)}px`);

  const { kanvas, ctx, dpr } = kanvasUntuk(W, H);
  kanvas.className = 'retak-kanvas';
  if (ctx) {
    const pola = polaRetak({
      x: t.x * dpr,
      y: t.y * dpr,
      jari: Math.hypot(W, H) * (o.kuat ? 0.85 : 0.72) * dpr,
      benih: o.benih,
      sinar: o.kuat ? 15 : 12,
      cincin: hemat ? 2 : 3,
      tebal: (o.kuat ? 3.2 : 2.6) * dpr,
    });
    gambarRetak(ctx, pola, { skala: dpr, rinci: !hemat });
  }
  el.appendChild(kanvas);

  if (!hemat) {
    const kilat = document.createElement('div');
    kilat.className = 'kilat-jotos';
    el.appendChild(kilat);
  }
  if (!hemat && !kurang) {
    // Serpih kaca beterbangan dari titik hantam (dekoratif: mati saat hemat/gerak dikurangi).
    const acak = acakBenih(o.benih * 13 + 5);
    const deret = document.createElement('div');
    deret.className = 'serpih-deret';
    for (let i = 0, n = o.kuat ? 16 : 11; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'serpih';
      const sudut = (i / n) * Math.PI * 2 + (acak() - 0.5) * 0.6;
      const jauh = Math.min(W, H) * (0.18 + 0.3 * acak());
      const ukuran = 6 + Math.round(12 * acak());
      s.style.setProperty('--dx', `${Math.round(Math.cos(sudut) * jauh)}px`);
      s.style.setProperty('--dy', `${Math.round(Math.sin(sudut) * jauh + jauh * 0.35)}px`);
      s.style.setProperty('--putar', `${Math.round((acak() - 0.5) * 720)}deg`);
      s.style.setProperty('--ukuran', `${ukuran}px`);
      s.style.setProperty('--jeda', `${durasi(acak() * JEDA_SERPIH_MAKS)}ms`);
      s.style.clipPath = `polygon(${Math.round(acak() * 40)}% 0%, 100% ${Math.round(30 + acak() * 50)}%, ${Math.round(acak() * 60)}% 100%)`;
      deret.appendChild(s);
    }
    el.appendChild(deret);
  }

  const selesai = tampilkanSementara(el, lama);
  if (!kurang) sentak(t, !!o.kuat);
  return selesai;
}

/** Sentakan kamera meja: #game di-zoom sedikit ke titik hantam lalu digoyang (CSS body.jotos). */
function sentak(t: { x: number; y: number }, kuat: boolean) {
  const b = document.body;
  // Goyang biasa dari pentungan dibuka digantikan sentakan ini.
  b.classList.remove('goyang', 'jotos', 'jotos-kuat');
  b.style.setProperty('--jotos-x', `${Math.round(t.x)}px`);
  b.style.setProperty('--jotos-y', `${Math.round(t.y)}px`);
  b.style.setProperty('--jotos-lama', `${durasi(LAMA_SENTAK)}ms`);
  // Paksa reflow supaya animasi mulai ulang walau kelasnya baru saja dilepas.
  void b.offsetWidth;
  b.classList.add('jotos');
  if (kuat) b.classList.add('jotos-kuat');
  // Lingkungan DOM bisa sudah dibongkar (test) sebelum timer ini jalan.
  nanti(() => adaDom() && document.body.classList.remove('jotos', 'jotos-kuat'), durasi(LAMA_SENTAK) + 40);
}

/**
 * "Kamu KEPENTUNG" di panel mentung: lama animasi menghantam masuk (CSS `hantam`, --hantam-lama) ikut
 * preferensi kecepatan, dan retakan samar di belakang tulisannya (dekoratif: tidak digambar saat efek
 * hemat). Kanvasnya di bawah teks (z-index −1 di dalam kotak), tanpa sentuhan dan tanpa label.
 * Dipanggil segera sesudah kotaknya masuk DOM (sebelum frame berikutnya); perubahan animation-duration
 * juga berlaku untuk animasi CSS yang sudah mulai, jadi tidak ada frame yang memakai lama bawaan.
 */
export function retakkanStatus(kotak: HTMLElement, benih: number): void {
  kotak.style.setProperty('--hantam-lama', `${durasi(LAMA_HANTAM)}ms`);
  if (!adaDom() || efekHemat()) return;
  // offsetWidth/Height: ukuran tata letak, tidak terpengaruh animasi skala yang sedang jalan.
  const w = kotak.offsetWidth || 320;
  const h = kotak.offsetHeight || 90;
  const { kanvas, ctx, dpr } = kanvasUntuk(w, h);
  kanvas.className = 'retak-status';
  kanvas.setAttribute('aria-hidden', 'true');
  if (ctx) {
    const pola = polaRetak({ x: w * 0.13 * dpr, y: h * 0.38 * dpr, jari: w * 0.95 * dpr, benih, sinar: 9, cincin: 2, tebal: 1.8 * dpr });
    gambarRetak(ctx, pola, { skala: dpr, rinci: true, pekat: 0.6 });
  }
  kotak.prepend(kanvas);
}

/** Buang semua efek retak sekarang juga (meninggalkan meja): lapisan, sentakan, dan timernya. */
export function bersihkanRetak(): void {
  timer.forEach((t) => clearTimeout(t));
  timer.clear();
  [...penutup].forEach((tutup) => tutup());
  if (!adaDom()) return;
  document.getElementById('retak')?.replaceChildren();
  document.body.classList.remove('jotos', 'jotos-kuat');
}
