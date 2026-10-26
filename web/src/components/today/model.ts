import type { IconName } from '../Icon';
import type { RoutineType, ScheduleStatus, Today, WeekSchedule } from '../../types';

/** One reminder on one day, whether it comes from Today (live) or the week schedule (history). */
export interface DayItem {
  routineId: string;
  name: string;
  type: RoutineType;
  time: string; // HH:mm, parent's time
  status: ScheduleStatus;
  sentAt: string | null;
  followUpAt: string | null;
  respondedAt: string | null;
  childAlertedAt: string | null;
  note: string | null;
  latest: string | null;
}

export const LOOK: Record<RoutineType, { icon: IconName; tone: string }> = {
  MEDICINE: { icon: 'pill', tone: 'pink' },
  BP: { icon: 'heart', tone: 'violet' },
  SUGAR: { icon: 'drop', tone: 'amber' },
  WATER: { icon: 'glass', tone: 'blue' },
  WALK: { icon: 'walk', tone: 'green' },
  WELLBEING: { icon: 'smile', tone: 'orange' },
};

export const STATUS_WORD: Record<ScheduleStatus, string> = {
  done: 'Done',
  waiting: 'Waiting for reply',
  not_done: 'Said “not yet”',
  no_response: 'No reply',
  upcoming: 'Later today',
  planned: 'Planned',
};

export const isReading = (t: RoutineType) => t === 'BP' || t === 'SUGAR' || t === 'WATER';

export function itemsFromToday(today: Today): DayItem[] {
  return today.routines
    .filter((r) => r.status !== 'not_today')
    .map((r) => ({
      routineId: r.id,
      name: r.name,
      type: r.type,
      time: r.timeOfDay,
      status: r.status as ScheduleStatus,
      sentAt: r.sentAt,
      followUpAt: r.followUpAt,
      respondedAt: r.respondedAt,
      childAlertedAt: r.childAlertedAt,
      note: r.note,
      latest: r.status === 'done' ? r.latest : null,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function itemsFromSchedule(day: WeekSchedule['days'][number]): DayItem[] {
  return day.items
    .map((i) => ({ ...i, latest: null }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Hours and minutes right now in the parent's timezone. */
export function nowIn(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') + get('minute') / 60;
}

export const hoursOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
