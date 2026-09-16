import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Icon, Segmented, Sheet } from '../../components/index.tsx';
import { GlassSurface } from '../../glass/GlassSurface.tsx';
import { addDays, formatDateKo, formatTime, today } from '../../core/date.ts';
import { useAppState, useDispatch } from '../../core/store.tsx';
import { fetchMeals, allergyHits, allergenLabel, fetchTimetable } from '../../services/neis.ts';
import { fetchNews } from '../../services/news.ts';
import { aqiLabel, dressingAdvice, fetchWeather, weatherGlyph } from '../../services/weather.ts';
import type {
  JournalEntry, Meal, Mood, NewsItem, Timetable, WeatherNow,
} from '../../core/types.ts';
import {
  answerQuestion, dayNotes, greeting, journalStreak, loadHistory, morningHeadline,
  nightHeadline, phaseOf, reviewItems, shapeOfDay, tomorrowNote,
} from './compose.ts';
import './brief.css';

type Mode = 'morning' | 'night';

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: '힘듦' },
  { value: 2, emoji: '😕', label: '별로' },
  { value: 3, emoji: '😐', label: '보통' },
  { value: 4, emoji: '🙂', label: '좋음' },
  { value: 5, emoji: '😄', label: '최고' },
];

export function BriefScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { profile } = state;

  const hour = new Date().getHours();
  const [mode, setMode] = useState<Mode>(hour >= 17 || hour < 4 ? 'night' : 'morning');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [news, setNews] = useState<{ items: NewsItem[]; live: boolean }>({ items: [], live: false });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const date = today();
  const phase = mode === 'night' ? 'night' : phaseOf(hour);
  const shape = useMemo(() => shapeOfDay(state, date), [state, date]);
  const journal = state.journal.find((j) => j.date === date);

  /* Data. Each source degrades on its own; one failure never blanks the brief. */
  useEffect(() => {
    let alive = true;
    const loc = profile?.location ?? { lat: 37.5665, lon: 126.978, name: '서울' };
    fetchWeather({ lat: loc.lat, lon: loc.lon, date }).then((w) => alive && setWeather(w));
    fetchNews(profile?.briefs.newsTopics ?? ['종합'], 5).then((n) => alive && setNews(n));
    return () => { alive = false; };
  }, [profile?.location, profile?.briefs.newsTopics, date]);

  useEffect(() => {
    const edu = profile?.edu;
    if (!edu) return;
    let alive = true;
    const target = mode === 'night' ? addDays(date, 1) : date;
    fetchMeals(edu.school, target).then((m) => alive && setMeals(m));
    if (edu.class) {
      fetchTimetable(edu.school, edu.class.grade, edu.class.classNo, target)
        .then((t) => alive && setTimetable(t));
    }
    return () => { alive = false; };
  }, [profile?.edu, date, mode]);

  if (!profile) return null;

  const questions = mode === 'morning' ? profile.briefs.morningQuestions : profile.briefs.nightQuestions;
  const headline =
    mode === 'morning' ? morningHeadline(shape, weather) : nightHeadline(shape, journal);

  const upsertJournal = (patch: Partial<JournalEntry>) => {
    dispatch({
      type: 'journal/upsert',
      entry: {
        date,
        completed: journal?.completed ?? [],
        missed: journal?.missed ?? [],
        createdAt: journal?.createdAt ?? new Date().toISOString(),
        ...journal,
        ...patch,
      },
    });
  };

  return (
    <div className="brief-screen">
      <div className="sky" data-phase={phase} aria-hidden />

      <div className="brief-scroll">
        {/* The one 'clear' glass surface in the app. */}
        <GlassSurface elevation={2} variant="clear" radius={28} className="brief-hero" present>
          <div className="spread">
            <span className="eyebrow">{formatDateKo(date, { weekday: true })}</span>
            <button
              className="icon-btn"
              style={{ color: '#fff' }}
              onClick={() => setSettingsOpen(true)}
              aria-label="브리프 설정"
            >
              <Icon name="settings" size={17} />
            </button>
          </div>

          {/* The switch is chrome, so it lives on the glass. Below the hero it
              would sit over the sky gradient, where a content-layer control
              cannot hold contrast. */}
          <Segmented
            options={[{ value: 'morning', label: '모닝 브리프' }, { value: 'night', label: '나이트 브리프' }]}
            value={mode}
            onChange={setMode}
            ariaLabel="브리프 종류"
          />

          <h1>{greeting(phase, profile.displayName)}</h1>
          <p className="sub">{headline}</p>

          {weather ? (
            <>
              <div className="temp">
                <span className="glyph">{weatherGlyph(weather.code)}</span>
                <b>{weather.tempC}°</b>
                <span className="hl">
                  최고 {weather.highC}° · 최저 {weather.lowC}° · {weather.summary}
                </span>
              </div>
              <div className="hero-chips">
                {dressingAdvice(weather).map((a) => <Chip key={a}>{a}</Chip>)}
                {weather.airQuality ? (
                  <Chip>대기질 {aqiLabel(weather.airQuality.index)}</Chip>
                ) : null}
                <Chip>일출 {weather.sunrise} · 일몰 {weather.sunset}</Chip>
              </div>
            </>
          ) : (
            <p className="sub">날씨를 불러오는 중…</p>
          )}
        </GlassSurface>

        {mode === 'morning'
          ? <MorningBody
              shape={shape}
              weather={weather}
              news={news}
              meals={meals}
              timetable={timetable}
              questions={questions}
            />
          : <NightBody
              shape={shape}
              news={news}
              meals={meals}
              timetable={timetable}
              questions={questions}
              journal={journal}
              onJournal={upsertJournal}
            />}
      </div>

      <BriefSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* ================================================================ *
 * Morning
 * ================================================================ */

function MorningBody({
  shape, weather, news, meals, timetable, questions,
}: {
  shape: ReturnType<typeof shapeOfDay>;
  weather: WeatherNow | null;
  news: { items: NewsItem[]; live: boolean };
  meals: Meal[];
  timetable: Timetable | null;
  questions: string[];
}) {
  const state = useAppState();
  const notes = dayNotes(shape);
  const nowHour = new Date().getHours();

  return (
    <>
      {weather?.hourly.length ? (
        <Card title="시간대별" icon="cloud">
          <div className="hourly">
            {weather.hourly
              .filter((h) => h.hour >= Math.max(0, nowHour - 1))
              .slice(0, 14)
              .map((h) => (
                <div className="hour" key={h.hour} data-now={h.hour === nowHour}>
                  <span className="h">{h.hour === nowHour ? '지금' : `${h.hour}시`}</span>
                  <span className="g">{weatherGlyph(h.code)}</span>
                  <span className="t">{h.tempC}°</span>
                  <span className="p">{h.precip >= 20 ? `${h.precip}%` : ''}</span>
                </div>
              ))}
          </div>
        </Card>
      ) : null}

      <Card title="오늘의 흐름" icon="clock">
        <ScheduleRail shape={shape} />
        {notes.length ? (
          <div className="row-wrap" style={{ marginTop: 'var(--s-3)' }}>
            {notes.map((n) => <Chip key={n} tone="info">{n}</Chip>)}
          </div>
        ) : null}
      </Card>

      {timetable?.periods.length ? <TimetableCard timetable={timetable} /> : null}
      {meals.length ? <MealCard meals={meals} /> : null}

      <QuestionCard questions={questions} state={state} />

      <NewsCard news={news} />
    </>
  );
}

function ScheduleRail({ shape }: { shape: ReturnType<typeof shapeOfDay> }) {
  const { calendars } = useAppState();
  if (!shape.all.length) {
    return <p className="muted small">등록된 일정이 없어요. 오늘은 원하는 대로 쓸 수 있는 하루예요.</p>;
  }

  return (
    <div className="rail">
      {shape.all.map((e) => {
        const color = calendars.find((c) => c.id === e.calendarId)?.color ?? 'var(--a-graphite)';
        return (
          <div className="rail-row" key={e.id}>
            <span className="rail-time">{e.allDay ? '종일' : formatTime(e.start)}</span>
            <span className="rail-mark">
              <span className="rail-dot" style={{ '--c': color } as React.CSSProperties} />
            </span>
            <span className="rail-body">
              <strong>{e.title}</strong>
              <span className="m">
                {[
                  e.location,
                  e.travelTimeMinutes ? `이동 ${e.travelTimeMinutes}분` : null,
                  !e.allDay ? `– ${formatTime(e.end)}` : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================ *
 * Night
 * ================================================================ */

function NightBody({
  shape, news, meals, timetable, questions, journal, onJournal,
}: {
  shape: ReturnType<typeof shapeOfDay>;
  news: { items: NewsItem[]; live: boolean };
  meals: Meal[];
  timetable: Timetable | null;
  questions: string[];
  journal?: JournalEntry;
  onJournal: (p: Partial<JournalEntry>) => void;
}) {
  const state = useAppState();
  const items = reviewItems(state, today());
  const done = journal?.completed ?? [];
  const history = loadHistory(state);
  const streak = journalStreak(state);

  const toggle = (id: string) =>
    onJournal({
      completed: done.includes(id) ? done.filter((x) => x !== id) : [...done, id],
    });

  const comment = useMemo(() => {
    const ratio = items.length ? done.length / items.length : 1;
    const mood = journal?.mood;
    const lines: string[] = [];

    if (!items.length) lines.push('오늘은 잡아 둔 일정이 없던 날이었어요.');
    else if (ratio === 1) lines.push('계획한 걸 전부 해냈어요. 흔치 않은 하루예요.');
    else if (ratio >= 0.7) lines.push('대부분 해냈어요. 남은 건 내일로 넘겨도 괜찮아요.');
    else if (ratio >= 0.3) lines.push('절반쯤 왔어요. 남은 일이 왜 밀렸는지만 한 줄 적어 두면 내일이 쉬워져요.');
    else lines.push('오늘은 계획대로 되지 않았네요. 그런 날도 필요해요.');

    if (mood != null && mood <= 2 && ratio >= 0.7) {
      lines.push('할 일은 해냈는데 기분이 따라오지 않았어요. 일의 양보다 다른 이유일 수 있어요.');
    } else if (mood != null && mood >= 4 && ratio < 0.5) {
      lines.push('많이 못 했는데도 기분이 좋았다면, 오늘 진짜 중요했던 건 계획에 없던 쪽이었을 거예요.');
    }

    if (shape.busyMinutes >= 420) lines.push('일정으로만 7시간 넘게 찼어요. 내일은 한 칸 비워 두는 걸 권해요.');

    return lines.join(' ');
  }, [items.length, done.length, journal?.mood, shape.busyMinutes]);

  return (
    <>
      <Card title="오늘 기분" icon="heart">
        <div className="mood-row">
          {MOODS.map((m) => (
            <button
              key={m.value}
              className="mood"
              data-on={journal?.mood === m.value}
              onClick={() => onJournal({ mood: m.value })}
              aria-pressed={journal?.mood === m.value}
            >
              <span className="e">{m.emoji}</span>
              <span className="l">{m.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="오늘 점검" icon="check">
        {items.length ? (
          <div>
            {items.map((it) => (
              <button
                key={it.id}
                className="review-row"
                data-done={done.includes(it.id) || it.done}
                onClick={() => toggle(it.id)}
              >
                <span className="tickbox"><Icon name="check" size={13} strokeWidth={2.6} /></span>
                <span className="t">{it.title}</span>
              </button>
            ))}
            <p className="small dim" style={{ marginTop: 'var(--s-3)' }}>
              {done.length}/{items.length} 완료
            </p>
          </div>
        ) : (
          <p className="muted small">점검할 일정이 없던 하루였어요.</p>
        )}
      </Card>

      <Card title="Cycle의 코멘트" icon="sparkle">
        <p style={{ fontSize: 'var(--t-subhead)', lineHeight: 1.6 }}>{comment}</p>
      </Card>

      <Card title="오늘의 일기" icon="pencil">
        <textarea
          className="qa-a"
          style={{
            width: '100%', minHeight: 90, border: 0, background: 'var(--vib-sunken)',
            borderRadius: 'var(--r-3)', padding: 'var(--s-3)', outline: 'none', resize: 'vertical',
            fontFamily: 'inherit',
          }}
          placeholder="오늘 어땠나요? 한 줄이어도 좋아요."
          value={journal?.note ?? ''}
          onChange={(e) => onJournal({ note: e.target.value })}
          aria-label="오늘의 일기"
        />
        <div className="spread" style={{ marginTop: 'var(--s-2)' }}>
          <span className="tiny dim">
            {streak > 0 ? `${streak}일 연속 기록 중` : '오늘부터 기록해 보세요'}
          </span>
          <span className="tiny dim">{(journal?.note ?? '').length}자</span>
        </div>
      </Card>

      <Card title="최근 2주" icon="grid">
        <div className="streak">
          {history.map((h) => (
            <i key={h.date} data-v="" style={{ '--v': h.value } as React.CSSProperties} title={`${h.date} · ${h.value}%`} />
          ))}
        </div>
        <p className="tiny dim" style={{ marginTop: 'var(--s-2)' }}>막대 높이는 그날 일정이 차지한 비중이에요</p>
      </Card>

      <Card title="내일" icon="sunrise">
        <p style={{ fontSize: 'var(--t-subhead)', lineHeight: 1.6 }}>{tomorrowNote(state)}</p>
        {timetable?.periods.length ? (
          <div className="row-wrap" style={{ marginTop: 'var(--s-3)' }}>
            {timetable.periods.map((p) => <Chip key={p.period}>{p.period}. {p.subject}</Chip>)}
          </div>
        ) : null}
        {meals.length ? (
          <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>
            내일 급식 — {meals[0].dishes.slice(0, 4).map((d) => d.name).join(', ')}
          </p>
        ) : null}
      </Card>

      <QuestionCard questions={questions} state={state} />
      <NewsCard news={news} />
    </>
  );
}

/* ================================================================ *
 * Shared cards
 * ================================================================ */

function QuestionCard({ questions, state }: { questions: string[]; state: ReturnType<typeof useAppState> }) {
  const dispatch = useDispatch();

  if (!questions.length) {
    return (
      <Card title="내가 물어본 것" icon="sparkle">
        <button className="qa-empty" onClick={() => dispatch({ type: 'ui/tab', tab: 'cycle' })}>
          매일 아침·저녁에 Cycle이 답해 줄 질문을 등록해 보세요.
          <br />
          “오늘 제일 중요한 일은?”, “이번 주에 여유 시간 있어?”
        </button>
      </Card>
    );
  }

  return (
    <Card title="내가 물어본 것" icon="sparkle">
      <div className="qa">
        {questions.map((q) => (
          <div className="qa-item" key={q}>
            <div className="qa-q"><Icon name="sparkle" size={13} />{q}</div>
            <div className="qa-a">{answerQuestion(state, q)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NewsCard({ news }: { news: { items: NewsItem[]; live: boolean } }) {
  if (!news.live) {
    return (
      <Card title="뉴스" icon="newspaper">
        <p className="muted small">
          뉴스 제공자가 연결되어 있지 않아요. <code>VITE_NEWS_API_BASE</code>를 설정하면
          이 자리에 오늘의 헤드라인이 표시됩니다.
        </p>
        <p className="tiny dim" style={{ marginTop: 'var(--s-2)' }}>
          연결 전에는 헤드라인을 지어내지 않고 비워 둡니다.
        </p>
      </Card>
    );
  }

  return (
    <Card title="뉴스" icon="newspaper">
      {news.items.map((n) => (
        <a
          className="news-item"
          key={n.id}
          href={n.url ?? '#'}
          target={n.url ? '_blank' : undefined}
          rel="noreferrer"
          style={{ color: 'inherit' }}
        >
          <strong>{n.title}</strong>
          <span className="src">{n.source} · {n.category}</span>
        </a>
      ))}
    </Card>
  );
}

function TimetableCard({ timetable }: { timetable: Timetable }) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <Card title="오늘 시간표" icon="book">
      <div className="rail">
        {timetable.periods.map((p) => {
          const current = hhmm >= p.start && hhmm <= p.end;
          return (
            <div className="rail-row" key={p.period}>
              <span className="rail-time">{p.start}</span>
              <span className="rail-mark">
                <span
                  className="rail-dot"
                  style={{ '--c': current ? 'var(--a-blue)' : 'var(--label-4)' } as React.CSSProperties}
                />
              </span>
              <span className="rail-body">
                <strong>{p.period}교시 · {p.subject}</strong>
                <span className="m">{[p.room, current ? '지금 진행 중' : null].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MealCard({ meals }: { meals: Meal[] }) {
  const { profile } = useAppState();
  const codes = profile?.edu?.allergyCodes ?? [];

  return (
    <Card title="급식" icon="bowl">
      <div className="stack">
        {meals.map((meal) => {
          const hits = allergyHits(meal, codes);
          const hitNames = new Set(hits.map((h) => h.dish));
          return (
            <div key={meal.type}>
              <div className="spread" style={{ marginBottom: 'var(--s-2)' }}>
                <strong className="small">{meal.type}</strong>
                {meal.calories ? <span className="tiny dim">{meal.calories} kcal</span> : null}
              </div>
              <div className="row-wrap">
                {meal.dishes.map((d) => (
                  <Chip
                    key={d.name}
                    tone={hitNames.has(d.name) ? 'danger' : undefined}
                    title={d.allergens.map(allergenLabel).join(', ')}
                  >
                    {hitNames.has(d.name) ? <Icon name="warning" size={12} /> : null}
                    {d.name}
                  </Chip>
                ))}
              </div>
              {hits.length ? (
                <p className="small" style={{ color: 'var(--a-red)', marginTop: 'var(--s-2)' }}>
                  알레르기 주의 — {hits.map((h) => `${h.dish}(${h.hits.map(allergenLabel).join('·')})`).join(', ')}
                </p>
              ) : codes.length ? (
                <p className="small" style={{ color: 'var(--a-green)', marginTop: 'var(--s-2)' }}>
                  등록한 알레르기 성분은 없어요
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ================================================================ *
 * Settings
 * ================================================================ */

function BriefSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAppState();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState('');
  const [target, setTarget] = useState<'morning' | 'night'>('morning');

  if (!profile) return null;
  const briefs = profile.briefs;

  const add = () => {
    const q = draft.trim();
    if (!q) return;
    const key = target === 'morning' ? 'morningQuestions' : 'nightQuestions';
    dispatch({
      type: 'profile/patch',
      patch: { briefs: { ...briefs, [key]: [...briefs[key], q] } },
    });
    setDraft('');
  };

  const removeQ = (kind: 'morning' | 'night', q: string) => {
    const key = kind === 'morning' ? 'morningQuestions' : 'nightQuestions';
    dispatch({
      type: 'profile/patch',
      patch: { briefs: { ...briefs, [key]: briefs[key].filter((x) => x !== q) } },
    });
  };

  return (
    <Sheet open={open} title="브리프 설정" onClose={onClose} leading={{ label: '완료', onClick: onClose }}>
      <div className="field-group">
        <label className="field">
          <span className="field-label">모닝 브리프</span>
          <input
            type="time"
            value={briefs.morningAt}
            onChange={(e) => dispatch({ type: 'profile/patch', patch: { briefs: { ...briefs, morningAt: e.target.value } } })}
            style={{ marginLeft: 'auto', textAlign: 'right' }}
          />
        </label>
        <label className="field">
          <span className="field-label">나이트 브리프</span>
          <input
            type="time"
            value={briefs.nightAt}
            onChange={(e) => dispatch({ type: 'profile/patch', patch: { briefs: { ...briefs, nightAt: e.target.value } } })}
            style={{ marginLeft: 'auto', textAlign: 'right' }}
          />
        </label>
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>브리프에서 매일 답할 질문</div>
        <Segmented
          options={[{ value: 'morning', label: '아침' }, { value: 'night', label: '저녁' }]}
          value={target}
          onChange={setTarget}
          ariaLabel="질문 대상"
        />
        <div className="row" style={{ marginTop: 'var(--s-3)' }}>
          <div className="field-group" style={{ flex: 1 }}>
            <label className="field">
              <input
                type="text"
                value={draft}
                placeholder="예: 오늘 제일 중요한 일은?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                aria-label="질문 입력"
              />
            </label>
          </div>
          <Button primary onClick={add} disabled={!draft.trim()}>추가</Button>
        </div>

        <div className="row-wrap" style={{ marginTop: 'var(--s-3)' }}>
          {(target === 'morning' ? briefs.morningQuestions : briefs.nightQuestions).map((q) => (
            <Chip key={q} onClick={() => removeQ(target, q)}>
              {q} <Icon name="close" size={11} />
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>뉴스 주제</div>
        <div className="row-wrap">
          {['종합', '경제', 'IT·과학', '세계', '문화', '스포츠', '건강', '교육'].map((t) => {
            const on = briefs.newsTopics.includes(t);
            return (
              <Chip
                key={t}
                selected={on}
                onClick={() =>
                  dispatch({
                    type: 'profile/patch',
                    patch: {
                      briefs: {
                        ...briefs,
                        newsTopics: on
                          ? briefs.newsTopics.filter((x) => x !== t)
                          : [...briefs.newsTopics, t],
                      },
                    },
                  })
                }
              >
                {t}
              </Chip>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
