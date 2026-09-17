import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageTitle } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReturnCell } from "@/components/funds/return-cell";
import { allFunds, fundById, peerRank, peerRankBy, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtAum, fmtHkd, fmtPct, fmtPctPlain } from "@/lib/mpf/format";
import { estimateTodayMove, projectFund } from "@/lib/mpf/forecast";
import { annReturn, calendar3yAnn, cumReturn, MPFA_PERIOD_NOTE, PERIOD_LABEL } from "@/lib/mpf/returns";
import { expectedReturn } from "@/lib/mpf/score";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/funds/$id")({ component: FundDetail });

function FundDetail() {
  const { id } = Route.useParams();
  const fund = fundById(id);
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const toggle = useAppStore((s) => s.toggleCompare);
  const compared = useAppStore((s) => s.compareIds.includes(id));
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => getMarkets() });

  if (!fund) {
    return (
      <div>
        <PageTitle title={zh ? "找不到基金" : "Fund not found"} />
        <Link to="/funds" className="text-sm text-primary underline">
          {zh ? "返回基金庫" : "Back to universe"}
        </Link>
      </div>
    );
  }

  const quote = markets.data?.quotes.find((q) => q.symbol === fund.bench);
  const today = estimateTodayMove(quote?.changePct ?? null, fund.beta);
  const path = projectFund(fund, 10, 10000);
  const rank1 = peerRank(fund, "ret1y");
  const rank5 = peerRank(fund, "ret5y");
  const rank10 = peerRank(fund, "ret10y");
  const rankSince = peerRank(fund, "retSince");
  const rank3 = peerRankBy(fund, calendar3yAnn);
  const rankF = peerRank(fund, "fer");
  const peers = allFunds
    .filter((f) => f.sleeve === fund.sleeve && f.id !== fund.id && f.ret5y != null)
    .sort((a, b) => (b.ret5y ?? 0) - (a.ret5y ?? 0))
    .slice(0, 5);
  const calendar = [
    ["2025", fund.y2025],
    ["2024", fund.y2024],
    ["2023", fund.y2023],
    ["2022", fund.y2022],
    ["2021", fund.y2021],
  ] as const;

  return (
    <div>
      <p className="mb-2 text-xs text-canvas-muted">
        <Link to="/funds" className="hover:text-white">
          {zh ? "基金庫" : "Funds"}
        </Link>
        <span className="mx-1">/</span>
        {zh ? fund.schemeZh : fund.schemeEn}
      </p>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-white">{zh ? fund.nameZh : fund.nameEn}</h1>
          <p className="mt-1 text-sm text-canvas-muted">
            {zh ? fund.nameEn : fund.nameZh} · {zh ? fund.providerZh : fund.providerEn}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="primary">{SLEEVE_LABEL[fund.sleeve]?.[zh ? "zh" : "en"] ?? fund.sleeve}</Badge>
            {fund.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
            {fund.isDis ? <Badge tone="primary">DIS</Badge> : null}
          </div>
        </div>
        <Button variant={compared ? "default" : "outline"} onClick={() => toggle(fund.id)}>
          {compared ? (zh ? "已加入比較" : "In compare") : zh ? "加入比較" : "Compare"}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label={zh ? "1年年化" : "1Y p.a."} value={<ReturnCell value={fund.ret1y} className="text-xl" />} />
        <Metric label={zh ? "5年年化" : "5Y p.a."} value={<ReturnCell value={fund.ret5y} className="text-xl" />} />
        <Metric label={zh ? "10年年化" : "10Y p.a."} value={<ReturnCell value={fund.ret10y} className="text-xl" />} />
        <Metric label={zh ? "開支比率 FER" : "FER"} value={<span className="font-mono text-xl tabular-nums">{fmtPctPlain(fund.fer)}</span>} />
      </div>

      <Card className="mb-8">
        <h2 className="mb-1 font-display text-lg">{zh ? "回報時段" : "Return periods"}</h2>
        <p className="mb-3 text-[11px] text-subtle">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3 text-left font-medium">{zh ? "時段" : "Period"}</th>
                <th className="py-2 pr-3 text-right font-medium">{zh ? "年化" : "Ann."}</th>
                <th className="py-2 pr-3 text-right font-medium">{zh ? "累積" : "Cum."}</th>
                <th className="py-2 text-right font-medium">{zh ? "同類年化" : "Peer"}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["ret1y", rank1],
                  ["ret3yCal", rank3],
                  ["ret5y", rank5],
                  ["ret10y", rank10],
                  ["retSince", rankSince],
                ] as const
              ).map(([p, rank]) => (
                <tr key={p} className="border-b border-border/70 last:border-0">
                  <td className="py-2 pr-3">
                    {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
                    {p === "ret3yCal" ? (
                      <span className="ml-1 text-[11px] text-subtle">{zh ? "（推算）" : "(derived)"}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <ReturnCell value={annReturn(fund, p)} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <ReturnCell value={cumReturn(fund, p)} />
                  </td>
                  <td className="py-2 text-right font-mono text-xs text-muted">{rank ? `${rank.rank} / ${rank.total}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {today != null ? (
          <p className="mt-3 text-[11px] text-subtle">
            {zh
              ? `參考：基準指數今日 ${fmtPct(quote?.changePct)} × 貝塔 ${fund.beta} ≈ ${fmtPct(today)}（非官方 NAV）。`
              : `Ref: benchmark today ${fmtPct(quote?.changePct)} × beta ${fund.beta} ≈ ${fmtPct(today)} (not an official NAV).`}
          </p>
        ) : null}
      </Card>

      <div className="mb-8 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-1 font-display text-lg">{zh ? "十年情景（每 1 萬港元）" : "10-year path (per HK$10,000)"}</h2>
          <p className="mb-4 text-xs text-subtle">
            {zh
              ? `預期年化約 ${expectedReturn(fund).toFixed(1)}%。牛／熊為波動加減，並非預測承諾。`
              : `Base ~${expectedReturn(fund).toFixed(1)}% p.a. Bull/bear are vol bands, not promises.`}
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={path} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--color-subtle)" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  width={40}
                />
                <RTooltip
                  formatter={(v: number) => fmtHkd(v)}
                  labelFormatter={(y) => (zh ? `第 ${y} 年` : `Year ${y}`)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="bull" stroke="var(--color-up)" fill="var(--color-up)" fillOpacity={0.08} />
                <Area type="monotone" dataKey="base" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} />
                <Area type="monotone" dataKey="bear" stroke="var(--color-down)" fill="var(--color-down)" fillOpacity={0.06} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted">
            <span>{zh ? "十年基本" : "10Y base"} {fmtHkd(path.at(-1)?.base ?? 0)}</span>
            <span className="text-up">{zh ? "牛" : "Bull"} {fmtHkd(path.at(-1)?.bull ?? 0)}</span>
            <span className="text-down">{zh ? "熊" : "Bear"} {fmtHkd(path.at(-1)?.bear ?? 0)}</span>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg">{zh ? "檔案" : "Profile"}</h2>
          <dl className="space-y-2 text-sm">
            <Row k={zh ? "計劃" : "Scheme"} v={zh ? fund.schemeZh : fund.schemeEn} />
            <Row k={zh ? "受託人" : "Trustee"} v={zh ? fund.trusteeZh : fund.trusteeEn} />
            <Row k={zh ? "風險級別" : "Risk class"} v={fund.riskClass != null ? String(fund.riskClass) : "—"} />
            <Row k={zh ? "基金規模" : "Fund size"} v={fmtAum(fund.aumM)} />
            <Row k={zh ? "成立" : "Launch"} v={fund.launch ?? "—"} />
            <Row k="10Y p.a." v={fmtPct(fund.ret10y)} />
            <Row k={zh ? "成立至今" : "Since launch"} v={fmtPct(fund.retSince)} />
            <Row k={zh ? "管理費" : "Mgmt fee"} v={fund.mgmtFee} />
            <Row k={zh ? "積金易平台費" : "eMPF fee"} v={fund.empfFee != null ? `${fund.empfFee}%` : "—"} />
            <Row k={zh ? "同類收費" : "Peer FER"} v={rankF ? `${rankF.rank} / ${rankF.total}` : "—"} />
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-lg">{zh ? "日曆年回報" : "Calendar years"}</h2>
          <div className="space-y-2">
            {calendar.map(([y, v]) => (
              <div key={y} className="flex items-center gap-3 text-sm">
                <span className="w-12 font-mono text-muted">{y}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-warm">
                  <div
                    className={v != null && v >= 0 ? "h-full bg-up" : "h-full bg-down"}
                    style={{ width: `${Math.min(100, Math.abs(v ?? 0) * 2)}%` }}
                  />
                </div>
                <ReturnCell value={v} className="w-20 text-right" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-lg">{zh ? "同類五年領先" : "Sleeve 5Y leaders"}</h2>
          <ul className="space-y-2 text-sm">
            {peers.map((p) => (
              <li key={p.id}>
                <Link to="/funds/$id" params={{ id: p.id }} className="flex justify-between gap-3">
                  <span className="truncate">{zh ? p.nameZh : p.nameEn}</span>
                  <ReturnCell value={p.ret5y} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-subtle">{label}</p>
      <div className="mt-1">{value}</div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
