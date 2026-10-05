import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * "下一位客人": wipes everything typed for the current client (age, balance,
 * scheme, holdings in the link, compare list, saved mix) and returns home.
 * Two taps, so it cannot be triggered by accident mid-presentation.
 */
export function ResetButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const zh = useAppStore((s) => s.locale) === "zh";
  const reset = useAppStore((s) => s.resetSession);
  const navigate = useNavigate();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        reset();
        setArmed(false);
        onDone?.();
        // Holdings and searches live in the URL, so leaving the page clears them too.
        void navigate({ to: "/", replace: true });
        window.scrollTo({ top: 0 });
        toast(zh ? "已清空，可以開始下一位。" : "Cleared. Ready for the next client.");
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        armed ? "bg-down text-white" : "text-muted ring-1 ring-border hover:bg-bg-warm hover:text-fg",
        className,
      )}
      aria-live="polite"
    >
      <RotateCcw className="size-4" />
      {armed ? (zh ? "再撳一次確認清空" : "Tap again to clear") : zh ? "下一位客人（清空資料）" : "Next client (clear data)"}
    </button>
  );
}
