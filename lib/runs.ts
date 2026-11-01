import type { BinLog } from "./people";

export const TOGETHER_WINDOW = 60 * 60 * 1000; // 1 bin each within an hour = took them down together

/** id -> the log it was paired with (two people, 1 bin each, within an hour) */
export function pairUp(logs: BinLog[]) {
  const sorted = logs.slice().sort((a, b) => a.ts - b.ts);
  const partner = new Map<string, BinLog>();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (a.bins !== 1 || partner.has(a.id)) continue;
    for (let j = i + 1; j < sorted.length && sorted[j].ts - a.ts <= TOGETHER_WINDOW; j++) {
      const b = sorted[j];
      if (b.bins === 1 && b.name !== a.name && !partner.has(b.id)) {
        partner.set(a.id, b);
        partner.set(b.id, a);
        break;
      }
    }
  }
  return partner;
}

/** collapse logs into runs: a pair counts as one run of 2 bins */
export function toRuns(logs: BinLog[]) {
  const partner = pairUp(logs);
  const seen = new Set<string>();
  const runs: { ts: number; bins: number; people: string[] }[] = [];
  for (const l of logs.slice().sort((a, b) => a.ts - b.ts)) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const p = partner.get(l.id);
    if (p) {
      seen.add(p.id);
      runs.push({ ts: Math.min(l.ts, p.ts), bins: 2, people: [l.name, p.name] });
    } else runs.push({ ts: l.ts, bins: l.bins, people: [l.name] });
  }
  return runs;
}
