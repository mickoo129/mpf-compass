# 積金羅盤 · MPF Compass

全港 451 隻強積金成分基金分析、比較與目標推介。官方回報來自積金局基金平台（截至 2026-08-31）。指數來自 Yahoo Finance。

呢個工具係研究用，並非投資建議。

## 放到 Netlify

1. 用呢個 GitHub repo 喺 [Netlify](https://app.netlify.com) 開新 site（Import from Git）。
2. Build command：`npm run build`；Publish directory：`dist`（`netlify.toml` 已寫低）。
3. Node 22。唔使額外 API key。

唔好只 Drop 靜態檔：即時指數（Yahoo）要 Functions。

## 本地

```bash
npm install
npm run dev
```

Netlify 形態建置：

```bash
npm run build:netlify
```

## 更新積金局快照

基金表係靜態檔 [`src/data/funds.json`](src/data/funds.json)，唔會自己日日改。

1. 等 [積金局基金平台](https://mfp.mpfa.org.hk/) 公布新嘅「最新資料截至」日期（通常係月底後一至兩週，例如 8 月 31 日之後先出 9 月 30 日）。
2. 用同一口徑下載／擷取成分基金：1／5／10 年年化、曆年、FER、風險級別、規模、計劃名稱。**用計劃 + 英文名 + 單位類別對號**，對唔中就留空，唔好模糊配。
3. 改 `meta.asOf`、`meta.fundCount`，同 [`src/lib/i18n.ts`](src/lib/i18n.ts) 免責聲明入面嘅日期。
4. `npx tsc --noEmit` 後 commit。唔好把 Yahoo 指數或經濟日報日價寫入呢個檔。
