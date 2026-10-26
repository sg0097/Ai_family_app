import { randomUUID } from 'node:crypto';
import type { AudioMessage, SessionMessage, TemplateMessage, WhatsAppProvider } from './types.js';

/** Dev provider: nothing leaves the machine. Outbound messages are visible in the logs and the simulator. */
export class FakeWhatsApp implements WhatsAppProvider {
  async sendSession(to: string, msg: SessionMessage) {
    console.log(`[whatsapp:fake] → ${to}: ${msg.text}${fmtButtons(msg)}`);
    return `fake-out-${randomUUID()}`;
  }

  async sendAudio(to: string, audio: AudioMessage) {
    console.log(`[whatsapp:fake] → ${to}: voice note (${audio.mime}, ${Math.round(audio.data.length / 1024)} KB)`);
    return `fake-out-${randomUUID()}`;
  }

  async sendTemplate(to: string, tpl: TemplateMessage, preview: SessionMessage) {
    console.log(`[whatsapp:fake] → ${to} (template ${tpl.name}): ${preview.text}${fmtButtons(preview)}`);
    return `fake-out-${randomUUID()}`;
  }
}

const fmtButtons = (m: SessionMessage) => (m.buttons?.length ? ` [${m.buttons.map((b) => b.title).join(' | ')}]` : '');
