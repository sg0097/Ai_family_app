import { useEffect, useRef, useState } from 'react';
import { Num } from '../components/Num';
import { Link } from 'react-router-dom';
import { useSession } from '../App';
import { Icon, type IconName } from '../components/Icon';
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

type Tone = 'pink' | 'green' | 'blue' | 'amber' | 'violet' | 'black';

/** A small coloured app-icon tile that sits inside a headline. */
function Chip({ icon, tone }: { icon: IconName; tone: Tone }) {
  return <span className={`ichip c-${tone}`} aria-hidden><Icon name={icon} stroke={2.4} /></span>;
}

const ROTOR: { icon: IconName; tone: Tone; text: string }[] = [
  { icon: 'pill', tone: 'pink', text: 'medicine' },
  { icon: 'heart', tone: 'blue', text: 'BP' },
  { icon: 'smile', tone: 'amber', text: 'mood' },
  { icon: 'walk', tone: 'green', text: 'walk' },
];

function Rotor() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % ROTOR.length), 2000);
    return () => clearInterval(t);
  }, []);
  const r = ROTOR[i];
  return (
    <span className="st-rotor">
      <span key={i}><Chip icon={r.icon} tone={r.tone} /> {r.text}</span>
    </span>
  );
}

const WAYS = {
  tap: { label: 'Tap', hint: 'one touch', text: 'She taps ✅ Le li under the reminder. Done.', chat: [['them', 'Mummy, morning wali dawa le li? ❤️'], ['me', '✅ Le li'], ['them', 'Shabash! ❤️']] },
  type: { label: 'Type', hint: 'her words', text: 'She writes it her way. We understand it.', chat: [['them', 'Mummy, aaj BP check kiya?'], ['me', 'Haan, 130/80 tha'], ['them', 'BP 130/80 note kar liya ❤️']] },
  help: { label: 'HELP', hint: 'any time', text: 'She sends HELP. You get an alert at once.', chat: [['me', 'HELP'], ['them', 'Maine Priya ko abhi bata diya hai 🙏 Turant madad chahiye to 112 par call kariye.']] },
} as const;

/** A small phone showing one exchange for the chosen way of replying. */
function WayChat({ way }: { way: keyof typeof WAYS }) {
  return (
    <div className="phone-mock" style={{ animation: 'none' }} aria-label="Example chat">
      <div className="phone-screen" style={{ height: 360 }}>
        <div className="phone-top"><span className="av">❤️</span><b>Family Care</b></div>
        <div className="phone-body" style={{ justifyContent: 'flex-end' }}>
          {WAYS[way].chat.map(([who, text], i) => (
            <div key={`${way}-${i}`} className={`wa ${who}`} style={{ animationDelay: `${i * 0.35}s` }}>{text}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Every number links to where it comes from. Keep it that way when adding more.
const NEED = [
  { pre: '', value: 149, post: 'M', line: 'Indians are 60 or older. By 2050 it will be 347 million.', source: 'UNFPA, India Ageing Report 2023', url: 'https://india.unfpa.org/en/news/india-ageing-elderly-make-20-population-2050-unfpa-report' },
  { pre: '', value: 2046, post: '', line: 'The year India’s elderly are expected to outnumber its children.', source: 'UNFPA, India Ageing Report 2023', url: 'https://india.unfpa.org/en/news/india-ageing-elderly-make-20-population-2050-unfpa-report', plain: true },
  { pre: '1 in ', value: 5, post: '', line: 'older Indians live alone or only with their spouse. Children moving away is the top reason.', source: 'BKPAI survey, PLoS ONE 2021', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8046240', dark: true },
  { pre: '', value: 45, post: '%', line: 'of Indians over 50 have high blood pressure, which needs daily medicine and regular checks.', source: 'LASI Wave 1 (2017–18)', url: 'https://doaj.org/article/5d32e56549094e4aa58056b016e71460' },
  { pre: '1 in ', value: 2, post: '', line: 'people on long-term treatment don’t take their medicines as prescribed.', source: 'WHO, Adherence to Long-Term Therapies', url: 'https://www.who.int/publications/i/item/9241545992' },
  { pre: '', value: 500, post: 'M+', line: 'Indians already use WhatsApp. Your parents probably do too.', source: 'Meta, 2024', url: 'https://www.storyboard18.com/how-it-works/meta-doubles-down-on-whatsapp-business-in-india-23713.htm' },
];

const FAQ = [
  ['Does Maa need to install anything?', 'No. If she can reply on WhatsApp, she’s set. There is no app for her.'],
  ['What if she doesn’t reply?', 'She gets one gentle reminder later. If it’s still not done, we tell you. No reply is shown as “no reply”, never as a missed dose.'],
  ['Is this a medical service?', 'No. We never diagnose and never change medicines. Readings are shown exactly as she sent them. In an emergency, call 112.'],
  ['Which languages?', 'Hinglish, Hindi and English. You pick for each parent.'],
  ['Who sees her messages?', 'Only you and the family members you invite.'],
  ['Can she stop it?', 'Yes. She replies STOP any time and everything stops.'],
] as const;

export function Landing() {
  const { user } = useSession();
  const start = user ? '/app' : '/signup';
  const [way, setWay] = useState<keyof typeof WAYS>('tap');
  const [open, setOpen] = useState(0);
  return (
    <div className="studio">
      <div className="nav-wrap">
        <nav className="nav">
          <Logo />
          <div className="links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          {user ? (
            <Link to="/app" className="btn sm">Open dashboard</Link>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <Link to="/login" className="btn ghost sm">Log in</Link>
              <Link to="/signup" className="btn sm">Start free</Link>
            </div>
          )}
        </nav>
      </div>

      <header className="st-hero">
        <h1 className="st-h1">
          Know Maa’s<br />
          <Rotor /><br />
          <span className="st-grey">is taken care of.</span>
        </h1>
        <p className="st-lede">Reminders go to her on WhatsApp, in her language. You see her day here, without calling five times.</p>
        <Link to={start} className="btn lg">Start free</Link>
        <p className="st-note">Free to start. Nothing for her to install.</p>
      </header>

      <div className="st-stage">
        <div className="st-stage-inner">
          <TileBoard />
          <LiveChat />
        </div>
      </div>

      <section className="section" id="why">
        <div className="st-center">
          <span className="st-eyebrow">Why this matters</span>
          <h2 className="st-h2">Parents are <Chip icon="heart" tone="pink" /> ageing. <span className="st-grey">Children are far away.</span></h2>
          <p className="st-lede">Someone has to remember the 9 AM tablet. These are the numbers behind every “dawai li?” call.</p>
        </div>
        <div className="need-grid">
          {NEED.map((n) => (
            <a key={n.line} className={`need${n.dark ? ' dark' : ''}`} href={n.url} target="_blank" rel="noreferrer">
              <div className="need-num">{n.pre}{n.plain ? n.value : <CountUp value={n.value} />}{n.post}</div>
              <p>{n.line}</p>
              <span className="need-src">{n.source} ↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="st-split">
          <div>
            <span className="st-eyebrow">For her</span>
            <h2 className="st-h2">She just <Chip icon="message" tone="green" /> chats. <span className="st-grey">Like always.</span></h2>
            <p className="st-lede">No new app, no passwords. Reminders arrive in her WhatsApp, and she answers however she likes.</p>
            <div className="seg" role="tablist" aria-label="How she replies">
              {(Object.keys(WAYS) as (keyof typeof WAYS)[]).map((k) => (
                <button key={k} role="tab" aria-selected={way === k} className={way === k ? 'on' : ''} onClick={() => setWay(k)}>
                  {WAYS[k].label}<span>{WAYS[k].hint}</span>
                </button>
              ))}
            </div>
            <p className="st-mono" style={{ marginTop: 16 }}>{WAYS[way].text}</p>
          </div>
          <div className="st-panel"><WayChat way={way} /></div>
        </div>
      </section>

      <section className="section" id="features" style={{ paddingTop: 0 }}>
        <div className="st-center">
          <span className="st-eyebrow">Everything in one place</span>
          <h2 className="st-h2">A whole <Chip icon="heart" tone="pink" /> care team. <span className="st-grey">One <Chip icon="message" tone="black" /> chat.</span></h2>
        </div>
        <div className="bento4">
          <div className="bx w2">
            <h3>Reminders in your voice.</h3>
            <p>Record “Mummy, dawai le lo” once. She hears you, not an alarm.</p>
            <div className="grow"><div className="wave-bars" aria-hidden>{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ height: `${25 + ((i * 41) % 75)}%` }} />)}</div></div>
            <div className="pill-row"><span className="on"><Icon name="play" size={12} /> 0:07</span><span>Good morning, Mummy</span></div>
          </div>
          <div className="bx">
            <div className="huge"><CountUp value={3} /></div>
            <div className="grow" />
            <h3>languages</h3>
            <p>Hinglish, Hindi, English.</p>
          </div>
          <div className="bx dark">
            <div className="icon-sq"><Icon name="alert" size={24} /></div>
            <div className="grow" />
            <h3>One word: HELP</h3>
            <p>She sends it, you know at once.</p>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="pill" size={24} /></div>
            <div className="grow" />
            <h3>Medicines</h3>
            <p>Reminders, and a nudge before tablets run out.</p>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="report" size={24} /></div>
            <div className="grow" />
            <h3>Doctor report</h3>
            <p>Every BP and sugar reading on one page.</p>
          </div>
          <div className="bx w2">
            <h3>Know how she is. At a glance.</h3>
            <p>One look tells you what’s done and what’s waiting.</p>
            <div className="grow" />
            <div className="pill-row">
              <span className="on"><i className="dot g" /> Medicine done</span>
              <span><i className="dot a" /> BP waiting</span>
              <span><i className="dot g" /> Feeling good</span>
              <span><i className="dot r" /> HELP</span>
            </div>
          </div>
          <div className="bx w2">
            <div className="icon-sq"><Icon name="message" size={24} /></div>
            <div className="grow" />
            <h3>Brothers and sisters, together.</h3>
            <p>Everyone sees the same day and gets the same alerts.</p>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="smile" size={24} /></div>
            <div className="grow" />
            <h3>Say hi</h3>
            <p>A check-in she answers with one tap.</p>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="memory" size={24} /></div>
            <div className="grow" />
            <h3>Spots patterns</h3>
            <p>Knee pain three days running? You’ll know.</p>
          </div>
          <div className="bx bx-wide-row">
            <div className="icon-sq"><Icon name="info" size={22} /></div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>A care companion, not a doctor.</h3>
              <p>We never diagnose or change medicines. She says yes first, and STOP always works.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pricing" style={{ paddingTop: 0 }}>
        <div className="st-center">
          <h2 className="st-h2">Start <Chip icon="check" tone="green" /> free.<br /><span className="st-grey"><Chip icon="calendar" tone="black" /> 14 days of Family on us.</span></h2>
          <p className="st-lede">Everything that keeps her safe is free, always.</p>
        </div>
        <div className="st-plans">
          <div className="st-plan">
            <h3>Free</h3>
            <div className="who">For one parent.</div>
            <div className="price">₹0<small>forever</small></div>
            <Link to={start} className="btn">Start free</Link>
            <ul>{['WhatsApp reminders', 'Alerts and HELP', 'Weekly and doctor report', 'Medicines and refills'].map((f) => <li key={f}><Icon name="check" size={15} /> {f}</li>)}</ul>
          </div>
          <div className="st-plan">
            <h3>Family</h3>
            <div className="who">For the whole family.</div>
            <div className="price">₹199<small>a month</small></div>
            <Link to={start} className="btn">Try free for 14 days</Link>
            <ul>{['Everything in Free', 'Reminders in your voice', 'Up to 4 parents', 'Brothers and sisters too'].map((f) => <li key={f}><Icon name="check" size={15} /> {f}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="faq">
          <div>
            <h2 className="st-h2">Questions.</h2>
            <p className="st-lede" style={{ marginTop: 16 }}>What families ask before they start.</p>
          </div>
          <div className="faq-list">
            {FAQ.map(([q, a], i) => (
              <div key={q} className={`faq-item${open === i ? ' open' : ''}`}>
                <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>{q}<span className="x"><Icon name="plus" size={14} /></span>
                </button>
                {open === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="st-final">
        <h2 className="st-h2">Be there <Chip icon="heart" tone="pink" /><br /><span className="st-grey">even when you’re not.</span></h2>
        <Link to={start} className="btn lg">Start free</Link>
      </section>

      <footer className="st-foot">
        <Logo />
        <span>Not a medical service. In an emergency, call 112.</span>
      </footer>
      <div className="st-word" aria-hidden>ghar ki khabar</div>
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
