import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn('[DB] DATABASE_URL is not set. PostgreSQL calls will fail until it is added.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS season_stats (
      type TEXT PRIMARY KEY,
      days INTEGER DEFAULT 0,
      posted INTEGER DEFAULT 0,
      hits INTEGER DEFAULT 0,
      elite_posted INTEGER DEFAULT 0,
      elite_hits INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS processed_dates (
      date TEXT PRIMARY KEY,
      processed_at TIMESTAMP DEFAULT NOW(),
      hr_posted INTEGER DEFAULT 0,
      sb_posted INTEGER DEFAULT 0
    );
  `);

  await pool.query(`
    INSERT INTO season_stats (type)
    VALUES ('hr'), ('sb')
    ON CONFLICT (type) DO NOTHING;
  `);

  console.log('[DB] PostgreSQL tables ready.');
}
