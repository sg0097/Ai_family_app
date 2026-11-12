import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

const API = 'https://api.razorpay.com/v1';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

/** Create an order for `amountPaise`. `receipt` ties it to our Payment row. */
export async function createOrder(amountPaise: number, receipt: string): Promise<{ id: string }> {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: receipt.slice(0, 40) }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !json.id) throw new Error(`Razorpay order failed: ${json.error?.description ?? res.status}`);
  return { id: json.id };
}

/** Checkout success: signature = HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = env.RAZORPAY_KEY_SECRET): boolean {
  if (!secret) return false;
  return safeEqual(createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
}

/** Webhook: signature = HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined, secret = env.RAZORPAY_WEBHOOK_SECRET): boolean {
  if (!secret || !signature) return false;
  return safeEqual(createHmac('sha256', secret).update(rawBody).digest('hex'), signature);
}
