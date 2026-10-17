'use strict';
/* 수행 내비 — views: 오늘, 수행 보드, 수행 카드 */

const upcomingCards = () => state.cards.filter(a => a.due && diffDays(today(), a.due) >= 0).sort(byDue);
const allDone = a => a.steps.length > 0 && a.steps.every(s => s.done);

function naviLine() {
  const tone = state.settings.tone, t = today();
  const crunch = crunchWeeks().find(w => diffDays(t, w.cards[0].due) <= 14);
  const blocks = skippedToday() ? [] : allBlocks().filter(b => b.date === t && !stepOf(b).done);
  if (crunch) {
    const n = crunch.cards.length, first = crunch.cards[0].subject;
    return { friend: `${mdShort(crunch.monday)} 주에 ${n}과목이 겹쳐! ${first}는 이번 주에 시작하자`, coach: `${mdShort(crunch.monday)} 주에 ${n}과목이 겹쳐요. ${first}부터 미리 시작해요.`, cheer: `${n}과목 몰림 주가 온다! ${first}부터 미리 끝내 보자!` }[tone];
  }
  if (blocks.length) {
    const b = blocks[0], s = stepOf(b), mins = b.end - b.start;
    return { friend: `오늘은 ${s.name}부터! ${mins}분이면 충분해`, coach: `오늘은 ${hm(b.start)}에 ${s.name}부터 시작해요. ${mins}분이에요.`, cheer: `${s.name} ${mins}분! 오늘도 가볍게 해치우자!` }[tone];
  }
  return { friend: '오늘은 계획이 없어. 푹 쉬어도 돼!', coach: '오늘은 계획된 작업이 없어요. 내일 일정을 한 번 확인해 두세요.', cheer: '오늘은 쉬는 날! 충전하고 내일 달리자!' }[tone];
}

/* ---------- 오늘 ---------- */
function taskRow(b) {
  const a = find(b.aid), s = a.steps[b.step];
  return `<div class="gi task${s.done ? ' is-done' : ''}">
    <input type="checkbox" class="ck" data-act="toggleStep" data-arg="${a.id}:${b.step}" ${s.done ? 'checked' : ''} aria-label="${esc(s.name)} 완료">
    <span class="tp">${hm(b.start)}–${hm(b.end)}</span>
    <div class="task-t"><b>${esc(s.name)}${b.parts > 1 ? ` <span class="faint">(${b.part}/${b.parts})</span>` : ''}</b><small>${esc(a.subject)} · ${esc(a.title)} · ${esc(s.check)}</small></div>
    <button class="btn btn-soft btn-icon btn-sm" data-act="open" data-arg="${a.id}" aria-label="${esc(a.title)} 열기">${icon('next')}</button>
  </div>`;
}
function crunchAlerts(compact) {
  const t = today();
  return crunchWeeks().map(w => {
    const first = diffDays(t, w.cards[0].due), near = first <= 14;
    return `<div class="alert-card${near ? '' : ' soft'} rise">
      <span class="a-ico">${icon('flame')}</span>
      <div><h3>몰림 경보 · ${mdShort(w.monday)} 주에 수행평가 ${w.cards.length}개</h3>
        <p>첫 마감까지 ${first}일 남았어요. 몰린 주는 여유 시간을 2배로 잡아서 미리 시작하게 계획했어요.</p>
        ${compact ? '' : `<div class="starts">${w.cards.map(a => { const p = PLANS[a.id]; return `<button class="chip hue" style="${hueVar(a.subject)};background:var(--card);color:var(--ink);border:0;cursor:pointer" data-act="open" data-arg="${a.id}">${esc(a.subject)} · ${p && p.start ? md(p.start) + ' 시작' : a.steps.length ? '완료' : '단계 나누기 전'}</button>`; }).join('')}</div>`}
      </div></div>`;
  }).join('');
}
function weekDots() {
  const t = today(), m0 = mondayOf(t), blocks = allBlocks(), wc = weekCounts();
  const crunch = (wc[m0] || []).length >= 3;
  let html = '<div class="weekdots">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(m0, i);
    const bl = blocks.filter(b => b.date === d).slice(0, 5);
    const dues = state.cards.filter(a => a.due === d);
    html += `<div class="wd${d === t ? ' today' : ''}${crunch ? ' crunch' : ''}"><small>${WD[dow(d)]}</small><b>${parseYmd(d).getDate()}</b>
      <span class="dots">${bl.map(b => `<i class="hue" style="${hueVar(find(b.aid).subject)}"></i>`).join('')}${dues.map(a => `<i class="due" title="${esc(a.subject)} 마감"></i>`).join('')}</span></div>`;
  }
  return html + '</div>';
}
function miniCard(a) {
  return `<button class="mini cell hue" style="${hueVar(a.subject)}" data-act="open" data-arg="${a.id}">
    <span class="row-sb">${tag(a.subject)}${ddayBadge(a)}</span><b>${esc(a.title)}</b>
    <span class="small faint num">${md(a.due)} ${esc(a.dueTime || '')}</span>
    <span class="bar hue" style="${hueVar(a.subject)}"><i style="width:${Math.round(progressOf(a) * 100)}%"></i></span></button>`;
}
function viewToday() {
  const t = today(), s = state.settings, skipped = skippedToday();
  const blocks = skipped ? [] : allBlocks().filter(b => b.date === t);
  const left = blocks.filter(b => !stepOf(b).done).length;
  const up = upcomingCards();
  const weekDue = up.filter(a => mondayOf(a.due) === mondayOf(t)).length;
  const doneSteps = state.cards.reduce((n, a) => n + a.steps.filter(x => x.done).length, 0);
  const headline = skipped ? '오늘은 <em>쉬어 가는 날</em>이에요'
    : blocks.length ? (left ? `오늘은 <em>수행 ${left}개</em>만 하면 돼요` : '오늘 할 일을 <em>다 끝냈어요</em>')
    : '오늘은 <em>계획이 없어요</em>';
  const nextDue = up[0];
  let todayBody;
  if (skipped) {
    const c = state.cheer && state.cheer.date === t ? state.cheer : null;
    todayBody = `<div class="grid g2">
      <div class="note"><small>수행 내비${c && c.ai ? ' · AI' : ''}</small><span data-live="cheer">${esc(c ? c.text : '괜찮아요, 남은 일은 내일부터 다시 나눴어요.')}</span></div>
      <div class="cell pad stack"><b>남은 일은 내일부터 다시 짰어요</b><p class="small muted">못 한 날이 있어도 마감은 지켜지게 예비일과 여유 시간을 다시 계산했어요.</p>${busyRow('cheer')}<div><button class="btn btn-line btn-sm" data-act="unskip">오늘 다시 할래요</button></div></div></div>`;
  } else if (blocks.length) {
    todayBody = `<div class="group">${blocks.map(taskRow).join('')}
      <div class="gi" style="justify-content:space-between;flex-wrap:wrap"><span class="small faint">계획은 학원 시간을 피해서 ${esc(FOCUS[s.focus].label)} 시간에 먼저 넣었어요.</span><button class="btn btn-line btn-sm" data-act="skipToday">${icon('moon')}오늘 못 했어요</button></div></div>`;
  } else {
    const nx = allBlocks().find(b => diffDays(t, b.date) > 0);
    todayBody = `<div class="cell dash empty">${emptyArt()}<b>오늘은 계획된 수행 작업이 없어요</b>${nx ? `<p class="small muted">다음 일정 · <b class="num">${md(nx.date)} ${hm(nx.start)}</b> ${esc(find(nx.aid).subject)} ${esc(stepOf(nx).name)}</p>` : '<p class="small muted">수행 카드에서 단계를 나누면 빈 시간에 계획이 생겨요.</p>'}</div>`;
  }
  return {
    title: '오늘', sub: mdLong(t),
    actions: `<button class="btn btn-sun" data-act="go" data-arg="capture">${icon('camera')}새 수행 카드</button>`,
    body: `
    <section class="hero rise">
      <div><div class="eyebrow">${mdLong(t)}</div>
        <h2>${esc(s.name || '')}${s.name ? '님, ' : ''}${headline}</h2>
        <p>${nextDue ? `가장 가까운 마감은 ${esc(nextDue.subject)} ${esc(nextDue.title)}, ${dday(nextDue.due)}예요.` : '등록된 수행평가가 없어요. 공지 사진을 찍어 시작해 보세요.'}</p>
        <div class="hero-stats"><span>오늘 <b>${left}</b>개</span><span>이번 주 마감 <b>${weekDue}</b>개</span><span>완료한 단계 <b>${doneSteps}</b>개</span></div>
      </div>
      <div class="note" aria-label="수행 내비 한마디"><small>수행 내비 한마디</small>${esc(naviLine())}</div>
    </section>
    ${crunchAlerts(false)}
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:44">${icon('sun')}</span>오늘 할 일</h2>${blocks.length ? `<span class="chip">${blocks.length - left}/${blocks.length} 완료</span>` : ''}</div>${todayBody}</section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:152">${icon('calendar')}</span>이번 주</h2><button class="btn btn-soft btn-sm" data-act="go" data-arg="week">주간 계획 ${icon('next')}</button></div>${weekDots()}</section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:214">${icon('flag')}</span>다가오는 마감</h2><button class="btn btn-soft btn-sm" data-act="go" data-arg="board">보드 전체 ${icon('next')}</button></div>
      ${up.length ? `<div class="hscroll">${up.map(miniCard).join('')}</div>` : `<div class="cell dash empty">${emptyArt()}<b>아직 수행 카드가 없어요</b><button class="btn btn-pri btn-sm" data-act="go" data-arg="capture">${icon('camera')}공지 사진으로 만들기</button></div>`}
    </section>`
  };
}

/* ---------- 수행 보드 ---------- */
function scard(a) {
  const pct = progressOf(a), cl = checklistCount(a);
  return `<div class="scard cell hue" style="${hueVar(a.subject)}" role="button" tabindex="0" data-act="open" data-arg="${a.id}">
    <div class="scard-top">${tile(a.subject)}<div class="meta"><small>${esc(a.subject)}${a.type ? ' · ' + esc(a.type) : ''}</small><span class="small num faint">${md(a.due)} ${esc(a.dueTime || '')}</span></div>${ddayBadge(a)}</div>
    <div class="scard-title">${esc(a.title)}</div>
    <div class="row">${a.weight ? `<span class="chip">${esc(a.weight)}</span>` : ''}${a.photoIds.length ? `<span class="chip blue">${icon('image')}원본</span>` : ''}${a.example ? '<span class="chip ex">예시</span>' : ''}</div>
    <div class="scard-foot">${ring(pct, a.subject, `진행 ${Math.round(pct * 100)}%`)}<div style="flex:1;min-width:0" class="stack-s">
      <span class="small muted">${a.steps.length ? `단계 ${a.steps.filter(s => s.done).length}/${a.steps.length}` : '단계 나누기 전'} · ${cl ? `체크 ${cl.done}/${cl.total}` : '기준 풀기 전'}</span>
      <span class="bar"><i style="width:${Math.round(pct * 100)}%"></i></span></div></div>
  </div>`;
}
function viewBoard() {
  const t = today(), f = state.boardFilter, subj = state.boardSubject;
  const subjects = [...new Set(state.cards.map(a => a.subject))];
  let list = state.cards.filter(a => a.due);
  if (f === 'open') list = list.filter(a => diffDays(t, a.due) >= 0 && !allDone(a));
  if (f === 'done') list = list.filter(allDone);
  if (f === 'past') list = list.filter(a => diffDays(t, a.due) < 0);
  if (subj) list = list.filter(a => a.subject === subj);
  list.sort(byDue);
  if (f === 'past') list.reverse();
  const wc = weekCounts(), m0 = mondayOf(t);
  const groups = [];
  for (const a of list) {
    const k = mondayOf(a.due);
    let g = groups.find(x => x.k === k);
    if (!g) groups.push(g = { k, items: [] });
    g.items.push(a);
  }
  const label = k => { const n = diffDays(m0, k) / 7; return n === 0 ? '이번 주' : n === 1 ? '다음 주' : n === -1 ? '지난주' : `${mdShort(k)} 주`; };
  const segBtn = (v, l) => `<button data-act="boardFilter" data-arg="${v}" aria-pressed="${f === v}">${l}</button>`;
  const openCount = state.cards.filter(a => a.due && diffDays(t, a.due) >= 0 && !allDone(a)).length;
  return {
    title: '수행 보드', sub: `진행 중 ${openCount}개 · 날짜순으로 모았어요`,
    actions: `<button class="btn btn-sun" data-act="go" data-arg="capture">${icon('camera')}새 수행 카드</button>`,
    body: `
    <div class="row-sb"><div class="seg" role="group" aria-label="보기">${segBtn('open', '진행 중')}${segBtn('done', '완료')}${segBtn('past', '지난 것')}${segBtn('all', '전체')}</div>
      ${state.cards.some(a => a.example) ? `<button class="btn btn-soft btn-sm" data-act="clearExamples">예시 카드 지우기</button>` : ''}</div>
    ${subjects.length > 1 ? `<div class="pills"><button class="pill-btn" data-act="boardSubject" data-arg="" aria-pressed="${!subj}">전체 과목</button>${subjects.map(s => `<button class="pill-btn hue" style="${hueVar(s)}" data-act="boardSubject" data-arg="${esc(s)}" aria-pressed="${subj === s}"><i style="width:8px;height:8px;border-radius:50%;background:var(--tile-dot)"></i>${esc(s)}</button>`).join('')}</div>` : ''}
    ${groups.length ? groups.map(g => {
      const n = (wc[g.k] || []).length;
      return `<section class="sec"><div class="week-h"><h3>${label(g.k)}</h3><span class="chip num">${mdShort(g.k)}–${mdShort(addDays(g.k, 6))}</span>${n >= 3 ? `<span class="chip orange">${icon('flame')}몰림 ${n}개</span>` : n === 2 ? '<span class="chip sun">2개 겹침</span>' : ''}</div>
        <div class="cards">${g.items.map(scard).join('')}</div></section>`;
    }).join('') : `<div class="cell dash empty">${emptyArt()}<b>${f === 'done' ? '아직 끝낸 수행평가가 없어요' : f === 'past' ? '지난 수행평가가 없어요' : '보여 줄 수행 카드가 없어요'}</b><p class="small muted">공지 사진 한 장이면 수행 카드가 만들어져요.</p><button class="btn btn-pri btn-sm" data-act="go" data-arg="capture">${icon('camera')}새 수행 카드</button></div>`}`
  };
}

/* ---------- 수행 카드 ---------- */
let editing = null; // {id, f}
function kvRow(k, v) { return `<div class="kv"><span class="k">${k}</span><div class="v">${v}</div></div>`; }
function cardTable(a) {
  if (editing && editing.id === a.id) {
    const f = editing.f;
    const inp = (k, type) => `<input class="input" id="ed-${k}" data-edit="${k}" ${type ? `type="${type}"` : ''} value="${esc(f[k])}">`;
    return `<div class="kvt"><div class="kvt-h"><span>수행 카드 고치기</span></div>
      ${kvRow('과목', inp('subject'))}${kvRow('유형', `<select class="input" id="ed-type" data-edit="type">${['', ...TYPES].map(t => `<option ${t === f.type ? 'selected' : ''} value="${esc(t)}">${t || '선택 안 함'}</option>`).join('')}</select>`)}
      ${kvRow('이름', inp('title'))}${kvRow('마감', `<div class="row">${inp('due', 'date')}${`<input class="input" id="ed-dueTime" data-edit="dueTime" value="${esc(f.dueTime)}" placeholder="교시·시각" style="max-width:140px">`}</div>`)}
      ${kvRow('제출', inp('method'))}${kvRow('준비물', inp('materials'))}${kvRow('반영', inp('weight'))}
      ${kvRow('채점 기준', `<textarea class="input" id="ed-rubric" data-edit="rubric" rows="4">${esc(f.rubric)}</textarea>`)}
      <div class="kvt-f" style="justify-content:flex-end"><button class="btn btn-soft btn-sm" data-act="cancelEdit">취소</button><button class="btn btn-pri btn-sm" data-act="saveEdit">${icon('check')}저장</button></div></div>`;
  }
  const photos = a.photoIds.length ? `<div class="row">${a.photoIds.map(id => `<button class="photo-btn" data-act="photo" data-arg="${esc(id)}" aria-label="원본 사진 보기"><img data-photo="${esc(id)}" alt=""></button>`).join('')}</div>`
    : `<span class="faint small">${a.source === 'manual' ? '직접 입력한 카드' : a.example ? '예시 카드' : '글로 입력한 공지'}</span>`;
  return `<div class="kvt"><div class="kvt-h"><span>수행 카드</span>${a.example ? '<span class="chip ex">예시</span>' : ''}</div>
    ${kvRow('과목', tag(a.subject))}${kvRow('유형', esc(a.type || '—'))}
    ${kvRow('마감', `<span class="num">${mdMid(a.due)}</span> ${esc(a.dueTime || '')}`)}
    ${kvRow('제출', esc(a.method || '—'))}${kvRow('준비물', esc(a.materials.join(', ') || '—'))}${kvRow('반영', esc(a.weight || '—'))}
    ${kvRow('채점 기준', a.rubric.length ? `<ul>${a.rubric.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '<span class="faint">공지에 없음</span>')}
    ${kvRow('원본', photos)}</div>`;
}
function tabCheck(a) {
  const key = 'rubric:' + a.id;
  const ck = (k, text) => `<label class="ckrow"><input type="checkbox" class="ck" data-act="toggleCheck" data-arg="${a.id}:${k}" ${a.checked[k] ? 'checked' : ''}><span>${esc(text)}</span></label>`;
  if (a.checklist) {
    const c = checklistCount(a);
    return `<div class="row-sb"><span class="chip green">${c.done}/${c.total} 확인</span>${aiBtn(key, '다시 풀기', 'rubricAI', a.id, 'btn-soft btn-sm', 'spark')}</div>
      <div class="crit">${a.checklist.criteria.map((cr, i) => `<div class="crit-i cell">${cr.original ? `<span class="o">원문 · ${esc(cr.original)}</span>` : ''}<span class="p">${esc(cr.plain)}</span>
        <div class="stack-s">${cr.checks.map((x, j) => ck(`c${i}-${j}`, x)).join('')}</div>${cr.tip ? `<span class="tip">${esc(cr.tip)}</span>` : ''}</div>`).join('')}</div>
      ${a.checklist.beforeSubmit.length ? `<div class="cell sunk pad stack-s"><b class="small">제출 직전 확인</b>${a.checklist.beforeSubmit.map((x, j) => ck(`b${j}`, x)).join('')}</div>` : ''}
      ${busyRow(key)}${errRow(key)}`;
  }
  if (!a.rubric.length) return `<div class="cell dash empty">${emptyArt()}<b>공지에 채점 기준이 없었어요</b><p class="small muted">선생님께 기준을 여쭤 보고 카드를 고쳐서 넣어 주세요.</p><button class="btn btn-line btn-sm" data-act="startEdit" data-arg="${a.id}">${icon('edit')}카드 고치기</button></div>`;
  return `<div class="cell pad stack"><b>선생님 말을 학생 말로</b><p class="small muted">"논리적 근거를 들어 설득력 있게 서술"을 "주장마다 근거 2개, 출처 1개 이상"처럼 바로 할 수 있는 체크리스트로 바꿔요.</p>
    <div class="row">${aiBtn(key, '학생 말로 풀기', 'rubricAI', a.id)}</div>${aiNote()}${busyRow(key)}${errRow(key)}</div>`;
}
function routeHtml(a, p) {
  const t = today(), rows = [];
  a.steps.forEach((s, i) => { if (s.done) rows.push(`<li class="done"><span class="stop"></span><div class="when">완료${s.doneAt ? `<b>${md(s.doneAt)}</b>` : ''}</div><div class="what"><label class="ckrow"><input type="checkbox" class="ck" checked data-act="toggleStep" data-arg="${a.id}:${i}"><span>${esc(s.name)}</span></label></div></li>`); });
  p.blocks.forEach(b => {
    const s = a.steps[b.step];
    rows.push(`<li class="${b.date === t ? 'today' : ''}"><span class="stop"></span><div class="when">${md(b.date)}${b.date === t ? ' · 오늘' : ''}<b>${hm(b.start)}–${hm(b.end)}</b></div>
      <div class="what"><label class="ckrow"><input type="checkbox" class="ck" data-act="toggleStep" data-arg="${a.id}:${b.step}"><span>${esc(s.name)}${b.parts > 1 ? ` <span class="faint">(${b.part}/${b.parts})</span>` : ''}</span></label><small>${esc(s.check)}</small></div></li>`);
  });
  if (p.buffer) rows.push(`<li class="buffer"><span class="stop"></span><div class="when"><b>${md(p.buffer)}</b></div><div class="what">${p.usedBuffer ? '예비일 · 시간이 모자라 일부를 넣었어요' : '예비일 · 일부러 비워 둔 날'}</div></li>`);
  rows.push(`<li class="goal"><span class="stop"></span><div class="when"><b>${md(a.due)}</b>${esc(a.dueTime || '')}</div><div class="what"><b>마감</b></div></li>`);
  return `<ol class="route hue" style="${hueVar(a.subject)}">${rows.join('')}</ol>`;
}
function tabPlan(a) {
  const key = 'steps:' + a.id, p = PLANS[a.id];
  if (!a.steps.length) {
    return `<div class="cell pad stack"><b>마감에서 거꾸로 계획해요</b><p class="small muted">AI가 이 과제에 맞게 단계를 나누면, 학원 시간을 피해서 빈 시간에 거꾸로 배치해요. 마감 전날은 예비일로 비워 둬요.</p>
      <div class="row">${aiBtn(key, '단계 나누기', 'stepsAI', a.id)}<button class="btn btn-line" data-act="stepsDefault" data-arg="${a.id}">기본 단계 쓰기</button></div>${aiNote()}${busyRow(key)}${errRow(key)}</div>`;
  }
  if (!p) return '';
  const chips = [];
  if (p.complete) chips.push('<span class="chip green">모든 단계 완료</span>');
  else if (p.late) chips.push('<span class="chip orange">마감이 지나 새 계획 없음</span>');
  else {
    chips.push(`<span class="chip">남은 작업 <b class="num">&nbsp;${dur(p.total)}</b></span>`, `<span class="chip blue">${md(p.start)} 시작</span>`);
    if (p.buffer) chips.push(`<span class="chip">예비일 ${md(p.buffer)}</span>`);
    if (p.factor === 2) chips.push(`<span class="chip orange">${icon('flame')}몰림 주 · 여유 2배</span>`);
  }
  const warn = p.unplaced ? `<p class="err">빈 시간이 ${dur(p.unplaced)} 모자라요. 시간표에서 하루 최대 시간을 늘리거나 학원 시간을 확인해 보세요.</p>`
    : p.tight && !p.complete ? '<p class="err">빠듯해요. 여유 없이 바로 시작해야 해요.</p>' : '';
  return `<div class="plan-sum">${chips.join('')}</div>${warn}${routeHtml(a, p)}
    <div class="row-end">${aiBtn(key, '단계 다시 나누기', 'stepsAI', a.id, 'btn-soft btn-sm', 'spark')}</div>${busyRow(key)}${errRow(key)}`;
}
function tabCoach(a) {
  const key = 'coach:' + a.id;
  const sugg = ['이거 대신 써 줘', '오늘 뭐부터 하면 돼?', '이 채점 기준이 무슨 뜻이야?'];
  const log = a.chat.map((m, i) => {
    const live = busy[key] && i === a.chat.length - 1 && m.role === 'ai';
    return m.role === 'me' ? `<div class="bub me">${esc(m.content)}</div>`
      : `<div class="bub ai"><span class="who">${icon('spark')}수행 내비</span><span ${live ? `data-live="${key}"` : ''}>${esc(m.content) || '생각 중…'}</span></div>`;
  }).join('');
  return `<div class="cell pad stack">
    ${a.chat.length ? `<div class="chatlog">${log}</div>` : `<div class="bub ai"><span class="who">${icon('spark')}수행 내비</span>이 수행평가에 대해 물어보세요. 결과물은 대신 쓰지 않고, 계획과 기준 이해를 도와요.</div>`}
    <div class="sugg">${sugg.map(q => `<button class="pill-btn" data-act="cardAsk" data-arg="${a.id}|${esc(q)}" ${aiReady() && !busy[key] ? '' : 'disabled'}>${esc(q)}</button>`).join('')}</div>
    <div class="row" style="flex-wrap:nowrap"><textarea class="input" id="cq-${a.id}" data-cq="${a.id}" rows="1" placeholder="예: 감상문 첫 문장이 안 떠올라">${esc(cardDrafts[a.id] || '')}</textarea>${busy[key] ? '' : `<button class="btn btn-pri btn-icon" data-act="cardSend" data-arg="${a.id}" aria-label="보내기" ${aiReady() ? '' : 'disabled'}>${icon('send')}</button>`}</div>
    ${aiNote()}${busyRow(key)}${errRow(key)}</div>`;
}
const cardDrafts = {};
function viewDetail(a) {
  const tab = state.detailTab;
  const segBtn = (v, l, ico) => `<button data-act="detailTab" data-arg="${v}" aria-pressed="${tab === v}">${l}</button>`;
  const body = tab === 'plan' ? tabPlan(a) : tab === 'coach' ? tabCoach(a) : tabCheck(a);
  return {
    title: esc(a.title), sub: `${esc(a.subject)} · ${mdMid(a.due)} 마감`,
    actions: `<button class="btn btn-soft btn-sm" data-act="startEdit" data-arg="${a.id}">${icon('edit')}고치기</button><button class="btn btn-danger btn-sm" data-act="del" data-arg="${a.id}">${confirmKey === 'del:' + a.id ? '한 번 더 누르면 삭제' : icon('trash') + '삭제'}</button>`,
    body: `
    <button class="btn btn-soft btn-sm back" data-act="back">${icon('back')}수행 보드</button>
    <section class="d-hero rise">${tile(a.subject, 'l')}<div class="t"><div class="row">${tag(a.subject)}${a.type ? `<span class="chip">${esc(a.type)}</span>` : ''}${a.weight ? `<span class="chip">반영 ${esc(a.weight)}</span>` : ''}</div><h2>${esc(a.title)}</h2></div>${ddayBadge(a)}</section>
    <div class="d-grid">
      <div class="stack">${cardTable(a)}</div>
      <div class="stack"><div class="seg" role="group" aria-label="수행 카드 도구">${segBtn('check', '기준 체크리스트')}${segBtn('plan', '역산 계획')}${segBtn('coach', '코칭')}</div>${body}</div>
    </div>`
  };
}
