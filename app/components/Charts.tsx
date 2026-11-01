"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PEOPLE, colorOf, type BinLog } from "@/lib/people";
import { DAY, londonParts, lower } from "@/lib/time";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Stats({ logs, now }: { logs: BinLog[]; now: number }) {
  const s = useMemo(() => {
    const total = logs.reduce((a, l) => a + l.bins, 0);
    const start = Date.UTC(2026, 8, 21);
    const weeks = Math.max(1, (now - start) / (7 * DAY));
    // runs = distinct (day) events, so a pair doing it together counts once
    const runTimes = [...new Set(logs.map((l) => Math.round(l.ts / 600_000)))].map((t) => t * 600_000).sort((a, b) => a - b);
    let drought = 0;
    for (let i = 1; i < runTimes.length; i++) drought = Math.max(drought, runTimes[i] - runTimes[i - 1]);
    if (runTimes.length) drought = Math.max(drought, now - runTimes[runTimes.length - 1]);
    const doubles = logs.filter((l) => l.bins === 2).length;
    return {
      total,
      perWeek: total / weeks,
      drought: Math.round(drought / DAY),
      doubleRate: logs.length ? Math.round((doubles / logs.length) * 100) : 0,
    };
  }, [logs, now]);

  return (
    <section className="reveal stats">
      <div>
        <span className="big-num">{s.total}</span>
        <span className="lbl">bins down total</span>
      </div>
      <div>
        <span className="big-num">{s.perWeek.toFixed(1)}</span>
        <span className="lbl">bins a week (should be like 4)</span>
      </div>
      <div>
        <span className="big-num">{s.drought}d</span>
        <span className="lbl">longest bin drought</span>
      </div>
      <div>
        <span className="big-num">{s.doubleRate}%</span>
        <span className="lbl">of runs were double hauls</span>
      </div>
    </section>
  );
}

export function Share({ board, total }: { board: { name: string; points: number }[]; total: number }) {
  const nonZero = board.filter((b) => b.points > 0);
  return (
    <section className="reveal">
      <h2 className="h2">who's carrying the flat</h2>
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

export function Race({ logs, now }: { logs: BinLog[]; now: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const h = 300;
  const pad = { l: 26, r: 92, t: 12, b: 26 };
  const start = Date.UTC(2026, 8, 21);
  const end = Math.max(now, start + 7 * DAY);

  const series = useMemo(() => {
    const sorted = logs.slice().sort((a, b) => a.ts - b.ts);
    return PEOPLE.map((p) => {
      let c = 0;
      const pts: [number, number][] = [[start, 0]];
      for (const l of sorted) if (l.name === p) { pts.push([l.ts, c]); c += l.bins; pts.push([l.ts, c]); }
      pts.push([end, c]);
      return { name: p as string, pts, final: c };
    });
  }, [logs, start, end]);

  const max = Math.max(2, ...series.map((s) => s.final));
  const iw = Math.max(100, width - pad.l - pad.r);
  const ih = h - pad.t - pad.b;
  const x = (t: number) => pad.l + ((t - start) / (end - start)) * iw;
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  // end labels, nudged so they don't overlap
  const labels = series
    .filter((s) => s.final > 0)
    .map((s) => ({ name: s.name, y: y(s.final), final: s.final }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
  const zeros = series.filter((s) => s.final === 0).map((s) => lower(s.name));

  const ticks = [];
  for (let v = 0; v <= max; v += max > 8 ? 2 : 1) ticks.push(v);
  const months: { t: number; label: string }[] = [];
  for (let m = 9; m <= 14; m++) {
    const t = Date.UTC(2026, m, 1);
    if (t > start && t < end) months.push({ t, label: lower(new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(t)) });
  }

  return (
    <section className="reveal">
      <h2 className="h2">the bin race</h2>
      <p className="sub">everyone's running total since move-in</p>
      <div ref={ref} className="race">
        <svg width={width} height={h} role="img" aria-label="cumulative bins per person over time">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} className="gridline" />
              <text x={pad.l - 8} y={y(v)} className="axis" textAnchor="end" dominantBaseline="central">{v}</text>
            </g>
          ))}
          {months.map((m) => (
            <text key={m.t} x={x(m.t)} y={h - 6} className="axis" textAnchor="middle">{m.label}</text>
          ))}
          {series.map((s, si) => (
            <path
              key={s.name}
              d={s.pts
                .map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${(y(v) + (s.final ? (si - 4.5) * 1.3 : 0)).toFixed(1)}`)
                .join("")}
              pathLength={1}
              className={`race-line ${s.final === 0 ? "flat" : ""}`}
              style={{ stroke: s.final === 0 ? undefined : colorOf(s.name) }}
            />
          ))}
          {labels.map((l) => (
            <text key={l.name} x={pad.l + iw + 8} y={l.y} className="race-label" dominantBaseline="central" style={{ fill: colorOf(l.name) }}>
              {lower(l.name)} {l.final}
            </text>
          ))}
          {zeros.length > 0 && (
            <text x={pad.l + iw + 8} y={y(0)} className="race-label zero" dominantBaseline="central">
              {zeros.join(", ")} 0
            </text>
          )}
        </svg>
      </div>
    </section>
  );
}

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
  const topDay = DOW[dow.indexOf(Math.max(...dow))];
  const topSlot = SLOTS[slots.indexOf(Math.max(...slots))].name;

  return (
    <section className="reveal timing">
      <div>
        <h2 className="h2">bin days</h2>
        <p className="sub">bins mostly go down on {topDay}s apparently</p>
        <div className="cols">
          {dow.map((v, i) => (
            <div key={i} className="colbar">
              <span className="v">{v || ""}</span>
              <span className="fill" style={{ height: `${(v / dmax) * 100}%`, animationDelay: `${i * 60}ms` }} />
              <span className="k">{DOW[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="h2">bin o'clock</h2>
        <p className="sub">peak bin time: {topSlot}</p>
        <ul className="slots">
          {SLOTS.map((s, i) => (
            <li key={s.name}>
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

