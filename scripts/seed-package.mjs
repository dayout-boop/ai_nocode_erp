import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

import {
  packages,
  packagePrices,
  packageOptions,
  packageSlots,
} from "../drizzle/schema.ts";

// ─── 1. 패키지 기본 정보 삽입 ────────────────────────────────────
const [pkgResult] = await db.insert(packages).values({
  title: "원주 오로라CC 1박2일 ★4월-주중특가★",
  titleEn: "Wonju Aurora CC 1Night2Days - April Weekday Special",
  country: "korea",
  region: "원주",
  duration: "1박 2일",
  roundCount: 2,
  description: `💎오로라CC 골프&리조트💎4월 주중 잔여일 특가 1박2일💎2인 월~수 출발 / 4인 월~목 출발

✨자연적인 지형을 최대한 살린 원주 신규 명문 오로라 1박2일 여행
✨숙소 : 오로라리조트 본관 4인1실 or 2인1실 또는 별관 5인1실
✨킹즈락+오로라 골프택 / 오로라+킹즈락 리솜리조트 / 2색패키지 변경가능
📌2팀이상 - 서울 왕복 리무진버스 희망시 : 별도 차량 지원금 제공

📌요금안내
🔵확정요금 : 26년 04월20일부터 ~ 04월29일까지 주중한정

📌기준사항
🔵4월 주중(월~목 출발)- 4인 특가 포함내역 :
✨그린피36홀+ 숙박1박+클럽식사1회(조식)+프로모션
✨프로모션 : 1일차 9홀후 그늘집식사+프로샵20%할인권
✨지정시간 : 1일차 2부 13:30~ / 2일차 1부 ~07:30
✨월 출발 : 312,000원/인 , 화~수 출발 : 335,000원/인 , 목 출발 : 343,000원/인

🔵4월 주중(월~수 출발)- 2인 특가 포함내역 :
✨그린피36홀+ 숙박1박+클럽식사1회(조식)
✨지정시간 : 1일차 2부 13:30~ / 2일차 1부 ~07:30
✨월 출발 : 365,000원/인 , 화~수 출발 : 375,000원/인

⛳오로라CC
27 Holes / Par 108
오로라골프앤리조트는 정규 18홀 규모로 아름다운 스카이라인과 대자연의 풍광을 마주하며 펼쳐진 26만평(86만㎡)의 부지에 조성되었으며, 자연적인 지형을 최대한 살린 총 6,486m(7,093yd)의 코스는 대자연과 아름다운 조화를 이루고 있습니다. 레이크 코스는 3,229m(Par 36), 마운틴 코스는 3,257m(Par 36)의 차별화된 골프의 묘미를 즐길 수 있습니다.

🏨오로라 골프리조트
📌오로라 리조트 - 2026년 본관 RE-OPEN
4인실기준 - 2룸 (트윈×2개)+거실1+화장실2실
2인실기준 - 1룸 (트윈×2개)+거실1+화장실1실
📌오로라 리조트 - 2025년 OPEN 별관
5인실기준 - 3룸 (복층 트윈×2개+싱글룸 1개)+거실1+화장실2실

[필수 확인]
📌인근 골프장과 2색~3색 골프 진행 가능하며, 별도 문의 부탁드립니다.
📌일정 순서 및 코스 변경시 추가 요금이 발생 할 수 있습니다.
📌공휴일 포함 및 월말 일정시 요금이 변동 될 수 있습니다.

약관/환불규정
▶ 예약확정 후 취소/변경시 서비스차지 인당 1만원 수수료 발생
▶ 출발일 14~8일전 취소: 상품가 총 경비의 20% 배상
▶ 출발일 7~5일전 취소: 상품가 총 경비의 50% 배상
▶ 출발일 4일~당일 취소: 전액 환불 불가
▶ 팀 4인기준 예약상품으로 3인 내장시 4인요금 적용`,
  highlights: JSON.stringify([
    "오로라CC 1박2일 골프여행 + 오로라 리조트 4인1실 또는 2인1실",
    "원주 신생 오로라CC 골프텔 패키지",
    "4월 주중 특가팩: 4인 월~목 출발 / 2인 월~수 출발",
    "그린피 36홀 포함 (18홀×2회)",
    "클럽조식 1회 포함",
    "4인팩: 그늘집 식사 + 프로샵 20% 할인권 제공",
  ]),
  includes: JSON.stringify([
    "그린피 36홀 (18홀×2회, 1일차 13:30이후 / 2일차 07:30이전)",
    "오로라 리조트 숙박 1박 (4인팩: 별관 5인실 / 2인팩: 본관 2인실)",
    "클럽조식 1회",
    "4인팩: 그늘집 식사 1회 (1일차 9홀 이후)",
    "4인팩: 프로샵 20% 할인권",
  ]),
  excludes: JSON.stringify([
    "이용교통: 개별출발",
    "식사: 중식, 석식",
    "캐디피: 150,000원 (18홀/팀당)",
    "카트비: 100,000원 (18홀/팀당)",
    "기타 개인비용",
  ]),
  imageUrl: "/manus-storage/hero_korea_853e915a.jpg",
  imageUrls: JSON.stringify([
    "/manus-storage/hero_korea_853e915a.jpg",
  ]),
  status: "active",
  isFeatured: true,
  isPopular: true,
  sortOrder: 1,
});

const packageId = Number(pkgResult.insertId);
console.log("✅ 패키지 생성 완료 ID:", packageId);

// ─── 2. 인원수별 요금 삽입 ────────────────────────────────────────
await db.insert(packagePrices).values([
  {
    packageId,
    season: "normal",
    minPeople: 4,
    maxPeople: 4,
    pricePerPerson: "312000",
    singleSupplement: "0",
    validFrom: new Date("2026-04-20"),
    validTo: new Date("2026-04-21"),
  },
  {
    packageId,
    season: "normal",
    minPeople: 4,
    maxPeople: 4,
    pricePerPerson: "335000",
    singleSupplement: "0",
    validFrom: new Date("2026-04-22"),
    validTo: new Date("2026-04-23"),
  },
  {
    packageId,
    season: "peak",
    minPeople: 4,
    maxPeople: 4,
    pricePerPerson: "343000",
    singleSupplement: "0",
    validFrom: new Date("2026-04-23"),
    validTo: new Date("2026-04-24"),
  },
  {
    packageId,
    season: "normal",
    minPeople: 2,
    maxPeople: 2,
    pricePerPerson: "365000",
    singleSupplement: "0",
    validFrom: new Date("2026-04-20"),
    validTo: new Date("2026-04-21"),
  },
  {
    packageId,
    season: "normal",
    minPeople: 2,
    maxPeople: 2,
    pricePerPerson: "375000",
    singleSupplement: "0",
    validFrom: new Date("2026-04-22"),
    validTo: new Date("2026-04-23"),
  },
]);
console.log("✅ 인원수별 요금 5개 생성 완료");

// ─── 3. 옵션 삽입 (캐디피, 카트비) ──────────────────────────────────
await db.insert(packageOptions).values([
  {
    packageId,
    optionType: "caddie",
    name: "캐디피",
    description: "18홀 팀당 캐디피 (필수 불포함)",
    price: "150000",
    isIncluded: false,
    isRequired: true,
  },
  {
    packageId,
    optionType: "cart",
    name: "카트비",
    description: "18홀 팀당 카트비 (필수 불포함)",
    price: "100000",
    isIncluded: false,
    isRequired: true,
  },
  {
    packageId,
    optionType: "meal",
    name: "그늘집 식사 (2인팩 추가)",
    description: "2인팩 이용시 그늘집 식사 별도 추가 가능",
    price: "0",
    isIncluded: false,
    isRequired: false,
  },
  {
    packageId,
    optionType: "vehicle",
    name: "리무진버스 (2팀 이상)",
    description: "서울 왕복 리무진버스 (2팀 이상 신청시 차량 지원금 제공)",
    price: "0",
    isIncluded: false,
    isRequired: false,
  },
]);
console.log("✅ 옵션 4개 생성 완료");

// ─── 4. 출발 가능 슬롯 삽입 ──────────────────────────────────────────
const slotData = [
  { dep: "2026-04-22", ret: "2026-04-23", label: "4인팩 (수 출발)", price: "335000" },
  { dep: "2026-04-23", ret: "2026-04-24", label: "4인팩 (목 출발)", price: "343000" },
  { dep: "2026-04-27", ret: "2026-04-28", label: "4인팩 (월 출발)", price: "312000" },
  { dep: "2026-04-28", ret: "2026-04-29", label: "4인팩 (화 출발)", price: "335000" },
  { dep: "2026-04-29", ret: "2026-04-30", label: "4인팩 (수 출발)", price: "335000" },
  { dep: "2026-04-27", ret: "2026-04-28", label: "2인팩 (월 출발)", price: "365000" },
  { dep: "2026-04-28", ret: "2026-04-29", label: "2인팩 (화 출발)", price: "375000" },
  { dep: "2026-04-29", ret: "2026-04-30", label: "2인팩 (수 출발)", price: "375000" },
];

for (const s of slotData) {
  await db.insert(packageSlots).values({
    packageId,
    departureDate: new Date(s.dep),
    returnDate: new Date(s.ret),
    totalSlots: 100,
    bookedSlots: 0,
    status: "open",
    priceOverride: s.price,
  });
}
console.log("✅ 출발 슬롯 8개 생성 완료");

console.log("\n🎉 상품 등록 완료!");
console.log(`   패키지 ID: ${packageId}`);
console.log(`   상품명: 원주 오로라CC 1박2일 ★4월-주중특가★`);
console.log(`   ERP 확인: /erp/packages/${packageId}`);

await connection.end();
