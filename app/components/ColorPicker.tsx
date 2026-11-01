"use client";

import { useState, useTransition } from "react";
import { MIN_HUE_GAP, PEOPLE, clash, hueColor, hueDist, type Colors } from "@/lib/people";
import { lower } from "@/lib/time";
import { setMyColor } from "../actions";
import { useColors } from "./colors";

function freeHue(colors: Colors, me: string) {
  for (let h = 0; h < 360; h += 7) if (!clash(h, colors, me)) return h;
  return 0;
}

export default function ColorPicker({ who }: { who: string }) {
  const colors = useColors();
  const mine = colors[who as keyof Colors];
  const [open, setOpen] = useState(mine === undefined);
  const [hue, setHue] = useState(() => mine ?? freeHue(colors, who));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const taken = PEOPLE.filter((p) => p !== who && typeof colors[p] === "number").map((p) => ({ name: p, h: colors[p]! }));
  const hit = clash(hue, colors, who);
  const unchanged = mine !== undefined && hueDist(mine, hue) < 1;

  function save() {
    start(async () => {
      const r = await setMyColor(hue);
      if (!r.ok) setMsg(r.error);
      else {
        setMsg("saved. looking good");
        setTimeout(() => setOpen(false), 900);
      }
    });
  }

  if (!open)
    return (
      <button className="color-toggle" onClick={() => setOpen(true)}>
        <span className="swatch" style={{ background: mine !== undefined ? hueColor(mine) : undefined }} />
        {mine === undefined ? "you're grey rn. pick a colour" : "change your colour"}
      </button>
    );

  return (
    <div className="picker">
      <div className="picker-head">
        <span className="swatch big-swatch" style={{ background: hueColor(hue) }} />
        <p>pick a color, it has to be a bit different from everyone else&apos;s</p>
      </div>
      <div className="hue-wrap">
        <input
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={(e) => {
            setHue(Number(e.target.value));
            setMsg(null);
          }}
          className="hue"
          aria-label="colour"
          style={{ ["--thumb" as string]: hueColor(hue) }}
        />
        <span className="taken-clip" aria-hidden>
          {taken.flatMap((t) => {
            // band of hues too close to someone, wrapping around the ends of the slider
            const lo = t.h - MIN_HUE_GAP, hi = t.h + MIN_HUE_GAP;
            const segs: [number, number][] = [[Math.max(0, lo), Math.min(359, hi)]];
            if (lo < 0) segs.push([360 + lo, 359]);
            if (hi > 359) segs.push([0, hi - 360]);
            return segs.map(([x, y], i) => (
              <span key={`${t.name}${i}`} className="taken" style={{ left: `${(x / 359) * 100}%`, width: `${((y - x) / 359) * 100}%` }} />
            ));
          })}
        </span>
        {taken.map((t) => (
          <i key={t.name} className="taken-face" style={{ left: `${(t.h / 359) * 100}%`, background: hueColor(t.h) }} title={`${lower(t.name)}'s colour`}>
            {t.name[0]}
          </i>
        ))}
      </div>
      <div className="picker-foot">
        <span className={`small ${hit ? "clash" : "muted"}`}>
          {msg ?? (hit ? `too close to ${lower(hit)}'s colour` : unchanged ? "that's your colour already" : "looks free")}
        </span>
        <span className="picker-btns">
          {mine !== undefined && (
            <button className="link" onClick={() => setOpen(false)}>
              nvm
            </button>
          )}
          <button className="pill" disabled={!!hit || pending || unchanged} onClick={save}>
            {pending ? "saving..." : "save"}
          </button>
        </span>
      </div>
    </div>
  );
}
