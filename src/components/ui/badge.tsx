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
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-white text-fg ring-1 ring-border",
        tone === "up" && "bg-up/12 text-up",
        tone === "down" && "bg-down/12 text-down",
        tone === "primary" && "bg-primary text-primary-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
