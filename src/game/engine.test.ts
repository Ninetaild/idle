import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALCHEMY_TABLE,
  ANCIENT_STONE_TABLE,
  BERRY_EFFECT_TABLE,
  ELITE_ENEMY_TABLE,
  FIELD_EVENT_TABLE,
  FIELD_SPAWN_TABLE,
  getDifficultyMultiplier,
  getEliteTable,
  getEnhancePool,
  HERB_GATHER_TABLE,
  rollWeighted,
  SNOWFLAKE_DROP_TABLE,
} from './probability';
import { computePixelViewport, screenToWorld } from './viewport';
import { getVisiblePixelBounds } from './hdAssets';
import {
  attemptEnhanceCharm,
  imbueCharm,
  applyAbilities,
  convertSkill,
  getSkillMultiplier,
  scaleReward,
  FIELD_ENTITY_LIMITS,
  getFieldDifficulty,
  setFieldDifficulty,
  rollSkillMultiplier,
  SKILL_DEFINITIONS,
  craftElixirFromHerb,
  createInitialInventory,
  createInitialStats,
  eatFieldBerry,
  equipMikoSkin,
  FIELD_METADATA,
  gatherFieldHerb,
  purchaseWinterMikoSkin,
  resolveFieldEvent,
  rollSnowflakeDrop,
  selectAutoOrPriorityTarget,
  sellPillsToMerchant,
  sellHerbsToMerchant,
  STOMACHACHE_DURATION_SEC,
  PLAYER_RANGED_ATTACK_COOLDOWN_SEC,
  canSpawnEntityKind,
  shouldInteractWithBerry,
} from './logic';
import { getRiverColumn, isBeyondDespawnRange, pickSpawnPoint, RIVER_PERIOD } from './world';
import type { WorldEntity } from './types';

test('sprite frame trimming detects visible alpha bounds and ignores transparent padding', () => {
  const width = 5;
  const height = 4;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
    rgba[(y * width + x) * 4 + 3] = 255;
  }
  assert.deepEqual(getVisiblePixelBounds(rgba, width, height), {
    x: 1,
    y: 1,
    width: 2,
    height: 2,
  });
  assert.equal(getVisiblePixelBounds(new Uint8ClampedArray(width * height * 4), width, height), null);
});

test('weighted tables match specified probabilities accurately', () => {
  assert.equal(rollWeighted(FIELD_SPAWN_TABLE, () => 0.0).code, 1);
  assert.equal(rollWeighted(FIELD_SPAWN_TABLE, () => 0.4).code, 2);
  assert.equal(rollWeighted(FIELD_SPAWN_TABLE, () => 0.8).code, 3);
  assert.equal(rollWeighted(FIELD_SPAWN_TABLE, () => 0.95).code, 4);

  assert.equal(rollWeighted(ALCHEMY_TABLE, () => 0.4).code, 1);
  assert.equal(rollWeighted(ALCHEMY_TABLE, () => 0.7).code, 2);
  assert.equal(rollWeighted(ALCHEMY_TABLE, () => 0.95).code, 3);

  assert.equal(rollWeighted(HERB_GATHER_TABLE, () => 0.2).code, 1);
  assert.equal(rollWeighted(HERB_GATHER_TABLE, () => 0.7).code, 2);
  assert.equal(rollWeighted(HERB_GATHER_TABLE, () => 0.95).code, 3);

  assert.equal(rollWeighted(BERRY_EFFECT_TABLE, () => 0.1).code, 1);
  assert.equal(rollWeighted(BERRY_EFFECT_TABLE, () => 0.3).code, 2);
  assert.equal(rollWeighted(BERRY_EFFECT_TABLE, () => 0.6).code, 3);
  assert.equal(rollWeighted(BERRY_EFFECT_TABLE, () => 0.8).code, 4);
  assert.equal(rollWeighted(BERRY_EFFECT_TABLE, () => 0.95).code, 5);

  assert.equal(rollWeighted(FIELD_EVENT_TABLE, () => 0.1).code, 1);
  assert.equal(rollWeighted(FIELD_EVENT_TABLE, () => 0.4).code, 2);
  assert.equal(rollWeighted(FIELD_EVENT_TABLE, () => 0.6).code, 3);
  assert.equal(rollWeighted(FIELD_EVENT_TABLE, () => 0.8).code, 4);
  assert.equal(rollWeighted(FIELD_EVENT_TABLE, () => 0.95).code, 5);

  assert.equal(rollWeighted(ANCIENT_STONE_TABLE, () => 0.2).code, 1);
  assert.equal(rollWeighted(ANCIENT_STONE_TABLE, () => 0.6).code, 2);
  assert.equal(rollWeighted(ANCIENT_STONE_TABLE, () => 0.9).code, 3);

  assert.equal(rollWeighted(SNOWFLAKE_DROP_TABLE, () => 0.001).code, 1);
  assert.equal(rollWeighted(SNOWFLAKE_DROP_TABLE, () => 0.009).code, 2);
  assert.equal(rollWeighted(SNOWFLAKE_DROP_TABLE, () => 0.5).code, 3);
});

test('charm enhancement has only success/maintain and multiplies attack and cost by 1.1', () => {
  const stats = { ...createInitialStats(), gold: 10000 };
  const inv = createInitialInventory();
  const success = attemptEnhanceCharm(stats, inv, () => 0);
  assert.equal(success.stats.enhanceLevel, 1);
  assert.equal(success.stats.attackPower, 15.4);
  assert.equal(success.stats.enhanceCost, 66);
  const pool = getEnhancePool(1);
  assert.deepEqual(pool.map((entry) => entry.code), ['success', 'maintain']);
  assert.equal(pool.reduce((sum, entry) => sum + entry.per, 0), 1);
  const maintain = attemptEnhanceCharm(stats, inv, () => 0.99);
  assert.equal(maintain.stats.enhanceLevel, 0);
  assert.equal(maintain.stats.attackPower, stats.attackPower);
  assert.equal(maintain.stats.enhanceCost, 60);
});

test('tiered herb gathering, berry eating, and alchemy outcomes apply accurately', () => {
  const stats = { ...createInitialStats(), hp: 50 };
  const inv = createInitialInventory(); // 3 herbs, 1 elixir

  const herbRare = gatherFieldHerb(stats, inv, () => 0.95);
  assert.equal(herbRare.inventory.herbs, 6);
  assert.equal(herbRare.stats.hp, 55);

  assert.equal(STOMACHACHE_DURATION_SEC, 2);
  const berryStomach = eatFieldBerry(stats, inv, () => 0.05);
  assert.equal(berryStomach.stats.stomachacheTimer, 2);

  const berryGolden = eatFieldBerry(stats, inv, () => 0.95);
  assert.equal(berryGolden.stats.hp, 85);
  assert.equal(berryGolden.stats.gold, stats.gold + 15);

  const alchemyGreat = craftElixirFromHerb(stats, inv, () => 0.95);
  assert.equal(alchemyGreat.inventory.herbs, 2);
  assert.equal(alchemyGreat.inventory.elixirs, 3);
});

test('merchant buys elixirs and dud pills for gold', () => {
  const stats = createInitialStats();
  const inv = { herbs: 0, berries: 0, elixirs: 2, dudPills: 3, snowflakes: 0 };

  const afterElixir = sellPillsToMerchant(stats, inv, 'elixir', 1);
  assert.equal(afterElixir.stats.gold, stats.gold + 45);
  assert.equal(afterElixir.inventory.elixirs, 1);

  const afterDud = sellPillsToMerchant(afterElixir.stats, afterElixir.inventory, 'dudPill', 3);
  assert.equal(afterDud.stats.gold, stats.gold + 60);
  assert.equal(afterDud.inventory.dudPills, 0);
});

test('merchant buys field herbs at the listed field-resource price', () => {
  const stats = createInitialStats();
  const inv = { ...createInitialInventory(), herbs: 4 };
  const sold = sellHerbsToMerchant(stats, inv, 3);
  assert.equal(sold.stats.gold, stats.gold + 36);
  assert.equal(sold.inventory.herbs, 1);
});

test('new field events (injured, bandit, lost fox, ancient stone, peddler) resolve properly', () => {
  const stats = createInitialStats();
  const inv = createInitialInventory();

  const fox = resolveFieldEvent(stats, inv, 3);
  assert.equal(fox.triggerCombat, false);
  assert.equal(fox.stats.goodDeeds, 1);
  assert.equal(fox.inventory.elixirs, 2);

  const stoneBless = resolveFieldEvent({ ...stats, hp: 60 }, inv, 4, () => 0.1);
  assert.equal(stoneBless.stats.maxHp, 105);
  assert.equal(stoneBless.stats.hp, 85);

  const peddler = resolveFieldEvent(stats, inv, 5);
  assert.equal(peddler.inventory.herbs, inv.herbs + 2);
  assert.equal(peddler.stats.gold, stats.gold + 18);

  const bandit = resolveFieldEvent(stats, inv, 2);
  assert.equal(bandit.triggerCombat, true);
});

test('open vs event fields and snowflake drop + winter miko skin shop work cleanly', () => {
  assert.equal(FIELD_METADATA.forest.category, 'open');
  assert.equal(FIELD_METADATA.plains.category, 'open');
  assert.equal(FIELD_METADATA.river.category, 'open');
  assert.equal(FIELD_METADATA.snowy_forest.category, 'event');

  const inv = createInitialInventory();
  const normalDrop = rollSnowflakeDrop('forest', inv, () => 0.01);
  assert.equal(normalDrop.gained, 0);

  const snowDrop = rollSnowflakeDrop('snowy_forest', inv, () => 0.001);
  assert.equal(snowDrop.gained, 1);
  assert.equal(snowDrop.inventory.snowflakes, 1);

  const stats = createInitialStats();
  const richInv = { ...inv, snowflakes: 500 };
  const unlocked = purchaseWinterMikoSkin(stats, richInv);
  assert.equal(unlocked.code, 1);
  assert.equal(unlocked.inventory.snowflakes, 0);
  assert.equal(unlocked.stats.equippedSkin, 'winter_miko');

  const swappedBack = equipMikoSkin(unlocked.stats, 'default');
  assert.equal(swappedBack.equippedSkin, 'default');
});

test('viewport expands visible range with web resolution while keeping 1024:720 tile ratio', () => {
  const mobile = computePixelViewport(390, 844);
  const desktop = computePixelViewport(1440, 900);

  assert.ok(desktop.logicalWidth > mobile.logicalWidth);
  assert.ok(desktop.visibleCols > mobile.visibleCols);

  const worldPt = screenToWorld(
    720,
    450,
    { left: 0, top: 0, width: 1440, height: 900 },
    desktop,
    100,
    200
  );
  assert.ok(Math.abs(worldPt.worldX - 100) < 2);
  assert.ok(Math.abs(worldPt.worldY - 200) < 2);
});

test('berries are unavailable at 80% HP or above', () => {
  const berry: WorldEntity = {
    id: 'berry-cap', kind: 'berry', name: '알 수 없는 열매', x: 10, y: 0,
    vx: 0, vy: 0, hp: 1, maxHp: 1, dir: 'down', action: 'idle',
    actionTimer: 0, aiTimer: 0, attackCooldown: 0, telegraphTimer: 0,
    hitFlashTimer: 0, koTimer: 0, isHostile: false, isInteractable: true,
  };
  assert.equal(shouldInteractWithBerry(79, 100), true);
  assert.equal(shouldInteractWithBerry(80, 100), false);
  assert.equal(shouldInteractWithBerry(100, 100), false);
  assert.equal(selectAutoOrPriorityTarget(0, 0, [berry], 'berry-cap', false), null);
  assert.equal(PLAYER_RANGED_ATTACK_COOLDOWN_SEC, 10);
});

test('a field entity kind cannot spawn beyond its own limit', () => {
  const herb: WorldEntity = {
    id: 'herb-cap-1', kind: 'herb', name: '알 수 없는 풀', x: 0, y: 0,
    vx: 0, vy: 0, hp: 1, maxHp: 1, dir: 'down', action: 'idle',
    actionTimer: 0, aiTimer: 0, attackCooldown: 0, telegraphTimer: 0,
    hitFlashTimer: 0, koTimer: 0, isHostile: false, isInteractable: true,
  };
  const fullHerbs = Array.from({ length: FIELD_ENTITY_LIMITS.herb }, (_, i) => ({ ...herb, id: `herb-cap-${i}` }));
  assert.equal(canSpawnEntityKind('herb', fullHerbs), false);
  assert.equal(canSpawnEntityKind('berry', fullHerbs), true);
  assert.equal(canSpawnEntityKind('herb', fullHerbs.slice(1)), true);
  assert.equal(FIELD_ENTITY_LIMITS.event_fox_shrine, 1);
});

test('priority target overrides nearest auto-target until resolved', () => {
  const nearHerb: WorldEntity = {
    id: 'herb-1',
    kind: 'herb',
    name: '알 수 없는 풀',
    x: 10,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 1,
    maxHp: 1,
    dir: 'down',
    action: 'idle',
    actionTimer: 0,
    aiTimer: 0,
    attackCooldown: 0,
    telegraphTimer: 0,
    hitFlashTimer: 0,
    koTimer: 0,
    isHostile: false,
    isInteractable: true,
  };
  const farBerry: WorldEntity = {
    ...nearHerb,
    id: 'berry-1',
    kind: 'berry',
    name: '알 수 없는 열매',
    x: 120,
    y: 40,
  };

  const auto = selectAutoOrPriorityTarget(0, 0, [nearHerb, farBerry], null);
  assert.equal(auto?.id, 'herb-1');

  const prioritized = selectAutoOrPriorityTarget(0, 0, [nearHerb, farBerry], 'berry-1');
  assert.equal(prioritized?.id, 'berry-1');
});


test('field difficulty is independently clamped for each field', () => {
  const stats = setFieldDifficulty(createInitialStats(), 'forest', 12);
  assert.equal(getFieldDifficulty(stats, 'forest'), 10);
  assert.equal(getFieldDifficulty(stats, 'river'), 1);
});

test('ability imprint spends a jewel and grants three distinct abilities with median 1.3', () => {
  const stats = createInitialStats();
  const inventory = { ...createInitialInventory(), jewels: 1 };
  const result = imbueCharm(stats, inventory, () => 0.5);
  assert.equal(result.inventory.jewels, 0);
  assert.deepEqual(result.stats.abilities, [], 'options are not applied until accepted');
  assert.equal(result.candidate?.length, 3);
  assert.equal(new Set(result.candidate?.map((ability) => ability.id)).size, 3);
  assert.deepEqual(applyAbilities(result.stats, result.candidate!).abilities, result.candidate);
  const values = (result.candidate ?? []).map((ability) => ability.multiplier).sort((a, b) => a - b);
  assert.equal(values[1], 1.3);
});


test('equipped skills roll within the correct damage range for their type', () => {
  assert.equal(rollSkillMultiplier('foxfire_burst', () => 0), 0.7);
  assert.equal(rollSkillMultiplier('foxfire_burst', () => 0.999999), 1.0);
  assert.equal(rollSkillMultiplier('purification_bolt', () => 0), 1.2);
  assert.equal(rollSkillMultiplier('purification_bolt', () => 0.999999), 1.5);
  for (const skill of Object.values(SKILL_DEFINITIONS)) {
    const low = skill.type === 'area' ? 0.7 : 1.2;
    const high = skill.type === 'area' ? 1.0 : 1.5;
    const rolled = rollSkillMultiplier(
      Object.entries(SKILL_DEFINITIONS).find(([, value]) => value === skill)![0] as keyof typeof SKILL_DEFINITIONS,
      () => 0.5
    );
    assert.ok(rolled >= low && rolled <= high);
  }
});


test('elite appearance is rolled only by the enemy table at 10 percent', () => {
  assert.equal(ELITE_ENEMY_TABLE.find((entry) => entry.code === 'elite')?.per, 0.1);
  assert.equal(rollWeighted(ELITE_ENEMY_TABLE, () => 0.899999).code, 'normal');
  assert.equal(rollWeighted(ELITE_ENEMY_TABLE, () => 0.9).code, 'elite');
  assert.equal(ELITE_ENEMY_TABLE.reduce((sum, entry) => sum + entry.per, 0), 1);
});

test('replacing max HP options keeps the HP ratio without stacking', () => {
  const base = { ...createInitialStats(), hp: 50 };
  const boosted = applyAbilities(base, [{ id: 'max_hp', multiplier: 1.3 }]);
  assert.equal(boosted.maxHp, 130);
  assert.equal(boosted.hp, 65);
  const removed = applyAbilities(boosted, [{ id: 'gold_gain', multiplier: 1.2 }]);
  assert.equal(removed.maxHp, 100);
  assert.equal(removed.hp, 50);
});

test('technique conversion spends a jewel and fixes a random type and multiplier', () => {
  const inventory = { ...createInitialInventory(), jewels: 2 };
  const first = convertSkill(createInitialStats(), inventory, () => 0);
  assert.equal(first.stats.equippedSkill, 'foxfire_burst');
  assert.equal(getSkillMultiplier(first.stats), 0.7);
  assert.equal(first.inventory.jewels, 1);
  const second = convertSkill(first.stats, first.inventory, () => 0.999999);
  assert.equal(SKILL_DEFINITIONS[second.stats.equippedSkill!].type, 'single');
  assert.equal(getSkillMultiplier(second.stats), 1.5);
  assert.equal(convertSkill(second.stats, second.inventory).code, 'insufficient');
  assert.equal(getSkillMultiplier(createInitialStats()), 0.85);
});

test('difficulty compounds rewards and elite odds by 1.1 per level', () => {
  assert.equal(getDifficultyMultiplier(1), 1);
  assert.ok(Math.abs(getDifficultyMultiplier(3) - 1.21) < 1e-9);
  assert.ok(Math.abs(getEliteTable(1)[1].per - 0.1) < 1e-9);
  assert.ok(Math.abs(getEliteTable(10)[1].per - 0.1 * 1.1 ** 9) < 1e-9);
  assert.equal(scaleReward(1, 1.1, () => 0.05), 2);
  assert.equal(scaleReward(1, 1.1, () => 0.5), 1);
  const peddler = resolveFieldEvent(createInitialStats(), createInitialInventory(), 5, Math.random, getDifficultyMultiplier(3));
  assert.equal(peddler.stats.gold, createInitialStats().gold + 22);
});

test('the endless world repeats the river and recycles distant entities', () => {
  for (let col = -40; col < 40; col++) assert.equal(getRiverColumn(col), getRiverColumn(col + RIVER_PERIOD));
  assert.equal(getRiverColumn(0), 'land');
  const view = { width: 1200, height: 700 };
  for (let i = 0; i < 200; i++) {
    const point = pickSpawnPoint(-5000, 9000, view, true);
    assert.ok(Math.abs(point.x + 5000) > 600 || Math.abs(point.y - 9000) > 350);
    assert.equal(isBeyondDespawnRange(-5000, 9000, point.x, point.y, view), false);
  }
  assert.equal(isBeyondDespawnRange(0, 0, 5000, 0, view), true);
});
