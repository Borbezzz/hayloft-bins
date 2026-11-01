import "server-only";
import { Redis } from "@upstash/redis";
import { SEED_LOGS, type BinLog } from "./people";

const LOGS_KEY = "hayloft711:logs";
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
