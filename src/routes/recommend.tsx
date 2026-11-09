import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { decodeSettings, encodeSettings } from "@/lib/mpf/settings-link";
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
import { useShareLink } from "@/components/layout/mk-standard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { IntField, MoneyField } from "@/components/ui/number-field";
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
import { fmtAxisHkd, fmtHkd, fmtPctPlain } from "@/lib/mpf/format";
import { projectScenarios, scenarioRates } from "@/lib/mpf/forecast";
import { buildRegime, HORIZON_COPY } from "@/lib/mpf/regime";
import { buildAllocation, compareSavedMix, GOAL_COPY, MIX_SIZE_COPY, MIX_SIZE_OPTS, resolvedMixSize, resolvedReview, REVIEW_COPY, REVIEW_OPTS, expectedReturn, REASON_EN, riskBudget, scoreFunds, sleevePrior, suitabilityChecks, targetRisk } from "@/lib/mpf/score";
import type { GoalId } from "@/lib/mpf/types";
import { getMarkets } from "@/lib/server/markets";
import { useAppStore } from "@/lib/store";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

type RecommendSearch = { scheme?: string; r?: string; p?: string };


export const Route = createFileRoute("/recommend")({
  // ?scheme=<schemeEn> lets a scheme page (or an adviser's WhatsApp link) open 智選 locked to one scheme.
  validateSearch: (raw: Record<string, unknown>): RecommendSearch =>
    ({
      scheme: typeof raw.scheme === "string" && raw.scheme ? raw.scheme : undefined,
      r: typeof raw.r === "string" && raw.r ? raw.r : undefined,
      p: typeof raw.p === "string" && raw.p ? raw.p : undefined,
    }),
  head: ({ match }) => {
    const { r } = match.search as RecommendSearch;
    const saved = decodeMix(r);
    return {
      meta: seo(
        saved
          ? {
              title: `強積金參考配置（${saved.at.slice(0, 10)}）`,
              description: `${saved.holdings.map((h) => `${Math.round(h.weight * 100)}% ${h.nameZh}`).join("、")}。打開可看至今大約升跌。研究用途，並非投資建議。`,
              path: "/recommend",
            }
          : { title: "智選參考配置", description: "按年齡和風險取向，在你的計劃內篩選 2–5 隻基金，計及收費和至退休滾存。研究用途，並非投資建議。", path: "/recommend" },
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
    const settings = decodeSettings(search.p);
    const scheme = search.scheme && schemes.some((s) => s.en === search.scheme) ? search.scheme : null;
    if (settings) {
      // A shared 方案: same settings; the scheme is only locked if it was locked when shared.
      setProfile({ ...settings, schemeEn: scheme });
    } else if (scheme) {
      setProfile({ account: "contribution", schemeEn: scheme });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.scheme, search.p]);
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
  const overBudget = alloc.length > 0 && profile.goal !== "dis" && mixRisk > riskBudget(profile) + 1e-6;
  const rates = scenarioRates(assumedTotal || 4, mixRisk);
  const path = useMemo(
    () => projectScenarios(projBalance, projMonthly, years, rates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projBalance, projMonthly, years, rates.low, rates.mid, rates.high],
  );
  const end = path.at(-1);
  // Alternatives the member could actually switch to: same scheme as the mix,
  // not already in it, and within one risk class of the goal.
  const others = useMemo(() => {
    const scheme = alloc[0]?.fund.schemeEn;
    const target = targetRisk(profile);
    return ranked
      .filter(
        (s) =>
          s.fund.schemeEn === scheme &&
          !alloc.some((a) => a.fund.id === s.fund.id) &&
          Math.abs((s.fund.riskClass ?? 4) - target) <= 1,
      )
      .slice(0, 6);
  }, [ranked, alloc, profile]);
  const mixSize = profile.mixSize ?? "auto";
  const reviewEvery = profile.reviewEvery ?? "auto";
  const mixN = resolvedMixSize(profile, ranked.length);
  const review = resolvedReview(profile);
  const checks = useMemo(() => suitabilityChecks(profile), [profile]);
  const warns = checks.filter((c) => c.level === "warn");
  const [advanced, setAdvanced] = useState(
    () => profile.mixSize !== "auto" || profile.reviewEvery !== "auto",
  );

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

  // 分享呢個方案：連結包括計劃、目標、年齡同配置（?scheme=&r=），撳開會重現；唔包姓名。
  // 分享嗰陣順手記錄配置，下次返嚟就見到「至今大約升跌」。
  function mixUrl(): string {
    const url = new URL("/recommend", window.location.origin);
    if (profile.schemeEn) url.searchParams.set("scheme", profile.schemeEn);
    url.searchParams.set("p", encodeSettings(profile));
    const saved = buildSaved();
    saveMix(saved);
    url.searchParams.set("r", encodeMix(saved));
    return url.toString();
  }
  useShareLink(alloc.length ? mixUrl : null);

  // On a phone the inputs sit below the results. While they fill the screen the
  // sticky button offers the way back up instead of the way down.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const el = document.getElementById("inputs");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const io = new IntersectionObserver(([e]) => setEditing(!wide.matches && !!e?.isIntersecting), { rootMargin: "-45% 0px -45% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div>
      <PageTitle
        kicker={zh ? "智選配置" : "Goal-based mix"}
        title={zh ? "按你的年齡和風險取向，計好全部。" : "A mix for your age and risk appetite."}
        subtitle={zh ? "結果在下面。想改年齡、目標或計劃就按「修改條件」，改完按「看結果」回到上方。研究用途，並非投資建議。" : "Results below; tap Edit to change inputs. Research only, not advice."}
      />
      {/* 列印版：一行說清楚客人情況（不印輸入欄） */}
      <p className="mb-3 hidden rounded-lg border border-black/15 bg-white p-3 text-sm text-fg print:block">
        <b>{zh ? "客人情況：" : "Client: "}</b>
        {zh
          ? [
              `${profile.age} 歲`,
              `預計 ${profile.retireAge} 歲退休`,
              `目標「${GOAL_COPY[profile.goal].zh}」`,
              profile.account === "contribution" ? "供款帳戶" : "個人帳戶",
              profile.schemeEn ? `只選「${schemes.find((x) => x.en === profile.schemeEn)?.zh ?? profile.schemeEn}」的基金` : "全港計劃比較",
              profile.balance > 0 ? `結餘 $${profile.balance.toLocaleString("en-HK")}` : "",
              profile.monthly > 0 ? `每月供款 $${profile.monthly.toLocaleString("en-HK")}` : "",
              `${HORIZON_COPY[horizon].zh}後再看`,
            ]
              .filter(Boolean)
              .join("、")
          : `Age ${profile.age}, retire at ${profile.retireAge}, goal ${GOAL_COPY[profile.goal].en}`}
      </p>
      <div className="sticky top-[var(--mk-head-h)] z-30 -mx-4 mb-5 flex print:hidden items-center gap-2 border-b border-white/10 bg-[#0E5E57]/95 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <p className="min-w-0 flex-1 truncate text-sm text-white">
          {zh
            ? `${profile.age} 歲 · ${GOAL_COPY[profile.goal].zh} · ${profile.schemeEn ? (schemes.find((x) => x.en === profile.schemeEn)?.zh ?? "") : "全港計劃"} · 每${HORIZON_COPY[horizon].zh}再看`
            : `Age ${profile.age} · ${GOAL_COPY[profile.goal].en} · ${profile.schemeEn ?? "all schemes"}`}
        </p>
        <Button asChild size="sm" variant="outline" className="shrink-0 whitespace-nowrap">
          {editing ? <a href="#mix">{zh ? "看結果" : "See result"}</a> : <a href="#inputs">{zh ? "修改條件" : "Edit"}</a>}
        </Button>
      </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div id="inputs" className="order-2 min-w-0 scroll-mt-40 space-y-5 lg:order-1 lg:col-span-5 print:hidden">
          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "你的情況" : "Your situation"}</h2>
            <p className="mb-4 text-xs text-subtle">
              {zh
                ? "每次開都是由 35 歲、65 歲退休、結餘 0、每月供款 0 開始，不會記住上一位的數字。"
                : "Each visit starts at age 35, retirement 65, zero balance and zero monthly contribution. Nothing here is saved for the next person."}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={zh ? "年齡" : "Age"}>
                <div className="flex items-center gap-3">
                  <Slider min={18} max={64} value={[profile.age]} onValueChange={([v]) => setProfile({ age: v ?? 35 })} />
                  <IntField value={profile.age} min={18} max={64} onCommit={(n) => setProfile({ age: n })} aria-label={zh ? "年齡" : "Age"} className="h-9 w-14 shrink-0 px-2 text-center" />
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
                  <IntField
                    value={profile.retireAge}
                    min={50}
                    max={70}
                    onCommit={(n) => setProfile({ retireAge: n })}
                    aria-label={zh ? "預計退休年齡" : "Retire age"}
                    className="h-9 w-14 shrink-0 px-2 text-center"
                  />
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
                  sub={zh ? "只可以選僱主計劃內的基金" : "Employer scheme only"}
                />
                <Choice
                  active={profile.account === "personal"}
                  onClick={() => setProfile({ account: "personal", schemeEn: null })}
                  title={zh ? "個人帳戶" : "Personal"}
                  sub={zh ? "可以轉去其他計劃" : "Can transfer"}
                />
              </div>
            </div>
            {profile.account === "contribution" ? (
              <div className="mt-4">
                <Label>{zh ? "你現在的計劃（只在這個計劃選基金）" : "Current scheme (funds from this scheme only)"}</Label>
                <select
                  className="mt-2 h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg border border-border focus:border-primary focus:outline-none [color-scheme:light]"
                  value={profile.schemeEn ?? ""}
                  onChange={(e) => setProfile({ schemeEn: e.target.value || null })}
                >
                  <option value="">{zh ? "請選擇計劃，例如只有宏利戶口" : "Select scheme, e.g. Manulife only"}</option>
                  {schemes.map((s) => (
                    <option key={s.en} value={s.en}>
                      {zh ? s.zh : s.en}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-subtle">
                  {zh ? "供款帳戶通常只可以在僱主計劃內轉基金。選了計劃才會顯示配置。" : "Contribution accounts switch inside the employer scheme."}
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <Label>{zh ? "只在這個計劃選基金（可以不選）" : "Limit to one scheme (optional)"}</Label>
                <select
                  className="mt-2 h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg border border-border focus:border-primary focus:outline-none [color-scheme:light]"
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
                  {zh ? "個人帳戶可以轉到其他計劃。如果你只想留在一間（例如宏利），在這裡選擇該計劃。" : "Personal accounts can transfer. Lock a scheme if you only hold one trustee."}
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
              <Label>{zh ? "多久之後再看一次" : "Switch window"}</Label>
              <p className="mt-1 text-xs text-subtle">
                {zh
                  ? "選多久，下面就會顯示這段時間一般會上落多少，到時回來對照。"
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
                {advanced ? (zh ? "收起更多選項" : "Hide advanced") : zh ? "更多選項：基金數目和多久檢討一次" : "Advanced: mix size and review"}
              </button>
            </div>
            {advanced ? (
              <>
            <div className="mt-4">
              <Label>{zh ? "配置基金數目" : "How many funds"}</Label>
              <p className="mt-1 text-xs text-subtle">
                {zh
                  ? mixSize === "auto"
                    ? `按你的目標和距離退休多久，自動用 ${mixN} 隻基金。你都可以自己改。`
                    : `你選了 ${mixN} 隻。如果計劃內合適用的基金不足，會自動減少。`
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
              <Label>{zh ? "多久檢討一次" : "Review cadence"}</Label>
              <p className="mt-1 text-xs text-subtle">
                {zh
                  ? "強積金不用月月轉。積金局每月才公布一次數字，轉得太密很容易變成高追。"
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

        <div id="mix" className="order-1 min-w-0 scroll-mt-40 space-y-5 lg:order-2 lg:col-span-7">
          <Card>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
              <h2 className="font-display text-xl">{zh ? "參考配置" : "Reference mix"}</h2>
              <p className="text-xs text-subtle">
                {zh
                  ? `${profile.schemeEn ? schemes.find((s) => s.en === profile.schemeEn)?.zh ?? "已選計劃" : `全港比較後最佳計劃：${alloc[0]?.fund.schemeZh ?? "—"}`} · 共 ${alloc.length} 隻基金 · 距離退休 ${years} 年`
                  : `${profile.schemeEn ? schemes.find((s) => s.en === profile.schemeEn)?.en ?? "scheme" : `best scheme across HK: ${alloc[0]?.fund.schemeEn ?? "—"}`} · ${alloc.length} funds · ${years}y`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-subtle print:hidden">
                {zh
                  ? "按收費、風險、五年同類表現和市況選出；怎樣計可以參考下面「怎樣選出來？」。配置會跟每日市況微調，隔幾日再開可能不同；想之後對照，就按下面「記錄配置」，或頁頂「分享」保留今次結果。"
                  : `Count follows goal and years to retirement (balanced + long horizon usually 3). Not a guarantee the window will be profitable.`}
              </p>
              </div>
            </div>
            {alloc.length ? (
              <p className="mb-3 rounded-md bg-tint-mint px-3 py-2 text-sm">
                {zh ? "這個配置平均開支比率 " : "Weighted FER "}
                <b className="font-mono">{fmtPctPlain(mixFer(alloc))}</b>
                {zh ? "，即是大約 " : ", about "}
                <FeeAmount fer={mixFer(alloc)} zh={zh} className="font-mono font-medium" />
                {profile.balance > 0 ? null : (
                  <span className="block text-xs text-muted print:hidden">{zh ? "在「你的情況」填上結餘，就會用你自己的金額計。" : "Enter your balance to see your own amount."}</span>
                )}
              </p>
            ) : null}
            {overBudget ? (
              <p className="mb-3 rounded-lg border border-warn/40 bg-tint-sand p-3 text-xs text-fg" role="alert">
                {zh
                  ? `這個計劃可以選的基金風險級別普遍偏高，配置的平均風險（${mixRisk.toFixed(1)}）高於「${GOAL_COPY[profile.goal].zh}」一般的水平。可以考慮加大保守基金的比例。`
                  : `This scheme's funds carry high risk classes; the mix averages ${mixRisk.toFixed(1)}, above what this goal usually targets.`}
              </p>
            ) : null}
            {warns.length ? (
              <div className="mb-3 rounded-lg border border-warn/40 bg-tint-sand p-3 text-sm text-fg" role="alert">
                <p className="mb-1 font-medium text-warn">{zh ? "請留意：目標與年期未必配合" : "Check: goal and horizon may not fit"}</p>
                {warns.map((w) => (
                  <p key={w.en} className="text-xs text-muted">{zh ? w.zh : w.en}</p>
                ))}
              </div>
            ) : null}
            {profile.account === "contribution" && !profile.schemeEn ? (
              <p className="text-sm text-warn">{zh ? "請先選你現在的計劃，才可以在你可轉換的基金內選。" : "Pick your scheme to constrain the opportunity set."}</p>
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
              title={zh ? "這個配置可能升跌多少（歷史估算）" : "How much this mix might move (historical)"}
            />
          ) : null}

          {lastMix && since ? (
            <SinceCard since={since} savedAt={lastMix.at} balance={profile.balance} zh={zh} />
          ) : null}

          {showCompare && comparison.status !== "none" ? (
            <Card className={comparison.status === "adjust" ? "bg-tint-sand" : "bg-tint-mint"}>
              <h2 className="mb-1 font-display text-lg">{zh ? "與上次比較" : "Versus last mix"}</h2>
              <p className="text-xs text-subtle">
                {zh
                  ? `上次 ${lastMix ? lastMix.at.slice(0, 10) : ""} · ${comparison.status === "keep" ? "排序沒有變" : "排序有變"}`
                  : `Saved ${lastMix ? lastMix.at.slice(0, 10) : ""} · ${comparison.status}`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                {(zh ? comparison.alertsZh : comparison.alertsEn).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-subtle">
                {zh
                  ? "上面的升跌只是估算，不應該單憑升跌決定轉換。排序有變通常是因為展望轉弱，或同類出現更高分、更低收費的選擇。"
                  : "No daily NAVs, so there is no +X% / −X% switch trigger. Alerts are a weaker outlook or a clearly better-scoring, cheaper peer."}
              </p>
            </Card>
          ) : null}

          <Card className="print:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg">{zh ? `${review.labelZh}回來對照` : `Compare again: ${review.labelEn}`}</h2>
                <p className="text-xs text-muted">
                  {lastMix
                    ? zh
                      ? `已記錄 ${lastMix.at.slice(0, 10)} 的配置，到時會顯示大約升跌多少。`
                      : `Saved ${lastMix.at.slice(0, 10)}; the move since then will show here.`
                    : zh
                      ? "記錄今次配置，到時就見到大約升跌了多少（指數估算）。"
                      : "Save this mix to see roughly how it moved (index estimate)."}
                </p>
              </div>
              <Button className="shrink-0 whitespace-nowrap" variant="outline" size="sm" disabled={!alloc.length} onClick={() => saveMix(buildSaved())}>
                {lastMix ? (zh ? "重新記錄" : "Save again") : zh ? "記錄配置" : "Save mix"}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "至退休的假設滾存" : "Illustrative path to retirement"}</h2>
            {usingExample ? (
              <p className="mb-2 rounded-md bg-tint-sand px-3 py-2 text-xs text-fg">
                {zh
                  ? (
                      <>
                        {`示例：未填資料，暫時以結餘 ${fmtHkd(EXAMPLE_BALANCE)}、每月供款 ${fmtHkd(EXAMPLE_MONTHLY)} 計。`}
                        <span className="print:hidden">在上面「你的情況」填入自己的數字就會即時更新。</span>
                      </>
                    )
                  : `Example: nothing entered, so this uses a ${fmtHkd(EXAMPLE_BALANCE)} balance and ${fmtHkd(EXAMPLE_MONTHLY)} a month. Enter your own figures above to update.`}
              </p>
            ) : null}
            <p className="mb-3 text-xs text-subtle">
              {zh
                ? `假設長期持有這個配置直至退休（${years} 年），連每月供款一起滾存。三條線是三個平均年回報假設，不是預測；中途上落可以看上面「可能升跌範圍」。`
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
                    width={56}
                    tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                    tickFormatter={(v: number) => fmtAxisHkd(v, zh)}
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
              <details className="mt-3 rounded-md bg-tint-sky px-3 py-2 text-xs text-muted print:hidden">
                <summary className="cursor-pointer text-fg">
                  {zh ? `「中間」${assumedTotal.toFixed(1)}% 怎樣計？` : `How is the middle ${assumedTotal.toFixed(1)}% worked out?`}
                </summary>
                <p className="mt-2">
                  {zh
                    ? "每隻基金：55% 用該類資產的長期規劃假設，45% 用該基金積金局五年年化回報（最多比類別假設高 2%、低 4%；不足以五年的基金就全用類別假設），再扣開支比率高於 0.8% 的部分（每高 1% 扣 0.25%）。然後按配置比例加權。"
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
                    ? `類別長期假設是本工具的規劃數字（例如美股 6.5%、核心累積 5.0%、環球債券 3.0%），刻意定得比近十年強積金中位數低大約 1%，不是積金局數字，亦不是保證。「保守」和「樂觀」再按配置風險上下調 ${(rates.mid - rates.low).toFixed(1)}%。`
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
                    ? `當中供款本金約 ${fmtHkd(projBalance + projMonthly * 12 * years)}。平均年回報每差 1%，${years} 年後結果可以相差很遠，所以不要只看中間那個數。`
                    : `Contributions ≈ ${fmtHkd(projBalance + projMonthly * 12 * years)}. A 1-point difference in average return compounds a lot over ${years} years.`}
                </p>
              </div>
            ) : null}
          </Card>

          <details className="group rounded-xl bg-card p-4 text-fg shadow-[var(--shadow-border)] sm:p-5 print:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="font-display text-lg">{zh ? "怎樣選出來？" : "How was this picked?"}</span>
                <span className="block text-xs text-muted">{zh ? "用甚麼數字、怎樣計分、現在市況如何看" : "Scoring rule and market outlook"}</span>
              </span>
              <span className="shrink-0 text-xs whitespace-nowrap text-primary group-open:hidden">{zh ? "展開" : "Show"}</span>
            </summary>
            <div className="mt-4 space-y-5">
      <div>
        <h2 className="mb-1 font-display text-lg">{zh ? "個配置點來" : "Where the mix comes from"}</h2>
        <p className="mb-3 text-sm text-muted">
          {zh
            ? "這個不是積金局或受託人的官方建議，亦不代表一定賺錢。配置是按一套固定規則計算出來：先看你的目標，再用積金局的長線數字，最後用最新指數避免高追。"
            : "This is not an MPFA or trustee allocation, and not a profit forecast. The mix is a published rule: your goal, MPFA long-horizon figures, then live indices to avoid chasing heat."}
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>{zh ? "你：目標、打算多久之後再看、你的計劃有甚麼基金可以選。" : "You: goal, switch window, and the scheme menu you can actually use."}</li>
          <li>{zh ? `積金局（截至 ${catalogMeta.asOf}）：收費、風險級別、五年同類表現，用來看基金收費高不高、風險合適不合適、在同類內有沒有落後。` : `MPFA (as of ${catalogMeta.asOf}): fees, risk class, 5-year peer standing — whether a fund is costly, too risky, or lagging its group.`}</li>
          <li>{zh ? "Yahoo 指數（每次開頁更新）：現在債券息率、指數離一年高位多遠、有沒有升得太急，用來微調比例，不會當過去半年就是將來。" : "Yahoo indices (refresh on load): starting yield, 52-week stretch, overheat — a tilt, not “past = future”."}</li>
        </ol>
      </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg">{zh ? "這段時間：已經發生了甚麼、之後如何看" : "Window: lookback / outlook"}</h2>
              <Badge tone="primary">{zh ? regime.outlookLabelZh : horizon}</Badge>
            </div>
            <p className="mb-3 text-xs text-muted">
              {zh
                ? `Yahoo 指數，每次開頁更新${markets.data?.fetchedAt ? `（${markets.data.fetchedAt.slice(0, 16).replace("T", " ")} UTC）` : ""}。左邊是這段時間已經發生的走勢；右邊是按規則看之後同一段時間（息率、離一年高位多遠、有沒有升得太急），不是預測一定升。`
                : `Yahoo indices as of page load. Left = what already happened in the window; right = a rule-based tilt, not a forecast.`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/80 p-3">
                <p className="mb-1 text-xs font-medium tracking-wide text-subtle uppercase">
                  {zh ? `已經發生：${regime.lookbackLabelZh}` : "Lookback"}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                  {(zh ? regime.lookbackZh : regime.lookbackEn).map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-[var(--shadow-border)]">
                <p className="mb-1 text-xs font-medium tracking-wide text-primary uppercase">
                  {zh ? `之後點看：${regime.outlookLabelZh}` : "Outlook"}
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

          <Card className="print:hidden">
            <h2 className="mb-3 font-display text-lg">{zh ? "同一計劃內，其他評分較高的基金" : "Other well-scored funds in the same scheme"}</h2>
            <ul className="space-y-2 text-sm">
              {others.map((s, i) => (
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
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                      {zh ? "5年年化" : "5Y p.a."}
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
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-subtle">$</span>
      <MoneyField value={value} onChange={onChange} placeholder="0" className="pl-7" />
    </span>
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
      <h2 className="mb-1 font-display text-lg">{zh ? "上次記錄的配置，至今大約" : "Since your saved mix (est.)"}</h2>
      <p className="text-xs text-muted">
        {zh ? `${savedAt.slice(0, 10)} 記錄 · 過了 ${since.days} 日` : `Saved ${savedAt.slice(0, 10)} · ${since.days} days ago`}
      </p>
      {since.days < 1 ? (
        <p className="mt-2 text-sm text-muted">{zh ? "今日先記錄，一段時間後回來就會見到升跌估算。" : "Saved today. Come back later to see the estimate."}</p>
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
          ? "估算方法：積金局每月才公布基金回報，所以用每隻基金對應的市場指數（混合及債券部分用美債息變化）由記錄當日計到今日，再扣開支比率。不是基金實際單位價，可能和你戶口有出入。"
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
