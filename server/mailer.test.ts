import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── nodemailer mock (실제 SMTP 통신 차단) ───────────────
const h = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  verifyMock: vi.fn(),
  closeMock: vi.fn(),
  getApiKeyFreshMock: vi.fn(),
  getApiConfigMock: vi.fn(),
}));
const { sendMailMock, verifyMock, closeMock, getApiKeyFreshMock, getApiConfigMock } = h;
const createTransportMock = vi.fn(() => ({
  sendMail: h.sendMailMock,
  verify: h.verifyMock,
  close: h.closeMock,
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: (...a: any[]) => createTransportMock(...a) },
}));

vi.mock("./erpApiKeyManager", () => ({
  getApiKeyFresh: (...a: any[]) => h.getApiKeyFreshMock(...a),
  getApiConfig: (...a: any[]) => h.getApiConfigMock(...a),
}));

import {
  resolveSmtpConfig,
  sendMail,
  verifySmtp,
  SMTP_SERVICE_KEY,
} from "./mailer";

beforeEach(() => {
  vi.clearAllMocks();
  // ENV 폴백 제거 → DB 조회 결과만으로 판정되도록
  delete process.env.GOOGLE_APP_PASSWORD;
  delete process.env.GOOGLE_SMTP_USER;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
});

describe("resolveSmtpConfig — 실시간 조회 + 복호화 결합", () => {
  it("비밀번호는 캐시 우회(getApiKeyFresh)로 조회한다", async () => {
    getApiKeyFreshMock.mockResolvedValue("app-password-1234");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com" });

    await resolveSmtpConfig();

    // 매번 최신 비밀번호 반영을 위해 fresh 조회를 사용해야 함
    expect(getApiKeyFreshMock).toHaveBeenCalledWith(SMTP_SERVICE_KEY);
  });

  it("user/from/host/port를 extraConfig로 해석하고 465는 secure=true", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com", port: "465" });

    const cfg = await resolveSmtpConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.user).toBe("tour@dayoutgolf.com");
    expect(cfg!.from).toBe("tour@dayoutgolf.com"); // from 미지정 → user
    expect(cfg!.host).toBe("smtp.gmail.com"); // 기본값
    expect(cfg!.port).toBe(465);
    expect(cfg!.secure).toBe(true);
  });

  it("587 포트는 secure=false(STARTTLS)로 해석한다", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "u@x.com", port: "587" });

    const cfg = await resolveSmtpConfig();
    expect(cfg!.port).toBe(587);
    expect(cfg!.secure).toBe(false);
  });

  it("from 명시 시 발송 계정과 다른 발신 주소를 사용한다", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com", from: "noreply@dayoutgolf.com" });

    const cfg = await resolveSmtpConfig();
    expect(cfg!.from).toBe("noreply@dayoutgolf.com");
  });

  it("비밀번호가 없으면 null(가드) — user만 있어도 발송 불가", async () => {
    getApiKeyFreshMock.mockResolvedValue("");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com" });

    expect(await resolveSmtpConfig()).toBeNull();
  });

  it("user가 없으면 null(가드)", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({});

    expect(await resolveSmtpConfig()).toBeNull();
  });
});

describe("sendMail — 일회성 transporter 생성/발송/휘발", () => {
  it("설정 누락 시 예외 없이 success=false 반환(호출부 비차단)", async () => {
    getApiKeyFreshMock.mockResolvedValue("");
    getApiConfigMock.mockResolvedValue({});

    const r = await sendMail({ to: "a@b.com", subject: "s", html: "<p>x</p>" });
    expect(r.success).toBe(false);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("정상 발송 시 transporter를 생성하고 발송 후 close로 휘발한다", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com", port: "465" });
    sendMailMock.mockResolvedValue({ messageId: "<mid-1>" });

    const r = await sendMail({ to: "a@b.com", subject: "제목", html: "<p>본문</p>" });

    expect(r.success).toBe(true);
    expect(r.messageId).toBe("<mid-1>");
    expect(createTransportMock).toHaveBeenCalledTimes(1);
    // 발송 시점에만 transporter 생성 → 일회성
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("replyTo 미지정 시 from으로 회신 주소를 설정한다", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com", from: "from@x.com" });
    sendMailMock.mockResolvedValue({ messageId: "<mid>" });

    await sendMail({ to: "a@b.com", subject: "s", html: "<p>x</p>" });

    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.replyTo).toBe("from@x.com");
    expect(arg.from).toBe("from@x.com");
  });

  it("SMTP 발송 예외 시 success=false + close 호출(휘발 보장)", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "tour@dayoutgolf.com" });
    sendMailMock.mockRejectedValue(new Error("535 auth failed"));

    const r = await sendMail({ to: "a@b.com", subject: "s", html: "<p>x</p>" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("535");
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("호출마다 새 transporter를 만든다(인스턴스 재사용 금지)", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "u@x.com" });
    sendMailMock.mockResolvedValue({ messageId: "<m>" });

    await sendMail({ to: "a@b.com", subject: "s", html: "x" });
    await sendMail({ to: "c@d.com", subject: "s2", html: "y" });

    expect(createTransportMock).toHaveBeenCalledTimes(2);
    expect(closeMock).toHaveBeenCalledTimes(2);
  });
});

describe("verifySmtp — 연결 검증(실제 발송 없음)", () => {
  it("설정 누락 시 success=false", async () => {
    getApiKeyFreshMock.mockResolvedValue("");
    getApiConfigMock.mockResolvedValue({});
    const r = await verifySmtp();
    expect(r.success).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("verify 성공 시 success=true, 메일은 발송하지 않는다", async () => {
    getApiKeyFreshMock.mockResolvedValue("pw");
    getApiConfigMock.mockResolvedValue({ user: "u@x.com" });
    verifyMock.mockResolvedValue(true);

    const r = await verifySmtp();
    expect(r.success).toBe(true);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
