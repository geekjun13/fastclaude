import {
  useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { GlassSurface } from '../glass/GlassSurface.tsx';
import { Icon } from './Icon.tsx';
import './ui.css';

export { Icon } from './Icon.tsx';

/* ---------------------------------------------------------------- *
 * Sheet — a modal glass surface. Elevation 3, and it lenses in.
 * ---------------------------------------------------------------- */

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  leading?: { label: string; onClick: () => void; disabled?: boolean };
  trailing?: { label: string; onClick: () => void; disabled?: boolean; strong?: boolean };
}

export function Sheet({ open, title, onClose, children, leading, trailing }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Focus moves into the sheet so screen readers and keyboards follow it.
    ref.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GlassSurface
        elevation={3}
        radius={34}
        present
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div ref={ref} style={{ display: 'contents' }}>
          <header className="sheet-head">
            {leading ? (
              <button className="sheet-action leading" onClick={leading.onClick} disabled={leading.disabled}>
                {leading.label}
              </button>
            ) : (
              <button className="sheet-action leading" onClick={onClose}>취소</button>
            )}
            <h2 className="sheet-title">{title}</h2>
            {trailing ? (
              <button
                className="sheet-action trailing"
                data-strong={trailing.strong ? 'true' : undefined}
                onClick={trailing.onClick}
                disabled={trailing.disabled}
              >
                {trailing.label}
              </button>
            ) : (
              <span />
            )}
          </header>
          <div className="sheet-body">{children}</div>
        </div>
      </GlassSurface>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Segmented control — the thumb is measured, not guessed, so labels of
 * different widths still get an exactly-fitting selection.
 * ---------------------------------------------------------------- */

export interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      setThumb({ x: active.offsetLeft, w: active.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div className="segmented vibrancy" data-sunken="true" ref={ref} role="tablist" aria-label={ariaLabel}>
      {thumb ? (
        <span
          className="segmented-thumb"
          style={{ transform: `translateX(${thumb.x - 2}px)`, width: thumb.w }}
        />
      ) : null}
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Form primitives
 * ---------------------------------------------------------------- */

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="field-group">{children}</div>;
}

export function Field({
  label, children, className = '',
}: { label?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
    </label>
  );
}

export function Switch({
  on, onChange, label,
}: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className="switch"
      data-on={on}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  tone?: 'warn' | 'danger' | 'good' | 'info';
  onClick?: () => void;
  style?: CSSProperties;
  title?: string;
}

export function Chip({ children, selected, tone, onClick, style, title }: ChipProps) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className="chip"
      data-selected={selected ? 'true' : undefined}
      data-tone={tone}
      onClick={onClick}
      style={style}
      title={title}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------------- *
 * Card — content layer. Explicitly not glass: see docs/DESIGN.md §1.
 * ---------------------------------------------------------------- */

export function Card({
  title, icon, action, children, className = '', style,
}: {
  title?: string;
  icon?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {title ? (
        <header className="card-head">
          {icon ? <Icon name={icon} size={15} /> : null}
          <h3 className="card-title">{title}</h3>
          {action ? <span style={{ marginLeft: 'auto' }}>{action}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Empty({ icon = 'calendar', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <strong>{title}</strong>
      {hint ? <span className="small">{hint}</span> : null}
    </div>
  );
}

export function Button({
  children, onClick, primary, tone, wide, disabled, type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  tone?: 'danger';
  wide?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={`btn ${wide ? 'btn-wide' : ''}`}
      data-primary={primary ? 'true' : undefined}
      data-tone={tone}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
