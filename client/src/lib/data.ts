// ============================================================
// DOGOLF — "Verdant Journey" Design System
// Shared Data & Types
// ============================================================

export interface Package {
  id: string;
  destination: string;
  country: string;
  countryCode: string;
  flag: string;
  title: string;
  subtitle: string;
  nights: number;
  days: number;
  holes: number;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
  badgeColor?: string;
  hotel?: string;
  hotelStars?: number;
  features: string[];
  minPeople?: number;
  isPopular?: boolean;
  isNew?: boolean;
  isSale?: boolean;
}

export interface Notice {
  id: number;
  title: string;
  category: string;
  date: string;
  views: number;
  isImportant?: boolean;
  content?: string;
}

export interface Review {
  id: number;
  author: string;
  destination: string;
  rating: number;
  content: string;
  date: string;
  image?: string;
}

export const destinations = [
  { id: 'all', name: '전체', flag: '🌍' },
  { id: 'korea', name: '대한민국', flag: '🇰🇷' },
  { id: 'thailand', name: '태국', flag: '🇹🇭' },
  { id: 'vietnam', name: '베트남', flag: '🇻🇳' },
  { id: 'philippines', name: '필리핀', flag: '🇵🇭' },
  { id: 'china', name: '중국', flag: '🇨🇳' },
  { id: 'japan', name: '일본', flag: '🇯🇵' },
];

export const heroSlides = [
  {
    id: 1,
    image: '/manus-storage/hero_main_aa4ec84e.jpg',
    title: '최고의 골프 여행을',
    subtitle: '두골프와 함께',
    description: '국내외 최고의 골프 코스에서 잊지 못할 추억을 만드세요',
    cta: '패키지 보기',
    destination: '전체 목적지',
  },
  {
    id: 2,
    image: '/manus-storage/hero_korea_853e915a.jpg',
    title: '대한민국의 아름다운',
    subtitle: '골프 명소',
    description: '전국 최고의 골프 리조트에서 품격 있는 라운딩을 즐기세요',
    cta: '국내 패키지',
    destination: '대한민국',
  },
  {
    id: 3,
    image: '/manus-storage/hero_thailand_36cfbb15.jpg',
    title: '태국 방콕의',
    subtitle: '열대 골프 천국',
    description: '세계적 수준의 골프 코스와 5성급 호텔에서의 완벽한 휴가',
    cta: '태국 패키지',
    destination: '태국',
  },
  {
    id: 4,
    image: '/manus-storage/hero_vietnam_84cd2877.jpg',
    title: '베트남 다낭',
    subtitle: '오션뷰 골프 리조트',
    description: '에메랄드 바다와 함께하는 환상적인 골프 여행',
    cta: '베트남 패키지',
    destination: '베트남',
  },
];

export const packages: Package[] = [
  // 대한민국
  {
    id: 'kr-001',
    destination: '대한민국',
    country: 'korea',
    countryCode: 'KR',
    flag: '🇰🇷',
    title: '제주 라온CC 1박2일 골프패키지',
    subtitle: '공항왕복 리무진 포함',
    nights: 1,
    days: 2,
    holes: 36,
    price: 380000,
    originalPrice: 450000,
    image: '/manus-storage/hero_korea_853e915a.jpg',
    badge: 'BEST',
    badgeColor: 'green',
    hotel: '라온골프텔',
    hotelStars: 4,
    features: ['리무진 픽업', '조식 포함', '36홀 라운딩', '카트 포함'],
    minPeople: 2,
    isPopular: true,
  },
  {
    id: 'kr-002',
    destination: '대한민국',
    country: 'korea',
    countryCode: 'KR',
    flag: '🇰🇷',
    title: '강원 알펜시아 700CC 1박2일',
    subtitle: '평창 고원 골프의 정수',
    nights: 1,
    days: 2,
    holes: 36,
    price: 230000,
    image: '/manus-storage/hero_korea_853e915a.jpg',
    badge: 'NEW',
    badgeColor: 'purple',
    hotel: '알펜시아 리조트',
    hotelStars: 5,
    features: ['36홀 라운딩', '조식 포함', '스파 이용', '카트 포함'],
    minPeople: 2,
    isNew: true,
  },
  {
    id: 'kr-003',
    destination: '대한민국',
    country: 'korea',
    countryCode: 'KR',
    flag: '🇰🇷',
    title: '부산 해운대비치CC 1박2일',
    subtitle: '바다가 보이는 명품 골프장',
    nights: 1,
    days: 2,
    holes: 36,
    price: 0,
    image: '/manus-storage/hero_korea_853e915a.jpg',
    badge: 'SALE',
    badgeColor: 'red',
    hotel: '르컬렉티브 부산기장',
    hotelStars: 5,
    features: ['36홀 라운딩', '조식 포함', '오션뷰 객실', '카트 포함'],
    minPeople: 2,
    isSale: true,
  },
  // 태국
  {
    id: 'th-001',
    destination: '태국',
    country: 'thailand',
    countryCode: 'TH',
    flag: '🇹🇭',
    title: '방콕 4색 골프 3박5일',
    subtitle: '4성급 블레스호텔 54홀',
    nights: 3,
    days: 5,
    holes: 54,
    price: 0,
    image: '/manus-storage/hero_thailand_36cfbb15.jpg',
    badge: 'BEST',
    badgeColor: 'green',
    hotel: '블레스호텔',
    hotelStars: 4,
    features: ['54홀 라운딩', '조석식 포함', '공항 픽업', '한국인 가이드'],
    minPeople: 2,
    isPopular: true,
  },
  {
    id: 'th-002',
    destination: '태국',
    country: 'thailand',
    countryCode: 'TH',
    flag: '🇹🇭',
    title: '방콕 4색 골프 3박5일 품격형',
    subtitle: '5성급 랭카스터호텔 54홀',
    nights: 3,
    days: 5,
    holes: 54,
    price: 0,
    image: '/manus-storage/hero_thailand_36cfbb15.jpg',
    badge: 'HOT',
    badgeColor: 'red',
    hotel: '랭카스터호텔',
    hotelStars: 5,
    features: ['54홀 라운딩', '조석식 포함', '공항 픽업', '한국인 가이드', '스파 이용'],
    minPeople: 2,
    isPopular: true,
  },
  {
    id: 'th-003',
    destination: '태국',
    country: 'thailand',
    countryCode: 'TH',
    flag: '🇹🇭',
    title: '파타야 3색 골프 3박5일',
    subtitle: '4성급 비스타호텔 54홀',
    nights: 3,
    days: 5,
    holes: 54,
    price: 0,
    image: '/manus-storage/hero_thailand_36cfbb15.jpg',
    hotel: '비스타호텔',
    hotelStars: 4,
    features: ['54홀 라운딩', '조식 포함', '공항 픽업', '카트 포함'],
    minPeople: 2,
  },
  // 베트남
  {
    id: 'vn-001',
    destination: '베트남',
    country: 'vietnam',
    countryCode: 'VN',
    flag: '🇻🇳',
    title: '다낭 3색 골프 3박5일',
    subtitle: '5성급 호텔 54홀 한국인 가이드',
    nights: 3,
    days: 5,
    holes: 54,
    price: 0,
    image: '/manus-storage/hero_vietnam_84cd2877.jpg',
    badge: 'BEST',
    badgeColor: 'green',
    hotel: '5성급 호텔',
    hotelStars: 5,
    features: ['54홀 라운딩', '조석식 포함', '공항 픽업', '한국인 가이드'],
    minPeople: 2,
    isPopular: true,
  },
  // 필리핀
  {
    id: 'ph-001',
    destination: '필리핀',
    country: 'philippines',
    countryCode: 'PH',
    flag: '🇵🇭',
    title: '클락 2색 골프 3박5일 실속형',
    subtitle: '72홀 + 보너스 18홀',
    nights: 3,
    days: 5,
    holes: 72,
    price: 0,
    image: '/manus-storage/hero_philippines_1d03eac3.jpg',
    badge: 'HOT',
    badgeColor: 'red',
    hotel: '코래곤 콘도빌라',
    hotelStars: 4,
    features: ['72홀+보너스18홀', '조식 포함', '공항 픽업', '카트 포함'],
    minPeople: 2,
  },
  {
    id: 'ph-002',
    destination: '필리핀',
    country: 'philippines',
    countryCode: 'PH',
    flag: '🇵🇭',
    title: '바기오 클락 2색 4박6일',
    subtitle: '108홀 + 보너스 36홀 실속형',
    nights: 4,
    days: 6,
    holes: 108,
    price: 0,
    image: '/manus-storage/hero_philippines_1d03eac3.jpg',
    hotel: '미라도호텔',
    hotelStars: 4,
    features: ['108홀+보너스36홀', '조식 포함', '공항 픽업', '카트 포함'],
    minPeople: 2,
  },
  // 중국
  {
    id: 'cn-001',
    destination: '중국',
    country: 'china',
    countryCode: 'CN',
    flag: '🇨🇳',
    title: '베이징 판산CC 3박4일 품격형',
    subtitle: '5성급 호텔 90홀',
    nights: 3,
    days: 4,
    holes: 90,
    price: 0,
    image: '/manus-storage/hero_china_e9244f94.jpg',
    badge: 'NEW',
    badgeColor: 'purple',
    hotel: '5성급 호텔',
    hotelStars: 5,
    features: ['90홀 라운딩', '조석식 포함', '공항 픽업', '한국인 가이드'],
    minPeople: 2,
    isNew: true,
  },
  // 일본
  {
    id: 'jp-001',
    destination: '일본',
    country: 'japan',
    countryCode: 'JP',
    flag: '🇯🇵',
    title: '나리타 7색 온천 2박3일',
    subtitle: '45홀 실속 패키지',
    nights: 2,
    days: 3,
    holes: 45,
    price: 0,
    image: '/manus-storage/hero_japan_866efe7e.jpg',
    badge: 'BEST',
    badgeColor: 'green',
    hotel: '온천 료칸',
    hotelStars: 4,
    features: ['45홀 라운딩', '조석식 포함', '온천 이용', '공항 픽업'],
    minPeople: 2,
    isPopular: true,
  },
  {
    id: 'jp-002',
    destination: '일본',
    country: 'japan',
    countryCode: 'JP',
    flag: '🇯🇵',
    title: '센다이 명문 골프 3박4일',
    subtitle: '2인부터 출발 가능',
    nights: 3,
    days: 4,
    holes: 54,
    price: 0,
    image: '/manus-storage/hero_japan_866efe7e.jpg',
    hotel: '센다이 호텔',
    hotelStars: 4,
    features: ['54홀 라운딩', '조식 포함', '공항 픽업', '카트 포함'],
    minPeople: 2,
  },
];

export const notices: Notice[] = [
  {
    id: 1,
    title: '[공지] 2026년 봄 시즌 특가 패키지 안내',
    category: '공지사항',
    date: '2026-04-15',
    views: 1523,
    isImportant: true,
    content: `안녕하세요, 두골프입니다.\n\n2026년 봄 시즌을 맞이하여 특가 패키지를 안내드립니다.\n\n**봄 시즌 특가 패키지 목록**\n\n- 태국 방콕 3박5일 (4월~5월) — 기존 대비 15% 할인\n- 베트남 다낭 3박4일 (4월~6월) — 얼리버드 특가 적용\n- 국내 제주 2박3일 (4월~5월) — 봄 한정 특가\n\n예약 문의는 전화(1668-1739) 또는 카카오톡 채널을 통해 주시기 바랍니다.\n\n감사합니다.`,
  },
  {
    id: 2,
    title: '[이벤트] 4월 주중 2인 특가 - 오로라CC 골프패키지',
    category: '이벤트',
    date: '2026-04-10',
    views: 892,
    isImportant: true,
    content: `두골프 4월 주중 2인 특가 이벤트를 안내드립니다.\n\n**이벤트 내용**\n\n- 대상: 2인 이상 예약 고객\n- 기간: 2026년 4월 한 달간 (주중 한정)\n- 혜택: 1인당 30,000원 할인 + 그린피 1회 무료\n\n**패키지 구성**\n\n- 오로라CC 1박2일 (조식 포함)\n- 라운딩 2회\n- 전용 셔틀 서비스\n\n선착순 20팀 한정이오니 서둘러 예약해 주세요!`,
  },
  {
    id: 3,
    title: '[안내] 태국 방콕 4색 골프 신규 패키지 출시',
    category: '신상품',
    date: '2026-04-05',
    views: 654,
    content: `두골프에서 새로운 태국 방콕 4색 골프 패키지를 출시했습니다.\n\n**패키지 특징**\n\n4개의 서로 다른 분위기의 골프장을 하나의 여행으로 경험하실 수 있습니다.\n\n1. 레이크뷰 코스 — 호수를 배경으로 한 아름다운 코스\n2. 정글 코스 — 열대 밀림 속 스릴 넘치는 라운딩\n3. 리조트 코스 — 5성급 리조트 전용 코스\n4. 챔피언십 코스 — 국제 대회 개최 코스\n\n자세한 내용은 패키지 상세 페이지에서 확인하세요.`,
  },
  {
    id: 4,
    title: '[공지] 베트남 다낭 5성급 호텔 업그레이드 안내',
    category: '공지사항',
    date: '2026-03-28',
    views: 423,
    content: `안녕하세요, 두골프입니다.\n\n베트남 다낭 패키지 숙박 호텔이 업그레이드되었음을 안내드립니다.\n\n**변경 사항**\n\n- 기존: 4성급 호텔 (다낭 시내)\n- 변경: 5성급 리조트 (해변 직접 접근)\n\n**추가 혜택**\n\n- 인피니티 풀 이용 가능\n- 조식 뷔페 포함\n- 스파 1회 무료 이용권 제공\n\n기존 예약 고객분들께는 별도로 연락드리겠습니다.`,
  },
  {
    id: 5,
    title: '[이벤트] 일본 나리타 온천 골프 얼리버드 특가',
    category: '이벤트',
    date: '2026-03-20',
    views: 789,
    content: `일본 나리타 온천 골프 얼리버드 특가 이벤트를 안내드립니다.\n\n**이벤트 기간**: 2026년 5월~6월 출발 예약 시 적용\n**할인율**: 최대 20% 조기 예약 할인\n\n**패키지 하이라이트**\n\n- 나리타 명문 골프장 2곳 라운딩\n- 전통 온천 료칸 1박 포함\n- 나리타 공항 픽업 서비스\n- 한국어 가이드 동행\n\n봄 벚꽃 시즌과 함께하는 특별한 골프 여행을 경험해 보세요!`,
  },
  {
    id: 6,
    title: '[안내] 필리핀 클락 신규 골프장 추가 안내',
    category: '신상품',
    date: '2026-03-15',
    views: 312,
    content: `두골프 필리핀 클락 패키지에 신규 골프장이 추가되었습니다.\n\n**신규 추가 골프장**\n\n- 클락 선밸리 골프클럽 (18홀, 챔피언십 코스)\n  - 필리핀 최고 수준의 코스 컨디션\n  - 산악 뷰와 열대 자연이 어우러진 경관\n\n기존 클락 패키지에 선밸리 코스를 추가 선택하실 수 있습니다.\n예약 시 담당자에게 문의해 주세요.`,
  },
  {
    id: 7,
    title: '[공지] 고객센터 운영시간 변경 안내',
    category: '공지사항',
    date: '2026-03-01',
    views: 1205,
  },
  {
    id: 8,
    title: '[이벤트] 중국 베이징 판산CC 특별 할인 이벤트',
    category: '이벤트',
    date: '2026-02-20',
    views: 567,
  },
];

export const reviews: Review[] = [
  {
    id: 1,
    author: '김**',
    destination: '태국 방콕',
    rating: 5,
    content: '두골프 덕분에 정말 완벽한 골프 여행을 즐겼습니다. 가이드 분도 친절하시고 골프장도 최고였어요!',
    date: '2026-04-10',
    image: '/manus-storage/gallery1_d11c45f2.jpg',
  },
  {
    id: 2,
    author: '이**',
    destination: '베트남 다낭',
    rating: 5,
    content: '오션뷰 골프장에서 라운딩하는 경험은 정말 특별했습니다. 5성급 호텔도 만족스러웠어요.',
    date: '2026-04-05',
    image: '/manus-storage/gallery2_0b08ffeb.jpg',
  },
  {
    id: 3,
    author: '박**',
    destination: '일본 나리타',
    rating: 5,
    content: '온천과 골프를 동시에 즐길 수 있어서 너무 좋았습니다. 다음에도 두골프로 예약할게요!',
    date: '2026-03-28',
    image: '/manus-storage/gallery3_64c53d07.jpg',
  },
];

export const stats = [
  { label: '누적 고객', value: 50000, suffix: '명+', icon: '👥' },
  { label: '제휴 골프장', value: 200, suffix: '개+', icon: '⛳' },
  { label: '운영 패키지', value: 150, suffix: '개+', icon: '✈️' },
  { label: '고객 만족도', value: 98, suffix: '%', icon: '⭐' },
];
