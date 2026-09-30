import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtHkd, fmtPct } from "@/lib/mpf/format";
import { blendMonthly, fundMonthly, isCashLike, seriesMap, summarize, type RangeSummary } from "@/lib/mpf/ranges";
import type { Fund } from "@/lib/mpf/types";
import { getReturnHistory } from "@/lib/server/markets";
import { cn } from "@/lib/utils";

const WINDOWS = [
  { months: 1, zh: "1 個月", en: "1 month" },
  { months: 3, zh: "3 個月", en: "3 months" },
  { months: 6, zh: "半年", en: "6 months" },
  { months: 12, zh: "1 年", en: "1 year" },
] as const;

export function RangeCard({
  items,
  zh,
  initialMonths = 3,
  amount = 0,
  title,
  className,
}: {
  items: { fund: Fund; weight: number }[];
  zh: boolean;
  initialMonths?: 1 | 3 | 6 | 12;
  /** Optional HK$ balance to translate the range into dollars. */
  amount?: number;
  title?: string;
  className?: string;
}) {
  const [months, setMonths] = useState<number>(initialMonths);
  const history = useQuery({
    queryKey: ["return-history"],
    queryFn: () => getReturnHistory(),
    staleTime: 60 * 60 * 1000,
  });

  const allCash = items.length > 0 && items.every((i) => isCashLike(i.fund));

  const blended = useMemo(() => {
    if (!history.data?.series.length || !items.length) return null;
    const bySymbol = seriesMap(history.data.series);
    const parts = items
      .map((i) => {
        const s = fundMonthly(i.fund, bySymbol);
        if (s) return { series: s, weight: i.weight };
        // Cash-like holdings: flat monthly return from the fund's own long-run average.
        const flat = ((i.fund.retSince ?? i.fund.ret1y ?? 1) as number) / 12;
        const anyIndex = bySymbol.get("^GSPC") ?? [...bySymbol.values()][0];
        if (!anyIndex) return null;
        return { series: new Map([...anyIndex.keys()].map((t) => [t, flat])), weight: i.weight };
      })
      .filter((p): p is { series: Map<string, number>; weight: number } => p != null);
    return parts.length ? blendMonthly(parts) : null;
  }, [history.data, items]);

  const summary = useMemo(() => (blended ? summarize(blended, months) : null), [blended, months]);
  const label = WINDOWS.find((w) => w.months === months) ?? WINDOWS[1];

  return (
    <Card className={className}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg">{title ?? (zh ? "可能升跌範圍（歷史估算）" : "Range of outcomes (historical)")}</h2>
          <p className="mt-1 text-xs text-muted">
            {zh
              ? "唔係預測。以下係過去每一段同樣長度時間嘅實際走勢分佈，等你知道一般會上落幾多。"
              : "Not a forecast: how every past window of the same length actually turned out."}
          </p>
        </div>
        <div className="flex shrink-0 rounded-md border border-border p-0.5 text-xs" role="tablist">
          {WINDOWS.map((w) => (
            <button
              key={w.months}
              type="button"
              role="tab"
              aria-selected={months === w.months}
              onClick={() => setMonths(w.months)}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                months === w.months ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
              )}
            >
              {zh ? w.zh : w.en}
            </button>
          ))}
        </div>
      </div>

      {allCash ? (
        <p className="text-sm text-muted">
          {zh
            ? "呢類屬貨幣市場／保守／保證基金，每月上落極細，主要取決於利率同收費，所以唔適合用指數估算範圍。"
            : "Cash-like fund: monthly moves are tiny and driven by rates and fees, so no index range is shown."}
        </p>
      ) : history.isLoading ? (
        <Skeleton className="h-28" />
      ) : !summary ? (
        <p className="text-sm text-muted">
          {zh ? "暫時攞唔到指數歷史數據，請稍後再試。" : "Index history is unavailable right now. Try again later."}
        </p>
      ) : (
        <RangeBody s={summary} zh={zh} label={zh ? label.zh : label.en} amount={amount} />
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-subtle">
        {zh
          ? "估算方法：冇基金每日單位價，所以用每隻基金最接近嘅市場指數（混合及債券基金再加債券指數），按其股票比重調整並扣除開支比率。指數價格唔包股息，所以數字會略為偏低。過往走勢不代表將來，亦唔係基金實際回報。"
          : "Method: no fund unit prices, so each fund is proxied by its closest index (plus a bond index for mixed/bond funds), scaled by equity weight, minus FER. Index prices exclude dividends, so figures lean low. Past ranges do not predict the future."}
      </p>
    </Card>
  );
}

function RangeBody({ s, zh, label, amount }: { s: RangeSummary; zh: boolean; label: string; amount: number }) {
  const lo = Math.min(s.min, 0);
  const hi = Math.max(s.max, 0);
  const span = hi - lo || 1;
  const x = (v: number) => `${((v - lo) / span) * 100}%`;
  const w = (a: number, b: number) => `${((b - a) / span) * 100}%`;
  const hk = (pct: number) => {
    const v = (amount * pct) / 100;
    return `${v >= 0 ? "+" : "−"}${fmtHkd(Math.abs(v))}`;
  };

  return (
    <div>
      <div className="relative h-10" aria-hidden>
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border" />
        <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-subtle/50" style={{ left: x(s.min), width: w(s.min, s.max) }} />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-primary/25" style={{ left: x(s.p10), width: w(s.p10, s.p90) }} />
        <div className="absolute top-1/2 h-5 -translate-y-1/2 rounded-sm bg-primary/55" style={{ left: x(s.p25), width: w(s.p25, s.p75) }} />
        <div className="absolute top-1/2 h-7 w-0.5 -translate-y-1/2 bg-ink" style={{ left: x(s.p50) }} />
        <div className="absolute top-0 h-full w-px bg-fg/60" style={{ left: x(0) }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-subtle">
        <span className="text-down">{fmtPct(s.min, 1)}</span>
        <span>0%</span>
        <span className="text-up">{fmtPct(s.max, 1)}</span>
      </div>

      <p className="mt-3 text-sm text-fg">
        {zh
          ? `以 ${s.fromYear}–${s.toYear} 年嘅走勢計，任何${label}：`
          : `Based on ${s.fromYear}–${s.toYear}, over any ${label}:`}
      </p>
      <ul className="mt-1 space-y-1 text-sm text-muted">
        <li>
          {zh ? "一半時間介乎 " : "Half the time between "}
          <b className="font-mono text-fg">{fmtPct(s.p25, 1)}</b>
          {zh ? " 至 " : " and "}
          <b className="font-mono text-fg">{fmtPct(s.p75, 1)}</b>
        </li>
        <li>
          {zh ? "十次有八次介乎 " : "8 times in 10 between "}
          <b className="font-mono text-fg">{fmtPct(s.p10, 1)}</b>
          {zh ? " 至 " : " and "}
          <b className="font-mono text-fg">{fmtPct(s.p90, 1)}</b>
          {amount > 0 ? (
            <span className="text-subtle">
              {zh ? `（以你 ${fmtHkd(amount)} 計，約 ${hk(s.p10)} 至 ${hk(s.p90)}）` : ` (on ${fmtHkd(amount)}: ${hk(s.p10)} to ${hk(s.p90)})`}
            </span>
          ) : null}
        </li>
        <li>
          {zh ? "最差 " : "Worst "}
          <b className="font-mono text-down">{fmtPct(s.min, 1)}</b>
          {zh ? "，最好 " : ", best "}
          <b className="font-mono text-up">{fmtPct(s.max, 1)}</b>
        </li>
        <li>
          {zh ? "錄得上升嘅機會約 " : "Finished higher about "}
          <b className="font-mono text-fg">{Math.round(s.upShare * 100)}%</b>
          {zh ? `（共 ${s.samples} 段）` : ` of the time (${s.samples} windows)`}
        </li>
      </ul>
    </div>
  );
}
