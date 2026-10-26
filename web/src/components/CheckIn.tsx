import { useState } from 'react';
import { api } from '../api';
import { fmtAgo } from '../format';
import { useApi } from '../hooks';
import type { CheckIns, VoiceClip } from '../types';
import { Icon } from './Icon';
import { Modal } from './ui';

const ANSWER: Record<string, { word: string; icon: 'smile' | 'meh' | 'frown' }> = {
  good: { word: 'Good', icon: 'smile' },
  okay: { word: 'Okay', icon: 'meh' },
  low: { word: 'Not so good', icon: 'frown' },
};

/** "How are you?" from the child, with three one-tap answers for the parent. */
export function CheckInDialog({ parentId, parentName, onClose, onSent }: { parentId: string; parentName: string; onClose: () => void; onSent: () => void }) {
  const data = useApi<CheckIns>(`/parents/${parentId}/check-ins`);
  const clips = useApi<VoiceClip[]>(`/parents/${parentId}/voice`);
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ideas = data.data?.ideas ?? [];

  async function send() {
    setBusy(true);
    setError('');
    try {
      await api(`/parents/${parentId}/check-ins`, { body: { text, voiceClipId: voice || null } });
      onSent();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Check in with ${parentName}`} onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 12 }}>A short note from you on WhatsApp. {parentName} answers with one tap: good, okay or not so good.</p>
      <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
        {ideas.map((i) => <button key={i} type="button" className={`chip${text === i ? ' on' : ''}`} onClick={() => setText(i)}>{i}</button>)}
      </div>
      <textarea className="input" rows={2} maxLength={200} placeholder="Or write your own…" value={text} onChange={(e) => setText(e.target.value)} />
      {clips.data && clips.data.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label className="field-label" htmlFor="ci-voice">Add your voice</label>
          <select id="ci-voice" className="input" value={voice} onChange={(e) => setVoice(e.target.value)}>
            <option value="">No voice note</option>
            {clips.data.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}
      {error && <p className="error small" style={{ marginTop: 10 }}>{error}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn quiet" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={busy || !text.trim()} onClick={send}><Icon name="send" size={14} /> {busy ? 'Sending…' : 'Send'}</button>
      </div>
    </Modal>
  );
}

/** The last few check-ins and how they were answered. */
export function RecentCheckIns({ parentId, parentName, version }: { parentId: string; parentName: string; version: number }) {
  const { data } = useApi<CheckIns>(`/parents/${parentId}/check-ins?v=${version}`, 15000);
  const recent = data?.recent.slice(0, 3) ?? [];
  if (!recent.length) return null;
  return (
    <ul className="checkins">
      {recent.map((c) => (
        <li key={c.id}>
          <span className="small">“{c.text}”{c.voice && <span className="tiny"> · with voice</span>}</span>
          {c.answer ? (
            <span className={`ci-answer ${c.answer}`}><Icon name={ANSWER[c.answer].icon} size={14} /> {ANSWER[c.answer].word}</span>
          ) : (
            <span className="tiny">Sent {fmtAgo(c.createdAt)} · waiting for {parentName}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
