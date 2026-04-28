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
  bookedSlots: int("bookedSlots").default(0),
  status: mysqlEnum("status", ["open", "closed", "sold_out"]).default("open"),
  priceOverride: decimal("priceOverride", { precision: 12, scale: 0 }),
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
// MODEL_ROUTING_RULES - 태스크별 AI 모델 라우팅 규칙
// ============================================================
export const modelRoutingRules = mysqlTable("model_routing_rules", {
  id: int("id").autoincrement().primaryKey(),
  /** 태스크 유형 */
  taskType: varchar("taskType", { length: 50 }).notNull().unique(),
  /** 기본 모델 (예: gemini-2.5-flash) */
  primaryModel: varchar("primaryModel", { length: 100 }).notNull(),
  /** 폴백 모델 */
  fallbackModel: varchar("fallbackModel", { length: 100 }),
  /** 최대 토큰 수 */
  maxTokens: int("maxTokens").default(2048),
  /** 온도 (0.0~1.0) */
  temperature: varchar("temperature", { length: 10 }).default("0.7"),
  /** 캐시 TTL (초, 0=캐시 없음) */
  cacheTtlSeconds: int("cacheTtlSeconds").default(0),
  /** 활성화 여부 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 설명 */
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ModelRoutingRule = typeof modelRoutingRules.$inferSelect;
export type InsertModelRoutingRule = typeof modelRoutingRules.$inferInsert;;

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
  /** 요청 출처 */
  source: mysqlEnum("source", ["manual", "auto_cycle", "master_ai"]).default("manual"),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiLog = typeof aiLogs.$inferSelect;
export type InsertAiLog = typeof aiLogs.$inferInsert;

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
  /** 메모 */
  memo: text("memo"),
  /** 활성 상태 */
  isActive: boolean("isActive").default(true).notNull(),
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
  /** 카테고리 (golf_booking | accommodation | transport | general) */
  category: mysqlEnum("category", ["golf_booking", "accommodation", "transport", "general"]).default("golf_booking"),
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
