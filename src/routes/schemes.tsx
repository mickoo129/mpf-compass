import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { ReturnCell } from "@/components/funds/return-cell";
import { allFunds, uniqueSchemes } from "@/lib/mpf/catalog";
import { fmtAum, fmtNum } from "@/lib/mpf/format";
import { useAppStore } from "@/lib/store";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/schemes")({
  head: () => ({
    meta: seo({ title: "24 個強積金計劃", description: "全港註冊強積金計劃的回報、平均收費和基金數目。", path: "/schemes" }),
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
      // 每個計劃都有核心累積基金，投資方向同收費上限一樣，所以用佢比較計劃最公平；
      // 成個計劃嘅回報中位數會受股票／債券基金比例影響，唔適合拎嚟比。
      caf: funds.filter((f) => f.isCaf).sort((a, b) => (a.fer ?? 9) - (b.fer ?? 9))[0] ?? null,
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
            ? "按計劃名查看該計劃有甚麼基金；按「智選」就只在那個計劃內計參考配置。回報用各計劃的核心累積基金比較：每個計劃都有、投資方向和收費上限一樣，比較最公平。"
            : "Tap a scheme to see its constituent funds in the library. Use Recommend to score only within that scheme."
        }
      />
      <AsOfLine zh={zh} />
      <div className="mb-4 hidden overflow-x-auto rounded-xl bg-card text-fg shadow-[var(--shadow-border)] lg:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-3 text-left font-medium">{zh ? "計劃" : "Scheme"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "資產" : "AUM"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "基金數" : "Funds"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "平均開支" : "Avg FER"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? "最低開支" : "Min FER"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? <>核心累積<br />開支</> : "CAF FER"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? <>核心累積<br />1年</> : "CAF 1Y"}</th>
              <th className="px-3 py-3 text-right font-medium">{zh ? <>核心累積<br />5年</> : "CAF 5Y"}</th>
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
                <td className="px-3 py-2.5 text-right font-num tabular-nums">{s.caf?.fer != null ? `${s.caf.fer.toFixed(2)}%` : "—"}</td>
                <td className="px-3 py-2.5 text-right"><ReturnCell value={s.caf?.ret1y ?? null} /></td>
                <td className="px-3 py-2.5 text-right"><ReturnCell value={s.caf?.ret5y ?? null} /></td>
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
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card text-fg shadow-[var(--shadow-border)] lg:hidden">
        {schemes.map((s) => (
          <li key={s.en} className="flex items-center gap-3 px-3 py-2.5">
            <Link to="/funds" search={{ scheme: s.en }} className="min-w-0 flex-1 active:opacity-70">
              <span className="block text-sm leading-snug font-medium">{zh ? s.zh : s.en}</span>
              <span className="block text-xs text-subtle">
                {s.count} {zh ? "隻基金" : "funds"} · {zh ? "平均開支" : "avg FER"} {s.ferAvg.toFixed(2)}% · {fmtAum(s.aum, zh)}
              </span>
            </Link>
            <span className="shrink-0 text-right font-mono text-sm">
              <ReturnCell value={s.caf?.ret5y ?? null} />
              <span className="block text-xs whitespace-nowrap text-subtle">{zh ? "核心累積 5年" : "CAF 5Y"}</span>
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
