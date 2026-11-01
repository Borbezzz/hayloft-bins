"use client";

import { useEffect, useMemo, useState } from "react";
import type { BinLog } from "@/lib/people";
import { DAY, dayKey, keyToUtc, londonToUtc, lower, timeFmt, utcDateFmt } from "@/lib/time";
import { useCol } from "./colors";
import { pairUp } from "@/lib/runs";

type Props = {
  logs: BinLog[];
  now: number;
  who: string;
  pending: boolean;
  onAdd: (bins: 1 | 2, ts: number) => void;
  onRemove: (log: BinLog) => void;
};

const MONTHS = 4;
const FIRST = { y: 2026, m: 8 }; // sep 2026, move-in
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 3 ? 3 : 4);
const monthIdx = (y: number, m: number) => y * 12 + m;
const monthShort = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" });

export default function Heatmap({ logs, now, who, pending, onAdd, onRemove }: Props) {
  const colorOf = useCol();
  const todayKey = dayKey(now);
  const [ty, tm] = todayKey.split("-").map(Number);
  const firstIdx = monthIdx(FIRST.y, FIRST.m);
  const maxStart = Math.max(firstIdx, monthIdx(ty, tm - 1) - 2);
  const [startIdx, setStartIdx] = useState(maxStart);
  const [sel, setSel] = useState(todayKey);
  const [time, setTime] = useState("20:00");

  useEffect(() => {
    setTime(sel === todayKey ? timeFmt.format(Date.now()) : "20:00");
  }, [sel, todayKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, BinLog[]>();
    for (const l of logs) {
      const k = dayKey(l.ts);
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  }, [logs]);

  const { cells, nWeeks, monthCols, label } = useMemo(() => {
    const sy = Math.floor(startIdx / 12), sm = startIdx % 12;
    const ey = Math.floor((startIdx + MONTHS - 1) / 12), em = (startIdx + MONTHS - 1) % 12;
    const first = Date.UTC(sy, sm, 1);
    const last = Date.UTC(ey, em + 1, 0);
    const gridStart = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY;
    const gridEnd = last + ((7 - new Date(last).getUTCDay()) % 7) * DAY;
    const cells: { key: string; utc: number; inside: boolean }[] = [];
    for (let t = gridStart; t <= gridEnd; t += DAY) {
      cells.push({ key: new Date(t).toISOString().slice(0, 10), utc: t, inside: t >= first && t <= last });
    }
    const monthCols: { col: number; name: string }[] = [];
    for (let i = 0; i < MONTHS; i++) {
      const t = Date.UTC(sy, sm + i, 1);
      monthCols.push({ col: Math.floor((t - gridStart) / (7 * DAY)) + 1, name: lower(monthShort.format(t)) });
    }
    const label = `${monthCols[0].name} to ${monthCols[MONTHS - 1].name} ${ey}`;
    return { cells, nWeeks: cells.length / 7, monthCols, label };
  }, [startIdx]);

  const selLogs = (byDay.get(sel) ?? []).slice().sort((a, b) => a.ts - b.ts);
  const partners = useMemo(() => pairUp(logs), [logs]);
  const selTotal = selLogs.reduce((s, l) => s + l.bins, 0);
  const isToday = sel === todayKey;

  function pickDate(k: string) {
    if (!k || k > todayKey || k < "2026-09-01") return;
    setSel(k);
    const [y, m] = k.split("-").map(Number);
    const idx = monthIdx(y, m - 1);
    if (idx < startIdx || idx >= startIdx + MONTHS) setStartIdx(Math.min(maxStart, Math.max(firstIdx, idx - 1)));
  }

  function add(bins: 1 | 2) {
    let ts = londonToUtc(sel, time || "20:00");
    if (ts > Date.now()) ts = Date.now();
    onAdd(bins, ts);
  }

  return (
    <section className="reveal">
      <h2 className="h2">bin activity</h2>
      <p className="sub">tap a day to see who did what, add a bin you forgot, or delete one of yours</p>

      <div className="heat2">
        <div className="heat-nav">
          <button className="arrow" disabled={startIdx <= firstIdx} onClick={() => setStartIdx((i) => i - 1)} aria-label="earlier">
            ‹
          </button>
          <span className="mono small muted">{label}</span>
          <button className="arrow" disabled={startIdx >= maxStart} onClick={() => setStartIdx((i) => i + 1)} aria-label="later">
            ›
          </button>
        </div>
        <div className="heat-body">
          <div className="dows2">
            <span />
            {["mon", "", "wed", "", "fri", "", "sun"].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="heat-grid-wrap">
            <div className="months2" style={{ gridTemplateColumns: `repeat(${nWeeks}, 1fr)` }}>
              {monthCols.map((m) => (
                <span key={m.name} style={{ gridColumn: `${m.col} / span 3` }}>{m.name}</span>
              ))}
            </div>
            <div className="heat-grid" key={startIdx} style={{ gridTemplateColumns: `repeat(${nWeeks}, 1fr)` }}>
              {cells.map((d, i) => {
                const n = (byDay.get(d.key) ?? []).reduce((s, l) => s + l.bins, 0);
                const future = d.key > todayKey;
                if (!d.inside) return <span key={d.key} className="cell2 out" />;
                return (
                  <button
                    key={d.key}
                    className={`cell2 l${level(n)} ${future ? "future" : ""} ${d.key === sel ? "sel" : ""} ${d.key === todayKey ? "today" : ""}`}
                    style={{ animationDelay: `${Math.min(i * 4, 500)}ms` }}
                    title={`${lower(utcDateFmt.format(d.utc))}: ${n} ${n === 1 ? "bin" : "bins"}`}
                    aria-label={`${utcDateFmt.format(d.utc)}: ${n} bins`}
                    disabled={future}
                    onClick={() => setSel(d.key)}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <span className="legend">
          less <i className="cell2 l0" /><i className="cell2 l1" /><i className="cell2 l2" /><i className="cell2 l3" /><i className="cell2 l4" /> more
        </span>
      </div>

      <div className="editor" key={sel}>
        <div className="editor-head">
          <h3>
            {lower(utcDateFmt.format(keyToUtc(sel)))}
            {isToday && <span className="chip">today</span>}
          </h3>
          <span className="muted small">{selTotal} {selTotal === 1 ? "bin" : "bins"}</span>
        </div>

        {selLogs.length === 0 ? (
          <p className="muted empty">{isToday ? "nothing yet today. just saying" : "nobody. the bins just sat there"}</p>
        ) : (
          <ul className="day-list">
            {selLogs.map((l) => (
              <li key={l.id}>
                <span className="dot" style={{ background: colorOf(l.name) }} />
                <span>
                  <strong>{lower(l.name)}</strong> took {l.bins} {l.bins === 1 ? "bin" : "bins"}
                  {partners.get(l.id) && <span className="with"> with {lower(partners.get(l.id)!.name)}</span>}
                </span>
                <span className="mono muted small">{timeFmt.format(l.ts)}</span>
                {l.name === who ? (
                  <button className="del" disabled={pending} onClick={() => onRemove(l)}>delete</button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="add-box">
          <p className="small">
            forgot to log one? logging as <strong style={{ color: colorOf(who) }}>{lower(who)}</strong>
          </p>
          <div className="add-row">
            <input type="date" value={sel} min="2026-09-01" max={todayKey} onChange={(e) => pickDate(e.target.value)} aria-label="date" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="time" />
            <button className="pill" disabled={pending} onClick={() => add(1)}>+1 bin</button>
            <button className="pill" disabled={pending} onClick={() => add(2)}>+2 bins</button>
          </div>
        </div>
      </div>
    </section>
  );
}
