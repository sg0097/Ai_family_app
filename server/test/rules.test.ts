import { describe, expect, it } from 'vitest';
import { consentAnswer, isEmergencyRequest, normalize, parseWithRules } from '../src/conversation/rules.js';

describe('parseWithRules — PRD examples', () => {
  it('confirms medicine with context', () => {
    expect(parseWithRules('Haan beta, breakfast ke baad le li thi.', ['MEDICINE'])).toEqual({
      findings: [{ kind: 'confirm', done: true, note: 'after breakfast' }],
      confident: true,
    });
  });

  it('reads a BP value', () => {
    expect(parseWithRules('Aaj BP 138/85 tha.')).toEqual({ findings: [{ kind: 'bp', systolic: 138, diastolic: 85 }], confident: true });
  });

  it('reads glasses of water', () => {
    expect(parseWithRules('5 glass paani hua hai.')).toEqual({ findings: [{ kind: 'water', glasses: 5 }], confident: true });
  });

  it('extracts a symptom but defers to the model', () => {
    expect(parseWithRules('Kal se pair mein thoda dard hai.')).toEqual({
      findings: [{ kind: 'symptom', name: 'leg pain', since: 'since yesterday' }],
      confident: false,
    });
  });
});

describe('parseWithRules — yes / no', () => {
  it.each(['haan', 'Haan ji', 'le li', 'ho gaya', '✅', 'yes'])('"%s" is yes', (msg) => {
    expect(parseWithRules(msg).findings).toEqual([{ kind: 'confirm', done: true }]);
  });

  it.each(['nahi', 'abhi nahi', 'bhool gayi', 'na', '❌'])('"%s" is no', (msg) => {
    expect(parseWithRules(msg).findings).toEqual([{ kind: 'confirm', done: false }]);
  });

  it('picks up which routine is meant', () => {
    expect(parseWithRules('dawa le li').findings).toEqual([{ kind: 'confirm', done: true, routine: 'MEDICINE' }]);
    expect(parseWithRules('aaj walk nahi hui').findings).toEqual([{ kind: 'confirm', done: false, routine: 'WALK' }]);
  });

  it('defers contradictions to the model', () => {
    expect(parseWithRules('haan, nahi bhooli')).toEqual({ findings: [], confident: false });
  });

  it('is not confident about chit-chat', () => {
    expect(parseWithRules('Kaise ho beta?').confident).toBe(false);
  });
});

describe('normalize', () => {
  it('keeps Devanagari vowel signs intact', () => {
    expect(normalize('दवा ले ली!')).toBe('दवा ले ली');
  });
});

describe('parseWithRules — readings', () => {
  it('reads a bare number as the reading that was asked for', () => {
    expect(parseWithRules('6', ['WATER']).findings).toEqual([{ kind: 'water', glasses: 6 }]);
    expect(parseWithRules('112', ['SUGAR']).findings).toEqual([{ kind: 'sugar', value: 112 }]);
    expect(parseWithRules('6').findings).toEqual([]);
  });

  it('reads sugar with context', () => {
    expect(parseWithRules('fasting sugar 104').findings).toEqual([{ kind: 'sugar', value: 104, context: 'fasting' }]);
  });

  it('reads weight with decimals', () => {
    expect(parseWithRules('weight 62.5 kg').findings).toEqual([{ kind: 'weight', kg: 62.5 }]);
  });

  it('drops implausible values instead of storing them', () => {
    expect(parseWithRules('BP 85/138').findings).toEqual([]);
    expect(parseWithRules('16/10 ko doctor ke paas jana hai').findings.filter((f) => f.kind === 'bp')).toEqual([]);
  });

  it('reads several facts at once', () => {
    expect(parseWithRules('BP 130/80 aur 6 glass paani').findings).toEqual([
      { kind: 'bp', systolic: 130, diastolic: 80 },
      { kind: 'water', glasses: 6 },
    ]);
  });
});

describe('parseWithRules — wellbeing', () => {
  it('only reads feelings when asked', () => {
    expect(parseWithRules('achha hai', ['WELLBEING']).findings).toEqual([{ kind: 'wellbeing', level: 'good' }]);
    expect(parseWithRules('theek nahi hai', ['WELLBEING']).findings).toEqual([{ kind: 'wellbeing', level: 'low' }]);
    expect(parseWithRules('theek hai', ['MEDICINE']).findings).toEqual([]);
  });
});

describe('explicit actions', () => {
  it('treats only a bare help word as an emergency', () => {
    expect(isEmergencyRequest('HELP')).toBe(true);
    expect(isEmergencyRequest('🚨')).toBe(true);
    expect(isEmergencyRequest('Madad!')).toBe(true);
    expect(isEmergencyRequest('madad karo')).toBe(true);
    expect(isEmergencyRequest('Help karo!!')).toBe(true);
    expect(isEmergencyRequest('मदद करो')).toBe(true);
    expect(isEmergencyRequest('phone mein thodi help chahiye thi')).toBe(false);
    expect(isEmergencyRequest('seene mein dard hai')).toBe(false);
  });

  it('reads consent answers', () => {
    expect(consentAnswer('Haan')).toBe('yes');
    expect(consentAnswer('nahi')).toBe('no');
    expect(consentAnswer('kya hai yeh?')).toBe(null);
  });
});
