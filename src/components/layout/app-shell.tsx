import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Menu, X } from "lucide-react";
import { useState } from "react";
import { copy, t } from "@/lib/i18n";
import { catalogMeta } from "@/lib/mpf/catalog";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "pulse" as const },
  { to: "/funds", key: "funds" as const },
  { to: "/compare", key: "compare" as const },
  { to: "/recommend", key: "recommend" as const },
  { to: "/schemes", key: "schemes" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const compareIds = useAppStore((s) => s.compareIds);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-0">
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "rounded-md px-3 py-2.5 text-sm transition-colors md:py-1.5",
              active
                ? "bg-bg-warm text-fg md:bg-transparent md:text-fg md:underline md:underline-offset-8"
                : "text-muted hover:text-fg",
            )}
          >
            {t(locale, copy.nav[item.key])}
            {item.to === "/compare" && compareIds.length > 0 ? (
              <span className="ml-1.5 font-mono text-xs text-primary">({compareIds.length})</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg">
              <Compass className="size-4" strokeWidth={1.75} />
            </span>
            <span className="font-display text-lg leading-none tracking-tight">{copy.app.zh}</span>
            <span className="hidden text-[11px] tracking-wide text-subtle sm:inline">COMPASS</span>
          </Link>
          <div className="hidden md:block">{links}</div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            >
              {locale === "zh" ? "EN" : "繁"}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <div className="mb-6 flex items-center gap-2 pr-8">
            <Compass className="size-5 text-primary" />
            <span className="font-display text-lg">{copy.app.zh}</span>
          </div>
          {links}
        </SheetContent>
      </Sheet>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-border/80">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <p className="text-xs leading-relaxed text-subtle">{t(locale, copy.disclaimer)}</p>
          <p className="mt-2 font-mono text-[11px] text-subtle">
            MPFA {catalogMeta.asOf} · {catalogMeta.fundCount} funds · {catalogMeta.schemeCount} schemes
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PageTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 max-w-3xl animate-fade-up">
      {kicker ? (
        <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-subtle uppercase">{kicker}</p>
      ) : null}
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-muted sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

export function CompareHint() {
  const ids = useAppStore((s) => s.compareIds);
  const locale = useAppStore((s) => s.locale);
  const clear = useAppStore((s) => s.clearCompare);
  if (!ids.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-primary-fg shadow-[var(--shadow-border)]">
      <Link to="/compare" className="text-sm">
        {locale === "zh" ? `比較 ${ids.length} 隻基金` : `Compare ${ids.length}`}
      </Link>
      <button type="button" onClick={clear} className="rounded-md p-1 hover:bg-white/10" aria-label="Clear">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
