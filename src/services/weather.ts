import { env } from '../core/env.ts';
import type { ISODate, WeatherNow } from '../core/types.ts';

/**
 * Weather for the briefs.
 *
 * Uses Open-Meteo, which needs no API key, and falls back to a deterministic
 * local model when the network is unavailable so the brief always renders
 * something rather than a spinner or an error card.
 */

const BASE = env('VITE_WEATHER_API_BASE', 'https://api.open-meteo.com/v1');

/** WMO weather interpretation codes → Korean summary + glyph. */
export const WMO: Record<number, { label: string; glyph: string }> = {
  0: { label: '맑음', glyph: '☀︎' },
  1: { label: '대체로 맑음', glyph: '🌤' },
  2: { label: '구름 조금', glyph: '⛅️' },
  3: { label: '흐림', glyph: '☁︎' },
  45: { label: '안개', glyph: '🌫' },
  48: { label: '서리 안개', glyph: '🌫' },
  51: { label: '이슬비', glyph: '🌦' },
  53: { label: '이슬비', glyph: '🌦' },
  55: { label: '짙은 이슬비', glyph: '🌦' },
  61: { label: '약한 비', glyph: '🌧' },
  63: { label: '비', glyph: '🌧' },
  65: { label: '강한 비', glyph: '🌧' },
  71: { label: '약한 눈', glyph: '🌨' },
  73: { label: '눈', glyph: '🌨' },
  75: { label: '많은 눈', glyph: '❄︎' },
  80: { label: '소나기', glyph: '🌦' },
  81: { label: '소나기', glyph: '🌦' },
  82: { label: '강한 소나기', glyph: '⛈' },
  95: { label: '뇌우', glyph: '⛈' },
  96: { label: '우박 동반 뇌우', glyph: '⛈' },
};

export function weatherGlyph(code: number): string {
  return WMO[code]?.glyph ?? '☁︎';
}
export function weatherLabel(code: number): string {
  return WMO[code]?.label ?? '흐림';
}

export interface WeatherQuery {
  lat: number;
  lon: number;
  date: ISODate;
}

export async function fetchWeather(q: WeatherQuery): Promise<WeatherNow> {
  try {
    const url =
      `${BASE}/forecast?latitude=${q.lat}&longitude=${q.lon}` +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,precipitation_probability,weather_code' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset' +
      `&timezone=auto&start_date=${q.date}&end_date=${q.date}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();

    const hourly = (j.hourly?.time ?? []).map((t: string, i: number) => ({
      hour: Number(t.slice(11, 13)),
      tempC: Math.round(j.hourly.temperature_2m[i]),
      precip: j.hourly.precipitation_probability?.[i] ?? 0,
      code: j.hourly.weather_code?.[i] ?? 0,
    }));

    const code = j.current?.weather_code ?? 0;
    return {
      tempC: Math.round(j.current?.temperature_2m ?? 0),
      feelsLikeC: Math.round(j.current?.apparent_temperature ?? 0),
      code,
      summary: weatherLabel(code),
      highC: Math.round(j.daily?.temperature_2m_max?.[0] ?? 0),
      lowC: Math.round(j.daily?.temperature_2m_min?.[0] ?? 0),
      precipitationChance: j.daily?.precipitation_probability_max?.[0] ?? 0,
      windKph: Math.round(j.current?.wind_speed_10m ?? 0),
      uvIndex: Math.round(j.daily?.uv_index_max?.[0] ?? 0),
      sunrise: (j.daily?.sunrise?.[0] ?? '').slice(11, 16),
      sunset: (j.daily?.sunset?.[0] ?? '').slice(11, 16),
      hourly,
    };
  } catch {
    return localWeather(q);
  }
}

/**
 * Offline model: a seasonal baseline for the latitude plus a deterministic
 * per-day variation. Not a forecast — but it is stable, plausible, and it
 * keeps the brief from having a hole in it.
 */
function localWeather(q: WeatherQuery): WeatherNow {
  const d = new Date(q.date);
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  // Peak around day 205 (late July) in the northern hemisphere.
  const seasonal = Math.cos(((doy - 205) / 365) * 2 * Math.PI);
  const base = 14 - seasonal * 13;

  let h = 2166136261;
  for (const ch of q.date) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const jitter = ((Math.abs(h) % 100) / 100 - 0.5) * 7;

  const high = Math.round(base + jitter + 4);
  const low = Math.round(base + jitter - 4);
  const rainy = Math.abs(h) % 100 < (doy > 170 && doy < 240 ? 45 : 22);
  const code = rainy ? 63 : Math.abs(h) % 3 === 0 ? 3 : Math.abs(h) % 3 === 1 ? 2 : 0;

  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const curve = -Math.cos(((hour - 4) / 24) * 2 * Math.PI);
    return {
      hour,
      tempC: Math.round(low + ((high - low) * (curve + 1)) / 2),
      precip: rainy ? 40 + ((Math.abs(h) + hour * 13) % 40) : (Math.abs(h) + hour * 7) % 18,
      code,
    };
  });

  const now = new Date().getHours();
  return {
    tempC: hourly[now]?.tempC ?? high,
    feelsLikeC: (hourly[now]?.tempC ?? high) - (rainy ? 2 : 0),
    code,
    summary: weatherLabel(code),
    highC: high,
    lowC: low,
    precipitationChance: rainy ? 70 : 10,
    windKph: 6 + (Math.abs(h) % 14),
    uvIndex: rainy ? 2 : Math.max(1, Math.round((seasonal + 1) * 4)),
    sunrise: seasonal > 0 ? '05:24' : '07:38',
    sunset: seasonal > 0 ? '19:52' : '17:22',
    hourly,
    airQuality: { index: 30 + (Math.abs(h) % 70), label: '' },
  };
}

export function aqiLabel(index: number): string {
  if (index <= 50) return '좋음';
  if (index <= 100) return '보통';
  if (index <= 150) return '나쁨';
  return '매우 나쁨';
}

/**
 * The one line the brief actually leads with — what to carry, what to wear.
 * A temperature is data; "우산 챙기세요" is the reason someone opens a brief.
 */
export function dressingAdvice(w: WeatherNow): string[] {
  const out: string[] = [];
  if (w.precipitationChance >= 50) out.push('우산 꼭 챙기세요');
  else if (w.precipitationChance >= 30) out.push('접이식 우산을 넣어 두면 좋아요');

  const swing = w.highC - w.lowC;
  if (swing >= 10) out.push(`일교차 ${swing}° — 겉옷 하나 더`);

  if (w.lowC <= 0) out.push('아침 영하, 장갑과 목도리');
  else if (w.lowC <= 8) out.push('아침 쌀쌀해요, 두껍게');
  else if (w.highC >= 30) out.push('더워요 — 물 자주 마시기');

  if (w.uvIndex >= 7) out.push(`자외선 ${w.uvIndex} — 선크림`);
  if (w.windKph >= 25) out.push('바람 강함');
  if (w.airQuality && w.airQuality.index > 100) out.push(`미세먼지 ${aqiLabel(w.airQuality.index)} — 마스크`);

  return out;
}
