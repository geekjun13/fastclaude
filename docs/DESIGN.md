# Eidos — Design Charter

> Source research: Apple **"Meet Liquid Glass"** (WWDC25 session 219), Apple HIG *Materials*
> and *Adopting Liquid Glass*, plus the CSS/SVG refraction technique documented by kube.io
> and the `feDisplacementMap` prior art. Links at the bottom.

Eidos is a calendar that has to hold a *lot* of information — events, briefs, meals,
timetables, class boards, group schedules, an AI thread. Liquid Glass is what keeps that
density from feeling heavy. It is also the easiest design language in the world to get
wrong, so this document is the contract the code is held to.

---

## 1. The one rule that governs everything

**Liquid Glass is the navigation layer. It is never the content layer.**

Apple is explicit: applying glass to table views, lists or content areas "muddles
hierarchy." In Eidos that means:

| Layer | Material | Examples |
|---|---|---|
| **Chrome** (floats) | Liquid Glass | Tab bar, toolbar, sheets, popovers, the Cycle composer, segmented controls |
| **Content** (scrolls) | Opaque / thin fill | Month grid, event rows, brief cards, meal tables, chat bubbles |
| **On-glass** | Vibrancy only | Icons, labels and separators sitting *inside* a glass surface |

Corollary, also from the session: **never stack glass on glass.** A popover presented from
a glass toolbar renders its own glass; the toolbar beneath it steps down to a flat scrim.
This is enforced in code by `GlassSurface`, which reads a React context and refuses to
render a second nested glass layer — it degrades to a vibrancy fill instead.

## 2. Two variants, never mixed

- **Regular** — the default, everywhere. Fully adaptive: tint, shadow and dynamic range
  respond to what is behind it. All chrome in Eidos is Regular.
- **Clear** — permanently transparent, minimally adaptive. Apple allows it only when
  *all three* hold: it sits over media-rich content, a dimming layer won't hurt that
  content, and the content on top is bold and bright. In Eidos exactly one surface
  qualifies: the Morning/Night Brief hero, which sits over a full-bleed generated sky
  gradient. It ships with the mandatory dimming layer.

Mixing the two in one view is forbidden.

## 3. Hierarchy through depth

Importance is expressed by **elevation, refraction strength and shadow** — not by making
things bigger or louder. Eidos has four elevations:

```
e0  content        no glass, no shadow
e1  resting chrome blur 20px  refraction 0.55  shadow y6  b18  α.10
e2  floating       blur 28px  refraction 0.80  shadow y14 b38  α.16
e3  modal          blur 36px  refraction 1.00  shadow y28 b70  α.24
```

Shadow opacity is **adaptive**: it increases over text-dense backgrounds and decreases over
flat light ones, mirroring Apple's behaviour. Implemented as a CSS variable the scroll
container updates.

## 4. Concentricity

Glass controls nest into the corners of their container. The radius of a child is always

```
r_child = r_parent − padding
```

with a floor of `--r-2`. `--r-outer: 28px` matches the device-corner family; the token file
carries the whole ladder so no component invents its own radius. Every capsule control uses
`border-radius: 999px` — a true continuous capsule, not a large-radius rectangle.

## 5. Tint only what leads

"Avoid tinting all elements — nothing stands out." Eidos tints exactly one control per
view: the primary action. Everything else is untinted glass. Calendar colours live on the
**content layer** (event chips, calendar dots) — which is also Apple's stated advice for
imbuing an app with colour.

The tint is not a flat fill. It is a brightness-mapped range: the tint layer is composited
with `color-mix` against the sampled backdrop luminance so it behaves like real coloured
glass — hue holds, brightness and saturation shift with what's behind it.

## 6. Light and dark

- **Small elements** (tab bar items, toolbar glyphs, capsule controls) *flip* between light
  and dark automatically to maximise contrast against the backdrop.
- **Large elements** (sidebars, sheets, the brief hero) *adapt* but never flip — Apple notes
  flipping at large sizes is distracting. They only take on spill: colour from nearby
  content bleeding onto the surface.

## 7. Motion

Glass is a *liquid*. It responds elastically and it settles.

- Press: `scale(0.97)` with a gel-like overshoot, `--ease-gel`, 240ms.
- Sheet present: the surface appears to *lens into existence* — refraction scale animates
  0 → 1 over 380ms while the blur ramps, rather than a plain fade.
- View change (month ↔ week ↔ day): shared-element transition on the focused date cell.
- Everything is cancelled under `prefers-reduced-motion`.

## 8. Accessibility is part of the material

The system settings Apple honours automatically, we honour explicitly:

| Setting | CSS query | What Eidos does |
|---|---|---|
| Reduce Transparency | `prefers-reduced-transparency: reduce` | Glass becomes frosted-opaque (92% fill), refraction off |
| Increase Contrast | `prefers-contrast: more` | Near-black/near-white surfaces, 1.5px contrasting borders, refraction off |
| Reduce Motion | `prefers-reduced-motion: reduce` | Elastic + lensing animations disabled, opacity only |
| Dark Mode | `prefers-color-scheme` | Full token flip; also overridable per-user via `data-theme` |

Text on glass is held to **WCAG AA (4.5:1)** against the *worst-case* backdrop, not the
average one. That is why every glass surface carries a minimum tint floor even in its
"clear" state.

## 9. Typography & rhythm

- Type: SF Pro / `-apple-system` first, then Pretendard Variable for Korean, then a system
  stack. Korean and Latin share an optical baseline so mixed strings don't jitter.
- Scale is a modular 1.125 ramp anchored at 17px body (iOS body size), with optical
  letter-spacing tightening as size grows — the way SF Pro's optical sizes behave.
- Spacing is an 4px grid; 8px is the smallest gap between distinct elements.
- Numerals in the calendar grid are `font-variant-numeric: tabular-nums` so date columns
  never shift.

## 10. The web-platform reality check

Real refraction needs `backdrop-filter: url(#svg-filter)`, which only Chromium supports.
Eidos therefore ships **three tiers**, chosen by feature detection at runtime, not by
browser sniffing:

1. **Full** (Chromium) — SVG `feImage` + `feDisplacementMap` refraction, computed from a
   rounded-rect signed-distance field at refractive index 1.5, plus an `feSpecularLighting`
   rim. `feDisplacementMap` is 8-bit, so displacement is clamped to ±128px and the map is
   generated at 2× and downsampled to soften the known pixelation artefact.
2. **Standard** (Safari, Firefox ≥103) — `backdrop-filter: blur() saturate()` plus a
   layered specular gradient and an inset rim. No true refraction; the edge gradient is
   tuned to read as a bevel.
3. **Fallback** (no `backdrop-filter`) — solid tinted fills at the same luminance as the
   blurred result, so layout and contrast are identical.

All three tiers use the *same* tokens and the same shadows, so the interface reads as one
design in all of them.

---

## Review log

Every item below is something a rendered-browser pass actually caught, in the
order it was found. Each one was a real defect, not a hypothetical.

1. **Stylesheet order inverted the whole cascade.** `main.tsx` imported `App.tsx`
   before `styles/global.css`, so every feature stylesheet was emitted *before*
   the material layer. Any feature rule that tied with a `.glass` rule on
   specificity silently lost. Two visible symptoms: the tab bar and the compose
   button were laid out in flow instead of floating (`.glass{position:relative}`
   beat `.tabbar{position:fixed}`), which pushed the tab bar 163px off the right
   edge on a 390px viewport; and the brief hero rendered near-black text on a
   night sky because `.glass{color:var(--label)}` beat `.brief-hero{color:#fff}`.
   Fixed by importing the base layer first, and by routing the floating
   surfaces' `position` through a `--glass-pos` custom property so the behaviour
   no longer depends on emission order at all.

2. **The clear variant's dimming layer painted over its own content.** The
   specular/dimming `::before` sat at `z-index: 1`, above in-flow children. On
   the Regular variant `mix-blend-mode: soft-light` hid the mistake; on Clear it
   greyed out the headline. Moved to `z-index: -1`, which `isolation: isolate`
   keeps inside the surface.

3. **A scrolling grid was clipping and then overlapping form sections.** Both
   the sheet body and the onboarding body were `display: grid`. A grid item with
   `overflow: hidden` — every `.field-group` — has an automatic minimum size of
   0, so the container squeezed the groups rather than scrolling: the event
   editor lost its last row mid-glyph, and an expanded consent notice drew on
   top of the fields below it. Both are now flex columns with `flex: 0 0 auto`
   children.

4. **Korean was being broken mid-word.** The global `word-break: break-word`
   split "오전 10시" across lines as "10" / "시". Korean has no inter-word
   spaces to break on, so the default rule attacks the words themselves. Now
   `word-break: keep-all` with `overflow-wrap: anywhere` as the escape hatch for
   long URLs.

5. **`text-transform: uppercase` only shouted at half of each label.** Korean has
   no case, so "Cycle의 코멘트" became "CYCLE의 코멘트" — the Latin half
   shouting, the Korean half unchanged. Removed; weight and size carry the
   label instead.

6. **A content-layer control was stranded on media.** The morning/night switch
   sat below the hero, over the sky gradient, where its `--label-2` text
   measured well under 4.5:1 against a night sky. It is chrome, not content, so
   it moved onto the hero glass with on-glass colours.

7. **Glass-on-glass in the hero chips.** The weather chips carried their own
   `backdrop-filter`, making them a second pane on top of the hero. Per §1 they
   are now vibrancy fills only.

8. **Glass with nothing behind it reads as plastic.** The Edu header was glass
   over flat canvas and was indistinguishable from the opaque content cards
   below it. It now sits on a soft accent field it can actually refract.

Two non-visual bugs surfaced in the same passes and are covered by regression
tests in `tests/core.test.mjs`: "다음 주 월요일" resolved to the week *after*
next, and the title extractor ate the "1시" inside "1시간", leaving events
called "치과 간".

---

## Sources

- [Meet Liquid Glass — WWDC25 session 219](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)
- [HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Liquid Glass in the Browser: Refraction with CSS and SVG — kube.io](https://kube.io/blog/liquid-glass-css-svg/)
- [Liquid Glass in CSS (and SVG) — ekino](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- [w3c/svgwg#1142 — interoperable backdrop displacement](https://github.com/w3c/svgwg/issues/1142)
