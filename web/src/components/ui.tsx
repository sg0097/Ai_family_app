import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

export function Logo({ to = '/', tagline = true }: { to?: string; tagline?: boolean }) {
  return (
    <Link to={to} className="logo" aria-label="Family Care home">
      {/* A home with a heart for a window: drawn in ink, like a doodle in a margin. */}
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <path d="M3.5 14.2 15.8 3.6l12.7 10.8" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 12.3v14.4c0 .7.5 1.2 1.2 1.2h15.7c.7 0 1.2-.5 1.2-1.2V12.4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M16 23.6s-4.6-2.7-4.6-5.9c0-1.5 1.1-2.6 2.5-2.6.9 0 1.7.5 2.1 1.2.4-.7 1.2-1.2 2.1-1.2 1.4 0 2.5 1.1 2.5 2.6 0 3.2-4.6 5.9-4.6 5.9Z" fill="var(--coral)" />
      </svg>
      <span>
        Family Care
        {tagline && <span className="logo-sub">ghar ki khabar</span>}
      </span>
    </Link>
  );
}

const AVATAR_TONES = ['violet', 'pink', 'blue', 'green', 'orange', 'amber'];

/** Initial on a colour picked from the name, so each person keeps the same colour everywhere. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={`avatar av-${tone}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Progress ring. Track is a lighter step of the fill so state reads across the whole ring. */
export function Ring({ value, total, size = 120, stroke = 11, children }: { value: number; total: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = total ? Math.min(1, value / total) : 0;
  // Start empty, then fill: the stroke transition animates it.
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} of ${total} done`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--idle-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ok)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Rendered at the body so animated (transformed) page containers can't trap the fixed overlay.
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="spread" style={{ marginBottom: 18 }}>
          <h2>{title}</h2>
          <button className="btn quiet sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Toast({ message }: { message: string | null }) {
  return message ? createPortal(<div className="toast" role="status">{message}</div>, document.body) : null;
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />;
}
