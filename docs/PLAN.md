# CricPilot — Implementation Plan

## Environment (inspected 2026-11-24)
macOS 27.0.1 on Apple M2 Pro · Node 24.21 · npm 11.19 · Xcode 27.2 · CocoaPods 1.17 ·
JDK 17 · Android SDK platforms 34–37, NDK 27/30 · iOS simulators (iPhone 17 family) ·
no Android AVD found · Maestro and Yarn not installed (Maestro installed later; see PROGRESS.md).

## Stack (versions checked for compatibility)
| Library | Version | Why |
|---|---|---|
| react-native | 0.88.1 | latest stable; New Architecture only |
| react | 19.3.0 | pinned by RN |
| react-native-reanimated | 4.8.0 | peer RN 0.87–0.89, worklets 0.14.x |
| react-native-worklets | 0.14.0 | matches Reanimated 4.8 |
| react-native-gesture-handler | 3.5.0 | |
| @shopify/react-native-skia | 2.14.0 | needs Reanimated ≥ 4 and worklets ≥ 0.7 |
| @gorhom/bottom-sheet | 5.2.14 | Reanimated 4 support |
| @op-engineering/op-sqlite | 19.0.6 | |
| react-native-mmkv | 4.3.2 + nitro-modules 0.37.2 | |
| @react-navigation/* | 7.x | native-stack + bottom-tabs |
| zustand | 5.1.0 | |
| react-native-haptic-feedback | 3.0.0 | |
| react-native-html-to-pdf | 1.3.0 | PDF scorecards (TurboModule) |
| react-native-view-shot | 6.2.1 | result share cards |
| react-native-share | 12.3.1 | native share sheet |
| @dr.pogodin/react-native-fs | 2.41.0 | CSV, backup and PDF files |
| @react-native-documents/picker | 12.1.0 | choose a backup file to restore |
| react-native-bootsplash | 7.4.0 | native splash screens on iOS and Android |
| react-native-svg | 15.16.1 | logo, illustrations, team crests |

## Phases
1. **Foundation:** project, fonts, assets, theme, navigation shell, MMKV, DB plus migrations.
2. **Scoring engine:** types, rules presets, validation, replay, results and statistics, with exhaustive Jest tests.
3. **Data layer:** repositories, match service (atomic commit, undo/redo, corrections, recovery), Jest tests on `node:sqlite`.
4. **Core UI:** splash, onboarding, dashboard, teams, players.
5. **Match flow:** create match → Playing XI → toss → openers → live scoring with bottom sheets → innings break → result.
6. **Celebrations:** boundary, six trajectory, falling stumps, milestones, over transition, confetti.
7. **Scorecards and analytics:** scorecard, partnerships, Manhattan, worm, wagon wheel, player and team stats, leaderboards.
8. **Tournaments:** league / knockout / league + knockout, fixture generation, points table and NRR, animated bracket.
9. **Export:** PDF scorecard, CSV, share image, backup and restore.
10. **Settings, accessibility and performance.**
11. **Quality:** tsc, ESLint, Jest, Maestro flows, iOS and Android builds.

## Feature completion checklist
Kept up to date in `PROGRESS.md`.
