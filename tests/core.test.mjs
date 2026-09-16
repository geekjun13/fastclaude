import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, addMonths, monthGrid, startOfWeek, diffDays, formatDuration } from '../src/core/date.ts';
import { expandRecurrence, occurrencesInRange, layoutDay, freeSlots } from '../src/core/recurrence.ts';
import { parseDate, parseTime, parseDuration, parseRecurrence, extractTitle, classify } from '../src/services/cycle.ts';
import { prefilter } from '../src/services/moderation.ts';
import { allergyHits } from '../src/services/neis.ts';

/* ---------------- date ---------------- */

test('addMonths clamps to the end of a short month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29'); // leap year
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
});

test('monthGrid is always 42 cells and starts on the week boundary', () => {
  const grid = monthGrid('2026-09-16', 0);
  assert.equal(grid.length, 42);
  assert.equal(grid[0], startOfWeek('2026-09-01', 0));
  assert.equal(diffDays(grid[0], grid[41]), 41);
});

test('week start honours the Monday setting', () => {
  assert.equal(startOfWeek('2026-09-16', 0), '2026-09-13'); // Sunday
  assert.equal(startOfWeek('2026-09-16', 1), '2026-09-14'); // Monday
});

test('formatDuration reads naturally', () => {
  assert.equal(formatDuration(45), '45분');
  assert.equal(formatDuration(60), '1시간');
  assert.equal(formatDuration(150), '2시간 30분');
});

/* ---------------- recurrence ---------------- */

test('weekly rule emits only the selected weekdays', () => {
  const dates = expandRecurrence(
    '2026-09-14', // Monday
    { freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] },
    '2026-09-14',
    '2026-09-27',
  );
  assert.deepEqual(dates, [
    '2026-09-14', '2026-09-16', '2026-09-18',
    '2026-09-21', '2026-09-23', '2026-09-25',
  ]);
});

test('count limits the series and exceptions remove single occurrences', () => {
  const counted = expandRecurrence(
    '2026-09-14', { freq: 'daily', interval: 1, count: 3 }, '2026-09-14', '2026-12-31',
  );
  assert.equal(counted.length, 3);

  const withHole = expandRecurrence(
    '2026-09-14',
    { freq: 'daily', interval: 1, exceptions: ['2026-09-15'] },
    '2026-09-14', '2026-09-17',
  );
  assert.deepEqual(withHole, ['2026-09-14', '2026-09-16', '2026-09-17']);
});

test('monthly rule skips months too short for the target day', () => {
  const dates = expandRecurrence(
    '2026-01-31', { freq: 'monthly', interval: 1 }, '2026-01-01', '2026-04-30',
  );
  assert.deepEqual(dates, ['2026-01-31', '2026-03-31']); // no February
});

test('until is inclusive and caps the series', () => {
  const dates = expandRecurrence(
    '2026-09-14', { freq: 'daily', interval: 1, until: '2026-09-16' }, '2026-09-01', '2026-12-31',
  );
  assert.deepEqual(dates, ['2026-09-14', '2026-09-15', '2026-09-16']);
});

const base = {
  calendarId: 'c', allDay: false, alarms: [], availability: 'busy',
  createdAt: '', updatedAt: '',
};

test('a multi-day event is found by a window that only covers its middle', () => {
  const ev = { ...base, id: 'a', title: '출장', start: '2026-09-10', end: '2026-09-20', allDay: true };
  const occ = occurrencesInRange([ev], '2026-09-14', '2026-09-15');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].title, '출장');
});

test('recurring occurrences carry seriesId and the shifted times', () => {
  const ev = {
    ...base, id: 'a', title: '스탠드업',
    start: '2026-09-14T09:30:00', end: '2026-09-14T09:45:00',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [1] },
  };
  const occ = occurrencesInRange([ev], '2026-09-21', '2026-09-21');
  assert.equal(occ.length, 1);
  assert.equal(occ[0].start, '2026-09-21T09:30:00');
  assert.equal(occ[0].seriesId, 'a');
  assert.notEqual(occ[0].id, 'a'); // an occurrence is addressable on its own
});

test('overlapping events pack into the fewest columns', () => {
  const mk = (id, s, e) => ({ ...base, id, title: id, start: `2026-09-16T${s}:00`, end: `2026-09-16T${e}:00` });
  const laid = layoutDay([mk('a', '09:00', '10:00'), mk('b', '09:30', '10:30'), mk('c', '11:00', '12:00')]);
  const byId = Object.fromEntries(laid.map((l) => [l.event.id, l]));
  assert.equal(byId.a.columns, 2);
  assert.notEqual(byId.a.column, byId.b.column);
  assert.equal(byId.c.columns, 1); // a separate cluster, full width
});

test('freeSlots subtracts travel time from the front of a booking', () => {
  const ev = {
    ...base, id: 'a', title: '검진',
    start: '2026-09-16T15:00:00', end: '2026-09-16T16:00:00', travelTimeMinutes: 30,
  };
  const slots = freeSlots([ev], '2026-09-16', 60, 8 * 60, 22 * 60);
  assert.equal(slots[0].end, 14 * 60 + 30); // free until 14:30, not 15:00
});

/* ---------------- Cycle parsing ---------------- */

test('relative day words resolve against the base date', () => {
  assert.equal(parseDate('내일 3시 치과', '2026-09-16'), '2026-09-17');
  assert.equal(parseDate('모레 회의', '2026-09-16'), '2026-09-18');
  assert.equal(parseDate('어제 뭐 했지', '2026-09-16'), '2026-09-15');
});

test('a bare weekday means the next one, not today', () => {
  // 2026-09-16 is a Wednesday.
  assert.equal(parseDate('금요일 점심', '2026-09-16'), '2026-09-18');
  assert.equal(parseDate('수요일 회의', '2026-09-16'), '2026-09-23');
  assert.equal(parseDate('이번 주 수요일', '2026-09-16'), '2026-09-16');
  assert.equal(parseDate('다음 주 월요일', '2026-09-16'), '2026-09-21');
});

test('a month/day already past rolls to next year', () => {
  assert.equal(parseDate('3월 14일 기념일', '2026-09-16'), '2027-03-14');
  assert.equal(parseDate('12월 25일', '2026-09-16'), '2026-12-25');
});

test('bare afternoon hours are read as PM, explicit markers win', () => {
  assert.equal(parseTime('3시에 치과'), '15:00');
  assert.equal(parseTime('오전 3시'), '03:00');
  assert.equal(parseTime('9시 스탠드업'), '09:00');   // 9 is unambiguous morning
  assert.equal(parseTime('오후 9시'), '21:00');
  assert.equal(parseTime('3시 반'), '15:30');
  assert.equal(parseTime('14:30 회의'), '14:30');
  assert.equal(parseTime('점심 약속'), '12:00');
});

test('duration and recurrence are read out of the same sentence', () => {
  assert.equal(parseDuration('2시간 30분 회의'), 150);
  assert.equal(parseDuration('90분 수업'), 90);
  assert.deepEqual(parseRecurrence('매주 월요일 회의'), { freq: 'weekly', interval: 1, byWeekday: [1] });
  assert.deepEqual(parseRecurrence('매일 운동'), { freq: 'daily', interval: 1 });
  assert.equal(parseRecurrence('내일 회의'), null);
});

test('the title is what survives after the scheduling words are stripped', () => {
  assert.equal(extractTitle('내일 오후 3시에 치과 예약 추가해줘'), '치과 예약');
  assert.equal(extractTitle('매주 월요일 9시 팀 스탠드업'), '팀 스탠드업');
});

test('intent classification separates asking from scheduling', () => {
  assert.equal(classify('오늘 뭐 있어?'), 'query-day');
  assert.equal(classify('이번 주에 2시간 언제 비어?'), 'find-slot');
  assert.equal(classify('다음 일정 뭐야'), 'query-next');
  assert.equal(classify('내일 3시 치과 잡아줘'), 'create');
  assert.equal(classify('내일 3시 치과'), 'create'); // no verb, but date + time
  assert.equal(classify('요즘 좀 지치네'), 'chat');
});

/* ---------------- moderation ---------------- */

const post = (title, extra = {}) => ({ title, kind: 'assessment', authorRole: 'student', ...extra });

test('ordinary school posts pass', () => {
  const r = prefilter(post('수학 수행평가 — 3단원 문제풀이, 계산기 지참'));
  assert.equal(r.verdict, 'approved');
});

test('abuse is blocked, not merely flagged', () => {
  assert.equal(prefilter(post('야 병신아 숙제 뭐냐')).verdict, 'blocked');
});

test('personal data is blocked', () => {
  const r = prefilter(post('과제 조모임', { detail: '연락처 010-1234-5678로 주세요' }));
  assert.equal(r.verdict, 'blocked');
  assert.ok(r.reasons.includes('privacy'));
});

test('off-topic hangouts are flagged for review, not silently dropped', () => {
  const r = prefilter(post('오늘 야자 빼고 PC방 갈 사람'));
  assert.equal(r.verdict, 'flagged');
  assert.ok(r.reasons.includes('off-topic-play'));
  assert.ok(r.message);
});

test('exam-integrity and substance posts are blocked', () => {
  assert.equal(prefilter(post('기말 시험지 유출 있음')).verdict, 'blocked');
  assert.equal(prefilter(post('끝나고 술자리 ㄱㄱ')).verdict, 'blocked');
});

test("a teacher's notice is not second-guessed by flag-level heuristics", () => {
  const flagged = prefilter(post('체험학습 관련 외부 링크 안내', { detail: 'https://example.com/form' }));
  assert.equal(flagged.verdict, 'flagged');
  const byTeacher = prefilter(
    post('체험학습 관련 외부 링크 안내', { detail: 'https://example.com/form', authorRole: 'teacher' }),
  );
  assert.equal(byTeacher.verdict, 'approved');
});

test('a teacher cannot post abuse either — blocks are absolute', () => {
  assert.equal(prefilter(post('이 병신같은 반', { authorRole: 'teacher' })).verdict, 'blocked');
});

/* ---------------- allergies ---------------- */

test('allergy matching reports the dish and which allergen hit', () => {
  const meal = {
    date: '2026-09-16', type: '중식',
    dishes: [
      { name: '백미밥', allergens: [] },
      { name: '돈까스', allergens: [1, 2, 5, 6, 10] },
      { name: '요구르트', allergens: [2] },
    ],
  };
  const hits = allergyHits(meal, [2]); // 우유
  assert.equal(hits.length, 2);
  assert.deepEqual(hits.map((h) => h.dish), ['돈까스', '요구르트']);
  assert.equal(allergyHits(meal, []).length, 0);
  assert.equal(allergyHits(meal, [4]).length, 0); // 땅콩 — none today
});

test('a duration is not mistaken for a clock time when stripping the title', () => {
  // "1시간" must be consumed whole; matching its "1시" leaves a stray "간".
  assert.equal(extractTitle('내일 오후 3시 치과 1시간'), '치과');
  assert.equal(extractTitle('금요일 2시간 30분 워크숍'), '워크숍');
  assert.equal(extractTitle('9시 스탠드업 15분'), '스탠드업');
});
