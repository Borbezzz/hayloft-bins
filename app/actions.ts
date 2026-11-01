"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { PASS_COOKIE, WHO_COOKIE, YEAR, UNDO_WINDOW_MS, passToken, sitePassword } from "@/lib/auth";
import { isPerson } from "@/lib/people";
import { addLog, deleteLog, getLog } from "@/lib/store";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: YEAR,
};

async function authed() {
  const c = await cookies();
  return c.get(PASS_COOKIE)?.value === passToken();
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const pw = String(form.get("password") ?? "").trim().toLowerCase();
  if (pw !== sitePassword().toLowerCase()) {
    const nopes = [
      "nah. try again",
      "wrong 😭",
      "ain't no way that's it",
      "icl that's not it",
    ];
    return nopes[Math.floor(Math.random() * nopes.length)];
  }
  (await cookies()).set(PASS_COOKIE, passToken(), cookieOpts);
  revalidatePath("/");
  return null;
}

export async function pickName(name: string) {
  if (!(await authed()) || !isPerson(name)) return;
  (await cookies()).set(WHO_COOKIE, name, cookieOpts);
  revalidatePath("/");
}

export async function forgetName() {
  (await cookies()).delete(WHO_COOKIE);
  revalidatePath("/");
}

export async function logBins(bins: number): Promise<{ id: string } | { error: string }> {
  if (!(await authed())) return { error: "ur not logged in" };
  const who = (await cookies()).get(WHO_COOKIE)?.value;
  if (!isPerson(who)) return { error: "who even are u" };
  if (bins !== 1 && bins !== 2) return { error: "it's 1 or 2 bins bro" };
  const id = randomUUID();
  await addLog({ id, name: who, bins, ts: Date.now() });
  revalidatePath("/");
  return { id };
}

export async function undoLog(id: string) {
  if (!(await authed())) return;
  const who = (await cookies()).get(WHO_COOKIE)?.value;
  const log = await getLog(id);
  if (!log || log.name !== who || log.fromChat) return;
  if (Date.now() - log.ts > UNDO_WINDOW_MS) return;
  await deleteLog(id);
  revalidatePath("/");
}
