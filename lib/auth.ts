import "server-only";
import { createHash } from "crypto";

export const PASS_COOKIE = "hl_pass";
export const WHO_COOKIE = "hl_who";

export function sitePassword() {
  return process.env.SITE_PASSWORD || "trash";
}

export function passToken() {
  return createHash("sha256").update(`hayloft711:${sitePassword()}`).digest("hex");
}

export const YEAR = 60 * 60 * 24 * 365;

// How long after logging you can still undo your own entry.
export const UNDO_WINDOW_MS = 15 * 60 * 1000;
