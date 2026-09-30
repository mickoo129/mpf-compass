/**
 * Forgiving fund-name search.
 *
 * Clients type what they remember — "宏利北美", "友邦亚洲" (simplified),
 * "hsbc 核心", "盈富" — not the exact MPFA name ("宏利MPF北美股票基金").
 * Each query token must match some field of the fund, either as a plain
 * substring or, for Chinese, as characters appearing in order (so "宏利北美"
 * finds "宏利MPF北美股票基金"). Results are scored so the closest names rank first.
 */
import type { Fund } from "./types";

// Common simplified → traditional characters seen in fund, scheme and trustee names;
// 匯 → 滙 because MPFA spells HSBC 滙豐.
const S2T: Record<string, string> = {
  亚: "亞",
  国: "國",
  华: "華",
  债: "債",
  货: "貨",
  币: "幣",
  场: "場",
  险: "險",
  积: "積",
  环: "環",
  欧: "歐",
  韩: "韓",
  数: "數",
  长: "長",
  稳: "穩",
  岁: "歲",
  后: "後",
  预: "預",
  设: "設",
  银: "銀",
  联: "聯",
  东: "東",
  汇: "滙",
  匯: "滙",
  丰: "豐",
  达: "達",
  万: "萬",
  诚: "誠",
  寿: "壽",
  选: "選",
  计: "計",
  划: "劃",
  业: "業",
  进: "進",
  证: "證",
  发: "發",
  绿: "綠",
  医: "醫",
  疗: "療",
  护: "護",
  优: "優",
  际: "際",
  资: "資",
  产: "產",
  动: "動",
  类: "類",
  别: "別",
  单: "單",
  标: "標",
  时: "時",
  电: "電",
  经: "經",
  济: "濟",
  权: "權",
  储: "儲",
  乐: "樂",
  闲: "閒",
  实: "實",
  兴: "興",
  创: "創",
  质: "質",
  广: "廣",
  韦: "韋",
  义: "義",
  众: "眾",
  为: "為",
  与: "與",
  从: "從",
};

/** Lowercase, fold full-width ASCII, map simplified to traditional, drop spaces and punctuation. */
export function normalize(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFKC").toLowerCase()) {
    const t = S2T[ch] ?? ch;
    if (/[\s·•・,，.。()（）\-—–_/／&'’"“”:：+]/.test(t)) continue;
    out += t;
  }
  return out;
}

// Words that appear in almost every name and would otherwise swamp the match.
const NOISE = ["強積金", "mpf", "成分基金", "基金", "fund", "計劃", "scheme"];

function stripNoise(token: string): string {
  let t = token;
  for (const w of NOISE) if (t.length > w.length) t = t.split(w).join("");
  return t || token;
}

const HAN = /\p{Script=Han}/u;

/** True when every character of `needle` appears in `hay` in order. */
function inOrder(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}

export interface SearchIndexEntry {
  name: string;
  /** Scheme and provider (the company the member deals with). */
  org: string;
  /** Trustee, fund type, category and aliases. */
  other: string;
}

export function indexFund(f: Fund, extra: string[] = []): SearchIndexEntry {
  const aliases: string[] = [];
  if (f.isTracker) aliases.push("指數", "追蹤", "index", "tracker", "被動");
  if (f.isDis) aliases.push("預設投資策略", "dis", "預設");
  if (f.isCaf) aliases.push("核心累積", "core accumulation", "caf");
  if (f.isA65) aliases.push("65歲後", "age 65");
  if (f.isConservative) aliases.push("保守", "conservative");
  return {
    name: normalize(`${f.nameZh}|${f.nameEn}`),
    org: normalize([f.schemeZh, f.schemeEn, f.providerZh, f.providerEn].join("|")),
    other: normalize([f.trusteeZh, f.trusteeEn, f.typeZh, f.typeEn, ...aliases, ...extra].join("|")),
  };
}

/**
 * Score one fund against the query. 0 means no match. Higher is better:
 * substring in the fund name > in-order characters in the name > scheme or
 * provider > trustee / type / aliases.
 */
export function scoreQuery(query: string, entry: SearchIndexEntry): number {
  const tokens = query
    .split(/\s+/)
    .map((t) => stripNoise(normalize(t)))
    .filter(Boolean);
  if (!tokens.length) return 1;
  let score = 0;
  for (const t of tokens) {
    if (entry.name.includes(t)) score += 10 + t.length;
    else if (HAN.test(t) && t.length >= 2 && inOrder(t, entry.name)) score += 6 + t.length;
    else if (HAN.test(t) && t.length >= 3 && splitMatch(t, entry)) score += 6 + t.length;
    else if (entry.org.includes(t)) score += 5;
    else if (entry.other.includes(t)) score += 3;
    else if (HAN.test(t) && t.length >= 2 && inOrder(t, `${entry.name}|${entry.org}|${entry.other}`)) score += 2;
    else return 0;
  }
  return score;
}

/** "滙豐北美" typed as one word: company part matches the scheme/provider, the rest the fund name. */
function splitMatch(t: string, e: SearchIndexEntry): boolean {
  for (let k = 2; k <= t.length - 1; k++) {
    const a = t.slice(0, k);
    const b = t.slice(k);
    if (e.org.includes(a) && (e.name.includes(b) || inOrder(b, e.name))) return true;
    if (e.org.includes(b) && b.length >= 2 && (e.name.includes(a) || inOrder(a, e.name))) return true;
  }
  return false;
}
