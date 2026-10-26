import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, getToken } from '../api';
import { useApi } from '../hooks';
import type { VoiceClip } from '../types';
import { Icon } from './Icon';

// The child's own voice, recorded in the browser and played to the parent on WhatsApp.

const MAX_SECONDS = 60;
// WhatsApp takes MP4/AAC and OGG/Opus. Chrome records WebM, which plays here but needs converting before a live WhatsApp send (see README).
const MIME_PREFERENCE = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
const pickMime = () => (typeof MediaRecorder === 'undefined' ? null : MIME_PREFERENCE.find((m) => MediaRecorder.isTypeSupported(m)) ?? '');

const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Audio needs the sign-in header, so it's fetched as a blob instead of pointing <audio> at the URL. */
function useClipUrl(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let made: string | null = null;
    let live = true;
    fetch(`/api/voice/${id}/audio`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && live) setUrl((made = URL.createObjectURL(b)));
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url;
}

/** A small round play button with a progress ring, WhatsApp-voice-note style. */
export function VoicePlay({ id, seconds, label }: { id: string; seconds: number; label: string }) {
  const [load, setLoad] = useState(false);
  const url = useClipUrl(load ? id : null);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (url && load && audio.current?.paused) audio.current.play().catch(() => setPlaying(false));
  }, [url, load]);

  const toggle = () => {
    if (!url) return setLoad(true);
    const a = audio.current!;
    if (a.paused) a.play();
    else a.pause();
  };
  const p = seconds ? Math.min(1, t / seconds) : 0;
  return (
    <span className="voice-play">
      <button type="button" className={`vp-btn${playing ? ' on' : ''}`} onClick={toggle} aria-label={`${playing ? 'Pause' : 'Play'} ${label}`}>
        <Icon name={playing ? 'stop' : 'play'} size={13} />
      </button>
      <span className="vp-track" aria-hidden><span style={{ width: `${p * 100}%` }} /></span>
      <span className="tiny num">{playing || t ? fmtSecs(t) : seconds ? fmtSecs(seconds) : 'Voice note'}</span>
      {url && <audio ref={audio} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setT(0); }} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />}
    </span>
  );
}

/** Record → listen back → name it → save. */
export function VoiceRecorder({ parentId, parentName, onSaved }: { parentId: string; parentName: string; onSaved: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'review' | 'saving'>('idle');
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<{ text: string; plan?: boolean } | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>();
  const mime = pickMime();

  useEffect(() => () => { window.clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' });
        setBlob(b);
        setPreview(URL.createObjectURL(b));
        setState('review');
      };
      rec.current = r;
      r.start();
      setSecs(0);
      setState('recording');
      const began = Date.now();
      timer.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setSecs(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
    } catch {
      setError({ text: 'Microphone access is needed to record. Allow it in the browser’s address bar and try again.' });
    }
  }

  function stop() {
    window.clearInterval(timer.current);
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  async function save() {
    if (!blob) return;
    setState('saving');
    setError(null);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1]);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      await api(`/parents/${parentId}/voice`, { body: { label: label.trim() || `For ${parentName}`, mime: blob.type, seconds: Math.max(1, secs), data } });
      setBlob(null);
      setLabel('');
      setState('idle');
      onSaved();
    } catch (e) {
      setError({ text: (e as Error).message, plan: e instanceof ApiError && e.status === 402 });
      setState('review');
    }
  }

  if (mime === null) return <p className="tiny">This browser can’t record audio. Try Chrome or Safari.</p>;

  return (
    <div className={`recorder ${state}`}>
      {state === 'idle' && (
        <button type="button" className="rec-btn" onClick={start}>
          <span className="rec-dot"><Icon name="mic" size={18} /></span>
          <span><b>Record a voice note</b><span className="tiny" style={{ display: 'block' }}>Up to a minute. “{parentName}, dawai le lo, main yaad kar raha hoon.”</span></span>
        </button>
      )}
      {state === 'recording' && (
        <div className="rec-live">
          <span className="rec-pulse" aria-hidden />
          <span className="num"><b>{fmtSecs(secs)}</b> <span className="tiny">/ 1:00</span></span>
          <span className="rec-wave" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 90}ms` }} />)}</span>
          <button type="button" className="btn sm" onClick={stop}><Icon name="stop" size={12} /> Stop</button>
        </div>
      )}
      {(state === 'review' || state === 'saving') && preview && (
        <div className="rec-review">
          <audio src={preview} controls />
          <input className="input" placeholder={`Name it, e.g. “Good morning, ${parentName}”`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn quiet sm" onClick={() => { setBlob(null); setState('idle'); }}>Discard</button>
            <button type="button" className="btn sm" disabled={state === 'saving'} onClick={save}>{state === 'saving' ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
      {error && <p className="error small" style={{ marginTop: 8 }}>{error.text}{error.plan && <> · <Link to="/app/plan">See the Family plan</Link></>}</p>}
    </div>
  );
}

/** The library: every clip, what it's used with, and the recorder. */
export function VoiceLibrary({ parentId, parentName, notify }: { parentId: string; parentName: string; notify: (m: string) => void }) {
  const clips = useApi<VoiceClip[]>(`/parents/${parentId}/voice`);
  async function remove(c: VoiceClip) {
    if (!window.confirm(`Delete “${c.label}”?${c.routines.length ? ' Reminders using it will go back to text only.' : ''}`)) return;
    await api(`/voice/${c.id}`, { method: 'DELETE' });
    clips.reload();
    notify('Voice note deleted');
  }
  return (
    <section className="card">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div>
          <h2><span className="h-ic t-violet"><Icon name="mic" size={15} /></span>Your voice</h2>
          <p className="tiny" style={{ marginTop: 2 }}>A reminder in your own voice is the one {parentName} won’t ignore. Add one to any reminder, or send it with a check-in.</p>
        </div>
      </div>
      <VoiceRecorder parentId={parentId} parentName={parentName} onSaved={() => { clips.reload(); notify('Voice note saved'); }} />
      {clips.data && clips.data.length > 0 && (
        <ul className="clip-list">
          {clips.data.map((c) => (
            <li key={c.id}>
              <VoicePlay id={c.id} seconds={c.seconds} label={c.label} />
              <div style={{ minWidth: 0 }}>
                <div className="clip-label">{c.label}</div>
                <div className="tiny">{c.routines.length ? `Plays with ${c.routines.map((r) => r.name).join(', ')}` : 'Not on a reminder yet'} · by {c.author}</div>
              </div>
              <button className="icon-btn" aria-label={`Delete ${c.label}`} onClick={() => remove(c)}><Icon name="trash" size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Pick which clip plays with a reminder. */
export function VoicePicker({ parentId, routineId, value, onChange }: { parentId: string; routineId: string; value: string | null; onChange: (id: string | null) => void }) {
  const clips = useApi<VoiceClip[]>(`/parents/${parentId}/voice`);
  const [error, setError] = useState('');
  if (!clips.data?.length) return <p className="tiny">Record a voice note in the Care tab to play it with this reminder.</p>;
  return (
    <div>
      <select
        className="input"
        value={value ?? ''}
        onChange={async (e) => {
          const id = e.target.value || null;
          setError('');
          try {
            await api(`/routines/${routineId}/voice`, { method: 'PUT', body: { voiceClipId: id } });
            onChange(id);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <option value="">Text only</option>
        {clips.data.map((c) => <option key={c.id} value={c.id}>{c.label} ({fmtSecs(c.seconds)})</option>)}
      </select>
      {error && <p className="error small" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}
