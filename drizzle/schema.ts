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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiInteractionLog = typeof aiInteractionLogs.$inferSelect;
export type InsertAiInteractionLog = typeof aiInteractionLogs.$inferInsert;

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
