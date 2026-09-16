import {
  addDays, formatDateKo, formatDuration, formatTime, minutesBetween, today,
} from '../../core/date.ts';
import { eventsOnDay, freeSlots, occurrencesInRange } from '../../core/recurrence.ts';
import { localReply } from '../../services/cycle.ts';
import type { AppState, EidosEvent, ISODate, JournalEntry, WeatherNow } from '../../core/types.ts';

/**
 * Composes the text of a brief from the user's actual day.
 *
 * Kept separate from the component so the wording is testable and so the same
 * composition can be reused by a future push notification, which will have a
 * data source but no DOM.
 */

export type Phase = 'dawn' | 'morning' | 'day' | 'dusk' | 'night';

export function phaseOf(hour: number): Phase {
  if (hour < 6) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 17) return 'day';
  if (hour < 20) return 'dusk';
  return 'night';
}

export function greeting(phase: Phase, name: string): string {
  const who = name ? `${name}님` : '';
  switch (phase) {
    case 'dawn': return `이른 아침이에요${who ? `, ${who}` : ''}`;
    case 'morning': return `좋은 아침이에요${who ? `, ${who}` : ''}`;
    case 'day': return `오늘 하루 중간이에요${who ? `, ${who}` : ''}`;
    case 'dusk': return `하루가 저물어요${who ? `, ${who}` : ''}`;
    default: return `오늘 수고 많았어요${who ? `, ${who}` : ''}`;
  }
}

export interface DayShape {
  date: ISODate;
  all: EidosEvent[];
  timed: EidosEvent[];
  allDay: EidosEvent[];
  firstTimed?: EidosEvent;
  busyMinutes: number;
  longestGap?: { start: number; end: number };
}

export function shapeOfDay(state: AppState, date: ISODate): DayShape {
  const visible = new Set(state.calendars.filter((c) => c.visible).map((c) => c.id));
  const occ = occurrencesInRange(
    state.events.filter((e) => visible.has(e.calendarId)),
    date,
    date,
  );
  const all = eventsOnDay(occ, date);
  const timed = all.filter((e) => !e.allDay);
  const busyMinutes = timed
    .filter((e) => e.availability === 'busy')
    .reduce((s, e) => s + Math.max(0, minutesBetween(e.start, e.end)), 0);

  const gaps = freeSlots(all, date, 45, 9 * 60, 21 * 60);
  const longestGap = gaps.sort((a, b) => b.end - b.start - (a.end - a.start))[0];

  return {
    date,
    all,
    timed,
    allDay: all.filter((e) => e.allDay),
    firstTimed: timed[0],
    busyMinutes,
    longestGap,
  };
}

/** The single sentence at the top of the morning brief. */
export function morningHeadline(shape: DayShape, weather: WeatherNow | null): string {
  if (!shape.all.length) {
    return weather && weather.precipitationChance >= 50
      ? '일정은 비어 있고, 비가 와요'
      : '오늘은 비어 있어요';
  }

  const first = shape.firstTimed;
  const parts: string[] = [];

  if (first) {
    const leaveBy = first.travelTimeMinutes
      ? new Date(new Date(first.start).getTime() - first.travelTimeMinutes * 60_000)
      : null;
    parts.push(
      leaveBy
        ? `${formatTime(fmt(leaveBy))}에 나서면 ${first.title}에 늦지 않아요`
        : `${formatTime(first.start)} ${first.title}로 시작해요`,
    );
  } else if (shape.allDay.length) {
    parts.push(`오늘은 ${shape.allDay[0].title}`);
  }

  if (shape.busyMinutes >= 360) parts.push('꽤 빡빡한 하루예요');
  else if (shape.busyMinutes >= 180) parts.push(`일정 ${shape.all.length}개`);

  return parts.join('. ');
}

export function nightHeadline(shape: DayShape, journal?: JournalEntry): string {
  const done = journal?.completed.length ?? 0;
  const total = shape.all.filter((e) => e.origin !== 'holiday').length;
  if (!total) return '오늘은 일정이 없던 하루였어요';
  if (done === 0) return `오늘 ${total}개의 일정이 있었어요`;
  if (done === total) return `오늘 계획한 ${total}개, 전부 해냈어요`;
  return `${total}개 중 ${done}개를 해냈어요`;
}

/** What the morning brief says about the shape of the day, beyond the list. */
export function dayNotes(shape: DayShape): string[] {
  const out: string[] = [];

  if (shape.busyMinutes > 0) {
    out.push(`회의·약속으로 채워진 시간 ${formatDuration(shape.busyMinutes)}`);
  }

  // Back-to-back runs are the thing people actually want warned about.
  const sorted = [...shape.timed].sort((a, b) => (a.start < b.start ? -1 : 1));
  let run = 1;
  let worstRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = minutesBetween(sorted[i - 1].end, sorted[i].start);
    if (gap <= 10) {
      run += 1;
      worstRun = Math.max(worstRun, run);
    } else run = 1;
  }
  if (worstRun >= 3) out.push(`연속 ${worstRun}개 일정 — 중간에 쉴 틈이 거의 없어요`);

  if (shape.longestGap) {
    const len = shape.longestGap.end - shape.longestGap.start;
    if (len >= 90) {
      out.push(`${fmtMin(shape.longestGap.start)}부터 ${formatDuration(len)} 비어 있어요`);
    }
  }

  const travel = shape.timed.filter((e) => e.travelTimeMinutes);
  if (travel.length >= 2) out.push(`이동이 ${travel.length}번 있어요`);

  return out;
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m % 60 === 0 ? `${period} ${h12}시` : `${period} ${h12}:${String(m % 60).padStart(2, '0')}`;
}

function fmt(d: Date): string {
  return `${d.toISOString().slice(0, 10)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

/**
 * Answers the user's own standing questions. Routed through the same engine
 * that powers the Cycle tab, so a question asked in the brief and the same
 * question asked in chat get the same answer.
 */
export function answerQuestion(state: AppState, question: string): string {
  return localReply(state, question).text;
}

/** Yesterday's plan vs. what the journal says happened — the night brief's spine. */
export function reviewItems(state: AppState, date: ISODate): { id: string; title: string; done: boolean }[] {
  const shape = shapeOfDay(state, date);
  const journal = state.journal.find((j) => j.date === date);
  const doneSet = new Set(journal?.completed ?? []);

  const fromEvents = shape.all
    .filter((e) => e.origin !== 'holiday' && e.availability === 'busy')
    .map((e) => ({ id: e.id, title: e.title, done: doneSet.has(e.id) }));

  const fromReminders = state.reminders
    .filter((r) => r.due?.slice(0, 10) === date)
    .map((r) => ({ id: r.id, title: r.title, done: r.done }));

  return [...fromEvents, ...fromReminders];
}

/** Tomorrow, condensed to the one thing that changes what you do tonight. */
export function tomorrowNote(state: AppState): string {
  const t = addDays(today(), 1);
  const shape = shapeOfDay(state, t);
  if (!shape.all.length) return '내일은 비어 있어요. 푹 쉬어도 돼요.';

  const first = shape.firstTimed;
  if (!first) return `내일은 ${shape.allDay.map((e) => e.title).join(', ')}.`;

  const leave = first.travelTimeMinutes
    ? new Date(new Date(first.start).getTime() - first.travelTimeMinutes * 60_000)
    : null;

  const startHour = new Date(first.start).getHours();
  const early = startHour <= 8 ? ' 이른 시작이니 오늘은 일찍 자는 게 좋아요.' : '';

  return leave
    ? `내일 첫 일정은 ${formatTime(first.start)} ${first.title}. ${formatTime(fmt(leave))}에는 나서야 해요.${early}`
    : `내일 첫 일정은 ${formatTime(first.start)} ${first.title}.${early}`;
}

/** Fourteen days of "how full was this day", for the streak strip. */
export function loadHistory(state: AppState): { date: ISODate; value: number }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today(), i - 13);
    const shape = shapeOfDay(state, d);
    return { date: d, value: Math.min(100, Math.round((shape.busyMinutes / 480) * 100)) };
  });
}

export function journalStreak(state: AppState): number {
  let n = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(today(), -i);
    const entry = state.journal.find((j) => j.date === d);
    if (!entry || (!entry.note && !entry.mood)) {
      // Today not yet written is not a broken streak.
      if (i === 0) continue;
      break;
    }
    n += 1;
  }
  return n;
}

export const dateTitle = (d: ISODate) => formatDateKo(d, { weekday: true });
