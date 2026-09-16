/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CYCLE_API_BASE?: string;
  readonly VITE_CYCLE_MODEL?: string;
  readonly VITE_WEATHER_API_BASE?: string;
  readonly VITE_NEWS_API_BASE?: string;
  readonly VITE_NEIS_API_BASE?: string;
  readonly VITE_NEIS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
