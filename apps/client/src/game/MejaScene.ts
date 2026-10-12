// Scene meja: menggambar ulang seluruh meja setiap model berubah. Semua ukuran dalam piksel
// perangkat (sudah dikali devicePixelRatio) supaya tajam di HP.

import Phaser from 'phaser';
import { maksimalMulung, namaKartu, namaRank, type EntriBuangan, type Kartu, type KartuJadi } from '@remi/engine';
import type { InfoMeja } from '@remi/meja';
import type { ViewPemain } from '@remi/engine';
import { daftarkanTeksturKartu, KUNCI_PUNGGUNG, kunciMuka, RASIO_KARTU } from './kartuGrafis';

export interface KombinasiTertunda {
  kartu: { kartu: Kartu; label?: string }[];
}

export interface ModelMeja {
  view: ViewPemain;
  info: InfoMeja;
  /** Tangan dalam urutan pilihan pemain, tanpa kartu yang sedang dipakai kombinasi mulung. */
  tangan: Kartu[];
  dipilih: ReadonlySet<string>;
  /** Mode memilih jumlah kartu yang dipungut. */
  pilihJumlahMulung: boolean;
  /** Sedang menyusun mulung. */
  mulung: null | {
    jumlah: number;
    /** Kartu pungutan yang belum dipakai kombinasi. */
    sisaPungutan: Kartu[];
    idPaling: string;
    kombinasi: KombinasiTertunda[];
  };
  /** Teks aksi terakhir tiap pemain (misalnya "buang 7♥"), tampil sebentar di panelnya. */
  aksiTerakhir: Record<number, string>;
  /** Kartu yang sedang dianimasikan: disembunyikan dari tangan/buangan supaya tidak terlihat dobel. */
  disembunyikan: ReadonlySet<string>;
  /** Giliranku dan tahap ambil: kartu di buangan bisa langsung diketuk untuk mungut. */
  bisaPungut: boolean;
  /** Kartu teratas buangan milikku dan lawan sedang menimbang: tampilkan ketegangan. */
  kartukuDiAtas: boolean;
  /** Nama pemain berikutnya (pengingat saat aku akan membuang); null bila tidak relevan. */
  berikutnya: string | null;
}

/** Titik acuan di layar (piksel perangkat, titik tengah kartu) untuk animasi kartu terbang. */
export interface Titik {
  x: number;
  y: number;
  w: number;
}

export interface AksiAdegan {
  ketukKartu(id: string): void;
  ketukDeck(): void;
  ketukBuangan(jumlah: number): void;
  geserKartu(id: string, indeksBaru: number): void;
  ketukKombinasi(indeks: number): void;
  /** Kartu tangan diseret dan dilepas di atas tumpukan buangan. */
  lepasKeBuangan(id: string): void;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const EMAS = 0xf2c14e;

export class MejaScene extends Phaser.Scene {
  private model: ModelMeja | null = null;
  private aksi: AksiAdegan | null = null;
  private d = 1;
  /** Ruang yang dipakai HTML di atas/bawah (px CSS). */
  ruangAtas = 52;
  ruangBawah = 138;
  /** Kotak tumpukan buangan (piksel perangkat) untuk seret-lalu-buang. */
  private areaBuangan: { x: number; y: number; w: number; h: number } | null = null;
  /** Lapisan kartu terbang; tidak ikut dihapus saat meja digambar ulang. */
  private lapisan!: Phaser.GameObjects.Container;
  private titik: {
    deck?: Titik;
    buangan?: Titik;
    tangan?: Titik;
    panel: Map<number, Titik>;
    /** Posisi tiap kartu di tangan saya dan di buangan, per id kartu. */
    kartu: Map<string, Titik>;
  } = { panel: new Map(), kartu: new Map() };

  constructor() {
    super('meja');
  }

  create() {
    daftarkanTeksturKartu(this.textures);
    this.lapisan = this.add.container(0, 0).setDepth(100);
    this.scale.on('resize', () => this.gambar());
    this.gambar();
  }

  pasang(model: ModelMeja | null, aksi: AksiAdegan) {
    this.model = model;
    this.aksi = aksi;
    if (this.sys.isActive()) this.gambar();
  }

  private teks(x: number, y: number, isi: string, ukuran: number, warna = '#f3efe3', tebal = false) {
    return this.add.text(x, y, isi, {
      fontFamily: FONT,
      fontSize: `${Math.round(ukuran * this.d)}px`,
      color: warna,
      fontStyle: tebal ? 'bold' : 'normal',
    });
  }

  private kartu(x: number, y: number, w: number, k: Kartu | null) {
    const img = this.add.image(x, y, k ? kunciMuka(k.bunga, k.rank) : KUNCI_PUNGGUNG).setOrigin(0, 0);
    img.setDisplaySize(w, w * RASIO_KARTU);
    return img;
  }

  private bingkai(x: number, y: number, w: number, h: number, warna = EMAS, tebal = 3) {
    const g = this.add.graphics();
    g.lineStyle(tebal * this.d, warna, 1);
    g.strokeRoundedRect(x - 2 * this.d, y - 2 * this.d, w + 4 * this.d, h + 4 * this.d, 8 * this.d);
    return g;
  }

  private panel(x: number, y: number, w: number, h: number, aktif: boolean) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, aktif ? 0.32 : 0.2);
    g.fillRoundedRect(x, y, w, h, 10 * this.d);
    if (aktif) {
      g.lineStyle(2 * this.d, EMAS, 1);
      g.strokeRoundedRect(x, y, w, h, 10 * this.d);
    }
    return g;
  }

  /** Lebar kartu mini supaya `jumlahKartu` kartu dalam `jumlahKelompok` kelompok muat di `lebar`. */
  private lebarMini(lebar: number, jumlahKartu: number, jumlahKelompok: number, maks: number) {
    if (!jumlahKartu) return maks;
    const celah = 6 * this.d;
    // Kartu dalam satu kelompok bertumpuk 62%.
    const satuan = (lebar - celah * Math.max(0, jumlahKelompok - 1)) / (jumlahKartu * 0.62 + jumlahKelompok * 0.38);
    return Math.max(14 * this.d, Math.min(maks, satuan));
  }

  /** Gambar daftar kartu jadi dalam satu baris; kembalikan tinggi yang dipakai. */
  private gambarKartuJadi(daftar: KartuJadi[], x: number, y: number, lebar: number, maks: number): number {
    const total = daftar.reduce((s, kj) => s + kj.kartu.length, 0);
    const w = this.lebarMini(lebar, total, daftar.length, maks);
    const h = w * RASIO_KARTU;
    let cx = x;
    for (const kj of daftar) {
      kj.kartu.forEach((d, i) => {
        this.kartu(cx + i * w * 0.62, y, w, d.kartu);
        if (d.dari !== undefined && d.dari === this.model?.view.saya) {
          const tag = this.teks(cx + i * w * 0.62 + w * 0.06, y + 1 * this.d, 'kamu', Math.max(8, w / this.d / 4.2), '#ffffff', true);
          tag.setBackgroundColor('#2f7fd1');
          tag.setPadding(2 * this.d, 0, 2 * this.d, 0);
        }
        if (d.pengganti) {
          const label = this.teks(cx + i * w * 0.62 + w * 0.08, y + h * 0.78, `→${namaRank(d.sebagai.rank)}`, Math.max(9, w / this.d / 4), '#1d1600', true);
          label.setBackgroundColor('#f2c14e');
          label.setPadding(2 * this.d, 0, 2 * this.d, 0);
        }
      });
      cx += (kj.kartu.length - 1) * w * 0.62 + w + 6 * this.d;
    }
    return total ? h : 0;
  }

  /** Posisi pemain di layar: panel lawan, atau tangan sendiri. */
  posisiPemain(pemain: number): Titik | undefined {
    return pemain === (this.model?.view.saya ?? -1) ? this.titik.tangan : this.titik.panel.get(pemain);
  }

  /** Posisi satu kartu (di tangan saya atau di buangan), kalau sedang terlihat. */
  posisiKartu(id: string): Titik | undefined {
    return this.titik.kartu.get(id);
  }

  /** Titik tengah layar untuk kartu yang dipamerkan, beserta lebar kartu besarnya. */
  private panggung(jumlah: number): Titik {
    const W = this.scale.width;
    const H = this.scale.height;
    const w = Math.min(150 * this.d, W / (jumlah + 1.4), H * 0.22);
    return { x: W / 2, y: H * 0.44, w };
  }

  /**
   * Kartu pungutan dipamerkan besar di tengah layar dulu (supaya semua tahu apa yang diambil),
   * lalu terbang ke pemain yang mungut.
   */
  pamerLaluTerbang(daftar: { kartu: Kartu; dari?: Titik }[], ke: Titik | undefined, tahan = 1100): Promise<void> {
    if (!daftar.length || !this.sys.isActive() || document.hidden) return Promise.resolve();
    const pg = this.panggung(daftar.length);
    const imgs = daftar.map(({ kartu, dari }, i) => {
      const asal = dari ?? this.titik.buangan ?? { ...pg, w: pg.w / 2 };
      const img = this.add.image(asal.x, asal.y, kunciMuka(kartu.bunga, kartu.rank)).setOrigin(0.5);
      img.setDisplaySize(asal.w, asal.w * RASIO_KARTU);
      this.lapisan.add(img);
      const skalaBesar = (pg.w / asal.w) * img.scaleX;
      this.tweens.add({
        targets: img,
        x: pg.x + (i - (daftar.length - 1) / 2) * pg.w * 1.12,
        y: pg.y,
        scaleX: skalaBesar,
        scaleY: skalaBesar,
        duration: 320,
        delay: i * 90,
        ease: 'Back.easeOut',
      });
      return img;
    });
    return new Promise((resolve) => {
      let selesai = false;
      const ok = () => {
        if (selesai) return;
        selesai = true;
        imgs.forEach((img) => img.active && img.destroy());
        resolve();
      };
      const muncul = 320 + daftar.length * 90;
      // Cadangan kalau frame animasi tertahan.
      setTimeout(ok, muncul + tahan + 450 + daftar.length * 80 + 500);
      setTimeout(() => {
        if (selesai) return;
        if (!ke) return ok();
        imgs.forEach((img, i) => {
          const skalaKecil = (ke.w / pg.w) * img.scaleX;
          this.tweens.add({
            targets: img,
            x: ke.x,
            y: ke.y,
            scaleX: skalaKecil,
            scaleY: skalaKecil,
            duration: 420,
            delay: i * 80,
            ease: 'Cubic.easeIn',
            onComplete: i === imgs.length - 1 ? ok : undefined,
          });
        });
      }, muncul + tahan);
    });
  }

  /**
   * Pentungan: kartu dibuang tertutup ke tengah meja, jeda tegang, lalu dibuka dan nilainya muncul.
   * `saatDibuka` dipanggil tepat ketika kartu terbalik (untuk bunyi).
   */
  pentung(kartu: Kartu, dari: Titik | undefined, nilai: number, merah: boolean, saatDibuka?: () => void): Promise<void> {
    if (!this.sys.isActive() || document.hidden) {
      saatDibuka?.();
      return Promise.resolve();
    }
    const d = this.d;
    const pg = this.panggung(1);
    const w = pg.w * 1.25;
    const asal = dari ?? { x: pg.x, y: this.scale.height, w: w / 2 };
    const img = this.add.image(asal.x, asal.y, KUNCI_PUNGGUNG).setOrigin(0.5);
    img.setDisplaySize(asal.w, asal.w * RASIO_KARTU);
    this.lapisan.add(img);
    const skalaBesar = (w / asal.w) * img.scaleX;
    const label = this.add
      .text(pg.x, pg.y + (w * RASIO_KARTU) / 2 + 14 * d, `+${nilai}`, {
        fontFamily: FONT,
        fontSize: `${Math.round(54 * d)}px`,
        fontStyle: 'bold italic',
        color: merah ? '#ff5a4f' : '#ffd54a',
        stroke: '#000000',
        strokeThickness: 6 * d,
      })
      .setOrigin(0.5, 0)
      .setScale(0)
      .setAlpha(0);
    this.lapisan.add(label);
    let dibuka = false;
    const buka = () => {
      if (dibuka) return;
      dibuka = true;
      saatDibuka?.();
    };
    return new Promise((resolve) => {
      let selesai = false;
      const ok = () => {
        if (selesai) return;
        selesai = true;
        buka();
        [img, label].forEach((o) => o.active && o.destroy());
        resolve();
      };
      setTimeout(ok, 4800);
      // 1. Dibuang tertutup ke tengah meja.
      this.tweens.add({
        targets: img,
        x: pg.x,
        y: pg.y,
        scaleX: skalaBesar,
        scaleY: skalaBesar,
        angle: { from: -25, to: -4 },
        duration: 480,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          // 2. Tegang sebentar: kartu bergetar.
          this.tweens.add({
            targets: img,
            angle: 4,
            duration: 90,
            yoyo: true,
            repeat: 4,
            onComplete: () => {
              // 3. Dibalik: lebar ke nol, ganti muka, lebar kembali.
              this.tweens.add({
                targets: img,
                scaleX: 0,
                angle: 0,
                duration: 150,
                ease: 'Sine.easeIn',
                onComplete: () => {
                  img.setTexture(kunciMuka(kartu.bunga, kartu.rank));
                  img.setDisplaySize(w, w * RASIO_KARTU);
                  const sy = img.scaleY;
                  img.scaleX = 0;
                  buka();
                  this.tweens.add({ targets: img, scaleX: sy, duration: 170, ease: 'Back.easeOut' });
                  // 4. Nilai pentungan muncul.
                  this.tweens.add({
                    targets: label,
                    scale: 1,
                    alpha: 1,
                    duration: 300,
                    delay: 120,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                      // 5. Tahan sebentar, lalu ke buangan.
                      setTimeout(() => {
                        if (selesai) return;
                        const ke = this.titik.buangan ?? pg;
                        this.tweens.add({ targets: label, alpha: 0, duration: 250 });
                        this.tweens.add({
                          targets: img,
                          x: ke.x,
                          y: ke.y,
                          scaleX: (ke.w / w) * sy,
                          scaleY: (ke.w / w) * sy,
                          duration: 380,
                          ease: 'Cubic.easeIn',
                          onComplete: ok,
                        });
                      }, 1100);
                    },
                  });
                },
              });
            },
          });
        },
      });
    });
  }

  get posisiDeck() {
    return this.titik.deck;
  }

  get posisiBuangan() {
    return this.titik.buangan;
  }

  /** Kartu terbang dari satu titik ke titik lain. `kartu` null = punggung kartu. */
  terbang(
    kartu: Kartu | null,
    dari: Titik | undefined,
    ke: Titik | undefined,
    opsi: { durasi?: number; jeda?: number; besar?: boolean } = {},
  ): Promise<void> {
    if (!dari || !ke || !this.sys.isActive() || document.hidden) return Promise.resolve();
    const durasi = opsi.durasi ?? 420;
    const img = this.add.image(dari.x, dari.y, kartu ? kunciMuka(kartu.bunga, kartu.rank) : KUNCI_PUNGGUNG).setOrigin(0.5);
    img.setDisplaySize(dari.w, dari.w * RASIO_KARTU);
    img.setAlpha(0);
    this.lapisan.add(img);
    const skalaAkhir = (ke.w / dari.w) * img.scaleX;
    return new Promise((resolve) => {
      // Cadangan: kalau frame animasi tertahan (aplikasi di latar belakang), jangan sampai antrian macet.
      let selesai = false;
      const ok = () => {
        if (selesai) return;
        selesai = true;
        if (img.active) img.destroy();
        resolve();
      };
      setTimeout(ok, (opsi.jeda ?? 0) + durasi + (opsi.besar ? 900 : 300));
      this.tweens.add({
        targets: img,
        delay: opsi.jeda ?? 0,
        x: ke.x,
        y: ke.y,
        scaleX: skalaAkhir,
        scaleY: skalaAkhir,
        angle: { from: -10, to: 0 },
        duration: durasi,
        ease: 'Cubic.easeOut',
        onStart: () => img.setAlpha(1),
        onComplete: () => {
          if (!opsi.besar) return ok();
          // Kartu yang dibuang membesar sebentar supaya semua sempat melihatnya.
          this.tweens.add({
            targets: img,
            scaleX: skalaAkhir * 1.6,
            scaleY: skalaAkhir * 1.6,
            duration: 160,
            yoyo: true,
            hold: 420,
            ease: 'Back.easeOut',
            onComplete: ok,
          });
        },
      });
    });
  }

  gambar() {
    for (const o of [...this.children.list]) if (o !== this.lapisan) o.destroy();
    this.titik.panel.clear();
    this.titik.kartu.clear();
    const m = this.model;
    if (!m || !m.view.putaran) return;
    this.d = window.devicePixelRatio || 1;
    const d = this.d;
    const W = this.scale.width;
    const H = this.scale.height;
    const v = m.view;
    const p = v.putaran!;
    const saya = v.saya ?? 0;
    const n = v.pemain.length;
    const atas = (this.ruangAtas + 4) * d;
    const bawah = H - this.ruangBawah * d;
    const lanskap = W > H * 1.15;

    // ---- ukuran kartu tangan: dikecilkan sampai semua muat ----
    const lawan = Array.from({ length: n - 1 }, (_, i) => (saya + 1 + i) % n);
    const kolomLawan = lanskap ? Math.min(lawan.length, 3) : lawan.length > 3 && W > 560 * d ? 2 : 1;
    const barisLawan = Math.ceil(lawan.length / kolomLawan);
    let cw = lanskap ? Math.min(110 * d, H / 6.2) : Math.min(110 * d, W / 5.6);
    let tata = this.hitungTata(cw, W, m, barisLawan, lanskap);
    while (cw > 40 * d && tata.total > bawah - atas) {
      cw -= 3 * d;
      tata = this.hitungTata(cw, W, m, barisLawan, lanskap);
    }
    const ch = cw * RASIO_KARTU;
    const pad = 8 * d;
    const sela = Math.max(0, bawah - atas - tata.total);
    let y = atas;

    // ---- lawan ----
    const lebarPanel = (W - pad * (kolomLawan + 1)) / kolomLawan;
    lawan.forEach((pi, idx) => {
      const kol = idx % kolomLawan;
      const bar = Math.floor(idx / kolomLawan);
      const px = pad + kol * (lebarPanel + pad);
      const py = y + bar * (tata.tinggiLawan + 6 * d);
      this.gambarLawan(pi, px, py, lebarPanel, tata.tinggiLawan, tata.miniLawan, m);
    });
    y += barisLawan * (tata.tinggiLawan + 6 * d) + 4 * d;

    // ---- tengah: deck, joker, buangan (di tengah ruang kosong) ----
    // Lanskap: susunan mulung di sebelah kanan baris tengah supaya tidak menumpuk.
    const yTengah = y + sela * 0.45;
    const lebarTengah = lanskap && m.mulung ? W * 0.5 : W - 2 * pad;
    this.gambarTengah(pad, yTengah, lebarTengah - pad, cw, m);
    if (m.mulung && lanskap) this.gambarMulung(W * 0.5, yTengah, W * 0.5 - pad, cw, m);

    // ---- kelompok bawah: mulung, kartu jadi saya, tangan (menempel ke bawah) ----
    y = Math.max(yTengah + tata.tinggiTengah, bawah - tata.tinggiTangan - tata.tinggiJadiSaya - tata.tinggiMulung);
    if (m.mulung && !lanskap) {
      this.gambarMulung(pad, y, W - 2 * pad, cw, m);
      y += tata.tinggiMulung;
    }
    const milikSaya = p.kartuJadi[saya];
    const giliranSaya =
      v.status === 'susunAkhir' ? !p.selesaiSusun[saya] : p.giliran === saya && v.status === 'putaranBerjalan';
    this.teks(pad, y, `${v.pemain[saya].nama} · ${v.skor[saya]}${giliranSaya ? '  ·  giliranmu' : ''}`, 13, giliranSaya ? '#f2c14e' : '#b8c4b4', giliranSaya);
    y += 18 * d;
    if (milikSaya.length) {
      y += this.gambarKartuJadi(milikSaya, pad, y, W - 2 * pad, cw * 0.62) + 6 * d;
    }
    this.gambarTangan(pad, Math.max(y, bawah - tata.tinggiTangan), W - 2 * pad, cw, ch, m);
  }

  private hitungTata(cw: number, W: number, m: ModelMeja, barisLawan: number, lanskap: boolean) {
    const d = this.d;
    const ch = cw * RASIO_KARTU;
    const miniLawan = Math.min(cw * (lanskap ? 0.42 : 0.46), 44 * d);
    const tinggiLawan = 20 * d + miniLawan * RASIO_KARTU + 8 * d;
    const tinggiTengah = ch * 0.78 + 26 * d;
    const tinggiMulung = m.mulung && !lanskap ? ch * 0.8 + 30 * d : 0;
    const p = m.view.putaran!;
    const milikSaya = p.kartuJadi[m.view.saya ?? 0];
    const tinggiJadiSaya = 18 * d + (milikSaya.length ? cw * 0.62 * RASIO_KARTU + 6 * d : 0);
    const { baris } = this.tataTangan(m.tangan.length, W - 16 * d, cw);
    const tinggiTangan = ch + (baris - 1) * ch * 0.62 + ch * 0.2;
    return {
      miniLawan,
      tinggiLawan,
      tinggiTengah,
      tinggiMulung,
      tinggiTangan,
      tinggiJadiSaya,
      total: barisLawan * (tinggiLawan + 6 * d) + 4 * d + tinggiTengah + tinggiMulung + tinggiJadiSaya + tinggiTangan,
    };
  }

  private gambarLawan(pi: number, x: number, y: number, w: number, h: number, mini: number, m: ModelMeja) {
    const d = this.d;
    const v = m.view;
    const p = v.putaran!;
    const k = m.info.kursi[pi];
    const susun = v.status === 'susunAkhir';
    const aktif = susun ? !p.selesaiSusun[pi] : p.giliran === pi && v.status === 'putaranBerjalan';
    this.panel(x, y, w, h, aktif);
    const status = (k?.jenis === 'bot' ? ' · bot' : k && !k.terhubung ? ' · terputus' : '') + (susun && p.selesaiSusun[pi] ? ' · selesai' : '');
    const jumlah = p.jumlahKartuTangan[pi];
    const teksNama = this.teks(x + 8 * d, y + 4 * d, `${v.pemain[pi].nama}`, 13, aktif ? '#f2c14e' : '#f3efe3', true);
    const bahaya = jumlah === 1 && v.status === 'putaranBerjalan';
    const kanan = this.teks(
      x + w - 8 * d,
      y + 4 * d,
      `${bahaya ? 'TINGGAL 1!' : `${jumlah} kartu`} · ${v.skor[pi]}${status}`,
      12,
      bahaya ? '#ff8a7f' : '#b8c4b4',
      bahaya,
    );
    kanan.setOrigin(1, 0);
    // Aksi terakhir (sebentar), misalnya "buang 7♥" atau "mungut 2".
    const aksiTerakhir = m.aksiTerakhir[pi] ?? (m.info.botMikir === pi ? 'lagi mikir…' : undefined);
    if (aksiTerakhir) {
      const t = this.teks(teksNama.x + teksNama.width + 8 * d, y + 5 * d, aksiTerakhir, 12, '#ffd54a', true);
      const ruang = kanan.x - kanan.width - t.x - 6 * d;
      if (ruang < t.width) t.setCrop(0, 0, Math.max(0, ruang), t.height);
    }
    if (bahaya) {
      // Tanda bahaya: lawan ini tinggal satu kartu, siap mentung kalau bisa mulung.
      const g = this.add.graphics();
      g.lineStyle(3 * d, 0xff5a4f, 1);
      g.strokeRoundedRect(x, y, w, h, 10 * d);
      this.tweens.add({ targets: g, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });
    }
    this.titik.panel.set(pi, { x: x + 40 * d, y: y + h / 2, w: mini });
    if (pi === p.pengocok) this.teks(x + 8 * d, y + h - 15 * d, 'pengocok', 10, '#b8c4b4');
    // Tangan lawan terlihat setelah putaran selesai.
    const tangan = p.tangan[pi];
    const daftar = p.kartuJadi[pi];
    const lebarIsi = w - 16 * d - (pi === p.pengocok ? 46 * d : 0);
    if (tangan && v.status !== 'putaranBerjalan' && !susun) {
      const kartuTangan: KartuJadi = { id: 'tangan', pemilik: pi, jenis: 'seri', kartu: tangan.map((kt) => ({ kartu: kt, sebagai: kt, pengganti: false })) };
      this.gambarKartuJadi([...daftar, ...(tangan.length ? [kartuTangan] : [])], x + 8 * d + (pi === p.pengocok ? 46 * d : 0), y + 20 * d, lebarIsi, mini);
    } else if (daftar.length) {
      this.gambarKartuJadi(daftar, x + 8 * d + (pi === p.pengocok ? 46 * d : 0), y + 20 * d, lebarIsi, mini);
    } else {
      this.teks(x + 8 * d + (pi === p.pengocok ? 46 * d : 0), y + 24 * d, 'belum ada kartu jadi', 11, '#7f8f80');
    }
  }

  private gambarTengah(x: number, y: number, w: number, cw: number, m: ModelMeja) {
    const d = this.d;
    const v = m.view;
    const p = v.putaran!;
    const n = v.pemain.length;
    const cwT = cw * 0.78;
    const chT = cwT * RASIO_KARTU;

    // Deck
    const deck = this.kartu(x, y, cwT, null);
    const bisaAmbil = v.status === 'putaranBerjalan' && p.giliran === v.saya && p.tahap === 'ambil' && !m.mulung;
    if (bisaAmbil) {
      deck.setInteractive({ useHandCursor: true }).on('pointerup', () => this.aksi?.ketukDeck());
      const g = this.bingkai(x, y, cwT, chT, EMAS, 3);
      this.tweens.add({ targets: g, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    }
    const labelDeck = this.teks(x + cwT / 2, y + chT + 3 * d, bisaAmbil ? 'ketuk = ambil' : `deck ${p.jumlahDeck}`, 11, bisaAmbil ? '#f2c14e' : '#b8c4b4', bisaAmbil);
    // Jangan sampai terpotong di tepi kiri layar.
    labelDeck.setOrigin(0.5, 0).setX(Math.max(labelDeck.width / 2 + 2 * d, x + cwT / 2));
    this.titik.deck = { x: x + cwT / 2, y: y + chT / 2, w: cwT };

    // Angka joker sengaja tidak ditampilkan: hanya diumumkan sekali di awal putaran.

    // Arah dan giliran
    const panah = p.arah === 1 ? '↻ searah' : '↺ berbalik';
    const nama = v.pemain[p.giliran]?.nama ?? '';
    const tx = x + cwT + 14 * d;
    this.teks(tx, y + 2 * d, panah, 12, '#b8c4b4');
    if (v.status === 'susunAkhir') {
      this.teks(tx, y + 18 * d, p.mentung ? 'Mentung!' : 'Deck habis', 12, '#f2c14e', true);
      this.teks(tx, y + 34 * d, 'Susun akhir', 11, '#f2c14e');
    } else if (v.status === 'putaranBerjalan') {
      this.teks(tx, y + 18 * d, p.giliran === v.saya ? 'Giliranmu' : `Giliran ${nama.slice(0, 9)}`, 12, '#f3efe3', true);
    }
    if (v.status !== 'susunAkhir') this.teks(tx, y + 34 * d, `Putaran ${p.nomor}`, 11, '#7f8f80');

    // Buangan: kartu teratas sebanyak (n − 1), dengan nama pembuangnya.
    const bx = tx + 112 * d;
    const sisaLebar = x + w - bx;
    const tampil = p.buangan.slice(-Math.max(1, n - 1)).filter((e) => !m.disembunyikan.has(e.kartu.id));
    const lebih = p.jumlahBuangan - tampil.length;
    const maks = maksimalMulung(n, p.buangan.length);
    const langkah = Math.min(cwT * 0.86, (sisaLebar - cwT) / Math.max(1, tampil.length - 1 + (lebih ? 0.6 : 0)));
    let cx = bx;
    if (lebih) {
      this.kartu(cx, y, cwT * 0.8, null).setAlpha(0.5);
      this.teks(cx + cwT * 0.4, y + chT * 0.4, `+${lebih}`, 12, '#f3efe3', true).setOrigin(0.5, 0.5);
      cx += langkah * 0.6;
    }
    if (!p.buangan.length) this.teks(bx, y + chT * 0.4, 'buangan kosong', 12, '#7f8f80');
    const kxAtas = cx + Math.max(0, tampil.length - 1) * langkah;
    this.titik.buangan = { x: kxAtas + cwT / 2, y: y + chT / 2, w: cwT };
    tampil.forEach((e: EntriBuangan, i) => {
      const dariAtas = tampil.length - i; // 1 = teratas
      const kx = cx + i * langkah;
      this.titik.kartu.set(e.kartu.id, { x: kx + cwT / 2, y: y + chT / 2, w: cwT });
      const img = this.kartu(kx, y, cwT, e.kartu);
      const bisa = (m.pilihJumlahMulung || m.bisaPungut) && dariAtas <= maks;
      const dipungut = m.mulung && dariAtas <= m.mulung.jumlah;
      if (dipungut) img.setAlpha(0.35);
      if (bisa) {
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.aksi?.ketukBuangan(dariAtas));
        this.bingkai(kx, y, cwT, chT, EMAS, 2);
      }
      // Nama pembuang dipotong supaya tidak menabrak label kartu sebelahnya.
      const muat = Math.max(3, Math.floor((i === tampil.length - 1 ? cwT : langkah) / (6.2 * d)));
      const nama = v.pemain[e.pemilik]?.nama ?? '';
      this.teks(kx + 1 * d, y + chT + 3 * d, nama.length > muat ? `${nama.slice(0, muat - 1)}…` : nama, 10, '#b8c4b4');
    });
    if (m.pilihJumlahMulung || m.bisaPungut) {
      this.teks(bx, y - 2 * d, `ketuk kartu = mungut s/d kartu itu (maks ${maks})`, 10, '#f2c14e').setOrigin(0, 1);
    } else if (m.kartukuDiAtas && tampil.length) {
      // Kartu teratas milikku dan lawan sedang menimbang: berdenyut merah.
      const atas = this.titik.buangan!;
      const g = this.add.graphics();
      g.lineStyle(4 * d, 0xff5a4f, 1);
      g.strokeRoundedRect(atas.x - cwT / 2 - 3 * d, y - 3 * d, cwT + 6 * d, chT + 6 * d, 8 * d);
      this.tweens.add({ targets: g, alpha: 0.15, duration: 470, yoyo: true, repeat: -1 });
      const t = this.teks(bx, y - 2 * d, 'KARTUMU DI ATAS!', 11, '#ff8a7f', true).setOrigin(0, 1);
      this.tweens.add({ targets: t, alpha: 0.35, duration: 470, yoyo: true, repeat: -1 });
    } else if (m.berikutnya) {
      this.teks(bx, y - 2 * d, `berikutnya: ${m.berikutnya}`, 10, '#7fd0ff', true).setOrigin(0, 1);
    }
    // Area lepas untuk kartu yang diseret ke buangan.
    this.areaBuangan = { x: bx - 10 * d, y: y - 20 * d, w: Math.max(x + w - bx, cwT) + 20 * d, h: chT + 40 * d };
  }

  private gambarMulung(x: number, y: number, w: number, cw: number, m: ModelMeja) {
    const d = this.d;
    const mu = m.mulung!;
    const k = cw * 0.8;
    this.teks(x, y, `Pungutan (${mu.jumlah}) · kartu bertanda emas wajib dijadikan`, 12, '#f2c14e', true);
    let cx = x;
    const ky = y + 18 * d;
    for (const kt of mu.sisaPungutan) {
      const img = this.kartu(cx, ky, k, kt);
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.aksi?.ketukKartu(kt.id));
      const naik = m.dipilih.has(kt.id);
      if (naik) img.y -= 8 * d;
      if (kt.id === mu.idPaling) this.bingkai(cx, img.y, k, k * RASIO_KARTU, EMAS, 3);
      else if (naik) this.bingkai(cx, img.y, k, k * RASIO_KARTU, 0x5fb3f9, 3);
      cx += k + 4 * d;
    }
    // Kombinasi yang sudah disusun (ketuk untuk membatalkan).
    cx += 8 * d;
    mu.kombinasi.forEach((kb, i) => {
      const mini = k * 0.7;
      const awal = cx;
      kb.kartu.forEach(({ kartu, label }, j) => {
        const img = this.kartu(cx + j * mini * 0.6, ky, mini, kartu);
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.aksi?.ketukKombinasi(i));
        if (label) {
          const t = this.teks(cx + j * mini * 0.6 + 2 * d, ky + mini * RASIO_KARTU * 0.75, label, 10, '#1d1600', true);
          t.setBackgroundColor('#f2c14e');
        }
      });
      const lebar = (kb.kartu.length - 1) * mini * 0.6 + mini;
      this.bingkai(awal, ky, lebar, mini * RASIO_KARTU, 0x8be28b, 2);
      cx += lebar + 10 * d;
    });
    if (cx > x + w) {
      // Terlalu panjang: tidak masalah, kartu tetap bisa diketuk; beri tanda.
      this.teks(x + w, y, '…', 14, '#f3efe3').setOrigin(1, 0);
    }
  }

  private tataTangan(jumlah: number, lebar: number, cw: number) {
    const langkahMaks = cw * 0.92;
    const langkahMin = cw * 0.5;
    const perBarisMaks = Math.max(1, Math.floor((lebar - cw) / langkahMin) + 1);
    const baris = Math.max(1, Math.ceil(jumlah / perBarisMaks));
    const perBaris = Math.ceil(jumlah / baris);
    const langkah = perBaris > 1 ? Math.min(langkahMaks, (lebar - cw) / (perBaris - 1)) : 0;
    return { baris, perBaris, langkah };
  }

  private gambarTangan(x: number, y: number, w: number, cw: number, ch: number, m: ModelMeja) {
    const d = this.d;
    const tangan = m.tangan;
    const { perBaris, langkah } = this.tataTangan(tangan.length, w, cw);
    const angkat = ch * 0.18;
    const yDasar = y + angkat;
    const posisi: { x: number; y: number }[] = [];
    tangan.forEach((_, i) => {
      const b = Math.floor(i / perBaris);
      const kol = i % perBaris;
      const jumlahBaris = Math.min(perBaris, tangan.length - b * perBaris);
      const lebarBaris = (jumlahBaris - 1) * langkah + cw;
      posisi.push({ x: x + (w - lebarBaris) / 2 + kol * langkah, y: yDasar + b * ch * 0.62 });
    });
    this.titik.tangan = { x: x + w / 2, y: yDasar + ch / 2, w: cw };

    tangan.forEach((kt, i) => {
      const dipilih = m.dipilih.has(kt.id);
      const pos = posisi[i];
      const img = this.kartu(pos.x, pos.y - (dipilih ? angkat : 0), cw, kt);
      this.titik.kartu.set(kt.id, { x: img.x + cw / 2, y: img.y + ch / 2, w: cw });
      img.setInteractive({ useHandCursor: true, draggable: true });
      img.setName(namaKartu(kt));
      let awalX = 0;
      let awalY = 0;
      let digeser = false;
      img.on('dragstart', (ptr: Phaser.Input.Pointer) => {
        awalX = ptr.x;
        awalY = ptr.y;
        digeser = false;
        img.setDepth(10);
      });
      img.on('drag', (ptr: Phaser.Input.Pointer, dx: number, dy: number) => {
        if (!digeser && Math.hypot(ptr.x - awalX, ptr.y - awalY) < 12 * d) return;
        digeser = true;
        img.x = dx;
        img.y = dy;
      });
      img.on('dragend', () => {
        if (!digeser) {
          this.aksi?.ketukKartu(kt.id);
          return;
        }
        // Dilepas di atas tumpukan buangan = buang kartu itu.
        const a = this.areaBuangan;
        const tx = img.x + cw / 2;
        const ty = img.y + ch / 2;
        if (a && tx >= a.x && tx <= a.x + a.w && ty >= a.y && ty <= a.y + a.h) {
          this.aksi?.lepasKeBuangan(kt.id);
          return;
        }
        // Cari slot terdekat dari posisi lepas.
        let terdekat = i;
        let jarak = Infinity;
        posisi.forEach((p, j) => {
          const jj = Math.hypot(p.x - img.x, p.y - img.y);
          if (jj < jarak) {
            jarak = jj;
            terdekat = j;
          }
        });
        this.aksi?.geserKartu(kt.id, terdekat);
      });
      if (dipilih) this.bingkai(img.x, img.y, cw, ch, 0x5fb3f9, 3);
    });
    if (!tangan.length) {
      this.teks(x + w / 2, y + ch / 2, m.view.status === 'putaranBerjalan' ? '' : 'tangan kosong', 13, '#b8c4b4').setOrigin(0.5);
    }
  }
}
