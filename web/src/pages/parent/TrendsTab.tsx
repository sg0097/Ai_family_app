import { useState } from 'react';
import { ChartCard, ColumnChart, Heatmap, LineChart } from '../../components/charts';
import { PlanNote, Skeleton } from '../../components/ui';
import { RoutineIcon } from '../../components/Icon';
import { fmtDate } from '../../format';
import { useApi } from '../../hooks';
import type { DayStatus, Trends } from '../../types';
import { useParent } from './ParentDashboard';

const DAY_TEXT: Record<DayStatus, string> = {
  done: 'Done',
  not_done: 'Said “not yet”',
  no_response: 'No reply',
  waiting: 'Waiting for reply',
  upcoming: 'Later today',
  none: 'Not scheduled',
};
const FEEL: Record<string, { cls: string; text: string }> = {
  good: { cls: 'done', text: 'Good' },
  okay: { cls: 'okay', text: 'Okay' },
  low: { cls: 'low', text: 'Not good' },
};

export function TrendsTab() {
  const { id, today } = useParent();
  const [days, setDays] = useState(14);
  const { data, loading, error } = useApi<Trends>(`/parents/${id}/trends?days=${days}`);
  const name = today.parent.name;

  return (
    <div className="stack">
      <div className="spread wrap">
        <div className="segmented" role="group" aria-label="Date range">
          {[7, 14, 30, 90].map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>Last {d} days</button>
          ))}
        </div>
        {data && <span className="tiny">{fmtDate(data.range.from)} – {fmtDate(data.range.to)} · heard from {name} on {data.stats.daysHeardFrom} of {days} days</span>}
      </div>

      {error && <PlanNote text={error} />}
      {!data ? (
        <><Skeleton h={300} /><Skeleton h={260} /></>
      ) : (
        <div className="stack" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <ChartCard
            title="Blood pressure"
            sub={`${data.bp.length} reading${data.bp.length === 1 ? '' : 's'} · mmHg · shown as reported, not interpreted`}
            legend={<><span className="key"><i style={{ background: 'var(--series-1)' }} />Systolic (upper)</span><span className="key"><i style={{ background: 'var(--series-2)' }} />Diastolic (lower)</span></>}
            table={<RecordTable head={['Date', 'Reading', 'From']} rows={data.bp.slice().reverse().map((b) => [fmtDate(b.at, { weekday: 'short', day: 'numeric', month: 'short' }, today.parent.timezone), `${b.systolic}/${b.diastolic}`, b.source === 'DASHBOARD' ? 'You' : 'WhatsApp'])} />}
          >
            <LineChart
              dates={data.dates}
              unit="mmHg"
              height={260}
              minSpan={40}
              series={[
                { key: 'sys', label: 'Systolic', color: 'var(--series-1)', points: data.bp.map((b) => ({ date: b.date, value: b.systolic })) },
                { key: 'dia', label: 'Diastolic', color: 'var(--series-2)', points: data.bp.map((b) => ({ date: b.date, value: b.diastolic })) },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Reminders calendar"
            sub="Each square is one day. Hover for details."
            legend={
              <>
                <span className="key"><i className="sq" style={{ background: 'var(--heat-done)' }} />Done</span>
                <span className="key"><i className="sq" style={{ background: 'var(--heat-notyet)' }} />Said “not yet”</span>
                <span className="key"><i className="sq" style={{ background: 'var(--neutral)' }} />No reply</span>
                <span className="key"><i className="sq" style={{ boxShadow: 'inset 0 0 0 2px var(--coral)' }} />Waiting</span>
              </>
            }
            table={
              <RecordTable
                head={['Routine', 'Confirmed', '“Not yet”', 'No reply']}
                rows={data.adherence.map((r) => [r.name, ...(['done', 'not_done', 'no_response'] as const).map((s) => String(r.days.filter((d) => d.status === s).length))])}
              />
            }
          >
            <Heatmap
              labelWidth={days > 30 ? 130 : 160}
              rows={data.adherence.map((r) => ({
                key: r.id,
                label: <span className="row" style={{ gap: 8 }}><RoutineIcon type={r.type} size={24} />{r.name}</span>,
                cells: r.days.map((d) => ({ date: d.date, cls: d.status, tip: `${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${r.name}: ${DAY_TEXT[d.status]}${d.note ? ` (${d.note})` : ''}` })),
              }))}
            />
            <p className="tiny" style={{ marginTop: 12 }}>“No reply” means we didn’t hear back. It’s missing information, not a missed dose.</p>
          </ChartCard>

          <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <ChartCard
              title="Water"
              sub={data.stats.waterDays ? `Average ${data.stats.waterAvg} glasses on ${data.stats.waterDays} reported days` : 'Not reported in this period'}
              table={<RecordTable head={['Date', 'Glasses']} rows={data.water.slice().reverse().map((w) => [fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' }), w.glasses == null ? 'Not reported' : String(w.glasses)])} />}
            >
              <ColumnChart data={data.water.map((w) => ({ date: w.date, value: w.glasses }))} color="var(--indigo)" unit="glasses" target={data.waterTarget} />
            </ChartCard>
            <ChartCard
              title="Blood sugar"
              sub={`${data.sugar.length} reading${data.sugar.length === 1 ? '' : 's'} · mg/dL`}
              table={<RecordTable head={['Date', 'Reading', 'When']} rows={data.sugar.slice().reverse().map((s) => [fmtDate(s.at, { weekday: 'short', day: 'numeric', month: 'short' }, today.parent.timezone), String(s.value), s.context ?? '—'])} />}
            >
              <LineChart dates={data.dates} unit="mg/dL" minSpan={40} series={[{ key: 'sugar', label: 'Sugar', color: 'var(--series-1)', points: data.sugar.map((s) => ({ date: s.date, value: s.value })) }]} />
            </ChartCard>
          </div>

          <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            <ChartCard
              title="How they felt"
              sub="From the evening check-in"
              legend={<><span className="key"><i className="sq" style={{ background: 'var(--heat-done)' }} />Good</span><span className="key"><i className="sq" style={{ background: 'var(--heat-okay)' }} />Okay</span><span className="key"><i className="sq" style={{ background: 'var(--heat-low)' }} />Not good</span></>}
              table={<RecordTable head={['Date', 'Feeling']} rows={data.wellbeing.filter((w) => w.level).reverse().map((w) => [fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' }), FEEL[w.level!].text])} />}
            >
              {data.wellbeing.some((w) => w.level) ? (
                <Heatmap labelWidth={0} rows={[{ key: 'feel', label: '', cells: data.wellbeing.map((w) => ({ date: w.date, cls: w.level ? FEEL[w.level].cls : 'none', tip: `${fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${w.level ? FEEL[w.level].text : 'Not asked or no reply'}` })) }]} />
              ) : (
                <div className="empty small">No check-ins in this period. Add a “Feeling” reminder in Settings to start.</div>
              )}
            </ChartCard>
            <ChartCard title="Mentioned symptoms" sub="Things they brought up, grouped">
              {data.symptoms.length ? (
                <div className="stack" style={{ gap: 12 }}>
                  {data.symptoms.map((s) => {
                    const max = Math.max(...data.symptoms.map((x) => x.count));
                    return (
                      <div key={s.name}>
                        <div className="spread small"><b style={{ textTransform: 'capitalize' }}>{s.name}</b><span className="muted">{s.count}×</span></div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', marginTop: 6 }}>
                          <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--series-2)', transition: 'width .6s' }} />
                        </div>
                        <div className="tiny" style={{ marginTop: 4 }}>{s.days.map((d) => fmtDate(d)).join(', ')}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty small">Nothing mentioned in this period.</div>
              )}
            </ChartCard>
          </div>

          {data.weight.length > 0 && (
            <ChartCard title="Weight" sub="kg" table={<RecordTable head={['Date', 'kg']} rows={data.weight.slice().reverse().map((w) => [fmtDate(w.at, undefined, today.parent.timezone), String(w.value)])} />}>
              <LineChart dates={data.dates} unit="kg" height={180} minSpan={6} series={[{ key: 'w', label: 'Weight', color: 'var(--series-1)', points: data.weight.map((w) => ({ date: w.date, value: w.value })) }]} />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

export function RecordTable({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <div className="empty small">No records.</div>;
  return (
    <table className="table">
      <thead>
        <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
