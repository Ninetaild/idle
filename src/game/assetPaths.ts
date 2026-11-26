/**
 * Single source of truth for runtime image paths (relative to `public/`).
 * Every path listed here must exist in the repository; `assets.test.ts` enforces it.
 */
export const ATLAS_PATHS = {
  protagonist: 'assets/sprites/protagonist_atlas.svg',
  enemy: 'assets/sprites/enemy_atlas.png',
  fieldTiles: 'assets/sprites/field_tiles_atlas.svg',
  fieldProps: 'assets/sprites/field_props_atlas.svg',
} as const;

/**
 * Winter skin atlas. No file is committed yet, so the canvas fallback is drawn
 * without requesting a missing URL. Set the path here after adding the file.
 */
export const EVENT_PROTAGONIST_ATLAS_PATH: string | null = null;

/** field_props_atlas.svg: 768x512, six 128x256 cells per row. */
export const PROPS_CELL = { width: 128, height: 256, columns: 6 } as const;

export const PROP_ATLAS_INDEX: Readonly<Record<string, number>> = {
  herb: 0,
  berry: 1,
  village_shrine: 2,
  village_torii: 4,
  village_lantern: 5,
  village_chest: 6,
  snowflake: 7,
  gold_coin: 8,
  snowflake_pickup: 9,
  snowflake_crystal: 10,
  village_sign: 11,
};

export const ENEMY_ATLAS_INDEX: Readonly<Record<string, number>> = {
  yokai_dokkaebi: 0,
  fairy_sylph: 1,
  yokai_gumiho: 2,
  yokai_tengu: 3,
  yokai_kappa: 4,
  yokai_yukionna: 5,
};

/**
 * Standalone sprites for field events and village facilities. `null` means there
 * is no artwork yet and the procedural canvas drawing is used.
 */
export const STANDALONE_SPRITE_PATHS: Readonly<Record<string, string | null>> = {
  event_injured: null,
  event_bandit: null,
  event_bandit_revealed: null,
  event_fox_shrine: null,
  event_ancient_stone: null,
  event_peddler: null,
  village_cauldron: null,
  village_merchant: null,
  village_event_shop: null,
};
