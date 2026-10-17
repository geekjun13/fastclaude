'use strict';
/* 수행 내비 — views: 진행 기록, 나의 설정, 프롬프트, 내비에게 묻기 */

/* ---------- 진행 기록 ---------- */
function doneSteps() { return state.cards.flatMap(a => a.steps.filter(s => s.done).map(s => ({ a, s }))); }
function streak() {
  const days = new Set(doneSteps().map(x => x.s.doneAt).filter(Boolean));
  let d = today(), n = 0;
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function logTSV() {
  const rows = [['번호', '날짜', '입력', '과목', '맞게 읽은 칸', '고친 칸']];
  state.log.forEach((x, i) => rows.push([i + 1, x.at, x.source === 'image' ? '사진' : '글', x.subject, `${ACC_FIELDS.length - x.fixed.length}/${ACC_FIELDS.length}`, x.fixed.map(f => FIELD_LABEL[f]).join(', ') || '없음']));
  return rows.map(r => r.join('\t')).join('\n');
}
function viewProgress() {
  const t = today(), done = doneSteps(), m0 = mondayOf(t);
  const weekDone = done.filter(x => x.s.doneAt && diffDays(m0, x.s.doneAt) >= 0).length;
  const counts = {};
  done.forEach(x => { if (x.s.doneAt) counts[x.s.doneAt] = (counts[x.s.doneAt] || 0) + 1; });
  let dots = '';
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i), n = counts[d] || 0, sk = state.skips.includes(d);
    dots += `<div class="d14" title="${md(d)} 완료 ${n}개${sk ? ' · 쉬어 간 날' : ''}"><small>${parseYmd(d).getDate()}</small>${n ? '<i></i>'.repeat(Math.min(n, 5)) : sk ? '<i class="skip"></i>' : '<i class="zero"></i>'}</div>`;
  }
  const L = state.log;
  let acc = `<div class="cell dash empty">${emptyArt()}<b>아직 정확도 기록이 없어요</b><p class="small muted">새 수행 카드에서 AI가 읽은 결과를 저장하면, 학생이 고친 칸을 AI가 틀린 칸으로 세어 쌓아요. 실제 공지 사진 3~5장으로 시험해 보세요.</p></div>`;
  if (L.length) {
    const perfect = L.filter(x => !x.fixed.length).length, total = L.length * ACC_FIELDS.length;
    const ok = total - L.reduce((n, x) => n + x.fixed.length, 0);
    acc = `<div class="grid g3"><div class="cell stat"><span class="lbl">고칠 곳 없이 정확</span><span class="big">${perfect}<small>/ ${L.length}건</small></span></div>
      <div class="cell stat"><span class="lbl">칸 정확도</span><span class="big">${Math.round(ok / total * 100)}<small>%</small></span></div>
      <div class="cell stat"><span class="lbl">입력</span><span class="big">${L.filter(x => x.source === 'image').length}<small>사진 · ${L.filter(x => x.source !== 'image').length} 글</small></span></div></div>
      <div class="cell pad stack-s">${ACC_FIELDS.map(f => { const n = L.filter(x => !x.fixed.includes(f)).length, pct = Math.round(n / L.length * 100);
        return `<div class="accbar"><span>${FIELD_LABEL[f]}</span><span class="bar"><i style="width:${pct}%;background:var(--blue)"></i></span><span class="num small">${n}/${L.length}</span></div>`; }).join('')}</div>
      <div class="tbl"><table id="log-table"><thead><tr><th>#</th><th>날짜</th><th>입력</th><th>과목</th><th>맞게 읽음</th><th>고친 칸</th></tr></thead><tbody>
      ${L.map((x, i) => `<tr><td class="num">${i + 1}</td><td class="num">${md(x.at)}</td><td>${x.source === 'image' ? '사진' : '글'}</td><td>${esc(x.subject)}</td><td class="num">${ACC_FIELDS.length - x.fixed.length}/${ACC_FIELDS.length}</td><td>${x.fixed.length ? esc(x.fixed.map(f => FIELD_LABEL[f]).join(', ')) : '<span class="faint">없음</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="row-end"><button class="btn btn-danger btn-sm" data-act="clearLog">${confirmKey === 'log' ? '한 번 더 누르면 지워져요' : '기록 지우기'}</button><button class="btn btn-line btn-sm" data-act="copyLog">${icon('copy')}표 복사</button></div>`;
  }
  const cards = state.cards.filter(a => a.steps.length).sort(byDue);
  return {
    title: '진행 기록', sub: '단계 완료 체크가 쌓여서 재계획과 몰림 경보에 쓰여요',
    body: `
    <div class="grid g4">
      <div class="cell stat"><span class="lbl">${icon('check')}완료한 단계</span><span class="big">${done.length}<small>개</small></span></div>
      <div class="cell stat"><span class="lbl">${icon('calendar')}이번 주 완료</span><span class="big">${weekDone}<small>개</small></span></div>
      <div class="cell stat"><span class="lbl">${icon('flame')}연속 기록</span><span class="big">${streak()}<small>일</small></span></div>
      <div class="cell stat"><span class="lbl">${icon('moon')}쉬어 간 날</span><span class="big">${state.skips.length}<small>일</small></span></div>
    </div>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:152">${icon('chart')}</span>최근 2주</h2><span class="small faint">점 하나가 끝낸 단계 하나 · 노란 점은 쉬어 간 날</span></div><div class="cell dots14">${dots}</div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:214">${icon('board')}</span>카드별 진행</h2></div>
      ${cards.length ? `<div class="group">${cards.map(a => { const p = progressOf(a); return `<div class="gi hue" style="${hueVar(a.subject)};cursor:pointer" data-act="open" data-arg="${a.id}">${ring(p, a.subject)}<div style="flex:1;min-width:0"><b style="font-size:14.5px">${esc(a.title)}</b><div class="small faint">${esc(a.subject)} · 단계 ${a.steps.filter(s => s.done).length}/${a.steps.length} · ${md(a.due)} 마감</div></div>${ddayBadge(a)}</div>`; }).join('')}</div>`
        : `<div class="cell dash empty">${emptyArt()}<b>단계를 나눈 카드가 없어요</b></div>`}</section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:44">${icon('camera')}</span>AI 공지 읽기 정확도</h2><span class="small faint">학생이 고친 칸 = AI가 틀린 칸</span></div>${acc}</section>`
  };
}

/* ---------- 나의 설정 ---------- */
function viewSettings() {
  const s = state.settings;
  const opt = (act, v, cur, title, desc) => `<button class="opt" data-act="${act}" data-arg="${v}" aria-pressed="${cur === v}"><b>${title}</b><small>${desc}</small></button>`;
  return {
    title: '나의 설정', sub: '첫 사용 때 고르고, 언제든 바꿀 수 있어요',
    body: `
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:220">${icon('heart')}</span>프로필</h2></div>
      <div class="cell pad grid g2"><label class="field"><span>이름 (화면에만 보여요)</span><input class="input" id="set-name" data-text="name" value="${esc(s.name)}"></label><label class="field"><span>학년</span><input class="input" id="set-grade" data-text="grade" value="${esc(s.grade)}"></label></div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:28">${icon('clock')}</span>집중이 잘 되는 시간</h2></div>
      <div class="opts">${Object.entries(FOCUS).map(([k, f]) => opt('setFocus', k, s.focus, f.label, f.desc)).join('')}</div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:330">${icon('chat')}</span>알림 말투</h2></div>
      <div class="opts">${Object.entries(TONES).map(([k, t]) => opt('setTone', k, s.tone, t.label, t.desc)).join('')}</div>
      <div class="note" style="max-width:420px"><small>미리 보기 · 못 한 날 받는 메시지</small>${esc(TONES[s.tone].sample)}</div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:196">${icon('spark')}</span>화면</h2></div>
      <div class="opts">${opt('setSolid', 'glass', s.solid ? 'solid' : 'glass', '부드러운 유리', '사이드바와 탭 막대가 뒤를 은은하게 비쳐요')}${opt('setSolid', 'solid', s.solid ? 'solid' : 'glass', '불투명', '유리 효과 없이 또렷하게 보여요')}</div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:150">${icon('board')}</span>데이터</h2></div>
      <div class="group">
        <div class="gi"><div style="flex:1"><b>예시 카드 다시 넣기</b><div class="small faint">발표 연습용 예시 수행 카드 4장을 오늘 날짜에 맞춰 넣어요</div></div><button class="btn btn-line btn-sm" data-act="reseed">넣기</button></div>
        <div class="gi"><div style="flex:1"><b>내 데이터 복사</b><div class="small faint">수행 카드와 설정을 JSON으로 복사해요</div></div><button class="btn btn-line btn-sm" data-act="copyData">${icon('copy')}복사</button></div>
        <div class="gi"><div style="flex:1"><b>모두 지우기</b><div class="small faint">카드, 기록, 사진, 설정을 이 기기에서 지워요</div></div><button class="btn btn-danger btn-sm" data-act="resetAll">${confirmKey === 'reset' ? '한 번 더 누르면 지워져요' : '지우기'}</button></div>
      </div></section>
    <div class="lock-card">${icon('lock')}<div><b>외부에서 학생 데이터를 모으지 않아요</b><p>모든 데이터는 이 브라우저에만 저장돼요. AI 기능은 링크를 연 사람의 Claude 계정으로 실행되고, 사진 속 이름과 학번은 저장하기 전에 가려요.</p></div></div>`
  };
}

/* ---------- 프롬프트 ---------- */
function viewPrompts() {
  const story = [
    ['월 08:50', '칠판 공지를 찍는다', '국어 발표 카드 만들었어! 날짜 맞는지 봐 줘'],
    ['월 22:10', '채점 기준을 받는다', '주장마다 근거 2개, 출처는 꼭 넣기!'],
    ['화 21:00', '역산 계획이 나온다', '수 밤: 자료 조사 20분\n목 밤: 개요 20분'],
    ['수 07:30', '몰림 경보가 온다', '다음 주에 4과목이 겹쳐! 2개는 이번 주에 시작하자'],
    ['목 23:00', '못 한 날도 괜찮다', '괜찮아, 금요일 30분으로 옮겼어. 할 수 있어!']
  ];
  return {
    title: '프롬프트', sub: '이 앱이 AI에게 보내는 프롬프트 그대로예요',
    body: `
    <div class="cell pad stack-s"><b>시연할 때 이렇게 쓰세요</b><p class="small muted">아래 프롬프트는 앱이 실제로 보내는 문장이에요. 다른 멀티모달 챗봇에서 시연할 때는 <span class="chip">{{ }}</span> 부분만 바꿔 넣고 공지 사진을 함께 첨부하면 돼요. AI는 읽고 해석하고, 학생은 확인하고, 시간 계산은 알고리즘이 해요.</p></div>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:40">${icon('heart')}</span>시연 시나리오 · 지민이의 한 주</h2></div>
      <div class="story">${story.map(([w, h, n], i) => `<div class="cell${i === 3 ? ' hot' : ''}"><span class="when">${w}</span><b>${h}</b><div class="note${i === 3 ? ' peach' : ''}">${esc(n).replace(/\n/g, '<br>')}</div></div>`).join('')}</div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:196">${icon('book')}</span>프롬프트 ${Object.keys(P).length}개</h2></div>
      <div class="grid g2">${Object.entries(P).map(([k, p]) => `<article class="cell pcard">
        <div class="row-sb"><div class="row"><span class="ni-ico hue" style="--h:${hueOf(p.name)}">${icon(p.icon)}</span><div><b>${p.name}</b><div class="tiny faint">${p.when} · ${p.tier}</div></div></div><button class="btn btn-line btn-sm" data-act="copyPrompt" data-arg="${k}">${icon('copy')}복사</button></div>
        <p class="small"><span class="chip blue">왜 AI인가</span> ${p.why}</p><pre id="pre-${k}">${esc(p.tpl)}</pre></article>`).join('')}</div></section>`
  };
}

/* ---------- 내비에게 묻기 ---------- */
let chatDraft = '';
function viewChat() {
  const key = 'chat';
  const sugg = ['이번 주에 뭐부터 해?', '몰림 주는 어떻게 버텨?', '국어 감상문 대신 써 줘', '오늘 못 하면 어떻게 돼?'];
  const log = state.chat.map((m, i) => {
    const live = busy[key] && i === state.chat.length - 1 && m.role === 'ai';
    return m.role === 'me' ? `<div class="bub me">${esc(m.content)}</div>`
      : `<div class="bub ai"><span class="who">${icon('spark')}수행 내비</span><span ${live ? `data-live="${key}"` : ''}>${esc(m.content) || '생각 중…'}</span></div>`;
  }).join('');
  return {
    title: '내비에게 묻기', sub: `수행 보드와 계획을 보고 답해요 · 말투: ${TONES[state.settings.tone].label}`,
    actions: state.chat.length ? `<button class="btn btn-soft btn-sm" data-act="clearChat">대화 지우기</button>` : '',
    body: `
    <div class="chatlog" style="min-height:40vh">
      <div class="bub ai"><span class="who">${icon('spark')}수행 내비</span>${esc(state.settings.name || '')}${state.settings.name ? '님, ' : ''}수행평가 일정이나 채점 기준이 궁금하면 물어보세요. 과제 내용은 대신 쓰지 않고, 언제 무엇부터 할지 같이 정해요.</div>
      ${log}
    </div>
    ${state.chat.length ? '' : `<div class="sugg">${sugg.map(q => `<button class="pill-btn" data-act="chatAsk" data-arg="${esc(q)}" ${aiReady() ? '' : 'disabled'}>${esc(q)}</button>`).join('')}</div>`}
    ${aiNote()}${busyRow(key)}${errRow(key)}
    <div class="composer glass"><textarea id="chat-in" data-bind="chatDraft" rows="1" placeholder="메시지를 입력해요" aria-label="메시지">${esc(chatDraft)}</textarea>${busy[key] ? '' : `<button class="btn btn-pri btn-icon" data-act="chatSend" aria-label="보내기" ${aiReady() ? '' : 'disabled'}>${icon('send')}</button>`}</div>`,
    after() { const v = document.getElementById('view'); if (state.chat.length && v) { const last = v.querySelector('.chatlog .bub:last-child'); if (last && busy[key]) last.scrollIntoView({ block: 'nearest' }); } }
  };
}

const VIEWS = { today: viewToday, board: viewBoard, week: viewWeek, capture: viewCapture, timetable: viewTimetable, progress: viewProgress, settings: viewSettings, prompts: viewPrompts, chat: viewChat };
