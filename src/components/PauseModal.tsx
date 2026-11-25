import React, { useState } from 'react';
import type { PlayerStats } from '../game/types';

interface PauseModalProps {
  open: boolean;
  stats: PlayerStats;
  onResume: () => void;
  onReturnTitle: () => void;
  onResetSave: () => void;
  onExportSave: (passphrase: string) => Promise<string>;
  onImportSave: (code: string, passphrase: string) => Promise<void>;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  open,
  stats,
  onResume,
  onReturnTitle,
  onResetSave,
  onExportSave,
  onImportSave,
}) => {

  const [passphrase, setPassphrase] = useState('');
  const [saveCode, setSaveCode] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    setSaveMessage('');
    try {
      const code = await onExportSave(passphrase);
      setSaveCode(code);
      setSaveMessage('암호화된 저장 코드가 생성되었습니다. 코드를 복사해 안전한 곳에 보관하세요.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '저장 코드 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!saveCode.trim()) {
      setSaveMessage('불러올 저장 코드를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setSaveMessage('');
    try {
      await onImportSave(saveCode, passphrase);
      setSaveMessage('저장 데이터를 불러왔습니다.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '저장 데이터를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="일시정지 메뉴"
    >
      <div className="shrine-panel rounded-md w-full max-w-md p-5 text-[#fbf8f1]">
        <h2 className="font-display text-2xl font-bold text-[#fde68a]">
          잠시 쉬어가기
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono-num">
          <div className="p-2.5 bg-[#140f0e] border border-[#4a3728] rounded-xs">
            <div className="text-[11px] text-[#d9c5a0]">채집 횟수</div>
            <div className="text-base font-bold mt-0.5">{stats.totalGathered}</div>
          </div>
          <div className="p-2.5 bg-[#140f0e] border border-[#4a3728] rounded-xs">
            <div className="text-[11px] text-[#d9c5a0]">퇴치 요괴</div>
            <div className="text-base font-bold mt-0.5">{stats.totalDefeated}</div>
          </div>
          <div className="p-2.5 bg-[#140f0e] border border-[#4a3728] rounded-xs">
            <div className="text-[11px] text-[#d9c5a0]">부적 단계</div>
            <div className="text-base font-bold mt-0.5">+{stats.enhanceLevel}</div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[#140f0e] border border-[#4a3728] rounded-xs text-xs text-[#e6d5b8] space-y-1.5 leading-relaxed">
          <div className="font-bold text-[#fde68a]">모험 안내</div>
          <div>
            · 마을: 연단 화로에서 풀을 빚고(실패·일반·상급), 상점에서 약을 팔아 부적을 강화(성공/유지/하락, 비용 1.2배)합니다.
          </div>
          <div>
            · 필드: 상시 필드(숲·평원·강가)와 이벤트 필드(눈 쌓인 숲)에서 약초·열매·6종 요괴·5종 인연 이벤트를 만납니다.
          </div>
          <div>
            · 열매와 휴식: 열매는 5단계 맛과 효과(10초 배탈~황금빛 회복)가 있고, 마을에 머물면 체력이 자연 회복됩니다.
          </div>
          <div>
            · 이벤트 상점: 눈 쌓인 숲에서 얻은 눈송이로 겨울 무녀 스킨을 해금할 수 있습니다.
          </div>
        </div>


        <section className="mt-4 p-3 bg-[#140f0e] border border-[#38bdf8]/50 rounded-xs space-y-2">
          <div className="font-bold text-sm text-[#bae6fd]">암호화된 저장 코드</div>
          <p className="text-[11px] text-[#d9c5a0] leading-relaxed">
            암호를 설정해 현재 진행 상황을 코드로 내보내거나, 기존 코드를 불러올 수 있습니다.
            암호는 저장 코드와 별도로 기억해 주세요. 8자 이상을 사용하세요.
          </p>
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="저장 코드 암호 (8자 이상)"
            autoComplete="new-password"
            className="w-full px-3 py-2 text-xs bg-[#241b18] border border-[#6b4f3a] rounded-xs text-[#fbf8f1] outline-none focus:border-[#38bdf8]"
          />
          <button
            type="button"
            disabled={busy || passphrase.trim().length < 8}
            onClick={handleExport}
            className="shrine-button w-full py-2 text-xs font-bold bg-[#1e4b66] hover:bg-[#285f80] disabled:opacity-40 border border-[#38bdf8] rounded-xs cursor-pointer"
          >
            {busy ? '처리 중...' : '현재 진행 상황 내보내기'}
          </button>
          <textarea
            value={saveCode}
            onChange={(event) => setSaveCode(event.target.value)}
            placeholder="내보낸 코드가 여기에 표시됩니다. 불러올 때는 저장 코드를 붙여 넣으세요."
            rows={3}
            spellCheck={false}
            className="w-full resize-y px-3 py-2 text-[10px] leading-relaxed font-mono bg-[#241b18] border border-[#6b4f3a] rounded-xs text-[#e0f2fe] outline-none focus:border-[#38bdf8] select-text"
          />
          <button
            type="button"
            disabled={busy || passphrase.trim().length < 8 || !saveCode.trim()}
            onClick={handleImport}
            className="shrine-button w-full py-2 text-xs font-bold bg-[#24543e] hover:bg-[#2e6a4e] disabled:opacity-40 border border-[#4ade80] rounded-xs cursor-pointer"
          >
            저장 코드 불러오기
          </button>
          {saveMessage && <p role="status" className="text-[11px] text-[#bae6fd] leading-relaxed">{saveMessage}</p>}
        </section>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="shrine-button w-full py-2.5 px-4 font-bold bg-[#d93829] hover:bg-[#e54839] text-white border border-[#f3ca52] rounded-xs cursor-pointer"
          >
            산책 계속하기
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReturnTitle}
              className="shrine-button flex-1 py-2 px-3 text-xs font-medium bg-[#3b2d26] hover:bg-[#4e3b31] border border-[#6b4f3a] rounded-xs cursor-pointer"
            >
              타이틀 화면으로
            </button>
            <button
              type="button"
              onClick={onResetSave}
              className="shrine-button flex-1 py-2 px-3 text-xs font-medium bg-[#2b1a18] hover:bg-[#3f2320] text-[#fca5a5] border border-[#7f1d1d] rounded-xs cursor-pointer"
            >
              기록 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
