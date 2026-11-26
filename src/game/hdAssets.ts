import {
  ATLAS_PATHS,
  ENEMY_ATLAS_INDEX,
  EVENT_PROTAGONIST_ATLAS_PATH,
  PROP_ATLAS_INDEX,
  PROPS_CELL,
  STANDALONE_SPRITE_PATHS,
} from './assetPaths';
import type { ActorAction, Direction, MikoSkinId } from './types';

export const ASSET_MASTER_WIDTH = 1024;
export const ASSET_MASTER_HEIGHT = 720;

const assetCache = new Map<string, HTMLCanvasElement>();
const svgAtlasImages = new Map<string, { image: HTMLImageElement; ready: boolean }>();

/** Finds the non-transparent pixel bounds in RGBA image data. */
export function getVisiblePixelBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 16
): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function getSvgAtlasFrame(
  path: string,
  frameW: number,
  frameH: number,
  col: number,
  row: number,
  outW = frameW,
  outH = frameH,
  preserveVisibleHeight = false
): HTMLCanvasElement | null {
  if (typeof Image === 'undefined') return null;
  let entry = svgAtlasImages.get(path);
  if (!entry) {
    const image = new Image();
    entry = { image, ready: false };
    image.onload = () => { entry!.ready = true; };
    image.onerror = () => { console.warn(`[assets] 이미지를 불러오지 못했습니다: ${image.src}`); };
    const version = typeof __ASSET_VERSION__ === 'string' ? __ASSET_VERSION__ : 'dev';
    image.src = `${import.meta.env.BASE_URL}${path}?v=${version}`;
    svgAtlasImages.set(path, entry);
  }
  if (!entry.ready) return null;
  const key = `svg:${path}:${col}:${row}:${outW}:${outH}`;
  const cached = assetCache.get(key);
  if (cached) return cached;
  // Isolate the source cell, detect its actual opaque pixels, then scale that
  // visible region to the output height. This prevents transparent padding in
  // individual frames from making the character look unexpectedly smaller.
  const source = document.createElement('canvas');
  source.width = frameW;
  source.height = frameH;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) return null;

  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.drawImage(entry.image, col * frameW, row * frameH, frameW, frameH, 0, 0, frameW, frameH);
  const pixels = sourceCtx.getImageData(0, 0, frameW, frameH);
  const bounds = getVisiblePixelBounds(pixels.data, frameW, frameH);
  const targetW = preserveVisibleHeight && bounds
    ? Math.max(1, Math.ceil((bounds.width * outH) / bounds.height))
    : outW;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  if (ctx && bounds) {
    // Protagonist poses share a fixed visible height; wider poses get a wider
    // canvas rather than being scaled down to fit a fixed-width cell.
    const scale = preserveVisibleHeight
      ? outH / bounds.height
      : Math.min(outH / bounds.height, outW / bounds.width);
    const drawW = bounds.width * scale;
    const drawH = bounds.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height,
      (targetW - drawW) / 2, outH - drawH, drawW, drawH);
  }
  assetCache.set(key, canvas);
  return canvas;
}


let scratchMaster: HTMLCanvasElement | null = null;
let scratchHalf: HTMLCanvasElement | null = null;
let scratchQuarter: HTMLCanvasElement | null = null;

function getScratch(
  ref: 'master' | 'half' | 'quarter',
  w: number,
  h: number
): HTMLCanvasElement {
  const existing =
    ref === 'master' ? scratchMaster : ref === 'half' ? scratchHalf : scratchQuarter;
  if (existing) return existing;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  if (ref === 'master') scratchMaster = c;
  else if (ref === 'half') scratchHalf = c;
  else scratchQuarter = c;
  return c;
}

/**
 * Draws an asset on a full 1024x720 master canvas and compresses it in multi-step
 * mipmaps (1024x720 -> 512x360 -> 256x180 -> targetW x targetH) with high-quality smoothing.
 */
function buildCompressedAsset(
  key: string,
  targetW: number,
  targetH: number,
  drawMaster: (ctx: CanvasRenderingContext2D) => void
): HTMLCanvasElement {
  const cached = assetCache.get(key);
  if (cached) return cached;

  const master = getScratch('master', ASSET_MASTER_WIDTH, ASSET_MASTER_HEIGHT);
  const mctx = master.getContext('2d');
  if (mctx) {
    mctx.clearRect(0, 0, ASSET_MASTER_WIDTH, ASSET_MASTER_HEIGHT);
    mctx.save();
    drawMaster(mctx);
    mctx.restore();
  }

  const half = getScratch('half', 512, 360);
  const hctx = half.getContext('2d');
  if (hctx) {
    hctx.clearRect(0, 0, 512, 360);
    hctx.imageSmoothingEnabled = true;
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(master, 0, 0, 512, 360);
  }

  const quarter = getScratch('quarter', 256, 180);
  const qctx = quarter.getContext('2d');
  if (qctx) {
    qctx.clearRect(0, 0, 256, 180);
    qctx.imageSmoothingEnabled = true;
    qctx.imageSmoothingQuality = 'high';
    qctx.drawImage(half, 0, 0, 256, 180);
  }

  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const octx = out.getContext('2d');
  if (octx) {
    octx.imageSmoothingEnabled = false;
    octx.drawImage(quarter, 0, 0, targetW, targetH);
  }

  assetCache.set(key, out);
  return out;
}

function flipCanvasHorizontal(key: string, source: HTMLCanvasElement): HTMLCanvasElement {
  const cached = assetCache.get(key);
  if (cached) return cached;
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.translate(out.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, 0, 0);
  }
  assetCache.set(key, out);
  return out;
}

// Drawing helpers in 1024x720 coordinate space
function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke = '#1b1417',
  lw = 14
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke = '#1b1417',
  lw = 14
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke = '#1b1417',
  lw = 14
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// ============================================================================
// 1024x720 Compressed Field Map Tiles (output compressed to 128x90)
// ============================================================================
export type MapTileKind =
  | 'village_courtyard'
  | 'village_stone'
  | 'village_grass'
  | 'forest_moss'
  | 'plains_meadow'
  | 'river_shore'
  | 'river_water'
  | 'snowy_ground'
  | 'tree_green'
  | 'tree_snow';

export function getMapTileAsset(kind: MapTileKind, variant = 0): HTMLCanvasElement {
  const tileIndex: Partial<Record<MapTileKind, number>> = {
    village_courtyard: 0, village_stone: 6, village_grass: 8,
    forest_moss: 1, plains_meadow: 2, river_shore: 3,
    river_water: 4, snowy_ground: 5,
  };
  const atlasIndex = tileIndex[kind];
  const atlasTile = atlasIndex === undefined ? null : getSvgAtlasFrame(
    ATLAS_PATHS.fieldTiles, 128, 90,
    atlasIndex % 4, Math.floor(atlasIndex / 4), 128, 90
  );
  if (atlasTile) return atlasTile;
  const v = variant % 4;
  const key = `tile1024_${kind}_${v}`;

  return buildCompressedAsset(key, 128, 90, (ctx) => {
    const W = ASSET_MASTER_WIDTH;
    const H = ASSET_MASTER_HEIGHT;

    if (kind === 'village_courtyard') {
      ctx.fillStyle = '#c5ae8d';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(138, 108, 76, 0.16)';
      for (let i = 0; i < 14; i++) {
        const px = ((i * 227 + v * 151) % 820) + 100;
        const py = ((i * 173 + v * 97) % 520) + 100;
        ctx.beginPath();
        ctx.ellipse(px, py, 22, 12, (i + v) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (v === 1 || v === 3) {
        ctx.fillStyle = 'rgba(255, 246, 228, 0.14)';
        ctx.beginPath();
        ctx.ellipse(420 + v * 40, 310 + v * 25, 48, 26, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (kind === 'village_stone') {
      ctx.fillStyle = '#8b7e70';
      ctx.fillRect(0, 0, W, H);
      const stones = [
        [24, 20, 466, 326],
        [524, 20, 476, 326],
        [24, 374, 466, 326],
        [524, 374, 476, 326],
      ];
      for (let i = 0; i < stones.length; i++) {
        const [sx, sy, sw, sh] = stones[i];
        roundRect(
          ctx,
          sx,
          sy,
          sw,
          sh,
          44,
          (i + v) % 2 === 0 ? '#aca092' : '#9f9283',
          '#695d52',
          12
        );
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fillRect(sx + 40, sy + 28, sw - 80, 24);
      }
      return;
    }

    if (kind === 'village_grass' || kind === 'forest_moss') {
      ctx.fillStyle = kind === 'village_grass' ? '#3b5f41' : '#294c37';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = kind === 'village_grass' ? 'rgba(84, 132, 90, 0.32)' : 'rgba(60, 110, 79, 0.32)';
      for (let i = 0; i < 8; i++) {
        const gx = ((i * 241 + v * 173) % 780) + 120;
        const gy = ((i * 179 + v * 113) % 480) + 120;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 46, 22, ((i + v) % 4) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (v === 2) {
        circle(ctx, 360, 290, 18, '#fef08a', '#ca8a04', 5);
        circle(ctx, 690, 460, 16, '#fbcfe8', '#db2777', 5);
      } else if (v === 3) {
        ctx.fillStyle = kind === 'village_grass' ? '#5c8d62' : '#3d7453';
        ctx.beginPath();
        ctx.moveTo(500, 380);
        ctx.lineTo(484, 326);
        ctx.lineTo(512, 362);
        ctx.lineTo(532, 320);
        ctx.lineTo(526, 380);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    if (kind === 'plains_meadow') {
      ctx.fillStyle = '#538343';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(115, 171, 89, 0.45)';
      for (let i = 0; i < 10; i++) {
        const gx = ((i * 211 + v * 139) % 780) + 120;
        const gy = ((i * 167 + v * 89) % 480) + 120;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 14, gy - 44);
        ctx.lineTo(gx + 10, gy - 12);
        ctx.lineTo(gx + 26, gy - 48);
        ctx.lineTo(gx + 20, gy);
        ctx.closePath();
        ctx.fill();
      }
      if (v === 0) {
        circle(ctx, 310, 260, 20, '#fef08a', '#b45309', 5);
      } else if (v === 2) {
        circle(ctx, 640, 440, 18, '#fbcfe8', '#be185d', 5);
      }
      return;
    }

    if (kind === 'river_shore') {
      ctx.fillStyle = '#d3bf9d';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) {
        const px = ((i * 223 + v * 113) % 760) + 130;
        const py = ((i * 157 + v * 91) % 460) + 130;
        ellipse(ctx, px, py, 36, 22, i % 2 === 0 ? '#94a3b8' : '#b5a284', '#64748b', 7);
      }
      return;
    }

    if (kind === 'river_water') {
      ctx.fillStyle = '#1f53cf';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const rx = 200 + ((i * 210 + v * 130) % 620);
        const ry = 110 + i * 140;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + 46, ry + 48, rx, ry + 96);
        ctx.stroke();
      }
      return;
    }

    if (kind === 'snowy_ground') {
      ctx.fillStyle = '#e7eff7';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(290 + v * 90, 230 + v * 45, 130, 48, -0.15, 0, Math.PI * 2);
      ctx.fill();
      if (v % 2 === 1) {
        ctx.fillStyle = 'rgba(148, 180, 214, 0.22)';
        ctx.beginPath();
        ctx.ellipse(660 - v * 50, 470, 110, 38, 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Pine trees (green or snow-covered)
    const isSnow = kind === 'tree_snow';
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(512, 620, 280, 75, 0, 0, Math.PI * 2);
    ctx.fill();
    roundRect(ctx, 442, 470, 140, 150, 24, '#6b4226', '#2b190d', 14);
    circle(ctx, 512, 340, 260, isSnow ? '#254a3a' : '#1f442f', '#12271b', 16);
    circle(ctx, 390, 390, 175, isSnow ? '#2f5c48' : '#29573c', '#12271b', 14);
    circle(ctx, 635, 390, 175, isSnow ? '#2f5c48' : '#29573c', '#12271b', 14);
    circle(ctx, 512, 245, 200, isSnow ? '#376c55' : '#356d4c', '#12271b', 14);
    if (isSnow) {
      ellipse(ctx, 512, 165, 190, 95, '#f8fafc', '#cbd5e1', 12);
      ellipse(ctx, 390, 285, 110, 52, '#f1f5f9', '#cbd5e1', 10);
      ellipse(ctx, 635, 285, 110, 52, '#f1f5f9', '#cbd5e1', 10);
    }
  });
}

// ============================================================================
// 1024x720 Compressed Miko Sprites (Default & Winter Miko, 4 Directions)
// ============================================================================
function drawMasterGohei(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  skin: MikoSkinId
) {
  const paper = skin === 'winter_miko' ? '#e0f2fe' : '#fbf8f1';
  const paperShade = skin === 'winter_miko' ? '#93c5fd' : '#dfd7c8';

  roundRect(ctx, cx - 18, cy + 20, 36, 210, 12, '#8c5a2b', '#1b1417', 12);
  roundRect(ctx, cx - 24, cy + 4, 48, 34, 10, '#f3ca52', '#1b1417', 10);

  // Left & Right zigzag shide streamers
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 12, cy - 45);
    ctx.lineTo(cx + side * 78, cy - 25);
    ctx.lineTo(cx + side * 46, cy + 12);
    ctx.lineTo(cx + side * 90, cy + 44);
    ctx.lineTo(cx + side * 36, cy + 88);
    ctx.lineTo(cx + side * 62, cy + 124);
    ctx.lineTo(cx + side * 18, cy + 135);
    ctx.closePath();
    ctx.fillStyle = side === -1 ? paper : paperShade;
    ctx.fill();
    ctx.lineWidth = 11;
    ctx.strokeStyle = '#1b1417';
    ctx.stroke();
  }
  circle(ctx, cx, cy - 32, 26, '#f3ca52', '#1b1417', 10);
}

export function getMikoAsset(
  dir: Direction,
  action: ActorAction,
  walkPhase: number,
  skin: MikoSkinId = 'default'
): HTMLCanvasElement {
  const step = action === 'walk' ? Math.floor(walkPhase) % 2 : 0;
  const key = `miko1024_${skin}_${dir}_${action}_${step}`;

  if (dir === 'left') {
    const mirrored = getMikoAsset('right', action, walkPhase, skin);
    return flipCanvasHorizontal(key, mirrored);
  }

  return buildCompressedAsset(key, 128, 90, (ctx) => {
    const isWinter = skin === 'winter_miko';
    const hair = '#261d29';
    const hairHi = '#4c3b54';
    const skinTone = '#fce0c7';
    const blush = '#f48fb1';
    const white = isWinter ? '#f4f8fc' : '#faf6ed';
    const red = isWinter ? '#b91c1c' : '#d93829';
    const redDark = isWinter ? '#7f1d1d' : '#9c2017';
    const gold = '#f3ca52';
    const fur = '#f8fafc';
    const scarf = isWinter ? '#38bdf8' : red;

    const crouch = action === 'pickup' ? 58 : 0;
    const stride = action === 'walk' ? (step === 0 ? -24 : 24) : 0;
    const cx = 512;

    if (dir === 'down') {
      // Back hair silhouette
      ellipse(ctx, cx, 230 + crouch, 175, 160, hair);
      ellipse(ctx, cx - 135, 310 + crouch, 46, 115, hair);
      ellipse(ctx, cx + 135, 310 + crouch, 46, 115, hair);

      // Feet / boots
      roundRect(ctx, cx - 102, 575 + crouch + Math.max(0, stride), 72, 68, 22, isWinter ? '#475569' : white);
      roundRect(ctx, cx + 30, 575 + crouch + Math.max(0, -stride), 72, 68, 22, isWinter ? '#475569' : white);
      if (isWinter) {
        roundRect(ctx, cx - 108, 565 + crouch + Math.max(0, stride), 84, 28, 14, fur);
        roundRect(ctx, cx + 24, 565 + crouch + Math.max(0, -stride), 84, 28, 14, fur);
      }

      // Hakama / Winter skirt
      ctx.beginPath();
      ctx.moveTo(cx - 125, 415 + crouch);
      ctx.lineTo(cx + 125, 415 + crouch);
      ctx.lineTo(cx + 158, 592 + crouch);
      ctx.lineTo(cx - 158, 592 + crouch);
      ctx.closePath();
      ctx.fillStyle = red;
      ctx.fill();
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#1b1417';
      ctx.stroke();

      // Hakama pleats
      ctx.strokeStyle = redDark;
      ctx.lineWidth = 10;
      for (const pxOff of [-68, 0, 68]) {
        ctx.beginPath();
        ctx.moveTo(cx + pxOff, 435 + crouch);
        ctx.lineTo(cx + pxOff * 1.15, 582 + crouch);
        ctx.stroke();
      }

      // Sleeves & Torso
      if (isWinter) {
        roundRect(ctx, cx - 172, 345 + crouch, 344, 158, 56, red);
        roundRect(ctx, cx - 180, 472 + crouch, 360, 46, 22, fur);
        roundRect(ctx, cx - 115, 315 + crouch, 230, 52, 24, scarf);
        circle(ctx, cx, 355 + crouch, 24, gold, '#1b1417', 10);
      } else {
        roundRect(ctx, cx - 178, 340 + crouch, 90, 128, 28, white);
        roundRect(ctx, cx + 88, 340 + crouch, 90, 128, 28, white);
        roundRect(ctx, cx - 112, 325 + crouch, 224, 108, 28, white);
        // Red kimono collar V
        ctx.beginPath();
        ctx.moveTo(cx - 56, 325 + crouch);
        ctx.lineTo(cx, 395 + crouch);
        ctx.lineTo(cx + 56, 325 + crouch);
        ctx.strokeStyle = red;
        ctx.lineWidth = 18;
        ctx.stroke();
        // Obi sash + gold clasp
        roundRect(ctx, cx - 118, 412 + crouch, 236, 44, 14, redDark);
        circle(ctx, cx, 434 + crouch, 20, gold, '#1b1417', 8);
      }

      // Hands
      circle(ctx, cx - 155, 456 + crouch, 26, skinTone);
      circle(ctx, cx + 155, 456 + crouch, 26, skinTone);

      // Face
      ellipse(ctx, cx, 236 + crouch, 134, 118, skinTone);
      // Rosy cheeks
      ellipse(ctx, cx - 76, 272 + crouch, 24, 12, blush, 'transparent', 0);
      ellipse(ctx, cx + 76, 272 + crouch, 24, 12, blush, 'transparent', 0);
      // Expressive eyes with white catchlights
      ellipse(ctx, cx - 54, 242 + crouch, 22, 28, '#1e1624', '#1e1624', 0);
      ellipse(ctx, cx + 54, 242 + crouch, 22, 28, '#1e1624', '#1e1624', 0);
      circle(ctx, cx - 60, 230 + crouch, 9, '#ffffff', 'transparent', 0);
      circle(ctx, cx + 48, 230 + crouch, 9, '#ffffff', 'transparent', 0);
      // Gentle smile
      ctx.beginPath();
      ctx.arc(cx, 278 + crouch, 16, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#6b3e3e';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Bangs & hair sheen
      ctx.beginPath();
      ctx.arc(cx, 198 + crouch, 142, Math.PI, 0);
      ctx.quadraticCurveTo(cx + 55, 195 + crouch, cx, 165 + crouch);
      ctx.quadraticCurveTo(cx - 55, 195 + crouch, cx - 142, 198 + crouch);
      ctx.fillStyle = hair;
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#1b1417';
      ctx.stroke();
      ellipse(ctx, cx, 118 + crouch, 82, 16, hairHi, 'transparent', 0);

      // Hair Ornaments
      if (isWinter) {
        circle(ctx, cx - 156, 230 + crouch, 42, fur);
        circle(ctx, cx + 156, 230 + crouch, 42, fur);
        roundRect(ctx, cx - 62, 68 + crouch, 124, 42, 18, red);
        circle(ctx, cx, 89 + crouch, 20, gold, '#1b1417', 8);
      } else {
        roundRect(ctx, cx + 76, 98 + crouch, 76, 38, 14, red);
        circle(ctx, cx + 114, 117 + crouch, 14, gold, '#1b1417', 6);
        circle(ctx, cx - 102, 134 + crouch, 24, white);
      }

      drawMasterGohei(ctx, cx + 225, 295 + crouch, skin);
      return;
    }

    if (dir === 'up') {
      ellipse(ctx, cx, 236 + crouch, 166, 158, hair);
      roundRect(ctx, cx - 132, 280 + crouch, 264, 118, 42, hair);
      roundRect(ctx, cx - 102, 575 + crouch + Math.max(0, stride), 72, 64, 20, isWinter ? '#475569' : white);
      roundRect(ctx, cx + 30, 575 + crouch + Math.max(0, -stride), 72, 64, 20, isWinter ? '#475569' : white);

      roundRect(ctx, cx - 146, 412 + crouch, 292, 178, 34, red);
      if (isWinter) {
        roundRect(ctx, cx - 166, 345 + crouch, 332, 152, 52, red);
        roundRect(ctx, cx - 174, 466 + crouch, 348, 46, 20, fur);
        roundRect(ctx, cx - 108, 315 + crouch, 216, 46, 20, scarf);
        circle(ctx, cx - 154, 230 + crouch, 40, fur);
        circle(ctx, cx + 154, 230 + crouch, 40, fur);
      } else {
        roundRect(ctx, cx - 168, 338 + crouch, 336, 98, 28, white);
        roundRect(ctx, cx - 115, 408 + crouch, 230, 44, 14, redDark);
      }
      // Back hair ribbon bow & gold pin
      roundRect(ctx, cx - 86, 288 + crouch, 172, 46, 16, red);
      circle(ctx, cx, 311 + crouch, 20, gold, '#1b1417', 8);
      ellipse(ctx, cx, 130 + crouch, 92, 22, hairHi, 'transparent', 0);
      drawMasterGohei(ctx, cx + 218, 280 + crouch, skin);
      return;
    }

    // Right profile (mirrored for Left)
    roundRect(ctx, cx - 64 + stride, 572 + crouch, 68, 68, 20, isWinter ? '#475569' : white);
    roundRect(ctx, cx + 6 - stride, 572 + crouch, 68, 68, 20, isWinter ? '#475569' : white);

    roundRect(ctx, cx - 118, 412 + crouch, 236, 178, 36, red);
    if (isWinter) {
      roundRect(ctx, cx - 134, 342 + crouch, 268, 156, 52, red);
      roundRect(ctx, cx - 142, 468 + crouch, 284, 44, 20, fur);
      roundRect(ctx, cx - 88, 316 + crouch, 190, 48, 20, scarf);
    } else {
      roundRect(ctx, cx - 108, 326 + crouch, 216, 108, 28, white);
      roundRect(ctx, cx - 112, 410 + crouch, 224, 42, 14, redDark);
    }

    ellipse(ctx, cx + 12, 234 + crouch, 124, 112, skinTone);
    ellipse(ctx, cx - 32, 234 + crouch, 128, 128, hair);
    // Side face clear eye & blush
    ellipse(ctx, cx + 76, 240 + crouch, 18, 26, '#1e1624', '#1e1624', 0);
    circle(ctx, cx + 78, 228 + crouch, 8, '#ffffff', 'transparent', 0);
    ellipse(ctx, cx + 52, 272 + crouch, 22, 11, blush, 'transparent', 0);

    if (isWinter) {
      circle(ctx, cx - 22, 228 + crouch, 42, fur);
      roundRect(ctx, cx - 56, 76 + crouch, 108, 38, 16, red);
    } else {
      roundRect(ctx, cx - 96, 110 + crouch, 68, 36, 14, red);
      circle(ctx, cx - 62, 128 + crouch, 14, gold, '#1b1417', 6);
    }

    circle(ctx, cx + 116, 440 + crouch, 26, skinTone);
    drawMasterGohei(ctx, cx + 178, 285 + crouch, skin);
  });
}

// ============================================================================
// 1024x720 Compressed Enemies, New Yokai, Events, Gatherables & Village NPCs
// ============================================================================
export function getEntityAsset(
  kind: string,
  revealedBandit = false
): HTMLCanvasElement {
  if (kind in ENEMY_ATLAS_INDEX) {
    const enemy = getSvgAtlasFrame(
      ATLAS_PATHS.enemy, 96, 96, ENEMY_ATLAS_INDEX[kind], 0, 128, 90
    );
    if (enemy) return enemy;
  }
  const standalonePath = STANDALONE_SPRITE_PATHS[
    kind === 'event_bandit' && revealedBandit ? 'event_bandit_revealed' : kind
  ];
  if (standalonePath) {
    // Standalone sprites are authored as one 96x96 cell.
    const standalone = getSvgAtlasFrame(standalonePath, 96, 96, 0, 0, 128, 90);
    if (standalone) return standalone;
  }
  if (kind in PROP_ATLAS_INDEX) {
    const index = PROP_ATLAS_INDEX[kind];
    const isPlant = kind === 'herb' || kind === 'berry';
    const prop = getSvgAtlasFrame(
      ATLAS_PATHS.fieldProps,
      PROPS_CELL.width,
      PROPS_CELL.height,
      index % PROPS_CELL.columns,
      Math.floor(index / PROPS_CELL.columns),
      96,
      isPlant ? 68 : 96
    );
    if (prop) return prop;
  }
  const key = `ent1024_${kind}_${revealedBandit ? 1 : 0}`;
  const isGatherable = kind === 'herb' || kind === 'berry';
  const outW = isGatherable ? 96 : 128;
  const outH = isGatherable ? 68 : 90;

  return buildCompressedAsset(key, outW, outH, (ctx) => {
    const cx = 512;

    switch (kind) {
      case 'herb': {
        ellipse(ctx, cx, 520, 210, 88, '#1e6b43');
        ellipse(ctx, cx - 150, 440, 125, 80, '#278754');
        ellipse(ctx, cx + 150, 440, 125, 80, '#278754');
        ellipse(ctx, cx - 75, 330, 125, 115, '#35a86b');
        ellipse(ctx, cx + 75, 330, 125, 115, '#35a86b');
        ellipse(ctx, cx, 250, 115, 130, '#4ade80');
        // Luminous white blossoms & dew
        circle(ctx, cx - 95, 320, 32, '#fef9c3', '#ca8a04', 10);
        circle(ctx, cx + 98, 340, 28, '#fef9c3', '#ca8a04', 10);
        circle(ctx, cx, 200, 34, '#ffffff', '#84cc16', 10);
        break;
      }

      case 'berry': {
        ellipse(ctx, cx, 420, 250, 170, '#1e5e3a');
        ellipse(ctx, cx - 105, 330, 150, 125, '#2f8554');
        ellipse(ctx, cx + 105, 330, 150, 125, '#2f8554');
        ellipse(ctx, cx, 265, 165, 110, '#48bb78');
        const berries = [
          [cx - 110, 340],
          [cx + 105, 310],
          [cx, 405],
          [cx + 135, 445],
          [cx - 125, 455],
        ];
        for (const [bx, by] of berries) {
          circle(ctx, bx, by, 52, '#d62844', '#4c0519', 12);
          circle(ctx, bx - 16, by - 16, 16, '#fecdd3', 'transparent', 0);
        }
        break;
      }

      case 'yokai_dokkaebi': {
        // Spiked Iron Kanabo Club
        roundRect(ctx, 145, 165, 92, 320, 36, '#64748b');
        roundRect(ctx, 174, 470, 36, 110, 14, '#8c5a2b');
        for (const sy of [215, 295, 375]) {
          circle(ctx, 145, sy, 22, '#e2e8f0', '#1b1417', 10);
          circle(ctx, 237, sy + 20, 22, '#e2e8f0', '#1b1417', 10);
        }
        // Muscular body & tiger pelt
        roundRect(ctx, cx - 110, 520, 82, 120, 24, '#99221d');
        roundRect(ctx, cx + 28, 520, 82, 120, 24, '#99221d');
        roundRect(ctx, cx - 150, 320, 300, 175, 48, '#c83e37');
        roundRect(ctx, cx - 135, 435, 270, 105, 28, '#eab308');
        ellipse(ctx, cx - 55, 480, 28, 18, '#451a03', 'transparent', 0);
        ellipse(ctx, cx + 52, 492, 32, 18, '#451a03', 'transparent', 0);
        // Face, twin curved horns & fangs
        ellipse(ctx, cx, 210, 145, 130, '#c83e37');
        ellipse(ctx, cx, 125, 152, 62, '#261e29');
        ctx.beginPath();
        ctx.moveTo(cx - 105, 125);
        ctx.lineTo(cx - 155, 28);
        ctx.lineTo(cx - 58, 95);
        ctx.closePath();
        ctx.fillStyle = '#f4eedc';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 105, 125);
        ctx.lineTo(cx + 155, 28);
        ctx.lineTo(cx + 58, 95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        circle(ctx, cx - 54, 210, 26, '#fef08a', '#1b1417', 8);
        circle(ctx, cx + 54, 210, 26, '#fef08a', '#1b1417', 8);
        circle(ctx, cx - 54, 210, 10, '#18181b', 'transparent', 0);
        circle(ctx, cx + 54, 210, 10, '#18181b', 'transparent', 0);
        break;
      }

      case 'fairy_sylph': {
        // Translucent butterfly wings
        ellipse(ctx, cx - 175, 265, 135, 105, 'rgba(94, 234, 212, 0.85)', '#0f766e', 12);
        ellipse(ctx, cx + 175, 265, 135, 105, 'rgba(94, 234, 212, 0.85)', '#0f766e', 12);
        ellipse(ctx, cx - 140, 420, 95, 85, 'rgba(45, 212, 191, 0.8)', '#0f766e', 12);
        ellipse(ctx, cx + 140, 420, 95, 85, 'rgba(45, 212, 191, 0.8)', '#0f766e', 12);
        // Petal dress & legs
        roundRect(ctx, cx - 54, 520, 40, 95, 16, '#fde8d7');
        roundRect(ctx, cx + 14, 520, 40, 95, 16, '#fde8d7');
        roundRect(ctx, cx - 108, 345, 216, 190, 62, '#22c55e');
        ellipse(ctx, cx, 425, 118, 62, '#86efac', '#15803d', 10);
        // Head + floral crown
        ellipse(ctx, cx, 215, 128, 116, '#34d399');
        ellipse(ctx, cx, 230, 102, 92, '#fde8d7');
        circle(ctx, cx - 42, 232, 18, '#059669', 'transparent', 0);
        circle(ctx, cx + 42, 232, 18, '#059669', 'transparent', 0);
        circle(ctx, cx - 64, 108, 28, '#fde047', '#ca8a04', 8);
        circle(ctx, cx, 98, 30, '#f472b6', '#be185d', 8);
        circle(ctx, cx + 64, 108, 28, '#fde047', '#ca8a04', 8);
        break;
      }

      case 'yokai_gumiho': {
        // Fanned luminous nine tails
        for (const angle of [-0.7, -0.38, 0.38, 0.7]) {
          ctx.save();
          ctx.translate(cx, 440);
          ctx.rotate(angle);
          ellipse(ctx, 0, -180, 72, 195, '#fb923c', '#1b1417', 12);
          ellipse(ctx, 0, -320, 52, 64, '#fff7ed', 'transparent', 0);
          ctx.restore();
        }
        // Spirit kimono & violet sash
        roundRect(ctx, cx - 114, 330, 228, 240, 52, '#fff7ed');
        roundRect(ctx, cx - 118, 435, 236, 46, 16, '#9333ea');
        circle(ctx, cx, 458, 22, '#fde047', '#1b1417', 8);
        // Fox ears & head
        ctx.beginPath();
        ctx.moveTo(cx - 108, 155);
        ctx.lineTo(cx - 140, 38);
        ctx.lineTo(cx - 42, 118);
        ctx.closePath();
        ctx.fillStyle = '#ea580c';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 108, 155);
        ctx.lineTo(cx + 140, 38);
        ctx.lineTo(cx + 42, 118);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ellipse(ctx, cx, 220, 128, 114, '#f59e0b');
        ellipse(ctx, cx, 234, 102, 92, '#fde8d7');
        circle(ctx, cx - 44, 234, 18, '#d97706', '#1b1417', 6);
        circle(ctx, cx + 44, 234, 18, '#d97706', '#1b1417', 6);
        break;
      }

      case 'yokai_tengu': {
        // Black feathered wings
        ellipse(ctx, cx - 185, 355, 130, 175, '#1e293b', '#0f172a', 14);
        ellipse(ctx, cx + 185, 355, 130, 175, '#1e293b', '#0f172a', 14);
        // Yamabushi robe & feather fan
        roundRect(ctx, cx - 118, 330, 236, 235, 48, '#f8fafc');
        roundRect(ctx, cx - 118, 420, 236, 48, 14, '#7c2d12');
        circle(ctx, cx + 210, 410, 78, '#b91c1c', '#1b1417', 12);
        // Crimson Tengu mask + long nose + pillbox cap
        ellipse(ctx, cx, 222, 126, 112, '#dc2626');
        roundRect(ctx, cx - 22, 220, 44, 68, 18, '#b91c1c'); // Tengu nose
        circle(ctx, cx - 46, 206, 20, '#fef08a', '#1b1417', 6);
        circle(ctx, cx + 46, 206, 20, '#fef08a', '#1b1417', 6);
        roundRect(ctx, cx - 54, 78, 108, 56, 16, '#1e293b');
        break;
      }

      case 'yokai_kappa': {
        // Turtle shell peeking behind
        ellipse(ctx, cx, 425, 165, 150, '#3f6212');
        // Agile jade body & webbed hands
        roundRect(ctx, cx - 112, 330, 224, 210, 56, '#22c55e');
        ellipse(ctx, cx, 430, 76, 86, '#bef264', '#3f6212', 10);
        // Head with shimmering water dish on top
        ellipse(ctx, cx, 215, 134, 112, '#22c55e');
        ellipse(ctx, cx, 126, 82, 28, '#38bdf8', '#0284c7', 10);
        // Yellow beak & eyes
        ellipse(ctx, cx, 246, 48, 28, '#facc15');
        circle(ctx, cx - 52, 200, 20, '#ffffff', '#1b1417', 6);
        circle(ctx, cx + 52, 200, 20, '#ffffff', '#1b1417', 6);
        circle(ctx, cx - 52, 200, 8, '#18181b', 'transparent', 0);
        circle(ctx, cx + 52, 200, 8, '#18181b', 'transparent', 0);
        break;
      }

      case 'yokai_yukionna': {
        // Frost aura & flowing silver-white hair
        ellipse(ctx, cx, 290, 175, 210, '#e2e8f0');
        // Icy blue spirit kimono
        ctx.beginPath();
        ctx.moveTo(cx - 115, 340);
        ctx.lineTo(cx + 115, 340);
        ctx.lineTo(cx + 165, 610);
        ctx.lineTo(cx - 165, 610);
        ctx.closePath();
        ctx.fillStyle = '#bae6fd';
        ctx.fill();
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#1b1417';
        ctx.stroke();
        roundRect(ctx, cx - 118, 430, 236, 46, 16, '#0284c7');
        // Pale face & icy eyes
        ellipse(ctx, cx, 225, 112, 102, '#f8fafc');
        circle(ctx, cx - 42, 225, 18, '#0284c7', 'transparent', 0);
        circle(ctx, cx + 42, 225, 18, '#0284c7', 'transparent', 0);
        // Floating ice crystals
        circle(ctx, cx - 210, 320, 24, '#7dd3fc', '#0284c7', 8);
        circle(ctx, cx + 210, 350, 24, '#7dd3fc', '#0284c7', 8);
        break;
      }

      case 'event_bandit': {
        if (revealedBandit) {
          // Katana blade
          roundRect(ctx, cx + 175, 170, 34, 290, 10, '#e2e8f0');
          roundRect(ctx, cx + 158, 415, 68, 26, 8, '#f59e0b');
          // Bandit armor & mask
          roundRect(ctx, cx - 122, 330, 244, 240, 44, '#334155');
          roundRect(ctx, cx - 124, 425, 248, 42, 12, '#991b1b');
          ellipse(ctx, cx, 228, 122, 105, '#1e293b');
          circle(ctx, cx - 44, 226, 18, '#fde047', '#1b1417', 6);
          circle(ctx, cx + 44, 226, 18, '#fde047', '#1b1417', 6);
          // Wide bamboo Kasa hat
          ellipse(ctx, cx, 148, 225, 64, '#a16207');
          ellipse(ctx, cx, 122, 125, 34, '#ca8a04', '#713f12', 10);
          break;
        }
        // Falls through to injured appearance before reveal
      }
      case 'event_injured': {
        roundRect(ctx, cx + 168, 310, 28, 280, 12, '#92400e');
        roundRect(ctx, cx - 118, 330, 236, 240, 44, '#6b7280');
        roundRect(ctx, cx - 88, 365, 92, 62, 18, '#f8fafc');
        ellipse(ctx, cx, 224, 118, 106, '#f3cfb3');
        roundRect(ctx, cx - 120, 145, 240, 56, 20, '#f8fafc');
        circle(ctx, cx - 42, 226, 16, '#1e293b', 'transparent', 0);
        circle(ctx, cx + 42, 226, 16, '#1e293b', 'transparent', 0);
        break;
      }

      case 'event_fox_shrine': {
        // Curled cute baby fox with fluffy white-tipped tail & red shrine ribbon
        ellipse(ctx, cx + 125, 420, 140, 95, '#f97316');
        ellipse(ctx, cx + 210, 395, 65, 52, '#fff7ed', 'transparent', 0);
        ellipse(ctx, cx - 35, 445, 165, 115, '#ea580c');
        ellipse(ctx, cx - 60, 310, 122, 108, '#f97316');
        // Fox ears
        ctx.beginPath();
        ctx.moveTo(cx - 135, 245);
        ctx.lineTo(cx - 165, 145);
        ctx.lineTo(cx - 75, 205);
        ctx.closePath();
        ctx.fillStyle = '#ea580c';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 15, 245);
        ctx.lineTo(cx + 45, 145);
        ctx.lineTo(cx - 45, 205);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Cute eyes & red ribbon collar
        circle(ctx, cx - 95, 310, 16, '#18181b', 'transparent', 0);
        circle(ctx, cx - 30, 310, 16, '#18181b', 'transparent', 0);
        roundRect(ctx, cx - 130, 385, 145, 34, 14, '#d93829');
        circle(ctx, cx - 58, 412, 18, '#f3ca52', '#1b1417', 8);
        break;
      }

      case 'event_ancient_stone': {
        // Mossy granite monolith with glowing golden shrine rune
        roundRect(ctx, cx - 155, 515, 310, 88, 22, '#57534e');
        roundRect(ctx, cx - 118, 155, 236, 375, 46, '#78716c');
        ellipse(ctx, cx - 55, 210, 68, 34, '#4d7c0f', '#365314', 8);
        roundRect(ctx, cx - 126, 260, 252, 34, 14, '#e7e5e4'); // Shimenawa rope
        circle(ctx, cx, 385, 54, '#f59e0b', '#78350f', 10);
        circle(ctx, cx, 385, 26, '#fef08a', 'transparent', 0);
        break;
      }

      case 'event_peddler': {
        // Wandering Herbalist with herb backpack & bamboo hat
        roundRect(ctx, cx - 160, 290, 90, 180, 24, '#92400e');
        circle(ctx, cx - 120, 280, 44, '#4ade80');
        roundRect(ctx, cx - 110, 335, 220, 230, 42, '#475569');
        ellipse(ctx, cx, 230, 110, 96, '#f3cfb3');
        circle(ctx, cx - 38, 234, 15, '#1e293b', 'transparent', 0);
        circle(ctx, cx + 38, 234, 15, '#1e293b', 'transparent', 0);
        ellipse(ctx, cx, 155, 200, 56, '#b45309');
        break;
      }

      case 'village_cauldron': {
        ellipse(ctx, cx, 575, 165, 58, '#ea580c');
        ellipse(ctx, cx, 575, 95, 32, '#fde047', 'transparent', 0);
        roundRect(ctx, cx - 170, 245, 340, 290, 115, '#475569');
        ellipse(ctx, cx, 245, 175, 54, '#64748b');
        ellipse(ctx, cx, 245, 130, 34, '#4ade80', '#166534', 8);
        circle(ctx, cx, 395, 42, '#f59e0b', '#1b1417', 10);
        circle(ctx, cx - 55, 135, 26, '#86efac', '#16a34a', 8);
        circle(ctx, cx + 68, 105, 22, '#fde047', '#ca8a04', 8);
        break;
      }

      case 'village_merchant': {
        roundRect(ctx, cx - 135, 330, 270, 240, 48, '#92400e');
        roundRect(ctx, cx - 88, 355, 176, 200, 24, '#1d4ed8');
        circle(ctx, cx + 148, 435, 52, '#facc15', '#854d0e', 10);
        ellipse(ctx, cx, 220, 128, 115, '#f7d5b8');
        roundRect(ctx, cx - 132, 105, 264, 78, 32, '#334155');
        circle(ctx, cx - 44, 222, 18, '#1e293b', 'transparent', 0);
        circle(ctx, cx + 44, 222, 18, '#1e293b', 'transparent', 0);
        break;
      }

      case 'village_event_shop': {
        roundRect(ctx, cx - 260, 165, 520, 120, 32, '#0284c7');
        roundRect(ctx, cx - 275, 125, 550, 56, 24, '#e0f2fe');
        ellipse(ctx, cx, 315, 78, 70, '#f7d5b8');
        ellipse(ctx, cx, 265, 84, 38, '#1e293b');
        circle(ctx, cx - 26, 320, 12, '#1e293b', 'transparent', 0);
        circle(ctx, cx + 26, 320, 12, '#1e293b', 'transparent', 0);
        roundRect(ctx, cx - 220, 375, 440, 195, 24, '#92400e');
        circle(ctx, cx, 470, 48, '#e0f2fe', '#0284c7', 10);
        break;
      }

      case 'village_torii':
      default: {
        // Grand Vermilion Torii Gate
        roundRect(ctx, cx - 235, 210, 68, 420, 14, '#9e2118');
        roundRect(ctx, cx + 167, 210, 68, 420, 14, '#9e2118');
        roundRect(ctx, cx - 275, 270, 550, 56, 16, '#d93829');
        roundRect(ctx, cx - 335, 150, 670, 74, 24, '#d93829');
        roundRect(ctx, cx - 345, 130, 690, 30, 12, '#1e1619');
        roundRect(ctx, cx - 44, 210, 88, 72, 10, '#1e1619');
        break;
      }
    }
  });
}


/** Main character frame from the committed 4x4 sprite atlas. */
export function getFoxMikoAsset(
  dir: Direction,
  action: ActorAction,
  walkPhase: number
): HTMLCanvasElement {
  const row: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };
  const col = action === 'walk'
    ? (Math.floor(walkPhase) % 2) + 1
    : action === 'pickup' || action === 'hurt' ? 3 : 0;
  return getSvgAtlasFrame(
    ATLAS_PATHS.protagonist, 64, 96, col, row[dir], 64, 96, true
  ) ?? getMikoAsset(dir, action, walkPhase, 'default');
}

/** Event skin frame from the committed winter-accented 4x4 sprite atlas. */
export function getEventMikoAsset(
  dir: Direction,
  action: ActorAction,
  walkPhase: number
): HTMLCanvasElement {
  const row: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };
  const col = action === 'walk' ? (Math.floor(walkPhase) % 2) + 1 : action === 'pickup' || action === 'hurt' ? 3 : 0;
  const frame = EVENT_PROTAGONIST_ATLAS_PATH
    ? getSvgAtlasFrame(EVENT_PROTAGONIST_ATLAS_PATH, 64, 96, col, row[dir], 64, 96, true)
    : null;
  return frame ?? getMikoAsset(dir, action, walkPhase, 'winter_miko');
}
