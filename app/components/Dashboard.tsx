"use client";

import { useMemo, useState, useTransition } from "react";
import { PEOPLE, type BinLog, type Person } from "@/lib/people";
import { forgetName, logBins, undoLog } from "../actions";

const TZ = "Europe/London";
const DAY = 86_400_000;

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const utcDateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" });

const dayKey = (ts: number) => keyFmt.format(ts); // YYYY-MM-DD in London
const lower = (s: string) => s.toLowerCase();

const ROASTS = [
  "0 bins. ain't no way",
  "has never seen the bin room on god",
  "thinks the bins take themselves down",
  "bin room? never heard of her",
  "lowkey just vibing while the bins overflow",
];

function roastFor(name: string) {
  return ROASTS[PEOPLE.indexOf(name as Person) % ROASTS.length];
}

function ago(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "like just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

type Props = { who: Person; logs: BinLog[]; now: number; undoWindowMs: number };

export default function Dashboard({ who, logs, now, undoWindowMs }: Props) {
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState<{ text: string; id?: string } | null>(null);

  const board = useMemo(() => {
    const pts = new Map<Person, number>(PEOPLE.map((p) => [p, 0]));
    for (const l of logs) pts.set(l.name, (pts.get(l.name) ?? 0) + l.bins);
    return [...pts.entries()]
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }, [logs]);

  const max = Math.max(1, ...board.map((b) => b.points));
  const total = board.reduce((s, b) => s + b.points, 0);
  const shame = board.filter((b) => b.points === 0);
  const me = board.find((b) => b.name === who)!;
  const myRank = board.filter((b) => b.points > me.points).length + 1;
  const last = logs[0];
  const nonZero = board.filter((b) => b.points > 0);
  const lowestNonZero = nonZero.length > 1 ? nonZero[nonZero.length - 1].points : -1;

  function doLog(bins: 1 | 2) {
    start(async () => {
      const res = await logBins(bins);
      if ("error" in res) setFlash({ text: res.error });
      else
        setFlash({
          id: res.id,
          text: bins === 2 ? "+2 logged. double bin W fr" : "+1 logged. lowkey a W",
        });
    });
  }

  function doUndo(id: string) {
    start(async () => {
      await undoLog(id);
      setFlash({ text: "undone. we saw that tho" });
    });
  }

  let status: string;
  if (!last) status = "no bins ever. the kitchen is a biohazard";
  else {
    const gap = now - last.ts;
    const days = Math.floor(gap / DAY);
    if (days >= 4) status = `${days} days since anyone took the bins down. something in that kitchen is evolving`;
    else status = `bins last went down ${ago(gap)}, by ${lower(last.name)}`;
  }

  return (
    <main className="shell">
      <header className="top">
        <span className="kicker">hayloft 711 bins</span>
        <button className="link" onClick={() => start(() => forgetName())}>
          not {lower(who)}? switch
        </button>
      </header>

      <section className="hero">
        <h1 className="title">yo {lower(who)}, took the bins down?</h1>
        <div className="big-btns">
          <button className="big" disabled={pending} onClick={() => doLog(1)}>
            <span className="num">1</span>
            <span>bin</span>
          </button>
          <button className="big" disabled={pending} onClick={() => doLog(2)}>
            <span className="num">2</span>
            <span>bins</span>
          </button>
        </div>
        <p className="flash" aria-live="polite">
          {flash ? (
            <>
              {flash.text}
              {flash.id && (
                <button className="link" disabled={pending} onClick={() => doUndo(flash.id!)}>
                  misclicked? undo
                </button>
              )}
            </>
          ) : (
            <span className="muted">
              {me.points === 0
                ? "u have 0 bins. the whole flat can see this btw"
                : `ur #${myRank} with ${me.points} ${me.points === 1 ? "bin" : "bins"}`}
            </span>
          )}
        </p>
        <p className="status">{status}</p>
      </section>

      {shame.length > 0 && (
        <section className="shame">
          <h2 className="h2">hall of shame</h2>
          <p className="shame-line">
            {shame.map((s, i) => (
              <span key={s.name}>
                <strong>{lower(s.name)}</strong>
                {i < shame.length - 2 ? ", " : i === shame.length - 2 ? " & " : ""}
              </span>
            ))}{" "}
            {shame.length === 1 ? "has" : "have"} taken down <em>zero</em> bins.
            <br />
            {total} bins have gone down without {shame.length === 1 ? "their" : "any of their"} help. on god
          </p>
        </section>
      )}

      <section>
        <h2 className="h2">the bin board</h2>
        <ol className="board">
          {board.map((b) => {
            const rank = board.filter((x) => x.points > b.points).length + 1;
            const note =
              b.points === 0
                ? roastFor(b.name)
                : rank === 1
                  ? "bin lord 👑"
                  : b.points === lowestNonZero
                    ? "doing the bare minimum"
                    : "";
            return (
              <li key={b.name} className={`row ${b.points === 0 ? "zero" : ""} ${b.name === who ? "me" : ""}`}>
                <span className="rank">{rank}</span>
                <span className="who">
                  {lower(b.name)}
                  {b.name === who && <span className="you"> (u)</span>}
                </span>
                <span className="bar-wrap">
                  <span className="bar" style={{ width: `${(b.points / max) * 100}%` }} />
                </span>
                <span className="pts">{b.points}</span>
                {note && <span className="note">{note}</span>}
              </li>
            );
          })}
        </ol>
        <p className="fine">1 bin = 1 point. no points for "i was gonna do it"</p>
      </section>

      <Heatmap logs={logs} now={now} />

      <section>
        <h2 className="h2">the receipts</h2>
        <ul className="log">
          {logs.map((l) => {
            const canUndo = l.name === who && !l.fromChat && now - l.ts < undoWindowMs;
            return (
              <li key={l.id}>
                <span className="when">
                  {lower(dateFmt.format(l.ts))} <span className="muted">{timeFmt.format(l.ts)}</span>
                </span>
                <span className="what">
                  <strong>{lower(l.name)}</strong> took {l.bins} {l.bins === 1 ? "bin" : "bins"}
                </span>
                <span className="tag">
                  {l.fromChat ? "from gc" : canUndo ? (
                    <button className="link" disabled={pending} onClick={() => doUndo(l.id)}>undo</button>
                  ) : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="fine foot">
        made for hayloft 711. stuff from before this site existed was pulled from the gc. cookies only
        remember who u are
      </footer>
    </main>
  );
}

function Heatmap({ logs, now }: { logs: BinLog[]; now: number }) {
  const todayKey = dayKey(now);
  const [sel, setSel] = useState(todayKey);

  const { weeks, byDay } = useMemo(() => {
    const byDay = new Map<string, BinLog[]>();
    for (const l of logs) {
      const k = dayKey(l.ts);
      byDay.set(k, [...(byDay.get(k) ?? []), l]);
    }
    const start = Date.UTC(2026, 8, 21); // monday 21 sep 2026, move-in week
    const [ty, tm, td] = todayKey.split("-").map(Number);
    const today = Date.UTC(ty, tm - 1, td);
    const endOfThisWeek = today + ((7 - new Date(today).getUTCDay()) % 7) * DAY;
    const end = Math.max(endOfThisWeek, Date.UTC(2026, 11, 20));
    const weeks: { key: string; utc: number }[][] = [];
    for (let t = start; t <= end; t += DAY) {
      if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([]);
      weeks[weeks.length - 1].push({ key: new Date(t).toISOString().slice(0, 10), utc: t });
    }
    return { weeks, byDay };
  }, [logs, todayKey]);

  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 3 ? 3 : 4);
  const selLogs = byDay.get(sel) ?? [];
  const selDay = weeks.flat().find((d) => d.key === sel);

  return (
    <section>
      <h2 className="h2">bin activity</h2>
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
              <span>mon</span><span /><span>wed</span><span /><span>fri</span><span /><span />
            </div>
            <div className="grid">
              {weeks.map((w, i) => (
                <div className="col" key={i}>
                  {w.map((d) => {
                    const ls = byDay.get(d.key) ?? [];
                    const n = ls.reduce((s, l) => s + l.bins, 0);
                    const future = d.key > todayKey;
                    return (
                      <button
                        key={d.key}
                        className={`cell l${level(n)} ${future ? "future" : ""} ${d.key === sel ? "sel" : ""} ${d.key === todayKey ? "today" : ""}`}
                        aria-label={`${utcDateFmt.format(d.utc)}: ${n} bins`}
                        title={`${utcDateFmt.format(d.utc)}: ${n} bins`}
                        disabled={future}
                        onClick={() => setSel(d.key)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="heat-foot">
        <p className="day-detail">
          <strong>{selDay ? lower(utcDateFmt.format(selDay.utc)) : ""}</strong>{" "}
          {selLogs.length === 0
            ? sel === todayKey
              ? "nothing yet today. just saying"
              : "no bins. tumbleweed"
            : selLogs.map((l) => `${lower(l.name)} (${l.bins})`).join(", ")}
        </p>
        <span className="legend">
          less <i className="cell l0" /><i className="cell l1" /><i className="cell l2" /><i className="cell l3" /><i className="cell l4" /> more
        </span>
      </div>
    </section>
  );
}
