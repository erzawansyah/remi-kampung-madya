// @vitest-environment happy-dom
// game/game.ts: pemuatan Phaser yang malas. Yang dijaga:
// - import chunk Phaser yang gagal tidak di-cache selamanya: buatGame berikutnya mencoba import lagi;
// - boot Phaser yang tidak pernah READY berakhir dengan penolakan (bukan Promise menggantung) dan
//   game setengah jadinya dihancurkan;
// - tidur/bangun sebelum Phaser siap tidak menyentuh loop yang belum pernah jalan.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface LoopPalsu {
  running: boolean;
  sleep: ReturnType<typeof vi.fn>;
  wake: ReturnType<typeof vi.fn>;
}

let siapkan: Array<(s: unknown) => void> = [];
let gamePalsu: Array<{ loop: LoopPalsu; destroy: ReturnType<typeof vi.fn> }> = [];

vi.mock('../src/game/gamePhaser', () => {
  return {
    mulaiPhaser: () => {
      const loop: LoopPalsu = { running: false, sleep: vi.fn(), wake: vi.fn() };
      const game = { loop, destroy: vi.fn() };
      gamePalsu.push(game);
      const scene = new Promise((ok) => siapkan.push((s) => {
        loop.running = true;
        ok(s);
      }));
      return { game, scene };
    },
  };
});

beforeEach(() => {
  vi.resetModules();
  siapkan = [];
  gamePalsu = [];
});
afterEach(() => {
  vi.useRealTimers();
});

const muatGame = () => import('../src/game/game');

describe('buatGame', () => {
  it('scene selesai saat Phaser READY; tidur/bangun sebelum siap tidak menyentuh loop', async () => {
    const { buatGame, tidurkanGame, bangunkanGame } = await muatGame();
    const p = buatGame(document.body);
    await vi.waitFor(() => expect(siapkan).toHaveLength(1));
    tidurkanGame(p.game);
    bangunkanGame(p.game);
    tidurkanGame(p.game);
    const loop = gamePalsu[0]!.loop;
    expect(loop.wake).not.toHaveBeenCalled();
    expect(loop.sleep).not.toHaveBeenCalled();
    siapkan[0]!('adegan');
    await expect(p.scene).resolves.toBe('adegan');
    // Diminta tidur sebelum siap: loop yang baru menyala langsung ditidurkan.
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    loop.running = false;
    bangunkanGame(p.game);
    expect(loop.wake).toHaveBeenCalledTimes(1);
  });

  it('boot yang tidak pernah READY: ditolak setelah batas waktu dan game setengah jadi dihancurkan', async () => {
    vi.useFakeTimers();
    const { buatGame, BATAS_BOOT_MS } = await muatGame();
    const p = buatGame(document.body);
    const hasil = p.scene.then(
      () => 'ok',
      () => 'ditolak',
    );
    await vi.advanceTimersByTimeAsync(BATAS_BOOT_MS + 10);
    expect(await hasil).toBe('ditolak');
    expect(gamePalsu[0]!.destroy).toHaveBeenCalledWith(true);
    expect(p.game.asli).toBeNull();
  });
});

describe('buatGame: chunk Phaser gagal dimuat', () => {
  it('penolakan import tidak di-cache: buatGame berikutnya mengimpor lagi dan berhasil', async () => {
    const { buatGame, _aturImporPhaser } = await muatGame();
    const asli = () => import('../src/game/gamePhaser');
    const impor = vi
      .fn<typeof asli>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module: http://localhost:3000/assets/gamePhaser-x.js'))
      .mockImplementation(asli);
    _aturImporPhaser(impor);
    const pertama = buatGame(document.body);
    await expect(pertama.scene).rejects.toThrow(/dynamically imported module/);
    expect(gamePalsu).toHaveLength(0);

    const kedua = buatGame(document.body);
    await vi.waitFor(() => expect(siapkan).toHaveLength(1));
    siapkan[0]!('adegan');
    await expect(kedua.scene).resolves.toBe('adegan');
    expect(impor).toHaveBeenCalledTimes(2);
  });
});
