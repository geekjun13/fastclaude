import { useEffect, useRef, useState } from 'react';
import { Chip, Icon } from '../../components/index.tsx';
import { GlassSurface } from '../../glass/GlassSurface.tsx';
import { uid } from '../../core/storage.ts';
import { newEvent, newReminder, useAppState, useDispatch } from '../../core/store.tsx';
import { ask, CYCLE_NAME, hasRemoteEngine } from '../../services/cycle.ts';
import type { CycleAction, CycleMessage } from '../../core/types.ts';
import './cycle.css';

const SUGGESTIONS = [
  '오늘 뭐 있어?',
  '이번 주에 2시간 언제 비어?',
  '내일 오후 3시 치과 1시간',
  '다음 일정 뭐야?',
  '매주 월요일 9시 팀 회의',
];

export function CycleScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = state.cycleThread;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread.length, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;

    const userMsg: CycleMessage = {
      id: uid('m'), role: 'user', text: message, at: new Date().toISOString(),
    };
    dispatch({ type: 'cycle/append', message: userMsg });
    setDraft('');
    setBusy(true);

    // A beat before answering. Instant replies read as a lookup, not a reply,
    // and the local engine is fast enough that it would otherwise feel abrupt.
    const reply = await ask(state, message);
    await new Promise((r) => setTimeout(r, 180));

    dispatch({
      type: 'cycle/append',
      message: {
        id: uid('m'),
        role: 'cycle',
        text: reply.text,
        at: new Date().toISOString(),
        actions: reply.actions,
      },
    });
    setBusy(false);
    inputRef.current?.focus();
  };

  const runAction = (messageId: string, index: number, action: CycleAction) => {
    const key = `${messageId}:${index}`;
    if (applied.has(key)) return;

    switch (action.type) {
      case 'create-event': {
        dispatch({ type: 'event/add', event: newEvent(action.draft) });
        break;
      }
      case 'create-reminder': {
        dispatch({ type: 'reminder/add', reminder: newReminder(action.draft) });
        break;
      }
      case 'find-slot': {
        const first = action.within[0];
        if (first) {
          dispatch({ type: 'ui/focus', date: first });
          dispatch({ type: 'ui/view', view: 'day' });
          dispatch({ type: 'ui/tab', tab: 'calendar' });
        }
        break;
      }
      case 'open': {
        dispatch({ type: 'ui/tab', tab: action.view as never });
        break;
      }
    }
    setApplied((s) => new Set(s).add(key));
  };

  return (
    <div className="cycle-screen">
      <div className="cycle-thread" ref={threadRef}>
        {thread.length === 0 ? (
          <div className="cycle-intro">
            <div className="cycle-orb"><Icon name="sparkle" size={32} /></div>
            <h2>{CYCLE_NAME}</h2>
            <p>
              고정된 일정에 넣기 애매한 것들을 여기에 적어 두세요. 말로 일정을 만들고,
              하루를 물어보고, 빈 시간을 찾을 수 있어요.
            </p>
            <div className="suggest">
              {SUGGESTIONS.map((s) => (
                <Chip key={s} onClick={() => send(s)}>{s}</Chip>
              ))}
            </div>
          </div>
        ) : (
          thread.map((m) => (
            <div className="bubble" data-role={m.role} key={m.id}>
              <Markdownish text={m.text} />
              {m.actions?.length ? (
                <div className="bubble-actions">
                  {m.actions.map((a, i) => {
                    const key = `${m.id}:${i}`;
                    const done = applied.has(key);
                    return (
                      <button
                        className="act"
                        key={key}
                        data-done={done}
                        onClick={() => runAction(m.id, i, a)}
                      >
                        <Icon name={done ? 'check' : 'plus'} size={12} strokeWidth={2.2} />
                        {done ? '추가됨' : a.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))
        )}

        {busy ? (
          <div className="bubble" data-role="cycle">
            <span className="thinking" aria-label="생각 중"><i /><i /><i /></span>
          </div>
        ) : null}
      </div>

      <GlassSurface elevation={2} radius={24} className="composer">
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          placeholder={`${CYCLE_NAME}에게 말하기`}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(128, e.target.scrollHeight)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          aria-label={`${CYCLE_NAME}에게 보낼 메시지`}
        />
        <button
          className="send-btn"
          onClick={() => send(draft)}
          disabled={!draft.trim() || busy}
          aria-label="보내기"
        >
          <Icon name="send2" size={17} strokeWidth={2} />
        </button>
      </GlassSurface>

      <p className="engine-note">
        {hasRemoteEngine()
          ? `${CYCLE_NAME}는 연결된 모델로 답합니다.`
          : `${CYCLE_NAME}는 이 기기 안에서 동작 중이에요 — 일정이 외부로 나가지 않습니다.`}
      </p>
    </div>
  );
}

/**
 * The replies use a very small amount of markup — **bold** and line breaks.
 * Rendering it by hand keeps the dependency list at two packages and means
 * nothing user-supplied is ever passed through dangerouslySetInnerHTML.
 */
function Markdownish({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p,
      )}
    </>
  );
}
