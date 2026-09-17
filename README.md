# 積金羅盤 · MPF Compass

全港 451 隻強積金成分基金分析、比較與目標推介。官方回報來自積金局基金平台（截至 2026-08-31）。查找、比較與智選打分喺瀏覽器計，**唔使 Grok 配額**。

呢個工具係研究用，並非投資建議。

## 放到 Netlify

1. 用呢個 GitHub repo 喺 [Netlify](https://app.netlify.com) 開新 site（Import from Git）。
2. Build command：`npm run build`；Publish directory：`dist`（`netlify.toml` 已寫低）。
3. Node 22。
4. **唔使** `XAI_API_KEY`。網站唔會打 Grok API。

唔好只 Drop 靜態檔：即時指數（Yahoo）要 Functions；指數本身亦唔用 Grok。

## 本地

```bash
npm install
npm run dev
```

Netlify 形態建置：

```bash
npm run build:netlify
```
