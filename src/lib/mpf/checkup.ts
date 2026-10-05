/**
 * 我嘅強積金健康檢查 — plain-language review of what a member already holds.
 *
 * Four questions a client actually asks: am I paying too much, is my risk right
 * for my age, am I too concentrated in one market, and are any of my funds
 * lagging similar funds I could switch to inside the same scheme.
 * Everything here describes the holdings against public MPFA data; it does not
 * tell the member what to buy.
 */
import { allFunds, fundBase, fundRegion, median, sameMemberClass, type RegionId } from "./catalog";
import { cheapestSwitch } from "./fee-peers";
import { annualFee, EXAMPLE_BALANCE, EXAMPLE_MONTHLY, feeGap } from "./fees";
import type { Fund } from "./types";

export type Light = "good" | "watch" | "act";

export interface Holding {
  fund: Fund;
  weight: number; // 0..1
}

export interface CheckItem {
  key: "fee" | "risk" | "spread" | "laggards" | "cash";
  light: Light;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  /** Funds in the same scheme worth a look, with a one-line reason. */
  ideas?: { fund: Fund; zh: string; en: string }[];
  /** The lagging holdings plus the best 5-year funds of the same type across all schemes, ready for 比較. */
  compareIds?: string[];
}

export interface CheckupResult {
  items: CheckItem[];
  fer: number | null;
  annualFeeHkd: number | null;
  equityShare: number; // 0..1, from each fund's equity sensitivity
  riskClass: number | null;
  regions: { region: RegionId | "china-bloc"; share: number }[];
}

const CHINA_BLOC: RegionId[] = ["hk", "china", "greater-china"];

const REGION_ZH: Record<string, string> = {
  hk: "香港",
  china: "中國",
  "greater-china": "大中華",
  "china-bloc": "香港／中國",
  asia: "亞洲",
  us: "美國",
  japan: "日本",
  korea: "韓國",
  europe: "歐洲",
  global: "環球",
  multi: "多元／債券／現金",
};

export function regionLabel(r: string, zh: boolean): string {
  return zh ? (REGION_ZH[r] ?? r) : r;
}

/** Risk class a member of this age would typically sit near (DIS glide path as the anchor). */
export function ageRiskBand(age: number, retireAge: number): { low: number; high: number } {
  const years = Math.max(0, retireAge - age);
  if (years >= 15) return { low: 4, high: 6 };
  if (years >= 8) return { low: 3, high: 5 };
  if (years >= 3) return { low: 3, high: 4 };
  return { low: 1, high: 4 };
}

function weighted(h: Holding[], get: (f: Fund) => number | null | undefined): number | null {
  const known = h.filter((x) => get(x.fund) != null);
  const w = known.reduce((s, x) => s + x.weight, 0);
  if (!w) return null;
  return known.reduce((s, x) => s + (x.weight / w) * (get(x.fund) as number), 0);
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

/**
 * Highest 5-year funds of the same type across every scheme: one per scheme and
 * one unit class per fund, so the comparison shows different choices.
 */
export function peerLeaders(fund: Fund, n: number, exclude: Set<string> = new Set()): Fund[] {
  const out: Fund[] = [];
  const schemes = new Set<string>();
  const ranked = allFunds
    .filter((f) => f.sleeve === fund.sleeve && f.category === fund.category && f.ret5y != null && f.id !== fund.id && !exclude.has(f.id) && fundBase(f) !== fundBase(fund))
    .sort((a, b) => (b.ret5y ?? 0) - (a.ret5y ?? 0));
  for (const f of ranked) {
    if (schemes.has(f.schemeEn)) continue;
    schemes.add(f.schemeEn);
    out.push(f);
    if (out.length >= n) break;
  }
  return out;
}

export function runCheckup(
  holdings: Holding[],
  person: { age: number; retireAge: number; balance: number; monthly: number },
): CheckupResult {
  const items: CheckItem[] = [];
  const years = Math.max(1, person.retireAge - person.age);
  const example = person.balance <= 0;
  const base = example ? EXAMPLE_BALANCE : person.balance;
  const perMonth = example && person.monthly <= 0 ? EXAMPLE_MONTHLY : person.monthly;
  const scheme = holdings[0]?.fund.schemeEn;
  const schemeFunds = allFunds.filter((f) => f.schemeEn === scheme);
  const heldIds = new Set(holdings.map((h) => h.fund.id));

  /* 1. Fees ------------------------------------------------------------ */
  const fer = weighted(holdings, (f) => f.fer);
  const swaps = holdings.map((h) => ({ h, alt: cheapestSwitch(h.fund) }));
  const cheapFer = weighted(
    swaps.map(({ h, alt }) => ({ fund: alt ?? h.fund, weight: h.weight })),
    (f) => f.fer,
  );
  const schemeMedianFer = median(schemeFunds.map((f) => f.fer ?? NaN));
  const annual = fer != null ? annualFee(base, fer) : null;
  if (fer != null) {
    const gap = cheapFer != null && cheapFer < fer - 0.005 ? feeGap(base, perMonth, years, fer, cheapFer) : 0;
    const dearScheme = schemeMedianFer != null && fer > schemeMedianFer + 0.3;
    const light: Light = gap > 0 ? (fer - (cheapFer ?? fer) >= 0.4 ? "act" : "watch") : dearScheme ? "watch" : "good";
    const unitZh = example ? `（以結餘 $${EXAMPLE_BALANCE.toLocaleString("en-HK")} 做例子）` : "";
    const unitEn = example ? ` (example: HK$${EXAMPLE_BALANCE.toLocaleString("en-HK")})` : "";
    items.push({
      key: "fee",
      light,
      titleZh: "收費",
      titleEn: "Fees",
      bodyZh:
        `平均開支比率 ${fer.toFixed(2)}%，每年約 $${Math.round(annual ?? 0).toLocaleString("en-HK")}${unitZh}。` +
        (schemeMedianFer != null ? `計劃內中位數係 ${schemeMedianFer.toFixed(2)}%。` : "") +
        (gap > 0
          ? `同計劃入面有同類而收費較低嘅基金，全部換成佢哋，平均可降至 ${cheapFer!.toFixed(2)}%，到 ${person.retireAge} 歲累積相差約 $${Math.round(gap).toLocaleString("en-HK")}。`
          : dearScheme
            ? "每隻已經係計劃內同類最平，但整體高過計劃中位數，主要係因為揀咗收費較高嘅類別（例如單一地區股票）。指數基金或者核心累積基金通常平好多。"
            : "已經係計劃內同類之中最低收費。"),
      bodyEn:
        `Weighted FER ${fer.toFixed(2)}%, about HK$${Math.round(annual ?? 0).toLocaleString("en-HK")} a year${unitEn}.` +
        (gap > 0 ? ` Same-type cheaper funds in this scheme would bring it to ${cheapFer!.toFixed(2)}%, about HK$${Math.round(gap).toLocaleString("en-HK")} by ${person.retireAge}.` : " Already the cheapest of each type in this scheme."),
      ideas: swaps
        .filter(({ alt }) => alt && !heldIds.has(alt.id))
        .map(({ h, alt }) => ({
          fund: alt!,
          zh: `同「${h.fund.nameZh}」同類，開支比率 ${alt!.fer?.toFixed(2)}%（而家 ${h.fund.fer?.toFixed(2)}%）`,
          en: `Same type as ${h.fund.nameEn}, FER ${alt!.fer?.toFixed(2)}% vs ${h.fund.fer?.toFixed(2)}%`,
        })),
    });
  }

  /* 2. Risk vs age ---------------------------------------------------- */
  const riskClass = weighted(holdings, (f) => f.riskClass);
  const equityShare = weighted(holdings, (f) => (f.category === "money" || f.category === "guaranteed" ? 0 : (f.beta ?? 0.5))) ?? 0;
  const band = ageRiskBand(person.age, person.retireAge);
  if (riskClass != null) {
    const above = riskClass > band.high + 0.25;
    const below = riskClass < band.low - 0.25;
    items.push({
      key: "risk",
      light: above && years < 10 ? "act" : above || below ? "watch" : "good",
      titleZh: "風險同年齡",
      titleEn: "Risk for your age",
      bodyZh: `平均風險級別約 ${riskClass.toFixed(1)}（1 最低、7 最高），股票比重估計約 ${pct(equityShare)}。以你 ${person.age} 歲、距離退休 ${years} 年，一般會落喺 ${band.low}–${band.high} 級。${
        above
          ? years < 10
            ? "你嘅組合偏進取，臨近提取時遇上跌市可能冇時間回復。"
            : "你嘅組合比一般同齡人進取，要預備短期上落較大。"
          : below
            ? "你嘅組合比一般同齡人保守，長遠回報可能追唔上通脹。"
            : "同你嘅年齡大致配合。"
      }`,
      bodyEn: `Average risk class ${riskClass.toFixed(1)} (1–7), roughly ${pct(equityShare)} in equities. At ${person.age} with ${years} years to go, members usually sit around ${band.low}–${band.high}.${above ? " Your mix is more aggressive than typical." : below ? " Your mix is more conservative than typical." : " That fits your age."}`,
    });
  }

  /* 3. Concentration -------------------------------------------------- */
  const byRegion = new Map<string, number>();
  for (const h of holdings) {
    // Concentration is about equity-market risk; bonds and cash count as "multi".
    const defensive = h.fund.category === "bond" || h.fund.category === "money" || h.fund.category === "guaranteed";
    const r = defensive ? "multi" : fundRegion(h.fund);
    const key = CHINA_BLOC.includes(r) ? "china-bloc" : r;
    byRegion.set(key, (byRegion.get(key) ?? 0) + h.weight);
  }
  const regions = [...byRegion.entries()]
    .map(([region, share]) => ({ region: region as RegionId | "china-bloc", share }))
    .sort((a, b) => b.share - a.share);
  const single = regions.find((r) => r.region !== "global" && r.region !== "multi" && r.share > 0.5);
  items.push({
    key: "spread",
    light: single ? (single.share >= 0.75 ? "act" : "watch") : "good",
    titleZh: "分散程度",
    titleEn: "Spread",
    bodyZh: single
      ? `${pct(single.share)} 集中喺${REGION_ZH[single.region]}市場。單一市場出事（例如 2021–23 年港股連跌三年）會影響成個戶口。可以考慮部分轉去環球或其他地區基金。`
      : `冇單一市場超過一半：${regions.map((r) => `${REGION_ZH[r.region]} ${pct(r.share)}`).join("、")}。`,
    bodyEn: single
      ? `${pct(single.share)} sits in one market (${single.region}). Consider moving part to global or other regions.`
      : `No single market above half: ${regions.map((r) => `${r.region} ${pct(r.share)}`).join(", ")}.`,
    ideas: single
      ? schemeFunds
          .filter((f) => f.sleeve === "global" && !heldIds.has(f.id) && holdings.every((h) => sameMemberClass(h.fund, f)))
          .sort((a, b) => (a.fer ?? 9) - (b.fer ?? 9))
          .slice(0, 2)
          .map((f) => ({ fund: f, zh: `計劃內環球股票基金，開支比率 ${f.fer?.toFixed(2)}%`, en: `Global equity in this scheme, FER ${f.fer?.toFixed(2)}%` }))
      : undefined,
  });

  /* 4. Laggards ------------------------------------------------------- */
  const laggards = holdings
    .map((h) => {
      const peers = allFunds.filter((f) => f.sleeve === h.fund.sleeve && f.ret5y != null);
      const med = median(peers.map((f) => f.ret5y as number));
      const better = schemeFunds
        .filter((f) => f.sleeve === h.fund.sleeve && f.category === h.fund.category && !heldIds.has(f.id) && sameMemberClass(h.fund, f) && f.ret5y != null && h.fund.ret5y != null && f.ret5y > h.fund.ret5y + 0.5)
        .sort((a, b) => (b.ret5y ?? 0) - (a.ret5y ?? 0))[0];
      return { h, med, better, behind: h.fund.ret5y != null && med != null ? med - h.fund.ret5y : 0 };
    })
    .filter((x) => x.behind >= 1);
  const worst = [...laggards].sort((a, b) => b.behind - a.behind).slice(0, 2);
  const leaderCount = worst.length === 1 ? 2 : 1;
  const compareIds = worst.length
    ? [...worst.map((x) => x.h.fund.id), ...worst.flatMap((x) => peerLeaders(x.h.fund, leaderCount, heldIds).map((f) => f.id))]
    : undefined;
  items.push({
    key: "laggards",
    compareIds,
    light: laggards.length ? (laggards.some((x) => x.behind >= 2.5) ? "act" : "watch") : "good",
    titleZh: "同類表現",
    titleEn: "Versus similar funds",
    bodyZh: laggards.length
      ? laggards
          .map((x) => `「${x.h.fund.nameZh}」五年年化 ${x.h.fund.ret5y?.toFixed(1)}%，比全港同類中位數低 ${x.behind.toFixed(1)}%。`)
          .join("")
      : "每隻基金嘅五年回報都唔低過全港同類中位數超過 1%。",
    bodyEn: laggards.length
      ? laggards.map((x) => `${x.h.fund.nameEn}: 5Y ${x.h.fund.ret5y?.toFixed(1)}%, ${x.behind.toFixed(1)}% below its peer median.`).join(" ")
      : "No holding trails its peer median 5-year return by more than 1%.",
    ideas: laggards
      .filter((x) => x.better)
      .map((x) => ({
        fund: x.better!,
        zh: `同計劃同類，五年年化 ${x.better!.ret5y?.toFixed(1)}%（「${x.h.fund.nameZh}」${x.h.fund.ret5y?.toFixed(1)}%）`,
        en: `Same scheme and type, 5Y ${x.better!.ret5y?.toFixed(1)}% vs ${x.h.fund.ret5y?.toFixed(1)}%`,
      })),
  });

  /* 5. Too much cash for a long horizon -------------------------------- */
  const cash = holdings
    .filter((h) => h.fund.category === "money" || h.fund.category === "guaranteed" || h.fund.isConservative)
    .reduce((s, h) => s + h.weight, 0);
  if (cash > 0.3 && years >= 15) {
    items.push({
      key: "cash",
      light: cash > 0.6 ? "act" : "watch",
      titleZh: "保守基金比例",
      titleEn: "Cash-like share",
      bodyZh: `${pct(cash)} 放喺保守／貨幣市場／保證基金。距離退休仲有 ${years} 年，呢類基金長期回報大約只係追平通脹，可能錯過增長。`,
      bodyEn: `${pct(cash)} sits in conservative, money-market or guaranteed funds; over ${years} years that may lag inflation.`,
    });
  }

  // An idea is never a fund already held, nor another unit class of one.
  const heldBases = new Set(holdings.map((h) => fundBase(h.fund)));
  for (const item of items) {
    if (!item.ideas) continue;
    const seen = new Set<string>();
    item.ideas = item.ideas.filter((idea) => {
      if (heldIds.has(idea.fund.id) || heldBases.has(fundBase(idea.fund)) || seen.has(idea.fund.id)) return false;
      seen.add(idea.fund.id);
      return true;
    });
  }

  return { items, fer, annualFeeHkd: annual, equityShare, riskClass, regions };
}
