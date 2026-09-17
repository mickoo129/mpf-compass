import { MEDIAN_PERIODS, PERIOD_LABEL, type MedianPeriod } from "@/lib/mpf/returns";
import { cn } from "@/lib/utils";

export function PeriodPills({
  value,
  onChange,
  zh,
}: {
  value: MedianPeriod;
  onChange: (p: MedianPeriod) => void;
  zh: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-bg-warm p-1">
      {MEDIAN_PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "h-8 rounded-md px-2.5 text-xs",
            value === p ? "bg-card text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
          )}
        >
          {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
        </button>
      ))}
    </div>
  );
}
