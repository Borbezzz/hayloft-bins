"use client";

import { useMemo } from "react";
import { PEOPLE, type BinLog } from "@/lib/people";
import type { Ping } from "@/lib/store";
import { DAY, lower } from "@/lib/time";
import { useCol } from "./colors";

const MOVE_IN = Date.UTC(2026, 8, 21);

/*
  bin pressure (psi), higher = should go next
  - 12 per bin below the flat average (or -12 per bin above it)
  - 1.5 per day since their last bin run (never = since move-in), capped at 30 days
  - 10 per ping since their last run
*/
export function computePressure(logs: BinLog[], pings: Ping[], now: number) {
  const pts = new Map<string, number>(PEOPLE.map((p) => [p, 0]));
  const last = new Map<string, number>();
  for (const l of logs) {
    pts.set(l.name, (pts.get(l.name) ?? 0) + l.bins);
    last.set(l.name, Math.max(last.get(l.name) ?? 0, l.ts));
  }
  const avg = [...pts.values()].reduce((a, b) => a + b, 0) / PEOPLE.length;
  return PEOPLE.map((name) => {
    const points = pts.get(name) ?? 0;
    const lastTs = last.get(name);
    const days = Math.min(30, (now - (lastTs ?? MOVE_IN)) / DAY);
    const myPings = pings.filter((p) => p.to === name && p.ts > (lastTs ?? 0));
    const score = Math.max(0, Math.round((avg - points) * 12 + days * 1.5 + myPings.length * 10));
    return { name: name as string, points, lastTs, days, pings: myPings, score };
  }).sort((a, b) => b.score - a.score || a.points - b.points);
}

type Props = {
  logs: BinLog[];
  pings: Ping[];
  now: number;
  who: string;
  pending: boolean;
  onPing: (name: string) => void;
};

export default function UpNext({ logs, pings, now, who, pending, onPing }: Props) {
  const colorOf = useCol();
  const rows = useMemo(() => computePressure(logs, pings, now), [logs, pings, now]);
  const max = Math.max(1, ...rows.map((r) => r.score));
  const top = rows[0];
  const iAmNext = top.name === who;

  const why = (r: (typeof rows)[number]) => {
    const bits = [`${r.points} ${r.points === 1 ? "bin" : "bins"}`];
    bits.push(r.lastTs ? `last went ${Math.floor(r.days) === 0 ? "today" : `${Math.floor(r.days)}d ago`}` : "has literally never gone");
    if (r.pings.length) bits.push(`pinged ${r.pings.length}x`);
    return bits.join(" · ");
  };

  return (
    <section className="upnext reveal">
      <h2 className="h2">who should go next</h2>
      <p className="sub">bin pressure, based on how many bins u took, how long it&apos;s been, and how many times u got pinged</p>

      <div className="next-hero" style={{ ["--c" as string]: colorOf(top.name) }}>
        <span className="next-label">up next</span>
        <span className="next-name">{iAmNext ? "it's u. go" : lower(top.name)}</span>
        <span className="next-why">
          {top.score} psi · {why(top)}
          {top.pings.length > 0 && ` (by ${[...new Set(top.pings.map((p) => lower(p.from)))].join(", ")})`}
        </span>
      </div>

      <ol className="pressure">
        {rows.map((r, i) => {
          const pingedByMe = r.pings.some((p) => p.from === who && now - p.ts < 6 * 3_600_000);
          return (
            <li key={r.name} className={r.name === who ? "me" : ""}>
              <span className="rank">{i + 1}</span>
              <span className="who">
                <span>
                  {lower(r.name)}
                  {r.name === who && <span className="you"> (u)</span>}
                </span>
                <span className="why">{why(r)}</span>
              </span>
              <span className="gauge">
                <span
                  className="gauge-fill"
                  style={{ width: `${(r.score / max) * 100}%`, background: colorOf(r.name), animationDelay: `${i * 50}ms` }}
                />
              </span>
              <span className="psi mono">{r.score}</span>
              {r.name === who ? (
                <span />
              ) : (
                <button className="ping" disabled={pending || pingedByMe} onClick={() => onPing(r.name)}>
                  {pingedByMe ? "pinged" : "ping"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <p className="fine">
        a ping adds 10 psi until they take the bins down. u can ping each person once every 6h. psi = bin pressure, obviously
      </p>
    </section>
  );
}
