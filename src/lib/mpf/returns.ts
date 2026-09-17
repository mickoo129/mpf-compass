import type { Fund } from "./types";

/** Official MPFA periods plus one labelled calendar-3Y compound. */
export type AnnPeriod = "ret1y" | "ret3yCal" | "ret5y" | "ret10y" | "retSince" | "y2025" | "y2024" | "y2023" | "y2022" | "y2021";

export const MEDIAN_PERIODS = ["ret1y", "ret3yCal", "ret5y", "ret10y", "retSince", "y2025"] as const;
export type MedianPeriod = (typeof MEDIAN_PERIODS)[number];

export const PERIOD_LABEL: Record<AnnPeriod, { zh: string; en: string }> = {
  ret1y: { zh: "1年", en: "1Y" },
  ret3yCal: { zh: "3年曆", en: "3Y cal" },
  ret5y: { zh: "5年", en: "5Y" },
  ret10y: { zh: "10年", en: "10Y" },
  retSince: { zh: "成立至今", en: "Since" },
  y2025: { zh: "2025", en: "2025" },
  y2024: { zh: "2024", en: "2024" },
  y2023: { zh: "2023", en: "2023" },
  y2022: { zh: "2022", en: "2022" },
  y2021: { zh: "2021", en: "2021" },
};

export const MPFA_PERIOD_NOTE = {
  zh: "積金局基金平台公布年化／累積：1年、5年、10年、成立至今，以及曆年 2021–2025（截至 2026-08-31）。沒有 1個月、3個月、半年、年初至今或官方滾動 3年。「3年曆」由 2023–2025 曆年複利推算，截至 2025-12-31。",
  en: "MPFA publishes annualized/cumulative 1Y, 5Y, 10Y, since launch, and calendar 2021–2025 (as of 2026-08-31). No 1M, 3M, 6M, YTD, or official trailing 3Y. “3Y cal” is compounded from calendar 2023–2025, through 31 Dec 2025.",
};

export function calendar3yAnn(fund: Fund): number | null {
  const a = fund.y2023;
  const b = fund.y2024;
  const c = fund.y2025;
  if (a == null || b == null || c == null) return null;
  const g = (1 + a / 100) * (1 + b / 100) * (1 + c / 100);
  if (g <= 0) return null;
  return (g ** (1 / 3) - 1) * 100;
}

export function calendar3yCum(fund: Fund): number | null {
  const a = fund.y2023;
  const b = fund.y2024;
  const c = fund.y2025;
  if (a == null || b == null || c == null) return null;
  return ((1 + a / 100) * (1 + b / 100) * (1 + c / 100) - 1) * 100;
}

export function annReturn(fund: Fund, p: AnnPeriod): number | null {
  if (p === "ret3yCal") return calendar3yAnn(fund);
  return fund[p];
}

export function cumReturn(fund: Fund, p: "ret1y" | "ret3yCal" | "ret5y" | "ret10y" | "retSince"): number | null {
  if (p === "ret1y") return fund.ret1y;
  if (p === "ret3yCal") return calendar3yCum(fund);
  if (p === "ret5y") return fund.cum5y;
  if (p === "ret10y") return fund.cum10y;
  return fund.cumSince;
}
