import type { Allocation, Fund, GoalId, MixSize, Profile, ReviewCadence, RiskAppetite, ScoredFund } from "./types";
import { allFunds, fundRegion, median, REGION_LABEL, sameMemberClass } from "./catalog";
import { horizonWeights, type Regime } from "./regime";

// Long-run planning assumptions (% a year, before fees), set about 1 point below
// recent 10-year MPF medians so projections lean cautious.
const SLEEVE_PRIOR: Record<string, number> = {
  us: 6.5,
  global: 6.0,
  japan: 5.5,
  asia: 5.8,
  korea: 4.5,
  hk: 5.0,
  china: 5.4,
  "greater-china": 5.4,
  "hk-china": 5.2,
  europe: 5.4,
  healthcare: 6.0,
  esg: 5.6,
  em: 5.5,
  "dis-caf": 5.0,
  "dis-a65": 3.0,
  "mixed-aggressive": 5.8,
  "mixed-growth": 5.2,
  "mixed-balanced": 4.4,
  "mixed-conservative": 3.2,
  "mixed-target": 4.6,
  "mixed-global": 4.8,
  "bond-global": 3.0,
  "bond-asia": 3.1,
  "bond-cn": 2.9,
  "bond-hk": 2.7,
  conservative: 2.8,
  money: 2.6,
  guaranteed: 1.4,
};

/** Long-run planning assumption (% a year) for the fund's asset class. */
export function sleevePrior(fund: Fund): number {
  return SLEEVE_PRIOR[fund.sleeve] ?? 5.5;
}

export function expectedReturn(fund: Fund, regime?: Regime | null, horizon?: Profile["switchHorizon"]): number {
  const prior = SLEEVE_PRIOR[fund.sleeve] ?? 5.5;
  // Only a 5-year record (or 10-year) counts; a lone 1-year figure is too noisy and
  // let young funds with one hot year inflate the projection.
  const hist = fund.ret5y ?? fund.ret10y ?? prior;
  // Keep the fund's own record within ±2–4 points of its asset class so one strong
  // (or weak) five years cannot dominate a 30-year projection.
  const cappedHist = Math.max(prior - 4, Math.min(prior + 2, hist));
  const blended = 0.55 * prior + 0.45 * cappedHist;
  const ferDrag = fund.fer ?? 1.3;
  const extraFee = Math.max(0, ferDrag - 0.8) * 0.25;
  let out = blended - extraFee;
  if (regime) {
    const fit = regime.sleeveFit[fund.sleeve] ?? 0.5;
    const amp = horizon === "1m" ? 2.0 : horizon === "3m" ? 1.2 : horizon === "6m" ? 0.8 : 0.35;
    out += (fit - 0.5) * amp;
  }
  return out;
}

export function targetRisk(profile: Profile): number {
  const years = Math.max(0, profile.retireAge - profile.age);
  // Most diversified global/US equity funds sit at risk class 5; single-market
  // HK / China / Asia funds sit at 6. A long horizon alone should aim at 5,
  // otherwise risk-fit quietly pushes long-horizon members into one market.
  let t = 2;
  if (years >= 15) t = 5;
  else if (years >= 8) t = 4;
  else if (years >= 3) t = 3;
  if (profile.goal === "preserve") t -= 1;
  if (profile.goal === "growth") t += 1;
  // "Balanced" is described as close to DIS risk (Core Accumulation ≈ class 4).
  if (profile.goal === "balanced") t = Math.min(t, 4);
  return Math.max(1, Math.min(7, t));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Highest weighted risk class a mix may carry for this profile. An average of 3
 * (low volatility) is always acceptable, so very short horizons are not forced
 * into cash only.
 */
export function riskBudget(profile: Profile): number {
  return Math.max(3, targetRisk(profile) + 0.5);
}

function riskFit(fund: Fund, target: number): number {
  const r = fund.riskClass ?? 4;
  const dist = Math.abs(r - target);
  return clamp01(1 - dist / 4);
}

function feeScore(fer: number | null, goal: GoalId): number {
  if (fer == null) return 0.4;
  const base = clamp01((1.9 - fer) / 1.4);
  return goal === "lowfee" ? base : 0.65 * base + 0.35 * 0.6;
}

function sleeveBoost(sleeve: string, goal: GoalId): number {
  if (goal === "dis") {
    if (sleeve === "dis-caf" || sleeve === "dis-a65") return 1;
    return 0.15;
  }
  if (goal === "preserve") {
    if (["conservative", "dis-a65", "bond-global", "bond-hk", "mixed-conservative", "money"].includes(sleeve))
      return 0.9;
    if (sleeve === "guaranteed") return 0.45;
    if (["us", "korea", "china", "hk"].includes(sleeve)) return 0.15;
    return 0.4;
  }
  if (goal === "growth") {
    if (["us", "global", "asia", "mixed-aggressive", "mixed-growth", "japan"].includes(sleeve)) return 0.9;
    if (sleeve === "korea") return 0.35;
    if (["conservative", "guaranteed", "bond-global", "money"].includes(sleeve)) return 0.1;
    return 0.55;
  }
  if (goal === "lowfee") {
    return 0.5;
  }
  // balanced
  if (["dis-caf", "mixed-balanced", "mixed-growth", "global", "us"].includes(sleeve)) return 0.85;
  if (sleeve === "korea" || sleeve === "guaranteed") return 0.25;
  return 0.55;
}

export function scoreFunds(profile: Profile, regime?: Regime | null): ScoredFund[] {
  const target = targetRisk(profile);
  const horizon = profile.switchHorizon ?? "6m";
  const w = horizonWeights(horizon, profile.goal);
  const universe = profile.schemeEn
    ? allFunds.filter((f) => f.schemeEn === profile.schemeEn)
    : allFunds;

  const sleeveMed5 = new Map<string, number>();
  for (const sleeve of new Set(universe.map((f) => f.sleeve))) {
    const m = median(universe.filter((f) => f.sleeve === sleeve).map((f) => f.ret5y ?? NaN));
    if (m != null) sleeveMed5.set(sleeve, m);
  }

  const scored: ScoredFund[] = universe.map((fund) => {
    const reasons: string[] = [];
    const rf = riskFit(fund, target);
    const fs = feeScore(fund.fer, profile.goal);
    const sb = sleeveBoost(fund.sleeve, profile.goal);
    const med = sleeveMed5.get(fund.sleeve);
    const skill = fund.ret5y != null && med != null
      ? clamp01(0.5 + (fund.ret5y - med) / 12)
      : 0.5;
    const aum = fund.aumM ?? 0;
    const size = aum >= 2000 ? 1 : aum >= 400 ? 0.75 : aum >= 80 ? 0.5 : 0.25;
    const tracker = fund.isTracker && profile.goal === "lowfee" ? 0.12 : fund.isTracker ? 0.04 : 0;
    const guarPenalty = fund.category === "guaranteed" && profile.goal !== "preserve" ? -0.16 : 0;
    // Funds under five years old have no comparable track record yet.
    const youngPenalty = fund.ret5y == null && !fund.isDis ? -0.06 : 0;
    const fit = regime?.sleeveFit[fund.sleeve] ?? 0.5;
    const regimeFit = clamp01(0.35 * sb + 0.65 * fit);

    let score =
      w.risk * rf +
      w.fee * fs +
      w.regime * regimeFit +
      w.skill * skill +
      w.size * size +
      tracker +
      guarPenalty +
      youngPenalty;

    if (profile.goal === "dis" && (fund.isCaf || fund.isA65)) {
      const years = profile.retireAge - profile.age;
      if (years > 10 && fund.isCaf) score += 0.12;
      if (years <= 10 && fund.isA65) score += 0.12;
    }
    if (fund.fer != null && fund.fer <= 0.8) reasons.push("低收費");
    if (fund.isTracker) reasons.push("指數追蹤");
    if (fund.isDis) reasons.push("預設投資策略");
    if (horizon === "1y" && skill > 0.65) reasons.push("五年同類領先");
    if (regime && fit >= 0.62) reasons.push("展望偏有利");
    if (regime && fit <= 0.32) reasons.push("展望偏弱");
    if (fund.sleeve === "korea") reasons.push("一年升幅較大");
    if (fund.category === "guaranteed") reasons.push("保證成本高");
    if (fund.ret5y == null) reasons.push("成立未夠五年");

    return { fund, score, reasons, expectedReturn: expectedReturn(fund, regime, horizon) };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function resolvedMixSize(profile: Profile, universeCount: number): number {
  const cap = Math.max(1, Math.min(5, universeCount));
  const chosen = profile.mixSize ?? "auto";
  // DIS is by definition Core Accumulation and/or Age 65 Plus.
  if (profile.goal === "dis") return Math.min(chosen === 1 ? 1 : 2, cap);
  if (chosen !== "auto") return Math.min(chosen, cap);
  const years = profile.retireAge - profile.age;
  if (profile.goal === "lowfee") return Math.min(2, cap);
  if (profile.goal === "preserve") return Math.min(years < 8 ? 2 : 3, cap);
  if (years < 5) return Math.min(2, cap);
  if (years >= 20 && profile.goal === "growth") return Math.min(4, cap);
  return Math.min(3, cap);
}

export function resolvedReview(profile: Profile): {
  cadence: Exclude<ReviewCadence, "auto">;
  zh: string;
  en: string;
  labelZh: string;
  labelEn: string;
} {
  const copy = {
    month: {
      labelZh: "一個月後",
      labelEn: "In 1 month",
      zh: "一個月後可以返嚟對照今次參考配置。積金局數字按月公布，一個月內未必已更新。",
      en: "Come back in a month to compare with this mix. Official NAVs are monthly.",
    },
    quarter: {
      labelZh: "三個月後",
      labelEn: "In 3 months",
      zh: "三個月後返嚟對照。中間唔使因為短期升跌而轉。",
      en: "Come back in a quarter. Do not switch on short-term noise.",
    },
    half: {
      labelZh: "半年後",
      labelEn: "In 6 months",
      zh: "半年後返嚟對照。除非轉工、計劃合併或者收費大變，否則唔使郁。",
      en: "Come back in six months. Hold unless job, scheme or fee changes.",
    },
    year: {
      labelZh: "一年後",
      labelEn: "In 1 year",
      zh: "一年後返嚟對照。月月轉好易變成高追。",
      en: "Come back in a year. Monthly switching chases noise.",
    },
  } as const;
  const chosen = profile.reviewEvery ?? "auto";
  if (chosen !== "auto") return { cadence: chosen, ...copy[chosen] };
  const fromHorizon = { "1m": "month", "3m": "quarter", "6m": "half", "1y": "year" } as const;
  const cadence = fromHorizon[profile.switchHorizon ?? "6m"];
  return { cadence, ...copy[cadence] };
}

function weightsFor(n: number, years: number): number[] {
  if (n <= 1) return [1];
  if (n === 2) return years >= 15 ? [0.7, 0.3] : [0.6, 0.4];
  if (n === 3) return years >= 15 ? [0.5, 0.3, 0.2] : [0.4, 0.35, 0.25];
  if (n === 4) return [0.4, 0.25, 0.2, 0.15];
  return [0.32, 0.24, 0.18, 0.14, 0.12];
}

function pickHoldings(top: ScoredFund[], n: number, profile: Profile): ScoredFund[] {
  const years = profile.retireAge - profile.age;
  if (profile.goal === "dis") {
    const caf = top.find((s) => s.fund.isCaf);
    const a65 = top.find((s) => s.fund.isA65 && (!caf || sameMemberClass(caf.fund, s.fund)));
    const dis: ScoredFund[] = [];
    if (n === 1) {
      const one = years > 10 ? caf ?? a65 : a65 ?? caf;
      if (one) dis.push(one);
    } else {
      if (caf) dis.push(caf);
      if (a65 && a65.fund.id !== caf?.fund.id) dis.push(a65);
    }
    if (dis.length >= n) return dis.slice(0, n);
    // DIS is exactly these two funds; nothing else is added.
    return dis;
  }

  // The core holding is chosen by the goal, not by the market view: someone who
  // picks 穩健 must see a balanced fund as the core, whatever is cheap or lagging
  // this month. Market outlook only influences the smaller satellite holdings.
  const core = pickCore(top, profile);

  const out: ScoredFund[] = [];
  const usedIds = new Set<string>();
  const usedSleeves = new Set<string>();
  const usedRegions = new Set<string>();
  const take = (s: ScoredFund) => {
    out.push(s);
    usedIds.add(s.fund.id);
    usedSleeves.add(s.fund.sleeve);
    const region = fundRegion(s.fund);
    if (region !== "multi") usedRegions.add(region);
  };
  // "hk", "hk-china", "china" and "greater-china" are different sleeves but the
  // same market risk; a diversifier must add a different region.
  const sameMarket = (s: ScoredFund) => {
    const region = fundRegion(s.fund);
    if (region === "multi") return false;
    if (usedRegions.has(region)) return true;
    const chinaBloc = ["hk", "china", "greater-china"];
    return chinaBloc.includes(region) && chinaBloc.some((r) => usedRegions.has(r));
  };
  // A member holds one unit class, so every holding must be compatible with the others.
  const sameClass = (s: ScoredFund) => out.every((o) => sameMemberClass(o.fund, s.fund));
  const allowed = (s: ScoredFund) => satelliteAllowed(s.fund, profile) && sameClass(s);

  if (core) take(core);
  // Never break the goal's rules just to reach the requested number of funds:
  // a small scheme may simply offer fewer suitable funds.
  const passes: ((s: ScoredFund) => boolean)[] = [
    (s) => allowed(s) && !usedSleeves.has(s.fund.sleeve) && !sameMarket(s),
    (s) => allowed(s) && !usedSleeves.has(s.fund.sleeve),
    (s) => allowed(s),
  ];
  for (const ok of passes) {
    for (const s of top) {
      if (out.length >= n) break;
      if (usedIds.has(s.fund.id) || !ok(s)) continue;
      take(s);
    }
  }

  // Keep the whole mix inside the goal's risk budget: swap the riskiest satellite
  // for the next allowed, lower-risk candidate until the weighted risk fits.
  const cap = riskBudget(profile);
  const mixRisk = () => {
    const w = weightsFor(out.length, Math.max(0, years));
    return out.reduce((sum, s, i) => sum + (w[i] ?? 0) * (s.fund.riskClass ?? 4), 0);
  };
  const defensive = (f: Fund) =>
    f.isA65 || f.isConservative || f.category === "bond" || f.category === "money" || f.sleeve === "mixed-conservative";
  for (let guard = 0; guard < 12 && mixRisk() > cap + 1e-9 && out.length > 1; guard++) {
    let worst = 1;
    for (let i = 2; i < out.length; i++) {
      if ((out[i]!.fund.riskClass ?? 4) > (out[worst]!.fund.riskClass ?? 4)) worst = i;
    }
    const current = out[worst]!.fund.riskClass ?? 4;
    const others = out.filter((_, i) => i !== worst);
    const fits = (s: ScoredFund) =>
      !out.some((o) => o.fund.id === s.fund.id) &&
      others.every((o) => sameMemberClass(o.fund, s.fund)) &&
      (s.fund.riskClass ?? 4) < current;
    // Prefer a fund that suits the goal; if none is calmer, a defensive fund is
    // always acceptable as ballast (e.g. a "growth" member two years from retiring).
    const replacement = top.find((s) => fits(s) && satelliteAllowed(s.fund, profile)) ?? top.find((s) => fits(s) && defensive(s.fund));
    if (!replacement) break;
    out[worst] = replacement;
  }
  // Still over (a small scheme with few calm funds): hold fewer funds rather than
  // keep a satellite that pushes the mix past its budget.
  while (out.length > 2 && mixRisk() > cap + 1e-9) {
    let worst = 1;
    for (let i = 2; i < out.length; i++) {
      if ((out[i]!.fund.riskClass ?? 4) >= (out[worst]!.fund.riskClass ?? 4)) worst = i;
    }
    out.splice(worst, 1);
  }
  return out;
}

const CORE_SLEEVES: Record<Exclude<GoalId, "dis">, { long: string[]; short: string[] }> = {
  growth: {
    long: ["global", "mixed-aggressive", "mixed-growth", "dis-caf", "mixed-target"],
    short: ["mixed-growth", "dis-caf", "mixed-balanced"],
  },
  balanced: {
    long: ["dis-caf", "mixed-balanced", "mixed-growth"],
    short: ["mixed-balanced", "dis-caf", "mixed-conservative", "dis-a65"],
  },
  preserve: {
    long: ["dis-a65", "mixed-conservative", "bond-global", "bond-hk", "bond-asia"],
    short: ["conservative", "money", "dis-a65", "bond-hk"],
  },
  lowfee: {
    long: ["dis-caf", "global", "us"],
    short: ["dis-caf", "dis-a65"],
  },
};

/** Best-scoring fund among the asset classes that suit the goal as a main holding. */
function pickCore(top: ScoredFund[], profile: Profile): ScoredFund | undefined {
  if (profile.goal === "dis") return top[0];
  const years = profile.retireAge - profile.age;
  // Within three years of retiring the main holding is defensive whatever the goal;
  // the page already warns when the goal and the horizon do not fit.
  const sleeves = years < 3 ? CORE_SLEEVES.preserve.short : CORE_SLEEVES[profile.goal][years >= 10 ? "long" : "short"];
  const eligible = top.filter((s) => {
    if (!sleeves.includes(s.fund.sleeve)) return false;
    // A low-fee core must actually be cheap: DIS or an index tracker.
    if (profile.goal === "lowfee" && years >= 3) return s.fund.isDis || s.fund.isTracker;
    return true;
  });
  // Prefer a core that already fits the risk budget (matters close to retirement).
  const cap = riskBudget(profile);
  const calm = eligible.filter((s) => (s.fund.riskClass ?? 4) <= cap);
  return calm[0] ?? eligible[0] ?? top.find((s) => satelliteAllowed(s.fund, profile)) ?? top[0];
}

/** Whether a fund may sit beside the core for this goal. */
function satelliteAllowed(fund: Fund, profile: Profile): boolean {
  const cashLike = fund.category === "money" || fund.category === "guaranteed" || fund.isConservative;
  switch (profile.goal) {
    case "preserve":
      return cashLike || fund.category === "bond" || fund.isA65 || fund.isCaf || fund.sleeve === "mixed-conservative" || fund.sleeve === "mixed-balanced";
    case "growth":
      return fund.category === "equity" || fund.category === "mixed";
    case "lowfee":
      return fund.isTracker || fund.isDis || (fund.fer != null && fund.fer <= 0.85);
    case "balanced":
      return fund.category !== "guaranteed" && fund.sleeve !== "korea";
    default:
      return true;
  }
}

function holdingReason(s: ScoredFund, i: number, _n: number, profile: Profile): { zh: string; en: string } {
  const f = s.fund;
  const goalZh = GOAL_COPY[profile.goal].zh;
  const region = fundRegion(f);
  if (i === 0) {
    if (f.isCaf) return { zh: `核心：核心累積基金，約六成環球股票、四成債券，收費有法定上限，配合「${goalZh}」。`, en: "Core: Core Accumulation, about 60/40 global shares and bonds with a fee cap." };
    if (f.isA65) return { zh: `核心：65歲後基金，約兩成股票、八成債券，波動較細，配合「${goalZh}」。`, en: "Core: Age 65 Plus, about 20/80 shares and bonds." };
    if (f.category === "mixed") return { zh: `核心：股票同債券混合，一隻基金已經分散多個市場，配合「${goalZh}」。`, en: "Core: a mixed fund already spread across markets." };
    if (f.category === "equity") return { zh: `核心：${f.isTracker ? "跟蹤指數嘅" : ""}${REGION_LABEL[region].zh}股票基金，配合「${goalZh}」嘅長線增長。`, en: `Core: ${REGION_LABEL[region].en} equity for long-run growth.` };
    return { zh: `核心：波動較低，配合「${goalZh}」。`, en: "Core: lower volatility to fit the goal." };
  }
  if (f.isCaf) return { zh: "配搭：核心累積基金，加入環球股票同債券。", en: "Adds global shares and bonds via Core Accumulation." };
  if (f.isA65) return { zh: "防守：65歲後基金，債券為主，減低整體波動。", en: "Defensive: Age 65 Plus, mostly bonds." };
  if (f.isConservative || f.category === "bond" || f.category === "money") {
    return { zh: "防守：債券／保守基金，減低整體波動。", en: "Defensive: bonds or cash to steady the mix." };
  }
  if (f.category === "equity") {
    return { zh: `分散：加入${REGION_LABEL[region].zh}股票${f.isTracker ? "（指數基金，收費較低）" : ""}。`, en: `Diversifier: adds ${REGION_LABEL[region].en} equity.` };
  }
  return { zh: "配搭：另一隻混合資產基金，分散基金經理同比例。", en: "Adds a second mixed fund for manager diversification." };
}

/**
 * A member holds one account in one scheme, so every fund in a mix must come
 * from the same scheme. With no scheme locked (a personal account that may
 * transfer), build the best mix inside each scheme and keep the strongest.
 */
function pickWithinOneScheme(profile: Profile, top: ScoredFund[]): ScoredFund[] {
  const years = Math.max(0, profile.retireAge - profile.age);
  if (profile.schemeEn) {
    return pickHoldings(top, resolvedMixSize(profile, top.length), profile);
  }
  const byScheme = new Map<string, ScoredFund[]>();
  for (const s of top) {
    // Employer-sponsored and industry schemes only take their own employees /
    // industry workers, so a member cannot transfer a personal account into them.
    if (/employer sponsored|industry/i.test(s.fund.schemeEn)) continue;
    const arr = byScheme.get(s.fund.schemeEn) ?? [];
    arr.push(s);
    byScheme.set(s.fund.schemeEn, arr);
  }
  let best: ScoredFund[] = [];
  let bestScore = -Infinity;
  for (const ranked of byScheme.values()) {
    const n = resolvedMixSize(profile, ranked.length);
    const picks = pickHoldings(ranked, n, profile);
    if (picks.length < Math.min(n, 2)) continue;
    const w = weightsFor(picks.length, years);
    const score = picks.reduce((sum, p, i) => sum + p.score * (w[i] ?? 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = picks;
    }
  }
  return best;
}

export function buildAllocation(profile: Profile, top: ScoredFund[]): Allocation[] {
  if (profile.account === "contribution" && !profile.schemeEn) return [];
  const years = Math.max(0, profile.retireAge - profile.age);
  const holdings = pickWithinOneScheme(profile, top);
  if (!holdings.length) return [];

  if (profile.goal === "dis" && holdings.length === 2 && holdings[0]?.fund.isCaf && holdings[1]?.fund.isA65) {
    const cafW = years >= 15 ? 0.8 : years >= 5 ? 0.55 : 0.2;
    return normalize([
      { fund: holdings[0].fund, weight: cafW, reasonZh: holdingReason(holdings[0], 0, 2, profile).zh, reasonEn: holdingReason(holdings[0], 0, 2, profile).en },
      { fund: holdings[1].fund, weight: 1 - cafW, reasonZh: holdingReason(holdings[1], 1, 2, profile).zh, reasonEn: holdingReason(holdings[1], 1, 2, profile).en },
    ]);
  }

  const w = weightsFor(holdings.length, years);
  return normalize(
    holdings.map((s, i) => {
      const why = holdingReason(s, i, holdings.length, profile);
      return { fund: s.fund, weight: w[i] ?? 1 / holdings.length, reasonZh: why.zh, reasonEn: why.en };
    }),
  );
}

function normalize(rows: Allocation[]): Allocation[] {
  const sum = rows.reduce((s, r) => s + r.weight, 0) || 1;
  return rows.map((r) => ({ ...r, weight: r.weight / sum }));
}

export const GOAL_COPY: Record<GoalId, { zh: string; en: string; blurbZh: string; blurbEn: string }> = {
  growth: {
    zh: "進取增長",
    en: "Growth",
    blurbZh: "離退休仲有好耐，想長線增長，接受到大上大落。",
    blurbEn: "Long horizon, capital growth, larger swings accepted.",
  },
  balanced: {
    zh: "穩健增值",
    en: "Balanced",
    blurbZh: "想增長又唔想太大上落，風險同預設投資策略差唔多。",
    blurbEn: "Growth and defence together, near DIS risk.",
  },
  preserve: {
    zh: "保本為先",
    en: "Preserve",
    blurbZh: "就快要攞錢，或者好怕蝕，穩陣行先。",
    blurbEn: "Near withdrawal or loss-averse: stability first.",
  },
  lowfee: {
    zh: "低收費優先",
    en: "Low fee",
    blurbZh: "收費係唯一你控制到嘅嘢。優先揀指數基金同預設投資策略基金。",
    blurbEn: "Fees are the drag you can lock. Prefer trackers and DIS.",
  },
  dis: {
    zh: "跟隨預設策略",
    en: "Default (DIS)",
    blurbZh: "收費有法定上限，年紀越大自動越保守，啱唔想自己揀基金嘅人。",
    blurbEn: "Fee cap and an age glidepath if you do not want to pick funds.",
  },
};

export const RISK_COPY: Record<RiskAppetite, { zh: string; en: string }> = {
  conservative: { zh: "保守", en: "Conservative" },
  moderate: { zh: "中性", en: "Moderate" },
  aggressive: { zh: "進取", en: "Aggressive" },
};

export const MIX_SIZE_OPTS: MixSize[] = ["auto", 1, 2, 3, 4, 5];
export const REVIEW_OPTS: ReviewCadence[] = ["auto", "month", "quarter", "half", "year"];

export const MIX_SIZE_COPY: Record<MixSize, { zh: string; en: string }> = {
  auto: { zh: "自動", en: "Auto" },
  1: { zh: "1 隻", en: "1 fund" },
  2: { zh: "2 隻", en: "2 funds" },
  3: { zh: "3 隻", en: "3 funds" },
  4: { zh: "4 隻", en: "4 funds" },
  5: { zh: "5 隻", en: "5 funds" },
};

export const REVIEW_COPY: Record<ReviewCadence, { zh: string; en: string }> = {
  auto: { zh: "跟上面揀嘅時間", en: "Follow window" },
  month: { zh: "一個月", en: "1 month" },
  quarter: { zh: "三個月", en: "3 months" },
  half: { zh: "半年", en: "6 months" },
  year: { zh: "一年", en: "1 year" },
};

export function compareSavedMix(
  saved: { holdings: { id: string }[] } | null,
  next: Allocation[],
  ranked: ScoredFund[],
): { status: "none" | "keep" | "adjust"; alertsZh: string[]; alertsEn: string[] } {
  if (!saved?.holdings.length || !next.length) {
    return { status: "none", alertsZh: [], alertsEn: [] };
  }
  const prevIds = saved.holdings.map((h) => h.id);
  const nextIds = next.map((a) => a.fund.id);
  const same = prevIds.length === nextIds.length && prevIds.every((id, i) => id === nextIds[i]);
  const alertsZh: string[] = [];
  const alertsEn: string[] = [];

  for (const a of next) {
    const row = ranked.find((s) => s.fund.id === a.fund.id);
    if (row?.reasons.includes("展望偏弱")) {
      alertsZh.push(`${a.fund.nameZh}：展望偏弱。`);
      alertsEn.push(`${a.fund.nameEn}: outlook is weak.`);
    }
  }

  const added = next.filter((a) => !prevIds.includes(a.fund.id));
  const dropped = prevIds.filter((id) => !nextIds.includes(id));
  if (dropped.length || added.length) {
    const addNames = added.map((a) => a.fund.nameZh).join("、");
    alertsZh.push(
      added.length
        ? `今次評分／展望同上次唔同${addNames ? `，新入選：${addNames}` : ""}。`
        : "今次評分／展望已變，部分先前持倉不再列入。",
    );
    alertsEn.push("Scores or outlook changed; the mix was adjusted.");
  }

  if (same && !alertsZh.length) {
    return {
      status: "keep",
      alertsZh: ["同上次一樣。評分同展望未見明顯更高分嘅同類選擇。"],
      alertsEn: ["Same mix. No stronger replacement — hold."],
    };
  }
  if (same) return { status: "keep", alertsZh, alertsEn };
  return { status: "adjust", alertsZh: alertsZh.length ? alertsZh : ["今次排序同上次唔同，可以對照下面嘅參考配置。"], alertsEn };
}


export type Suitability = { level: "warn" | "note"; zh: string; en: string };

/**
 * Plain-language checks on whether the chosen goal fits the member's age and
 * horizon. They never block the page; the member can still read the mix.
 */
export function suitabilityChecks(profile: Profile): Suitability[] {
  const years = Math.max(0, profile.retireAge - profile.age);
  const out: Suitability[] = [];
  const equity2022 = median(allFunds.filter((f) => f.category === "equity").map((f) => f.y2022 ?? NaN));
  const drop = equity2022 != null && equity2022 < 0 ? Math.abs(equity2022).toFixed(0) : null;

  if (profile.goal === "growth" && years < 10) {
    out.push({
      level: "warn",
      zh: `你距離退休約 ${years} 年，進取組合未必適合。${drop ? `以 2022 年為例，股票基金中位數一年跌咗約 ${drop}%；` : ""}臨近提取時遇上跌市，可能冇足夠時間等市況回復。你仍然可以睇呢個配置，但請考慮「穩健增值」或「跟隨預設策略」。`,
      en: `About ${years} years to retirement: a growth mix may not fit.${drop ? ` In 2022 the median equity fund fell about ${drop}%.` : ""} A fall close to withdrawal leaves little time to recover. Consider Balanced or DIS.`,
    });
  } else if (profile.goal === "balanced" && years < 5) {
    out.push({
      level: "note",
      zh: `你距離退休約 ${years} 年。穩健組合仍有一定股票比例，如打算退休時一筆過提取，可考慮「保本為先」或「跟隨預設策略」（65歲後基金）。`,
      en: `About ${years} years to retirement. A balanced mix still holds equities; if you plan a lump-sum withdrawal, consider Preserve or DIS.`,
    });
  }
  if (profile.goal === "preserve" && years >= 20) {
    out.push({
      level: "note",
      zh: `你距離退休仲有約 ${years} 年。長期全放保守類基金，回報可能追唔上通脹。如果係因為怕短期波動，可以考慮「跟隨預設策略」，佢會隨年齡自動降低風險。`,
      en: `About ${years} years to go. Staying fully conservative that long may trail inflation. DIS de-risks automatically with age.`,
    });
  }
  if (profile.switchHorizon === "1m" || profile.switchHorizon === "3m") {
    out.push({
      level: "note",
      zh: "強積金轉換基金通常需時數個工作日，期間資金唔喺市場入面，短線轉換未必追到升幅。短期回顧冇問題，但頻密轉換未必有利。",
      en: "An MPF switch usually takes several working days out of the market, so short-term switching often misses the move.",
    });
  }
  return out;
}

/** English labels for the short reason badges. */
export const REASON_EN: Record<string, string> = {
  低收費: "Low fee",
  指數追蹤: "Index",
  預設投資策略: "DIS",
  五年同類領先: "5Y peer leader",
  展望偏有利: "Outlook favourable",
  展望偏弱: "Outlook weak",
  一年升幅較大: "Big 1-year run",
  保證成本高: "Costly guarantee",
  成立未夠五年: "Under 5 years old",
};
