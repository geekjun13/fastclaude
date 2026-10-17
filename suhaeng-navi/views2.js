'use strict';
/* 수행 내비 — views: 새 수행 카드, 주간 계획, 시간표 */

/* ---------- 새 수행 카드: 모으기 → 읽고 풀기 → 확인하기 → 이끌기 ---------- */
const cap = { step: 1, images: [], text: '', items: [], fallback: false, saved: [], draft: null };
const maxImages = () => (imageLimits ? imageLimits.maxCount : 5);
function stepper() {
  const names = ['모으기', '읽고 풀기', '확인하기', '이끌기'];
  const cur = busy.read ? 2 : cap.step;
  return `<div class="stepper" aria-label="진행 단계">${names.map((n, i) => {
    const k = i + 1, cls = k < cur ? 'done' : k === cur ? 'cur' : '';
    return `<span class="st ${cls}" ${k === cur ? 'aria-current="step"' : ''}><i>${k < cur ? '✓' : k}</i>${n}</span>`;
  }).join('')}</div>`;
}
function capCollect() {
  const accept = imageLimits ? imageLimits.mediaTypes.join(',') : 'image/*';
  return `<section class="sec">
    <label class="drop" id="drop" for="cap-file">
      <span class="big-ico">${icon('camera')}</span>
      <b>칠판, 학습지, 단톡방 캡처를 올려요</b>
      <span class="small muted">사진을 고르거나 끌어다 놓거나 붙여넣어요 · 최대 ${maxImages()}장</span>
      <span class="btn btn-pri btn-sm">${icon('image')}사진 고르기</span>
    </label>
    <input id="cap-file" type="file" accept="${esc(accept)}" multiple hidden>
    ${cap.images.length ? `<div class="thumbs">${cap.images.map((x, i) => `<div class="thumb"><img src="${x.url}" alt="${esc(x.name)}"><button data-act="capRemoveImage" data-arg="${i}" aria-label="사진 빼기">×</button></div>`).join('')}</div>` : ''}
    ${aiState === 'ready' && !imageLimits ? '<p class="small faint">이 화면에서는 사진을 AI에 보낼 수 없어요. 공지 글을 붙여넣어 주세요.</p>' : ''}
    <label class="field"><span>또는 공지 글 붙여넣기</span><textarea class="input" id="cap-text" data-bind="capText" rows="5" placeholder="단톡방이나 학교 알림 앱의 공지를 그대로 붙여넣어요">${esc(cap.text)}</textarea></label>
    <div class="row"><span class="small faint">예시로 해 보기</span><button class="pill-btn" data-act="exHandout">${icon('image')}과학 학습지 사진</button><button class="pill-btn" data-act="exChat">${icon('chat')}음악 단톡방 공지</button></div>
    <div class="row-sb"><button class="btn btn-soft" data-act="capManual">직접 입력</button><button class="btn btn-pri" data-act="capRead">${icon('spark')}AI로 읽고 정리하기</button></div>
    ${aiReady() ? '' : `<p class="small faint">${esc(aiOffText())} 예시 공지는 미리 만든 결과로 흐름을 볼 수 있어요.</p>`}
    ${errRow('read')}
    <div class="lock-card">${icon('lock')}<div><b>이름과 학번은 저장하기 전에 가려요</b><p>AI가 찾은 위치를 가리고, 빠진 곳은 직접 드래그해서 가릴 수 있어요. 사진은 이 기기에만 저장돼요.</p></div></div>
  </section>`;
}
function capReading() {
  return `<section class="sec"><div class="cell pad-l stack">
    ${cap.images.length ? `<div class="thumbs">${cap.images.map(x => `<div class="thumb"><img src="${x.url}" alt=""></div>`).join('')}</div>` : ''}
    <b>사진 속 글자를 읽고 항목별로 뽑고 있어요</b><p class="small muted">과목, 유형, 마감, 제출 방식, 준비물, 채점 기준을 수행 카드 칸에 채워요. 확신이 없는 칸은 노랗게 표시할게요.</p>
    ${busyRow('read')}</div></section>`;
}
function maskEditor(img, i) {
  return `<div class="stack-s"><div class="mask-stage" data-stage="${i}"><img src="${img.url}" alt="공지 사진 ${i + 1}">
    ${img.boxes.map((b, j) => `<div class="mask-box" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"><span>${esc(b.label)}</span><button data-act="unmask" data-arg="${i}:${j}" aria-label="가림 지우기">×</button></div>`).join('')}
    ${cap.draft && cap.draft.i === i ? `<div class="mask-box draft" style="left:${cap.draft.x * 100}%;top:${cap.draft.y * 100}%;width:${cap.draft.w * 100}%;height:${cap.draft.h * 100}%"></div>` : ''}
    </div><span class="tiny faint">${img.boxes.length ? `${img.boxes.length}곳을 가렸어요.` : '가린 곳이 없어요.'} 사진 위를 드래그하면 더 가릴 수 있어요.</span></div>`;
}
function capItemForm(it, i) {
  const unc = new Map((it.ai ? it.ai.uncertain : []).map(u => [u.field, u.why]));
  const row = (k, label, input) => {
    const u = unc.has(k);
    return `<div class="kv${u ? ' unsure' : ''}"><span class="k">${label}</span><div class="v">${input}${u ? `<span class="why">AI가 확신하지 못했어요${unc.get(k) ? ' · ' + esc(unc.get(k)) : ''}</span>` : ''}</div></div>`;
  };
  const inp = (k, type, ph) => `<input class="input" id="cf-${i}-${k}" data-cf="${i}:${k}" ${type ? `type="${type}"` : ''} value="${esc(it.f[k])}" ${ph ? `placeholder="${ph}"` : ''}>`;
  return `<div class="kvt">
    <div class="kvt-h"><span>수행 카드 ${i + 1}${it.ai ? '' : ' · 직접 입력'}</span><button class="btn btn-soft btn-sm" data-act="capDrop" data-arg="${i}">빼기</button></div>
    ${row('subject', '과목', inp('subject', '', '예: 국어'))}
    ${row('type', '유형', `<select class="input" id="cf-${i}-type" data-cf="${i}:type">${['', ...TYPES].map(t => `<option value="${esc(t)}" ${t === it.f.type ? 'selected' : ''}>${t || '선택 안 함'}</option>`).join('')}</select>`)}
    ${row('title', '이름', inp('title', '', '예: 시 낭송과 감상문'))}
    ${row('due', '마감', `<div class="row">${inp('due', 'date')}<input class="input" id="cf-${i}-dueTime" data-cf="${i}:dueTime" value="${esc(it.f.dueTime)}" placeholder="교시·시각" style="max-width:140px"></div>`)}
    ${row('method', '제출', inp('method'))}
    ${row('materials', '준비물', inp('materials', '', '쉼표로 구분'))}
    ${row('weight', '반영', inp('weight', '', '예: 20%'))}
    ${row('rubric', '채점 기준', `<textarea class="input" id="cf-${i}-rubric" data-cf="${i}:rubric" rows="4" placeholder="한 줄에 하나">${esc(it.f.rubric)}</textarea>`)}
    ${it.err ? `<div class="kvt-f"><span class="err">${esc(it.err)}</span></div>` : ''}
    <div class="kvt-f"><i></i>노란 칸은 AI가 확신하지 못한 부분이에요. 확인하고 고쳐 주세요.</div>
  </div>`;
}
function capConfirm() {
  const intro = cap.fallback ? 'AI가 연결되지 않아 이 예시 공지용으로 미리 만든 결과예요. 정확도 기록에는 넣지 않아요.'
    : cap.items.some(x => x.ai) ? 'AI가 뽑은 내용이에요. 고친 칸은 정확도 기록에 그대로 반영돼요.' : '빈칸을 채워 수행 카드를 만들어요.';
  return `<section class="sec"><p class="muted">${intro}</p>
    ${cap.images.length ? `<div class="cell pad stack"><div class="row-sb"><b>${icon('lock')} 개인정보 가리기</b><span class="chip sun">저장 전에 가림</span></div><div class="grid g2">${cap.images.map(maskEditor).join('')}</div></div>` : ''}
    ${cap.items.length ? `<div class="grid g2">${cap.items.map(capItemForm).join('')}</div>`
      : `<div class="cell dash empty">${emptyArt()}<b>공지에서 수행평가를 찾지 못했어요</b><p class="small muted">사진이 흐리면 다시 찍거나 글로 붙여넣어 보세요.</p><button class="btn btn-line btn-sm" data-act="capManual">직접 입력</button></div>`}
    <div class="row-sb"><button class="btn btn-soft" data-act="capRestart">처음으로</button><div class="row"><button class="btn btn-line" data-act="capManual">${icon('plus')}카드 추가</button>${cap.items.length ? `<button class="btn btn-pri" data-act="capSave">${icon('check')}확인하고 저장 (${cap.items.length})</button>` : ''}</div></div>
  </section>`;
}
function capDone() {
  const cards = cap.saved.map(find).filter(Boolean);
  const hot = crunchWeeks().filter(w => w.cards.some(a => cap.saved.includes(a.id)));
  return `<section class="sec">
    <div class="cell pad-l stack" style="align-items:flex-start"><span class="chip green">${icon('check')}수행 보드에 ${cards.length}장 저장</span><h2 style="font-size:22px">이제 언제부터 할지 정해 볼까요?</h2>
      <p class="muted">단계를 나누면 학원 시간을 피해 빈 시간에 거꾸로 배치하고, 몰리는 주는 미리 알려 줘요.</p></div>
    ${hot.length ? crunchAlerts(true) : ''}
    <div class="cards">${cards.map(scard).join('')}</div>
    <div class="row-end"><button class="btn btn-soft" data-act="capRestart">${icon('camera')}다른 공지 읽기</button><button class="btn btn-line" data-act="go" data-arg="board">수행 보드</button>${cards[0] ? `<button class="btn btn-pri" data-act="openPlan" data-arg="${cards[0].id}">${icon('route')}단계 나누러 가기</button>` : ''}</div>
  </section>`;
}
function viewCapture() {
  const body = busy.read ? capReading() : cap.step === 3 ? capConfirm() : cap.step === 4 ? capDone() : capCollect();
  return { title: '새 수행 카드', sub: '공지 사진 한 장이 수행 카드 한 장이 돼요', body: `${stepper()}${body}` };
}

/* ---------- 시간표 ---------- */
let ttDraft = null; // academies proposed by the AI, waiting for the student
function schoolTable() {
  const sc = state.school;
  const rows = sc.periods.map(([a, b], i) => `<tr><th class="num">${i + 1}</th>
    <td class="tt-time"><input class="input" type="time" id="sp-${i}-0" data-sp="${i}:0" value="${hm(a)}" aria-label="${i + 1}교시 시작"><input class="input" type="time" id="sp-${i}-1" data-sp="${i}:1" value="${hm(b)}" aria-label="${i + 1}교시 끝"></td>
    ${[1, 2, 3, 4, 5].map(wd => { const v = (sc.grid[wd] || [])[i] || ''; return `<td><input class="tt-in${v ? ' hue' : ''}" style="--h:${hueOf(v)}" id="sg-${wd}-${i}" data-sg="${wd}:${i}" value="${esc(v)}" placeholder="—" aria-label="${WD[wd]}요일 ${i + 1}교시"></td>`; }).join('')}</tr>`).join('');
  return `<div class="tt-scroll"><table class="tt"><thead><tr><th>교시</th><th>시간</th>${['월', '화', '수', '목', '금'].map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function viewTimetable() {
  const s = state.settings;
  const tf = (id, attr, v) => `<input class="input" type="time" id="${id}" ${attr} value="${hm(v)}">`;
  const nf = (k, label, lo, hi) => `<label class="field"><span>${label}</span><input class="input" type="number" id="set-${k}" data-set="${k}" min="${lo}" max="${hi}" step="10" value="${s[k]}"></label>`;
  return {
    title: '시간표', sub: '학교와 학원 시간을 등록하면 캘린더에 보이고, 계획은 이 시간을 피해서 넣어요',
    body: `
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:40">${icon('board')}</span>학교 시간표</h2>
      <div class="row"><button class="btn btn-soft btn-sm" data-act="periodDel" ${state.school.periods.length <= 1 ? 'disabled' : ''}>교시 빼기</button><button class="btn btn-soft btn-sm" data-act="periodAdd" ${state.school.periods.length >= 9 ? 'disabled' : ''}>${icon('plus')}교시 추가</button></div></div>
      ${schoolTable()}
      <p class="small faint">과목을 적으면 캘린더의 '학교 시간표'에 교시별로 보여요. 빈칸은 수업이 없는 교시예요.</p></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:20">${icon('sun')}</span>학교 끝나는 시간</h2><button class="btn btn-line btn-sm" data-act="schoolFit">${icon('spark')}시간표에 맞추기</button></div>
      <div class="cell pad stack"><div class="days5">${['월', '화', '수', '목', '금'].map((d, i) => `<label class="field"><span>${d}요일</span>${tf('se-' + i, `data-se="${i}"`, s.schoolEnd[i])}</label>`).join('')}</div>
      <div class="grid g3"><label class="field"><span>주말 시작</span>${tf('set-weekendStart', 'data-set="weekendStart"', s.weekendStart)}</label><label class="field"><span>공부 마감</span>${tf('set-dayEnd', 'data-set="dayEnd"', s.dayEnd)}</label></div>
      <p class="small faint">'시간표에 맞추기'는 요일마다 마지막 교시가 끝나고 종례 15분 뒤로 맞춰요.</p></div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:262">${icon('clock')}</span>학원 시간표</h2>
      <div class="row"><label class="btn btn-line btn-sm" for="tt-file">${icon('image')}사진으로 입력</label><input id="tt-file" type="file" accept="image/*" hidden><button class="btn btn-pri btn-sm" data-act="addAcademy">${icon('plus')}학원 추가</button></div></div>
      ${busyRow('timetable')}${errRow('timetable')}
      ${ttDraft ? `<div class="cell pad stack" style="box-shadow:0 0 0 2px var(--blue)"><b>${icon('spark')} AI가 읽은 학원 일정 ${ttDraft.length}개</b>${ttDraft.length ? `<div class="stack-s">${ttDraft.map(a => `<span class="small">${esc(a.label)} · ${a.days.map(d => WD[d]).join('')} · <span class="num">${hm(a.start)}–${hm(a.end)}</span></span>`).join('')}</div><p class="small faint">맞는지 확인하고 추가해요. 추가한 뒤에도 고칠 수 있어요.</p><div class="row-end"><button class="btn btn-soft btn-sm" data-act="ttCancel">취소</button><button class="btn btn-pri btn-sm" data-act="ttApply">${icon('check')}추가하기</button></div>` : '<p class="small muted">시간표에서 학원 일정을 찾지 못했어요.</p><div><button class="btn btn-soft btn-sm" data-act="ttCancel">닫기</button></div>'}</div>` : ''}
      <div class="stack">${state.academies.map(a => `<div class="aca cell hue" style="${hueVar(a.label)}">${tile(a.label, 's')}
        <div class="aca-body"><input class="input" id="ac-${a.id}-label" data-ac="${a.id}:label" value="${esc(a.label)}" aria-label="학원 이름">
          <div class="row"><div class="dayb-row" role="group" aria-label="요일">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button class="dayb" data-act="toggleDay" data-arg="${a.id}:${d}" aria-pressed="${a.days.includes(d)}">${WD[d]}</button>`).join('')}</div>
          <div class="times"><input class="input" type="time" id="ac-${a.id}-start" data-ac="${a.id}:start" value="${hm(a.start)}" aria-label="시작"><span class="faint">–</span><input class="input" type="time" id="ac-${a.id}-end" data-ac="${a.id}:end" value="${hm(a.end)}" aria-label="끝"></div></div></div>
        <button class="btn btn-soft btn-icon btn-sm" data-act="delAcademy" data-arg="${a.id}" aria-label="${esc(a.label)} 삭제">${icon('trash')}</button></div>`).join('') || `<div class="cell dash empty">${emptyArt()}<b>등록한 학원이 없어요</b></div>`}</div>
    </section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:152">${icon('route')}</span>수행에 쓸 시간</h2></div>
      <div class="cell pad grid g3">${nf('cap', '평일 하루 최대 (분)', 30, 240)}${nf('weekendCap', '주말 하루 최대 (분)', 30, 360)}${nf('travel', '학원 이동 시간 (분)', 0, 60)}</div>
      <p class="small faint">집중이 잘 되는 시간은 나의 설정에서 고를 수 있어요. 지금은 <b>${esc(FOCUS[s.focus].label)}</b> 시간에 먼저 넣고, 캘린더의 개인 일정도 피해서 계획해요.</p></section>`
  };
}
