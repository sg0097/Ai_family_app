import { useState } from 'react';
import { ColumnChart, LineChart } from '../../components/charts';
import { Icon, RoutineIcon } from '../../components/Icon';
import { Skeleton } from '../../components/ui';
import { WeekGrid } from '../../components/WeekGrid';
import { fmtDate } from '../../format';
import { useApi } from '../../hooks';
import type { WeekSchedule, WeeklyReport } from '../../types';
import { useParent } from './ParentDashboard';

function shiftWeek(iso: string, weeks: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
const day = (iso: string) => fmtDate(iso, { weekday: 'short' });

export function ReportPage() {
  const { id, today } = useParent();
  const [start, setStart] = useState<string | null>(null);
  const q = start ? `?start=${start}` : '';
  const report = useApi<WeeklyReport>(`/parents/${id}/report${q}`, 30000);
  const schedule = useApi<WeekSchedule>(`/parents/${id}/schedule${q}`, 30000);
  const r = report.data;
  const name = today.parent.name;

  if (!r) return <div className="simple"><Skeleton h={60} /><Skeleton h={180} /><Skeleton h={320} /></div>;
  const g = r.glance;
  const range = `${fmtDate(r.week.start, { day: 'numeric', month: 'short' })} – ${fmtDate(r.week.end, { day: 'numeric', month: 'short' })}`;
  const loading = report.loading || schedule.loading;

  return (
    <div className="simple" style={{ opacity: loading ? 0.75 : 1, transition: 'opacity .25s' }}>
      <div className="report-head no-print">
        <div className="week-nav" role="group" aria-label="Week">
          <button className="btn quiet" aria-label="Previous week" onClick={() => setStart(shiftWeek(r.week.start, -1))}><Icon name="left" size={18} /></button>
          <span className="label">{r.week.isCurrent ? 'This week' : range}</span>
          <button className="btn quiet" aria-label="Next week" disabled={r.week.isCurrent} onClick={() => setStart(shiftWeek(r.week.start, 1))}><Icon name="right" size={18} /></button>
        </div>
        <button className="btn ghost sm" onClick={() => window.print()}><Icon name="print" size={16} /> Save as PDF</button>
      </div>

      <section className="card pad-lg">
        <div className="print-only" style={{ marginBottom: 10 }}><b>Weekly health report · {name}</b> · {range}</div>
        <div className="eyebrow" style={{ color: 'var(--muted)' }}>{r.week.isCurrent ? `So far this week · ${range}` : range}</div>
        <p className="report-summary" style={{ marginTop: 10 }}>{r.summary}</p>
        {r.changes.length > 0 && (
          <>
            <h3 style={{ margin: '22px 0 10px', color: 'var(--ink-2)' }}>What changed</h3>
            <ul className="changes">
              {r.changes.map((c) => <li key={c}><Icon name="arrow" size={16} />{c}</li>)}
            </ul>
          </>
        )}
      </section>

      <section className="glance" aria-label="At a glance">
        <Glance icon="MEDICINE" label="Medicine" big={g.medicine.asked ? <>{g.medicine.done}<small> of {g.medicine.asked}</small></> : '—'} sub={g.medicine.change ?? 'confirmed'} />
        <Glance icon="BP" label="BP readings" big={g.bp.count} sub={g.bp.change ?? '—'} />
        <Glance icon="WATER" label="Water a day" big={g.water.avg != null ? <>{g.water.avg}<small>{g.water.goal ? ` / ${g.water.goal}` : ''} gl</small></> : '—'} sub={g.water.change ?? (g.water.days ? `reported on ${g.water.days} days` : 'not reported')} />
        <Glance icon="WALK" label="Walks" big={g.walk.asked ? <>{g.walk.done}<small> of {g.walk.asked}</small></> : '—'} sub={g.walk.change ?? 'days'} />
      </section>

      <section className="card">
        <h2 style={{ marginBottom: 16 }}>Reminders</h2>
        {schedule.data ? <WeekGrid data={schedule.data} parentName={name} timeZone={today.parent.timezone} /> : <Skeleton h={240} />}
      </section>

      <section className="card">
        <div className="spread wrap" style={{ marginBottom: 8 }}>
          <h2>Blood pressure</h2>
          <span className="tiny">{r.readings.bp.list.length ? `Upper ${r.readings.bp.systolic!.min}–${r.readings.bp.systolic!.max} · lower ${r.readings.bp.diastolic!.min}–${r.readings.bp.diastolic!.max} mmHg` : ''}</span>
        </div>
        {r.readings.bp.list.length ? (
          <>
            <div className="legend tiny" style={{ display: 'flex', gap: 14, margin: '4px 0 8px' }}>
              <span className="key"><i style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--series-1)', verticalAlign: 'middle', marginRight: 6 }} />Upper</span>
              <span className="key"><i style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--series-2)', verticalAlign: 'middle', marginRight: 6 }} />Lower</span>
            </div>
            <LineChart dates={r.week.days} unit="mmHg" height={190} minSpan={40} series={[
              { key: 's', label: 'Upper', color: 'var(--series-1)', points: r.readings.bp.list.map((b) => ({ date: b.date, value: b.value })) },
              { key: 'd', label: 'Lower', color: 'var(--series-2)', points: r.readings.bp.list.map((b) => ({ date: b.date, value: b.value2! })) },
            ]} />
            <div className="reading-chips">
              {r.readings.bp.list.map((b) => <span key={b.at}>{day(b.date)}<b>{b.value}/{b.value2}</b></span>)}
            </div>
          </>
        ) : (
          <p className="muted">No BP readings this week.</p>
        )}
        <p className="tiny" style={{ marginTop: 12 }}>Readings are shown exactly as {name} sent them. Talk to their doctor about what they mean.</p>
      </section>

      <div className="two-col">
        <section className="card">
          <div className="spread" style={{ marginBottom: 8 }}><h2>Water</h2>{r.water.goal && <span className="tiny">Goal {r.water.goal} glasses</span>}</div>
          {r.water.byDay.some((d) => d.glasses != null)
            ? <ColumnChart data={r.water.byDay.map((d) => ({ date: d.date, value: d.glasses }))} color="var(--indigo)" unit="glasses" target={r.water.goal} height={170} />
            : <p className="muted">Not reported this week.</p>}
        </section>
        <section className="card">
          <h2 style={{ marginBottom: 14 }}>How {name} felt</h2>
          <div className="feel-row">
            {r.feelings.map((f) => (
              <div key={f.date} className="feel-day" title={f.level ?? 'No check-in'}>
                <span className={`feel-dot ${f.level ?? ''}`}>
                  {f.level ? <Icon name={f.level === 'good' ? 'smile' : f.level === 'okay' ? 'meh' : 'frown'} size={20} /> : <span>·</span>}
                </span>
                {day(f.date).slice(0, 2)}
              </div>
            ))}
          </div>
          <p className="tiny" style={{ marginTop: 14 }}>
            {(['good', 'okay', 'low'] as const).map((l) => `${r.feelings.filter((f) => f.level === l).length} ${l === 'low' ? 'not good' : l}`).join(' · ')}
          </p>
        </section>
      </div>

      {(r.readings.sugar.list.length > 0 || r.readings.weight.list.length > 0) && (
        <section className="card">
          <h2 style={{ marginBottom: 6 }}>Other readings</h2>
          {r.readings.sugar.list.length > 0 && (
            <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
              <RoutineIcon type="SUGAR" size={30} />
              <span className="small" style={{ fontWeight: 600 }}>Sugar</span>
              <div className="reading-chips" style={{ marginTop: 0 }}>
                {r.readings.sugar.list.map((s) => <span key={s.at}>{day(s.date)}<b>{s.value}</b>{s.context ? ` ${s.context}` : ''}</span>)}
              </div>
            </div>
          )}
          {r.readings.weight.list.length > 0 && (
            <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
              <RoutineIcon type="WEIGHT" size={30} />
              <span className="small" style={{ fontWeight: 600 }}>Weight</span>
              <div className="reading-chips" style={{ marginTop: 0 }}>
                {r.readings.weight.list.map((w) => <span key={w.at}>{day(w.date)}<b>{w.value} kg</b></span>)}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="two-col">
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>Mentioned</h2>
          {r.symptoms.length ? (
            <ul className="changes">
              {r.symptoms.map((s) => (
                <li key={s.name}>
                  <RoutineIcon type="SYMPTOM" size={28} />
                  <span><b style={{ textTransform: 'capitalize', color: 'var(--ink)' }}>{s.name}</b><br /><span className="tiny">{s.count}× · {s.days.map(day).join(', ')}{s.since ? ` · ${s.since}` : ''}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing mentioned this week.</p>}
        </section>
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>Not known</h2>
          {r.missing.length ? (
            <ul className="changes">{r.missing.map((m) => <li key={m}><Icon name="info" size={16} />{m}</li>)}</ul>
          ) : <p className="muted">Nothing missing. {name} replied to every reminder.</p>}
          <p className="tiny" style={{ marginTop: 12 }}>“No reply” means we didn’t hear back, not that something was missed.</p>
        </section>
      </div>

      <p className="report-foot">
        Prepared for {r.child} from {name}’s WhatsApp replies · heard from {name} on {r.contact.daysHeardFrom} of 7 days · not medical advice
      </p>
    </div>
  );
}

function Glance({ icon, label, big, sub }: { icon: 'MEDICINE' | 'BP' | 'WATER' | 'WALK'; label: string; big: React.ReactNode; sub: string }) {
  return (
    <div className="glance-tile reveal">
      <div className="row" style={{ gap: 8 }}><RoutineIcon type={icon} size={28} /><span className="small muted" style={{ fontWeight: 600 }}>{label}</span></div>
      <div className="big">{big}</div>
      <div className="tiny">{sub}</div>
    </div>
  );
}
