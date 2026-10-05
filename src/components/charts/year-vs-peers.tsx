import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { allFunds, CAL_YEARS, median, SLEEVE_LABEL } from "@/lib/mpf/catalog";
import type { Fund } from "@/lib/mpf/types";

const FUND_COLOR = "#0b45a6";
const PEER_COLOR = "#b9c6d3";

/**
 * Calendar-year returns of one fund beside the median of similar funds, so
 * "did it beat its peers?" is answered by looking, not by reading a table.
 */
export function YearVsPeers({ fund, zh, className }: { fund: Fund; zh: boolean; className?: string }) {
  const peers = allFunds.filter((f) => f.sleeve === fund.sleeve && f.category === fund.category);
  const data = CAL_YEARS.map((y) => {
    const key = `y${y}` as keyof Fund;
    return {
      year: String(y),
      fund: fund[key] as number | null,
      peers: median(peers.map((f) => (f[key] as number | null) ?? NaN)),
    };
  });
  data.push({
    year: zh ? "近1年" : "1Y",
    fund: fund.ret1y,
    peers: median(peers.map((f) => f.ret1y ?? NaN)),
  });
  const beat = data.filter((d) => d.fund != null && d.peers != null && d.fund > d.peers).length;
  const counted = data.filter((d) => d.fund != null && d.peers != null).length;
  const sleeve = SLEEVE_LABEL[fund.sleeve]?.[zh ? "zh" : "en"] ?? "";
  const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

  return (
    <Card className={className}>
      <h2 className="mb-1 font-display text-lg">{zh ? "每年回報：同同類比" : "Each year versus similar funds"}</h2>
      <p className="mb-2 text-sm text-fg">
        {counted
          ? zh
            ? `${counted} 個時段入面，有 ${beat} 個跑贏${sleeve}基金嘅中位數（共 ${peers.length} 隻）。`
            : `Beat the median of ${peers.length} ${sleeve} funds in ${beat} of ${counted} periods.`
          : zh
            ? "未有足夠年份比較。"
            : "Not enough history to compare."}
      </p>
      <ul className="mb-1 flex gap-4 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: FUND_COLOR }} />
          {zh ? "呢隻基金" : "This fund"}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: PEER_COLOR }} />
          {zh ? "同類中位數" : "Peer median"}
        </li>
      </ul>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 4, top: 8, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--color-muted)" }} tickLine={false} />
            <YAxis width={40} tick={{ fontSize: 11, fill: "var(--color-subtle)" }} tickFormatter={(v: number) => `${v}%`} />
            <ReferenceLine y={0} stroke="var(--color-muted)" />
            <Tooltip
              formatter={(v: number, name: string) => [pct(v), name]}
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
              cursor={{ fill: "rgba(11,69,166,0.06)" }}
            />
            <Bar dataKey="fund" name={zh ? "呢隻基金" : "This fund"} fill={FUND_COLOR} radius={[0, 0, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.year} fill={FUND_COLOR} />
              ))}
            </Bar>
            <Bar dataKey="peers" name={zh ? "同類中位數" : "Peer median"} fill={PEER_COLOR} radius={[0, 0, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-center text-xs">
          <tbody>
            <tr>
              <th className="pr-2 text-left whitespace-nowrap font-normal text-muted">{zh ? "基金" : "Fund"}</th>
              {data.map((d) => (
                <td key={d.year} className={`px-1 py-0.5 font-mono ${d.fund == null ? "text-subtle" : d.fund >= 0 ? "text-up" : "text-down"}`}>
                  {pct(d.fund)}
                </td>
              ))}
            </tr>
            <tr>
              <th className="pr-2 text-left whitespace-nowrap font-normal text-muted">{zh ? "同類" : "Peers"}</th>
              {data.map((d) => (
                <td key={d.year} className="px-1 py-0.5 font-mono text-muted">
                  {pct(d.peers)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
