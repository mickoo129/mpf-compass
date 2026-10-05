import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { ReturnCell } from "@/components/funds/return-cell";
import { allFunds, median, uniqueSchemes } from "@/lib/mpf/catalog";
import { fmtAum, fmtNum } from "@/lib/mpf/format";
import { calendar3yAnn } from "@/lib/mpf/returns";
import { useAppStore } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/schemes")({
  head: () => ({
    meta: seo({ title: "24 個強積金計劃", description: "全港註冊強積金計劃嘅回報、平均收費同基金數目。", path: "/schemes" }),
  }),
  component: SchemesPage,
});

function SchemesPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const setProfile = useAppStore((s) => s.setProfile);
  const navigate = useNavigate();
  const schemes = uniqueSchemes().map((s) => {
    const funds = allFunds.filter((f) => f.schemeEn === s.en);
    return {
      ...s,
      ret1y: median(funds.map((f) => f.ret1y ?? NaN)),
      ret3y: median(funds.map((f) => calendar3yAnn(f) ?? NaN)),
      ret5y: median(funds.map((f) => f.ret5y ?? NaN)),
      ret10y: median(funds.map((f) => f.ret10y ?? NaN)),
      minFer: Math.min(...funds.map((f) => f.fer ?? 9)),
      hasDis: funds.some((f) => f.isDis),
      tracker: funds.filter((f) => f.isTracker).length,
    };
  });

  function openFunds(schemeEn: string) {
    void navigate({ to: "/funds", search: { scheme: schemeEn } });
  }

  return (
    <div>
      <PageTitle
        title={zh ? "24 個註冊計劃" : "24 registered schemes"}
        subtitle={
          zh
            ? "按計劃可查看其成分基金（與基金庫相同篩選）。想只喺該計劃內篩選參考配置，可以用「智選」。"
            : "Tap a scheme to see its constituent funds in the library. Use Recommend to score only within that scheme."
        }
      />
      <AsOfLine zh={zh} />
      <div className="mb-4 hidden overflow-x-auto border border-border border-t-2 border-t-ink bg-card text-fg md:block">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-3 text-left font-medium">{zh ? "計劃" : "Scheme"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "資產" : "AUM"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "基金數" : "Funds"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "平均開支" : "Avg FER"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "最低開支" : "Min FER"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "1年" : "1Y"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "3年" : "3Y"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "5年" : "5Y"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "10年" : "10Y"}</th>
              <th className="px-3 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {schemes.map((s) => (
              <tr
                key={s.en}
                className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-tint-sky"
                onClick={() => openFunds(s.en)}
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-primary">{zh ? s.zh : s.en}</p>
                  <p className="text-xs text-subtle">
                    {zh ? s.providerZh : s.providerEn}
                    {s.hasDis ? " · DIS" : ""}
                    {s.tracker ? (zh ? ` · ${s.tracker} 隻指數基金` : ` · ${s.tracker} idx`) : ""}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{fmtAum(s.aum, zh)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.count}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.ferAvg.toFixed(2)}%</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.minFer.toFixed(2)}%</td>
                <td className="px-3 py-2.5 text-right"><ReturnCell value={s.ret1y} /></td>
                <td className="px-3 py-2.5 text-right"><ReturnCell value={s.ret3y} /></td>
                <td className="px-3 py-2.5 text-right"><ReturnCell value={s.ret5y} /></td>
                <td className="px-3 py-2.5 text-right"><ReturnCell value={s.ret10y} /></td>
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <Link
                    to="/recommend"
                    search={{ scheme: s.en }}
                    className="text-xs text-muted underline-offset-2 hover:text-primary hover:underline"
                    onClick={() => setProfile({ account: "contribution", schemeEn: s.en })}
                  >
                    {zh ? "智選" : "Recommend"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border overflow-hidden border border-border border-t-2 border-t-ink bg-card text-fg md:hidden">
        {schemes.map((s) => (
          <li key={s.en} className="flex items-center gap-3 px-3 py-2.5">
            <Link to="/funds" search={{ scheme: s.en }} className="min-w-0 flex-1 active:opacity-70">
              <span className="block text-sm leading-snug font-medium">{zh ? s.zh : s.en}</span>
              <span className="block text-xs text-subtle">
                {s.count} {zh ? "隻基金" : "funds"} · {zh ? "平均開支" : "avg FER"} {s.ferAvg.toFixed(2)}% · {fmtAum(s.aum, zh)}
              </span>
            </Link>
            <span className="shrink-0 text-right font-mono text-sm">
              <ReturnCell value={s.ret5y} />
              <span className="block text-xs text-subtle">{zh ? "5年中位" : "5Y med."}</span>
            </span>
            <Link
              to="/recommend"
              search={{ scheme: s.en }}
              onClick={() => setProfile({ account: "contribution", schemeEn: s.en })}
              className="shrink-0 rounded-md px-2 py-1.5 text-xs text-primary ring-1 ring-border"
            >
              {zh ? "智選" : "Mix"}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-canvas-muted">
        {zh
          ? `制度合計約 ${fmtAum(schemes.reduce((a, s) => a + s.aum, 0))}（成分基金淨值，${fmtNum(schemes.reduce((a, s) => a + s.count, 0), 0)} 個基金單位）。`
          : "AUM is the sum of constituent-fund NAV on the MPFA platform."}
      </p>
    </div>
  );
}
