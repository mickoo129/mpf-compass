import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { categoryCalendarPaths, sleeveCalendarPaths, type PathSeries } from "@/lib/mpf/catalog";
import { ReturnCell } from "@/components/funds/return-cell";
import { cn } from "@/lib/utils";

const CAT_COLORS: Record<string, string> = {
  equity: "#1a7a96",
  mixed: "#d4a84b",
  bond: "#5b7086",
  money: "#1f8a5c",
  guaranteed: "#7b6bb0",
};

const SLEEVE_COLORS: Record<string, string> = {
  us: "#1a7a96",
  hk: "#c24b3c",
  china: "#d4a84b",
  "greater-china": "#b8831f",
  asia: "#2c9a6a",
  europe: "#4d6fa8",
  japan: "#c45c7a",
  korea: "#8a5a44",
  global: "#5b7086",
};

function chartRows(series: PathSeries[], mode: "nav" | "ret") {
  if (mode === "nav") {
    const years = series[0]?.nav.map((p) => p.year) ?? [];
    return years.map((year) => {
      const row: Record<string, number | string | null> = { year };
      for (const s of series) {
        row[s.id] = s.nav.find((p) => p.year === year)?.nav ?? null;
      }
      return row;
    });
  }
  const years = series[0]?.rets.map((p) => p.year) ?? [];
  return years.map((year) => {
    const row: Record<string, number | string | null> = { year };
    for (const s of series) {
      row[s.id] = s.rets.find((p) => p.year === year)?.ret ?? null;
    }
    return row;
  });
}

export function CategoryPathChart({ zh }: { zh: boolean }) {
  const [group, setGroup] = useState<"category" | "region">("category");
  const [mode, setMode] = useState<"nav" | "ret">("nav");
  const series = useMemo(
    () => (group === "category" ? categoryCalendarPaths() : sleeveCalendarPaths()),
    [group],
  );
  const data = useMemo(() => chartRows(series, mode), [series, mode]);
  const colors = group === "category" ? CAT_COLORS : SLEEVE_COLORS;

  return (
    <Card>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg">{zh ? "類別走勢（曆年中位）" : "Category path (calendar median)"}</h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted">
            {zh
              ? "折線：每年用該組中位曆年回報，由 2020 年底＝100 連乘至 2025。下表「折線折算」係這條線的年化，應與圖對上。官方 5／10 年／成立至今係截至快照日的另一組年化，時段不同，不應相等。"
              : "The line compounds each year’s median calendar return from end-2020 = 100. “Line CAGR” is that path, annualized. Official 5Y / 10Y / since-launch are different windows to the snapshot date — they should not match the line."}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="inline-flex rounded-lg bg-tint-sky p-1">
            {(
              [
                ["category", zh ? "類別" : "Type"],
                ["region", zh ? "地區" : "Region"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setGroup(id)}
                className={cn("h-8 rounded-md px-2.5 text-xs", group === id ? "bg-white text-fg shadow-sm" : "text-muted")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg bg-tint-sky p-1">
            {(
              [
                ["nav", zh ? "累積（100 起）" : "Growth of 100"],
                ["ret", zh ? "每年回報" : "Calendar year"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn("h-8 rounded-md px-2.5 text-xs", mode === id ? "bg-white text-fg shadow-sm" : "text-muted")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-60 min-w-0 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
            <YAxis
              width={44}
              tick={{ fontSize: 11, fill: "var(--color-muted)" }}
              tickFormatter={(v: number) => (mode === "nav" ? String(Math.round(v)) : `${v}`)}
            />
            <Tooltip
              formatter={(v: number, name: string) => {
                const s = series.find((x) => x.id === name);
                const label = s ? (zh ? s.zh : s.en) : name;
                return [mode === "nav" ? v.toFixed(1) : `${v.toFixed(1)}%`, label];
              }}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }}
            />
            <Legend
              formatter={(id: string) => {
                const s = series.find((x) => x.id === id);
                return s ? (zh ? s.zh : s.en) : id;
              }}
              wrapperStyle={{ fontSize: 11 }}
            />
            {series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                stroke={colors[s.id] ?? "#1a7a96"}
                strokeWidth={s.id === "equity" || s.id === "us" ? 2.4 : 1.7}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="py-1.5 pr-3 text-left font-medium">{zh ? "組別" : "Group"}</th>
              <th className="py-1.5 px-2 text-right font-medium">{zh ? "2025年底" : "End-2025"}</th>
              <th className="py-1.5 px-2 text-right font-medium">{zh ? "折線折算" : "Line CAGR"}</th>
              <th className="py-1.5 px-2 text-right font-medium">{zh ? "官方5年" : "Official 5Y"}</th>
              <th className="py-1.5 px-2 text-right font-medium">{zh ? "官方10年" : "Official 10Y"}</th>
              <th className="py-1.5 pl-2 text-right font-medium">{zh ? "成立至今" : "Since launch"}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="py-1.5 pr-3">
                  <span className="mr-2 inline-block size-2 rounded-full" style={{ background: colors[s.id] }} />
                  {zh ? s.zh : s.en}
                </td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-muted">
                  {s.nav.at(-1)?.nav != null ? s.nav.at(-1)!.nav!.toFixed(1) : "—"}
                </td>
                <td className="py-1.5 px-2 text-right">
                  <ReturnCell value={s.calCagr} />
                </td>
                <td className="py-1.5 px-2 text-right">
                  <ReturnCell value={s.ret5y} />
                </td>
                <td className="py-1.5 px-2 text-right">
                  <ReturnCell value={s.ret10y} />
                </td>
                <td className="py-1.5 pl-2 text-right">
                  <ReturnCell value={s.retSince} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-relaxed text-subtle">
          {zh
            ? "例如股票：100 連乘五年曆年中位，2025 年底約 116，折線折算約 +3%。官方五年約 +5%，因為截至 2026-08-31，含 2026 年前八個月，並非完整 2021–2025。十年及成立至今覆蓋更長、每檔起步日不同。"
            : "Example, equities: compounding calendar medians reaches ~116 (+3% p.a.). Official 5Y is ~+5% because it runs to 31 Aug 2026, not calendar 2021–2025. 10Y and since-launch cover other windows."}
        </p>
      </div>
    </Card>
  );
}
