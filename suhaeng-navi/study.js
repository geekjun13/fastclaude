'use strict';
/* 수행 내비 — 스터디 랩: textbook or notes in, a mock exam out; practice and exam modes,
   grading in the page, wrong-answer rewinds, flashcards with spaced review, concept maps,
   the D-30 exam plan and the weakness chart. AI writes questions; the page grades them. */

const studySrc = { text: '', images: [], subject: '', count: 10, level: '기본', kind: '섞기' };
let studyOpen = null;   // set id being solved
let run = null;         // {setId, mode, answers, startAt, endAt, submitted, result}
let flipIdx = 0, flipped = false;
let d30Draft = null;
const BOX_DAYS = [0, 1, 3, 7, 14, 30];
const EX_SOURCE = `[과학 3학년 · 산과 염기]
산은 수용액에서 수소 이온(H⁺)을 내놓는 물질이다. 산은 신맛이 나고, 푸른색 리트머스 종이를 붉게 바꾸며, 마그네슘 같은 금속과 반응하면 수소 기체가 생긴다. 염산, 아세트산(식초), 탄산음료 속 탄산이 산의 예이다.
염기는 수용액에서 수산화 이온(OH⁻)을 내놓는 물질이다. 염기는 쓴맛이 나고 만지면 미끈거리며, 붉은색 리트머스 종이를 푸르게 바꾼다. 페놀프탈레인 용액을 넣으면 붉게 변한다. 수산화 나트륨, 비눗물, 암모니아수가 염기의 예이다.
pH는 용액의 산성과 염기성의 정도를 나타내며 7이면 중성, 7보다 작으면 산성, 7보다 크면 염기성이다. 산과 염기를 섞으면 H⁺과 OH⁻이 만나 물이 생기는 중화 반응이 일어나고, 이때 열이 발생한다. 위산이 많을 때 제산제를 먹는 것과 벌에 쏘였을 때 암모니아수를 바르는 것은 중화 반응의 예이다.`;
const q_ = (type, q, extra, explain, concept, level) => ({ id: uid('q'), type, q, ...extra, explain, concept, level });
function exampleSet(count) {
  const qs = [
    q_('mc', '산의 공통적인 성질로 옳은 것은?', { choices: ['쓴맛이 난다', '푸른색 리트머스 종이를 붉게 바꾼다', '페놀프탈레인 용액을 붉게 바꾼다', '만지면 미끈거린다'], answer: 1 }, '산은 푸른색 리트머스 종이를 붉게 바꿔요. 나머지는 염기의 성질이에요.', '산의 성질', 1),
    q_('ox', '염기는 수용액에서 수산화 이온(OH⁻)을 내놓는다.', { answer: 'O' }, '염기의 정의 그대로예요.', '염기의 정의', 1),
    q_('short', 'pH가 7인 용액의 성질을 한 단어로 쓰시오.', { answer: '중성', accept: ['중성용액'] }, 'pH 7은 중성이에요.', 'pH', 1),
    q_('mc', '다음 중 염기에 해당하는 것은?', { choices: ['식초', '탄산음료', '비눗물', '염산'], answer: 2 }, '비눗물은 염기, 나머지는 산이에요.', '염기의 예', 1),
    q_('ox', '마그네슘을 염기 용액에 넣으면 수소 기체가 생긴다.', { answer: 'X' }, '금속과 반응해 수소 기체가 생기는 것은 산의 성질이에요.', '산의 성질', 2),
    q_('mc', 'pH 3인 용액에 대한 설명으로 옳은 것은?', { choices: ['중성이다', '염기성이다', '산성이다', '페놀프탈레인이 붉게 변한다'], answer: 2 }, 'pH가 7보다 작으면 산성이에요.', 'pH', 2),
    q_('short', '산과 염기를 섞을 때 H⁺과 OH⁻이 만나 물이 생기는 반응의 이름은?', { answer: '중화 반응', accept: ['중화반응', '중화'] }, '중화 반응이에요. 이때 열이 발생해요.', '중화 반응', 2),
    q_('mc', '중화 반응의 예로 알맞은 것은?', { choices: ['소금을 물에 녹인다', '위산이 많을 때 제산제를 먹는다', '얼음이 녹는다', '철이 녹슨다'], answer: 1 }, '제산제(염기)가 위산(산)을 중화해요.', '중화 반응', 2),
    q_('ox', '중화 반응이 일어나면 열을 흡수해 주변 온도가 내려간다.', { answer: 'X' }, '중화 반응에서는 열이 발생해요.', '중화 반응', 3),
    q_('short', '붉은색 리트머스 종이를 푸르게 바꾸는 물질의 종류는?', { answer: '염기', accept: ['염기성', '염기성 물질'] }, '염기가 붉은 리트머스를 푸르게 바꿔요.', '지시약', 3)
  ];
  return { id: uid('set'), title: '산과 염기 확인 시험', subject: '과학', kind: 'quiz', createdAt: Date.now(), source: EX_SOURCE.slice(0, 120), example: true, questions: qs.slice(0, count), attempts: [] };
}
function exampleMap() {
  return { id: uid('map'), title: '산과 염기', subject: '과학', at: today(), example: true, center: { label: '산과 염기', note: '수용액에서 내놓는 이온으로 구분해요.' },
    nodes: [{ id: 'n1', label: '산', note: 'H⁺을 내놓고 신맛, 푸른 리트머스를 붉게' }, { id: 'n2', label: '염기', note: 'OH⁻을 내놓고 쓴맛, 붉은 리트머스를 푸르게' },
      { id: 'n3', label: 'pH', note: '7 중성, 작으면 산성, 크면 염기성' }, { id: 'n4', label: '지시약', note: '리트머스, 페놀프탈레인으로 성질 확인' },
      { id: 'n5', label: '중화 반응', note: 'H⁺ + OH⁻ → 물, 열 발생' }, { id: 'n6', label: '생활 속 예', note: '제산제, 벌레 물린 데 암모니아수' }],
    links: [{ from: 'center', to: 'n1', label: '종류' }, { from: 'center', to: 'n2', label: '종류' }, { from: 'center', to: 'n3', label: '정도' }, { from: 'n4', to: 'n1', label: '확인' }, { from: 'n1', to: 'n5', label: '섞으면' }, { from: 'n2', to: 'n5', label: '섞으면' }, { from: 'n5', to: 'n6', label: '예시' }] };
}

/* ---------- cleaning + grading ---------- */
function cleanQuestions(r, max) {
  const list = r && Array.isArray(r.questions) ? r.questions : [];
  return list.filter(x => x && typeof x === 'object' && str(x.q)).slice(0, max).map(x => {
    const type = ['mc', 'ox', 'short'].includes(x.type) ? x.type : Array.isArray(x.choices) ? 'mc' : 'short';
    const base = { id: uid('q'), type, q: str(x.q), explain: str(x.explain), concept: str(x.concept) || '기타', level: clamp(+x.level || 1, 1, 3) };
    if (type === 'mc') { const ch = strs(x.choices).slice(0, 5); return ch.length >= 2 ? { ...base, choices: ch, answer: clamp(Math.round(+x.answer) || 0, 0, ch.length - 1) } : null; }
    if (type === 'ox') return { ...base, answer: /^x|아니|false/i.test(str(x.answer)) ? 'X' : 'O' };
    return { ...base, answer: str(x.answer), accept: strs(x.accept) };
  }).filter(Boolean);
}
const nrm = s => String(s == null ? '' : s).replace(/[\s.,·'"()\-]/g, '').toLowerCase();
function isRight(q, a) {
  if (a == null || a === '') return false;
  if (q.type === 'mc') return +a === q.answer;
  if (q.type === 'ox') return a === q.answer;
  return [q.answer, ...(q.accept || [])].some(x => nrm(x) && nrm(x) === nrm(a));
}
function gradeRun(set) {
  let score = 0; const wrong = [];
  for (const q of set.questions) { if (isRight(q, run.answers[q.id])) score++; else wrong.push(q.id); }
  return { score, total: set.questions.length, wrong };
}
const findSet = id => state.study.sets.find(s => s.id === id);

/* ---------- AI actions ---------- */
async function genQuiz() {
  const key = 'quiz';
  const text = studySrc.text.trim();
  if (!text && !studySrc.images.length) { errors[key] = '교과서나 필기 내용을 붙여넣거나 사진을 올려 주세요.'; render(); return; }
  if (quizLeft() <= 0) { errors[key] = `이번 달 시험지 ${AIR_QUIZ_LIMIT}회를 모두 만들었어요. 다음 달에 다시 채워져요.`; render(); return; }
  const max = has('workbook') ? 30 : 10, count = clamp(+studySrc.count || 10, 3, max);
  let set = null;
  if (!aiReady()) {
    if (text === EX_SOURCE.trim() && !studySrc.images.length) set = exampleSet(Math.min(10, count));
    else { errors[key] = aiOffText() + ' 예시 자료는 미리 만든 시험지로 볼 수 있어요.'; render(); return; }
  } else {
    if (studySrc.images.length && !imageLimits) { errors[key] = ERR.images_unavailable; render(); return; }
    const prompt = fill(P.quiz.tpl, { '과목': studySrc.subject || '자료에서 판단', '문항수': count, '난이도': has('workbook') ? studySrc.level : '기본', '유형': studySrc.kind,
      '자료': (studySrc.images.length ? `(교과서·필기 사진 ${studySrc.images.length}장 첨부)\n` : '') + text.slice(0, 30000) });
    const opts = studySrc.images.length ? { images: studySrc.images.map(x => x.blob) } : {};
    const r = await runAI(key, signal => sample.json(prompt, { ...opts, signal, cache: false, modelTier: count > 10 ? 'default' : 'quick' }));
    if (!r) return;
    const qs = cleanQuestions(r, count);
    if (!qs.length) { errors[key] = 'AI 답에서 문제를 찾지 못했어요. 자료를 조금 더 넣어 다시 해 보세요.'; render(); return; }
    set = { id: uid('set'), title: str(r.title) || `${studySrc.subject || '내'} 시험지`, subject: studySrc.subject || '공부', kind: count > 10 ? 'book' : 'quiz', createdAt: Date.now(), source: text.slice(0, 120), questions: qs, attempts: [] };
    if (!has('workbook')) state.usage.quiz++;
  }
  state.study.sets.unshift(set);
  openSet(set.id);
  save(); render(); goTop();
  toast(`${set.questions.length}문항 시험지를 만들었어요`);
}
async function genRewind(setId) {
  const set = findSet(setId), last = set && set.attempts[set.attempts.length - 1];
  if (!set || !last || !last.wrong.length || !has('rewind')) return;
  const wrongQs = set.questions.filter(q => last.wrong.includes(q.id));
  const list = wrongQs.map(q => `- [${q.concept}] ${q.q}${q.type === 'mc' ? ' / 보기: ' + q.choices.join(', ') : ''} / 정답: ${q.type === 'mc' ? q.choices[q.answer] : q.answer}`).join('\n');
  let qs;
  if (!aiReady()) qs = wrongQs.map(q => ({ ...q, id: uid('q') }));
  else {
    const r = await runAI('rewind', signal => sample.json(fill(P.rewind.tpl, { '오답': list }), { signal, cache: false, modelTier: 'quick' }));
    if (!r) return;
    qs = cleanQuestions(r, 12);
  }
  if (!qs.length) { errors.rewind = '변형 문제를 만들지 못했어요. 다시 눌러 주세요.'; render(); return; }
  const ns = { id: uid('set'), title: `${set.title} · 오답 되감기`, subject: set.subject, kind: 'rewind', createdAt: Date.now(), source: set.source, questions: qs, attempts: [] };
  state.study.sets.unshift(ns); openSet(ns.id); save(); render(); goTop();
  toast(aiReady() ? '틀린 개념으로 변형 문제를 만들었어요' : 'AI가 없어서 틀린 문제를 다시 모았어요');
}
async function genMap() {
  const text = studySrc.text.trim();
  if (!has('conceptmap')) return;
  if (!text) { errors.map = '개념 지도는 글 자료로 그려요. 교과서 내용을 붙여넣어 주세요.'; render(); return; }
  let m = null;
  if (!aiReady()) { if (text === EX_SOURCE.trim()) m = exampleMap(); else { errors.map = aiOffText(); render(); return; } }
  else {
    const r = await runAI('map', signal => sample.json(fill(P.conceptmap.tpl, { '자료': text.slice(0, 20000) }), { signal, cache: false }));
    if (!r || !r.center) return;
    const nodes = (Array.isArray(r.nodes) ? r.nodes : []).filter(n => n && n.label).slice(0, 9).map((n, i) => ({ id: str(n.id) || 'n' + i, label: str(n.label).slice(0, 12), note: str(n.note) }));
    const ids = new Set(['center', ...nodes.map(n => n.id)]);
    m = { id: uid('map'), title: str(r.center.label) || '개념 지도', subject: studySrc.subject || '', at: today(), center: { label: str(r.center.label).slice(0, 12), note: str(r.center.note) }, nodes,
      links: (Array.isArray(r.links) ? r.links : []).filter(l => l && ids.has(str(l.from)) && ids.has(str(l.to))).map(l => ({ from: str(l.from), to: str(l.to), label: str(l.label).slice(0, 8) })) };
  }
  state.study.maps.unshift(m); state.studyTab = 'map'; save(); render(); toast('개념 지도를 그렸어요');
}
async function genD30() {
  const f = d30Draft; if (!f || !has('d30')) return;
  const rows = f.rows.filter(r => r.subject.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || diffDays(today(), f.date) < 2) { errors.d30 = '시험 날짜를 오늘로부터 2일 뒤 이후로 골라 주세요.'; render(); return; }
  if (!rows.length) { errors.d30 = '과목을 하나 이상 적어 주세요.'; render(); return; }
  let subjects = null;
  if (aiReady()) {
    const exam = `${f.name} · ${mdMid(f.date)} (${dday(f.date)})\n` + rows.map(r => `- ${r.subject}: ${r.range || '범위 미정'}`).join('\n');
    const r = await runAI('d30', signal => sample.json(fill(P.d30.tpl, { '시험': exam }), { signal, cache: false }));
    if (r && Array.isArray(r.subjects)) subjects = r.subjects.map(s => ({ subject: str(s.subject), steps: cleanSteps(s) })).filter(s => s.subject && s.steps.length);
    if (!r) return;
  }
  if (!subjects || !subjects.length) subjects = rows.map(r => ({ subject: r.subject.trim(), steps: [step('개념 정리', 60, '범위의 핵심 개념을 백지에 써 보기'), step('기본 문제 풀이', 60, '교과서·학습지 문제 다시 풀기'), step('심화 문제 풀이', 60, '틀린 유형을 한 번 더'), step('오답 정리', 40, '오답 노트 한 장'), step('최종 점검', 30, '전날 훑어보기 목록 만들기')] }));
  for (const s of subjects) {
    const range = (rows.find(r => r.subject.trim() === s.subject) || {}).range || '';
    state.cards.push(normalizeCard({ id: uid(), source: 'exam', subject: s.subject, type: '시험형', title: `${f.name} 대비`, due: f.date, dueTime: '', method: '정기고사', materials: [], weight: '', rubric: range ? [`시험 범위: ${range}`] : [], steps: s.steps, createdAt: Date.now() }));
  }
  d30Draft = null; save(); render();
  toast(`${subjects.length}과목 공부 단계를 캘린더에 배치했어요`);
}

/* ---------- views ---------- */
function openSet(id) { studyOpen = id; run = { setId: id, mode: 'practice', answers: {}, startAt: Date.now(), submitted: false, result: null }; state.studyTab = 'sets'; }
function qHtml(q, i, done) {
  const a = run.answers[q.id], right = done && isRight(q, a);
  let body = '';
  if (q.type === 'mc') body = `<div class="choices">${q.choices.map((c, j) => `<button class="choice${+a === j && a !== undefined ? ' on' : ''}${done && j === q.answer ? ' correct' : ''}${done && +a === j && j !== q.answer ? ' wrong' : ''}" data-act="ans" data-arg="${q.id}|${j}" ${done ? 'disabled' : ''}><i>${'①②③④⑤'[j]}</i><span>${esc(c)}</span></button>`).join('')}</div>`;
  else if (q.type === 'ox') body = `<div class="ox">${['O', 'X'].map(v => `<button class="oxb${a === v ? ' on' : ''}${done && v === q.answer ? ' correct' : ''}${done && a === v && v !== q.answer ? ' wrong' : ''}" data-act="ans" data-arg="${q.id}|${v}" ${done ? 'disabled' : ''}>${v}</button>`).join('')}</div>`;
  else body = `<input class="input" id="qa-${q.id}" data-qa="${q.id}" value="${esc(a || '')}" placeholder="정답을 적어요" ${done ? 'disabled' : ''}>${done && !right ? `<p class="small"><b>정답</b> ${esc(q.answer)}</p>` : ''}`;
  return `<article class="qcard cell${done ? (right ? ' is-right' : ' is-wrong') : ''}" id="q-${i + 1}">
    <div class="q-top"><span class="qn num">${i + 1}</span><span class="chip">${esc(q.concept)}</span><span class="chip">${'★'.repeat(q.level)}</span>${done ? `<span class="chip ${right ? 'green' : 'orange'}">${right ? '정답' : '오답'}</span>` : ''}</div>
    <p class="q-text">${esc(q.q)}</p>${body}${done && q.explain ? `<div class="explain">${logoMark(18)}<span>${esc(q.explain)}</span></div>` : ''}</article>`;
}
function runnerHtml(set) {
  const done = run.submitted, exam = run.mode === 'exam';
  const answered = set.questions.filter(q => run.answers[q.id] !== undefined && run.answers[q.id] !== '').length;
  const best = set.attempts.length ? Math.max(...set.attempts.map(x => x.score)) : null;
  const seg = `<div class="seg" data-seg="runmode" role="group"><button data-act="runMode" data-arg="practice" aria-pressed="${!exam}">연습</button>${has('exam') ? `<button data-act="runMode" data-arg="exam" aria-pressed="${exam}">실전 모의고사</button>` : ''}</div>`;
  if (exam && !run.endAt && !done) {
    const mins = set.questions.length + 2;
    return `<button class="btn btn-soft btn-sm back" data-act="setClose">${icon('back')}시험지 목록</button>
      <div class="row-sb"><h2 class="st-title">${esc(set.title)}</h2>${seg}</div>
      <div class="cell pad-l stack exam-start">${logoMark(54)}<b>실전 모의고사</b><p class="muted">제한 시간 <b class="num">${mins}분</b> · ${set.questions.length}문항 · OMR 답안지로 풀어요. 시간이 끝나면 자동으로 제출돼요.</p><button class="btn btn-pri" data-act="examStart" data-arg="${mins}">${icon('clock')}시작하기</button></div>`;
  }
  const res = run.result;
  const summary = done && res ? `<div class="result cell pad-l">${ring(res.score / res.total, set.subject, '점수')}<div style="flex:1;min-width:0"><b class="num" style="font-size:26px">${res.score} / ${res.total}</b><p class="small muted">${res.score === res.total ? '모두 맞았어요!' : `틀린 개념: ${[...new Set(set.questions.filter(q => res.wrong.includes(q.id)).map(q => q.concept))].join(', ')}`}${run.time ? ` · ${Math.max(1, Math.round(run.time / 60000))}분 걸림` : ''}</p></div>
      ${busyRow('rewind')}${errRow('rewind')}<div class="row">${res.wrong.length && has('rewind') && !busy.rewind ? `<button class="btn btn-pri btn-sm" data-act="rewind" data-arg="${set.id}">${icon('route')}오답 되감기</button>` : ''}${res.wrong.length && has('cards') ? `<button class="btn btn-line btn-sm" data-act="toCards" data-arg="${set.id}">${icon('board')}오답 카드로</button>` : ''}<button class="btn btn-soft btn-sm" data-act="runRetry">다시 풀기</button></div></div>${busyRow('rewind')}${errRow('rewind')}` : '';
  const timer = exam && run.endAt && !done ? `<div class="exam-bar glass" id="exam-bar"><span>${icon('clock')}남은 시간 <b class="num" id="exam-left">--:--</b></span><span class="small">${answered}/${set.questions.length} 답함</span><button class="btn btn-pri btn-sm" data-act="runSubmit">제출</button></div>` : '';
  const omr = exam && run.endAt && !done ? `<aside class="omr cell"><b class="small">OMR 답안지</b>${set.questions.map((q, i) => `<a class="omr-row" href="#q-${i + 1}"><span class="num">${i + 1}</span>${q.type === 'mc' ? q.choices.map((c, j) => `<i class="${+run.answers[q.id] === j && run.answers[q.id] !== undefined ? 'on' : ''}">${j + 1}</i>`).join('') : `<em>${esc(run.answers[q.id] || '—')}</em>`}</a>`).join('')}</aside>` : '';
  return `<button class="btn btn-soft btn-sm back" data-act="setClose">${icon('back')}시험지 목록</button>
    <div class="row-sb"><div><h2 class="st-title">${esc(set.title)}</h2><p class="small faint">${tag(set.subject)} ${set.questions.length}문항${best != null ? ` · 최고 ${best}점` : ''}${set.example ? ' · 예시' : ''}</p></div>${done ? '' : seg}</div>
    ${timer}${summary}
    <div class="${omr ? 'exam-grid' : ''}"><div class="stack">${set.questions.map((q, i) => qHtml(q, i, done)).join('')}</div>${omr}</div>
    ${done ? '' : `<div class="row-sb"><span class="small faint">${answered}/${set.questions.length}문항 답함</span><button class="btn btn-pri" data-act="runSubmit">${icon('check')}채점하기</button></div>`}`;
}
function makeTab() {
  const accept = imageLimits ? imageLimits.mediaTypes.join(',') : 'image/*';
  const counts = has('workbook') ? [5, 10, 20, 30] : [5, 10];
  const left = quizLeft();
  return `<section class="sec"><div class="cell pad-l stack">
      <div class="row-sb"><b>${icon('book')} 학습 자료</b><div class="row"><button class="pill-btn" data-act="exSource">${icon('spark')}예시: 산과 염기</button><label class="btn btn-line btn-sm" for="study-file">${icon('image')}사진</label><input id="study-file" type="file" accept="${esc(accept)}" multiple hidden></div></div>
      <textarea class="input" id="study-text" data-bind="studyText" rows="7" placeholder="교과서 단원, 학습지, 필기 내용을 붙여넣어요. 이 내용 안에서만 문제를 내요.">${esc(studySrc.text)}</textarea>
      ${studySrc.images.length ? `<div class="thumbs">${studySrc.images.map((x, i) => `<div class="thumb"><img src="${x.url}" alt="${esc(x.name)}"><button data-act="studyImgDel" data-arg="${i}" aria-label="사진 빼기">×</button></div>`).join('')}</div>` : ''}
      <div class="grid g4">
        <label class="field"><span>과목</span><input class="input" id="study-subject" data-bind="studySubject" value="${esc(studySrc.subject)}" placeholder="예: 과학"></label>
        <label class="field"><span>문항 수</span><select class="input" id="study-count" data-bind="studyCount">${counts.map(n => `<option ${+studySrc.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        ${has('workbook') ? `<label class="field"><span>난이도</span><select class="input" id="study-level" data-bind="studyLevel">${['기본', '심화', '섞기'].map(v => `<option ${studySrc.level === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
        <label class="field"><span>유형</span><select class="input" id="study-kind" data-bind="studyKind">${['섞기', '객관식만', 'OX만', '단답형만'].map(v => `<option ${studySrc.kind === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
      <div class="row-sb"><span class="small faint">${Number.isFinite(left) ? `이번 달 남은 생성 ${left}회` : '무제한 생성'} · 채점은 이 기기에서 해요</span>
        <div class="row">${has('conceptmap') ? aiBtn('map', '개념 지도 그리기', 'genMap', '', 'btn-line', 'route') : ''}<button class="btn btn-pri" data-act="genQuiz" ${busy.quiz ? 'disabled' : ''}>${icon('spark')}${has('workbook') && +studySrc.count > 10 ? '문제집 만들기' : '시험지 만들기'}</button></div></div>
      ${aiReady() ? '' : `<p class="small faint">${esc(aiOffText())} 예시 자료는 미리 만든 시험지로 볼 수 있어요.</p>`}
      ${busyRow('quiz')}${errRow('quiz')}${busyRow('map')}${errRow('map')}
    </div></section>
    <section class="sec"><div class="sec-h"><h2>${icon('list')} 이렇게 만들어져요</h2></div>
      <div class="flow">${[['book', '자료 넣기', '교과서·필기 글이나 사진'], ['spark', 'AI 출제', '자료 안에서만, 개념별로'], ['check', '풀고 채점', '정답과 해설은 기기에서'], ['route', '다시 잡기', has('rewind') ? '오답 되감기·복습 카드' : '틀린 문제 다시 풀기']].map(([ic, t, d], i) => `<div class="flow-i cell"><span class="ni-ico hue" style="--h:${[44, 214, 152, 330][i]}">${icon(ic)}</span><b>${t}</b><small>${d}</small></div>`).join('')}</div></section>`;
}
function setsTab() {
  if (studyOpen && findSet(studyOpen)) return runnerHtml(findSet(studyOpen));
  const sets = state.study.sets;
  if (!sets.length) return `<div class="cell dash empty">${emptyArt()}<b>아직 만든 시험지가 없어요</b><p class="small muted">만들기 탭에서 교과서 내용을 넣으면 시험지가 생겨요.</p><button class="btn btn-pri btn-sm" data-act="studyTab" data-arg="make">${icon('spark')}시험지 만들기</button></div>`;
  return `<div class="cards">${sets.map(s => { const best = s.attempts.length ? Math.max(...s.attempts.map(x => x.score)) : null; return `<div class="scard cell hue" style="${hueVar(s.subject)}" role="button" tabindex="0" data-act="setOpen" data-arg="${s.id}">
    <div class="scard-top">${tile(s.subject)}<div class="meta"><small>${esc(s.subject)} · ${{ quiz: '시험지', book: '문제집', rewind: '오답 되감기' }[s.kind] || '시험지'}</small><span class="small faint num">${md(ymd(new Date(s.createdAt)))} · ${s.questions.length}문항</span></div>${best != null ? `<span class="dday ${best === s.questions.length ? 'done' : ''}">${best}/${s.questions.length}</span>` : '<span class="chip">안 풂</span>'}</div>
    <div class="scard-title">${esc(s.title)}</div>
    <div class="scard-foot">${ring(best != null ? best / s.questions.length : 0, s.subject, '최고 점수')}<div style="flex:1" class="small muted">${s.attempts.length ? `${s.attempts.length}번 풀었어요` : '아직 풀지 않았어요'}</div><button class="btn btn-soft btn-icon btn-sm" data-act="setDel" data-arg="${s.id}" aria-label="시험지 삭제">${confirmKey === 'set:' + s.id ? icon('check') : icon('trash')}</button></div></div>`; }).join('')}</div>`;
}
function cardsTab() {
  const t = today(), due = state.study.cards.filter(c => diffDays(c.due, t) >= 0);
  const boxes = [1, 2, 3, 4, 5].map(b => state.study.cards.filter(c => c.box === b).length);
  if (!state.study.cards.length) return `<div class="cell dash empty">${emptyArt()}<b>복습 카드가 없어요</b><p class="small muted">시험지를 채점한 뒤 '오답 카드로'를 누르면 틀린 문제가 카드가 돼요.</p></div>`;
  const c = due[flipIdx % Math.max(1, due.length)];
  return `<div class="row">${boxes.map((n, i) => `<span class="chip${i === 0 ? ' orange' : i === 4 ? ' green' : ''}">${i + 1}단계 ${n}장</span>`).join('')}<span class="small faint">알면 다음 단계로, 다음 복습은 ${BOX_DAYS.slice(1).join('·')}일 뒤</span></div>
    ${c ? `<div class="flip${flipped ? ' on' : ''}" data-act="flip" role="button" tabindex="0" aria-label="카드 뒤집기"><div class="flip-in"><div class="face front cell"><span class="chip">${esc(c.concept)}</span><p>${esc(c.front)}</p><small class="faint">눌러서 뒤집기</small></div><div class="face back cell"><span class="chip green">정답</span><p>${esc(c.back)}</p></div></div></div>
      <div class="row-end"><span class="small faint">오늘 남은 카드 ${due.length}장</span><button class="btn btn-line" data-act="cardAgain" data-arg="${c.id}">다시 볼래요</button><button class="btn btn-pri" data-act="cardKnow" data-arg="${c.id}">${icon('check')}알았어요</button></div>`
      : `<div class="cell pad-l empty">${logoMark(54)}<b>오늘 복습을 모두 끝냈어요</b><p class="small muted">다음 카드는 ${md(state.study.cards.map(x => x.due).sort()[0])}에 돌아와요.</p></div>`}`;
}
function mapSvg(m) {
  const W = 680, H = 420, cx = W / 2, cy = H / 2, n = m.nodes.length;
  const pos = { center: { x: cx, y: cy } };
  m.nodes.forEach((nd, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, n); pos[nd.id] = { x: cx + Math.cos(a) * 250, y: cy + Math.sin(a) * 150 }; });
  const box = (x, y, label, cls) => { const w = Math.max(64, label.length * 15 + 26); return `<g class="${cls}"><rect x="${x - w / 2}" y="${y - 18}" width="${w}" height="36" rx="18"/><text x="${x}" y="${y + 5}" text-anchor="middle">${esc(label)}</text></g>`; };
  const lines = m.links.map(l => { const a = pos[l.from], b = pos[l.to]; if (!a || !b) return ''; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="cm-line"/>${l.label ? `<text x="${mx}" y="${my - 4}" class="cm-lbl" text-anchor="middle">${esc(l.label)}</text>` : ''}`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="cm-svg" role="img" aria-label="${esc(m.title)} 개념 지도">${lines}${m.nodes.map(nd => box(pos[nd.id].x, pos[nd.id].y, nd.label, 'cm-node')).join('')}${box(cx, cy, m.center.label, 'cm-center')}</svg>`;
}
function mapTab() {
  const m = state.study.maps[0];
  if (!m) return `<div class="cell dash empty">${emptyArt()}<b>아직 그린 개념 지도가 없어요</b><p class="small muted">만들기 탭에 교과서 내용을 넣고 '개념 지도 그리기'를 눌러요.</p><button class="btn btn-pri btn-sm" data-act="studyTab" data-arg="make">자료 넣으러 가기</button></div>`;
  return `<div class="row-sb"><h3>${esc(m.title)}</h3>${state.study.maps.length > 1 ? `<span class="small faint">지도 ${state.study.maps.length}개 · 가장 최근 것</span>` : ''}</div>
    <div class="cmap cell">${mapSvg(m)}</div>
    <div class="grid g3">${[{ label: m.center.label, note: m.center.note }, ...m.nodes].map(nd => `<div class="cell pad"><b>${esc(nd.label)}</b><p class="small muted">${esc(nd.note)}</p></div>`).join('')}</div>`;
}
function planTab() {
  const f = d30Draft || (d30Draft = { name: '2학기 기말고사', date: addDays(today(), 30), rows: [{ subject: '국어', range: '' }, { subject: '수학', range: '' }, { subject: '영어', range: '' }] });
  const exams = state.cards.filter(a => a.source === 'exam' && a.due && diffDays(today(), a.due) >= 0);
  return `<div class="cell pad-l stack">
    <div class="grid g2"><label class="field"><span>시험 이름</span><input class="input" id="d30-name" data-d30="name" value="${esc(f.name)}"></label><label class="field"><span>시험 첫날</span><input class="input" type="date" id="d30-date" data-d30="date" value="${f.date}"></label></div>
    <div class="stack-s">${f.rows.map((r, i) => `<div class="row" style="flex-wrap:nowrap"><input class="input" style="max-width:150px" id="d30-s-${i}" data-d30r="${i}:subject" value="${esc(r.subject)}" placeholder="과목"><input class="input" id="d30-r-${i}" data-d30r="${i}:range" value="${esc(r.range)}" placeholder="범위 · 예: 1~3단원, 교과서 12~80쪽"><button class="btn btn-soft btn-icon btn-sm" data-act="d30Del" data-arg="${i}" aria-label="과목 빼기">${icon('x')}</button></div>`).join('')}</div>
    <div class="row-sb"><button class="btn btn-soft btn-sm" data-act="d30Add">${icon('plus')}과목 추가</button><button class="btn btn-pri" data-act="genD30">${icon('calendar')}D-${Math.max(0, diffDays(today(), f.date))} 플랜 만들기</button></div>
    <p class="small faint">과목마다 공부 단계를 만들어 수행 카드로 저장하고, 역산 플래너가 학원과 수행평가를 피해 캘린더에 배치해요.</p>${busyRow('d30')}${errRow('d30')}</div>
    ${exams.length ? `<div class="cards">${exams.map(scard).join('')}</div>` : ''}`;
}
function weakTab() {
  const stat = {};
  for (const s of state.study.sets) for (const at of s.attempts) for (const q of s.questions) {
    const k = q.concept || '기타', g = stat[k] = stat[k] || { ok: 0, n: 0, subject: s.subject };
    g.n++; if (!at.wrong.includes(q.id)) g.ok++;
  }
  const rows = Object.entries(stat).map(([k, g]) => ({ k, ...g, pct: Math.round(g.ok / g.n * 100) })).sort((a, b) => a.pct - b.pct || b.n - a.n).slice(0, 10);
  if (!rows.length) return `<div class="cell dash empty">${emptyArt()}<b>채점한 시험지가 쌓이면 약점이 보여요</b></div>`;
  return `<div class="cell pad-l stack"><div class="row-sb"><b>개념별 정답률</b><span class="small faint">낮은 순 · 시험지 ${state.study.sets.filter(s => s.attempts.length).length}개 기준</span></div>
    <div class="weak">${rows.map(r => `<div class="wk-row" title="${esc(r.k)} · ${r.ok}/${r.n} 정답 (${r.pct}%)"><span class="wk-k">${esc(r.k)}<small>${esc(r.subject)}</small></span><span class="wk-bar"><i style="width:${Math.max(2, r.pct)}%"></i></span><span class="num wk-v">${r.pct}%</span></div>`).join('')}</div>
    <p class="small faint">${rows[0].pct < 70 ? `가장 약한 개념은 '${esc(rows[0].k)}'이에요. 만들기 탭에서 이 부분 자료만 넣어 시험지를 다시 만들어 보세요.` : '모든 개념이 70% 이상이에요.'}</p></div>`;
}
function viewStudy() {
  const tabs = [['make', '만들기'], ['sets', '내 시험지'], ...(has('cards') ? [['cards', '복습 카드']] : []), ...(has('conceptmap') ? [['map', '개념 지도']] : []), ...(has('d30') ? [['plan', '시험 플랜']] : []), ...(has('radar') ? [['weak', '약점 레이더']] : [])];
  const tab = tabs.some(t => t[0] === state.studyTab) ? state.studyTab : 'make';
  const atts = state.study.sets.flatMap(s => s.attempts);
  const avg = atts.length ? Math.round(atts.reduce((n, x) => n + x.score / x.total, 0) / atts.length * 100) : null;
  const dueCards = state.study.cards.filter(c => diffDays(c.due, today()) >= 0).length;
  const body = { make: makeTab, sets: setsTab, cards: cardsTab, map: mapTab, plan: planTab, weak: weakTab }[tab]();
  return {
    title: '스터디 랩', sub: '교과서와 필기로 시험지를 만들어 풀고, 틀린 곳을 다시 잡아요',
    body: `<section class="hero study-hero rise"><div><div class="eyebrow">STUDY LAB</div><h2>교과서로 <em>모의 시험지</em>를 만들어요</h2><p>넣은 자료 안에서만 출제하고, 채점과 해설은 바로 보여 줘요.</p>
        <div class="hero-stats"><span>시험지 <b>${state.study.sets.length}</b>개</span><span>평균 정답률 <b>${avg != null ? avg + '%' : '—'}</b></span>${has('cards') ? `<span>오늘 복습 <b>${dueCards}</b>장</span>` : ''}</div></div>${logoMark(92, 'hero-logo')}</section>
      <div class="seg" data-seg="study" role="group" aria-label="스터디 랩">${tabs.map(([k, l]) => `<button data-act="studyTab" data-arg="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
      ${body}`,
    after() { if (run && run.endAt && !run.submitted) examTick(); }
  };
}
let examT = null;
function examTick() {
  clearInterval(examT);
  const upd = () => {
    if (!run || !run.endAt || run.submitted) { clearInterval(examT); return; }
    const left = run.endAt - Date.now(), el = document.getElementById('exam-left');
    if (left <= 0) { clearInterval(examT); STUDY_H.runSubmit(); toast('시간이 끝나 자동으로 제출했어요'); return; }
    if (el) el.textContent = `${pad(Math.floor(left / 60000))}:${pad(Math.floor(left / 1000) % 60)}`;
  };
  upd(); examT = setInterval(upd, 1000);
}

const STUDY_H = {
  studyTab(k) { state.studyTab = k; if (k !== 'sets') studyOpen = null; else if (studyOpen && !findSet(studyOpen)) studyOpen = null; save(); render(); },
  exSource() { studySrc.text = EX_SOURCE; studySrc.subject = '과학'; errors.quiz = null; render(); },
  studyImgDel(i) { const x = studySrc.images.splice(+i, 1)[0]; if (x) URL.revokeObjectURL(x.url); render(); },
  genQuiz() { genQuiz(); },
  genMap() { genMap(); },
  genD30() { genD30(); },
  d30Add() { if (d30Draft) { d30Draft.rows.push({ subject: '', range: '' }); render(); } },
  d30Del(i) { if (d30Draft) { d30Draft.rows.splice(+i, 1); render(); } },
  setOpen(id) { withTransition(() => { openSet(id); render(); goTop(); }, 1); },
  setClose() { withTransition(() => { studyOpen = null; run = null; render(); goTop(); }, -1); },
  setDel(id) { if (confirmKey !== 'set:' + id) { arm('set:' + id); return; } confirmKey = null; state.study.sets = state.study.sets.filter(s => s.id !== id); save(); render(); },
  ans(arg) {
    if (!run || run.submitted) return;
    const k = arg.lastIndexOf('|'), id = arg.slice(0, k), v = arg.slice(k + 1);
    const set = findSet(run.setId), q = set && set.questions.find(x => x.id === id);
    if (!q) return;
    run.answers[id] = q.type === 'mc' ? +v : v;
    render();
  },
  runMode(m) { if (!run) return; run.mode = m; run.endAt = null; run.answers = {}; render(); },
  examStart(mins) { if (!run) return; run.startAt = Date.now(); run.endAt = Date.now() + (+mins) * 60000; render(); goTop(); },
  runSubmit() {
    const set = run && findSet(run.setId); if (!set || run.submitted) return;
    run.result = gradeRun(set); run.submitted = true; run.time = Date.now() - run.startAt; clearInterval(examT);
    set.attempts.push({ at: today(), score: run.result.score, total: run.result.total, wrong: run.result.wrong, mode: run.mode });
    save(); render(); goTop();
  },
  runRetry() { if (run) { run.answers = {}; run.submitted = false; run.result = null; run.endAt = null; run.startAt = Date.now(); render(); goTop(); } },
  rewind(id) { genRewind(id); },
  toCards(id) {
    const set = findSet(id), last = set && set.attempts[set.attempts.length - 1]; if (!last || !has('cards')) return;
    let n = 0;
    for (const q of set.questions.filter(x => last.wrong.includes(x.id))) {
      if (state.study.cards.some(c => c.qid === q.id)) continue;
      state.study.cards.push({ id: uid('fc'), qid: q.id, front: q.q + (q.type === 'mc' ? '\n' + q.choices.map((c, j) => `${j + 1}) ${c}`).join('  ') : ''), back: `${q.type === 'mc' ? q.choices[q.answer] : q.answer} — ${q.explain}`, concept: q.concept, subject: set.subject, box: 1, due: today() });
      n++;
    }
    save(); toast(n ? `복습 카드 ${n}장을 만들었어요` : '이미 카드로 만든 문제예요');
    if (n) { state.studyTab = 'cards'; studyOpen = null; render(); }
  },
  flip() { flipped = !flipped; const el = document.querySelector('.flip'); if (el) el.classList.toggle('on', flipped); },
  cardKnow(id) { const c = state.study.cards.find(x => x.id === id); if (!c) return; c.box = Math.min(5, c.box + 1); c.due = addDays(today(), BOX_DAYS[c.box]); flipped = false; save(); render(); },
  cardAgain(id) { const c = state.study.cards.find(x => x.id === id); if (!c) return; c.box = 1; c.due = today(); flipIdx++; flipped = false; save(); render(); }
};
