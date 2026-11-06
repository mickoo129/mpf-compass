import type { Profile } from "./types";

// ?p= carries the client's settings so a shared link rebuilds the same mix:
// age.retireAge.goal.account.horizon.mixSize.balance.monthly (no names).
export function encodeSettings(pr: Profile): string {
  return [pr.age, pr.retireAge, pr.goal, pr.account === "contribution" ? "c" : "p", pr.switchHorizon ?? "6m", pr.mixSize, pr.balance, pr.monthly].join(".");
}
export function decodeSettings(raw: string | undefined): Partial<Profile> | null {
  if (!raw) return null;
  const [a, ra, g, ac, sh, n, b, m] = raw.split(".");
  const num = (x: string | undefined, lo: number, hi: number) => {
    const v = Number(x);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
  };
  const out: Partial<Profile> = {};
  const age = num(a, 18, 70);
  const retire = num(ra, 50, 70);
  if (age != null) out.age = age;
  if (retire != null) out.retireAge = retire;
  if (g === "growth" || g === "balanced" || g === "preserve" || g === "lowfee" || g === "dis") out.goal = g;
  if (ac === "c" || ac === "p") out.account = ac === "c" ? "contribution" : "personal";
  if (sh === "1m" || sh === "3m" || sh === "6m" || sh === "1y") out.switchHorizon = sh;
  if (n === "auto") out.mixSize = "auto";
  else if (["1", "2", "3", "4", "5"].includes(n ?? "")) out.mixSize = Number(n) as Profile["mixSize"];
  const bal = num(b, 0, 1e9);
  const mon = num(m, 0, 1e6);
  if (bal != null) out.balance = bal;
  if (mon != null) out.monthly = mon;
  return out;
}
