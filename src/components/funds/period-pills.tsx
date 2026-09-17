import { MEDIAN_PERIODS, PERIOD_LABEL, type MedianPeriod } from "@/lib/mpf/returns";
import { cn } from "@/lib/utils";

const CAL_START = MEDIAN_PERIODS.indexOf("y2025");

export function PeriodPills({
  value,
  onChange,
  zh,
}: {
  value: MedianPeriod;
  onChange: (p: MedianPeriod) => void;
  zh: boolean;
}) {
  const trailing = MEDIAN_PERIODS.slice(0, CAL_START);
  const calendar = MEDIAN_PERIODS.slice(CAL_START);
  return (
    <div className="flex flex-col gap-1">
      <PillRow periods={trailing} value={value} onChange={onChange} zh={zh} />
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] tracking-wide text-canvas-muted">{zh ? "曆年" : "Calendar"}</span>
        <PillRow periods={calendar} value={value} onChange={onChange} zh={zh} />
      </div>
    </div>
  );
}

function PillRow({
  periods,
  value,
  onChange,
  zh,
}: {
  periods: readonly MedianPeriod[];
  value: MedianPeriod;
  onChange: (p: MedianPeriod) => void;
  zh: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-white/10 p-1">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "h-8 rounded-md px-2.5 text-xs",
            value === p ? "bg-white text-fg shadow-sm" : "text-canvas-muted hover:text-white",
          )}
        >
          {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
        </button>
      ))}
    </div>
  );
}
