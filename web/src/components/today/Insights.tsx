import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartCard, ColumnChart, Heatmap, LineChart } from '../charts';
import { Icon, RoutineIcon, type IconName } from '../Icon';
import { Num } from '../Num';
import { PlanNote, Skeleton } from '../ui';
import { fmtDate } from '../../format';
import { useApi } from '../../hooks';
import type { DayStatus, Today, Trends } from '../../types';
import { RecordTable } from '../../pages/parent/TrendsTab';

const DAY_TEXT: Record<DayStatus, string> = { done: 'Done', not_done: 'Said “not yet”', no_response: 'No reply', waiting: 'Waiting', upcoming: 'Later', none: 'Not that day' };
const FEEL = [
  { key: 'good', label: 'Good', color: 'var(--heat-done)' },
  { key: 'okay', label: 'Okay', color: 'var(--heat-okay)' },
  { key: 'low', label: 'Not good', color: 'var(--heat-low)' },
] as const;

/** Four headline numbers for the week, each with how it compares. */
export function Kpis({ parentId, today }: { parentId: string; today: Today }) {
  const { data: t } = useApi<Trends>(`/parents/${parentId}/trends?days=7`, 60_000);
  const list = today.routines.filter((r) => r.status !== 'not_today');
  const done = list.filter((r) => r.status === 'done').length;
  const med = t?.stats.medicine;
  const prev = t?.stats.medicinePrev;
  const pct = med && med.closed ? Math.round((med.done / med.closed) * 100) : null;
  const prevPct = prev && prev.closed ? Math.round((prev.done / prev.closed) * 100) : null;
  const bp = today.latestReadings.bp;
  const cards: { icon: IconName; tone: string; label: string; value: React.ReactNode; foot: React.ReactNode; bar?: number; to: string }[] = [
    { icon: 'check', tone: 'green', label: 'Today', value: <><Num value={done} /><small>/{list.length}</small></>, foot: list.length - done > 0 ? `${list.length - done} still to come or waiting` : 'All done for today', bar: list.length ? done / list.length : 0, to: '#today-tiles' },
    {
      icon: 'pill', tone: 'pink', label: 'Medicine this week',
      value: pct == null ? '—' : <><Num value={pct} /><small>%</small></>,
      foot: pct == null ? 'No medicine replies yet' : prevPct == null ? `${med!.done} of ${med!.closed} confirmed` : <Delta now={pct} before={prevPct} unit=" pts" />,
      bar: pct == null ? undefined : pct / 100, to: 'care',
    },
    { icon: 'heart', tone: 'violet', label: 'Latest BP', value: bp ? bp.value : '—', foot: bp ? `${t?.stats.bpReadings ?? 0} readings this week` : 'Not sent yet', to: 'history' },
    { icon: 'message', tone: 'blue', label: 'Heard from her', value: t ? <><Num value={t.stats.daysHeardFrom} /><small>/7 days</small></> : '—', foot: t && t.stats.streak > 1 ? `${t.stats.streak}-day reply streak` : 'Days she replied this week', bar: t ? t.stats.daysHeardFrom / 7 : undefined, to: 'history?view=messages' },
  ];
  return (
    <div className="kpis">
      {cards.map((c) => (
        <Link key={c.label} to={c.to.startsWith('#') ? '' : c.to} onClick={c.to.startsWith('#') ? (e) => { e.preventDefault(); document.querySelector(c.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } : undefined} className={`kpi t-${c.tone}`}>
          <div className="kpi-top"><span className={`ichip c-${c.tone}`} aria-hidden><Icon name={c.icon} stroke={2.4} /></span><span>{c.label}</span></div>
          <div className="kpi-val">{c.value}</div>
          {c.bar != null && <div className="kpi-bar" aria-hidden><span style={{ width: `${Math.round(c.bar * 100)}%` }} /></div>}
          <div className="kpi-foot">{c.foot}<Icon name="arrow" size={14} /></div>
        </Link>
      ))}
    </div>
  );
}

/** Change against last week, said in words; no green/red judgement of health, just up or down. */
function Delta({ now, before, unit }: { now: number; before: number; unit: string }) {
  const d = now - before;
  if (d === 0) return <span>Same as last week</span>;
  return <span><b className={d > 0 ? 'up' : 'down'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{unit}</b> vs last week</span>;
}

/** The charts: one range control for all of them, each with hover and a table view. */
export function Insights({ parentId, today }: { parentId: string; today: Today }) {
  const [days, setDays] = useState(14);
  const { data, loading, error } = useApi<Trends>(`/parents/${parentId}/trends?days=${days}`, 60_000);
  const tz = today.parent.timezone;
  const day = (iso: string) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' }, tz);
  const feel = data ? FEEL.map((f) => ({ ...f, n: data.wellbeing.filter((w) => w.level === f.key).length })) : [];
  const feelTotal = feel.reduce((a, f) => a + f.n, 0);

  return (
    <section className="insights">
      <div className="insights-head">
        <h2>Her health, at a glance</h2>
        <div className="segmented" role="group" aria-label="Date range">
          {[7, 14, 30].map((d) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} days</button>)}
        </div>
      </div>
      {error && <PlanNote text={error} />}
      {!data ? <Skeleton h={320} /> : (
        <div className="insights-grid" style={{ opacity: loading ? 0.6 : 1 }}>
          <ChartCard
            title="Blood pressure"
            sub={`${data.bp.length} reading${data.bp.length === 1 ? '' : 's'} · mmHg · as she sent them`}
            legend={<><span className="key"><i style={{ background: 'var(--series-1)' }} />Upper</span><span className="key"><i style={{ background: 'var(--series-2)' }} />Lower</span></>}
            table={<RecordTable head={['Date', 'Reading']} rows={data.bp.slice().reverse().map((b) => [day(b.at), `${b.systolic}/${b.diastolic}`])} />}
          >
            <LineChart dates={data.dates} unit="mmHg" height={220} minSpan={40} series={[
              { key: 'sys', label: 'Upper', color: 'var(--series-1)', points: data.bp.map((b) => ({ date: b.date, value: b.systolic })) },
              { key: 'dia', label: 'Lower', color: 'var(--series-2)', points: data.bp.map((b) => ({ date: b.date, value: b.diastolic })) },
            ]} />
          </ChartCard>

          <ChartCard
            title="Blood sugar"
            sub={`${data.sugar.length} reading${data.sugar.length === 1 ? '' : 's'} · mg/dL`}
            table={<RecordTable head={['Date', 'Reading', 'When']} rows={data.sugar.slice().reverse().map((s) => [day(s.at), String(s.value), s.context ?? '—'])} />}
          >
            <LineChart dates={data.dates} unit="mg/dL" height={220} minSpan={40} series={[{ key: 'sugar', label: 'Sugar', color: 'var(--series-1)', points: data.sugar.map((s) => ({ date: s.date, value: s.value })) }]} />
          </ChartCard>

          <div className="wide">
            <ChartCard
              title="Reminders calendar"
              sub="Each square is one day. Hover for details."
              legend={<>
                <span className="key"><i className="sq" style={{ background: 'var(--heat-done)' }} />Done</span>
                <span className="key"><i className="sq" style={{ background: 'var(--heat-notyet)' }} />Said “not yet”</span>
                <span className="key"><i className="sq" style={{ background: 'var(--neutral)' }} />No reply</span>
              </>}
              table={<RecordTable head={['Reminder', 'Done', '“Not yet”', 'No reply']} rows={data.adherence.map((r) => [r.name, ...(['done', 'not_done', 'no_response'] as const).map((s) => String(r.days.filter((d) => d.status === s).length))])} />}
            >
              <Heatmap
                labelWidth={170}
                rows={data.adherence.map((r) => ({
                  key: r.id,
                  label: <span className="row" style={{ gap: 8 }}><RoutineIcon type={r.type} size={24} />{r.name}</span>,
                  cells: r.days.map((d) => ({ date: d.date, cls: d.status, tip: `${day(d.date)} · ${r.name}: ${DAY_TEXT[d.status]}${d.note ? ` (${d.note})` : ''}` })),
                }))}
              />
              <p className="tiny" style={{ marginTop: 10 }}>“No reply” means we didn’t hear back. It’s missing information, not a missed dose.</p>
            </ChartCard>
          </div>

          <ChartCard
            title="Water"
            sub={data.stats.waterDays ? `Average ${data.stats.waterAvg} glasses a day${data.waterTarget ? `, goal ${data.waterTarget}` : ''}` : 'Not reported in this period'}
            table={<RecordTable head={['Date', 'Glasses']} rows={data.water.slice().reverse().map((w) => [day(w.date), w.glasses == null ? 'Not reported' : String(w.glasses)])} />}
          >
            <ColumnChart data={data.water.map((w) => ({ date: w.date, value: w.glasses }))} color="var(--series-1)" unit="glasses" target={data.waterTarget} height={200} />
          </ChartCard>

          <ChartCard
            title="How she felt"
            sub={feelTotal ? `${feelTotal} daily check-ins` : 'No check-ins in this period'}
            table={<RecordTable head={['Date', 'Felt']} rows={data.wellbeing.filter((w) => w.level).slice().reverse().map((w) => [day(w.date), FEEL.find((f) => f.key === w.level)!.label])} />}
          >
            {feelTotal > 0 && (
              <>
                <div className="feel-bar" role="img" aria-label={feel.map((f) => `${f.label} ${f.n}`).join(', ')}>
                  {feel.filter((f) => f.n).map((f) => <span key={f.key} style={{ flex: f.n, background: f.color }} title={`${f.label}: ${f.n} day${f.n === 1 ? '' : 's'}`} />)}
                </div>
                <ul className="feel-legend">
                  {feel.map((f) => <li key={f.key}><i style={{ background: f.color }} />{f.label}<b>{f.n}</b></li>)}
                </ul>
                <div className="feel-days" aria-hidden>
                  {data.wellbeing.map((w) => <span key={w.date} title={`${day(w.date)}: ${w.level ? FEEL.find((f) => f.key === w.level)!.label : 'no check-in'}`} style={{ background: w.level ? FEEL.find((f) => f.key === w.level)!.color : undefined }} />)}
                </div>
              </>
            )}
          </ChartCard>
        </div>
      )}
    </section>
  );
}
