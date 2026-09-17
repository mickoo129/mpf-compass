export type Locale = "zh" | "en";

export const copy = {
  app: { zh: "積金羅盤", en: "MPF Compass" },
  tagline: {
    zh: "全港強積金成分基金比較與目標配置參考",
    en: "Hong Kong MPF constituent-fund comparison and goal-based allocation",
  },
  nav: {
    pulse: { zh: "概覽", en: "Overview" },
    funds: { zh: "基金庫", en: "Funds" },
    compare: { zh: "比較", en: "Compare" },
    recommend: { zh: "智選", en: "Recommend" },
    schemes: { zh: "計劃", en: "Schemes" },
  },
  disclaimer: {
    zh: "本工具以積金局基金平台公開數據（截至 2026-08-31）及公開市場指數作分析，並非投資建議、亦非積金局或任何受託人官方產品。強積金表現可升可跌，過往回報並不代表將來表現。轉會或轉換基金前請細閱計劃文件。",
    en: "Built from the MPFA Fund Platform (as of 31 Aug 2026) and public market indices. Not investment advice and not an official MPFA or trustee product. Past performance is not a guide to the future.",
  },
} as const;

export function t(locale: Locale, pair: { zh: string; en: string }): string {
  return locale === "zh" ? pair.zh : pair.en;
}
