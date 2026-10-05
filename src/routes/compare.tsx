import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReturnCell } from "@/components/funds/return-cell";
import { allFunds, fundById, providerStats } from "@/lib/mpf/catalog";
import { fmtAum, fmtHkd, fmtPctPlain } from "@/lib/mpf/format";
import { BalanceInput, EXAMPLE_BALANCE, EXAMPLE_MONTHLY } from "@/components/funds/fee-card";
import { FundPicker } from "@/components/funds/fund-picker";
import { Term } from "@/components/ui/term";
import { FEE_GAP_GROSS, feeGap } from "@/lib/mpf/fees";
import { calendar3yAnn, MPFA_PERIOD_NOTE } from "@/lib/mpf/returns";
import type { Fund } from "@/lib/mpf/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: seo({ title: "比較強積金基金", description: "供應商、基金回報同收費排行，最多四隻基金並排比較，收費以港幣計。", path: "/compare" }),
  }),
  component: ComparePage,
});

type RankKey = "ret1y" | "ret3yCal" | "ret5y" | "ret10y";
type ProvKey = "count" | "aum" | "fer" | "ret1y" | "ret3y" | "ret5y" | "ret10y";

function rankValue(fund: Fund, key: RankKey): number | null {
  if (key === "ret3yCal") return calendar3yAnn(fund);
  return fund[key];
}

function ComparePage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const ids = useAppStore((s) => s.compareIds);
  const toggle = useAppStore((s) => s.toggleCompare);
  const clear = useAppStore((s) => s.clearCompare);
  const funds = ids.map(fundById).filter((f): f is NonNullable<typeof f> => !!f);
  const schemeEn = useAppStore((s) => s.profile.schemeEn);
  const [onlyScheme, setOnlyScheme] = useState(false);
  const providers = providerStats();
  const [provSort, setProvSort] = useState<ProvKey>("ret1y");
  const [provDir, setProvDir] = useState<"desc" | "asc">("desc");
  const [sort, setSort] = useState<RankKey>("ret1y");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const providersSorted = useMemo(() => {
    return [...providers].sort((a, b) => {
      const empty = provDir === "asc" ? Infinity : -Infinity;
      const av = a[provSort] ?? empty;
      const bv = b[provSort] ?? empty;
      return provDir === "desc" ? bv - av : av - bv;
    });
  }, [providers, provSort, provDir]);
  const ranked = useMemo(() => {
    const pool = onlyScheme && schemeEn ? allFunds.filter((f) => f.schemeEn === schemeEn) : allFunds;
    return [...pool]
      .filter((f) => rankValue(f, sort) != null)
      .sort((a, b) => {
        const av = rankValue(a, sort) ?? -999;
        const bv = rankValue(b, sort) ?? -999;
        return dir === "desc" ? bv - av : av - bv;
      })
      .slice(0, 15);
  }, [sort, dir, onlyScheme, schemeEn]);

  function clickSort<K extends string>(
    key: K,
    current: K,
    setKey: (k: K) => void,
    currentDir: "desc" | "asc",
    setDirFn: (d: "desc" | "asc") => void,
    defaultDir: "desc" | "asc" = "desc",
  ) {
    if (current === key) setDirFn(currentDir === "desc" ? "asc" : "desc");
    else {
      setKey(key);
      setDirFn(defaultDir);
    }
  }

  function sortHeader(key: RankKey, label: string) {
    const active = sort === key;
    return (
      <button type="button" className={cn("font-medium", active ? "text-primary" : "text-muted")} onClick={() => clickSort(key, sort, setSort, dir, setDir)}>
        {label}
        {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    );
  }

  function provHeader(key: ProvKey, label: string) {
    const active = provSort === key;
    return (
      <button
        type="button"
        className={cn("font-medium", active ? "text-primary" : "text-muted")}
        onClick={() => clickSort(key, provSort, setProvSort, provDir, setProvDir, key === "fer" ? "asc" : "desc")}
      >
        {label}
        {active ? (provDir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    );
  }

  return (
    <div>
      <PageTitle
        kicker={zh ? "比較" : "Compare"}
        title={zh ? "基金並排比較" : "Compare funds side by side"}
        subtitle={zh ? "最多四隻，回報、收費同風險一次過睇。" : "Up to four funds: returns, fees and risk together."}
      />
      <AsOfLine zh={zh} />
      <Card className="relative z-20 mb-4 overflow-visible">
        <h2 className="mb-2 font-display text-lg">
          {zh ? `加入要比較嘅基金（${funds.length}／4）` : `Add funds to compare (${funds.length}/4)`}
        </h2>
        <FundPicker
          zh={zh}
          exclude={ids}
          disabled={funds.length >= 4}
          onPick={(f) => toggle(f.id)}
          placeholder={
            funds.length >= 4
              ? zh
                ? "已經揀滿四隻，先移走一隻"
                : "Four selected; remove one first"
              : zh
                ? "打基金名或者公司名，例如：宏利北美、滙豐核心"
                : "Type a fund or company name"
          }
        />
        {funds.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {funds.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-tint-sky px-3 py-1.5 text-sm"
                title={zh ? "移走" : "Remove"}
              >
                <span className="truncate">
                  {zh ? f.nameZh : f.nameEn}
                  <span className="ml-1 text-xs text-subtle">{zh ? f.providerZh : f.providerEn}</span>
                </span>
                <span aria-hidden className="text-subtle">×</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={clear}>
              {zh ? "全部清空" : "Clear all"}
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">
            {zh ? "揀兩至四隻，下面就會並排顯示回報、收費（港幣）同風險。亦可以喺基金庫每隻旁邊撳「比較」。" : "Pick two to four to see returns, fees in HK$ and risk side by side."}
          </p>
        )}
      </Card>

      {funds.length ? <CustomCompare funds={funds} zh={zh} toggle={toggle} /> : null}

      <details className="group mt-8 mb-2 border-y-2 border-ink py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-canvas">
          <span>
            <span className="font-display text-lg">{zh ? "排行榜：供應商同基金回報" : "Leaderboards: providers and funds"}</span>
            <span className="block text-xs text-canvas-muted">{zh ? "想搵靈感揀邊隻嚟比，可以喺呢度撳「比較」加入" : "Browse and pin funds from here"}</span>
          </span>
          <span className="shrink-0 text-xs whitespace-nowrap text-primary group-open:hidden">{zh ? "展開" : "Show"}</span>
        </summary>
        <div className="mt-4">
      {schemeEn ? (
        <label className="mb-4 flex items-center gap-2 text-sm text-canvas-muted">
          <input type="checkbox" checked={onlyScheme} onChange={(e) => setOnlyScheme(e.target.checked)} className="accent-primary" />
          {zh ? "只顯示已選計劃的成分基金" : "Limit the fund board to your selected scheme"}
        </label>
      ) : null}

      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex items-end justify-between gap-3 border-b border-border bg-tint-sky px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-display text-lg">{zh ? "供應商表現（中位）" : "Providers (median)"}</h2>
            <p className="text-xs text-subtle">
              {zh
                ? `按基金數、資產、開支比率、1／3／5／10 年排序。現為${provDir === "desc" ? "由高至低" : "由低至高"}。中位數受旗下主題基金影響。`
                : `Click funds, AUM, FER, 1Y/3Y/5Y/10Y. Now ${provDir === "desc" ? "high to low" : "low to high"}. A median is not every fund.`}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted">{zh ? "供應商" : "Provider"}</th>
                <th className="px-3 py-2.5 text-right">{provHeader("count", zh ? "基金" : "Funds")}</th>
                <th className="px-3 py-2.5 text-right">{provHeader("aum", zh ? "資產" : "AUM")}</th>
                <th className="px-3 py-2.5 text-right">{provHeader("fer", zh ? "開支" : "FER")}</th>
                <th className="px-3 py-2.5 text-right">{provHeader("ret1y", zh ? "1年" : "1Y")}</th>
                <th className="px-3 py-2.5 text-right">{provHeader("ret3y", zh ? "3年" : "3Y")}</th>
                <th className="px-3 py-2.5 text-right">{provHeader("ret5y", zh ? "5年" : "5Y")}</th>
                <th className="px-4 py-2.5 text-right">{provHeader("ret10y", zh ? "10年" : "10Y")}</th>
              </tr>
            </thead>
            <tbody>
              {providersSorted.map((p, i) => (
                <tr key={p.code} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-2">
                    <span className="mr-2 font-mono text-xs text-subtle">{i + 1}</span>
                    {zh ? p.zh : p.en}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{p.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtAum(p.aum, zh)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtPctPlain(p.fer)}</td>
                  <td className="px-3 py-2 text-right">
                    <ReturnCell value={p.ret1y} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ReturnCell value={p.ret3y} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ReturnCell value={p.ret5y} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ReturnCell value={p.ret10y} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex items-end justify-between gap-3 border-b border-border bg-tint-mint px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-display text-lg">{zh ? "成分基金回報" : "Fund returns"}</h2>
            <p className="text-xs text-subtle">
              {zh
                ? `按 1／3／5／10 年排序。現為${dir === "desc" ? "由高至低" : "由低至高"}顯示前 15 隻。三年為推算。`
                : `Click 1Y/3Y/5Y/10Y. Showing top 15 ${dir === "desc" ? "highest" : "lowest"}. 3Y is derived.`}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-border text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted">{zh ? "基金" : "Fund"}</th>
                <th className="px-3 py-2.5 text-right">{sortHeader("ret1y", zh ? "1年" : "1Y")}</th>
                <th className="px-3 py-2.5 text-right">{sortHeader("ret3yCal", zh ? "3年" : "3Y")}</th>
                <th className="px-3 py-2.5 text-right">{sortHeader("ret5y", zh ? "5年" : "5Y")}</th>
                <th className="px-3 py-2.5 text-right">{sortHeader("ret10y", zh ? "10年" : "10Y")}</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted" />
              </tr>
            </thead>
            <tbody>
              {ranked.map((f, i) => {
                const pinned = ids.includes(f.id);
                return (
                  <tr key={f.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-2">
                      <span className="mr-2 font-mono text-xs text-subtle">{i + 1}</span>
                      <Link to="/funds/$id" params={{ id: f.id }} className="font-medium hover:underline">
                        {zh ? f.nameZh : f.nameEn}
                      </Link>
                      <p className="pl-6 text-xs text-subtle">{zh ? f.providerZh : f.providerEn}</p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ReturnCell value={f.ret1y} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ReturnCell value={calendar3yAnn(f)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ReturnCell value={f.ret5y} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ReturnCell value={f.ret10y} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggle(f.id)}
                        className={cn(
                          "rounded-md px-2 py-1 text-xs",
                          pinned ? "bg-primary text-primary-fg" : "bg-white text-muted ring-1 ring-border",
                        )}
                      >
                        {pinned ? (zh ? "已揀" : "Pinned") : zh ? "比較" : "Pin"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

        </div>
      </details>
      <p className="mt-3 text-xs leading-relaxed text-canvas-muted">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
    </div>
  );
}

function CustomCompare({
  funds,
  zh,
  toggle,
}: {
  funds: Fund[];
  zh: boolean;
  toggle: (id: string) => void;
}) {
  const chart = [
    { key: zh ? "1年" : "1Y", ...Object.fromEntries(funds.map((f) => [f.id, f.ret1y ?? 0])) },
    { key: zh ? "3年" : "3Y", ...Object.fromEntries(funds.map((f) => [f.id, calendar3yAnn(f) ?? 0])) },
    { key: zh ? "5年" : "5Y", ...Object.fromEntries(funds.map((f) => [f.id, f.ret5y ?? 0])) },
    { key: zh ? "10年" : "10Y", ...Object.fromEntries(funds.map((f) => [f.id, f.ret10y ?? 0])) },
    { key: zh ? "成立" : "Since", ...Object.fromEntries(funds.map((f) => [f.id, f.retSince ?? 0])) },
  ];
  // Categorical colours kept apart from the green/red used for gains and losses.
  const colors = ["#0b45a6", "#d4a84b", "#7b6bb5", "#5b7086"];
  type RowDef = { label: React.ReactNode; get: (f: Fund) => number | null; kind: "ret" | "low" | "plain"; fmt?: (v: number) => string };
  const rows: RowDef[] = [
    { label: zh ? "1年" : "1Y", get: (f) => f.ret1y, kind: "ret" },
    { label: <Term k="est3y">{zh ? "3年" : "3Y"}</Term>, get: (f) => calendar3yAnn(f), kind: "ret" },
    { label: zh ? "5年" : "5Y", get: (f) => f.ret5y, kind: "ret" },
    { label: zh ? "10年" : "10Y", get: (f) => f.ret10y, kind: "ret" },
    { label: zh ? "成立至今" : "Since", get: (f) => f.retSince, kind: "ret" },
    { label: "2025", get: (f) => f.y2025, kind: "ret" },
    { label: "2024", get: (f) => f.y2024, kind: "ret" },
    { label: "2023", get: (f) => f.y2023, kind: "ret" },
    { label: "2022", get: (f) => f.y2022, kind: "ret" },
    { label: "2021", get: (f) => f.y2021, kind: "ret" },
    { label: <Term k="fer" />, get: (f) => f.fer, kind: "low", fmt: (v) => `${v.toFixed(2)}%` },
    { label: <Term k="risk" />, get: (f) => f.riskClass, kind: "plain", fmt: (v) => String(v) },
  ];
  const best = (r: RowDef): number | null => {
    if (r.kind === "plain") return null;
    const vals = funds.map(r.get).filter((v): v is number => v != null);
    if (vals.length < 2) return null;
    return r.kind === "low" ? Math.min(...vals) : Math.max(...vals);
  };
  return (
    <>
      <Card className="mb-6">
        <h2 className="mb-1 font-display text-lg">{zh ? "年化回報" : "Annualised returns"}</h2>
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {funds.map((f, i) => (
            <li key={f.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: colors[i % colors.length] }} />
              {zh ? f.nameZh : f.nameEn}
              <span className="text-subtle">{zh ? f.providerZh : f.providerEn}</span>
            </li>
          ))}
        </ul>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
              <YAxis width={40} tick={{ fontSize: 11, fill: "var(--color-subtle)" }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                formatter={(v: number, name: string) => [`${v > 0 ? "+" : ""}${v.toFixed(2)}%`, name]}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
              />
              {funds.map((f, i) => (
                <Bar key={f.id} dataKey={f.id} name={zh ? f.nameZh : f.nameEn} fill={colors[i % colors.length]} radius={3} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <FeeCompare funds={funds} zh={zh} />
      <div className="overflow-x-auto border border-border border-t-2 border-t-ink bg-card text-fg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border align-bottom">
              <th className="w-20 px-3 py-2 text-left text-xs font-medium text-muted">{zh ? "逐項比較" : "Item"}</th>
              {funds.map((f, i) => (
                <th key={f.id} className="px-2 py-2 text-right font-normal">
                  <Link to="/funds/$id" params={{ id: f.id }} className="block text-sm leading-snug font-medium hover:underline">
                    <span className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: colors[i % colors.length] }} />
                    {zh ? f.nameZh : f.nameEn}
                  </Link>
                  <span className="block text-xs text-subtle">{zh ? f.schemeZh : f.schemeEn}</span>
                  <button type="button" className="text-xs text-subtle underline-offset-2 hover:underline" onClick={() => toggle(f.id)}>
                    {zh ? "移走" : "Remove"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => {
              const top = best(r);
              return (
                <tr key={ri} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">{r.label}</td>
                  {funds.map((f) => {
                    const v = r.get(f);
                    const isBest = top != null && v === top;
                    return (
                      <td key={f.id} className={cn("px-2 py-2 text-right font-mono tabular-nums", isBest && "bg-tint-mint font-semibold")}>
                        {v == null ? "—" : r.kind === "ret" ? <ReturnCell value={v} /> : r.fmt!(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-canvas-muted">
        {zh ? "淺綠色底係該項最好嗰隻（回報最高或者收費最低）。過往表現不代表將來。" : "Shaded cells are the best in each row. Past returns do not predict future ones."}
      </p>
    </>
  );
}

/** Side-by-side yearly fee in HK$ and the long-run gap between the dearest and cheapest pick. */
function FeeCompare({ funds, zh }: { funds: Fund[]; zh: boolean }) {
  const balance = useAppStore((s) => s.profile.balance);
  const monthly = useAppStore((s) => s.profile.monthly);
  const example = balance <= 0;
  const base = example ? EXAMPLE_BALANCE : balance;
  const perMonth = example && monthly <= 0 ? EXAMPLE_MONTHLY : monthly;
  const priced = funds.filter((f) => f.fer != null).sort((a, b) => (a.fer ?? 0) - (b.fer ?? 0));
  const low = priced[0];
  const high = priced.at(-1);
  const years = 30;
  const gap = low && high && high.id !== low.id ? feeGap(base, perMonth, years, high.fer!, low.fer!) : null;
  return (
    <Card className="mb-6">
      <h2 className="mb-1 font-display text-lg">{zh ? "收費以港幣計" : "Fees in HK$"}</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:max-w-md">
        <BalanceInput zh={zh} />
        <BalanceInput zh={zh} field="monthly" />
      </div>
      <ul className="space-y-1.5 text-sm">
        {priced.map((f) => (
          <li key={f.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              {zh ? f.nameZh : f.nameEn}
              <span className="block text-xs text-subtle">
                {zh ? f.schemeZh : f.schemeEn} · {fmtPctPlain(f.fer)}
              </span>
            </span>
            <span className="shrink-0 font-mono">
              {fmtHkd(((f.fer ?? 0) * base) / 100)}
              <span className="text-subtle">{zh ? "／年" : "/yr"}</span>
            </span>
          </li>
        ))}
      </ul>
      {gap != null && low && high ? (
        <p className="mt-3 rounded-lg bg-tint-mint p-3 text-sm">
          {zh
            ? `揀「${low.nameZh}」而唔係「${high.nameZh}」，${years} 年收費差距大約 `
            : `Choosing ${low.nameEn} over ${high.nameEn} saves about `}
          <b className="font-mono text-up">{fmtHkd(gap)}</b>
          {zh ? "。" : ` over ${years} years.`}
          <span className="mt-1 block text-[12px] text-muted">
            {zh
              ? `假設扣費前回報一樣（每年 ${FEE_GAP_GROSS}%），${example ? "例子：" : ""}結餘 ${fmtHkd(base)}、每月供款 ${fmtHkd(perMonth)}。收費平唔代表表現一定好。`
              : `Same ${FEE_GAP_GROSS}% return before fees assumed. Cheaper does not mean better.`}
          </span>
        </p>
      ) : null}
    </Card>
  );
}
