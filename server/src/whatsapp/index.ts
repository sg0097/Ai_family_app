import { env } from '../lib/env.js';
import { FakeWhatsApp } from './fake.js';
import { MetaWhatsApp } from './meta.js';
import type { WhatsAppProvider } from './types.js';

export const whatsapp: WhatsAppProvider = env.WHATSAPP_PROVIDER === 'meta' ? new MetaWhatsApp() : new FakeWhatsApp();
