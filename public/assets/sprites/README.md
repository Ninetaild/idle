# Pixel-art asset atlases

Transparent enemy sprite atlas in WebP format; character cells are 96×96 and drawn with nearest-neighbor sampling.

| File | Contents | Cell layout |
|---|---|---|
| `protagonist_atlas.svg` | Fox shrine maiden, four directions and four poses | 64×96, 4×4 |
| `event_protagonist_atlas.svg` | Event fox shrine maiden with winter-blue accents | 64×96, 4×4 |
| `enemy_atlas.webp` | Dokkaebi, forest fairy, nine-tail yokai, tengu, kappa, yuki-onna | 96×96, 6×1 |
| `field_tiles_atlas.svg` | Forest, meadow, river, snow, stone and village ground | 128×90, 4×4 |
| `field_props_atlas.svg` | Herbs, berries, shrine, torii, lantern, chest and collectibles | 96×96, 6×2 |

Character rows: front, back, left, right. Character columns: idle, step A, step B, action. The field tile atlas is a 4×4 grid. The props atlas is a 6×2 grid.

Game zoom: hold `Ctrl` and scroll the mouse wheel over the game viewport. The zoom range is clamped to three steps in either direction.
