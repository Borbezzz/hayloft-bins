# hayloft 711 bins

who's actually taking the bins down. Next.js 16 + Upstash Redis.

- password gate (default `trash`, override with `SITE_PASSWORD`)
- pick your name once (cookie), "not you? switch" to change
- log 1 or 2 bins with confetti, undo from the toast
- tap any day on the heatmap to add a forgotten bin for that day or delete one of yours (with undo)
- live "who's here rn" tracker (heartbeat every 15s, data auto-refreshes every 30s)
- leaderboard, hall of shame, stats, share bar, bin race chart, bin days / bin o'clock, full log
- past runs from the group chat are seeded on first load (`lib/people.ts`)

## deploy on vercel

1. import this repo in Vercel
2. Storage → add **Upstash for Redis** (marketplace), connect it to the project. it sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`), both work
3. optional: set `SITE_PASSWORD`
4. deploy

without Redis env vars it runs on an in-memory store (fine for `npm run dev`, resets on restart).
