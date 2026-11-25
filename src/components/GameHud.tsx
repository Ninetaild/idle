import React, { useEffect, useState } from 'react';
import {
  Flame,
  Footprints,
  Home,
  Pause,
  Play,
  Snowflake,
  Store,
  Volume2,
  VolumeX,
  ZoomIn,
} from 'lucide-react';
import { FIELD_METADATA } from '../game/logic';
import type {
  FieldId,
  Inventory,
  LogEntry,
  PlayerStats,
  ZoneId,
} from '../game/types';

export type VillageStationId = 'alchemy' | 'merchant' | 'event_shop' | 'field_select';

interface GameHudProps {
  zone: ZoneId;
  fieldId: FieldId;
  stats: PlayerStats;
  inventory: Inventory;
  autoIdle: boolean;
  pixelScale: number;
  visibleTiles: { cols: number; rows: number };
  currentTargetLabel: string | null;
  logs: LogEntry[];
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onCycleZoom: () => void;
  onEnterZone: (zone: ZoneId, fieldId?: FieldId) => void;
  onToggleAutoIdle: () => void;
  onOpenStation: (station: VillageStationId) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  zone,
  fieldId,
  stats,
  inventory,
  autoIdle,
  pixelScale,
  visibleTiles,
  currentTargetLabel,
  logs,
  muted,
  onToggleMute,
  onPause,
  onCycleZoom,
  onEnterZone,
  onToggleAutoIdle,
  onOpenStation,
}) => {
  const [ghostHp, setGhostHp] = useState(stats.hp);

  useEffect(() => {
    if (stats.hp >= ghostHp) {
      setGhostHp(stats.hp);
      return;
    }
    const timer = setTimeout(() => {
      setGhostHp(stats.hp);
    }, 320);
    return () => clearTimeout(timer);
  }, [stats.hp, ghostHp]);

  const hpPct = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const ghostPct = Math.max(0, Math.min(100, (ghostHp / stats.maxHp) * 100));
  const stomachSec = Math.ceil(stats.stomachacheTimer);

  const fieldMeta = FIELD_METADATA[fieldId];
  const zoneTitle =
    zone === 'village'
      ? '신사 마을'
      : `${fieldMeta.category === 'event' ? '이벤트' : '상시'} · ${fieldMeta.name}`;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 md:p-4">
      {/* Top Perimeter Row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        {/* Top-Left Compact Player Status Cluster */}
        <div className="pointer-events-auto shrine-panel rounded-md px-3 py-2 min-w-[205px] md:min-w-[250px] max-w-[330px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold tracking-wider text-[#d9c5a0] whitespace-nowrap">
              {zoneTitle}
            </span>
            <span className="font-mono-num text-xs text-[#fbf8f1] whitespace-nowrap">
              HP {Math.round(stats.hp)}/{Math.round(stats.maxHp)}
            </span>
          </div>

          <div className="relative h-2 w-full mt-1 bg-[#120e0d] border border-[#4a3728] rounded-xs overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#f59e0b]/70 transition-all duration-300"
              style={{ width: `${ghostPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[#d93829] transition-all duration-150"
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[11px] md:text-xs text-[#e6d5b8] font-mono-num whitespace-nowrap">
            <span>엽전 {Math.round(stats.gold)}</span>
            <span aria-hidden="true" className="text-[#6b4f3a]">
              ·
            </span>
            <span>선행 {Math.round(stats.goodDeeds)}</span>
            <span aria-hidden="true" className="text-[#6b4f3a]">
              ·
            </span>
            <span>
              부적 +{stats.enhanceLevel} ({Math.round(stats.attackPower)})
            </span>
          </div>
        </div>

        {/* Top-Right Compact Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0 md:order-3">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleZoom();
            }}
            aria-label={`시야 배율 변경 (현재 ${pixelScale}배, ${visibleTiles.cols}x${visibleTiles.rows} 타일)`}
            title={`해상도 기반 시야: ${visibleTiles.cols}x${visibleTiles.rows} 타일`}
            className="shrine-panel shrine-button h-8 md:h-9 px-2 md:px-2.5 rounded-md flex items-center gap-1 text-xs font-mono-num text-[#e6d5b8] hover:border-[#d9c5a0] cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
            <span>x{pixelScale}</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? '소리 켜기 [M]' : '음소거 [M]'}
            className="shrine-panel shrine-button w-8 h-8 md:w-9 md:h-9 rounded-md flex items-center justify-center text-[#e6d5b8] hover:border-[#d9c5a0] cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="일시정지 및 도감 [Esc]"
            className="shrine-panel shrine-button w-8 h-8 md:w-9 md:h-9 rounded-md flex items-center justify-center text-[#e6d5b8] hover:border-[#d9c5a0] cursor-pointer"
          >
            <Pause className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Top-Center Stomachache Debuff Alert (10s duration) */}
        {stomachSec > 0 && (
          <div
            role="status"
            className="pointer-events-auto shrine-panel border-[#f59e0b] rounded-md px-3.5 py-2 flex items-center gap-2 md:order-2"
          >
            <span className="text-xs font-bold text-[#fde68a] font-mono-num whitespace-nowrap">
              배탈 · 이동 불가 ({stomachSec}초)
            </span>
          </div>
        )}
      </div>

      {/* Bottom Perimeter Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5">
        <div className="pointer-events-none flex flex-col gap-1 max-w-md">
          {currentTargetLabel && zone === 'field' && (
            <div className="text-xs font-medium text-[#fde68a] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              우선 목표: {currentTargetLabel}
            </div>
          )}
          <div
            aria-live="polite"
            className="shrine-panel rounded-md px-3 py-2 flex flex-col gap-0.5 text-xs"
          >
            {logs.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.tone === 'positive'
                    ? 'text-[#86efac] truncate'
                    : entry.tone === 'warning'
                      ? 'text-[#fde68a] truncate'
                      : entry.tone === 'combat'
                        ? 'text-[#fca5a5] truncate'
                        : 'text-[#e6d5b8] truncate'
                }
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom-Right Unified Perimeter Action Dock */}
        <div className="pointer-events-auto shrine-panel rounded-md p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2.5 px-1.5 text-xs text-[#d9c5a0] font-mono-num whitespace-nowrap">
            <span>풀 {inventory.herbs}</span>
            <span aria-hidden="true" className="text-[#6b4f3a]">
              ·
            </span>
            <span>단약 {inventory.elixirs}</span>
            <span aria-hidden="true" className="text-[#6b4f3a]">
              ·
            </span>
            <span>무효약 {inventory.dudPills}</span>
            <span aria-hidden="true" className="text-[#6b4f3a]">
              ·
            </span>
            <span className="text-[#7dd3fc]">눈송이 {inventory.snowflakes}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {zone === 'village' ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStation('field_select');
                  }}
                  className="shrine-button px-3.5 py-2 text-xs md:text-sm font-bold bg-[#d93829] hover:bg-[#e54839] text-[#fbf8f1] border border-[#f3ca52] rounded-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Footprints className="w-4 h-4" aria-hidden="true" />
                  <span>산책</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStation('alchemy');
                  }}
                  className="shrine-button px-3 py-2 text-xs font-medium bg-[#3b2d26] hover:bg-[#4e3b31] text-[#fbf8f1] border border-[#6b4f3a] rounded-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-[#f59e0b]" aria-hidden="true" />
                  <span>연단</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStation('merchant');
                  }}
                  className="shrine-button px-3 py-2 text-xs font-medium bg-[#3b2d26] hover:bg-[#4e3b31] text-[#fbf8f1] border border-[#6b4f3a] rounded-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-[#fde68a]" aria-hidden="true" />
                  <span>상점</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenStation('event_shop');
                  }}
                  className="shrine-button px-3 py-2 text-xs font-medium bg-[#1e3246] hover:bg-[#28425c] text-[#e0f2fe] border border-[#38bdf8] rounded-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Snowflake className="w-3.5 h-3.5 text-[#7dd3fc]" aria-hidden="true" />
                  <span>이벤트 상점</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onEnterZone('village');
                  }}
                  className="shrine-button px-3.5 py-2 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] text-[#fbf8f1] border border-[#d9c5a0] rounded-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>마을로 귀환</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleAutoIdle();
                  }}
                  className={`shrine-button px-3 py-2 text-xs font-bold border rounded-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    autoIdle
                      ? 'bg-[#2a4a37] text-[#86efac] border-[#4ade80]'
                      : 'bg-[#2b221e] text-[#d9c5a0] border-[#6b4f3a]'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>자동 탐험 {autoIdle ? 'ON' : 'OFF'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
