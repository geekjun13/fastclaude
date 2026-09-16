import { useMemo, useState } from 'react';
import { Button, Card, Chip, Field, FieldGroup, Icon, Segmented, Sheet } from '../../components/index.tsx';
import { GlassSurface } from '../../glass/GlassSurface.tsx';
import { addDays, formatDateKo, formatRelativeDay, formatTime, today } from '../../core/date.ts';
import { occurrencesInRange } from '../../core/recurrence.ts';
import { uid } from '../../core/storage.ts';
import { useAppState, useDispatch } from '../../core/store.tsx';
import type { EidosEvent, Group, GroupMember, SharedItem } from '../../core/types.ts';
import { moderate } from '../../services/moderation.ts';
import './groups.css';

const EMOJI = ['🎬', '⚽️', '🎸', '🍜', '📚', '✈️', '🏕', '🎨', '🧗', '☕️'];
const COLORS = [
  'var(--a-indigo)', 'var(--a-teal)', 'var(--a-green)', 'var(--a-orange)',
  'var(--a-pink)', 'var(--a-purple)', 'var(--a-blue)',
];

function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function GroupsScreen() {
  const { groups } = useAppState();
  const [createOpen, setCreateOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<Group | null>(null);

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="screen-head">
          <h1>그룹</h1>
          <p>일정을 함께 보는 사람들</p>
        </div>

        {groups.length === 0 ? (
          <Card>
            <div className="empty">
              <Icon name="users" size={30} />
              <strong>아직 그룹이 없어요</strong>
              <span className="small">
                친구·가족·동아리를 초대하면 서로의 일정이 하나의 캘린더로 합쳐져요.
              </span>
              <div style={{ marginTop: 'var(--s-3)' }}>
                <Button primary onClick={() => setCreateOpen(true)}>그룹 만들기</Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="group-grid">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} onOpen={() => setOpenGroup(g)} />
            ))}
          </div>
        )}

        <Card title="참여 코드로 들어가기" icon="link">
          <JoinByCode />
        </Card>

        <div className="mod-banner" data-v="approved">
          <Icon name="shield" size={16} />
          <span>
            그룹에서도 공유 항목은 자동 검사를 거쳐요. 멤버마다 <strong>상세 공개</strong>와
            <strong> 바쁨만 표시</strong> 중에서 고를 수 있어요.
          </span>
        </div>
      </div>

      <GlassSurface
        as="button"
        elevation={2}
        radius={27}
        tint="var(--a-blue)"
        pressable
        className="fab"
        aria-label="그룹 만들기"
        onClick={() => setCreateOpen(true)}
      >
        <Icon name="plus" size={25} strokeWidth={2.1} />
      </GlassSurface>

      <CreateGroup open={createOpen} onClose={() => setCreateOpen(false)} />
      <GroupDetail group={openGroup} onClose={() => setOpenGroup(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function GroupCard({ group, onOpen }: { group: Group; onOpen: () => void }) {
  const state = useAppState();
  const upcoming = useMemo(() => {
    const from = today();
    const to = addDays(from, 30);
    return occurrencesInRange(
      state.events.filter((e) => e.calendarId === group.calendarId),
      from,
      to,
    ).slice(0, 3);
  }, [state.events, group.calendarId]);

  return (
    <button className="group-card" onClick={onOpen} style={{ '--c': group.color } as React.CSSProperties}>
      <div className="g-top">
        <span className="g-emoji">{group.emoji}</span>
        <span className="g-name">{group.name}</span>
        <span className="g-count">{group.members.length}명</span>
      </div>
      {upcoming.length ? (
        <div className="g-events">
          {upcoming.map((e) => (
            <span key={e.id}>
              <b>{formatRelativeDay(e.start.slice(0, 10))}</b> {e.title}
            </span>
          ))}
        </div>
      ) : (
        <p className="tiny dim">다가오는 공유 일정이 없어요</p>
      )}
      <div className="g-avatars">
        {group.members.slice(0, 5).map((m) => (
          <span key={m.id} title={m.name}>{m.name.slice(0, 1)}</span>
        ))}
        {group.members.length > 5 ? <span>+{group.members.length - 5}</span> : null}
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- */

function JoinByCode() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { groups, profile } = useAppState();
  const dispatch = useDispatch();

  const join = () => {
    const target = groups.find((g) => g.inviteCode === code.trim().toUpperCase());
    if (!target) {
      setError('그 코드의 그룹을 찾을 수 없어요. 이 기기에 없는 그룹이라면 서버 연동이 필요해요.');
      return;
    }
    if (!profile) return;
    if (target.members.some((m) => m.id === profile.id)) {
      setError('이미 참여 중인 그룹이에요.');
      return;
    }
    dispatch({
      type: 'group/addMember',
      id: target.id,
      member: {
        id: profile.id, name: profile.displayName, role: 'member',
        shares: 'busy-only', joinedAt: new Date().toISOString(),
      },
    });
    setCode('');
    setError(null);
  };

  return (
    <>
      <div className="row">
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field">
            <input
              type="text"
              value={code}
              placeholder="예: K7M2QD"
              maxLength={6}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
              style={{ letterSpacing: '0.18em', fontFamily: 'var(--font-mono)' }}
              aria-label="참여 코드"
            />
          </label>
        </div>
        <Button primary onClick={join} disabled={code.trim().length < 6}>참여</Button>
      </div>
      {error ? <p className="small" style={{ color: 'var(--a-orange)', marginTop: 8 }}>{error}</p> : null}
    </>
  );
}

/* ---------------------------------------------------------------- */

function CreateGroup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAppState();
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [color, setColor] = useState(COLORS[0]);

  const create = () => {
    if (!name.trim() || !profile) return;
    const id = uid('gr');
    const group: Group = {
      id,
      name: name.trim(),
      emoji,
      color,
      inviteCode: inviteCode(),
      calendarId: `cal_${id}`,
      members: [
        {
          id: profile.id, name: profile.displayName, role: 'owner',
          shares: 'details', joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'group/add', group });
    setName('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="새 그룹"
      onClose={onClose}
      trailing={{ label: '만들기', onClick: create, disabled: !name.trim(), strong: true }}
    >
      <FieldGroup>
        <Field className="field-title">
          <input
            type="text"
            value={name}
            placeholder="그룹 이름"
            onChange={(e) => setName(e.target.value)}
            aria-label="그룹 이름"
          />
        </Field>
      </FieldGroup>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>아이콘</div>
        <div className="row-wrap">
          {EMOJI.map((e) => (
            <Chip key={e} selected={emoji === e} onClick={() => setEmoji(e)}>
              <span style={{ fontSize: 15 }}>{e}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 8 }}>색</div>
        <div className="row-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`색 ${c}`}
              onClick={() => setColor(c)}
              style={{
                width: 30, height: 30, borderRadius: '50%', background: c,
                boxShadow: color === c ? '0 0 0 3px var(--bg), 0 0 0 5px var(--label)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      <p className="tiny dim">
        그룹을 만들면 같은 이름의 캘린더가 함께 생겨요. 멤버가 공유한 일정이 그 캘린더로 모입니다.
      </p>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */

function GroupDetail({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [tab, setTab] = useState<'schedule' | 'members'>('schedule');
  const [composeOpen, setComposeOpen] = useState(false);

  if (!group) return null;
  const me = state.profile;

  const events = occurrencesInRange(
    state.events.filter((e) => e.calendarId === group.calendarId),
    today(),
    addDays(today(), 60),
  );

  return (
    <>
      <Sheet
        open
        title={group.name}
        onClose={onClose}
        leading={{ label: '닫기', onClick: onClose }}
        trailing={{ label: '일정 추가', onClick: () => setComposeOpen(true), strong: true }}
      >
        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <span style={{ fontSize: 34 }}>{group.emoji}</span>
          <div>
            <div className="section-title">{group.name}</div>
            <div className="small dim">멤버 {group.members.length}명</div>
          </div>
        </div>

        <div className="invite">
          <div>
            <div className="tiny dim">참여 코드</div>
            <div className="code">{group.inviteCode}</div>
          </div>
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(group.inviteCode).catch(() => {});
            }}
          >
            복사
          </Button>
        </div>

        <Segmented
          options={[{ value: 'schedule', label: '공유 일정' }, { value: 'members', label: '멤버' }]}
          value={tab}
          onChange={setTab}
          ariaLabel="그룹 화면"
        />

        {tab === 'schedule' ? (
          events.length ? (
            <div className="stack-tight">
              {events.map((e) => (
                <div className="ev-row" key={e.id} style={{ '--c': group.color } as React.CSSProperties}>
                  <span className="ev-bar" />
                  <span className="ev-main">
                    <strong>{e.title}</strong>
                    <span className="meta">{formatDateKo(e.start.slice(0, 10), { weekday: true })}</span>
                  </span>
                  <span className="ev-time">{e.allDay ? '종일' : formatTime(e.start)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">공유된 일정이 아직 없어요.</p>
          )
        ) : (
          <div className="stack-tight">
            {group.members.map((m) => (
              <MemberRow key={m.id} group={group} member={m} isMe={m.id === me?.id} />
            ))}
            {group.members.length === 1 ? (
              <p className="tiny dim">
                참여 코드를 공유하면 친구들이 들어올 수 있어요. 들어온 멤버의 일정은
                각자가 고른 공개 범위에 따라 합쳐집니다.
              </p>
            ) : null}
          </div>
        )}

        <Button
          wide
          tone="danger"
          onClick={() => {
            dispatch({ type: 'group/remove', id: group.id });
            onClose();
          }}
        >
          그룹 삭제
        </Button>
      </Sheet>

      <ComposeGroupEvent
        open={composeOpen}
        group={group}
        onClose={() => setComposeOpen(false)}
      />
    </>
  );
}

function MemberRow({ group, member, isMe }: { group: Group; member: GroupMember; isMe: boolean }) {
  const dispatch = useDispatch();
  return (
    <div className="member-row">
      <span className="avatar" style={{ '--c': group.color } as React.CSSProperties}>
        {member.name.slice(0, 1)}
      </span>
      <span className="m-main">
        <strong>{member.name}{isMe ? ' (나)' : ''}</strong>
        <span className="tiny dim">{member.role === 'owner' ? '만든 사람' : member.role === 'admin' ? '관리자' : '멤버'}</span>
      </span>
      <Chip
        onClick={
          isMe
            ? () =>
                dispatch({
                  type: 'group/patch',
                  id: group.id,
                  patch: {
                    members: group.members.map((m) =>
                      m.id === member.id
                        ? { ...m, shares: m.shares === 'details' ? 'busy-only' : 'details' }
                        : m,
                    ),
                  },
                })
            : undefined
        }
      >
        {member.shares === 'details' ? '상세 공개' : '바쁨만'}
      </Chip>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ComposeGroupEvent({
  open, group, onClose,
}: { open: boolean; group: Group; onClose: () => void }) {
  const { profile } = useAppState();
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(addDays(today(), 1));
  const [time, setTime] = useState('19:00');
  const [note, setNote] = useState('');
  const [blocked, setBlocked] = useState<string | null>(null);

  const add = async () => {
    if (!title.trim() || !profile) return;

    // Groups are adults, so the bar is lower than a class board — but the same
    // hard blocks (abuse, personal data, exam fraud) still apply.
    const verdict = await moderate({
      title, detail: note, kind: 'event', authorRole: 'member',
    });
    if (verdict.verdict === 'blocked') {
      setBlocked(verdict.message ?? '이 내용은 공유할 수 없어요.');
      return;
    }

    const now = new Date().toISOString();
    const shared: SharedItem = {
      id: uid('sh'),
      kind: 'event',
      title: title.trim(),
      detail: note.trim() || undefined,
      date,
      time,
      scope: 'group',
      targetId: group.id,
      authorId: profile.id,
      authorName: profile.displayName,
      authorRole: 'member',
      authoritative: false,
      moderation: verdict,
      confirmations: [],
      disputes: [],
      createdAt: now,
    };
    const ev: EidosEvent = {
      id: uid('ev'),
      calendarId: group.calendarId,
      title: title.trim(),
      notes: note.trim() || undefined,
      start: `${date}T${time}:00`,
      end: `${date}T${String(Math.min(23, Number(time.slice(0, 2)) + 2)).padStart(2, '0')}:${time.slice(3)}:00`,
      allDay: false,
      alarms: [60],
      availability: 'busy',
      origin: 'group',
      sharedId: shared.id,
      createdAt: now,
      updatedAt: now,
    };

    dispatch({ type: 'shared/add', item: shared });
    dispatch({ type: 'event/add', event: ev });
    setTitle(''); setNote(''); setBlocked(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="그룹 일정"
      onClose={onClose}
      trailing={{ label: '공유', onClick: add, disabled: !title.trim(), strong: true }}
    >
      <FieldGroup>
        <Field className="field-title">
          <input
            type="text"
            value={title}
            placeholder="무엇을 함께 하나요?"
            onChange={(e) => { setTitle(e.target.value); setBlocked(null); }}
            aria-label="제목"
          />
        </Field>
        <Field label="날짜">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ marginLeft: 'auto', textAlign: 'right' }} aria-label="날짜" />
        </Field>
        <Field label="시각">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            style={{ marginLeft: 'auto', textAlign: 'right' }} aria-label="시각" />
        </Field>
        <Field>
          <textarea value={note} placeholder="메모" onChange={(e) => setNote(e.target.value)} aria-label="메모" />
        </Field>
      </FieldGroup>

      {blocked ? (
        <div className="mod-banner" data-v="blocked">
          <Icon name="warning" size={16} />
          <span>{blocked}</span>
        </div>
      ) : null}

      <p className="tiny dim">
        공유하면 그룹 멤버 모두의 “{group.name}” 캘린더에 같은 일정이 나타나요.
      </p>
    </Sheet>
  );
}
