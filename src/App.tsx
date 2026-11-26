/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameEngineHandle } from './components/GameCanvas';
import { GameHud, type VillageStationId } from './components/GameHud';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { VillageModals } from './components/VillageModals';
import {
  attemptEnhanceCharm,
  imbueCharm,
  changeEquippedSkill,
  setFieldDifficulty,
  craftElixirFromHerb,
  createInitialInventory,
  createInitialStats,
  equipMikoSkin,
  FIELD_METADATA,
  purchaseWinterMikoSkin,
  sellPillsToMerchant,
  sellHerbsToMerchant,
} from './game/logic';
import { soundEngine } from './game/sound';
import { decryptSave, encryptSave } from './game/saveCodec';
import type {
  FieldId,
  GameScreenState,
  GameSnapshot,
  Inventory,
  LogEntry,
  MikoSkinId,
  PlayerStats,
  ZoneId,
} from './game/types';

const SAVE_STORAGE_KEY = 'miko_herb_stroll_save_v3';

interface SavedData {
  stats: PlayerStats;
  inventory: Inventory;
  zone?: ZoneId;
  fieldId?: FieldId;
  autoIdle?: boolean;
  zoomOffset?: number;
  muted?: boolean;
}

function loadSavedData(): SavedData | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedData>;
    if (!parsed.stats || !parsed.inventory) return null;
    return {
      stats: { ...createInitialStats(), ...parsed.stats, fieldDifficulties: { ...createInitialStats().fieldDifficulties!, ...parsed.stats.fieldDifficulties }, abilities: parsed.stats.abilities ?? [], equippedSkill: parsed.stats.equippedSkill ?? 'foxfire_burst' },
      inventory: { ...createInitialInventory(), ...parsed.inventory },
      // Always resume in the village after a browser restart.
      // Keep the saved field selection for the next walk.
      zone: 'village',
      fieldId: parsed.fieldId ?? 'forest',
      autoIdle: parsed.autoIdle ?? true,
      zoomOffset: parsed.zoomOffset ?? 0,
      muted: parsed.muted ?? false,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const initialSave = useRef(loadSavedData());
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [screenState, setScreenState] = useState<GameScreenState>(
    isAutostart ? 'playing' : 'title'
  );
  const [zone, setZone] = useState<ZoneId>(initialSave.current?.zone ?? 'village');
  const [fieldId, setFieldId] = useState<FieldId>(initialSave.current?.fieldId ?? 'forest');
  const [autoIdle, setAutoIdle] = useState(initialSave.current?.autoIdle ?? true);
  const [zoomOffset, setZoomOffset] = useState(initialSave.current?.zoomOffset ?? 0);
  const [muted, setMuted] = useState(initialSave.current?.muted ?? false);

  const [stats, setStats] = useState<PlayerStats>(
    () => initialSave.current?.stats ?? createInitialStats()
  );
  const [inventory, setInventory] = useState<Inventory>(
    () => initialSave.current?.inventory ?? createInitialInventory()
  );

  const [pixelScale, setPixelScale] = useState(1);
  const [visibleTiles, setVisibleTiles] = useState({ cols: 22, rows: 16 });
  const [currentTargetLabel, setCurrentTargetLabel] = useState<string | null>(null);

  const [activeStation, setActiveStation] = useState<VillageStationId | null>(null);
  const [stationResultText, setStationResultText] = useState<string | null>(null);

  const logIdRef = useRef(1);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 1,
      text: '신사 마을에 도착했습니다. 산책 버튼을 눌러 필드를 선택하세요.',
      tone: 'neutral',
      timestamp: Date.now(),
    },
  ]);

  const engineRef = useRef<GameEngineHandle | null>(null);

  const pushLog = useCallback(
    (text: string, tone: LogEntry['tone'] = 'neutral') => {
      logIdRef.current += 1;
      const entry: LogEntry = {
        id: logIdRef.current,
        text,
        tone,
        timestamp: Date.now(),
      };
      setLogs((prev) => [entry, ...prev].slice(0, 12));
    },
    []
  );

  useEffect(() => {
    const effectiveState = activeStation !== null ? 'paused' : screenState;
    document.body.dataset.state = effectiveState;
  }, [screenState, activeStation]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({ stats, inventory, zone, fieldId, autoIdle, zoomOffset, muted })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [stats, inventory, zone, fieldId, autoIdle, zoomOffset, muted]);

  const startGame = useCallback(() => {
    setScreenState('playing');
    document.body.dataset.state = 'playing';
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (screenState === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (activeStation) {
          setActiveStation(null);
          setStationResultText(null);
          return;
        }
        setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
      } else if (e.key.toLowerCase() === 'm') {
        setMuted((prev) => {
          const next = !prev;
          soundEngine.setMuted(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [screenState, activeStation, startGame]);

  const handleStateSync = useCallback(
    (
      nextStats: PlayerStats,
      nextInv: Inventory,
      snap: Partial<GameSnapshot>
    ) => {
      setStats(nextStats);
      setInventory(nextInv);
      if (snap.pixelScale !== undefined) setPixelScale(snap.pixelScale);
      if (snap.visibleTiles !== undefined) setVisibleTiles(snap.visibleTiles);
      if (snap.currentTargetLabel !== undefined) {
        setCurrentTargetLabel(snap.currentTargetLabel);
      }
    },
    []
  );

  const handleZoneChange = useCallback(
    (nextZone: ZoneId, nextField?: FieldId) => {
      setActiveStation(null);
      setStationResultText(null);
      if (nextField) {
        setFieldId(nextField);
      }
      setZone(nextZone);
      if (nextZone === 'field') {
        const chosen = nextField ?? fieldId;
        const meta = FIELD_METADATA[chosen];
        pushLog(
          `${meta.category === 'event' ? '[이벤트] ' : ''}${meta.name} 필드에 들어섰습니다.`,
          'positive'
        );
      } else {
        pushLog('신사 마을로 돌아왔습니다. 마을에서는 체력이 천천히 회복됩니다.', 'neutral');
      }
    },
    [fieldId, pushLog]
  );

  const handlePlayerDefeated = useCallback(() => {
    const recovered: PlayerStats = {
      ...stats,
      hp: Math.max(35, Math.round(stats.maxHp * 0.6)),
      stomachacheTimer: 0,
    };
    setStats(recovered);
    engineRef.current?.syncExternalState(recovered, inventory);
    setZone('village');
  }, [stats, inventory]);

  const handleCraftOne = () => {
    const outcome = craftElixirFromHerb(stats, inventory);
    setStats(outcome.stats);
    setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message);
    pushLog(outcome.message, outcome.tone);
    if (outcome.code === 2 || outcome.code === 3) soundEngine.playElixir();
    else if (outcome.code === 1) soundEngine.playPickup();
  };

  const handleCraftBatch = () => {
    let curStats = stats;
    let curInv = inventory;
    let elixirsMade = 0;
    let dudsMade = 0;
    while (curInv.herbs > 0) {
      const res = craftElixirFromHerb(curStats, curInv);
      curStats = res.stats;
      curInv = res.inventory;
      if (res.code === 3) elixirsMade += 2;
      else if (res.code === 2) elixirsMade += 1;
      else if (res.code === 1) dudsMade += 1;
    }
    const summary = `풀을 모두 연단했습니다! (단약 +${elixirsMade}, 효과 없는 약 +${dudsMade})`;
    setStats(curStats);
    setInventory(curInv);
    engineRef.current?.syncExternalState(curStats, curInv);
    setStationResultText(summary);
    pushLog(summary, elixirsMade > 0 ? 'positive' : 'neutral');
    if (elixirsMade > 0) soundEngine.playElixir();
  };

  const handleSellItem = (item: 'elixir' | 'dudPill', qty: number) => {
    const outcome = sellPillsToMerchant(stats, inventory, item, qty);
    setStats(outcome.stats);
    setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message);
    pushLog(outcome.message, outcome.tone);
    if (outcome.code === 1) soundEngine.playCoin();
  };

  const handleSellHerbs = (qty: number) => {
    const outcome = sellHerbsToMerchant(stats, inventory, qty);
    setStats(outcome.stats);
    setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message);
    pushLog(outcome.message, outcome.tone);
    if (outcome.code === 1) soundEngine.playCoin();
  };

  const handleEnhanceCharm = () => {
    const outcome = attemptEnhanceCharm(stats, inventory);
    setStats(outcome.stats);
    setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message);
    pushLog(outcome.message, outcome.tone);
    if (outcome.code === 'success') soundEngine.playElixir();
    else soundEngine.playPickup();
  };

  const handleImbueCharm = () => {
    const outcome = imbueCharm(stats, inventory);
    setStats(outcome.stats); setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message); pushLog(outcome.message, outcome.tone);
    if (outcome.code === 'imbued') soundEngine.playElixir();
  };

  const handleChangeSkill = (skill: import('./game/types').SkillId) => {
    const outcome = changeEquippedSkill(stats, inventory, skill);
    setStats(outcome.stats); setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message); pushLog(outcome.message, outcome.tone);
    if (outcome.code === 'changed') soundEngine.playPickup();
  };

  const handleSetFieldDifficulty = (fid: FieldId, level: number) => {
    const nextStats = setFieldDifficulty(stats, fid, level);
    setStats(nextStats); engineRef.current?.syncExternalState(nextStats, inventory);
    setStationResultText(`${FIELD_METADATA[fid].name} 난이도를 ${level}단계로 설정했습니다.`);
  };

  const handleBuyWinterSkin = () => {
    const outcome = purchaseWinterMikoSkin(stats, inventory);
    setStats(outcome.stats);
    setInventory(outcome.inventory);
    engineRef.current?.syncExternalState(outcome.stats, outcome.inventory);
    setStationResultText(outcome.message);
    pushLog(outcome.message, outcome.tone);
    if (outcome.code === 1) soundEngine.playElixir();
  };

  const handleEquipSkin = (skin: MikoSkinId) => {
    const nextStats = equipMikoSkin(stats, skin);
    setStats(nextStats);
    engineRef.current?.syncExternalState(nextStats, inventory);
    const msg =
      skin === 'winter_miko'
        ? '겨울 무녀 스킨을 착용했습니다.'
        : '기본 무녀 복장으로 갈아입었습니다.';
    setStationResultText(msg);
    pushLog(msg, 'positive');
    soundEngine.playPickup();
  };

  const exportSaveCode = useCallback(
    async (passphrase: string) =>
      encryptSave<SavedData>({ stats, inventory, zone, fieldId, autoIdle, zoomOffset, muted }, passphrase),
    [stats, inventory, zone, fieldId, autoIdle, zoomOffset, muted]
  );

  const importSaveCode = useCallback(async (code: string, passphrase: string) => {
    const saved = await decryptSave<SavedData>(code, passphrase);
    if (!saved.stats || !saved.inventory) {
      throw new Error('저장 데이터에 필수 정보가 없습니다.');
    }
    const nextStats = { ...createInitialStats(), ...saved.stats, fieldDifficulties: { ...createInitialStats().fieldDifficulties!, ...saved.stats.fieldDifficulties }, abilities: saved.stats.abilities ?? [], equippedSkill: saved.stats.equippedSkill ?? 'foxfire_burst' };
    const nextInventory = { ...createInitialInventory(), ...saved.inventory };
    setStats(nextStats);
    setInventory(nextInventory);
    setZone(saved.zone === 'field' ? 'field' : 'village');
    setFieldId(saved.fieldId && FIELD_METADATA[saved.fieldId] ? saved.fieldId : 'forest');
    setAutoIdle(saved.autoIdle ?? true);
    setZoomOffset(saved.zoomOffset ?? 0);
    setMuted(saved.muted ?? false);
    soundEngine.setMuted(saved.muted ?? false);
    setActiveStation(null);
    setStationResultText(null);
    setScreenState('playing');
    engineRef.current?.syncExternalState(nextStats, nextInventory);
    pushLog('암호화된 모험 기록을 불러왔습니다.', 'positive');
  }, [pushLog]);

  const handleResetSave = () => {
    const freshStats = createInitialStats();
    const freshInv = createInitialInventory();
    setStats(freshStats);
    setInventory(freshInv);
    engineRef.current?.syncExternalState(freshStats, freshInv);
    setZone('village');
    setFieldId('forest');
    setScreenState('playing');
    pushLog('모험 기록을 처음부터 다시 시작합니다.', 'neutral');
  };

  const effectiveCanvasState: GameScreenState =
    activeStation !== null ? 'paused' : screenState;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#1a1412]">
      <GameCanvas
        screenState={effectiveCanvasState}
        zone={zone}
        fieldId={fieldId}
        autoIdle={autoIdle}
        zoomOffset={zoomOffset}
        onZoomChange={(next) => setZoomOffset(next)}
        stats={stats}
        inventory={inventory}
        onStateSync={handleStateSync}
        onLog={pushLog}
        onZoneChange={handleZoneChange}
        onOpenVillageStation={(station) => {
          setStationResultText(null);
          setActiveStation(station);
        }}
        onPlayerDefeated={handlePlayerDefeated}
        engineRef={engineRef}
      />

      {screenState === 'title' && (
        <TitleScreen
          onStart={startGame}
          hasSavedProgress={initialSave.current !== null}
        />
      )}

      {screenState !== 'title' && (
        <GameHud
          zone={zone}
          fieldId={fieldId}
          stats={stats}
          inventory={inventory}
          autoIdle={autoIdle}
          currentTargetLabel={currentTargetLabel}
          logs={logs}
          muted={muted}
          onToggleMute={() => {
            setMuted((prev) => {
              const next = !prev;
              soundEngine.setMuted(next);
              return next;
            });
          }}
          onPause={() =>
            setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'))
          }
          onEnterZone={handleZoneChange}
          onToggleAutoIdle={() => setAutoIdle((prev) => !prev)}
          onOpenStation={(station) => {
            setStationResultText(null);
            setActiveStation(station);
          }}
        />
      )}

      <VillageModals
        activeStation={activeStation}
        stats={stats}
        inventory={inventory}
        lastResultText={stationResultText}
        onClose={() => {
          setActiveStation(null);
          setStationResultText(null);
        }}
        onSelectField={(fid) => handleZoneChange('field', fid)}
        onCraftOne={handleCraftOne}
        onCraftBatch={handleCraftBatch}
        onSellItem={handleSellItem}
        onSellHerbs={handleSellHerbs}
        onEnhanceCharm={handleEnhanceCharm}
        onImbueCharm={handleImbueCharm}
        onChangeSkill={handleChangeSkill}
        onSetFieldDifficulty={handleSetFieldDifficulty}
        onBuyWinterSkin={handleBuyWinterSkin}
        onEquipSkin={handleEquipSkin}
      />

      <PauseModal
        open={screenState === 'paused' && !activeStation}
        stats={stats}
        onResume={() => setScreenState('playing')}
        onReturnTitle={() => {
          setZone('village');
          setScreenState('title');
        }}
        onResetSave={handleResetSave}
        onExportSave={exportSaveCode}
        onImportSave={importSaveCode}
      />
    </main>
  );
}
