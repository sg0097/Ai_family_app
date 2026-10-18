import type { RoutineType } from './types';

export const ROUTINE_LABEL: Record<RoutineType, string> = {
  MEDICINE: 'Medicine',
  WATER: 'Water',
  BP: 'Blood pressure',
  SUGAR: 'Blood sugar',
  WALK: 'Walk',
  WELLBEING: 'Feeling',
};

export const SOURCE_LABEL: Record<string, string> = {
  BUTTON: 'WhatsApp button',
  RULES: 'WhatsApp',
  LLM: 'WhatsApp · AI read',
  DASHBOARD: 'Added by you',
};

export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Times on a parent's pages are always shown in the PARENT's timezone, so "8:00 AM reminder,
// done at 8:04" stays consistent even when the child lives in another country. Pass the
// parent's timezone; without one, the browser's is used (only for the child's own things).

export function fmtClock(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone });
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }, timeZone?: string): string {
  // Plain dates ("2026-10-16") are already parent-local calendar days: render them as-is.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T12:00:00`).toLocaleDateString([], opts);
  return new Date(iso).toLocaleDateString([], { ...opts, timeZone });
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Minutes the zone is ahead of UTC right now. */
function offsetMinutes(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Date.now()) / 60000);
}

/** "5 hrs 30 min ahead of you" when the parent's clock differs from the child's, else null. */
export function timeDifference(parentZone: string): string | null {
  if (parentZone === browserTimeZone()) return null;
  const diff = offsetMinutes(parentZone) - offsetMinutes(browserTimeZone());
  if (diff === 0) return null;
  const h = Math.floor(Math.abs(diff) / 60);
  const m = Math.abs(diff) % 60;
  const amount = [h && `${h} hr${h > 1 ? 's' : ''}`, m && `${m} min`].filter(Boolean).join(' ');
  return `${amount} ${diff > 0 ? 'ahead of' : 'behind'} you`;
}

export function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
