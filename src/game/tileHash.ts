/** Stable 0-99 hash of a tile coordinate (works for negative coordinates). */
export function tileHash(c: number, r: number): number {
  let h = (Math.imul(c, 374761393) + Math.imul(r, 668265263)) ^ Math.imul(c ^ r, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 100;
}
