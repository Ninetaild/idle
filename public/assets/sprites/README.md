# Pixel-art asset atlases

Transparent pixel-art atlases used by the game runtime.

| File | Contents | Cell layout |
|---|---|---|
| `protagonist_atlas.svg` | Fox shrine maiden, four directions and four poses | 64×96, 4×4 |
| `enemy_atlas.png` | Dokkaebi, forest fairy, nine-tail yokai, tengu, kappa, yuki-onna | 96×96, 6×1 |
| `field_tiles_atlas.svg` | Forest, meadow, river, snow, stone and village ground | 128×90, 4×4 |
| `field_props_atlas.svg` | 약초, 열매, 신사, 도리이, 등불, 상자, 눈송이, 엽전, 얼음 구슬, 수정, 표지판 | 128×256, 6×2 |

The field props atlas has a 768×512 viewBox, a transparent background, and is loaded as a 6×2 grid of 128×256 cells. Index mapping: row 1 is herb, berry, shrine, unused slot, torii and lantern; row 2 is chest, snowflake, gold coin, frozen orb, crystal and signpost. Each cell is trimmed to its visible pixels; herb and berry are scaled into 96×68, other props into 96×96. If you re-export this atlas, remove the full-canvas background path.

All paths live in `src/game/assetPaths.ts`, and `src/game/assets.test.ts` fails if a listed file is missing. To connect new event or village art, add a 96×96 SVG here and replace the matching `null` in `STANDALONE_SPRITE_PATHS`. The winter skin has no atlas file and uses the canvas fallback until `EVENT_PROTAGONIST_ATLAS_PATH` is set.

Character rows: front, back, left, right. Character columns: idle, step A, step B, action. The field tile atlas is a 4×4 grid. The props atlas is a 6×2 grid.

## Next atlas worklist

The following elements are currently drawn by procedural canvas fallback or are not assigned an atlas cell. Create them as transparent, standalone SVG sprites first, then pack them into category-specific atlases and connect the paths in `src/game/assetPaths.ts`.

### 1. Field events — next priority
- `event_injured`: injured traveler
- `event_bandit`: disguised bandit; include both concealed/injured and revealed/hostile poses
- `event_fox_shrine`: lost baby fox
- `event_ancient_stone`: moss-covered ancient stone monument
- `event_peddler`: wandering herbalist with a basket/backpack

### 2. Village facilities
- `village_cauldron`: alchemy cauldron
- `village_merchant`: village menu attendant/NPC
- `village_event_shop`: event shop attendant/stall

### 3. Village scenery and landmarks
- `village_shrine`: already present in props atlas slot 2; verify placement/use before drawing again
- `village_torii`: already present in props atlas slot 4
- `village_lantern`: already present in props atlas slot 5
- Village courtyard, stone path and grass ground are already represented in `field_tiles_atlas.svg`

### 4. Field tiles and environmental objects
- `tree_green`: currently procedural fallback; add a leafy tree tile/object
- `tree_snow`: currently procedural fallback; add a snow-covered tree tile/object
- Existing field terrain tiles: forest moss, plains meadow, river shore, river water and snowy ground

### Already available; do not duplicate in the next batch
- Field gatherables: `herb`, `berry` (props atlas slots 0 and 1)
- Yokai: dokkaebi, fairy, gumiho, tengu, kappa and yuki-onna (currently in `enemy_atlas.png`)
- Additional props: chest, snowflake, gold coin, frozen orb, snow crystal and signpost (props atlas slots 6–11)

Enemy sprites use procedural walk, idle-breathing, hover, hit and defeat motion in-game. Hold `Ctrl` and scroll the mouse wheel over the game viewport to zoom; the range is clamped to three steps in either direction.
