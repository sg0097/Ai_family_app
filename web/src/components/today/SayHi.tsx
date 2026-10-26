import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useApi } from '../../hooks';
import type { CheckIns } from '../../types';
import { Icon } from '../Icon';

/** One click to send a warm "how are you?" with one-tap answers. No dialog in the way. */
export function SayHi({ parentId, parentName, onSent }: { parentId: string; parentName: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const { data } = useApi<CheckIns>(open ? `/parents/${parentId}/check-ins` : null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function send(message: string) {
    setState('sending');
    setError('');
    try {
      await api(`/parents/${parentId}/check-ins`, { body: { text: message } });
      setState('sent');
      onSent();
      setTimeout(() => { setOpen(false); setState('idle'); setText(''); }, 1300);
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  }

  return (
    <div className="sayhi" ref={box}>
      <button className="btn ghost" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="message" size={15} /> Say hi</button>
      {open && (
        <div className="sayhi-pop" role="dialog" aria-label={`Say hi to ${parentName}`}>
          {state === 'sent' ? (
            <div className="sayhi-sent"><span className="sent-check"><Icon name="check" size={20} stroke={3} /></span>Sent to {parentName}</div>
          ) : (
            <>
              <p className="tiny" style={{ margin: '0 0 8px' }}>{parentName} answers with one tap</p>
              {(data?.ideas ?? []).map((i) => (
                <button key={i} className="sayhi-idea" disabled={state === 'sending'} onClick={() => send(i)}>{i}<Icon name="send" size={13} /></button>
              ))}
              <form className="sayhi-own" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text.trim()); }}>
                <input className="input" placeholder="Or your own words…" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
                <button className="btn sm" disabled={!text.trim() || state === 'sending'} aria-label="Send"><Icon name="send" size={13} /></button>
              </form>
              {error && <p className="error small" style={{ marginTop: 6 }}>{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
