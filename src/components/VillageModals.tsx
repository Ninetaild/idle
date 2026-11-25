import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getMikoAsset } from '../game/hdAssets';
import { ECONOMY_PRICES, FIELD_METADATA } from '../game/logic';
import { getEnhancePool } from '../game/probability';
import type { FieldId, Inventory, MikoSkinId, PlayerStats } from '../game/types';
import type { VillageStationId } from './GameHud';

interface VillageModalsProps {
  activeStation: VillageStationId | null;
  stats: PlayerStats;
  inventory: Inventory;
  lastResultText: string | null;
  onClose: () => void;
  onSelectField: (fieldId: FieldId) => void;
  onCraftOne: () => void;
  onCraftBatch: () => void;
  onSellItem: (item: 'elixir' | 'dudPill', qty: number) => void;
  onSellHerbs: (qty: number) => void;
  onEnhanceCharm: () => void;
  onBuyWinterSkin: () => void;
  onEquipSkin: (skin: MikoSkinId) => void;
}

const SkinPreviewCanvas: React.FC<{ skin: MikoSkinId }> = ({ skin }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, c.width, c.height);
    const spr = getMikoAsset('down', 'idle', 0, skin);
    ctx.drawImage(spr, 0, 0, c.width, c.height);
  }, [skin]);

  return (
    <canvas
      ref={ref}
      width={128}
      height={90}
      className="w-24 h-[68px] object-contain bg-[#140f0e] border border-[#4a3728] rounded-xs shrink-0"
    />
  );
};

export const VillageModals: React.FC<VillageModalsProps> = ({
  activeStation,
  stats,
  inventory,
  lastResultText,
  onClose,
  onSelectField,
  onCraftOne,
  onCraftBatch,
  onSellItem,
  onSellHerbs,
  onEnhanceCharm,
  onBuyWinterSkin,
  onEquipSkin,
}) => {
  if (!activeStation) return null;

  const hasWinterSkin = stats.unlockedSkins.includes('winter_miko');
  const openFields: FieldId[] = ['forest', 'plains', 'river'];
  const eventFields: FieldId[] = ['snowy_forest'];

  const enhancePool = getEnhancePool(stats.enhanceLevel);
  const successPct = Math.round((enhancePool.find((e) => e.code === 'success')?.per ?? 0) * 100);
  const maintainPct = Math.round((enhancePool.find((e) => e.code === 'maintain')?.per ?? 0) * 100);
  const downgradePct = Math.round((enhancePool.find((e) => e.code === 'downgrade')?.per ?? 0) * 100);

  const modalTitle =
    activeStation === 'alchemy'
      ? '단약 연단 화로'
      : activeStation === 'merchant'
        ? '마을 상점 · 부적 강화'
        : activeStation === 'event_shop'
          ? '겨울 이벤트 상점'
          : '산책할 필드 선택';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
    >
      <div className="shrine-panel rounded-md w-full max-w-lg p-5 text-[#fbf8f1] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#4a3728]">
          <h2 className="font-display text-xl font-bold text-[#fde68a]">
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="p-1.5 text-[#d9c5a0] hover:text-white rounded-xs cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          {activeStation === 'field_select' && (
            <>
              <div>
                <div className="text-xs font-bold text-[#86efac] mb-2">
                  상시 오픈 필드
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {openFields.map((fid) => {
                    const meta = FIELD_METADATA[fid];
                    return (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => onSelectField(fid)}
                        className="shrine-button text-left p-3 bg-[#241b18] hover:bg-[#342722] border border-[#6b4f3a] hover:border-[#86efac] rounded-xs cursor-pointer flex flex-col gap-1"
                      >
                        <span className="font-bold text-[#fbf8f1]">{meta.name}</span>
                        <span className="text-[11px] text-[#d9c5a0] leading-snug">
                          {meta.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#4a3728]">
                <div className="text-xs font-bold text-[#7dd3fc] mb-2">
                  이벤트 필드
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {eventFields.map((fid) => {
                    const meta = FIELD_METADATA[fid];
                    return (
                      <button
                        key={fid}
                        type="button"
                        onClick={() => onSelectField(fid)}
                        className="shrine-button text-left p-3.5 bg-[#172838] hover:bg-[#1e354a] border border-[#38bdf8] rounded-xs cursor-pointer flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-[#e0f2fe]">{meta.name}</div>
                          <div className="text-xs text-[#bae6fd] mt-0.5">
                            {meta.subtitle}
                          </div>
                        </div>
                        <span className="px-3 py-1.5 text-xs font-bold bg-[#0284c7] text-white rounded-xs whitespace-nowrap shrink-0">
                          입장하기
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeStation === 'event_shop' && (
            <>
              <div className="flex items-center justify-between py-2.5 px-3 bg-[#140f0e] border border-[#38bdf8]/40 rounded-xs font-mono-num text-xs">
                <span className="text-[#7dd3fc] font-bold">
                  보유 눈송이: {inventory.snowflakes}개
                </span>
                <span className="text-[#d9c5a0]">
                  현재 착용: {stats.equippedSkin === 'winter_miko' ? '겨울 무녀' : '기본 무녀'}
                </span>
              </div>

              {lastResultText && (
                <div className="py-2 px-3 bg-[#172838] border border-[#38bdf8] rounded-xs text-xs text-[#e0f2fe]">
                  {lastResultText}
                </div>
              )}

              <div className="p-3 bg-[#241b18] border border-[#6b4f3a] rounded-xs flex items-center gap-3.5">
                <SkinPreviewCanvas skin="winter_miko" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#e0f2fe]">겨울 무녀 (스킨)</div>
                  <p className="text-xs text-[#d9c5a0] mt-0.5 leading-relaxed">
                    따뜻한 흰 털 하오리와 하늘빛 목도리, 눈꽃 고헤이를 든 겨울 복장 무녀입니다.
                  </p>
                  <div className="text-xs font-mono-num text-[#7dd3fc] mt-1">
                    {hasWinterSkin
                      ? '보유 완료'
                      : `가격: 눈송이 ${ECONOMY_PRICES.winterMikoSnowflakes}개`}
                  </div>
                </div>
                {!hasWinterSkin ? (
                  <button
                    type="button"
                    disabled={inventory.snowflakes < ECONOMY_PRICES.winterMikoSnowflakes}
                    onClick={onBuyWinterSkin}
                    className="shrine-button px-3.5 py-2 text-xs font-bold bg-[#0284c7] hover:bg-[#0ea5e9] disabled:opacity-40 text-white rounded-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    구매하기
                  </button>
                ) : stats.equippedSkin === 'winter_miko' ? (
                  <button
                    type="button"
                    onClick={() => onEquipSkin('default')}
                    className="shrine-button px-3.5 py-2 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] text-[#fde68a] border border-[#6b4f3a] rounded-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    기본 복장으로
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEquipSkin('winter_miko')}
                    className="shrine-button px-3.5 py-2 text-xs font-bold bg-[#0284c7] hover:bg-[#0ea5e9] text-white rounded-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    착용하기
                  </button>
                )}
              </div>

              <div className="p-3 bg-[#140f0e] border border-[#4a3728] rounded-xs flex items-center gap-3.5">
                <SkinPreviewCanvas skin="default" />
                <div className="flex-1">
                  <div className="font-bold text-[#fbf8f1]">기본 무녀</div>
                  <div className="text-xs text-[#d9c5a0] mt-0.5">
                    전통 흰 소매와 붉은 하카마를 입은 기본 무녀 복장입니다.
                  </div>
                </div>
                {stats.equippedSkin === 'default' ? (
                  <span className="text-xs font-bold text-[#86efac] whitespace-nowrap">
                    착용 중
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEquipSkin('default')}
                    className="shrine-button px-3 py-1.5 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] border border-[#6b4f3a] rounded-xs cursor-pointer"
                  >
                    착용하기
                  </button>
                )}
              </div>
            </>
          )}

          {activeStation === 'alchemy' && (
            <>
              <p className="text-[#e6d5b8] leading-relaxed">
                필드에서 채집한 알 수 없는 풀 1개를 연단하여 단약을 빚습니다.
                <br />
                <span className="text-xs text-[#d9c5a0] font-mono-num">
                  확률: 효과 없는 약 65% · 단약 1개 25% · 상급 단약 2개 10%
                </span>
              </p>

              <div className="flex items-center justify-between py-2.5 px-3 bg-[#140f0e] border border-[#4a3728] rounded-xs font-mono-num text-xs">
                <span>보유 풀: {inventory.herbs}</span>
                <span>단약: {inventory.elixirs}</span>
                <span>효과 없는 약: {inventory.dudPills}</span>
              </div>

              {lastResultText && (
                <div className="py-2 px-3 bg-[#241b18] border border-[#6b4f3a] rounded-xs text-xs text-[#fde68a]">
                  {lastResultText}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={inventory.herbs < 1}
                  onClick={onCraftOne}
                  className="shrine-button flex-1 py-2.5 px-4 font-bold bg-[#d93829] hover:bg-[#e54839] disabled:opacity-45 text-white border border-[#f3ca52] rounded-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  1회 연단하기
                </button>
                <button
                  type="button"
                  disabled={inventory.herbs < 1}
                  onClick={onCraftBatch}
                  className="shrine-button py-2.5 px-4 font-bold bg-[#3b2d26] hover:bg-[#4e3b31] disabled:opacity-45 text-[#fde68a] border border-[#6b4f3a] rounded-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  모두 연단
                </button>
              </div>
            </>
          )}

          {activeStation === 'merchant' && (
            <>
              <p className="text-[#e6d5b8]">
                단약과 효과 없는 약을 팔아 엽전을 모으고, 퇴마 부적을 단계별로 강화할 수 있습니다.
              </p>

              <div className="flex items-center justify-between py-2 px-3 bg-[#140f0e] border border-[#4a3728] rounded-xs font-mono-num text-xs">
                <span>보유 엽전: {stats.gold}</span>
                <span>단약: {inventory.elixirs}</span>
                <span>효과 없는 약: {inventory.dudPills}</span>
              </div>

              {lastResultText && (
                <div className="py-2 px-3 bg-[#241b18] border border-[#6b4f3a] rounded-xs text-xs text-[#fde68a]">
                  {lastResultText}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 py-2 px-3 bg-[#241b18] border border-[#4a3728] rounded-xs">
                <div>
                  <div className="font-bold text-[#86efac]">필드 약초</div>
                  <div className="text-xs text-[#d9c5a0] font-mono-num">개당 {ECONOMY_PRICES.herbSell}엽전</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={inventory.herbs < 1}
                    onClick={() => onSellHerbs(1)}
                    className="shrine-button px-2.5 py-1.5 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] disabled:opacity-40 border border-[#6b4f3a] rounded-xs cursor-pointer"
                  >
                    1개 판매
                  </button>
                  <button
                    type="button"
                    disabled={inventory.herbs < 1}
                    onClick={() => onSellHerbs(inventory.herbs)}
                    className="shrine-button px-2.5 py-1.5 text-xs font-bold bg-[#24543e] hover:bg-[#2e6a4e] disabled:opacity-40 border border-[#4ade80] rounded-xs cursor-pointer"
                  >
                    전체 판매
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 py-2 px-3 bg-[#241b18] border border-[#4a3728] rounded-xs">
                  <div>
                    <div className="font-bold text-[#fde68a]">효능 있는 단약</div>
                    <div className="text-xs text-[#d9c5a0] font-mono-num">
                      개당 {ECONOMY_PRICES.elixirSell}엽전
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={inventory.elixirs < 1}
                      onClick={() => onSellItem('elixir', 1)}
                      className="shrine-button px-2.5 py-1.5 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] disabled:opacity-40 border border-[#6b4f3a] rounded-xs cursor-pointer"
                    >
                      1개 판매
                    </button>
                    <button
                      type="button"
                      disabled={inventory.elixirs < 1}
                      onClick={() => onSellItem('elixir', inventory.elixirs)}
                      className="shrine-button px-2.5 py-1.5 text-xs font-bold bg-[#d93829] hover:bg-[#e54839] disabled:opacity-40 border border-[#f3ca52] rounded-xs cursor-pointer"
                    >
                      전체 판매
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 py-2 px-3 bg-[#241b18] border border-[#4a3728] rounded-xs">
                  <div>
                    <div className="font-bold text-[#e6d5b8]">효과 없는 약</div>
                    <div className="text-xs text-[#d9c5a0] font-mono-num">
                      개당 {ECONOMY_PRICES.dudPillSell}엽전
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={inventory.dudPills < 1}
                      onClick={() => onSellItem('dudPill', 1)}
                      className="shrine-button px-2.5 py-1.5 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] disabled:opacity-40 border border-[#6b4f3a] rounded-xs cursor-pointer"
                    >
                      1개 판매
                    </button>
                    <button
                      type="button"
                      disabled={inventory.dudPills < 1}
                      onClick={() => onSellItem('dudPill', inventory.dudPills)}
                      className="shrine-button px-2.5 py-1.5 text-xs font-bold bg-[#3b2d26] hover:bg-[#4e3b31] disabled:opacity-40 border border-[#6b4f3a] rounded-xs cursor-pointer"
                    >
                      전체 판매
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[#1c2822] border border-[#4ade80]/50 rounded-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#86efac]">
                        퇴마 부적 강화 (+{stats.enhanceLevel}단계)
                      </div>
                      <div className="text-xs text-[#e6d5b8] font-mono-num mt-0.5">
                        현재 공격력 {stats.attackPower} · 다음 강화 비용 {stats.enhanceCost}엽전
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={stats.gold < stats.enhanceCost}
                      onClick={onEnhanceCharm}
                      className="shrine-button px-3.5 py-2 text-xs font-bold bg-[#2a4a37] hover:bg-[#366047] disabled:opacity-40 border border-[#4ade80] text-[#d1fae5] rounded-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      강화 시도
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono-num px-2.5 py-1.5 bg-[#121916] border border-[#2f4b3b] rounded-xs text-[#d9c5a0]">
                    <span className="text-[#86efac]">성공 {successPct}%</span>
                    <span className="text-[#fde68a]">유지 {maintainPct}%</span>
                    <span className="text-[#fca5a5]">하락 {downgradePct}%</span>
                    <span className="text-[#bae6fd]">다음 비용 1.2배</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
