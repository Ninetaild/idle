import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getFoxMikoAsset, getEventMikoAsset } from '../game/hdAssets';
import { ABILITY_LABELS, ECONOMY_PRICES, FIELD_METADATA, getSkillMultiplier, SKILL_DEFINITIONS } from '../game/logic';
import { getDifficultyMultiplier, getEliteTable, getEnhancePool } from '../game/probability';
import type { AbilityRoll, FieldId, Inventory, MikoSkinId, PlayerStats } from '../game/types';
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
  onImbueCharm: () => void;
  onConvertSkill: () => void;
  /** Rolled options awaiting the player's decision (memorial). */
  pendingAbilities: AbilityRoll[] | null;
  onKeepAbilities: () => void;
  onAcceptAbilities: () => void;
  onSetFieldDifficulty: (fieldId: FieldId, level: number) => void;
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
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);

    // Use the exact sprite atlas frames used by the in-game protagonist.
    // Atlas images load asynchronously, so retry briefly before falling back.
    let attempts = 0;
    let raf = 0;
    const drawPreview = () => {
      const spr = skin === 'winter_miko'
        ? getEventMikoAsset('down', 'idle', 0)
        : getFoxMikoAsset('down', 'idle', 0);
      const isAtlasFrame = spr.width === 64 && spr.height === 96;
      if (isAtlasFrame || attempts >= 60) {
        const scale = Math.min(c.width / spr.width, c.height / spr.height);
        const drawW = spr.width * scale;
        const drawH = spr.height * scale;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(spr, (c.width - drawW) / 2, (c.height - drawH) / 2, drawW, drawH);
        return;
      }
      attempts += 1;
      raf = requestAnimationFrame(drawPreview);
    };
    drawPreview();
    return () => cancelAnimationFrame(raf);
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
  onImbueCharm,
  onConvertSkill,
  pendingAbilities,
  onKeepAbilities,
  onAcceptAbilities,
  onSetFieldDifficulty,
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
  const skillId = stats.equippedSkill ?? 'foxfire_burst';
  const skill = SKILL_DEFINITIONS[skillId];
  const rewardHint = (level: number) =>
    `재화 ×${getDifficultyMultiplier(level).toFixed(2)} · 강적 ${(getEliteTable(level)[1].per * 100).toFixed(1)}%`;
  const abilityList = stats.abilities ?? [];

  const modalTitle =
    activeStation === 'alchemy'
      ? '단약 연단 화로'
      : activeStation === 'merchant'
        ? '마을 메뉴 · 부적 강화'
        : activeStation === 'event_shop'
          ? '겨울 이벤트 상점'
          : '산책할 필드 선택';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="shrine-panel rounded-md w-full max-w-lg p-5 text-[#fbf8f1] max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
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
                <div className="flex flex-col gap-2">
                  {openFields.map((fid) => {
                    const meta = FIELD_METADATA[fid];
                    const level = stats.fieldDifficulties?.[fid] ?? 1;
                    return (
                      <div key={fid} className="min-w-0 px-3 py-2.5 bg-[#241b18] border border-[#6b4f3a] rounded-xs flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#fbf8f1] whitespace-nowrap">{meta.name}</div>
                          <div className="text-[11px] text-[#d9c5a0] whitespace-nowrap overflow-hidden text-ellipsis">{meta.subtitle}</div>
                          <div className="text-[10px] text-[#fde68a] font-mono-num whitespace-nowrap overflow-hidden text-ellipsis">{rewardHint(level)}</div>
                        </div>
                        <label htmlFor={`difficulty-${fid}`} className="text-[11px] text-[#d9c5a0] whitespace-nowrap shrink-0">난이도</label>
                        <select id={`difficulty-${fid}`} value={level} onChange={(event) => onSetFieldDifficulty(fid, Number(event.target.value))} className="bg-[#140f0e] border border-[#6b4f3a] rounded-xs px-2 py-1 text-xs text-[#fde68a] whitespace-nowrap shrink-0">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}단계</option>)}</select>
                        <button type="button" onClick={() => onSelectField(fid)} className="shrine-button px-3 py-1.5 text-xs font-bold bg-[#24543e] border border-[#4ade80] rounded-xs whitespace-nowrap shrink-0">입장</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#4a3728]">
                <div className="text-xs font-bold text-[#7dd3fc] mb-2">
                  이벤트 필드
                </div>
                <div className="flex flex-col gap-2">
                  {eventFields.map((fid) => {
                    const meta = FIELD_METADATA[fid];
                    const level = stats.fieldDifficulties?.[fid] ?? 1;
                    return (
                      <div key={fid} className="min-w-0 px-3 py-2.5 bg-[#172838] border border-[#38bdf8] rounded-xs flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#e0f2fe] whitespace-nowrap">{meta.name}</div>
                          <div className="text-[11px] text-[#bae6fd] whitespace-nowrap overflow-hidden text-ellipsis">{meta.subtitle}</div>
                          <div className="text-[10px] text-[#fde68a] font-mono-num whitespace-nowrap overflow-hidden text-ellipsis">{rewardHint(level)}</div>
                        </div>
                        <label htmlFor={`difficulty-${fid}`} className="text-[11px] text-[#bae6fd] whitespace-nowrap shrink-0">난이도</label>
                        <select id={`difficulty-${fid}`} value={level} onChange={(event) => onSetFieldDifficulty(fid, Number(event.target.value))} className="bg-[#10202d] border border-[#38bdf8] rounded-xs px-2 py-1 text-xs text-[#e0f2fe] whitespace-nowrap shrink-0">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}단계</option>)}</select>
                        <button type="button" onClick={() => onSelectField(fid)} className="shrine-button px-3 py-1.5 text-xs font-bold bg-[#0284c7] text-white rounded-xs whitespace-nowrap shrink-0">입장</button>
                      </div>
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
                    <span className="text-[#bae6fd]">다음 비용 1.1배</span>
                  </div>
                </div>
                <button type="button" disabled={(inventory.jewels ?? 0) < ECONOMY_PRICES.abilityImprintJewels} onClick={onImbueCharm} hidden={pendingAbilities !== null} className="shrine-button w-full py-2 text-xs font-bold bg-[#4b3475] hover:bg-[#604397] disabled:opacity-40 border border-[#c4b5fd] text-[#ede9fe] rounded-xs">능력 부여 · 보옥 {ECONOMY_PRICES.abilityImprintJewels}개</button>
                <div className="text-[11px] text-[#d9c5a0]">보유 보옥: {inventory.jewels ?? 0}개 · 5종 중 3종 무작위 · 배율 1.1~1.5 (중위값 1.3)</div>
                {pendingAbilities ? (
                  <div role="group" aria-label="옵션 메모리얼" className="p-3 bg-[#1d1630] border border-[#c4b5fd] rounded-xs space-y-2">
                    <div className="text-xs font-bold text-[#ede9fe]">메모리얼 · 어느 옵션을 남길까요?</div>
                    <div className="grid grid-cols-2 gap-2">
                      {([['이전 옵션', abilityList], ['새 옵션', pendingAbilities]] as const).map(([title, list]) => (
                        <div key={title} className="p-2 bg-[#121916] border border-[#4b3475] rounded-xs text-[11px] text-[#ddd6fe] space-y-1">
                          <div className="font-bold text-[#fde68a]">{title}</div>
                          {list.map((ability) => <div key={ability.id}>{ABILITY_LABELS[ability.id]} ×{ability.multiplier.toFixed(2)}</div>)}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" autoFocus onClick={onKeepAbilities} className="shrine-button flex-1 py-2 text-xs font-bold bg-[#d93829] hover:bg-[#e54839] border border-[#f3ca52] text-white rounded-xs cursor-pointer">이전으로 되돌리기 (기본)</button>
                      <button type="button" onClick={onAcceptAbilities} className="shrine-button flex-1 py-2 text-xs font-bold bg-[#4b3475] hover:bg-[#604397] border border-[#c4b5fd] text-[#ede9fe] rounded-xs cursor-pointer">새 옵션 적용</button>
                    </div>
                    <div className="text-[10px] text-[#d9c5a0]">창을 닫으면 이전 옵션이 유지됩니다. 사용한 보옥은 돌려받지 않습니다.</div>
                  </div>
                ) : (
                  abilityList.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">{abilityList.map((ability) => <div key={ability.id} className="px-2 py-1.5 bg-[#121916] border border-[#4b3475] rounded-xs text-[11px] text-[#ddd6fe]">{ABILITY_LABELS[ability.id]} ×{ability.multiplier.toFixed(2)}</div>)}</div>
                )}
              </div>
              <div className="p-3 bg-[#172838] border border-[#38bdf8]/60 rounded-xs space-y-2">
                <div className="font-bold text-sm text-[#bae6fd]">전투 기술</div>
                <div className="text-[11px] text-[#d9c5a0]">변환 시 기술(범위/단일)과 위력이 무작위로 교체됩니다 · 범위 ×0.70~1.00 · 단일 ×1.20~1.50</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-[#e0f2fe] whitespace-nowrap">{skill.name} · 장착 중</div>
                    <div className="text-xs text-[#bae6fd] whitespace-nowrap">{skill.type === 'area' ? '범위' : '단일'} · 공격력 ×{getSkillMultiplier(stats).toFixed(2)}</div>
                  </div>
                  <button type="button" disabled={(inventory.jewels ?? 0) < ECONOMY_PRICES.skillChangeJewels} onClick={onConvertSkill} className="shrine-button px-3 py-2 text-xs font-bold bg-[#0284c7] hover:bg-[#0ea5e9] disabled:opacity-40 text-white rounded-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed">기술 변환 · 보옥 {ECONOMY_PRICES.skillChangeJewels}개</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
