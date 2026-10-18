import { fmtClock, fmtDate, fmtTime } from '../format';
import { Icon, type IconName } from './Icon';
import type { WeekSchedule } from '../types';
import { Modal } from './ui';

export type ReminderItem = WeekSchedule['days'][number]['items'][number];

/** What happened with one reminder, in order. */
export function ReminderStory({ item, date, parentName, timeZone, onClose }: { item: ReminderItem; date: string; parentName: string; timeZone: string; onClose: () => void }) {
  const steps: { at: string | null; icon: IconName; text: string }[] = [];
  if (item.status === 'planned' || item.status === 'upcoming') {
    steps.push({ at: null, icon: 'calendar', text: `We’ll remind ${parentName} at ${fmtTime(item.time)}` });
  } else {
    if (item.sentAt) steps.push({ at: item.sentAt, icon: 'send', text: `Reminder sent to ${parentName}` });
    if (item.status === 'not_done' && item.respondedAt) steps.push({ at: item.respondedAt, icon: 'clock', text: `${parentName} said “not yet”` });
    if (item.followUpAt) steps.push({ at: item.followUpAt, icon: 'message', text: 'Reminded again' });
    if (item.childAlertedAt) steps.push({ at: item.childAlertedAt, icon: 'bell', text: 'We let you know' });
    if (item.status === 'done' && item.respondedAt) steps.push({ at: item.respondedAt, icon: 'check', text: `${parentName} said done${item.note ? ` (${item.note})` : ''}` });
    if (item.status === 'no_response') steps.push({ at: null, icon: 'question', text: 'No reply that day. We don’t know either way.' });
    if (item.status === 'waiting') steps.push({ at: null, icon: 'clock', text: 'Waiting for a reply' });
  }
  steps.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.at ? -1 : 1));
  return (
    <Modal title={item.name.charAt(0).toUpperCase() + item.name.slice(1)} onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 14 }}>{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · {fmtTime(item.time)}</p>
      <ul className="feed">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="fi" aria-hidden><Icon name={s.icon} size={17} /></span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.text}</div>
            <span className="tiny">{s.at ? fmtClock(s.at, timeZone) : ''}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
