import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { PASS_COOKIE, WHO_COOKIE, passToken } from "@/lib/auth";
import { isPerson } from "@/lib/people";
import { getColors, getLogs, getPings } from "@/lib/store";
import Gate from "./components/Gate";
import WhoPicker from "./components/WhoPicker";
import Dashboard from "./components/Dashboard";

export default function Home() {
  return (
    <Suspense fallback={<main className="shell narrow"><p className="kicker">loading the bins...</p></main>}>
      <Inner />
    </Suspense>
  );
}

async function Inner() {
  await connection(); // always render per request, never from a cache
  const c = await cookies();
  if (c.get(PASS_COOKIE)?.value !== passToken()) return <Gate />;

  const who = c.get(WHO_COOKIE)?.value;
  if (!isPerson(who)) return <WhoPicker />;

  const [logs, colors, pings] = await Promise.all([getLogs(), getColors(), getPings()]);
  return <Dashboard who={who} logs={logs} colors={colors} pings={pings} now={Date.now()} />;
}
