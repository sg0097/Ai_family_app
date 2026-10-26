import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../lib/env.js';
import type { AudioMessage, InboundMessage, SessionMessage, TemplateMessage, WhatsAppProvider } from './types.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** WhatsApp Cloud API. */
export class MetaWhatsApp implements WhatsAppProvider {
  async sendSession(to: string, msg: SessionMessage) {
    const body = msg.buttons?.length
      ? {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: msg.text },
            action: {
              buttons: msg.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })),
            },
          },
        }
      : { type: 'text', text: { body: msg.text } };
    return this.post({ messaging_product: 'whatsapp', to, ...body });
  }

  /** Upload the clip as media, then send it. Browsers that record WebM need it converted to OGG/Opus first. */
  async sendAudio(to: string, audio: AudioMessage) {
    const mime = audio.mime.split(';')[0];
    if (mime === 'audio/webm') throw new Error('WhatsApp does not accept WebM audio; convert to audio/ogg (opus) before sending');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([new Uint8Array(audio.data)], { type: mime }), 'voice');
    const res = await fetch(`${GRAPH}/${env.META_PHONE_NUMBER_ID}/media`, { method: 'POST', headers: { Authorization: `Bearer ${env.META_ACCESS_TOKEN}` }, body: form });
    const json = (await res.json()) as { id?: string; error?: { message: string } };
    if (!res.ok || !json.id) throw new Error(`WhatsApp media upload failed: ${json.error?.message ?? res.status}`);
    return this.post({ messaging_product: 'whatsapp', to, type: 'audio', audio: { id: json.id } });
  }

  async sendTemplate(to: string, tpl: TemplateMessage) {
    const components: unknown[] = [];
    if (tpl.params.length) {
      components.push({ type: 'body', parameters: tpl.params.map((text) => ({ type: 'text', text })) });
    }
    tpl.buttonPayloads?.forEach((payload, index) => {
      components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] });
    });
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: tpl.name, language: { code: tpl.language ?? env.META_TEMPLATE_LANGUAGE }, components },
    });
  }

  private async post(payload: unknown): Promise<string> {
    const res = await fetch(`${GRAPH}/${env.META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok || !json.messages?.[0]) throw new Error(`WhatsApp send failed: ${json.error?.message ?? res.status}`);
    return json.messages[0].id;
  }
}

export function verifyMetaSignature(rawBody: string, header: string | undefined): boolean {
  if (!env.META_APP_SECRET) return false;
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

interface MetaWebhook {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          interactive?: { button_reply?: { id: string; title: string } };
          button?: { payload: string; text: string };
        }[];
      };
    }[];
  }[];
}

/** Pull parent messages out of a webhook body. Delivery receipts and unsupported types are ignored. */
export function parseMetaWebhook(body: MetaWebhook): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const base = { waMessageId: m.id, from: m.from, timestamp: new Date(Number(m.timestamp) * 1000) };
        if (m.type === 'text' && m.text) out.push({ ...base, text: m.text.body });
        else if (m.type === 'interactive' && m.interactive?.button_reply) {
          out.push({ ...base, text: m.interactive.button_reply.title, buttonPayload: m.interactive.button_reply.id });
        } else if (m.type === 'button' && m.button) {
          out.push({ ...base, text: m.button.text, buttonPayload: m.button.payload });
        }
      }
    }
  }
  return out;
}
