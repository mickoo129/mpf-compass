import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * 整數輸入（例如年齡）。打字途中唔會即刻俾範圍彈走：喺範圍內先即時更新，
 * 離開格（或者撳 Enter）先夾返入 min–max。之前每撳一個鍵就夾，打「4」即刻變 18，
 * 打唔到 40。
 */
export function IntField({
  value,
  min,
  max,
  onCommit,
  className,
  ...rest
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const [text, setText] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);
  const commit = () => {
    editing.current = false;
    const n = Number(text);
    const v = text === "" || !Number.isFinite(n) ? value : Math.min(max, Math.max(min, Math.round(n)));
    setText(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={text}
      className={cn("font-mono", className)}
      onFocus={(e) => {
        editing.current = true;
        // 撳落去就全選，直接打新數字會取代舊數字（等撳完先選，唔係會俾游標覆蓋）
        const el = e.currentTarget;
        window.setTimeout(() => {
          if (document.activeElement === el) el.select();
        }, 0);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
        setText(raw);
        const n = Number(raw);
        if (raw !== "" && n >= min && n <= max) onCommit(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/**
 * 港元金額輸入：顯示千位逗號，但改中間數字時游標唔會跳去最尾。
 */
export function MoneyField({
  value,
  onChange,
  className,
  maxDigits = 9,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  maxDigits?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const ref = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  const shown = value > 0 ? Math.round(value).toLocaleString("en-HK") : "";

  // 重新排好逗號之後，將游標放返喺「左邊有同樣數目嘅數字」嗰度
  useEffect(() => {
    const el = ref.current;
    const want = caretDigits.current;
    if (!el || want == null || document.activeElement !== el) return;
    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < want) {
      if (/\d/.test(el.value[pos] ?? "")) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [shown]);

  return (
    <Input
      {...rest}
      ref={ref}
      inputMode="numeric"
      value={shown}
      className={cn("font-mono", className)}
      onChange={(e) => {
        const el = e.target;
        const before = el.value.slice(0, el.selectionStart ?? el.value.length);
        caretDigits.current = before.replace(/[^\d]/g, "").length;
        const raw = el.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, maxDigits);
        onChange(raw === "" ? 0 : Number(raw));
      }}
    />
  );
}
