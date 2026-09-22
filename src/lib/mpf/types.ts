export type FundCategory = "equity" | "mixed" | "bond" | "money" | "guaranteed";

export type GoalId =
  | "growth"
  | "balanced"
  | "preserve"
  | "lowfee"
  | "dis"
  | "regime";

export type RiskAppetite = "conservative" | "moderate" | "aggressive";

export type AccountKind = "contribution" | "personal";

export type MixSize = "auto" | 1 | 2 | 3 | 4 | 5;

export type ReviewCadence = "auto" | "quarter" | "half" | "year";

export type SwitchHorizon = "1m" | "2m" | "6m" | "1y";

export interface Fund {
  id: string;
  nameEn: string;
  nameZh: string;
  schemeEn: string;
  schemeZh: string;
  trusteeCode: string;
  trusteeEn: string;
  trusteeZh: string;
  providerCode: string;
  providerEn: string;
  providerZh: string;
  typeEn: string;
  typeZh: string;
  category: FundCategory;
  sleeve: string;
  tags: string[];
  isDis: boolean;
  isCaf: boolean;
  isA65: boolean;
  isConservative: boolean;
  isTracker: boolean;
  bench: string;
  beta: number;
  launch: string | null;
  aumM: number | null;
  riskClass: number | null;
  fer: number | null;
  ret1y: number | null;
  ret5y: number | null;
  ret10y: number | null;
  retSince: number | null;
  cum5y: number | null;
  cum10y: number | null;
  cumSince: number | null;
  y2025: number | null;
  y2024: number | null;
  y2023: number | null;
  y2022: number | null;
  y2021: number | null;
  mgmtFee: string;
  trusteeFee: string;
  empfFee: number | null;
  invFee: string;
  guaranteeCharge: string;
}

export interface CatalogMeta {
  asOf: string;
  source: string;
  sourceUrl: string;
  fundCount: number;
  schemeCount: number;
}

export interface CatalogFile {
  meta: CatalogMeta;
  funds: Fund[];
}

export interface MarketQuote {
  symbol: string;
  nameZh: string;
  nameEn: string;
  price: number | null;
  changePct: number | null;
  prevClose: number | null;
  high52: number | null;
  low52: number | null;
  currency: string;
  spark: number[];
  ytdPct: number | null;
}

export interface MarketsPayload {
  fetchedAt: string;
  quotes: MarketQuote[];
  notes: string;
}

export interface IndexPath {
  symbol: string;
  nameZh: string;
  nameEn: string;
  points: { t: string; nav: number }[];
}

export interface IndexPathsPayload {
  fetchedAt: string;
  series: IndexPath[];
}

export interface Profile {
  age: number;
  retireAge: number;
  balance: number;
  monthly: number;
  account: AccountKind;
  schemeEn: string | null;
  goal: GoalId;
  risk: RiskAppetite;
  mixSize: MixSize;
  reviewEvery: ReviewCadence;
  switchHorizon: SwitchHorizon;
}

export interface ScoredFund {
  fund: Fund;
  score: number;
  reasons: string[];
  expectedReturn: number;
}

export interface Allocation {
  fund: Fund;
  weight: number;
  reasonZh: string;
  reasonEn: string;
}
