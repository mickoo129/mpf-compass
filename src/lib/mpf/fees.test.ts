import assert from "node:assert/strict";
import { test } from "node:test";
import { annualFee, feeGap, mixFer } from "./fees.ts";
import type { Fund } from "./types.ts";

test("annualFee turns FER into dollars", () => {
  assert.equal(annualFee(35_000, 1.71), 598.5);
  assert.equal(annualFee(10_000, null), null);
});

test("feeGap is zero for equal fees and grows with years and contributions", () => {
  assert.equal(feeGap(100_000, 0, 30, 1, 1), 0);
  const a = feeGap(100_000, 0, 10, 1.5, 0.8);
  const b = feeGap(100_000, 0, 30, 1.5, 0.8);
  const c = feeGap(100_000, 3_000, 30, 1.5, 0.8);
  assert.ok(a > 0 && b > a && c > b);
  // One year, no contributions: gap is simply the fee difference on the grown balance.
  assert.ok(Math.abs(feeGap(10_000, 0, 1, 1.5, 0.5) - 100) < 1e-6);
});

test("mixFer weights by allocation", () => {
  const f = (fer: number | null) => ({ fer }) as Fund;
  assert.equal(mixFer([{ fund: f(1), weight: 0.5 }, { fund: f(2), weight: 0.5 }]), 1.5);
  assert.equal(mixFer([{ fund: f(null), weight: 1 }]), null);
});

import { projectScenarios, scenarioRates } from "./forecast.ts";

test("scenario paths are ordered and widen with risk", () => {
  const r = scenarioRates(5, 5);
  assert.ok(r.low < r.mid && r.mid < r.high);
  assert.ok(scenarioRates(5, 6).high - scenarioRates(5, 6).low > scenarioRates(5, 3).high - scenarioRates(5, 3).low);
  const p = projectScenarios(100_000, 1_000, 10, r).at(-1)!;
  assert.ok(p.low < p.mid && p.mid < p.high);
  assert.ok(Math.abs(projectScenarios(1000, 0, 1, { low: 0, mid: 10, high: 20 })[1]!.mid - 1100) < 1e-9);
});
