'use strict';
/* 수행 내비 — views: 성장 리포트, 설정, AI 레시피, 내비 코치 */

/* ---------- 성장 리포트 ---------- */
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
  let acc = `<div class="cell dash empty">${emptyArt()}<b>아직 정확도 기록이 없어요</b><p class="small muted">공지 스캔에서 AI가 읽은 결과를 저장하면, 학생이 고친 칸을 AI가 틀린 칸으로 세어 쌓아요. 실제 공지 사진 3~5장으로 시험해 보세요.</p></div>`;
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
    title: '성장 리포트', sub: '단계 완료 체크와 시험지 기록이 쌓여서 계획과 경보를 더 정확하게 만들어요',
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
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:44">${icon('camera')}</span>AI 공지 읽기 정확도</h2><span class="small faint">학생이 고친 칸 = AI가 틀린 칸</span></div>${acc}</section>
    ${growthMember()}`
  };
}

function growthMember() {
  const out = [], t = today(), m0 = mondayOf(t);
  const atts = state.study.sets.flatMap(st => st.attempts.map(x => ({ ...x, subject: st.subject })));
  const avg = atts.length ? Math.round(atts.reduce((n, x) => n + x.score / x.total, 0) / atts.length * 100) : null;
  out.push(`<section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:262">${icon('book')}</span>스터디 랩 기록</h2><button class="btn btn-line btn-sm" data-act="go" data-arg="study">스터디 랩</button></div>
    <div class="grid g3"><div class="cell stat"><span class="lbl">시험지</span><span class="big">${state.study.sets.length}<small>개</small></span></div><div class="cell stat"><span class="lbl">풀이</span><span class="big">${atts.length}<small>회</small></span></div><div class="cell stat"><span class="lbl">평균 정답률</span><span class="big">${avg != null ? avg : '—'}<small>${avg != null ? '%' : ''}</small></span></div></div></section>`);
  if (has('weekly')) {
    const r = state.reports[m0];
    const past = Object.entries(state.reports).filter(([k]) => k !== m0).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
    out.push(`<section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:330">${icon('spark')}</span>AI 주간 리포트</h2>${aiBtn('weekly', r ? '다시 쓰기' : '이번 주 돌아보기', 'weeklyReport', '', 'btn-pri btn-sm')}</div>
      ${aiNote()}${busyRow('weekly')}${errRow('weekly')}
      ${r ? `<div class="cell pad report">${logoMark(30)}<div><span class="eyebrow">${mdShort(m0)} 주</span><p>${esc(r.text).replace(/\n/g, '<br>')}</p></div></div>` : `<div class="cell dash empty">${emptyArt()}<b>이번 주 리포트가 아직 없어요</b><p class="small muted">끝낸 단계, 쉬어 간 날, 다가오는 마감, 시험지 기록을 보고 한 주를 돌아봐요.</p></div>`}
      ${past.length ? `<details class="cell pad"><summary class="small">지난 리포트 ${past.length}개</summary>${past.map(([k, v]) => `<div class="sc-row"><b class="small">${mdShort(k)} 주</b><span class="small">${esc(v.text).replace(/\n/g, '<br>')}</span></div>`).join('')}</details>` : ''}</section>`);
  }
  if (has('teacher')) {
    const pat = teacherPatterns();
    out.push(`<section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:40">${icon('spark')}</span>과목별 출제 패턴</h2><span class="small faint">받은 공지 ${state.cards.length}개 기준</span></div>
      ${pat.length ? `<div class="tbl"><table><thead><tr><th>과목</th><th>공지</th><th>공지~마감</th><th>자주 나오는 기준</th><th>주로 나오는 유형</th></tr></thead><tbody>${pat.map(x => `<tr><td>${tag(x.subject)}</td><td class="num">${x.n}개</td><td class="num">평균 ${x.lead}일</td><td>${x.words.map(w => `<span class="chip">${esc(w)}</span>`).join(' ') || '<span class="faint">—</span>'}</td><td>${esc(x.type) || '<span class="faint">—</span>'}</td></tr>`).join('')}</tbody></table></div>
        <p class="small faint">${(() => { const m = pat.slice().sort((a, b) => a.lead - b.lead)[0]; return m ? `${esc(m.subject)}은(는) 공지부터 마감까지 평균 ${m.lead}일로 가장 짧아요. 공지를 받은 날 바로 단계를 나눠 두세요.` : ''; })()}</p>`
        : `<div class="cell dash empty">${emptyArt()}<b>공지를 더 모으면 보여요</b></div>`}</section>`);
  }
  if (has('pace')) {
    const logs = state.timerLog.slice(-6).reverse(), pf = paceFactor();
    out.push(`<section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:152">${icon('chart')}</span>내 속도 보정</h2></div>
      <div class="group">${sw2('paceToggle', state.pace, '계획에 내 속도 반영', '포커스 타이머 기록 3번부터 단계 시간을 자동으로 늘리거나 줄여요')}</div>
      <div class="cell pad stack-s"><div class="row-sb"><b>지금 보정</b><b class="num" style="font-size:20px">${pf === 1 ? '없음' : `×${pf.toFixed(2)}`}</b></div>
        ${logs.length ? logs.map(l => { const a = find(l.aid), s = a && a.steps[l.step]; return `<div class="accbar"><span>${esc(s ? s.name : '지운 단계')}</span><span class="bar"><i style="width:${clamp(l.actual / Math.max(l.planned, l.actual) * 100, 4, 100)}%;background:var(--blue)"></i></span><span class="num small">${l.actual}/${l.planned}분</span></div>`; }).join('') : '<p class="small faint">아직 타이머 기록이 없어요. 투데이에서 시계 버튼으로 단계를 시작해 보세요.</p>'}</div></section>`);
  }
  if (has('family')) {
    out.push(`<section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:20">${icon('heart')}</span>가족 공유 요약</h2><button class="btn btn-line btn-sm" data-act="copyFamily">${icon('copy')}복사</button></div>
      <pre class="cell pad share-pre" id="fam-text">${esc(familySummary())}</pre><p class="small faint">메신저에 붙여넣어 보호자에게 보낼 수 있어요. 이름 외 개인정보는 넣지 않아요.</p></section>`);
  }
  if (has('portfolio')) {
    const list = state.cards.filter(a => a.due && (diffDays(a.due, t) >= 0 || progressOf(a) === 1)).sort(byDue).reverse();
    out.push(`<section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:214">${icon('board')}</span>학기 포트폴리오</h2><button class="btn btn-line btn-sm" data-act="copyPortfolio">${icon('copy')}전체 복사</button></div>
      ${list.length ? `<div class="stack">${list.map(a => `<div class="cell pad stack-s hue" style="${hueVar(a.subject)}"><div class="row-sb"><span>${tag(a.subject)} <b>${esc(a.title)}</b></span><span class="small faint">${mdMid(a.due)}</span></div><textarea class="input" rows="2" id="rf-${a.id}" data-reflect="${a.id}" placeholder="배운 점, 아쉬운 점, 다음에 바꿀 점을 내 말로 적어요">${esc(a.reflect || '')}</textarea></div>`).join('')}</div>` : `<div class="cell dash empty">${emptyArt()}<b>마감이 지난 수행평가가 생기면 소감을 적을 수 있어요</b></div>`}
      <details class="cell pad"><summary class="small">복사될 내용 미리 보기</summary><pre class="share-pre" id="pf-text">${esc(portfolioText())}</pre></details></section>`);
  }
  return out.join('');
}

/* ---------- 설정 ---------- */
function viewSettings() {
  const s = state.settings;
  const opt = (act, v, cur, title, desc) => `<button class="opt" data-act="${act}" data-arg="${v}" aria-pressed="${cur === v}"><b>${title}</b><small>${desc}</small></button>`;
  const jumps = [['set-look', '화면'], ['notif-settings', '알림'], ['set-habit', '공부 습관'], ['set-profile', '프로필'], ['set-plan', '요금제'], ['set-data', '데이터']];
  return {
    title: '설정', sub: '화면, 알림, 공부 습관, 요금제를 내 방식대로 맞춰요',
    body: `
    <nav class="jump" aria-label="설정 바로가기">${jumps.map(([id, l]) => `<button class="pill-btn" data-act="jump" data-arg="${id}">${l}</button>`).join('')}</nav>
    <section class="sec" id="set-look"><div class="sec-h"><h2><span class="ico hue" style="--h:196">${icon('sun')}</span>화면</h2><button class="btn btn-soft btn-sm" data-act="lookReset">기본값</button></div>${lookSettingsHtml()}</section>
    <section class="sec" id="notif-settings"><div class="sec-h"><h2><span class="ico hue" style="--h:8">${icon('bell')}</span>알림</h2></div>${notifSettingsHtml()}</section>
    <section class="sec" id="set-habit"><div class="sec-h"><h2><span class="ico hue" style="--h:28">${icon('clock')}</span>집중이 잘 되는 시간</h2></div>
      <div class="opts">${Object.entries(FOCUS).map(([k, f]) => opt('setFocus', k, s.focus, f.label, f.desc)).join('')}</div>
      <div class="sec-sub">코치 말투</div>
      <div class="opts">${Object.entries(TONES).map(([k, t]) => opt('setTone', k, s.tone, t.label, t.desc)).join('')}</div>
      <div class="note" style="max-width:420px"><small>미리 보기 · 못 한 날 받는 메시지</small>${esc(TONES[s.tone].sample)}</div></section>
    <section class="sec" id="set-profile"><div class="sec-h"><h2><span class="ico hue" style="--h:220">${icon('heart')}</span>프로필</h2></div>
      <div class="cell pad grid g2"><label class="field"><span>이름 (화면에만 보여요)</span><input class="input" id="set-name" data-text="name" value="${esc(s.name)}"></label><label class="field"><span>학년</span><input class="input" id="set-grade" data-text="grade" value="${esc(s.grade)}"></label></div></section>
    <section class="sec" id="set-plan"><div class="sec-h"><h2><span class="ico hue" style="--h:262">${icon('spark')}</span>요금제 변경</h2></div>${memberSettingsHtml()}</section>
    <section class="sec" id="set-data"><div class="sec-h"><h2><span class="ico hue" style="--h:150">${icon('board')}</span>데이터</h2></div>
      <div class="group">
        <div class="gi"><div style="flex:1"><b>예시 카드 다시 넣기</b><div class="small faint">발표 연습용 예시 수행 카드 4장을 오늘 날짜에 맞춰 넣어요</div></div><button class="btn btn-line btn-sm" data-act="reseed">넣기</button></div>
        <div class="gi"><div style="flex:1"><b>내 데이터 복사</b><div class="small faint">수행 카드, 시험지, 설정을 JSON으로 복사해요</div></div><button class="btn btn-line btn-sm" data-act="copyData">${icon('copy')}복사</button></div>
        <div class="gi"><div style="flex:1"><b>데이터 가져오기</b><div class="small faint">다른 기기나 설치한 앱에서 복사한 데이터를 붙여넣어 옮겨요</div></div><button class="btn btn-line btn-sm" data-act="importOpen">${icon('plus')}가져오기</button></div>
        <div class="gi"><div style="flex:1"><b>모두 지우기</b><div class="small faint">카드, 기록, 사진, 설정을 이 기기에서 지워요</div></div><button class="btn btn-danger btn-sm" data-act="resetAll">${confirmKey === 'reset' ? '한 번 더 누르면 지워져요' : '지우기'}</button></div>
      </div></section>
    <div class="lock-card">${logoMark(34)}<div><b>외부에서 학생 데이터를 모으지 않아요</b><p>모든 데이터는 이 브라우저에만 저장돼요. AI 기능은 링크를 연 사람의 Claude 계정으로 실행되고, 사진 속 이름과 학번은 저장하기 전에 가려요.</p></div></div>`
  };
}

/* ---------- AI 레시피: how the AI works, what it costs, the prompts ---------- */
const KRW = 1400; // 원/달러 가정
const API_PRICE = { quick: { name: 'Haiku 5.5', in: 0.10, out: 0.50 }, base: { name: 'Sonnet 5.5', in: 2, out: 10 } };
const COST_ROWS = [
  ['공지 정리 · 사진 1장', 3000, 700, 8], ['채점 기준 번역', 1500, 800, 8], ['역산 단계 나누기', 1500, 600, 8],
  ['내비 코치 · 질문 1번', 2500, 300, 30], ['시험지 10문항', 4500, 2500, 20], ['개념 지도', 4000, 1200, 4]
];
const callWon = (m, i, o) => (i * API_PRICE[m].in + o * API_PRICE[m].out) / 1e6 * KRW;
const wonFmt = v => (v < 1 ? '1원 미만' : v < 10 ? v.toFixed(1) + '원' : Math.round(v).toLocaleString('ko-KR') + '원');
function aiMechanism() {
  const flow = [['camera', '넣기', '공지 사진, 교과서, 필기, 질문'], ['book', '레시피', '아래 프롬프트에 내 자료를 끼워 넣어요'], ['spark', 'Claude', '읽고 해석해서 정해진 JSON으로 답해요'], ['check', '확인 · 계산', '학생이 확인하고, 시간 계산은 알고리즘이 해요']];
  const month = m => COST_ROWS.reduce((n, [, i, o, k]) => n + callWon(m, i, o) * k, 0);
  return `<section class="hero rise"><div><div class="eyebrow">HOW IT WORKS</div><h2>AI는 <em>읽고 해석</em>만, 결정은 내가</h2><p>대신 써 주지 않아요. 공지를 정리하고, 기준을 풀어 주고, 시험지를 만들어 줄 뿐이에요. 날짜 계산, 몰림 경보, 채점, 알림은 이 기기 안의 알고리즘이 해요.</p></div>${logoMark(92, 'hero-logo')}</section>
    <div class="flow">${flow.map(([ic, h, d], i) => `<div class="cell flow-i"><span class="ni-ico hue" style="--h:${[40, 196, 262, 152][i]}">${icon(ic)}</span><b>${i + 1}. ${h}</b><small>${d}</small></div>`).join('')}</div>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:152">${icon('heart')}</span>지금은 누가 비용을 내나요?</h2></div>
      <div class="grid g2">
        <div class="cell pad stack-s"><span class="chip green">앱 운영 비용 0원</span><b>링크를 연 사람의 Claude 계정으로 실행</b><p class="small muted">이 앱은 claude.ai 아티팩트라서, AI 요청이 여는 사람의 Claude 요금제 사용량에서 처리돼요. 앱을 만든 사람에게 따로 청구되는 API 비용이 없어요.</p></div>
        <div class="cell pad stack-s"><span class="chip blue">AI 없이도 동작</span><b>로그인하지 않아도 쓸 수 있는 기능</b><p class="small muted">캘린더, 시간표, 역산 플래너, 몰림 경보, 알림, 시험지 풀이·채점, 복습 카드, 예시 시험지는 AI 호출 없이 이 기기에서 계산해요.</p></div>
      </div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:44">${icon('chart')}</span>독립 앱으로 낼 때의 API 비용</h2><span class="small faint">1회 호출 추정 · 1달러 ${KRW.toLocaleString('ko-KR')}원 가정</span></div>
      <div class="tbl"><table class="cost-tbl"><thead><tr><th>기능</th><th>입력 토큰</th><th>출력 토큰</th><th>${API_PRICE.quick.name}</th><th>${API_PRICE.base.name}</th></tr></thead><tbody>
        ${COST_ROWS.map(([n, i, o]) => `<tr><td>${n}</td><td class="num">${i.toLocaleString('ko-KR')}</td><td class="num">${o.toLocaleString('ko-KR')}</td><td class="num">${wonFmt(callWon('quick', i, o))}</td><td class="num">${wonFmt(callWon('base', i, o))}</td></tr>`).join('')}
        <tr class="sum"><td>학생 1명 한 달<small>공지 8 · 기준 8 · 단계 8 · 코치 30 · 시험지 20 · 지도 4</small></td><td></td><td></td><td class="num">${wonFmt(month('quick'))}</td><td class="num">${wonFmt(month('base'))}</td></tr>
      </tbody></table></div>
      <p class="tiny faint">100만 토큰당 ${API_PRICE.quick.name} 입력 $${API_PRICE.quick.in} · 출력 $${API_PRICE.quick.out}, ${API_PRICE.base.name} 입력 $${API_PRICE.base.in} · 출력 $${API_PRICE.base.out} 공개 단가로 계산한 대략값이에요. 실제 토큰 수는 사진 크기와 글 길이에 따라 달라져요.</p></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:330">${icon('spark')}</span>비용을 줄이는 방법</h2></div>
      <div class="grid g2">${[
        ['빠른 모델 먼저', '코칭, 예상 질문, 변형 문제처럼 짧은 일은 빠른 모델로 충분해요. 기본 모델보다 약 20배 저렴해요.'],
        ['프롬프트 캐싱', '매번 같은 지시문과 교과서 본문을 캐시하면 다시 읽을 때 입력 비용이 약 10분의 1로 줄어요.'],
        ['배치 처리', 'D-30 플랜, 주간 리포트처럼 바로 안 받아도 되는 일은 배치로 보내면 50% 할인돼요.'],
        ['계산은 기기에서', '날짜·시간 계산, 채점, 알림은 AI 없이 알고리즘이 해요. AI는 읽기와 해석에만 써요.']
      ].map(([h, d]) => `<div class="cell pad stack-s"><b>${h}</b><p class="small muted">${d}</p></div>`).join('')}</div></section>`;
}
function viewPrompts() {
  const story = [
    ['월 08:50', '칠판 공지를 찍는다', '국어 발표 카드 만들었어! 날짜 맞는지 봐 줘'],
    ['월 22:10', '채점 기준을 받는다', '주장마다 근거 2개, 출처는 꼭 넣기!'],
    ['화 21:00', '역산 계획이 나온다', '수 밤: 자료 조사 20분\n목 밤: 개요 20분'],
    ['수 07:30', '몰림 경보가 온다', '다음 주에 4과목이 겹쳐! 2개는 이번 주에 시작하자'],
    ['목 23:00', '못 한 날도 괜찮다', '괜찮아, 금요일 30분으로 옮겼어. 할 수 있어!']
  ];
  const list = Object.entries(P).filter(([, p]) => !p.plan || RANK[state.plan] >= RANK[p.plan]);
  return {
    title: 'AI 레시피', sub: 'AI가 어떻게 일하는지, 비용은 얼마인지, 실제로 보내는 프롬프트까지',
    body: `${aiMechanism()}
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:40">${icon('heart')}</span>시연 시나리오 · 지민이의 한 주</h2></div>
      <div class="story">${story.map(([w, h, n], i) => `<div class="cell${i === 3 ? ' hot' : ''}"><span class="when">${w}</span><b>${h}</b><div class="note${i === 3 ? ' peach' : ''}">${esc(n).replace(/\n/g, '<br>')}</div></div>`).join('')}</div></section>
    <section class="sec"><div class="sec-h"><h2><span class="ico hue" style="--h:196">${icon('book')}</span>레시피 ${list.length}개</h2><span class="small faint">{{ }} 부분만 바꿔 다른 챗봇에서도 시연할 수 있어요</span></div>
      <div class="grid g2">${list.map(([k, p]) => `<article class="cell pcard">
        <div class="row-sb"><div class="row"><span class="ni-ico hue" style="--h:${hueOf(p.name)}">${icon(p.icon)}</span><div><b>${p.name}</b><div class="tiny faint">${p.when} · ${p.tier}</div></div></div><button class="btn btn-line btn-sm" data-act="copyPrompt" data-arg="${k}">${icon('copy')}복사</button></div>
        <p class="small"><span class="chip blue">왜 AI인가</span> ${p.why}</p><pre id="pre-${k}">${esc(p.tpl)}</pre></article>`).join('')}</div></section>`
  };
}

/* ---------- 내비 코치 ---------- */
let chatDraft = '';
function viewChat() {
  const key = 'chat';
  const sugg = ['이번 주에 뭐부터 해?', '몰림 주는 어떻게 버텨?', '국어 감상문 대신 써 줘', '오늘 못 하면 어떻게 돼?'];
  const log = state.chat.map((m, i) => {
    const live = busy[key] && i === state.chat.length - 1 && m.role === 'ai';
    return m.role === 'me' ? `<div class="bub me">${esc(m.content)}</div>`
      : `<div class="bub ai"><span class="who">${logoMark(16)}내비 코치</span><span ${live ? `data-live="${key}"` : ''}>${esc(m.content) || '생각 중…'}</span></div>`;
  }).join('');
  return {
    title: '내비 코치', sub: `수행 카드함과 계획을 보고 답해요 · 말투: ${TONES[state.settings.tone].label}`,
    actions: state.chat.length ? `<button class="btn btn-soft btn-sm" data-act="clearChat">대화 지우기</button>` : '',
    body: `
    <div class="chatlog" style="min-height:40vh">
      <div class="bub ai"><span class="who">${logoMark(16)}내비 코치</span>${esc(state.settings.name || '')}${state.settings.name ? '님, ' : ''}수행평가 일정이나 채점 기준이 궁금하면 물어보세요. 과제 내용은 대신 쓰지 않고, 언제 무엇부터 할지 같이 정해요.</div>
      ${log}
    </div>
    ${state.chat.length ? '' : `<div class="sugg">${sugg.map(q => `<button class="pill-btn" data-act="chatAsk" data-arg="${esc(q)}" ${aiReady() ? '' : 'disabled'}>${esc(q)}</button>`).join('')}</div>`}
    ${aiNote()}${busyRow(key)}${errRow(key)}
    <div class="composer glass"><textarea id="chat-in" data-bind="chatDraft" rows="1" placeholder="메시지를 입력해요" aria-label="메시지">${esc(chatDraft)}</textarea>${busy[key] ? '' : `<button class="btn btn-pri btn-icon" data-act="chatSend" aria-label="보내기" ${aiReady() ? '' : 'disabled'}>${icon('send')}</button>`}</div>`,
    after() { const v = document.getElementById('view'); if (state.chat.length && v) { const last = v.querySelector('.chatlog .bub:last-child'); if (last && busy[key]) last.scrollIntoView({ block: 'nearest' }); } }
  };
}

/* ---------- data import (move from the Claude page to the installed app, or between devices) ---------- */
let importText = '';
SHEETS.import = sh => ({ html: `<div class="sheet-h"><h3>데이터 가져오기</h3><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>
  <p class="small muted">설정 → 데이터 → <b>내 데이터 복사</b>로 복사한 내용을 붙여넣어요. 지금 기기의 카드와 설정은 가져온 내용으로 바뀌어요.</p>
  <textarea class="input" id="import-in" data-bind="importText" rows="8" placeholder='{"cards": [...]}'>${esc(importText)}</textarea>
  ${sh.err ? `<p class="err">${esc(sh.err)}</p>` : ''}
  <div class="row-end"><button class="btn btn-soft" data-act="closeSheet">취소</button><button class="btn btn-pri" data-act="importRun">${icon('check')}가져오기</button></div>` });
const VIEWS = { today: viewToday, board: viewBoard, calendar: () => viewCalendar(), capture: viewCapture, study: () => viewStudy(), timetable: viewTimetable, progress: viewProgress, settings: viewSettings, prompts: viewPrompts, chat: viewChat };
