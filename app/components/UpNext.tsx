"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { PEOPLE, type BinLog } from "@/lib/people";
import type { Ping } from "@/lib/store";
import { DAY, lower } from "@/lib/time";
import { useCol } from "./colors";

const MOVE_IN = Date.UTC(2026, 8, 21);

const tex = (src: string) => katex.renderToString(src, { displayMode: true, throwOnError: false, output: "html" });

const FORMULA = tex(String.raw`
\begin{aligned}
\mathcal{P}_i(t) &= \left\lfloor \left(\int_0^1 x\,\mathrm{d}x\right)\Big(\Phi_i(t) + \big|\,\Phi_i(t)\,\big|\Big) + \frac{1}{2} \right\rfloor \\[6pt]
\Phi_i(t) &= \left.\frac{\mathrm{d}}{\mathrm{d}x}\,6x^2\,\right|_{x=1}\left(\frac{1}{|\mathcal{F}|}\sum_{j \in \mathcal{F}}\,\sum_{k=1}^{|\mathcal{L}_j|}\beta_{j,k} \;-\; \sum_{k=1}^{|\mathcal{L}_i|}\beta_{i,k}\right) \\[4pt]
&\quad + \left(\sum_{n=0}^{\infty} 3^{-n}\right)\int_{\tau_i}^{\,t}\mathbf{1}\!\left[\,s-\tau_i < 30\,\mathrm{d}\,\right]\mathrm{d}s \\[4pt]
&\quad + \binom{5}{2}\sum_{p \in \mathcal{P}}\Big[\,p_{\mathrm{to}} = i \;\wedge\; t_p > \tau_i\,\Big]
\end{aligned}
`);

const WHERE = tex(String.raw`
\begin{aligned}
\tau_i &= \max\!\Big(\{\,t_{i,k}\,\}_{k=1}^{|\mathcal{L}_i|} \cup \{t_0\}\Big), \qquad \beta_{j,k} \in \{1, 2\} \\[4pt]
1 &\ge \sum_{p \in \mathcal{P}} \Big[\,p_{\mathrm{from}} = j \,\wedge\, p_{\mathrm{to}} = i \,\wedge\, t - t_p < 7\,\mathrm{d}\,\Big] \quad \forall\, j \ne i
\end{aligned}
`);

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

function workedExample(rows: ReturnType<typeof computePressure>, who: string) {
  const r = rows.find((x) => x.name === who);
  if (!r) return "";
  const total = rows.reduce((acc, x) => acc + x.points, 0);
  const avg = total / rows.length;
  const f = (x: number) => (Math.round(x * 100) / 100).toString();
  const a = 12 * (avg - r.points), b = 1.5 * r.days, c = 10 * r.pings.length;
  const phi = a + b + c;
  const name = String.raw`\text{${who.toLowerCase()}}`;
  return tex(String.raw`
\begin{aligned}
\Phi_{${name}} &= 12\left(\tfrac{${total}}{${rows.length}} - ${r.points}\right) + \tfrac{3}{2}\cdot ${f(r.days)} + 10 \cdot ${r.pings.length} \\
&= ${f(a)} + ${f(b)} + ${c} = ${f(phi)} \\[4pt]
\mathcal{P}_{${name}} &= \left\lfloor \tfrac{1}{2}\big(${f(phi)} + ${f(Math.abs(phi))}\big) + \tfrac{1}{2} \right\rfloor = \boxed{${Math.max(0, Math.round(phi))}\ \text{psi}}
\end{aligned}
`);
}

export default function UpNext({ logs, pings, now, who, pending, onPing }: Props) {
  const colorOf = useCol();
  const rows = useMemo(() => computePressure(logs, pings, now), [logs, pings, now]);
  const example = useMemo(() => workedExample(rows, who), [rows, who]);
  const max = Math.max(1, ...rows.map((r) => r.score));
  const lo = Math.min(...rows.map((r) => r.score));
  const hi = Math.max(...rows.map((r) => r.score));
  // blue (lowest psi) -> green -> yellow -> orange -> red (highest psi)
  const heat = (score: number) => {
    const t = hi === lo ? 0 : (score - lo) / (hi - lo);
    const h = 250 - t * 225;
    const l = 0.66 + 0.16 * Math.exp(-(((h - 95) / 40) ** 2)); // lift the yellows so they don't go mustard
    return `oklch(${l.toFixed(3)} 0.18 ${Math.round(h)})`;
  };
  const top = rows[0];
  const tied = rows.filter((r) => r.score === top.score);
  const iAmNext = tied.some((r) => r.name === who);
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`);
  const nextNames = join(tied.map((r) => (r.name === who ? "you" : lower(r.name))));
  const tiedPingers = [...new Set(tied.flatMap((r) => r.pings.map((p) => lower(p.from))))];

  const why = (r: (typeof rows)[number]) => {
    const bits = [`${r.points} ${r.points === 1 ? "bin" : "bins"}`];
    bits.push(r.lastTs ? `last went ${Math.floor(r.days) === 0 ? "today" : `${Math.floor(r.days)}d ago`}` : "has literally never gone");
    if (r.pings.length) bits.push(`pinged ${r.pings.length}x`);
    return bits.join(" · ");
  };
  const sameWhy = tied.every((r) => why(r) === why(top));

  return (
    <section className="upnext reveal">
      <h2 className="h2">who should go next</h2>
      <p className="sub">bin pressure, based on how many bins you took, how long it&apos;s been, and how many times you got pinged</p>

      <div className="next-hero" style={{ ["--c" as string]: colorOf(top.name) }}>
        <span className="next-label">up next</span>
        <span className="next-name">
          {tied.length === 1 ? (iAmNext ? "it's you. go" : nextNames) : iAmNext ? `${nextNames}. go` : nextNames}
        </span>
        <span className="next-why">
          {tied.length > 1 ? `tied at ${top.score} psi each` : `${top.score} psi`}
          {sameWhy ? ` · ${why(top)}` : ""}
          {tiedPingers.length > 0 && ` · pinged by ${tiedPingers.join(", ")}`}
        </span>
      </div>

      <ol className="pressure">
        {rows.map((r, i) => {
          const pingedByMe = pings.some((p) => p.from === who && p.to === r.name && now - p.ts < 7 * DAY);
          return (
            <li key={r.name} className={r.name === who ? "me" : ""}>
              <span className="rank">{rows.filter((x) => x.score > r.score).length + 1}</span>
              <span className="who">
                <span>
                  {lower(r.name)}
                  {r.name === who && <span className="you"> (you)</span>}
                </span>
                <span className="why">{why(r)}</span>
              </span>
              <span className="gauge">
                <span
                  className="gauge-fill"
                  style={{ width: `${Math.max(2, (r.score / max) * 100)}%`, background: heat(r.score), animationDelay: `${i * 50}ms` }}
                />
              </span>
              <span className="psi mono" style={{ color: heat(r.score) }}>{r.score}</span>
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
      <div className="how">
        <h3>how the score works</h3>
        <ul>
          <li><strong>+12 psi</strong> for every bin you're below the flat average (and -12 for every bin above it)</li>
          <li><strong>+1.5 psi</strong> for every day since you last took the bins down, maxes out at 30 days. never gone = counted from move-in</li>
          <li><strong>+10 psi</strong> for every ping since your last bin run. take the bins down and your pings reset</li>
          <li>you can ping each person <strong>once a week</strong>, so choose wisely. can&apos;t ping yourself</li>
        </ul>
        <details className="formula">
          <summary>curious how the score is actually calculated?</summary>
          <div className="tex" dangerouslySetInnerHTML={{ __html: FORMULA }} />
          <div className="tex small-tex" dangerouslySetInnerHTML={{ __html: WHERE }} />
          <p className="fine">it&apos;s the same thing as the list above, every weird constant works out to 12, 1.5 and 10. here it is with your actual numbers rn:</p>
          <div className="tex worked" dangerouslySetInnerHTML={{ __html: example }} />
        </details>
      </div>
    </section>
  );
}
