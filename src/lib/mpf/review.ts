/**
 * "一個月後回來對照" — estimate how a saved mix has moved since it was saved.
 *
 * MPFA publishes fund returns monthly and a month late, so there is no unit
 * price for "since 3 weeks ago". Instead, when a mix is saved we store the
 * level of each fund's reference index; on return we compare with today's level:
 *   equity part  = beta × index change
 *   bond part    = (1 − beta) × bond estimate from the change in the US 10-year
 *                  yield (≈ −6 × Δyield, plus the yield earned over the days)
 *   cash-like    = the fund's own 1-year return, pro-rated
 * minus the FER for the days held. It is an estimate, clearly labelled.
 */
import type { MarketQuote } from "./types";

export interface SavedHolding {
  id: string;
  weight: number;
  nameZh: string;
  nameEn: string;
  bench?: string;
  beta?: number;
  fer?: number | null;
  ret1y?: number | null;
  cashLike?: boolean;
}

export interface SavedMixV2 {
  at: string;
  holdings: SavedHolding[];
  /** Index / yield levels at save time, keyed by Yahoo symbol. */
  levels?: Record<string, number>;
}

const BOND_DURATION = 6;
const YIELD = "^TNX";

export function levelsFrom(quotes: MarketQuote[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of quotes) if (q.price != null && Number.isFinite(q.price)) out[q.symbol] = q.price;
  return out;
}

export interface HoldingMove {
  id: string;
  nameZh: string;
  nameEn: string;
  weight: number;
  pct: number | null;
}

export interface MixMove {
  days: number;
  holdings: HoldingMove[];
  pct: number | null; // weighted, % since save
}

export function estimateSince(saved: SavedMixV2, now: Record<string, number>, today = new Date()): MixMove {
  const days = Math.max(0, Math.round((today.getTime() - new Date(saved.at).getTime()) / 86_400_000));
  const then = saved.levels ?? {};
  const yThen = then[YIELD];
  const yNow = now[YIELD];
  const bondPct =
    yThen != null && yNow != null ? -BOND_DURATION * (yNow - yThen) + ((yThen + yNow) / 2) * (days / 365) : null;

  const holdings = saved.holdings.map((h) => {
    const feeDrag = ((h.fer ?? 0) * days) / 365;
    let pct: number | null = null;
    if (h.cashLike) {
      pct = ((h.ret1y ?? 1) * days) / 365;
    } else if (h.bench && h.bench !== YIELD && then[h.bench] && now[h.bench]) {
      const beta = Math.max(0, Math.min(1, h.beta ?? 1));
      const eq = (now[h.bench]! / then[h.bench]! - 1) * 100;
      const bond = bondPct ?? 0;
      pct = beta * eq + (1 - beta) * bond - feeDrag;
    } else if (bondPct != null) {
      pct = bondPct - feeDrag;
    }
    return { id: h.id, nameZh: h.nameZh, nameEn: h.nameEn, weight: h.weight, pct };
  });
  const known = holdings.filter((h) => h.pct != null);
  const w = known.reduce((s, h) => s + h.weight, 0);
  const pct = w ? known.reduce((s, h) => s + (h.weight / w) * (h.pct as number), 0) : null;
  return { days, holdings, pct };
}
