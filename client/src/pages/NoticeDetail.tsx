import { useParams, Link } from 'wouter';
import { ArrowLeft, Calendar, Eye, Pin, Share2, Phone } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notices } from '@/lib/data';

export default function NoticeDetail() {
  const params = useParams<{ id: string }>();
  const noticeId = parseInt(params.id || '0', 10);
  const notice = notices.find((n) => n.id === noticeId);

  // 이전/다음 공지
  const currentIndex = notices.findIndex((n) => n.id === noticeId);
  const prevNotice = currentIndex > 0 ? notices[currentIndex - 1] : null;
  const nextNotice = currentIndex < notices.length - 1 ? notices[currentIndex + 1] : null;

  if (!notice) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-4">존재하지 않는 게시글입니다.</p>
            <Link href="/notice">
              <button className="px-6 py-2 bg-dogolf-green text-white rounded-xl font-body text-sm hover:bg-dogolf-green-dark transition-colors">
                목록으로 돌아가기
              </button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const categoryColor =
    notice.category === '이벤트'
      ? 'bg-red-50 text-dogolf-red border-red-100'
      : notice.category === '신상품'
      ? 'bg-purple-50 text-dogolf-purple border-purple-100'
      : 'bg-green-50 text-dogolf-green border-green-100';

  // content를 마크다운 스타일로 렌더링 (줄바꿈 및 **bold** 처리)
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      // **bold** 처리
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const rendered = parts.map((part, j) =>
        j % 2 === 1 ? <strong key={j} className="font-bold text-gray-900">{part}</strong> : part
      );
      return (
        <p key={i} className={`${line === '' ? 'mb-3' : 'mb-1'} text-gray-700 leading-relaxed font-body`}>
          {rendered}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      {/* 히어로 */}
      <section
        className="relative h-40 flex items-center"
        style={{
          background: 'linear-gradient(135deg, #1a5c2a 0%, #2d8a4e 100%)',
        }}
      >
        <div className="container">
          <nav className="text-white/60 text-xs font-body mb-2">
            홈 &gt; <Link href="/notice"><span className="hover:text-white cursor-pointer">공지사항</span></Link> &gt; <span className="text-white">{notice.category}</span>
          </nav>
          <h1 className="font-display-ko text-2xl md:text-3xl font-bold text-white">공지사항 &amp; 이벤트</h1>
        </div>
      </section>

      <main className="flex-1 py-10">
        <div className="container max-w-4xl mx-auto px-4">

          {/* 뒤로가기 */}
          <Link href="/notice">
            <button className="flex items-center gap-2 text-gray-500 hover:text-dogolf-green transition-colors text-sm font-body mb-6">
              <ArrowLeft size={16} />
              목록으로
            </button>
          </Link>

          {/* 게시글 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 헤더 */}
            <div className="p-6 md:p-8 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                {notice.isImportant && (
                  <span className="flex items-center gap-1 text-dogolf-red text-xs font-bold">
                    <Pin size={12} />
                    중요
                  </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border font-body ${categoryColor}`}>
                  {notice.category}
                </span>
              </div>
              <h2 className="font-display-ko text-xl md:text-2xl font-bold text-gray-900 mb-4 leading-snug">
                {notice.title}
              </h2>
              <div className="flex items-center gap-4 text-xs text-gray-400 font-number">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {notice.date}
                </span>
                <span className="flex items-center gap-1">
                  <Eye size={12} />
                  조회 {notice.views.toLocaleString()}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                  }}
                  className="flex items-center gap-1 hover:text-dogolf-green transition-colors ml-auto"
                >
                  <Share2 size={12} />
                  공유
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="p-6 md:p-8 min-h-[200px]">
              {notice.content ? (
                <div className="prose max-w-none">
                  {renderContent(notice.content)}
                </div>
              ) : (
                <p className="text-gray-400 font-body text-sm">내용이 없습니다.</p>
              )}
            </div>

            {/* 하단 CTA */}
            <div className="px-6 md:px-8 pb-6 md:pb-8">
              <div className="bg-dogolf-cream rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-display-ko font-bold text-gray-800 text-sm mb-1">더 궁금한 점이 있으신가요?</p>
                  <p className="text-gray-500 text-xs font-body">전문 상담사가 친절하게 안내해 드립니다</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href="http://pf.kakao.com/_xbHHSV"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-yellow-400 text-gray-900 font-semibold text-xs rounded-lg hover:bg-yellow-500 transition-colors font-body"
                  >
                    💬 카카오톡 문의
                  </a>
                  <a
                    href="tel:1668-1739"
                    className="px-4 py-2 bg-dogolf-green text-white font-semibold text-xs rounded-lg hover:bg-dogolf-green-dark transition-colors font-body flex items-center gap-1"
                  >
                    <Phone size={12} />
                    1668-1739
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 이전/다음 글 */}
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {nextNotice && (
              <Link href={`/notice/${nextNotice.id}`}>
                <div className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                  <span className="text-xs text-gray-400 font-body w-10 shrink-0">다음글</span>
                  <span className="text-sm text-gray-700 font-body truncate hover:text-dogolf-green transition-colors">
                    {nextNotice.title}
                  </span>
                  <span className="text-xs text-gray-400 font-number ml-auto shrink-0">{nextNotice.date}</span>
                </div>
              </Link>
            )}
            {prevNotice && (
              <Link href={`/notice/${prevNotice.id}`}>
                <div className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                  <span className="text-xs text-gray-400 font-body w-10 shrink-0">이전글</span>
                  <span className="text-sm text-gray-700 font-body truncate hover:text-dogolf-green transition-colors">
                    {prevNotice.title}
                  </span>
                  <span className="text-xs text-gray-400 font-number ml-auto shrink-0">{prevNotice.date}</span>
                </div>
              </Link>
            )}
          </div>

          {/* 목록 버튼 */}
          <div className="text-center mt-6">
            <Link href="/notice">
              <button className="px-8 py-2.5 border-2 border-dogolf-green text-dogolf-green font-semibold font-body rounded-xl hover:bg-dogolf-green hover:text-white transition-all duration-200 text-sm">
                목록으로 돌아가기
              </button>
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
