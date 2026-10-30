import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copy, t } from "@/lib/i18n";
import { catalogMeta } from "@/lib/mpf/catalog";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ResetButton } from "@/components/layout/reset-button";
import { cn } from "@/lib/utils";
import { MkEcard, MkPrintHead, shareCurrent, useShareAvailable } from "@/components/layout/mk-standard";

// 每個分頁一隻 MKPA 分類色（按 1→8 次序；首頁屬總覽，用宏利綠）；選中嗰粒掣用該色做底
const NAV = [
  { to: "/", key: "pulse" as const, color: "var(--mk-brand)", soft: "var(--mk-brand-soft)", ink: "var(--mk-brand-ink)" },
  { to: "/funds", key: "funds" as const, color: "var(--mk-cat-1)", soft: "var(--mk-cat-1-soft)", ink: "var(--mk-cat-1-ink)" },
  { to: "/schemes", key: "schemes" as const, color: "var(--mk-cat-2)", soft: "var(--mk-cat-2-soft)", ink: "var(--mk-cat-2-ink)" },
  { to: "/compare", key: "compare" as const, color: "var(--mk-cat-3)", soft: "var(--mk-cat-3-soft)", ink: "var(--mk-cat-3-ink)" },
  { to: "/checkup", key: "checkup" as const, color: "var(--mk-cat-4)", soft: "var(--mk-cat-4-soft)", ink: "var(--mk-cat-4-ink)" },
  { to: "/recommend", key: "recommend" as const, color: "var(--mk-cat-5)", soft: "var(--mk-cat-5-soft)", ink: "var(--mk-cat-5-ink)" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const compareIds = useAppStore((s) => s.compareIds);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const canShare = useShareAvailable();
  const navRef = useRef<HTMLDivElement>(null);
  // 手機上導覽左右捲動：轉頁時將選中嗰粒捲入畫面中間（只郁橫向，唔會捲成頁）
  useEffect(() => {
    const box = navRef.current;
    const el = box?.querySelector<HTMLElement>("[data-active='true']");
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [pathname]);
  // 目前分頁：成頁底色轉做該分頁淺底（--pc-soft），標題色條、細標題用該分頁顏色
  const page = NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to))) ?? NAV[0];
  const pageColor = page.color;
  const pageVars = { "--pc": page.color, "--pc-soft": page.soft, "--pc-ink": page.ink } as React.CSSProperties;

  const links = (onNavy: boolean) => (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1">
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            style={{ ["--nc" as string]: item.color, ["--ni" as string]: item.ink } as React.CSSProperties}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-2.5 text-sm font-medium transition-colors md:px-2 md:py-1.5 md:text-xs lg:px-3 lg:text-sm",
              onNavy
                ? active
                  ? "bg-[var(--ni)] font-semibold text-white"
                  : "text-canvas-muted hover:bg-white/10 hover:text-white"
                : active
                  ? "bg-[var(--ni)] font-semibold text-white"
                  : "text-muted hover:bg-bg-warm hover:text-fg",
            )}
          >
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", active ? "bg-white" : "bg-[var(--nc)]", onNavy && !active && "ring-2 ring-white/40")}
            />
            {t(locale, copy.nav[item.key])}
            {item.to === "/compare" && compareIds.length > 0 ? (
              <span className={cn("ml-1.5 font-mono text-xs", onNavy ? "text-primary" : "text-primary")}>
                ({compareIds.length})
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const navRow = (
    <div ref={navRef} className="mk-nav flex gap-1 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            data-active={active}
            style={{ ["--nc" as string]: item.color, ["--ni" as string]: item.ink } as React.CSSProperties}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap transition-colors",
              active ? "bg-[var(--ni)] font-semibold text-white" : "font-medium text-canvas-muted hover:bg-white/10 hover:text-white",
            )}
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", active ? "bg-white" : "bg-[var(--nc)] ring-2 ring-white/40")} />
            {t(locale, copy.nav[item.key])}
            {item.to === "/compare" && compareIds.length > 0 ? <span className="font-num text-xs">({compareIds.length})</span> : null}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="mk-page flex min-h-dvh flex-col" style={pageVars}>
      <header className="mk-header sticky top-0 z-40 border-b border-white/10 bg-[#0E5E57]/90 backdrop-blur-md">
        <div className="mk-wrap mk-bar">
          <Link to="/" className="mk-title text-white" aria-label={locale === "zh" ? "返回首頁" : "Home"}>
            <img className="mk-logo" src="/favicon.svg" alt="" width={32} height={32} />
            <span className="mk-name">
              {copy.app.zh}
              <small className="mk-sub">強積金成分基金分析及比較</small>
            </span>
          </Link>
          <div className="mk-actions">
            <Button asChild variant="ghost" size="icon" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">
              <Link to="/funds" search={{ focus: true }} aria-label={locale === "zh" ? "搜尋基金" : "Search funds"}>
                <Search className="size-5" />
              </Link>
            </Button>
            {canShare ? (
              <button type="button" className="mk-share-btn" onClick={shareCurrent}>
                {locale === "zh" ? (
                  <>
                    分享<span className="mk-long">呢個方案</span>
                  </>
                ) : (
                  "Share"
                )}
              </button>
            ) : null}
            <button type="button" className="mk-print-btn" onClick={() => window.print()}>
              {locale === "zh" ? (
                <>
                  列印<span className="mk-long"> / 存 PDF</span>
                </>
              ) : (
                <>
                  Print<span className="mk-long"> / PDF</span>
                </>
              )}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-xs text-white hover:bg-white/10 hover:text-white md:inline-flex"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            >
              {locale === "zh" ? "EN" : "繁"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setOpen(true)}
              aria-label={locale === "zh" ? "選單" : "Menu"}
            >
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
        <div className="mk-wrap border-t border-white/10">{navRow}</div>
        <div aria-hidden className="h-1 w-full" style={{ background: pageColor }} />
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <Link to="/" className="mb-6 flex items-center gap-2 pr-8 text-fg" onClick={() => setOpen(false)}>
            <img className="mk-logo !size-6" src="/favicon.svg" alt="" width={24} height={24} />
            <span className="text-lg font-semibold">{copy.app.zh}</span>
          </Link>
          {links(false)}
          <Link
            to="/glossary"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-md px-2.5 py-2.5 text-sm font-medium text-muted hover:bg-bg-warm hover:text-fg"
          >
            {locale === "zh" ? "強積金詞彙" : "Glossary"}
          </Link>
          <button
            type="button"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            className="mt-1 block w-full rounded-md px-2.5 py-2.5 text-left text-sm font-medium text-muted hover:bg-bg-warm hover:text-fg"
          >
            {locale === "zh" ? "English" : "繁體中文"}
          </button>
          <div className="mt-6 border-t border-border pt-4">
            <ResetButton className="w-full justify-center" onDone={() => setOpen(false)} />
            <p className="mt-2 text-xs text-subtle">
              {locale === "zh" ? "清走年齡、結餘、計劃、持有基金、比較清單同記低嘅配置。" : "Clears age, balance, scheme, holdings, compare list and saved mix."}
            </p>
          </div>
        </SheetContent>
      </Sheet>
      <main className="mk-wrap min-w-0 flex-1 py-5 sm:py-8">
        <MkPrintHead />
        {children}
      </main>
      <footer className="mk-footer-dark border-t border-white/10 bg-[#0E5E57]">
        <div className="mk-wrap py-6">
          <p className="w-full text-xs leading-relaxed text-canvas-muted">
            {t(locale, copy.disclaimer).replaceAll("{asOf}", catalogMeta.asOf)}
          </p>
          <p className="mt-2 text-xs text-canvas-muted">
            {locale === "zh"
              ? `基金數據截至 ${catalogMeta.asOf}（積金局每月更新）· ${catalogMeta.fundCount} 隻基金 · ${catalogMeta.schemeCount} 個計劃`
              : `MPFA data as of ${catalogMeta.asOf} (monthly) · ${catalogMeta.fundCount} funds · ${catalogMeta.schemeCount} schemes`}
          </p>
          <ResetButton className="mt-3 bg-white/5 text-canvas-muted ring-white/15 hover:bg-white/10 hover:text-white" />
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link to="/glossary" className="text-canvas-muted underline-offset-2 hover:text-white hover:underline">
              {locale === "zh" ? "強積金詞彙" : "Glossary"}
            </Link>
            <a href="https://mfp.mpfa.org.hk/" target="_blank" rel="noreferrer" className="text-canvas-muted underline-offset-2 hover:text-white hover:underline">
              {locale === "zh" ? "積金局基金平台" : "MPFA Fund Platform"}
            </a>
          </nav>
          <MkEcard zh={locale === "zh"} />
          <p className="mk-home-link text-center text-canvas">
            <a href="https://mkpa.netlify.app/" target="_blank" rel="noopener noreferrer">
              {locale === "zh" ? "MKPA 工具箱：睇其他實用工具 ↗" : "MKPA Toolbox: more tools ↗"}
            </a>
          </p>
          <p className="mk-copy text-center !text-canvas-muted">
            © {new Date().getFullYear()} Michael Koo Protection Alliance (MKPA). {locale === "zh" ? "版權所有。" : "All rights reserved."}
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
    <div className="mb-6 w-full min-w-0 animate-fade-up">
      {kicker ? (
        <p className="mb-2 font-mono text-xs tracking-[0.18em] text-[var(--pc-ink)] uppercase">{kicker}</p>
      ) : null}
      <h1 className="relative w-full pl-3.5 text-xl font-semibold tracking-tight text-[var(--pc-ink)] sm:text-3xl lg:text-4xl">
        <span className="absolute top-1 bottom-1 left-0 w-[3px] rounded-full bg-[var(--pc)]" />
        {title}
      </h1>
      {subtitle ? <p className="mt-2 w-full text-sm leading-relaxed text-canvas-muted sm:text-base">{subtitle}</p> : null}
    </div>
  );
}

/** Month-end after the current snapshot, e.g. 2026-08-31 → "9 月底". */
function nextSnapshotLabel(asOf: string, zh: boolean): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0));
  return zh ? `${next.getUTCMonth() + 1} 月底` : next.toISOString().slice(0, 10);
}

export function AsOfLine({ zh }: { zh: boolean }) {
  return (
    <p className="mb-5 w-full text-xs leading-relaxed text-canvas-muted">
      {zh
        ? `基金數據截至 ${catalogMeta.asOf}（積金局每月公布一次，截至${nextSnapshotLabel(catalogMeta.asOf, true)}嘅數字一出，網站會自動更新）。市場指數即時更新。`
        : `Fund data as of ${catalogMeta.asOf} (MPFA publishes monthly; the site updates automatically when the ${nextSnapshotLabel(catalogMeta.asOf, false)} figures appear). Market indices are live.`}
    </p>
  );
}

export function CompareHint() {
  const ids = useAppStore((s) => s.compareIds);
  const locale = useAppStore((s) => s.locale);
  const clear = useAppStore((s) => s.clearCompare);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Only a reminder while browsing funds; on other pages it just covers content.
  const browsing = pathname.startsWith("/funds") || pathname === "/schemes";
  if (!ids.length || !browsing) return null;
  return (
    <div className="fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-primary shadow-[var(--shadow-border)]">
      <Link to="/compare" className="text-sm">
        {locale === "zh" ? `比較 ${ids.length} 隻基金` : `Compare ${ids.length}`}
      </Link>
      <button type="button" onClick={clear} className="rounded-md p-1 text-muted hover:bg-bg-warm" aria-label="Clear">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
