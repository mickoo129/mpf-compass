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
    <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto pb-0.5">
      <PillRow periods={trailing} value={value} onChange={onChange} zh={zh} />
      <span className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
      <span className="shrink-0 text-[10px] tracking-wide text-canvas-muted">{zh ? "曆年" : "Cal."}</span>
      <PillRow periods={calendar} value={value} onChange={onChange} zh={zh} />
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
    <div className="inline-flex shrink-0 gap-1 rounded-lg bg-white/10 p-1">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "h-8 shrink-0 rounded-md px-2.5 text-xs whitespace-nowrap",
            value === p ? "bg-white text-fg shadow-sm" : "text-canvas-muted hover:text-white",
          )}
        >
          {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
        </button>
      ))}
    </div>
  );
}
