import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cheapestAnywhere, cheapestSwitch } from "@/lib/mpf/fee-peers";
import { annualFee, FEE_GAP_GROSS, FEE_UNIT, feeGap } from "@/lib/mpf/fees";
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
export function FeeAmount({ fer, zh, className }: { fer: number | null | undefined; zh: boolean; className?: string }) {
  const balance = useAppStore((s) => s.profile.balance);
  const base = balance > 0 ? balance : FEE_UNIT;
  const fee = annualFee(base, fer);
  if (fee == null) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {fmtHkd(fee)}
      <span className="text-subtle">{balance > 0 ? (zh ? "／年" : "/yr") : zh ? "／年（每 $1 萬）" : "/yr per 10k"}</span>
    </span>
  );
}

export function FeeCard({ fund, zh, className }: { fund: Fund; zh: boolean; className?: string }) {
  const balance = useAppStore((s) => s.profile.balance);
  const monthly = useAppStore((s) => s.profile.monthly);
  const age = useAppStore((s) => s.profile.age);
  const retireAge = useAppStore((s) => s.profile.retireAge);
  const years = Math.max(5, retireAge - age);
  const base = balance > 0 ? balance : FEE_UNIT;
  const fee = annualFee(base, fund.fer);
  const inScheme = cheapestSwitch(fund);
  const anywhere = cheapestAnywhere(fund);
  const alt = inScheme ?? anywhere;
  const altFee = alt ? annualFee(base, alt.fer) : null;
  const gap = alt && fund.fer != null && alt.fer != null ? feeGap(base, monthly, years, fund.fer, alt.fer) : null;

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
      {fee != null ? (
        <p className="mt-4 text-sm">
          {balance > 0
            ? zh
              ? `以你 ${fmtHkd(balance)} 結餘計，每年收費約 `
              : `On your ${fmtHkd(balance)}, about `
            : zh
              ? "每 $10,000 結餘，每年收費約 "
              : "Per HK$10,000, about "}
          <b className="font-mono text-lg">{fmtHkd(fee)}</b>
          {zh ? "。" : " a year."}
          {balance > 0 ? null : (
            <span className="block text-xs text-subtle">{zh ? "填上你嘅結餘，就會用你自己嘅金額計。" : "Enter your balance to use your own amount."}</span>
          )}
        </p>
      ) : null}

      {alt && altFee != null && fee != null && gap != null ? (
        <div className="mt-4 rounded-lg bg-tint-mint p-3 text-sm">
          <p className="text-xs text-muted">
            {inScheme
              ? zh
                ? "同一計劃入面，同類最低收費"
                : "Cheapest same-type fund in this scheme"
              : zh
                ? "其他計劃入面，同類最低收費（個人帳戶可轉）"
                : "Cheapest same-type fund in another scheme"}
          </p>
          <Link to="/funds/$id" params={{ id: alt.id }} className="font-medium hover:underline">
            {zh ? alt.nameZh : alt.nameEn}
          </Link>
          <span className="ml-1 text-xs text-subtle">{zh ? alt.schemeZh : alt.schemeEn}</span>
          <p className="mt-1">
            {zh ? "每年約 " : "About "}
            <b className="font-mono">{fmtHkd(altFee)}</b>
            {zh ? "，每年慳 " : " a year, saving "}
            <b className="font-mono text-up">{fmtHkd(fee - altFee)}</b>
          </p>
          <p className="mt-1">
            {zh ? `${years} 年累積落嚟，收費差距大約 ` : `Over ${years} years the gap is about `}
            <b className="font-mono text-up">{fmtHkd(gap)}</b>
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {zh
              ? `假設兩隻基金扣費前回報一樣（每年 ${FEE_GAP_GROSS}%）${monthly > 0 ? `、每月供款 ${fmtHkd(monthly)}` : ""}，計到 ${retireAge} 歲。實際回報唔同，收費平唔代表表現一定好。`
              : `Assumes the same ${FEE_GAP_GROSS}% return before fees${monthly > 0 ? ` and ${fmtHkd(monthly)} a month` : ""}, to age ${retireAge}. Cheaper does not mean better performance.`}
          </p>
        </div>
      ) : fund.fer != null ? (
        <p className="mt-4 rounded-lg bg-tint-mint p-3 text-sm">
          {zh ? "呢隻已經係同類之中收費最低。" : "Already the cheapest fund of its type."}
        </p>
      ) : null}
    </Card>
  );
}
