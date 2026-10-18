// Kept free of imports so it can be unit-tested without a database.

const JUDGEMENT = /\b(normal|abnormal|healthy|unhealthy|dangerous|danger|safe|unsafe|worrying|alarming|concerning|fine|high|low|elevated|good range|within range|out of range)\b/i;

/**
 * Deterministic guard on the model's answer: every number and date it states must appear in the
 * facts, and it must not judge readings. "low" is allowed only when quoting a reported feeling.
 */
export function isGrounded(answer: string, facts: string[]): boolean {
  const source = facts.join(' ');
  const numbers = answer.match(/\d+(?:[./]\d+)?/g) ?? [];
  if (numbers.some((n) => !source.includes(n))) return false;
  const dates = answer.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w* \d{1,2} \w{3}/g) ?? [];
  if (dates.some((d) => !source.includes(d.replace(/^(\w{3})\w*/, '$1')))) return false;
  const withoutFeelings = answer.replace(/\b(?:feeling|felt|reported|said)\s+(?:["“']?\w+["”']?\s+){0,2}["“']?(?:low|okay|good)\b["”']?/gi, '');
  return !JUDGEMENT.test(withoutFeelings);
}
