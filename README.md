# MLB Results Recap Bot - PostgreSQL Ready

Drop-in replacement for the recap bot.

## Required Railway variables

```env
DATABASE_URL=Railway PostgreSQL reference
RECAP_SECRET=same-secret-used-by-HR-and-SB-bots
RECAP_WEBHOOK_URL=Discord recap webhook
RECAP_TIMEZONE=America/Chicago
RECAP_CRON=0 1 * * *
MAX_DISCORD_CHARS=1800
```

## Deploy steps

1. Replace your recap bot repo with this project.
2. Make sure Railway has DATABASE_URL connected from the PostgreSQL service.
3. Deploy.
4. Visit `/` and confirm it says `"storage":"postgres"`.
5. Rerun the HR bot and SB bot once so they save fresh picks into PostgreSQL.
6. Trigger `/run-recap` with the date.

The HR and SB bots do not need code changes.
