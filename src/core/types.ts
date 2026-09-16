/* Eidos domain model. */

export type ISODate = string;      // 'YYYY-MM-DD'
export type ISODateTime = string;  // full ISO 8601

/* ---------------- Calendar (Apple Calendar parity) ---------------- */

export type CalendarKind = 'personal' | 'subscribed' | 'holiday' | 'edu' | 'group' | 'birthday';

export interface Calendar {
  id: string;
  title: string;
  color: string;       // accent token value
  kind: CalendarKind;
  visible: boolean;
  readOnly?: boolean;
  /** Group or class this calendar syncs from, if any. */
  sourceId?: string;
}

export type AlarmOffset =
  | 0 | 5 | 10 | 15 | 30 | 60 | 120 | 1440 | 2880 | 10080; // minutes before

export type Availability = 'busy' | 'free';

export interface Attendee {
  id: string;
  name: string;
  status: 'accepted' | 'declined' | 'tentative' | 'pending';
}

export type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

export interface Recurrence {
  freq: RecurrenceFreq;
  /** every N periods */
  interval: number;
  /** 0=Sun..6=Sat, for weekly/custom */
  byWeekday?: number[];
  /** day of month, for monthly */
  byMonthDay?: number;
  /** ISO date the rule stops, inclusive */
  until?: ISODate;
  /** or a count of occurrences */
  count?: number;
  /** occurrence dates removed by the user */
  exceptions?: ISODate[];
}

export interface EidosEvent {
  id: string;
  calendarId: string;
  title: string;
  notes?: string;
  location?: string;
  url?: string;
  /** Local wall-clock ISO. All-day events use the date portion only. */
  start: ISODateTime;
  end: ISODateTime;
  allDay: boolean;
  travelTimeMinutes?: number;
  alarms: AlarmOffset[];
  availability: Availability;
  recurrence?: Recurrence;
  attendees?: Attendee[];
  /** Set on a materialised occurrence of a recurring event. */
  seriesId?: string;
  occurrenceDate?: ISODate;
  /** Provenance — which feature created it. */
  origin?: 'user' | 'edu-timetable' | 'edu-assessment' | 'group' | 'cycle' | 'holiday';
  /** Shared item this mirrors. */
  sharedId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ReminderPriority = 'none' | 'low' | 'medium' | 'high';

export interface Reminder {
  id: string;
  calendarId: string;
  title: string;
  notes?: string;
  due?: ISODateTime;
  priority: ReminderPriority;
  done: boolean;
  createdAt: ISODateTime;
}

/* ---------------- Accounts, roles, consent ---------------- */

export type AccountType = 'personal' | 'edu';
export type EduRole = 'student' | 'parent' | 'teacher';

export interface SchoolRef {
  /** NEIS 시도교육청코드 */
  officeCode: string;
  /** NEIS 표준학교코드 */
  schoolCode: string;
  name: string;
  kind: '초등학교' | '중학교' | '고등학교';
  region: string;
}

export interface ClassRef {
  grade: number;
  classNo: number;
  /** Student number within the class. Teachers and parents leave this empty. */
  studentNo?: number;
}

/** Granular consent records. Each is stored with the version of the notice agreed to. */
export interface ConsentRecord {
  id: ConsentKey;
  granted: boolean;
  version: string;
  at: ISODateTime;
  /** For under-14 accounts: who gave it. */
  guardianName?: string;
  guardianContact?: string;
  method?: 'guardian-email' | 'guardian-in-person' | 'self';
}

export type ConsentKey =
  | 'terms'              // 서비스 이용약관 (필수)
  | 'privacy'            // 개인정보 수집·이용 (필수)
  | 'sensitive-allergy'  // 알레르기 = 건강정보, 민감정보 별도 동의 (선택)
  | 'class-share'        // 학급 공유 게시 (선택)
  | 'guardian'           // 만 14세 미만 법정대리인 동의 (조건부 필수)
  | 'ai-processing'      // 브리프·필터링을 위한 AI 처리 (선택)
  | 'marketing';         // 마케팅 수신 (선택)

export interface Profile {
  id: string;
  displayName: string;
  accountType: AccountType;
  birthDate?: ISODate;
  /** Derived, but stored so the consent gate is auditable. */
  isMinorUnder14?: boolean;
  edu?: {
    role: EduRole;
    school: SchoolRef;
    class?: ClassRef;
    /** Parents link to their child's class. */
    childName?: string;
    /** Teachers may hold several classes. */
    teachingClasses?: ClassRef[];
    allergyCodes: number[]; // NEIS allergy codes 1..19
  };
  consents: ConsentRecord[];
  /** Brief delivery windows, local wall-clock 'HH:MM'. */
  briefs: {
    morningAt: string;
    nightAt: string;
    /** Free-form questions Cycle answers in every brief. */
    morningQuestions: string[];
    nightQuestions: string[];
    newsTopics: string[];
  };
  location?: { name: string; lat: number; lon: number };
  createdAt: ISODateTime;
}

/* ---------------- Sharing: groups and class boards ---------------- */

export type ShareScope = 'class' | 'grade' | 'school' | 'group';

export type SharedKind =
  | 'assessment'   // 수행평가
  | 'exam'
  | 'homework'
  | 'notice'
  | 'event'
  | 'trip';

export type ModerationVerdict = 'approved' | 'flagged' | 'blocked';

export interface ModerationResult {
  verdict: ModerationVerdict;
  /** Rule ids that fired. */
  reasons: string[];
  /** 0..1 */
  score: number;
  message?: string;
  at: ISODateTime;
}

export interface SharedItem {
  id: string;
  kind: SharedKind;
  title: string;
  detail?: string;
  date: ISODate;
  time?: string;         // 'HH:MM'
  subject?: string;      // 과목
  scope: ShareScope;
  /** class/grade/group identifier this was posted to. */
  targetId: string;
  authorId: string;
  authorName: string;
  authorRole: EduRole | 'member';
  /** Teacher-posted items are authoritative; student posts are peer-sourced. */
  authoritative: boolean;
  moderation: ModerationResult;
  /** Peers confirming the item is accurate. */
  confirmations: string[];
  disputes: string[];
  createdAt: ISODateTime;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Invitation code others use to join. */
  inviteCode: string;
  members: GroupMember[];
  /** Every member's calendar merges into the group calendar. */
  calendarId: string;
  createdAt: ISODateTime;
}

export interface GroupMember {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  /** Sharing granularity, per Apple's free/busy model. */
  shares: 'details' | 'busy-only';
  joinedAt: ISODateTime;
}

/* ---------------- Briefs ---------------- */

export interface WeatherNow {
  tempC: number;
  feelsLikeC: number;
  code: number;
  summary: string;
  highC: number;
  lowC: number;
  precipitationChance: number;
  windKph: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  hourly: { hour: number; tempC: number; precip: number; code: number }[];
  /** e.g. 'AQI 42 — 좋음' */
  airQuality?: { index: number; label: string };
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  category: string;
  url?: string;
  summary?: string;
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface JournalEntry {
  date: ISODate;
  mood?: Mood;
  energy?: Mood;
  /** The user's own words. */
  note?: string;
  /** Cycle's reflection on the day. */
  comment?: string;
  /** Completed vs planned, captured at close of day. */
  completed: string[];
  missed: string[];
  gratitude?: string;
  createdAt: ISODateTime;
}

export interface BriefCard {
  id: string;
  kind:
    | 'greeting' | 'schedule' | 'weather' | 'news' | 'meal' | 'timetable'
    | 'answer' | 'focus' | 'commute' | 'review' | 'mood' | 'journal'
    | 'tomorrow' | 'streak';
  title: string;
  body?: string;
  data?: unknown;
}

export interface Brief {
  id: string;
  type: 'morning' | 'night';
  date: ISODate;
  generatedAt: ISODateTime;
  headline: string;
  cards: BriefCard[];
}

/* ---------------- Edu data ---------------- */

export interface MealAllergen {
  code: number;
  label: string;
}

export interface MealDish {
  name: string;
  allergens: number[];
}

export interface Meal {
  date: ISODate;
  type: '조식' | '중식' | '석식';
  dishes: MealDish[];
  calories?: number;
  nutrients?: Record<string, string>;
  origin?: Record<string, string>;
}

export interface TimetablePeriod {
  period: number;
  subject: string;
  teacher?: string;
  room?: string;
  start: string; // 'HH:MM'
  end: string;
}

export interface Timetable {
  date: ISODate;
  grade: number;
  classNo: number;
  periods: TimetablePeriod[];
}

/* ---------------- Cycle (the assistant) ---------------- */

export interface CycleMessage {
  id: string;
  role: 'user' | 'cycle';
  text: string;
  at: ISODateTime;
  /** Structured proposals Cycle attaches to a reply. */
  actions?: CycleAction[];
  /** Set while streaming / thinking. */
  pending?: boolean;
}

export type CycleAction =
  | { type: 'create-event'; draft: Partial<EidosEvent>; label: string }
  | { type: 'create-reminder'; draft: Partial<Reminder>; label: string }
  | { type: 'find-slot'; durationMinutes: number; within: ISODate[]; label: string }
  | { type: 'open'; view: string; label: string };

/* ---------------- App state ---------------- */

export type ViewMode = 'day' | 'week' | 'month' | 'year' | 'list';
export type Tab = 'calendar' | 'brief' | 'edu' | 'groups' | 'cycle';

export interface AppState {
  profile: Profile | null;
  calendars: Calendar[];
  events: EidosEvent[];
  reminders: Reminder[];
  groups: Group[];
  shared: SharedItem[];
  journal: JournalEntry[];
  briefs: Brief[];
  cycleThread: CycleMessage[];
  ui: {
    tab: Tab;
    view: ViewMode;
    focusedDate: ISODate;
    selectedEventId: string | null;
    editorOpen: boolean;
    editorDraft: Partial<EidosEvent> | null;
    search: string;
    theme: 'system' | 'light' | 'dark';
    weekStartsOn: 0 | 1;
  };
}
