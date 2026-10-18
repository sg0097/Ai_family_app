import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../App';
import { Icon } from '../components/Icon';
import { Logo, Ring } from '../components/ui';

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

export function Landing() {
  const { user } = useSession();
  const start = user ? '/app' : '/signup';
  return (
    <div style={{ background: 'var(--page)' }}>
      <div className="nav-wrap">
        <nav className="nav">
          <Logo />
          <div className="links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#safety">Safety</a>
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
          <div className="reveal">
            <div className="badge-new">
              <b>WhatsApp pe</b> No new app for your parents
            </div>
            <h1>
              Know how Maa’s day is going, <em>even from far away</em>
            </h1>
            <p className="lede">
              Your parents chat on WhatsApp the way they always do, in Hindi, Hinglish or English. We keep track of medicine, BP and how
              they feel, and show you a clear picture every day.
            </p>
            <div className="row wrap">
              <Link to={start} className="btn lg">Start free</Link>
              <a href="#how" className="btn ghost lg">See how it works</a>
            </div>
            <p className="tiny" style={{ marginTop: 18 }}>No app for your parents to install. Nothing is sent until they say yes.</p>
          </div>
          <div className="hero-visual">
            <LiveChat />
            <div className="float-card" style={{ left: -18, top: 70, transform: 'rotate(-3deg)' }}>
              <div className="row">
                <Ring value={4} total={5} size={58} stroke={7}>
                  <b style={{ fontSize: '0.95rem' }}>4/5</b>
                </Ring>
                <div>
                  <div style={{ fontWeight: 700 }}>Mummy today</div>
                  <div className="tiny">Medicine done · BP 138/85</div>
                </div>
              </div>
            </div>
            <div className="float-card" style={{ right: -28, top: 170, transform: 'rotate(2.5deg)', maxWidth: 210 }}>
              <div className="tiny">From Mummy · 8:12 AM</div>
              <p className="note">“Haan beta, breakfast ke baad le li thi”</p>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="how">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Care that fits into a WhatsApp chat</h2>
          <p>Set it up once in five minutes. After that, your parents just talk.</p>
        </div>
        <div className="steps">
          {[
            ['01', 'Add your parent', 'Pick what to track: medicine, BP, water, a walk, how they feel. Set the times.'],
            ['02', 'They say “Haan”', 'One friendly WhatsApp message asks if they’d like to start. Nothing happens without consent.'],
            ['03', 'Gentle reminders', 'Warm reminders in your words. They reply however they like: a tap, “le li”, or “BP 130/80”.'],
            ['04', 'You see the picture', 'Today’s status, trends over weeks, what’s missing and what changed, all in one place.'],
          ].map(([n, t, d]) => (
            <div className="step" key={n}>
              <div className="n">{n}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div className="eyebrow">Features</div>
          <h2>Everything you’d ask on the nightly call, already answered</h2>
        </div>
        <div className="bento">
          <Feature className="wide" title="Today, at a glance" text="A single ring tells you how the day is going. Tap any routine to send a gentle nudge.">
            <div className="row" style={{ gap: 18 }}>
              <Ring value={3} total={5} size={110}>
                <b>3/5</b>
                <span className="tiny">done</span>
              </Ring>
              <div style={{ display: 'grid', gap: 8 }}>
                {['Medicine · done', 'BP · 138/85', 'Water · 5 of 8'].map((t) => (
                  <span key={t} className="pill" style={{ background: 'var(--surface)' }}>{t}</span>
                ))}
              </div>
            </div>
          </Feature>
          <Feature className="wide" title="Trends that tell a story" text="BP and sugar over weeks, medicine on a calendar, water against the goal. Hover any day for details.">
            <MiniHeat />
          </Feature>
          <Feature title="Ask anything" text="“Did Papa miss medicine this week?” Answers come only from what was actually recorded.">
            <div className="ask-box" style={{ width: '80%', pointerEvents: 'none' }}>
              <span className="small muted" style={{ padding: '8px 0' }}>How has Mummy been?</span>
              <span className="btn sm coral">Ask</span>
            </div>
          </Feature>
          <Feature title="Remembers what matters" text="Mentions of knee pain on three different days become one clear note instead of three lost messages.">
            <div style={{ display: 'grid', gap: 8, width: '75%' }}>
              {['Mon · knee pain', 'Wed · knee pain', 'Fri · knee pain'].map((t, i) => (
                <div key={t} className="pill coral" style={{ justifyContent: 'flex-start', animation: `rise .4s ${i * 0.15}s both` }}>{t}</div>
              ))}
            </div>
          </Feature>
          <Feature title="HELP, one word away" text="If a parent sends HELP, you’re alerted right away. A family alert, not a replacement for 112.">
            <span className="status-icon" style={{ width: 72, height: 72, color: 'var(--critical)', background: 'var(--coral-soft)' }}><Icon name="alert" size={34} /></span>
          </Feature>
        </div>
      </section>

      <section className="section" id="safety" style={{ paddingTop: 0 }}>
        <div className="safety">
          <div>
            <div className="eyebrow">Safety first</div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.04em', margin: '10px 0 14px' }}>
              A care companion, <em>not a doctor</em>
            </h2>
            <p className="muted" style={{ fontSize: '1.05rem' }}>
              We track, remind, organise and highlight changes. Decisions about health stay with your family and their doctor.
            </p>
          </div>
          <ul className="check-list">
            {[
              'Never diagnoses or labels a reading as good or bad',
              'Never changes medicine instructions',
              '“No reply” is shown as missing information, never as a missed dose',
              'AI answers are checked against the records, and the records are always shown',
              'Parents opt in on WhatsApp and can say STOP anytime',
            ].map((t) => (
              <li key={t}>
                <span className="ic pill good">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="cta-band">
          <h2>
            Be there, <em>even when you’re not</em>
          </h2>
          <p className="muted" style={{ marginBottom: 26, fontSize: '1.05rem' }}>Free to start. Your parents need nothing but WhatsApp.</p>
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

function Feature({ title, text, children, className = '' }: { title: string; text: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`feature ${className}`}>
      <div className="art">{children}</div>
      <div className="copy">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function MiniHeat() {
  const pattern = 'ddddnddddddxdddddddndddddddd';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 14px)', gap: 4 }} aria-hidden>
      {pattern.split('').map((c, i) => (
        <span
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: c === 'd' ? 'var(--heat-done)' : c === 'n' ? 'var(--heat-notyet)' : 'var(--neutral)',
            animation: `pop .3s ${i * 0.03}s both`,
          }}
        />
      ))}
    </div>
  );
}
