import "server-only";
import { Redis } from "@upstash/redis";
import { SEED_LOGS, type BinLog, type Person } from "./people";

const LOGS_KEY = "hayloft711:logs";
const LEGACY: Record<string, Person> = { Saya: "sv.xaya" };
const SEEDED_KEY = "hayloft711:seeded";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

// Local dev fallback when no Redis env vars are set. Resets on restart.
const g = globalThis as unknown as { __binMem?: Map<string, BinLog> };
function mem() {
  if (!g.__binMem) g.__binMem = new Map(SEED_LOGS.map((l) => [l.id, l]));
  return g.__binMem;
}

async function ensureSeeded(r: Redis) {
  const first = await r.set(SEEDED_KEY, "1", { nx: true });
  if (first) {
    const entries: Record<string, string> = {};
    for (const l of SEED_LOGS) entries[l.id] = JSON.stringify(l);
    await r.hset(LOGS_KEY, entries);
  }
}

export async function getLogs(): Promise<BinLog[]> {
  let logs: BinLog[];
  if (!redis) {
    logs = [...mem().values()];
  } else {
    await ensureSeeded(redis);
    const all = (await redis.hgetall<Record<string, unknown>>(LOGS_KEY)) ?? {};
    logs = Object.values(all).map((v) =>
      typeof v === "string" ? (JSON.parse(v) as BinLog) : (v as BinLog),
    );
    // one-off fix for logs stored under an old name (e.g. "Saya" -> "sv.xaya")
    const renamed = logs.filter((l) => LEGACY[l.name as string]);
    if (renamed.length) {
      for (const l of renamed) l.name = LEGACY[l.name as string];
      const fixed: Record<string, string> = {};
      for (const l of renamed) fixed[l.id] = JSON.stringify(l);
      await redis.hset(LOGS_KEY, fixed);
    }
  }
  return logs.sort((a, b) => b.ts - a.ts);
}

export async function addLog(log: BinLog) {
  if (!redis) {
    mem().set(log.id, log);
    return;
  }
  await ensureSeeded(redis);
  await redis.hset(LOGS_KEY, { [log.id]: JSON.stringify(log) });
}

export async function getLog(id: string): Promise<BinLog | null> {
  if (!redis) return mem().get(id) ?? null;
  const v = await redis.hget<unknown>(LOGS_KEY, id);
  if (!v) return null;
  return typeof v === "string" ? (JSON.parse(v) as BinLog) : (v as BinLog);
}

export async function deleteLog(id: string) {
  if (!redis) {
    mem().delete(id);
    return;
  }
  await redis.hdel(LOGS_KEY, id);
}

// ---- presence: who has the site open right now ----
const PRESENCE_KEY = "hayloft711:presence";
const PRESENCE_TTL = 45_000;
const gp = globalThis as unknown as { __binPresence?: Map<string, number> };

export async function heartbeat(name: string): Promise<string[]> {
  const now = Date.now();
  let all: Record<string, number>;
  if (!redis) {
    if (!gp.__binPresence) gp.__binPresence = new Map();
    gp.__binPresence.set(name, now);
    all = Object.fromEntries(gp.__binPresence);
  } else {
    await redis.hset(PRESENCE_KEY, { [name]: now });
    all = ((await redis.hgetall<Record<string, number | string>>(PRESENCE_KEY)) ?? {}) as Record<string, number>;
  }
  const live = Object.entries(all)
    .filter(([, t]) => now - Number(t) < PRESENCE_TTL)
    .map(([n]) => n);
  const stale = Object.keys(all).filter((n) => !live.includes(n));
  if (redis && stale.length) await redis.hdel(PRESENCE_KEY, ...stale);
  return live.sort();
}

export async function leave(name: string) {
  if (!redis) gp.__binPresence?.delete(name);
  else await redis.hdel(PRESENCE_KEY, name);
}

// ---- colours ----
const COLORS_KEY = "hayloft711:colors";
const gc = globalThis as unknown as { __binColors?: Record<string, number> };

export async function getColors(): Promise<Record<string, number>> {
  if (!redis) return { ...(gc.__binColors ?? {}) };
  const all = (await redis.hgetall<Record<string, number | string>>(COLORS_KEY)) ?? {};
  return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, Number(v)]));
}

export async function saveColor(name: string, hue: number) {
  if (!redis) {
    gc.__binColors = { ...(gc.__binColors ?? {}), [name]: hue };
    return;
  }
  await redis.hset(COLORS_KEY, { [name]: hue });
}

// ---- pings: nudge someone to take the bins down ----
export type Ping = { id: string; from: string; to: string; ts: number };
const PINGS_KEY = "hayloft711:pings";
const gpi = globalThis as unknown as { __binPings?: Map<string, Ping> };
const PING_KEEP = 21 * 86_400_000;

export async function getPings(): Promise<Ping[]> {
  let all: Ping[];
  if (!redis) all = [...(gpi.__binPings?.values() ?? [])];
  else {
    const raw = (await redis.hgetall<Record<string, unknown>>(PINGS_KEY)) ?? {};
    all = Object.values(raw).map((v) => (typeof v === "string" ? JSON.parse(v) : v) as Ping);
    const old = all.filter((p) => Date.now() - p.ts > PING_KEEP).map((p) => p.id);
    if (old.length) await redis.hdel(PINGS_KEY, ...old);
  }
  return all.filter((p) => Date.now() - p.ts <= PING_KEEP).sort((a, b) => b.ts - a.ts);
}

export async function addPing(p: Ping) {
  if (!redis) {
    if (!gpi.__binPings) gpi.__binPings = new Map();
    gpi.__binPings.set(p.id, p);
    return;
  }
  await redis.hset(PINGS_KEY, { [p.id]: JSON.stringify(p) });
}
