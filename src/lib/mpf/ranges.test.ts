import assert from "node:assert/strict";
import { test } from "node:test";
import { blendMonthly, fundMonthly, monthlyReturns, seriesMap, summarize } from "./ranges.ts";
import type { Fund } from "./types.ts";

function series(symbol: string, monthlyPct: number[]) {
  let close = 100;
  const points = [{ t: "2010-01", close }];
  monthlyPct.forEach((r, i) => {
    close *= 1 + r / 100;
    const y = 2010 + Math.floor((i + 1) / 12);
    const m = ((i + 1) % 12) + 1;
    points.push({ t: `${y}-${String(m).padStart(2, "0")}`, close });
  });
  return { symbol, points };
}

const fund = (over: Partial<Fund>): Fund =>
  ({ category: "equity", isConservative: false, bench: "^GSPC", beta: 1, fer: 0, ...over }) as Fund;

test("monthlyReturns recovers the input returns", () => {
  const r = [...monthlyReturns(series("X", [1, -2, 3]))].map(([, v]) => Number(v.toFixed(6)));
  assert.deepEqual(r, [1, -2, 3]);
});

test("summarize compounds rolling windows and reports quantiles", () => {
  const up = new Map(Array.from({ length: 60 }, (_, i) => [`m${String(i).padStart(3, "0")}`, 1] as const));
  const s = summarize(up, 12)!;
  assert.equal(s.samples, 49);
  assert.ok(Math.abs(s.p50 - (1.01 ** 12 - 1) * 100) < 1e-9);
  assert.equal(s.upShare, 1);
  assert.equal(summarize(new Map([["a", 1]]), 12), null);
});

test("fundMonthly scales by beta, blends bonds for mixed funds and deducts FER", () => {
  const map = seriesMap([series("^GSPC", Array(30).fill(2)), series("AGG", Array(30).fill(0.5))]);
  const eq = fundMonthly(fund({ beta: 0.5, fer: 1.2 }), map)!;
  assert.ok(Math.abs([...eq.values()][0]! - (0.5 * 2 - 0.1)) < 1e-9);
  const mixed = fundMonthly(fund({ category: "mixed", beta: 0.6, fer: 0 }), map)!;
  assert.ok(Math.abs([...mixed.values()][0]! - (0.6 * 2 + 0.4 * 0.5)) < 1e-9);
  assert.equal(fundMonthly(fund({ category: "money" }), map), null);
});

test("blendMonthly weights parts over shared months", () => {
  const a = new Map([["x", 2], ["y", 4]]);
  const b = new Map([["y", 0], ["z", 9]]);
  assert.deepEqual([...blendMonthly([{ series: a, weight: 3 }, { series: b, weight: 1 }])], [["y", 3]]);
});
