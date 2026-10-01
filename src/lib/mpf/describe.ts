/**
 * One-paragraph plain-language description of a fund, built from its MPFA
 * type, risk class, fee and index-tracking flag. Clients read this before any
 * number, so it says what the fund buys, how bumpy it is and who it usually suits.
 */
import { allFunds, median } from "./catalog";
import type { Fund } from "./types";

const WHAT_ZH: Record<string, string> = {
  us: "主要投資美國上市公司股票",
  global: "投資全球多個市場嘅股票，美國通常佔最大比重",
  europe: "主要投資歐洲上市公司股票",
  japan: "主要投資日本上市公司股票",
  asia: "主要投資亞太區（例如澳洲、台灣、韓國、香港）股票",
  korea: "主要投資韓國上市公司股票",
  hk: "主要投資香港上市公司股票",
  "hk-china": "主要投資香港同中國相關股票",
  "greater-china": "主要投資中國內地、香港同台灣股票",
  china: "主要投資中國相關股票",
  healthcare: "集中投資全球醫療同健康護理相關股票",
  esg: "投資符合環境、社會及管治（ESG）準則嘅股票",
  em: "投資新興市場股票",
  "dis-caf": "預設投資策略嘅核心累積基金：約六成環球股票、四成環球債券，收費有法定上限",
  "dis-a65": "預設投資策略嘅65歲後基金：約兩成環球股票、八成債券，收費有法定上限",
  "mixed-aggressive": "股票同債券混合，股票佔大約八成或以上",
  "mixed-growth": "股票同債券混合，股票佔大約六至八成",
  "mixed-balanced": "股票同債券混合，股票佔大約四至六成",
  "mixed-conservative": "股票同債券混合，以債券為主，股票佔大約兩至四成",
  "mixed-target": "目標日期基金：越接近目標年份，股票比例會自動減少",
  "mixed-global": "股票同債券混合，比例由基金經理按市況調整",
  "bond-global": "投資全球政府同企業債券",
  "bond-asia": "主要投資亞洲區債券",
  "bond-hk": "主要投資港元債券",
  "bond-cn": "主要投資人民幣債券，回報亦受人民幣匯率影響",
  conservative: "強積金保守基金：投資港元存款同短期債務票據，回報接近銀行存款",
  money: "貨幣市場基金：投資存款同短期票據，波動好細",
  guaranteed: "保證基金：符合條件先有保證回報，條件同收費要細閱計劃文件",
};

const WHAT_EN: Record<string, string> = {
  us: "Mainly US company shares",
  global: "Shares across world markets, usually with the US largest",
  europe: "Mainly European company shares",
  japan: "Mainly Japanese company shares",
  asia: "Mainly Asia-Pacific shares",
  korea: "Mainly Korean company shares",
  hk: "Mainly Hong Kong-listed shares",
  "hk-china": "Hong Kong and China-related shares",
  "greater-china": "Mainland China, Hong Kong and Taiwan shares",
  china: "China-related shares",
  healthcare: "Global healthcare shares",
  esg: "Shares screened for ESG standards",
  em: "Emerging-market shares",
  "dis-caf": "DIS Core Accumulation: about 60% global shares, 40% bonds, with a legal fee cap",
  "dis-a65": "DIS Age 65 Plus: about 20% shares, 80% bonds, with a legal fee cap",
  "mixed-aggressive": "Mixed, roughly 80%+ shares",
  "mixed-growth": "Mixed, roughly 60–80% shares",
  "mixed-balanced": "Mixed, roughly 40–60% shares",
  "mixed-conservative": "Mixed, mostly bonds, roughly 20–40% shares",
  "mixed-target": "Target-date: shares are reduced as the target year nears",
  "mixed-global": "Mixed shares and bonds, adjusted by the manager",
  "bond-global": "Global government and corporate bonds",
  "bond-asia": "Mainly Asian bonds",
  "bond-hk": "Mainly HKD bonds",
  "bond-cn": "Mainly RMB bonds; returns also move with the RMB",
  conservative: "MPF Conservative Fund: HKD deposits and short-term paper",
  money: "Money market: deposits and short-term paper",
  guaranteed: "Guaranteed fund: guarantee applies only on conditions",
};

function bumpZh(risk: number | null): string {
  if (risk == null) return "風險級別未有公布";
  if (risk <= 1) return "波動極低";
  if (risk <= 3) return "波動較低";
  if (risk === 4) return "波動中等";
  if (risk === 5) return "波動中等偏高，一年跌一兩成都有可能";
  return "波動高，一年跌兩三成都有可能";
}
function bumpEn(risk: number | null): string {
  if (risk == null) return "risk class not published";
  if (risk <= 3) return "low swings";
  if (risk === 4) return "moderate swings";
  if (risk === 5) return "moderately high swings";
  return "high swings";
}

function suitsZh(risk: number | null): string {
  if (risk == null) return "";
  if (risk >= 5) return "一般適合距離退休 15 年以上、可以接受短期上落嘅人";
  if (risk === 4) return "一般適合距離退休 8 年以上嘅人";
  return "一般適合臨近退休或者唔想承受大上落嘅人";
}

function feeWordZh(fund: Fund): string {
  const peers = allFunds.filter((f) => f.sleeve === fund.sleeve && f.category === fund.category && f.fer != null);
  const med = median(peers.map((f) => f.fer as number));
  if (fund.fer == null || med == null || peers.length < 3) return "";
  if (fund.fer <= med - 0.25) return "收費喺同類之中偏低";
  if (fund.fer >= med + 0.25) return "收費喺同類之中偏高";
  return "收費喺同類之中屬中等";
}

export function describeFund(fund: Fund, zh: boolean): string {
  if (!zh) {
    const what = WHAT_EN[fund.sleeve] ?? "A mixed portfolio";
    return `${what}${fund.isTracker ? ", tracking an index" : ""}. Risk class ${fund.riskClass ?? "—"}: ${bumpEn(fund.riskClass)}.`;
  }
  const parts = [
    `${WHAT_ZH[fund.sleeve] ?? "混合投資組合"}${fund.isTracker ? "，跟蹤指數表現（被動投資，收費通常較低）" : ""}。`,
    `風險級別 ${fund.riskClass ?? "—"}，${bumpZh(fund.riskClass)}。`,
  ];
  const suits = fund.category === "money" || fund.category === "guaranteed" ? "" : suitsZh(fund.riskClass);
  if (suits) parts.push(`${suits}。`);
  const fee = feeWordZh(fund);
  if (fee) parts.push(`${fee}。`);
  return parts.join("");
}
