/*
 * 수행 내비 — 핵심 기능 데모 (발표용)
 * 앱의 핵심 로직 5가지를 한 파일로 줄여 옮긴 코드예요. 설치 없이 실행돼요.
 *
 *   실행:  node demo/core-demo.js
 *
 *   ① AI 출력 검증      AI가 준 JSON을 그대로 믿지 않고 정리
 *   ② 개인정보 상자     AI가 찾은 이름 위치를 넉넉하게 넓혀 가리기
 *   ③ 역산 플래너       마감일부터 거꾸로 세어 시작일 찾기
 *   ④ 몰림 경보         같은 주에 마감 3개 이상이면 미리 알림
 *   ⑤ 정확도 측정       학생이 고친 칸 = AI가 틀린 칸
 *   ⑥ 내 속도 보정      실제 걸린 시간을 배워 다음 계획에 반영
 *
 * 실제 앱에서는 ①의 입력이 Claude의 답이에요:
 *   const aiAnswer = await sample.json(prompt, { images: [공지사진] });
 * 이 데모는 API 없이 돌도록, Claude가 돌려줄 법한 답을 아래에 직접 적어 뒀어요.
 */

const TODAY = '2026-10-19'; // 월요일. 결과가 늘 같도록 날짜를 고정

/* ---------- 날짜 도우미 ---------- */
const d = s => new Date(s + 'T00:00:00');
const ymd = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const x = d(s); x.setDate(x.getDate() + n); return ymd(x); };
const diffDays = (a, b) => Math.round((d(b) - d(a)) / 86400000);
const mondayOf = s => addDays(s, -((d(s).getDay() + 6) % 7));
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const label = s => `${d(s).getMonth() + 1}/${d(s).getDate()}(${WD[d(s).getDay()]})`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------- Claude가 돌려줄 법한 답 (일부러 지저분하게) ---------- */
const aiAnswer = {
  items: [
    { subject: '수학', type: '포트폴리오', title: '자료의 정리와 해석 포스터', due: '2026-10-22', materials: ['4절지'], rubric: ['자료 수집 (5점)'], uncertain: [] },
    { subject: '국어', type: '발표', title: '시 낭송과 감상문', due: '2026-10-27', materials: ['시집'], rubric: ['암송 정확성 (10점)'], uncertain: [] },
    { subject: '영어', type: '말하기', title: '자기소개 2분', due: '2026-10-29', materials: [], rubric: [], uncertain: [{ field: '마감일', why: '"다음 주 목요일"이라고만 적혀 있음' }] },
    { subject: '사회', type: '조사활동', title: '우리 지역 문제 신문', due: '10월 30일', materials: null, rubric: ['구체성'], uncertain: [] }
  ],
  privacy: [{ image: 1, label: '이름', box: [0.62, 0.08, 0.12, 0.05] }]
};

/* ---------- ① AI 출력 검증 ---------- */
const TYPES = ['보고서', '발표', '말하기', '글쓰기', '실험', '실기', '포트폴리오', '모둠 활동', '시험형'];
function cleanItem(x) {
  return {
    subject: String(x.subject || '').trim(),
    title: String(x.title || '').trim(),
    type: TYPES.includes(x.type) ? x.type : '',                     // 정해진 유형만
    due: /^\d{4}-\d{2}-\d{2}$/.test(x.due) ? x.due : '',              // 날짜 형식이 아니면 비움
    materials: Array.isArray(x.materials) ? x.materials : [],         // null이 와도 배열로
    rubric: Array.isArray(x.rubric) ? x.rubric : [],
    uncertain: Array.isArray(x.uncertain) ? x.uncertain : []
  };
}

/* ---------- ② 개인정보 상자: 조금 크게 가리는 건 괜찮지만, 이름을 놓치면 안 돼요 ---------- */
function padBox([x, y, w, h]) {
  const px = 0.015, py = 0.01;
  const bx = clamp(x - px, 0, 1), by = clamp(y - py, 0, 1);
  return { x: bx, y: by, w: clamp(w + px * 2, 0.02, 1 - bx), h: clamp(h + py * 2, 0.02, 1 - by) };
}

/* ---------- ④ 몰림 경보: 같은 주(월요일 기준)에 마감 3개 이상 ---------- */
function crunchWeeks(cards) {
  const weeks = {};
  for (const c of cards) (weeks[mondayOf(c.due)] = weeks[mondayOf(c.due)] || []).push(c);
  return Object.entries(weeks).filter(([, list]) => list.length >= 3);
}

/* ---------- ③ 역산 플래너 ---------- */
// 하루에 쓸 수 있는 시간(분) = 학교 끝난 뒤부터 공부 마감까지 − 학원(이동 포함), 최대 90분
const ACADEMY = { 1: 210, 3: 210, 5: 210, 2: 180, 4: 180 }; // 요일별 학원 시간(이동 포함, 분)
function freeMinutes(date) {
  const wd = d(date).getDay(), weekend = wd === 0 || wd === 6;
  const open = weekend ? 600 : 1320 - 980 - (ACADEMY[wd] || 0); // 주말 10시간, 평일 16:20~22:00
  return Math.min(weekend ? 150 : 90, Math.max(0, open));
}
const used = {}; // 날마다 이미 배치한 분: 여러 수행평가가 같은 저녁을 나눠 써요
const roomOn = day => freeMinutes(day) - (used[day] || 0);
function planBackward(card, totalMinutes, crunch) {
  const factor = crunch ? 2.0 : 1.5;                 // 몰림 주면 여유를 두 배로
  const need = totalMinutes * factor;
  const lastWork = addDays(card.due, -2);            // 마감 전날은 비워 두기
  let start = lastWork, acc = 0;
  for (let day = lastWork; diffDays(TODAY, day) >= 0; day = addDays(day, -1)) {
    acc += roomOn(day);                              // 거꾸로 남은 빈 시간을 모아서
    start = day;
    if (acc >= need) break;                          // 충분해지는 가장 늦은 날이 시작일
  }
  // 앞으로 배치: 하루 몫을 고르게 (20분보다 짧게 쪼개지 않음)
  const days = diffDays(start, lastWork) + 1;
  const quota = Math.max(30, Math.ceil(totalMinutes / days / 10) * 10);
  const plan = [];
  let left = totalMinutes;
  for (let day = start; left > 0 && diffDays(day, lastWork) >= 0; day = addDays(day, 1)) {
    const m = Math.min(quota, roomOn(day), left);
    if (m >= 20) { plan.push([day, m]); left -= m; used[day] = (used[day] || 0) + m; }
  }
  return { start, plan, tight: acc < need || left > 0 };
}

/* ---------- ⑤ 정확도 측정: 학생이 고친 칸 = AI가 틀린 칸 ---------- */
const FIELDS = ['subject', 'type', 'title', 'due', 'materials', 'rubric'];
const norm = v => (Array.isArray(v) ? v.join('|') : String(v || '')).replace(/\s/g, '');
function fixedFields(ai, final) { return FIELDS.filter(k => norm(ai[k]) !== norm(final[k])); }

/* ---------- ⑥ 내 속도 보정: 실제/계획 비율의 중앙값 ---------- */
function paceFactor(logs) {
  const r = logs.map(l => l.actual / l.planned).sort((a, b) => a - b);
  if (r.length < 3) return 1;                              // 기록이 3번은 있어야
  return clamp(Math.round(r[Math.floor(r.length / 2)] * 100) / 100, 0.7, 1.6);
}

/* ================= 실행 ================= */
const line = t => console.log(`\n━━ ${t} ${'━'.repeat(Math.max(0, 40 - t.length))}`);

line('① AI 출력 검증');
const cards = aiAnswer.items.map(cleanItem);
for (const c of cards) {
  const warn = [!c.due && '마감일 형식 오류 → 학생 확인 필요', !c.type && '유형 목록에 없음', ...c.uncertain.map(u => `애매함: ${u.field} (${u.why})`)].filter(Boolean);
  console.log(`${c.subject.padEnd(3)} ${c.title.padEnd(16)} 마감 ${c.due || '(비어 있음)'}${warn.length ? '  ⚠ ' + warn.join(', ') : ''}`);
}

line('② 개인정보 상자');
for (const p of aiAnswer.privacy) {
  const b = padBox(p.box);
  console.log(`사진 ${p.image}의 "${p.label}" → x ${b.x.toFixed(3)}, y ${b.y.toFixed(3)}, 너비 ${b.w.toFixed(3)}, 높이 ${b.h.toFixed(3)}  (원래보다 넓게)`);
}

// 학생이 확인 화면에서 고친 최종값 (사회 마감일을 직접 입력, 유형을 고름)
const finals = cards.map(c => ({ ...c }));
finals[3].due = '2026-10-30'; finals[3].type = '보고서';
const ready = finals.filter(c => c.due);

line('④ 몰림 경보');
const crunch = crunchWeeks(ready);
if (!crunch.length) console.log('몰리는 주가 없어요');
for (const [monday, list] of crunch) console.log(`⚠ ${label(monday)} 주에 ${list.length}개: ${list.map(c => c.subject).join(', ')} → 2주 전에 알리고 여유를 2배로`);
const crunchSet = new Set(crunch.flatMap(([, list]) => list));

line('③ 역산 플래너');
const STEP_MINUTES = { 수학: 140, 국어: 120, 영어: 80, 사회: 160 }; // 실제 앱에선 AI가 단계를 나누고 분을 정함
for (const c of [...ready].sort((a, b) => a.due.localeCompare(b.due))) { // 마감이 빠른 것부터
  const r = planBackward(c, STEP_MINUTES[c.subject], crunchSet.has(c));
  console.log(`${c.subject} (마감 ${label(c.due)}) → ${label(r.start)}부터 시작${r.tight ? '  ⚠ 빠듯해요' : ''}`);
  console.log('   ' + r.plan.map(([day, m]) => `${label(day)} ${m}분`).join(' · '));
}

line('⑤ 정확도 측정');
let fixed = 0;
cards.forEach((ai, i) => { const f = fixedFields(ai, finals[i]); fixed += f.length; if (f.length) console.log(`${ai.subject}: 학생이 고친 칸 → ${f.join(', ')}`); });
const total = cards.length * FIELDS.length;
console.log(`칸 정확도 ${total - fixed}/${total} = ${Math.round((total - fixed) / total * 100)}%`);

line('⑥ 내 속도 보정');
const logs = [{ planned: 30, actual: 36 }, { planned: 40, actual: 52 }, { planned: 20, actual: 22 }, { planned: 30, actual: 41 }];
const pace = paceFactor(logs);
console.log(`실제/계획 중앙값 ×${pace} → 다음 계획의 40분 단계는 ${Math.round(40 * pace / 10) * 10}분으로 잡아요`);
console.log('');
