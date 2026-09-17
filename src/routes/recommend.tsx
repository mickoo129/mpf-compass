import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ReturnCell } from "@/components/funds/return-cell";
import { catalogMeta, uniqueSchemes } from "@/lib/mpf/catalog";
import { fmtHkd, fmtPctPlain } from "@/lib/mpf/format";
import { projectPortfolio } from "@/lib/mpf/forecast";
import { buildRegime, HORIZON_COPY, HORIZON_OPTS } from "@/lib/mpf/regime";
import { buildAllocation, GOAL_COPY, MIX_SIZE_COPY, MIX_SIZE_OPTS, resolvedMixSize, resolvedReview, REVIEW_COPY, REVIEW_OPTS, RISK_COPY, scoreFunds, targetRisk } from "@/lib/mpf/score";
import type { GoalId, RiskAppetite } from "@/lib/mpf/types";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recommend")({ component: RecommendPage });

const GOALS: GoalId[] = ["growth", "balanced", "preserve", "lowfee", "dis"];
const RISKS: RiskAppetite[] = ["conservative", "moderate", "aggressive"];

function RecommendPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const schemes = uniqueSchemes();
  const horizon = profile.switchHorizon ?? "6m";
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => getMarkets() });
  const regime = useMemo(
    () => buildRegime(markets.data?.quotes ?? [], horizon),
    [markets.data, horizon],
  );
  const ranked = useMemo(() => scoreFunds(profile, regime), [profile, regime]);
  const alloc = useMemo(() => buildAllocation(profile, ranked), [profile, ranked]);
  const years = Math.max(1, profile.retireAge - profile.age);
  const path = useMemo(
    () => projectPortfolio(alloc, years, profile.balance, profile.monthly),
    [alloc, years, profile.balance, profile.monthly],
  );
  const end = path.at(-1);
  const riskT = targetRisk(profile);
  const mixSize = profile.mixSize ?? "auto";
  const reviewEvery = profile.reviewEvery ?? "auto";
  const mixN = resolvedMixSize(profile, ranked.length);
  const review = resolvedReview(profile);
  const [advanced, setAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile.goal === "regime") setProfile({ goal: "balanced" });
  }, [profile.goal, setProfile]);

  function copyMix() {
    const scheme = schemes.find((s) => s.en === profile.schemeEn);
    const lines = [
      zh ? "積金羅盤建議配置（研究用，並非投資建議）" : "MPF Compass mix (research only, not advice)",
      `${zh ? "計劃" : "Scheme"}: ${scheme ? (zh ? scheme.zh : scheme.en) : zh ? "不限" : "unrestricted"}`,
      `${zh ? "基金數字截至" : "Fund figures as of"} ${catalogMeta.asOf}`,
      ...alloc.map(
        (a) =>
          `${Math.round(a.weight * 100)}%  ${zh ? a.fund.nameZh : a.fund.nameEn}  (${zh ? a.fund.schemeZh : a.fund.schemeEn})`,
      ),
    ];
    void navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <PageTitle
        kicker={zh ? "目標推介" : "Goal-based"}
        title={zh ? "先講你要什麼，再在可選範圍內打分。" : "State the goal, then score inside your opportunity set."}
        subtitle={
          zh
            ? "供款帳戶通常只能在僱主計劃內轉換。轉換視野係未來持有期；配置跟展望（利率、52週位置、過熱），唔把過去半年當成未來。並非投資建議，亦不保證獲利。"
            : "Contribution accounts switch inside the employer scheme. The window is forward-looking: yield, 52-week stretch and overheat — not “past 6 months = next 6 months”. Not advice and not a profit guarantee."
        }
      />
      <AsOfLine zh={zh} />

      <Card className="mb-6 bg-tint-sand">
        <h2 className="mb-1 font-display text-lg">{zh ? "策略點來" : "Where the mix comes from"}</h2>
        <p className="mb-3 text-sm text-muted">
          {zh
            ? "呢個唔係積金局或受託人嘅官方部署，亦唔係預測必賺。配置係一條公開規則：用你填嘅目標，加上積金局長線數字，再用最新指數避免追過熱。"
            : "This is not an MPFA or trustee allocation, and not a profit forecast. The mix is a published rule: your goal, MPFA long-horizon figures, then live indices to avoid chasing heat."}
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>{zh ? "你：目標、風險、轉換視野（未來持有幾耐）、僱主計劃可選範圍。" : "You: goal, risk, switch window, and the employer-scheme menu."}</li>
          <li>{zh ? "積金局（截至 2026-08-31）：收費、風險級別、五年同類——決定 qual 唔 qual。" : "MPFA (as of 31 Aug 2026): fees, risk class, 5-year peer standing."}</li>
          <li>{zh ? "Yahoo 指數（打開頁即更新）：利率起始孳息、距離 52 週高位、過熱——用來加減倉，唔把過去半年當成未來。" : "Yahoo indices (refresh on load): starting yield, 52-week stretch, overheat — a tilt, not “past = future”."}</li>
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <h2 className="mb-4 font-display text-lg">{zh ? "你的情況" : "Your situation"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label={zh ? "年齡" : "Age"}>
                <div className="flex items-center gap-3">
                  <Slider min={18} max={64} value={[profile.age]} onValueChange={([v]) => setProfile({ age: v ?? 35 })} />
                  <span className="w-8 font-mono text-sm tabular-nums">{profile.age}</span>
                </div>
              </Field>
              <Field label={zh ? "預計退休年齡" : "Retire age"}>
                <div className="flex items-center gap-3">
                  <Slider
                    min={50}
                    max={70}
                    value={[profile.retireAge]}
                    onValueChange={([v]) => setProfile({ retireAge: v ?? 65 })}
                  />
                  <span className="w-8 font-mono text-sm tabular-nums">{profile.retireAge}</span>
                </div>
              </Field>
              <Field label={zh ? "現有結餘（港元）" : "Balance (HKD)"}>
                <Input
                  type="number"
                  min={0}
                  value={profile.balance}
                  onChange={(e) => setProfile({ balance: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label={zh ? "每月供款" : "Monthly contribution"}>
                <Input
                  type="number"
                  min={0}
                  value={profile.monthly}
                  onChange={(e) => setProfile({ monthly: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Label>{zh ? "帳戶類型" : "Account"}</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Choice
                  active={profile.account === "contribution"}
                  onClick={() => setProfile({ account: "contribution" })}
                  title={zh ? "供款帳戶" : "Contribution"}
                  sub={zh ? "受限於僱主計劃" : "Employer scheme only"}
                />
                <Choice
                  active={profile.account === "personal"}
                  onClick={() => setProfile({ account: "personal", schemeEn: null })}
                  title={zh ? "個人帳戶" : "Personal"}
                  sub={zh ? "可轉往其他計劃" : "Can transfer"}
                />
              </div>
            </div>
            {profile.account === "contribution" ? (
              <div className="mt-4">
                <Label>{zh ? "現時計劃" : "Current scheme"}</Label>
                <select
                  className="mt-2 h-11 w-full rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)]"
                  value={profile.schemeEn ?? ""}
                  onChange={(e) => setProfile({ schemeEn: e.target.value || null })}
                >
                  <option value="">{zh ? "請選擇計劃" : "Select scheme"}</option>
                  {schemes.map((s) => (
                    <option key={s.en} value={s.en}>
                      {zh ? s.zh : s.en}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg">{zh ? "目標" : "Goal"}</h2>
            <div className="grid gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setProfile({ goal: g })}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-left transition-colors",
                    profile.goal === g ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border hover:bg-tint-sky",
                  )}
                >
                  <p className="text-sm font-medium">{zh ? GOAL_COPY[g].zh : GOAL_COPY[g].en}</p>
                  <p className={cn("text-xs", profile.goal === g ? "text-primary-fg/80" : "text-muted")}>
                    {GOAL_COPY[g].blurbZh}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label>{zh ? "風險承受" : "Risk appetite"}</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {RISKS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setProfile({ risk: r })}
                    className={cn(
                      "h-11 rounded-md text-sm",
                      profile.risk === r ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border",
                    )}
                  >
                    {zh ? RISK_COPY[r].zh : RISK_COPY[r].en}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <Label>{zh ? "今次轉換視野" : "Switch window"}</Label>
              <p className="mt-1 text-[11px] text-subtle">{zh ? HORIZON_COPY[horizon].blurbZh : HORIZON_COPY[horizon].en}</p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {HORIZON_OPTS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setProfile({ switchHorizon: h })}
                    className={cn(
                      "h-11 rounded-md text-xs sm:text-sm",
                      horizon === h ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border",
                    )}
                  >
                    {zh ? HORIZON_COPY[h].zh : HORIZON_COPY[h].en}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setAdvanced((v) => !v)}>
                {advanced ? (zh ? "收起進階" : "Hide advanced") : zh ? "進階：隻數同檢討節奏" : "Advanced: mix size and review"}
              </button>
            </div>
            {advanced ? (
              <>
            <div className="mt-4">
              <Label>{zh ? "配置隻數" : "How many funds"}</Label>
              <p className="mt-1 text-[11px] text-subtle">
                {zh
                  ? mixSize === "auto"
                    ? `按目標同剩餘年期，自動用 ${mixN} 隻。可以自行改。`
                    : `你指定 ${mixN} 隻。計劃可選基金少嘅時候會自動減少。`
                  : mixSize === "auto"
                    ? `Auto-picked ${mixN} for this goal and horizon.`
                    : `You chose ${mixN}. Capped if the scheme has fewer funds.`}
              </p>
              <div className="mt-2 grid grid-cols-6 gap-1">
                {MIX_SIZE_OPTS.map((n) => (
                  <button
                    key={String(n)}
                    type="button"
                    onClick={() => setProfile({ mixSize: n })}
                    className={cn(
                      "h-11 rounded-md text-xs sm:text-sm",
                      mixSize === n ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border",
                    )}
                  >
                    {zh ? MIX_SIZE_COPY[n].zh : MIX_SIZE_COPY[n].en}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <Label>{zh ? "檢討節奏" : "Review cadence"}</Label>
              <p className="mt-1 text-[11px] text-subtle">
                {zh
                  ? "強積金唔使月月轉。積金局數字按月出，密轉容易追落後。"
                  : "MPF is not a monthly trade. Official NAVs are monthly; frequent switches chase noise."}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {REVIEW_OPTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setProfile({ reviewEvery: r })}
                    className={cn(
                      "h-11 rounded-md text-xs sm:text-sm",
                      reviewEvery === r ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border",
                    )}
                  >
                    {zh ? REVIEW_COPY[r].zh : REVIEW_COPY[r].en}
                  </button>
                ))}
              </div>
            </div>
              </>
            ) : null}
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-7">
          <Card className="bg-tint-sky">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg">{zh ? "窗口：已發生／展望" : "Window: lookback / outlook"}</h2>
              <Badge tone="primary">{zh ? regime.outlookLabelZh : horizon}</Badge>
            </div>
            <p className="mb-3 text-xs text-muted">
              {zh
                ? `指數每載入更新（Yahoo）。語氣：${regime.tone === "risk-on" ? "偏進取" : regime.tone === "risk-off" ? "偏防守" : "混合"}。${markets.data?.fetchedAt ? `更新 ${markets.data.fetchedAt.slice(0, 16).replace("T", " ")} UTC` : ""}。配置跟右邊展望，唔跟左邊已發生。`
                : `Yahoo indices refresh on load (${regime.tone}). Mix follows outlook, not the lookback.`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/80 p-3">
                <p className="mb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">
                  {zh ? `已發生 · ${regime.lookbackLabelZh}` : "Lookback"}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                  {(zh ? regime.lookbackZh : regime.lookbackEn).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-[var(--shadow-border)]">
                <p className="mb-1 text-[11px] font-medium tracking-wide text-primary uppercase">
                  {zh ? `展望 · ${regime.outlookLabelZh}` : "Outlook"}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                  {(zh ? regime.outlookZh : regime.outlookEn).slice(0, 4).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
              <h2 className="font-display text-xl">{zh ? "建議配置" : "Suggested mix"}</h2>
              <p className="text-xs text-subtle">
                {zh ? `目標風險級別 ${riskT} · 剩餘年期 ${years} 年 · ${alloc.length} 隻` : `Target risk ${riskT} · ${years} years · ${alloc.length} funds`}
              </p>
              </div>
              <Button variant="outline" size="sm" onClick={copyMix} disabled={!alloc.length}>
                {copied ? (zh ? "已複製" : "Copied") : zh ? "複製配置" : "Copy mix"}
              </Button>
            </div>
            {profile.account === "contribution" && !profile.schemeEn ? (
              <p className="text-sm text-warn">{zh ? "請先選擇現時計劃，才可在可轉換範圍內推介。" : "Pick your scheme to constrain the opportunity set."}</p>
            ) : null}
            <div className="space-y-3">
              {alloc.map((a) => (
                <Link
                  key={a.fund.id}
                  to="/funds/$id"
                  params={{ id: a.fund.id }}
                  className="block rounded-lg bg-tint-sky p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{zh ? a.fund.nameZh : a.fund.nameEn}</p>
                      <p className="text-xs text-subtle">
                        {zh ? a.fund.providerZh : a.fund.providerEn} · {zh ? "開支" : "FER"} {fmtPctPlain(a.fund.fer)} ·{" "}
                        {zh ? "風險" : "R"}
                        {a.fund.riskClass ?? "—"}
                      </p>
                    </div>
                    <span className="font-mono text-lg tabular-nums">{Math.round(a.weight * 100)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{zh ? a.reasonZh : a.reasonEn}</p>
                  <div className="mt-2 flex gap-3 text-xs">
                    <span>
                      1Y <ReturnCell value={a.fund.ret1y} />
                    </span>
                    <span>
                      5Y <ReturnCell value={a.fund.ret5y} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "幾時再睇" : "When to review"}</h2>
            <p className="font-display text-xl">
              {zh ? review.labelZh : review.labelEn}
              {reviewEvery === "auto" ? (zh ? "（按年期建議）" : " (from horizon)") : ""}
            </p>
            <p className="mt-2 text-sm text-muted">{zh ? review.zh : review.en}</p>
            <p className="mt-2 text-[11px] text-subtle">
              {zh
                ? "除非轉工、計劃合併、臨近提取或收費明顯變貴，否則保持呢個配置。呢度唔係投資建議。"
                : "Hold the mix unless job, scheme, near-withdrawal or a fee jump. Not investment advice."}
            </p>
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "假設滾存示意" : "Illustrative path"}</h2>
            <p className="mb-3 text-xs text-subtle">
              {zh
                ? "用規則假設嘅年化，把現有結餘同每月供款滾到退休。牛／熊只係波動帶。唔係預測，亦唔保證。"
                : "Rolls balance and contributions at a rule-based assumed return. Bands are volatility only. Not a forecast and not a guarantee."}
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={path}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--color-subtle)" }} />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <RTooltip
                    formatter={(v: number) => fmtHkd(v)}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
                  />
                  <Area type="monotone" dataKey="bull" stroke="var(--color-up)" fill="var(--color-up)" fillOpacity={0.07} />
                  <Area type="monotone" dataKey="base" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="bear" stroke="var(--color-down)" fill="var(--color-down)" fillOpacity={0.06} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {end ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-xs text-subtle">{zh ? "熊市" : "Bear"}</p>
                  <p className="font-mono tabular-nums text-down">{fmtHkd(end.bear)}</p>
                </div>
                <div>
                  <p className="text-xs text-subtle">{zh ? "基本" : "Base"}</p>
                  <p className="font-mono tabular-nums">{fmtHkd(end.base)}</p>
                </div>
                <div>
                  <p className="text-xs text-subtle">{zh ? "牛市" : "Bull"}</p>
                  <p className="font-mono tabular-nums text-up">{fmtHkd(end.bull)}</p>
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg">{zh ? "同目標其他高分基金" : "Other high-scoring funds"}</h2>
            <ul className="space-y-2 text-sm">
              {ranked.slice(0, 8).map((s, i) => (
                <li key={s.fund.id}>
                  <Link to="/funds/$id" params={{ id: s.fund.id }} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-subtle">{i + 1}</span>
                      {zh ? s.fund.nameZh : s.fund.nameEn}
                      {s.reasons[0] ? (
                        <Badge className="ml-2" tone="neutral">
                          {s.reasons[0]}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <ReturnCell value={s.fund.ret5y} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-lg px-3 py-2.5 text-left", active ? "bg-primary text-primary-fg" : "bg-white ring-1 ring-border")}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className={cn("text-xs", active ? "text-primary-fg/75" : "text-muted")}>{sub}</p>
    </button>
  );
}
