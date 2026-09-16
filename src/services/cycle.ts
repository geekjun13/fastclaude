import {
  addDays, formatDateKo, formatDuration, formatTime, fromISODate, setTimeOn, today, toISODate,
  WEEKDAYS_KO,
} from '../core/date.ts';
import { env } from '../core/env.ts';
import { eventsOnDay, freeSlots, occurrencesInRange } from '../core/recurrence.ts';
import type {
  AppState, CycleAction, EidosEvent, ISODate, Recurrence,
} from '../core/types.ts';

/**
 * Cycle — the assistant.
 *
 * Two engines behind one interface:
 *
 *   remote  — VITE_CYCLE_API_BASE, a chat endpoint that receives the user's
 *             message plus a compact schedule digest. Used when configured.
 *   local   — a Korean-language intent parser and scheduling engine that runs
 *             entirely in the browser.
 *
 * The local engine is not a stopgap. Calendar intent ("내일 3시 치과 잡아줘",
 * "이번 주 언제 비어?") is narrow enough to parse reliably, it answers with no
 * latency, and it never sends a schedule off-device — which for a product whose
 * Edu mode is used by minors is the right default, not a limitation.
 */

const BASE = env('VITE_CYCLE_API_BASE');
const MODEL = env('VITE_CYCLE_MODEL', 'claude-sonnet-5');

export const CYCLE_NAME = 'Cycle';

export interface CycleReply {
  text: string;
  actions?: CycleAction[];
  /** Which engine produced it, so the UI can be honest about it. */
  engine: 'remote' | 'local';
}

/* ================================================================== *
 * Korean date / time parsing
 * ================================================================== */

const NUM_KO: Record<string, number> = {
  한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9,
  열: 10, 열한: 11, 열두: 12,
};

const REL_DAYS: [RegExp, number][] = [
  [/그저께|그제/, -2], [/어제/, -1], [/오늘/, 0], [/내일/, 1], [/모레/, 2], [/글피/, 3],
];

/** Resolves the date a phrase refers to, relative to `base`. */
export function parseDate(text: string, base: ISODate = today()): ISODate | null {
  for (const [re, delta] of REL_DAYS) if (re.test(text)) return addDays(base, delta);

  // '3월 14일' / '3/14'
  const md = text.match(/(\d{1,2})\s*[월\/]\s*(\d{1,2})\s*일?/);
  if (md) {
    const year = fromISODate(base).getFullYear();
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = toISODate(new Date(year, month - 1, day));
      // A bare month/day in the past almost always means next year.
      return candidate < base ? toISODate(new Date(year + 1, month - 1, day)) : candidate;
    }
  }

  // '다음 주 화요일' / '이번 주 금요일' / '화요일'
  const wd = text.match(/([일월화수목금토])요일/);
  if (wd) {
    const target = WEEKDAYS_KO.indexOf(wd[1] as (typeof WEEKDAYS_KO)[number]);
    const cur = fromISODate(base).getDay();

    // "이번 주" / "다음 주" name a *week*, so resolve inside that week rather
    // than counting forward from today. Korean weeks run Monday-first, which is
    // why 다음 주 일요일 lands at the far end of next week, not its start.
    if (/(이번|다음|담)\s*주/.test(text)) {
      const thisMonday = addDays(base, -((cur + 6) % 7));
      const weekStart = /다음|담/.test(text) ? addDays(thisMonday, 7) : thisMonday;
      return addDays(weekStart, (target + 6) % 7);
    }

    // A bare weekday means the next one — "화요일" said on a Tuesday is a week out.
    const delta = (target - cur + 7) % 7;
    return addDays(base, delta === 0 ? 7 : delta);
  }

  if (/다음\s*주|담주/.test(text)) return addDays(base, 7);
  if (/다음\s*달/.test(text)) return addDays(base, 30);
  if (/(\d+)\s*일\s*(후|뒤)/.test(text)) {
    const n = Number(text.match(/(\d+)\s*일\s*(?:후|뒤)/)![1]);
    return addDays(base, n);
  }
  if (/(\d+)\s*주\s*(후|뒤)/.test(text)) {
    const n = Number(text.match(/(\d+)\s*주\s*(?:후|뒤)/)![1]);
    return addDays(base, n * 7);
  }
  return null;
}

/** Resolves a time phrase to 'HH:MM', honouring 오전/오후 and bare-hour convention. */
export function parseTime(text: string): string | null {
  const pm = /오후|저녁|밤|PM/i.test(text);
  const am = /오전|아침|새벽|AM/i.test(text);

  // '3:30' / '15:00'
  const colon = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (colon) {
    let h = Number(colon[1]);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${colon[2]}`;
  }

  // '3시 30분' / '3시반' / '3시'
  const hm = text.match(/(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
  if (hm) {
    let h = Number(hm[1]);
    const m = hm[2] === '반' ? 30 : hm[3] ? Number(hm[3]) : 0;
    if (pm && h < 12) h += 12;
    else if (am && h === 12) h = 0;
    // A bare hour between 1 and 7 in a scheduling sentence means the afternoon.
    else if (!pm && !am && h >= 1 && h <= 7) h += 12;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // '세 시' — native numerals
  for (const [word, n] of Object.entries(NUM_KO)) {
    if (new RegExp(`${word}\\s*시`).test(text)) {
      let h = n;
      if (pm && h < 12) h += 12;
      else if (!pm && !am && h >= 1 && h <= 7) h += 12;
      return `${String(h).padStart(2, '0')}:00`;
    }
  }

  if (/점심/.test(text)) return '12:00';
  if (/아침/.test(text)) return '08:00';
  if (/저녁/.test(text)) return '19:00';
  if (/밤/.test(text)) return '21:00';
  return null;
}

export function parseDuration(text: string): number | null {
  const h = text.match(/(\d+)\s*시간/);
  const m = text.match(/(\d+)\s*분(?!\s*전)/);
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  if (/종일|하루\s*종일/.test(text)) return 24 * 60;
  return null;
}

export function parseRecurrence(text: string): Recurrence | null {
  const weekdays = [...text.matchAll(/([일월화수목금토])요일/g)].map((m) =>
    WEEKDAYS_KO.indexOf(m[1] as (typeof WEEKDAYS_KO)[number]),
  );
  if (/매일/.test(text)) return { freq: 'daily', interval: 1 };
  if (/격주|2\s*주\s*마다/.test(text)) return { freq: 'biweekly', interval: 2, byWeekday: weekdays.length ? weekdays : undefined };
  if (/매주|주마다/.test(text)) return { freq: 'weekly', interval: 1, byWeekday: weekdays.length ? weekdays : undefined };
  if (/매월|매달|달마다/.test(text)) return { freq: 'monthly', interval: 1 };
  if (/매년|해마다/.test(text)) return { freq: 'yearly', interval: 1 };
  if (/평일\s*마다|평일/.test(text) && /매|마다/.test(text)) {
    return { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] };
  }
  return null;
}

/** Strips the scheduling scaffolding to leave the thing the event is actually about. */
export function extractTitle(text: string): string {
  let t = text;
  const noise = [
    /(추가|등록|잡아|만들어|넣어|생성)\s*(해|해줘|줘|주세요|줄래|해라)?\s*[.!?]*$/,
    /(오늘|내일|모레|글피|어제|그저께|다음\s*주|이번\s*주|담주|다음\s*달)/g,
    /[일월화수목금토]요일/g,
    /\d{1,2}\s*[월\/]\s*\d{1,2}\s*일?/g,
    /(오전|오후|아침|점심|저녁|밤|새벽)/g,
    // Durations first: "1시간" has to be consumed whole, or the clock-time
    // pattern below matches its "1시" and leaves a stray "간" in the title.
    /\d+\s*시간(\s*\d+\s*분)?\s*(동안|짜리)?/g,
    /\d+\s*분(?!\s*전)\s*(동안|짜리)?/g,
    // Time expressions take their trailing particle with them, or stripping
    // "오후 3시" out of "오후 3시에 치과" would leave a stranded "에".
    /\d{1,2}\s*:\s*\d{2}\s*(에|쯤|경|부터|까지)?/g,
    /\d{1,2}\s*시(?!간)\s*(반|\d{1,2}\s*분)?\s*(에|쯤|경|부터|까지)?/g,
    /(매일|매주|매월|매달|매년|격주|주마다|달마다|해마다)/g,
  ];
  for (const re of noise) t = t.replace(re, ' ');
  t = t
    .replace(/\s{2,}/g, ' ')
    // Any particle left dangling at either end after the surgery above.
    .replace(/^\s*(에|에서|부터|까지|으로|로|은|는|이|가)\s+/, '')
    .replace(/\s*(에|에서|부터|까지|으로|로)\s*$/, '')
    .trim();
  return t || '새로운 이벤트';
}

/* ================================================================== *
 * Intent classification
 * ================================================================== */

export type Intent =
  | 'create' | 'query-day' | 'query-next' | 'find-slot' | 'free-check'
  | 'count' | 'greet' | 'help' | 'chat';

export function classify(text: string): Intent {
  const t = text.trim();
  if (/^(안녕|하이|헬로|반가|좋은\s*아침)/.test(t)) return 'greet';
  if (/(도움말|뭐\s*할\s*수|사용법|도와줘\?|기능)/.test(t)) return 'help';
  if (/(언제\s*(비어|한가|시간|괜찮)|빈\s*시간|시간\s*찾아|잡을\s*수|가능한\s*시간)/.test(t)) return 'find-slot';
  if (/(다음|담)\s*(일정|스케줄|약속|미팅|수업)/.test(t)) return 'query-next';
  if (/(몇\s*개|몇\s*건|얼마나\s*(많|바쁘))/.test(t)) return 'count';
  if (/(한가해|바빠|비어\s*있|일정\s*있|약속\s*있)\??$/.test(t)) return 'free-check';
  if (/(뭐\s*(있|해|하지)|일정|스케줄|계획|알려줘|보여줘|확인)/.test(t)) return 'query-day';
  if (/(추가|등록|잡아|만들어|넣어|예약|생성|잡아줘)/.test(t)) return 'create';
  // A sentence carrying both a time and a noun is a scheduling request even
  // without an explicit verb — "내일 3시 치과".
  if (parseTime(t) && parseDate(t)) return 'create';
  return 'chat';
}

/* ================================================================== *
 * Local engine
 * ================================================================== */

function digest(state: AppState, from: ISODate, to: ISODate): EidosEvent[] {
  const visible = new Set(state.calendars.filter((c) => c.visible).map((c) => c.id));
  return occurrencesInRange(
    state.events.filter((e) => visible.has(e.calendarId)),
    from,
    to,
  );
}

function describeDay(state: AppState, date: ISODate): string {
  const occ = eventsOnDay(digest(state, date, date), date);
  const label = formatDateKo(date, { weekday: true });
  if (!occ.length) return `${label}에는 등록된 일정이 없어요. 비어 있는 하루예요.`;

  const lines = occ.map((e) => {
    const when = e.allDay ? '종일' : formatTime(e.start);
    const where = e.location ? ` · ${e.location}` : '';
    return `· ${when} — ${e.title}${where}`;
  });

  const timed = occ.filter((e) => !e.allDay);
  const busyMinutes = timed.reduce(
    (sum, e) =>
      sum + Math.max(0, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000),
    0,
  );

  const tail =
    busyMinutes > 0
      ? `\n\n일정이 ${occ.length}개, 채워진 시간은 ${formatDuration(Math.round(busyMinutes))}예요.`
      : '';
  return `${label} 일정이에요.\n\n${lines.join('\n')}${tail}`;
}

function nextEvent(state: AppState): string {
  const now = new Date();
  const horizon = addDays(today(), 30);
  const upcoming = digest(state, today(), horizon)
    .filter((e) => new Date(e.start.replace(' ', 'T')) > now)
    .sort((a, b) => (a.start < b.start ? -1 : 1));

  if (!upcoming.length) return '앞으로 30일 안에 잡힌 일정이 없어요.';

  const e = upcoming[0];
  const mins = Math.round((new Date(e.start).getTime() - now.getTime()) / 60000);
  const when =
    mins < 60 ? `${mins}분 뒤`
    : mins < 60 * 24 ? `${Math.round(mins / 60)}시간 뒤`
    : `${Math.round(mins / 1440)}일 뒤`;

  const travel = e.travelTimeMinutes
    ? `\n이동 ${e.travelTimeMinutes}분을 감안하면 ${formatTime(
        new Date(new Date(e.start).getTime() - e.travelTimeMinutes * 60000).toISOString().slice(0, 16),
      )}에는 나서야 해요.`
    : '';

  return `다음은 **${e.title}** — ${when}, ${formatDateKo(e.start.slice(0, 10))} ${
    e.allDay ? '종일' : formatTime(e.start)
  }${e.location ? ` · ${e.location}` : ''}.${travel}`;
}

function findSlots(state: AppState, text: string): CycleReply {
  const duration = parseDuration(text) ?? 60;
  const start = parseDate(text) ?? today();
  const span = /이번\s*주|주중|이번주/.test(text) ? 7 : /다음\s*주/.test(text) ? 7 : 5;
  const dates = Array.from({ length: span }, (_, i) => addDays(start, i));

  const lines: string[] = [];
  const within: ISODate[] = [];

  for (const d of dates) {
    const occ = eventsOnDay(digest(state, d, d), d);
    const slots = freeSlots(occ, d, duration).slice(0, 2);
    if (!slots.length) continue;
    within.push(d);
    const pretty = slots
      .map((s) => `${fmtMin(s.start)}–${fmtMin(Math.min(s.end, s.start + Math.max(duration, 120)))}`)
      .join(', ');
    lines.push(`· ${formatDateKo(d, { weekday: true })} — ${pretty}`);
    if (lines.length >= 5) break;
  }

  if (!lines.length) {
    return {
      engine: 'local',
      text: `${formatDuration(duration)}를 넣을 만한 빈 시간을 못 찾았어요. 기간을 늘리거나 시간을 줄여 볼까요?`,
    };
  }

  return {
    engine: 'local',
    text: `${formatDuration(duration)} 기준으로 이만큼 비어 있어요.\n\n${lines.join('\n')}`,
    actions: [
      { type: 'find-slot', durationMinutes: duration, within, label: '이 시간에 일정 만들기' },
    ],
  };
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mm === 0 ? `${period} ${h12}시` : `${period} ${h12}:${String(mm).padStart(2, '0')}`;
}

function buildDraft(text: string): { draft: Partial<EidosEvent>; summary: string } {
  const date = parseDate(text) ?? today();
  const time = parseTime(text);
  const duration = parseDuration(text) ?? 60;
  const recurrence = parseRecurrence(text) ?? undefined;
  const title = extractTitle(text);
  const allDay = !time || duration >= 24 * 60;

  const startISO = allDay ? date : setTimeOn(date, time!);
  const endISO = allDay
    ? date
    : setTimeOn(
        date,
        (() => {
          const [h, m] = time!.split(':').map(Number);
          const total = h * 60 + m + duration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })(),
      );

  const locMatch = text.match(/([가-힣A-Za-z0-9]+)\s*(?:에서|점|역)\s/);

  const draft: Partial<EidosEvent> = {
    title,
    start: startISO,
    end: endISO,
    allDay,
    recurrence,
    location: locMatch ? locMatch[1] : undefined,
    origin: 'cycle',
  };

  const parts = [
    formatDateKo(date, { weekday: true }),
    allDay ? '종일' : `${formatTime(startISO)} · ${formatDuration(duration)}`,
  ];
  if (recurrence) parts.push('반복');

  return { draft, summary: `**${title}**\n${parts.join(' · ')}` };
}

export function localReply(state: AppState, text: string): CycleReply {
  const intent = classify(text);
  const name = state.profile?.displayName ?? '';

  switch (intent) {
    case 'greet':
      return {
        engine: 'local',
        text: `안녕하세요${name ? `, ${name}님` : ''}. 저는 Cycle이에요.\n일정을 말로 넣거나("내일 3시 치과"), 하루를 물어보거나("이번 주 금요일 뭐 있어?"), 빈 시간을 찾을 수 있어요.`,
      };

    case 'help':
      return {
        engine: 'local',
        text: [
          '이렇게 말해 보세요.',
          '',
          '· **일정 만들기** — “내일 오후 3시 치과 1시간”, “매주 월요일 9시 팀 회의”',
          '· **하루 확인** — “오늘 뭐 있어?”, “금요일 일정 알려줘”',
          '· **다음 일정** — “다음 일정 뭐야?”',
          '· **빈 시간 찾기** — “이번 주에 2시간 언제 비어?”',
          '',
          '고정된 일정에 넣기 애매한 것도 그냥 여기에 적어 두세요. 필요할 때 제가 꺼내 드릴게요.',
        ].join('\n'),
      };

    case 'query-day': {
      const date = parseDate(text) ?? today();
      return { engine: 'local', text: describeDay(state, date) };
    }

    case 'query-next':
      return { engine: 'local', text: nextEvent(state) };

    case 'find-slot':
      return findSlots(state, text);

    case 'free-check': {
      const date = parseDate(text) ?? today();
      const occ = eventsOnDay(digest(state, date, date), date).filter((e) => !e.allDay);
      const label = formatDateKo(date, { weekday: true });
      if (!occ.length) return { engine: 'local', text: `${label}은 통째로 비어 있어요.` };
      const busy = occ.reduce(
        (s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000,
        0,
      );
      const verdict = busy > 300 ? '꽤 빡빡해요' : busy > 120 ? '적당해요' : '여유 있어요';
      return {
        engine: 'local',
        text: `${label}은 일정 ${occ.length}개, 총 ${formatDuration(Math.round(busy))} — ${verdict}.`,
      };
    }

    case 'count': {
      const date = parseDate(text) ?? today();
      const isWeek = /주/.test(text);
      const to = isWeek ? addDays(date, 6) : date;
      const n = digest(state, date, to).length;
      return {
        engine: 'local',
        text: `${isWeek ? '그 주에는' : `${formatDateKo(date)}에는`} 일정이 ${n}개 있어요.`,
      };
    }

    case 'create': {
      const { draft, summary } = buildDraft(text);
      return {
        engine: 'local',
        text: `이렇게 만들까요?\n\n${summary}`,
        actions: [{ type: 'create-event', draft, label: '이대로 추가' }],
      };
    }

    default:
      return {
        engine: 'local',
        text: [
          '적어 두었어요. 일정으로 올리고 싶으면 날짜나 시간을 알려 주세요 — “내일 3시”처럼요.',
          '',
          '아니면 “오늘 뭐 있어?”, “이번 주에 2시간 언제 비어?”라고 물어봐도 돼요.',
        ].join('\n'),
      };
  }
}

/* ================================================================== *
 * Remote engine
 * ================================================================== */

/** A compact schedule summary — the only thing sent, and only when configured. */
function buildContext(state: AppState): string {
  const from = today();
  const to = addDays(from, 7);
  const occ = digest(state, from, to);
  const lines = occ.slice(0, 40).map((e) =>
    `${e.start.slice(0, 10)} ${e.allDay ? '종일' : e.start.slice(11, 16)} ${e.title}`,
  );
  const reminders = state.reminders
    .filter((r) => !r.done)
    .slice(0, 10)
    .map((r) => `- ${r.title}${r.due ? ` (${r.due.slice(0, 10)})` : ''}`);

  return [
    `오늘: ${from}`,
    state.profile ? `사용자: ${state.profile.displayName}` : '',
    '향후 7일 일정:',
    lines.length ? lines.join('\n') : '(없음)',
    reminders.length ? `미완료 미리알림:\n${reminders.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function ask(state: AppState, text: string): Promise<CycleReply> {
  if (!BASE) return localReply(state, text);

  try {
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        system:
          'You are Cycle, the assistant inside the Eidos calendar app. Answer in Korean, ' +
          'concisely, in the user\'s own register. You may propose calendar events as JSON ' +
          'in an `actions` array. Never invent events that are not in the provided schedule.',
        context: buildContext(state),
        message: text,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const reply = typeof json?.text === 'string' ? json.text : '';
    if (!reply) throw new Error('empty');
    return {
      engine: 'remote',
      text: reply,
      actions: Array.isArray(json.actions) ? (json.actions as CycleAction[]) : undefined,
    };
  } catch {
    // Network down or endpoint misconfigured — the local engine still answers.
    return localReply(state, text);
  }
}

/** Single-shot prompt, used by the moderation reviewer. Null when no remote engine. */
export async function askRaw(prompt: string): Promise<string> {
  if (!BASE) throw new Error('no remote engine');
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, message: prompt }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  return String(json?.text ?? '');
}

export const hasRemoteEngine = () => Boolean(BASE);
