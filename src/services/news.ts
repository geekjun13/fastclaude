import { env } from '../core/env.ts';
import type { NewsItem } from '../core/types.ts';

/**
 * Headlines for the briefs.
 *
 * Set VITE_NEWS_API_BASE to any endpoint returning
 * `{ items: [{ title, source, category, url?, summary? }] }` and it is used
 * directly. With none configured the brief still renders, but it says so:
 * it shows a topic-shaped placeholder card that is explicitly labelled as
 * not being live news. Inventing headlines would be worse than showing none.
 */

const BASE = env('VITE_NEWS_API_BASE');

export const TOPICS = [
  '종합', '경제', 'IT·과학', '세계', '문화', '스포츠', '건강', '교육', '날씨',
] as const;

export type Topic = (typeof TOPICS)[number];

export interface NewsResult {
  items: NewsItem[];
  /** False when no provider is configured — the UI must say so. */
  live: boolean;
}

export async function fetchNews(topics: string[], limit = 5): Promise<NewsResult> {
  if (!BASE) return { items: [], live: false };

  try {
    const url = `${BASE}?topics=${encodeURIComponent(topics.join(','))}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const raw: unknown[] = Array.isArray(json?.items) ? json.items : [];
    const items = raw.slice(0, limit).map((r, i) => {
      const o = r as Record<string, unknown>;
      return {
        id: String(o.id ?? `n${i}`),
        title: String(o.title ?? '').slice(0, 180),
        source: String(o.source ?? ''),
        category: String(o.category ?? topics[0] ?? '종합'),
        url: typeof o.url === 'string' ? o.url : undefined,
        summary: typeof o.summary === 'string' ? o.summary.slice(0, 300) : undefined,
      } satisfies NewsItem;
    });
    return { items: items.filter((n) => n.title), live: true };
  } catch {
    return { items: [], live: false };
  }
}
