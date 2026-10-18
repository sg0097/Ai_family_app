import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { AskAnswer } from '../types';

/** One line to ask anything; answers come only from what was recorded, with the records one tap away. */
export function Ask({ parentId, name }: { parentId: string; name: string }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<(AskAnswer & { q: string }) | null>(null);
  const [err, setErr] = useState('');
  const suggestions = [`How was ${name}’s week?`, 'When was the last BP reading?', `Did ${name} miss any medicine?`];

  async function ask(question: string) {
    if (question.trim().length < 2) return;
    setBusy(true);
    setErr('');
    setRes(null);
    try {
      setRes({ ...(await api<AskAnswer>(`/parents/${parentId}/ask`, { body: { question } })), q: question });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(q);
  };

  return (
    <section className="card ask">
      <h2 style={{ marginBottom: 12 }}>Ask about {name}</h2>
      <form className="ask-box" onSubmit={submit}>
        <input aria-label={`Ask about ${name}`} placeholder="Type a question…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn coral sm" disabled={busy || q.trim().length < 2}>{busy ? 'Thinking…' : 'Ask'}</button>
      </form>
      {!res && !busy && (
        <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
          {suggestions.map((s) => (
            <button key={s} className="chip" onClick={() => { setQ(s); ask(s); }}>{s}</button>
          ))}
        </div>
      )}
      {busy && <div className="answer"><div className="skeleton" style={{ height: 14, width: '90%' }} /><div className="skeleton" style={{ height: 14, width: '60%', marginTop: 8 }} /></div>}
      {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
      {res && (
        <div className="answer">
          <p style={{ fontSize: '1.02rem' }}>{res.answer}</p>
          <details open={!res.usedModel}>
            <summary>{res.usedModel ? 'Based on these records' : 'The records'}</summary>
            <ul>{res.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </details>
          <button className="link-btn small" style={{ marginTop: 10 }} onClick={() => { setRes(null); setQ(''); }}>Ask something else</button>
        </div>
      )}
    </section>
  );
}
