import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Modal, Skeleton, Toast } from '../../components/ui';
import { useSession } from '../../App';
import { fmtDate } from '../../format';
import { useApi, useToast } from '../../hooks';
import { LANGUAGE_LABEL, type Language, type ParentProfile, type Team } from '../../types';
import { Icon } from '../../components/Icon';
import { useParent } from './ParentDashboard';

const ZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney'];

export function SettingsTab() {
  const { id, reload } = useParent();
  const { data } = useApi<ParentProfile>(`/parents/${id}/profile`);
  const [f, setF] = useState<ParentProfile | null>(null);
  const [err, setErr] = useState('');
  const { toast, show } = useToast();
  useEffect(() => setF(data), [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f) return;
    setErr('');
    try {
      await api(`/parents/${id}`, { method: 'PATCH', body: { name: f.name, relationship: f.relationship, timezone: f.timezone, emergencyNumber: f.emergencyNumber, language: f.language } });
      show('Saved ✓');
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }

  if (!f) return <Skeleton h={320} />;
  const consent = { GRANTED: ['good', 'Connected'], PENDING: ['warn', 'Invite sent, waiting for “Haan”'], DECLINED: ['', 'Said not now'], REVOKED: ['', 'Paused (sent STOP)'] }[f.consentStatus];
  return (
    <div className="dash-grid">
      <form className="card" onSubmit={save}>
        <div className="card-head"><h2>Profile</h2></div>
        <div className="grid-2">
          <div><label className="field-label" htmlFor="n">Name in messages</label><input className="input" id="n" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
          <div><label className="field-label" htmlFor="r">Relationship</label><input className="input" id="r" value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })} required /></div>
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <div>
            <label className="field-label" htmlFor="tz">Their timezone</label>
            <select className="input" id="tz" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
              {[...new Set([f.timezone, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="em">Emergency number</label>
            <input className="input" id="em" value={f.emergencyNumber} onChange={(e) => setF({ ...f, emergencyNumber: e.target.value })} required />
            <p className="hint">Shared with {f.name} when they send HELP.</p>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <span className="field-label">Language for {f.name}’s WhatsApp messages</span>
          <div className="segmented" role="radiogroup" aria-label="Message language">
            {(['HINGLISH', 'HINDI', 'ENGLISH'] as Language[]).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={f.language === l} className={f.language === l ? 'on' : ''} onClick={() => setF({ ...f, language: l })}>{LANGUAGE_LABEL[l]}</button>
            ))}
          </div>
        </div>
        {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
        <button className="btn" style={{ marginTop: 20 }}>Save changes</button>
      </form>
      <section className="card">
        <div className="card-head"><h2>WhatsApp</h2></div>
        <div className="stack" style={{ gap: 12 }}>
          <div className="spread"><span className="muted small">Number</span><b>+{f.phone}</b></div>
          <div className="spread"><span className="muted small">Status</span><span className={`pill ${consent[0]}`}>{consent[1]}</span></div>
          {f.consentAt && <div className="spread"><span className="muted small">Said yes on</span><span>{fmtDate(f.consentAt, { day: 'numeric', month: 'long', year: 'numeric' }, f.timezone)}</span></div>}
          {f.consentStatus !== 'GRANTED' && (
            <button className="btn ghost" onClick={() => api(`/parents/${id}/resend-consent`, { method: 'POST' }).then(() => show('Invite sent again'))}>Send the invite again</button>
          )}
          <p className="tiny">{f.name} can reply STOP at any time to pause everything, and HAAN to start again.</p>
        </div>
      </section>
      <CareTeam />
      {f.isOwner ? <RemoveParent id={id} name={f.name} /> : <LeaveTeam name={f.name} owner={f.ownerName} />}
      <Toast message={toast} />
    </div>
  );
}

/** Deleting is permanent, so it asks for the name to be typed. */
function RemoveParent({ id, name }: { id: string; name: string }) {
  const { refreshFamily } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  async function remove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api(`/parents/${id}`, { method: 'DELETE', body: { confirmName: typed } });
      await refreshFamily();
      navigate('/app', { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="card danger-zone">
      <h2>Remove {name}</h2>
      <p className="muted small" style={{ margin: '6px 0 14px' }}>
        Stops all reminders and permanently deletes {name}’s readings, messages and history. This can’t be undone.
      </p>
      <button className="btn danger sm" onClick={() => setOpen(true)}>Remove {name}…</button>
      {open && (
        <Modal title={`Remove ${name}?`} onClose={() => setOpen(false)}>
          <form onSubmit={remove}>
            <p className="muted" style={{ marginBottom: 14 }}>
              Everything recorded about {name} will be deleted. If their WhatsApp chat is open, they’ll get a short message saying reminders have stopped.
            </p>
            <label className="field-label" htmlFor="confirm-name">Type <b>{name}</b> to confirm</label>
            <input className="input" id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
            {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" className="btn quiet" onClick={() => setOpen(false)}>Keep {name}</button>
              <button className="btn danger" disabled={!matches || busy}>{busy ? 'Removing…' : 'Remove permanently'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

/** Siblings and others who share this parent's dashboard and alerts. */
function CareTeam() {
  const { id, today } = useParent();
  const name = today.parent.name;
  const { data, reload } = useApi<Team>(`/parents/${id}/team`);
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast, show } = useToast();

  async function invite(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const res = await api<{ link: string }>(`/parents/${id}/invites`, { body: { email } });
      setLink(res.link);
      setEmail('');
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      show('Copy the link from the box');
    }
  };
  const removeMember = async (userId: string, who: string) => {
    await api(`/parents/${id}/members/${userId}`, { method: 'DELETE' });
    show(`${who} removed`);
    reload();
  };
  const cancelInvite = async (inviteId: string) => {
    await api(`/parents/${id}/invites/${inviteId}`, { method: 'DELETE' });
    reload();
  };
  const share = (l: string) => `https://wa.me/?text=${encodeURIComponent(`Join me in caring for ${name} on Family Care: ${l}`)}`;

  if (!data) return <Skeleton h={160} />;
  return (
    <section className="card">
      <h2 style={{ marginBottom: 4 }}>Care team</h2>
      <p className="muted small" style={{ marginBottom: 14 }}>Everyone here sees {name}’s day and gets the same alerts.</p>
      <ul className="team-list">
        <li><span className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{data.owner.name[0]}</span><span><b>{data.owner.name}</b><span className="tiny" style={{ display: 'block' }}>{data.owner.email} · added {name}</span></span></li>
        {data.members.map((m) => (
          <li key={m.id}>
            <span className="avatar" style={{ width: 34, height: 34, fontSize: 14 }}>{m.name[0]}</span>
            <span style={{ flex: 1 }}><b>{m.name}</b><span className="tiny" style={{ display: 'block' }}>{m.email}</span></span>
            {data.isOwner && <button className="link-btn small quiet-link" onClick={() => removeMember(m.id, m.name)}>Remove</button>}
          </li>
        ))}
        {data.invites.map((i) => (
          <li key={i.id} className="invited">
            <span className="avatar" style={{ width: 34, height: 34, fontSize: 14, background: 'var(--idle-soft)', color: 'var(--muted)' }}>?</span>
            <span style={{ flex: 1 }}><b>{i.email}</b><span className="tiny" style={{ display: 'block' }}>Invited · link works until {fmtDate(i.expiresAt, { day: 'numeric', month: 'short' })}</span></span>
            <button className="link-btn small quiet-link" onClick={() => copy(i.link)}>Copy link</button>
            <button className="link-btn small quiet-link" onClick={() => cancelInvite(i.id)}>Cancel</button>
          </li>
        ))}
      </ul>
      {data.isOwner ? (
        <>
          <form className="note-form" onSubmit={invite} style={{ marginTop: 16 }}>
            <input className="input" type="email" aria-label="Their email" placeholder="Brother’s or sister’s email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" disabled={!email.trim()}>Invite</button>
          </form>
          {err && <p className="error" style={{ marginTop: 8 }}>{err}</p>}
          {link && (
            <div className="invite-link">
              <p className="small">Invite sent. You can also share the link yourself. It only works for that email address:</p>
              <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
                <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn ghost sm" onClick={() => copy(link)}>{copied ? 'Copied' : 'Copy'}</button>
                <a className="btn ghost sm" href={share(link)} target="_blank" rel="noreferrer"><Icon name="message" size={15} /> Share on WhatsApp</a>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="tiny" style={{ marginTop: 14 }}>Only {data.owner.name} can invite or remove people.</p>
      )}
      <Toast message={toast} />
    </section>
  );
}

function LeaveTeam({ name, owner }: { name: string; owner: string }) {
  const { id } = useParent();
  const { refreshFamily, user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  async function leave() {
    await api(`/parents/${id}/members/${user!.id}`, { method: 'DELETE' });
    await refreshFamily();
    navigate('/app', { replace: true });
  }
  return (
    <section className="card">
      <h2>Leave {name}’s care team</h2>
      <p className="muted small" style={{ margin: '6px 0 14px' }}>You’ll stop seeing {name}’s day and getting alerts. {owner} can invite you again.</p>
      <button className="btn danger sm" onClick={() => setOpen(true)}>Leave…</button>
      {open && (
        <Modal title={`Leave ${name}’s care team?`} onClose={() => setOpen(false)}>
          <p className="muted" style={{ marginBottom: 18 }}>Nothing is deleted. {owner} and the rest of the family keep everything.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn quiet" onClick={() => setOpen(false)}>Stay</button>
            <button className="btn danger" onClick={leave}>Leave</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
