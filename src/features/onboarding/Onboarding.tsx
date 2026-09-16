import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, Field, FieldGroup, Icon } from '../../components/index.tsx';
import { GlassSurface } from '../../glass/GlassSurface.tsx';
import { fromISODate, today } from '../../core/date.ts';
import { uid } from '../../core/storage.ts';
import { useDispatch } from '../../core/store.tsx';
import type {
  AccountType, ConsentKey, ConsentRecord, EduRole, ISODate, Profile, SchoolRef,
} from '../../core/types.ts';
import { ALLERGENS, searchSchools } from '../../services/neis.ts';
import { consentsFor } from './consents.tsx';
import './onboarding.css';

type Step = 'welcome' | 'identity' | 'school' | 'class' | 'allergy' | 'consent' | 'briefs';

/** Korean legal age counts from the birth date; under 14 needs a guardian's consent. */
function ageFrom(birth: ISODate): number {
  const b = fromISODate(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

export function Onboarding() {
  const dispatch = useDispatch();

  const [step, setStep] = useState<Step>('welcome');
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<ISODate>('');
  const [role, setRole] = useState<EduRole>('student');
  const [school, setSchool] = useState<SchoolRef | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolRef[]>([]);
  const [grade, setGrade] = useState(1);
  const [classNo, setClassNo] = useState(1);
  const [studentNo, setStudentNo] = useState<number | ''>('');
  const [childName, setChildName] = useState('');
  const [allergies, setAllergies] = useState<number[]>([]);
  const [granted, setGranted] = useState<Set<ConsentKey>>(new Set());
  const [expanded, setExpanded] = useState<ConsentKey | null>(null);
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [morningAt, setMorningAt] = useState('07:00');
  const [nightAt, setNightAt] = useState('22:00');
  const [topics, setTopics] = useState<string[]>(['종합', 'IT·과학']);

  const isMinor = birth ? ageFrom(birth) < 14 : false;
  const specs = useMemo(() => consentsFor(accountType, isMinor), [accountType, isMinor]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      searchSchools(query).then((r) => alive && setResults(r));
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const steps: Step[] = accountType === 'edu'
    ? ['welcome', 'identity', 'school', 'class', 'allergy', 'consent', 'briefs']
    : ['welcome', 'identity', 'consent', 'briefs'];
  const index = steps.indexOf(step);

  const canAdvance = (): boolean => {
    switch (step) {
      case 'welcome': return true;
      case 'identity': return name.trim().length > 0 && birth.length === 10;
      case 'school': return Boolean(school);
      case 'class':
        if (role === 'parent') return childName.trim().length > 0;
        return grade > 0 && classNo > 0;
      case 'allergy': return true;
      case 'consent': {
        const requiredOk = specs.filter((s) => s.required).every((s) => granted.has(s.id));
        const guardianOk = !isMinor || (guardianName.trim() && guardianContact.trim());
        return requiredOk && Boolean(guardianOk);
      }
      case 'briefs': return true;
    }
  };

  const next = () => {
    if (!canAdvance()) return;
    if (step === 'briefs') return finish();
    setStep(steps[Math.min(steps.length - 1, index + 1)]);
  };
  const back = () => setStep(steps[Math.max(0, index - 1)]);

  const finish = () => {
    const now = new Date().toISOString();
    const consents: ConsentRecord[] = specs.map((s) => ({
      id: s.id,
      granted: granted.has(s.id),
      version: s.version,
      at: now,
      ...(s.id === 'guardian'
        ? { guardianName: guardianName.trim(), guardianContact: guardianContact.trim(), method: 'guardian-email' as const }
        : { method: 'self' as const }),
    }));

    const allowAllergy = granted.has('sensitive-allergy');

    const profile: Profile = {
      id: uid('u'),
      displayName: name.trim(),
      accountType,
      birthDate: birth,
      isMinorUnder14: isMinor,
      consents,
      briefs: {
        morningAt,
        nightAt,
        morningQuestions: ['오늘 제일 중요한 일은?'],
        nightQuestions: ['오늘 뭐 있었어?'],
        newsTopics: topics,
      },
      location: { name: '서울', lat: 37.5665, lon: 126.978 },
      createdAt: now,
      ...(accountType === 'edu' && school
        ? {
            edu: {
              role,
              school,
              class:
                role === 'parent'
                  ? { grade, classNo }
                  : { grade, classNo, studentNo: studentNo === '' ? undefined : studentNo },
              childName: role === 'parent' ? childName.trim() : undefined,
              teachingClasses: role === 'teacher' ? [{ grade, classNo }] : undefined,
              // Without the sensitive-data consent, nothing is stored at all.
              allergyCodes: allowAllergy ? allergies : [],
            },
          }
        : {}),
    };

    dispatch({ type: 'profile/set', profile });
  };

  return (
    <div className="ob">
      <GlassSurface elevation={3} radius={34} className="ob-card" present>
        <header className="ob-head">
          <span className="ob-mark">Eidos</span>
          <h1>{TITLES[step]}</h1>
          <p>{SUBTITLES[step]}</p>
        </header>

        <div className="ob-progress" aria-hidden>
          {steps.map((s, i) => <i key={s} data-on={i <= index} />)}
        </div>

        <div className="ob-body">
          {step === 'welcome' ? (
            <>
              <Picker
                on={accountType === 'personal'}
                icon="calendar"
                title="일반으로 시작"
                desc="캘린더, 모닝·나이트 브리프, 그룹 공유, Cycle을 모두 사용합니다."
                onClick={() => setAccountType('personal')}
              />
              <Picker
                on={accountType === 'edu'}
                icon="school"
                title="에듀 플랜으로 시작"
                desc="위 기능에 더해 학교 급식·시간표와 학급 공유가 열립니다. 학생·학부모·선생님 모두 가입할 수 있어요."
                onClick={() => setAccountType('edu')}
              />
              <p className="tiny dim">
                나중에 설정에서 바꿀 수 있어요. 에듀 플랜은 학교와 학년·반 정보가 필요합니다.
              </p>
            </>
          ) : null}

          {step === 'identity' ? (
            <>
              <FieldGroup>
                <Field className="field-title">
                  <input
                    type="text"
                    value={name}
                    placeholder="이름 또는 표시할 이름"
                    onChange={(e) => setName(e.target.value)}
                    aria-label="이름"
                  />
                </Field>
                <Field label="생년월일">
                  <input
                    type="date"
                    value={birth}
                    max={today()}
                    onChange={(e) => setBirth(e.target.value)}
                    style={{ marginLeft: 'auto', textAlign: 'right' }}
                    aria-label="생년월일"
                  />
                </Field>
              </FieldGroup>

              {accountType === 'edu' ? (
                <>
                  <div className="card-title">구분</div>
                  <Picker on={role === 'student'} icon="book" title="학생"
                    desc="내 시간표와 급식을 보고, 우리 반 수행평가를 주고받아요."
                    onClick={() => setRole('student')} />
                  <Picker on={role === 'parent'} icon="heart" title="학부모"
                    desc="자녀 학급의 급식·시간표와 공지를 확인합니다. 게시는 하지 않아요."
                    onClick={() => setRole('parent')} />
                  <Picker on={role === 'teacher'} icon="shield" title="선생님"
                    desc="학급에 공지와 평가 일정을 올립니다. 올린 항목에는 ‘선생님 확인’이 붙어요."
                    onClick={() => setRole('teacher')} />
                </>
              ) : null}

              {birth && isMinor ? (
                <div className="mod-banner" data-v="flagged">
                  <Icon name="shield" size={16} />
                  <span>
                    만 14세 미만이에요. 다음 단계에서 <strong>보호자 동의</strong>를 받아야 가입이
                    완료됩니다.
                  </span>
                </div>
              ) : null}
            </>
          ) : null}

          {step === 'school' ? (
            <>
              <FieldGroup>
                <Field>
                  <Icon name="search" size={17} />
                  <input
                    type="search"
                    value={query}
                    placeholder="학교 이름 또는 지역으로 검색"
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="학교 검색"
                  />
                </Field>
              </FieldGroup>

              {school ? (
                <div className="pick" data-on="true">
                  <span className="ic"><Icon name="school" size={19} /></span>
                  <span className="tx">
                    <strong>{school.name}</strong>
                    <span>{school.region} · {school.kind}</span>
                  </span>
                  <button
                    className="icon-btn"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setSchool(null)}
                    aria-label="선택 해제"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ) : null}

              {results.length && !school ? (
                <div className="field-group">
                  {results.map((s) => (
                    <button
                      className="school-result"
                      key={s.schoolCode}
                      onClick={() => { setSchool(s); setQuery(''); setResults([]); }}
                    >
                      <strong>{s.name}</strong>
                      <span>{s.region} · {s.kind}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {query.trim().length >= 2 && !results.length && !school ? (
                <p className="small dim">
                  검색 결과가 없어요. NEIS 키를 연결하면 전국 학교를 검색할 수 있습니다.
                </p>
              ) : null}
            </>
          ) : null}

          {step === 'class' ? (
            <>
              {role === 'parent' ? (
                <FieldGroup>
                  <Field label="자녀 이름">
                    <input
                      type="text"
                      value={childName}
                      placeholder="자녀 이름"
                      onChange={(e) => setChildName(e.target.value)}
                      style={{ textAlign: 'right' }}
                      aria-label="자녀 이름"
                    />
                  </Field>
                </FieldGroup>
              ) : null}

              <div>
                <div className="card-title" style={{ marginBottom: 8 }}>학년</div>
                <div className="row-wrap">
                  {[1, 2, 3, 4, 5, 6].slice(0, school?.kind === '초등학교' ? 6 : 3).map((g) => (
                    <Chip key={g} selected={grade === g} onClick={() => setGrade(g)}>{g}학년</Chip>
                  ))}
                </div>
              </div>

              <div>
                <div className="card-title" style={{ marginBottom: 8 }}>
                  {role === 'teacher' ? '담당 반' : '반'}
                </div>
                <div className="row-wrap">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => (
                    <Chip key={c} selected={classNo === c} onClick={() => setClassNo(c)}>{c}반</Chip>
                  ))}
                </div>
              </div>

              {role === 'student' ? (
                <FieldGroup>
                  <Field label="번호">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={studentNo}
                      placeholder="선택"
                      onChange={(e) => setStudentNo(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ marginLeft: 'auto', textAlign: 'right' }}
                      aria-label="번호"
                    />
                  </Field>
                </FieldGroup>
              ) : null}

              <p className="tiny dim">
                번호는 선택 항목이고 학급 게시글에 표시되지 않아요. 같은 학교·학년·반을 고른
                사람들끼리 수행평가와 공지를 주고받습니다.
              </p>
            </>
          ) : null}

          {step === 'allergy' ? (
            <>
              <div className="allergy-grid">
                {ALLERGENS.map((a) => (
                  <Chip
                    key={a.code}
                    selected={allergies.includes(a.code)}
                    onClick={() =>
                      setAllergies((prev) =>
                        prev.includes(a.code)
                          ? prev.filter((c) => c !== a.code)
                          : [...prev, a.code].sort((x, y) => x - y),
                      )
                    }
                  >
                    {a.label}
                  </Chip>
                ))}
              </div>
              <div className="mod-banner" data-v="flagged">
                <Icon name="shield" size={16} />
                <span>
                  알레르기는 <strong>민감정보</strong>라서 다음 단계에서 별도 동의를 받아요.
                  동의하지 않으면 여기서 고른 내용은 저장되지 않습니다.
                </span>
              </div>
              <p className="tiny dim">건너뛰어도 되고, 나중에 급식 화면에서 설정할 수 있어요.</p>
            </>
          ) : null}

          {step === 'consent' ? (
            <>
              <div className="field-group">
                {specs.map((s) => {
                  const on = granted.has(s.id);
                  return (
                    <div key={s.id}>
                      <button
                        className="consent"
                        data-on={on}
                        onClick={() =>
                          setGranted((prev) => {
                            const n = new Set(prev);
                            if (n.has(s.id)) n.delete(s.id);
                            else n.add(s.id);
                            return n;
                          })
                        }
                      >
                        <span className="box"><Icon name="check" size={13} strokeWidth={2.8} /></span>
                        <span className="tx">
                          <span className="req" data-req={s.required}>
                            {s.required ? '필수' : '선택'}
                          </span>
                          <strong>{s.title}</strong>
                          <p>{s.summary}</p>
                        </span>
                        <span
                          className="icon-btn"
                          style={{ marginLeft: 'auto' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(expanded === s.id ? null : s.id);
                          }}
                        >
                          <Icon name="chevronDown" size={16} />
                        </span>
                      </button>
                      {expanded === s.id ? <div className="notice">{s.notice}</div> : null}
                    </div>
                  );
                })}
              </div>

              {isMinor ? (
                <FieldGroup>
                  <Field label="보호자 성함">
                    <input
                      type="text"
                      value={guardianName}
                      placeholder="법정대리인"
                      onChange={(e) => setGuardianName(e.target.value)}
                      style={{ textAlign: 'right' }}
                      aria-label="보호자 성함"
                    />
                  </Field>
                  <Field label="보호자 연락처">
                    <input
                      type="text"
                      value={guardianContact}
                      placeholder="이메일 또는 전화번호"
                      onChange={(e) => setGuardianContact(e.target.value)}
                      style={{ textAlign: 'right' }}
                      aria-label="보호자 연락처"
                    />
                  </Field>
                </FieldGroup>
              ) : null}

              <button
                className="btn btn-wide"
                onClick={() =>
                  setGranted((prev) =>
                    prev.size === specs.length ? new Set() : new Set(specs.map((s) => s.id)),
                  )
                }
              >
                {granted.size === specs.length ? '전체 해제' : '전체 동의 (선택 항목 포함)'}
              </button>

              <p className="tiny dim">
                선택 항목은 거부해도 가입할 수 있어요. 각 항목의 <Icon name="chevronDown" size={11} />를
                누르면 수집 항목·목적·보유기간 전문을 볼 수 있습니다.
              </p>
            </>
          ) : null}

          {step === 'briefs' ? (
            <>
              <FieldGroup>
                <Field label="모닝 브리프">
                  <input type="time" value={morningAt} onChange={(e) => setMorningAt(e.target.value)}
                    style={{ marginLeft: 'auto', textAlign: 'right' }} aria-label="모닝 브리프 시각" />
                </Field>
                <Field label="나이트 브리프">
                  <input type="time" value={nightAt} onChange={(e) => setNightAt(e.target.value)}
                    style={{ marginLeft: 'auto', textAlign: 'right' }} aria-label="나이트 브리프 시각" />
                </Field>
              </FieldGroup>

              <div>
                <div className="card-title" style={{ marginBottom: 8 }}>관심 있는 뉴스</div>
                <div className="row-wrap">
                  {['종합', '경제', 'IT·과학', '세계', '문화', '스포츠', '건강', '교육'].map((t) => (
                    <Chip
                      key={t}
                      selected={topics.includes(t)}
                      onClick={() =>
                        setTopics((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
                      }
                    >
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>

              <p className="tiny dim">
                모든 설정은 나중에 바꿀 수 있어요. 준비됐다면 시작해요.
              </p>
            </>
          ) : null}
        </div>

        <footer className="ob-foot">
          {index > 0 ? <Button onClick={back}>이전</Button> : null}
          <span style={{ marginLeft: 'auto' }}>
            <Button primary onClick={next} disabled={!canAdvance()}>
              {step === 'briefs' ? 'Eidos 시작하기' : '다음'}
            </Button>
          </span>
        </footer>
      </GlassSurface>
    </div>
  );
}

function Picker({
  on, icon, title, desc, onClick,
}: { on: boolean; icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button className="pick" data-on={on} onClick={onClick}>
      <span className="ic"><Icon name={icon} size={19} /></span>
      <span className="tx">
        <strong>{title}</strong>
        <span>{desc}</span>
      </span>
    </button>
  );
}

const TITLES: Record<Step, string> = {
  welcome: '캘린더를\n하루의 운영체제로',
  identity: '먼저 이름부터',
  school: '어느 학교인가요?',
  class: '학년과 반',
  allergy: '알레르기가 있나요?',
  consent: '동의가 필요해요',
  briefs: '브리프를 언제 받을까요?',
};

const SUBTITLES: Record<Step, string> = {
  welcome: 'Eidos는 애플 캘린더가 하는 일을 전부 하고, 그 위에 아침과 저녁을 얹습니다.',
  identity: '브리프에서 부를 이름이에요. 실명이 아니어도 괜찮아요.',
  school: '급식과 시간표를 학교 공시 데이터에서 가져와요.',
  class: '같은 반 친구들과 수행평가를 주고받는 기준이 됩니다.',
  allergy: '급식 메뉴에 해당 성분이 있으면 미리 알려 드려요.',
  consent: '무엇을, 왜, 얼마나 보관하는지 항목마다 적어 두었어요.',
  briefs: '이 시각에 하루의 요약이 준비됩니다.',
};
