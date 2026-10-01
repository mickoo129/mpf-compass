import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageTitle } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReturnCell } from "@/components/funds/return-cell";
import { TAG_ZH, allFunds, fundById, peerRank, peerRankBy, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtAum, fmtPct, fmtPctPlain } from "@/lib/mpf/format";
import { estimateTodayMove } from "@/lib/mpf/forecast";
import { RangeCard } from "@/components/funds/range-card";
import { Term } from "@/components/ui/term";
import { describeFund } from "@/lib/mpf/describe";
import { seo } from "@/lib/seo";
import { FeeAmount, FeeCard } from "@/components/funds/fee-card";
import { annReturn, calendar3yAnn, cumReturn, MPFA_PERIOD_NOTE, PERIOD_LABEL } from "@/lib/mpf/returns";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/funds/$id")({
  head: ({ params }) => {
    const f = fundById(params.id);
    if (!f) return { meta: seo({ title: "找不到基金", description: "請返回基金庫再搜尋。" }) };
    const bits = [
      f.ret5y != null ? `5年年化 ${f.ret5y > 0 ? "+" : ""}${f.ret5y.toFixed(1)}%` : null,
      f.fer != null ? `開支比率 ${f.fer.toFixed(2)}%` : null,
      f.riskClass != null ? `風險 ${f.riskClass}` : null,
    ].filter(Boolean);
    return {
      meta: seo({
        title: `${f.nameZh}（${f.schemeZh}）`,
        description: `${bits.join(" · ")}。${describeFund(f, true)}`,
        path: `/funds/${f.id}`,
      }),
    };
  },
  component: FundDetail,
});

function FundDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fund = fundById(id);
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const toggle = useAppStore((s) => s.toggleCompare);
  const compared = useAppStore((s) => s.compareIds.includes(id));
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => getMarkets() });
  const [peerPeriod, setPeerPeriod] = useState<"ret1y" | "ret3yCal" | "ret5y" | "ret10y" | "retSince">("ret5y");

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
      <label className="mb-1 block text-xs text-canvas-muted">{zh ? "同計劃其他基金" : "Other funds in this scheme"}</label>
      <select
        className="mb-4 h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
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
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90">{describeFund(fund, zh)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="primary">{SLEEVE_LABEL[fund.sleeve]?.[zh ? "zh" : "en"] ?? fund.sleeve}</Badge>
            {fund.tags.filter((t) => t !== "DIS").map((t) => (
              <Badge key={t}>{zh ? (TAG_ZH[t] ?? t) : t}</Badge>
            ))}
            {fund.isDis ? <Badge tone="primary">{zh ? "預設投資策略" : "DIS"}</Badge> : null}
          </div>
        </div>
        <Button variant={compared ? "default" : "outline"} onClick={() => toggle(fund.id)}>
          {compared ? (zh ? "已加入比較" : "In compare") : zh ? "加入比較" : "Compare"}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label={<Term k="annualised">{zh ? "1年年化" : "1Y p.a."}</Term>} value={<ReturnCell value={fund.ret1y} className="text-xl" />} />
        <Metric label={zh ? "5年年化" : "5Y p.a."} value={<ReturnCell value={fund.ret5y} className="text-xl" />} />
        <Metric label={zh ? "10年年化" : "10Y p.a."} value={<ReturnCell value={fund.ret10y} className="text-xl" />} />
        <Metric
          label={<Term k="fer" />}
          value={
            <span className="font-mono text-xl tabular-nums">
              {fmtPctPlain(fund.fer)}
              <FeeAmount fer={fund.fer} zh={zh} className="block text-xs text-muted" />
            </span>
          }
        />
      </div>

      <Card className="mb-8">
        <h2 className="mb-1 font-display text-lg">{zh ? "回報時段" : "Return periods"}</h2>
        <p className="mb-3 text-xs text-subtle">{zh ? MPFA_PERIOD_NOTE.zh : MPFA_PERIOD_NOTE.en}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-2 text-left font-medium" />
                {periods.map(([p]) => (
                  <th key={p} className="px-1 py-2 text-right font-medium whitespace-nowrap">
                    {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
                    {p === "ret3yCal" ? <span className="block text-xs font-normal text-subtle">{zh ? "推算" : "est."}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/70">
                <td className="py-2 pr-2 text-xs text-muted"><Term k="annualised">{zh ? "年化" : "Ann."}</Term></td>
                {periods.map(([p]) => (
                  <td key={p} className="px-1 py-2 text-right">
                    <ReturnCell value={annReturn(fund, p)} />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/70">
                <td className="py-2 pr-2 text-xs text-muted"><Term k="cumulative">{zh ? "累積" : "Cum."}</Term></td>
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
          <p className="mt-3 text-xs text-subtle">
            {zh
              ? `參考：基準指數今日 ${fmtPct(quote?.changePct)} × 貝塔 ${fund.beta} ≈ ${fmtPct(today)}（非官方 NAV）。`
              : `Ref: benchmark today ${fmtPct(quote?.changePct)} × beta ${fund.beta} ≈ ${fmtPct(today)} (not an official NAV).`}
          </p>
        ) : null}
      </Card>

      <FeeCard fund={fund} zh={zh} className="mb-8" />

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <RangeCard className="lg:col-span-3" items={[{ fund, weight: 1 }]} zh={zh} initialMonths={12} />
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg">{zh ? "檔案" : "Profile"}</h2>
          <dl className="space-y-2 text-sm">
            <Row k={zh ? "計劃" : "Scheme"} v={zh ? fund.schemeZh : fund.schemeEn} />
            <Row k={zh ? "受託人" : "Trustee"} v={zh ? fund.trusteeZh : fund.trusteeEn} />
            <Row k={<Term k="risk" />} v={fund.riskClass != null ? String(fund.riskClass) : "—"} />
            <Row k={<Term k="aum" />} v={fmtAum(fund.aumM)} />
            <Row k={zh ? "成立" : "Launch"} v={fund.launch ?? "—"} />
            <Row k={zh ? "10年年化" : "10Y p.a."} v={fmtPct(fund.ret10y)} />
            <Row k={zh ? "成立至今" : "Since launch"} v={fmtPct(fund.retSince)} />
            <Row k={zh ? "管理費" : "Mgmt fee"} v={fmtFee(fund.mgmtFee, zh)} />
            <Row k={zh ? "積金易平台費" : "eMPF fee"} v={fund.empfFee != null ? `${fund.empfFee}%` : "—"} />
            <Row k={zh ? "同類收費" : "Peer FER"} v={rankF ? `${rankF.rank} / ${rankF.total}` : "—"} />
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-lg">{zh ? "日曆年回報" : "Calendar years"}</h2>
          <div className="grid grid-cols-5 gap-2">
            {calendar.map(([y, v]) => (
              <div key={y} className="rounded-lg bg-white px-1 py-2 text-center ring-1 ring-border">
                <p className="font-mono text-xs text-subtle">{y}</p>
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
          <p className="mb-2 text-xs text-subtle">
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
                  className={`flex items-start justify-between gap-3 rounded-md px-1 ${p.id === fund.id ? "bg-tint-sky" : ""}`}
                >
                  <span className="flex min-w-0 gap-2">
                    <span className="font-mono text-subtle">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block">{zh ? p.nameZh : p.nameEn}</span>
                      <span className="block text-xs text-subtle">{zh ? p.schemeZh : p.schemeEn}</span>
                    </span>
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

function Metric({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-subtle">{label}</p>
      <div className="mt-1">{value}</div>
    </Card>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

/** MPFA fee strings look like "Up to 0.528" or "0.14"; show them as percentages. */
function fmtFee(raw: string | null | undefined, zh: boolean): string {
  if (!raw) return "—";
  const upTo = /^up to\s*/i.test(raw);
  const body = raw.replace(/^up to\s*/i, "").trim();
  const withPct = /^[\d.]+$/.test(body) ? `${body}%` : body;
  return upTo ? (zh ? `最高 ${withPct}` : `Up to ${withPct}`) : withPct;
}
