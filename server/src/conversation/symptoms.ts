// One name per symptom, so "headache", "head pain" and "sir dard" are counted, grouped and
// alerted as the same thing in alerts, records and the weekly report.

const SYNONYMS: [string, string[]][] = [
  ['headache', ['head pain', 'head ache', 'pain in head', 'sir dard', 'sar dard']],
  ['stomach ache', ['stomach pain', 'abdominal pain', 'tummy ache', 'pet dard', 'belly pain']],
  ['back pain', ['backache', 'back ache', 'lower back pain', 'kamar dard']],
  ['knee pain', ['knee ache', 'pain in knee', 'pain in knees', 'knees pain', 'ghutne mein dard']],
  ['leg pain', ['pain in leg', 'pain in legs', 'legs pain', 'leg ache', 'pair dard']],
  ['joint pain', ['joints pain', 'pain in joints', 'joint ache']],
  ['chest pain', ['pain in chest', 'chest ache', 'chest discomfort']],
  ['toothache', ['tooth pain', 'teeth pain', 'tooth ache']],
  ['dizziness', ['dizzy', 'giddiness', 'vertigo', 'chakkar']],
  ['tiredness', ['tired', 'fatigue', 'weakness', 'exhaustion']],
  ['fever', ['high temperature', 'temperature', 'bukhar']],
  ['cough', ['coughing']],
  ['cold', ['common cold', 'runny nose']],
  ['breathlessness', ['shortness of breath', 'breathing difficulty', 'difficulty breathing', 'trouble breathing']],
  ['poor sleep', ['no sleep', 'insomnia', 'trouble sleeping', 'could not sleep', "couldn't sleep"]],
];

const GENERIC = new Set(['pain', 'ache', 'dard', 'discomfort', 'body pain']);

export function canonicalSymptom(raw: string): string {
  const name = raw.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [canon, alts] of SYNONYMS) if (name === canon || alts.includes(name)) return canon;
  return name;
}

/** "pain" says less than "knee pain": keep the more specific of two names for the same mention. */
export function isGenericSymptom(name: string): boolean {
  return GENERIC.has(canonicalSymptom(name));
}
