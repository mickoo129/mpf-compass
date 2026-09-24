import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { estimateTodayMove, projectFund, volOf } from "@/lib/mpf/forecast";
import { annReturn, calendar3yAnn, cumReturn, MPFA_PERIOD_NOTE, PERIOD_LABEL } from "@/lib/mpf/returns";
import { expectedReturn } from "@/lib/mpf/score";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/funds/$id")({ component: FundDetail });

function FundDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
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
  const [horizon, setHorizon] = useState<3 | 5 | 10 | 15 | 20>(10);
  const [peerPeriod, setPeerPeriod] = useState<"ret1y" | "ret3yCal" | "ret5y" | "ret10y" | "retSince">("ret5y");
  const path = projectFund(fund, horizon, 10000);
  const mu = expectedReturn(fund);
  const vol = volOf(fund);
  const bullPa = mu + 0.7 * vol;
  const bearPa = Math.max(-25, mu - 1.05 * vol);
  const rank1 = peerRank(fund, "ret1y");
  const rank5 = peerRank(fund, "ret5y");
  const rank10 = peerRank(fund, "ret10y");
  const rankSince = peerRank(fund, "retSince");
  const rank3 = peerRankBy(fund, calendar3yAnn);
  const rankF = peerRank(fund, "fer");
  const peers = allFunds
    .filter((f) => f.sleeve === fund.sleeve && annReturn(f, peerPeriod) != null)
    .sort((a, b) => (annReturn(b, peerPeriod) ?? 0) - (annReturn(a, peerPeriod) ?? 0))
    .slice(0, 5);
  const calendar = [
    ["2025", fund.y2025],
    ["2024", fund.y2024],
    ["2023", fund.y2023],
    ["2022", fund.y2022],
    ["2021", fund.y2021],
  ] as const;
  const periods = [
    ["ret1y", rank1],
    ["ret3yCal", rank3],
    ["ret5y", rank5],
    ["ret10y", rank10],
    ["retSince", rankSince],
  ] as const;
  const siblings = allFunds
    .filter((f) => f.schemeEn === fund.schemeEn)
    .sort((a, b) => (zh ? a.nameZh.localeCompare(b.nameZh, "zh-HK") : a.nameEn.localeCompare(b.nameEn)));

  return (
    <div>
      <p className="mb-2 text-xs text-canvas-muted">
        <Link to="/funds" className="hover:text-white">
          {zh ? "基金庫" : "Funds"}
        </Link>
        <span className="mx-1">/</span>
        <Link to="/funds" search={{ scheme: fund.schemeEn }} className="hover:text-white">
          {zh ? fund.schemeZh : fund.schemeEn}
        </Link>
      </p>
      <label className="mb-1 block text-[11px] text-canvas-muted">{zh ? "同計劃其他基金" : "Other funds in this scheme"}</label>
      <select
        className="mb-4 h-11 w-full rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
        value={fund.id}
        onChange={(e) => {
          if (e.target.value && e.target.value !== fund.id) void navigate({ to: "/funds/$id", params: { id: e.target.value } });
        }}
      >
        {siblings.map((f) => (
          <option key={f.id} value={f.id}>
            {zh ? f.nameZh : f.nameEn}
          </option>
        ))}
      </select>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{zh ? fund.nameZh : fund.nameEn}</h1>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-2 text-left font-medium" />
                {periods.map(([p]) => (
                  <th key={p} className="px-1 py-2 text-right font-medium whitespace-nowrap">
                    {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
                    {p === "ret3yCal" ? <span className="block text-[10px] font-normal text-subtle">{zh ? "推算" : "est."}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/70">
                <td className="py-2 pr-2 text-xs text-muted">{zh ? "年化" : "Ann."}</td>
                {periods.map(([p]) => (
                  <td key={p} className="px-1 py-2 text-right">
                    <ReturnCell value={annReturn(fund, p)} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/70">
                <td className="py-2 pr-2 text-xs text-muted">{zh ? "累積" : "Cum."}</td>
                {periods.map(([p]) => (
                  <td key={p} className="px-1 py-2 text-right">
                    <ReturnCell value={cumReturn(fund, p)} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-2 text-xs text-muted">{zh ? "同類" : "Peer"}</td>
                {periods.map(([p, rank]) => (
                  <td key={p} className="px-1 py-2 text-right font-mono text-xs text-muted">
                    {rank ? `${rank.rank}/${rank.total}` : "—"}
                  </td>
                ))}
              </tr>
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
          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display text-lg">{zh ? `${horizon} 年情景（每 1 萬港元）` : `${horizon}-year path (per HK$10,000)`}</h2>
            <div className="flex gap-1">
              {([3, 5, 10, 15, 20] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHorizon(n)}
                  className={`h-8 rounded-md px-2.5 text-xs ${horizon === n ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border"}`}
                >
                  {n}
                  {zh ? "年" : "Y"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 h-56">
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
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{zh ? `${horizon}年基本` : `${horizon}Y base`} {fmtHkd(path.at(-1)?.base ?? 0)}</span>
            <span className="text-up">{zh ? "牛" : "Bull"} {fmtHkd(path.at(-1)?.bull ?? 0)}</span>
            <span className="text-down">{zh ? "熊" : "Bear"} {fmtHkd(path.at(-1)?.bear ?? 0)}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-subtle">
            {zh
              ? `基本約 ${mu.toFixed(1)}% 年化。類別長期假設（例如美股約 7%）佔 55%，這隻基金的五年回報（上限 12%）佔 45%，再扣高於 0.8% 的開支。五年回報同風險級別來自積金局；類別長期假設不是積金局數字，只是本工具的規劃假設。牛市每年約 ${bullPa.toFixed(1)}%、熊市每年約 ${bearPa.toFixed(1)}%，只按風險級別 ${fund.riskClass ?? "—"} 加闊，不是歷史牛熊，亦非承諾。`
              : `Base ~${mu.toFixed(1)}% p.a.: 55% sleeve planning prior, 45% capped 5Y (MPFA), minus extra fees. The prior is not an MPFA figure. Bull ~${bullPa.toFixed(1)}% and bear ~${bearPa.toFixed(1)}% widen by risk class ${fund.riskClass ?? "—"}, not historical bull/bear markets.`}
          </p>
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
          <div className="grid grid-cols-5 gap-2">
            {calendar.map(([y, v]) => (
              <div key={y} className="rounded-lg bg-white px-1 py-2 text-center ring-1 ring-border">
                <p className="font-mono text-[11px] text-subtle">{y}</p>
                <ReturnCell value={v} className="mt-1 block text-sm" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg">{zh ? "同類領先" : "Sleeve leaders"}</h2>
            <div className="flex flex-wrap gap-1">
              {(["ret1y", "ret3yCal", "ret5y", "ret10y", "retSince"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeerPeriod(p)}
                  className={`h-8 rounded-md px-2 text-xs ${peerPeriod === p ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border"}`}
                >
                  {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-2 text-[11px] text-subtle">
            {zh
              ? `按${PERIOD_LABEL[peerPeriod].zh}年化取頭五名。換年期會換一批基金。`
              : `Top five by ${PERIOD_LABEL[peerPeriod].en}. Changing the period changes the names.`}
          </p>
          <ol className="space-y-2 text-sm">
            {peers.map((p, i) => (
              <li key={p.id}>
                <Link
                  to="/funds/$id"
                  params={{ id: p.id }}
                  className={`flex items-baseline justify-between gap-3 rounded-md px-1 ${p.id === fund.id ? "bg-tint-sky" : ""}`}
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2 font-mono text-subtle">{i + 1}</span>
                    {zh ? p.nameZh : p.nameEn}
                  </span>
                  <ReturnCell value={annReturn(p, peerPeriod)} />
                </Link>
              </li>
            ))}
          </ol>
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
