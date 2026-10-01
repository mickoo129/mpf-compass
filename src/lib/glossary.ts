/** Plain-language explanations shown behind the small "?" next to jargon, and on /glossary. */
export type TermKey =
  | "fer"
  | "risk"
  | "dis"
  | "caf"
  | "a65"
  | "annualised"
  | "cumulative"
  | "est3y"
  | "median"
  | "tracker"
  | "scheme"
  | "account"
  | "conservative"
  | "aum";

export const GLOSSARY: Record<TermKey, { zh: string; en: string; bodyZh: string; bodyEn: string }> = {
  fer: {
    zh: "開支比率",
    en: "Fund expense ratio (FER)",
    bodyZh: "每年從基金資產扣除嘅總收費佔資產嘅百分比，包括管理費、受託人費、行政費等。例如 1.5% 即係每 $10,000 結餘每年大約收 $150。積金局用上一個財政年度實際收費計算。",
    bodyEn: "Total yearly costs taken from the fund as a % of assets, including management, trustee and admin fees. 1.5% is about HK$150 a year per HK$10,000.",
  },
  risk: {
    zh: "風險級別",
    en: "Risk class",
    bodyZh: "積金局按基金過去三年嘅波動程度分 1 至 7 級。1 最穩定（例如保守基金），7 上落最大。級別越高，短期跌幅可能越大，但唔代表長遠回報一定越高。",
    bodyEn: "MPFA's 1–7 scale based on the last three years' volatility. 1 is steadiest, 7 swings most.",
  },
  dis: {
    zh: "預設投資策略（DIS）",
    en: "Default Investment Strategy (DIS)",
    bodyZh: "冇揀基金嘅成員會自動用嘅策略。50 歲前全部放核心累積基金，50 至 64 歲逐年轉去65歲後基金。兩隻基金嘅管理費上限係每年 0.75%，經常性開支上限 0.2%。",
    bodyEn: "The default for members who do not choose. Core Accumulation until 50, then gradually Age 65 Plus. Fees are capped by law.",
  },
  caf: {
    zh: "核心累積基金",
    en: "Core Accumulation Fund",
    bodyZh: "預設投資策略入面較進取嗰隻：大約六成環球股票、四成環球債券。每個計劃都有一隻，收費有法定上限。",
    bodyEn: "The growth half of DIS: about 60% global shares and 40% bonds, with a fee cap.",
  },
  a65: {
    zh: "65歲後基金",
    en: "Age 65 Plus Fund",
    bodyZh: "預設投資策略入面較保守嗰隻：大約兩成環球股票、八成債券，供臨近或已到退休年齡嘅人用。",
    bodyEn: "The defensive half of DIS: about 20% shares, 80% bonds.",
  },
  annualised: {
    zh: "年化回報",
    en: "Annualised return",
    bodyZh: "將一段時間嘅總回報，換算成「平均每年」嘅回報。例如 5 年年化 6%，即係平均每年賺 6%（複利計），唔係每年都剛好 6%。",
    bodyEn: "The average yearly return over a period, compounded. 6% a year over 5 years does not mean exactly 6% every year.",
  },
  cumulative: {
    zh: "累積回報",
    en: "Cumulative return",
    bodyZh: "成段時間加埋嘅總回報。例如 5 年累積 34%，即係 $10,000 變成大約 $13,400。",
    bodyEn: "Total return over the whole period: 34% over 5 years turns HK$10,000 into about HK$13,400.",
  },
  est3y: {
    zh: "3年（推算）",
    en: "3-year (derived)",
    bodyZh: "積金局冇公布三年年化回報。呢度用 2023、2024、2025 三個曆年回報複利推算，截至 2025 年底，同其他欄嘅截數日唔同。",
    bodyEn: "MPFA does not publish 3-year returns. This compounds calendar 2023–2025, ending 2025-12-31.",
  },
  median: {
    zh: "中位數",
    en: "Median",
    bodyZh: "將一組基金由高到低排好，排喺正中間嗰隻嘅數字。比平均數更唔容易被一兩隻特別高或低嘅基金扭曲。",
    bodyEn: "The middle value when funds are ranked; less skewed by outliers than an average.",
  },
  tracker: {
    zh: "指數基金",
    en: "Index tracker",
    bodyZh: "唔靠基金經理揀股，而係跟住一個指數（例如恒指、標普 500）買入成份股。收費通常較低，表現貼近指數。",
    bodyEn: "Follows an index instead of a manager's picks; usually cheaper.",
  },
  scheme: {
    zh: "計劃同成分基金",
    en: "Scheme vs fund",
    bodyZh: "「計劃」係受託人（例如宏利、滙豐）提供嘅強積金計劃；每個計劃入面有十幾至幾十隻「成分基金」俾你揀。供款帳戶一般只可以喺僱主揀嘅計劃入面轉換基金。",
    bodyEn: "A scheme is a trustee's MPF plan; each scheme offers its own constituent funds.",
  },
  account: {
    zh: "供款帳戶同個人帳戶",
    en: "Contribution vs personal account",
    bodyZh: "供款帳戶係而家僱主幫你供款嗰個，只可以喺僱主揀嘅計劃入面揀基金（僱員供款部分每年可轉一次去其他計劃）。個人帳戶係舊工嘅累算權益，可以自由轉去任何計劃。",
    bodyEn: "Your current employer's account is tied to its scheme; a personal account (from past jobs) can move to any scheme.",
  },
  conservative: {
    zh: "強積金保守基金",
    en: "MPF Conservative Fund",
    bodyZh: "每個計劃都必須提供，投資港元存款同短期債務票據，回報接近銀行存款利息。長期持有通常追唔上通脹。",
    bodyEn: "Required in every scheme; HKD deposits and short-term paper. Over long periods it tends to trail inflation.",
  },
  aum: {
    zh: "基金規模",
    en: "Fund size",
    bodyZh: "基金管理緊嘅資產總值。規模太細嘅基金有機會被合併或者終止。",
    bodyEn: "Total assets the fund manages; very small funds are more likely to be merged or closed.",
  },
};
