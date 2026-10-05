import { fmtPct, retClass } from "@/lib/mpf/format";
import { cn } from "@/lib/utils";

export function ReturnCell({
  value,
  className,
  digits = 2,
}: {
  value: number | null | undefined;
  className?: string;
  digits?: number;
}) {
  return <span className={cn("font-mono tabular-nums", retClass(value), className)}>{fmtPct(value, digits)}</span>;
}
