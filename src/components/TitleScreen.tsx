import React from 'react';

interface TitleScreenProps {
  onStart: () => void;
  hasSavedProgress: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  hasSavedProgress,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-6 md:p-12 pointer-events-none"
      style={{
        background:
          'linear-gradient(180deg, rgba(16,13,12,0.72) 0%, rgba(16,13,12,0.22) 45%, rgba(16,13,12,0.78) 100%)',
      }}
    >
      {/* Top negative-space lockup with bespoke inline SVG shrine crest */}
      <div className="flex flex-col items-center text-center mt-2 md:mt-4 pointer-events-auto">
        <svg
          width="64"
          height="54"
          viewBox="0 0 76 64"
          fill="none"
          aria-hidden="true"
          className="mb-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
        >
          {/* Torii outer silhouette */}
          <path
            d="M8 14C22 18 54 18 68 14L65 20H11L8 14Z"
            fill="#d93829"
            stroke="#1d1619"
            strokeWidth="2.5"
          />
          <rect
            x="14"
            y="24"
            width="48"
            height="5"
            fill="#9e2118"
            stroke="#1d1619"
            strokeWidth="2"
          />
          <rect
            x="21"
            y="20"
            width="6"
            height="34"
            fill="#d93829"
            stroke="#1d1619"
            strokeWidth="2"
          />
          <rect
            x="49"
            y="20"
            width="6"
            height="34"
            fill="#d93829"
            stroke="#1d1619"
            strokeWidth="2"
          />
          {/* Center Gohei sacred staff */}
          <rect x="36.5" y="18" width="3" height="34" fill="#f3ca52" stroke="#1d1619" strokeWidth="1.5" />
          <path
            d="M35 23H31V28H35V33H31V37H35"
            fill="#fbf8f1"
            stroke="#1d1619"
            strokeWidth="1.5"
          />
          <path
            d="M41 23H45V28H41V33H45V37H41"
            fill="#fbf8f1"
            stroke="#1d1619"
            strokeWidth="1.5"
          />
        </svg>

        <h1
          className="font-display text-4xl md:text-6xl font-bold tracking-tight text-[#fbf8f1] drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]"
          style={{ textWrap: 'balance' }}
        >
          무녀의 약초 산책
        </h1>
        <p
          className="mt-2 text-sm md:text-base text-[#e6d5b8] max-w-xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
          style={{ textWrap: 'balance' }}
        >
          신사 마을과 사계절 숲길을 오가며 약초를 캐고 단약을 빚어보세요.
        </p>
      </div>

      {/* Bottom Start CTA & single flat control hint */}
      <div className="flex flex-col items-center gap-4 mb-2 pointer-events-auto">
        <button
          type="button"
          data-start="true"
          onClick={(e) => {
            e.currentTarget.blur();
            onStart();
          }}
          className="shrine-button px-8 py-3.5 text-base md:text-lg font-bold tracking-wide text-[#fbf8f1] bg-[#d93829] hover:bg-[#e54839] border-2 border-[#f3ca52] rounded-md shadow-[0_6px_22px_rgba(0,0,0,0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3ca52] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hasSavedProgress ? '산책 이어하기' : '산책 시작하기'}
        </button>

        <p className="text-xs md:text-sm text-[#d9c5a0] tracking-normal text-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          WASD / 방향키 이동 · 클릭 / 터치 우선 목표 · Esc 일시정지
        </p>
      </div>
    </div>
  );
};
