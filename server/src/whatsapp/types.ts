export interface Button {
  id: string; // payload returned when tapped, e.g. "occ:<id>:done"
  title: string; // WhatsApp limit: 20 chars
}

export interface SessionMessage {
  text: string;
  buttons?: Button[]; // WhatsApp limit: 3
}

/** A pre-approved template, required outside the 24h session window. */
export interface TemplateMessage {
  name: string;
  /** WhatsApp template language code; defaults to META_TEMPLATE_LANGUAGE. */
  language?: string;
  params: string[];
  buttonPayloads?: string[]; // quick-reply payloads, in template button order
}

/** A message from the parent, normalised from whichever provider delivered it. */
export interface InboundMessage {
  waMessageId: string;
  from: string;
  text: string;
  buttonPayload?: string;
  timestamp: Date;
}

export interface WhatsAppProvider {
  sendSession(to: string, msg: SessionMessage): Promise<string>;
  sendTemplate(to: string, tpl: TemplateMessage, preview: SessionMessage): Promise<string>;
}
