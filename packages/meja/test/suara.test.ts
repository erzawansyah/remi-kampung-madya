// Suara (0.9.0, keputusan pemilik 25 Nov 2026): meja hanya mencatat siapa yang ikut obrolan suara
// (per pemainId, bukan kursi) dan meneruskan sinyal WebRTC di antara anggota suara meja yang sama.
// Penonton tidak pernah ikut, tidak pernah dikirimi daftar anggota, dan tidak bisa mengirim sinyal.

import { describe, expect, it } from 'vitest';
import { dataMejaDipulihkan, Meja } from '../src/meja.js';
import {
  JENDELA_SINYAL_SUARA_MS,
  MAKS_SINYAL_SUARA,
  type DataSinyalSuara,
  type PengaturanMeja,
  type PesanServer,
} from '../src/protokol.js';
import { validasiPesan, validasiSinyalSuara } from '../src/validasi.js';
import { siapkan, siapSemua } from './bantu.js';

const SDP: DataSinyalSuara = { sdp: { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' } };

/** Meja 4 kursi di lobi: Ani (host), Budi, Cici, dan satu warga kedai. */
function mejaLobi(extra: Parameters<typeof siapkan>[0] = {}, pengaturan: Partial<PengaturanMeja> = {}) {
  const s = siapkan({ namaLawan: ['Warga A'], ...extra });
  const meja = Meja.buat(s.opsi, 'ani', 'Ani', { jumlahPemain: 4, publik: true, ...pengaturan });
  meja.masuk('budi', 'Budi');
  meja.masuk('cici', 'Cici');
  meja.terima('ani', { t: 'aturKursi', kursi: 3, jenis: 'bot' });
  s.surat.bersihkan();
  return { ...s, meja };
}

const suaraTerakhir = (surat: ReturnType<typeof siapkan>['surat'], id: string) => surat.terakhir(id, 'suara');
const sinyal = (surat: ReturnType<typeof siapkan>['surat'], id: string) =>
  surat.semua(id).filter((p): p is Extract<PesanServer, { t: 'suaraSinyal' }> => p.t === 'suaraSinyal');

describe('suara: anggota', () => {
  it('gabung memberi id, daftar anggota hanya berisi kursi + mic, disiarkan ke semua manusia terhubung', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    const a = suaraTerakhir(surat, 'ani')!;
    expect(a.saya).toBeGreaterThan(0);
    expect(a.anggota).toEqual([{ id: a.saya, kursi: 0, mic: false }]);
    // Yang belum ikut tetap tahu siapa yang ikut (ikon mic di kursinya), dengan saya = null.
    expect(suaraTerakhir(surat, 'budi')).toEqual({ t: 'suara', saya: null, anggota: a.anggota });
    meja.terima('budi', { t: 'suara', aksi: 'gabung', nyala: true });
    const b = suaraTerakhir(surat, 'budi')!;
    expect(b.anggota.map((x) => [x.kursi, x.mic])).toEqual([
      [0, false],
      [1, true],
    ]);
    // Tidak ada yang lain di pesannya (tanpa pemainId, nama, atau alamat).
    expect(Object.keys(b.anggota[0]!).sort()).toEqual(['id', 'kursi', 'mic']);
    expect(JSON.stringify(surat.semua('cici'))).not.toContain('"ani"');
  });

  it('mic dan jeda mengubah daftar; gabung ulang mempertahankan id', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    const id = suaraTerakhir(surat, 'ani')!.saya;
    meja.terima('ani', { t: 'suara', aksi: 'mic', nyala: true });
    expect(suaraTerakhir(surat, 'budi')!.anggota[0]).toEqual({ id, kursi: 0, mic: true });
    meja.terima('ani', { t: 'suara', aksi: 'jeda', nyala: true });
    expect(suaraTerakhir(surat, 'budi')!.anggota[0]).toEqual({ id, kursi: 0, mic: true, jeda: true });
    surat.bersihkan();
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    // Gabung ulang (sambung ulang singkat): id tetap, jeda lepas, pengirimnya selalu dikirimi.
    expect(suaraTerakhir(surat, 'ani')).toEqual({ t: 'suara', saya: id, anggota: [{ id, kursi: 0, mic: true }] });
  });

  it('daftar yang tidak berubah tidak disiarkan ulang; mic tanpa gabung diabaikan', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'mic', nyala: true });
    expect(surat.semua('budi').some((p) => p.t === 'suara')).toBe(false);
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    surat.bersihkan();
    // Perubahan meja lain (pengaturan) tidak mengirim ulang daftar suara.
    meja.terima('ani', { t: 'pengaturan', pengaturan: { detikGiliran: 90 } });
    expect(surat.semua('budi').some((p) => p.t === 'suara')).toBe(false);
  });

  it('terputus, keluar, atau kursinya diganti = keluar dari suara; daftar kosong ikut dikabarkan', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    meja.terima('cici', { t: 'suara', aksi: 'gabung' });
    meja.terputus('budi');
    expect(suaraTerakhir(surat, 'ani')!.anggota.map((a) => a.kursi)).toEqual([0, 2]);
    meja.terima('ani', { t: 'aturKursi', kursi: 2, jenis: 'bot' });
    expect(suaraTerakhir(surat, 'ani')!.anggota.map((a) => a.kursi)).toEqual([0]);
    meja.terima('ani', { t: 'suara', aksi: 'keluar' });
    expect(suaraTerakhir(surat, 'ani')).toEqual({ t: 'suara', saya: null, anggota: [] });
  });

  it('acak urutan duduk (#62): anggota ikut pindah kursi, id tetap', () => {
    const { meja, surat } = mejaLobi({ acakDuduk: () => 0 });
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    const sebelum = suaraTerakhir(surat, 'budi')!;
    meja.terima('ani', { t: 'mulai' });
    const sesudah = suaraTerakhir(surat, 'budi')!;
    const kursiBaru = (nama: string) => meja.data.kursi.findIndex((k) => k.nama === nama);
    expect(sesudah.saya).toBe(sebelum.saya);
    expect(sesudah.anggota).toEqual(
      sebelum.anggota
        .map((a) => ({ ...a, kursi: kursiBaru(a.kursi === 0 ? 'Ani' : 'Budi') }))
        .sort((x, y) => x.kursi - y.kursi),
    );
  });

  it('meja sprint tidak punya suara', () => {
    const s = siapkan();
    const meja = Meja.buatSprint(s.opsi, 'ani', 'Ani');
    s.surat.bersihkan();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    expect(s.surat.errors('ani').at(-1)).toMatch(/sprint/);
    expect(s.surat.semua('ani').some((p) => p.t === 'suara')).toBe(false);
  });
});

describe('suara: sinyal', () => {
  it('diteruskan hanya ke anggota tujuan, dengan id pengirim', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    const anggota = suaraTerakhir(surat, 'ani')!.anggota;
    const [idAni, idBudi] = anggota.map((a) => a.id);
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi!, data: SDP });
    expect(sinyal(surat, 'budi')).toEqual([{ t: 'suaraSinyal', dari: idAni, data: SDP }]);
    expect(sinyal(surat, 'ani')).toEqual([]);
    expect(sinyal(surat, 'cici')).toEqual([]);
  });

  it('bukan anggota, ke diri sendiri, ke id asing, atau ke anggota yang terputus = dibuang diam-diam', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    const [idAni, idBudi] = suaraTerakhir(surat, 'ani')!.anggota.map((a) => a.id);
    surat.bersihkan();
    meja.terima('cici', { t: 'suaraSinyal', ke: idAni!, data: SDP });
    meja.terima('ani', { t: 'suaraSinyal', ke: idAni!, data: SDP });
    meja.terima('ani', { t: 'suaraSinyal', ke: 999, data: SDP });
    meja.terputus('budi');
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi!, data: SDP });
    for (const id of ['ani', 'budi', 'cici']) expect(sinyal(surat, id)).toEqual([]);
    expect(surat.errors('ani')).toEqual([]);
  });

  it('tidak pernah ke meja lain', () => {
    const satu = mejaLobi({ kode: 'SATU1' });
    const s2 = siapkan({ kode: 'DUA22', kirim: satu.surat.kirim });
    const lain = Meja.buat(s2.opsi, 'dodi', 'Dodi', { jumlahPemain: 2 });
    lain.terima('dodi', { t: 'suara', aksi: 'gabung' });
    const idDodi = suaraTerakhir(satu.surat, 'dodi')!.saya!;
    satu.meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    satu.surat.bersihkan();
    satu.meja.terima('ani', { t: 'suaraSinyal', ke: idDodi, data: SDP });
    expect(sinyal(satu.surat, 'dodi')).toEqual([]);
  });

  it('dibatasi MAKS_SINYAL_SUARA per jendela waktu per pemain', () => {
    const { meja, surat, jam } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    const idBudi = suaraTerakhir(surat, 'ani')!.anggota[1]!.id;
    for (let i = 0; i < MAKS_SINYAL_SUARA + 10; i++) meja.terima('ani', { t: 'suaraSinyal', ke: idBudi, data: SDP });
    expect(sinyal(surat, 'budi')).toHaveLength(MAKS_SINYAL_SUARA);
    jam.maju(JENDELA_SINYAL_SUARA_MS);
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi, data: SDP });
    expect(sinyal(surat, 'budi')).toHaveLength(MAKS_SINYAL_SUARA + 1);
  });

  it('isi yang diteruskan disalin bersih (field asing dibuang)', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    const idBudi = suaraTerakhir(surat, 'ani')!.anggota[1]!.id;
    const kotor = { kandidat: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0, x: 1 }, y: 2 };
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi, data: kotor as unknown as DataSinyalSuara });
    expect(sinyal(surat, 'budi')[0]!.data).toEqual({ kandidat: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } });
  });
});

describe('suara: penonton (#60)', () => {
  it('penonton tidak pernah dikirimi daftar suara/sinyal dan tidak bisa mengirim', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'mulai', pengocok: 0 });
    siapSemua(meja);
    meja.tonton('P1', 'Penonton', 'tok');
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    meja.terima('budi', { t: 'suara', aksi: 'gabung', nyala: true });
    const idBudi = suaraTerakhir(surat, 'ani')!.anggota[1]!.id;
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi, data: SDP });
    // Penonton yang diizinkan melihat kartu Ani juga tidak.
    meja.terimaPenonton('P1', { t: 'mintaLihat', kursi: 0 });
    const id = surat.info('ani').penonton!.minta![0]!.id;
    meja.terima('ani', { t: 'jawabLihat', penonton: id, terima: true });
    meja.terima('ani', { t: 'suara', aksi: 'mic', nyala: false });
    meja.terimaPenonton('P1', { t: 'suara', aksi: 'gabung' });
    meja.terimaPenonton('P1', { t: 'suaraSinyal', ke: idBudi, data: SDP });
    const kePenonton = surat.semua('P1');
    expect(kePenonton.some((p) => p.t === 'suara' || p.t === 'suaraSinyal')).toBe(false);
    expect(JSON.stringify(kePenonton)).not.toContain('"mic"');
    expect(sinyal(surat, 'budi')).toHaveLength(1);
    expect(surat.errors('P1').at(-1)).toMatch(/nonton/);
  });
});

describe('suara: validasi pesan', () => {
  it('suara', () => {
    expect(validasiPesan({ t: 'suara', aksi: 'gabung' })).toEqual({ t: 'suara', aksi: 'gabung' });
    expect(validasiPesan({ t: 'suara', aksi: 'gabung', nyala: true })).toEqual({ t: 'suara', aksi: 'gabung', nyala: true });
    expect(validasiPesan({ t: 'suara', aksi: 'keluar', nyala: 1 })).toEqual({ t: 'suara', aksi: 'keluar' });
    expect(validasiPesan({ t: 'suara', aksi: 'mic', nyala: false })).toEqual({ t: 'suara', aksi: 'mic', nyala: false });
    expect(validasiPesan({ t: 'suara', aksi: 'jeda', nyala: true })).toEqual({ t: 'suara', aksi: 'jeda', nyala: true });
    expect(validasiPesan({ t: 'suara', aksi: 'mic' })).toBeNull();
    expect(validasiPesan({ t: 'suara', aksi: 'gabung', nyala: 'ya' })).toBeNull();
    expect(validasiPesan({ t: 'suara', aksi: 'teriak', nyala: true })).toBeNull();
  });

  it('suaraSinyal: bentuk dan ukuran', () => {
    expect(validasiPesan({ t: 'suaraSinyal', ke: 3, data: SDP })).toEqual({ t: 'suaraSinyal', ke: 3, data: SDP });
    expect(validasiPesan({ t: 'suaraSinyal', ke: 0, data: SDP })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1.5, data: SDP })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1, data: { sdp: { type: 'pranswer', sdp: 'v=0' } } })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1, data: { sdp: { type: 'offer', sdp: '' } } })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1, data: { sdp: { type: 'offer', sdp: 'x'.repeat(16_001) } } })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1, data: { ...SDP, kandidat: { candidate: 'a' } } })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1, data: {} })).toBeNull();
    expect(validasiPesan({ t: 'suaraSinyal', ke: 1 })).toBeNull();
    expect(validasiSinyalSuara({ kandidat: { candidate: 'c' } })).toEqual({ kandidat: { candidate: 'c', sdpMid: null, sdpMLineIndex: null } });
    expect(validasiSinyalSuara({ kandidat: { candidate: 'c'.repeat(1001) } })).toBeNull();
    expect(validasiSinyalSuara({ kandidat: { candidate: 'c', sdpMLineIndex: 99 } })).toBeNull();
    expect(validasiSinyalSuara({ kandidat: { candidate: 'c', sdpMid: 5 } })).toBeNull();
  });
});

describe('suara: sambung ulang, restart, relay', () => {
  it('gabung ulang membawa mic dan jeda HP-nya; validasi menerima jeda hanya boolean', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    const id = suaraTerakhir(surat, 'ani')!.saya;
    // Mic dimatikan selama putus (pesannya hilang): gabung ulang dengan nyala false menimpanya.
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: false });
    expect(suaraTerakhir(surat, 'budi')!.anggota[0]).toEqual({ id, kursi: 0, mic: false });
    // Masih dijeda saat gabung ulang: tetap dijeda (teman tidak menawarkan ke HP yang dijeda).
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true, jeda: true });
    expect(suaraTerakhir(surat, 'budi')!.anggota[0]).toEqual({ id, kursi: 0, mic: true, jeda: true });
    meja.terima('ani', { t: 'suara', aksi: 'gabung', nyala: true });
    expect(suaraTerakhir(surat, 'budi')!.anggota[0]).toEqual({ id, kursi: 0, mic: true });
    expect(validasiPesan({ t: 'suara', aksi: 'gabung', nyala: false, jeda: true })).toEqual({ t: 'suara', aksi: 'gabung', nyala: false, jeda: true });
    expect(validasiPesan({ t: 'suara', aksi: 'gabung', jeda: false })).toEqual({ t: 'suara', aksi: 'gabung' });
    expect(validasiPesan({ t: 'suara', aksi: 'gabung', jeda: 'ya' })).toBeNull();
    expect(validasiPesan({ t: 'suara', aksi: 'gabung', nyala: 1 })).toBeNull();
  });

  it('id suara sesudah restart (#58) tidak pernah sama dengan id sebelum restart', () => {
    const { meja, surat, jam } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    meja.terima('cici', { t: 'suara', aksi: 'gabung' });
    const lama = suaraTerakhir(surat, 'ani')!.anggota.map((a) => a.id);
    expect(new Set(lama).size).toBe(3);
    // Server restart: meja dibangun ulang dari data (tanpa daftar suara), jamnya terus berjalan.
    jam.maju(5_000);
    const s2 = siapkan({ namaLawan: ['Warga A'], penjadwal: jam });
    const pulih = new Meja(s2.opsi, dataMejaDipulihkan(meja.data));
    for (const [id, nama] of [['cici', 'Cici'], ['budi', 'Budi'], ['ani', 'Ani']] as const) {
      pulih.masuk(id, nama);
      pulih.terima(id, { t: 'suara', aksi: 'gabung' });
    }
    const baru = s2.surat.terakhir('ani', 'suara')!.anggota.map((a) => a.id);
    expect(baru).toHaveLength(3);
    for (const id of baru) expect(lama).not.toContain(id);
    expect(validasiPesan({ t: 'suaraSinyal', ke: Math.max(...baru), data: SDP })).not.toBeNull();
  });

  it('tawaran hanya diteruskan kalau salah satu mic nyala dan tidak ada yang dijeda', () => {
    const { meja, surat } = mejaLobi();
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    const [idAni, idBudi] = suaraTerakhir(surat, 'ani')!.anggota.map((a) => a.id);
    const jawab: DataSinyalSuara = { sdp: { type: 'answer', sdp: 'v=0\r\n' } };
    // Dua-duanya mic mati: tawaran (jawabannya membawa alamat IP) dibuang; jawaban tetap diteruskan.
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi!, data: SDP });
    meja.terima('budi', { t: 'suaraSinyal', ke: idAni!, data: jawab });
    expect(sinyal(surat, 'budi')).toEqual([]);
    expect(sinyal(surat, 'ani')).toHaveLength(1);
    // Mic penerima nyala: boleh.
    meja.terima('budi', { t: 'suara', aksi: 'mic', nyala: true });
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi!, data: SDP });
    expect(sinyal(surat, 'budi')).toHaveLength(1);
    // Penerima dijeda: dibuang.
    meja.terima('budi', { t: 'suara', aksi: 'jeda', nyala: true });
    meja.terima('ani', { t: 'suaraSinyal', ke: idBudi!, data: SDP });
    expect(sinyal(surat, 'budi')).toHaveLength(1);
  });

  it('bolehRelaySuara: hanya anggota suara terhubung yang punya teman suara terhubung', () => {
    const { meja } = mejaLobi();
    expect(meja.bolehRelaySuara('ani')).toBe(false);
    meja.terima('ani', { t: 'suara', aksi: 'gabung' });
    expect(meja.bolehRelaySuara('ani')).toBe(false);
    meja.terima('budi', { t: 'suara', aksi: 'gabung' });
    expect(meja.bolehRelaySuara('ani')).toBe(true);
    expect(meja.bolehRelaySuara('budi')).toBe(true);
    expect(meja.bolehRelaySuara('cici')).toBe(false);
    expect(meja.bolehRelaySuara('orangLuar')).toBe(false);
    meja.terputus('budi');
    expect(meja.bolehRelaySuara('ani')).toBe(false);
  });
});
