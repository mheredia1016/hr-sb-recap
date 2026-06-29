import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PREGAME_DIR = path.join(DATA_DIR, 'pregame');
const SEASON_DIR = path.join(DATA_DIR, 'season');
const SEASON_FILE = path.join(SEASON_DIR, 'season-stats.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanPlayer(player) {
  return {
    playerId: Number(player.playerId || player.id || player.mlbId),
    name: player.name || player.playerName || 'Unknown Player',
    team: player.team || '',
    opponent: player.opponent || '',
    gamePk: player.gamePk ? Number(player.gamePk) : null,
    score: player.score ?? null,
    tier: player.tier || null
  };
}

export function savePicks({ type, date, players }) {
  if (!['hr', 'sb'].includes(type)) {
    throw new Error('type must be hr or sb');
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date must be YYYY-MM-DD');
  }

  if (!Array.isArray(players)) {
    throw new Error('players must be an array');
  }

  ensureDir(PREGAME_DIR);

  const cleaned = players
    .map(cleanPlayer)
    .filter(p => p.playerId && p.name && p.gamePk);

  const file = path.join(PREGAME_DIR, `${type}-${date}.json`);

  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        type,
        date,
        savedAt: new Date().toISOString(),
        count: cleaned.length,
        players: cleaned
      },
      null,
      2
    )
  );

  return {
    file,
    count: cleaned.length
  };
}

export function loadPicks(type, date) {
  const file = path.join(PREGAME_DIR, `${type}-${date}.json`);

  if (!fs.existsSync(file)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadSeasonStats() {
  if (!fs.existsSync(SEASON_FILE)) {
    return {
      hr: {
        days: 0,
        posted: 0,
        hits: 0,
        elitePosted: 0,
        eliteHits: 0
      },
      sb: {
        days: 0,
        posted: 0,
        hits: 0,
        elitePosted: 0,
        eliteHits: 0
      },
      processedDates: {}
    };
  }

  return JSON.parse(fs.readFileSync(SEASON_FILE, 'utf8'));
}

export function saveSeasonStats(stats) {
  ensureDir(SEASON_DIR);
  fs.writeFileSync(SEASON_FILE, JSON.stringify(stats, null, 2));
}

export function updateSeasonStats(date, hrResults, sbResults) {
  const stats = loadSeasonStats();

  if (!stats.processedDates) stats.processedDates = {};

  if (stats.processedDates[date]) {
    return {
      stats,
      updated: false,
      reason: 'already_processed'
    };
  }

  function apply(type, results) {
    if (!stats[type]) {
      stats[type] = {
        days: 0,
        posted: 0,
        hits: 0,
        elitePosted: 0,
        eliteHits: 0
      };
    }

    if (!results.length) return;

    const elite = results.filter(p => Number(p.score || 0) >= 90);
    const hits = results.filter(p => p.hit);
    const eliteHits = elite.filter(p => p.hit);

    stats[type].days += 1;
    stats[type].posted += results.length;
    stats[type].hits += hits.length;
    stats[type].elitePosted += elite.length;
    stats[type].eliteHits += eliteHits.length;
  }

  apply('hr', hrResults);
  apply('sb', sbResults);

  stats.processedDates[date] = {
    processedAt: new Date().toISOString(),
    hrPosted: hrResults.length,
    sbPosted: sbResults.length
  };

  saveSeasonStats(stats);

  return {
    stats,
    updated: true
  };
}
