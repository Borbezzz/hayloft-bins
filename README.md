# hayloft 711 bins

who's actually taking the bins down. Next.js 16 + Upstash Redis.

- password gate (default `trash`, override with `SITE_PASSWORD`)
- pick your name once (cookie), "not you? switch" to change
- log 1 or 2 bins, undo your own log within 15 min
- leaderboard, hall of shame, github-style heatmap, full log
- past runs from the group chat are seeded on first load (`lib/people.ts`)

## deploy on vercel

1. import this repo in Vercel
2. Storage → add **Upstash for Redis** (marketplace), connect it to the project. it sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`), both work
3. optional: set `SITE_PASSWORD`
4. deploy

without Redis env vars it runs on an in-memory store (fine for `npm run dev`, resets on restart).
