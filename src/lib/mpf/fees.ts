/**
 * Fees in Hong Kong dollars.
 *
 * FER (fund expense ratio) is an annual % of the balance. Clients understand
 * "$600 a year" far better than "1.71%", and the long-run gap between two funds
 * better still, so every helper here turns a FER into dollars on the member's
 * own balance (or on HK$10,000 when no balance has been entered).
 */
import type { Fund } from "./types";

/** Unit used when the member has not entered a balance. */
export const FEE_UNIT = 10_000;

/** Illustration used for long-run gaps when the member has not typed a balance. */
export const EXAMPLE_BALANCE = 200_000;
export const EXAMPLE_MONTHLY = 3_000;

/** Gross return assumed for the fee-gap projection, before fees (% a year). */
export const FEE_GAP_GROSS = 5;

export function annualFee(balance: number, fer: number | null | undefined): number | null {
  if (fer == null || !Number.isFinite(fer)) return null;
  return (Math.max(0, balance) * fer) / 100;
}

/**
 * Extra money lost to the higher fee after `years`, with yearly contributions,
 * the same gross return for both funds, and each fund's FER deducted yearly.
 */
export function feeGap(
  balance: number,
  monthly: number,
  years: number,
  ferHigh: number,
  ferLow: number,
  gross = FEE_GAP_GROSS,
): number {
  let a = Math.max(0, balance);
  let b = a;
  const yearly = Math.max(0, monthly) * 12;
  for (let y = 0; y < years; y++) {
    a = (a + yearly) * (1 + (gross - ferHigh) / 100);
    b = (b + yearly) * (1 + (gross - ferLow) / 100);
  }
  return b - a;
}

/** Weighted FER of a mix. */
export function mixFer(items: { fund: Fund; weight: number }[]): number | null {
  const known = items.filter((i) => i.fund.fer != null);
  if (!known.length) return null;
  const w = known.reduce((s, i) => s + i.weight, 0) || 1;
  return known.reduce((s, i) => s + (i.weight / w) * (i.fund.fer as number), 0);
}
