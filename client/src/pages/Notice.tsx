// ============================================================
// DOGOLF Notice Page — "Verdant Journey" Design
// ============================================================

import { useState } from 'react';
import { ChevronRight, Eye, Pin } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notices } from '@/lib/data';

const categories = ['전체', '공지사항', '이벤트', '신상품'];

const faqItems = [
  {
    q: '예약은 어떻게 하나요?',
    a: '홈페이지 예약 문의 폼을 작성하시거나, 카카오톡 상담 또는 전화(1668-1739)로 문의해 주시면 담당자가 안내해 드립니다.',
  },
  {
    q: '최소 출발 인원이 있나요?',
    a: '대부분의 패키지는 2인부터 출발 가능합니다. 일부 패키지는 1인 출발도 가능하니 문의해 주세요.',
  },
  {
    q: '취소 및 환불 정책은 어떻게 되나요?',
    a: '출발 30일 전까지 취소 시 전액 환불, 15일 전 50%, 7일 전 30% 환불됩니다. 자세한 내용은 상담 시 안내해 드립니다.',
  },
  {
    q: '항공권은 포함되어 있나요?',
    a: '해외 패키지의 경우 항공권 포함 여부는 패키지마다 다릅니다. 상세 페이지에서 확인하시거나 문의해 주세요.',
  },
  {
    q: '한국어 가이드가 동행하나요?',
    a: '주요 해외 패키지(태국, 베트남 등)는 한국인 가이드가 동행합니다. 패키지 상세 정보에서 확인하실 수 있습니다.',
  },
];

export default function Notice() {
  const [activeCategory, setActiveCategory] = useState('전체');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filtered = activeCategory === '전체'
    ? notices
    : notices.filter((n) => n.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative h-48 md:h-64 overflow-hidden">
        <img src="/manus-storage/hero_main_aa4ec84e.jpg" alt="공지사항" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-dogolf-green-dark/75" />
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <p className="text-white/70 text-sm font-body mb-2">홈 &gt; 공지사항</p>
            <h1 className="font-display-ko text-3xl md:text-5xl font-bold text-white">공지사항 & 이벤트</h1>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50 flex-1">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Notice list */}
            <div className="lg:col-span-2">
              {/* Category tabs */}
              <div className="flex gap-2 mb-6">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold font-body transition-all ${
                      activeCategory === cat
                        ? 'bg-dogolf-green text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-dogolf-green hover:text-dogolf-green'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 font-body">
                  <span className="col-span-1">번호</span>
                  <span className="col-span-2">분류</span>
                  <span className="col-span-6">제목</span>
                  <span className="col-span-2 text-right">날짜</span>
                  <span className="col-span-1 text-right">조회</span>
                </div>

                {filtered.map((notice) => (
                  <div
                    key={notice.id}
                    className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer items-center"
                  >
                    <span className="col-span-1 text-xs text-gray-400 font-number">
                      {notice.isImportant ? <Pin size={12} className="text-dogolf-red" /> : notice.id}
                    </span>
                    <span className={`col-span-2 destination-badge text-xs ${
                      notice.category === '이벤트' ? 'bg-red-50 text-dogolf-red' :
                      notice.category === '신상품' ? 'bg-purple-50 text-dogolf-purple' :
                      'bg-green-50 text-dogolf-green'
                    }`}>
                      {notice.category}
                    </span>
                    <div className="col-span-6 flex items-center gap-2">
                      {notice.isImportant && (
                        <span className="text-dogolf-red text-xs font-bold">[중요]</span>
                      )}
                      <span className="text-sm text-gray-800 font-body hover:text-dogolf-green transition-colors truncate">
                        {notice.title}
                      </span>
                    </div>
                    <span className="col-span-2 text-xs text-gray-400 font-number text-right">{notice.date}</span>
                    <span className="col-span-1 text-xs text-gray-400 font-number text-right flex items-center justify-end gap-0.5">
                      <Eye size={10} />
                      {notice.views.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ sidebar */}
            <div>
              <h3 className="font-display-ko text-xl font-bold text-gray-900 mb-4 section-title-underline">
                자주 묻는 질문
              </h3>
              <div className="space-y-3 mt-8">
                {faqItems.map((faq, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full px-4 py-4 text-left flex items-start gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-dogolf-green font-bold text-sm shrink-0 font-body">Q.</span>
                      <span className="text-sm font-semibold text-gray-800 font-body flex-1">{faq.q}</span>
                      <ChevronRight
                        size={16}
                        className={`text-gray-400 shrink-0 transition-transform mt-0.5 ${
                          expandedFaq === index ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    {expandedFaq === index && (
                      <div className="px-4 pb-4 pl-10">
                        <p className="text-sm text-gray-600 font-body leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Contact card */}
              <div className="mt-6 bg-dogolf-green rounded-2xl p-5 text-white">
                <h4 className="font-display-ko font-bold text-lg mb-2">더 궁금한 점이 있으신가요?</h4>
                <p className="text-white/80 text-sm font-body mb-4">전문 상담사가 친절하게 안내해 드립니다</p>
                <a
                  href="http://pf.kakao.com/_xbHHSV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 bg-[#FEE500] text-[#3A1D1D] text-sm font-bold font-body rounded-xl text-center hover:bg-[#FFD700] transition-colors"
                >
                  💬 카카오톡 문의
                </a>
                <a
                  href="tel:1668-1739"
                  className="block w-full py-2.5 bg-white/15 text-white text-sm font-bold font-body rounded-xl text-center hover:bg-white/25 transition-colors mt-2"
                >
                  📞 1668-1739
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
