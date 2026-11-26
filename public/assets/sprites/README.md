# Pixel-art asset atlases

Transparent pixel-art atlases used by the game runtime.

| File | Contents | Cell layout |
|---|---|---|
| `protagonist_atlas.svg` | Fox shrine maiden, four directions and four poses | 64×96, 4×4 |
| `event_protagonist_atlas.svg` | Event fox shrine maiden with winter-blue accents | 64×96, 4×4 |
| `enemy_atlas.png` | Dokkaebi, forest fairy, nine-tail yokai, tengu, kappa, yuki-onna | 96×96, 6×1 |
| `field_tiles_atlas.svg` | Forest, meadow, river, snow, stone and village ground | 128×90, 4×4 |
| `field_props_atlas.svg` | User-provided pixel-art herb, berry bush, shrine, torii, lantern, chest, snowflake, gold coin, frozen orb, crystal and signpost | 96×96, 6×2 |

The field props atlas keeps the original index mapping: row 1 is herb, berry, shrine, unused slot, torii and lantern; row 2 is chest, snowflake, gold coin, frozen orb, crystal and signpost. Each occupied cell contains one complete element with transparent padding. Its SVG uses vector masks to remove the checkerboard background while retaining the original pixel-art image from the adjacent source PNG.

Character rows: front, back, left, right. Character columns: idle, step A, step B, action. The field tile atlas is a 4×4 grid. The props atlas is a 6×2 grid.

Enemy sprites use procedural walk, idle-breathing, hover, hit and defeat motion in-game. Hold `Ctrl` and scroll the mouse wheel over the game viewport to zoom; the range is clamped to three steps in either direction.
