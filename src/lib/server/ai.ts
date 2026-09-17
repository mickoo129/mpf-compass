import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { allFunds } from "@/lib/mpf/catalog";
import { buildAllocation, scoreFunds } from "@/lib/mpf/score";
import type { Profile } from "@/lib/mpf/types";

const ProfileSchema = z.object({
  age: z.number(),
  retireAge: z.number(),
  balance: z.number(),
  monthly: z.number(),
  account: z.enum(["contribution", "personal"]),
  schemeEn: z.string().nullable(),
  goal: z.enum(["growth", "balanced", "preserve", "lowfee", "dis", "regime"]),
  risk: z.enum(["conservative", "moderate", "aggressive"]),
});

const MarketsBrief = z.array(
  z.object({
    symbol: z.string(),
    nameZh: z.string(),
    changePct: z.number().nullable(),
    ytdPct: z.number().nullable(),
    price: z.number().nullable(),
  }),
);

export type OutlookJson = {
  headline: string;
  regime: string;
  forMpf: string[];
  risks: string[];
  next12m: string;
  whatToAvoid: string;
};

export type RecJson = {
  verdict: string;
  why: string[];
  watchouts: string[];
  horizon: string;
  oneLiner: string;
};

type MarketsRow = z.infer<typeof MarketsBrief>[number];

/** Fresh xAI calls per UTC day (cache hits do not count). */
const DAILY_CAP = 48;
const OUTLOOK_TTL_MS = 45 * 60 * 1000;
const REC_TTL_MS = 20 * 60 * 1000;

const ERR_NO_KEY = "Grok 研判暫時未能使用。基金庫、比較與智選打分不受影響。";
const ERR_QUOTA =
  "Grok 配額已用完或暫時受限。查找、比較與推介打分仍可用，稍後再試研判。";
const ERR_CAP = "今日公開 Grok 研判已達上限。查找、比較與智選打分仍可用。";
const ERR_API = "Grok 暫時未能回應。查找與打分仍可用。";

let dayKey = "";
let usedToday = 0;
const outlookCache = new Map<string, { at: number; json: OutlookJson }>();
const recCache = new Map<string, { at: number; json: RecJson }>();
const outlookInflight = new Map<string, Promise<{ ok: true; json: OutlookJson } | { ok: false; error: string }>>();
const recInflight = new Map<
  string,
  Promise<
    | { ok: true; json: RecJson; allocation: { fundId: string; weight: number }[] }
    | { ok: false; error: string; allocation: { fundId: string; weight: number }[] }
  >
>();

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function parseOutlook(raw: string): OutlookJson {
  try {
    const json = JSON.parse(raw.replace(/^```json\n?|```$/g, "").trim()) as Record<string, unknown>;
    return {
      headline: asString(json.headline),
      regime: asString(json.regime),
      forMpf: asStringArr(json.forMpf),
      risks: asStringArr(json.risks),
      next12m: asString(json.next12m),
      whatToAvoid: asString(json.whatToAvoid),
    };
  } catch {
    return { headline: raw.slice(0, 180), regime: raw, forMpf: [], risks: [], next12m: "", whatToAvoid: "" };
  }
}

function parseRec(raw: string): RecJson {
  try {
    const json = JSON.parse(raw.replace(/^```json\n?|```$/g, "").trim()) as Record<string, unknown>;
    return {
      verdict: asString(json.verdict),
      why: asStringArr(json.why),
      watchouts: asStringArr(json.watchouts),
      horizon: asString(json.horizon),
      oneLiner: asString(json.oneLiner),
    };
  } catch {
    return { verdict: raw.slice(0, 400), why: [], watchouts: [], horizon: "", oneLiner: "" };
  }
}

function compactFund(id: string) {
  const f = allFunds.find((x) => x.id === id);
  if (!f) return null;
  return {
    id: f.id,
    nameZh: f.nameZh,
    nameEn: f.nameEn,
    schemeZh: f.schemeZh,
    sleeve: f.sleeve,
    fer: f.fer,
    riskClass: f.riskClass,
    ret1y: f.ret1y,
    ret5y: f.ret5y,
    ret10y: f.ret10y,
    aumM: f.aumM,
  };
}

function roundPct(n: number | null | undefined): number | null {
  return n == null || Number.isNaN(n) ? null : Math.round(n * 10) / 10;
}

function marketsKey(markets: MarketsRow[]): string {
  return markets
    .map((q) => `${q.symbol}:${roundPct(q.changePct)}:${roundPct(q.ytdPct)}`)
    .join("|");
}

function takeFreshSlot(): string | null {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== dayKey) {
    dayKey = d;
    usedToday = 0;
  }
  if (usedToday >= DAILY_CAP) return ERR_CAP;
  usedToday += 1;
  return null;
}

function cacheGet<T>(map: Map<string, { at: number; json: T }>, key: string, ttl: number): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    map.delete(key);
    return null;
  }
  return hit.json;
}

async function grokJson(system: string, user: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: ERR_NO_KEY };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.3,
      max_tokens: 1100,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429 || res.status === 402) return { ok: false, error: ERR_QUOTA };
  if (!res.ok) return { ok: false, error: `${ERR_API}（${res.status}）` };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { ok: true, text: body.choices?.[0]?.message?.content ?? "" };
}

export const analyzeOutlook = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ markets: MarketsBrief }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true; json: OutlookJson } | { ok: false; error: string }> => {
    const key = marketsKey(data.markets);
    const cached = cacheGet(outlookCache, key, OUTLOOK_TTL_MS);
    if (cached) return { ok: true, json: cached };

    const pending = outlookInflight.get(key);
    if (pending) return pending;

    const job = (async () => {
      const capped = takeFreshSlot();
      if (capped) return { ok: false as const, error: capped };
      const system = `你是香港強積金研究員。用繁體中文、書面語為主、簡潔專業。不可聲稱保本或承諾回報。結合提供的即時指數與 2026 年至今強積金語境：亞洲供應鏈／韓日台上半年強、美股仍堅、港股中國溫和、美債 10 年偏高。輸出 JSON，不要 markdown。
shape:
{"headline":"","regime":"","forMpf":["","",""],"risks":["",""],"next12m":"","whatToAvoid":""}`;
      const user = `即時指數（Yahoo）：\n${JSON.stringify(data.markets)}\n今日是 2026-09-11 香港。請研判對強積金配置的含義。`;
      const out = await grokJson(system, user);
      if (!out.ok) return out;
      const json = parseOutlook(out.text);
      outlookCache.set(key, { at: Date.now(), json });
      return { ok: true as const, json };
    })().finally(() => {
      outlookInflight.delete(key);
    });

    outlookInflight.set(key, job);
    return job;
  });

export const analyzeRecommendation = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ profile: ProfileSchema, markets: MarketsBrief }).parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; json: RecJson; allocation: { fundId: string; weight: number }[] }
      | { ok: false; error: string; allocation: { fundId: string; weight: number }[] }
    > => {
      const profile = data.profile as Profile;
      const ranked = scoreFunds(profile).slice(0, 12);
      const alloc = buildAllocation(profile, ranked);
      const allocation = alloc.map((a) => ({ fundId: a.fund.id, weight: a.weight }));
      const recKey = [
        profile.age,
        profile.retireAge,
        profile.goal,
        profile.risk,
        profile.account,
        profile.schemeEn ?? "",
        Math.round(profile.balance / 50_000),
        Math.round(profile.monthly / 500),
        allocation.map((a) => `${a.fundId}:${Math.round(a.weight * 100)}`).join(","),
        marketsKey(data.markets),
      ].join("|");

      const cached = cacheGet(recCache, recKey, REC_TTL_MS);
      if (cached) return { ok: true, json: cached, allocation };

      const pending = recInflight.get(recKey);
      if (pending) return pending;

      const job = (async () => {
        const capped = takeFreshSlot();
        if (capped) return { ok: false as const, error: capped, allocation };
        const system = `你是香港強積金配置顧問。用繁體中文。必須：
- 聲明並非投資建議
- 解釋為何這些基金配該目標（年齡、年期、收費、同類往績、眼下局勢）
- 指出主要風險與不適合誰
- 不要吹捧一年暴升的主題基金作核心（尤其韓國股票一年翻倍後回吐風險）
- 提到積金局數據截至 2026-08-31，指數是即時的
輸出 JSON，不要 markdown：
{"verdict":"","why":["","",""],"watchouts":["",""],"horizon":"","oneLiner":""}`;
        const user = JSON.stringify({
          profile,
          allocation: alloc.map((a) => ({ weight: a.weight, ...compactFund(a.fund.id) })),
          shortlist: ranked.slice(0, 8).map((s) => ({
            score: Number(s.score.toFixed(3)),
            ...compactFund(s.fund.id),
          })),
          markets: data.markets,
        });
        const out = await grokJson(system, user);
        if (!out.ok) return { ...out, allocation };
        const json = parseRec(out.text);
        recCache.set(recKey, { at: Date.now(), json });
        return { ok: true as const, json, allocation };
      })().finally(() => {
        recInflight.delete(recKey);
      });

      recInflight.set(recKey, job);
      return job;
    },
  );
