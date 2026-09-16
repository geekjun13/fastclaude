import { useEffect, useMemo, useRef } from 'react';
import {
  addDays, formatDateKo, formatTime, fromISODate, isSameMonth, isToday, monthGrid,
  MONTHS_KO, startOfMonth, toISODate, WEEKDAYS_KO, weekDates,
} from '../../core/date.ts';
import { eventsOnDay, layoutDay } from '../../core/recurrence.ts';
import type { Calendar, EidosEvent, ISODate } from '../../core/types.ts';
import './calendar.css';

export interface ViewProps {
  occurrences: EidosEvent[];
  calendars: Calendar[];
  focusedDate: ISODate;
  weekStartsOn: 0 | 1;
  onFocus: (d: ISODate) => void;
  onOpenDay: (d: ISODate) => void;
  onSelectEvent: (e: EidosEvent) => void;
  onCompose: (draft: Partial<EidosEvent>) => void;
}

function colorOf(calendars: Calendar[], id: string): string {
  return calendars.find((c) => c.id === id)?.color ?? 'var(--a-graphite)';
}

/* ================================================================ *
 * Month
 * ================================================================ */

export function MonthView(p: ViewProps) {
  const cells = useMemo(() => monthGrid(p.focusedDate, p.weekStartsOn), [p.focusedDate, p.weekStartsOn]);
  const byDay = useMemo(() => {
    const map = new Map<ISODate, EidosEvent[]>();
    for (const d of cells) map.set(d, eventsOnDay(p.occurrences, d));
    return map;
  }, [cells, p.occurrences]);

  // How many chips fit is a function of row height, so it is measured rather
  // than assumed — otherwise short months clip and tall months waste space.
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <WeekdayHeader weekStartsOn={p.weekStartsOn} />
      <div className="month-grid" ref={gridRef} role="grid" aria-label="월간 달력">
        {cells.map((date) => {
          const items = byDay.get(date) ?? [];
          const outside = !isSameMonth(date, p.focusedDate);
          const wd = fromISODate(date).getDay();
          const holiday = items.some((e) => e.origin === 'holiday');
          const shown = items.slice(0, 3);

          return (
            <button
              key={date}
              className="month-cell"
              role="gridcell"
              data-outside={outside}
              data-focused={date === p.focusedDate}
              aria-label={`${formatDateKo(date, { weekday: true })}, 일정 ${items.length}개`}
              onClick={() => p.onFocus(date)}
              onDoubleClick={() => p.onOpenDay(date)}
            >
              <span className="daynum" data-wd={wd} data-today={isToday(date)} data-holiday={holiday}>
                {fromISODate(date).getDate()}
              </span>
              <span className="chips">
                {shown.map((e) => (
                  <span
                    key={e.id}
                    className="chip-ev"
                    data-allday={e.allDay}
                    style={{ '--c': colorOf(p.calendars, e.calendarId) } as React.CSSProperties}
                    title={e.title}
                  >
                    {!e.allDay ? <span className="dot" /> : null}
                    {e.title}
                  </span>
                ))}
                {items.length > shown.length ? (
                  <span className="chip-more">+{items.length - shown.length}개 더</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function WeekdayHeader({ weekStartsOn }: { weekStartsOn: 0 | 1 }) {
  const order = weekStartsOn === 0 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="cal-weekdays" aria-hidden>
      {order.map((wd) => (
        <span key={wd} data-wd={wd}>{WEEKDAYS_KO[wd]}</span>
      ))}
    </div>
  );
}

/* ================================================================ *
 * Timeline shared by Day and Week
 * ================================================================ */

const HOUR_PX = 52;
const GUTTER = 54;

function useScrollToNow(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const now = new Date();
    const target = Math.max(0, (now.getHours() - 2) * HOUR_PX);
    ref.current.scrollTop = target;
  }, [ref, active]);
}

function NowLine({ columns, columnIndex }: { columns: number; columnIndex: number }) {
  const now = new Date();
  const top = (now.getHours() * 60 + now.getMinutes()) * (HOUR_PX / 60);
  const width = 100 / columns;
  return (
    <div
      className="now-line"
      style={{
        top,
        left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${columnIndex * width} / 100)`,
        width: `calc((100% - ${GUTTER}px) * ${width} / 100)`,
      }}
      aria-hidden
    />
  );
}

interface TimelineColumnProps {
  date: ISODate;
  events: EidosEvent[];
  calendars: Calendar[];
  onSelectEvent: (e: EidosEvent) => void;
  onCompose: (draft: Partial<EidosEvent>) => void;
}

function TimelineColumn({ date, events, calendars, onSelectEvent, onCompose }: TimelineColumnProps) {
  const laid = useMemo(() => layoutDay(events), [events]);

  return (
    <>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="hour-cell"
          style={{ position: 'absolute', top: h * HOUR_PX, height: HOUR_PX, left: 0, right: 0 }}
          onClick={() =>
            onCompose({
              start: `${date}T${String(h).padStart(2, '0')}:00:00`,
              end: `${date}T${String(Math.min(23, h + 1)).padStart(2, '0')}:00:00`,
              allDay: false,
            })
          }
        />
      ))}
      {laid.map(({ event, column, columns }) => {
        const s = fromISODate(date);
        const startD = new Date(event.start);
        const endD = new Date(event.end);
        // Clamp to the day so a multi-day event renders a sensible band.
        const dayStart = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
        const top = Math.max(0, (startD.getTime() - dayStart) / 60000) * (HOUR_PX / 60);
        const rawH = ((endD.getTime() - Math.max(startD.getTime(), dayStart)) / 60000) * (HOUR_PX / 60);
        const height = Math.max(18, Math.min(rawH, 24 * HOUR_PX - top));
        const w = 100 / columns;

        return (
          <button
            key={event.id}
            className="tl-event"
            style={{
              top,
              height,
              left: `${column * w}%`,
              width: `calc(${w}% - 3px)`,
              '--c': colorOf(calendars, event.calendarId),
            } as React.CSSProperties}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEvent(event);
            }}
          >
            <strong>{event.title}</strong>
            {height > 32 ? <span>{formatTime(event.start)}</span> : null}
          </button>
        );
      })}
    </>
  );
}

function AllDayStrip({
  dates, occurrences, calendars, onSelectEvent,
}: {
  dates: ISODate[];
  occurrences: EidosEvent[];
  calendars: Calendar[];
  onSelectEvent: (e: EidosEvent) => void;
}) {
  const perDay = dates.map((d) => eventsOnDay(occurrences, d).filter((e) => e.allDay));
  if (perDay.every((x) => x.length === 0)) return null;

  return (
    <div
      className="timeline-allday"
      style={{ gridTemplateColumns: `${GUTTER}px repeat(${dates.length}, 1fr)` }}
    >
      <div className="allday-cell">
        <span className="tiny dim" style={{ paddingLeft: 2 }}>종일</span>
      </div>
      {perDay.map((items, i) => (
        <div className="allday-cell" key={dates[i]}>
          {items.map((e) => (
            <button
              key={e.id}
              className="chip-ev"
              data-allday="true"
              style={{ '--c': colorOf(calendars, e.calendarId) } as React.CSSProperties}
              onClick={() => onSelectEvent(e)}
            >
              {e.title}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================================================================ *
 * Day
 * ================================================================ */

export function DayView(p: ViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollToNow(ref, true);
  const timed = useMemo(
    () => eventsOnDay(p.occurrences, p.focusedDate).filter((e) => !e.allDay),
    [p.occurrences, p.focusedDate],
  );

  return (
    <div className="timeline-wrap">
      <AllDayStrip
        dates={[p.focusedDate]}
        occurrences={p.occurrences}
        calendars={p.calendars}
        onSelectEvent={p.onSelectEvent}
      />
      <div className="timeline scroll-y" ref={ref}>
        <div className="timeline-inner" style={{ height: 24 * HOUR_PX, position: 'relative' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="hour-row"
              style={{
                position: 'absolute',
                top: h * HOUR_PX,
                left: 0,
                right: 0,
                height: HOUR_PX,
                gridTemplateColumns: `${GUTTER}px 1fr`,
              }}
            >
              <span className="hour-label">{h === 0 ? '' : `${h}시`}</span>
              <span />
            </div>
          ))}
          <div style={{ position: 'absolute', inset: 0, left: GUTTER }}>
            <TimelineColumn
              date={p.focusedDate}
              events={timed}
              calendars={p.calendars}
              onSelectEvent={p.onSelectEvent}
              onCompose={p.onCompose}
            />
          </div>
          {isToday(p.focusedDate) ? <NowLine columns={1} columnIndex={0} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ *
 * Week
 * ================================================================ */

export function WeekView(p: ViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollToNow(ref, true);
  const dates = useMemo(() => weekDates(p.focusedDate, p.weekStartsOn), [p.focusedDate, p.weekStartsOn]);
  const todayIndex = dates.findIndex(isToday);

  return (
    <div className="timeline-wrap">
      <div className="week-head" style={{ gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)` }}>
        <span />
        {dates.map((d) => (
          <button
            key={d}
            className="week-head-cell"
            data-today={isToday(d)}
            data-focused={d === p.focusedDate}
            onClick={() => p.onFocus(d)}
          >
            <div className="wd">{WEEKDAYS_KO[fromISODate(d).getDay()]}</div>
            <div className="dn">{fromISODate(d).getDate()}</div>
          </button>
        ))}
      </div>

      <AllDayStrip
        dates={dates}
        occurrences={p.occurrences}
        calendars={p.calendars}
        onSelectEvent={p.onSelectEvent}
      />

      <div className="timeline scroll-y" ref={ref}>
        <div className="timeline-inner" style={{ height: 24 * HOUR_PX, position: 'relative' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="hour-row"
              style={{
                position: 'absolute',
                top: h * HOUR_PX,
                left: 0,
                right: 0,
                height: HOUR_PX,
                gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`,
              }}
            >
              <span className="hour-label">{h === 0 ? '' : `${h}시`}</span>
              {dates.map((d) => <span className="hour-cell" key={d} />)}
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              left: GUTTER,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
            }}
          >
            {dates.map((d) => (
              <div key={d} style={{ position: 'relative' }}>
                <TimelineColumn
                  date={d}
                  events={eventsOnDay(p.occurrences, d).filter((e) => !e.allDay)}
                  calendars={p.calendars}
                  onSelectEvent={p.onSelectEvent}
                  onCompose={p.onCompose}
                />
              </div>
            ))}
          </div>
          {todayIndex >= 0 ? <NowLine columns={7} columnIndex={todayIndex} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ *
 * Year
 * ================================================================ */

export function YearView(p: ViewProps) {
  const year = fromISODate(p.focusedDate).getFullYear();
  const busy = useMemo(() => {
    const set = new Set<ISODate>();
    for (const e of p.occurrences) set.add(e.start.slice(0, 10));
    return set;
  }, [p.occurrences]);

  return (
    <div className="year-grid scroll-y">
      {Array.from({ length: 12 }, (_, m) => {
        const anchor = toISODate(new Date(year, m, 1));
        const cells = monthGrid(anchor, p.weekStartsOn);
        const order = p.weekStartsOn === 0 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
        return (
          <div
            className="mini-month"
            key={m}
            data-other={m !== fromISODate(p.focusedDate).getMonth()}
          >
            <h4>{MONTHS_KO[m]}</h4>
            <div className="mini-grid">
              {order.map((wd) => (
                <span className="head" key={`h${wd}`}>{WEEKDAYS_KO[wd]}</span>
              ))}
              {cells.map((d) => (
                <button
                  key={d}
                  data-outside={!isSameMonth(d, anchor)}
                  data-today={isToday(d)}
                  data-has={busy.has(d) && isSameMonth(d, anchor)}
                  onClick={() => {
                    p.onFocus(d);
                    p.onOpenDay(d);
                  }}
                >
                  {fromISODate(d).getDate()}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================ *
 * List — also the search results view
 * ================================================================ */

export function ListView(p: ViewProps & { query?: string; days?: number }) {
  const start = p.query ? addDays(p.focusedDate, -180) : startOfMonth(p.focusedDate);
  const span = p.days ?? (p.query ? 540 : 120);

  const grouped = useMemo(() => {
    const q = p.query?.trim().toLowerCase() ?? '';
    const map = new Map<ISODate, EidosEvent[]>();
    for (let i = 0; i < span; i++) {
      const d = addDays(start, i);
      let items = eventsOnDay(p.occurrences, d);
      if (q) {
        items = items.filter((e) =>
          [e.title, e.location, e.notes].filter(Boolean).join(' ').toLowerCase().includes(q),
        );
      }
      if (items.length) map.set(d, items);
    }
    return [...map.entries()];
  }, [p.occurrences, p.query, start, span]);

  if (!grouped.length) {
    return (
      <div className="list-view">
        <div className="empty">
          <strong>{p.query ? '검색 결과가 없어요' : '표시할 일정이 없어요'}</strong>
          <span className="small">{p.query ? '다른 단어로 찾아보세요' : '+ 버튼으로 일정을 추가해 보세요'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="list-view">
      {grouped.map(([date, items]) => (
        <div className="list-day" key={date}>
          <div className="list-date" data-today={isToday(date)}>
            <div className="d">{fromISODate(date).getDate()}</div>
            <div className="w">{WEEKDAYS_KO[fromISODate(date).getDay()]}</div>
          </div>
          <div className="list-rows">
            {items.map((e) => (
              <button
                key={e.id}
                className="ev-row"
                style={{ '--c': colorOf(p.calendars, e.calendarId) } as React.CSSProperties}
                onClick={() => p.onSelectEvent(e)}
              >
                <span className="ev-bar" />
                <span className="ev-main">
                  <strong>{e.title}</strong>
                  <span className="meta">
                    {e.location ? <span>{e.location}</span> : null}
                    {e.origin && e.origin !== 'user' ? (
                      <span className="dim">
                        {e.origin === 'edu-assessment' ? '수행평가'
                          : e.origin === 'edu-timetable' ? '시간표'
                          : e.origin === 'group' ? '그룹'
                          : e.origin === 'cycle' ? 'Cycle'
                          : '공휴일'}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="ev-time">{e.allDay ? '종일' : formatTime(e.start)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
