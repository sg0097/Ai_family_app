# AI Family Care

WhatsApp-first family care. Parents reply on WhatsApp; children see how they're doing on a calm web dashboard.

This is the MVP vertical slice: child signup → add a parent → consent on WhatsApp → routine reminders → parent replies → records stored → today's status and a weekly summary on the dashboard.

## Run it

Needs Node 20+, Docker, and optionally [Ollama](https://ollama.com) with `qwen3:8b` (or set `OLLAMA_MODEL`).

```bash
npm install
npm run db:up                         # Postgres :5434, Redis :6381
cp server/.env.example server/.env    # first time only
npm run db:migrate
npm run dev                           # API :4200 + web :5180
```

Open http://localhost:5180 for the landing page, then create an account. In dev (`WHATSAPP_PROVIDER=fake`):

- **✨ Add demo parent** on the family page creates a parent with 45 days of history, so every chart has data.
- **📱 Parent's phone** (bottom-right on a parent's dashboard) is a WhatsApp simulator: reply as the parent, tap buttons, run the scheduler or send a reminder now.

## The child dashboard

The parent page answers one question first: **is she okay today, and do I need to do anything?**

| Tab | What's there |
|---|---|
| Today | Status line ("All good so far", "1 thing needs you" + Call), today's reminders (tap to change, + Add, Remind now), latest readings, this week so far, the parent's last words, Good to know, Ask. A new parent starts with "Set up reminders" |
| Care | Medicines as prescribed (dose, instructions) with tablet counts and refill alerts; doctor visits with WhatsApp reminders the evening before and on the day; shared family notes; the **doctor visit report** (printable) |
| Reminders | Every reminder with time, how often and its follow-up/alert rule; add, change (with a preview of the exact WhatsApp message) or pause; one-tap suggestions |
| Weekly report | One-line summary, what changed, 4 at-a-glance numbers, the reminders grid, BP chart and exact readings, water, feelings, mentions, and what's not known. Browse past weeks, and **Save as PDF** to share or take to the doctor |
| History | Charts, every record (add or remove), and the WhatsApp messages |
| Settings | Profile, timezone, emergency number, **message language** (Hinglish / हिंदी / English), the **care team** (invite siblings), WhatsApp status, removal |

The status wording lives in one place (`web/src/status.ts`) so the family page and the parent page always agree.

**Weekly report** (`insights/report.ts`). Built only from the records, with no AI, so nothing is invented. Readings are listed, never judged. Mid-week it compares with the *same days* of last week, so a Wednesday never reads as "fewer than last week". Every Sunday from 7 PM (parent's time), the child gets "Mummy's weekly report is ready" (bell + WhatsApp).

**Schedules.** Each routine runs every day, on chosen weekdays (e.g. a Sunday sugar test), every N days, or monthly (`routines/schedule.ts`). Weekly and monthly checks are only expected, flagged or asked about on their days.

**Care rules** (`care/rules.ts`, every minute, no AI). If a reminder is unanswered or answered "not yet":
1. **Follow-up:** one gentle second reminder to the parent after the routine's follow-up delay, never between 10 PM and 7 AM.
2. **Alert to the child:** if it's still not done after the alert delay that day. Shown under 🔔, and sent to WhatsApp if the child set a number.
3. **"Sorted" update:** if the parent confirms after the child was alerted.
4. **Silence:** if reminders went out but nothing came back for 24 hours, one "haven't heard from them" alert.

Defaults by type: medicine nudges after 1h and alerts after 3h; BP and sugar after 2h and 5h; walk and feeling only get a nudge; water does neither. Every routine can change these.

**Ask about Mummy** (`insights/ask.ts`) builds facts from the database first, and the model only phrases them. A deterministic check (`insights/grounding.ts`) rejects any answer with a number or date not found in the facts, or with judgement words ("normal", "dangerous"…). When an answer is rejected, the records are shown instead. Small local models do get facts wrong, so for production use a stronger hosted model behind the same gateway.

```bash
npm test          # parser, schedule, grounding, red-flag and symptom tests
npm run typecheck
```

## How it works

```
web (React) ──► API (Fastify) ──► PostgreSQL
                    │
WhatsApp webhook ───┤──► inbound queue ──► conversation processor ──► outbound queue ──► WhatsApp
                    │                        rules first → Ollama only if unsure
scheduler (every minute, BullMQ) ──► reminders ─────────────────────────┘
```

"Don't use AI where normal software is better":

| Job | Done by |
|---|---|
| Reminders, missed-day closing | `routines/scheduler.ts`, no AI |
| "haan", "138/85", "5 glass", button taps | `conversation/rules.ts` (regex + word lists) |
| Symptoms, mixed or ambiguous messages | `conversation/llm.ts` (Ollama, JSON schema, then validated) |
| Today view, weekly summary | `insights/index.ts` (queries + arithmetic) |
| Emergency | Only an explicit `HELP` message or button. Never inferred. |

Key ideas in the data model (`server/prisma/schema.prisma`):

- **`RoutineOccurrence`** is one routine on one day: the question waiting for an answer. A reply like "haan" is matched to it. If several questions are open, the parent is asked which one they mean.
- **No reply is not a miss.** Unanswered occurrences close as `NO_RESPONSE`, separate from `NOT_DONE` (parent said no). The dashboard says "No reply" / "not updated for 4 days", never "missed".
- **Consent first.** Adding a parent sends one invite. Nothing else is sent until they reply yes, and `STOP` pauses everything.
- **24h window.** `whatsapp/outbound.ts` sends a free-form message if the parent wrote in the last 24h, otherwise a pre-approved template (`conversation/copy.ts` names them).
- **Implausible values are rejected** (e.g. BP 85/138). All plausible values are stored as reported, without interpretation.

## Family and accounts

- **Care team:** whoever adds a parent is the owner and can invite siblings by email. An invite only works for the email it was sent to, so a forwarded link can't give a stranger access. Everyone on the team sees the same dashboard and gets the same alerts. Members can leave; only the owner can remove the parent or people.
- **Languages:** every WhatsApp message (reminders, follow-ups, replies, appointment reminders) is written in Hinglish, Hindi (Devanagari) or English (`conversation/copy.ts`). The reply rules understand Hindi-script answers such as "हाँ", "ले ली", "नहीं" and Devanagari digits. In-app previews are built by the same server code, so they always match.
- **Password reset:** the emailed link works once, for an hour, and only its hash is stored. Resetting signs out every older session.

## Brand: "a letter from home"

The look is deliberate, so new screens should follow it (tokens at the top of `web/src/styles.css`):

- **Paper, not glass:** cream page, flat cards with warm hairlines. No gradient glows, blur or floating panels.
- **Three typefaces, each with one job:** *Fraunces* for headings and numbers, *Mukta* for reading (it supports Devanagari), and *Kalam* (handwriting) **only for the parent's own words**. That last one is the signature.
- **Household palette:** ink `#2b2420`, sindoor `#b5432b` (the one accent, for the main action), haldi `#e3a72f` (highlighter marks), leaf `#346b3d` (done), indigo `#2e4a7a`. Every text pair passes WCAG AA in light and dark mode.
- **Details:** emphasis is a haldi highlighter stroke (`<em>` in headings), never italics. Status labels look like stamps, tabs are underlined, icons are one line set with no emoji outside WhatsApp previews, and the logo is a hand-drawn home with a heart window, with the line "ghar ki khabar".

## Safety and privacy rules

These are deliberate; keep them when changing the product.

- **Never diagnose or judge.** Readings are shown exactly as sent. The AI may only phrase facts from the records, and answers that add numbers, dates or judgement words are rejected (`insights/grounding.ts`).
- **Missing is not missed.** No reply is shown as unknown, never as a missed dose.
- **Symptoms reach the child promptly**, in the parent's own words, once per symptom per day. Serious signs (chest pain, breathing trouble, fainting, a fall, face/speech/numbness, bleeding) are matched by a fixed list in English, Hinglish and Devanagari (`care/redflags.ts`, no AI). They always go to the child's WhatsApp, appear at the top of Today, and the parent is reminded that HELP and the emergency number exist. Nothing declares an emergency on the parent's behalf.
- **Times are the parent's time** everywhere on a parent's pages. Alerts say "(Times are Mummy's time.)" when the child is in another timezone.
- **Consent first; STOP always works.** Queued reminders are dropped once a parent says STOP or is removed.
- **Deletion is real.** Removing a parent (type their name) or deleting the account (password) deletes all their records.
- **Limits.** Sign-in is rate-limited (10 per 15 min) and so is Ask (30 per hour). Logs never contain message text, AI answers or full phone numbers.
- **Production refuses unsafe config:** a weak `JWT_SECRET`, the fake WhatsApp provider, or a missing `META_APP_SECRET` (set `NODE_ENV=production`). The simulator and demo routes are never enabled in production.

## Deploying (Render)

`render.yaml` sets up everything: one web service (API + reminder workers + website), Postgres and Redis, in Singapore.

1. Render dashboard → **New → Blueprint** → pick this repo → **Apply**.
2. Wait for the build to finish (about 5 minutes). The app is at `https://family-care-<random>.onrender.com`.

This first deployment is a **demo** (`APP_MODE=demo`): WhatsApp is simulated, a banner says so, and the phone simulator and demo data are available. There's no AI model online, so Ask shows the records instead of a summary. On the free plan the service sleeps when idle (reminders pause until someone opens the site), and the free database expires after 30 days.

For real parents: set `APP_MODE=live`, `WHATSAPP_PROVIDER=meta` and the `META_*` secrets, and move to paid plans. Production refuses to start with a half-safe setup.

## Going live on WhatsApp

1. Create a WhatsApp Business app in Meta, then set `WHATSAPP_PROVIDER=meta` and the `META_*` vars.
2. Point the webhook to `https://<host>/api/webhooks/whatsapp` (signature-verified with `META_APP_SECRET`).
3. Get these templates approved, in each language you offer (`en` for Hinglish, `hi`, `en_GB`): `consent_request`, `routine_confirm`, `routine_followup`, `reading_request`, `wellbeing_check`, `appointment_reminder`, `child_update`. Parameters and buttons are listed in `server/src/conversation/copy.ts`.

In production, run the API and workers separately with `ROLE=api` / `ROLE=worker`.

## Not built yet

Long-term memory table (recurring symptoms are computed from events for now), LLM-written summaries, voice clips, doctor-visit PDF, billing, and parents shared between siblings (`ParentProfile.phone` is unique).
