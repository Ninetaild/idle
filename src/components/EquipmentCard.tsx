import React from 'react';
import {
  ABILITY_LABELS,
  ECONOMY_PRICES,
  EQUIPMENT_LABELS,
  getAccessoryGoldMultiplier,
  getDefense,
  getEnhanceCost,
  getEnhanceLevel,
  getEquipmentAbilities,
} from '../game/logic';
import { getEquipmentEnhancePool } from '../game/probability';
import type { AbilityRoll, EquipmentId, Inventory, PlayerStats } from '../game/types';

interface EquipmentCardProps {
  equipment: EquipmentId;
  stats: PlayerStats;
  inventory: Inventory;
  /** Rolled options awaiting a decision on any equipment. */
  pending: { equipment: EquipmentId; abilities: AbilityRoll[] } | null;
  onEnhance: (equipment: EquipmentId) => void;
  onImbue: (equipment: EquipmentId) => void;
  onKeep: () => void;
  onAccept: () => void;
}

const AbilityList: React.FC<{ title: string; abilities: AbilityRoll[] }> = ({ title, abilities }) => (
  <div className="p-2 bg-[#121916] border border-[#4b3475] rounded-xs text-[11px] text-[#ddd6fe] space-y-1">
    <div className="font-bold text-[#fde68a]">{title}</div>
    {abilities.length === 0 && <div className="text-[#a89172]">옵션 없음</div>}
    {abilities.map((ability) => <div key={ability.id}>{ABILITY_LABELS[ability.id]} ×{ability.multiplier.toFixed(2)}</div>)}
  </div>
);

export const EquipmentCard: React.FC<EquipmentCardProps> = ({ equipment, stats, inventory, pending, onEnhance, onImbue, onKeep, onAccept }) => {
  const level = getEnhanceLevel(stats, equipment);
  const cost = getEnhanceCost(stats, equipment);
  const abilities = getEquipmentAbilities(stats, equipment);
  const success = Math.round((getEquipmentEnhancePool(equipment, level).find((entry) => entry.code === 'success')?.per ?? 0) * 100);
  const statText =
    equipment === 'weapon'
      ? `공격력 ${stats.attackPower}`
      : equipment === 'armor'
        ? `방어력 ${getDefense(stats).toFixed(1)} · 최대 체력 ${Math.round(stats.maxHp)}`
        : `재화 획득 ×${getAccessoryGoldMultiplier(stats).toFixed(2)}`;

  return (
    <div role="region" aria-label={EQUIPMENT_LABELS[equipment]} className="p-3 bg-[#1c2822] border border-[#4ade80]/50 rounded-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-[#86efac]">{EQUIPMENT_LABELS[equipment]} (+{level}단계)</div>
          <div className="text-xs text-[#e6d5b8] font-mono-num mt-0.5">{statText}</div>
          <div className="text-xs text-[#d9c5a0] font-mono-num">다음 강화 비용 {cost}엽전</div>
        </div>
        <button type="button" disabled={stats.gold < cost} onClick={() => onEnhance(equipment)} className="shrine-button px-3.5 py-2 text-xs font-bold bg-[#2a4a37] hover:bg-[#366047] disabled:opacity-40 border border-[#4ade80] text-[#d1fae5] rounded-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed">강화 시도</button>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono-num px-2.5 py-1.5 bg-[#121916] border border-[#2f4b3b] rounded-xs text-[#d9c5a0]">
        <span className="text-[#86efac]">성공 {success}%</span>
        <span className="text-[#fde68a]">유지 {100 - success}%</span>
        <span className="text-[#bae6fd]">성공 시 비용 1.1배</span>
      </div>

      {pending?.equipment === equipment ? (
        <div role="group" aria-label="옵션 메모리얼" className="p-3 bg-[#1d1630] border border-[#c4b5fd] rounded-xs space-y-2">
          <div className="text-xs font-bold text-[#ede9fe]">메모리얼 · 어느 옵션을 남길까요?</div>
          <div className="grid grid-cols-2 gap-2">
            <AbilityList title="이전 옵션" abilities={abilities} />
            <AbilityList title="새 옵션" abilities={pending.abilities} />
          </div>
          <div className="flex gap-2">
            <button type="button" autoFocus onClick={onKeep} className="shrine-button flex-1 py-2 text-xs font-bold bg-[#d93829] hover:bg-[#e54839] border border-[#f3ca52] text-white rounded-xs cursor-pointer">이전으로 되돌리기 (기본)</button>
            <button type="button" onClick={onAccept} className="shrine-button flex-1 py-2 text-xs font-bold bg-[#4b3475] hover:bg-[#604397] border border-[#c4b5fd] text-[#ede9fe] rounded-xs cursor-pointer">새 옵션 적용</button>
          </div>
          <div className="text-[10px] text-[#d9c5a0]">창을 닫으면 이전 옵션이 유지됩니다. 사용한 보옥은 돌려받지 않습니다.</div>
        </div>
      ) : (
        <>
          {abilities.length > 0 && <AbilityList title="부여된 옵션" abilities={abilities} />}
          <button type="button" disabled={pending !== null || (inventory.jewels ?? 0) < ECONOMY_PRICES.abilityImprintJewels} onClick={() => onImbue(equipment)} className="shrine-button w-full py-2 text-xs font-bold bg-[#4b3475] hover:bg-[#604397] disabled:opacity-40 border border-[#c4b5fd] text-[#ede9fe] rounded-xs cursor-pointer disabled:cursor-not-allowed">능력 부여 · 보옥 {ECONOMY_PRICES.abilityImprintJewels}개</button>
        </>
      )}
    </div>
  );
};
