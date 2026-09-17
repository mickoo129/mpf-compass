import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "up" | "down" | "primary";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "neutral" && "bg-bg-warm text-muted",
        tone === "up" && "bg-up/10 text-up",
        tone === "down" && "bg-down/10 text-down",
        tone === "primary" && "bg-primary/10 text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}
