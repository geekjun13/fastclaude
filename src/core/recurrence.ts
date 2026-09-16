import { addDays, addMonths, addYears, daysInMonth, diffDays, fromISODate, toISODate, weekdayOf } from './date.ts';
import type { EidosEvent, ISODate, Recurrence } from './types.ts';

/**
 * Expands a recurrence rule into the dates it occurs on inside [from, to].
 *
 * This is a deliberately small subset of RFC 5545 — the part Apple Calendar's
 * repeat picker actually exposes: daily / weekly (with weekday set) / every-2-weeks /
 * monthly by day-of-month / yearly, each with an optional end date or count, plus
 * per-occurrence exceptions ("delete this event only").
 */
export function expandRecurrence(
  startDate: ISODate,
  rule: Recurrence,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  if (rule.freq === 'none') {
    return startDate >= from && startDate <= to ? [startDate] : [];
  }

  const out: ISODate[] = [];
  const exceptions = new Set(rule.exceptions ?? []);
  const hardStop = rule.until && rule.until < to ? rule.until : to;
  const interval = Math.max(1, rule.interval || 1);
  let emitted = 0;

  // Guard against pathological rules; a year of daily events is 365 iterations.
  const MAX_STEPS = 4000;

  const accept = (d: ISODate): boolean => {
    if (d < startDate || d > hardStop) return false;
    if (exceptions.has(d)) return false;
    return true;
  };

  const push = (d: ISODate) => {
    emitted += 1;
    if (d >= from) out.push(d);
  };

  switch (rule.freq) {
    case 'daily': {
      let cursor = startDate;
      for (let i = 0; i < MAX_STEPS && cursor <= hardStop; i++) {
        if (accept(cursor)) push(cursor);
        if (rule.count && emitted >= rule.count) break;
        cursor = addDays(cursor, interval);
      }
      break;
    }

    case 'weekly':
    case 'biweekly':
    case 'custom': {
      const step = rule.freq === 'biweekly' ? 2 : interval;
      const days = rule.byWeekday?.length ? [...rule.byWeekday].sort() : [weekdayOf(startDate)];
      // Walk week by week from the start week.
      let weekAnchor = addDays(startDate, -weekdayOf(startDate));
      for (let w = 0; w < MAX_STEPS; w++) {
        if (weekAnchor > hardStop) break;
        for (const wd of days) {
          const d = addDays(weekAnchor, wd);
          if (accept(d)) {
            push(d);
            if (rule.count && emitted >= rule.count) break;
          }
        }
        if (rule.count && emitted >= rule.count) break;
        weekAnchor = addDays(weekAnchor, 7 * step);
      }
      break;
    }

    case 'monthly': {
      const target = rule.byMonthDay ?? fromISODate(startDate).getDate();
      let cursor = startDate;
      for (let i = 0; i < MAX_STEPS && cursor <= hardStop; i++) {
        const base = fromISODate(cursor);
        // Skip months that are too short rather than spilling into the next month.
        if (target <= daysInMonth(base.getFullYear(), base.getMonth())) {
          const d = toISODate(new Date(base.getFullYear(), base.getMonth(), target));
          if (accept(d)) {
            push(d);
            if (rule.count && emitted >= rule.count) break;
          }
        }
        cursor = addMonths(toISODate(new Date(base.getFullYear(), base.getMonth(), 1)), interval);
      }
      break;
    }

    case 'yearly': {
      let cursor = startDate;
      for (let i = 0; i < MAX_STEPS && cursor <= hardStop; i++) {
        if (accept(cursor)) {
          push(cursor);
          if (rule.count && emitted >= rule.count) break;
        }
        cursor = addYears(cursor, interval);
      }
      break;
    }
  }

  return out;
}

export function describeRecurrence(rule?: Recurrence): string {
  if (!rule || rule.freq === 'none') return '반복 안 함';
  const n = Math.max(1, rule.interval || 1);
  const KO = ['일', '월', '화', '수', '목', '금', '토'];
  let base: string;
  switch (rule.freq) {
    case 'daily': base = n === 1 ? '매일' : `${n}일마다`; break;
    case 'weekly': base = n === 1 ? '매주' : `${n}주마다`; break;
    case 'biweekly': base = '2주마다'; break;
    case 'monthly': base = n === 1 ? '매월' : `${n}개월마다`; break;
    case 'yearly': base = n === 1 ? '매년' : `${n}년마다`; break;
    default: base = '사용자 설정'; break;
  }
  if (rule.byWeekday?.length) {
    base += ` ${rule.byWeekday.map((d) => KO[d]).join('·')}요일`;
  }
  if (rule.byMonthDay && (rule.freq === 'monthly')) base += ` ${rule.byMonthDay}일`;
  if (rule.until) base += ` · ${rule.until}까지`;
  else if (rule.count) base += ` · ${rule.count}회`;
  return base;
}

/**
 * Materialises every occurrence of every event that touches [from, to].
 *
 * Multi-day events are emitted once per day they cover, so day/week views can
 * lay them out without re-deriving spans. The returned objects carry
 * `occurrenceDate` and `seriesId`, so edits can target either one instance or
 * the whole series.
 */
export function occurrencesInRange(
  events: EidosEvent[],
  from: ISODate,
  to: ISODate,
): EidosEvent[] {
  const out: EidosEvent[] = [];

  for (const ev of events) {
    const startDate = ev.start.slice(0, 10);
    const endDate = ev.end.slice(0, 10);
    const spanDays = Math.max(0, diffDays(startDate, endDate));

    const anchors = ev.recurrence && ev.recurrence.freq !== 'none'
      // Widen the search window by the span so an event starting before `from`
      // but still running inside it is not missed.
      ? expandRecurrence(startDate, ev.recurrence, addDays(from, -spanDays - 1), to)
      : (startDate <= to && endDate >= from ? [startDate] : []);

    for (const anchor of anchors) {
      const shift = diffDays(startDate, anchor);
      const occStart = shiftDateTime(ev.start, shift);
      const occEnd = shiftDateTime(ev.end, shift);
      const occStartDate = occStart.slice(0, 10);
      const occEndDate = occEnd.slice(0, 10);
      if (occEndDate < from || occStartDate > to) continue;

      out.push({
        ...ev,
        id: shift === 0 ? ev.id : `${ev.id}@${anchor}`,
        seriesId: ev.recurrence && ev.recurrence.freq !== 'none' ? ev.id : undefined,
        occurrenceDate: anchor,
        start: occStart,
        end: occEnd,
      });
    }
  }

  return out.sort(compareEvents);
}

/** Events touching a single day, all-day first, then by start time. */
export function eventsOnDay(occurrences: EidosEvent[], date: ISODate): EidosEvent[] {
  return occurrences
    .filter((e) => e.start.slice(0, 10) <= date && e.end.slice(0, 10) >= date)
    .sort(compareEvents);
}

export function compareEvents(a: EidosEvent, b: EidosEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  return a.title.localeCompare(b.title, 'ko');
}

function shiftDateTime(dt: string, days: number): string {
  if (days === 0) return dt;
  const [date, time] = dt.split('T');
  return time ? `${addDays(date, days)}T${time}` : addDays(date, days);
}

/**
 * Column layout for overlapping timed events, the way Apple's day view does it:
 * events that overlap in time are packed into the narrowest set of columns that
 * keeps them from covering each other, then each stretches right as far as it can.
 */
export interface LaidOutEvent {
  event: EidosEvent;
  column: number;
  columns: number;
}

export function layoutDay(events: EidosEvent[]): LaidOutEvent[] {
  const timed = events
    .filter((e) => !e.allDay)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const result: LaidOutEvent[] = [];
  let cluster: EidosEvent[] = [];
  let clusterEnd = '';

  const flush = () => {
    if (!cluster.length) return;
    const columns: EidosEvent[][] = [];
    for (const ev of cluster) {
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (last.end <= ev.start) {
          col.push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([ev]);
    }
    columns.forEach((col, ci) => {
      for (const ev of col) result.push({ event: ev, column: ci, columns: columns.length });
    });
    cluster = [];
    clusterEnd = '';
  };

  for (const ev of timed) {
    if (cluster.length && ev.start >= clusterEnd) flush();
    cluster.push(ev);
    if (ev.end > clusterEnd) clusterEnd = ev.end;
  }
  flush();

  return result;
}

/**
 * Free slots of at least `durationMinutes` on a day, between `dayStart` and `dayEnd`.
 * Backs both the "find a time" action and Cycle's scheduling suggestions.
 */
export function freeSlots(
  events: EidosEvent[],
  date: ISODate,
  durationMinutes: number,
  dayStart = 8 * 60,
  dayEnd = 22 * 60,
): { start: number; end: number }[] {
  const busy = events
    .filter((e) => !e.allDay && e.availability === 'busy' && e.start.slice(0, 10) === date)
    .map((e) => ({
      start: minutesOf(e.start) - (e.travelTimeMinutes ?? 0),
      end: minutesOf(e.end),
    }))
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else merged.push({ ...b });
  }

  const slots: { start: number; end: number }[] = [];
  let cursor = dayStart;
  for (const b of merged) {
    if (b.start - cursor >= durationMinutes) slots.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd - cursor >= durationMinutes) slots.push({ start: cursor, end: dayEnd });
  return slots;
}

function minutesOf(dt: string): number {
  const [, time = '00:00'] = dt.split('T');
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
