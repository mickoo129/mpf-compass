import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageTitle } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReturnCell } from "@/components/funds/return-cell";
import {
  allFunds,
  CATEGORY_LABEL,
  catalogMeta,
  SLEEVE_LABEL,
  uniqueProviders,
  uniqueSchemes,
} from "@/lib/mpf/catalog";
import { fmtAum, fmtPctPlain } from "@/lib/mpf/format";
import { annReturn, calendar3yAnn } from "@/lib/mpf/returns";
import type { Fund, FundCategory } from "@/lib/mpf/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type SortKey = "ret1y" | "ret3yCal" | "ret5y" | "ret10y" | "retSince" | "y2025" | "fer" | "aumM" | "riskClass";

export const Route = createFileRoute("/funds/")({ component: FundsPage });

function FundsPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const compareIds = useAppStore((s) => s.compareIds);
  const toggle = useAppStore((s) => s.toggleCompare);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<FundCategory | "all">("all");
  const [provider, setProvider] = useState("all");
  const [scheme, setScheme] = useState("all");
  const [sort, setSort] = useState<SortKey>("ret1y");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const providers = uniqueProviders();
  const schemes = uniqueSchemes();

  const rows = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = allFunds.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (provider !== "all" && f.providerCode !== provider) return false;
      if (scheme !== "all" && f.schemeEn !== scheme) return false;
      if (!tokens.length) return true;
      const blob = `${f.nameZh} ${f.nameEn} ${f.schemeZh} ${f.schemeEn} ${f.providerZh} ${f.providerEn} ${f.typeZh} ${f.typeEn}`.toLowerCase();
      return tokens.every((t) => blob.includes(t));
    });
    list = [...list].sort((a, b) => {
      const av = sortValue(a, sort) ?? (dir === "asc" ? Infinity : -Infinity);
      const bv = sortValue(b, sort) ?? (dir === "asc" ? Infinity : -Infinity);
      return dir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [q, cat, provider, scheme, sort, dir]);

  function header(key: SortKey, label: string) {
    const active = sort === key;
    return (
      <button
        type="button"
        className={cn("text-right font-medium", active ? "text-fg" : "text-muted")}
        onClick={() => {
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
        subtitle={zh ? "按受託人、類別、收費與回報篩選。點選最多四隻放入比較籃。" : "Filter by provider, type, fees and returns. Pin up to four for comparison."}
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={zh ? "搜尋基金、計劃、受託人" : "Search fund, scheme, trustee"}
            className="pl-9"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as FundCategory | "all")}
          className="h-11 rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)]"
        >
          <option value="all">{zh ? "全部類別" : "All types"}</option>
          {(Object.keys(CATEGORY_LABEL) as FundCategory[]).map((c) => (
            <option key={c} value={c}>
              {zh ? CATEGORY_LABEL[c].zh : CATEGORY_LABEL[c].en}
            </option>
          ))}
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="h-11 rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)]"
        >
          <option value="all">{zh ? "全部供應商" : "All providers"}</option>
          {providers.map((p) => (
            <option key={p.code} value={p.code}>
              {zh ? p.zh : p.en}
            </option>
          ))}
        </select>
        <select
          value={scheme}
          onChange={(e) => setScheme(e.target.value)}
          className="h-11 rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] sm:col-span-2 lg:col-span-4"
        >
          <option value="all">{zh ? "全部計劃" : "All schemes"}</option>
          {schemes.map((s) => (
            <option key={s.en} value={s.en}>
              {zh ? s.zh : s.en}
            </option>
          ))}
        </select>
      </div>

      <p className="mb-3 text-xs text-subtle">
        {zh ? `顯示 ${rows.length} / ${allFunds.length}` : `Showing ${rows.length} / ${allFunds.length}`}
      </p>

      <div className="hidden overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)] md:block">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-border text-xs">
            <tr className="text-muted">
              <th className="px-3 py-3 text-left font-medium">{zh ? "基金" : "Fund"}</th>
              <th className="px-3 py-3 text-left font-medium">{zh ? "類別" : "Type"}</th>
              <th className="px-3 py-3">{header("riskClass", zh ? "風險" : "Risk")}</th>
              <th className="px-3 py-3">{header("fer", "FER")}</th>
              <th className="px-3 py-3">{header("ret1y", zh ? "1年" : "1Y")}</th>
              <th className="px-3 py-3">{header("ret3yCal", zh ? "3年" : "3Y")}</th>
              <th className="px-3 py-3">{header("ret5y", zh ? "5年" : "5Y")}</th>
              <th className="px-3 py-3">{header("ret10y", zh ? "10年" : "10Y")}</th>
              <th className="px-3 py-3">{header("retSince", zh ? "成立" : "Since")}</th>
              <th className="px-3 py-3">{header("y2025", "2025")}</th>
              <th className="px-3 py-3">{header("aumM", zh ? "規模" : "AUM")}</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 250).map((f) => (
              <FundRow key={f.id} fund={f} zh={zh} compared={compareIds.includes(f.id)} onToggle={() => toggle(f.id)} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.slice(0, 80).map((f) => (
          <Link
            key={f.id}
            to="/funds/$id"
            params={{ id: f.id }}
            className="block rounded-xl bg-card p-4 shadow-[var(--shadow-border)]"
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
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted">
              <span>FER {fmtPctPlain(f.fer)}</span>
              <span>5Y {fmtPctPlain(f.ret5y)}</span>
              <span>{zh ? "成立" : "Incep."} {fmtPctPlain(f.retSince)}</span>
              <span>R{f.riskClass ?? "—"}</span>
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{zh ? "沒有符合篩選的基金。" : "No funds match these filters."}</p>
      ) : null}
      {rows.length > 250 ? (
        <p className="mt-3 text-xs text-subtle">{zh ? "請收窄篩選以看其餘基金。" : "Narrow filters to see the rest."}</p>
      ) : null}
      <p className="mt-3 text-[11px] text-subtle">
        {zh
          ? "回報為積金局年化數字（截至 2026-08-31）。「3年」由 2023–2025 曆年複利推算，並非官方滾動三年。平台沒有 1個月／3個月／半年／YTD。"
          : "Returns are MPFA annualized figures as of 2026-08-31. “3Y” is compounded from calendar 2023–2025, not an official trailing 3Y. No 1M/3M/6M/YTD on the platform."}
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
        {fund.isTracker ? <Badge className="ml-1">Index</Badge> : null}
      </td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fund.riskClass ?? "—"}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums">{fund.fer?.toFixed(2) ?? "—"}</td>
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
