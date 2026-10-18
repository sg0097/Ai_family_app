import { describe, expect, it } from 'vitest';
import { isGrounded } from '../src/insights/grounding.js';

const facts = [
  'Most recent blood pressure reading: 128/76 on Thu 15 Oct, 9:40 AM.',
  'Routine "morning wali dawa": This week: confirmed on 5 day(s); said "not yet" on Tue 13 Oct.',
  'How Mummy said they felt: Fri 16 Oct low; Mon 12 Oct good.',
];

describe('isGrounded', () => {
  it('accepts an answer built from the facts', () => {
    expect(isGrounded("Mummy's last BP reading was 128/76 on Thursday 15 Oct.", facts)).toBe(true);
    expect(isGrounded('She confirmed her morning medicine on 5 days and said "not yet" on Tue 13 Oct.', facts)).toBe(true);
    expect(isGrounded('She said she was feeling low on Fri 16 Oct.', facts)).toBe(true);
    expect(isGrounded('She reported feeling "low" on Fri 16 Oct.', facts)).toBe(true);
  });

  it('rejects invented numbers and dates', () => {
    expect(isGrounded('Her last reading was 134/77.', facts)).toBe(false);
    expect(isGrounded('She skipped medicine on Sat 10 Oct.', facts)).toBe(false);
  });

  it('rejects judgements about readings', () => {
    expect(isGrounded('Her BP of 128/76 is normal.', facts)).toBe(false);
    expect(isGrounded('None of the readings were high.', facts)).toBe(false);
    expect(isGrounded('Nothing dangerous was recorded.', facts)).toBe(false);
  });
});
