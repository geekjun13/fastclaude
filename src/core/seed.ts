import { addDays, setTimeOn, today, toISODate } from './date.ts';
import { uid } from './storage.ts';
import type { AppState, Calendar, EidosEvent, Reminder } from './types.ts';

/**
 * First-run content. Not a demo: these are the calendars Apple Calendar ships
 * with (Personal / Work / Family / Holidays), plus a handful of events placed
 * relative to today so every view has something real to lay out.
 */

export function seedCalendars(): Calendar[] {
  return [
    { id: 'cal_personal', title: '개인', color: 'var(--a-blue)', kind: 'personal', visible: true },
    { id: 'cal_work', title: '업무', color: 'var(--a-indigo)', kind: 'personal', visible: true },
    { id: 'cal_family', title: '가족', color: 'var(--a-green)', kind: 'personal', visible: true },
    { id: 'cal_health', title: '건강', color: 'var(--a-teal)', kind: 'personal', visible: true },
    {
      id: 'cal_holiday',
      title: '대한민국 공휴일',
      color: 'var(--a-red)',
      kind: 'holiday',
      visible: true,
      readOnly: true,
    },
  ];
}

function ev(partial: Omit<Partial<EidosEvent>, 'id'> & { title: string; start: string; end: string }): EidosEvent {
  const now = new Date().toISOString();
  return {
    id: uid('ev'),
    calendarId: 'cal_personal',
    allDay: false,
    alarms: [10],
    availability: 'busy',
    origin: 'user',
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as EidosEvent;
}

export function seedEvents(): EidosEvent[] {
  const t = today();
  return [
    ev({
      title: '팀 스탠드업',
      calendarId: 'cal_work',
      start: setTimeOn(t, '09:30'),
      end: setTimeOn(t, '09:45'),
      location: '3층 회의실 B',
      alarms: [5],
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
    }),
    ev({
      title: '분기 로드맵 리뷰',
      calendarId: 'cal_work',
      start: setTimeOn(t, '11:00'),
      end: setTimeOn(t, '12:30'),
      location: '대회의실',
      notes: 'Q4 목표 초안 · 지표 슬라이드 지참',
      travelTimeMinutes: 15,
      alarms: [30],
    }),
    ev({
      title: '점심 — 지수',
      start: setTimeOn(t, '12:45'),
      end: setTimeOn(t, '13:45'),
      location: '을지로 3가',
      calendarId: 'cal_personal',
    }),
    ev({
      title: '헬스장',
      calendarId: 'cal_health',
      start: setTimeOn(t, '19:00'),
      end: setTimeOn(t, '20:00'),
      availability: 'free',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] },
    }),
    ev({
      title: '치과 검진',
      calendarId: 'cal_health',
      start: setTimeOn(addDays(t, 2), '15:00'),
      end: setTimeOn(addDays(t, 2), '16:00'),
      location: '연세바른치과',
      travelTimeMinutes: 25,
      alarms: [60, 1440],
    }),
    ev({
      title: '부모님 방문',
      calendarId: 'cal_family',
      start: addDays(t, 5),
      end: addDays(t, 6),
      allDay: true,
      alarms: [1440],
    }),
    ev({
      title: '프로젝트 마감',
      calendarId: 'cal_work',
      start: addDays(t, 9),
      end: addDays(t, 9),
      allDay: true,
      alarms: [1440, 2880],
    }),
    ev({
      title: '월간 회고',
      calendarId: 'cal_work',
      start: setTimeOn(addDays(t, 12), '16:00'),
      end: setTimeOn(addDays(t, 12), '17:00'),
      recurrence: { freq: 'monthly', interval: 1 },
    }),
  ];
}

export function seedReminders(): Reminder[] {
  const t = today();
  const now = new Date().toISOString();
  const r = (title: string, opts: Partial<Reminder> = {}): Reminder => ({
    id: uid('rm'),
    calendarId: 'cal_personal',
    title,
    priority: 'none',
    done: false,
    createdAt: now,
    ...opts,
  });
  return [
    r('로드맵 슬라이드 마무리', { due: setTimeOn(t, '10:30'), priority: 'high', calendarId: 'cal_work' }),
    r('세탁물 찾기', { due: setTimeOn(t, '18:30') }),
    r('여권 갱신 신청', { due: setTimeOn(addDays(t, 4), '09:00'), priority: 'medium' }),
    r('책 반납', { due: setTimeOn(addDays(t, 1), '17:00') }),
  ];
}

/** Korean public holidays. Kept as a fixed table — the solar-date ones are stable. */
export function seedHolidays(year: number): EidosEvent[] {
  const fixed: [string, string][] = [
    ['01-01', '신정'],
    ['03-01', '삼일절'],
    ['05-05', '어린이날'],
    ['06-06', '현충일'],
    ['08-15', '광복절'],
    ['10-03', '개천절'],
    ['10-09', '한글날'],
    ['12-25', '크리스마스'],
  ];
  const now = new Date().toISOString();
  return fixed.map(([md, title]) => ({
    id: `hol_${year}_${md}`,
    calendarId: 'cal_holiday',
    title,
    start: `${year}-${md}`,
    end: `${year}-${md}`,
    allDay: true,
    alarms: [],
    availability: 'free' as const,
    origin: 'holiday' as const,
    createdAt: now,
    updatedAt: now,
  }));
}

export function initialState(): AppState {
  const year = new Date().getFullYear();
  return {
    profile: null,
    calendars: seedCalendars(),
    events: [...seedEvents(), ...seedHolidays(year), ...seedHolidays(year + 1)],
    reminders: seedReminders(),
    groups: [],
    shared: [],
    journal: [],
    briefs: [],
    cycleThread: [],
    ui: {
      tab: 'calendar',
      view: 'month',
      focusedDate: toISODate(new Date()),
      selectedEventId: null,
      editorOpen: false,
      editorDraft: null,
      search: '',
      theme: 'system',
      weekStartsOn: 0,
    },
  };
}
