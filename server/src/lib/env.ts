import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // 'demo' = a hosted demo: simulated WhatsApp and the phone simulator, clearly labelled in the UI.
  APP_MODE: z.enum(['live', 'demo']).default('live'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6391'),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:5180'),
  // Public address of the website, used in links inside emails (password reset, invites).
  APP_URL: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['fake', 'resend']).default('fake'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Family Care <care@example.com>'),
  WHATSAPP_PROVIDER: z.enum(['fake', 'meta']).default('fake'),
  META_ACCESS_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_TEMPLATE_LANGUAGE: z.string().default('en'),
  // Features that depend on an AI model (free-text understanding, Ask, patterns). Off until
  // they're proven with real parents in Hinglish; version 1 runs on rules and buttons only.
  LABS: z.enum(['on', 'off']).default('off'),
  OLLAMA_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().default('qwen3:8b'),
  ROLE: z.enum(['all', 'api', 'worker']).default('all'),
});

export const env = schema.parse(process.env);

// Production refuses to start with settings that would expose health data.
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.length < 32 || env.JWT_SECRET === 'change-me') throw new Error('JWT_SECRET must be a random string of at least 32 characters in production');
  if (env.APP_MODE === 'live') {
    // A live service must really message parents and verify who is calling the webhook.
    if (env.WHATSAPP_PROVIDER !== 'meta') throw new Error('APP_MODE=live needs WHATSAPP_PROVIDER=meta (use APP_MODE=demo for a simulated demo)');
    if (!env.META_APP_SECRET) throw new Error('META_APP_SECRET is required in production to verify webhooks');
    if (env.EMAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY) throw new Error('APP_MODE=live needs EMAIL_PROVIDER=resend and RESEND_API_KEY so password resets and invites reach people');
  } else if (env.WHATSAPP_PROVIDER !== 'fake') {
    throw new Error('APP_MODE=demo must use WHATSAPP_PROVIDER=fake so no real messages are sent');
  }
}

/** The simulator and demo-data routes: local development, or an explicitly labelled hosted demo. */
export const isDev = env.WHATSAPP_PROVIDER === 'fake' && (env.NODE_ENV !== 'production' || env.APP_MODE === 'demo');
export const isDemo = env.APP_MODE === 'demo';
export const labs = env.LABS === 'on';

/** Base URL for links in emails. */
export const appUrl = () => (env.APP_URL ?? env.WEB_ORIGIN).replace(/\/$/, '');
