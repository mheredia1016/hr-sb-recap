# MLB Results Recap Bot

Standalone recap bot for your existing separate HR Pregame Bot and Stolen Base Pregame Bot.

## What it does

- Receives only the picks that were actually posted by your HR/SB bots.
- Saves them by date.
- Checks MLB boxscores.
- Posts a polished daily recap to Discord.
- Tracks season totals.

## Endpoints

### Health check

```bash
GET /
```

### Save posted picks

```bash
POST /save-picks
x-recap-secret: YOUR_SECRET
```

Body:

```json
{
  "type": "hr",
  "date": "2026-06-28",
  "players": [
    {
      "playerId": 592450,
      "name": "Aaron Judge",
      "team": "NYY",
      "opponent": "BOS",
      "gamePk": 777123,
      "score": 96,
      "tier": "Elite"
    }
  ]
}
```

Use `"type": "sb"` for stolen base picks.

### Run recap manually

```bash
POST /run-recap
x-recap-secret: YOUR_SECRET
```

Body:

```json
{
  "date": "2026-06-28"
}
```

Or from Railway shell/local:

```bash
npm run recap 2026-06-28
```

## Env vars needed in this recap bot

```env
RECAP_SECRET=make-this-a-long-random-password
RECAP_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Env vars needed in your HR and SB bots

```env
RECAP_BOT_URL=https://your-recap-bot.up.railway.app
RECAP_BOT_SECRET=the-same-secret
```

## Add to your HR bot after it posts to Discord

```js
async function sendPicksToRecapBot(players, date) {
  if (!process.env.RECAP_BOT_URL || !process.env.RECAP_BOT_SECRET) return;

  const res = await fetch(`${process.env.RECAP_BOT_URL}/save-picks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-recap-secret': process.env.RECAP_BOT_SECRET
    },
    body: JSON.stringify({
      type: 'hr',
      date,
      players: players.map(p => ({
        playerId: p.playerId || p.id || p.mlbId,
        name: p.name || p.playerName,
        team: p.team,
        opponent: p.opponent,
        gamePk: p.gamePk,
        score: p.score,
        tier: p.tier || null
      }))
    })
  });

  if (!res.ok) {
    console.error('Failed to send HR picks to recap bot:', await res.text());
  }
}
```

Then call:

```js
await sendPicksToRecapBot(ranked, todayDate);
```

## Add to your SB bot after it posts to Discord

Same function, but use:

```js
type: 'sb'
```

Then call:

```js
await sendPicksToRecapBot(ranked, todayDate);
```

## Data files

Saved picks:

```text
data/pregame/hr-YYYY-MM-DD.json
data/pregame/sb-YYYY-MM-DD.json
```

Season stats:

```text
data/season/season-stats.json
```

## Railway

Start command:

```bash
npm start
```

The bot schedules the recap at 1:00 AM America/Chicago by default.
