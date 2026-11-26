import {
  ALCHEMY_TABLE,
  ANCIENT_STONE_TABLE,
  BERRY_EFFECT_TABLE,
  FIELD_EVENT_TABLE,
  getEnhancePool,
  HERB_GATHER_TABLE,
  rollWeighted,
  SNOWFLAKE_DROP_TABLE,
} from './probability';
import type {
  FieldId,
  Inventory,
  MikoSkinId,
  PlayerStats,
  WorldEntity,
  AbilityId,
  SkillId,
  AbilityRoll,
} from './types';

export const ECONOMY_PRICES = {
  elixirSell: 45,
  dudPillSell: 5,
  baseEnhanceCost: 60,
  enhanceCostMultiplier: 1.1,
  abilityImprintJewels: 1,
  skillChangeJewels: 1,
  winterMikoSnowflakes: 500,
  herbSell: 12,
} as const;

export const STOMACHACHE_DURATION_SEC = 2;
export const PLAYER_RANGED_ATTACK_COOLDOWN_SEC = 10;
export const MAX_FIELD_ENTITY_KIND_COUNT = 3;

export function canSpawnEntityKind(kind: WorldEntity['kind'], entities: readonly WorldEntity[], maxCount = MAX_FIELD_ENTITY_KIND_COUNT): boolean {
  return entities.filter((entity) => entity.kind === kind && entity.hp > 0 && entity.koTimer <= 0).length < maxCount;
}

export function shouldInteractWithBerry(hp: number, maxHp: number): boolean {
  return maxHp > 0 && hp / maxHp < 0.8;
}

export const FIELD_METADATA: Record<
  FieldId,
  { name: string; category: 'open' | 'event'; subtitle: string }
> = {
  forest: {
    name: '숲',
    category: 'open',
    subtitle: '울창한 소나무와 이끼 낀 약초 숲',
  },
  plains: {
    name: '평원',
    category: 'open',
    subtitle: '들꽃이 피어난 따스한 바람 평원',
  },
  river: {
    name: '강가',
    category: 'open',
    subtitle: '맑은 시냇물이 흐르는 자갈 강변',
  },
  snowy_forest: {
    name: '눈 쌓인 숲',
    category: 'event',
    subtitle: '겨울 이벤트 · 눈송이 획득 가능',
  },
};

export interface ActionOutcome {
  stats: PlayerStats;
  inventory: Inventory;
  message: string;
  tone: 'neutral' | 'positive' | 'warning' | 'combat';
  code: number | string;
}

export function createInitialStats(): PlayerStats {
  return {
    hp: 100,
    maxHp: 100,
    gold: 60,
    goodDeeds: 0,
    attackPower: 14,
    enhanceLevel: 0,
    enhanceCost: ECONOMY_PRICES.baseEnhanceCost,
    stomachacheTimer: 0,
    totalDefeated: 0,
    totalGathered: 0,
    unlockedSkins: ['default'],
    equippedSkin: 'default',
    abilities: [],
    equippedSkill: 'foxfire_burst',
    fieldDifficulties: { forest: 1, plains: 1, river: 1, snowy_forest: 1 },
  };
}

export function createInitialInventory(): Inventory {
  return {
    herbs: 3,
    berries: 0,
    elixirs: 1,
    dudPills: 0,
    snowflakes: 0,
    eventTokens: 0,
    jewels: 0,
  };
}

/**
 * Multi-tier Village Alchemy:
 * - code 1 (0.65): Dud pill +1
 * - code 2 (0.25): Elixir +1
 * - code 3 (0.10): Elixir +2
 */
export function craftElixirFromHerb(
  stats: PlayerStats,
  inventory: Inventory,
  rng: () => number = Math.random
): ActionOutcome {
  if (inventory.herbs < 1) {
    return {
      stats,
      inventory,
      message: '알 수 없는 풀이 부족합니다. 필드에서 풀을 채집하세요.',
      tone: 'warning',
      code: 0,
    };
  }

  const rolled = rollWeighted(ALCHEMY_TABLE, rng);
  const elixirGain = rolled.code === 3 ? 2 : rolled.code === 2 ? 1 : 0;
  const dudGain = rolled.code === 1 ? 1 : 0;

  return {
    stats,
    inventory: {
      ...inventory,
      herbs: inventory.herbs - 1,
      dudPills: inventory.dudPills + dudGain,
      elixirs: inventory.elixirs + elixirGain,
    },
    message: rolled.text,
    tone: elixirGain > 0 ? 'positive' : 'neutral',
    code: rolled.code,
  };
}

/**
 * Village Merchant: Sells elixirs or dud pills for gold.
 */
export function sellPillsToMerchant(
  stats: PlayerStats,
  inventory: Inventory,
  item: 'elixir' | 'dudPill',
  quantity = 1
): ActionOutcome {
  const available = item === 'elixir' ? inventory.elixirs : inventory.dudPills;
  const sellQty = Math.min(available, Math.max(0, Math.floor(quantity)));

  if (sellQty <= 0) {
    return {
      stats,
      inventory,
      message:
        item === 'elixir' ? '판매할 단약이 없습니다.' : '판매할 효과 없는 약이 없습니다.',
      tone: 'warning',
      code: 0,
    };
  }

  const unitPrice =
    item === 'elixir' ? ECONOMY_PRICES.elixirSell : ECONOMY_PRICES.dudPillSell;
  const earned = Math.round(sellQty * unitPrice * getAbilityMultiplier(stats, 'gold_gain'));

  return {
    stats: {
      ...stats,
      gold: stats.gold + earned,
    },
    inventory: {
      ...inventory,
      elixirs: item === 'elixir' ? inventory.elixirs - sellQty : inventory.elixirs,
      dudPills: item === 'dudPill' ? inventory.dudPills - sellQty : inventory.dudPills,
    },
    message: `${item === 'elixir' ? '단약' : '효과 없는 약'} ${sellQty}개를 상인에게 팔아 ${earned}엽전을 얻었다.`,
    tone: 'positive',
    code: 1,
  };
}

/**
 * Charm enhancement: success increases attack power by 10%; failure only maintains.
 */
export function attemptEnhanceCharm(stats: PlayerStats, inventory: Inventory, rng: () => number = Math.random): ActionOutcome {
  if (stats.gold < stats.enhanceCost) return { stats, inventory, message: `엽전이 부족합니다. (필요: ${stats.enhanceCost}엽전)`, tone: 'warning', code: 'insufficient' };
  const rolled = rollWeighted(getEnhancePool(stats.enhanceLevel), rng);
  const success = rolled.code === 'success';
  const nextLevel = stats.enhanceLevel + (success ? 1 : 0);
  const nextAttack = success ? Number((stats.attackPower * 1.1).toFixed(2)) : stats.attackPower;
  const nextCost = Math.round(ECONOMY_PRICES.baseEnhanceCost * Math.pow(ECONOMY_PRICES.enhanceCostMultiplier, nextLevel));
  return {
    stats: { ...stats, gold: stats.gold - stats.enhanceCost, enhanceLevel: nextLevel, enhanceCost: nextCost, attackPower: nextAttack },
    inventory,
    message: success ? `강화 성공! 공격력이 1.1배 증가했습니다. (+${nextLevel}단계 · 공격력 ${nextAttack})` : `강화 유지. 기운이 그대로 머물렀습니다. (+${nextLevel}단계)`,
    tone: success ? 'positive' : 'neutral',
    code: rolled.code,
  };
}

export const ABILITY_LABELS: Record<AbilityId, string> = {
  attack_power: '공격력', max_hp: '최대 체력', gold_gain: '재화 획득량',
  attack_frequency: '공격 내부 쿨다운 감소', attack_speed: '공격 속도',
};

export interface SkillDefinition {
  name: string;
  type: 'area' | 'single';
  minMultiplier: number;
  maxMultiplier: number;
  description: string;
}

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  foxfire_burst: { name: '여우불 폭발', type: 'area', minMultiplier: 0.7, maxMultiplier: 1.0, description: '주변 적에게 함께 피해를 주는 범위 기술' },
  purification_bolt: { name: '퇴마의 화살', type: 'single', minMultiplier: 1.2, maxMultiplier: 1.5, description: '한 대상에게 강한 피해를 주는 단일 기술' },
  frost_ring: { name: '빙결의 고리', type: 'area', minMultiplier: 0.7, maxMultiplier: 1.0, description: '넓은 범위에 서리 피해를 주는 기술' },
  wind_slash: { name: '풍신참', type: 'single', minMultiplier: 1.2, maxMultiplier: 1.5, description: '한 대상에게 큰 피해를 주는 단일 기술' },
};

export function rollSkillMultiplier(skillId: SkillId, rng: () => number = Math.random): number {
  const skill = SKILL_DEFINITIONS[skillId];
  const roll = Math.max(0, Math.min(0.999999999, rng()));
  return Number((skill.minMultiplier + (skill.maxMultiplier - skill.minMultiplier) * roll).toFixed(2));
}

export function getAbilityMultiplier(stats: PlayerStats, id: AbilityId): number {
  return stats.abilities?.find((ability) => ability.id === id)?.multiplier ?? 1;
}
export function getFieldDifficulty(stats: PlayerStats, fieldId: FieldId): number {
  return Math.max(1, Math.min(10, Math.floor(stats.fieldDifficulties?.[fieldId] ?? 1)));
}
export function setFieldDifficulty(stats: PlayerStats, fieldId: FieldId, level: number): PlayerStats {
  return { ...stats, fieldDifficulties: { forest: 1, plains: 1, river: 1, snowy_forest: 1, ...stats.fieldDifficulties, [fieldId]: Math.max(1, Math.min(10, Math.floor(level))) } };
}
export function imbueCharm(stats: PlayerStats, inventory: Inventory, rng: () => number = Math.random): ActionOutcome {
  const jewels = inventory.jewels ?? 0;
  if (jewels < ECONOMY_PRICES.abilityImprintJewels) return { stats, inventory, message: `보옥이 부족합니다. (필요: ${ECONOMY_PRICES.abilityImprintJewels}개)`, tone: 'warning', code: 'insufficient' };
  const ids: AbilityId[] = ['attack_power', 'max_hp', 'gold_gain', 'attack_frequency', 'attack_speed'];
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const rolls = [1.1 + rng() * 0.1, 1.3, 1.4 + rng() * 0.1];
  const abilities: AbilityRoll[] = shuffled.slice(0, 3).map((id, index) => ({ id, multiplier: Number(rolls[index].toFixed(2)) }));
  const oldHp = getAbilityMultiplier(stats, 'max_hp');
  const newHp = abilities.find((ability) => ability.id === 'max_hp')?.multiplier ?? 1;
  const hpRatio = stats.maxHp > 0 ? stats.hp / stats.maxHp : 1;
  const nextMaxHp = Math.round((stats.maxHp / oldHp) * newHp);
  return {
    stats: { ...stats, abilities, maxHp: nextMaxHp, hp: Math.min(nextMaxHp, Math.round(nextMaxHp * hpRatio)) },
    inventory: { ...inventory, jewels: jewels - ECONOMY_PRICES.abilityImprintJewels },
    message: `능력 부여 완료! ${abilities.map((a) => `${ABILITY_LABELS[a.id]} ×${a.multiplier.toFixed(2)}`).join(' · ')}`,
    tone: 'positive', code: 'imbued',
  };
}
export function changeEquippedSkill(stats: PlayerStats, inventory: Inventory, skill: SkillId): ActionOutcome {
  const jewels = inventory.jewels ?? 0;
  if (stats.equippedSkill === skill) return { stats, inventory, message: '이미 선택한 기술입니다.', tone: 'neutral', code: 'unchanged' };
  if (jewels < ECONOMY_PRICES.skillChangeJewels) return { stats, inventory, message: `보옥이 부족합니다. (필요: ${ECONOMY_PRICES.skillChangeJewels}개)`, tone: 'warning', code: 'insufficient' };
  return { stats: { ...stats, equippedSkill: skill }, inventory: { ...inventory, jewels: jewels - ECONOMY_PRICES.skillChangeJewels }, message: `기술을 ${SKILL_DEFINITIONS[skill].name}(으)로 변경했습니다.`, tone: 'positive', code: 'changed' };
}

/**
 * Multi-tier Field Herb Gathering
 */
export function gatherFieldHerb(
  stats: PlayerStats,
  inventory: Inventory,
  rng: () => number = Math.random
): ActionOutcome {
  const rolled = rollWeighted(HERB_GATHER_TABLE, rng);
  const herbGain = rolled.code === 3 ? 3 : rolled.code === 2 ? 2 : 1;
  const hpGain = rolled.code === 3 ? 5 : 0;

  return {
    stats: {
      ...stats,
      hp: Math.min(stats.maxHp, stats.hp + hpGain),
      totalGathered: stats.totalGathered + 1,
    },
    inventory: {
      ...inventory,
      herbs: inventory.herbs + herbGain,
    },
    message: rolled.text,
    tone: 'positive',
    code: rolled.code,
  };
}

/**
 * Multi-tier Field Berry Consumption
 */
export function eatFieldBerry(
  stats: PlayerStats,
  inventory: Inventory,
  rng: () => number = Math.random
): ActionOutcome {
  const rolled = rollWeighted(BERRY_EFFECT_TABLE, rng);

  if (rolled.code === 1) {
    return {
      stats: {
        ...stats,
        stomachacheTimer: STOMACHACHE_DURATION_SEC,
        totalGathered: stats.totalGathered + 1,
      },
      inventory,
      message: rolled.text,
      tone: 'warning',
      code: 1,
    };
  }

  const healMap: Record<number, number> = { 2: 8, 3: 14, 4: 22, 5: 35 };
  const goldBonus = rolled.code === 5 ? Math.round(15 * getAbilityMultiplier(stats, 'gold_gain')) : 0;

  return {
    stats: {
      ...stats,
      hp: Math.min(stats.maxHp, stats.hp + (healMap[rolled.code] ?? 10)),
      gold: stats.gold + goldBonus,
      totalGathered: stats.totalGathered + 1,
    },
    inventory,
    message: rolled.text,
    tone: 'positive',
    code: rolled.code,
  };
}

/**
 * Resolves a field event encounter across 5 event types (Injured, Bandit, Lost Fox, Ancient Stone, Peddler).
 */
export function resolveFieldEvent(
  stats: PlayerStats,
  inventory: Inventory,
  eventCode: 1 | 2 | 3 | 4 | 5 | null = null,
  rng: () => number = Math.random
): ActionOutcome & { triggerCombat: boolean } {
  const chosenCode = eventCode ?? rollWeighted(FIELD_EVENT_TABLE, rng).code;

  if (chosenCode === 2) {
    return {
      stats,
      inventory,
      message: '다친 척 위장한 강도가 칼을 빼들었다!',
      tone: 'combat',
      code: 2,
      triggerCombat: true,
    };
  }

  if (chosenCode === 1) {
    if (inventory.elixirs >= 1) {
      return {
        stats: {
          ...stats,
          goodDeeds: stats.goodDeeds + 1,
          gold: stats.gold + Math.round(25 * getAbilityMultiplier(stats, 'gold_gain')),
        },
        inventory: {
          ...inventory,
          elixirs: inventory.elixirs - 1,
        },
        message: '다친 사람에게 단약을 건네주었다. (단약 -1, 선행 +1, 답례 25엽전)',
        tone: 'positive',
        code: 1,
        triggerCombat: false,
      };
    }
    return {
      stats,
      inventory,
      message: '다친 사람을 발견했으나 건넬 단약이 없다.',
      tone: 'warning',
      code: 1,
      triggerCombat: false,
    };
  }

  if (chosenCode === 3) {
    // Lost baby fox event
    if (inventory.herbs >= 1) {
      return {
        stats: {
          ...stats,
          goodDeeds: stats.goodDeeds + 1,
          gold: stats.gold + Math.round(20 * getAbilityMultiplier(stats, 'gold_gain')),
        },
        inventory: {
          ...inventory,
          herbs: inventory.herbs - 1,
          elixirs: inventory.elixirs + 1,
        },
        message: '길 잃은 아기 여우에게 풀을 나누어 주자 여우 구슬 단약을 두고 갔다! (풀 -1, 단약 +1, 선행 +1, 20엽전)',
        tone: 'positive',
        code: 3,
        triggerCombat: false,
      };
    }
    return {
      stats: {
        ...stats,
        goodDeeds: stats.goodDeeds + 1,
      },
      inventory,
      message: '길 잃은 아기 여우를 쓰다듬어 숲길로 안내했다. (선행 +1)',
      tone: 'positive',
      code: 3,
      triggerCombat: false,
    };
  }

  if (chosenCode === 4) {
    // Ancient Stone Shrine event
    const stoneRoll = rollWeighted(ANCIENT_STONE_TABLE, rng);
    if (stoneRoll.code === 1) {
      const nextMax = stats.maxHp + 5;
      return {
        stats: {
          ...stats,
          maxHp: nextMax,
          hp: Math.min(nextMax, stats.hp + 25),
        },
        inventory,
        message: stoneRoll.text,
        tone: 'positive',
        code: 4,
        triggerCombat: false,
      };
    }
    if (stoneRoll.code === 2) {
      return {
        stats: {
          ...stats,
          gold: stats.gold + Math.round(35 * getAbilityMultiplier(stats, 'gold_gain')),
        },
        inventory,
        message: stoneRoll.text,
        tone: 'positive',
        code: 4,
        triggerCombat: false,
      };
    }
    return {
      stats: {
        ...stats,
        hp: Math.max(1, stats.hp - 10),
      },
      inventory,
      message: stoneRoll.text,
      tone: 'warning',
      code: 4,
      triggerCombat: false,
    };
  }

  // Code 5: Wandering Herbalist Peddler
  return {
    stats: {
      ...stats,
      gold: stats.gold + Math.round(18 * getAbilityMultiplier(stats, 'gold_gain')),
    },
    inventory: {
      ...inventory,
      herbs: inventory.herbs + 2,
    },
    message: '방랑 약초꾼과 정보를 나누고 여분 약초를 받았다. (풀 +2, 엽전 +18)',
    tone: 'positive',
    code: 5,
    triggerCombat: false,
  };
}

/**
 * Multi-tier Snowflake drop in Snowy Forest event field.
 */
export function rollSnowflakeDrop(
  fieldId: FieldId,
  inventory: Inventory,
  rng: () => number = Math.random
): { inventory: Inventory; gained: number; message: string | null } {
  if (fieldId !== 'snowy_forest') {
    return { inventory, gained: 0, message: null };
  }
  const rolled = rollWeighted(SNOWFLAKE_DROP_TABLE, rng);
  const gained = rolled.code === 2 ? 2 : rolled.code === 1 ? 1 : 0;
  if (gained > 0) {
    return {
      inventory: {
        ...inventory,
        snowflakes: inventory.snowflakes + gained,
      },
      gained,
      message: rolled.text,
    };
  }
  return { inventory, gained: 0, message: null };
}

export function purchaseWinterMikoSkin(
  stats: PlayerStats,
  inventory: Inventory
): ActionOutcome {
  if (stats.unlockedSkins.includes('winter_miko')) {
    return {
      stats: {
        ...stats,
        equippedSkin: 'winter_miko',
      },
      inventory,
      message: '겨울 무녀 스킨을 이미 보유 중이어서 즉시 착용했습니다.',
      tone: 'positive',
      code: 1,
    };
  }

  if (inventory.snowflakes < ECONOMY_PRICES.winterMikoSnowflakes) {
    return {
      stats,
      inventory,
      message: `눈송이가 부족합니다. (${inventory.snowflakes}/${ECONOMY_PRICES.winterMikoSnowflakes})`,
      tone: 'warning',
      code: 0,
    };
  }

  return {
    stats: {
      ...stats,
      unlockedSkins: [...stats.unlockedSkins, 'winter_miko'],
      equippedSkin: 'winter_miko',
    },
    inventory: {
      ...inventory,
      snowflakes: inventory.snowflakes - ECONOMY_PRICES.winterMikoSnowflakes,
    },
    message: '겨울 무녀 스킨을 해금하고 착용했습니다!',
    tone: 'positive',
    code: 1,
  };
}

export function equipMikoSkin(stats: PlayerStats, skin: MikoSkinId): PlayerStats {
  if (!stats.unlockedSkins.includes(skin)) {
    return stats;
  }
  return {
    ...stats,
    equippedSkin: skin,
  };
}

export function selectAutoOrPriorityTarget(
  playerX: number,
  playerY: number,
  entities: readonly WorldEntity[],
  priorityTargetId: string | null,
  allowBerry = true
): WorldEntity | null {
  if (priorityTargetId) {
    const prioritized = entities.find(
      (e) => e.id === priorityTargetId && e.koTimer <= 0 && e.hp > 0 && (allowBerry || e.kind !== 'berry')
    );
    if (prioritized) {
      return prioritized;
    }
  }

  let nearest: WorldEntity | null = null;
  let bestDistSq = Infinity;

  for (const entity of entities) {
    if (entity.koTimer > 0 || entity.hp <= 0) continue;
    if (!allowBerry && entity.kind === 'berry') continue;
    if (!entity.isHostile && !entity.isInteractable) continue;
    const dx = entity.x - playerX;
    const dy = entity.y - playerY;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      nearest = entity;
    }
  }

  return nearest;
}

/** Sells field-gathered herbs to the village merchant. */
export function sellHerbsToMerchant(
  stats: PlayerStats,
  inventory: Inventory,
  quantity = 1
): ActionOutcome {
  const sellQty = Math.min(inventory.herbs, Math.max(0, Math.floor(quantity)));
  if (sellQty <= 0) {
    return {
      stats,
      inventory,
      message: '판매할 약초가 없습니다.',
      tone: 'warning',
      code: 0,
    };
  }
  const earned = Math.round(sellQty * ECONOMY_PRICES.herbSell * getAbilityMultiplier(stats, 'gold_gain'));
  return {
    stats: { ...stats, gold: stats.gold + earned },
    inventory: { ...inventory, herbs: inventory.herbs - sellQty },
    message: `약초 ${sellQty}개를 팔아 ${earned}엽전을 얻었습니다.`,
    tone: 'positive',
    code: 1,
  };
}
