import type { RoutineType } from '@prisma/client';
import { isPlausible, type Finding, type Understanding } from './findings.js';
import { canonicalSymptom } from './symptoms.js';

// Deterministic understanding for the common cases: yes/no, readings like "138/85", glasses of water.
// Anything with symptoms, contradictions or lots of extra words is marked not confident so the
// conversation processor can ask a language model, keeping these findings as the fallback.

const YES = [
  'haan', 'haa', 'ha', 'han', 'haanji', 'hanji', 'haan ji', 'ji haan', 'ji', 'yes', 'yeah', 'yep', 'ok', 'okay', 'done',
  'le li', 'le liya', 'le lia', 'kha li', 'khaa li', 'kha liya', 'kar li', 'kar liya', 'ho gaya', 'ho gayi', 'ho gai',
  'ho gya', 'ho gyi', 'hogaya', 'hogayi',
  // Devanagari
  'हाँ', 'हां', 'हा', 'जी', 'जी हाँ', 'हाँ जी', 'ले ली', 'ले लिया', 'खा ली', 'कर ली', 'कर लिया', 'हो गया', 'हो गई', 'हो गयी',
];
const NO = [
  'nahi', 'nahin', 'nhi', 'nai', 'no', 'nope', 'abhi nahi', 'bhool', 'bhool gayi', 'bhool gaya', 'bhul gayi', 'bhul gaya',
  'नहीं', 'नही', 'अभी नहीं', 'भूल गई', 'भूल गया',
];
const YES_EMOJI = ['✅', '👍', '👌'];
const NO_EMOJI = ['❌', '👎'];

const ROUTINE_WORDS: [RoutineType, string[]][] = [
  ['MEDICINE', ['dawa', 'dawai', 'dava', 'davai', 'goli', 'tablet', 'medicine', 'dose', 'insulin', 'दवा', 'दवाई', 'गोली']],
  ['WALK', ['walk', 'sair', 'ghoom', 'ghoomne', 'tehal', 'tahal', 'tahalne', 'exercise', 'yoga', 'सैर', 'टहलना', 'वॉक']],
];

const NOTES: [string, string[]][] = [
  ['after breakfast', ['breakfast ke baad', 'nashte ke baad', 'nashta ke baad', 'after breakfast']],
  ['after dinner', ['dinner ke baad', 'raat ke khane ke baad', 'after dinner']],
  ['after meal', ['khane ke baad', 'khana ke baad', 'lunch ke baad', 'after food', 'after lunch', 'after meal']],
  ['before meal', ['khane se pehle', 'khana se pehle', 'before food', 'before meal']],
  ['late', ['der se', 'late']],
];

const SYMPTOMS: [string, string[]][] = [
  ['pain', ['dard', 'pain', 'ache', 'dukh raha', 'dukhta']],
  ['fever', ['bukhar', 'bukhaar', 'fever', 'taap']],
  ['dizziness', ['chakkar', 'dizzy', 'dizziness']],
  ['tiredness', ['thakan', 'thakaan', 'tired', 'kamzori', 'weakness']],
  ['cough', ['khansi', 'khaansi', 'cough']],
  ['cold', ['sardi', 'zukam', 'zukaam']],
  ['vomiting', ['ulti', 'vomit', 'vomiting']],
  ['uneasiness', ['ghabrahat', 'ghabrahat', 'bechaini']],
  ['swelling', ['sujan', 'soojan', 'swelling']],
  ['breathlessness', ['saans', 'breathless']],
  ['poor sleep', ['neend nahi', 'neend nahin', 'so nahi']],
  ['loose motion', ['dast', 'loose motion']],
  ['burning', ['jalan']],
];
const BODY_PARTS: [string, string[]][] = [
  ['leg', ['pair', 'paon', 'paer', 'leg', 'legs', 'taang']],
  ['knee', ['ghutna', 'ghutne', 'ghutno', 'knee', 'knees']],
  ['head', ['sir', 'sar', 'head']],
  ['back', ['kamar', 'back']],
  ['stomach', ['pet', 'stomach']],
  ['chest', ['seena', 'seene', 'chhati', 'chest']],
  ['hand', ['haath', 'hand']],
  ['shoulder', ['kandha', 'kandhe', 'shoulder']],
  ['neck', ['gardan', 'neck']],
  ['tooth', ['daant', 'tooth']],
  ['eye', ['aankh', 'aankhon', 'eye', 'eyes']],
  ['joint', ['jodon', 'jodo', 'joint', 'joints']],
];
const LOCAL_SYMPTOMS = new Set(['pain', 'swelling', 'burning']);

const WELLBEING: ['good' | 'okay' | 'low', string[]][] = [
  ['low', ['achha nahi', 'accha nahi', 'acha nahi', 'theek nahi', 'thik nahi', 'kharab', 'udaas', 'low', 'bura', 'not good', 'not well', 'अच्छा नहीं', 'ठीक नहीं', 'खराब', 'उदास']],
  ['good', ['achha', 'accha', 'acha', 'badhiya', 'badiya', 'mast', 'good', 'great', 'khush', 'fit', 'अच्छा', 'बढ़िया', 'बढ़िया', 'खुश']],
  ['okay', ['theek', 'thik', 'thek', 'okay', 'ok', 'normal', 'fine', 'ठीक']],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text: string, phrase: string) => new RegExp(`(^|\\s)${escape(phrase)}(\\s|$)`).test(text);
const hasAny = (text: string, phrases: string[]) => phrases.some((p) => has(text, p));
const firstMatch = <T>(text: string, table: [T, string[]][]) => table.find(([, words]) => hasAny(text, words))?.[0];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))) // Devanagari digits → 0-9
    .replace(/[^\p{L}\p{M}\p{N}\s/.\\-]/gu, ' ') // drop punctuation and emoji; keep letters with their vowel signs (\p{M}, needed for Devanagari), "/" for 138/85 and "." for 62.5
    .replace(/(\D)\.|\.(\D|$)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWithRules(raw: string, pending: RoutineType[] = []): Understanding {
  const text = normalize(raw);
  const tokens = text ? text.split(' ') : [];
  const findings: Finding[] = [];
  let confident = true;

  // Readings
  const bp = text.match(/(?:^|\D)(\d{2,3})\s*(?:\/|\\|-|by|over|par)\s*(\d{2,3})(?!\d)/);
  if (bp) findings.push({ kind: 'bp', systolic: Number(bp[1]), diastolic: Number(bp[2]) });

  const sugar =
    text.match(/(?:sugar|shugar|sugr|glucose|शुगर)\D{0,15}?(\d{2,3})(?!\d)/) ?? text.match(/(\d{2,3})\s*(?:mg\/?dl\s*)?(?:sugar|shugar|glucose|शुगर)/);
  if (sugar) {
    const context = hasAny(text, ['fasting', 'khali pet', 'khaali pet']) ? 'fasting' : hasAny(text, ['khane ke baad', 'after food', 'pp']) ? 'after meal' : undefined;
    findings.push({ kind: 'sugar', value: Number(sugar[1]), ...(context && { context }) });
  }

  const water = text.match(/(\d{1,2})\s*(?:glass|glasses|gilas|gilaas|glas|gilass|गिलास)(?![\w\u0900-\u097F])/) ?? text.match(/(?:paani|pani|water|पानी)\D{0,10}?(\d{1,2})(?!\d)/);
  if (water) findings.push({ kind: 'water', glasses: Number(water[1]) });

  const weight = text.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kgs|kilo|किलो)(?![\w\u0900-\u097F])/) ?? text.match(/(?:weight|wajan|vajan|वज़न|वजन)\D{0,10}?(\d{2,3}(?:\.\d)?)(?![\d.])/);
  if (weight) findings.push({ kind: 'weight', kg: Number(weight[1]) });

  // A bare number answers whichever reading we asked for.
  const numbers = text.match(/\d+(?:\.\d+)?/g) ?? [];
  if (!findings.length && numbers.length === 1 && tokens.length <= 4) {
    const n = Number(numbers[0]);
    if (pending.includes('WATER') && n <= 30) findings.push({ kind: 'water', glasses: n });
    else if (pending.includes('SUGAR')) findings.push({ kind: 'sugar', value: n });
  }

  // Symptoms always deserve a closer read, so rules only provide a fallback.
  const symptom = firstMatch(text, SYMPTOMS);
  if (symptom) {
    const part = LOCAL_SYMPTOMS.has(symptom) ? firstMatch(text, BODY_PARTS) : undefined;
    findings.push({ kind: 'symptom', name: canonicalSymptom(part ? `${part} ${symptom}` : symptom), ...sinceOf(text) });
    confident = false;
  }

  // Wellbeing words only count when we asked how they feel; otherwise "theek hai" just means "okay".
  const askedWellbeing = pending.includes('WELLBEING') || hasAny(text, ['feel', 'tabiyat', 'tabiyat', 'tabeeyat']);
  const wellbeing = askedWellbeing && !symptom ? firstMatch(text, WELLBEING) : undefined;
  if (wellbeing) findings.push({ kind: 'wellbeing', level: wellbeing });

  // Yes / no
  const yes = hasAny(text, YES) || YES_EMOJI.some((e) => raw.includes(e));
  const no = hasAny(text, NO) || tokens[0] === 'na' || tokens[0] === 'ना' || NO_EMOJI.some((e) => raw.includes(e));
  if (!wellbeing && (yes || no)) {
    if (yes && no) {
      confident = false; // "haan, nahi bhooli" — let the model work it out
    } else {
      const routine = firstMatch(text, ROUTINE_WORDS);
      const note = firstMatch(text, NOTES);
      findings.push({ kind: 'confirm', done: yes, ...(routine && { routine }), ...(note && { note }) });
    }
  }

  if (!findings.length || tokens.length > 10) confident = false;
  return { findings: findings.filter(isPlausible), confident };
}

function sinceOf(text: string): { since?: string } {
  const days = text.match(/(\d+)\s*din se/);
  if (days) return { since: `for ${days[1]} days` };
  if (hasAny(text, ['kal se', 'since yesterday'])) return { since: 'since yesterday' };
  if (hasAny(text, ['parso se'])) return { since: 'for 2 days' };
  if (hasAny(text, ['hafte se', 'week se'])) return { since: 'for a week' };
  if (hasAny(text, ['aaj se', 'aaj subah se', 'subah se', 'since morning'])) return { since: 'since today' };
  return {};
}

// Whole-message help requests only, in the ways a frightened parent might type them.
const EMERGENCY = new Set([
  'help', 'help me', 'help karo', 'help chahiye', 'please help', 'sos', 'emergency', 'emergency hai',
  'madad', 'madad karo', 'madad chahiye', 'bachao', 'jaldi aao', 'जल्दी आओ', 'मदद', 'मदद करो', 'बचाओ',
]);

/** Emergency is explicit only: the whole message must be a help word, never inferred from content. */
export function isEmergencyRequest(raw: string): boolean {
  return raw.includes('🚨') || EMERGENCY.has(normalize(raw));
}

export function isStopRequest(raw: string): boolean {
  return ['stop', 'band karo', 'unsubscribe', 'बंद करो', 'बंद'].includes(normalize(raw));
}

export function consentAnswer(raw: string): 'yes' | 'no' | null {
  const text = normalize(raw);
  if (hasAny(text, ['nahi', 'nahin', 'no', 'nhi', 'stop', 'नहीं', 'नही'])) return 'no';
  if (hasAny(text, ['haan', 'han', 'ha', 'haanji', 'hanji', 'ji', 'yes', 'ok', 'okay', 'start', 'theek hai', 'हाँ', 'हां', 'जी', 'शुरू', 'ठीक है'])) return 'yes';
  return null;
}
