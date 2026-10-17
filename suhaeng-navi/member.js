'use strict';
/* 수행 내비 — 멤버십: three plans, twenty plan-only features (shown only to members),
   the focus timer with generated soundscapes, and the member AI tools. */

const TIERS = {
  air: { name: 'Air', price: 0, tag: '기본', h: 44, desc: '수행평가 관리에 필요한 모든 기본 기능과 월 5회 시험지' },
  pro: { name: 'Pro', price: 3900, tag: '공부까지', h: 214, desc: '문제집, 오답 되감기, 포커스 타이머로 공부를 끝까지' },
  performance: { name: 'Performance', price: 7900, tag: '시험 대비 완성', h: 330, desc: '실전 모의고사, 약점 레이더, 시험 D-30 플랜까지' }
};
const RANK = { air: 0, pro: 1, performance: 2 };
const FEATURES = [
  { id: 'workbook', tier: 'pro', icon: 'book', name: '문제집 공방', desc: '교과서·필기로 최대 30문항 문제집, 난이도 선택, 무제한 생성' },
  { id: 'rewind', tier: 'pro', icon: 'route', name: '오답 되감기', desc: '틀린 개념만 골라 다른 각도의 변형 문제로 다시 풀어요' },
  { id: 'selfcheck', tier: 'pro', icon: 'list', name: '루브릭 셀프 채점', desc: '내 초안을 기준별로 점검해요. 고쳐 쓰지 않고 빠진 점만 질문으로' },
  { id: 'questions', tier: 'pro', icon: 'chat', name: '예상 질문 연습', desc: '발표·말하기 수행에서 선생님이 물어볼 질문을 미리 뽑아요' },
  { id: 'focus', tier: 'pro', icon: 'clock', name: '포커스 타이머', desc: '계획 블록을 타이머로 시작하고, 끝나면 바로 완료 체크' },
  { id: 'pace', tier: 'pro', icon: 'chart', name: '내 속도 보정', desc: '타이머 기록으로 실제 걸린 시간을 배워 다음 계획을 자동 보정' },
  { id: 'teacher', tier: 'pro', icon: 'spark', name: '과목별 출제 패턴', desc: '받은 공지로 과목마다 공지~마감 기간과 자주 나오는 기준을 분석' },
  { id: 'whatif', tier: 'pro', icon: 'calendar', name: '마감 시뮬레이터', desc: '마감이 바뀌면 계획과 몰림 경보가 어떻게 달라지는지 미리 봐요' },
  { id: 'family', tier: 'pro', icon: 'heart', name: '가족 공유 요약', desc: '이번 주 수행 현황을 보호자에게 보낼 요약으로 정리' },
  { id: 'themes', tier: 'pro', icon: 'sun', name: '테마 팩', desc: '민트, 사쿠라, 오션 색 테마' },
  { id: 'exam', tier: 'performance', icon: 'flag', name: '실전 모의고사 모드', desc: '제한 시간과 OMR 답안지로 실제 시험처럼' },
  { id: 'radar', tier: 'performance', icon: 'chart', name: '약점 레이더', desc: '모든 시험지 결과를 개념별로 모아 약한 곳부터 보여 줘요' },
  { id: 'cards', tier: 'performance', icon: 'board', name: '플래시카드 간격 반복', desc: '틀린 문제를 카드로 만들어 잊을 때쯤 다시 보여 줘요' },
  { id: 'conceptmap', tier: 'performance', icon: 'route', name: '개념 지도', desc: '교과서 내용을 개념과 관계로 그려요' },
  { id: 'd30', tier: 'performance', icon: 'calendar', name: '시험 D-30 마스터플랜', desc: '정기고사 범위를 과목별 단계로 나눠 캘린더에 자동 배치' },
  { id: 'weekly', tier: 'performance', icon: 'spark', name: 'AI 주간 리포트', desc: '한 주를 돌아보고 다음 주 위험 요소를 짚어요' },
  { id: 'priority', tier: 'performance', icon: 'flame', name: '우선순위 협상', desc: '몰림 주에 무엇부터 끝낼지 AI와 정해요' },
  { id: 'portfolio', tier: 'performance', icon: 'board', name: '학기 포트폴리오', desc: '한 학기 수행평가와 소감을 생활기록부 준비용으로 정리' },
  { id: 'seasons', tier: 'performance', icon: 'clock', name: '시간표 시즌', desc: '학기 중·시험 기간·방학 시간표를 저장하고 한 번에 전환' },
  { id: 'sound', tier: 'performance', icon: 'moon', name: '집중 사운드', desc: '타이머와 함께 빗소리·백색소음·브라운 노이즈를 직접 만들어 재생' }
];
function has(id) { const f = FEATURES.find(x => x.id === id); return !f || RANK[state.plan] >= RANK[f.tier]; }
const won = n => (n ? n.toLocaleString('ko-KR') + '원' : '무료');
const AIR_QUIZ_LIMIT = 5;
function quizLeft() {
  if (has('workbook')) return Infinity;
  const m = today().slice(0, 7);
  if (state.usage.month !== m) { state.usage = { month: m, quiz: 0 }; }
  return Math.max(0, AIR_QUIZ_LIMIT - state.usage.quiz);
}

/* ---------- settings: membership ---------- */
function memberSettingsHtml() {
  const cur = state.plan, p = TIERS[cur];
  const seg = Object.entries(TIERS).map(([k, v]) => `<button data-act="planPick" data-arg="${k}" aria-pressed="${(memberPick || cur) === k}">${v.name}</button>`).join('');
  const pick = memberPick || cur, pp = TIERS[pick];
  const feats = FEATURES.filter(f => RANK[f.tier] <= RANK[pick]);
  return `<div class="plan-card hue" style="--h:${p.h}">${logoMark(46)}<div style="flex:1;min-width:0"><span class="eyebrow">지금 쓰는 플랜</span><b>수행 내비 ${p.name}</b><small>${p.price ? `월 ${won(p.price)}` : '무료'} · ${esc(p.desc)}</small></div><span class="chip navy">${p.tag}</span></div>
    <div class="row-sb"><div class="seg" data-seg="plan" role="group" aria-label="플랜 보기">${seg}</div><span class="small faint">월 구독 · 언제든 변경</span></div>
    <div class="cell pad stack">
      <div class="row-sb"><div><b style="font-size:17px">${pp.name}</b> <span class="faint small">${pp.tag}</span></div><b class="num" style="font-size:22px">${pp.price ? `${won(pp.price)}<small class="faint" style="font-size:12px"> / 월</small>` : '무료'}</b></div>
      <p class="small muted">${esc(pp.desc)}</p>
      ${feats.length ? `<div class="feat-grid">${feats.map(f => `<div class="feat hue" style="--h:${TIERS[f.tier].h}"><span class="ni-ico hue" style="--h:${TIERS[f.tier].h}">${icon(f.icon)}</span><div><b>${f.name}</b><small>${esc(f.desc)}</small></div></div>`).join('')}</div>` : '<p class="small faint">수행 카드, 캘린더, 알림, 공지 스캔, AI 코치, 시험지 월 5회를 쓸 수 있어요.</p>'}
      <div class="row-end">${pick === cur ? '<span class="chip green">지금 쓰는 플랜</span>' : `<button class="btn btn-pri" data-act="planApply" data-arg="${pick}">${pp.name}${RANK[pick] > RANK[cur] ? '로 업그레이드' : '로 변경'}</button>`}</div>
    </div>
    <p class="tiny faint">결제 연동 전 미리보기 단계라 플랜을 바꿔도 실제로 청구되지 않아요. 멤버십 기능은 해당 플랜에서만 화면에 나타나요.</p>`;
}
let memberPick = null;

/* ---------- focus timer + soundscapes ---------- */
let snd = null, focusTick = null;
function soundStop() { if (snd) { try { snd.src.stop(); snd.lfo && snd.lfo.stop(); } catch (e) { /* already stopped */ } snd = null; } }
function soundStart(kind) {
  soundStop();
  if (!kind || kind === 'off' || !has('sound')) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx, len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = kind === 'rain' ? 'bandpass' : 'lowpass';
    f.frequency.value = kind === 'rain' ? 1500 : kind === 'white' ? 5200 : 800; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = kind === 'white' ? 0.035 : 0.09;
    src.connect(f).connect(g).connect(ctx.destination); src.start();
    let lfo = null;
    if (kind === 'rain') { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 0.18; lg.gain.value = 0.03; lfo.connect(lg).connect(g.gain); lfo.start(); }
    snd = { src, lfo, kind };
  } catch (e) { snd = null; }
}
const timerElapsed = tm => (tm.pausedAt || Date.now()) - tm.startAt - (tm.pausedMs || 0);
function renderFocus() {
  const root = document.getElementById('focus-root');
  if (!root) return;
  const tm = state.timer;
  if (!tm || !has('focus')) { root.innerHTML = ''; clearInterval(focusTick); focusTick = null; return; }
  const total = tm.planned * 60000, el = timerElapsed(tm), left = total - el, pct = clamp(el / total, 0, 1);
  const mmss = ms => { const s = Math.floor(Math.abs(ms) / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const r = 22, c = 2 * Math.PI * r;
  const a = find(tm.aid);
  root.innerHTML = `<div class="focus glass${left < 0 ? ' over' : ''}" role="region" aria-label="포커스 타이머">
    <svg class="f-ring hue" style="--h:${a ? hueOf(a.subject) : 214}" viewBox="0 0 54 54"><circle cx="27" cy="27" r="${r}" class="bg"/><circle cx="27" cy="27" r="${r}" class="fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></svg>
    <div class="f-c"><small>${a ? esc(a.subject) + ' · ' : ''}${tm.pausedAt ? '잠시 멈춤' : left < 0 ? '시간 지남' : '집중 중'}</small><b>${esc(tm.name)}</b><span class="num f-time">${left < 0 ? '+' : ''}${mmss(left)}</span></div>
    <div class="f-act"><button class="btn btn-soft btn-icon btn-sm" data-act="focusPause" aria-label="${tm.pausedAt ? '다시 시작' : '멈춤'}">${icon(tm.pausedAt ? 'next' : 'stop')}</button><button class="btn btn-pri btn-icon btn-sm" data-act="focusDone" aria-label="다 했어요">${icon('check')}</button><button class="btn btn-soft btn-icon btn-sm" data-act="focusStop" aria-label="타이머 끄기">${icon('x')}</button></div>
    ${has('sound') ? `<div class="f-snd">${[['off', '소리 끔'], ['rain', '빗소리'], ['white', '백색'], ['brown', '브라운']].map(([k, l]) => `<button class="pill-btn" data-act="focusSound" data-arg="${k}" aria-pressed="${(tm.sound || 'off') === k}">${l}</button>`).join('')}</div>` : ''}
  </div>`;
  if (left < 0 && !tm.rang) { tm.rang = true; save(); deliver({ id: 'focus:' + tm.startAt, at: Date.now(), kind: 'plan', title: '집중 시간이 끝났어요', body: `${tm.name} · 다 했으면 체크를 눌러요`, act: { type: 'card', arg: tm.aid } }, true); renderShell(); }
  if (!focusTick) focusTick = setInterval(renderFocus, 1000);
}
function startFocus(aid, stepIdx) {
  const a = find(aid), s = a && a.steps[+stepIdx];
  if (!s || !has('focus')) return;
  const b = PLANS_block(aid, +stepIdx);
  state.timer = { aid, step: +stepIdx, name: s.name, planned: b ? b.end - b.start : s.minutes, startAt: Date.now(), pausedAt: null, pausedMs: 0, sound: state.timer && state.timer.sound || 'off' };
  save(); renderFocus(); toast(`${s.name} · ${state.timer.planned}분 집중 시작`);
}
function PLANS_block(aid, step) { const p = PLANS[aid]; return p && p.blocks.find(b => b.step === step) || null; }

/* ---------- member AI + local tools ---------- */
async function aiSelfCheck(id) {
  const a = find(id); if (!a || !has('selfcheck')) return;
  const draft = (a.selfcheck && a.selfcheck.draft || '').trim();
  const key = 'selfcheck:' + id;
  if (draft.length < 20) { errors[key] = '초안을 20자 이상 붙여넣어 주세요.'; render(); return; }
  const r = await runAI(key, signal => sample.json(fill(P.selfcheck.tpl, { '수행평가': describe(a, true), '초안': draft.slice(0, 12000) }), { signal, cache: false }));
  if (!r) return;
  const crit = (Array.isArray(r.criteria) ? r.criteria : []).filter(c => c && typeof c === 'object').map(c => ({ original: str(c.original), level: ['충족', '부분', '부족'].includes(str(c.level)) ? str(c.level) : '부분', evidence: str(c.evidence), missing: str(c.missing) }));
  a.selfcheck = { draft, result: { criteria: crit, overall: str(r.overall) }, at: today() };
  save(); render();
}
async function aiQuestions(id) {
  const a = find(id); if (!a || !has('questions')) return;
  const key = 'questions:' + id, memo = (a.expect && a.expect.memo || '').trim();
  const r = await runAI(key, signal => sample.json(fill(P.questions.tpl, { '수행평가': describe(a, true), '메모': memo || '(아직 없음)' }), { signal, cache: false, modelTier: 'quick' }));
  if (!r) return;
  a.expect = { memo, result: (Array.isArray(r.questions) ? r.questions : []).filter(q => q && q.q).slice(0, 6).map(q => ({ q: str(q.q), why: str(q.why), prep: str(q.prep) })) };
  save(); render();
}
function weekData() {
  const t = today(), m0 = mondayOf(t);
  const done = state.cards.flatMap(a => a.steps.filter(s => s.done && s.doneAt && diffDays(m0, s.doneAt) >= 0).map(s => `${a.subject} ${s.name}`));
  const up = state.cards.filter(a => a.due && diffDays(t, a.due) >= 0 && diffDays(a.due, addDays(m0, 13)) >= 0).sort(byDue).map(a => `${a.subject} ${a.title} ${md(a.due)} (${a.steps.filter(s => s.done).length}/${a.steps.length}단계)`);
  const atts = state.study.sets.flatMap(s => s.attempts || []).filter(x => diffDays(m0, x.at) >= 0);
  const avg = atts.length ? Math.round(atts.reduce((n, x) => n + x.score / x.total, 0) / atts.length * 100) : null;
  return [`이번 주 끝낸 단계 ${done.length}개: ${done.slice(0, 8).join(', ') || '없음'}`, `쉬어 간 날 ${state.skips.filter(d => diffDays(m0, d) >= 0).length}일`,
    `2주 안 마감: ${up.join(' / ') || '없음'}`, `몰림 주: ${crunchWeeks().map(w => mdShort(w.monday) + ' 주 ' + w.cards.length + '개').join(', ') || '없음'}`,
    `시험지 ${atts.length}회 풀이${avg != null ? `, 평균 정답률 ${avg}%` : ''}`].join('\n');
}
async function aiWeekly() {
  if (!has('weekly')) return;
  const r = await runAI('weekly', signal => sample(fill(P.weekly.tpl, { '말투': toneRule(), '기록': weekData() }), { signal, cache: false, modelTier: 'quick' }));
  if (!r) return;
  state.reports[mondayOf(today())] = { text: r.text.trim(), at: Date.now() };
  save(); render();
}
function priorityLocal(w) {
  const rows = w.cards.map(a => { const p = PLANS[a.id]; const left = a.steps.filter(s => !s.done).reduce((n, s) => n + s.minutes, 0); return { a, left, start: p && p.start }; })
    .sort((x, y) => byDue(x.a, y.a) || y.left - x.left);
  return { plan: rows.map(r => ({ subject: r.a.subject, action: r.left ? `남은 ${dur(r.left)} 가운데 앞 단계를 ${r.start ? md(r.start) : '이번 주'}부터` : '이미 단계를 끝냈어요. 제출 직전 체크만', why: `${md(r.a.due)} 마감${r.a.weight ? ' · 반영 ' + r.a.weight : ''}` })), message: '마감이 빠른 것부터, 남은 양이 많은 것을 먼저 당겨 두면 몰림 주가 가벼워져요.', local: true };
}
async function aiPriority(monday) {
  const w = crunchWeeks().find(x => x.monday === monday); if (!w || !has('priority')) return;
  sheet = { kind: 'priority', monday, result: priorityLocal(w) };
  render();
  if (!aiReady()) return;
  const list = w.cards.map(a => `- ${a.subject} · ${a.title} · ${mdMid(a.due)} · 반영 ${a.weight || '?'} · 남은 단계: ${a.steps.filter(s => !s.done).map(s => s.name + ' ' + s.minutes + '분').join(', ') || '단계 없음'}`).join('\n');
  const free = daysInRange(today(), addDays(w.monday, -1)).slice(0, 14).map(d => `${md(d)} ${dur(freeIntervals(d, true).reduce((n, [s, e]) => n + e - s, 0))}`).join(', ');
  const r = await runAI('priority', signal => sample.json(fill(P.priority.tpl, { '목록': list, '시간': free }), { signal, cache: false }));
  if (r && sheet && sheet.kind === 'priority') {
    sheet.result = { plan: (Array.isArray(r.plan) ? r.plan : []).filter(x => x && x.subject).map(x => ({ subject: str(x.subject), action: str(x.action), why: str(x.why) })), message: str(r.message), local: false };
    render();
  }
}
SHEETS.priority = sh => ({ html: `<div class="sheet-h"><h3>${icon('flame')} 우선순위 협상</h3><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>
  <p class="small muted">${mdShort(sh.monday)} 주에 몰린 수행평가를 무엇부터 끝낼지 정해요.${sh.result.local ? ' 지금은 마감과 남은 양으로 계산한 기본 순서예요.' : ''}</p>
  ${busyRow('priority')}${errRow('priority')}
  <ol class="prio">${sh.result.plan.map(x => `<li class="cell pad"><b>${esc(x.subject)}</b><span>${esc(x.action)}</span><small>${esc(x.why)}</small></li>`).join('')}</ol>
  ${sh.result.message ? `<div class="note">${esc(sh.result.message)}</div>` : ''}` });

function teacherPatterns() {
  const bySub = {};
  for (const a of state.cards) {
    if (!a.due || !a.createdAt) continue;
    const g = bySub[a.subject] = bySub[a.subject] || { n: 0, lead: [], words: {}, types: {} };
    g.n++; g.lead.push(diffDays(ymd(new Date(a.createdAt)), a.due));
    if (a.type) g.types[a.type] = (g.types[a.type] || 0) + 1;
    for (const r of a.rubric) for (const w of r.replace(/\(.*?\)|[0-9]+점|[^가-힣a-zA-Z\s]/g, ' ').split(/\s+/)) if (w.length >= 2 && !/^(있는|하기|하는|이상|정도|에서|으로|그리고|있는가|했는가)$/.test(w)) g.words[w] = (g.words[w] || 0) + 1;
  }
  return Object.entries(bySub).map(([s, g]) => ({ subject: s, n: g.n, lead: Math.round(g.lead.reduce((x, y) => x + y, 0) / g.lead.length),
    words: Object.entries(g.words).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]), type: Object.entries(g.types).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || '' }));
}
function familySummary() {
  const t = today(), m0 = mondayOf(t);
  const up = state.cards.filter(a => a.due && diffDays(t, a.due) >= 0 && diffDays(a.due, addDays(m0, 13)) >= 0).sort(byDue);
  const done = state.cards.reduce((n, a) => n + a.steps.filter(s => s.done && s.doneAt && diffDays(m0, s.doneAt) >= 0).length, 0);
  return [`[수행 내비 주간 요약] ${mdMid(m0)} 주 · ${state.settings.name || ''}`.trim(),
    `이번 주 끝낸 준비 단계: ${done}개`,
    ...up.map(a => `• ${a.subject} ${a.title} — ${mdMid(a.due)} 마감 (${dday(a.due)}) · 준비 ${a.steps.length ? Math.round(progressOf(a) * 100) + '%' : '시작 전'}${a.materials.length ? ' · 준비물: ' + a.materials.join(', ') : ''}`),
    crunchWeeks().length ? `⚠ ${crunchWeeks().map(w => mdShort(w.monday) + ' 주에 수행평가 ' + w.cards.length + '개').join(', ')} — 미리 시작하고 있어요` : '몰리는 주는 없어요.'].join('\n');
}
function portfolioText() {
  const list = state.cards.filter(a => a.due).sort(byDue);
  return [`[수행 내비 학기 포트폴리오] ${state.settings.name || ''} · ${state.settings.grade || ''}`.trim(), ...list.map(a => {
    const cl = checklistCount(a);
    return `■ ${a.subject} · ${a.title} (${mdMid(a.due)}, ${a.type || '수행'}${a.weight ? ', 반영 ' + a.weight : ''})\n  준비 단계 ${a.steps.filter(s => s.done).length}/${a.steps.length}${cl ? ` · 기준 체크 ${cl.done}/${cl.total}` : ''}\n  소감: ${(a.reflect || '').trim() || '—'}`;
  })].join('\n');
}
function whatIf(a, newDue) {
  const old = a.due;
  a.due = newDue;
  const plans = buildPlans(), wc = weekCounts();
  a.due = old;
  const p = plans[a.id], n = (wc[mondayOf(newDue)] || []).length + (mondayOf(old) === mondayOf(newDue) ? 0 : 1);
  const cur = PLANS[a.id];
  return { start: p && p.start, curStart: cur && cur.start, crunch: n >= 3 ? n : 0, tight: p && p.tight };
}
const SEASONS = { term: '학기 중', exam: '시험 기간', vacation: '방학' };
function seasonSnapshot() { return JSON.parse(JSON.stringify({ school: state.school, academies: state.academies, schoolEnd: state.settings.schoolEnd, weekendStart: state.settings.weekendStart, dayEnd: state.settings.dayEnd, cap: state.settings.cap, weekendCap: state.settings.weekendCap })); }
function seasonApply(s) { state.school = s.school; state.academies = s.academies; Object.assign(state.settings, { schoolEnd: s.schoolEnd, weekendStart: s.weekendStart, dayEnd: s.dayEnd, cap: s.cap, weekendCap: s.weekendCap }); }

const MEM_H = {
  planPick(k) { memberPick = k; render(); },
  planApply(k) {
    if (!TIERS[k]) return;
    state.plan = k; memberPick = null;
    if (!has('themes')) state.look.theme = 'sunrise';
    if (!has('focus')) state.timer = null;
    applyLook(); save(); render(); renderFocus();
    toast(`수행 내비 ${TIERS[k].name}로 바꿨어요`);
  },
  focusStart(arg) { const [aid, i] = arg.split(':'); startFocus(aid, i); },
  focusPause() {
    const tm = state.timer; if (!tm) return;
    if (tm.pausedAt) { tm.pausedMs += Date.now() - tm.pausedAt; tm.pausedAt = null; if (tm.sound) soundStart(tm.sound); }
    else { tm.pausedAt = Date.now(); soundStop(); }
    save(); renderFocus();
  },
  focusDone() {
    const tm = state.timer; if (!tm) return;
    const a = find(tm.aid), s = a && a.steps[tm.step];
    state.timerLog.push({ aid: tm.aid, step: tm.step, planned: tm.planned, actual: Math.max(1, Math.round(timerElapsed(tm) / 60000)), at: today() });
    if (state.timerLog.length > 200) state.timerLog = state.timerLog.slice(-200);
    if (s && !s.done) { s.done = true; s.doneAt = today(); }
    state.timer = null; soundStop(); save(); render(); renderFocus();
    toast(s ? `${s.name} 완료! 기록을 남겼어요` : '기록을 남겼어요');
  },
  focusStop() { state.timer = null; soundStop(); save(); renderFocus(); },
  focusSound(k) { if (!state.timer) return; state.timer.sound = k; save(); if (!state.timer.pausedAt) soundStart(k); renderFocus(); },
  selfCheck(id) { aiSelfCheck(id); },
  expectQ(id) { aiQuestions(id); },
  weeklyReport() { aiWeekly(); },
  priority(monday) { aiPriority(monday); },
  copyFamily() { copyText(familySummary(), document.getElementById('fam-text')); },
  copyPortfolio() { copyText(portfolioText(), document.getElementById('pf-text')); },
  paceToggle() { state.pace = !state.pace; save(); render(); },
  season(k) {
    if (!has('seasons') || !SEASONS[k] || state.seasons.active === k) return;
    state.seasons[state.seasons.active] = seasonSnapshot();
    if (state.seasons[k]) seasonApply(JSON.parse(JSON.stringify(state.seasons[k])));
    state.seasons.active = k; save(); render(); toast(`${SEASONS[k]} 시간표로 바꿨어요`);
  }
};
