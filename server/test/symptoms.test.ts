import { describe, expect, it } from 'vitest';
import { canonicalSymptom, isGenericSymptom } from '../src/conversation/symptoms.js';

describe('canonicalSymptom', () => {
  it('folds synonyms into one name', () => {
    expect(canonicalSymptom('Head pain')).toBe('headache');
    expect(canonicalSymptom('headache')).toBe('headache');
    expect(canonicalSymptom('Knee ache')).toBe('knee pain');
    expect(canonicalSymptom('shortness of breath')).toBe('breathlessness');
  });
  it('keeps unknown names, tidied', () => {
    expect(canonicalSymptom('  Swollen Ankle ')).toBe('swollen ankle');
  });
  it('knows a generic name', () => {
    expect(isGenericSymptom('pain')).toBe(true);
    expect(isGenericSymptom('knee pain')).toBe(false);
  });
});
