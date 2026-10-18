import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6381'),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:5180'),
  WHATSAPP_PROVIDER: z.enum(['fake', 'meta']).default('fake'),
  META_ACCESS_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_TEMPLATE_LANGUAGE: z.string().default('en'),
  OLLAMA_URL: z.string().optional(),
  OLLAMA_MODEL: z.string().default('qwen3:8b'),
  ROLE: z.enum(['all', 'api', 'worker']).default('all'),
});

export const env = schema.parse(process.env);

// Production refuses to start with settings that would expose health data.
if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.length < 32 || env.JWT_SECRET === 'change-me') throw new Error('JWT_SECRET must be a random string of at least 32 characters in production');
  if (env.WHATSAPP_PROVIDER !== 'meta') throw new Error('Production must use WHATSAPP_PROVIDER=meta');
  if (!env.META_APP_SECRET) throw new Error('META_APP_SECRET is required in production to verify webhooks');
}

/** The simulator and demo-data routes. Never on in production. */
export const isDev = env.WHATSAPP_PROVIDER === 'fake' && env.NODE_ENV !== 'production';
