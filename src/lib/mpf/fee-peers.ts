import { allFunds } from "./catalog";
import type { Fund } from "./types";

/**
 * Cheapest fund the member could switch into without changing scheme: same
 * scheme and same sleeve (asset class / region). Falls back to the same broad
 * category only when the sleeve has no cheaper sibling.
 */
export function cheapestSwitch(fund: Fund): Fund | null {
  const sameScheme = allFunds.filter((f) => f.schemeEn === fund.schemeEn && f.id !== fund.id && f.fer != null);
  const pick = (list: Fund[]) =>
    list.filter((f) => (f.fer ?? Infinity) < (fund.fer ?? -Infinity)).sort((a, b) => (a.fer ?? 0) - (b.fer ?? 0))[0] ?? null;
  return pick(sameScheme.filter((f) => f.sleeve === fund.sleeve));
}

/** Cheapest same-sleeve fund in any scheme (personal accounts can transfer). */
export function cheapestAnywhere(fund: Fund): Fund | null {
  return (
    allFunds
      .filter((f) => f.sleeve === fund.sleeve && f.id !== fund.id && f.fer != null && f.fer < (fund.fer ?? -Infinity))
      .sort((a, b) => (a.fer ?? 0) - (b.fer ?? 0))[0] ?? null
  );
}
