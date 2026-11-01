export const TZ = "Europe/London";
export const DAY = 86_400_000;

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
});
export const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
export const utcDateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
export const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" });

/** YYYY-MM-DD in London time */
export const dayKey = (ts: number) => keyFmt.format(ts);

/** hour (0-23) and weekday (0 = mon) in London time */
export function londonParts(ts: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(ts).map((x) => [x.type, x.value]));
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  return { hour: Number(p.hour), minute: Number(p.minute), weekday: wd };
}

/** UTC ms for a London wall-clock time on a given YYYY-MM-DD */
export function londonToUtc(key: string, hhmm: string) {
  const [y, m, d] = key.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  // London is UTC or UTC+1; find the offset that round-trips
  for (const off of [0, 60, -60]) {
    const ts = guess - off * 60_000;
    const p = londonParts(ts);
    if (dayKey(ts) === key && p.hour === h && p.minute === mi) return ts;
  }
  return guess;
}

/** key -> UTC midnight ms, handy for grid maths */
export const keyToUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const lower = (s: string) => s.toLowerCase();
