import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';
import { buildLensMap, detectGlassTier } from './displacement.ts';

/* ------------------------------------------------------------------ *
 * Tier detection — one decision for the whole document.
 * ------------------------------------------------------------------ */

export type GlassTier = 'full' | 'standard' | 'flat';

export function useGlassTier(): GlassTier {
  const [tier, setTier] = useState<GlassTier>('standard');
  useEffect(() => {
    const apply = () => {
      const t = detectGlassTier();
      setTier(t);
      document.documentElement.dataset.glass = t;
    };
    apply();
    const queries = [
      '(prefers-reduced-transparency: reduce)',
      '(prefers-contrast: more)',
    ].map((q) => window.matchMedia(q));
    queries.forEach((q) => q.addEventListener('change', apply));
    return () => queries.forEach((q) => q.removeEventListener('change', apply));
  }, []);
  return tier;
}

/* ------------------------------------------------------------------ *
 * Nesting guard.
 *
 * Apple: "never stack Liquid Glass elements on top of each other." A React
 * context carries the current glass depth; a GlassSurface rendered inside
 * another one silently degrades to a vibrancy fill instead of painting a
 * second pane. Components therefore don't have to know their own context.
 * ------------------------------------------------------------------ */

interface GlassCtx {
  depth: number;
  /** Radius of the enclosing glass, so children can stay concentric. */
  radius: number;
}
const GlassContext = createContext<GlassCtx>({ depth: 0, radius: 28 });

export const useInsideGlass = () => useContext(GlassContext).depth > 0;

/**
 * Concentric radius: a child nested at `pad` inside a parent of radius `r`
 * shares the same centre of curvature when its radius is r - pad.
 */
export function concentric(parentRadius: number, pad: number, min = 10): number {
  return Math.max(min, parentRadius - pad);
}

/* ------------------------------------------------------------------ *
 * GlassSurface
 * ------------------------------------------------------------------ */

export interface GlassSurfaceProps {
  children?: ReactNode;
  /** 1 resting chrome · 2 floating · 3 modal. Drives blur, refraction and shadow together. */
  elevation?: 1 | 2 | 3;
  /**
   * 'regular' everywhere. 'clear' only over media-rich content, and it always
   * renders its mandatory dimming layer (see docs/DESIGN.md §2).
   */
  variant?: 'regular' | 'clear';
  /** Accent token for the one primary action per view. Anything else stays untinted. */
  tint?: string;
  radius?: number;
  pressable?: boolean;
  /** Plays the lensing-in present animation. */
  present?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}

export function GlassSurface({
  children,
  elevation = 1,
  variant = 'regular',
  tint,
  radius = 28,
  pressable = false,
  present = false,
  as,
  className = '',
  style,
  ...rest
}: GlassSurfaceProps) {
  const parent = useContext(GlassContext);
  const nested = parent.depth > 0;
  const Tag = (as ?? 'div') as ElementType;

  const ref = useRef<HTMLElement | null>(null);
  const [lens, setLens] = useState<string | null>(null);

  // Full tier only: rebuild the displacement map when the surface resizes.
  const wantsRefraction =
    !nested &&
    typeof document !== 'undefined' &&
    document.documentElement.dataset.glass === 'full';

  useLayoutEffect(() => {
    if (!wantsRefraction || !ref.current) return;
    const el = ref.current;
    let raf = 0;
    const rebuild = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        setLens(
          buildLensMap({
            width: Math.round(r.width),
            height: Math.round(r.height),
            radius,
            bevel: Math.max(8, radius * 0.9),
            strength: 18 * [0, 0.55, 0.8, 1][elevation],
          }),
        );
      });
    };
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [wantsRefraction, radius, elevation]);

  const ctx = useMemo<GlassCtx>(() => ({ depth: parent.depth + 1, radius }), [parent.depth, radius]);

  /* ---- Nested: degrade to vibrancy. Never a second pane. ---- */
  if (nested) {
    return (
      <GlassContext.Provider value={ctx}>
        <Tag
          className={`vibrancy ${present ? 'lens-in' : ''} ${className}`}
          data-strong={variant === 'regular' ? 'true' : undefined}
          data-pressable={pressable ? 'true' : undefined}
          style={
            {
              '--r': `${concentric(parent.radius, 8)}px`,
              ...(tint ? { background: tint, color: 'var(--on-tint)' } : null),
              ...style,
            } as CSSProperties
          }
          {...rest}
        >
          {children}
        </Tag>
      </GlassContext.Provider>
    );
  }

  return (
    <GlassContext.Provider value={ctx}>
      <Tag
        ref={ref}
        className={`glass ${present ? 'lens-in' : ''} ${className}`}
        data-elev={elevation}
        data-variant={variant}
        data-tint={tint ? '' : undefined}
        data-pressable={pressable ? 'true' : undefined}
        data-refract={lens ? 'on' : undefined}
        style={
          {
            '--r': `${radius}px`,
            ...(tint ? { '--tint': tint } : null),
            ...style,
          } as CSSProperties
        }
        {...rest}
      >
        {lens ? <LensFilter map={lens} elevation={elevation} /> : null}
        {children}
      </Tag>
    </GlassContext.Provider>
  );
}

/**
 * The SVG half of the full tier: an feImage carrying the displacement map,
 * an feDisplacementMap that bends the backdrop through it, and a specular
 * rim screened on top. Referenced from CSS as backdrop-filter: url(#eidos-lens).
 */
function LensFilter({ map, elevation }: { map: string; elevation: 1 | 2 | 3 }) {
  const scale = 18 * [0, 0.55, 0.8, 1][elevation];
  return (
    <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="eidos-lens" colorInterpolationFilters="sRGB">
        <feImage href={map} result="lensmap" preserveAspectRatio="none" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="lensmap"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
          result="refracted"
        />
        {/* Specular rim: light from -45deg, matching the CSS gradient in glass.css. */}
        <feGaussianBlur in="lensmap" stdDeviation="1.2" result="soft" />
        <feSpecularLighting
          in="soft"
          surfaceScale={3}
          specularConstant={0.7}
          specularExponent={28}
          lightingColor="#ffffff"
          result="spec"
        >
          <feDistantLight azimuth={225} elevation={58} />
        </feSpecularLighting>
        <feComposite in="spec" in2="refracted" operator="in" result="specClipped" />
        <feBlend in="refracted" in2="specClipped" mode="screen" />
      </filter>
    </svg>
  );
}
