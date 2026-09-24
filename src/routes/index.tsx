import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { Sparkline } from "@/components/charts/sparkline";
import { CategoryPathChart } from "@/components/charts/category-path";
import { IndexPathChart } from "@/components/charts/index-path";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ReturnCell } from "@/components/funds/return-cell";
import { PeriodPills } from "@/components/funds/period-pills";
import {
  allFunds,
  catalogMeta,
  categoryStats,
  SLEEVE_LABEL,
  sleeveStats,
  uniqueSchemes,
} from "@/lib/mpf/catalog";
import { fmtAum, fmtNum, fmtPct, retClass } from "@/lib/mpf/format";
import { MPFA_PERIOD_NOTE, PERIOD_LABEL, type MedianPeriod } from "@/lib/mpf/returns";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => getMarkets() });
  const [period, setPeriod] = useState<MedianPeriod>("ret1y");

  const schemes = uniqueSchemes();
  const totalAum = schemes.reduce((s, x) => s + x.aum, 0);
  const cats = categoryStats();
  const sleeves = sleeveStats(period).filter((s) => s.count >= 3).slice(0, 12);
  const lowFee = [...allFunds].filter((f) => f.fer != null).sort((a, b) => (a.fer ?? 9) - (b.fer ?? 9)).slice(0, 5);

  return (
    <div>
      <PageTitle
        kicker={zh ? "香港強積金 · 成分基金比較" : "Hong Kong MPF · constituent funds"}
        title={zh ? "依據積金局數據，比較全港成分基金。" : "Compare Hong Kong’s MPF funds using official MPFA data."}
        subtitle={
          zh
            ? `涵蓋 ${catalogMeta.fundCount} 隻成分基金、${catalogMeta.schemeCount} 個註冊計劃。點選類別、策略或計劃即可查看相關基金。數字截至 ${catalogMeta.asOf}。`
            : `${catalogMeta.fundCount} funds, ${catalogMeta.schemeCount} schemes. Tap a type, sleeve or scheme to open that list. As of ${catalogMeta.asOf}.`
        }
      />
      <AsOfLine zh={zh} />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat to="/funds" label={zh ? "成分基金" : "Funds"} value={String(catalogMeta.fundCount)} hint={zh ? "點選查看全部" : "Tap to browse"} tint="bg-tint-sky" />
        <Stat to="/schemes" label={zh ? "註冊計劃" : "Schemes"} value={String(catalogMeta.schemeCount)} hint={zh ? "點選查看各計劃基金" : "Tap a scheme’s funds"} tint="bg-tint-mint" />
        <Stat label={zh ? "制度資產" : "System AUM"} value={fmtAum(totalAum)} hint={zh ? "成分基金淨值合計" : "sum of fund NAV"} tint="bg-tint-sand" />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-xl">{zh ? "按類別中位回報" : "Median by type"}</h2>
          <PeriodPills value={period} onChange={setPeriod} zh={zh} />
        </div>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cats.map((c) => {
              const v = c[period];
              return (
                <Link key={c.category} to="/funds" search={{ category: c.category }} className="block rounded-lg p-1 -m-1 hover:bg-tint-sky">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{zh ? { equity: "股票", mixed: "混合資產", bond: "債券", money: "貨幣市場", guaranteed: "保證" }[c.category] : c.category}</span>
                    <ReturnCell value={v} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-warm">
                    <div
                      className={cn("h-full rounded-full", (v ?? 0) >= 0 ? "bg-up" : "bg-down")}
                      style={{ width: `${Math.min(100, Math.abs(v ?? 0) * 3)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-subtle">
                    n={c.count} · {zh ? "開支" : "FER"} {c.fer?.toFixed(2)}%
                  </p>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-subtle">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
        </Card>
      </section>

      <section className="mb-10">
        <div className="mb-3">
          <h2 className="font-display text-xl">{zh ? "此時段中位最高的策略" : "Highest median sleeves this period"}</h2>
          <p className="mt-1 w-full text-[11px] leading-relaxed text-canvas-muted">
            {zh
              ? `按上方所選時段（現為：${PERIOD_LABEL[period].zh}）將策略由高到低排列。點選可進入基金庫，查看該組基金。並非預測下一時段仍會領先。`
              : `Ranked by the period selected above (now ${PERIOD_LABEL[period].en}). Tap a sleeve to open those funds. Not a forecast.`}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {sleeves.map((s, i) => (
            <Link key={s.sleeve} to="/funds" search={{ sleeve: s.sleeve }} className="rounded-lg bg-card p-3 text-fg shadow-[var(--shadow-border)] transition-transform active:scale-[0.98]">
              <p className="text-xs text-muted">
                <span className="mr-1.5 font-mono text-subtle">{i + 1}</span>
                {SLEEVE_LABEL[s.sleeve]?.[zh ? "zh" : "en"] ?? s.sleeve}
              </p>
              <p className={cn("font-mono text-xl tabular-nums", retClass(s.ret))}>{fmtPct(s.ret)}</p>
              <p className="text-[11px] text-subtle">
                {zh ? PERIOD_LABEL[period].zh : PERIOD_LABEL[period].en} · {s.count}
                {zh ? " 隻 · 查看" : " funds · view"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-10">
        <CategoryPathChart zh={zh} />
      </div>

      <div className="mb-10">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">{zh ? "開支比率最低" : "Lowest expense ratio"}</h2>
            <Badge>MPFA {catalogMeta.asOf}</Badge>
          </div>
          <p className="mb-3 text-xs text-muted">
            {zh
              ? "開支比率（FER）為每年經常性收費。同類比較時，較低者長線被費用侵蝕較少。"
              : "The fund expense ratio (FER) is the annual ongoing cost. Lower is better among peers."}
          </p>
          <ol className="space-y-2">
            {lowFee.map((f, i) => (
              <li key={f.id}>
                <Link to="/funds/$id" params={{ id: f.id }} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-mono text-subtle">{i + 1}</span>
                    {zh ? f.nameZh : f.nameEn}
                  </span>
                  <span className="font-mono tabular-nums text-primary">{f.fer?.toFixed(2)}%</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">{zh ? "市況參考（非基金）" : "Market context (not funds)"}</h2>
            <p className="mt-1 w-full text-[11px] leading-relaxed text-canvas-muted">
              {zh
                ? "Yahoo 指數，開啟頁面時更新。不是積金局單位價，亦不是上方官方年化。"
                : "Yahoo indices, refresh on load. Not MPFA NAVs and not the official returns above."}
            </p>
          </div>
          <p className="font-mono text-[11px] text-canvas-muted">
            {markets.data ? new Date(markets.data.fetchedAt).toLocaleString("zh-HK", { hour12: false }) : "—"}
          </p>
        </div>
        {markets.isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {(markets.data?.quotes ?? []).map((q) => (
              <Card key={q.symbol} className="p-3 sm:p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted">{zh ? q.nameZh : q.nameEn}</p>
                    <p className="font-mono text-lg tabular-nums">{q.price != null ? fmtNum(q.price, q.symbol === "^TNX" ? 3 : 2) : "—"}</p>
                  </div>
                  <Sparkline data={q.spark} />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={cn("font-mono tabular-nums", retClass(q.changePct))}>{fmtPct(q.changePct)}</span>
                  <span className="text-subtle">YTD {fmtPct(q.ytdPct, 1)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-canvas-muted">
          {zh
            ? markets.data?.notes
            : "Index quotes via Yahoo Finance (HK delayed ~15 minutes). This is not MPFA fund NAV, and not the fund snapshot date."}
        </p>
        <div className="mt-4">
          <IndexPathChart zh={zh} />
        </div>
      </section>

      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl">{zh ? "按目標篩選配置" : "Filter a mix by your goal"}</h2>
          <p className="mt-1 text-sm text-muted">
            {zh
              ? "輸入目標與風險，系統會在可轉換範圍內排序基金。"
              : "Enter a goal and risk appetite; funds are ranked within what you can switch."}
          </p>
        </div>
        <Button asChild>
          <Link to="/recommend">
            {zh ? "開始推介" : "Start"} <ArrowRight />
          </Link>
        </Button>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tint,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  tint?: string;
  to?: "/funds" | "/schemes";
}) {
  const inner = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl tabular-nums text-primary">{value}</p>
      <p className="text-[11px] text-subtle">{hint}</p>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="block">
        <Card className={cn("p-4 transition-transform active:scale-[0.99]", tint)}>{inner}</Card>
      </Link>
    );
  }
  return <Card className={cn("p-4", tint)}>{inner}</Card>;
}
