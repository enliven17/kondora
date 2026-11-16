# Kondora brand kit

Kondora is a night-sky editorial brand: classical marble lit by moonlight, Andes peaks, torn paper, and a geometric condor. Calm, precise, a little theatrical. Never loud.

## Logo

| File | Use |
| --- | --- |
| `logo/kondora-mark.svg` | Condor mark alone. App icons, avatars, favicons, tight spaces. Works from 16px up. |
| `logo/kondora-wordmark.svg` | "KONDORA" wordmark alone. Footers, large display use. |
| `logo/kondora-lockup.svg` | Mark plus wordmark, horizontal. Default for headers and partner pages. |
| `../app/icon.svg` | Favicon on a night tile. |

The mark is an Andean condor in a soaring glide seen from the front: a raised head, a chevron collar (the condor's white ruff), stepped primary feathers, and a pointed tail. The wordmark is a monoline geometric cap set with wide tracking.

The React versions (`components/brand/logo.tsx`) share the same geometry and use `currentColor`.

**Clear space:** at least the height of the mark's head (one fifth of the mark height) on every side.
**Minimum size:** mark 16px, lockup 96px wide, wordmark 72px wide.

### Do

- Use marble (`#F3EEE4`) on night backgrounds, or night (`#05070D`) on marble.
- Keep the mark flat, single color.
- Scale the wordmark large and quiet, like the site footer.

### Do not

- Recolor the mark with YES or NO colors, gradients, or glows.
- Rotate, outline, or add a container shape (circle, pill) around the mark, except the square app tile.
- Set "Kondora" in another typeface as a logo.
- Place the logo on busy art without a dark scrim.

## Color

Tokens live in `app/globals.css` as RGB channels and in `tailwind.config.ts`.

| Token | Hex | Role |
| --- | --- | --- |
| `night-950` | `#05070D` | Page background |
| `night-900` | `#0A0F1C` | Raised sections, panels |
| `night-800` | `#111A2E` | Hover, inputs on panels |
| `night-700` | `#1B2640` | Tracks, inactive fills |
| `night-600` | `#293758` | Strong borders |
| `line` | `#233150` | Hairline borders |
| `marble-50` | `#F3EEE4` | Primary text, primary buttons |
| `marble-200` | `#D9D2C3` | Body text |
| `marble-400` | `#9E998D` | Labels, secondary text |
| `marble-600` | `#6B6861` | Disabled, tertiary |
| `yes` | `#7EC4A4` | YES side (patina) |
| `yes-soft` | `#16302C` | YES tint backgrounds |
| `no` | `#DE846C` | NO side (terracotta) |
| `no-soft` | `#341C1C` | NO tint backgrounds |
| `gold` | `#B89B5E` | Risk values (liquidation), caps, focus ring. Use sparingly. |

YES and NO are the only signal colors. They mean a side, never "good" or "bad" decoration. Gold marks risk and limits.

## Type

| Role | Family | Notes |
| --- | --- | --- |
| Display | Instrument Serif | Headlines, prices, big numbers. Italic for the second beat of a headline. |
| UI | Geist | Body, buttons, questions. |
| Labels | Geist Mono | Micro labels: uppercase, 11px, 0.14em tracking. Tabular figures for numbers. |

## Art direction

- Night sky from deep navy to black, fine stars, moonlit marble statues, fresco clouds, torn paper edges with a faint gold deckle, film grain.
- Raster art lives in `public/art/` as WebP. Regenerate or add art with the optimizer: `node brand/scripts/optimize-art.mjs <png-dir> public/art`.
- Section transitions use the torn edge component (`components/ui/torn-edge.tsx`).

## Shape and motion

- Radius: 0, 2, 4 or 6px. No fully rounded buttons or badges.
- No decorative rules, underline bars, status dots, bullet ornaments or dot grids.
- Motion explains state: reveals, the leverage dial, count-up payouts, the confirm ticket. Everything respects `prefers-reduced-motion`.

## Voice

Plain, specific, short. Say what happens and what it costs. Prefer "Pick a side" over abstractions. No hype words, no em dashes.
