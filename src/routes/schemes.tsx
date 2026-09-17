import { createFileRoute, Link } from "@tanstack/react-router";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { allFunds, median, uniqueSchemes } from "@/lib/mpf/catalog";
import { fmtAum, fmtNum, fmtPctPlain } from "@/lib/mpf/format";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/schemes")({ component: SchemesPage });

function SchemesPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const setProfile = useAppStore((s) => s.setProfile);
  const schemes = uniqueSchemes().map((s) => {
    const funds = allFunds.filter((f) => f.schemeEn === s.en);
    return {
      ...s,
      ret1y: median(funds.map((f) => f.ret1y ?? NaN)),
      ret5y: median(funds.map((f) => f.ret5y ?? NaN)),
      minFer: Math.min(...funds.map((f) => f.fer ?? 9)),
      hasDis: funds.some((f) => f.isDis),
      tracker: funds.filter((f) => f.isTracker).length,
    };
  });

  return (
    <div>
      <PageTitle
        title={zh ? "24 個註冊計劃" : "24 registered schemes"}
        subtitle={
          zh
            ? "睇計劃規模、收費同中位回報。撳「用此計劃推介」會把計劃帶去智選，只喺該計劃可轉換範圍內排序。"
            : "Size, fees and median returns. “Recommend in scheme” locks the wizard to that scheme’s menu."
        }
      />
      <AsOfLine zh={zh} />
      <div className="mb-4 hidden overflow-x-auto rounded-xl bg-card text-fg shadow-[var(--shadow-border)] md:block">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-3 text-left font-medium">{zh ? "計劃" : "Scheme"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "資產" : "AUM"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "基金數" : "Funds"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "平均開支" : "Avg FER"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "最低開支" : "Min FER"}</th>
              <th className="px-3 py-3 text-right font-medium">1Y med</th>
              <th className="px-3 py-3 text-right font-medium">5Y med</th>
              <th className="px-3 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {schemes.map((s) => (
              <tr key={s.en} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{zh ? s.zh : s.en}</p>
                  <p className="text-xs text-subtle">
                    {zh ? s.providerZh : s.providerEn}
                    {s.hasDis ? " · DIS" : ""}
                    {s.tracker ? ` · ${s.tracker} idx` : ""}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{fmtAum(s.aum)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.count}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.ferAvg.toFixed(2)}%</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.minFer.toFixed(2)}%</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtPctPlain(s.ret1y)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fmtPctPlain(s.ret5y)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Link
                      to="/recommend"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setProfile({ account: "contribution", schemeEn: s.en })}
                    >
                      {zh ? "用此計劃推介" : "Recommend in scheme"}
                    </Link>
                    <Link
                      to="/funds"
                      search={{ scheme: s.en }}
                      className="text-[11px] text-subtle hover:text-fg"
                    >
                      {zh ? "到基金庫篩選" : "Browse funds"}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {schemes.map((s) => (
          <Card key={s.en} className="p-4">
            <p className="font-medium">{zh ? s.zh : s.en}</p>
            <p className="text-xs text-subtle">{zh ? s.providerZh : s.providerEn}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
              <span>{fmtAum(s.aum)}</span>
              <span>{zh ? "開支" : "FER"} {s.ferAvg.toFixed(2)}%</span>
              <span>{s.count} funds</span>
            </div>
            <Link
              to="/recommend"
              className="mt-2 inline-block text-xs text-primary"
              onClick={() => setProfile({ account: "contribution", schemeEn: s.en })}
            >
              {zh ? "用此計劃推介" : "Recommend in scheme"}
            </Link>
            <Link to="/funds" search={{ scheme: s.en }} className="mt-1 ml-3 inline-block text-[11px] text-subtle">
              {zh ? "到基金庫" : "Browse funds"}
            </Link>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-canvas-muted">
        {zh
          ? `制度合計約 ${fmtAum(schemes.reduce((a, s) => a + s.aum, 0))}（成分基金淨值，${fmtNum(schemes.reduce((a, s) => a + s.count, 0), 0)} 個基金單位）。`
          : "AUM is the sum of constituent-fund NAV on the MPFA platform."}
      </p>
    </div>
  );
}
