import type { RoutineType } from '../types';

// One quiet line-icon set (24px grid, 1.75 stroke, currentColor) so the app reads as one family
// instead of a mix of emoji styles. Emoji stay only inside WhatsApp message previews.

const PATHS: Record<string, string> = {
  check: 'M5 12.5l4.2 4.2L19 7',
  dash: 'M7 12h10',
  question: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14 M12 17.5v.01',
  clock: 'M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z M8.5 8.5l7 7',
  heart: 'M19.5 12.6L12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6z M3.5 12h4l1.5-3 3 6 1.5-3h7',
  drop: 'M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z',
  glass: 'M5 3h14l-1.6 16.2A2 2 0 0 1 15.4 21H8.6a2 2 0 0 1-2-1.8z M5.6 9h12.8',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01 M10 21l2-6 3 3v3 M8 12l2-4 4 1 2 3 M12 8l-1 7',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 14s1.5 2 4 2 4-2 4-2 M9 9.5h.01 M15 9.5h.01',
  meh: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 15h8 M9 9.5h.01 M15 9.5h.01',
  frown: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M16 16s-1.5-2-4-2-4 2-4 2 M9 9.5h.01 M15 9.5h.01',
  scale: 'M4 6h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M12 10l2-2 M8 3h8',
  bandage: 'M18.5 5.5a3.5 3.5 0 0 1 0 5l-8 8a3.5 3.5 0 0 1-5-5l8-8a3.5 3.5 0 0 1 5 0z M10 10h.01 M14 14h.01 M12 12h.01',
  message: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  print: 'M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v7H6z',
  plus: 'M12 5v14 M5 12h14',
  x: 'M18 6L6 18 M6 6l12 12',
  send: 'M22 2L11 13 M22 2l-7 20-4-9-9-4z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16v-4 M12 8h.01',
  report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M19 11a7 7 0 0 1-14 0 M12 18v3',
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M7 7h10v10H7z',
  trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  memory: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  hand: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v5 M12 16h.01',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 1.75, className, title }: { name: IconName; size?: number; stroke?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}

export const ROUTINE_ICON_NAME: Record<RoutineType | 'WEIGHT' | 'SYMPTOM', IconName> = {
  MEDICINE: 'pill',
  BP: 'heart',
  SUGAR: 'drop',
  WATER: 'glass',
  WALK: 'walk',
  WELLBEING: 'smile',
  WEIGHT: 'scale',
  SYMPTOM: 'bandage',
};

/** A routine's icon in a soft rounded tile. */
export function RoutineIcon({ type, size = 36 }: { type: RoutineType | 'WEIGHT' | 'SYMPTOM'; size?: number }) {
  return (
    <span className={`r-icon r-${type.toLowerCase()}`} style={{ width: size, height: size }} aria-hidden>
      <Icon name={ROUTINE_ICON_NAME[type]} size={Math.round(size * 0.52)} />
    </span>
  );
}
