import { Link } from 'react-router-dom';
import { fmtAgo, fmtDate } from '../../format';
import { useApi } from '../../hooks';
import type { Today, Trends } from '../../types';
import { Icon, type IconName } from '../Icon';
import { Spark } from './Spark';

const FEEL: Record<string, string> = { good: 'Good', okay: 'Okay', low: 'Not good' };

/** BP, sugar, water and mood as four small cards you can hover for any day. */
export function ReadingCards({ parentId, today }: { parentId: string; today: Today }) {
  const { data: t } = useApi<Trends>(`/parents/${parentId}/trends?days=14`, 60_000);
  const r = today.latestReadings;
  const tz = today.parent.timezone;
  const day = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'short' }, tz);
  const cards: { key: string; icon: IconName; tone: string; label: string; value: string | null; at: string | null; body: React.ReactNode }[] = [
    {
      key: 'bp', icon: 'heart', tone: 'violet', label: 'BP', value: r.bp?.value ?? null, at: r.bp?.at ?? null,
      body: <Spark points={(t?.bp ?? []).map((b) => ({ v: b.systolic, tip: `${b.systolic}/${b.diastolic} · ${day(b.at)}` }))} label="Blood pressure, last 2 weeks" />,
    },
    {
      key: 'sugar', icon: 'drop', tone: 'amber', label: 'Sugar', value: r.sugar?.value ?? null, at: r.sugar?.at ?? null,
      body: <Spark points={(t?.sugar ?? []).map((s) => ({ v: s.value, tip: `${s.value}${s.context ? ` ${s.context}` : ''} · ${day(s.at)}` }))} label="Sugar, last 2 weeks" />,
    },
    {
      key: 'water', icon: 'glass', tone: 'blue', label: 'Water', value: r.waterToday ? `${r.waterToday.glasses}${r.waterToday.goal ? ` of ${r.waterToday.goal}` : ''} glasses` : null, at: r.waterToday?.at ?? null,
      body: (
        <div className="mini-bars" aria-label="Glasses of water per day">
          {(t?.water ?? []).map((w) => (
            <span key={w.date} title={`${fmtDate(w.date, { weekday: 'short', day: 'numeric' })}: ${w.glasses ?? 'not sent'}`} style={{ height: `${w.glasses ? Math.min(100, (w.glasses / (t?.waterTarget ?? 8)) * 100) : 6}%` }} className={w.glasses ? '' : 'none'} />
          ))}
        </div>
      ),
    },
    {
      key: 'mood', icon: 'smile', tone: 'orange', label: 'Feeling', value: (() => { const last = [...(t?.wellbeing ?? [])].reverse().find((w) => w.level); return last?.level ? FEEL[last.level] : null; })(), at: null,
      body: (
        <div className="mood-row" aria-label="How she felt each day">
          {(t?.wellbeing ?? []).map((w) => <span key={w.date} className={`mood ${w.level ?? 'none'}`} title={`${fmtDate(w.date, { weekday: 'short', day: 'numeric' })}: ${w.level ? FEEL[w.level] : 'no check-in'}`} />)}
        </div>
      ),
    },
  ];
  return (
    <div className="rcards">
      {cards.map((c) => (
        <Link key={c.key} to="history" className={`rcard t-${c.tone}`}>
          <div className="rcard-top">
            <span className={`ichip c-${c.tone}`} aria-hidden><Icon name={c.icon} stroke={2.4} /></span>
            <span className="tiny">{c.label}</span>
          </div>
          <div className="rcard-val">{c.value ?? <span className="soft">Not sent yet</span>}</div>
          <div className="tiny">{c.at ? fmtAgo(c.at) : c.key === 'mood' ? 'latest check-in' : ' '}</div>
          <div className="rcard-chart">{c.body}</div>
        </Link>
      ))}
    </div>
  );
}
