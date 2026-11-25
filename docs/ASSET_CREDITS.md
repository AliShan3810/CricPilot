# Asset credits & licences

## Photography (bundled as WebP in `src/assets/images`)
All photos are from Unsplash under the **Unsplash License**: free for commercial and
non-commercial use, no permission or attribution required (attribution given anyway).
Unsplash+ (paid licence) images were deliberately excluded. Photos were cropped and
re-encoded by `scripts/process-photos.py`; the originals are not modified otherwise.

| File | Use | Unsplash photo |
|---|---|---|
| bg_splash_stadium.webp | Splash: floodlit night stadium, graded navy/orange | https://unsplash.com/photos/crowded-cricket-stadium-under-night-floodlights-DjQw6mt4YEM |
| bg_home_panorama.webp | Home hero: floodlit stadium at night | https://unsplash.com/photos/crowd-of-people-sitting-on-stadium-seats-bY4cqxp7vos |
| onboard_1_batter.webp | Onboarding 1: batter driving the ball | https://unsplash.com/photos/cricket-batsman-hitting-ball-on-field-dE3exzmYlKc |
| onboard_2_stadium.webp | Onboarding 2: packed stadium under lights | https://unsplash.com/photos/a-cricket-stadium-is-filled-with-spectators-at-night-uplPFLDsn84 |
| onboard_3_ball.webp | Onboarding 3: red ball in the grass | https://unsplash.com/photos/shallow-focus-photography-of-red-cricket-ball-oDs_AxeR5g4 |
| bg_matchup.webp | Head-to-head: captains shaking hands | https://unsplash.com/photos/cricket-players-shaking-hands-on-field-i63FfZJN5Fs |
| bg_aerial_ground.webp | Match setup: aerial view of an oval ground | https://unsplash.com/photos/aerial-view-of-a-city-with-a-large-oval-stadium-Pk464ATFHxw |
| bg_xi_gloves.webp | Playing XI: padding up in the nets | https://unsplash.com/photos/a-man-in-cricket-gear-adjusts-his-batting-gloves-indoors-5SJN8sBJtJg |
| bg_toss_ball.webp | Toss: a hand balancing the ball | https://unsplash.com/photos/a-hand-balances-a-cricket-ball-1Ls6HxVr5fM |
| bg_pitch.webp | Scorecard and texture: pitch, stumps and creases | https://unsplash.com/photos/a-cricket-field-with-a-bat-and-ball-on-it-p8BO9zThWV8 |
| bg_scoring_stadium.webp | Live scoring: stadium at sunset | https://unsplash.com/photos/a-modern-cricket-stadium-with-empty-seats-at-sunset-0eqcfjZlVKQ |
| bg_teams_helmet.webp | Teams: batter in a helmet | https://unsplash.com/photos/a-young-man-wearing-a-cricket-helmet-and-white-uniform-coXSwcAW0O0 |
| bg_player.webp | Player profiles: helmet profile | https://unsplash.com/photos/cricketer-in-a-dark-helmet-on-a-sunny-field-Ysmv55PONTo |
| bg_tournament_trophy.webp | Tournaments: trophy on the outfield | https://unsplash.com/photos/a-trophy-sitting-on-top-of-a-lush-green-field-E_OVdx3dbnU |
| bg_tournament_stadium.webp | Tournament detail: wide stadium view | https://unsplash.com/photos/a-wide-view-of-a-cricket-stadium-with-green-field-AInWsdrHmJ4 |
| bg_victory.webp | Victory and milestones: raising helmet and bat | https://unsplash.com/photos/cricket-player-celebrating-on-field-WU2OIQjTevQ |
| bg_history_batter.webp | Match history: batter mid-shot | https://unsplash.com/photos/cricket-batsman-swinging-wooden-bat-U-3UNrYLjIs |
| bg_stats_crowd.webp | Leaderboards: stadium under a red evening sky | https://unsplash.com/photos/cricket-stadium-under-red-evening-sky-K3cI9zl79Bg |
| bg_settings_floodlight.webp | Settings: floodlight tower | https://unsplash.com/photos/bright-stadium-lights-illuminate-a-cloudy-evening-sky-nMivg2zAAG4 |
| bg_bat_wall.webp | Team/player forms: bat against a wall | https://unsplash.com/photos/cricket-bat-leaning-against-a-stone-wall-KGrQ_DNABik |

Notes: some stadium photos contain small third-party advertising boards. They are dimmed
under overlays and are not used to imply endorsement; swap them before a store release
if your legal review prefers logo-free imagery. Football World Cup trophy photos were deliberately excluded; the tournament trophy
photo is a generic cup on a cricket outfield. Some images are colour-graded
(`warm` split tone or a navy/orange `duotone`) by `scripts/process-photos.py` to match the brand.

## Sound effects (bundled as MP3 in `src/assets/sounds`, built by `scripts/build-sounds.py`)
Sources were downloaded from OpenGameArt.org; the licence was checked on each page. Every sound is
trimmed, layered, normalised and faded in the build script. Stings, timpani, cymbal swells, the coin
flick and the ball whoosh body are synthesised in that script (original work).

| Source | Author | Licence | Used in |
|---|---|---|---|
| [Free Crowd Cheering Sounds](https://opengameart.org/content/free-crowd-cheering-sounds) | Gregor Quendel | **CC-BY 4.0** (attribution required) | crowd_cheer, crowd_roar, crowd_wicket, crowd_groan (pitch-bent and filtered) |
| [Coin Sounds](https://opengameart.org/content/coin-sounds-0) | hjm, submitted by Varkalandar | **CC-BY 3.0** (attribution required) | coin_toss (landing) |
| [Applause in a large hall or church](https://opengameart.org/content/applause-in-a-large-hall-or-church) | eXpl0it3r | CC0 | applause |
| [100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx) | rubberduck | CC0 | bat_four, bat_six, stumps |
| [25 CC0 bang / firework SFX](https://opengameart.org/content/25-cc0-bang-firework-sfx) | rubberduck | CC0 | sting_tournament fireworks |
| [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | artisticdude | CC0 | ball_whoosh (slowed layer) |
| [Classic fanfare lick](https://opengameart.org/content/classic-fanfare-lick) | fvcalderan | CC0 | sting_milestone, sting_century |

The CC-BY attributions are also shown in the app (Settings → About → Credits).

## Fonts (`src/assets/fonts`, licences in `docs/licenses`)
- Manrope: SIL Open Font License 1.1 (static weights instanced from the official variable font)
- Barlow Condensed: SIL Open Font License 1.1
- Outfit: SIL Open Font License 1.1 (600/700/800/900 instanced from the official variable font)

## Logo, icons, illustrations
The CricLedger mark, app icons, splash logo, line icons, team crests and empty-state
illustrations are original work made for this project (`scripts/generate-brand.py`,
`src/components/Icon.tsx`, `src/components/EmptyState.tsx`).
