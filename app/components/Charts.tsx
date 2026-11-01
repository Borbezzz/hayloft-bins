"use client";

import { useMemo } from "react";
import { PEOPLE, type BinLog } from "@/lib/people";
import { DAY, dateFmt, dayKey, keyToUtc, londonParts, lower } from "@/lib/time";
import { useCol } from "./colors";
import { toRuns } from "@/lib/runs";

type Board = { name: string; points: number }[];
const MOVE_IN = Date.UTC(2026, 8, 21); // mon 21 sep 2026

function joinWords(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`;
}

/* ---------- headline numbers ---------- */
export function Stats({ logs, now }: { logs: BinLog[]; now: number }) {
  const s = useMemo(() => {
    const total = logs.reduce((a, l) => a + l.bins, 0);
    const weeks = Math.max(1, (now - MOVE_IN) / (7 * DAY));
    const runList = toRuns(logs);
    const runs = runList.map((r) => r.ts);
    let drought = 0;
    for (let i = 1; i < runs.length; i++) drought = Math.max(drought, runs[i] - runs[i - 1]);
    if (runs.length) drought = Math.max(drought, now - runs[runs.length - 1]);
    const doubles = runList.filter((r) => r.bins === 2).length;
    const together = runList.filter((r) => r.people.length === 2).length;
    return {
      total,
      perWeek: total / weeks,
      drought: Math.round(drought / DAY),
      doubleRate: runList.length ? Math.round((doubles / runList.length) * 100) : 0,
      together,
    };
  }, [logs, now]);

  return (
    <section className="reveal stats">
      <div><span className="big-num">{s.total}</span><span className="lbl">bins down total</span></div>
      <div><span className="big-num">{s.perWeek.toFixed(1)}</span><span className="lbl">bins a week (should be like 4)</span></div>
      <div><span className="big-num">{s.drought}d</span><span className="lbl">longest bin drought</span></div>
      <div><span className="big-num">{s.doubleRate}%</span><span className="lbl">of runs were double hauls ({s.together} done as a pair)</span></div>
    </section>
  );
}

/* ---------- share of bins ---------- */
export function Share({ board, total }: { board: Board; total: number }) {
  const colorOf = useCol();
  const nonZero = board.filter((b) => b.points > 0);
  return (
    <section className="reveal">
      <h2 className="h2">who&apos;s carrying the flat</h2>
      <div className="share">
        {nonZero.map((b, i) => (
          <span
            key={b.name}
            className="seg"
            style={{ flexGrow: b.points, background: colorOf(b.name), animationDelay: `${i * 70}ms` }}
            title={`${lower(b.name)}: ${b.points}`}
          />
        ))}
      </div>
      <ul className="share-legend">
        {nonZero.map((b) => (
          <li key={b.name}>
            <span className="dot" style={{ background: colorOf(b.name) }} />
            {lower(b.name)} <span className="muted">{Math.round((b.points / Math.max(1, total)) * 100)}%</span>
          </li>
        ))}
        {board.filter((b) => b.points === 0).map((b) => (
          <li key={b.name} className="zero">
            <span className="dot hollow" />
            {lower(b.name)} <span>0%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- bins per week, stacked by person ---------- */
export function Weekly({ logs, now }: { logs: BinLog[]; now: number }) {
  const colorOf = useCol();
  const TARGET = 4;
  const weeks = useMemo(() => {
    const todayUtc = keyToUtc(dayKey(now));
    const n = Math.floor((todayUtc - MOVE_IN) / (7 * DAY)) + 1;
    const ws = Array.from({ length: n }, (_, i) => ({ start: MOVE_IN + i * 7 * DAY, parts: new Map<string, number>(), total: 0 }));
    for (const l of logs) {
      const i = Math.floor((keyToUtc(dayKey(l.ts)) - MOVE_IN) / (7 * DAY));
      if (i < 0 || i >= n) continue;
      ws[i].parts.set(l.name, (ws[i].parts.get(l.name) ?? 0) + l.bins);
      ws[i].total += l.bins;
    }
    return ws;
  }, [logs, now]);
  const max = Math.max(TARGET + 1, ...weeks.map((w) => w.total));
  const hit = weeks.filter((w) => w.total >= TARGET).length;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

  return (
    <section className="reveal">
      <h2 className="h2">bins per week</h2>
      <p className="sub">
        we hit 4 bins a week {hit === 0 ? "zero times. not once" : `${hit} out of ${weeks.length} weeks`}
      </p>
      <div className="weeks">
        <span className="target" style={{ bottom: `calc(38px + (100% - 38px) * ${TARGET / max})` }}>
          <em>4 a week</em>
        </span>
        {weeks.map((w, i) => (
          <div key={i} className="wk">
            <div className="stack" style={{ height: `${(w.total / max) * 100}%`, animationDelay: `${i * 60}ms` }}>
              {[...w.parts.entries()].map(([name, v]) => (
                <span key={name} style={{ flexGrow: v, background: colorOf(name) }} title={`${lower(name)}: ${v}`} />
              ))}
            </div>
            <span className="wk-v mono">{w.total || ""}</span>
            {i % Math.ceil(weeks.length / 8) === 0 && <span className="wk-k mono">{lower(fmt.format(w.start))}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- timeline: every run as a dot, one row per person ---------- */
export function Timeline({ logs, now, board }: { logs: BinLog[]; now: number; board: Board }) {
  const colorOf = useCol();
  const end = Math.max(now, MOVE_IN + 14 * DAY);
  const pos = (t: number) => `${((t - MOVE_IN) / (end - MOVE_IN)) * 100}%`;
  const months: { t: number; label: string }[] = [];
  for (let m = 9; Date.UTC(2026, m, 1) < end; m++) {
    const t = Date.UTC(2026, m, 1);
    if (t > MOVE_IN && t < end - (end - MOVE_IN) * 0.08) months.push({ t, label: lower(new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(t)) });
  }
  return (
    <section className="reveal">
      <h2 className="h2">bin timeline</h2>
      <p className="sub">every bin run since move-in. big dot = 2 bins</p>
      <div className="tl">
        {board.map((b) => {
          const mine = logs.filter((l) => l.name === b.name);
          return (
            <div key={b.name} className={`tl-row ${b.points === 0 ? "zero" : ""}`}>
              <span className="tl-name">{lower(b.name)}</span>
              <span className="tl-track">
                {months.map((m) => <i key={m.t} className="tl-tick" style={{ left: pos(m.t) }} />)}
                {mine.map((l, i) => (
                  <span
                    key={l.id}
                    className={`tl-dot ${l.bins === 2 ? "two" : ""}`}
                    style={{ left: pos(l.ts), background: colorOf(l.name), animationDelay: `${i * 80}ms` }}
                    title={`${lower(dateFmt.format(l.ts))}: ${l.bins} ${l.bins === 1 ? "bin" : "bins"}`}
                  />
                ))}
                {b.points === 0 && <span className="tl-none">nothing. ever.</span>}
              </span>
            </div>
          );
        })}
        <div className="tl-row axis-row">
          <span />
          <span className="tl-track">
            {months.map((m) => <span key={m.t} className="tl-month" style={{ left: pos(m.t) }}>{m.label}</span>)}
            <span className="tl-month now" style={{ left: "100%" }}>now</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------- when do bins go down ---------- */
const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SLOTS = [
  { name: "morning", from: 5, to: 12 },
  { name: "afternoon", from: 12, to: 17 },
  { name: "evening", from: 17, to: 21 },
  { name: "late night", from: 21, to: 29 },
];

export function When({ logs }: { logs: BinLog[] }) {
  const { dow, slots } = useMemo(() => {
    const dow = Array(7).fill(0);
    const slots = Array(4).fill(0);
    for (const l of logs) {
      const p = londonParts(l.ts);
      dow[p.weekday] += l.bins;
      const hr = p.hour < 5 ? p.hour + 24 : p.hour;
      slots[SLOTS.findIndex((s) => hr >= s.from && hr < s.to)] += l.bins;
    }
    return { dow, slots };
  }, [logs]);
  const dmax = Math.max(1, ...dow);
  const smax = Math.max(1, ...slots);
  const topDays = DOW.filter((_, i) => dow[i] === Math.max(...dow) && dow[i] > 0).map((d) => `${d}s`);
  const deadDays = DOW.filter((_, i) => dow[i] === 0).map((d) => `${d}s`);
  const topSlots = SLOTS.filter((_, i) => slots[i] === Math.max(...slots) && slots[i] > 0).map((s) => s.name);

  return (
    <section className="reveal timing">
      <div>
        <h2 className="h2">bin days</h2>
        <p className="sub">
          {topDays.length ? `bins mostly go down on ${joinWords(topDays)}` : "no bin days yet"}
          {deadDays.length ? `. nobody's ever done it on ${joinWords(deadDays)}` : ""}
        </p>
        <div className="cols">
          {dow.map((v, i) => (
            <div key={i} className={`colbar ${v === Math.max(...dow) && v > 0 ? "top" : ""}`}>
              <span className="v">{v || ""}</span>
              <span className="fill" style={{ height: `${(v / dmax) * 100}%`, animationDelay: `${i * 60}ms` }} />
              <span className="k">{DOW[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="h2">bin o&apos;clock</h2>
        <p className="sub">{topSlots.length ? `peak bin time: ${joinWords(topSlots)}` : "no data yet"}</p>
        <ul className="slots">
          {SLOTS.map((s, i) => (
            <li key={s.name} className={slots[i] === Math.max(...slots) && slots[i] > 0 ? "top" : ""}>
              <span className="k">{s.name}</span>
              <span className="track">
                <span className="fill" style={{ width: `${(slots[i] / smax) * 100}%`, animationDelay: `${i * 80}ms` }} />
              </span>
              <span className="v mono">{slots[i]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- last seen + bin buddies ---------- */
export function LastSeen({ logs, now }: { logs: BinLog[]; now: number }) {
  const colorOf = useCol();
  const rows = PEOPLE.map((p) => {
    const last = logs.find((l) => l.name === p); // logs are newest first
    return { name: p as string, ago: last ? Math.floor((now - last.ts) / DAY) : Infinity };
  }).sort((a, b) => b.ago - a.ago);

  const say = (d: number) => (d === Infinity ? "never. not once" : d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`);

  return (
    <section className="reveal">
      <div>
        <h2 className="h2">last seen at the bin room</h2>
        <p className="sub">longest gone at the top</p>
        <ul className="seen">
          {rows.map((r) => (
            <li key={r.name} className={r.ago === Infinity ? "never" : r.ago >= 10 ? "stale" : ""}>
              <span className="dot" style={{ background: colorOf(r.name) }} />
              <span className="who">{lower(r.name)}</span>
              <span className="when-txt">{say(r.ago)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
