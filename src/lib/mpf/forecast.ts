import type { Allocation, Fund } from "./types";
import { expectedReturn } from "./score";

const VOL: Record<number, number> = {
  1: 0.6,
  2: 2.2,
  3: 5.2,
  4: 8.4,
  5: 12.5,
  6: 18.0,
  7: 24.5,
};

export function volOf(fund: Fund): number {
  return VOL[fund.riskClass ?? 4] ?? 10;
}

export interface PathPoint {
  year: number;
  base: number;
  bull: number;
  bear: number;
}

export function projectFund(fund: Fund, years = 10, start = 10000): PathPoint[] {
  const mu = expectedReturn(fund) / 100;
  const vol = volOf(fund) / 100;
  const points: PathPoint[] = [{ year: 0, base: start, bull: start, bear: start }];
  let base = start;
  let bull = start;
  let bear = start;
  for (let y = 1; y <= years; y++) {
    base *= 1 + mu;
    bull *= 1 + mu + 0.7 * vol;
    bear *= 1 + Math.max(-0.25, mu - 1.05 * vol);
    points.push({ year: y, base, bull, bear });
  }
  return points;
}

export function projectPortfolio(
  alloc: Allocation[],
  years: number,
  balance: number,
  monthly: number,
): PathPoint[] {
  const mu =
    alloc.reduce((s, a) => s + a.weight * expectedReturn(a.fund), 0) / 100;
  const vol =
    alloc.reduce((s, a) => s + a.weight * volOf(a.fund), 0) / 100;
  const points: PathPoint[] = [{ year: 0, base: balance, bull: balance, bear: balance }];
  let base = balance;
  let bull = balance;
  let bear = balance;
  for (let y = 1; y <= years; y++) {
    const contrib = monthly * 12;
    base = (base + contrib) * (1 + mu);
    bull = (bull + contrib) * (1 + mu + 0.65 * vol);
    bear = (bear + contrib) * (1 + Math.max(-0.22, mu - 1.0 * vol));
    points.push({ year: y, base, bull, bear });
  }
  return points;
}

export function estimateTodayMove(indexChangePct: number | null | undefined, beta: number): number | null {
  if (indexChangePct == null || Number.isNaN(indexChangePct)) return null;
  return indexChangePct * beta;
}
