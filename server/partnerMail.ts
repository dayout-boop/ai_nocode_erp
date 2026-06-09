/**
 * 파트너 온보딩 이메일 — 템플릿 + 발송 + 로그 기록
 *
 * 본문은 가벼운 인라인 HTML로 생성하며 DB에는 저장하지 않는다(메타데이터만 로그).
 * 발송은 mailer.sendMail(실시간 조회/복호화/일회성 transporter)을 통해 수행한다.
 */
import { sendMail } from './mailer';
import { getDb } from './db';
import { partnerEmailLogs } from '../drizzle/schema';

const BRAND = '두골프 (DAYOUT GOLF)';
const PRIMARY = '#1a7a4c';
const SITE_URL = 'https://dayoutgolf.com';
const PARTNER_LOGIN_URL = `${SITE_URL}/partner/login`;

export type PartnerEmailType = 'welcome' | 'approved' | 'rejected' | 'test';

interface BaseParams {
  to: string;
  companyName?: string;
  contactName?: string;
  onboardingId?: number;
}

/** 공통 레이아웃 래퍼 */
function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:'Apple SD Gothic Neo',-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:${PRIMARY};border-radius:14px 14px 0 0;padding:22px 28px;">
      <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.3px;">${BRAND}</div>
      <div style="color:#d6f0e2;font-size:12px;margin-top:2px;">국내·해외 골프투어 파트너 센터</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:30px 28px;border:1px solid #e6ebe8;border-top:none;">
      <h1 style="font-size:19px;color:#1f2a24;margin:0 0 16px;font-weight:700;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="text-align:center;color:#9aa6a0;font-size:11px;margin-top:18px;line-height:1.6;">
      본 메일은 ${BRAND} 파트너 시스템에서 자동 발송되었습니다.<br/>
      문의: <a href="mailto:tour@dayoutgolf.com" style="color:${PRIMARY};">tour@dayoutgolf.com</a>
    </div>
  </div>
</body></html>`;
}

function btn(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;padding:12px 26px;border-radius:9px;font-weight:700;font-size:14px;">${label}</a>`;
}

/** 환영 메일 (가입 접수 / 자동승인 직후) */
export function buildWelcomeEmail(p: BaseParams): { subject: string; html: string; text: string } {
  const name = p.contactName || p.companyName || '파트너';
  const subject = `[${BRAND}] 파트너 가입을 환영합니다`;
  const html = layout(
    '파트너 가입을 환영합니다',
    `<p style="font-size:14px;color:#3a463f;line-height:1.7;">
      <b>${name}</b>님, ${BRAND} 파트너로 등록해 주셔서 감사합니다.<br/>
      아래 버튼을 통해 파트너 센터에 로그인하여 상품 등록과 예약 관리를 시작하실 수 있습니다.
    </p>
    <div style="margin:24px 0;text-align:center;">${btn('파트너 센터 로그인', PARTNER_LOGIN_URL)}</div>
    <p style="font-size:13px;color:#6b766f;line-height:1.7;">
      ${p.companyName ? `등록 업체명: <b>${p.companyName}</b><br/>` : ''}
      추가로 필요한 자료가 있을 경우 담당자가 별도로 안내드립니다.
    </p>`
  );
  const text = `${name}님, ${BRAND} 파트너 가입을 환영합니다. 파트너 센터: ${PARTNER_LOGIN_URL}`;
  return { subject, html, text };
}

/** 승인 메일 (관리자 수동 승인) */
export function buildApprovedEmail(p: BaseParams): { subject: string; html: string; text: string } {
  const name = p.contactName || p.companyName || '파트너';
  const subject = `[${BRAND}] 파트너 가입이 승인되었습니다`;
  const html = layout(
    '파트너 가입이 승인되었습니다',
    `<p style="font-size:14px;color:#3a463f;line-height:1.7;">
      <b>${name}</b>님, 제출해 주신 파트너 가입 신청이 <b style="color:${PRIMARY};">승인</b>되었습니다.<br/>
      이제 파트너 센터의 모든 기능을 이용하실 수 있습니다.
    </p>
    <div style="margin:24px 0;text-align:center;">${btn('파트너 센터 바로가기', PARTNER_LOGIN_URL)}</div>
    <p style="font-size:13px;color:#6b766f;line-height:1.7;">
      ${p.companyName ? `업체명: <b>${p.companyName}</b><br/>` : ''}
      파트너로서 좋은 협업이 되길 기대합니다.
    </p>`
  );
  const text = `${name}님, ${BRAND} 파트너 가입이 승인되었습니다. 파트너 센터: ${PARTNER_LOGIN_URL}`;
  return { subject, html, text };
}

/** 거부 메일 (관리자 거부 + 사유) */
export function buildRejectedEmail(p: BaseParams & { reason?: string }): { subject: string; html: string; text: string } {
  const name = p.contactName || p.companyName || '파트너';
  const reason = p.reason && p.reason.trim() ? p.reason.trim() : '제출 자료 확인이 어려워 승인이 보류되었습니다.';
  const subject = `[${BRAND}] 파트너 가입 심사 결과 안내`;
  const html = layout(
    '파트너 가입 심사 결과 안내',
    `<p style="font-size:14px;color:#3a463f;line-height:1.7;">
      <b>${name}</b>님, 제출해 주신 파트너 가입 신청을 검토한 결과 아쉽게도 이번에는 승인이 어렵습니다.
    </p>
    <div style="background:#fdf2f2;border:1px solid #f5d2d2;border-radius:9px;padding:14px 16px;margin:18px 0;">
      <div style="font-size:12px;color:#a13a3a;font-weight:700;margin-bottom:4px;">사유</div>
      <div style="font-size:13px;color:#7a3535;line-height:1.6;">${reason}</div>
    </div>
    <p style="font-size:13px;color:#6b766f;line-height:1.7;">
      보완 후 재신청이 가능합니다. 자세한 문의는 <a href="mailto:tour@dayoutgolf.com" style="color:${PRIMARY};">tour@dayoutgolf.com</a>으로 연락 주세요.
    </p>
    <div style="margin:20px 0 4px;text-align:center;">${btn('다시 신청하기', PARTNER_LOGIN_URL)}</div>`
  );
  const text = `${name}님, ${BRAND} 파트너 가입이 보류되었습니다. 사유: ${reason}`;
  return { subject, html, text };
}

/** 발송 + 로그 기록 (메타데이터만). 예외를 던지지 않고 결과를 반환한다. */
export async function sendPartnerEmail(args: {
  type: PartnerEmailType;
  to: string;
  subject: string;
  html: string;
  text?: string;
  onboardingId?: number;
}): Promise<{ success: boolean; error?: string }> {
  const result = await sendMail({
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: 'tour@dayoutgolf.com',
  });

  // 메타데이터 로그 기록 (실패해도 본 흐름 차단 안 함)
  try {
    const db = await getDb();
    if (db) {
      await db.insert(partnerEmailLogs).values({
        onboardingId: args.onboardingId ?? null,
        receiverEmail: args.to,
        emailType: args.type,
        subject: args.subject,
        status: result.success ? 'sent' : 'failed',
        messageId: result.messageId ?? null,
        errorMessage: result.success ? null : (result.error ?? 'unknown').slice(0, 1000),
      });
    }
  } catch {
    /* 로그 실패는 무시 */
  }

  return { success: result.success, error: result.error };
}
