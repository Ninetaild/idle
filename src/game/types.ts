export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type ZoneId = 'village' | 'field';

export type FieldId = 'forest' | 'plains' | 'river' | 'snowy_forest';

export type MikoSkinId = 'default' | 'winter_miko';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type ActorAction = 'idle' | 'walk' | 'pickup' | 'hurt';

export type EntityKind =
  | 'herb'
  | 'berry'
  | 'yokai_dokkaebi'
  | 'yokai_gumiho'
  | 'fairy_sylph'
  | 'yokai_tengu'
  | 'yokai_kappa'
  | 'yokai_yukionna'
  | 'event_injured'
  | 'event_bandit'
  | 'event_fox_shrine'
  | 'event_ancient_stone'
  | 'event_peddler'
  | 'village_cauldron'
  | 'village_merchant'
  | 'village_event_shop';

export interface Inventory {
  herbs: number;       // 알 수 없는 풀
  berries: number;     // 보관된 열매
  elixirs: number;     // 효능 있는 단약
  dudPills: number;    // 효과 없는 약
  snowflakes: number;  // 이벤트 재화: 눈송이
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  gold: number;        // 엽전
  goodDeeds: number;   // 선행
  attackPower: number;
  enhanceLevel: number;
  enhanceCost: number;
  stomachacheTimer: number; // 남은 배탈 시간 (초, 최대 10)
  totalDefeated: number;
  totalGathered: number;
  unlockedSkins: MikoSkinId[];
  equippedSkin: MikoSkinId;
}

export interface LogEntry {
  id: number;
  text: string;
  tone: 'neutral' | 'positive' | 'warning' | 'combat';
  timestamp: number;
}

export interface WorldEntity {
  id: string;
  kind: EntityKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  dir: Direction;
  action: ActorAction;
  actionTimer: number;
  aiTimer: number;
  attackCooldown: number;
  telegraphTimer: number;
  hitFlashTimer: number;
  koTimer: number;
  isHostile: boolean;
  isInteractable: boolean;
  revealedBandit?: boolean;
  orbitAngle?: number;
  snowDusted?: boolean;
  /** Per-entity animation clock and movement state for sprite motion. */
  animTimer?: number;
  isMoving?: boolean;
}

export interface Projectile {
  id: string;
  owner: 'player' | 'enemy';
  kind: 'foxfire' | 'spark' | 'water' | 'ice' | 'wind';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface GameSnapshot {
  zone: ZoneId;
  fieldId: FieldId;
  stats: PlayerStats;
  inventory: Inventory;
  autoIdle: boolean;
  stomachacheRemaining: number;
  currentTargetLabel: string | null;
  pixelScale: number;
  visibleTiles: { cols: number; rows: number };
}
