import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { allFunds, CAL_YEARS, catalogMeta, median, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtPct } from "@/lib/mpf/format";
import type { Fund } from "@/lib/mpf/types";
import { cn } from "@/lib/utils";

type Col = { key: keyof Fund; zh: string; en: string };

// Newest first, so a phone screen shows the most recent periods without scrolling.
const COLS: Col[] = [
  { key: "ret1y", zh: "近1年", en: "1Y" },
  ...[...CAL_YEARS].reverse().map((y) => ({ key: `y${y}` as keyof Fund, zh: String(y), en: String(y) })),
];

const GROUPS: { zh: string; en: string; sleeves: string[] }[] = [
  {
    zh: "股票（按地區）",
    en: "Equity by region",
    sleeves: ["us", "global", "europe", "japan", "asia", "hk", "hk-china", "greater-china", "china", "korea"],
  },
  {
    zh: "混合資產及預設投資",
    en: "Mixed & DIS",
    sleeves: ["mixed-aggressive", "mixed-growth", "mixed-target", "mixed-balanced", "mixed-conservative", "dis-caf", "dis-a65"],
  },
  {
    zh: "債券及保守",
    en: "Bonds & cash",
    sleeves: ["bond-global", "bond-asia", "bond-hk", "bond-cn", "guaranteed", "conservative"],
  },
];

type Mode = "value" | "rank";

/** Diverging tint: red for losses, green for gains, saturating at ±30%. */
function valueTint(v: number): string {
  const a = Math.min(1, Math.abs(v) / 30) * 0.75 + 0.06;
  return v >= 0 ? `rgba(31, 138, 92, ${a.toFixed(3)})` : `rgba(194, 75, 60, ${a.toFixed(3)})`;
}

/** Rank tint: top of the column darkest green, bottom darkest red. */
function rankTint(rank: number, n: number): string {
  if (n <= 1) return "transparent";
  const x = rank / (n - 1); // 0 = best
  const d = Math.abs(x - 0.5) * 2;
  const a = d * 0.7 + 0.05;
  return x <= 0.5 ? `rgba(31, 138, 92, ${a.toFixed(3)})` : `rgba(194, 75, 60, ${a.toFixed(3)})`;
}

export function ReturnHeatmap({ zh }: { zh: boolean }) {
  const [mode, setMode] = useState<Mode>("rank");

  const rows = useMemo(() => {
    return GROUPS.map((g) => ({
      ...g,
      rows: g.sleeves
        .map((sleeve) => {
          const funds = allFunds.filter((f) => f.sleeve === sleeve);
          const cells = COLS.map((c) => median(funds.map((f) => (f[c.key] as number | null) ?? NaN)));
          return { sleeve, count: funds.length, cells };
        })
        .filter((r) => r.count >= 3),
    })).filter((g) => g.rows.length);
  }, []);

  // Rank each column across every row shown, so colours compare like with like.
  const ranks = useMemo(() => {
    const flat = rows.flatMap((g) => g.rows);
    return COLS.map((_, ci) => {
      const vals = flat
        .map((r) => ({ sleeve: r.sleeve, v: r.cells[ci] }))
        .filter((x): x is { sleeve: string; v: number } => x.v != null)
        .sort((a, b) => b.v - a.v);
      return { n: vals.length, pos: new Map(vals.map((x, i) => [x.sleeve, i])) };
    });
  }, [rows]);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl">{zh ? "同期比較：邊類好、邊類差" : "Same period: who led, who lagged"}</h2>
          <p className="mt-1 text-xs text-muted">
            {zh
              ? `每格係該類基金喺該年嘅中位回報。綠色較好、紅色較差。冇一類年年領先。近1年截至 ${catalogMeta.asOf}。`
              : `Each cell is the median return of that group in that year. Green led, red lagged. No group leads every year. 1Y to ${catalogMeta.asOf}.`}
          </p>
        </div>
        <div className="flex shrink-0 rounded-md border border-border p-0.5 text-xs" role="tablist">
          {(["rank", "value"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                mode === m ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
              )}
            >
              {m === "rank" ? (zh ? "按同年排名著色" : "Colour by rank") : zh ? "按升跌幅著色" : "Colour by return"}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-1 text-xs text-subtle sm:hidden">{zh ? "← 左右掃睇較早年份 →" : "← Swipe for earlier years →"}</p>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-normal text-subtle">
                {zh ? "類別" : "Group"}
              </th>
              {COLS.map((c) => (
                <th key={String(c.key)} className="px-1 py-1 text-center font-mono font-normal text-subtle">
                  {zh ? c.zh : c.en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <GroupRows key={g.en} group={g} zh={zh} mode={mode} ranks={ranks} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-subtle">
        {zh
          ? "數字來自積金局基金平台曆年回報，每類取中位數，只計 3 隻或以上基金嘅類別。撳類別名可以睇返嗰組基金。過往表現不代表將來。"
          : "MPFA calendar-year returns, median per group, groups with 3+ funds only. Tap a group to see its funds. Past returns do not predict future ones."}
      </p>
    </Card>
  );
}

function GroupRows({
  group,
  zh,
  mode,
  ranks,
}: {
  group: { zh: string; en: string; rows: { sleeve: string; count: number; cells: (number | null)[] }[] };
  zh: boolean;
  mode: Mode;
  ranks: { n: number; pos: Map<string, number> }[];
}) {
  return (
    <>
      <tr>
        <td colSpan={COLS.length + 1} className="sticky left-0 px-2 pt-2 pb-0.5 text-xs font-medium text-muted">
          {zh ? group.zh : group.en}
        </td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.sleeve}>
          <td className="sticky left-0 z-10 bg-card px-1.5 py-1.5 whitespace-nowrap sm:px-2">
            <Link to="/funds" search={{ sleeve: r.sleeve }} className="text-fg hover:text-primary hover:underline">
              {SLEEVE_LABEL[r.sleeve]?.[zh ? "zh" : "en"] ?? r.sleeve}
            </Link>
            <span className="ml-1 hidden text-xs text-subtle sm:inline">{r.count}</span>
          </td>
          {r.cells.map((v, ci) => {
            const pos = ranks[ci]?.pos.get(r.sleeve);
            const bg =
              v == null
                ? "transparent"
                : mode === "value"
                  ? valueTint(v)
                  : pos != null
                    ? rankTint(pos, ranks[ci]!.n)
                    : "transparent";
            return (
              <td
                key={ci}
                className="rounded px-1 py-1.5 text-center font-mono tabular-nums text-fg"
                style={{ backgroundColor: bg }}
                title={pos != null ? (zh ? `同年排第 ${pos + 1} / ${ranks[ci]!.n}` : `Rank ${pos + 1} of ${ranks[ci]!.n}`) : undefined}
              >
                {v == null ? "—" : fmtPct(v, 1)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
