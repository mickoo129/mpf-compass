import raw from "@/data/funds.json";
import type { CatalogFile, CatalogMeta, Fund, FundCategory } from "./types";
import { annReturn, type AnnPeriod } from "./returns";

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

export const CATEGORY_LABEL: Record<FundCategory, { zh: string; en: string }> = {
  equity: { zh: "股票", en: "Equity" },
  mixed: { zh: "混合資產", en: "Mixed assets" },
  bond: { zh: "債券", en: "Bond" },
  money: { zh: "貨幣市場", en: "Money market" },
  guaranteed: { zh: "保證", en: "Guaranteed" },
};

export function fundById(id: string): Fund | undefined {
  return allFunds.find((f) => f.id === id);
}

export function uniqueSchemes(): {
  en: string;
  zh: string;
  providerZh: string;
  providerEn: string;
  count: number;
  aum: number;
  ferAvg: number;
}[] {
  const map = new Map<
    string,
    { en: string; zh: string; providerZh: string; providerEn: string; count: number; aum: number; ferSum: number; ferN: number }
  >();
  for (const f of allFunds) {
    const cur = map.get(f.schemeEn) ?? {
      en: f.schemeEn,
      zh: f.schemeZh,
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
    return {
      category,
      count: funds.length,
      ret1y: median(funds.map((f) => f.ret1y ?? NaN)),
      ret3yCal: median(funds.map((f) => annReturn(f, "ret3yCal") ?? NaN)),
      ret5y: median(funds.map((f) => f.ret5y ?? NaN)),
      ret10y: median(funds.map((f) => f.ret10y ?? NaN)),
      retSince: median(funds.map((f) => f.retSince ?? NaN)),
      y2025: median(funds.map((f) => f.y2025 ?? NaN)),
      fer: median(funds.map((f) => f.fer ?? NaN)),
      aum: funds.reduce((s, f) => s + (f.aumM ?? 0), 0),
    };
  });
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
