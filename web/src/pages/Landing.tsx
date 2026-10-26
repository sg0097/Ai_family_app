import { useEffect, useRef, useState } from 'react';
import { Num } from '../components/Num';
import { Link } from 'react-router-dom';
import { useSession } from '../App';
import { Icon } from '../components/Icon';
import { Logo } from '../components/ui';

const SCRIPT: { who: 'them' | 'me'; text: string; buttons?: string[] }[] = [
  { who: 'them', text: 'Mummy, morning wali dawa le li? ❤️', buttons: ['✅ Le li', '❌ Abhi nahi'] },
  { who: 'me', text: 'Haan beta, breakfast ke baad le li thi' },
  { who: 'them', text: 'Shabash! ❤️' },
  { who: 'me', text: 'Aaj BP 138/85 tha' },
  { who: 'them', text: 'BP 138/85 note kar liya ❤️' },
  { who: 'me', text: 'Kal se pair mein thoda dard hai' },
  { who: 'them', text: 'Dhyan rakhiye ❤️ Priya ko bhi dikh jayega.' },
];

function LiveChat() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= SCRIPT.length + 2 ? 1 : v + 1)), 1700);
    return () => clearInterval(t);
  }, []);
  const shown = SCRIPT.slice(0, Math.min(n, SCRIPT.length));
  const typing = n < SCRIPT.length && SCRIPT[n].who === 'me';
  return (
    <div className="phone-mock" aria-label="Example WhatsApp conversation">
      <div className="phone-screen">
        <div className="phone-top">
          <span className="av">❤️</span>
          <div>
            <b>Family Care</b>
            <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>online</div>
          </div>
        </div>
        <div className="phone-body" style={{ justifyContent: 'flex-end' }}>
          {shown.slice(-6).map((m, i) => (
            <div key={`${n}-${i}-${m.text}`} className={`wa ${m.who}`} style={{ animationDelay: '0s' }}>
              {m.text}
              {m.buttons && (
                <div className="btns">
                  {m.buttons.map((b) => (
                    <span key={b}>{b}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {typing && (
            <div className="typing" aria-hidden>
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// What the child sees, as it happens through the morning: one tile at a time turns done.
const BOARD = [
  { emoji: '💊', label: 'Medicine', wait: 'Waiting…', done: 'Done ✓', tone: 'sage' },
  { emoji: '❤️', label: 'BP', wait: 'Waiting…', done: '130/80', tone: 'pink' },
  { emoji: '😊', label: 'Feeling', wait: 'Waiting…', done: 'Good', tone: 'sun' },
  { emoji: '💧', label: 'Water', wait: '2 of 8', done: '6 of 8', tone: 'sky' },
] as const;

function TileBoard() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDone((d) => (d >= BOARD.length + 2 ? 0 : d + 1)), 1400);
    return () => clearInterval(t);
  }, []);
  const n = Math.min(done, BOARD.length);
  return (
    <div className="board" aria-label="Example: what you see about Mummy's day">
      <div className="board-hi">
        <span className="board-av">M</span>
        <div>
          <b>Mummy today</b>
          <div className="tiny">{n === BOARD.length ? 'Doing well today 😊' : `${n} of ${BOARD.length} done`}</div>
        </div>
      </div>
      <div className="board-grid">
        {BOARD.map((t, i) => (
          <div key={t.label} className={`btile ${t.tone}${i < n ? ' is-done' : ''}`}>
            <span className="btile-emoji" aria-hidden>{t.emoji}</span>
            <b>{t.label}</b>
            <span key={i < n ? 'd' : 'w'} className="btile-state">{i < n ? t.done : t.wait}</span>
          </div>
        ))}
      </div>
      <div className="board-actions" aria-hidden>
        <span className="btn sm">📞 Call Mummy</span>
        <span className="btn ghost sm">💬 Say hi</span>
      </div>
    </div>
  );
}

const STEPS = [
  { emoji: '📱', title: 'Add Maa', text: 'Her name and WhatsApp number.', tone: 'sky' },
  { emoji: '👍', title: 'She says “Haan”', text: 'One message. Nothing starts without her yes.', tone: 'sun' },
  { emoji: '😌', title: 'You relax', text: 'See her day here, any time.', tone: 'sage' },
];

const LOVES = [
  { emoji: '🎙️', title: 'Your voice', text: '“Mummy, dawai le lo” in your own voice.', tone: 'pink' },
  { emoji: '💊', title: 'Medicine', text: 'Reminders she actually answers.', tone: 'sage' },
  { emoji: '🩺', title: 'BP & sugar', text: 'Every reading, saved for the doctor.', tone: 'sky' },
  { emoji: '🆘', title: 'HELP button', text: 'She types HELP, you know at once.', tone: 'sun' },
  { emoji: '👨‍👩‍👧', title: 'Whole family', text: 'Brothers and sisters see it too.', tone: 'lilac' },
  { emoji: '🗣️', title: 'Her language', text: 'Hindi, Hinglish or English.', tone: 'sand' },
];

export function Landing() {
  const { user } = useSession();
  const start = user ? '/app' : '/signup';
  return (
    <div className="landing">
      <div className="nav-wrap">
        <nav className="nav">
          <Logo />
          <div className="links">
            <a href="#how">How it works</a>
            <a href="#love">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          {user ? (
            <Link to="/app" className="btn">Open dashboard</Link>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <Link to="/login" className="btn quiet">Log in</Link>
              <Link to="/signup" className="btn">Get started</Link>
            </div>
          )}
        </nav>
      </div>

      <header className="hero">
        <div className="hero-inner">
          <div>
            <span className="hello-chip">💚 Sab WhatsApp pe</span>
            <h1>Maa ka din,<br /><em>aapke phone pe.</em></h1>
            <p className="lede">Medicine, BP, how she feels. Know she’s okay without calling five times.</p>
            <div className="row wrap">
              <Link to={start} className="btn lg">Start free</Link>
              <a href="#how" className="btn ghost lg">How it works ↓</a>
            </div>
            <p className="tiny" style={{ marginTop: 16 }}>No app for her to learn. Just WhatsApp.</p>
          </div>
          <TileBoard />
        </div>
      </header>

      <section className="section" id="how">
        <h2 className="big-title">3 simple steps</h2>
        <div className="tile-row">
          {STEPS.map((s, i) => (
            <div key={s.title} className={`ftile ${s.tone}`}>
              <span className="ftile-n">{i + 1}</span>
              <span className="ftile-emoji" aria-hidden>{s.emoji}</span>
              <b>{s.title}</b>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section chat-show">
        <div>
          <h2 className="big-title left">She just chats.<br />Like always.</h2>
          <div className="say-chips">
            <span>Taps <b>✅ Le li</b></span>
            <span>Types <b>“BP 130/80”</b></span>
            <span>Says <b>“pair mein dard hai”</b></span>
            <span>Sends <b>HELP 🆘</b></span>
          </div>
          <p className="muted" style={{ marginTop: 18 }}>We understand all of it, and you see it neatly.</p>
        </div>
        <LiveChat />
      </section>

      <section className="section" id="love">
        <h2 className="big-title">Things you’ll love</h2>
        <div className="tile-grid">
          {LOVES.map((f) => (
            <div key={f.title} className={`ftile ${f.tone}`}>
              <span className="ftile-emoji" aria-hidden>{f.emoji}</span>
              <b>{f.title}</b>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="tile-row facts">
          <div className="fact"><b><CountUp value={149} /> million</b><p>Indians are 60+</p><span className="tiny">UNFPA, India Ageing Report 2023</span></div>
          <div className="fact"><b>1 in <CountUp value={2} /></b><p>don’t take long-term medicines as prescribed</p><span className="tiny">WHO</span></div>
          <div className="fact"><b><CountUp value={0} /> apps</b><p>for her to learn</p><span className="tiny">Just WhatsApp</span></div>
        </div>
        <div className="trust-chips">
          <span>🩺 Never diagnoses</span>
          <span>🙋‍♀️ She says yes first</span>
          <span>✋ STOP anytime</span>
          <span>🔒 Her data, your family only</span>
        </div>
      </section>

      <section className="section" id="pricing">
        <h2 className="big-title">Free to start</h2>
        <div className="plans landing-plans">
          <div className="plan-card">
            <div className="plan-name">Free</div>
            <div className="plan-price"><b>₹0</b></div>
            <ul>{['Reminders on WhatsApp', 'Alerts and HELP', 'Weekly and doctor report'].map((f) => <li key={f}><Icon name="check" size={14} /> {f}</li>)}</ul>
          </div>
          <div className="plan-card family">
            <div className="plan-name">Family</div>
            <div className="plan-price"><b>₹199</b><span className="tiny"> / month</span></div>
            <ul>{['Your voice in reminders', 'Up to 4 parents', 'Brothers and sisters too'].map((f) => <li key={f}><Icon name="check" size={14} /> {f}</li>)}</ul>
          </div>
        </div>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 12 }}>Family is free for your first 14 days.</p>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cta-band">
          <span className="cta-emoji" aria-hidden>🤗</span>
          <h2>Be there, <em>even when you’re not.</em></h2>
          <Link to={start} className="btn lg">Start free</Link>
        </div>
      </section>

      <footer className="footer">
        <Logo />
        <span>Not a medical service. In an emergency, call 112.</span>
      </footer>
    </div>
  );
}

/** Counts up once it scrolls into view, so the number moves where someone is looking. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <span ref={ref}><Num value={seen ? value : 0} /></span>;
}
