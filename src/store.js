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
  if (!['hr', 'sb'].includes(type)) throw new Error('type must be hr or sb');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (!Array.isArray(players)) throw new Error('players must be an array');

  const cleaned = players
    .map(cleanPlayer)
    .filter(p => p.playerId && p.name && p.gamePk);

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
    ORDER BY game_pk ASC, score DESC NULLS LAST
    `,
    [type, date]
  );

  return {
    type,
    date,
    count: res.rows.length,
    players: res.rows.map(r => ({
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

export async function updateSeasonStats() {
  return {
    stats: null,
    updated: false
  };
}
