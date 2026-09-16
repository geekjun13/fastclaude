import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Field, FieldGroup, Icon, Segmented, Sheet, Switch } from '../../components/index.tsx';
import { addDays, formatDateKo, formatTime, minutesBetween, setTimeOn } from '../../core/date.ts';
import { describeRecurrence } from '../../core/recurrence.ts';
import { newEvent, useDispatch, useAppState } from '../../core/store.tsx';
import type { AlarmOffset, EidosEvent, Recurrence, RecurrenceFreq } from '../../core/types.ts';

const ALARM_OPTIONS: { value: AlarmOffset; label: string }[] = [
  { value: 0, label: '정시' },
  { value: 5, label: '5분 전' },
  { value: 10, label: '10분 전' },
  { value: 15, label: '15분 전' },
  { value: 30, label: '30분 전' },
  { value: 60, label: '1시간 전' },
  { value: 120, label: '2시간 전' },
  { value: 1440, label: '1일 전' },
  { value: 2880, label: '2일 전' },
  { value: 10080, label: '1주 전' },
];

const FREQ_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: 'none', label: '안 함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'biweekly', label: '2주' },
  { value: 'monthly', label: '매월' },
  { value: 'yearly', label: '매년' },
];

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export function EventEditor() {
  const { calendars, ui } = useAppState();
  const dispatch = useDispatch();
  const open = ui.editorOpen;
  const draft = ui.editorDraft;

  const existing = Boolean(draft?.id);
  const [form, setForm] = useState<Partial<EidosEvent>>({});

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    const base = newEvent({
      start: `${now.toISOString().slice(0, 10)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`,
    });
    const end = new Date(now.getTime() + 3600_000);
    base.end = `${end.toISOString().slice(0, 10)}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`;
    setForm({ ...base, ...draft });
  }, [open, draft]);

  const invalid = useMemo(() => {
    if (!form.title?.trim()) return '제목을 입력해 주세요';
    if ((form.end ?? '') < (form.start ?? '')) return '종료가 시작보다 빠를 수 없어요';
    return null;
  }, [form]);

  // The sheet's children are evaluated even while it is closed, and `form` is
  // only populated by the effect above once `open` flips. Bail out until then,
  // or the date formatters below run against an empty draft. Every hook is
  // above this line, so the early return is unconditional from React's side.
  if (!open || !form.start || !form.end) return null;

  const startDate = form.start.slice(0, 10);
  const endDate = form.end.slice(0, 10);
  const startTime = form.start.slice(11, 16) || '09:00';
  const endTime = form.end.slice(11, 16) || '10:00';

  const patch = (p: Partial<EidosEvent>) => setForm((f) => ({ ...f, ...p }));

  /** Moving the start drags the end with it, keeping the duration — Apple's behaviour. */
  const moveStart = (date: string, time: string) => {
    const nextStart = form.allDay ? date : `${date}T${time}:00`;
    const keep = form.allDay ? 0 : minutesBetween(form.start!, form.end!);
    if (form.allDay) {
      const span = Math.max(0, (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000);
      patch({ start: nextStart, end: addDays(date, span) });
    } else {
      const d = new Date(`${date}T${time}:00`);
      const e = new Date(d.getTime() + keep * 60_000);
      patch({
        start: nextStart,
        end: `${e.toISOString().slice(0, 10)}T${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}:00`,
      });
    }
  };

  const toggleAllDay = (on: boolean) => {
    if (on) patch({ allDay: true, start: startDate, end: endDate });
    else patch({ allDay: false, start: setTimeOn(startDate, '09:00'), end: setTimeOn(startDate, '10:00') });
  };

  const rec: Recurrence = form.recurrence ?? { freq: 'none', interval: 1 };

  const close = () => dispatch({ type: 'ui/editor', open: false });

  const save = () => {
    if (invalid) return;
    const complete = { ...form, updatedAt: new Date().toISOString() } as EidosEvent;
    if (existing) dispatch({ type: 'event/patch', id: complete.id, patch: complete });
    else dispatch({ type: 'event/add', event: complete });
    close();
  };

  const remove = () => {
    if (!form.id) return;
    // A single occurrence of a series becomes an exception; the series survives.
    if (form.seriesId && form.occurrenceDate) {
      dispatch({ type: 'event/removeOccurrence', seriesId: form.seriesId, date: form.occurrenceDate });
    } else {
      dispatch({ type: 'event/remove', id: form.id });
    }
    close();
  };

  return (
    <Sheet
      open={open}
      title={existing ? '일정 편집' : '새로운 일정'}
      onClose={close}
      trailing={{ label: existing ? '완료' : '추가', onClick: save, disabled: Boolean(invalid), strong: true }}
    >
      <FieldGroup>
        <Field className="field-title">
          <input
            type="text"
            value={form.title ?? ''}
            placeholder="제목"
            onChange={(e) => patch({ title: e.target.value })}
            aria-label="제목"
          />
        </Field>
        <Field>
          <Icon name="pin" size={17} />
          <input
            type="text"
            value={form.location ?? ''}
            placeholder="위치 또는 화상 통화"
            onChange={(e) => patch({ location: e.target.value })}
            aria-label="위치"
          />
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field>
          <span className="field-label">종일</span>
          <Switch on={Boolean(form.allDay)} onChange={toggleAllDay} label="종일" />
        </Field>
        <Field>
          <span className="field-label">시작</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => moveStart(e.target.value, startTime)}
              aria-label="시작 날짜"
            />
            {!form.allDay ? (
              <input
                type="time"
                value={startTime}
                step={300}
                onChange={(e) => moveStart(startDate, e.target.value)}
                aria-label="시작 시각"
              />
            ) : null}
          </span>
        </Field>
        <Field>
          <span className="field-label">종료</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) =>
                patch({ end: form.allDay ? e.target.value : `${e.target.value}T${endTime}:00` })
              }
              aria-label="종료 날짜"
            />
            {!form.allDay ? (
              <input
                type="time"
                value={endTime}
                step={300}
                onChange={(e) => patch({ end: `${endDate}T${e.target.value}:00` })}
                aria-label="종료 시각"
              />
            ) : null}
          </span>
        </Field>
        {!form.allDay ? (
          <Field>
            <span className="field-label">이동 시간</span>
            <select
              value={form.travelTimeMinutes ?? 0}
              onChange={(e) => patch({ travelTimeMinutes: Number(e.target.value) || undefined })}
              style={{ marginLeft: 'auto', textAlign: 'right' }}
              aria-label="이동 시간"
            >
              <option value={0}>없음</option>
              <option value={5}>5분</option>
              <option value={15}>15분</option>
              <option value={30}>30분</option>
              <option value={60}>1시간</option>
              <option value={90}>1시간 30분</option>
            </select>
          </Field>
        ) : null}
      </FieldGroup>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>반복</div>
        <Segmented
          options={FREQ_OPTIONS}
          value={rec.freq}
          onChange={(freq) =>
            patch({
              recurrence:
                freq === 'none'
                  ? undefined
                  : { ...rec, freq, interval: freq === 'biweekly' ? 2 : 1 },
            })
          }
          ariaLabel="반복 주기"
        />
        {rec.freq === 'weekly' || rec.freq === 'biweekly' ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {WD.map((label, i) => {
              const on = rec.byWeekday?.includes(i) ?? false;
              return (
                <Chip
                  key={i}
                  selected={on}
                  onClick={() => {
                    const next = on
                      ? (rec.byWeekday ?? []).filter((d) => d !== i)
                      : [...(rec.byWeekday ?? []), i].sort();
                    patch({ recurrence: { ...rec, byWeekday: next.length ? next : undefined } });
                  }}
                >
                  {label}
                </Chip>
              );
            })}
          </div>
        ) : null}
        {rec.freq !== 'none' ? (
          <p className="small dim" style={{ marginTop: 8 }}>{describeRecurrence(rec)}</p>
        ) : null}
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>알림</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALARM_OPTIONS.map((a) => {
            const on = form.alarms?.includes(a.value) ?? false;
            return (
              <Chip
                key={a.value}
                selected={on}
                onClick={() =>
                  patch({
                    alarms: on
                      ? (form.alarms ?? []).filter((x) => x !== a.value)
                      : [...(form.alarms ?? []), a.value].sort((x, y) => x - y),
                  })
                }
              >
                {a.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <FieldGroup>
        <Field>
          <span className="field-label">캘린더</span>
          <select
            value={form.calendarId}
            onChange={(e) => patch({ calendarId: e.target.value })}
            style={{ marginLeft: 'auto', textAlign: 'right' }}
            aria-label="캘린더"
          >
            {calendars.filter((c) => !c.readOnly).map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </Field>
        <Field>
          <span className="field-label">표시</span>
          <select
            value={form.availability}
            onChange={(e) => patch({ availability: e.target.value as 'busy' | 'free' })}
            style={{ marginLeft: 'auto', textAlign: 'right' }}
            aria-label="참석 여부 표시"
          >
            <option value="busy">바쁨</option>
            <option value="free">한가함</option>
          </select>
        </Field>
        <Field>
          <span className="field-label">URL</span>
          <input
            type="text"
            value={form.url ?? ''}
            placeholder="https://"
            onChange={(e) => patch({ url: e.target.value })}
            aria-label="URL"
          />
        </Field>
        <Field>
          <textarea
            value={form.notes ?? ''}
            placeholder="메모"
            onChange={(e) => patch({ notes: e.target.value })}
            aria-label="메모"
          />
        </Field>
      </FieldGroup>

      {invalid ? <p className="small" style={{ color: 'var(--a-red)' }}>{invalid}</p> : null}

      <p className="small dim">
        {form.allDay
          ? `${formatDateKo(startDate, { weekday: true })}${endDate !== startDate ? ` – ${formatDateKo(endDate)}` : ''} · 종일`
          : `${formatDateKo(startDate, { weekday: true })} · ${formatTime(form.start!)} – ${formatTime(form.end!)}`}
      </p>

      {existing ? (
        <Button wide tone="danger" onClick={remove}>
          {form.seriesId ? '이 일정만 삭제' : '일정 삭제'}
        </Button>
      ) : null}
    </Sheet>
  );
}
