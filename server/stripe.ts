import Stripe from "stripe";
import { getDb } from "./db";
import { payments, bookings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";
import type { Express, Request, Response } from "express";
import express from "express";

function getStripe() {
  return new Stripe(ENV.stripeSecretKey, { apiVersion: "2026-03-25.dahlia" });
}

// ─── 결제 인텐트 생성 ────────────────────────────────────────────
export async function createPaymentIntent(
  bookingId: number,
  amountKrw: number,
  customerEmail?: string,
  customerName?: string
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountKrw, // KRW는 소수점 없는 정수 (원 단위)
    currency: "krw",
    metadata: {
      bookingId: bookingId.toString(),
      customerEmail: customerEmail ?? "",
      customerName: customerName ?? "",
    },
    automatic_payment_methods: { enabled: true },
  });

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // DB에 결제 레코드 생성
  await db.insert(payments).values({
    bookingId,
    stripePaymentIntentId: paymentIntent.id,
    amount: amountKrw.toString(),
    currency: "krw",
    status: "pending",
    metadata: { customerEmail, customerName },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}

// ─── 결제 상태 조회 ──────────────────────────────────────────────
export async function getPaymentStatus(paymentIntentId: string) {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  let receiptUrl: string | null = null;
  if (pi.latest_charge) {
    const charge = await stripe.charges.retrieve(pi.latest_charge as string);
    receiptUrl = charge.receipt_url ?? null;
  }
  return {
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    receiptUrl,
  };
}

// ─── Stripe Webhook 등록 ─────────────────────────────────────────
export function registerStripeWebhook(app: Express) {
  // raw body 파싱 (웹훅 서명 검증에 필요) - express.json() 보다 먼저 등록해야 함
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = ENV.stripeWebhookSecret;
      const stripe = getStripe();

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Stripe Webhook] Signature verification failed:", message);
        res.status(400).send(`Webhook Error: ${message}`);
        return;
      }

      // 테스트 이벤트 처리
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        res.json({ verified: true });
        return;
      }

      console.log(`[Stripe Webhook] Event: ${event.type} (${event.id})`);

      try {
        const db = await getDb();
        if (!db) {
          res.status(500).json({ error: "Database not available" });
          return;
        }

        switch (event.type) {
          case "payment_intent.succeeded": {
            const pi = event.data.object as Stripe.PaymentIntent;
            const bookingId = parseInt(pi.metadata.bookingId ?? "0");

            let receiptUrl: string | undefined;
            if (pi.latest_charge) {
              const charge = await stripe.charges.retrieve(pi.latest_charge as string);
              receiptUrl = charge.receipt_url ?? undefined;
            }

            // 결제 레코드 업데이트
            await db
              .update(payments)
              .set({ status: "succeeded", receiptUrl, updatedAt: new Date() })
              .where(eq(payments.stripePaymentIntentId, pi.id));

            // 예약 결제 상태 자동 확정
            if (bookingId) {
              await db
                .update(bookings)
                .set({
                  paidAmount: pi.amount.toString(),
                  paymentStatus: "paid",
                  status: "confirmed",
                  updatedAt: new Date(),
                })
                .where(eq(bookings.id, bookingId));
            }
            break;
          }

          case "payment_intent.payment_failed": {
            const pi = event.data.object as Stripe.PaymentIntent;
            await db
              .update(payments)
              .set({ status: "failed", updatedAt: new Date() })
              .where(eq(payments.stripePaymentIntentId, pi.id));
            break;
          }

          case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            if (charge.payment_intent) {
              await db
                .update(payments)
                .set({ status: "refunded", updatedAt: new Date() })
                .where(eq(payments.stripePaymentIntentId, charge.payment_intent as string));
            }
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (err) {
        console.error("[Stripe Webhook] Handler error:", err);
        res.status(500).json({ error: "Webhook handler failed" });
      }
    }
  );
}
