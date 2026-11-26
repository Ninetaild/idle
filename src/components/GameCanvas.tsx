import React, { useEffect, useRef } from 'react';
import {
  getEntityAsset,
  getMapTileAsset,
  getFoxMikoAsset,
  getEventMikoAsset,
  type MapTileKind,
} from '../game/hdAssets';
import {
  eatFieldBerry,
  gatherFieldHerb,
  resolveFieldEvent,
  rollSnowflakeDrop,
  selectAutoOrPriorityTarget,
  canSpawnEntityKind,
  shouldInteractWithBerry,
  PLAYER_RANGED_ATTACK_COOLDOWN_SEC,
  getAbilityMultiplier,
  getFieldDifficulty,
  rollSkillMultiplier,
  SKILL_DEFINITIONS,
} from '../game/logic';
import {
  FIELD_EVENT_TABLE,
  FIELD_SPAWN_TABLE,
  rollWeighted,
  YOKAI_SPECIES_TABLE,
} from '../game/probability';
import { soundEngine } from '../game/sound';
import type {
  ActorAction,
  Direction,
  FieldEntityKind,
  FieldId,
  GameScreenState,
  GameSnapshot,
  Inventory,
  LogEntry,
  Particle,
  PlayerStats,
  Projectile,
  WorldEntity,
  VillageEntityKind,
  ZoneId,
} from '../game/types';
import {
  computePixelViewport,
  screenToWorld,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../game/viewport';
import type { VillageStationId } from './GameHud';

export interface GameEngineHandle {
  enterZone: (zone: ZoneId, fieldId?: FieldId) => void;
  syncExternalState: (stats: PlayerStats, inventory: Inventory) => void;
}

interface GameCanvasProps {
  screenState: GameScreenState;
  zone: ZoneId;
  fieldId: FieldId;
  autoIdle: boolean;
  zoomOffset: number;
  onZoomChange: (nextZoomOffset: number) => void;
  stats: PlayerStats;
  inventory: Inventory;
  onStateSync: (
    stats: PlayerStats,
    inventory: Inventory,
    snapshot: Partial<GameSnapshot>
  ) => void;
  onLog: (text: string, tone?: LogEntry['tone']) => void;
  onZoneChange: (zone: ZoneId, fieldId?: FieldId) => void;
  onOpenVillageStation: (station: VillageStationId) => void;
  onPlayerDefeated: () => void;
  engineRef: React.MutableRefObject<GameEngineHandle | null>;
}

const VILLAGE_COLS = 12;
const VILLAGE_ROWS = 11;
const VILLAGE_WIDTH = VILLAGE_COLS * TILE_WIDTH; // 768
const VILLAGE_HEIGHT = VILLAGE_ROWS * TILE_HEIGHT; // 495

const FIELD_COLS = 18;
const FIELD_ROWS = 16;
const FIELD_WIDTH = FIELD_COLS * TILE_WIDTH; // 1152
const FIELD_HEIGHT = FIELD_ROWS * TILE_HEIGHT; // 720

const PARTICLE_POOL_SIZE = 140;
const SNOW_FLAKE_COUNT = 64;

let entitySeq = 1;

function tileHash(c: number, r: number): number {
  let h = (c * 374761393 + r * 668265263) ^ ((c ^ r) * 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 100;
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string
) {
  ctx.fillStyle = '#181214';
  ctx.fillText(text, x - 1, y);
  ctx.fillText(text, x + 1, y);
  ctx.fillText(text, x, y - 1);
  ctx.fillText(text, x, y + 1);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

type FieldWorldEntity = Omit<WorldEntity, 'kind'> & { kind: FieldEntityKind };

function nextId(prefix: string) {
  entitySeq += 1;
  return `${prefix}-${entitySeq}`;
}

function createVillageEntities(): (WorldEntity & { kind: VillageEntityKind })[] {
  return [
    {
      id: 'v-cauldron',
      kind: 'village_cauldron',
      name: '연단 화로',
      x: 204,
      y: 205,
      vx: 0,
      vy: 0,
      hp: 999,
      maxHp: 999,
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
    },
    {
      id: 'v-merchant',
      kind: 'village_merchant',
      name: '마을 메뉴',
      x: 564,
      y: 205,
      vx: 0,
      vy: 0,
      hp: 999,
      maxHp: 999,
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
    },
    {
      id: 'v-event-shop',
      kind: 'village_event_shop',
      name: '이벤트 상점',
      x: 564,
      y: 325,
      vx: 0,
      vy: 0,
      hp: 999,
      maxHp: 999,
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
    },
  ];
}

function getPlayableFieldBounds(fieldId: FieldId) {
  const maxX = fieldId === 'river' ? FIELD_WIDTH - 235 : FIELD_WIDTH - 68;
  return { minX: 68, maxX, minY: 56, maxY: FIELD_HEIGHT - 56 };
}

function createYokaiByCode(
  base: WorldEntity,
  speciesCode: 1 | 2 | 3 | 4 | 5 | 6
): FieldWorldEntity {
  switch (speciesCode) {
    case 1:
      return {
        ...base,
        kind: 'yokai_dokkaebi',
        name: '도깨비',
        hp: 38,
        maxHp: 38,
        isHostile: true,
        isInteractable: false,
      };
    case 2:
      return {
        ...base,
        kind: 'fairy_sylph',
        name: '숲의 요정',
        hp: 26,
        maxHp: 26,
        isHostile: true,
        isInteractable: false,
      };
    case 3:
      return {
        ...base,
        kind: 'yokai_gumiho',
        name: '구미호',
        hp: 44,
        maxHp: 44,
        isHostile: true,
        isInteractable: false,
      };
    case 4:
      return {
        ...base,
        kind: 'yokai_tengu',
        name: '텐구',
        hp: 40,
        maxHp: 40,
        isHostile: true,
        isInteractable: false,
      };
    case 5:
      return {
        ...base,
        kind: 'yokai_kappa',
        name: '갓파',
        hp: 34,
        maxHp: 34,
        isHostile: true,
        isInteractable: false,
      };
    case 6:
    default:
      return {
        ...base,
        kind: 'yokai_yukionna',
        name: '설녀',
        hp: 46,
        maxHp: 46,
        isHostile: true,
        isInteractable: false,
      };
  }
}

function createEventByCode(
  base: WorldEntity,
  eventCode: 1 | 2 | 3 | 4 | 5
): FieldWorldEntity {
  switch (eventCode) {
    case 1:
      return {
        ...base,
        kind: 'event_injured',
        name: '다친 사람',
        hp: 30,
        maxHp: 30,
        isHostile: false,
        isInteractable: true,
        isElite: false,
        damageMultiplier: 1,
        revealedBandit: false,
      };
    case 2:
      return {
        ...base,
        kind: 'event_bandit',
        name: '길가의 행인',
        hp: 36,
        maxHp: 36,
        isHostile: false,
        isInteractable: true,
        isElite: false,
        damageMultiplier: 1,
        revealedBandit: false,
      };
    case 3:
      return {
        ...base,
        kind: 'event_fox_shrine',
        name: '길 잃은 아기 여우',
        hp: 20,
        maxHp: 20,
        isHostile: false,
        isInteractable: true,
        isElite: false,
        damageMultiplier: 1,
      };
    case 4:
      return {
        ...base,
        kind: 'event_ancient_stone',
        name: '고대 신사 비석',
        hp: 20,
        maxHp: 20,
        isHostile: false,
        isInteractable: true,
        isElite: false,
        damageMultiplier: 1,
      };
    case 5:
    default:
      return {
        ...base,
        kind: 'event_peddler',
        name: '방랑 약초꾼',
        hp: 20,
        maxHp: 20,
        isHostile: false,
        isInteractable: true,
        isElite: false,
        damageMultiplier: 1,
      };
  }
}

function spawnRandomFieldEntity(
  playerX: number,
  playerY: number,
  fieldId: FieldId,
  existingEntities: readonly WorldEntity[] = [],
  difficultyLevel = 1
): FieldWorldEntity | null {
  const bounds = getPlayableFieldBounds(fieldId);
  for (let spawnAttempt = 0; spawnAttempt < 16; spawnAttempt++) {
    const rolled = rollWeighted(FIELD_SPAWN_TABLE);
    let x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    let y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    for (let attempt = 0; attempt < 6; attempt++) {
      const dx = x - playerX;
      const dy = y - playerY;
      if (dx * dx + dy * dy > 80 * 80) break;
      x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    }

    const base: WorldEntity = {
      id: nextId('ent'), kind: 'herb', name: '알 수 없는 풀', x, y, vx: 0, vy: 0,
      hp: 1, maxHp: 1, dir: 'down', action: 'idle', actionTimer: 0,
      aiTimer: Math.random() * 2, attackCooldown: 0.9 + Math.random() * 0.7,
      telegraphTimer: 0, hitFlashTimer: 0, koTimer: 0,
      isHostile: false, isInteractable: true, orbitAngle: Math.random() * Math.PI * 2,
      snowDusted: fieldId === 'snowy_forest',
    };

    let candidate: FieldWorldEntity;
    if (rolled.code === 1) {
      candidate = { ...base, kind: 'berry', name: '알 수 없는 열매' };
    } else if (rolled.code === 2) {
      candidate = { ...base, kind: 'herb', name: '알 수 없는 풀' };
    } else if (rolled.code === 3) {
      let speciesCode = rollWeighted(YOKAI_SPECIES_TABLE).code;
      if (fieldId === 'river' && Math.random() < 0.4) speciesCode = 5;
      if (fieldId === 'snowy_forest' && Math.random() < 0.4) speciesCode = 6;
      candidate = createYokaiByCode(base, speciesCode);
    } else {
      candidate = createEventByCode(base, rollWeighted(FIELD_EVENT_TABLE).code);
    }

    if (candidate.isHostile) {
      const levelScale = 1 + (Math.max(1, Math.min(10, difficultyLevel)) - 1) * 0.18;
      const isElite = Math.random() < 0.1;
      candidate.maxHp = Math.round(candidate.maxHp * levelScale * (isElite ? 2 : 1));
      candidate.hp = candidate.maxHp;
      candidate.damageMultiplier = levelScale * (isElite ? 2 : 1);
      candidate.isElite = isElite;
      if (isElite) candidate.name = `강적 · ${candidate.name}`;
    }
    if (canSpawnEntityKind(candidate.kind, existingEntities)) return candidate;
  }
  return null;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  screenState,
  zone,
  fieldId,
  autoIdle,
  zoomOffset,
  onZoomChange,
  stats,
  inventory,
  onStateSync,
  onLog,
  onZoneChange,
  onOpenVillageStation,
  onPlayerDefeated,
  engineRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const propsRef = useRef({
    screenState,
    zone,
    fieldId,
    autoIdle,
    zoomOffset,
    onZoomChange,
    onStateSync,
    onLog,
    onZoneChange,
    onOpenVillageStation,
    onPlayerDefeated,
  });
  propsRef.current = {
    screenState,
    zone,
    fieldId,
    autoIdle,
    zoomOffset,
    onZoomChange,
    onStateSync,
    onLog,
    onZoneChange,
    onOpenVillageStation,
    onPlayerDefeated,
  };

  const simRef = useRef({
    player: {
      x: VILLAGE_WIDTH / 2,
      y: 260,
      vx: 0,
      vy: 0,
      dir: 'down' as Direction,
      action: 'idle' as ActorAction,
      actionTimer: 0,
      walkPhase: 0,
      attackCooldown: 0,
      rangedCooldown: 0,
      auraPulseTimer: 0,
      invulnTimer: 0,
      hitFlashTimer: 0,
    },
    camera: { x: VILLAGE_WIDTH / 2, y: 245, trauma: 0 },
    stats: { ...stats },
    inventory: { ...inventory },
    entities: createVillageEntities(),
    projectiles: [] as Projectile[],
    particles: Array.from({ length: PARTICLE_POOL_SIZE }, (): Particle => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 3,
      color: '#ffffff',
    })),
    snowParticles: Array.from({ length: SNOW_FLAKE_COUNT }, () => ({
      x: Math.random() * 1400,
      y: Math.random() * 900,
      speedY: 36 + Math.random() * 38,
      driftX: -14 + Math.random() * 28,
      size: Math.random() > 0.6 ? 3 : 2,
    })),
    particleCursor: 0,
    priorityTargetId: null as string | null,
    waypoint: null as { x: number; y: number } | null,
    spawnTimer: 1.5,
    hitstopTimer: 0,
    ambientTimer: 0,
    villageHealAccum: 0,
    keys: new Set<string>(),
    viewport: computePixelViewport(1440, 900, 0, 1),
    lastHudSyncTime: 0,
    lastReportedScale: 0,
    stomachacheSyncSecond: -1,
    activeZone: zone,
    activeFieldId: fieldId,
  });

  useEffect(() => {
    simRef.current.stats = { ...stats };
    simRef.current.inventory = { ...inventory };
  }, [stats, inventory]);

  // Handle zone & fieldId transitions cleanly
  useEffect(() => {
    const sim = simRef.current;
    if (sim.activeZone === zone && sim.activeFieldId === fieldId) return;
    sim.activeZone = zone;
    sim.activeFieldId = fieldId;
    sim.priorityTargetId = null;
    sim.waypoint = null;
    sim.projectiles = [];

    if (zone === 'village') {
      sim.player.x = VILLAGE_WIDTH / 2;
      sim.player.y = 260;
      sim.player.dir = 'up';
      sim.camera.x = VILLAGE_WIDTH / 2;
      sim.camera.y = 245;
      sim.entities = createVillageEntities();
    } else {
      const startX = fieldId === 'river' ? FIELD_WIDTH / 2 - 110 : FIELD_WIDTH / 2;
      const startY = FIELD_HEIGHT / 2;
      sim.player.x = startX;
      sim.player.y = startY;
      sim.player.dir = 'down';
      sim.camera.x = startX;
      sim.camera.y = startY;

      const seeded: WorldEntity[] = [];
      for (let i = 0; i < 12; i++) {
        const ent = spawnRandomFieldEntity(startX, startY, fieldId, seeded, getFieldDifficulty(sim.stats, fieldId));
        if (!ent) continue;
        if (i === 0) {
          ent.kind = 'herb';
          ent.name = '알 수 없는 풀';
          ent.isHostile = false;
          ent.isInteractable = true;
          ent.isElite = false;
          ent.damageMultiplier = 1;
          ent.x = startX - 95;
          ent.y = startY + 42;
        } else if (i === 1) {
          ent.kind = 'berry';
          ent.name = '알 수 없는 열매';
          ent.isHostile = false;
          ent.isInteractable = true;
          ent.isElite = false;
          ent.damageMultiplier = 1;
          ent.x = startX + 102;
          ent.y = startY - 46;
        } else if (i === 2) {
          const specialSpecies: 4 | 5 | 6 =
            fieldId === 'snowy_forest' ? 6 : fieldId === 'river' ? 5 : 4;
          const yokai = createYokaiByCode(ent, specialSpecies);
          const levelScale = 1 + (getFieldDifficulty(sim.stats, fieldId) - 1) * 0.18;
          const isElite = Math.random() < 0.1;
          yokai.maxHp = Math.round(yokai.maxHp * levelScale * (isElite ? 2 : 1));
          yokai.hp = yokai.maxHp;
          yokai.damageMultiplier = levelScale * (isElite ? 2 : 1);
          yokai.isElite = isElite;
          if (isElite) yokai.name = `강적 · ${yokai.name}`;
          yokai.x = startX + 150;
          yokai.y = startY + 75;
          seeded.push(yokai);
          continue;
        } else if (i === 3) {
          const ev = createEventByCode(ent, 3); // Lost Fox
          ev.x = startX - 155;
          ev.y = startY - 80;
          seeded.push(ev);
          continue;
        } else if (i === 4) {
          const ev = createEventByCode(ent, 4); // Ancient Stone
          ev.x = startX + 190;
          ev.y = startY - 125;
          seeded.push(ev);
          continue;
        }
        seeded.push(ent);
      }
      sim.entities = seeded;
      sim.spawnTimer = 2.0;
    }
  }, [zone, fieldId]);

  useEffect(() => {
    engineRef.current = {
      enterZone: (nextZone: ZoneId, nextField?: FieldId) => {
        propsRef.current.onZoneChange(nextZone, nextField);
      },
      syncExternalState: (nextStats, nextInv) => {
        simRef.current.stats = { ...nextStats };
        simRef.current.inventory = { ...nextInv };
      },
    };
  }, [engineRef]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const vp = computePixelViewport(
        rect.width,
        rect.height,
        propsRef.current.zoomOffset,
        dpr
      );
      simRef.current.viewport = vp;
      if (canvas.width !== vp.displayWidth || canvas.height !== vp.displayHeight) {
        canvas.width = vp.displayWidth;
        canvas.height = vp.displayHeight;
      }
      if (simRef.current.lastReportedScale !== vp.pixelScale) {
        simRef.current.lastReportedScale = vp.pixelScale;
        propsRef.current.onStateSync(
          { ...simRef.current.stats },
          { ...simRef.current.inventory },
          {
            pixelScale: vp.pixelScale,
            visibleTiles: { cols: vp.visibleCols, rows: vp.visibleRows },
          }
        );
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY === 0) return;
      const direction = e.deltaY < 0 ? 1 : -1;
      const current = propsRef.current.zoomOffset;
      propsRef.current.onZoomChange(Math.max(-3, Math.min(3, current + direction)));
    };

    container.addEventListener('wheel', onWheel, { passive: false });

    const onKeyDown = (e: KeyboardEvent) => {
      if (propsRef.current.screenState !== 'playing') return;
      const key = e.key.toLowerCase();
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(
          key
        )
      ) {
        simRef.current.keys.add(key);
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
          e.preventDefault();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys.delete(e.key.toLowerCase());
    };

    const clearInputs = () => {
      simRef.current.keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    const emitParticles = (
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 64
    ) => {
      const sim = simRef.current;
      for (let i = 0; i < count; i++) {
        const p = sim.particles[sim.particleCursor];
        sim.particleCursor = (sim.particleCursor + 1) % PARTICLE_POOL_SIZE;
        const angle = Math.random() * Math.PI * 2;
        const mag = speed * (0.4 + Math.random() * 0.8);
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * mag;
        p.vy = Math.sin(angle) * mag;
        p.maxLife = 0.28 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.size = Math.random() > 0.4 ? 4 : 3;
        p.color = color;
      }
    };

    const syncReact = (force = false) => {
      const sim = simRef.current;
      const now = performance.now();
      const targetEnt = sim.entities.find((e) => e.id === sim.priorityTargetId);
      if (force || now - sim.lastHudSyncTime > 180) {
        sim.lastHudSyncTime = now;
        propsRef.current.onStateSync(
          { ...sim.stats },
          { ...sim.inventory },
          {
            stomachacheRemaining: Math.ceil(sim.stats.stomachacheTimer),
            currentTargetLabel: targetEnt ? targetEnt.name : null,
            pixelScale: sim.viewport.pixelScale,
            visibleTiles: {
              cols: sim.viewport.visibleCols,
              rows: sim.viewport.visibleRows,
            },
          }
        );
      }
    };

    const maybeAwardSnowflake = (x: number, y: number) => {
      const sim = simRef.current;
      const drop = rollSnowflakeDrop(propsRef.current.fieldId, sim.inventory);
      if (drop.gained && drop.message) {
        sim.inventory = drop.inventory;
        emitParticles(x, y, '#bae6fd', 12, 68);
        propsRef.current.onLog(drop.message, 'positive');
      }
    };

    const damageEnemy = (
      ent: WorldEntity,
      dmg: number,
      dirX: number,
      dirY: number
    ) => {
      const sim = simRef.current;
      ent.hp -= dmg;
      ent.hitFlashTimer = 0.12;
      ent.action = 'hurt';
      ent.actionTimer = 0.16;
      const len = Math.max(1, Math.hypot(dirX, dirY));
      ent.vx += (dirX / len) * 85;
      ent.vy += (dirY / len) * 85;

      sim.hitstopTimer = 0.035;
      sim.camera.trauma = Math.min(1, sim.camera.trauma + 0.22);
      soundEngine.playHit();
      emitParticles(ent.x, ent.y, '#ffd166', 10, 72);

      if (ent.hp <= 0) {
        ent.hp = 0;
        ent.koTimer = 0.35;
        const goldTable: Record<string, number> = {
          yokai_yukionna: 32,
          yokai_gumiho: 28,
          yokai_tengu: 26,
          yokai_dokkaebi: 24,
          yokai_kappa: 22,
          fairy_sylph: 18,
          event_bandit: 26,
        };
        const goldDrop = Math.round((goldTable[ent.kind] ?? 18) * getAbilityMultiplier(sim.stats, 'gold_gain'));
        sim.stats.gold += goldDrop;
        if (ent.isHostile && ent.isElite) {
          sim.inventory = { ...sim.inventory, eventTokens: (sim.inventory.eventTokens ?? 0) + 1, jewels: (sim.inventory.jewels ?? 0) + 1 };
          propsRef.current.onLog('강적을 정화해 이벤트 재화 1개와 보옥 1개를 확정 획득했습니다!', 'positive');
        }
        sim.stats.totalDefeated += 1;
        emitParticles(ent.x, ent.y, '#f87171', 16, 90);
        propsRef.current.onLog(
          `${ent.name}을(를) 정화하여 ${goldDrop}엽전을 얻었다.`,
          'combat'
        );
        maybeAwardSnowflake(ent.x, ent.y);
        if (sim.priorityTargetId === ent.id) {
          sim.priorityTargetId = null;
        }
        syncReact(true);
      }
    };

    /** Automatic Spirit Purification Aura (replaces manual Gohei slash attack) */
    const performSpiritPurification = (target: WorldEntity) => {
      const sim = simRef.current;
      const p = sim.player;
      if (p.attackCooldown > 0) return;

      p.attackCooldown = 0.52 / getAbilityMultiplier(sim.stats, 'attack_frequency');
      p.auraPulseTimer = 0.26;
      soundEngine.playSwing();

      const dx = target.x - p.x;
      const dy = target.y - p.y;
      damageEnemy(target, sim.stats.attackPower * getAbilityMultiplier(sim.stats, 'attack_power'), dx, dy);
    };

    const damagePlayer = (dmg: number, knockX: number, knockY: number) => {
      const sim = simRef.current;
      const p = sim.player;
      if (p.invulnTimer > 0 || propsRef.current.screenState !== 'playing') return;

      sim.stats.hp = Math.max(0, sim.stats.hp - dmg);
      p.invulnTimer = 0.7;
      p.hitFlashTimer = 0.18;
      p.action = 'hurt';
      p.actionTimer = 0.22;
      const len = Math.max(1, Math.hypot(knockX, knockY));
      p.vx += (knockX / len) * 100;
      p.vy += (knockY / len) * 100;
      sim.camera.trauma = Math.min(1, sim.camera.trauma + 0.38);
      sim.hitstopTimer = 0.04;
      soundEngine.playHurt();
      emitParticles(p.x, p.y, '#ef4444', 14, 78);
      syncReact(true);

      if (sim.stats.hp <= 0) {
        propsRef.current.onLog('체력이 다해 신사 마을로 급히 후퇴했습니다.', 'warning');
        propsRef.current.onPlayerDefeated();
      }
    };

    const interactWithFieldEntity = (ent: WorldEntity) => {
      const sim = simRef.current;
      const p = sim.player;

      if (ent.kind === 'herb') {
        p.action = 'pickup';
        p.actionTimer = 0.28;
        ent.hp = 0;
        ent.koTimer = 0.15;
        const outcome = gatherFieldHerb(sim.stats, sim.inventory);
        sim.stats = outcome.stats;
        sim.inventory = outcome.inventory;
        soundEngine.playPickup();
        emitParticles(ent.x, ent.y, '#4ade80', 12, 54);
        propsRef.current.onLog(outcome.message, outcome.tone);
        maybeAwardSnowflake(ent.x, ent.y);
        if (sim.priorityTargetId === ent.id) sim.priorityTargetId = null;
        syncReact(true);
        return;
      }

      if (ent.kind === 'berry') {
        if (!shouldInteractWithBerry(sim.stats.hp, sim.stats.maxHp)) return;
        p.action = 'pickup';
        p.actionTimer = 0.28;
        ent.hp = 0;
        ent.koTimer = 0.15;
        const outcome = eatFieldBerry(sim.stats, sim.inventory);
        sim.stats = outcome.stats;
        sim.inventory = outcome.inventory;
        soundEngine.playPickup();
        emitParticles(
          ent.x,
          ent.y,
          outcome.code === 1 ? '#f59e0b' : '#fb7185',
          14,
          60
        );
        propsRef.current.onLog(outcome.message, outcome.tone);
        maybeAwardSnowflake(ent.x, ent.y);
        if (sim.priorityTargetId === ent.id) sim.priorityTargetId = null;
        syncReact(true);
        return;
      }

      if (
        (ent.kind === 'event_injured' ||
          ent.kind === 'event_bandit' ||
          ent.kind === 'event_fox_shrine' ||
          ent.kind === 'event_ancient_stone' ||
          ent.kind === 'event_peddler') &&
        !ent.revealedBandit
      ) {
        p.action = 'pickup';
        p.actionTimer = 0.25;
        const codeMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
          event_injured: 1,
          event_bandit: 2,
          event_fox_shrine: 3,
          event_ancient_stone: 4,
          event_peddler: 5,
        };
        const res = resolveFieldEvent(
          sim.stats,
          sim.inventory,
          codeMap[ent.kind] ?? 1
        );

        if (res.triggerCombat) {
          ent.kind = 'event_bandit';
          ent.name = '위장한 강도';
          ent.revealedBandit = true;
          ent.isHostile = true;
          ent.isInteractable = false;
          ent.hp = 36;
          ent.maxHp = 36;
          ent.attackCooldown = 0.6;
          emitParticles(ent.x, ent.y, '#f87171', 14, 70);
          propsRef.current.onLog(res.message, 'combat');
          soundEngine.playHurt();
        } else {
          sim.stats = res.stats;
          sim.inventory = res.inventory;
          ent.hp = 0;
          ent.koTimer = 0.25;
          if (res.tone === 'positive') {
            soundEngine.playElixir();
            emitParticles(ent.x, ent.y, '#fde047', 14, 64);
          } else {
            emitParticles(ent.x, ent.y, '#94a3b8', 8, 40);
          }
          propsRef.current.onLog(res.message, res.tone);
          maybeAwardSnowflake(ent.x, ent.y);
          if (sim.priorityTargetId === ent.id) sim.priorityTargetId = null;
        }
        syncReact(true);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (propsRef.current.screenState !== 'playing') return;
      const sim = simRef.current;
      const rect = canvas.getBoundingClientRect();
      const { worldX, worldY } = screenToWorld(
        e.clientX,
        e.clientY,
        rect,
        sim.viewport,
        sim.camera.x,
        sim.camera.y
      );

      let clickedEntity: WorldEntity | null = null;
      let bestDist = 40;
      for (const ent of sim.entities) {
        if (ent.koTimer > 0 || ent.hp <= 0) continue;
        const d = Math.hypot(ent.x - worldX, ent.y - worldY);
        if (d < bestDist) {
          bestDist = d;
          clickedEntity = ent;
        }
      }

      if (propsRef.current.zone === 'village') {
        if (Math.hypot(worldX - VILLAGE_WIDTH / 2, worldY - 420) < 46) {
          propsRef.current.onOpenVillageStation('field_select');
          return;
        }
        if (clickedEntity) {
          if (clickedEntity.kind === 'village_cauldron') {
            propsRef.current.onOpenVillageStation('alchemy');
            return;
          }
          if (clickedEntity.kind === 'village_merchant') {
            propsRef.current.onOpenVillageStation('merchant');
            return;
          }
          if (clickedEntity.kind === 'village_event_shop') {
            propsRef.current.onOpenVillageStation('event_shop');
            return;
          }
        }
        sim.waypoint = {
          x: Math.max(48, Math.min(VILLAGE_WIDTH - 48, worldX)),
          y: Math.max(54, Math.min(VILLAGE_HEIGHT - 44, worldY)),
        };
        return;
      }

      if (clickedEntity) {
        sim.priorityTargetId = clickedEntity.id;
        sim.waypoint = null;
        emitParticles(clickedEntity.x, clickedEntity.y, '#fbbf24', 8, 36);
        syncReact(true);
      } else {
        sim.priorityTargetId = null;
        const bounds = getPlayableFieldBounds(propsRef.current.fieldId);
        sim.waypoint = {
          x: Math.max(bounds.minX, Math.min(bounds.maxX, worldX)),
          y: Math.max(bounds.minY, Math.min(bounds.maxY, worldY)),
        };
        emitParticles(sim.waypoint.x, sim.waypoint.y, '#e2e8f0', 5, 24);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);

    let rafId = 0;
    let lastTime = performance.now();
    let needsPausedPaint = true;

    const step = (now: number) => {
      rafId = requestAnimationFrame(step);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const sim = simRef.current;
      const { screenState: mode, zone: curZone, fieldId: curField, autoIdle: isAuto } =
        propsRef.current;

      if (mode === 'paused') {
        if (needsPausedPaint) {
          needsPausedPaint = false;
          renderWorld(canvas, curZone, curField);
        }
        return;
      }
      needsPausedPaint = true;
      sim.ambientTimer += dt;

      if (sim.camera.trauma > 0) {
        sim.camera.trauma = Math.max(0, sim.camera.trauma - dt * 2.2);
      }

      if (curZone === 'field' && curField === 'snowy_forest') {
        const vp = sim.viewport;
        for (const sf of sim.snowParticles) {
          sf.y += sf.speedY * dt;
          sf.x += (sf.driftX + Math.sin(sim.ambientTimer * 1.8 + sf.y * 0.03) * 14) * dt;
          if (sf.y > vp.logicalHeight + 10) {
            sf.y = -8;
            sf.x = Math.random() * vp.logicalWidth;
          }
          if (sf.x < -10) sf.x = vp.logicalWidth + 8;
          if (sf.x > vp.logicalWidth + 10) sf.x = -8;
        }
      }

      for (const p of sim.particles) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }

      if (mode === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          updateSimulation(dt, curZone, curField, isAuto);
        }
      } else if (mode === 'title' && curZone === 'village') {
        sim.camera.x = VILLAGE_WIDTH / 2;
        sim.camera.y = 228;
      }

      renderWorld(canvas, curZone, curField);
    };

    const updateSimulation = (
      dt: number,
      curZone: ZoneId,
      curField: FieldId,
      isAuto: boolean
    ) => {
      const sim = simRef.current;
      const p = sim.player;

      if (p.attackCooldown > 0) p.attackCooldown = Math.max(0, p.attackCooldown - dt);
      if (p.rangedCooldown > 0) p.rangedCooldown = Math.max(0, p.rangedCooldown - dt);
      if (p.auraPulseTimer > 0) p.auraPulseTimer = Math.max(0, p.auraPulseTimer - dt);
      if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
      if (p.hitFlashTimer > 0) p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
      if (p.actionTimer > 0) {
        p.actionTimer = Math.max(0, p.actionTimer - dt);
        if (p.actionTimer === 0) p.action = 'idle';
      }

      // Passive Village rest regeneration (since shrine blessing UI was removed)
      if (curZone === 'village' && sim.stats.hp < sim.stats.maxHp) {
        sim.villageHealAccum += 6 * dt;
        if (sim.villageHealAccum >= 1) {
          const healPts = Math.floor(sim.villageHealAccum);
          sim.villageHealAccum -= healPts;
          sim.stats.hp = Math.min(sim.stats.maxHp, sim.stats.hp + healPts);
        }
      } else {
        sim.villageHealAccum = 0;
      }

      if (sim.stats.stomachacheTimer > 0) {
        sim.stats.stomachacheTimer = Math.max(0, sim.stats.stomachacheTimer - dt);
        const ceilSec = Math.ceil(sim.stats.stomachacheTimer);
        if (ceilSec !== sim.stomachacheSyncSecond) {
          sim.stomachacheSyncSecond = ceilSec;
          syncReact(true);
        }
        if (sim.stats.stomachacheTimer === 0) {
          propsRef.current.onLog('배탈이 가라앉아 다시 산책할 수 있다.', 'positive');
          syncReact(true);
        }
      }

      let moveX = 0;
      let moveY = 0;
      const manualInput =
        sim.keys.has('w') ||
        sim.keys.has('arrowup') ||
        sim.keys.has('s') ||
        sim.keys.has('arrowdown') ||
        sim.keys.has('a') ||
        sim.keys.has('arrowleft') ||
        sim.keys.has('d') ||
        sim.keys.has('arrowright');

      if (sim.keys.has('w') || sim.keys.has('arrowup')) moveY -= 1;
      if (sim.keys.has('s') || sim.keys.has('arrowdown')) moveY += 1;
      if (sim.keys.has('a') || sim.keys.has('arrowleft')) moveX -= 1;
      if (sim.keys.has('d') || sim.keys.has('arrowright')) moveX += 1;

      if (manualInput) {
        sim.waypoint = null;
        sim.priorityTargetId = null;
      }

      const immobilized = sim.stats.stomachacheTimer > 0;

      if (!immobilized) {
        if (!manualInput && sim.waypoint) {
          const dx = sim.waypoint.x - p.x;
          const dy = sim.waypoint.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 10) {
            sim.waypoint = null;
          } else {
            moveX = dx / dist;
            moveY = dy / dist;
          }
        } else if (!manualInput && curZone === 'field' && (isAuto || sim.priorityTargetId)) {
          const target = selectAutoOrPriorityTarget(
            p.x,
            p.y,
            sim.entities,
            sim.priorityTargetId,
            shouldInteractWithBerry(sim.stats.hp, sim.stats.maxHp)
          );
          if (target) {
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const dist = Math.hypot(dx, dy);
            const desiredRange = target.isHostile ? 40 : 24;

            if (dist > desiredRange) {
              moveX = dx / dist;
              moveY = dy / dist;
            } else {
              if (Math.abs(dx) > Math.abs(dy)) {
                p.dir = dx >= 0 ? 'right' : 'left';
              } else {
                p.dir = dy >= 0 ? 'down' : 'up';
              }
              if (target.isHostile) {
                performSpiritPurification(target);
              } else {
                interactWithFieldEntity(target);
              }
            }
          }
        }
      } else {
        moveX = 0;
        moveY = 0;
      }

      const mLen = Math.hypot(moveX, moveY);
      const moveSpeed = 135;
      if (mLen > 0.01 && p.action !== 'pickup') {
        const nx = moveX / mLen;
        const ny = moveY / mLen;
        p.x += nx * moveSpeed * dt;
        p.y += ny * moveSpeed * dt;
        p.walkPhase += (moveSpeed * dt) / 22;

        if (p.action !== 'hurt') {
          p.action = 'walk';
        }
        if (Math.abs(nx) >= Math.abs(ny)) {
          p.dir = nx >= 0 ? 'right' : 'left';
        } else {
          p.dir = ny >= 0 ? 'down' : 'up';
        }
      } else if (p.action === 'walk') {
        p.action = 'idle';
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.02, dt);
      p.vy *= Math.pow(0.02, dt);

      if (curZone === 'village') {
        p.x = Math.max(46, Math.min(VILLAGE_WIDTH - 46, p.x));
        p.y = Math.max(54, Math.min(VILLAGE_HEIGHT - 44, p.y));
        if (Math.hypot(p.x - VILLAGE_WIDTH / 2, p.y - 420) < 30) {
          propsRef.current.onOpenVillageStation('field_select');
          p.y -= 36;
          return;
        }
      } else {
        const bounds = getPlayableFieldBounds(curField);
        p.x = Math.max(bounds.minX, Math.min(bounds.maxX, p.x));
        p.y = Math.max(bounds.minY, Math.min(bounds.maxY, p.y));
      }

      if (curZone === 'field') {
        const aliveCount = sim.entities.filter((e) => e.koTimer <= 0 && e.hp > 0).length;
        sim.spawnTimer -= dt;
        if (sim.spawnTimer <= 0 && aliveCount < 13) {
          sim.spawnTimer = 2.4;
          const spawned = spawnRandomFieldEntity(p.x, p.y, curField, sim.entities, getFieldDifficulty(sim.stats, curField));
          if (spawned) sim.entities.push(spawned);
        }

        const bounds = getPlayableFieldBounds(curField);
        for (let i = sim.entities.length - 1; i >= 0; i--) {
          const ent = sim.entities[i];
          if (ent.koTimer > 0) {
            ent.koTimer -= dt;
            if (ent.koTimer <= 0) {
              sim.entities.splice(i, 1);
            }
            continue;
          }
          ent.animTimer = (ent.animTimer ?? 0) + dt;
          const animStartX = ent.x;
          const animStartY = ent.y;
          ent.isMoving = false;
          if (ent.hitFlashTimer > 0) ent.hitFlashTimer = Math.max(0, ent.hitFlashTimer - dt);
          if (ent.actionTimer > 0) {
            ent.actionTimer = Math.max(0, ent.actionTimer - dt);
            if (ent.actionTimer === 0) ent.action = 'idle';
          }

          ent.x += ent.vx * dt;
          ent.y += ent.vy * dt;
          ent.vx *= Math.pow(0.02, dt);
          ent.vy *= Math.pow(0.02, dt);
          ent.x = Math.max(bounds.minX, Math.min(bounds.maxX, ent.x));
          ent.y = Math.max(bounds.minY, Math.min(bounds.maxY, ent.y));

          if (!ent.isHostile) {
            if (Math.hypot(ent.x - p.x, ent.y - p.y) < 26 && manualInput) {
              interactWithFieldEntity(ent);
            }
            continue;
          }

          const dx = p.x - ent.x;
          const dy = p.y - ent.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          if (ent.attackCooldown > 0) ent.attackCooldown -= dt;

          // Automatic close-range spirit purification when walking near hostile enemy
          if (dist <= 44 && p.attackCooldown <= 0 && manualInput) {
            performSpiritPurification(ent);
          }

          if (ent.kind === 'yokai_dokkaebi' || ent.kind === 'event_bandit') {
            const speed = ent.kind === 'event_bandit' ? 68 : 54;
            if (ent.telegraphTimer > 0) {
              ent.telegraphTimer -= dt;
              if (ent.telegraphTimer <= 0) {
                ent.vx += (dx / dist) * 165;
                ent.vy += (dy / dist) * 165;
                ent.attackCooldown = 1.6;
                if (dist < 44) {
                  damagePlayer((ent.kind === 'event_bandit' ? 11 : 13) * (ent.damageMultiplier ?? 1), dx, dy);
                }
              }
            } else if (dist > 38 && dist < 260) {
              ent.x += (dx / dist) * speed * dt;
              ent.y += (dy / dist) * speed * dt;
            } else if (dist <= 38 && ent.attackCooldown <= 0) {
              ent.telegraphTimer = 0.45;
            }
          } else if (ent.kind === 'fairy_sylph' || ent.kind === 'yokai_tengu') {
            ent.orbitAngle = (ent.orbitAngle ?? 0) + dt * (ent.kind === 'yokai_tengu' ? 1.6 : 1.3);
            const orbitRadius = ent.kind === 'yokai_tengu' ? 115 : 98;
            const idealX = p.x + Math.cos(ent.orbitAngle) * orbitRadius;
            const idealY = p.y + Math.sin(ent.orbitAngle) * orbitRadius;
            const odx = idealX - ent.x;
            const ody = idealY - ent.y;
            const odist = Math.max(1, Math.hypot(odx, ody));
            if (dist < 280) {
              ent.x += (odx / odist) * 68 * dt;
              ent.y += (ody / odist) * 68 * dt;
            }
            if (dist < 220 && ent.attackCooldown <= 0) {
              ent.attackCooldown = ent.kind === 'yokai_tengu' ? 1.85 : 2.1;
              sim.projectiles.push({
                id: nextId('eproj'),
                owner: 'enemy',
                kind: ent.kind === 'yokai_tengu' ? 'wind' : 'spark',
                x: ent.x,
                y: ent.y,
                vx: (dx / dist) * (ent.kind === 'yokai_tengu' ? 145 : 120),
                vy: (dy / dist) * (ent.kind === 'yokai_tengu' ? 145 : 120),
                damage: (ent.kind === 'yokai_tengu' ? 11 : 8) * (ent.damageMultiplier ?? 1),
                life: 2.0,
              });
            }
          } else if (
            ent.kind === 'yokai_gumiho' ||
            ent.kind === 'yokai_kappa' ||
            ent.kind === 'yokai_yukionna'
          ) {
            if (dist < 95) {
              ent.x -= (dx / dist) * 52 * dt;
              ent.y -= (dy / dist) * 52 * dt;
            } else if (dist > 155 && dist < 290) {
              ent.x += (dx / dist) * 44 * dt;
              ent.y += (dy / dist) * 44 * dt;
            }
            if (ent.telegraphTimer > 0) {
              ent.telegraphTimer -= dt;
              if (ent.telegraphTimer <= 0) {
                ent.attackCooldown = 2.2;
                const projKind =
                  ent.kind === 'yokai_yukionna'
                    ? 'ice'
                    : ent.kind === 'yokai_kappa'
                      ? 'water'
                      : 'foxfire';
                sim.projectiles.push({
                  id: nextId('eproj'),
                  owner: 'enemy',
                  kind: projKind,
                  x: ent.x,
                  y: ent.y,
                  vx: (dx / dist) * 140,
                  vy: (dy / dist) * 140,
                  damage: (ent.kind === 'yokai_yukionna' ? 13 : 11) * (ent.damageMultiplier ?? 1),
                  life: 2.1,
                });
              }
            } else if (dist < 240 && ent.attackCooldown <= 0) {
              ent.telegraphTimer = 0.5;
            }
          }

          const movedX = ent.x - animStartX;
          const movedY = ent.y - animStartY;
          ent.isMoving = Math.hypot(movedX, movedY) > 0.05;
          if (ent.isMoving && Math.abs(movedX) > 0.05) {
            ent.dir = movedX < 0 ? 'left' : 'right';
          } else if (ent.isMoving && Math.abs(movedY) > 0.05) {
            ent.dir = movedY < 0 ? 'up' : 'down';
          }
        }
      }

      // The existing ranged cooldown activates the currently equipped technique.
      if (curZone === 'field' && p.rangedCooldown <= 0 && !immobilized) {
        let target: WorldEntity | null = null;
        let nearest = Infinity;
        for (const entity of sim.entities) {
          if (!entity.isHostile || entity.hp <= 0 || entity.koTimer > 0) continue;
          const distance = Math.hypot(entity.x - p.x, entity.y - p.y);
          if (distance < nearest) { nearest = distance; target = entity; }
        }
        if (target && nearest <= 280) {
          const skill = SKILL_DEFINITIONS[sim.stats.equippedSkill ?? 'foxfire_burst'];
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const speed = 250 * getAbilityMultiplier(sim.stats, 'attack_speed');
          sim.projectiles.push({
            id: nextId('p-proj'), owner: 'player',
            kind: skill.name === '빙결의 고리' ? 'ice' : skill.name === '풍신참' ? 'wind' : 'foxfire',
            x: p.x, y: p.y - 8,
            vx: (dx / distance) * speed, vy: (dy / distance) * speed,
            damage: sim.stats.attackPower * getAbilityMultiplier(sim.stats, 'attack_power') * rollSkillMultiplier(sim.stats.equippedSkill ?? 'foxfire_burst'),
            life: 1.4, splashRadius: skill.type === 'area' ? 92 : 0, skillName: skill.name,
          });
          p.rangedCooldown = PLAYER_RANGED_ATTACK_COOLDOWN_SEC / getAbilityMultiplier(sim.stats, 'attack_frequency');
          p.auraPulseTimer = 0.26;
          propsRef.current.onLog(`${skill.name} 발동!`, 'combat');
          soundEngine.playSwing();
        }
      }

      for (let i = sim.projectiles.length - 1; i >= 0; i--) {
        const proj = sim.projectiles[i];
        proj.life -= dt;
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        if (proj.life <= 0) {
          sim.projectiles.splice(i, 1);
          continue;
        }
        if (proj.owner === 'player') {
          const hitTarget = sim.entities.find((entity) =>
            entity.isHostile && entity.hp > 0 && entity.koTimer <= 0 &&
            Math.hypot(entity.x - proj.x, entity.y - proj.y) < 18
          );
          if (hitTarget) {
            damageEnemy(hitTarget, proj.damage, proj.vx, proj.vy);
            if (proj.splashRadius && proj.splashRadius > 0) {
              for (const nearby of sim.entities) {
                if (nearby.id === hitTarget.id || !nearby.isHostile || nearby.hp <= 0 || nearby.koTimer > 0) continue;
                if (Math.hypot(nearby.x - hitTarget.x, nearby.y - hitTarget.y) <= proj.splashRadius) damageEnemy(nearby, proj.damage, proj.vx, proj.vy);
              }
              emitParticles(hitTarget.x, hitTarget.y, '#93c5fd', 18, 96);
            }
            sim.projectiles.splice(i, 1);
          }
        } else if (Math.hypot(p.x - proj.x, p.y - proj.y) < 18) {
          damagePlayer(proj.damage, proj.vx, proj.vy);
          sim.projectiles.splice(i, 1);
        }
      }

      sim.camera.x += (p.x - sim.camera.x) * Math.min(1, dt * 8);
      sim.camera.y += (p.y - sim.camera.y) * Math.min(1, dt * 8);
      syncReact(false);
    };

    const renderWorld = (
      canvasEl: HTMLCanvasElement,
      curZone: ZoneId,
      curField: FieldId
    ) => {
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      const sim = simRef.current;
      const vp = sim.viewport;
      const scaleX = vp.displayWidth / vp.logicalWidth;
      const scaleY = vp.displayHeight / vp.logicalHeight;

      ctx.save();
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const shakeMag = sim.camera.trauma * sim.camera.trauma * 6;
      const shakeX = shakeMag > 0.1 ? Math.round((Math.random() - 0.5) * 2 * shakeMag) : 0;
      const shakeY = shakeMag > 0.1 ? Math.round((Math.random() - 0.5) * 2 * shakeMag) : 0;

      const camLeft = Math.round(sim.camera.x - vp.logicalWidth / 2) + shakeX;
      const camTop = Math.round(sim.camera.y - vp.logicalHeight / 2) + shakeY;

      if (curZone === 'village') ctx.fillStyle = '#2d4431';
      else if (curField === 'snowy_forest') ctx.fillStyle = '#cbd5e1';
      else if (curField === 'plains') ctx.fillStyle = '#47723b';
      else if (curField === 'river') ctx.fillStyle = '#24483a';
      else ctx.fillStyle = '#203a2b';
      ctx.fillRect(0, 0, vp.logicalWidth, vp.logicalHeight);

      ctx.save();
      ctx.translate(-camLeft, -camTop);

      const startCol = Math.max(0, Math.floor(camLeft / TILE_WIDTH) - 1);
      const endCol = Math.ceil((camLeft + vp.logicalWidth) / TILE_WIDTH) + 1;
      const startRow = Math.max(0, Math.floor(camTop / TILE_HEIGHT) - 1);
      const endRow = Math.ceil((camTop + vp.logicalHeight) / TILE_HEIGHT) + 1;

      const maxCol = curZone === 'village' ? VILLAGE_COLS : FIELD_COLS;
      const maxRow = curZone === 'village' ? VILLAGE_ROWS : FIELD_ROWS;

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (c < 0 || r < 0 || c >= maxCol || r >= maxRow) continue;
          const tx = c * TILE_WIDTH;
          const ty = r * TILE_HEIGHT;
          const hash = tileHash(c, r);
          const variant = hash % 4;

          let tileKind: MapTileKind = 'forest_moss';
          if (curZone === 'village') {
            const inCourtyard = c >= 2 && c <= 9 && r >= 2 && r <= 8;
            const onPath = (c === 5 || c === 6) && r >= 2 && r <= 10;
            tileKind = onPath
              ? 'village_stone'
              : inCourtyard
                ? 'village_courtyard'
                : 'village_grass';
          } else if (curField === 'plains') {
            tileKind = 'plains_meadow';
          } else if (curField === 'river') {
            if (c >= maxCol - 3) tileKind = 'river_water';
            else if (c === maxCol - 4) tileKind = 'river_shore';
            else tileKind = 'forest_moss';
          } else if (curField === 'snowy_forest') {
            tileKind = 'snowy_ground';
          }

          const tileSpr = getMapTileAsset(tileKind, variant);
          ctx.drawImage(tileSpr, tx, ty, TILE_WIDTH, TILE_HEIGHT);

          // River animated shimmer highlight
          if (curZone === 'field' && curField === 'river' && c >= maxCol - 3 && hash < 45) {
            const waveShift = ((sim.ambientTimer * 28 + r * 14 + hash) % (TILE_HEIGHT - 8));
            ctx.fillStyle = 'rgba(224, 242, 254, 0.55)';
            ctx.fillRect(tx + 18, ty + Math.round(waveShift), 18, 3);
          }

          // Perimeter HD compressed Pine Trees
          const isRiverEdge = curZone === 'field' && curField === 'river' && c >= maxCol - 3;
          if (!isRiverEdge && (c === 0 || r === 0 || c === maxCol - 1 || r === maxRow - 1)) {
            const treeKind: MapTileKind =
              curZone === 'field' && curField === 'snowy_forest' ? 'tree_snow' : 'tree_green';
            const treeSpr = getMapTileAsset(treeKind, variant);
            ctx.drawImage(treeSpr, tx - 6, ty - 14, TILE_WIDTH + 12, TILE_HEIGHT + 18);
          }
        }
      }

      // Village Stone Lanterns & Compressed 1024x720 Torii Gate
      if (curZone === 'village') {
        const lanterns = [
          [295, 165],
          [473, 165],
          [295, 345],
          [473, 345],
        ];
        const lantern = getEntityAsset('village_lantern');
        for (const [lx, ly] of lanterns) {
          const glow = 0.18 + (Math.sin(sim.ambientTimer * 2.4 + lx * 0.03) + 1) * 0.08;
          const halo = ctx.createRadialGradient(lx, ly - 15, 2, lx, ly - 15, 31);
          halo.addColorStop(0, `rgba(255, 190, 74, ${glow})`);
          halo.addColorStop(1, 'rgba(255, 165, 60, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(lx, ly - 15, 31, 0, Math.PI * 2);
          ctx.fill();
          ctx.drawImage(lantern, lx - 27, ly - 42, 54, 72);
        }

        const torii = getEntityAsset('village_torii');
        ctx.drawImage(torii, VILLAGE_WIDTH / 2 - 48, 420 - 38, 96, 68);
        ctx.font = 'bold 11px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        drawOutlinedText(
          ctx,
          '산책 입구 (필드 선택)',
          VILLAGE_WIDTH / 2,
          420 + 36,
          '#fde68a'
        );
      }

      if (sim.waypoint) {
        const pulse = Math.sin(sim.ambientTimer * 8) * 2;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sim.waypoint.x, sim.waypoint.y, 10 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      type DrawItem = { y: number; draw: () => void };
      const drawList: DrawItem[] = [];

      for (const ent of sim.entities) {
        drawList.push({
          y: ent.y,
          draw: () => {
            const spr = getEntityAsset(ent.kind, Boolean(ent.revealedBandit));
            const isSmall = ent.kind === 'herb' || ent.kind === 'berry';
            const propSize: Record<string, [number, number]> = {
              herb: [54, 48], berry: [58, 50], village_shrine: [82, 82],
              village_torii: [88, 78], village_lantern: [54, 72],
              village_chest: [70, 60], snowflake: [46, 54],
              gold_coin: [46, 50], snowflake_pickup: [52, 56],
              snowflake_crystal: [50, 62], village_sign: [62, 72],
            };
            const size = propSize[ent.kind];
            const drawW = size?.[0] ?? (isSmall ? 54 : 74);
            const drawH = size?.[1] ?? (isSmall ? 48 : 52);
            const halfW = drawW / 2;
            const halfH = drawH / 2;
            const animTime = ent.animTimer ?? sim.ambientTimer;
            const isFlying = ent.kind === 'fairy_sylph' || ent.kind === 'yokai_tengu';
            const isPlant = ent.kind === 'herb' || ent.kind === 'berry';
            const walkCycle = animTime * (isFlying ? 10 : 13) + ent.x * 0.035;
            const idleBob = Math.sin(animTime * 2.2 + ent.x * 0.02) * 1.2;
            const bob = isFlying
              ? Math.sin(walkCycle) * 4
              : ent.isMoving
                ? Math.abs(Math.sin(walkCycle)) * -3.5
                : idleBob;
            const koOffsetY = ent.koTimer > 0 ? (0.35 - ent.koTimer) * 18 : 0;
            const stride = ent.isMoving && ent.koTimer <= 0;
            const squash = stride ? 1 + Math.sin(walkCycle * 2) * 0.045 : 1 + Math.sin(animTime * 2) * 0.012;
            const stretch = stride ? 1 - Math.sin(walkCycle * 2) * 0.035 : 1;
            const plantSway = isPlant ? Math.sin(animTime * 1.35 + ent.x * 0.04) * 0.035 : 0;
            const lean = ent.koTimer > 0 ? 0.22 : stride ? Math.sin(walkCycle) * 0.075 : Math.sin(animTime * 1.6) * 0.012 + plantSway;

            ctx.save();
            if (ent.koTimer > 0) {
              ctx.globalAlpha = Math.max(0.15, ent.koTimer / 0.35);
            }

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.34)';
            ctx.beginPath();
            ctx.ellipse(ent.x, ent.y + halfH * 0.65, halfW * 0.55, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            if (ent.isHostile && ent.isElite) {
              const pulse = 0.6 + Math.sin(sim.ambientTimer * 4) * 0.15;
              ctx.strokeStyle = `rgba(250, 204, 21, ${pulse})`;
              ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ent.x, ent.y + 2, halfW * 0.8 + 8, 0, Math.PI * 2); ctx.stroke();
              ctx.font = 'bold 11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
              drawOutlinedText(ctx, '강적', ent.x, ent.y - halfH - 12, '#fde047');
            }
            if (ent.telegraphTimer > 0) {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(ent.x, ent.y + 4, 24, 0, Math.PI * 2);
              ctx.stroke();
            }

            if (sim.priorityTargetId === ent.id) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 2;
              ctx.strokeRect(
                ent.x - halfW - 3,
                ent.y - halfH - 3,
                drawW + 6,
                drawH + 6
              );
            }

            // Props keep a grounded footprint; plants sway gently and pickups float.
            ctx.save();
            ctx.translate(ent.x, ent.y + bob + koOffsetY);
            ctx.rotate(lean);
            ctx.scale(ent.dir === 'left' ? -squash : squash, stretch);
            ctx.drawImage(spr, -halfW, -halfH, drawW, drawH);
            ctx.restore();

            // Light snow dusting resting on top of field elements in Snowy Forest
            if (curField === 'snowy_forest' && curZone === 'field' && ent.koTimer <= 0) {
              ctx.fillStyle = '#f8fafc';
              ctx.beginPath();
              ctx.ellipse(ent.x, ent.y - halfH + 8 + bob, isSmall ? 12 : 14, 4, 0, 0, Math.PI * 2);
              ctx.fill();
            }

            if (ent.hitFlashTimer > 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.55)';
              ctx.beginPath();
              ctx.arc(ent.x, ent.y, 18, 0, Math.PI * 2);
              ctx.fill();
            }

            if (ent.isHostile && ent.hp > 0 && ent.hp < ent.maxHp) {
              const bw = 36;
              const fill = Math.max(2, (ent.hp / ent.maxHp) * bw);
              ctx.fillStyle = '#18181b';
              ctx.fillRect(ent.x - bw / 2, ent.y - halfH - 6, bw, 5);
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(ent.x - bw / 2, ent.y - halfH - 6, fill, 4);
            }

            // Village NPC station labels only (NO text drawn above field elements/characters!)
            if (curZone === 'village') {
              ctx.font = 'bold 11px "Noto Sans KR", sans-serif';
              ctx.textAlign = 'center';
              drawOutlinedText(
                ctx,
                ent.name,
                ent.x,
                ent.y - halfH - 4,
                ent.kind === 'village_event_shop' ? '#7dd3fc' : '#fef3c7'
              );
            }
            ctx.restore();
          },
        });
      }

      // Draw Compressed 1024x720 Miko Player
      const p = sim.player;
      drawList.push({
        y: p.y,
        draw: () => {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 20, 18, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          if (sim.stats.stomachacheTimer > 0) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y + 4, 24, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (p.auraPulseTimer > 0) {
            const progress = 1 - p.auraPulseTimer / 0.26;
            ctx.strokeStyle =
              sim.stats.equippedSkin === 'winter_miko'
                ? 'rgba(125, 211, 252, 0.85)'
                : 'rgba(253, 224, 71, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18 + progress * 24, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (p.invulnTimer > 0 && Math.floor(sim.ambientTimer * 18) % 2 === 0) {
            ctx.globalAlpha = 0.65;
          }

          const spr =
            sim.stats.equippedSkin === 'default'
              ? getFoxMikoAsset(p.dir, p.action, p.walkPhase)
              : getEventMikoAsset(p.dir, p.action, p.walkPhase);
          const drawH = 72;
          const drawW = (spr.width / Math.max(1, spr.height)) * drawH;
          const bob =
            p.action === 'walk'
              ? Math.abs(Math.sin(p.walkPhase * Math.PI)) * -2.5
              : 0;
          const feetY = p.y + 36 + bob;
          ctx.drawImage(spr, p.x - drawW / 2, feetY - drawH, drawW, drawH);

          if (p.hitFlashTimer > 0) {
            ctx.fillStyle = 'rgba(255,120,120,0.5)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        },
      });

      drawList.sort((a, b) => a.y - b.y);
      for (const item of drawList) {
        item.draw();
      }

      // Enemy Projectiles
      for (const proj of sim.projectiles) {
        const colorMap: Record<Projectile['kind'], { outer: string; inner: string }> = {
          foxfire: { outer: '#fb923c', inner: '#fef08a' },
          spark: { outer: '#10b981', inner: '#d1fae5' },
          wind: { outer: '#dc2626', inner: '#fef08a' },
          water: { outer: '#0284c7', inner: '#bae6fd' },
          ice: { outer: '#38bdf8', inner: '#f8fafc' },
        };
        const palette = colorMap[proj.kind];
        ctx.fillStyle = palette.outer;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.inner;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pooled particles
      for (const part of sim.particles) {
        if (!part.active) continue;
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ambient drifting blossom petals in Village
      if (curZone === 'village') {
        ctx.fillStyle = 'rgba(251, 207, 232, 0.85)';
        for (let i = 0; i < 12; i++) {
          const px = (sim.ambientTimer * 18 + i * 74) % VILLAGE_WIDTH;
          const py = (sim.ambientTimer * 11 + i * 56) % VILLAGE_HEIGHT;
          ctx.beginPath();
          ctx.ellipse(px, py, 3, 2, sim.ambientTimer + i, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Screen-space falling snow overlay in Snowy Forest event field
      if (curZone === 'field' && curField === 'snowy_forest') {
        for (const sf of sim.snowParticles) {
          ctx.fillStyle = sf.size > 2 ? '#ffffff' : '#e0f2fe';
          ctx.beginPath();
          ctx.arc(sf.x, sf.y, sf.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      container.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const vp = computePixelViewport(rect.width, rect.height, zoomOffset, dpr);
    simRef.current.viewport = vp;
    canvas.width = vp.displayWidth;
    canvas.height = vp.displayHeight;
    propsRef.current.onStateSync(
      { ...simRef.current.stats },
      { ...simRef.current.inventory },
      {
        pixelScale: vp.pixelScale,
        visibleTiles: { cols: vp.visibleCols, rows: vp.visibleRows },
      }
    );
  }, [zoomOffset]);

  return (
    <div
      ref={containerRef}
      data-testid="game-viewport"
      className="relative w-full h-full overflow-hidden bg-[#1b2e23]"
    >
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="w-full h-full hd-game-canvas cursor-crosshair [image-rendering:pixelated]"
      />
    </div>
  );
};
