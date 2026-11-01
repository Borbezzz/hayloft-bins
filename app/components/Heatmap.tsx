"use client";

import { useEffect, useMemo, useState } from "react";
import { colorOf, type BinLog } from "@/lib/people";
import { DAY, dayKey, keyToUtc, londonToUtc, lower, monthFmt, timeFmt, utcDateFmt } from "@/lib/time";

type Props = {
  logs: BinLog[];
  now: number;
  who: string;
  pending: boolean;
  onAdd: (bins: 1 | 2, ts: number) => void;
  onRemove: (log: BinLog) => void;
};

const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 3 ? 3 : 4);

export default function Heatmap({ logs, now, who, pending, onAdd, onRemove }: Props) {
  const todayKey = dayKey(now);
  const [sel, setSel] = useState(todayKey);
  const [time, setTime] = useState("20:00");

  // sensible default time: now for today, evening for past days
  useEffect(() => {
    if (sel === todayKey) setTime(timeFmt.format(Date.now()));
    else setTime("20:00");
  }, [sel, todayKey]);

  const { weeks, byDay } = useMemo(() => {
    const byDay = new Map<string, BinLog[]>();
    for (const l of logs) {
      const k = dayKey(l.ts);
      byDay.set(k, [...(byDay.get(k) ?? []), l]);
    }
    const start = Date.UTC(2026, 8, 21); // mon 21 sep 2026, move-in week
    const today = keyToUtc(todayKey);
    const endOfThisWeek = today + ((7 - new Date(today).getUTCDay()) % 7) * DAY;
    const end = Math.max(endOfThisWeek, Date.UTC(2026, 11, 20));
    const weeks: { key: string; utc: number }[][] = [];
    for (let t = start; t <= end; t += DAY) {
      if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([]);
      weeks[weeks.length - 1].push({ key: new Date(t).toISOString().slice(0, 10), utc: t });
    }
    return { weeks, byDay };
  }, [logs, todayKey]);

  const selLogs = (byDay.get(sel) ?? []).slice().sort((a, b) => a.ts - b.ts);
  const selLabel = lower(utcDateFmt.format(keyToUtc(sel)));
  const isToday = sel === todayKey;
  const isFuture = sel > todayKey;

  function add(bins: 1 | 2) {
    let ts = londonToUtc(sel, time || "20:00");
    if (ts > Date.now()) ts = Date.now();
    onAdd(bins, ts);
  }

  let cellIndex = 0;
  return (
    <section className="reveal">
      <h2 className="h2">bin activity</h2>
      <p className="sub">tap a day to see who did what, add a bin u forgot, or delete one of urs</p>
      <div className="heat-scroll">
        <div className="heat">
          <div className="months">
            {weeks.map((w, i) => {
              const m = monthFmt.format(w[0].utc);
              const prev = i > 0 ? monthFmt.format(weeks[i - 1][0].utc) : "";
              return <span key={i}>{m !== prev ? lower(m) : ""}</span>;
            })}
          </div>
          <div className="grid-wrap">
            <div className="dows">
              <span>mon</span><span /><span>wed</span><span /><span>fri</span><span /><span>sun</span>
            </div>
            <div className="grid">
              {weeks.map((w, i) => (
                <div className="col" key={i}>
                  {w.map((d) => {
                    const n = (byDay.get(d.key) ?? []).reduce((s, l) => s + l.bins, 0);
                    const future = d.key > todayKey;
                    const idx = cellIndex++;
                    return (
                      <button
                        key={d.key}
                        className={`cell l${level(n)} ${future ? "future" : ""} ${d.key === sel ? "sel" : ""} ${d.key === todayKey ? "today" : ""}`}
                        style={{ animationDelay: `${Math.min(idx * 6, 600)}ms` }}
                        aria-label={`${utcDateFmt.format(d.utc)}: ${n} bins`}
                        title={`${lower(utcDateFmt.format(d.utc))}: ${n} ${n === 1 ? "bin" : "bins"}`}
                        disabled={future}
                        onClick={() => setSel(d.key)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <span className="legend">
            less <i className="cell l0" /><i className="cell l1" /><i className="cell l2" /><i className="cell l3" /><i className="cell l4" /> more
          </span>
        </div>
      </div>

      <div className="editor" key={sel}>
        <div className="editor-head">
          <h3>{selLabel}{isToday && <span className="chip">today</span>}</h3>
          <span className="muted small">
            {selLogs.reduce((s, l) => s + l.bins, 0)} {selLogs.reduce((s, l) => s + l.bins, 0) === 1 ? "bin" : "bins"}
          </span>
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
                </span>
                <span className="mono muted small">{timeFmt.format(l.ts)}</span>
                {l.name === who ? (
                  <button className="del" disabled={pending} onClick={() => onRemove(l)} aria-label="delete this log">
                    delete
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}

        {!isFuture && (
          <div className="add-row">
            <span className="muted small">{isToday ? "add for today at" : "forgot to log? add for this day at"}</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="time"
            />
            <button className="pill" disabled={pending} onClick={() => add(1)}>+1 bin</button>
            <button className="pill" disabled={pending} onClick={() => add(2)}>+2 bins</button>
          </div>
        )}
      </div>
    </section>
  );
}
