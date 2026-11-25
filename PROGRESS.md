# CricPilot: progress

_Last updated: 2026-11-24_

## Status summary
| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`, strict) | ✅ 0 errors |
| ESLint | ✅ 0 errors (about 20 warnings, all intentional dynamic inline styles) |
| Jest | ✅ 116 tests in 9 suites: engine, rules, random-match simulation, selectors/stats/analytics, tournaments, DB services on real SQLite, exporters, effects, validation |
| iOS simulator build (Debug and Release) | ✅ BUILD SUCCEEDED (Xcode 27.2, iPhone 18 Pro simulator) |
| Android build (Debug and Release, arm64) | ✅ BUILD SUCCESSFUL (pre-redesign code; see Known issues) |
| Maestro E2E | ⚠️ 8 flows written (`e2e/`), Maestro 2.12.1 installed to `~/.maestro`; see Known issues |

## Feature checklist
### Foundation
- [x] React Native 0.88.1 CLI, TypeScript strict, New Architecture, Hermes
- [x] Feature-based architecture (core / data / services / stores / features / components / theme)
- [x] Design system: tokens, dark and light themes, Outfit / Barlow Condensed / Manrope (bundled)
- [x] 21 graded, locally bundled WebP photographs (Unsplash License, credited)
- [x] Original logo, app icons (iOS 1024, Android mipmaps, round), native splash on both platforms
- [x] SQLite (op-sqlite) with migrations v1–v2; MMKV preferences; Android edge-to-edge; safe areas

### Scoring engine (pure TypeScript, event-sourced)
- [x] T10, T20, ODI, Test, custom formats; hard-ball and tape-ball presets
- [x] Wides, no-balls, byes, leg byes, penalties, configurable penalty values
- [x] All dismissal types with Laws-based validity (wide, no-ball, free hit); retired hurt/out, timed out, backing-up run out
- [x] Automatic strike rotation, end-of-over swap, caught-batter end rule, run-out ends
- [x] Free hits (carry over on wide/no-ball), bowler quotas, no consecutive overs, mid-over bowler change
- [x] Innings completion (all out, overs, target, declaration, manual), last man stands
- [x] Results (runs, wickets plus balls left, innings victories, ties, draws, no result, conceded), super overs (repeatable)
- [x] Test follow-on and fourth-innings targets; revised targets for interrupted matches
- [x] Undo, redo, historical corrections (rejected if they would invalidate later balls); atomic transactions; crash recovery

### App
- [x] Splash (animated logo over a duotone floodlit stadium) and three-page interactive onboarding (persisted)
- [x] Dashboard: cinematic hero, overlapping featured live/preview card, asymmetric stats, interactive leader bars, live, fixtures, tournaments, performers, results, teams
- [x] Head-to-head match setup: animated VS, split team colours, swap sides, saved or **temporary teams**, H2H record, quick start
- [x] Configure (format cards, overs chips, advanced rules), Playing XI (order, captain, keeper), animated toss, openers
- [x] Broadcast live scoring: hero score, progress bars, chase strip, batter cards with strike glow, bowler card, over chips, keypad, bottom sheets
- [x] Celebrations: four burst, six trajectory (Skia), falling stumps, 50/100 milestones, over banner, free-hit banner, victory confetti
- [x] Scorecards, analysis (Manhattan, worm, phases, partnerships, bowling, wagon wheel), ball-by-ball
- [x] Teams, players, profiles (career batting, bowling and fielding, form), swipe actions
- [x] Tournaments: league, knockout, league + knockout; fixtures; points table with NRR; animated bracket; manual tie-break
- [x] Leaderboards with podium, team records
- [x] PDF scorecard, CSV (scorecard, ball-by-ball, careers), shareable result image, JSON backup and restore
- [x] Settings: theme, animations (full / reduced / off, follows system), haptics, shot recording, data tools
- [x] Themed confirmation dialogs, toasts, empty-state illustrations, accessibility labels and test IDs

## Technical decisions
- **Event sourcing.** Match state is always `replay(events)`, which makes undo, redo and corrections exact and
  recovery automatic. Summaries and player stats are denormalised in the same transaction for fast lists.
- **The engine has no React Native dependency**, so it is fully unit-tested on Node (including an 8-seed random T20 simulation).
- **DB tests** run the real migrations and repositories on Node's built-in `node:sqlite` through the same `SqlDriver` interface.
- **Temporary teams** use an `is_temporary` flag (migration v2). Team names stay unique in SQLite, so a
  clashing quick-team name gets a suffix (for example "Night Owls · 2") rather than risking a table rebuild.
- **Charts and celebrations** use Skia; UI motion uses Reanimated; gradients use react-native-svg (no extra native module).
- **Text on orange is navy** for outdoor contrast.
- **Brand** is set in `theme/brand.ts`: the app is named CricPilot; backups from the interim name CricLedger are still accepted.
- **No network.** The release Android manifest has no INTERNET permission (debug keeps it for Metro).

## Visual QA (iOS simulator, Debug build, driven by Maestro)
Checked on device: splash, onboarding, home dashboard, head-to-head setup, quick teams, configure, Playing XI, toss.
Bugs found and fixed during QA:
- A worklet in the tab bar called a JS function, which crashed on launch in Release
- Translucent gradient stops (`rgba`) were drawn opaque, hiding all photography
- Full-bleed images rendered at their intrinsic size
- Sheet text inputs dropped keystrokes; iOS autocorrect rewrote names
- The quick-team picker race between sides; sheet content theming; progress-bar animation; onboarding page bleed

**Not yet re-verified on device:** live scoring, celebrations, innings break, victory, scorecard and other
screens after the redesign (the QA flow reached the toss step; the next run should start from
`toss-decision-bat`, whose cards render only after a toss winner is shown).

## Known issues / not verified here
- **Maestro runs:** flows are written but were not executed end to end in this session. Running them needs a booted
  simulator or emulator with the Release build installed: `~/.maestro/maestro/bin/maestro test e2e/`.
  Homebrew could not install Maestro because the Mac's Command Line Tools don't support macOS 27; the
  official zip install works.
- **Airplane mode:** Android flows toggle it with `setAirplaneMode`. iOS simulators can't, so disable
  the Mac's network instead. The release Android build has no network permission at all.
- **Android emulator:** no AVD exists on this machine, so the APK was built but not launched.
- **Android release after the redesign:** rebuild with `cd android && ./gradlew assembleRelease`.
  The last release build predates the redesign; the Gradle and native setup are unchanged.
- **Release signing:** Android release uses the debug keystore from the template. Configure a real keystore before publishing.
- **DLS:** revised targets are entered by hand; no DLS calculator.
- **Photos:** some stadium photos show small advertising boards (dimmed). Review before a store release.
