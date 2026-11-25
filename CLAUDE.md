# CricPilot: guide for contributors and AI agents

Offline cricket scoring app built with React Native CLI 0.88 (New Architecture only) and strict TypeScript.
Tagline: *Every ball. Every moment.* There is no backend, no auth and no network use; all data lives on the device.

## Commands
| Task | Command |
|---|---|
| Install | `npm install` then `cd ios && pod install` |
| Run | `npm start`, then `npm run ios` / `npm run android` |
| Type check | `npx tsc --noEmit` |
| Lint | `npx eslint . --ext .ts,.tsx` |
| Unit tests | `npx jest` (engine, rules, stats, tournaments, DB on `node:sqlite`) |
| E2E | `maestro test e2e/` (needs a running build; app id `com.cricpilot`) |
| Regenerate sounds | `scripts/build-sounds.py <sources>` |
| Regenerate photos | `scripts/process-photos.py` (see docs/ASSET_CREDITS.md) |
| Regenerate logo/icons | `scripts/generate-brand.py`, then `npx react-native-bootsplash generate src/assets/brand/splash-logo.png --platforms=android,ios --background=080F1F --logo-width=120 --assets-output=src/assets/bootsplash` |

## Architecture (feature-based, layered)
```
src/
  core/            PURE TypeScript (no React Native imports; 100% unit-testable)
    engine/        event-sourced scoring engine: types, rules, engine (replay), selectors, stats, analytics
    tournament/    fixtures (round robin, knockout, league + KO), points table, NRR
    utils/         input validation
  data/
    db/            SqlDriver interface, op-sqlite driver, migrations (PRAGMA user_version)
    repositories/  SQL only: teams, players, matches/events/stats, tournaments, backup
    storage/       MMKV preferences (never match data)
  services/        orchestration and transactions: matchService (atomic scoring), tournamentService,
                   teamService, dashboardService, exporters (pure HTML/CSV), fileService (native IO), haptics
  stores/          zustand: settings, app (data version + toasts), scoring (queued writes + effects)
  theme/           tokens, colours (dark/light), typography, images, ThemeProvider, brand
  components/      reusable UI (cards, buttons, scoreboard parts, charts, sheets, empty states)
  features/<name>/ screens and feature-specific components
  app/             navigation and error boundary
```
Data flow: **UI → store → service → (transaction) repository + engine → SQLite**. Screens never write SQL.

## Scoring engine rules of thumb
- The source of truth is the **event log** (`match_events`). State is always `replay(setup, events)`.
- Every write (`matchService.record/undo/redo/correct`) runs in **one transaction**: validate by replay →
  write → replay → store summary + `player_match_stats` → tournament sync. If any step throws, nothing is written.
- New event types need: a type in `types.ts`, a handler in `engine.ts`, validation, docs in
  `docs/SCORING_RULES.md` and unit tests. Never compute statistics in the UI; add them to `selectors`, `stats` or `analytics`.
- The engine throws `EngineError(code, message)`; messages are shown to scorers, so write them for people.
- Statistics come only from validated events. Super overs are excluded from career figures.
- Full rules: **docs/SCORING_RULES.md**. Database: **docs/DATABASE.md**. Design: **docs/DESIGN_SYSTEM.md**.

## Development standards
- Strict TS, no `any` in app code. Keep `core/` free of React Native imports.
- Use theme tokens (`spacing`, `radius`, `typography`, `useTheme().colors`); no hard-coded colours except on
  fixed-dark media (victory card, celebrations).
- Text: `AppText` (respects font scale, capped at 1.4×). Touch targets ≥ 48 dp. Give every interactive element
  an `accessibilityLabel` and a `testID` if E2E tests use it.
- Animations: Reanimated/Skia only; respect `useMotion()` ('full' | 'reduced' | 'off'). Celebration layers must
  use `pointerEvents="none"`, and scoring must never wait on an animation.
- Lists: `FlatList` with stable keys; no components defined inside render (`components/Separator.tsx`).
- Errors: services throw `ValidationError` / `ScoringError`; screens show them with `toast()`.
- After changing data, call `bumpData()` (services do this) so `useAsync` screens reload.
- Tests: add Jest tests for any engine, rules, stats or repository change. Run tsc, ESLint and Jest before finishing.

## Sound & haptics
- `src/services/sound/cues.ts` is the pure sound design: sound files → categories (scoring / crowd / celebration),
  cue definitions (layers, offsets, synced haptics) and `planCues(effects)`, which turns one ball's effects into a single
  non-overlapping sequence (hat-trick > duck > wicket > six > four, then milestone, then innings). Unit-tested.
- `src/services/sound/SoundManager.ts` (react-native-audio-api): preloads and decodes every MP3 at start-up, schedules layers
  on the audio clock, cancels and fades the previous moment, ignores duplicates within 300 ms, obeys the category toggles and
  volume, uses the iOS `ambient` session (silent switch, mixes with music) and suspends in the background.
- Sounds fire only from `scoringStore.record()` (fresh events). Undo, redo, corrections and opening a match never call it.
  The result screen plays victory/tournament only with `route.params.celebrate`.
- Rebuild the audio with `scripts/build-sounds.py` (sources and licences in docs/ASSET_CREDITS.md).

## Gotchas
- RN 0.88: `StatusBar` has no `translucent`/`backgroundColor` (edge-to-edge by default); `View` refs are `ReactNativeElement`.
- Skia 2.x paths are immutable: build them with `Skia.PathBuilder.Make()…detach()`.
- MMKV v4 is Nitro based: `createMMKV()`, `remove()` (not `delete`).
- `react-native-worklets/plugin` must be the last Babel plugin.
- Brand name is in `src/theme/brand.ts` (the brief mentioned both "CricPilot" and "CricLedger"; CricPilot was chosen to match the project).
