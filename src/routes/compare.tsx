import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReturnCell } from "@/components/funds/return-cell";
import { fundById, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtAum, fmtPctPlain } from "@/lib/mpf/format";
import { calendar3yAnn, MPFA_PERIOD_NOTE } from "@/lib/mpf/returns";
import { expectedReturn } from "@/lib/mpf/score";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/compare")({ component: ComparePage });

function ComparePage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const ids = useAppStore((s) => s.compareIds);
  const toggle = useAppStore((s) => s.toggleCompare);
  const clear = useAppStore((s) => s.clearCompare);
  const funds = ids.map(fundById).filter((f): f is NonNullable<typeof f> => !!f);

  if (!funds.length) {
    return (
      <div>
        <PageTitle
          title={zh ? "比較籃是空的" : "Nothing to compare"}
          subtitle={zh ? "在基金庫點「比較」，最多四隻並排。" : "Pin up to four funds from the universe."}
        />
        <Button asChild>
          <Link to="/funds">{zh ? "前往基金庫" : "Open universe"}</Link>
        </Button>
      </div>
    );
  }

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
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <PageTitle
          title={zh ? "並排比較" : "Side by side"}
          subtitle={zh ? "同一尺度看回報、收費與風險。收費是你唯一可事先鎖定的項目。" : "Same scale for returns, fees and risk. Fee is the only input you fully control."}
        />
        <Button variant="ghost" onClick={clear}>
          {zh ? "清空" : "Clear"}
        </Button>
      </div>

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

      <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
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
      <p className="mt-3 text-[11px] leading-relaxed text-subtle">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
    </div>
  );
}
