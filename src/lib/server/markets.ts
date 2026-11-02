import { createServerFn } from "@tanstack/react-start";
import type { IndexPath, IndexPathsPayload, MarketQuote, MarketsPayload } from "@/lib/mpf/types";

const INDICES: { symbol: string; nameZh: string; nameEn: string }[] = [
  { symbol: "^HSI", nameZh: "恒生指數", nameEn: "Hang Seng" },
  { symbol: "^HSCE", nameZh: "國企指數", nameEn: "HSCEI" },
  { symbol: "^GSPC", nameZh: "標普 500", nameEn: "S&P 500" },
  { symbol: "^IXIC", nameZh: "納斯達克", nameEn: "Nasdaq" },
  { symbol: "^N225", nameZh: "日經 225", nameEn: "Nikkei 225" },
  { symbol: "^KS11", nameZh: "韓國綜指", nameEn: "KOSPI" },
  { symbol: "^TWII", nameZh: "台灣加權", nameEn: "TAIEX" },
  { symbol: "000300.SS", nameZh: "滬深 300", nameEn: "CSI 300" },
  { symbol: "^STOXX50E", nameZh: "歐元區 50", nameEn: "Euro Stoxx 50" },
  { symbol: "GC=F", nameZh: "黃金", nameEn: "Gold" },
  { symbol: "^TNX", nameZh: "美債 10 年", nameEn: "US 10Y yield" },
  { symbol: "DX-Y.NYB", nameZh: "美元指數", nameEn: "US Dollar Index" },
];

let cache: { at: number; data: MarketsPayload } | null = null;
const TTL_MS = 60_000;

async function fetchChart(symbol: string): Promise<MarketQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MPFCompass/1.0)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    chart?: {
      result?: {
        meta: {
          symbol: string;
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          fiftyTwoWeekHigh?: number;
          fiftyTwoWeekLow?: number;
          currency?: string;
        };
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }[];
    };
  };
  const result = body.chart?.result?.[0];
  if (!result) return null;
  const timestamps = result.timestamp ?? [];
  const rawCloses = result.indicators?.quote?.[0]?.close ?? [];
  const closes = rawCloses.filter((n): n is number => n != null && Number.isFinite(n));
  const price = result.meta.regularMarketPrice ?? closes.at(-1) ?? null;
  const prev = closes.length >= 2 ? closes[closes.length - 2]! : result.meta.chartPreviousClose ?? null;
  const changePct = price != null && prev ? ((price - prev) / prev) * 100 : null;
  const year = new Date().getUTCFullYear();
  const ytdStart = Date.UTC(year, 0, 1) / 1000;
  let ytdBase: number | null = null;
  for (let i = 0; i < timestamps.length; i++) {
    const c = rawCloses[i];
    if ((timestamps[i] ?? 0) >= ytdStart && c != null && Number.isFinite(c)) {
      ytdBase = c;
      break;
    }
  }
  const ytdPct = price != null && ytdBase ? ((price - ytdBase) / ytdBase) * 100 : null;
  const step = Math.max(1, Math.floor(closes.length / 48));
  const spark = closes.filter((_, i) => i % step === 0 || i === closes.length - 1);
  const meta = INDICES.find((i) => i.symbol === symbol)!;
  return {
    symbol,
    nameZh: meta.nameZh,
    nameEn: meta.nameEn,
    price,
    changePct,
    prevClose: prev,
    high52: result.meta.fiftyTwoWeekHigh ?? null,
    low52: result.meta.fiftyTwoWeekLow ?? null,
    currency: result.meta.currency ?? "",
    spark,
    ytdPct,
  };
}

export const getMarkets = createServerFn({ method: "GET" }).handler(async (): Promise<MarketsPayload> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const quotes = (await Promise.all(INDICES.map((i) => fetchChart(i.symbol).catch(() => null)))).filter(
    (q): q is MarketQuote => q != null,
  );
  const data: MarketsPayload = {
    fetchedAt: new Date().toISOString(),
    quotes,
    notes:
      "指數報價來自 Yahoo Finance（港股約延遲 15 分鐘），並非積金局基金單位價格，亦非基金快照日期。",
  };
  cache = { at: Date.now(), data };
  return data;
});

const PATH_INDICES = [
  { symbol: "^HSI", nameZh: "恒生指數", nameEn: "Hang Seng" },
  { symbol: "^GSPC", nameZh: "標普 500", nameEn: "S&P 500" },
  { symbol: "^N225", nameZh: "日經 225", nameEn: "Nikkei 225" },
  { symbol: "^KS11", nameZh: "韓國綜指", nameEn: "KOSPI" },
  { symbol: "000300.SS", nameZh: "滬深 300", nameEn: "CSI 300" },
  { symbol: "^STOXX50E", nameZh: "歐元區 50", nameEn: "Euro Stoxx 50" },
];

let pathCache: { at: number; data: IndexPathsPayload } | null = null;
const PATH_TTL_MS = 60 * 60 * 1000;

async function fetchIndexPath(symbol: string): Promise<IndexPath | null> {
  const meta = PATH_INDICES.find((i) => i.symbol === symbol);
  if (!meta) return null;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=10y`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MPFCompass/1.0)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    chart?: {
      result?: {
        timestamp?: number[];
        indicators?: { quote?: { close?: (number | null)[] }[] };
      }[];
    };
  };
  const result = body.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const monthly = new Map<string, number>();
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    const d = new Date(timestamps[i]! * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthly.set(key, c);
  }
  const keys = [...monthly.keys()].sort();
  const first = monthly.get(keys[0] ?? "");
  if (!first || keys.length < 12) return null;
  return {
    symbol,
    nameZh: meta.nameZh,
    nameEn: meta.nameEn,
    points: keys.map((t) => ({ t, nav: ((monthly.get(t) ?? first) / first) * 100 })),
  };
}

export const getIndexPaths = createServerFn({ method: "GET" }).handler(async (): Promise<IndexPathsPayload> => {
  if (pathCache && Date.now() - pathCache.at < PATH_TTL_MS) return pathCache.data;
  const series = (await Promise.all(PATH_INDICES.map((i) => fetchIndexPath(i.symbol).catch(() => null)))).filter(
    (s): s is IndexPath => s != null,
  );
  const data: IndexPathsPayload = { fetchedAt: new Date().toISOString(), series };
  pathCache = { at: Date.now(), data };
  return data;
});

/* ------------------------------------------------------------------ */
/* Monthly history for "可能升跌範圍" (historical range of outcomes).   */
/* ------------------------------------------------------------------ */

export const HISTORY_SYMBOLS = ["^HSI", "^HSCE", "^GSPC", "^N225", "^KS11", "000300.SS", "^STOXX50E", "AGG"] as const;

export interface MonthlySeries {
  symbol: string;
  /** Month-end closes, oldest first; t = "YYYY-MM". */
  points: { t: string; close: number }[];
}

export interface HistoryPayload {
  fetchedAt: string;
  series: MonthlySeries[];
}

let historyCache: { at: number; data: HistoryPayload } | null = null;
const HISTORY_TTL_MS = 12 * 60 * 60 * 1000;

async function fetchMonthly(symbol: string): Promise<MonthlySeries | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=20y`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MPFCompass/1.0)", Accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
  };
  const result = body.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const byMonth = new Map<string, number>();
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c) || c <= 0) continue;
    const d = new Date(ts[i]! * 1000);
    byMonth.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, c);
  }
  const points = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, close]) => ({ t, close }));
  return points.length >= 24 ? { symbol, points } : null;
}

export const getReturnHistory = createServerFn({ method: "GET" }).handler(async (): Promise<HistoryPayload> => {
  if (historyCache && Date.now() - historyCache.at < HISTORY_TTL_MS) return historyCache.data;
  const series = (await Promise.all(HISTORY_SYMBOLS.map((s) => fetchMonthly(s).catch(() => null)))).filter(
    (s): s is MonthlySeries => s != null,
  );
  const data: HistoryPayload = { fetchedAt: new Date().toISOString(), series };
  if (series.length) historyCache = { at: Date.now(), data };
  return data;
});

/* ===== 市況參考：撳入去睇單一指數走勢（時段跟 Yahoo Finance：1D 5D 1M 6M YTD 1Y 5Y All）===== */

export const CHART_RANGES = ["1d", "5d", "1mo", "6mo", "ytd", "1y", "5y", "max"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

// 每個時段用幾密嘅數據點：即日用分鐘線，長年期用週線／月線
const RANGE_INTERVAL: Record<ChartRange, string> = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1d",
  "6mo": "1d",
  ytd: "1d",
  "1y": "1d",
  "5y": "1wk",
  max: "1mo",
};

export interface IndexChart {
  symbol: string;
  range: ChartRange;
  /** Unix seconds and close. */
  points: { t: number; c: number }[];
  /** Baseline for the change figure: previous close for 1D, first point otherwise. */
  base: number | null;
  last: number | null;
  /** Time of the last quote (Unix seconds) and the exchange's time zone. */
  asOf: number | null;
  timeZone: string | null;
}

type ChartBody = {
  chart?: {
    result?: {
      meta: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        exchangeTimezoneName?: string;
      };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
};

/** Pure parser so it can be tested without the network. */
export function parseIndexChart(symbol: string, range: ChartRange, body: ChartBody): IndexChart | null {
  const result = body.chart?.result?.[0];
  if (!result) return null;
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: { t: number; c: number }[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c != null && Number.isFinite(c)) points.push({ t: ts[i]!, c });
  }
  if (points.length < 2) return null;
  const last = result.meta.regularMarketPrice ?? points.at(-1)!.c;
  const prev = result.meta.previousClose ?? result.meta.chartPreviousClose ?? null;
  const base = range === "1d" ? (prev ?? points[0]!.c) : points[0]!.c;
  return {
    symbol,
    range,
    points,
    base,
    last,
    asOf: result.meta.regularMarketTime ?? points.at(-1)!.t,
    timeZone: result.meta.exchangeTimezoneName ?? null,
  };
}

const chartCache = new Map<string, { at: number; data: IndexChart | null }>();

export const getIndexChart = createServerFn({ method: "GET" })
  .validator((input: { symbol: string; range: string }) => {
    // Only the indices shown on the page, only Yahoo's ranges: nothing else reaches Yahoo.
    if (!INDICES.some((i) => i.symbol === input?.symbol)) throw new Error("Unknown index");
    if (!(CHART_RANGES as readonly string[]).includes(input?.range)) throw new Error("Unknown range");
    return { symbol: input.symbol, range: input.range as ChartRange };
  })
  .handler(async ({ data }): Promise<IndexChart | null> => {
    const key = `${data.symbol}|${data.range}`;
    const ttl = data.range === "1d" || data.range === "5d" ? 60_000 : 30 * 60_000;
    const hit = chartCache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.data;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(data.symbol)}?interval=${RANGE_INTERVAL[data.range]}&range=${data.range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MPFCompass/1.0)", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const parsed = parseIndexChart(data.symbol, data.range, (await res.json()) as ChartBody);
    if (parsed) chartCache.set(key, { at: Date.now(), data: parsed });
    return parsed;
  });
