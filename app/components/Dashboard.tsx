"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PEOPLE, type BinLog, type Colors, type Person } from "@/lib/people";
import { DAY, dateFmt, lower, timeFmt } from "@/lib/time";
import { forgetName, logBins, pingPerson, removeLog, restoreLog } from "../actions";
import type { Ping } from "@/lib/store";
import UpNext from "./UpNext";
import { pairUp } from "@/lib/runs";
import Presence from "./Presence";
import Heatmap from "./Heatmap";
import { LastSeen, Share, Stats, Timeline, Weekly, When } from "./Charts";
import ColorPicker from "./ColorPicker";
import { ColorsProvider, useCol } from "./colors";

const ROASTS = [
  "has never touched a bin bag",
  "would need directions to the bin room",
  "thinks the bins take themselves down",
  "bin room? never heard of her",
  "the bins have never met them",
];
const roastFor = (name: string) => ROASTS[PEOPLE.indexOf(name as Person) % ROASTS.length];

function ago(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "like just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

type Toast = { id: number; text: string; undo?: () => void };
type Burst = { id: number; x: number; y: number };

type Props = { who: Person; logs: BinLog[]; now: number; colors: Colors; pings: Ping[] };

export default function Dashboard({ colors, ...rest }: Props) {
  return (
    <ColorsProvider value={colors}>
      <Inner {...rest} />
    </ColorsProvider>
  );
}

const POP = ["oklch(0.9 0.2 128)", "oklch(0.72 0.19 350)", "oklch(0.8 0.15 80)", "oklch(0.7 0.15 230)"];

function Inner({ who, logs, now, pings }: Omit<Props, "colors">) {
  const colorOf = useCol();
  const BURST_COLORS = [colorOf(who), ...POP];
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [showAll, setShowAll] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // scroll-in reveal for sections
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal:not(.in)");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [logs.length]);

  function say(text: string, undo?: () => void) {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  }

  function burstFrom(el: HTMLElement | null) {
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const b = { id: Date.now(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    setBursts((xs) => [...xs, b]);
    setTimeout(() => setBursts((xs) => xs.filter((x) => x.id !== b.id)), 900);
  }

  function undoAdd(log: BinLog) {
    start(async () => {
      const r = await removeLog(log.id);
      say(r.ok ? "undone. we saw that tho" : r.error);
    });
  }

  function quickLog(bins: 1 | 2, el: HTMLElement) {
    burstFrom(el);
    start(async () => {
      const r = await logBins(bins);
      if (!r.ok) return say(r.error);
      const msg = bins === 2 ? "+2. the flat thanks you" : "+1. noted";
      say(`${msg} · today ${timeFmt.format(r.log.ts)}`, () => undoAdd(r.log));
    });
  }

  function addOn(bins: 1 | 2, ts: number) {
    start(async () => {
      const r = await logBins(bins, ts);
      if (!r.ok) return say(r.error);
      say(`added ${bins} ${bins === 1 ? "bin" : "bins"} on ${lower(dateFmt.format(ts))} at ${timeFmt.format(ts)}`, () => undoAdd(r.log));
    });
  }

  function ping(name: string, el?: HTMLElement | null) {
    burstFrom(el ?? null);
    start(async () => {
      const r = await pingPerson(name);
      say(r.ok ? `pinged ${lower(name)}. +10 psi, the pressure is on` : r.error);
    });
  }

  function remove(log: BinLog) {
    start(async () => {
      const r = await removeLog(log.id);
      if (!r.ok) return say(r.error);
      say(`deleted your ${log.bins} ${log.bins === 1 ? "bin" : "bins"} from ${lower(dateFmt.format(log.ts))}`, () =>
        start(async () => {
          const back = await restoreLog(r.log);
          say(back.ok ? "it's back" : back.error);
        }),
      );
    });
  }

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
  const avg = total / PEOPLE.length;
  const minPts = Math.min(...board.map((b) => b.points));
  const bottom = board.filter((b) => b.points === minPts);
  const belowAvg = board.filter((b) => b.points < avg && b.points > minPts);

  let status: string;
  if (!last) status = "no bins ever. the kitchen is a biohazard";
  else {
    const gap = now - last.ts;
    const days = Math.floor(gap / DAY);
    status =
      days >= 4
        ? `${days} days since anyone took the bins down. something in that kitchen is evolving`
        : `bins last went down ${ago(gap)}, by ${lower(last.name)}`;
  }

  type Entry = { kind: "log"; ts: number; log: BinLog } | { kind: "ping"; ts: number; ping: Ping };
  const entries: Entry[] = [
    ...logs.map((l) => ({ kind: "log" as const, ts: l.ts, log: l })),
    ...pings.map((p) => ({ kind: "ping" as const, ts: p.ts, ping: p })),
  ].sort((a, b) => b.ts - a.ts);
  const receipts = showAll ? entries : entries.slice(0, 8);
  const partners = pairUp(logs);

  return (
    <main className="shell">
      <header className="top">
        <span className="kicker">hayloft 711 bins · {lower(who)}</span>
        <button className="link" onClick={() => start(() => forgetName())}>
          not {lower(who)}? switch
        </button>
      </header>

      <Presence who={who} />
      <ColorPicker who={who} />

      <section className="hero">
        <h1 className="title">
          did you take the <span className="hl">bins</span> down?
        </h1>
        <p className="log-label">
          <span className="arrow-down" aria-hidden>↓</span> took the bins down? log it here
        </p>
        <div className="big-btns">
          <button className="big" disabled={pending} onClick={(e) => quickLog(1, e.currentTarget)}>
            <span className="num">1</span>
            <span className="unit">bin<small>tap to log</small></span>
          </button>
          <button className="big alt" disabled={pending} onClick={(e) => quickLog(2, e.currentTarget)}>
            <span className="num">2</span>
            <span className="unit">bins<small>tap to log</small></span>
          </button>
        </div>
        <p className="for-when">
          logging as <strong style={{ color: colorOf(who) }}>{lower(who)}</strong> for <strong>today, {lower(dateFmt.format(now))}</strong>,
          right now. different day or wanna delete one? use the calendar further down
        </p>
        <p className="me-line">
          {me.points === 0
            ? "you have 0 bins. the whole flat can see this btw"
            : `you're #${myRank} with ${me.points} ${me.points === 1 ? "bin" : "bins"}`}
        </p>
        <p className="status">{status}</p>
      </section>

      <UpNext logs={logs} pings={pings} now={now} who={who} pending={pending} onPing={(n) => ping(n)} />

      <section className="shame reveal">
        <h2 className="h2">hall of shame</h2>
        {shame.length > 0 ? (
          <p className="shame-line">
            <Names list={shame.map((s) => s.name)} /> {shame.length === 1 ? "has" : "have"} taken down <em>zero</em> bins. {total} bins
            have gone down so far. none of them were theirs.
          </p>
        ) : (
          <p className="shame-line">
            the flat average is {avg.toFixed(1)} bins. <Names list={bottom.map((b) => b.name)} /> {bottom.length === 1 ? "is" : "are"}{" "}
            bringing up the rear with <em>only {bottom[0]?.points}</em>.
          </p>
        )}
        {belowAvg.length > 0 && (
          <p className="shame-sub">
            below the average of {avg.toFixed(1)}: {belowAvg.map((b) => `${lower(b.name)} (${b.points})`).join(", ")}
          </p>
        )}
      </section>

      <section className="reveal">
        <h2 className="h2">the bin board</h2>
        <ol className="board">
          {board.map((b, i) => {
            const rank = board.filter((x) => x.points > b.points).length + 1;
            const note =
              b.points === 0 ? roastFor(b.name) : b.points === lowestNonZero ? "doing the bare minimum" : "";
            return (
              <li key={b.name} className={`row ${b.points === 0 ? "zero" : ""} ${b.name === who ? "me" : ""}`}>
                <span className="rank">{rank}</span>
                <span className="who">
                  {lower(b.name)}
                  {b.name === who && <span className="you"> (you)</span>}
                </span>
                <span className="bar-wrap">
                  <span
                    className="bar"
                    style={{ width: `${(b.points / max) * 100}%`, background: colorOf(b.name), animationDelay: `${i * 50}ms` }}
                  />
                </span>
                <span className="pts">{b.points}</span>
                {note && <span className="note">{note}</span>}
              </li>
            );
          })}
        </ol>
        <p className="fine">1 bin = 1 point. no points for &quot;i was gonna do it&quot;</p>
      </section>

      <Stats logs={logs} now={now} />
      <Share board={board} total={total} />
      <Weekly logs={logs} now={now} />
      <Timeline logs={logs} now={now} board={board} />
      <When logs={logs} />
      <LastSeen logs={logs} now={now} />
      <Heatmap logs={logs} now={now} who={who} pending={pending} onAdd={addOn} onRemove={remove} />

      <section className="reveal">
        <h2 className="h2">the receipts</h2>
        <ul className="log">
          {receipts.map((e) =>
            e.kind === "log" ? (
              <li key={e.log.id}>
                <span className="when">
                  {lower(dateFmt.format(e.ts))} <span className="muted">{timeFmt.format(e.ts)}</span>
                </span>
                <span className="what">
                  <span className="dot" style={{ background: colorOf(e.log.name) }} />
                  <strong>{lower(e.log.name)}</strong> took {e.log.bins} {e.log.bins === 1 ? "bin" : "bins"}
                  {partners.get(e.log.id) && <span className="with">with {lower(partners.get(e.log.id)!.name)}</span>}
                </span>
                <span className="tag">
                  {e.log.name === who ? (
                    <button className="del" disabled={pending} onClick={() => remove(e.log)}>delete</button>
                  ) : e.log.fromChat ? (
                    "from gc"
                  ) : (
                    ""
                  )}
                </span>
              </li>
            ) : (
              <li key={e.ping.id} className="ping-row">
                <span className="when">
                  {lower(dateFmt.format(e.ts))} <span className="muted">{timeFmt.format(e.ts)}</span>
                </span>
                <span className="what">
                  <span className="dot" style={{ background: colorOf(e.ping.from) }} />
                  <strong>{lower(e.ping.from)}</strong> pinged <strong>{lower(e.ping.to)}</strong>
                </span>
                <span className="tag">+10 psi</span>
              </li>
            ),
          )}
        </ul>
        {entries.length > 8 && (
          <button className="link more" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "show less" : `show all ${entries.length}`}
          </button>
        )}
        <p className="fine synced">last synced {timeFmt.format(now)} · {logs.length} logs</p>
      </section>


      {bursts.map((b) => (
        <span key={b.id} className="burst" style={{ left: b.x, top: b.y }} aria-hidden>
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const d = 70 + (i % 3) * 22;
            return (
              <i
                key={i}
                style={
                  {
                    background: BURST_COLORS[i % BURST_COLORS.length],
                    "--dx": `${Math.cos(a) * d}px`,
                    "--dy": `${Math.sin(a) * d}px`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </span>
      ))}

      {toast && (
        <div className="toast" key={toast.id} role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              className="toast-undo"
              disabled={pending}
              onClick={() => {
                const u = toast.undo!;
                setToast(null);
                u();
              }}
            >
              undo
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function Names({ list }: { list: string[] }) {
  return (
    <>
      {list.map((n, i) => (
        <span key={n}>
          <strong>{lower(n)}</strong>
          {i < list.length - 2 ? ", " : i === list.length - 2 ? " & " : ""}
        </span>
      ))}
    </>
  );
}
