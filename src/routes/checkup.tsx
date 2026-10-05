import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { BalanceInput } from "@/components/funds/fee-card";
import { FundPicker } from "@/components/funds/fund-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Term } from "@/components/ui/term";
import { fundById, SLEEVE_LABEL, uniqueSchemes } from "@/lib/mpf/catalog";
import { regionLabel, runCheckup, type Light } from "@/lib/mpf/checkup";
import { fmtPctPlain } from "@/lib/mpf/format";
import { useAppStore } from "@/lib/store";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

type CheckupSearch = { s?: string; h?: string };

export const Route = createFileRoute("/checkup")({
  // ?s=<scheme>&h=<fundId>:<pct>,… keeps a checkup in the link so an adviser can send it.
  validateSearch: (raw: Record<string, unknown>): CheckupSearch => ({
    s: typeof raw.s === "string" && raw.s ? raw.s : undefined,
    h: typeof raw.h === "string" && raw.h ? raw.h : undefined,
  }),
  head: ({ match }) => {
    const { s, h } = match.search as CheckupSearch;
    const rows = parseHoldings(h);
    const funds = rows.map((r) => fundById(r.id)).filter((f): f is NonNullable<typeof f> => f != null);
    const scheme = funds[0]?.schemeZh ?? uniqueSchemes().find((x) => x.en === s)?.zh;
    return {
      meta: seo(
        funds.length
          ? {
              title: `強積金健康檢查：${funds.length} 隻基金`,
              description: `${scheme ?? ""}：${rows.map((r) => `${r.pct}% ${fundById(r.id)?.nameZh}`).join("、")}。睇收費、風險、分散程度同表現。`,
              path: "/checkup",
            }
          : { title: "我嘅強積金健康檢查", description: "揀返你嘅計劃同基金，檢查收費、風險同年齡、分散程度同表現。唔會上傳你嘅資料。", path: "/checkup" },
      ),
    };
  },
  component: CheckupPage,
});

type Row = { id: string; pct: number };

function parseHoldings(h: string | undefined): Row[] {
  if (!h) return [];
  return h
    .split(",")
    .map((p) => {
      const [id, pct] = p.split(":");
      return { id: id ?? "", pct: Math.max(0, Math.min(100, Number(pct) || 0)) };
    })
    .filter((r) => fundById(r.id));
}

const LIGHT: Record<Light, { zh: string; en: string; cls: string; dot: string }> = {
  good: { zh: "良好", en: "OK", cls: "bg-tint-mint", dot: "bg-up" },
  watch: { zh: "留意", en: "Watch", cls: "bg-tint-sand", dot: "bg-warn" },
  act: { zh: "值得檢討", en: "Review", cls: "bg-[#fbe9e6]", dot: "bg-down" },
};

function CheckupPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/checkup" });
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const schemes = uniqueSchemes();

  const [scheme, setScheme] = useState<string>(search.s ?? "");
  const [rows, setRows] = useState<Row[]>(() => parseHoldings(search.h));
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(() => parseHoldings(search.h).length > 0);


  const total = rows.reduce((s, r) => s + r.pct, 0);
  const ready = rows.length > 0 && Math.abs(total - 100) <= 1;

  const result = useMemo(() => {
    if (!ready) return null;
    const holdings = rows
      .map((r) => ({ fund: fundById(r.id)!, weight: r.pct / total }))
      .filter((h) => h.fund);
    return runCheckup(holdings, profile);
  }, [ready, rows, total, profile]);

  function syncUrl(nextScheme: string, nextRows: Row[]) {
    void navigate({
      search: {
        s: nextScheme || undefined,
        h: nextRows.length ? nextRows.map((r) => `${r.id}:${r.pct}`).join(",") : undefined,
      },
      replace: true,
    });
  }
  function update(nextRows: Row[]) {
    setRows(nextRows);
    syncUrl(scheme, nextRows);
  }
  function pickScheme(next: string) {
    setScheme(next);
    setRows([]);
    setTouched(false);
    syncUrl(next, []);
    if (next) setProfile({ schemeEn: next, account: "contribution" });
  }
  function addFund(id: string) {
    if (!id || rows.some((r) => r.id === id)) return;
    // Until a percentage is typed by hand, keep the split even so adding three
    // funds gives a usable 34/33/33 straight away.
    if (!touched) {
      const n = rows.length + 1;
      const each = Math.floor(100 / n);
      update([...rows, { id, pct: 0 }].map((r, i) => ({ ...r, pct: i === 0 ? 100 - each * (n - 1) : each })));
      return;
    }
    update([...rows, { id, pct: Math.max(0, 100 - total) }]);
  }
  function spreadEvenly() {
    if (!rows.length) return;
    const each = Math.floor(100 / rows.length);
    update(rows.map((r, i) => ({ ...r, pct: i === 0 ? 100 - each * (rows.length - 1) : each })));
  }
  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text: zh ? "強積金健康檢查（積金羅盤）" : "MPF checkup", url });
        return;
      } catch {
        /* fall back to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(zh ? "複製以下連結：" : "Copy this link:", url);
    }
  }

  return (
    <div>
      <PageTitle
        kicker={zh ? "健康檢查" : "Checkup"}
        title={zh ? "我嘅強積金健康檢查" : "My MPF checkup"}
        subtitle={
          zh
            ? "揀返你而家嘅計劃同持有嘅基金，睇下收費、風險、分散程度同表現有冇需要留意。用積金局公開數據比較，唔會上傳你嘅資料。"
            : "Pick your scheme and current funds to review fees, risk, spread and performance against public MPFA data."
        }
      />
      <AsOfLine zh={zh} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-5">
          <Card>
            <h2 className="mb-1 font-display text-lg">{zh ? "1. 你而家嘅計劃" : "1. Your scheme"}</h2>
            <p className="mb-2 text-xs text-muted">
              {zh ? "唔肯定？可以喺「積金易」App 或者周年權益報表睇到。" : "Not sure? Check the eMPF app or your annual benefit statement."}
            </p>
            <select
              className="h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg shadow-[var(--shadow-border)] [color-scheme:light]"
              value={scheme}
              onChange={(e) => pickScheme(e.target.value)}
            >
              <option value="">{zh ? "請選擇計劃" : "Select scheme"}</option>
              {schemes.map((s) => (
                <option key={s.en} value={s.en}>
                  {zh ? s.zh : s.en}
                </option>
              ))}
            </select>
          </Card>

          <Card className={cn(!scheme && "opacity-60")}>
            <h2 className="mb-1 font-display text-lg">{zh ? "2. 你持有嘅基金同比例" : "2. Your funds and split"}</h2>
            <p className="mb-3 text-xs text-muted">
              {zh ? "逐隻加入，會先平均分配；知道實際比例就改返每隻嘅 %。" : "Add each fund; they are split evenly until you type the real shares."}
            </p>
            {rows.length ? (
              <ul className="mb-3 space-y-2">
                {rows.map((r, i) => {
                  const f = fundById(r.id)!;
                  return (
                    <li key={r.id} className="flex items-center gap-2 rounded-lg bg-tint-sky p-2">
                      <span className="min-w-0 flex-1 text-sm">
                        {zh ? f.nameZh : f.nameEn}
                        <span className="block text-xs text-subtle">
                          {SLEEVE_LABEL[f.sleeve]?.[zh ? "zh" : "en"]} · {zh ? "開支比率" : "FER"} {fmtPctPlain(f.fer)}
                        </span>
                      </span>
                      <span className="relative w-20 shrink-0">
                        <Input
                          inputMode="numeric"
                          value={r.pct ? String(r.pct) : ""}
                          placeholder="0"
                          aria-label={zh ? "比例" : "Share"}
                          className="pr-6 text-right font-mono"
                          onChange={(e) => {
                            setTouched(true);
                            const v = Math.min(100, Number(e.target.value.replace(/[^\d]/g, "")) || 0);
                            update(rows.map((x, j) => (j === i ? { ...x, pct: v } : x)));
                          }}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-subtle">%</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-2 text-subtle hover:text-down"
                        aria-label={zh ? "移除" : "Remove"}
                        onClick={() => update(rows.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <FundPicker
              zh={zh}
              schemeEn={scheme || undefined}
              exclude={rows.map((r) => r.id)}
              disabled={!scheme}
              onPick={(f) => addFund(f.id)}
              placeholder={
                !scheme
                  ? zh
                    ? "先揀上面嘅計劃"
                    : "Pick a scheme first"
                  : zh
                    ? "撳呢度揀基金，或者打名搵（例如：北美）"
                    : "Tap to choose, or type a name"
              }
            />
            {rows.length ? (
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <span className={cn("font-mono", ready ? "text-up" : "text-warn")}>
                  {zh ? "合共 " : "Total "}
                  {total}%{ready ? " ✓" : zh ? `（仲差 ${100 - total}%）` : ` (${100 - total}% to go)`}
                </span>
                {rows.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={spreadEvenly}>
                    {zh ? "平均分配" : "Split evenly"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg">{zh ? "3. 你嘅情況（可選）" : "3. About you (optional)"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">{zh ? "年齡" : "Age"}</span>
                <Input
                  inputMode="numeric"
                  value={String(profile.age)}
                  onChange={(e) => setProfile({ age: Math.min(64, Math.max(18, Number(e.target.value.replace(/[^\d]/g, "")) || 18)) })}
                  className="font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">{zh ? "預計退休年齡" : "Retire at"}</span>
                <Input
                  inputMode="numeric"
                  value={String(profile.retireAge)}
                  onChange={(e) => setProfile({ retireAge: Math.min(70, Math.max(50, Number(e.target.value.replace(/[^\d]/g, "")) || 65)) })}
                  className="font-mono"
                />
              </label>
              <BalanceInput zh={zh} />
              <BalanceInput zh={zh} field="monthly" />
            </div>
            <p className="mt-2 text-xs text-subtle">
              {zh ? "填咗結餘，收費會用實際金額計；唔填就用 $200,000 做例子。" : "With a balance, fees use the real amount; otherwise a HK$200,000 example."}
            </p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-7">
          {!result ? (
            <Card className="border-dashed">
              <h2 className="mb-1 font-display text-lg">{zh ? "檢查結果" : "Results"}</h2>
              <p className="text-sm text-muted">
                {!scheme
                  ? zh
                    ? "先揀你嘅計劃。"
                    : "Pick your scheme first."
                  : !rows.length
                    ? zh
                      ? "再加入你持有嘅基金。"
                      : "Add the funds you hold."
                    : zh
                      ? `比例加埋要等於 100%（而家係 ${total}%）。`
                      : `Shares must add up to 100% (now ${total}%).`}
              </p>
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl">{zh ? "檢查結果" : "Results"}</h2>
                    <p className="text-xs text-muted">
                      {zh
                        ? `${result.items.filter((i) => i.light === "good").length} 項良好、${result.items.filter((i) => i.light === "watch").length} 項留意、${result.items.filter((i) => i.light === "act").length} 項值得檢討`
                        : `${result.items.filter((i) => i.light === "good").length} OK, ${result.items.filter((i) => i.light !== "good").length} to look at`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => void share()}>
                    {copied ? (zh ? "已複製連結" : "Link copied") : zh ? "分享結果" : "Share"}
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label={<Term k="fer">{zh ? "平均開支比率" : "Avg FER"}</Term>} value={result.fer != null ? `${result.fer.toFixed(2)}%` : "—"} />
                  <Stat label={<Term k="risk">{zh ? "平均風險級別" : "Avg risk"}</Term>} value={result.riskClass != null ? result.riskClass.toFixed(1) : "—"} />
                  <Stat label={zh ? "股票比重（估計）" : "Equity (est.)"} value={`${Math.round(result.equityShare * 100)}%`} />
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-xs text-muted">{zh ? "地區分佈" : "By market"}</p>
                  <div className="flex h-3 overflow-hidden rounded-full bg-border">
                    {result.regions.map((r, i) => (
                      <span
                        key={r.region}
                        style={{ width: `${r.share * 100}%`, opacity: 1 - i * 0.15 }}
                        className="h-full border-r border-white bg-primary last:border-0"
                        title={`${regionLabel(r.region, zh)} ${Math.round(r.share * 100)}%`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {result.regions.map((r) => `${regionLabel(r.region, zh)} ${Math.round(r.share * 100)}%`).join(zh ? "、" : ", ")}
                  </p>
                </div>
              </Card>

              {result.items.map((item) => (
                <Card key={item.key} className={LIGHT[item.light].cls}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn("size-2.5 shrink-0 rounded-full", LIGHT[item.light].dot)} aria-hidden />
                    <h3 className="font-display text-lg">{zh ? item.titleZh : item.titleEn}</h3>
                    <span className="ml-auto text-xs font-medium text-muted">{zh ? LIGHT[item.light].zh : LIGHT[item.light].en}</span>
                  </div>
                  <p className="text-sm text-fg">{zh ? item.bodyZh : item.bodyEn}</p>
                  {item.ideas?.length && item.light !== "good" ? (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium text-muted">{zh ? "計劃內值得留意" : "Worth a look in this scheme"}</p>
                      <ul className="space-y-1.5">
                        {item.ideas.map((idea) => (
                          <li key={idea.fund.id + idea.zh}>
                            <Link to="/funds/$id" params={{ id: idea.fund.id }} className="block rounded-md bg-white/70 px-3 py-2 text-sm hover:bg-white">
                              <span className="font-medium">{zh ? idea.fund.nameZh : idea.fund.nameEn}</span>
                              <span className="block text-xs text-muted">{zh ? idea.zh : idea.en}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              ))}

              <p className="text-xs leading-relaxed text-canvas-muted">
                {zh
                  ? "以上係用積金局公開數據同一般原則對照你嘅組合，唔係投資建議。收費平或者過往表現好，唔代表將來一定好。轉換前請細閱計劃文件，有需要可以搵持牌中介人傾。"
                  : "A comparison against public MPFA data and general rules, not investment advice. Read the scheme documents before switching."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="rounded-lg bg-tint-sky px-2 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value}</p>
    </div>
  );
}
