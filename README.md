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

基金表主要來自 [`src/data/funds.json`](src/data/funds.json)。**唔使每次改程式。**

GitHub Action 每逢星期一 16:00 HKT 自動去 [積金局基金平台](https://mfp.mpfa.org.hk/) 核對「最新資料截至」日期。平台出咗新月底快照，就合併回報／收費／規模，commit 後 Netlify 會 rebuild。平台仍係舊日期就唔改檔。

亦可喺 GitHub Actions 撳 **Refresh MPFA catalog → Run workflow**，或本地：

```bash
npm run refresh:mpfa
```

分類（地區、DIS）沿用現有基金編號，唔靠模糊配對。新基金先至用類型名稱入組。
