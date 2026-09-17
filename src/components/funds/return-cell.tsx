import { fmtPct, retClass } from "@/lib/mpf/format";
import { cn } from "@/lib/utils";

export function ReturnCell({ value, className }: { value: number | null | undefined; className?: string }) {
  return (
    <span className={cn("font-mono tabular-nums", retClass(value), className)}>{fmtPct(value)}</span>
  );
}
