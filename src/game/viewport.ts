export interface PixelViewport {
  /** Render zoom multiplier (1 = 1:1 native HD CSS pixels, >1 = zoomed in, <1 = wider view) */
  pixelScale: number;
  /** Logical canvas width in world units */
  logicalWidth: number;
  /** Logical canvas height in world units */
  logicalHeight: number;
  /** Backing canvas pixel width (DPR-aware) */
  displayWidth: number;
  /** Backing canvas pixel height (DPR-aware) */
  displayHeight: number;
  /** Approximate visible map tile columns */
  visibleCols: number;
  /** Approximate visible map tile rows */
  visibleRows: number;
}

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 45; // Exact 1024:720 (64:45) aspect ratio matching master tile canvases

/**
 * Computes a responsive HD viewport whose visible world range scales smoothly
 * with the browser's total web pixels while keeping compressed 1024x720 assets razor-sharp.
 */
export function computePixelViewport(
  containerWidth: number,
  containerHeight: number,
  preferredZoomOffset = 0,
  dpr = 1
): PixelViewport {
  const safeW = Math.max(320, Math.floor(containerWidth));
  const safeH = Math.max(240, Math.floor(containerHeight));
  const totalPixels = safeW * safeH;

  let baseScale = 1;
  if (totalPixels < 420_000 || safeW < 640) {
    baseScale = 0.85;
  } else if (totalPixels >= 1_900_000 && safeW >= 1600) {
    baseScale = 1.15;
  }

  const zoomStep = preferredZoomOffset * 0.15;
  const pixelScale = Math.max(0.75, Math.min(1.5, Number((baseScale + zoomStep).toFixed(2))));

  const logicalWidth = Math.max(280, Math.round(safeW / pixelScale));
  const logicalHeight = Math.max(220, Math.round(safeH / pixelScale));
  const clampedDpr = Math.max(1, Math.min(2, dpr));

  return {
    pixelScale,
    logicalWidth,
    logicalHeight,
    displayWidth: Math.round(safeW * clampedDpr),
    displayHeight: Math.round(safeH * clampedDpr),
    visibleCols: Math.round((logicalWidth / TILE_WIDTH) * 10) / 10,
    visibleRows: Math.round((logicalHeight / TILE_HEIGHT) * 10) / 10,
  };
}

/**
 * Converts client pointer coordinates into world coordinates using live canvas bounds.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  canvasRect: { left: number; top: number; width: number; height: number },
  viewport: PixelViewport,
  cameraX: number,
  cameraY: number
): { worldX: number; worldY: number } {
  const safeRectW = Math.max(1, canvasRect.width);
  const safeRectH = Math.max(1, canvasRect.height);

  const normX = (clientX - canvasRect.left) / safeRectW;
  const normY = (clientY - canvasRect.top) / safeRectH;

  const logicalX = normX * viewport.logicalWidth;
  const logicalY = normY * viewport.logicalHeight;

  return {
    worldX: cameraX - viewport.logicalWidth / 2 + logicalX,
    worldY: cameraY - viewport.logicalHeight / 2 + logicalY,
  };
}
