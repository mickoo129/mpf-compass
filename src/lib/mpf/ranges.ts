/**
 * Historical range of outcomes ("可能升跌範圍").
 *
 * We have no fund unit-price history, so each fund is proxied by the index it
 * tracks most closely (fund.bench) scaled by its equity sensitivity (fund.beta),
 * with the rest in a bond proxy for mixed/bond funds, minus the fund's FER.
 * The output is a distribution of what past rolling windows looked like —
 * never a single forecast number.
 */
import type { Fund } from "./types";

export interface Series {
  symbol: string;
  points: { t: string; close: number }[];
}

export interface RangeSummary {
  months: number; // window length
  samples: number; // rolling windows observed
  fromYear: number;
  toYear: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
  upShare: number; // 0..1
}

export const BOND_PROXY = "AGG";
const EQUITY_FALLBACK = "^GSPC";

/** Month → simple return (%, not compounded) for one series. */
export function monthlyReturns(s: Series): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1]!;
    const b = s.points[i]!;
    out.set(b.t, (b.close / a.close - 1) * 100);
  }
  return out;
}

/** True for funds whose month-to-month moves are negligible (cash-like). */
export function isCashLike(fund: Fund): boolean {
  return fund.category === "money" || fund.category === "guaranteed" || fund.isConservative;
}

/** Proxy monthly return series for one fund, or null when no proxy applies. */
export function fundMonthly(fund: Fund, bySymbol: Map<string, Map<string, number>>): Map<string, number> | null {
  if (isCashLike(fund)) return null;
  const eq = bySymbol.get(fund.bench) ?? bySymbol.get(EQUITY_FALLBACK);
  if (!eq) return null;
  const bond = bySymbol.get(BOND_PROXY);
  const beta = Math.max(0, Math.min(1, fund.beta ?? 1));
  const feeMonthly = (fund.fer ?? 1.3) / 12;
  const usesBond = fund.category !== "equity";
  const out = new Map<string, number>();
  for (const [t, r] of eq) {
    if (usesBond) {
      const b = bond?.get(t);
      if (b == null) continue;
      out.set(t, beta * r + (1 - beta) * b - feeMonthly);
    } else {
      out.set(t, beta * r - feeMonthly);
    }
  }
  return out.size ? out : null;
}

/** Weighted blend of several monthly series over the months all of them share. */
export function blendMonthly(parts: { series: Map<string, number>; weight: number }[]): Map<string, number> {
  if (!parts.length) return new Map();
  const total = parts.reduce((s, p) => s + p.weight, 0) || 1;
  const months = [...parts[0]!.series.keys()].filter((t) => parts.every((p) => p.series.has(t)));
  const out = new Map<string, number>();
  for (const t of months) {
    out.set(t, parts.reduce((s, p) => s + (p.weight / total) * p.series.get(t)!, 0));
  }
  return out;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Distribution of compounded returns over every rolling window of `months`. */
export function summarize(monthly: Map<string, number>, months: number): RangeSummary | null {
  const keys = [...monthly.keys()].sort();
  const rs = keys.map((k) => monthly.get(k)! / 100);
  const windows: number[] = [];
  for (let i = 0; i + months <= rs.length; i++) {
    let g = 1;
    for (let j = i; j < i + months; j++) g *= 1 + rs[j]!;
    windows.push((g - 1) * 100);
  }
  if (windows.length < 24) return null;
  const sorted = [...windows].sort((a, b) => a - b);
  return {
    months,
    samples: windows.length,
    fromYear: Number(keys[0]!.slice(0, 4)),
    toYear: Number(keys.at(-1)!.slice(0, 4)),
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    p50: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    min: sorted[0]!,
    max: sorted.at(-1)!,
    upShare: windows.filter((w) => w > 0).length / windows.length,
  };
}

export function seriesMap(series: Series[]): Map<string, Map<string, number>> {
  return new Map(series.map((s) => [s.symbol, monthlyReturns(s)]));
}
