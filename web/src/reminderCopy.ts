import type { Frequency, RoutineType } from './types';

// What the parent will see on WhatsApp. Mirrors server/src/conversation/copy.ts (`reminder`),
// so previews in the app match the real message word for word.
export function reminderPreview(type: RoutineType, parent: string, name: string, frequency: Frequency = 'DAILY'): { text: string; buttons?: string[] } {
  const n = name.trim() || defaultName(type);
  switch (type) {
    case 'MEDICINE':
      return { text: `${parent}, ${n} le li? ❤️`, buttons: ['✅ Le li', '❌ Abhi nahi'] };
    case 'WALK':
      return { text: `${parent}, aaj ${n} ho gayi? 🚶`, buttons: ['✅ Ho gayi', '❌ Abhi nahi'] };
    case 'BP':
      return frequency === 'DAILY'
        ? { text: `${parent}, aaj BP check kiya? Reading bhej dijiye, jaise 130/80 🩺` }
        : { text: `${parent}, aaj ${n} ka din hai 🩺 Check karke reading bhej dijiye, jaise 130/80.` };
    case 'SUGAR':
      return frequency === 'DAILY'
        ? { text: `${parent}, aaj sugar check ki? Reading bhej dijiye, jaise "sugar 110" 🩸` }
        : { text: `${parent}, aaj ${n} ka din hai 🩸 Check karke reading bhej dijiye, jaise "sugar 110".` };
    case 'WATER':
      return { text: `${parent}, aaj kitne glass paani hua? 💧 Bas number bhej dijiye.` };
    case 'WELLBEING':
      return { text: `${parent}, aaj kaisa feel ho raha hai? 🌼`, buttons: ['😊 Achha', '😐 Theek', '😔 Achha nahi'] };
  }
}

export function defaultName(type: RoutineType): string {
  return { MEDICINE: 'dawa', BP: 'BP check', SUGAR: 'sugar test', WATER: 'paani', WALK: 'walk', WELLBEING: 'kaisa feel' }[type];
}
