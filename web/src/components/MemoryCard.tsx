import { useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../format';
import { useApi } from '../hooks';
import { Icon } from './Icon';
import type { Memory } from '../types';

const KIND: Record<Memory['kind'], string> = { HEALTH: 'Health', HABIT: 'Habit', PREFERENCE: 'Preference' };

/** Patterns across weeks of messages, each with the messages it came from. The family decides what to keep. */
export function MemoryCard({ parentId, parentName, timeZone }: { parentId: string; parentName: string; timeZone: string }) {
  const { data, reload } = useApi<Memory[]>(`/parents/${parentId}/memory`);
  const [open, setOpen] = useState<string | null>(null);
  const set = async (m: Memory, status: 'KEPT' | 'DISMISSED') => {
    await api(`/memory/${m.id}`, { method: 'PATCH', body: { status } });
    reload();
  };
  return (
    <section className="card">
      <h2><span className="h-ic t-green"><Icon name="memory" size={15} /></span>What we’ve noticed</h2>
      <p className="tiny" style={{ marginTop: 2, marginBottom: 10 }}>
        Patterns across weeks of {parentName}’s messages that are easy to miss day to day. Each one shows where it came from. Kept ones help answer your questions.
      </p>
      {!data ? null : data.length === 0 ? (
        <p className="tiny empty-line">Nothing yet. Patterns show up after a few weeks of replies.</p>
      ) : (
        <ul className="memories">
          {data.map((m) => (
            <li key={m.id} className={m.status === 'KEPT' ? 'kept' : ''}>
              <div className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <span className="mem-kind">{KIND[m.kind]}{m.status === 'KEPT' ? ' · kept' : ''}</span>
                  <div className="mem-text">{m.text}</div>
                  <button className="link-btn small" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? 'Hide' : `Show where this came from (${m.evidence.length})`}</button>
                </div>
                <div className="row" style={{ gap: 6, flex: 'none' }}>
                  {m.status === 'SUGGESTED' && <button className="btn sm" onClick={() => set(m, 'KEPT')}>Keep</button>}
                  <button className="btn quiet sm" onClick={() => set(m, 'DISMISSED')}>{m.status === 'KEPT' ? 'Forget' : 'Dismiss'}</button>
                </div>
              </div>
              {open === m.id && (
                <ul className="evidence">
                  {m.evidence.map((e, i) => (
                    <li key={i}><span className="tiny num">{fmtDate(e.at, { day: 'numeric', month: 'short' }, timeZone)}</span> <span className="quote-inline">{e.quote}</span></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
