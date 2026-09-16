# Eidos

A calendar that does everything Apple Calendar does, and then keeps going —
into the morning and the evening, into the school day, and into the schedules
people keep together.

Built in **React + TypeScript**, no UI framework, two runtime dependencies.
Everything else — the Liquid Glass material, the recurrence engine, the Korean
natural-language parser, the moderation filter — is in this repository.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 28 tests over the pure engines
npm run build
```

Nothing needs configuring to run it. Every external provider has an offline
fallback, and the app says which one it is using.

---

## What it does

### 1 · The calendar

Day, week, month, year and list views; search; multiple calendars with
visibility toggles; all-day and multi-day events; travel time; multiple alarms;
free/busy; notes, URL and location; and a repeat picker covering daily, weekly
with a weekday set, every-two-weeks, monthly by day-of-month and yearly, each
with an end date or an occurrence count.

Deleting one instance of a repeating event records an exception rather than
destroying the series — `event/removeOccurrence` in `src/core/store.tsx`.

Overlapping events are packed into the fewest columns that keep them from
covering each other (`layoutDay`), and a `freeSlots` pass subtracts travel time
from the front of every booking, so "when am I free" accounts for the commute.

Keyboard: `←`/`→` page, `T` jumps to today, `1`–`5` switch views, `N` composes.

### 2 · Morning Brief and Night Brief

**Morning** opens on a sky generated for the current hour, then: the weather
turned into advice you can act on (`우산 꼭 챙기세요`, `일교차 12° — 겉옷 하나 더`),
an hour-by-hour strip, the day laid out on a rail with travel time folded in,
and notes about the *shape* of the day rather than its contents — a run of
three back-to-back meetings, the longest free gap, how many times you'll be
moving. For Edu accounts, today's timetable and today's school meal.

**Night** closes it: a mood scale, a checklist of what the day actually held
(events and reminders together), Cycle's comment on the gap between the two, a
free-text journal with a streak counter, a fourteen-day load strip, and the one
fact about tomorrow that changes what you do tonight — usually what time you
have to leave.

Both briefs answer standing questions you write yourself ("오늘 제일 중요한
일은?"), through the same engine that powers the Cycle tab, so a question asked
in the brief and in chat get the same answer.

### 3 · Edu Plan

Sign up as **student, parent or teacher**, pick a school, a grade and a class.

- **Meals** — the day's menu with the 19 legally-published Korean allergens
  marked per dish. Dishes containing something you've declared are flagged red
  everywhere they appear, including in the morning brief. Nutrition and origin
  tables when the school publishes them.
- **Timetable** — the full school week, with the current period highlighted.
- **Class board** — 수행평가, exams, homework, notices, trips and school events,
  shared with everyone in the same class. Peers can confirm or dispute an item;
  a teacher's post is marked authoritative. One tap adds it to your calendar.

Everything a student posts goes through moderation first (below).

### 4 · Groups

For everyone else. Create a group, share a six-character invite code, and
members' schedules merge into one calendar. Each member chooses per group
whether they share **details** or only **busy**.

### 5 · Cycle

The assistant. Type a sentence and it becomes an event:

| You type | Cycle proposes |
|---|---|
| `내일 오후 3시 치과 1시간` | 치과 · tomorrow 15:00–16:00 |
| `매주 월요일 9시 팀 회의` | 팀 회의 · weekly on Mondays |
| `오늘 뭐 있어?` | the day, listed, with hours booked |
| `이번 주에 2시간 언제 비어?` | the actual gaps, with a jump-to action |
| `다음 일정 뭐야?` | the next one, and when to leave for it |

It also takes the things that don't fit in a calendar slot — that's what the
free chat is for.

---

## Design

The interface is Liquid Glass, implemented against Apple's WWDC25 guidance
rather than an approximation of it. The full charter is
**[`docs/DESIGN.md`](docs/DESIGN.md)**; the short version:

- **Glass is the navigation layer, never the content layer.** The month grid,
  the brief cards and the chat bubbles are opaque. Only the toolbar, tab bar,
  sheets and composer are glass.
- **Never glass on glass.** `GlassSurface` reads a React context and degrades to
  a vibrancy fill when it would otherwise render a second pane, so components
  don't have to know their own nesting depth.
- **Regular and Clear are not mixed.** Exactly one surface in the app uses the
  Clear variant — the brief hero, over the generated sky — and it ships the
  dimming layer Apple requires with it.
- **Concentric radii** (`r_child = r_parent − padding`), **one tint per view**,
  **hierarchy through depth** rather than weight.
- Real refraction where the browser allows it: an SVG displacement map built
  from a rounded-rect signed-distance field, with the bevel's displacement
  derived from Snell's law at n = 1.5, supersampled 2× to kill
  `feDisplacementMap`'s stair-stepping. Chromium gets that; Safari and Firefox
  get a tuned blur-and-bevel; anything older gets matched-luminance fills. Same
  tokens, same shadows, one design in all three.
- Reduce Transparency, Increase Contrast, Reduce Motion and Dark Mode are
  handled at the token level, so no component can forget them.

`docs/DESIGN.md` ends with a review log of the eight rendering defects that
browser passes actually caught, and what each one turned out to be.

---

## Privacy

This matters more than usual here, because Edu mode is used by minors.

- **Everything is stored in the browser.** No server, no account, no telemetry.
- **Moderation runs on-device.** A student's post is matched against a readable
  rule table before it can be posted — abuse, personal data, exam fraud,
  substances and adult content are blocked; off-topic hangouts and outside links
  are held for review. The text never leaves the browser to be classified. An
  optional model pass can only *clear* a flag, never create a block: a
  classifier that silently swallows a child's homework post because of a
  phrasing quirk is worse than one that lets a teacher see it.
- **Cycle is local by default.** With no model configured it answers from the
  on-device engine, and the Cycle screen says so on every visit. Only when
  `VITE_CYCLE_API_BASE` is set does a seven-day schedule summary leave the
  device.
- **Consent is granular and versioned.** Each notice in
  `src/features/onboarding/consents.tsx` carries its own version string, stored
  with the agreement, so a changed notice is detectable rather than silent.
  Allergy data is treated as sensitive health information and gated behind its
  own consent — refuse it and nothing is stored. Under-14 sign-ups require a
  guardian's consent before the account is created. Every optional item is
  genuinely optional.
- **No invented content.** With no news provider configured, the news card says
  it has no provider instead of showing plausible headlines.

---

## Providers

All optional; copy `.env.example` to `.env` to wire any of them up.

| Variable | Service | Without it |
|---|---|---|
| `VITE_NEIS_KEY` | NEIS school meals + timetables | Bundled sample schools; menus and timetables generated deterministically per school and date |
| `VITE_WEATHER_API_BASE` | Open-Meteo (no key needed) | Seasonal model for the latitude — stable and plausible, not a forecast |
| `VITE_NEWS_API_BASE` | Any `{items:[{title,source,category,url}]}` endpoint | The card says there is no provider |
| `VITE_CYCLE_API_BASE` | A chat endpoint for Cycle | The local Korean intent engine |

---

## Layout

```
src/
  glass/         the material — displacement map generator, GlassSurface, nesting guard
  styles/        tokens.css · glass.css · global.css
  core/          types · date · recurrence · store · storage · seed
  services/      cycle · moderation · neis · weather · news
  components/    Sheet, Segmented, Field, Chip, Card, Icon
  features/      calendar · brief · edu · groups · cycle · onboarding
docs/DESIGN.md   the design charter and review log
tests/           28 tests over the pure engines
```

Tests run on Node's built-in runner against the TypeScript sources directly
(`node --experimental-strip-types`), covering recurrence expansion and its edge
cases (short months, counts, exceptions, multi-day windows), day-column layout,
free-slot maths, Korean date/time/duration parsing, intent classification, the
moderation rule table, and allergen matching.

---

## Known simplifications

- A multi-day all-day event draws a chip in each day it covers rather than one
  continuous bar across the month grid.
- Recurrence covers the rules Apple's repeat picker exposes, not all of
  RFC 5545 (no `BYSETPOS`, no "third Tuesday").
- Sharing is local to the device. Groups and class boards have the full data
  model and moderation pipeline, but joining a code only finds groups this
  browser knows about; real sharing needs a server.
- Brief times are stored and honoured in the UI, but delivering a brief as a
  push notification needs a service worker and a server that this build
  doesn't include.
