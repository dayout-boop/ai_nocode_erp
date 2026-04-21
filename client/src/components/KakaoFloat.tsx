// ============================================================
// DOGOLF KakaoFloat — Floating KakaoTalk Button
// ============================================================

import { useState } from 'react';
import { X } from 'lucide-react';

export default function KakaoFloat() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      {isExpanded && (
        <div className="bg-white rounded-2xl shadow-2xl p-4 w-64 border border-gray-100 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#FEE500] rounded-full flex items-center justify-center">
                <span className="text-sm">💬</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 font-body">두골프 상담</p>
                <p className="text-xs text-green-600 font-body">온라인 상태</p>
              </div>
            </div>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-600 font-body mb-3 leading-relaxed">
            안녕하세요! 두골프입니다. 🏌️<br />
            골프 여행 패키지에 대해 궁금한 점이 있으시면 카카오톡으로 편하게 문의해 주세요.
          </p>
          <a
            href="https://open.kakao.com/o/dogolf"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2.5 bg-[#FEE500] text-[#3A1D1D] text-sm font-semibold font-body rounded-xl text-center hover:bg-[#FFD700] transition-colors"
          >
            카카오톡 상담 시작하기
          </a>
          <p className="text-xs text-gray-400 font-body text-center mt-2">
            평일 09:00 ~ 17:30 운영
          </p>
        </div>
      )}

      {/* Float button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="kakao-float"
        aria-label="카카오톡 상담"
      >
        {isExpanded ? (
          <X size={20} className="text-[#3A1D1D]" />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3C6.477 3 2 6.925 2 11.75c0 3.04 1.77 5.71 4.45 7.31L5.5 22l3.5-1.75c.96.27 1.97.42 3 .42 5.523 0 10-3.925 10-8.75S17.523 3 12 3z"
              fill="#3A1D1D"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
