/**
 * 자립형 이메일 발송 엔진 (nodemailer + 구글 워크스페이스 SMTP)
 *
 * 설계 원칙 (마누스 비종속 / 자립):
 * - 외부 유료 메일 SaaS(Resend/SendGrid 등) 미사용. Node 표준 오픈소스 nodemailer만 사용.
 * - SMTP 자격증명(특히 16자리 구글 앱 비밀번호)은 평문 저장 금지.
 *   → erp_api_settings 테이블에 AES-256-CBC로 암호화 저장 (server/erpApiKeyManager.ts 재사용).
 * - "실시간 쿼리 + 발송 시점 복호화": 발송 이벤트가 발생하는 순간 DB를 직접 조회하여
 *   최신 SMTP 사용자/비밀번호를 읽고, 복호화한 뒤 일회성 transporter를 생성해 발송하고
 *   메모리에서 즉시 휘발시킨다. (서버 재부팅 없이 키 변경이 즉시 반영됨)
 *
 * SMTP 설정 키 매핑 (erp_api_settings.serviceKey):
 *   - "smtp_password"      : 구글 앱 비밀번호 (apiKeyEncrypted 컬럼에 암호화 저장)
 *   - "smtp_password".extraConfig : { user, from, host, port, secure } (JSON)
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getApiKeyFresh, getApiConfig } from './erpApiKeyManager';

/** SMTP 설정 serviceKey (단일 키에 비번 암호화 + extraConfig 결합) */
export const SMTP_SERVICE_KEY = 'smtp_password';

export interface SmtpResolvedConfig {
  user: string;
  pass: string;
  from: string;
  host: string;
  port: number;
  secure: boolean;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** 회신 주소(예: 마스터 datyout@dayoutgolf.com). 미지정 시 from 사용 */
  replyTo?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 발송 시점에 DB를 실시간 조회하여 최신 SMTP 설정을 해석한다.
 * - 비밀번호: getApiKey(DB 우선, 복호화) → 폴백으로 ENV GOOGLE_APP_PASSWORD
 * - 부가설정(user/from/host/port): getApiConfig(extraConfig JSON) → ENV 폴백
 * 설정이 불완전하면 null 반환(가드).
 */
export async function resolveSmtpConfig(): Promise<SmtpResolvedConfig | null> {
  // 1) 비밀번호 — 캐시 우회 DB 직접 복호화(항상 최신값), ENV 폴백
  let pass = await getApiKeyFresh(SMTP_SERVICE_KEY);
  if (!pass) pass = process.env.GOOGLE_APP_PASSWORD ?? '';

  // 2) 부가 설정 — extraConfig(JSON) 우선, ENV 폴백
  const cfg = await getApiConfig(SMTP_SERVICE_KEY);
  const user = cfg.user || process.env.GOOGLE_SMTP_USER || '';
  const from = cfg.from || user;
  const host = cfg.host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const portRaw = cfg.port || process.env.SMTP_PORT || '465';
  const port = Number(portRaw) || 465;
  // 465 → SSL(secure true), 587 → STARTTLS(secure false)
  const secure = cfg.secure !== undefined ? cfg.secure === 'true' || cfg.secure === '1' : port === 465;

  if (!user || !pass) {
    return null; // 자격증명 불완전
  }

  return { user, pass, from, host, port, secure };
}

/**
 * 일회성 transporter를 생성한다. (호출마다 새로 만들고 발송 후 close → 휘발)
 */
function createTransport(cfg: SmtpResolvedConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

/**
 * 이메일 발송 (실시간 조회 → 복호화 → 일회성 transporter → 발송 → 휘발)
 * 예외를 던지지 않고 결과 객체로 반환하여 호출부(가입 흐름 등)를 절대 막지 않는다.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const cfg = await resolveSmtpConfig();
  if (!cfg) {
    return { success: false, error: 'SMTP 설정이 없습니다 (smtp_password 미등록).' };
  }

  let transporter: Transporter | null = null;
  try {
    transporter = createTransport(cfg);
    const info = await transporter.sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo || cfg.from,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  } finally {
    // 일회성 인스턴스 즉시 휘발
    try {
      transporter?.close();
    } catch {
      /* noop */
    }
    transporter = null;
  }
}

/**
 * SMTP 연결 검증 (테스트 버튼용). 실제 메일은 보내지 않고 verify()만 수행.
 */
export async function verifySmtp(): Promise<SendMailResult> {
  const cfg = await resolveSmtpConfig();
  if (!cfg) {
    return { success: false, error: 'SMTP 설정이 없습니다 (smtp_password 미등록).' };
  }
  let transporter: Transporter | null = null;
  try {
    transporter = createTransport(cfg);
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  } finally {
    try {
      transporter?.close();
    } catch {
      /* noop */
    }
    transporter = null;
  }
}
