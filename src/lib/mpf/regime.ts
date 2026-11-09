import type { MarketQuote, SwitchHorizon } from "./types";

export type MarketTone = "risk-on" | "mixed" | "risk-off";

export interface Regime {
  tone: MarketTone;
  windowLabelZh: string;
  lookbackLabelZh: string;
  outlookLabelZh: string;
  sleeveFit: Record<string, number>;
  lookbackZh: string[];
  lookbackEn: string[];
  outlookZh: string[];
  outlookEn: string[];
  notesZh: string[];
  notesEn: string[];
}

const SPARK_POINTS: Record<SwitchHorizon, number> = {
  "1m": 4,
  "3m": 13,
  "6m": 24,
  "1y": 48,
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function windowMove(quote: MarketQuote | undefined, horizon: SwitchHorizon): number | null {
  if (!quote) return null;
  if (horizon === "1y" && quote.ytdPct != null) return quote.ytdPct;
  const spark = quote.spark ?? [];
  const n = SPARK_POINTS[horizon];
  if (spark.length < n + 1) return quote.ytdPct;
  const a = spark[spark.length - 1 - n];
  const b = spark[spark.length - 1];
  if (a == null || b == null || a === 0) return quote.ytdPct;
  return ((b - a) / a) * 100;
}

function findQuote(quotes: MarketQuote[], symbol: string) {
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

function pos52(quote: MarketQuote | undefined): number | null {
  if (!quote?.price || quote.high52 == null || quote.low52 == null || quote.high52 <= quote.low52) return null;
  return clamp01((quote.price - quote.low52) / (quote.high52 - quote.low52));
}

/** Forward sleeve score: starting yield, 52-week stretch, relative lag — not “last period = next period”. */
function forwardFit(
  trailing: number,
  stretch: number | null,
  ytd: number | null,
  lagVsUs: number | null,
  horizon: SwitchHorizon,
): number {
  const s = stretch ?? 0.55;
  const overheat = Math.max(0, s - 0.86) * 1.6 + Math.max(0, (ytd ?? 0) - 28) / 90;
  const value = clamp01(0.5 + (0.55 - s) * 0.9);
  const lag = lagVsUs ?? 0;
  const lagBoost = horizon === "1y" ? lag * 0.016 : horizon === "6m" ? lag * 0.01 : horizon === "3m" ? lag * 0.006 : lag * 0.003;
  if (horizon === "1m") return clamp01(0.42 * trailing + 0.48 * (1 - s) + 0.1 * value - overheat + lagBoost);
  if (horizon === "3m") return clamp01(0.28 * trailing + 0.44 * (1 - s) + 0.28 * value - overheat + lagBoost);
  if (horizon === "6m") return clamp01(0.18 * trailing + 0.42 * value + 0.4 * 0.52 - overheat * 0.75 + lagBoost);
  return clamp01(0.1 * trailing + 0.5 * value + 0.4 * 0.52 - overheat * 0.55 + lagBoost);
}

function bondForward(yieldLevel: number | null, yieldMove: number | null, horizon: SwitchHorizon): number {
  const carry = yieldLevel != null ? clamp01((yieldLevel - 2.4) / 4.2) : 0.5;
  const duration = yieldMove != null ? clamp01(0.5 - yieldMove / 8) : 0.5;
  if (horizon === "1m") return duration;
  if (horizon === "3m") return clamp01(0.55 * duration + 0.45 * carry);
  if (horizon === "6m") return clamp01(0.45 * duration + 0.55 * carry);
  return clamp01(0.25 * duration + 0.75 * carry);
}

export function buildRegime(quotes: MarketQuote[], horizon: SwitchHorizon): Regime {
  const usQ = findQuote(quotes, "^GSPC");
  const ndxQ = findQuote(quotes, "^IXIC");
  const hsiQ = findQuote(quotes, "^HSI");
  const hsceQ = findQuote(quotes, "^HSCE");
  const csiQ = findQuote(quotes, "000300.SS");
  const n225Q = findQuote(quotes, "^N225");
  const kospiQ = findQuote(quotes, "^KS11");
  const twQ = findQuote(quotes, "^TWII");
  const euQ = findQuote(quotes, "^STOXX50E");
  const goldQ = findQuote(quotes, "GC=F");
  const tnx = findQuote(quotes, "^TNX");
  const dxyQ = findQuote(quotes, "DX-Y.NYB");

  const us = avg([windowMove(usQ, horizon), windowMove(ndxQ, horizon)]);
  const hk = windowMove(hsiQ, horizon);
  const china = avg([windowMove(hsceQ, horizon), windowMove(csiQ, horizon)]);
  const japan = windowMove(n225Q, horizon);
  const korea = windowMove(kospiQ, horizon);
  const tw = windowMove(twQ, horizon);
  const eu = windowMove(euQ, horizon);
  const gold = windowMove(goldQ, horizon);
  const dollar = windowMove(dxyQ, horizon);
  const yieldLevel = tnx?.price ?? null;
  const yieldMove = windowMove(tnx, horizon);
  const asia = avg([japan, tw, hk, korea == null ? null : Math.min(korea, 12)]);
  const usYtd = avg([usQ?.ytdPct ?? null, ndxQ?.ytdPct ?? null]);
  const koreaYtd = kospiQ?.ytdPct ?? korea;
  const hkYtd = hsiQ?.ytdPct ?? hk;

  const riskPulse = avg([us, asia, eu]) ?? 0;
  const tone: MarketTone = riskPulse >= 4 ? "risk-on" : riskPulse <= -3 ? "risk-off" : "mixed";
  const short = horizon === "1m" || horizon === "3m";

  const usStretch = avg([pos52(usQ), pos52(ndxQ)]);
  const hkStretch = pos52(hsiQ);
  const cnStretch = avg([pos52(hsceQ), pos52(csiQ)]);
  const jpStretch = pos52(n225Q);
  const krStretch = pos52(kospiQ);
  const twStretch = pos52(twQ);
  const euStretch = pos52(euQ);

  const lag = (region: number | null) => (us == null || region == null ? null : us - region);

  const usFwd = forwardFit(fitFromMove(us, 12), usStretch, usYtd, 0, horizon);
  const euFwd = forwardFit(fitFromMove(eu, 14), euStretch, euQ?.ytdPct ?? eu, lag(eu), horizon);
  const jpFwd = forwardFit(fitFromMove(japan, 14), jpStretch, n225Q?.ytdPct ?? japan, lag(japan), horizon);
  const hkFwd = forwardFit(fitFromMove(hk, 16), hkStretch, hkYtd, lag(hk), horizon);
  const cnFwd = forwardFit(fitFromMove(china, 16), cnStretch, avg([hsceQ?.ytdPct ?? null, csiQ?.ytdPct ?? null]), lag(china), horizon);
  let krFwd = forwardFit(fitFromMove(korea, 18), krStretch, koreaYtd, lag(korea), horizon);
  if ((koreaYtd ?? 0) > 28) krFwd = Math.min(krFwd, short ? 0.22 : 0.36);
  const twFwd = forwardFit(fitFromMove(tw, 14), twStretch, twQ?.ytdPct ?? tw, lag(tw), horizon);
  const asiaFwd = clamp01(avg([jpFwd, twFwd, hkFwd, Math.min(krFwd, 0.45)]) ?? 0.5);
  const globalFwd = clamp01(0.65 * usFwd + 0.35 * euFwd);
  const bondFwd = bondForward(yieldLevel, yieldMove, horizon);
  const equityHot = usStretch != null && usStretch > 0.88;
  const cashFwd = short && ((yieldLevel ?? 0) >= 4.2 || equityHot) ? 0.74 : tone === "risk-off" ? 0.68 : 0.4;

  const sleeveFit: Record<string, number> = {
    us: usFwd,
    global: globalFwd,
    japan: jpFwd,
    korea: krFwd,
    asia: asiaFwd,
    europe: euFwd,
    hk: hkFwd,
    china: cnFwd,
    "greater-china": clamp01(0.55 * hkFwd + 0.45 * cnFwd),
    "hk-china": clamp01(0.55 * hkFwd + 0.45 * cnFwd),
    healthcare: clamp01(usFwd * 0.9 + 0.05),
    esg: globalFwd,
    em: clamp01(avg([krFwd, cnFwd, twFwd]) ?? 0.5),
    "dis-caf": clamp01(0.55 * globalFwd + 0.45 * bondFwd),
    "dis-a65": clamp01(0.35 * globalFwd + 0.65 * bondFwd),
    "mixed-aggressive": clamp01(0.75 * usFwd + 0.25 * asiaFwd),
    "mixed-growth": clamp01(0.65 * globalFwd + 0.35 * bondFwd),
    "mixed-balanced": clamp01(0.5 * globalFwd + 0.5 * bondFwd),
    "mixed-conservative": clamp01(0.3 * globalFwd + 0.7 * Math.max(bondFwd, cashFwd)),
    "mixed-target": 0.55,
    "mixed-global": globalFwd,
    "bond-global": bondFwd,
    "bond-asia": clamp01(bondFwd * 0.7 + asiaFwd * 0.3),
    "bond-cn": cnFwd * 0.35 + bondFwd * 0.65,
    "bond-hk": bondFwd,
    conservative: cashFwd,
    money: cashFwd,
    guaranteed: short ? 0.26 : 0.34,
  };

  const fmt = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const lookbackLabelZh = { "1m": "近一個月", "3m": "近三個月", "6m": "近半年", "1y": "今年至今" }[horizon];
  const outlookLabelZh = { "1m": "未來一個月", "3m": "未來三個月", "6m": "未來半年", "1y": "未來一年" }[horizon];
  const lookEn = { "1m": "past month", "3m": "past 3 months", "6m": "past 6 months", "1y": "year to date" }[horizon];
  const outEn = { "1m": "next month", "3m": "next 3 months", "6m": "next 6 months", "1y": "next year" }[horizon];

  // 息率變動用點子（0.01 個百分點），唔用息率本身變咗幾多 %
  const yieldBp =
    yieldLevel != null && yieldMove != null ? Math.round((yieldLevel - yieldLevel / (1 + yieldMove / 100)) * 100) : null;
  const lookbackZh = [
    `美股（標普 500、納指）${lookbackLabelZh}${fmt(us)}；現在在過去一年最低和最高之間大約 ${pct(usStretch)} 的位置（100% 即是一年高位）。`,
    `港股 ${fmt(hk)}、中國相關 ${fmt(china)}、日本 ${fmt(japan)}、韓國 ${fmt(korea)}、台灣 ${fmt(tw)}。`,
    `美債 10 年息率 ${yieldLevel != null ? `${yieldLevel.toFixed(2)}%` : "—"}${yieldBp != null ? `，這段時間${yieldBp >= 0 ? "升" : "跌"}了 ${Math.abs(yieldBp)} 點子` : ""}；美元指數 ${fmt(dollar)}、金價 ${fmt(gold)}。`,
  ];
  const lookbackEn = [
    `US equities ${lookEn} ${fmt(us)}, ~${pct(usStretch)} of 52-week range.`,
    `HK ${fmt(hk)}, China ${fmt(china)}, Japan ${fmt(japan)}, Korea ${fmt(korea)}, Taiwan ${fmt(tw)}.`,
    `US 10Y ${yieldLevel != null ? `${yieldLevel.toFixed(2)}%` : "—"}, window ${fmt(yieldMove)}.`,
  ];

  const outlookZh: string[] = [];
  const outlookEn: string[] = [];
  outlookZh.push(
    usStretch != null && usStretch > 0.88
      ? `${outlookLabelZh}：美股接近一年高位，短期回落的機會較大。`
      : `${outlookLabelZh}：美股未見升得太急。`,
  );
  outlookEn.push(
    usStretch != null && usStretch > 0.88
      ? `${outEn}: US near 52-week highs; pull-back risk is higher.`
      : `${outEn}: US not stretched.`,
  );
  if ((koreaYtd ?? 0) > 28) {
    outlookZh.push(`${outlookLabelZh}：韓股今年升了很多，回落的機會較大。`);
    outlookEn.push(`${outEn}: Korea’s YTD run is large; pull-back risk is higher.`);
  }
  if (hk != null && us != null && hk + 6 < us) {
    outlookZh.push(`${outlookLabelZh}：港股這段時間跑輸美股，但不代表之後一定追回。`);
    outlookEn.push(`${outEn}: HK has lagged the US; that does not mean it will catch up.`);
  }
  if (yieldLevel != null) {
    outlookZh.push(
      short
        ? `${outlookLabelZh}：美債息率現在 ${yieldLevel.toFixed(2)}%${yieldMove != null && yieldMove > 0 ? "，近排仍上中" : ""}。短期內債券價格會和息率反方向變動；債券回報主要靠收息，不是靠估減息多少。`
        : `${outlookLabelZh}：債券之後的回報主要靠現在大約 ${yieldLevel.toFixed(2)}% 的息率。息率越高，持有一年收到的利息越穩定，不用估息口何時到頂。`,
    );
    outlookEn.push(`${outEn}: bond outlook starts from ${yieldLevel.toFixed(2)}% yield, not a rate call.`);
  }
  outlookZh.push("以上是用現在的息率、指數在一年高低位的位置，和有沒有升得太急來看，不是當過去就是將來。指數不是基金價格，亦不保證賺錢。");
  outlookEn.push("Outlook uses starting yield and 52-week stretch, not “past = future”. Not a profit guarantee.");

  return {
    tone,
    windowLabelZh: outlookLabelZh,
    lookbackLabelZh,
    outlookLabelZh,
    sleeveFit,
    lookbackZh,
    lookbackEn,
    outlookZh,
    outlookEn,
    notesZh: outlookZh,
    notesEn: outlookEn,
  };
}

export const HORIZON_OPTS: SwitchHorizon[] = ["1m", "3m", "6m", "1y"];

export const HORIZON_COPY: Record<SwitchHorizon, { zh: string; en: string; blurbZh: string }> = {
  "1m": { zh: "1 個月", en: "1 month", blurbZh: "一個月後可以回來對照今次參考配置。不保證這一個月會升。" },
  "3m": { zh: "3 個月", en: "3 months", blurbZh: "三個月後回來對照。不會用剛剛升得好急的基金做主力。" },
  "6m": { zh: "半年", en: "6 months", blurbZh: "半年後回來對照。主要看收費、債券息率和哪類基金落後了。" },
  "1y": { zh: "1 年", en: "1 year", blurbZh: "一年後回來對照。主要看收費、五年表現和債券息率。" },
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
    "3m": { regime: 0.36, risk: 0.2, fee: 0.18, skill: 0.18, size: 0.08 },
    "6m": { regime: 0.28, risk: 0.22, fee: 0.2, skill: 0.22, size: 0.08 },
    "1y": { regime: 0.16, risk: 0.22, fee: 0.22, skill: 0.3, size: 0.1 },
  };
  const w = { ...table[horizon] };
  if (goal === "growth" && (horizon === "1m" || horizon === "3m")) {
    w.regime = Math.min(0.55, w.regime + 0.05);
  }
  return w;
}
