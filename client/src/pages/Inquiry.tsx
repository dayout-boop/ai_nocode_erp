// ============================================================
// DOGOLF Inquiry Page — "Verdant Journey" Design
// ============================================================

import { useState } from 'react';
import { CheckCircle, Phone, Mail, Clock, MapPin } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KakaoFloat from '@/components/KakaoFloat';
import { trpc } from '@/lib/trpc';

const destinations = [
  { value: '', label: '목적지를 선택해 주세요' },
  { value: 'korea', label: '🇰🇷 대한민국' },
  { value: 'thailand', label: '🇹🇭 태국' },
  { value: 'vietnam', label: '🇻🇳 베트남' },
  { value: 'philippines', label: '🇵🇭 필리핀' },
  { value: 'china', label: '🇨🇳 중국' },
  { value: 'japan', label: '🇯🇵 일본' },
  { value: 'other', label: '기타' },
];

const travelTypes = [
  { value: 'package', label: '패키지 여행' },
  { value: 'custom', label: '맞춤 여행' },
  { value: 'group', label: '단체 여행' },
  { value: 'corporate', label: '기업 골프 여행' },
];

export default function Inquiry() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    destination: '',
    travelType: 'package',
    people: '2',
    departureDate: '',
    nights: '',
    budget: '',
    message: '',
    agreePrivacy: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const createInquiryMutation = trpc.bookings.createInquiry.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (e) => {
      alert('제출 중 오류가 발생했습니다: ' + e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.destination) {
      alert('이름, 연락처, 목적지는 필수 입력 항목입니다.');
      return;
    }
    if (!form.agreePrivacy) {
      alert('개인정보 수집 및 이용에 동의해 주세요.');
      return;
    }
    createInquiryMutation.mutate({
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      packageName: form.destination,
      travelDate: form.departureDate || undefined,
      peopleCount: form.people ? Number(form.people) : undefined,
      message: form.message || undefined,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative h-48 md:h-64 overflow-hidden">
        <img src="/manus-storage/gallery2_0b08ffeb.jpg" alt="예약 문의" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-dogolf-green-dark/75" />
        <div className="absolute inset-0 flex items-center">
          <div className="container">
            <p className="text-white/70 text-sm font-body mb-2">홈 &gt; 예약 문의</p>
            <h1 className="font-display-ko text-3xl md:text-5xl font-bold text-white">예약 문의</h1>
            <p className="text-white/70 font-body mt-2">최적의 골프 여행 패키지를 추천해 드립니다</p>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50 flex-1">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              {isSubmitted ? (
                <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                  <CheckCircle size={64} className="text-dogolf-green mx-auto mb-4" />
                  <h2 className="font-display-ko text-2xl font-bold text-gray-900 mb-3">문의가 접수되었습니다!</h2>
                  <p className="text-gray-600 font-body mb-6 leading-relaxed">
                    담당자가 영업일 기준 1~2일 내에 연락드리겠습니다.<br />
                    빠른 상담을 원하시면 카카오톡이나 전화로 문의해 주세요.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <a
                      href="http://pf.kakao.com/_xbHHSV"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-[#FEE500] text-[#3A1D1D] font-bold font-body rounded-xl hover:bg-[#FFD700] transition-colors"
                    >
                      💬 카카오톡 상담
                    </a>
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="px-6 py-3 border-2 border-dogolf-green text-dogolf-green font-bold font-body rounded-xl hover:bg-dogolf-green hover:text-white transition-all"
                    >
                      다시 문의하기
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
                  <h2 className="font-display-ko text-2xl font-bold text-gray-900 mb-6">문의 양식</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        이름 <span className="text-dogolf-red">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="홍길동"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors"
                        required
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        연락처 <span className="text-dogolf-red">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        이메일
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="example@email.com"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors"
                      />
                    </div>

                    {/* Destination */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        여행 목적지 <span className="text-dogolf-red">*</span>
                      </label>
                      <select
                        name="destination"
                        value={form.destination}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors bg-white"
                        required
                      >
                        {destinations.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Travel type */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        여행 유형
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {travelTypes.map((type) => (
                          <label key={type.value} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="travelType"
                              value={type.value}
                              checked={form.travelType === type.value}
                              onChange={handleChange}
                              className="accent-dogolf-green"
                            />
                            <span className="text-sm font-body text-gray-700">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* People */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        인원 수
                      </label>
                      <select
                        name="people"
                        value={form.people}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors bg-white"
                      >
                        {['1', '2', '3', '4', '5~8', '9~12', '13명 이상'].map((n) => (
                          <option key={n} value={n}>{n}명</option>
                        ))}
                      </select>
                    </div>

                    {/* Departure date */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        희망 출발일
                      </label>
                      <input
                        type="date"
                        name="departureDate"
                        value={form.departureDate}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors"
                      />
                    </div>

                    {/* Nights */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                        여행 기간
                      </label>
                      <select
                        name="nights"
                        value={form.nights}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors bg-white"
                      >
                        <option value="">선택해 주세요</option>
                        <option value="1">1박2일</option>
                        <option value="2">2박3일</option>
                        <option value="3">3박4일</option>
                        <option value="4">3박5일</option>
                        <option value="5">4박5일</option>
                        <option value="6">4박6일</option>
                        <option value="7">기타</option>
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mt-5">
                    <label className="block text-sm font-semibold text-gray-700 font-body mb-1.5">
                      문의 내용
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="원하시는 골프 코스, 호텔 등급, 특별 요청사항 등을 자유롭게 작성해 주세요."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-body focus:outline-none focus:border-dogolf-green transition-colors resize-none"
                    />
                  </div>

                  {/* Privacy */}
                  <div className="mt-5 p-4 bg-gray-50 rounded-xl">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="agreePrivacy"
                        checked={form.agreePrivacy}
                        onChange={handleChange}
                        className="mt-0.5 accent-dogolf-green"
                      />
                      <span className="text-sm text-gray-600 font-body">
                        <span className="font-semibold text-gray-800">[필수]</span> 개인정보 수집 및 이용에 동의합니다.
                        수집된 정보는 예약 문의 처리 목적으로만 사용되며, 처리 완료 후 즉시 파기됩니다.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-6 py-4 bg-dogolf-green text-white font-bold font-body text-lg rounded-xl hover:bg-dogolf-green-dark transition-colors shadow-lg"
                  >
                    문의 접수하기
                  </button>
                </form>
              )}
            </div>

            {/* Contact sidebar */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-display-ko text-xl font-bold text-gray-900 mb-4 section-title-underline">
                  연락처 안내
                </h3>
                <div className="space-y-4 mt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                      <Phone size={16} className="text-dogolf-green" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-body">전화 상담</p>
                      <a href="tel:1668-1739" className="font-number font-bold text-lg text-dogolf-green hover:underline">
                        1668-1739
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
                      <Clock size={16} className="text-dogolf-purple" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-body">운영 시간</p>
                      <p className="text-sm font-semibold text-gray-800 font-body">평일 09:00 ~ 17:30</p>
                      <p className="text-xs text-gray-400 font-body">점심 12:00~13:00 / 주말·공휴일 휴무</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                      <Mail size={16} className="text-dogolf-red" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-body">이메일</p>
                      <a href="mailto:info@dogolf.com" className="text-sm font-semibold text-gray-800 font-body hover:text-dogolf-green transition-colors">
                        info@dogolf.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-yellow-50 rounded-xl flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-body">주소</p>
                      <p className="text-sm font-semibold text-gray-800 font-body">서울특별시 광진구 자양로 126</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* KakaoTalk CTA */}
              <div className="bg-[#FEE500] rounded-2xl p-5">
                <h4 className="font-display-ko font-bold text-[#3A1D1D] text-lg mb-2">빠른 상담</h4>
                <p className="text-[#3A1D1D]/70 text-sm font-body mb-4">
                  카카오톡으로 더 빠르게 상담받으세요!
                </p>
                <a
                  href="http://pf.kakao.com/_xbHHSV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 bg-[#3A1D1D] text-[#FEE500] text-sm font-bold font-body rounded-xl text-center hover:bg-[#2A1010] transition-colors"
                >
                  💬 카카오톡 상담 시작
                </a>
              </div>

              {/* Why choose us */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h4 className="font-display-ko font-bold text-gray-900 mb-4">두골프를 선택하는 이유</h4>
                <ul className="space-y-3">
                  {[
                    { icon: '⭐', text: '10년 이상의 골프 여행 전문 노하우' },
                    { icon: '🏌️', text: '200개 이상의 제휴 골프장 보유' },
                    { icon: '🛡️', text: '안전하고 믿을 수 있는 여행 보장' },
                    { icon: '💰', text: '합리적인 가격의 프리미엄 패키지' },
                    { icon: '🗣️', text: '한국인 전담 가이드 서비스' },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-base shrink-0">{item.icon}</span>
                      <span className="text-sm text-gray-700 font-body">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <KakaoFloat />
    </div>
  );
}
