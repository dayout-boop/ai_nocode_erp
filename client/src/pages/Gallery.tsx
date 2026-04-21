// ============================================================
// DOGOLF Gallery Page — "Verdant Journey" Design
// ============================================================

import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KakaoFloat from '@/components/KakaoFloat';

const galleryItems = [
  { id: 1, src: '/manus-storage/hero_main_aa4ec84e.jpg', title: '열대 골프 리조트', category: '해외', destination: '태국' },
  { id: 2, src: '/manus-storage/hero_korea_853e915a.jpg', title: '한국 가을 골프', category: '국내', destination: '대한민국' },
  { id: 3, src: '/manus-storage/hero_thailand_36cfbb15.jpg', title: '방콕 골프 클럽', category: '해외', destination: '태국' },
  { id: 4, src: '/manus-storage/hero_vietnam_84cd2877.jpg', title: '다낭 오션뷰 코스', category: '해외', destination: '베트남' },
  { id: 5, src: '/manus-storage/hero_philippines_1d03eac3.jpg', title: '클락 정글 코스', category: '해외', destination: '필리핀' },
  { id: 6, src: '/manus-storage/hero_japan_866efe7e.jpg', title: '후지산 뷰 골프', category: '해외', destination: '일본' },
  { id: 7, src: '/manus-storage/hero_china_e9244f94.jpg', title: '베이징 명문 코스', category: '해외', destination: '중국' },
  { id: 8, src: '/manus-storage/gallery1_d11c45f2.jpg', title: '즐거운 라운딩', category: '고객', destination: '대한민국' },
  { id: 9, src: '/manus-storage/gallery2_0b08ffeb.jpg', title: '럭셔리 리조트', category: '리조트', destination: '태국' },
  { id: 10, src: '/manus-storage/gallery3_64c53d07.jpg', title: '새벽 라운딩', category: '코스', destination: '미국' },
];

const categories = ['전체', '국내', '해외', '고객', '리조트', '코스'];

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState('전체');
  const [selectedImage, setSelectedImage] = useState<typeof galleryItems[0] | null>(null);

  const filtered = activeCategory === '전체'
    ? galleryItems
    : galleryItems.filter((item) => item.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative h-48 md:h-64 overflow-hidden">
        <img src="/manus-storage/gallery1_d11c45f2.jpg" alt="갤러리" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <p className="text-white/70 text-sm font-body mb-2">홈 &gt; 여행 갤러리</p>
            <h1 className="font-display-ko text-3xl md:text-5xl font-bold text-white">여행 갤러리</h1>
            <p className="text-white/70 font-body mt-2">두골프와 함께한 아름다운 골프 여행의 순간들</p>
          </div>
        </div>
      </section>

      {/* Category filter */}
      <section className="bg-white border-b border-gray-100 py-4">
        <div className="container">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-semibold font-body transition-all ${
                  activeCategory === cat
                    ? 'bg-dogolf-green text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery grid */}
      <section className="py-12 bg-gray-50 flex-1">
        <div className="container">
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="break-inside-avoid group relative rounded-xl overflow-hidden cursor-pointer"
                onClick={() => setSelectedImage(item)}
              >
                <img
                  src={item.src}
                  alt={item.title}
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                  <ZoomIn size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-sm font-semibold font-body">{item.title}</p>
                  <p className="text-white/70 text-xs font-body">{item.destination}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <X size={32} />
          </button>
          <div className="max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.src}
              alt={selectedImage.title}
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
            <div className="text-center mt-4">
              <p className="text-white font-semibold font-body">{selectedImage.title}</p>
              <p className="text-white/60 text-sm font-body">{selectedImage.destination}</p>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <KakaoFloat />
    </div>
  );
}
