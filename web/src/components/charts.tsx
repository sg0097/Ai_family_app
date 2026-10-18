import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtDate } from '../format';

// Hand-rolled SVG charts. Specs: 2px lines, ≥8px end dots with a surface ring, ≤24px columns with
// 4px rounded data-ends, hairline solid gridlines, crosshair + one tooltip for lines, per-mark
// tooltips for columns and cells. Missing days are gaps, never zeros.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function xLabels(dates: string[], width: number) {
  const max = Math.max(2, Math.floor(width / 70));
  const every = Math.ceil(dates.length / max);
  return dates.map((d, i) => ((dates.length - 1 - i) % every === 0 ? d : null));
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: { date: string; value: number }[];
}

const PAD = { l: 36, r: 54, t: 14, b: 26 };

export function LineChart({ dates, series, unit, height = 220, refLines = [], minSpan = 0 }: { dates: string[]; series: LineSeries[]; unit: string; height?: number; refLines?: { value: number; label: string }[]; minSpan?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points.map((p) => p.value));
  if (!all.length) return <div className="empty small">No readings in this period yet.</div>;

  let lo = Math.min(...all, ...refLines.map((r) => r.value));
  let hi = Math.max(...all, ...refLines.map((r) => r.value));
  // A minimum span stops tiny changes (e.g. 0.3 kg) from looking like steep swings.
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const ticks = niceTicks(lo, hi);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (dates.length === 1 ? iw / 2 : (i / (dates.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const idx = new Map(dates.map((d, i) => [d, i]));
  // Several readings in a day: the line uses the last one.
  const byDay = series.map((s) => {
    const m = new Map<number, number>();
    for (const p of s.points) if (idx.has(p.date)) m.set(idx.get(p.date)!, p.value);
    return m;
  });
  const dataDays = [...new Set(byDay.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * iw + PAD.l;
    let best = dataDays[0];
    for (const d of dataDays) if (Math.abs(x(d) - px) < Math.abs(x(best) - px)) best = d;
    setHover(best);
  }

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.map((s) => s.label).join(' and ')} over time`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
          </g>
        ))}
        {refLines.map((r) => (
          <g key={r.label}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(r.value)} y2={y(r.value)} stroke="var(--axis)" strokeWidth={1} />
            <text x={width - PAD.r + 6} y={y(r.value) + 4}>{r.label}</text>
          </g>
        ))}
        {xLabels(dates, iw).map((d, i) => d && <text key={d} x={x(i)} y={height - 6} textAnchor="middle">{fmtDate(d)}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--line-strong)" strokeWidth={1} />}
        {series.map((s, si) => {
          const pts = [...byDay[si]].sort((a, b) => a[0] - b[0]);
          const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
          const last = pts[pts.length - 1];
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map(([i, v]) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : pts.length > 40 ? 0 : 3} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
              {last && (
                <>
                  <circle cx={x(last[0])} cy={y(last[1])} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  <text x={x(last[0]) + 9} y={y(last[1]) + 4} style={{ fill: 'var(--ink)', fontWeight: 600 }}>{last[1]}</text>
                </>
              )}
            </g>
          );
        })}
        <rect x={PAD.l} y={PAD.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / width) * 100}%`, top: Math.min(...series.map((_, si) => (byDay[si].has(hover) ? y(byDay[si].get(hover)!) : ih))) }}>
          <div className="t">{fmtDate(dates[hover], { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          {series.map((s, si) => (
            <div className="r" key={s.key}>
              <i style={{ background: s.color }} />
              <b>{byDay[si].get(hover) ?? '—'}</b>
              <span className="muted">{s.label}{byDay[si].has(hover) ? ` ${unit}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ColumnChart({ data, color, unit, target, height = 200 }: { data: { date: string; value: number | null }[]; color: string; unit: string; target?: number | null; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  if (!values.length) return <div className="empty small">Nothing reported in this period yet.</div>;
  const ticks = niceTicks(0, Math.max(...values, target ?? 0));
  const yMax = ticks[ticks.length - 1];
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const band = iw / data.length;
  const bw = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => PAD.t + ih - (v / yMax) * ih;
  const cx = (i: number) => PAD.l + band * i + band / 2;
  const r = Math.min(4, bw / 2);

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily ${unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          if (d.value == null || d.value === 0) return null;
          const top = y(d.value);
          const left = cx(i) - bw / 2;
          // Rounded data-end, square at the baseline.
          const path = `M${left},${PAD.t + ih} V${top + r} Q${left},${top} ${left + r},${top} H${left + bw - r} Q${left + bw},${top} ${left + bw},${top + r} V${PAD.t + ih} Z`;
          return <path key={d.date} d={path} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} style={{ transition: 'opacity .15s' }} />;
        })}
        {target != null && (
          <g>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--ink-2)" strokeWidth={1} />
            <text x={width - PAD.r + 6} y={y(target) + 4} style={{ fill: 'var(--ink-2)' }}>Goal {target}</text>
          </g>
        )}
        {xLabels(data.map((d) => d.date), iw).map((d, i) => d && <text key={d} x={cx(i)} y={height - 6} textAnchor="middle">{fmtDate(d)}</text>)}
        {data.map((d, i) => (
          <rect
            key={`hit${d.date}`}
            x={PAD.l + band * i}
            y={PAD.t}
            width={band}
            height={ih}
            fill="transparent"
            tabIndex={0}
            aria-label={`${fmtDate(d.date)}: ${d.value ?? 'not reported'}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(cx(hover) / width) * 100}%`, top: data[hover].value ? y(data[hover].value!) : PAD.t + ih }}>
          <div className="t">{fmtDate(data[hover].date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div className="r">
            {data[hover].value != null ? <><b>{data[hover].value}</b><span className="muted">{unit}</span></> : <span className="muted">Not reported</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export interface HeatRow {
  key: string;
  label: ReactNode;
  cells: { date: string; cls: string; tip: string }[];
}

/** Calendar strip: one row per routine, one cell per day. */
export function Heatmap({ rows, labelWidth = 150 }: { rows: HeatRow[]; labelWidth?: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const days = rows[0]?.cells.length ?? 0;
  const show = (e: React.SyntheticEvent<HTMLElement>, text: string) => {
    const box = ref.current!.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, text });
  };
  return (
    <div className="chart" ref={ref} onPointerLeave={() => setTip(null)}>
      <div className="heat" style={{ gridTemplateColumns: `${labelWidth}px repeat(${days}, minmax(0, 1fr))` }}>
        {rows.map((row) => (
          <div key={row.key} style={{ display: 'contents' }}>
            <div className="lab">{row.label}</div>
            {row.cells.map((c) => (
              <div
                key={c.date}
                className={`cell ${c.cls}`}
                tabIndex={0}
                role="img"
                aria-label={c.tip}
                onPointerEnter={(e) => show(e, c.tip)}
                onFocus={(e) => show(e, c.tip)}
                onBlur={() => setTip(null)}
              />
            ))}
          </div>
        ))}
      </div>
      {tip && <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}


export function ChartCard({ title, sub, legend, table, children, action }: { title: string; sub?: string; legend?: ReactNode; table?: ReactNode; children: ReactNode; action?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card chart-card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="sub" style={{ marginTop: 4 }}>{sub}</p>}
        </div>
        <div className="row">
          {action}
          {table && (
            <div className="segmented" role="group" aria-label="View">
              <button className={asTable ? '' : 'on'} onClick={() => setAsTable(false)}>Chart</button>
              <button className={asTable ? 'on' : ''} onClick={() => setAsTable(true)}>Table</button>
            </div>
          )}
        </div>
      </div>
      {legend && !asTable && <div className="legend" style={{ marginBottom: 12 }}>{legend}</div>}
      {asTable ? <div style={{ maxHeight: 320, overflow: 'auto' }}>{table}</div> : children}
    </section>
  );
}
