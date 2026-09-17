import { createServerFn } from "@tanstack/react-start";
import type { MarketQuote, MarketsPayload } from "@/lib/mpf/types";

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
      "指數報價來自 Yahoo Finance（港股約延遲 15 分鐘），唔係積金局基金單位價格，亦唔係 8 月 31 日快照。",
  };
  cache = { at: Date.now(), data };
  return data;
});
