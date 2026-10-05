import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cheapestAnywhere, cheapestSwitch } from "@/lib/mpf/fee-peers";
import { annualFee, EXAMPLE_BALANCE, EXAMPLE_MONTHLY, FEE_GAP_GROSS, FEE_UNIT, feeGap } from "@/lib/mpf/fees";
import { fmtHkd, fmtPctPlain } from "@/lib/mpf/format";
import type { Fund } from "@/lib/mpf/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** HK$ amount box bound to the shared profile, so a balance typed once is used on every page this visit. */
export function BalanceInput({
  zh,
  field = "balance",
  label,
  className,
}: {
  zh: boolean;
  field?: "balance" | "monthly";
  label?: string;
  className?: string;
}) {
  const value = useAppStore((s) => s.profile[field]);
  const setProfile = useAppStore((s) => s.setProfile);
  const [text, setText] = useState(value ? String(Math.round(value)) : "");
  useEffect(() => {
    setText((cur) => (Number(cur || 0) === value ? cur : value ? String(Math.round(value)) : ""));
  }, [value]);
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs text-muted">
        {label ?? (field === "balance" ? (zh ? "你嘅結餘（港元）" : "Your balance (HK$)") : zh ? "每月供款（港元）" : "Monthly contribution (HK$)")}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-subtle">$</span>
        <Input
          inputMode="numeric"
          value={text ? Number(text).toLocaleString("en-HK") : ""}
          placeholder={field === "balance" ? (zh ? "例如 80,000" : "e.g. 80,000") : zh ? "例如 3,000" : "e.g. 3,000"}
          className="pl-7 font-mono"
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
            setText(raw);
            setProfile({ [field]: raw === "" ? 0 : Number(raw) });
          }}
        />
      </span>
    </label>
  );
}

/** "每年收費 $xxx" for a FER, on the member's balance or per HK$10,000. */
export function FeeAmount({
  fer,
  zh,
  className,
  unit = true,
}: {
  fer: number | null | undefined;
  zh: boolean;
  className?: string;
  /** Show "（每 $1 萬）" when no balance is entered; turn off where the heading already says it. */
  unit?: boolean;
}) {
  const balance = useAppStore((s) => s.profile.balance);
  const base = balance > 0 ? balance : FEE_UNIT;
  const fee = annualFee(base, fer);
  if (fee == null) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {fmtHkd(fee)}
      <span className="text-subtle">
        {zh ? "／年" : "/yr"}
        {balance > 0 || !unit ? "" : zh ? "（每 $1 萬）" : " per 10k"}
      </span>
    </span>
  );
}

export { EXAMPLE_BALANCE, EXAMPLE_MONTHLY };

export function FeeCard({ fund, zh, className }: { fund: Fund; zh: boolean; className?: string }) {
  const balance = useAppStore((s) => s.profile.balance);
  const monthly = useAppStore((s) => s.profile.monthly);
  const age = useAppStore((s) => s.profile.age);
  const retireAge = useAppStore((s) => s.profile.retireAge);
  const years = Math.max(5, retireAge - age);
  // A per-$10,000 saving looks trivial ("$51 a year"), so with nothing entered
  // the card illustrates with a typical balance and says so.
  const example = balance <= 0;
  const base = example ? EXAMPLE_BALANCE : balance;
  const perMonth = example && monthly <= 0 ? EXAMPLE_MONTHLY : monthly;
  const fee = annualFee(base, fund.fer);
  const inScheme = cheapestSwitch(fund);
  const anywhere = cheapestAnywhere(fund);
  const alts = [
    inScheme ? { fund: inScheme, labelZh: "同一計劃入面，同類收費最低", labelEn: "Cheapest same-type fund in this scheme" } : null,
    anywhere && anywhere.id !== inScheme?.id && (anywhere.fer ?? 9) < (inScheme?.fer ?? 9)
      ? { fund: anywhere, labelZh: "其他計劃入面，同類收費最低（只適用於可以轉計劃嘅個人帳戶）", labelEn: "Cheapest same-type fund in another scheme (personal accounts only)" }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <Card className={className}>
      <h2 className="mb-1 font-display text-lg">{zh ? "收費以港幣計" : "Fees in HK$"}</h2>
      <p className="mb-3 text-xs text-muted">
        {zh
          ? `開支比率 ${fmtPctPlain(fund.fer)} 係每年從基金資產扣除嘅總收費（已包括管理費、受託人費等）。`
          : `FER ${fmtPctPlain(fund.fer)} is the total yearly cost taken from the fund.`}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <BalanceInput zh={zh} />
        <BalanceInput zh={zh} field="monthly" />
      </div>
      {example ? (
        <p className="mt-3 rounded-md bg-tint-sand px-3 py-2 text-xs text-fg">
          {zh
            ? `未填結餘，以下用結餘 ${fmtHkd(EXAMPLE_BALANCE)}、每月供款 ${fmtHkd(perMonth)} 做例子。填返實際數字就會即時更新。`
            : `No balance entered; illustrated with ${fmtHkd(EXAMPLE_BALANCE)} and ${fmtHkd(perMonth)} a month.`}
        </p>
      ) : null}
      {fee != null ? (
        <p className="mt-3 text-sm">
          {zh ? `${fmtHkd(base)} 結餘，每年收費約 ` : `On ${fmtHkd(base)}, about `}
          <b className="font-mono text-lg">{fmtHkd(fee)}</b>
          {zh ? "。" : " a year."}
        </p>
      ) : null}

      {fee != null && fund.fer != null && alts.length ? (
        alts.map(({ fund: alt, labelZh, labelEn }) => {
          const altFee = annualFee(base, alt.fer) ?? 0;
          const gap = feeGap(base, perMonth, years, fund.fer!, alt.fer!);
          return (
            <div key={alt.id} className="mt-3 rounded-lg bg-tint-mint p-3 text-sm">
              <p className="text-xs text-muted">{zh ? labelZh : labelEn}</p>
              <Link to="/funds/$id" params={{ id: alt.id }} className="font-medium hover:underline">
                {zh ? alt.nameZh : alt.nameEn}
              </Link>
              <span className="block text-xs text-subtle">
                {zh ? alt.schemeZh : alt.schemeEn} · {zh ? "開支比率" : "FER"} {fmtPctPlain(alt.fer)}
              </span>
              <p className="mt-1">
                {zh ? "每年約 " : "About "}
                <b className="font-mono">{fmtHkd(altFee)}</b>
                {zh ? "，每年少收 " : " a year, "}
                <b className="font-mono text-up">{fmtHkd(fee - altFee)}</b>
                {zh ? "；" : " less; "}
                {zh ? `到 ${retireAge} 歲累積相差約 ` : `by ${retireAge} the gap is about `}
                <b className="font-mono text-up">{fmtHkd(gap)}</b>
              </p>
            </div>
          );
        })
      ) : fund.fer != null ? (
        <p className="mt-3 rounded-lg bg-tint-mint p-3 text-sm">{zh ? "呢隻已經係同類之中收費最低。" : "Already the cheapest fund of its type."}</p>
      ) : null}
      {alts.length ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {zh
            ? `累積相差假設兩隻基金扣費前回報一樣（每年 ${FEE_GAP_GROSS}%）。實際回報唔同，收費平唔代表表現一定好。`
            : `Gap assumes the same ${FEE_GAP_GROSS}% return before fees. Cheaper does not mean better performance.`}
        </p>
      ) : null}
    </Card>
  );
}
