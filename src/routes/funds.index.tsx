import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReturnCell } from "@/components/funds/return-cell";
import { FeeAmount } from "@/components/funds/fee-card";
import { Term } from "@/components/ui/term";
import {
  allFunds,
  CATEGORY_LABEL,
  catalogMeta,
  fundRegion,
  fundThemes,
  REGION_LABEL,
  REGION_ORDER,
  SLEEVE_LABEL,
  THEME_LABEL,
  THEME_ORDER,
  uniqueProviders,
  uniqueSchemes,
  type RegionId,
  type ThemeId,
} from "@/lib/mpf/catalog";
import { fmtAum, fmtPctPlain } from "@/lib/mpf/format";
import { annReturn, calendar3yAnn } from "@/lib/mpf/returns";
import { indexFund, scoreQuery } from "@/lib/mpf/search";
import type { Fund, FundCategory } from "@/lib/mpf/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type SortKey = "ret1y" | "ret3yCal" | "ret5y" | "ret10y" | "retSince" | "y2025" | "fer" | "aumM" | "riskClass";
type FundsSearch = {
  q?: string;
  focus?: boolean;
  sleeve?: string;
  scheme?: string;
  provider?: string;
  category?: FundCategory;
};

const PAGE = 40;
const SEARCH_INDEX = new Map(allFunds.map((f) => [f.id, indexFund(f, [SLEEVE_LABEL[f.sleeve]?.zh ?? "", SLEEVE_LABEL[f.sleeve]?.en ?? ""])]));

export const Route = createFileRoute("/funds/")({
  validateSearch: (raw: Record<string, unknown>): FundsSearch => ({
    q: typeof raw.q === "string" && raw.q ? raw.q : undefined,
    focus: raw.focus === true || raw.focus === "1" || raw.focus === 1 ? true : undefined,
    sleeve: typeof raw.sleeve === "string" ? raw.sleeve : undefined,
    scheme: typeof raw.scheme === "string" ? raw.scheme : undefined,
    provider: typeof raw.provider === "string" ? raw.provider : undefined,
    category:
      raw.category === "equity" ||
      raw.category === "mixed" ||
      raw.category === "bond" ||
      raw.category === "money" ||
      raw.category === "guaranteed"
        ? raw.category
        : undefined,
  }),
  component: FundsPage,
});

function FundsPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/funds/" });
  const compareIds = useAppStore((s) => s.compareIds);
  const toggle = useAppStore((s) => s.toggleCompare);
  const [q, setQ] = useState(search.q ?? "");
  const [limit, setLimit] = useState(PAGE);
  // While searching, best name matches come first until the member picks a column to sort by.
  const [byRelevance, setByRelevance] = useState(true);
  useEffect(() => {
    if (q.trim()) setByRelevance(true);
  }, [q]);
  const [cat, setCat] = useState<FundCategory | "all">(search.category ?? "all");
  const [region, setRegion] = useState<RegionId | "all">("all");
  const [theme, setTheme] = useState<ThemeId | "all">("all");
  const [provider, setProvider] = useState(search.provider ?? "all");
  const [scheme, setScheme] = useState(search.scheme ?? "all");
  const [sleeve, setSleeve] = useState(search.sleeve ?? "all");
  const [sort, setSort] = useState<SortKey>("ret1y");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  // Keep ?q= in the address bar so a search can be bookmarked or sent to a client.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = q.trim() || undefined;
      if (next !== search.q) void navigate({ search: (prev) => ({ ...prev, q: next, focus: undefined }), replace: true });
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (search.sleeve) setSleeve(search.sleeve);
    if (search.scheme) {
      setScheme(search.scheme);
      const match = uniqueSchemes().find((s) => s.en === search.scheme);
      if (match) setProvider(match.providerCode);
    }
    if (search.provider) setProvider(search.provider);
    if (search.category) setCat(search.category);
  }, [search.sleeve, search.scheme, search.provider, search.category]);

  const providers = uniqueProviders();
  const schemes = uniqueSchemes();
  const lockedProvider = useMemo(() => {
    if (provider !== "all") return provider;
    const token = q.trim().toLowerCase();
    if (token.length < 2) return null;
    const hits = providers.filter(
      (p) =>
        p.code.toLowerCase() === token ||
        p.en.toLowerCase() === token ||
        p.zh === q.trim() ||
        p.en.toLowerCase().includes(token) ||
        p.zh.includes(q.trim()),
    );
    const exact = hits.filter(
      (p) => p.code.toLowerCase() === token || p.en.toLowerCase() === token || p.zh === q.trim(),
    );
    const pick = exact.length === 1 ? exact : hits.length === 1 ? hits : [];
    return pick[0]?.code ?? null;
  }, [provider, q, providers]);
  const schemeOptions = lockedProvider ? schemes.filter((s) => s.providerCode === lockedProvider) : schemes;
  const schemeValue = schemeOptions.some((s) => s.en === scheme) ? scheme : "all";

  const rows = useMemo(() => {
    const query = q.trim();
    const scores = new Map<string, number>();
    let list = allFunds.filter((f) => {
      if (sleeve !== "all" && f.sleeve !== sleeve) return false;
      if (cat !== "all" && f.category !== cat) return false;
      if (region !== "all" && fundRegion(f) !== region) return false;
      if (theme !== "all" && !fundThemes(f).includes(theme)) return false;
      if (provider !== "all" && f.providerCode !== provider) return false;
      if (schemeValue !== "all" && f.schemeEn !== schemeValue) return false;
      if (!query) return true;
      const score = scoreQuery(query, SEARCH_INDEX.get(f.id)!);
      if (score > 0) scores.set(f.id, score);
      return score > 0;
    });
    list = [...list].sort((a, b) => {
      if (query && byRelevance) {
        const d = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
        if (d) return d;
      }
      const av = sortValue(a, sort) ?? (dir === "asc" ? Infinity : -Infinity);
      const bv = sortValue(b, sort) ?? (dir === "asc" ? Infinity : -Infinity);
      return dir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [q, cat, region, theme, provider, schemeValue, sleeve, sort, dir, byRelevance]);

  useEffect(() => setLimit(PAGE), [q, cat, region, theme, provider, schemeValue, sleeve]);
  const filtersActive =
    cat !== "all" || region !== "all" || theme !== "all" || provider !== "all" || schemeValue !== "all" || sleeve !== "all";
  function clearFilters() {
    setCat("all");
    setRegion("all");
    setTheme("all");
    setProvider("all");
    setScheme("all");
    setSleeve("all");
    void navigate({ search: (prev) => ({ q: prev.q }), replace: true });
  }

  function header(key: SortKey, label: string) {
    const active = sort === key;
    return (
      <button
        type="button"
        className={cn("text-right font-medium", active ? "text-fg" : "text-muted")}
        onClick={() => {
          setByRelevance(false);
          if (sort === key) setDir(dir === "desc" ? "asc" : "desc");
          else {
            setSort(key);
            setDir(key === "fer" || key === "riskClass" ? "asc" : "desc");
          }
        }}
      >
        {label}
        {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    );
  }

  return (
    <div>
      <PageTitle
        kicker={`MPFA ${catalogMeta.asOf}`}
        title={zh ? "全港成分基金" : "All constituent funds"}
        subtitle={
          zh
            ? "按類別、地區、主題、供應商篩選。積金局沒有科技／金融等行業分類；主題只包括官方有標示的指數、DIS、醫療、ESG。"
            : "Filter by type, region, theme and provider. MPFA has no GICS sectors; themes are official flags only (index, DIS, healthcare, ESG)."
        }
      />
      <AsOfLine zh={zh} />
      {sleeve !== "all" || cat !== "all" ? (
        <p className="mb-3 text-xs text-canvas-muted">
          {sleeve !== "all" ? (
            <>
              {zh ? "已篩策略：" : "Sleeve: "}
              {SLEEVE_LABEL[sleeve]?.[zh ? "zh" : "en"] ?? sleeve}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setSleeve("all");
                  void navigate({ search: { ...search, sleeve: undefined } });
                }}
              >
                {zh ? "清除" : "Clear"}
              </button>
            </>
          ) : null}
          {cat !== "all" ? (
            <>
              {sleeve !== "all" ? " · " : null}
              {zh ? "已篩類別：" : "Type: "}
              {zh ? CATEGORY_LABEL[cat].zh : CATEGORY_LABEL[cat].en}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setCat("all");
                  void navigate({ search: { ...search, category: undefined } });
                }}
              >
                {zh ? "清除" : "Clear"}
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={zh ? "搜尋基金名，例如：宏利北美、友邦亞洲、盈富" : "Search fund name, e.g. Manulife North America"}
            className="pr-9 pl-9"
            type="search"
            enterKeyHint="search"
            autoFocus={search.focus}
            aria-label={zh ? "搜尋基金" : "Search funds"}
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1.5 text-subtle hover:text-fg"
              aria-label={zh ? "清除搜尋" : "Clear search"}
            >
              ×
            </button>
          ) : null}
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as FundCategory | "all")}
          className="h-11 w-full min-w-0 rounded-md bg-card px-3 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <option value="all">{zh ? "全部類別" : "All types"}</option>
          {(Object.keys(CATEGORY_LABEL) as FundCategory[]).map((c) => (
            <option key={c} value={c}>
              {zh ? CATEGORY_LABEL[c].zh : CATEGORY_LABEL[c].en}
            </option>
          ))}
        </select>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as RegionId | "all")}
          className="h-11 w-full min-w-0 rounded-md bg-card px-3 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <option value="all">{zh ? "全部地區" : "All regions"}</option>
          {REGION_ORDER.map((r) => (
            <option key={r} value={r}>
              {zh ? REGION_LABEL[r].zh : REGION_LABEL[r].en}
            </option>
          ))}
        </select>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeId | "all")}
          className="h-11 w-full min-w-0 rounded-md bg-card px-3 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <option value="all">{zh ? "全部主題" : "All themes"}</option>
          {THEME_ORDER.map((t) => (
            <option key={t} value={t}>
              {zh ? THEME_LABEL[t].zh : THEME_LABEL[t].en}
            </option>
          ))}
        </select>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setScheme("all");
          }}
          className="h-11 w-full min-w-0 rounded-md bg-card px-3 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <option value="all">{zh ? "全部供應商" : "All providers"}</option>
          {providers.map((p) => (
            <option key={p.code} value={p.code}>
              {zh ? p.zh : p.en}
            </option>
          ))}
        </select>
        {schemeOptions.length === 1 ? (
          <div className="flex h-11 min-w-0 items-center rounded-md bg-card px-3 text-sm text-fg shadow-[var(--shadow-border)] sm:col-span-2 lg:col-span-4">
            <span className="text-subtle">{zh ? "計劃" : "Scheme"} · </span>
            <span className="ml-1 truncate font-medium">{zh ? schemeOptions[0]!.zh : schemeOptions[0]!.en}</span>
          </div>
        ) : (
          <select
            value={schemeValue}
            onChange={(e) => setScheme(e.target.value)}
            className="h-11 w-full min-w-0 rounded-md bg-card px-3 text-sm text-fg shadow-[var(--shadow-border)] sm:col-span-2 lg:col-span-4"
          >
            <option value="all">
              {lockedProvider
                ? zh
                  ? "該供應商全部計劃"
                  : "All schemes of this provider"
                : zh
                  ? "全部計劃"
                  : "All schemes"}
            </option>
            {schemeOptions.map((s) => (
              <option key={s.en} value={s.en}>
                {zh ? s.zh : s.en}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-3 text-xs text-canvas-muted">
        {zh ? `顯示 ${rows.length} / ${allFunds.length}` : `Showing ${rows.length} / ${allFunds.length}`}
      </p>

      <div className="hidden overflow-x-auto rounded-xl bg-card text-fg shadow-[var(--shadow-border)] md:block">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-border text-xs">
            <tr className="text-muted">
              <th className="px-3 py-3 text-left font-medium">{zh ? "基金" : "Fund"}</th>
              <th className="px-3 py-3 text-left font-medium">{zh ? "類別" : "Type"}</th>
              <th className="px-3 py-3"><span className="inline-flex items-center justify-end gap-1">{header("riskClass", zh ? "風險" : "Risk")}<Term k="risk">{""}</Term></span></th>
              <th className="px-3 py-3"><span className="inline-flex items-center justify-end gap-1">{header("fer", zh ? "開支比率" : "FER")}<Term k="fer">{""}</Term></span></th>
              <th className="px-3 py-3">{header("ret1y", zh ? "1年" : "1Y")}</th>
              <th className="px-3 py-3"><span className="inline-flex items-center justify-end gap-1">{header("ret3yCal", zh ? "3年" : "3Y")}<Term k="est3y">{""}</Term></span></th>
              <th className="px-3 py-3">{header("ret5y", zh ? "5年" : "5Y")}</th>
              <th className="px-3 py-3">{header("ret10y", zh ? "10年" : "10Y")}</th>
              <th className="px-3 py-3">{header("retSince", zh ? "成立" : "Since")}</th>
              <th className="px-3 py-3">{header("y2025", "2025")}</th>
              <th className="px-3 py-3">{header("aumM", zh ? "規模" : "AUM")}</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((f) => (
              <FundRow key={f.id} fund={f} zh={zh} compared={compareIds.includes(f.id)} onToggle={() => toggle(f.id)} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.slice(0, limit).map((f) => (
          <Link
            key={f.id}
            to="/funds/$id"
            params={{ id: f.id }}
            className="block rounded-xl bg-card p-4 text-fg shadow-[var(--shadow-border)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{zh ? f.nameZh : f.nameEn}</p>
                <p className="truncate text-xs text-subtle">
                  {zh ? f.providerZh : f.providerEn} · {zh ? f.schemeZh : f.schemeEn}
                </p>
              </div>
              <ReturnCell value={f.ret1y} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs text-muted">
              <span>
                {zh ? "開支比率" : "FER"} {fmtPctPlain(f.fer)} ≈ <FeeAmount fer={f.fer} zh={zh} />
              </span>
              <span>{zh ? "5年" : "5Y"} {fmtPctPlain(f.ret5y)}</span>
              <span>{zh ? "成立" : "Incep."} {fmtPctPlain(f.retSince)}</span>
              <span>{zh ? "風險" : "R"} {f.riskClass ?? "—"}</span>
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-canvas-muted">
          <p>
            {q.trim()
              ? zh
                ? `搵唔到「${q.trim()}」。可以試下少打幾個字，例如公司名加地區（「宏利 北美」）。`
                : `Nothing matches “${q.trim()}”. Try fewer words, e.g. trustee plus region.`
              : zh
                ? "沒有符合篩選的基金。"
                : "No funds match these filters."}
          </p>
          {filtersActive ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
              {zh ? "清除其他篩選再搜" : "Clear other filters"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {rows.length > limit ? (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            {zh ? `顯示更多（仲有 ${rows.length - limit} 隻）` : `Show more (${rows.length - limit} left)`}
          </Button>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-canvas-muted">
        {zh
          ? `回報為積金局年化數字（截至 ${catalogMeta.asOf}）。「3年」由 2023–2025 曆年複利推算，並非官方滾動三年。平台沒有 1個月／3個月／半年／YTD。`
          : `Returns are MPFA annualized figures as of ${catalogMeta.asOf}. “3Y” is compounded from calendar 2023–2025, not an official trailing 3Y. No 1M/3M/6M/YTD on the platform.`}
      </p>
    </div>
  );
}

function sortValue(fund: Fund, key: SortKey): number | null {
  if (key === "ret3yCal") return annReturn(fund, "ret3yCal");
  return fund[key];
}

function FundRow({
  fund,
  zh,
  compared,
  onToggle,
}: {
  fund: Fund;
  zh: boolean;
  compared: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-bg-warm/60">
      <td className="px-3 py-2.5">
        <Link to="/funds/$id" params={{ id: fund.id }} className="block">
          <span className="font-medium">{zh ? fund.nameZh : fund.nameEn}</span>
          <span className="mt-0.5 block text-xs text-subtle">
            {zh ? fund.providerZh : fund.providerEn} · {zh ? fund.schemeZh : fund.schemeEn}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted">
        {SLEEVE_LABEL[fund.sleeve]?.[zh ? "zh" : "en"] ?? fund.sleeve}
        {fund.isTracker ? <Badge className="ml-1">{zh ? "指數" : "Index"}</Badge> : null}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fund.riskClass ?? "—"}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
        {fund.fer != null ? `${fund.fer.toFixed(2)}%` : "—"}
        <FeeAmount fer={fund.fer} zh={zh} className="block text-xs text-muted" />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ReturnCell value={fund.ret1y} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ReturnCell value={calendar3yAnn(fund)} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ReturnCell value={fund.ret5y} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ReturnCell value={fund.ret10y} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ReturnCell value={fund.retSince} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <ReturnCell value={fund.y2025} />
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted">{fmtAum(fund.aumM)}</td>
      <td className="px-3 py-2.5 text-right">
        <Button variant={compared ? "default" : "outline"} size="sm" onClick={onToggle}>
          {compared ? (zh ? "已選" : "Added") : zh ? "比較" : "Add"}
        </Button>
      </td>
    </tr>
  );
}
