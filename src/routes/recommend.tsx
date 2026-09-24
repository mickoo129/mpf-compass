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
import { buildRegime, HORIZON_COPY } from "@/lib/mpf/regime";
import { buildAllocation, compareSavedMix, GOAL_COPY, MIX_SIZE_COPY, MIX_SIZE_OPTS, resolvedMixSize, resolvedReview, REVIEW_COPY, REVIEW_OPTS, scoreFunds } from "@/lib/mpf/score";
import type { GoalId } from "@/lib/mpf/types";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recommend")({ component: RecommendPage });

const GOALS: GoalId[] = ["growth", "balanced", "preserve", "lowfee", "dis"];

function RecommendPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const lastMix = useAppStore((s) => s.lastMix);
  const saveMix = useAppStore((s) => s.saveMix);
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
  const mixSize = profile.mixSize ?? "auto";
  const reviewEvery = profile.reviewEvery ?? "auto";
  const mixN = resolvedMixSize(profile, ranked.length);
  const review = resolvedReview(profile);
  const [advanced, setAdvanced] = useState(
    () => profile.mixSize !== "auto" || profile.reviewEvery !== "auto",
  );
  const [copied, setCopied] = useState(false);

  const comparison = useMemo(() => compareSavedMix(lastMix, alloc, ranked), [lastMix, alloc, ranked]);
  const mixAgeMs = lastMix ? Date.now() - new Date(lastMix.at).getTime() : 0;
  const showCompare = comparison.status === "adjust" || mixAgeMs > 12 * 60 * 60 * 1000;

  useEffect(() => {
    if (!alloc.length || lastMix) return;
    saveMix({
      at: new Date().toISOString(),
      horizon,
      schemeEn: profile.schemeEn,
      goal: profile.goal,
      holdings: alloc.map((a) => ({
        id: a.fund.id,
        weight: a.weight,
        nameZh: a.fund.nameZh,
        nameEn: a.fund.nameEn,
      })),
    });
  }, [alloc, lastMix, saveMix, horizon, profile.schemeEn, profile.goal]);

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
        title={zh ? "先設定目標，再在可選範圍內評分。" : "State the goal, then score inside your opportunity set."}
        subtitle={
          zh
            ? "供款帳戶通常只能在僱主計劃內轉換。轉換視野是未來持有期；配置跟隨展望（利率、52 週位置、過熱），不會把過去半年視為未來。並非投資建議，亦不保證獲利。"
            : "Contribution accounts switch inside the employer scheme. The window is forward-looking: yield, 52-week stretch and overheat — not “past 6 months = next 6 months”. Not advice and not a profit guarantee."
        }
      />
      <AsOfLine zh={zh} />

      <Card className="mb-6 bg-tint-sand">
        <h2 className="mb-1 font-display text-lg">{zh ? "策略來源" : "Where the mix comes from"}</h2>
        <p className="mb-3 text-sm text-muted">
          {zh
            ? "此並非積金局或受託人的官方部署，亦非預測必賺。配置是一條公開規則：按你填寫的目標，結合積金局長線數字，再用最新指數避免追趕過熱。"
            : "This is not an MPFA or trustee allocation, and not a profit forecast. The mix is a published rule: your goal, MPFA long-horizon figures, then live indices to avoid chasing heat."}
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>{zh ? "你：目標、轉換視野（未來持有多久）、現時計劃可選範圍。" : "You: goal, switch window, and the scheme menu you can actually use."}</li>
          <li>{zh ? `積金局（截至 ${catalogMeta.asOf}）：收費、風險級別、五年同類表現——用以判斷基金是否偏貴、風險是否合適、同類之中是否落後。` : `MPFA (as of ${catalogMeta.asOf}): fees, risk class, 5-year peer standing — whether a fund is costly, too risky, or lagging its group.`}</li>
          <li>{zh ? "Yahoo 指數（開啟頁面時更新）：利率起始孳息、距離 52 週高位、過熱——用作調整比重，不會把過去半年視為未來。" : "Yahoo indices (refresh on load): starting yield, 52-week stretch, overheat — a tilt, not “past = future”."}</li>
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "你的情況" : "Your situation"}</h2>
            <p className="mb-4 text-[11px] text-subtle">
              {zh
                ? "每次開啟都由 35 歲、65 歲退休、結餘 0、每月供款 0 開始，不會記住上一個人的數字。"
                : "Each visit starts at age 35, retirement 65, zero balance and zero monthly contribution. Nothing here is saved for the next person."}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <MoneyInput value={profile.balance} onChange={(n) => setProfile({ balance: n })} />
              </Field>
              <Field label={zh ? "每月供款" : "Monthly contribution"}>
                <MoneyInput value={profile.monthly} onChange={(n) => setProfile({ monthly: n })} />
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
                <Label>{zh ? "現時計劃（只在此計劃內揀基金）" : "Current scheme (funds from this scheme only)"}</Label>
                <select
                  className="mt-2 h-11 w-full rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
                  value={profile.schemeEn ?? ""}
                  onChange={(e) => setProfile({ schemeEn: e.target.value || null })}
                >
                  <option value="">{zh ? "請選擇計劃，例如只得宏利戶口" : "Select scheme, e.g. Manulife only"}</option>
                  {schemes.map((s) => (
                    <option key={s.en} value={s.en}>
                      {zh ? s.zh : s.en}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-subtle">
                  {zh ? "供款帳戶通常只能在僱主計劃內轉換。未選計劃則不會給出配置。" : "Contribution accounts switch inside the employer scheme."}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <Label>{zh ? "只從此計劃揀基金（可選）" : "Limit to one scheme (optional)"}</Label>
                <select
                  className="mt-2 h-11 w-full rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
                  value={profile.schemeEn ?? ""}
                  onChange={(e) => setProfile({ schemeEn: e.target.value || null })}
                >
                  <option value="">{zh ? "不限計劃（全港可轉）" : "All schemes"}</option>
                  {schemes.map((s) => (
                    <option key={s.en} value={s.en}>
                      {zh ? s.zh : s.en}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-subtle">
                  {zh ? "個人帳戶可轉出。若實際只得一間公司（例如宏利），請在此鎖定該計劃。" : "Personal accounts can transfer. Lock a scheme if you only hold one trustee."}
                </p>
              </div>
            )}
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
                    {zh ? GOAL_COPY[g].blurbZh : GOAL_COPY[g].blurbEn}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label>{zh ? "今次轉換視野" : "Switch window"}</Label>
              <p className="mt-1 text-[11px] text-subtle">
                {zh
                  ? "已發生／展望會跟你揀的時段。揀三個月就睇近三個月同未來三個月。"
                  : "Lookback and outlook follow this window."}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {(["1m", "3m", "6m", "1y"] as const).map((h) => (
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
              <p className="mt-1 text-[11px] text-subtle">{zh ? HORIZON_COPY[horizon].blurbZh : HORIZON_COPY[horizon].en}</p>
            </div>
            <div className="mt-4">
              <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setAdvanced((v) => !v)}>
                {advanced ? (zh ? "收起進階" : "Hide advanced") : zh ? "進階：基金數目與檢討節奏" : "Advanced: mix size and review"}
              </button>
            </div>
            {advanced ? (
              <>
            <div className="mt-4">
              <Label>{zh ? "配置基金數目" : "How many funds"}</Label>
              <p className="mt-1 text-[11px] text-subtle">
                {zh
                  ? mixSize === "auto"
                    ? `按目標及剩餘年期，自動採用 ${mixN} 檔。亦可自行更改。`
                    : `你指定 ${mixN} 檔。計劃可選基金較少時會自動減少。`
                  : mixSize === "auto"
                    ? `Auto-picked ${mixN} for this goal and horizon.`
                    : `You chose ${mixN}. Capped if the scheme has fewer funds.`}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6">
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
                  ? "強積金不必每月轉換。積金局數字按月公布，頻繁轉換容易追趕落後表現。"
                  : "MPF is not a monthly trade. Official NAVs are monthly; frequent switches chase noise."}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
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
                ? `Yahoo 指數，開啟本頁時更新${markets.data?.fetchedAt ? `（${markets.data.fetchedAt.slice(0, 16).replace("T", " ")} UTC）` : ""}。左側是該時段已經發生的走勢；右側是同一時段的規則展望（利率、52 週位置、過熱），不是預測必升。`
                : `Yahoo indices as of page load. Left = what already happened in the window; right = a rule-based tilt, not a forecast.`}
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
                {zh
                  ? `${profile.schemeEn ? schemes.find((s) => s.en === profile.schemeEn)?.zh ?? "已選計劃" : "全港可轉"} · ${mixSize === "auto" ? "自動" : "指定"} ${alloc.length} 檔 · 剩餘 ${years} 年`
                  : `${profile.schemeEn ? schemes.find((s) => s.en === profile.schemeEn)?.en ?? "scheme" : "all schemes"} · ${alloc.length} funds · ${years}y`}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-subtle">
                {zh
                  ? `檔數按目標與距離退休自動決定（穩健、年期較長通常 3 檔）。排序用收費、風險、五年同類，再加「${HORIZON_COPY[horizon].zh}」展望（利率、過熱、滯後），不是隨便派保守或進取基金，亦不是保證該段增值。`
                  : `Count follows goal and years to retirement (balanced + long horizon usually 3). Not a guarantee the window will be profitable.`}
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

          {showCompare && comparison.status !== "none" ? (
            <Card className={comparison.status === "adjust" ? "bg-tint-sand" : "bg-tint-mint"}>
              <h2 className="mb-1 font-display text-lg">{zh ? "對照上次建議" : "Versus last mix"}</h2>
              <p className="text-xs text-subtle">
                {zh
                  ? `上次 ${lastMix ? lastMix.at.slice(0, 10) : ""} · ${comparison.status === "keep" ? "可繼續持有" : "建議調整"}`
                  : `Saved ${lastMix ? lastMix.at.slice(0, 10) : ""} · ${comparison.status}`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                {(zh ? comparison.alertsZh : comparison.alertsEn).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-subtle">
                {zh
                  ? "沒有每日單位價，不能用「升幾多／跌幾多」作為轉倉警號。警號是展望變弱，或同類出現明顯更高分、更低收費的替代。"
                  : "No daily NAVs, so there is no +X% / −X% switch trigger. Alerts are a weaker outlook or a clearly better-scoring, cheaper peer."}
              </p>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "幾時再回來對照" : "When to come back"}</h2>
            <p className="font-display text-xl">{zh ? review.labelZh : review.labelEn}</p>
            <p className="mt-2 text-sm text-muted">{zh ? review.zh : review.en}</p>
            <p className="mt-2 text-[11px] text-subtle">
              {zh
                ? "轉換視野同再看一次係同一件事：揀一個月，就一個月後返嚟對照今次建議。不是保證該段一定升。回來時系統用展望同評分決定維持定調整，不是用你帳戶的升跌幅（我們沒有單位價）。"
                : "The window is the review date. Come back then. Keep vs adjust follows outlook and scores, not your account’s P&L — we have no unit prices."}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              disabled={!alloc.length}
              onClick={() =>
                saveMix({
                  at: new Date().toISOString(),
                  horizon,
                  schemeEn: profile.schemeEn,
                  goal: profile.goal,
                  holdings: alloc.map((a) => ({
                    id: a.fund.id,
                    weight: a.weight,
                    nameZh: a.fund.nameZh,
                    nameEn: a.fund.nameEn,
                  })),
                })
              }
            >
              {zh ? "記住今次建議" : "Save this mix"}
            </Button>
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "至退休的假設滾存" : "Illustrative path to retirement"}</h2>
            <p className="mb-3 text-xs text-subtle">
              {zh
                ? `假設你長期持有今次這幾隻直至退休（${years} 年）。基本＝規則假設年化＋每月供款。牛／熊＝按風險級別的波動帶，不是預測。日常睇基本。與「${HORIZON_COPY[horizon].zh}」對照週期無關。`
                : `The x-axis is years to retirement (${years}), not the switch window. Base compounds a rule-based return plus contributions. Bull/bear are volatility bands from risk class, not forecasts. Read the base line. Not a guarantee.`}
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

function MoneyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value ? String(Math.round(value)) : "");
  useEffect(() => {
    const next = value ? String(Math.round(value)) : "";
    setText((cur) => (Number(cur || 0) === value ? cur : next));
  }, [value]);
  return (
    <Input
      inputMode="numeric"
      value={text}
      placeholder="0"
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        setText(raw);
        onChange(raw === "" ? 0 : Number(raw));
      }}
    />
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
