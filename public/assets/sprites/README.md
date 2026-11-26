# Pixel-art asset atlases

Transparent pixel-art atlases used by the game runtime.

| File | Contents | Cell layout |
|---|---|---|
| `protagonist_atlas.svg` | Fox shrine maiden, four directions and four poses | 64×96, 4×4 |
| `event_protagonist_atlas.svg` | Event fox shrine maiden with winter-blue accents | 64×96, 4×4 |
| `enemy_atlas.png` | Dokkaebi, forest fairy, nine-tail yokai, tengu, kappa, yuki-onna | 96×96, 6×1 |
| `field_tiles_atlas.svg` | Forest, meadow, river, snow, stone and village ground | 128×90, 4×4 |
| `field_gatherable_herb.svg` | 약초 채집물 단독 벡터 스프라이트 | 96×96, 단일 요소 |
| `field_gatherable_berry.svg` | 열매 채집물 단독 벡터 스프라이트 | 96×96, 단일 요소 |
| `field_props_atlas.svg` | 신사, 도리이, 등불, 상자, 눈송이, 엽전, 얼음 구슬, 수정, 표지판 (약초·열매는 전용 파일 사용) | 128×256, 6×2 |

The uploaded field props atlas has a 768×512 viewBox and is loaded as a 6×2 grid of 128×256 cells. Index mapping: row 1 is herb (legacy slot), berry (legacy slot), shrine, unused slot, torii and lantern; row 2 is chest, snowflake, gold coin, frozen orb, crystal and signpost. Runtime crops each cell at its actual dimensions, then trims visible pixels and scales the result to 96×96. Herb and berry use their dedicated SVG files instead of the legacy atlas slots.

Character rows: front, back, left, right. Character columns: idle, step A, step B, action. The field tile atlas is a 4×4 grid. The props atlas is a 6×2 grid.

Enemy sprites use procedural walk, idle-breathing, hover, hit and defeat motion in-game. Hold `Ctrl` and scroll the mouse wheel over the game viewport to zoom; the range is clamped to three steps in either direction.


Gatherable asset paths are resolved independently in `src/game/hdAssets.ts`: `herb` → `assets/sprites/field_gatherable_herb.svg`, `berry` → `assets/sprites/field_gatherable_berry.svg`. Both files are standalone hand-authored SVG vector artwork with one object centered in a transparent 96×96 viewBox. The previous extracted art was replaced because its source contained visible background artifacts. Runtime output is 96×68 to match the field entity footprint.
