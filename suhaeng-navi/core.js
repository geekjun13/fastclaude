'use strict';
/* 수행 내비 — core: constants, prompts, dates, storage, examples, planner.
   Shared by the other scripts through the global scope. */

const KEY = 'suhaeng-navi:v3', OLD_KEY = 'suhaeng-navi:v2';
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const FIELD_LABEL = { subject: '과목', type: '유형', title: '이름', due: '마감', dueTime: '시간', method: '제출', materials: '준비물', rubric: '채점 기준', weight: '반영 비율' };
const ACC_FIELDS = ['subject', 'type', 'title', 'due', 'method', 'materials', 'rubric'];
const TYPES = ['보고서', '발표', '말하기', '글쓰기', '실험', '실기', '포트폴리오', '모둠 활동', '시험형'];
const SUBJECT_HUE = { '국어': 6, '수학': 214, '영어': 262, '과학': 152, '사회': 34, '역사': 22, '도덕': 188, '음악': 330, '미술': 16, '체육': 92, '기술·가정': 46, '기가': 46, '정보': 196, '한문': 282 };
const hueOf = s => {
  if (SUBJECT_HUE[s] != null) return SUBJECT_HUE[s];
  let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const FOCUS = {
  afternoon: { label: '하교 직후', desc: '16~19시에 먼저 넣어요', range: [960, 1140] },
  evening: { label: '저녁', desc: '19~22시에 먼저 넣어요', range: [1140, 1320] },
  night: { label: '밤', desc: '21~24시에 먼저 넣어요', range: [1260, 1440] },
  morning: { label: '주말 오전', desc: '주말엔 9~12시에 먼저', range: [540, 720] }
};
const TONES = {
  friend: { label: '다정한 친구', desc: '반말로 따뜻하게', rule: '다정한 친구처럼 반말로, 짧고 따뜻하게', sample: '괜찮아, 금요일 30분으로 옮겼어. 할 수 있어!' },
  coach: { label: '차분한 코치', desc: '존댓말로 담백하게', rule: '차분한 코치처럼 존댓말로, 담백하고 구체적으로', sample: '계획을 금요일 30분으로 옮겼어요. 그때 개요부터 시작해요.' },
  cheer: { label: '신나는 응원단', desc: '에너지 넘치게', rule: '신나는 응원단처럼 반말로, 에너지 있게. 느낌표는 2개까지', sample: '오케이! 금요일 30분이면 충분해! 개요부터 달려 보자!' }
};
const DEF_SETTINGS = {
  name: '지민', grade: '중학교 3학년',
  schoolEnd: [980, 980, 980, 925, 980], weekendStart: 600, dayEnd: 1380,
  cap: 90, weekendCap: 150, travel: 15, focus: 'evening', tone: 'friend', solid: false
};
const DEF_NOTIF = { on: true, events: true, step: 10, dueEve: true, dueMorning: true, academy: true, crunch: true, quiet: true, quietStart: 1380, quietEnd: 420, sound: false };

/* ---------- prompts: the app sends exactly these ---------- */
const P = {
  read: {
    name: '공지 정리', icon: 'camera', when: '공지 스캔', tier: '기본 모델 · 사진 첨부',
    why: '칠판, 학습지, 단톡방마다 형식이 달라 규칙으로는 못 뽑아요.',
    tpl:
`너는 한국 중·고등학생의 수행평가 공지를 정리하는 도우미 '수행 내비'야.
공지는 칠판 사진, 학습지, 단톡방 캡처, 학교 알림 앱 글 가운데 하나라서 형식이 제각각이야.

오늘: {{오늘}}

[할 일]
공지에 나온 수행평가를 하나씩 찾아서 아래 항목을 뽑아.
- subject: 과목
- type: 유형. 보고서, 발표, 말하기, 글쓰기, 실험, 실기, 포트폴리오, 모둠 활동, 시험형 가운데 하나
- title: 수행평가 이름 (짧게)
- due: 마감일, YYYY-MM-DD. "다음 주 화요일", "10/27" 같은 표현은 오늘 날짜를 기준으로 계산해.
- dueTime: 교시나 시각. 없으면 null
- method: 제출하거나 실시하는 방식
- materials: 준비물 배열
- rubric: 채점 기준 원문 배열. 배점이 있으면 "(10점)"처럼 붙여.
- weight: 성적 반영 비율. 없으면 null
- uncertain: 확실하지 않은 항목 [{"field": 항목 키, "why": 이유}]

사진이 있으면 privacy도 채워. 사진에 보이는 학생 이름, 학번, 전화번호의 위치를
[{"image": 사진 번호(1부터), "label": "이름", "box": [x, y, w, h]}] 형식으로, 사진 왼쪽 위를 0, 오른쪽 아래를 1로 하는 비율로 적어. 없으면 빈 배열.

[규칙]
1. 공지에 없는 내용은 지어내지 말고 null이나 빈 배열로 둬.
2. 글씨가 흐리거나 날짜가 애매하면 가장 그럴듯한 값을 넣고 uncertain에 이유를 적어.
3. 과제 내용(글, 답, 발표문)은 절대 대신 쓰지 마. 정리만 해.
4. 개인정보는 items에 옮겨 적지 마. 위치만 privacy에 적어.
5. 수행평가 공지가 아니면 items를 빈 배열로 둬.

[출력]
JSON만 출력해. 형식:
{"items":[{"subject":"국어","type":"발표","title":"시 낭송과 감상문","due":"2026-03-24","dueTime":"3교시","method":"수업 중 낭송 후 감상문 제출","materials":["교과서"],"rubric":["암송 정확성 (10점)"],"weight":"20%","uncertain":[]}],"privacy":[]}

[공지]
{{공지}}`
  },
  rubric: {
    name: '채점 기준 번역기', icon: 'list', when: '수행 카드 · 체크리스트 탭', tier: '기본 모델',
    why: '문장의 뜻을 해석해서 행동 단위로 바꾸는 일이라 언어 AI가 필요해요.',
    tpl:
`너는 '수행 내비'의 채점 기준 번역기야.
선생님이 쓴 채점 기준을 학생이 바로 행동할 수 있는 말로 풀어줘.

[수행평가]
{{수행평가}}

[채점 기준 원문]
{{채점기준}}

[규칙]
1. 기준마다 plain에 쉬운 말 풀이 1문장, checks에 숫자나 개수가 들어간 확인 항목 2~3개를 써.
   예: "논리적 근거를 들어 설득력 있게 서술" → "주장 1개마다 근거 2개", "근거마다 출처 1개 이상"
2. 원문에 없는 기준을 새로 만들지 마. 뜻이 애매하면 tip에 "선생님께 확인: ..."이라고 적어.
3. 주제, 문장, 답 같은 결과물 내용은 대신 정하거나 쓰지 마.
4. 중학생도 이해하는 말로, 확인 항목 하나는 40자 이내.

[출력]
JSON만 출력해. 형식:
{"criteria":[{"original":"원문","plain":"풀이","checks":["확인 항목"],"tip":null}],"beforeSubmit":["제출 직전에 볼 항목 3~5개"]}`
  },
  steps: {
    name: '역산 단계 나누기', icon: 'route', when: '수행 카드 · 역산 계획 탭', tier: '기본 모델',
    why: '과제마다 필요한 단계가 달라서 AI가 쪼개고, 날짜 배치는 알고리즘이 정확하게 해요.',
    tpl:
`너는 '수행 내비'의 역산 플래너야.
수행평가를 마감일에서 거꾸로 계획할 수 있게 작업 단계로 나눠줘. 날짜 배치는 앱이 학원 시간표를 보고 할 거야.

[수행평가]
{{수행평가}}

[규칙]
1. 이 과제 종류에 맞는 단계 3~6개. 보고서는 자료 조사 → 개요 → 초안 → 다듬기, 발표는 개요 → 원고 → 리허설처럼 과제마다 달라.
2. 단계마다 중학생 기준 예상 시간(minutes, 20~120분)과 다 했는지 스스로 알 수 있는 완료 기준(done) 1줄.
3. 마지막 단계는 채점 기준으로 스스로 점검하기.
4. 결과물 내용은 대신 쓰지 마. 단계 이름과 완료 기준만.

[출력]
JSON만 출력해. 형식:
{"steps":[{"name":"자료 조사","minutes":50,"done":"믿을 만한 출처 3개를 메모"}]}`
  },
  cheer: {
    name: '다시 짜기 응원', icon: 'heart', when: '투데이 · "오늘 못 했어요"', tier: '빠른 모델',
    why: '남은 일정은 앱이 다시 계산하고, AI는 학생 상황에 맞는 말투로 다음 행동만 짚어요.',
    tpl:
`너는 '수행 내비'야. 학생이 오늘 계획한 수행평가 작업을 못 했어.
앱이 남은 일정을 이미 다시 짰어. 학생에게 보낼 메시지를 써줘.

[말투]
{{말투}}

[못 한 일]
{{못한일}}

[다시 짠 첫 일정]
{{새일정}}

[규칙]
- 잔소리가 아니라 응원, 2문장 이내.
- "왜 안 했어" 같은 탓하는 말, 죄책감 주는 말 금지.
- 다음에 할 일 1개를 구체적으로 짚어줘.
- 텍스트만 출력해.`
  },
  coach: {
    name: '수행 카드 코칭', icon: 'chat', when: '수행 카드 · 코칭 탭', tier: '빠른 모델 · 대화',
    why: '"AI가 과제를 대신 하는 거 아니냐"는 질문에 시연으로 바로 답해요.',
    tpl:
`너는 수행평가 도우미 '수행 내비'야. 말투: {{말투}}

[원칙: 대신 해주지 않는 AI]
- 감상문, 보고서, 발표문, 답 같은 결과물을 대신 쓰거나 고쳐 쓰지 않아.
- 대신 계획 세우기, 채점 기준 이해, 스스로 점검할 질문으로 도와.
- 대신 써 달라는 부탁을 받으면 한 문장으로 거절하고, 바로 할 수 있는 다음 행동 1개와 스스로 답해볼 질문 2개를 줘.

[수행평가 정보]
{{수행평가}}

[진행 상황]
{{진행}}

이어지는 학생 메시지에 답해. 쉬운 말로 5문장 이내, 마크다운 기호 없이 텍스트만.`
  },
  chat: {
    name: '내비 코치', icon: 'spark', when: '내비 코치', tier: '빠른 모델 · 대화',
    why: '수행 카드함 전체와 오늘 계획을 근거로 "뭐부터 해?"에 답해요.',
    tpl:
`너는 중·고등학생의 수행평가 도우미 '수행 내비'야. 말투: {{말투}}

[원칙: 대신 해주지 않는 AI]
- 결과물(글, 답, 발표문)은 대신 쓰지 않아. 대신 써 달라면 한 문장으로 거절하고 다음 행동을 알려줘.
- 일정 질문에는 아래 수행 보드와 계획을 근거로 날짜와 시간을 짚어.
- 모르는 건 지어내지 말고 앱의 어느 화면에서 확인하면 되는지 알려줘.

[학생]
이름: {{이름}} · 오늘: {{오늘}}

[수행 보드]
{{보드}}

[앞으로의 계획]
{{계획}}

이어지는 학생 메시지에 답해. 4문장 이내, 마크다운 기호 없이 텍스트만.`
  },
  timetable: {
    name: '시간표 읽기', icon: 'clock', when: '시간표 · 사진으로 입력', tier: '기본 모델 · 사진 첨부',
    why: '학원 시간표 사진은 표 모양이 제각각이라 AI가 읽고, 학생이 확인해요.',
    tpl:
`너는 '수행 내비'의 시간표 도우미야. 학원 시간표(사진 또는 글)를 읽어서 학원 일정 목록으로 바꿔줘.

[규칙]
1. 학원이나 과외처럼 학교 밖 일정만. 학교 정규 수업은 빼.
2. days는 요일 숫자 배열(0=일, 1=월 … 6=토), start와 end는 24시간제 HH:MM.
3. 읽을 수 없는 칸은 지어내지 말고 빼.

[출력]
JSON만 출력해. 형식:
{"academies":[{"label":"수학 학원","days":[1,3,5],"start":"18:00","end":"21:00"}]}

[시간표]
{{시간표}}`
  }
};
/* study lab and membership prompts — tier marks who sees them */
Object.assign(P, {
  quiz: {
    name: '시험지 만들기', icon: 'book', when: '스터디 랩 · 만들기', tier: '빠른 모델 · 사진 첨부 가능', plan: 'air',
    why: '교과서마다 표현이 달라서, 자료를 읽고 개념을 골라 문제로 바꾸는 일은 AI가 해요. 채점은 앱이 해요.',
    tpl:
`너는 '수행 내비'의 스터디 랩이야. 아래 [학습 자료]만 근거로 시험 문제를 만들어.

[조건]
과목: {{과목}} · 문항 수: {{문항수}} · 난이도: {{난이도}} · 유형: {{유형}}

[규칙]
1. 자료에 있는 내용만 출제해. 자료에 없는 사실은 쓰지 마.
2. 객관식(mc)은 보기 4개, answer는 정답 보기 번호(0부터). OX(ox)는 answer가 "O" 또는 "X". 단답(short)은 answer에 짧은 정답, accept에 같은 뜻의 다른 표현 배열.
3. 문항마다 concept(핵심 개념 1~3단어)과 explain(왜 정답인지 1~2문장, 자료 근거)을 써.
4. 쉬운 문제부터 어려운 문제 순서로. 자료 전체를 고르게 다뤄.
5. 중학생이 이해할 수 있는 말로.

[출력]
JSON만 출력해. 형식:
{"title":"시험지 제목","questions":[{"type":"mc","q":"문제","choices":["보기1","보기2","보기3","보기4"],"answer":1,"explain":"해설","concept":"개념","level":1}]}

[학습 자료]
{{자료}}`
  },
  rewind: {
    name: '오답 되감기', icon: 'route', when: '스터디 랩 · 채점 결과', tier: '빠른 모델', plan: 'pro',
    why: '틀린 문제를 그대로 다시 내면 답만 외워요. 같은 개념을 다른 각도로 묻는 변형 문제는 AI가 만들어요.',
    tpl:
`너는 '수행 내비'의 오답 코치야. 학생이 틀린 문제들의 개념을 다른 방식으로 다시 묻는 변형 문제를 만들어.

[틀린 문제]
{{오답}}

[규칙]
1. 문제마다 같은 개념을 다른 상황, 다른 표현으로 묻는 문제 2개씩. 원래 문제를 베끼지 마.
2. 형식과 규칙은 원래 시험지와 같아: mc는 보기 4개와 정답 번호, ox는 "O"/"X", short는 answer와 accept.
3. explain에는 학생이 왜 헷갈렸을지 한 문장을 덧붙여.

[출력]
JSON만 출력해. 형식:
{"title":"오답 되감기","questions":[{"type":"mc","q":"","choices":["","","",""],"answer":0,"explain":"","concept":"","level":2}]}`
  },
  conceptmap: {
    name: '개념 지도', icon: 'route', when: '스터디 랩 · 개념 지도', tier: '기본 모델', plan: 'performance',
    why: '개념 사이의 관계를 찾는 일은 글을 이해해야 해서 AI가 하고, 그림은 앱이 그려요.',
    tpl:
`너는 '수행 내비'의 개념 지도 도우미야. [학습 자료]의 핵심 개념과 관계를 정리해.

[규칙]
1. 가운데 개념 1개(center)와 연결된 개념 5~9개(nodes). 이름은 10자 이내.
2. 개념마다 note에 자료 근거로 한 문장 설명.
3. links는 두 개념 사이 관계를 짧은 말(예: "원인", "예시", "반대")로. from과 to는 node의 id 또는 "center".
4. 자료에 없는 개념은 넣지 마.

[출력]
JSON만 출력해. 형식:
{"center":{"label":"","note":""},"nodes":[{"id":"n1","label":"","note":""}],"links":[{"from":"center","to":"n1","label":""}]}

[학습 자료]
{{자료}}`
  },
  d30: {
    name: '시험 D-30 마스터플랜', icon: 'calendar', when: '스터디 랩 · 시험 플랜', tier: '기본 모델', plan: 'performance',
    why: '과목과 범위마다 공부 단계가 달라서 AI가 나누고, 날짜 배치는 역산 플래너가 해요.',
    tpl:
`너는 '수행 내비'의 시험 플래너야. 정기고사를 과목별 공부 단계로 나눠.

[시험]
{{시험}}

[규칙]
1. 과목마다 단계 4~6개. 개념 정리 → 문제 풀이 → 오답 정리 → 최종 점검처럼, 범위 크기에 맞게.
2. 단계마다 minutes(30~120)와 다 했는지 알 수 있는 done 기준 1줄.
3. 범위에 없는 내용은 넣지 마.

[출력]
JSON만 출력해. 형식:
{"subjects":[{"subject":"국어","steps":[{"name":"1단원 개념 정리","minutes":60,"done":"핵심 개념 10개를 백지에 써 보기"}]}]}`
  },
  selfcheck: {
    name: '루브릭 셀프 채점', icon: 'list', when: '수행 카드 · 멤버십 도구', tier: '기본 모델', plan: 'pro',
    why: '내 초안이 기준을 얼마나 채웠는지 읽고 판단하는 일이라 AI가 필요해요. 고쳐 쓰지는 않아요.',
    tpl:
`너는 '수행 내비'의 셀프 채점 도우미야. 학생이 쓴 초안이 채점 기준을 얼마나 채웠는지 점검해.

[원칙: 대신 해주지 않는 AI]
- 초안을 고쳐 쓰거나 새 문장을 써 주지 마. 빠진 점은 질문 형태로만 짚어.

[수행평가]
{{수행평가}}

[학생 초안]
{{초안}}

[규칙]
1. 기준마다 level은 "충족", "부분", "부족" 가운데 하나.
2. evidence에는 초안에서 근거가 되는 구절을 그대로 짧게 인용. 없으면 빈 문자열.
3. missing에는 더 채우려면 스스로 답해 볼 질문 1개.

[출력]
JSON만 출력해. 형식:
{"criteria":[{"original":"기준","level":"부분","evidence":"","missing":""}],"overall":"한 줄 총평"}`
  },
  questions: {
    name: '예상 질문 연습', icon: 'chat', when: '수행 카드 · 멤버십 도구', tier: '빠른 모델', plan: 'pro',
    why: '발표 주제와 기준을 읽고 선생님 입장에서 질문을 떠올리는 일은 언어 AI가 잘해요. 답은 학생이 준비해요.',
    tpl:
`너는 수행평가를 채점하는 선생님이야. 아래 발표·말하기 수행평가에서 학생에게 물어볼 만한 질문을 미리 뽑아.

[수행평가]
{{수행평가}}

[학생이 준비한 내용 메모]
{{메모}}

[규칙]
1. 질문 5개. 채점 기준과 연결되게.
2. why에는 이 질문으로 무엇을 확인하려는지, prep에는 학생이 준비해 둘 것(답이 아니라 준비 방향).
3. 모범 답안은 쓰지 마.

[출력]
JSON만 출력해. 형식:
{"questions":[{"q":"","why":"","prep":""}]}`
  },
  weekly: {
    name: 'AI 주간 리포트', icon: 'spark', when: '성장 리포트', tier: '빠른 모델', plan: 'performance',
    why: '숫자를 해석해서 다음 주에 조심할 점으로 바꾸는 일이라 AI가 해요.',
    tpl:
`너는 '수행 내비'의 학습 코치야. 학생의 한 주 기록을 보고 주간 리포트를 써. 말투: {{말투}}

[이번 주 기록]
{{기록}}

[규칙]
- 잘한 점 1개, 다음 주에 조심할 점 1개, 바로 할 행동 1개를 자연스럽게 5문장 이내로.
- 기록에 없는 일은 지어내지 마. 탓하는 말 금지. 텍스트만 출력해.`
  },
  priority: {
    name: '우선순위 협상', icon: 'flame', when: '투데이 · 몰림 경보', tier: '기본 모델', plan: 'performance',
    why: '마감, 남은 양, 반영 비율을 함께 따져 무엇부터 할지 정하는 판단이라 AI가 제안하고 학생이 정해요.',
    tpl:
`너는 '수행 내비'의 우선순위 코치야. 몰림 주를 앞둔 학생과 무엇부터 끝낼지 정해.

[몰린 수행평가]
{{목록}}

[쓸 수 있는 시간]
{{시간}}

[규칙]
1. plan에 수행평가마다 순서대로 action(먼저 끝낼 것, 미리 해 둘 것)과 why(마감·남은 양·반영 비율 근거)를 써.
2. 과제를 빼거나 대충 하라고 하지 마. 대신 미리 당겨 할 단계를 짚어.
3. message에 응원 한 문장.

[출력]
JSON만 출력해. 형식:
{"plan":[{"subject":"","action":"","why":""}],"message":""}`
  }
});
const fill = (tpl, vars) => tpl.replace(/\{\{(.+?)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const today = () => ymd(new Date());
const dow = s => parseYmd(s).getDay();
const mondayOf = s => addDays(s, -((dow(s) + 6) % 7));
const isWeekend = s => { const d = dow(s); return d === 0 || d === 6; };
const md = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
const mdShort = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdLong = s => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`; };
const mdMid = s => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`; };
const hm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const toMin = v => { const [h, m] = String(v || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const dur = m => m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ' ' + (m % 60) + '분' : ''}` : `${m}분`;
const dday = s => { const n = diffDays(today(), s); return n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`; };
const todayLabel = () => `${today()}(${WD[dow(today())]})`;
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'a') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const str = v => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const strs = v => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
const norm = v => String(v || '').replace(/\s+/g, '').toLowerCase();

/* ---------- examples (dates move with today) ---------- */
function anchors() {
  const t = today(), thisMon = mondayOf(t);
  let W = addDays(thisMon, 7), rel = '다음 주';
  if (diffDays(t, W) < 3) { W = addDays(thisMon, 14); rel = '다다음 주'; }
  const soon = addDays(t, diffDays(t, W) > 3 ? 3 : 2);
  return { t, W, rel, soon };
}
const step = (name, minutes, check) => ({ name, minutes, check, done: false, doneAt: null });
function seedCards() {
  const { W, soon } = anchors();
  const base = { example: true, source: 'example', checked: {}, checklist: null, steps: [], chat: [], photoIds: [], createdAt: Date.now() };
  return [
    { ...base, id: 'ex-math', subject: '수학', type: '포트폴리오', title: '자료의 정리와 해석 포스터', due: soon, dueTime: '23:59',
      method: '4절지 포스터를 찍어 구글 클래스룸에 업로드', materials: ['4절지', '색연필', '반 설문 결과'], weight: '10%',
      rubric: ['자료 수집: 설문 응답 20개 이상 (5점)', '도수분포표와 히스토그램의 정확성 (10점)', '해석: 자료에서 알 수 있는 사실 2가지 이상 (5점)'],
      steps: [step('설문 결과 정리', 30, '응답 20개 이상을 표로 옮김'), step('도수분포표 만들기', 40, '계급 5~7개로 나눠 표 완성'),
              step('히스토그램 그리기', 40, '4절지에 축과 눈금까지 그림'), step('해석 쓰고 기준 점검', 30, '알 수 있는 사실 2가지를 쓰고 체크리스트 확인')] },
    { ...base, id: 'ex-kor', subject: '국어', type: '발표', title: '시 낭송과 감상문', due: addDays(W, 1), dueTime: '3교시',
      method: '수업 시간에 낭송하고 감상문을 손글씨로 바로 제출', materials: ['교과서', '검정 볼펜'], weight: '20%',
      rubric: ['암송 정확성 (10점)', '표현력: 목소리 크기와 속도 (10점)', '감상문 내용: 시어 2개 이상 인용해 자기 경험과 연결 (20점)'],
      checklist: {
        criteria: [
          { original: '암송 정확성 (10점)', plain: '시를 보지 않고 틀리지 않게 끝까지 외워 말하는지 봐요.', checks: ['보지 않고 처음부터 끝까지 2번 연속 성공', '녹음해서 틀린 단어 0개 확인'], tip: '' },
          { original: '표현력: 목소리 크기와 속도 (10점)', plain: '교실 뒤까지 들리게, 너무 빠르지 않게 읽는지 봐요.', checks: ['교실 맨 뒤에서도 들리는 크기', '전체 50~70초 안에 끝내기', '연과 연 사이에 1초 쉬기'], tip: '선생님께 확인: 몸짓이나 표정도 점수에 들어가는지' },
          { original: '감상문 내용: 시어 2개 이상 인용해 자기 경험과 연결 (20점)', plain: '시에 나온 단어를 2개 이상 그대로 따와서 내 경험과 이어 쓰는지 봐요.', checks: ['시어 2개 이상을 따옴표로 인용', '인용한 시어마다 내 경험 1개씩 연결', 'A4 반쪽 분량을 손글씨로'], tip: '' }
        ],
        beforeSubmit: ['검정 볼펜으로 썼나요?', '이름과 번호를 적었나요?', '시어를 따옴표로 표시했나요?', '낭송 시간을 한 번 더 재 봤나요?']
      },
      steps: [step('시 고르고 소리 내어 읽기', 30, '후보 2편을 읽어 보고 1편 결정'), step('외우기 1차', 40, '보지 않고 절반까지 말하기'),
              step('외우기 2차와 녹음', 40, '끝까지 외워 녹음, 50~70초인지 확인'), step('감상문 개요', 30, '인용할 시어 2개와 연결할 내 경험 메모'),
              step('감상문 손글씨 연습', 40, 'A4 반쪽을 직접 한 번 써 보기'), step('채점 기준 점검', 20, '체크리스트 모두 확인')] },
    { ...base, id: 'ex-eng', subject: '영어', type: '말하기', title: '자기소개 말하기 2분', due: addDays(W, 3), dueTime: '5교시',
      method: '수업 중 선생님과 1:1 말하기', materials: [], weight: '15%',
      rubric: ['내용 구성: 소개, 경험, 앞으로의 계획 3부분 (10점)', '유창성: 2분 동안 끊기지 않고 말하기 (10점)', '정확성: 시제를 맞게 쓰기 (5점)'],
      steps: [step('말할 내용 3부분 메모', 30, '소개·경험·계획에 쓸 키워드 3개씩'), step('영어 문장으로 정리', 50, '내가 쓴 문장 12~15개, 시제 표시'),
              step('소리 내어 연습', 30, '메모 보며 처음부터 끝까지 2번'), step('녹음하고 시간 재기', 30, '메모 없이 1분 50초~2분 10초'),
              step('채점 기준 점검', 20, '체크리스트 모두 확인')] },
    { ...base, id: 'ex-soc', subject: '사회', type: '모둠 활동', title: '우리 지역 문제 모둠 신문', due: addDays(W, 15), dueTime: '',
      method: '모둠별 4절지 신문 제출, 수업 시간 3분 발표', materials: ['4절지', '지역 사진 자료'], weight: '20%',
      rubric: ['지역 문제를 구체적인 자료로 제시 (10점)', '원인과 해결 방안의 타당성 (10점)', '모둠원 역할 분담 기록 (5점)', '발표 전달력 (5점)'] }
  ];
}
function exampleChat() {
  const { rel } = anchors();
  return `[3학년 2반 단톡방]
반장: 📢 음악 수행 공지
반장: ${rel} 금요일 음악 시간에 가창 시험 봐요!!
반장: 교과서 가곡 중에 1곡 골라서 반주에 맞춰 부르기 (1절만)
반장: 채점은 음정·박자 10, 발성·호흡 5, 가사 암기 5, 표현 5 = 25점이고 학기 반영 15%래요
반장: 악보 보면서 부르면 감점이라 외워 와야 됨
친구: 악보 가져가도 돼??
반장: 들고는 와도 되는데 보면 감점`;
}
function fallbackFor(kind) {
  const { W } = anchors();
  if (kind === 'handout') return { subject: '과학', type: '보고서', title: '생활 속 산·염기 탐구 보고서', due: addDays(W, 2), dueTime: '23:59',
    method: "구글 클래스룸 '수행평가' 과제에 PDF 업로드", materials: ['리트머스 종이(과학실 대여)', '실험 과정 사진'],
    rubric: ['탐구 문제의 구체성 (10점)', '실험 설계와 변인 통제 (15점)', '표 또는 그래프로 결과 분석 1개 이상 (15점)', '결론과 탐구의 한계 서술 (10점)'],
    weight: '25%', uncertain: [{ field: 'due', why: '손글씨 동그라미가 날짜 일부를 가려요.' }] };
  return { subject: '음악', type: '실기', title: '가창 시험 (가곡 1곡)', due: addDays(W, 4), dueTime: '음악 시간',
    method: '음악 시간에 반주에 맞춰 1절 부르기', materials: [],
    rubric: ['음정·박자 (10점)', '발성·호흡 (5점)', '가사 암기 (5점)', '표현 (5점)'],
    weight: '15%', uncertain: [{ field: 'materials', why: '악보는 들고 와도 되지만 보면 감점이라 준비물인지 애매해요.' }] };
}
const defaultAcademies = () => [
  { id: 'ac1', label: '수학 학원', days: [1, 3, 5], start: 1080, end: 1260 },
  { id: 'ac2', label: '영어 학원', days: [2, 4], start: 1140, end: 1290 }
];

/* ---------- state ---------- */
function fresh() {
  return { v: 3, cards: seedCards(), settings: { ...DEF_SETTINGS, schoolEnd: DEF_SETTINGS.schoolEnd.slice() }, academies: defaultAcademies(),
           calendars: DEFAULT_CALS(), events: seedEvents(), school: DEFAULT_SCHOOL(),
           notif: { ...DEF_NOTIF }, inbox: [], fired: {}, snoozes: [],
           log: [], skips: [], chat: [], cheer: null, view: 'today', detail: null, detailTab: 'check',
           boardFilter: 'open', boardSubject: '', cal: { view: 'week', date: today(), q: '' }, rail: false,
           look: { ...DEF_LOOK }, plan: 'air', usage: { month: today().slice(0, 7), quiz: 0 },
           study: { sets: [], cards: [], maps: [] }, studyTab: 'make', timerLog: [], timer: null, pace: true,
           seasons: { active: 'term' }, reports: {} };
}
const DEF_LOOK = { style: 'liquid', glass: 70, blur: 24, round: 60, motion: 'smooth', ambient: true, theme: 'sunrise' };
function normalizeCard(a) {
  return { checked: {}, checklist: null, steps: [], chat: [], photoIds: [], materials: [], rubric: [], type: '', ...a,
           materials: strs(a.materials), rubric: strs(a.rubric), steps: Array.isArray(a.steps) ? a.steps : [],
           chat: Array.isArray(a.chat) ? a.chat : [], photoIds: Array.isArray(a.photoIds) ? a.photoIds : [] };
}
function load() {
  try {
    let raw = localStorage.getItem(KEY), migrated = false;
    if (!raw) { raw = localStorage.getItem(OLD_KEY); migrated = !!raw; }
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || (s.v !== 2 && s.v !== 3) || !Array.isArray(s.cards)) return null;
    const f = fresh();
    const arr = (v, d) => (Array.isArray(v) ? v : d);
    const out = { ...f, ...s, v: 3, settings: { ...f.settings, ...(s.settings || {}) }, cards: s.cards.map(normalizeCard),
      academies: arr(s.academies, f.academies), log: arr(s.log, []), skips: arr(s.skips, []), chat: arr(s.chat, []),
      calendars: arr(s.calendars, f.calendars), events: arr(s.events, migrated ? f.events : []), school: s.school && s.school.periods ? s.school : f.school,
      notif: { ...DEF_NOTIF, ...(s.notif || {}) }, inbox: arr(s.inbox, []), fired: s.fired && typeof s.fired === 'object' ? s.fired : {}, snoozes: arr(s.snoozes, []),
      cal: { ...f.cal, ...(s.cal || {}) },
      look: { ...DEF_LOOK, ...(s.look || {}), ...(s.settings && s.settings.solid && !s.look ? { style: 'simple' } : {}) },
      plan: ['air', 'pro', 'performance'].includes(s.plan) ? s.plan : 'air',
      usage: s.usage && s.usage.month ? s.usage : f.usage,
      study: { sets: arr(s.study && s.study.sets, []), cards: arr(s.study && s.study.cards, []), maps: arr(s.study && s.study.maps, []) },
      timerLog: arr(s.timerLog, []), seasons: s.seasons && s.seasons.active ? s.seasons : f.seasons, reports: s.reports || {} };
    for (const c of f.calendars) if (!out.calendars.some(x => x.id === c.id)) out.calendars.push(c);
    if (out.view === 'week') out.view = 'calendar';
    if (!Array.isArray(out.settings.schoolEnd) || out.settings.schoolEnd.length !== 5) out.settings.schoolEnd = DEF_SETTINGS.schoolEnd.slice();
    return out;
  } catch (e) { return null; }
}
const state = load() || fresh();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: keep working in memory */ }
}
const find = id => state.cards.find(a => a.id === id);
const skippedToday = () => state.skips.includes(today());

/* ---------- photos: masked copies only, kept on this device ---------- */
const PhotoStore = (() => {
  const mem = new Map(), urls = new Map();
  let dbp = null;
  const db = () => dbp || (dbp = new Promise(res => {
    try {
      const r = indexedDB.open('suhaeng-navi', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  }));
  async function put(id, blob) {
    mem.set(id, blob);
    const d = await db(); if (!d) return;
    await new Promise(res => { try { const tx = d.transaction('photos', 'readwrite'); tx.objectStore('photos').put(blob, id); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
  }
  async function get(id) {
    if (mem.has(id)) return mem.get(id);
    const d = await db(); if (!d) return null;
    return new Promise(res => {
      try { const rq = d.transaction('photos').objectStore('photos').get(id); rq.onsuccess = () => { if (rq.result) mem.set(id, rq.result); res(rq.result || null); }; rq.onerror = () => res(null); }
      catch (e) { res(null); }
    });
  }
  async function url(id) {
    if (urls.has(id)) return urls.get(id);
    const b = await get(id); if (!b) return null;
    const u = URL.createObjectURL(b); urls.set(id, u); return u;
  }
  async function del(id) {
    mem.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    const d = await db(); if (!d) return;
    try { d.transaction('photos', 'readwrite').objectStore('photos').delete(id); } catch (e) { /* ignore */ }
  }
  return { put, get, url, del };
})();

/* ---------- planner: AI splits the work, this code places it ---------- */
const capFor = date => (isWeekend(date) ? state.settings.weekendCap : state.settings.cap);
const dayStart = date => (isWeekend(date) ? state.settings.weekendStart : state.settings.schoolEnd[dow(date) - 1]);
/* time the planner must keep free: academies and the student's own timed events, each with travel */
function busyFor(date) {
  const st = state.settings, d = dow(date);
  const out = state.academies.filter(a => a.days.includes(d) && a.end > a.start).map(a => [a.start - st.travel, a.end + st.travel, a.label]);
  for (const ev of state.events) {
    if (ev.allDay || ev.start == null || ev.end == null) continue;
    if (occurrences(ev, date, date).length) out.push([ev.start - (ev.travel || 0), ev.end + (ev.travel || 0), ev.title]);
  }
  return out;
}
function freeIntervals(date, ignoreNow) {
  let s = dayStart(date);
  const e = state.settings.dayEnd;
  if (!ignoreNow && date === today()) s = Math.max(s, Math.ceil((nowMin() + 10) / 10) * 10);
  let iv = s < e ? [[s, e]] : [];
  for (const [bs, be] of busyFor(date)) {
    iv = iv.flatMap(([x, y]) => (be <= x || bs >= y) ? [[x, y]] : [[x, Math.min(y, bs)], [Math.max(x, be), y]].filter(([p, q]) => q - p > 0));
  }
  return iv.filter(([x, y]) => y - x >= 20);
}
function preferFocus(iv, date) {
  const f = FOCUS[state.settings.focus] || FOCUS.evening;
  if (f === FOCUS.morning && !isWeekend(date)) return iv;
  const [a, b] = f.range, pref = [], rest = [];
  for (const [x, y] of iv) {
    const s = Math.max(x, a), e = Math.min(y, b);
    if (e - s >= 20) { pref.push([s, e]); if (s - x >= 20) rest.push([x, s]); if (y - e >= 20) rest.push([e, y]); }
    else rest.push([x, y]);
  }
  return pref.concat(rest);
}
function weekCounts() {
  const t = today(), m = {};
  for (const a of state.cards) {
    if (!a.due || diffDays(t, a.due) < 0) continue;
    const k = mondayOf(a.due);
    (m[k] = m[k] || []).push(a);
  }
  return m;
}
function buildPlans() {
  const t = today();
  const from = skippedToday() ? addDays(t, 1) : t;
  const days = {};
  const getDay = date => days[date] || (days[date] = { iv: preferFocus(freeIntervals(date), date).map(x => x.slice()), left: capFor(date) });
  const capLeft = date => { const g = getDay(date); return Math.min(g.left, g.iv.reduce((n, [s, e]) => n + (e - s), 0)); };
  const wc = weekCounts();
  const plans = {};
  const pace = paceFactor();
  for (const a of state.cards.filter(c => c.due && c.steps.length).sort(byDue)) {
    const remaining = a.steps.map((s, i) => ({ ...s, i, minutes: pace === 1 ? s.minutes : Math.max(10, Math.round(s.minutes * pace / 10) * 10) })).filter(s => !s.done);
    const total = remaining.reduce((n, s) => n + s.minutes, 0);
    const p = { blocks: [], start: null, buffer: null, tight: false, unplaced: 0, total, factor: 1.5, usedBuffer: false };
    plans[a.id] = p;
    if (!remaining.length) { p.complete = true; continue; }
    const lastDay = addDays(a.due, -1);
    if (diffDays(from, lastDay) < 0) { p.late = true; p.unplaced = total; continue; }
    let lastWork = addDays(a.due, -2);
    if (diffDays(from, lastWork) < 0) lastWork = lastDay; else p.buffer = lastDay;
    p.factor = (wc[mondayOf(a.due)] || []).length >= 3 ? 2 : 1.5;
    const need = total * p.factor;
    // backward from the deadline: the latest start that still leaves the margin
    let start = lastWork, acc = 0;
    for (let d = lastWork; diffDays(from, d) >= 0; d = addDays(d, -1)) {
      acc += capLeft(d); start = d;
      if (acc >= need) break;
    }
    if (acc < need) p.tight = true;
    p.start = start;
    // forward placement, an even share per day so nothing is crammed into the first day
    const order = [];
    for (let d = start; diffDays(d, lastWork) >= 0; d = addDays(d, 1)) order.push(d);
    const workDays = order.length;
    if (p.buffer) order.push(p.buffer);
    const quota = Math.max(30, Math.ceil(total / workDays / 10) * 10);
    const usedHere = {};
    let di = 0;
    for (const s of remaining) {
      let left = s.minutes;
      const parts = [];
      while (left > 0 && di < order.length) {
        const d = order[di], g = getDay(d), min = Math.min(20, left);
        const room = di >= workDays - 1 ? Infinity : quota - (usedHere[d] || 0);
        const k = g.iv.findIndex(([x, y]) => y - x >= min);
        if (g.left < min || k < 0 || room < min) { di++; continue; }
        const [x, y] = g.iv[k];
        let chunk = Math.min(left, g.left, y - x, room);
        const rest = left - chunk;
        if (rest > 0 && rest < 20) {
          // never leave a sitting shorter than 20 minutes
          if (Math.min(left, g.left, y - x) === left) chunk = left;
          else if (chunk - (20 - rest) >= 20) chunk -= 20 - rest;
        }
        parts.push({ date: d, start: x, end: x + chunk, step: s.i, aid: a.id });
        usedHere[d] = (usedHere[d] || 0) + chunk;
        g.left -= chunk; left -= chunk;
        g.iv[k] = [x + chunk + 10, y];
        if (g.iv[k][1] - g.iv[k][0] < 20) g.iv.splice(k, 1);
        if (d === p.buffer) p.usedBuffer = true;
      }
      parts.forEach((b, n) => { b.part = n + 1; b.parts = parts.length; });
      p.blocks.push(...parts);
      p.unplaced += left;
    }
    if (p.unplaced) p.tight = true;
  }
  return plans;
}
/* 내 속도 보정: the median of actual/planned minutes from focus-timer sessions */
function paceFactor() {
  if (typeof has !== 'function' || !has('pace') || !state.pace) return 1;
  const r = state.timerLog.filter(l => l.planned > 0 && l.actual > 0).slice(-20).map(l => l.actual / l.planned).sort((a, b) => a - b);
  if (r.length < 3) return 1;
  return clamp(Math.round(r[Math.floor(r.length / 2)] * 100) / 100, 0.7, 1.6);
}
let PLANS = {};
const allBlocks = () => Object.values(PLANS).flatMap(p => p.blocks).sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
const stepOf = b => find(b.aid).steps[b.step];
function crunchWeeks() {
  const wc = weekCounts();
  return Object.keys(wc).sort().filter(k => wc[k].length >= 3).map(k => ({ monday: k, cards: wc[k].sort(byDue) }));
}
