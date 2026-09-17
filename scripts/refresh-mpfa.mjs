#!/usr/bin/env node
/**
 * Pull the MPFA Fund Platform HTML table and merge numeric fields into funds.json.
 * Existing ids / sleeves / Chinese names are kept. New funds are classified from typeEn.
 *
 *   node scripts/refresh-mpfa.mjs
 *   node scripts/refresh-mpfa.mjs --force
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUNDS_PATH = join(ROOT, "src/data/funds.json");
const I18N_PATH = join(ROOT, "src/lib/i18n.ts");
const RETURNS_PATH = join(ROOT, "src/lib/mpf/returns.ts");
const FORCE = process.argv.includes("--force");
const EN_URL = "https://mfp.mpfa.org.hk/eng/mpp_list.jsp";
const ZH_URL = "https://mfp.mpfa.org.hk/tch/mpp_list.jsp";

const MONTHS = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

function parseAsOf(html) {
  const m = html.match(/Latest information as of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
    || html.match(/最新資料截至\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  if (m[2] && MONTHS[m[2].slice(0, 3)]) {
    return `${m[3]}-${MONTHS[m[2].slice(0, 3)]}-${m[1].padStart(2, "0")}`;
  }
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function num(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/,/g, "").trim();
  if (!s || /^n\.?a\.?$/i.test(s) || s === "-" || s === "—") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isoLaunch(raw) {
  const m = String(raw).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

class TableParser {
  constructor() {
    this.rows = [];
    this.row = null;
    this.cell = null;
  }
  feed(html) {
    const tokens = html.split(/(<\/?t[rd][^>]*>)/i);
    for (const tok of tokens) {
      const openTr = tok.match(/^<tr\b/i);
      const closeTr = tok.match(/^<\/tr/i);
      const openTd = tok.match(/^<td\b/i);
      const closeTd = tok.match(/^<\/td/i);
      if (openTr) this.row = [];
      else if (openTd) this.cell = "";
      else if (closeTd && this.cell != null && this.row) {
        this.row.push(this.cell.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        this.cell = null;
      } else if (closeTr && this.row) {
        if (this.row.length >= 20) this.rows.push(this.row);
        this.row = null;
      } else if (this.cell != null) {
        this.cell += tok;
      }
    }
    return this.rows;
  }
}

function rowToRecord(row) {
  if (row.length < 29) return null;
  if (!row[1] || row[1].includes("1 Year") || row[1].includes("一年")) return null;
  return {
    schemeEn: row[1],
    nameEn: row[3],
    trusteeCode: row[4].toLowerCase(),
    typeEn: row[5],
    launch: isoLaunch(row[6]),
    aumM: num(row[7]),
    riskClass: num(row[8]),
    fer: num(row[9]),
    ret1y: num(row[10]),
    ret5y: num(row[11]),
    ret10y: num(row[12]),
    retSince: num(row[13]),
    cum5y: num(row[15]),
    cum10y: num(row[16]),
    cumSince: num(row[17]),
    y2025: num(row[18]),
    y2024: num(row[19]),
    y2023: num(row[20]),
    y2022: num(row[21]),
    y2021: num(row[22]),
    mgmtFee: row[23] || "",
    trusteeFee: row[24] || "",
    empfFee: num(row[25]),
    invFee: row[27] || "",
    guaranteeCharge: row[28] || "",
  };
}

function classifySleeve(typeEn, nameEn) {
  const t = typeEn.toLowerCase();
  const n = nameEn.toLowerCase();
  if (t.includes("age 65")) return "dis-a65";
  if (t.includes("core accumulation")) return "dis-caf";
  if (t.includes("mpf conservative")) return "conservative";
  if (t.includes("guaranteed")) return "guaranteed";
  if (n.includes("korea") || n.includes("korean")) return "korea";
  if (n.includes("health")) return "healthcare";
  if (/\besg\b/.test(n) || n.includes("green")) return "esg";
  if (t.includes("japan")) return "japan";
  if (t.includes("united states")) return "us";
  if (t.includes("europe")) return "europe";
  if (t.includes("greater china")) return "greater-china";
  if (t.includes("china equity")) return "china";
  if (t.includes("hong kong equity")) return n.includes("china") ? "hk-china" : "hk";
  if (t.includes("asia equity")) return "asia";
  if (t.includes("global equity")) return n.includes("china") ? "china" : "global";
  if (t.includes("rmb bond")) return "bond-cn";
  if (t.includes("asia bond")) return "bond-asia";
  if (t.includes("hong kong dollar bond") || t.includes("hkd bond")) return "bond-hk";
  if (t.includes("global bond")) return "bond-global";
  if (t.includes("money market")) return "money";
  if (t.includes("21% to 40%")) return "mixed-conservative";
  if (t.includes("41% to 60%")) return "mixed-balanced";
  if (t.includes("61% to 80%")) return "mixed-growth";
  if (t.includes("81% to 100%")) return "mixed-aggressive";
  if (n.includes("saveeasy") || n.includes("target date") || n.includes("retirement fund")) return "mixed-target";
  if (t.includes("mixed")) return "mixed-global";
  if (t.includes("equity")) return "global";
  return "mixed-global";
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function categoryOf(sleeve, typeEn) {
  if (sleeve.startsWith("bond") || typeEn.includes("Bond Fund")) return "bond";
  if (sleeve === "guaranteed" || typeEn.includes("Guaranteed")) return "guaranteed";
  if (sleeve === "conservative" || sleeve === "money" || typeEn.includes("Money Market")) return "money";
  if (typeEn.includes("Mixed") || sleeve.startsWith("mixed") || sleeve.startsWith("dis")) return "mixed";
  return "equity";
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MPFCompass/1.0; +https://github.com/mickoo129/mpf-compass)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function main() {
  const catalog = JSON.parse(readFileSync(FUNDS_PATH, "utf8"));
  console.log("catalog asOf", catalog.meta.asOf, "funds", catalog.funds.length);

  const enHtml = await fetchHtml(EN_URL);
  const asOf = parseAsOf(enHtml);
  if (!asOf) throw new Error("Could not read MPFA as-of date");
  console.log("platform asOf", asOf);

  if (asOf === catalog.meta.asOf && !FORCE) {
    console.log("No newer MPFA snapshot. Exit without writing.");
    return;
  }

  const enRows = new TableParser().feed(enHtml).map(rowToRecord).filter(Boolean);
  console.log("parsed EN rows", enRows.length);
  if (enRows.length < 400) throw new Error(`Too few rows: ${enRows.length}`);

  let zhRows = [];
  try {
    const zhHtml = await fetchHtml(ZH_URL);
    zhRows = new TableParser().feed(zhHtml).map((row) => {
      if (row.length < 29 || !row[1] || row[1].includes("一年")) return null;
      return { schemeZh: row[1], nameZh: row[3], launch: isoLaunch(row[6]), aumM: num(row[7]), fer: num(row[9]) };
    }).filter(Boolean);
  } catch (err) {
    console.warn("ZH fetch failed", err.message);
  }

  const zhByFp = new Map();
  for (const z of zhRows) {
    zhByFp.set(`${z.launch}|${z.aumM}|${z.fer}`, z);
  }

  const byKey = new Map(catalog.funds.map((f) => [`${f.schemeEn}||${f.nameEn}`, f]));
  const trusteeSample = new Map();
  for (const f of catalog.funds) {
    if (!trusteeSample.has(f.trusteeCode)) trusteeSample.set(f.trusteeCode, f);
  }

  const merged = [];
  let updated = 0;
  let added = 0;
  for (const row of enRows) {
    const key = `${row.schemeEn}||${row.nameEn}`;
    const prev = byKey.get(key);
    const zh = zhByFp.get(`${row.launch}|${row.aumM}|${row.fer}`);
    if (prev) {
      updated += 1;
      merged.push({
        ...prev,
        typeEn: row.typeEn || prev.typeEn,
        launch: row.launch ?? prev.launch,
        aumM: row.aumM,
        riskClass: row.riskClass,
        fer: row.fer,
        ret1y: row.ret1y,
        ret5y: row.ret5y,
        ret10y: row.ret10y,
        retSince: row.retSince,
        cum5y: row.cum5y,
        cum10y: row.cum10y,
        cumSince: row.cumSince,
        y2025: row.y2025,
        y2024: row.y2024,
        y2023: row.y2023,
        y2022: row.y2022,
        y2021: row.y2021,
        mgmtFee: row.mgmtFee || prev.mgmtFee,
        trusteeFee: row.trusteeFee || prev.trusteeFee,
        empfFee: row.empfFee,
        invFee: row.invFee || prev.invFee,
        guaranteeCharge: row.guaranteeCharge || prev.guaranteeCharge,
      });
      byKey.delete(key);
    } else {
      added += 1;
      const sleeve = classifySleeve(row.typeEn, row.nameEn);
      const sample = trusteeSample.get(row.trusteeCode);
      merged.push({
        id: slug(`${row.schemeEn}-${row.nameEn}`),
        nameEn: row.nameEn,
        nameZh: zh?.nameZh || row.nameEn,
        schemeEn: row.schemeEn,
        schemeZh: zh?.schemeZh || sample?.schemeZh || row.schemeEn,
        trusteeCode: sample?.trusteeCode || row.trusteeCode,
        trusteeEn: sample?.trusteeEn || row.trusteeCode,
        trusteeZh: sample?.trusteeZh || row.trusteeCode,
        providerCode: sample?.providerCode || row.trusteeCode,
        providerEn: sample?.providerEn || row.trusteeCode,
        providerZh: sample?.providerZh || row.trusteeCode,
        typeEn: row.typeEn,
        typeZh: sample?.typeZh || row.typeEn,
        category: categoryOf(sleeve, row.typeEn),
        sleeve,
        tags: [],
        isDis: sleeve === "dis-caf" || sleeve === "dis-a65",
        isCaf: sleeve === "dis-caf",
        isA65: sleeve === "dis-a65",
        isConservative: sleeve === "conservative",
        isTracker: /index|tracker|恒指|指數/i.test(row.nameEn),
        bench: "",
        beta: 1,
        launch: row.launch,
        aumM: row.aumM,
        riskClass: row.riskClass,
        fer: row.fer,
        ret1y: row.ret1y,
        ret5y: row.ret5y,
        ret10y: row.ret10y,
        retSince: row.retSince,
        cum5y: row.cum5y,
        cum10y: row.cum10y,
        cumSince: row.cumSince,
        y2025: row.y2025,
        y2024: row.y2024,
        y2023: row.y2023,
        y2022: row.y2022,
        y2021: row.y2021,
        mgmtFee: row.mgmtFee,
        trusteeFee: row.trusteeFee,
        empfFee: row.empfFee,
        invFee: row.invFee,
        guaranteeCharge: row.guaranteeCharge,
      });
    }
  }
  const dropped = [...byKey.keys()];
  if (dropped.length) console.warn("dropped (no longer on platform)", dropped.length, dropped.slice(0, 8));

  const schemes = new Set(merged.map((f) => f.schemeEn));
  catalog.meta = {
    ...catalog.meta,
    asOf,
    fundCount: merged.length,
    schemeCount: schemes.size,
    source: "MPFA Fund Platform mfp.mpfa.org.hk",
    sourceUrl: "https://mfp.mpfa.org.hk/",
  };
  catalog.funds = merged;
  writeFileSync(FUNDS_PATH, `${JSON.stringify(catalog)}\n`);
  console.log("wrote", FUNDS_PATH, "updated", updated, "added", added, "dropped", dropped.length);

  const enPretty = asOf.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(d)} ${names[Number(m) - 1]} ${y}`;
  });
  let i18n = readFileSync(I18N_PATH, "utf8");
  i18n = i18n.replace(/截至 \d{4}-\d{2}-\d{2}/, `截至 ${asOf}`);
  i18n = i18n.replace(/as of \d{1,2} [A-Za-z]+ \d{4}/, `as of ${enPretty}`);
  writeFileSync(I18N_PATH, i18n);

  let returns = readFileSync(RETURNS_PATH, "utf8");
  returns = returns.replace(/截至 \d{4}-\d{2}-\d{2}/g, `截至 ${asOf}`);
  returns = returns.replace(/as of \d{4}-\d{2}-\d{2}/g, `as of ${asOf}`);
  writeFileSync(RETURNS_PATH, returns);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
