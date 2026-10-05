import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { allFunds, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import { fmtPctPlain } from "@/lib/mpf/format";
import { indexFund, scoreQuery } from "@/lib/mpf/search";
import type { Fund } from "@/lib/mpf/types";
import { cn } from "@/lib/utils";

const INDEX = new Map(allFunds.map((f) => [f.id, indexFund(f, [SLEEVE_LABEL[f.sleeve]?.zh ?? "", SLEEVE_LABEL[f.sleeve]?.en ?? ""])]));

/**
 * Type-to-find fund picker. Typing "北美" or "hsbc core" narrows the list at
 * once; with nothing typed it shows the scheme's funds grouped by type, so a
 * fund can be added in two taps while a client is watching.
 */
export function FundPicker({
  zh,
  schemeEn,
  exclude = [],
  onPick,
  placeholder,
  disabled,
  autoFocus,
}: {
  zh: boolean;
  /** Limit to one scheme (健康檢查); omit to search every scheme (比較). */
  schemeEn?: string;
  exclude?: string[];
  onPick: (fund: Fund) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const pool = useMemo(
    () => allFunds.filter((f) => (!schemeEn || f.schemeEn === schemeEn) && !exclude.includes(f.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemeEn, exclude.join(",")],
  );

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) {
      // No query: a scheme's whole menu ordered by type; across all schemes, nothing until typed.
      if (!schemeEn) return [];
      const order = ["dis", "mixed", "equity", "bond", "money", "guaranteed"];
      const rank = (f: Fund) => (f.isDis ? 0 : order.indexOf(f.category));
      return [...pool].sort((a, b) => rank(a) - rank(b) || a.nameZh.localeCompare(b.nameZh, "zh-HK"));
    }
    return pool
      .map((f) => ({ f, s: scoreQuery(query, INDEX.get(f.id)!) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.f);
  }, [q, pool, schemeEn]);

  const pick = (f: Fund) => {
    onPick(f);
    setQ("");
    setOpen(false);
  };

  return (
    <div
      ref={box}
      className="relative"
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <Input
        value={q}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            pick(results[0]);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        type="search"
        enterKeyHint="done"
        placeholder={placeholder ?? (zh ? "打基金名加入，例如：北美、核心累積" : "Type a fund name to add")}
        className="pl-9"
        aria-label={zh ? "搜尋基金" : "Search funds"}
        role="combobox"
        aria-expanded={open}
        aria-controls="fund-picker-list"
      />
      {open && !disabled && (results.length > 0 || q.trim()) ? (
        <ul
          id="fund-picker-list"
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg bg-card text-fg shadow-[var(--shadow-border)] ring-1 ring-border"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{zh ? `搵唔到「${q.trim()}」，試下少打幾個字。` : `Nothing matches “${q.trim()}”.`}</li>
          ) : (
            results.map((f, i) => (
              <li key={f.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => pick(f)}
                  className={cn("flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-tint-sky", i > 0 && "border-t border-border/60")}
                >
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug">{zh ? f.nameZh : f.nameEn}</span>
                    <span className="block truncate text-xs text-subtle">
                      {schemeEn ? (SLEEVE_LABEL[f.sleeve]?.[zh ? "zh" : "en"] ?? "") : zh ? f.schemeZh : f.schemeEn}
                      {" · "}
                      {zh ? "開支比率" : "FER"} {fmtPctPlain(f.fer)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">{zh ? "加入" : "Add"}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
