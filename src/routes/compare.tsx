import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReturnCell } from "@/components/funds/return-cell";
import { fundById, providerStats, rankFunds, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtAum, fmtPctPlain } from "@/lib/mpf/format";
import { calendar3yAnn, MPFA_PERIOD_NOTE } from "@/lib/mpf/returns";
import { expectedReturn } from "@/lib/mpf/score";
import type { Fund } from "@/lib/mpf/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({ component: ComparePage });

function ComparePage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const ids = useAppStore((s) => s.compareIds);
  const toggle = useAppStore((s) => s.toggleCompare);
  const clear = useAppStore((s) => s.clearCompare);
  const funds = ids.map(fundById).filter((f): f is NonNullable<typeof f> => !!f);
  const providers = providerStats();
  const best1 = rankFunds("ret1y", "best");
  const worst1 = rankFunds("ret1y", "worst");
  const best5 = rankFunds("ret5y", "best");
  const worst5 = rankFunds("ret5y", "worst");

  return (
    <div>
      <PageTitle
        kicker={zh ? "比較" : "Compare"}
        title={zh ? "先睇全場對照，再自選並排。" : "Start with the field, then pin your own."}
        subtitle={
          zh
            ? "積金局沒有官方半年回報，下表用一年、五年同 2025 曆年。供應商數字為旗下成分基金中位數。自選最多四隻。"
            : "MPFA has no official 6-month return. Boards use 1Y, 5Y and calendar 2025. Provider figures are medians. Pin up to four funds."
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
                <th className="px-3 py-2.5 text-right font-medium">{zh ? "5年" : "5Y"}</th>
                <th className="px-4 py-2.5 text-right font-medium">2025</th>
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
                    <ReturnCell value={p.ret5y} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ReturnCell value={p.y2025} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Board title={zh ? "一年最高" : "Best 1Y"} funds={best1} zh={zh} ids={ids} toggle={toggle} period="ret1y" tone="up" />
        <Board title={zh ? "一年最低" : "Worst 1Y"} funds={worst1} zh={zh} ids={ids} toggle={toggle} period="ret1y" tone="down" />
        <Board title={zh ? "五年最高" : "Best 5Y"} funds={best5} zh={zh} ids={ids} toggle={toggle} period="ret5y" tone="up" />
        <Board title={zh ? "五年最低" : "Worst 5Y"} funds={worst5} zh={zh} ids={ids} toggle={toggle} period="ret5y" tone="down" />
      </div>

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
      <p className="mt-3 text-[11px] leading-relaxed text-subtle">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
    </div>
  );
}

function Board({
  title,
  funds,
  zh,
  ids,
  toggle,
  period,
  tone,
}: {
  title: string;
  funds: Fund[];
  zh: boolean;
  ids: string[];
  toggle: (id: string) => void;
  period: "ret1y" | "ret5y";
  tone: "up" | "down";
}) {
  return (
    <Card className={cn("overflow-hidden p-0", tone === "up" ? "bg-tint-mint/60" : "bg-tint-sand/80")}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-base">{title}</h3>
        <span className={cn("text-[11px] font-medium", tone === "up" ? "text-up" : "text-down")}>
          {zh ? "截至 2026-08-31" : "as of 2026-08-31"}
        </span>
      </div>
      <ol className="divide-y divide-border/80">
        {funds.map((f, i) => {
          const pinned = ids.includes(f.id);
          return (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2">
              <span className="w-5 font-mono text-xs text-subtle">{i + 1}</span>
              <Link to="/funds/$id" params={{ id: f.id }} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{zh ? f.nameZh : f.nameEn}</p>
                <p className="truncate text-[11px] text-subtle">{zh ? f.providerZh : f.providerEn}</p>
              </Link>
              <ReturnCell value={f[period]} />
              <button
                type="button"
                onClick={() => toggle(f.id)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-[11px]",
                  pinned ? "bg-primary text-primary-fg" : "bg-white text-muted ring-1 ring-ink/10",
                )}
              >
                {pinned ? (zh ? "已揀" : "Pinned") : zh ? "比較" : "Pin"}
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
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
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-ink/12 shadow-[var(--shadow-border)]">
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
