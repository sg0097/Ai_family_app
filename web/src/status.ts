import type { IconName } from './components/Icon';
import type { ConsentStatus, TodayStatus } from './types';

// One plain-language answer to "is she okay today, and do I need to do anything?".
// Used by the family page and the parent page so both always say the same thing.

export type Tone = 'help' | 'needs' | 'paused' | 'done' | 'ok';

export interface DayStatus {
  tone: Tone;
  icon: IconName;
  title: string;
  detail: string;
  /** Specific things the child should act on, in plain words. */
  needs: string[];
}

interface Input {
  name: string;
  consentStatus: ConsentStatus;
  lastInboundAt: string | null;
  alerts: number;
  routines: { name: string; status: TodayStatus; childAlertedAt: string | null }[];
  /** Serious signs mentioned today, already worded ("Mummy mentioned chest pain"). */
  urgent?: { text: string }[];
}

const SILENT_HOURS = 24;

export function dayStatus(p: Input): DayStatus {
  const today = p.routines.filter((r) => r.status !== 'not_today');
  const done = today.filter((r) => r.status === 'done').length;
  const left = today.filter((r) => r.status === 'upcoming' || r.status === 'waiting').length;

  if (p.alerts) {
    return { tone: 'help', icon: 'alert', title: `${p.name} asked for help`, detail: 'Please call now.', needs: [] };
  }
  if (p.consentStatus === 'PENDING') {
    return { tone: 'paused', icon: 'send', title: `Waiting for ${p.name} to say yes`, detail: 'Reminders start when they reply “Haan” on WhatsApp.', needs: [] };
  }
  if (p.consentStatus !== 'GRANTED') {
    return { tone: 'paused', icon: 'clock', title: 'Reminders are paused', detail: `${p.name} can reply HAAN on WhatsApp to start again.`, needs: [] };
  }

  const needs = [
    ...(p.urgent ?? []).map((u) => u.text),
    ...today.filter((r) => r.childAlertedAt && r.status !== 'done').map((r) => `${cap(r.name)} isn’t confirmed yet`),
  ];
  const silent = p.lastInboundAt && Date.now() - new Date(p.lastInboundAt).getTime() > SILENT_HOURS * 3600_000;
  if (silent) {
    // Same rounding as "last message N days ago" (fmtAgo) so the two never disagree.
    const days = Math.round((Date.now() - new Date(p.lastInboundAt!).getTime()) / 86_400_000);
    needs.unshift(days >= 2 ? `No reply from ${p.name} for ${days} days` : `No reply from ${p.name} since yesterday`);
  }

  if (needs.length) {
    return {
      tone: 'needs',
      icon: 'phone',
      title: needs.length === 1 ? '1 thing needs you' : `${needs.length} things need you`,
      detail: `A quick call to ${p.name} might help.`,
      needs,
    };
  }
  if (today.length && done === today.length) {
    return { tone: 'done', icon: 'sparkle', title: 'All done for today', detail: `${p.name} finished everything on today’s list.`, needs: [] };
  }
  return {
    tone: 'ok',
    icon: 'check',
    title: 'All good so far',
    detail: !today.length ? 'Nothing planned today.' : `${done} of ${today.length} done${left ? ` · ${left} still to come` : ''}.`,
    needs: [],
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
