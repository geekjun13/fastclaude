'use strict';
/* 수행 내비 — 멤버십: three plans, twenty plan-only features (shown only to members),
   the focus timer with generated soundscapes, and the member AI tools. */

const TIERS = {
  air: { name: 'Air', price: 0, year: 0, tag: '기본', h: 44, quiz: '월 5회', desc: '수행평가 관리에 필요한 모든 기본 기능과 월 5회 시험지' },
  pro: { name: 'Pro', price: 3900, year: 39000, tag: '공부까지', h: 214, quiz: '무제한', desc: '문제집, 오답 되감기, 포커스 타이머로 공부를 끝까지' },
  performance: { name: 'Performance', price: 7900, year: 79000, tag: '시험 대비 완성', h: 300, quiz: '무제한', desc: '실전 모의고사, 약점 레이더, 시험 D-30 플랜까지' }
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

/* ---------- membership card (settings + studio) ---------- */
const AIR_BASICS = [['camera', '공지 스캔'], ['list', '채점 기준 번역'], ['route', '역산 플래너'], ['flame', '몰림 경보'], ['calendar', '캘린더 · 시간표'], ['bell', '정시 알림'], ['spark', '내비 코치'], ['book', '시험지 월 5회']];
const featsOf = k => FEATURES.filter(f => RANK[f.tier] <= RANK[k]);
const memberName = () => state.settings.name || '멤버';
function mcardHtml(tier, finish, opts) {
  const t = TIERS[tier], m = state.member, no = m.no || 'SN-0000-0000';
  return `<div class="mcard fin-${finish} tier-${tier}${opts && opts.flip ? ' flip' : ''}${opts && opts.small ? ' small' : ''}" ${opts && opts.id ? `id="${opts.id}"` : ''}>
    <div class="mc-face mc-front"><div class="mc-row">${logoMark(opts && opts.small ? 24 : 34)}<span class="mc-brand">수행 내비</span><span class="mc-holo" aria-hidden="true"></span></div>
      <div class="mc-tier">${t.name.toUpperCase()}</div>
      <div class="mc-row mc-low"><span><small>MEMBER</small><b>${esc(memberName())}</b></span><span class="mc-tag">${t.tag}</span></div></div>
    <div class="mc-face mc-back"><div class="mc-row"><span class="mc-brand">수행 내비 ${t.name}</span>${logoMark(26)}</div>
      <div class="mc-dots" aria-hidden="true"></div>
      <div class="mc-row mc-low"><span><small>MEMBER NO.</small><b class="num">${no}</b></span><span><small>SINCE</small><b class="num">${m.since ? m.since.replace(/-/g, '.') : today().replace(/-/g, '.')}</b></span></div></div>
  </div>`;
}
function memberSettingsHtml() {
  const cur = state.plan, t = TIERS[cur], f = featsOf(cur), cyc = state.member.cycle === 'year' ? '연간' : '월간';
  return `<div class="plan-hero cell hue" style="--h:${t.h}">
      <div class="ph-card" data-act="studioOpen" role="button" tabindex="0" aria-label="요금제 살펴보기">${mcardHtml(cur, effMode(), { small: true })}</div>
      <div class="ph-t"><span class="eyebrow">지금 쓰는 플랜</span><b>수행 내비 ${t.name}</b>
        <small>${t.price ? `${cyc} · 월 ${won(t.price)}${state.member.since ? ` · ${mdMid(state.member.since)}부터` : ''}` : '무료 · 기본 기능 모두'}</small>
        <p class="small muted">${esc(t.desc)}</p>
        <div class="row" style="margin-top:6px"><button class="btn btn-pri" data-act="studioOpen">${icon('spark')}요금제 살펴보기</button></div></div>
    </div>
    ${memberStatusHtml()}
    ${f.length ? `<div class="sec-sub" style="margin-top:6px">내 플랜 기능</div><div class="feat-grid">${f.map(x => `<div class="feat"><span class="ni-ico hue" style="--h:${TIERS[x.tier].h}">${icon(x.icon)}</span><div><b>${x.name}</b><small>${esc(x.desc)}</small></div></div>`).join('')}</div>` : ''}
    <p class="tiny faint">멤버십 기능은 해당 플랜에서만 화면에 나타나요. 언제든 여기서 바꿀 수 있어요.</p>`;
}

/* ---------- membership studio: configure → pay (test card) → unlock → celebrate ---------- */
let studio = null, studioT = [], runRaf = 0, payFillT = null;
const cyclePrice = (k, c) => (c === 'year' ? TIERS[k].year : TIERS[k].price);
/* card details live only in memory while the studio is open: never saved, never sent */
const freshPay = () => ({ num: '', exp: '', cvc: '', name: '', touched: {}, tried: false, flip: false });
let pay = freshPay();
const TEST_CARDS = new Set(['4242424242424242', '4000056655665556', '5555555555554444', '2223003122003222', '378282246310005']);
const BRAND = { visa: 'VISA', master: 'Mastercard', amex: 'AMEX' };
const cardBrand = n => (/^4/.test(n) ? 'visa' : /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n) ? 'master' : /^3[47]/.test(n) ? 'amex' : '');
const cardLen = n => (cardBrand(n) === 'amex' ? 15 : 16);
function luhn(n) { let sum = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; } return sum % 10 === 0; }
const fmtNum = n => (cardBrand(n) === 'amex' ? [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)] : [n.slice(0, 4), n.slice(4, 8), n.slice(8, 12), n.slice(12, 16)]).filter(Boolean).join(' ');
function cardGroups(n) {
  const g = cardBrand(n) === 'amex' ? [4, 6, 5] : [4, 4, 4, 4];
  let i = 0;
  return g.map(k => { let out = ''; for (let j = 0; j < k; j++, i++) out += n[i] || '•'; return `<span>${out}</span>`; }).join('');
}
function payCheck() {
  const p = pay, b = cardBrand(p.num), e = {};
  if (p.num.length < cardLen(p.num)) e.num = '카드 번호를 끝까지 입력해 주세요';
  else if (!luhn(p.num)) e.num = '카드 번호를 다시 확인해 주세요';
  else if (!TEST_CARDS.has(p.num)) e.num = '테스트 결제에서는 테스트 카드 번호만 쓸 수 있어요';
  const m = /^(\d{2})\/(\d{2})$/.exec(p.exp);
  if (!m || +m[1] < 1 || +m[1] > 12) e.exp = 'MM/YY로 입력해 주세요';
  else if (new Date(2000 + +m[2], +m[1], 1) <= new Date()) e.exp = '유효기간이 지난 카드예요';
  if (p.cvc.length !== (b === 'amex' ? 4 : 3)) e.cvc = `${b === 'amex' ? 4 : 3}자리 숫자`;
  if (!p.name.trim()) e.name = '카드에 적힌 이름을 입력해 주세요';
  return { ok: !Object.keys(e).length, e };
}
function payInput(k, el) {
  if (!studio || studio.step !== 'pay') return;
  const v = el.value;
  if (k === 'num') { const d = v.replace(/\D/g, ''); pay.num = d.slice(0, cardLen(d)); const f = fmtNum(pay.num); if (el.value !== f) el.value = f; }
  else if (k === 'exp') { let d = v.replace(/\D/g, '').slice(0, 4); if (d.length === 1 && +d > 1) d = '0' + d; const f = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; pay.exp = f; if (el.value !== f) el.value = f; }
  else if (k === 'cvc') { pay.cvc = v.replace(/\D/g, '').slice(0, 4); if (el.value !== pay.cvc) el.value = pay.cvc; }
  else if (k === 'name') pay.name = v.slice(0, 26);
  renderStudio();
}
document.addEventListener('focusin', e => { if (studio && e.target.id === 'pay-cvc') { pay.flip = true; renderStudio(); } });
document.addEventListener('focusout', e => {
  const k = e.target.dataset && e.target.dataset.pay;
  if (!k || !studio) return;
  pay.touched[k] = true; if (k === 'cvc') pay.flip = false;
  renderStudio();
});

function studioOpen() {
  const cur = state.plan;
  pay = freshPay();
  studio = { step: 'build', pick: cur === 'air' ? 'pro' : cur, cycle: state.member.cycle || 'month', finish: effMode(), phase: 0, from: cur };
  document.body.classList.add('studio-open');
  renderStudio(true);
}
function studioClose() {
  if (!studio || studio.step === 'run') return;
  studioT.forEach(clearTimeout); studioT = []; clearInterval(payFillT); cancelAnimationFrame(runRaf);
  studio = null; pay = freshPay(); applyLook(); document.body.classList.remove('studio-open');
  renderStudio();
}
function previewMode(m) { const r = document.documentElement; r.dataset.mode = m; const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = MODE_BG[m]; }
const RUN_UP = [['결제 정보를 확인하는 중', 0], ['멤버십 카드를 발급하는 중', 1500], ['전용 기능 잠금 해제 중', 3000], ['앱 컬러를 입히는 중', 5300], ['마무리하는 중', 6500]];
const RUN_DOWN = [['플랜을 바꾸는 중', 0], ['기능을 정리하는 중', 1100], ['앱 컬러를 입히는 중', 2200], ['마무리하는 중', 3100]];
const RUN_RENEW = [['결제 정보를 확인하는 중', 0], ['멤버십 카드를 갱신하는 중', 1500], ['앱 컬러를 입히는 중', 3000], ['마무리하는 중', 4100]];
const runPlan = () => (!studio.receipt ? { lines: RUN_DOWN, total: 4000 } : RANK[studio.pick] > RANK[studio.from] ? { lines: RUN_UP, total: 7600 } : { lines: RUN_RENEW, total: 5200 });
const sumRows = st => { const t = TIERS[st.pick], price = cyclePrice(st.pick, st.cycle); return [['플랜', `수행 내비 ${t.name}`], ['결제 주기', st.pick === 'air' ? '—' : st.cycle === 'year' ? '연간 (2개월 무료)' : '월간'], ['앱 컬러', MODES[st.finish].name], ['정가', price ? `${won(price)}${st.cycle === 'year' ? ' / 년' : ' / 월'}` : '무료']]; };
const slideHtml = (label, h, off, aria) => `<div class="slide${off ? ' off' : ''}" id="slide" style="--h:${h}"><span class="sl-fill" aria-hidden="true"></span><span class="sl-label">${label}</span>
  <button class="sl-knob" data-act="slideGo" aria-label="${aria}">${icon(off ? 'lock' : 'next')}</button></div>`;
function studioPanel() {
  const st = studio, cur = state.plan, t = TIERS[st.pick];
  if (st.step === 'build') {
    const plans = Object.entries(TIERS).map(([k, v]) => `<button class="plan-opt hue" style="--h:${v.h}" data-act="studioPick" data-arg="${k}" aria-pressed="${st.pick === k}">
        <span class="po-top"><b>${v.name}</b>${k === cur ? '<span class="chip green">사용 중</span>' : k === 'performance' ? '<span class="chip sun">추천</span>' : ''}</span>
        <span class="po-tag">${v.tag}</span><span class="po-price num">${v.price ? `${won(cyclePrice(k, st.cycle))}<small>${st.cycle === 'year' ? ' / 년' : ' / 월'}</small>` : '무료'}</span></button>`).join('');
    const sw = Object.entries(MODES).map(([k, m]) => `<button class="fin-sw fs-${k}" data-act="studioFinish" data-arg="${k}" aria-pressed="${st.finish === k}"><i aria-hidden="true"></i><b>${m.name}</b></button>`).join('');
    const feats = featsOf(st.pick), have = new Set(featsOf(cur).map(f => f.id));
    return `<div class="st-sec"><h3>플랜</h3><div class="plan-opts">${plans}</div></div>
      <div class="st-sec"><h3>결제 주기</h3><div class="seg" data-seg="cycle" role="group" aria-label="결제 주기"><button data-act="studioCycle" data-arg="month" aria-pressed="${st.cycle === 'month'}">월간</button><button data-act="studioCycle" data-arg="year" aria-pressed="${st.cycle === 'year'}">연간 · 2개월 무료</button></div></div>
      <div class="st-sec"><h3>앱 컬러</h3><p class="small faint">멤버십 카드와 앱 전체에 입혀져요</p><div class="fin-sws">${sw}</div></div>
      <div class="st-sec"><h3>${st.pick === 'air' ? '기본 기능' : `포함된 기능 ${feats.length}개`}</h3>
        <ul class="feat-list">${st.pick === 'air' ? AIR_BASICS.map(([ic, n]) => `<li data-key="b-${n}">${icon(ic)}<span>${n}</span></li>`).join('')
          : feats.map(f => `<li data-key="${f.id}" class="${have.has(f.id) ? '' : 'new'}"><span class="ni-ico hue" style="--h:${TIERS[f.tier].h}">${icon(f.icon)}</span><span><b>${f.name}</b><small>${esc(f.desc)}</small></span>${have.has(f.id) ? '' : '<em>새로</em>'}</li>`).join('')}</ul></div>`;
  }
  if (st.step === 'pay') {
    const p = pay, b = cardBrand(p.num), price = cyclePrice(st.pick, st.cycle), v = payCheck();
    const err = k => (v.e[k] && (p.touched[k] || p.tried) ? `<small class="pay-err">${v.e[k]}</small>` : '');
    const okc = k => (!v.e[k] ? ' ok' : '');
    const fld = (k, label, attrs, val) => `<label class="field pay-f${okc(k)}"><span>${label}</span><input class="input" id="pay-${k}" data-pay="${k}" autocomplete="off" spellcheck="false" ${attrs} value="${esc(val)}">${err(k)}</label>`;
    return `<button class="btn btn-soft btn-sm st-back" data-act="studioBack">${icon('back')}구성 바꾸기</button>
      <div class="st-sec"><div class="row-sb"><h3>결제 수단</h3><span class="chip blue">${icon('lock')}테스트 결제</span></div>
        <div class="paycard brand-${b || 'none'}${p.flip ? ' flip' : ''}" id="paycard" aria-hidden="true">
          <div class="pc-face pc-front"><div class="pc-top"><span class="pc-chip"></span><span class="pc-brand">${BRAND[b] || ''}</span></div>
            <div class="pc-num num">${cardGroups(p.num)}</div>
            <div class="pc-low"><span><small>CARD HOLDER</small><b>${esc(p.name.toUpperCase() || '이름')}</b></span><span><small>VALID THRU</small><b class="num">${esc(p.exp || 'MM/YY')}</b></span></div></div>
          <div class="pc-face pc-back"><i class="pc-stripe"></i><div class="pc-sign"><span></span><b class="num">${p.cvc ? '•'.repeat(p.cvc.length) : 'CVC'}</b></div></div>
        </div>
        <div class="pay-form">
          ${fld('num', '카드 번호', 'inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19"', fmtNum(p.num))}
          <div class="pay-row">${fld('exp', '유효기간', 'inputmode="numeric" placeholder="MM/YY" maxlength="5"', p.exp)}${fld('cvc', 'CVC', 'inputmode="numeric" placeholder="123" maxlength="4"', p.cvc)}</div>
          ${fld('name', '카드 소유자 이름', 'placeholder="카드에 적힌 이름"', p.name)}
          <div class="row-sb"><button class="btn btn-line btn-sm" data-act="payFill">${icon('spark')}테스트 카드 채우기</button><span class="tiny faint">테스트 카드 4242 4242 4242 4242</span></div>
          <p class="tiny faint pay-note">${icon('lock')}테스트 결제라 실제로 청구되지 않아요. 입력한 카드 정보는 저장하거나 보내지 않아요.</p>
        </div></div>
      <div class="st-sec"><div class="sum">${sumRows(st).map(([k, x]) => `<div class="sum-r"><span>${k}</span><b>${x}</b></div>`).join('')}
        <div class="sum-r total"><span>결제 금액 <span class="chip blue">테스트</span></span><b class="num">${won(price)}</b></div></div></div>
      ${slideHtml(v.ok ? `밀어서 ${won(price)} 결제하기` : '카드 정보를 입력해 주세요', t.h, !v.ok, `${won(price)} 결제`)}`;
  }
  if (st.step === 'review') {
    return `<button class="btn btn-soft btn-sm st-back" data-act="studioBack">${icon('back')}구성 바꾸기</button>
      <div class="st-sec"><h3>플랜 변경 확인</h3>
        <div class="sum">${sumRows(st).map(([k, x]) => `<div class="sum-r"><span>${k}</span><b>${x}</b></div>`).join('')}<div class="sum-r total"><span>결제 금액</span><b class="num">0원</b></div></div>
        <p class="small faint">${TIERS[cur].name} 전용 기능은 화면에서 사라지고, 만든 기록은 그대로 남아요.</p></div>
      ${slideHtml(`밀어서 ${t.name}로 변경`, t.h, false, `${t.name}로 변경`)}`;
  }
  if (st.step === 'run') {
    const { lines } = runPlan(), gained = featsOf(st.pick).filter(f => RANK[f.tier] > RANK[st.from]);
    const step = gained.length ? Math.floor(2100 / gained.length) : 0;
    return `<div class="st-run">
      <div class="run-dial"><svg class="run-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="bg"/><circle cx="40" cy="40" r="34" class="fg" pathLength="1"/></svg><b class="num run-pct" id="run-pct" data-keep>0%</b></div>
      <p class="run-cap" data-swap="${st.phase}">${lines[Math.min(st.phase, lines.length - 1)][0]}</p>
      <ul class="run-lines">${lines.map(([l], i) => `<li class="${st.phase > i ? 'rl-done' : st.phase === i ? 'rl-cur' : ''}" data-key="l${i}"><i>${icon('check')}</i><span>${l}</span></li>`).join('')}</ul>
      ${gained.length ? `<div class="unlock"><div class="ul-h"><b>${icon('lock')}잠금 해제</b><span class="num" id="ul-count" data-keep>0 / ${gained.length}</span></div>
        <div class="ul-grid" style="--ustep:${step}ms">${gained.map((f, i) => `<span class="ul-i hue" style="--h:${TIERS[f.tier].h};--i:${i}" title="${esc(f.name)}">${icon(f.icon)}<em>${icon('lock')}</em></span>`).join('')}</div></div>` : ''}
    </div>`;
  }
  const gained = featsOf(st.pick).filter(f => RANK[f.tier] > RANK[st.from]), rc = st.receipt;
  return `<div class="st-done"><span class="eyebrow">${st.pick === 'air' ? '변경 완료' : 'WELCOME'}</span>
      <h2>${st.pick === 'air' ? 'Air로 바꿨어요' : `환영해요, ${esc(memberName())}님!`}</h2>
      <p class="muted">${st.pick === 'air' ? '기본 기능은 그대로 쓸 수 있어요.' : `수행 내비 ${t.name} 멤버가 됐어요.${gained.length ? ` 새로 열린 기능 ${gained.length}개를 바로 써 보세요.` : ''}`}</p>
      ${rc ? `<div class="receipt"><div class="rc-h"><b>결제 영수증</b><span class="chip blue">테스트</span></div>
        ${[['상품', `수행 내비 ${t.name} · ${rc.cycle === 'year' ? '연간' : '월간'}`], ['결제 금액', won(rc.amount)], ['결제 수단', `${BRAND[rc.brand] || '카드'} •••• ${rc.last4}`], ['거래 번호', rc.id], ['일시', `${mdMid(ymd(new Date(rc.at)))} ${hm(new Date(rc.at).getHours() * 60 + new Date(rc.at).getMinutes())}`]].map(([k, x]) => `<div class="sum-r"><span>${k}</span><b class="${k === '거래 번호' ? 'num' : ''}">${x}</b></div>`).join('')}</div>` : ''}
      ${gained.length ? `<ul class="feat-list done-list">${gained.map((f, i) => `<li style="--i:${i}"><span class="ni-ico hue" style="--h:${TIERS[f.tier].h}">${icon(f.icon)}</span><span><b>${f.name}</b><small>${esc(f.desc)}</small></span></li>`).join('')}</ul>` : ''}</div>`;
}
function studioHtml() {
  const st = studio, t = TIERS[st.pick], price = cyclePrice(st.pick, st.cycle), cur = state.plan;
  const cycleChange = st.pick === cur && cur !== 'air' && st.cycle !== state.member.cycle;
  const sameAll = st.pick === cur && st.finish === effMode() && !cycleChange;
  const next = st.pick !== cur || cycleChange ? 'next' : st.finish === effMode() ? '' : 'finish';
  return `<div class="studio" data-step="${st.step}" style="--h:${t.h}">
    <div class="st-bg" aria-hidden="true"><i></i><i></i></div>
    <header class="st-top"><span class="st-brand">${logoMark(26)}<b>수행 내비 멤버십</b></span>${st.step === 'run' ? '' : `<button class="btn btn-soft btn-icon btn-sm" data-act="studioClose" aria-label="닫기">${icon('x')}</button>`}</header>
    <div class="st-body">
      <section class="st-stage" id="st-stage">
        <div class="st-float"><span class="st-aura" aria-hidden="true"></span>${mcardHtml(st.pick, st.finish, { id: 'mcard', flip: st.step === 'done' && st.pick !== 'air' })}<div class="mc-shadow" aria-hidden="true"></div></div>
        <div class="st-name"><span class="eyebrow">${t.tag}</span><h2>${t.name}</h2>
          <div class="st-specs"><div><b class="num" id="st-feat" data-keep data-to="${featsOf(st.pick).length}">${featsOf(st.pick).length}</b><small>전용 기능</small></div><div><b>${t.quiz}</b><small>시험지</small></div><div><b class="num">${t.price ? won(t.price) : '0원'}</b><small>월 정가</small></div></div></div>
      </section>
      <aside class="st-panel"><div class="st-scroll" data-swap="${st.step}">${studioPanel()}</div>
        ${st.step === 'build' ? `<footer class="st-foot"><div class="st-price"><b class="num" id="st-price" data-keep data-to="${price}">${price ? won(price) : '무료'}</b><small>${price ? (st.cycle === 'year' ? `연간 · 월 ${won(Math.round(price / 12))}꼴` : '월간 · 언제든 해지') : '기본 기능 모두'}</small></div>
          ${sameAll ? '<span class="chip green">지금 쓰는 플랜</span>' : `<button class="btn btn-pri" data-act="${next === 'finish' ? 'studioFinishOnly' : 'studioNext'}">${next === 'finish' ? '앱 컬러 적용' : '계속'}${icon('next')}</button>`}</footer>`
        : st.step === 'done' ? `<footer class="st-foot done-foot"><button class="btn btn-pri btn-block" data-act="studioDone">${st.pick === 'air' ? '확인' : '시작하기'}${icon('next')}</button></footer>` : ''}
      </aside>
    </div></div>`;
}
function renderStudio(fresh) {
  const root = document.getElementById('studio-root');
  if (!root) return;
  if (!studio) {
    const cur = root.firstElementChild;
    if (!cur) return;
    root.classList.remove('tilt');
    if (!motionOn()) { root.innerHTML = ''; return; }
    cur.classList.add('closing'); setTimeout(() => { if (!studio) root.innerHTML = ''; }, 420 * mo());
    return;
  }
  if (fresh || !root.firstElementChild || root.firstElementChild.classList.contains('closing')) root.innerHTML = studioHtml();
  else morph(root, studioHtml());
  const fmt = v => (v ? won(v) : '무료');
  const pe = document.getElementById('st-price'); if (pe) tweenNum(pe, +pe.dataset.to, fmt);
  const fe = document.getElementById('st-feat'); if (fe) tweenNum(fe, +fe.dataset.to, v => String(v));
  fxAfterRender(); swapAnim(); swapped.length = 0;
}
function studioRun() {
  const st = studio; if (!st || (st.step !== 'review' && st.step !== 'pay')) return;
  if (st.step === 'pay') {
    if (!payCheck().ok) return;
    st.receipt = { id: `TX-${Date.now().toString(36).toUpperCase().slice(-8)}`, at: Date.now(), amount: cyclePrice(st.pick, st.cycle), cycle: st.cycle, brand: cardBrand(pay.num), last4: pay.num.slice(-4), plan: st.pick, test: true };
  }
  pay = freshPay(); // the card details are dropped as soon as the payment starts
  const { lines, total } = runPlan(), m = motionOn() ? mo() : 0.12;
  st.step = 'run'; st.phase = 0; st.runAt = performance.now(); st.runTotal = total * m;
  document.getElementById('studio-root').style.setProperty('--run', `${(total * m / 1000).toFixed(2)}s`);
  renderStudio();
  lines.forEach(([, at], i) => { if (i) studioT.push(setTimeout(() => { if (studio) { studio.phase = i; renderStudio(); } }, at * m)); });
  const gainedN = featsOf(st.pick).filter(f => RANK[f.tier] > RANK[st.from]).length, ust = gainedN ? 2100 / gainedN : 0;
  const tick = now => {
    if (!studio || studio.step !== 'run') return;
    const k = Math.min(1, (now - st.runAt) / st.runTotal), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const pe = document.getElementById('run-pct'); if (pe) pe.textContent = `${Math.round(e * 100)}%`;
    const ce = document.getElementById('ul-count');
    if (ce) { const tms = (now - st.runAt) / m; ce.textContent = `${clamp(Math.floor((tms - 3000) / ust) + 1, 0, gainedN)} / ${gainedN}`; }
    if (k < 1) runRaf = requestAnimationFrame(tick);
  };
  runRaf = requestAnimationFrame(tick);
  studioT.push(setTimeout(() => {
    if (!studio) return;
    cancelAnimationFrame(runRaf);
    const up = RANK[st.pick] > RANK[state.plan];
    state.plan = st.pick;
    state.member.cycle = st.cycle;
    if (st.pick === 'air') { state.member.since = null; state.member.no = null; }
    else if (up || !state.member.no) { state.member.since = today(); state.member.no = `SN-${today().slice(0, 4)}-${String(Math.floor(1000 + Math.random() * 9000))}`; }
    if (st.receipt) { state.member.history = [st.receipt, ...(state.member.history || [])].slice(0, 20); }
    else state.member.history = [{ id: `TX-${Date.now().toString(36).toUpperCase().slice(-8)}`, at: Date.now(), amount: 0, cycle: st.cycle, plan: st.pick, test: true }, ...(state.member.history || [])].slice(0, 20);
    state.look.mode = st.finish;
    if (!has('themes')) state.look.theme = 'sunrise';
    if (!has('focus')) { state.timer = null; soundStop(); }
    save(); applyLook();
    studio.step = 'done'; renderStudio(); render(); renderFocus();
    if (st.pick !== 'air') {
      const c = document.getElementById('mcard'), r = c && c.getBoundingClientRect();
      studioT.push(setTimeout(() => confetti(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height / 2 : innerHeight / 3, 200), 420 * m));
    }
  }, total * m));
}
/* tilt + light follow the pointer while it is over the stage; the card is flat (crisp text) otherwise */
document.addEventListener('pointermove', e => {
  if (!studio || e.pointerType === 'touch') return;
  const stage = document.getElementById('st-stage'), root = document.getElementById('studio-root');
  if (!stage || !root) return;
  const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1 && studio.step !== 'run' && studio.step !== 'done';
  root.classList.toggle('tilt', inside);
  if (!inside) return;
  root.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg');
  root.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
  root.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
  root.style.setProperty('--my', (y * 100).toFixed(1) + '%');
}, { passive: true });
/* slide to confirm */
let slideDrag = null;
function slideBlocked(tr) {
  pay.tried = true; renderStudio();
  const t = document.getElementById('slide'); if (t) { t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake'); }
  const first = document.querySelector('.pay-f:not(.ok) input'); if (first) first.focus();
}
document.addEventListener('pointerdown', e => {
  const k = e.target.closest && e.target.closest('.sl-knob');
  if (!k || !studio || (studio.step !== 'review' && studio.step !== 'pay')) return;
  const tr = k.parentElement;
  if (tr.classList.contains('off')) { slideBlocked(tr); return; }
  const r = tr.getBoundingClientRect();
  slideDrag = { k, tr, x0: e.clientX, max: r.width - k.offsetWidth - 8, moved: false };
  k.setPointerCapture(e.pointerId); tr.classList.add('dragging');
});
document.addEventListener('pointermove', e => {
  if (!slideDrag) return;
  const d = clamp(e.clientX - slideDrag.x0, 0, slideDrag.max);
  if (d > 4) slideDrag.moved = true;
  slideDrag.tr.style.setProperty('--x', d + 'px');
  slideDrag.tr.style.setProperty('--p', (d / slideDrag.max).toFixed(3));
});
document.addEventListener('pointerup', () => {
  if (!slideDrag) return;
  const { tr, max } = slideDrag, d = parseFloat(tr.style.getPropertyValue('--x')) || 0, moved = slideDrag.moved;
  slideDrag = null; tr.classList.remove('dragging');
  if (d > max * 0.82) { tr.style.setProperty('--x', max + 'px'); tr.style.setProperty('--p', 1); tr.classList.add('done'); setTimeout(studioRun, 280); }
  else { tr.style.setProperty('--x', '0px'); tr.style.setProperty('--p', 0); if (!moved) { tr.classList.remove('nudge'); void tr.offsetWidth; tr.classList.add('nudge'); } }
});

/* ---------- membership status: usage charts and payment history (settings) ---------- */
function memberStatusHtml() {
  const t0 = today(), m0 = mondayOf(t0), month = t0.slice(0, 7), plan = state.plan;
  const realSets = state.study.sets.filter(x => !x.example);
  const monthSets = realSets.filter(x => x.createdAt && ymd(new Date(x.createdAt)).slice(0, 7) === month).length;
  const week = daysInRange(m0, addDays(m0, 6)).map(d => ({ d, min: state.timerLog.filter(l => l.at === d).reduce((n, l) => n + (l.actual || 0), 0) }));
  const weekMin = week.reduce((n, x) => n + x.min, 0), maxMin = Math.max(30, ...week.map(x => x.min));
  const open = featsOf(plan).length, days = state.member.since ? diffDays(state.member.since, t0) + 1 : 0;
  const uses = [['시험지 · 문제집', realSets.filter(x => x.kind !== 'rewind').length], ['오답 되감기', realSets.filter(x => x.kind === 'rewind').length], ['복습 카드', state.study.cards.length],
    ['포커스 세션', state.timerLog.length], ['루브릭 셀프 채점', state.cards.filter(a => a.selfcheck && a.selfcheck.result).length], ['예상 질문', state.cards.filter(a => a.expect && a.expect.result && a.expect.result.length).length], ['AI 주간 리포트', Object.keys(state.reports).length]]
    .sort((a, b) => b[1] - a[1]);
  const maxUse = Math.max(1, ...uses.map(u => u[1]));
  const hist = state.member.history || [];
  const tile = (label, val, unit, extra) => `<div class="cell stat"><span class="lbl">${label}</span><span class="big">${val}<small>${unit}</small></span>${extra || ''}</div>`;
  return `<div class="sec-sub" style="margin-top:6px">멤버십 현황</div>
    <div class="grid g4">
      ${tile('멤버 기간', days || 0, '일째')}
      ${tile('열린 기능', open, ` / ${FEATURES.length}`, `<span class="meter"><i style="width:${Math.round(open / FEATURES.length * 100)}%"></i></span>`)}
      ${tile('이번 달 시험지', monthSets, plan === 'air' ? ` / ${AIR_QUIZ_LIMIT}` : '개', plan === 'air' ? `<span class="meter"><i style="width:${Math.min(100, Math.round(state.usage.quiz / AIR_QUIZ_LIMIT * 100))}%"></i></span>` : '')}
      ${tile('이번 주 집중', weekMin, '분')}
    </div>
    <div class="grid g2">
      <div class="cell pad chart-card"><div class="row-sb"><b>이번 주 집중 시간</b><span class="small faint">포커스 타이머 기록 · 분</span></div>
        <div class="vbars" role="img" aria-label="요일별 집중 시간: ${week.map(x => `${WD[parseYmd(x.d).getDay()]} ${x.min}분`).join(', ')}">${week.map(x => `<div class="vb${x.d === t0 ? ' today' : ''}" title="${md(x.d)} ${x.min}분"><span class="vb-v num">${x.min || ''}</span><span class="vb-bar"><i style="height:${Math.round(x.min / maxMin * 100)}%"></i></span><small>${WD[parseYmd(x.d).getDay()]}</small></div>`).join('')}</div>
        ${weekMin ? '' : '<p class="small faint">투데이에서 시계 버튼으로 단계를 시작하면 여기에 쌓여요.</p>'}</div>
      <div class="cell pad chart-card"><div class="row-sb"><b>기능 사용</b><span class="small faint">지금까지 · 횟수</span></div>
        <div class="hbars">${uses.map(([k, n]) => `<div class="hb" title="${k} ${n}회"><span class="hb-k">${k}</span><span class="hb-bar"><i style="width:${Math.max(n ? 3 : 0, Math.round(n / maxUse * 100))}%"></i></span><span class="hb-v num">${n}</span></div>`).join('')}</div></div>
    </div>
    <div class="cell pad"><div class="row-sb"><b>결제 내역</b>${hist.length ? '<span class="chip blue">테스트 결제</span>' : ''}</div>
      ${hist.length ? `<div class="hist">${hist.map(h => `<div class="hist-r"><span class="ni-ico hue" style="--h:${TIERS[h.plan] ? TIERS[h.plan].h : 44}">${icon(h.amount ? 'check' : 'route')}</span><div style="flex:1;min-width:0"><b>수행 내비 ${TIERS[h.plan] ? TIERS[h.plan].name : ''}${h.amount ? ` · ${h.cycle === 'year' ? '연간' : '월간'}` : ' 변경'}</b><small>${mdMid(ymd(new Date(h.at)))} · ${h.last4 ? `${BRAND[h.brand] || '카드'} •••• ${h.last4} · ` : ''}${h.id}</small></div><b class="num">${won(h.amount)}</b></div>`).join('')}</div>`
        : '<p class="small faint">아직 결제 내역이 없어요.</p>'}</div>`;
}

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
  morph(root, `<div class="focus glass${left < 0 ? ' over' : ''}" role="region" aria-label="포커스 타이머">
    <svg class="f-ring hue" style="--h:${a ? hueOf(a.subject) : 214}" viewBox="0 0 54 54"><circle cx="27" cy="27" r="${r}" class="bg"/><circle cx="27" cy="27" r="${r}" class="fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></svg>
    <div class="f-c"><small>${a ? esc(a.subject) + ' · ' : ''}${tm.pausedAt ? '잠시 멈춤' : left < 0 ? '시간 지남' : '집중 중'}</small><b>${esc(tm.name)}</b><span class="num f-time">${left < 0 ? '+' : ''}${mmss(left)}</span></div>
    <div class="f-act"><button class="btn btn-soft btn-icon btn-sm" data-act="focusPause" aria-label="${tm.pausedAt ? '다시 시작' : '멈춤'}">${icon(tm.pausedAt ? 'next' : 'stop')}</button><button class="btn btn-pri btn-icon btn-sm" data-act="focusDone" aria-label="다 했어요">${icon('check')}</button><button class="btn btn-soft btn-icon btn-sm" data-act="focusStop" aria-label="타이머 끄기">${icon('x')}</button></div>
    ${has('sound') ? `<div class="f-snd">${[['off', '소리 끔'], ['rain', '빗소리'], ['white', '백색'], ['brown', '브라운']].map(([k, l]) => `<button class="pill-btn" data-act="focusSound" data-arg="${k}" aria-pressed="${(tm.sound || 'off') === k}">${l}</button>`).join('')}</div>` : ''}
  </div>`);
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
  studioOpen() { studioOpen(); },
  studioClose() { studioClose(); },
  studioPick(k) { if (studio && TIERS[k]) { studio.pick = k; renderStudio(); } },
  studioCycle(c) { if (studio) { studio.cycle = c === 'year' ? 'year' : 'month'; renderStudio(); } },
  studioFinish(m) { if (studio && MODES[m]) { studio.finish = m; previewMode(m); renderStudio(); } },
  studioFinishOnly() { if (!studio) return; state.look.mode = studio.finish; save(); applyLook(); render(); studioClose(); toast(`${MODES[state.look.mode].name} 컬러를 입혔어요`); },
  studioNext() { if (studio) { studio.step = RANK[studio.pick] < RANK[state.plan] || studio.pick === 'air' ? 'review' : 'pay'; renderStudio(); } },
  payFill() {
    if (!studio || studio.step !== 'pay') return;
    clearInterval(payFillT);
    const yy = String((new Date().getFullYear() + 3) % 100).padStart(2, '0');
    const name = /^[A-Za-z ]+$/.test(state.settings.name || '') ? state.settings.name : 'JIMIN KIM';
    const seq = [...[...'4242424242424242'].map(c => ['num', c]), ...[...`12${yy}`].map(c => ['exp', c]), ...[...'123'].map(c => ['cvc', c]), ...[...name].map(c => ['name', c])];
    Object.assign(pay, { num: '', exp: '', cvc: '', name: '', touched: {}, tried: false });
    let i = 0;
    const stepFn = () => {
      if (!studio || studio.step !== 'pay' || i >= seq.length) { clearInterval(payFillT); pay.flip = false; if (studio) renderStudio(); return; }
      const [k, c] = seq[i++];
      if (k === 'exp') { const d = pay.exp.replace('/', '') + c; pay.exp = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; }
      else pay[k] += c;
      pay.flip = k === 'cvc';
      renderStudio();
    };
    if (motionOn()) payFillT = setInterval(stepFn, 34); else { while (i < seq.length) stepFn(); stepFn(); }
  },
  studioBack() { if (studio) { clearInterval(payFillT); studio.step = 'build'; renderStudio(); } },
  slideGo(arg, el, e) {
    const tr = document.getElementById('slide'); if (!tr) return;
    if (tr.classList.contains('off')) { slideBlocked(tr); return; }
    if (e && e.detail === 0) { tr.style.setProperty('--x', (tr.offsetWidth - el.offsetWidth - 8) + 'px'); tr.style.setProperty('--p', 1); tr.classList.add('done'); setTimeout(studioRun, 280); }
  },
  studioDone() { const st = studio; studioClose(); if (st) toast(st.pick === 'air' ? 'Air로 바꿨어요' : `수행 내비 ${TIERS[st.pick].name}를 시작했어요`); },
  planApply(k) {
    if (!TIERS[k]) return;
    state.plan = k;
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
