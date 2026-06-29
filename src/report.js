import { loadPicks, updateSeasonStats } from './store.js';
import {
  getBoxscore,
  getBattingStats,
  getGameLabel,
  getHomeRunDetails
} from './mlb.js';

function pct(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function scoreLabel(score) {
  return score === null || score === undefined ? 'N/A' : String(score);
}

function topScore(players) {
  return [...players].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
}

async function grade(type, date) {
  const saved = await loadPicks(type, date);

  if (!saved?.players?.length) {
    return [];
  }

  const boxscores = new Map();
  const hrDetails = new Map();
  const results = [];

  for (const player of saved.players) {
    if (!player.gamePk || !player.playerId) {
      results.push({
        ...player,
        game: player.game || 'Unknown Game',
        actual: {
          hr: 0,
          sb: 0,
          cs: 0,
          hits: 0,
          atBats: 0,
          rbi: 0,
          runs: 0
        },
        hit: false
      });
      continue;
    }

    if (!boxscores.has(player.gamePk)) {
      boxscores.set(player.gamePk, await getBoxscore(player.gamePk));
    }

    const boxscore = boxscores.get(player.gamePk);
    const stats = getBattingStats(boxscore, player.playerId);

    const actual = {
      hr: Number(stats.homeRuns || 0),
      sb: Number(stats.stolenBases || 0),
      cs: Number(stats.caughtStealing || 0),
      hits: Number(stats.hits || 0),
      atBats: Number(stats.atBats || 0),
      rbi: Number(stats.rbi || 0),
      runs: Number(stats.runs || 0)
    };

    if (type === 'hr' && actual.hr > 0) {
      const key = `${player.gamePk}:${player.playerId}`;
      if (!hrDetails.has(key)) {
        try {
          hrDetails.set(key, await getHomeRunDetails(player.gamePk, player.playerId));
        } catch {
          hrDetails.set(key, []);
        }
      }
      actual.hrDetails = hrDetails.get(key);
    }

    results.push({
      ...player,
      game: getGameLabel(boxscore),
      actual,
      hit: type === 'hr' ? actual.hr > 0 : actual.sb > 0
    });
  }

  return topScore(results);
}

function buildHitLine(player, type) {
  const score = scoreLabel(player.score);

  if (type === 'hr') {
    const details = player.actual.hrDetails || [];
    const innings = details.length
      ? ` — ${details.map(d => `${d.half || ''} ${d.inning || ''}`.trim()).join(', ')}`
      : '';

    const multi = player.actual.hr > 1 ? ` (${player.actual.hr} HR)` : '';
    return `✅ **${player.name}** (${score}) — ${player.game} — HR${multi}${innings}`;
  }

  const cs = player.actual.cs ? `, ${player.actual.cs} CS` : '';
  const multi = player.actual.sb > 1 ? `${player.actual.sb} SB` : '1 SB';
  return `✅ **${player.name}** (${score}) — ${player.game} — ${multi}${cs}`;
}

function buildMissLine(player, type) {
  const score = scoreLabel(player.score);

  if (type === 'sb' && player.actual.cs > 0) {
    return `❌ **${player.name}** (${score}) — ${player.game} — 0 SB, ${player.actual.cs} CS`;
  }

  if (type === 'hr') {
    return `❌ **${player.name}** (${score}) — ${player.game} — ${player.actual.hits}/${player.actual.atBats}`;
  }

  return `❌ **${player.name}** (${score}) — ${player.game}`;
}

function buildSection({ title, emoji, players, type }) {
  if (!players.length) {
    return `${emoji} **${title}**\nNo saved posted picks found.`;
  }

  const hits = players.filter(p => p.hit);
  const misses = players.filter(p => !p.hit);
  const elite = players.filter(p => Number(p.score || 0) >= 90);
  const eliteHits = elite.filter(p => p.hit);

  const topMisses = topScore(misses).slice(0, 25);
  const topTen = topScore(players).slice(0, 10);
  const topTenHits = topTen.filter(p => p.hit);

  const hitLines = hits.length
    ? hits.map(p => buildHitLine(p, type)).join('\n')
    : 'None';

  const missLines = topMisses.length
    ? topMisses.map(p => buildMissLine(p, type)).join('\n')
    : 'None';

  const best = hits.length ? topScore(hits)[0] : null;

  const bestLine = best
    ? type === 'hr'
      ? `🔥 Best call: **${best.name}** (${scoreLabel(best.score)}) — ${best.actual.hr} HR`
      : `🔥 Best call: **${best.name}** (${scoreLabel(best.score)}) — ${best.actual.sb} SB`
    : '🔥 Best call: None';

  const hiddenMissCount = Math.max(0, misses.length - topMisses.length);
  const hiddenMissLine = hiddenMissCount
    ? `\n_Only showing top ${topMisses.length} misses by score. ${hiddenMissCount} lower-score misses hidden._`
    : '';

  return `
${emoji} **${title}**

**Hits (${hits.length})**
${hitLines}

**Top Misses (${misses.length})**
${missLines}${hiddenMissLine}

**Daily Summary**
Posted: ${players.length}
Hit: ${hits.length}
Rate: ${pct(hits.length, players.length)}
Top 10 Scores: ${topTenHits.length}/${topTen.length} (${pct(topTenHits.length, topTen.length)})
Elite 90+: ${eliteHits.length}/${elite.length} (${pct(eliteHits.length, elite.length)})
${bestLine}
`.trim();
}

function buildSeasonLine(stats, type, label) {
  const s = stats?.[type] || {
    posted: 0,
    hits: 0,
    elitePosted: 0,
    eliteHits: 0
  };

  return `${label}: ${s.hits}/${s.posted} (${pct(s.hits, s.posted)}) | Elite 90+: ${s.eliteHits}/${s.elitePosted} (${pct(s.eliteHits, s.elitePosted)})`;
}

export async function buildRecap(date, { updateSeason = true } = {}) {
  const hrResults = await grade('hr', date);
  const sbResults = await grade('sb', date);

  const seasonResult = updateSeason
    ? await updateSeasonStats(date, hrResults, sbResults)
    : { stats: null, updated: false };

  const season = seasonResult.stats;

  const seasonBlock = season
    ? `
📈 **Season Tracking**
${buildSeasonLine(season, 'hr', 'HR')}
${buildSeasonLine(season, 'sb', 'SB')}
${seasonResult.updated ? '' : '_Season totals already included this date._'}
`.trim()
    : '';

  return `
📊 **MLB Pregame Results Recap**
${date}

━━━━━━━━━━━━━━━━━━

${buildSection({
  title: 'Home Run Pregame Results',
  emoji: '💣',
  players: hrResults,
  type: 'hr'
})}

━━━━━━━━━━━━━━━━━━

${buildSection({
  title: 'Stolen Base Pregame Results',
  emoji: '🏃',
  players: sbResults,
  type: 'sb'
})}

━━━━━━━━━━━━━━━━━━

${seasonBlock}
`.trim();
}
