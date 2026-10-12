// Mengubah peristiwa dari mesin aturan menjadi sesuatu yang terasa: kartu terbang, teks aksi
// di panel pemain, suara, getar, dan sorakan besar.

import { namaKartu, namaRank, type Bunga, type Kartu, type Peristiwa } from '@remi/engine';
import type { MejaScene } from '../game/MejaScene';
import { toast } from '../ui/dom';
import { bunyi, getar } from './suara';
import { sorak } from './sorak';

const SIMBOL: Record<Bunga, string> = { love: '♥', wajik: '♦', waru: '♠', kriting: '♣' };

export const labelKartu = (k: Kartu) => `${namaRank(k.rank)}${SIMBOL[k.bunga]}`;

const SEBUTAN_PENTUNG: Record<number, string> = {
  2: 'DOUBLE PENTUNG!',
  3: 'TRIPLE PENTUNG!',
  4: 'QUADRA PENTUNG!',
  5: 'PENTUNG MASSAL!',
};

export interface KonteksPemutar {
  scene: MejaScene;
  nama(pemain: number): string;
  saya(): number;
  catatAksi(pemain: number, teks: string): void;
  /** Sembunyikan kartu dari tangan/buangan selama dianimasikan. */
  sembunyikan(ids: string[]): void;
}

export class PemutarPeristiwa {
  /** Sorakan "tinggal 1 kartu" cukup sekali per pemain per putaran. */
  private sudahTinggalSatu = new Set<string>();

  constructor(private readonly k: KonteksPemutar) {}

  /** Putar satu peristiwa. `cepat` dipakai saat antrian menumpuk (misalnya habis sambung ulang). */
  async putar(e: Peristiwa, cepat: boolean, berikut?: Peristiwa): Promise<void> {
    const { scene } = this.k;
    const saya = this.k.saya();
    const durasi = cepat ? 140 : 400;
    const nama = (i: number) => (i === saya ? 'Kamu' : this.k.nama(i));

    switch (e.jenis) {
      case 'mulaiPutaran':
        // Joker diumumkan lewat popup (sekali), bukan sorakan.
        this.sudahTinggalSatu.clear();
        return;

      case 'ambilDeck':
        bunyi('kartu');
        this.k.catatAksi(e.pemain, 'ambil deck');
        await scene.terbang(null, scene.posisiDeck, scene.posisiPemain(e.pemain), { durasi });
        return;

      case 'mulung': {
        bunyi('mulung');
        this.k.catatAksi(e.pemain, `mungut ${e.kartu.map((x) => labelKartu(x.kartu)).join(' ')}`);
        // Kartu pungutan dipamerkan besar dulu, baru pindah ke pemain yang mungut.
        const daftar = e.kartu.map((x) => ({ kartu: x.kartu, dari: scene.posisiKartu(x.kartu.id) ?? scene.posisiBuangan }));
        this.k.sembunyikan(e.kartu.map((x) => x.kartu.id));
        if (cepat) {
          await Promise.all(daftar.map((x, i) => scene.terbang(x.kartu, x.dari, scene.posisiPemain(e.pemain), { durasi, jeda: i * 60 })));
        } else {
          await scene.pamerLaluTerbang(daftar, scene.posisiPemain(e.pemain), 900 + 250 * daftar.length);
        }
        if (e.pemain !== saya) {
          const punyaku = e.kartu.filter((x) => x.pemilik === saya).map((x) => labelKartu(x.kartu));
          if (punyaku.length) {
            bunyi('bahaya');
            getar([90, 50, 90]);
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

      case 'turunkan':
        bunyi('kartu');
        this.k.catatAksi(e.pemain, 'turun kartu jadi');
        if (e.kembarAs) void this.heboh({ judul: 'KEMBAR AS!', sub: `${nama(e.pemain)} nurunin 4 As`, gaya: 'emas' });
        return;

      case 'buang': {
        // Kalau ini pentungan, animasinya diurus peristiwa 'mentung' (dibuang tertutup lalu dibuka).
        if (berikut?.jenis === 'mentung') return;
        bunyi('buang');
        this.k.catatAksi(e.pemain, `buang ${labelKartu(e.kartu)}`);
        const dari = (e.pemain === saya ? scene.posisiKartu(e.kartu.id) : undefined) ?? scene.posisiPemain(e.pemain);
        this.k.sembunyikan([e.kartu.id]);
        await scene.terbang(e.kartu, dari, scene.posisiBuangan, { durasi, besar: !cepat });
        if (e.jokerDibuang) {
          bunyi('joker');
          void sorak({ judul: 'JOKER DIBUANG?!', sub: `${nama(e.pemain)} buang ${namaKartu(e.kartu)} · −25`, gaya: 'bahaya', durasi: 1400 });
        }
        const kunci = `${e.putaran}:${e.pemain}`;
        if (e.sisaTangan === 1 && e.pemain !== saya && !this.sudahTinggalSatu.has(kunci)) {
          this.sudahTinggalSatu.add(kunci);
          bunyi('bahaya');
          void sorak({ judul: 'TINGGAL 1 KARTU!', sub: `Awas, ${this.k.nama(e.pemain)} siap mentung`, gaya: 'bahaya', durasi: 1400 });
        }
        return;
      }

      case 'mentung': {
        this.k.catatAksi(e.pemain, 'MENTUNG!');
        const dari = (e.pemain === saya ? scene.posisiKartu(e.pentungan.id) : undefined) ?? scene.posisiPemain(e.pemain);
        this.k.sembunyikan([e.pentungan.id]);
        // Pentungan dibuang tertutup, tegang sebentar, lalu dibuka: baru ketahuan nilainya.
        bunyi('tegang');
        await scene.pentung(e.pentungan, dari, e.nilai, e.pentunganJoker, () => {
          bunyi('mentung');
          document.body.classList.add('goyang');
          setTimeout(() => document.body.classList.remove('goyang'), 500);
          if (e.pemain === saya) getar([60, 40, 160]);
        });
        const urutan: Promise<void>[] = [
          sorak({
            judul: e.pentunganJoker ? 'PENTUNG JOKER!' : 'MENTUNG!',
            sub: `${nama(e.pemain)} nutup pakai ${namaKartu(e.pentungan)} · ${e.nilai}`,
            gaya: e.pentunganJoker ? 'merah' : 'emas',
            durasi: 1900,
          }),
        ];
        const sebutan = SEBUTAN_PENTUNG[Math.min(e.kepentung.length, 5)];
        if (sebutan) {
          urutan.push(sorak({ judul: sebutan, sub: e.kepentung.map(nama).join(', '), gaya: 'merah', durasi: 1600 }));
        }
        if (e.kepentung.includes(saya)) {
          urutan.push(
            sorak({ judul: 'KAMU KEPENTUNG!', sub: `−${e.nilai}`, gaya: 'merah', durasi: 1500 }).then(() => undefined),
          );
          setTimeout(() => {
            bunyi('kepentung');
            getar([220, 90, 220]);
          }, 1900);
        }
        if (e.dibalik) urutan.push(sorak({ judul: 'BALIK ARAH!', sub: 'Putaran berikutnya berbalik', gaya: 'biru', durasi: 1300 }));
        else if (e.kepentung.length) urutan.push(sorak({ judul: 'LOMPAT!', sub: 'Arah tetap', gaya: 'biru', durasi: 1300 }));
        await Promise.all(urutan);
        return;
      }

      case 'susunAkhir':
        bunyi('giliran');
        await sorak({
          judul: e.sebab === 'mentung' ? 'SUSUN KARTU!' : 'DECK HABIS!',
          sub: e.sebab === 'mentung' ? 'Turunkan kartu jadi terakhir sebelum dihitung' : 'Susun kartu jadi terakhirmu',
          gaya: 'biru',
          durasi: 1500,
        });
        return;

      case 'putaranSelesai':
        return;
    }
  }

  private heboh(s: Parameters<typeof sorak>[0]) {
    bunyi('sorak');
    return sorak({ durasi: 1500, ...s });
  }
}
