import type { ISODate, ISODateTime } from './types.ts';

/* Local wall-clock date helpers. Everything in Eidos is local time by design:
   a calendar entry means "9am where you are", not an instant on a timeline. */

export const MS_DAY = 86_400_000;

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;
export const MONTHS_KO = [
  '1월', '2월', '3월', '4월', '5월', '6월', '7월',
  '8월', '9월', '10월', '11월', '12월',
] as const;

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODateTime(d: Date): ISODateTime {
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function fromISODateTime(s: ISODateTime): Date {
  const [datePart, timePart = '00:00:00'] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // Clamp: Jan 31 + 1 month is Feb 28/29, not Mar 3.
  d.setDate(Math.min(targetDay, daysInMonth(d.getFullYear(), d.getMonth())));
  return toISODate(d);
}

export function addYears(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  d.setFullYear(d.getFullYear() + n);
  return toISODate(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / MS_DAY);
}

export function weekdayOf(s: ISODate): number {
  return fromISODate(s).getDay();
}

export function startOfWeek(s: ISODate, weekStartsOn: 0 | 1 = 0): ISODate {
  const wd = weekdayOf(s);
  const delta = (wd - weekStartsOn + 7) % 7;
  return addDays(s, -delta);
}

export function startOfMonth(s: ISODate): ISODate {
  const d = fromISODate(s);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(s: ISODate): ISODate {
  const d = fromISODate(s);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** The 6x7 grid Apple Calendar's month view uses — always 42 cells, no layout jump. */
export function monthGrid(s: ISODate, weekStartsOn: 0 | 1 = 0): ISODate[] {
  const first = startOfWeek(startOfMonth(s), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDates(s: ISODate, weekStartsOn: 0 | 1 = 0): ISODate[] {
  const first = startOfWeek(s, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function isToday(s: ISODate): boolean {
  return s === today();
}

export function isWeekend(s: ISODate): boolean {
  const wd = weekdayOf(s);
  return wd === 0 || wd === 6;
}

/* ---------------- Formatting ---------------- */

export function formatTime(s: ISODateTime, use24h = false): string {
  const d = fromISODateTime(s);
  const h = d.getHours();
  const m = d.getMinutes();
  if (use24h) return `${pad(h)}:${pad(m)}`;
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${period} ${h12}시` : `${period} ${h12}:${pad(m)}`;
}

export function formatDateKo(s: ISODate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = fromISODate(s);
  const base = `${opts.year ? `${d.getFullYear()}년 ` : ''}${d.getMonth() + 1}월 ${d.getDate()}일`;
  return opts.weekday ? `${base} ${WEEKDAYS_KO[d.getDay()]}요일` : base;
}

export function formatRelativeDay(s: ISODate): string {
  const delta = diffDays(today(), s);
  if (delta === 0) return '오늘';
  if (delta === 1) return '내일';
  if (delta === 2) return '모레';
  if (delta === -1) return '어제';
  if (delta === -2) return '그저께';
  if (delta > 0 && delta < 7) return `${delta}일 후`;
  if (delta < 0 && delta > -7) return `${-delta}일 전`;
  return formatDateKo(s);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function minutesBetween(a: ISODateTime, b: ISODateTime): number {
  return Math.round((fromISODateTime(b).getTime() - fromISODateTime(a).getTime()) / 60_000);
}

/** Minutes from local midnight — the y-coordinate for timeline layout. */
export function minutesFromMidnight(s: ISODateTime): number {
  const d = fromISODateTime(s);
  return d.getHours() * 60 + d.getMinutes();
}

export function setTimeOn(date: ISODate, hhmm: string): ISODateTime {
  return `${date}T${hhmm.length === 5 ? hhmm : '00:00'}:00`;
}

export function clampToQuarter(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return out;
}
