<div align="center">

<img src="src/assets/brand/logo-1024.png" alt="CricPilot logo" width="128" height="128" />

# CricPilot

### *Every ball. Every moment.*

**An offline-first cricket scoring app with broadcast-style live scoring, deep match analytics and full tournaments, all stored on your device.**

<p>
  <img alt="React Native" src="https://img.shields.io/badge/React_Native-0.88-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=0B1120" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0B1120" />
  <img alt="New Architecture" src="https://img.shields.io/badge/New_Architecture-Hermes-FF6B00?style=for-the-badge&labelColor=0B1120" />
</p>
<p>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-iOS_%7C_Android-FF8C42?style=flat-square&labelColor=171E2B" />
  <img alt="Offline" src="https://img.shields.io/badge/network-none,_100%25_offline-22C55E?style=flat-square&labelColor=171E2B" />
  <img alt="Tests" src="https://img.shields.io/badge/jest-128_tests-FBBF24?style=flat-square&logo=jest&logoColor=white&labelColor=171E2B" />
  <img alt="Storage" src="https://img.shields.io/badge/storage-SQLite_+_MMKV-A78BFA?style=flat-square&labelColor=171E2B" />
</p>

<img src="src/assets/images/bg_home_panorama.webp" alt="Floodlit cricket stadium" width="100%" />

[Features](#-features) · [Getting started](#-getting-started) · [Architecture](#-architecture) · [Scoring engine](#-the-scoring-engine) · [Testing](#-testing) · [Docs](#-documentation)

</div>

---

## ✨ Highlights

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>🏏 Broadcast scoring</h3>
      Hero score, chase strip, batter cards with a strike glow, over chips and a one-thumb keypad. Every extra, every dismissal, every Law.
    </td>
    <td width="33%" valign="top">
      <h3>📊 Deep analytics</h3>
      Manhattan, worm, phase breakdowns, partnerships, wagon wheel and ball-by-ball, all drawn with Skia.
    </td>
    <td width="33%" valign="top">
      <h3>🏆 Tournaments</h3>
      League, knockout or league + knockout with fixtures, a live points table, NRR and an animated bracket.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h3>↩️ Undo anything</h3>
      An event-sourced engine makes undo, redo and historical corrections exact, with automatic crash recovery.
    </td>
    <td width="33%" valign="top">
      <h3>🎆 Celebrations</h3>
      Four bursts, six trajectories, falling stumps, milestones and victory confetti, with layered sound and haptics.
    </td>
    <td width="33%" valign="top">
      <h3>🔒 Private by design</h3>
      No backend, no account, no tracking. The release Android build doesn't even request internet access.
    </td>
  </tr>
</table>

---

## 🎯 Features

<details open>
<summary><b>Scoring engine</b> (pure TypeScript, event-sourced)</summary>

- **Formats:** T10, T20, ODI, Test and custom; hard-ball and tape-ball presets
- **Extras:** wides, no-balls, byes, leg byes and penalties, with configurable values
- **Dismissals:** every type, validated against the Laws (wide, no-ball, free hit); retired hurt/out, timed out, backing-up run out
- **Match flow:** automatic strike rotation, end-of-over swap, caught-batter end rule, free hits, bowler quotas, mid-over bowler change
- **Results:** runs, wickets + balls left, innings victories, ties, draws, no result, concessions and repeatable **super overs**
- **Tests:** follow-on, fourth-innings targets and revised targets for interrupted matches
- **Corrections:** undo, redo and historical edits, rejected if they would invalidate later balls

</details>

<details>
<summary><b>Match day</b></summary>

- Animated splash and a three-page interactive onboarding
- Cinematic dashboard: live and featured matches, fixtures, leaders, results and teams
- Head-to-head setup with an animated VS, split team colours, saved or **temporary** teams and a quick start
- Format cards, Playing XI (order, captain, keeper), an animated toss and opener selection
- Scorecards, analysis and ball-by-ball views for every innings

</details>

<details>
<summary><b>Teams, players and stats</b></summary>

- Team and player management with swipe actions
- Player profiles with career batting, bowling, fielding and form
- Leaderboards with a podium, plus team records
- Statistics come only from validated events; super overs are excluded from career figures

</details>

<details>
<summary><b>Sharing and data</b></summary>

- PDF scorecards, CSV exports (scorecard, ball-by-ball, careers) and a shareable result image
- JSON backup and restore
- Settings for theme (dark/light), animations (full / reduced / off, following the system), haptics, sound categories and volume

</details>

---

## 🚀 Getting started

> **Prerequisites:** Node 20+, Xcode (iOS), Android Studio + JDK 17 (Android), CocoaPods via Ruby bundler.
> See the React Native [environment setup guide](https://reactnative.dev/docs/set-up-your-environment).

```sh
# 1. Install dependencies
npm install
cd ios && bundle install && bundle exec pod install && cd ..

# 2. Start Metro
npm start

# 3. Run on a device or simulator (in a second terminal)
npm run ios
npm run android
```

### Useful commands

| Task | Command |
|---|---|
| 🔎 Type check | `npx tsc --noEmit` |
| 🧹 Lint | `npx eslint . --ext .ts,.tsx` |
| 🧪 Unit tests | `npx jest` |
| 📱 E2E tests | `maestro test e2e/` (needs a running build, app id `com.cricpilot`) |
| 🔊 Rebuild sounds | `scripts/build-sounds.py <sources>` |
| 🖼️ Rebuild photos | `scripts/process-photos.py` |
| 🎨 Rebuild logo and icons | `scripts/generate-brand.py`, then `react-native-bootsplash generate` (see [CLAUDE.md](CLAUDE.md)) |

---

## 🧱 Architecture

A feature-based, layered codebase. Data flows one way:

```
   UI  ──▶  store (zustand)  ──▶  service  ──▶  [ transaction ]  repository + engine  ──▶  SQLite
```

Screens never write SQL, and the `core/` layer never imports React Native.

```
src/
├── core/           Pure TypeScript, 100% unit-testable
│   ├── engine/     event-sourced scoring: types, rules, replay, selectors, stats, analytics
│   ├── tournament/ fixtures (round robin, knockout, league + KO), points table, NRR
│   └── utils/      input validation
├── data/
│   ├── db/         SqlDriver interface, op-sqlite driver, migrations (PRAGMA user_version)
│   ├── repositories/ teams, players, matches, events, stats, tournaments, backup
│   └── storage/    MMKV preferences (never match data)
├── services/       orchestration: atomic scoring, tournaments, exporters, files, sound, haptics
├── stores/         zustand: settings, app (data version + toasts), scoring
├── theme/          tokens, colours, typography, images, brand
├── components/     reusable UI: cards, buttons, scoreboard parts, charts, sheets
├── features/       home · matches · scoring · scorecard · stats · teams · players · tournaments · settings …
└── app/            navigation and error boundary
```

### Tech stack

| Area | Library |
|---|---|
| Framework | React Native 0.88 (New Architecture, Hermes), React 19 |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| State | Zustand 5 |
| Database | op-sqlite (with migrations) |
| Preferences | react-native-mmkv 4 (Nitro) |
| Graphics and motion | React Native Skia 2, Reanimated 4, react-native-svg |
| Sound and haptics | react-native-audio-api, react-native-haptic-feedback |
| Sharing | react-native-html-to-pdf, react-native-view-shot, react-native-share |

---

## ⚙️ The scoring engine

The **event log is the source of truth.** Match state is always:

```ts
state = replay(setup, events)
```

Every write (`record`, `undo`, `redo`, `correct`) runs inside **one SQLite transaction**:

```
validate by replay ─▶ write event ─▶ replay ─▶ store summary + player stats ─▶ sync tournament
```

If any step throws, nothing is written. This makes undo and corrections exact, keeps statistics consistent, and lets a crashed match resume from exactly where it stopped.

The full rule set lives in [`docs/SCORING_RULES.md`](docs/SCORING_RULES.md).

---

## 🧪 Testing

| Layer | Tooling | Coverage |
|---|---|---|
| Engine, rules, stats, analytics | Jest | Unit tests plus a seeded random T20 simulation |
| Tournaments | Jest | Fixtures, points table, NRR |
| Database and services | Jest on Node's built-in `node:sqlite` | Real migrations and repositories through the same `SqlDriver` |
| Exporters, effects, validation | Jest | Pure HTML/CSV output, sound cue planning |
| End to end | [Maestro](https://maestro.mobile.dev) | Onboarding, teams, scoring, extras/undo, recovery, tournaments, offline, quick match, sound |

---

## 🎨 Design

**"Night match, orange heat."** Midnight navy surfaces, warm white type and an orange accent used only where it matters. Scores are set in tall broadcast numerals.

<p>
  <img alt="primary" src="https://img.shields.io/badge/primary-%23FF6B00-FF6B00?style=flat-square" />
  <img alt="navy" src="https://img.shields.io/badge/navy-%230B1120-0B1120?style=flat-square" />
  <img alt="card" src="https://img.shields.io/badge/card-%23171E2B-171E2B?style=flat-square" />
  <img alt="success" src="https://img.shields.io/badge/success-%2322C55E-22C55E?style=flat-square" />
  <img alt="wicket" src="https://img.shields.io/badge/wicket-%23F43F5E-F43F5E?style=flat-square" />
  <img alt="gold" src="https://img.shields.io/badge/gold-%23FBBF24-FBBF24?style=flat-square" />
  <img alt="extra" src="https://img.shields.io/badge/extra-%23A78BFA-A78BFA?style=flat-square" />
</p>

Typefaces: **Outfit** (display), **Barlow Condensed** (scores) and **Manrope** (body), all bundled under the OFL.
Accessibility is built in: text respects the system font scale (capped at 1.4×), touch targets are at least 48 dp, and every animation honours the reduced-motion setting.

---

## 📚 Documentation

| Document | What's inside |
|---|---|
| [`docs/SCORING_RULES.md`](docs/SCORING_RULES.md) | Every scoring rule the engine implements |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema, migrations and transactions |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Colours, typography, components and motion |
| [`docs/ASSET_CREDITS.md`](docs/ASSET_CREDITS.md) | Photo, font and sound sources and licences |
| [`PROGRESS.md`](PROGRESS.md) | Build status, feature checklist and known issues |
| [`CLAUDE.md`](CLAUDE.md) | Contributor guide and coding standards |

---

<div align="center">

**CricPilot** · every ball, every moment, on your device.

<sub>Photography under the Unsplash License · fonts under the SIL Open Font License · see <a href="docs/ASSET_CREDITS.md">asset credits</a></sub>

</div>
