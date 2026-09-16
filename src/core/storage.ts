import type { AppState } from './types.ts';

const KEY = 'eidos.state.v1';

/**
 * Persistence. Deliberately narrow: the UI slice is not stored except for the
 * durable bits (theme, week start, view), so reopening the app lands you on
 * today rather than wherever you last scrolled.
 */
export function loadState(): Partial<AppState> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    // Private mode, cleared site data, quota — all mean "no saved state".
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    const { ui, ...rest } = state;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...rest,
        ui: {
          theme: ui.theme,
          weekStartsOn: ui.weekStartsOn,
          view: ui.view,
          tab: ui.tab,
        },
      }),
    );
  } catch {
    /* Storage unavailable — the app keeps working in memory. */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}

export function uid(prefix = 'e'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
