import type { Allocation, Fund, GoalId, Profile, RiskAppetite, ScoredFund } from "./types";
import { allFunds, median } from "./catalog";

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

export function expectedReturn(fund: Fund): number {
  const prior = SLEEVE_PRIOR[fund.sleeve] ?? 5.5;
  const hist = fund.ret5y ?? fund.ret1y ?? prior;
  const cappedHist = Math.max(-2, Math.min(12, hist));
  const blended = 0.55 * prior + 0.45 * cappedHist;
  const ferDrag = fund.fer ?? 1.3;
  // Historical returns are already net of FER; prior is gross-ish. Blend then
  // shave a little extra for expensive funds so fee drag is visible going forward.
  const extraFee = Math.max(0, ferDrag - 0.8) * 0.25;
  return blended - extraFee;
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
    // Sep 2026: US still firm, Asia YTD strong but Korea/TW/JP cooling this week.
    // Prefer diversified US/global core, Asia as satellite, fade Korea chase.
    if (["us", "global", "dis-caf", "asia", "mixed-growth"].includes(sleeve)) return 0.92;
    if (["japan", "greater-china", "hk"].includes(sleeve)) return 0.62;
    if (sleeve === "korea") return 0.22;
    if (sleeve === "guaranteed") return 0.08;
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

export function scoreFunds(profile: Profile): ScoredFund[] {
  const target = targetRisk(profile);
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
    const tracker = fund.isTracker && profile.goal === "lowfee" ? 0.15 : fund.isTracker ? 0.05 : 0;
    const guarPenalty = fund.category === "guaranteed" && profile.goal !== "preserve" ? -0.18 : 0;
    const koreaPenalty = fund.sleeve === "korea" && profile.goal !== "growth" ? -0.08 : 0;

    let score =
      0.22 * rf +
      0.2 * fs +
      0.2 * sb +
      0.16 * skill +
      0.1 * size +
      0.07 * (fund.ret1y != null ? clamp01((fund.ret1y + 5) / 40) : 0.4) +
      tracker +
      guarPenalty +
      koreaPenalty;

    if (profile.goal === "dis" && (fund.isCaf || fund.isA65)) {
      const years = profile.retireAge - profile.age;
      if (years > 10 && fund.isCaf) score += 0.12;
      if (years <= 10 && fund.isA65) score += 0.12;
    }
    if (fund.fer != null && fund.fer <= 0.8) reasons.push("低收費");
    if (fund.isTracker) reasons.push("指數追蹤");
    if (fund.isDis) reasons.push("預設投資策略");
    if (skill > 0.65) reasons.push("五年同類領先");
    if (fund.sleeve === "us") reasons.push("美股核心");
    if (fund.sleeve === "korea") reasons.push("一年暴升、回吐風險高");
    if (fund.category === "guaranteed") reasons.push("保證成本高");

    return { fund, score, reasons, expectedReturn: expectedReturn(fund) };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export function buildAllocation(profile: Profile, top: ScoredFund[]): Allocation[] {
  const years = profile.retireAge - profile.age;
  const pick = (pred: (s: ScoredFund) => boolean) => top.find(pred);

  if (profile.goal === "dis") {
    const caf = pick((s) => s.fund.isCaf);
    const a65 = pick((s) => s.fund.isA65);
    if (caf && a65) {
      const cafW = years >= 15 ? 0.8 : years >= 5 ? 0.55 : 0.2;
      return [
        {
          fund: caf.fund,
          weight: cafW,
          reasonZh: "核心累積：60/40 股票債券，適合距離退休較遠。",
          reasonEn: "Core Accumulation 60/40 for longer horizons.",
        },
        {
          fund: a65.fund,
          weight: 1 - cafW,
          reasonZh: "65歲後基金：降低股票比例，收斂波動。",
          reasonEn: "Age 65 Plus de-risks toward bonds.",
        },
      ];
    }
  }

  const core = top[0];
  if (!core) return [];

  const diversify = top.filter((s) => s.fund.sleeve !== core.fund.sleeve).slice(0, 3);
  const satellite = diversify[0];
  const ballast =
    pick((s) => s.fund.isConservative || s.fund.sleeve === "dis-a65" || s.fund.category === "bond") ??
    diversify[1];

  if (profile.goal === "preserve") {
    const cash = pick((s) => s.fund.isConservative) ?? core;
    const bond = pick((s) => s.fund.category === "bond" && s.fund.id !== cash.fund.id);
    const mix = pick((s) => s.fund.sleeve === "mixed-conservative" || s.fund.isA65);
    const rows: Allocation[] = [
      {
        fund: cash.fund,
        weight: 0.5,
        reasonZh: "保守基金作底倉，本金波動最低。",
        reasonEn: "Conservative fund as capital base.",
      },
    ];
    if (bond)
      rows.push({
        fund: bond.fund,
        weight: 0.3,
        reasonZh: "債券分散利率與再投資風險。",
        reasonEn: "Bonds diversify reinvestment risk.",
      });
    if (mix)
      rows.push({
        fund: mix.fund,
        weight: 0.2,
        reasonZh: "少量混合資產保留通脹對沖。",
        reasonEn: "A small mixed-asset sleeve vs inflation.",
      });
    return normalize(rows);
  }

  const rows: Allocation[] = [
    {
      fund: core.fund,
      weight: years >= 15 ? 0.55 : 0.45,
      reasonZh: "按目標與風險評分最高的核心持倉。",
      reasonEn: "Highest-scoring core holding for your goal.",
    },
  ];
  if (satellite) {
    rows.push({
      fund: satellite.fund,
      weight: 0.3,
      reasonZh: "不同地區／資產類別，降低單一市場風險。",
      reasonEn: "Different region/asset class for diversification.",
    });
  }
  if (ballast && ballast.fund.id !== core.fund.id && ballast.fund.id !== satellite?.fund.id) {
    rows.push({
      fund: ballast.fund,
      weight: 0.2,
      reasonZh: "防守倉：保守／債券／65歲後，應付回撤。",
      reasonEn: "Defensive sleeve for drawdowns.",
    });
  }
  return normalize(rows);
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
    blurbZh: "法定收費上限、自動隨年齡降低風險，適合不想揀基金的人。",
  },
  regime: {
    zh: "因應現時局勢",
    en: "Current regime",
    blurbZh: "結合眼下市場（美股、亞洲供應鏈、利率）作核心＋衛星配置。",
  },
};

export const RISK_COPY: Record<RiskAppetite, { zh: string; en: string }> = {
  conservative: { zh: "保守", en: "Conservative" },
  moderate: { zh: "中性", en: "Moderate" },
  aggressive: { zh: "進取", en: "Aggressive" },
};
