import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Field, FieldGroup, Icon, Segmented, Sheet } from '../../components/index.tsx';
import { GlassSurface } from '../../glass/GlassSurface.tsx';
import {
  addDays, formatDateKo, formatRelativeDay, fromISODate, today, toISODate, WEEKDAYS_KO,
} from '../../core/date.ts';
import { uid } from '../../core/storage.ts';
import { useAppState, useDispatch } from '../../core/store.tsx';
import type {
  EidosEvent, ISODate, Meal, SharedItem, SharedKind, Timetable,
} from '../../core/types.ts';
import { allergenLabel, allergyHits, ALLERGENS, fetchMeals, fetchWeekTimetable } from '../../services/neis.ts';
import { moderate, verdictLabel } from '../../services/moderation.ts';
import { askRaw, hasRemoteEngine } from '../../services/cycle.ts';
import './edu.css';

type EduTab = 'today' | 'meal' | 'timetable' | 'board';

const KIND_LABELS: Record<SharedKind, string> = {
  assessment: '수행평가',
  exam: '시험',
  homework: '과제',
  notice: '공지',
  event: '행사',
  trip: '체험학습',
};

export function EduScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { profile } = state;
  const [tab, setTab] = useState<EduTab>('today');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [week, setWeek] = useState<Timetable[]>([]);
  const [date, setDate] = useState<ISODate>(today());
  const [composeOpen, setComposeOpen] = useState(false);

  const edu = profile?.edu;

  useEffect(() => {
    if (!edu) return;
    let alive = true;
    fetchMeals(edu.school, date).then((m) => alive && setMeals(m));
    return () => { alive = false; };
  }, [edu, date]);

  useEffect(() => {
    if (!edu?.class) return;
    let alive = true;
    fetchWeekTimetable(edu.school, edu.class.grade, edu.class.classNo, date)
      .then((w) => alive && setWeek(w));
    return () => { alive = false; };
  }, [edu, date]);

  if (!profile || !edu) return null;

  const classId = edu.class
    ? `${edu.school.schoolCode}-${edu.class.grade}-${edu.class.classNo}`
    : edu.school.schoolCode;

  const posts = state.shared
    .filter((s) => s.targetId === classId && s.moderation.verdict !== 'blocked')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const upcoming = posts.filter((p) => p.date >= today());

  const roleLabel = edu.role === 'teacher' ? '선생님' : edu.role === 'parent' ? '학부모' : '학생';

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="edu-band">
        <GlassSurface elevation={1} radius={24} className="edu-hero">
          <span className="card-title">에듀 플랜</span>
          <h1>{edu.school.name}</h1>
          <p className="meta">
            {[
              roleLabel,
              edu.class ? `${edu.class.grade}학년 ${edu.class.classNo}반` : null,
              edu.class?.studentNo ? `${edu.class.studentNo}번` : null,
              edu.childName ? `자녀 ${edu.childName}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
          <div className="row-wrap" style={{ marginTop: 'var(--s-2)' }}>
            {edu.allergyCodes.length ? (
              <Chip tone="warn">
                <Icon name="warning" size={12} />
                알레르기 {edu.allergyCodes.length}종 등록
              </Chip>
            ) : (
              <Chip>알레르기 미등록</Chip>
            )}
            <Chip tone="info">공유 항목 {upcoming.length}건</Chip>
          </div>
        </GlassSurface>
        </div>

        <Segmented
          options={[
            { value: 'today', label: '오늘' },
            { value: 'meal', label: '급식' },
            { value: 'timetable', label: '시간표' },
            { value: 'board', label: '학급' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="에듀 화면"
        />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="이전 날">
            <Icon name="chevronLeft" size={18} />
          </button>
          <strong className="small">
            {formatDateKo(date, { weekday: true })} · {formatRelativeDay(date)}
          </strong>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="다음 날">
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        {tab === 'today' ? (
          <TodayPanel
            meals={meals}
            week={week}
            date={date}
            posts={upcoming.slice(0, 5)}
            allergyCodes={edu.allergyCodes}
          />
        ) : tab === 'meal' ? (
          <MealPanel meals={meals} allergyCodes={edu.allergyCodes} />
        ) : tab === 'timetable' ? (
          <TimetablePanel week={week} date={date} />
        ) : (
          <BoardPanel posts={posts} onCompose={() => setComposeOpen(true)} />
        )}
      </div>

      {tab === 'board' ? (
        <GlassSurface
          as="button"
          elevation={2}
          radius={27}
          tint="var(--a-blue)"
          pressable
          className="fab"
          aria-label="학급에 공유"
          onClick={() => setComposeOpen(true)}
        >
          <Icon name="plus" size={25} strokeWidth={2.1} />
        </GlassSurface>
      ) : null}

      <ComposeShared
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        targetId={classId}
        onPosted={() => dispatch({ type: 'ui/tab', tab: 'edu' })}
      />
    </div>
  );
}

/* ================================================================ */

function TodayPanel({
  meals, week, date, posts, allergyCodes,
}: {
  meals: Meal[];
  week: Timetable[];
  date: ISODate;
  posts: SharedItem[];
  allergyCodes: number[];
}) {
  const todayTable = week.find((t) => t.date === date);
  const lunch = meals.find((m) => m.type === '중식') ?? meals[0];
  const hits = lunch ? allergyHits(lunch, allergyCodes) : [];

  return (
    <>
      {todayTable?.periods.length ? (
        <Card title="오늘 시간표" icon="book">
          <div className="row-wrap">
            {todayTable.periods.map((p) => (
              <Chip key={p.period}>{p.period}교시 {p.subject}</Chip>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="오늘 시간표" icon="book">
          <p className="muted small">수업이 없는 날이에요.</p>
        </Card>
      )}

      {lunch ? (
        <Card title={`급식 · ${lunch.type}`} icon="bowl">
          <div className="row-wrap">
            {lunch.dishes.map((d) => {
              const hit = hits.some((h) => h.dish === d.name);
              return (
                <Chip key={d.name} tone={hit ? 'danger' : undefined}>
                  {hit ? <Icon name="warning" size={12} /> : null}
                  {d.name}
                </Chip>
              );
            })}
          </div>
          {hits.length ? (
            <div className="mod-banner" data-v="blocked" style={{ marginTop: 'var(--s-3)' }}>
              <Icon name="warning" size={16} />
              <span>
                <strong>알레르기 주의</strong><br />
                {hits.map((h) => `${h.dish} — ${h.hits.map(allergenLabel).join(', ')}`).join(' / ')}
              </span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card title="다가오는 학급 일정" icon="flag">
        {posts.length ? (
          posts.map((p) => <PostRow key={p.id} post={p} compact />)
        ) : (
          <p className="muted small">등록된 수행평가나 공지가 없어요.</p>
        )}
      </Card>
    </>
  );
}

/* ================================================================ */

function MealPanel({ meals, allergyCodes }: { meals: Meal[]; allergyCodes: number[] }) {
  const { profile } = useAppState();
  const [allergyOpen, setAllergyOpen] = useState(false);

  if (!meals.length) {
    return (
      <>
        <Card title="급식" icon="bowl">
          <p className="muted small">이 날은 급식이 없어요. (주말이거나 급식 미제공일)</p>
        </Card>
        <Button wide onClick={() => setAllergyOpen(true)}>알레르기 설정</Button>
        <AllergySheet open={allergyOpen} onClose={() => setAllergyOpen(false)} />
      </>
    );
  }

  return (
    <>
      {meals.map((meal) => {
        const hits = allergyHits(meal, allergyCodes);
        const hitNames = new Set(hits.map((h) => h.dish));
        return (
          <Card
            key={meal.type}
            title={meal.type}
            icon="bowl"
            action={meal.calories ? <span className="tiny dim">{meal.calories} kcal</span> : null}
          >
            <div className="meal-dishes">
              {meal.dishes.map((d) => (
                <div className="meal-dish" key={d.name} data-hit={hitNames.has(d.name)}>
                  {hitNames.has(d.name) ? <Icon name="warning" size={15} /> : null}
                  <span>{d.name}</span>
                  <span className="a">
                    {d.allergens.length ? d.allergens.map(allergenLabel).join('·') : ''}
                  </span>
                </div>
              ))}
            </div>

            {hits.length ? (
              <div className="mod-banner" data-v="blocked" style={{ marginTop: 'var(--s-3)' }}>
                <Icon name="warning" size={16} />
                <span>
                  <strong>등록한 알레르기 성분이 포함되어 있어요</strong><br />
                  {hits.map((h) => `${h.dish} — ${h.hits.map(allergenLabel).join(', ')}`).join(' / ')}
                </span>
              </div>
            ) : allergyCodes.length ? (
              <div className="mod-banner" data-v="approved" style={{ marginTop: 'var(--s-3)' }}>
                <Icon name="shield" size={16} />
                <span>등록한 알레르기 성분은 포함되어 있지 않아요.</span>
              </div>
            ) : null}

            {meal.nutrients ? (
              <div className="nutri" style={{ marginTop: 'var(--s-3)' }}>
                {Object.entries(meal.nutrients).slice(0, 6).map(([k, v]) => (
                  <div key={k}>
                    <div className="k">{k}</div>
                    <div className="v">{v}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {meal.origin ? (
              <p className="tiny dim" style={{ marginTop: 'var(--s-3)' }}>
                원산지 — {Object.entries(meal.origin).map(([k, v]) => `${k} ${v}`).join(', ')}
              </p>
            ) : null}
          </Card>
        );
      })}

      <Button wide onClick={() => setAllergyOpen(true)}>
        알레르기 설정 ({profile?.edu?.allergyCodes.length ?? 0}종)
      </Button>
      <AllergySheet open={allergyOpen} onClose={() => setAllergyOpen(false)} />
      <p className="tiny dim" style={{ textAlign: 'center' }}>
        알레르기 정보는 학교가 공시한 19종 표기를 기준으로 합니다. 최종 확인은 학교 급식실에 문의하세요.
      </p>
    </>
  );
}

function AllergySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAppState();
  const dispatch = useDispatch();
  if (!profile?.edu) return null;
  const codes = profile.edu.allergyCodes;

  const toggle = (code: number) => {
    const next = codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code].sort((a, b) => a - b);
    dispatch({
      type: 'profile/patch',
      patch: { edu: { ...profile.edu!, allergyCodes: next } },
    });
  };

  const hasConsent = profile.consents.some((c) => c.id === 'sensitive-allergy' && c.granted);

  return (
    <Sheet open={open} title="알레르기" onClose={onClose} leading={{ label: '완료', onClick: onClose }}>
      {!hasConsent ? (
        <div className="mod-banner" data-v="flagged">
          <Icon name="shield" size={16} />
          <span>
            알레르기 정보는 <strong>민감정보(건강정보)</strong>예요. 저장하려면 별도 동의가 필요합니다.
            아래에서 동의하면 이 기기에만 저장되고 외부로 전송되지 않아요.
          </span>
        </div>
      ) : null}

      {!hasConsent ? (
        <Button
          wide
          primary
          onClick={() =>
            dispatch({
              type: 'profile/patch',
              patch: {
                consents: [
                  ...profile.consents.filter((c) => c.id !== 'sensitive-allergy'),
                  {
                    id: 'sensitive-allergy', granted: true, version: '1.0',
                    at: new Date().toISOString(), method: 'self',
                  },
                ],
              },
            })
          }
        >
          민감정보 수집에 동의하고 계속
        </Button>
      ) : (
        <div className="allergy-grid">
          {ALLERGENS.map((a) => (
            <Chip key={a.code} selected={codes.includes(a.code)} onClick={() => toggle(a.code)}>
              {a.label}
            </Chip>
          ))}
        </div>
      )}

      <p className="tiny dim">
        선택한 성분이 급식 메뉴에 포함되면 브리프와 급식 화면에서 빨갛게 표시돼요.
      </p>
    </Sheet>
  );
}

/* ================================================================ */

function TimetablePanel({ week, date }: { week: Timetable[]; date: ISODate }) {
  const maxPeriods = Math.max(1, ...week.map((t) => t.periods.length));
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const t0 = today();

  const monday = useMemo(() => {
    const d = fromISODate(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toISODate(d);
  }, [date]);

  return (
    <Card title="이번 주 시간표" icon="book">
      <div className="tt-week">
        <div className="tt-cell head" />
        {[0, 1, 2, 3, 4].map((i) => {
          const d = addDays(monday, i);
          return (
            <div className="tt-cell head" key={d} data-today={d === t0}>
              {WEEKDAYS_KO[fromISODate(d).getDay()]}
              <div className="r">{fromISODate(d).getDate()}</div>
            </div>
          );
        })}

        {Array.from({ length: maxPeriods }, (_, row) => (
          <Fragment key={`row${row}`}>
            <div className="tt-cell num">{row + 1}</div>
            {[0, 1, 2, 3, 4].map((col) => {
              const d = addDays(monday, col);
              const p = week.find((t) => t.date === d)?.periods[row];
              const isNow = Boolean(p) && d === t0 && hhmm >= p!.start && hhmm <= p!.end;
              return (
                <div
                  className="tt-cell"
                  key={`${row}-${col}`}
                  data-today={d === t0}
                  data-now={isNow}
                >
                  {p ? (
                    <>
                      <span className="s">{p.subject}</span>
                      <span className="r">{p.room}</span>
                    </>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="tiny dim" style={{ marginTop: 'var(--s-3)' }}>
        NEIS 시간표를 연결하면 학교가 공시한 실제 시간표로 대체됩니다.
      </p>
    </Card>
  );
}

/* ================================================================ */

function BoardPanel({ posts, onCompose }: { posts: SharedItem[]; onCompose: () => void }) {
  const [filter, setFilter] = useState<'all' | SharedKind>('all');
  const shown = filter === 'all' ? posts : posts.filter((p) => p.kind === filter);
  const upcoming = shown.filter((p) => p.date >= today());
  const past = shown.filter((p) => p.date < today()).reverse();

  return (
    <>
      <div className="row-wrap">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>전체</Chip>
        {(Object.keys(KIND_LABELS) as SharedKind[]).map((k) => (
          <Chip key={k} selected={filter === k} onClick={() => setFilter(k)}>{KIND_LABELS[k]}</Chip>
        ))}
      </div>

      <Card title="다가오는 일정" icon="flag">
        {upcoming.length ? (
          upcoming.map((p) => <PostRow key={p.id} post={p} />)
        ) : (
          <div className="stack-tight">
            <p className="muted small">아직 공유된 항목이 없어요.</p>
            <Button onClick={onCompose}>첫 항목 공유하기</Button>
          </div>
        )}
      </Card>

      {past.length ? (
        <Card title="지난 항목" icon="clock">
          {past.slice(0, 10).map((p) => <PostRow key={p.id} post={p} compact />)}
        </Card>
      ) : null}

      <div className="mod-banner" data-v="approved">
        <Icon name="shield" size={16} />
        <span>
          학급에 올라오는 글은 게시 전에 자동으로 검사돼요. 욕설·개인정보·시험 부정·유해 주제는
          게시되지 않고, 수업과 무관한 약속은 검토 대상으로 표시돼요.
        </span>
      </div>
    </>
  );
}

function PostRow({ post, compact = false }: { post: SharedItem; compact?: boolean }) {
  const { profile, events } = useAppState();
  const dispatch = useDispatch();
  const me = profile?.id ?? '';
  const added = events.some((e) => e.sharedId === post.id);

  const addToCalendar = () => {
    const now = new Date().toISOString();
    const ev: EidosEvent = {
      id: uid('ev'),
      calendarId: 'cal_personal',
      title: `${KIND_LABELS[post.kind]} · ${post.title}`,
      notes: post.detail,
      start: post.time ? `${post.date}T${post.time}:00` : post.date,
      end: post.time ? `${post.date}T${post.time}:00` : post.date,
      allDay: !post.time,
      alarms: [1440],
      availability: 'busy',
      origin: 'edu-assessment',
      sharedId: post.id,
      createdAt: now,
      updatedAt: now,
    };
    dispatch({ type: 'event/add', event: ev });
  };

  return (
    <div className="post" data-verdict={post.moderation.verdict}>
      <div className="top">
        <Chip tone={post.kind === 'assessment' || post.kind === 'exam' ? 'warn' : undefined}>
          {KIND_LABELS[post.kind]}
        </Chip>
        {post.subject ? <Chip>{post.subject}</Chip> : null}
        {post.authoritative ? <Chip tone="good"><Icon name="shield" size={11} />선생님 확인</Chip> : null}
        {post.moderation.verdict === 'flagged' ? (
          <Chip tone="warn">{verdictLabel(post.moderation.verdict)}</Chip>
        ) : null}
        <span className="tiny dim" style={{ marginLeft: 'auto' }}>
          {formatRelativeDay(post.date)}
        </span>
      </div>

      <h4>{post.title}</h4>
      {post.detail && !compact ? <p className="d">{post.detail}</p> : null}

      {!compact ? (
        <div className="foot">
          <span className="tiny dim">
            {post.authorName} · {formatDateKo(post.date, { weekday: true })}
            {post.time ? ` ${post.time}` : ''}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Chip
              tone={post.confirmations.includes(me) ? 'good' : undefined}
              onClick={() => dispatch({ type: 'shared/confirm', id: post.id, userId: me })}
            >
              <Icon name="check" size={11} /> 맞아요 {post.confirmations.length || ''}
            </Chip>
            <Chip
              tone={post.disputes.includes(me) ? 'danger' : undefined}
              onClick={() => dispatch({ type: 'shared/dispute', id: post.id, userId: me })}
            >
              다른데요 {post.disputes.length || ''}
            </Chip>
            <Chip tone={added ? 'info' : undefined} onClick={added ? undefined : addToCalendar}>
              {added ? '캘린더에 있음' : '캘린더에 추가'}
            </Chip>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================ */

function ComposeShared({
  open, onClose, targetId, onPosted,
}: { open: boolean; onClose: () => void; targetId: string; onPosted: () => void }) {
  const { profile } = useAppState();
  const dispatch = useDispatch();
  const [kind, setKind] = useState<SharedKind>('assessment');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState<ISODate>(addDays(today(), 3));
  const [time, setTime] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SharedItem['moderation'] | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(''); setDetail(''); setSubject(''); setResult(null);
      setDate(addDays(today(), 3)); setTime(''); setKind('assessment');
    }
  }, [open]);

  if (!profile?.edu) return null;
  const role = profile.edu.role;

  const submit = async () => {
    if (!title.trim()) return;
    setChecking(true);
    const verdict = await moderate(
      { title, detail, kind, authorRole: role },
      hasRemoteEngine() ? askRaw : undefined,
    );
    setChecking(false);
    setResult(verdict);
    if (verdict.verdict === 'blocked') return;

    dispatch({
      type: 'shared/add',
      item: {
        id: uid('sh'),
        kind,
        title: title.trim(),
        detail: detail.trim() || undefined,
        date,
        time: time || undefined,
        subject: subject.trim() || undefined,
        scope: 'class',
        targetId,
        authorId: profile.id,
        authorName: profile.displayName,
        authorRole: role,
        authoritative: role === 'teacher',
        moderation: verdict,
        confirmations: [],
        disputes: [],
        createdAt: new Date().toISOString(),
      },
    });
    onPosted();
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="학급에 공유"
      onClose={onClose}
      trailing={{ label: checking ? '확인 중…' : '공유', onClick: submit, disabled: !title.trim() || checking, strong: true }}
    >
      <div className="row-wrap">
        {(Object.keys(KIND_LABELS) as SharedKind[]).map((k) => (
          <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{KIND_LABELS[k]}</Chip>
        ))}
      </div>

      <FieldGroup>
        <Field className="field-title">
          <input
            type="text"
            value={title}
            placeholder={kind === 'assessment' ? '예: 국어 수행평가 — 시 낭송' : '제목'}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="제목"
          />
        </Field>
        <Field label="과목">
          <input
            type="text"
            value={subject}
            placeholder="선택"
            onChange={(e) => setSubject(e.target.value)}
            style={{ textAlign: 'right' }}
            aria-label="과목"
          />
        </Field>
        <Field label="날짜">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ marginLeft: 'auto', textAlign: 'right' }}
            aria-label="날짜"
          />
        </Field>
        <Field label="시각">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ marginLeft: 'auto', textAlign: 'right' }}
            aria-label="시각"
          />
        </Field>
        <Field>
          <textarea
            value={detail}
            placeholder="준비물, 범위, 유의사항"
            onChange={(e) => setDetail(e.target.value)}
            aria-label="상세"
          />
        </Field>
      </FieldGroup>

      {result ? (
        <div className="mod-banner" data-v={result.verdict}>
          <Icon name={result.verdict === 'blocked' ? 'warning' : result.verdict === 'flagged' ? 'eye' : 'shield'} size={16} />
          <span>
            <strong>{verdictLabel(result.verdict)}</strong>
            {result.message ? <><br />{result.message}</> : null}
          </span>
        </div>
      ) : (
        <div className="mod-banner" data-v="approved">
          <Icon name="shield" size={16} />
          <span>
            공유 전에 자동 검사를 거쳐요. 같은 반 친구들이 모두 보는 글이라는 걸 기억해 주세요.
            {role === 'student' ? ' 학생이 올린 항목은 선생님이 확인하면 “선생님 확인”이 붙어요.' : ''}
          </span>
        </div>
      )}
    </Sheet>
  );
}
