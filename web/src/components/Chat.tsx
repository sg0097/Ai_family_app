import { useEffect, useRef } from 'react';
import { fmtClock, fmtDate } from '../format';
import type { ChatMessage } from '../types';

const HANDLED: Record<string, string> = { RULES: 'read by rules', LLM: 'read by AI', BUTTON: 'button', NONE: 'not understood' };

interface Props {
  messages: ChatMessage[];
  parentPhone: string;
  asParent?: boolean; // simulator: we're holding the parent's phone
  onTap?: (button: { id: string; title: string }) => void;
  height?: number | string;
  timeZone: string; // the parent's
}

export function Chat({ messages, parentPhone, asParent, onTap, height = 520, timeZone }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1]?.id;
  // Keep the newest message in view without scrolling the page itself.
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [last]);

  // The parent's phone only shows messages sent to the parent.
  const shown = asParent ? messages.filter((m) => m.direction === 'IN' || m.toPhone === parentPhone) : messages;
  let lastDay = '';

  return (
    <div ref={box} className={`chat${asParent ? ' as-parent' : ''}`} style={{ height }}>
      {shown.length === 0 && <p className="tiny" style={{ textAlign: 'center', margin: 'auto' }}>No messages yet</p>}
      {shown.map((m) => {
        const day = fmtDate(m.createdAt, { year: 'numeric', month: 'numeric', day: 'numeric' }, timeZone);
        const divider = day !== lastDay;
        lastDay = day;
        const toChild = m.direction === 'OUT' && m.toPhone && m.toPhone !== parentPhone;
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {divider && (
              <div style={{ alignSelf: 'center', margin: '8px 0' }}>
                <span className="pill" style={{ background: 'var(--surface)' }}>{fmtDate(m.createdAt, { weekday: 'short', day: 'numeric', month: 'short' }, timeZone)}</span>
              </div>
            )}
            <div className={`bubble ${m.direction === 'IN' ? 'parent' : 'system'}`}>
              {toChild && <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.7 }}>Alert sent to you</div>}
              {m.body}
              {m.buttons && m.buttons.length > 0 && (
                <div className="bb">
                  {m.buttons.map((b) => (
                    <button key={b.id} type="button" disabled={!onTap} onClick={() => onTap?.(b)}>{b.title}</button>
                  ))}
                </div>
              )}
              <div className="meta">
                {!asParent && m.direction === 'IN' && m.handledBy && `${HANDLED[m.handledBy] ?? m.handledBy} · `}
                {!asParent && m.kind === 'template' && 'template · '}
                {m.kind === 'dropped' && 'not sent (24h window) · '}
                {fmtClock(m.createdAt, timeZone)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
