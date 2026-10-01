import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, HeartPulse, LayoutGrid, Scale, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { CategoryPathChart } from "@/components/charts/category-path";
import { IndexPathChart } from "@/components/charts/index-path";
import { ReturnHeatmap } from "@/components/charts/return-heatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeeAmount } from "@/components/funds/fee-card";
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
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const schemes = uniqueSchemes();
  const totalAum = schemes.reduce((s, x) => s + x.aum, 0);
  const cats = categoryStats();
  const sleeves = sleeveStats(period).filter((s) => s.count >= 3).slice(0, 12);
  const lowFee = [...allFunds].filter((f) => f.fer != null).sort((a, b) => (a.fer ?? 9) - (b.fer ?? 9)).slice(0, 5);

  return (
    <div>
      <section className="mb-8 pt-2">
        <p className="mb-2 text-xs tracking-[0.16em] text-accent">{zh ? "香港強積金 · 積金局數據" : "Hong Kong MPF · MPFA data"}</p>
        <h1 className="text-2xl leading-snug font-semibold text-white sm:text-4xl">
          {zh ? "你嘅強積金，一眼睇清。" : "Your MPF, at a glance."}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-canvas-muted sm:text-base">
          {zh
            ? `全港 ${catalogMeta.fundCount} 隻成分基金、${catalogMeta.schemeCount} 個計劃，收費、回報、風險一齊比。數字截至 ${catalogMeta.asOf}。`
            : `${catalogMeta.fundCount} funds across ${catalogMeta.schemeCount} schemes. Figures as of ${catalogMeta.asOf}.`}
        </p>
        <form
          className="relative mt-5 max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/funds", search: { q: query.trim() || undefined } });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            enterKeyHint="search"
            placeholder={zh ? "例如：宏利北美" : "e.g. Manulife North America"}
            className="h-14 rounded-xl pr-24 pl-12 text-base"
            aria-label={zh ? "搜尋基金" : "Search funds"}
          />
          <Button type="submit" className="absolute top-1/2 right-2 -translate-y-1/2">
            {zh ? "搜尋" : "Search"}
          </Button>
        </form>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <EntryCard
            to="/checkup"
            icon={<HeartPulse className="size-5" />}
            title={zh ? "健康檢查" : "Checkup"}
            sub={zh ? "我而家揀嗰幾隻得唔得？" : "Are my funds OK?"}
            tint="bg-tint-mint"
          />
          <EntryCard
            to="/recommend"
            icon={<Sparkles className="size-5" />}
            title={zh ? "智選配置" : "Goal-based mix"}
            sub={zh ? "按年齡同風險取向計好晒" : "By age and risk appetite"}
            tint="bg-tint-sky"
          />
          <EntryCard
            to="/compare"
            icon={<Scale className="size-5" />}
            title={zh ? "比較基金" : "Compare funds"}
            sub={zh ? "最多四隻並排睇" : "Up to four side by side"}
            tint="bg-tint-lilac"
          />
          <EntryCard
            href="#same-period"
            icon={<LayoutGrid className="size-5" />}
            title={zh ? "邊類表現好" : "Who led"}
            sub={zh ? "同期比較地區同類別" : "Regions and types by year"}
            tint="bg-tint-sand"
          />
        </div>
        <p className="mt-3 text-xs text-canvas-muted">
          {zh
            ? `資產合共 ${fmtAum(totalAum)} · 基金回報、收費來自積金局 · 指數來自 Yahoo Finance`
            : `Total assets ${fmtAum(totalAum)} · MPFA fund data · Yahoo Finance indices`}
        </p>
      </section>

      <div id="same-period" className="mb-10 scroll-mt-20">
        <ReturnHeatmap zh={zh} />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">{zh ? "市況參考（非基金）" : "Market context (not funds)"}</h2>
            <p className="mt-1 w-full text-xs leading-relaxed text-canvas-muted">
              {zh
                ? "Yahoo 指數，開啟頁面時更新。不是積金局單位價，亦不是上方官方年化。"
                : "Yahoo indices, refresh on load. Not MPFA NAVs and not the official returns above."}
            </p>
          </div>
          <p className="font-mono text-xs text-canvas-muted">
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
      </section>

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
                <Link to="/funds/$id" params={{ id: f.id }} className="flex items-start justify-between gap-3 text-sm">
                  <span className="flex min-w-0 gap-2">
                    <span className="font-mono text-subtle">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block">{zh ? f.nameZh : f.nameEn}</span>
                      <span className="block text-xs text-subtle">{zh ? f.schemeZh : f.schemeEn}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono tabular-nums text-primary">
                    {f.fer?.toFixed(2)}%
                    <FeeAmount fer={f.fer} zh={zh} className="block text-xs text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <details className="group mb-10 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-white">
          <span>
            <span className="font-display text-lg">{zh ? "更多數據分析" : "More analysis"}</span>
            <span className="block text-xs text-canvas-muted">
              {zh ? "按類別中位回報、策略排名、類別走勢、市場指數十年" : "Medians by type, sleeve ranking, trends, 10-year indices"}
            </span>
          </span>
          <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5">
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
                  <p className="mt-0.5 font-mono text-xs text-subtle">
                    {zh ? `${c.count} 隻 · 開支比率` : `n=${c.count} · FER`} {c.fer?.toFixed(2)}%
                  </p>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-subtle">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
        </Card>
      </section>
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="font-display text-xl">{zh ? "此時段中位最高的策略" : "Highest median sleeves this period"}</h2>
          <p className="mt-1 w-full text-xs leading-relaxed text-canvas-muted">
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
              <p className="text-xs text-subtle">
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
      <IndexPathChart zh={zh} />
        </div>
      </details>
    </div>
  );
}

function EntryCard({
  to,
  href,
  icon,
  title,
  sub,
  tint,
}: {
  to?: "/checkup" | "/recommend" | "/compare";
  href?: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  tint: string;
}) {
  const inner = (
    <>
      <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-white/80 text-primary">{icon}</span>
      <span className="block font-medium text-fg">{title}</span>
      <span className="block text-xs text-muted">{sub}</span>
    </>
  );
  const cls = cn("block min-h-[7.5rem] rounded-xl p-3 shadow-[var(--shadow-border)] transition-transform active:scale-[0.98]", tint);
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {inner}
    </a>
  );
}
