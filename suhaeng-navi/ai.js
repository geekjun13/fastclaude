'use strict';
/* 수행 내비 — Claude connection and every AI-backed action.
   The page asks Claude on the viewer's own account through the `sample` capability. */

let sample = null, imageLimits = null, aiState = 'pending';
const busy = {};    // key -> {ctl, t0}
const errors = {};  // key -> text
const DENY = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
const ERR = {
  not_granted: 'AI 사용을 허용하지 않아서 AI 기능을 꺼 둘게요. 다시 열면 다시 물어봐요.',
  sampling_disabled: '이 계정에서는 AI를 쓸 수 없어요.',
  rate_limited: '요청이 많아 잠시 막혔어요. 조금 뒤에 다시 눌러 주세요.',
  session_expired: 'claude.ai에 다시 로그인해 주세요.',
  image_rejected: '이 사진은 읽을 수 없어요. JPG나 PNG로 다시 골라 주세요.',
  images_unavailable: '이 화면에서는 사진을 AI에 보낼 수 없어요. 공지 글을 붙여넣어 주세요.',
  refused: 'AI가 이 요청에는 답하지 않았어요. 내용을 바꿔서 다시 해 보세요.',
  invalid_json: 'AI 답을 정리하지 못했어요. 한 번 더 눌러 주세요.',
  empty_completion: 'AI가 빈 답을 보냈어요. 입력을 줄여서 다시 해 보세요.',
  prompt_too_large: '입력이 너무 길어요. 필요한 부분만 남겨 주세요.'
};
const errText = e => ERR[e && e.code] || '연결이 잠깐 끊겼어요. 다시 눌러 주세요.';
const aiReady = () => !!sample && aiState === 'ready';
const aiOffText = () => aiState === 'denied'
  ? 'AI 기능이 꺼져 있어요. 페이지를 다시 열면 허용 여부를 다시 물어봐요.'
  : aiState === 'pending' ? 'AI 연결을 확인하고 있어요.'
  : 'AI가 연결되지 않았어요. claude.ai에 로그인한 상태로 이 링크를 열면 AI 기능이 켜져요.';
const toneRule = () => (TONES[state.settings.tone] || TONES.friend).rule;

function initAI() {
  if (!(window.claude && typeof window.claude.use === 'function')) { aiState = 'off'; return; }
  window.claude.use('sample').then(async s => {
    sample = s || null;
    aiState = s ? 'ready' : 'off';
    if (s) { try { const l = await s.limits(); imageLimits = l && l.images ? l.images : null; } catch (e) { imageLimits = null; } }
    render();
  }, () => { aiState = 'off'; render(); });
}

async function runAI(key, fn) {
  if (!aiReady()) { errors[key] = aiOffText(); render(); return null; }
  const ctl = new AbortController();
  busy[key] = { ctl, t0: Date.now() };
  errors[key] = null;
  render();
  try {
    return await fn(ctl.signal);
  } catch (e) {
    if (!e || e.code !== 'cancelled') {
      errors[key] = errText(e);
      if (e && DENY.has(e.code)) aiState = 'denied';
    }
    return null;
  } finally {
    delete busy[key];
    render();
  }
}
setInterval(() => {
  document.querySelectorAll('[data-elapsed]').forEach(el => {
    const b = busy[el.dataset.elapsed];
    if (b) el.textContent = Math.floor((Date.now() - b.t0) / 1000);
  });
}, 1000);

/* ---------- cleaning what comes back ---------- */
const nul = v => (str(v) === 'null' ? '' : str(v));
function cleanItem(x) {
  const due = /^\d{4}-\d{2}-\d{2}$/.test(str(x.due)) ? str(x.due) : '';
  const unc = Array.isArray(x.uncertain) ? x.uncertain.filter(u => u && typeof u === 'object').map(u => ({ field: normField(u.field), why: str(u.why) })) : [];
  const type = TYPES.includes(nul(x.type)) ? nul(x.type) : nul(x.type).slice(0, 12);
  return { subject: nul(x.subject), type, title: nul(x.title), due, dueTime: nul(x.dueTime), method: nul(x.method),
           materials: strs(x.materials), rubric: strs(x.rubric), weight: nul(x.weight), uncertain: unc };
}
function cleanPrivacy(list, count) {
  if (!Array.isArray(list)) return [];
  return list.filter(p => p && Array.isArray(p.box) && p.box.length === 4).map(p => {
    const [x, y, w, h] = p.box.map(Number);
    const img = clamp(Math.round(Number(p.image) || 1), 1, Math.max(1, count)) - 1;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
    // pad generously: a box that is a little too big is fine, one that misses a name is not
    const px = 0.015, py = 0.01;
    const bx = clamp(x - px, 0, 1), by = clamp(y - py, 0, 1);
    return { image: img, label: str(p.label) || '개인정보', x: bx, y: by, w: clamp(w + px * 2, 0.02, 1 - bx), h: clamp(h + py * 2, 0.02, 1 - by), ai: true };
  }).filter(Boolean);
}
function cleanChecklist(r) {
  const list = r && Array.isArray(r.criteria) ? r.criteria : [];
  const criteria = list.filter(c => c && typeof c === 'object').slice(0, 10).map(c => ({
    original: str(c.original), plain: str(c.plain), checks: strs(c.checks).slice(0, 5), tip: nul(c.tip)
  })).filter(c => c.plain || c.checks.length);
  return { criteria, beforeSubmit: strs(r && r.beforeSubmit).slice(0, 6) };
}
function cleanSteps(r) {
  const list = r && Array.isArray(r.steps) ? r.steps : Array.isArray(r) ? r : [];
  return list.filter(x => x && typeof x === 'object').slice(0, 8).map(x => ({
    name: str(x.name), minutes: clamp(Math.round((Number(x.minutes) || 40) / 10) * 10, 10, 180),
    check: str(x.done || x.check), done: false, doneAt: null
  })).filter(x => x.name);
}
function cleanAcademies(r) {
  const list = r && Array.isArray(r.academies) ? r.academies : [];
  const t = v => /^\d{1,2}:\d{2}$/.test(str(v)) ? toMin(str(v)) : null;
  return list.filter(x => x && typeof x === 'object').slice(0, 12).map(x => ({
    id: uid('ac'), label: str(x.label) || '학원',
    days: (Array.isArray(x.days) ? x.days : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6),
    start: t(x.start), end: t(x.end)
  })).filter(x => x.days.length && x.start != null && x.end != null && x.end > x.start);
}
const FIELD_KEYS = { '과목': 'subject', '유형': 'type', '이름': 'title', '수행평가 이름': 'title', '제목': 'title', '마감일': 'due', '마감': 'due', '시간': 'dueTime', '교시': 'dueTime', '방식': 'method', '제출': 'method', '제출 방식': 'method', '준비물': 'materials', '채점 기준': 'rubric', '반영 비율': 'weight' };
function normField(f) { return FIELD_KEYS[f] || String(f || '').trim(); }

/* ---------- context the prompts carry ---------- */
function describe(a, withRubric) {
  return [`과목: ${a.subject}`, `유형: ${a.type || '공지에 없음'}`, `이름: ${a.title}`, `오늘: ${todayLabel()}`,
    `마감: ${a.due ? mdMid(a.due) : '미정'}${a.dueTime ? ' ' + a.dueTime : ''}${a.due ? ` (${dday(a.due)})` : ''}`,
    `제출: ${a.method || '공지에 없음'}`, `준비물: ${a.materials.join(', ') || '없음'}`, `반영 비율: ${a.weight || '공지에 없음'}`]
    .concat(withRubric ? ['채점 기준:'].concat(a.rubric.length ? a.rubric.map(r => '- ' + r) : ['- 공지에 없음']) : []).join('\n');
}
function progressText(a) {
  const p = PLANS[a.id];
  const lines = a.steps.length ? a.steps.map(s => `- ${s.done ? '[완료]' : '[남음]'} ${s.name} (${s.minutes}분)`) : ['- 아직 단계를 나누지 않음'];
  const next = p && p.blocks[0];
  if (next) lines.push(`다음 계획: ${md(next.date)} ${hm(next.start)} ${a.steps[next.step].name}`);
  return lines.join('\n');
}
function boardText() {
  const t = today();
  const up = state.cards.filter(a => a.due && diffDays(t, a.due) >= 0).sort(byDue);
  if (!up.length) return '등록된 수행평가 없음';
  return up.map(a => {
    const done = a.steps.filter(s => s.done).length;
    return `- ${a.subject} · ${a.title} · ${mdMid(a.due)} ${a.dueTime || ''} (${dday(a.due)}) · ${a.steps.length ? `단계 ${done}/${a.steps.length}` : '단계 없음'}`;
  }).join('\n') + (crunchWeeks().length ? '\n몰림 주: ' + crunchWeeks().map(w => `${mdShort(w.monday)} 주 ${w.cards.length}개`).join(', ') : '');
}
function planText() {
  const bl = allBlocks().slice(0, 12);
  if (!bl.length) return '계획 없음';
  return bl.map(b => `- ${md(b.date)} ${hm(b.start)}–${hm(b.end)} ${find(b.aid).subject} · ${stepOf(b).name}`).join('\n');
}

/* ---------- actions ---------- */
async function aiReadNotice(images, text) {
  const notice = (images.length ? `(공지 사진 ${images.length}장 첨부. 사진 순서대로 1번부터야.)\n` : '') + text;
  const prompt = fill(P.read.tpl, { '오늘': todayLabel(), '공지': notice || '(사진만 있음)' });
  const opts = images.length ? { images: images.map(x => x.blob) } : {};
  const r = await runAI('read', signal => sample.json(prompt, { ...opts, signal }));
  if (!r) return null;
  const list = Array.isArray(r) ? r : r && Array.isArray(r.items) ? r.items : [];
  return { items: list.filter(x => x && typeof x === 'object').slice(0, 8).map(cleanItem), privacy: cleanPrivacy(r && r.privacy, images.length) };
}
async function aiRubric(id) {
  const a = find(id); if (!a) return;
  const key = 'rubric:' + id;
  const prompt = fill(P.rubric.tpl, { '수행평가': describe(a, false), '채점기준': a.rubric.map(r => '- ' + r).join('\n') || '- 공지에 없음' });
  const r = await runAI(key, signal => sample.json(prompt, a.checklist ? { signal, cache: false } : { signal }));
  if (!r) return;
  const cl = cleanChecklist(r);
  if (!cl.criteria.length) { errors[key] = 'AI 답에서 기준을 찾지 못했어요. 다시 눌러 주세요.'; render(); return; }
  a.checklist = cl; a.checked = {};
  save(); render(); toast('채점 기준을 체크리스트로 바꿨어요');
}
async function aiSteps(id) {
  const a = find(id); if (!a) return;
  const key = 'steps:' + id;
  const prompt = fill(P.steps.tpl, { '수행평가': describe(a, true) });
  const r = await runAI(key, signal => sample.json(prompt, a.steps.length ? { signal, cache: false } : { signal }));
  if (!r) return;
  const steps = cleanSteps(r);
  if (!steps.length) { errors[key] = 'AI 답에서 단계를 찾지 못했어요. 다시 눌러 주세요.'; render(); return; }
  a.steps = steps;
  save(); render(); toast('단계를 나누고 빈 시간에 배치했어요');
}
function chatTurns(head, history, msg) {
  const turns = [{ role: 'user', content: head }];
  for (const m of history.slice(-12)) if (m.content) turns.push({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content });
  turns.push({ role: 'user', content: msg });
  return turns;
}
async function aiCardChat(id, msg) {
  const a = find(id); if (!a) return;
  const key = 'coach:' + id;
  const head = fill(P.coach.tpl, { '말투': toneRule(), '수행평가': describe(a, true), '진행': progressText(a) });
  const history = a.chat.slice();
  a.chat.push({ role: 'me', content: msg }, { role: 'ai', content: '' });
  const reply = a.chat[a.chat.length - 1];
  const r = await runAI(key, signal => sample(chatTurns(head, history, msg), { signal, cache: false, modelTier: 'quick', onText: ({ text }) => {
    reply.content = text;
    const el = document.querySelector(`[data-live="${key}"]`);
    if (el) el.textContent = text;
  } }));
  if (r) reply.content = r.text.trim();
  if (!reply.content) a.chat.pop();
  save(); render();
}
async function aiChat(msg) {
  const key = 'chat';
  const head = fill(P.chat.tpl, { '말투': toneRule(), '이름': state.settings.name || '학생', '오늘': todayLabel(), '보드': boardText(), '계획': planText() });
  const history = state.chat.slice();
  state.chat.push({ role: 'me', content: msg }, { role: 'ai', content: '' });
  const reply = state.chat[state.chat.length - 1];
  const r = await runAI(key, signal => sample(chatTurns(head, history, msg), { signal, cache: false, modelTier: 'quick', onText: ({ text }) => {
    reply.content = text;
    const el = document.querySelector(`[data-live="${key}"]`);
    if (el) el.textContent = text;
  } }));
  if (r) reply.content = r.text.trim();
  if (!reply.content) state.chat.pop();
  if (state.chat.length > 40) state.chat = state.chat.slice(-40);
  save(); render();
}
async function aiCheer(missed, nextLine) {
  const prompt = fill(P.cheer.tpl, { '말투': toneRule(), '못한일': missed.map(m => '- ' + m).join('\n') || '- 없음', '새일정': nextLine || '남은 일정 없음' });
  const t = today();
  const r = await runAI('cheer', signal => sample(prompt, { signal, cache: false, modelTier: 'quick', onText: ({ text }) => {
    const el = document.querySelector('[data-live="cheer"]');
    if (el) el.textContent = text;
  } }));
  if (r && skippedToday() && state.cheer && state.cheer.date === t) { state.cheer.text = r.text.trim(); state.cheer.ai = true; save(); render(); }
}
async function aiTimetable(files, text) {
  const prompt = fill(P.timetable.tpl, { '시간표': (files.length ? `(시간표 사진 ${files.length}장 첨부)\n` : '') + (text || '') });
  const opts = files.length ? { images: files } : {};
  const r = await runAI('timetable', signal => sample.json(prompt, { ...opts, signal }));
  if (!r) return null;
  return cleanAcademies(r);
}
