// gameConfig.js — canvas size, scaling, palette tokens, board geometry.
// Numeric truth lives in tuning.json; this module reads it once and derives layout constants.

export const TUNING_URL = './src/config/tuning.json';

// Default fallback (used only if tuning.json fetch fails — should never happen offline-cached).
export const DEFAULT_TUNING = {
  grid: { rows: 6, cols: 6 },
  tile_types: ['white', 'black', 'yellow', 'gray', 'calico'],
  tile_size_px: 48,
  tile_gap_px: 8,
  board_width_px: 328,
  scoring: { match_3: 30, match_4: 60, match_5_plus: 150, cascade_multiplier_step: 0.5, cascade_multiplier_max: 5.0 },
  win_threshold: 5000,
  time_limit_s: 60,
  motion: { cascade_delay_ms: 180, tile_pop_in_ms: 250, particle_fade_ms: 400, gameover_modal_delay_ms: 800, screen_wide_clear_ms: 600 },
  urgency: { threshold_s: 10, border_pulse_hz: 2, hud_timer_color: '#E04848' }
};

export async function loadTuning() {
  try {
    const res = await fetch(TUNING_URL);
    if (!res.ok) throw new Error('tuning fetch failed');
    return await res.json();
  } catch (e) {
    console.warn('[tuning] fallback to DEFAULT_TUNING', e);
    return DEFAULT_TUNING;
  }
}

export function deriveLayout(tuning) {
  const { grid, tile_size_px, tile_gap_px } = tuning;
  const boardWidth = grid.cols * tile_size_px + (grid.cols - 1) * tile_gap_px;
  const boardHeight = grid.rows * tile_size_px + (grid.rows - 1) * tile_gap_px;
  return {
    boardWidth,
    boardHeight,
    tileSize: tile_size_px,
    tileGap: tile_gap_px,
    rows: grid.rows,
    cols: grid.cols
  };
}

// Phaser config factory — called from main.js after tuning loads.
export function buildPhaserConfig(scenes) {
  return {
    type: Phaser.AUTO,
    parent: 'phaser-root',
    backgroundColor: '#FFF8EE',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 360,
      height: 640
    },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
    input: { activePointers: 3 },
    render: { pixelArt: false, antialias: true },
    scene: scenes,
    audio: { disableWebAudio: false }
  };
}
