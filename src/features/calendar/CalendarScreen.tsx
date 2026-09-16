import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Icon, Segmented, Sheet } from '../../components/index.tsx';
import { GlassSurface } from '../../glass/GlassSurface.tsx';
import {
  addDays, addMonths, addYears, formatDateKo, formatTime, fromISODate, MONTHS_KO, today,
} from '../../core/date.ts';
import { describeRecurrence, occurrencesInRange } from '../../core/recurrence.ts';
import { useAppState, useDispatch } from '../../core/store.tsx';
import type { EidosEvent, ViewMode } from '../../core/types.ts';
import { EventEditor } from './EventEditor.tsx';
import { DayView, ListView, MonthView, WeekView, YearView } from './views.tsx';
import './calendar.css';

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: 'day', label: '일' },
  { value: 'week', label: '주' },
  { value: 'month', label: '월' },
  { value: 'year', label: '년' },
  { value: 'list', label: '목록' },
];

export function CalendarScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { ui, calendars, events } = state;
  const [selected, setSelected] = useState<EidosEvent | null>(null);
  const [calListOpen, setCalListOpen] = useState(false);

  /* The window to materialise. Generous enough that paging a month never waits,
     narrow enough that a daily 10-year series is not expanded in full. */
  const range = useMemo(() => {
    const d = ui.focusedDate;
    switch (ui.view) {
      case 'year': return { from: `${fromISODate(d).getFullYear()}-01-01`, to: `${fromISODate(d).getFullYear()}-12-31` };
      case 'day': return { from: addDays(d, -1), to: addDays(d, 1) };
      case 'week': return { from: addDays(d, -10), to: addDays(d, 10) };
      case 'list': return { from: addDays(d, -200), to: addDays(d, 400) };
      default: return { from: addMonths(d, -2), to: addMonths(d, 2) };
    }
  }, [ui.focusedDate, ui.view]);

  const occurrences = useMemo(() => {
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id));
    return occurrencesInRange(events.filter((e) => visible.has(e.calendarId)), range.from, range.to);
  }, [events, calendars, range]);

  /* Keyboard: the shortcuts Apple Calendar has. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const step = (n: number) => {
        const d = ui.focusedDate;
        dispatch({
          type: 'ui/focus',
          date:
            ui.view === 'year' ? addYears(d, n)
            : ui.view === 'month' ? addMonths(d, n)
            : ui.view === 'week' ? addDays(d, n * 7)
            : addDays(d, n),
        });
      };

      switch (e.key) {
        case 'ArrowLeft': step(-1); break;
        case 'ArrowRight': step(1); break;
        case 't': case 'T': dispatch({ type: 'ui/focus', date: today() }); break;
        case '1': dispatch({ type: 'ui/view', view: 'day' }); break;
        case '2': dispatch({ type: 'ui/view', view: 'week' }); break;
        case '3': dispatch({ type: 'ui/view', view: 'month' }); break;
        case '4': dispatch({ type: 'ui/view', view: 'year' }); break;
        case '5': dispatch({ type: 'ui/view', view: 'list' }); break;
        case 'n': case 'N':
          dispatch({ type: 'ui/editor', open: true, draft: { start: `${ui.focusedDate}T09:00:00`, end: `${ui.focusedDate}T10:00:00` } });
          break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, ui.focusedDate, ui.view]);

  const step = (n: number) => {
    const d = ui.focusedDate;
    dispatch({
      type: 'ui/focus',
      date:
        ui.view === 'year' ? addYears(d, n)
        : ui.view === 'month' ? addMonths(d, n)
        : ui.view === 'week' ? addDays(d, n * 7)
        : addDays(d, n),
    });
  };

  const focus = fromISODate(ui.focusedDate);
  const title =
    ui.view === 'year' ? `${focus.getFullYear()}`
    : ui.view === 'day' ? formatDateKo(ui.focusedDate, { weekday: true })
    : MONTHS_KO[focus.getMonth()];

  const viewProps = {
    occurrences,
    calendars,
    focusedDate: ui.focusedDate,
    weekStartsOn: ui.weekStartsOn,
    onFocus: (d: string) => dispatch({ type: 'ui/focus', date: d }),
    onOpenDay: (d: string) => {
      dispatch({ type: 'ui/focus', date: d });
      dispatch({ type: 'ui/view', view: 'day' });
    },
    onSelectEvent: setSelected,
    onCompose: (draft: Partial<EidosEvent>) => dispatch({ type: 'ui/editor', open: true, draft }),
  };

  const searching = ui.search.trim().length > 0;

  return (
    <div className="cal-screen">
      <GlassSurface elevation={1} radius={22} className="cal-toolbar">
        <h1 className="cal-title">
          {title}
          {ui.view !== 'year' ? <span className="year">{focus.getFullYear()}</span> : null}
        </h1>

        <div className="cal-search vibrancy" data-sunken="true">
          <Icon name="search" size={15} />
          <input
            type="search"
            placeholder="일정 검색"
            value={ui.search}
            onChange={(e) => dispatch({ type: 'ui/search', q: e.target.value })}
            aria-label="일정 검색"
          />
        </div>

        <div className="cal-nav">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="이전">
            <Icon name="chevronLeft" size={19} />
          </button>
          <button
            className="icon-btn"
            onClick={() => dispatch({ type: 'ui/focus', date: today() })}
            aria-label="오늘로 이동"
            title="오늘 (T)"
          >
            <Icon name="today" size={19} />
          </button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="다음">
            <Icon name="chevronRight" size={19} />
          </button>
          <button
            className="icon-btn"
            data-active={calListOpen}
            onClick={() => setCalListOpen(true)}
            aria-label="캘린더 목록"
          >
            <Icon name="list" size={19} />
          </button>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Segmented
            options={VIEWS}
            value={ui.view}
            onChange={(v) => dispatch({ type: 'ui/view', view: v })}
            ariaLabel="보기 방식"
          />
        </div>
      </GlassSurface>

      {searching ? (
        <ListView {...viewProps} query={ui.search} />
      ) : ui.view === 'month' ? (
        <MonthView {...viewProps} />
      ) : ui.view === 'week' ? (
        <WeekView {...viewProps} />
      ) : ui.view === 'day' ? (
        <DayView {...viewProps} />
      ) : ui.view === 'year' ? (
        <YearView {...viewProps} />
      ) : (
        <ListView {...viewProps} />
      )}

      {/* The single tinted control on this screen. */}
      <GlassSurface
        as="button"
        elevation={2}
        radius={27}
        tint="var(--a-blue)"
        pressable
        className="fab"
        aria-label="새로운 일정"
        onClick={() =>
          dispatch({
            type: 'ui/editor',
            open: true,
            draft: { start: `${ui.focusedDate}T09:00:00`, end: `${ui.focusedDate}T10:00:00` },
          })
        }
      >
        <Icon name="plus" size={25} strokeWidth={2.1} />
      </GlassSurface>

      <EventEditor />
      <EventDetail event={selected} onClose={() => setSelected(null)} />
      <CalendarList open={calListOpen} onClose={() => setCalListOpen(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function EventDetail({ event, onClose }: { event: EidosEvent | null; onClose: () => void }) {
  const { calendars } = useAppState();
  const dispatch = useDispatch();
  if (!event) return null;

  const cal = calendars.find((c) => c.id === event.calendarId);
  const readOnly = cal?.readOnly || event.origin === 'holiday';

  const rows: { icon: string; value: React.ReactNode }[] = [
    {
      icon: 'clock',
      value: event.allDay
        ? `${formatDateKo(event.start.slice(0, 10), { weekday: true })} · 종일`
        : `${formatDateKo(event.start.slice(0, 10), { weekday: true })}\n${formatTime(event.start)} – ${formatTime(event.end)}`,
    },
  ];
  if (event.location) rows.push({ icon: 'pin', value: event.location });
  if (event.recurrence && event.recurrence.freq !== 'none') {
    rows.push({ icon: 'repeat', value: describeRecurrence(event.recurrence) });
  }
  if (event.alarms.length) {
    rows.push({
      icon: 'bell',
      value: event.alarms
        .map((a) => (a === 0 ? '정시' : a < 60 ? `${a}분 전` : a < 1440 ? `${a / 60}시간 전` : `${a / 1440}일 전`))
        .join(', '),
    });
  }
  if (event.travelTimeMinutes) rows.push({ icon: 'send2', value: `이동 시간 ${event.travelTimeMinutes}분` });
  if (event.url) rows.push({ icon: 'link', value: <a href={event.url} target="_blank" rel="noreferrer">{event.url}</a> });
  if (event.notes) rows.push({ icon: 'book', value: event.notes });

  return (
    <Sheet
      open
      title={cal?.title ?? '일정'}
      onClose={onClose}
      leading={{ label: '닫기', onClick: onClose }}
      trailing={
        readOnly
          ? undefined
          : {
              label: '편집',
              strong: true,
              onClick: () => {
                dispatch({ type: 'ui/editor', open: true, draft: event });
                onClose();
              },
            }
      }
    >
      <div>
        <h3 style={{ fontSize: 'var(--t-title1)', fontWeight: 700, letterSpacing: 'var(--tr-tight)' }}>
          {event.title}
        </h3>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <Chip style={{ '--c': cal?.color } as React.CSSProperties}>
            <span
              style={{
                width: 8, height: 8, borderRadius: 4,
                background: cal?.color ?? 'var(--a-graphite)', display: 'inline-block',
              }}
            />
            {cal?.title}
          </Chip>
          {event.availability === 'free' ? <Chip tone="good">한가함</Chip> : null}
          {event.origin === 'edu-assessment' ? <Chip tone="warn">수행평가</Chip> : null}
          {event.origin === 'group' ? <Chip tone="info">그룹 공유</Chip> : null}
        </div>
      </div>

      <div className="detail-grid">
        {rows.map((r, i) => (
          <div className="detail-row" key={i}>
            <Icon name={r.icon} size={17} />
            <span className="v" style={{ whiteSpace: 'pre-line' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {!readOnly ? (
        <Button
          wide
          tone="danger"
          onClick={() => {
            if (event.seriesId && event.occurrenceDate) {
              dispatch({ type: 'event/removeOccurrence', seriesId: event.seriesId, date: event.occurrenceDate });
            } else {
              dispatch({ type: 'event/remove', id: event.id });
            }
            onClose();
          }}
        >
          {event.seriesId ? '이 일정만 삭제' : '삭제'}
        </Button>
      ) : null}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */

function CalendarList({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { calendars, ui } = useAppState();
  const dispatch = useDispatch();

  const groups = [
    { label: '내 캘린더', kinds: ['personal'] },
    { label: '공유', kinds: ['group', 'edu'] },
    { label: '기타', kinds: ['holiday', 'subscribed', 'birthday'] },
  ];

  return (
    <Sheet open={open} title="캘린더" onClose={onClose} leading={{ label: '완료', onClick: onClose }}>
      {groups.map((g) => {
        const items = calendars.filter((c) => g.kinds.includes(c.kind));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <div className="card-title" style={{ marginBottom: 6 }}>{g.label}</div>
            <div className="cal-list">
              {items.map((c) => (
                <button
                  key={c.id}
                  className="cal-list-row"
                  data-on={c.visible}
                  style={{ '--c': c.color } as React.CSSProperties}
                  onClick={() => dispatch({ type: 'cal/toggle', id: c.id })}
                >
                  <span className="cal-swatch" />
                  <span>{c.title}</span>
                  {c.visible ? (
                    <span style={{ marginLeft: 'auto', color: 'var(--a-blue)' }}>
                      <Icon name="check" size={17} />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>한 주의 시작</div>
        <Segmented
          options={[{ value: '0', label: '일요일' }, { value: '1', label: '월요일' }]}
          value={String(ui.weekStartsOn)}
          onChange={(v) => dispatch({ type: 'ui/weekStart', day: Number(v) as 0 | 1 })}
          ariaLabel="한 주의 시작"
        />
      </div>
    </Sheet>
  );
}
