import { pool } from './db.js';

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

export async function savePicks({ type, date, players }) {
  if (!['hr', 'sb'].includes(type)) {
    throw new Error('type must be hr or sb');
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date must be YYYY-MM-DD');
  }

  if (!Array.isArray(players)) {
    throw new Error('players must be an array');
  }

  const cleaned = players
    .map(cleanPlayer)
    .filter((p) => p.playerId && p.name && p.gamePk);

  for (const p of cleaned) {
    await pool.query(
      `
      INSERT INTO pregame_picks
        (type, date, player_id, name, team, opponent, game_pk, score, tier, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      ON CONFLICT (type, date, game_pk, player_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        team = EXCLUDED.team,
        opponent = EXCLUDED.opponent,
        score = EXCLUDED.score,
        tier = EXCLUDED.tier,
        updated_at = NOW()
      `,
      [type, date, p.playerId, p.name, p.team, p.opponent, p.gamePk, p.score, p.tier]
    );
  }

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM pregame_picks WHERE type=$1 AND date=$2`,
    [type, date]
  );

  return {
    added: cleaned.length,
    count: Number(countRes.rows[0].count)
  };
}

export async function loadPicks(type, date) {
  const res = await pool.query(
    `
    SELECT *
    FROM pregame_picks
    WHERE type=$1 AND date=$2
    ORDER BY game_pk ASC, score DESC NULLS LAST, name ASC
    `,
    [type, date]
  );

  return {
    type,
    date,
    count: res.rows.length,
    players: res.rows.map((r) => ({
      playerId: r.player_id,
      name: r.name,
      team: r.team,
      opponent: r.opponent,
      gamePk: r.game_pk,
      score: r.score === null ? null : Number(r.score),
      tier: r.tier
    }))
  };
}

export async function loadSeasonStats() {
  const statRes = await pool.query(`
    SELECT type, days, posted, hits, elite_posted, elite_hits
    FROM season_stats
    WHERE type IN ('hr', 'sb')
  `);

  const processedRes = await pool.query(`
    SELECT date, processed_at, hr_posted, sb_posted
    FROM processed_dates
  `);

  const stats = {
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

  for (const row of statRes.rows) {
    stats[row.type] = {
      days: Number(row.days || 0),
      posted: Number(row.posted || 0),
      hits: Number(row.hits || 0),
      elitePosted: Number(row.elite_posted || 0),
      eliteHits: Number(row.elite_hits || 0)
    };
  }

  for (const row of processedRes.rows) {
    stats.processedDates[row.date] = {
      processedAt: row.processed_at,
      hrPosted: Number(row.hr_posted || 0),
      sbPosted: Number(row.sb_posted || 0)
    };
  }

  return stats;
}

export async function updateSeasonStats(date, hrResults, sbResults) {
  const already = await pool.query(
    `SELECT date FROM processed_dates WHERE date=$1`,
    [date]
  );

  if (already.rows.length) {
    return {
      stats: await loadSeasonStats(),
      updated: false,
      reason: 'already_processed'
    };
  }

  async function apply(type, results) {
    if (!results.length) return;

    const elite = results.filter((p) => Number(p.score || 0) >= 90);
    const hits = results.filter((p) => p.hit);
    const eliteHits = elite.filter((p) => p.hit);

    await pool.query(
      `
      INSERT INTO season_stats
        (type, days, posted, hits, elite_posted, elite_hits, updated_at)
      VALUES
        ($1, 1, $2, $3, $4, $5, NOW())
      ON CONFLICT (type)
      DO UPDATE SET
        days = season_stats.days + 1,
        posted = season_stats.posted + EXCLUDED.posted,
        hits = season_stats.hits + EXCLUDED.hits,
        elite_posted = season_stats.elite_posted + EXCLUDED.elite_posted,
        elite_hits = season_stats.elite_hits + EXCLUDED.elite_hits,
        updated_at = NOW()
      `,
      [type, results.length, hits.length, elite.length, eliteHits.length]
    );
  }

  await apply('hr', hrResults);
  await apply('sb', sbResults);

  await pool.query(
    `
    INSERT INTO processed_dates (date, processed_at, hr_posted, sb_posted)
    VALUES ($1, NOW(), $2, $3)
    ON CONFLICT (date) DO NOTHING
    `,
    [date, hrResults.length, sbResults.length]
  );

  return {
    stats: await loadSeasonStats(),
    updated: true
  };
}
