import {
  createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode,
} from 'react';
import { initialState } from './seed.ts';
import { loadState, saveState, uid } from './storage.ts';
import type {
  AppState, Brief, Calendar, CycleMessage, EidosEvent, Group, GroupMember, ISODate,
  JournalEntry, Profile, Reminder, SharedItem, Tab, ViewMode,
} from './types.ts';

export type Action =
  /* ui */
  | { type: 'ui/tab'; tab: Tab }
  | { type: 'ui/view'; view: ViewMode }
  | { type: 'ui/focus'; date: ISODate }
  | { type: 'ui/select'; id: string | null }
  | { type: 'ui/search'; q: string }
  | { type: 'ui/theme'; theme: 'system' | 'light' | 'dark' }
  | { type: 'ui/weekStart'; day: 0 | 1 }
  | { type: 'ui/editor'; open: boolean; draft?: Partial<EidosEvent> | null }
  /* profile */
  | { type: 'profile/set'; profile: Profile }
  | { type: 'profile/patch'; patch: Partial<Profile> }
  /* calendars */
  | { type: 'cal/add'; calendar: Calendar }
  | { type: 'cal/patch'; id: string; patch: Partial<Calendar> }
  | { type: 'cal/remove'; id: string }
  | { type: 'cal/toggle'; id: string }
  /* events */
  | { type: 'event/add'; event: EidosEvent }
  | { type: 'event/patch'; id: string; patch: Partial<EidosEvent> }
  | { type: 'event/remove'; id: string }
  /** Deleting one occurrence of a series records an exception instead. */
  | { type: 'event/removeOccurrence'; seriesId: string; date: ISODate }
  /* reminders */
  | { type: 'reminder/add'; reminder: Reminder }
  | { type: 'reminder/patch'; id: string; patch: Partial<Reminder> }
  | { type: 'reminder/remove'; id: string }
  | { type: 'reminder/toggle'; id: string }
  /* groups */
  | { type: 'group/add'; group: Group }
  | { type: 'group/patch'; id: string; patch: Partial<Group> }
  | { type: 'group/remove'; id: string }
  | { type: 'group/addMember'; id: string; member: GroupMember }
  | { type: 'group/removeMember'; id: string; memberId: string }
  /* shared items (edu class board + groups) */
  | { type: 'shared/add'; item: SharedItem }
  | { type: 'shared/patch'; id: string; patch: Partial<SharedItem> }
  | { type: 'shared/remove'; id: string }
  | { type: 'shared/confirm'; id: string; userId: string }
  | { type: 'shared/dispute'; id: string; userId: string }
  /* journal + briefs */
  | { type: 'journal/upsert'; entry: JournalEntry }
  | { type: 'brief/save'; brief: Brief }
  /* cycle */
  | { type: 'cycle/append'; message: CycleMessage }
  | { type: 'cycle/patch'; id: string; patch: Partial<CycleMessage> }
  | { type: 'cycle/clear' }
  /* meta */
  | { type: 'state/reset' }
  | { type: 'state/hydrate'; state: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    /* ---------------- ui ---------------- */
    case 'ui/tab': return { ...state, ui: { ...state.ui, tab: action.tab } };
    case 'ui/view': return { ...state, ui: { ...state.ui, view: action.view } };
    case 'ui/focus': return { ...state, ui: { ...state.ui, focusedDate: action.date } };
    case 'ui/select': return { ...state, ui: { ...state.ui, selectedEventId: action.id } };
    case 'ui/search': return { ...state, ui: { ...state.ui, search: action.q } };
    case 'ui/theme': return { ...state, ui: { ...state.ui, theme: action.theme } };
    case 'ui/weekStart': return { ...state, ui: { ...state.ui, weekStartsOn: action.day } };
    case 'ui/editor':
      return {
        ...state,
        ui: {
          ...state.ui,
          editorOpen: action.open,
          editorDraft: action.open ? (action.draft ?? null) : null,
        },
      };

    /* ---------------- profile ---------------- */
    case 'profile/set': return { ...state, profile: action.profile };
    case 'profile/patch':
      return state.profile
        ? { ...state, profile: { ...state.profile, ...action.patch } }
        : state;

    /* ---------------- calendars ---------------- */
    case 'cal/add': return { ...state, calendars: [...state.calendars, action.calendar] };
    case 'cal/patch':
      return {
        ...state,
        calendars: state.calendars.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case 'cal/remove':
      return {
        ...state,
        calendars: state.calendars.filter((c) => c.id !== action.id),
        // Removing a calendar removes what it held; Apple Calendar does the same.
        events: state.events.filter((e) => e.calendarId !== action.id),
        reminders: state.reminders.filter((r) => r.calendarId !== action.id),
      };
    case 'cal/toggle':
      return {
        ...state,
        calendars: state.calendars.map((c) =>
          c.id === action.id ? { ...c, visible: !c.visible } : c,
        ),
      };

    /* ---------------- events ---------------- */
    case 'event/add': return { ...state, events: [...state.events, action.event] };
    case 'event/patch':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? { ...e, ...action.patch, updatedAt: new Date().toISOString() }
            : e,
        ),
      };
    case 'event/remove':
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    case 'event/removeOccurrence':
      return {
        ...state,
        events: state.events.map((e) => {
          if (e.id !== action.seriesId || !e.recurrence) return e;
          const exceptions = [...(e.recurrence.exceptions ?? []), action.date];
          return {
            ...e,
            recurrence: { ...e.recurrence, exceptions },
            updatedAt: new Date().toISOString(),
          };
        }),
      };

    /* ---------------- reminders ---------------- */
    case 'reminder/add': return { ...state, reminders: [...state.reminders, action.reminder] };
    case 'reminder/patch':
      return {
        ...state,
        reminders: state.reminders.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case 'reminder/remove':
      return { ...state, reminders: state.reminders.filter((r) => r.id !== action.id) };
    case 'reminder/toggle':
      return {
        ...state,
        reminders: state.reminders.map((r) => (r.id === action.id ? { ...r, done: !r.done } : r)),
      };

    /* ---------------- groups ---------------- */
    case 'group/add':
      return {
        ...state,
        groups: [...state.groups, action.group],
        calendars: [
          ...state.calendars,
          {
            id: action.group.calendarId,
            title: action.group.name,
            color: action.group.color,
            kind: 'group',
            visible: true,
            sourceId: action.group.id,
          },
        ],
      };
    case 'group/patch':
      return {
        ...state,
        groups: state.groups.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      };
    case 'group/remove': {
      const group = state.groups.find((g) => g.id === action.id);
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== action.id),
        calendars: state.calendars.filter((c) => c.id !== group?.calendarId),
        events: state.events.filter((e) => e.calendarId !== group?.calendarId),
      };
    }
    case 'group/addMember':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, members: [...g.members, action.member] } : g,
        ),
      };
    case 'group/removeMember':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id
            ? { ...g, members: g.members.filter((m) => m.id !== action.memberId) }
            : g,
        ),
      };

    /* ---------------- shared ---------------- */
    case 'shared/add': return { ...state, shared: [action.item, ...state.shared] };
    case 'shared/patch':
      return {
        ...state,
        shared: state.shared.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'shared/remove':
      return {
        ...state,
        shared: state.shared.filter((s) => s.id !== action.id),
        events: state.events.filter((e) => e.sharedId !== action.id),
      };
    case 'shared/confirm':
      return {
        ...state,
        shared: state.shared.map((s) =>
          s.id === action.id
            ? {
                ...s,
                confirmations: s.confirmations.includes(action.userId)
                  ? s.confirmations
                  : [...s.confirmations, action.userId],
                disputes: s.disputes.filter((d) => d !== action.userId),
              }
            : s,
        ),
      };
    case 'shared/dispute':
      return {
        ...state,
        shared: state.shared.map((s) =>
          s.id === action.id
            ? {
                ...s,
                disputes: s.disputes.includes(action.userId)
                  ? s.disputes
                  : [...s.disputes, action.userId],
                confirmations: s.confirmations.filter((c) => c !== action.userId),
              }
            : s,
        ),
      };

    /* ---------------- journal + briefs ---------------- */
    case 'journal/upsert': {
      const exists = state.journal.some((j) => j.date === action.entry.date);
      return {
        ...state,
        journal: exists
          ? state.journal.map((j) =>
              j.date === action.entry.date ? { ...j, ...action.entry } : j,
            )
          : [action.entry, ...state.journal],
      };
    }
    case 'brief/save': {
      const rest = state.briefs.filter(
        (b) => !(b.date === action.brief.date && b.type === action.brief.type),
      );
      // Keep a fortnight of briefs; older ones are recoverable from the journal.
      return { ...state, briefs: [action.brief, ...rest].slice(0, 28) };
    }

    /* ---------------- cycle ---------------- */
    case 'cycle/append': return { ...state, cycleThread: [...state.cycleThread, action.message] };
    case 'cycle/patch':
      return {
        ...state,
        cycleThread: state.cycleThread.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      };
    case 'cycle/clear': return { ...state, cycleThread: [] };

    /* ---------------- meta ---------------- */
    case 'state/reset': return initialState();
    case 'state/hydrate':
      return {
        ...state,
        ...action.state,
        ui: { ...state.ui, ...(action.state.ui ?? {}) },
      };

    default: return state;
  }
}

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const base = initialState();
    const saved = loadState();
    if (!saved) return base;
    return {
      ...base,
      ...saved,
      ui: { ...base.ui, ...(saved.ui ?? {}) },
    };
  });

  // Persist, debounced — writing on every keystroke in the editor is wasteful.
  useEffect(() => {
    const t = setTimeout(() => saveState(state), 250);
    return () => clearTimeout(t);
  }, [state]);

  // Theme is applied to the root so the token file can respond to it.
  useEffect(() => {
    const root = document.documentElement;
    if (state.ui.theme === 'system') root.removeAttribute('data-theme');
    else root.dataset.theme = state.ui.theme;
  }, [state.ui.theme]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export const useAppState = () => useStore().state;
export const useDispatch = () => useStore().dispatch;

/* ---------------- Action creators for the common flows ---------------- */

export function newEvent(partial: Partial<EidosEvent>): EidosEvent {
  const now = new Date().toISOString();
  return {
    id: uid('ev'),
    calendarId: 'cal_personal',
    title: '',
    start: now.slice(0, 16),
    end: now.slice(0, 16),
    allDay: false,
    alarms: [10],
    availability: 'busy',
    origin: 'user',
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as EidosEvent;
}

export function newReminder(partial: Partial<Reminder>): Reminder {
  return {
    id: uid('rm'),
    calendarId: 'cal_personal',
    title: '',
    priority: 'none',
    done: false,
    createdAt: new Date().toISOString(),
    ...partial,
  } as Reminder;
}
