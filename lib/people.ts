export const PEOPLE = [
  "Blanka",
  "Isabelle",
  "Katya",
  "Lani",
  "Patreeya",
  "Samer",
  "Saya",
  "Selma",
  "Yixin",
  "Zainab",
] as const;

export type Person = (typeof PEOPLE)[number];

export function isPerson(x: unknown): x is Person {
  return typeof x === "string" && (PEOPLE as readonly string[]).includes(x);
}

export type BinLog = {
  id: string;
  name: Person;
  bins: 1 | 2;
  ts: number; // ms since epoch, when it was logged
  fromChat?: boolean; // backfilled from the group chat
};

// Backfilled from the Hayloft 711 group chat (24 Sep to 30 Oct 2026).
// "one of the bins" = 1, a pair doing it = 1 each, "the bins" solo = 2.
const seed: [string, Person, 1 | 2][] = [
  ["2026-09-24T23:53:00+01:00", "Yixin", 1],
  ["2026-09-24T23:53:00+01:00", "Patreeya", 1],
  ["2026-09-27T21:07:00+01:00", "Saya", 2],
  ["2026-10-05T18:58:00+01:00", "Isabelle", 1],
  ["2026-10-05T19:19:00+01:00", "Katya", 1],
  ["2026-10-09T12:52:00+01:00", "Selma", 1],
  ["2026-10-09T12:52:00+01:00", "Blanka", 1],
  ["2026-10-15T17:43:00+01:00", "Patreeya", 1],
  ["2026-10-15T21:03:00+01:00", "Saya", 1],
  ["2026-10-17T22:10:00+01:00", "Samer", 2],
  ["2026-10-20T12:46:00+01:00", "Yixin", 2],
  ["2026-10-25T21:08:00+00:00", "Blanka", 2],
];

export const SEED_LOGS: BinLog[] = seed.map(([iso, name, bins], i) => ({
  id: `seed-${i}`,
  name,
  bins,
  ts: new Date(iso).getTime(),
  fromChat: true,
}));

// colours: everyone picks a hue, grey until they do
export const MIN_HUE_GAP = 30;
export const GREY = "oklch(0.72 0.012 270)";
export type Colors = Partial<Record<Person, number>>;

export const hueColor = (h: number) => `oklch(0.72 0.17 ${Math.round(h)})`;
export const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
/** the person whose colour is too close to this hue, if any */
export function clash(hue: number, colors: Colors, me: string): Person | null {
  for (const [n, h] of Object.entries(colors)) {
    if (n !== me && typeof h === "number" && hueDist(h, hue) < MIN_HUE_GAP) return n as Person;
  }
  return null;
}
