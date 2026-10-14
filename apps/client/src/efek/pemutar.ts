// Mengubah peristiwa dari mesin aturan menjadi sesuatu yang terasa: kartu dikocok dan dibagikan,
// kartu terbang, teks aksi di panel pemain, suara, getar, dan sorakan besar.
//
// Info rahasia: tidak pernah membaca angka joker (rankJoker/kartuDibuka); kartu yang dibagikan atau
// diambil lawan dari deck selalu tertutup; teks hanya menyebut kartu yang memang terbuka di peristiwa itu,
// dan teks aksi singkat untuk buang cukup "buang kartu" (keputusan pemilik #6).
// Durasi di sini durasi DASAR; scene menyesuaikannya dengan preferensi kecepatan/gerak.

import { namaKartu, namaRank, type Bunga, type Kartu, type Peristiwa, type ViewPemain } from '@remi/engine';
import type { MejaScene, Titik } from '../game/MejaScene';
import { bunyi, getar } from './suara';
import { sorak } from './sorak';

const SIMBOL: Record<Bunga, string> = { love: '♥', wajik: '♦', waru: '♠', kriting: '♣' };

export const labelKartu = (k: Kartu) => `${namaRank(k.rank)}${SIMBOL[k.bunga]}`;

export interface KonteksPemutar {
  scene: MejaScene;
  nama(pemain: number): string;
  saya(): number;
  catatAksi(pemain: number, teks: string): void;
  /** Sembunyikan kartu dari tangan/buangan/kartu jadi selama dianimasikan. */
  sembunyikan(ids: string[]): void;
  /** Tampakkan lagi kartu yang tadi disembunyikan. */
  tampakkan(ids: string[]): void;
  /** View yang sedang tampil, dan view sesudah kejadian ini (yang sedang diputar). */
  viewSekarang(): ViewPemain | null;
  viewBerikut(): ViewPemain | null;
  /**
   * Tampilkan view sesudah kejadian sekarang juga, dengan kartu tertentu disembunyikan,
   * supaya posisi tujuan (kartu jadi baru, tempat di tangan) sudah diketahui.
   */
  terapkanViewBerikut(sembunyi: string[]): void;
  /** Panel mentung: tunggu sampai pemain menekan Lanjut. */
  panelMentung(e: Extract<Peristiwa, { jenis: 'mentung' }>): Promise<void>;
}

export class PemutarPeristiwa {
  /** Sorakan "tinggal 1 kartu" cukup sekali per pemain per putaran. */
  private sudahTinggalSatu = new Set<string>();
  /** Timer milik pemutar (mis. goyang layar) yang dibatalkan hentikan(). */
  private timer = new Set<ReturnType<typeof setTimeout>>();
  private berhenti = false;

  constructor(private readonly k: KonteksPemutar) {}

  /**
   * Hentikan pemutar untuk selamanya: semua timer dibatalkan dan peristiwa yang sedang/akan diputar tidak
   * lagi menyentuh scene, DOM, atau konteks (kecuali `tampakkan` di blok finally kocok & bagi, yang aman
   * karena KontrolMeja mengabaikan render sesudah dihancurkan). Dipanggil KontrolMeja.hancurkan().
   */
  hentikan() {
    this.berhenti = true;
    this.timer.forEach((t) => clearTimeout(t));
    this.timer.clear();
    if (typeof document !== 'undefined') document.body?.classList.remove('goyang');
  }

  /** setTimeout yang ikut dibatalkan hentikan(), dan tidak jalan kalau pemutar sudah berhenti. */
  private nanti(fn: () => void, ms: number) {
    if (this.berhenti) return;
    const t = setTimeout(() => {
      this.timer.delete(t);
      if (!this.berhenti) fn();
    }, ms);
    this.timer.add(t);
  }

  /** Putar satu peristiwa. `cepat` dipakai saat antrian menumpuk (misalnya habis sambung ulang). */
  async putar(e: Peristiwa, cepat: boolean, berikut?: Peristiwa): Promise<void> {
    if (this.berhenti) return;
    const { scene } = this.k;
    const saya = this.k.saya();
    const durasi = cepat ? 140 : 420;
    const nama = (i: number) => (i === saya ? 'Kamu' : this.k.nama(i));

    switch (e.jenis) {
      case 'mulaiPutaran': {
        // Kocok & bagi kartu (tertutup), urutan bagi sama dengan engine (mulai dari pengocok, kursi naik).
        // Angka joker diumumkan lewat popup (sekali), bukan di sini.
        // Bisa diputar di view PERTAMA (putaran 1, scene baru dibuat): terapkanViewBerikut memasang model
        // dulu supaya posisi deck/slot tangan sudah dihitung sebelum bagiKartu membaca posisinya.
        this.sudahTinggalSatu.clear();
        const p = this.k.viewBerikut()?.putaran;
        if (cepat || !p || p.nomor !== e.putaran) return;
        const idTanganku = (p.tangan[saya] ?? []).map((x) => x.id);
        this.k.terapkanViewBerikut(idTanganku);
        try {
          await scene.bagiKartu({ pengocok: e.pengocok, jumlah: [...p.jumlahKartuTangan], idTanganku });
        } finally {
          // Apa pun yang terjadi, kartu tanganku tidak boleh tertinggal tersembunyi.
          this.k.tampakkan(idTanganku);
        }
        return;
      }

      case 'ambilDeck': {
        bunyi('kartu');
        this.k.catatAksi(e.pemain, 'ambil deck');
        // Kartu yang kuambil diperlihatkan dulu (hanya di layarku), lalu ditaruh di ujung tangan.
        if (e.pemain === saya && !cepat) {
          const lama = new Set((this.k.viewSekarang()?.putaran?.tangan[saya] ?? []).map((k) => k.id));
          const baru = this.k.viewBerikut()?.putaran?.tangan[saya]?.find((k) => !lama.has(k.id));
          if (baru) {
            const imgs = await scene.naikPanggung([{ kartu: baru, dari: scene.posisiDeck, tertutup: true }], 700);
            if (this.berhenti) return;
            this.k.terapkanViewBerikut([baru.id]);
            await scene.turunPanggung(imgs, [scene.posisiKartu(baru.id)]);
            this.k.tampakkan([baru.id]);
            return;
          }
        }
        // Kartu lawan tetap tertutup dan masuk ke panelnya.
        await scene.terbang(null, scene.posisiDeck, scene.posisiPemain(e.pemain), { durasi, hilang: e.pemain !== saya });
        return;
      }

      case 'mulung': {
        bunyi('mulung');
        this.k.catatAksi(e.pemain, `mungut ${e.kartu.map((x) => labelKartu(x.kartu)).join(' ')}`);
        const idPungut = e.kartu.map((x) => x.kartu.id);
        const daftar = e.kartu.map((x) => ({ kartu: x.kartu, dari: scene.posisiKartu(x.kartu.id) ?? scene.posisiBuangan }));
        // Kartu jadi baru (di view sesudahnya) dan kartu modal dari tangan yang ikut dipasang.
        const kjBaru = this.kartuJadiBaru(e.pemain, e.idKartuJadi);
        const modal = kjBaru.filter((d) => !idPungut.includes(d.kartu.id));
        const asalModal = modal.map((d) => this.asalDariTangan(e.pemain, d.kartu.id));
        this.k.sembunyikan(idPungut);
        // 1. Kartu pungutan dipamerkan besar di tengah supaya semua tahu apa yang diambil.
        const imgs = cepat ? [] : await scene.naikPanggung(daftar, 900 + 250 * daftar.length);
        if (this.berhenti) return;
        // 2. Tampilkan meja sesudahnya; kartu yang akan mendarat disembunyikan dulu.
        this.k.terapkanViewBerikut([...idPungut, ...kjBaru.map((d) => d.kartu.id)]);
        const tujuan = e.kartu.map((x) => scene.posisiKartu(x.kartu.id) ?? scene.posisiPemain(e.pemain));
        // 3. Kartu pungutan dan kartu modal mendarat bersama di kartu jadi; sisanya masuk tangan.
        await Promise.all([
          cepat
            ? Promise.all(daftar.map((x, i) => scene.terbang(x.kartu, x.dari, tujuan[i], { durasi, jeda: i * 60 })))
            : scene.turunPanggung(imgs, tujuan),
          ...modal.map((d, i) =>
            scene.terbang(d.kartu, asalModal[i], scene.posisiKartu(d.kartu.id), { durasi: cepat ? durasi : 520, jeda: cepat ? 0 : 150 + i * 90 }),
          ),
        ]);
        if (this.berhenti) return;
        this.k.tampakkan([...idPungut, ...kjBaru.map((d) => d.kartu.id)]);

        if (e.pemain !== saya) {
          const punyaku = e.kartu.filter((x) => x.pemilik === saya).map((x) => labelKartu(x.kartu));
          if (punyaku.length) {
            bunyi('bahaya');
            getar('bahaya');
            void sorak({
              judul: 'KARTUMU DIPUNGUT!',
              sub: `${this.k.nama(e.pemain)} mungut ${punyaku.join(', ')} punyamu`,
              gaya: 'merah',
              durasi: 1500,
            });
          }
        }
        if (e.kembarAs) void this.heboh({ judul: 'KEMBAR AS!', sub: `${nama(e.pemain)} nurunin 4 As`, gaya: 'emas' });
        if (e.sapuBersih) void this.heboh({ judul: 'SAPU BERSIH!', sub: `${nama(e.pemain)} mungut ${e.kartu.length} kartu`, gaya: 'emas' });
        if (e.beruntun >= 3) {
          void this.heboh({ judul: `MULUNG BERUNTUN ×${e.beruntun}!`, sub: `${nama(e.pemain)} mulung terus`, gaya: 'emas' });
        }
        return;
      }

      case 'turunkan': {
        this.k.catatAksi(e.pemain, 'turun kartu jadi');
        // Kartu dari tangan terbang ke tempatnya di kartu jadi, satu per satu.
        const kartu = this.kartuJadiBaru(e.pemain, e.idKartuJadi);
        const asal = kartu.map((d) => this.asalDariTangan(e.pemain, d.kartu.id));
        const ids = kartu.map((d) => d.kartu.id);
        this.k.terapkanViewBerikut(ids);
        await Promise.all(
          kartu.map((d, i) => scene.terbang(d.kartu, asal[i], scene.posisiKartu(d.kartu.id), { durasi: cepat ? durasi : 460, jeda: cepat ? 0 : i * 80 })),
        );
        if (this.berhenti) return;
        this.k.tampakkan(ids);
        if (e.kembarAs) void this.heboh({ judul: 'KEMBAR AS!', sub: `${nama(e.pemain)} nurunin 4 As`, gaya: 'emas' });
        return;
      }

      case 'buang': {
        // Kalau ini pentungan, animasinya diurus peristiwa 'mentung' (dibuang tertutup lalu dibuka).
        if (berikut?.jenis === 'mentung') return;
        bunyi('buang');
        // Keputusan pemilik (#6): teks aksi singkat tidak menyebut kartu yang dibuang. Kartunya tetap
        // terlihat di tumpukan buangan; mengingatnya urusan pemain (mode ingatan).
        this.k.catatAksi(e.pemain, 'buang kartu');
        const id = e.kartu.id;
        // Asal: titik lepas (kartu diseret ke buangan), kartu di tanganku, atau panel lawan.
        const dari = (e.pemain === saya ? (scene.posisiLepas(id) ?? scene.posisiKartu(id)) : undefined) ?? scene.posisiPemain(e.pemain);
        this.k.sembunyikan([id]);
        // Tujuan tepat: tempat kartu itu di tumpukan buangan sesudah kejadian.
        this.k.terapkanViewBerikut([id]);
        await scene.terbang(e.kartu, dari, scene.posisiKartu(id) ?? scene.posisiBuangan, { durasi, besar: !cepat });
        if (this.berhenti) return;
        this.k.tampakkan([id]);
        if (e.jokerDibuang) {
          // Peristiwa publik: jokernya sudah terbuka di buangan (bukan joker di tangan).
          bunyi('jokerDibuang');
          void sorak({ judul: 'JOKER DIBUANG?!', sub: `${nama(e.pemain)} buang ${namaKartu(e.kartu)} · −25`, gaya: 'bahaya', durasi: 1400 });
        }
        const kunci = `${e.putaran}:${e.pemain}`;
        if (e.sisaTangan === 1 && e.pemain !== saya && !this.sudahTinggalSatu.has(kunci)) {
          this.sudahTinggalSatu.add(kunci);
          bunyi('bahaya');
          void sorak({ judul: 'TINGGAL 1 KARTU!', sub: `${this.k.nama(e.pemain)} tinggal pegang satu kartu`, gaya: 'bahaya', durasi: 1400 });
        }
        return;
      }

      case 'mentung': {
        this.k.catatAksi(e.pemain, 'MENTUNG!');
        const id = e.pentungan.id;
        const dari = (e.pemain === saya ? (scene.posisiLepas(id) ?? scene.posisiKartu(id)) : undefined) ?? scene.posisiPemain(e.pemain);
        this.k.sembunyikan([id]);
        // Pentungan dibuang tertutup, tegang sebentar, lalu dibuka: baru ketahuan nilainya.
        // 'tegang' sama untuk pentungan apa pun; bunyi joker baru diputar saat kartunya sudah terbuka.
        bunyi('tegang');
        await scene.pentung(e.pentungan, dari, e.nilai, e.pentunganJoker, () => {
          if (this.berhenti) return;
          bunyi(e.pentunganJoker ? 'mentungJoker' : 'mentung');
          document.body.classList.add('goyang');
          // Cadangan bila hentikan() belum dipanggil saat lingkungan DOM dibongkar (test): jangan sentuh DOM yang hilang.
          this.nanti(() => typeof document !== 'undefined' && document.body?.classList.remove('goyang'), 500);
          if (e.pemain === saya) getar(e.pentunganJoker ? 'mentungJoker' : 'mentung');
        });
        if (this.berhenti) return;
        // Setelah itu panel mentung: tiap pemain langsung tahu kepentung atau tidak,
        // rinciannya dibuka kalau diklik. Permainan lanjut setelah ditekan Lanjut.
        await this.k.panelMentung(e);
        return;
      }

      case 'susunAkhir':
        bunyi('giliran');
        // Tidak di-await: sorakan lain yang masih antri tidak boleh menahan antrian peristiwa.
        void sorak({
          judul: e.sebab === 'mentung' ? 'SUSUN KARTU!' : 'DECK HABIS!',
          sub: e.sebab === 'mentung' ? 'Turunkan kartu jadi terakhir sebelum dihitung' : 'Susun kartu jadi terakhirmu',
          gaya: 'biru',
          durasi: 1500,
        });
        return;

      case 'putaranSelesai': {
        // Perubahan skor (angka publik) melayang dari panel tiap pemain.
        const v = this.k.viewBerikut();
        const riwayat = v?.riwayat ?? [];
        const akhir = riwayat[riwayat.length - 1]?.skorAkumulasi;
        if (!akhir || cepat) return;
        const sebelum = riwayat[riwayat.length - 2]?.skorAkumulasi ?? akhir.map(() => 0);
        await scene.skorMelayang(akhir.map((s, i) => s - (sebelum[i] ?? 0)));
        if (this.berhenti) return;
        if (v?.status === 'selesai') {
          const tertinggi = Math.max(...v.skor);
          await Promise.all(v.skor.map((s, i) => (s === tertinggi ? scene.rayakan(i) : Promise.resolve())));
        }
        return;
      }
    }
  }

  /** Kartu-kartu di kartu jadi baru milik `pemain` (diambil dari view sesudah kejadian). */
  private kartuJadiBaru(pemain: number, idKartuJadi: string[]) {
    const v = this.k.viewBerikut() ?? this.k.viewSekarang();
    return (v?.putaran?.kartuJadi[pemain] ?? []).filter((kj) => idKartuJadi.includes(kj.id)).flatMap((kj) => kj.kartu);
  }

  /** Asal kartu dari tangan: posisi kartunya di tanganku, atau panel lawan (tangannya tertutup). */
  private asalDariTangan(pemain: number, id: string): Titik | undefined {
    const { scene } = this.k;
    return (pemain === this.k.saya() ? scene.posisiKartu(id) : undefined) ?? scene.posisiPemain(pemain);
  }

  private heboh(s: Parameters<typeof sorak>[0]) {
    bunyi('sorak');
    return sorak({ durasi: 1500, ...s });
  }
}
