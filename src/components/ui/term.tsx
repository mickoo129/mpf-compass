import * as Popover from "@radix-ui/react-popover";
import { Link } from "@tanstack/react-router";
import { GLOSSARY, type TermKey } from "@/lib/glossary";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Label with a small "?" that opens a plain-language explanation. A popover,
 * not a hover tooltip, so it works with a tap on phones.
 */
export function Term({ k, children, className }: { k: TermKey; children?: React.ReactNode; className?: string }) {
  const zh = useAppStore((s) => s.locale) === "zh";
  const t = GLOSSARY[k];
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children ?? (zh ? t.zh : t.en)}
      <Popover.Root>
        <Popover.Trigger
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[0.65rem] leading-none font-semibold opacity-60 hover:opacity-100"
          aria-label={zh ? `${t.zh}係咩？` : `What is ${t.en}?`}
          onClick={(e) => e.stopPropagation()}
        >
          ?
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            collisionPadding={12}
            className="z-50 max-w-[18rem] rounded-lg bg-ink p-3 text-left text-sm leading-relaxed font-normal text-white shadow-[var(--shadow-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 font-medium">{zh ? t.zh : t.en}</p>
            <p className="text-white/85">{zh ? t.bodyZh : t.bodyEn}</p>
            <Link to="/glossary" className="mt-2 inline-block text-xs text-accent underline-offset-2 hover:underline">
              {zh ? "全部詞彙" : "All terms"}
            </Link>
            <Popover.Arrow className="fill-ink" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
