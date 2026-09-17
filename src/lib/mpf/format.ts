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

export function fmtAum(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} 十億`;
  return `${fmtNum(m, 0)} 百萬`;
}

export function fmtAumEn(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  if (m >= 1000) return `HK$${ (m / 1000).toFixed(1)}bn`;
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
