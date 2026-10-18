import { describe, expect, it } from 'vitest';
import { redFlags } from '../src/care/redflags.js';

describe('redFlags', () => {
  it.each([
    ['Seene mein dard ho raha hai', 'chest pain'],
    ['chhati bhaari lag rahi hai', 'chest pain'],
    ['I have chest pain', 'chest pain'],
    ['saans nahi aa rahi theek se', 'trouble breathing'],
    ['saans phool rahi hai', 'trouble breathing'],
    ['bathroom mein gir gayi thi', 'a fall'],
    ['subah behosh ho gayi thi', 'fainting'],
    ['muh tedha lag raha hai', 'face, speech or numbness'],
    ['haath sunn ho gaya', 'face, speech or numbness'],
    ['naak se khoon nikal raha hai', 'bleeding'],
    ['सीने में दर्द हो रहा है', 'chest pain'],
    ['साँस नहीं आ रही', 'trouble breathing'],
    ['बाथरूम में गिर गई', 'a fall'],
  ])('flags "%s" as %s', (text, flag) => {
    expect(redFlags(text)).toContain(flag);
  });

  it.each([
    'Kal se pair mein thoda dard hai',
    'ghutne mein dard hai',
    'saans lene wali exercise ki aaj',
    'Haan beta, dawa le li',
    'BP 138/85',
    'sir dard hai thoda',
    'पैर में दर्द है',
  ])('does not flag "%s"', (text) => {
    expect(redFlags(text)).toEqual([]);
  });
});
