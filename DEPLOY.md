# Free deployment guide

Stack: **Vercel** (frontend) + **Render free web services** (api, engine, ws,
plus the three background processors below) + **Neon** (Postgres) +
**Upstash** (Redis). Total cost: $0/month, no card required anywhere.

Do these in order — each later step needs a value from the one before it.

## 1. Neon (Postgres)

1. Sign up at neon.tech (free, no card) → create a project.
2. Copy the **pooled connection string** shown on the dashboard — that's your
   `DATABASE_URL`. Also grab the **direct (unpooled) connection string** —
   that's your `SHADOW_DATABASE_URL` (Prisma needs both; the schema at
   [db/prisma/schema.prisma](db/prisma/schema.prisma) declares both).

## 2. Upstash (Redis)

1. Sign up at upstash.com (free) → create a Redis database (pick a region
   close to wherever you deploy Render).
2. Copy the **TLS connection string** (starts with `rediss://`) — that's your
   `REDIS_URL`. The app's Redis clients ([api/src/RedisManager.ts](api/src/RedisManager.ts),
   [engine/src/redisManager.ts](engine/src/redisManager.ts),
   [ws/src/SubscriptionManager.ts](ws/src/SubscriptionManager.ts)) already
   read `REDIS_URL` from env and work with `rediss://` out of the box.

## 3. Render (api, engine, ws + the 3 background processors)

This repo has a [render.yaml](render.yaml) blueprint defining six backend
services:

| Service | What it does |
|---|---|
| `exchange-api` | REST API |
| `exchange-engine` | matching engine (consumes orders from Redis) |
| `exchange-ws` | pushes live orderbook/trade updates to the frontend |
| `exchange-db-processor` | persists the engine's events (orders/trades/balances) into Postgres — [db/src/dbProcessor.ts](db/src/dbProcessor.ts) |
| `exchange-dlq-processor` | retries events that failed in the DB processor — [db/src/dlqProcessor.ts](db/src/dlqProcessor.ts) |
| `exchange-kline-aggregator` | rolls trades into 1m/5m/.../1w candles for the chart — [db/src/crons/klineAggregator.ts](db/src/crons/klineAggregator.ts) |

The last three are what you were calling "the crons" — they're not actually
OS cron jobs, they're Node processes that loop forever (`while (true)` with a
sleep/poll inside). They don't have their own HTTP API, so a minimal
health-check listener was added to each one (binds `$PORT`, returns `200`)
purely so Render's free "web service" type will accept and health-check them
— Render's free tier has no free background-worker instance, only free web
services, so this is the standard workaround.

1. Push this repo to GitHub if it isn't already.
2. In Render: **New → Blueprint**, point it at the repo — it will read
   `render.yaml` and propose all six services on the free plan.
3. For each service, fill in the env vars marked `sync: false` when prompted
   (all from steps 1–2 above):
   - `exchange-api`: `DATABASE_URL`, `SHADOW_DATABASE_URL`, `REDIS_URL`
   - `exchange-engine`: `DATABASE_URL`, `REDIS_URL`
   - `exchange-ws`: `REDIS_URL`
   - `exchange-db-processor`: `DATABASE_URL`, `REDIS_URL`
   - `exchange-dlq-processor`: `DATABASE_URL`, `REDIS_URL`
   - `exchange-kline-aggregator`: `DATABASE_URL`
4. Deploy. `exchange-api`'s build runs `prisma migrate deploy` against Neon,
   so your schema gets applied automatically on first deploy.
5. Note the public URLs Render gives you, e.g.
   `https://exchange-api.onrender.com` and `https://exchange-ws.onrender.com`.

**Important trade-off — read this:** Render's free web services spin down
after ~15 min with no incoming HTTP traffic, and spinning down actually kills
the process, not just pauses a proxy in front of it. That's fine for
`exchange-api`/`exchange-ws` (they wake back up in 30-60s on the next
visitor), but it means `exchange-db-processor`, `exchange-dlq-processor`, and
`exchange-kline-aggregator` will also go to sleep between demos and stop
consuming their Redis streams — anything queued just waits in Redis until the
service wakes up again (visiting the app doesn't wake them; only a request to
their own URL does).

You *could* set up a free pinger (e.g. cron-job.org, no card) to hit each
service's URL every ~10 minutes and keep it awake — but don't do that for all
six: Render's free plan gives the whole workspace a shared pool of 750
instance-hours/month, and 6 services pinged 24/7 blows through that in about
5 days. Since nobody's actually trading against this deploy, there's nothing
urgent for those three processors to keep up with in real time — leave them
to spin up on demand. If you want the demo itself to always feel instantly
responsive for a visitor, only ping `exchange-api` and `exchange-ws`.

## 4. Vercel (frontend)

1. Import this repo into Vercel.
2. Set **Root Directory** to `frontend` (Vercel auto-detects Next.js from
   there — no other config needed).
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://exchange-api.onrender.com/api/v1`
   - `NEXT_PUBLIC_WS_URL` = `wss://exchange-ws.onrender.com`
4. Deploy.

## After deploying

Open the Vercel URL. First load may be slow while Render's free services
wake up — that's expected on the free tier, not a bug.
