// Gambar kartu dibuat dengan Canvas 2D saat game mulai: tidak butuh file gambar, jadi aman offline.

import Phaser from 'phaser';
import { namaRank, SEMUA_BUNGA, SEMUA_RANK, type Bunga, type Rank } from '@remi/engine';

export const LEBAR_TEKSTUR = 200;
export const TINGGI_TEKSTUR = 280;
export const RASIO_KARTU = TINGGI_TEKSTUR / LEBAR_TEKSTUR;

const MERAH = '#c62828';
const HITAM = '#1b1b1b';

export const warnaBunga = (b: Bunga) => (b === 'love' || b === 'wajik' ? MERAH : HITAM);

export function kunciMuka(bunga: Bunga, rank: Rank): string {
  return `kartu-${bunga}-${rank}`;
}
export const KUNCI_PUNGGUNG = 'kartu-punggung';

/** Gambar simbol bunga berpusat di (x, y) dengan ukuran kira-kira `s`. */
export function gambarBunga(ctx: CanvasRenderingContext2D, bunga: Bunga, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = warnaBunga(bunga);
  ctx.beginPath();
  switch (bunga) {
    case 'love':
      ctx.moveTo(0, 38);
      ctx.bezierCurveTo(-60, -5, -50, -50, -25, -50);
      ctx.bezierCurveTo(-10, -50, 0, -40, 0, -28);
      ctx.bezierCurveTo(0, -40, 10, -50, 25, -50);
      ctx.bezierCurveTo(50, -50, 60, -5, 0, 38);
      ctx.fill();
      break;
    case 'wajik':
      ctx.moveTo(0, -50);
      ctx.quadraticCurveTo(20, -18, 38, 0);
      ctx.quadraticCurveTo(20, 18, 0, 50);
      ctx.quadraticCurveTo(-20, 18, -38, 0);
      ctx.quadraticCurveTo(-20, -18, 0, -50);
      ctx.fill();
      break;
    case 'waru':
      ctx.moveTo(0, -50);
      ctx.bezierCurveTo(-55, -5, -50, 32, -22, 32);
      ctx.bezierCurveTo(-10, 32, -4, 24, -3, 18);
      ctx.lineTo(-12, 48);
      ctx.lineTo(12, 48);
      ctx.lineTo(3, 18);
      ctx.bezierCurveTo(4, 24, 10, 32, 22, 32);
      ctx.bezierCurveTo(50, 32, 55, -5, 0, -50);
      ctx.fill();
      break;
    case 'kriting':
      ctx.arc(0, -24, 21, 0, Math.PI * 2);
      ctx.moveTo(-14, 12);
      ctx.arc(-23, 10, 21, 0, Math.PI * 2);
      ctx.moveTo(44, 10);
      ctx.arc(23, 10, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, 8);
      ctx.lineTo(-13, 48);
      ctx.lineTo(13, 48);
      ctx.lineTo(4, 8);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function persegiBulat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gambarMuka(ctx: CanvasRenderingContext2D, bunga: Bunga, rank: Rank) {
  const W = LEBAR_TEKSTUR;
  const H = TINGGI_TEKSTUR;
  persegiBulat(ctx, 2, 2, W - 4, H - 4, 16);
  ctx.fillStyle = '#fbf9f3';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#bdb7a8';
  ctx.stroke();

  const warna = warnaBunga(bunga);
  const teks = namaRank(rank) === 'As' ? 'A' : namaRank(rank);
  ctx.fillStyle = warna;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${teks.length > 1 ? 52 : 60}px system-ui, sans-serif`;
  ctx.fillText(teks, 40, 44);
  gambarBunga(ctx, bunga, 40, 96, 40);

  // Pojok kanan bawah, terbalik.
  ctx.save();
  ctx.translate(W, H);
  ctx.rotate(Math.PI);
  ctx.fillStyle = warna;
  ctx.fillText(teks, 40, 44);
  gambarBunga(ctx, bunga, 40, 96, 40);
  ctx.restore();

  if (rank >= 11) {
    ctx.font = '800 96px Georgia, serif';
    ctx.fillStyle = warna;
    ctx.fillText(teks, W / 2, H / 2 - 8);
    gambarBunga(ctx, bunga, W / 2, H / 2 + 62, 34);
  } else {
    gambarBunga(ctx, bunga, W / 2, H / 2 + 6, rank === 1 ? 104 : 80);
  }
}

function gambarPunggung(ctx: CanvasRenderingContext2D) {
  const W = LEBAR_TEKSTUR;
  const H = TINGGI_TEKSTUR;
  persegiBulat(ctx, 2, 2, W - 4, H - 4, 16);
  ctx.fillStyle = '#fbf9f3';
  ctx.fill();
  persegiBulat(ctx, 12, 12, W - 24, H - 24, 10);
  ctx.fillStyle = '#8e1c1c';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 6;
  for (let i = -H; i < W + H; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.moveTo(i + H, 0);
    ctx.lineTo(i, H);
    ctx.stroke();
  }
  ctx.restore();
}

/** Daftarkan semua tekstur kartu ke Phaser (dipanggil sekali). */
export function daftarkanTeksturKartu(textures: Phaser.Textures.TextureManager): void {
  const buat = (kunci: string, gambar: (ctx: CanvasRenderingContext2D) => void) => {
    if (textures.exists(kunci)) return;
    const t = textures.createCanvas(kunci, LEBAR_TEKSTUR, TINGGI_TEKSTUR);
    if (!t) return;
    gambar(t.getContext());
    t.refresh();
  };
  for (const b of SEMUA_BUNGA) for (const r of SEMUA_RANK) buat(kunciMuka(b, r), (ctx) => gambarMuka(ctx, b, r));
  buat(KUNCI_PUNGGUNG, gambarPunggung);
}
