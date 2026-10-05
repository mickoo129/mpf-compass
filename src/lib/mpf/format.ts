export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function fmtPctPlain(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-HK", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtAum(m: number | null | undefined, zh = true): string {
  if (m == null || Number.isNaN(m)) return "—";
  if (!zh) return fmtAumEn(m);
  // Input is HK$ millions. Hong Kong readers count in 萬 / 億 / 萬億, not 百萬 / 十億.
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} 萬億`;
  if (m >= 100) return `${fmtNum(m / 100, m >= 10_000 ? 0 : 1)} 億`;
  return `${fmtNum(m * 100, 0)} 萬`;
}

export function fmtAumEn(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  if (m >= 1000) return `HK$${(m / 1000).toLocaleString("en-HK", { maximumFractionDigits: 1 })}bn`;
  return `HK$${fmtNum(m, 0)}m`;
}

export function fmtHkd(n: number): string {
  return n.toLocaleString("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  });
}

export function riskTone(risk: number | null): string {
  if (risk == null) return "text-muted";
  if (risk <= 2) return "text-up";
  if (risk >= 6) return "text-down";
  if (risk >= 5) return "text-warn";
  return "text-fg";
}

export function retClass(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n === 0) return "text-muted";
  return n > 0 ? "text-up" : "text-down";
}

/** Compact HK$ for chart axes: 150 萬 / 1.5M. */
export function fmtAxisHkd(v: number, zh: boolean): string {
  if (v === 0) return "0";
  if (zh) {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)} 億`;
    if (v >= 10_000) return `${Math.round(v / 10_000)} 萬`;
    return String(Math.round(v));
  }
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`;
}
