"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { PASS_COOKIE, WHO_COOKIE, YEAR, passToken, sitePassword } from "@/lib/auth";
import { clash, isPerson, type BinLog, type Colors, type Person } from "@/lib/people";
import { addLog, addPing, deleteLog, getColors, getLog, getPings, saveColor } from "@/lib/store";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: YEAR,
};

const EARLIEST = new Date("2026-09-01T00:00:00Z").getTime();

async function me(): Promise<Person | null> {
  const c = await cookies();
  if (c.get(PASS_COOKIE)?.value !== passToken()) return null;
  const who = c.get(WHO_COOKIE)?.value;
  return isPerson(who) ? who : null;
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const pw = String(form.get("password") ?? "").trim().toLowerCase();
  if (pw !== sitePassword().toLowerCase()) {
    const nopes = ["nah. try again", "wrong 😭", "ain't no way that's it", "icl that's not it"];
    return nopes[Math.floor(Math.random() * nopes.length)];
  }
  (await cookies()).set(PASS_COOKIE, passToken(), cookieOpts);
  revalidatePath("/");
  return null;
}

export async function pickName(name: string) {
  const c = await cookies();
  if (c.get(PASS_COOKIE)?.value !== passToken() || !isPerson(name)) return;
  c.set(WHO_COOKIE, name, cookieOpts);
  revalidatePath("/");
}

export async function forgetName() {
  (await cookies()).delete(WHO_COOKIE);
  revalidatePath("/");
}

type Result = { ok: true; log: BinLog } | { ok: false; error: string };

/** Log bins for yourself. ts defaults to now; pass a ts to backfill a past day. */
export async function logBins(bins: number, ts?: number): Promise<Result> {
  const who = await me();
  if (!who) return { ok: false, error: "who even are u" };
  if (bins !== 1 && bins !== 2) return { ok: false, error: "it's 1 or 2 bins" };
  const now = Date.now();
  const when = ts ?? now;
  if (!Number.isFinite(when) || when < EARLIEST) return { ok: false, error: "that's before we even moved in" };
  if (when > now + 5 * 60_000) return { ok: false, error: "u can't log bins from the future" };
  const log: BinLog = { id: randomUUID(), name: who, bins, ts: when };
  await addLog(log);
  revalidatePath("/");
  return { ok: true, log };
}

/** Remove one of your own logs (any day). Returns it so the client can offer undo. */
export async function removeLog(id: string): Promise<Result> {
  const who = await me();
  if (!who) return { ok: false, error: "who even are u" };
  const log = await getLog(id);
  if (!log) return { ok: false, error: "already gone" };
  if (log.name !== who) return { ok: false, error: "that's not urs to delete" };
  await deleteLog(id);
  revalidatePath("/");
  return { ok: true, log };
}

/** Put back a log you just removed. */
export async function restoreLog(log: BinLog): Promise<Result> {
  const who = await me();
  if (!who || log?.name !== who) return { ok: false, error: "nope" };
  if (log.bins !== 1 && log.bins !== 2) return { ok: false, error: "nope" };
  const clean: BinLog = { id: String(log.id), name: who, bins: log.bins, ts: Number(log.ts) };
  if (log.fromChat) clean.fromChat = true;
  await addLog(clean);
  revalidatePath("/");
  return { ok: true, log: clean };
}

export async function setMyColor(hue: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = await me();
  if (!who) return { ok: false, error: "who even are u" };
  if (!Number.isFinite(hue) || hue < 0 || hue >= 360) return { ok: false, error: "that's not a colour" };
  const colors = await getColors();
  const c = clash(hue, colors as Colors, who);
  if (c) return { ok: false, error: `too close to ${c.toLowerCase()}'s colour` };
  await saveColor(who, Math.round(hue));
  revalidatePath("/");
  return { ok: true };
}

const PING_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // one ping per person per week

export async function pingPerson(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = await me();
  if (!who) return { ok: false, error: "who even are u" };
  if (!isPerson(to)) return { ok: false, error: "who?" };
  if (to === who) return { ok: false, error: "u can't ping urself. just take the bins down" };
  const pings = await getPings();
  const recent = pings.find((p) => p.from === who && p.to === to && Date.now() - p.ts < PING_COOLDOWN);
  if (recent) {
    const d = Math.ceil((PING_COOLDOWN - (Date.now() - recent.ts)) / 86_400_000);
    return { ok: false, error: `u already pinged ${to.toLowerCase()} this week. try again in ${d}d` };
  }
  await addPing({ id: randomUUID(), from: who, to, ts: Date.now() });
  revalidatePath("/");
  return { ok: true };
}
