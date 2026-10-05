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
    // Two labelled rows so nothing has to scroll sideways on a phone.
    <div className="flex min-w-0 max-w-full flex-col gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-xs text-canvas-muted">{zh ? "年期" : "Span"}</span>
        <PillRow periods={trailing} value={value} onChange={onChange} zh={zh} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 shrink-0 text-xs text-canvas-muted">{zh ? "曆年" : "Year"}</span>
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
    <div className="inline-flex min-w-0 flex-wrap gap-1 rounded-lg bg-white/10 p-1">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "h-9 shrink-0 rounded-md px-2 text-xs whitespace-nowrap sm:px-2.5",
            value === p ? "bg-white text-fg shadow-sm" : "text-canvas-muted hover:text-white",
          )}
        >
          {zh ? PERIOD_LABEL[p].zh : PERIOD_LABEL[p].en}
        </button>
      ))}
    </div>
  );
}
