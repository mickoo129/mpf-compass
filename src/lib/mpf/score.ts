import type { Allocation, Fund, GoalId, MixSize, Profile, ReviewCadence, RiskAppetite, ScoredFund } from "./types";
import { allFunds, median } from "./catalog";
import { HORIZON_COPY, horizonWeights, type Regime } from "./regime";

const SLEEVE_PRIOR: Record<string, number> = {
  us: 7.4,
  global: 7.0,
  japan: 6.2,
  asia: 6.8,
  korea: 5.2,
  hk: 6.0,
  china: 6.4,
  "greater-china": 6.4,
  "hk-china": 6.2,
  europe: 6.4,
  healthcare: 7.0,
  esg: 6.6,
  em: 6.5,
  "dis-caf": 6.0,
  "dis-a65": 3.6,
  "mixed-aggressive": 6.8,
  "mixed-growth": 6.1,
  "mixed-balanced": 5.1,
  "mixed-conservative": 3.7,
  "mixed-target": 5.4,
  "mixed-global": 5.6,
  "bond-global": 3.3,
  "bond-asia": 3.4,
  "bond-cn": 3.2,
  "bond-hk": 3.0,
  conservative: 2.8,
  money: 2.6,
  guaranteed: 1.4,
};

export function expectedReturn(fund: Fund, regime?: Regime | null, horizon?: Profile["switchHorizon"]): number {
  const prior = SLEEVE_PRIOR[fund.sleeve] ?? 5.5;
  const hist = fund.ret5y ?? fund.ret1y ?? prior;
  const cappedHist = Math.max(-2, Math.min(12, hist));
  const blended = 0.55 * prior + 0.45 * cappedHist;
  const ferDrag = fund.fer ?? 1.3;
  const extraFee = Math.max(0, ferDrag - 0.8) * 0.25;
  let out = blended - extraFee;
  if (regime) {
    const fit = regime.sleeveFit[fund.sleeve] ?? 0.5;
    const amp = horizon === "1m" ? 2.0 : horizon === "2m" ? 1.4 : horizon === "6m" ? 0.8 : 0.35;
    out += (fit - 0.5) * amp;
  }
  return out;
}

export function targetRisk(profile: Profile): number {
  const years = Math.max(0, profile.retireAge - profile.age);
  let t = 2;
  if (years >= 25) t = 6;
  else if (years >= 15) t = 5;
  else if (years >= 8) t = 4;
  else if (years >= 3) t = 3;
  if (profile.risk === "aggressive") t += 1;
  if (profile.risk === "conservative") t -= 1;
  if (profile.goal === "preserve") t -= 1;
  if (profile.goal === "growth") t += 1;
  return Math.max(1, Math.min(7, t));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
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

function sleeveBoost(sleeve: string, goal: GoalId, risk: RiskAppetite): number {
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
  if (goal === "regime") {
    return 0.5;
  }
  if (goal === "lowfee") {
    return 0.5;
  }
  // balanced
  if (["dis-caf", "mixed-balanced", "mixed-growth", "global", "us"].includes(sleeve)) return 0.85;
  if (sleeve === "korea" || sleeve === "guaranteed") return 0.25;
  if (risk === "conservative" && ["conservative", "dis-a65"].includes(sleeve)) return 0.8;
  return 0.55;
}

export function scoreFunds(profile: Profile, regime?: Regime | null): ScoredFund[] {
  const target = targetRisk(profile);
  const horizon = profile.switchHorizon ?? "6m";
  const w = horizonWeights(horizon, profile.goal);
  const universe = profile.account === "contribution" && profile.schemeEn
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
    const sb = sleeveBoost(fund.sleeve, profile.goal, profile.risk);
    const med = sleeveMed5.get(fund.sleeve);
    const skill = fund.ret5y != null && med != null
      ? clamp01(0.5 + (fund.ret5y - med) / 12)
      : 0.5;
    const aum = fund.aumM ?? 0;
    const size = aum >= 2000 ? 1 : aum >= 400 ? 0.75 : aum >= 80 ? 0.5 : 0.25;
    const tracker = fund.isTracker && profile.goal === "lowfee" ? 0.12 : fund.isTracker ? 0.04 : 0;
    const guarPenalty = fund.category === "guaranteed" && profile.goal !== "preserve" ? -0.16 : 0;
    const fit = regime?.sleeveFit[fund.sleeve] ?? 0.5;
    const regimeFit = clamp01(0.35 * sb + 0.65 * fit);

    let score =
      w.risk * rf +
      w.fee * fs +
      w.regime * regimeFit +
      w.skill * skill +
      w.size * size +
      tracker +
      guarPenalty;

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
    if (regime && fit <= 0.32) reasons.push("展望偏弱，不宜追入");
    if (fund.sleeve === "korea") reasons.push("一年升幅較大，短線不宜作為核心");
    if (fund.category === "guaranteed") reasons.push("保證成本高");

    return { fund, score, reasons, expectedReturn: expectedReturn(fund, regime, horizon) };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function resolvedMixSize(profile: Profile, universeCount: number): number {
  const cap = Math.max(1, Math.min(5, universeCount));
  const chosen = profile.mixSize ?? "auto";
  if (chosen !== "auto") return Math.min(chosen, cap);
  const years = profile.retireAge - profile.age;
  if (profile.goal === "dis") return Math.min(2, cap);
  if (profile.goal === "lowfee") return Math.min(2, cap);
  if (profile.goal === "preserve") return Math.min(years < 8 ? 2 : 3, cap);
  if (years < 5) return Math.min(2, cap);
  if (years >= 20 && (profile.risk === "aggressive" || profile.goal === "growth")) return Math.min(4, cap);
  return Math.min(3, cap);
}

export function resolvedReview(profile: Profile): {
  cadence: Exclude<ReviewCadence, "auto">;
  zh: string;
  en: string;
  labelZh: string;
  labelEn: string;
} {
  const years = profile.retireAge - profile.age;
  const copy = {
    quarter: {
      labelZh: "每季",
      labelEn: "Quarterly",
      zh: "距離提取較近，每季核對一次官方數據即可。不必每月轉換——積金局數字本身按月公布，轉換尚有時間差。",
      en: "Nearer withdrawal: check official data quarterly. Monthly switches add little; MPFA figures are monthly anyway.",
    },
    half: {
      labelZh: "每半年",
      labelEn: "Every 6 months",
      zh: "年期中等，半年檢討一次。除非轉職、計劃合併或收費大幅變動，否則維持配置。",
      en: "Mid-horizon: review twice a year. Hold the mix unless job, scheme or fee changes.",
    },
    year: {
      labelZh: "每年",
      labelEn: "Yearly",
      zh: "年期較長，一年檢討一次已足夠。每月轉換容易追趕近期表現；預設投資策略更會隨年齡自動調整風險。",
      en: "Long horizon: once a year is enough. Monthly switching chases noise; DIS already glides with age.",
    },
  } as const;
  const chosen = profile.reviewEvery ?? "auto";
  if (chosen !== "auto") return { cadence: chosen, ...copy[chosen] };
  if (profile.goal === "dis" || years >= 15) return { cadence: "year", ...copy.year };
  if (years < 8) return { cadence: "quarter", ...copy.quarter };
  return { cadence: "half", ...copy.half };
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
    const a65 = top.find((s) => s.fund.isA65);
    const dis: ScoredFund[] = [];
    if (n === 1) {
      const one = years > 10 ? caf ?? a65 : a65 ?? caf;
      if (one) dis.push(one);
    } else {
      if (caf) dis.push(caf);
      if (a65 && a65.fund.id !== caf?.fund.id) dis.push(a65);
    }
    if (dis.length >= n) return dis.slice(0, n);
    for (const s of top) {
      if (dis.length >= n) break;
      if (dis.some((x) => x.fund.id === s.fund.id)) continue;
      dis.push(s);
    }
    return dis;
  }

  const prefer = (s: ScoredFund) => {
    if (profile.goal === "preserve") {
      return (
        s.fund.isConservative ||
        s.fund.category === "bond" ||
        s.fund.isA65 ||
        s.fund.sleeve === "mixed-conservative" ||
        s.fund.category === "money"
      );
    }
    if (profile.goal === "lowfee") {
      return s.fund.isTracker || (s.fund.fer != null && s.fund.fer <= 0.85) || s.fund.isDis;
    }
    if (profile.goal === "growth") {
      return ["equity", "mixed"].includes(s.fund.category);
    }
    return true;
  };

  const out: ScoredFund[] = [];
  const usedIds = new Set<string>();
  const usedSleeves = new Set<string>();

  const take = (s: ScoredFund) => {
    out.push(s);
    usedIds.add(s.fund.id);
    usedSleeves.add(s.fund.sleeve);
  };

  const first = top.find((s) => prefer(s)) ?? top[0];
  if (first) take(first);

  for (const s of top) {
    if (out.length >= n) break;
    if (usedIds.has(s.fund.id) || usedSleeves.has(s.fund.sleeve)) continue;
    if (profile.goal === "preserve" && !prefer(s) && out.length < n - 1) continue;
    take(s);
  }
  for (const s of top) {
    if (out.length >= n) break;
    if (usedIds.has(s.fund.id) || usedSleeves.has(s.fund.sleeve)) continue;
    take(s);
  }
  for (const s of top) {
    if (out.length >= n) break;
    if (usedIds.has(s.fund.id)) continue;
    take(s);
  }
  return out;
}

function holdingReason(s: ScoredFund, i: number, n: number, profile: Profile): { zh: string; en: string } {
  const f = s.fund;
  if (f.isCaf) return { zh: "核心累積：約 60/40 股票債券，距離退休較遠時作主體。", en: "Core Accumulation ~60/40 for longer horizons." };
  if (f.isA65) return { zh: "65歲後基金：降低股票比例，收斂波動。", en: "Age 65 Plus de-risks toward bonds." };
  if (i === 0) {
    const win = HORIZON_COPY[profile.switchHorizon ?? "6m"].zh;
    return {
      zh: `核心：按「${win}」展望（利率、52 週位置、過熱），加上收費與風險，而非近半年或一年回報最高的一檔。`,
      en: "Core: forward outlook for your window (yield, stretch, overheat), plus fees and risk — not the hottest trailing return.",
    };
  }
  if (f.isConservative || f.category === "bond" || f.category === "money") {
    return { zh: "防守倉：降低回撤，應付臨近提取或市場波動。", en: "Defensive sleeve for drawdowns and nearer withdrawals." };
  }
  if (i === n - 1 && n >= 3) {
    return { zh: "衛星倉：補足核心未覆蓋的地區或資產類別。", en: "Satellite sleeve for a region or asset class the core omits." };
  }
  return { zh: "分散倉：與核心不同地區／類別，降低單一市場風險。", en: "Diversifier: different region or asset class than the core." };
}

export function buildAllocation(profile: Profile, top: ScoredFund[]): Allocation[] {
  if (profile.account === "contribution" && !profile.schemeEn) return [];
  const years = Math.max(0, profile.retireAge - profile.age);
  const n = resolvedMixSize(profile, top.length);
  const holdings = pickHoldings(top, n, profile);
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

export const GOAL_COPY: Record<GoalId, { zh: string; en: string; blurbZh: string }> = {
  growth: {
    zh: "進取增長",
    en: "Growth",
    blurbZh: "距離退休尚遠，追求長期資本增值，可承受較大波動。",
  },
  balanced: {
    zh: "穩健增值",
    en: "Balanced",
    blurbZh: "增長與防守並重，接近預設投資策略的風險水平。",
  },
  preserve: {
    zh: "保本為先",
    en: "Preserve",
    blurbZh: "臨近提取或厭惡虧損，優先穩定與流動性。",
  },
  lowfee: {
    zh: "低收費優先",
    en: "Low fee",
    blurbZh: "收費是你唯一可鎖定的拖累。優先指數基金與 DIS。",
  },
  dis: {
    zh: "跟隨預設策略",
    en: "Default (DIS)",
    blurbZh: "法定收費上限、隨年齡自動降低風險，適合不欲自行挑選基金的人士。",
  },
  regime: {
    zh: "因應轉換窗口局勢",
    en: "Window regime",
    blurbZh: "以指數近況推演所選的 1 個月／2 個月／半年／1 年窗口，減少追趕基金一年回報。",
  },
};

export const RISK_COPY: Record<RiskAppetite, { zh: string; en: string }> = {
  conservative: { zh: "保守", en: "Conservative" },
  moderate: { zh: "中性", en: "Moderate" },
  aggressive: { zh: "進取", en: "Aggressive" },
};

export const MIX_SIZE_OPTS: MixSize[] = ["auto", 1, 2, 3, 4, 5];
export const REVIEW_OPTS: ReviewCadence[] = ["auto", "quarter", "half", "year"];

export const MIX_SIZE_COPY: Record<MixSize, { zh: string; en: string }> = {
  auto: { zh: "自動", en: "Auto" },
  1: { zh: "1 檔", en: "1 fund" },
  2: { zh: "2 檔", en: "2 funds" },
  3: { zh: "3 檔", en: "3 funds" },
  4: { zh: "4 檔", en: "4 funds" },
  5: { zh: "5 檔", en: "5 funds" },
};

export const REVIEW_COPY: Record<ReviewCadence, { zh: string; en: string }> = {
  auto: { zh: "自動建議", en: "Suggested" },
  quarter: { zh: "每季", en: "Quarterly" },
  half: { zh: "每半年", en: "Every 6 months" },
  year: { zh: "每年", en: "Yearly" },
};

