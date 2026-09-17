export function Sparkline({
  data,
  className,
  width = 88,
  height = 28,
}: {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const d = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const up = data[data.length - 1]! >= data[0]!;
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.5" />
    </svg>
  );
}
