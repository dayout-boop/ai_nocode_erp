import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

// ============================================================
// USERS - 관리자 및 회원 테이블
// ============================================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // 자립 인증 (마누스 비의존): 이메일/비밀번호 + 구글 OAuth
  passwordHash: varchar("passwordHash", { length: 255 }),
  googleId: varchar("googleId", { length: 200 }),
  authProvider: mysqlEnum("authProvider", ["manus", "local", "google"]).default("manus").notNull(),
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// PACKAGES - 골프 패키지 상품
// ============================================================
export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  titleEn: varchar("titleEn", { length: 200 }),
  country: varchar("country", { length: 50 }).notNull(),
  region: varchar("region", { length: 100 }),
  duration: varchar("duration", { length: 50 }),
  roundCount: int("roundCount").default(2),
  description: text("description"),
  highlights: json("highlights"),
  includes: json("includes"),
  excludes: json("excludes"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  imageUrls: json("imageUrls"),
  status: mysqlEnum("status", ["draft", "active", "inactive", "sold_out"]).default("draft").notNull(),
  isFeatured: boolean("isFeatured").default(false),
  isPopular: boolean("isPopular").default(false),
  isSpecialDeal: boolean("isSpecialDeal").default(false),
  isTrending: boolean("isTrending").default(false),
  courseType: mysqlEnum("courseType", ["resort", "oceanfront", "mountain", "tropical", "parkland", "links", "desert", "tournament"]).default("resort"),
  badgeType: mysqlEnum("badgeType", ["none", "best", "exclusive", "new", "limited", "hot"]).default("none"),
  departureCities: json("departureCities"),
  includesAirfare: boolean("includesAirfare").default(false),
  includesGreenFee: boolean("includesGreenFee").default(true),
  includesHotel: boolean("includesHotel").default(false),
  sortOrder: int("sortOrder").default(0),
  viewCount: int("viewCount").default(0),
  // 기본 일정 템플릿 (예약 생성 시 자동 적용)
  defaultItinerary: json("defaultItinerary"),
  // 여행 일정 (탭 표시용: [{day, title, content, meals}])
  itinerary: json("itinerary"),
  // 취소/환불 정책 (텍스트)
  cancellationPolicy: text("cancellationPolicy"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  /** AI 자동생성 출처 fileAnalysis.id (AI 생성 상품인 경우) */
  aiGeneratedFrom: int("aiGeneratedFrom"),
  /** AI 생성 상품 승인 상태 (파트너 내부 완결) */
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

// ============================================================
// PACKAGE_PRICES - 인원수별/시즌별 요금
// ============================================================
export const packagePrices = mysqlTable("package_prices", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  season: mysqlEnum("season", ["peak", "normal", "off"]).default("normal").notNull(),
  minPeople: int("minPeople").default(1),
  maxPeople: int("maxPeople").default(99),
  pricePerPerson: decimal("pricePerPerson", { precision: 12, scale: 0 }).notNull(),
  singleSupplement: decimal("singleSupplement", { precision: 12, scale: 0 }).default("0"),
  validFrom: timestamp("validFrom"),
  validTo: timestamp("validTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackagePrice = typeof packagePrices.$inferSelect;

// ============================================================
// PACKAGE_OPTIONS - 카트/캐디피, 숙박, 차량 옵션
// ============================================================
export const packageOptions = mysqlTable("package_options", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  optionType: mysqlEnum("optionType", ["cart", "caddie", "accommodation", "vehicle", "meal", "insurance", "other"]).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 0 }).default("0"),
  isIncluded: boolean("isIncluded").default(false),
  isRequired: boolean("isRequired").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackageOption = typeof packageOptions.$inferSelect;

// ============================================================
// PACKAGE_SLOTS - 날짜별 재고(슬롯) 관리
// ============================================================
export const packageSlots = mysqlTable("package_slots", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  departureDate: timestamp("departureDate").notNull(),
  returnDate: timestamp("returnDate"),
  totalSlots: int("totalSlots").default(20),
  minPax: int("minPax").default(3),
  bookedSlots: int("bookedSlots").default(0),
  status: mysqlEnum("status", ["open", "closed", "sold_out"]).default("open"),
  priceOverride: decimal("priceOverride", { precision: 12, scale: 0 }),
  // 성인 가격 (3종)
  adultPrice: decimal("adultPrice", { precision: 12, scale: 0 }),           // 판매가 (고객 결제가)
  adultDepositPrice: decimal("adultDepositPrice", { precision: 12, scale: 0 }), // 입금가 (원가/공급가)
  adultAffiliatePrice: decimal("adultAffiliatePrice", { precision: 12, scale: 0 }), // 제휴가 (파트너 공급가)
  // 소인 가격 (3종)
  childPrice: decimal("childPrice", { precision: 12, scale: 0 }),            // 판매가
  childDepositPrice: decimal("childDepositPrice", { precision: 12, scale: 0 }), // 입금가
  childAffiliatePrice: decimal("childAffiliatePrice", { precision: 12, scale: 0 }), // 제휴가
  // 유아 가격 (3종)
  infantPrice: decimal("infantPrice", { precision: 12, scale: 0 }),          // 판매가
  infantDepositPrice: decimal("infantDepositPrice", { precision: 12, scale: 0 }), // 입금가
  infantAffiliatePrice: decimal("infantAffiliatePrice", { precision: 12, scale: 0 }), // 제휴가
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PackageSlot = typeof packageSlots.$inferSelect;

// ============================================================
// BOOKINGS - 예약/주문
// ============================================================
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  bookingNumber: varchar("bookingNumber", { length: 20 }).notNull().unique(),
  packageId: int("packageId").notNull(),
  slotId: int("slotId"),
  userId: int("userId"),
  leaderName: varchar("leaderName", { length: 100 }).notNull(),
  leaderPhone: varchar("leaderPhone", { length: 20 }).notNull(),
  leaderEmail: varchar("leaderEmail", { length: 320 }),
  adultCount: int("adultCount").default(1),
  childCount: int("childCount").default(0),
  totalPeople: int("totalPeople").default(1),
  departureDate: timestamp("departureDate"),
  returnDate: timestamp("returnDate"),
  selectedOptions: json("selectedOptions"),
  roundCount: int("roundCount").default(2),
  cartIncluded: boolean("cartIncluded").default(false),
  caddieIncluded: boolean("caddieIncluded").default(false),
  basePrice: decimal("basePrice", { precision: 12, scale: 0 }).default("0"),
  optionPrice: decimal("optionPrice", { precision: 12, scale: 0 }).default("0"),
  discountAmount: decimal("discountAmount", { precision: 12, scale: 0 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 0 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 0 }).default("0"),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"]).default("pending").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid", "refunded"]).default("unpaid"),
  customerMemo: text("customerMemo"),
  adminMemo: text("adminMemo"),
  cancelReason: text("cancelReason"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ============================================================
// TRAVELERS - 여행자 정보
// ============================================================
export const travelers = mysqlTable("travelers", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  birthDate: varchar("birthDate", { length: 10 }),
  gender: mysqlEnum("gender", ["male", "female"]),
  passportNumber: varchar("passportNumber", { length: 30 }),
  passportExpiry: varchar("passportExpiry", { length: 10 }),
  phone: varchar("phone", { length: 20 }),
  isLeader: boolean("isLeader").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Traveler = typeof travelers.$inferSelect;

// ============================================================
// SETTLEMENTS - 정산 관리
// ============================================================
export const settlements = mysqlTable("settlements", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  supplierName: varchar("supplierName", { length: 100 }).notNull(),
  supplierType: mysqlEnum("supplierType", ["golf_course", "hotel", "transport", "other"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 0 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("KRW"),
  dueDate: timestamp("dueDate"),
  paidDate: timestamp("paidDate"),
  status: mysqlEnum("status", ["pending", "paid", "overdue"]).default("pending"),
  memo: text("memo"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Settlement = typeof settlements.$inferSelect;

// ============================================================
// INQUIRIES - 예약 문의 / 1:1 상담
// ============================================================
export const inquiries = mysqlTable("inquiries", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  packageId: int("packageId"),
  packageName: varchar("packageName", { length: 200 }),
  travelDate: varchar("travelDate", { length: 50 }),
  peopleCount: int("peopleCount"),
  message: text("message"),
  status: mysqlEnum("status", ["new", "in_progress", "replied", "closed"]).default("new"),
  adminReply: text("adminReply"),
  repliedAt: timestamp("repliedAt"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = typeof inquiries.$inferInsert;

// ============================================================
// NOTICES - 공지사항 / 이벤트
// ============================================================
export const notices = mysqlTable("notices", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["notice", "event", "new_product", "tip"]).default("notice"),
  title: varchar("title", { length: 300 }).notNull(),
  content: text("content"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  isImportant: boolean("isImportant").default(false),
  isPublished: boolean("isPublished").default(true),
  viewCount: int("viewCount").default(0),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = typeof notices.$inferInsert;

// ============================================================
// BANNERS - 메인 배너 관리
// ============================================================
export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 300 }),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  linkUrl: varchar("linkUrl", { length: 500 }),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;
export type InsertBanner = typeof banners.$inferInsert;

// ============================================================
// CUSTOMER_MEMOS - 고객 상담 메모 (CRM)
// ============================================================
export const customerMemos = mysqlTable("customer_memos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  customerName: varchar("customerName", { length: 100 }),
  customerPhone: varchar("customerPhone", { length: 20 }),
  content: text("content").notNull(),
  memoType: mysqlEnum("memoType", ["call", "kakao", "email", "visit", "other"]).default("call"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomerMemo = typeof customerMemos.$inferSelect;

// ============================================================
// PACKAGE_IMAGES - 상품 이미지 (다중 이미지 관리)
// ============================================================
export const packageImages = mysqlTable("package_images", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  imageUrl: varchar("imageUrl", { length: 1000 }).notNull(),
  imageKey: varchar("imageKey", { length: 500 }).notNull(),
  altText: varchar("altText", { length: 200 }),
  sortOrder: int("sortOrder").default(0),
  isCover: boolean("isCover").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PackageImage = typeof packageImages.$inferSelect;
export type InsertPackageImage = typeof packageImages.$inferInsert;

// ============================================================
// AI_INTERACTION_LOGS - Gemini AI 대화 로그
// ============================================================
export const aiInteractionLogs = mysqlTable("ai_interaction_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userName: varchar("userName", { length: 100 }),
  query: text("query").notNull(),
  response: text("response").notNull(),
  modelName: varchar("modelName", { length: 50 }).default("gemini-2.5-flash"),
  /** 실제 응답에 사용된 리전 (예: us-central1, europe-west4, global, none) */
  regionUsed: varchar("regionUsed", { length: 50 }).default("global"),
  /** 사용된 백엔드 (vertex | studio) */
  backend: varchar("backend", { length: 20 }).default("studio"),
  /** 성공 여부 */
  isSuccess: boolean("isSuccess").default(true),
  /** 에러 유형 (overload | auth | network | unknown) */
  errorType: varchar("errorType", { length: 50 }),
  /** 응답 시간 (ms) */
  responseTimeMs: int("responseTimeMs"),
  /** 태스크 유형 (chat | packageDesc | marketingCopy | inquiryReply | devAnalysis | releaseNote | featureDoc) */
  taskType: varchar("taskType", { length: 50 }).default("chat"),
  /** 캐시 히트 여부 */
  cacheHit: boolean("cacheHit").default(false),
  /** 사용된 프롬프트 버전 ID */
  promptVersionId: int("promptVersionId"),
  /** 사용자 피드백 (thumbs_up | thumbs_down) */
  feedback: varchar("feedback", { length: 20 }),
  /** 피드백 메모 */
  feedbackNote: text("feedbackNote"),
  /** 입력 토큰 수 (비용 추적) */
  inputTokens: int("inputTokens"),
  /** 출력 토큰 수 */
  outputTokens: int("outputTokens"),
  /** 파트너 테넌트 ID (파트너 크레딧 측정용) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiInteractionLog = typeof aiInteractionLogs.$inferSelect;
export type InsertAiInteractionLog = typeof aiInteractionLogs.$inferInsert;

// ============================================================
// PROMPT_VERSIONS - 프롬프트 버전 관리 (A/B 테스트)
// ============================================================
export const promptVersions = mysqlTable("prompt_versions", {
  id: int("id").autoincrement().primaryKey(),
  /** 프롬프트 식별자 (예: package_desc_v1, inquiry_reply_v2) */
  name: varchar("name", { length: 100 }).notNull(),
  /** 태스크 유형 */
  taskType: varchar("taskType", { length: 50 }).notNull(),
  /** 버전 번호 */
  version: int("version").default(1).notNull(),
  /** 시스템 프롬프트 내용 */
  systemPrompt: text("systemPrompt").notNull(),
  /** 유저 프롬프트 템플릿 ({{변수}} 형식) */
  userPromptTemplate: text("userPromptTemplate").notNull(),
  /** 활성화 여부 */
  isActive: boolean("isActive").default(false).notNull(),
  /** A/B 테스트 그룹 (a | b) */
  abGroup: varchar("abGroup", { length: 5 }),
  /** 성능 메트릭 (thumbs_up 비율 등, JSON) */
  metrics: json("metrics"),
  /** 작성자 */
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PromptVersion = typeof promptVersions.$inferSelect;
export type InsertPromptVersion = typeof promptVersions.$inferInsert;

// ============================================================
// MODEL_ROUTING_RULES - 복잡도별 AI 모델 라우팅 규칙
// ============================================================
export const modelRoutingRules = mysqlTable("model_routing_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** 복잡도 레벨: high=고복잡도, medium=중간, low=단순 */
  complexity: mysqlEnum("complexity", ["high", "medium", "low"]).notNull(),
  /** OpenRouter 모델 ID (예: google/gemini-2.5-pro-preview-05-06) */
  modelId: varchar("modelId", { length: 200 }).notNull(),
  /** 모델 표시명 */
  modelName: varchar("modelName", { length: 200 }).notNull(),
  /** 입력 토큰 단가 (USD per 1M tokens) */
  inputPricePerMillion: decimal("inputPricePerMillion", { precision: 10, scale: 4 }).default("0"),
  /** 출력 토큰 단가 (USD per 1M tokens) */
  outputPricePerMillion: decimal("outputPricePerMillion", { precision: 10, scale: 4 }).default("0"),
  /** 사용 목적 설명 */
  description: text("description"),
  /** 활성화 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 우선순위 (낮을수록 우선) */
  priority: int("priority").default(10).notNull(),
  updatedBy: varchar("updatedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type ModelRoutingRule = typeof modelRoutingRules.$inferSelect;
export type InsertModelRoutingRule = typeof modelRoutingRules.$inferInsert;

// ============================================================
// DEV_REQUESTS - 두골프 개발AI 요청 관리
// ============================================================
export const devRequests = mysqlTable("dev_requests", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  /** pending | in_progress | completed | rejected */
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  /** high | medium | low */
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  /** Slack 메시지 타임스탬프 (ts) */
  slackMessageTs: varchar("slackMessageTs", { length: 50 }),
  /** Slack 채널 ID */
  slackChannelId: varchar("slackChannelId", { length: 50 }),
  /** 결과물 설명 */
  result: text("result"),
  /** 관련 기능 ID */
  featureId: int("featureId"),
  createdBy: int("createdBy"),
  createdByName: varchar("createdByName", { length: 100 }),
  // ── AI 자동 분석 필드 ──────────────────────────────────────────
  /** AI 분류: BUG | FEATURE | IMPROVEMENT | REFACTOR */
  aiCategory: varchar("aiCategory", { length: 30 }),
  /** AI 제안 우선순위: high | medium | low | critical */
  aiSuggestedPriority: varchar("aiSuggestedPriority", { length: 20 }),
  /** AI 예상 개발 시간 (시간 단위) */
  estimatedHours: int("estimatedHours"),
  /** AI 제안 담당 팀 */
  suggestedTeam: varchar("suggestedTeam", { length: 100 }),
  /** AI 분석 요약 */
  aiAnalysis: text("aiAnalysis"),
  /** AI 분석 완료 여부 */
  aiAnalyzed: boolean("aiAnalyzed").default(false).notNull(),
  // ── AI 어시스턴트 통합 필드 ──────────────────────────────────────
  /** 대상 모듈 (예: Packages, Home, PackageDetail) */
  module: varchar("module", { length: 100 }),
  /** Manus API task ID (전송 후 기록) */
  manusTaskId: varchar("manusTaskId", { length: 100 }),
  /** Manus 태스크 URL (task.create 응답의 task_url) */
  manusTaskUrl: varchar("manusTaskUrl", { length: 500 }),
  /** Manus 프로젝트 ID (task.create 시 project_id) */
  manusProjectId: varchar("manusProjectId", { length: 100 }),
  /** 라우팅 방식: new_task=신규 생성 | send_message=기존 스레드 추가 */
  manusRoutingType: mysqlEnum("manusRoutingType", ["new_task", "send_message"]),
  /** 라우팅 근거 메모 */
  manusRoutingReason: varchar("manusRoutingReason", { length: 255 }),
  /** 요청 출처 */
  source: mysqlEnum("source", ["manual", "auto_cycle", "master_ai"]).default("manual"),
  // ── 정확도 평가 필드 ──────────────────────────────────────────────────────
  /** AI 응답 정확도 점수 (1-5, 사용자 평가) */
  accuracyScore: int("accuracyScore"),
  /** 사용자 피드백 텍스트 */
  userFeedback: text("userFeedback"),
  /** 사용된 AI 엔진 (gemini | gpt | claude | llama | manus) */
  engineType: varchar("engineType", { length: 50 }),
  /** 피드백 자동 분류 카테고리 (LLM 분류 결과) */
  feedbackCategory: mysqlEnum("feedbackCategory", ["bug", "suggestion", "other"]),
  /** 정확도 평가 완료 여부 */
  accuracyEvaluated: boolean("accuracyEvaluated").default(false).notNull(),
  /** 결과물 자동 수집 시 연결된 Manus 체크포인트 버전 ID */
  resultCheckpointId: varchar("resultCheckpointId", { length: 100 }),
  /** 사용자(마스터)가 입력한 원문 발추 — LLM 재가공 전 의도 보존용 */
  originalRequest: text("originalRequest"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DevRequest = typeof devRequests.$inferSelect;
export type InsertDevRequest = typeof devRequests.$inferInsert;

// ============================================================
// DEV_FEATURES - 두골프 개발AI 기능 목록
// ============================================================
export const devFeatures = mysqlTable("dev_features", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  /** 현재 버전 */
  currentVersion: varchar("currentVersion", { length: 20 }).default("1.0.0"),
  /** active | deprecated | experimental */
  status: varchar("status", { length: 30 }).default("active").notNull(),
  /** 카테고리 (ai | booking | package | crm | cms | finance | system) */
  category: varchar("category", { length: 50 }).default("system"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DevFeature = typeof devFeatures.$inferSelect;
export type InsertDevFeature = typeof devFeatures.$inferInsert;

// ============================================================
// DEV_VERSIONS - 두골프 개발AI 기능별 버전 이력 (롤백 관리)
// ============================================================
export const devVersions = mysqlTable("dev_versions", {
  id: int("id").autoincrement().primaryKey(),
  featureId: int("featureId").notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  description: text("description").notNull(),
  /** 변경 유형 (feature | bugfix | refactor | hotfix) */
  changeType: varchar("changeType", { length: 30 }).default("feature"),
  /** 체크포인트 ID (롤백 시 사용) */
  checkpointId: varchar("checkpointId", { length: 100 }),
  /** 롤백 가능 여부 */
  isRollbackable: boolean("isRollbackable").default(true),
  createdBy: int("createdBy"),
  createdByName: varchar("createdByName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DevVersion = typeof devVersions.$inferSelect;
export type InsertDevVersion = typeof devVersions.$inferInsert;

// ────────────────────────────────────────────────────────────────────────────
// AI 오케스트레이터 비용 로그
// ────────────────────────────────────────────────────────────────────────────

export const aiCostLogs = mysqlTable("ai_cost_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 사용된 모델 ID (예: openai/gpt-4o-mini) */
  model: varchar("model", { length: 100 }).notNull(),
  /** 모델 표시명 */
  modelName: varchar("modelName", { length: 100 }),
  /** 작업 복잡도 */
  complexity: varchar("complexity", { length: 20 }).notNull(),
  /** 작업 유형 */
  taskType: varchar("taskType", { length: 50 }).notNull(),
  /** 입력 토큰 수 */
  inputTokens: int("inputTokens").default(0),
  /** 출력 토큰 수 */
  outputTokens: int("outputTokens").default(0),
  /** 예상 비용 (USD) */
  costUsd: decimal("costUsd", { precision: 12, scale: 8 }).default("0"),
  /** 캐시 절약 비용 (USD) */
  cacheSavedUsd: decimal("cacheSavedUsd", { precision: 12, scale: 8 }).default("0"),
  /** 캐시 히트 여부 */
  cacheHit: boolean("cacheHit").default(false),
  /** 응답 시간 (ms) */
  durationMs: int("durationMs").default(0),
  /** 성공 여부 */
  isSuccess: boolean("isSuccess").default(true),
  /** 에러 메시지 (실패 시) */
  errorMessage: text("errorMessage"),
  /** 요청한 사용자 ID */
  userId: int("userId"),
  /** 요청 프롬프트 앞 200자 (디버깅용) */
  promptPreview: varchar("promptPreview", { length: 200 }),
  /** 어시스턴트 채널 구분 (master/golftalk/manager) */
  assistant: varchar("assistant", { length: 20 }).default("master"),
  /** 분양 테넌트 ID (두골프 자체 사용 시 null) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiCostLog = typeof aiCostLogs.$inferSelect;
export type InsertAiCostLog = typeof aiCostLogs.$inferInsert;

// ─── Stripe 결제 ───────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  amount: decimal("amount", { precision: 12, scale: 0 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("krw").notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded", "cancelled"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ─── 카카오 알림톡 발송 이력 ────────────────────────────────────
export const kakaoNotifications = mysqlTable("kakao_notifications", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId"),
  recipientPhone: varchar("recipientPhone", { length: 20 }).notNull(),
  templateCode: varchar("templateCode", { length: 50 }).notNull(),
  messageType: mysqlEnum("messageType", ["booking_confirmed", "booking_cancelled", "departure_reminder", "custom"]).notNull(),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KakaoNotification = typeof kakaoNotifications.$inferSelect;

// ─── 자동화 파이프라인 실행 이력 ────────────────────────────────
export const automationLogs = mysqlTable("automation_logs", {
  id: int("id").autoincrement().primaryKey(),
  pipelineName: varchar("pipelineName", { length: 100 }).notNull(),
  triggerType: varchar("triggerType", { length: 50 }).notNull(),
  triggerEntityId: int("triggerEntityId"),
  status: mysqlEnum("status", ["success", "failed", "pending"]).default("pending").notNull(),
  webhookUrl: varchar("webhookUrl", { length: 500 }),
  requestPayload: json("requestPayload"),
  responseStatus: int("responseStatus"),
  errorMessage: text("errorMessage"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AutomationLog = typeof automationLogs.$inferSelect;

// ─── 상품 동영상 ────────────────────────────────────────────────
export const packageVideos = mysqlTable("package_videos", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  videoUrl: varchar("videoUrl", { length: 500 }).notNull(),
  videoKey: varchar("videoKey", { length: 255 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 500 }),
  title: varchar("title", { length: 200 }),
  durationSec: int("durationSec"),
  generatedBy: mysqlEnum("generatedBy", ["runway", "manual", "ai"]).default("manual"),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PackageVideo = typeof packageVideos.$inferSelect;

// ============================================================
// 두골프-AI개발 엔진 테이블
// ============================================================

// ─── AI 엔진 오류 감지 이력 ─────────────────────────────────────
export const aiEngineLogs = mysqlTable("ai_engine_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 오류 발생 출처 (tRPC 라우터명, 컴포넌트명 등) */
  source: varchar("source", { length: 200 }).notNull(),
  /** 오류 유형: runtime=런타임, api=API 호출, validation=입력 검증, unknown=기타 */
  errorType: mysqlEnum("errorType", ["runtime", "api", "validation", "unknown"]).default("unknown").notNull(),
  /** 오류 메시지 원문 */
  errorMessage: text("errorMessage").notNull(),
  /** 스택 트레이스 */
  stackTrace: text("stackTrace"),
  /** 오류 발생 URL 또는 경로 */
  path: varchar("path", { length: 500 }),
  /** 연관된 수정 요청 ID */
  fixRequestId: int("fixRequestId"),
  /** 처리 상태: new=신규, analyzing=분석중, fixed=수정완료, ignored=무시 */
  status: mysqlEnum("status", ["new", "analyzing", "fixed", "ignored"]).default("new").notNull(),
  /** AI 분석 결과 요약 */
  aiAnalysis: text("aiAnalysis"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiEngineLog = typeof aiEngineLogs.$inferSelect;
export type InsertAiEngineLog = typeof aiEngineLogs.$inferInsert;

// ─── AI 수정 요청 큐 ────────────────────────────────────────────
export const aiFixRequests = mysqlTable("ai_fix_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** 수정 요청 제목 */
  title: varchar("title", { length: 300 }).notNull(),
  /** 수정 요청 상세 설명 */
  description: text("description").notNull(),
  /** 수정 대상 파일 경로 */
  targetFile: varchar("targetFile", { length: 500 }),
  /** 수정 대상 함수/컴포넌트명 */
  targetFunction: varchar("targetFunction", { length: 200 }),
  /** 우선순위: critical=즉시수정, high=높음, medium=보통, low=낮음 */
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium").notNull(),
  /** 핵심 기능 여부 (결제, 예약, 인증 등) - true이면 사용자 승인 필요 */
  isCritical: boolean("isCritical").default(false).notNull(),
  /** 처리 상태 */
  status: mysqlEnum("status", ["pending", "in_review", "approved", "rejected", "applied", "failed"]).default("pending").notNull(),
  /** 수정 전 원본 코드 (diff 비교용) */
  originalCode: text("originalCode"),
  /** AI가 생성한 수정 코드 제안 */
  aiFixCode: text("aiFixCode"),
  /** AI 수정 설명 */
  aiFixExplanation: text("aiFixExplanation"),
  /** 사용자 승인/거부 메모 */
  userFeedback: text("userFeedback"),
  /** 승인한 관리자 ID */
  approvedBy: int("approvedBy"),
  /** 연관된 오류 로그 ID */
  errorLogId: int("errorLogId"),
  /** 요청 출처: auto=자동감지, manual=수동입력 */
  requestSource: mysqlEnum("requestSource", ["auto", "manual"]).default("manual").notNull(),
  /** AI 분류 카테고리: BUG/FEATURE/IMPROVEMENT/REFACTOR/SECURITY */
  aiCategory: varchar("aiCategory", { length: 30 }),
  /** AI 제안 우선순위 */
  aiSuggestedPriority: varchar("aiSuggestedPriority", { length: 20 }),
  /** AI 예상 공수 (시간) */
  aiEstimatedHours: int("aiEstimatedHours"),
  /** AI 분석 완료 여부 */
  aiAnalyzed: boolean("aiAnalyzed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiFixRequest = typeof aiFixRequests.$inferSelect;
export type InsertAiFixRequest = typeof aiFixRequests.$inferInsert;

// ─── AI 재검토 결과 ──────────────────────────────────────────────
export const aiReviewResults = mysqlTable("ai_review_results", {
  id: int("id").autoincrement().primaryKey(),
  /** 연관된 수정 요청 ID */
  fixRequestId: int("fixRequestId").notNull(),
  /** 검토 단계: syntax=문법, logic=로직, security=보안, test=테스트, final=최종 */
  reviewStage: mysqlEnum("reviewStage", ["syntax", "logic", "security", "test", "final"]).default("syntax").notNull(),
  /** 검토 결과: pass=통과, fail=실패, warning=경고 */
  result: mysqlEnum("result", ["pass", "fail", "warning"]).default("pass").notNull(),
  /** 검토 상세 내용 */
  details: text("details"),
  /** 발견된 이슈 목록 (JSON) */
  issues: json("issues"),
  /** 검토에 사용된 AI 모델 */
  reviewModel: varchar("reviewModel", { length: 100 }),
  /** 검토 소요 시간 (ms) */
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiReviewResult = typeof aiReviewResults.$inferSelect;
export type InsertAiReviewResult = typeof aiReviewResults.$inferInsert;

// ============================================================
// AI_LOGS - AI 어시스턴트 대화 이력 (두골프 마스터/골프톡/매니저)
// ============================================================
export const aiLogs = mysqlTable("ai_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 세션 식별자 */
  sessionId: varchar("sessionId", { length: 100 }).notNull(),
  /** 관리자 user ID (골프톡 비로그인 시 null) */
  userId: int("userId"),
  /** 어시스턴트 채널 구분 */
  assistant: mysqlEnum("assistant", ["master", "golftalk", "manager"]).notNull(),
  /** 메시지 역할 */
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  /** 메시지 내용 */
  content: text("content").notNull(),
  /** 실제 사용된 모델명 (비용 추적용) */
  modelUsed: varchar("modelUsed", { length: 100 }),
  /** 입력 토큰 수 */
  tokensIn: int("tokensIn").default(0),
  /** 출력 토큰 수 */
  tokensOut: int("tokensOut").default(0),
  /** 호출 비용 (달러) */
  costUsd: decimal("costUsd", { precision: 10, scale: 6 }).default("0"),
  /** Google Search Grounding 적용 여부 */
  grounded: boolean("grounded").default(false),
  /** 분양 테넌트 ID (두골프 자체 사용 시 null) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiLog = typeof aiLogs.$inferSelect;
export type InsertAiLog = typeof aiLogs.$inferInsert;

// ============================================================
// MASTER_SESSION_SUMMARIES - 두골프 마스터 AI 세션 핵심 요약
//  - 세션 종료/전환 시 핵심 키워드·변경 DB·개발이력을 요약 저장
//  - 이어가기 클릭 시 전체 히스토리 대신 이 요약본을 컨텍스트로 주입
//  - 신규 질문 시 자동 로드하지 않음 (혼선/할루시네이션 방지)
// ============================================================
export const masterSessionSummaries = mysqlTable("master_session_summaries", {
  id: int("id").autoincrement().primaryKey(),
  /** 마스터 세션 식별자 (ai_logs.sessionId) */
  sessionId: varchar("sessionId", { length: 100 }).notNull().unique(),
  /** 핵심 요약 (3~5줄) */
  summary: text("summary"),
  /** 핵심 키워드/주제 (쉼표 구분) */
  keyTopics: text("keyTopics"),
  /** 변경된 DB/스키마 요약 */
  dbChanges: text("dbChanges"),
  /** 개발 이력 요약 (요청/배포 등) */
  devHistory: text("devHistory"),
  /** 요약 시점 메시지 수 */
  messageCount: int("messageCount").default(0),
  /** 요약에 사용한 모델 */
  model: varchar("model", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MasterSessionSummary = typeof masterSessionSummaries.$inferSelect;
export type InsertMasterSessionSummary = typeof masterSessionSummaries.$inferInsert;

// ============================================================
// CHAT_SESSIONS - 골프톡/두골프 매니저 상담 세션
// ============================================================
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  /** 세션 고유 식별자 */
  sessionId: varchar("sessionId", { length: 100 }).notNull().unique(),
  /** 채널 구분 */
  channel: mysqlEnum("channel", ["golftalk", "manager"]).notNull(),
  /** 로그인 사용자 ID (비로그인 골프톡은 null) */
  userId: int("userId"),
  /** 입점사 파트너 ID (manager 채널용) */
  partnerId: int("partnerId"),
  /** 세션 상태 */
  status: mysqlEnum("status", ["active", "closed", "pending"]).default("active"),
  /** AI가 생성한 대화 요약 (Prompt Caching용) */
  summary: text("summary"),
  /** 문의 중인 패키지 ID */
  packageId: int("packageId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

// ============================================================
// PARTNERS - 파트너(거래처) 관리
// ============================================================
export const partners = mysqlTable("partners", {
  id: int("id").autoincrement().primaryKey(),
  /** 업체명 */
  companyName: varchar("companyName", { length: 200 }).notNull(),
  /** 사업자등록번호 */
  businessNumber: varchar("businessNumber", { length: 20 }),
  /** 관광사업자 등록번호 */
  tourismLicenseNo: varchar("tourismLicenseNo", { length: 50 }),
  /** 통신판매업 신고번호 */
  onlineSalesNo: varchar("onlineSalesNo", { length: 50 }),
  /** 은행명 */
  bankName: varchar("bankName", { length: 50 }),
  /** 계좌번호 */
  accountNumber: varchar("accountNumber", { length: 50 }),
  /** 예금주 */
  accountHolder: varchar("accountHolder", { length: 100 }),
  /** 담당자명 */
  contactName: varchar("contactName", { length: 100 }),
  /** 담당자 전화번호 */
  contactPhone: varchar("contactPhone", { length: 20 }),
  /** 담당자 이메일 */
  contactEmail: varchar("contactEmail", { length: 320 }),
  /** 파트너 로그인 ID */
  loginId: varchar("loginId", { length: 100 }),
  /** 파트너 로그인 PW (bcrypt 해시) */
  loginPwHash: varchar("loginPwHash", { length: 255 }),
  /** 구글 OAuth 고유 ID (sub) */
  googleId: varchar("googleId", { length: 200 }),
  /** 구글 이메일 */
  googleEmail: varchar("googleEmail", { length: 320 }),
  /** 구글 프로필 이름 */
  googleName: varchar("googleName", { length: 200 }),
  /** 구글 프로필 사진 URL */
  googlePicture: varchar("googlePicture", { length: 500 }),
  /** 마지막 구글 로그인 시각 */
  lastGoogleLoginAt: timestamp("lastGoogleLoginAt"),
  /** 메모 */
  memo: text("memo"),
  /** 활성 상태 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 정지 일시 (null이면 정지 아님) */
  suspendedAt: timestamp("suspendedAt"),
  /** 정지 사유 */
  suspendReason: text("suspendReason"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;

// ============================================================
// PARTNER_SCHEDULES - 파트너 일정 관리
// ============================================================
export const partnerSchedules = mysqlTable("partner_schedules", {
  id: int("id").autoincrement().primaryKey(),
  /** 파트너 ID (FK) */
  partnerId: int("partnerId").notNull(),
  /** 일정 제목 */
  title: varchar("title", { length: 200 }).notNull(),
  /** 메모 */
  memo: text("memo"),
  /** 시작일 */
  startDate: timestamp("startDate").notNull(),
  /** 종료일 */
  endDate: timestamp("endDate").notNull(),
  /** 담당자 이름 */
  assignedTo: varchar("assignedTo", { length: 100 }),
  /** 일정 색상 (캘린더 표시용) */
  color: varchar("color", { length: 20 }).default("#16a34a"),
  /** 반복 유형: none | daily | weekly | monthly | yearly */
  recurrenceType: varchar("recurrenceType", { length: 20 }).default("none").notNull(),
  /** 반복 간격 (예: 1=매월, 2=격월) */
  recurrenceInterval: int("recurrenceInterval").default(1),
  /** 반복 종료일 (null이면 무기한) */
  recurrenceEndDate: timestamp("recurrenceEndDate"),
  /** 원본 반복 일정 ID (반복 인스턴스인 경우) */
  parentScheduleId: int("parentScheduleId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PartnerSchedule = typeof partnerSchedules.$inferSelect;
export type InsertPartnerSchedule = typeof partnerSchedules.$inferInsert;

// ============================================================
// AFFILIATES - 제휴사 (골프장, 숙소, 관광지)
// ============================================================
export const affiliates = mysqlTable("affiliates", {
  id: int("id").autoincrement().primaryKey(),
  /** 분류: golf_domestic | golf_overseas | accommodation | attraction | other */
  category: mysqlEnum("category", ["golf_domestic", "golf_overseas", "accommodation", "attraction", "other"]).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  /** 지역 (국내: 경기/강원 등, 해외: 태국/베트남 등) */
  region: varchar("region", { length: 100 }),
  country: varchar("country", { length: 50 }).default("한국"),
  address: text("address"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 300 }),
  contactPerson: varchar("contactPerson", { length: 100 }),
  contactName: varchar("contactName", { length: 100 }),
  contactPhone: varchar("contactPhone", { length: 30 }),
  /** UI에서 사용하는 type 필드 */
  type: mysqlEnum("type", ["golf_domestic", "golf_overseas", "hotel", "attraction", "transport", "other"]).default("golf_domestic"),
  /** 계약 유형: direct | agency | platform */
  contractType: mysqlEnum("contractType", ["direct", "agency", "platform"]).default("direct"),
  supplyPrice: int("supplyPrice"),
  /** 홈 수 */
  holeCount: int("holeCount").default(18),
  /** 코스 수 */
  courseCount: int("courseCount").default(1),
  /** 그린피 최소 */
  greenFeeMin: int("greenFeeMin").default(0),
  /** 그린피 최대 */
  greenFeeMax: int("greenFeeMax").default(0),
  /** 선입금 잔액 */
  prepaidBalance: int("prepaidBalance").default(0),
  /** 데파짓 잔액 */
  depositBalance: int("depositBalance").default(0),
  /** 상태 */
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  notes: text("notes"),
  /** oyeo 시스템 ID */
  oyeoId: varchar("oyeoId", { length: 20 }),
  /** oyeo 골프코드 */
  oyeoCode: varchar("oyeoCode", { length: 30 }),
  /** 영문명 */
  nameEn: varchar("nameEn", { length: 200 }),
  /** 대륙 */
  continent: varchar("continent", { length: 50 }),
  /** 위도 */
  lat: varchar("lat", { length: 30 }),
  /** 경도 */
  lng: varchar("lng", { length: 30 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = typeof affiliates.$inferInsert;

// ============================================================
// TENANT_AFFILIATES - 업체별 제휴사 재사용/호칭/요금 (2계층 구조)
//  - 마스터 affiliates(통합코드)를 검색해 재사용하거나(masterAffiliateId),
//    마스터에 없으면 업체가 신규 등록(masterAffiliateId=null)
//  - 각 업체가 정한 호칭/요금/잔액을 별도 보관 → 상품/예약/정산/요금 연결 기준
// ============================================================
export const tenantAffiliates = mysqlTable("tenant_affiliates", {
  id: int("id").autoincrement().primaryKey(),
  /** 업체(테넌트) ID — null은 허용하지 않음(업체 전용 리소스) */
  tenantId: int("tenantId").notNull(),
  /** 마스터 affiliates 참조 (null = 업체 자체 신규 등록) */
  masterAffiliateId: int("masterAffiliateId"),
  /** 업체가 정한 자사 호칭명 */
  customName: varchar("customName", { length: 200 }).notNull(),
  /** 분류 */
  category: mysqlEnum("category", ["golf_domestic", "golf_overseas", "hotel", "attraction", "transport", "other"]).default("golf_domestic"),
  /** 자사 적용 그린피/공급가 */
  customGreenFee: int("customGreenFee").default(0),
  /** 선입금 잔액 (업체별 독립) */
  prepaidBalance: int("prepaidBalance").default(0),
  /** 데파짓 잔액 (업체별 독립) */
  depositBalance: int("depositBalance").default(0),
  /** 담당자명 */
  contactName: varchar("contactName", { length: 100 }),
  /** 담당자 전화 */
  contactPhone: varchar("contactPhone", { length: 30 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TenantAffiliate = typeof tenantAffiliates.$inferSelect;
export type InsertTenantAffiliate = typeof tenantAffiliates.$inferInsert;

// ============================================================
// TENANT_PARTNERS - 업체별 거래처(제휴여행사/숨소/대리점) 개별 관리
//  - 각 업체가 예약/송금/정산을 진행하는 거래처 원장 (송금/예약/정산 연결)
// ============================================================
export const tenantPartners = mysqlTable("tenant_partners", {
  id: int("id").autoincrement().primaryKey(),
  /** 업체(테넌트) ID */
  tenantId: int("tenantId").notNull(),
  /** 거래처명 */
  companyName: varchar("companyName", { length: 200 }).notNull(),
  /** 거래처 유형: 여행사/숨소/대리점/기타 */
  partnerType: mysqlEnum("partnerType", ["travel_agency", "accommodation", "agency", "other"]).default("travel_agency"),
  /** 사업자등록번호 */
  businessNumber: varchar("businessNumber", { length: 20 }),
  /** 담당자명 */
  contactName: varchar("contactName", { length: 100 }),
  /** 담당자 전화 */
  contactPhone: varchar("contactPhone", { length: 30 }),
  /** 은행명 */
  bankName: varchar("bankName", { length: 50 }),
  /** 계좌번호 */
  accountNumber: varchar("accountNumber", { length: 50 }),
  /** 예금주 */
  accountHolder: varchar("accountHolder", { length: 100 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["active", "inactive", "pending"]).default("active"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TenantPartner = typeof tenantPartners.$inferSelect;
export type InsertTenantPartner = typeof tenantPartners.$inferInsert;

// ============================================================
// RESERVATIONS - 예약 마스터
// ============================================================
export const reservations = mysqlTable("reservations", {
  id: int("id").autoincrement().primaryKey(),
  /** 예약번호 (자동생성: OY-YYYYMM-XXXX) */
  reservationNo: varchar("reservationNo", { length: 30 }).notNull().unique(),
  /** 상품명 */
  productName: varchar("productName", { length: 300 }).notNull(),
  /** 골프장명 */
  golfCourseName: varchar("golfCourseName", { length: 200 }),
  /** 제휴사 ID (affiliates 참조) */
  affiliateId: int("affiliateId"),
  /** 출발일 */
  departureDate: timestamp("departureDate").notNull(),
  /** 박수 (0=당일) */
  nights: int("nights").default(0),
  /** 팀수 */
  teams: int("teams").default(1),
  /** 인원 */
  headcount: int("headcount").default(1),
  /** 고객명 */
  customerName: varchar("customerName", { length: 100 }).notNull(),
  /** 고객 연락처 */
  customerPhone: varchar("customerPhone", { length: 30 }),
  /** 고객 이메일 */
  customerEmail: varchar("customerEmail", { length: 200 }),
  /** 담당자 */
  assignedTo: varchar("assignedTo", { length: 100 }),
  /** 대리점명 */
  agentName: varchar("agentName", { length: 200 }),
  /** 판매가 (1인) */
  salePricePerPerson: int("salePricePerPerson").default(0),
  /** 판매 합계 */
  salePriceTotal: int("salePriceTotal").default(0),
  /** 입금가 (공급가) */
  depositPrice: int("depositPrice").default(0),
  /** 추가요금 */
  extraFee: int("extraFee").default(0),
  /** 수익 */
  profit: int("profit").default(0),
  /** 상태: pending | confirmed | cancelled | completed */
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"]).default("pending").notNull(),
  /** 입금 상태: unpaid | partial | paid */
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid"]).default("unpaid").notNull(),
  /** 실제 입금 합계 */
  paidAmount: int("paidAmount").default(0),
  /** 송금 합계 */
  remittedAmount: int("remittedAmount").default(0),
  notes: text("notes"),
  /** 유저 구분: customer | partner | manager */
  userType: mysqlEnum("userType", ["customer", "partner", "manager"]).default("customer"),
  /** 파트너 ID (partners 테이블 참조) */
  partnerId: int("partnerId"),
  /** 파트너 업체명 */
  partnerCompanyName: varchar("partnerCompanyName", { length: 200 }),
  /** 파트너 담당자명 */
  partnerContactName: varchar("partnerContactName", { length: 100 }),
  /** 파트너 연락처 */
  partnerContactPhone: varchar("partnerContactPhone", { length: 30 }),
  /** 담당자명 (로그인 사용자) */
  managerName: varchar("managerName", { length: 100 }),
  /** 담당자 연락처 */
  managerPhone: varchar("managerPhone", { length: 30 }),
  /** 진행 상태: proceeding | impossible | confirmed | waiting */
  progressStatus: mysqlEnum("progressStatus", ["proceeding", "impossible", "confirmed", "waiting"]).default("proceeding"),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = typeof reservations.$inferInsert;

// ============================================================
// INCOME_RECORDS - 입금 내역
// ============================================================
export const incomeRecords = mysqlTable("income_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 입금일시 */
  transactionDate: timestamp("transactionDate").notNull(),
  /** 은행명 */
  bankName: varchar("bankName", { length: 50 }),
  /** 입금액 */
  amount: int("amount").notNull(),
  /** 입금자명 */
  depositorName: varchar("depositorName", { length: 100 }),
  /** 상세내역 (은행 문자 그대로) */
  detail: text("detail"),
  /** 예약번호 (수동 매칭) */
  reservationNo: varchar("reservationNo", { length: 30 }),
  /** 매칭된 예약 ID */
  matchedReservationId: int("matchedReservationId"),
  /** 매칭 상태: unmatched | matched | partial */
  matchStatus: mysqlEnum("matchStatus", ["unmatched", "matched", "partial"]).default("unmatched").notNull(),
  notes: text("notes"),
  /** 테넌트 격리: 부모 reservation과 동기화 (null=두골프 본사, 1~N=파트너사) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IncomeRecord = typeof incomeRecords.$inferSelect;
export type InsertIncomeRecord = typeof incomeRecords.$inferInsert;

// ============================================================
// REMITTANCE_RECORDS - 송금 내역
// ============================================================
export const remittanceRecords = mysqlTable("remittance_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 송금일시 */
  transactionDate: timestamp("transactionDate").notNull(),
  /** 은행명 */
  bankName: varchar("bankName", { length: 50 }),
  /** 송금액 */
  amount: int("amount").notNull(),
  /** 수취인명 (거래처) */
  recipientName: varchar("recipientName", { length: 100 }),
  /** 거래처 유형: golf_course | accommodation | transport | other */
  recipientType: mysqlEnum("recipientType", ["golf_course", "accommodation", "transport", "other"]).default("other"),
  /** 상세내역 */
  detail: text("detail"),
  /** 예약번호 */
  reservationNo: varchar("reservationNo", { length: 30 }),
  /** 매칭된 예약 ID */
  matchedReservationId: int("matchedReservationId"),
  /** 제휴사 ID */
  affiliateId: int("affiliateId"),
  /** 매칭 상태 */
  matchStatus: mysqlEnum("matchStatus", ["unmatched", "matched", "partial"]).default("unmatched").notNull(),
  notes: text("notes"),
  /** 테넌트 격리: 부모 reservation과 동기화 (null=두골프 본사, 1~N=파트너사) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RemittanceRecord = typeof remittanceRecords.$inferSelect;
export type InsertRemittanceRecord = typeof remittanceRecords.$inferInsert;

// ============================================================
// DEPOSIT_RECORDS - 예치금 관리
// ============================================================
export const depositRecords = mysqlTable("deposit_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 예약 ID */
  reservationId: int("reservationId"),
  /** 예약번호 */
  reservationNo: varchar("reservationNo", { length: 30 }),
  /** 유형: unpaid | expected | deduct_other | deduct_shinhan */
  type: mysqlEnum("type", ["unpaid", "expected", "deduct_other", "deduct_shinhan"]).notNull(),
  amount: int("amount").notNull(),
  memo: text("memo"),
  /** 테넌트 격리: 부모 reservation과 동기화 (null=두골프 본사, 1~N=파트너사) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DepositRecord = typeof depositRecords.$inferSelect;
export type InsertDepositRecord = typeof depositRecords.$inferInsert;

// ============================================================
// CHARGE_RECORDS - 충전 (카드 결제) 관리
// ============================================================
export const chargeRecords = mysqlTable("charge_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 카드사 */
  cardCompany: varchar("cardCompany", { length: 50 }),
  /** 골프장명 (카드 내역에서 추측) */
  golfCourseName: varchar("golfCourseName", { length: 200 }),
  amount: int("amount").notNull(),
  transactionDate: timestamp("transactionDate").notNull(),
  /** 예약번호 */
  reservationNo: varchar("reservationNo", { length: 30 }),
  /** 매칭된 예약 ID */
  matchedReservationId: int("matchedReservationId"),
  /** 원본 카드 내역 텍스트 */
  rawText: text("rawText"),
  matchStatus: mysqlEnum("matchStatus", ["unmatched", "matched", "partial"]).default("unmatched").notNull(),
  notes: text("notes"),
  /** 테넌트 격리: 부모 reservation과 동기화 (null=두골프 본사, 1~N=파트너사) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ChargeRecord = typeof chargeRecords.$inferSelect;
export type InsertChargeRecord = typeof chargeRecords.$inferInsert;

// ============================================================
// PREPAID_RECORDS - 데파짓 (선입금) 관리
// ============================================================
export const prepaidRecords = mysqlTable("prepaid_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 제휴사 ID */
  affiliateId: int("affiliateId"),
  golfCourseName: varchar("golfCourseName", { length: 200 }).notNull(),
  /** 선입금 총액 */
  prepaidAmount: int("prepaidAmount").notNull(),
  /** 사용 금액 */
  usedAmount: int("usedAmount").default(0),
  /** 잔액 (자동 계산) */
  remainingAmount: int("remainingAmount").default(0),
  notes: text("notes"),
  /** 테넌트 격리: 제휴사 기준 (null=두골프 본사, 1~N=파트너사) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PrepaidRecord = typeof prepaidRecords.$inferSelect;
export type InsertPrepaidRecord = typeof prepaidRecords.$inferInsert;

// ============================================================
// RESERVATION_INQUIRIES - 예약별 문의/자동/답변 관리
// ============================================================
export const reservationInquiries = mysqlTable("reservation_inquiries", {
  id: int("id").autoincrement().primaryKey(),
  /** 연결된 예약 ID */
  reservationId: int("reservationId").notNull(),
  /** 예약번호 (빠른 조회용) */
  reservationNo: varchar("reservationNo", { length: 30 }),
  /** 순서 (같은 예약 내 여러 문의 세트) */
  sortOrder: int("sortOrder").default(0),
  /** 문의 내용 (거래처/고객 문의) */
  inquiryText: text("inquiryText"),
  /** 자동 변환된 문의 템플릿 (AI 생성) */
  autoText: text("autoText"),
  /** 골프장 답변 내용 */
  replyText: text("replyText"),
  /** 문의 상태: draft | sent | replied | confirmed */
  inquiryStatus: mysqlEnum("inquiryStatus", ["draft", "sent", "replied", "confirmed"]).default("draft"),
  /** 사용된 템플릿 ID */
  templateId: int("templateId"),
  /** 마지막 수정자 */
  updatedBy: varchar("updatedBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ReservationInquiry = typeof reservationInquiries.$inferSelect;
export type InsertReservationInquiry = typeof reservationInquiries.$inferInsert;

// ============================================================
// INQUIRY_TEMPLATES - 문의 자동화 템플릿 관리
// ============================================================
export const inquiryTemplates = mysqlTable("inquiry_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** 템플릿명 */
  name: varchar("name", { length: 200 }).notNull(),
  /** 카테고리 (golf_booking | accommodation | transport | general | estimate) */
  category: mysqlEnum("category", ["golf_booking", "accommodation", "transport", "general", "estimate"]).default("golf_booking"),
  /** 템플릿 내용 ({{변수}} 형식 사용 가능) */
  content: text("content").notNull(),
  /** 사용 가능한 변수 목록 (JSON) */
  variables: text("variables"),
  /** 활성 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 사용 횟수 */
  useCount: int("useCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InquiryTemplate = typeof inquiryTemplates.$inferSelect;
export type InsertInquiryTemplate = typeof inquiryTemplates.$inferInsert;

// ============================================================
// CUSTOMER_ESTIMATE_TEMPLATES - 고객 견적서 템플릿
// ============================================================
export const customerEstimateTemplates = mysqlTable("customer_estimate_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** 템플릿명 */
  name: varchar("name", { length: 200 }).notNull(),
  /** 포함사항 (줄바꿈 구분) */
  includeItems: text("includeItems"),
  /** 불포함사항 (줄바꿈 구분) */
  excludeItems: text("excludeItems"),
  /** 기타 안내사항 */
  notes: text("notes"),
  /** 세부 일정 (JSON: [{day, title, content}]) */
  schedule: text("schedule"),
  /** 활성 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 사용 횟수 */
  useCount: int("useCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustomerEstimateTemplate = typeof customerEstimateTemplates.$inferSelect;
export type InsertCustomerEstimateTemplate = typeof customerEstimateTemplates.$inferInsert;

// ============================================================
// ESTIMATES - 생성된 고객 견적서
// ============================================================
export const estimates = mysqlTable("estimates", {
  id: int("id").autoincrement().primaryKey(),
  /** 연결된 예약 ID */
  reservationId: int("reservationId").notNull(),
  /** 공개 접근 토큰 (base64 인코딩된 ID) */
  token: varchar("token", { length: 100 }).notNull().unique(),
  /** 사용된 템플릿 ID */
  templateId: int("templateId"),
  /** 견적 유형: partner(거래처용) | customer(고객용) */
  estimateType: mysqlEnum("estimateType", ["partner", "customer"]).default("customer"),
  /** 커스텀 데이터 (JSON: 오버라이드 항목) */
  customData: text("customData"),
  /** 발송 여부 */
  isSent: boolean("isSent").default(false),
  /** 발송 일시 */
  sentAt: timestamp("sentAt"),
  /** 발송 방법: email | kakao */
  sentVia: mysqlEnum("sentVia", ["email", "kakao"]).default("email"),
  /** 생성자 */
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;

// ============================================================
// RESERVATION_ITINERARIES - 예약 일정 상세
// ============================================================
export const reservationItineraries = mysqlTable("reservation_itineraries", {
  id: int("id").autoincrement().primaryKey(),
  /** 연결된 예약 ID */
  reservationId: int("reservationId").notNull(),
  /** 일차 인덱스 (0-based: 0=1일차, 1=2일차, ...) */
  dayIndex: int("dayIndex").notNull(),
  /** 해당 날짜 */
  date: timestamp("date"),
  /** 일자 유형: departure(출발일) | stay(체류일) | arrival(도착일) | daytrip(당일) */
  dayType: mysqlEnum("dayType", ["departure", "stay", "arrival", "daytrip"]).default("stay"),
  /** 골프장 제휴사 ID (affiliates 참조, nullable) */
  golfAffiliateId: int("golfAffiliateId"),
  /** 홀수 (0=라운딩없음, 9, 18, 27, 36) */
  holeCount: int("holeCount").default(18),
  /** 견적 티오프 시간 (예: "08:30") — 견적 단계에서 입력 */
  estimatedTeeTime: varchar("estimatedTeeTime", { length: 10 }),
  /** 확정 티오프 시간 (예: "08:30") — 예약 확정 후 입력 */
  confirmedTeeTime: varchar("confirmedTeeTime", { length: 10 }),
  /** @deprecated 구 티오프 필드 (하위 호환성 유지) — estimatedTeeTime 사용 권장 */
  teeTime: varchar("teeTime", { length: 10 }),
  /** 숙소 제휴사 ID (affiliates 참조, nullable) */
  accommodationAffiliateId: int("accommodationAffiliateId"),
  /** 객실 타입 (예: "스탠다드 더블") */
  roomType: varchar("roomType", { length: 100 }),
  /** 객실 수 */
  roomCount: int("roomCount").default(1),
  /** 항공 정보 (JSON: {airline, depAirport, depTime, arrAirport, arrTime}) */
  flightInfo: text("flightInfo"),
  /** 비고 */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type ReservationItinerary = typeof reservationItineraries.$inferSelect;
export type InsertReservationItinerary = typeof reservationItineraries.$inferInsert;

// ============================================================
// RESERVATION_AFFILIATE_COSTS - 예약별 제휴사 비용
// ============================================================
export const reservationAffiliateCosts = mysqlTable("reservation_affiliate_costs", {
  id: int("id").autoincrement().primaryKey(),
  /** 연결된 예약 ID */
  reservationId: int("reservationId").notNull(),
  /** 제휴사 ID (affiliates 참조, nullable) */
  affiliateId: int("affiliateId"),
  /** 제휴사명 (직접 입력 시 사용, affiliateId 없을 때) */
  affiliateName: varchar("affiliateName", { length: 200 }),
  /** 비용 유형: golf | accommodation | transport | other */
  costType: mysqlEnum("costType", ["golf", "accommodation", "transport", "other"]).default("golf"),
  /** 해당 날짜 */
  date: timestamp("date"),
  /** 확정 시간 (티오프시간 또는 체크인/아웃 시간, 예: "08:30") */
  confirmedTime: varchar("confirmedTime", { length: 20 }),
  /** 입금가 (원가) */
  unitPrice: int("unitPrice").default(0),
  /** 판매가 */
  salePrice: int("salePrice").default(0),
  /** 수량 */
  quantity: int("quantity").default(1),
  /** 비고 */
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type ReservationAffiliateCost = typeof reservationAffiliateCosts.$inferSelect;
export type InsertReservationAffiliateCost = typeof reservationAffiliateCosts.$inferInsert;

// ============================================================
// CUSTOM_VARIABLES - 자동 치환 변수 관리
// ============================================================
export const customVariables = mysqlTable("custom_variables", {
  id: int("id").autoincrement().primaryKey(),
  /** 카테고리 (예: 고객 정보, 예약 정보, 금액 정보, 커스텀 등) */
  category: varchar("category", { length: 100 }).notNull(),
  /** 표시 라벨 (예: 고객명) */
  label: varchar("label", { length: 100 }).notNull(),
  /** 변수 키값 (예: {{고객명}}) — 중괄호 포함 저장 */
  variableKey: varchar("variableKey", { length: 100 }).notNull().unique(),
  /** 설명 (예: 예약자 이름) */
  description: varchar("description", { length: 300 }),
  /** 시스템 기본 변수 여부 (true이면 삭제 불가) */
  isSystem: boolean("isSystem").default(false).notNull(),
  /** 활성화 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 정렬 순서 */
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type CustomVariable = typeof customVariables.$inferSelect;
export type InsertCustomVariable = typeof customVariables.$inferInsert;

// ============================================================
// SITE_SETTINGS - 홈페이지 전역 설정
// ============================================================
export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  settingKey: varchar("settingKey", { length: 100 }).notNull(),
  settingValue: text("settingValue"),
  description: varchar("description", { length: 300 }),
  settingGroup: varchar("settingGroup", { length: 50 }).default("general"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  updatedBy: varchar("updatedBy", { length: 100 }),
});
export type SiteSetting = typeof siteSettings.$inferSelect;
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// ============================================================
// SITE_NAV_ITEMS - 네비게이션 메뉴 관리
// ============================================================
export const siteNavItems = mysqlTable("site_nav_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  label: varchar("label", { length: 100 }).notNull(),
  href: varchar("href", { length: 500 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isVisible: boolean("isVisible").default(true).notNull(),
  openInNewTab: boolean("openInNewTab").default(false).notNull(),
  icon: varchar("icon", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type SiteNavItem = typeof siteNavItems.$inferSelect;
export type InsertSiteNavItem = typeof siteNavItems.$inferInsert;

// ============================================================
// SITE_HERO_SLIDES - 히어로/배너 슬라이드 관리
// ============================================================
export const siteHeroSlides = mysqlTable("site_hero_slides", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  title: varchar("title", { length: 200 }),
  subtitle: varchar("subtitle", { length: 200 }),
  description: text("description"),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  mobileImageUrl: varchar("mobileImageUrl", { length: 1000 }),
  ctaText: varchar("ctaText", { length: 100 }),
  ctaLink: varchar("ctaLink", { length: 500 }),
  destination: varchar("destination", { length: 100 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  startAt: timestamp("startAt"),
  endAt: timestamp("endAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type SiteHeroSlide = typeof siteHeroSlides.$inferSelect;
export type InsertSiteHeroSlide = typeof siteHeroSlides.$inferInsert;

// ============================================================
// SITE_FOOTER - 푸터 업체 정보
// ============================================================
export const siteFooter = mysqlTable("site_footer", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  companyName: varchar("companyName", { length: 200 }),
  ceoName: varchar("ceoName", { length: 100 }),
  businessNumber: varchar("businessNumber", { length: 50 }),
  mailOrderNumber: varchar("mailOrderNumber", { length: 100 }),
  tourismLicenseNumber: varchar("tourismLicenseNumber", { length: 100 }),
  address: varchar("address", { length: 500 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 200 }),
  businessHours: varchar("businessHours", { length: 200 }),
  bankAccounts: text("bankAccounts"),
  kakaoUrl: varchar("kakaoUrl", { length: 500 }),
  instagramUrl: varchar("instagramUrl", { length: 500 }),
  facebookUrl: varchar("facebookUrl", { length: 500 }),
  xUrl: varchar("xUrl", { length: 500 }),
  youtubeUrl: varchar("youtubeUrl", { length: 500 }),
  naverBlogUrl: varchar("naverBlogUrl", { length: 500 }),
  copyright: varchar("copyright", { length: 300 }),
  businessLicenseImageUrl: varchar("businessLicenseImageUrl", { length: 1000 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  updatedBy: varchar("updatedBy", { length: 100 }),
});
export type SiteFooter = typeof siteFooter.$inferSelect;
export type InsertSiteFooter = typeof siteFooter.$inferInsert;

// ============================================================
// SITE_FEATURED_PACKAGES - 홈 노출 상품 구성
// ============================================================
export const siteFeaturedPackages = mysqlTable("site_featured_packages", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),  // null = 두골프 본사, 1~N = 파트너사
  packageId: int("packageId").notNull(),
  section: varchar("section", { length: 50 }).default("recommended").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type SiteFeaturedPackage = typeof siteFeaturedPackages.$inferSelect;
export type InsertSiteFeaturedPackage = typeof siteFeaturedPackages.$inferInsert;

// ============================================================
// SITE_AUDIT_LOGS - CMS 변경 이력 (감사 로그)
// ============================================================
export const siteAuditLogs = mysqlTable("site_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  tableName: varchar("tableName", { length: 100 }).notNull(),
  recordId: varchar("recordId", { length: 100 }),
  action: varchar("action", { length: 20 }).notNull(),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  changedBy: varchar("changedBy", { length: 100 }),
  changedByUserId: int("changedByUserId"),
  ipAddress: varchar("ipAddress", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type SiteAuditLog = typeof siteAuditLogs.$inferSelect;
export type InsertSiteAuditLog = typeof siteAuditLogs.$inferInsert;

// ============================================================
// MANAGED_PROJECTS - 두골프 마스터 AI 오케스트라 관리 프로젝트 목록
// 1000개 이상의 Manus WebDev 프로젝트를 중앙에서 관리하기 위한 테이블
// ============================================================
export const managedProjects = mysqlTable("managed_projects", {
  id: int("id").autoincrement().primaryKey(),
  // 프로젝트 식별 정보
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  // Manus 연동 정보
  manusProjectId: varchar("manusProjectId", { length: 100 }),
  manusWebdevPath: varchar("manusWebdevPath", { length: 500 }),
  manusDeployUrl: varchar("manusDeployUrl", { length: 500 }),
  // 개발 컨텍스트 (에이전트 자동 주입용)
  techStack: varchar("techStack", { length: 500 }),
  keyFiles: text("keyFiles"),
  devInstructions: text("devInstructions"),
  customContext: text("customContext"),
  // 상태 관리
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type ManagedProject = typeof managedProjects.$inferSelect;
export type InsertManagedProject = typeof managedProjects.$inferInsert;

// ─── 시스템 설정 테이블 ────────────────────────────────────────────────────────
/**
 * ERP 핵심 운영 설정을 DB에 저장합니다.
 * 환경변수보다 우선 적용되며, 관리자가 UI에서 직접 변경 가능합니다.
 * 주요 키: MANUS_DOGOLF_TASK_ID, MANUS_PROJECT_ID, DEV_REQUEST_AUTO_SEND 등
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue"),
  description: text("description"),
  updatedBy: varchar("updatedBy", { length: 200 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// ─── Manus 태스크 후보 테이블 (태스크 라우팅 선택지 관리) ──────────────────────
/**
 * 개발 요청 시 선택 가능한 Manus 태스크 후보 목록입니다.
 * 두골프 마스터에서 개발요청 전 사용자가 선택하는 태스크 풀입니다.
 */
export const manusTaskCandidates = mysqlTable("manus_task_candidates", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 100 }).unique(),
  taskName: varchar("taskName", { length: 200 }).notNull(),
  projectName: varchar("projectName", { length: 200 }),
  description: text("description"),
  /** 태스크 유형: erp=ERP 개발, homepage=홈페이지, new=신규 프로젝트 */
  taskType: mysqlEnum("taskType", ["erp", "homepage", "new_project", "other"]).default("erp"),
  /** 이 태스크가 기본 라우팅 대상인지 */
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  /** 마지막 사용 시각 */
  lastUsedAt: timestamp("lastUsedAt"),
  /** 총 사용 횟수 */
  useCount: int("useCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type ManusTaskCandidate = typeof manusTaskCandidates.$inferSelect;
export type InsertManusTaskCandidate = typeof manusTaskCandidates.$inferInsert;

// ─── AI 라우팅 로그 테이블 ───────────────────────────────────────────────────
/**
 * AI 모델 라우팅 호출 이력을 저장합니다.
 * 비용 분석 및 모델별 성능 통계에 활용됩니다.
 */
export const aiRoutingLogs = mysqlTable("ai_routing_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 작업 유형 (text_summary, content_create 등) */
  taskType: varchar("taskType", { length: 100 }),
  /** 복잡도 레벨 */
  complexity: mysqlEnum("complexity", ["high", "medium", "low"]).notNull(),
  /** 실제 사용된 모델 ID */
  modelId: varchar("modelId", { length: 200 }).notNull(),
  /** 모델 표시명 */
  modelName: varchar("modelName", { length: 200 }),
  /** 입력 토큰 수 */
  tokensIn: int("tokensIn").default(0),
  /** 출력 토큰 수 */
  tokensOut: int("tokensOut").default(0),
  /** 비용 (USD) */
  costUsd: decimal("costUsd", { precision: 10, scale: 6 }).default("0"),
  /** 응답 시간 (ms) */
  durationMs: int("durationMs").default(0),
  /** 캐시 히트 여부 */
  cacheHit: boolean("cacheHit").default(false),
  /** 성공 여부 */
  isSuccess: boolean("isSuccess").default(true),
  /** 오류 메시지 (실패 시) */
  errorMessage: text("errorMessage"),
  /** 어시스턴트 유형 (master, golftalk, manager) */
  assistantType: varchar("assistantType", { length: 50 }),
  /** 분양 테넌트 ID (두골프 자체 사용 시 null) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type AiRoutingLog = typeof aiRoutingLogs.$inferSelect;
export type InsertAiRoutingLog = typeof aiRoutingLogs.$inferInsert;

// ============================================================
// PARTNER_ONBOARDING - 신규 파트너 온보딩 신청
// ============================================================
/**
 * 신규 파트너(골프투어 여행사)의 ERP 가입 신청 정보를 저장합니다.
 * 사업자등록증 OCR 결과, 샘플 DB 선택, 구독 플랜 정보를 포함합니다.
 */
export const partnerOnboarding = mysqlTable("partner_onboarding", {
  id: int("id").autoincrement().primaryKey(),
  /** 신청 상태: pending | reviewing | approved | rejected | active */
  status: mysqlEnum("status", ["pending", "reviewing", "approved", "rejected", "active"]).default("pending").notNull(),
  /** 업체명 */
  companyName: varchar("companyName", { length: 200 }).notNull(),
  /** 사업자등록번호 */
  businessNumber: varchar("businessNumber", { length: 20 }),
  /** 대표자명 */
  ceoName: varchar("ceoName", { length: 100 }),
  /** 업태 */
  businessType: varchar("businessType", { length: 100 }),
  /** 종목 */
  businessItem: varchar("businessItem", { length: 100 }),
  /** 사업장 주소 */
  address: text("address"),
  /** 담당자명 */
  contactName: varchar("contactName", { length: 100 }).notNull(),
  /** 담당자 이메일 */
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  /** 담당자 전화번호 */
  contactPhone: varchar("contactPhone", { length: 30 }),
  /** 사업자등록증 이미지 S3 키 */
  businessLicenseKey: varchar("businessLicenseKey", { length: 500 }),
  /** 사업자등록증 이미지 URL */
  businessLicenseUrl: varchar("businessLicenseUrl", { length: 500 }),
  /** OCR 추출 원문 (JSON) */
  ocrRawText: text("ocrRawText"),
  /** OCR 추출 결과 (JSON) */
  ocrResult: text("ocrResult"),
  /** 관광사업자등록증 이미지 S3 키 */
  tourismLicenseKey: varchar("tourismLicenseKey", { length: 500 }),
  /** 관광사업자등록증 이미지 URL */
  tourismLicenseUrl: varchar("tourismLicenseUrl", { length: 500 }),
  /** 관광사업자 OCR 추출 원문 (JSON) */
  tourismOcrRawText: text("tourismOcrRawText"),
  /** 관광사업자 OCR 추출 결과 (JSON) */
  tourismOcrResult: text("tourismOcrResult"),
  /** 관광사업자 등록번호 */
  tourismLicenseNo: varchar("tourismLicenseNo", { length: 50 }),
  /** 관광사업자 업종 (예: 국외여행업, 국내여행업) */
  tourismLicenseType: varchar("tourismLicenseType", { length: 100 }),
  /** 관광사업자 등록일 */
  tourismOpenDate: varchar("tourismOpenDate", { length: 20 }),
  /** 선택한 샘플 카테고리: golf_tour_domestic | golf_tour_overseas | golf_tour_mixed */
  sampleCategory: mysqlEnum("sampleCategory", ["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).default("golf_tour_mixed"),
  /** 선택한 구독 플랜: starter | standard | premium */
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["starter", "standard", "premium"]).default("starter"),
  /** 구독 결제 주기: monthly | yearly */
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly"),
  /** Stripe 결제 세션 ID */
  stripeSessionId: varchar("stripeSessionId", { length: 200 }),
  /** Stripe 구독 ID */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 200 }),
  /** 포트원 V2 결제 ID */
  portonePaymentId: varchar("portonePaymentId", { length: 200 }),
  /** 파트너 ID (승인 후 partners 테이블 연결) */
  partnerId: int("partnerId"),
  /** 서비스명 (브랜드명, 상호와 다를 수 있음) */
  serviceName: varchar("serviceName", { length: 200 }),
  /** 홈페이지 URL */
  websiteUrl: varchar("websiteUrl", { length: 500 }),
  /** 블로그 URL */
  blogUrl: varchar("blogUrl", { length: 500 }),
  /** SNS URL (인스타그램, 유튜브 등) */
  snsUrl: varchar("snsUrl", { length: 500 }),
  /** 업체 메모 (관리자 내부 기록) */
  adminNote: text("adminNote"),
  /** 검토자 */
  reviewedBy: varchar("reviewedBy", { length: 200 }),
  /** 검토 완료 시각 */
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PartnerOnboarding = typeof partnerOnboarding.$inferSelect;
export type InsertPartnerOnboarding = typeof partnerOnboarding.$inferInsert;

// ============================================================
// TENANTS - 멀티테넌트 파트너 격리 구조
// ============================================================
/**
 * 테넌트(파트너사) 테이블
 * - tenantId = null: 두골프 본사 데이터
 * - tenantId = 1~N: 각 파트너사 격리 데이터
 */
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  /** 파트너 온보딩 ID (partner_onboarding 테이블 참조) */
  onboardingId: int("onboardingId"),
  /** 파트너 ID (partners 테이블 참조) */
  partnerId: int("partnerId"),
  /** 테넌트 식별 슬러그 (URL 등에 사용) */
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  /** 업체명 */
  companyName: varchar("companyName", { length: 200 }).notNull(),
  /** 구독 플랜 */
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["starter", "standard", "premium"]).default("starter").notNull(),
  /** 구독 결제 주기 */
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly").notNull(),
  /** 구독 상태 */
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["trial", "active", "suspended", "cancelled"]).default("trial").notNull(),
  /** 구독 만료일 */
  subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
  /** Stripe 고객 ID */
  stripeCustomerId: varchar("stripeCustomerId", { length: 200 }),
  /** Stripe 구독 ID */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 200 }),
  /** 활성 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 샘플 데이터 카테고리 */
  sampleCategory: mysqlEnum("sampleCategory", ["golf_tour_domestic", "golf_tour_overseas", "golf_tour_mixed"]).default("golf_tour_mixed"),
  /** 샘플 데이터 시드 완료 여부 */
  sampleSeeded: boolean("sampleSeeded").default(false).notNull(),
  /** AI 크레딧 잔액 (1 크레딧 = 10,000 토큰 묶음) */
  aiCreditsBalance: int("aiCreditsBalance").default(10).notNull(),
  /** 월간 AI 크레딧 한도 (플랜별 기본값: starter=10, standard=50, premium=200) */
  aiCreditsMonthlyLimit: int("aiCreditsMonthlyLimit").default(10).notNull(),
  /** 이번 달 사용한 크레딧 */
  aiCreditsUsedThisMonth: int("aiCreditsUsedThisMonth").default(0).notNull(),
  /** 크레딧 월 초기화 기준 시각 */
  aiCreditsResetAt: timestamp("aiCreditsResetAt"),
  /** 업체 자체 OpenRouter API 키 (암호화 저장) */
  customOpenrouterKeyEncrypted: text("customOpenrouterKeyEncrypted"),
  /** 업체 자체 Gemini API 키 (암호화 저장) */
  customGeminiKeyEncrypted: text("customGeminiKeyEncrypted"),
  /** 메모 */
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ============================================================
// FILE ANALYSIS - AI 파일 직접 분석 (RAG 파이프라인)
// ============================================================
export const fileAnalysis = mysqlTable("file_analysis", {
  id: int("id").autoincrement().primaryKey(),
  /** 업로드한 사용자 ID */
  userId: int("userId").notNull(),
  /** 원본 파일명 */
  fileName: varchar("fileName", { length: 500 }).notNull(),
  /** S3 저장 키 */
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  /** S3 URL */
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  /** MIME 타입 (application/pdf, image/jpeg, ...) */
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  /** 파일 크기 (bytes) */
  fileSize: int("fileSize").notNull(),
  /** 추출된 텍스트 (최대 64KB) */
  extractedText: text("extractedText"),
  /** 추출 상태 */
  extractStatus: mysqlEnum("extractStatus", ["pending", "processing", "done", "failed"]).default("pending").notNull(),
  /** 추출 오류 메시지 */
  extractError: text("extractError"),
  /** 세션 ID (MasterAI 채팅 세션과 연결) */
  sessionId: varchar("sessionId", { length: 100 }),
  /** 파일 요약 (LLM이 생성) */
  summary: text("summary"),
  /** 분석 완료 여부 */
  analyzed: boolean("analyzed").default(false).notNull(),
  /** 파트너 테넌트 ID (파트너 파일 격리용) */
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FileAnalysis = typeof fileAnalysis.$inferSelect;
export type InsertFileAnalysis = typeof fileAnalysis.$inferInsert;

// ─── AI 능동적 알림 테이블 ─────────────────────────────────────────────────────
/**
 * AI 능동적 알림 테이블
 * 개발 완료, 배포, 주요 업데이트 시 AI가 자동으로 생성하는 알림
 */
export const aiNotifications = mysqlTable("ai_notifications", {
  id: int("id").autoincrement().primaryKey(),
  /** 알림 유형: dev_complete=개발완료, deploy=배포, feature=신기능, system=시스템 */
  type: mysqlEnum("type", ["dev_complete", "deploy", "feature", "system", "error"]).notNull().default("system"),
  /** 알림 제목 */
  title: varchar("title", { length: 200 }).notNull(),
  /** 알림 본문 (마크다운 지원) */
  body: text("body").notNull(),
  /** 연결된 개발 요청 ID (선택) */
  devRequestId: int("devRequestId"),
  /** 체크포인트 버전 ID (배포 알림 시) */
  checkpointVersionId: varchar("checkpointVersionId", { length: 50 }),
  /** 읽음 여부 */
  isRead: boolean("isRead").default(false).notNull(),
  /** 행동 유도 URL (예: /erp/dev-requests) */
  actionUrl: varchar("actionUrl", { length: 300 }),
  /** 행동 유도 레이블 (예: '새로고침', '기능 확인하기') */
  actionLabel: varchar("actionLabel", { length: 100 }),
  /** 알림 우선순위 */
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).default("medium").notNull(),
  /** 알림 생성 주체 (ai=AI 자동생성, system=시스템) */
  source: mysqlEnum("source", ["ai", "system", "manual"]).default("ai").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiNotification = typeof aiNotifications.$inferSelect;
export type InsertAiNotification = typeof aiNotifications.$inferInsert;

/**
 * AI 예약 작업 테이블 (ai_scheduled_tasks)
 * AI가 "15분 후 보고", "매일 오전 9시 요약" 등 시간 기반 작업을 예약하고 추적하는 테이블
 */
export const aiScheduledTasks = mysqlTable("ai_scheduled_tasks", {
  id: int("id").autoincrement().primaryKey(),
  /** 작업 유형: report=보고서 생성, reminder=리마인더, analysis=분석, custom=사용자 정의 */
  taskType: mysqlEnum("taskType", ["report", "reminder", "analysis", "custom"]).notNull().default("custom"),
  /** 작업 제목 (예: "15분 후 예약 현황 보고") */
  title: varchar("title", { length: 200 }).notNull(),
  /** AI에게 전달할 실행 프롬프트 */
  prompt: text("prompt").notNull(),
  /** 예약 실행 시각 (UTC) */
  scheduledAt: timestamp("scheduledAt").notNull(),
  /** 작업 상태: pending=대기, running=실행중, completed=완료, cancelled=취소, failed=실패 */
  status: mysqlEnum("status", ["pending", "running", "completed", "cancelled", "failed"]).notNull().default("pending"),
  /** 실행 결과 (AI 응답 텍스트) */
  result: text("result"),
  /** 오류 메시지 (실패 시) */
  errorMessage: varchar("errorMessage", { length: 500 }),
  /** 실제 실행 시각 */
  executedAt: timestamp("executedAt"),
  /** 등록한 사용자 ID */
  createdBy: int("createdBy"),
  /** 알림 전송 여부 (완료 시 ai_notifications 생성) */
  notifyOnComplete: boolean("notifyOnComplete").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiScheduledTask = typeof aiScheduledTasks.$inferSelect;
export type InsertAiScheduledTask = typeof aiScheduledTasks.$inferInsert;

// ─── AI 에이전트 승인 테이블 ──────────────────────────────────────────────────
/**
 * AI 에이전트 승인 요청 테이블 (ai_agent_approvals)
 * Human-in-the-Loop: AI가 외부 연동 등 민감한 작업 수행 전 관리자 승인을 요청하는 테이블
 */
export const aiAgentApprovals = mysqlTable("ai_agent_approvals", {
  id: int("id").autoincrement().primaryKey(),
  /** 대화 세션 ID */
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  /** 실행 요청 도구명 (예: web_search, fetch_url) */
  toolName: varchar("tool_name", { length: 100 }).notNull(),
  /** 도구 실행 인수 (JSON) */
  toolArgs: json("tool_args"),
  /** 실행 계획 설명 (AI가 작성한 한국어 설명) */
  planDescription: text("plan_description"),
  /** 승인 상태: pending=대기, approved=승인, rejected=거부, expired=만료 */
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).notNull().default("pending"),
  /** 요청한 사용자 ID */
  requestedBy: int("requested_by"),
  /** 승인/거부한 관리자 ID */
  approvedBy: int("approved_by"),
  /** 거부 사유 */
  rejectionReason: text("rejection_reason"),
  /** 만료 시각 (기본 5분) */
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AiAgentApproval = typeof aiAgentApprovals.$inferSelect;
export type InsertAiAgentApproval = typeof aiAgentApprovals.$inferInsert;

// ─── AI 세션 상태 테이블 ──────────────────────────────────────────────────────
/**
 * AI 세션 상태 관리 테이블 (ai_session_state)
 * 대화 세션 내에서 API 키, 인증 토큰 등 외부 연동 정보를 임시 저장
 * 세션 종료 시 만료 처리 (is_sensitive=true 항목은 만료 후 즉시 삭제)
 */
export const aiSessionState = mysqlTable("ai_session_state", {
  id: int("id").autoincrement().primaryKey(),
  /** 대화 세션 ID */
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  /** 상태 키 (예: github_token, search_context) */
  stateKey: varchar("state_key", { length: 200 }).notNull(),
  /** 상태 값 (텍스트, JSON 문자열 등) */
  stateValue: text("state_value"),
  /** 민감 정보 여부 (true이면 만료 후 즉시 삭제) */
  isSensitive: boolean("is_sensitive").default(false).notNull(),
  /** 만료 시각 (null이면 세션 종료 시까지) */
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiSessionState = typeof aiSessionState.$inferSelect;
export type InsertAiSessionState = typeof aiSessionState.$inferInsert;

// ============================================================
// PARTNER_STAFF - 파트너사 하위 담당자
// ============================================================
/**
 * 파트너사(여행사)의 하위 담당자 계정 테이블
 * - 파트너 승인 후 대표자가 하위 담당자를 등록하여 ERP 접근 권한 부여
 * - 하위 담당자는 별도 로그인 ID/PW로 파트너 ERP에 접근
 */
export const partnerStaff = mysqlTable("partner_staff", {
  id: int("id").autoincrement().primaryKey(),
  /** 소속 파트너 ID (partners 테이블 참조) */
  partnerId: int("partnerId").notNull(),
  /** 파트너 온보딩 ID (partner_onboarding 테이블 참조) */
  onboardingId: int("onboardingId"),
  /** 담당자명 */
  name: varchar("name", { length: 100 }).notNull(),
  /** 이메일 */
  email: varchar("email", { length: 320 }),
  /** 전화번호 */
  phone: varchar("phone", { length: 30 }),
  /** 직책 (예: 팀장, 과장, 대리 등 자유 입력) */
  position: varchar("position", { length: 50 }),
  /** 역할: manager(팀장) | staff(일반 담당자) */
  role: mysqlEnum("role", ["manager", "staff"]).default("staff").notNull(),
  /** 로그인 ID (이메일 또는 아이디) */
  loginId: varchar("loginId", { length: 100 }).notNull().unique(),
  /** 로그인 PW (bcrypt 해시) */
  loginPwHash: varchar("loginPwHash", { length: 255 }).notNull(),
  /** 활성 상태 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 메모 */
  memo: text("memo"),
  /** 마지막 로그인 시각 */
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PartnerStaff = typeof partnerStaff.$inferSelect;
export type InsertPartnerStaff = typeof partnerStaff.$inferInsert;

// ============================================================
// PARTNER_STAFF_PASSWORD_RESET - 하위 담당자 비밀번호 재설정 토큰
// ============================================================
export const partnerStaffPasswordReset = mysqlTable("partner_staff_password_reset", {
  id: int("id").autoincrement().primaryKey(),
  /** 담당자 ID (partner_staff 테이블 참조) */
  staffId: int("staffId").notNull(),
  /** 재설정 토큰 (랜덤 128자) */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** 만료 시각 (기본 30분) */
  expiresAt: timestamp("expiresAt").notNull(),
  /** 사용 완료 시각 */
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PartnerStaffPasswordReset = typeof partnerStaffPasswordReset.$inferSelect;
export type InsertPartnerStaffPasswordReset = typeof partnerStaffPasswordReset.$inferInsert;


// ============================================================
// ADMIN_ACCOUNTS - CRM 마스터 관리자 계정 관리
// ============================================================
/**
 * CRM 마스터 관리자 계정 테이블
 * - 기존 OAuth 로그인 외에 username/password 기반 로그인 지원
 * - 마스터 관리자만 신규 계정 생성 가능
 * - 각 계정은 동등한 권한 보유 (admin 역할)
 */
export const adminAccounts = mysqlTable("admin_accounts", {
  id: int("id").autoincrement().primaryKey(),
  /** 관리자 로그인 ID (username) */
  username: varchar("username", { length: 100 }).notNull().unique(),
  /** 비밀번호 (bcrypt 해시) */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  /** 관리자 이름 */
  name: varchar("name", { length: 100 }),
  /** 이메일 */
  email: varchar("email", { length: 320 }),
  /** 전화번호 */
  phone: varchar("phone", { length: 30 }),
  /** 역할: admin(일반 관리자) | master(마스터 관리자) */
  role: mysqlEnum("role", ["admin", "master"]).default("admin").notNull(),
  /** 활성 상태 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 계정 생성자 ID (admin_accounts 테이블 참조) */
  createdBy: int("createdBy"),
  /** 마지막 로그인 시각 */
  lastLoginAt: timestamp("lastLoginAt"),
  /** 메모 */
  memo: text("memo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminAccount = typeof adminAccounts.$inferSelect;
export type InsertAdminAccount = typeof adminAccounts.$inferInsert;

/**
 * 관리자 세션 (서버 재시작·다중 서버 환경에서도 로그인 유지)
 * 기존 인메모리 Map을 DB로 이전하여 서버 이전 시에도 세션 존속.
 */
export const adminSessions = mysqlTable("admin_sessions", {
  /** 세션 ID (쿠키에 저장되는 토큰) */
  sessionId: varchar("sessionId", { length: 100 }).primaryKey(),
  /** 관리자 계정 ID */
  adminId: int("adminId").notNull(),
  /** 로그인 ID (username) */
  username: varchar("username", { length: 100 }).notNull(),
  /** 역할: admin | master */
  role: varchar("role", { length: 20 }).notNull(),
  /** 로그인 시각 (Unix ms) */
  loginTime: bigint("loginTime", { mode: "number" }).notNull(),
  /** 마지막 활동 시각 (Unix ms) */
  lastActivity: bigint("lastActivity", { mode: "number" }).notNull(),
  /** 만료 시각 (Unix ms) — 조회 인덱스용 */
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = typeof adminSessions.$inferInsert;

/**
 * ERP API 키 설정 테이블
 * - Manus 환경변수와 독립적으로 ERP DB에 API 키 저장
 * - master 역할 계정만 수정 가능
 * - 저장된 키가 있으면 환경변수보다 우선 사용
 */
export const erpApiSettings = mysqlTable("erp_api_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** 서비스 키 식별자 (예: openrouter, gemini, kakao 등) */
  serviceKey: varchar("serviceKey", { length: 100 }).notNull().unique(),
  /** 서비스 이름 (표시용) */
  serviceName: varchar("serviceName", { length: 200 }).notNull(),
  /** 암호화된 API 키 값 */
  apiKeyEncrypted: text("apiKeyEncrypted"),
  /** API 키 마스킹 표시용 (앞 4자 + ... + 뒤 4자) */
  apiKeyMasked: varchar("apiKeyMasked", { length: 50 }),
  /** 추가 설정값 (JSON) */
  extraConfig: text("extraConfig"),
  /** 활성화 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 마지막 수정자 */
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ErpApiSetting = typeof erpApiSettings.$inferSelect;
export type InsertErpApiSetting = typeof erpApiSettings.$inferInsert;

/**
 * 타 데스크 지식 차단 로그 테이블
 * - AI가 타 데스크 지식을 감지하고 차단한 이력을 기록
 * - ERP 서버 레벨에서 직접 관리하는 독립 차단 시스템
 */
export const knowledgeBlockLogs = mysqlTable("knowledge_block_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 차단된 지식 이름 */
  knowledgeName: varchar("knowledgeName", { length: 300 }).notNull(),
  /** 차단 이유 (감지된 키워드 또는 패턴) */
  blockReason: text("blockReason"),
  /** 차단 유형: auto(자동감지) | manual(수동등록) */
  blockType: mysqlEnum("blockType", ["auto", "manual"]).default("auto").notNull(),
  /** 차단 출체 데스크 (추정) */
  sourceDeskHint: varchar("sourceDeskHint", { length: 200 }),
  /** 세션 ID (어느 세션에서 감지되었는지) */
  sessionId: varchar("sessionId", { length: 100 }),
  /** 어느 업체에서 발생한 차단인지 (null = 마스터 레벨) */
  tenantId: int("tenantId"),
  /** 차단 처리 여부 */
  isBlocked: boolean("isBlocked").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeBlockLog = typeof knowledgeBlockLogs.$inferSelect;
export type InsertKnowledgeBlockLog = typeof knowledgeBlockLogs.$inferInsert;

/**
 * 타 데스크 지식 차단 규칙 테이블
 * - 마스터가 직접 차단 규칙을 추가/관리
 * - ERP DB에 저장되어 Manus 플랫폼과 독립적으로 동작
 */
export const knowledgeBlockRules = mysqlTable("knowledge_block_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** 차단 규칙 이름 */
  ruleName: varchar("ruleName", { length: 300 }).notNull(),
  /** 차단 키워드 (쉼표 구분) */
  keywords: text("keywords").notNull(),
  /** 차단 이유 설명 */
  description: text("description"),
  /** 활성화 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /**
   * 테넌트 ID (null = 마스터 전역 규칙, 값 있음 = 해당 업체 전용 규칙)
   * 전역 규칙은 모든 업체 LLM에 적용, 업체 규칙은 해당 업체 LLM에만 적용
   */
  tenantId: int("tenantId"),
  /** 등록자 */
  createdBy: varchar("createdBy", { length: 100 }).default("master"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KnowledgeBlockRule = typeof knowledgeBlockRules.$inferSelect;
export type InsertKnowledgeBlockRule = typeof knowledgeBlockRules.$inferInsert;

/**
 * 이미지 아카이브 로그 테이블
 * - 카카오워크 봇이 처리한 이미지 로그를 기록
 * - Google Drive 파일 ID 및 링크 저장
 * - 관리자가 직접 선택하여 Google Drive 원본 파일 삭제 가능
 */
export const imageArchiveLogs = mysqlTable("image_archive_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Google Drive 파일 ID */
  driveFileId: varchar("driveFileId", { length: 200 }).notNull(),
  /** 파일명 */
  fileName: varchar("fileName", { length: 500 }).notNull(),
  /** Google Drive 공유 링크 */
  driveUrl: text("driveUrl").notNull(),
  /** 파일 크기 (bytes) */
  fileSize: int("fileSize"),
  /** MIME 타입 */
  mimeType: varchar("mimeType", { length: 100 }),
  /** 출처 (kakaowork, manual, api 등) */
  source: varchar("source", { length: 100 }).default("kakaowork").notNull(),
  /** 출처 상세 (봇 이름, 채널명 등) */
  sourceDetail: varchar("sourceDetail", { length: 300 }),
  /** 처리 완료 시각 */
  processedAt: timestamp("processedAt").defaultNow().notNull(),
  /** 삭제 여부 */
  isDeleted: boolean("isDeleted").default(false).notNull(),
  /** Google Drive 삭제 완료 시각 */
  deletedAt: timestamp("deletedAt"),
  /** 삭제 처리한 관리자 */
  deletedBy: varchar("deletedBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ImageArchiveLog = typeof imageArchiveLogs.$inferSelect;
export type InsertImageArchiveLog = typeof imageArchiveLogs.$inferInsert;

/**
 * Manus 웹훅 수신 로그 테이블 [ID: 700001]
 * - Manus API에서 발송하는 웹훅 이벤트를 수신하여 저장
 * - 개발 요청 완료, 진행 메시지 등 Manus 에이전트 활동 기록
 */
export const manusWebhookLogs = mysqlTable("manus_webhook_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus Task ID */
  taskId: varchar("taskId", { length: 200 }),
  /** 이벤트 유형 (task_stopped, message_added, task_created 등) */
  eventType: varchar("eventType", { length: 100 }).notNull(),
  /** 메시지 내용 (Manus 에이전트가 남긴 텍스트) */
  content: text("content"),
  /** 역할 (assistant, user, system) */
  role: varchar("role", { length: 50 }).default("assistant"),
  /** 연결된 개발 요청 ID (있는 경우) */
  devRequestId: int("devRequestId"),
  /** 원본 웹훅 페이로드 (JSON) */
  rawPayload: text("rawPayload"),
  /** 웹훅 서명 검증 통과 여부 */
  isVerified: boolean("isVerified").default(false).notNull(),
  /** 수신 시각 */
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ManusWebhookLog = typeof manusWebhookLogs.$inferSelect;
export type InsertManusWebhookLog = typeof manusWebhookLogs.$inferInsert;

// ============================================================
// TENANT_AI_CREDITS - 테넌트 AI 크레딧 충전 이력
// ============================================================
/**
 * 분양 업체의 AI 크레딧 충전/차감 이력 테이블
 * - 충전: 두골프 관리자가 수동 지급 또는 결제 완료 시 자동 지급
 * - 차감: AI 호출 시 creditGateway 미들웨어가 자동 차감
 */
export const tenantAiCredits = mysqlTable("tenant_ai_credits", {
  id: int("id").autoincrement().primaryKey(),
  /** 테넌트 ID */
  tenantId: int("tenantId").notNull(),
  /** 변동 유형: charge=충전, deduct=차감, refund=환불, monthly_reset=월초기화 */
  type: mysqlEnum("type", ["charge", "deduct", "refund", "monthly_reset"]).notNull(),
  /** 변동 크레딧 수 (양수=충전, 음수=차감) */
  amount: int("amount").notNull(),
  /** 변동 후 잔액 */
  balanceAfter: int("balanceAfter").notNull(),
  /** 충전 금액 (원화, 충전 시에만) */
  paidAmountKrw: int("paidAmountKrw"),
  /** 관련 AI 호출 로그 ID (차감 시) */
  aiCostLogId: int("aiCostLogId"),
  /** 메모 (관리자 수동 지급 사유 등) */
  memo: text("memo"),
  /** 처리한 관리자 ID */
  processedBy: int("processedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TenantAiCredit = typeof tenantAiCredits.$inferSelect;
export type InsertTenantAiCredit = typeof tenantAiCredits.$inferInsert;

// ============================================================
// TENANT_API_CONNECTIONS - 테넌트 외부 API 연결 관리
// ============================================================
/**
 * 분양 업체가 연결한 외부 API 정보
 * - API 키는 암호화하여 저장
 * - 두골프 매니저 AI가 연결된 API를 분석하여 개발 요청 생성
 */
export const tenantApiConnections = mysqlTable("tenant_api_connections", {
  id: int("id").autoincrement().primaryKey(),
  /** 테넌트 ID */
  tenantId: int("tenantId").notNull(),
  /** API 서비스명 (예: kakao, naver, google, portone, custom) */
  serviceName: varchar("serviceName", { length: 100 }).notNull(),
  /** API 서비스 표시명 */
  serviceLabel: varchar("serviceLabel", { length: 200 }),
  /** API 키 (암호화 저장) */
  apiKeyEncrypted: text("apiKeyEncrypted"),
  /** API 시크릿 (암호화 저장) */
  apiSecretEncrypted: text("apiSecretEncrypted"),
  /** 추가 설정 JSON (엔드포인트, 버전 등) */
  configJson: text("configJson"),
  /** 연결 상태 */
  status: mysqlEnum("status", ["active", "error", "pending", "disabled"]).default("pending").notNull(),
  /** 마지막 연결 테스트 시각 */
  lastTestedAt: timestamp("lastTestedAt"),
  /** 마지막 오류 메시지 */
  lastError: text("lastError"),
  /** 두골프 매니저 AI 분석 메모 */
  aiAnalysisMemo: text("aiAnalysisMemo"),
  /** 활성 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TenantApiConnection = typeof tenantApiConnections.$inferSelect;
export type InsertTenantApiConnection = typeof tenantApiConnections.$inferInsert;

// ============================================================
// TENANT_API_DEV_REQUESTS - 테넌트 외부 API 개발 승인 요청
// ============================================================
/**
 * 분양 업체의 외부 API 연결 기반 개발 요청 관리
 * 플로우: 업체 API 연결 → 두골프 매니저 AI 분석 → 가능성 분류 → 마스터 승인 → 개발 진행 → 업체 안내
 */
export const tenantApiDevRequests = mysqlTable("tenant_api_dev_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** 요청 업체 테넌트 ID */
  tenantId: int("tenantId").notNull(),
  /** 연결된 외부 API 연결 ID */
  apiConnectionId: int("apiConnectionId"),
  /** 요청 제목 */
  title: varchar("title", { length: 300 }).notNull(),
  /** 업체 요청 내용 */
  requestContent: text("requestContent").notNull(),
  /** 두골프 매니저 AI 분석 결과 */
  aiAnalysis: text("aiAnalysis"),
  /** 개발 가능성 분류: possible=가능, conditional=조건부가능, impossible=불가, global=전체업체개선 */
  feasibility: mysqlEnum("feasibility", ["possible", "conditional", "impossible", "global"]).default("possible"),
  /** 전체 업체 공통 개선 여부 (global인 경우 true) */
  isGlobalImprovement: boolean("isGlobalImprovement").default(false).notNull(),
  /** 마스터 승인 상태 */
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected", "in_progress", "completed"]).default("pending").notNull(),
  /** 마스터 승인/거부 메모 */
  approvalMemo: text("approvalMemo"),
  /** 승인한 관리자 ID */
  approvedBy: int("approvedBy"),
  /** 승인 시각 */
  approvedAt: timestamp("approvedAt"),
  /** 개발 완료 시각 */
  completedAt: timestamp("completedAt"),
  /** 업체 안내 발송 여부 */
  notifiedTenant: boolean("notifiedTenant").default(false).notNull(),
  /** 업체 안내 발송 시각 */
  notifiedAt: timestamp("notifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TenantApiDevRequest = typeof tenantApiDevRequests.$inferSelect;
export type InsertTenantApiDevRequest = typeof tenantApiDevRequests.$inferInsert;

// ============================================================
// TENANT_CREDIT_REQUESTS - 테넌트 크레딧 충전 요청
// ============================================================
/**
 * 분양 업체의 크레딧 충전 요청 테이블
 * - requestType: pg=PG결제(추후 연동), manual=수동입금(오너 확인 후 부여)
 * - status: pending=대기, approved=승인(크레딧 부여됨), rejected=거부
 */
export const tenantCreditRequests = mysqlTable("tenant_credit_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** 요청 테넌트 ID */
  tenantId: int("tenantId").notNull(),
  /** 요청 유형: pg=PG결제, manual=수동입금 */
  requestType: mysqlEnum("requestType", ["pg", "manual"]).default("manual").notNull(),
  /** 충전 패키지 ID (50/100/200 크레딧) */
  packageId: varchar("packageId", { length: 50 }).notNull(),
  /** 충전 크레딧 수 */
  credits: int("credits").notNull(),
  /** 결제 금액 (원화) */
  amountKrw: int("amountKrw").notNull(),
  /** 요청 상태 */
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  /** PG 결제 ID (pg 타입 시) */
  pgPaymentId: varchar("pgPaymentId", { length: 200 }),
  /** 입금자명 (manual 타입 시 파트너가 입력) */
  depositorName: varchar("depositorName", { length: 100 }),
  /** 입금 메모 (파트너가 입력) */
  depositMemo: text("depositMemo"),
  /** 관리자 처리 메모 (승인/거부 사유) */
  adminNote: text("adminNote"),
  /** 승인한 관리자 ID */
  approvedBy: int("approvedBy"),
  /** 승인/거부 처리 시각 */
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TenantCreditRequest = typeof tenantCreditRequests.$inferSelect;
export type InsertTenantCreditRequest = typeof tenantCreditRequests.$inferInsert;


// ============================================================
// AI DEV ENGINE — 서버 내장 Git 엔진 오케스트레이션 메타데이터
// (소스 본체/Diff는 Git이 관리, DB는 통계·상태·SHA 인덱스만 보관)
// 사양 근거: docs/step_specs_extracted.md (STEP 1)
// ============================================================

/**
 * ai_dev_requests — 에이전트 개발요청·상태 추적 마스터 테이블
 * agent_id: master_engine / manager_engine / golftalk_engine / assistant_engine
 */
export const aiDevRequests = mysqlTable("ai_dev_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** 멀티테넌트 추적: 어느 테넌트의 개발인지 (두골프=1, 기본값) */
  tenantId: int("tenantId").default(1).notNull(),
  /** [일원화 연결고리] 원본 개발요청(dev_requests.id) 역참조 — 요청원장↔엔진라이프사이클 연결 */
  devRequestId: int("devRequestId"),
  /** 개발 파이프라인 출처: manus(마누스) / engine(자체 changeset) / manual(직접편집) / system */
  devSource: mysqlEnum("devSource", ["manus", "engine", "manual", "system"]).default("manus").notNull(),
  /** 요청 수행 에이전트 식별자 */
  agentId: varchar("agentId", { length: 50 }).notNull(),
  /** 소스 브랜치 (기본 dev-1) */
  sourceBranch: varchar("sourceBranch", { length: 100 }).default("dev-1").notNull(),
  /** 타깃 브랜치 (기본 dev-2-integration) */
  targetBranch: varchar("targetBranch", { length: 100 }).default("dev-2-integration").notNull(),
  /** 라이프사이클 상태 머신 */
  status: mysqlEnum("status", [
    "INIT",
    "CODE_GENERATED",
    "INTEGRITY_PASSED",
    "INTEGRITY_FAILED",
    "INTEGRATED",
    "MASTER_APPROVED",
    "MASTER_REJECTED",
  ]).default("INIT").notNull(),
  /** 커밋 메시지 (요청 단위 요약) */
  commitMessage: varchar("commitMessage", { length: 1000 }),
  /** 정합성 실패 또는 API 연동 실패 시 원인 레포트 */
  errorMessage: text("errorMessage"),
  /** 자가점검 요약 보고서 (마스터 TODO 레이어 표출용) */
  auditSummary: text("auditSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiDevRequest = typeof aiDevRequests.$inferSelect;
export type InsertAiDevRequest = typeof aiDevRequests.$inferInsert;

/**
 * ai_dev_request_files — 변경 파일 메타 통계 (Diff 문자열 미저장)
 */
export const aiDevRequestFiles = mysqlTable("ai_dev_request_files", {
  id: int("id").autoincrement().primaryKey(),
  /** ai_dev_requests.id 참조 */
  requestId: int("requestId").notNull(),
  /** 수정된 파일의 상대 경로 */
  filePath: varchar("filePath", { length: 500 }).notNull(),
  /** 변경 유형 */
  changeType: mysqlEnum("changeType", ["ADD", "MODIFY", "DELETE"]).notNull(),
  /** 추가 라인 수 통계 */
  additions: int("additions").default(0).notNull(),
  /** 삭제 라인 수 통계 */
  deletions: int("deletions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiDevRequestFile = typeof aiDevRequestFiles.$inferSelect;
export type InsertAiDevRequestFile = typeof aiDevRequestFiles.$inferInsert;

/**
 * ai_git_commits — GitHub 커밋 연동 메타 (commit_sha = PK)
 */
export const aiGitCommits = mysqlTable("ai_git_commits", {
  commitSha: varchar("commitSha", { length: 40 }).primaryKey(),
  /** ai_dev_requests.id 참조 */
  requestId: int("requestId").notNull(),
  /** 커밋 작성 주체 (서버 엔진 고정) */
  authorName: varchar("authorName", { length: 100 }).default("DuGolf-Server-Engine").notNull(),
  /** 커밋 메시지 */
  commitMessage: varchar("commitMessage", { length: 1000 }).notNull(),
  /** 커밋이 적재된 브랜치 */
  branch: varchar("branch", { length: 100 }).default("dev-1").notNull(),
  committedAt: timestamp("committedAt").defaultNow().notNull(),
});
export type AiGitCommit = typeof aiGitCommits.$inferSelect;
export type InsertAiGitCommit = typeof aiGitCommits.$inferInsert;


// ============================================================
// GIT_ROLLBACK_LOGS - 자체 Git 롤백 감사 이력 (마누스 비종속 롤백)
// 누가/언제/어떤 브랜치를 어느 커밋 시점으로 되돌렸는지 추적
// ============================================================
export const gitRollbackLogs = mysqlTable("git_rollback_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 롤백 대상 브랜치 (dev-1 | dev-2-integration) */
  branch: varchar("branch", { length: 100 }).notNull(),
  /** 되돌릴 대상(이 시점으로 복원) 커밋 SHA */
  targetSha: varchar("targetSha", { length: 40 }).notNull(),
  /** 롤백 직전 HEAD 커밋 SHA (되돌리기 전 상태 기록) */
  previousHeadSha: varchar("previousHeadSha", { length: 40 }),
  /** 롤백으로 새로 생성된 '되돌림 커밋' SHA */
  newCommitSha: varchar("newCommitSha", { length: 40 }),
  /** 롤백 사유 (마스터 입력) */
  reason: text("reason"),
  /** 성공 여부 */
  success: boolean("success").default(true).notNull(),
  /** 실패 시 에러 메시지 */
  errorMessage: text("errorMessage"),
  /** 실행 주체 user.id */
  performedBy: int("performedBy"),
  /** 실행 주체 이름 (감사 가독성) */
  performedByName: varchar("performedByName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GitRollbackLog = typeof gitRollbackLogs.$inferSelect;
export type InsertGitRollbackLog = typeof gitRollbackLogs.$inferInsert;


// ============================================================
// DEPLOY_LOGS - 자체 배포 실행 이력 (외부서버 빌드·재시작 트리거 감사)
// 마누스 유무와 무관하게 "언제 누가 무엇을 배포했는가"를 영구 기록
// ============================================================
export const deployLogs = mysqlTable("deploy_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 멀티테넌트: 어느 테넌트 대상 배포인가 (두골프=1) */
  tenantId: int("tenantId").default(1).notNull(),
  /** 연관된 개발요청 id (ai_dev_requests.id, 선택) */
  requestId: int("requestId"),
  /** 배포 단계: pull / build / restart / full(전체) */
  phase: mysqlEnum("phase", ["pull", "build", "restart", "full"]).notNull(),
  /** 배포 대상 커밋 SHA (선택) */
  commitSha: varchar("commitSha", { length: 40 }),
  /** 성공 여부 */
  success: boolean("success").default(false).notNull(),
  /** 실행 출력/에러 요약 (앞 4000자) */
  outputSummary: text("outputSummary"),
  /** 소요 시간(ms) */
  durationMs: int("durationMs"),
  /** 실행 주체 user.id */
  performedBy: int("performedBy"),
  /** 실행 주체 이름 */
  performedByName: varchar("performedByName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DeployLog = typeof deployLogs.$inferSelect;
export type InsertDeployLog = typeof deployLogs.$inferInsert;


// ============================================================
// PARTNER_EMAIL_LOGS - 파트너 이메일 발송 로그 (메타데이터 전용)
// ============================================================
/**
 * 이메일 발송 메타데이터만 경량 저장한다. (본문은 저장하지 않음 - 용량 절약)
 * 발송 성공/실패 여부와 감사 추적용.
 */
export const partnerEmailLogs = mysqlTable("partner_email_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** 관련 파트너 온보딩 ID (있으면) */
  onboardingId: int("onboardingId"),
  /** 수신자 이메일 */
  receiverEmail: varchar("receiverEmail", { length: 255 }).notNull(),
  /** 메일 종류: welcome(환영) / approved(승인) / rejected(거부) / test(테스트) / custom */
  emailType: varchar("emailType", { length: 30 }).notNull(),
  /** 제목 */
  subject: varchar("subject", { length: 300 }).notNull(),
  /** 발송 상태: sent / failed */
  status: varchar("status", { length: 20 }).notNull(),
  /** SMTP messageId (성공 시) */
  messageId: varchar("messageId", { length: 300 }),
  /** 실패 사유 (실패 시) */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PartnerEmailLog = typeof partnerEmailLogs.$inferSelect;
export type InsertPartnerEmailLog = typeof partnerEmailLogs.$inferInsert;

// ============================================================
// PARTNER_STAFF_PERMISSIONS - 담당자별 기능 권한 관리
// ============================================================
/**
 * 파트너사 담당자(partnerStaff)별 기능 권한 관리 테이블
 * - 파트너대표(manager)가 담당자별 기능 ON/OFF 설정 가능
 * - 기본값: 모든 담당자 모든 기능 enabled=true
 * - 기능 추가 시 이 테이블에 행 추가 (없으면 enabled=true로 간주)
 *
 * 기능 목록:
 * - 'package_auto_create' : 상품 자동생성 (파일업로드→AI분석→초안생성)
 * - 'package_approve'     : 상품 승인/배포 (초안→활성화)
 * - 'marketing_auto'      : 마케팅 문구 자동화
 * - 'inquiry_auto'        : 문의 자동 답변
 * - 'ai_chat'             : AI 채팅 (AI파트너매니저)
 * - 'data_analysis'       : 데이터 분석
 * - 'file_analysis'       : 파일 분석 이력 조회
 */
export const partnerStaffPermissions = mysqlTable("partner_staff_permissions", {
  id: int("id").autoincrement().primaryKey(),
  /** 소속 파트너 테넌트 ID */
  tenantId: int("tenantId").notNull(),
  /** 담당자 ID (partner_staff.id 참조) */
  staffId: int("staffId").notNull(),
  /** 기능 식별자 */
  feature: varchar("feature", { length: 100 }).notNull(),
  /** 기능 활성화 여부 (기본값 true) */
  enabled: boolean("enabled").notNull().default(true),
  /** 설정 변경한 담당자 ID (파트너대표 또는 위임된 담당자) */
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PartnerStaffPermission = typeof partnerStaffPermissions.$inferSelect;
export type InsertPartnerStaffPermission = typeof partnerStaffPermissions.$inferInsert;

// ============================================================
// 업체·직원 관리 수정권한 테이블
// ============================================================
/**
 * company_manage_permissions
 * - 업체·직원 관리 페이지의 수정권한자 지정
 * - 기본: 모든 직원 뷰어(조회만 가능)
 * - 수정권한자 지정 시 해당 직원만 수정 가능 (중복 지정 허용)
 * - 오너(partner_owner)는 항상 수정 가능 (이 테이블과 무관)
 * - grantedBy: 권한을 부여한 담당자 ID (null이면 오너가 직접 부여)
 */
export const companyManagePermissions = mysqlTable("company_manage_permissions", {
  id: int("id").autoincrement().primaryKey(),
  /** 소속 테넌트 ID */
  tenantId: int("tenantId").notNull(),
  /** 수정권한을 부여받은 담당자 ID (partner_staff.id) */
  staffId: int("staffId").notNull(),
  /** 수정권한 활성화 여부 */
  canEdit: boolean("canEdit").notNull().default(true),
  /** 권한을 부여한 담당자 ID (null이면 오너가 직접 부여) */
  grantedBy: int("grantedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanyManagePermission = typeof companyManagePermissions.$inferSelect;
export type InsertCompanyManagePermission = typeof companyManagePermissions.$inferInsert;
