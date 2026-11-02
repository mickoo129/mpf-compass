import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtNum, fmtPct, retClass } from "@/lib/mpf/format";
import type { MarketQuote } from "@/lib/mpf/types";
import { CHART_RANGES, getIndexChart, type ChartRange } from "@/lib/server/markets";
import { cn } from "@/lib/utils";

// 時段跟 Yahoo Finance 一樣分法
const RANGE_LABEL: Record<ChartRange, { zh: string; en: string }> = {
  "1d": { zh: "1日", en: "1D" },
  "5d": { zh: "5日", en: "5D" },
  "1mo": { zh: "1個月", en: "1M" },
  "6mo": { zh: "6個月", en: "6M" },
  ytd: { zh: "年初至今", en: "YTD" },
  "1y": { zh: "1年", en: "1Y" },
  "5y": { zh: "5年", en: "5Y" },
  max: { zh: "全部", en: "All" },
};

// 指數 → 相關強積金基金類別（基金庫 ?sleeve=）。黃金、美元指數冇對應嘅強積金基金。
const RELATED_SLEEVE: Record<string, string> = {
  "^HSI": "hk",
  "^HSCE": "hk-china",
  "^GSPC": "us",
  "^IXIC": "us",
  "^N225": "japan",
  "^KS11": "korea",
  "^TWII": "asia",
  "000300.SS": "china",
  "^STOXX50E": "europe",
  "^TNX": "bond-global",
};

const HK_TZ = "Asia/Hong_Kong";

function fmtTick(t: number, range: ChartRange): string {
  const d = new Date(t * 1000);
  if (range === "1d") return d.toLocaleTimeString("zh-HK", { timeZone: HK_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  if (range === "5y" || range === "max") return String(d.toLocaleDateString("en-CA", { timeZone: HK_TZ, year: "numeric" }));
  return d.toLocaleDateString("zh-HK", { timeZone: HK_TZ, month: "numeric", day: "numeric" });
}

function fmtFull(t: number, range: ChartRange): string {
  const d = new Date(t * 1000);
  const date = d.toLocaleDateString("zh-HK", { timeZone: HK_TZ, year: "numeric", month: "numeric", day: "numeric" });
  if (range === "1d" || range === "5d") {
    return `${date} ${d.toLocaleTimeString("zh-HK", { timeZone: HK_TZ, hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  return date;
}

function fmtLevel(symbol: string, v: number | null | undefined): string {
  if (v == null) return "—";
  return symbol === "^TNX" ? `${v.toFixed(2)}%` : fmtNum(v, 2);
}

export function MarketDetail({ quote, zh, onClose }: { quote: MarketQuote | null; zh: boolean; onClose: () => void }) {
  const [range, setRange] = useState<ChartRange>("1y");
  const symbol = quote?.symbol ?? "";
  const chart = useQuery({
    queryKey: ["index-chart", symbol, range],
    queryFn: () => getIndexChart({ data: { symbol, range } }),
    enabled: !!quote,
    staleTime: range === "1d" || range === "5d" ? 60_000 : 30 * 60_000,
  });
  const c = chart.data;
  const change = c && c.base && c.last != null ? ((c.last - c.base) / c.base) * 100 : null;
  const sleeve = quote ? RELATED_SLEEVE[quote.symbol] : undefined;
  const sleeveName = sleeve ? SLEEVE_LABEL[sleeve]?.[zh ? "zh" : "en"] : null;

  return (
    <Dialog open={!!quote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto pr-5">
        {quote ? (
          <>
            <DialogTitle className="pr-8">{zh ? quote.nameZh : quote.nameEn}</DialogTitle>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-num text-2xl font-semibold tabular-nums">{fmtLevel(quote.symbol, c?.last ?? quote.price)}</span>
              {change != null ? (
                <span className={cn("font-num text-sm tabular-nums", retClass(change))}>
                  {fmtPct(change)} <span className="text-muted">（{zh ? RANGE_LABEL[range].zh : RANGE_LABEL[range].en}）</span>
                </span>
              ) : null}
            </div>
            {c?.asOf ? (
              <p className="mt-0.5 text-xs text-muted">
                {zh ? `截至 ${fmtFull(c.asOf, "1d")}（香港時間）` : `As of ${fmtFull(c.asOf, "1d")} HKT`}
              </p>
            ) : null}

            <div className="mt-3 inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-black/5 p-1" role="tablist" aria-label={zh ? "時段" : "Range"}>
              {CHART_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "h-9 shrink-0 rounded-md px-2.5 text-xs whitespace-nowrap",
                    range === r ? "bg-white font-semibold text-fg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {zh ? RANGE_LABEL[r].zh : RANGE_LABEL[r].en}
                </button>
              ))}
            </div>

            <div className="mt-3 h-56 min-w-0 sm:h-64">
              {chart.isLoading ? (
                <Skeleton className="h-full" />
              ) : !c ? (
                <p className="flex h-full items-center justify-center text-sm text-muted">
                  {zh ? "暫時攞唔到呢個時段嘅走勢，請試下其他時段或者遲啲再睇。" : "No chart for this range right now."}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={c.points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mk-index-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00A758" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#00A758" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      tickCount={5}
                      tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                      tickFormatter={(t: number) => fmtTick(t, range)}
                    />
                    <YAxis
                      width={52}
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                      tickFormatter={(v: number) => (quote.symbol === "^TNX" ? v.toFixed(2) : fmtNum(v, 0))}
                    />
                    <Tooltip
                      labelFormatter={(t: number) => fmtFull(t, range)}
                      formatter={(v: number) => [fmtLevel(quote.symbol, v), zh ? quote.nameZh : quote.nameEn]}
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="c" stroke="#00A758" strokeWidth={2} fill="url(#mk-index-fill)" dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted">
              {zh
                ? "呢個係市場指數，唔係強積金基金價格，亦未扣基金收費。報價來自 Yahoo Finance，大約延遲 15 分鐘；唔喺交易時間會顯示上一個交易日。"
                : "A market index, not an MPF fund price and before fund fees. Yahoo Finance, delayed about 15 minutes."}
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {sleeve && sleeveName ? (
                <Button asChild>
                  <Link to="/funds" search={{ sleeve }} onClick={onClose}>
                    {zh ? `睇相關強積金基金（${sleeveName}）` : `See related MPF funds (${sleeveName})`}
                  </Link>
                </Button>
              ) : (
                <span className="text-xs text-muted">{zh ? "強積金冇直接對應呢個指數嘅基金類別。" : "No MPF fund type tracks this directly."}</span>
              )}
              <a
                href={`https://finance.yahoo.com/quote/${encodeURIComponent(quote.symbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#00753E] underline underline-offset-2"
              >
                {zh ? "去 Yahoo Finance 睇更多 ↗" : "More on Yahoo Finance ↗"}
              </a>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
