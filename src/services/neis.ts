import { addDays, fromISODate, toISODate, weekdayOf } from '../core/date.ts';
import { env } from '../core/env.ts';
import type { ISODate, Meal, MealAllergen, SchoolRef, Timetable } from '../core/types.ts';

/**
 * School meals and timetables.
 *
 * Shaped around Korea's NEIS open API (open.neis.go.kr): `mealServiceDietInfo`
 * and the three `*TimetableInfo` endpoints, keyed by 시도교육청코드 +
 * 표준학교코드. Set VITE_NEIS_KEY and the live endpoints are used; with no key
 * the same shapes are produced locally so every screen works offline.
 */

const BASE = env('VITE_NEIS_API_BASE', 'https://open.neis.go.kr/hub');
const KEY = env('VITE_NEIS_KEY');

/** NEIS allergen codes. These are the legally-published 19 ingredients. */
export const ALLERGENS: MealAllergen[] = [
  { code: 1, label: '난류' }, { code: 2, label: '우유' }, { code: 3, label: '메밀' },
  { code: 4, label: '땅콩' }, { code: 5, label: '대두' }, { code: 6, label: '밀' },
  { code: 7, label: '고등어' }, { code: 8, label: '게' }, { code: 9, label: '새우' },
  { code: 10, label: '돼지고기' }, { code: 11, label: '복숭아' }, { code: 12, label: '토마토' },
  { code: 13, label: '아황산류' }, { code: 14, label: '호두' }, { code: 15, label: '닭고기' },
  { code: 16, label: '쇠고기' }, { code: 17, label: '오징어' }, { code: 18, label: '조개류' },
  { code: 19, label: '잣' },
];

export function allergenLabel(code: number): string {
  return ALLERGENS.find((a) => a.code === code)?.label ?? `${code}`;
}

/* ---------------- School search ---------------- */

const SAMPLE_SCHOOLS: SchoolRef[] = [
  { officeCode: 'B10', schoolCode: '7010084', name: '서울대학교사범대학부설고등학교', kind: '고등학교', region: '서울특별시' },
  { officeCode: 'B10', schoolCode: '7010179', name: '경기고등학교', kind: '고등학교', region: '서울특별시' },
  { officeCode: 'B10', schoolCode: '7010569', name: '신목중학교', kind: '중학교', region: '서울특별시' },
  { officeCode: 'B10', schoolCode: '7011569', name: '양천초등학교', kind: '초등학교', region: '서울특별시' },
  { officeCode: 'J10', schoolCode: '7530575', name: '분당중학교', kind: '중학교', region: '경기도' },
  { officeCode: 'J10', schoolCode: '7530072', name: '수원고등학교', kind: '고등학교', region: '경기도' },
  { officeCode: 'C10', schoolCode: '7150658', name: '부산진고등학교', kind: '고등학교', region: '부산광역시' },
  { officeCode: 'D10', schoolCode: '7240037', name: '대구여자고등학교', kind: '고등학교', region: '대구광역시' },
  { officeCode: 'E10', schoolCode: '7310026', name: '인천세일고등학교', kind: '고등학교', region: '인천광역시' },
  { officeCode: 'F10', schoolCode: '7380045', name: '광주제일고등학교', kind: '고등학교', region: '광주광역시' },
];

export async function searchSchools(query: string): Promise<SchoolRef[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (KEY) {
    try {
      const url = `${BASE}/schoolInfo?KEY=${KEY}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const rows = json?.schoolInfo?.[1]?.row ?? [];
        if (rows.length) {
          return rows.map((r: Record<string, string>) => ({
            officeCode: r.ATPT_OFCDC_SC_CODE,
            schoolCode: r.SD_SCHUL_CODE,
            name: r.SCHUL_NM,
            kind: (r.SCHUL_KND_SC_NM ?? '고등학교') as SchoolRef['kind'],
            region: r.LCTN_SC_NM ?? '',
          }));
        }
      }
    } catch {
      /* fall through to the bundled list */
    }
  }

  return SAMPLE_SCHOOLS.filter((s) => s.name.includes(q) || s.region.includes(q));
}

/* ---------------- Meals ---------------- */

export async function fetchMeals(school: SchoolRef, date: ISODate): Promise<Meal[]> {
  if (KEY) {
    try {
      const ymd = date.replace(/-/g, '');
      const url =
        `${BASE}/mealServiceDietInfo?KEY=${KEY}&Type=json&pIndex=1&pSize=10` +
        `&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}&MLSV_YMD=${ymd}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const rows = json?.mealServiceDietInfo?.[1]?.row ?? [];
        if (rows.length) return rows.map((r: Record<string, string>) => parseNeisMeal(r, date));
      }
    } catch {
      /* fall through */
    }
  }
  return localMeals(school, date);
}

/** NEIS returns dishes as `<br/>`-joined strings with trailing allergen digits. */
function parseNeisMeal(row: Record<string, string>, date: ISODate): Meal {
  const dishes = (row.DDISH_NM ?? '')
    .split(/<br\s*\/?>/i)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/\(([\d.\s]+)\)\s*$/);
      const allergens = match
        ? match[1].split('.').map((n) => Number(n.trim())).filter((n) => n >= 1 && n <= 19)
        : [];
      return { name: raw.replace(/\(([\d.\s]+)\)\s*$/, '').trim(), allergens };
    });

  return {
    date,
    type: (row.MMEAL_SC_NM ?? '중식') as Meal['type'],
    dishes,
    calories: Number((row.CAL_INFO ?? '').replace(/[^\d.]/g, '')) || undefined,
    nutrients: parseKeyed(row.NTR_INFO),
    origin: parseKeyed(row.ORPLC_INFO),
  };
}

function parseKeyed(s?: string): Record<string, string> | undefined {
  if (!s) return undefined;
  const out: Record<string, string> = {};
  for (const line of s.split(/<br\s*\/?>/i)) {
    const [k, v] = line.split(':').map((x) => x?.trim());
    if (k && v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/* Local menu generator. Deterministic per school+date so the same day always
   shows the same meal — a menu that reshuffles on reload is useless. */
const RICE = ['백미밥', '흑미밥', '콩나물밥', '보리밥', '기장밥', '카레라이스'];
const SOUP = ['된장국', '미역국', '김치찌개', '북엇국', '떡국', '순두부찌개', '유부장국'];
const MAIN: [string, number[]][] = [
  ['제육볶음', [5, 6, 10]], ['치킨가스', [1, 2, 5, 6, 15]], ['고등어구이', [7]],
  ['불고기', [5, 6, 16]], ['돈까스', [1, 2, 5, 6, 10]], ['닭갈비', [5, 6, 15]],
  ['오징어볶음', [5, 6, 17]], ['새우튀김', [1, 5, 6, 9]], ['갈치조림', [5, 6]],
];
const SIDE: [string, number[]][] = [
  ['시금치나물', [5, 6]], ['콩나물무침', [5, 6]], ['감자조림', [5, 6]],
  ['계란찜', [1, 2]], ['어묵볶음', [1, 5, 6, 18]], ['잡채', [1, 5, 6, 16]],
  ['깍두기', []], ['배추김치', []],
];
const DESSERT: [string, number[]][] = [
  ['요구르트', [2]], ['바나나', []], ['방울토마토', [12]], ['수박', []],
  ['초코머핀', [1, 2, 6]], ['식혜', []],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function localMeals(school: SchoolRef, date: ISODate): Meal[] {
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) return []; // no school meal at weekends
  const seed = hash(`${school.schoolCode}:${date}`);
  const pick = <T,>(arr: T[], salt: number): T => arr[(seed + salt * 7919) % arr.length];

  const [main, mainA] = pick(MAIN, 1);
  const [side1, side1A] = pick(SIDE, 2);
  const [side2, side2A] = pick(SIDE, 5);
  const [dessert, dessertA] = pick(DESSERT, 3);

  const lunch: Meal = {
    date,
    type: '중식',
    dishes: [
      { name: pick(RICE, 0), allergens: [] },
      { name: pick(SOUP, 4), allergens: [5, 6] },
      { name: main, allergens: mainA },
      { name: side1, allergens: side1A },
      { name: side2 === side1 ? '배추김치' : side2, allergens: side2 === side1 ? [] : side2A },
      { name: dessert, allergens: dessertA },
    ],
    calories: 780 + (seed % 180),
    nutrients: {
      탄수화물: `${105 + (seed % 25)}g`,
      단백질: `${28 + (seed % 12)}g`,
      지방: `${22 + (seed % 9)}g`,
      나트륨: `${900 + (seed % 400)}mg`,
    },
    origin: { 쌀: '국내산', 김치: '국내산', 돼지고기: '국내산', 쇠고기: '국내산(한우)' },
  };

  // Middle and high schools commonly serve dinner; elementary does not.
  if (school.kind === '초등학교') return [lunch];
  const [dMain, dMainA] = pick(MAIN, 11);
  return [
    lunch,
    {
      date,
      type: '석식',
      dishes: [
        { name: pick(RICE, 12), allergens: [] },
        { name: pick(SOUP, 13), allergens: [5, 6] },
        { name: dMain, allergens: dMainA },
        { name: '배추김치', allergens: [] },
      ],
      calories: 690 + (seed % 120),
    },
  ];
}

/** Dishes in a meal that contain any of the user's declared allergens. */
export function allergyHits(meal: Meal, codes: number[]): { dish: string; hits: number[] }[] {
  if (!codes.length) return [];
  const set = new Set(codes);
  return meal.dishes
    .map((d) => ({ dish: d.name, hits: d.allergens.filter((a) => set.has(a)) }))
    .filter((d) => d.hits.length > 0);
}

/* ---------------- Timetable ---------------- */

const PERIOD_TIMES: [string, string][] = [
  ['08:40', '09:30'], ['09:40', '10:30'], ['10:40', '11:30'], ['11:40', '12:30'],
  ['13:30', '14:20'], ['14:30', '15:20'], ['15:30', '16:20'],
];

const SUBJECTS_BY_KIND: Record<SchoolRef['kind'], string[]> = {
  초등학교: ['국어', '수학', '사회', '과학', '영어', '체육', '음악', '미술', '창체'],
  중학교: ['국어', '수학', '영어', '과학', '사회', '역사', '체육', '음악', '미술', '기술가정', '정보', '도덕'],
  고등학교: ['국어', '수학', '영어', '한국사', '통합사회', '통합과학', '물리', '화학', '생명과학', '체육', '음악', '미술', '정보'],
};

export async function fetchTimetable(
  school: SchoolRef,
  grade: number,
  classNo: number,
  date: ISODate,
): Promise<Timetable> {
  if (KEY) {
    const endpoint =
      school.kind === '초등학교' ? 'elsTimetable'
      : school.kind === '중학교' ? 'misTimetable'
      : 'hisTimetable';
    try {
      const ymd = date.replace(/-/g, '');
      const url =
        `${BASE}/${endpoint}?KEY=${KEY}&Type=json&pIndex=1&pSize=20` +
        `&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}` +
        `&ALL_TI_YMD=${ymd}&GRADE=${grade}&CLASS_NM=${classNo}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const rows = json?.[endpoint]?.[1]?.row ?? [];
        if (rows.length) {
          return {
            date, grade, classNo,
            periods: rows.map((r: Record<string, string>) => {
              const p = Number(r.PERIO) || 1;
              const [start, end] = PERIOD_TIMES[Math.min(p - 1, PERIOD_TIMES.length - 1)];
              return { period: p, subject: r.ITRT_CNTNT ?? '', start, end };
            }),
          };
        }
      }
    } catch {
      /* fall through */
    }
  }
  return localTimetable(school, grade, classNo, date);
}

function localTimetable(school: SchoolRef, grade: number, classNo: number, date: ISODate): Timetable {
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) return { date, grade, classNo, periods: [] };

  const subjects = SUBJECTS_BY_KIND[school.kind];
  const count = school.kind === '초등학교' ? (wd === 3 ? 4 : 5) : school.kind === '중학교' ? 6 : 7;
  // Seed on the *week*, not the day, so a class's timetable is stable Mon–Fri
  // and repeats sensibly week to week — the way a real timetable behaves.
  const weekSeed = hash(`${school.schoolCode}:${grade}:${classNo}:${isoWeek(date)}`);

  const periods = Array.from({ length: count }, (_, i) => {
    const idx = (weekSeed + wd * 31 + i * 17) % subjects.length;
    const [start, end] = PERIOD_TIMES[i];
    return {
      period: i + 1,
      subject: subjects[idx],
      room: i >= 4 && school.kind !== '초등학교' ? `${subjects[idx]}실` : `${grade}-${classNo}`,
      start,
      end,
    };
  });

  return { date, grade, classNo, periods };
}

function isoWeek(date: ISODate): string {
  const d = fromISODate(date);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${thursday.getFullYear()}W${week}`;
}

/** The whole school week containing `date` — what the timetable screen renders. */
export async function fetchWeekTimetable(
  school: SchoolRef, grade: number, classNo: number, date: ISODate,
): Promise<Timetable[]> {
  const monday = toISODate(
    (() => {
      const d = fromISODate(date);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d;
    })(),
  );
  return Promise.all(
    Array.from({ length: 5 }, (_, i) => fetchTimetable(school, grade, classNo, addDays(monday, i))),
  );
}
