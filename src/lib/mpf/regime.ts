import type { MarketQuote, SwitchHorizon } from "./types";

export type MarketTone = "risk-on" | "mixed" | "risk-off";

export interface Regime {
  tone: MarketTone;
  windowLabelZh: string;
  sleeveFit: Record<string, number>;
  notesZh: string[];
  notesEn: string[];
}

const SPARK_POINTS: Record<SwitchHorizon, number> = {
  "1m": 4,
  "2m": 8,
  "6m": 24,
  "1y": 48,
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function windowMove(q: MarketQuote | undefined, horizon: SwitchHorizon): number | null {
  if (!q) return null;
  if (horizon === "1y" && q.ytdPct != null) return q.ytdPct;
  const spark = q.spark ?? [];
  const n = SPARK_POINTS[horizon];
  if (spark.length < n + 1) return q.ytdPct;
  const a = spark[spark.length - 1 - n];
  const b = spark[spark.length - 1];
  if (a == null || b == null || a === 0) return q.ytdPct;
  return ((b - a) / a) * 100;
}

function q(quotes: MarketQuote[], symbol: string) {
  return quotes.find((x) => x.symbol === symbol);
}

function avg(xs: Array<number | null>): number | null {
  const n = xs.filter((v): v is number => v != null && Number.isFinite(v));
  if (!n.length) return null;
  return n.reduce((s, v) => s + v, 0) / n.length;
}

function fitFromMove(move: number | null, scale = 14): number {
  if (move == null) return 0.5;
  return clamp01(0.5 + move / scale);
}

export function buildRegime(quotes: MarketQuote[], horizon: SwitchHorizon): Regime {
  const us = avg([windowMove(q(quotes, "^GSPC"), horizon), windowMove(q(quotes, "^IXIC"), horizon)]);
  const hk = windowMove(q(quotes, "^HSI"), horizon);
  const china = avg([windowMove(q(quotes, "^HSCE"), horizon), windowMove(q(quotes, "000300.SS"), horizon)]);
  const japan = windowMove(q(quotes, "^N225"), horizon);
  const korea = windowMove(q(quotes, "^KS11"), horizon);
  const tw = windowMove(q(quotes, "^TWII"), horizon);
  const eu = windowMove(q(quotes, "^STOXX50E"), horizon);
  const gold = windowMove(q(quotes, "GC=F"), horizon);
  const tnx = q(quotes, "^TNX");
  const yieldLevel = tnx?.price ?? null;
  const yieldMove = windowMove(tnx, horizon);
  const dollar = windowMove(q(quotes, "DX-Y.NYB"), horizon);
  const asia = avg([japan, tw, hk, korea == null ? null : Math.min(korea, 12)]);

  const riskPulse = avg([us, asia, eu]) ?? 0;
  const tone: MarketTone = riskPulse >= 4 ? "risk-on" : riskPulse <= -3 ? "risk-off" : "mixed";

  const short = horizon === "1m" || horizon === "2m";
  const koreaYtd = q(quotes, "^KS11")?.ytdPct ?? korea;
  let koreaFit = fitFromMove(korea, 18);
  if ((koreaYtd ?? 0) > 28 && (korea ?? 0) < 2) koreaFit = short ? 0.18 : 0.32;
  if ((korea ?? 0) < -8) koreaFit = Math.min(koreaFit, 0.28);

  let bondFit = 0.5;
  if (yieldMove != null) {
    bondFit = short ? clamp01(0.5 - yieldMove / 8) : clamp01(0.48 + ((yieldLevel ?? 4) - 3.5) / 8 - yieldMove / 16);
  }
  const cashFit = short && (yieldLevel ?? 0) >= 4.2 ? 0.72 : tone === "risk-off" ? 0.7 : 0.42;
  const usFit = fitFromMove(us, 12);
  const globalFit = fitFromMove(avg([us, eu]), 12);
  const hkFit = fitFromMove(avg([hk, china]), 16);
  const cnFit = fitFromMove(china, 16);

  const sleeveFit: Record<string, number> = {
    us: usFit,
    global: globalFit,
    japan: fitFromMove(japan, 14),
    korea: koreaFit,
    asia: fitFromMove(asia, 14),
    europe: fitFromMove(eu, 14),
    hk: hkFit,
    china: cnFit,
    "greater-china": hkFit,
    "hk-china": hkFit,
    healthcare: usFit * 0.9 + 0.05,
    esg: globalFit,
    em: fitFromMove(avg([korea, china, tw]), 16),
    "dis-caf": clamp01(0.55 * globalFit + 0.45 * bondFit),
    "dis-a65": clamp01(0.35 * globalFit + 0.65 * bondFit),
    "mixed-aggressive": clamp01(0.75 * usFit + 0.25 * asiaFitSafe(asia)),
    "mixed-growth": clamp01(0.65 * globalFit + 0.35 * bondFit),
    "mixed-balanced": clamp01(0.5 * globalFit + 0.5 * bondFit),
    "mixed-conservative": clamp01(0.3 * globalFit + 0.7 * Math.max(bondFit, cashFit)),
    "mixed-target": 0.55,
    "mixed-global": globalFit,
    "bond-global": bondFit,
    "bond-asia": clamp01(bondFit * 0.7 + fitFromMove(asia, 20) * 0.3),
    "bond-cn": cnFit * 0.4 + bondFit * 0.6,
    "bond-hk": bondFit,
    conservative: cashFit,
    money: cashFit,
    guaranteed: short ? 0.28 : 0.35,
  };

  const notesZh: string[] = [];
  const notesEn: string[] = [];
  const fmt = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
  const winZh = { "1m": "近一個月", "2m": "近兩個月", "6m": "近半年", "1y": "今年至今" }[horizon];
  const winEn = { "1m": "past month", "2m": "past 2 months", "6m": "past 6 months", "1y": "year to date" }[horizon];

  notesZh.push(`美股（標普／納指）${winZh} ${fmt(us)}。短線核心偏${(us ?? 0) >= 0 ? "美股／環球" : "減風險資產"}。`);
  notesEn.push(`US equities ${winEn} ${fmt(us)}.`);
  notesZh.push(`港股 ${fmt(hk)}、中國相關 ${fmt(china)}、日經 ${fmt(japan)}、韓股 ${fmt(korea)}、台股 ${fmt(tw)}。`);
  notesEn.push(`HK ${fmt(hk)}, China ${fmt(china)}, Japan ${fmt(japan)}, Korea ${fmt(korea)}, Taiwan ${fmt(tw)}.`);
  if ((koreaYtd ?? 0) > 28) {
    notesZh.push("韓股今年累積升幅大，短線不當核心，避免用一年回報追入。");
    notesEn.push("Korea’s YTD run is extreme — not a short-horizon core.");
  }
  if (yieldLevel != null) {
    notesZh.push(
      `美債 10 年約 ${yieldLevel.toFixed(2)}%，窗口內 ${fmt(yieldMove)}。${
        short
          ? yieldMove != null && yieldMove > 0
            ? "短線利率上行，債券基金宜輕、保守／貨幣較穩。"
            : "短線利率回落，債券壓力減。"
          : yieldLevel >= 4.2
            ? "一年視野：起始孳息不低，債券可作防守而非追逐股價。"
            : "一年視野：孳息一般，債券作分散。"
      }`,
    );
    notesEn.push(`US 10Y ~${yieldLevel.toFixed(2)}%, window ${fmt(yieldMove)}.`);
  }
  notesZh.push("指數局勢唔等於基金單位價。基金官方數字截至積金局 2026-08-31；呢度係轉換窗口推演，不是保證。");
  notesEn.push("Index regime is not fund NAV. Official fund figures as of MPFA 2026-08-31.");

  return { tone, windowLabelZh: winZh, sleeveFit, notesZh, notesEn };
}

function asiaFitSafe(asia: number | null) {
  return fitFromMove(asia, 14);
}

export const HORIZON_OPTS: SwitchHorizon[] = ["1m", "2m", "6m", "1y"];

export const HORIZON_COPY: Record<SwitchHorizon, { zh: string; en: string; blurbZh: string }> = {
  "1m": { zh: "1 個月", en: "1 month", blurbZh: "下次轉換約一個月內。局勢權重最高，少看一年基金回報。" },
  "2m": { zh: "2 個月", en: "2 months", blurbZh: "一至兩個月窗口。跟指數近況，仍守收費同風險。" },
  "6m": { zh: "半年", en: "6 months", blurbZh: "持有約半年。局勢同五年質素各半。" },
  "1y": { zh: "1 年", en: "1 year", blurbZh: "一年先再轉。少追近月升跌，重視收費同長線同類。" },
};

export function horizonWeights(horizon: SwitchHorizon, goal: string): {
  regime: number;
  risk: number;
  fee: number;
  skill: number;
  size: number;
} {
  if (goal === "dis") return { regime: 0.1, risk: 0.28, fee: 0.3, skill: 0.24, size: 0.08 };
  if (goal === "lowfee") return { regime: 0.14, risk: 0.2, fee: 0.46, skill: 0.14, size: 0.06 };
  if (goal === "preserve") return { regime: 0.22, risk: 0.3, fee: 0.28, skill: 0.12, size: 0.08 };
  const table: Record<SwitchHorizon, { regime: number; risk: number; fee: number; skill: number; size: number }> = {
    "1m": { regime: 0.5, risk: 0.18, fee: 0.18, skill: 0.08, size: 0.06 },
    "2m": { regime: 0.4, risk: 0.2, fee: 0.18, skill: 0.14, size: 0.08 },
    "6m": { regime: 0.28, risk: 0.22, fee: 0.2, skill: 0.22, size: 0.08 },
    "1y": { regime: 0.16, risk: 0.22, fee: 0.22, skill: 0.3, size: 0.1 },
  };
  const w = { ...table[horizon] };
  if (goal === "regime") {
    w.regime = Math.min(0.58, w.regime + 0.14);
    w.skill = Math.max(0.06, w.skill - 0.08);
    w.fee = Math.max(0.12, w.fee - 0.06);
  }
  if (goal === "growth" && (horizon === "1m" || horizon === "2m")) {
    w.regime = Math.min(0.55, w.regime + 0.05);
  }
  return w;
}
