import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCheckoutSignature, verifyWebhookSignature } from '../src/lib/razorpay.js';
import { amountPaise } from '../src/lib/billing.js';

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

describe('razorpay signatures', () => {
  it('accepts a correct checkout signature', () => {
    expect(verifyCheckoutSignature('order_1', 'pay_1', hmac('s3cret', 'order_1|pay_1'), 's3cret')).toBe(true);
  });
  it('rejects a wrong, tampered or empty signature', () => {
    expect(verifyCheckoutSignature('order_1', 'pay_1', hmac('other', 'order_1|pay_1'), 's3cret')).toBe(false);
    expect(verifyCheckoutSignature('order_2', 'pay_1', hmac('s3cret', 'order_1|pay_1'), 's3cret')).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', '', 's3cret')).toBe(false);
    expect(verifyCheckoutSignature('order_1', 'pay_1', 'zz', 's3cret')).toBe(false);
  });
  it('verifies webhooks over the raw body, and refuses without a secret', () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, hmac('wh', body), 'wh')).toBe(true);
    expect(verifyWebhookSignature(body + ' ', hmac('wh', body), 'wh')).toBe(false);
    expect(verifyWebhookSignature(body, hmac('wh', body), '')).toBe(false);
  });
});

describe('amountPaise', () => {
  it('is per parent', () => {
    expect(amountPaise('BASIC', 1)).toBe(10_000);
    expect(amountPaise('PREMIUM', 3)).toBe(44_700);
    expect(amountPaise('BASIC', 0)).toBe(10_000);
  });
});
