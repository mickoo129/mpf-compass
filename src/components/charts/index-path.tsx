import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getIndexPaths } from "@/lib/server/markets";

const COLORS: Record<string, string> = {
  "^HSI": "#c24b3c",
  "^GSPC": "#1a7a96",
  "^N225": "#c45c7a",
  "^KS11": "#8a5a44",
  "000300.SS": "#d4a84b",
  "^STOXX50E": "#4d6fa8",
};

export function IndexPathChart({ zh }: { zh: boolean }) {
  const q = useQuery({ queryKey: ["index-paths"], queryFn: () => getIndexPaths() });
  const series = q.data?.series ?? [];
  const months = [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort();
  const data = months.map((t) => {
    const row: Record<string, number | string | null> = { t };
    for (const s of series) {
      row[s.symbol] = s.points.find((p) => p.t === t)?.nav ?? null;
    }
    return row;
  });

  return (
    <Card>
      <h2 className="font-display text-lg">{zh ? "市場指數十年（參考）" : "Market indices, 10 years"}</h2>
      <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted">
        {zh
          ? "Yahoo 週線，起點＝100。此為公開市場指數，並非強積金單位價，亦未扣除開支比率。用作長線市況參考，不宜與上方積金局類別線直接對照。"
          : "Yahoo weekly, start = 100. Public market indices, not MPF NAVs and not net of FER. Context only — do not match them 1:1 to the MPFA category lines above."}
      </p>
      {q.isLoading ? (
        <Skeleton className="mt-3 h-72" />
      ) : (
        <div className="mt-3 h-60 min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                interval={11}
                tickFormatter={(v: string) => v.slice(0, 4)}
              />
              <YAxis width={40} tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  const s = series.find((x) => x.symbol === name);
                  return [v.toFixed(1), s ? (zh ? s.nameZh : s.nameEn) : name];
                }}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }}
              />
              <Legend
                formatter={(id: string) => {
                  const s = series.find((x) => x.symbol === id);
                  return s ? (zh ? s.nameZh : s.nameEn) : id;
                }}
                wrapperStyle={{ fontSize: 11 }}
              />
              {series.map((s) => (
                <Line
                  key={s.symbol}
                  type="monotone"
                  dataKey={s.symbol}
                  stroke={COLORS[s.symbol] ?? "#1a7a96"}
                  strokeWidth={s.symbol === "^GSPC" || s.symbol === "^HSI" ? 2.2 : 1.6}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
