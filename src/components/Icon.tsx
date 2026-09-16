/**
 * Glyphs. Drawn on a 24-unit grid with a 1.7 stroke so they sit at the same
 * optical weight as SF Symbols at body size, and they inherit currentColor so
 * vibrancy on glass works without per-icon fills.
 */

const PATHS: Record<string, string> = {
  calendar: 'M4 8h16M8 3v3M16 3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  sunrise: 'M12 3v5M5.6 9.6 4.2 8.2M18.4 9.6l1.4-1.4M3 18h18M7 18a5 5 0 0 1 10 0M6 21h12',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z',
  school: 'M12 4 3 8.5 12 13l9-4.5L12 4zM6.5 11v5c0 1.5 2.7 3 5.5 3s5.5-1.5 5.5-3v-5M21 8.5V14',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.25 3.25 0 0 1 0 6.1',
  sparkle: 'M12 3.5l1.8 4.9 4.9 1.8-4.9 1.8L12 16.9l-1.8-4.9-4.9-1.8 4.9-1.8L12 3.5zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z',
  plus: 'M12 5v14M5 12h14',
  chevronLeft: 'M14.5 6 9 12l5.5 6',
  chevronRight: 'M9.5 6l5.5 6-5.5 6',
  chevronDown: 'M6 9.5l6 5.5 6-5.5',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.2l3.4 2',
  pin: 'M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 0 0-13 0C5.5 14.9 12 21 12 21zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  bell: 'M18 16V11a6 6 0 1 0-12 0v5l-1.5 2.5h15L18 16zM10 20a2 2 0 0 0 4 0',
  repeat: 'M4 9V8a3 3 0 0 1 3-3h10l-2.5-2.5M20 15v1a3 3 0 0 1-3 3H7l2.5 2.5',
  trash: 'M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M7 7l.8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.5 12a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.8 3H9.2l-.3 2.7a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.3 2.7h5.6l.3-2.7a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z',
  send: 'M5 12l15-7-4.5 15-3.5-5.5L5 12z',
  send2: 'M4.5 11.5 20 4l-4 16-4.5-6.5L4.5 11.5zM11.5 13.5 20 4',
  warning: 'M12 4 2.8 20h18.4L12 4zM12 10v4.5M12 17.4v.1',
  shield: 'M12 3l7.5 3v5.5c0 4.4-3 8.2-7.5 9.5-4.5-1.3-7.5-5.1-7.5-9.5V6L12 3zM9 12l2 2 4-4',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15zM4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z',
  bowl: 'M3.5 10.5h17a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-8.5-8.5zM8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  grid: 'M4 4h7v7H4V4zM13 4h7v7h-7V4zM4 13h7v7H4v-7zM13 13h7v7h-7v-7z',
  today: 'M4 8h16M8 3v3M16 3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12 13.5h.01',
  pencil: 'M4 20l.8-3.6L15.4 5.8a1.8 1.8 0 0 1 2.6 0l.2.2a1.8 1.8 0 0 1 0 2.6L7.6 19.2 4 20zM14 7.2l2.8 2.8',
  heart: 'M12 20s-7.5-4.6-7.5-9.5a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
  flag: 'M5 21V4h11l-1.5 3.5L16 11H5M5 4h.01',
  link: 'M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7l-1.2 1.2M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.2-1.2',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  thermometer: 'M12 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0z',
  cloud: 'M7 18h10a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 6.6 11 3.5 3.5 0 0 0 7 18z',
  newspaper: 'M4 6h12v13H5.5A1.5 1.5 0 0 1 4 17.5V6zM16 9h3a1 1 0 0 1 1 1v7.5a1.5 1.5 0 0 1-3 0V9zM7 9h6M7 12h6M7 15h4',
};

export interface IconProps {
  name: keyof typeof PATHS | string;
  size?: number;
  /** Filled glyphs read as "selected" in a tab bar. */
  filled?: boolean;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, filled = false, className, strokeWidth = 1.7 }: IconProps) {
  const d = PATHS[name] ?? PATHS.calendar;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={filled ? strokeWidth + 0.5 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
