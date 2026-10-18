import type { RoutineType } from '@prisma/client';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { isPlausible, type Finding } from './findings.js';

// The one door to language models. Today: local Ollama. A hosted model can be added here behind
// a budget without touching callers. The model only extracts; the backend validates and stores.

const ROUTINES = ['MEDICINE', 'WATER', 'BP', 'SUGAR', 'WALK', 'WELLBEING'] as const;

const itemSchema = z.object({
  kind: z.enum(['confirm', 'bp', 'sugar', 'water', 'weight', 'wellbeing', 'symptom']),
  done: z.boolean().nullish(),
  routine: z.enum(ROUTINES).nullish(),
  note: z.string().nullish(),
  systolic: z.number().nullish(),
  diastolic: z.number().nullish(),
  value: z.number().nullish(),
  sugar_context: z.enum(['fasting', 'after meal']).nullish(),
  glasses: z.number().nullish(),
  kg: z.number().nullish(),
  level: z.enum(['good', 'okay', 'low']).nullish(),
  name: z.string().nullish(),
  since: z.string().nullish(),
});
const responseSchema = z.object({ items: z.array(itemSchema) });

// JSON schema handed to Ollama so the model's output is constrained to this shape.
const jsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: itemSchema.shape.kind.options },
          done: { type: ['boolean', 'null'] },
          routine: { type: ['string', 'null'], enum: [...ROUTINES, null] },
          note: { type: ['string', 'null'] },
          systolic: { type: ['number', 'null'] },
          diastolic: { type: ['number', 'null'] },
          value: { type: ['number', 'null'] },
          sugar_context: { type: ['string', 'null'], enum: ['fasting', 'after meal', null] },
          glasses: { type: ['number', 'null'] },
          kg: { type: ['number', 'null'] },
          level: { type: ['string', 'null'], enum: ['good', 'okay', 'low', null] },
          name: { type: ['string', 'null'] },
          since: { type: ['string', 'null'] },
        },
        required: ['kind'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM_PROMPT = `You extract facts from WhatsApp messages sent by an elderly Indian parent to a family-care assistant.
Messages may be in Hindi, Hinglish or English. Output JSON: {"items": [...]}.

Item kinds:
- confirm: the parent answers whether they did a routine. done=true/false. routine = which routine if clear (MEDICINE, WALK, ...), else null. note = short English context like "after breakfast".
- bp: blood pressure reading. systolic, diastolic.
- sugar: blood sugar in mg/dL. value. sugar_context = "fasting" | "after meal" | null.
- water: total glasses of water so far today. glasses.
- weight: kg.
- wellbeing: how they feel overall. level = good | okay | low.
- symptom: a physical complaint. name = short lowercase English, e.g. "knee pain", "fever". since = e.g. "since yesterday", "for 3 days", or null.

Rules:
- Only extract what the message actually says. Never guess numbers. Never add diagnoses or advice.
- Greetings, small talk and questions produce no items: {"items": []}.
- Pending questions the parent may be answering: {PENDING}.

Examples:
"Haan beta, breakfast ke baad le li thi" -> {"items":[{"kind":"confirm","done":true,"routine":null,"note":"after breakfast"}]}
"Aaj BP 138/85 tha" -> {"items":[{"kind":"bp","systolic":138,"diastolic":85}]}
"Haan, nahi bhooli" (yes, didn't forget) -> {"items":[{"kind":"confirm","done":true,"routine":null,"note":null}]}
"Kal se pair mein thoda dard hai" ->{"items":[{"kind":"symptom","name":"leg pain","since":"since yesterday"}]}
"Dawa le li par walk nahi hui, ghutne mein dard tha" -> {"items":[{"kind":"confirm","done":true,"routine":"MEDICINE"},{"kind":"confirm","done":false,"routine":"WALK"},{"kind":"symptom","name":"knee pain","since":null}]}`;

export const llmEnabled = () => Boolean(env.OLLAMA_URL);

/** Returns validated findings, or null if the model is unavailable or answered nonsense. */
export async function understandWithLlm(text: string, pending: { type: RoutineType; name: string }[]): Promise<Finding[] | null> {
  if (!env.OLLAMA_URL) return null;
  const pendingText = pending.length ? pending.map((p) => `${p.type} ("${p.name}")`).join(', ') : 'none';
  try {
    const content = await ollamaChat(
      [
        { role: 'system', content: SYSTEM_PROMPT.replace('{PENDING}', pendingText) },
        { role: 'user', content: text },
      ],
      jsonSchema,
    );
    const parsed = responseSchema.safeParse(JSON.parse(content));
    if (!parsed.success) throw new Error(`invalid model output: ${parsed.error.message}`);
    return parsed.data.items.map(toFinding).filter((f): f is Finding => f !== null && isPlausible(f));
  } catch (err) {
    console.warn('[llm] understanding failed, falling back to rules:', (err as Error).message);
    return null;
  }
}

function toFinding(i: z.infer<typeof itemSchema>): Finding | null {
  switch (i.kind) {
    case 'confirm':
      return typeof i.done === 'boolean'
        ? { kind: 'confirm', done: i.done, ...(i.routine && { routine: i.routine }), ...(i.note && { note: i.note }) }
        : null;
    case 'bp':
      return i.systolic && i.diastolic ? { kind: 'bp', systolic: i.systolic, diastolic: i.diastolic } : null;
    case 'sugar':
      return i.value ? { kind: 'sugar', value: i.value, ...(i.sugar_context && { context: i.sugar_context }) } : null;
    case 'water':
      return i.glasses != null ? { kind: 'water', glasses: i.glasses } : null;
    case 'weight':
      return i.kg ? { kind: 'weight', kg: i.kg } : null;
    case 'wellbeing':
      return i.level ? { kind: 'wellbeing', level: i.level } : null;
    case 'symptom':
      return i.name ? { kind: 'symptom', name: i.name.toLowerCase().trim(), ...(i.since && { since: i.since }) } : null;
  }
}

/** One chat completion from the local model. `format` constrains output to a JSON schema. */
export async function ollamaChat(messages: { role: 'system' | 'user'; content: string }[], format?: object): Promise<string> {
  if (!env.OLLAMA_URL) throw new Error('OLLAMA_URL not set');
  const res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ model: env.OLLAMA_MODEL, stream: false, think: false, format, options: { temperature: 0 }, messages }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { message?: { content?: string } };
  return json.message?.content ?? '';
}
