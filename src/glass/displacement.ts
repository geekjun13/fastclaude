/**
 * Generates the displacement map that drives real refraction in the "full" tier.
 *
 * `feDisplacementMap` reads two 8-bit channels and treats them as signed offsets:
 *   R = 128 + dx * 127     G = 128 + dy * 127     (128 = no displacement)
 *
 * Physically, a pane of glass with a rounded bevelled edge refracts most strongly
 * where the surface normal is most oblique — at the rim — and not at all across the
 * flat middle. So we build a signed-distance field for the rounded rect, take its
 * gradient (which points outward, normal to the edge), and scale it by a refraction
 * profile derived from Snell's law at n = 1.5.
 *
 * The map is rendered at 2x and drawn down, because feDisplacementMap does no
 * supersampling — the known cause of the pixelated look in naive implementations.
 */

export interface LensOptions {
  width: number;
  height: number;
  radius: number;
  /** Width of the refracting bevel, in px. */
  bevel: number;
  /** Peak displacement in px. feDisplacementMap is 8-bit, so this is clamped to 128. */
  strength: number;
}

/** Refractive index of glass relative to air. */
const N_GLASS = 1.5;

/** Signed distance to a rounded rectangle, negative inside. */
function sdRoundedRect(px: number, py: number, hw: number, hh: number, r: number): number {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Fraction of peak displacement at a given depth into the bevel.
 * t = 0 at the outer edge, 1 at the inner end of the bevel.
 *
 * Models the ray bending through a spherical-ish edge: the surface normal tilts by
 * acos(t), refraction follows Snell (sin θ₂ = sin θ₁ / n), and the lateral offset is
 * proportional to tan(θ₁ − θ₂). Normalised so the rim reads as 1.
 */
function refractionProfile(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  const incident = Math.acos(Math.min(1, Math.max(0, t)));
  const sinT = Math.min(1, Math.sin(incident) / N_GLASS);
  const transmitted = Math.asin(sinT);
  return Math.tan(incident - transmitted) * 3.2;
}

/** Builds the R/G displacement map as a PNG data URL. Returns null outside a browser. */
export function buildLensMap(opts: LensOptions): string | null {
  if (typeof document === 'undefined') return null;
  const { width, height, radius, bevel, strength } = opts;
  if (width <= 0 || height <= 0) return null;

  const ss = 2; // supersample factor
  const w = Math.max(1, Math.round(width * ss));
  const h = Math.max(1, Math.round(height * ss));

  const hi = document.createElement('canvas');
  hi.width = w;
  hi.height = h;
  const hctx = hi.getContext('2d');
  if (!hctx) return null;

  const img = hctx.createImageData(w, h);
  const data = img.data;

  const hw = w / 2;
  const hh = h / 2;
  const r = radius * ss;
  const bev = Math.max(1, bevel * ss);
  const peak = Math.min(128, strength) / 128; // normalised; feDisplacementMap scale carries px

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x - hw + 0.5;
      const py = y - hh + 0.5;
      const d = sdRoundedRect(px, py, hw, hh, r);

      let dx = 0;
      let dy = 0;

      // Only the bevel band refracts. d is negative inside; -bev..0 is the band.
      if (d > -bev && d < 0) {
        const t = 1 + d / bev; // 0 at inner edge of band, 1 at the outer rim
        const mag = refractionProfile(t) * peak;

        // Gradient of the SDF == outward normal. Central differences, cheap and stable.
        const e = 1;
        const gx = sdRoundedRect(px + e, py, hw, hh, r) - sdRoundedRect(px - e, py, hw, hh, r);
        const gy = sdRoundedRect(px, py + e, hw, hh, r) - sdRoundedRect(px, py - e, hw, hh, r);
        const len = Math.hypot(gx, gy) || 1;

        // Sample *inward* (opposite the outward normal): glass pulls the backdrop in.
        dx = (-gx / len) * mag;
        dy = (-gy / len) * mag;
      }

      const i = (y * w + x) * 4;
      data[i] = clamp8(128 + dx * 127);
      data[i + 1] = clamp8(128 + dy * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  hctx.putImageData(img, 0, 0);

  // Downsample to soften the 8-bit stair-stepping.
  const lo = document.createElement('canvas');
  lo.width = Math.max(1, Math.round(width));
  lo.height = Math.max(1, Math.round(height));
  const lctx = lo.getContext('2d');
  if (!lctx) return hi.toDataURL();
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = 'high';
  lctx.drawImage(hi, 0, 0, lo.width, lo.height);
  return lo.toDataURL();
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Which material tier this browser can actually render.
 *  full     — SVG filters usable as backdrop-filter (Chromium): true refraction
 *  standard — backdrop-filter blur works (Safari, Firefox 103+)
 *  flat     — neither; opaque fills at matched luminance
 */
export function detectGlassTier(): 'full' | 'standard' | 'flat' {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return 'flat';

  const hasBackdrop =
    CSS.supports('backdrop-filter', 'blur(4px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(4px)');
  if (!hasBackdrop) return 'flat';

  // Accessibility settings that switch refraction off entirely.
  const reduced =
    window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches ||
    window.matchMedia?.('(prefers-contrast: more)').matches;
  if (reduced) return 'standard';

  // Chromium is the only engine that accepts url(#filter) in backdrop-filter.
  // Feature-detect rather than sniff: set it and read it back.
  const probe = document.createElement('div');
  probe.style.backdropFilter = 'url(#eidos-probe)';
  if (probe.style.backdropFilter.includes('url')) return 'full';

  probe.style.setProperty('-webkit-backdrop-filter', 'url(#eidos-probe)');
  if (probe.style.getPropertyValue('-webkit-backdrop-filter').includes('url')) return 'full';

  return 'standard';
}
