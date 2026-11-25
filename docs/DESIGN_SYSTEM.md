# CricLedger: design system

**Concept: "Night match, orange heat."** Midnight navy and charcoal surfaces, warm white type,
and an orange accent that appears only where it matters (the main action, active states,
featured information). Cricket photography sets the mood on every screen; scores are set in
tall broadcast numerals.

## Brand
* **Name:** CricLedger (`src/theme/brand.ts`). The project folder and bundle ID remain `CricPilot` / `com.cricpilot`.
* **Tagline:** *Every ball. Every moment.*
* **Mark:** a navy tile holding an orange ball. Its warm-white seam lifts out of the ball into a rising flight
  path (`src/assets/brand/logo.svg`, `<BrandMark/>`, icons from `scripts/generate-brand.py`).

## Colour (`src/theme/colors.ts`)
| Token | Dark | Light | Use |
|---|---|---|---|
| primary | #FF6B00 | #F97316 | main action, active state |
| primaryBright | #FF8C42 | #FB923C | gradient start, highlights on dark |
| navy | #0B1120 | #0B1120 | hero shadows, text on orange |
| background | #0D1117 | #F8F9FC | app background |
| card | #171E2B | #FFFFFF | cards |
| surface | #222B3A | #F1F3F8 | inputs, secondary keys |
| text | #FFFFFF | #111827 | primary text |
| textSecondary | #94A3B8 | #64748B | secondary text |
| success | #22C55E | #15803D | wins, positive rates |
| danger (wicket) | #F43F5E | #E11D48 | wickets, destructive |
| gold | #FBBF24 | #B45309 | sixes, champions |
| extra | #A78BFA | #6D28D9 | wides, no-balls, byes |
| border | #263041 | #E5E7EB | hairlines |

* `heat` = `[primaryBright, primary]`: the orange gradient, used only for primary buttons, the Play
  button, featured cards, the VS badge and progress fills.
* **Text on orange is navy (#0B1120)**, not white, for about 6.9:1 contrast in direct sunlight.
* Ball colours: dot = surfaceHigh, run = borderStrong, four = orange, six = gold, wicket = rose, extra = violet.

## Typography (`src/theme/tokens.ts`)
| Role | Font | Variants |
|---|---|---|
| Headings, navigation, titles | **Outfit** 600–900 | `h1` 30/34 ExtraBold, `h2` 21 Bold, `h3` 17 SemiBold, `overline`, `nav`; hero greeting 46 Black |
| Scores, overs, statistics, results | **Barlow Condensed** 600–800 | `hero` 84, `display` 60, `score` 44, `stat` 30, `statSmall` 21 |
| Body, fields, buttons | **Manrope** 400–800 | `body` 15, `bodyStrong`, `label` 13, `caption` 12; buttons ExtraBold |

All fonts are bundled locally (OFL). Text scales with the system font size, capped at 1.4×.

## Shape, spacing, depth
* Radius: sm 10 · md 16 · key 20 · lg 24 · xl 32 · pill. Cards are 24, sheets and dialogs 32.
* Spacing: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40.
* Depth comes from layered photography, gradient washes and team-colour splits, rather than heavy shadows.
  Featured cards get an orange wash and glow. The hero overlaps the first card (asymmetric layout).

## Imagery
21 graded photographs (Unsplash License, see `docs/ASSET_CREDITS.md`), 1080×2160 or 1800×1013 WebP:
a duotone floodlit splash, an orange-sky home hero, captains shaking hands for the head-to-head screen,
an aerial ground for match setup, gloves for the Playing XI, a ball in hand for the toss, a sunset stadium
for live scoring, helmet portraits for teams and players, a trophy for tournaments, a celebrating batter
for victory, and a floodlight tower for settings. Every photo sits under `ScreenBackground` (navy gradient
45% → 72% → 98%, plus optional `dim`). Empty states use original vector illustrations.

## Components
| Component | Purpose |
|---|---|
| `Button` | orange gradient primary with a sheen; secondary, ghost, danger, gold and glass variants |
| `Card` | `glass`, `featured` (orange wash), `accent` (side bar) |
| `TeamVersus` | animated head-to-head: crests slide in, a VS diamond springs in and pulses |
| `SplitColors` | diagonal team-colour split behind matchups |
| `ProgressBar` | animated innings, chase and win progress |
| `PhotoCard` | image-backed card with a readability gradient |
| `ConfirmDialog` / `confirmAlert` | themed replacement for system alerts |
| `TabBar` | floating glass bar, sliding orange pill, raised Play button |
| `Scoreboard`, `CreasePanel`, `OverTimeline`, `ScoringPad` | live scoring parts |
| `RollingNumber`, `CountUp`, `StatTile`, `MatchCard`, `PlayerCard`, `TeamBadge`, `EmptyState`, charts | shared building blocks |

## Motion
* Springs: `spring` (16/180) for UI, `bouncy` (11/160) for intros. Durations 160 / 260 / 420 ms.
* Signature moments: the VS intro, the coin flip, rolling score digits, the strike-glow handover, the
  over-complete banner, the FOUR burst, the SIX trajectory (Skia), falling stumps, milestone confetti and
  victory confetti.
* Every animation respects `useMotion()` ('full' | 'reduced' | 'off', following the system Reduce Motion
  setting by default). Celebration layers use `pointerEvents="none"`, so scoring is never blocked.

## Sound
Short, broadcast-style cues layered from three categories, each with its own toggle: **scoring** (bat, stumps, coin),
**crowd** (cheer, roar, groan, applause) and **celebration** (stings). Every event has its own identity:

| Event | Sequence | Haptics |
|---|---|---|
| Four | leather-on-willow crack → crowd cheer | boundary |
| Six | heavier crack + ball whoosh → crowd roar | six, success |
| Wicket | stumps clatter → fielding crowd erupts | wicket |
| Duck | stumps → crowd "awww" → low minor timpani sting (with the walking-duck card) | wicket, error |
| Hat-trick | stumps → rising timpani triplet + brass → roar | wicket, 2× boundary, success |
| Fifty / Century | brass sting → applause / roar | success |
| Innings | soft brass cadence → applause | success |
| Victory | brass fanfare → roar → applause (with trophy + confetti) | success ×2, boundary |
| Tournament | fireworks + fanfare → roar → applause | success, 2× six |
| Toss | coin flick → landing | tap, select |

A new moment replaces whatever is still playing, so layers never pile up.
