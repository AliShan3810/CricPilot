# CricPilot — Cricket Scoring Rules

This is the rulebook the scoring engine (`src/core/engine`) follows. It is based
on the MCC Laws of Cricket (2017 Code, 3rd edition 2022), with local rules that
can be changed per match. Every rule listed here has a unit test in
`src/core/engine/__tests__`.

## 1. Match configuration (`MatchRules`)

| Field | Meaning | T10 | T20 | ODI | Test | Custom |
|---|---|---|---|---|---|---|
| `oversPerInnings` | overs per innings (`null` = unlimited) | 10 | 20 | 50 | null | user |
| `inningsPerSide` | 1 (limited overs) or 2 (Test) | 1 | 1 | 1 | 2 | 1/2 |
| `ballsPerOver` | legal balls per over | 6 | 6 | 6 | 6 | 4–8 |
| `playersPerSide` | players per team (2–11) | 11 | 11 | 11 | 11 | user |
| `maxOversPerBowler` | bowling cap (`null` = none) | 2 | 4 | 10 | null | user |
| `wideRuns` / `noBallRuns` | penalty for a wide or no-ball | 1 | 1 | 1 | 1 | user |
| `freeHit` | the ball after a no-ball is a free hit | yes | yes | yes | no | user |
| `lastManStands` | the last batter may bat alone | no | no | no | no | user |
| `superOverOnTie` | a tie can go to a super over | yes | yes | yes | n/a | user |
| `followOnMargin` | lead needed to enforce the follow-on | – | – | – | 200 | user |
| `lbwAllowed` | LBW dismissals allowed | yes | yes | yes | yes | user |
| `legByesAllowed` | leg byes allowed | yes | yes | yes | yes | user |

**Ball type presets.** *Hard ball* uses the Laws as written. *Tape ball* (local
street/club cricket) defaults to: no LBW, no leg byes, free hit on every no-ball,
and last-man-stands available. Each of these can still be changed one by one.

## 2. Events

A match is an **append-only list of events**. The match state is never stored as
the source of truth. It is always rebuilt by replaying the events through the
engine (`replay()`), so the same events always give the same scorecard.

| Event | When |
|---|---|
| `START_INNINGS` | batting team, two openers, opening bowler |
| `DELIVERY` | every ball bowled, including wides and no-balls |
| `SET_BOWLER` | start of each over, or replacing an injured bowler mid-over |
| `NEW_BATTER` | after a wicket or retirement |
| `NON_DELIVERY_DISMISSAL` | retired hurt, retired out, timed out, run out (non-striker backing up) |
| `SWAP_STRIKE` | manual correction of who is on strike |
| `PENALTY` | 5 penalty runs to either side (Law 41) |
| `REVISE_TARGET` | interrupted match: new target and overs (entered by hand; no DLS calculation) |
| `DECLARE` | Test declaration |
| `END_INNINGS` | manual end (e.g. no fit batters left) |
| `START_SUPER_OVER` | after a tie, when super overs are on |
| `END_MATCH` | draw, abandoned / no result, or conceded |

## 3. Deliveries

A `DELIVERY` stores `kind` (`legal` | `wide` | `noBall`), `batRuns`, `byes`,
`legByes`, `wideRuns` (runs taken on a wide, not counting the penalty),
`boundary` (4 | 6 | null), an optional `wicket`, and an optional `shot`
(wagon-wheel angle and distance).

### Runs credited

| Delivery | Team | Batter | Bowler conceded | Extras |
|---|---|---|---|---|
| Legal, bat runs `r` | r | r | r | – |
| Legal, byes `b` | b | 0 | 0 | byes b |
| Legal, leg byes `l` | l | 0 | 0 | leg byes l |
| Wide + `w` run | wideRuns + w | 0 | wideRuns + w | wides wideRuns + w |
| No-ball + bat `r` | noBallRuns + r | r | noBallRuns + r | no-balls noBallRuns |
| No-ball + byes `b` | noBallRuns + b | 0 | noBallRuns | nb noBallRuns, byes b |
| No-ball + leg byes `l` | noBallRuns + l | 0 | noBallRuns | nb noBallRuns, lb l |

* **Balls faced:** legal deliveries and no-balls count; wides do not (Law 21.5 / 22).
* **Legal balls:** only `legal` deliveries count toward the over.
* **Dot ball (bowler):** a legal delivery on which the bowler concedes 0 runs.
* **Fours and sixes** are counted only when `boundary` is set. Four runs that are run do not count as a four.
* A delivery can carry only one kind of run: bat runs, byes or leg byes.

### Strike rotation (Law 18)
* `runsRun` = runs physically completed: bat runs + byes + leg byes + wide runs,
  **except** that boundaries count as 0 (the batters stay where they are, even if they crossed).
* An odd `runsRun` swaps the strike.
* At the end of an over (legal ball count reaches `ballsPerOver`), the strike swaps again.
* `SWAP_STRIKE` corrects it by hand.

### Free hit (Law 21.19 equivalent playing condition)
* When `freeHit` is on, the delivery after a no-ball is a free hit.
* If the free-hit delivery is a wide or a no-ball, the next delivery is a free hit too.
* On a free hit the batter can be out only by: run out, obstructing the field, or hit the ball twice.

## 4. Dismissals (Laws 32–40)

| Type | Bowler credited | Allowed on wide | Allowed on no-ball | Allowed on free hit |
|---|---|---|---|---|
| Bowled | yes | no | no | no |
| Caught | yes | no | no | no |
| LBW (if `lbwAllowed`) | yes | no | no | no |
| Stumped | yes | **yes** | no | no |
| Hit wicket | yes | **yes** | no | no |
| Run out | no | yes | yes | yes |
| Obstructing the field | no | yes | yes | yes |
| Hit the ball twice | no | no | yes | yes |
| Retired out | no | – (non-delivery) | | |
| Timed out | no | – (non-delivery) | | |
| Retired hurt | **not a wicket**, the batter may return | | | |

* Caught, stumped and run out may name a fielder. A caught and bowled is a caught with fielder = bowler.
* **Who comes in where (Law 18.11):** after a catch, the new batter takes the striker's
  end. After a run out, the scorer says which end the out batter was at, and the
  completed runs count. For every other dismissal the new batter replaces the out batter.
* Runs completed before a run out count. A batter who is stumped or caught scores nothing on that ball.
* **Fall of wicket** records the team score, wicket number, over.ball and the batter out.

## 5. Overs and bowlers
* Over `n.b` shows completed overs and legal balls in the current over.
* A bowler cannot bowl two overs in a row (Law 17.8).
* `maxOversPerBowler` is enforced when the next bowler is chosen.
* **Maiden:** a complete over by one bowler in which that bowler concedes 0 runs (byes and leg byes do not count against the bowler).
* A bowler can be replaced mid-over (`SET_BOWLER` with `midOver: true`). Each bowler is credited with their own balls, and the replacement cannot be the bowler of the previous over.

## 6. Innings completion
An innings ends when one of these happens:
1. **All out:** wickets reach `playersPerSide − 1` (or `playersPerSide` with last man stands), or no batter is left to come in.
2. **Overs complete:** legal balls reach `oversPerInnings × ballsPerOver`.
3. **Target reached:** the side batting last passes the target.
4. **Declared** (Test).
5. **Manual `END_INNINGS`.**

With last man stands on, a single remaining batter bats alone: there is no
non-striker, the strike never changes, and run outs are only possible at the striker's end.

## 7. Targets and results
* **Limited overs:** target = first-innings total + 1, unless `REVISE_TARGET` sets it.
* **Test:** the side batting fourth needs (opponent's total − its own total + 1).
* **Follow-on:** after the second innings, if the side batting first leads by at least
  `followOnMargin`, its captain may make the other side bat again (`START_INNINGS`
  with the trailing team).
* **Results:**
  * Chasing side passes the target → *won by N wickets* (with *M balls left* in limited overs).
  * Side batting first defends → *won by N runs*.
  * Equal scores with all innings complete → *tie* → super over (if on) or a tie.
  * Test: a side bowled out twice for less than the opponent's single innings → *won by an innings and N runs*.
  * Test not finished → `END_MATCH` draw. Any format → `END_MATCH` no result / abandoned.
* **Super over:** 1 over, a maximum of 2 wickets. The side that batted second in the
  previous innings pair bats first. A tied super over can be followed by another one.

## 8. Run rates and NRR
* Current run rate = runs ÷ (legal balls ÷ ballsPerOver).
* Required run rate = runs needed ÷ (balls left ÷ ballsPerOver).
* **Net run rate (tournaments):** (total runs scored ÷ total overs faced) − (total runs
  conceded ÷ total overs bowled). A side that is all out counts as having faced its full
  quota of overs. Overs use real ball counts (e.g. 19.3 = 19.5 overs). Super overs are not counted.
* **Points:** win 2, tie / no result 1, loss 0 (configurable per tournament).

## 9. Undo, redo and corrections
* **Undo** marks the last active event as undone and pushes it onto the redo stack.
* **Redo** re-applies the most recent undone event, if it still passes validation.
* Recording a new event **clears** the redo stack.
* **Historical correction** edits a past `DELIVERY` (runs, extras, wicket, shot). The full log
  is replayed; if any later event is no longer valid (for example, the corrected ball now ends
  the innings), the correction is **rejected** with the reason and nothing is changed.
* Every change runs in one SQLite transaction: write the event, replay, and update the
  stored match summary and player statistics.
