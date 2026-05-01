/**
 * seed-managed-projects.mjs
 * 두골프 ERP 기본 프로젝트 시드 데이터 삽입
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL 환경변수가 없습니다.");
  process.exit(1);
}

async function seed() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // 이미 데이터가 있는지 확인
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM managed_projects");
    const count = rows[0].cnt;
    
    if (count > 0) {
      console.log(`이미 ${count}개의 프로젝트가 등록되어 있습니다. 시드를 건너뜁니다.`);
      return;
    }
    
    const dogolfProject = {
      name: "두골프 ERP & 홈페이지",
      slug: "dogolf-erp",
      description: "두골프(dayoutgolf.com) 골프투어 여행사 ERP 시스템 및 홈페이지. React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL(Drizzle ORM) 스택.",
      manusProjectId: "GVziMvdQmQTJAbrZbBGmnr",
      manusWebdevPath: "/home/ubuntu/dogolf",
      manusDeployUrl: "https://dogolf-tour-dkz3fsmp.manus.space",
      techStack: "React 19 + Tailwind 4 + Express 4 + tRPC 11 + MySQL (Drizzle ORM) + TypeScript",
      keyFiles: `- drizzle/schema.ts: DB 스키마 (테이블 정의, 마이그레이션)
- server/routers.ts: 메인 tRPC 라우터 (모든 API 프로시저 등록)
- server/routers/: 기능별 라우터 파일 (reservations, affiliates, settings 등)
- server/services/manusPipe.ts: Manus API 태스크 생성 서비스
- server/_core/gemini.ts: Gemini AI 연동
- server/_core/orchestrator.ts: AI 오케스트레이터
- client/src/App.tsx: 프론트엔드 라우트 정의
- client/src/components/ERPLayout.tsx: ERP 레이아웃 및 사이드바 메뉴
- client/src/pages/erp/: ERP 관리자 페이지들
- client/src/pages/: 홈페이지 퍼블릭 페이지들
- client/src/components/: 재사용 컴포넌트 (Header, Footer, PackageCard 등)
- client/src/index.css: 전역 스타일 (dogolf 색상 토큰)`,
      devInstructions: `## 개발 절차

### 1. DB 스키마 변경 시
1. drizzle/schema.ts 수정
2. pnpm db:push 실행 (drizzle-kit generate & migrate)
3. server/db.ts에 쿼리 헬퍼 추가 (필요 시)

### 2. API 추가 시
1. server/routers/<feature>.ts 파일 생성 또는 수정
2. server/routers.ts에 import 및 appRouter에 등록
3. 클라이언트에서 trpc.<feature>.useQuery/useMutation 사용

### 3. UI 페이지 추가 시
1. client/src/pages/erp/<PageName>.tsx 생성
2. client/src/components/ERPLayout.tsx에 import 및 Route 추가
3. 사이드바 navItems에 메뉴 항목 추가

### 4. TypeScript 오류 확인
- npx tsc --noEmit --skipLibCheck 2>&1 | head -20
- 오류 0개 확인 후 체크포인트 저장

### 5. 체크포인트 저장
- webdev_save_checkpoint 실행
- Publish 버튼으로 배포

## 주의사항
- getDb() 패턴: const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
- adminProcedure: 관리자 전용 API에 사용
- protectedProcedure: 로그인 필요 API에 사용
- publicProcedure: 공개 API에 사용
- Footer copyright: 하드코딩 '© 2026 두골프(DOGOLF). All Rights Reserved.' 유지 (변경 금지)
- dogolf-green-dark 색상: oklch(0.14 0.07 155) (변경 금지)`,
      customContext: `두골프(DOGOLF)는 대한민국, 태국, 베트남, 필리핀, 중국, 일본 등 국내외 골프여행 패키지를 제공하는 골프투어 여행사입니다.

## 비즈니스 규칙
- 골프 패키지: 상품명, 국가, 일정, 가격, 라운드 수, 포함/불포함 사항
- 예약 상태: pending → confirmed → cancelled
- 결제 상태: unpaid → paid → refunded
- 정산: 협력사(골프장, 숙박, 항공) 비용 관리

## 코딩 컨벤션
- TypeScript strict mode
- tRPC v11 프로시저 패턴
- Drizzle ORM (MySQL)
- Tailwind 4 CSS 변수 (OKLCH 색상 포맷)
- shadcn/ui 컴포넌트 우선 사용
- 한국어 UI 텍스트

## 배포 환경
- 개발: localhost:3000 (Vite + Express)
- 배포: dogolf-tour-dkz3fsmp.manus.space / dayoutgolf.com
- DB: TiDB (MySQL 호환)`,
      isActive: true,
      isDefault: true,
    };
    
    await conn.execute(
      `INSERT INTO managed_projects 
       (name, slug, description, manusProjectId, manusWebdevPath, manusDeployUrl, techStack, keyFiles, devInstructions, customContext, isActive, isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        dogolfProject.name,
        dogolfProject.slug,
        dogolfProject.description,
        dogolfProject.manusProjectId,
        dogolfProject.manusWebdevPath,
        dogolfProject.manusDeployUrl,
        dogolfProject.techStack,
        dogolfProject.keyFiles,
        dogolfProject.devInstructions,
        dogolfProject.customContext,
        dogolfProject.isActive ? 1 : 0,
        dogolfProject.isDefault ? 1 : 0,
      ]
    );
    
    console.log("✅ 두골프 ERP 기본 프로젝트 시드 완료!");
    
  } finally {
    await conn.end();
  }
}

seed().catch(console.error);
