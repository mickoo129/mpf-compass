
export function estimateTodayMove(indexChangePct: number | null | undefined, beta: number): number | null {
  if (indexChangePct == null || Number.isNaN(indexChangePct)) return null;
  return indexChangePct * beta;
}

export interface ScenarioPoint {
  year: number;
  low: number;
  mid: number;
  high: number;
}

/**
 * Three steady-rate paths (cautious / middle / hopeful) with yearly contributions.
 * Steady rates are easier to explain than volatility bands: "if the mix earns
 * about X% a year on average".
 */
export function projectScenarios(
  balance: number,
  monthly: number,
  years: number,
  rates: { low: number; mid: number; high: number },
): ScenarioPoint[] {
  const out: ScenarioPoint[] = [{ year: 0, low: balance, mid: balance, high: balance }];
  let low = balance;
  let mid = balance;
  let high = balance;
  const yearly = monthly * 12;
  for (let y = 1; y <= years; y++) {
    low = (low + yearly) * (1 + rates.low / 100);
    mid = (mid + yearly) * (1 + rates.mid / 100);
    high = (high + yearly) * (1 + rates.high / 100);
    out.push({ year: y, low, mid, high });
  }
  return out;
}

/** Spread around the middle rate, wider for riskier mixes (risk class 1–7). */
export function scenarioRates(mid: number, riskClass: number): { low: number; mid: number; high: number } {
  const spread = 0.5 + 0.4 * Math.max(1, Math.min(7, riskClass));
  return { low: Math.max(0.5, mid - spread), mid, high: mid + spread };
}
