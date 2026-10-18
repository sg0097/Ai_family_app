// Words that mean the family should hear about it straight away. A fixed list, no AI: this never
// diagnoses or declares an emergency. It only decides how promptly the parent's own words are
// passed to their child, and whether to remind the parent that HELP and 112 are there.

const RED_FLAGS: [string, RegExp][] = [
  ['chest pain', /\b(seen[ea]|chhati|chest)\b.{0,25}\b(dard|pain|dukh|bhaari|bhari|jalan|ache|pressure)|\b(dard|pain)\b.{0,15}\b(seen[ea]|chhati|chest)\b/i],
  ['trouble breathing', /\bsaans\b.{0,25}\b(nahi|nahin|nhi|phool|takleef|dikkat|ruk|kam)|\b(breath(less|ing)?|can'?t breathe|short of breath)\b/i],
  ['fainting', /\b(behosh|faint(ed|ing)?|unconscious|blackout|black ?out|aankhon ke aage andhera)\b/i],
  ['a fall', /\b(gir (gayi|gaya|gai|gya|gyi|padi|pada)|fell( down)?|had a fall)\b/i],
  ['face, speech or numbness', /\b(muh|munh|chehra)\b.{0,15}\b(tedha|tedhi|latak)|\b(bol nahi pa|bolne mein (dikkat|takleef)|slurr?ed|numb|sunn)\b/i],
  ['bleeding', /\b(khoon|bleeding|blood)\b.{0,20}\b(beh|bah|nikal|ruk nahi|lots|a lot|heavy)|\bbleeding\b/i],
];

// The same signs in Devanagari. (No \b here: JavaScript word boundaries only understand ASCII.)
const RED_FLAGS_HI: [string, RegExp][] = [
  ['chest pain', /(सीने|सीना|छाती).{0,20}(दर्द|भारी|जलन)/],
  ['trouble breathing', /(सांस|साँस).{0,20}(नहीं|फूल|तकलीफ|दिक्कत|रुक)/],
  ['fainting', /(बेहोश|आँखों के आगे अंधेरा|आंखों के आगे अंधेरा)/],
  ['a fall', /गिर (गई|गया|गयी|पड़ी|पड़ा)/],
  ['face, speech or numbness', /((मुँह|मुंह|चेहरा).{0,12}(टेढ़ा|टेढ़ी|लटक)|बोल नहीं पा|सुन्न)/],
  ['bleeding', /(खून).{0,15}(बह|निकल|रुक नहीं)/],
];

/** Which serious signs, if any, the text mentions. */
export function redFlags(text: string): string[] {
  return [...new Set([...RED_FLAGS, ...RED_FLAGS_HI].filter(([, re]) => re.test(text)).map(([name]) => name))];
}
