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
import { PageTitle } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ReturnCell } from "@/components/funds/return-cell";
import { RangeCard } from "@/components/funds/range-card";
import { Term } from "@/components/ui/term";
import { FeeAmount } from "@/components/funds/fee-card";
import { mixFer } from "@/lib/mpf/fees";
import { estimateSince, levelsFrom } from "@/lib/mpf/review";
import { fundById } from "@/lib/mpf/catalog";
import type { SavedMix } from "@/lib/mpf/types";
import { catalogMeta, uniqueSchemes } from "@/lib/mpf/catalog";
import { fmtHkd, fmtPctPlain } from "@/lib/mpf/format";
import { projectScenarios, scenarioRates } from "@/lib/mpf/forecast";
import { buildRegime, HORIZON_COPY } from "@/lib/mpf/regime";
import { buildAllocation, compareSavedMix, GOAL_COPY, MIX_SIZE_COPY, MIX_SIZE_OPTS, resolvedMixSize, resolvedReview, REVIEW_COPY, REVIEW_OPTS, expectedReturn, REASON_EN, scoreFunds, sleevePrior, suitabilityChecks } from "@/lib/mpf/score";
import type { GoalId } from "@/lib/mpf/types";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

type RecommendSearch = { scheme?: string; r?: string };

export const Route = createFileRoute("/recommend")({
  // ?scheme=<schemeEn> lets a scheme page (or an adviser's WhatsApp link) open 智選 locked to one scheme.
  validateSearch: (raw: Record<string, unknown>): RecommendSearch =>
    ({
      scheme: typeof raw.scheme === "string" && raw.scheme ? raw.scheme : undefined,
      r: typeof raw.r === "string" && raw.r ? raw.r : undefined,
    }),
  head: ({ match }) => {
    const { r } = match.search as RecommendSearch;
    const saved = decodeMix(r);
    return {
      meta: seo(
        saved
          ? {
              title: `強積金參考配置（${saved.at.slice(0, 10)}）`,
              description: `${saved.holdings.map((h) => `${Math.round(h.weight * 100)}% ${h.nameZh}`).join("、")}。打開可睇至今大約升跌。研究用途，並非投資建議。`,
              path: "/recommend",
            }
          : { title: "智選參考配置", description: "按年齡同風險取向，喺你嘅計劃入面篩選 2–5 隻基金，計埋收費同至退休滾存。研究用途，並非投資建議。", path: "/recommend" },
      ),
    };
  },
  component: RecommendPage,
});

const EXAMPLE_BALANCE = 200_000;
const EXAMPLE_MONTHLY = 3_000;

const GOALS: GoalId[] = ["growth", "balanced", "preserve", "lowfee", "dis"];

function RecommendPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const lastMix = useAppStore((s) => s.lastMix);
  const saveMix = useAppStore((s) => s.saveMix);
  const schemes = uniqueSchemes();
  const search = Route.useSearch();
  useEffect(() => {
    if (search.scheme && schemes.some((s) => s.en === search.scheme)) {
      setProfile({ account: "contribution", schemeEn: search.scheme });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.scheme]);
  const horizon = profile.switchHorizon ?? "6m";
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => getMarkets() });
  const regime = useMemo(
    () => buildRegime(markets.data?.quotes ?? [], horizon),
    [markets.data, horizon],
  );
  const ranked = useMemo(() => scoreFunds(profile, regime), [profile, regime]);
  const alloc = useMemo(() => buildAllocation(profile, ranked), [profile, ranked]);
  const years = Math.max(1, profile.retireAge - profile.age);
  // With nothing entered the chart would be a flat line at $0, so show a clearly
  // labelled example (typical HK member) until the person types their own numbers.
  const usingExample = profile.balance === 0 && profile.monthly === 0;
  const projBalance = usingExample ? EXAMPLE_BALANCE : profile.balance;
  const projMonthly = usingExample ? EXAMPLE_MONTHLY : profile.monthly;

  const assumed = useMemo(
    () =>
      alloc.map((a) => ({
        a,
        prior: sleevePrior(a.fund),
        r: expectedReturn(a.fund),
      })),
    [alloc],
  );
  const assumedTotal = assumed.reduce((s, x) => s + x.a.weight * x.r, 0);
  const mixRisk = alloc.reduce((s, a) => s + a.weight * (a.fund.riskClass ?? 4), 0) || 4;
  const rates = scenarioRates(assumedTotal || 4, mixRisk);
  const path = useMemo(
    () => projectScenarios(projBalance, projMonthly, years, rates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projBalance, projMonthly, years, rates.low, rates.mid, rates.high],
  );
  const end = path.at(-1);
  const mixSize = profile.mixSize ?? "auto";
  const reviewEvery = profile.reviewEvery ?? "auto";
  const mixN = resolvedMixSize(profile, ranked.length);
  const review = resolvedReview(profile);
  const checks = useMemo(() => suitabilityChecks(profile), [profile]);
  const warns = checks.filter((c) => c.level === "warn");
  const [advanced, setAdvanced] = useState(
    () => profile.mixSize !== "auto" || profile.reviewEvery !== "auto",
  );
  const [copied, setCopied] = useState(false);

  const comparison = useMemo(() => compareSavedMix(lastMix, alloc, ranked), [lastMix, alloc, ranked]);
  const mixAgeMs = lastMix ? Date.now() - new Date(lastMix.at).getTime() : 0;
  const showCompare = comparison.status === "adjust" || mixAgeMs > 12 * 60 * 60 * 1000;

  // A saved mix can arrive in a shared link (?r=…) so the member can compare on any device.
  useEffect(() => {
    const fromLink = decodeMix(search.r);
    if (fromLink && fromLink.at !== lastMix?.at) saveMix(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.r]);

  function buildSaved(): SavedMix {
    return {
      at: new Date().toISOString(),
      horizon,
      schemeEn: alloc[0]?.fund.schemeEn ?? profile.schemeEn,
      goal: profile.goal,
      holdings: alloc.map((a) => ({
        id: a.fund.id,
        weight: a.weight,
        nameZh: a.fund.nameZh,
        nameEn: a.fund.nameEn,
        bench: a.fund.bench,
        beta: a.fund.beta,
        fer: a.fund.fer,
        ret1y: a.fund.ret1y,
        cashLike: a.fund.category === "money" || a.fund.category === "guaranteed" || a.fund.isConservative,
      })),
      levels: levelsFrom(markets.data?.quotes ?? []),
    };
  }
  const since = useMemo(
    () => (lastMix && markets.data ? estimateSince(lastMix, levelsFrom(markets.data.quotes)) : null),
    [lastMix, markets.data],
  );

  function mixText(): string {
    const scheme = alloc[0] ? (zh ? alloc[0].fund.schemeZh : alloc[0].fund.schemeEn) : "";
    const url = new URL("/recommend", window.location.origin);
    if (alloc[0]) url.searchParams.set("scheme", alloc[0].fund.schemeEn);
    // Saving on share means the link also carries "since last time" for the next visit.
    const saved = buildSaved();
    saveMix(saved);
    url.searchParams.set("r", encodeMix(saved));
    return [
      zh ? "積金羅盤 · 配置參考（研究用，並非投資建議）" : "MPF Compass mix (research only, not advice)",
      `${zh ? "計劃" : "Scheme"}：${scheme}`,
      `${zh ? "目標" : "Goal"}：${zh ? GOAL_COPY[profile.goal].zh : GOAL_COPY[profile.goal].en} · ${zh ? `${profile.age} 歲` : `age ${profile.age}`}`,
      "",
      ...alloc.map((a) => `${Math.round(a.weight * 100)}%  ${zh ? a.fund.nameZh : a.fund.nameEn}`),
      "",
      `${zh ? "基金數字截至" : "Fund figures as of"} ${catalogMeta.asOf}`,
      url.toString(),
    ].join("\n");
  }

  async function shareMix() {
    const text = mixText();
    // Phones: open the share sheet (WhatsApp, Messages…). Desktop: copy to clipboard.
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* cancelled or unsupported: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(zh ? "複製以下內容：" : "Copy this:", text);
    }
  }

  return (
    <div>
      <PageTitle
        kicker={zh ? "智選配置" : "Goal-based mix"}
        title={zh ? "按你嘅年齡同風險取向，計好晒。" : "A mix for your age and risk appetite."}
        subtitle={zh ? "結果喺下面，想改條件撳「修改條件」。研究用途，並非投資建議。" : "Results below; tap Edit to change inputs. Research only, not advice."}
      />
      <div className="sticky top-14 z-30 -mx-4 mb-5 flex items-center gap-2 border-b border-white/10 bg-[#0b2a4a]/95 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <p className="min-w-0 flex-1 truncate text-sm text-white">
          {zh
            ? `${profile.age} 歲 · ${GOAL_COPY[profile.goal].zh} · ${profile.schemeEn ? (schemes.find((x) => x.en === profile.schemeEn)?.zh ?? "") : "全港計劃"} · 每${HORIZON_COPY[horizon].zh}檢討`
            : `Age ${profile.age} · ${GOAL_COPY[profile.goal].en} · ${profile.schemeEn ?? "all schemes"}`}
        </p>
        <Button asChild size="sm" variant="outline" className="shrink-0 whitespace-nowrap">
          <a href="#inputs">{zh ? "修改條件" : "Edit"}</a>
        </Button>
      </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div id="inputs" className="order-2 min-w-0 scroll-mt-28 space-y-5 lg:order-1 lg:col-span-5">
          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "你的情況" : "Your situation"}</h2>
            <p className="mb-4 text-xs text-subtle">
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
              <Label><Term k="account">{zh ? "帳戶類型" : "Account"}</Term></Label>
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
                  className="mt-2 h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
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
                <p className="mt-1 text-xs text-subtle">
                  {zh ? "供款帳戶通常只能在僱主計劃內轉換。未選計劃則不會給出配置。" : "Contribution accounts switch inside the employer scheme."}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <Label>{zh ? "只從此計劃揀基金（可選）" : "Limit to one scheme (optional)"}</Label>
                <select
                  className="mt-2 h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
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
                <p className="mt-1 text-xs text-subtle">
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
            <SuitabilityList items={checks} zh={zh} />
            <div className="mt-4">
              <Label>{zh ? "今次轉換視野" : "Switch window"}</Label>
              <p className="mt-1 text-xs text-subtle">
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
              <p className="mt-1 text-xs text-subtle">{zh ? HORIZON_COPY[horizon].blurbZh : HORIZON_COPY[horizon].en}</p>
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
              <p className="mt-1 text-xs text-subtle">
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
              <p className="mt-1 text-xs text-subtle">
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

        <div className="order-1 min-w-0 space-y-5 lg:order-2 lg:col-span-7">
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
              <h2 className="font-display text-xl">{zh ? "參考配置" : "Reference mix"}</h2>
              <p className="text-xs text-subtle">
                {zh
                  ? `${profile.schemeEn ? schemes.find((s) => s.en === profile.schemeEn)?.zh ?? "已選計劃" : `全港比較後最佳計劃：${alloc[0]?.fund.schemeZh ?? "—"}`} · ${mixSize === "auto" ? "自動" : "指定"} ${alloc.length} 檔 · 剩餘 ${years} 年`
                  : `${profile.schemeEn ? schemes.find((s) => s.en === profile.schemeEn)?.en ?? "scheme" : `best scheme across HK: ${alloc[0]?.fund.schemeEn ?? "—"}`} · ${alloc.length} funds · ${years}y`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-subtle">
                {zh
                  ? "按收費、風險、五年同類表現同市況揀出；點樣計可以睇下面「點樣揀出嚟？」。"
                  : `Count follows goal and years to retirement (balanced + long horizon usually 3). Not a guarantee the window will be profitable.`}
              </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                onClick={() => void shareMix()}
                disabled={!alloc.length}
                title={zh ? "分享或複製呢個配置，可以直接貼落 WhatsApp" : "Share or copy this mix"}
              >
                {copied ? (zh ? "已複製" : "Copied") : zh ? "分享配置" : "Share mix"}
              </Button>
            </div>
            {alloc.length ? (
              <p className="mb-3 rounded-md bg-tint-mint px-3 py-2 text-sm">
                {zh ? "呢個配置平均開支比率 " : "Weighted FER "}
                <b className="font-mono">{fmtPctPlain(mixFer(alloc))}</b>
                {zh ? "，即係每年約 " : ", about "}
                <FeeAmount fer={mixFer(alloc)} zh={zh} className="font-mono font-medium" />
                {profile.balance > 0 ? null : (
                  <span className="block text-xs text-muted">{zh ? "喺「你的情況」填上結餘，就會用你自己嘅金額計。" : "Enter your balance to see your own amount."}</span>
                )}
              </p>
            ) : null}
            {warns.length ? (
              <div className="mb-3 rounded-lg border border-warn/40 bg-tint-sand p-3 text-sm text-fg" role="alert">
                <p className="mb-1 font-medium text-warn">{zh ? "請留意：目標同年期未必配合" : "Check: goal and horizon may not fit"}</p>
                {warns.map((w) => (
                  <p key={w.en} className="text-xs text-muted">{zh ? w.zh : w.en}</p>
                ))}
              </div>
            ) : null}
            {profile.account === "contribution" && !profile.schemeEn ? (
              <p className="text-sm text-warn">{zh ? "請先選擇現時計劃，先可以喺可轉換範圍內篩選。" : "Pick your scheme to constrain the opportunity set."}</p>
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
                        {zh ? a.fund.schemeZh : a.fund.schemeEn} · {zh ? "開支" : "FER"} {fmtPctPlain(a.fund.fer)} ·{" "}
                        {zh ? "風險 " : "R"}
                        {a.fund.riskClass ?? "—"}
                      </p>
                    </div>
                    <span className="font-mono text-lg tabular-nums">{Math.round(a.weight * 100)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{zh ? a.reasonZh : a.reasonEn}</p>
                  <div className="mt-2 flex gap-3 text-xs">
                    <span>
                      {zh ? "1年" : "1Y"} <ReturnCell value={a.fund.ret1y} />
                    </span>
                    <span>
                      {zh ? "5年" : "5Y"} <ReturnCell value={a.fund.ret5y} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {alloc.length ? (
            <RangeCard
              items={alloc.map((a) => ({ fund: a.fund, weight: a.weight }))}
              zh={zh}
              amount={profile.balance}
              initialMonths={({ "1m": 1, "3m": 3, "6m": 6, "1y": 12 } as const)[horizon]}
              title={zh ? "呢個配置可能升跌幾多（歷史估算）" : "How much this mix might move (historical)"}
            />
          ) : null}

          {lastMix && since ? (
            <SinceCard since={since} savedAt={lastMix.at} balance={profile.balance} zh={zh} />
          ) : null}

          {showCompare && comparison.status !== "none" ? (
            <Card className={comparison.status === "adjust" ? "bg-tint-sand" : "bg-tint-mint"}>
              <h2 className="mb-1 font-display text-lg">{zh ? "同上次比較" : "Versus last mix"}</h2>
              <p className="text-xs text-subtle">
                {zh
                  ? `上次 ${lastMix ? lastMix.at.slice(0, 10) : ""} · ${comparison.status === "keep" ? "排序冇變" : "排序有變"}`
                  : `Saved ${lastMix ? lastMix.at.slice(0, 10) : ""} · ${comparison.status}`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                {(zh ? comparison.alertsZh : comparison.alertsEn).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-subtle">
                {zh
                  ? "上面嘅升跌只係估算，唔應該單憑升跌決定轉換。排序有變通常係因為展望轉弱，或者同類出現更高分、更低收費嘅選擇。"
                  : "No daily NAVs, so there is no +X% / −X% switch trigger. Alerts are a weaker outlook or a clearly better-scoring, cheaper peer."}
              </p>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "幾時再回來對照" : "When to come back"}</h2>
            <p className="font-display text-xl">{zh ? review.labelZh : review.labelEn}</p>
            <p className="mt-2 text-sm text-muted">{zh ? review.zh : review.en}</p>
            <p className="mt-2 text-xs text-subtle">
              {zh
                ? "撳「記住今次配置」，到時返嚟呢頁就會見到呢段時間大約升跌咗幾多（用指數估算），同埋今次排序有冇變。唔保證該段一定升。"
                : "The window is the review date. Come back then. Keep vs adjust follows outlook and scores, not your account’s P&L — we have no unit prices."}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              disabled={!alloc.length}
              onClick={() => saveMix(buildSaved())}
            >
              {zh ? "記住今次配置" : "Save this mix"}
            </Button>
            {lastMix ? (
              <p className="mt-2 text-xs text-subtle">
                {zh
                  ? `已記低 ${lastMix.at.slice(0, 10)} 嘅配置（只存喺呢部機）。用「分享配置」send 出去嘅連結亦帶住佢，喺其他手機打開都對照到。`
                  : `Saved ${lastMix.at.slice(0, 10)} on this device. Links from "Share mix" carry it too.`}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "至退休的假設滾存" : "Illustrative path to retirement"}</h2>
            {usingExample ? (
              <p className="mb-2 rounded-md bg-tint-sand px-3 py-2 text-xs text-fg">
                {zh
                  ? `示例：未填資料，暫時以結餘 ${fmtHkd(EXAMPLE_BALANCE)}、每月供款 ${fmtHkd(EXAMPLE_MONTHLY)} 計。喺上面「你的情況」填返自己嘅數字就會即時更新。`
                  : `Example: nothing entered, so this uses a ${fmtHkd(EXAMPLE_BALANCE)} balance and ${fmtHkd(EXAMPLE_MONTHLY)} a month. Enter your own figures above to update.`}
              </p>
            ) : null}
            <p className="mb-3 text-xs text-subtle">
              {zh
                ? `假設長期持有呢個配置直至退休（${years} 年），連每月供款一齊滾存。三條線係三個平均年回報假設，唔係預測；中途上落可以睇上面「可能升跌範圍」。`
                : `Years to retirement (${years}). Compounds a rule-based return plus contributions — a reference line, not a forecast. See the range card above for the ups and downs along the way.`}
            </p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={path} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                    tickFormatter={(y: number) => String(profile.age + y)}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    width={48}
                    tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                    tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v === 0 ? "0" : `${Math.round(v / 1000)}k`)}
                  />
                  <RTooltip
                    formatter={(v: number, name: string) => [fmtHkd(v), name]}
                    labelFormatter={(y: number) => (zh ? `${profile.age + y} 歲` : `Age ${profile.age + y}`)}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
                  />
                  <Area type="monotone" dataKey="high" name={zh ? "樂觀" : "Hopeful"} stroke="var(--color-up)" fill="none" strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="mid" name={zh ? "中間" : "Middle"} stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="low" name={zh ? "保守" : "Cautious"} stroke="var(--color-warn)" fill="none" strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {assumed.length ? (
              <details className="mt-3 rounded-md bg-tint-sky px-3 py-2 text-xs text-muted">
                <summary className="cursor-pointer text-fg">
                  {zh ? `「中間」${assumedTotal.toFixed(1)}% 點樣計？` : `How is the middle ${assumedTotal.toFixed(1)}% worked out?`}
                </summary>
                <p className="mt-2">
                  {zh
                    ? "每隻基金：55% 用該類資產嘅長期規劃假設，45% 用該基金積金局五年年化回報（上限 12%、下限 -2%，避免短期好景誇大），再扣開支比率高過 0.8% 嘅部分（每高 1% 扣 0.25%）。然後按配置比例加權。"
                    : "Per fund: 55% long-run planning assumption for its asset class, 45% its MPFA 5-year return (capped 12%, floored −2%), less a fee drag for FER above 0.8%. Then weighted by the mix."}
                </p>
                <table className="mt-2 w-full text-left">
                  <thead>
                    <tr className="text-subtle">
                      <th className="py-1 font-normal">{zh ? "基金" : "Fund"}</th>
                      <th className="py-1 pl-2 text-right font-normal whitespace-nowrap">{zh ? "類別假設" : "Class"}</th>
                      <th className="py-1 pl-2 text-right font-normal whitespace-nowrap">{zh ? "五年" : "5Y"}</th>
                      <th className="py-1 pl-2 text-right font-normal whitespace-nowrap">{zh ? "假設" : "Used"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assumed.map(({ a, prior, r }) => (
                      <tr key={a.fund.id} className="border-t border-border">
                        <td className="py-1 pr-2">
                          {Math.round(a.weight * 100)}% {zh ? a.fund.nameZh : a.fund.nameEn}
                        </td>
                        <td className="py-1 pl-2 text-right font-mono whitespace-nowrap">{prior.toFixed(1)}%</td>
                        <td className="py-1 pl-2 text-right font-mono whitespace-nowrap">{fmtPctPlain(a.fund.ret5y, 1)}</td>
                        <td className="py-1 pl-2 text-right font-mono whitespace-nowrap text-fg">{r.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2">
                  {zh
                    ? `類別長期假設係本工具嘅規劃數字（例如美股 6.5%、核心累積 5.0%、環球債券 3.0%），刻意定得比近十年強積金中位數低大約 1%，唔係積金局數字，亦唔係保證。「保守」同「樂觀」再按配置風險上下調 ${(rates.mid - rates.low).toFixed(1)}%。`
                    : "Class assumptions are this tool's planning figures, not MPFA numbers and not guarantees."}
                </p>
              </details>
            ) : null}
            {end ? (
              <div className="mt-3">
                <p className="mb-2 text-sm">{zh ? `${profile.retireAge} 歲退休時大約：` : `At ${profile.retireAge}, roughly:`}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["low", zh ? "保守" : "Cautious", "text-warn"],
                      ["mid", zh ? "中間" : "Middle", "text-primary"],
                      ["high", zh ? "樂觀" : "Hopeful", "text-up"],
                    ] as const
                  ).map(([k, label, cls]) => (
                    <div key={k} className="rounded-lg bg-tint-sky px-1 py-2">
                      <p className={cn("text-xs font-medium", cls)}>
                        {label} {rates[k].toFixed(1)}%
                      </p>
                      <p className="font-mono text-sm tabular-nums sm:text-base">{fmtHkd(end[k])}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-subtle">
                  {zh
                    ? `當中供款本金約 ${fmtHkd(projBalance + projMonthly * 12 * years)}。平均年回報每差 1%，${years} 年後結果可以差好遠，所以唔好只睇中間嗰個數。`
                    : `Contributions ≈ ${fmtHkd(projBalance + projMonthly * 12 * years)}. A 1-point difference in average return compounds a lot over ${years} years.`}
                </p>
              </div>
            ) : null}
          </Card>

          <details className="group rounded-xl bg-card p-4 text-fg shadow-[var(--shadow-border)] sm:p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="font-display text-lg">{zh ? "點樣揀出嚟？" : "How was this picked?"}</span>
                <span className="block text-xs text-muted">{zh ? "評分規則、市況展望（利率、52 週位置、過熱）" : "Scoring rule and market outlook"}</span>
              </span>
              <span className="text-xs text-primary group-open:hidden">{zh ? "展開" : "Show"}</span>
            </summary>
            <div className="mt-4 space-y-5">
      <div>
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
      </div>
          <div>
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
                <p className="mb-1 text-xs font-medium tracking-wide text-subtle uppercase">
                  {zh ? `已發生 · ${regime.lookbackLabelZh}` : "Lookback"}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                  {(zh ? regime.lookbackZh : regime.lookbackEn).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-[var(--shadow-border)]">
                <p className="mb-1 text-xs font-medium tracking-wide text-primary uppercase">
                  {zh ? `展望 · ${regime.outlookLabelZh}` : "Outlook"}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                  {(zh ? regime.outlookZh : regime.outlookEn).slice(0, 4).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
            </div>
          </details>

          <Card>
            <h2 className="mb-3 font-display text-lg">{zh ? "同目標其他高分基金" : "Other high-scoring funds"}</h2>
            <ul className="space-y-2 text-sm">
              {ranked.slice(0, 8).map((s, i) => (
                <li key={s.fund.id}>
                  <Link to="/funds/$id" params={{ id: s.fund.id }} className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 gap-2">
                      <span className="font-mono text-subtle">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block">{zh ? s.fund.nameZh : s.fund.nameEn}</span>
                        <span className="block text-xs text-subtle">
                          {zh ? s.fund.schemeZh : s.fund.schemeEn}
                          {s.reasons[0] ? (
                            <Badge className="ml-1.5 align-middle" tone="neutral">
                              {zh ? s.reasons[0] : (REASON_EN[s.reasons[0]] ?? s.reasons[0])}
                            </Badge>
                          ) : null}
                        </span>
                      </span>
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

function SuitabilityList({ items, zh }: { items: { level: "warn" | "note"; zh: string; en: string }[]; zh: boolean }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {items.map((c) => (
        <p
          key={c.en}
          className={cn(
            "rounded-md px-3 py-2 text-xs leading-relaxed",
            c.level === "warn" ? "bg-tint-sand text-fg ring-1 ring-warn/40" : "bg-tint-sky text-muted",
          )}
        >
          {c.level === "warn" ? <span className="mr-1 font-medium text-warn">{zh ? "注意" : "Note"}</span> : null}
          {zh ? c.zh : c.en}
        </p>
      ))}
    </div>
  );
}

/* ---------- since-last-time card and link encoding ---------- */

function SinceCard({
  since,
  savedAt,
  balance,
  zh,
}: {
  since: ReturnType<typeof estimateSince>;
  savedAt: string;
  balance: number;
  zh: boolean;
}) {
  const fmt = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
  return (
    <Card className="bg-tint-sky">
      <h2 className="mb-1 font-display text-lg">{zh ? "上次記低嘅配置，至今大約" : "Since your saved mix (est.)"}</h2>
      <p className="text-xs text-muted">
        {zh ? `${savedAt.slice(0, 10)} 記低 · 過咗 ${since.days} 日` : `Saved ${savedAt.slice(0, 10)} · ${since.days} days ago`}
      </p>
      {since.days < 1 ? (
        <p className="mt-2 text-sm text-muted">{zh ? "今日先記低，過一排返嚟就會見到升跌估算。" : "Saved today. Come back later to see the estimate."}</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            {zh ? "整體估算 " : "Overall "}
            <b className={cn("font-mono text-xl", (since.pct ?? 0) >= 0 ? "text-up" : "text-down")}>{fmt(since.pct)}</b>
            {balance > 0 && since.pct != null ? (
              <span className="ml-1 text-muted">
                {zh ? "（以你結餘計約 " : " (about "}
                {since.pct >= 0 ? "+" : "−"}
                {fmtHkd(Math.abs((balance * since.pct) / 100))}
                {zh ? "）" : ")"}
              </span>
            ) : null}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {since.holdings.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  {Math.round(h.weight * 100)}% {zh ? h.nameZh : h.nameEn}
                </span>
                <span className={cn("shrink-0 font-mono", (h.pct ?? 0) >= 0 ? "text-up" : "text-down")}>{fmt(h.pct)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {zh
          ? "估算方法：積金局每月先公布基金回報，所以用每隻基金對應嘅市場指數（混合及債券部分用美債息變化）由記低嗰日計到今日，再扣開支比率。唔係基金實際單位價，可能同你戶口有出入。"
          : "Estimated from each fund's reference index (bond part from the US 10-year yield) since the save date, minus fees. Not actual unit prices."}
      </p>
    </Card>
  );
}

function encodeMix(m: SavedMix): string {
  const compact = { a: m.at, g: m.goal, s: m.schemeEn, h: m.holdings.map((h) => [h.id, Math.round(h.weight * 1000)]), l: m.levels ?? {} };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeMix(r: string | undefined): SavedMix | null {
  if (!r) return null;
  try {
    const json = decodeURIComponent(escape(atob(r.replace(/-/g, "+").replace(/_/g, "/"))));
    const c = JSON.parse(json) as { a: string; g: SavedMix["goal"]; s: string | null; h: [string, number][]; l: Record<string, number> };
    const holdings = c.h
      .map(([id, w]) => {
        const f = fundById(id);
        if (!f) return null;
        return {
          id,
          weight: w / 1000,
          nameZh: f.nameZh,
          nameEn: f.nameEn,
          bench: f.bench,
          beta: f.beta,
          fer: f.fer,
          ret1y: f.ret1y,
          cashLike: f.category === "money" || f.category === "guaranteed" || f.isConservative,
        };
      })
      .filter((h): h is NonNullable<typeof h> => h != null);
    if (!holdings.length || Number.isNaN(Date.parse(c.a))) return null;
    return { at: c.a, horizon: "6m", schemeEn: c.s, goal: c.g, holdings, levels: c.l };
  } catch {
    return null;
  }
}
