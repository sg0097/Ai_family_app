import { describe, expect, it } from 'vitest';
import { parseMetaStatuses, parseMetaWebhook } from '../src/whatsapp/meta.js';

const wrap = (value: object) => ({ entry: [{ changes: [{ value }] }] });

describe('Meta webhook parsing', () => {
  it('reads a button tap', () => {
    const [m] = parseMetaWebhook(wrap({ messages: [{ id: 'm1', from: '919812345678', timestamp: '1760000000', type: 'interactive', interactive: { button_reply: { id: 'done:1', title: 'Done' } } }] }));
    expect(m).toMatchObject({ waMessageId: 'm1', buttonPayload: 'done:1', text: 'Done' });
  });
  it('reads a quick-reply template button', () => {
    const [m] = parseMetaWebhook(wrap({ messages: [{ id: 'm2', from: '1', timestamp: '1', type: 'button', button: { payload: 'p', text: 'Haan' } }] }));
    expect(m).toMatchObject({ buttonPayload: 'p', text: 'Haan' });
  });
  it('ignores unsupported types and receipts-only bodies', () => {
    expect(parseMetaWebhook(wrap({ messages: [{ id: 'm3', from: '1', timestamp: '1', type: 'image' }] }))).toEqual([]);
    expect(parseMetaWebhook(wrap({ statuses: [{ id: 'x', status: 'sent' }] }))).toEqual([]);
  });
  it('reads delivery receipts and failure reasons', () => {
    const r = parseMetaStatuses(wrap({ statuses: [{ id: 'a', status: 'delivered' }, { id: 'b', status: 'failed', errors: [{ code: 131026, title: 'Message undeliverable' }] }] }));
    expect(r).toEqual([{ waMessageId: 'a', status: 'delivered', failureReason: undefined }, { waMessageId: 'b', status: 'failed', failureReason: '131026 Message undeliverable' }]);
  });
});
