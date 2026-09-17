import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReturnCell } from "@/components/funds/return-cell";
import { allFunds, fundById, providerStats, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtAum, fmtPctPlain } from "@/lib/mpf/format";
import { calendar3yAnn, MPFA_PERIOD_NOTE } from "@/lib/mpf/returns";
import { expectedReturn } from "@/lib/mpf/score";
import type { Fund } from "@/lib/mpf/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({ component: ComparePage });

type RankKey = "ret1y" | "ret3yCal" | "ret5y" | "ret10y";

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
  const providers = providerStats();
  const [sort, setSort] = useState<RankKey>("ret1y");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const ranked = useMemo(() => {
    return [...allFunds]
      .filter((f) => rankValue(f, sort) != null)
      .sort((a, b) => {
        const av = rankValue(a, sort) ?? -999;
        const bv = rankValue(b, sort) ?? -999;
        return dir === "desc" ? bv - av : av - bv;
      })
      .slice(0, 15);
  }, [sort, dir]);

  function sortHeader(key: RankKey, label: string) {
    const active = sort === key;
    return (
      <button
        type="button"
        className={cn("font-medium", active ? "text-primary" : "text-muted")}
        onClick={() => {
          if (sort === key) setDir(dir === "desc" ? "asc" : "desc");
          else {
            setSort(key);
            setDir("desc");
          }
        }}
      >
        {label}
        {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    );
  }

  return (
    <div>
      <PageTitle
        kicker={zh ? "比較" : "Compare"}
        title={zh ? "先睇全場對照，再自選並排。" : "Start with the field, then pin your own."}
        subtitle={
          zh
            ? "積金局公布一年、五年、十年年化。三年由 2023–2025 曆年推算。沒有官方半年。供應商為中位數。撳欄位排序，再加入最多四隻並排。"
            : "MPFA publishes 1Y, 5Y and 10Y annualized. 3Y is derived from calendar 2023–2025. No official 6-month. Provider rows are medians. Click a column to rank, then pin up to four."
        }
      />

      <Card className="mb-6 overflow-hidden p-0">
        <div className="flex items-end justify-between gap-3 border-b border-border bg-tint-sky px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-display text-lg">{zh ? "供應商表現（中位）" : "Providers (median)"}</h2>
            <p className="text-[11px] text-subtle">{zh ? "中位受旗下主題基金影響，唔等於該公司每隻都好。" : "A median is not every fund."}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">{zh ? "供應商" : "Provider"}</th>
                <th className="px-3 py-2.5 text-right font-medium">{zh ? "基金" : "Funds"}</th>
                <th className="px-3 py-2.5 text-right font-medium">{zh ? "資產" : "AUM"}</th>
                <th className="px-3 py-2.5 text-right font-medium">FER</th>
                <th className="px-3 py-2.5 text-right font-medium">{zh ? "1年" : "1Y"}</th>
                <th className="px-3 py-2.5 text-right font-medium">{zh ? "3年" : "3Y"}</th>
                <th className="px-3 py-2.5 text-right font-medium">{zh ? "5年" : "5Y"}</th>
                <th className="px-4 py-2.5 text-right font-medium">{zh ? "10年" : "10Y"}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, i) => (
                <tr key={p.code} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-2">
                    <span className="mr-2 font-mono text-[11px] text-subtle">{i + 1}</span>
                    {zh ? p.zh : p.en}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{p.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmtAum(p.aum)}</td>
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
            <p className="text-[11px] text-subtle">
              {zh
                ? `撳 1／3／5／10 年排序。而家按${dir === "desc" ? "高到低" : "低到高"}顯示前 15 隻。三年為推算。`
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
                      <span className="mr-2 font-mono text-[11px] text-subtle">{i + 1}</span>
                      <Link to="/funds/$id" params={{ id: f.id }} className="font-medium hover:underline">
                        {zh ? f.nameZh : f.nameEn}
                      </Link>
                      <p className="pl-6 text-[11px] text-subtle">{zh ? f.providerZh : f.providerEn}</p>
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
                          "rounded-md px-2 py-1 text-[11px]",
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

      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl">{zh ? "自選並排" : "Your shortlist"}</h2>
        {funds.length ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            {zh ? "清空" : "Clear"}
          </Button>
        ) : null}
      </div>

      {!funds.length ? (
        <Card className="border-dashed">
          <p className="text-sm text-muted">
            {zh
              ? "上面排行榜撳「比較」，或到基金庫揀最多四隻。揀完會喺呢度並排回報、收費同風險。"
              : "Pin up to four from the boards above or the fund library."}
          </p>
          <Button asChild className="mt-3" variant="outline">
            <Link to="/funds">{zh ? "前往基金庫" : "Open universe"}</Link>
          </Button>
        </Card>
      ) : (
        <CustomCompare funds={funds} zh={zh} toggle={toggle} />
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-canvas-muted">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
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
  const colors = ["var(--color-primary)", "var(--color-up)", "var(--color-warn)", "var(--color-muted)"];
  const rows: { k: string; render: (id: string) => React.ReactNode }[] = [
    { k: zh ? "計劃" : "Scheme", render: (id) => (zh ? fundById(id)!.schemeZh : fundById(id)!.schemeEn) },
    { k: zh ? "供應商" : "Provider", render: (id) => (zh ? fundById(id)!.providerZh : fundById(id)!.providerEn) },
    {
      k: zh ? "策略" : "Sleeve",
      render: (id) => SLEEVE_LABEL[fundById(id)!.sleeve]?.[zh ? "zh" : "en"] ?? fundById(id)!.sleeve,
    },
    { k: zh ? "風險級別" : "Risk", render: (id) => fundById(id)!.riskClass ?? "—" },
    { k: "FER", render: (id) => fmtPctPlain(fundById(id)!.fer) },
    { k: zh ? "1年年化" : "1Y p.a.", render: (id) => <ReturnCell value={fundById(id)!.ret1y} /> },
    { k: zh ? "3年" : "3Y", render: (id) => <ReturnCell value={calendar3yAnn(fundById(id)!)} /> },
    { k: zh ? "5年年化" : "5Y p.a.", render: (id) => <ReturnCell value={fundById(id)!.ret5y} /> },
    { k: zh ? "10年年化" : "10Y p.a.", render: (id) => <ReturnCell value={fundById(id)!.ret10y} /> },
    { k: zh ? "成立至今" : "Since launch", render: (id) => <ReturnCell value={fundById(id)!.retSince} /> },
    { k: zh ? "5年累積" : "5Y cum.", render: (id) => <ReturnCell value={fundById(id)!.cum5y} /> },
    { k: zh ? "10年累積" : "10Y cum.", render: (id) => <ReturnCell value={fundById(id)!.cum10y} /> },
    { k: "2025", render: (id) => <ReturnCell value={fundById(id)!.y2025} /> },
    { k: "2024", render: (id) => <ReturnCell value={fundById(id)!.y2024} /> },
    { k: "2023", render: (id) => <ReturnCell value={fundById(id)!.y2023} /> },
    { k: "2022", render: (id) => <ReturnCell value={fundById(id)!.y2022} /> },
    { k: "2021", render: (id) => <ReturnCell value={fundById(id)!.y2021} /> },
    { k: zh ? "規模" : "AUM", render: (id) => fmtAum(fundById(id)!.aumM) },
    { k: zh ? "前瞻估算" : "Fwd est.", render: (id) => fmtPctPlain(expectedReturn(fundById(id)!), 1) },
    { k: zh ? "成立" : "Launch", render: (id) => fundById(id)!.launch ?? "—" },
  ];

  return (
    <>
      <Card className="mb-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 12, fill: "var(--color-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-subtle)" }} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              {funds.map((f, i) => (
                <Bar key={f.id} dataKey={f.id} name={zh ? f.nameZh : f.nameEn} fill={colors[i % colors.length]} radius={4} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="overflow-x-auto rounded-xl bg-card text-fg ring-1 ring-white/15 shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-3 text-left text-muted" />
              {funds.map((f) => (
                <th key={f.id} className="px-3 py-3 text-left align-bottom">
                  <Link to="/funds/$id" params={{ id: f.id }} className="font-medium hover:underline">
                    {zh ? f.nameZh : f.nameEn}
                  </Link>
                  <button type="button" className="mt-1 block text-xs text-subtle" onClick={() => toggle(f.id)}>
                    {zh ? "移出" : "Remove"}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-2 text-muted">{r.k}</td>
                {funds.map((f) => (
                  <td key={f.id} className="px-3 py-2">
                    {r.render(f.id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
