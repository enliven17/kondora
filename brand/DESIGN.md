# Kondora design system

Soft, dreamy and confident. Blush paper outside, deep plum inside, one electric yellow for action. 3D renders of glossy objects in a pastel, slightly hazy world. No mythology, no statues, no birds.

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | #FFF3F5 | Marketing page background |
| `blush` | #FFDAE0 | Soft panels on paper, light chips |
| `petal` | #FFC7CF | Icon squares inside buttons, highlights on dark |
| `petal-hot` | #FF8A94 | Big numbers on dark, focus ring |
| `plum` | #320713 | Primary dark button, raised dark surfaces |
| `cocoa` | #23050D | Dark cards on paper (statement card, FAQ rows) |
| `panel` | #160309 | App panels |
| `panel-deep` | #120207 | Inputs and table wells |
| `ink` | #050102 | Deepest overlays |
| `bg` | #1B0A0E | App background |
| `fg` | #FBF3F4 | Text on dark |
| `muted` | #A8969B | Secondary text on dark |
| `haze` | #9E878D | Tertiary text, captions |
| `mauve` / `mauve-soft` | #7A5E66 / #50363E | Body text on paper / dividers on dark |
| `acc` | #FFFC8F | The action color: quick-bet chips, active tab, plus icons, key values |
| `up` / `down` | #34D57F / #E0344B | YES and profit / NO and loss |
| `online` | #45B78C | Live status text |

Text on paper is `cocoa` (headings) and `mauve` (body). Borders on dark are `border-line/10`.

## Type

Satoshi everywhere (variable 300 to 900, `font-sans`). Numbers use `.num` (tabular, tight tracking). Geist Mono only for addresses and hashes.

- Display: Satoshi 700, tracking -0.04em, `text-display-lg|md|sm`.
- Section titles on paper: Satoshi 500, large, tracking -0.03em (like "See the engine in motion").
- Labels: 11px, uppercase, tracking 0.08em, `muted`.

## Shape

Radius scale: 6, 10 (default), 14, 20, 28. Hero and CTA image cards use 28. Panels 14 to 20. Buttons 10. No pill shapes, no fully round chips.

## Components

- **Primary button (dark):** `bg-plum text-fg`, height 44 to 48, radius 10, a 32px `bg-petal` square on the left holding a chevron in `plum`. On paper and on dark.
- **Primary button (light):** `bg-paper text-cocoa` with the same petal square, used on top of imagery.
- **Accent chip:** `bg-acc text-acc-ink`, radius 6, small, for quick bets (`+5`, `+10`) and active states.
- **Dark card on paper:** `bg-cocoa`, radius 20, generous padding.
- **App panel:** `bg-panel/85` with `backdrop-blur-xl`, `border border-line/10`, radius 14 to 20.
- **FAQ row:** `bg-cocoa text-fg`, radius 10, `acc` plus icon that rotates to a cross.
- **Stats:** large Satoshi numbers, thin vertical dividers.
- **Badges:** small rectangles radius 4 to 6, never pills. Leverage tag reads `Up to 5x`.

## Motion

Lenis smooth scroll and GSAP ScrollTrigger. Two-tone text reveal on scroll (muted words light up to fg). Hero image slow zoom and parallax. Feature tabs with an autoplay progress bar. Falling petals in the app background (CSS keyframes `petal-fall` and `petal-sway`, 10 to 14 petals, transform and opacity only). Count-up numbers. Everything respects `prefers-reduced-motion`.

## Rules

No em dashes. No pill shapes. No dot ornaments (no status dots, no bullet dots, no dot grids; status uses text color). No decorative accent lines. No AI slop words (unlock, seamless, revolutionize, empower, supercharge). Plain, short, confident copy.

## Asset contract

Raster art lives in `public/art/` and is generated with Codex in one consistent style: dreamy pastel 3D world, soft pink and peach foliage and blossoms, warm haze, glossy plum and petal coins and orbs that carry the Kondora split-coin mark, film grain, low saturation.

| File | Size | Content |
| --- | --- | --- |
| `hero.webp` | 2400x1300 | Wide pastel blossom world with two large glossy split coins half hidden in foliage |
| `hero-mobile.webp` | 1080x1500 | Same scene, portrait |
| `cta.webp` | 2400x1000 | Variant of the hero for the closing call to action |
| `app-bg.webp` | 2400x1400 | Foliage scene that is blurred behind the app |
| `feature-split.webp` | 1200x1200 | A glossy coin split into two halves floating apart, on blush |
| `feature-lever.webp` | 1200x1200 | A stack of plum coins tilted on a seesaw, on blush |
| `feature-council.webp` | 1200x1200 | Five glossy orbs in a ring around a split coin, on blush |
| `cat/<category>.webp` | 640x640 | One 3D object per category (crypto, macro, sports, esports, politics, world, tech, culture) |
| `petals/petal-1.png` ... `petal-4.png` | 96x96 | Transparent single petals and leaves for the falling animation |

Logo files live in `brand/logo/`. The mark is a split coin: two half discs offset horizontally (YES and NO, shifted by leverage).
