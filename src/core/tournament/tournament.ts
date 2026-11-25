/**
 * Tournament logic: fixture generation, knockout brackets, points tables and net run rate.
 * Pure functions with no I/O.
 */

export type TournamentFormat = 'league' | 'knockout' | 'leagueKnockout';
export type FixtureStage = 'league' | 'quarterFinal' | 'semiFinal' | 'final' | 'knockout';

export interface FixtureDraft {
  key: string;
  stage: FixtureStage;
  round: number;
  slot: number;
  teamAId: string | null;
  teamBId: string | null;
  /** key of the fixture the winner goes to */
  nextKey: string | null;
  nextSlot: 'a' | 'b' | null;
  /** knockout placeholder labels, e.g. "1st in table" */
  labelA?: string;
  labelB?: string;
}

/**
 * Round robin by the circle method: every team plays every other team once
 * (or twice with `double`). A bye is added when the number of teams is odd.
 */
export function roundRobin(teamIds: string[], double = false): FixtureDraft[] {
  if (teamIds.length < 2) {
    throw new Error('A league needs at least 2 teams.');
  }
  const teams: Array<string | null> = [...teamIds];
  if (teams.length % 2 === 1) {
    teams.push(null);
  }
  const n = teams.length;
  const rounds = n - 1;
  const fixtures: FixtureDraft[] = [];
  let slot = 0;
  const rotation = [...teams];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = rotation[i];
      const away = rotation[n - 1 - i];
      if (home !== null && away !== null) {
        // alternate home and away so no team is always listed first
        const [a, b] = r % 2 === 0 ? [home, away] : [away, home];
        fixtures.push({ key: `L${r + 1}-${i}`, stage: 'league', round: r + 1, slot: slot++, teamAId: a, teamBId: b, nextKey: null, nextSlot: null });
      }
    }
    // rotate every team except the first
    rotation.splice(1, 0, rotation.pop()!);
  }
  if (double) {
    const firstLeg = fixtures.length;
    for (let i = 0; i < firstLeg; i++) {
      const f = fixtures[i];
      fixtures.push({
        ...f,
        key: `${f.key}-R`,
        round: f.round + rounds,
        slot: slot++,
        teamAId: f.teamBId,
        teamBId: f.teamAId,
      });
    }
  }
  return fixtures;
}

function stageFor(teamsInRound: number): FixtureStage {
  if (teamsInRound === 2) {
    return 'final';
  }
  if (teamsInRound === 4) {
    return 'semiFinal';
  }
  if (teamsInRound === 8) {
    return 'quarterFinal';
  }
  return 'knockout';
}

/** Standard seeding order for a bracket of `size` (a power of two): 1 v 8, 4 v 5, 2 v 7, 3 v 6, ... */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const s of order) {
      next.push(s, total - s);
    }
    order = next;
  }
  return order;
}

/**
 * Single-elimination bracket. Teams are seeded in the order given. When the
 * team count is not a power of two, top seeds get byes into round 2.
 * Entries may be null placeholders (filled later, e.g. league qualifiers), with labels.
 */
export function knockoutBracket(
  entries: Array<{ teamId: string | null; label?: string }>,
  keyPrefix = 'K',
): FixtureDraft[] {
  if (entries.length < 2) {
    throw new Error('A knockout needs at least 2 teams.');
  }
  let size = 1;
  while (size < entries.length) {
    size *= 2;
  }
  const order = seedOrder(size);
  const rounds = Math.log2(size);
  const fixtures: FixtureDraft[] = [];
  // build all rounds first so nextKey links are known
  const keyOf = (round: number, idx: number) => `${keyPrefix}${round}-${idx}`;
  let slot = 0;
  for (let r = 1; r <= rounds; r++) {
    const matches = size / 2 ** r;
    for (let m = 0; m < matches; m++) {
      fixtures.push({
        key: keyOf(r, m),
        stage: stageFor(matches * 2),
        round: r,
        slot: slot++,
        teamAId: null,
        teamBId: null,
        nextKey: r < rounds ? keyOf(r + 1, Math.floor(m / 2)) : null,
        nextSlot: r < rounds ? (m % 2 === 0 ? 'a' : 'b') : null,
      });
    }
  }
  const byKey = new Map(fixtures.map(f => [f.key, f]));
  // round 1 pairing by seed order; a missing seed means a bye
  for (let m = 0; m < size / 2; m++) {
    const seedA = order[m * 2];
    const seedB = order[m * 2 + 1];
    const ea = entries[seedA - 1];
    const eb = entries[seedB - 1];
    const f = byKey.get(keyOf(1, m))!;
    if (ea && eb) {
      f.teamAId = ea.teamId;
      f.teamBId = eb.teamId;
      f.labelA = ea.label;
      f.labelB = eb.label;
    } else {
      // bye: the single entry goes straight into round 2
      const e = ea ?? eb!;
      const next = byKey.get(f.nextKey!)!;
      if (f.nextSlot === 'a') {
        next.teamAId = e.teamId;
        next.labelA = e.label;
      } else {
        next.teamBId = e.teamId;
        next.labelB = e.label;
      }
      f.key = `${f.key}-bye`;
    }
  }
  return fixtures.filter(f => !f.key.endsWith('-bye'));
}

/** League stage + knockout for the top `qualifiers` (2, 4 or 8). */
export function leagueKnockout(teamIds: string[], qualifiers: number, double = false): FixtureDraft[] {
  if (![2, 4, 8].includes(qualifiers)) {
    throw new Error('Qualifiers must be 2, 4 or 8.');
  }
  if (qualifiers > teamIds.length) {
    throw new Error('There are more qualifiers than teams.');
  }
  const league = roundRobin(teamIds, double);
  const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} in table`;
  const ko = knockoutBracket(
    Array.from({ length: qualifiers }, (_, i) => ({ teamId: null, label: ordinal(i + 1) })),
  ).map((f, i) => ({ ...f, round: f.round + 1000, slot: league.length + i }));
  return [...league, ...ko];
}

export function generateFixtures(
  format: TournamentFormat,
  teamIds: string[],
  opts: { double?: boolean; qualifiers?: number } = {},
): FixtureDraft[] {
  switch (format) {
    case 'league':
      return roundRobin(teamIds, opts.double);
    case 'knockout':
      return knockoutBracket(teamIds.map(id => ({ teamId: id })));
    case 'leagueKnockout':
      return leagueKnockout(teamIds, opts.qualifiers ?? 4, opts.double);
  }
}

/* ------------------------------------------------------------------ */
/* Points table & NRR                                                  */
/* ------------------------------------------------------------------ */

export interface CompletedLeagueMatch {
  teamAId: string;
  teamBId: string;
  winnerTeamId: string | null;
  resultType: 'win' | 'tie' | 'draw' | 'noResult';
  /** Main innings only (no super overs). Overs faced are in balls. */
  teamARuns: number;
  teamABalls: number;
  teamAAllOut: boolean;
  teamBRuns: number;
  teamBBalls: number;
  teamBAllOut: boolean;
  /** balls in a full innings for this match (used when a side is all out) */
  quotaBalls: number | null;
  ballsPerOver: number;
}

export interface PointsRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsFor: number;
  oversFor: number; // decimal overs
  runsAgainst: number;
  oversAgainst: number;
  nrr: number;
}

export interface PointsConfig {
  win: number;
  tie: number;
  noResult: number;
}

export function pointsTable(teamIds: string[], matches: CompletedLeagueMatch[], cfg: PointsConfig): PointsRow[] {
  const rows = new Map<string, PointsRow & { ballsFor: number; ballsAgainst: number }>();
  for (const id of teamIds) {
    rows.set(id, {
      teamId: id,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      oversFor: 0,
      runsAgainst: 0,
      oversAgainst: 0,
      nrr: 0,
      ballsFor: 0,
      ballsAgainst: 0,
    });
  }
  for (const m of matches) {
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) {
      continue;
    }
    a.played += 1;
    b.played += 1;
    if (m.resultType === 'win' && m.winnerTeamId) {
      const [w, l] = m.winnerTeamId === m.teamAId ? [a, b] : [b, a];
      w.won += 1;
      w.points += cfg.win;
      l.lost += 1;
    } else if (m.resultType === 'tie') {
      a.tied += 1;
      b.tied += 1;
      a.points += cfg.tie;
      b.points += cfg.tie;
    } else {
      a.noResult += 1;
      b.noResult += 1;
      a.points += cfg.noResult;
      b.points += cfg.noResult;
      continue; // no-result matches are excluded from NRR
    }
    // NRR: a side that is all out counts as having batted its full quota
    const aBalls = m.teamAAllOut && m.quotaBalls ? m.quotaBalls : m.teamABalls;
    const bBalls = m.teamBAllOut && m.quotaBalls ? m.quotaBalls : m.teamBBalls;
    a.runsFor += m.teamARuns;
    a.ballsFor += aBalls;
    a.runsAgainst += m.teamBRuns;
    a.ballsAgainst += bBalls;
    b.runsFor += m.teamBRuns;
    b.ballsFor += bBalls;
    b.runsAgainst += m.teamARuns;
    b.ballsAgainst += aBalls;
    a.oversFor = a.ballsFor / m.ballsPerOver;
    a.oversAgainst = a.ballsAgainst / m.ballsPerOver;
    b.oversFor = b.ballsFor / m.ballsPerOver;
    b.oversAgainst = b.ballsAgainst / m.ballsPerOver;
  }
  const out: PointsRow[] = [];
  for (const r of rows.values()) {
    const forRate = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
    const againstRate = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
    out.push({
      teamId: r.teamId,
      played: r.played,
      won: r.won,
      lost: r.lost,
      tied: r.tied,
      noResult: r.noResult,
      points: r.points,
      runsFor: r.runsFor,
      oversFor: r.oversFor,
      runsAgainst: r.runsAgainst,
      oversAgainst: r.oversAgainst,
      nrr: r.oversFor > 0 || r.oversAgainst > 0 ? forRate - againstRate : 0,
    });
  }
  return out.sort((x, y) => y.points - x.points || y.nrr - x.nrr || y.won - x.won || x.teamId.localeCompare(y.teamId));
}

export function formatNrr(nrr: number): string {
  const v = Math.round(nrr * 1000) / 1000;
  return `${v > 0 ? '+' : ''}${v.toFixed(3)}`;
}

/** Overs in cricket notation (19.3) from decimal overs (19.5). */
export function cricketOvers(balls: number, ballsPerOver: number): string {
  return `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;
}
