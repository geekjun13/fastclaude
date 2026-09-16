/**
 * Config access.
 *
 * Reads Vite's `import.meta.env`, but tolerates its absence so the pure
 * engines (recurrence, parsing, moderation) can be imported and tested under
 * plain Node, where `import.meta.env` does not exist.
 */
export function env(key: string, fallback = ''): string {
  try {
    const bag = (import.meta as { env?: Record<string, string | undefined> }).env;
    const value = bag?.[key];
    return value != null && value !== '' ? value : fallback;
  } catch {
    return fallback;
  }
}
