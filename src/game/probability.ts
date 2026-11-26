/**
 * Reusable probability table engine structured around explicit { code, text, per } entries.
 */
export interface WeightedEntry<TCode extends number | string = number> {
  code: TCode;
  text: string;
  per: number;
}

export function rollWeighted<TCode extends number | string>(
  entries: readonly WeightedEntry<TCode>[],
  rng: () => number = Math.random
): WeightedEntry<TCode> {
  if (entries.length === 0) {
    throw new Error('Weighted table cannot be empty');
  }

  let totalWeight = 0;
  for (const entry of entries) {
    if (entry.per > 0) {
      totalWeight += entry.per;
    }
  }

  if (totalWeight <= 0) {
    return entries[0];
  }

  const roll = Math.max(0, Math.min(0.999999999, rng())) * totalWeight;
  let cumulative = 0;

  for (const entry of entries) {
    if (entry.per <= 0) continue;
    cumulative += entry.per;
    if (roll < cumulative) {
      return entry;
    }
  }

  return entries[entries.length - 1];
}

// ============================================================================
// Reusable Game Probability Tables
// ============================================================================

export const FIELD_SPAWN_TABLE: readonly WeightedEntry<1 | 2 | 3 | 4>[] = [
  { code: 1, text: '근처에 알 수 없는 열매가 맺혔다.', per: 0.36 },
  { code: 2, text: '바닥에서 알 수 없는 풀이 돋아났다.', per: 0.36 },
  { code: 3, text: '기묘한 요괴나 요정의 기척이 느껴진다.', per: 0.14 },
  { code: 4, text: '숲속에서 특별한 인연과 마주쳤다.', per: 0.14 },
];

/**
 * Multi-tier Herb Gathering Table (알 수 없는 풀 채집 단계별 문구 & 효과)
 */
export const HERB_GATHER_TABLE: readonly WeightedEntry<1 | 2 | 3>[] = [
  { code: 1, text: '수수한 야생 약초를 캐내었다. (풀 +1)', per: 0.55 },
  { code: 2, text: '아침 이슬을 머금은 싱싱한 약초 군락을 발견했다! (풀 +2)', per: 0.3 },
  { code: 3, text: '영험한 빛이 감도는 천년초 싹을 캐내었다! (풀 +3, 체력 +5)', per: 0.15 },
];

/**
 * Multi-tier Berry Consumption Table (열매 섭취 단계별 문구 & 효과)
 */
export const BERRY_EFFECT_TABLE: readonly WeightedEntry<1 | 2 | 3 | 4 | 5>[] = [
  { code: 1, text: '설익은 독열매를 잘못 먹어 배탈이 났다! (10초간 이동 불가)', per: 0.15 },
  { code: 2, text: '다소 떫지만 수분이 많아 갈증이 가셨다. (체력 +8)', per: 0.3 },
  { code: 3, text: '시원한 과즙이 목을 적셔 물배가 찼다. (체력 +14)', per: 0.25 },
  { code: 4, text: '은은한 단맛이 입안 가득 퍼지며 기운이 솟는다! (체력 +22)', per: 0.2 },
  { code: 5, text: '신비로운 황금빛 열매가 온몸의 피로를 씻어준다! (체력 +35, 엽전 +15)', per: 0.1 },
];

/**
 * Multi-tier Village Alchemy Table (연단 단계별 결과)
 */
export const ALCHEMY_TABLE: readonly WeightedEntry<1 | 2 | 3>[] = [
  { code: 1, text: '화력이 어긋나 효과 없는 약이 뭉쳐 나왔다.', per: 0.65 },
  { code: 2, text: '맑은 기운이 감도는 효능 있는 단약을 빚어내었다! (단약 +1)', per: 0.25 },
  { code: 3, text: '화로에서 영기가 피어오르며 상급 단약 두 알이 완성되었다! (단약 +2)', per: 0.1 },
];

/**
 * Expanded Field Event Table (다친 사람, 위장한 강도, 길 잃은 여우, 고대 비석, 방랑 약초꾼)
 */
export const FIELD_EVENT_TABLE: readonly WeightedEntry<1 | 2 | 3 | 4 | 5>[] = [
  { code: 1, text: '다친 사람을 발견했다.', per: 0.35 },
  { code: 2, text: '다친 척 위장한 강도가 칼을 빼들었다!', per: 0.15 },
  { code: 3, text: '길 잃은 아기 여우가 소매 끝을 살짝 물었다.', per: 0.2 },
  { code: 4, text: '이끼 낀 고대 신사 비석에서 기묘한 기운이 흘러나온다.', per: 0.15 },
  { code: 5, text: '약초 바구니를 멘 방랑 약초꾼과 마주쳤다.', per: 0.15 },
];

/**
 * Ancient Stone Sub-Table (고대 비석 결과 풀)
 */
export const ANCIENT_STONE_TABLE: readonly WeightedEntry<1 | 2 | 3>[] = [
  { code: 1, text: '비석의 수호신이 미소 지으며 생명력을 불어넣었다! (최대 체력 +5, 체력 +25)', per: 0.4 },
  { code: 2, text: '비석 틈새에 숨겨진 오래된 엽전 꾸러미를 발견했다! (엽전 +35)', per: 0.4 },
  { code: 3, text: '낡은 봉인이 흔들리며 차가운 냉기가 스쳤다. (체력 -10)', per: 0.2 },
];

/**
 * Expanded Yokai & Fairy Species Table (도깨비, 숲의 요정, 구미호, 텐구, 갓파, 설녀)
 */
/** Enemy-only elite roll: field props and peaceful encounters never use this table. */
export const ELITE_ENEMY_TABLE: readonly WeightedEntry<'normal' | 'elite'>[] = [
  { code: 'normal', text: '일반 적', per: 0.9 },
  { code: 'elite', text: '강적', per: 0.1 },
];

export const YOKAI_SPECIES_TABLE: readonly WeightedEntry<1 | 2 | 3 | 4 | 5 | 6>[] = [
  { code: 1, text: '붉은 도깨비가 쇠방망이를 들고 나타났다!', per: 0.22 },
  { code: 2, text: '장난기 어린 숲의 요정이 날아다닌다.', per: 0.2 },
  { code: 3, text: '아홉 꼬리 구미호가 여우불을 피워올린다.', per: 0.16 },
  { code: 4, text: '붉은 가면의 텐구가 부채를 휘두르며 날아왔다!', per: 0.16 },
  { code: 5, text: '물접시를 얹은 갓파가 물보라를 일으키며 다가온다!', per: 0.14 },
  { code: 6, text: '서리 기운을 두른 설녀가 차가운 눈보라를 부른다.', per: 0.12 },
];

/**
 * Snowy Forest Snowflake Drop Table
 */
export const SNOWFLAKE_DROP_TABLE: readonly WeightedEntry<1 | 2 | 3>[] = [
  { code: 1, text: '반짝이는 눈송이를 주웠다! (눈송이 +1)', per: 0.008 },
  { code: 2, text: '결정처럼 영롱한 큰 눈송이 두 개를 얻었다! (눈송이 +2)', per: 0.002 },
  { code: 3, text: '', per: 0.99 },
];

/**
 * Enhancement outcomes contain only success and maintain.
 */
export type EnhanceOutcomeCode = 'success' | 'maintain';

export function getEnhancePool(level: number): readonly WeightedEntry<EnhanceOutcomeCode>[] {
  const success = level <= 0 ? 0.85 : Math.max(0.2, Number((0.8 - level * 0.08).toFixed(2)));
  const maintain = Number((1 - success).toFixed(2));
  return [
    { code: 'success', text: '강화 성공! 부적의 영력이 한 단계 높아졌습니다.', per: success },
    { code: 'maintain', text: '강화 유지. 부적의 기운이 그대로 머물렀습니다.', per: maintain },
  ];
}
