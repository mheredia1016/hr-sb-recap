import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : undefined
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pregame_picks (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      team TEXT,
      opponent TEXT,
      game_pk INTEGER NOT NULL,
      score NUMERIC,
      tier TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(type, date, game_pk, player_id)
    );
  `);
}
