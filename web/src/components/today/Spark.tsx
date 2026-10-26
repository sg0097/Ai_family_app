import { useState } from 'react';

/** A small line chart with a dot you can hover or tap for the exact value. */
export function Spark({ points, label, height = 56 }: { points: { v: number; tip: string }[]; label: string; height?: number }) {
  const [hot, setHot] = useState<number | null>(null);
  if (points.length < 2) return <div className="spark-empty tiny">Not enough readings yet</div>;
  const w = 220;
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = Math.max(hi - lo, 1);
  const x = (i: number) => (i / (points.length - 1)) * (w - 8) + 4;
  const y = (v: number) => height - 6 - ((v - lo) / span) * (height - 14);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const shown = hot ?? points.length - 1;
  return (
    <div className="spark">
      <div className="spark-box">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}
        onMouseLeave={() => setHot(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHot(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)));
        }}>
        <path d={`${d} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`} className="spark-area" />
        <path d={d} pathLength={1} className="spark-line" />
        <line x1={x(shown)} x2={x(shown)} y1={0} y2={height} className="spark-guide" />
      </svg>
      {/* The dot is HTML so it stays round while the chart stretches to fit. */}
      <span className="spark-dot" style={{ left: `${(x(shown) / w) * 100}%`, top: `${(y(points[shown].v) / height) * 100}%` }} />
      </div>
      <div className="spark-tip tiny">{points[shown].tip}</div>
    </div>
  );
}
