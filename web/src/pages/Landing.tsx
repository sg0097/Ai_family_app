import { useEffect, useRef, useState } from 'react';
import { Num } from '../components/Num';
import { Link } from 'react-router-dom';
import { useSession } from '../App';
import { Icon, type IconName } from '../components/Icon';
import { Logo } from '../components/ui';

// Only exchanges the product handles reliably today: buttons, "haan", and readings like 130/80.
const SCRIPT: { who: 'them' | 'me'; text: string; buttons?: string[] }[] = [
  { who: 'them', text: 'Mummy, morning wali dawa le li? ❤️\n— Priya', buttons: ['✅ Le li', '❌ Abhi nahi'] },
  { who: 'me', text: '✅ Le li' },
  { who: 'them', text: 'Shabash! ❤️' },
  { who: 'them', text: 'Mummy, aaj BP check kiya? Reading bhej dijiye 🩺\n— Priya' },
  { who: 'me', text: '130/80' },
  { who: 'them', text: 'BP 130/80 note kar liya ❤️' },
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
  { icon: 'heart', tone: 'blue', text: 'BP check' },
  { icon: 'walk', tone: 'green', text: 'evening walk' },
  { icon: 'glass', tone: 'amber', text: 'paani' },
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
  tap: { label: 'Tap', hint: 'one touch', text: 'She taps ✅ Le li under your reminder. Done.', chat: [['them', 'Mummy, morning wali dawa le li? ❤️\n— Priya'], ['me', '✅ Le li'], ['them', 'Shabash! ❤️']] },
  type: { label: 'Haan', hint: 'or a reading', text: 'She can just reply “haan”, or send a reading like 130/80.', chat: [['them', 'Mummy, aaj BP check kiya?\n— Priya'], ['me', '130/80'], ['them', 'BP 130/80 note kar liya ❤️']] },
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
  { pre: '1 in ', value: 5, post: '', line: 'older Indians live alone or only with their spouse. Children moving away is the top reason.', source: 'BKPAI survey, PLoS ONE 2021', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8046240', dark: true },
  { pre: '1 in ', value: 2, post: '', line: 'people on long-term medicines don’t take them as prescribed. Forgetting is a big part of it.', source: 'WHO, Adherence to Long-Term Therapies', url: 'https://www.who.int/publications/i/item/9241545992' },
  { pre: '', value: 500, post: 'M+', line: 'Indians already use WhatsApp. Your parents probably do too.', source: 'Meta, 2024', url: 'https://www.storyboard18.com/how-it-works/meta-doubles-down-on-whatsapp-business-in-india-23713.htm' },
];

const FAQ = [
  ['Will this make my parent healthier?', 'We don’t promise that, and we don’t give medical advice. We help you stay involved in her day: your reminders reach her, and you see how she replied.'],
  ['Does it watch or monitor her?', 'No. She only gets the reminders you set, she knows they come from you, and she chooses whether to reply. She can reply STOP any time and everything stops.'],
  ['Is it a bot pretending to be me?', 'No. Every reminder is signed with your name, and you can write it in your own words or record it in your own voice. We only deliver it.'],
  ['Does Maa need to install anything?', 'No. If she can reply on WhatsApp, she’s set.'],
  ['What if she doesn’t reply?', 'She gets one gentle reminder later. If it’s still not done, we tell you, so you can call. No reply is shown as “no reply”, never as a missed dose.'],
  ['Which languages?', 'Hinglish, Hindi and English. You pick for each parent.'],
] as const;

const WORKS = [
  { icon: 'message' as IconName, tone: 'pink' as Tone, title: 'Your words, not an app’s', text: 'Write each reminder the way you’d say it. We send it as you wrote it.' },
  { icon: 'heart' as IconName, tone: 'violet' as Tone, title: 'Signed with your name', text: '“Mummy, dawai le li? ❤️ — Priya”. She knows it’s you.' },
  { icon: 'mic' as IconName, tone: 'green' as Tone, title: 'Your voice, if you like', text: 'Record it once. She hears you before every reminder.' },
];

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
            <a href="#why">Why it works</a>
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
        <span className="st-eyebrow">For children living away from their parents</span>
        <h1 className="st-h1">
          Remind Maa about<br />
          her <Rotor /><br />
          <span className="st-grey">with love.</span>
        </h1>
        <p className="st-lede">Your reminders reach her on WhatsApp, in your words and signed with your name. She replies with one tap, and you know how her day went.</p>
        <Link to={start} className="btn lg">Start free</Link>
        <p className="st-note">Nothing for her to install. Nothing is sent until she says yes.</p>
      </header>

      <div className="st-stage">
        <div className="st-stage-inner">
          <TileBoard />
          <LiveChat />
        </div>
      </div>

      <section className="section" id="why">
        <div className="st-center">
          <span className="st-eyebrow">Why it works</span>
          <h2 className="st-h2">Parents don’t forget because they don’t care. <span className="st-grey">They forget because no one reminds them.</span></h2>
          <p className="st-lede">When it’s their own child reminding them, it feels like love, and they do it. Family Care carries your reminders through her day, so she feels you there.</p>
        </div>
        <div className="works">
          {WORKS.map((w) => (
            <div key={w.title} className="bx">
              <span className={`ichip c-${w.tone}`} style={{ fontSize: 46 }} aria-hidden><Icon name={w.icon} stroke={2.4} /></span>
              <div className="grow" />
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="st-split">
          <div>
            <span className="st-eyebrow">For her</span>
            <h2 className="st-h2">She just <Chip icon="message" tone="green" /> replies. <span className="st-grey">One tap.</span></h2>
            <p className="st-lede">No new app, no passwords. Your reminder arrives in her WhatsApp with two buttons.</p>
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
          <span className="st-eyebrow">What you get</span>
          <h2 className="st-h2">A few things, <span className="st-grey">done really well.</span></h2>
        </div>
        <div className="bento4">
          <div className="bx w2">
            <h3>Reminders in your voice.</h3>
            <p>Record “Mummy, dawai le lo” once. She hears you, not an alarm.</p>
            <div className="grow"><div className="wave-bars" aria-hidden>{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ height: `${25 + ((i * 41) % 75)}%` }} />)}</div></div>
            <div className="pill-row"><span className="on"><Icon name="play" size={12} /> 0:07</span><span>Good morning, Mummy</span></div>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="check" size={24} /></div>
            <div className="grow" />
            <h3>One-tap replies</h3>
            <p>✅ Le li or ❌ Abhi nahi. Or just “haan”.</p>
          </div>
          <div className="bx dark">
            <div className="icon-sq"><Icon name="alert" size={24} /></div>
            <div className="grow" />
            <h3>One word: HELP</h3>
            <p>She sends it, you’re told at once.</p>
          </div>
          <div className="bx w2">
            <h3>Know how her day went. At a glance.</h3>
            <p>What she confirmed, what’s still waiting, and when to call.</p>
            <div className="grow" />
            <div className="pill-row">
              <span className="on"><i className="dot g" /> Medicine done</span>
              <span><i className="dot a" /> BP waiting</span>
              <span><i className="dot g" /> Walk done</span>
            </div>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="smile" size={24} /></div>
            <div className="grow" />
            <h3>Say hi</h3>
            <p>“Kaisi ho?” any time. She answers with one tap.</p>
          </div>
          <div className="bx">
            <div className="icon-sq"><Icon name="report" size={24} /></div>
            <div className="grow" />
            <h3>Doctor visit report</h3>
            <p>Her readings and medicines on one page, as she sent them.</p>
          </div>
          <div className="bx bx-wide-row">
            <div className="icon-sq"><Icon name="info" size={22} /></div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>What we are, and what we’re not.</h3>
              <p>We help you stay involved in her day. We are not a doctor, we don’t diagnose or give medical advice, and we never change medicines. She says yes first, and STOP always works.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="numbers" style={{ paddingTop: 0 }}>
        <div className="st-center">
          <span className="st-eyebrow">Why this matters</span>
          <h2 className="st-h2">Parents are <Chip icon="heart" tone="pink" /> ageing. <span className="st-grey">Children are far away.</span></h2>
        </div>
        <div className="need-grid four">
          {NEED.map((n) => (
            <a key={n.line} className={`need${n.dark ? ' dark' : ''}`} href={n.url} target="_blank" rel="noreferrer">
              <div className="need-num">{n.pre}<CountUp value={n.value} />{n.post}</div>
              <p>{n.line}</p>
              <span className="need-src">{n.source} ↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section" id="pricing" style={{ paddingTop: 0 }}>
        <div className="st-center">
          <h2 className="st-h2">Start <Chip icon="check" tone="green" /> free.<br /><span className="st-grey"><Chip icon="calendar" tone="black" /> 14 days of Family on us.</span></h2>
          <p className="st-lede">Daily reminders, replies and alerts are free, always.</p>
        </div>
        <div className="st-plans">
          <div className="st-plan">
            <h3>Free</h3>
            <div className="who">For one parent.</div>
            <div className="price">₹0<small>forever</small></div>
            <Link to={start} className="btn">Start free</Link>
            <ul>{['Reminders in your words, signed by you', 'One-tap replies', 'Today and this week at a glance', 'Alerts and HELP'].map((f) => <li key={f}><Icon name="check" size={15} /> {f}</li>)}</ul>
          </div>
          <div className="st-plan">
            <h3>Family</h3>
            <div className="who">For the whole family.</div>
            <div className="price">₹199<small>a month</small></div>
            <Link to={start} className="btn">Try free for 14 days</Link>
            <ul>{['Everything in Free', 'Reminders in your own voice', 'Say hi any time', 'Doctor visit report and full history', 'Up to 4 parents, with siblings'].map((f) => <li key={f}><Icon name="check" size={15} /> {f}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="faq">
          <div>
            <h2 className="st-h2">Questions.</h2>
            <p className="st-lede" style={{ marginTop: 16 }}>Straight answers about what we do, and what we don’t.</p>
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
