'use strict';
/* 수행 내비 — actions, events, photo masking, glass refraction, boot */

let confirmKey = null, armTimer = null;
function arm(key) {
  confirmKey = key; render();
  clearTimeout(armTimer);
  armTimer = setTimeout(() => { if (confirmKey === key) { confirmKey = null; render(); } }, 4000);
}
const toForm = x => ({ subject: x.subject || '', type: x.type || '', title: x.title || '', due: x.due || '', dueTime: x.dueTime || '', method: x.method || '',
  materials: (x.materials || []).join(', '), rubric: (x.rubric || []).join('\n'), weight: x.weight || '' });
const fromForm = f => ({ subject: f.subject.trim(), type: f.type.trim(), title: f.title.trim(), due: f.due, dueTime: f.dueTime.trim(), method: f.method.trim(),
  materials: f.materials.split(/[,，]/).map(s => s.trim()).filter(Boolean), rubric: f.rubric.split('\n').map(s => s.trim()).filter(Boolean), weight: f.weight.trim() });
const validForm = f => f.subject.trim() && f.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.due);
async function copyText(text, el) {
  try { await navigator.clipboard.writeText(text); toast('복사했어요'); }
  catch (e) {
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('복사가 막혀 있어요. 선택된 부분을 직접 복사해 주세요.');
  }
}
function goTop() { window.scrollTo({ top: 0, behavior: 'auto' }); }

/* ---------- capture ---------- */
function capAddFiles(list) {
  for (const f of Array.from(list || [])) {
    if (!f.type || !f.type.startsWith('image/')) continue;
    if (cap.images.length >= maxImages()) { toast(`사진은 ${maxImages()}장까지 넣을 수 있어요`); break; }
    cap.images.push({ blob: f, url: URL.createObjectURL(f), name: f.name || '공지 사진', boxes: [] });
  }
  errors.read = null;
  render();
}
function capReset() {
  cap.images.forEach(x => URL.revokeObjectURL(x.url));
  Object.assign(cap, { step: 1, images: [], text: '', items: [], fallback: false, saved: [], draft: null });
  errors.read = null;
}
function setCapItems(items, fallback) {
  cap.items = items.map(x => ({ ai: x, f: toForm(x), err: null }));
  cap.fallback = fallback; cap.step = 3;
  render(); goTop();
}
async function capRead() {
  const text = cap.text.trim();
  if (!text && !cap.images.length) { errors.read = '공지 사진을 고르거나 글을 붙여넣어 주세요.'; render(); return; }
  if (!aiReady()) {
    const onlyExamples = cap.images.every(x => x.ex) && (!text || text === exampleChat().trim());
    if (!onlyExamples) { errors.read = aiOffText(); render(); return; }
    const items = [];
    cap.images.forEach(x => { if (x.ex === 'handout') { items.push(fallbackFor('handout')); x.boxes = x.exBoxes.map(b => ({ ...b })); } });
    if (text) items.push(fallbackFor('chat'));
    setCapItems(items, true);
    return;
  }
  if (cap.images.length && !imageLimits) { errors.read = ERR.images_unavailable; render(); return; }
  const r = await aiReadNotice(cap.images, text);
  if (!r) return;
  r.privacy.forEach(b => { if (cap.images[b.image]) cap.images[b.image].boxes.push(b); });
  setCapItems(r.items, false);
}
function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
}
/* draws a smaller copy and pixelates every masked box so the name cannot be recovered */
async function maskedCopy(img) {
  try {
    const im = await loadImage(img.url);
    const sc = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
    const W = Math.round(im.naturalWidth * sc), H = Math.round(im.naturalHeight * sc);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0, W, H);
    for (const b of img.boxes) {
      const x = Math.round(b.x * W), y = Math.round(b.y * H), w = Math.max(4, Math.round(b.w * W)), h = Math.max(4, Math.round(b.h * H));
      const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(w / 14)); t.height = Math.max(1, Math.round(h / 14));
      t.getContext('2d').drawImage(c, x, y, w, h, 0, 0, t.width, t.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(t, 0, 0, t.width, t.height, x, y, w, h);
      g.imageSmoothingEnabled = true;
      g.fillStyle = 'rgba(27,35,55,0.45)'; g.fillRect(x, y, w, h);
    }
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
  } catch (e) { return null; }
}
async function capSave() {
  let bad = false;
  cap.items.forEach(it => { it.err = validForm(it.f) ? null : '과목, 이름, 마감일은 꼭 채워 주세요.'; if (it.err) bad = true; });
  if (bad) { render(); return; }
  const photoIds = [];
  for (const img of cap.images) {
    const blob = await maskedCopy(img);
    if (blob) { const id = uid('ph'); await PhotoStore.put(id, blob); photoIds.push(id); }
  }
  const saved = [];
  for (const it of cap.items) {
    const final = fromForm(it.f);
    const a = normalizeCard({ id: uid(), source: cap.images.length ? 'image' : it.ai ? 'text' : 'manual', ...final, photoIds: photoIds.slice(), createdAt: Date.now() });
    state.cards.push(a); saved.push(a.id);
    if (it.ai && !cap.fallback) {
      const x = it.ai, same = {
        subject: norm(x.subject) === norm(final.subject), type: norm(x.type) === norm(final.type), title: norm(x.title) === norm(final.title),
        due: x.due === final.due, method: norm(x.method) === norm(final.method),
        materials: x.materials.map(norm).sort().join('|') === final.materials.map(norm).sort().join('|'),
        rubric: x.rubric.map(norm).join('|') === final.rubric.map(norm).join('|')
      };
      state.log.push({ at: today(), source: cap.images.length ? 'image' : 'text', subject: final.subject, fixed: ACC_FIELDS.filter(k => !same[k]) });
    }
  }
  cap.images.forEach(x => URL.revokeObjectURL(x.url));
  Object.assign(cap, { step: 4, images: [], text: '', items: [], saved, draft: null });
  save(); render(); goTop();
  const hot = crunchWeeks().find(w => w.cards.some(a => saved.includes(a.id)));
  toast(hot ? `저장했어요. ${mdShort(hot.monday)} 주에 ${hot.cards.length}개가 몰려서 몰림 경보가 떴어요.` : `수행 카드 ${saved.length}장을 저장했어요.`);
}

/* the example handout, drawn so the photo path can be shown without a real photo */
async function makeHandout() {
  try { await Promise.all([document.fonts.load('700 30px "Noto Sans KR"'), document.fonts.load('400 22px "Noto Sans KR"'), document.fonts.load('700 34px "Gaegu"')]); } catch (e) { /* system faces */ }
  const { W } = anchors();
  const due = addDays(W, 2), dd = parseYmd(due), mo = dd.getMonth() + 1;
  const term = mo >= 8 || mo <= 2 ? 2 : 1, year = mo <= 2 ? dd.getFullYear() - 1 : dd.getFullYear();
  const Wc = 1100, Hc = 1400, ang = -0.022;
  const c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
  const g = c.getContext('2d');
  const F = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  g.fillStyle = '#7d8379'; g.fillRect(0, 0, Wc, Hc);
  const light = g.createRadialGradient(Wc * .35, Hc * .25, 80, Wc * .5, Hc * .5, Wc);
  light.addColorStop(0, 'rgba(255,255,255,0.22)'); light.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = light; g.fillRect(0, 0, Wc, Hc);
  g.save(); g.translate(Wc / 2, Hc / 2); g.rotate(ang); g.translate(-Wc / 2, -Hc / 2);
  const px = 90, py = 70, pw = 920, ph = 1250, ink = '#1c1c1c';
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 28; g.shadowOffsetY = 10; g.fillStyle = '#fbfaf5'; g.fillRect(px, py, pw, ph); g.shadowColor = 'transparent';
  // the student's name, top right, in pen: this is what gets masked
  const pen = '#2443a8';
  g.font = '700 34px "Gaegu",cursive'; g.fillStyle = pen; g.textAlign = 'right';
  const nameText = '3학년 2반 14번 김민준', nw = g.measureText(nameText).width;
  g.fillText(nameText, px + pw - 40, py + 52);
  const nb = [px + pw - 40 - nw - 12, py + 18, nw + 24, 46];
  g.textAlign = 'center'; g.fillStyle = ink;
  g.font = `700 33px ${F}`; g.fillText(`${year}학년도 ${term}학기 과학과 수행평가 안내`, px + pw / 2, py + 124);
  g.font = `400 21px ${F}`; g.fillStyle = '#555'; g.fillText('3학년 · 탐구 보고서', px + pw / 2, py + 160);
  g.textAlign = 'left';
  const row = (y, h, label, value) => {
    g.fillStyle = '#ebebe6'; g.fillRect(px + 40, y, 170, h);
    g.strokeStyle = '#333'; g.lineWidth = 1.4; g.strokeRect(px + 40, y, pw - 80, h);
    g.beginPath(); g.moveTo(px + 210, y); g.lineTo(px + 210, y + h); g.stroke();
    g.fillStyle = ink; g.font = `700 21px ${F}`; g.fillText(label, px + 58, y + h / 2 + 8);
    g.font = `400 22px ${F}`; g.fillText(value, px + 228, y + h / 2 + 8);
  };
  const rows = [['평가 영역', '탐구 보고서 (학기 반영 비율 25%)'], ['과제명', '생활 속 산·염기 탐구 보고서'], ['제출 기한', `${mo}월 ${dd.getDate()}일(${WD[dd.getDay()]}) 23:59까지`],
    ['제출 방법', "구글 클래스룸 '수행평가' 과제에 PDF로 업로드"], ['분량', 'A4 2쪽 이내 (표지 제외)'], ['준비물', '리트머스 종이(과학실 대여), 실험 과정 사진']];
  let y = py + 196;
  rows.forEach(([l, v]) => { row(y, 60, l, v); y += 60; });
  y += 50;
  g.fillStyle = ink; g.font = `700 25px ${F}`; g.fillText('■ 평가 기준', px + 40, y); y += 22;
  const crit = [['평가 항목', '배점'], ['탐구 문제가 구체적인가', '10'], ['실험 설계와 변인 통제가 적절한가', '15'], ['결과를 표 또는 그래프로 1개 이상 분석했는가', '15'], ['결론과 탐구의 한계를 서술했는가', '10'], ['합계', '50']];
  const cw = pw - 80, sw = 130;
  crit.forEach(([k, v], n) => {
    const h = 54, head = n === 0 || n === crit.length - 1;
    if (head) { g.fillStyle = '#ebebe6'; g.fillRect(px + 40, y, cw, h); }
    g.strokeStyle = '#333'; g.lineWidth = 1.4; g.strokeRect(px + 40, y, cw, h);
    g.beginPath(); g.moveTo(px + 40 + cw - sw, y); g.lineTo(px + 40 + cw - sw, y + h); g.stroke();
    g.fillStyle = ink; g.font = `${head ? 700 : 400} 21px ${F}`; g.fillText(k, px + 58, y + 35);
    g.textAlign = 'center'; g.fillText(v, px + 40 + cw - sw / 2, y + 35); g.textAlign = 'left';
    y += h;
  });
  y += 56;
  g.font = `400 20px ${F}`; g.fillStyle = '#2a2a2a';
  ['※ 기한이 지난 뒤 제출하면 하루마다 2점 감점합니다.', '※ 다른 사람의 보고서를 베끼거나 AI가 쓴 글을 그대로 내면 0점 처리합니다.', '※ 실험은 보호자와 함께하고 안전 수칙을 지킵니다.'].forEach((t, n) => g.fillText(t, px + 40, y + n * 38));
  const aiNoteY = y + 38;
  g.textAlign = 'right'; g.fillStyle = '#555'; g.fillText('과학과', px + pw - 40, py + ph - 40); g.textAlign = 'left';
  g.strokeStyle = pen; g.lineWidth = 3; g.lineCap = 'round';
  const dateY = py + 196 + 2 * 60 + 30;
  g.beginPath(); g.ellipse(px + 345, dateY, 160, 30, -0.03, 0, Math.PI * 2); g.stroke();
  g.fillStyle = pen; g.font = '700 38px "Gaegu",cursive'; g.fillText('← 국어 낭송 다음 날!!', px + 530, dateY + 12);
  g.strokeStyle = '#c0392b'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(px + 300, aiNoteY + 8); g.lineTo(px + 720, aiNoteY + 6); g.stroke();
  g.restore();
  for (let n = 0; n < 2600; n++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * Wc, Math.random() * Hc, 1.5, 1.5); }
  // where the name ended up after the page rotation
  const cx = Wc / 2, cy = Hc / 2, cs = Math.cos(ang), sn = Math.sin(ang);
  const pts = [[nb[0], nb[1]], [nb[0] + nb[2], nb[1]], [nb[0], nb[1] + nb[3]], [nb[0] + nb[2], nb[1] + nb[3]]].map(([x, yy]) => [cx + (x - cx) * cs - (yy - cy) * sn, cy + (x - cx) * sn + (yy - cy) * cs]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const box = { x: Math.min(...xs) / Wc, y: Math.min(...ys) / Hc, w: (Math.max(...xs) - Math.min(...xs)) / Wc, h: (Math.max(...ys) - Math.min(...ys)) / Hc, label: '이름·학번', ai: true };
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88));
  return { blob, box };
}

/* ---------- handlers ---------- */
function setView(v) {
  if (v === 'more') { sheet = { kind: 'more' }; render(); return; }
  if (v === 'capture' && cap.step === 4) capReset();
  state.view = v; state.detail = null; editing = null; sheet = null;
  try { history.replaceState(null, '', '#' + v); } catch (e) { /* hash not writable here */ }
  save(); render(); goTop();
}
const H = {
  go: setView,
  open(id) { state.detail = id; state.detailTab = state.detailTab || 'check'; editing = null; sheet = null; render(); goTop(); },
  openPlan(id) { state.detail = id; state.detailTab = 'plan'; editing = null; sheet = null; render(); goTop(); },
  back() { state.detail = null; state.view = 'board'; editing = null; render(); goTop(); },
  detailTab(v) { state.detailTab = v; save(); render(); },
  boardFilter(v) { state.boardFilter = v; save(); render(); },
  boardSubject(v) { state.boardSubject = v; save(); render(); },
  toggleStep(arg) {
    const [id, i] = arg.split(':'); const a = find(id); const s = a && a.steps[+i]; if (!s) return;
    s.done = !s.done; s.doneAt = s.done ? today() : null;
    save(); render();
    if (s.done) toast(a.steps.every(x => x.done) ? `${a.subject} 수행평가의 모든 단계를 끝냈어요!` : `${s.name} 완료!`);
  },
  toggleCheck(arg) { const k = arg.indexOf(':'); const a = find(arg.slice(0, k)); if (!a) return; const key = arg.slice(k + 1); a.checked[key] = !a.checked[key]; save(); render(); },
  skipToday() {
    const t = today();
    const missed = allBlocks().filter(b => b.date === t && !stepOf(b).done).map(b => `${find(b.aid).subject} · ${stepOf(b).name} (${hm(b.start)}–${hm(b.end)})`);
    if (!state.skips.includes(t)) state.skips.push(t);
    PLANS = buildPlans();
    const nx = allBlocks()[0];
    const when = nx ? `${md(nx.date)} ${hm(nx.start)}` : '';
    const nextLine = nx ? `${when} ${find(nx.aid).subject} · ${stepOf(nx).name} (마감 ${dday(find(nx.aid).due)})` : '';
    const what = nx ? `${find(nx.aid).subject} ${stepOf(nx).name}` : '';
    state.cheer = { date: t, ai: false, text: nx ? {
      friend: `괜찮아, ${when}으로 옮겼어. ${what}부터 하면 돼!`, coach: `계획을 다시 짰어요. ${when}에 ${what}부터 시작해요.`, cheer: `오케이! ${when}에 ${what}부터 다시 달려 보자!` }[state.settings.tone] : '괜찮아요, 남은 계획이 없어요.' };
    save(); render();
    if (aiReady()) aiCheer(missed, nextLine);
  },
  unskip() { state.skips = state.skips.filter(d => d !== today()); state.cheer = null; save(); render(); },
  stop(key) { if (busy[key]) busy[key].ctl.abort(); },
  startEdit(id) { const a = find(id); if (!a) return; state.detail = id; editing = { id, f: toForm(a) }; render(); },
  cancelEdit() { editing = null; render(); },
  saveEdit() {
    const a = editing && find(editing.id); if (!a) return;
    if (!validForm(editing.f)) { toast('과목, 이름, 마감일은 꼭 채워 주세요'); return; }
    const before = a.rubric.join('|');
    Object.assign(a, fromForm(editing.f));
    if (a.rubric.join('|') !== before) { a.checklist = null; a.checked = {}; }
    editing = null; save(); render(); toast('수행 카드를 고쳤어요');
  },
  del(id) {
    if (confirmKey !== 'del:' + id) { arm('del:' + id); return; }
    confirmKey = null;
    const a = find(id); if (a) a.photoIds.forEach(p => PhotoStore.del(p));
    state.cards = state.cards.filter(x => x.id !== id); state.detail = null; state.view = 'board';
    save(); render(); toast('수행 카드를 삭제했어요');
  },
  rubricAI(id) { aiRubric(id); },
  stepsAI(id) { aiSteps(id); },
  stepsDefault(id) {
    const a = find(id); if (!a) return;
    const talk = /발표|말하기|낭송|가창|노래|연주|실기/.test(a.type + a.title + a.method);
    a.steps = talk
      ? [step('내용 개요', 30, '말할 내용을 3부분으로 메모'), step('연습 1차', 40, '메모 보며 끝까지 해 보기'), step('연습 2차와 녹음', 40, '메모 없이 녹음하고 시간 재기'), step('채점 기준 점검', 20, '체크리스트 모두 확인')]
      : [step('자료 조사', 50, '믿을 만한 출처 3개를 메모'), step('개요', 30, '목차와 넣을 내용 정리'), step('초안', 60, '처음부터 끝까지 한 번 완성'), step('다듬기', 40, '분량과 형식 맞추기'), step('채점 기준 점검', 20, '체크리스트 모두 확인')];
    save(); render(); toast('기본 단계를 넣고 빈 시간에 배치했어요');
  },
  cardAsk(arg) { const k = arg.indexOf('|'); aiCardChat(arg.slice(0, k), arg.slice(k + 1)); },
  cardSend(id) { const q = (cardDrafts[id] || '').trim(); if (!q) return; cardDrafts[id] = ''; aiCardChat(id, q); },
  chatAsk(q) { aiChat(q); },
  chatSend() { const q = chatDraft.trim(); if (!q) return; chatDraft = ''; aiChat(q); },
  clearChat() { state.chat = []; save(); render(); },
  capRemoveImage(i) { const x = cap.images.splice(+i, 1)[0]; if (x) URL.revokeObjectURL(x.url); render(); },
  async exHandout() {
    if (cap.images.some(x => x.ex === 'handout')) return;
    const r = await makeHandout();
    if (!r.blob) { toast('예시 사진을 만들지 못했어요'); return; }
    cap.images.push({ blob: r.blob, url: URL.createObjectURL(r.blob), name: '예시 과학 학습지', ex: 'handout', boxes: [], exBoxes: [r.box] });
    errors.read = null; render();
  },
  exChat() { cap.text = exampleChat(); errors.read = null; render(); },
  capRead() { capRead(); },
  capManual() { cap.items.push({ ai: null, f: toForm({}), err: null }); cap.step = 3; render(); },
  capDrop(i) { cap.items.splice(+i, 1); render(); },
  capSave() { capSave(); },
  capRestart() { capReset(); render(); goTop(); },
  unmask(arg) { const [i, j] = arg.split(':').map(Number); if (cap.images[i]) { cap.images[i].boxes.splice(j, 1); render(); } },
  weekNav(n) { state.weekOffset = +n === 0 ? 0 : state.weekOffset + +n; save(); render(); },
  addAcademy() { state.academies.push({ id: uid('ac'), label: '새 학원', days: [1], start: 1080, end: 1200 }); save(); render(); },
  delAcademy(id) { state.academies = state.academies.filter(a => a.id !== id); save(); render(); },
  toggleDay(arg) {
    const [id, d] = arg.split(':'); const a = state.academies.find(x => x.id === id); if (!a) return;
    const n = +d; a.days = a.days.includes(n) ? a.days.filter(x => x !== n) : a.days.concat(n).sort();
    save(); render();
  },
  ttApply() { state.academies.push(...(ttDraft || [])); ttDraft = null; save(); render(); toast('학원 일정을 추가했어요'); },
  ttCancel() { ttDraft = null; render(); },
  setFocus(v) { state.settings.focus = v; save(); render(); toast(`${FOCUS[v].label} 시간에 먼저 계획해요`); },
  setTone(v) { state.settings.tone = v; save(); render(); },
  setSolid(v) { state.settings.solid = v === 'solid'; save(); render(); setupLens(); },
  reseed() { const ids = new Set(state.cards.map(a => a.id)); state.cards.push(...seedCards().filter(a => !ids.has(a.id))); save(); render(); toast('예시 카드를 넣었어요'); },
  copyData() { copyText(JSON.stringify({ cards: state.cards, academies: state.academies, settings: state.settings }, null, 2)); },
  resetAll() {
    if (confirmKey !== 'reset') { arm('reset'); return; }
    confirmKey = null;
    state.cards.forEach(a => a.photoIds.forEach(p => PhotoStore.del(p)));
    Object.assign(state, fresh(), { cards: [] });
    capReset(); save(); setView('today'); toast('모두 지웠어요');
  },
  clearLog() { if (confirmKey !== 'log') { arm('log'); return; } confirmKey = null; state.log = []; save(); render(); },
  copyLog() { copyText(logTSV(), document.getElementById('log-table')); },
  copyPrompt(k) { if (P[k]) copyText(P[k].tpl, document.getElementById('pre-' + k)); },
  clearExamples() { state.cards = state.cards.filter(a => !a.example); save(); render(); toast('예시 카드를 지웠어요'); },
  photo(id) { sheet = { kind: 'photo', id }; render(); },
  closeSheet() { sheet = null; render(); },
  scrim(arg, el, e) { if (e.target === el) { sheet = null; render(); } }
};

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = H[el.dataset.act];
  if (!fn) return;
  if (el.dataset.act === 'scrim' && e.target !== el) return;
  fn(el.dataset.arg || '', el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheet) { sheet = null; render(); return; }
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('[role="button"][data-act]')) { e.preventDefault(); t.click(); return; }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    if (t.id === 'chat-in') { e.preventDefault(); H.chatSend(); }
    else if (t.dataset && t.dataset.cq) { e.preventDefault(); H.cardSend(t.dataset.cq); }
  }
});
document.addEventListener('input', e => {
  const el = e.target, d = el.dataset || {};
  if (d.bind === 'capText') { cap.text = el.value; errors.read = null; }
  else if (d.bind === 'chatDraft') chatDraft = el.value;
  else if (d.cf) { const [i, k] = d.cf.split(':'); const it = cap.items[+i]; if (it) { it.f[k] = el.value; it.err = null; } }
  else if (d.edit && editing) editing.f[d.edit] = el.value;
  else if (d.cq) cardDrafts[d.cq] = el.value;
  else if (d.text) { state.settings[d.text] = el.value; save(); }
  else if (d.ac && d.ac.endsWith(':label')) { const a = state.academies.find(x => x.id === d.ac.split(':')[0]); if (a) { a.label = el.value; save(); } }
});
document.addEventListener('change', async e => {
  const el = e.target, d = el.dataset || {};
  if (el.id === 'cap-file') { capAddFiles(el.files); el.value = ''; return; }
  if (el.id === 'tt-file') {
    const files = Array.from(el.files || []).filter(f => f.type.startsWith('image/')); el.value = '';
    if (!files.length) return;
    if (!aiReady() || !imageLimits) { errors.timetable = aiReady() ? ERR.images_unavailable : aiOffText(); render(); return; }
    const r = await aiTimetable(files.slice(0, maxImages()), '');
    if (r) { ttDraft = r; render(); }
    return;
  }
  if (d.cf || d.edit) { const [i, k] = (d.cf || '').split(':'); if (d.cf && cap.items[+i]) cap.items[+i].f[k] = el.value; if (d.edit && editing) editing.f[d.edit] = el.value; return; }
  if (d.text) { render(); return; }
  if (d.se != null && el.value) { state.settings.schoolEnd[+d.se] = toMin(el.value); save(); render(); return; }
  if (d.set) {
    const k = d.set;
    if (el.type === 'time') { if (el.value) state.settings[k] = toMin(el.value); }
    else {
      const lim = { cap: [30, 240], weekendCap: [30, 360], travel: [0, 60] }[k], n = Number(el.value);
      if (Number.isFinite(n) && lim) state.settings[k] = clamp(Math.round(n), lim[0], lim[1]);
    }
    save(); render(); return;
  }
  if (d.ac && !d.ac.endsWith(':label')) {
    const [id, f] = d.ac.split(':'); const a = state.academies.find(x => x.id === id);
    if (a && el.value) { a[f] = toMin(el.value); save(); render(); }
  }
});
document.addEventListener('paste', e => {
  if (state.view !== 'capture' || state.detail || cap.step !== 1) return;
  const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); capAddFiles(files); }
});
document.addEventListener('dragover', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', e => { const d = e.target.closest && e.target.closest('#drop'); if (d && !d.contains(e.relatedTarget)) d.classList.remove('over'); });
document.addEventListener('drop', e => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.remove('over'); capAddFiles(e.dataTransfer.files); } });

/* drag on a photo to add a mask */
let dragMask = null;
document.addEventListener('pointerdown', e => {
  const st = e.target.closest && e.target.closest('.mask-stage');
  if (!st || e.target.closest('button')) return;
  const r = st.getBoundingClientRect();
  dragMask = { i: +st.dataset.stage, r, x0: (e.clientX - r.left) / r.width, y0: (e.clientY - r.top) / r.height, el: null, stage: st };
  st.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!dragMask) return;
  const { r, x0, y0 } = dragMask;
  const x1 = clamp((e.clientX - r.left) / r.width, 0, 1), y1 = clamp((e.clientY - r.top) / r.height, 0, 1);
  const b = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  dragMask.box = b;
  if (!dragMask.el) { dragMask.el = document.createElement('div'); dragMask.el.className = 'mask-box draft'; dragMask.stage.appendChild(dragMask.el); }
  Object.assign(dragMask.el.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' });
});
document.addEventListener('pointerup', () => {
  if (!dragMask) return;
  const b = dragMask.box, img = cap.images[dragMask.i];
  dragMask = null;
  if (b && img && b.w > 0.02 && b.h > 0.01) { img.boxes.push({ ...b, label: '가림', ai: false }); }
  render();
});

/* ---------- Liquid Glass refraction (Chromium: SVG displacement in backdrop-filter) ---------- */
function sdRoundedRect(px, py, hw, hh, r) {
  const qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function lensMap(width, height, radius, bevel) {
  const ss = 2, w = Math.round(width * ss), h = Math.round(height * ss);
  const hi = document.createElement('canvas'); hi.width = w; hi.height = h;
  const ctx = hi.getContext('2d'), img = ctx.createImageData(w, h), data = img.data;
  const hw = w / 2, hh = h / 2, r = Math.min(radius * ss, hw, hh), bev = bevel * ss;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x - hw + .5, py = y - hh + .5, d = sdRoundedRect(px, py, hw, hh, r);
    let dx = 0, dy = 0;
    if (d > -bev && d < 0) {
      const t = 1 + d / bev, inc = Math.acos(clamp(t, 0, 1)), tr = Math.asin(Math.min(1, Math.sin(inc) / 1.5));
      const mag = Math.tan(inc - tr) * 3.2;
      const gx = sdRoundedRect(px + 1, py, hw, hh, r) - sdRoundedRect(px - 1, py, hw, hh, r);
      const gy = sdRoundedRect(px, py + 1, hw, hh, r) - sdRoundedRect(px, py - 1, hw, hh, r);
      const len = Math.hypot(gx, gy) || 1;
      dx = -gx / len * mag; dy = -gy / len * mag;
    }
    const i = (y * w + x) * 4;
    data[i] = clamp(Math.round(128 + dx * 127), 0, 255); data[i + 1] = clamp(Math.round(128 + dy * 127), 0, 255); data[i + 2] = 128; data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const lo = document.createElement('canvas'); lo.width = Math.round(width); lo.height = Math.round(height);
  const lc = lo.getContext('2d'); lc.imageSmoothingQuality = 'high'; lc.drawImage(hi, 0, 0, lo.width, lo.height);
  return lo.toDataURL();
}
const lensOK = (() => {
  try {
    if (matchMedia('(prefers-reduced-transparency: reduce)').matches || matchMedia('(prefers-contrast: more)').matches) return false;
    const p = document.createElement('div'); p.style.backdropFilter = 'url(#x)';
    return p.style.backdropFilter.includes('url');
  } catch (e) { return false; }
})();
const lensSizes = new WeakMap();
function lensFor(el, n) {
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
  if (!w || !h || w * h > 900000) return;
  const prev = lensSizes.get(el);
  if (prev && prev.w === w && prev.h === h) return;
  lensSizes.set(el, { w, h });
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20;
  const id = 'lens-' + n, defs = document.getElementById('lens-defs');
  let f = document.getElementById(id);
  if (!f) { f = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); f.id = id; defs.appendChild(f); }
  f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', w); f.setAttribute('height', h);
  f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('color-interpolation-filters', 'sRGB');
  f.innerHTML = `<feImage href="${lensMap(w, h, radius, Math.min(18, h / 3))}" x="0" y="0" width="${w}" height="${h}" result="map" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" scale="${Math.min(40, h / 2)}" xChannelSelector="R" yChannelSelector="G"/>`;
  el.style.setProperty('--lens', `url(#${id})`);
  el.setAttribute('data-lens-on', '');
}
function setupLens() {
  document.querySelectorAll('[data-lens]').forEach(el => {
    if (!lensOK || state.settings.solid) { el.removeAttribute('data-lens-on'); return; }
    lensFor(el, el.dataset.lens);
  });
}
if (lensOK && 'ResizeObserver' in window) {
  let t = null;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(setupLens, 160); });
  document.querySelectorAll('[data-lens]').forEach(el => ro.observe(el));
}

/* ---------- boot ---------- */
(function boot() {
  const h = location.hash.slice(1);
  if (VIEWS[h]) { state.view = h; state.detail = null; }
  if (!VIEWS[state.view]) state.view = 'today';
  initAI();
  render();
  setupLens();
})();
