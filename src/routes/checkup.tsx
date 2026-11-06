import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AsOfLine, PageTitle } from "@/components/layout/app-shell";
import { useShareLink } from "@/components/layout/mk-standard";
import { BalanceInput } from "@/components/funds/fee-card";
import { FundPicker } from "@/components/funds/fund-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IntField, MoneyField } from "@/components/ui/number-field";
import { Term } from "@/components/ui/term";
import { fundById, SLEEVE_LABEL, uniqueSchemes } from "@/lib/mpf/catalog";
import { regionLabel, runCheckup, type Light } from "@/lib/mpf/checkup";
import { fmtPctPlain } from "@/lib/mpf/format";
import { useAppStore } from "@/lib/store";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

type CheckupSearch = { s?: string; h?: string; m?: "a" };

export const Route = createFileRoute("/checkup")({
  // ?s=<scheme>&h=<fundId>:<pct>,… keeps a checkup in the link so an adviser can send it.
  // With &m=a the numbers after ":" are HK$ amounts (market value) instead of %.
  validateSearch: (raw: Record<string, unknown>): CheckupSearch => ({
    s: typeof raw.s === "string" && raw.s ? raw.s : undefined,
    h: typeof raw.h === "string" && raw.h ? raw.h : undefined,
    m: raw.m === "a" ? "a" : undefined,
  }),
  head: ({ match }) => {
    const { s, h, m } = match.search as CheckupSearch;
    const rows = toPctRows(parseHoldings(h, m === "a"), m === "a");
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

/** pct：比例模式嘅 %；amt：金額模式嘅港元市值（兩個戶口同一隻基金就加埋）。 */
type Row = { id: string; pct: number; amt: number };

function parseHoldings(h: string | undefined, amounts = false): Row[] {
  if (!h) return [];
  return h
    .split(",")
    .map((p) => {
      const [id, v] = p.split(":");
      const n = Math.max(0, Number(v) || 0);
      return amounts ? { id: id ?? "", pct: 0, amt: Math.min(n, 1e9) } : { id: id ?? "", pct: Math.min(100, n), amt: 0 };
    })
    .filter((r) => fundById(r.id));
}

/** 金額轉做整數百分比（加埋等於 100），俾 SEO 描述同切換模式用。 */
function toPctRows(rows: Row[], fromAmounts: boolean): Row[] {
  if (!fromAmounts) return rows;
  const sum = rows.reduce((t, r) => t + r.amt, 0);
  if (sum <= 0) return rows.map((r) => ({ ...r, pct: 0 }));
  const raw = rows.map((r) => (r.amt / sum) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((t, x) => t + x, 0);
  raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        out[i] = (out[i] ?? 0) + 1;
        left--;
      }
    });
  return rows.map((r, i) => ({ ...r, pct: out[i] ?? 0 }));
}

const LIGHT: Record<Light, { zh: string; en: string; cls: string; dot: string }> = {
  good: { zh: "良好", en: "OK", cls: "bg-tint-mint", dot: "bg-up" },
  watch: { zh: "留意", en: "Watch", cls: "bg-tint-sand", dot: "bg-warn" },
  act: { zh: "值得檢討", en: "Review", cls: "bg-[#FDECEC]", dot: "bg-down" },
};

function CheckupPage() {
  const locale = useAppStore((s) => s.locale);
  const zh = locale === "zh";
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/checkup" });
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const setCompare = useAppStore((s) => s.setCompare);
  const schemes = uniqueSchemes();

  const [scheme, setScheme] = useState<string>(search.s ?? "");
  const [byAmount, setByAmount] = useState(search.m === "a");
  const [rows, setRows] = useState<Row[]>(() => parseHoldings(search.h, search.m === "a"));
  const [touched, setTouched] = useState(() => parseHoldings(search.h).length > 0);

  const total = rows.reduce((s, r) => s + r.pct, 0);
  const amtTotal = rows.reduce((s, r) => s + r.amt, 0);
  const missingAmt = rows.filter((r) => r.amt <= 0).length;
  const ready = rows.length > 0 && (byAmount ? amtTotal > 0 && missingAmt === 0 : Math.abs(total - 100) <= 1);

  // 用金額嗰陣，結餘就係各基金金額加埋（收費、累積差距都用呢個數計）
  useEffect(() => {
    if (byAmount && amtTotal > 0 && amtTotal !== profile.balance) setProfile({ balance: amtTotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byAmount, amtTotal]);

  const result = useMemo(() => {
    if (!ready) return null;
    const holdings = rows
      .map((r) => ({ fund: fundById(r.id)!, weight: byAmount ? r.amt / amtTotal : r.pct / total }))
      .filter((h) => h.fund);
    return runCheckup(holdings, profile);
  }, [ready, rows, total, amtTotal, byAmount, profile]);

  function syncUrl(nextScheme: string, nextRows: Row[], amounts = byAmount) {
    void navigate({
      search: {
        s: nextScheme || undefined,
        h: nextRows.length ? nextRows.map((r) => `${r.id}:${amounts ? Math.round(r.amt) : r.pct}`).join(",") : undefined,
        m: amounts ? "a" : undefined,
      },
      replace: true,
    });
  }
  function update(nextRows: Row[]) {
    setRows(nextRows);
    syncUrl(scheme, nextRows);
  }
  function switchMode(amounts: boolean) {
    if (amounts === byAmount) return;
    let next: Row[];
    if (amounts) {
      // 比例 → 金額：有結餘就按比例分；冇就留空等你填
      next = rows.map((r) => ({ ...r, amt: profile.balance > 0 ? Math.round((profile.balance * r.pct) / 100) : 0 }));
    } else {
      next = toPctRows(rows, true);
      setTouched(true);
    }
    setByAmount(amounts);
    setRows(next);
    syncUrl(scheme, next, amounts);
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
    if (byAmount) {
      update([...rows, { id, pct: 0, amt: 0 }]);
      return;
    }
    // Until a percentage is typed by hand, keep the split even so adding three
    // funds gives a usable 34/33/33 straight away.
    if (!touched) {
      const n = rows.length + 1;
      const each = Math.floor(100 / n);
      update([...rows, { id, pct: 0, amt: 0 }].map((r, i) => ({ ...r, pct: i === 0 ? 100 - each * (n - 1) : each })));
      return;
    }
    update([...rows, { id, pct: Math.max(0, 100 - total), amt: 0 }]);
  }
  function spreadEvenly() {
    if (!rows.length) return;
    const each = Math.floor(100 / rows.length);
    update(rows.map((r, i) => ({ ...r, pct: i === 0 ? 100 - each * (rows.length - 1) : each })));
  }
  // 分享呢個方案：網址已經包住計劃同持有基金（?s=&h=），唔包任何姓名
  useShareLink(result ? () => window.location.href : null);

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

      {/* 列印版：一行講清楚客人情況（唔印輸入欄） */}
      <p className="mb-3 hidden rounded-lg border border-black/15 bg-white p-3 text-sm text-fg print:block">
        <b>{zh ? "客人情況：" : "Client: "}</b>
        {zh
          ? [
              scheme ? `計劃「${schemes.find((x) => x.en === scheme)?.zh ?? scheme}」` : "",
              `${profile.age} 歲`,
              `預計 ${profile.retireAge} 歲退休`,
              profile.balance > 0 ? `結餘 $${profile.balance.toLocaleString("en-HK")}` : "結餘未填（收費以 $200,000 做例子）",
              profile.monthly > 0 ? `每月供款 $${profile.monthly.toLocaleString("en-HK")}` : "",
            ]
              .filter(Boolean)
              .join("、")
          : `Age ${profile.age}, retire at ${profile.retireAge}`}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-5">
          <Card className="print:hidden">
            <h2 className="mb-1 font-display text-lg">{zh ? "1. 你而家嘅計劃" : "1. Your scheme"}</h2>
            <p className="mb-2 text-xs text-muted">
              {zh ? "唔肯定？可以喺「積金易」App 或者周年權益報表睇到。" : "Not sure? Check the eMPF app or your annual benefit statement."}
            </p>
            <select
              className="h-11 w-full min-w-0 max-w-full truncate rounded-md bg-white px-3 text-sm text-fg border border-border focus:border-primary focus:outline-none [color-scheme:light]"
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
            <h2 className="mb-1 font-display text-lg">
              <span className="print:hidden">{zh ? (byAmount ? "2. 你持有嘅基金同金額" : "2. 你持有嘅基金同比例") : "2. Your funds and split"}</span>
              <span className="hidden print:inline">{zh ? "持有基金" : "Holdings"}</span>
            </h2>
            <div className="mb-2 inline-flex rounded-lg bg-black/5 p-1 text-sm print:hidden" role="tablist" aria-label={zh ? "輸入方式" : "Enter by"}>
              {([false, true] as const).map((amounts) => (
                <button
                  key={String(amounts)}
                  type="button"
                  role="tab"
                  aria-selected={byAmount === amounts}
                  onClick={() => switchMode(amounts)}
                  className={cn(
                    "h-9 rounded-md px-3 whitespace-nowrap",
                    byAmount === amounts ? "bg-white font-semibold text-fg shadow-sm" : "text-muted hover:text-fg",
                  )}
                >
                  {amounts ? (zh ? "用金額（港元）" : "By amount (HK$)") : zh ? "用百分比" : "By %"}
                </button>
              ))}
            </div>
            <p className="mb-3 text-xs text-muted print:hidden">
              {byAmount
                ? zh
                  ? "照住積金易或者周年權益報表，入每隻基金而家嘅市值。同一隻基金喺唔同戶口（例如供款戶口同個人戶口），將兩個金額加埋入。比例同結餘會自動計。"
                  : "Enter each fund's current value from your statement. If a fund sits in two accounts, add the amounts together."
                : zh
                  ? "逐隻加入，會先平均分配；知道實際比例就改返每隻嘅 %。"
                  : "Add each fund; they are split evenly until you type the real shares."}
            </p>
            {rows.length ? (
              <ul className="mb-3 space-y-2">
                {rows.map((r, i) => {
                  const f = fundById(r.id)!;
                  return (
                    <li key={r.id} className={cn("flex items-center gap-2 rounded-lg bg-tint-sky p-2", byAmount && "pb-5 print:pb-2")}>
                      <span className="min-w-0 flex-1 text-sm">
                        {zh ? f.nameZh : f.nameEn}
                        <span className="block text-xs text-subtle">
                          {SLEEVE_LABEL[f.sleeve]?.[zh ? "zh" : "en"]} · {zh ? "開支比率" : "FER"} {fmtPctPlain(f.fer)}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right font-num text-sm print:inline">
                        {byAmount ? (
                          <>
                            ${r.amt.toLocaleString("en-HK")}
                            <span className="block text-xs text-subtle">{amtTotal > 0 ? `${((r.amt / amtTotal) * 100).toFixed(0)}%` : ""}</span>
                          </>
                        ) : (
                          `${r.pct}%`
                        )}
                      </span>
                      {byAmount ? (
                        <span className="relative w-32 shrink-0 print:hidden">
                          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-subtle">$</span>
                          <MoneyField
                            value={r.amt}
                            placeholder={zh ? "市值" : "Value"}
                            aria-label={zh ? "金額（港元）" : "Amount (HK$)"}
                            className="pl-6 text-right"
                            onChange={(v) => update(rows.map((x, j) => (j === i ? { ...x, amt: v } : x)))}
                          />
                          <span className="absolute -bottom-4 right-1 text-[11px] text-subtle">
                            {amtTotal > 0 && r.amt > 0 ? `${((r.amt / amtTotal) * 100).toFixed(0)}%` : ""}
                          </span>
                        </span>
                      ) : (
                      <span className="relative w-20 shrink-0 print:hidden">
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
                      )}
                      <button
                        type="button"
                        className="shrink-0 rounded p-2 text-subtle hover:text-down print:hidden"
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
            <div className="print:hidden">
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
            </div>
            {rows.length ? (
              <div className="mt-3 flex items-center justify-between gap-2 text-sm print:hidden">
                {byAmount ? (
                  <span className={cn("font-mono", ready ? "text-up" : "text-warn")}>
                    {zh ? "合共 " : "Total "}${amtTotal.toLocaleString("en-HK")}
                    {ready ? " ✓" : zh ? `（仲有 ${missingAmt} 隻未填金額）` : ` (${missingAmt} without an amount)`}
                  </span>
                ) : (
                <span className={cn("font-mono", ready ? "text-up" : "text-warn")}>
                  {zh ? "合共 " : "Total "}
                  {total}%{ready ? " ✓" : zh ? `（仲差 ${100 - total}%）` : ` (${100 - total}% to go)`}
                </span>
                )}
                {!byAmount && rows.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={spreadEvenly}>
                    {zh ? "平均分配" : "Split evenly"}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {result ? (
              <Button asChild className="mt-3 w-full lg:hidden print:hidden">
                <a href="#result">
                  {zh
                    ? `睇檢查結果（${result.items.filter((i) => i.light !== "good").length} 項要留意）`
                    : `See results (${result.items.filter((i) => i.light !== "good").length} to look at)`}
                </a>
              </Button>
            ) : null}
          </Card>

          <Card className="print:hidden">
            <h2 className="mb-3 font-display text-lg">{zh ? "3. 你嘅情況（可選）" : "3. About you (optional)"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">{zh ? "年齡" : "Age"}</span>
                <IntField value={profile.age} min={18} max={64} onCommit={(n) => setProfile({ age: n })} aria-label={zh ? "年齡" : "Age"} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">{zh ? "預計退休年齡" : "Retire at"}</span>
                <IntField
                  value={profile.retireAge}
                  min={50}
                  max={70}
                  onCommit={(n) => setProfile({ retireAge: n })}
                  aria-label={zh ? "預計退休年齡" : "Retire at"}
                />
              </label>
              {byAmount ? (
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">{zh ? "結餘（港元）" : "Balance (HK$)"}</span>
                  <span className="flex h-11 items-center rounded-md border border-border bg-bg-warm/50 px-3 font-num text-sm">
                    ${amtTotal.toLocaleString("en-HK")}
                  </span>
                </label>
              ) : (
                <BalanceInput zh={zh} />
              )}
              <BalanceInput zh={zh} field="monthly" />
            </div>
            <p className="mt-2 text-xs text-subtle">
              {byAmount
                ? zh
                  ? "用金額輸入，結餘就係上面各基金金額加埋，收費會用呢個數計。"
                  : "In amount mode the balance is the sum of the amounts above."
                : zh
                  ? "填咗結餘，收費會用實際金額計；唔填就用 $200,000 做例子。"
                  : "With a balance, fees use the real amount; otherwise a HK$200,000 example."}
            </p>
          </Card>
        </div>

        <div id="result" className="min-w-0 scroll-mt-28 space-y-4 lg:col-span-7">
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
                    : byAmount
                      ? zh
                        ? `仲有 ${missingAmt} 隻基金未填金額。`
                        : `${missingAmt} fund(s) still need an amount.`
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
                  {item.compareIds && item.compareIds.length > 1 ? (
                    <div className="mt-3 print:hidden">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setCompare(item.compareIds!);
                          void navigate({ to: "/compare" });
                        }}
                      >
                        {zh ? "同全港同類基金並排比較" : "Compare with similar funds across schemes"}
                      </Button>
                      <p className="mt-1 text-xs text-muted">
                        {zh
                          ? "會擺你呢隻，同其他計劃入面五年回報最高嘅同類基金。供款帳戶未必轉得去其他計劃。"
                          : "Your fund next to the highest 5-year funds of the same type in other schemes. A contribution account may not be able to move."}
                      </p>
                    </div>
                  ) : null}
                </Card>
              ))}

              {result.dis ? (
                <Card>
                  <h3 className="font-display text-lg">{zh ? "對照：如果全部放預設投資策略" : "Benchmark: all in the Default Investment Strategy"}</h3>
                  <p className="mt-1 text-sm text-fg">
                    {zh ? (
                      [
                        `全部轉做「${result.dis.caf.nameZh}」（約六成環球股票、四成債券，收費有法定上限，50 歲後會自動逐步減股票）：`,
                        `開支比率 ${result.dis.fer.toFixed(2)}%（而家 ${result.fer?.toFixed(2)}%），`,
                        `每年收費約 $${Math.round(result.dis.annual).toLocaleString("en-HK")}（而家 $${Math.round(result.dis.annualNow).toLocaleString("en-HK")}${result.dis.example ? "，以結餘 $200,000 做例子" : ""}）。`,
                        result.dis.gap > 500
                          ? `到 ${profile.retireAge} 歲累積大約少收 $${Math.round(result.dis.gap).toLocaleString("en-HK")}。`
                          : result.dis.gap < -500
                            ? `而家嘅組合收費已經低過核心累積，到 ${profile.retireAge} 歲累積大約少收 $${Math.round(-result.dis.gap).toLocaleString("en-HK")}。`
                            : "收費同而家差唔多。",
                        `風險級別 ${result.dis.caf.riskClass ?? "—"}（而家平均 ${result.riskClass?.toFixed(1) ?? "—"}）。`,
                        profile.age >= 50
                          ? `你而家 ${profile.age} 歲，預設投資策略已經開始逐年將部分轉去「65歲後基金」（約兩成股票），所以實際收費同風險會再低啲。`
                          : "",
                      ].join("")
                    ) : (
                      <>
                        All in {result.dis.caf.nameEn}: FER {result.dis.fer.toFixed(2)}% (now {result.fer?.toFixed(2)}%), about HK$
                        {Math.round(result.dis.annual).toLocaleString("en-HK")} a year (now HK${Math.round(result.dis.annualNow).toLocaleString("en-HK")}). Risk class{" "}
                        {result.dis.caf.riskClass ?? "—"}.
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {zh
                      ? "唔係建議，只係大部分人會用嚟比較嘅基準。累積數字假設扣費前回報一樣（每年 5%）。"
                      : "Not a recommendation, just the common benchmark. Assumes the same gross return (5% a year)."}
                  </p>
                  <Link to="/funds/$id" params={{ id: result.dis.caf.id }} className="mt-2 inline-block text-sm text-[#00753E] underline underline-offset-2 print:hidden">
                    {zh ? "睇核心累積基金詳情" : "See the Core Accumulation Fund"}
                  </Link>
                </Card>
              ) : null}

              {scheme ? (
                <Card className="print:hidden">
                  <h3 className="font-display text-lg">{zh ? "下一步" : "Next"}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {zh
                      ? `睇下喺「${schemes.find((x) => x.en === scheme)?.zh ?? scheme}」入面，按你嘅年齡同目標計出嚟嘅參考配置。`
                      : "See a reference mix inside this scheme for your age and goal."}
                  </p>
                  <Button asChild className="mt-3 w-full sm:w-auto">
                    <Link to="/recommend" search={{ scheme }}>
                      {zh ? "用呢個計劃睇參考配置" : "See a reference mix in this scheme"}
                    </Link>
                  </Button>
                </Card>
              ) : null}

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
