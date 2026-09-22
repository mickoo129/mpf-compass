import raw from "@/data/funds.json";
import type { CatalogFile, CatalogMeta, Fund, FundCategory } from "./types";
import { annReturn, calendar3yAnn, MEDIAN_PERIODS, type AnnPeriod, type MedianPeriod } from "./returns";

const file = raw as CatalogFile;

export const catalogMeta: CatalogMeta = file.meta;
export const allFunds: Fund[] = file.funds;

export const CATEGORY_ORDER: FundCategory[] = [
  "equity",
  "mixed",
  "bond",
  "money",
  "guaranteed",
];

export const SLEEVE_LABEL: Record<string, { zh: string; en: string }> = {
  korea: { zh: "韓國股票", en: "Korea equity" },
  japan: { zh: "日本股票", en: "Japan equity" },
  us: { zh: "美國股票", en: "US equity" },
  europe: { zh: "歐洲股票", en: "Europe equity" },
  greater: { zh: "大中華股票", en: "Greater China" },
  "greater-china": { zh: "大中華股票", en: "Greater China" },
  "hk-china": { zh: "香港／中國股票", en: "HK & China" },
  hk: { zh: "香港股票", en: "Hong Kong equity" },
  china: { zh: "中國股票", en: "China equity" },
  asia: { zh: "亞洲股票", en: "Asia equity" },
  em: { zh: "新興市場", en: "Emerging markets" },
  healthcare: { zh: "醫療主題", en: "Healthcare" },
  esg: { zh: "綠色／ESG", en: "ESG / green" },
  global: { zh: "環球股票", en: "Global equity" },
  "dis-caf": { zh: "核心累積（DIS）", en: "Core Accumulation (DIS)" },
  "dis-a65": { zh: "65歲後（DIS）", en: "Age 65 Plus (DIS)" },
  conservative: { zh: "強積金保守", en: "MPF Conservative" },
  guaranteed: { zh: "保證基金", en: "Guaranteed" },
  "bond-cn": { zh: "人民幣債券", en: "RMB bond" },
  "bond-asia": { zh: "亞洲債券", en: "Asia bond" },
  "bond-hk": { zh: "港元債券", en: "HKD bond" },
  "bond-global": { zh: "環球債券", en: "Global bond" },
  money: { zh: "貨幣市場", en: "Money market" },
  "mixed-conservative": { zh: "保守混合", en: "Conservative mixed" },
  "mixed-balanced": { zh: "均衡混合", en: "Balanced mixed" },
  "mixed-growth": { zh: "增長混合", en: "Growth mixed" },
  "mixed-aggressive": { zh: "積極混合", en: "Aggressive mixed" },
  "mixed-target": { zh: "目標日期", en: "Target date" },
  "mixed-global": { zh: "混合資產", en: "Mixed assets" },
};

export const FER_LABEL = { zh: "開支比率", en: "Expense ratio" };
export const FER_SHORT = { zh: "開支", en: "FER" };

export const CATEGORY_LABEL: Record<FundCategory, { zh: string; en: string }> = {
  equity: { zh: "股票", en: "Equity" },
  mixed: { zh: "混合資產", en: "Mixed assets" },
  bond: { zh: "債券", en: "Bond" },
  money: { zh: "貨幣市場", en: "Money market" },
  guaranteed: { zh: "保證", en: "Guaranteed" },
};

export type RegionId =
  | "hk"
  | "china"
  | "greater-china"
  | "asia"
  | "us"
  | "japan"
  | "korea"
  | "europe"
  | "global"
  | "multi";

export const REGION_ORDER: RegionId[] = [
  "hk",
  "china",
  "greater-china",
  "asia",
  "us",
  "japan",
  "korea",
  "europe",
  "global",
  "multi",
];

export const REGION_LABEL: Record<RegionId, { zh: string; en: string }> = {
  hk: { zh: "香港", en: "Hong Kong" },
  china: { zh: "中國", en: "China" },
  "greater-china": { zh: "大中華", en: "Greater China" },
  asia: { zh: "亞洲", en: "Asia" },
  us: { zh: "美國", en: "United States" },
  japan: { zh: "日本", en: "Japan" },
  korea: { zh: "韓國", en: "Korea" },
  europe: { zh: "歐洲", en: "Europe" },
  global: { zh: "環球", en: "Global" },
  multi: { zh: "多元／配置", en: "Multi-asset" },
};

export function fundRegion(fund: Fund): RegionId {
  switch (fund.sleeve) {
    case "hk":
    case "bond-hk":
      return "hk";
    case "china":
    case "bond-cn":
      return "china";
    case "greater-china":
    case "hk-china":
      return "greater-china";
    case "asia":
    case "bond-asia":
      return "asia";
    case "us":
      return "us";
    case "japan":
      return "japan";
    case "korea":
      return "korea";
    case "europe":
      return "europe";
    case "global":
    case "bond-global":
    case "esg":
    case "healthcare":
    case "em":
      return "global";
    default:
      return "multi";
  }
}

export type ThemeId = "dis" | "tracker" | "healthcare" | "esg" | "target" | "conservative" | "guaranteed";

export const THEME_ORDER: ThemeId[] = ["dis", "tracker", "healthcare", "esg", "target", "conservative", "guaranteed"];

export const THEME_LABEL: Record<ThemeId, { zh: string; en: string }> = {
  dis: { zh: "預設投資（DIS）", en: "Default (DIS)" },
  tracker: { zh: "指數追蹤", en: "Index tracking" },
  healthcare: { zh: "醫療", en: "Healthcare" },
  esg: { zh: "綠色／ESG", en: "ESG / green" },
  target: { zh: "目標日期", en: "Target date" },
  conservative: { zh: "強積金保守", en: "MPF Conservative" },
  guaranteed: { zh: "保證", en: "Guaranteed" },
};

export function fundThemes(fund: Fund): ThemeId[] {
  const out: ThemeId[] = [];
  if (fund.isDis) out.push("dis");
  if (fund.isTracker) out.push("tracker");
  if (fund.sleeve === "healthcare") out.push("healthcare");
  if (fund.sleeve === "esg") out.push("esg");
  if (fund.sleeve === "mixed-target") out.push("target");
  if (fund.isConservative) out.push("conservative");
  if (fund.category === "guaranteed") out.push("guaranteed");
  return out;
}

export function fundById(id: string): Fund | undefined {
  return allFunds.find((f) => f.id === id);
}

export function uniqueSchemes(): {
  en: string;
  zh: string;
  providerCode: string;
  providerZh: string;
  providerEn: string;
  count: number;
  aum: number;
  ferAvg: number;
}[] {
  const map = new Map<
    string,
    { en: string; zh: string; providerCode: string; providerZh: string; providerEn: string; count: number; aum: number; ferSum: number; ferN: number }
  >();
  for (const f of allFunds) {
    const cur = map.get(f.schemeEn) ?? {
      en: f.schemeEn,
      zh: f.schemeZh,
      providerCode: f.providerCode,
      providerZh: f.providerZh,
      providerEn: f.providerEn,
      count: 0,
      aum: 0,
      ferSum: 0,
      ferN: 0,
    };
    cur.count += 1;
    cur.aum += f.aumM ?? 0;
    if (f.fer != null) {
      cur.ferSum += f.fer;
      cur.ferN += 1;
    }
    map.set(f.schemeEn, cur);
  }
  return [...map.values()]
    .map((s) => ({
      en: s.en,
      zh: s.zh,
      providerCode: s.providerCode,
      providerZh: s.providerZh,
      providerEn: s.providerEn,
      count: s.count,
      aum: s.aum,
      ferAvg: s.ferN ? s.ferSum / s.ferN : 0,
    }))
    .sort((a, b) => b.aum - a.aum);
}

export function uniqueProviders(): { code: string; zh: string; en: string }[] {
  const map = new Map<string, { code: string; zh: string; en: string }>();
  for (const f of allFunds) {
    if (!map.has(f.providerCode)) {
      map.set(f.providerCode, { code: f.providerCode, zh: f.providerZh, en: f.providerEn });
    }
  }
  return [...map.values()].sort((a, b) => a.zh.localeCompare(b.zh, "zh-Hant"));
}

export function providerStats() {
  const map = new Map<string, Fund[]>();
  for (const f of allFunds) {
    const arr = map.get(f.providerCode) ?? [];
    arr.push(f);
    map.set(f.providerCode, arr);
  }
  return [...map.entries()]
    .map(([code, funds]) => ({
      code,
      zh: funds[0]!.providerZh,
      en: funds[0]!.providerEn,
      count: funds.length,
      aum: funds.reduce((s, f) => s + (f.aumM ?? 0), 0),
      ret1y: median(funds.map((f) => f.ret1y ?? NaN)),
      ret3y: median(funds.map((f) => calendar3yAnn(f) ?? NaN)),
      ret5y: median(funds.map((f) => f.ret5y ?? NaN)),
      ret10y: median(funds.map((f) => f.ret10y ?? NaN)),
      fer: median(funds.map((f) => f.fer ?? NaN)),
    }))
    .sort((a, b) => (b.ret1y ?? -999) - (a.ret1y ?? -999));
}

export function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

export function sleeveStats(period: AnnPeriod = "ret1y") {
  const groups = new Map<string, Fund[]>();
  for (const f of allFunds) {
    const arr = groups.get(f.sleeve) ?? [];
    arr.push(f);
    groups.set(f.sleeve, arr);
  }
  return [...groups.entries()]
    .map(([sleeve, funds]) => ({
      sleeve,
      count: funds.length,
      ret: median(funds.map((f) => annReturn(f, period) ?? NaN)),
      ret1y: median(funds.map((f) => f.ret1y ?? NaN)),
      ret5y: median(funds.map((f) => f.ret5y ?? NaN)),
      ret10y: median(funds.map((f) => f.ret10y ?? NaN)),
      retSince: median(funds.map((f) => f.retSince ?? NaN)),
      ret3yCal: median(funds.map((f) => annReturn(f, "ret3yCal") ?? NaN)),
      y2025: median(funds.map((f) => f.y2025 ?? NaN)),
      fer: median(funds.map((f) => f.fer ?? NaN)),
      aum: funds.reduce((s, f) => s + (f.aumM ?? 0), 0),
    }))
    .sort((a, b) => (b.ret ?? -999) - (a.ret ?? -999));
}

export function categoryStats() {
  return CATEGORY_ORDER.map((category) => {
    const funds = allFunds.filter((f) => f.category === category);
    const periods = Object.fromEntries(
      MEDIAN_PERIODS.map((p) => [p, median(funds.map((f) => annReturn(f, p) ?? NaN))]),
    ) as Record<MedianPeriod, number | null>;
    return {
      category,
      count: funds.length,
      fer: median(funds.map((f) => f.fer ?? NaN)),
      aum: funds.reduce((s, f) => s + (f.aumM ?? 0), 0),
      ...periods,
    };
  });
}

export const CAL_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export const PATH_SLEEVES = ["us", "hk", "china", "greater-china", "asia", "europe", "japan", "korea", "global"] as const;

export type PathSeries = {
  id: string;
  zh: string;
  en: string;
  count: number;
  rets: { year: number; ret: number | null }[];
  nav: { year: number; nav: number | null }[];
  ret5y: number | null;
  ret10y: number | null;
  retSince: number | null;
};

function calendarPath(funds: Fund[], id: string, zh: string, en: string): PathSeries {
  const rets = CAL_YEARS.map((year) => {
    const field = `y${year}` as "y2021" | "y2022" | "y2023" | "y2024" | "y2025";
    return { year, ret: median(funds.map((f) => f[field] ?? NaN)) };
  });
  let nav = 100;
  const points: { year: number; nav: number | null }[] = [{ year: 2020, nav: 100 }];
  for (const row of rets) {
    if (row.ret == null) {
      points.push({ year: row.year, nav: null });
    } else {
      nav *= 1 + row.ret / 100;
      points.push({ year: row.year, nav });
    }
  }
  return {
    id,
    zh,
    en,
    count: funds.length,
    rets,
    nav: points,
    ret5y: median(funds.map((f) => f.ret5y ?? NaN)),
    ret10y: median(funds.map((f) => f.ret10y ?? NaN)),
    retSince: median(funds.map((f) => f.retSince ?? NaN)),
  };
}

export function categoryCalendarPaths(): PathSeries[] {
  return CATEGORY_ORDER.map((category) =>
    calendarPath(
      allFunds.filter((f) => f.category === category),
      category,
      CATEGORY_LABEL[category].zh,
      CATEGORY_LABEL[category].en,
    ),
  );
}

export function sleeveCalendarPaths(): PathSeries[] {
  return PATH_SLEEVES.map((sleeve) =>
    calendarPath(
      allFunds.filter((f) => f.sleeve === sleeve),
      sleeve,
      SLEEVE_LABEL[sleeve]?.zh ?? sleeve,
      SLEEVE_LABEL[sleeve]?.en ?? sleeve,
    ),
  ).filter((s) => s.count >= 3);
}

export function peerRank(
  fund: Fund,
  field: "ret1y" | "ret5y" | "ret10y" | "retSince" | "fer" | "y2025",
): { rank: number; total: number } | null {
  const peers = allFunds.filter((f) => f.sleeve === fund.sleeve && f[field] != null);
  if (!peers.length || fund[field] == null) return null;
  const sorted = [...peers].sort((a, b) =>
    field === "fer" ? (a.fer ?? 99) - (b.fer ?? 99) : (b[field] ?? -999) - (a[field] ?? -999),
  );
  const rank = sorted.findIndex((f) => f.id === fund.id) + 1;
  return { rank, total: sorted.length };
}

export function peerRankBy(fund: Fund, get: (f: Fund) => number | null): { rank: number; total: number } | null {
  const self = get(fund);
  const peers = allFunds.filter((f) => f.sleeve === fund.sleeve && get(f) != null);
  if (!peers.length || self == null) return null;
  const sorted = [...peers].sort((a, b) => (get(b) ?? -999) - (get(a) ?? -999));
  const rank = sorted.findIndex((f) => f.id === fund.id) + 1;
  return { rank, total: sorted.length };
}
