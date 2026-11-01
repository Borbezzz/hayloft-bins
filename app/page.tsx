import { Suspense } from "react";
import { cookies } from "next/headers";
import { PASS_COOKIE, WHO_COOKIE, UNDO_WINDOW_MS, passToken } from "@/lib/auth";
import { isPerson } from "@/lib/people";
import { getLogs } from "@/lib/store";
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
  const c = await cookies();
  if (c.get(PASS_COOKIE)?.value !== passToken()) return <Gate />;

  const who = c.get(WHO_COOKIE)?.value;
  if (!isPerson(who)) return <WhoPicker />;

  const logs = await getLogs();
  return <Dashboard who={who} logs={logs} now={Date.now()} undoWindowMs={UNDO_WINDOW_MS} />;
}
