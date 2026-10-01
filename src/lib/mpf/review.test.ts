import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateSince } from "./review.ts";

const at = "2026-09-01T00:00:00Z";
const today = new Date("2026-10-01T00:00:00Z");

test("equity fund follows its index times beta, less fees for the days held", () => {
  const r = estimateSince(
    { at, holdings: [{ id: "a", weight: 1, nameZh: "", nameEn: "", bench: "^GSPC", beta: 1, fer: 1.2 }], levels: { "^GSPC": 100, "^TNX": 4 } },
    { "^GSPC": 105, "^TNX": 4 },
    today,
  );
  assert.equal(r.days, 30);
  assert.ok(Math.abs(r.pct! - (5 - (1.2 * 30) / 365)) < 1e-9);
});

test("bond part falls when yields rise", () => {
  const r = estimateSince(
    { at, holdings: [{ id: "b", weight: 1, nameZh: "", nameEn: "", bench: "^TNX", beta: 0.1, fer: 0 }], levels: { "^TNX": 4 } },
    { "^TNX": 4.5 },
    today,
  );
  assert.ok(r.pct! < 0);
});

test("cash-like funds accrue their yearly return pro rata; mix is weight-averaged", () => {
  const r = estimateSince(
    {
      at,
      holdings: [
        { id: "c", weight: 0.5, nameZh: "", nameEn: "", cashLike: true, ret1y: 3.65, fer: 0 },
        { id: "d", weight: 0.5, nameZh: "", nameEn: "", bench: "^HSI", beta: 1, fer: 0 },
      ],
      levels: { "^HSI": 200 },
    },
    { "^HSI": 220 },
    today,
  );
  assert.ok(Math.abs(r.holdings[0]!.pct! - 0.3) < 1e-9);
  assert.ok(Math.abs(r.pct! - (0.5 * 0.3 + 0.5 * 10)) < 1e-9);
});
