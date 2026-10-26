import { useEffect, useState } from 'react';
import { fmtTime } from '../../format';
import { Icon } from '../Icon';
import { LOOK, STATUS_WORD, cap, hoursOf, nowIn, type DayItem } from './model';

/**
 * Her day on one line: each reminder at its time, coloured by what happened, with a "now"
 * marker on today. Hovering here highlights the tile below, and the other way round.
 */
export function DayTimeline({ items, isToday, timeZone, hovered, onHover, onOpen }: {
  items: DayItem[];
  isToday: boolean;
  timeZone: string;
  hovered: string | null;
  onHover: (id: string | null) => void;
  onOpen: (item: DayItem) => void;
}) {
  const [now, setNow] = useState(() => nowIn(timeZone));
  useEffect(() => {
    const t = setInterval(() => setNow(nowIn(timeZone)), 30_000);
    return () => clearInterval(t);
  }, [timeZone]);

  const hours = items.map((i) => hoursOf(i.time));
  const start = Math.min(6, Math.floor(Math.min(...hours, 24)));
  const end = Math.max(22, Math.ceil(Math.max(...hours, 0) + 0.5));
  const at = (h: number) => `${((h - start) / (end - start)) * 100}%`;
  const ticks = [];
  for (let h = Math.ceil(start / 3) * 3; h <= end; h += 3) ticks.push(h);
  const nowShown = isToday && now >= start && now <= end;

  // Reminders at the same time stack instead of hiding each other.
  const lane = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const i of items) {
    const n = seen.get(i.time) ?? 0;
    lane.set(i.routineId, n);
    seen.set(i.time, n + 1);
  }

  return (
    <div className="tl" aria-label="Her day">
      <div className="tl-track">
        {nowShown && <div className="tl-past" style={{ width: at(now) }} />}
        {ticks.map((h) => (
          <span key={h} className="tl-tick" style={{ left: at(h) }}>{fmtTime(`${String(h % 24).padStart(2, '0')}:00`).replace(':00', '')}</span>
        ))}
        {nowShown && <span className="tl-now" style={{ left: at(now) }}><b>Now</b></span>}
        {items.map((i) => {
          const pos = (hoursOf(i.time) - start) / (end - start);
          const edge = pos > 0.8 ? ' tip-end' : pos < 0.15 ? ' tip-start' : '';
          return (
          <button
            key={i.routineId}
            className={`tl-dot ${i.status} c-${LOOK[i.type].tone}${hovered === i.routineId ? ' hot' : ''}${edge}`}
            style={{ left: at(hoursOf(i.time)), '--lane': lane.get(i.routineId) ?? 0 } as React.CSSProperties}
            onMouseEnter={() => onHover(i.routineId)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(i.routineId)}
            onBlur={() => onHover(null)}
            onClick={() => onOpen(i)}
            aria-label={`${cap(i.name)} at ${fmtTime(i.time)}: ${STATUS_WORD[i.status]}`}
          >
            {i.status === 'done' ? <Icon name="check" size={12} stroke={3} /> : <Icon name={LOOK[i.type].icon} size={12} stroke={2.4} />}
            <span className="tl-tip">{cap(i.name)} · {fmtTime(i.time)}<br /><em>{STATUS_WORD[i.status]}</em></span>
          </button>
          );
        })}
      </div>
    </div>
  );
}
