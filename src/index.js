import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { initDb } from './db.js';
import { savePicks } from './store.js';
import { buildRecap } from './report.js';
import { postDiscordReport } from './discord.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

function chicagoDateOffset(daysOffset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + daysOffset);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.RECAP_TIMEZONE || 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function requireSecret(req, res, next) {
  const sent = req.headers['x-recap-secret'];

  if (!process.env.RECAP_SECRET || sent !== process.env.RECAP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    name: 'mlb-results-recap-bot',
    storage: 'postgres',
    endpoints: ['/save-picks', '/run-recap']
  });
});

app.post('/save-picks', requireSecret, async (req, res) => {
  try {
    const result = await savePicks(req.body);

    res.json({
      ok: true,
      added: result.added,
      savedTotal: result.count
    });
  } catch (err) {
    console.error('Save picks failed:', err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.post('/run-recap', requireSecret, async (req, res) => {
  try {
    const date = req.body.date || chicagoDateOffset(-1);
    const report = await buildRecap(date, {
      updateSeason: req.body.updateSeason !== false
    });

    await postDiscordReport({
      webhookUrl: process.env.RECAP_WEBHOOK_URL,
      text: report
    });

    res.json({
      ok: true,
      date
    });
  } catch (err) {
    console.error('Run recap failed:', err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

cron.schedule(
  process.env.RECAP_CRON || '0 1 * * *',
  async () => {
    try {
      const date = chicagoDateOffset(-1);
      const report = await buildRecap(date, { updateSeason: true });

      await postDiscordReport({
        webhookUrl: process.env.RECAP_WEBHOOK_URL,
        text: report
      });

      console.log(`Posted recap for ${date}`);
    } catch (err) {
      console.error('Nightly recap failed:', err);
    }
  },
  {
    timezone: process.env.RECAP_TIMEZONE || 'America/Chicago'
  }
);

if (process.argv[2] === 'recap') {
  const date = process.argv[3] || chicagoDateOffset(-1);

  await initDb();

  const report = await buildRecap(date, {
    updateSeason: true
  });

  await postDiscordReport({
    webhookUrl: process.env.RECAP_WEBHOOK_URL,
    text: report
  });

  console.log(`Manual recap posted for ${date}`);
  process.exit(0);
}

const PORT = process.env.PORT || 3000;

await initDb();

app.listen(PORT, () => {
  console.log(`Recap bot running on port ${PORT}`);
});
