import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import type { ChatMessage, Routine } from '../types';
import { Chat } from './Chat';

const QUICK = ['Haan beta, breakfast ke baad le li thi', 'Aaj BP 138/85 tha', '5 glass paani hua hai', 'Kal se pair mein thoda dard hai', 'Kaise ho beta?', 'HELP'];

/** Dev only: stands in for the parent's WhatsApp so the whole loop can be tried without Meta. */
export function PhoneDrawer({ parentId, parentName, parentPhone, timeZone, onChange }: { parentId: string; parentName: string; parentPhone: string; timeZone: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const msgs = useApi<ChatMessage[]>(open ? `/parents/${parentId}/messages?limit=80` : null, 2500);
  const routines = useApi<Routine[]>(open ? `/parents/${parentId}/routines` : null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      // Workers reply asynchronously (the AI can take a few seconds).
      for (const ms of [500, 2000, 5000]) setTimeout(() => { msgs.reload(); onChange(); }, ms);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const send = (body: string, payload?: string) => run(() => api('/dev/inbound', { body: { parentId, text: body, payload } }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    send(text.trim());
    setText('');
  }

  if (!open) {
    return (
      <button className="btn coral phone-fab" onClick={() => setOpen(true)}>
        📱 {parentName}’s phone
      </button>
    );
  }
  return (
    <aside className="drawer" aria-label={`${parentName}'s WhatsApp (simulator)`}>
      <div className="drawer-head">
        <div>
          <b>{parentName}’s phone</b>
          <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>Dev simulator · +{parentPhone}</div>
        </div>
        <button className="btn quiet sm" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label="Close simulator">✕</button>
      </div>
      <div className="tools">
        <button className="btn ghost sm" disabled={busy} onClick={() => run(() => api('/dev/tick', { method: 'POST' }))}>Run scheduler</button>
        <select
          className="input"
          aria-label="Send a reminder now"
          value=""
          style={{ flex: 1, padding: '7px 10px', fontSize: '0.85rem', width: 'auto' }}
          onChange={(e) => e.target.value && run(() => api(`/routines/${e.target.value}/send-now`, { method: 'POST' }))}
        >
          <option value="">Send reminder now…</option>
          {routines.data?.filter((r) => r.active).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <Chat messages={msgs.data ?? []} parentPhone={parentPhone} timeZone={timeZone} asParent onTap={(b) => send(b.title, b.id)} height="auto" />
      {error && <p className="error" style={{ padding: '6px 12px 0' }}>{error}</p>}
      <div className="quick">
        {QUICK.map((q) => (
          <button key={q} className="chip" disabled={busy} onClick={() => send(q)}>{q}</button>
        ))}
      </div>
      <form className="composer" onSubmit={submit}>
        <input className="input" aria-label="Message" placeholder={`Reply as ${parentName}…`} value={text} onChange={(e) => setText(e.target.value)} style={{ borderRadius: 999 }} />
        <button type="submit" className="btn" disabled={busy || !text.trim()}>Send</button>
      </form>
    </aside>
  );
}
