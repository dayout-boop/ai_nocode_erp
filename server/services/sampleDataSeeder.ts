/**
 * 파트너 온보딩 승인 시 카테고리별 샘플 데이터 자동 생성
 *
 * 카테고리:
 * - golf_tour_domestic: 국내 골프투어 (제주, 강원, 경남)
 * - golf_tour_overseas: 해외 골프투어 (태국, 베트남, 필리핀)
 * - golf_tour_mixed: 국내+해외 혼합 (전체)
 *
 * 생성 데이터:
 * - packages (패키지 기본 정보)
 * - package_prices (가격 정보)
 * - package_slots (출발 일정)
 * - package_images (이미지 - S3 URL)
 */

import { getDb } from "../db";
import { packages, packagePrices, packageSlots } from "../../drizzle/schema";

type SampleCategory = "golf_tour_domestic" | "golf_tour_overseas" | "golf_tour_mixed";

// ─── 샘플 패키지 데이터 정의 ─────────────────────────────────────────────────

const DOMESTIC_PACKAGES = [
  {
    title: "[제주] 핀크스 & 나인브릿지 2박3일",
    country: "korea",
    destination: "제주도",
    nights: 2,
    days: 3,
    price: 890000,
    description: "제주도 최고급 골프장 핀크스와 나인브릿지에서 즐기는 프리미엄 골프 여행. 제주 흑돼지 만찬과 함께하는 특별한 경험.",
    highlights: ["핀크스 골프클럽 1라운드", "나인브릿지 1라운드", "제주 특급 호텔 2박", "조식 포함"],
    isPopular: true,
    isFeatured: true,
  },
  {
    title: "[강원] 알펜시아 & 하이원 2박3일",
    country: "korea",
    destination: "강원도",
    nights: 2,
    days: 3,
    price: 750000,
    description: "강원도 산악 경관 속에서 즐기는 골프 여행. 알펜시아 리조트와 하이원에서의 특별한 라운딩.",
    highlights: ["알펜시아 1라운드", "하이원 1라운드", "리조트 2박", "조식 포함"],
    isPopular: false,
    isFeatured: false,
  },
  {
    title: "[경남] 가야 & 남해 골프 2박3일",
    country: "korea",
    destination: "경남",
    nights: 2,
    days: 3,
    price: 650000,
    description: "남해의 아름다운 바다를 바라보며 즐기는 골프 여행. 가야CC와 남해CC에서의 환상적인 라운딩.",
    highlights: ["가야CC 1라운드", "남해CC 1라운드", "남해 리조트 2박", "석식 포함"],
    isPopular: false,
    isFeatured: false,
  },
];

const OVERSEAS_PACKAGES = [
  {
    title: "[태국 방콕] 블랙마운틴 & 레이크뷰 3박4일",
    country: "thailand",
    destination: "태국 방콕",
    nights: 3,
    days: 4,
    price: 1290000,
    description: "태국 방콕 근교 최고급 골프장에서 즐기는 골프 여행. 블랙마운틴과 레이크뷰에서의 환상적인 라운딩.",
    highlights: ["블랙마운틴 1라운드", "레이크뷰 1라운드", "방콕 5성급 호텔 3박", "왕복 항공권 포함"],
    isPopular: true,
    isFeatured: true,
  },
  {
    title: "[베트남 다낭] 바나힐 & 몽고메리 3박4일",
    country: "vietnam",
    destination: "베트남 다낭",
    nights: 3,
    days: 4,
    price: 1190000,
    description: "베트남 다낭의 아름다운 해변을 배경으로 즐기는 골프 여행. 바나힐과 몽고메리에서의 특별한 경험.",
    highlights: ["바나힐 1라운드", "몽고메리 1라운드", "다낭 리조트 3박", "왕복 항공권 포함"],
    isPopular: true,
    isFeatured: false,
  },
  {
    title: "[필리핀 세부] 무제한 라운딩 4박5일",
    country: "philippines",
    destination: "필리핀 세부",
    nights: 4,
    days: 5,
    price: 1490000,
    description: "필리핀 세부에서 즐기는 무제한 골프 패키지. 매일 라운딩 가능한 최고의 골프 여행.",
    highlights: ["4일 무제한 라운딩", "세부 리조트 4박", "왕복 항공권 포함", "캐디피 포함"],
    isPopular: true,
    isFeatured: true,
  },
];

const ALL_PACKAGES = [...DOMESTIC_PACKAGES, ...OVERSEAS_PACKAGES];

// ─── 샘플 데이터 생성 함수 ────────────────────────────────────────────────────

export async function seedSampleData(
  category: SampleCategory,
  tenantId?: number
): Promise<{ success: boolean; packageCount: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, packageCount: 0, error: "DB 연결 실패" };

  // 카테고리에 따라 패키지 선택
  let selectedPackages;
  switch (category) {
    case "golf_tour_domestic":
      selectedPackages = DOMESTIC_PACKAGES;
      break;
    case "golf_tour_overseas":
      selectedPackages = OVERSEAS_PACKAGES;
      break;
    case "golf_tour_mixed":
    default:
      selectedPackages = ALL_PACKAGES;
      break;
  }

  let packageCount = 0;

  try {
    for (const pkg of selectedPackages) {
      // 1. 패키지 기본 정보 삽입
      const [insertResult] = await db.insert(packages).values({
        title: pkg.title,
        country: pkg.country,
        region: pkg.destination,
        description: pkg.description,
        highlights: pkg.highlights,
        isPopular: pkg.isPopular,
        isFeatured: pkg.isFeatured,
        sortOrder: packageCount + 1,
        status: "active",
        duration: `${pkg.nights}박${pkg.days}일`,
        roundCount: 2,
      });

      const pkgId = (insertResult as { insertId: number }).insertId;

      // 2. 가격 정보 삽입
      await db.insert(packagePrices).values({
        packageId: pkgId,
        pricePerPerson: pkg.price.toString(),
        season: "normal",
        minPeople: 2,
        maxPeople: 20,
      });

      // 3. 출발 일정 삽입 (향후 3개월 매주 금요일)
      const slots = [];
      const now = new Date();
      for (let i = 1; i <= 6; i++) {
        const departureDate = new Date(now);
        // 다음 금요일 찾기
        const daysUntilFriday = (5 - departureDate.getDay() + 7) % 7 || 7;
        departureDate.setDate(departureDate.getDate() + daysUntilFriday + (i - 1) * 7);

        const returnDate = new Date(departureDate);
        returnDate.setDate(returnDate.getDate() + pkg.days - 1);

        slots.push({
          packageId: pkgId,
          departureDate,
          returnDate,
          totalSlots: 20,
          minPax: 2,
          bookedSlots: 0,
          status: "open" as const,
          adultPrice: pkg.price.toString(),
        });
      }

      if (slots.length > 0) {
        await db.insert(packageSlots).values(slots);
      }

      packageCount++;
    }

    return { success: true, packageCount };
  } catch (err) {
    console.error("[SampleSeeder] 오류:", err);
    return { success: false, packageCount, error: String(err) };
  }
}

/**
 * 파트너 온보딩 승인 시 자동 호출
 */
export async function onPartnerApproved(
  onboardingId: number,
  category: SampleCategory,
  tenantId?: number
): Promise<void> {
  console.log(`[SampleSeeder] 파트너 온보딩 #${onboardingId} 승인 - 샘플 데이터 생성 시작 (카테고리: ${category})`);
  const result = await seedSampleData(category, tenantId);
  if (result.success) {
    console.log(`[SampleSeeder] 샘플 데이터 생성 완료: ${result.packageCount}개 패키지`);
  } else {
    console.error(`[SampleSeeder] 샘플 데이터 생성 실패:`, result.error);
  }
}
