/**
 * Pure builders for exports (no native code): HTML scorecards for PDF and CSV files.
 */
import { formatOvers, squadOf } from '../core/engine/engine';
import { DISMISSAL_LABELS, FORMAT_LABELS } from '../core/engine/rules';
import { economy, fixed, inningsTitle, strikeRate } from '../core/engine/selectors';
import type { Dismissal, InningsState, MatchState } from '../core/engine/types';
import type { CareerStats } from '../data/repositories/statsRepository';
import { BRAND_NAME, BRAND_TAGLINE } from '../theme/brand';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function dismissalText(d: Dismissal | null, names: Record<string, string>, retiredHurt = false): string {
  if (!d) {
    return retiredHurt ? 'retired hurt' : 'not out';
  }
  const b = d.bowlerId ? names[d.bowlerId] ?? '' : '';
  const f = d.fielderId ? names[d.fielderId] ?? '' : '';
  switch (d.type) {
    case 'bowled':
      return `b ${b}`;
    case 'caught':
      return d.fielderId && d.fielderId === d.bowlerId ? `c & b ${b}` : `c ${f || 'sub'} b ${b}`;
    case 'lbw':
      return `lbw b ${b}`;
    case 'stumped':
      return `st ${f || '†'} b ${b}`;
    case 'hitWicket':
      return `hit wicket b ${b}`;
    case 'runOut':
      return f ? `run out (${f})` : 'run out';
    default:
      return DISMISSAL_LABELS[d.type]?.toLowerCase() ?? d.type;
  }
}

function extrasLine(inn: InningsState): string {
  const e = inn.extras;
  const total = e.wides + e.noBalls + e.byes + e.legByes + e.penalty;
  return `${total} (b ${e.byes}, lb ${e.legByes}, w ${e.wides}, nb ${e.noBalls}${e.penalty ? `, p ${e.penalty}` : ''})`;
}

export interface ScorecardMeta {
  title: string;
  venue: string | null;
  date: number;
  tossText: string | null;
}

export function scorecardHtml(state: MatchState, names: Record<string, string>, meta: ScorecardMeta): string {
  const bpo = state.setup.rules.ballsPerOver;
  const esc = escapeHtml;
  const innings = state.innings
    .map(inn => {
      const batting = inn.batters
        .map(
          b => `<tr><td class="name">${esc(names[b.playerId] ?? '')}</td><td class="how">${esc(dismissalText(b.dismissal, names, b.retiredHurt))}</td>
          <td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${fixed(strikeRate(b.runs, b.balls))}</td></tr>`,
        )
        .join('');
      const yetToBat = squadOf(state, inn.battingTeamId)
        .playerIds.filter(id => !inn.batters.some(b => b.playerId === id))
        .map(id => esc(names[id] ?? ''))
        .join(', ');
      const bowling = inn.bowlers
        .map(
          b => `<tr><td class="name">${esc(names[b.playerId] ?? '')}</td><td>${formatOvers(b.legalBalls, bpo)}</td><td>${b.maidens}</td><td>${b.runs}</td><td>${b.wickets}</td>
          <td>${fixed(economy(b.runs, b.legalBalls, bpo))}</td><td>${b.dots}</td><td>${b.wides}</td><td>${b.noBalls}</td></tr>`,
        )
        .join('');
      const fow = inn.fallOfWickets.map(f => `${f.teamScore}-${f.wicketNumber} (${esc(names[f.batterId] ?? '')}, ${f.overBall})`).join(', ');
      const parts = inn.partnerships
        .filter(p => p.runs > 0 || p.balls > 0)
        .map(p => `<li>${esc(names[p.batter1Id] ?? '')}${p.batter2Id ? ` &amp; ${esc(names[p.batter2Id] ?? '')}` : ''}: <b>${p.runs}</b> (${p.balls})${p.unbroken ? '*' : ''}</li>`)
        .join('');
      return `
      <section>
        <h2>${esc(inningsTitle(state, inn))} <span>${inn.runs}/${inn.wickets}${inn.declared ? 'd' : ''} (${formatOvers(inn.legalBalls, bpo)} ov)</span></h2>
        <table><thead><tr><th class="name">Batter</th><th class="how"></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${batting}</tbody></table>
        <p class="meta"><b>Extras</b> ${extrasLine(inn)} &nbsp; · &nbsp; <b>Total</b> ${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls, bpo)} ov, RR ${fixed((inn.runs * bpo) / Math.max(1, inn.legalBalls))})</p>
        ${yetToBat ? `<p class="meta"><b>Did not bat</b> ${yetToBat}</p>` : ''}
        ${fow ? `<p class="meta"><b>Fall of wickets</b> ${fow}</p>` : ''}
        <table><thead><tr><th class="name">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>0s</th><th>WD</th><th>NB</th></tr></thead><tbody>${bowling}</tbody></table>
        ${parts ? `<p class="meta"><b>Partnerships</b></p><ul>${parts}</ul>` : ''}
      </section>`;
    })
    .join('');
  const rules = state.setup.rules;
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(meta.title)}</title>
  <style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0F172A;margin:28px;font-size:12px}
    header{border-bottom:3px solid #0369A1;padding-bottom:10px;margin-bottom:14px}
    header .brand{color:#0369A1;font-weight:800;letter-spacing:2px;font-size:11px}
    h1{margin:4px 0;font-size:22px} .result{color:#B7791F;font-weight:700;font-size:15px}
    h2{font-size:15px;background:#0F172A;color:#fff;padding:6px 10px;border-radius:6px;display:flex;justify-content:space-between}
    table{width:100%;border-collapse:collapse;margin:6px 0}
    th,td{padding:4px 6px;text-align:right;border-bottom:1px solid #E2E8F0}
    th{color:#64748B;font-weight:600} td.name,th.name{text-align:left;font-weight:600} td.how,th.how{text-align:left;color:#64748B}
    .meta{margin:4px 0;color:#334155} section{margin-bottom:18px;page-break-inside:avoid} ul{margin:4px 0 0 18px;padding:0}
    footer{margin-top:20px;color:#94A3B8;font-size:10px;text-align:center}
  </style></head><body>
  <header><div class="brand">${esc(BRAND_NAME.toUpperCase())} · SCORECARD</div>
  <h1>${esc(state.setup.teamA.name)} vs ${esc(state.setup.teamB.name)}</h1>
  <div>${esc(meta.title)} · ${esc(FORMAT_LABELS[rules.format])}${rules.oversPerInnings ? ` (${rules.oversPerInnings} overs)` : ''} · ${rules.ballType === 'tape' ? 'Tape ball' : 'Hard ball'}${meta.venue ? ` · ${esc(meta.venue)}` : ''} · ${new Date(meta.date).toDateString()}</div>
  ${meta.tossText ? `<div>${esc(meta.tossText)}</div>` : ''}
  <div class="result">${esc(state.result?.summary ?? 'Match in progress')}</div></header>
  ${innings}
  <footer>Generated offline by ${esc(BRAND_NAME)} · ${esc(BRAND_TAGLINE)}</footer>
  </body></html>`;
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) {
    return '';
  }
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Ball-by-ball CSV for one match. */
export function ballByBallCsv(state: MatchState, names: Record<string, string>): string {
  const rows: Array<Array<string | number | null>> = [
    ['innings', 'batting_team', 'over', 'ball', 'bowler', 'striker', 'non_striker', 'kind', 'bat_runs', 'byes', 'leg_byes', 'wide_runs', 'boundary', 'total_runs', 'wicket', 'batter_out', 'fielder', 'free_hit', 'team_score', 'team_wickets', 'shot_angle', 'shot_distance'],
  ];
  for (const inn of state.innings) {
    const team = squadOf(state, inn.battingTeamId).name;
    for (const b of inn.balls) {
      rows.push([
        inn.index + 1 + (inn.isSuperOver ? ' (SO)' : ''),
        team,
        b.over + 1,
        b.ballInOver,
        names[b.bowlerId] ?? b.bowlerId,
        names[b.strikerId] ?? b.strikerId,
        b.nonStrikerId ? names[b.nonStrikerId] ?? b.nonStrikerId : '',
        b.kind,
        b.batRuns,
        b.byes,
        b.legByes,
        b.wideRuns,
        b.boundary,
        b.totalRuns,
        b.wicket ? b.wicket.type : '',
        b.wicket ? names[b.wicket.batterOutId] ?? '' : '',
        b.wicket?.fielderId ? names[b.wicket.fielderId] ?? '' : '',
        b.freeHit ? 'yes' : '',
        b.teamScoreAfter,
        b.wicketsAfter,
        b.shot ? b.shot.angle : null,
        b.shot ? b.shot.distance : null,
      ]);
    }
  }
  return toCsv(rows);
}

/** Batting and bowling card CSV for one match. */
export function scorecardCsv(state: MatchState, names: Record<string, string>): string {
  const bpo = state.setup.rules.ballsPerOver;
  const rows: Array<Array<string | number | null>> = [['section', 'innings', 'player', 'dismissal', 'runs', 'balls', 'fours', 'sixes', 'strike_rate', 'overs', 'maidens', 'runs_conceded', 'wickets', 'economy']];
  for (const inn of state.innings) {
    for (const b of inn.batters) {
      rows.push(['batting', inn.index + 1, names[b.playerId] ?? '', dismissalText(b.dismissal, names, b.retiredHurt), b.runs, b.balls, b.fours, b.sixes, fixed(strikeRate(b.runs, b.balls)), null, null, null, null, null]);
    }
    for (const w of inn.bowlers) {
      rows.push(['bowling', inn.index + 1, names[w.playerId] ?? '', null, null, null, null, null, null, formatOvers(w.legalBalls, bpo), w.maidens, w.runs, w.wickets, fixed(economy(w.runs, w.legalBalls, bpo))]);
    }
  }
  return toCsv(rows);
}

/** Career statistics CSV for all players. */
export function careersCsv(careers: CareerStats[], teamNames: Record<string, string>): string {
  const rows: Array<Array<string | number | null>> = [
    ['player', 'team', 'matches', 'innings', 'runs', 'balls', 'not_outs', 'highest', 'average', 'strike_rate', '50s', '100s', '4s', '6s', 'overs', 'runs_conceded', 'wickets', 'best', 'bowling_average', 'economy', 'catches', 'stumpings', 'run_outs'],
  ];
  for (const c of careers) {
    rows.push([
      c.name,
      c.teamId ? teamNames[c.teamId] ?? '' : '',
      c.matches,
      c.innings,
      c.runs,
      c.balls,
      c.notOuts,
      `${c.highest}${c.highestNotOut ? '*' : ''}`,
      c.battingAverage !== null ? fixed(c.battingAverage) : '',
      c.strikeRate !== null ? fixed(c.strikeRate) : '',
      c.fifties,
      c.hundreds,
      c.fours,
      c.sixes,
      `${Math.floor(c.bowlBalls / 6)}.${c.bowlBalls % 6}`,
      c.runsConceded,
      c.wickets,
      c.bowlBalls > 0 ? `${c.bestWickets}/${c.bestRuns}` : '',
      c.bowlingAverage !== null ? fixed(c.bowlingAverage) : '',
      c.economy !== null ? fixed(c.economy) : '',
      c.catches,
      c.stumpings,
      c.runOuts,
    ]);
  }
  return toCsv(rows);
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'match';
}
