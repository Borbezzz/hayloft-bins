"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCol } from "./colors";
import { lower } from "@/lib/time";

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** Heartbeats every 15s, shows who else has the site open, refreshes data every 30s. */
export default function Presence({ who }: { who: string }) {
  const [online, setOnline] = useState<string[]>([who]);
  const router = useRouter();
  const colorOf = useCol();

  useEffect(() => {
    let alive = true;
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/presence", { method: "POST" });
        const j = await r.json();
        if (alive && Array.isArray(j.online)) setOnline(j.online.length ? j.online : [who]);
      } catch {}
    };
    beat();
    const hb = setInterval(beat, 15_000);
    const rf = setInterval(() => document.visibilityState === "visible" && router.refresh(), 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        beat();
        router.refresh();
      }
    };
    const bye = () => navigator.sendBeacon?.("/api/presence?bye=1") || fetch("/api/presence", { method: "DELETE", keepalive: true });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", bye);
    return () => {
      alive = false;
      clearInterval(hb);
      clearInterval(rf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", bye);
    };
  }, [who, router]);

  const others = online.filter((n) => n !== who);
  const label =
    others.length === 0
      ? "just u here rn. it's quiet"
      : `${joinNames(others.map(lower))} ${others.length === 1 ? "is" : "are"} also browsing bin statistics rn`;

  return (
    <div className="presence" aria-live="polite">
      <span className="pulse" aria-hidden />
      <span className="faces" aria-hidden>
        {online.map((n) => (
          <span key={n} className="face" style={{ background: colorOf(n) }} title={lower(n)}>
            {n[0]}
          </span>
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
