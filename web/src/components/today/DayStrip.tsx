import { fmtDate } from '../../format';
import type { WeekSchedule } from '../../types';
import { Icon } from '../Icon';

/** Mon–Sun with a small ring for how much got done. Pick a day to see it below. */
export function DayStrip({ week, selected, onSelect, onWeek, canNext }: {
  week: WeekSchedule;
  selected: string;
  onSelect: (date: string) => void;
  onWeek: (dir: -1 | 1) => void;
  canNext: boolean;
}) {
  return (
    <div className="daystrip" role="tablist" aria-label="Pick a day">
      <button className="ds-arrow" onClick={() => onWeek(-1)} aria-label="Previous week"><Icon name="left" size={16} /></button>
      {week.days.map((d) => {
        const asked = d.items.filter((i) => i.status !== 'planned' && i.status !== 'upcoming');
        const done = asked.filter((i) => i.status === 'done').length;
        const p = asked.length ? done / asked.length : 0;
        const future = d.date > week.today;
        const isToday = d.date === week.today;
        return (
          <button
            key={d.date}
            role="tab"
            aria-selected={selected === d.date}
            className={`ds-day${selected === d.date ? ' on' : ''}${future ? ' future' : ''}${isToday ? ' today' : ''}`}
            onClick={() => onSelect(d.date)}
            title={asked.length ? `${done} of ${asked.length} done` : future ? 'Coming up' : 'Nothing asked'}
          >
            <span className="ds-name">{isToday ? 'Today' : fmtDate(d.date, { weekday: 'short' })}</span>
            <span className="ds-ring" style={{ '--p': p } as React.CSSProperties}>
              <span>{fmtDate(d.date, { day: 'numeric' })}</span>
            </span>
            <span className="ds-count">{asked.length ? `${done}/${asked.length}` : future ? `${d.items.length} planned` : '–'}</span>
          </button>
        );
      })}
      <button className="ds-arrow" onClick={() => onWeek(1)} disabled={!canNext} aria-label="Next week"><Icon name="right" size={16} /></button>
    </div>
  );
}
