import type { Appointment, Language, Medicine, ParentProfile, Routine } from '@prisma/client';
import { DateTime } from 'luxon';
import type { SessionMessage, TemplateMessage } from '../whatsapp/types.js';

// Everything the parent reads, in their language, in one place. Template names must match
// templates approved in WhatsApp Manager (one per language); the session text is what's sent
// inside the 24h window and shown in the simulator.
//
// Rule for every string: warm and short, never medical advice, never a judgement of a reading,
// and medicine names/doses repeated exactly as the family entered them.

export const payload = {
  occurrence: (id: string, answer: 'done' | 'not_done') => `occ:${id}:${answer}`,
  wellbeing: (id: string, level: 'good' | 'okay' | 'low') => `wb:${id}:${level}`,
  checkIn: (id: string, level: 'good' | 'okay' | 'low') => `ci:${id}:${level}`,
  consent: (answer: 'yes' | 'no') => `consent:${answer}`,
  emergency: 'emergency',
};

interface Strings {
  medicineAsk: (n: string, what: string) => string;
  walkAsk: (n: string, what: string) => string;
  bpDaily: (n: string) => string;
  bpDay: (n: string, what: string) => string;
  sugarDaily: (n: string) => string;
  sugarDay: (n: string, what: string) => string;
  water: (n: string) => string;
  feel: (n: string) => string;
  btnTook: string;
  btnWalked: string;
  btnNotYet: string;
  feelGood: string;
  feelOkay: string;
  feelLow: string;
  fuMedicine: (n: string, what: string) => string;
  fuWalk: (n: string, what: string) => string;
  fuBp: (n: string) => string;
  fuSugar: (n: string) => string;
  consent: (n: string, family: string) => string;
  consentYes: string;
  consentNo: string;
  welcome: (family: string) => string;
  declined: string;
  stopped: string;
  askConsentAgain: string;
  emergency: (family: string, number: string) => string;
  clarify: string;
  notUnderstood: string;
  noted: string;
  removed: (family: string) => string;
  symptomAck: (family: string) => string;
  redFlag: (family: string, number: string) => string;
  ackBp: (s: number, d: number) => string;
  ackSugar: (v: number) => string;
  ackWater: (g: number) => string;
  ackWaterGoal: (g: number) => string;
  ackWeight: (kg: number) => string;
  ackFeelGood: string;
  ackFeelOther: (family: string) => string;
  ackDone: string;
  ackNotYet: string;
  apptTomorrow: (n: string, when: string, title: string, place: string) => string;
  apptToday: (n: string, when: string, title: string, place: string) => string;
  time: (d: DateTime) => string;
  checkIn: (family: string, text: string) => string;
  checkInIdeas: (n: string) => string[];
  ackCheckIn: (family: string) => string;
}

const period = (h: number, words: [string, string, string, string]) => (h < 12 ? words[0] : h < 16 ? words[1] : h < 19 ? words[2] : words[3]);
const hm = (d: DateTime) => d.toFormat('h:mm');

const HINGLISH: Strings = {
  medicineAsk: (n, w) => `${n}, ${w} le li? ❤️`,
  walkAsk: (n, w) => `${n}, aaj ${w} ho gayi? 🚶`,
  bpDaily: (n) => `${n}, aaj BP check kiya? Reading bhej dijiye, jaise 130/80 🩺`,
  bpDay: (n, w) => `${n}, aaj ${w} ka din hai 🩺 Check karke reading bhej dijiye, jaise 130/80.`,
  sugarDaily: (n) => `${n}, aaj sugar check ki? Reading bhej dijiye, jaise "sugar 110" 🩸`,
  sugarDay: (n, w) => `${n}, aaj ${w} ka din hai 🩸 Check karke reading bhej dijiye, jaise "sugar 110".`,
  water: (n) => `${n}, aaj kitne glass paani hua? 💧 Bas number bhej dijiye.`,
  feel: (n) => `${n}, aaj kaisa feel ho raha hai? 🌼`,
  btnTook: '✅ Le li',
  btnWalked: '✅ Ho gayi',
  btnNotYet: '❌ Abhi nahi',
  feelGood: '😊 Achha',
  feelOkay: '😐 Theek',
  feelLow: '😔 Achha nahi',
  fuMedicine: (n, w) => `${n}, ${w} yaad se le lijiye ❤️ Le li ho to bata dijiye.`,
  fuWalk: (n, w) => `${n}, thodi der ${w} ho jaye? 🚶 Ho jaye to bata dijiye.`,
  fuBp: (n) => `${n}, BP ki reading reh gayi hai 🙂 Jab check karein, bhej dijiye.`,
  fuSugar: (n) => `${n}, sugar ki reading reh gayi hai 🙂 Jab check karein, bhej dijiye.`,
  consent: (n, f) => `Namaste ${n} 🙏 ${f} ne aapko Family Care se joda hai. Main aapko dawa, paani aur BP ki yaad dilaungi, aur aapke jawab ${f} ko dikhenge. Kya shuru karein?`,
  consentYes: 'Haan, shuru karein',
  consentNo: 'Nahi',
  welcome: (f) =>
    `Bahut achha ❤️ Ab se main yaad dilaungi. Aap jab chahein normal message bhej sakte hain, jaise "BP 130/80" ya "5 glass paani". ` +
    `Kabhi bhi madad chahiye to bas HELP likhiye, main turant ${f} ko bata dungi. Band karne ke liye STOP likhiye.`,
  declined: 'Theek hai 🙏 Koi message nahi aayega. Kabhi bhi shuru karna ho to HAAN likhiye.',
  stopped: 'Theek hai 🙏 Ab reminders band. Dobara shuru karne ke liye HAAN likhiye.',
  askConsentAgain: 'Shuru karne ke liye HAAN likhiye 🙏',
  emergency: (f, num) => `Maine ${f} ko abhi bata diya hai 🙏 Agar turant madad chahiye to ${num} par call kariye.`,
  clarify: 'Kis ke baare mein bata rahe hain? 🙂',
  notUnderstood: 'Maaf kijiye, samajh nahi aaya 🙏 Kya dobara bata sakte hain?',
  noted: 'Note kar liya ❤️',
  removed: (f) => `Namaste 🙏 ${f} ne Family Care band kar diya hai. Ab koi reminder nahi aayega. Dhyan rakhiye ❤️`,
  symptomAck: (f) => `Dhyan rakhiye ❤️ Maine note kar liya${f ? `, ${f} ko bhi dikh jayega.` : ''}`,
  redFlag: (f, num) => `Dhyan rakhiye ❤️ Maine ${f} ko abhi bata diya hai. Agar takleef zyada hai to turant ${num} par call kariye, ya HELP likhiye.`,
  ackBp: (s, d) => `BP ${s}/${d} note kar liya ❤️`,
  ackSugar: (v) => `Sugar ${v} note kar li ❤️`,
  ackWater: (g) => `${g} glass paani 👍`,
  ackWaterGoal: (g) => `${g} glass, shabash! 🌟`,
  ackWeight: (kg) => `Weight ${kg} kg note kar liya ❤️`,
  ackFeelGood: 'Sunke achha laga 😊',
  ackFeelOther: (f) => `Dhyan rakhiye ❤️ ${f} ko bhi dikh jayega.`,
  ackDone: 'Shabash! ❤️',
  ackNotYet: 'Koi baat nahi, jab ho jaye tab bata dijiye ❤️',
  apptTomorrow: (n, when, title, place) => `${n}, kal ${when} ${title} ke paas jaana hai${place} 🗓️ Yaad dila rahi thi ❤️`,
  apptToday: (n, when, title, place) => `${n}, aaj ${when} ${title} ke paas jaana hai${place} 🗓️`,
  time: (d) => `${period(d.hour, ['subah', 'dopahar', 'shaam', 'raat'])} ${hm(d)} baje`,
  checkIn: (f, text) => `${f} ka message: “${text}”\nEk tap mein bata dijiye ❤️`,
  checkInIdeas: (n) => [`${n}, kaisi ho? Khana kha liya?`, `${n}, aaj din kaisa gaya?`, `${n}, yaad aa rahi thi aapki ❤️`],
  ackCheckIn: (f) => `${f} ko bata diya ❤️`,
};

const HINDI: Strings = {
  medicineAsk: (n, w) => `${n}, ${w} ले ली? ❤️`,
  walkAsk: (n, w) => `${n}, आज ${w} हो गई? 🚶`,
  bpDaily: (n) => `${n}, आज BP चेक किया? रीडिंग भेज दीजिए, जैसे 130/80 🩺`,
  bpDay: (n, w) => `${n}, आज ${w} का दिन है 🩺 चेक करके रीडिंग भेज दीजिए, जैसे 130/80।`,
  sugarDaily: (n) => `${n}, आज शुगर चेक की? रीडिंग भेज दीजिए, जैसे "शुगर 110" 🩸`,
  sugarDay: (n, w) => `${n}, आज ${w} का दिन है 🩸 चेक करके रीडिंग भेज दीजिए, जैसे "शुगर 110"।`,
  water: (n) => `${n}, आज कितने गिलास पानी हुआ? 💧 बस नंबर भेज दीजिए।`,
  feel: (n) => `${n}, आज कैसा महसूस हो रहा है? 🌼`,
  btnTook: '✅ ले ली',
  btnWalked: '✅ हो गई',
  btnNotYet: '❌ अभी नहीं',
  feelGood: '😊 अच्छा',
  feelOkay: '😐 ठीक',
  feelLow: '😔 अच्छा नहीं',
  fuMedicine: (n, w) => `${n}, ${w} याद से ले लीजिए ❤️ ले ली हो तो बता दीजिए।`,
  fuWalk: (n, w) => `${n}, थोड़ी देर ${w} हो जाए? 🚶 हो जाए तो बता दीजिए।`,
  fuBp: (n) => `${n}, BP की रीडिंग रह गई है 🙂 जब चेक करें, भेज दीजिए।`,
  fuSugar: (n) => `${n}, शुगर की रीडिंग रह गई है 🙂 जब चेक करें, भेज दीजिए।`,
  consent: (n, f) => `नमस्ते ${n} 🙏 ${f} ने आपको Family Care से जोड़ा है। मैं आपको दवा, पानी और BP की याद दिलाऊँगी, और आपके जवाब ${f} को दिखेंगे। क्या शुरू करें?`,
  consentYes: 'हाँ, शुरू करें',
  consentNo: 'नहीं',
  welcome: (f) =>
    `बहुत अच्छा ❤️ अब से मैं याद दिलाऊँगी। आप जब चाहें आम मैसेज भेज सकते हैं, जैसे "BP 130/80" या "5 गिलास पानी"। ` +
    `कभी भी मदद चाहिए तो बस HELP या "मदद" लिखिए, मैं तुरंत ${f} को बता दूँगी। बंद करने के लिए STOP लिखिए।`,
  declined: 'ठीक है 🙏 कोई मैसेज नहीं आएगा। कभी भी शुरू करना हो तो "हाँ" लिखिए।',
  stopped: 'ठीक है 🙏 अब रिमाइंडर बंद। दोबारा शुरू करने के लिए "हाँ" लिखिए।',
  askConsentAgain: 'शुरू करने के लिए "हाँ" लिखिए 🙏',
  emergency: (f, num) => `मैंने ${f} को अभी बता दिया है 🙏 अगर तुरंत मदद चाहिए तो ${num} पर कॉल कीजिए।`,
  clarify: 'किसके बारे में बता रहे हैं? 🙂',
  notUnderstood: 'माफ़ कीजिए, समझ नहीं आया 🙏 क्या दोबारा बता सकते हैं?',
  noted: 'नोट कर लिया ❤️',
  removed: (f) => `नमस्ते 🙏 ${f} ने Family Care बंद कर दिया है। अब कोई रिमाइंडर नहीं आएगा। ध्यान रखिए ❤️`,
  symptomAck: (f) => `ध्यान रखिए ❤️ मैंने नोट कर लिया${f ? `, ${f} को भी दिख जाएगा।` : ''}`,
  redFlag: (f, num) => `ध्यान रखिए ❤️ मैंने ${f} को अभी बता दिया है। अगर तकलीफ़ ज़्यादा है तो तुरंत ${num} पर कॉल कीजिए, या HELP लिखिए।`,
  ackBp: (s, d) => `BP ${s}/${d} नोट कर लिया ❤️`,
  ackSugar: (v) => `शुगर ${v} नोट कर ली ❤️`,
  ackWater: (g) => `${g} गिलास पानी 👍`,
  ackWaterGoal: (g) => `${g} गिलास, शाबाश! 🌟`,
  ackWeight: (kg) => `वज़न ${kg} किलो नोट कर लिया ❤️`,
  ackFeelGood: 'सुनकर अच्छा लगा 😊',
  ackFeelOther: (f) => `ध्यान रखिए ❤️ ${f} को भी दिख जाएगा।`,
  ackDone: 'शाबाश! ❤️',
  ackNotYet: 'कोई बात नहीं, जब हो जाए तब बता दीजिए ❤️',
  apptTomorrow: (n, when, title, place) => `${n}, कल ${when} ${title} के पास जाना है${place} 🗓️ याद दिला रही थी ❤️`,
  apptToday: (n, when, title, place) => `${n}, आज ${when} ${title} के पास जाना है${place} 🗓️`,
  time: (d) => `${period(d.hour, ['सुबह', 'दोपहर', 'शाम', 'रात'])} ${hm(d)} बजे`,
  checkIn: (f, text) => `${f} का संदेश: “${text}”\nएक टैप में बता दीजिए ❤️`,
  checkInIdeas: (n) => [`${n}, कैसी हो? खाना खा लिया?`, `${n}, आज दिन कैसा गया?`, `${n}, आपकी याद आ रही थी ❤️`],
  ackCheckIn: (f) => `${f} को बता दिया ❤️`,
};

const ENGLISH: Strings = {
  medicineAsk: (n, w) => `${n}, have you taken your ${w}? ❤️`,
  walkAsk: (n, w) => `${n}, did you get your ${w} today? 🚶`,
  bpDaily: (n) => `${n}, did you check your BP today? Send me the reading, like 130/80 🩺`,
  bpDay: (n, w) => `${n}, today is your ${w} day 🩺 Please check and send the reading, like 130/80.`,
  sugarDaily: (n) => `${n}, did you check your sugar today? Send the reading, like "sugar 110" 🩸`,
  sugarDay: (n, w) => `${n}, today is your ${w} day 🩸 Please check and send the reading, like "sugar 110".`,
  water: (n) => `${n}, how many glasses of water so far today? 💧 Just send the number.`,
  feel: (n) => `${n}, how are you feeling today? 🌼`,
  btnTook: '✅ Taken',
  btnWalked: '✅ Done',
  btnNotYet: '❌ Not yet',
  feelGood: '😊 Good',
  feelOkay: '😐 Okay',
  feelLow: '😔 Not good',
  fuMedicine: (n, w) => `${n}, a gentle reminder for your ${w} ❤️ Let me know once you've taken it.`,
  fuWalk: (n, w) => `${n}, maybe a short ${w}? 🚶 Let me know when it's done.`,
  fuBp: (n) => `${n}, your BP reading is still pending 🙂 Send it whenever you check.`,
  fuSugar: (n) => `${n}, your sugar reading is still pending 🙂 Send it whenever you check.`,
  consent: (n, f) => `Namaste ${n} 🙏 ${f} has added you to Family Care. I'll remind you about medicines, water and BP, and ${f} will see your replies. Shall we start?`,
  consentYes: 'Yes, start',
  consentNo: 'No',
  welcome: (f) =>
    `Wonderful ❤️ I'll send gentle reminders from now on. You can also message me anytime, like "BP 130/80" or "5 glasses of water". ` +
    `If you ever need help, just type HELP and I'll tell ${f} right away. Type STOP to stop.`,
  declined: "Okay 🙏 You won't get any messages. Type YES whenever you'd like to start.",
  stopped: 'Okay 🙏 Reminders are stopped. Type YES to start again.',
  askConsentAgain: 'Type YES to start 🙏',
  emergency: (f, num) => `I've told ${f} right away 🙏 If you need urgent help, please call ${num}.`,
  clarify: 'Which one are you telling me about? 🙂',
  notUnderstood: "Sorry, I didn't understand 🙏 Could you say that again?",
  noted: 'Noted ❤️',
  removed: (f) => `Namaste 🙏 ${f} has turned off Family Care. You won't get any more reminders. Take care ❤️`,
  symptomAck: (f) => `Please take care ❤️ I've noted it${f ? ` and ${f} will see it.` : '.'}`,
  redFlag: (f, num) => `Please take care ❤️ I've told ${f} right away. If it's bad, call ${num} now, or type HELP.`,
  ackBp: (s, d) => `Noted your BP, ${s}/${d} ❤️`,
  ackSugar: (v) => `Noted your sugar, ${v} ❤️`,
  ackWater: (g) => `${g} glasses of water 👍`,
  ackWaterGoal: (g) => `${g} glasses, well done! 🌟`,
  ackWeight: (kg) => `Noted your weight, ${kg} kg ❤️`,
  ackFeelGood: 'So glad to hear that 😊',
  ackFeelOther: (f) => `Please take care ❤️ ${f} will see this too.`,
  ackDone: 'Well done! ❤️',
  ackNotYet: "No problem, let me know when it's done ❤️",
  apptTomorrow: (n, when, title, place) => `${n}, a reminder: tomorrow at ${when} you have ${title}${place} 🗓️`,
  apptToday: (n, when, title, place) => `${n}, today at ${when} you have ${title}${place} 🗓️`,
  time: (d) => d.toFormat('h:mm a'),
  checkIn: (f, text) => `A message from ${f}: “${text}”\nOne tap to reply ❤️`,
  checkInIdeas: (n) => [`${n}, how are you? Have you eaten?`, `${n}, how was your day?`, `${n}, thinking of you ❤️`],
  ackCheckIn: (f) => `I’ve told ${f} ❤️`,
};

const STRINGS: Record<Language, Strings> = { HINGLISH, HINDI, ENGLISH };
/** WhatsApp template language codes, one approved template set per language. */
const TEMPLATE_LANG: Record<Language, string> = { HINGLISH: 'en', HINDI: 'hi', ENGLISH: 'en_GB' };

export const strings = (lang: Language = 'HINGLISH') => STRINGS[lang];

type Out = { session: SessionMessage; template: TemplateMessage };
type RoutineWithMedicine = Routine & { medicine?: Medicine | null };

/** "morning wali dawa (Telma 40, 1 tablet)": the routine's name plus the medicine as entered. */
function medicineLabel(routine: RoutineWithMedicine): string {
  const m = routine.medicine;
  if (!m) return routine.name;
  const detail = [m.name, m.dose].filter(Boolean).join(', ');
  return detail && !routine.name.toLowerCase().includes(m.name.toLowerCase()) ? `${routine.name} (${detail})` : routine.name;
}

/**
 * A reminder as the child sends it: in the child's own words if they wrote some, and always
 * signed with their name, so the parent knows it comes from their child, not from an app.
 */
export function reminder(parent: ParentProfile, routine: RoutineWithMedicine, occurrenceId: string, family: string): Out {
  const base = standardReminder(parent, routine, occurrenceId);
  if (routine.message) {
    return {
      session: { text: signed(routine.message, family), buttons: base.session.buttons },
      template: { name: 'child_reminder', language: TEMPLATE_LANG[parent.language], params: [family, routine.message], buttonPayloads: base.template.buttonPayloads },
    };
  }
  return { session: { ...base.session, text: signed(base.session.text, family) }, template: { ...base.template, params: [...base.template.params, family] } };
}

const signed = (text: string, family: string) => (family ? `${text}\n— ${family}` : text);

function standardReminder(parent: ParentProfile, routine: RoutineWithMedicine, occurrenceId: string): Out {
  const t = strings(parent.language);
  const n = parent.name;
  const lang = TEMPLATE_LANG[parent.language];
  switch (routine.type) {
    case 'MEDICINE':
    case 'WALK': {
      const what = routine.type === 'MEDICINE' ? medicineLabel(routine) : routine.name;
      const text = routine.type === 'MEDICINE' ? t.medicineAsk(n, what) : t.walkAsk(n, what);
      const buttons = [
        { id: payload.occurrence(occurrenceId, 'done'), title: routine.type === 'MEDICINE' ? t.btnTook : t.btnWalked },
        { id: payload.occurrence(occurrenceId, 'not_done'), title: t.btnNotYet },
      ];
      return { session: { text, buttons }, template: { name: 'routine_confirm', language: lang, params: [n, what], buttonPayloads: buttons.map((b) => b.id) } };
    }
    // Weekly / monthly checks say it's the day, so they don't read like a daily nag.
    case 'BP':
      return reading(routine.frequency === 'DAILY' ? t.bpDaily(n) : t.bpDay(n, routine.name), n, 'BP', lang);
    case 'SUGAR':
      return reading(routine.frequency === 'DAILY' ? t.sugarDaily(n) : t.sugarDay(n, routine.name), n, 'sugar', lang);
    case 'WATER':
      return reading(t.water(n), n, 'water', lang);
    case 'WELLBEING': {
      const buttons = (['good', 'okay', 'low'] as const).map((level) => ({
        id: payload.wellbeing(occurrenceId, level),
        title: { good: t.feelGood, okay: t.feelOkay, low: t.feelLow }[level],
      }));
      return { session: { text: t.feel(n), buttons }, template: { name: 'wellbeing_check', language: lang, params: [n], buttonPayloads: buttons.map((b) => b.id) } };
    }
  }
}

/** The single follow-up when a reminder goes unanswered (or was answered "not yet"). Same buttons, softer words. */
export function followUp(parent: ParentProfile, routine: RoutineWithMedicine, occurrenceId: string, family: string): Out {
  const t = strings(parent.language);
  const n = parent.name;
  const base = standardReminder(parent, routine, occurrenceId);
  const text: Record<Routine['type'], string> = {
    MEDICINE: t.fuMedicine(n, medicineLabel(routine)),
    WALK: t.fuWalk(n, routine.name),
    BP: t.fuBp(n),
    SUGAR: t.fuSugar(n),
    WATER: t.water(n),
    WELLBEING: t.feel(n),
  };
  return {
    session: { ...base.session, text: signed(text[routine.type], family) },
    template: { name: 'routine_followup', language: TEMPLATE_LANG[parent.language], params: [n, routine.name, family], buttonPayloads: base.template.buttonPayloads },
  };
}

const reading = (text: string, name: string, what: string, language: string): Out => ({
  session: { text },
  template: { name: 'reading_request', language, params: [name, what] },
});

export function consentRequest(parent: ParentProfile, family: string): Out {
  const t = strings(parent.language);
  const buttons = [
    { id: payload.consent('yes'), title: t.consentYes },
    { id: payload.consent('no'), title: t.consentNo },
  ];
  return {
    session: { text: t.consent(parent.name, family), buttons },
    template: { name: 'consent_request', language: TEMPLATE_LANG[parent.language], params: [parent.name, family], buttonPayloads: buttons.map((b) => b.id) },
  };
}

export function appointmentReminder(parent: ParentProfile, appt: Appointment, which: 'tomorrow' | 'today'): Out {
  const t = strings(parent.language);
  const when = t.time(DateTime.fromJSDate(appt.at).setZone(parent.timezone));
  const place = appt.place ? ` (${appt.place})` : '';
  const text = which === 'tomorrow' ? t.apptTomorrow(parent.name, when, appt.title, place) : t.apptToday(parent.name, when, appt.title, place);
  return { session: { text }, template: { name: 'appointment_reminder', language: TEMPLATE_LANG[parent.language], params: [parent.name, when, appt.title] } };
}

/** The child asking "how are you?", with the same three one-tap answers as the daily check. */
export function checkIn(parent: ParentProfile, family: string, checkInId: string, text: string): Out {
  const t = strings(parent.language);
  const buttons = (['good', 'okay', 'low'] as const).map((level) => ({
    id: payload.checkIn(checkInId, level),
    title: { good: t.feelGood, okay: t.feelOkay, low: t.feelLow }[level],
  }));
  return {
    session: { text: t.checkIn(family, text), buttons },
    template: { name: 'child_checkin', language: TEMPLATE_LANG[parent.language], params: [family, text], buttonPayloads: buttons.map((b) => b.id) },
  };
}
