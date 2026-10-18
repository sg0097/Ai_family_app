import type { ParentProfile, Routine } from '@prisma/client';
import type { SessionMessage, TemplateMessage } from '../whatsapp/types.js';

// Everything the parent reads, in one place. Template names must match templates approved in
// WhatsApp Manager; the session text is what's sent inside the 24h window (and shown in the simulator).

export const payload = {
  occurrence: (id: string, answer: 'done' | 'not_done') => `occ:${id}:${answer}`,
  wellbeing: (id: string, level: 'good' | 'okay' | 'low') => `wb:${id}:${level}`,
  consent: (answer: 'yes' | 'no') => `consent:${answer}`,
  emergency: 'emergency',
};

export function reminder(parent: ParentProfile, routine: Routine, occurrenceId: string): { session: SessionMessage; template: TemplateMessage } {
  const n = parent.name;
  switch (routine.type) {
    case 'MEDICINE':
    case 'WALK': {
      const text = routine.type === 'MEDICINE' ? `${n}, ${routine.name} le li? ❤️` : `${n}, aaj ${routine.name} ho gayi? 🚶`;
      const buttons = [
        { id: payload.occurrence(occurrenceId, 'done'), title: routine.type === 'MEDICINE' ? '✅ Le li' : '✅ Ho gayi' },
        { id: payload.occurrence(occurrenceId, 'not_done'), title: '❌ Abhi nahi' },
      ];
      return {
        session: { text, buttons },
        template: { name: 'routine_confirm', params: [n, routine.name], buttonPayloads: buttons.map((b) => b.id) },
      };
    }
    // Weekly / monthly checks say it's the day, so they don't read like a daily nag.
    case 'BP':
      return routine.frequency === 'DAILY'
        ? reading(n, `${n}, aaj BP check kiya? Reading bhej dijiye, jaise 130/80 🩺`, 'BP')
        : reading(n, `${n}, aaj ${routine.name} ka din hai 🩺 Check karke reading bhej dijiye, jaise 130/80.`, 'BP');
    case 'SUGAR':
      return routine.frequency === 'DAILY'
        ? reading(n, `${n}, aaj sugar check ki? Reading bhej dijiye, jaise "sugar 110" 🩸`, 'sugar')
        : reading(n, `${n}, aaj ${routine.name} ka din hai 🩸 Check karke reading bhej dijiye, jaise "sugar 110".`, 'sugar');
    case 'WATER':
      return reading(n, `${n}, aaj kitne glass paani hua? 💧 Bas number bhej dijiye.`, 'paani');
    case 'WELLBEING': {
      const buttons = (['good', 'okay', 'low'] as const).map((level) => ({
        id: payload.wellbeing(occurrenceId, level),
        title: { good: '😊 Achha', okay: '😐 Theek', low: '😔 Achha nahi' }[level],
      }));
      return {
        session: { text: `${n}, aaj kaisa feel ho raha hai? 🌼`, buttons },
        template: { name: 'wellbeing_check', params: [n], buttonPayloads: buttons.map((b) => b.id) },
      };
    }
  }
}

/** The single follow-up when a reminder goes unanswered (or was answered "not yet"). Same buttons, softer words. */
export function followUp(parent: ParentProfile, routine: Routine, occurrenceId: string): { session: SessionMessage; template: TemplateMessage } {
  const n = parent.name;
  const base = reminder(parent, routine, occurrenceId);
  const text: Record<Routine['type'], string> = {
    MEDICINE: `${n}, ${routine.name} yaad se le lijiye ❤️ Le li ho to bata dijiye.`,
    WALK: `${n}, thodi der ${routine.name} ho jaye? 🚶 Ho jaye to bata dijiye.`,
    BP: `${n}, BP ki reading reh gayi hai 🙂 Jab check karein, bhej dijiye.`,
    SUGAR: `${n}, sugar ki reading reh gayi hai 🙂 Jab check karein, bhej dijiye.`,
    WATER: `${n}, aaj kitne glass paani hua? 💧 Bas number bhej dijiye.`,
    WELLBEING: `${n}, aaj kaisa feel ho raha hai? 🌼`,
  };
  return {
    session: { ...base.session, text: text[routine.type] },
    template: { name: 'routine_followup', params: [n, routine.name], buttonPayloads: base.template.buttonPayloads },
  };
}

const reading = (name: string, text: string, what: string) => ({
  session: { text },
  template: { name: 'reading_request', params: [name, what] },
});

export function consentRequest(parent: ParentProfile, childName: string) {
  const buttons = [
    { id: payload.consent('yes'), title: 'Haan, shuru karein' },
    { id: payload.consent('no'), title: 'Nahi' },
  ];
  return {
    session: {
      text:
        `Namaste ${parent.name} 🙏 ${childName} ne aapko AI Family Care se joda hai. ` +
        `Main aapko dawa, paani aur BP ki yaad dilaungi, aur aapke jawab ${childName} ko dikhenge. ` +
        `Kya shuru karein?`,
      buttons,
    },
    template: { name: 'consent_request', params: [parent.name, childName], buttonPayloads: buttons.map((b) => b.id) },
  };
}

export const text = {
  welcome: (childName: string) =>
    `Bahut achha ❤️ Ab se main yaad dilaungi. Aap jab chahein normal message bhej sakte hain, jaise "BP 130/80" ya "5 glass paani". ` +
    `Kabhi bhi madad chahiye to bas HELP likhiye, main turant ${childName} ko bata dungi. Band karne ke liye STOP likhiye.`,
  declined: 'Theek hai 🙏 Koi message nahi aayega. Kabhi bhi shuru karna ho to HAAN likhiye.',
  stopped: 'Theek hai 🙏 Ab reminders band. Dobara shuru karne ke liye HAAN likhiye.',
  askConsentAgain: 'Shuru karne ke liye HAAN likhiye 🙏',
  emergency: (childName: string, number: string) =>
    `Maine ${childName} ko abhi bata diya hai 🙏 Agar turant madad chahiye to ${number} par call kariye.`,
  clarify: 'Kis ke baare mein bata rahe hain? 🙂',
  notUnderstood: 'Maaf kijiye, samajh nahi aaya 🙏 Kya dobara bata sakte hain?',
  noted: 'Note kar liya ❤️',
  removed: (childName: string) => `Namaste 🙏 ${childName} ne Family Care band kar diya hai. Ab koi reminder nahi aayega. Dhyan rakhiye ❤️`,
  symptomAck: (childName: string) => `Dhyan rakhiye ❤️ Maine note kar liya${childName ? `, ${childName} ko bhi dikh jayega.` : ''}`,
  redFlag: (childName: string, number: string) => `Dhyan rakhiye ❤️ Maine ${childName} ko abhi bata diya hai. Agar takleef zyada hai to turant ${number} par call kariye, ya HELP likhiye.`,
};
