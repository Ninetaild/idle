import { TILE_WIDTH } from './viewport';
import { tileHash } from './tileHash';
import type { FieldId, ZoneId } from './types';

/** The river repeats forever as a vertical band every RIVER_PERIOD columns. */
export const RIVER_PERIOD = 18;
const RIVER_SHORE_COLUMNS = [5, 10];
const RIVER_WATER_FIRST = 6;
const RIVER_WATER_LAST = 9;

export type RiverColumn = 'land' | 'shore' | 'water';

export function getRiverColumn(col: number): RiverColumn {
  const local = ((col % RIVER_PERIOD) + RIVER_PERIOD) % RIVER_PERIOD;
  if (local >= RIVER_WATER_FIRST && local <= RIVER_WATER_LAST) return 'water';
  return RIVER_SHORE_COLUMNS.includes(local) ? 'shore' : 'land';
}

export function isRiverWaterAt(fieldId: FieldId, x: number): boolean {
  return fieldId === 'river' && getRiverColumn(Math.floor(x / TILE_WIDTH)) === 'water';
}

/** Deterministic scenery: the same tile always has (or lacks) a tree. */
export function hasSceneryTree(zone: ZoneId, fieldId: FieldId, col: number, row: number, villageCols: number, villageRows: number): boolean {
  const roll = tileHash(col + 17, row - 31);
  if (zone === 'village') {
    const outside = col < 0 || row < 0 || col >= villageCols || row >= villageRows;
    // Keep the southern path clear where it runs past the village.
    const onPath = (col === 5 || col === 6) && row >= 2;
    return outside && !onPath && roll < 14;
  }
  if (fieldId === 'river' && getRiverColumn(col) !== 'land') return false;
  return roll < (fieldId === 'plains' ? 2 : 5);
}

export interface ViewSize { width: number; height: number; }

const SPAWN_MARGIN = 220;
const DESPAWN_MARGIN = 520;

function halfView(view: ViewSize) {
  return { w: Math.max(400, view.width / 2), h: Math.max(280, view.height / 2) };
}

/**
 * Picks a point around the player. With `offscreenOnly` the point lies in the ring
 * just outside the view, so new entities never pop into sight.
 */
export function pickSpawnPoint(playerX: number, playerY: number, view: ViewSize, offscreenOnly: boolean, rng: () => number = Math.random): { x: number; y: number } {
  const half = halfView(view);
  const margin = offscreenOnly ? SPAWN_MARGIN : 0;
  let dx = 0;
  let dy = 0;
  for (let attempt = 0; attempt < 24; attempt++) {
    dx = (rng() * 2 - 1) * (half.w + margin);
    dy = (rng() * 2 - 1) * (half.h + margin);
    const ok = offscreenOnly
      ? Math.abs(dx) > view.width / 2 + 40 || Math.abs(dy) > view.height / 2 + 40
      : dx * dx + dy * dy > 80 * 80;
    if (ok) return { x: playerX + dx, y: playerY + dy };
  }
  return { x: playerX + half.w + margin, y: playerY + dy };
}

export function isBeyondDespawnRange(playerX: number, playerY: number, x: number, y: number, view: ViewSize): boolean {
  const half = halfView(view);
  return Math.abs(x - playerX) > half.w + DESPAWN_MARGIN || Math.abs(y - playerY) > half.h + DESPAWN_MARGIN;
}
